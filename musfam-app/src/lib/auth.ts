import { supabase } from './supabase';
import { Profile, Family } from './types';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // If email confirmation is enabled, user won't have a session yet
  // Try to sign in immediately after signup
  if (!data.session) {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) throw loginError;
    return loginData;
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function getCurrentFamily(): Promise<Family | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const { data, error } = await supabase
    .from('families')
    .select('*')
    .eq('id', profile.family_id)
    .single();

  if (error || !data) return null;
  return data as Family;
}
