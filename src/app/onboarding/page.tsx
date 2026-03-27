'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createFamily, joinFamily } from '@/lib/families';
import { Home, Users, Copy, Check } from 'lucide-react';

type Step = 'choose' | 'create' | 'join' | 'success';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Create family fields
  const [familyName, setFamilyName] = useState('');
  const [userName, setUserName] = useState('');
  const [role, setRole] = useState<'parent' | 'child'>('parent');
  const [pin, setPin] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Join family fields
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinRole, setJoinRole] = useState<'parent' | 'child'>('child');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN must be 4 digits');
      return;
    }

    if (!user) {
      setError('Not logged in');
      return;
    }

    setLoading(true);
    try {
      const family = await createFamily(user.id, familyName, pin, userName, role);
      setInviteCode(family.invite_code);
      await refreshProfile();
      setStep('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create family';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Not logged in');
      return;
    }

    setLoading(true);
    try {
      await joinFamily(user.id, joinCode, joinName, joinRole);
      await refreshProfile();
      router.push('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join family';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-cream-light">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-forest">Musfam</h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 'choose' && 'Set up your family'}
            {step === 'create' && 'Create a new family group'}
            {step === 'join' && 'Join a family'}
            {step === 'success' && 'Family created!'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        {/* Step: Choose */}
        {step === 'choose' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep('create')}
              className="w-full bg-white rounded-2xl p-5 border-2 border-forest/20 hover:border-forest transition-colors text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-forest flex items-center justify-center flex-shrink-0">
                <Home size={22} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Create New Family</p>
                <p className="text-xs text-gray-500">Be the first, invite family members</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStep('join')}
              className="w-full bg-white rounded-2xl p-5 border-2 border-forest/20 hover:border-forest transition-colors text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
                <Users size={22} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Join Family</p>
                <p className="text-xs text-gray-500">Have an invite code? Join here</p>
              </div>
            </button>
          </div>
        )}

        {/* Step: Create Family */}
        {step === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="familyName" className="block text-sm font-semibold text-gray-700 mb-1">Family Name</label>
              <input
                id="familyName"
                type="text"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                required
                placeholder="e.g. Al-Ahmad Family"
                className="w-full rounded-xl border border-cream-dark bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
            </div>

            <div>
              <label htmlFor="userName" className="block text-sm font-semibold text-gray-700 mb-1">Your Name</label>
              <input
                id="userName"
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                required
                placeholder="Display name"
                className="w-full rounded-xl border border-cream-dark bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Role</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRole('parent')}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${role === 'parent' ? 'bg-forest text-white' : 'bg-white text-gray-500 border border-cream-dark'}`}
                >
                  Guardian
                </button>
                <button
                  type="button"
                  onClick={() => setRole('child')}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${role === 'child' ? 'bg-forest text-white' : 'bg-white text-gray-500 border border-cream-dark'}`}
                >
                  Child
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="pin" className="block text-sm font-semibold text-gray-700 mb-1">Guardian Center PIN (4 digits)</label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                placeholder="e.g. 1234"
                className="w-full rounded-xl border border-cream-dark bg-white p-3 text-sm text-center tracking-[1em] focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
              <p className="text-xs text-gray-400 mt-1">This PIN locks the Guardian Command Center</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-forest text-white font-bold text-sm hover:bg-forest-light transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Family'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('choose'); setError(''); }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          </form>
        )}

        {/* Step: Join Family */}
        {step === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="joinCode" className="block text-sm font-semibold text-gray-700 mb-1">Invite Code</label>
              <input
                id="joinCode"
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                required
                maxLength={6}
                placeholder="e.g. X7K2AB"
                className="w-full rounded-xl border border-cream-dark bg-white p-3 text-sm text-center tracking-[0.5em] uppercase focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
            </div>

            <div>
              <label htmlFor="joinName" className="block text-sm font-semibold text-gray-700 mb-1">Your Name</label>
              <input
                id="joinName"
                type="text"
                value={joinName}
                onChange={e => setJoinName(e.target.value)}
                required
                placeholder="Display name"
                className="w-full rounded-xl border border-cream-dark bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Role</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setJoinRole('parent')}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${joinRole === 'parent' ? 'bg-forest text-white' : 'bg-white text-gray-500 border border-cream-dark'}`}
                >
                  Guardian
                </button>
                <button
                  type="button"
                  onClick={() => setJoinRole('child')}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${joinRole === 'child' ? 'bg-forest text-white' : 'bg-white text-gray-500 border border-cream-dark'}`}
                >
                  Child
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-forest text-white font-bold text-sm hover:bg-forest-light transition-colors disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Family'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('choose'); setError(''); }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          </form>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="space-y-4 text-center">
            <div className="bg-white rounded-2xl p-6 border border-forest/20">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <p className="font-bold text-gray-800 mb-2">Family &quot;{familyName}&quot; created!</p>
              <p className="text-sm text-gray-500 mb-4">Share this invite code with your family members:</p>

              <div className="bg-cream-light rounded-xl p-4 flex items-center justify-center gap-3">
                <span className="text-2xl font-extrabold text-forest tracking-[0.3em]">{inviteCode}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-forest"
                  title="Salin kode"
                >
                  {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full py-3 rounded-xl bg-forest text-white font-bold text-sm hover:bg-forest-light transition-colors"
            >
              Start Using Musfam
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
