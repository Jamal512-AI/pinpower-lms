import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    await resend.emails.send({
      from: 'Pin Power LMS <onboarding@resend.dev>',
      to: [process.env.ADMIN_NOTIFICATION_EMAIL!],
      subject: '🔔 New Pin Power Student Signup',
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
          <div style="background: #1D4B73; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #FF2A55; margin: 0; font-size: 24px; font-weight: 900;">PIN POWER</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">Digital Dynasty LMS</p>
          </div>
          <h2 style="color: #0f172a; font-size: 18px; margin-bottom: 8px;">New Student Registration</h2>
          <p style="color: #475569; margin-bottom: 16px;">A new student has signed up and is waiting for approval:</p>
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
            <strong style="color: #0f172a; font-size: 16px;">${email}</strong>
          </div>
          <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">
            Please log in to your Admin Dashboard to approve or reject this student's access.
          </p>
          <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'supabase.co')}" 
             style="display: inline-block; background: #FF2A55; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Go to Admin Dashboard →
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Pin Power LMS • Digital Dynasty</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notify admin error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
