'use client';
import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, supabase, supabaseConfigurationError } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(supabaseConfigurationError);
  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let mounted = true;
    let changed = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, newSession) => {
      changed = true;
      if (mounted) { setSession(newSession); setLoading(false); setError(null); }
    });
    void client.auth.getSession().then(({ data, error: authError }) => {
      if (mounted && !changed) {
        setSession(data.session);
        setError(authError?.message ?? null);
      }
    }).catch((cause: unknown) => {
      if (mounted) setError(cause instanceof Error ? cause.message : 'Unable to load your session.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  const signOut = async () => {
    const { error: authError } = await getSupabase().auth.signOut();
    if (authError) throw authError;
    setSession(null);
  };
  return <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, error, signOut }}>{children}</AuthContext.Provider>;
}
