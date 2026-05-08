import { NextRequest, NextResponse } from 'next/server';

// Bunny Stream video upload
// Env vars needed:
//   BUNNY_STREAM_LIBRARY_ID   - your Bunny Stream library numeric ID
//   BUNNY_STREAM_API_KEY      - your Bunny Stream API key

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || 'Untitled Video';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;

    if (!libraryId || !apiKey) {
      return NextResponse.json(
        { error: 'Bunny Stream not configured. Add BUNNY_STREAM_LIBRARY_ID and BUNNY_STREAM_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    // Step 1: Create video record in Bunny Stream
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: 'POST',
        headers: {
          AccessKey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      }
    );

    if (!createRes.ok) {
      const text = await createRes.text();
      return NextResponse.json({ error: `Failed to create Bunny video: ${text}` }, { status: 500 });
    }

    const videoRecord = await createRes.json();
    const videoId: string = videoRecord.guid;

    // Step 2: Upload the actual video file
    const arrayBuffer = await file.arrayBuffer();
    const uploadRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      {
        method: 'PUT',
        headers: {
          AccessKey: apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: arrayBuffer,
      }
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      return NextResponse.json({ error: `Video upload failed: ${text}` }, { status: 500 });
    }

    // Bunny Stream embed URL
    const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;

    return NextResponse.json({ videoId, embedUrl });
  } catch (err) {
    console.error('Bunny video upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Increase body size limit for video uploads
export const config = {
  api: { bodyParser: false },
};
