'use client';
import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}
// Native modal dialog supplies focus trapping, background inertness and focus
// restoration. Keep it mounted so focus is restored on close.
export function BottomSheet({ isOpen, onClose, title, children, className }: BottomSheetProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!isOpen) { if (dialog.open) dialog.close(); return; }
    if (!dialog.open) dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; if (dialog.open) dialog.close(); };
  }, [isOpen]);
  return <dialog ref={ref} aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : 'Bottom sheet'}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    className="m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/40">
    <div className={cn('absolute bottom-0 left-1/2 w-full max-w-[390px] -translate-x-1/2 rounded-t-2xl border-t border-surface-border bg-surface-card px-5 pb-8 pt-3 shadow-sheet', className)}>
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-surface-muted" />
      <div className="mb-4 flex items-center justify-between gap-4">
        {title && <h2 id={titleId} className="text-lg font-bold">{title}</h2>}
        <button type="button" autoFocus onClick={onClose} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary-400" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="max-h-[75dvh] overflow-y-auto">{children}</div>
    </div>
  </dialog>;
}
