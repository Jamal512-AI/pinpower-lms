import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-server';

/**
 * POST /api/upload-image
 * Accepts multipart form-data with a 'file' field.
 * Uploads to Supabase Storage bucket 'module-images' and returns the public URL.
 *
 * DELETE /api/upload-image
 * Accepts JSON body with { filename } and permanently deletes from Supabase storage.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getAdminSupabaseClient();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    // Limit size to 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10 MB.' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Convert to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('module-images')
      .upload(filename, buffer, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('module-images')
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (err: unknown) {
    console.error('Image upload error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/upload-image
 * Body: { filename: string }
 * Permanently removes the file from the 'module-images' Supabase Storage bucket.
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getAdminSupabaseClient();

    let body: { filename?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { filename } = body;
    if (!filename) {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    }

    // Sanitize — only allow simple filenames, no path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const { error } = await supabase.storage
      .from('module-images')
      .remove([filename]);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: filename });
  } catch (err: unknown) {
    console.error('Image delete error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const maxDuration = 30;
