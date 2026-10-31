import { PASSWORD_RULES } from '@/lib/validation/common';
import { cn } from '@/components/ui';

/** Live checklist under a password field. */
export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.id} className={cn('flex items-center gap-1.5', ok ? 'text-emerald-600' : 'text-slate-500')}>
            <span aria-hidden>{ok ? '✓' : '○'}</span>
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}

export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));
