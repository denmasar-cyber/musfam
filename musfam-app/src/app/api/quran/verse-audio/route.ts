import { NextRequest, NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

// GET /api/quran/verse-audio?verse_key=2:255&reciter=7
// Uses Quran Foundation Audio API:
//   GET /recitations/{recitation_id}/by_ayah/{ayah_key}
// Returns a direct audio segment URL for a single verse.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const verseKey = searchParams.get('verse_key'); // e.g. "2:255"
  const reciterId = searchParams.get('reciter') || '7'; // 7 = Mishary Rashid Alafasy

  if (!verseKey) {
    return NextResponse.json({ error: 'Missing verse_key parameter' }, { status: 400 });
  }

  const FALLBACK_RECITERS = ['7', '9', '10', '1'];
  const tryOrder = [reciterId, ...FALLBACK_RECITERS.filter(r => r !== reciterId)];

  for (const rid of tryOrder) {
    try {
      // Quran Foundation API: direct ayah fetch to avoid chapter pagination issues
      const res = await quranFetch(`/recitations/${rid}/by_ayah/${verseKey}`);
      if (!res.ok) continue;

      const data = await res.json();
      const match = data.audio_files?.[0]; // Usually first and only match

      if (match?.url) {
        // Quran Foundation CDN base
        const url = match.url.startsWith('http')
          ? match.url
          : `https://verses.quran.com/${match.url}`;
        return NextResponse.json({
          verse_key: verseKey,
          audio_url: url,
          recitation_id: rid,
        });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: 'No audio available for this verse' }, { status: 404 });
}
