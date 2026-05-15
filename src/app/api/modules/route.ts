import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Security check helper
async function checkAdmin() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase
      .from('users_extended')
      .select('role')
      .eq('id', user.id)
      .single();
    return profile?.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publishedOnly = searchParams.get('publishedOnly') === 'true';

    // Use server client so RLS is enforced — admins see all, students see published
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from('modules')
      .select('*')
      .order('sort_order', { ascending: true });

    if (publishedOnly) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET modules error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ modules: data || [] });
  } catch (err) {
    console.error('GET modules error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await checkAdmin()))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminSupabaseClient();
    const body = await req.json();
    const { title, description, sort_order, status, content } = body;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const { data, error } = await supabase
      .from('modules')
      .insert([
        {
          title,
          description: description || '',
          sort_order: sort_order ?? 0,
          status: status || 'draft',
          content: content || '',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('POST modules error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ module: data });
  } catch (err) {
    console.error('POST modules error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await checkAdmin()))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminSupabaseClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) {
      console.error('DELETE modules error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE modules error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await checkAdmin()))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminSupabaseClient();
    const body = await req.json();
    const { id, title, description, content, status, sort_order } = body;

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // ✅ Fixed: use Record<string, unknown> so numeric sort_order is accepted
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (content !== undefined) updateFields.content = content;
    if (status !== undefined) updateFields.status = status;
    if (sort_order !== undefined) updateFields.sort_order = sort_order; // ✅ was missing

    const { data, error } = await supabase
      .from('modules')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PATCH modules error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ module: data });
  } catch (err) {
    console.error('PATCH modules error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
