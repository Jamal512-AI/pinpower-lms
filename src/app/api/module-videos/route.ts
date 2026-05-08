import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// Videos for a specific module — stored in Supabase module_videos table.
// Video source: Google Drive link (user provides the embed URL)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get('moduleId');

    const supabase = await createAdminSupabaseClient();
    let query = supabase.from('module_videos').select('*').order('sort_order', { ascending: true });
    if (moduleId) query = query.eq('module_id', moduleId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ videos: data || [] });
  } catch (err) {
    console.error('GET videos error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminSupabaseClient();
    const body = await req.json();
    const { module_id, title, drive_email, video_url, sort_order } = body;

    if (!module_id || !title || !video_url) {
      return NextResponse.json({ error: 'module_id, title, and video_url are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('module_videos')
      .insert([{ module_id, title, drive_email: drive_email || '', video_url, sort_order: sort_order || 0 }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ video: data });
  } catch (err) {
    console.error('POST video error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createAdminSupabaseClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { error } = await supabase.from('module_videos').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE video error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
