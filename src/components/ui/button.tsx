import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none';
const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-xs shadow-brand-900/20 inset-ring inset-ring-white/10 hover:bg-brand-700',
  secondary: 'bg-white text-slate-800 border border-slate-300 shadow-xs hover:border-slate-400 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900',
  danger: 'bg-red-600 text-white shadow-xs shadow-red-900/20 hover:bg-red-700',
};
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...rest}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});

/** A link styled as a button. */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
