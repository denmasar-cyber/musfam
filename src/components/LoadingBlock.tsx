'use client';

import { useEffect, useState } from 'react';

interface QuranVerse {
  arabic: string;
  translation: string;
  verseKey: string;
}

// Short, beautiful verses from Quran Foundation API
const VERSE_KEYS = [
  '94:5', '94:6', '65:3', '2:286', '3:173', '2:255',
  '93:11', '55:13', '14:7', '39:53', '13:28', '2:152',
];

async function fetchVerseFromQuranFoundation(verseKey: string): Promise<QuranVerse | null> {
  try {
    const [chapter, verse] = verseKey.split(':');
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_key/${verseKey}?translations=131&fields=text_uthmani,verse_key`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error('API failed');
    const data = await res.json();
    const v = data?.verse;
    if (!v) return null;
    return {
      arabic: v.text_uthmani || '',
      translation: v.translations?.[0]?.text?.replace(/<[^>]+>/g, '') || '',
      verseKey: v.verse_key || `${chapter}:${verse}`,
    };
  } catch {
    return null;
  }
}

function getLocalVerse(): QuranVerse {
  const LOCAL_VERSES: QuranVerse[] = [
    { arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', translation: 'For indeed, with hardship will be ease.', verseKey: '94:5' },
    { arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', translation: 'Indeed, with hardship will be ease.', verseKey: '94:6' },
    { arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', translation: 'And whoever relies upon Allah — then He is sufficient for him.', verseKey: '65:3' },
    { arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', translation: 'Allah does not burden a soul beyond that it can bear.', verseKey: '2:286' },
    { arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', translation: 'Sufficient for us is Allah, and He is the best Disposer of affairs.', verseKey: '3:173' },
    { arabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ', translation: 'Then which of the favors of your Lord would you deny?', verseKey: '55:13' },
    { arabic: 'وَإِن تَعُدُّوا نِعْمَةَ اللَّهِ لَا تُحْصُوهَا', translation: 'And if you should count the favors of Allah, you could not enumerate them.', verseKey: '14:34' },
    { arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', translation: 'Verily, in the remembrance of Allah do hearts find rest.', verseKey: '13:28' },
  ];
  return LOCAL_VERSES[Math.floor(Date.now() / 7000) % LOCAL_VERSES.length];
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#c8a84b]"
          style={{ animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.7); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </span>
  );
}

interface LoadingBlockProps {
  fullScreen?: boolean;
}

export default function LoadingBlock({ fullScreen = false }: LoadingBlockProps) {
  const [verse, setVerse] = useState<QuranVerse | null>(null);

  useEffect(() => {
    const cacheKey = `musfam_loading_verse_${new Date().toISOString().slice(0, 13)}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try { setVerse(JSON.parse(cached)); return; } catch { /* ignore */ }
    }

    // Pick random verse key
    const key = VERSE_KEYS[Math.floor(Math.random() * VERSE_KEYS.length)];
    fetchVerseFromQuranFoundation(key).then(v => {
      const result = v || getLocalVerse();
      setVerse(result);
      sessionStorage.setItem(cacheKey, JSON.stringify(result));
    });
  }, []);

  const content = (
    <div className="flex flex-col items-center gap-5 px-6 text-center max-w-xs mx-auto">
      {/* Arabic crescent ornament */}
      <div className="text-4xl" style={{ filter: 'drop-shadow(0 2px 8px rgba(200,168,75,0.4))' }}>
        ☪️
      </div>

      {/* Verse content */}
      {verse ? (
        <div className="space-y-3">
          <p
            className="text-[22px] leading-[2.2] text-[#2d3a10] text-right"
            style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
          >
            {verse.arabic}
          </p>
          <div className="w-8 h-px bg-[#c8a84b]/50 mx-auto" />
          <p className="text-[12px] italic text-gray-500 leading-relaxed">
            &ldquo;{verse.translation}&rdquo;
          </p>
          <p className="text-[10px] font-bold text-[#c8a84b]/70 uppercase tracking-widest">
            {verse.verseKey}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="h-6 w-48 bg-[#2d3a10]/10 rounded-lg animate-pulse" />
          <div className="h-4 w-36 bg-[#2d3a10]/08 rounded-lg animate-pulse" />
        </div>
      )}

      {/* Loading indicator */}
      <div className="flex items-center gap-2 mt-1">
        <div className="w-4 h-4 border-2 border-[#2d3a10]/20 border-t-[#2d3a10] rounded-full animate-spin flex-shrink-0" />
        <p className="text-[11px] font-bold text-[#2d3a10]/50 uppercase tracking-wider">
          Loading<TypingDots />
        </p>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center" style={{ background: '#F7F5F0' }}>
        {content}
      </main>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 w-full" style={{ background: '#F7F5F0' }}>
      {content}
    </div>
  );
}
