'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { createJournalAction } from '@/app/actions';
import { cn } from '@/lib/cn';
import { SecondaryLaunchButton } from '@/components/experience/secondary-create-dialog';

export function QuickJournalForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<number | undefined>();
  const [energy, setEnergy] = useState<number | undefined>();

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set('body', body);
    if (mood) formData.set('mood', String(mood));
    if (energy) formData.set('energy', String(energy));

    await createJournalAction(formData);
    setBody('');
    setMood(undefined);
    setEnergy(undefined);
    setIsSubmitting(false);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <SecondaryLaunchButton
        icon={BookOpen}
        label="Open the journal"
        detail="Capture a field note, emotional pulse, or longer reflection without switching contexts."
        onClick={() => setIsOpen(true)}
        variant="panel"
      />
    );
  }

  return (
    <div className="secondary-inline-form space-y-4">
      <div>
        <div className="section-kicker">Reflection Ledger</div>
        <h3 className="mt-2 font-display text-[1.65rem] leading-none tracking-[-0.05em] text-text-primary">
          Write a journal entry
        </h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Keep it honest and unfinished if needed. The goal here is to catch the texture of the moment, not produce a polished artifact.
        </p>
      </div>

      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write freely... Use markdown if you like."
        rows={5}
        className="secondary-textarea min-h-[10rem] resize-none"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SignalSelector
          label="Mood"
          helper="How the moment feels emotionally."
          value={mood}
          onSelect={setMood}
          activeClassName="border-[rgba(174,93,44,0.2)] bg-[linear-gradient(135deg,rgba(201,143,88,0.92)_0%,rgba(174,93,44,0.88)_100%)] text-white"
        />
        <SignalSelector
          label="Energy"
          helper="How much fuel is actually available."
          value={energy}
          onSelect={setEnergy}
          activeClassName="border-[rgba(95,116,95,0.2)] bg-[linear-gradient(135deg,rgba(115,146,117,0.92)_0%,rgba(95,116,95,0.88)_100%)] text-white"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setBody('');
            setMood(undefined);
            setEnergy(undefined);
          }}
          className="secondary-toolbar-button"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !body.trim()}
          className={cn(
            'secondary-toolbar-button bg-[linear-gradient(135deg,rgba(201,143,88,0.96)_0%,rgba(174,93,44,0.92)_100%)] text-white',
            'border-[rgba(174,93,44,0.18)] hover:text-white disabled:opacity-50'
          )}
        >
          {isSubmitting ? 'Saving...' : 'Save Entry'}
        </button>
      </div>
    </div>
  );
}

function SignalSelector({
  label,
  helper,
  value,
  onSelect,
  activeClassName,
}: {
  label: string;
  helper: string;
  value: number | undefined;
  onSelect: (next: number | undefined) => void;
  activeClassName: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[rgba(121,95,67,0.1)] bg-[rgba(255,251,245,0.62)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,252,246,0.82)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
            {label}
          </div>
          <p className="mt-1 text-2xs leading-5 text-text-secondary">{helper}</p>
        </div>
        {value ? <span className="secondary-chip">{value}/10</span> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((nextValue) => (
          <button
            key={nextValue}
            type="button"
            onClick={() => onSelect(value === nextValue ? undefined : nextValue)}
            className={cn(
              'secondary-meter-button',
              value === nextValue ? activeClassName : ''
            )}
          >
            {nextValue}
          </button>
        ))}
      </div>
    </div>
  );
}
