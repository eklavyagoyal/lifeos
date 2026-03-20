import { db } from '../db';
import { goals, habits, milestones, projects, tasks } from '../db/schema';
import { eq, and, isNull, desc, asc } from 'drizzle-orm';
import { newId, now } from '@/lib/utils';
import type { GoalTimeHorizon } from '@/lib/types';
import { removeSearchDocument, syncSearchDocument } from './search';
import { calculateGoalRollup } from './progress';

export interface CreateGoalInput {
  title: string;
  description?: string;
  body?: string;
  timeHorizon?: GoalTimeHorizon;
  startDate?: string;
  targetDate?: string;
  outcomeMetric?: string;
  status?: string;
}

export interface UpdateGoalInput extends Partial<CreateGoalInput> {
  id: string;
  progress?: number;
}

/** Create a new goal */
export function createGoal(input: CreateGoalInput) {
  const id = newId();
  const timestamp = now();

  db.insert(goals).values({
    id,
    title: input.title,
    description: input.description ?? null,
    body: input.body ?? null,
    timeHorizon: input.timeHorizon ?? 'quarterly',
    startDate: input.startDate ?? null,
    targetDate: input.targetDate ?? null,
    outcomeMetric: input.outcomeMetric ?? null,
    status: (input.status as 'active' | 'achieved' | 'abandoned' | 'paused') ?? 'active',
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  syncSearchDocument({
    itemId: id,
    itemType: 'goal',
    title: input.title,
    body: [input.description, input.body].filter(Boolean).join(' '),
  });

  return getGoal(id);
}

/** Get a single goal */
export function getGoal(id: string) {
  const goal = db.select().from(goals).where(eq(goals.id, id)).get();
  if (!goal) return null;

  const rollup = calculateGoalRollup(goal.id);
  return {
    ...goal,
    progress: rollup.progress,
  };
}

/** Update a goal */
export function updateGoal(input: UpdateGoalInput) {
  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.body !== undefined) updates.body = input.body;
  if (input.timeHorizon !== undefined) updates.timeHorizon = input.timeHorizon;
  if (input.startDate !== undefined) updates.startDate = input.startDate;
  if (input.targetDate !== undefined) updates.targetDate = input.targetDate;
  if (input.outcomeMetric !== undefined) updates.outcomeMetric = input.outcomeMetric;
  if (input.status !== undefined) updates.status = input.status;
  if (input.progress !== undefined) updates.progress = Math.max(0, Math.min(100, input.progress));

  db.update(goals).set(updates).where(eq(goals.id, input.id)).run();
  const goal = getGoal(input.id);
  if (goal && !goal.archivedAt) {
    syncSearchDocument({
      itemId: goal.id,
      itemType: 'goal',
      title: goal.title,
      body: [goal.description, goal.body].filter(Boolean).join(' '),
    });
  }
  return goal;
}

/** Get all goals (not archived) */
export function getAllGoals() {
  return db
    .select()
    .from(goals)
    .where(isNull(goals.archivedAt))
    .orderBy(asc(goals.createdAt))
    .all()
    .map((goal) => ({
      ...goal,
      progress: calculateGoalRollup(goal.id).progress,
    }));
}

/** Get goals by time horizon */
export function getGoalsByHorizon(horizon: GoalTimeHorizon) {
  return db
    .select()
    .from(goals)
    .where(and(isNull(goals.archivedAt), eq(goals.timeHorizon, horizon)))
    .orderBy(desc(goals.updatedAt))
    .all()
    .map((goal) => ({
      ...goal,
      progress: calculateGoalRollup(goal.id).progress,
    }));
}

/** Get habits linked to a goal */
export function getGoalHabits(goalId: string) {
  return db
    .select()
    .from(habits)
    .where(and(eq(habits.goalId, goalId), isNull(habits.archivedAt)))
    .orderBy(asc(habits.createdAt))
    .all();
}

/** Get tasks linked directly to a goal */
export function getGoalTasks(goalId: string) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.goalId, goalId), isNull(tasks.archivedAt)))
    .orderBy(desc(tasks.updatedAt))
    .all();
}

/** Get projects linked directly to a goal */
export function getGoalProjects(goalId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.goalId, goalId), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt))
    .all();
}

/** Count active milestones linked to a goal */
export function getGoalMilestoneCount(goalId: string) {
  return db
    .select()
    .from(milestones)
    .where(and(eq(milestones.goalId, goalId), isNull(milestones.archivedAt)))
    .all().length;
}

/** Archive a goal */
export function archiveGoal(id: string) {
  db.update(goals)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(goals.id, id))
    .run();
  removeSearchDocument(id, 'goal');
}
