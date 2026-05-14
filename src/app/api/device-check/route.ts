import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Lazy-initialize inside handler so env vars are available at runtime
  const supabase = getAdminSupabaseClient();
  try {
    const { userId, fingerprint } = await req.json();
    if (!userId || !fingerprint) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    // ─── Fetch devices + user profile in PARALLEL (2 queries → 1 round-trip) ──
    const [devicesResult, profileResult] = await Promise.all([
      supabase
        .from('user_devices')
        .select('device_fingerprint')
        .eq('user_id', userId),
      supabase
        .from('users_extended')
        .select('role')
        .eq('id', userId)
        .single(),
    ]);

    if (devicesResult.error) {
      return NextResponse.json({ error: devicesResult.error.message }, { status: 500 });
    }

    const fingerprints = devicesResult.data?.map((d) => d.device_fingerprint) ?? [];
    const role = profileResult.data?.role;

    // Already registered on this device — just update last_login (fire-and-forget)
    if (fingerprints.includes(fingerprint)) {
      supabase
        .from('user_devices')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('device_fingerprint', fingerprint)
        .then(() => {}); // non-blocking
      return NextResponse.json({ blocked: false });
    }

    // New device — enforce 2-device limit for students only
    if (role !== 'admin' && fingerprints.length >= 2) {
      return NextResponse.json({ blocked: true });
    }

    // Register the new device (fire-and-forget for speed)
    supabase
      .from('user_devices')
      .insert({
        user_id: userId,
        device_fingerprint: fingerprint,
        last_login: new Date().toISOString(),
      })
      .then(() => {}); // non-blocking

    return NextResponse.json({ blocked: false });
  } catch (error) {
    console.error('Device check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
