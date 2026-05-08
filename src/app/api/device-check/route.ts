import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { userId, fingerprint } = await req.json();
    if (!userId || !fingerprint) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const supabase = await createAdminSupabaseClient();

    // Get existing devices for this user
    const { data: devices, error } = await supabase
      .from('user_devices')
      .select('device_fingerprint')
      .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const fingerprints = devices?.map((d) => d.device_fingerprint) ?? [];

    // Already registered — update last_login
    if (fingerprints.includes(fingerprint)) {
      await supabase
        .from('user_devices')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('device_fingerprint', fingerprint);
      return NextResponse.json({ blocked: false });
    }

    // Get user role to check if they are an admin
    const { data: userProfile } = await supabase
      .from('users_extended')
      .select('role')
      .eq('id', userId)
      .single();

    // New device — check limit (max 2) for students
    if (userProfile?.role !== 'admin' && fingerprints.length >= 2) {
      return NextResponse.json({ blocked: true });
    }

    // Register new device
    await supabase.from('user_devices').insert({
      user_id: userId,
      device_fingerprint: fingerprint,
      last_login: new Date().toISOString(),
    });

    return NextResponse.json({ blocked: false });
  } catch (error) {
    console.error('Device check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
