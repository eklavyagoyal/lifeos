'use client';

import { useCallback, useEffect, useState, useTransition, type ReactNode } from 'react';
import { dismissInboxAction, triageInboxItemsAction } from '@/app/actions';
import { formatDate, formatISODate } from '@/lib/utils';
import type { CaptureParseResult } from '@/lib/types';
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Inbox,
  Lightbulb,
  StickyNote,
  Tag,
  Target,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface InboxItem {
  id: string;
  rawText: string;
  parsedType: string | null;
  status: string;
  createdAt: number;
  preview: CaptureParseResult;
}

export function InboxItemList({ items }: { items: InboxItem[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((current) => {
      if (current.size === items.length) return new Set();
      return new Set(items.map((item) => item.id));
    });
  }, [items]);

  const runBulkAction = useCallback((mode: 'suggested' | 'task' | 'note' | 'dismiss') => {
    const ids = selectedIds.size > 0 ? [...selectedIds] : [];
    if (ids.length === 0 || isPending) return;

    startTransition(async () => {
      if (mode === 'dismiss') {
        const result = await triageInboxItemsAction(ids, 'dismiss');
        setFeedback(`Dismissed ${result.dismissed} item${result.dismissed === 1 ? '' : 's'}.`);
      } else {
        const result = await triageInboxItemsAction(ids, mode);
        if (result.errors.length > 0) {
          setFeedback(result.errors[0]);
        } else {
          setFeedback(`Created ${result.created} item${result.created === 1 ? '' : 's'}.`);
        }
      }
      setSelectedIds(new Set());
    });
  }, [isPending, selectedIds, startTransition]);

  useEffect(() => {
    const validIds = new Set(items.map((item) => item.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;

      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        toggleSelectAll();
      }

      if (selectedIds.size === 0) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        runBulkAction('suggested');
      }

      if (event.key.toLowerCase() === 't') {
        event.preventDefault();
        runBulkAction('task');
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        runBulkAction('note');
      }

      if (event.key.toLowerCase() === 'd' || event.key === 'Backspace') {
        event.preventDefault();
        runBulkAction('dismiss');
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedIds(new Set());
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [items, runBulkAction, selectedIds, toggleSelectAll]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runSingleDismiss = (id: string) => {
    if (isPending) return;
    startTransition(async () => {
      await dismissInboxAction(id);
    });
  };

  return (
    <div className="space-y-4">
      <div className="secondary-toolbar">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-kicker">Triage Console</div>
            <h2 className="mt-2 font-display text-[1.7rem] leading-none tracking-[-0.05em] text-text-primary">
              Sort the waiting fragments
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              Select captures in batches when you already know the mode, or work item by item when the parser needs a gentler hand.
            </p>
          </div>
          <span className="secondary-chip">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${items.length} pending`}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={isPending || items.length === 0}
            className="secondary-toolbar-button disabled:opacity-50"
          >
            {selectedIds.size === items.length && items.length > 0 ? 'Clear all' : 'Select all'} <span className="capture-command-kbd">A</span>
          </button>
          <button
            type="button"
            onClick={() => runBulkAction('suggested')}
            disabled={isPending || selectedIds.size === 0}
            className="secondary-toolbar-button border-[rgba(174,93,44,0.18)] bg-[linear-gradient(135deg,rgba(201,143,88,0.96)_0%,rgba(174,93,44,0.92)_100%)] text-white hover:text-white disabled:opacity-50"
          >
            Apply suggested <span className="capture-command-kbd">Enter</span>
          </button>
          <button
            type="button"
            onClick={() => runBulkAction('task')}
            disabled={isPending || selectedIds.size === 0}
            className="secondary-toolbar-button disabled:opacity-50"
          >
            As task <span className="capture-command-kbd">T</span>
          </button>
          <button
            type="button"
            onClick={() => runBulkAction('note')}
            disabled={isPending || selectedIds.size === 0}
            className="secondary-toolbar-button disabled:opacity-50"
          >
            As note <span className="capture-command-kbd">N</span>
          </button>
          <button
            type="button"
            onClick={() => runBulkAction('dismiss')}
            disabled={isPending || selectedIds.size === 0}
            className="secondary-toolbar-button border-[rgba(185,76,76,0.16)] text-red-600 hover:bg-[rgba(255,241,239,0.76)] disabled:opacity-50"
          >
            Dismiss <span className="capture-command-kbd">D</span>
          </button>
          <span className="ml-auto text-2xs text-text-muted">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select items to triage in bulk'}
          </span>
        </div>
        {feedback && (
          <p className="mt-3 text-sm text-text-secondary">{feedback}</p>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <InboxItemCard
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            disabled={isPending}
            onToggleSelected={() => toggleSelected(item.id)}
            onDismiss={() => runSingleDismiss(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

function InboxItemCard({
  item,
  selected,
  disabled,
  onToggleSelected,
  onDismiss,
}: {
  item: InboxItem;
  selected: boolean;
  disabled: boolean;
  onToggleSelected: () => void;
  onDismiss: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleMaterialize = (mode: 'suggested' | 'task' | 'note') => {
    startTransition(async () => {
      await triageInboxItemsAction([item.id], mode);
    });
  };

  const preview = item.preview;
  const busy = disabled || isPending;

  return (
    <div
      className={cn(
        'secondary-card transition-colors',
        selected && 'border-[rgba(174,93,44,0.18)] shadow-[0_24px_48px_-34px_rgba(174,93,44,0.24),inset_0_1px_0_rgba(255,252,246,0.92)]',
        busy && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          disabled={busy}
          className="mt-1 h-4 w-4 rounded border-surface-3 text-brand-500 focus:ring-brand-500"
        />

        <span className="secondary-icon-badge mt-0.5">
          <CapturePreviewIcon type={preview.suggestedType} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="secondary-chip">Suggested {preview.suggestedType}</span>
            <span className="secondary-chip">{confidenceLabel(preview.confidence)}</span>
            {preview.entityType ? <span className="secondary-chip">{preview.entityType}</span> : null}
            {preview.metricType ? (
              <span className="secondary-chip">
                {preview.metricType}{preview.metricValue !== undefined ? ` ${preview.metricValue}` : ''}
              </span>
            ) : null}
            {preview.projectLabel ? <span className="secondary-chip">{preview.projectLabel}</span> : null}
            {preview.priority ? <span className="secondary-chip">{preview.priority.toUpperCase()}</span> : null}
            {preview.dueDate ? <span className="secondary-chip">{formatISODate(preview.dueDate)}</span> : null}
            {preview.tags.map((tag) => (
              <span key={tag} className="secondary-chip">
                <Tag size={10} />
                #{tag}
              </span>
            ))}
          </div>

          <p className="mt-3 text-sm font-medium leading-7 text-text-primary">{item.rawText}</p>

          {preview.body && preview.title ? (
            <p className="mt-2 text-sm leading-6 text-text-tertiary line-clamp-3">{preview.body}</p>
          ) : null}

          {preview.warnings.length > 0 ? (
            <div className="mt-3 rounded-[1.1rem] border border-[rgba(205,145,54,0.18)] bg-[rgba(255,246,228,0.72)] px-3 py-2">
              {preview.warnings.map((warning) => (
                <p key={warning} className="text-2xs leading-5 text-amber-700">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <InboxActionButton
              onClick={() => handleMaterialize('suggested')}
              disabled={busy || !preview.directCreateSupported}
              label="Apply suggested"
              icon={<ArrowRight size={14} />}
              variant="primary"
            />
            <InboxActionButton
              onClick={() => handleMaterialize('task')}
              disabled={busy}
              label="As task"
              icon={<CheckSquare size={14} />}
            />
            <InboxActionButton
              onClick={() => handleMaterialize('note')}
              disabled={busy}
              label="As note"
              icon={<StickyNote size={14} />}
            />
            <InboxActionButton
              onClick={onDismiss}
              disabled={busy}
              label="Dismiss"
              icon={<X size={14} />}
              variant="danger"
            />
            <span className="ml-auto text-2xs text-text-muted">{formatDate(item.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapturePreviewIcon({ type }: { type: CaptureParseResult['suggestedType'] }) {
  switch (type) {
    case 'task':
      return <Target size={16} className="text-[rgba(174,93,44,0.92)]" />;
    case 'note':
      return <StickyNote size={16} className="text-[rgba(95,116,95,0.92)]" />;
    case 'idea':
      return <Lightbulb size={16} className="text-[rgba(201,143,88,0.92)]" />;
    case 'journal':
      return <BookOpen size={16} className="text-[rgba(166,111,74,0.92)]" />;
    case 'entity':
      return <User size={16} className="text-[rgba(176,109,137,0.92)]" />;
    default:
      return <Inbox size={16} className="text-text-muted" />;
  }
}

function InboxActionButton({
  onClick,
  disabled,
  label,
  icon,
  variant = 'default',
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'secondary-toolbar-button disabled:opacity-40',
        variant === 'primary' && 'border-[rgba(174,93,44,0.18)] bg-[linear-gradient(135deg,rgba(201,143,88,0.96)_0%,rgba(174,93,44,0.92)_100%)] text-white hover:text-white',
        variant === 'danger' && 'border-[rgba(185,76,76,0.16)] text-red-600 hover:bg-[rgba(255,241,239,0.76)]'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.85) return 'Clear read';
  if (confidence >= 0.6) return 'Partial read';
  return 'Rough read';
}
