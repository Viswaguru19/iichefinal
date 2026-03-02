import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/notifications';

export async function POST(request: Request) {
  const { invitees, meetingData } = await request.json();
  const supabase = await createClient();

  const { data: users } = await (supabase as any)
    .from('profiles')
    .select('name, email')
    .in('id', invitees);

  const meetingDate = new Date(meetingData.meeting_date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (users) {
    for (const user of users) {
      const meetingDetails = meetingData.meeting_type === 'online'
        ? `<p><strong>Join Link:</strong> <a href="${meetingData.meeting_link}">${meetingData.meeting_link}</a></p>`
        : `<p><strong>Location:</strong> ${meetingData.location}</p>`;

      await sendEmail(
        user.email,
        `Meeting Invitation: ${meetingData.title}`,
        `<h2>Hello ${user.name},</h2>
        <p>You have been invited to a meeting.</p>
        <h3>${meetingData.title}</h3>
        <p>${meetingData.description || ''}</p>
        <p><strong>Date & Time:</strong> ${meetingDate}</p>
        ${meetingDetails}
        <p><a href="${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '') || 'http://localhost:3000'}/dashboard/meetings">View Meetings</a></p>`
      );
    }
  }

  return NextResponse.json({ success: true });
}
