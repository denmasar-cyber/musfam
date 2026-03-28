import { supabase } from './supabase';
import { Family } from './types';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const DEFAULT_REWARDS = [
  { name: 'Pizza Night!',      cost: 1500, icon: 'pizza'   },
  { name: 'Ice Cream Pack',    cost: 500,  icon: 'ice-cream' },
  { name: 'Movie Night',       cost: 2000, icon: 'film'    },
  { name: 'Extra Screen Time', cost: 300,  icon: 'monitor' },
];

export async function createFamily(
  userId: string,
  familyName: string,
  _pin: string,
  userName: string,
  role: 'parent' | 'child'
): Promise<Family> {
  const inviteCode = generateInviteCode();

  // Create family (PIN protection removed)
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({ name: familyName, invite_code: inviteCode, pin_hash: '', created_by: userId })
    .select()
    .single();
  if (familyError || !family) throw new Error(familyError?.message || 'Failed to create family');

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, family_id: family.id, name: userName, role }, { onConflict: 'id' });
  if (profileError) throw new Error(profileError.message);

  // Seed rewards, points, streak, quran_progress (ignore errors — best effort)
  await Promise.all([
    supabase.from('rewards').insert(
      DEFAULT_REWARDS.map(r => ({ ...r, family_id: family.id, claimed: false }))
    ),
    supabase.from('points').upsert(
      { user_id: userId, family_id: family.id, total_points: 0 },
      { onConflict: 'user_id,family_id', ignoreDuplicates: true }
    ),
    supabase.from('streaks').upsert(
      { user_id: userId, family_id: family.id, current_streak: 0, longest_streak: 0 },
      { onConflict: 'user_id,family_id', ignoreDuplicates: true }
    ),
    supabase.from('quran_progress').upsert(
      { family_id: family.id, pages_read: 0 },
      { onConflict: 'family_id', ignoreDuplicates: true }
    ),
  ]);

  return family as Family;
}

export async function joinFamily(
  userId: string,
  inviteCode: string,
  userName: string,
  role: 'parent' | 'child'
): Promise<Family> {
  // Look up family by invite code
  const { data: family, error: lookupError } = await supabase
    .from('families')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();
  if (lookupError || !family) {
    console.error("Family lookup failed:", lookupError?.message || "Not found");
    throw new Error('Invalid invite code. Please check and try again.');
  }

  // Upsert profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, family_id: family.id, name: userName, role }, { onConflict: 'id' });
  if (profileError) throw new Error(profileError.message);

  // Initialize points & streak
  await Promise.all([
    supabase.from('points').upsert(
      { user_id: userId, family_id: family.id, total_points: 0 },
      { onConflict: 'user_id,family_id', ignoreDuplicates: true }
    ),
    supabase.from('streaks').upsert(
      { user_id: userId, family_id: family.id, current_streak: 0, longest_streak: 0 },
      { onConflict: 'user_id,family_id', ignoreDuplicates: true }
    ),
  ]);

  return family as Family;
}

export async function verifyPin(familyId: string, pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_family_pin', { p_family_id: familyId, p_pin: pin });
  if (error) return false;
  return data === true;
}
