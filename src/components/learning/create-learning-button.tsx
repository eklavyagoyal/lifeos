'use client';

import { useState } from 'react';
import { createEntityAction } from '@/app/actions';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  SecondaryDialogShell,
  SecondaryLaunchButton,
} from '@/components/experience/secondary-create-dialog';

type LearningType = 'book' | 'article' | 'course';

export function CreateLearningButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [learningType, setLearningType] = useState<LearningType>('book');

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    formData.set('entityType', learningType);
    await createEntityAction(formData);
    setIsSubmitting(false);
    setIsOpen(false);
    setLearningType('book');
  };

  if (!isOpen) {
    return (
      <SecondaryLaunchButton
        icon={GraduationCap}
        label="Add item"
        detail="Open the learning shelf"
        onClick={() => setIsOpen(true)}
      />
    );
  }

  return (
    <SecondaryDialogShell
      open={isOpen}
      onClose={() => setIsOpen(false)}
      icon={GraduationCap}
      eyebrow="Learning Shelf"
      title="Add a learning item"
      description="Track what you are reading, studying, or working through without turning the first capture into admin work."
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
            form="learning-create-form"
            disabled={isSubmitting}
            className={cn(
              'secondary-toolbar-button bg-[linear-gradient(135deg,rgba(201,143,88,0.96)_0%,rgba(174,93,44,0.92)_100%)] text-white',
              'border-[rgba(174,93,44,0.18)] hover:text-white disabled:opacity-50'
            )}
          >
            {isSubmitting ? 'Adding...' : `Add ${learningType}`}
          </button>
        </>
      )}
    >
      <form
        id="learning-create-form"
        action={handleSubmit}
        className="space-y-3"
      >
        <div className="grid gap-2 rounded-[1.15rem] border border-[rgba(121,95,67,0.11)] bg-[rgba(255,251,245,0.66)] p-2 shadow-[inset_0_1px_0_rgba(255,252,246,0.82)] sm:grid-cols-3">
          {(['book', 'article', 'course'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLearningType(t)}
              className={cn(
                'secondary-launcher min-h-[3.3rem] justify-start px-3 py-2 text-left capitalize',
                learningType === t
                  ? 'border-[rgba(174,93,44,0.18)] bg-[linear-gradient(135deg,rgba(255,249,241,0.96)_0%,rgba(244,232,216,0.82)_100%)] text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {t === 'book' ? '📚' : t === 'article' ? '📄' : '🎓'} {t}
                </span>
                <span className="mt-0.5 block text-2xs leading-5 text-text-muted">
                  {t === 'book' ? 'Books and long-form reading' : t === 'article' ? 'Articles and references' : 'Courses and guided learning'}
                </span>
              </span>
            </button>
          ))}
        </div>

        <input
          autoFocus
          name="title"
          type="text"
          required
          placeholder={learningType === 'book' ? 'Book title' : learningType === 'article' ? 'Article title' : 'Course name'}
          className="secondary-input"
        />

        <div className="grid gap-3">
          {learningType === 'book' && (
            <input
              name="author"
              type="text"
              placeholder="Author"
              className="secondary-input"
            />
          )}
          {learningType === 'article' && (
            <input
              name="url"
              type="url"
              placeholder="URL"
              className="secondary-input"
            />
          )}
          {learningType === 'course' && (
            <input
              name="platform"
              type="text"
              placeholder="Platform (Coursera, Udemy...)"
              className="secondary-input"
            />
          )}
        </div>
      </form>
    </SecondaryDialogShell>
  );
}
