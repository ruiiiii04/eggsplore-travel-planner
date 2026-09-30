'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Bot,
  CalendarDays,
  MapPin,
  Plus,
  Star,
  Users,
} from 'lucide-react';

import { Button, Card, BottomSheet } from '@/components/ui';

type TripStatus = 'Live' | 'Upcoming' | 'Past';

interface PreviewTrip {
  id: string;
  title: string;
  dates: string;
  members: number;
  image: string;
  status: TripStatus;
}

const previewTrips: PreviewTrip[] = [
  {
    id: 'preview-bali',
    title: 'Bali, Indonesia',
    dates: '12 – 18 Aug 2025',
    members: 3,
    image: '/bali.jpg',
    status: 'Live',
  },
  {
    id: 'preview-japan',
    title: 'Japan Adventure',
    dates: '5 – 15 Oct 2025',
    members: 4,
    image: '/japan.jpg',
    status: 'Live',
  },
];

export default function HomePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] =
    useState<TripStatus>('Live');

  const [sheet, setSheet] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const visibleTrips = previewTrips.filter(
    (trip) => trip.status === activeTab
  );

  function openSheet(title: string, description: string) {
    setSheet({ title, description });
  }

  return (
    <div className="min-h-screen bg-surface-background">
      {/* Decorative phone status bar */}
      <div
        aria-hidden="true"
        className="flex items-center justify-between px-8 pb-3 pt-5 text-sm font-bold text-primary-900"
      >
        <span>9:41</span>

        <svg
          width="73"
          height="15"
          viewBox="0 0 73 15"
          fill="none"
        >
          {/* Signal */}
          <g fill="currentColor">
            <rect x="0" y="9" width="3" height="5" rx=".6" />
            <rect x="5" y="6" width="3" height="8" rx=".6" />
            <rect x="10" y="3" width="3" height="11" rx=".6" />
            <rect x="15" y="0" width="3" height="14" rx=".6" />
          </g>

          {/* Wi-Fi */}
          <path
            d="M26 5C30 1 36 1 40 5M29 8C31.5 6 34.5 6 37 8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />

          <circle
            cx="33"
            cy="11"
            r="1.4"
            fill="currentColor"
          />

          {/* Battery */}
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
            opacity=".65"
          />
        </svg>
      </div>

      {/* Brand header */}
      <header className="flex items-center gap-3 px-4 py-3">
        <img
          src="/eggsplore-logo.png"
          alt="Eggsplore"
          width={47}
          height={47}
          className="h-[47px] w-[47px] shrink-0 object-contain"
        />

        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-black leading-none tracking-tight text-text-primary">
            EGGSPLORE
          </h1>

          <p className="mt-1 text-[10px] text-text-secondary">
            Smarter Trips, Happier You
          </p>
        </div>

        <Button
          variant="ghost"
          fullWidth={false}
          aria-label="Notifications"
          onClick={() =>
            openSheet(
              'Notifications',
              'You have no notifications yet.'
            )
          }
          className="h-10 min-h-10 w-10 shrink-0 p-0 text-primary-600"
        >
          <Bell size={23} />
        </Button>
      </header>

      {/* Greeting, background, mascot and real Create Trip button */}
      <section
        aria-label="Plan your next trip"
        className="relative mt-2 min-h-[164px] overflow-hidden"
      >
        <img
          src="/home-background.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        <img
          src="/home-mascot.png"
          alt=""
          aria-hidden="true"
          width={118}
          height={118}
          className="pointer-events-none absolute bottom-0 right-2 z-10 h-[118px] w-[118px] object-contain"
        />

        <div className="relative z-20 px-4 pb-5 pt-3">
          <h2 className="text-[28px] font-extrabold leading-tight text-text-primary">
            Hi there!
          </h2>

          <p className="mt-1 max-w-[230px] text-xs leading-5 text-text-secondary">
            Where would you like to go next?
          </p>

          <Button
            fullWidth={false}
            onClick={() => router.push('/trips/create')}
            className="mt-4 min-h-[42px] gap-2 px-5 text-sm"
          >
            <Plus size={16} aria-hidden="true" />
            Create Trip
          </Button>
        </div>
      </section>

      <div className="px-4">
        {/* Trip filters */}
        <div
          role="group"
          aria-label="Filter trips"
          className="mt-3 flex rounded-full bg-surface-lavenderDark p-1"
        >
          {(['Live', 'Upcoming', 'Past'] as const).map(
            (tab) => (
              <Button
                key={tab}
                variant={
                  activeTab === tab ? 'primary' : 'ghost'
                }
                fullWidth={false}
                aria-pressed={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className="min-h-9 flex-1 px-2 py-2 text-sm"
              >
                {tab}
              </Button>
            )
          )}
        </div>

        <p className="mb-2 mt-2 text-center text-[10px] text-text-secondary">
          Design preview · sample trips and dates
        </p>

        {/* Trip cards */}
        <div className="space-y-4">
          {visibleTrips.map((trip) => (
            <Card
              key={trip.id}
              className="relative overflow-hidden rounded-[20px] border-0 bg-primary-900 p-0"
            >
              <Button
                variant="ghost"
                aria-label={`View ${trip.title}`}
                onClick={() =>
                  openSheet(
                    trip.title,
                    `${trip.dates} · ${trip.members} members. ` +
                      'This is a sample trip for the design preview.'
                  )
                }
                className="relative block h-[138px] w-full overflow-hidden rounded-[20px] p-0 text-left text-white hover:bg-transparent hover:text-white"
              >
                <img
                  src={trip.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />

                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />

                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-status-live">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-live" />
                  Live now
                </span>

                <span className="absolute bottom-4 left-4 right-4">
                  <span className="block text-[18px] font-extrabold leading-tight">
                    {trip.title}
                  </span>

                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-normal">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays
                        size={13}
                        className="text-primary-300"
                        aria-hidden="true"
                      />
                      {trip.dates}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <Users
                        size={13}
                        className="text-primary-300"
                        aria-hidden="true"
                      />
                      {trip.members} members
                    </span>
                  </span>
                </span>
              </Button>
            </Card>
          ))}

          {visibleTrips.length === 0 && (
            <Card className="py-8 text-center">
              <p className="text-sm text-text-secondary">
                No {activeTab.toLowerCase()} trips in this preview.
              </p>
            </Card>
          )}
        </div>

        {/* Quick access */}
        <h2 className="mb-3 mt-4 text-base font-extrabold text-text-primary">
          Quick access
        </h2>

        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/map')}
            className="min-h-[98px] flex-col gap-2 rounded-2xl bg-white px-1 py-3 text-[11px] font-normal leading-tight"
          >
            <MapPin size={26} aria-hidden="true" />
            <span>
              Explore
              <br />
              Map
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push('/trips')}
            className="min-h-[98px] flex-col gap-2 rounded-2xl bg-white px-1 py-3 text-[11px] font-normal leading-tight"
          >
            <CalendarDays size={26} aria-hidden="true" />
            <span>
              My
              <br />
              Itinerary
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              openSheet(
                'Consult AI',
                'AI travel assistance is not available in this preview yet.'
              )
            }
            className="min-h-[98px] flex-col gap-2 rounded-2xl bg-white px-1 py-3 text-[11px] font-normal leading-tight"
          >
            <Bot size={26} aria-hidden="true" />
            <span>
              Consult
              <br />
              AI
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push('/profile')}
            className="min-h-[98px] flex-col gap-2 rounded-2xl bg-white px-1 py-3 text-[11px] font-normal leading-tight"
          >
            <Star size={26} aria-hidden="true" />
            <span>
              Trip
              <br />
              Preference
            </span>
          </Button>
        </div>
      </div>

      <BottomSheet
        isOpen={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet?.title}
      >
        <p className="text-sm leading-6 text-text-secondary">
          {sheet?.description}
        </p>
      </BottomSheet>
    </div>
  );
}