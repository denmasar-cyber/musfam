'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSwipeDown } from '@/hooks/useSwipeDown';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoadingBlock from '@/components/LoadingBlock';
import { supabase } from '@/lib/supabase';
import { getStreak } from '@/lib/store';
import { Flame, Diamond, Trophy, BookOpen, LogOut, ChevronRight, Camera, Check, X, Loader2, CheckCircle, Trash2, AlertTriangle, Pencil, ShieldCheck, Users } from 'lucide-react';
import { ActivityEntry } from '@/lib/types';

// Remove COUNTRY_FLAGS and AVATAR_TEMPLATES — using upload-only for avatars

// Islamic level system — based on streak + reflections + missions (not points)
interface IslamicLevel {
  level: number;
  name: string;
  card: 'silver' | 'gold' | 'platinum' | 'black';
  criteria: string;
  desc: string;
}

const ISLAMIC_LEVELS: IslamicLevel[] = [
  {
    level: 0, name: 'Mubtadi', card: 'silver',
    criteria: 'Start your journey',
    desc: 'The Beginner. You\'ve just opened the door to the Quran — that first step is the most important one. Build your streak by opening the app daily and completing one mission. Every great scholar started exactly here.',
  },
  {
    level: 1, name: 'Ahlul Tilawah', card: 'silver',
    criteria: '3-day streak + 2 reflections',
    desc: 'People of Recitation. You read the Quran regularly and you\'re building a real habit. Reach this by keeping a 3-day streak and writing at least 2 reflections after completing missions. Consistency is the key!',
  },
  {
    level: 2, name: 'Ahlul Tadabbur', card: 'gold',
    criteria: '5-day streak + 4 reflections',
    desc: 'People of Reflection. You don\'t just read — you pause and think about what the verses mean. Reach this by keeping a 5-day streak and writing 4 reflections. Allah loves those who ponder His words (47:24).',
  },
  {
    level: 3, name: 'Ahlul Amal', card: 'gold',
    criteria: '7-day streak + 6 missions done',
    desc: 'People of Action. Knowledge that turns into deeds — that\'s true faith. Reach this by keeping a 7-day streak and completing 6 family missions. Your actions make the whole family stronger.',
  },
  {
    level: 4, name: 'Ahlul Khair', card: 'platinum',
    criteria: '10-day streak + active in family chat',
    desc: 'People of Goodness. You are a light in your family — consistent, caring, and present. Reach this by a 10-day streak and being active in the family chat. You lift everyone around you.',
  },
  {
    level: 5, name: 'Ulil Albab', card: 'black',
    criteria: '14-day streak + all above',
    desc: 'People of Deep Understanding. Allah praises them in Surah Al-Imran 3:190-191 — they see His signs in creation, remember Him always, and reflect deeply. Reach this by achieving all levels above with a 14-day streak. This is the highest goal of the Iqro Generation.',
  },
];

function getIslamicLevel(streak: number, reflectionCount: number, missionCount: number, recentMessages: number): IslamicLevel {
  if (streak >= 14 && reflectionCount >= 4 && missionCount >= 6 && recentMessages >= 3) return ISLAMIC_LEVELS[5];
  if (streak >= 10 && recentMessages >= 3) return ISLAMIC_LEVELS[4];
  if (streak >= 7 && missionCount >= 6) return ISLAMIC_LEVELS[3];
  if (streak >= 5 && reflectionCount >= 4) return ISLAMIC_LEVELS[2];
  if (streak >= 3 && reflectionCount >= 2) return ISLAMIC_LEVELS[1];
  return ISLAMIC_LEVELS[0];
}

function getNextIslamicLevel(current: IslamicLevel): IslamicLevel | null {
  return ISLAMIC_LEVELS[current.level + 1] ?? null;
}

type CardType = 'silver' | 'gold' | 'platinum' | 'black';

const CARD_STYLES: Record<CardType, {
  bg: string; text: string; accent: string; label: string;
  ornament: string; bismillah: string;
}> = {
  silver: {
    bg: 'linear-gradient(140deg, #374151 0%, #6B7280 35%, #9CA3AF 60%, #4B5563 100%)',
    text: '#F9FAFB',
    accent: 'rgba(255,255,255,0.6)',
    label: 'SILVER',
    ornament: '🌙',
    bismillah: 'بِسْمِ اللَّهِ',
  },
  gold: {
    bg: 'linear-gradient(140deg, #78350F 0%, #B45309 30%, #D97706 55%, #92400E 100%)',
    text: '#FEF3C7',
    accent: '#FCD34D',
    label: 'GOLD',
    ornament: '⭐',
    bismillah: 'بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيْمِ',
  },
  platinum: {
    bg: 'linear-gradient(140deg, #1a2508 0%, #2d3a10 30%, #5a6b28 60%, #1a2508 100%)',
    text: '#ECFDF5',
    accent: '#86EFAC',
    label: 'PLATINUM',
    ornament: '🌿',
    bismillah: 'بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيْمِ',
  },
  black: {
    bg: 'linear-gradient(140deg, #000000 0%, #111111 30%, #1F1F1F 60%, #0A0A0A 100%)',
    text: '#FEF3C7',
    accent: '#C8A84B',
    label: 'ULIL ALBAB',
    ornament: '☪️',
    bismillah: 'بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيْمِ',
  },
};


interface ChildProgress {
  id: string;
  name: string;
  points: number;
  streak: number;
  level: IslamicLevel;
}

export default function MePage() {
  const { user, profile, family, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [myPoints, setMyPoints] = useState(0);
  const [streak, setStreak] = useState({ current_streak: 0, longest_streak: 0 });
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [quranStreak, setQuranStreak] = useState(0);
  const [reflectionCount, setReflectionCount] = useState(0);
  const [missionCount, setMissionCount] = useState(0);
  const [recentMessages, setRecentMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  // Parent-specific
  const [childrenProgress, setChildrenProgress] = useState<ChildProgress[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [khatamDone, setKhatamDone] = useState(0);
  const [khatamTotal, setKhatamTotal] = useState(0);
  const [familyTotalPoints, setFamilyTotalPoints] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Level map toggle
  const [showLevelMap, setShowLevelMap] = useState(false);

  // About modal (step-by-step: 1=Mission, 2=Nusantara, 3=Bhinneka, 4=Developer)
  const [showAbout, setShowAbout] = useState(false);
  const [aboutStep, setAboutStep] = useState(1);

  // Edit name
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Danger zone
  const [confirmClearActivity, setConfirmClearActivity] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [dangerLoading, setDangerLoading] = useState(false);

  // Avatar
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const swipeAvatar      = useSwipeDown(() => setShowAvatarPicker(false));
  const swipeAbout       = useSwipeDown(() => setShowAbout(false));

  const loadData = useCallback(async () => {
    if (!user || !family) return;

    // My personal points
    const { data: pts } = await supabase
      .from('points')
      .select('total_points')
      .eq('user_id', user.id)
      .eq('family_id', family.id)
      .single();
    setMyPoints(pts?.total_points || 0);

    // Streak
    const s = await getStreak(user.id, family.id);
    setStreak(s);

    // Activities (my own — server-side filter)
    const { data: actData } = await supabase
      .from('activity_log')
      .select('*')
      .eq('family_id', family.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);
    setActivities((actData as ActivityEntry[]) || []);

    // Quran streak
    const today = new Date().toISOString().split('T')[0];
    const { data: logs } = await supabase
      .from('quran_reading_log')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(30);
    if (logs?.length) {
      const dates = [...new Set(logs.map((l: { date: string }) => l.date))].sort().reverse();
      let qs = 0; const cd = new Date();
      for (const d of dates) {
        const exp = cd.toISOString().split('T')[0];
        if (d === exp) { qs++; cd.setDate(cd.getDate() - 1); }
        else break;
      }
      setQuranStreak(qs);
    }

    // Reflection count (mission_completions with non-null reflection_text)
    const { data: reflRows } = await supabase
      .from('mission_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('family_id', family.id)
      .not('reflection_text', 'is', null);
    setReflectionCount(reflRows?.length ?? 0);

    // Mission completions count
    const { data: missionRows } = await supabase
      .from('mission_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('family_id', family.id);
    setMissionCount(missionRows?.length ?? 0);

    // Recent chat messages in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: msgRows } = await supabase
      .from('family_messages')
      .select('id')
      .eq('user_id', user.id)
      .eq('family_id', family.id)
      .gte('created_at', sevenDaysAgo.toISOString());
    setRecentMessages(msgRows?.length ?? 0);

    // Avatar
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);


    // Parent-specific data
    if (profile?.role === 'parent') {
      // All family members
      const { data: members } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('family_id', family.id);
      setMemberCount(members?.length ?? 0);

      // Family total points
      const { data: allPts } = await supabase
        .from('points')
        .select('total_points')
        .eq('family_id', family.id);
      setFamilyTotalPoints((allPts || []).reduce((s: number, r: { total_points: number }) => s + (r.total_points || 0), 0));

      // Children progress
      const children = (members || []).filter((m: { role: string }) => m.role === 'child');
      const progResults = await Promise.all(children.map(async (c: { id: string; name: string }) => {
        const [{ data: cpts }, cStreak] = await Promise.all([
          supabase.from('points').select('total_points').eq('user_id', c.id).eq('family_id', family.id).maybeSingle(),
          getStreak(c.id, family.id),
        ]);
        const pts = cpts?.total_points || 0;
        const lvl = getIslamicLevel(cStreak.current_streak, 0, 0, 0);
        return { id: c.id, name: c.name, points: pts, streak: cStreak.current_streak, level: lvl };
      }));
      setChildrenProgress(progResults);


      // Active khatam session
      const { data: ks } = await supabase
        .from('khatam_sessions')
        .select('id')
        .eq('family_id', family.id)
        .in('status', ['active', 'voting'])
        .maybeSingle();
      if (ks?.id) {
        const { data: assigns } = await supabase
          .from('khatam_assignments')
          .select('completed')
          .eq('session_id', ks.id);
        setKhatamTotal(assigns?.length ?? 0);
        setKhatamDone((assigns || []).filter((a: { completed: boolean }) => a.completed).length);
      }
    }

    setLoading(false);
    void today; // suppress unused warning
  }, [user, family, profile?.avatar_url, profile?.role]);

  async function saveAvatar(url: string) {
    if (!user) return;
    setSavingAvatar(true);
    const cleanUrl = url.trim();
    await supabase.from('profiles').update({ avatar_url: cleanUrl || null }).eq('id', user.id);
    setAvatarUrl(cleanUrl || null);
    setShowAvatarPicker(false);
    setSavingAvatar(false);
  }

  async function uploadAvatarFile(file: File) {
    if (!user) return;
    setSavingAvatar(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}.${ext}`;
    const { data: uploadData, error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      console.error('Avatar upload error:', error.message);
      setSavingAvatar(false);
      return;
    }
    if (uploadData) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      if (urlData?.publicUrl) {
        await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
        setAvatarUrl(urlData.publicUrl);
        await refreshProfile();
        setShowAvatarPicker(false);
      }
    }
    setSavingAvatar(false);
  }

  async function saveName() {
    if (!user || !nameInput.trim()) return;
    setSavingName(true);
    await supabase.from('profiles').update({ name: nameInput.trim() }).eq('id', user.id);
    await refreshProfile();
    setEditingName(false);
    setSavingName(false);
  }


  function copyInviteCode() {
    if (family?.invite_code) {
      navigator.clipboard.writeText(family.invite_code).then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      });
    }
  }

  async function clearMyActivity() {
    if (!user || !family) return;
    setDangerLoading(true);
    await supabase.from('activity_log').delete().eq('user_id', user.id).eq('family_id', family.id);
    setActivities([]);
    setConfirmClearActivity(false);
    setDangerLoading(false);
  }

  async function deleteMyAccount() {
    if (!user) return;
    setDangerLoading(true);
    try {
      // Delete child rows first (FK constraints), then parent rows
      await supabase.from('khatam_assignments').delete().eq('user_id', user.id);
      await supabase.from('khatam_votes').delete().eq('user_id', user.id);
      await Promise.all([
        supabase.from('quran_bookmarks').delete().eq('user_id', user.id),
        supabase.from('quran_notes').delete().eq('user_id', user.id),
        supabase.from('quran_reading_log').delete().eq('user_id', user.id),
        supabase.from('activity_log').delete().eq('user_id', user.id),
        supabase.from('mission_completions').delete().eq('user_id', user.id),
        supabase.from('reflections').delete().eq('user_id', user.id),
        supabase.from('family_messages').delete().eq('user_id', user.id),
        supabase.from('streaks').delete().eq('user_id', user.id),
        supabase.from('points').delete().eq('user_id', user.id),
        supabase.from('hydration').delete().eq('user_id', user.id),
        supabase.from('daily_schedule').delete().eq('user_id', user.id),
        supabase.from('chat_clear_timestamps').delete().eq('user_id', user.id),
      ]);
      // Delete profile last — once gone, re-login routes to /onboarding as new user
      await supabase.from('profiles').delete().eq('id', user.id);
      await signOut();
      // AuthGuard will see user with no profile → redirect to /onboarding
    } catch {
      setDangerLoading(false);
      setConfirmDeleteAccount(false);
    }
  }

  useEffect(() => { loadData(); }, [loadData]);

  const currentLevel = getIslamicLevel(streak.current_streak, reflectionCount, missionCount, recentMessages);
  const nextLevel = getNextIslamicLevel(currentLevel);
  const cardStyle = CARD_STYLES[currentLevel.card];
  // Progress toward next level: use streak as the primary metric
  const streakThresholds = [0, 3, 5, 7, 10, 14];
  const curThreshold = streakThresholds[currentLevel.level] ?? 0;
  const nextThreshold = streakThresholds[currentLevel.level + 1] ?? curThreshold;
  const progress = nextThreshold > curThreshold
    ? Math.min(((streak.current_streak - curThreshold) / (nextThreshold - curThreshold)) * 100, 100)
    : 100;

  if (loading || !profile) {
    return <LoadingBlock fullScreen />;
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4 space-y-4 pb-24 page-enter">

        {/* ===== AVATAR ROW ===== */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full border-4 border-white shadow-md overflow-hidden bg-forest/10 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span className="text-2xl font-extrabold text-forest">
                  {profile?.name?.charAt(0).toUpperCase() ?? '?'}
                </span>
              )}
            </div>
            <button
              type="button"
              title="Change avatar"
              onClick={() => setShowAvatarPicker(true)}
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#d4603a] border-2 border-white flex items-center justify-center shadow"
            >
              <Camera size={10} className="text-white" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  aria-label="Display name"
                  placeholder="Your name"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="font-extrabold text-gray-800 text-base border-b-2 border-forest focus:outline-none bg-transparent flex-1 min-w-0"
                  maxLength={40}
                />
                <button type="button" title="Save name" onClick={saveName} disabled={savingName || !nameInput.trim()}
                  className="w-7 h-7 rounded-full bg-forest flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                  {savingName ? <Loader2 size={12} className="text-white animate-spin" /> : <Check size={12} className="text-white" />}
                </button>
                <button type="button" title="Cancel" onClick={() => setEditingName(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <X size={12} className="text-gray-500" />
                </button>
              </div>
            ) : (
              <button type="button" className="flex items-center gap-1.5 group" onClick={() => { setNameInput(profile?.name || ''); setEditingName(true); }}>
                <p className="font-extrabold text-gray-800 text-lg leading-tight">{profile?.name}</p>
                <Pencil size={13} className="text-gray-300 group-hover:text-forest transition-colors flex-shrink-0" />
              </button>
            )}
            <p className="text-sm text-gray-400">{profile?.role === 'parent' ? 'Guardian' : 'Child'} · {family?.name}</p>
          </div>
        </div>

        {/* ===== ISLAMIC AURA CARD ===== */}
        <div
          className="rounded-3xl relative overflow-hidden shadow-2xl cursor-pointer active:scale-[0.98] transition-transform"
          style={{ background: cardStyle.bg, minHeight: 200 }}
          onClick={() => setShowLevelMap(s => !s)}
        >
          {/* Islamic geometric pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'repeating-linear-gradient(30deg, transparent, transparent 18px, rgba(255,255,255,0.3) 18px, rgba(255,255,255,0.3) 21px), repeating-linear-gradient(-30deg, transparent, transparent 18px, rgba(255,255,255,0.3) 18px, rgba(255,255,255,0.3) 21px)',
          }} />
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full" style={{ background: 'rgba(0,0,0,0.1)' }} />

          <div className="relative p-5">
            {/* Top row: ornament + level label */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{cardStyle.ornament}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: cardStyle.accent }}>
                  MUSFAM
                </span>
              </div>
              <span className="text-xs font-extrabold tracking-[0.15em]" style={{ color: cardStyle.text }}>
                {cardStyle.label}
              </span>
            </div>

            {/* Center: Bismillah Arabic */}
            <p className="text-center text-[18px] leading-[1.8] mb-3"
              style={{ fontFamily: "'Amiri Quran', 'Amiri', serif", color: cardStyle.text, opacity: 0.85 }}>
              {cardStyle.bismillah}
            </p>

            {/* Divider shimmer */}
            <div className="w-full h-px mb-3" style={{ background: `linear-gradient(90deg, transparent, ${cardStyle.accent}, transparent)` }} />

            {/* Bottom: name + level + AP */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-0.5" style={{ color: cardStyle.accent, opacity: 0.7 }}>
                  {profile?.role === 'parent' ? 'GUARDIAN' : 'MEMBER'}
                </p>
                <p className="font-extrabold text-sm tracking-wide" style={{ color: cardStyle.text }}>
                  {profile?.name || 'Member'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-0.5" style={{ color: cardStyle.accent, opacity: 0.7 }}>AURA POINTS</p>
                <p className="font-extrabold text-sm tabular-nums" style={{ color: cardStyle.text }}>
                  {myPoints.toLocaleString()}
                </p>
                <p className="text-[9px] font-bold" style={{ color: cardStyle.accent }}>{currentLevel.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Level progress bar + description */}
        <div className="bg-white rounded-2xl p-4 border border-cream-dark">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-forest">{currentLevel.name}</p>
            {nextLevel && <p className="text-[11px] text-gray-400 font-medium">{nextLevel.name} →</p>}
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{currentLevel.desc}</p>
          <div className="w-full h-2.5 bg-cream-dark rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progress, 100)}%`, background: 'linear-gradient(to right, #2d3a10, #d4a017)' }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-gray-400">{streak.current_streak} day streak · {reflectionCount} reflections</p>
            {nextLevel && <p className="text-[11px] text-forest font-semibold">{nextLevel.criteria}</p>}
          </div>
        </div>

        {/* Level map (shown when card tapped) */}
        {showLevelMap && (
          <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
            <div className="px-4 py-3 border-b border-cream-dark flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">All Levels</p>
              <button type="button" title="Close level map" onClick={() => setShowLevelMap(false)}
                className="w-6 h-6 rounded-full bg-cream-light flex items-center justify-center text-gray-400">
                <X size={13} />
              </button>
            </div>
            <div className="divide-y divide-cream-dark">
              {ISLAMIC_LEVELS.map((lvl) => {
                const isCurrent = lvl.level === currentLevel.level;
                const isUnlocked = lvl.level <= currentLevel.level;
                const lvlStyle = CARD_STYLES[lvl.card];
                return (
                  <div key={lvl.level} className={`flex items-center gap-3 px-4 py-3 ${isCurrent ? 'bg-forest/5' : ''}`}>
                    <div className="w-10 h-6 rounded-md flex-shrink-0"
                      style={{ background: lvlStyle.bg, opacity: isUnlocked ? 1 : 0.35 }} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isCurrent ? 'text-forest' : isUnlocked ? 'text-gray-700' : 'text-gray-400'}`}>
                        {lvl.name}
                      </p>
                      <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">{lvl.desc}</p>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-forest text-white px-2 py-0.5 rounded-full flex-shrink-0">Current</span>
                    )}
                    {isUnlocked && !isCurrent && (
                      <CheckCircle size={14} className="text-forest flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-2xl p-3 border border-cream-dark text-center">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-1">
              <Flame size={16} className="text-orange-500" />
            </div>
            <p className="text-xl font-extrabold text-gray-800">{streak.current_streak}</p>
            <p className="text-[10px] text-gray-400 font-medium">Day Streak</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-cream-dark text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-1">
              <BookOpen size={16} className="text-emerald-600" />
            </div>
            <p className="text-xl font-extrabold text-gray-800">{quranStreak}</p>
            <p className="text-[10px] text-gray-400 font-medium">Quran Streak</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-cream-dark text-center">
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-1">
              <Trophy size={16} className="text-yellow-600" />
            </div>
            <p className="text-xl font-extrabold text-gray-800">{streak.longest_streak}</p>
            <p className="text-[10px] text-gray-400 font-medium">Longest</p>
          </div>
        </div>

        {/* Parent: family stats + invite code only */}
        {profile?.role === 'parent' && (
          <div className="space-y-3">
            {/* Family stats bar */}
            <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-cream-dark">
                <div className="px-3 py-3 text-center">
                  <p className="font-extrabold text-lg text-gray-800">{familyTotalPoints.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Family AP</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="font-extrabold text-lg text-gray-800">{memberCount}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Members</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="font-extrabold text-lg text-gray-800">{khatamTotal > 0 ? `${khatamDone}/${khatamTotal}` : '—'}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Khatam</p>
                </div>
              </div>
            </div>

            {/* Invite code */}
            <div className="bg-white rounded-2xl border border-cream-dark p-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-forest/10 flex items-center justify-center flex-shrink-0">
                <Users size={16} className="text-forest" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">Invite Code</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-extrabold text-forest text-sm tracking-widest">{family?.invite_code}</p>
                  <button type="button" title="Copy invite code" onClick={copyInviteCode}
                    className="text-[9px] font-bold bg-forest text-white px-1.5 py-0.5 rounded-md">
                    {copiedCode ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Family info + settings */}
        <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-cream-dark">
            <div className="w-9 h-9 rounded-xl bg-forest/10 flex items-center justify-center text-base">👨‍👩‍👧</div>
            <div className="flex-1">
              <p className="font-bold text-gray-800 text-sm">{family?.name}</p>
              <p className="text-[10px] text-gray-400">Code: {family?.invite_code}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
          <button type="button" onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 transition-colors">
            <LogOut size={16} />
            <span className="text-sm font-bold">Sign Out</span>
          </button>
        </div>

        {/* About button */}
        <button type="button" onClick={() => { setShowAbout(true); setAboutStep(1); }}
          className="w-full rounded-2xl border border-forest/20 bg-white flex items-center gap-3 px-4 py-3.5 hover:bg-forest/5 transition-colors">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
            <img src="/musfam-logo.png" alt="Musfam" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-gray-700">About Musfam</p>
            <p className="text-[11px] text-gray-400">Fajr Al-Garuda · v1.0</p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-red-100">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Danger Zone</p>
          </div>
          <button type="button"
            onClick={() => setConfirmClearActivity(true)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-red-50 hover:bg-red-50 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <Trash2 size={15} className="text-red-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-gray-700">Clear My Activity</p>
              <p className="text-[11px] text-gray-400">Remove your activity log entries</p>
            </div>
          </button>
          <button type="button"
            onClick={() => setConfirmDeleteAccount(true)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={15} className="text-red-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-red-600">Delete My Account</p>
              <p className="text-[11px] text-gray-400">Permanently remove all your data</p>
            </div>
          </button>
        </div>

      </main>

      {/* Confirm: Clear Activity */}
      {confirmClearActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="font-extrabold text-gray-800 text-center text-lg mb-1">Clear Activity?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">This will delete all your activity log entries. This cannot be undone.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmClearActivity(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm">
                Cancel
              </button>
              <button type="button" onClick={clearMyActivity} disabled={dangerLoading}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm disabled:opacity-50">
                {dangerLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Delete Account */}
      {confirmDeleteAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <h3 className="font-extrabold text-gray-800 text-center text-lg mb-1">Delete Account?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">All your data — bookmarks, notes, points, missions, messages — will be permanently deleted. This cannot be undone.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDeleteAccount(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm">
                Cancel
              </button>
              <button type="button" onClick={deleteMyAccount} disabled={dangerLoading}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm disabled:opacity-50">
                {dangerLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== AVATAR PICKER MODAL ===== */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) setShowAvatarPicker(false); }}>
          <div ref={swipeAvatar.sheetRef}
            onTouchStart={swipeAvatar.handleTouchStart}
            onTouchMove={swipeAvatar.handleTouchMove}
            onTouchEnd={swipeAvatar.handleTouchEnd}
            className="bg-white rounded-t-3xl w-full max-w-md flex flex-col" style={{ height: '80vh', maxHeight: '80vh' }}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b border-gray-100">
              <h3 className="text-lg font-extrabold text-gray-800">Choose Avatar</h3>
              <button type="button" title="Close" onClick={() => setShowAvatarPicker(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4 pb-8" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
              {/* Upload from device */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Upload Photo</p>
                <label className={`flex items-center gap-2.5 cursor-pointer rounded-2xl border-2 border-dashed px-4 py-3 transition-colors ${savingAvatar ? 'opacity-50 pointer-events-none' : 'border-gray-200 hover:border-[#2d3a10]/40 hover:bg-[#2d3a10]/5'}`}>
                  {savingAvatar
                    ? <><Loader2 size={16} className="text-[#2d3a10] animate-spin flex-shrink-0" /><span className="text-sm text-gray-500">Uploading...</span></>
                    : <><Camera size={16} className="text-gray-400 flex-shrink-0" /><span className="text-sm text-gray-500">Choose photo from gallery...</span></>
                  }
                  <input type="file" accept="image/*" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatarFile(f); }} />
                </label>
              </div>

              {/* Remove avatar */}
              {avatarUrl && (
                <button type="button" onClick={() => saveAvatar('')}
                  className="w-full py-2.5 rounded-xl border border-red-100 text-red-400 text-sm font-bold hover:bg-red-50 transition-colors">
                  Remove Avatar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* About / Developer — step-by-step popups */}
      {showAbout && (() => {
        const ABOUT_STEPS = [
          {
            label: 'Our Mission',
            icon: null,
            title: 'Musfam',
            subtitle: 'Muslim Family · Grow Together With The Qur\'an',
            body: 'Musfam was born from a simple belief that the family is the most powerful school for Islamic values. We built this so that parents and children can read the Quran together, reflect on its meaning, and grow as one. Every feature points toward one goal: raising the Ulil Albab generation.',
          },
          {
            label: 'Nusantara',
            icon: '🏝️',
            title: 'A Touch of Nusantara',
            subtitle: null,
            body: 'We are proud to carry the spirit of the Nusantara in everything we build. The warmth of gotong royong, the depth of pesantren tradition — these are not mere traditions. This is how the Wali Songo taught us to integrate the Quran into everyday life. Musfam carries that spirit into the digital age so every Muslim family anywhere in the world can live it.',
          },
          {
            label: 'Bhinneka',
            icon: '🤝',
            title: 'Bhinneka Tunggal Ika',
            subtitle: 'Unity in Diversity',
            body: 'Differences in school of thought, culture, or background are not obstacles here — they are elements that support one another as a single Ummah. Meaningful in habluminannas, habluminallah, and habluminal alam. Islam, after all, means peace — and peace flourishes when diversity becomes harmony.',
          },
          {
            label: 'Developer',
            icon: '🦅',
            title: 'Fajr Al-Garuda',
            subtitle: 'A Product of',
            body: 'The dawn of the archipelago — soaring to split the sky for the benefit of the Ummah, from Indonesia to the world.',
          },
        ];
        const step = ABOUT_STEPS[aboutStep - 1];
        const isLast = aboutStep === ABOUT_STEPS.length;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
            onClick={e => { if (e.target === e.currentTarget) setShowAbout(false); }}>
            <div className="w-full max-w-sm rounded-3xl overflow-hidden"
              style={{ background: 'linear-gradient(160deg, #1a2508 0%, #2d3a10 60%, #1a2508 100%)' }}>
              {/* Gold top bar */}
              <div className="h-1" style={{ background: 'repeating-linear-gradient(90deg, #c8a84b 0px, #c8a84b 8px, transparent 8px, transparent 16px)' }} />

              <div className="px-6 pt-5 pb-6 space-y-4">
                {/* Step indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {ABOUT_STEPS.map((_, i) => (
                      <div key={i} className="h-1 rounded-full transition-all"
                        style={{ width: i + 1 === aboutStep ? '20px' : '6px', background: i + 1 === aboutStep ? '#c8a84b' : 'rgba(200,168,75,0.25)' }} />
                    ))}
                  </div>
                  <button type="button" title="Close" onClick={() => setShowAbout(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <X size={13} style={{ color: 'rgba(245,240,232,0.7)' }} />
                  </button>
                </div>

                {/* Icon / Logo */}
                <div className="flex justify-center">
                  {step.icon === null ? (
                    <div className="w-20 h-20 rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(200,168,75,0.4)' }}>
                      <img src="/musfam-logo.png" alt="Musfam" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="text-4xl">{step.icon}</div>
                  )}
                </div>

                {/* Title */}
                <div className="text-center">
                  {step.subtitle && <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(200,168,75,0.6)' }}>{step.subtitle}</p>}
                  <p className="text-xl font-extrabold" style={{ fontFamily: "Georgia, serif", color: '#f5f0e8' }}>{step.title}</p>
                </div>

                {/* Body */}
                <div className="rounded-2xl p-4" style={{ background: 'rgba(200,168,75,0.08)', border: '1px solid rgba(200,168,75,0.15)' }}>
                  <p className="text-xs leading-relaxed text-center" style={{ color: 'rgba(245,240,232,0.8)' }}>{step.body}</p>
                  {(step as { footer?: string }).footer && (
                    <p className="text-[10px] text-center mt-3 tracking-widest" style={{ color: 'rgba(200,168,75,0.4)' }}>{(step as { footer?: string }).footer}</p>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex gap-3 pt-1">
                  {aboutStep > 1 && (
                    <button type="button" onClick={() => setAboutStep(s => s - 1)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(245,240,232,0.6)' }}>
                      ← Back
                    </button>
                  )}
                  <button type="button"
                    onClick={() => { if (isLast) setShowAbout(false); else setAboutStep(s => s + 1); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: '#c8a84b', color: '#1a2508' }}>
                    {isLast ? 'Close' : 'Next →'}
                  </button>
                </div>
              </div>

              <div className="h-1" style={{ background: 'repeating-linear-gradient(90deg, #c8a84b 0px, #c8a84b 8px, transparent 8px, transparent 16px)' }} />
            </div>
          </div>
        );
      })()}

    </>
  );
}
