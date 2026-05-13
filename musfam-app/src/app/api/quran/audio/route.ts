import { NextRequest, NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

// GET /api/quran/audio?chapter=1&reciter=7
//
// Quran Foundation API audio endpoints:
//   /chapter_recitations/{recitation_id}/{chapter_id}
//   → returns { audio_file: { audio_url, verse_timings: [{verse_key, timestamp_from, timestamp_to, segments}] } }
//
// Recitation IDs for chapter audio (chapter_recitations endpoint):
//   7  = Mishari Rashid al-Afasy
//   9  = Abdul Basit Mujawwad
//   10 = Abdul Basit Murattal
//   1  = Abdul Rahman Al-Sudais

const FALLBACK_RECITERS = ['7', '9', '10', '1'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapter = searchParams.get('chapter');
  const reciterId = searchParams.get('reciter') || '7';

  if (!chapter) {
    return NextResponse.json({ error: 'Missing chapter parameter' }, { status: 400 });
  }

  // Try requested reciter first, then fallbacks
  const tryOrder = [reciterId, ...FALLBACK_RECITERS.filter(r => r !== reciterId)];

  for (const rid of tryOrder) {
    try {
      const res = await quranFetch(`/chapter_recitations/${rid}/${chapter}`);
      if (!res.ok) continue;

      const data = await res.json();
      const audioFile = data.audio_file;
      if (!audioFile?.audio_url) continue;

      // verse_timings: [{ verse_key, timestamp_from, timestamp_to, segments }]
      // segments inside each verse_timing: [[word_index, start_ms, end_ms], ...]
      return NextResponse.json({
        audio_url: audioFile.audio_url,
        recitation_id: rid,
        chapter_id: chapter,
        verse_timings: audioFile.verse_timings || [],
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: 'No audio available for this chapter' }, { status: 404 });
}
