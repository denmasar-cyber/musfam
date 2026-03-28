'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback } from 'react';
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
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Join family fields
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinRole, setJoinRole] = useState<'parent' | 'child'>('child');

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Not logged in');
      return;
    }

    setLoading(true);
    try {
      const family = await createFamily(user.id, familyName, '', userName, role);
      setInviteCode(family.invite_code);
      await refreshProfile();
      setStep('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create family';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, familyName, userName, role, refreshProfile]);

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
    <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(160deg, #1a2508 0%, #2d3a10 60%, #1a2508 100%)' }}>
      {/* Batik overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'url(/batik-kawung.png)',
        backgroundRepeat: 'repeat',
        backgroundSize: '100px auto',
        opacity: 0.06,
        mixBlendMode: 'screen',
      }} />

      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/musfam-logo.png" alt="Musfam" className="h-16 mx-auto object-contain mb-3" />
          <p className="text-sm font-medium" style={{ color: 'rgba(200,168,75,0.7)' }}>
            {step === 'choose' && 'Set up your Muslim family'}
            {step === 'create' && 'Create a new family group'}
            {step === 'join' && 'Join a family'}
            {step === 'success' && 'Family created! 🌙'}
          </p>
          <div className="w-16 h-px bg-[#c8a84b]/30 mx-auto mt-3" />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 text-red-300 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        {/* Step: Choose */}
        {step === 'choose' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep('create')}
              className="w-full rounded-2xl p-5 text-left flex items-center gap-4 active:scale-[0.98] transition-transform"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(200,168,75,0.25)' }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #2d3a10, #5a6b28)' }}>
                <Home size={22} className="text-[#c8a84b]" />
              </div>
              <div>
                <p className="font-bold text-white">Create New Family</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(200,168,75,0.6)' }}>
                  Be the first, invite family members
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStep('join')}
              className="w-full rounded-2xl p-5 text-left flex items-center gap-4 active:scale-[0.98] transition-transform"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(200,168,75,0.25)' }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #8a6008, #c8a84b)' }}>
                <Users size={22} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-white">Join Family</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(200,168,75,0.6)' }}>
                  Have an invite code? Join here
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Step: Create Family */}
        {step === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="familyName" className="block text-sm font-semibold mb-1" style={{ color: 'rgba(200,168,75,0.8)' }}>
                Family Name
              </label>
              <input
                id="familyName"
                type="text"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                required
                placeholder="e.g. Al-Ahmad Family"
                className="w-full rounded-xl p-3 text-sm focus:outline-none focus:ring-2"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(200,168,75,0.3)', color: '#f5f0e8', '--tw-ring-color': 'rgba(200,168,75,0.4)' } as React.CSSProperties}
              />
            </div>

            <div>
              <label htmlFor="userName" className="block text-sm font-semibold mb-1" style={{ color: 'rgba(200,168,75,0.8)' }}>
                Your Name
              </label>
              <input
                id="userName"
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                required
                placeholder="Display name"
                className="w-full rounded-xl p-3 text-sm focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(200,168,75,0.3)', color: '#f5f0e8' }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(200,168,75,0.8)' }}>Your Role</label>
              <div className="flex gap-3">
                {(['parent', 'child'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all"
                    style={role === r
                      ? { background: '#c8a84b', color: '#1a2508' }
                      : { background: 'rgba(255,255,255,0.07)', color: 'rgba(245,240,232,0.6)', border: '1px solid rgba(200,168,75,0.2)' }
                    }
                  >
                    {r === 'parent' ? 'Guardian' : 'Child'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-transform active:scale-[0.98]"
              style={{ background: '#c8a84b', color: '#1a2508' }}
            >
              {loading ? 'Creating...' : 'Create Family'}
            </button>

            <button type="button" onClick={() => { setStep('choose'); setError(''); }}
              className="w-full py-2 text-sm" style={{ color: 'rgba(200,168,75,0.5)' }}>
              ← Back
            </button>
          </form>
        )}

        {/* Step: Join Family */}
        {step === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="joinCode" className="block text-sm font-semibold mb-1" style={{ color: 'rgba(200,168,75,0.8)' }}>Invite Code</label>
              <input
                id="joinCode"
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().trim())}
                required
                maxLength={6}
                placeholder="e.g. X7K2AB"
                className="w-full rounded-xl p-3 text-sm text-center tracking-[0.5em] uppercase focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(200,168,75,0.3)', color: '#f5f0e8' }}
              />
            </div>
            <div>
              <label htmlFor="joinName" className="block text-sm font-semibold mb-1" style={{ color: 'rgba(200,168,75,0.8)' }}>Your Name</label>
              <input
                id="joinName"
                type="text"
                value={joinName}
                onChange={e => setJoinName(e.target.value)}
                required
                placeholder="Display name"
                className="w-full rounded-xl p-3 text-sm focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(200,168,75,0.3)', color: '#f5f0e8' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(200,168,75,0.8)' }}>Your Role</label>
              <div className="flex gap-3">
                {(['parent', 'child'] as const).map(r => (
                  <button key={r} type="button" onClick={() => setJoinRole(r)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all"
                    style={joinRole === r
                      ? { background: '#c8a84b', color: '#1a2508' }
                      : { background: 'rgba(255,255,255,0.07)', color: 'rgba(245,240,232,0.6)', border: '1px solid rgba(200,168,75,0.2)' }
                    }>
                    {r === 'parent' ? 'Guardian' : 'Child'}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
              style={{ background: '#c8a84b', color: '#1a2508' }}>
              {loading ? 'Joining...' : 'Join Family'}
            </button>
            <button type="button" onClick={() => { setStep('choose'); setError(''); }}
              className="w-full py-2 text-sm" style={{ color: 'rgba(200,168,75,0.5)' }}>
              ← Back
            </button>
          </form>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="space-y-4 text-center">
            <div className="rounded-2xl p-6" style={{ background: 'rgba(200,168,75,0.1)', border: '1px solid rgba(200,168,75,0.3)' }}>
              <div className="text-4xl mb-3">🌙</div>
              <p className="font-bold text-white mb-2">Family &quot;{familyName}&quot; created!</p>
              <p className="text-sm mb-4" style={{ color: 'rgba(200,168,75,0.7)' }}>
                Share this invite code with your family:
              </p>
              <div className="rounded-xl p-4 flex items-center justify-center gap-3"
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                <span className="text-2xl font-extrabold tracking-[0.3em]" style={{ color: '#c8a84b' }}>
                  {inviteCode}
                </span>
                <button type="button" onClick={handleCopy} title="Copy invite code"
                  className="text-[#c8a84b]/60 hover:text-[#c8a84b] transition-colors">
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => router.push('/')}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: '#c8a84b', color: '#1a2508' }}>
              Start Using Musfam →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
