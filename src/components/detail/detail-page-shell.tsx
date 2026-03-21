'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Archive, ArrowLeft, MoreHorizontal, PencilLine } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DetailPageShellProps {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  onTitleChange?: (title: string) => void;
  badge?: ReactNode;
  actions?: ReactNode;
  onArchive?: () => void;
  destructiveLabel?: string;
  children: ReactNode;
}

export function DetailPageShell({
  backHref,
  backLabel,
  title,
  subtitle,
  onTitleChange,
  badge,
  actions,
  onArchive,
  destructiveLabel = 'Archive',
  children,
}: DetailPageShellProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [showMenu, setShowMenu] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const destructiveActionRef = useRef<HTMLButtonElement>(null);
  const wasMenuOpenRef = useRef(false);

  useEffect(() => {
    setEditTitle(title);
  }, [title]);

  useEffect(() => {
    if (!showMenu) {
      if (wasMenuOpenRef.current) {
        menuButtonRef.current?.focus();
      }
      wasMenuOpenRef.current = false;
      return;
    }

    wasMenuOpenRef.current = true;

    window.requestAnimationFrame(() => {
      destructiveActionRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setShowMenu(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMenu]);

  const handleTitleSave = () => {
    const trimmed = editTitle.trim();

    if (trimmed && trimmed !== title && onTitleChange) {
      onTitleChange(trimmed);
    } else {
      setEditTitle(title);
    }

    setIsEditingTitle(false);
  };

  const heroSummary = subtitle
    ? 'The key context for this record is set above. Use the sections below to shape structure, notes, and companion material without dropping out of the artifact.'
    : `This record lives in ${backLabel.toLowerCase()}. Use the sections below to shape its metadata, context, and companion material without leaving the page.`;

  return (
    <div className="detail-shell animate-fade-in">
      <section className="detail-hero px-5 py-5 lg:px-7 lg:py-6">
        <div className="relative z-[1]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link href={backHref} className="detail-back-link text-text-secondary">
              <ArrowLeft size={14} />
              <span>Back to {backLabel}</span>
            </Link>

            {actions || onArchive ? (
              <div className="detail-actions-dock">
                {actions}
                {onArchive ? (
                  <div className="relative">
                    <button
                      ref={menuButtonRef}
                      type="button"
                      onClick={() => setShowMenu((current) => !current)}
                      className="rounded-[0.95rem] p-2 text-text-muted transition-colors hover:bg-surface-0/86 hover:text-text-primary"
                      aria-haspopup="menu"
                      aria-expanded={showMenu}
                      aria-controls={showMenu ? menuId : undefined}
                      aria-label="Open record actions"
                    >
                      <MoreHorizontal size={17} />
                    </button>
                    {showMenu ? (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowMenu(false)}
                          role="presentation"
                        />
                        <div
                          id={menuId}
                          role="menu"
                          aria-label="Record actions"
                          className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-[1.2rem] border border-line-soft bg-[linear-gradient(180deg,rgba(255,250,243,0.95),rgba(245,234,219,0.88))] p-2 shadow-panel backdrop-blur-xl"
                        >
                          <button
                            ref={destructiveActionRef}
                            type="button"
                            onClick={() => {
                              onArchive();
                              setShowMenu(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm text-status-danger transition-colors hover:bg-surface-0/84"
                            role="menuitem"
                          >
                            <Archive size={14} />
                            {destructiveLabel}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] xl:items-end">
            <div className="min-w-0">
              <div className="section-kicker text-[0.6rem]">{backLabel}</div>

              <div className="mt-3 flex flex-wrap items-start gap-3">
                {isEditingTitle && onTitleChange ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleTitleSave();
                      if (event.key === 'Escape') {
                        setEditTitle(title);
                        setIsEditingTitle(false);
                      }
                    }}
                    className="min-w-0 flex-1 border-b border-brand-300 bg-transparent pb-2 font-display text-[clamp(2rem,4vw,3.6rem)] leading-[0.94] tracking-[-0.06em] text-text-primary outline-none"
                  />
                ) : onTitleChange ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    className={cn(
                      'min-w-0 text-left font-display text-[clamp(2rem,4vw,3.6rem)] leading-[0.94] tracking-[-0.06em] text-text-primary',
                      'transition-colors hover:text-brand-700'
                    )}
                    aria-label={`Edit title: ${title}`}
                  >
                    {title}
                  </button>
                ) : (
                  <h1 className="min-w-0 font-display text-[clamp(2rem,4vw,3.6rem)] leading-[0.94] tracking-[-0.06em] text-text-primary">
                    {title}
                  </h1>
                )}

                {badge ? <div className="pt-1">{badge}</div> : null}
              </div>

              {subtitle ? (
                <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
                  {subtitle}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="shell-meta-pill">
                  <ArrowLeft size={12} />
                  Linked to {backLabel}
                </span>
                {onTitleChange ? (
                  <span className="shell-meta-pill">
                    <PencilLine size={12} />
                    Title is editable
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-line-soft/80 bg-surface-0/70 p-4 shadow-soft backdrop-blur-md">
              <div className="section-kicker text-[0.58rem]">Artifact Context</div>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                {heroSummary}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="detail-shell-content">{children}</div>
    </div>
  );
}
