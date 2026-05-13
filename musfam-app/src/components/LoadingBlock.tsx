'use client';

import { useEffect, useState } from 'react';

interface QuranVerse {
  arabic: string;
  translation: string;
  verseKey: string;
}

// Short verses with known short translations
const LOCAL_VERSES: QuranVerse[] = [
  { arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', translation: 'For indeed, with hardship will be ease.', verseKey: '94:5' },
  { arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', translation: 'Indeed, with hardship will be ease.', verseKey: '94:6' },
  { arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', translation: 'And whoever relies upon Allah — then He is sufficient for him.', verseKey: '65:3' },
  { arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', translation: 'Sufficient for us is Allah, and He is the best Disposer of affairs.', verseKey: '3:173' },
  { arabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ', translation: 'Then which of the favors of your Lord would you deny?', verseKey: '55:13' },
  { arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', translation: 'Verily, in the remembrance of Allah do hearts find rest.', verseKey: '13:28' },
  { arabic: 'وَأَمَّا بِنِعْمَةِ رَبِّكَ فَحَدِّثْ', translation: 'And proclaim the favor of your Lord.', verseKey: '93:11' },
  { arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', translation: 'So remember Me; I will remember you.', verseKey: '2:152' },
];

const SURAH_NAMES: Record<number, string> = {
  1:'Al-Fatihah',2:'Al-Baqarah',3:'Al-Imran',4:'An-Nisa',13:'Ar-Rad',14:'Ibrahim',
  17:'Al-Isra',18:'Al-Kahf',29:'Al-Ankabut',33:'Al-Ahzab',39:'Az-Zumar',55:'Ar-Rahman',
  59:'Al-Hashr',64:'At-Taghaabun',65:'At-Talaq',73:'Al-Muzzammil',76:'Al-Insan',
  93:'Ad-Duha',94:'Al-Inshirah',96:'Al-Alaq',
};

function formatCitation(verseKey: string) {
  const [ch, ay] = verseKey.split(':');
  const name = SURAH_NAMES[parseInt(ch)] || `Surah ${ch}`;
  return `${name} ${ch}:${ay}`;
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
  // FIX: Initialize to null to avoid SSR/client hydration mismatch from Math.random()
  // The random verse is selected only on the client inside useEffect
  const [verse, setVerse] = useState<QuranVerse | null>(null);

  useEffect(() => {
    // Pick a random local verse immediately on client (avoids SSR mismatch)
    const localVerse = LOCAL_VERSES[Math.floor(Math.random() * LOCAL_VERSES.length)];
    setVerse(localVerse);

    // Try to upgrade with a fresh API verse in background
    const SHORT_VERSE_KEYS = ['94:5', '94:6', '65:3', '3:173', '55:13', '13:28', '93:11', '2:152'];
    const key = SHORT_VERSE_KEYS[Math.floor(Math.random() * SHORT_VERSE_KEYS.length)];

    const controller = new AbortController();
    fetch(
      `https://api.quran.com/api/v4/verses/by_key/${key}?translations=131&fields=text_uthmani,verse_key`,
      { headers: { Accept: 'application/json' }, signal: controller.signal }
    )
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const v = data?.verse;
        if (!v) return;
        const translation = (v.translations?.[0]?.text || '').replace(/<[^>]+>/g, '');
        if (translation.length > 0 && translation.length <= 120) {
          setVerse({ arabic: v.text_uthmani || '', translation, verseKey: v.verse_key || key });
        }
      })
      .catch(() => { /* keep local verse */ });

    return () => controller.abort();
  }, []);

  const content = (
    <div className="flex flex-col items-center gap-5 px-6 text-center max-w-xs mx-auto">
      {verse ? (
        <>
          {/* Arabic text */}
          <p
            className="text-[24px] leading-[2.2] text-[#2d3a10] text-right w-full"
            style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
            dir="rtl"
          >
            {verse.arabic}
          </p>

          {/* Separator */}
          <div className="w-8 h-px bg-[#c8a84b]/50" />

          {/* English translation */}
          <p className="text-[13px] italic text-gray-500 leading-relaxed">
            &ldquo;{verse.translation}&rdquo;
          </p>

          {/* Citation */}
          <p className="text-[10px] font-bold text-[#c8a84b]/70 uppercase tracking-widest">
            {formatCitation(verse.verseKey)}
          </p>
        </>
      ) : (
        /* Skeleton while JS hydrates — stable, no random content */
        <div className="space-y-3 w-full animate-pulse">
          <div className="h-8 w-4/5 bg-[#2d3a10]/8 rounded-lg ml-auto" />
          <div className="h-8 w-3/5 bg-[#2d3a10]/6 rounded-lg ml-auto" />
          <div className="w-8 h-px bg-[#c8a84b]/30 mx-auto" />
          <div className="h-4 w-64 bg-[#2d3a10]/6 rounded-lg mx-auto" />
          <div className="h-3 w-32 bg-[#c8a84b]/20 rounded-lg mx-auto" />
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
