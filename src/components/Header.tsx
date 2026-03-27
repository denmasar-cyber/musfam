'use client';

import { Diamond, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getFamilyPoints } from '@/lib/store';
import { useEffect, useState } from 'react';

interface HeaderProps {
  showPoints?: boolean;
  showAvatar?: boolean;
  avatarPosition?: 'left' | 'right';
}

export default function Header({ showPoints = false, showAvatar = false, avatarPosition = 'left' }: HeaderProps) {
  const { family } = useAuth();
  const [points, setPoints] = useState(0);
  const [savedCity, setSavedCity] = useState<string>(() => {
    try {
      return typeof window !== 'undefined' ? (localStorage.getItem('musfam_weather_city') || '') : '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (!family) return;
    getFamilyPoints(family.id).then(setPoints);
    const interval = setInterval(() => {
      getFamilyPoints(family.id).then(setPoints);
    }, 3000);
    return () => clearInterval(interval);
  }, [family]);

  // Keep city label in sync when other parts of the app update localStorage
  useEffect(() => {
    const handle = (e: StorageEvent) => {
      if (e.key === 'musfam_weather_city') setSavedCity(e.newValue || '');
    };
    window.addEventListener('storage', handle);
    return () => window.removeEventListener('storage', handle);
  }, []);

  function openCityPicker() {
    try {
      // Signal other components (WeatherBar) to open the picker by toggling a storage key
      localStorage.setItem('musfam_show_city_picker', String(Date.now()));
    } catch {
      // ignore
    }
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-cream-light border-b border-cream-dark">
      <div className="flex items-center gap-2">
        <img src="/favicon.svg" alt="Musfam" className="w-8 h-8 rounded-lg" />
        <span className="text-xl font-extrabold text-forest tracking-tight" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Musfam</span>
      </div>
      <div className="flex items-center gap-3">
        {/* City chip — plain text clickable to open the city picker */}
        <button type="button" onClick={openCityPicker}
          className="text-sm font-medium px-3 py-1 rounded-full border border-cream-dark bg-white/0 hover:bg-gray-50 transition-colors">
          {savedCity ? <span className="text-forest">{savedCity}</span> : <span className="text-gray-500">Set City</span>}
        </button>

        {showPoints && (
          <div className="flex items-center gap-1 bg-gold rounded-full px-3 py-1">
            <Diamond size={14} className="text-white" fill="white" />
            <span className="text-white font-bold text-sm">{points.toLocaleString()}</span>
          </div>
        )}
        {showAvatar && avatarPosition === 'right' && (
          <div className="w-8 h-8 rounded-full bg-forest/20 border-2 border-forest flex items-center justify-center">
            <Users size={14} className="text-forest" />
          </div>
        )}
      </div>
    </header>
  );
}
