'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type ReferenceItem = { id: string; name: string; active?: boolean; displayOrder?: number };
type ReferenceSet = { stations: ReferenceItem[]; allergens: ReferenceItem[]; dietaryTags: ReferenceItem[]; portionSizes: ReferenceItem[] };

const emptySet: ReferenceSet = { stations: [], allergens: [], dietaryTags: [], portionSizes: [] };

export default function ReferencePage() {
  const [data, setData] = useState<ReferenceSet>(emptySet);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<ReferenceItem[]>('/reference/stations'),
      api<ReferenceItem[]>('/reference/allergens'),
      api<ReferenceItem[]>('/reference/dietary-tags'),
      api<ReferenceItem[]>('/reference/portion-sizes'),
    ]).then(([stations, allergens, dietaryTags, portionSizes]) => {
      setData({ stations, allergens, dietaryTags, portionSizes });
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Unable to load reference data');
    });
  }, []);

  const lists: Array<[string, ReferenceItem[]]> = [
    ['Stations', data.stations],
    ['Allergens', data.allergens],
    ['Dietary tags', data.dietaryTags],
    ['Portion sizes', data.portionSizes],
  ];

  return (
    <section className="space-y-5">
      <div><h1 className="text-2xl font-bold">Reference data</h1><p className="mt-1 text-sm text-slate-800">Read-only view of the reference endpoints used by catalogue forms.</p></div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {lists.map(([title, items]) => (
          <article key={title} className="rounded border bg-white p-4">
            <h2 className="font-semibold">{title} <span className="text-sm font-normal text-slate-700">({items.length})</span></h2>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((item) => <li key={item.id} className="flex justify-between gap-3 border-t pt-2"><span>{item.name}</span><span className="text-slate-700">{item.active === undefined ? '' : item.active ? 'Active' : 'Inactive'}{item.displayOrder === undefined ? '' : ` · order ${item.displayOrder}`}</span></li>)}
              {!items.length && <li className="text-slate-700">No records.</li>}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
