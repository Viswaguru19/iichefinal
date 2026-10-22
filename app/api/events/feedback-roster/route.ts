import { NextResponse } from 'next/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import {
  EVENT_FEEDBACK_FORM_TYPE,
  FEEDBACK_PARTICIPANT_META_KEY,
  matchRosterFeedback,
  rosterRollDisplay,
} from '@/lib/event-feedback-form';

export async function GET(request: Request) {
  try {
    const formId = new URL(request.url).searchParams.get('formId')?.trim() || '';
    if (!formId) {
      return NextResponse.json({ error: 'Missing form' }, { status: 400 });
    }

    const supabase = tryCreateAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Roster lookup is not configured' }, { status: 500 });
    }

    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('id, event_id, form_type, fields')
      .eq('id', formId)
      .maybeSingle();
    if (formError || !form || form.form_type !== EVENT_FEEDBACK_FORM_TYPE || !form.event_id) {
      return NextResponse.json({ error: 'Not an event feedback form' }, { status: 404 });
    }

    const [{ data: participants, error: partError }, { data: responses, error: respError }] = await Promise.all([
      supabase
        .from('event_participants')
        .select('id, participant_name, participant_email, form_data')
        .eq('event_id', form.event_id)
        .order('participant_name', { ascending: true }),
      supabase.from('form_responses').select('responses').eq('form_id', formId),
    ]);
    if (partError) return NextResponse.json({ error: partError.message }, { status: 500 });
    if (respError) return NextResponse.json({ error: respError.message }, { status: 500 });

    const fields = Array.isArray(form.fields) ? form.fields : [];
    const roster = matchRosterFeedback(participants || [], responses || [], fields);
    const submittedIds = new Set(roster.given.map((p) => p.id));

    return NextResponse.json({
      people: (participants || []).map((p) => ({
        id: p.id,
        name: String(p.participant_name || 'Participant').trim() || 'Participant',
        roll: rosterRollDisplay(p),
        submitted: submittedIds.has(p.id),
      })),
      metaKey: FEEDBACK_PARTICIPANT_META_KEY,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load participants' },
      { status: 500 },
    );
  }
}
