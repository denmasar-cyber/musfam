'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Trophy, BookOpen, User, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();

  // isParent available if needed for future differentiation
  void profile;

  const NAV_ITEMS = [
    { href: '/', label: 'CHAT', icon: Home },
    { href: '/leagues', label: 'LEAGUES', icon: Trophy },
    { href: '/quran', label: 'QURAN', icon: BookOpen },
    { href: '/learn', label: 'LEARN', icon: Sparkles },
    { href: '/me', label: 'ME', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white z-50 max-w-md mx-auto">
      <div className="flex items-center justify-around py-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-forest text-white scale-105'
                  : 'text-gray-500 hover:text-forest'
              }`}
            >
              <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] font-bold tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
