import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/supabase-server';

/**
 * POST /api/upload-image
 * Accepts multipart form-data with a 'file' field.
 * Uploads to Supabase Storage bucket 'module-images' and returns the public URL.
 */
export async function POST(req: NextRequest) {
  try {
    // Lazily grab the singleton — avoids issues if env vars aren't ready at
    // module-evaluation time on some platforms (Vercel edge bundling).
    const supabase = getAdminSupabaseClient();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type (images only)
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

    // Convert Web File to Buffer for reliable Node.js Supabase upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage (bucket: module-images)
    const { error: uploadError } = await supabase.storage
      .from('module-images')
      .upload(filename, buffer, {
        cacheControl: '31536000',      // 1 year cache
        upsert: false,
        contentType: file.type || 'image/jpeg',
        duplex: 'half',                // required for streaming in some runtimes
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


export const maxDuration = 30;  // seconds
