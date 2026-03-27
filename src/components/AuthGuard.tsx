'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import RiverLoading from '@/components/RiverLoading';

const PUBLIC_ROUTES = ['/login', '/signup'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isOnboarding = pathname === '/onboarding';

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublicRoute) {
      router.replace('/login');
    } else if (user && !profile && !isOnboarding && !isPublicRoute) {
      router.replace('/onboarding');
    } else if (user && profile && isPublicRoute) {
      router.replace('/');
    } else if (user && profile && isOnboarding) {
      router.replace('/');
    }
  }, [user, profile, loading, pathname, isPublicRoute, isOnboarding, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-light">
        <RiverLoading size="md" />
      </div>
    );
  }

  // Public route: render without nav
  if (isPublicRoute || isOnboarding) {
    if (!user && !isPublicRoute && !isOnboarding) return null;
    return <>{children}</>;
  }

  // Protected route: wait for auth
  if (!user || !profile) return null;

  return <>{children}</>;
}
