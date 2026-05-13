import { supabase } from './supabase';
import { Mission, DailyMission, MissionCompletion, Points, ActivityEntry, Reward, PendingApproval, QuranRead } from './types';
import { syncActivityToFoundation, syncGoalProgressToFoundation, syncPostToFoundation } from './quran-foundation-sync';

// --- CORE MISSIONS ---

export async function getDailyMission(
  familyId: string, 
  date: string, 
  verseKey?: string, 
  trans?: string, 
  familyName?: string
): Promise<DailyMission | null> {
  const { data: existing } = await supabase.from('daily_missions').select('*').eq('family_id', familyId).eq('date', date).maybeSingle();
  if (existing) return existing;

  if (!verseKey) return null;

  const [ch, ay] = verseKey.split(':');
  const SURAH_NAMES: Record<number, string> = {
    1:'Al-Fatihah',2:'Al-Baqarah',3:'Ali Imran',4:'An-Nisa',5:'Al-Maidah',
    6:'Al-Anam',7:'Al-Araf',9:'At-Tawbah',10:'Yunus',12:'Yusuf',13:'Ar-Rad',
    14:'Ibrahim',15:'Al-Hijr',16:'An-Nahl',17:'Al-Isra',18:'Al-Kahf',19:'Maryam',
    20:'Ta-Ha',24:'An-Nur',25:'Al-Furqan',28:'Al-Qasas',29:'Al-Ankabut',
    30:'Ar-Rum',31:'Luqman',33:'Al-Ahzab',36:'Ya-Sin',38:'Sad',39:'Az-Zumar',
    40:'Ghafir',41:'Fussilat',42:'Ash-Shura',47:'Muhammad',48:'Al-Fath',
    49:'Al-Hujurat',50:'Qaf',51:'Adh-Dhariyat',53:'An-Najm',54:'Al-Qamar',
    55:'Ar-Rahman',56:'Al-Waqiah',57:'Al-Hadid',58:'Al-Mujadila',59:'Al-Hashr',
    62:'Al-Jumuah',63:'Al-Munafiqun',64:'At-Taghabun',65:'At-Talaq',
    67:'Al-Mulk',68:'Al-Qalam',73:'Al-Muzzammil',74:'Al-Muddaththir',
    75:'Al-Qiyamah',76:'Al-Insan',78:'An-Naba',79:'An-Naziat',80:'Abasa',
    81:'At-Takwir',82:'Al-Infitar',84:'Al-Inshiqaq',87:'Al-Ala',89:'Al-Fajr',
    91:'Ash-Shams',92:'Al-Layl',93:'Ad-Duha',94:'Al-Inshirah',96:'Al-Alaq',
    97:'Al-Qadr',99:'Az-Zalzalah',100:'Al-Adiyat',103:'Al-Asr',104:'Al-Humazah',
    107:'Al-Maun',108:'Al-Kawthar',109:'Al-Kafirun',110:'An-Nasr',111:'Al-Masad',
    112:'Al-Ikhlas',113:'Al-Falaq',114:'An-Nas',
  };
  const surahName = SURAH_NAMES[parseInt(ch)];
  const verseRef = surahName ? `${surahName} ${ch}:${ay}` : `Surah ${ch}:${ay}`;
  const transSnippet = trans ? `"${trans.slice(0, 100)}${trans.length > 100 ? '...' : ''}"` : verseRef;

  const templates = [
    `Today's goal: Reflect on ${verseRef} — ${transSnippet}. Share one way your family can live by this verse today.`,
    `Family challenge: Read and discuss ${verseRef} together. How does ${transSnippet} apply to your daily life?`,
    `Spiritual goal: Memorize or recite ${verseRef}. Then share a reflection on ${transSnippet} with your family.`,
  ];
  const dayOfYear = Math.floor((new Date(date).getTime() - new Date(new Date(date).getFullYear(), 0, 0).getTime()) / 86400000);
  const generated_text = templates[dayOfYear % templates.length];

  const newMission = {
    family_id: familyId,
    date,
    verse_key: verseKey,
    generated_text,
  };

  const { data, error } = await supabase.from('daily_missions').insert(newMission).select().maybeSingle();
  if (error) {
    // If there's a race condition and a duplicate key is triggered, simply fetch it
    if (error.message.includes('duplicate key value')) {
      const { data: recovered } = await supabase.from('daily_missions').select('*').eq('family_id', familyId).eq('date', date).maybeSingle();
      return recovered;
    }
    console.error('Daily Mission Insert Error:', error.message);
    return null;
  }
  return data || null;
}

export async function setDailyMissionOverride(familyId: string, date: string, text: string) {
  return await supabase.from('daily_missions')
    .update({ parent_override_text: text })
    .eq('family_id', familyId)
    .eq('date', date);
}

export async function hasCompletedDailyMission(userId: string, missionId: string, date: string): Promise<boolean> {
  const { data } = await supabase.from('mission_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('daily_mission_id', missionId)
    .eq('date', date)
    .eq('status', 'approved')
    .maybeSingle();
  return !!data;
}

export async function getMissions(familyId: string): Promise<Mission[]> {
  const { data } = await supabase.from('missions').select('*').eq('family_id', familyId).order('created_at', { ascending: false });
  return data || [];
}

export async function addMission(familyId: string, mission: Partial<Mission>) {
  return await supabase.from('missions').insert({ ...mission, family_id: familyId }).select().single();
}

export async function updateMission(id: string, mission: Partial<Mission>) {
  return await supabase.from('missions').update(mission).eq('id', id);
}

export async function getRewards(familyId: string): Promise<Reward[]> {
  const { data } = await supabase.from('rewards').select('*').eq('family_id', familyId).order('cost', { ascending: true });
  return data || [];
}

export async function getTodayCompletions(familyId: string, date?: string): Promise<MissionCompletion[]> {
  const d = date || new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('mission_completions').select('*').eq('family_id', familyId).eq('date', d);
  return data || [];
}

export async function getPersonalCompletions(userId: string, familyId: string, date: string): Promise<MissionCompletion[]> {
  const { data } = await supabase.from('mission_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('family_id', familyId)
    .eq('date', date);
  return data || [];
}

export async function completeMission(
  userId: string, 
  family_id: string, 
  missionId: string, 
  date: string, 
  isDaily: boolean = false, 
  proofUrl?: string, 
  proofNote?: string, 
  points?: number,
  reflectionText?: string,
  userRole: string = 'child'
) {
  const status = (userRole === 'parent' || userRole === 'guardian') ? 'approved' : 'pending';
  // All 3 situational parts (Reflect/Activity, Chat, Call) are independent sub-quests
  // Each is deduplicated per proof_note per day, NOT by daily_mission_id
  const isSubQuest = isDaily && (
    (proofNote || '').includes('Activity') ||
    (proofNote || '').includes('Chat') ||
    (proofNote || '').includes('Call')
  );

  if (!isSubQuest) {
    // Non-situational: standard unique check by mission_id
    const { data: existing } = await supabase.from('mission_completions')
      .select('id')
      .eq('user_id', userId)
      .eq(isDaily ? 'daily_mission_id' : 'mission_id', missionId)
      .eq('date', date)
      .maybeSingle();
    if (existing) return { data: existing, error: null };
  } else {
    // Situational: deduplicate per proof_note type per day
    const { data: existing } = await supabase.from('mission_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('family_id', family_id)
      .eq('date', date)
      .eq('proof_note', proofNote || 'Activity')
      .maybeSingle();
    if (existing) return { data: existing, error: null };
  }


  const { data, error } = await supabase.from('mission_completions').insert({
    user_id: userId,
    family_id,
    mission_id: (isDaily || isSubQuest) ? null : missionId,
    daily_mission_id: (isDaily && !isSubQuest) ? missionId : null,
    date,
    status,
    proof_url: proofUrl,
    proof_note: proofNote || 'Activity',
    points_earned: points || (isDaily ? 34 : 50),
    reflection_text: reflectionText,
    submitter_name: (userRole === 'parent' || userRole === 'guardian') ? 'Parent' : 'Child'
  }).select().single();

  if (error) return { data: null, error };

  if (data && status === 'approved') {
    const activityDesc = isDaily ? `Daily Mission Progress` : `Task Achievement`;
    try {
      if (typeof syncPostToFoundation === 'function') {
        await syncPostToFoundation(`✅ **Verified!** ${activityDesc}\n\n*Synced via Musfam Ecosystem Proxy*${reflectionText ? `\n\n📝 "${reflectionText}"` : ''}`, family_id);
      }
      if (!isDaily && !isSubQuest) await syncGoalProgressToFoundation(missionId, 1);
      await syncActivityToFoundation(activityDesc, data.points_earned);
    } catch(e) { console.error('Ecosystem sync failed', e); }

    const { data: current } = await supabase.from('points').select('total_points').eq('user_id', userId).eq('family_id', family_id).maybeSingle();
    await supabase.from('points').update({ total_points: (current?.total_points || 0) + data.points_earned }).eq('user_id', userId).eq('family_id', family_id);
    
    // Log Activity Entry
    await supabase.from('activity_log').insert({
      family_id,
      user_id: userId,
      description: activityDesc,
      points_change: data.points_earned,
      icon: isDaily ? 'book-open' : 'check-circle'
    });
  }

  return { data, error: null };
}

export async function completeCustomMission(userId: string, familyId: string, missionId: string, date: string, points: number, proofUrl?: string, proofNote?: string) {
  return completeMission(userId, familyId, missionId, date, false, proofUrl, proofNote, points);
}

// --- APPROVALS & POINTS ---

export async function getPendingApprovals(familyId: string): Promise<PendingApproval[]> {
  const { data } = await supabase.from('mission_completions')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .order('completed_at', { ascending: false });
  return data || [];
}

export async function approveCompletion(id: string, userId: string, familyId: string, points: number, adminName: string, feedback?: string) {
  const { error } = await supabase.from('mission_completions')
    .update({ status: 'approved', guardian_feedback: feedback })
    .eq('id', id);
  if (error) return { error };

  const { data: current } = await supabase.from('points').select('total_points').eq('user_id', userId).eq('family_id', familyId).maybeSingle();
  await supabase.from('points').update({ total_points: (current?.total_points || 0) + points }).eq('user_id', userId).eq('family_id', familyId);

  // Log activity
  await supabase.from('activity_log').insert({
    family_id: familyId,
    user_id: userId,
    description: `Approved by ${adminName}`,
    points_change: points,
    icon: 'star'
  });

  try { await syncActivityToFoundation(`Parent Approved Activity`, points); } catch {}

  return { success: true };
}

export async function rejectCompletion(id: string, familyId: string, childName: string, adminName: string, feedback?: string) {
  return await supabase.from('mission_completions').update({ status: 'rejected', guardian_feedback: feedback }).eq('id', id);
}

export async function getFamilyPoints(familyId: string): Promise<number> {
  const { data } = await supabase.from('points').select('total_points').eq('family_id', familyId);
  return (data || []).reduce((acc, curr) => acc + (curr.total_points || 0), 0);
}

export async function getActivities(familyId: string): Promise<ActivityEntry[]> {
  const { data } = await supabase.from('activity_log').select('*').eq('family_id', familyId).order('created_at', { ascending: false }).limit(50);
  return (data || []) as any;
}

export async function clearAllActivities(familyId: string) {
  return await supabase.from('activity_log').delete().eq('family_id', familyId);
}

export async function claimReward(rewardId: string, userId: string, familyId: string, cost: number) {
  const { data: p } = await supabase.from('points').select('total_points').eq('user_id', userId).eq('family_id', familyId).single();
  if (!p || p.total_points < cost) return { success: false, error: 'Not enough points' };
  
  await supabase.from('points').update({ total_points: p.total_points - cost }).eq('user_id', userId).eq('family_id', familyId);
  await supabase.from('rewards').update({ claimed: true, claimed_by: userId, claimed_at: new Date().toISOString() }).eq('id', rewardId);
  
  // Log activity
  await supabase.from('activity_log').insert({
    family_id: familyId,
    user_id: userId,
    description: `Claimed Reward`,
    points_change: -cost,
    icon: 'gift'
  });

  return { success: true };
}

// --- QURAN STATS ---

export async function getQuranReads(familyId: string): Promise<QuranRead[]> {
  const { data } = await supabase.from('quran_reads').select('*').eq('family_id', familyId).order('read_at', { ascending: false }).limit(20);
  return (data || []) as any;
}

export async function recordQuranRead(userId: string, familyId: string, readerName: string, verseKey: string, surahName: string) {
  const today = new Date().toISOString().split('T')[0];
  
  // 1. Log to quran_reads for the Control Page table
  await supabase.from('quran_reads').insert({
    user_id: userId,
    family_id: familyId,
    reader_name: readerName,
    verse_key: verseKey,
    surah_name: surahName,
    read_at: new Date().toISOString()
  });

  // 2. Log to activity_log for the Shop Page history
  await supabase.from('activity_log').insert({
    family_id: familyId,
    user_id: userId,
    description: `Read ${surahName} (${verseKey})`,
    points_change: 1, // Small reward for reading
    icon: 'book-open'
  });

  // 3. Update points slightly (micro-reward)
  const { data: current } = await supabase.from('points').select('total_points').eq('user_id', userId).eq('family_id', familyId).maybeSingle();
  await supabase.from('points').update({ total_points: (current?.total_points || 0) + 1 }).eq('user_id', userId).eq('family_id', familyId);

  return { success: true };
}

export async function getStreak(userId: string, familyId: string): Promise<{ current_streak: number; longest_streak: number }> {
  // Simple streak logic: check consecutive days in mission_completions
  const { data } = await supabase.from('mission_completions')
    .select('date')
    .eq('user_id', userId)
    .eq('family_id', familyId)
    .eq('status', 'approved')
    .order('date', { ascending: false });
  
  if (!data || data.length === 0) return { current_streak: 0, longest_streak: 0 };
  
  const dates = [...new Set(data.map(d => d.date))];
  let current = 0;
  let longest = 0;
  let temp = 0;
  
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yestStr = yesterday.toISOString().split('T')[0];
  
  if (dates[0] === today || dates[0] === yestStr) {
    let checkDate = new Date(dates[0]);
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] === checkDate.toISOString().split('T')[0]) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    }
  }
  
  // Calculate longest
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) { temp = 1; }
    else {
      const d1 = new Date(dates[i-1]);
      const d2 = new Date(dates[i]);
      d1.setDate(d1.getDate() - 1);
      if (d1.toISOString().split('T')[0] === d2.toISOString().split('T')[0]) {
        temp++;
      } else {
        longest = Math.max(longest, temp);
        temp = 1;
      }
    }
  }
  longest = Math.max(longest, temp);
  
  return { current_streak: current, longest_streak: longest };
}

export async function addReward(familyId: string, reward: Partial<Reward>) {
  return await supabase.from('rewards').insert({ ...reward, family_id: familyId }).select().single();
}

export async function updateReward(id: string, reward: Partial<Reward>) {
  return await supabase.from('rewards').update(reward).eq('id', id);
}

export async function isMissionCompletedToday(userId: string, missionId: string, date: string): Promise<boolean> {
  const { data } = await supabase.from('mission_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('mission_id', missionId)
    .eq('date', date)
    .in('status', ['approved', 'pending'])
    .maybeSingle();
  return !!data;
}

export async function getRejectedCompletions(familyId: string): Promise<MissionCompletion[]> {
  const { data } = await supabase.from('mission_completions')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'rejected');
  return data || [];
}

export async function deleteActivity(id: string) {
  return await supabase.from('activity_log').delete().eq('id', id);
}

export async function addReflection(familyId: string, reflection: any) {
  return await supabase.from('reflections').insert({ ...reflection, family_id: familyId });
}

// --- UTILS ---

export async function uploadProofImage(userId: string, file: File): Promise<{ publicUrl: string | null; error: any }> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('proof-images').upload(path, file);
  if (error) return { publicUrl: null, error };
  const { data: q } = supabase.storage.from('proof-images').getPublicUrl(path);
  return { publicUrl: q.publicUrl, error: null };
}

export async function deleteMission(id: string) {
  return await supabase.from('missions').delete().eq('id', id);
}

export async function deleteReward(id: string) {
  return await supabase.from('rewards').delete().eq('id', id);
}
