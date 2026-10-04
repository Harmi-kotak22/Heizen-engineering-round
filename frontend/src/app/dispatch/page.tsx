'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, can, getCurrentUser, patchBody, type SessionUser } from '../../lib/api';

type DropOrder = {
  id: string;
  orderNumber: string;
  status: string;
  packaging: string;
  employee: {
    id: string;
    name: string;
    email: string;
  };
  itemCount: number;
  isKitchenReady: boolean;
};

type DropItem = {
  id: string;
  company: {
    id: string;
    name: string;
    driverInstructions: string | null;
    defaultPackaging: string | null;
  };
  address: {
    id: string;
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  deliveryDate: string;
  deliveryTime: string;
  status: 'KITCHEN_READY' | 'DISPATCH_READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  driver: {
    id: string;
    name: string;
    email: string;
  } | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  deliveredOnTime: boolean | null;
  deliveryNote: string | null;
  deliveryPhotoUrl: string | null;
  kitchenReadiness: {
    isComplete: boolean;
    hasKitchenUnits: boolean;
    totalOrders: number;
    readyOrders: number;
  };
  orders: DropOrder[];
};

type Driver = {
  id: string;
  name: string;
  email: string;
};

type CompanyOption = {
  id: string;
  name: string;
};

export default function DispatchPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [drops, setDrops] = useState<DropItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyDropId, setBusyDropId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCompany, setFilterCompany] = useState<string>('ALL');
  const [filterDriver, setFilterDriver] = useState<string>('ALL');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      if (filterDate) queryParams.set('deliveryDate', filterDate);
      if (filterStatus !== 'ALL') queryParams.set('status', filterStatus);
      if (filterCompany !== 'ALL') queryParams.set('companyId', filterCompany);
      if (filterDriver !== 'ALL') queryParams.set('driverId', filterDriver);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const [boardRes, driversRes, companiesRes] = await Promise.all([
        api<{ drops: DropItem[] }>(`/dispatch/board${qs}`),
        api<Driver[]>('/dispatch/drivers'),
        api<{ data: CompanyOption[] }>('/companies?limit=100'),
      ]);

      setDrops(boardRes.drops);
      setDrivers(driversRes);
      setCompanies(companiesRes.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load dispatch board');
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterStatus, filterCompany, filterDriver]);

  useEffect(() => {
    void getCurrentUser()
      .then(setUser)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Unable to load user session'),
      );
  }, []);

  useEffect(() => {
    if (user?.permissions.includes('dispatch.read')) {
      void loadData();
    }
  }, [user, loadData]);

  async function handleAssignDriver(dropId: string, driverId: string | null) {
    setBusyDropId(dropId);
    setError('');
    setNotice('');
    try {
      await api(`/dispatch/drops/${dropId}/driver`, patchBody({ driverId }));
      setNotice('Driver assigned successfully.');
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to assign driver');
    } finally {
      setBusyDropId(null);
    }
  }

  async function handleMarkDispatchReady(dropId: string) {
    setBusyDropId(dropId);
    setError('');
    setNotice('');
    try {
      await api(`/dispatch/drops/${dropId}/dispatch-ready`, { method: 'POST' });
      setNotice('Drop marked as Dispatch Ready.');
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to transition drop');
    } finally {
      setBusyDropId(null);
    }
  }

  async function handleMarkOutForDelivery(dropId: string) {
    setBusyDropId(dropId);
    setError('');
    setNotice('');
    try {
      await api(`/dispatch/drops/${dropId}/out-for-delivery`, { method: 'POST' });
      setNotice('Drop is now Out for Delivery.');
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to dispatch drop');
    } finally {
      setBusyDropId(null);
    }
  }

  async function handleAdminMarkDelivered(dropId: string) {
    const note = window.prompt('Optional delivery note for Admin record:', '');
    if (note === null) return;

    setBusyDropId(dropId);
    setError('');
    setNotice('');
    try {
      await api(`/dispatch/drops/${dropId}/delivered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryNote: note || undefined }),
      });
      setNotice('Drop recorded as Delivered.');
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to mark delivered');
    } finally {
      setBusyDropId(null);
    }
  }

  if (!user) {
    return <section className="p-4">Loading session…</section>;
  }

  if (!user.permissions.includes('dispatch.read')) {
    return (
      <section className="rounded border bg-white p-6">
        <h1 className="text-xl font-bold text-red-700">Access Denied</h1>
        <p className="mt-2 text-slate-700">You need the dispatch.read permission to view the dispatch board.</p>
      </section>
    );
  }

  const canManage = can(user, 'dispatch.manage');

  // Operational metrics
  const counts = {
    KITCHEN_READY: drops.filter((d) => d.status === 'KITCHEN_READY').length,
    DISPATCH_READY: drops.filter((d) => d.status === 'DISPATCH_READY').length,
    OUT_FOR_DELIVERY: drops.filter((d) => d.status === 'OUT_FOR_DELIVERY').length,
    DELIVERED: drops.filter((d) => d.status === 'DELIVERED').length,
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dispatch Board</h1>
          <p className="mt-1 text-sm text-slate-700">
            Manage delivery drops, driver assignments, and delivery workflow progression.
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded border bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Kitchen Ready</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{counts.KITCHEN_READY}</p>
        </div>
        <div className="rounded border bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Dispatch Ready</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{counts.DISPATCH_READY}</p>
        </div>
        <div className="rounded border bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Out for Delivery</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{counts.OUT_FOR_DELIVERY}</p>
        </div>
        <div className="rounded border bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Delivered</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{counts.DELIVERED}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-end gap-3 rounded border bg-white p-4 shadow-sm">
        <label className="text-sm">
          Delivery Date
          <input
            type="date"
            className="mt-1 block rounded border px-3 py-1.5 text-sm"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Status
          <select
            className="mt-1 block rounded border px-3 py-1.5 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="KITCHEN_READY">Kitchen Ready</option>
            <option value="DISPATCH_READY">Dispatch Ready</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
          </select>
        </label>
        <label className="text-sm">
          Company
          <select
            className="mt-1 block rounded border px-3 py-1.5 text-sm"
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
          >
            <option value="ALL">All companies</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Driver
          <select
            className="mt-1 block rounded border px-3 py-1.5 text-sm"
            value={filterDriver}
            onChange={(e) => setFilterDriver(e.target.value)}
          >
            <option value="ALL">All drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {(filterDate || filterStatus !== 'ALL' || filterCompany !== 'ALL' || filterDriver !== 'ALL') && (
          <button
            onClick={() => {
              setFilterDate('');
              setFilterStatus('ALL');
              setFilterCompany('ALL');
              setFilterDriver('ALL');
            }}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Drops Board */}
      <div className="space-y-4">
        {drops.length === 0 ? (
          <div className="rounded border bg-white p-8 text-center text-slate-600">
            No drops match the current filter criteria.
          </div>
        ) : (
          drops.map((drop) => {
            const isBusy = busyDropId === drop.id;
            const statusConfig = {
              KITCHEN_READY: { label: 'Kitchen Ready', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
              DISPATCH_READY: { label: 'Dispatch Ready', bg: 'bg-blue-100 text-blue-900 border-blue-300' },
              OUT_FOR_DELIVERY: { label: 'Out for Delivery', bg: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
              DELIVERED: { label: 'Delivered', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
            }[drop.status];

            return (
              <div
                key={drop.id}
                className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow"
              >
                {/* Drop Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50/70 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusConfig.bg}`}>
                      {statusConfig.label}
                    </span>
                    <span className="font-semibold text-slate-900">{drop.company.name}</span>
                    <span className="text-sm font-medium text-slate-600">
                      🕒 {drop.deliveryTime} · 📅 {drop.deliveryDate}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">Drop ID: {drop.id.slice(0, 8)}…</div>
                </div>

                {/* Drop Body */}
                <div className="grid gap-4 p-4 lg:grid-cols-3">
                  {/* Column 1: Delivery Details */}
                  <div className="space-y-1.5 text-sm">
                    <p className="font-semibold text-slate-800">Delivery Address</p>
                    <p className="text-slate-700">
                      <span className="font-medium">{drop.address.label}:</span> {drop.address.line1}
                      {drop.address.line2 ? `, ${drop.address.line2}` : ''}, {drop.address.city},{' '}
                      {drop.address.state} {drop.address.postalCode}
                    </p>
                    {drop.company.driverInstructions && (
                      <p className="rounded bg-amber-50/80 p-2 text-xs text-amber-900">
                        <strong>Driver instructions:</strong> {drop.company.driverInstructions}
                      </p>
                    )}
                    {drop.company.defaultPackaging && (
                      <p className="text-xs text-slate-600">
                        Default packaging: {drop.company.defaultPackaging}
                      </p>
                    )}
                  </div>

                  {/* Column 2: Orders Included */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-800">
                        Orders ({drop.orders.length})
                      </p>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          drop.kitchenReadiness.isComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {drop.kitchenReadiness.isComplete
                          ? 'Kitchen Ready'
                          : `Prep in progress (${drop.kitchenReadiness.readyOrders}/${drop.kitchenReadiness.totalOrders})`}
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-100 rounded border border-slate-100 bg-slate-50/40 text-xs">
                      {drop.orders.map((order) => (
                        <li key={order.id} className="flex items-center justify-between p-2">
                          <div>
                            <span className="font-semibold text-slate-900">{order.orderNumber}</span> ·{' '}
                            <span className="text-slate-700">{order.employee.name}</span>
                          </div>
                          <div className="text-slate-600">
                            {order.itemCount} items · {order.packaging}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Column 3: Driver & Actions */}
                  <div className="space-y-3 rounded border border-slate-100 bg-slate-50/50 p-3 text-sm">
                    {/* Driver Assignment */}
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-500">
                        Assigned Driver
                      </label>
                      {canManage && drop.status !== 'DELIVERED' ? (
                        <select
                          className="mt-1 block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                          value={drop.driver?.id ?? ''}
                          disabled={isBusy}
                          onChange={(e) =>
                            void handleAssignDriver(drop.id, e.target.value || null)
                          }
                        >
                          <option value="">Unassigned</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.email})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="mt-1 font-medium text-slate-800">
                          {drop.driver ? `${drop.driver.name} (${drop.driver.email})` : 'Unassigned'}
                        </p>
                      )}
                    </div>

                    {/* Operational Transition Actions */}
                    {canManage && (
                      <div className="space-y-2 pt-1 border-t border-slate-200">
                        {drop.status === 'KITCHEN_READY' && (
                          <div>
                            <button
                              disabled={isBusy || !drop.kitchenReadiness.isComplete}
                              onClick={() => void handleMarkDispatchReady(drop.id)}
                              className="w-full rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              {isBusy ? 'Updating…' : 'Mark Dispatch Ready'}
                            </button>
                            {!drop.kitchenReadiness.isComplete && (
                              <p className="mt-1 text-[11px] text-amber-700">
                                ⚠ Kitchen preparation is still in progress.
                              </p>
                            )}
                          </div>
                        )}

                        {drop.status === 'DISPATCH_READY' && (
                          <div>
                            <button
                              disabled={isBusy || !drop.driver}
                              onClick={() => void handleMarkOutForDelivery(drop.id)}
                              className="w-full rounded bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
                            >
                              {isBusy ? 'Updating…' : 'Send Out for Delivery'}
                            </button>
                            {!drop.driver && (
                              <p className="mt-1 text-[11px] text-red-600">
                                ⚠ A driver must be assigned first.
                              </p>
                            )}
                          </div>
                        )}

                        {drop.status === 'OUT_FOR_DELIVERY' && (
                          <button
                            disabled={isBusy}
                            onClick={() => void handleAdminMarkDelivered(drop.id)}
                            className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Mark Delivered (Admin Override)
                          </button>
                        )}
                      </div>
                    )}

                    {/* Delivered Information */}
                    {drop.status === 'DELIVERED' && (
                      <div className="rounded bg-emerald-50 p-2 text-xs text-emerald-950 space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span>Delivered:</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] ${
                              drop.deliveredOnTime
                                ? 'bg-emerald-200 text-emerald-900'
                                : 'bg-amber-200 text-amber-900'
                            }`}
                          >
                            {drop.deliveredOnTime ? 'On Time' : 'Delayed'}
                          </span>
                        </div>
                        {drop.deliveredAt && (
                          <p className="text-[11px] text-emerald-800">
                            {new Date(drop.deliveredAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                        {drop.deliveryNote && (
                          <p className="text-[11px]">
                            <strong>Note:</strong> {drop.deliveryNote}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
