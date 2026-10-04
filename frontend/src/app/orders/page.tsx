'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getCurrentUser, jsonBody, type PaginatedResponse, type SessionUser } from '../../lib/api';

type Employee = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  canChooseAddress: boolean;
  canChangeDeliveryTime: boolean;
  canChangePackaging: boolean;
  company: { id: string; name: string };
};
type Tag = { id: string; name: string };
type MenuOption = { id: string; name: string; price: string; sizePrices: { portionSize: Tag; extraCharge: string }[] };
type MenuGroup = { id: string; name: string; required: boolean; portionSizes: Tag[]; options: MenuOption[] };
type MenuDish = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  minimumOrderQuantity: number;
  optionGroups: MenuGroup[];
};
type EffectiveMenu = {
  employee: { id: string; name: string };
  company: { id: string; name: string };
  categories: { id: string; name: string; dishes: MenuDish[] }[];
};
type Company = {
  id: string;
  name: string;
  defaultDeliveryTime: string | null;
  defaultPackaging: string | null;
  addresses: { id: string; label: string; line1: string; city: string; active: boolean }[];
};
type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryDate: string;
  total: string;
  employee: { name: string };
  company: { name: string };
};
type CartItem = { quantity: number; selections: Record<string, string>; portionSizeId: string };

export default function OrdersPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [menu, setMenu] = useState<EffectiveMenu | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [addressId, setAddressId] = useState('');
  const [packaging, setPackaging] = useState('');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [createdOrder, setCreatedOrder] = useState<OrderSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dishes = useMemo(() => menu?.categories.flatMap((category) => category.dishes) ?? [], [menu]);

  const loadOrders = useCallback(async () => {
    const response = await api<PaginatedResponse<OrderSummary>>('/orders?page=1&limit=50');
    setOrders(response.data);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        const tasks: Promise<unknown>[] = [];
        if (currentUser.permissions.includes('orders.create')) {
          tasks.push(api<Employee[]>('/orders/employees').then(setEmployees));
        }
        if (currentUser.permissions.includes('orders.read')) tasks.push(loadOrders());
        await Promise.all(tasks);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load order workspace');
      }
    });
  }, [loadOrders]);

  async function selectEmployee(nextId: string) {
    setEmployeeId(nextId);
    setMenu(null);
    setCompany(null);
    setCart({});
    setError('');
    if (!nextId) return;
    setBusy(true);
    try {
      const employee = employees.find((item) => item.id === nextId);
      if (!employee) throw new Error('Select an active employee');
      const [nextMenu, context] = await Promise.all([
        api<EffectiveMenu>(`/effective-menu/employees/${nextId}`),
        api<{ company: Company }>(`/orders/context/${nextId}`),
      ]);
      setMenu(nextMenu);
      const nextCompany = context.company;
      setCompany(nextCompany);
      setDeliveryTime(nextCompany.defaultDeliveryTime ?? '');
      setPackaging(nextCompany.defaultPackaging ?? '');
      const activeAddresses = nextCompany.addresses.filter((address) => address.active);
      if (!employee.canChooseAddress && activeAddresses.length === 1) setAddressId(activeAddresses[0].id);
      else setAddressId('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load employee menu');
    } finally {
      setBusy(false);
    }
  }

  function updateCart(dish: MenuDish, update: Partial<CartItem>) {
    setCart((current) => ({
      ...current,
      [dish.id]: {
        quantity: current[dish.id]?.quantity ?? 0,
        selections: current[dish.id]?.selections ?? {},
        portionSizeId: current[dish.id]?.portionSizeId ?? '',
        ...update,
      },
    }));
  }

  function orderPayload() {
    const lines = dishes.flatMap((dish) => {
      const item = cart[dish.id];
      if (!item?.quantity) return [];
      const selections = Object.entries(item.selections)
        .filter(([, optionId]) => Boolean(optionId))
        .map(([groupId, optionId]) => ({ groupId, optionId }));
      return [{
        dishId: dish.id,
        quantity: item.quantity,
        combinations: [{
          quantity: item.quantity,
          ...(item.portionSizeId ? { portionSizeId: item.portionSizeId } : {}),
          selections,
        }],
      }];
    });
    return {
      employeeId,
      deliveryDate,
      ...(deliveryTime ? { deliveryTime } : {}),
      ...(addressId ? { deliveryAddressId: addressId } : {}),
      ...(packaging ? { packaging } : {}),
      lines,
    };
  }

  async function createOrder() {
    setError('');
    setBusy(true);
    try {
      const created = await api<OrderSummary>('/orders', jsonBody(orderPayload()));
      setCreatedOrder(created);
      await loadOrders();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create order');
    } finally {
      setBusy(false);
    }
  }

  async function orderAction(
    id: string,
    action: 'place' | 'cancel' | 'confirm' | 'reject' | 'return-to-draft',
  ) {
    setError('');
    setBusy(true);
    try {
      await api(`/orders/${id}/${action}`, jsonBody({}));
      await loadOrders();
      if (createdOrder?.id === id) setCreatedOrder(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to ${action} order`);
    } finally {
      setBusy(false);
    }
  }

  const selectedEmployee = employees.find((employee) => employee.id === employeeId);
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="mt-1 text-sm text-slate-700">Create an order using the employee’s current effective menu and server-resolved prices.</p>
      </div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {createdOrder && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-emerald-300 bg-emerald-50 p-4">
          <p>Draft {createdOrder.orderNumber} created. Place it before cutoff when ready.</p>
          <button disabled={busy} className="rounded bg-emerald-800 px-3 py-2 text-white disabled:opacity-50" onClick={() => orderAction(createdOrder.id, 'place')}>Place order</button>
        </div>
      )}
      {user?.permissions.includes('orders.create') && (
        <section className="space-y-4 rounded border bg-white p-4">
          <h2 className="text-lg font-semibold">Create order draft</h2>
          <label className="block text-sm">Employee
            <select className="mt-1 block w-full rounded border px-3 py-2" value={employeeId} onChange={(event) => void selectEmployee(event.target.value)}>
              <option value="">Select employee</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {employee.company.name}</option>)}
            </select>
          </label>
          {menu && company && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">Delivery date<input type="date" required className="mt-1 block w-full rounded border px-3 py-2" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
                {selectedEmployee?.canChangeDeliveryTime && <label className="text-sm">Delivery time<input type="time" className="mt-1 block w-full rounded border px-3 py-2" value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} /></label>}
                {selectedEmployee?.canChooseAddress && <label className="text-sm">Delivery address
                  <select className="mt-1 block w-full rounded border px-3 py-2" value={addressId} onChange={(event) => setAddressId(event.target.value)}>
                    <option value="">Select address</option>
                    {company.addresses.filter((address) => address.active).map((address) => <option key={address.id} value={address.id}>{address.label}: {address.line1}, {address.city}</option>)}
                  </select>
                </label>}
                {selectedEmployee?.canChangePackaging && <label className="text-sm">Packaging<input className="mt-1 block w-full rounded border px-3 py-2" value={packaging} onChange={(event) => setPackaging(event.target.value)} /></label>}
              </div>
              <div className="space-y-3">
                {menu.categories.map((category) => (
                  <section key={category.id} className="space-y-2">
                    <h3 className="border-b pb-1 font-semibold">{category.name}</h3>
                    {category.dishes.map((dish) => {
                      const item = cart[dish.id] ?? { quantity: 0, selections: {}, portionSizeId: '' };
                      const sizeGroups = dish.optionGroups.filter((group) => group.portionSizes.length);
                      const portionSizes = sizeGroups.length
                        ? sizeGroups[0].portionSizes.filter((size) =>
                            sizeGroups.every((group) => group.portionSizes.some((candidate) => candidate.id === size.id)),
                          )
                        : [];
                      return (
                        <article key={dish.id} className="space-y-2 rounded border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div><strong>{dish.name}</strong><p className="text-sm text-slate-700">{dish.description} · ${dish.price} · minimum {dish.minimumOrderQuantity}</p></div>
                            <label className="text-sm">Quantity<input type="number" min="0" step="1" className="ml-2 w-20 rounded border px-2 py-1" value={item.quantity || ''} onChange={(event) => updateCart(dish, { quantity: Number(event.target.value) || 0 })} /><span className="sr-only">Minimum quantity {dish.minimumOrderQuantity}</span></label>
                          </div>
                          {item.quantity > 0 && portionSizes.length > 0 && (
                            <label className="block text-sm">Portion size
                              <select className="mt-1 block w-full rounded border px-3 py-2" value={item.portionSizeId} onChange={(event) => updateCart(dish, { portionSizeId: event.target.value })}>
                                <option value="">Select portion size</option>
                                {portionSizes.map((size) => <option key={size.id} value={size.id}>{size.name}</option>)}
                              </select>
                            </label>
                          )}
                          {item.quantity > 0 && dish.optionGroups.map((group) => (
                            <label key={group.id} className="block text-sm">{group.name} {group.required ? '(required)' : '(optional)'}
                              <select className="mt-1 block w-full rounded border px-3 py-2" value={item.selections[group.id] ?? ''} onChange={(event) => updateCart(dish, { selections: { ...item.selections, [group.id]: event.target.value } })}>
                                <option value="">{group.required ? 'Select an option' : 'No option'}</option>
                                {group.options.map((option) => <option key={option.id} value={option.id}>{option.name} — ${option.price}</option>)}
                              </select>
                            </label>
                          ))}
                        </article>
                      );
                    })}
                  </section>
                ))}
              </div>
              <button disabled={busy || !deliveryDate || !Object.values(cart).some((item) => item.quantity > 0)} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" onClick={createOrder}>{busy ? 'Saving…' : 'Create draft'}</button>
            </>
          )}
        </section>
      )}
      {user?.permissions.includes('orders.read') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent orders</h2><button className="text-sm underline" onClick={() => void loadOrders()}>Refresh</button></div>
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50"><tr><th className="p-3">Order</th><th className="p-3">Company / employee</th><th className="p-3">Delivery</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
              <tbody>{orders.map((order) => <tr key={order.id} className="border-b last:border-0">
                <td className="p-3"><Link className="text-blue-800 underline" href={`/orders/${order.id}`}>{order.orderNumber}</Link></td>
                <td className="p-3">{order.company.name} / {order.employee.name}</td>
                <td className="p-3">{order.deliveryDate.slice(0, 10)}</td><td className="p-3">${order.total}</td><td className="p-3">{order.status}</td>
                <td className="space-x-2 p-3">
                  {order.status === 'DRAFT' && user?.permissions.includes('orders.create') && <button disabled={busy} className="underline" onClick={() => orderAction(order.id, 'place')}>Place</button>}
                  {order.status === 'PLACED' && user?.permissions.includes('orders.manage') && <button disabled={busy} className="underline" onClick={() => orderAction(order.id, 'confirm')}>Confirm</button>}
                  {order.status === 'PLACED' && user?.permissions.includes('orders.manage') && <button disabled={busy} className="underline" onClick={() => orderAction(order.id, 'return-to-draft')}>Return to draft</button>}
                  {['DRAFT', 'PLACED'].includes(order.status) && user?.permissions.includes('orders.manage') && <button disabled={busy} className="underline" onClick={() => orderAction(order.id, 'reject')}>Reject</button>}
                  {['DRAFT', 'PLACED'].includes(order.status) && user?.permissions.includes('orders.manage') && <button disabled={busy} className="text-red-700 underline" onClick={() => orderAction(order.id, 'cancel')}>Cancel</button>}
                </td>
              </tr>)}</tbody>
            </table>
            {!orders.length && <p className="p-4 text-sm text-slate-700">No orders found.</p>}
          </div>
        </section>
      )}
      {busy && !menu && <p className="text-sm text-slate-600">Loading employee menu…</p>}
    </section>
  );
}
