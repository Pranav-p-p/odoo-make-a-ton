'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/client/api';
import type { SessionUser } from '@/lib/types';
import { Badge, cn } from '@/components/ui';
import { INTERNAL_NAV, PORTAL_NAV, type NavItem } from './nav';
import { LogoMark, NavIcon } from './icons';

function isActive(path: string, href: string) {
  if (href === '/app' || href === '/portal') return path === href;
  return path === href || path.startsWith(href + '/');
}

function initials(name: string | null | undefined, email: string) {
  const src = (name || email).trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function NavLink({ item, path, onClick }: { item: NavItem; path: string; onClick?: () => void }) {
  const active = isActive(path, item.href);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
        active ? 'bg-white/[0.09] text-white' : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-1.5 -left-3 w-[3px] rounded-r-full bg-mint" />}
      <NavIcon
        name={item.icon}
        className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-mint' : 'text-white/40 group-hover:text-white/70')}
      />
      {item.label}
    </Link>
  );
}

export function AppShell({ user, area, children }: { user: SessionUser; area: 'app' | 'portal'; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Close the mobile drawer on navigation and with Escape.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
          <div key={group.section} className="mb-5">
            <p className="px-3 pb-1.5 text-[12px] font-medium text-white/40">{group.section}</p>
            <div className="space-y-0.5">
              {items.map((i) => (
                <NavLink key={i.href} item={i} path={path} />
              ))}
            </div>
          </div>
        );
      })
    ) : (
      <div className="space-y-0.5">
        {PORTAL_NAV.map((i) => (
          <NavLink key={i.href} item={i} path={path} />
        ))}
      </div>
    );

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-spruce-950 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-6">
          <Link href={area === 'app' ? '/app' : '/portal'} className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-mint">
            <LogoMark className="h-8 w-8" />
            <span className="leading-tight">
              <span className="block font-display text-[16px] font-semibold tracking-tight text-white">Brightloop</span>
              <span className="block text-[11px] text-white/45">{area === 'app' ? 'Console' : 'Customer portal'}</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-4">{nav}</nav>

        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint/15 text-xs font-semibold text-mint ring-1 ring-mint/25">
              {initials(user.full_name, user.email)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-medium text-white">{user.full_name || user.email}</span>
              <span className="block truncate text-[11px] text-white/45">{user.email}</span>
            </span>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[1px] lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md lg:px-8">
          <button
            className="-ml-1 grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5" aria-hidden>
              <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
            </svg>
          </button>
          <LogoMark className="h-7 w-7 lg:hidden" />
          <div className="ml-auto flex items-center gap-3">
            <Badge tone={user.role === 'admin' ? 'purple' : user.role === 'staff' ? 'indigo' : 'gray'} className="capitalize">
              {user.role}
            </Badge>
            <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
            <button
              type="button"
              onClick={logout}
              disabled={leaving}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4" aria-hidden>
                <path d="M8 3.5H5A1.5 1.5 0 003.5 5v10A1.5 1.5 0 005 16.5h3M13 13.5l3.5-3.5L13 6.5M16.5 10H8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {leaving ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
