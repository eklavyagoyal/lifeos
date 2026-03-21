'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  CircleDashed,
  Dumbbell,
  Loader2,
  NotebookPen,
  Orbit,
  PenSquare,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  ListChecks,
  CalendarRange,
} from 'lucide-react';
import {
  deleteReviewAction,
  extractReviewInsightAction,
  publishReviewAction,
  regenerateReviewAction,
  updateReviewBodyAction,
} from '@/app/actions';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { ProgressBar } from '@/components/detail/progress-bar';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { StatusBadge } from '@/components/detail/status-badge';
import { TagsPills } from '@/components/detail/tags-pills';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import { formatDate, formatISODate, wordCount } from '@/lib/utils';

interface Review {
  id: string;
  reviewType: string;
  periodStart: string;
  periodEnd: string | null;
  body: string | null;
  generatedAt: number | null;
  statsSnapshot: string | null;
  isPublished: number | null;
  createdAt: number;
  updatedAt: number;
}

interface SnapshotData {
  tasks?: { completed?: number; created?: number; overdue?: number };
  habits?: { totalCompletions?: number; possibleCompletions?: number; completionRate?: number };
  metrics?: {
    moodAvg?: number | null;
    energyAvg?: number | null;
    sleepAvg?: number | null;
    workoutMinutes?: number;
  };
  journal?: { entryCount?: number; totalWords?: number };
  projects?: { activeCount?: number };
  goals?: { activeCount?: number };
  ideas?: { capturedCount?: number };
  wins?: string[];
  blockers?: string[];
  focusAreas?: string[];
}

type RelatedItem = ConnectionItem;
type SuggestedItem = ConnectionSuggestion;

interface Tag {
  id: string;
  name: string;
  color: string | null;
  itemTagId: string;
}

interface ReviewDetailClientProps {
  review: Review;
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
}

interface ReviewNarrative {
  eyebrow: string;
  headline: string;
  summary: string;
}

interface ReviewSnapshotCardData {
  icon: LucideIcon;
  label: string;
  value: string;
  support: string;
  toneClass: string;
  progress?: number;
}

const REVIEW_TYPE_LABELS: Record<string, string> = {
  daily: 'Daily Review',
  weekly: 'Weekly Review',
  monthly: 'Monthly Review',
  yearly: 'Yearly Review',
};

const REVIEW_CADENCE_LABELS: Record<string, string> = {
  daily: 'Daily cadence',
  weekly: 'Weekly cadence',
  monthly: 'Monthly cadence',
  yearly: 'Yearly cadence',
};

function formatReviewTitle(reviewType: string): string {
  return REVIEW_TYPE_LABELS[reviewType] ?? 'Review';
}

function formatReviewCadence(reviewType: string): string {
  return REVIEW_CADENCE_LABELS[reviewType] ?? 'Review cadence';
}

function parseSnapshot(raw: string | null): SnapshotData | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SnapshotData;
  } catch {
    return null;
  }
}

function getReflectionPrompt(reviewType: string): string {
  switch (reviewType) {
    case 'daily':
      return 'Capture what mattered today, what dragged, and what deserves to cross into tomorrow.';
    case 'weekly':
      return 'Summarize the week in a way that helps the next one begin cleaner and with less ambiguity.';
    case 'monthly':
      return 'Use the month to look for pattern, not just events: momentum, friction, and what is changing underneath.';
    case 'yearly':
      return 'Write the yearly review like a chapter ending: what defined the season, what matured, and what wants a new shape next.';
    default:
      return 'Capture the lessons, signals, and next commitments that make this review worth returning to later.';
  }
}

function getReviewNarrative(review: Review, snapshot: SnapshotData | null): ReviewNarrative {
  const wins = snapshot?.wins?.length ?? 0;
  const blockers = snapshot?.blockers?.length ?? 0;
  const focusAreas = snapshot?.focusAreas?.length ?? 0;
  const tasksCompleted = snapshot?.tasks?.completed ?? 0;
  const habitRate = snapshot?.habits?.completionRate ?? 0;

  if (review.isPublished) {
    return {
      eyebrow: 'Published Chapter',
      headline: 'This review is now a fixed checkpoint in the story.',
      summary:
        'Treat the sections below as a chapter artifact: what the period felt like, what it produced, and which commitments were important enough to carry forward.',
    };
  }

  if (wins >= 3 && blockers <= 1) {
    return {
      eyebrow: 'Forward Motion',
      headline: 'This chapter has visible momentum and a clean signal of progress.',
      summary:
        'The goal now is not more data, but sharper synthesis. Keep the wins grounded, extract the next commitments, and preserve the shape of what made the period work.',
    };
  }

  if (blockers > wins && blockers >= 2) {
    return {
      eyebrow: 'Friction Read',
      headline: 'This review is carrying more resistance than lift.',
      summary:
        'Let the writing be honest about the drag. Use the extraction tools below to turn vague frustration into smaller tasks or more intentional goals.',
    };
  }

  if (focusAreas > 0) {
    return {
      eyebrow: 'Refocus Point',
      headline: 'This review is especially useful as a decision surface.',
      summary:
        'There are clear focus areas already visible in the data. The value of the page now is to make the next chapter feel cleaner, narrower, and more deliberate.',
    };
  }

  if (tasksCompleted > 0 || habitRate > 0) {
    return {
      eyebrow: 'Pattern Capture',
      headline: 'The material is here. The job is to turn activity into meaning.',
      summary:
        'Use the snapshot to notice what actually moved, then write the interpretation in a way that future-you can trust when this period begins to blur.',
    };
  }

  return {
    eyebrow: 'Reflection Scaffold',
    headline: 'This review is ready to become a clearer chapter.',
    summary:
      'Even when the stats are sparse, the structure still matters. Use the body, tags, and extracted actions below to turn a rough checkpoint into a useful narrative artifact.',
  };
}

function getSnapshotCards(snapshot: SnapshotData): ReviewSnapshotCardData[] {
  const cards: ReviewSnapshotCardData[] = [];

  if (snapshot.tasks) {
    cards.push({
      icon: ListChecks,
      label: 'Tasks closed',
      value: String(snapshot.tasks.completed ?? 0),
      support: `${snapshot.tasks.created ?? 0} created${snapshot.tasks.overdue ? `, ${snapshot.tasks.overdue} overdue` : ''}`,
      toneClass:
        'border-[rgba(93,132,186,0.16)] bg-[rgba(231,239,251,0.9)] text-[rgb(71,107,160)]',
    });
  }

  if (snapshot.habits) {
    cards.push({
      icon: Dumbbell,
      label: 'Habit consistency',
      value: `${snapshot.habits.completionRate ?? 0}%`,
      support: `${snapshot.habits.totalCompletions ?? 0} of ${snapshot.habits.possibleCompletions ?? 0} habit check-ins landed`,
      toneClass:
        'border-[rgba(96,127,97,0.18)] bg-[rgba(229,241,230,0.9)] text-[rgb(78,107,81)]',
      progress: snapshot.habits.completionRate ?? 0,
    });
  }

  if (snapshot.metrics?.moodAvg != null) {
    cards.push({
      icon: Sparkles,
      label: 'Average mood',
      value: snapshot.metrics.moodAvg.toFixed(1),
      support: 'Emotional tone across the period.',
      toneClass:
        'border-[rgba(198,150,76,0.18)] bg-[rgba(252,244,223,0.92)] text-[rgb(151,111,34)]',
    });
  }

  if (snapshot.metrics?.sleepAvg != null) {
    cards.push({
      icon: BarChart3,
      label: 'Average sleep',
      value: `${snapshot.metrics.sleepAvg.toFixed(1)}h`,
      support: 'Sleep average logged through the metric stream.',
      toneClass:
        'border-[rgba(117,104,181,0.16)] bg-[rgba(239,235,251,0.9)] text-[rgb(102,84,161)]',
    });
  }

  if (snapshot.metrics?.energyAvg != null) {
    cards.push({
      icon: Orbit,
      label: 'Average energy',
      value: snapshot.metrics.energyAvg.toFixed(1),
      support: 'Energy trend for the period.',
      toneClass:
        'border-[rgba(187,129,98,0.18)] bg-[rgba(248,236,227,0.92)] text-[rgb(150,93,55)]',
    });
  }

  if (snapshot.journal) {
    cards.push({
      icon: BookOpen,
      label: 'Journal volume',
      value: String(snapshot.journal.entryCount ?? 0),
      support: `${snapshot.journal.totalWords ?? 0} words captured in the journal`,
      toneClass:
        'border-[rgba(118,103,164,0.16)] bg-[rgba(238,234,249,0.9)] text-[rgb(96,82,147)]',
    });
  }

  if (snapshot.projects) {
    cards.push({
      icon: CalendarRange,
      label: 'Active projects',
      value: String(snapshot.projects.activeCount ?? 0),
      support: 'Projects still alive in this chapter.',
      toneClass:
        'border-[rgba(93,132,186,0.16)] bg-[rgba(231,239,251,0.9)] text-[rgb(71,107,160)]',
    });
  }

  if (snapshot.goals) {
    cards.push({
      icon: Target,
      label: 'Active goals',
      value: String(snapshot.goals.activeCount ?? 0),
      support: 'Goal arcs still carrying attention.',
      toneClass:
        'border-[rgba(96,127,97,0.18)] bg-[rgba(229,241,230,0.9)] text-[rgb(78,107,81)]',
    });
  }

  if (snapshot.ideas) {
    cards.push({
      icon: PenSquare,
      label: 'Ideas captured',
      value: String(snapshot.ideas.capturedCount ?? 0),
      support: 'Fresh inputs collected during the period.',
      toneClass:
        'border-[rgba(187,129,98,0.18)] bg-[rgba(248,236,227,0.92)] text-[rgb(150,93,55)]',
    });
  }

  return cards;
}

function CoverCountCard({
  icon: Icon,
  label,
  count,
  toneClass,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  toneClass: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[rgba(121,95,67,0.12)] bg-[rgba(255,251,245,0.7)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,252,246,0.9),0_18px_36px_-28px_rgba(58,39,24,0.18)]">
      <div className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.22em] text-text-muted">
        <span className={`flex h-9 w-9 items-center justify-center rounded-[1rem] border shadow-soft ${toneClass}`}>
          <Icon size={15} />
        </span>
        {label}
      </div>
      <div className="mt-4 text-3xl font-display tracking-[-0.05em] text-text-primary">{count}</div>
    </div>
  );
}

function SnapshotCard({ card }: { card: ReviewSnapshotCardData }) {
  const Icon = card.icon;

  return (
    <div className="rounded-[1.45rem] border border-[rgba(121,95,67,0.12)] bg-[linear-gradient(180deg,rgba(255,252,246,0.92),rgba(246,236,223,0.74))] p-4 shadow-[0_20px_40px_-30px_rgba(58,39,24,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-[1rem] border shadow-soft ${card.toneClass}`}>
          <Icon size={16} />
        </span>
        <div className="text-right text-2xs font-medium uppercase tracking-[0.22em] text-text-muted">
          {card.label}
        </div>
      </div>

      <div className="mt-4 text-[1.75rem] font-display leading-none tracking-[-0.05em] text-text-primary">
        {card.value}
      </div>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{card.support}</p>
      {card.progress != null ? (
        <ProgressBar value={card.progress} className="mt-4" showLabel={false} />
      ) : null}
    </div>
  );
}

function InsightActionButtons({
  disabled,
  onTask,
  onGoal,
}: {
  disabled: boolean;
  onTask: () => void;
  onGoal: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onTask}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-full border border-[rgba(121,95,67,0.12)] bg-[linear-gradient(135deg,rgba(255,251,245,0.92),rgba(245,235,219,0.78))] px-3 py-1.5 text-2xs font-medium text-text-primary transition-all duration-300 ease-luxury hover:border-[rgba(174,93,44,0.18)] hover:bg-[linear-gradient(135deg,rgba(255,252,247,0.98),rgba(248,238,225,0.84))] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Task
      </button>
      <button
        type="button"
        onClick={onGoal}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-full border border-[rgba(121,95,67,0.12)] bg-[rgba(255,250,243,0.78)] px-3 py-1.5 text-2xs font-medium text-text-secondary transition-all duration-300 ease-luxury hover:border-[rgba(174,93,44,0.16)] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        Goal
      </button>
    </div>
  );
}

function InsightColumn({
  icon: Icon,
  label,
  title,
  description,
  items,
  toneClass,
  onTask,
  onGoal,
  disabled,
  emptyLabel,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  items: string[];
  toneClass: string;
  onTask: (insight: string) => void;
  onGoal: (insight: string) => void;
  disabled: boolean;
  emptyLabel: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-kicker">{label}</div>
          <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-text-primary">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border shadow-soft ${toneClass}`}>
          <Icon size={18} />
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item}
              className="rounded-[1.2rem] border border-[rgba(121,95,67,0.12)] bg-[rgba(255,251,245,0.74)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,252,246,0.88),0_16px_30px_-24px_rgba(58,39,24,0.18)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm leading-7 text-text-primary">{item}</p>
                <InsightActionButtons
                  disabled={disabled}
                  onTask={() => onTask(item)}
                  onGoal={() => onGoal(item)}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.2rem] border border-dashed border-[rgba(121,95,67,0.16)] bg-[rgba(255,250,243,0.6)] px-4 py-5 text-sm leading-7 text-text-secondary">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewDetailClient({
  review,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
}: ReviewDetailClientProps) {
  const router = useRouter();
  const [body, setBody] = useState(review.body || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionLabel, setActionLabel] = useState('');

  useEffect(() => {
    setBody(review.body || '');
  }, [review.body]);

  const snapshot = parseSnapshot(review.statsSnapshot);
  const narrative = getReviewNarrative(review, snapshot);
  const snapshotCards = snapshot ? getSnapshotCards(snapshot) : [];
  const bodyWordCount = body.trim() ? wordCount(body) : 0;
  const winsCount = snapshot?.wins?.length ?? 0;
  const blockersCount = snapshot?.blockers?.length ?? 0;
  const focusCount = snapshot?.focusAreas?.length ?? 0;

  const periodLabel =
    review.periodEnd && review.periodEnd !== review.periodStart
      ? `${formatISODate(review.periodStart)} → ${formatISODate(review.periodEnd)}`
      : formatISODate(review.periodStart);

  const runReviewMutation = (
    label: string,
    work: () => Promise<void>,
    options?: {
      onSuccess?: () => void;
      refresh?: boolean;
    }
  ) => {
    startTransition(async () => {
      setActionLabel(label);
      await work();
      options?.onSuccess?.();
      setActionLabel('');
      if (options?.refresh !== false) {
        router.refresh();
      }
    });
  };

  const handleSave = () => {
    if (body === (review.body || '')) {
      setIsEditing(false);
      return;
    }

    runReviewMutation('Saving review body…', async () => {
      await updateReviewBodyAction(review.id, body);
    }, {
      onSuccess: () => setIsEditing(false),
    });
  };

  const handlePublish = () => {
    runReviewMutation('Publishing review…', async () => {
      await publishReviewAction(review.id);
    });
  };

  const handleRegenerate = () => {
    if (!confirm('Regenerate refreshes the generated sections while preserving your marked personal sections. Continue?')) {
      return;
    }

    runReviewMutation('Regenerating review…', async () => {
      const result = await regenerateReviewAction(review.id);
      if (result.review) {
        setBody(result.review.body || '');
      }
    });
  };

  const handleDelete = async () => {
    await deleteReviewAction(review.id);
    router.push('/reviews');
  };

  const extractInsight = (insight: string, targetType: 'task' | 'goal') => {
    runReviewMutation(
      targetType === 'task' ? 'Creating follow-up task…' : 'Creating follow-up goal…',
      async () => {
        await extractReviewInsightAction(review.id, targetType, insight);
      }
    );
  };

  return (
    <DetailPageShell
      backHref="/reviews"
      backLabel="Reviews"
      title={formatReviewTitle(review.reviewType)}
      subtitle={periodLabel}
      badge={
        <div className="flex flex-wrap items-center gap-2">
          {review.isPublished ? <StatusBadge status="published" /> : <StatusBadge status="draft" />}
          <span className="shell-meta-pill">
            <Orbit size={12} />
            {formatReviewCadence(review.reviewType)}
          </span>
        </div>
      }
      onArchive={handleDelete}
      destructiveLabel="Delete review"
      actions={
        <div className="flex items-center gap-2">
          {isPending ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-0/82 px-3 py-1.5 text-xs text-text-secondary shadow-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {actionLabel}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(121,95,67,0.14)] bg-[linear-gradient(135deg,rgba(255,251,245,0.92),rgba(245,235,219,0.78))] px-4 py-2 text-sm font-medium text-text-primary transition-all duration-300 ease-luxury hover:border-[rgba(174,93,44,0.18)] hover:bg-[linear-gradient(135deg,rgba(255,252,247,0.98),rgba(248,238,225,0.84))] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </button>
          {!review.isPublished ? (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(96,127,97,0.18)] bg-[rgba(228,239,229,0.92)] px-4 py-2 text-sm font-medium text-[rgb(78,107,81)] transition-all duration-300 ease-luxury hover:bg-[rgba(235,244,236,0.96)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              Publish
            </button>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <section className="surface-panel overflow-hidden p-6">
          <div className="max-w-3xl">
            <div className="section-kicker">{narrative.eyebrow}</div>
            <h2 className="mt-3 font-display text-[clamp(1.95rem,3vw,3.1rem)] leading-[0.96] tracking-[-0.05em] text-text-primary">
              {narrative.headline}
            </h2>
            <p className="mt-4 text-sm leading-7 text-text-secondary">{narrative.summary}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="shell-meta-pill">
              <CalendarRange size={12} />
              {periodLabel}
            </span>
            <span className="shell-meta-pill">
              <NotebookPen size={12} />
              Personal sections stay intact on regenerate
            </span>
            <span className="shell-meta-pill">
              <Sparkles size={12} />
              {bodyWordCount > 0 ? `${bodyWordCount} words in the chapter` : 'Body still waiting for your voice'}
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <CoverCountCard
              icon={Trophy}
              label="Wins"
              count={winsCount}
              toneClass="border-[rgba(96,127,97,0.18)] bg-[rgba(229,241,230,0.9)] text-[rgb(78,107,81)]"
            />
            <CoverCountCard
              icon={AlertTriangle}
              label="Watch"
              count={blockersCount}
              toneClass="border-[rgba(198,150,76,0.18)] bg-[rgba(252,244,223,0.92)] text-[rgb(151,111,34)]"
            />
            <CoverCountCard
              icon={Target}
              label="Focus"
              count={focusCount}
              toneClass="border-[rgba(93,132,186,0.16)] bg-[rgba(231,239,251,0.9)] text-[rgb(71,107,160)]"
            />
          </div>
        </section>

        <aside className="surface-obsidian overflow-hidden p-6">
          <div className="section-kicker text-[rgba(255,232,206,0.58)]">Review Ledger</div>
          <h3 className="mt-3 font-display text-[clamp(1.55rem,2vw,2.1rem)] leading-[0.98] tracking-[-0.04em] text-[rgba(255,245,233,0.98)]">
            Frame the chapter before you edit it.
          </h3>
          <p className="mt-3 text-sm leading-7 text-[rgba(255,235,214,0.7)]">
            This side of the page holds the ritual context: when the review covers, when it was generated, and whether it is still evolving or already fixed as part of the record.
          </p>

          <div className="mt-5 space-y-3">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,233,206,0.54)]">
                Publish state
              </div>
              <div className="mt-2 text-sm font-medium text-[rgba(255,245,233,0.96)]">
                {review.isPublished ? 'Published and stable' : 'Draft and still shapeable'}
              </div>
              <p className="mt-1 text-sm leading-6 text-[rgba(255,235,214,0.68)]">
                {review.isPublished
                  ? 'This review now behaves like a chapter artifact.'
                  : 'You can still regenerate the generated sections and refine the writing.'}
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,233,206,0.54)]">
                Generated
              </div>
              <div className="mt-2 text-sm font-medium text-[rgba(255,245,233,0.96)]">
                {review.generatedAt ? formatDate(review.generatedAt) : 'No generation timestamp'}
              </div>
              <p className="mt-1 text-sm leading-6 text-[rgba(255,235,214,0.68)]">
                Snapshot and generated sections were last created at this checkpoint.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,233,206,0.54)]">
                Updated
              </div>
              <div className="mt-2 text-sm font-medium text-[rgba(255,245,233,0.96)]">
                {formatDate(review.updatedAt)}
              </div>
              <p className="mt-1 text-sm leading-6 text-[rgba(255,235,214,0.68)]">
                Most recent change to the review body, state, or extracted structure.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,233,206,0.54)]">
                Extraction lane
              </div>
              <div className="mt-2 text-sm font-medium text-[rgba(255,245,233,0.96)]">
                Turn insight into commitments
              </div>
              <p className="mt-1 text-sm leading-6 text-[rgba(255,235,214,0.68)]">
                Each highlight below can become a task or a goal without leaving the review, which keeps reflection tightly connected to action.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {snapshot ? (
        <section className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="section-kicker">Snapshot Gallery</div>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-text-primary">
                The period as signals, not just prose.
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-text-secondary">
                Use these measurements as a memory scaffold. They should sharpen the narrative, not replace it.
              </p>
            </div>
            <span className="shell-meta-pill">
              <ArrowUpRight size={12} />
              {snapshotCards.length} measured panel{snapshotCards.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {snapshotCards.map((card) => (
              <SnapshotCard key={card.label} card={card} />
            ))}
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-[rgba(121,95,67,0.12)] bg-[rgba(255,250,243,0.78)] text-text-secondary shadow-soft">
              <CircleDashed size={18} />
            </span>
            <div>
              <div className="section-kicker">Snapshot Gallery</div>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-text-primary">
                No snapshot was stored with this review.
              </h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary">
                The reflective writing surface is still fully usable. Newer reviews will include measured snapshots automatically, but this chapter may predate that capability or have been created without one.
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <InsightColumn
          icon={Trophy}
          label="Highlights"
          title="What worked"
          description="Keep the wins concrete enough that you can repeat the conditions, not just admire the outcome."
          items={snapshot?.wins ?? []}
          toneClass="border-[rgba(96,127,97,0.18)] bg-[rgba(229,241,230,0.9)] text-[rgb(78,107,81)]"
          onTask={(insight) => extractInsight(insight, 'task')}
          onGoal={(insight) => extractInsight(insight, 'goal')}
          disabled={isPending}
          emptyLabel="No explicit wins were recorded in the generated snapshot. Add them in the body if they still matter."
        />
        <InsightColumn
          icon={AlertTriangle}
          label="Friction"
          title="What needs watching"
          description="These are the places where attention kept snagging, drifting, or failing to land cleanly."
          items={snapshot?.blockers ?? []}
          toneClass="border-[rgba(198,150,76,0.18)] bg-[rgba(252,244,223,0.92)] text-[rgb(151,111,34)]"
          onTask={(insight) => extractInsight(insight, 'task')}
          onGoal={(insight) => extractInsight(insight, 'goal')}
          disabled={isPending}
          emptyLabel="No blockers were captured here. If the period still felt rough, add the nuance in the review body."
        />
        <InsightColumn
          icon={Target}
          label="Direction"
          title="What deserves focus next"
          description="Use focus areas as a bridge between reflection and the next period’s intentional shape."
          items={snapshot?.focusAreas ?? []}
          toneClass="border-[rgba(93,132,186,0.16)] bg-[rgba(231,239,251,0.9)] text-[rgb(71,107,160)]"
          onTask={(insight) => extractInsight(insight, 'task')}
          onGoal={(insight) => extractInsight(insight, 'goal')}
          disabled={isPending}
          emptyLabel="No focus areas were generated. The body below is the right place to define the next chapter in your own words."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-line-soft/60 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="section-kicker">Field Notes</div>
                <h3 className="mt-3 font-display text-[clamp(1.5rem,2vw,2.15rem)] leading-[0.98] tracking-[-0.04em] text-text-primary">
                  Write the interpretation, not just the data.
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary">
                  This is the part of the review that should sound unmistakably like you. Keep the measured snapshot as context and let the body hold the meaning, lessons, and commitments.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="shell-meta-pill">
                  <NotebookPen size={12} />
                  {bodyWordCount > 0 ? `${bodyWordCount} words` : 'Waiting for your voice'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isEditing) {
                      handleSave();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(121,95,67,0.14)] bg-[linear-gradient(135deg,rgba(255,251,245,0.92),rgba(245,235,219,0.78))] px-4 py-2 text-sm font-medium text-text-primary transition-all duration-300 ease-luxury hover:border-[rgba(174,93,44,0.18)] hover:bg-[linear-gradient(135deg,rgba(255,252,247,0.98),rgba(248,238,225,0.84))] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEditing ? 'Save body' : 'Edit body'}
                </button>
                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBody(review.body || '');
                      setIsEditing(false);
                    }}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface-0/82 px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-brand-300 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="rounded-[1.7rem] border border-[rgba(121,95,67,0.12)] bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(248,239,228,0.84))] p-5 shadow-[inset_0_1px_0_rgba(255,252,246,0.92),0_26px_52px_-42px_rgba(58,39,24,0.28)]">
              {isEditing ? (
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={24}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      handleSave();
                    }
                    if (event.key === 'Escape') {
                      setBody(review.body || '');
                      setIsEditing(false);
                    }
                  }}
                  className="min-h-[24rem] w-full resize-y rounded-[1.35rem] border border-[rgba(174,93,44,0.16)] bg-[rgba(255,253,249,0.94)] px-4 py-4 text-sm leading-8 text-text-primary shadow-[inset_0_1px_0_rgba(255,252,246,0.96),0_20px_40px_-32px_rgba(58,39,24,0.18)] outline-none transition-shadow focus:border-[rgba(174,93,44,0.24)] focus:shadow-[inset_0_1px_0_rgba(255,252,246,0.96),0_24px_46px_-34px_rgba(58,39,24,0.22),0_0_0_4px_rgba(255,234,208,0.72)]"
                  placeholder={getReflectionPrompt(review.reviewType)}
                />
              ) : body.trim() ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-8 text-text-primary">{body}</pre>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-[rgba(121,95,67,0.16)] bg-[rgba(255,250,243,0.6)] px-4 py-5 text-sm leading-7 text-text-secondary">
                  {getReflectionPrompt(review.reviewType)}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
                <span>Use <kbd className="capture-command-kbd">Cmd</kbd> + <kbd className="capture-command-kbd">Enter</kbd> to save quickly.</span>
                <span>{bodyWordCount > 0 ? `${bodyWordCount} words in the current draft` : 'Start with the strongest signal from the period.'}</span>
              </div>
            ) : null}
          </div>
        </section>

        <div className="space-y-4">
          <section className="detail-side-panel">
            <div className="detail-panel-header">
              <div>
                <div className="section-kicker">Ritual Notes</div>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">
                  How to use this page well.
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-sm leading-7 text-text-secondary">
              <div className="rounded-[1.2rem] border border-[rgba(121,95,67,0.12)] bg-[rgba(255,251,245,0.72)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,252,246,0.88),0_16px_30px_-24px_rgba(58,39,24,0.16)]">
                Regeneration refreshes the computed sections while leaving the marked personal writing intact, so the review can keep evolving without losing your authored interpretation.
              </div>
              <div className="rounded-[1.2rem] border border-[rgba(121,95,67,0.12)] bg-[rgba(255,251,245,0.72)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,252,246,0.88),0_16px_30px_-24px_rgba(58,39,24,0.16)]">
                Publish when the chapter feels representative enough that you want to preserve it as a stable checkpoint, not while you are still sketching what it meant.
              </div>
              <div className="rounded-[1.2rem] border border-[rgba(121,95,67,0.12)] bg-[rgba(255,251,245,0.72)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,252,246,0.88),0_16px_30px_-24px_rgba(58,39,24,0.16)]">
                The best extracted actions are specific. If an insight still feels vague, sharpen the language in the body first and then turn it into a task or goal.
              </div>
            </div>
          </section>

          <section className="detail-side-panel">
            <div className="detail-panel-header">
              <div>
                <div className="section-kicker">Tags</div>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">
                  Retrieval, themes, and chapter links.
                </h3>
              </div>
            </div>
            <TagsPills itemType="review" itemId={review.id} tags={tags} />
          </section>
        </div>
      </div>

      <RelationsPanel
        items={relatedItems}
        structuralItems={structuralItems}
        suggestions={suggestedItems}
        currentItemType="review"
        currentItemId={review.id}
      />
    </DetailPageShell>
  );
}
