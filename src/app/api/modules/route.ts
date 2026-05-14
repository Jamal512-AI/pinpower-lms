import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// We store modules in Supabase (modules table) since Google Sheets API needs OAuth.
// This is the modules CRUD API.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publishedOnly = searchParams.get('publishedOnly') === 'true';

    const supabase = await createAdminSupabaseClient();
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
    const supabase = await createAdminSupabaseClient();
    const body = await req.json();
    const { title, description, sort_order, status, content } = body;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const { data, error } = await supabase
      .from('modules')
      .insert([{
        title,
        description: description || '',
        sort_order: sort_order || 0,
        status: status || 'draft',
        content: content || '',
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ module: data });
  } catch (err) {
    console.error('POST module error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createAdminSupabaseClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE module error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createAdminSupabaseClient();
    const body = await req.json();
    const { id, title, description, content, status } = body;

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const updateFields: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (content !== undefined) updateFields.content = content;
    if (status !== undefined) updateFields.status = status;

    const { data, error } = await supabase
      .from('modules')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ module: data });
  } catch (err) {
    console.error('PATCH module error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
