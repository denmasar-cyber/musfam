import { NextRequest, NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const juzNumber = searchParams.get('juz');

  if (!juzNumber) {
    return NextResponse.json({ error: 'Missing juz parameter' }, { status: 400 });
  }

  try {
    const [versesRes, tajweedRes, uthmaniRes] = await Promise.all([
      quranFetch(`/verses/by_juz/${juzNumber}?language=en&words=false&per_page=300&fields=verse_key,verse_number,chapter_id,juz_number,page_number`),
      quranFetch(`/quran/verses/uthmani_tajweed?juz_number=${juzNumber}`),
      quranFetch(`/quran/verses/uthmani?juz_number=${juzNumber}`),
    ]);

    if (!versesRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch juz' }, { status: 502 });
    }

    const versesData = await versesRes.json();
    const tajweedData = tajweedRes.ok ? await tajweedRes.json() : { verses: [] };
    const uthmaniData = uthmaniRes.ok ? await uthmaniRes.json() : { verses: [] };

    const tajweedMap = new Map<string, string>();
    for (const v of tajweedData.verses || []) {
      tajweedMap.set(v.verse_key, v.text_uthmani_tajweed);
    }
    const uthmaniMap = new Map<string, string>();
    for (const v of uthmaniData.verses || []) {
      uthmaniMap.set(v.verse_key, v.text_uthmani);
    }

    // Identify unique chapter IDs in this juz, fetch translations from alquran.cloud
    const rawVerses = versesData.verses || [];
    const chapterIds = [...new Set(rawVerses.map((v: Record<string, unknown>) => v.chapter_id as number))];

    // Build verse_key → translation map via alquran.cloud per chapter
    const translationMap = new Map<string, string>();
    await Promise.all(
      chapterIds.map(async (chId) => {
        try {
          const res = await fetch(`https://api.alquran.cloud/v1/surah/${chId}/en.sahih`, {
            next: { revalidate: 86400 },
          });
          if (!res.ok) return;
          const data = await res.json();
          for (const ayah of data.data?.ayahs || []) {
            translationMap.set(`${chId}:${ayah.numberInSurah}`, ayah.text || '');
          }
        } catch { /* skip */ }
      })
    );

    const verses = rawVerses.map((v: Record<string, unknown>) => {
      const vk = v.verse_key as string;
      const uthmani = uthmaniMap.get(vk) || '';
      return {
        id: v.id,
        verse_key: vk,
        verse_number: v.verse_number,
        chapter_id: v.chapter_id,
        text_uthmani: uthmani,
        text_uthmani_tajweed: tajweedMap.get(vk) || uthmani,
        juz_number: v.juz_number,
        page_number: v.page_number,
        translation: translationMap.get(vk) || '',
      };
    });

    return NextResponse.json({ verses, pagination: versesData.pagination });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
