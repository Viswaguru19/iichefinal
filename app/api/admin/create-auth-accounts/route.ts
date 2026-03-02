import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile as any).role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .neq('email', 'vishwaguru1819@gmail.com');

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ error: 'No profiles found' }, { status: 404 });
    }

    const results = [];

    for (const p of profiles) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          },
          body: JSON.stringify({
            email: p.email,
            password: 'iichelogin',
            email_confirm: true,
            user_metadata: { name: p.name }
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          results.push(`✅ ${p.name}: Auth account created`);
        } else if (data.msg?.includes('already registered')) {
          results.push(`⚠️ ${p.name}: Already has auth account`);
        } else {
          results.push(`❌ ${p.name}: ${data.msg || 'Failed'}`);
        }
      } catch (e: any) {
        results.push(`❌ ${p.name}: ${e.message}`);
      }
    }

    return NextResponse.json({ 
      message: results.join('\n'),
      success: true 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
