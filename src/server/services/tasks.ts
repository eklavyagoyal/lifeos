import { db } from '../db';
import { tasks } from '../db/schema';
import { eq, and, isNull, desc, asc, lte, or } from 'drizzle-orm';
import { newId, now, todayISO } from '@/lib/utils';
import type { TaskStatus, TaskPriority } from '@/lib/types';
import { removeSearchDocument, syncSearchDocument } from './search';
import { syncRecurringTaskJob } from './scheduler';
import { recalculateGoalProgress, recalculateGoalsLinkedToTask, recalculateProjectProgress } from './progress';

export interface CreateTaskInput {
  title: string;
  body?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  scheduledDate?: string;
  recurrenceRule?: string;
  projectId?: string;
  goalId?: string;
  parentTaskId?: string;
  effortEstimate?: string;
  energyRequired?: string;
  context?: string;
  source?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: string;
}

/** Create a new task */
export function createTask(input: CreateTaskInput) {
  const id = newId();
  const timestamp = now();

  db.insert(tasks).values({
    id,
    title: input.title,
    body: input.body ?? null,
    status: input.status ?? 'todo',
    priority: input.priority ?? null,
    dueDate: input.dueDate ?? null,
    scheduledDate: input.scheduledDate ?? null,
    recurrenceRule: input.recurrenceRule ?? null,
    projectId: input.projectId ?? null,
    goalId: input.goalId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    effortEstimate: input.effortEstimate ?? null,
    energyRequired: input.energyRequired ?? null,
    context: input.context ?? null,
    source: (input.source as 'manual' | 'inbox' | 'recurrence' | 'review') ?? 'manual',
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as typeof tasks.$inferInsert).run();

  syncSearchDocument({
    itemId: id,
    itemType: 'task',
    title: input.title,
    body: input.body ?? '',
  });

  syncRecurringTaskJob(id);
  if (input.projectId) {
    recalculateProjectProgress(input.projectId);
  }
  if (input.goalId) {
    recalculateGoalProgress(input.goalId);
  }

  return getTask(id);
}

/** Get a single task by ID */
export function getTask(id: string) {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

/** Update a task */
export function updateTask(input: UpdateTaskInput) {
  const previous = getTask(input.id);
  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) updates.body = input.body;
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === 'done') {
      updates.completedAt = now();
    } else {
      updates.completedAt = null;
    }
  }
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
  if (input.scheduledDate !== undefined) updates.scheduledDate = input.scheduledDate;
  if (input.recurrenceRule !== undefined) updates.recurrenceRule = input.recurrenceRule;
  if (input.projectId !== undefined) updates.projectId = input.projectId;
  if (input.goalId !== undefined) updates.goalId = input.goalId;
  if (input.effortEstimate !== undefined) updates.effortEstimate = input.effortEstimate;
  if (input.energyRequired !== undefined) updates.energyRequired = input.energyRequired;
  if (input.context !== undefined) updates.context = input.context;

  db.update(tasks).set(updates).where(eq(tasks.id, input.id)).run();
  const task = getTask(input.id);
  if (task && !task.archivedAt) {
    syncSearchDocument({
      itemId: task.id,
      itemType: 'task',
      title: task.title,
      body: task.body ?? '',
    });
  }
  syncRecurringTaskJob(input.id);
  const projectIds = new Set(
    [previous?.projectId ?? null, task?.projectId ?? null].filter((value): value is string => Boolean(value))
  );
  for (const projectId of projectIds) {
    recalculateProjectProgress(projectId);
  }
  if (previous?.goalId && previous.goalId !== task?.goalId) {
    recalculateGoalProgress(previous.goalId);
  }
  recalculateGoalsLinkedToTask(input.id);
  return task;
}

/** Toggle task completion status */
export function toggleTask(id: string) {
  const task = getTask(id);
  if (!task) return null;

  const newStatus = task.status === 'done' ? 'todo' : 'done';
  return updateTask({ id, status: newStatus as TaskStatus });
}

/** Delete (archive) a task */
export function archiveTask(id: string) {
  const task = getTask(id);
  db.update(tasks)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(tasks.id, id))
    .run();
  removeSearchDocument(id, 'task');
  syncRecurringTaskJob(id);
  if (task?.projectId) {
    recalculateProjectProgress(task.projectId);
  }
  if (task?.goalId) {
    recalculateGoalProgress(task.goalId);
  }
  recalculateGoalsLinkedToTask(id);
}

/** Get tasks for today — due today, scheduled today, or overdue */
export function getTodayTasks() {
  const today = todayISO();
  return db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.archivedAt),
        or(
          eq(tasks.status, 'todo'),
          eq(tasks.status, 'in_progress')
        ),
        or(
          eq(tasks.dueDate, today),
          eq(tasks.scheduledDate, today),
          lte(tasks.dueDate, today) // overdue
        )
      )
    )
    .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt))
    .all();
}

/** Get all active tasks (not archived, not done) */
export function getActiveTasks() {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.archivedAt),
        or(
          eq(tasks.status, 'todo'),
          eq(tasks.status, 'in_progress'),
          eq(tasks.status, 'inbox')
        )
      )
    )
    .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt))
    .all();
}

/** Get all tasks with optional status filter */
export function getAllTasks(status?: TaskStatus) {
  if (status) {
    return db
      .select()
      .from(tasks)
      .where(and(isNull(tasks.archivedAt), eq(tasks.status, status)))
      .orderBy(desc(tasks.createdAt))
      .all();
  }
  return db
    .select()
    .from(tasks)
    .where(isNull(tasks.archivedAt))
    .orderBy(desc(tasks.createdAt))
    .all();
}

/** Get completed tasks */
export function getCompletedTasks(limit = 50) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.status, 'done'))
    .orderBy(desc(tasks.completedAt))
    .limit(limit)
    .all();
}
