'use client';

import { useState } from 'react';
import { createIdeaAction } from '@/app/actions';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  SecondaryDialogShell,
  SecondaryLaunchButton,
} from '@/components/experience/secondary-create-dialog';

export function CreateIdeaButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    await createIdeaAction(formData);
    setIsSubmitting(false);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <SecondaryLaunchButton
        icon={Lightbulb}
        label="New idea"
        detail="Capture a seed"
        onClick={() => setIsOpen(true)}
      />
    );
  }

  return (
    <SecondaryDialogShell
      open={isOpen}
      onClose={() => setIsOpen(false)}
      icon={Lightbulb}
      eyebrow="Spark Capture"
      title="Capture a new idea"
      description="Keep the first pass small and alive. The goal is to preserve the spark before it gets forced into structure."
      footer={(
        <>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="secondary-toolbar-button"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="idea-create-form"
            disabled={isSubmitting}
            className={cn(
              'secondary-toolbar-button bg-[linear-gradient(135deg,rgba(201,143,88,0.96)_0%,rgba(174,93,44,0.92)_100%)] text-white',
              'border-[rgba(174,93,44,0.18)] hover:text-white disabled:opacity-50'
            )}
          >
            {isSubmitting ? 'Capturing...' : 'Capture Idea'}
          </button>
        </>
      )}
    >
      <form
        id="idea-create-form"
        action={handleSubmit}
        className="space-y-3"
      >
        <input
          autoFocus
          name="title"
          type="text"
          required
          placeholder="Idea title"
          className="secondary-input"
        />
        <input
          name="summary"
          type="text"
          placeholder="Quick summary (one-liner)"
          className="secondary-input"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            name="stage"
            defaultValue="seed"
            className="secondary-select"
          >
            <option value="seed">🌱 Seed</option>
            <option value="developing">🌿 Developing</option>
            <option value="mature">🌳 Mature</option>
          </select>
          <input
            name="theme"
            type="text"
            placeholder="Theme (optional)"
            className="secondary-input"
          />
        </div>
      </form>
    </SecondaryDialogShell>
  );
}
