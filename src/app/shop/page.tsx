'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFamilyPoints, getActivities, getRewards, claimReward } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import LoadingBlock from '@/components/LoadingBlock';
import { ActivityEntry, Reward } from '@/lib/types';
import { Diamond, Gift, Sun, AlertCircle, BookOpen, ChevronDown } from 'lucide-react';

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (hours < 1) return 'Just now';
  if (hours < 24) return `Today, ${new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return `Yesterday, ${new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return `${days} days ago`;
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  sun: Sun,
  'alert-circle': AlertCircle,
  'book-open': BookOpen,
  gift: Gift,
  'check-circle': Gift,
};

export default function ShopPage() {
  const { user, family } = useAuth();
  const [points, setPoints] = useState(0);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const refreshData = useCallback(async () => {
    if (!family) return;
    const [pts, acts, rwds] = await Promise.all([
      getFamilyPoints(family.id),
      getActivities(family.id),
      getRewards(family.id),
    ]);
    setPoints(pts);
    setActivities(acts);
    setRewards(rwds);
    setLoading(false);
  }, [family]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  if (loading) {
    return (
      <LoadingBlock fullScreen />
    );
  }

  const nextReward = rewards.find(r => !r.claimed);
  const progressToNext = nextReward ? Math.min((points / nextReward.cost) * 100, 100) : 100;
  const pointsToGo = nextReward ? Math.max(nextReward.cost - points, 0) : 0;

  async function handleClaim(rewardId: string) {
    if (!user || !family) return;
    const success = await claimReward(user.id, family.id, rewardId);
    if (success) refreshData();
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4 space-y-5 page-enter">
        {/* Family Treasure */}
        <div className="bg-white rounded-2xl p-8 border border-cream-dark text-center">
          <div className="flex justify-center mb-4">
            <Diamond size={48} className="text-gold" />
          </div>
          <h2 className="text-lg font-extrabold text-gray-800 uppercase tracking-wider">Family Treasure</h2>
          <div className="inline-flex items-center gap-2 bg-gold rounded-full px-6 py-2 mt-3">
            <Diamond size={16} className="text-white" fill="white" />
            <span className="text-xl font-extrabold text-white">{points.toLocaleString()}</span>
          </div>
        </div>

        {/* Next Reward */}
        {nextReward && (
          <div className="bg-white rounded-2xl p-5 border border-cream-dark">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Next Reward</p>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-extrabold text-gray-800">{nextReward.name}</h3>
              <span className="text-sm font-bold text-forest">{Math.round(progressToNext)}%</span>
            </div>
            <div className="w-full h-3 bg-cream-dark rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-forest rounded-full transition-all duration-500"
                style={{ width: `${progressToNext}%` }}
              />
            </div>
            <p className="text-xs text-gold-dark font-semibold italic">
              {pointsToGo > 0 ? `Only ${pointsToGo} points to go!` : 'Ready to claim!'}
            </p>
            {pointsToGo === 0 && (
              <button
                type="button"
                onClick={() => handleClaim(nextReward.id)}
                className="mt-3 w-full py-3 rounded-xl bg-gold text-white font-bold text-sm hover:bg-gold-dark transition-colors"
              >
                Claim Reward
              </button>
            )}
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🕐</span>
            <h2 className="font-extrabold text-gray-800 uppercase tracking-wider">Recent Activity</h2>
          </div>
          <div className="space-y-3">
            {activities.slice(0, showAllActivity ? undefined : 6).map(activity => {
              const Icon = ACTIVITY_ICONS[activity.icon] || Gift;
              const isPositive = activity.points_change > 0;
              const bgColor = activity.points_change < -100
                ? 'bg-gold/10 border-gold/20'
                : 'bg-white border-cream-dark';
              const iconBg = isPositive ? 'bg-green-100' : activity.points_change < -100 ? 'bg-gold/20' : 'bg-red-100';
              const iconColor = isPositive ? 'text-green-600' : activity.points_change < -100 ? 'text-gold-dark' : 'text-red-500';

              return (
                <div key={activity.id} className={`rounded-2xl p-4 border ${bgColor} flex items-center gap-3`}>
                  <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
                    <Icon size={18} className={iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${activity.points_change < -100 ? 'text-gold-dark' : 'text-gray-800'}`}>
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-400">{formatRelativeTime(activity.created_at)}</p>
                  </div>
                  <span className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    {isPositive ? '+' : ''}{activity.points_change}
                    <Diamond size={10} className="inline ml-0.5" />
                  </span>
                </div>
              );
            })}
            {activities.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
            )}
          </div>

          {activities.length > 6 && (
            <button type="button" onClick={() => setShowAllActivity(v => !v)} className="w-full text-center py-3 text-xs font-bold text-gray-400 uppercase tracking-wider mt-2 flex items-center justify-center gap-1">
              {showAllActivity ? 'Show Less' : 'View Older History'}
              <ChevronDown size={14} className={`transition-transform ${showAllActivity ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </main>
    </>
  );
}
