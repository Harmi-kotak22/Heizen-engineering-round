'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, can, getCurrentUser, jsonBody, patchBody, type PaginatedResponse, type SessionUser } from '../../../../lib/api';

type RefItem = { id: string; name: string; active?: boolean; displayOrder?: number };
type Dish = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sku: string;
  temperature: 'HOT' | 'COLD';
  costPrice: string | number;
  stationId: string;
  minimumOrderQuantity: number;
  active: boolean;
  station?: RefItem;
  allergens: Array<{ allergen: RefItem }>;
  dietaryTags: Array<{ dietaryTag: RefItem }>;
  categories: Array<{ category: RefItem }>;
  optionGroups: OptionGroup[];
};
type OptionGroup = {
  id: string;
  name: string;
  required: boolean;
  displayOrder: number;
  active: boolean;
  sizes: Array<{ portionSize: RefItem }>;
  options: Array<{
    optionId: string;
    displayOrder: number;
    option: RefItem;
    sizePrices: Array<{ portionSizeId: string; extraCharge: string | number; portionSize: RefItem }>;
  }>;
};
type References = {
  stations: RefItem[];
  allergens: RefItem[];
  dietaryTags: RefItem[];
  categories: RefItem[];
  options: RefItem[];
  portionSizes: RefItem[];
};

const emptyReferences: References = { stations: [], allergens: [], dietaryTags: [], categories: [], options: [], portionSizes: [] };

function SelectList({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: RefItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <select
        multiple
        className="mt-1 block min-h-28 w-full rounded border px-2 py-1"
        value={selected}
        onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}
      >
        {values.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <span className="text-xs text-slate-700">Use Ctrl/⌘ to select multiple.</span>
    </label>
  );
}

export default function DishDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dish, setDish] = useState<Dish | null>(null);
  const [refs, setRefs] = useState<References>(emptyReferences);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupOrder, setGroupOrder] = useState('0');
  const [selectedOption, setSelectedOption] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [optionOrders, setOptionOrders] = useState<Record<string, string>>({});
  const [charges, setCharges] = useState<Record<string, string>>({});

  const loadDish = useCallback(async () => {
    setDish(await api<Dish>(`/catalogue/dishes/${id}`));
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadDish().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load dish'));
      getCurrentUser().then(setUser).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load current user'));
      Promise.all([
        api<RefItem[]>('/reference/stations'),
        api<RefItem[]>('/reference/allergens'),
        api<RefItem[]>('/reference/dietary-tags'),
        api<PaginatedResponse<RefItem>>('/catalogue/categories?limit=100'),
        api<PaginatedResponse<RefItem>>('/catalogue/options?limit=100'),
        api<RefItem[]>('/reference/portion-sizes'),
      ]).then(([stations, allergens, dietaryTags, categoriesResponse, optionsResponse, portionSizes]) => {
        const categories = categoriesResponse.data;
        const options = optionsResponse.data;
        setRefs({ stations, allergens, dietaryTags, categories, options, portionSizes });
        setSelectedOption(options[0]?.id || '');
        setSelectedSize(portionSizes[0]?.id || '');
      }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load reference data'));
    });
  }, [loadDish]);

  function showError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'The request failed');
    setNotice('');
  }

  async function updateDish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dish) return;
    setError('');
    setNotice('');
    try {
      await api(`/catalogue/dishes/${id}`, patchBody({
        name: dish.name,
        description: dish.description,
        imageUrl: dish.imageUrl,
        sku: dish.sku,
        temperature: dish.temperature,
        costPrice: Number(dish.costPrice),
        stationId: dish.stationId,
        minimumOrderQuantity: Number(dish.minimumOrderQuantity),
        active: dish.active,
        allergenIds: dish.allergens.map(({ allergen }) => allergen.id),
        dietaryTagIds: dish.dietaryTags.map(({ dietaryTag }) => dietaryTag.id),
        categoryIds: dish.categories.map(({ category }) => category.id),
      }));
      await loadDish();
      setNotice('Dish updated.');
    } catch (reason) {
      showError(reason);
    }
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api(`/catalogue/dishes/${id}/option-groups`, jsonBody({
        name: groupName,
        required: groupRequired,
        displayOrder: Number(groupOrder),
      }));
      setGroupName('');
      setNotice('Option group created.');
      await loadDish();
    } catch (reason) {
      showError(reason);
    }
  }

  async function groupAction(groupId: string, action: () => Promise<unknown>, successMessage: string) {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
    } catch (reason) {
      showError(reason);
    } finally {
      await loadDish().catch(showError);
    }
  }

  if (!dish) {
    return <div>{error ? <p role="alert" className="text-red-800">{error}</p> : 'Loading dish…'}</div>;
  }

  const canManage = can(user, 'catalogue.manage');
  const updateRelation = (field: 'allergens' | 'dietaryTags' | 'categories', ids: string[]) => {
    if (!dish) return;
    setDish({
      ...dish,
      [field]: field === 'allergens'
        ? ids.map((allergenId) => ({ allergen: refs.allergens.find((item) => item.id === allergenId)! }))
        : field === 'dietaryTags'
          ? ids.map((dietaryTagId) => ({ dietaryTag: refs.dietaryTags.find((item) => item.id === dietaryTagId)! }))
          : ids.map((categoryId) => ({ category: refs.categories.find((item) => item.id === categoryId)! })),
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/catalogue/dishes" className="text-sm text-blue-800 underline">← Back to dishes</Link><h1 className="mt-2 text-2xl font-bold">{dish.name}</h1></div>
        <span className="rounded border bg-white px-3 py-2 text-sm">{dish.active ? 'Active' : 'Inactive'}</span>
      </div>
      {error && <p role="alert" className="whitespace-pre-wrap rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}

      <form onSubmit={updateDish} className="space-y-4 rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">Dish details</h2>
        <fieldset disabled={!canManage} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">Name<input className="mt-1 block w-full rounded border px-3 py-2" value={dish.name} onChange={(e) => setDish({ ...dish, name: e.target.value })} /></label>
          <label className="text-sm">SKU<input className="mt-1 block w-full rounded border px-3 py-2" value={dish.sku} onChange={(e) => setDish({ ...dish, sku: e.target.value })} /></label>
          <label className="text-sm">Station<select className="mt-1 block w-full rounded border px-3 py-2" value={dish.stationId} onChange={(e) => setDish({ ...dish, stationId: e.target.value })}>{refs.stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
          <label className="text-sm">Temperature<select className="mt-1 block w-full rounded border px-3 py-2" value={dish.temperature} onChange={(e) => setDish({ ...dish, temperature: e.target.value as 'HOT' | 'COLD' })}><option>HOT</option><option>COLD</option></select></label>
          <label className="text-sm">Cost price<input type="number" min="0" step="0.01" className="mt-1 block w-full rounded border px-3 py-2" value={dish.costPrice} onChange={(e) => setDish({ ...dish, costPrice: e.target.value })} /></label>
          <label className="text-sm">Minimum order quantity<input type="number" min="1" className="mt-1 block w-full rounded border px-3 py-2" value={dish.minimumOrderQuantity} onChange={(e) => setDish({ ...dish, minimumOrderQuantity: Number(e.target.value) })} /></label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">Description<textarea className="mt-1 block w-full rounded border px-3 py-2" value={dish.description || ''} onChange={(e) => setDish({ ...dish, description: e.target.value })} /></label>
          <SelectList label="Allergens" values={refs.allergens} selected={dish.allergens.map(({ allergen }) => allergen.id)} onChange={(ids) => updateRelation('allergens', ids)} />
          <SelectList label="Dietary tags" values={refs.dietaryTags} selected={dish.dietaryTags.map(({ dietaryTag }) => dietaryTag.id)} onChange={(ids) => updateRelation('dietaryTags', ids)} />
          <SelectList label="Categories" values={refs.categories} selected={dish.categories.map(({ category }) => category.id)} onChange={(ids) => updateRelation('categories', ids)} />
        </fieldset>
        {canManage && <button className="rounded bg-slate-900 px-4 py-2 text-white">Save dish</button>}
        {!canManage && <p className="text-sm text-amber-800">Read-only: this account does not have catalogue.manage.</p>}
      </form>

      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold">Option groups</h2><p className="text-sm text-slate-800">Create and configure groups, offered options, portion sizes and size-specific extra charges.</p></div>
        {canManage && (
          <form onSubmit={createGroup} className="grid gap-3 rounded border bg-white p-4 sm:grid-cols-3">
            <label className="text-sm">Group name<input required className="mt-1 block w-full rounded border px-3 py-2" value={groupName} onChange={(e) => setGroupName(e.target.value)} /></label>
            <label className="text-sm">Display order<input type="number" min="0" className="mt-1 block w-full rounded border px-3 py-2" value={groupOrder} onChange={(e) => setGroupOrder(e.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={groupRequired} onChange={(e) => setGroupRequired(e.target.checked)} /> Required selection</label>
            <button className="rounded bg-slate-900 px-4 py-2 text-white sm:col-span-3">Create option group</button>
          </form>
        )}
        {dish.optionGroups.map((group) => (
          <article key={group.id} className="space-y-4 rounded border bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto_auto] sm:items-end">
              <label className="text-sm">Group name<input className="mt-1 block w-full rounded border px-3 py-2" value={group.name} onChange={(e) => setDish({ ...dish, optionGroups: dish.optionGroups.map((item) => item.id === group.id ? { ...item, name: e.target.value } : item) })} /></label>
              <label className="text-sm">Order<input type="number" min="0" className="mt-1 block w-full rounded border px-3 py-2" value={group.displayOrder} onChange={(e) => setDish({ ...dish, optionGroups: dish.optionGroups.map((item) => item.id === group.id ? { ...item, displayOrder: Number(e.target.value) } : item) })} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={group.required} onChange={(e) => setDish({ ...dish, optionGroups: dish.optionGroups.map((item) => item.id === group.id ? { ...item, required: e.target.checked } : item) })} /> Required</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={group.active} onChange={(e) => setDish({ ...dish, optionGroups: dish.optionGroups.map((item) => item.id === group.id ? { ...item, active: e.target.checked } : item) })} /> Active</label>
              {canManage && <div className="flex gap-2">
                <button className="rounded border px-3 py-2" onClick={() => groupAction(group.id, () => api(`/catalogue/option-groups/${group.id}`, patchBody({ name: group.name, required: group.required, displayOrder: group.displayOrder, active: group.active })), 'Option group updated.')}>Save group</button>
                <button className="rounded border border-red-300 px-3 py-2 text-red-800" onClick={() => groupAction(group.id, () => api(`/catalogue/option-groups/${group.id}`, { method: 'DELETE' }), 'Option group deleted.')}>Delete</button>
              </div>}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Options</h3>
              {group.options.map((groupOption) => (
                <div key={groupOption.optionId} className="rounded border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{groupOption.option.name} <span className="text-xs text-slate-700">(order {groupOption.displayOrder})</span></span>
                    {canManage && <button className="rounded border px-2 py-1 text-sm" onClick={() => groupAction(group.id, () => api(`/catalogue/option-groups/${group.id}/options/${groupOption.optionId}`, { method: 'DELETE' }), 'Option removed.')}>Remove</button>}
                  </div>
                  {group.sizes.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {group.sizes.map(({ portionSize }) => {
                        const key = `${group.id}:${groupOption.optionId}:${portionSize.id}`;
                        const existing = groupOption.sizePrices.find((item) => item.portionSizeId === portionSize.id);
                        const value = charges[key] ?? String(existing?.extraCharge ?? '');
                        return <label key={key} className="text-sm">{portionSize.name} extra charge
                          <span className="mt-1 flex gap-2"><input type="number" min="0" step="0.01" className="min-w-0 flex-1 rounded border px-2 py-1" value={value} onChange={(e) => setCharges({ ...charges, [key]: e.target.value })} />
                            {canManage && <button type="button" className="rounded border px-2" onClick={() => groupAction(group.id, () => api(`/catalogue/option-groups/${group.id}/options/${groupOption.optionId}/pricing`, patchBody({ portionSizeId: portionSize.id, extraCharge: Number(value) })), 'Extra charge saved.')}>Save</button>}
                          </span>
                        </label>;
                      })}
                    </div>
                  )}
                </div>
              ))}
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <select aria-label="Select option" className="rounded border px-2 py-2" value={selectedOption} onChange={(e) => setSelectedOption(e.target.value)}><option value="">Select option</option>{refs.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
                  <label className="sr-only" htmlFor={`order-${group.id}`}>Display order</label>
                  <input id={`order-${group.id}`} aria-label="Option display order" type="number" min="0" className="w-24 rounded border px-2 py-2" value={optionOrders[group.id] ?? '0'} onChange={(e) => setOptionOrders({ ...optionOrders, [group.id]: e.target.value })} />
                  <button className="rounded border px-3 py-2" disabled={!selectedOption} onClick={() => groupAction(group.id, () => api(`/catalogue/option-groups/${group.id}/options`, jsonBody({ optionId: selectedOption, displayOrder: Number(optionOrders[group.id] ?? 0) })), 'Option added.')}>Add option</button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Portion sizes</h3>
              <div className="flex flex-wrap gap-2">
                {group.sizes.map(({ portionSize }) => <span key={portionSize.id} className="rounded border px-2 py-1 text-sm">{portionSize.name}{canManage && <button className="ml-2 text-red-800" aria-label={`Remove ${portionSize.name}`} onClick={() => groupAction(group.id, () => api(`/catalogue/option-groups/${group.id}/sizes/${portionSize.id}`, { method: 'DELETE' }), 'Portion size removed.')}>×</button>}</span>)}
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <select aria-label="Select portion size" className="rounded border px-2 py-2" value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)}><option value="">Select size</option>{refs.portionSizes.map((size) => <option key={size.id} value={size.id}>{size.name}</option>)}</select>
                  <button className="rounded border px-3 py-2" disabled={!selectedSize} onClick={() => groupAction(group.id, () => api(`/catalogue/option-groups/${group.id}/sizes`, jsonBody({ portionSizeId: selectedSize })), 'Portion size added.')}>Add size</button>
                </div>
              )}
            </div>
          </article>
        ))}
        {!dish.optionGroups.length && <p className="rounded border bg-white p-4 text-slate-700">This dish has no option groups yet.</p>}
      </section>
    </section>
  );
}
