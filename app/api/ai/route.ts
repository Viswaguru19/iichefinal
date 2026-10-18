import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { answerIicheAi, type IicheAiMessage } from '@/lib/iiche-ai';
import { runIicheAiTool, type IicheAiToolCtx } from '@/lib/iiche-ai-actions';

export const dynamic = 'force-dynamic';

async function textFromAttachment(att: { filename?: string; mime?: string; data?: string }): Promise<string> {
  const data = String(att.data || '');
  if (!data) return '';
  const buf = Buffer.from(data, 'base64');
  const name = `${att.filename || ''} ${att.mime || ''}`.toLowerCase();
  if (/\.pdf|application\/pdf/.test(name)) {
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const extracted = await extractText(pdf, { mergePages: true });
      const text = Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text;
      return String(text || '').trim();
    } catch {
      return '';
    }
  }
  if (/\.xlsx|\.xls|spreadsheet|excel/.test(name) || (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && /\.xlsx?$/.test(att.filename || ''))) {
    try {
      const XLSX = await import('xlsx');
      let wb;
      try {
        wb = XLSX.read(buf, { type: 'buffer', raw: false });
      } catch {
        wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: false });
      }
      const csv = (wb.SheetNames || [])
        .map((sheetName) => XLSX.utils.sheet_to_csv(wb.Sheets[sheetName] || {}, { blankrows: false }).trim())
        .filter(Boolean)
        .join('\n');
      return csv;
    } catch {
      return '';
    }
  }
  return buf.toString('utf8');
}

function trimHistory(raw: unknown): IicheAiMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: IicheAiMessage[] = [];
  for (const row of raw.slice(-10)) {
    const role = row?.role === 'assistant' ? 'assistant' : row?.role === 'user' ? 'user' : null;
    const content = String(row?.content || '').trim();
    if (!role || !content) continue;
    out.push({ role, content: content.slice(0, 20000) });
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to use IIChE AI' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let message = String(body?.message || '').trim().slice(0, 20000);
    const attachment = body?.attachment as { filename?: string; mime?: string; data?: string } | undefined;
    if (attachment?.data) {
      const extracted = await textFromAttachment(attachment);
      const kind = `${attachment.filename || ''} ${attachment.mime || ''}`;
      const isPdf = /\.pdf|application\/pdf/i.test(kind);
      const isSheet = /\.xlsx|\.xls|spreadsheet|excel/i.test(kind);
      if (extracted.trim()) {
        message = `${message}\n\nAttached ${attachment.filename || 'file'}:\n${extracted.trim()}`.slice(0, 20000);
      } else if (isPdf || isSheet) {
        message = `${message}\n\nAttached ${attachment.filename || 'file'} but the sheet could not be read. Save it as CSV or paste Name,Roll No lines.`.slice(0, 20000);
      }
    }
    if (!message) {
      return NextResponse.json({ error: 'Ask a question' }, { status: 400 });
    }

    const history = trimHistory(body?.history);
    if (!history.length || history[history.length - 1]?.content !== message) {
      history.push({ role: 'user', content: message });
    }

    const origin = (request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const posterDraft = body?.posterDraft as {
      path?: string;
      eventId?: string;
      title?: string;
      dataUrl?: string;
    } | undefined;
    const peopleDraft = body?.participantDraft as {
      eventId?: string;
      eventTitle?: string;
      rows?: Array<{ name: string; email: string }>;
    } | undefined;
    const ctx: IicheAiToolCtx = {
      supabase,
      directory: tryCreateAdminClient() ?? supabase,
      userId: user.id,
      userEmail: user.email || '',
      userName: String(user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || '').trim(),
      origin,
      cookie: request.headers.get('cookie') || '',
      posterDraft: posterDraft?.eventId
        ? {
            path: String(posterDraft.path || ''),
            eventId: String(posterDraft.eventId),
            title: String(posterDraft.title || ''),
            dataUrl: posterDraft.dataUrl ? String(posterDraft.dataUrl) : undefined,
          }
        : null,
      participantDraft:
        peopleDraft?.eventId && Array.isArray(peopleDraft.rows)
          ? {
              eventId: String(peopleDraft.eventId),
              eventTitle: String(peopleDraft.eventTitle || ''),
              rows: peopleDraft.rows.map((r) => ({ name: String(r.name || ''), email: String(r.email || '') })),
            }
          : null,
      history,
      currentEventId: body?.currentEventId ? String(body.currentEventId) : null,
    };

    const { reply, provider, navigate, posterDraft: nextDraft, posterUrl, participantDraft } = await answerIicheAi(
      history,
      (name, args) => runIicheAiTool(ctx, name, args),
    );
    return NextResponse.json({
      reply,
      provider,
      navigate,
      posterDraft: nextDraft || ctx.posterDraft,
      posterUrl: posterUrl || nextDraft?.dataUrl,
      participantDraft: participantDraft === undefined ? ctx.participantDraft : participantDraft,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err.message || 'IIChE AI is unavailable' }, { status: 500 });
  }
}
