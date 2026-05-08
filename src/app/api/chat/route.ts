import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// GET: Fetch all messages for a student
// POST: Send a message (student or admin)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 });

    const supabase = await createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data || [] });
  } catch (err) {
    console.error('GET chat error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, studentEmail, message, senderType } = body;

    if (!studentId || !studentEmail || !message || !senderType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        student_id: studentId,
        student_email: studentEmail,
        message: message.trim(),
        sender_type: senderType, // 'student' | 'admin'
        is_read: false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: data });
  } catch (err) {
    console.error('POST chat error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { studentId } = await req.json();
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 });

    const supabase = await createAdminSupabaseClient();
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('student_id', studentId)
      .eq('sender_type', 'student')
      .eq('is_read', false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PUT chat error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
