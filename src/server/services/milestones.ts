import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { milestones } from '../db/schema';
import { newId, now } from '@/lib/utils';
import type { MilestoneStatus } from '@/lib/types';
import { getComputedMilestoneState, recalculateGoalProgress } from './progress';
import { reindexSearchItem } from './search';

export interface CreateMilestoneInput {
  goalId: string;
  title: string;
  body?: string;
  status?: MilestoneStatus;
  targetDate?: string;
  progress?: number;
  projectId?: string;
  taskId?: string;
  habitId?: string;
}

export interface UpdateMilestoneInput extends Partial<CreateMilestoneInput> {
  id: string;
  sortOrder?: number;
}

function resolveMilestoneLinks(input: {
  taskId?: string | null;
  projectId?: string | null;
  habitId?: string | null;
}) {
  const taskId = input.taskId || null;
  const projectId = taskId ? null : input.projectId || null;
  const habitId = taskId || projectId ? null : input.habitId || null;

  return {
    taskId,
    projectId,
    habitId,
  };
}

export function getMilestone(id: string) {
  return db.select().from(milestones).where(eq(milestones.id, id)).get();
}

export function getGoalMilestones(goalId: string) {
  return db.select().from(milestones)
    .where(and(eq(milestones.goalId, goalId), isNull(milestones.archivedAt)))
    .orderBy(asc(milestones.sortOrder), asc(milestones.targetDate), desc(milestones.createdAt))
    .all();
}

export function getGoalMilestonesWithComputedState(goalId: string) {
  return getGoalMilestones(goalId).map((milestone) => ({
    ...milestone,
    computed: getComputedMilestoneState(milestone),
  }));
}

export function createMilestone(input: CreateMilestoneInput) {
  const id = newId();
  const timestamp = now();
  const status = input.status ?? 'planned';
  const linkFields = resolveMilestoneLinks(input);
  const sortOrder = db.select().from(milestones)
    .where(and(eq(milestones.goalId, input.goalId), isNull(milestones.archivedAt)))
    .all().length;

  db.insert(milestones).values({
    id,
    goalId: input.goalId,
    title: input.title,
    body: input.body ?? null,
    status,
    targetDate: input.targetDate ?? null,
    completedAt: status === 'done' ? timestamp : null,
    progress: input.progress ?? 0,
    sortOrder,
    projectId: linkFields.projectId,
    taskId: linkFields.taskId,
    habitId: linkFields.habitId,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  }).run();

  recalculateGoalProgress(input.goalId);
  reindexSearchItem('goal', input.goalId);
  return getMilestone(id);
}

export function updateMilestone(input: UpdateMilestoneInput) {
  const existing = getMilestone(input.id);
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.goalId !== undefined) updates.goalId = input.goalId;
  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) updates.body = input.body;
  if (input.status !== undefined) {
    updates.status = input.status;
    updates.completedAt = input.status === 'done' ? now() : null;
  }
  if (input.targetDate !== undefined) updates.targetDate = input.targetDate;
  if (input.progress !== undefined) updates.progress = Math.max(0, Math.min(100, input.progress));
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.projectId !== undefined || input.taskId !== undefined || input.habitId !== undefined) {
    const linkFields = resolveMilestoneLinks({
      taskId: input.taskId,
      projectId: input.projectId,
      habitId: input.habitId,
    });
    updates.projectId = linkFields.projectId;
    updates.taskId = linkFields.taskId;
    updates.habitId = linkFields.habitId;
  }

  db.update(milestones).set(updates).where(eq(milestones.id, input.id)).run();

  const milestone = getMilestone(input.id);
  if (milestone) {
    recalculateGoalProgress(existing.goalId);
    reindexSearchItem('goal', existing.goalId);
    if (milestone.goalId !== existing.goalId) {
      recalculateGoalProgress(milestone.goalId);
      reindexSearchItem('goal', milestone.goalId);
    } else {
      reindexSearchItem('goal', milestone.goalId);
    }
  }

  return milestone;
}

export function archiveMilestone(id: string) {
  const milestone = getMilestone(id);
  if (!milestone) return;

  db.update(milestones)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(milestones.id, id))
    .run();

  recalculateGoalProgress(milestone.goalId);
  reindexSearchItem('goal', milestone.goalId);
}
