'use client';

import { useState } from 'react';
import { X, Send, BookOpen } from 'lucide-react';
import { fetchVerse, getRandomVerseRef, QuranVerse } from '@/lib/quran';
import { completeMission, addReflection, getMissions } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';

interface ReflectionModalProps {
  missionId: string;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'reflect' | 'loading' | 'verse';

export default function ReflectionModal({ missionId, onClose, onComplete }: ReflectionModalProps) {
  const { user, family } = useAuth();
  const [step, setStep] = useState<Step>('reflect');
  const [reflectionText, setReflectionText] = useState('');
  const [verse, setVerse] = useState<QuranVerse | null>(null);
  const [missionTitle, setMissionTitle] = useState('');

  // Load mission title
  useState(() => {
    if (family) {
      getMissions(family.id).then(missions => {
        const m = missions.find(m => m.id === missionId);
        if (m) setMissionTitle(m.title);
      });
    }
  });

  const wordCount = reflectionText.trim().split(/\s+/).filter(Boolean).length;

  async function handleSubmitReflection() {
    if (wordCount < 15 || !user || !family) return;
    setStep('loading');

    const verseRef = getRandomVerseRef();
    const fetchedVerse = await fetchVerse(verseRef.chapter, verseRef.verse);

    const today = new Date().toISOString().split('T')[0];
    const { data: completion } = await completeMission(user.id, family.id, missionId, today, true, undefined, undefined, 100, reflectionText, 'child');

    if (fetchedVerse && completion) {
      setVerse(fetchedVerse);
      await addReflection(family.id, {
        user_id: user.id,
        mission_id: missionId,
        completion_id: completion.id,
        reflection_text: reflectionText,
        verse_key: fetchedVerse.verse_key,
        verse_text_arabic: fetchedVerse.text_uthmani,
        verse_translation: fetchedVerse.translation,
      });
    }

    setStep('verse');
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
      <div className="bg-cream-light w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto page-enter">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-forest">
            {step === 'reflect' ? 'Reflect on Your Mission' : step === 'loading' ? 'Finding Your Verse...' : 'Your Quran Connection'}
          </h2>
          <button type="button" title="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {step === 'reflect' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-cream-dark">
              <p className="text-sm text-gray-500 mb-1">Mission completed</p>
              <p className="font-bold text-forest">{missionTitle}</p>
            </div>

            <div>
              <label htmlFor="reflection" className="block text-sm font-semibold text-gray-700 mb-2">
                How did this make you feel? What did you learn?
              </label>
              <textarea
                id="reflection"
                value={reflectionText}
                onChange={e => setReflectionText(e.target.value)}
                placeholder="Write your reflection here... (min. 15 words)"
                rows={4}
                dir="ltr"
                className="w-full rounded-xl border border-cream-dark bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30 resize-none"
              />
              <p className={`text-[11px] font-bold mt-1 ${wordCount >= 15 ? 'text-green-600' : 'text-gray-400'}`}>
                {wordCount} / 15 words minimum
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmitReflection}
              disabled={wordCount < 15}
              className="w-full py-3 rounded-xl bg-forest text-white font-semibold text-sm hover:bg-forest-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send size={16} />
              Submit Reflection (+100 pts)
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-12 h-12 border-4 border-forest/20 border-t-forest rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Connecting your reflection to the Quran...</p>
          </div>
        )}

        {step === 'verse' && verse && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-forest/20 text-center">
              <span className="inline-block bg-olive/10 text-olive text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
                Surah {verse.surah_name}
              </span>
              <p className="arabic-text text-2xl text-forest mb-4 leading-relaxed">
                {verse.text_uthmani}
              </p>
              <hr className="border-cream-dark my-3" />
              <p className="text-sm text-gray-600 italic leading-relaxed">
                &ldquo;{verse.translation}&rdquo;
              </p>
            </div>

            <div className="bg-forest/5 rounded-2xl p-4 border border-forest/10">
              <p className="text-xs text-gray-500 mb-1">Your reflection</p>
              <p className="text-sm text-gray-700">{reflectionText}</p>
            </div>

            <button
              type="button"
              onClick={onComplete}
              className="w-full py-3 rounded-xl bg-forest text-white font-bold text-sm hover:bg-forest-light transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen size={16} />
              Continue
            </button>
          </div>
        )}

        {step === 'verse' && !verse && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-cream-dark text-center">
              <p className="text-sm text-gray-500">Could not fetch verse. Your mission is still completed!</p>
            </div>
            <button
              type="button"
              onClick={onComplete}
              className="w-full py-3 rounded-xl bg-forest text-white font-bold text-sm"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
