'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getTodayCompletions, completeMission, completeCustomMission,
  getFamilyPoints, getDailyMission, hasCompletedDailyMission,
  getMissions, addMission, deleteMission, updateMission,
  getRewards, addReward, deleteReward, updateReward,
  isMissionCompletedToday, getActivities, deleteActivity, clearAllActivities,
  getPendingApprovals, getRejectedCompletions, approveCompletion, rejectCompletion,
  DailyMission, PendingApproval, uploadProofImage, getStreak,
} from '@/lib/store';
import type { Mission, ActivityEntry, Reward } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSwipeDown } from '@/hooks/useSwipeDown';
import LoadingBlock from '@/components/LoadingBlock';
import {
  Gift, Trophy, X, CheckCircle, Star, Check,
  Loader2, Medal, Crown, Trash2, AlertTriangle, ImageIcon,
  Eye, EyeOff, Plus, Bell, ThumbsUp, ThumbsDown, ShieldCheck,
} from 'lucide-react';

type Tab = 'missions' | 'aura';
type AuraSubTab = 'families' | 'members';

interface FamilyRank {
  family_id: string;
  family_name: string;
  total_points: number;
  rank: number;
}

interface MemberRank {
  user_id: string;
  member_name: string;
  family_name: string;
  total_points: number;
  rank: number;
  is_me: boolean;
}

// Unified completion modal — same for daily + custom missions
interface CompletionTarget {
  type: 'daily' | 'custom';
  id: string;
  title: string;
  prompt?: string;
}

const DAILY_VERSES = ['2:255','1:1','2:286','3:173','2:152','3:200','39:53','94:5','94:6','2:45','13:28','65:3','2:177','17:80','18:10','33:41','2:153','3:139','4:103','29:45','73:20','76:9','59:22','2:261'];

// Short surah name map for citation display
const SURAH_NAMES: Record<number, string> = {
  1:'Al-Fatihah',2:'Al-Baqarah',3:'Al-Imran',4:'An-Nisa',13:'Ar-Ra\'d',14:'Ibrahim',17:'Al-Isra',
  18:'Al-Kahf',29:'Al-Ankabut',33:'Al-Ahzab',39:'Az-Zumar',45:'Al-Jathiyah',59:'Al-Hashr',
  62:'Al-Jumuah',64:'At-Taghaabun',65:'At-Talaq',73:'Al-Muzzammil',76:'Al-Insan',94:'Al-Inshirah',96:'Al-Alaq',
};

function formatVerseRef(verseKey: string): string {
  const [chapter, ayah] = verseKey.split(':');
  const name = SURAH_NAMES[parseInt(chapter)] || `Surah ${chapter}`;
  return `${name}: ${ayah}`;
}

function getDailyVerseKey() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((+new Date() - +start) / 86400000);
  return DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'Just now';
  if (h < 24) return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

export default function LeaguesPage() {
  const { user, family, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('missions');
  const [loading, setLoading] = useState(true);

  // Daily mission
  const [dailyMission, setDailyMission] = useState<DailyMission | null>(null);
  const [missionCompleted, setMissionCompleted] = useState(false);
  const [missionPendingApproval, setMissionPendingApproval] = useState(false);

  // Custom missions
  const [customMissions, setCustomMissions] = useState<Mission[]>([]);
  const [completedCustomIds, setCompletedCustomIds] = useState<Set<string>>(new Set());

  // Activity history
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  // Unified completion modal
  const [completionTarget, setCompletionTarget] = useState<CompletionTarget | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Aura Board
  const [auraBoard, setAuraBoard] = useState<FamilyRank[]>([]);
  const [memberBoard, setMemberBoard] = useState<MemberRank[]>([]);
  const [auraLoading, setAuraLoading] = useState(false);
  const [myFamilyPoints, setMyFamilyPoints] = useState(0);
  const [myPersonalPoints, setMyPersonalPoints] = useState(0);
  const [auraSubTab, setAuraSubTab] = useState<AuraSubTab>('members');
  const [myFlag, setMyFlag] = useState('');

  // Parent command center
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);
  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [newMissionCat, setNewMissionCat] = useState<Mission['category']>('spiritual');
  const [newMissionPoints, setNewMissionPoints] = useState('10');
  const [newMissionVisible, setNewMissionVisible] = useState(true);
  const [addingMission, setAddingMission] = useState(false);
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardCost, setNewRewardCost] = useState('');
  const [newRewardIcon, setNewRewardIcon] = useState('🎁');
  const [addingReward, setAddingReward] = useState(false);

  // Child: rejected missions
  const [rejectedMissionIds, setRejectedMissionIds] = useState<string[]>([]);
  // Child: submit mission from leagues
  const [submitTarget, setSubmitTarget] = useState<Mission | null>(null);
  const [submitReflection, setSubmitReflection] = useState('');
  const [submitSubmitting, setSubmitSubmitting] = useState(false);
  const addMissionContentRef = useRef<HTMLDivElement>(null);
  const addRewardContentRef = useRef<HTMLDivElement>(null);
  const submitMissionContentRef = useRef<HTMLDivElement>(null);
  const missionTitleInputRef = useRef<HTMLInputElement>(null);
  const rewardNameInputRef = useRef<HTMLInputElement>(null);
  const submitReflectionInputRef = useRef<HTMLTextAreaElement>(null);
  const closeAddMission = useCallback(() => setShowAddMission(false), []);
  const closeAddReward = useCallback(() => setShowAddReward(false), []);
  const closeSubmitMission = useCallback(() => {
    setSubmitTarget(null);
    setSubmitReflection('');
  }, []);
  const addMissionSwipe = useSwipeDown(closeAddMission, 80, () => (addMissionContentRef.current?.scrollTop ?? 0) === 0);
  const addRewardSwipe = useSwipeDown(closeAddReward, 80, () => (addRewardContentRef.current?.scrollTop ?? 0) === 0);
  const submitMissionSwipe = useSwipeDown(closeSubmitMission, 80, () => (submitMissionContentRef.current?.scrollTop ?? 0) === 0);
  const addMissionSheetRef = addMissionSwipe.sheetRef;
  const addRewardSheetRef = addRewardSwipe.sheetRef;
  const submitMissionSheetRef = submitMissionSwipe.sheetRef;
  const setAddMissionSheetRef = useCallback((node: HTMLDivElement | null) => {
    addMissionSheetRef.current = node;
  }, [addMissionSheetRef]);
  const setAddRewardSheetRef = useCallback((node: HTMLDivElement | null) => {
    addRewardSheetRef.current = node;
  }, [addRewardSheetRef]);
  const setSubmitMissionSheetRef = useCallback((node: HTMLDivElement | null) => {
    submitMissionSheetRef.current = node;
  }, [submitMissionSheetRef]);
  const handleAddMissionTouchStart = useCallback((e: React.TouchEvent) => addMissionSwipe.handleTouchStart(e), [addMissionSwipe]);
  const handleAddMissionTouchMove = useCallback((e: React.TouchEvent) => addMissionSwipe.handleTouchMove(e), [addMissionSwipe]);
  const handleAddMissionTouchEnd = useCallback(() => addMissionSwipe.handleTouchEnd(), [addMissionSwipe]);
  const handleAddRewardTouchStart = useCallback((e: React.TouchEvent) => addRewardSwipe.handleTouchStart(e), [addRewardSwipe]);
  const handleAddRewardTouchMove = useCallback((e: React.TouchEvent) => addRewardSwipe.handleTouchMove(e), [addRewardSwipe]);
  const handleAddRewardTouchEnd = useCallback(() => addRewardSwipe.handleTouchEnd(), [addRewardSwipe]);
  const handleSubmitMissionTouchStart = useCallback((e: React.TouchEvent) => submitMissionSwipe.handleTouchStart(e), [submitMissionSwipe]);
  const handleSubmitMissionTouchMove = useCallback((e: React.TouchEvent) => submitMissionSwipe.handleTouchMove(e), [submitMissionSwipe]);
  const handleSubmitMissionTouchEnd = useCallback(() => submitMissionSwipe.handleTouchEnd(), [submitMissionSwipe]);

  useEffect(() => {
    if (!showAddMission) return;
    requestAnimationFrame(() => missionTitleInputRef.current?.focus());
  }, [showAddMission]);

  useEffect(() => {
    if (!showAddReward) return;
    requestAnimationFrame(() => rewardNameInputRef.current?.focus());
  }, [showAddReward]);

  useEffect(() => {
    if (!submitTarget) return;
    requestAnimationFrame(() => submitReflectionInputRef.current?.focus());
  }, [submitTarget]);

  const refreshMissions = useCallback(async () => {
    if (!family || !user || !profile) return;
    const today = new Date().toISOString().split('T')[0];
    const verseKey = getDailyVerseKey();
    const [mission, completed, allMissions, acts] = await Promise.all([
      getDailyMission(family.id, today, verseKey),
      hasCompletedDailyMission(user.id, family.id, today),
      getMissions(family.id),
      getActivities(family.id),
    ]);
    setDailyMission(mission);
    setMissionCompleted(completed);
    setActivities(acts);

    if (profile.role === 'parent') {
      setCustomMissions(allMissions);
      const [rewardList, approvals] = await Promise.all([
        getRewards(family.id),
        getPendingApprovals(family.id),
      ]);
      setRewards(rewardList);
      setPendingApprovals(approvals);
    } else {
      // Child: only visible missions assigned to them
      const visibleMissions = allMissions.filter(m =>
        m.visible_to_child !== false && (!m.assigned_to || m.assigned_to === user.id)
      );
      setCustomMissions(visibleMissions);
      const [rewardList, todayCompletions, rejectedCompletions] = await Promise.all([
        getRewards(family.id),
        getTodayCompletions(family.id),
        getRejectedCompletions(user.id, family.id),
      ]);
      const visibleRewards = rewardList.filter(r =>
        r.visible_to_child !== false && (!r.assigned_to || r.assigned_to === user.id)
      );
      setRewards(visibleRewards);
      const approvedOrPending = todayCompletions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c.status === 'approved' || c.status === 'pending' || !c.status)
        .map((c: any) => c.mission_id).filter(Boolean) as string[];
      setRejectedMissionIds(rejectedCompletions.map(c => c.mission_id).filter(Boolean) as string[]);

      const completedSet = new Set<string>(approvedOrPending);
      setCompletedCustomIds(completedSet);
    }

    const completedSet = new Set<string>();
    if (profile.role === 'parent') {
      await Promise.all(allMissions.map(async (m) => {
        const done = await isMissionCompletedToday(family.id, m.id);
        if (done) completedSet.add(m.id);
      }));
      setCompletedCustomIds(completedSet);
    }

    // Personal points (for child reward progress bar)
    const { data: ptsRow } = await supabase.from('points').select('total_points').eq('user_id', user.id).eq('family_id', family.id).maybeSingle();
    setMyPersonalPoints(ptsRow?.total_points || 0);

    // Country flag from localStorage
    setMyFlag(localStorage.getItem(`musfam_flag_${user.id}`) || '');
    setLoading(false);
  }, [family, user, profile]);

  const loadAuraBoard = useCallback(async () => {
    if (!family) return;
    setAuraLoading(true);
    try {
      const { data: pointsRows } = await supabase
        .from('points')
        .select('family_id, user_id, total_points');

      if (pointsRows) {
        const familyTotals = new Map<string, number>();
        for (const row of pointsRows) {
          familyTotals.set(row.family_id, (familyTotals.get(row.family_id) ?? 0) + row.total_points);
        }
        const familyIds = [...familyTotals.keys()];
        const { data: familyRows } = await supabase.from('families').select('id, name').in('id', familyIds);
        const familyNameMap = new Map<string, string>();
        for (const f of (familyRows ?? [])) familyNameMap.set(f.id, f.name);

        // Dense rank for families (ties share rank, secondary sort: name)
        // If fewer than 3 families in DB, pad with demo competitor families for leaderboard
        const DEMO_COMPETITORS: FamilyRank[] = [
          { family_id: 'demo-barakah', family_name: 'Keluarga Barakah', total_points: 1980, rank: 0 },
          { family_id: 'demo-shaleh',  family_name: 'Keluarga Shaleh',  total_points: 1450, rank: 0 },
          { family_id: 'demo-nur',     family_name: 'Keluarga Nur',     total_points: 980,  rank: 0 },
        ];
        const realFamilyCount = familyTotals.size;
        for (const demo of DEMO_COMPETITORS) {
          if (realFamilyCount < 3 && !familyTotals.has(demo.family_id)) {
            familyTotals.set(demo.family_id, demo.total_points);
            familyNameMap.set(demo.family_id, demo.family_name);
          }
        }
        const sortedFamilies = [...familyTotals.entries()]
          .sort((a, b) => b[1] - a[1] || (familyNameMap.get(a[0]) || '').localeCompare(familyNameMap.get(b[0]) || ''));
        let familyRankNum = 0, prevFamilyPts = -1;
        setAuraBoard(sortedFamilies.map(([fid, pts]) => {
          if (pts !== prevFamilyPts) { familyRankNum++; prevFamilyPts = pts; }
          return { family_id: fid, family_name: familyNameMap.get(fid) || 'Family', total_points: pts, rank: familyRankNum };
        }));

        const memberTotals = new Map<string, { total: number; family_id: string }>();
        for (const row of pointsRows) {
          if (!row.user_id) continue;
          const prev = memberTotals.get(row.user_id);
          memberTotals.set(row.user_id, { total: (prev?.total ?? 0) + row.total_points, family_id: row.family_id });
        }
        const userIds = [...memberTotals.keys()];
        const { data: profileRows } = await supabase.from('profiles').select('id, name, family_id').in('id', userIds);
        const profileMap = new Map<string, { name: string; family_id: string }>();
        for (const p of (profileRows ?? [])) profileMap.set(p.id, { name: p.name, family_id: p.family_id });

        // Dense rank for members (ties share rank, secondary sort: name)
        const sortedMembers = [...memberTotals.entries()]
          .sort((a, b) => b[1].total - a[1].total || (profileMap.get(a[0])?.name || '').localeCompare(profileMap.get(b[0])?.name || ''));
        let memberRankNum = 0, prevMemberPts = -1;
        const memberRanks = sortedMembers.map(([uid, info]) => {
          if (info.total !== prevMemberPts) { memberRankNum++; prevMemberPts = info.total; }
          const prof = profileMap.get(uid);
          return { user_id: uid, member_name: prof?.name || 'Member', family_name: familyNameMap.get(info.family_id) || 'Family', total_points: info.total, rank: memberRankNum, is_me: false };
        });
        const meUid = (await supabase.auth.getUser()).data.user?.id;
        setMemberBoard(memberRanks.map(m => ({ ...m, is_me: m.user_id === meUid })));
      }
      setMyFamilyPoints(await getFamilyPoints(family.id));
    } catch { /* ignore */ }
    setAuraLoading(false);
  }, [family]);

  useEffect(() => { refreshMissions(); }, [refreshMissions]);
  useEffect(() => { if (tab === 'aura') loadAuraBoard(); }, [tab, loadAuraBoard]);

  function openCompletion(target: CompletionTarget) {
    setCompletionTarget(target);
    setReflectionText('');
    setProofNote('');
    setProofFile(null);
  }

  async function handleSubmitCompletion() {
    if (!user || !family || !completionTarget) return;
    if (reflectionText.trim().length < 10) return;
    setSubmitting(true);

    // Upload proof image if selected
    let finalProofNote = proofNote;
    if (proofFile) {
      setUploadingProof(true);
      const url = await uploadProofImage(proofFile, user.id);
      setUploadingProof(false);
      if (url) finalProofNote = url;
    }

    const finalReflection = finalProofNote.trim()
      ? `[Proof: ${finalProofNote.trim()}] ${reflectionText}`
      : reflectionText;

    let success = false;
    if (completionTarget.type === 'daily') {
      const result = await completeMission(user.id, family.id, completionTarget.id, finalReflection, profile?.name, profile?.role);
      success = !!result;
    } else {
      const result = await completeCustomMission(user.id, family.id, completionTarget.id, finalReflection, profile?.name, profile?.role);
      success = !!result;
    }
    setSubmitting(false);
    if (!success) return; // already completed or error
    setCompletionTarget(null);
    setReflectionText('');
    setProofNote('');
    setProofFile(null);
    // Immediately mark as done so UI updates without waiting for refresh
    const isChildRole = profile?.role === 'child';
    if (completionTarget.type === 'daily') {
      setMissionCompleted(true);
      if (isChildRole) setMissionPendingApproval(true);
    } else {
      setCompletedCustomIds(prev => new Set([...prev, completionTarget.id]));
    }
    refreshMissions();
  }

  async function handleDeleteActivity(id: string) {
    await deleteActivity(id);
    setActivities(prev => prev.filter(a => a.id !== id));
  }

  // Parent: add mission
  async function handleAddMission() {
    if (!newMissionTitle.trim() || !user || !family) return;
    setAddingMission(true);
    await addMission(family.id, user.id, {
      title: newMissionTitle.trim(), description: '', category: newMissionCat,
      icon: newMissionCat === 'spiritual' ? 'sparkles' : newMissionCat === 'health' ? 'activity' : newMissionCat === 'chores' ? 'home' : 'book-open',
      points: parseInt(newMissionPoints) || 10,
      visible_to_child: newMissionVisible,
    });
    setNewMissionTitle(''); setNewMissionPoints('10'); setNewMissionVisible(true);
    setShowAddMission(false);
    const m = await getMissions(family.id); setCustomMissions(m);
    setAddingMission(false);
  }

  // Parent: add reward
  async function handleAddReward() {
    if (!newRewardName.trim() || !newRewardCost || !family) return;
    const cost = parseInt(newRewardCost);
    if (isNaN(cost) || cost <= 0) return;
    setAddingReward(true);
    await addReward(family.id, { name: newRewardName.trim(), cost, icon: newRewardIcon });
    setNewRewardName(''); setNewRewardCost(''); setNewRewardIcon('🎁');
    setShowAddReward(false);
    const r = await getRewards(family.id); setRewards(r);
    setAddingReward(false);
  }

  // Parent: approve/reject
  async function handleApprove(a: PendingApproval) {
    if (!family) return;
    await approveCompletion(a.id, a.user_id, family.id, a.points_earned);
    setPendingApprovals(prev => prev.filter(x => x.id !== a.id));
  }
  async function handleReject(a: PendingApproval) {
    if (!family || !profile) return;
    await rejectCompletion(a.id, family.id, a.submitter_name || 'Child', profile.name);
    setPendingApprovals(prev => prev.filter(x => x.id !== a.id));
  }

  // Child: submit mission from this page
  async function handleChildSubmit() {
    if (!submitTarget || !user || !family || !profile) return;
    if (submitReflection.trim().length < 5) return;
    setSubmitSubmitting(true);
    const missionId = submitTarget.id;
    const result = await completeCustomMission(user.id, family.id, missionId, submitReflection.trim(), profile.name, profile.role);
    if (result) {
      setCompletedCustomIds(prev => new Set([...prev, missionId]));
      setRejectedMissionIds(prev => prev.filter(id => id !== missionId));
    }
    setSubmitTarget(null); setSubmitReflection(''); setSubmitSubmitting(false);
  }

  async function handleClearHistory() {
    if (!family) return;
    setClearingHistory(true);
    await clearAllActivities(family.id);
    setActivities([]);
    setShowClearConfirm(false);
    setClearingHistory(false);
  }

  if (loading) {
    return (
      <LoadingBlock fullScreen />
    );
  }

  const reflectionCharCount = reflectionText.trim().length;
  const myRank = auraBoard.find(r => r.family_id === family?.id);

  return (
    <>
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24 page-enter">

        {/* Tab switcher */}
        <div className="flex mx-4 mt-4 gap-2">
          <button type="button" onClick={() => setTab('missions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors ${tab === 'missions' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
            <CheckCircle size={15} /> Missions
          </button>
          <button type="button" onClick={() => setTab('aura')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors ${tab === 'aura' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
            <Trophy size={15} /> Aura Board
          </button>
        </div>

        {/* ══════ MISSIONS TAB ══════ */}
        {tab === 'missions' && (
          <div className="px-4 pt-4 space-y-4">

            {/* Daily Quran Mission */}
            {dailyMission && (
              <div className={`rounded-2xl border overflow-hidden ${missionCompleted ? 'border-forest/30' : 'border-cream-dark'}`}>
                <div className="bg-gradient-to-r from-forest to-olive px-4 py-3 batik-overlay">
                  <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                    Daily · {formatVerseRef(dailyMission.verse_key)}
                  </p>
                  <p className="text-white font-extrabold text-sm leading-snug">
                    {dailyMission.is_parent_override && dailyMission.parent_override_text
                      ? dailyMission.parent_override_text
                      : dailyMission.generated_text}
                  </p>
                </div>
                <div className={`px-4 py-3 ${missionCompleted ? 'bg-forest/5' : 'bg-white'}`}>
                  {missionCompleted ? (
                    <p className={`text-sm font-bold flex items-center gap-2 ${missionPendingApproval ? 'text-amber-600' : 'text-green-600'}`}>
                      <CheckCircle size={16} />
                      {missionPendingApproval ? 'Submitted — awaiting parent approval' : 'Completed — Alhamdulillah!'}
                    </p>
                  ) : (
                    <button type="button"
                      onClick={() => openCompletion({ type: 'daily', id: dailyMission.id, title: dailyMission.generated_text, prompt: dailyMission.parent_override_prompt ?? undefined })}
                      className="w-full py-2.5 rounded-xl bg-forest text-white text-sm font-bold flex items-center justify-center gap-2">
                      <CheckCircle size={15} /> Complete + Reflect
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── PARENT COMMAND CENTER ── */}
            {profile?.role === 'parent' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-forest" />
                  <p className="text-xs font-bold text-forest uppercase tracking-wider">Command Center</p>
                </div>

                {/* Pending approvals */}
                {pendingApprovals.length > 0 && (
                  <div className="bg-white rounded-2xl border-2 border-amber-300 overflow-hidden">
                    <div className="px-4 py-3 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
                      <Bell size={13} className="text-amber-600" />
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wider flex-1">Waiting for Review</p>
                      <span className="text-xs font-extrabold bg-amber-500 text-white w-5 h-5 rounded-full flex items-center justify-center">{pendingApprovals.length}</span>
                    </div>
                    <div className="divide-y divide-amber-100">
                      {pendingApprovals.map(a => (
                        <div key={a.id} className="px-4 py-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-extrabold text-amber-700">{(a.submitter_name || '?').charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800">{a.submitter_name || 'Child'}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5 italic leading-relaxed line-clamp-2">&quot;{a.reflection_text}&quot;</p>
                              <p className="text-[9px] text-amber-600 font-bold mt-1">+{a.points_earned} AP on approval</p>
                            </div>
                          </div>
                          <div className="flex gap-2 pl-9">
                            <button type="button" onClick={() => handleApprove(a)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500 text-white text-xs font-bold rounded-xl">
                              <ThumbsUp size={12} /> Approve
                            </button>
                            <button type="button" onClick={() => handleReject(a)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-100 text-red-600 text-xs font-bold rounded-xl">
                              <ThumbsDown size={12} /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missions list */}
                <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
                  <div className="px-4 py-3 border-b border-cream-dark flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={13} className="text-forest" />
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Missions</p>
                    </div>
                    <button type="button" onClick={() => setShowAddMission(true)}
                      className="flex items-center gap-1 bg-forest text-white text-[10px] font-bold px-3 py-1.5 rounded-full">
                      <Plus size={10} /> New
                    </button>
                  </div>
                  <div className="divide-y divide-cream-dark">
                    {customMissions.map(m => {
                      const done = completedCustomIds.has(m.id);
                      const catDot: Record<string, string> = { spiritual: 'bg-blue-500', health: 'bg-green-500', chores: 'bg-amber-500', education: 'bg-lime-500' };
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${catDot[m.category] ?? 'bg-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold leading-tight ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{m.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400 capitalize">{m.category}</span>
                              <span className="text-[10px] font-bold text-forest">+{m.points ?? 10} AP</span>
                            </div>
                          </div>
                          <button type="button"
                            onClick={() => updateMission(m.id, { visible_to_child: !m.visible_to_child }).then(() => getMissions(family!.id).then(setCustomMissions))}
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.visible_to_child ? 'text-forest bg-forest/10' : 'text-gray-300 bg-gray-100'}`}>
                            {m.visible_to_child ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button type="button" onClick={() => deleteMission(m.id).then(() => getMissions(family!.id).then(setCustomMissions))}
                            className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                    {customMissions.length === 0 && (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs text-gray-400">No missions yet</p>
                        <button type="button" onClick={() => setShowAddMission(true)} className="mt-2 text-xs font-bold text-forest underline">Add your first mission</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rewards list */}
                <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
                  <div className="px-4 py-3 border-b border-cream-dark flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift size={13} className="text-yellow-600" />
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Rewards</p>
                    </div>
                    <button type="button" onClick={() => setShowAddReward(true)}
                      className="flex items-center gap-1 bg-yellow-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full">
                      <Plus size={10} /> New
                    </button>
                  </div>
                  <div className="divide-y divide-cream-dark">
                    {rewards.map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-lg flex-shrink-0">{r.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
                          <span className="text-[10px] font-bold text-yellow-600">{r.cost.toLocaleString()} AP</span>
                          {r.claimed && <span className="ml-2 text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Claimed</span>}
                        </div>
                        <button type="button"
                          onClick={() => updateReward(r.id, { visible_to_child: !r.visible_to_child }).then(() => getRewards(family!.id).then(setRewards))}
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${r.visible_to_child ? 'text-forest bg-forest/10' : 'text-gray-300 bg-gray-100'}`}>
                          {r.visible_to_child ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button type="button" onClick={() => deleteReward(r.id).then(() => getRewards(family!.id).then(setRewards))}
                          className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                    {rewards.length === 0 && (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs text-gray-400">No rewards yet</p>
                        <button type="button" onClick={() => setShowAddReward(true)} className="mt-2 text-xs font-bold text-yellow-600 underline">Add your first reward</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── CHILD MISSIONS & REWARDS ── */}
            {profile?.role === 'child' && (
              <div className="space-y-3">
                {/* Custom missions */}
                {customMissions.length > 0 && (
                  <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
                    <div className="px-4 py-3 border-b border-cream-dark flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={13} className="text-forest" />
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Today&apos;s Missions</p>
                      </div>
                      <span className="text-[10px] font-bold text-forest">
                        {customMissions.filter(m => completedCustomIds.has(m.id)).length}/{customMissions.length} done
                      </span>
                    </div>
                    <div className="divide-y divide-cream-dark">
                      {customMissions.map(m => {
                        const isCompleted = completedCustomIds.has(m.id);
                        const isRejected = rejectedMissionIds.includes(m.id);
                        const catColors: Record<string, string> = { spiritual: 'bg-blue-500', health: 'bg-green-500', chores: 'bg-amber-500', education: 'bg-lime-500' };
                        if (isRejected) {
                          return (
                            <div key={m.id} className="px-4 py-3 space-y-2 bg-red-50">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl ${catColors[m.category] ?? 'bg-gray-400'} flex items-center justify-center flex-shrink-0`}>
                                  <X size={16} className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-red-700 leading-tight">{m.title}</p>
                                  <span className="text-[10px] font-bold text-red-500">Not approved</span>
                                </div>
                                <button type="button" onClick={() => setSubmitTarget(m)}
                                  className="bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                                  Resubmit
                                </button>
                              </div>
                              <div className="flex items-start gap-2 bg-red-100 rounded-xl px-3 py-2">
                                <span className="text-red-400 text-xs flex-shrink-0 mt-0.5">⚠️</span>
                                <p className="text-[11px] text-red-700 leading-relaxed">Your parent didn&apos;t accept this. Write a more detailed reflection and resubmit.</p>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <button key={m.id} type="button" disabled={isCompleted}
                            onClick={() => { if (!isCompleted) setSubmitTarget(m); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isCompleted ? 'opacity-60' : 'active:bg-cream-light'}`}>
                            <div className={`w-9 h-9 rounded-xl ${catColors[m.category] ?? 'bg-gray-400'} flex items-center justify-center flex-shrink-0`}>
                              {isCompleted ? <Check size={16} className="text-white" /> : <Star size={16} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold leading-tight ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{m.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400 capitalize">{m.category}</span>
                                <span className="text-[10px] font-bold text-forest">+{m.points ?? 10} AP</span>
                                {isCompleted && <span className="text-[10px] font-bold text-amber-600">Waiting approval…</span>}
                              </div>
                            </div>
                            {!isCompleted && <div className="bg-forest text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0">Submit</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Rewards progress */}
                {rewards.length > 0 && (
                  <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
                    <div className="px-4 py-3 border-b border-cream-dark flex items-center gap-2">
                      <Gift size={13} className="text-yellow-600" />
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">My Rewards</p>
                    </div>
                    <div className="divide-y divide-cream-dark">
                      {rewards.map(r => {
                        const pct = Math.min(Math.round((myPersonalPoints / r.cost) * 100), 100);
                        const ready = myPersonalPoints >= r.cost;
                        return (
                          <div key={r.id} className={`px-4 py-3 ${r.claimed ? 'bg-green-50' : ''}`}>
                            <div className="flex items-center gap-3 mb-1.5">
                              <span className="text-xl flex-shrink-0">{r.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-gray-800 truncate">{r.name}</p>
                                  {r.claimed && <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Check size={8} /> Claimed!</span>}
                                  {!r.claimed && ready && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Ready!</span>}
                                </div>
                                <p className="text-[10px] text-gray-400">{r.cost.toLocaleString()} AP</p>
                              </div>
                              {!r.claimed && <span className={`text-xs font-extrabold ${ready ? 'text-green-600' : 'text-gray-400'}`}>{pct}%</span>}
                            </div>
                            {r.claimed ? (
                              <p className="text-[11px] text-green-700 font-semibold">🎉 Your parent granted this reward! Enjoy it.</p>
                            ) : (
                              <>
                                <div className="w-full h-2.5 bg-cream-dark rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${ready ? 'bg-green-500' : 'bg-gradient-to-r from-yellow-400 to-amber-500'}`} style={{ width: `${pct}%` }} />
                                </div>
                                {ready && <p className="text-[10px] font-bold text-amber-600 mt-1">Tell your parent you&apos;re ready! 🎯</p>}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {customMissions.length === 0 && rewards.length === 0 && (
                  <div className="bg-white rounded-2xl border border-cream-dark p-6 text-center">
                    <p className="text-2xl mb-2">🕌</p>
                    <p className="text-sm font-bold text-gray-600">No missions yet</p>
                    <p className="text-xs text-gray-400 mt-1">Your parent hasn&apos;t added any missions yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Activity History */}
            <div className="pt-2 border-t border-cream-dark">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-extrabold text-gray-700">Activity History</h2>
                {activities.length > 0 && (
                  <button type="button" onClick={() => setShowClearConfirm(true)}
                    className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                    <Trash2 size={12} /> Clear all
                  </button>
                )}
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
              ) : (
                <div className="space-y-2">
                  {activities.map(a => {
                    const isPos = a.points_change > 0;
                    return (
                      <div key={a.id} className="bg-white rounded-2xl px-4 py-3 border border-cream-dark flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isPos ? 'bg-green-100' : 'bg-red-50'}`}>
                          <Gift size={14} className={isPos ? 'text-green-600' : 'text-red-400'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">{a.description}</p>
                          <p className="text-[10px] text-gray-400">{formatRelative(a.created_at)}</p>
                        </div>
                        <span className={`font-bold text-sm flex-shrink-0 ${isPos ? 'text-green-600' : 'text-red-500'}`}>
                          {isPos ? '+' : ''}{a.points_change} AP
                        </span>
                        <button type="button" title="Delete" onClick={() => handleDeleteActivity(a.id)}
                          className="text-gray-200 hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ AURA BOARD TAB ══════ */}
        {tab === 'aura' && (
          <div className="px-4 pt-4 space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800">Aura Board</h1>
              <p className="text-sm text-gray-500 mt-0.5">Global family rankings</p>
            </div>

            {myRank && (
              <div className="bg-gradient-to-r from-forest to-olive rounded-2xl p-4 text-white batik-overlay">
                <p className="text-xs opacity-70 font-bold uppercase tracking-widest">Your Family</p>
                <p className="text-xl font-extrabold mt-0.5">{family?.name}</p>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-3xl font-extrabold">{myFamilyPoints.toLocaleString()}</p>
                    <p className="text-xs opacity-70">Aura Points</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-extrabold opacity-90">#{myRank.rank}</p>
                    <p className="text-xs opacity-60">rank</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setAuraSubTab('members')}
                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${auraSubTab === 'members' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                Members
              </button>
              <button type="button" onClick={() => setAuraSubTab('families')}
                className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${auraSubTab === 'families' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                Families
              </button>
            </div>

            {auraLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={28} className="animate-spin text-forest/40" />
              </div>
            ) : auraSubTab === 'families' ? (
              <>
                {auraBoard.length >= 3 && (
                  <div className="flex items-end justify-center gap-3 pt-2 pb-4">
                    <div className="flex-1 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gray-200 border-4 border-gray-300 flex items-center justify-center mb-2">
                        <Medal size={20} className="text-gray-500" />
                      </div>
                      <div className="w-full bg-gray-100 rounded-t-xl flex flex-col items-center py-3 h-[70px]">
                        <p className="text-lg font-extrabold text-gray-600">2</p>
                      </div>
                      <p className="text-[10px] font-bold text-gray-600 text-center mt-1 truncate w-full px-1">{auraBoard[1]?.family_name}</p>
                      <p className="text-[10px] text-gray-400">{auraBoard[1]?.total_points.toLocaleString()} AP</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center">
                      <Crown size={20} className="text-gold mb-1" />
                      <div className="w-14 h-14 rounded-full bg-gold/20 border-4 border-gold flex items-center justify-center mb-2">
                        <Trophy size={22} className="text-gold" />
                      </div>
                      <div className="w-full bg-gold/20 rounded-t-xl flex flex-col items-center py-3 h-[90px]">
                        <p className="text-xl font-extrabold text-gold-dark">1</p>
                      </div>
                      <p className="text-[10px] font-bold text-gray-700 text-center mt-1 truncate w-full px-1">{auraBoard[0]?.family_name}</p>
                      <p className="text-[10px] text-gray-400">{auraBoard[0]?.total_points.toLocaleString()} AP</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-amber-100 border-4 border-amber-300 flex items-center justify-center mb-2">
                        <Medal size={20} className="text-amber-600" />
                      </div>
                      <div className="w-full bg-amber-50 rounded-t-xl flex flex-col items-center py-3 h-[55px]">
                        <p className="text-lg font-extrabold text-amber-600">3</p>
                      </div>
                      <p className="text-[10px] font-bold text-gray-600 text-center mt-1 truncate w-full px-1">{auraBoard[2]?.family_name}</p>
                      <p className="text-[10px] text-gray-400">{auraBoard[2]?.total_points.toLocaleString()} AP</p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {auraBoard.map(r => {
                    const isMe = r.family_id === family?.id;
                    const isTied = auraBoard.filter(x => x.rank === r.rank).length > 1;
                    const rankLabel = `${isTied ? '=' : ''}${r.rank}`;
                    return (
                      <div key={r.family_id} className={`rounded-2xl px-4 py-3 border flex items-center gap-3 ${isMe ? 'bg-forest/5 border-forest/30' : 'bg-white border-cream-dark'}`}>
                        <span className={`text-sm font-extrabold w-7 text-center ${r.rank <= 3 ? 'text-gold-dark' : 'text-gray-400'}`}>{rankLabel}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm ${isMe ? 'text-forest' : 'text-gray-800'}`}>{r.family_name}</p>
                          {isMe && <p className="text-[10px] text-forest/60 font-bold">Your family</p>}
                        </div>
                        <span className="font-extrabold text-sm text-gray-700">{r.total_points.toLocaleString()} AP</span>
                      </div>
                    );
                  })}
                  {auraBoard.length === 0 && (
                    <div className="text-center py-12">
                      <Trophy size={40} className="text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No rankings yet</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {memberBoard.map(m => {
                  const isTiedM = memberBoard.filter(x => x.rank === m.rank).length > 1;
                  const rankLabelM = `${isTiedM ? '=' : ''}${m.rank}`;
                  const flag = m.is_me ? myFlag : '';
                  return (
                  <div key={m.user_id} className={`rounded-2xl px-4 py-3 border flex items-center gap-3 ${m.is_me ? 'bg-forest/5 border-forest/30' : 'bg-white border-cream-dark'}`}>
                    <span className={`text-sm font-extrabold w-7 text-center ${m.rank <= 3 ? 'text-gold-dark' : 'text-gray-400'}`}>{rankLabelM}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {flag && <span className="text-base leading-none flex-shrink-0">{flag}</span>}
                        <p className={`font-bold text-sm ${m.is_me ? 'text-forest' : 'text-gray-800'}`}>{m.member_name}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">{m.family_name}</p>
                    </div>
                    <span className="font-extrabold text-sm text-gray-700">{m.total_points.toLocaleString()} AP</span>
                  </div>
                  );
                })}
                {memberBoard.length === 0 && (
                  <div className="text-center py-12">
                    <Trophy size={40} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No member rankings yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Unified completion modal ── */}
      {completionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setCompletionTarget(null); }}>
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-gray-800">Complete Mission</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Proof + reflection required</p>
              </div>
              <button type="button" title="Close" onClick={() => setCompletionTarget(null)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">

              {/* Mission context card */}
              <div className="bg-forest/5 rounded-2xl p-4 border border-forest/10">
                <p className="text-[10px] font-bold text-forest uppercase tracking-widest mb-1">
                  {completionTarget.type === 'daily' ? 'Quran Mission' : 'Family Mission'}
                </p>
                <p className="text-sm font-bold text-gray-800 leading-snug">{completionTarget.title}</p>
              </div>

              {/* Reflection prompt (italic quote) */}
              {completionTarget.prompt && (
                <p className="text-sm text-gray-500 italic leading-relaxed">
                  &ldquo;{completionTarget.prompt}&rdquo;
                </p>
              )}

              {/* Proof */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Proof <span className="font-normal normal-case text-gray-300">(optional — photo or description)</span>
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer bg-amber-50/60 border border-amber-200/60 rounded-2xl px-4 py-3 hover:bg-amber-50 transition-colors">
                  <ImageIcon size={16} className="text-amber-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500 flex-1 truncate">
                    {proofFile ? proofFile.name : 'Upload photo...'}
                  </span>
                  <input type="file" accept="image/*" className="sr-only"
                    onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                </label>
                {!proofFile && (
                  <input type="text" value={proofNote} onChange={e => setProofNote(e.target.value)}
                    placeholder="Or describe your proof..."
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/20" />
                )}
              </div>

              {/* Reflection */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Reflection <span className="text-red-400">*required</span>
                </p>
                <textarea value={reflectionText} onChange={e => setReflectionText(e.target.value)}
                  placeholder="What did you do? What did you learn? How did it make you feel?"
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 bg-amber-50/40 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-forest/20 resize-none leading-relaxed" />
                {reflectionCharCount > 0 && reflectionCharCount < 10 && (
                  <p className="text-[11px] text-amber-500 font-medium mt-1">Add a bit more...</p>
                )}
              </div>
            </div>

            {/* Submit button — always visible outside scroll */}
            <div className="px-6 py-4 flex-shrink-0 border-t border-gray-100">
              <button type="button" onClick={handleSubmitCompletion}
                disabled={submitting || uploadingProof || reflectionCharCount < 10}
                className="w-full py-4 rounded-2xl bg-forest text-white font-extrabold text-sm disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all">
                {(submitting || uploadingProof) ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={16} /> Submit Reflection</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear history confirm */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-800">Clear all history?</h3>
                <p className="text-xs text-gray-400 mt-0.5">This cannot be undone</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-cream-dark text-sm font-bold text-gray-600">Cancel</button>
              <button type="button" onClick={handleClearHistory} disabled={clearingHistory}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {clearingHistory ? <Loader2 size={14} className="animate-spin" /> : 'Clear all'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Parent: Add Mission sheet ── */}
      {showAddMission && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) closeAddMission(); }}>
          <div
            ref={setAddMissionSheetRef}
            onTouchStart={handleAddMissionTouchStart}
            onTouchMove={handleAddMissionTouchMove}
            onTouchEnd={handleAddMissionTouchEnd}
            className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-cream-dark">
              <h3 className="text-base font-extrabold text-gray-800">New Mission</h3>
              <button type="button" onClick={closeAddMission} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={15} className="text-gray-500" /></button>
            </div>
            <div ref={addMissionContentRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 pb-[220px]">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Mission Title</label>
                <input type="text" value={newMissionTitle} onChange={e => setNewMissionTitle(e.target.value)}
                  ref={missionTitleInputRef}
                  placeholder="e.g. Read 2 pages of Quran"
                  className="w-full rounded-xl border border-cream-dark bg-cream-light px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Category</label>
                <div className="flex gap-2 flex-wrap">
                  {(['spiritual', 'health', 'chores', 'education'] as Mission['category'][]).map(cat => {
                    const dotColors: Record<string, string> = { spiritual: 'bg-blue-500', health: 'bg-green-500', chores: 'bg-amber-500', education: 'bg-lime-500' };
                    return (
                      <button key={cat} type="button" onClick={() => setNewMissionCat(cat)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${newMissionCat === cat ? 'bg-forest text-white' : 'bg-cream-dark text-gray-600'}`}>
                        <span className={`w-2 h-2 rounded-full ${dotColors[cat]}`} />
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">AP Points</label>
                  <input type="number" value={newMissionPoints} min="1" max="999" onChange={e => setNewMissionPoints(e.target.value)}
                    className="w-full rounded-xl border border-cream-dark bg-cream-light px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Visible to Child</label>
                  <button type="button" onClick={() => setNewMissionVisible(v => !v)}
                    className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-bold ${newMissionVisible ? 'bg-forest/10 text-forest' : 'bg-gray-100 text-gray-400'}`}>
                    {newMissionVisible ? <><Eye size={14} /> Yes</> : <><EyeOff size={14} /> Hidden</>}
                  </button>
                </div>
              </div>
              <div className="h-6" aria-hidden="true" />
            </div>
            <div className="px-5 py-4 border-t border-cream-dark flex-shrink-0 bg-white">
              <button type="button" onClick={handleAddMission} disabled={!newMissionTitle.trim() || addingMission}
                className="w-full py-3 rounded-xl bg-forest text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                {addingMission ? <Loader2 size={16} className="animate-spin" /> : '+ Add Mission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Parent: Add Reward sheet ── */}
      {showAddReward && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) closeAddReward(); }}>
          <div
            ref={setAddRewardSheetRef}
            onTouchStart={handleAddRewardTouchStart}
            onTouchMove={handleAddRewardTouchMove}
            onTouchEnd={handleAddRewardTouchEnd}
            className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-cream-dark">
              <h3 className="text-base font-extrabold text-gray-800">New Reward</h3>
              <button type="button" onClick={closeAddReward} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={15} className="text-gray-500" /></button>
            </div>
            <div ref={addRewardContentRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 pb-[220px]">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {['🎁', '⭐', '🍕', '🎮', '📚', '🎨', '🧸', '🍦', '🎉', '🏆', '💝', '🌟'].map(icon => (
                    <button key={icon} type="button" onClick={() => setNewRewardIcon(icon)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${newRewardIcon === icon ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-cream-light hover:bg-cream-dark'}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Reward Name</label>
                <input type="text" value={newRewardName} onChange={e => setNewRewardName(e.target.value)}
                  ref={rewardNameInputRef}
                  placeholder="e.g. Pizza night"
                  className="w-full rounded-xl border border-cream-dark bg-cream-light px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">AP Cost</label>
                <input type="number" value={newRewardCost} min="1" onChange={e => setNewRewardCost(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full rounded-xl border border-cream-dark bg-cream-light px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40" />
              </div>
              <div className="h-6" aria-hidden="true" />
            </div>
            <div className="px-5 py-4 border-t border-cream-dark flex-shrink-0 bg-white">
              <button type="button" onClick={handleAddReward} disabled={!newRewardName.trim() || !newRewardCost || addingReward}
                className="w-full py-3 rounded-xl bg-yellow-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                {addingReward ? <Loader2 size={16} className="animate-spin" /> : '+ Add Reward'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Child: Submit mission modal ── */}
      {submitTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) closeSubmitMission(); }}>
          <div
            ref={setSubmitMissionSheetRef}
            onTouchStart={handleSubmitMissionTouchStart}
            onTouchMove={handleSubmitMissionTouchMove}
            onTouchEnd={handleSubmitMissionTouchEnd}
            className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-cream-dark">
              <div>
                <h3 className="text-base font-extrabold text-gray-800">Submit Mission</h3>
                <p className="text-[11px] text-gray-400">{submitTarget.title}</p>
              </div>
              <button type="button" onClick={closeSubmitMission} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={15} className="text-gray-500" /></button>
            </div>
            <div ref={submitMissionContentRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 pb-[220px]">
              <div className="flex items-center gap-2 bg-forest/5 rounded-xl px-3 py-2">
                <Star size={14} className="text-forest" />
                <p className="text-sm text-gray-700">Earn <span className="font-extrabold text-forest">+{submitTarget.points ?? 10} AP</span> on approval</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Your Reflection</label>
                <textarea value={submitReflection} onChange={e => setSubmitReflection(e.target.value)}
                  ref={submitReflectionInputRef}
                  placeholder="What did you learn or feel completing this mission?" rows={4}
                  className="w-full rounded-xl border border-cream-dark bg-cream-light px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-forest/30" />
                <p className="text-[10px] text-gray-400 mt-1">{submitReflection.trim().length} / 5 min characters</p>
              </div>
              <div className="h-6" aria-hidden="true" />
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-cream-dark flex-shrink-0 bg-white">
                <button type="button" onClick={closeSubmitMission}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm">Cancel</button>
                <button type="button" onClick={handleChildSubmit} disabled={submitReflection.trim().length < 5 || submitSubmitting}
                  className="flex-1 py-3 rounded-xl bg-forest text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                  {submitSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Submit ✓'}
                </button>
              </div>
            </div>
          </div>
      )}
    </>
  );
}
