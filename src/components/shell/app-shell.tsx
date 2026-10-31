'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { api } from '@/lib/client/api';
import type { SessionUser } from '@/lib/types';
import { Badge, Button, cn } from '@/components/ui';
import { INTERNAL_NAV, PORTAL_NAV, type NavItem } from './nav';

function isActive(path: string, href: string) {
  if (href === '/app' || href === '/portal') return path === href;
  return path === href || path.startsWith(href + '/');
}

function NavLink({ item, path, onClick }: { item: NavItem; path: string; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'block rounded-md px-3 py-2 text-sm font-medium',
        isActive(path, item.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      {item.label}
    </Link>
  );
}

export function AppShell({ user, area, children }: { user: SessionUser; area: 'app' | 'portal'; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const logout = async () => {
    setLeaving(true);
    await api.auth.logout().catch(() => undefined);
    router.replace('/login');
    router.refresh();
  };

  const nav =
    area === 'app' ? (
      INTERNAL_NAV.map((group) => {
        const items = group.items.filter((i) => i.roles.includes(user.role));
        if (!items.length) return null;
        return (
          <div key={group.section} className="mb-4">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.section}</p>
            {items.map((i) => (
              <NavLink key={i.href} item={i} path={path} onClick={() => setOpen(false)} />
            ))}
          </div>
        );
      })
    ) : (
      <div>
        {PORTAL_NAV.map((i) => (
          <NavLink key={i.href} item={i} path={path} onClick={() => setOpen(false)} />
        ))}
      </div>
    );

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-200 bg-white px-3 py-4 transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Link href={area === 'app' ? '/app' : '/portal'} className="mb-6 flex items-center gap-2 px-3">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-sm font-bold text-white">B</span>
          <span className="font-semibold text-slate-900">Brightloop</span>
        </Link>
        <nav>{nav}</nav>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 lg:px-8">
          <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <Badge tone={user.role === 'admin' ? 'purple' : user.role === 'staff' ? 'indigo' : 'gray'}>{user.role}</Badge>
            <Button variant="ghost" size="sm" onClick={logout} loading={leaving}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
