'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
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
    <div className="space-y-3">
      <div className="rounded-lg border border-surface-3 bg-surface-1 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={isPending || items.length === 0}
            className="rounded-md border border-surface-3 px-2.5 py-1 text-2xs font-medium text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {selectedIds.size === items.length && items.length > 0 ? 'Clear all' : 'Select all'} (A)
          </button>
          <button
            type="button"
            onClick={() => runBulkAction('suggested')}
            disabled={isPending || selectedIds.size === 0}
            className="rounded-md bg-brand-600 px-2.5 py-1 text-2xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            Apply suggested (Enter)
          </button>
          <button
            type="button"
            onClick={() => runBulkAction('task')}
            disabled={isPending || selectedIds.size === 0}
            className="rounded-md border border-surface-3 px-2.5 py-1 text-2xs font-medium text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            As task (T)
          </button>
          <button
            type="button"
            onClick={() => runBulkAction('note')}
            disabled={isPending || selectedIds.size === 0}
            className="rounded-md border border-surface-3 px-2.5 py-1 text-2xs font-medium text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            As note (N)
          </button>
          <button
            type="button"
            onClick={() => runBulkAction('dismiss')}
            disabled={isPending || selectedIds.size === 0}
            className="rounded-md border border-red-200 px-2.5 py-1 text-2xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Dismiss (D)
          </button>
          <span className="ml-auto text-2xs text-text-muted">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select items to triage in bulk'}
          </span>
        </div>
        {feedback && (
          <p className="mt-2 text-2xs text-text-muted">{feedback}</p>
        )}
      </div>

      <div className="space-y-2">
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
        'card flex items-start gap-3 transition-colors',
        selected && 'ring-2 ring-brand-100',
        busy && 'opacity-60'
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelected}
        disabled={busy}
        className="mt-1 h-4 w-4 rounded border-surface-3 text-brand-500 focus:ring-brand-500"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <CapturePreviewIcon type={preview.suggestedType} />
          <p className="text-sm text-text-primary">{item.rawText}</p>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-text-muted">
          <span>{formatDate(item.createdAt)}</span>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5">
            suggested: {preview.suggestedType}
          </span>
          {preview.entityType && <span className="rounded-full bg-surface-2 px-1.5 py-0.5">{preview.entityType}</span>}
          {preview.metricType && (
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5">
              {preview.metricType}{preview.metricValue !== undefined ? ` ${preview.metricValue}` : ''}
            </span>
          )}
          {preview.projectLabel && <span className="rounded-full bg-surface-2 px-1.5 py-0.5">{preview.projectLabel}</span>}
          {preview.priority && <span className="rounded-full bg-surface-2 px-1.5 py-0.5">{preview.priority.toUpperCase()}</span>}
          {preview.dueDate && <span className="rounded-full bg-surface-2 px-1.5 py-0.5">{formatISODate(preview.dueDate)}</span>}
          {preview.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5">
              <Tag size={10} />
              #{tag}
            </span>
          ))}
        </div>

        {preview.body && preview.title && (
          <p className="mt-1 text-xs text-text-tertiary line-clamp-2">{preview.body}</p>
        )}

        {preview.warnings.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {preview.warnings.map((warning) => (
              <p key={warning} className="text-2xs text-amber-700">
                {warning}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleMaterialize('suggested')}
          disabled={busy || !preview.directCreateSupported}
          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30"
          title="Apply suggested type"
        >
          <ArrowRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleMaterialize('task')}
          disabled={busy}
          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-blue-50 hover:text-blue-600"
          title="Convert to task"
        >
          <CheckSquare size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleMaterialize('note')}
          disabled={busy}
          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-emerald-50 hover:text-emerald-600"
          title="Convert to note"
        >
          <StickyNote size={16} />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function CapturePreviewIcon({ type }: { type: CaptureParseResult['suggestedType'] }) {
  switch (type) {
    case 'task':
      return <Target size={14} className="text-blue-500" />;
    case 'note':
      return <StickyNote size={14} className="text-emerald-500" />;
    case 'idea':
      return <Lightbulb size={14} className="text-yellow-600" />;
    case 'journal':
      return <BookOpen size={14} className="text-amber-500" />;
    case 'entity':
      return <User size={14} className="text-pink-500" />;
    default:
      return <Inbox size={14} className="text-text-muted" />;
  }
}
