'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageCircle, BookOpen, Sparkles, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',       icon: Home,          label: 'Home' },
  { href: '/chat',   icon: MessageCircle, label: 'Chat' },
  { href: '/quran',  icon: BookOpen,      label: 'Quran' },
  { href: '/learn',  icon: Sparkles,      label: 'Learn' },
  { href: '/me',     icon: User,          label: 'Me' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
      style={{
        background: 'rgba(15, 22, 5, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(200, 168, 75, 0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex items-center justify-center"
              style={{ minWidth: 0 }}
            >
              {isActive ? (
                /* Active: dark green pill with icon + label */
                <div
                  className="flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-2xl transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #2d3a10 0%, #3d4e18 100%)',
                    minWidth: 72,
                    boxShadow: '0 2px 12px rgba(45,58,16,0.55)',
                  }}
                >
                  <Icon size={18} color="#ffffff" strokeWidth={2.2} />
                  <span
                    className="text-white font-bold uppercase tracking-widest leading-none"
                    style={{ fontSize: 9 }}
                  >
                    {label}
                  </span>
                </div>
              ) : (
                /* Inactive: just icon + small label */
                <div className="flex flex-col items-center justify-center gap-1 py-1.5 px-3">
                  <Icon size={20} color="rgba(255,255,255,0.45)" strokeWidth={1.8} />
                  <span
                    className="font-medium uppercase tracking-wider leading-none"
                    style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}
                  >
                    {label}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
