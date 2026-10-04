'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearToken, getCurrentUser, getToken, type SessionUser } from '../lib/api';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'signed-out' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      if (pathname === '/login') return;
      if (!getToken()) {
        setStatus('signed-out');
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        setStatus('ready');
      } catch (reason) {
        clearToken();
        setError(reason instanceof Error ? reason.message : 'Unable to load user session');
        setStatus('error');
      }
    })();
  }, [pathname]);

  if (pathname === '/login') return <>{children}</>;
  if (pathname === '/' && (status === 'signed-out' || status === 'error')) {
    return <main className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8">{children}</main>;
  }
  if (status === 'loading') {
    return <main className="mx-auto max-w-5xl p-8">Checking your session…</main>;
  }
  if (status === 'signed-out' || status === 'error') {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">Sign in required</h1>
        {error && <p className="mt-3 text-red-700">{error}</p>}
        <Link className="mt-4 inline-block text-blue-700 underline" href="/login">
          Go to login
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="font-semibold">Heizen Kitchen Operations</Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            <Link href="/">Home</Link>
            {user?.permissions.includes('catalogue.read') && <>
              <Link href="/catalogue/categories">Categories</Link>
              <Link href="/catalogue/dishes">Dishes</Link>
              <Link href="/catalogue/options">Options</Link>
              <Link href="/reference">Reference data</Link>
            </>}
            {user?.permissions.includes('pricing.read') && (
              <Link href="/pricing">Pricing</Link>
            )}
            {user?.permissions.includes('companies.read') && (
              <Link href="/companies">Companies</Link>
            )}
            {user?.permissions.includes('employees.read') && (
              <Link href="/employees">Employees</Link>
            )}
            {user?.permissions.includes('catalogue.read') && (
              <Link href="/effective-menu">Menu preview</Link>
            )}
            {(user?.permissions.includes('orders.read') || user?.permissions.includes('orders.create')) && (
              <Link href="/orders">Orders</Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span>{user?.name} · {user?.role}</span>
            <button
              className="rounded border px-3 py-1"
              onClick={() => {
                clearToken();
                router.replace('/login');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="mb-6 rounded border border-slate-200 bg-white p-4">
          <p className="font-medium">Authenticated as {user?.email}</p>
          <p className="mt-1 text-sm text-slate-800">
            Role: {user?.role} · Permissions: {user?.permissions.join(', ') || 'none'}
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
