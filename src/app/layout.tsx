import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

import { AuthProvider } from '@/features/auth/AuthProvider';

export const metadata: Metadata = {
  title: 'Eggsplore',
  description: 'AI-powered group travel planning',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}