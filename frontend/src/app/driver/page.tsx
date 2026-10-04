'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, can, getCurrentUser, type SessionUser } from '../../lib/api';

type DriverOrder = {
  id: string;
  orderNumber: string;
  status: string;
  packaging: string;
  employeeName: string;
  items: string[];
};

type DriverDelivery = {
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
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  deliveredOnTime: boolean | null;
  deliveryNote: string | null;
  deliveryPhotoUrl: string | null;
  driverInstructions: string | null;
  orders: DriverOrder[];
};

export default function DriverDeliveriesPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Delivery submission modal / inline state
  const [activeDropId, setActiveDropId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<DriverDelivery[]>('/dispatch/driver/today');
      setDeliveries(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load assigned deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void getCurrentUser()
      .then(setUser)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Unable to load user session'),
      );
  }, []);

  useEffect(() => {
    if (user?.permissions.includes('deliveries.readOwn')) {
      void loadDeliveries();
    }
  }, [user, loadDeliveries]);

  async function handleCompleteDelivery(dropId: string) {
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await api(`/dispatch/drops/${dropId}/delivered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryNote: note.trim() || undefined,
          deliveryPhotoUrl: photoUrl.trim() || undefined,
        }),
      });
      setNotice('Delivery marked as completed successfully!');
      setActiveDropId(null);
      setNote('');
      setPhotoUrl('');
      await loadDeliveries();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to complete delivery');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return <section className="p-4">Loading session…</section>;
  }

  if (!user.permissions.includes('deliveries.readOwn')) {
    return (
      <section className="rounded border bg-white p-6">
        <h1 className="text-xl font-bold text-red-700">Access Denied</h1>
        <p className="mt-2 text-slate-700">You need the deliveries.readOwn permission to view assigned driver deliveries.</p>
      </section>
    );
  }

  const canDeliver = can(user, 'deliveries.manageOwn') || can(user, 'dispatch.manage');

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Today’s Deliveries</h1>
          <p className="mt-1 text-sm text-slate-700">
            Assigned drops for {user.name} ({user.email}) ordered by delivery time.
          </p>
        </div>
        <button
          onClick={() => void loadDeliveries()}
          disabled={loading}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}

      {deliveries.length === 0 ? (
        <div className="rounded border bg-white p-8 text-center text-slate-600">
          <p className="text-base font-semibold">No deliveries assigned for today.</p>
          <p className="mt-1 text-sm text-slate-500">Check back later or contact Dispatch if you are scheduled for routes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((delivery, index) => {
            const isCompleted = delivery.status === 'DELIVERED';
            const isOut = delivery.status === 'OUT_FOR_DELIVERY';

            const statusBadge = {
              KITCHEN_READY: { label: 'Kitchen Ready', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
              DISPATCH_READY: { label: 'Dispatch Ready', bg: 'bg-blue-100 text-blue-900 border-blue-300' },
              OUT_FOR_DELIVERY: { label: 'Out for Delivery', bg: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
              DELIVERED: { label: 'Delivered', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
            }[delivery.status];

            const isFormOpen = activeDropId === delivery.id;

            return (
              <div
                key={delivery.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all"
              >
                {/* Delivery Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50/80 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="text-base font-bold text-slate-900">
                      🕒 {delivery.deliveryTime}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge.bg}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">Drop ID: {delivery.id.slice(0, 8)}…</span>
                </div>

                {/* Delivery Content */}
                <div className="p-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Destination info */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase text-slate-500">Company & Address</p>
                      <h3 className="text-base font-semibold text-slate-900">{delivery.company.name}</h3>
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">{delivery.address.label}:</span> {delivery.address.line1}
                        {delivery.address.line2 ? `, ${delivery.address.line2}` : ''}
                      </p>
                      <p className="text-sm text-slate-600">
                        {delivery.address.city}, {delivery.address.state} {delivery.address.postalCode}
                      </p>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase text-slate-500">Delivery Instructions</p>
                      {delivery.driverInstructions ? (
                        <p className="rounded bg-amber-50 p-2 text-xs text-amber-950 font-medium">
                          ⚠ {delivery.driverInstructions}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No special instructions provided.</p>
                      )}
                      {delivery.company.defaultPackaging && (
                        <p className="text-xs text-slate-600">
                          Packaging: <strong>{delivery.company.defaultPackaging}</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Included orders */}
                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Included Orders ({delivery.orders.length})
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {delivery.orders.map((o) => (
                        <div key={o.id} className="rounded border border-slate-100 bg-slate-50 p-2.5 text-xs">
                          <div className="flex items-center justify-between font-medium text-slate-900">
                            <span>{o.orderNumber}</span>
                            <span>{o.employeeName}</span>
                          </div>
                          <p className="mt-1 text-slate-600">Package: {o.packaging}</p>
                          {o.items.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-slate-700">
                              {o.items.map((item, idx) => (
                                <li key={idx} className="list-disc ml-3">
                                  {item}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Completion Details or Action Form */}
                  {isCompleted ? (
                    <div className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-950 border border-emerald-200">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Delivered successfully</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                            delivery.deliveredOnTime
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {delivery.deliveredOnTime ? '✓ On Time' : '⚠ Delayed'}
                        </span>
                      </div>
                      {delivery.deliveredAt && (
                        <p className="mt-1 text-slate-700">
                          Timestamp: {new Date(delivery.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {delivery.deliveryNote && (
                        <p className="mt-1 text-slate-800">
                          <strong>Note:</strong> {delivery.deliveryNote}
                        </p>
                      )}
                      {delivery.deliveryPhotoUrl && (
                        <p className="mt-1 text-slate-600">
                          Photo: <a href={delivery.deliveryPhotoUrl} target="_blank" rel="noreferrer" className="underline text-blue-700">View Photo</a>
                        </p>
                      )}
                    </div>
                  ) : canDeliver ? (
                    <div className="border-t border-slate-100 pt-3">
                      {!isFormOpen ? (
                        <button
                          onClick={() => {
                            setActiveDropId(delivery.id);
                            setNote('');
                            setPhotoUrl('');
                          }}
                          className={`w-full rounded px-4 py-2 font-medium text-sm text-white ${
                            isOut ? 'bg-emerald-800 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'
                          }`}
                        >
                          {isOut ? 'Mark as Delivered' : 'Complete Delivery'}
                        </button>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <h4 className="font-semibold text-sm text-slate-900">Confirm Delivery Completion</h4>
                          <label className="block text-xs font-medium text-slate-700">
                            Delivery Note (optional)
                            <textarea
                              rows={2}
                              className="mt-1 block w-full rounded border px-3 py-1.5 text-xs bg-white"
                              placeholder="e.g. Left with reception desk / handed to client"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-700">
                            Delivery Photo URL (optional)
                            <input
                              type="url"
                              className="mt-1 block w-full rounded border px-3 py-1.5 text-xs bg-white"
                              placeholder="https://example.com/photo.jpg"
                              value={photoUrl}
                              onChange={(e) => setPhotoUrl(e.target.value)}
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              disabled={submitting}
                              onClick={() => void handleCompleteDelivery(delivery.id)}
                              className="rounded bg-emerald-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {submitting ? 'Recording…' : 'Confirm Delivered'}
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => setActiveDropId(null)}
                              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
