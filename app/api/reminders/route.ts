import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { proposalId, targetUserId, reminderType, message } = await request.json();

  const { error: reminderError } = await (supabase as any)
    .from('reminders')
    .insert({
      proposal_id: proposalId,
      sent_by: user.id,
      sent_to: targetUserId,
      reminder_type: reminderType,
      message
    });

  if (reminderError) {
    return NextResponse.json({ error: reminderError.message }, { status: 500 });
  }

  const { error: notifError } = await (supabase as any)
    .from('notifications')
    .insert({
      user_id: targetUserId,
      title: 'Reminder',
      message: message || 'You have a pending approval',
      type: 'reminder',
      related_id: proposalId
    });

  if (notifError) {
    return NextResponse.json({ error: notifError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
