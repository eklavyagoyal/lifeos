'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SecondaryLaunchButtonProps {
  icon: LucideIcon;
  label: string;
  detail?: string;
  onClick: () => void;
  variant?: 'compact' | 'panel';
  className?: string;
}

interface SecondaryDialogShellProps {
  open: boolean;
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function SecondaryLaunchButton({
  icon: Icon,
  label,
  detail,
  onClick,
  variant = 'compact',
  className,
}: SecondaryLaunchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn(
        'secondary-launcher',
        variant === 'panel' ? 'secondary-launcher-panel' : 'secondary-launcher-compact',
        className
      )}
    >
      <span className="secondary-icon-badge">
        <Icon size={variant === 'panel' ? 18 : 16} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-text-primary">{label}</span>
        {detail ? (
          <span className="mt-1 block text-xs leading-5 text-text-secondary">{detail}</span>
        ) : null}
      </span>
    </button>
  );
}

export function SecondaryDialogShell({
  open,
  eyebrow = 'Quick Create',
  title,
  description,
  icon: Icon,
  onClose,
  children,
  footer,
  className,
}: SecondaryDialogShellProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="secondary-dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={dialogRef}
        className={cn('secondary-dialog-shell', className)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="secondary-dialog-header">
          <div className="flex items-start gap-3">
            {Icon ? (
              <span className="secondary-icon-badge secondary-icon-badge-lg">
                <Icon size={18} />
              </span>
            ) : null}
            <div className="min-w-0">
              <div className="section-kicker">{eyebrow}</div>
              <h2
                id={titleId}
                className="mt-2 font-display text-[1.85rem] leading-none tracking-[-0.05em] text-text-primary"
              >
                {title}
              </h2>
              {description ? (
                <p
                  id={descriptionId}
                  className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary"
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="secondary-launcher secondary-launcher-compact shrink-0 px-3"
            aria-label="Close dialog"
          >
            <span className="secondary-icon-badge">
              <X size={16} />
            </span>
          </button>
        </div>

        <div className="space-y-4">{children}</div>

        {footer ? <div className="secondary-dialog-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
