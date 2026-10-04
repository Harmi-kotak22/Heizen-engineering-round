'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getCurrentUser, type PaginatedResponse, type SessionUser } from '../../lib/api';

type KitchenStation = { id: string; name: string };
type PrepUnit = {
  id: string;
  orderId: string;
  orderNumber: string;
  deliveryDate: string;
  deliveryTime: string;
  company: { id: string; name: string };
  dish: string;
  dishSku: string;
  quantity: number;
  options: { optionGroupNameSnapshot: string; optionNameSnapshot: string }[];
  portionSize: string;
  station: KitchenStation;
  status: 'PENDING' | 'STARTED' | 'DONE';
  startedAt: string | null;
  doneAt: string | null;
  atRisk: boolean;
  late: boolean;
};

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function KitchenPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [board, setBoard] = useState<PaginatedResponse<PrepUnit> | null>(null);
  const [deliveryDate, setDeliveryDate] = useState(localDate);
  const [stationId, setStationId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (deliveryDate) params.set('deliveryDate', deliveryDate);
    if (stationId) params.set('stationId', stationId);
    if (status) params.set('status', status);
    return params.toString();
  }, [deliveryDate, page, stationId, status]);

  const loadBoard = useCallback(async () => {
    setError('');
    try {
      const [currentBoard, availableStations] = await Promise.all([
        api<PaginatedResponse<PrepUnit>>(`/kitchen/board?${query}`),
        api<KitchenStation[]>('/kitchen/stations'),
      ]);
      setBoard(currentBoard);
      setStations(availableStations);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load kitchen board');
    }
  }, [query]);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (currentUser.permissions.includes('kitchen.read')) await loadBoard();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load kitchen access');
      }
    });
  }, [loadBoard]);

  async function action(path: string, key: string) {
    setBusy(key);
    setError('');
    try {
      await api(path, { method: 'POST' });
      await loadBoard();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kitchen action failed');
    } finally {
      setBusy('');
    }
  }

  if (user && !user.permissions.includes('kitchen.read')) {
    return <p role="alert" className="rounded bg-amber-50 p-4 text-amber-900">You do not have permission to view kitchen operations.</p>;
  }

  const byStation = new Map<string, PrepUnit[]>();
  for (const unit of board?.data ?? []) {
    const items = byStation.get(unit.station.id) ?? [];
    items.push(unit);
    byStation.set(unit.station.id, items);
  }
  const stationOrder = [
    ...stations.filter((station) => byStation.has(station.id)),
    ...stations.filter((station) => !byStation.has(station.id)),
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Kitchen workflow</h1>
        <p className="mt-1 text-sm text-slate-700">Confirmed orders only. Start and complete preparation units at their assigned station.</p>
      </header>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      <section className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <label className="text-sm">Delivery date
          <input type="date" value={deliveryDate} onChange={(event) => { setDeliveryDate(event.target.value); setPage(1); }} className="mt-1 block rounded border px-3 py-2" />
        </label>
        <label className="text-sm">Station
          <select value={stationId} onChange={(event) => { setStationId(event.target.value); setPage(1); }} className="mt-1 block rounded border px-3 py-2">
            <option value="">All stations</option>
            {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Prep status
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1 block rounded border px-3 py-2">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="STARTED">In progress</option>
            <option value="DONE">Done</option>
          </select>
        </label>
        <button className="rounded border px-3 py-2 text-sm" onClick={() => void loadBoard()}>Refresh</button>
      </section>
      {stationOrder.filter((station) => byStation.has(station.id)).map((station) => (
        <section key={station.id} className="space-y-3">
          <h2 className="border-b pb-2 text-lg font-semibold">{station.name}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {byStation.get(station.id)?.map((unit) => (
              <article key={unit.id} className="space-y-3 rounded border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-600">{unit.orderNumber} · Order {unit.orderId} · {unit.company.name}</p>
                    <h3 className="font-semibold">{unit.dish}</h3>
                    <p className="text-sm text-slate-700">{unit.quantity} × {unit.portionSize} · {unit.deliveryDate.slice(0, 10)} at {unit.deliveryTime}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded px-2 py-1 text-xs ${unit.status === 'DONE' ? 'bg-emerald-100 text-emerald-900' : unit.status === 'STARTED' ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-800'}`}>{unit.status === 'STARTED' ? 'IN PROGRESS' : unit.status}</span>
                    {unit.late && <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-900">LATE</span>}
                    {!unit.late && unit.atRisk && <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">AT RISK</span>}
                  </div>
                </div>
                {unit.options.length > 0 && (
                  <ul className="text-sm text-slate-700">
                    {unit.options.map((option, index) => <li key={`${unit.id}-${index}`}>{option.optionGroupNameSnapshot}: {option.optionNameSnapshot}</li>)}
                  </ul>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <p className="text-xs text-slate-600">
                    Started {unit.startedAt ? new Date(unit.startedAt).toLocaleTimeString() : '—'} · Done {unit.doneAt ? new Date(unit.doneAt).toLocaleTimeString() : '—'}
                  </p>
                  <div className="flex gap-2">
                    {unit.status === 'PENDING' && user?.permissions.includes('kitchen.manage') && (
                      <button disabled={Boolean(busy)} onClick={() => void action(`/kitchen/prep-units/${unit.id}/start`, unit.id)} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">{busy === unit.id ? 'Saving…' : 'Start prep'}</button>
                    )}
                    {unit.status === 'STARTED' && user?.permissions.includes('kitchen.manage') && (
                      <button disabled={Boolean(busy)} onClick={() => void action(`/kitchen/prep-units/${unit.id}/done`, unit.id)} className="rounded bg-emerald-800 px-3 py-1.5 text-sm text-white disabled:opacity-50">{busy === unit.id ? 'Saving…' : 'Mark done'}</button>
                    )}
                    {unit.status !== 'DONE' && user?.permissions.includes('kitchen.forceComplete') && (
                      <button disabled={Boolean(busy)} onClick={() => void action(`/kitchen/prep-units/${unit.id}/force-complete`, unit.id)} className="rounded border border-amber-700 px-3 py-1.5 text-sm text-amber-900 disabled:opacity-50">Force done</button>
                    )}
                  </div>
                </div>
                {user?.permissions.includes('kitchen.forceComplete') && unit.status !== 'DONE' && (
                  <button disabled={Boolean(busy)} onClick={() => void action(`/kitchen/orders/${unit.orderId}/force-complete`, `order-${unit.orderId}`)} className="text-xs text-amber-900 underline disabled:opacity-50">Force-complete all prep for this order</button>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
      {board && (
        <footer className="flex items-center justify-between rounded border bg-white p-3 text-sm">
          <span>{board.pagination.total} prep units · page {board.pagination.page} of {Math.max(board.pagination.totalPages, 1)}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button>
            <button disabled={page >= board.pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        </footer>
      )}
      {board?.data.length === 0 && <p className="rounded border bg-white p-5 text-sm text-slate-700">No confirmed-order prep units match these filters.</p>}
    </section>
  );
}
