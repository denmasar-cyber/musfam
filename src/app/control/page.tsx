'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PinGate from '@/components/PinGate';
import {
  getMissions, addMission, deleteMission, updateMission, getTodayCompletions,
  getFamilyPoints, getActivities, getRewards, claimReward,
  addReward, deleteReward, getDailyMission, setDailyMissionOverride,
  deleteActivity, clearAllActivities, DailyMission,
  getPendingApprovals, approveCompletion, rejectCompletion, PendingApproval,
  getQuranReads, QuranRead,
} from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import RiverLoading from '@/components/RiverLoading';
import LoadingBlock from '@/components/LoadingBlock';
import { Mission, ActivityEntry, Reward } from '@/lib/types';
import {
  Star, Pencil, Trash2, BookOpen, Diamond, Gift,
  Sun, AlertCircle, Users, Settings2, ShoppingBag,
  Plus, Check, Eye, Loader2, AlertTriangle,
} from 'lucide-react';

type Tab = 'missions' | 'rewards' | 'quran';

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  sun: Sun,
  'alert-circle': AlertCircle,
  'book-open': BookOpen,
  gift: Gift,
  'check-circle': Gift,
};

const categoryColors: Record<Mission['category'], string> = {
  spiritual: 'bg-forest',
  health: 'bg-olive',
  chores: 'bg-gold',
  education: 'bg-forest/70',
};

const categoryLabels: Record<Mission['category'], string> = {
  spiritual: 'Spiritual',
  health: 'Health',
  chores: 'Chores',
  education: 'Education',
};

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'Just now';
  if (h < 24) return `Today, ${new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  if (d === 1) return 'Yesterday';
  return `${d} days ago`;
}

const REWARD_EMOJIS = ['🎮', '🍕', '🎬', '📚', '🧸', '🎁', '⭐', '🏆', '🌟', '🎨', '🚀', '🎯'];

function safeEmoji(icon: string): string {
  // If the stored value looks like an emoji (short, non-ASCII or known emoji char), keep it.
  // Otherwise return a default gift emoji.
  if (!icon || icon.length > 8) return '🎁';
  const isEmoji = /\p{Emoji}/u.test(icon);
  return isEmoji ? icon : '🎁';
}

export default function ControlPage() {
  const { user, family, profile } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('missions');
  const [pinVerified, setPinVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  // Children profiles
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);

  // Missions state
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Mission['category']>('spiritual');

  // Rewards state
  const [points, setPoints] = useState(0);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [showAddReward, setShowAddReward] = useState(false);
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardCost, setNewRewardCost] = useState('');
  const [newRewardIcon, setNewRewardIcon] = useState('🎁');
  const [addingReward, setAddingReward] = useState(false);

  // Mission edit state
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<Mission['category']>('spiritual');

  // Daily mission override state
  const [dailyMission, setDailyMission] = useState<DailyMission | null>(null);
  const [overrideText, setOverrideText] = useState('');
  const [overridePrompt, setOverridePrompt] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  // History state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  // Pending approvals state
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Child filter for missions/rewards tabs ('all' | child id)
  const [selectedChild, setSelectedChild] = useState<string>('all');

  // Quran reading detection
  const [quranReads, setQuranReads] = useState<QuranRead[]>([]);


  // Redirect children away
  useEffect(() => {
    if (profile && profile.role !== 'parent') router.replace('/me');
  }, [profile, router]);

  const refreshAll = useCallback(async () => {
    if (!family) return;
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(new Date().getFullYear(), 0, 0);
    const dayOfYear = Math.floor((+new Date() - +start) / 86400000);
    const VERSES = ['2:255','1:1','2:286','3:173','2:152','3:200','39:53','94:5','94:6','2:45','13:28','65:3','2:177','17:80','18:10','33:41','2:153','3:139','4:103','29:45','73:20','76:9','59:22','2:261'];
    const verseKey = VERSES[dayOfYear % VERSES.length];

    const [allMissions, todayComp, pts, acts, rwds, dm, pending, childrenData, reads] = await Promise.all([
      getMissions(family.id),
      getTodayCompletions(family.id),
      getFamilyPoints(family.id),
      getActivities(family.id),
      getRewards(family.id),
      getDailyMission(family.id, today, verseKey),
      getPendingApprovals(family.id),
      supabase.from('profiles').select('id, name').eq('family_id', family.id).eq('role', 'child'),
      getQuranReads(family.id),
    ]);
    setChildren((childrenData.data ?? []) as { id: string; name: string }[]);
    setMissions(allMissions);
    setCompletedCount(todayComp.length);
    setPoints(pts);
    setActivities(acts);
    setRewards(rwds);
    setPendingApprovals(pending);
    setQuranReads(reads);
    if (dm) {
      setDailyMission(dm);
      setOverrideText(dm.parent_override_text ?? dm.generated_text);
      setOverridePrompt(dm.parent_override_prompt ?? '');
    }
    setLoading(false);
  }, [family]);

  useEffect(() => {
    refreshAll();
    if (family) {
      const verified = sessionStorage.getItem(`musfam_pin_${family.id}`);
      if (verified === 'true') setPinVerified(true);
    }
  }, [refreshAll, family]);

  function handlePinSuccess() {
    setPinVerified(true);
    if (family) sessionStorage.setItem(`musfam_pin_${family.id}`, 'true');
  }

  async function handleApprove(ap: PendingApproval) {
    if (!family) return;
    setApprovingId(ap.id);
    await approveCompletion(ap.id, ap.user_id, ap.family_id, ap.points_earned);
    setPendingApprovals(prev => prev.filter(p => p.id !== ap.id));
    setApprovingId(null);
  }

  async function handleReject(ap: PendingApproval) {
    if (!family || !profile) return;
    setApprovingId(ap.id);
    await rejectCompletion(ap.id, ap.family_id, ap.submitter_name || 'Child', profile.name);
    setPendingApprovals(prev => prev.filter(p => p.id !== ap.id));
    setApprovingId(null);
  }

  async function handleAddMission() {
    if (!newTitle.trim() || !user || !family) return;
    await addMission(family.id, user.id, {
      title: newTitle.trim(), description: '', category: newCategory,
      icon: newCategory === 'spiritual' ? 'sparkles' : newCategory === 'health' ? 'activity' : newCategory === 'chores' ? 'home' : 'book-open',
      assigned_to: selectedChild === 'all' ? undefined : selectedChild,
    });
    setNewTitle(''); refreshAll();
  }

  async function handleAddReward() {
    if (!newRewardName.trim() || !newRewardCost || !family) return;
    const cost = parseInt(newRewardCost);
    if (isNaN(cost) || cost <= 0) return;
    setAddingReward(true);
    await addReward(family.id, { name: newRewardName.trim(), cost, icon: newRewardIcon, assigned_to: selectedChild === 'all' ? undefined : selectedChild });
    setNewRewardName(''); setNewRewardCost(''); setNewRewardIcon('🎁');
    setShowAddReward(false); setAddingReward(false);
    refreshAll();
  }

  async function handleDeleteReward(rewardId: string) {
    await deleteReward(rewardId);
    refreshAll();
  }

  function handleStartEdit(m: Mission) {
    setEditingMissionId(m.id);
    setEditTitle(m.title);
    setEditCategory(m.category);
  }

  async function handleSaveMission() {
    if (!editingMissionId || !editTitle.trim()) return;
    await updateMission(editingMissionId, { title: editTitle.trim(), category: editCategory });
    setEditingMissionId(null);
    refreshAll();
  }

  async function handleSaveOverride() {
    if (!family || !overrideText.trim()) return;
    setSavingOverride(true);
    const today = new Date().toISOString().split('T')[0];
    await setDailyMissionOverride(family.id, today, overrideText.trim(), overridePrompt.trim());
    await refreshAll();
    setSavingOverride(false);
  }

  async function handleClaim(rewardId: string) {
    if (!user || !family) return;
    const ok = await claimReward(user.id, family.id, rewardId);
    if (ok) refreshAll();
  }

  async function handleDeleteActivity(id: string) {
    await deleteActivity(id);
    setActivities(prev => prev.filter(a => a.id !== id));
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
    return <LoadingBlock fullScreen />;
  }

  const totalMissions = missions.length;
  const completionRate = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;
  const nextReward = rewards.find(r => !r.claimed);
  const progressToNext = nextReward ? Math.min((points / nextReward.cost) * 100, 100) : 100;
  const pointsToGo = nextReward ? Math.max(nextReward.cost - points, 0) : 0;
  const proofActivities = activities.filter(a => a.description.includes('[Proof:'));

  return (
    <>
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">

        {!pinVerified ? (
          <div className="px-4 py-4">
            <PinGate familyId={family?.id || ''} onSuccess={handlePinSuccess} />
          </div>
        ) : (
          <>
            {/* Header gradient */}
            <div className="bg-gradient-to-br from-forest to-olive px-5 pt-5 pb-6 relative overflow-hidden batik-overlay">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Guardian</p>
              <h1 className="text-white font-extrabold text-2xl">Control Center</h1>
              <p className="text-white/60 text-sm mt-0.5">Manage family missions & rewards</p>
              <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-4 py-1.5 mt-3">
                <Diamond size={14} className="text-gold" />
                <span className="text-white font-extrabold text-sm">{points.toLocaleString()} Points</span>
              </div>
            </div>

            {/* ═══ PENDING APPROVALS ═══ */}
            {pendingApprovals.length > 0 && (
              <div className="mx-4 mt-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 bg-amber-100/60">
                    <AlertCircle size={15} className="text-amber-600" />
                    <h2 className="font-bold text-amber-800 text-sm">Pending Approvals ({pendingApprovals.length})</h2>
                  </div>
                  <div className="divide-y divide-amber-100">
                    {pendingApprovals.map(ap => (
                      <div key={ap.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-sm">{ap.submitter_name || 'Child'}</p>
                            <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{ap.reflection_text}</p>
                            {ap.proof_url && ap.proof_url.startsWith('http') && (
                              <a href={ap.proof_url} target="_blank" rel="noreferrer" className="text-xs text-forest underline mt-1 inline-block">View proof</a>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">+{ap.points_earned} pts</span>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleApprove(ap)} disabled={approvingId === ap.id}
                            className="flex-1 py-2 rounded-xl bg-forest text-white font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-1">
                            {approvingId === ap.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
                          </button>
                          <button type="button" onClick={() => handleReject(ap)} disabled={approvingId === ap.id}
                            className="flex-1 py-2 rounded-xl bg-red-500 text-white font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-1">
                            {approvingId === ap.id ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />} Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab switcher */}
            <div className="flex mx-4 mt-4 gap-2">
              <button type="button" onClick={() => setTab('missions')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-colors ${tab === 'missions' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                <Settings2 size={13} /> Missions
              </button>
              <button type="button" onClick={() => setTab('rewards')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-colors ${tab === 'rewards' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                <ShoppingBag size={13} /> Rewards
              </button>
              <button type="button" onClick={() => setTab('quran')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-colors relative ${tab === 'quran' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                <BookOpen size={13} /> Quran
                {quranReads.length > 0 && tab !== 'quran' && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold text-white text-[9px] font-bold flex items-center justify-center">{Math.min(quranReads.length, 99)}</span>
                )}
              </button>
            </div>

            {/* ═══ MISSIONS TAB ═══ */}
            {tab === 'missions' && (
              <div className="px-4 pt-4 space-y-4">

                {/* Today's Mission Override */}
                {dailyMission && (
                  <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-cream-dark">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Today&apos;s Quran Mission</p>
                      {dailyMission.is_parent_override && (
                        <span className="text-[10px] font-bold bg-forest/10 text-forest px-2 py-0.5 rounded-full">Override Active</span>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Mission Text</p>
                        <textarea value={overrideText} onChange={e => setOverrideText(e.target.value)}
                          title="Mission text" placeholder="Enter mission text..."
                          rows={3} dir="ltr"
                          className="w-full rounded-xl border border-cream-dark bg-cream-light p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30 resize-none" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Reflection Prompt</p>
                        <input type="text" value={overridePrompt} onChange={e => setOverridePrompt(e.target.value)}
                          placeholder="What question should family members answer?"
                          className="w-full rounded-xl border border-cream-dark bg-cream-light p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
                      </div>
                      <button type="button" onClick={handleSaveOverride} disabled={savingOverride || !overrideText.trim()}
                        className="w-full py-2.5 rounded-xl bg-forest text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                        {savingOverride ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Save Override
                      </button>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-white rounded-2xl p-4 border border-cream-dark text-center">
                    <p className="text-2xl font-extrabold text-forest">{completionRate}%</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Completed today</p>
                  </div>
                  <div className="flex-1 bg-white rounded-2xl p-4 border border-cream-dark text-center">
                    <p className="text-2xl font-extrabold text-gold">{totalMissions}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Total missions</p>
                  </div>
                </div>

                {/* Add mission form */}
                <div className="bg-white rounded-2xl p-4 border border-cream-dark space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add New Mission</p>
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    placeholder="Mission title..." onKeyDown={e => e.key === 'Enter' && handleAddMission()}
                    className="w-full rounded-xl border border-cream-dark bg-cream-light p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
                  <div className="flex flex-wrap gap-2">
                    {(['spiritual', 'health', 'chores', 'education'] as Mission['category'][]).map(cat => (
                      <button key={cat} type="button" onClick={() => setNewCategory(cat)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${newCategory === cat ? 'bg-forest text-white' : 'bg-cream-dark text-gray-600'}`}>
                        <span className={`w-2 h-2 rounded-full ${categoryColors[cat]}`} />
                        {categoryLabels[cat]}
                      </button>
                    ))}
                  </div>
                  {selectedChild !== 'all' && (
                    <p className="text-[10px] text-forest font-bold">
                      Will be assigned to {children.find(c => c.id === selectedChild)?.name}
                    </p>
                  )}
                  <button type="button" onClick={handleAddMission} disabled={!newTitle.trim()}
                    className="w-full py-2.5 rounded-xl bg-forest text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                    <Plus size={15} /> Add Mission
                  </button>
                </div>

                {/* Proof submissions banner */}
                {proofActivities.length > 0 && (
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                    <div className="flex items-center gap-2">
                      <Eye size={16} className="text-amber-600" />
                      <p className="text-sm font-bold text-amber-800">{proofActivities.length} proof submission{proofActivities.length > 1 ? 's' : ''}</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {proofActivities.slice(0, 3).map(a => (
                        <div key={a.id} className="text-xs text-amber-700 bg-amber-100/60 rounded-xl p-2">
                          <p className="font-bold">{a.description.replace('[Proof: ', '').replace(']', '')}</p>
                          <p className="text-amber-500 mt-0.5">{formatRelative(a.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Child selector — also controls who new missions get assigned to */}
                {children.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Viewing &amp; assigning for</p>
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                      <button type="button" onClick={() => setSelectedChild('all')}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedChild === 'all' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                        Everyone
                      </button>
                      {children.map(c => (
                        <button key={c.id} type="button" onClick={() => setSelectedChild(c.id)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedChild === c.id ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missions list */}
                <div className="space-y-2">
                  {missions.filter(m => selectedChild === 'all' ? true : (!m.assigned_to || m.assigned_to === selectedChild)).map(m => (
                    <div key={m.id} className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
                      {editingMissionId === m.id ? (
                        <div className="p-4 space-y-3">
                          <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                            autoFocus title="Mission title" placeholder="Mission title..."
                            className="w-full rounded-xl border border-cream-dark bg-cream-light p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
                          <div className="flex flex-wrap gap-2">
                            {(['spiritual', 'health', 'chores', 'education'] as Mission['category'][]).map(cat => (
                              <button key={cat} type="button" onClick={() => setEditCategory(cat)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${editCategory === cat ? 'bg-forest text-white' : 'bg-cream-dark text-gray-600'}`}>
                                <span className={`w-2 h-2 rounded-full ${categoryColors[cat]}`} />
                                {categoryLabels[cat]}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setEditingMissionId(null)}
                              className="flex-1 py-2 rounded-xl border border-cream-dark text-sm font-bold text-gray-600">Cancel</button>
                            <button type="button" onClick={handleSaveMission} disabled={!editTitle.trim()}
                              className="flex-1 py-2 rounded-xl bg-forest text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-1">
                              <Check size={13} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-9 h-9 rounded-xl ${categoryColors[m.category]} flex items-center justify-center flex-shrink-0`}>
                            {m.category === 'spiritual' ? <Star size={16} className="text-white" /> :
                             m.category === 'health' ? <Users size={16} className="text-white" /> :
                             m.category === 'education' ? <BookOpen size={16} className="text-white" /> :
                             <Star size={16} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate">{m.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-[10px] font-bold text-gray-400 uppercase">{categoryLabels[m.category]}</p>
                              {m.assigned_to && (
                                <span className="text-[10px] font-bold bg-forest/10 text-forest px-1.5 py-0.5 rounded-full">
                                  → {children.find(c => c.id === m.assigned_to)?.name ?? 'Child'}
                                </span>
                              )}
                            </div>
                          </div>
                          <button type="button" title="Edit" onClick={() => handleStartEdit(m)} className="text-gray-300 hover:text-forest transition-colors"><Pencil size={16} /></button>
                          <button type="button" title="Delete" onClick={async () => { await deleteMission(m.id); refreshAll(); }} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                  {missions.filter(m => selectedChild === 'all' ? true : (!m.assigned_to || m.assigned_to === selectedChild)).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">
                      {selectedChild === 'all' ? 'No missions yet. Add one above!' : `No missions assigned to ${children.find(c => c.id === selectedChild)?.name ?? 'this child'}.`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ═══ REWARDS TAB ═══ */}
            {tab === 'rewards' && (
              <div className="px-4 pt-4 space-y-4">
                {/* Next reward progress */}
                {nextReward && (
                  <div className="bg-white rounded-2xl p-4 border border-cream-dark">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Next Reward</p>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-extrabold text-gray-800">{nextReward.name}</p>
                      <span className="text-sm font-bold text-forest">{Math.round(progressToNext)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-cream-dark rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-forest rounded-full transition-all" style={{ width: `${progressToNext}%` }} />
                    </div>
                    <p className="text-xs text-gold-dark font-semibold">
                      {pointsToGo > 0 ? `${pointsToGo} more points needed` : 'Ready to claim!'}
                    </p>
                    {pointsToGo === 0 && (
                      <button type="button" onClick={() => handleClaim(nextReward.id)}
                        className="mt-3 w-full py-2.5 rounded-xl bg-gold text-white font-bold text-sm flex items-center justify-center gap-2">
                        <Check size={16} /> Claim Reward
                      </button>
                    )}
                  </div>
                )}

                {/* Add reward */}
                {!showAddReward ? (
                  <button type="button" onClick={() => setShowAddReward(true)}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-cream-dark text-sm font-bold text-gray-400 flex items-center justify-center gap-2 hover:border-forest/40 hover:text-forest transition-colors">
                    <Plus size={16} /> Add New Reward
                  </button>
                ) : (
                  <div className="bg-white rounded-2xl p-4 border border-cream-dark space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Reward</p>
                    <input type="text" value={newRewardName} onChange={e => setNewRewardName(e.target.value)}
                      placeholder="Reward name..." autoFocus
                      className="w-full rounded-xl border border-cream-dark bg-cream-light p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
                    <input type="number" value={newRewardCost} onChange={e => setNewRewardCost(e.target.value)}
                      placeholder="Points required..."
                      className="w-full rounded-xl border border-cream-dark bg-cream-light p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30" />
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Choose icon</p>
                      <div className="flex flex-wrap gap-2">
                        {REWARD_EMOJIS.map(emoji => (
                          <button key={emoji} type="button" onClick={() => setNewRewardIcon(emoji)}
                            className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all ${
                              newRewardIcon === emoji ? 'bg-forest/15 ring-2 ring-forest' : 'bg-cream-light'
                            }`}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    {selectedChild !== 'all' && (
                      <p className="text-[10px] text-forest font-bold">
                        Will be assigned to {children.find(c => c.id === selectedChild)?.name}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowAddReward(false)}
                        className="flex-1 py-2.5 rounded-xl border border-cream-dark text-sm font-bold text-gray-600">Cancel</button>
                      <button type="button" onClick={handleAddReward}
                        disabled={!newRewardName.trim() || !newRewardCost || addingReward}
                        className="flex-1 py-2.5 rounded-xl bg-forest text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                        {addingReward ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Child selector — also controls who new rewards get assigned to */}
                {children.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Viewing &amp; assigning for</p>
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                      <button type="button" onClick={() => setSelectedChild('all')}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedChild === 'all' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                        Everyone
                      </button>
                      {children.map(c => (
                        <button key={c.id} type="button" onClick={() => setSelectedChild(c.id)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedChild === c.id ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* All rewards */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">All Rewards</p>
                  {rewards.filter(r => selectedChild === 'all' ? true : (!r.assigned_to || r.assigned_to === selectedChild)).map(r => (
                    <div key={r.id} className={`bg-white rounded-2xl px-4 py-3 border flex items-center gap-3 ${r.claimed ? 'border-cream-dark opacity-50' : 'border-cream-dark'}`}>
                      <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center text-lg">{safeEmoji(r.icon)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm">{r.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Diamond size={10} className="text-gold" />
                          <span className="text-[11px] font-bold text-gold">{r.cost.toLocaleString()} pts</span>
                          {r.assigned_to && (
                            <span className="text-[10px] font-bold bg-forest/10 text-forest px-1.5 py-0.5 rounded-full">
                              → {children.find(c => c.id === r.assigned_to)?.name ?? 'Child'}
                            </span>
                          )}
                        </div>
                      </div>
                      {r.claimed ? (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">CLAIMED</span>
                      ) : points >= r.cost ? (
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => handleClaim(r.id)}
                            className="text-xs font-bold bg-gold text-white px-3 py-1.5 rounded-full">Claim</button>
                          <button type="button" title="Delete reward" onClick={() => handleDeleteReward(r.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-gray-400">{(r.cost - points).toLocaleString()} more</span>
                          <button type="button" title="Delete reward" onClick={() => handleDeleteReward(r.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                  {rewards.filter(r => selectedChild === 'all' ? true : (!r.assigned_to || r.assigned_to === selectedChild)).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">
                      {selectedChild === 'all' ? 'No rewards yet. Add one above!' : `No rewards for ${children.find(c => c.id === selectedChild)?.name ?? 'this child'}.`}
                    </p>
                  )}
                </div>

                {/* Activity log */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Activity History</p>
                    {activities.length > 0 && (
                      <button type="button" onClick={() => setShowClearConfirm(true)}
                        className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                        <Trash2 size={11} /> Clear all
                      </button>
                    )}
                  </div>
                  {activities.slice(0, 10).map(a => {
                    const Icon = ACTIVITY_ICONS[a.icon] || Gift;
                    const isPos = a.points_change > 0;
                    return (
                      <div key={a.id} className="bg-white rounded-2xl px-4 py-3 border border-cream-dark flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isPos ? 'bg-green-100' : 'bg-red-100'}`}>
                          <Icon size={16} className={isPos ? 'text-green-600' : 'text-red-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">{a.description}</p>
                          <p className="text-[10px] text-gray-400">{formatRelative(a.created_at)}</p>
                        </div>
                        <span className={`font-bold text-sm flex-shrink-0 ${isPos ? 'text-green-600' : 'text-red-500'}`}>
                          {isPos ? '+' : ''}{a.points_change}
                        </span>
                        <button type="button" title="Delete" onClick={() => handleDeleteActivity(a.id)}
                          className="text-gray-200 hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                  {activities.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>}
                </div>
              </div>
            )}

            {/* ═══ QURAN ACTIVITY TAB ═══ */}
            {tab === 'quran' && (
              <div className="px-4 pt-4 space-y-4">
                {/* Child filter */}
                {children.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                    <button type="button" onClick={() => setSelectedChild('all')}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedChild === 'all' ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                      Everyone
                    </button>
                    {children.map(c => (
                      <button key={c.id} type="button" onClick={() => setSelectedChild(c.id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedChild === c.id ? 'bg-forest text-white' : 'bg-white border border-cream-dark text-gray-500'}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Per-child reading progress cards */}
                {children.length > 0 && (
                  <div className="space-y-3">
                    {(selectedChild === 'all' ? children : children.filter(c => c.id === selectedChild)).map(c => {
                      const today = new Date().toISOString().split('T')[0];
                      const allReads = quranReads.filter(r => r.user_id === c.id);
                      const todayReads = allReads.filter(r => r.read_at.startsWith(today));
                      // Spiritual/quran missions assigned to this child or everyone
                      const quranMissions = missions.filter(m =>
                        m.category === 'spiritual' &&
                        (!m.assigned_to || m.assigned_to === c.id)
                      );
                      // Daily goal: 20 verses is a reasonable daily Quran target
                      const DAILY_GOAL = 20;
                      const pct = Math.min(Math.round((todayReads.length / DAILY_GOAL) * 100), 100);
                      const isReading = todayReads.length > 0;
                      return (
                        <div key={c.id} className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-3 border-b border-cream-dark">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isReading ? 'bg-forest' : 'bg-gray-100'}`}>
                                <BookOpen size={14} className={isReading ? 'text-white' : 'text-gray-400'} />
                              </div>
                              <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isReading ? 'bg-forest/10 text-forest' : 'bg-gray-100 text-gray-400'}`}>
                              {isReading ? 'Reading today' : 'Not read today'}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="px-4 pt-3 pb-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] text-gray-400 font-bold uppercase">Today&apos;s reading</p>
                              <p className="text-[11px] font-extrabold text-forest">{todayReads.length} / {DAILY_GOAL} verses</p>
                            </div>
                            <div className="w-full h-3 bg-cream-dark rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: pct >= 100 ? '#d4a017' : '#2d3a10' }}
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">{pct}% of daily goal · {allReads.length} verses total recorded</p>
                          </div>
                          {/* Last read verse */}
                          {todayReads.length > 0 && (
                            <div className="px-4 pb-3 mt-2">
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Last read</p>
                              <div className="flex flex-wrap gap-1.5">
                                {todayReads.slice(0, 6).map(r => (
                                  <span key={r.id} className="text-[10px] font-bold bg-forest/10 text-forest px-2 py-0.5 rounded-full">
                                    {r.verse_key}
                                  </span>
                                ))}
                                {todayReads.length > 6 && (
                                  <span className="text-[10px] text-gray-400 px-2 py-0.5">+{todayReads.length - 6} more</span>
                                )}
                              </div>
                            </div>
                          )}
                          {/* Spiritual missions linked to reading */}
                          {quranMissions.length > 0 && (
                            <div className="px-4 pb-3 border-t border-cream-dark mt-1 pt-2">
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1.5">Spiritual missions</p>
                              <div className="space-y-1">
                                {quranMissions.map(m => (
                                  <div key={m.id} className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isReading ? 'bg-forest' : 'bg-gray-300'}`} />
                                    <p className="text-xs text-gray-600 truncate">{m.title}</p>
                                    {isReading && (
                                      <span className="ml-auto text-[9px] font-bold text-forest bg-forest/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reading log */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reading Log</p>
                  {quranReads
                    .filter(r => selectedChild === 'all' ? true : r.user_id === selectedChild)
                    .slice(0, 30)
                    .map(r => (
                    <div key={r.id} className="bg-white rounded-2xl px-4 py-3 border border-cream-dark flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={15} className="text-forest" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-800 text-sm">{r.reader_name}</p>
                          <span className="text-[10px] font-bold bg-forest/10 text-forest px-1.5 py-0.5 rounded-full">{r.verse_key}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{r.surah_name} · {formatRelative(r.read_at)}</p>
                      </div>
                    </div>
                  ))}
                  {quranReads.filter(r => selectedChild === 'all' ? true : r.user_id === selectedChild).length === 0 && (
                    <div className="text-center py-10">
                      <BookOpen size={32} className="mx-auto text-gray-200 mb-3" />
                      <p className="text-sm font-bold text-gray-400">No Quran reading detected yet</p>
                      <p className="text-xs text-gray-300 mt-1">Verses appear here as children scroll through the Quran page</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

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
    </>
  );
}
