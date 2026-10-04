'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  can,
  getCurrentUser,
  jsonBody,
  patchBody,
  type SessionUser,
} from '../../lib/api';

type DerivationType = 'NONE' | 'COST_FACTOR' | 'TIER_PERCENTAGE';
type PriceSource = 'MANUAL' | 'DERIVED' | 'OVERRIDE' | 'MISSING';
type Tier = {
  id: string;
  name: string;
  isDefault: boolean;
  derivationType: DerivationType;
  derivationSourceTierId: string | null;
  derivationFactor: string | null;
};
type CoverageItem = {
  id: string;
  name: string;
  sku?: string;
  costPrice: string | null;
  price: string | null;
  source: PriceSource;
};

function factorAsPercentage(factor: string | null) {
  if (!factor) return '';
  const [whole, fraction = ''] = factor.split('.');
  const percentWhole = `${whole}${fraction.padEnd(2, '0').slice(0, 2)}`
    .replace(/^0+(?=\d)/, '');
  const percentFraction = fraction.slice(2).replace(/0+$/, '');
  return percentFraction ? `${percentWhole}.${percentFraction}` : percentWhole;
}

export default function PricingPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState('');
  const [items, setItems] = useState<CoverageItem[]>([]);
  const [itemType, setItemType] = useState<'dishes' | 'options'>('dishes');
  const [tierName, setTierName] = useState('');
  const [derivationType, setDerivationType] = useState<DerivationType>('NONE');
  const [sourceTierId, setSourceTierId] = useState('');
  const [factor, setFactor] = useState('');
  const [newTierName, setNewTierName] = useState('');
  const [newDerivationType, setNewDerivationType] = useState<DerivationType>('NONE');
  const [newSourceTierId, setNewSourceTierId] = useState('');
  const [newFactor, setNewFactor] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const selectedTierIdRef = useRef('');

  const selectedTier = tiers.find((tier) => tier.id === selectedTierId);
  const canManage = can(user, 'pricing.manage');

  function selectTierDraft(tier: Tier) {
    selectedTierIdRef.current = tier.id;
    setSelectedTierId(tier.id);
    setTierName(tier.name);
    setDerivationType(tier.derivationType);
    setSourceTierId(tier.derivationSourceTierId ?? '');
    setFactor(factorAsPercentage(tier.derivationFactor));
  }

  const loadTiers = useCallback(async () => {
    const response = await api<Tier[]>('/pricing/tiers');
    setTiers(response);
    const selected = response.find((tier) => tier.id === selectedTierIdRef.current)
      ?? response.find((tier) => tier.isDefault)
      ?? response[0];
    if (selected) {
      selectTierDraft(selected);
    }
  }, []);

  const loadCoverage = useCallback(async () => {
    if (!selectedTierId) {
      setItems([]);
      return;
    }
    const response = await api<CoverageItem[]>(
      `/pricing/tiers/${selectedTierId}/${itemType}`,
    );
    setItems(response);
  }, [itemType, selectedTierId]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      getCurrentUser()
        .then(setUser)
        .catch((reason: unknown) =>
          setError(reason instanceof Error ? reason.message : 'Unable to load user'),
        );
      loadTiers().catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Unable to load pricing tiers'),
      );
    });
  }, [loadTiers]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadCoverage().catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Unable to load pricing coverage'),
      );
    });
  }, [loadCoverage]);

  async function createTier(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const created = await api<Tier>(
        '/pricing/tiers',
        jsonBody({
          name: newTierName,
          derivationType: newDerivationType,
          derivationSourceTierId: newDerivationType === 'TIER_PERCENTAGE' ? newSourceTierId : undefined,
          derivationFactor: newDerivationType === 'NONE' ? undefined : newFactor,
        }),
      );
      setNewTierName('');
      setNewDerivationType('NONE');
      setNewSourceTierId('');
      setNewFactor('');
      await loadTiers();
      selectTierDraft(created);
      setNotice('Pricing tier created.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create pricing tier');
    }
  }

  async function saveTier(event: FormEvent) {
    event.preventDefault();
    if (!selectedTier) return;
    setError('');
    setNotice('');
    try {
      await api(
        `/pricing/tiers/${selectedTier.id}`,
        patchBody({
          name: tierName,
          derivationType,
          derivationSourceTierId: derivationType === 'TIER_PERCENTAGE' ? sourceTierId : undefined,
          derivationFactor: derivationType === 'NONE' ? undefined : factor,
        }),
      );
      await loadTiers();
      setNotice('Pricing tier updated.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update pricing tier');
    }
  }

  async function setDefault() {
    if (!selectedTier) return;
    setError('');
    setNotice('');
    try {
      await api(`/pricing/tiers/${selectedTier.id}/default`, patchBody({}));
      await loadTiers();
      setNotice(`${selectedTier.name} is now the default tier.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change default tier');
    }
  }

  async function savePrice(item: CoverageItem, override: boolean) {
    const price = window.prompt(
      `${override ? 'Override' : 'Manual price'} for ${item.name}`,
      item.price ?? '',
    );
    if (price === null) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await api(
        `/pricing/tiers/${selectedTierId}/${itemType}/${item.id}`,
        patchBody({ price, override }),
      );
      await loadCoverage();
      setNotice(`${override ? 'Override' : 'Manual price'} saved for ${item.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save price');
    } finally {
      setLoading(false);
    }
  }

  async function clearPrice(item: CoverageItem) {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await api(
        `/pricing/tiers/${selectedTierId}/${itemType}/${item.id}`,
        { method: 'DELETE' },
      );
      await loadCoverage();
      setNotice(`Price exception cleared for ${item.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to clear price');
    } finally {
      setLoading(false);
    }
  }

  function derivationFields(
    type: DerivationType,
    setType: (value: DerivationType) => void,
    source: string,
    setSource: (value: string) => void,
    value: string,
    setValue: (value: string) => void,
    currentTierId?: string,
  ) {
    return (
      <>
        <label className="text-sm">
          Derivation
          <select
            className="mt-1 block w-full rounded border px-3 py-2"
            value={type}
            onChange={(event) => setType(event.target.value as DerivationType)}
          >
            <option value="NONE">Manual prices</option>
            <option value="COST_FACTOR">Cost multiplier</option>
            <option value="TIER_PERCENTAGE">Another tier + percentage</option>
          </select>
        </label>
        {type === 'TIER_PERCENTAGE' && (
          <label className="text-sm">
            Source tier
            <select
              required
              className="mt-1 block w-full rounded border px-3 py-2"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">Select a source tier</option>
              {tiers
                .filter((tier) => tier.id !== currentTierId)
                .map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
            </select>
          </label>
        )}
        {type !== 'NONE' && (
          <label className="text-sm">
            {type === 'COST_FACTOR' ? 'Cost multiplier' : 'Increase (%)'}
            <input
              required
              inputMode="decimal"
              pattern={type === 'TIER_PERCENTAGE'
                ? '\\d{1,4}(\\.\\d{1,2})?'
                : '\\d{1,4}(\\.\\d{1,4})?'}
              className="mt-1 block w-full rounded border px-3 py-2"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={type === 'COST_FACTOR' ? '2.4' : '15'}
            />
          </label>
        )}
      </>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pricing management</h1>
        <p className="mt-1 text-sm text-slate-700">
          Missing prices stay unavailable; derived prices round upward to the next $0.05.
        </p>
      </div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {notice && <p className="rounded bg-emerald-50 p-3 text-emerald-800">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-4 rounded border bg-white p-4">
          <h2 className="font-semibold">Pricing tiers</h2>
          <label className="block text-sm">
            Selected tier
            <select
              className="mt-1 block w-full rounded border px-3 py-2"
              value={selectedTierId}
              onChange={(event) => {
                const tier = tiers.find((item) => item.id === event.target.value);
                if (tier) selectTierDraft(tier);
              }}
            >
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}{tier.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
          {selectedTier && (
            <>
              <form onSubmit={saveTier} className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Name
                  <input
                    required
                    className="mt-1 block w-full rounded border px-3 py-2"
                    value={tierName}
                    disabled={!canManage}
                    onChange={(event) => setTierName(event.target.value)}
                  />
                </label>
                {derivationFields(
                  derivationType,
                  setDerivationType,
                  sourceTierId,
                  setSourceTierId,
                  factor,
                  setFactor,
                  selectedTier.id,
                )}
                {canManage && <button className="rounded bg-slate-900 px-4 py-2 text-white">Save tier</button>}
              </form>
              <div className="flex items-center gap-3">
                <span className="text-sm">{selectedTier.isDefault ? 'Default tier' : 'Not the default tier'}</span>
                {canManage && !selectedTier.isDefault && (
                  <button onClick={setDefault} className="rounded border px-3 py-2 text-sm">
                    Make default
                  </button>
                )}
              </div>
            </>
          )}
          {canManage && (
            <form onSubmit={createTier} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
              <h3 className="font-medium sm:col-span-2">Create a tier</h3>
              <label className="text-sm">
                Name
                <input
                  required
                  className="mt-1 block w-full rounded border px-3 py-2"
                  value={newTierName}
                  onChange={(event) => setNewTierName(event.target.value)}
                />
              </label>
              {derivationFields(
                newDerivationType,
                setNewDerivationType,
                newSourceTierId,
                setNewSourceTierId,
                newFactor,
                setNewFactor,
              )}
              <button className="rounded border px-4 py-2 sm:col-span-2">Create tier</button>
            </form>
          )}
        </section>

        <section className="space-y-4 rounded border bg-white p-4">
          <h2 className="font-semibold">Tier price coverage</h2>
          <div className="flex gap-2">
            <button
              className={`rounded px-3 py-2 text-sm ${itemType === 'dishes' ? 'bg-slate-900 text-white' : 'border'}`}
              onClick={() => setItemType('dishes')}
            >
              Dishes
            </button>
            <button
              className={`rounded px-3 py-2 text-sm ${itemType === 'options' ? 'bg-slate-900 text-white' : 'border'}`}
              onClick={() => setItemType('options')}
            >
              Options
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-3">Item</th>
                  {itemType === 'dishes' && <th className="py-2 pr-3">SKU</th>}
                  <th className="py-2 pr-3">Cost</th>
                  <th className="py-2 pr-3">Tier price</th>
                  <th className="py-2 pr-3">Source</th>
                  {canManage && <th className="py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={`border-b ${item.source === 'MISSING' ? 'bg-amber-50' : ''}`}>
                    <td className="py-2 pr-3 font-medium">{item.name}</td>
                    {itemType === 'dishes' && <td className="py-2 pr-3">{item.sku}</td>}
                    <td className="py-2 pr-3">{item.costPrice === null ? '—' : `$${item.costPrice}`}</td>
                    <td className="py-2 pr-3 font-mono">
                      {item.price === null ? <span className="font-semibold text-amber-800">MISSING</span> : `$${item.price}`}
                    </td>
                    <td className="py-2 pr-3">{item.source}</td>
                    {canManage && (
                      <td className="space-x-1 py-2 whitespace-nowrap">
                        <button disabled={loading} className="rounded border px-2 py-1" onClick={() => savePrice(item, false)}>Manual</button>
                        <button disabled={loading} className="rounded border px-2 py-1" onClick={() => savePrice(item, true)}>Override</button>
                        {item.source !== 'MISSING' && (
                          <button disabled={loading} className="rounded border px-2 py-1" onClick={() => clearPrice(item)}>Clear</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!items.length && (
                  <tr><td colSpan={canManage ? (itemType === 'dishes' ? 6 : 5) : (itemType === 'dishes' ? 5 : 4)} className="py-4 text-slate-600">No items to display.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
