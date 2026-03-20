'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { StatusBadge } from '@/components/detail/status-badge';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import {
  updateReviewBodyAction,
  publishReviewAction,
  deleteReviewAction,
  regenerateReviewAction,
  extractReviewInsightAction,
} from '@/app/actions';
import { formatISODate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import {
  Check,
  RefreshCw,
  Loader2,
  BarChart3,
  Trophy,
  AlertTriangle,
  Target,
  BookOpen,
  ListChecks,
  Sparkles,
  Dumbbell,
} from 'lucide-react';

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

function formatReviewTitle(reviewType: string): string {
  if (!reviewType) return 'Review';
  return `${reviewType[0].toUpperCase()}${reviewType.slice(1)} Review`;
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

  const snapshot = parseSnapshot(review.statsSnapshot);

  const handleSave = useCallback(() => {
    if (body === review.body) {
      setIsEditing(false);
      return;
    }
    startTransition(async () => {
      setActionLabel('Saving…');
      await updateReviewBodyAction(review.id, body);
      setIsEditing(false);
      setActionLabel('');
      router.refresh();
    });
  }, [body, review.body, review.id, router]);

  const handlePublish = () => {
    startTransition(async () => {
      setActionLabel('Publishing…');
      await publishReviewAction(review.id);
      setActionLabel('');
      router.refresh();
    });
  };

  const handleRegenerate = () => {
    if (!confirm('Regenerate refreshes the generated sections while preserving your marked personal sections. Continue?')) return;
    startTransition(async () => {
      setActionLabel('Regenerating…');
      const result = await regenerateReviewAction(review.id);
      if (result.review) {
        setBody(result.review.body || '');
      }
      setActionLabel('');
      router.refresh();
    });
  };

  const handleDelete = async () => {
    await deleteReviewAction(review.id);
    router.push('/reviews');
  };

  const periodLabel = review.periodEnd && review.periodEnd !== review.periodStart
    ? `${formatISODate(review.periodStart)} → ${formatISODate(review.periodEnd)}`
    : formatISODate(review.periodStart);

  return (
    <DetailPageShell
      backHref="/reviews"
      backLabel="Reviews"
      title={formatReviewTitle(review.reviewType)}
      subtitle={periodLabel}
      badge={
        review.isPublished ? (
          <StatusBadge status="published" />
        ) : (
          <StatusBadge status="draft" />
        )
      }
      onArchive={handleDelete}
      actions={
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              {actionLabel}
            </span>
          )}
          <button
            onClick={handleRegenerate}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors disabled:opacity-50"
            title="Regenerate from current data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </button>
          {!review.isPublished && (
            <button
              onClick={handlePublish}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Publish
            </button>
          )}
        </div>
      }
    >
      {/* Stats summary grid */}
      {snapshot && <StatsGrid snapshot={snapshot} />}

      {/* Insights cards */}
      {snapshot && <InsightsCards reviewId={review.id} snapshot={snapshot} />}

      {/* Body editor */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Review Body
            </h3>
            <p className="mt-1 text-2xs text-text-muted">
              The personal notes, lessons, and commitments sections are preserved when you regenerate.
            </p>
          </div>
          <button
            onClick={() => {
              if (isEditing) {
                handleSave();
              } else {
                setIsEditing(true);
              }
            }}
            className="text-xs text-brand-primary hover:underline"
          >
            {isEditing ? 'Save' : 'Edit'}
          </button>
        </div>

        {isEditing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={handleSave}
            rows={25}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none font-mono leading-relaxed"
            placeholder="Review body…"
          />
        ) : (
          <div className="prose-sm">
            {body ? (
              <pre className="whitespace-pre-wrap font-sans text-sm text-text-secondary leading-relaxed">
                {body}
              </pre>
            ) : (
              <p className="text-sm text-text-muted italic">No content yet.</p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="mb-2 text-2xs font-medium uppercase tracking-wider text-text-muted">
          Tags
        </h3>
        <TagsPills itemType="review" itemId={review.id} tags={tags} />
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

// ============================================================
// Stats Grid
// ============================================================

interface SnapshotData {
  tasks?: { completed?: number; created?: number; overdue?: number };
  habits?: { totalCompletions?: number; possibleCompletions?: number; completionRate?: number };
  metrics?: { moodAvg?: number | null; energyAvg?: number | null; sleepAvg?: number | null; workoutMinutes?: number };
  journal?: { entryCount?: number; totalWords?: number };
  projects?: { activeCount?: number };
  goals?: { activeCount?: number };
  ideas?: { capturedCount?: number };
  wins?: string[];
  blockers?: string[];
  focusAreas?: string[];
}

function parseSnapshot(raw: string | null): SnapshotData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function StatsGrid({ snapshot }: { snapshot: SnapshotData }) {
  const stats: { icon: React.ReactNode; label: string; value: string }[] = [];

  if (snapshot.tasks) {
    stats.push({
      icon: <ListChecks className="h-4 w-4 text-blue-500" />,
      label: 'Tasks Done',
      value: String(snapshot.tasks.completed ?? 0),
    });
  }
  if (snapshot.habits) {
    stats.push({
      icon: <Dumbbell className="h-4 w-4 text-green-500" />,
      label: 'Habit Consistency',
      value: `${snapshot.habits.completionRate ?? 0}%`,
    });
  }
  if (snapshot.metrics?.moodAvg != null) {
    stats.push({
      icon: <Sparkles className="h-4 w-4 text-yellow-500" />,
      label: 'Avg Mood',
      value: snapshot.metrics.moodAvg.toFixed(1),
    });
  }
  if (snapshot.metrics?.sleepAvg != null) {
    stats.push({
      icon: <BarChart3 className="h-4 w-4 text-indigo-500" />,
      label: 'Avg Sleep',
      value: `${snapshot.metrics.sleepAvg.toFixed(1)}h`,
    });
  }
  if (snapshot.journal) {
    stats.push({
      icon: <BookOpen className="h-4 w-4 text-purple-500" />,
      label: 'Journal Entries',
      value: String(snapshot.journal.entryCount ?? 0),
    });
  }
  if (snapshot.ideas) {
    stats.push({
      icon: <Target className="h-4 w-4 text-orange-500" />,
      label: 'Ideas Captured',
      value: String(snapshot.ideas.capturedCount ?? 0),
    });
  }

  if (stats.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-3">
        Review Snapshot
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
              {s.icon}
            </div>
            <div>
              <p className="text-lg font-semibold text-text-primary leading-tight">{s.value}</p>
              <p className="text-2xs text-text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Insights Cards (wins, blockers, focus areas)
// ============================================================

function InsightsCards({
  reviewId,
  snapshot,
}: {
  reviewId: string;
  snapshot: SnapshotData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasWins = snapshot.wins && snapshot.wins.length > 0;
  const hasBlockers = snapshot.blockers && snapshot.blockers.length > 0;
  const hasFocus = snapshot.focusAreas && snapshot.focusAreas.length > 0;

  if (!hasWins && !hasBlockers && !hasFocus) return null;

  const extractInsight = (insight: string, targetType: 'task' | 'goal') => {
    startTransition(async () => {
      await extractReviewInsightAction(reviewId, targetType, insight);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {hasWins && (
        <div className="card border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-green-500" />
            <h4 className="text-xs font-semibold text-text-primary">Wins</h4>
          </div>
          <ul className="space-y-1">
            {snapshot.wins!.map((w, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-xs text-text-secondary">
                <span className="flex-1">• {w}</span>
                <InsightButtons
                  disabled={isPending}
                  onTask={() => extractInsight(w, 'task')}
                  onGoal={() => extractInsight(w, 'goal')}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasBlockers && (
        <div className="card border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h4 className="text-xs font-semibold text-text-primary">Watch</h4>
          </div>
          <ul className="space-y-1">
            {snapshot.blockers!.map((b, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-xs text-text-secondary">
                <span className="flex-1">• {b}</span>
                <InsightButtons
                  disabled={isPending}
                  onTask={() => extractInsight(b, 'task')}
                  onGoal={() => extractInsight(b, 'goal')}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasFocus && (
        <div className="card border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-500" />
            <h4 className="text-xs font-semibold text-text-primary">Focus Areas</h4>
          </div>
          <ul className="space-y-1">
            {snapshot.focusAreas!.map((f, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-xs text-text-secondary">
                <span className="flex-1">• {f}</span>
                <InsightButtons
                  disabled={isPending}
                  onTask={() => extractInsight(f, 'task')}
                  onGoal={() => extractInsight(f, 'goal')}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InsightButtons({
  disabled,
  onTask,
  onGoal,
}: {
  disabled: boolean;
  onTask: () => void;
  onGoal: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        onClick={onTask}
        disabled={disabled}
        className="rounded-md bg-surface-2 px-2 py-1 text-2xs font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
      >
        Task
      </button>
      <button
        onClick={onGoal}
        disabled={disabled}
        className="rounded-md bg-surface-2 px-2 py-1 text-2xs font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
      >
        Goal
      </button>
    </div>
  );
}
