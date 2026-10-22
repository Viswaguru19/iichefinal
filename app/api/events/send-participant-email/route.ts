import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { sendEmail, sendEmailWithRetry } from '@/lib/notifications';
import { sendOutlookMail } from '@/lib/outlook-graph';
import { appOriginFromRequest } from '@/lib/member-password';
import { canSendEventParticipantEmail } from '@/lib/member-profile-edit';
import {
  buildEventParticipantEmail,
  draftParticipantInviteMessage,
  participantInvitePlainText,
  plainTextToParticipantEmailHtml,
} from '@/lib/event-participant-email-builder';
import {
  dummyCheckInPayload,
  isValidParticipantEmail,
  participantCheckInPayload,
  participantMyQrPath,
  PREVIEW_PARTICIPANT_NAME,
  remainingEmailsAfterSend,
  resolveParticipantSendEmail,
} from '@/lib/event-participant-qr';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function canSendToEventParticipants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_faculty, is_admin, role, committee_members(committees(name))')
    .eq('id', userId)
    .single();

  if (!profile) return false;
  return canSendEventParticipantEmail(profile, profile.committee_members);
}

function publicEventDocumentUrl(path: string): string {
  const raw = String(path || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/event-documents/${raw.replace(/^\//, '')}`;
}

async function uploadPublicPng(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  png: Buffer,
): Promise<string> {
  const storage = tryCreateAdminClient() ?? supabase;
  const { error } = await storage.storage.from('event-documents').upload(path, png, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) {
    console.error('[send-participant-email] qr upload', error.message);
    return '';
  }
  return publicEventDocumentUrl(path);
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
    const customBody = String(body.messageBody || '').trim();
    let groupFilter = body.groupFilter ? String(body.groupFilter).trim() : null;
    const retryLogId = String(body.retryLogId || '').trim();
    const viaOutlook = Boolean(body.viaOutlook);

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }
    if (extraNotes.length > 4000) {
      return NextResponse.json({ error: 'Extra notes are too long (max 4,000 characters)' }, { status: 400 });
    }
    if (customBody.length > 8000) {
      return NextResponse.json({ error: 'Message is too long (max 8,000 characters)' }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, event_date, location, committee_id, status, poster_url')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const allowed = await canSendToEventParticipants(supabase, user.id);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let retryEmails = new Set<string>();
    let skipDelivered = new Set<string>();
    let retryDeliveredCount = 0;
    let retrySubject = '';
    let retryBody = '';
    if (retryLogId) {
      const { data: prior, error: priorError } = await supabase
        .from('event_participant_email_sends')
        .select('id, event_id, subject, message_body, failed_emails, sent_emails, failed_count, recipient_count, group_filter')
        .eq('id', retryLogId)
        .eq('event_id', eventId)
        .maybeSingle();
      if (priorError || !prior) {
        return NextResponse.json({ error: 'Previous send log not found' }, { status: 404 });
      }
      retryEmails = new Set(
        (Array.isArray(prior.failed_emails) ? prior.failed_emails : [])
          .map((email: unknown) => String(email || '').trim().toLowerCase())
          .filter(Boolean),
      );
      retryDeliveredCount = Number(prior.recipient_count) || 0;
      const { data: priorLogs } = await supabase
        .from('event_participant_email_sends')
        .select('sent_emails')
        .eq('event_id', eventId);
      skipDelivered = new Set(
        (priorLogs || []).flatMap((row) =>
          (Array.isArray(row.sent_emails) ? row.sent_emails : []).map((email: unknown) =>
            String(email || '').trim().toLowerCase(),
          ),
        ).filter(Boolean),
      );
      if (!groupFilter && prior.group_filter) {
        groupFilter = String(prior.group_filter);
      }
      retrySubject = String(prior.subject || '').trim();
      retryBody = String(prior.message_body || '').trim();
    }

    const subject =
      retrySubject || String(body.subject || '').trim() || `You're invited: ${event.title}`;
    if (subject.length > 200) {
      return NextResponse.json({ error: 'Subject is too long (max 200 characters)' }, { status: 400 });
    }

    const messageBody =
      retryBody ||
      customBody ||
      draftParticipantInviteMessage({
        eventTitle: event.title,
        extraNotes,
        eventDate: event.event_date,
        location: event.location,
        qrPageUrl: `${appOriginFromRequest(request)}${participantMyQrPath(eventId)}`,
      });

    const posterPublicUrl = event.poster_url ? publicEventDocumentUrl(event.poster_url) : '';
    let posterAttachment: { filename: string; content: Buffer; contentType: string } | null = null;
    if (event.poster_url) {
      const { data: posterFile } = await supabase.storage.from('event-documents').download(event.poster_url);
      if (posterFile) {
        const content = Buffer.from(await posterFile.arrayBuffer());
        const filename = event.poster_url.split('/').pop() || 'event-poster.png';
        posterAttachment = {
          filename,
          content,
          contentType: posterMime(filename),
        };
      }
    }

    const previewTo = String(body.previewTo || '').trim().toLowerCase();
    if (previewTo) {
      if (!isValidParticipantEmail(previewTo)) {
        return NextResponse.json({ error: 'Enter a valid email to send the check' }, { status: 400 });
      }
      const qrJson = JSON.stringify(dummyCheckInPayload(eventId));
      const png = await QRCode.toBuffer(qrJson, { type: 'png', width: 280, margin: 1 });
      const qrPublicUrl = await uploadPublicPng(
        supabase,
        `participant-checkin-qr/${eventId}/preview.png`,
        png,
      );
      const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
      if (posterAttachment) attachments.push(posterAttachment);
      attachments.push({
        filename: 'check-in-qr-preview.png',
        content: png,
        contentType: 'image/png',
      });
      const emailHtml = buildEventParticipantEmail({
        event,
        subject,
        bodyHtml: `${plainTextToParticipantEmailHtml(messageBody, PREVIEW_PARTICIPANT_NAME)}<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">This is a check email. The QR is a dummy and will not mark attendance.</p>`,
        posterUrl: posterPublicUrl || undefined,
        checkInQrDataUrl: qrPublicUrl || `data:image/png;base64,${png.toString('base64')}`,
      });
      const result = viaOutlook
        ? await sendOutlookMail({
            userId: user.id,
            to: previewTo,
            subject,
            html: emailHtml,
            text: `${participantInvitePlainText(messageBody, PREVIEW_PARTICIPANT_NAME)}\n\nThis is a check email. The QR is a dummy and will not mark attendance.`,
            attachments,
          })
        : await sendEmail(previewTo, subject, emailHtml, {
            attachments,
            text: `${participantInvitePlainText(messageBody, PREVIEW_PARTICIPANT_NAME)}\n\nThis is a check email. The QR is a dummy and will not mark attendance.`,
          });
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to send check email' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        preview: true,
        sent: 1,
        message: `Check email sent to ${previewTo} with a dummy QR.`,
      });
    }

    const { data: participants, error: participantsError } = await supabase
      .from('event_participants')
      .select('id, participant_name, participant_email, participant_group, qr_data, created_at, form_data')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

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

    if (retryLogId && retryEmails.size === 0) {
      const remaining = remainingEmailsAfterSend({
        participants: rows,
        groupFilter,
        sentEmails: [...skipDelivered],
        deliveredCount: retryDeliveredCount,
      });
      retryEmails = new Set(remaining.emails);
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
      if (retryEmails.size > 0 && !retryEmails.has(resolved.email)) continue;
      if (skipDelivered.size > 0 && skipDelivered.has(resolved.email)) continue;
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

    let sent = 0;
    let failed = 0;
    const sentEmails: string[] = [];
    const failedEmails: string[] = [];
    const failReasons = new Set<string>();

    for (const recipient of recipients) {
      const bodyHtml = plainTextToParticipantEmailHtml(messageBody, recipient.name);
      const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
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
      const qrPublicUrl = await uploadPublicPng(
        supabase,
        `participant-checkin-qr/${eventId}/${recipient.id}.png`,
        png,
      );
      attachments.push({
        filename: `check-in-qr-${recipient.name.replace(/[^\w.-]+/g, '-').slice(0, 40)}.png`,
        content: png,
        contentType: 'image/png',
      });

      const emailHtml = buildEventParticipantEmail({
        event,
        subject,
        bodyHtml,
        posterUrl: posterPublicUrl || undefined,
        checkInQrDataUrl: qrPublicUrl || `data:image/png;base64,${png.toString('base64')}`,
      });
      const result = viaOutlook
        ? await sendOutlookMail({
            userId: user.id,
            to: recipient.email,
            subject,
            html: emailHtml,
            text: participantInvitePlainText(messageBody, recipient.name),
            attachments,
          })
        : await sendEmailWithRetry(recipient.email, subject, emailHtml, {
            attachments,
            text: participantInvitePlainText(messageBody, recipient.name),
          });
      if (result.success) {
        sent += 1;
        sentEmails.push(recipient.email);
      } else {
        failed += 1;
        failedEmails.push(recipient.email);
        if (result.error) failReasons.add(result.error);
      }
      if (recipients.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
    }

    let sendLog: {
      id: string;
      sent_at: string;
      subject: string;
      message_body: string;
      recipient_count: number;
      failed_count: number;
      group_filter: string | null;
      error_summary?: string | null;
      failed_emails?: string[] | null;
      sent_emails?: string[] | null;
    } | null = null;
    if (sent > 0 || failed > 0) {
      const errorSummary = [
        viaOutlook ? 'via Outlook' : '',
        ...failReasons,
      ]
        .filter(Boolean)
        .slice(0, 3)
        .join(' · ') || null;
      const { data: logRow, error: logError } = await supabase
        .from('event_participant_email_sends')
        .insert({
          event_id: eventId,
          sent_by: user.id,
          subject,
          message_body: messageBody,
          recipient_count: sent,
          failed_count: failed,
          group_filter: groupFilter && groupFilter !== 'all' ? groupFilter : null,
          error_summary: errorSummary,
          failed_emails: failedEmails,
          sent_emails: sentEmails,
        })
        .select(
          'id, sent_at, subject, message_body, recipient_count, failed_count, group_filter, error_summary, failed_emails, sent_emails',
        )
        .single();
      if (logError) {
        console.error('[send-participant-email] log', logError.message);
      } else {
        sendLog = logRow;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      skippedNoEmail,
      sentToCampusRoll,
      totalRecipients: recipients.length,
      totalParticipants: rows.length,
      log: sendLog,
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
