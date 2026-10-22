import { NextResponse } from 'next/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { participantCheckInPayload, participantMatchesLookup } from '@/lib/event-participant-qr';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventId = String(body.eventId || '').trim();
    const query = String(body.query || '').trim();
    if (!eventId || !query) {
      return NextResponse.json({ error: 'Enter your roll number or email' }, { status: 400 });
    }

    const supabase = tryCreateAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'QR lookup is not configured on the server' }, { status: 500 });
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, event_date, location')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: rows, error } = await supabase
      .from('event_participants')
      .select('id, participant_name, participant_email, qr_data, created_at, form_data')
      .eq('event_id', eventId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const matches = (rows || []).filter((row) => participantMatchesLookup(row, query));
    if (matches.length !== 1) {
      return NextResponse.json(
        { error: 'No unique check-in QR for that roll or email. Check the roster spelling.' },
        { status: 404 },
      );
    }

    const participant = matches[0];
    const payload = participantCheckInPayload(participant, eventId);
    const qrJson = JSON.stringify(payload);
    if (!participant.qr_data) {
      await supabase.from('event_participants').update({ qr_data: qrJson }).eq('id', participant.id);
    }

    return NextResponse.json({
      name: participant.participant_name || 'Participant',
      eventTitle: event.title,
      eventDate: event.event_date,
      location: event.location,
      qrJson,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load check-in QR' },
      { status: 500 },
    );
  }
}
