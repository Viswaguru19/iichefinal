import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { answerIicheAi, type IicheAiMessage } from '@/lib/iiche-ai';
import { runIicheAiTool, type IicheAiToolCtx } from '@/lib/iiche-ai-actions';

export const dynamic = 'force-dynamic';

function trimHistory(raw: unknown): IicheAiMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: IicheAiMessage[] = [];
  for (const row of raw.slice(-8)) {
    const role = row?.role === 'assistant' ? 'assistant' : row?.role === 'user' ? 'user' : null;
    const content = String(row?.content || '').trim();
    if (!role || !content) continue;
    out.push({ role, content: content.slice(0, 4000) });
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
    const message = String(body?.message || '').trim().slice(0, 4000);
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
    };

    const { reply, provider, navigate, posterDraft: nextDraft, posterUrl } = await answerIicheAi(history, (name, args) =>
      runIicheAiTool(ctx, name, args),
    );
    return NextResponse.json({
      reply,
      provider,
      navigate,
      posterDraft: nextDraft || ctx.posterDraft,
      posterUrl: posterUrl || nextDraft?.dataUrl,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err.message || 'IIChE AI is unavailable' }, { status: 500 });
  }
}
