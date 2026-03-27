export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  icon?: string;
}

export interface Profile {
  id: string;
  family_id: string;
  name: string;
  role: 'parent' | 'child';
  avatar_url?: string;
  created_at: string;
}

export interface Mission {
  id: string;
  family_id: string;
  title: string;
  description: string;
  category: 'health' | 'spiritual' | 'chores' | 'education';
  icon: string;
  created_by: string;
  assigned_to?: string;
  is_default: boolean;
  created_at: string;
  points?: number;           // AP awarded on completion (default 10)
  is_special?: boolean;      // special mission classification
  visible_to_child?: boolean; // whether child can see it in their view
}

export interface MissionCompletion {
  id: string;
  family_id: string;
  user_id: string;
  mission_id: string;
  completed_at: string;
  reflection_text?: string;
  verse_id?: number;
  points_earned: number;
}

export interface Reflection {
  id: string;
  family_id: string;
  user_id: string;
  mission_id: string;
  completion_id: string;
  reflection_text: string;
  verse_key: string;
  verse_text_arabic?: string;
  verse_translation?: string;
  created_at: string;
}

export interface Points {
  user_id: string;
  family_id: string;
  total_points: number;
  updated_at: string;
}

export interface Streak {
  user_id: string;
  family_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string;
}

export interface Reward {
  id: string;
  family_id: string;
  name: string;
  cost: number;
  icon: string;
  claimed: boolean;
  claimed_at?: string;
  claimed_by?: string;
  assigned_to?: string; // user_id of the child this reward is for (null = all children)
  is_special?: boolean;      // special reward classification
  visible_to_child?: boolean; // whether child can see it in their view
}

export interface ActivityEntry {
  id: string;
  family_id: string;
  user_id: string;
  description: string;
  points_change: number;
  icon: string;
  created_at: string;
}

export type CategoryColor = {
  bg: string;
  text: string;
  border: string;
  iconBg: string;
};

export const CATEGORY_COLORS: Record<Mission['category'], CategoryColor> = {
  health: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-300',
    iconBg: 'bg-green-500',
  },
  spiritual: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
    iconBg: 'bg-blue-500',
  },
  chores: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-400',
    iconBg: 'bg-amber-500',
  },
  education: {
    bg: 'bg-lime-50',
    text: 'text-lime-700',
    border: 'border-lime-300',
    iconBg: 'bg-lime-500',
  },
};
