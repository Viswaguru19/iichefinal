import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    const responses: any = {
      'event': 'To propose an event, go to Dashboard → Propose Event. Fill in details and submit for approval.',
      'committee': 'You can view all committees at /committees. Each committee has specific roles and responsibilities.',
      'kickoff': 'Kickoff tournament registration is at /kickoff/register. You need 7-11 players and payment proof.',
      'help': 'I can help with: Events, Committees, Kickoff Tournament, Meetings, Finance. What do you need?',
      'meeting': 'Schedule meetings through Dashboard → Meetings. Add agenda and invite members.',
      'finance': 'Track expenses at Dashboard → Finance. Upload receipts for approval.',
    };

    const lowerMessage = message.toLowerCase();
    let reply = responses['help'];

    for (const [key, value] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) {
        reply = value;
        break;
      }
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
