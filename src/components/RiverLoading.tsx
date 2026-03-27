'use client';

interface RiverLoadingProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export default function RiverLoading({ size = 'md', fullScreen = false }: RiverLoadingProps) {
  const boatW   = size === 'lg' ? 200 : 150;
  const avatarH = size === 'lg' ?  96 :  70;
  const boatH   = Math.round(boatW * 0.42);
  const avatarAboveBoat = Math.round(avatarH * 0.52);
  const boatTop = avatarAboveBoat;
  const totalH  = avatarAboveBoat + boatH; // no water area

  const boatAndAvatar = (
    <div className="w-full relative" style={{ height: totalH }}>
      {/* Avatar + Boat — rock as one unit */}
      <div className="absolute" style={{
        left: '50%',
        top: 0,
        width: boatW,
        zIndex: 2,
        animation: 'rlRock 2.3s ease-in-out infinite',
        transformOrigin: '50% 100%',
      }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', zIndex: 1 }}>
          <img
            src="/muslim-boy-walking.png"
            alt=""
            style={{
              height: avatarH,
              width: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
              display: 'block',
            }}
          />
        </div>
        <div style={{
          position: 'absolute',
          left: 0,
          top: boatTop,
          width: '100%',
          zIndex: 2,
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.28))',
        }}>
          <img src="/boat.png" alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      </div>

      <style>{`
        @keyframes rlRock {
          0%, 100% { transform: translateX(-50%) rotate(-1.6deg) translateY(0px); }
          50%       { transform: translateX(-50%) rotate(1.6deg)  translateY(-4px); }
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#1a2508]/90 backdrop-blur-sm overflow-hidden">
        {/* Boat + avatar only */}
        <div className="w-full max-w-xs relative z-10">
          {boatAndAvatar}
        </div>
        <p className="text-white/60 text-xs font-medium tracking-widest uppercase animate-pulse mt-2 relative z-10">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4 w-full">
      {boatAndAvatar}
      <p className="text-[#2d3a10]/50 text-xs font-medium tracking-widest uppercase animate-pulse">Loading...</p>
    </div>
  );
}
