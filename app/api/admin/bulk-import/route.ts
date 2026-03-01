import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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

  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { csvData } = await request.json();
    
    const { data: committees } = await supabase
      .from('committees')
      .select('*');

    let success = 0;
    let failed = 0;

    for (const line of csvData) {
      if (!line.trim()) continue;
      
      const [name, email, username, executiveRole, committeeNames, position] = line.split(',').map((s: string) => s.trim());
      
      try {
        // Create auth user
        const authResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          },
          body: JSON.stringify({
            email,
            password: 'iichelogin',
            email_confirm: true,
            user_metadata: { name }
          })
        });

        const authData = await authResponse.json();
        
        if (!authResponse.ok) {
          throw new Error(authData.msg || 'Auth creation failed');
        }

        // Determine role
        let role = 'student';
        if (executiveRole) role = 'secretary';
        else if (position === 'head') role = 'committee_head';
        else if (position === 'co_head') role = 'committee_cohead';

        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.id,
            name,
            email,
            username: username || null,
            role,
            executive_role: executiveRole || null,
            approved: true,
          });

        if (profileError) throw profileError;

        // Add to committees
        if (committeeNames && committees) {
          const committeeList = committeeNames.split(';');
          for (const committeeName of committeeList) {
            const committee = committees.find((c: any) => c.name.toLowerCase().includes(committeeName.toLowerCase()));
            if (committee) {
              await supabase
                .from('committee_members')
                .insert({
                  user_id: authData.id,
                  committee_id: committee.id,
                  position: position || 'member',
                });
            }
          }
        }

        success++;
      } catch (error: any) {
        console.error(`Failed to import ${email}:`, error);
        failed++;
      }
    }

    return NextResponse.json({ success, failed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
