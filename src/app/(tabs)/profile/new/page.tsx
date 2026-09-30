'use client';

import {
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Gauge,
  GripVertical,
  Heart,
  History,
  Users,
  Wallet,
} from 'lucide-react';

import { Button, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/useAuth';

const categories = [
  {
    id: 'beach',
    name: 'Beach Trip',
    emoji: '🏝️',
    tags: ['Relax', 'Food', 'Beach'],
  },
  {
    id: 'backpacking',
    name: 'Backpacking Mode',
    emoji: '🏔️',
    tags: ['Adventure', 'Nature', 'Budget'],
  },
  {
    id: 'city',
    name: 'City Explorer',
    emoji: '🏙️',
    tags: ['Culture', 'Food', 'Sightseeing'],
  },
  {
    id: 'road',
    name: 'Road Trip',
    emoji: '🚐',
    tags: ['Adventure', 'Scenery', 'Transport'],
  },
] as const;

const companions = [
  { id: 'solo', name: 'Solo', emoji: '🚶' },
  { id: 'couple', name: 'Couple', emoji: '💑' },
  { id: 'friends', name: 'Friend Group', emoji: '🧑‍🤝‍🧑' },
  { id: 'family', name: 'Family', emoji: '👨‍👩‍👧‍👦' },
] as const;

const interestGroups = [
  {
    title: 'Dining',
    options: [
      'Street food hunting',
      'Specialty coffee & cafes',
      'Local cuisine',
    ],
  },
  {
    title: 'Shopping',
    options: [
      'Beauty & cosmetics',
      'Pop culture & merchandise',
      'Local markets',
    ],
  },
  {
    title: 'Entertainment',
    options: [
      'PC gaming & arcades',
      'Live music',
      'Museums & galleries',
    ],
  },
  {
    title: 'Activity Level',
    options: [
      'Scenic photography',
      'Intense sports',
      'Easy sightseeing',
    ],
  },
];

const spendingIcons: Record<string, string> = {
  Stay: '🏠',
  Food: '🍴',
  Activities: '🎟️',
  Transport: '🚗',
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-xl border-primary-100 p-0 shadow-none">
      <div className="flex items-center gap-2 bg-surface-lavender px-3 py-2 text-primary-800">
        {icon}
        <h2 className="text-xs font-bold">{title}</h2>
      </div>

      <div className="p-3">{children}</div>
    </Card>
  );
}

export default function NewPreferenceProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('beach');
  const [pace, setPace] = useState('Moderate');
  const [companion, setCompanion] = useState('solo');

  const [spendingOrder, setSpendingOrder] = useState([
    'Stay',
    'Food',
    'Activities',
    'Transport',
  ]);

  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const draggedItem = useRef<string | null>(null);

  const canSave =
    Boolean(name.trim()) && !busy && !authLoading && Boolean(user);

  function toggleInterest(value: string) {
    setInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function moveSpending(item: string, direction: -1 | 1) {
    setSpendingOrder((current) => {
      const index = current.indexOf(item);
      const target = index + direction;

      if (index < 0 || target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];

      return next;
    });
  }

  function dropSpending(targetItem: string) {
    const sourceItem = draggedItem.current;
    draggedItem.current = null;

    if (!sourceItem || sourceItem === targetItem || busy) return;

    setSpendingOrder((current) => {
      const sourceIndex = current.indexOf(sourceItem);
      const targetIndex = current.indexOf(targetItem);

      if (sourceIndex < 0 || targetIndex < 0) return current;

      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceItem);

      return next;
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setError('');

    if (!name.trim()) {
      setError('Please enter a profile name.');
      return;
    }

    if (!user || !supabase) {
      setError('Please log in before creating a profile.');
      return;
    }

    setBusy(true);

    try {
      // Read the latest preferences before appending the new profile.
      const { data, error: readError } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (readError) throw readError;

      const existing =
        data.preferences &&
        typeof data.preferences === 'object' &&
        !Array.isArray(data.preferences)
          ? data.preferences
          : {};

      const savedProfiles = Array.isArray(existing.profiles)
        ? existing.profiles
        : [];

      const selectedCategory =
        categories.find((item) => item.id === category) ??
        categories[0];

      const newProfile = {
        id: crypto.randomUUID(),
        name: name.trim(),
        emoji: selectedCategory.emoji,
        category: selectedCategory.id,
        tags:
          interests.length > 0
            ? interests.slice(0, 3)
            : [...selectedCategory.tags],
        pace,
        companion,
        spendingOrder,
        interests,
        createdAt: new Date().toISOString(),
      };

      const { error: saveError } = await supabase
        .from('profiles')
        .update({
          preferences: {
            ...existing,
            profiles: [...savedProfiles, newProfile],
          },
        })
        .eq('id', user.id)
        .select('id')
        .single();

      if (saveError) throw saveError;

      router.replace('/profile');
    } catch (cause) {
      const message =
        cause &&
        typeof cause === 'object' &&
        'message' in cause
          ? String(cause.message)
          : 'Unable to save your profile. Please try again.';

      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-background px-4 pb-6">
      {/* Decorative status bar */}
      <div
        aria-hidden="true"
        className="flex items-center justify-between px-3 pb-3 pt-4 text-sm font-bold text-primary-900"
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
            x="49"
            y="2"
            width="20"
            height="11"
            rx="3"
            stroke="currentColor"
            strokeWidth=".8"
            opacity=".65"
          />
          <rect
            x="51"
            y="4"
            width="16"
            height="7"
            rx="1.5"
            fill="currentColor"
          />
          <path
            d="M70.5 5V10C72 9.5 72 5.5 70.5 5Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Page header */}
      <header className="mb-3 grid grid-cols-[64px_1fr_64px] items-center">
        <Button
          variant="ghost"
          fullWidth={false}
          disabled={busy}
          aria-label="Back to Profile"
          onClick={() => router.push('/profile')}
          className="h-9 min-h-9 w-9 p-0"
        >
          <ArrowLeft size={22} />
        </Button>

        <h1 className="text-center text-sm font-bold text-primary-900">
          New Profile
        </h1>

        <Button
          type="submit"
          form="new-preference-profile"
          variant="secondary"
          fullWidth={false}
          disabled={!canSave}
          className="min-h-8 px-3 py-2 text-[10px] text-primary-600"
        >
          Save
        </Button>
      </header>

      <form
        id="new-preference-profile"
        onSubmit={saveProfile}
        aria-busy={busy}
        className="space-y-2"
      >
        {/* Disable editing during save */}
        <fieldset disabled={busy} className="min-w-0 space-y-2">
          <Section title="Basic Info">
            <label
              htmlFor="profile-name"
              className="block text-[10px] font-semibold text-primary-900"
            >
              Profile Name <span className="text-status-error">*</span>
            </label>

            <input
              id="profile-name"
              required
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Beach Lover"
              className="mt-1 w-full rounded-lg border border-primary-100 bg-white/60 px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />

            <p className="mt-3 text-[10px] font-semibold text-primary-900">
              Icon
            </p>
            <p className="mt-0.5 text-[9px] text-text-muted">
              Tap to select a category
            </p>

            <div
              role="group"
              aria-label="Profile category"
              className="mt-2 grid grid-cols-4 gap-2"
            >
              {categories.map((item) => {
                const selected = category === item.id;

                return (
                  <Button
                    key={item.id}
                    variant="outline"
                    aria-pressed={selected}
                    onClick={() => setCategory(item.id)}
                    className={`relative min-h-[76px] flex-col gap-1 rounded-lg bg-white/70 px-1 py-2 text-[9px] font-medium leading-tight ${
                      selected
                        ? 'border-primary-500'
                        : 'border-primary-100'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-[27px]"
                    >
                      {item.emoji}
                    </span>

                    <span>{item.name}</span>

                    <span
                      aria-hidden="true"
                      className={`absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-primary-200'
                      }`}
                    >
                      {selected && <Check size={9} />}
                    </span>
                  </Button>
                );
              })}
            </div>
          </Section>

          <Section title="Travel Pace" icon={<Gauge size={15} />}>
            <div
              role="group"
              aria-label="Travel pace"
              className="flex rounded-full bg-surface-lavenderDark p-0.5"
            >
              {['Relaxed', 'Moderate', 'Intense'].map((item) => (
                <Button
                  key={item}
                  variant={pace === item ? 'primary' : 'ghost'}
                  fullWidth={false}
                  aria-pressed={pace === item}
                  onClick={() => setPace(item)}
                  className="min-h-6 flex-1 px-1 py-1 text-[10px] font-medium"
                >
                  {item}
                </Button>
              ))}
            </div>
          </Section>

          <Section title="Companion Type" icon={<Users size={15} />}>
            <p className="text-[10px] text-text-muted">
              Who are you traveling with?
            </p>

            <div
              role="group"
              aria-label="Companion type"
              className="mt-2 grid grid-cols-4 gap-2"
            >
              {companions.map((item) => {
                const selected = companion === item.id;

                return (
                  <Button
                    key={item.id}
                    variant="outline"
                    aria-pressed={selected}
                    onClick={() => setCompanion(item.id)}
                    className={`relative min-h-[74px] flex-col gap-2 rounded-lg bg-white/70 px-1 py-2 text-[9px] font-medium ${
                      selected
                        ? 'border-primary-500'
                        : 'border-primary-100'
                    }`}
                  >
                    <span aria-hidden="true" className="text-[26px]">
                      {item.emoji}
                    </span>

                    {item.name}

                    <span
                      aria-hidden="true"
                      className={`absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-primary-200'
                      }`}
                    >
                      {selected && <Check size={9} />}
                    </span>
                  </Button>
                );
              })}
            </div>
          </Section>

          <Section title="Spending Priority" icon={<Wallet size={15} />}>
            <p className="mb-2 text-[10px] text-text-muted">
              Drag to rank where you want to splurge most
            </p>

            <ol className="space-y-1">
              {spendingOrder.map((item, index) => (
                <li
                  key={item}
                  draggable={!busy}
                  onDragStart={(event) => {
                    draggedItem.current = item;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', item);
                  }}
                  onDragEnd={() => {
                    draggedItem.current = null;
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropSpending(item);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-primary-100 bg-surface-background px-2 py-1"
                >
                  <span aria-hidden="true" className="text-xs">
                    {spendingIcons[item]}
                  </span>

                  <span className="flex-1 text-[10px] font-medium text-primary-900">
                    {item}
                  </span>

                  <Button
                    variant="ghost"
                    fullWidth={false}
                    disabled={index === 0 || busy}
                    aria-label={`Move ${item} up`}
                    onClick={() => moveSpending(item, -1)}
                    className="h-5 min-h-5 w-5 p-0"
                  >
                    <ArrowUp size={11} />
                  </Button>

                  <Button
                    variant="ghost"
                    fullWidth={false}
                    disabled={index === spendingOrder.length - 1 || busy}
                    aria-label={`Move ${item} down`}
                    onClick={() => moveSpending(item, 1)}
                    className="h-5 min-h-5 w-5 p-0"
                  >
                    <ArrowDown size={11} />
                  </Button>

                  <GripVertical
                    size={12}
                    className="cursor-grab text-primary-300"
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Interests" icon={<Heart size={15} />}>
            <div className="grid grid-cols-4 gap-1">
              {interestGroups.map((group) => (
                <div key={group.title} className="min-w-0">
                  <h3 className="mb-1 rounded-full bg-surface-lavender px-1 py-1 text-center text-[8px] font-medium text-text-secondary">
                    {group.title}
                  </h3>

                  <div className="space-y-1">
                    {group.options.map((item) => {
                      const selected = interests.includes(item);

                      return (
                        <Button
                          key={item}
                          variant="outline"
                          aria-pressed={selected}
                          onClick={() => toggleInterest(item)}
                          className={`min-h-[34px] justify-between gap-1 rounded-lg px-1 py-1 text-left text-[8px] font-normal leading-tight ${
                            selected
                              ? 'border-primary-400 bg-primary-100'
                              : 'border-primary-100 bg-white/70'
                          }`}
                        >
                          <span>{item}</span>

                          <span
                            aria-hidden="true"
                            className={`flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? 'border-primary-500 bg-primary-500 text-white'
                                : 'border-primary-200'
                            }`}
                          >
                            {selected && <Check size={8} />}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </fieldset>

        <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted">
          <History size={12} aria-hidden="true" />
          Generate from your past trip history — coming soon
        </div>

        {error && (
          <p role="alert" className="text-center text-xs text-status-error">
            {error}
          </p>
        )}

        <Button
          type="submit"
          loading={busy}
          disabled={!canSave}
          className="min-h-9 rounded-lg py-2 text-xs"
        >
          Create Profile
        </Button>
      </form>
    </div>
  );
}