'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, can, getCurrentUser, jsonBody, patchBody, type PaginatedResponse, type SessionUser } from '../../../lib/api';

type Option = { id: string; name: string; description: string | null; costPrice: string | number; active: boolean };

export default function OptionsPage() {
  const [options, setOptions] = useState<Option[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costPrice, setCostPrice] = useState('0');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    query.set('page', String(page));
    query.set('limit', '20');
    const response = await api<PaginatedResponse<Option>>(`/catalogue/options?${query}`);
    setOptions(response.data);
    setTotalPages(response.pagination.totalPages);
  }, [page, search]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load options'));
      getCurrentUser().then(setUser).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load current user'));
    });
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await api('/catalogue/options', jsonBody({ name, description, costPrice: Number(costPrice) }));
      setName('');
      setDescription('');
      setNotice('Option created.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create option');
    }
  }

  async function save(option: Option) {
    setError('');
    setNotice('');
    try {
      await api(`/catalogue/options/${option.id}`, patchBody({
        name: option.name,
        description: option.description,
        costPrice: Number(option.costPrice),
      }));
      setNotice('Option updated.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update option');
    }
  }

  async function toggle(option: Option) {
    setError('');
    try {
      await api(`/catalogue/options/${option.id}/status`, patchBody({ active: !option.active }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change option status');
    }
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Options</h1>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
      {can(user, 'catalogue.manage') && (
        <form onSubmit={create} className="grid gap-3 rounded border bg-white p-4 sm:grid-cols-3">
          <label className="text-sm">Name<input required className="mt-1 block w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="text-sm">Description<input className="mt-1 block w-full rounded border px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className="text-sm">Cost price<input required min="0" step="0.01" type="number" className="mt-1 block w-full rounded border px-3 py-2" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} /></label>
          <button className="rounded bg-slate-900 px-4 py-2 text-white sm:col-span-3">Create option</button>
        </form>
      )}
      <input aria-label="Search options" placeholder="Search options" className="rounded border bg-white px-3 py-2" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
      <div className="space-y-3">
        {options.map((option) => (
          <div key={option.id} className="grid gap-3 rounded border bg-white p-4 md:grid-cols-[1fr_2fr_140px_auto_auto] md:items-end">
            <label className="text-sm">Name<input disabled={!can(user, 'catalogue.manage')} className="mt-1 block w-full rounded border px-2 py-2 disabled:bg-slate-100" value={option.name} onChange={(e) => setOptions((items) => items.map((item) => item.id === option.id ? { ...item, name: e.target.value } : item))} /></label>
            <label className="text-sm">Description<input disabled={!can(user, 'catalogue.manage')} className="mt-1 block w-full rounded border px-2 py-2 disabled:bg-slate-100" value={option.description || ''} onChange={(e) => setOptions((items) => items.map((item) => item.id === option.id ? { ...item, description: e.target.value } : item))} /></label>
            <label className="text-sm">Cost price<input disabled={!can(user, 'catalogue.manage')} type="number" min="0" step="0.01" className="mt-1 block w-full rounded border px-2 py-2 disabled:bg-slate-100" value={option.costPrice} onChange={(e) => setOptions((items) => items.map((item) => item.id === option.id ? { ...item, costPrice: e.target.value } : item))} /></label>
            <span className="text-sm">{option.active ? 'Active' : 'Inactive'}</span>
            {can(user, 'catalogue.manage') && <div className="flex gap-2"><button className="rounded border px-3 py-2" onClick={() => save(option)}>Save</button><button className="rounded border px-3 py-2" onClick={() => toggle(option)}>{option.active ? 'Deactivate' : 'Activate'}</button></div>}
          </div>
        ))}
        <div className="flex items-center justify-between text-sm">
          <span>Page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} className="rounded border bg-white px-3 py-1 disabled:opacity-50" onClick={() => setPage((current) => current - 1)}>Previous</button>
            <button disabled={page >= totalPages} className="rounded border bg-white px-3 py-1 disabled:opacity-50" onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        </div>
        {!options.length && <p className="rounded border bg-white p-4 text-slate-700">No options found.</p>}
      </div>
    </section>
  );
}
