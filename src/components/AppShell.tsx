'use client';

import { usePathname } from 'next/navigation';
import BottomNav from './BottomNav';

const NO_SHELL_ROUTES = ['/login', '/signup', '/onboarding'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showShell = !NO_SHELL_ROUTES.includes(pathname);

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <div className="max-w-md mx-auto w-full flex-1 flex flex-col bg-cream-light min-h-screen relative shadow-lg">
      {children}
      <div className="h-16" />
      <BottomNav />
    </div>
  );
}
