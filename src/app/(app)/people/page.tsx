import Link from 'next/link';
import { getAllPeople } from '@/server/services/entities';
import { CreatePersonButton } from '@/components/people/create-person-button';
import { formatDate } from '@/lib/utils';
import { Users } from 'lucide-react';

export const metadata = { title: 'People — lifeOS' };
export const dynamic = 'force-dynamic';

export default function PeoplePage() {
  const people = getAllPeople();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker">People Constellation</div>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">People</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Relationship cards should feel warm and structured, with just enough context to remember the human shape around the name.
          </p>
        </div>
        <CreatePersonButton />
      </div>

      {people.length === 0 ? (
        <div className="secondary-empty-state py-12">
          <Users size={32} className="mb-2 text-text-muted" />
          <p className="text-sm text-text-secondary">No people added yet</p>
          <p className="text-2xs text-text-muted mt-1">
            Add people you interact with to track context and connections.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => {
            const meta = person.parsedMetadata as Record<string, string>;
            return (
              <Link key={person.id} href={`/people/${person.id}`}>
                <div className="secondary-card cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="secondary-icon-badge rounded-full text-sm font-semibold text-[rgba(176,109,137,0.92)]">
                      {person.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-text-primary truncate">{person.title}</h3>
                      <div className="flex items-center gap-2">
                        {meta?.relationship && (
                          <span className="text-2xs text-text-tertiary">{meta.relationship}</span>
                        )}
                        {meta?.company && (
                          <span className="text-2xs text-text-muted">· {meta.company}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {person.body && (
                    <p className="mt-3 text-sm leading-6 text-text-tertiary line-clamp-3">
                      {person.body.slice(0, 120)}
                    </p>
                  )}
                  <p className="mt-4 text-2xs text-text-muted">
                    {formatDate(person.updatedAt)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
