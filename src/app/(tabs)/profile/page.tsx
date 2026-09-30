'use client';

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  Compass,
  Globe,
  LockKeyhole,
  LogOut,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Ruler,
  Settings,
  ShieldPlus,
  Star,
  UserRound,
} from 'lucide-react';

import { Button, Card, BottomSheet } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/useAuth';

interface TravelPreference {
  id: string;
  name: string;
  tags: string[];
  emoji: string;
}

interface Preferences {
  profiles?: TravelPreference[];
  settings?: {
    notifications?: boolean;
    units?: 'metric' | 'imperial';
  };
  [key: string]: unknown;
}

interface EmergencyInfo {
  name?: string;
  phone?: string;
  relationship?: string;
  destinationNotes?: string;
  [key: string]: unknown;
}

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferences: Preferences;
  emergency_contact: EmergencyInfo;
}

type Sheet =
  | 'edit'
  | 'password'
  | 'preference'
  | 'contacts'
  | 'destination'
  | 'settings'
  | 'notifications'
  | null;

const defaultPreferences: TravelPreference[] = [
  {
    id: 'beach',
    name: 'Beach Trip',
    tags: ['Relax', 'Food', 'Beach'],
    emoji: '🏝️',
  },
  {
    id: 'backpacking',
    name: 'Backpacking Mode',
    tags: ['Adventure', 'Nature', 'Budget'],
    emoji: '🏔️',
  },
  {
    id: 'city',
    name: 'City Explorer',
    tags: ['Culture', 'Food', 'Sightseeing'],
    emoji: '🏙️',
  },
];

const inputClass =
  'w-full rounded-xl border border-surface-border ' +
  'bg-surface-background px-3 py-3 text-sm text-text-primary ' +
  'outline-none focus:border-primary-500 focus:ring-2 ' +
  'focus:ring-primary-100 disabled:opacity-60';

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-text-primary">
        {label}
      </span>
      {children}
    </label>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      className="min-h-[52px] justify-start gap-3 rounded-none px-3 py-2 text-left"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-lavenderDark text-primary-700">
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-primary-800">
          {title}
        </span>

        <span className="mt-0.5 block text-[10px] font-normal leading-4 text-text-muted">
          {subtitle}
        </span>
      </span>

      <ChevronRight
        size={17}
        className="shrink-0 text-primary-700"
        aria-hidden="true"
      />
    </Button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [editingPreferenceId, setEditingPreferenceId] =
    useState<string | null>(null);

  const [preferenceName, setPreferenceName] = useState('');
  const [preferenceTags, setPreferenceTags] = useState('');
  const [preferenceEmoji, setPreferenceEmoji] = useState('🏝️');

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [destinationNotes, setDestinationNotes] = useState('');

  const [notifications, setNotifications] = useState(true);
  const [units, setUnits] =
    useState<'metric' | 'imperial'>('metric');

  useEffect(() => {
    const client = supabase;

    if (!user || !client) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadProfile() {
      setLoading(true);

      try {
        const { data, error: loadError } = await client!
          .from('profiles')
          .select(
            'id, display_name, avatar_url, preferences, emergency_contact'
          )
          .eq('id', user!.id)
          .single();

        if (loadError) {
          throw loadError;
        }

        if (active) {
          setProfile({
            ...data,
            preferences: data.preferences ?? {},
            emergency_contact: data.emergency_contact ?? {},
          } as Profile);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to load your profile. Check the profiles table and policies.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const travelProfiles =
    profile?.preferences.profiles ?? defaultPreferences;

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Traveller';

  function openSheet(next: Sheet) {
    setError('');
    setNotice('');

    if (next === 'edit') {
      setName(profile?.display_name ?? displayName);
      setAvatar(profile?.avatar_url ?? '');
    }

    if (next === 'password') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }

    if (next === 'contacts') {
      setContactName(profile?.emergency_contact.name ?? '');
      setContactPhone(profile?.emergency_contact.phone ?? '');
      setRelationship(
        profile?.emergency_contact.relationship ?? ''
      );
    }

    if (next === 'destination') {
      setDestinationNotes(
        profile?.emergency_contact.destinationNotes ?? ''
      );
    }

    if (next === 'settings') {
      setNotifications(
        profile?.preferences.settings?.notifications ?? true
      );
      setUnits(
        profile?.preferences.settings?.units ?? 'metric'
      );
    }

    setSheet(next);
  }

  function closeSheet() {
    if (busy) return;

    setSheet(null);
    setError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  function editPreference(item?: TravelPreference) {
    setEditingPreferenceId(item?.id ?? null);
    setPreferenceName(item?.name ?? '');
    setPreferenceTags(item?.tags.join(', ') ?? '');
    setPreferenceEmoji(item?.emoji ?? '🏝️');
    openSheet('preference');
  }

  async function updateProfile(
    changes: Partial<
      Pick<
        Profile,
        | 'display_name'
        | 'avatar_url'
        | 'preferences'
        | 'emergency_contact'
      >
    >
  ) {
    if (!supabase || !user || !profile) {
      throw new Error('Your profile is not ready. Refresh and retry.');
    }

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(changes)
      .eq('id', user.id)
      .select(
        'id, display_name, avatar_url, preferences, emergency_contact'
      )
      .single();

    if (updateError) throw updateError;

    setProfile({
      ...data,
      preferences: data.preferences ?? {},
      emergency_contact: data.emergency_contact ?? {},
    } as Profile);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (sheet === 'password' && newPassword !== confirmPassword) {
      setError('Your new passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      if (sheet === 'edit') {
        const avatarUrl = avatar.trim();

        if (avatarUrl && !/^https:\/\//i.test(avatarUrl)) {
          throw new Error('Use an HTTPS image URL for your avatar.');
        }

        await updateProfile({
          display_name: name.trim(),
          avatar_url: avatarUrl || null,
        });
      }

      if (sheet === 'password') {
        if (!supabase) throw new Error('Supabase is not configured.');

        const { error: passwordError } =
          await supabase.auth.updateUser({
            password: newPassword,
            current_password: currentPassword,
          });

        if (passwordError) throw passwordError;

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      if (sheet === 'preference') {
        const item: TravelPreference = {
          ...travelProfiles.find(
            (existing) => existing.id === editingPreferenceId
          ),
          id: editingPreferenceId ?? crypto.randomUUID(),
          name: preferenceName.trim(),
          tags: preferenceTags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 3),
          emoji: preferenceEmoji,
        };

        if (!item.name) {
          throw new Error('Enter a preference profile name.');
        }

        const nextProfiles = editingPreferenceId
          ? travelProfiles.map((existing) =>
              existing.id === editingPreferenceId ? item : existing
            )
          : [...travelProfiles, item];

        await updateProfile({
          preferences: {
            ...profile!.preferences,
            profiles: nextProfiles,
          },
        });
      }

      if (sheet === 'contacts') {
        await updateProfile({
          emergency_contact: {
            ...profile!.emergency_contact,
            name: contactName.trim(),
            phone: contactPhone.trim(),
            relationship: relationship.trim(),
          },
        });
      }

      if (sheet === 'destination') {
        await updateProfile({
          emergency_contact: {
            ...profile!.emergency_contact,
            destinationNotes: destinationNotes.trim(),
          },
        });
      }

      if (sheet === 'settings') {
        await updateProfile({
          preferences: {
            ...profile!.preferences,
            settings: {
              ...profile!.preferences.settings,
              notifications,
              units,
            },
          },
        });
      }

      setSheet(null);
      setNotice('Saved successfully.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to save. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function deletePreference() {
    if (!editingPreferenceId) return;

    setBusy(true);
    setError('');

    try {
      await updateProfile({
        preferences: {
          ...profile!.preferences,
          profiles: travelProfiles.filter(
            (item) => item.id !== editingPreferenceId
          ),
        },
      });

      setSheet(null);
      setNotice('Preference profile deleted.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to delete this profile.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError('');

    try {
      await signOut();
      router.replace('/login');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to sign out.'
      );
    } finally {
      setBusy(false);
    }
  }

  const sheetTitles: Record<Exclude<Sheet, null>, string> = {
    edit: 'Edit Profile',
    password: 'Change Password',
    preference: editingPreferenceId
      ? 'Edit Preference Profile'
      : 'Create Preference Profile',
    contacts: 'Emergency Contact',
    destination: 'Destination Information',
    settings: 'App Settings',
    notifications: 'Notifications',
  };

  const unavailable = loading || busy || !profile;

  return (
    <div className="min-h-screen bg-surface-background px-3 pb-4">
      {/* Decorative status bar */}
      <div
        aria-hidden="true"
        className="flex items-center justify-between px-5 pb-2 pt-5 text-sm font-bold text-primary-900"
      >
        <span>9:41</span>

        <svg width="73" height="15" viewBox="0 0 73 15" fill="none">
          <g fill="currentColor">
            <rect x="0" y="9" width="3" height="5" rx=".6" />
            <rect x="5" y="6" width="3" height="8" rx=".6" />
            <rect x="10" y="3" width="3" height="11" rx=".6" />
            <rect x="15" width="3" height="14" rx=".6" />
          </g>
          <path
            d="M26 5C30 1 36 1 40 5M29 8C31.5 6 34.5 6 37 8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="33" cy="11" r="1.4" fill="currentColor" />
          <rect
            x="49" y="2" width="20" height="11" rx="3"
            stroke="currentColor" strokeWidth=".8" opacity=".65"
          />
          <rect
            x="51" y="4" width="16" height="7" rx="1.5"
            fill="currentColor"
          />
          <path
            d="M70.5 5V10C72 9.5 72 5.5 70.5 5Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <header className="flex items-center justify-between px-3">
        <h1 className="text-[27px] font-black tracking-tight text-primary-700">
          EGGSPLORE
        </h1>

        <Button
          variant="secondary"
          fullWidth={false}
          aria-label="Notifications"
          onClick={() => openSheet('notifications')}
          className="h-9 min-h-9 w-9 p-0"
        >
          <Bell size={19} />
        </Button>
      </header>

      {/* User identity */}
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="relative shrink-0">
          <div className="relative flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-[#E9E7E1]">
            <UserRound
              size={56}
              className="mt-3 text-[#C5C3BD]"
              strokeWidth={1.5}
              aria-hidden="true"
            />

            {profile?.avatar_url && (
              <img
                key={profile.avatar_url}
                src={profile.avatar_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            )}
          </div>

          <Button
            fullWidth={false}
            disabled={unavailable}
            aria-label="Edit avatar"
            onClick={() => openSheet('edit')}
            className="absolute -bottom-1 right-0 h-6 min-h-6 w-6 border-2 border-white p-0"
          >
            <Pencil size={12} />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-primary-800">
            {displayName}
          </p>

          <p className="mt-1 truncate text-xs text-text-muted">
            {user?.email}
          </p>

          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-lavenderDark px-3 py-1 text-[10px] font-semibold text-primary-500">
            <Compass size={12} />
            Explorer
          </span>
        </div>

        <Button
          variant="ghost"
          fullWidth={false}
          disabled={unavailable}
          aria-label="Edit your profile"
          onClick={() => openSheet('edit')}
          className="h-8 min-h-8 w-8 p-0"
        >
          <ChevronRight size={18} />
        </Button>
      </div>

      {loading && (
        <p role="status" className="mb-3 text-center text-xs text-text-secondary">
          Loading profile…
        </p>
      )}

      {error && !sheet && (
        <p role="alert" className="mb-3 text-center text-xs text-status-error">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="mb-3 text-center text-xs text-status-live">
          {notice}
        </p>
      )}

      {/* Account */}
      <Card className="overflow-hidden rounded-xl border-primary-100 p-0 shadow-none">
        <div className="flex items-center gap-3 bg-surface-lavender px-4 py-2 text-primary-800">
          <UserRound size={19} />
          <h2 className="text-xs font-bold">Account</h2>
        </div>

        <div className="divide-y divide-primary-50 bg-white/70">
          <MenuRow
            icon={<UserRound size={17} />}
            title="Edit Profile"
            subtitle="Name, avatar, personal info"
            disabled={unavailable}
            onClick={() => openSheet('edit')}
          />
          <MenuRow
            icon={<LockKeyhole size={17} />}
            title="Change Password"
            subtitle="Keep your account secure"
            disabled={loading || busy}
            onClick={() => openSheet('password')}
          />
          <MenuRow
            icon={<LogOut size={17} />}
            title="Log Out"
            subtitle="Sign out from this device"
            disabled={busy}
            onClick={() => void logout()}
          />
        </div>
      </Card>

      {/* Travel preferences */}
      <Card className="mt-2 rounded-2xl border-primary-100 p-3 shadow-none">
        <div className="flex items-start gap-2 text-primary-700">
          <Star size={28} fill="currentColor" className="shrink-0" />

          <div>
            <h2 className="text-base font-bold">
              My Preference Profiles
            </h2>
            <p className="mt-1 text-[11px] text-text-muted">
              Save your travel styles for faster planning
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {travelProfiles.map((item) => (
            <Card
              key={item.id}
              className="relative rounded-lg border-primary-100 p-2 shadow-none"
            >
              <Button
                variant="ghost"
                fullWidth={false}
                disabled={unavailable}
                aria-label={`Edit ${item.name}`}
                onClick={() => editPreference(item)}
                className="absolute right-0 top-0 h-6 min-h-6 w-6 p-0"
              >
                <MoreVertical size={15} />
              </Button>

              <div
                aria-hidden="true"
                className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-[30px]"
              >
                {item.emoji}
              </div>

              <p className="mt-2 text-[10px] font-semibold leading-4 text-primary-800">
                {item.name}
              </p>

              <p className="mt-1 text-[8px] leading-3 text-text-muted">
                {item.tags.join(' · ')}
              </p>
            </Card>
          ))}
        </div>

        <Button
          variant="secondary"
          disabled={unavailable}
          onClick={() => router.push('/profile/new')}
          className="mt-3 min-h-8 gap-1 py-2 text-[10px] text-primary-600"
        >
          <Plus size={15} />
          Create New Profile
        </Button>
      </Card>

      {/* Emergency and destination */}
      <Card className="mt-2 overflow-hidden rounded-xl border-primary-100 p-0 shadow-none">
        <div className="flex items-center gap-2 bg-surface-lavender px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-700 text-white">
            <ShieldPlus size={16} />
          </span>
          <div>
            <h2 className="text-xs font-bold text-primary-800">
              Emergency &amp; Destination Info
            </h2>
            <p className="mt-0.5 text-[9px] text-text-muted">
              Keep important contacts and numbers handy
            </p>
          </div>
        </div>

        <div className="divide-y divide-primary-50 bg-white/70">
          <MenuRow
            icon={<Phone size={17} />}
            title="Emergency Contacts"
            subtitle="Family, friends, emergency hotline"
            disabled={unavailable}
            onClick={() => openSheet('contacts')}
          />
          <MenuRow
            icon={<Globe size={17} />}
            title="Destination Information"
            subtitle="Embassy, local emergency numbers, health info"
            disabled={unavailable}
            onClick={() => openSheet('destination')}
          />
        </div>
      </Card>

      {/* Settings */}
      <Card className="mt-2 overflow-hidden rounded-xl border-primary-100 p-0 shadow-none">
        <div className="flex items-center gap-2 bg-surface-lavender px-3 py-2">
          <Settings size={26} className="text-primary-700" />
          <div>
            <h2 className="text-xs font-bold text-primary-800">
              App Settings
            </h2>
            <p className="mt-0.5 text-[9px] text-text-muted">
              Personalize your Eggsplore experience
            </p>
          </div>
        </div>

        <div className="divide-y divide-primary-50 bg-white/70">
          <MenuRow
            icon={<Bell size={17} />}
            title="Notifications"
            subtitle="Trip updates, reminders, alerts"
            disabled={unavailable}
            onClick={() => openSheet('settings')}
          />
          <MenuRow
            icon={<Ruler size={17} />}
            title="Units"
            subtitle="Metric / Imperial"
            disabled={unavailable}
            onClick={() => openSheet('settings')}
          />
        </div>
      </Card>

      {/* Editing sheets */}
      <BottomSheet
        isOpen={sheet !== null}
        onClose={closeSheet}
        title={sheet ? sheetTitles[sheet] : undefined}
      >
        {sheet === 'notifications' ? (
          <p className="text-sm text-text-secondary">
            You have no notifications yet.
          </p>
        ) : (
          <form onSubmit={save} className="space-y-4">
            {sheet === 'edit' && (
              <>
                <Field label="Display name">
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={80}
                    disabled={busy}
                  />
                </Field>

                <Field label="Avatar image URL — optional">
                  <input
                    type="url"
                    className={inputClass}
                    placeholder="https://example.com/avatar.jpg"
                    value={avatar}
                    onChange={(event) => setAvatar(event.target.value)}
                    disabled={busy}
                  />
                </Field>

                <p className="text-xs text-text-secondary">
                  Email: {user?.email}
                </p>
              </>
            )}

            {sheet === 'password' && (
              <>
                <Field label="Current password">
                  <input
                    type="password"
                    autoComplete="current-password"
                    className={inputClass}
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(event.target.value)
                    }
                    required
                    disabled={busy}
                  />
                </Field>

                <Field label="New password">
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={inputClass}
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.target.value)
                    }
                    minLength={8}
                    required
                    disabled={busy}
                  />
                </Field>

                <Field label="Confirm new password">
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={inputClass}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    minLength={8}
                    required
                    disabled={busy}
                  />
                </Field>
              </>
            )}

            {sheet === 'preference' && (
              <>
                <Field label="Profile name">
                  <input
                    className={inputClass}
                    value={preferenceName}
                    onChange={(event) =>
                      setPreferenceName(event.target.value)
                    }
                    required
                    maxLength={40}
                    disabled={busy}
                  />
                </Field>

                <Field label="Travel style">
                  <select
                    className={inputClass}
                    value={preferenceEmoji}
                    onChange={(event) =>
                      setPreferenceEmoji(event.target.value)
                    }
                    disabled={busy}
                  >
                    <option value="🏝️">🏝️ Beach</option>
                    <option value="🏔️">🏔️ Adventure</option>
                    <option value="🏙️">🏙️ City</option>
                    <option value="🍜">🍜 Food</option>
                    <option value="🌿">🌿 Nature</option>
                  </select>
                </Field>

                <Field label="Up to 3 tags, separated by commas">
                  <input
                    className={inputClass}
                    placeholder="Relax, Food, Beach"
                    value={preferenceTags}
                    onChange={(event) =>
                      setPreferenceTags(event.target.value)
                    }
                    disabled={busy}
                  />
                </Field>
              </>
            )}

            {sheet === 'contacts' && (
              <>
                <Field label="Contact name">
                  <input
                    className={inputClass}
                    value={contactName}
                    onChange={(event) =>
                      setContactName(event.target.value)
                    }
                    required
                    disabled={busy}
                  />
                </Field>

                <Field label="Phone number">
                  <input
                    type="tel"
                    className={inputClass}
                    placeholder="+60..."
                    value={contactPhone}
                    onChange={(event) =>
                      setContactPhone(event.target.value)
                    }
                    required
                    disabled={busy}
                  />
                </Field>

                <Field label="Relationship">
                  <input
                    className={inputClass}
                    placeholder="Family, friend..."
                    value={relationship}
                    onChange={(event) =>
                      setRelationship(event.target.value)
                    }
                    disabled={busy}
                  />
                </Field>
              </>
            )}

            {sheet === 'destination' && (
              <Field label="Your destination notes">
                <textarea
                  className={inputClass}
                  rows={6}
                  placeholder="Save verified embassy details, local emergency numbers and other useful notes."
                  value={destinationNotes}
                  onChange={(event) =>
                    setDestinationNotes(event.target.value)
                  }
                  disabled={busy}
                />
              </Field>
            )}

            {sheet === 'settings' && (
              <>
                <label className="flex items-center justify-between gap-4 text-sm">
                  Receive trip notifications
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#7E49C2]"
                    checked={notifications}
                    onChange={(event) =>
                      setNotifications(event.target.checked)
                    }
                    disabled={busy}
                  />
                </label>

                <Field label="Units">
                  <select
                    className={inputClass}
                    value={units}
                    onChange={(event) =>
                      setUnits(
                        event.target.value as 'metric' | 'imperial'
                      )
                    }
                    disabled={busy}
                  >
                    <option value="metric">Metric — km, °C</option>
                    <option value="imperial">Imperial — miles, °F</option>
                  </select>
                </Field>
              </>
            )}

            {error && (
              <p role="alert" className="text-xs text-status-error">
                {error}
              </p>
            )}

            <Button type="submit" loading={busy}>
              Save changes
            </Button>

            {sheet === 'preference' && editingPreferenceId && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void deletePreference()}
                className="text-status-error"
              >
                Delete this preference profile
              </Button>
            )}
          </form>
        )}
      </BottomSheet>
    </div>
  );
}