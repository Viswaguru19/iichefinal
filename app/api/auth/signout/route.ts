import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DEMO_FLAG_COOKIE } from '@/lib/demo';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  try {
    const jar = await cookies();
    jar.set(DEMO_FLAG_COOKIE, '', { path: '/', maxAge: 0 });
  } catch {
    /* ignore */
  }
  redirect('/login');
}
