'use client';

import { useState, useEffect } from 'react';
import { Dialog, Button, Input, Textarea, Field } from '@/components/ui';
import { api, ApiClientError } from '@/lib/client/api';
import type { Customer } from '@/lib/types';

interface CustomerDialogProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSuccess?: (c: Customer) => void;
}

export function CustomerDialog({ open, onClose, customer, onSuccess }: CustomerDialogProps) {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setName(customer.name ?? '');
      setCompanyName(customer.company_name ?? '');
      setEmail(customer.email ?? '');
      setPhone(customer.phone ?? '');
      setAddress(customer.address ?? '');
      setGstin(customer.gstin ?? '');
    } else {
      setName('');
      setCompanyName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setGstin('');
    }
    setErrors({});
    setGlobalError(null);
  }, [customer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGlobalError(null);

    const payload = {
      name: name.trim(),
      company_name: companyName.trim() || null,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      gstin: gstin.trim() || null,
    };

    try {
      let saved: Customer;
      if (customer) {
        saved = await api.patch<Customer>(`/customers/${customer.id}`, payload);
      } else {
        saved = await api.post<Customer>('/customers', payload);
      }
      onSuccess?.(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setGlobalError(err.message);
      } else {
        setGlobalError('An unexpected error occurred');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'New customer'}
      description={customer ? 'Update customer details' : 'Add a new customer to Brightloop'}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" disabled={saving}>
            {saving ? 'Saving...' : customer ? 'Save changes' : 'Create customer'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-3">
        {globalError && (
          <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">
            {globalError}
          </div>
        )}

        <Field label="Full name" required error={errors.name}>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp or John Doe"
              required
            />
          )}
        </Field>

        <Field label="Company name" error={errors.company_name}>
          {(id) => (
            <Input
              id={id}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Industries Ltd."
            />
          )}
        </Field>

        <Field label="Email" required error={errors.email}>
          {(id) => (
            <Input
              id={id}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="billing@example.com"
              required
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" error={errors.phone}>
            {(id) => (
              <Input
                id={id}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            )}
          </Field>
          <Field label="GSTIN" error={errors.gstin}>
            {(id) => (
              <Input
                id={id}
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="27AAAAA0000A1Z5"
              />
            )}
          </Field>
        </div>

        <Field label="Billing address" error={errors.address}>
          {(id) => (
            <Textarea
              id={id}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, State, PIN"
              rows={2}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
