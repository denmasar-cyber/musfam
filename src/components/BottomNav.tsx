'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, GraduationCap, User, MessageCircle, BarChart2 } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',          label: 'Home',      Icon: Home },
  { href: '/chat',      label: 'Chat',      Icon: MessageCircle },
  { href: '/quran',     label: 'Quran',     Icon: BookOpen },
  { href: '/leagues',   label: 'Leagues',   Icon: BarChart2 },
  { href: '/learn',     label: 'Learn',     Icon: GraduationCap },
  { href: '/me',        label: 'Me',        Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto">
      <div className="backdrop-blur-xl border-t border-white/20 shadow-2xl"
        style={{
          background: 'rgba(18,26,6,0.88)',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.25)',
        }}>
        <div className="flex items-stretch h-[58px] px-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 active:scale-90"
              >
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full"
                    style={{ background: '#c8a84b', boxShadow: '0 0 6px rgba(200,168,75,0.6)' }}
                  />
                )}
                <Icon
                  size={isActive ? 21 : 20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{ color: isActive ? '#c8a84b' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}
                />
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.05em] leading-none"
                  style={{ color: isActive ? '#c8a84b' : 'rgba(255,255,255,0.35)' }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Safe area bottom padding */}
        <div className="h-safe-bottom" style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </nav>
  );
}
