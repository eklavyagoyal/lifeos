'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CloudOff,
  Inbox,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  StickyNote,
  Tag,
  Target,
  User,
} from 'lucide-react';
import { previewCaptureAction, submitCaptureAction } from '@/app/actions';
import { buildCapturePreview as buildLocalCapturePreview } from '@/lib/capture-preview';
import { cn } from '@/lib/cn';
import {
  enqueueOfflineCapture,
  flushQueuedCaptures,
  getQueuedCaptureCount,
  subscribeToQueuedCaptures,
} from '@/lib/offline-capture';
import { formatISODate } from '@/lib/utils';
import type { CaptureParseResult } from '@/lib/types';

const TYPE_LABELS: Record<CaptureParseResult['suggestedType'], string> = {
  task: 'Task',
  note: 'Note',
  idea: 'Idea',
  journal: 'Journal',
  metric: 'Metric',
  entity: 'Entity',
  inbox: 'Inbox',
};

export function QuickCapture() {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [preview, setPreview] = useState<CaptureParseResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const queueSyncRef = useRef(false);

  const syncQueuedCaptures = async () => {
    if (queueSyncRef.current || !navigator.onLine) return;

    queueSyncRef.current = true;
    setIsSyncingQueue(true);

    try {
      await flushQueuedCaptures();
    } finally {
      queueSyncRef.current = false;
      setQueuedCount(getQueuedCaptureCount());
      setIsSyncingQueue(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(window.navigator.onLine);
    setQueuedCount(getQueuedCaptureCount());

    const unsubscribe = subscribeToQueuedCaptures(() => {
      setQueuedCount(getQueuedCaptureCount());
    });

    const handleOnline = () => {
      setIsOnline(true);
      void syncQueuedCaptures();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (window.navigator.onLine) {
      void syncQueuedCaptures();
    }

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!text.trim()) {
      setPreview(null);
      setError(null);
      setIsPreviewing(false);
      return;
    }

    const requestId = ++requestIdRef.current;

    if (!isOnline) {
      setPreview(buildLocalCapturePreview(text, { projectResolution: 'defer' }));
      setError(null);
      setIsPreviewing(false);
      return;
    }

    setIsPreviewing(true);

    const timeout = window.setTimeout(async () => {
      try {
        const result = await previewCaptureAction(text);
        if (requestIdRef.current === requestId) {
          setPreview(result.preview);
          setError(null);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setPreview(buildLocalCapturePreview(text, { projectResolution: 'defer' }));
          setError(null);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsPreviewing(false);
        }
      }
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [isOnline, text]);

  const handleSubmit = (mode: 'smart' | 'inbox' = 'smart') => {
    if (!text.trim()) return;

    if (!isOnline) {
      enqueueOfflineCapture(text.trim(), mode);
      setQueuedCount(getQueuedCaptureCount());
      setText('');
      setPreview(null);
      setError(null);
      setIsExpanded(false);
      return;
    }

    startTransition(async () => {
      const result = await submitCaptureAction(text.trim(), mode);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }

      setText('');
      setPreview(null);
      setError(null);
      setIsExpanded(false);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit('smart');
    }

    if (e.key === 'Escape') {
      setText('');
      setPreview(null);
      setError(null);
      setIsExpanded(false);
      inputRef.current?.blur();
    }
  };

  const primaryLabel = !isOnline
    ? preview?.directCreateSupported
      ? `Queue ${TYPE_LABELS[preview.suggestedType]}`
      : 'Queue for Inbox'
    : preview?.directCreateSupported
      ? `Create ${TYPE_LABELS[preview.suggestedType]}`
      : 'Send to Inbox';

  return (
    <div
      className={cn(
        'relative rounded-lg transition-all duration-200',
        isExpanded && 'ring-2 ring-brand-100'
      )}
    >
      <div className="relative flex items-center">
        <Plus size={16} className="absolute left-3 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => {
            if (!text.trim()) setIsExpanded(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Capture anything... task, note, idea, journal, metric, or person"
          className="capture-bar pl-9 pr-10"
          disabled={isPending}
        />
        {text && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSubmit('smart')}
            disabled={isPending}
            className="absolute right-2 rounded-md p-1.5 text-brand-500 hover:bg-brand-50 transition-colors disabled:opacity-50"
            title={primaryLabel}
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        )}
      </div>

      {(queuedCount > 0 || !isOnline || isSyncingQueue) ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-1.5 text-2xs">
            {!isOnline ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700">
                <CloudOff size={11} />
                Offline capture mode
              </span>
            ) : null}
            {queuedCount > 0 ? (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-brand-700">
                {queuedCount} queued for sync
              </span>
            ) : null}
            {isSyncingQueue ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-text-muted">
                <RefreshCw size={11} className="animate-spin" />
                Syncing queue
              </span>
            ) : null}
          </div>

          {isOnline && queuedCount > 0 && !isSyncingQueue ? (
            <button
              type="button"
              onClick={() => void syncQueuedCaptures()}
              className="text-2xs font-medium text-brand-600 transition-colors hover:text-brand-700"
            >
              Sync now
            </button>
          ) : null}
        </div>
      ) : null}

      {isExpanded && (
        <div className="space-y-2 px-3 py-2">
          <p className="text-2xs text-text-muted">
            Try <kbd className="rounded bg-surface-2 px-1 py-0.5 font-mono">task:</kbd>,{' '}
            <kbd className="rounded bg-surface-2 px-1 py-0.5 font-mono">note:</kbd>,{' '}
            <kbd className="rounded bg-surface-2 px-1 py-0.5 font-mono">idea:</kbd>,{' '}
            <kbd className="rounded bg-surface-2 px-1 py-0.5 font-mono">journal:</kbd>,{' '}
            <kbd className="rounded bg-surface-2 px-1 py-0.5 font-mono">person:</kbd>,{' '}
            <kbd className="rounded bg-surface-2 px-1 py-0.5 font-mono">sleep 7.5</kbd>, or{' '}
            <kbd className="rounded bg-surface-2 px-1 py-0.5 font-mono">+project-slug</kbd>.
          </p>

          {text.trim() && (
            <div className="rounded-lg border border-surface-3 bg-surface-0 p-3 shadow-sm">
              {isPreviewing ? (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Loader2 size={14} className="animate-spin" />
                  Parsing capture…
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 text-xs text-status-danger">
                  <AlertTriangle size={14} />
                  {error}
                </div>
              ) : preview ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CaptureIcon type={preview.suggestedType} />
                        <span className="text-xs font-medium text-text-primary">
                          {TYPE_LABELS[preview.suggestedType]}
                        </span>
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs text-text-muted">
                          {Math.round(preview.confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-primary">
                        {preview.title || preview.body || preview.rawText}
                      </p>
                      {preview.body && preview.title && (
                        <p className="mt-1 text-xs text-text-tertiary line-clamp-2">
                          {preview.body}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-2xs font-medium',
                        !isOnline
                          ? 'bg-amber-500/10 text-amber-700'
                          : preview.directCreateSupported
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-surface-2 text-text-muted'
                      )}
                    >
                      {!isOnline
                        ? 'Queue offline'
                        : preview.directCreateSupported
                          ? 'Direct create'
                          : 'Inbox'}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {preview.metricType && (
                      <CaptureChip label={`${preview.metricType}${preview.metricValue !== undefined ? ` ${preview.metricValue}` : ''}`} />
                    )}
                    {preview.entityType && <CaptureChip label={preview.entityType} icon={<User size={11} />} />}
                    {preview.projectLabel && <CaptureChip label={preview.projectLabel} icon={<Target size={11} />} />}
                    {preview.priority && <CaptureChip label={preview.priority.toUpperCase()} />}
                    {preview.dueDate && <CaptureChip label={formatISODate(preview.dueDate)} />}
                    {preview.tags.map((tag) => (
                      <CaptureChip key={tag} label={`#${tag}`} icon={<Tag size={11} />} />
                    ))}
                  </div>

                  {preview.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {preview.warnings.map((warning) => (
                        <p key={warning} className="flex items-center gap-1.5 text-2xs text-amber-700">
                          <AlertTriangle size={12} />
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  {!isOnline ? (
                    <p className="mt-2 text-2xs text-text-muted">
                      This capture will be queued locally and synced once the app reconnects.
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSubmit('smart')}
                      disabled={isPending}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                    >
                      {isPending ? 'Saving…' : primaryLabel}
                    </button>
                    {preview.directCreateSupported && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSubmit('inbox')}
                        disabled={isPending}
                        className="rounded-md border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
                      >
                        {isOnline ? 'Inbox instead' : 'Queue for Inbox'}
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CaptureChip({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-2xs text-text-tertiary">
      {icon}
      {label}
    </span>
  );
}

function CaptureIcon({ type }: { type: CaptureParseResult['suggestedType'] }) {
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
    case 'metric':
      return <Send size={14} className="text-cyan-500" />;
    default:
      return <Inbox size={14} className="text-text-muted" />;
  }
}
