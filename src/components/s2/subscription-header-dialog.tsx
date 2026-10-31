'use client';

import { useState, useEffect } from 'react';
import { Dialog, Button, Input, Select, Textarea, Field } from '@/components/ui';
import { api, ApiClientError } from '@/lib/client/api';
import type { Subscription, PaymentTerm } from '@/lib/types';

interface HeaderDialogProps {
  open: boolean;
  onClose: () => void;
  subscription: Subscription;
  paymentTerms: PaymentTerm[];
  onSuccess: () => void;
}

export function SubscriptionHeaderDialog({
  open,
  onClose,
  subscription,
  paymentTerms,
  onSuccess,
}: HeaderDialogProps) {
  const [startDate, setStartDate] = useState(subscription.start_date || '');
  const [expiryDate, setExpiryDate] = useState(subscription.expiry_date || '');
  const [paymentTermId, setPaymentTermId] = useState(subscription.payment_term_id || '');
  const [notes, setNotes] = useState(subscription.notes || '');

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    setStartDate(subscription.start_date || '');
    setExpiryDate(subscription.expiry_date || '');
    setPaymentTermId(subscription.payment_term_id || '');
    setNotes(subscription.notes || '');
    setErrors({});
    setGlobalError(null);
  }, [subscription, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGlobalError(null);

    try {
      await api.patch(`/subscriptions/${subscription.id}`, {
        start_date: startDate,
        expiry_date: expiryDate || null,
        payment_term_id: paymentTermId || null,
        notes: notes || null,
      });
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setGlobalError(err.message);
      } else {
        setGlobalError('Failed to update subscription');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit subscription header"
      description="Update dates, payment terms and quotation notes"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="header-form" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="header-form" onSubmit={handleSubmit} className="space-y-4">
        {globalError && (
          <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">
            {globalError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" required error={errors.start_date}>
            {(id) => (
              <Input
                id={id}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            )}
          </Field>

          <Field label="Expiry date" error={errors.expiry_date}>
            {(id) => (
              <Input
                id={id}
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Payment terms" error={errors.payment_term_id}>
          {(id) => (
            <Select
              id={id}
              value={paymentTermId}
              onChange={(e) => setPaymentTermId(e.target.value)}
            >
              <option value="">No terms (default)</option>
              {paymentTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.days} days)
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Notes" error={errors.notes}>
          {(id) => (
            <Textarea
              id={id}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal quotation or delivery notes..."
              rows={2}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
