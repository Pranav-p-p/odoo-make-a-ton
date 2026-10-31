'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { useApiList, useRefresh } from '@/lib/client/hooks';
import { Button, Input, Field, Badge, Dialog, PageHeader } from '@/components/ui';
import type { Tax, PaymentTerm } from '@/lib/types';

// ── Inline row editor for taxes ──────────────────────────────────────────────

function TaxRow({ tax, isAdmin, onSaved }: { tax: Tax; isAdmin: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tax.name);
  const [rate, setRate] = useState(String(tax.rate_percent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/taxes/${tax.id}`, { name: name.trim(), rate_percent: Number(rate) });
      onSaved();
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!confirm(`Archive "${tax.name}"?`)) return;
    try {
      await api.patch(`/taxes/${tax.id}`, { is_active: false });
      onSaved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Archive failed');
    }
  }

  if (editing) {
    return (
      <tr className="bg-brand-50">
        <td className="px-4 py-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" autoFocus />
        </td>
        <td className="px-4 py-2">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="h-8 w-24 text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <Badge tone="green">Active</Badge>
        </td>
        <td className="px-4 py-2 text-right">
          {error && <span className="mr-2 text-xs text-red-600">{error}</span>}
          <Button size="sm" onClick={save} loading={saving}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(tax.name); setRate(String(tax.rate_percent)); }} className="ml-1">Cancel</Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={tax.is_active ? '' : 'opacity-50'}>
      <td className="px-4 py-2.5 text-sm text-slate-800">{tax.name}</td>
      <td className="px-4 py-2.5 text-sm text-slate-800">{tax.rate_percent}%</td>
      <td className="px-4 py-2.5">
        <Badge tone={tax.is_active ? 'green' : 'gray'}>{tax.is_active ? 'Active' : 'Archived'}</Badge>
      </td>
      <td className="px-4 py-2.5 text-right">
        {isAdmin && (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
            {tax.is_active && (
              <Button size="sm" variant="ghost" onClick={archive} className="text-red-600 hover:text-red-700">Archive</Button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Inline row editor for payment terms ──────────────────────────────────────

function TermRow({ term, isAdmin, onSaved }: { term: PaymentTerm; isAdmin: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(term.name);
  const [days, setDays] = useState(String(term.days));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/payment-terms/${term.id}`, { name: name.trim(), days: Number(days) });
      onSaved();
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!confirm(`Archive "${term.name}"?`)) return;
    try {
      await api.patch(`/payment-terms/${term.id}`, { is_active: false });
      onSaved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Archive failed');
    }
  }

  if (editing) {
    return (
      <tr className="bg-brand-50">
        <td className="px-4 py-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" autoFocus />
        </td>
        <td className="px-4 py-2">
          <Input
            type="number"
            min={0}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="h-8 w-20 text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <Badge tone="green">Active</Badge>
        </td>
        <td className="px-4 py-2 text-right">
          {error && <span className="mr-2 text-xs text-red-600">{error}</span>}
          <Button size="sm" onClick={save} loading={saving}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(term.name); setDays(String(term.days)); }} className="ml-1">Cancel</Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={term.is_active ? '' : 'opacity-50'}>
      <td className="px-4 py-2.5 text-sm text-slate-800">{term.name}</td>
      <td className="px-4 py-2.5 text-sm text-slate-800">{term.days === 0 ? 'Immediate' : `Net ${term.days}`}</td>
      <td className="px-4 py-2.5">
        <Badge tone={term.is_active ? 'green' : 'gray'}>{term.is_active ? 'Active' : 'Archived'}</Badge>
      </td>
      <td className="px-4 py-2 text-right">
        {isAdmin && (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
            {term.is_active && (
              <Button size="sm" variant="ghost" onClick={archive} className="text-red-600 hover:text-red-700">Archive</Button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Add Tax dialog ────────────────────────────────────────────────────────────

function AddTaxDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.post('/taxes', { name: name.trim(), rate_percent: Number(rate) });
      setName('');
      setRate('');
      onSaved();
      onClose();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'fieldErrors' in e) {
        setErrors((e as { fieldErrors: Record<string, string[]> }).fieldErrors);
      } else {
        setErrors({ _: [e instanceof Error ? e.message : 'Save failed'] });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add tax"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-tax-form" loading={saving}>Add tax</Button>
        </>
      }
    >
      <form id="add-tax-form" onSubmit={submit} className="space-y-4">
        {errors._ && <p className="text-sm text-red-600">{errors._[0]}</p>}
        <Field label="Name" required error={errors.name}>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GST 18%"
              aria-invalid={!!errors.name}
            />
          )}
        </Field>
        <Field label="Rate (%)" required error={errors.rate_percent} hint="0 to 100">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="18"
              aria-invalid={!!errors.rate_percent}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

// ── Add Payment Term dialog ───────────────────────────────────────────────────

function AddTermDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [days, setDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.post('/payment-terms', { name: name.trim(), days: Number(days) });
      setName('');
      setDays('');
      onSaved();
      onClose();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'fieldErrors' in e) {
        setErrors((e as { fieldErrors: Record<string, string[]> }).fieldErrors);
      } else {
        setErrors({ _: [e instanceof Error ? e.message : 'Save failed'] });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add payment term"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-term-form" loading={saving}>Add term</Button>
        </>
      }
    >
      <form id="add-term-form" onSubmit={submit} className="space-y-4">
        {errors._ && <p className="text-sm text-red-600">{errors._[0]}</p>}
        <Field label="Name" required error={errors.name}>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Net 30"
              aria-invalid={!!errors.name}
            />
          )}
        </Field>
        <Field label="Days" required error={errors.days} hint="0 = immediate payment">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="30"
              aria-invalid={!!errors.days}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

// ── Shared table wrapper ──────────────────────────────────────────────────────

function SettingsTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-medium text-slate-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {children}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage({ isAdmin }: { isAdmin?: boolean }) {
  const adminMode = isAdmin !== false; // default true in client component; the server page passes the real role
  const [showArchived, setShowArchived] = useState(false);
  const [addTaxOpen, setAddTaxOpen] = useState(false);
  const [addTermOpen, setAddTermOpen] = useState(false);

  const refresh = useRefresh();
  const { data: taxData, isLoading: taxLoading } = useApiList<Tax>('/taxes', { page_size: 100, active: showArchived ? 'all' : 'true' });
  const { data: termData, isLoading: termLoading } = useApiList<PaymentTerm>('/payment-terms', { page_size: 100, active: showArchived ? 'all' : 'true' });

  const taxes = taxData?.data ?? [];
  const terms = termData?.data ?? [];

  function onTaxSaved() { refresh('/taxes'); }
  function onTermSaved() { refresh('/payment-terms'); }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Taxes &amp; Payment Terms"
        description="Configure the tax rates and payment terms used across plans and subscriptions."
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        }
      />

      {/* Taxes ---------------------------------------------------------------- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Taxes</h2>
          {adminMode && (
            <Button size="sm" variant="secondary" onClick={() => setAddTaxOpen(true)}>+ Add tax</Button>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          {taxLoading && !taxData ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : taxes.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No taxes yet.</div>
          ) : (
            <SettingsTable headers={['Name', 'Rate', 'Status', '']}>
              {taxes.map((tax) => (
                <TaxRow key={tax.id} tax={tax} isAdmin={adminMode} onSaved={onTaxSaved} />
              ))}
            </SettingsTable>
          )}
        </div>
      </section>

      {/* Payment Terms -------------------------------------------------------- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Payment Terms</h2>
          {adminMode && (
            <Button size="sm" variant="secondary" onClick={() => setAddTermOpen(true)}>+ Add term</Button>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          {termLoading && !termData ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : terms.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No payment terms yet.</div>
          ) : (
            <SettingsTable headers={['Name', 'Due', 'Status', '']}>
              {terms.map((term) => (
                <TermRow key={term.id} term={term} isAdmin={adminMode} onSaved={onTermSaved} />
              ))}
            </SettingsTable>
          )}
        </div>
      </section>

      <AddTaxDialog open={addTaxOpen} onClose={() => setAddTaxOpen(false)} onSaved={onTaxSaved} />
      <AddTermDialog open={addTermOpen} onClose={() => setAddTermOpen(false)} onSaved={onTermSaved} />
    </div>
  );
}

