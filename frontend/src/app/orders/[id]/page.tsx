'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getCurrentUser, jsonBody, patchBody, type SessionUser } from '../../../lib/api';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryDate: string;
  deliveryTime: string;
  packaging: string;
  deliveryAddressId: string | null;
  subtotal: string;
  total: string;
  deliveryAddressSnapshot: {
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  employee: { id: string; name: string; email: string };
  company: { name: string };
  lines: {
    id: string;
    dishNameSnapshot: string;
    dishSkuSnapshot: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    combinations: {
      quantity: number;
      portionSizeNameSnapshot: string;
      unitPrice: string;
      totalPrice: string;
      options: { optionNameSnapshot: string; optionGroupNameSnapshot: string; price: string }[];
    }[];
  }[];
  events: { id: string; type: string; fromStatus: string | null; toStatus: string | null; createdAt: string }[];
};
type OrderContext = {
  company: {
    addresses: { id: string; label: string; line1: string; city: string }[];
  };
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [addresses, setAddresses] = useState<OrderContext['company']['addresses']>([]);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [addressId, setAddressId] = useState('');
  const [packaging, setPackaging] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        const [loadedOrder, currentUser] = await Promise.all([
          api<Order>(`/orders/${params.id}`),
          getCurrentUser(),
        ]);
        setOrder(loadedOrder);
        setUser(currentUser);
        setDeliveryTime(loadedOrder.deliveryTime);
        setDeliveryDate(loadedOrder.deliveryDate.slice(0, 10));
        setAddressId(loadedOrder.deliveryAddressId ?? '');
        setPackaging(loadedOrder.packaging);
        if (currentUser.permissions.includes('orders.manage')) {
          const context = await api<OrderContext>(`/orders/context/${loadedOrder.employee.id}`);
          setAddresses(context.company.addresses);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load order');
      }
    });
  }, [params.id]);

  async function saveOverride() {
    if (!order) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await api<Order>(
        `/orders/${order.id}/operational-override`,
        patchBody({ deliveryTime, deliveryAddressId: addressId, packaging }),
      );
      setOrder(updated);
      setNotice('Operational override saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save operational override');
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!order) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await api<Order>(`/orders/${order.id}`, patchBody({
        deliveryDate,
        deliveryTime,
        deliveryAddressId: addressId,
        packaging,
      }));
      setOrder(updated);
      setNotice('Draft delivery details saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update draft');
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) return <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>;
  if (!order) return <p>Loading order…</p>;

  return (
    <section className="space-y-5">
      <Link className="text-sm text-blue-800 underline" href="/orders">← Back to orders</Link>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      <header className="rounded border bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div><h1 className="text-2xl font-bold">{order.orderNumber}</h1><p>{order.company.name} · {order.employee.name} ({order.employee.email})</p></div>
          <div className="text-right"><p className="font-semibold">{order.status}</p><p>{order.deliveryDate.slice(0, 10)} at {order.deliveryTime}</p></div>
        </div>
        <p className="mt-3 text-sm text-slate-700">{order.deliveryAddressSnapshot.label}: {order.deliveryAddressSnapshot.line1}{order.deliveryAddressSnapshot.line2 ? `, ${order.deliveryAddressSnapshot.line2}` : ''}, {order.deliveryAddressSnapshot.city}, {order.deliveryAddressSnapshot.state} {order.deliveryAddressSnapshot.postalCode}, {order.deliveryAddressSnapshot.country}</p>
        <p className="text-sm text-slate-700">Packaging: {order.packaging}</p>
      </header>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Order items</h2>
        {order.lines.map((line) => (
          <article key={line.id} className="space-y-2 rounded border bg-white p-4">
            <div className="flex justify-between gap-3"><div><h3 className="font-semibold">{line.dishNameSnapshot}</h3><p className="text-xs text-slate-600">SKU {line.dishSkuSnapshot} · quantity {line.quantity} · unit ${line.unitPrice}</p></div><strong>${line.lineTotal}</strong></div>
            {line.combinations.map((combination, index) => (
              <div key={`${line.id}-${index}`} className="rounded bg-slate-50 p-3 text-sm">
                <p>{combination.quantity} × {combination.portionSizeNameSnapshot} · ${combination.unitPrice} each · ${combination.totalPrice}</p>
                {combination.options.map((option, optionIndex) => <p key={`${line.id}-${index}-${optionIndex}`} className="text-slate-700">{option.optionGroupNameSnapshot}: {option.optionNameSnapshot} (+${option.price})</p>)}
              </div>
            ))}
          </article>
        ))}
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Order history</h2>
        <ol className="mt-2 space-y-2 text-sm">{order.events.map((event) => <li key={event.id} className="border-l-2 border-slate-300 pl-3"><strong>{event.type}</strong>{event.fromStatus && ` · ${event.fromStatus} → ${event.toStatus}`}<span className="ml-2 text-slate-600">{new Date(event.createdAt).toLocaleString()}</span></li>)}</ol>
      </section>
      <p className="text-right font-semibold">Subtotal: ${order.subtotal} · Total: ${order.total}</p>
      {user?.permissions.includes('orders.manage') && order.status === 'CONFIRMED' && (
        <section className="space-y-3 rounded border bg-white p-4">
          <h2 className="font-semibold">Operational override</h2>
          <p className="text-sm text-slate-600">Update delivery details without changing the confirmed order’s price.</p>
          {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">Delivery time
              <input type="time" className="mt-1 block w-full rounded border px-3 py-2" value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} />
            </label>
            <label className="text-sm">Delivery address
              <select className="mt-1 block w-full rounded border px-3 py-2" value={addressId} onChange={(event) => setAddressId(event.target.value)}>
                {addresses.map((address) => <option key={address.id} value={address.id}>{address.label}: {address.line1}, {address.city}</option>)}
              </select>
            </label>
            <label className="text-sm">Packaging
              <input className="mt-1 block w-full rounded border px-3 py-2" value={packaging} onChange={(event) => setPackaging(event.target.value)} />
            </label>
          </div>
          <button disabled={busy} className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" onClick={saveOverride}>{busy ? 'Saving…' : 'Save override'}</button>
        </section>
      )}
      {user?.permissions.includes('orders.manage') && order.status === 'DRAFT' && (
        <section className="space-y-3 rounded border bg-white p-4">
          <h2 className="font-semibold">Edit draft delivery details</h2>
          {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm">Delivery date
              <input type="date" className="mt-1 block w-full rounded border px-3 py-2" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
            </label>
            <label className="text-sm">Delivery time
              <input type="time" className="mt-1 block w-full rounded border px-3 py-2" value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} />
            </label>
            <label className="text-sm">Delivery address
              <select className="mt-1 block w-full rounded border px-3 py-2" value={addressId} onChange={(event) => setAddressId(event.target.value)}>
                {addresses.map((address) => <option key={address.id} value={address.id}>{address.label}: {address.line1}, {address.city}</option>)}
              </select>
            </label>
            <label className="text-sm">Packaging
              <input className="mt-1 block w-full rounded border px-3 py-2" value={packaging} onChange={(event) => setPackaging(event.target.value)} />
            </label>
          </div>
          <button disabled={busy} className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" onClick={saveDraft}>{busy ? 'Saving…' : 'Save draft details'}</button>
        </section>
      )}
    </section>
  );
}
