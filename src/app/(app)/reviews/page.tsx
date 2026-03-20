import { ClipboardList, Calendar, Check, Eye } from 'lucide-react';
import { formatReviewTypeLabel, getAllReviews } from '@/server/services/reviews';
import { formatISODate, startOfWeek } from '@/lib/utils';
import { GenerateReviewButton } from './generate-button';
import Link from 'next/link';
import type { ReviewType } from '@/lib/types';

export const metadata = { title: 'Reviews — lifeOS' };
export const dynamic = 'force-dynamic';

export default function ReviewsPage() {
  const reviews = getAllReviews();

  const currentWeekStart = startOfWeek(new Date());
  const hasCurrentWeekReview = reviews.some(
    (r) => r.reviewType === 'weekly' && r.periodStart === currentWeekStart
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Reviews</h1>
        {!hasCurrentWeekReview && <GenerateReviewButton />}
      </div>

      {/* Current week prompt */}
      {!hasCurrentWeekReview && reviews.length > 0 && (
        <div className="card border-l-4 border-l-brand-primary">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-brand-primary" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                This week&apos;s review isn&apos;t generated yet
              </p>
              <p className="text-xs text-text-tertiary">
                Generate it to see what happened this week.
              </p>
            </div>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="card py-16 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <h2 className="mb-1 text-lg font-medium text-text-primary">
            No reviews yet
          </h2>
          <p className="mb-4 text-sm text-text-tertiary">
            Generate your first weekly review to reflect on what happened.
          </p>
          <GenerateReviewButton large />
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/reviews/${review.id}`}
              className="card block transition-colors hover:bg-surface-hover"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10">
                    <Calendar className="h-4 w-4 text-brand-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {formatReviewTypeLabel(review.reviewType as ReviewType)}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {formatISODate(review.periodStart)} → {formatISODate(review.periodEnd!)}
                    </p>
                    {review.statsSnapshot && (
                      <ReviewSnapshotSummary snapshot={review.statsSnapshot} />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {review.isPublished ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-2xs font-medium text-green-600">
                      <Check className="h-3 w-3" />
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-tertiary px-2 py-0.5 text-2xs font-medium text-text-muted">
                      <Eye className="h-3 w-3" />
                      Draft
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewSnapshotSummary({ snapshot }: { snapshot: string }) {
  try {
    const data = JSON.parse(snapshot);
    const parts: string[] = [];
    if (data.tasks?.completed !== undefined) parts.push(`${data.tasks.completed} tasks done`);
    if (data.habits?.totalCompletions !== undefined) parts.push(`${data.habits.totalCompletions} habit checks`);
    if (data.journal?.entryCount !== undefined) parts.push(`${data.journal.entryCount} entries`);
    if (parts.length === 0) return null;
    return (
      <p className="mt-1 text-2xs text-text-muted">
        {parts.join(' · ')}
      </p>
    );
  } catch {
    return null;
  }
}
