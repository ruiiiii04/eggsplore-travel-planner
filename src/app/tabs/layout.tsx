import type { ReactNode } from 'react';

import { BottomNav } from '@/components/navigation/BottomNav';

interface TabsLayoutProps {
  children: ReactNode;
}

export default function TabsLayout({
  children,
}: TabsLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-background">
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-surface-background pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}