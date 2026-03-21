'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Menu, Moon, Sparkles, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/cn';
import { getActiveShellNavItem } from '@/components/layout/shell-config';
import { useMode } from '@/stores/mode-store';

function getDayPhase(date: Date) {
  const hour = date.getHours();
  if (hour < 5) return 'Night Watch';
  if (hour < 12) return 'Morning Session';
  if (hour < 17) return 'Afternoon Session';
  if (hour < 22) return 'Evening Session';
  return 'Night Watch';
}

function makeOrb(accent: string, opacity: number) {
  return `radial-gradient(circle, rgb(${accent} / ${opacity}) 0%, rgba(0, 0, 0, 0) 72%)`;
}

export function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const wasMobileNavOpenRef = useRef(false);
  const [shellClock, setShellClock] = useState<{ dayPhase: string; dateLabel: string }>({
    dayPhase: 'Local Rhythm',
    dateLabel: 'Today',
  });
  const activeItem = useMemo(() => getActiveShellNavItem(pathname), [pathname]);
  const { isQuick } = useMode();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    if (mobileNavOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (wasMobileNavOpenRef.current && !mobileNavOpen) {
      mobileTriggerRef.current?.focus();
    }

    wasMobileNavOpenRef.current = mobileNavOpen;
  }, [mobileNavOpen]);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const updateClock = () => {
      const now = new Date();
      setShellClock({
        dayPhase: getDayPhase(now),
        dateLabel: formatter.format(now),
      });
    };

    updateClock();
    const intervalId = window.setInterval(updateClock, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const shellStyle = {
    ['--shell-accent' as '--shell-accent']: activeItem.accent,
    ['--shell-secondary' as '--shell-secondary']: activeItem.secondary,
    ['--shell-highlight' as '--shell-highlight']: activeItem.highlight,
  } as CSSProperties;

  return (
    <div className="scene-shell flex min-h-screen" style={shellStyle}>
      <div
        aria-hidden
        className={cn(
          'fixed inset-0 z-30 bg-[rgba(32,22,16,0.36)] backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setMobileNavOpen(false)}
      />

      <div
        aria-hidden
        className="ambient-orb animate-ambient-float left-[max(10rem,14vw)] top-[-6rem] h-72 w-72"
        style={{ background: makeOrb(activeItem.accent, 0.28) }}
      />
      <div
        aria-hidden
        className="ambient-orb animate-ambient-drift right-[8%] top-24 h-72 w-72"
        style={{ background: makeOrb(activeItem.secondary, 0.24) }}
      />
      <div
        aria-hidden
        className="ambient-orb animate-ambient-float bottom-[-7rem] right-[18%] h-96 w-96"
        style={{ background: makeOrb(activeItem.accent, 0.18) }}
      />

      <Sidebar
        activeItem={activeItem}
        dayPhase={shellClock.dayPhase}
        dateLabel={shellClock.dateLabel}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      <main
        className="flex min-h-screen flex-1 px-3 py-3 lg:px-5 lg:py-4 lg:pl-[calc(var(--sidebar-width)+1rem)]"
        aria-hidden={mobileNavOpen ? true : undefined}
      >
        <div className="flex w-full flex-col gap-3">
          <div className="shell-mobile-bar lg:hidden">
            <button
              ref={mobileTriggerRef}
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-0/80 text-text-primary shadow-soft backdrop-blur-xl transition-all duration-300 ease-luxury hover:-translate-y-0.5 hover:shadow-panel"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="app-shell-sidebar"
              aria-haspopup="dialog"
            >
              <Menu size={18} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="section-kicker text-[0.63rem]">{activeItem.eyebrow}</div>
              <div className="mt-1 text-lg font-display leading-none tracking-[-0.04em] text-text-primary">
                {activeItem.label}
              </div>
              <p className="mt-1 truncate text-xs text-text-secondary">
                {activeItem.description}
              </p>
            </div>

            <span className="shell-meta-pill shrink-0">
              {isQuick ? <Zap size={12} /> : <Moon size={12} />}
              {isQuick ? 'Quick' : 'Deep'}
            </span>
          </div>

          <div className="page-stage animate-soft-rise overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-x-6 top-0 h-28 rounded-b-[2rem]"
              style={{
                background: `linear-gradient(180deg, rgb(${activeItem.highlight} / 0.92) 0%, rgba(255, 255, 255, 0) 100%)`,
              }}
            />
            <div
              aria-hidden
              className="absolute left-8 top-7 h-px w-28"
              style={{
                background: `linear-gradient(90deg, rgb(${activeItem.accent} / 0.72) 0%, rgba(255, 255, 255, 0) 100%)`,
              }}
            />
            <div
              aria-hidden
              className="absolute right-8 top-7 h-px w-24"
              style={{
                background: `linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgb(${activeItem.secondary} / 0.6) 100%)`,
              }}
            />

            <div className="mx-auto max-w-6xl px-6 py-6 lg:px-8 lg:py-8">
              <div className="mb-6 hidden items-center justify-between gap-6 lg:flex">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="shell-meta-pill">{activeItem.eyebrow}</span>
                    <span className="shell-meta-pill">
                      <Sparkles size={12} />
                      {activeItem.scene}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                    {activeItem.description}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <span className="shell-meta-pill">{shellClock.dateLabel}</span>
                  <span className="shell-meta-pill">{shellClock.dayPhase}</span>
                  <span className="shell-meta-pill">
                    {isQuick ? <Zap size={12} /> : <Moon size={12} />}
                    {isQuick ? 'Quick Mode' : 'Deep Mode'}
                  </span>
                </div>
              </div>

              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
