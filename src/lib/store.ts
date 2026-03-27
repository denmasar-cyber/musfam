import { supabase } from './supabase';
import { Mission, MissionCompletion, Reflection, ActivityEntry, Reward } from './types';
import { generateDailyMission } from './missionGenerator';

export interface DailyMission {
  id: string;
  family_id: string;
  date: string;
  verse_key: string;
  generated_text: string;
  parent_override_text: string | null;
  parent_override_prompt: string | null;
  is_parent_override: boolean;
  created_at: string;
}

export interface ScheduleEvent {
  id: string;
  family_id: string;
  user_id: string;
  date: string;
  title: string;
  time: string | null;
  created_at: string;
}

// ============================================
// MISSIONS
// ============================================

export async function getMissions(familyId: string): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return data as Mission[];
}

export async function addMission(
  familyId: string,
  userId: string,
  mission: { title: string; description: string; category: Mission['category']; icon: string; assigned_to?: string; points?: number; is_special?: boolean; visible_to_child?: boolean }
): Promise<Mission | null> {
  const { data, error } = await supabase
    .from('missions')
    .insert({
      family_id: familyId,
      title: mission.title,
      description: mission.description,
      category: mission.category,
      icon: mission.icon,
      created_by: userId,
      is_default: false,
      points: mission.points ?? 10,
      is_special: mission.is_special ?? false,
      visible_to_child: mission.visible_to_child ?? true,
      ...(mission.assigned_to ? { assigned_to: mission.assigned_to } : {}),
    })
    .select()
    .single();

  if (error) return null;
  return data as Mission;
}

export async function deleteMission(missionId: string): Promise<void> {
  await supabase.from('missions').delete().eq('id', missionId);
}

export async function updateMission(
  missionId: string,
  updates: { title?: string; category?: Mission['category']; points?: number; is_special?: boolean; visible_to_child?: boolean }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.category !== undefined) {
    patch.category = updates.category;
    patch.icon = updates.category === 'spiritual' ? 'sparkles' : updates.category === 'health' ? 'activity' : updates.category === 'chores' ? 'home' : 'book-open';
  }
  if (updates.points !== undefined) patch.points = updates.points;
  if (updates.is_special !== undefined) patch.is_special = updates.is_special;
  if (updates.visible_to_child !== undefined) patch.visible_to_child = updates.visible_to_child;
  await supabase.from('missions').update(patch).eq('id', missionId);
}

// ============================================
// COMPLETIONS
// ============================================

export async function getCompletions(familyId: string): Promise<MissionCompletion[]> {
  const { data, error } = await supabase
    .from('mission_completions')
    .select('*')
    .eq('family_id', familyId)
    .order('completed_at', { ascending: false });

  if (error) return [];
  return data as MissionCompletion[];
}

export async function getTodayCompletions(familyId: string): Promise<MissionCompletion[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('mission_completions')
    .select('*')
    .eq('family_id', familyId)
    .gte('completed_at', `${today}T00:00:00`)
    .lt('completed_at', `${today}T23:59:59.999`);

  if (error) return [];
  return data as MissionCompletion[];
}

export async function isMissionCompletedToday(familyId: string, missionId: string): Promise<boolean> {
  const completions = await getTodayCompletions(familyId);
  return completions.some(c => c.mission_id === missionId);
}

export async function completeMission(
  userId: string,
  familyId: string,
  dailyMissionId: string,
  reflectionText: string,
  submitterName?: string,
  submitterRole?: string
): Promise<MissionCompletion | null> {
  // Anti-exploit: 1 completion per user per day
  const today = new Date().toISOString().split('T')[0];
  const alreadyDone = await hasCompletedDailyMission(userId, familyId, today);
  if (alreadyDone) return null;

  const points = 100;
  const isChild = submitterRole === 'child';
  const status = isChild ? 'pending' : 'approved';

  // Build insert payload — omit approval columns if DB doesn't have them yet
  const insertPayload: Record<string, unknown> = {
    family_id: familyId,
    user_id: userId,
    mission_id: null,
    daily_mission_id: dailyMissionId,
    reflection_text: reflectionText,
    points_earned: points,
  };
  // Try to include approval columns (safe: Supabase ignores unknown columns gracefully in upsert,
  // but INSERT will fail on unknown column. We include them and let DB migrations handle it.)
  insertPayload.status = status;
  if (submitterName) insertPayload.submitter_name = submitterName;

  const { data: completion, error } = await supabase
    .from('mission_completions')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    // Retry without approval columns (migration not run yet)
    const { data: c2, error: e2 } = await supabase
      .from('mission_completions')
      .insert({
        family_id: familyId,
        user_id: userId,
        mission_id: null,
        daily_mission_id: dailyMissionId,
        reflection_text: reflectionText,
        points_earned: points,
      })
      .select()
      .single();
    if (e2) return null;
    // Fallback: always grant points (no approval system yet)
    await addPoints(userId, familyId, points);
    await updateStreak(userId, familyId);
    await addActivity(userId, familyId, {
      description: 'Daily mission completed',
      points_change: points,
      icon: 'check-circle',
    });
    return c2 as MissionCompletion;
  }

  // Only grant points immediately for parents; children wait for approval
  if (!isChild) {
    await addPoints(userId, familyId, points);
    await updateStreak(userId, familyId);
    await addActivity(userId, familyId, {
      description: 'Daily mission completed',
      points_change: points,
      icon: 'check-circle',
    });
  }

  return completion as MissionCompletion;
}

export async function completeCustomMission(
  userId: string,
  familyId: string,
  missionId: string,
  reflectionText: string,
  submitterName?: string,
  submitterRole?: string
): Promise<MissionCompletion | null> {
  const today = new Date().toISOString().split('T')[0];
  // Check if already approved or pending — block resubmission
  const { data: existing } = await supabase
    .from('mission_completions')
    .select('id, status')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .eq('mission_id', missionId)
    .gte('completed_at', `${today}T00:00:00`)
    .limit(1)
    .maybeSingle();
  if (existing?.status === 'approved' || existing?.status === 'pending') return null;
  // If rejected, delete it so child can resubmit
  if (existing?.status === 'rejected') {
    await supabase.from('mission_completions').delete().eq('id', existing.id);
  }

  const points = 100;
  const isChild = submitterRole === 'child';
  const status = isChild ? 'pending' : 'approved';

  const insertPayload: Record<string, unknown> = {
    family_id: familyId,
    user_id: userId,
    mission_id: missionId,
    reflection_text: reflectionText,
    points_earned: points,
    status,
  };
  if (submitterName) insertPayload.submitter_name = submitterName;

  const { data: completion, error } = await supabase
    .from('mission_completions')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    // Retry without approval columns
    const { data: c2, error: e2 } = await supabase
      .from('mission_completions')
      .insert({
        family_id: familyId,
        user_id: userId,
        mission_id: missionId,
        reflection_text: reflectionText,
        points_earned: points,
      })
      .select()
      .single();
    if (e2) return null;
    await addPoints(userId, familyId, points);
    await updateStreak(userId, familyId);
    const missions2 = await getMissions(familyId);
    const m2 = missions2.find(m => m.id === missionId);
    await addActivity(userId, familyId, {
      description: m2?.title || 'Mission completed',
      points_change: points,
      icon: 'check-circle',
    });
    return c2 as MissionCompletion;
  }

  if (!isChild) {
    await addPoints(userId, familyId, points);
    await updateStreak(userId, familyId);

    const missions = await getMissions(familyId);
    const mission = missions.find(m => m.id === missionId);
    await addActivity(userId, familyId, {
      description: mission?.title || 'Mission completed',
      points_change: points,
      icon: 'check-circle',
    });
  }

  return completion as MissionCompletion;
}

// ============================================
// MISSION APPROVAL (parent review workflow)
// ============================================

export interface PendingApproval {
  id: string;
  family_id: string;
  user_id: string;
  submitter_name: string | null;
  mission_id: string | null;
  daily_mission_id: string | null;
  reflection_text: string | null;
  proof_url: string | null;
  points_earned: number;
  completed_at: string;
  status: 'pending' | 'approved' | 'rejected';
}

export async function getRejectedCompletions(userId: string, familyId: string): Promise<PendingApproval[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('mission_completions')
    .select('*')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .eq('status', 'rejected')
    .gte('completed_at', `${today}T00:00:00`)
    .order('completed_at', { ascending: false });
  if (error) return [];
  return data as PendingApproval[];
}

export async function getPendingApprovals(familyId: string): Promise<PendingApproval[]> {
  const { data, error } = await supabase
    .from('mission_completions')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .order('completed_at', { ascending: false });
  if (error) return [];
  return data as PendingApproval[];
}

export async function approveCompletion(
  completionId: string,
  userId: string,
  familyId: string,
  points: number
): Promise<void> {
  await supabase
    .from('mission_completions')
    .update({ status: 'approved' })
    .eq('id', completionId);

  await addPoints(userId, familyId, points);
  await updateStreak(userId, familyId);
  await addActivity(userId, familyId, {
    description: 'Mission approved by parent',
    points_change: points,
    icon: 'check-circle',
  });
}

export async function rejectCompletion(
  completionId: string,
  familyId: string,
  submitterName: string,
  parentName: string
): Promise<void> {
  await supabase
    .from('mission_completions')
    .update({ status: 'rejected' })
    .eq('id', completionId);

  // Post a system notification in the family chat
  await supabase.from('family_messages').insert({
    family_id: familyId,
    user_id: '00000000-0000-0000-0000-000000000000',
    sender_name: 'System',
    sender_role: 'parent',
    content: `❌ ${submitterName}'s mission submission was not approved by ${parentName}. Please try again with a more detailed reflection.`,
  });
}

// ============================================
// REFLECTIONS
// ============================================

export async function getReflections(familyId: string): Promise<Reflection[]> {
  const { data, error } = await supabase
    .from('reflections')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data as Reflection[];
}

export async function addReflection(
  familyId: string,
  reflection: Omit<Reflection, 'id' | 'created_at' | 'family_id'>
): Promise<Reflection | null> {
  const { data, error } = await supabase
    .from('reflections')
    .insert({ ...reflection, family_id: familyId })
    .select()
    .single();

  if (error) return null;
  return data as Reflection;
}

// ============================================
// POINTS
// ============================================

export async function getPoints(userId: string, familyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('points')
    .select('total_points')
    .eq('user_id', userId)
    .eq('family_id', familyId)
    .single();

  if (error || !data) return 0;
  return data.total_points;
}

export async function getFamilyPoints(familyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('points')
    .select('total_points')
    .eq('family_id', familyId);

  if (error || !data) return 0;
  return data.reduce((sum, p) => sum + p.total_points, 0);
}

export async function addPoints(userId: string, familyId: string, amount: number): Promise<void> {
  const current = await getPoints(userId, familyId);
  await supabase
    .from('points')
    .upsert({
      user_id: userId,
      family_id: familyId,
      total_points: current + amount,
      updated_at: new Date().toISOString(),
    });
}

export async function spendPoints(userId: string, familyId: string, amount: number): Promise<boolean> {
  const current = await getPoints(userId, familyId);
  if (current < amount) return false;

  await supabase
    .from('points')
    .update({
      total_points: current - amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('family_id', familyId);

  return true;
}

// ============================================
// STREAKS
// ============================================

export async function getStreak(userId: string, familyId: string): Promise<{ current_streak: number; longest_streak: number }> {
  const { data, error } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak')
    .eq('user_id', userId)
    .eq('family_id', familyId)
    .single();

  if (error || !data) return { current_streak: 0, longest_streak: 0 };
  return data;
}

export async function updateStreak(userId: string, familyId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .eq('family_id', familyId)
    .single();

  if (!existing) {
    await supabase.from('streaks').insert({
      user_id: userId,
      family_id: familyId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
    return;
  }

  if (existing.last_active_date === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split('T')[0];

  let newCurrent = 1;
  if (existing.last_active_date === yesterdayKey) {
    newCurrent = existing.current_streak + 1;
  }

  const newLongest = Math.max(existing.longest_streak, newCurrent);

  await supabase
    .from('streaks')
    .update({
      current_streak: newCurrent,
      longest_streak: newLongest,
      last_active_date: today,
    })
    .eq('user_id', userId)
    .eq('family_id', familyId);
}

// ============================================
// ACTIVITIES
// ============================================

export async function getActivities(familyId: string): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return data as ActivityEntry[];
}

export async function addActivity(
  userId: string,
  familyId: string,
  entry: { description: string; points_change: number; icon: string }
): Promise<void> {
  await supabase.from('activity_log').insert({
    family_id: familyId,
    user_id: userId,
    description: entry.description,
    points_change: entry.points_change,
    icon: entry.icon,
  });
}

export async function deleteActivity(activityId: string): Promise<void> {
  await supabase.from('activity_log').delete().eq('id', activityId);
}

export async function clearAllActivities(familyId: string): Promise<void> {
  await supabase.from('activity_log').delete().eq('family_id', familyId);
}

// ============================================
// REWARDS
// ============================================

export async function getRewards(familyId: string): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('family_id', familyId)
    .order('cost', { ascending: true });

  if (error) return [];
  return data as Reward[];
}

export async function updateReward(rewardId: string, updates: { is_special?: boolean; visible_to_child?: boolean; name?: string; cost?: number }): Promise<boolean> {
  const { error } = await supabase.from('rewards').update(updates).eq('id', rewardId);
  return !error;
}

export async function addReward(familyId: string, reward: { name: string; cost: number; icon: string; assigned_to?: string; is_special?: boolean; visible_to_child?: boolean }): Promise<boolean> {
  const { error } = await supabase.from('rewards').insert({
    family_id: familyId,
    name: reward.name,
    cost: reward.cost,
    icon: reward.icon,
    claimed: false,
    is_special: reward.is_special ?? false,
    visible_to_child: reward.visible_to_child ?? true,
    ...(reward.assigned_to ? { assigned_to: reward.assigned_to } : {}),
  });
  return !error;
}

export async function deleteReward(rewardId: string): Promise<boolean> {
  const { error } = await supabase.from('rewards').delete().eq('id', rewardId);
  return !error;
}

export async function claimReward(userId: string, familyId: string, rewardId: string): Promise<boolean> {
  const rewards = await getRewards(familyId);
  const reward = rewards.find(r => r.id === rewardId);
  if (!reward || reward.claimed) return false;

  const spent = await spendPoints(userId, familyId, reward.cost);
  if (!spent) return false;

  await supabase
    .from('rewards')
    .update({
      claimed: true,
      claimed_at: new Date().toISOString(),
      claimed_by: userId,
    })
    .eq('id', rewardId);

  await addActivity(userId, familyId, {
    description: `Claimed: ${reward.name}`,
    points_change: -reward.cost,
    icon: 'gift',
  });

  return true;
}

// ============================================
// HYDRATION
// ============================================

export async function getHydration(userId: string, familyId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('hydration')
    .select('count')
    .eq('user_id', userId)
    .eq('family_id', familyId)
    .eq('date', today)
    .single();

  if (error || !data) return 0;
  return data.count;
}

export async function incrementHydration(userId: string, familyId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const current = await getHydration(userId, familyId);
  const next = Math.min(current + 1, 8);

  const { data: existing } = await supabase
    .from('hydration')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('hydration')
      .update({ count: next })
      .eq('id', existing.id);
  } else {
    await supabase.from('hydration').insert({
      user_id: userId,
      family_id: familyId,
      date: today,
      count: next,
    });
  }

  return next;
}

// ============================================
// QURAN PROGRESS (family-scoped)
// ============================================

export async function getQuranProgress(familyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('quran_progress')
    .select('pages_read')
    .eq('family_id', familyId)
    .single();

  if (error || !data) return 0;
  return data.pages_read;
}

export async function incrementQuranProgress(familyId: string): Promise<number> {
  const current = await getQuranProgress(familyId);
  const next = current + 1;

  await supabase
    .from('quran_progress')
    .update({
      pages_read: next,
      updated_at: new Date().toISOString(),
    })
    .eq('family_id', familyId);

  return next;
}

// ============================================
// DAILY MISSIONS
// ============================================

export async function getDailyMission(familyId: string, date: string, verseKey: string): Promise<DailyMission | null> {
  // Try to fetch existing
  const { data: existing } = await supabase
    .from('daily_missions')
    .select('*')
    .eq('family_id', familyId)
    .eq('date', date)
    .single();

  if (existing) return existing as DailyMission;

  // Generate and insert
  const { missionText, reflectionPrompt } = generateDailyMission(verseKey);

  const { data: inserted, error } = await supabase
    .from('daily_missions')
    .insert({
      family_id: familyId,
      date,
      verse_key: verseKey,
      generated_text: missionText,
      parent_override_prompt: reflectionPrompt,
      is_parent_override: false,
    })
    .select()
    .single();

  if (error) return null;
  return inserted as DailyMission;
}

export async function setDailyMissionOverride(
  familyId: string,
  date: string,
  missionText: string,
  reflectionPrompt: string
): Promise<void> {
  await supabase
    .from('daily_missions')
    .update({
      parent_override_text: missionText,
      parent_override_prompt: reflectionPrompt,
      is_parent_override: true,
    })
    .eq('family_id', familyId)
    .eq('date', date);
}

export async function hasCompletedDailyMission(userId: string, familyId: string, date: string): Promise<boolean> {
  const { data } = await supabase
    .from('mission_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('family_id', familyId)
    .not('daily_mission_id', 'is', null)
    .gte('completed_at', `${date}T00:00:00`)
    .lt('completed_at', `${date}T23:59:59.999`)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export async function getTodayReflectionCount(userId: string, familyId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('mission_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('family_id', familyId)
    .not('reflection_text', 'is', null)
    .gte('completed_at', `${today}T00:00:00`)
    .lt('completed_at', `${today}T23:59:59.999`);

  return data?.length ?? 0;
}

// ============================================
// DAILY SCHEDULE
// ============================================

export async function getDailyScheduleEvents(familyId: string, date: string, userId?: string): Promise<ScheduleEvent[]> {
  let query = supabase
    .from('daily_schedule')
    .select('*')
    .eq('family_id', familyId)
    .eq('date', date);

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query.order('time', { ascending: true, nullsFirst: false });
  if (error) return [];
  return data as ScheduleEvent[];
}

export async function addScheduleEvent(
  familyId: string,
  userId: string,
  event: { title: string; time?: string; date: string }
): Promise<void> {
  await supabase.from('daily_schedule').insert({
    family_id: familyId,
    user_id: userId,
    date: event.date,
    title: event.title,
    time: event.time || null,
  });
}

export async function deleteScheduleEvent(eventId: string): Promise<void> {
  await supabase.from('daily_schedule').delete().eq('id', eventId);
}

// ============================================
// PROOF IMAGE UPLOAD
// ============================================

export async function uploadProofImage(file: File, userId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('proof-images')
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) return null;
  const { data } = supabase.storage.from('proof-images').getPublicUrl(path);
  return data.publicUrl ?? null;
}

// ============================================
// QURAN READING DETECTION
// ============================================

export interface QuranRead {
  id: string;
  user_id: string;
  family_id: string;
  reader_name: string;
  verse_key: string;
  surah_name: string;
  read_at: string;
}

/** Record that a user viewed a verse (upsert — one row per user+verse per day). */
export async function recordQuranRead(
  userId: string,
  familyId: string,
  readerName: string,
  verseKey: string,
  surahName: string,
): Promise<void> {
  // Silently fail if table doesn't exist yet — non-blocking
  await supabase.from('quran_reads').upsert(
    { user_id: userId, family_id: familyId, reader_name: readerName, verse_key: verseKey, surah_name: surahName, read_at: new Date().toISOString() },
    { onConflict: 'user_id,verse_key,read_date' }
  );
}

/** Get recent verse reads for a family, optionally filtered by child user_id. */
export async function getQuranReads(familyId: string, userId?: string): Promise<QuranRead[]> {
  let q = supabase
    .from('quran_reads')
    .select('*')
    .eq('family_id', familyId)
    .order('read_at', { ascending: false })
    .limit(100);
  if (userId) q = q.eq('user_id', userId);
  const { data } = await q;
  return (data ?? []) as QuranRead[];
}
