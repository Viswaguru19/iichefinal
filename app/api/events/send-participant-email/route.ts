import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/notifications';
import { isPortalAdmin } from '@/lib/permissions';
import {
  buildEventParticipantEmail,
  plainTextToParticipantEmailHtml,
} from '@/lib/event-participant-email-builder';

export const runtime = 'nodejs';

const EC_COMMITTEE_ID = '00000000-0000-0000-0000-000000000001';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

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
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    const groupFilter = body.groupFilter ? String(body.groupFilter).trim() : null;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    if (subject.length > 200) {
      return NextResponse.json({ error: 'Subject is too long (max 200 characters)' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    if (message.length > 10000) {
      return NextResponse.json({ error: 'Message is too long (max 10,000 characters)' }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, event_date, location, committee_id, status')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const allowed = await canSendToEventParticipants(supabase, user.id, event.committee_id);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let participantsQuery = supabase
      .from('event_participants')
      .select('participant_name, participant_email, participant_group')
      .eq('event_id', eventId);

    const { data: participants, error: participantsError } = await participantsQuery;
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
    const recipients: { email: string; name: string }[] = [];
    let skippedNoEmail = 0;

    for (const row of rows) {
      const email = row.participant_email?.trim().toLowerCase() || '';
      if (!email || !isValidEmail(email)) {
        skippedNoEmail += 1;
        continue;
      }
      if (seen.has(email)) continue;
      seen.add(email);
      recipients.push({ email, name: row.participant_name?.trim() || 'Participant' });
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        {
          error: `No participants with a valid email${groupFilter && groupFilter !== 'all' ? ' in this group' : ''}.`,
          skippedNoEmail,
          totalParticipants: rows.length,
        },
        { status: 400 },
      );
    }

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const bodyHtml = plainTextToParticipantEmailHtml(message, recipient.name);
      const emailHtml = buildEventParticipantEmail({
        event,
        subject,
        bodyHtml,
      });
      const result = await sendEmail(recipient.email, subject, emailHtml);
      if (result.success) sent += 1;
      else failed += 1;
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      skippedNoEmail,
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
