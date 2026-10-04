'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, can, getCurrentUser, jsonBody, patchBody, type PaginatedResponse, type SessionUser } from '../../../lib/api';

type Category = { id: string; name: string; displayOrder: number; active: boolean; secret: boolean };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [name, setName] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await api<PaginatedResponse<Category>>(`/catalogue/categories?page=${page}&limit=20`);
      setCategories(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load categories');
    }
  }, [page]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void load();
      getCurrentUser().then(setUser).catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load current user');
      });
    });
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await api('/catalogue/categories', jsonBody({ name, displayOrder: Number(displayOrder) }));
      setName('');
      setNotice('Category created.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create category');
    }
  }

  async function update(category: Category) {
    setError('');
    setNotice('');
    try {
      await api(`/catalogue/categories/${category.id}`, patchBody({
        name: category.name,
        displayOrder: category.displayOrder,
        secret: category.secret,
      }));
      setNotice('Category updated.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update category');
    }
  }

  async function toggle(category: Category) {
    setError('');
    setNotice('');
    try {
      await api(`/catalogue/categories/${category.id}/status`, patchBody({ active: !category.active }));
      setNotice('Category status updated.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change category status');
    }
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Categories</h1>
      <p className="text-sm text-slate-800">Permission required: catalogue.read to list, catalogue.manage to edit.</p>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}

      {can(user, 'catalogue.manage') && (
        <form onSubmit={create} className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
          <label className="text-sm">Name<input className="mt-1 block rounded border px-3 py-2" required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="text-sm">Display order<input className="mt-1 block w-28 rounded border px-3 py-2" type="number" min="0" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} /></label>
          <button className="rounded bg-slate-900 px-4 py-2 text-white">Create category</button>
        </form>
      )}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100"><tr><th className="p-3">Name</th><th className="p-3">Order</th><th className="p-3">Secret</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-t">
                <td className="p-3"><input disabled={!can(user, 'catalogue.manage')} aria-label={`${category.name} name`} className="rounded border px-2 py-1 disabled:bg-slate-100" value={category.name} onChange={(e) => setCategories((items) => items.map((item) => item.id === category.id ? { ...item, name: e.target.value } : item))} /></td>
                <td className="p-3"><input disabled={!can(user, 'catalogue.manage')} aria-label={`${category.name} order`} className="w-20 rounded border px-2 py-1 disabled:bg-slate-100" type="number" min="0" value={category.displayOrder} onChange={(e) => setCategories((items) => items.map((item) => item.id === category.id ? { ...item, displayOrder: Number(e.target.value) } : item))} /></td>
                <td className="p-3"><input disabled={!can(user, 'catalogue.manage')} aria-label={`${category.name} secret`} type="checkbox" checked={category.secret} onChange={(e) => setCategories((items) => items.map((item) => item.id === category.id ? { ...item, secret: e.target.checked } : item))} /></td>
                <td className="p-3">{category.active ? 'Active' : 'Inactive'}</td>
                <td className="flex gap-2 p-3">
                  {can(user, 'catalogue.manage') && <>
                    <button className="rounded border px-2 py-1" onClick={() => update(category)}>Save</button>
                    <button className="rounded border px-2 py-1" onClick={() => toggle(category)}>{category.active ? 'Deactivate' : 'Activate'}</button>
                  </>}
                </td>
              </tr>
            ))}
            {!categories.length && <tr><td colSpan={5} className="p-4 text-slate-700">No categories found.</td></tr>}
          </tbody>
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
