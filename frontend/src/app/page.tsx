'use client';

import { useEffect, useState } from 'react';

type HealthResponse = {
  status: string;
  message: string;
  database: string;
  timestamp: string;
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function checkBackend() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/health`,
        );

        if (!response.ok) {
          throw new Error('Backend request failed');
        }

        const data: HealthResponse = await response.json();
        setHealth(data);
      } catch {
        setError('Unable to connect to the backend.');
      }
    }

    checkBackend();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">
        Heizen Engineering Round
      </h1>

      <p>Next.js + NestJS + Prisma + PostgreSQL</p>

      {health && (
        <div className="rounded-xl border p-6 text-center">
          <h2 className="text-xl font-semibold text-green-600">
            Connected Successfully!
          </h2>

          <p>{health.message}</p>
          <p>{health.database}</p>
          <p className="text-sm text-gray-500">
            {health.timestamp}
          </p>
        </div>
      )}

      {error && (
        <p className="text-red-500">{error}</p>
      )}

      {!health && !error && (
        <p>Checking backend connection...</p>
      )}
    </main>
  );
}