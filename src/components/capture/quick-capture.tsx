'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  CloudOff,
  Flag,
  Hash,
  Inbox,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  StickyNote,
  Tag,
  Target,
  User,
} from 'lucide-react';
import { previewCaptureAction, submitCaptureAction } from '@/app/actions';
import { DepthPlane, SpatialScene } from '@/components/experience/motion-scene';
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
import {
  CAPTURE_LANES,
  CAPTURE_SAMPLE_PROMPTS,
  type CaptureTone,
  type QuickCaptureVariant,
  getCaptureActionCopy,
  getActiveCaptureLane,
  getCaptureConfidenceMeta,
  getCaptureIntentMeta,
  getCaptureVariantCopy,
  stripKnownCapturePrefix,
} from './quick-capture.helpers';

interface QuickCaptureProps {
  variant?: QuickCaptureVariant;
  placeholder?: string;
}

type CaptureFeedback =
  | {
      kind: 'created';
      preview: CaptureParseResult;
      href: string;
    }
  | {
      kind: 'inbox';
      preview: CaptureParseResult;
      href: string;
    }
  | {
      kind: 'queued';
      preview: CaptureParseResult;
      mode: 'smart' | 'inbox';
      queuedCount: number;
    }
  | {
      kind: 'synced';
      count: number;
    };

const TONE_STYLES: Record<
  CaptureTone,
  {
    orbClass: string;
    iconClass: string;
    railClass: string;
    accentClass: string;
    activeLaneClass: string;
  }
> = {
  brand: {
    orbClass: 'border-[rgba(199,123,67,0.28)] bg-[radial-gradient(circle_at_top,rgba(248,214,183,0.95),rgba(236,183,131,0.75))]',
    iconClass: 'text-brand-700',
    railClass: 'bg-brand-500',
    accentClass: 'text-brand-700',
    activeLaneClass: 'border-brand-300 bg-brand-50 text-brand-700',
  },
  moss: {
    orbClass: 'border-[rgba(106,132,108,0.28)] bg-[radial-gradient(circle_at_top,rgba(217,232,219,0.95),rgba(176,205,180,0.75))]',
    iconClass: 'text-[rgb(78,107,81)]',
    railClass: 'bg-[rgb(95,127,95)]',
    accentClass: 'text-[rgb(78,107,81)]',
    activeLaneClass: 'border-[rgba(95,127,95,0.28)] bg-[rgba(226,236,227,0.95)] text-[rgb(78,107,81)]',
  },
  amber: {
    orbClass: 'border-[rgba(205,164,82,0.28)] bg-[radial-gradient(circle_at_top,rgba(250,233,188,0.95),rgba(236,207,126,0.76))]',
    iconClass: 'text-[rgb(150,109,26)]',
    railClass: 'bg-[rgb(188,146,56)]',
    accentClass: 'text-[rgb(150,109,26)]',
    activeLaneClass: 'border-[rgba(188,146,56,0.28)] bg-[rgba(252,243,216,0.96)] text-[rgb(150,109,26)]',
  },
  clay: {
    orbClass: 'border-[rgba(189,119,93,0.28)] bg-[radial-gradient(circle_at_top,rgba(246,214,205,0.95),rgba(228,170,151,0.75))]',
    iconClass: 'text-[rgb(155,84,62)]',
    railClass: 'bg-[rgb(181,107,84)]',
    accentClass: 'text-[rgb(155,84,62)]',
    activeLaneClass: 'border-[rgba(181,107,84,0.28)] bg-[rgba(248,230,223,0.96)] text-[rgb(155,84,62)]',
  },
  sky: {
    orbClass: 'border-[rgba(110,151,203,0.28)] bg-[radial-gradient(circle_at_top,rgba(214,229,249,0.95),rgba(165,197,234,0.76))]',
    iconClass: 'text-[rgb(69,113,171)]',
    railClass: 'bg-[rgb(94,137,196)]',
    accentClass: 'text-[rgb(69,113,171)]',
    activeLaneClass: 'border-[rgba(94,137,196,0.28)] bg-[rgba(227,238,251,0.96)] text-[rgb(69,113,171)]',
  },
  rose: {
    orbClass: 'border-[rgba(188,113,152,0.28)] bg-[radial-gradient(circle_at_top,rgba(246,216,228,0.95),rgba(229,171,197,0.78))]',
    iconClass: 'text-[rgb(151,77,115)]',
    railClass: 'bg-[rgb(176,97,137)]',
    accentClass: 'text-[rgb(151,77,115)]',
    activeLaneClass: 'border-[rgba(176,97,137,0.28)] bg-[rgba(249,231,239,0.96)] text-[rgb(151,77,115)]',
  },
  slate: {
    orbClass: 'border-[rgba(133,121,106,0.22)] bg-[radial-gradient(circle_at_top,rgba(239,232,224,0.95),rgba(219,208,194,0.78))]',
    iconClass: 'text-text-secondary',
    railClass: 'bg-text-muted',
    accentClass: 'text-text-secondary',
    activeLaneClass: 'border-[rgba(133,121,106,0.2)] bg-[rgba(243,238,232,0.95)] text-text-secondary',
  },
};

export function QuickCapture({
  variant = 'default',
  placeholder = 'Capture anything... task, note, idea, journal, metric, or person',
}: QuickCaptureProps) {
  const composerId = useId();
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [preview, setPreview] = useState<CaptureParseResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewSource, setPreviewSource] = useState<'local' | 'resolved' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CaptureFeedback | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const queueSyncRef = useRef(false);

  const isHero = variant === 'hero';
  const variantCopy = getCaptureVariantCopy(variant);
  const samplePrompts = CAPTURE_SAMPLE_PROMPTS[variant];
  const actionCopy = getCaptureActionCopy(preview, isOnline);
  const inputId = `${composerId}-input`;
  const hintId = `${composerId}-hint`;
  const workbenchId = `${composerId}-workbench`;
  const laneHeadingId = `${composerId}-lanes`;
  const sampleHeadingId = `${composerId}-samples`;

  const syncQueuedCaptures = async () => {
    if (typeof window === 'undefined' || queueSyncRef.current || !window.navigator.onLine) return;

    queueSyncRef.current = true;
    setIsSyncingQueue(true);

    try {
      const result = await flushQueuedCaptures();
      if (result.succeeded > 0) {
        setFeedback({ kind: 'synced', count: result.succeeded });
      }
    } finally {
      queueSyncRef.current = false;
      setQueuedCount(getQueuedCaptureCount());
      setIsSyncingQueue(false);
    }
  };

  const focusInput = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    });
  };

  const clearComposer = () => {
    setText('');
    setPreview(null);
    setPreviewSource(null);
    setError(null);
    setIsExpanded(false);
  };

  const applyLane = (prefix: string) => {
    const stripped = stripKnownCapturePrefix(text);
    const nextText = stripped ? `${prefix} ${stripped}`.trim() : `${prefix} `;
    setFeedback(null);
    setError(null);
    setText(nextText);
    setIsExpanded(true);
    focusInput();
  };

  const applyPrompt = (nextText: string) => {
    setFeedback(null);
    setError(null);
    setText(nextText);
    setIsExpanded(true);
    focusInput();
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
    const trimmed = text.trim();

    if (!trimmed) {
      setPreview(null);
      setError(null);
      setIsPreviewing(false);
      setPreviewSource(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const localPreview = buildLocalCapturePreview(trimmed, { projectResolution: 'defer' });

    setPreview(localPreview);
    setPreviewSource(isOnline ? 'local' : 'resolved');
    setError(null);

    if (!isOnline) {
      setIsPreviewing(false);
      return;
    }

    setIsPreviewing(true);

    const timeout = window.setTimeout(async () => {
      try {
        const result = await previewCaptureAction(trimmed);
        if (requestIdRef.current === requestId) {
          setPreview(result.preview);
          setPreviewSource('resolved');
          setError(null);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setPreview(localPreview);
          setPreviewSource('local');
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
    const trimmed = text.trim();
    if (!trimmed) return;

    setError(null);

    if (!isOnline) {
      const queued = enqueueOfflineCapture(trimmed, mode);
      setQueuedCount(getQueuedCaptureCount());
      setFeedback({
        kind: 'queued',
        preview: queued.preview,
        mode,
        queuedCount: getQueuedCaptureCount(),
      });
      clearComposer();
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await submitCaptureAction(trimmed, mode);
        if ('error' in result && result.error) {
          setError(result.error);
          return;
        }

        if (!('outcome' in result)) {
          setError('Capture could not be completed.');
          return;
        }

        if (result.outcome === 'created') {
          setFeedback({
            kind: 'created',
            preview: result.preview,
            href: result.redirectPath,
          });
        } else {
          setFeedback({
            kind: 'inbox',
            preview: result.preview,
            href: '/inbox',
          });
        }

        clearComposer();
      })();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit(event.shiftKey ? 'inbox' : 'smart');
    }

    if (event.key === 'Escape') {
      clearComposer();
      setFeedback(null);
      inputRef.current?.blur();
    }
  };

  const showWorkbench =
    isHero ||
    isExpanded ||
    !!text.trim() ||
    !!feedback ||
    queuedCount > 0 ||
    !isOnline ||
    isSyncingQueue;

  const previewMeta = getCaptureIntentMeta(preview?.suggestedType ?? 'inbox');
  const previewTone = TONE_STYLES[previewMeta.tone];
  const activeLane = getActiveCaptureLane(text, preview?.suggestedType ?? null);

  return (
    <SpatialScene
      as="section"
      intensity={isHero ? 0.95 : 0.82}
      className={cn(
        'capture-console motion-sheen-card',
        isHero && 'capture-console-hero',
        isExpanded && 'shadow-hero'
      )}
      aria-busy={isPending || isPreviewing || isSyncingQueue}
    >
      <div className="relative z-[1]">
        <DepthPlane depth={6} tilt={0.28}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="section-kicker text-[0.63rem]">{variantCopy.eyebrow}</div>
              <h2
                className={cn(
                  'mt-2 font-display leading-none tracking-[-0.05em] text-text-primary',
                  isHero ? 'text-[2rem]' : 'text-[1.5rem]'
                )}
              >
                {variantCopy.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                {variantCopy.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="shell-meta-pill">
                <Sparkles size={12} />
                Local-first parser
              </span>
              <span className="shell-meta-pill">
                <Send size={12} />
                Direct create
              </span>
              <span className="shell-meta-pill">
                <Inbox size={12} />
                Inbox fallback
              </span>
            </div>
          </div>
        </DepthPlane>

        <DepthPlane depth={18} tilt={0.72} className="mt-5">
          <div className="relative flex items-center gap-3 rounded-[1.6rem] border border-line-soft bg-[linear-gradient(135deg,rgba(255,252,247,0.94),rgba(246,237,224,0.84))] p-2 shadow-soft backdrop-blur-xl">
            <div
              className={cn(
                'capture-icon-orb hidden sm:flex',
                text.trim() ? previewTone.orbClass : TONE_STYLES.brand.orbClass
              )}
            >
              {text.trim() && preview ? (
                <CaptureIcon type={preview.suggestedType} className={previewTone.iconClass} />
              ) : (
                <Plus size={18} className="text-brand-700" />
              )}
            </div>

            <div className="relative min-w-0 flex-1">
              <label htmlFor={inputId} className="sr-only">
                {variantCopy.title}
              </label>
              <input
                id={inputId}
                ref={inputRef}
                type="text"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setFeedback(null);
                  setError(null);
                }}
                onFocus={() => {
                  setIsExpanded(true);
                }}
                onBlur={() => {
                  if (
                    !text.trim() &&
                    !feedback &&
                    queuedCount === 0 &&
                    isOnline &&
                    !isSyncingQueue &&
                    !isHero
                  ) {
                    setIsExpanded(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn(
                  'capture-bar border-0 bg-transparent shadow-none ring-0',
                  isHero ? 'min-h-[4rem] rounded-[1.35rem] px-2 text-[1rem]' : 'min-h-[3.5rem] rounded-[1.25rem] px-2',
                  'focus:bg-transparent focus:shadow-none'
                )}
                aria-describedby={hintId}
                aria-controls={workbenchId}
                disabled={isPending}
              />

              <div id={hintId} className="mt-1 flex flex-wrap items-center gap-2 px-2">
                <span className="text-2xs text-text-muted">
                  {actionCopy.shortcutHint}
                </span>
                {previewSource === 'local' && isOnline && text.trim() ? (
                  <span className="inline-flex items-center gap-1 text-2xs text-text-muted">
                    <RefreshCw size={10} className={cn(isPreviewing && 'animate-spin')} />
                    Refining project and direct-create details
                  </span>
                ) : null}
              </div>
            </div>

            {text.trim() ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSubmit('smart')}
                disabled={isPending}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-brand-600 text-white shadow-soft transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={actionCopy.primaryLabel}
                aria-label={actionCopy.primaryLabel}
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            ) : null}
          </div>

          {(queuedCount > 0 || !isOnline || isSyncingQueue) ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                {!isOnline ? (
                  <StatusPill tone="warning" icon={<CloudOff size={12} />}>
                    Offline capture mode
                  </StatusPill>
                ) : null}
                {queuedCount > 0 ? (
                  <StatusPill tone="brand" icon={<Inbox size={12} />}>
                    {queuedCount} queued {queuedCount === 1 ? 'capture' : 'captures'}
                  </StatusPill>
                ) : null}
                {isSyncingQueue ? (
                  <StatusPill tone="neutral" icon={<RefreshCw size={12} className="animate-spin" />}>
                    Syncing queue
                  </StatusPill>
                ) : null}
              </div>

              {isOnline && queuedCount > 0 && !isSyncingQueue ? (
                <button
                  type="button"
                  onClick={() => void syncQueuedCaptures()}
                  className="text-xs font-medium text-brand-700 transition-colors hover:text-brand-800"
                >
                  Sync now
                </button>
              ) : null}
            </div>
        ) : null}
      </DepthPlane>

      {showWorkbench ? (
        <DepthPlane
            depth={11}
            tilt={0.42}
            className={cn('mt-5', !isHero && 'pt-1')}
            innerClassName="space-y-4"
            id={workbenchId}
          >
            <div>
              <div id={laneHeadingId} className="sr-only">
                Capture lanes
              </div>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby={laneHeadingId}>
                {CAPTURE_LANES.map((lane) => {
                  const laneMeta = getCaptureIntentMeta(lane.type);
                  const laneTone = TONE_STYLES[laneMeta.tone];
                  const isActive = activeLane?.type === lane.type;

                  return (
                    <button
                      key={lane.type}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyLane(lane.prefix)}
                      className={cn(
                        'capture-shortcut-chip',
                        isActive ? laneTone.activeLaneClass : 'border-line-soft bg-surface-0/74 text-text-secondary hover:border-brand-200 hover:bg-surface-hover'
                      )}
                      aria-pressed={isActive}
                    >
                      <CaptureIcon type={lane.type} className={cn('h-3.5 w-3.5', laneTone.iconClass)} />
                      <span>{lane.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-2xs text-text-muted">
                {activeLane
                  ? `${activeLane.label}: ${activeLane.hint}`
                  : 'Tap a lane to pre-shape the parser before you start typing, or keep it free-form and let the system infer the right destination.'}
              </p>
            </div>

            {text.trim() ? (
              <CapturePreviewBoard
                preview={preview}
                error={error}
                isOnline={isOnline}
                isPending={isPending}
                isPreviewing={isPreviewing}
                previewSource={previewSource}
                actionCopy={actionCopy}
                onSubmit={handleSubmit}
              />
            ) : feedback ? (
              <CaptureFeedbackPanel feedback={feedback} />
            ) : (
              <div className="capture-preview-shell motion-sheen-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div id={sampleHeadingId} className="section-kicker text-[0.58rem]">{variantCopy.sampleTitle}</div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      Use full phrases, not brittle commands. The parser can lift structure out of natural language and still give you a chance to steer it before anything gets created.
                    </p>
                  </div>
                  <span className="shell-meta-pill">
                    <Sparkles size={12} />
                    Enter creates
                  </span>
                </div>

                <div
                  className={cn('mt-4 grid gap-2', isHero ? 'lg:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3')}
                  role="group"
                  aria-labelledby={sampleHeadingId}
                >
                  {samplePrompts.map((prompt) => {
                    const promptMeta = getCaptureIntentMeta(prompt.type);
                    const promptTone = TONE_STYLES[promptMeta.tone];

                    return (
                      <button
                        key={prompt.label}
                        type="button"
                        onClick={() => applyPrompt(prompt.text)}
                        className="group motion-sheen-card rounded-[1.35rem] border border-line-soft bg-surface-0/72 p-3 text-left shadow-soft transition-all duration-300 ease-luxury hover:-translate-y-[1px] hover:border-brand-300 hover:bg-surface-0/92"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className={cn('capture-icon-orb h-10 w-10', promptTone.orbClass)}>
                            <CaptureIcon type={prompt.type} className={cn('h-4 w-4', promptTone.iconClass)} />
                          </div>
                          <span className="text-2xs text-text-muted transition-colors group-hover:text-brand-700">
                            Fill prompt
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-medium text-text-primary">{prompt.label}</p>
                        <p className="mt-1 text-2xs leading-5 text-text-secondary">{prompt.hint}</p>
                        <p className="mt-3 rounded-[1rem] border border-line-soft bg-surface-1/65 px-3 py-2 font-mono text-[0.68rem] leading-5 text-text-secondary">
                          {prompt.text}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </DepthPlane>
        ) : null}
      </div>
    </SpatialScene>
  );
}

function CapturePreviewBoard({
  preview,
  error,
  isOnline,
  isPending,
  isPreviewing,
  previewSource,
  actionCopy,
  onSubmit,
}: {
  preview: CaptureParseResult | null;
  error: string | null;
  isOnline: boolean;
  isPending: boolean;
  isPreviewing: boolean;
  previewSource: 'local' | 'resolved' | null;
  actionCopy: ReturnType<typeof getCaptureActionCopy>;
  onSubmit: (mode: 'smart' | 'inbox') => void;
}) {
  if (error) {
    return (
      <div className="capture-preview-shell motion-sheen-card flex items-center gap-2 text-sm text-status-danger" role="status" aria-live="polite">
        <AlertTriangle size={16} />
        {error}
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="capture-preview-shell motion-sheen-card flex items-center gap-2 text-sm text-text-muted" role="status" aria-live="polite">
        <Loader2 size={15} className="animate-spin" />
        Parsing capture…
      </div>
    );
  }

  const meta = getCaptureIntentMeta(preview.suggestedType);
  const tone = TONE_STYLES[meta.tone];
  const confidence = getCaptureConfidenceMeta(preview.confidence, preview.directCreateSupported);
  const detailRows = buildPreviewDetails(preview);
  const heading = preview.suggestedType === 'journal'
    ? preview.title || 'Journal entry'
    : preview.title || preview.body || preview.rawText;
  const body = preview.body && preview.title ? preview.body : undefined;

  return (
    <div className="capture-preview-shell motion-sheen-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('capture-icon-orb', tone.orbClass)}>
            <CaptureIcon type={preview.suggestedType} className={cn('h-5 w-5', tone.iconClass)} />
          </div>
          <div className="min-w-0">
            <div className="section-kicker text-[0.58rem]">
              {preview.directCreateSupported ? 'Intent Locked' : 'Inbox Lane'}
            </div>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">
              {meta.label} detected
            </h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-text-secondary">
              {meta.description}
            </p>
          </div>
        </div>

        <div className="min-w-[12rem] max-w-[16rem]">
          <div className="flex items-center justify-between gap-3 text-2xs uppercase tracking-[0.18em] text-text-muted">
            <span>{confidence.label}</span>
            <span>{Math.round(preview.confidence * 100)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn('h-full rounded-full transition-all duration-300 ease-luxury', tone.railClass)}
              style={{ width: `${Math.max(12, Math.round(preview.confidence * 100))}%` }}
            />
          </div>
          <p className="mt-2 text-2xs leading-5 text-text-secondary">
            {confidence.detail}
          </p>
          {previewSource === 'local' && isOnline ? (
            <p className="mt-1 inline-flex items-center gap-1 text-2xs text-text-muted">
              <RefreshCw size={10} className={cn(isPreviewing && 'animate-spin')} />
              Refining against live project data
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
        <div className="rounded-[1.45rem] border border-line-soft bg-surface-0/76 p-4 shadow-soft">
          <div className="section-kicker text-[0.58rem]">
            {preview.suggestedType === 'journal' ? 'Entry Preview' : 'Primary Content'}
          </div>
          <p className="mt-3 text-[1.02rem] font-medium leading-7 text-text-primary">
            {heading}
          </p>
          {body ? (
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {body}
            </p>
          ) : null}

          {preview.warnings.length > 0 ? (
            <div className="mt-4 space-y-2 rounded-[1.1rem] border border-amber-200 bg-amber-50/80 p-3">
              {preview.warnings.map((warning) => (
                <p key={warning} className="flex items-start gap-2 text-xs leading-5 text-amber-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-2.5">
          {detailRows.map((detail) => (
            <div key={`${detail.label}-${detail.value}`} className="capture-field-row">
              <div className="flex items-center gap-2 text-text-muted">
                {detail.icon}
                <span>{detail.label}</span>
              </div>
              <span className={cn('text-right text-text-primary', detail.valueClassName)}>
                {detail.value}
              </span>
            </div>
          ))}

          {preview.tags.length > 0 ? (
            <div className="rounded-[1.15rem] border border-line-soft bg-surface-0/7 px-3 py-3 shadow-soft">
              <div className="mb-2 flex items-center gap-2 text-2xs uppercase tracking-[0.18em] text-text-muted">
                <Tag size={12} />
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preview.tags.map((tag) => (
                  <span key={tag} className="badge text-text-secondary">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!isOnline ? (
        <div className="mt-4 rounded-[1.1rem] border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-800">
          This preview is local-first. The capture will queue on this device and sync once the app reconnects.
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 border-t border-line-soft/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-2xs text-text-muted">
          <CaptureKeyHint>Enter</CaptureKeyHint>
          <span>{actionCopy.primaryLabel}</span>
          <CaptureKeyHint>Shift+Enter</CaptureKeyHint>
          <span>{preview.directCreateSupported ? actionCopy.secondaryLabel : 'keep in inbox lane'}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSubmit('smart')}
            disabled={isPending}
            className="rounded-[1rem] bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Saving…' : actionCopy.primaryLabel}
          </button>
          {preview.directCreateSupported ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSubmit('inbox')}
              disabled={isPending}
              className="rounded-[1rem] border border-line-soft bg-surface-0/78 px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-brand-300 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionCopy.secondaryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CaptureFeedbackPanel({ feedback }: { feedback: CaptureFeedback }) {
  if (feedback.kind === 'synced') {
    return (
      <div className="capture-outcome-shell motion-sheen-card" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="capture-icon-orb border-[rgba(96,131,99,0.22)] bg-[radial-gradient(circle_at_top,rgba(218,235,220,0.95),rgba(183,213,186,0.76))]">
            <CheckCircle2 size={18} className="text-[rgb(78,107,81)]" />
          </div>
          <div>
            <div className="section-kicker text-[0.58rem]">Queue Synced</div>
            <p className="mt-2 text-sm font-medium text-text-primary">
              {feedback.count} queued {feedback.count === 1 ? 'capture was' : 'captures were'} pushed into the system.
            </p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              The offline queue is clear for now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const meta = getCaptureIntentMeta(feedback.preview.suggestedType);
  const tone = TONE_STYLES[meta.tone];
  const title = feedback.preview.title || feedback.preview.body || feedback.preview.rawText;

  const content = (() => {
    switch (feedback.kind) {
      case 'created':
        return {
          eyebrow: 'Created',
          body: `${meta.label} created successfully. You can open it now or keep capturing while the rest of the page catches up.`,
          actionLabel: 'Open item',
          href: feedback.href,
          icon: <CheckCircle2 size={18} className={tone.iconClass} />,
        };
      case 'inbox':
        return {
          eyebrow: 'Held In Inbox',
          body: 'The capture was stored safely in the inbox so you can triage it later without losing the thought.',
          actionLabel: 'Open inbox',
          href: feedback.href,
          icon: <Inbox size={18} className={tone.iconClass} />,
        };
      case 'queued':
        return {
          eyebrow: 'Queued Locally',
          body:
            feedback.mode === 'smart' && feedback.preview.directCreateSupported
              ? 'This will sync as a direct create once the app reconnects.'
              : 'This will sync into the inbox once the app reconnects.',
          actionLabel: null,
          href: null,
          icon: <CloudOff size={18} className={tone.iconClass} />,
        };
    }
  })();

  return (
    <div className="capture-outcome-shell motion-sheen-card" role="status" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('capture-icon-orb', tone.orbClass)}>{content.icon}</div>
          <div className="min-w-0">
            <div className="section-kicker text-[0.58rem]">{content.eyebrow}</div>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">
              {title}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
              {content.body}
            </p>
          </div>
        </div>

        {feedback.kind === 'queued' ? (
          <span className="shell-meta-pill">
            {feedback.queuedCount} waiting to sync
          </span>
        ) : content.href && content.actionLabel ? (
          <Link href={content.href} className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-0/82 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-300 hover:text-brand-700">
            {content.actionLabel}
            <ArrowUpRight size={13} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function buildPreviewDetails(preview: CaptureParseResult) {
  const details: Array<{
    label: string;
    value: string;
    icon: ReactNode;
    valueClassName?: string;
  }> = [];

  details.push({
    label: 'Destination',
    value: preview.directCreateSupported ? 'Direct create' : 'Inbox first',
    icon: preview.directCreateSupported ? <CheckCircle2 size={12} /> : <Inbox size={12} />,
  });

  if (preview.metricType) {
    details.push({
      label: 'Signal',
      value: preview.metricValue !== undefined ? `${preview.metricType} ${preview.metricValue}` : preview.metricType,
      icon: <Activity size={12} />,
    });
  }

  if (preview.entityType) {
    details.push({
      label: 'Entity',
      value: preview.entityType,
      icon: <User size={12} />,
      valueClassName: 'capitalize',
    });
  }

  if (preview.projectLabel) {
    details.push({
      label: 'Project',
      value: preview.projectLabel,
      icon: <Target size={12} />,
    });
  }

  if (preview.priority) {
    details.push({
      label: 'Priority',
      value: preview.priority.toUpperCase(),
      icon: <Flag size={12} />,
    });
  }

  if (preview.dueDate) {
    details.push({
      label: 'Due',
      value: formatISODate(preview.dueDate),
      icon: <Clock3 size={12} />,
    });
  }

  if (preview.tags.length === 0) {
    details.push({
      label: 'Tags',
      value: 'None yet',
      icon: <Hash size={12} />,
      valueClassName: 'text-text-muted',
    });
  }

  return details;
}

function CaptureKeyHint({ children }: { children: ReactNode }) {
  return <kbd className="capture-command-kbd">{children}</kbd>;
}

function StatusPill({
  children,
  icon,
  tone,
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone: 'brand' | 'warning' | 'neutral';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium',
        tone === 'brand' && 'bg-brand-100 text-brand-700',
        tone === 'warning' && 'bg-amber-100 text-amber-800',
        tone === 'neutral' && 'bg-surface-2 text-text-secondary'
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function CaptureIcon({
  type,
  className,
}: {
  type: CaptureParseResult['suggestedType'];
  className?: string;
}) {
  switch (type) {
    case 'task':
      return <Target size={16} className={className} />;
    case 'note':
      return <StickyNote size={16} className={className} />;
    case 'idea':
      return <Lightbulb size={16} className={className} />;
    case 'journal':
      return <BookOpen size={16} className={className} />;
    case 'entity':
      return <User size={16} className={className} />;
    case 'metric':
      return <Activity size={16} className={className} />;
    default:
      return <Inbox size={16} className={className} />;
  }
}
