'use client';

import { useState, useEffect } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Textarea,
  Field,
} from '@/components/ui';
import { useApi, useRefresh } from '@/lib/client/hooks';
import { api, ApiClientError } from '@/lib/client/api';
import type { Customer, SessionUser } from '@/lib/types';

export default function PortalProfilePage() {
  const refresh = useRefresh();
  const { data: me } = useApi<SessionUser>('/me');
  const { data: customer, isLoading } = useApi<Customer>(
    me?.customer_id ? `/customers/${me.customer_id}` : null,
  );

  // Profile fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string[]>>({});
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileGlobalError, setProfileGlobalError] = useState<string | null>(null);

  // Password fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string[]>>({});
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordGlobalError, setPasswordGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
    }
  }, [customer]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.customer_id) return;
    setSavingProfile(true);
    setProfileErrors({});
    setProfileSuccess(null);
    setProfileGlobalError(null);

    try {
      await api.patch(`/customers/${me.customer_id}`, {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      setProfileSuccess('Profile updated successfully.');
      refresh(`/customers/${me.customer_id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setProfileErrors(err.fieldErrors);
        setProfileGlobalError(err.message);
      } else {
        setProfileGlobalError('Failed to update profile');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});
    setPasswordSuccess(null);
    setPasswordGlobalError(null);

    if (password !== confirmPassword) {
      setPasswordErrors({ password: ['Passwords do not match'] });
      return;
    }

    setChangingPassword(true);
    try {
      await api.auth.resetPassword(password);
      setPasswordSuccess('Password changed successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPasswordErrors(err.fieldErrors);
        setPasswordGlobalError(err.message);
      } else {
        setPasswordGlobalError('Failed to change password');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (isLoading && !customer) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <Card className="h-96 animate-pulse bg-slate-100"><div className="p-6" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="My profile &amp; security"
        description="Update your contact information and change your account password."
      />

      {/* Contact & Billing Information */}
      <Card>
        <CardHeader
          title="Account information"
          description="Your details for invoicing and subscription notifications."
        />
        <CardBody>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileSuccess && (
              <div className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">
                {profileSuccess}
              </div>
            )}
            {profileGlobalError && (
              <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
                {profileGlobalError}
              </div>
            )}

            <Field label="Full name" required error={profileErrors.name}>
              {(id) => (
                <Input
                  id={id}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
            </Field>

            <Field label="Email address" hint="Email address is linked to your login and cannot be modified here.">
              {(id) => (
                <Input
                  id={id}
                  value={customer?.email || me?.email || ''}
                  disabled
                  className="bg-slate-50 text-slate-500 cursor-not-allowed font-mono text-xs"
                />
              )}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Phone number" error={profileErrors.phone}>
                {(id) => (
                  <Input
                    id={id}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                )}
              </Field>

              <Field label="GSTIN" hint="Contact support to update your tax registration">
                {(id) => (
                  <Input
                    id={id}
                    value={customer?.gstin || ''}
                    disabled
                    className="bg-slate-50 text-slate-500 cursor-not-allowed font-mono text-xs"
                  />
                )}
              </Field>
            </div>

            <Field label="Billing address" error={profileErrors.address}>
              {(id) => (
                <Textarea
                  id={id}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, State, PIN code"
                  rows={2}
                />
              )}
            </Field>

            <div className="pt-2">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Security & Password */}
      <Card>
        <CardHeader
          title="Change password"
          description="Ensure your password is at least 9 characters with uppercase, lowercase, and a special character."
        />
        <CardBody>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordSuccess && (
              <div className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">
                {passwordSuccess}
              </div>
            )}
            {passwordGlobalError && (
              <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
                {passwordGlobalError}
              </div>
            )}

            <Field
              label="New password"
              required
              error={passwordErrors.password}
              hint="Must have at least 9 characters, uppercase, lowercase and special character."
            >
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}
            </Field>

            <Field label="Confirm new password" required>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              )}
            </Field>

            <div className="pt-2">
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? 'Updating...' : 'Update password'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
