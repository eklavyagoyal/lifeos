'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Compass, LogOut, Moon, Sparkles, X, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { logoutAction } from '@/app/actions';
import { useMode } from '@/stores/mode-store';
import {
  type ShellNavItem,
  isShellNavItemActive,
  shellNavigation,
} from '@/components/layout/shell-config';

interface SidebarProps {
  activeItem: ShellNavItem;
  dayPhase: string;
  dateLabel: string;
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  activeItem,
  dayPhase,
  dateLabel,
  mobileOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleMode, isQuick } = useMode();
  const ActiveIcon = activeItem.icon;
  const containerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  return (
    <aside
      id="app-shell-sidebar"
      ref={containerRef}
      role={mobileOpen ? 'dialog' : undefined}
      aria-modal={mobileOpen || undefined}
      aria-label={mobileOpen ? 'Primary navigation' : undefined}
      className={cn(
        'shell-rail fixed inset-y-0 left-0 z-40 flex h-screen w-[var(--sidebar-width)] flex-col p-3 transition-transform duration-300 ease-luxury lg:translate-x-0 lg:p-4',
        mobileOpen ? 'translate-x-0' : '-translate-x-[calc(var(--sidebar-width)+1.5rem)]'
      )}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between px-1 lg:hidden">
          <div>
            <div className="section-kicker text-[0.63rem]">Navigation</div>
            <p className="mt-1 text-xs text-text-secondary">Move through your observatory.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft bg-surface-0/76 text-text-primary shadow-soft backdrop-blur-xl transition-all duration-300 ease-luxury hover:-translate-y-0.5 hover:shadow-panel"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <Link href="/today" className="shell-brand-card surface-obsidian overflow-hidden px-4 py-4" onClick={onClose}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/10 text-white shadow-soft">
              <Compass size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-2xs uppercase tracking-[0.24em] text-text-inverse/60">
                Personal Observatory
              </div>
              <div className="mt-1 font-display text-[1.7rem] leading-none tracking-[-0.05em] text-text-inverse">
                lifeOS
              </div>
              <p className="mt-2 text-xs leading-5 text-text-inverse/70">
                A room for rhythm, reflection, memory, and deliberate action.
              </p>
            </div>
          </div>
        </Link>

        <div className="surface-glass px-4 py-4">
          <div className="section-kicker text-[0.63rem]">Current Lens</div>
          <div className="mt-3 flex items-start gap-3">
            <div
              className="nav-icon-slot mt-0.5 h-11 w-11 shrink-0"
              style={{
                background: `linear-gradient(135deg, rgb(${activeItem.accent} / 0.2) 0%, rgba(255, 248, 240, 0.94) 100%)`,
                color: `rgb(${activeItem.accent})`,
              }}
            >
              <ActiveIcon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">{activeItem.label}</div>
              <div className="mt-0.5 text-xs uppercase tracking-[0.2em] text-text-tertiary">
                {activeItem.scene}
              </div>
              <p className="mt-2 text-xs leading-5 text-text-secondary">
                {activeItem.description}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="shell-meta-pill">{dayPhase}</span>
            <span className="shell-meta-pill">{dateLabel}</span>
            <span className="shell-meta-pill">
              {isQuick ? <Zap size={12} /> : <Moon size={12} />}
              {isQuick ? 'Quick Mode' : 'Deep Mode'}
            </span>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3">
            {shellNavigation.map((group) => {
              const groupActive = group.items.some((item) => isShellNavItemActive(pathname, item.href));
              const groupLeadItem =
                group.items.find((item) => isShellNavItemActive(pathname, item.href)) ?? group.items[0];

              return (
                <section
                  key={group.label}
                  className={cn(
                    'shell-nav-cluster px-2 py-2',
                    groupActive && 'shadow-soft'
                  )}
                  style={
                    groupActive
                      ? {
                          borderColor: `rgb(${groupLeadItem.accent} / 0.14)`,
                          background:
                            `linear-gradient(180deg, rgb(${groupLeadItem.highlight} / 0.82) 0%, rgba(247, 237, 223, 0.6) 100%)`,
                        }
                      : undefined
                  }
                >
                  {group.label && (
                    <div className="mb-2 px-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: `rgb(${groupLeadItem.accent})` }}
                        />
                        <div className="text-2xs font-semibold uppercase tracking-[0.22em] text-text-tertiary">
                          {group.label}
                        </div>
                      </div>
                      {group.description && (
                        <p className="mt-1 text-[11px] leading-4 text-text-muted">
                          {group.description}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = isShellNavItemActive(pathname, item.href);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn('nav-item group overflow-hidden pr-2', isActive && 'nav-item-active')}
                          onClick={onClose}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <span
                            className={cn(
                              'nav-icon-slot',
                              isActive && 'border-[rgba(174,93,44,0.14)]'
                            )}
                            style={
                              isActive
                                ? {
                                    background: `linear-gradient(135deg, rgb(${item.accent} / 0.2) 0%, rgba(255, 248, 240, 0.94) 100%)`,
                                    color: `rgb(${item.accent})`,
                                  }
                                : undefined
                            }
                          >
                            <Icon size={18} />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-current">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-text-muted transition-colors duration-300 group-hover:text-text-secondary">
                              {item.description}
                            </span>
                          </span>

                          <ChevronRight
                            size={16}
                            className={cn(
                              'mt-1 shrink-0 text-text-muted transition-all duration-300 ease-luxury',
                              isActive
                                ? 'translate-x-0 opacity-100 text-brand-600'
                                : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60'
                            )}
                          />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </nav>

        <div className="shell-nav-cluster px-2 py-2">
          <button
            type="button"
            onClick={toggleMode}
            className="nav-item group w-full pr-2"
          >
            <span className="nav-icon-slot">
              {isQuick ? <Zap size={18} /> : <Moon size={18} />}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-medium text-text-primary">
                {isQuick ? 'Quick Mode' : 'Deep Mode'}
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-text-muted">
                {isQuick
                  ? 'A brisk, capture-first posture for movement and triage.'
                  : 'A slower, more deliberate posture for focus and depth.'}
              </span>
            </span>
            <span className="shell-meta-pill ml-2 shrink-0">
              <Sparkles size={12} />
              Toggle
            </span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await logoutAction();
              router.push('/login');
              router.refresh();
            }}
            className="nav-item mt-1 w-full pr-2 text-left text-text-secondary"
          >
            <span className="nav-icon-slot">
              <LogOut size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-current">Log out</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-text-muted">
                Step out of the current session and return to the login screen.
              </span>
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
