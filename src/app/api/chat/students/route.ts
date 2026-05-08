import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// Returns list of all unique students who have sent at least one chat message,
// along with their latest message and unread count for the admin sidebar.
export async function GET() {
  try {
    const supabase = await createAdminSupabaseClient();

    // Get all messages, ordered by created_at desc
    const { data, error } = await supabase
      .from('chat_messages')
      .select('student_id, student_email, message, sender_type, is_read, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group by student_id — pick latest message and unread count
    const studentMap: Record<string, {
      student_id: string;
      student_email: string;
      last_message: string;
      last_sender: string;
      last_time: string;
      unread_count: number;
    }> = {};

    for (const msg of data || []) {
      if (!studentMap[msg.student_id]) {
        studentMap[msg.student_id] = {
          student_id: msg.student_id,
          student_email: msg.student_email,
          last_message: msg.message,
          last_sender: msg.sender_type,
          last_time: msg.created_at,
          unread_count: 0,
        };
      }
      // Count unread student messages (admin hasn't read them)
      if (msg.sender_type === 'student' && !msg.is_read) {
        studentMap[msg.student_id].unread_count++;
      }
    }

    const students = Object.values(studentMap).sort(
      (a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    );

    return NextResponse.json({ students });
  } catch (err) {
    console.error('GET chat students error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
