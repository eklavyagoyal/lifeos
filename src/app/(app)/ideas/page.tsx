import Link from 'next/link';
import { getAllIdeas } from '@/server/services/ideas';
import { CreateIdeaButton } from '@/components/ideas/create-idea-button';
import { formatDate } from '@/lib/utils';
import { Lightbulb } from 'lucide-react';

export const metadata = { title: 'Ideas — lifeOS' };
export const dynamic = 'force-dynamic';

const STAGE_EMOJI: Record<string, string> = {
  seed: '🌱',
  developing: '🌿',
  mature: '🌳',
  implemented: '✅',
  archived: '📦',
};

const STAGE_COLORS: Record<string, string> = {
  seed: 'bg-yellow-50 text-yellow-700',
  developing: 'bg-green-50 text-green-700',
  mature: 'bg-emerald-50 text-emerald-700',
  implemented: 'bg-blue-50 text-blue-700',
  archived: 'bg-surface-2 text-text-muted',
};

export default function IdeasPage() {
  const allIdeas = getAllIdeas();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker">Spark Archive</div>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Ideas</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            These cards should feel light enough for unfinished thoughts, but still integrated into the same material language as the rest of the branch.
          </p>
        </div>
        <CreateIdeaButton />
      </div>

      {allIdeas.length === 0 ? (
        <div className="secondary-empty-state py-12">
          <Lightbulb size={32} className="mb-2 text-text-muted" />
          <p className="text-sm text-text-secondary">No ideas yet</p>
          <p className="text-2xs text-text-muted mt-1">
            Capture your first idea — seeds grow into projects.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allIdeas.map((idea) => (
            <Link key={idea.id} href={`/ideas/${idea.id}`}>
              <div className="secondary-card cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium text-text-primary truncate flex-1">{idea.title}</h3>
                  {idea.stage && (
                    <span className={`secondary-chip shrink-0 ${STAGE_COLORS[idea.stage] ?? 'bg-surface-2 text-text-muted'}`}>
                      {STAGE_EMOJI[idea.stage] ?? ''} {idea.stage}
                    </span>
                  )}
                </div>
                {idea.summary && (
                  <p className="mt-3 text-sm leading-6 text-text-tertiary line-clamp-3">
                    {idea.summary}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  {idea.theme && (
                    <span className="secondary-chip text-2xs">
                      {idea.theme}
                    </span>
                  )}
                  <span className="text-2xs text-text-muted">
                    {formatDate(idea.updatedAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
