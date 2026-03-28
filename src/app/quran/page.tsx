'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { recordQuranRead } from '@/lib/store';
import { syncBookmarkToFoundation, syncNoteToFoundation } from '@/lib/quran-foundation-sync';
import LoadingBlock from '@/components/LoadingBlock';
import {
  BookOpen, Search, Bookmark, BookmarkCheck, StickyNote,
  ChevronLeft, ChevronRight, Flame, X,
  Loader2, MessageSquare, ArrowLeft, List, Eye, EyeOff,
  Play, Pause, Volume2, VolumeX, SkipForward,
  Users, Check, ThumbsUp, Trash2,
} from 'lucide-react';

/* === Types === */
interface Chapter {
  id: number;
  name_arabic: string;
  name_simple: string;
  revelation_place: string;
  verses_count: number;
  translated_name: { name: string };
}

interface Verse {
  id: number;
  verse_key: string;
  verse_number: number;
  chapter_id?: number;
  text_uthmani: string;
  text_uthmani_tajweed: string;
  juz_number: number;
  page_number: number;
  translation: string;
}

interface VerseTiming {
  verse_key: string;
  timestamp_from: number;
  timestamp_to: number;
  segments: [number, number, number][]; // [word_index, start_ms, end_ms]
}

interface BookmarkItem {
  id: string;
  verse_key: string;
  chapter_number: number;
  verse_number: number;
  surah_name: string;
  text_uthmani: string;
  translation: string;
}

interface NoteItem {
  id: string;
  verse_key: string;
  chapter_number: number;
  verse_number: number;
  note_text: string;
}

type ViewMode = 'surah-list' | 'juz-list' | 'reading' | 'bookmarks' | 'search' | 'khatam';

/* ─── Khatam types ── */
interface KhatamSession {
  id: string;
  family_id: string;
  status: 'voting' | 'active' | 'completed';
  started_at: string;
  completed_at: string | null;
}
interface KhatamAssignment {
  id: string;
  session_id: string;
  user_id: string;
  juz_number: number;
  completed: boolean;
  completed_at: string | null;
  member_name?: string;
}

/* === Helpers === */
function toArabicNum(n: number): string {
  return String(n).split('').map(c => '٠١٢٣٤٥٦٧٨٩'[+c]).join('');
}

function buildHtml(verse: Verse, activeWordIdx: number, isThisPlaying: boolean): string {
  // Use plain uthmani text — no tajweed coloring
  const rawText = verse.text_uthmani || '';
  const endMark = `\u00a0<span class="verse-end">\uFD3F${toArabicNum(verse.verse_number)}\uFD3E</span>`;

  if (!isThisPlaying || activeWordIdx < 0) return rawText + endMark;

  const tokens = rawText.split(/(\s+)/);
  let wordCount = 0;
  const built = tokens.map(token => {
    if (/^\s*$/.test(token)) return token;
    const idx = wordCount++;
    if (idx === activeWordIdx) return `<span class="quran-word-active">${token}</span>`;
    return token;
  });
  return built.join('') + endMark;
}

/* === VerseCard === */
interface VerseCardProps {
  verse: Verse;
  isBookmarked: boolean;
  hasNote: boolean;
  noteText: string;
  noteContent: string; // current saved note text
  isSelected: boolean;
  isEditing: boolean;
  isThisPlaying: boolean;
  showTranslation: boolean;
  showTafseerFor: string | null;
  tafseerText: string;
  loadingTafseer: boolean;
  activeWordIdx: number;
  verseTimings: Map<string, VerseTiming>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onSelectVerse: (key: string | null) => void;
  onToggleBookmark: (verse: Verse) => void;
  onToggleNote: (verseKey: string, savedText: string) => void;
  onNoteTextChange: (text: string) => void;
  onSaveNote: (verseKey: string) => void;
  onCancelNote: () => void;
  onDeleteNote: (verseKey: string) => void;
  onToggleTafseer: (verseKey: string) => void;
  onVerseRead?: (verseKey: string) => void;
}

const VerseCard = memo(function VerseCard({
  verse, isBookmarked, hasNote, noteText, noteContent, isSelected, isEditing,
  isThisPlaying, showTranslation,
  showTafseerFor, tafseerText, loadingTafseer, activeWordIdx, verseTimings, audioRef,
  onSelectVerse, onToggleBookmark, onToggleNote, onNoteTextChange,
  onSaveNote, onCancelNote, onDeleteNote, onToggleTafseer, onVerseRead,
}: VerseCardProps) {
  const showTafseer = showTafseerFor === verse.verse_key;
  const cardRef = React.useRef<HTMLDivElement>(null);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (!onVerseRead || firedRef.current) return;
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          onVerseRead(verse.verse_key);
          obs.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onVerseRead, verse.verse_key]);

  return (
    <div
      ref={cardRef}
      data-verse-key={verse.verse_key}
      className={`bg-white rounded-2xl border transition-all ${isSelected ? 'border-forest/50 shadow-md' : 'border-cream-dark'}`}
    >
      {/* ── Main row ── */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => onSelectVerse(isSelected ? null : verse.verse_key)}
      >
        {/* Verse number badge */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-2 transition-all ${
          isThisPlaying ? 'bg-gold scale-110' : 'bg-forest/10'
        }`}>
          <span className={`font-bold text-[11px] ${isThisPlaying ? 'text-white' : 'text-forest'}`}>
            {verse.verse_number}
          </span>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Arabic tajweed text */}
          <p
            className="quran-tajweed"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: buildHtml(verse, activeWordIdx, isThisPlaying) }}
          />
          {/* Translation */}
          {showTranslation && verse.translation && (
            <p className="text-[13px] text-gray-500 leading-relaxed mt-2 pt-2 border-t border-cream-dark/70 text-left">
              {verse.translation}
            </p>
          )}
        </div>

        {/* Inline quick actions — Bookmark + Note always visible */}
        <div className="flex-shrink-0 flex flex-col gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            onClick={() => onToggleBookmark(verse)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isBookmarked ? 'bg-gold/20 text-gold-dark' : 'bg-cream-light text-gray-400 border border-cream-dark'
            }`}
          >
            {isBookmarked ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
          </button>
          <button
            type="button"
            title={hasNote ? 'Edit note' : 'Add note'}
            onClick={() => onToggleNote(verse.verse_key, noteContent)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              hasNote || isEditing ? 'bg-forest/10 text-forest' : 'bg-cream-light text-gray-400 border border-cream-dark'
            }`}
          >
            <StickyNote size={12} />
          </button>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {isSelected && (
        <div className="border-t border-cream-dark px-4 pb-4 space-y-3">
          {/* Action bar */}
          <div className="flex items-center gap-1.5 pt-3">
            <span className="text-[10px] text-gray-400 flex-1">
              {verse.verse_key} · Juz {verse.juz_number} · Page {verse.page_number}
            </span>

            <button type="button" title="Tafsir (Ibn Kathir)"
              onClick={e => { e.stopPropagation(); onToggleTafseer(verse.verse_key); }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                showTafseer ? 'bg-amber-100 text-amber-700' : 'bg-cream-light text-gray-400 border border-cream-dark'
              }`}>
              <MessageSquare size={13} />
            </button>
          </div>

          {/* Verse progress when playing */}
          {isThisPlaying && (() => {
            const vt = verseTimings.get(verse.verse_key);
            if (!vt || !audioRef.current) return null;
            const ct = audioRef.current.currentTime * 1000;
            const verseDur = vt.timestamp_to - vt.timestamp_from;
            const p = verseDur > 0 ? Math.min((ct - vt.timestamp_from) / verseDur, 1) : 0;
            return (
              <div className="w-full h-1 bg-cream-dark rounded-full overflow-hidden">
                <div className="h-full bg-gold rounded-full" style={{ width: `${p * 100}%` }} />
              </div>
            );
          })()}

          {/* Note display */}
          {hasNote && !isEditing && (
            <div className="bg-forest/5 rounded-xl p-3 border border-forest/15">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-forest uppercase tracking-wider">Your Note</p>
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); onDeleteNote(verse.verse_key); }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete note"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{noteContent}</p>
            </div>
          )}

          {/* Note editor */}
          {isEditing && (
            <div onClick={e => e.stopPropagation()}>
              <textarea value={noteText} onChange={e => onNoteTextChange(e.target.value)}
                placeholder="Write a note for this verse..."
                dir="ltr"
                className="w-full rounded-xl border border-cream-dark bg-cream-light/60 p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-forest/30"
                autoFocus />
              <div className="flex gap-2 mt-2">
                <button type="button" disabled={!noteText.trim()} onClick={() => onSaveNote(verse.verse_key)}
                  className="flex-1 py-2 rounded-xl bg-forest text-white font-bold text-xs disabled:opacity-40">Save</button>
                <button type="button" onClick={onCancelNote}
                  className="px-4 py-2 rounded-xl bg-white text-gray-600 font-bold text-xs border border-cream-dark">Cancel</button>
              </div>
            </div>
          )}

          {/* Tafseer panel */}
          {showTafseer && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100/70 border-b border-amber-100">
                <MessageSquare size={11} className="text-amber-700" />
                <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Tafsir Ibn Kathir</p>
                <span className="ml-auto text-[10px] text-amber-600">{verse.verse_key}</span>
              </div>
              <div className="px-4 py-3">
                {loadingTafseer && !tafseerText ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                    <span className="text-sm text-amber-600">Loading tafsir...</span>
                  </div>
                ) : (
                  <p className="tafseer-body">{tafseerText}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const WALISONGO_QUOTES = [
  { quote: "Urip iku urup — Life is a flame; make it shine for others.", author: "Sunan Kalijaga" },
  { quote: "Aja rumangsa bisa, nanging bisaa rumangsa — Don't feel capable; be capable of feeling.", author: "Sunan Kalijaga" },
  { quote: "Eling lan waspada — Be mindful and ever watchful of the heart.", author: "Sunan Bonang" },
  { quote: "Manungsa iku papan tumibane wahyu — A person is where divine guidance descends.", author: "Sunan Ampel" },
  { quote: "Jer basuki mawa beya — Every goodness requires sacrifice and effort.", author: "Sunan Giri" },
  { quote: "Sapa nandur bakal ngunduh — Whoever plants shall harvest; your deeds return to you.", author: "Sunan Drajat" },
  { quote: "Wenehana mangan marang wong kang luwe — Feed those who hunger; generosity opens the heart.", author: "Sunan Drajat" },
  { quote: "Ngluruk tanpa bala, menang tanpa ngasorake — Advance without troops; win without humiliating.", author: "Sunan Kalijaga" },
  { quote: "Ing ngarso sung tuladha, ing madya mangun karsa — Lead by example; inspire from within.", author: "Ki Hajar Dewantara (Walisongo spirit)" },
  { quote: "Sepi ing pamrih, rame ing gawe — Seek no praise; be full in your deeds.", author: "Sunan Kalijaga" },
];

function getWalisongoQuote() {
  return WALISONGO_QUOTES[Math.floor(Date.now() / 10000) % WALISONGO_QUOTES.length];
}

function QuranLoadingBlock() {
  return <LoadingBlock />;
}

/* === Page === */
export default function QuranPage() {
  const { user, family, profile } = useAuth();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'khatam') return 'khatam';
    return 'surah-list';
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);

  const [showTranslation, setShowTranslation] = useState(true);
  const [selectedVerseKey, setSelectedVerseKey] = useState<string | null>(null);

  // Tafseer — use ref for cache to avoid re-renders
  const tafseerCacheRef = useRef<Map<string, string>>(new Map());
  const [showTafseerFor, setShowTafseerFor] = useState<string | null>(null);
  const [loadingTafseer, setLoadingTafseer] = useState(false);
  const [tafseerVersion, setTafseerVersion] = useState(0); // bump to force re-render

  // Bookmarks & Notes
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [bookmarkItems, setBookmarkItems] = useState<BookmarkItem[]>([]);
  const [notes, setNotes] = useState<Map<string, NoteItem>>(new Map());
  const [noteText, setNoteText] = useState('');
  const [editingNoteVerse, setEditingNoteVerse] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ verse_key: string; text: string; translations: { text: string }[] }[]>([]);
  const [searching, setSearching] = useState(false);
  // When search matches a whole surah — show ayah picker instead of verse list
  const [searchSurah, setSearchSurah] = useState<{ num: number; name: string; total: number } | null>(null);
  const [surahAyahInput, setSurahAyahInput] = useState('');

  // Streak
  const [todayReadCount, setTodayReadCount] = useState(0);
  const [readingStreak, setReadingStreak] = useState(0);

  // Scroll to verse after bookmark navigation
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);

  // ── Audio ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chapterAudioUrl, setChapterAudioUrl] = useState<string | null>(null);
  // Use ref so RAF closure always reads latest timings (no stale closure)
  const verseTimingsRef = useRef<Map<string, VerseTiming>>(new Map());
  const [verseTimings, setVerseTimings] = useState<Map<string, VerseTiming>>(new Map());
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null);
  const playingVerseKeyRef = useRef<string | null>(null);
  const [playingSingleVerse, setPlayingSingleVerse] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const rafRef = useRef<number | null>(null);

  // ── Qur'anther ──
  const [khatamSession, setKhatamSession] = useState<KhatamSession | null>(null);
  const [khatamAssignments, setKhatamAssignments] = useState<KhatamAssignment[]>([]);
  const [khatamVotes, setKhatamVotes] = useState<{ user_id: string }[]>([]);
  const [familyMemberCount, setFamilyMemberCount] = useState(0);
  const [khatamLoading, setKhatamLoading] = useState(false);
  const [myAssignments, setMyAssignments] = useState<KhatamAssignment[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  /* ─── Sync verseTimings state → ref ─────────────────── */
  useEffect(() => {
    verseTimingsRef.current = verseTimings;
  }, [verseTimings]);

  /* ─── Sync playingVerseKey state → ref ──────────────── */
  useEffect(() => {
    playingVerseKeyRef.current = playingVerseKey;
  }, [playingVerseKey]);

  /* ─── Scroll to pending verse after verses load ─────── */
  useEffect(() => {
    if (!pendingScrollKey || verses.length === 0) return;
    // Small delay so DOM renders first
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-verse-key="${pendingScrollKey}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingScrollKey(null);
    }, 150);
    return () => clearTimeout(t);
  }, [verses, pendingScrollKey]);

  /* === Data loading === */
  useEffect(() => {
    fetch('/api/quran/chapters')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setChapters(d.chapters || []); setLoadingChapters(false); })
      .catch(() => setLoadingChapters(false));
  }, []);

  const loadBookmarks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('quran_bookmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) { setBookmarkItems(data); setBookmarks(new Set(data.map((b: BookmarkItem) => b.verse_key))); }
  }, [user]);

  const loadNotes = useCallback(async () => {
    if (!user || !selectedChapter) return;
    const { data } = await supabase.from('quran_notes').select('*').eq('user_id', user.id).eq('chapter_number', selectedChapter.id);
    if (data) { const m = new Map<string, NoteItem>(); data.forEach((n: NoteItem) => m.set(n.verse_key, n)); setNotes(m); }
  }, [user, selectedChapter]);

  const loadStreak = useCallback(async () => {
    if (!user || !family) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: td } = await supabase.from('quran_reading_log').select('id').eq('user_id', user.id).eq('date', today);
    setTodayReadCount(td?.length || 0);
    const { data: logs } = await supabase.from('quran_reading_log').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(60);
    if (logs?.length) {
      const dates = [...new Set(logs.map((l: { date: string }) => l.date))].sort().reverse();
      let s = 0; const cd = new Date();
      for (const d of dates) {
        if (d === cd.toISOString().split('T')[0]) { s++; cd.setDate(cd.getDate() - 1); }
        else if (s === 0) { cd.setDate(cd.getDate() - 1); if (d === cd.toISOString().split('T')[0]) { s++; cd.setDate(cd.getDate() - 1); } else break; }
        else break;
      }
      setReadingStreak(s);
    }
  }, [user, family]);

  /* ─── Khatam ─────────────────────────────────────────── */
  const loadKhatam = useCallback(async () => {
    if (!family || !user) return;
    setKhatamLoading(true);
    try {
      // Member count
      const { data: members } = await supabase.from('profiles').select('id').eq('family_id', family.id);
      setFamilyMemberCount(members?.length ?? 0);

      // Active session
      const { data: sessions } = await supabase
        .from('khatam_sessions')
        .select('*')
        .eq('family_id', family.id)
        .in('status', ['voting', 'active'])
        .order('started_at', { ascending: false })
        .limit(1);
      const session = sessions?.[0] as KhatamSession ?? null;
      setKhatamSession(session);

      if (session) {
        // Assignments with member names
        const { data: assignments } = await supabase
          .from('khatam_assignments')
          .select('*')
          .eq('session_id', session.id)
          .order('juz_number', { ascending: true });

        if (assignments) {
          const userIds = [...new Set(assignments.map((a: KhatamAssignment) => a.user_id))];
          const { data: profileRows } = await supabase.from('profiles').select('id, name').in('id', userIds);
          const nameMap = new Map<string, string>();
          for (const p of profileRows ?? []) nameMap.set(p.id, p.name);
          const withNames = assignments.map((a: KhatamAssignment) => ({ ...a, member_name: nameMap.get(a.user_id) || 'Member' }));
          setKhatamAssignments(withNames);
          setMyAssignments(withNames.filter((a: KhatamAssignment) => a.user_id === user.id));
        }
      }

      // Votes
      const { data: votes } = await supabase.from('khatam_votes').select('user_id').eq('family_id', family.id);
      setKhatamVotes(votes ?? []);
    } catch { /* optional */ }
    setKhatamLoading(false);
  }, [family, user]);

  async function handleVote() {
    if (!family || !user) return;
    const hasVoted = khatamVotes.some(v => v.user_id === user.id);
    if (hasVoted) {
      await supabase.from('khatam_votes').delete().eq('family_id', family.id).eq('user_id', user.id);
      loadKhatam();
    } else {
      // Use upsert to handle edge case where a stale vote already exists
      const { error } = await supabase
        .from('khatam_votes')
        .upsert({ family_id: family.id, user_id: user.id }, { onConflict: 'family_id,user_id' });
      if (error) { loadKhatam(); return; }
      // Reload fresh counts then check if we should auto-start
      const { data: freshVotes } = await supabase.from('khatam_votes').select('user_id').eq('family_id', family.id);
      const { data: members } = await supabase.from('profiles').select('id').eq('family_id', family.id);
      const voteCount = freshVotes?.length ?? 0;
      const memberCount = members?.length ?? 0;
      if (memberCount > 0 && voteCount >= memberCount) {
        await startKhatam();
        return;
      }
      loadKhatam();
    }
  }

  async function startKhatam() {
    if (!family || !user) return;
    // Clear votes
    await supabase.from('khatam_votes').delete().eq('family_id', family.id);
    // Remove any existing voting/active sessions (handles the UNIQUE constraint)
    await supabase.from('khatam_sessions').delete().eq('family_id', family.id).in('status', ['voting', 'active']);

    // Create session
    const { data: session } = await supabase
      .from('khatam_sessions')
      .insert({ family_id: family.id, status: 'active' })
      .select()
      .single();
    if (!session) return;

    // Get all members
    const { data: members } = await supabase.from('profiles').select('id').eq('family_id', family.id);
    if (!members?.length) return;

    // Distribute 30 juz evenly across members (round-robin)
    const assignments = Array.from({ length: 30 }, (_, i) => ({
      session_id: session.id,
      family_id: family.id,
      user_id: members[i % members.length].id,
      juz_number: i + 1,
      completed: false,
    }));
    await supabase.from('khatam_assignments').insert(assignments);
    loadKhatam();
  }

  async function markJuzComplete(assignmentId: string) {
    await supabase.from('khatam_assignments')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', assignmentId);

    // Check if all 30 juz done
    const updated = khatamAssignments.map(a => a.id === assignmentId ? { ...a, completed: true } : a);
    if (updated.every(a => a.completed) && khatamSession) {
      await supabase.from('khatam_sessions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', khatamSession.id);
    }
    loadKhatam();
  }

  useEffect(() => { loadBookmarks(); loadStreak(); }, [loadBookmarks, loadStreak]);
  useEffect(() => { if (selectedChapter) loadNotes(); }, [selectedChapter, loadNotes]);
  useEffect(() => { if (view === 'khatam') loadKhatam(); }, [view, loadKhatam]);

  /* === Audio: load === */
  async function loadChapterAudio(chapterId: number) {
    setChapterAudioUrl(null);
    setVerseTimings(new Map());
    verseTimingsRef.current = new Map();
    setAudioLoaded(false);
    setAudioLoading(true);
    try {
      const res = await fetch(`/api/quran/audio?chapter=${chapterId}&reciter=7`);
      if (!res.ok) { setAudioLoading(false); return; }
      const data = await res.json();
      if (!data.audio_url) { setAudioLoading(false); return; }

      setChapterAudioUrl(data.audio_url);
      const tm = new Map<string, VerseTiming>();
      for (const vt of (data.verse_timings || []) as VerseTiming[]) {
        tm.set(vt.verse_key, vt);
      }
      setVerseTimings(tm);
      verseTimingsRef.current = tm;
      // Audio is available regardless of whether verse timings exist
      setAudioLoaded(true);
    } catch { /* audio optional */ }
    setAudioLoading(false);
  }

  /* ─── Audio: RAF tracking ────────────────────────────── */
  function startTracking() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const audio = audioRef.current;
    if (!audio) return;

    function tick() {
      if (!audio) return;
      const ct = audio.currentTime * 1000;
      const dur = audio.duration || 0;
      setAudioProgress(dur > 0 ? audio.currentTime / dur : 0);

      // Read from ref — not stale closure state
      const timings = verseTimingsRef.current;
      let currentVk: string | null = null;
      for (const [vk, vt] of timings) {
        if (ct >= vt.timestamp_from && ct < vt.timestamp_to) { currentVk = vk; break; }
      }

      // If we are playing a single verse, stop if we pass its timing_to
      if (playingSingleVerse && playingVerseKeyRef.current) {
        const vt = timings.get(playingVerseKeyRef.current);
        if (vt && ct >= vt.timestamp_to) {
          audio.pause();
          setIsPlaying(false);
          stopTracking();
          setPlayingVerseKey(null);
          return;
        }
      }

      setPlayingVerseKey(prev => prev !== currentVk ? currentVk : prev);

      if (currentVk) {
        const vt = timings.get(currentVk);
        if (vt?.segments?.length) {
          const relT = ct - vt.timestamp_from;
          let wIdx = -1;
          for (const [wi, s, e] of vt.segments) {
            if (relT >= s && relT < e) { wIdx = wi; break; }
          }
          setActiveWordIdx(wIdx);
        }
      } else {
        setActiveWordIdx(-1);
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopTracking() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setActiveWordIdx(-1);
  }

  /* ─── Audio: play/pause/seek ─────────────────────────── */
  async function playChapterFrom(verseKey: string, singleVerse: boolean = false) {
    if (!chapterAudioUrl || !audioLoaded) return;
    const audio = audioRef.current;
    if (!audio) return;

    const vt = verseTimingsRef.current.get(verseKey);
    const seekTo = vt ? vt.timestamp_from / 1000 : 0;

    // Load audio if not already loaded (compare by including/endsWith to handle absolute vs relative)
    const alreadyLoaded = audio.src && (audio.src === chapterAudioUrl || audio.src.endsWith(chapterAudioUrl) || chapterAudioUrl.endsWith(audio.src));
    if (!alreadyLoaded || audio.readyState < 2) {
      audio.src = chapterAudioUrl;
      audio.muted = isMuted;
      await new Promise<void>(res => {
        const onReady = () => { audio.removeEventListener('canplay', onReady); res(); };
        audio.addEventListener('canplay', onReady);
        audio.load();
      });
    }

    audio.currentTime = seekTo;
    await audio.play().catch(() => null);
    setIsPlaying(true);
    setPlayingVerseKey(verseKey);
    setPlayingSingleVerse(singleVerse);
    startTracking();
  }

  function togglePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); stopTracking(); setIsPlaying(false); }
    else {
      // If nothing loaded yet, start from first verse of chapter
      if (!audio.src && verses.length > 0) { playChapterFrom(verses[0].verse_key, false); return; }
      audio.play().catch(() => null); setIsPlaying(true); startTracking();
    }
  }

  function playFullChapter() {
    if (verses.length > 0) playChapterFrom(verses[0].verse_key, false);
  }

  function stopAudio() {
    stopTracking();
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ''; }
    setIsPlaying(false);
    setPlayingVerseKey(null);
    setAudioProgress(0);
  }

  function skipToVerse(dir: number) {
    if (!playingVerseKey) return;
    const idx = verses.findIndex(v => v.verse_key === playingVerseKey);
    const nIdx = idx + dir;
    if (nIdx >= 0 && nIdx < verses.length) playChapterFrom(verses[nIdx].verse_key);
  }

  function onAudioEnded() {
    stopTracking(); setIsPlaying(false); setPlayingVerseKey(null); setAudioProgress(0);
  }

  /* === Navigation === */
  async function openChapter(chapter: Chapter, targetVerseKey?: string) {
    setSelectedChapter(chapter); setSelectedJuz(null); setView('reading');
    setLoadingVerses(true); setVerses([]); setSelectedVerseKey(null);
    setEditingNoteVerse(null); setShowTafseerFor(null); stopAudio();

    if (targetVerseKey) {
      setPendingScrollKey(targetVerseKey);
    } else {
      scrollRef.current?.scrollTo(0, 0);
    }

    try {
      const res = await fetch(`/api/quran/verses?chapter=${chapter.id}&per_page=300&edition=en.pickthall`);
      if (res.ok) { const d = await res.json(); setVerses(d.verses || []); logRead(chapter.id); }
    } catch { /* empty */ }
    setLoadingVerses(false);
    loadChapterAudio(chapter.id);
  }

  async function openJuz(juzNum: number) {
    setSelectedJuz(juzNum); setSelectedChapter(null); setView('reading');
    setLoadingVerses(true); setVerses([]); setSelectedVerseKey(null); stopAudio();
    scrollRef.current?.scrollTo(0, 0);
    try {
      const res = await fetch(`/api/quran/juz?juz=${juzNum}`);
      if (res.ok) { const d = await res.json(); setVerses(d.verses || []); }
    } catch { /* empty */ }
    setLoadingVerses(false);
  }

  function goToChapter(dir: number) {
    if (!selectedChapter) return;
    const next = chapters.find(c => c.id === selectedChapter.id + dir);
    if (next) openChapter(next);
  }

  async function logRead(chapterNum: number) {
    if (!user || !family) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('quran_reading_log').insert({ user_id: user.id, family_id: family.id, verse_key: `${chapterNum}:1`, chapter_number: chapterNum, verses_read: 1, date: today });
    setTodayReadCount(p => p + 1); loadStreak();
  }

  /* ─── Juz: derive surah range ────────────────────────── */
  function getJuzSurahRange(): string {
    if (!verses.length) return '';
    const chapterIds = [...new Set(verses.map(v => v.chapter_id || Number(v.verse_key.split(':')[0])))];
    const names = chapterIds.map(id => chapters.find(c => c.id === id)?.name_simple || `Surah ${id}`);
    if (names.length === 1) return names[0];
    return `${names[0]} – ${names[names.length - 1]}`;
  }

  /* ─── Tafseer ────────────────────────────────────────── */
  async function toggleTafseer(verseKey: string) {
    if (showTafseerFor === verseKey) { setShowTafseerFor(null); return; }
    setShowTafseerFor(verseKey);
    if (tafseerCacheRef.current.has(verseKey)) return;
    setLoadingTafseer(true);
    try {
      const res = await fetch(`/api/quran/tafseer?verse_key=${verseKey}`);
      if (res.ok) {
        const d = await res.json();
        tafseerCacheRef.current.set(verseKey, d.text || 'Tafsir not available.');
      }
    } catch { tafseerCacheRef.current.set(verseKey, 'Failed to load tafsir.'); }
    setLoadingTafseer(false);
    setTafseerVersion(v => v + 1); // force re-render
  }

  /* ─── Bookmarks ──────────────────────────────────────── */
  async function toggleBookmark(verse: Verse) {
    if (!user || !family) return;
    if (bookmarks.has(verse.verse_key)) {
      void syncBookmarkToFoundation(verse.verse_key, false);
      await supabase.from('quran_bookmarks').delete().eq('user_id', user.id).eq('verse_key', verse.verse_key);
      bookmarks.delete(verse.verse_key); setBookmarks(new Set(bookmarks));
    } else {
      void syncBookmarkToFoundation(verse.verse_key, true);
      const [chap, vn] = verse.verse_key.split(':').map(Number);
      await supabase.from('quran_bookmarks').insert({
        user_id: user.id, family_id: family.id, verse_key: verse.verse_key,
        chapter_number: chap, verse_number: vn,
        surah_name: selectedChapter?.name_simple || `Surah ${chap}`,
        text_uthmani: verse.text_uthmani || '', translation: verse.translation,
      });
      bookmarks.add(verse.verse_key); setBookmarks(new Set(bookmarks));
    }
    loadBookmarks();
  }

  /* ─── Notes ──────────────────────────────────────────── */
  async function saveNote(verseKey: string) {
    if (!user || !family || !noteText.trim()) return;
    const [chap, vn] = verseKey.split(':').map(Number);
    const ex = notes.get(verseKey);
    void syncNoteToFoundation(verseKey, true, noteText.trim());
    if (ex) await supabase.from('quran_notes').update({ note_text: noteText.trim(), updated_at: new Date().toISOString() }).eq('id', ex.id);
    else await supabase.from('quran_notes').insert({ user_id: user.id, family_id: family.id, verse_key: verseKey, chapter_number: chap, verse_number: vn, note_text: noteText.trim() });
    setEditingNoteVerse(null); setNoteText(''); loadNotes();
  }

  async function deleteNote(verseKey: string) {
    if (!user) return;
    void syncNoteToFoundation(verseKey, false);
    await supabase.from('quran_notes').delete().eq('user_id', user.id).eq('verse_key', verseKey);
    loadNotes();
  }

  /* ─── Search ─────────────────────────────────────────── */
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault(); if (!searchQuery.trim()) return;
    setSearching(true); setSearchResults([]); setSearchSurah(null); setSurahAyahInput('');
    try {
      const res = await fetch(`/api/quran/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const d = await res.json();
        // If API matched a surah → show ayah picker
        if (d.search?.surah) {
          const surahNum = d.search.surah as number;
          const totalVerses = d.search.total as number;
          // Get the surah name from results[0].verse_key
          setSearchSurah({ num: surahNum, name: searchQuery, total: totalVerses });
        } else {
          setSearchResults(d.search?.results || []);
        }
      }
    } catch { /* empty */ }
    setSearching(false);
  }

  /* ─── Stable callbacks for VerseCard ────────────────── */
  const handleSelectVerse = useCallback((key: string | null) => {
    setSelectedVerseKey(key);
    if (key === null) { setEditingNoteVerse(null); setShowTafseerFor(null); }
  }, []);

  const handleToggleNote = useCallback((verseKey: string, savedText: string) => {
    setEditingNoteVerse(prev => {
      if (prev === verseKey) { setNoteText(''); return null; }
      setNoteText(savedText);
      setSelectedVerseKey(verseKey);
      return verseKey;
    });
  }, []);

  const handleCancelNote = useCallback(() => {
    setEditingNoteVerse(null); setNoteText('');
  }, []);

  // Track which verses a child has seen — debounced, fires at most once per verse per session
  const readFiredRef = useRef<Set<string>>(new Set());
  const handleVerseRead = useCallback((verseKey: string) => {
    if (!user || !family || !profile) return;
    if (readFiredRef.current.has(verseKey)) return;
    readFiredRef.current.add(verseKey);
    const surahName = selectedChapter?.name_simple ?? '';
    recordQuranRead(user.id, family.id, profile.name, verseKey, surahName);
  }, [user, family, profile, selectedChapter]);

  /* ─── Render ──────────────────────────────────────────── */
  return (
    <>

      <audio
        ref={audioRef}
        onEnded={onAudioEnded}
        onError={() => { stopTracking(); setIsPlaying(false); }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="none"
      />

      <main ref={scrollRef} className="flex-1 overflow-y-auto hide-scrollbar pb-24 page-enter">

        {/* ════ READING VIEW ════ */}
        {view === 'reading' ? (
          <>
            <div className="mx-4 mt-4 rounded-[30px] relative overflow-hidden surah-header-bg hero-glow shadow-[0_18px_40px_rgba(45,58,16,0.22)]">
              <div className="relative px-5 pt-5 pb-6 sm:px-6 sm:pt-6 sm:pb-7">
                <div className="flex items-center justify-between mb-6">
                  <button type="button" title="Back"
                    onClick={() => { setView(selectedJuz ? 'juz-list' : 'surah-list'); setSelectedJuz(null); stopAudio(); }}
                    className="w-10 h-10 rounded-full bg-white/14 border border-white/18 flex items-center justify-center text-white backdrop-blur-sm">
                    <ArrowLeft size={17} />
                  </button>
                  <div className="flex gap-2">
                    {selectedChapter && (
                      <>
                        <button type="button" title="Previous surah" onClick={() => goToChapter(-1)} disabled={selectedChapter.id <= 1}
                          className="w-10 h-10 rounded-full bg-white/14 border border-white/18 flex items-center justify-center text-white backdrop-blur-sm disabled:opacity-30">
                          <ChevronLeft size={16} />
                        </button>
                        <button type="button" title="Next surah" onClick={() => goToChapter(1)} disabled={selectedChapter.id >= 114}
                          className="w-10 h-10 rounded-full bg-white/14 border border-white/18 flex items-center justify-center text-white backdrop-blur-sm disabled:opacity-30">
                          <ChevronRight size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {selectedChapter ? (
                  <div className="text-center">
                    <p className="surah-header-arabic text-[2.35rem] sm:text-[2.6rem] leading-none">{selectedChapter.name_arabic}</p>
                    <p className="text-white font-extrabold text-[2rem] leading-none mt-2">{selectedChapter.name_simple}</p>
                    {selectedChapter.translated_name && (
                      <p className="text-[#dce7b7] text-sm mt-2">{selectedChapter.translated_name.name}</p>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
                      <span className="hero-chip">
                        {selectedChapter.revelation_place === 'makkah' ? 'MECCAN' : 'MEDINAN'}
                      </span>
                      <span className="hero-chip">
                        {selectedChapter.verses_count} VERSES
                      </span>
                    </div>
                    {selectedChapter.id !== 1 && selectedChapter.id !== 9 && (
                      <div className="mt-5 pt-4 border-t border-white/12">
                        <p className="bismillah-header">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-white font-extrabold text-[2rem]">Juz {selectedJuz}</p>
                    {getJuzSurahRange() && <p className="text-[#dce7b7] text-sm mt-2">{getJuzSurahRange()}</p>}
                    <p className="text-white/60 text-xs mt-2 tracking-[0.22em] uppercase">{verses.length} verses</p>
                  </div>
                )}

                {/* Controls strip */}
                <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                  <button type="button" onClick={() => setShowTranslation(s => !s)}
                    className={`hero-action min-w-[132px] ${
                      showTranslation ? 'hero-action-active' : ''
                    }`}>
                    {showTranslation ? <Eye size={14} /> : <EyeOff size={14} />} Translation
                  </button>
                  {audioLoading && !audioLoaded && (
                    <span className="hero-action min-w-[132px]">
                      <Loader2 size={12} className="animate-spin" /> Audio
                    </span>
                  )}
                  {audioLoaded && (
                    <button type="button" title={isPlaying ? 'Pause' : 'Play chapter'}
                      onClick={isPlaying ? togglePlayPause : playFullChapter}
                      className="hero-action hero-action-active min-w-[132px]">
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'Pause' : 'Play'}
                    </button>
                  )}
                  {(audioLoaded || audioLoading) && (
                    <button type="button" title={isMuted ? 'Unmute' : 'Mute'}
                      onClick={() => { setIsMuted(m => { if (audioRef.current) audioRef.current.muted = !m; return !m; }); }}
                      className={`hero-action min-w-[110px] ${
                        !isMuted ? 'hero-action-active' : ''
                      }`}>
                      {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      {!isMuted ? ' Audio' : ' Mute'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Verses */}
            {loadingVerses ? (
              <QuranLoadingBlock />
            ) : (
              <div className="px-4 pt-4 space-y-3">
                {verses.map(v => (
                  <VerseCard
                    key={v.verse_key}
                    verse={v}
                    isBookmarked={bookmarks.has(v.verse_key)}
                    hasNote={notes.has(v.verse_key)}
                    noteText={editingNoteVerse === v.verse_key ? noteText : ''}
                    noteContent={notes.get(v.verse_key)?.note_text || ''}
                    isSelected={selectedVerseKey === v.verse_key}
                    isEditing={editingNoteVerse === v.verse_key}
                    isThisPlaying={playingVerseKey === v.verse_key && isPlaying}
                    showTranslation={showTranslation}
                    showTafseerFor={showTafseerFor}
                    tafseerText={tafseerCacheRef.current.get(v.verse_key) || ''}
                    loadingTafseer={loadingTafseer}
                    activeWordIdx={playingVerseKey === v.verse_key ? activeWordIdx : -1}
                    verseTimings={verseTimings}
                    audioRef={audioRef}
                    onSelectVerse={handleSelectVerse}
                    onToggleBookmark={toggleBookmark}
                    onToggleNote={handleToggleNote}
                    onNoteTextChange={setNoteText}
                    onSaveNote={saveNote}
                    onCancelNote={handleCancelNote}
                    onDeleteNote={deleteNote}
                    onToggleTafseer={toggleTafseer}
                    onVerseRead={handleVerseRead}
                  />
                ))}

                {selectedChapter && verses.length > 0 && (
                  <div className="flex gap-3 pt-2 pb-2">
                    <button type="button" onClick={() => goToChapter(-1)} disabled={selectedChapter.id <= 1}
                      className="flex-1 py-3 rounded-xl bg-white border border-cream-dark text-sm font-bold text-gray-600 disabled:opacity-30 flex items-center justify-center gap-1">
                      <ChevronLeft size={15} /> Previous
                    </button>
                    <button type="button" onClick={() => goToChapter(1)} disabled={selectedChapter.id >= 114}
                      className="flex-1 py-3 rounded-xl bg-forest text-white text-sm font-bold disabled:opacity-30 flex items-center justify-center gap-1">
                      Next <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>

        ) : (
          /* ════ LIST VIEWS ════ */
          <div className="px-4 py-4 space-y-4">

            {/* Streak banner */}
            <div className="bg-gradient-to-r from-forest to-olive rounded-2xl p-4 flex items-center justify-between text-white batik-overlay">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Flame size={20} /></div>
                <div><p className="text-xs opacity-80">Quran Streak</p><p className="font-extrabold text-lg">{readingStreak} Days</p></div>
              </div>
              <div className="text-right"><p className="text-xs opacity-80">Today</p><p className="font-extrabold text-lg">{todayReadCount} Sessions</p></div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {([
                { key: 'surah-list' as ViewMode, icon: BookOpen, label: 'Surah' },
                { key: 'juz-list'   as ViewMode, icon: List,     label: 'Juz' },
                { key: 'bookmarks' as ViewMode, icon: Bookmark, label: 'Saved' },
                { key: 'search'    as ViewMode, icon: Search,   label: 'Search' },
                { key: 'khatam'    as ViewMode, icon: Users,  label: "Qur'anther" },
              ] as const).map(tab => (
                <button key={tab.key} type="button" onClick={() => setView(tab.key)}
                  className={`flex-shrink-0 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-colors ${
                    view === tab.key ? 'bg-forest text-white' : 'bg-white text-gray-500 border border-cream-dark'
                  }`}>
                  <tab.icon size={12} />{tab.label}
                </button>
              ))}
            </div>

            {/* Surah list */}
            {view === 'surah-list' && (
              loadingChapters
                ? <QuranLoadingBlock />
                : (
                  <div className="space-y-2">
                    {chapters.map(ch => (
                      <button key={ch.id} type="button" onClick={() => openChapter(ch)}
                        className="w-full bg-white rounded-2xl px-4 py-3.5 border border-cream-dark flex items-center gap-3 hover:border-forest/30 active:bg-cream-light transition-colors text-left">
                        <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-forest">{ch.id}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-gray-800 text-sm">{ch.name_simple}</p>
                            <p className="surah-list-arabic flex-shrink-0">{ch.name_arabic}</p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-gray-400">{ch.revelation_place === 'makkah' ? 'Meccan' : 'Medinan'}</span>
                            <span className="text-[11px] text-gray-300">·</span>
                            <span className="text-[11px] text-gray-400">{ch.verses_count} verses</span>
                            {ch.translated_name && <>
                              <span className="text-[11px] text-gray-300">·</span>
                              <span className="text-[11px] text-gray-500 truncate">{ch.translated_name.name}</span>
                            </>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
            )}

            {/* Juz list */}
            {view === 'juz-list' && (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 30 }, (_, i) => i + 1).map(juz => (
                  <button key={juz} type="button" onClick={() => openJuz(juz)}
                    className="bg-white rounded-2xl p-4 border border-cream-dark hover:border-forest/30 active:bg-cream-light transition-colors text-center">
                    <p className="text-2xl font-extrabold text-forest">{juz}</p>
                    <p className="text-xs text-gray-500 mt-1">Juz {juz}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Bookmarks */}
            {view === 'bookmarks' && (
              bookmarkItems.length === 0
                ? (
                  <div className="text-center py-16">
                    <Bookmark size={48} className="text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-500 font-bold">No bookmarks yet</p>
                    <p className="text-sm text-gray-400 mt-1">Tap the bookmark icon on any verse to save it</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookmarkItems.map(bm => (
                      <div key={bm.id}
                        className="w-full bg-white rounded-2xl p-4 border border-cream-dark">
                        <div className="flex items-center justify-between mb-2">
                          <button type="button"
                            onClick={() => {
                              const ch = chapters.find(c => c.id === bm.chapter_number);
                              if (ch) openChapter(ch, bm.verse_key);
                            }}
                            className="flex items-center gap-2 text-left">
                            <BookmarkCheck size={13} className="text-gold" />
                            <span className="text-xs font-bold text-forest">{bm.surah_name} · Verse {bm.verse_number}</span>
                          </button>
                          <button type="button" title="Remove bookmark"
                            onClick={async () => { await supabase.from('quran_bookmarks').delete().eq('id', bm.id); loadBookmarks(); }}
                            className="text-gray-300 hover:text-red-400 transition-colors"><X size={13} /></button>
                        </div>
                        <div
                          className="cursor-pointer"
                          onClick={() => {
                            const ch = chapters.find(c => c.id === bm.chapter_number);
                            if (ch) openChapter(ch, bm.verse_key);
                          }}
                        >
                          {bm.text_uthmani && <p className="bookmark-arabic text-gray-800 mb-2">{bm.text_uthmani}</p>}
                          <p className="text-xs text-gray-500 line-clamp-2">{bm.translation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
            )}

            {/* Search */}
            {view === 'search' && (
              <>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Surah name, verse, Arabic, or topic..."
                    className="flex-1 rounded-xl border border-cream-dark bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
                  <button type="submit" disabled={searching}
                    className="px-4 rounded-xl bg-forest text-white font-bold text-sm disabled:opacity-50">
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search size={18} />}
                  </button>
                </form>
                {/* Surah matched — show ayah number picker */}
                {searchSurah && (
                  <div className="bg-white rounded-2xl border border-cream-dark p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-800 text-sm">Surah found</p>
                        <p className="text-xs text-gray-400">{searchSurah.total} verses total</p>
                      </div>
                      <span className="bg-forest text-white text-xs font-bold px-3 py-1 rounded-full">
                        {searchSurah.num}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={searchSurah.total}
                        value={surahAyahInput}
                        onChange={e => setSurahAyahInput(e.target.value)}
                        placeholder={`Ayah 1–${searchSurah.total}`}
                        className="flex-1 rounded-xl border border-cream-dark bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                      />
                      <button type="button"
                        onClick={() => {
                          const ayah = parseInt(surahAyahInput, 10);
                          const ch = chapters.find(c => c.id === searchSurah.num);
                          if (ch) {
                            const key = ayah >= 1 && ayah <= searchSurah.total ? `${searchSurah.num}:${ayah}` : undefined;
                            openChapter(ch, key);
                          }
                        }}
                        className="px-4 rounded-xl bg-forest text-white font-bold text-sm">
                        Go
                      </button>
                    </div>
                    <button type="button"
                      onClick={() => {
                        const ch = chapters.find(c => c.id === searchSurah.num);
                        if (ch) openChapter(ch);
                      }}
                      className="w-full text-xs text-forest font-bold py-1 active:opacity-60">
                      Open full surah →
                    </button>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">{searchResults.length} results</p>
                    {searchResults.map((r, i) => (
                      <button key={i} type="button"
                        onClick={() => {
                          const [chap] = r.verse_key.split(':').map(Number);
                          const ch = chapters.find(c => c.id === chap);
                          if (ch) openChapter(ch, r.verse_key);
                        }}
                        className="w-full bg-white rounded-2xl p-4 border border-cream-dark text-left">
                        <span className="text-xs font-bold text-forest mb-1 block">{r.verse_key}</span>
                        {r.text && <p className="quran-tajweed text-base mb-1 line-clamp-2" dir="rtl">{r.text}</p>}
                        {r.translations?.[0]?.text && (
                          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{r.translations[0].text}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {!searching && searchResults.length === 0 && !searchSurah && searchQuery && (
                  <div className="text-center py-12">
                    <Search size={40} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No results found</p>
                    <p className="text-gray-300 text-xs mt-1">Try a surah name (e.g. &ldquo;Baqarah&rdquo;) or a topic</p>
                  </div>
                )}
              </>
            )}

            {/* ── Qur'anther ── */}
            {view === 'khatam' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-800">Qur'anther</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Complete the Quran together as a family</p>
                </div>

                {khatamLoading ? (
                  <QuranLoadingBlock />
                ) : khatamSession?.status === 'active' ? (
                  <>
                    {/* Progress overview */}
                    <div className="bg-gradient-to-r from-forest to-olive rounded-2xl p-4 text-white batik-overlay">
                      <p className="text-xs opacity-70 font-bold uppercase tracking-widest mb-1">Family Progress</p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-extrabold">{khatamAssignments.filter(a => a.completed).length}<span className="text-lg opacity-60">/30</span></p>
                          <p className="text-xs opacity-60">juz completed</p>
                        </div>
                        <p className="text-4xl font-extrabold opacity-90">
                          {Math.round((khatamAssignments.filter(a => a.completed).length / 30) * 100)}%
                        </p>
                      </div>
                      <div className="w-full h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
                        <div className="h-full bg-gold rounded-full transition-all"
                          style={{ width: `${(khatamAssignments.filter(a => a.completed).length / 30) * 100}%` }} />
                      </div>
                    </div>

                    {/* My assignments */}
                    {myAssignments.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">My Assignments</p>
                        <div className="space-y-2">
                          {myAssignments.map(a => (
                            <div key={a.id} className={`bg-white rounded-2xl px-4 py-3 border flex items-center gap-3 ${a.completed ? 'border-forest/30 bg-forest/5' : 'border-cream-dark'}`}>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.completed ? 'bg-forest text-white' : 'bg-forest/10 text-forest'}`}>
                                {a.completed ? <Check size={18} /> : <span className="font-extrabold text-sm">{a.juz_number}</span>}
                              </div>
                              <div className="flex-1">
                                <p className={`font-bold text-sm ${a.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>Juz {a.juz_number}</p>
                                {a.completed && <p className="text-[10px] text-forest/70 font-bold">Completed</p>}
                              </div>
                              {!a.completed && (
                                <div className="flex gap-2 flex-shrink-0">
                                  <button type="button" onClick={() => openJuz(a.juz_number)}
                                    className="px-3 py-1.5 rounded-xl bg-forest/10 text-forest text-xs font-bold">
                                    Read
                                  </button>
                                  <button type="button" onClick={() => markJuzComplete(a.id)}
                                    className="px-3 py-1.5 rounded-xl bg-forest text-white text-xs font-bold">
                                    Done
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All 30 juz grid */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">All 30 Juz</p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {Array.from({ length: 30 }, (_, i) => i + 1).map(jn => {
                          const a = khatamAssignments.find(x => x.juz_number === jn);
                          const isMe = a?.user_id === user?.id;
                          return (
                            <div key={jn} title={a?.member_name}
                              className={`aspect-square rounded-xl flex items-center justify-center text-xs font-extrabold transition-all ${
                                a?.completed ? 'bg-forest text-white' :
                                isMe ? 'bg-forest/20 text-forest border-2 border-forest/40' :
                                'bg-white border border-cream-dark text-gray-500'
                              }`}>
                              {jn}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-forest" /><span>Done</span></div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-forest/20 border border-forest/40" /><span>Mine</span></div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-white border border-cream-dark" /><span>Others</span></div>
                      </div>
                    </div>

                    {/* Per-member breakdown */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Member Progress</p>
                      {(() => {
                        const memberMap = new Map<string, { name: string; total: number; done: number }>();
                        for (const a of khatamAssignments) {
                          const prev = memberMap.get(a.user_id) ?? { name: a.member_name ?? 'Member', total: 0, done: 0 };
                          memberMap.set(a.user_id, { ...prev, total: prev.total + 1, done: prev.done + (a.completed ? 1 : 0) });
                        }
                        return [...memberMap.entries()].map(([uid, info]) => (
                          <div key={uid} className="bg-white rounded-2xl px-4 py-3 border border-cream-dark flex items-center gap-3 mb-2">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold ${uid === user?.id ? 'bg-forest text-white' : 'bg-forest/10 text-forest'}`}>
                              {info.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-gray-800">{info.name}{uid === user?.id ? ' (you)' : ''}</p>
                              <div className="w-full h-1.5 bg-cream-dark rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-forest rounded-full" style={{ width: `${(info.done / info.total) * 100}%` }} />
                              </div>
                            </div>
                            <span className="text-sm font-extrabold text-forest flex-shrink-0">{info.done}/{info.total}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                ) : (
                  /* Voting / No session */
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-cream-dark p-5 text-center">
                      <div className="w-14 h-14 rounded-full bg-forest/10 flex items-center justify-center mx-auto mb-3">
                        <Users size={26} className="text-forest" />
                      </div>
                      <h3 className="font-extrabold text-gray-800 text-lg">Start Qur'anther</h3>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                        When all family members agree, 30 juz are distributed evenly. Together your family completes the full Quran!
                      </p>
                    </div>

                    {/* Vote button */}
                    <div className="bg-white rounded-2xl border border-cream-dark p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-bold text-gray-700 text-sm">Votes to start</p>
                        <span className="text-sm font-extrabold text-forest">{khatamVotes.length}/{familyMemberCount}</span>
                      </div>
                      <div className="w-full h-2 bg-cream-dark rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-forest rounded-full transition-all"
                          style={{ width: familyMemberCount > 0 ? `${(khatamVotes.length / familyMemberCount) * 100}%` : '0%' }} />
                      </div>
                      <button type="button"
                        onClick={handleVote}
                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                          khatamVotes.some(v => v.user_id === user?.id)
                            ? 'bg-forest/10 text-forest border border-forest/30'
                            : 'bg-forest text-white'
                        }`}>
                        {khatamVotes.some(v => v.user_id === user?.id)
                          ? <><Check size={15} /> You&apos;ve voted — tap to cancel</>
                          : <><ThumbsUp size={15} /> I&apos;m Ready to Start!</>
                        }
                      </button>
                      <p className="text-[11px] text-gray-400 text-center mt-2">
                        Qur&apos;anther starts when all {familyMemberCount} member{familyMemberCount > 1 ? 's' : ''} vote
                      </p>
                      {profile?.role === 'parent' && (
                        <button type="button"
                          onClick={startKhatam}
                          className="mt-3 w-full py-2.5 rounded-xl border-2 border-forest/40 text-forest text-sm font-bold flex items-center justify-center gap-2 hover:bg-forest/5 transition-colors">
                          Force Start (Guardian Override)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ FLOATING AUDIO PLAYER ════ */}
        {(isPlaying || playingVerseKey) && (
          <div className="fixed bottom-20 left-4 right-4 z-50">
            <div className="bg-forest rounded-2xl shadow-2xl overflow-hidden batik-overlay">
              <div className="h-1 bg-white/20">
                <div className="h-full bg-gold transition-none" style={{ width: `${audioProgress * 100}%` }} />
              </div>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">
                    {selectedChapter?.name_simple ?? `Juz ${selectedJuz}`}
                    {playingVerseKey ? ` · Verse ${playingVerseKey.split(':')[1]}` : ''}
                  </p>
                  <p className="text-white/50 text-[10px]">Mishari Rashid al-Afasy</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button type="button" title={isPlaying ? 'Pause' : 'Play'} onClick={togglePlayPause}
                    className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-forest">
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button type="button" title="Close player" onClick={stopAudio}
                    className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
