'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isSignup = mode === 'signup';

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/home');
    }
  }, [authLoading, user, router]);

  function switchMode() {
    setMode((current) => (
      current === 'login' ? 'signup' : 'login'
    ));

    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setError('');
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (isSignup && password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      if (!supabase) {
        throw new Error(
          'Please configure Supabase in .env.local and restart the server.'
        );
      }

      if (isSignup) {
        const { data, error: signupError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/home`,
            },
          });

        if (signupError) {
          throw signupError;
        }

        setPassword('');
        setConfirmPassword('');

        if (data.session) {
          router.replace('/home');
        } else {
          setMode('login');
          setMessage(
            'Check your email for a confirmation link. ' +
            'If you already have an account, log in.'
          );
        }
      } else {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (loginError) {
          throw loginError;
        }

        setPassword('');
        router.replace('/home');
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to continue. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClassName =
    'w-full rounded-2xl border border-surface-border ' +
    'bg-white/80 px-4 py-3 text-sm text-text-primary ' +
    'outline-none placeholder:text-text-muted ' +
    'focus:border-primary-500 focus:ring-2 focus:ring-primary-100 ' +
    'disabled:opacity-60';

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-surface-pink px-[15px] py-3">
      <section
        aria-label={isSignup ? 'Create an account' : 'Log in'}
        className="relative isolate min-h-[718px] w-full max-w-[330px] overflow-hidden rounded-[40px] bg-gradient-to-b from-white to-surface-lavender shadow-card"
      >
        {/* Decorative status bar */}
        <div
          aria-hidden="true"
          className="absolute left-7 right-7 top-5 flex items-center justify-between text-[13px] font-bold text-primary-900"
        >
          <span>9:41</span>

          <div className="flex items-center gap-1">
            <svg width="16" height="12" viewBox="0 0 16 12">
              <rect x="0" y="8" width="2.5" height="4" rx=".6" fill="currentColor" />
              <rect x="4" y="5.5" width="2.5" height="6.5" rx=".6" fill="currentColor" />
              <rect x="8" y="3" width="2.5" height="9" rx=".6" fill="currentColor" />
              <rect x="12" y="0" width="2.5" height="12" rx=".6" fill="currentColor" />
            </svg>

            <svg
              width="15"
              height="12"
              viewBox="0 0 20 16"
              fill="none"
            >
              <path
                d="M2 5C6.5 1 13.5 1 18 5M5 8.5C8 6 12 6 15 8.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="10" cy="12" r="1.5" fill="currentColor" />
            </svg>

            <svg
              width="21"
              height="12"
              viewBox="0 0 25 14"
              fill="none"
            >
              <rect
                x=".75"
                y="1.25"
                width="21"
                height="11.5"
                rx="3"
                stroke="currentColor"
                strokeWidth=".9"
                opacity=".65"
              />
              <rect
                x="2.3"
                y="2.8"
                width="17.9"
                height="8.4"
                rx="1.6"
                fill="currentColor"
              />
              <path
                d="M23 4.5V9.5C24.1 9.1 24.7 8.3 24.7 7C24.7 5.7 24.1 4.9 23 4.5Z"
                fill="currentColor"
                opacity=".65"
              />
            </svg>
          </div>
        </div>

        <div className="relative z-10 px-[18px] pb-28 pt-[76px]">
          <img
            src="/eggsplore-logo.png"
            alt="Eggsplore Travel Planner App"
            width={146}
            height={146}
            className="mx-auto h-[146px] w-[146px] object-contain"
          />

          <h1 className="mt-7 text-center text-[23px] font-extrabold leading-tight tracking-tight text-text-primary">
            {isSignup
              ? 'Start your next adventure'
              : 'Let’s plan your next trip'}
          </h1>

          <p className="mt-3 text-center text-xs leading-5 text-text-secondary">
            {isSignup
              ? 'Create your Eggsplore account'
              : 'Log in with your email and password'}
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
            aria-busy={busy}
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-semibold text-text-primary"
              >
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={busy}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-semibold text-text-primary"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    isSignup ? 'new-password' : 'current-password'
                  }
                  placeholder={
                    isSignup ? 'At least 8 characters' : 'Your password'
                  }
                  minLength={isSignup ? 8 : undefined}
                  required
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClassName} pr-12`}
                />

                <Button
                  variant="ghost"
                  fullWidth={false}
                  disabled={busy}
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1 h-9 min-h-9 w-9 p-0"
                >
                  {showPassword
                    ? <EyeOff size={17} />
                    : <Eye size={17} />}
                </Button>
              </div>
            </div>

            {isSignup && (
              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-xs font-semibold text-text-primary"
                >
                  Confirm password
                </label>

                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  minLength={8}
                  required
                  disabled={busy}
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  className={inputClassName}
                />
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="text-center text-xs leading-5 text-status-error"
              >
                {error}
              </p>
            )}

            {message && (
              <p
                role="status"
                className="text-center text-xs leading-5 text-status-live"
              >
                {message}
              </p>
            )}

            <Button
              type="submit"
              loading={busy}
              disabled={authLoading}
              className="min-h-[45px] text-[13px]"
            >
              {isSignup ? 'Create account' : 'Log in'}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-xs text-text-secondary">
              {isSignup
                ? 'Already have an account?'
                : 'Don’t have an account?'}
            </p>

            <Button
              variant="ghost"
              fullWidth={false}
              disabled={busy}
              onClick={switchMode}
              className="mt-1 min-h-9 px-3 py-1 text-xs text-primary-600"
            >
              {isSignup ? 'Log in' : 'Create account'}
            </Button>
          </div>
        </div>

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-[100px] w-full"
          viewBox="0 0 330 110"
          preserveAspectRatio="none"
        >
          <path
            d="M0 34C65-5 115 15 176 54C224 85 274 94 330 90V110H0Z"
            fill="#F2ECFC"
          />
          <path
            d="M0 66C73 80 112 96 177 70C238 43 274 46 330 51V110H0Z"
            fill="#EDE5F8"
          />
          <path
            d="M0 85C79 89 123 96 177 109C232 121 291 108 330 97V110H0Z"
            fill="#E5DCF3"
          />
        </svg>
      </section>
    </main>
  );
}