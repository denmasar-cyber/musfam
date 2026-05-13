'use client';

import { useEffect, useState } from 'react';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'show' | 'fade'>('show');
  const [boyLoaded, setBoyLoaded] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase('fade'), 2400);
    const doneTimer = setTimeout(() => onDone(), 3000);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden batik-overlay"
      style={{
        background: 'linear-gradient(160deg, #1a2508 0%, #2d3a10 50%, #1a2508 100%)',
        transition: 'opacity 0.6s ease',
        opacity: phase === 'fade' ? 0 : 1,
        pointerEvents: phase === 'fade' ? 'none' : 'all',
      }}
    >
      {/* Batik kawung overlay */}
      <div className="absolute inset-0 w-full h-full pointer-events-none" style={{
        backgroundImage: 'url(/batik-kawung.png)',
        backgroundRepeat: 'repeat',
        backgroundSize: '110px auto',
        opacity: 0.09,
        mixBlendMode: 'screen',
      }} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-3 px-8">

        {/* Logo — full width, no clipping */}
        <img
          src="/musfam-logo.png"
          alt="Musfam"
          className="w-64 object-contain"
          style={{ maxHeight: '180px' }}
        />

        {/* Bismillah */}
        <p className="text-2xl" style={{
          fontFamily: "'Amiri Quran', 'Amiri', serif",
          color: '#c8a84b',
          textShadow: '0 1px 10px rgba(200,168,75,0.4)',
          direction: 'rtl',
        }}>
          بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
        </p>

        {/* Loading dots */}
        <div className="flex gap-2 mt-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full" style={{
              backgroundColor: '#c8a84b',
              animation: `splashPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>

      {/* Muslim avatar — slides in from left with float effect */}
      {boyLoaded && (
        <div className="absolute bottom-14 left-0 pointer-events-none z-10"
          style={{ animation: 'boySlide 5s ease-in-out infinite' }}>
          <img
            src="/muslim-boy-walking.png"
            alt=""
            className="h-28 w-auto object-contain"
            style={{
              animation: 'boyFloat 1.6s ease-in-out infinite',
              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.45))',
            }}
          />
        </div>
      )}
      {/* Preload */}
      <img
        src="/muslim-boy-walking.png"
        alt=""
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        onLoad={() => setBoyLoaded(true)}
      />

      {/* Developer credit */}
      <div className="absolute bottom-4 left-0 right-0 text-center z-10 px-6"
        style={{ color: 'rgba(200,168,75,0.6)', fontSize: '10px', letterSpacing: '0.1em' }}>
        <p className="uppercase tracking-widest">A Product of</p>
        <p className="font-bold text-[11px] mt-0.5" style={{ color: 'rgba(200,168,75,0.8)' }}>
          Fajr Al-Garuda
        </p>
        <p className="italic mt-0.5" style={{ color: 'rgba(245,240,232,0.4)' }}>
          Cakrawala Nusantara · Terbang Membelah Langit
        </p>
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes boySlide {
          0%   { transform: translateX(-10vw); }
          40%  { transform: translateX(35vw); }
          60%  { transform: translateX(35vw); }
          100% { transform: translateX(110vw); }
        }
        @keyframes boyFloat {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
