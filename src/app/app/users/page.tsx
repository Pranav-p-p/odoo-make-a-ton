'use client';

import { useState } from 'react';
import {
  PageHeader,
  Card,
  DataTable,
  Button,
  Badge,
  Dialog,
  Input,
  Select,
  Field,
  type Column,
} from '@/components/ui';
import { useApi, useRefresh } from '@/lib/client/hooks';
import { api, ApiClientError } from '@/lib/client/api';
import type { Profile, SessionUser } from '@/lib/types';
import { date } from '@/lib/format';

export default function UsersPage() {
  const refresh = useRefresh();
  const { data: me } = useApi<SessionUser>('/me');
  const { data: users, isLoading, error } = useApi<Profile[]>('/admin/users');

  const [addOpen, setAddOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // If current user is not admin, show forbidden warning
  if (me && me.role !== 'admin') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-800">
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="mt-1 text-sm text-red-600">
          Managing staff and administrator accounts is restricted to system administrators only.
        </p>
      </div>
    );
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGlobalError(null);
    setSuccessInfo(null);

    try {
      const res = await api.post<{ ok: boolean; email_delivered: boolean; dev_reset_link?: string }>('/admin/users', {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
      });

      setSuccessInfo(
        res.email_delivered
          ? `Staff invitation sent to ${email}`
          : `Staff user created. Dev password link: ${res.dev_reset_link ?? 'printed in server console'}`,
      );
      setFullName('');
      setEmail('');
      setRole('staff');
      setAddOpen(false);
      refresh('/admin/users');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setGlobalError(err.message);
      } else {
        setGlobalError('Failed to create staff member');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (profile: Profile) => {
    try {
      await api.patch(`/admin/users/${profile.id}`, {
        is_active: !profile.is_active,
      });
      refresh('/admin/users');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleChangeRole = async (profile: Profile, newRole: 'staff' | 'admin') => {
    try {
      await api.patch(`/admin/users/${profile.id}`, {
        role: newRole,
      });
      refresh('/admin/users');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const columns: Column<Profile>[] = [
    {
      key: 'full_name',
      header: 'Name & Email',
      cell: (r) => (
        <div>
          <div className="font-medium text-slate-900">{r.full_name}</div>
          <div className="font-mono text-xs text-slate-500">{r.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (r) => (
        <Badge tone={r.role === 'admin' ? 'purple' : 'blue'}>
          {r.role === 'admin' ? 'Administrator' : 'Staff'}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (r) => (
        <Badge tone={r.is_active ? 'green' : 'gray'}>
          {r.is_active ? 'Active' : 'Deactivated'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Added on',
      cell: (r) => <span className="text-xs text-slate-500">{date(r.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (r) => {
        const isSelf = me?.id === r.id;
        return (
          <div className="flex items-center gap-2">
            <Select
              value={r.role}
              disabled={isSelf}
              onChange={(e) => handleChangeRole(r, e.target.value as 'staff' | 'admin')}
              className="h-8 text-xs w-28 py-0"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>

            <Button
              variant="secondary"
              size="sm"
              disabled={isSelf}
              onClick={() => handleToggleActive(r)}
              className={r.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}
            >
              {r.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        );
      },
      align: 'right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team &amp; Users"
        description="Manage staff members, assign roles, and control access permissions."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            Add staff member
          </Button>
        }
      />

      {successInfo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          {successInfo}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          Failed to load users: {error.message}
        </div>
      )}

      <Card>
        <DataTable
          rows={users}
          columns={columns}
          loading={isLoading}
          empty="No team members found."
        />
      </Card>

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add team member"
        description="Invite a new staff member or administrator to Brightloop."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button form="add-staff-form" type="submit" disabled={saving}>
              {saving ? 'Inviting...' : 'Send invite'}
            </Button>
          </>
        }
      >
        <form id="add-staff-form" onSubmit={handleAddStaff} className="space-y-3">
          {globalError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">
              {globalError}
            </div>
          )}

          <Field label="Full name" required error={errors.full_name}>
            {(fieldId) => (
              <Input
                id={fieldId}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sarah Connor"
                required
              />
            )}
          </Field>

          <Field label="Email address" required error={errors.email}>
            {(fieldId) => (
              <Input
                id={fieldId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@brightloop.com"
                required
              />
            )}
          </Field>

          <Field label="Role" required error={errors.role}>
            {(fieldId) => (
              <Select
                id={fieldId}
                value={role}
                onChange={(e) => setRole(e.target.value as 'staff' | 'admin')}
              >
                <option value="staff">Staff (Daily operational access)</option>
                <option value="admin">Administrator (Full control, catalog, users)</option>
              </Select>
            )}
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
