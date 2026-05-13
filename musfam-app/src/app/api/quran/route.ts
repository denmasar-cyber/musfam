import { NextRequest, NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapter = searchParams.get('chapter');
  const verse = searchParams.get('verse');

  if (!chapter || !verse) {
    return NextResponse.json({ error: 'Missing chapter or verse parameter' }, { status: 400 });
  }

  try {
    const [arabicRes, translationRes] = await Promise.all([
      quranFetch(`/quran/verses/uthmani?verse_key=${chapter}:${verse}`),
      quranFetch(`/quran/translations/131?verse_key=${chapter}:${verse}`), // 131: Sahih International (English)
    ]);

    if (!arabicRes.ok || !translationRes.ok) {
      // Fallback to 20 (Pickthall) if 131 fails
      const t2Res = await quranFetch(`/quran/translations/20?verse_key=${chapter}:${verse}`);
      if (!t2Res.ok) return NextResponse.json({ error: 'Failed to fetch verse' }, { status: 502 });
      const [arabicData, tData] = await Promise.all([arabicRes.json(), t2Res.json()]);
      return NextResponse.json({
        verse_key: `${chapter}:${verse}`,
        text_uthmani: arabicData.verses?.[0]?.text_uthmani || '',
        translation: (tData.translations?.[0]?.text || '').replace(/<[^>]*>/g, ''),
      });
    }

    const arabicData = await arabicRes.json();
    const translationData = await translationRes.json();

    return NextResponse.json({
      verse_key: `${chapter}:${verse}`,
      text_uthmani: arabicData.verses?.[0]?.text_uthmani || '',
      translation: (translationData.translations?.[0]?.text || '').replace(/<[^>]*>/g, ''),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
