import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
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

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { userId, email, name } = await request.json();

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user already exists in auth
    const { data: existingUser, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
    
    if (existingUser && existingUser.user) {
      return NextResponse.json({ 
        success: false,
        error: 'User already has auth account'
      }, { status: 400 });
    }

    // Also check by email
    const { data: userByEmail } = await adminClient.auth.admin.listUsers();
    const emailExists = userByEmail.users.find(u => u.email === email);
    
    if (emailExists) {
      return NextResponse.json({ 
        success: false,
        error: 'Email already has auth account'
      }, { status: 400 });
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: 'iichelogin',
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { name }
    });

    if (authError) {
      return NextResponse.json({ 
        success: false,
        error: authError.message
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Auth account created' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
