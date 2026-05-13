import { NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

export async function GET() {
  try {
    const res = await quranFetch('/chapters?language=en');
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
