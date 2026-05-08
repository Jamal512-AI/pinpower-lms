import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createAdminSupabaseClient();

    // 1. Create user using Admin API (bypasses email confirmation requirement)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automatically confirm email to avoid SMTP errors
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    if (!userData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // 2. Explicitly insert into users_extended
    // Sometimes triggers don't fire consistently with admin.createUser, so we do it manually.
    const { error: insertError } = await supabase.from('users_extended').upsert({
      id: userData.user.id,
      email: userData.user.email,
      role: 'student',
      access_status: 'pending'
    });

    if (insertError) {
      console.error('Failed to insert into users_extended:', insertError);
      // We don't fail the request here, but it's good to log
    }

    // 3. Notify admin via the existing notify-admin logic (optional, could also be called directly here)
    // For simplicity, we'll assume the client will still call /api/notify-admin or we can do it here.
    // Let's do it here to ensure it's atomic.
    
    // Direct call to notify-admin logic or just return success and let client handle it?
    // Let's just return success and have the client call notify-admin as it already does.
    
    return NextResponse.json({ success: true, userId: userData.user.id });
  } catch (error) {
    console.error('Signup API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
