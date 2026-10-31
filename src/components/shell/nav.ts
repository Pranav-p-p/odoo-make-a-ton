import type { Role } from '@/lib/types';

/** Navigation per role (SPEC §5). `slice` = which team slice owns the screen (TASKS.md). Core owns this file. */
export interface NavItem {
  href: string;
  label: string;
  roles: Role[];
  slice: 'Core' | 'S1' | 'S2' | 'S3' | 'S4';
}

export const INTERNAL_NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Overview', items: [{ href: '/app', label: 'Dashboard', roles: ['admin', 'staff'], slice: 'S4' }] },
  {
    section: 'Sales',
    items: [
      { href: '/app/subscriptions', label: 'Subscriptions', roles: ['admin', 'staff'], slice: 'S2' },
      { href: '/app/customers', label: 'Customers', roles: ['admin', 'staff'], slice: 'S2' },
    ],
  },
  {
    section: 'Billing',
    items: [
      { href: '/app/invoices', label: 'Invoices', roles: ['admin', 'staff'], slice: 'S3' },
      { href: '/app/billing', label: 'Billing runs', roles: ['admin', 'staff'], slice: 'S3' },
      { href: '/app/payments', label: 'Payments', roles: ['admin', 'staff'], slice: 'S4' },
    ],
  },
  {
    section: 'Setup',
    items: [
      { href: '/app/products', label: 'Products', roles: ['admin', 'staff'], slice: 'S1' },
      { href: '/app/plans', label: 'Plans', roles: ['admin', 'staff'], slice: 'S1' },
      { href: '/app/templates', label: 'Quotation templates', roles: ['admin', 'staff'], slice: 'S1' },
      { href: '/app/discounts', label: 'Discount rules', roles: ['admin', 'staff'], slice: 'S1' },
      { href: '/app/settings', label: 'Taxes & payment terms', roles: ['admin', 'staff'], slice: 'S1' },
    ],
  },
  { section: 'Admin', items: [{ href: '/app/users', label: 'Users', roles: ['admin'], slice: 'S2' }] },
];

export const PORTAL_NAV: NavItem[] = [
  { href: '/portal', label: 'My subscriptions', roles: ['customer'], slice: 'S2' },
  { href: '/portal/invoices', label: 'My invoices', roles: ['customer'], slice: 'S2' },
  { href: '/portal/profile', label: 'Profile', roles: ['customer'], slice: 'S2' },
];
