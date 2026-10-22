import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  deleteOutlookConnection,
  getOutlookConnectionStatus,
  outlookEnvReady,
  OUTLOOK_REQUIRED_MAILBOX,
} from '@/lib/outlook-graph';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = await getOutlookConnectionStatus(user.id);
  return NextResponse.json({
    ...status,
    configured: outlookEnvReady(),
    requiredMailbox: OUTLOOK_REQUIRED_MAILBOX,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await deleteOutlookConnection(user.id);
  return NextResponse.json({ connected: false });
}
