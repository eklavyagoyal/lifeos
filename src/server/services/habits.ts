import { db } from '../db';
import { habits, habitCompletions } from '../db/schema';
import { eq, and, isNull, desc, asc } from 'drizzle-orm';
import { newId, now, todayISO } from '@/lib/utils';
import type { HabitCadence, LifeDomain } from '@/lib/types';
import { removeSearchDocument, syncSearchDocument } from './search';
import { recalculateGoalProgress, recalculateGoalsLinkedToHabit } from './progress';

export interface CreateHabitInput {
  name: string;
  description?: string;
  body?: string;
  cadence?: HabitCadence;
  scheduleRule?: string;
  targetCount?: number;
  graceDays?: number;
  domain?: LifeDomain;
  difficulty?: 'easy' | 'medium' | 'hard';
  scoringWeight?: number;
  goalId?: string;
  projectId?: string;
}

export interface UpdateHabitInput extends Partial<CreateHabitInput> {
  id: string;
}

/** Create a new habit */
export function createHabit(input: CreateHabitInput) {
  const id = newId();
  const timestamp = now();

  db.insert(habits).values({
    id,
    name: input.name,
    description: input.description ?? null,
    body: input.body ?? null,
    cadence: input.cadence ?? 'daily',
    scheduleRule: input.scheduleRule ?? null,
    targetCount: input.targetCount ?? 1,
    graceDays: input.graceDays ?? 1,
    domain: input.domain ?? null,
    difficulty: input.difficulty ?? 'medium',
    scoringWeight: input.scoringWeight ?? 1.0,
    goalId: input.goalId ?? null,
    projectId: input.projectId ?? null,
    currentStreak: 0,
    longestStreak: 0,
    isPaused: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  syncSearchDocument({
    itemId: id,
    itemType: 'habit',
    title: input.name,
    body: [input.description, input.body].filter(Boolean).join(' '),
  });

  if (input.goalId) {
    recalculateGoalProgress(input.goalId);
  }

  return getHabit(id);
}

/** Get a single habit */
export function getHabit(id: string) {
  return db.select().from(habits).where(eq(habits.id, id)).get();
}

/** Update a habit */
export function updateHabit(input: UpdateHabitInput) {
  const previous = getHabit(input.id);
  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.body !== undefined) updates.body = input.body;
  if (input.cadence !== undefined) updates.cadence = input.cadence;
  if (input.scheduleRule !== undefined) updates.scheduleRule = input.scheduleRule;
  if (input.targetCount !== undefined) updates.targetCount = input.targetCount;
  if (input.graceDays !== undefined) updates.graceDays = input.graceDays;
  if (input.domain !== undefined) updates.domain = input.domain;
  if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
  if (input.scoringWeight !== undefined) updates.scoringWeight = input.scoringWeight;
  if (input.goalId !== undefined) updates.goalId = input.goalId;
  if (input.projectId !== undefined) updates.projectId = input.projectId;

  db.update(habits).set(updates).where(eq(habits.id, input.id)).run();
  const habit = getHabit(input.id);
  if (habit && !habit.archivedAt) {
    syncSearchDocument({
      itemId: habit.id,
      itemType: 'habit',
      title: habit.name,
      body: [habit.description, habit.body].filter(Boolean).join(' '),
    });
  }
  if (previous?.goalId && previous.goalId !== habit?.goalId) {
    recalculateGoalProgress(previous.goalId);
  }
  recalculateGoalsLinkedToHabit(input.id);
  return habit;
}

/** Get all active habits */
export function getActiveHabits() {
  return db
    .select()
    .from(habits)
    .where(and(isNull(habits.archivedAt), eq(habits.isPaused, 0)))
    .orderBy(asc(habits.createdAt))
    .all();
}

/** Get all habits including paused */
export function getAllHabits() {
  return db
    .select()
    .from(habits)
    .where(isNull(habits.archivedAt))
    .orderBy(asc(habits.createdAt))
    .all();
}

/** Toggle habit completion for today */
export function toggleHabitCompletion(habitId: string, date?: string) {
  const completionDate = date ?? todayISO();

  // Check if already completed today
  const existing = db
    .select()
    .from(habitCompletions)
    .where(
      and(
        eq(habitCompletions.habitId, habitId),
        eq(habitCompletions.completedDate, completionDate)
      )
    )
    .get();

  if (existing) {
    // Remove completion
    db.delete(habitCompletions).where(eq(habitCompletions.id, existing.id)).run();
    recalculateStreak(habitId);
    recalculateGoalsLinkedToHabit(habitId);
    return { completed: false };
  } else {
    // Add completion
    db.insert(habitCompletions).values({
      id: newId(),
      habitId,
      completedDate: completionDate,
      count: 1,
      createdAt: now(),
    }).run();
    recalculateStreak(habitId);
    recalculateGoalsLinkedToHabit(habitId);
    return { completed: true };
  }
}

/** Get completions for a habit in a date range */
export function getHabitCompletions(habitId: string, startDate: string, endDate: string) {
  return db
    .select()
    .from(habitCompletions)
    .where(eq(habitCompletions.habitId, habitId))
    .orderBy(desc(habitCompletions.completedDate))
    .all()
    .filter(c => c.completedDate >= startDate && c.completedDate <= endDate);
}

/** Get today's completions for all habits */
export function getTodayCompletions() {
  const today = todayISO();
  return db
    .select()
    .from(habitCompletions)
    .where(eq(habitCompletions.completedDate, today))
    .all();
}

/** Recalculate streak for a habit */
export function recalculateStreak(habitId: string) {
  const habit = getHabit(habitId);
  if (!habit) return;

  const completions = db
    .select()
    .from(habitCompletions)
    .where(eq(habitCompletions.habitId, habitId))
    .orderBy(desc(habitCompletions.completedDate))
    .all();

  if (completions.length === 0) {
    db.update(habits)
      .set({ currentStreak: 0, updatedAt: now() })
      .where(eq(habits.id, habitId))
      .run();
    return;
  }

  // Calculate current streak (consecutive days from today backwards)
  const today = new Date(todayISO());
  let streak = 0;
  let checkDate = new Date(today);
  const graceDays = habit.graceDays ?? 1;
  let missedDays = 0;

  const completionDates = new Set(completions.map(c => c.completedDate));

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];

    if (completionDates.has(dateStr)) {
      streak++;
      missedDays = 0;
    } else {
      missedDays++;
      if (missedDays > graceDays) break;
    }

    checkDate.setDate(checkDate.getDate() - 1);
  }

  const longestStreak = Math.max(streak, habit.longestStreak ?? 0);

  db.update(habits)
    .set({ currentStreak: streak, longestStreak, updatedAt: now() })
    .where(eq(habits.id, habitId))
    .run();
}

/** Archive a habit */
export function archiveHabit(id: string) {
  const habit = getHabit(id);
  db.update(habits)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(habits.id, id))
    .run();
  removeSearchDocument(id, 'habit');
  if (habit?.goalId) {
    recalculateGoalProgress(habit.goalId);
  }
  recalculateGoalsLinkedToHabit(id);
}
