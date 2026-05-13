import { useState, useCallback } from 'react';

export interface QuranSearchResult {
  verse_key: string;
  text: string;
  translations: { text: string }[];
}
export interface QuranSurahMatch {
  num: number;
  name: string;
  total: number;
}
export interface LoadedVerse { key: string; arabic: string; translation: string }

export function useQuranSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QuranSearchResult[]>([]);
  const [surahMatch, setSurahMatch] = useState<QuranSurahMatch | null>(null);
  const [ayahInput, setAyahInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [verseLoading, setVerseLoading] = useState(false);
  const [verses, setVerses] = useState<LoadedVerse[]>([]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setResults([]);
    setSurahMatch(null);
    setAyahInput('');
    setVerses([]);
    try {
      const res = await fetch(`/api/quran/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const d = await res.json();
        if (d.search?.surah) {
          setSurahMatch({ num: d.search.surah, name: q, total: d.search.total });
        } else {
          setResults(d.search?.results || []);
        }
      }
    } catch { /* silent */ }
    setSearching(false);
  }, []);

  const loadSurahVerses = useCallback(async (surahNum: number, fromAyah = 1) => {
    setVerseLoading(true);
    setVerses([]);
    try {
      const res = await fetch(`/api/quran/verses?chapter=${surahNum}&per_page=300`);
      if (res.ok) {
        const d = await res.json();
        const all: Array<{ verse_key: string; text_uthmani?: string; translation?: string }> = d.verses || [];
        const mapped = all
          .filter(v => {
            const [, a] = v.verse_key.split(':');
            return parseInt(a, 10) >= fromAyah;
          })
          .map(v => ({ key: v.verse_key, arabic: v.text_uthmani || '', translation: v.translation || '' }));
        setVerses(mapped);
      }
    } catch { /* silent */ }
    setVerseLoading(false);
  }, []);

  const reset = useCallback(() => {
    setVerses([]);
    setSurahMatch(null);
    setResults([]);
    setQuery('');
    setAyahInput('');
  }, []);

  return {
    query, setQuery,
    results,
    surahMatch, setSurahMatch,
    ayahInput, setAyahInput,
    searching, verseLoading,
    verses, setVerses,
    search, loadSurahVerses, reset,
  };
}
