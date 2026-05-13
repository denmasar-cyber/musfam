'use client';

import { Mission, CATEGORY_COLORS } from '@/lib/types';
import { Activity, Sparkles, Home, BookOpen, Droplets, UtensilsCrossed, CheckCircle } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  activity: Activity,
  sparkles: Sparkles,
  home: Home,
  'book-open': BookOpen,
  droplets: Droplets,
  utensils: UtensilsCrossed,
};

interface MissionCardProps {
  mission: Mission;
  completed: boolean;
  onStart: (missionId: string) => void;
  variant?: 'home' | 'league';
}

export default function MissionCard({ mission, completed, onStart, variant = 'home' }: MissionCardProps) {
  const colors = CATEGORY_COLORS[mission.category];
  const Icon = ICON_MAP[mission.icon] || Activity;

  if (variant === 'home') {
    return (
      <div className={`bg-white rounded-2xl p-4 border border-cream-dark flex items-center gap-4 transition-all ${completed ? 'opacity-75' : ''}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${completed ? 'bg-gray-200' : colors.iconBg}`}>
          <Icon size={24} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 truncate">{mission.title}</h3>
          <p className="text-sm text-gray-500 truncate">{mission.description}</p>
        </div>
        {completed ? (
          <div className="flex items-center gap-1 text-forest">
            <CheckCircle size={18} />
            <span className="text-sm font-semibold">Done</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onStart(mission.id)}
            className="bg-forest text-white text-sm font-bold px-4 py-2 rounded-full hover:bg-forest-light transition-colors"
          >
            DONE
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-5 border-2 ${colors.border} ${colors.bg} transition-all ${completed ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>{mission.category}</span>
            {completed ? (
              <CheckCircle size={16} className="text-forest" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
            )}
          </div>
          <h3 className="font-bold text-gray-800 text-lg">{mission.title}</h3>
          <p className="text-sm text-gray-500 mt-1">{mission.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${completed ? 'bg-gray-200' : colors.iconBg}`}>
            <Icon size={22} className="text-white" />
          </div>
          {completed ? (
            <span className="text-sm font-semibold text-gray-400">DONE</span>
          ) : (
            <button
              type="button"
              onClick={() => onStart(mission.id)}
              className="bg-forest text-white text-sm font-bold px-5 py-2 rounded-full hover:bg-forest-light transition-colors"
            >
              START
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
