import { NextRequest, NextResponse } from 'next/server';

// Bunny.net Storage image upload
// Env vars needed:
//   BUNNY_STORAGE_ZONE       - storage zone name (e.g. "pinpower")
//   BUNNY_STORAGE_API_KEY    - password for the storage zone
//   BUNNY_CDN_HOSTNAME       - CDN pull zone URL (e.g. "https://pinpower.b-cdn.net")

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const zone = process.env.BUNNY_STORAGE_ZONE;
    const apiKey = process.env.BUNNY_STORAGE_API_KEY;
    const cdnHost = process.env.BUNNY_CDN_HOSTNAME;

    if (!zone || !apiKey || !cdnHost) {
      return NextResponse.json(
        { error: 'Bunny.net storage not configured. Add BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_CDN_HOSTNAME to .env.local' },
        { status: 500 }
      );
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `module-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Upload to Bunny Storage
    const arrayBuffer = await file.arrayBuffer();
    const uploadRes = await fetch(
      `https://storage.bunnycdn.com/${zone}/${filename}`,
      {
        method: 'PUT',
        headers: {
          AccessKey: apiKey,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: arrayBuffer,
      }
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      return NextResponse.json({ error: `Bunny upload failed: ${text}` }, { status: 500 });
    }

    const url = `${cdnHost}/${filename}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error('Bunny image upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
