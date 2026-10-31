import Link from 'next/link';
import { AuthPanel } from '@/components/shell/auth-panel';
import { LogoMark } from '@/components/shell/icons';

/** Split layout for sign-in, sign-up and password pages: form on the left, the billing loop on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:p-3">
      <section className="flex min-h-svh flex-col px-6 py-8 sm:px-12 lg:min-h-0 lg:px-16 xl:px-24">
        <Link href="/login" className="inline-flex items-center gap-2.5 self-start rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500">
          <LogoMark className="h-8 w-8" />
          <span className="font-display text-[17px] font-semibold tracking-tight text-slate-900">Brightloop</span>
        </Link>

        <div className="flex flex-1 items-center py-12">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>

        <p className="text-xs text-slate-400">Staff accounts are added by an administrator. Customers can create their own.</p>
      </section>

      <aside className="hidden lg:sticky lg:top-3 lg:block lg:h-[calc(100svh-1.5rem)]">
        <AuthPanel />
      </aside>
    </div>
  );
}
