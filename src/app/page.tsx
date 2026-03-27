'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getDailyMission, completeMission, hasCompletedDailyMission,
  getFamilyPoints, uploadProofImage,
  DailyMission,
} from '@/lib/store';
import { BookOpen, CheckCircle, Diamond, ArrowUpRight, ImageIcon, ChevronRight, Star, Loader2, Play, Pause, Volume2 } from 'lucide-react';
import LoadingBlock from '@/components/LoadingBlock';
import Link from 'next/link';
import { useSwipeDown } from '@/hooks/useSwipeDown';

interface VerseOfDay {
  verse_key: string;
  text_arabic: string;
  translation: string;
  surah_name: string;
  ayah_number: string;
}

const HIJRI_MONTHS = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

function gregorianToHijri(date: Date): { day: number; month: number; year: number; monthName: string } {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const jd = Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4)
    + Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12)
    - Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4)
    + d - 32075;
  const l = jd - 1948440 + 10632, n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719)
    + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, month, year, monthName: HIJRI_MONTHS[month - 1] ?? '' };
}

function getDailyVerseKey(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekOfYear = Math.floor((+now - +new Date(now.getFullYear(), 0, 1)) / 604800000);
  const THEMES: Record<number, string[]> = {
    0: ['2:255','65:3','3:173','4:81','8:2','58:22','67:1'],
    1: ['14:7','55:13','93:11','2:152','27:19','17:3','76:9'],
    2: ['4:103','20:14','29:45','2:45','23:1','17:78','62:9'],
    3: ['31:14','17:23','17:24','3:103','49:10','4:36','9:128'],
    4: ['2:153','3:200','2:177','3:139','39:10','16:127','70:5'],
    5: ['2:261','57:7','76:8','2:177','93:9','64:16','3:92'],
    6: ['47:24','4:82','38:29','96:1','73:4','17:9','59:21'],
  };
  const pool = THEMES[dayOfWeek] ?? THEMES[0];
  return pool[weekOfYear % pool.length];
}

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function PrayerTimesCard() {
  const [times, setTimes] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        fetch(`https://api.aladhan.com/v1/timings/${today}?latitude=${latitude}&longitude=${longitude}&method=2`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.data?.timings) setTimes(d.data.timings); })
          .catch(() => {});
      },
      () => {}
    );
  }, []);

  if (!times) return null;

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nextIdx = PRAYER_NAMES.findIndex(p => {
    const [h, m] = (times[p] || '00:00').split(':').map(Number);
    return h * 60 + m > nowMin;
  });
  const nextPrayer = PRAYER_NAMES[nextIdx];
  const nextTime = nextPrayer ? (times[nextPrayer] || '').slice(0, 5) : '';

  return (
    <div className="mx-4 mt-4">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-black/[0.06]">
        {nextPrayer && (
          <div className="bg-[#2d3a10] px-4 py-2.5 flex items-center justify-between batik-overlay">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#5a6b28] animate-pulse" />
              <span className="text-white text-xs font-bold">Next: {nextPrayer}</span>
            </div>
            <span className="text-white font-extrabold text-sm tracking-wider">{nextTime}</span>
          </div>
        )}
        <div className="flex divide-x divide-gray-100 px-1 py-3">
          {PRAYER_NAMES.map((p, i) => (
            <div key={p} className={`flex flex-col items-center flex-1 ${i === nextIdx ? 'opacity-100' : 'opacity-55'}`}>
              <span className="text-[8px] font-bold uppercase text-[#2d3a10] tracking-wider">{p}</span>
              <span className="text-[12px] font-extrabold text-gray-800 mt-0.5 tabular-nums">{(times[p] || '--:--').slice(0, 5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, profile, family } = useAuth();
  const [loading, setLoading] = useState(true);
  const [verseOfDay, setVerseOfDay] = useState<VerseOfDay | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const [dailyMission, setDailyMission] = useState<DailyMission | null>(null);
  const [missionCompleted, setMissionCompleted] = useState(false);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [missionError, setMissionError] = useState('');
  const [submittingMission, setSubmittingMission] = useState(false);
  const [familyPoints, setFamilyPoints] = useState(0);
  const [khatamSession, setKhatamSession] = useState<{ status: string; done: number } | null>(null);
  const [hadithOfDay, setHadithOfDay] = useState<{ narrator: string; text: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  // Tafsir + Audio for Verse of Day
  const [tafsirText, setTafsirText] = useState<string | null>(null);
  const [showTafsir, setShowTafsir] = useState(false);
  const [verseAudioUrl, setVerseAudioUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reflectionContentRef = useRef<HTMLDivElement>(null);

  const closeReflectionModal = useCallback(() => {
    setShowReflectionModal(false);
    setMissionError('');
  }, []);
  const reflectionSwipe = useSwipeDown(closeReflectionModal, 80, () => (reflectionContentRef.current?.scrollTop ?? 0) === 0);

  const today = new Date();
  const hijri = gregorianToHijri(today);
  const todayStr = today.toISOString().split('T')[0];
  const gregDay = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Fetch tafsir and audio for a verse key (defined before verse effect)
  const fetchTafsirAndAudio = useCallback(async (verseKey: string) => {
    const tafsirCacheKey = `musfam_tafsir_${verseKey}`;
    const audioCacheKey = `musfam_audio_${verseKey}`;
    // Tafsir — Quran Foundation Tafsir API (Ibn Kathir English, id=169)
    const cachedTafsir = sessionStorage.getItem(tafsirCacheKey);
    if (cachedTafsir) { setTafsirText(cachedTafsir); }
    else {
      fetch(`/api/quran/tafseer?verse_key=${verseKey}&tafsir_id=169`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.text) { const t = d.text.slice(0, 500) + (d.text.length > 500 ? '...' : ''); setTafsirText(t); sessionStorage.setItem(tafsirCacheKey, t); } })
        .catch(() => {});
    }
    // Audio — Quran Foundation Audio API (Mishary Alafasy, reciter=7)
    const cachedAudio = sessionStorage.getItem(audioCacheKey);
    if (cachedAudio) { setVerseAudioUrl(cachedAudio); }
    else {
      fetch(`/api/quran/verse-audio?verse_key=${verseKey}&reciter=7`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.audio_url) { setVerseAudioUrl(d.audio_url); sessionStorage.setItem(audioCacheKey, d.audio_url); } })
        .catch(() => {});
    }
  }, []);

  // Audio play/pause toggle
  const handleAudioToggle = useCallback(() => {
    if (!verseAudioUrl) return;
    if (!audioRef.current) {
      const audio = new Audio(verseAudioUrl);
      audio.onended = () => setAudioPlaying(false);
      audio.onpause = () => setAudioPlaying(false);
      audio.onplay = () => { setAudioPlaying(true); setAudioLoading(false); };
      audio.onwaiting = () => setAudioLoading(true);
      audioRef.current = audio;
    }
    if (audioPlaying) {
      audioRef.current.pause();
    } else {
      setAudioLoading(true);
      audioRef.current.play().catch(() => setAudioLoading(false));
    }
  }, [verseAudioUrl, audioPlaying]);

  // Load verse of day from Quran Foundation API
  useEffect(() => {
    const key = getDailyVerseKey();
    const [chapter, ayah] = key.split(':');
    const cacheKey = `musfam_vod_${key}_${todayStr}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setVerseOfDay(JSON.parse(cached));
        setVerseLoading(false);
        fetchTafsirAndAudio(key); // also load tafsir+audio for cached verse
        return;
      } catch {/* ignore */}
    }
    Promise.all([
      fetch(`/api/quran/verses?chapter=${chapter}&per_page=300`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.alquran.cloud/v1/surah/${chapter}`).then(r => r.ok ? r.json() : null),
    ]).then(([data, surahData]) => {
      const surahName = surahData?.data?.englishName || `Surah ${chapter}`;
      if (data?.verses) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = data.verses.find((x: any) => x.verse_key === key);
        if (v) {
          const vod: VerseOfDay = { verse_key: key, text_arabic: v.text_uthmani || '', translation: v.translation || '', surah_name: surahName, ayah_number: ayah };
          setVerseOfDay(vod);
          sessionStorage.setItem(cacheKey, JSON.stringify(vod));
          fetchTafsirAndAudio(key);
        }
      }
      setVerseLoading(false);
    }).catch(() => setVerseLoading(false));
  }, [todayStr, fetchTafsirAndAudio]);

  // Load hadith of day
  useEffect(() => {
    const cacheKey = `hadith_${todayStr}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { try { setHadithOfDay(JSON.parse(cached)); return; } catch {/* ignore */} }
    fetch('https://random-hadith-generator.vercel.app/bukhari/')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data) {
          const h = { narrator: data.data.header || 'Sahih al-Bukhari', text: data.data.hadith_english || '' };
          if (h.text) { setHadithOfDay(h); sessionStorage.setItem(cacheKey, JSON.stringify(h)); }
        }
      }).catch(() => {});
  }, [todayStr]);

  // Load mission, points, khatam
  useEffect(() => {
    if (!family || !user) { setLoading(false); return; }
    const verseKey = getDailyVerseKey();
    Promise.all([
      getDailyMission(family.id, todayStr, verseKey),
      hasCompletedDailyMission(user.id, family.id, todayStr),
      getFamilyPoints(family.id),
    ]).then(([m, done, pts]) => {
      setDailyMission(m);
      setMissionCompleted(done);
      setFamilyPoints(pts);
      setLoading(false);
    });

    // Count unread messages
    supabase.from('family_messages').select('id', { count: 'exact', head: true })
      .eq('family_id', family.id)
      .neq('user_id', user.id)
      .then(({ count }) => setUnreadCount(count || 0));

    // Khatam
    supabase.from('khatam_sessions').select('id, status').eq('family_id', family.id).in('status', ['active', 'voting']).maybeSingle()
      .then(({ data }) => {
        if (data?.status === 'active') {
          supabase.from('khatam_assignments').select('completed').eq('session_id', data.id)
            .then(({ data: assigns }) => {
              const done = (assigns || []).filter((a: { completed: boolean }) => a.completed).length;
              setKhatamSession({ status: 'active', done });
            });
        } else if (data?.status === 'voting') {
          setKhatamSession({ status: 'voting', done: 0 });
        } else {
          setKhatamSession(null);
        }
      });
  }, [family, user, todayStr]);

  async function handleCompleteMission() {
    if (!user || !family || !dailyMission) return;
    setMissionError('');
    setSubmittingMission(true);
    let finalProof = proofNote;
    if (proofFile) {
      setUploadingProof(true);
      const url = await uploadProofImage(proofFile, user.id);
      setUploadingProof(false);
      if (url) finalProof = url;
    }
    const finalReflection = finalProof.trim() ? `[Proof: ${finalProof.trim()}] ${reflectionText}` : reflectionText;
    const result = await completeMission(user.id, family.id, dailyMission.id, finalReflection, profile?.name, profile?.role);
    if (result) {
      setMissionCompleted(true);
      setShowReflectionModal(false);
      setReflectionText('');
      setProofNote('');
      setProofFile(null);
    } else {
      setMissionError('Already completed today, or reflection is too short (min 10 characters).');
    }
    setSubmittingMission(false);
  }

  if (loading) return <LoadingBlock fullScreen />;

  const greetingHour = today.getHours();
  const greeting = greetingHour < 12 ? 'Sabahul Khair 🌅' : greetingHour < 17 ? 'Assalamu Alaikum ☀️' : 'Masa\'ul Khair 🌙';
  const auraLevel = familyPoints >= 5000 ? 'Black' : familyPoints >= 1500 ? 'Platinum' : familyPoints >= 500 ? 'Gold' : 'Silver';

  return (
    <>
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 bg-[#F7F5F0]">

        {/* ─── Hero Header Card ─── */}
        <div className="mx-4 mt-4">
          <div className="rounded-[24px] overflow-hidden shadow-lg batik-overlay relative"
            style={{ background: 'linear-gradient(145deg, #1a2508 0%, #2d3a10 50%, #3d4e18 100%)' }}>
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full"
              style={{ background: 'rgba(200,168,75,0.07)' }} />
            <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full"
              style={{ background: 'rgba(90,107,40,0.15)' }} />

            <div className="relative px-5 pt-5 pb-5">
              {/* Hijri date */}
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(200,168,75,0.7)' }}>
                {hijri.day} {hijri.monthName} {hijri.year}H
              </p>
              <p className="text-xs mb-4" style={{ color: 'rgba(245,240,232,0.4)' }}>{gregDay}</p>

              {/* Greeting */}
              <p className="text-white/60 text-sm font-medium">{greeting}</p>
              <p className="text-white font-extrabold text-[26px] leading-tight mt-0.5">
                {profile?.name?.split(' ')[0] || 'Dear Family'} 👋
              </p>

              {/* AP Badge */}
              <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center gap-2 rounded-full px-4 py-2"
                  style={{ background: 'rgba(200,168,75,0.15)', border: '1px solid rgba(200,168,75,0.3)' }}>
                  <Diamond size={14} style={{ color: '#c8a84b' }} />
                  <span className="font-extrabold text-sm" style={{ color: '#c8a84b' }}>
                    {familyPoints.toLocaleString()} Aura Pts
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <Star size={12} className="text-white/60" />
                  <span className="text-[11px] font-bold text-white/70">{auraLevel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Khatam Progress ─── */}
        {khatamSession && (
          <div className="mx-4 mt-4">
            <Link href="/quran?tab=khatam">
              <div className="bg-white border border-black/[0.06] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#2d3a10] flex items-center justify-center flex-shrink-0">
                  <BookOpen size={18} className="text-[#c8a84b]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800">Khatam al-Quran</p>
                  <p className="text-xs text-gray-500">
                    {khatamSession.status === 'voting' ? 'Vote for the next Khatam session!' : `${khatamSession.done} juz completed`}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </div>
            </Link>
          </div>
        )}

        {/* ─── Prayer Times ─── */}
        <PrayerTimesCard />

        {/* ─── Verse of the Day ─── */}
        <div className="mx-4 mt-4">
          <p className="text-[10px] font-bold text-[#2d3a10]/50 uppercase tracking-widest mb-2">Verse of the Day</p>
          {verseLoading ? (
            <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-sm">
              <div className="h-6 w-3/4 bg-gray-100 rounded-lg animate-pulse mx-auto mb-3" />
              <div className="h-4 w-1/2 bg-gray-100 rounded-lg animate-pulse mx-auto" />
            </div>
          ) : verseOfDay ? (
            <div className="rounded-2xl overflow-hidden shadow-sm border border-[#2d3a10]/10 batik-overlay"
              style={{ background: 'linear-gradient(160deg, #2d3a10 0%, #3d4e18 100%)' }}>
              <div className="px-5 py-4">
                {/* Header: surah ref + open + audio */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(200,168,75,0.7)' }}>
                    {verseOfDay.surah_name} {verseOfDay.verse_key}
                  </p>
                  <div className="flex items-center gap-2">
                    {/* Audio play button — QF Audio API */}
                    {verseAudioUrl && (
                      <button
                        type="button"
                        onClick={handleAudioToggle}
                        title={audioPlaying ? 'Pause recitation' : 'Play recitation (Mishary Alafasy)'}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                        style={{ background: audioPlaying ? 'rgba(200,168,75,0.3)' : 'rgba(255,255,255,0.1)' }}
                      >
                        {audioLoading
                          ? <Loader2 size={13} className="animate-spin" style={{ color: '#c8a84b' }} />
                          : audioPlaying
                            ? <Pause size={13} style={{ color: '#c8a84b' }} />
                            : <Play size={13} style={{ color: '#c8a84b' }} />
                        }
                      </button>
                    )}
                    <Link href="/quran" className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors">
                      <span className="text-[10px] font-bold">Open</span>
                      <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>

                {/* Arabic text */}
                <p className="text-right text-lg leading-[2.2] text-white mb-3"
                  style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>
                  {verseOfDay.text_arabic}
                </p>
                <div className="h-px bg-white/10 mb-3" />

                {/* Translation */}
                <p className="text-white/60 text-xs italic leading-relaxed">
                  &ldquo;{verseOfDay.translation}&rdquo;
                </p>

                {/* Tafsir toggle — QF Tafsir API */}
                {tafsirText && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setShowTafsir(s => !s)}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors"
                      style={{ color: showTafsir ? '#c8a84b' : 'rgba(200,168,75,0.5)' }}
                    >
                      <Volume2 size={10} />
                      {showTafsir ? 'Hide Tafsir' : 'Ibn Kathir Commentary'}
                    </button>
                    {showTafsir && (
                      <div className="mt-2 rounded-xl p-3" style={{ background: 'rgba(200,168,75,0.08)', border: '1px solid rgba(200,168,75,0.15)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(200,168,75,0.6)' }}>
                          Tafsir Ibn Kathir
                        </p>
                        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(245,240,232,0.75)' }}>
                          {tafsirText}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* ─── Daily Mission ─── */}
        {dailyMission && (
          <div className="mx-4 mt-4">
            <p className="text-[10px] font-bold text-[#2d3a10]/50 uppercase tracking-widest mb-2">Today&apos;s Mission</p>
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
              <div className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2d3a10]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Star size={18} style={{ color: '#2d3a10' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {dailyMission.parent_override_text || dailyMission.generated_text}
                    </p>
                    {(dailyMission.parent_override_prompt || dailyMission.generated_text) && (
                      <p className="text-[11px] text-[#2d3a10] font-medium mt-1 italic">
                        💭 {dailyMission.parent_override_prompt || 'What lessons did you reflect on today?'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  {missionCompleted ? (
                    <div className="flex items-center gap-2 bg-green-50 rounded-xl px-4 py-2.5">
                      <CheckCircle size={16} className="text-green-600" />
                      <p className="text-sm font-bold text-green-700">Mission completed! Alhamdulillah 🌟</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowReflectionModal(true)}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                      style={{ background: 'linear-gradient(135deg, #2d3a10 0%, #5a6b28 100%)' }}
                    >
                      Complete Mission · +10 AP
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ─── Hadith of Day ─── */}
        {hadithOfDay && (
          <div className="mx-4 mt-4 mb-2">
            <p className="text-[10px] font-bold text-[#2d3a10]/50 uppercase tracking-widest mb-2">Hadith of the Day</p>
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm px-5 py-4">
              <p className="text-[10px] font-bold text-[#2d3a10]/60 uppercase tracking-wider mb-2">
                📿 {hadithOfDay.narrator}
              </p>
              <p className="text-sm text-gray-700 italic leading-relaxed line-clamp-4">
                &ldquo;{hadithOfDay.text}&rdquo;
              </p>
            </div>
          </div>
        )}

      </main>

      {/* ─── Reflection / Mission Complete Modal ─── */}
      {showReflectionModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div
            ref={ref => { if (reflectionSwipe.sheetRef) reflectionSwipe.sheetRef.current = ref; }}
            onTouchStart={reflectionSwipe.handleTouchStart}
            onTouchMove={reflectionSwipe.handleTouchMove}
            onTouchEnd={reflectionSwipe.handleTouchEnd}
            className="bg-white rounded-t-3xl w-full max-w-md flex flex-col"
            style={{ maxHeight: '88vh' }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-extrabold text-gray-800">Complete Mission</h3>
              <button type="button" onClick={closeReflectionModal}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-gray-500 text-sm">✕</span>
              </button>
            </div>

            <div ref={reflectionContentRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {missionError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{missionError}</div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Mission</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
                  {dailyMission?.parent_override_text || dailyMission?.generated_text}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Your Reflection <span className="font-normal normal-case text-gray-300">(min. 10 chars)</span>
                </p>
                <textarea
                  value={reflectionText}
                  onChange={e => setReflectionText(e.target.value)}
                  placeholder="Share your reflection..."
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 p-4 text-sm focus:ring-2 focus:ring-[#2d3a10]/20 focus:border-[#2d3a10] outline-none resize-none"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Proof (Optional)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={proofNote}
                    onChange={e => setProofNote(e.target.value)}
                    placeholder="URL or description..."
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none"
                  />
                  <label className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors flex-shrink-0">
                    {uploadingProof ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <ImageIcon size={16} className="text-gray-400" />}
                    <input type="file" accept="image/*" className="sr-only" onChange={e => setProofFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                {proofFile && <p className="text-[10px] text-gray-400 mt-1">📎 {proofFile.name}</p>}
              </div>
            </div>

            <div className="px-5 pb-8 pt-3 flex-shrink-0 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCompleteMission}
                disabled={submittingMission || reflectionText.trim().length < 10}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #2d3a10 0%, #5a6b28 100%)' }}
              >
                {submittingMission ? <Loader2 size={18} className="animate-spin" /> : <>Submit · +10 AP 🌟</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
