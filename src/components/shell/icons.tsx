import { useId, type ReactNode } from 'react';

/** Navigation icons: 20×20, 1.5 stroke, currentColor. */
export type IconName =
  | 'dashboard'
  | 'subscriptions'
  | 'customers'
  | 'invoices'
  | 'billing'
  | 'payments'
  | 'products'
  | 'plans'
  | 'templates'
  | 'discounts'
  | 'settings'
  | 'users'
  | 'profile';

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="6" height="7" rx="1.5" />
      <rect x="11" y="3" width="6" height="4" rx="1.5" />
      <rect x="11" y="9" width="6" height="8" rx="1.5" />
      <rect x="3" y="12" width="6" height="5" rx="1.5" />
    </>
  ),
  subscriptions: (
    <>
      <path d="M15.5 7.5A6 6 0 004.6 6M4.5 12.5A6 6 0 0015.4 14" />
      <path d="M15.5 3.5v4h-4M4.5 16.5v-4h4" />
    </>
  ),
  customers: (
    <>
      <circle cx="8" cy="7" r="3" />
      <path d="M2.5 16.5a5.5 5.5 0 0111 0M13.5 4.2a3 3 0 010 5.6M17.5 16.5a5.5 5.5 0 00-3-4.9" />
    </>
  ),
  invoices: (
    <>
      <path d="M5 2.5h7l3.5 3.5v11.5H5z" />
      <path d="M12 2.5V6h3.5M7.5 10h5M7.5 13h5" />
    </>
  ),
  billing: (
    <>
      <path d="M10.8 2.5L4.5 11h5l-.8 6.5 6.3-8.5h-5z" />
    </>
  ),
  payments: (
    <>
      <rect x="2.5" y="5" width="15" height="10.5" rx="2" />
      <path d="M2.5 8.5h15M5.5 12.5h3" />
    </>
  ),
  products: (
    <>
      <path d="M10 2.5l7 3.5v8l-7 3.5-7-3.5V6z" />
      <path d="M3 6l7 3.5L17 6M10 9.5v8" />
    </>
  ),
  plans: (
    <>
      <path d="M10 2.5l7.5 3.75L10 10 2.5 6.25z" />
      <path d="M2.5 10L10 13.75 17.5 10M2.5 13.75L10 17.5l7.5-3.75" />
    </>
  ),
  templates: (
    <>
      <rect x="6" y="2.5" width="11" height="12" rx="1.5" />
      <path d="M14 17.5H4.5A1.5 1.5 0 013 16V6" />
    </>
  ),
  discounts: (
    <>
      <path d="M15 5L5 15" />
      <circle cx="6" cy="6" r="2" />
      <circle cx="14" cy="14" r="2" />
    </>
  ),
  settings: (
    <>
      <path d="M3 5.5h8M15 5.5h2M3 14.5h2M9 14.5h8M3 10h4M11 10h6" />
      <circle cx="13" cy="5.5" r="2" />
      <circle cx="7" cy="14.5" r="2" />
      <circle cx="9" cy="10" r="2" />
    </>
  ),
  users: (
    <>
      <path d="M10 2.5l6 2.25v4.5c0 3.75-2.6 6.9-6 8.25-3.4-1.35-6-4.5-6-8.25v-4.5z" />
      <path d="M7.5 10l1.75 1.75L12.75 8.5" />
    </>
  ),
  profile: (
    <>
      <circle cx="10" cy="7" r="3.25" />
      <path d="M3.5 17a6.5 6.5 0 0113 0" />
    </>
  ),
};

export function NavIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

/** The Brightloop mark: a loop around a spark. */
export function LogoMark({ className }: { className?: string }) {
  const gid = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
      <path
        d="M21.5 11.2a7 7 0 10.9 8.6"
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="22.4" cy="11" r="2" fill="#a7f3e4" />
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14948a" />
          <stop offset="1" stopColor="#0f5f5a" />
        </linearGradient>
      </defs>
    </svg>
  );
}
