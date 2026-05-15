import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase-server';

// Security check helper
async function checkAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from('users_extended').select('role').eq('id', user.id).single();
  return profile?.role === 'admin';
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publishedOnly = searchParams.get('publishedOnly') === 'true';

    // MUST use standard server client here so Row Level Security (RLS) is applied safely.
    // This prevents malicious students from grabbing drafted modules.
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('modules').select('*').order('sort_order', { ascending: true });
    
    if (publishedOnly) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ modules: data || [] });
  } catch (err) {
    console.error('GET modules error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminSupabaseClient();
    const body = await req.json();
    const { title, description, sort_order, status, content } = body;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const { data, error } = await supabase
      .from('modules')
      .insert([{ title, description: description || '', sort_order: sort_order || 0, status: status || 'draft', content: content || '' }])
      .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ module: data });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminSupabaseClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminSupabaseClient();
    const body = await req.json();
    const { id, title, description, content, status } = body;

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const updateFields: Record<string, string> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (content !== undefined) updateFields.content = content;
    if (status !== undefined) updateFields.status = status;

    const { data, error } = await supabase.from('modules').update(updateFields).eq('id', id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ module: data });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
