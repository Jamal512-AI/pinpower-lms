import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { videoId, userEmail } = await req.json();
    if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });

    const apiSecret = process.env.VDOCIPHER_API_SECRET;
    if (!apiSecret) return NextResponse.json({ error: 'VdoCipher not configured' }, { status: 500 });

    // Build watermark payload
    const watermark = {
      type: 'text',
      text: userEmail || 'Pin Power Student',
      alpha: '0.50',
      color: '0xFFFFFF',
      size: '15',
      interval: '5000',
      x: '10',
      y: '10'
    };

    const response = await fetch(
      `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Apisecret ${apiSecret}`,
        },
        body: JSON.stringify({
          ttl: 300,
          annotate: JSON.stringify([watermark]),
          licenseRules: JSON.stringify({
            canPersist: false,
            rentDuration: 300,
            playbackDuration: 300,
            screenCaptureBlock: true // Tells the player to block recording if possible
          })
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VdoCipher error:', errorText);
      return NextResponse.json({ error: 'Failed to get OTP from VdoCipher' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ otp: data.otp, playbackInfo: data.playbackInfo });
  } catch (error) {
    console.error('VdoCipher OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
