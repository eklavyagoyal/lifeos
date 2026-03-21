'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toggleHabitAction } from '@/app/actions';
import { cn } from '@/lib/cn';
import { Flame } from 'lucide-react';
import { DOMAIN_LABELS } from '@/lib/constants';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

interface Habit {
  id: string;
  name: string;
  currentStreak: number | null;
  domain: string | null;
  difficulty: string | null;
}

interface HabitCompletion {
  habitId: string;
  completedDate: string;
}

interface HabitChecklistProps {
  habits: Habit[];
  completions: HabitCompletion[];
  date?: string;
  variant?: 'default' | 'today';
}

export function HabitChecklist({
  habits,
  completions,
  date,
  variant = 'default',
}: HabitChecklistProps) {
  const completedIds = new Set(completions.map(c => c.habitId));
  const isToday = variant === 'today';

  if (habits.length === 0) {
    return (
      <div
        className={cn(
          'secondary-empty-state py-8 text-sm text-text-muted',
          isToday && 'rounded-[1.4rem]'
        )}
      >
        No active habits
      </div>
    );
  }

  return (
    <div className={cn(isToday ? 'space-y-2.5' : 'space-y-2')}>
      {habits.map((habit) => (
        <HabitCheckItem
          key={habit.id}
          habit={habit}
          isCompleted={completedIds.has(habit.id)}
          date={date}
          variant={variant}
        />
      ))}
    </div>
  );
}

function HabitCheckItem({
  habit,
  isCompleted,
  date,
  variant,
}: {
  habit: Habit;
  isCompleted: boolean;
  date?: string;
  variant: 'default' | 'today';
}) {
  const [optimisticCompleted, setOptimisticCompleted] = useState(isCompleted);
  const [isToggling, setIsToggling] = useState(false);
  const isToday = variant === 'today';

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsToggling(true);
    setOptimisticCompleted(!optimisticCompleted);
    await toggleHabitAction(habit.id, date);
    setIsToggling(false);
  };

  return (
    <Link href={`/habits/${habit.id}`}>
      <div
        className={cn(
          isToday
            ? 'card-interactive secondary-row group rounded-[1.45rem] px-3.5 py-3.5'
            : 'secondary-row group px-3 py-3',
          isToggling && 'opacity-70'
        )}
      >
        <button
          onClick={handleToggle}
          disabled={isToggling}
          className={cn(
            'mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[1rem] border transition-all duration-300 ease-luxury',
            optimisticCompleted
              ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] text-status-success shadow-[0_12px_22px_-18px_rgba(34,197,94,0.5)]'
              : 'border-line-soft bg-surface-1/70 text-text-muted hover:border-brand-300 hover:text-brand-500'
          )}
        >
          {optimisticCompleted ? (
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-[rgba(120,95,68,0.32)]" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                isToday ? 'text-sm font-medium' : 'text-sm font-medium',
                optimisticCompleted && 'text-text-tertiary line-through'
              )}
            >
              {habit.name}
            </span>

            {isToday ? (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {habit.domain ? (
                  <span className="secondary-chip">
                    {DOMAIN_LABELS[habit.domain] ?? habit.domain}
                  </span>
                ) : null}
                {(habit.currentStreak ?? 0) > 0 ? (
                  <span className="secondary-chip">
                    <Flame size={11} className="text-orange-400" />
                    {habit.currentStreak}d
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {!isToday && (habit.domain || habit.difficulty || (habit.currentStreak ?? 0) > 0) ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {habit.domain ? (
                <span className="secondary-chip">
                  {DOMAIN_LABELS[habit.domain] ?? habit.domain}
                </span>
              ) : null}
              {habit.difficulty ? (
                <span className="secondary-chip">
                  {DIFFICULTY_LABELS[habit.difficulty] ?? habit.difficulty}
                </span>
              ) : null}
              {(habit.currentStreak ?? 0) > 0 ? (
                <span className="secondary-chip">
                  <Flame size={11} className="text-orange-400" />
                  {habit.currentStreak} day streak
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
