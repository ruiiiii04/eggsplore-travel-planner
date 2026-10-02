import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import {
  getSupabase,
  supabase,
  supabaseConfigurationError,
} from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";

type Auth = {
  session: Session | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(supabaseConfigurationError);
  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;
    let changed = false;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      changed = true;
      if (active) {
        setSession(next);
        setLoading(false);
        setError(null);
      }
    });
    void client.auth
      .getSession()
      .then(({ data, error: failure }) => {
        if (active && !changed) {
          setSession(data.session);
          setError(failure?.message ?? null);
        }
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const refresh = (state: string) => {
      if (state === "active") client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const listener = AppState.addEventListener("change", refresh);
    return () => {
      active = false;
      subscription.unsubscribe();
      listener.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);
  async function signOut() {
    const { error: failure } = await getSupabase().auth.signOut({
      scope: "local",
    });
    if (failure) throw failure;
    setSession(null);
  }
  return (
    <AuthContext.Provider value={{ session, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider.");
  return { ...value, user: value.session?.user ?? null };
}
