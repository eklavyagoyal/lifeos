import { db } from '../db';
import { projects, tasks } from '../db/schema';
import { eq, and, isNull, desc, asc, ne } from 'drizzle-orm';
import { newId, now } from '@/lib/utils';
import type { ProjectStatus, ProjectHealth, ReviewCadence } from '@/lib/types';
import { removeSearchDocument, syncSearchDocument } from './search';
import { syncProjectReviewJob } from './scheduler';
import { recalculateGoalsLinkedToProject, recalculateProjectProgress as recalculateProjectProgressValue } from './progress';

export interface CreateProjectInput {
  title: string;
  summary?: string;
  body?: string;
  status?: ProjectStatus;
  health?: ProjectHealth;
  startDate?: string;
  targetDate?: string;
  goalId?: string;
  reviewCadence?: ReviewCadence;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  id: string;
  progress?: number;
  endDate?: string;
}

/** Create a new project */
export function createProject(input: CreateProjectInput) {
  const id = newId();
  const timestamp = now();

  db.insert(projects).values({
    id,
    title: input.title,
    summary: input.summary ?? null,
    body: input.body ?? null,
    status: input.status ?? 'planning',
    health: input.health ?? null,
    startDate: input.startDate ?? null,
    targetDate: input.targetDate ?? null,
    endDate: null,
    progress: 0,
    goalId: input.goalId ?? null,
    reviewCadence: input.reviewCadence ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  syncSearchDocument({
    itemId: id,
    itemType: 'project',
    title: input.title,
    body: [input.summary, input.body].filter(Boolean).join(' '),
  });

  syncProjectReviewJob(id);
  recalculateGoalsLinkedToProject(id);

  return getProject(id);
}

/** Get a single project */
export function getProject(id: string) {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

/** Update a project */
export function updateProject(input: UpdateProjectInput) {
  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.summary !== undefined) updates.summary = input.summary;
  if (input.body !== undefined) updates.body = input.body;
  if (input.status !== undefined) {
    updates.status = input.status;
    // Auto-set endDate when completing
    if (input.status === 'completed' || input.status === 'cancelled') {
      updates.endDate = new Date().toISOString().split('T')[0];
    }
  }
  if (input.health !== undefined) updates.health = input.health;
  if (input.startDate !== undefined) updates.startDate = input.startDate;
  if (input.targetDate !== undefined) updates.targetDate = input.targetDate;
  if (input.endDate !== undefined) updates.endDate = input.endDate;
  if (input.progress !== undefined) updates.progress = Math.max(0, Math.min(100, input.progress));
  if (input.goalId !== undefined) updates.goalId = input.goalId;
  if (input.reviewCadence !== undefined) updates.reviewCadence = input.reviewCadence;

  db.update(projects).set(updates).where(eq(projects.id, input.id)).run();
  const project = getProject(input.id);
  if (project && !project.archivedAt) {
    syncSearchDocument({
      itemId: project.id,
      itemType: 'project',
      title: project.title,
      body: [project.summary, project.body].filter(Boolean).join(' '),
    });
  }
  syncProjectReviewJob(input.id);
  recalculateGoalsLinkedToProject(input.id);
  return project;
}

/** Get all active projects (not archived) */
export function getAllProjects() {
  return db
    .select()
    .from(projects)
    .where(isNull(projects.archivedAt))
    .orderBy(asc(projects.createdAt))
    .all();
}

/** Get projects grouped by status */
export function getProjectsByStatus(status: ProjectStatus) {
  return db
    .select()
    .from(projects)
    .where(and(isNull(projects.archivedAt), eq(projects.status, status)))
    .orderBy(desc(projects.updatedAt))
    .all();
}

/** Get tasks belonging to a project */
export function getProjectTasks(projectId: string) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt), ne(tasks.source, 'review')))
    .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt))
    .all();
}

/** Recalculate project progress from task completion */
export function recalculateProjectProgress(projectId: string) {
  return recalculateProjectProgressValue(projectId);
}

/** Archive a project */
export function archiveProject(id: string) {
  db.update(projects)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(projects.id, id))
    .run();
  removeSearchDocument(id, 'project');
  syncProjectReviewJob(id);
  recalculateGoalsLinkedToProject(id);
}
