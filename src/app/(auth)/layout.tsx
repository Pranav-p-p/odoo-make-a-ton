import { LogoMark } from '@/components/shell/icons';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,var(--color-brand-100),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(15_23_42/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(15_23_42/0.04)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <LogoMark className="h-11 w-11 shadow-lg shadow-brand-900/20 rounded-[12px]" />
          <span className="text-xl font-semibold tracking-tight text-slate-900">Brightloop</span>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-pop backdrop-blur">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-400">Plans, subscriptions and recurring billing in one place.</p>
      </div>
    </div>
  );
}
