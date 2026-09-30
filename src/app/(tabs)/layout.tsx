'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useAuth } from '@/features/auth/useAuth';
export default function TabsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  if (loading) return <main className="flex min-h-screen items-center justify-center"><p role="status">Loading Eggsplore…</p></main>;
  if (!user) return null;
  return <div className="min-h-screen bg-surface-background"><main className="mx-auto min-h-screen w-full max-w-[390px] pb-24">{children}</main><BottomNav /></div>;
}
