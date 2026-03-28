'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  getMissions, getTodayCompletions, getFamilyPoints, getActivities, 
  getRewards, getDailyMission, getPendingApprovals, approveCompletion, 
  rejectCompletion, setDailyMissionOverride, addMission, 
  deleteMission, updateMission, clearAllActivities, getQuranReads
} from '@/lib/store';
import { syncPostToFoundation, syncActivityToFoundation } from '@/lib/quran-foundation-sync';
import type { Mission, Reward, ActivityEntry, PendingApproval, QuranRead } from '@/lib/types';
import LoadingBlock from '@/components/LoadingBlock';
import { 
  Settings2, ShoppingBag, BookOpen, Check, X, 
  AlertTriangle, Loader2, ArrowUpRight, Star, Eye,
  Camera, MessageSquare, ChevronRight, AlertCircle, Trash2,
  Users, Sparkles, Home, Activity
} from 'lucide-react';

/* === Helpers === */
function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

const CATEGORIES = [
  { id: 'spiritual', label: 'Spiritual', icon: <Sparkles size={14} /> },
  { id: 'health', label: 'Health', icon: <Activity size={14} /> },
  { id: 'chores', label: 'Chores', icon: <Home size={14} /> },
  { id: 'education', label: 'Education', icon: <BookOpen size={14} /> },
] as const;

export default function ControlPage() {
  const { user, profile, family } = useAuth();
  const router = useRouter();

  // Primary State
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [points, setPoints] = useState(0);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [tab, setTab] = useState<'missions' | 'rewards' | 'quran'>('missions');

  // Logic State
  const [dailyMission, setDailyMission] = useState<any>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [quranReads, setQuranReads] = useState<QuranRead[]>([]);
  
  // UI State
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Mission['category']>('spiritual');
  const [overrideText, setOverrideText] = useState('');
  const [overridePrompt, setOverridePrompt] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  /* === Data Loading === */
  const refreshAll = useCallback(async () => {
    if (!family) return;
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const [allMissions, todayComp, pts, acts, rwds, dm, pending, childrenData, reads] = await Promise.all([
        getMissions(family.id),
        getTodayCompletions(family.id),
        getFamilyPoints(family.id),
        getActivities(family.id),
        getRewards(family.id),
        getDailyMission(family.id, today, '2:152'), // Fallback key
        getPendingApprovals(family.id),
        supabase.from('profiles').select('id, name').eq('family_id', family.id).eq('role', 'child'),
        getQuranReads(family.id),
      ]);

      setChildren((childrenData.data ?? []) as any);
      setMissions(allMissions);
      setCompletedCount(todayComp.length);
      setPoints(pts);
      setActivities(acts);
      setRewards(rwds);
      setPendingApprovals(pending);
      setQuranReads(reads);
      
      if (dm) {
        setDailyMission(dm);
        setOverrideText(dm.parent_override_text || dm.generated_text);
        setOverridePrompt(dm.parent_override_prompt || '');
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setLoading(false);
    }
  }, [family]);

  useEffect(() => {
    if (profile && profile.role !== 'parent') {
      router.replace('/');
      return;
    }
    refreshAll();
  }, [profile, family, refreshAll, router]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!family) return;
    const channel = supabase
      .channel('guardian-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mission_completions', filter: `family_id=eq.${family.id}` }, () => {
        refreshAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [family, refreshAll]);

  /* === Handlers === */
  async function handleApprove(ap: PendingApproval) {
    if (!family || !profile) return;
    setApprovingId(ap.id);
    const feedback = feedbacks[ap.id] || "Excellent work! Keeping the family aura strong.";
    
    try {
      const res = await approveCompletion(ap.id, ap.user_id, ap.family_id, ap.points_earned, profile.name, feedback);
      if (res && res.success) {
        setPendingApprovals(prev => prev.filter(p => p.id !== ap.id));
        setSelectedApproval(null);
        refreshAll();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(ap: PendingApproval) {
    if (!family || !profile) return;
    setApprovingId(ap.id);
    const feedback = feedbacks[ap.id] || "Please refine your reflection and try again.";
    
    try {
      await rejectCompletion(ap.id, ap.family_id, ap.submitter_name || 'Child', profile.name, feedback);
      setPendingApprovals(prev => prev.filter(p => p.id !== ap.id));
      setSelectedApproval(null);
      refreshAll();
    } catch (e) {
      console.error(e);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleSaveOverride() {
    if (!family || !dailyMission) return;
    setSavingOverride(true);
    try {
      await setDailyMissionOverride(family.id, dailyMission.date, overrideText);
      refreshAll();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingOverride(false);
    }
  }

  async function handleAddMission() {
    if (!newTitle.trim() || !user || !family) return;
    await addMission(family.id, { title: newTitle.trim(), description: '', category: newCategory, points: 100, created_by: user.id });
    setNewTitle('');
    setShowAddMission(false);
    refreshAll();
  }

  if (loading) return <LoadingBlock fullScreen />;

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9f4]">
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        {/* Sticky Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-[#2d3a10] tracking-tight">Guardian Center</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Guidance & Governance</p>
            </div>
            <div className="bg-[#2d3a10] text-white px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg shadow-[#2d3a10]/20">
              <Star size={14} className="text-gold animate-pulse" />
              <span className="font-black text-sm">{points.toLocaleString()}</span>
            </div>
          </div>
        </header>

        <div className="max-w-xl mx-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 px-6 mt-6">
            <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#2d3a10]/5 rounded-bl-full flex items-center justify-center translate-x-3 -translate-y-3">
                <Users size={16} className="text-[#2d3a10]/20" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Awaiting Review</p>
              <p className="text-3xl font-black text-amber-600 font-mono italic">{pendingApprovals.length}</p>
            </div>
            <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-forest/5 rounded-bl-full flex items-center justify-center translate-x-3 -translate-y-3">
                <Check size={16} className="text-forest/20" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Daily Gains</p>
              <p className="text-3xl font-black text-[#2d3a10]">{completedCount * 100} <span className="text-xs">PTS</span></p>
            </div>
          </div>

          {/* ═══ PENDING REVIEWS (Priority) ═══ */}
          {pendingApprovals.length > 0 && (
            <div className="px-6 mt-8">
              <div className="flex items-center gap-2 mb-4 px-1">
                <AlertCircle size={16} className="text-amber-500" />
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-tight">Priority Approvals</h2>
              </div>
              <div className="space-y-3">
                {pendingApprovals.map(ap => (
                  <div key={ap.id} onClick={() => setSelectedApproval(ap)}
                    className="bg-white p-4 rounded-[24px] border border-amber-100 shadow-sm hover:border-amber-300 transition-all cursor-pointer group active:scale-[0.98]">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xs uppercase">
                          {ap.submitter_name?.charAt(0) || 'C'}
                        </div>
                        <p className="font-bold text-gray-800 text-sm">{ap.submitter_name || 'Child'}</p>
                      </div>
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">+{ap.points_earned} PTS</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1 italic px-0.5 opacity-80">&ldquo;{ap.reflection_text}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs Container */}
          <div className="px-6 mt-8">
            <div className="bg-white/50 p-1.5 rounded-[24px] border border-gray-200 backdrop-blur-sm flex gap-1 mb-6">
              {[
                { id: 'missions', icon: <Settings2 size={14} />, label: 'Missions' },
                { id: 'rewards', icon: <ShoppingBag size={14} />, label: 'Rewards' },
                { id: 'quran', icon: <BookOpen size={14} />, label: 'Quran' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  className={`flex-1 py-3 rounded-[20px] flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all ${tab === t.id ? 'bg-[#2d3a10] text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Missions List */}
            {tab === 'missions' && (
              <div className="animate-in fade-in duration-300">
                {/* Daily Override Card */}
                {dailyMission && (
                  <div className="bg-white p-6 rounded-[32px] border-2 border-amber-100 shadow-sm mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles size={16} className="text-gold" />
                      <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Daily Mission Guidance</h3>
                    </div>
                    <textarea value={overrideText} onChange={e => setOverrideText(e.target.value)}
                      className="w-full bg-[#fdfdfb] rounded-2xl border-2 border-gray-50 p-4 text-xs font-semibold min-h-[80px] focus:border-forest transition-all" />
                    <button onClick={handleSaveOverride} disabled={savingOverride}
                      className="w-full mt-3 py-3 rounded-2xl bg-forest/10 text-forest font-black text-[11px] uppercase tracking-widest hover:bg-forest/20 transition-all">
                      {savingOverride ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Update Daily Wisdom'}
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center mb-4 px-1">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Custom Missions</h3>
                  <button onClick={() => setShowAddMission(true)} className="text-[10px] font-black text-forest uppercase underline">Add Mission</button>
                </div>
                
                <div className="space-y-3 pb-8">
                  {missions.map(m => (
                    <div key={m.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-forest/10 flex items-center justify-center text-forest">
                          <Activity size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-800">{m.title}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{m.category}</p>
                        </div>
                      </div>
                      <span className="font-black text-xs text-gray-300">#{m.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Rewards Tab ─── */}
            {tab === 'rewards' && (
              <div className="animate-in fade-in duration-300 pb-10">
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
                  <p className="text-center font-bold text-gray-400 text-sm">Reward management system active.</p>
                </div>
              </div>
            )}

            {/* ─── Quran Tab ─── */}
            {tab === 'quran' && (
              <div className="animate-in fade-in duration-300 pb-10 space-y-4">
                {quranReads.map(r => (
                  <div key={r.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-gray-800">{r.surah_name}</p>
                      <p className="text-[10px] font-bold text-gray-400">Verse {r.verse_key}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-forest uppercase">{r.reader_name}</p>
                      <p className="text-[9px] text-gray-300">{formatRelative(r.read_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* === Modals === */}
      {selectedApproval && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[40px] sm:rounded-[40px] w-full max-w-lg flex flex-col max-h-[92vh] shadow-2xl animate-in slide-in-from-bottom duration-500">
            <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-[#fdfdfb] rounded-t-[40px]">
              <div>
                <h3 className="text-lg font-black text-[#2d3a10]">Mission Insight</h3>
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest">Awaiting Guardian Review</p>
              </div>
              <button onClick={() => setSelectedApproval(null)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400"><X size={20} /></button>
            </header>

            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
              <section>
                <div className="bg-[#fdfdfb] p-6 rounded-[32px] border border-gray-100 relative">
                  <MessageSquare size={24} className="text-[#2d3a10]/5 absolute top-6 right-6" />
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">The Reflection</p>
                  <p className="text-lg font-bold text-gray-800 leading-relaxed italic">
                    &ldquo;{selectedApproval.reflection_text}&rdquo;
                  </p>
                </div>
              </section>

              {selectedApproval.proof_url && (
                <section>
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">Captured Proof</p>
                  <div className="rounded-[32px] overflow-hidden border-4 border-white shadow-xl bg-gray-50 aspect-video group cursor-zoom-in"
                    onClick={() => setSelectedProofUrl(selectedApproval?.proof_url || null)}>
                    <img src={selectedApproval.proof_url} alt="Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                </section>
              )}

              <section>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">Guardian Feedback</p>
                <input type="text" placeholder="Share barakah and encouragement..."
                  value={feedbacks[selectedApproval.id] || ''}
                  onChange={e => setFeedbacks(prev => ({ ...prev, [selectedApproval.id]: e.target.value }))}
                  className="w-full h-16 rounded-[24px] bg-[#fdfdfb] border-2 border-amber-50 px-6 text-sm font-bold focus:border-amber-300 focus:outline-none transition-all" />
              </section>
            </div>

            <footer className="px-8 pb-12 pt-6 flex gap-4 bg-[#fdfdfb] border-t border-gray-100">
              <button disabled={!!approvingId} onClick={() => handleReject(selectedApproval)}
                className="flex-1 h-16 rounded-[28px] bg-red-50 text-red-600 font-black tracking-tight text-sm hover:bg-red-100 transition-colors">Reject</button>
              <button disabled={!!approvingId} onClick={() => handleApprove(selectedApproval)}
                className="flex-[2] h-16 rounded-[28px] bg-[#2d3a10] text-white font-black tracking-tight text-sm shadow-xl shadow-[#2d3a10]/20 flex items-center justify-center gap-2">
                {approvingId ? <Loader2 className="animate-spin" /> : <><Check size={18}/> Approve Submission</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Proof Fullscreen */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-[1100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4" onClick={() => setSelectedProofUrl(null)}>
          <img src={selectedProofUrl} alt="Fullscreen Proof" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
          <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"><X size={32} /></button>
        </div>
      )}

      {/* Add Mission Modal */}
      {showAddMission && (
        <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-md flex items-end justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-[40px] sm:rounded-[40px] w-full max-w-lg p-8 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <h3 className="text-xl font-black text-[#2d3a10] mb-8">Establish Mission</h3>
            <div className="space-y-6">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Name the objective..." className="w-full bg-gray-50 rounded-[20px] p-5 border-none font-bold text-sm" />
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map(c => (
                  <button key={c.id} onClick={() => setNewCategory(c.id as any)}
                    className={`p-4 rounded-[20px] border-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${newCategory === c.id ? 'bg-[#2d3a10] border-[#2d3a10] text-white' : 'border-gray-50 text-gray-300'}`}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <button onClick={handleAddMission} className="w-full py-5 rounded-[24px] bg-[#2d3a10] text-white font-black shadow-xl shadow-[#2d3a10]/20 mt-4 active:scale-95 transition-transform">
                Confirm Mandate
              </button>
              <button onClick={() => setShowAddMission(false)} className="w-full text-xs font-black text-gray-300 uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
