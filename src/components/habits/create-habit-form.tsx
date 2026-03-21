'use client';

import { useState } from 'react';
import { createHabitAction } from '@/app/actions';
import { Repeat } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SecondaryLaunchButton } from '@/components/experience/secondary-create-dialog';

const DOMAINS = [
  { value: 'health', label: 'Health' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'learning', label: 'Learning' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'finance', label: 'Finance' },
  { value: 'creativity', label: 'Creativity' },
  { value: 'reflection', label: 'Reflection' },
];

export function CreateHabitForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    await createHabitAction(formData);
    setIsSubmitting(false);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <SecondaryLaunchButton
        icon={Repeat}
        label="Start a new rhythm"
        detail="Add a habit with a domain and difficulty so it fits the rest of the system cleanly."
        onClick={() => setIsOpen(true)}
        variant="panel"
      />
    );
  }

  return (
    <form action={handleSubmit} className="secondary-inline-form space-y-4">
      <div>
        <div className="section-kicker">Habit Capture</div>
        <h3 className="mt-2 font-display text-[1.65rem] leading-none tracking-[-0.05em] text-text-primary">
          Add a habit
        </h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Keep the setup lightweight now. You can refine cadence, reminders, and relationships from the detail page after it exists.
        </p>
      </div>

      <input
        autoFocus
        name="name"
        type="text"
        required
        placeholder="Habit name (e.g., Meditate)"
        className="secondary-input"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          name="domain"
          className="secondary-select"
        >
          <option value="">Domain (optional)</option>
          {DOMAINS.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        <select
          name="difficulty"
          defaultValue="medium"
          className="secondary-select"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="secondary-toolbar-button"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'secondary-toolbar-button bg-[linear-gradient(135deg,rgba(201,143,88,0.96)_0%,rgba(174,93,44,0.92)_100%)] text-white',
            'border-[rgba(174,93,44,0.18)] hover:text-white disabled:opacity-50'
          )}
        >
          {isSubmitting ? 'Creating...' : 'Create Habit'}
        </button>
      </div>
    </form>
  );
}
