import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/notifications';
import { isPortalAdmin } from '@/lib/permissions';
import {
  buildEventParticipantEmail,
  draftParticipantInviteMessage,
  plainTextToParticipantEmailHtml,
} from '@/lib/event-participant-email-builder';
import {
  participantCheckInPayload,
  resolveParticipantSendEmail,
} from '@/lib/event-participant-qr';

export const runtime = 'nodejs';

const EC_COMMITTEE_ID = '00000000-0000-0000-0000-000000000001';

async function canSendToEventParticipants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  committeeId: string | null,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_faculty, is_admin, role, executive_role, committee_members(committee_id)')
    .eq('id', userId)
    .single();

  if (!profile) return false;

  const isFaculty = profile.is_faculty === true || profile.is_admin === true;
  const isEC =
    profile.executive_role != null ||
    (profile.committee_members as { committee_id: string }[] | null)?.some(
      (m) => m.committee_id === EC_COMMITTEE_ID,
    );
  const isAdmin = isPortalAdmin(profile);
  const onCommittee =
    committeeId &&
    (profile.committee_members as { committee_id: string }[] | null)?.some(
      (m) => m.committee_id === committeeId,
    );

  return Boolean(isFaculty || isEC || isAdmin || onCommittee);
}

function posterMime(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const eventId = String(body.eventId || '').trim();
    const extraNotes = String(body.extraNotes || '').trim();
    const groupFilter = body.groupFilter ? String(body.groupFilter).trim() : null;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }
    if (extraNotes.length > 4000) {
      return NextResponse.json({ error: 'Extra notes are too long (max 4,000 characters)' }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, event_date, location, committee_id, status, poster_url')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const allowed = await canSendToEventParticipants(supabase, user.id, event.committee_id);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const subject = String(body.subject || '').trim() || `You're invited: ${event.title}`;
    if (subject.length > 200) {
      return NextResponse.json({ error: 'Subject is too long (max 200 characters)' }, { status: 400 });
    }

    const messageBody = draftParticipantInviteMessage({
      eventTitle: event.title,
      extraNotes,
    });

    const { data: participants, error: participantsError } = await supabase
      .from('event_participants')
      .select('id, participant_name, participant_email, participant_group, qr_data, created_at, form_data')
      .eq('event_id', eventId);

    if (participantsError) {
      return NextResponse.json({ error: participantsError.message }, { status: 500 });
    }

    let rows = participants || [];
    if (groupFilter && groupFilter !== 'all') {
      rows = rows.filter((p) => {
        const label = p.participant_group?.trim() || 'Unassigned';
        return label === groupFilter;
      });
    }

    const seen = new Set<string>();
    const recipients: {
      email: string;
      name: string;
      id: string;
      participant_email: string | null;
      qr_data: string | null;
      created_at: string | null;
    }[] = [];
    let skippedNoEmail = 0;
    let sentToCampusRoll = 0;

    for (const row of rows) {
      const resolved = resolveParticipantSendEmail(row);
      if (!resolved.email) {
        skippedNoEmail += 1;
        continue;
      }
      if (seen.has(resolved.email)) continue;
      seen.add(resolved.email);
      if (resolved.fromRoll) sentToCampusRoll += 1;
      recipients.push({
        email: resolved.email,
        name: row.participant_name?.trim() || 'Participant',
        id: row.id,
        participant_email: row.participant_email,
        qr_data: row.qr_data,
        created_at: row.created_at,
      });
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        {
          error: `No participants with a valid email or roll number${groupFilter && groupFilter !== 'all' ? ' in this group' : ''}.`,
          skippedNoEmail,
          totalParticipants: rows.length,
        },
        { status: 400 },
      );
    }

    let posterAttachment: { filename: string; content: Buffer; contentType: string; contentId: string } | null =
      null;
    if (event.poster_url) {
      const { data: posterFile } = await supabase.storage.from('event-documents').download(event.poster_url);
      if (posterFile) {
        const content = Buffer.from(await posterFile.arrayBuffer());
        const filename = event.poster_url.split('/').pop() || 'event-poster.png';
        posterAttachment = {
          filename,
          content,
          contentType: posterMime(filename),
          contentId: 'event-poster',
        };
      }
    }

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const bodyHtml = plainTextToParticipantEmailHtml(messageBody, recipient.name);
      const attachments: Array<{ filename: string; content: Buffer; contentType: string; contentId?: string }> = [];
      if (posterAttachment) attachments.push(posterAttachment);

      const payload = participantCheckInPayload(
        {
          id: recipient.id,
          participant_name: recipient.name,
          participant_email: recipient.participant_email,
          qr_data: recipient.qr_data,
          created_at: recipient.created_at,
        },
        eventId,
      );
      const qrJson = JSON.stringify(payload);
      if (!recipient.qr_data) {
        await supabase.from('event_participants').update({ qr_data: qrJson }).eq('id', recipient.id);
      }
      const png = await QRCode.toBuffer(qrJson, { type: 'png', width: 280, margin: 1 });
      attachments.push({
        filename: `check-in-qr-${recipient.name.replace(/[^\w.-]+/g, '-').slice(0, 40)}.png`,
        content: png,
        contentType: 'image/png',
        contentId: 'check-in-qr',
      });

      const emailHtml = buildEventParticipantEmail({
        event,
        subject,
        bodyHtml,
        posterUrl: posterAttachment ? 'cid:event-poster' : undefined,
        checkInQrDataUrl: 'cid:check-in-qr',
      });
      const result = await sendEmail(recipient.email, subject, emailHtml, { attachments });
      if (result.success) sent += 1;
      else failed += 1;
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      skippedNoEmail,
      sentToCampusRoll,
      totalRecipients: recipients.length,
      totalParticipants: rows.length,
      message: `Email sent to ${sent} of ${recipients.length} participant(s)${failed ? ` (${failed} failed)` : ''}.`,
    });
  } catch (err: unknown) {
    console.error('[send-participant-email]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send emails' },
      { status: 500 },
    );
  }
}
