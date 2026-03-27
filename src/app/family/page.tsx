'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMissions, addMission, deleteMission, updateMission, getTodayCompletions } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import LoadingBlock from '@/components/LoadingBlock';
import { Mission } from '@/lib/types';
import { Star, Pencil, Trash2, BookOpen, Users, Check, X } from 'lucide-react';

export default function FamilyPage() {
  const { user, family } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // New mission form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Mission['category']>('spiritual');
  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const refreshData = useCallback(async () => {
    if (!family) return;
    const [allMissions, todayCompletions] = await Promise.all([
      getMissions(family.id),
      getTodayCompletions(family.id),
    ]);
    setMissions(allMissions);
    setCompletedCount(todayCompletions.length);
    setLoading(false);
  }, [family]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  async function handleAddMission() {
    if (!newTitle.trim() || !user || !family) return;
    await addMission(family.id, user.id, {
      title: newTitle.trim(),
      description: '',
      category: newCategory,
      icon: newCategory === 'spiritual' ? 'sparkles' : newCategory === 'health' ? 'activity' : newCategory === 'chores' ? 'home' : 'book-open',
    });
    setNewTitle('');
    refreshData();
  }

  async function handleDelete(id: string) {
    await deleteMission(id);
    refreshData();
  }

  async function handleSaveEdit(id: string) {
    if (!editTitle.trim()) return;
    await updateMission(id, { title: editTitle.trim() });
    setEditingId(null);
    refreshData();
  }

  if (loading) {
    return <LoadingBlock fullScreen />;
  }

  const totalMissions = missions.length;
  const completionRate = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;
  const parentMissions = missions.filter(m => !m.is_default);

  const categories: Mission['category'][] = ['spiritual', 'health', 'chores', 'education'];
  const categoryColors: Record<string, string> = {
    spiritual: 'bg-forest',
    health: 'bg-green-500',
    chores: 'bg-amber-500',
    education: 'bg-lime-500',
  };

  return (
    <>
      <main className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4 space-y-5 page-enter">
        <h1 className="text-2xl font-extrabold text-gray-800">Guardian Command Center</h1>
        <p className="text-sm text-gray-500 -mt-3">Empower your family with new challenges today.</p>

        {/* Stats */}
        <div className="bg-white rounded-2xl p-4 border border-cream-dark flex items-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-gold flex items-center justify-center">
            <span className="text-sm font-extrabold text-gold">{completionRate}%</span>
          </div>
          <div>
            <p className="font-bold text-gray-800">Family completion rate</p>
            <p className="text-sm text-gray-500">You&apos;re crushing it this week!</p>
          </div>
        </div>

        <div className="bg-olive/10 rounded-2xl p-4 border border-olive/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center">
            <Star size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-800">Active Missions</p>
            <p className="text-2xl font-extrabold text-gray-800">{totalMissions}</p>
          </div>
        </div>

        {/* New Mission Form */}
        <div className="bg-white rounded-2xl p-5 border-2 border-blue-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">New Mission</p>
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Add a new mission..."
            className="w-full rounded-xl border border-cream-dark bg-cream-light p-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
          <div className="flex flex-wrap gap-2 mb-3">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setNewCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  newCategory === cat ? 'bg-forest text-white' : 'bg-cream-dark text-gray-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${categoryColors[cat]}`} />
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddMission}
            disabled={!newTitle.trim()}
            className="w-full py-3 rounded-xl bg-forest text-white font-bold text-sm hover:bg-forest-light transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            + Add Mission
          </button>
        </div>

        {/* Current Missions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-gray-800">Current Missions</h2>
          </div>
          <div className="space-y-3">
            {parentMissions.map(mission => {
              const catColor = categoryColors[mission.category];
              return (
                <div key={mission.id} className={`bg-white rounded-2xl p-4 border-l-4 ${mission.category === 'spiritual' ? 'border-blue-500' : mission.category === 'health' ? 'border-green-500' : mission.category === 'chores' ? 'border-amber-500' : 'border-lime-500'} flex items-center gap-3`}>
                  <div className={`w-10 h-10 rounded-xl ${catColor} flex items-center justify-center flex-shrink-0`}>
                    {mission.category === 'spiritual' ? <Star size={18} className="text-white" /> :
                     mission.category === 'health' ? <Users size={18} className="text-white" /> :
                     <BookOpen size={18} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === mission.id ? (
                      <input
                        autoFocus
                        aria-label="Edit mission title"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(mission.id); if (e.key === 'Escape') setEditingId(null); }}
                        className="w-full font-bold text-gray-800 border-b-2 border-forest focus:outline-none bg-transparent text-sm"
                      />
                    ) : (
                      <>
                        <h3 className="font-bold text-gray-800 truncate">{mission.title}</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase">{mission.category}</p>
                      </>
                    )}
                  </div>
                  {editingId === mission.id ? (
                    <>
                      <button type="button" title="Save" onClick={() => handleSaveEdit(mission.id)} className="text-green-500 hover:text-green-700">
                        <Check size={18} />
                      </button>
                      <button type="button" title="Cancel" onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" title="Edit mission" onClick={() => { setEditingId(mission.id); setEditTitle(mission.title); }} className="text-gray-400 hover:text-forest">
                        <Pencil size={18} />
                      </button>
                      <button type="button" title="Delete mission" onClick={() => handleDelete(mission.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            {parentMissions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No custom missions yet. Add one above!</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
