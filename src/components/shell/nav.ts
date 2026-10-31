import type { Role } from '@/lib/types';
import type { IconName } from './icons';

/** Navigation per role (SPEC §5). `slice` = which team slice owns the screen (TASKS.md). Core owns this file. */
export interface NavItem {
  href: string;
  label: string;
  roles: Role[];
  icon: IconName;
  slice: 'Core' | 'S1' | 'S2' | 'S3' | 'S4';
}

export const INTERNAL_NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Overview', items: [{ href: '/app', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'staff'], slice: 'S4' }] },
  {
    section: 'Sales',
    items: [
      { href: '/app/subscriptions', label: 'Subscriptions', icon: 'subscriptions', roles: ['admin', 'staff'], slice: 'S2' },
      { href: '/app/customers', label: 'Customers', icon: 'customers', roles: ['admin', 'staff'], slice: 'S2' },
    ],
  },
  {
    section: 'Billing',
    items: [
      { href: '/app/invoices', label: 'Invoices', icon: 'invoices', roles: ['admin', 'staff'], slice: 'S3' },
      { href: '/app/billing', label: 'Billing runs', icon: 'billing', roles: ['admin', 'staff'], slice: 'S3' },
      { href: '/app/payments', label: 'Payments', icon: 'payments', roles: ['admin', 'staff'], slice: 'S4' },
    ],
  },
  {
    section: 'Setup',
    items: [
      { href: '/app/products', label: 'Products', icon: 'products', roles: ['admin', 'staff'], slice: 'S1' },
      { href: '/app/plans', label: 'Plans', icon: 'plans', roles: ['admin', 'staff'], slice: 'S1' },
      { href: '/app/templates', label: 'Quotation templates', icon: 'templates', roles: ['admin', 'staff'], slice: 'S1' },
      { href: '/app/discounts', label: 'Discount rules', icon: 'discounts', roles: ['admin', 'staff'], slice: 'S1' },
      { href: '/app/settings', label: 'Taxes & payment terms', icon: 'settings', roles: ['admin', 'staff'], slice: 'S1' },
    ],
  },
  { section: 'Admin', items: [{ href: '/app/users', label: 'Users', icon: 'users', roles: ['admin'], slice: 'S2' }] },
];

export const PORTAL_NAV: NavItem[] = [
  { href: '/portal', label: 'My subscriptions', icon: 'subscriptions', roles: ['customer'], slice: 'S2' },
  { href: '/portal/invoices', label: 'My invoices', icon: 'invoices', roles: ['customer'], slice: 'S2' },
  { href: '/portal/profile', label: 'Profile', icon: 'profile', roles: ['customer'], slice: 'S2' },
];
