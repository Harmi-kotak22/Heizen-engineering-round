'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, can, getCurrentUser, jsonBody, type PaginatedResponse, type SessionUser } from '../../../lib/api';

type Dish = {
  id: string;
  name: string;
  sku: string;
  temperature: string;
  active: boolean;
  station?: { name: string };
  categories?: Array<{ category: { name: string } }>;
};
type Station = { id: string; name: string };

export default function DishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [stationId, setStationId] = useState('');
  const [temperature, setTemperature] = useState('HOT');
  const [costPrice, setCostPrice] = useState('0');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const loadDishes = useCallback(async () => {
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    if (active) query.set('active', active);
    query.set('page', String(page));
    query.set('limit', '20');
    const response = await api<PaginatedResponse<Dish>>(`/catalogue/dishes?${query}`);
    setDishes(response.data);
    setTotalPages(response.pagination.totalPages);
  }, [active, page, search]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      api<Station[]>('/reference/stations')
        .then((items) => {
          setStations(items);
          setStationId((current) => current || items[0]?.id || '');
        })
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load stations'));
      getCurrentUser().then(setUser).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load current user'));
    });
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadDishes().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load dishes'));
    });
  }, [loadDishes]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const dish = await api<Dish>('/catalogue/dishes', jsonBody({
        name,
        sku,
        temperature,
        costPrice: Number(costPrice),
        stationId,
        minimumOrderQuantity: 1,
      }));
      setNotice(`Dish created: ${dish.name}`);
      setName('');
      setSku('');
      await loadDishes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create dish');
    }
  }

  async function toggle(dish: Dish) {
    setError('');
    try {
      await api(`/catalogue/dishes/${dish.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !dish.active }),
      });
      await loadDishes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change dish status');
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Dishes</h1>
        <p className="mt-1 text-sm text-slate-800">Create dishes here, then edit tags, categories and option groups on the dish detail page.</p>
      </div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
      {can(user, 'catalogue.manage') && (
        <form onSubmit={create} className="grid gap-3 rounded border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">Dish name<input required className="mt-1 block w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="text-sm">SKU<input required className="mt-1 block w-full rounded border px-3 py-2" value={sku} onChange={(e) => setSku(e.target.value)} /></label>
          <label className="text-sm">Station<select required className="mt-1 block w-full rounded border px-3 py-2" value={stationId} onChange={(e) => setStationId(e.target.value)}><option value="">Choose station</option>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
          <label className="text-sm">Temperature<select className="mt-1 block w-full rounded border px-3 py-2" value={temperature} onChange={(e) => setTemperature(e.target.value)}><option>HOT</option><option>COLD</option></select></label>
          <label className="text-sm">Cost price<input required min="0" step="0.01" type="number" className="mt-1 block w-full rounded border px-3 py-2" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} /></label>
          <button className="rounded bg-slate-900 px-4 py-2 text-white sm:col-span-2 lg:col-span-5">Create dish</button>
        </form>
      )}
      <div className="flex flex-wrap gap-3">
        <input aria-label="Search dishes" placeholder="Search name or SKU" className="rounded border bg-white px-3 py-2" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <select aria-label="Filter by active status" className="rounded border bg-white px-3 py-2" value={active} onChange={(e) => { setPage(1); setActive(e.target.value); }}>
          <option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
        <button className="rounded border bg-white px-3 py-2" onClick={() => loadDishes().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to refresh dishes'))}>Refresh</button>
      </div>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100"><tr><th className="p-3">Dish</th><th className="p-3">SKU</th><th className="p-3">Station</th><th className="p-3">Temperature</th><th className="p-3">Categories</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{dishes.map((dish) => (
            <tr key={dish.id} className="border-t">
              <td className="p-3"><Link className="font-medium text-blue-800 underline" href={`/catalogue/dishes/${dish.id}`}>{dish.name}</Link></td>
              <td className="p-3">{dish.sku}</td><td className="p-3">{dish.station?.name}</td><td className="p-3">{dish.temperature}</td>
              <td className="p-3">{dish.categories?.map(({ category }) => category.name).join(', ') || '—'}</td>
              <td className="p-3">{dish.active ? 'Active' : 'Inactive'}</td>
              <td className="p-3">{can(user, 'catalogue.manage') && <button className="rounded border px-2 py-1" onClick={() => toggle(dish)}>{dish.active ? 'Deactivate' : 'Activate'}</button>}</td>
            </tr>
          ))}{!dishes.length && <tr><td colSpan={7} className="p-4 text-slate-700">No dishes found.</td></tr>}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span>Page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} className="rounded border bg-white px-3 py-1 disabled:opacity-50" onClick={() => setPage((current) => current - 1)}>Previous</button>
          <button disabled={page >= totalPages} className="rounded border bg-white px-3 py-1 disabled:opacity-50" onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      </div>
    </section>
  );
}
