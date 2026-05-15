import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase-server';

async function checkAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from('users_extended').select('role').eq('id', user.id).single();
  return profile?.role === 'admin';
}

export async function GET() {
  try {
    if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminSupabaseClient();
    const { data: students, error } = await supabase
      .from('users_extended')
      .select('id, email, role, access_status, created_at')
      .eq('role', 'student')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ students });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { studentId, action } = await req.json();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const supabase = await createAdminSupabaseClient();
    const { error } = await supabase
      .from('users_extended')
      .update({ access_status: newStatus })
      .eq('id', studentId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
