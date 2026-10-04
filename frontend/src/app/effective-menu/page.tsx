'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { api, getCurrentUser, type PaginatedResponse, type SessionUser } from '../../lib/api';

type Employee = {
  id: string;
  name: string;
  email: string;
  company: { id: string; name: string };
};
type Tag = { id: string; name: string };
type MenuOption = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  priceSource: string;
  allergens: Tag[];
  dietaryTags: Tag[];
  sizePrices: { portionSize: Tag; extraCharge: string; priceWithExtraCharge: string }[];
};
type MenuDish = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sku: string;
  temperature: 'HOT' | 'COLD';
  minimumOrderQuantity: number;
  price: string;
  priceSource: string;
  station: string | null;
  allergens: Tag[];
  dietaryTags: Tag[];
  optionGroups: { id: string; name: string; required: boolean; portionSizes: Tag[]; options: MenuOption[] }[];
};
type EffectiveMenu = {
  employee: { id: string; name: string; email: string; allergies: Tag[]; dietaryPreferences: Tag[] };
  company: { id: string; name: string; priceTier: { id: string; name: string } };
  categories: { id: string; name: string; dishes: MenuDish[] }[];
};

export default function EffectiveMenuPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [menu, setMenu] = useState<EffectiveMenu | null>(null);
  const [error, setError] = useState('');
  const [loadingMenu, setLoadingMenu] = useState(false);

  const loadEmployees = useCallback(async () => {
    const result = await api<PaginatedResponse<Employee>>('/employees?page=1&limit=100');
    setEmployees(result.data);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      getCurrentUser()
        .then((currentUser) => {
          setUser(currentUser);
          if (currentUser.permissions.includes('employees.read')) {
            loadEmployees().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load employees'));
          }
        })
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load session'));
    });
  }, [loadEmployees]);

  async function preview() {
    if (!employeeId) return;
    setError('');
    setLoadingMenu(true);
    try {
      setMenu(await api<EffectiveMenu>(`/effective-menu/employees/${employeeId}`));
    } catch (reason) {
      setMenu(null);
      setError(reason instanceof Error ? reason.message : 'Unable to load effective menu');
    } finally {
      setLoadingMenu(false);
    }
  }

  function names(values: Tag[]) {
    return values.length ? values.map((value) => value.name).join(', ') : 'None';
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Effective menu preview</h1>
        <p className="mt-1 text-sm text-slate-700">Preview the orderable catalogue, visibility, and resolved prices for an employee.</p>
      </div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      <section className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <label className="min-w-64 text-sm">Employee
          <select className="mt-1 block w-full rounded border px-3 py-2" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">Select employee</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {employee.company.name}</option>)}
          </select>
        </label>
        <button disabled={!employeeId || loadingMenu || !user?.permissions.includes('catalogue.read')} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" onClick={preview}>
          {loadingMenu ? 'Loading…' : 'Preview menu'}
        </button>
      </section>
      {!user?.permissions.includes('employees.read') && <p className="text-sm text-amber-800">You need employee read permission to choose an employee.</p>}
      {menu && (
        <>
          <section className="rounded border bg-white p-4">
            <h2 className="font-semibold">{menu.company.name} · {menu.employee.name}</h2>
            <p className="text-sm text-slate-700">Pricing tier: {menu.company.priceTier.name} · {menu.employee.email}</p>
            <p className="mt-2 text-sm text-slate-700">Employee allergies: {names(menu.employee.allergies)} · Dietary preferences: {names(menu.employee.dietaryPreferences)}</p>
            <p className="mt-1 text-xs text-slate-600">Preferences are shown for staff awareness; they do not automatically filter menu items.</p>
          </section>
          {!menu.categories.length && <p className="rounded border bg-white p-4">No orderable menu items are available for this employee.</p>}
          <div className="space-y-7">
            {menu.categories.map((category) => (
              <section key={category.id} className="space-y-3">
                <h2 className="border-b pb-2 text-xl font-semibold">{category.name}</h2>
                {category.dishes.map((dish) => (
                  <article key={dish.id} className="space-y-3 rounded border bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">{dish.name}</h3>
                        {dish.description && <p className="mt-1 text-sm text-slate-700">{dish.description}</p>}
                        <p className="mt-1 text-xs text-slate-600">{dish.temperature} · {dish.station ?? 'Station unavailable'} · SKU {dish.sku} · Minimum quantity {dish.minimumOrderQuantity}</p>
                        <p className="mt-1 text-xs text-slate-600">Allergens: {names(dish.allergens)} · Dietary: {names(dish.dietaryTags)}</p>
                      </div>
                      <strong className="text-lg">${dish.price}</strong>
                    </div>
                    {dish.imageUrl && <Image unoptimized width={640} height={360} className="max-h-48 rounded object-cover" src={dish.imageUrl} alt={dish.name} />}
                    {dish.optionGroups.map((group) => (
                      <section key={group.id} className="rounded bg-slate-50 p-3">
                        <h4 className="font-medium">{group.name} <span className="text-sm text-slate-600">{group.required ? 'Required' : 'Optional'}</span></h4>
                        {group.portionSizes.length > 0 && <p className="mt-1 text-xs text-slate-600">Portion sizes: {group.portionSizes.map((size) => size.name).join(', ')}</p>}
                        <ul className="mt-2 space-y-2">
                          {group.options.map((option) => (
                            <li key={option.id} className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm">
                              <div>
                                <span className="font-medium">{option.name}</span>
                                {option.description && <span className="ml-2 text-slate-700">{option.description}</span>}
                                <p className="text-xs text-slate-600">Allergens: {names(option.allergens)} · Dietary: {names(option.dietaryTags)}</p>
                                {option.sizePrices.map((sizePrice) => <p key={sizePrice.portionSize.id} className="text-xs text-slate-700">{sizePrice.portionSize.name}: +${sizePrice.extraCharge} (total ${sizePrice.priceWithExtraCharge})</p>)}
                              </div>
                              <span>${option.price}</span>
                            </li>
                          ))}
                          {!group.options.length && <li className="pt-2 text-sm text-slate-600">No priced active options are available.</li>}
                        </ul>
                      </section>
                    ))}
                  </article>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
