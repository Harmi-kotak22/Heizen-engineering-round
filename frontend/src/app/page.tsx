'use client';

import Link from 'next/link';
import { api, getCurrentUser, getToken, type SessionUser } from '../lib/api';
import { useEffect, useState } from 'react';

export default function Home() {
  const [health, setHealth] = useState<{ status: string; message: string; database: string } | null>(null);
  const [healthError, setHealthError] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (getToken()) {
      getCurrentUser()
        .then(setUser)
        .catch((error: unknown) => {
          setHealthError(error instanceof Error ? error.message : 'Unable to load user session');
          setUser(null);
        });
    }
    api<{ status: string; message: string; database: string }>('/health')
      .then(setHealth)
      .catch((error: unknown) => {
        setHealthError(error instanceof Error ? error.message : 'Health check failed');
      });
  }, []);

  const sections = [
    ['Categories', '/catalogue/categories', 'Create, edit and activate catalogue categories.'],
    ['Dishes', '/catalogue/dishes', 'Search and manage dishes, tags and option groups.'],
    ['Options', '/catalogue/options', 'Manage options used by dish option groups.'],
    ['Reference data', '/reference', 'Inspect stations, allergens, tags and portion sizes.'],
    ['Pricing', '/pricing', 'View pricing tiers, overrides and gap coverage.'],
    ['Companies', '/companies', 'Manage company delivery settings, addresses and calendars.'],
    ['Employees', '/employees', 'Manage company employees and ordering preferences.'],
    ['Effective menu', '/effective-menu', 'Preview the menu and prices available to an employee.'],
    ['Orders', '/orders', 'Create and manage order drafts, placements and lifecycle history.'],
  ];

  return (
    <div className="space-y-7">
      <section className="rounded border bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Admin panel · API test harness</p>
        <h1 className="mt-2 text-3xl font-bold">Kitchen Operations</h1>
        <p className="mt-2 max-w-2xl text-slate-800">
          Use this minimal interface to test sign-in, role permissions, validation and catalogue CRUD against the NestJS API.
        </p>
        {user ? (
          <p className="mt-4">Signed in as <strong>{user.name}</strong> ({user.role}).</p>
        ) : (
          <Link className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-white" href="/login">
            Sign in
          </Link>
        )}
        <div className="mt-5 border-t pt-4 text-sm">
          {health ? (
            <p className="text-emerald-800">Backend: {health.status} — {health.message} ({health.database})</p>
          ) : healthError ? (
            <p className="text-red-700">Backend health check failed: {healthError}</p>
          ) : (
            <p>Checking backend health…</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Test areas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sections
            .filter(([title]) => {
              if (title === 'Pricing') return user?.permissions.includes('pricing.read');
              if (title === 'Companies') return user?.permissions.includes('companies.read');
              if (title === 'Employees') return user?.permissions.includes('employees.read');
              if (title === 'Effective menu') return user?.permissions.includes('catalogue.read') && user.permissions.includes('employees.read');
              if (title === 'Orders') return user?.permissions.includes('orders.read') || user?.permissions.includes('orders.create');
              return true;
            })
            .map(([title, href, description]) => (
            <Link key={href} href={href} className="rounded border bg-white p-5 hover:border-slate-400">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-slate-800">{description}</p>
            </Link>
            ))}
        </div>
      </section>

    </div>
  );
}
