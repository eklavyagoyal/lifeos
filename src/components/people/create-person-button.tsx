'use client';

import { useState } from 'react';
import { createEntityAction } from '@/app/actions';
import { Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  SecondaryDialogShell,
  SecondaryLaunchButton,
} from '@/components/experience/secondary-create-dialog';

export function CreatePersonButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    formData.set('entityType', 'person');
    await createEntityAction(formData);
    setIsSubmitting(false);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <SecondaryLaunchButton
        icon={Users}
        label="Add person"
        detail="Start a relationship card"
        onClick={() => setIsOpen(true)}
      />
    );
  }

  return (
    <SecondaryDialogShell
      open={isOpen}
      onClose={() => setIsOpen(false)}
      icon={Users}
      eyebrow="Relationship Ledger"
      title="Add a person"
      description="Capture just enough context to remember who they are and why they matter. You can deepen the page later."
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
            form="person-create-form"
            disabled={isSubmitting}
            className={cn(
              'secondary-toolbar-button bg-[linear-gradient(135deg,rgba(201,143,88,0.96)_0%,rgba(174,93,44,0.92)_100%)] text-white',
              'border-[rgba(174,93,44,0.18)] hover:text-white disabled:opacity-50'
            )}
          >
            {isSubmitting ? 'Adding...' : 'Add Person'}
          </button>
        </>
      )}
    >
      <form
        id="person-create-form"
        action={handleSubmit}
        className="space-y-3"
      >
        <input
          autoFocus
          name="title"
          type="text"
          required
          placeholder="Name"
          className="secondary-input"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="relationship"
            type="text"
            placeholder="Relationship (friend, mentor...)"
            className="secondary-input"
          />
          <input
            name="company"
            type="text"
            placeholder="Company / Context"
            className="secondary-input"
          />
        </div>
        <textarea
          name="body"
          placeholder="Notes about this person..."
          rows={3}
          className="secondary-textarea min-h-[8rem] resize-none"
        />
      </form>
    </SecondaryDialogShell>
  );
}
