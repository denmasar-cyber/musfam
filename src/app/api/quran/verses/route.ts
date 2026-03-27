import { NextRequest, NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

// alquran.cloud edition identifiers (English only)
const VALID_EDITIONS = new Set([
  'en.pickthall',
  'en.abdulhaleem',
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapter = searchParams.get('chapter');
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('per_page') || '300';
  // Accept either `edition` (preferred) or legacy `language` param
  const editionParam = searchParams.get('edition');
  const languageParam = searchParams.get('language') || 'en';
  const edition = editionParam && VALID_EDITIONS.has(editionParam)
    ? editionParam
    : 'en.pickthall';

  try {
    // Fetch tajweed HTML, uthmani plain text, and translation in parallel
    const [tajweedRes, uthmaniRes, translationRes, versesRes] = await Promise.all([
      quranFetch(`/quran/verses/uthmani_tajweed?chapter_number=${chapter}`),
      quranFetch(`/quran/verses/uthmani?chapter_number=${chapter}`),
      // alquran.cloud: free, no auth needed, returns full surah translations
      fetch(`https://api.alquran.cloud/v1/surah/${chapter}/${edition}`, { next: { revalidate: 86400 } }),
      // Quran Foundation for verse metadata (juz, page, hizb, etc.)
      quranFetch(
        `/verses/by_chapter/${chapter}?language=en&words=false&page=${page}&per_page=${perPage}&fields=verse_key,verse_number,juz_number,hizb_number,rub_el_hizb_number,page_number`
      ),
    ]);

    if (!versesRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch verses' }, { status: 502 });
    }

    const versesData = await versesRes.json();
    const tajweedData = tajweedRes.ok ? await tajweedRes.json() : { verses: [] };
    const uthmaniData = uthmaniRes.ok ? await uthmaniRes.json() : { verses: [] };
    const translationData = translationRes.ok ? await translationRes.json() : { data: null };

    const tajweedMap = new Map<string, string>();
    for (const v of tajweedData.verses || []) {
      tajweedMap.set(v.verse_key, v.text_uthmani_tajweed);
    }

    const uthmaniMap = new Map<string, string>();
    for (const v of uthmaniData.verses || []) {
      uthmaniMap.set(v.verse_key, v.text_uthmani);
    }

    // alquran.cloud returns ayahs indexed by numberInSurah (1-based)
    const translationMap = new Map<number, string>();
    for (const ayah of translationData.data?.ayahs || []) {
      translationMap.set(ayah.numberInSurah as number, (ayah.text as string) || '');
    }

    const verses = (versesData.verses || []).map((v: Record<string, unknown>) => {
      const vk = v.verse_key as string;
      const verseNum = v.verse_number as number;
      return {
        id: v.id,
        verse_key: vk,
        verse_number: verseNum,
        text_uthmani: uthmaniMap.get(vk) || '',
        text_uthmani_tajweed: tajweedMap.get(vk) || '',
        juz_number: v.juz_number,
        hizb_number: v.hizb_number,
        page_number: v.page_number,
        translation: translationMap.get(verseNum) || '',
      };
    });

    return NextResponse.json({
      verses,
      pagination: versesData.pagination,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
