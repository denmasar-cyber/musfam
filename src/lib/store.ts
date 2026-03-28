import { supabase } from './supabase';
import { Mission, MissionCompletion, Reflection, ActivityEntry, Reward, Profile, DailyMission } from './types';
import { generateDailyMissionSemantic } from './missionGenerator';
import { 
  syncGoalToFoundation, syncActivityToFoundation, 
  syncPostToFoundation, syncCommentToFoundation,
  syncGoalProgressToFoundation
} from './quran-foundation-sync';

export interface VerseOfDay {
  verse_key: string;
  text_arabic: string;
  translation: string;
  surah_name?: string;
  ayah_number?: string;
}

// 🛡️ MUSFAM STORE: THE ABSOLUTE TRUTH (HIGH-LEVEL CLAUDE EDITION)
// Stable, Fast, Deterministic, and Built for Family Spiritual Growth.

export async function getDailyMission(familyId: string, _date: string, _verseKey: string, verseText?: string, familyName?: string): Promise<DailyMission | null> {
  const { data: existing } = await supabase.from('daily_missions').select('*').eq('family_id', familyId).eq('date', _date).maybeSingle();
  const isPlaceholder = existing && (existing.generated_text || '').includes('🛡️ GENERATING');
  const isStale = existing && existing.verse_key !== _verseKey;
  if (existing && !isPlaceholder && !isStale) return existing as DailyMission;
  
  let finalVerseText = verseText;
  if (!finalVerseText) {
    try {
      const [chap, ay] = _verseKey.split(':');
      const res = await fetch(`https://api.quran.com/api/v4/verses/by_key/${_verseKey}?translations=131&fields=text_uthmani`);
      if (res.ok) {
        const d = await res.json();
        finalVerseText = d.verse?.translations?.[0]?.text || '';
      }
    } catch { /* ignore */ }
  }

  const { missionText, reflectionPrompt, verseKey } = await generateDailyMissionSemantic(new Date(_date), finalVerseText, _verseKey, familyName);
  const { data: created, error } = await supabase.from('daily_missions').upsert({
    id: existing?.id,
    family_id: familyId,
    date: _date,
    verse_key: verseKey,
    generated_text: missionText,
    parent_override_prompt: reflectionPrompt
  }, { onConflict: 'family_id, date' }).select().single();
  if (error) return existing ? existing as DailyMission : null;
  return created as DailyMission;
}

export async function hasCompletedDailyMission(userId: string, familyId: string, date: string): Promise<boolean> {
  const { data: missions } = await supabase.from('daily_missions').select('id').eq('family_id', familyId).eq('date', date);
  if (!missions || missions.length === 0) return false;
  const { count } = await supabase.from('mission_completions').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('daily_mission_id', missions.map(m => m.id)).in('status', ['approved', 'pending']);
  return (count || 0) > 0;
}

export async function completeMission(userId: string, familyId: string, missionId: string, date: string, isDaily: boolean, proofUrl?: string, proofNote?: string, points?: number, reflectionText?: string, userRole?: string) {
  // 🛡️ ELITE APPROVAL LOGIC: Parents are auto-approved, children are pending guardian review
  const status = (userRole === 'parent' || userRole === 'guardian') ? 'approved' : 'pending';

  // 🛡️ HYBRID SYNC: Record the log in Supabase, but the SPIRITUAL TRUTH is in the Cloud
  const { data, error } = await supabase.from('mission_completions').insert({
    user_id: userId,
    family_id: familyId,
    mission_id: isDaily ? null : missionId,
    daily_mission_id: isDaily ? missionId : null,
    date,
    status,
    proof_url: proofUrl,
    proof_note: proofNote,
    points_earned: points || (isDaily ? 100 : 50),
    reflection_text: reflectionText
  }).select().single();

  if (!error && data) {
    // 🛡️ ECOSYSTEM SYNC: Mirror completion as a Post in the Foundation
    const activityDesc = isDaily ? `Daily Mission Progress` : `Task Achievement`;
    const syncText = status === 'approved' ? `✅ **Verified!** ${activityDesc}` : `⏳ **Action Logged!** ${activityDesc}`;
    
    await syncPostToFoundation(`${syncText}\n\n*Synced via Musfam Ecosystem Proxy*${reflectionText ? `\n\n📝 "${reflectionText}"` : ''}`, familyId);
    
    if (status === 'approved') {
       if (!isDaily) await syncGoalProgressToFoundation(missionId, 1);
       await syncActivityToFoundation(activityDesc, data.points_earned);
    }
  }

  return { data, error };
}

export async function completeCustomMission(userId: string, familyId: string, missionId: string, date: string, points: number, proofUrl?: string, proofNote?: string) {
  return completeMission(userId, familyId, missionId, date, false, proofUrl, proofNote, points);
}

export async function uploadProofImage(userId: string, file: File) {
  // 🛡️ CLOUDINARY SYNC: The "Tanpa Ribet" Storage Solution
  // This circumvents the 'Bucket not found' error forever.
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'musfam_proofs'); 
  
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/demo/image/upload`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { publicUrl: data.secure_url };
  } catch (err: any) {
    // Fallback to Supabase (proof-images bucket from supabase-complete.sql)
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('proof-images').upload(path, file);
    if (error) return { error };
    const { data: { publicUrl } } = supabase.storage.from('proof-images').getPublicUrl(path);
    return { publicUrl };
  }
}

// --- MISSION CRUD ---
export async function getMissions(familyId: string) {
  const { data } = await supabase.from('missions').select('*').eq('family_id', familyId).order('created_at', { ascending: false });
  return data || [];
}
export async function addMission(familyId: string, mission: Partial<Mission>) {
  const result = await supabase.from('missions').insert({ ...mission, family_id: familyId }).select().single();
  
  if (result.data) {
    // 🛡️ SYNC: Register personal mission as a Goal in the Foundation
    await syncGoalToFoundation(result.data.title, 1, 'other');
    
    // Announce to family
    await syncPostToFoundation(`📜 **New Mission!** A parent added: "${result.data.title}"`, familyId);
  }
  
  return result;
}
export async function updateMission(id: string, mission: Partial<Mission>) {
  return supabase.from('missions').update(mission).eq('id', id).select().single();
}
export async function deleteMission(id: string) {
  return supabase.from('missions').delete().eq('id', id);
}

// --- REWARD CRUD ---
export async function getRewards(familyId: string) {
  const { data } = await supabase.from('rewards').select('*').eq('family_id', familyId).order('cost', { ascending: true });
  return data || [];
}
export async function addReward(familyId: string, reward: Partial<Reward>) {
  return supabase.from('rewards').insert({ ...reward, family_id: familyId }).select().single();
}
export async function updateReward(id: string, reward: Partial<Reward>) {
  return supabase.from('rewards').update(reward).eq('id', id).select().single();
}
export async function deleteReward(id: string) {
  return supabase.from('rewards').delete().eq('id', id);
}

// --- COMPLETION & APPROVAL ---
export async function getTodayCompletions(familyId: string) {
  return (await supabase.from('mission_completions').select('*').eq('family_id', familyId).eq('date', new Date().toISOString().split('T')[0])).data || [];
}
export async function getPendingApprovals(familyId: string) {
  return (await supabase.from('mission_completions').select('*').eq('family_id', familyId).eq('status', 'pending')).data || [];
}
export async function getRejectedCompletions(familyId: string) {
  return (await supabase.from('mission_completions').select('*').eq('family_id', familyId).eq('status', 'rejected')).data || [];
}
export async function approveCompletion(id: string, userId: string, familyId: string, points: number, approvedBy: string, feedback?: string) {
  const { data: comp } = await supabase.from('mission_completions').update({ 
    status: 'approved', 
    approved_at: new Date().toISOString(), 
    approved_by: approvedBy, 
    parent_feedback: feedback 
  }).eq('id', id).select().single();

  if (comp) {
    const { data: current } = await supabase.from('points').select('total_points').eq('user_id', userId).eq('family_id', familyId).single();
    await supabase.from('points').update({ total_points: (current?.total_points || 0) + points }).eq('user_id', userId).eq('family_id', familyId);
    
    // 🛡️ SYNC: Global Activity Aura
    await syncActivityToFoundation(`Guardian ${approvedBy} approved completion.`, points);
    
    // SYNC: Feedback as a Comment in the Foundation Social Hub
    // We attempt to find the original Post if possible, or just emit a global celebration
    await syncCommentToFoundation(comp.id, `✅ **Approved!** "${feedback || 'Excellent work!'}" — ${approvedBy}`);
  }

  return { success: true };
}
export async function rejectCompletion(id: string, familyId: string, submitterName: string, rejectedBy: string, feedback?: string) {
  return supabase.from('mission_completions').update({ status: 'rejected', approved_at: new Date().toISOString(), approved_by: rejectedBy, parent_feedback: feedback }).eq('id', id);
}

// --- STATS ---
export async function getFamilyPoints(familyId: string) {
  const { data } = await supabase.from('points').select('total_points').eq('family_id', familyId);
  return (data || []).reduce((acc, curr) => acc + (curr.total_points || 0), 0);
}
export async function getStreak(userId: string, familyId: string) {
  return (await supabase.from('streaks').select('*').eq('user_id', userId).eq('family_id', familyId).maybeSingle()).data;
}
export async function recordQuranReadPages(familyId: string, pages: number) {
  const { data: current } = await supabase.from('quran_progress').select('pages_read').eq('family_id', familyId).maybeSingle();
  return supabase.from('quran_progress').upsert({ family_id: familyId, pages_read: (current?.pages_read || 0) + pages }, { onConflict: 'family_id' });
}
export async function recordQuranRead(userId: string, familyId: string, readerName: string, verseKey: string, surahName: string) {
  return supabase.from('quran_reads').insert({
    user_id: userId,
    family_id: familyId,
    reader_name: readerName,
    verse_key: verseKey,
    surah_name: surahName,
    read_at: new Date().toISOString()
  });
}

export async function getActivities(familyId: string) { return (await supabase.from('activities').select('*').eq('family_id', familyId).order('created_at', { ascending: false })).data || []; }
export async function clearAllActivities(familyId: string) { return supabase.from('activities').delete().eq('family_id', familyId); }
export async function isMissionCompletedToday(userId: string, missionId: string, date: string) {
  const { count } = await supabase.from('mission_completions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('mission_id', missionId).eq('date', date).eq('status', 'approved');
  return (count || 0) > 0;
}
export async function claimReward(rewardId: string, userId: string, familyId: string, cost: number) {
  const { data: current } = await supabase.from('points').select('total_points').eq('user_id', userId).eq('family_id', familyId).single();
  const currentPoints = current?.total_points || 0;
  if (currentPoints < cost) return { success: false, error: 'Insufficient points' };
  
  const { error: claimError } = await supabase.from('rewards').update({ 
    claimed: true, 
    claimed_at: new Date().toISOString(), 
    claimed_by: userId 
  }).eq('id', rewardId);
  
  if (claimError) return { success: false, error: claimError };
  
  await supabase.from('points').update({ 
    total_points: currentPoints - cost 
  }).eq('user_id', userId).eq('family_id', familyId);

  // 🛡️ SHADOW SYNC: Ecosystem Recognition
  await syncPostToFoundation(`🎁 **Reward Realized!** A family member claimed a reward for ${cost} AP!`, familyId);
  await syncActivityToFoundation(`Claimed Reward`, -cost);
  
  return { success: true };
}
export async function addReflection(familyId: string, data: any) {
  return supabase.from('reflections').insert({ ...data, family_id: familyId });
}
export async function setDailyMissionOverride(familyId: string, date: string, text: string) {
  return supabase.from('daily_missions').upsert({ family_id: familyId, date, generated_text: text }, { onConflict: 'family_id, date' });
}
export async function getQuranReads(familyId: string) {
  const { data } = await supabase.from('quran_progress').select('*').eq('family_id', familyId);
  return data || [];
}
export async function deleteActivity(id: string) {
  return supabase.from('activities').delete().eq('id', id);
}

