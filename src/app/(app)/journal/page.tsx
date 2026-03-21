import { getAllJournalEntries } from '@/server/services/journal';
import { JournalEntryCard } from '@/components/journal/journal-entry-card';
import { QuickJournalForm } from '@/components/journal/quick-journal-form';

export const metadata = { title: 'Journal — lifeOS' };
export const dynamic = 'force-dynamic';

export default function JournalPage() {
  const entries = getAllJournalEntries();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker">Memory Field</div>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Journal</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            These entries should feel intimate and readable, like field notes you actually want to return to.
          </p>
        </div>
        <span className="shell-meta-pill">
          {entries.length} entries
        </span>
      </div>

      <QuickJournalForm />

      <div className="space-y-3">
        {entries.length === 0 && (
          <div className="secondary-empty-state py-8">
            <p className="text-sm text-text-muted">No journal entries yet.</p>
            <p className="text-2xs text-text-muted mt-1">Write your first entry above.</p>
          </div>
        )}
        {entries.map((entry) => (
          <JournalEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
