import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/notifications';

export async function POST(request: Request) {
  const { committeeId, taskTitle, taskDescription, proposalId } = await request.json();
  const supabase = await createClient();

  const { data: members } = await (supabase as any)
    .from('committee_members')
    .select('user_id, profiles(name, email)')
    .eq('committee_id', committeeId);

  const { data: proposal } = await (supabase as any)
    .from('event_proposals')
    .select('title')
    .eq('id', proposalId)
    .single();

  if (members) {
    for (const member of members) {
      await sendEmail(
        member.profiles.email,
        `New Task Assigned: ${taskTitle}`,
        `<h2>Hello ${member.profiles.name},</h2>
        <p>A new task has been assigned to your committee for the event <strong>${proposal?.title}</strong>.</p>
        <h3>${taskTitle}</h3>
        <p>${taskDescription || 'No description provided.'}</p>
        <p><a href="${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '') || 'http://localhost:3000'}/dashboard/tasks">View Tasks</a></p>`
      );
    }
  }

  return NextResponse.json({ success: true });
}
