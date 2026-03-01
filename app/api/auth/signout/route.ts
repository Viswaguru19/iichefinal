import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
