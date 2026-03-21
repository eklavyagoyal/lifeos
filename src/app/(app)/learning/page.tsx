import Link from 'next/link';
import { getAllLearningItems } from '@/server/services/entities';
import { CreateLearningButton } from '@/components/learning/create-learning-button';
import { formatDate } from '@/lib/utils';
import { GraduationCap } from 'lucide-react';

export const metadata = { title: 'Learning — lifeOS' };
export const dynamic = 'force-dynamic';

const TYPE_EMOJI: Record<string, string> = {
  book: '📚',
  article: '📄',
  course: '🎓',
};

const STATUS_COLORS: Record<string, string> = {
  to_read: 'bg-yellow-50 text-yellow-700',
  reading: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-blue-50 text-blue-700',
  planned: 'bg-surface-2 text-text-muted',
  completed: 'bg-green-50 text-green-700',
  read: 'bg-green-50 text-green-700',
  abandoned: 'bg-red-50 text-red-600',
};

export default function LearningPage() {
  const items = getAllLearningItems();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker">Apprenticeship</div>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Learning</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            This shelf should read like an evolving study table: calm, legible, and still clearly part of the same world as the flagship routes.
          </p>
        </div>
        <CreateLearningButton />
      </div>

      {items.length === 0 ? (
        <div className="secondary-empty-state py-12">
          <GraduationCap size={32} className="mb-2 text-text-muted" />
          <p className="text-sm text-text-secondary">Nothing tracked yet</p>
          <p className="text-2xs text-text-muted mt-1">
            Add a book, article, or course to start tracking your learning.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const meta = item.parsedMetadata as Record<string, string>;
            const status = meta?.status;
            return (
              <Link key={item.id} href={`/learning/${item.id}`}>
                <div className="secondary-card cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-base shrink-0">{TYPE_EMOJI[item.entityType] ?? '📖'}</span>
                      <h3 className="text-sm font-medium text-text-primary truncate">{item.title}</h3>
                    </div>
                    {status && (
                      <span className={`secondary-chip text-2xs shrink-0 ${STATUS_COLORS[status] ?? 'bg-surface-2 text-text-muted'}`}>
                        {status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  {meta?.author && (
                    <p className="mt-1 text-2xs text-text-tertiary">by {meta.author}</p>
                  )}
                  {meta?.platform && (
                    <p className="mt-1 text-2xs text-text-tertiary">{meta.platform}</p>
                  )}
                  {item.body && (
                    <p className="mt-3 text-sm leading-6 text-text-tertiary line-clamp-3">
                      {item.body.slice(0, 120)}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="secondary-chip text-2xs capitalize">
                      {item.entityType}
                    </span>
                    <span className="text-2xs text-text-muted">
                      {formatDate(item.updatedAt)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
