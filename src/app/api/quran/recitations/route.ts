import { NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

// GET /api/quran/recitations
// Returns list of available reciters
export async function GET() {
  try {
    const res = await quranFetch('/resources/recitations');

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch recitations' }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ recitations: data.recitations || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
