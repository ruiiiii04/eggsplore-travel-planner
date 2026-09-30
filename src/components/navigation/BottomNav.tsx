'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Home,
  Map,
  User,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const tabs = [
  {
    label: 'Home',
    href: '/home',
    icon: Home,
  },
  {
    label: 'Trip',
    href: '/trips',
    icon: Compass,
  },
  {
    label: 'Map',
    href: '/map',
    icon: Map,
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: User,
  },
] as const;

export const BottomNav = () => {
  const pathname = usePathname();
  if (pathname === '/profile/new') {
  return null;
}

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-1/2 z-40',
        'w-full max-w-[390px] -translate-x-1/2',
        'border-t border-surface-border',
        'bg-surface-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2',
        'backdrop-blur-md'
      )}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          const isActive =
            pathname === tab.href ||
            pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex min-w-16 flex-col items-center gap-1',
                'rounded-lg px-3 py-1.5',
                'text-[11px] font-semibold',
                'transition-colors duration-200',
                isActive
                  ? 'text-primary-600'
                  : 'text-text-muted hover:text-text-secondary'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={isActive ? 2.5 : 2}
              />

              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};