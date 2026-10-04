'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, can, getCurrentUser, jsonBody, patchBody, type PaginatedResponse, type SessionUser } from '../../lib/api';

type Company = { id: string; name: string; active: boolean };
type Reference = { id: string; name: string };
type Employee = {
  id: string;
  companyId: string;
  company: Company;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  canChooseAddress: boolean;
  canChangeDeliveryTime: boolean;
  canChangePackaging: boolean;
  allergies: { allergen: Reference }[];
  dietaryPreferences: { dietaryTag: Reference }[];
};
type Form = {
  companyId: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  canChooseAddress: boolean;
  canChangeDeliveryTime: boolean;
  canChangePackaging: boolean;
  allergenIds: string[];
  dietaryTagIds: string[];
};
const emptyForm: Form = {
  companyId: '',
  name: '',
  email: '',
  phone: '',
  active: true,
  canChooseAddress: false,
  canChangeDeliveryTime: false,
  canChangePackaging: false,
  allergenIds: [],
  dietaryTagIds: [],
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allergens, setAllergens] = useState<Reference[]>([]);
  const [dietaryTags, setDietaryTags] = useState<Reference[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim()) query.set('search', search.trim());
    const result = await api<PaginatedResponse<Employee>>(`/employees?${query}`);
    setEmployees(result.data);
    setTotalPages(Math.max(1, result.pagination.totalPages));
  }, [page, search]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      getCurrentUser().then((currentUser) => {
        setUser(currentUser);
        if (currentUser.permissions.includes('catalogue.read')) {
          api<Reference[]>('/reference/allergens').then(setAllergens).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load allergens'));
          api<Reference[]>('/reference/dietary-tags').then(setDietaryTags).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load dietary preferences'));
        }
      }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load session'));
      load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load employees'));
      api<{ data: Company[] }>('/companies?limit=100').then((result) => setCompanies(result.data)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load companies'));
    });
  }, [load]);

  function beginEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm({
      companyId: employee.companyId,
      name: employee.name,
      email: employee.email,
      phone: employee.phone ?? '',
      active: employee.active,
      canChooseAddress: employee.canChooseAddress,
      canChangeDeliveryTime: employee.canChangeDeliveryTime,
      canChangePackaging: employee.canChangePackaging,
      allergenIds: employee.allergies.map((item) => item.allergen.id),
      dietaryTagIds: employee.dietaryPreferences.map((item) => item.dietaryTag.id),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const payload = {
        ...form,
        phone: form.phone || null,
      };
      if (editingId) {
        const update = {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          active: payload.active,
          canChooseAddress: payload.canChooseAddress,
          canChangeDeliveryTime: payload.canChangeDeliveryTime,
          canChangePackaging: payload.canChangePackaging,
          allergenIds: payload.allergenIds,
          dietaryTagIds: payload.dietaryTagIds,
        };
        await api(`/employees/${editingId}`, patchBody(update));
      } else {
        await api('/employees', jsonBody(payload));
      }
      setForm(emptyForm);
      setEditingId('');
      setNotice(editingId ? 'Employee updated.' : 'Employee created.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save employee');
    }
  }

  async function toggleStatus(employee: Employee) {
    setError('');
    try {
      await api(`/employees/${employee.id}`, patchBody({ active: !employee.active }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update employee status');
    }
  }

  function toggleList(field: 'allergenIds' | 'dietaryTagIds', id: string) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((value) => value !== id)
        : [...current[field], id],
    }));
  }

  const manage = can(user, 'employees.manage');
  return (
    <section className="space-y-5">
      <div><h1 className="text-2xl font-bold">Employees</h1><p className="mt-1 text-sm text-slate-700">Manage company employees and their ordering preferences.</p></div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
      {manage && (
        <form onSubmit={save} className="grid gap-3 rounded border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="font-semibold sm:col-span-2 lg:col-span-3">{editingId ? 'Edit employee' : 'Create employee'}</h2>
          <label className="text-sm">Company<select required disabled={Boolean(editingId)} className="mt-1 block w-full rounded border px-3 py-2 disabled:bg-slate-100" value={form.companyId} onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))}><option value="">Select company</option>{companies.filter((company) => company.active || company.id === form.companyId).map((company) => <option key={company.id} value={company.id}>{company.name}{company.active ? '' : ' (inactive)'}</option>)}</select></label>
          <label className="text-sm">Name<input required className="mt-1 block w-full rounded border px-3 py-2" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="text-sm">Email<input required type="email" className="mt-1 block w-full rounded border px-3 py-2" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label className="text-sm">Phone<input className="mt-1 block w-full rounded border px-3 py-2" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.canChooseAddress} onChange={(event) => setForm((current) => ({ ...current, canChooseAddress: event.target.checked }))} />Can choose address</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.canChangeDeliveryTime} onChange={(event) => setForm((current) => ({ ...current, canChangeDeliveryTime: event.target.checked }))} />Can change delivery time</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.canChangePackaging} onChange={(event) => setForm((current) => ({ ...current, canChangePackaging: event.target.checked }))} />Can change packaging</label>
          {editingId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Active employee</label>}
          <fieldset className="sm:col-span-2 lg:col-span-3"><legend className="text-sm font-medium">Allergies</legend><div className="mt-2 flex flex-wrap gap-4">{allergens.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allergenIds.includes(item.id)} onChange={() => toggleList('allergenIds', item.id)} />{item.name}</label>)}</div></fieldset>
          <fieldset className="sm:col-span-2 lg:col-span-3"><legend className="text-sm font-medium">Dietary preferences</legend><div className="mt-2 flex flex-wrap gap-4">{dietaryTags.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.dietaryTagIds.includes(item.id)} onChange={() => toggleList('dietaryTagIds', item.id)} />{item.name}</label>)}</div></fieldset>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><button className="rounded bg-slate-900 px-4 py-2 text-white">{editingId ? 'Save employee' : 'Create employee'}</button>{editingId && <button type="button" className="rounded border px-4 py-2" onClick={() => { setEditingId(''); setForm(emptyForm); }}>Cancel</button>}</div>
        </form>
      )}
      <label className="block text-sm">Search<input className="mt-1 rounded border bg-white px-3 py-2" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} /></label>
      <div className="space-y-3">
        {employees.map((employee) => <article key={employee.id} className="flex flex-wrap items-center justify-between gap-3 rounded border bg-white p-4">
          <div><h2 className="font-semibold">{employee.name} <span className="font-normal text-slate-600">· {employee.company.name}</span></h2><p className="text-sm text-slate-700">{employee.email} · {employee.active ? 'Active' : 'Inactive'}</p><p className="mt-1 text-xs text-slate-700">Allergies: {employee.allergies.map((item) => item.allergen.name).join(', ') || 'None'} · Dietary: {employee.dietaryPreferences.map((item) => item.dietaryTag.name).join(', ') || 'None'}</p></div>
          {manage && <div className="flex gap-2"><button className="rounded border px-3 py-2 text-sm" onClick={() => beginEdit(employee)}>Edit</button><button className="rounded border px-3 py-2 text-sm" onClick={() => toggleStatus(employee)}>{employee.active ? 'Deactivate' : 'Activate'}</button></div>}
        </article>)}
        {!employees.length && <p className="rounded border bg-white p-4">No employees found.</p>}
      </div>
      <div className="flex items-center justify-between text-sm"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} className="rounded border bg-white px-3 py-1 disabled:opacity-50" onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page >= totalPages} className="rounded border bg-white px-3 py-1 disabled:opacity-50" onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
    </section>
  );
}
