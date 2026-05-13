import { NextRequest, NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const verseKey = searchParams.get('verse_key');
  // tafseer_id: 169 = Ibn Kathir (English), 164 = Tafsir Al-Mukhtashar
  const tafsirId = searchParams.get('tafsir_id') || '169';

  if (!verseKey) {
    return NextResponse.json({ error: 'Missing verse_key parameter' }, { status: 400 });
  }

  try {
    const res = await quranFetch(`/tafsirs/${tafsirId}/by_ayah/${verseKey}`);

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch tafseer' }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({
      verse_key: verseKey,
      tafsir_id: tafsirId,
      text: (data.tafsir?.text || '').replace(/<[^>]*>/g, ''),
      resource_name: data.tafsir?.resource_name || '',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
