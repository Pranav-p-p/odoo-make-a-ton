'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/client/api';
import { errorMessage } from '@/lib/client/errors';
import { money, today, PAYMENT_METHOD_LABEL } from '@/lib/format';
import type { Invoice, PaymentMethod } from '@/lib/types';
import { Dialog, Button, Input, Select, Textarea, Field } from '@/components/ui';

const METHODS: PaymentMethod[] = ['cash', 'bank_transfer', 'card', 'upi', 'cheque'];

/**
 * Record-payment dialog. Used by S3's invoice detail page.
 * Props are stable: do not add or rename without telling the S3 owner.
 */
export function RecordPaymentDialog({
  invoiceId,
  amountDue,
  onDone,
}: {
  invoiceId: string;
  amountDue: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(amountDue));
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [paidOn, setPaidOn] = useState(today());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setAmount(String(amountDue));
    setMethod('');
    setPaidOn(today());
    setNote('');
    setErrors({});
  };

  const handleOpen = () => {
    reset();
    setOpen(true);
  };

  const handleClose = () => {
    if (!saving) setOpen(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const errs: Record<string, string> = {};
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) errs.amount = 'Amount must be more than 0';
    else if (numAmount > amountDue) errs.amount = `Amount cannot exceed the balance of ${money(amountDue)}`;
    if (!method) errs.method = 'Please select a payment method';
    if (!paidOn) errs.paid_on = 'Date is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const updated = await api.post<Invoice>(`/invoices/${invoiceId}/payments`, {
        amount: numAmount,
        method,
        paid_on: paidOn,
        note: note.trim() || undefined,
      });

      const newBalance = updated.amount_due;
      if (newBalance === 0) {
        toast.success('Invoice paid in full');
      } else {
        toast.success(`Payment recorded — balance: ${money(newBalance)}`);
      }
      setOpen(false);
      onDone();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'VALIDATION_ERROR') {
        const fieldErrs: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.fieldErrors)) {
          fieldErrs[k] = Array.isArray(v) ? v[0] : String(v);
        }
        setErrors(fieldErrs);
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={handleOpen} disabled={amountDue <= 0}>
        Record payment
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title="Record payment"
        description={`Balance due: ${money(amountDue)}`}
        footer={
          <>
            <Button variant="ghost" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="record-payment-form" disabled={saving}>
              {saving ? 'Saving…' : 'Record payment'}
            </Button>
          </>
        }
      >
        <form id="record-payment-form" onSubmit={handleSubmit} className="space-y-4">
          <Field label="Amount (₹)" required error={errors.amount}>
            {(id) => (
              <Input
                id={id}
                type="number"
                step="0.01"
                min="0.01"
                max={amountDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!!errors.amount}
                autoFocus
              />
            )}
          </Field>

          <Field label="Method" required error={errors.method}>
            {(id) => (
              <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} aria-invalid={!!errors.method}>
                <option value="">Select method…</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Date" required error={errors.paid_on}>
            {(id) => (
              <Input
                id={id}
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                aria-invalid={!!errors.paid_on}
              />
            )}
          </Field>

          <Field label="Note" error={errors.note}>
            {(id) => (
              <Textarea
                id={id}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note…"
                rows={2}
              />
            )}
          </Field>
        </form>
      </Dialog>
    </>
  );
}
