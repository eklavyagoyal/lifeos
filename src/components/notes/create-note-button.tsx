'use client';

import { useState } from 'react';
import { createNoteAction } from '@/app/actions';
import { StickyNote } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  SecondaryDialogShell,
  SecondaryLaunchButton,
} from '@/components/experience/secondary-create-dialog';

export function CreateNoteButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    await createNoteAction(formData);
    setIsSubmitting(false);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <SecondaryLaunchButton
        icon={StickyNote}
        label="New note"
        detail="Open a fresh page"
        onClick={() => setIsOpen(true)}
      />
    );
  }

  return (
    <SecondaryDialogShell
      open={isOpen}
      onClose={() => setIsOpen(false)}
      icon={StickyNote}
      eyebrow="Commonplace"
      title="Create a note"
      description="Keep a reference, a working draft, or a small idea that wants a calmer home than the inbox."
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
            form="note-create-form"
            disabled={isSubmitting}
            className={cn(
              'secondary-toolbar-button bg-[linear-gradient(135deg,rgba(201,143,88,0.96)_0%,rgba(174,93,44,0.92)_100%)] text-white',
              'border-[rgba(174,93,44,0.18)] hover:text-white disabled:opacity-50'
            )}
          >
            {isSubmitting ? 'Creating...' : 'Create Note'}
          </button>
        </>
      )}
    >
      <form
        id="note-create-form"
        action={handleSubmit}
        className="space-y-3"
      >
        <input
          autoFocus
          name="title"
          type="text"
          required
          placeholder="Note title"
          className="secondary-input"
        />
        <textarea
          name="body"
          placeholder="Start writing... (markdown supported)"
          rows={6}
          className="secondary-textarea resize-none"
        />
      </form>
    </SecondaryDialogShell>
  );
}
