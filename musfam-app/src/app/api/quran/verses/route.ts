import { NextRequest, NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapter = searchParams.get('chapter');
  const verseKey = searchParams.get('verse_key');
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('per_page') || '300';
  
  if (!chapter && !verseKey) {
    return NextResponse.json({ error: 'Missing chapter or verse_key parameter' }, { status: 400 });
  }

  // Determine key to fetch (either from verseKey directly or start of chapter)
  const targetChapter = chapter || verseKey?.split(':')[0];
  const qfUrl = verseKey 
    ? `/verses/by_key/${verseKey}?language=en&words=false&translations=131,20&fields=verse_key,verse_number,juz_number,page_number`
    : `/verses/by_chapter/${targetChapter}?language=en&words=false&translations=131,20&page=${page}&per_page=${perPage}&fields=verse_key,verse_number,juz_number,page_number`;

  try {
    const [tajweedRes, uthmaniRes, versesRes] = await Promise.all([
      quranFetch(verseKey ? `/quran/verses/uthmani_tajweed?verse_key=${verseKey}` : `/quran/verses/uthmani_tajweed?chapter_number=${targetChapter}`),
      quranFetch(verseKey ? `/quran/verses/uthmani?verse_key=${verseKey}` : `/quran/verses/uthmani?chapter_number=${targetChapter}`),
      quranFetch(qfUrl),
    ]);

  if (!versesRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch verses from Foundation' }, { status: 502 });
  }

  const versesData = await versesRes.json();
  const [tajweedData, uthmaniData] = await Promise.all([
    tajweedRes.ok ? await tajweedRes.json() : { verses: [], verse: null },
    uthmaniRes.ok ? await uthmaniRes.json() : { verses: [], verse: null },
  ]);

  const tajweedMap = new Map<string, string>();
  if (tajweedData.verse) tajweedMap.set(tajweedData.verse.verse_key, tajweedData.verse.text_uthmani_tajweed);
  for (const v of tajweedData.verses || []) tajweedMap.set(v.verse_key, v.text_uthmani_tajweed);

  const uthmaniMap = new Map<string, string>();
  if (uthmaniData.verse) uthmaniMap.set(uthmaniData.verse.verse_key, uthmaniData.verse.text_uthmani);
  for (const v of uthmaniData.verses || []) uthmaniMap.set(v.verse_key, v.text_uthmani);

  const rawList = verseKey ? [versesData.verse] : (versesData.verses || []);
  const verses = rawList.map((v: Record<string, any>) => {
    if (!v) return null;
    const vk = v.verse_key as string;
    const tArray = v.translations || [];
    const tObj = tArray.find((t: any) => t.resource_id === 131) || tArray.find((t: any) => t.resource_id === 20) || tArray[0];
    const transRaw = tObj?.text || '';
    const transClean = transRaw.replace(/<[^>]*>/g, '');

    return {
      id: v.id,
      verse_key: vk,
      verse_number: v.verse_number,
      chapter_id: parseInt(vk.split(':')[0]),
      text_uthmani: uthmaniMap.get(vk) || '',
      text_uthmani_tajweed: tajweedMap.get(vk) || '',
      juz_number: v.juz_number,
      page_number: v.page_number,
      translation: transClean || 'Meaning not available...',
    };
  }).filter(Boolean);

    return NextResponse.json({
      verses,
      pagination: versesData.pagination,
    });
  } catch (error: any) {
    console.error('Verses API Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
