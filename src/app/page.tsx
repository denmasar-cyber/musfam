'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getDailyMission, completeMission, hasCompletedDailyMission,
  getFamilyPoints, uploadProofImage,
  getMissions, getRewards, completeCustomMission, isMissionCompletedToday, getTodayCompletions,
  getPendingApprovals, approveCompletion, rejectCompletion, getRejectedCompletions,
  DailyMission, PendingApproval,
} from '@/lib/store';
import type { Mission, Reward } from '@/lib/types';
import { BookOpen, CheckCircle, Diamond, ArrowUpRight, ImageIcon, ChevronRight, Star, Loader2, Play, Pause, Volume2, Trophy, Gift, Check, Clock, AlertCircle, XCircle, ThumbsUp, ThumbsDown, Plus, Trash2 } from 'lucide-react';
import LoadingBlock from '@/components/LoadingBlock';
import Link from 'next/link';
import { useSwipeDown } from '@/hooks/useSwipeDown';

// Map Lucide icon name strings (stored in DB by old control page) → emoji
const LUCIDE_ICON_EMOJI: Record<string, string> = {
  'sparkles': '✨', 'home': '🏠', 'book-open': '📖', 'activity': '🏃',
  'check-circle': '✅', 'gift': '🎁', 'sun': '☀️', 'alert-circle': '⚠️',
  'star': '⭐', 'heart': '❤️', 'moon': '🌙', 'book': '📚', 'pray': '🤲',
};

// Resolve icon field → either a data URL, an emoji string, or null (use category dot)
function resolveIcon(icon: string | undefined | null): { type: 'image'; src: string } | { type: 'emoji'; char: string } | { type: 'dot' } {
  if (!icon) return { type: 'dot' };
  if (icon.startsWith('data:')) return { type: 'image', src: icon };
  if (LUCIDE_ICON_EMOJI[icon]) return { type: 'emoji', char: LUCIDE_ICON_EMOJI[icon] };
  // Check if it's a real emoji character (not a plain ASCII word)
  const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u;
  if (emojiRegex.test(icon)) return { type: 'emoji', char: icon };
  return { type: 'dot' };
}

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
const SURAH_NAMES_HOME: Record<number, string> = {
  1:'Al-Fatihah',2:'Al-Baqarah',3:'Al-Imran',4:'An-Nisa',13:'Ar-Ra\'d',14:'Ibrahim',
  17:'Al-Isra',18:'Al-Kahf',29:'Al-Ankabut',33:'Al-Ahzab',39:'Az-Zumar',55:'Ar-Rahman',
  59:'Al-Hashr',64:'At-Taghaabun',65:'At-Talaq',73:'Al-Muzzammil',76:'Al-Insan',
  93:'Ad-Duha',94:'Al-Inshirah',96:'Al-Alaq',
};
function fmtVerseRef(key: string) {
  const [ch, ay] = key.split(':');
  const name = SURAH_NAMES_HOME[parseInt(ch)] || 'Surah ' + ch;
  return `${name} ${ch}:${ay}`;
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
  const [reflectingCustomMission, setReflectingCustomMission] = useState<Mission | null>(null);
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
  // Dashboard tabs
  type DashTab = 'missions' | 'aura';
  const [dashTab, setDashTab] = useState<DashTab>('missions');
  // Custom missions + rewards for dashboard
  const [customMissions, setCustomMissions] = useState<Mission[]>([]);
  const [completedCustomIds, setCompletedCustomIds] = useState<Set<string>>(new Set());
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [myPoints, setMyPoints] = useState(0);
  const [memberPoints, setMemberPoints] = useState<Record<string, number>>({});
  // Aura board
  const [familyAuraBoard, setFamilyAuraBoard] = useState<{ id: string; name: string; pts: number; isMe: boolean }[]>([]);
  const [familyBoardByFamily, setFamilyBoardByFamily] = useState<{ family_id: string; family_name: string; total_points: number; rank: number }[]>([]);
  const [auraLoading, setAuraLoading] = useState(false);
  const [auraSubTab, setAuraSubTab] = useState<'members' | 'families'>('members');
  // Parent: Add Mission
  const [showAddMission, setShowAddMission] = useState(false);
  const [newMissionClass, setNewMissionClass] = useState<'general' | 'specific'>('general');
  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [newMissionCat, setNewMissionCat] = useState<Mission['category']>('spiritual');
  const [newMissionPoints, setNewMissionPoints] = useState('50');
  const [newMissionVisible, setNewMissionVisible] = useState(true);
  const [newMissionAssignTo, setNewMissionAssignTo] = useState<string>('');
  const [newMissionIcon, setNewMissionIcon] = useState('📖');
  const [addingMission, setAddingMission] = useState(false);
  // Parent: Add Reward
  const [showAddReward, setShowAddReward] = useState(false);
  const [newRewardClass, setNewRewardClass] = useState<'general' | 'specific'>('general');
  const [newRewardIcon, setNewRewardIcon] = useState('🎁');
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardCost, setNewRewardCost] = useState('150');
  const [newRewardAssignTo, setNewRewardAssignTo] = useState<string>('');
  const [addingReward, setAddingReward] = useState(false);
  // Family members (for assignment dropdown)
  const [familyMembers, setFamilyMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  // Approval system
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [pendingMissionIds, setPendingMissionIds] = useState<Set<string>>(new Set()); // child: awaiting approval
  const [rejectedMissionIds, setRejectedMissionIds] = useState<Set<string>>(new Set()); // child: rejected
  const [approvingId, setApprovingId] = useState<string | null>(null);
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
    setReflectingCustomMission(null);
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

  // ── Load + live-sync missions, rewards, points ────────────────────────────
  useEffect(() => {
    if (!family || !user || !profile) return;

    async function loadAll() {
      const [all, rewards_all] = await Promise.all([
        getMissions(family!.id),
        getRewards(family!.id),
      ]);

      // Missions visible to this user
      const visible = profile!.role === 'parent'
        ? all
        : all.filter((m: Mission) =>
            m.visible_to_child !== false &&
            (!m.assigned_to || m.assigned_to === user!.id)
          );
      setCustomMissions(visible);

      // Rewards visible to this user
      const visibleRewards = profile!.role === 'parent'
        ? rewards_all
        : rewards_all.filter((r: Reward) =>
            r.visible_to_child !== false &&
            (!r.assigned_to || r.assigned_to === user!.id)
          );
      setRewards(visibleRewards);

      // Completion status
      const completedSet = new Set<string>();
      const pendingSet = new Set<string>();
      const rejectedSet = new Set<string>();

      if (profile!.role === 'parent') {
        const todayC = await getTodayCompletions(family!.id);
        const doneCustom = new Set<string>();
        let isDailyDone = false;
        todayC.forEach((c: any) => {
          if (c.user_id === user!.id && c.status === 'approved') {
            if (c.mission_id) doneCustom.add(c.mission_id);
            if (c.daily_mission_id && dailyMission && c.daily_mission_id === dailyMission.id) isDailyDone = true;
          }
        });
        setCompletedCustomIds(doneCustom);
        setMissionCompleted(isDailyDone);
        const pending = await getPendingApprovals(family!.id);
        setPendingApprovals(pending);
      } else {
        const todayC = await getTodayCompletions(family!.id);
        const doneCustom = new Set<string>();
        const pSet = new Set<string>();
        const rSet = new Set<string>();
        let isDailyDone = false;

        todayC.forEach((c: any) => {
          // IMPORTANT: Only for THIS specific user
          if (c.user_id === user!.id) {
            const mId = c.mission_id || c.daily_mission_id;
            if (!mId) return;

            if (c.status === 'approved') {
              if (c.mission_id) doneCustom.add(c.mission_id);
              if (c.daily_mission_id && dailyMission && c.daily_mission_id === dailyMission.id) isDailyDone = true;
            } else if (c.status === 'pending') {
              pSet.add(mId);
            } else if (c.status === 'rejected') {
              rSet.add(mId);
            }
          }
        });
        setCompletedCustomIds(doneCustom);
        setMissionCompleted(isDailyDone);
        setPendingMissionIds(pSet);
        setRejectedMissionIds(rSet);
      }

      // Points
      const { data: ptsData } = await supabase
        .from('points').select('user_id, total_points')
        .eq('family_id', family!.id);
      
      let famSum = 0;
      const ptsMap: Record<string, number> = {};
      if (ptsData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ptsData.forEach((p: any) => { 
          const val = p.total_points || 0;
          ptsMap[p.user_id] = val; 
          famSum += val;
        });
      }
      setMemberPoints(ptsMap);
      setMyPoints(ptsMap[user!.id] || 0);
      setFamilyPoints(famSum);

      // --- NEW: Also update Aura Board (Members) in real-time ---
      const memberIds = Object.keys(ptsMap);
      if (memberIds.length > 0) {
        // We already have profile/familyMembers, but let's ensure we have names
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', memberIds);
        const board = memberIds.map(mid => ({
          id: mid,
          name: profs?.find(p => p.id === mid)?.name || 'Member',
          pts: ptsMap[mid],
          isMe: mid === user!.id
        })).sort((a, b) => b.pts - a.pts);
        setFamilyAuraBoard(board);
      }

      // --- NEW: Also update Family Leaderboard (Global) in real-time ---
      const { data: allPts } = await supabase.from('points').select('family_id, total_points');
      if (allPts?.length) {
        const totals: Record<string, number> = {};
        allPts.forEach((p: any) => {
          if (p.family_id) totals[p.family_id] = (totals[p.family_id] || 0) + p.total_points;
        });
        const familyIds = Object.keys(totals);
        const { data: fams } = await supabase.from('families').select('id, name').in('id', familyIds);
        const ranked = familyIds.map(fid => ({
          family_id: fid,
          family_name: fams?.find(f => f.id === fid)?.name || 'Family',
          total_points: totals[fid],
          rank: 0
        })).sort((a, b) => b.total_points - a.total_points)
           .map((f, i) => ({ ...f, rank: i + 1 }));
        setFamilyBoardByFamily(ranked);
      }
    }

    loadAll();

    // ── Supabase Realtime: subscribe to mission_completions ──
    // Note: We remove the `filter: family_id=...` because Postgres UPDATE payloads
    // don't include unmodified columns like family_id unless replica identity is full.
    // Instead we rely on RLS to only send us our own events, and just trigger a full reload.
    const channel = supabase
      .channel(`mission_completions_${family.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mission_completions' },
        () => { loadAll(); }
      )
      .subscribe();

    // ── Realtime: missions added/updated/deleted ──
    const missionsChannel = supabase
      .channel(`missions_${family.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions' },
        () => { loadAll(); }
      )
      .subscribe();

    // ── Realtime: rewards added/updated/deleted ──
    const rewardsChannel = supabase
      .channel(`rewards_${family.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rewards' },
        () => { loadAll(); }
      )
      .subscribe();

    // ── Realtime: points updated ──
    const pointsChannel = supabase
      .channel(`points_${family.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'points' },
        () => { loadAll(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(missionsChannel);
      supabase.removeChannel(rewardsChannel);
      supabase.removeChannel(pointsChannel);
    };
  }, [family, user, profile, todayStr]);


  // Load family members (for assignment)
  useEffect(() => {
    if (!family) return;
    supabase.from('profiles').select('id, name, role').eq('family_id', family.id)
      .then(({ data }) => { if (data) setFamilyMembers(data); });
  }, [family]);

  // Board logic is now handled in loadAll() Realtime effect
  useEffect(() => {
    if (dashTab !== 'aura' || !family) return;
    setAuraLoading(false); 
  }, [dashTab, family]);

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

  async function handleCompleteCustomMission() {
    if (!user || !family || !profile || !reflectingCustomMission) return;
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
    const result = await completeCustomMission(user.id, family.id, reflectingCustomMission.id, finalReflection, profile.name, profile.role);
    if (result) {
      if (profile.role === 'child') {
        setPendingMissionIds(prev => new Set([...prev, reflectingCustomMission.id]));
        setRejectedMissionIds(prev => { const n = new Set(prev); n.delete(reflectingCustomMission.id); return n; });
      } else {
        setCompletedCustomIds(prev => new Set([...prev, reflectingCustomMission.id]));
        const { data: pts } = await supabase.from('points').select('total_points').eq('user_id', user.id).eq('family_id', family.id).maybeSingle();
        setMyPoints(pts?.total_points || 0);
      }
      setReflectingCustomMission(null);
      setReflectionText('');
      setProofNote('');
      setProofFile(null);
    } else {
      setMissionError('Submission failed or reflection too short (min 10 chars).');
    }
    setSubmittingMission(false);
  }

  if (loading) return <LoadingBlock fullScreen />;

  const greetingHour = today.getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';
  const auraLevel = familyPoints >= 5000 ? 'Black' : familyPoints >= 1500 ? 'Platinum' : familyPoints >= 500 ? 'Gold' : 'Silver';

  return (
    <>
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 bg-[#F7F5F0]">

        {/* ─── Hero Header Card ─── */}
        <div className="mx-4 mt-4">
          <div className="rounded-[20px] shadow-md batik-overlay relative"
            style={{ background: 'linear-gradient(145deg, #1a2508 0%, #2d3a10 50%, #3d4e18 100%)' }}>
            <div className="relative px-5 py-4 flex items-center justify-between gap-3">
              {/* Left: date + greeting */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: 'rgba(200,168,75,0.7)' }}>
                  {hijri.day} {hijri.monthName} {hijri.year}H
                </p>
                <p className="text-[10px] mb-1.5" style={{ color: 'rgba(245,240,232,0.35)' }}>{gregDay}</p>
                <p className="text-white/60 text-xs font-medium">{greeting}</p>
                <p className="text-white font-extrabold text-[22px] leading-tight">
                  {profile?.name?.split(' ')[0] || 'Dear Family'} 👋
                </p>
              </div>
              {/* Right: Point Badge */}
              <div className="flex flex-col items-end flex-shrink-0">
                <div className="flex items-center gap-1.5 rounded-full px-4 py-2"
                  style={{ background: 'rgba(200,168,75,0.15)', border: '1px solid rgba(200,168,75,0.3)' }}>
                  <Diamond size={14} style={{ color: '#c8a84b' }} />
                  <span className="font-extrabold text-[15px] truncate" style={{ color: '#c8a84b' }}>
                    {familyPoints.toLocaleString()} AP
                  </span>
                </div>
                <p className="text-[9px] font-bold text-[#c8a84b]/60 uppercase tracking-widest mt-1 mr-1">Family Aura</p>
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

        {/* ─── Dashboard: Missions + Aura Board ─── */}
        <div className="mx-4 mt-4">
          <p className="text-[10px] font-bold text-[#2d3a10]/50 uppercase tracking-widest mb-2">Dashboard</p>

          {/* Tab switcher */}
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => setDashTab('missions')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs transition-all"
              style={dashTab === 'missions'
                ? { background: '#2d3a10', color: '#fff' }
                : { background: '#fff', color: '#888', border: '1px solid #e5e5c8' }}>
              <CheckCircle size={13} /> Missions
            </button>
            <button type="button" onClick={() => setDashTab('aura')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs transition-all"
              style={dashTab === 'aura'
                ? { background: '#2d3a10', color: '#fff' }
                : { background: '#fff', color: '#888', border: '1px solid #e5e5c8' }}>
              <Trophy size={13} /> Aura Board
            </button>
          </div>

          {/* ── MISSIONS TAB ── */}
          {dashTab === 'missions' && (
            <div className="space-y-3">
              {/* Daily Quran Mission */}
              {dailyMission && (
                <div className="rounded-2xl overflow-hidden border border-black/[0.06] shadow-sm">
                  <div className="px-4 py-3 batik-overlay" style={{ background: 'linear-gradient(135deg, #2d3a10 0%, #3d4e18 100%)' }}>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">
                      Daily · {fmtVerseRef(dailyMission.verse_key)}
                    </p>
                    <p className="text-white font-semibold text-sm leading-snug">
                      {dailyMission.parent_override_text || dailyMission.generated_text}
                    </p>
                  </div>
                  <div className="bg-white px-4 py-3">
                    {missionCompleted ? (
                      <div className="flex items-center gap-2 py-1">
                        <CheckCircle size={15} className="text-green-600" />
                        <p className="text-sm font-bold text-green-700">Completed! Alhamdulillah 🌟</p>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowReflectionModal(true)}
                        className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #2d3a10 0%, #5a6b28 100%)' }}>
                        <CheckCircle size={14} /> Complete + Reflect
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ─ Parent: Pending Approvals Banner ─ */}
              {profile?.role === 'parent' && pendingApprovals.length > 0 && (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-amber-100 flex items-center gap-2" style={{ background: '#fffbeb' }}>
                    <Clock size={12} className="text-amber-600" />
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Awaiting Your Review</p>
                    <span className="ml-auto text-[10px] font-extrabold text-white bg-amber-500 rounded-full px-2 py-0.5">{pendingApprovals.length}</span>
                  </div>
                  <div className="divide-y divide-amber-50">
                    {pendingApprovals.map(ap => {
                      const mission = customMissions.find(m => m.id === ap.mission_id);
                      return (
                        <div key={ap.id} className="px-4 py-3 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-amber-700">
                            {(ap.submitter_name || 'C')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {mission?.title || 'Mission'}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              Submitted by <span className="font-bold text-amber-700">{ap.submitter_name || 'Child'}</span>
                              {ap.reflection_text && ap.reflection_text !== 'Completed via dashboard' && (
                                <span className="ml-1 text-gray-400">· &ldquo;{ap.reflection_text}&rdquo;</span>
                              )}
                            </p>
                            <p className="text-[10px] text-[#2d3a10] font-bold mt-0.5">+{ap.points_earned} AP upon approval</p>
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <button type="button"
                              disabled={approvingId === ap.id}
                              onClick={async () => {
                                if (!family) return;
                                setApprovingId(ap.id);
                                await approveCompletion(ap.id, ap.user_id, ap.family_id, ap.points_earned);
                                setPendingApprovals(prev => prev.filter(p => p.id !== ap.id));
                                setCompletedCustomIds(prev => new Set([...prev, ap.mission_id || '']));
                                setApprovingId(null);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white transition-opacity disabled:opacity-50"
                              style={{ background: '#2d3a10' }}>
                              <ThumbsUp size={11} /> Approve
                            </button>
                            <button type="button"
                              disabled={approvingId === ap.id}
                              onClick={async () => {
                                if (!family || !profile) return;
                                setApprovingId(ap.id);
                                await rejectCompletion(ap.id, ap.family_id, ap.submitter_name || 'Child', profile.name);
                                setPendingApprovals(prev => prev.filter(p => p.id !== ap.id));
                                setApprovingId(null);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 transition-opacity disabled:opacity-50">
                              <ThumbsDown size={11} /> Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─ Family Missions (classified: General + Personal) ─ */}
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star size={12} className="text-[#2d3a10]" />
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Family Missions</p>
                    {customMissions.length > 0 && (
                      <span className="text-[10px] font-bold text-[#2d3a10]">
                        · {customMissions.filter(m => completedCustomIds.has(m.id)).length}/{customMissions.length} done
                      </span>
                    )}
                  </div>
                  {profile?.role === 'parent' && (
                    <button type="button" onClick={() => { setShowAddMission(true); setNewMissionTitle(''); setNewMissionAssignTo(''); setNewMissionClass('general'); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 flex-shrink-0"
                      style={{ background: '#2d3a10' }}><Plus size={15} /></button>
                  )}
                </div>
                {customMissions.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <p className="text-xs text-gray-400">{profile?.role === 'parent' ? 'No missions yet. Tap + to add one.' : 'No family missions yet.'}</p>
                  </div>
                ) : (
                  <div>
                    {/* General missions (no specific assignee) */}
                    {(() => {
                      const general = customMissions.filter(m => !m.assigned_to);
                      const personal = customMissions.filter(m => !!m.assigned_to);
                      const renderMission = (m: Mission) => {
                        const done = completedCustomIds.has(m.id);
                        const isPending = pendingMissionIds.has(m.id);
                        const isRejected = rejectedMissionIds.has(m.id);
                        const catColor: Record<string, string> = { spiritual: '#3B82F6', health: '#22C55E', chores: '#F59E0B', education: '#84CC16' };
                        return (
                          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                            {(() => { const ic = resolveIcon(m.icon); return ic.type === 'image' ? (
                              <img src={ic.src} alt="icon" className="w-7 h-7 rounded-xl object-cover flex-shrink-0" />
                            ) : ic.type === 'emoji' ? (
                              <span className="text-lg flex-shrink-0 w-6 text-center">{ic.char}</span>
                            ) : (
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: catColor[m.category] || '#9CA3AF' }} />
                            ); })()}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{m.title}</p>
                              <p className="text-[10px] text-[#2d3a10] font-bold">
                                +{m.points ?? 100} AP
                                {m.assigned_to && profile?.role === 'parent' && (
                                  <span className="ml-1 text-purple-600">· Assigned to {familyMembers.find(fm => fm.id === m.assigned_to)?.name || 'member'}</span>
                                )}
                              </p>
                            </div>
                            {/* Status badges */}
                            {done && <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0"><Check size={10} /> Done</span>}
                            {!done && isPending && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                <Clock size={10} /> Waiting
                              </span>
                            )}
                            {!done && isRejected && (
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                  <XCircle size={10} /> Rejected
                                </span>
                                  <button type="button"
                                    onClick={() => {
                                      setReflectingCustomMission(m);
                                      setReflectionText('');
                                      setProofNote('');
                                      setProofFile(null);
                                    }}
                                    className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                                    style={{ background: '#2d3a10' }}>Resubmit</button>
                              </div>
                            )}
                            {!done && !isPending && !isRejected && (
                              <button type="button"
                                onClick={() => {
                                  setReflectingCustomMission(m);
                                  setReflectionText('');
                                  setProofNote('');
                                  setProofFile(null);
                                }}
                                className="text-[10px] font-bold px-3 py-1 rounded-full text-white flex-shrink-0"
                                style={{ background: '#2d3a10' }}>Submit</button>
                            )}
                            {(profile?.role === 'parent' || (profile?.role === 'child' && (done || isPending))) && (
                              <button type="button" onClick={async () => {
                                if (!confirm('Delete this mission?')) return;
                                const { deleteMission } = await import('@/lib/store');
                                await deleteMission(m.id);
                                setCustomMissions(prev => prev.filter(c => c.id !== m.id));
                              }} className="text-gray-300 hover:text-red-500 transition-colors ml-1 p-1"><Trash2 size={13} /></button>
                            )}
                          </div>
                        );
                      };
                      return (
                        <>
                          {general.length > 0 && (
                            <div>
                              <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
                                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">General</span>
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="text-[9px] text-gray-300">{general.length}</span>
                              </div>
                              <div className="divide-y divide-gray-50">{general.map(renderMission)}</div>
                            </div>
                          )}
                          {personal.length > 0 && (
                            <div>
                              <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
                                <span className="text-[9px] font-extrabold text-purple-500 uppercase tracking-widest">Personal</span>
                                <div className="flex-1 h-px bg-purple-50" />
                                <span className="text-[9px] text-gray-300">{personal.length}</span>
                              </div>
                              <div className="divide-y divide-gray-50">{personal.map(renderMission)}</div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* ─ Rewards ─ */}
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift size={12} className="text-yellow-600" />
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Rewards</p>
                  </div>
                  {profile?.role === 'parent' && (
                    <button type="button" onClick={() => { setShowAddReward(true); setNewRewardName(''); setNewRewardAssignTo(''); setNewRewardClass('general'); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 flex-shrink-0"
                      style={{ background: '#c8a84b' }}><Plus size={15} /></button>
                  )}
                </div>
                {rewards.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <p className="text-xs text-gray-400">{profile?.role === 'parent' ? 'No rewards yet. Tap + to add.' : 'No rewards set yet.'}</p>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      const generalRewards = rewards.filter(r => !r.assigned_to);
                      const personalRewards = rewards.filter(r => !!r.assigned_to);
                      const renderReward = (r: Reward) => {
                        const targetPoints = (profile?.role === 'parent' && r.assigned_to) ? (memberPoints[r.assigned_to] || 0) : myPoints;
                        const pct = Math.min(Math.round((targetPoints / r.cost) * 100), 100);
                        const ready = targetPoints >= r.cost;
                        return (
                          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                            {(() => { const ic = resolveIcon(r.icon); return ic.type === 'image' ? (
                              <img src={ic.src} alt="icon" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
                            ) : ic.type === 'emoji' ? (
                              <span className="text-xl flex-shrink-0 w-7 text-center">{ic.char}</span>
                            ) : (
                              <span className="text-xl flex-shrink-0 w-7 text-center">🎁</span>
                            ); })()}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
                              {r.assigned_to && profile?.role === 'parent' && (
                                <p className="text-[10px] text-purple-600 font-semibold mb-0.5">
                                  For {familyMembers.find(fm => fm.id === r.assigned_to)?.name || 'member'}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ready ? '#22C55E' : '#c8a84b' }} />
                                </div>
                                <span className="text-[9px] font-bold text-gray-500">{targetPoints}/{r.cost} AP</span>
                              </div>
                            </div>
                            {r.claimed ? (
                              <span className="text-[9px] font-bold text-gray-400 border border-gray-200 px-2 py-1 rounded-full flex-shrink-0">Claimed</span>
                            ) : profile?.role === 'child' && ready ? (
                              <button type="button" onClick={async () => {
                                if (!user || !family) return;
                                const { claimReward } = await import('@/lib/store');
                                const ok = await claimReward(user.id, family.id, r.id);
                                if (ok) {
                                  setRewards(prev => prev.map(rew => rew.id === r.id ? { ...rew, claimed: true } : rew));
                                  setMyPoints(p => Math.max(0, p - r.cost));
                                }
                              }} className="text-[10px] font-bold px-3 py-1 rounded-full text-white bg-[#22C55E] flex-shrink-0 active:scale-95 transition-transform">Claim</button>
                            ) : ready ? (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full flex-shrink-0">Ready!</span>
                            ) : null}

                            {(profile?.role === 'parent' || (profile?.role === 'child' && r.claimed)) && (
                              <button type="button" onClick={async () => {
                                if (!confirm('Delete this reward?')) return;
                                const { deleteReward } = await import('@/lib/store');
                                await deleteReward(r.id);
                                setRewards(prev => prev.filter(rew => rew.id !== r.id));
                              }} className="text-gray-300 hover:text-red-500 transition-colors ml-1 p-1"><Trash2 size={13} /></button>
                            )}
                          </div>
                        );
                      };
                      return (
                        <>
                          {generalRewards.length > 0 && (
                            <div>
                              <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
                                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">General</span>
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="text-[9px] text-gray-300">{generalRewards.length}</span>
                              </div>
                              <div className="divide-y divide-gray-50">{generalRewards.map(renderReward)}</div>
                            </div>
                          )}
                          {personalRewards.length > 0 && (
                            <div>
                              <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
                                <span className="text-[9px] font-extrabold text-purple-500 uppercase tracking-widest">Personal</span>
                                <div className="flex-1 h-px bg-purple-50" />
                                <span className="text-[9px] text-gray-300">{personalRewards.length}</span>
                              </div>
                              <div className="divide-y divide-gray-50">{personalRewards.map(renderReward)}</div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Hadith inside missions tab */}
              {hadithOfDay && (
                <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm px-4 py-3">
                  <p className="text-[9px] font-bold text-[#2d3a10]/60 uppercase tracking-wider mb-1.5">📿 {hadithOfDay.narrator}</p>
                  <p className="text-[11px] text-gray-600 italic leading-relaxed line-clamp-3">&ldquo;{hadithOfDay.text}&rdquo;</p>
                </div>
              )}
            </div>
          )}

          {/* ── AURA BOARD TAB ── */}
          {dashTab === 'aura' && (
            <div className="space-y-3">
              {/* Sub-tabs */}
              <div className="flex gap-1 bg-white border border-black/[0.06] rounded-xl p-1 shadow-sm">
                <button type="button" onClick={() => setAuraSubTab('members')}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                  style={auraSubTab === 'members' ? { background: '#2d3a10', color: '#fff' } : { color: '#888' }}>
                  Members
                </button>
                <button type="button" onClick={() => setAuraSubTab('families')}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                  style={auraSubTab === 'families' ? { background: '#2d3a10', color: '#fff' } : { color: '#888' }}>
                  Families
                </button>
              </div>

              {auraLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-[#2d3a10]/30" />
                </div>
              ) : auraSubTab === 'members' ? (
                <div className="space-y-1.5">
                  {(() => {
                    const myIdx = familyAuraBoard.findIndex(m => m.isMe);
                    if (myIdx === -1) return null;
                    const m = familyAuraBoard[myIdx];
                    return (
                      <div className="rounded-2xl p-4 batik-overlay mb-2" style={{ background: 'linear-gradient(135deg, #1a2508 0%, #2d3a10 100%)' }}>
                        <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest">Your Ranking</p>
                        <div className="flex items-end justify-between mt-1">
                          <div>
                            <p className="text-white font-extrabold text-lg leading-tight">{m.name}</p>
                            <p className="text-white/50 text-[10px]">#{myIdx + 1} in family</p>
                          </div>
                          <div className="text-right">
                            <p className="text-yellow-300 font-extrabold text-2xl tabular-nums">{m.pts.toLocaleString()}</p>
                            <p className="text-white/40 text-[9px]">Aura Points</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {familyAuraBoard.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-black/[0.06] py-10 text-center">
                      <Trophy size={32} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Complete missions to earn Aura Points!</p>
                    </div>
                  ) : familyAuraBoard.map((m, i) => (
                    <div key={m.id} className={`rounded-xl px-4 py-2.5 border flex items-center gap-3 ${m.isMe ? 'border-[#2d3a10]/25 bg-[#2d3a10]/5' : 'bg-white border-black/[0.05]'}`}>
                      <span className="w-7 text-center text-sm">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="font-extrabold text-gray-400">#{i+1}</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${m.isMe ? 'text-[#2d3a10]' : 'text-gray-800'}`}>{m.name}</p>
                        {m.isMe && <p className="text-[9px] text-[#2d3a10]/50 font-bold">You</p>}
                      </div>
                      <span className="font-extrabold text-sm text-gray-700 tabular-nums">{m.pts.toLocaleString()} AP</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {familyBoardByFamily.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-black/[0.06] py-10 text-center">
                      <Trophy size={32} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No family rankings yet.</p>
                    </div>
                  ) : (() => {
                    const top4 = familyBoardByFamily.slice(0, 4);
                    const myFam = familyBoardByFamily.find(f => f.family_id === family?.id);
                    const myFamInTop = top4.some(f => f.family_id === family?.id);
                    return (
                      <>
                        {top4.map((f, i) => {
                          const isOurs = f.family_id === family?.id;
                          return (
                            <div key={f.family_id} className={`rounded-xl px-4 py-2.5 border flex items-center gap-3 ${isOurs ? 'border-[#2d3a10]/25 bg-[#2d3a10]/5' : 'bg-white border-black/[0.05]'}`}>
                              <span className="w-7 text-center text-sm">
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="font-extrabold text-gray-400">#{i+1}</span>}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`font-bold text-sm ${isOurs ? 'text-[#2d3a10]' : 'text-gray-800'}`}>{f.family_name}</p>
                                {isOurs && <p className="text-[9px] text-[#2d3a10]/50 font-bold">Your Family</p>}
                              </div>
                              <span className="font-extrabold text-sm text-gray-700 tabular-nums">{f.total_points.toLocaleString()} AP</span>
                            </div>
                          );
                        })}
                        {!myFamInTop && myFam && (
                          <>
                            <div className="flex items-center gap-2 px-2 py-1">
                              <div className="flex-1 h-px bg-gray-200" />
                              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">You</span>
                              <div className="flex-1 h-px bg-gray-200" />
                            </div>
                            <div className="rounded-xl px-4 py-2.5 border border-[#2d3a10]/25 bg-[#2d3a10]/5 flex items-center gap-3">
                              <span className="w-7 text-center font-extrabold text-gray-500 text-sm">#{myFam.rank}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-[#2d3a10]">{myFam.family_name}</p>
                                <p className="text-[9px] text-[#2d3a10]/50 font-bold">Your Family</p>
                              </div>
                              <span className="font-extrabold text-sm text-gray-700 tabular-nums">{myFam.total_points.toLocaleString()} AP</span>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

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
                {submittingMission ? <Loader2 size={18} className="animate-spin" /> : <>Submit · +100 AP 🌟</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Custom Mission Reflection Modal ─── */}
      {reflectingCustomMission && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div 
            ref={ref => { if (reflectionSwipe.sheetRef) reflectionSwipe.sheetRef.current = ref; }}
            onTouchStart={reflectionSwipe.handleTouchStart}
            onTouchMove={reflectionSwipe.handleTouchMove}
            onTouchEnd={reflectionSwipe.handleTouchEnd}
            className="bg-white rounded-t-3xl w-full max-w-md flex flex-col will-change-transform shadow-[0_-8px_30px_rgba(0,0,0,0.12)]" 
            style={{ maxHeight: '90vh' }}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-[15px] font-extrabold text-gray-800 tracking-tight">Complete Mission</h3>
              <button type="button" onClick={closeReflectionModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <span className="text-gray-500 font-bold text-sm leading-none">✕</span>
              </button>
            </div>

            <div ref={reflectionContentRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {missionError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{missionError}</div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Mission</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed font-semibold">
                  {reflectingCustomMission.title}
                </p>
                {reflectingCustomMission.description && (
                  <p className="text-xs text-gray-500 mt-2 px-1">{reflectingCustomMission.description}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                  Your Reflection <span className="font-normal normal-case text-gray-300">(min. 10 chars)</span>
                </p>
                <textarea
                  value={reflectionText}
                  onChange={e => setReflectionText(e.target.value)}
                  placeholder="Share your reflection or what you did..."
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
                onClick={handleCompleteCustomMission}
                disabled={submittingMission || reflectionText.trim().length < 10}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #2d3a10 0%, #5a6b28 100%)' }}
              >
                {submittingMission ? <Loader2 size={18} className="animate-spin" /> : <>Submit · +{reflectingCustomMission.points ?? 100} AP 🌟</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Mission Modal ─── */}
      {showAddMission && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-extrabold text-gray-800">New Mission</h3>
              <button type="button" onClick={() => setShowAddMission(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-gray-500 font-bold text-sm leading-none">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Icon grid */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Icon</p>
                <div className="grid grid-cols-7 gap-2">
                  {['📖', '🤲', '⭐', '🕌', '🌿', '💎', '🙏',
                    '🌟', '🏃', '🍎', '🏠', '🎓', '❤️', '✅'].map(em => (
                    <button key={em} type="button" onClick={() => setNewMissionIcon(em)}
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all"
                      style={{
                        background: newMissionIcon === em ? '#fef3c7' : '#f9f7f0',
                        border: newMissionIcon === em ? '2px solid #c8a84b' : '2px solid transparent',
                      }}>
                      {em}
                    </button>
                  ))}
                </div>
                {/* Type emoji or upload image */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-400 font-medium">or type:</span>
                  <input value={newMissionIcon.startsWith('data:') ? '' : newMissionIcon}
                    onChange={e => setNewMissionIcon(e.target.value.slice(0, 2))}
                    maxLength={2} placeholder="✏️" className="w-12 text-center text-lg border border-gray-200 rounded-xl py-1.5 focus:outline-none" />
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f3f4f0] border border-gray-200 text-[11px] font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Upload
                    <input type="file" accept="image/*" className="sr-only" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setNewMissionIcon(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  {newMissionIcon.startsWith('data:') && (
                    <img src={newMissionIcon} alt="icon" className="w-8 h-8 rounded-xl object-cover border border-gray-200" />
                  )}
                </div>
              </div>

              {/* Mission name */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Mission Name</p>
                <input value={newMissionTitle} onChange={e => setNewMissionTitle(e.target.value)}
                  placeholder="e.g. Read 5 pages of Quran"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm bg-[#fafaf6] focus:outline-none focus:ring-2 focus:ring-[#2d3a10]/15" />
              </div>

              {/* Category */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</p>
                <div className="flex gap-2 flex-wrap">
                  {(['spiritual', 'education', 'health', 'chores'] as Mission['category'][]).map(c => (
                    <button key={c} type="button" onClick={() => setNewMissionCat(c)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-all"
                      style={newMissionCat === c
                        ? { background: '#2d3a10', color: '#fff' }
                        : { background: '#f3f4f0', color: '#666' }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* AP points */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">AP Points</p>
                <input type="number" value={newMissionPoints} onChange={e => setNewMissionPoints(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm bg-[#fafaf6] focus:outline-none" />
              </div>

              {/* Classification & Assign */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Classification</p>
                <div className="flex bg-[#fafaf6] rounded-2xl p-1 shadow-sm border border-gray-100 mb-3">
                  <button type="button" onClick={() => { setNewMissionClass('general'); setNewMissionAssignTo(''); }}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={newMissionClass === 'general' ? { background: '#2d3a10', color: '#fff' } : { color: '#888' }}>
                    General
                  </button>
                  <button type="button" onClick={() => { setNewMissionClass('specific'); setNewMissionAssignTo(familyMembers.find(m => m.role === 'child')?.id || ''); }}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={newMissionClass === 'specific' ? { background: '#9333ea', color: '#fff' } : { color: '#888' }}>
                    Personal / Specific
                  </button>
                </div>
                {newMissionClass === 'specific' && (
                  <div>
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1">Select Member</p>
                    <select value={newMissionAssignTo} onChange={e => setNewMissionAssignTo(e.target.value)}
                      className="w-full rounded-2xl border border-purple-200 px-4 py-3 text-sm bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-300">
                      <option value="" disabled>Choose a member...</option>
                      {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Visible toggle */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Visible to children</p>
                <button type="button" onClick={() => setNewMissionVisible(v => !v)}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ background: newMissionVisible ? '#2d3a10' : '#d1d5db' }}>
                  <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: newMissionVisible ? '24px' : '4px' }} />
                </button>
              </div>
            </div>
            <div className="px-5 pb-8 pt-3 flex-shrink-0 border-t border-gray-100">
              <button type="button" disabled={addingMission || newMissionTitle.trim().length < 3}
                onClick={async () => {
                  if (!user || !family || !profile) return;
                  setAddingMission(true);
                  const { addMission } = await import('@/lib/store');
                  const added = await addMission(family.id, user.id, {
                    title: newMissionTitle.trim(),
                    description: '',
                    category: newMissionCat,
                    icon: newMissionIcon || newMissionCat,
                    points: parseInt(newMissionPoints) || 100,
                    visible_to_child: newMissionVisible,
                    ...(newMissionClass === 'specific' && newMissionAssignTo ? { assigned_to: newMissionAssignTo } : {}),
                  });
                  if (added) setCustomMissions(prev => [...prev, added]);
                  setAddingMission(false);
                  setShowAddMission(false);
                }}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #2d3a10 0%, #5a6b28 100%)' }}>
                {addingMission ? <Loader2 size={18} className="animate-spin" /> : 'Add Mission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Reward Modal ─── */}
      {showAddReward && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md flex flex-col" style={{ maxHeight: '88vh' }}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-extrabold text-gray-800">New Reward</h3>
              <button type="button" onClick={() => setShowAddReward(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-gray-500 font-bold text-sm leading-none">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Icon grid - matches reference image exactly */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Icon</p>
                <div className="grid grid-cols-7 gap-2">
                  {['🎁', '⭐', '🍕', '🎮', '📚', '🎨', '🧸',
                    '🍦', '🎉', '🏆', '💝', '✨', '🎯', '🎪'].map(em => (
                    <button key={em} type="button" onClick={() => setNewRewardIcon(em)}
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all"
                      style={{
                        background: newRewardIcon === em ? '#fef3c7' : '#f9f7f0',
                        border: newRewardIcon === em ? '2px solid #c8a84b' : '2px solid transparent',
                      }}>
                      {em}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-400 font-medium">or type:</span>
                  <input value={newRewardIcon.startsWith('data:') ? '' : newRewardIcon}
                    onChange={e => setNewRewardIcon(e.target.value.slice(0, 2))}
                    maxLength={2} placeholder="🎁" className="w-12 text-center text-lg border border-gray-200 rounded-xl py-1.5 focus:outline-none" />
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f3f4f0] border border-gray-200 text-[11px] font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Upload
                    <input type="file" accept="image/*" className="sr-only" onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setNewRewardIcon(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  {newRewardIcon.startsWith('data:') && (
                    <img src={newRewardIcon} alt="icon" className="w-8 h-8 rounded-xl object-cover border border-gray-200" />
                  )}
                </div>
              </div>

              {/* Reward name */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Reward Name</p>
                <input value={newRewardName} onChange={e => setNewRewardName(e.target.value)}
                  placeholder="e.g. Pizza night"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm bg-[#fafaf6] focus:outline-none focus:ring-2 focus:ring-[#c8a84b]/20" />
              </div>

              {/* AP cost */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">AP Cost</p>
                <input type="number" value={newRewardCost} onChange={e => setNewRewardCost(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm bg-[#fafaf6] focus:outline-none" />
              </div>

              {/* Classification & Assign */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Classification</p>
                <div className="flex bg-[#fafaf6] rounded-2xl p-1 shadow-sm border border-gray-100 mb-3">
                  <button type="button" onClick={() => { setNewRewardClass('general'); setNewRewardAssignTo(''); }}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={newRewardClass === 'general' ? { background: '#c8a84b', color: '#fff' } : { color: '#888' }}>
                    General
                  </button>
                  <button type="button" onClick={() => { setNewRewardClass('specific'); setNewRewardAssignTo(familyMembers.find(m => m.role === 'child')?.id || ''); }}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={newRewardClass === 'specific' ? { background: '#9333ea', color: '#fff' } : { color: '#888' }}>
                    Personal / Specific
                  </button>
                </div>
                {newRewardClass === 'specific' && (
                  <div>
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1">Select Child</p>
                    <select value={newRewardAssignTo} onChange={e => setNewRewardAssignTo(e.target.value)}
                      className="w-full rounded-2xl border border-purple-200 px-4 py-3 text-sm bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-300">
                      <option value="" disabled>Choose a child...</option>
                      {familyMembers.filter(m => m.role === 'child').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 pb-8 pt-3 flex-shrink-0 border-t border-gray-100">
              <button type="button" disabled={addingReward || newRewardName.trim().length < 2}
                onClick={async () => {
                  if (!user || !family) return;
                  setAddingReward(true);
                  const { addReward, getRewards } = await import('@/lib/store');
                  await addReward(family.id, {
                    icon: newRewardIcon || '🎁',
                    name: newRewardName.trim(),
                    cost: parseInt(newRewardCost) || 500,
                    ...(newRewardClass === 'specific' && newRewardAssignTo ? { assigned_to: newRewardAssignTo } : {}),
                  });
                  const fresh = await getRewards(family.id);
                  setRewards(fresh);
                  setAddingReward(false);
                  setShowAddReward(false);
                }}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #92400e 0%, #c8a84b 100%)' }}>
                {addingReward ? <Loader2 size={18} className="animate-spin" /> : 'Add Reward'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
