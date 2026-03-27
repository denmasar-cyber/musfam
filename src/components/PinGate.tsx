'use client';

import { useState, useRef } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { verifyPin } from '@/lib/families';

interface PinGateProps {
  familyId: string;
  onSuccess: () => void;
}

export default function PinGate({ familyId, onSuccess }: PinGateProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (value && index === 3) {
      const pin = newDigits.join('');
      if (pin.length === 4) {
        handleVerify(pin);
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(pin: string) {
    setLoading(true);
    setError('');

    try {
      const valid = await verifyPin(familyId, pin);
      if (valid) {
        onSuccess();
      } else {
        setError('Incorrect PIN. Try again.');
        setDigits(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('PIN verification failed');
      setDigits(['', '', '', '']);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center py-8 space-y-6">
      <div className="w-20 h-20 rounded-full bg-forest/10 flex items-center justify-center">
        <Lock size={36} className="text-forest" />
      </div>

      <div className="text-center">
        <h2 className="text-xl font-extrabold text-gray-800">Guardian Center Locked</h2>
        <p className="text-sm text-gray-500 mt-1">Enter your 4-digit PIN to access</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={loading}
            className="w-14 h-16 rounded-xl border-2 border-cream-dark bg-white text-center text-2xl font-bold text-forest focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest disabled:opacity-50"
          />
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-5 h-5 border-2 border-forest/20 border-t-forest rounded-full animate-spin" />
          Verifying...
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <ShieldCheck size={14} />
        <span>This PIN protects the Guardian Command Center</span>
      </div>
    </div>
  );
}
