import Link from 'next/link';
import { formatISODate } from '@/lib/utils';
import { ENERGY_LABELS, MOOD_LABELS } from '@/lib/constants';
import { cn } from '@/lib/cn';

interface JournalEntry {
  id: string;
  title: string | null;
  body: string | null;
  entryDate: string;
  entryTime: string | null;
  entryType: string | null;
  mood: number | null;
  energy: number | null;
  wordCount: number | null;
}

export function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  const preview = entry.body
    ? entry.body.length > 200
      ? entry.body.slice(0, 200) + '...'
      : entry.body
    : null;

  return (
    <Link href={`/journal/${entry.id}`}>
      <div className="secondary-card group cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="section-kicker">Field Note</div>
            <h3 className="mt-2 text-base font-medium text-text-primary">
              {entry.title || 'Untitled journal entry'}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs text-text-tertiary">
              <span className="secondary-chip">{formatISODate(entry.entryDate)}</span>
              {entry.entryTime ? <span className="secondary-chip">at {entry.entryTime}</span> : null}
              {entry.entryType && entry.entryType !== 'freeform' ? (
                <span className="secondary-chip capitalize">{entry.entryType}</span>
              ) : null}
            </div>
          </div>

          <div className="grid shrink-0 gap-2 sm:grid-cols-1">
            {entry.mood ? (
              <SignalReadout
                label="Mood"
                value={`${entry.mood}/10`}
                note={MOOD_LABELS[entry.mood]}
                tone={entry.mood}
              />
            ) : null}
            {entry.energy ? (
              <SignalReadout
                label="Energy"
                value={`${entry.energy}/10`}
                note={ENERGY_LABELS[entry.energy]}
                tone={entry.energy}
              />
            ) : null}
          </div>
        </div>

        {preview ? (
          <p className="mt-4 text-sm leading-7 text-text-secondary">
            {preview}
          </p>
        ) : (
          <p className="mt-4 text-sm italic leading-7 text-text-muted">
            This entry is mostly metadata for now. Open it to keep writing.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {entry.wordCount ? (
            <span className="secondary-chip">{entry.wordCount} words</span>
          ) : null}
          <span className="text-2xs text-text-muted">Open to read or continue the entry.</span>
        </div>
      </div>
    </Link>
  );
}

function SignalReadout({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: number;
}) {
  return (
    <div className="rounded-[1.1rem] border border-[rgba(121,95,67,0.11)] bg-[rgba(255,251,245,0.7)] px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,252,246,0.82)]">
      <div className="text-2xs uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div
        className={cn(
          'mt-1 text-sm font-semibold',
          tone >= 7 ? 'text-status-success' : tone >= 4 ? 'text-text-secondary' : 'text-status-danger'
        )}
      >
        {value}
      </div>
      <div className="text-2xs text-text-tertiary">{note}</div>
    </div>
  );
}
