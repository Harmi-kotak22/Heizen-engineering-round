'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, can, getCurrentUser, jsonBody, type PaginatedResponse, type SessionUser } from '../../lib/api';

type Company = {
  id: string;
  name: string;
  active: boolean;
  emailDomains: { domain: string }[];
  priceTier: { name: string } | null;
  _count?: { employees: number };
};
type Tier = { id: string; name: string };

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [tierId, setTierId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim()) query.set('search', search.trim());
    const result = await api<PaginatedResponse<Company>>(`/companies?${query}`);
    setCompanies(result.data);
    setTotalPages(Math.max(1, result.pagination.totalPages));
  }, [page, search]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      getCurrentUser().then((currentUser) => {
        setUser(currentUser);
        if (currentUser.permissions.includes('pricing.read')) {
          api<Tier[]>('/pricing/tiers').then(setTiers).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load pricing tiers'));
        }
      }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load session'));
      load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load companies'));
    });
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await api('/companies', jsonBody({
        name,
        emailDomains: domain ? [domain] : [],
        priceTierId: tierId || null,
        deliveryLeadMinutes: 60,
        mondayEnabled: true,
        tuesdayEnabled: true,
        wednesdayEnabled: true,
        thursdayEnabled: true,
        fridayEnabled: true,
        saturdayEnabled: false,
        sundayEnabled: false,
      }));
      setName('');
      setDomain('');
      setTierId('');
      setNotice('Company created.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create company');
    }
  }

  async function setStatus(company: Company) {
    setError('');
    try {
      await api(`/companies/${company.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !company.active }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update company status');
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Companies</h1>
        <p className="mt-1 text-sm text-slate-700">Manage company details and delivery configuration.</p>
      </div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
      {can(user, 'companies.manage') && (
        <form onSubmit={create} className="grid gap-3 rounded border bg-white p-4 sm:grid-cols-3">
          <label className="text-sm">Company name<input required className="mt-1 block w-full rounded border px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="text-sm">Email domain<input className="mt-1 block w-full rounded border px-3 py-2" placeholder="example.com" value={domain} onChange={(event) => setDomain(event.target.value)} /></label>
          <label className="text-sm">Pricing tier<select className="mt-1 block w-full rounded border px-3 py-2" value={tierId} onChange={(event) => setTierId(event.target.value)}><option value="">Use default tier</option>{tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
          <button className="rounded bg-slate-900 px-4 py-2 text-white sm:col-span-3">Create company</button>
        </form>
      )}
      <label className="block text-sm">Search<input className="mt-1 rounded border bg-white px-3 py-2" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} /></label>
      <div className="space-y-3">
        {companies.map((company) => (
          <article key={company.id} className="flex flex-wrap items-center justify-between gap-3 rounded border bg-white p-4">
            <div>
              <Link className="font-semibold text-blue-800 underline" href={`/companies/${company.id}`}>{company.name}</Link>
              <p className="mt-1 text-sm text-slate-700">
                {company.active ? 'Active' : 'Inactive'} · {company.priceTier?.name ?? 'Default pricing tier'} · {company.emailDomains.map((item) => item.domain).join(', ') || 'No email domains'}
              </p>
            </div>
            {can(user, 'companies.manage') && <button className="rounded border px-3 py-2 text-sm" onClick={() => setStatus(company)}>{company.active ? 'Deactivate' : 'Activate'}</button>}
          </article>
        ))}
        {!companies.length && <p className="rounded border bg-white p-4">No companies found.</p>}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} className="rounded border bg-white px-3 py-1 disabled:opacity-50" onClick={() => setPage((value) => value - 1)}>Previous</button>
          <button disabled={page >= totalPages} className="rounded border bg-white px-3 py-1 disabled:opacity-50" onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      </div>
    </section>
  );
}
