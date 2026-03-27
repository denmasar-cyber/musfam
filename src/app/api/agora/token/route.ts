import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// GET /api/agora/token?channel=<channelName>&uid=<uid>
// Generates a Zoom Video SDK JWT signature for joining a session.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get('channel') || 'musfam-family';
  const uid = searchParams.get('uid') || '0';

  const sdkKey = process.env.ZOOM_VIDEO_SDK_KEY;
  const sdkSecret = process.env.ZOOM_VIDEO_SDK_SECRET;

  if (!sdkKey || !sdkSecret || sdkSecret === 'ADD_YOUR_ZOOM_SDK_SECRET_HERE') {
    return NextResponse.json({ token: null, sdkKey: null, channel, uid });
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2 hours

  const payload = {
    app_key: sdkKey,
    tpc: channel,      // session topic / channel name
    role_type: 1,      // 1 = participant, 2 = host
    user_identity: uid,
    version: 1,
    iat,
    exp,
  };

  const token = jwt.sign(payload, sdkSecret);
  return NextResponse.json({ token, sdkKey, channel, uid });
}
