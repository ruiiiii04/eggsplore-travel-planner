import { Card } from '@/components/ui';

export default function HomePage() {
  return (
    <div className="px-5 py-6">
      <header className="mb-6">
        <p className="text-sm text-text-secondary">
          Welcome to
        </p>

        <h1 className="text-2xl font-extrabold text-text-primary">
          Eggsplore
        </h1>
      </header>

      <Card>
        <h2 className="text-lg font-bold text-text-primary">
          Plan your next adventure
        </h2>

        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Create a trip and start planning together
          with your travel buddies.
        </p>
      </Card>
    </div>
  );
}