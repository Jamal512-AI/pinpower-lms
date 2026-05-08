import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// GET — list all students (non-admin)
export async function GET() {
  try {
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

// PATCH — approve or reject a student
export async function PATCH(req: NextRequest) {
  try {
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
