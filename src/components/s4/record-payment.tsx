'use client';

// S4 owns this component. This stub lets S3's invoice detail compile.
// S4 will replace this file with the full implementation.

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { money } from '@/lib/format';
import { Button, Dialog, Field, Input, Select } from '@/components/ui';
import type { PaymentMethod } from '@/lib/types';

interface RecordPaymentProps {
  invoiceId: string;
  amountDue: number;
  onSuccess?: () => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
];

export function RecordPayment({ invoiceId, amountDue, onSuccess }: RecordPaymentProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(amountDue));
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setAmount(String(amountDue));
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/invoices/${invoiceId}/payments`, {
        amount: parseFloat(amount),
        method,
        paid_on: paidOn,
        note: note.trim() || undefined,
      });
      setOpen(false);
      onSuccess?.();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={openDialog}>
        Record payment
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Record payment"
        description={`Balance due: ${money(amountDue)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} loading={saving}>
              Save payment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Amount (₹)" required>
            {(id) => (
              <Input
                id={id}
                type="number"
                step="0.01"
                min="0.01"
                max={amountDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </Field>
          <Field label="Payment method" required>
            {(id) => (
              <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Payment date" required>
            {(id) => (
              <Input
                id={id}
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            )}
          </Field>
          <Field label="Note">
            {(id) => (
              <Input
                id={id}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional reference or note"
              />
            )}
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}

