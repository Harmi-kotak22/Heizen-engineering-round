'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, can, getCurrentUser, jsonBody, patchBody, type SessionUser } from '../../../lib/api';

type EmployeeChoice = { id: string; name: string; email: string; active: boolean };
type Company = {
  id: string;
  name: string;
  active: boolean;
  billingContactName: string | null;
  billingContactEmail: string | null;
  billingContactPhone: string | null;
  priceTierId: string | null;
  ownerEmployeeId: string | null;
  defaultDriverId: string | null;
  defaultDeliveryTime: string | null;
  deliveryLeadMinutes: number;
  defaultPackaging: string | null;
  driverInstructions: string | null;
  mondayEnabled: boolean;
  tuesdayEnabled: boolean;
  wednesdayEnabled: boolean;
  thursdayEnabled: boolean;
  fridayEnabled: boolean;
  saturdayEnabled: boolean;
  sundayEnabled: boolean;
  emailDomains: { id: string; domain: string }[];
  addresses: Address[];
  holidays: { id: string; date: string; name: string }[];
};
type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  active: boolean;
};
type Tier = { id: string; name: string };
type Form = Omit<Company, 'id' | 'emailDomains' | 'addresses' | 'holidays'>;
const dayFields = [
  ['mondayEnabled', 'Monday'],
  ['tuesdayEnabled', 'Tuesday'],
  ['wednesdayEnabled', 'Wednesday'],
  ['thursdayEnabled', 'Thursday'],
  ['fridayEnabled', 'Friday'],
  ['saturdayEnabled', 'Saturday'],
  ['sundayEnabled', 'Sunday'],
] as const;
const blankAddress = { label: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'USA' };

export default function CompanyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const [companyId, setCompanyId] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [employees, setEmployees] = useState<EmployeeChoice[]>([]);
  const [drivers, setDrivers] = useState<EmployeeChoice[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [domain, setDomain] = useState('');
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const [addressDraft, setAddressDraft] = useState(blankAddress);
  const [editingAddressId, setEditingAddressId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const manage = can(user, 'companies.manage');

  const load = useCallback(async (id: string) => {
    const result = await api<Company>(`/companies/${id}`);
    setCompany(result);
    setForm({
      name: result.name,
      active: result.active,
      billingContactName: result.billingContactName,
      billingContactEmail: result.billingContactEmail,
      billingContactPhone: result.billingContactPhone,
      priceTierId: result.priceTierId,
      ownerEmployeeId: result.ownerEmployeeId,
      defaultDriverId: result.defaultDriverId,
      defaultDeliveryTime: result.defaultDeliveryTime,
      deliveryLeadMinutes: result.deliveryLeadMinutes,
      defaultPackaging: result.defaultPackaging,
      driverInstructions: result.driverInstructions,
      mondayEnabled: result.mondayEnabled,
      tuesdayEnabled: result.tuesdayEnabled,
      wednesdayEnabled: result.wednesdayEnabled,
      thursdayEnabled: result.thursdayEnabled,
      fridayEnabled: result.fridayEnabled,
      saturdayEnabled: result.saturdayEnabled,
      sundayEnabled: result.sundayEnabled,
    });
  }, []);

  useEffect(() => {
    void params.then(({ id }) => {
      setCompanyId(id);
      load(id).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load company'));
      api<{ data: EmployeeChoice[] }>('/employees?limit=100&companyId=' + id)
        .then((result) => setEmployees(result.data))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load employees'));
      api<EmployeeChoice[]>('/companies/drivers').then(setDrivers)
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load drivers'));
      getCurrentUser().then((currentUser) => {
        setUser(currentUser);
        if (currentUser.permissions.includes('pricing.read')) {
          api<Tier[]>('/pricing/tiers').then(setTiers)
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load pricing tiers'));
        }
      }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load session'));
    });
  }, [load, params]);

  async function saveCompany() {
    if (!form) return;
    setError('');
    setNotice('');
    try {
      await api(`/companies/${companyId}`, patchBody(form));
      await load(companyId);
      setNotice('Company details saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save company');
    }
  }

  async function addDomain() {
    setError('');
    try {
      await api(`/companies/${companyId}/domains`, jsonBody({ domain }));
      setDomain('');
      await load(companyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add email domain');
    }
  }

  async function removeDomain(domainId: string) {
    setError('');
    try {
      await api(`/companies/${companyId}/domains/${domainId}`, { method: 'DELETE' });
      await load(companyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove email domain');
    }
  }

  async function saveAddress() {
    setError('');
    try {
      await api(
        editingAddressId
          ? `/companies/${companyId}/addresses/${editingAddressId}`
          : `/companies/${companyId}/addresses`,
        editingAddressId ? patchBody(addressDraft) : jsonBody(addressDraft),
      );
      setAddressDraft(blankAddress);
      setEditingAddressId('');
      await load(companyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save address');
    }
  }

  async function toggleAddress(address: Address) {
    setError('');
    try {
      await api(`/companies/${companyId}/addresses/${address.id}/status`, patchBody({ active: !address.active }));
      await load(companyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update address');
    }
  }

  async function addHoliday() {
    setError('');
    try {
      await api(`/companies/${companyId}/holidays`, jsonBody(holiday));
      setHoliday({ date: '', name: '' });
      await load(companyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add holiday');
    }
  }

  async function removeHoliday(id: string) {
    setError('');
    try {
      await api(`/companies/${companyId}/holidays/${id}`, { method: 'DELETE' });
      await load(companyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove holiday');
    }
  }

  if (!company || !form) return <p>{error || 'Loading company…'}</p>;

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{company.name}</h1><p className="text-sm text-slate-700">{company.active ? 'Active' : 'Inactive'}</p></div>
        <button disabled={!manage} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" onClick={saveCompany}>Save company</button>
      </div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}

      <section className="grid gap-4 rounded border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Company name<input disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
        <label className="text-sm">Billing contact name<input disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.billingContactName ?? ''} onChange={(event) => update('billingContactName', event.target.value || null)} /></label>
        <label className="text-sm">Billing email<input type="email" disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.billingContactEmail ?? ''} onChange={(event) => update('billingContactEmail', event.target.value || null)} /></label>
        <label className="text-sm">Billing phone<input disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.billingContactPhone ?? ''} onChange={(event) => update('billingContactPhone', event.target.value || null)} /></label>
        <label className="text-sm">Price tier<select disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.priceTierId ?? ''} onChange={(event) => update('priceTierId', event.target.value || null)}><option value="">Use default pricing tier</option>{tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
        <label className="text-sm">Company owner<select disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.ownerEmployeeId ?? ''} onChange={(event) => update('ownerEmployeeId', event.target.value || null)}><option value="">No owner</option>{employees.filter((employee) => employee.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        <label className="text-sm">Default driver<select disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.defaultDriverId ?? ''} onChange={(event) => update('defaultDriverId', event.target.value || null)}><option value="">No default driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
        <label className="text-sm">Default delivery time<input type="time" disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.defaultDeliveryTime ?? ''} onChange={(event) => update('defaultDeliveryTime', event.target.value || null)} /></label>
        <label className="text-sm">Leave-before minutes<input type="number" min="0" disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.deliveryLeadMinutes} onChange={(event) => update('deliveryLeadMinutes', Number(event.target.value))} /></label>
        <label className="text-sm">Default packaging<input disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.defaultPackaging ?? ''} onChange={(event) => update('defaultPackaging', event.target.value || null)} /></label>
        <label className="text-sm sm:col-span-2">Driver instructions<textarea disabled={!manage} className="mt-1 block w-full rounded border px-3 py-2" value={form.driverInstructions ?? ''} onChange={(event) => update('driverInstructions', event.target.value || null)} /></label>
        <fieldset className="sm:col-span-2 lg:col-span-3">
          <legend className="text-sm font-medium">Delivery working days</legend>
          <div className="mt-2 flex flex-wrap gap-4">{dayFields.map(([field, label]) => <label key={field} className="flex items-center gap-2 text-sm"><input disabled={!manage} type="checkbox" checked={form[field]} onChange={(event) => update(field, event.target.checked)} />{label}</label>)}</div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input disabled={!manage} type="checkbox" checked={form.active} onChange={(event) => update('active', event.target.checked)} />Company active</label>
      </section>

      <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">Email domains</h2>
        <div className="flex flex-wrap gap-2">{company.emailDomains.map((item) => <span key={item.id} className="flex items-center gap-2 rounded bg-slate-100 px-3 py-1 text-sm">{item.domain}{manage && <button aria-label={`Remove ${item.domain}`} onClick={() => removeDomain(item.id)}>×</button>}</span>)}</div>
        {manage && <div className="flex gap-2"><input className="rounded border px-3 py-2" placeholder="example.com" value={domain} onChange={(event) => setDomain(event.target.value)} /><button className="rounded border px-3 py-2" onClick={addDomain}>Add domain</button></div>}
      </section>

      <section className="space-y-4 rounded border bg-white p-4">
        <h2 className="font-semibold">Addresses</h2>
        {company.addresses.map((address) => (
          <article key={address.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 text-sm">
            <div><p className="font-medium">{address.label} · {address.active ? 'Active' : 'Inactive'}</p><p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postalCode}, {address.country}</p></div>
            {manage && <div className="flex gap-2"><button className="rounded border px-2 py-1" onClick={() => { setEditingAddressId(address.id); setAddressDraft({ label: address.label, line1: address.line1, line2: address.line2 ?? '', city: address.city, state: address.state, postalCode: address.postalCode, country: address.country }); }}>Edit</button><button className="rounded border px-2 py-1" onClick={() => toggleAddress(address)}>{address.active ? 'Deactivate' : 'Activate'}</button></div>}
          </article>
        ))}
        {manage && <div className="grid gap-2 sm:grid-cols-3">{Object.keys(blankAddress).map((field) => <label key={field} className="text-sm capitalize">{field}<input className="mt-1 block w-full rounded border px-2 py-2" value={addressDraft[field as keyof typeof blankAddress]} onChange={(event) => setAddressDraft((current) => ({ ...current, [field]: event.target.value }))} /></label>)}<div className="flex items-end gap-2"><button className="rounded border px-3 py-2" onClick={saveAddress}>{editingAddressId ? 'Save address' : 'Add address'}</button>{editingAddressId && <button className="rounded border px-3 py-2" onClick={() => { setEditingAddressId(''); setAddressDraft(blankAddress); }}>Cancel</button>}</div></div>}
      </section>

      <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">Company holidays</h2>
        {company.holidays.map((item) => <div key={item.id} className="flex items-center justify-between border-b py-2 text-sm"><span>{item.date.slice(0, 10)} · {item.name}</span>{manage && <button className="rounded border px-2 py-1" onClick={() => removeHoliday(item.id)}>Remove</button>}</div>)}
        {manage && <div className="flex flex-wrap gap-2"><input type="date" className="rounded border px-3 py-2" value={holiday.date} onChange={(event) => setHoliday((value) => ({ ...value, date: event.target.value }))} /><input className="rounded border px-3 py-2" placeholder="Holiday name" value={holiday.name} onChange={(event) => setHoliday((value) => ({ ...value, name: event.target.value }))} /><button className="rounded border px-3 py-2" onClick={addHoliday}>Add holiday</button></div>}
      </section>
    </section>
  );
}
