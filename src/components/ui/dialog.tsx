'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 *   <Dialog open={open} onClose={() => setOpen(false)} title="Record payment" footer={<Button>Save</Button>}>...</Dialog>
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-0 shadow-pop backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-[13px] text-slate-500">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 -mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-6 pb-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-3.5">{footer}</div>}
    </dialog>
  );
}
