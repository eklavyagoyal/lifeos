'use server';

import { revalidatePath } from 'next/cache';
import { createTask, updateTask, toggleTask, archiveTask } from '@/server/services/tasks';
import { createHabit, updateHabit, toggleHabitCompletion, archiveHabit, getHabit } from '@/server/services/habits';
import { createJournalEntry, updateJournalEntry, archiveJournalEntry } from '@/server/services/journal';
import { createNote, updateNote, archiveNote } from '@/server/services/notes';
import { captureToInbox, dismissInboxItem, getPendingInboxItemsByIds, triageInboxItem } from '@/server/services/inbox';
import { createProject, updateProject, archiveProject } from '@/server/services/projects';
import { createGoal, updateGoal, archiveGoal } from '@/server/services/goals';
import { createMilestone, updateMilestone, archiveMilestone } from '@/server/services/milestones';
import { createRelation, removeRelation } from '@/server/services/relations';
import { getOrCreateTag, addTagToItem, removeTagFromItem } from '@/server/services/tags';
import { createMetric, updateMetric, deleteMetric } from '@/server/services/metrics';
import { createEvent, updateEvent, archiveEvent } from '@/server/services/events';
import { attachBufferToItem, removeAttachmentLink } from '@/server/services/attachments';
import { getRecentImportRuns, previewImport, rollbackImportRun, runImport } from '@/server/services/imports';
import { rebuildSearchIndex, searchItems } from '@/server/services/search';
import {
  extractGoalFromReviewInsight,
  extractTaskFromReviewInsight,
  generateReviewForPeriod,
  generateWeeklyReview,
  updateReviewBody,
  publishReview,
  deleteReview,
  regenerateReview,
  getAllReviews,
} from '@/server/services/reviews';
import { awardTaskCompleteXP, awardHabitCompleteXP, awardJournalXP, awardMetricLogXP, awardReviewXP, awardIdeaXP, awardEntityXP } from '@/server/services/gamification';
import { createIdea, updateIdea, archiveIdea } from '@/server/services/ideas';
import { createEntity, updateEntity, archiveEntity } from '@/server/services/entities';
import { verifyPassphrase, setSessionCookie, clearSessionCookie } from '@/server/services/auth';
import { startOfWeek } from '@/lib/utils';
import type { ItemType, EntityType, RelationType, MetricType, TaskPriority, LifeDomain, ReviewType, ImportType } from '@/lib/types';
import {
  buildCapturePreview,
  finalizeMaterializedCapture,
  getJournalWordCountFromPreview,
  materializeCapturePreview,
  submitCapture,
  type CaptureMaterializeOverride,
} from '@/server/services/capture';
import { revalidateCapturePaths } from '@/server/services/capture-paths';
import { resolveItem } from '@/server/services/graph-helpers';

function revalidateItemDetailPath(itemType: ItemType, itemId: string) {
  const item = resolveItem(itemType, itemId);
  if (item) {
    revalidatePath(item.detailUrl);
  }
}

// ============================================================
// AUTH ACTIONS
// ============================================================

export async function loginAction(passphrase: string): Promise<{ success: boolean; error?: string }> {
  if (!passphrase || passphrase.trim().length === 0) {
    return { success: false, error: 'Please enter a passphrase' };
  }

  const isValid = verifyPassphrase(passphrase);
  if (!isValid) {
    return { success: false, error: 'Invalid passphrase' };
  }

  await setSessionCookie();
  return { success: true };
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
}

// ============================================================
// TASK ACTIONS
// ============================================================

export async function createTaskAction(formData: FormData) {
  const title = formData.get('title') as string;
  if (!title?.trim()) return { error: 'Title is required' };

  const task = createTask({
    title: title.trim(),
    priority: (formData.get('priority') as TaskPriority) || undefined,
    dueDate: (formData.get('dueDate') as string) || undefined,
    scheduledDate: (formData.get('scheduledDate') as string) || undefined,
    projectId: (formData.get('projectId') as string) || undefined,
    goalId: (formData.get('goalId') as string) || undefined,
  });

  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath('/projects');
  revalidatePath('/goals');
  if (task?.projectId) revalidatePath(`/projects/${task.projectId}`);
  if (task?.goalId) revalidatePath(`/goals/${task.goalId}`);
  return { task };
}

export async function toggleTaskAction(id: string) {
  const task = toggleTask(id);
  if (task && task.status === 'done') {
    awardTaskCompleteXP(task.id, task.priority);
  }
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath(`/tasks/${id}`);
  revalidatePath('/projects');
  revalidatePath('/goals');
  if (task?.projectId) revalidatePath(`/projects/${task.projectId}`);
  if (task?.goalId) revalidatePath(`/goals/${task.goalId}`);
  return { task };
}

export async function updateTaskAction(id: string, data: Record<string, unknown>) {
  const task = updateTask({ id, ...data } as Parameters<typeof updateTask>[0]);
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath(`/tasks/${id}`);
  revalidatePath('/projects');
  revalidatePath('/goals');
  if (task?.projectId) revalidatePath(`/projects/${task.projectId}`);
  if (task?.goalId) revalidatePath(`/goals/${task.goalId}`);
  return { task };
}

export async function archiveTaskAction(id: string) {
  archiveTask(id);
  revalidatePath('/today');
  revalidatePath('/tasks');
  revalidatePath(`/tasks/${id}`);
  revalidatePath('/projects');
  revalidatePath('/goals');
}

// ============================================================
// HABIT ACTIONS
// ============================================================

export async function createHabitAction(formData: FormData) {
  const name = formData.get('name') as string;
  if (!name?.trim()) return { error: 'Name is required' };

  const habit = createHabit({
    name: name.trim(),
    domain: (formData.get('domain') as LifeDomain) || undefined,
    difficulty: (formData.get('difficulty') as 'easy' | 'medium' | 'hard') || undefined,
    cadence: (formData.get('cadence') as 'daily' | 'weekly' | 'custom') || undefined,
    goalId: (formData.get('goalId') as string) || undefined,
    projectId: (formData.get('projectId') as string) || undefined,
  });

  revalidatePath('/today');
  revalidatePath('/habits');
  revalidatePath('/goals');
  revalidatePath('/projects');
  if (habit?.goalId) revalidatePath(`/goals/${habit.goalId}`);
  if (habit?.projectId) revalidatePath(`/projects/${habit.projectId}`);
  return { habit };
}

export async function toggleHabitAction(habitId: string, date?: string) {
  const result = toggleHabitCompletion(habitId, date);
  if (result.completed) {
    const habit = getHabit(habitId);
    awardHabitCompleteXP(habitId, habit?.domain, habit?.difficulty);
  }
  revalidatePath('/today');
  revalidatePath('/habits');
  revalidatePath(`/habits/${habitId}`);
  revalidatePath('/goals');
  revalidatePath('/projects');
  return result;
}

export async function updateHabitAction(id: string, data: Record<string, unknown>) {
  const habit = updateHabit({ id, ...data } as Parameters<typeof updateHabit>[0]);
  revalidatePath('/today');
  revalidatePath('/habits');
  revalidatePath(`/habits/${id}`);
  revalidatePath('/goals');
  revalidatePath('/projects');
  if (habit?.goalId) revalidatePath(`/goals/${habit.goalId}`);
  if (habit?.projectId) revalidatePath(`/projects/${habit.projectId}`);
  return { habit };
}

export async function archiveHabitAction(id: string) {
  archiveHabit(id);
  revalidatePath('/today');
  revalidatePath('/habits');
  revalidatePath(`/habits/${id}`);
  revalidatePath('/goals');
  revalidatePath('/projects');
}

// ============================================================
// JOURNAL ACTIONS
// ============================================================

export async function createJournalAction(formData: FormData) {
  const body = formData.get('body') as string;
  const title = formData.get('title') as string;
  const mood = formData.get('mood') as string;
  const energy = formData.get('energy') as string;

  const entry = createJournalEntry({
    title: title || undefined,
    body: body || undefined,
    mood: mood ? parseInt(mood) : undefined,
    energy: energy ? parseInt(energy) : undefined,
    entryType: (formData.get('entryType') as string) || undefined,
  });

  if (entry) {
    awardJournalXP(entry.id, entry.wordCount ?? 0);
  }

  revalidatePath('/today');
  revalidatePath('/journal');
  return { entry };
}

export async function updateJournalAction(id: string, data: Record<string, unknown>) {
  const entry = updateJournalEntry({ id, ...data } as Parameters<typeof updateJournalEntry>[0]);
  revalidatePath('/journal');
  return { entry };
}

// ============================================================
// NOTE ACTIONS
// ============================================================

export async function createNoteAction(formData: FormData) {
  const title = formData.get('title') as string;
  if (!title?.trim()) return { error: 'Title is required' };

  const note = createNote({
    title: title.trim(),
    body: (formData.get('body') as string) || undefined,
    noteType: (formData.get('noteType') as string) || undefined,
  });

  revalidatePath('/notes');
  return { note };
}

export async function updateNoteAction(id: string, data: Record<string, unknown>) {
  const note = updateNote({ id, ...data } as Parameters<typeof updateNote>[0]);
  revalidatePath('/notes');
  return { note };
}

// ============================================================
// INBOX / CAPTURE ACTIONS
// ============================================================

export async function previewCaptureAction(rawText: string) {
  return { preview: buildCapturePreview(rawText) };
}

export async function captureAction(rawText: string) {
  if (!rawText?.trim()) return { error: 'Text is required' };

  const result = captureToInbox(rawText.trim());
  revalidateCapturePaths();
  return result;
}

export async function dismissInboxAction(id: string) {
  dismissInboxItem(id);
  revalidateCapturePaths();
}

export async function submitCaptureAction(
  rawText: string,
  mode: 'smart' | 'inbox' = 'smart'
) {
  if (!rawText?.trim()) return { error: 'Text is required' };

  const result = submitCapture(rawText.trim(), mode);
  revalidateCapturePaths();
  return result;
}

export async function triageInboxItemsAction(
  ids: string[],
  mode: 'suggested' | 'task' | 'note' | 'idea' | 'journal' | 'dismiss' = 'suggested'
) {
  if (ids.length === 0) {
    return { processed: 0, created: 0, dismissed: 0, skipped: 0, errors: [] as string[] };
  }

  const items = getPendingInboxItemsByIds(ids);
  const errors: string[] = [];
  let created = 0;
  let dismissed = 0;
  let skipped = 0;

  if (mode === 'dismiss') {
    for (const item of items) {
      dismissInboxItem(item.id);
      dismissed++;
    }
    revalidateCapturePaths();
    return { processed: items.length, created, dismissed, skipped, errors };
  }

  for (const item of items) {
    const preview = buildCapturePreview(item.rawText);

    if (mode === 'suggested' && !preview.directCreateSupported) {
      skipped++;
      errors.push(`Skipped "${item.rawText}" because the suggestion is still ambiguous.`);
      continue;
    }

    try {
      const materialized = materializeCapturePreview(preview, mode as CaptureMaterializeOverride, 'inbox');
      triageInboxItem(item.id, materialized.createdItemType, materialized.createdId);
      finalizeMaterializedCapture({
        createdItemType: materialized.createdItemType,
        createdId: materialized.createdId,
        metricType: preview.metricType,
        entityType: preview.entityType,
        journalWordCount: getJournalWordCountFromPreview(preview.title, preview.body),
      });
      created++;
    } catch (error) {
      skipped++;
      errors.push(error instanceof Error ? error.message : `Unable to process "${item.rawText}".`);
    }
  }

  revalidateCapturePaths();
  return {
    processed: items.length,
    created,
    dismissed,
    skipped,
    errors,
  };
}

// ============================================================
// PROJECT ACTIONS
// ============================================================

export async function createProjectAction(formData: FormData) {
  const title = formData.get('title') as string;
  if (!title?.trim()) return { error: 'Title is required' };

  const project = createProject({
    title: title.trim(),
    summary: (formData.get('summary') as string) || undefined,
    status: (formData.get('status') as 'planning' | 'active' | 'paused' | 'completed' | 'cancelled') || undefined,
    startDate: (formData.get('startDate') as string) || undefined,
    targetDate: (formData.get('targetDate') as string) || undefined,
    goalId: (formData.get('goalId') as string) || undefined,
  });

  revalidatePath('/projects');
  revalidatePath('/goals');
  if (project?.goalId) revalidatePath(`/goals/${project.goalId}`);
  return { project };
}

export async function updateProjectAction(id: string, data: Record<string, unknown>) {
  const project = updateProject({ id, ...data } as Parameters<typeof updateProject>[0]);
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  revalidatePath('/goals');
  if (project?.goalId) revalidatePath(`/goals/${project.goalId}`);
  return { project };
}

export async function archiveProjectAction(id: string) {
  archiveProject(id);
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  revalidatePath('/goals');
}

// ============================================================
// GOAL ACTIONS
// ============================================================

export async function createGoalAction(formData: FormData) {
  const title = formData.get('title') as string;
  if (!title?.trim()) return { error: 'Title is required' };

  const goal = createGoal({
    title: title.trim(),
    description: (formData.get('description') as string) || undefined,
    timeHorizon: (formData.get('timeHorizon') as 'quarterly' | 'yearly' | 'multi_year' | 'life') || undefined,
    startDate: (formData.get('startDate') as string) || undefined,
    targetDate: (formData.get('targetDate') as string) || undefined,
    outcomeMetric: (formData.get('outcomeMetric') as string) || undefined,
  });

  revalidatePath('/goals');
  return { goal };
}

export async function updateGoalAction(id: string, data: Record<string, unknown>) {
  const goal = updateGoal({ id, ...data } as Parameters<typeof updateGoal>[0]);
  revalidatePath('/goals');
  revalidatePath(`/goals/${id}`);
  return { goal };
}

export async function archiveGoalAction(id: string) {
  archiveGoal(id);
  revalidatePath('/goals');
  revalidatePath(`/goals/${id}`);
}

export async function createMilestoneAction(data: {
  goalId: string;
  title: string;
  body?: string | null;
  status?: 'planned' | 'active' | 'done' | 'cancelled';
  targetDate?: string | null;
  progress?: number | null;
  taskId?: string | null;
  projectId?: string | null;
  habitId?: string | null;
}) {
  if (!data.goalId?.trim()) return { error: 'Goal is required' };
  if (!data.title?.trim()) return { error: 'Title is required' };

  const milestone = createMilestone({
    goalId: data.goalId.trim(),
    title: data.title.trim(),
    body: data.body || undefined,
    status: data.status || undefined,
    targetDate: data.targetDate || undefined,
    progress: typeof data.progress === 'number' ? data.progress : undefined,
    taskId: data.taskId || undefined,
    projectId: data.projectId || undefined,
    habitId: data.habitId || undefined,
  });

  revalidatePath('/goals');
  revalidatePath(`/goals/${data.goalId}`);
  if (data.taskId) revalidatePath(`/tasks/${data.taskId}`);
  if (data.projectId) revalidatePath(`/projects/${data.projectId}`);
  if (data.habitId) revalidatePath(`/habits/${data.habitId}`);
  return { milestone };
}

export async function updateMilestoneAction(id: string, data: Record<string, unknown>) {
  const milestone = updateMilestone({ id, ...data } as Parameters<typeof updateMilestone>[0]);
  revalidatePath('/goals');
  if (milestone?.goalId) revalidatePath(`/goals/${milestone.goalId}`);
  if (milestone?.taskId) revalidatePath(`/tasks/${milestone.taskId}`);
  if (milestone?.projectId) revalidatePath(`/projects/${milestone.projectId}`);
  if (milestone?.habitId) revalidatePath(`/habits/${milestone.habitId}`);
  return { milestone };
}

export async function archiveMilestoneAction(id: string, goalId?: string) {
  archiveMilestone(id);
  revalidatePath('/goals');
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

// ============================================================
// RELATION ACTIONS
// ============================================================

export async function createRelationAction(
  sourceType: ItemType,
  sourceId: string,
  targetType: ItemType,
  targetId: string,
  relationType: RelationType
) {
  const relation = createRelation({
    sourceType,
    sourceId,
    targetType,
    targetId,
    relationType,
  });

  // Revalidate both ends
  revalidatePath(`/${sourceType}s/${sourceId}`);
  revalidatePath(`/${targetType}s/${targetId}`);
  return { relation };
}

export async function removeRelationAction(id: string) {
  removeRelation(id);
  // Broad revalidation since we don't know which pages to target
  revalidatePath('/');
}

// ============================================================
// TAG ACTIONS
// ============================================================

export async function addTagAction(itemType: string, itemId: string, tagName: string) {
  const tag = getOrCreateTag(tagName);
  addTagToItem(itemType, itemId, tag.id);
  revalidatePath('/');
  return { tag };
}

export async function removeTagAction(itemType: string, itemId: string, tagId: string) {
  removeTagFromItem(itemType, itemId, tagId);
  revalidatePath('/');
}

// ============================================================
// ATTACHMENT ACTIONS
// ============================================================

export async function uploadAttachmentAction(itemType: ItemType, itemId: string, formData: FormData) {
  const files = formData.getAll('files').filter((value): value is File => value instanceof File);
  const labelValue = formData.get('label');
  const label = typeof labelValue === 'string' && labelValue.trim() ? labelValue.trim() : undefined;

  if (files.length === 0) {
    return { error: 'Select at least one file to attach.' };
  }

  for (const file of files) {
    if (file.size === 0) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    attachBufferToItem({
      itemType,
      itemId,
      originalName: file.name,
      data: buffer,
      label,
      sourceType: 'upload',
      metadata: {
        uploadedFileName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  revalidateItemDetailPath(itemType, itemId);
  return { success: true };
}

export async function removeAttachmentLinkAction(linkId: string, itemType: ItemType, itemId: string) {
  removeAttachmentLink(linkId);
  revalidateItemDetailPath(itemType, itemId);
  return { success: true };
}

// ============================================================
// IMPORT ACTIONS
// ============================================================

function revalidateImportSurfaces() {
  for (const route of [
    '/imports',
    '/today',
    '/tasks',
    '/journal',
    '/notes',
    '/projects',
    '/search',
    '/graph',
    '/timeline',
    '/insights',
    '/reviews',
  ]) {
    revalidatePath(route);
  }
}

export async function previewImportAction(importType: ImportType, sourcePath: string) {
  const trimmedPath = sourcePath.trim();
  if (!trimmedPath) {
    return { error: 'A source path is required.' };
  }

  try {
    const preview = previewImport({ importType, sourcePath: trimmedPath });
    revalidatePath('/imports');
    return { preview, runs: getRecentImportRuns() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Import preview failed.',
      runs: getRecentImportRuns(),
    };
  }
}

export async function runImportAction(importType: ImportType, sourcePath: string) {
  const trimmedPath = sourcePath.trim();
  if (!trimmedPath) {
    return { error: 'A source path is required.' };
  }

  try {
    const result = runImport({ importType, sourcePath: trimmedPath });
    revalidateImportSurfaces();
    return { result, runs: getRecentImportRuns() };
  } catch (error) {
    revalidatePath('/imports');
    return {
      error: error instanceof Error ? error.message : 'Import failed.',
      runs: getRecentImportRuns(),
    };
  }
}

export async function rollbackImportRunAction(runId: string) {
  const trimmedRunId = runId.trim();
  if (!trimmedRunId) {
    return { error: 'An import run id is required.' };
  }

  try {
    const rollback = rollbackImportRun(trimmedRunId);
    revalidateImportSurfaces();
    return { rollback, runs: getRecentImportRuns() };
  } catch (error) {
    revalidatePath('/imports');
    return {
      error: error instanceof Error ? error.message : 'Rollback failed.',
      runs: getRecentImportRuns(),
    };
  }
}

// ============================================================
// JOURNAL ARCHIVE ACTION
// ============================================================

export async function archiveJournalAction(id: string) {
  archiveJournalEntry(id);
  revalidatePath('/journal');
}

// ============================================================
// NOTE ARCHIVE ACTION
// ============================================================

export async function archiveNoteAction(id: string) {
  archiveNote(id);
  revalidatePath('/notes');
}

// ============================================================
// METRIC ACTIONS
// ============================================================

export async function createMetricAction(formData: FormData) {
  const metricType = formData.get('metricType') as MetricType;
  if (!metricType) return { error: 'Metric type is required' };

  const valueNumericRaw = formData.get('valueNumeric') as string;
  const valueNumeric = valueNumericRaw ? parseFloat(valueNumericRaw) : undefined;

  const metric = createMetric({
    metricType,
    valueNumeric,
    valueText: (formData.get('valueText') as string) || undefined,
    unit: (formData.get('unit') as string) || undefined,
    loggedDate: (formData.get('loggedDate') as string) || undefined,
    note: (formData.get('note') as string) || undefined,
  });

  if (metric) {
    awardMetricLogXP(metric.id, metricType);
  }

  revalidatePath('/today');
  revalidatePath('/metrics');
  revalidatePath('/health');
  revalidatePath('/finance');
  return { metric };
}

export async function quickLogMetricsAction(data: {
  sleep?: number;
  mood?: number;
  energy?: number;
  date?: string;
}) {
  const results: Record<string, unknown> = {};

  if (data.sleep !== undefined && data.sleep > 0) {
    const m = createMetric({
      metricType: 'sleep',
      valueNumeric: data.sleep,
      unit: 'hours',
      loggedDate: data.date,
    });
    results.sleep = m;
    if (m) awardMetricLogXP(m.id, 'sleep');
  }

  if (data.mood !== undefined && data.mood > 0) {
    const m = createMetric({
      metricType: 'mood',
      valueNumeric: data.mood,
      unit: 'score',
      loggedDate: data.date,
    });
    results.mood = m;
    if (m) awardMetricLogXP(m.id, 'mood');
  }

  if (data.energy !== undefined && data.energy > 0) {
    const m = createMetric({
      metricType: 'energy',
      valueNumeric: data.energy,
      unit: 'score',
      loggedDate: data.date,
    });
    results.energy = m;
    if (m) awardMetricLogXP(m.id, 'energy');
  }

  revalidatePath('/today');
  revalidatePath('/metrics');
  revalidatePath('/health');
  return results;
}

export async function updateMetricAction(id: string, data: Record<string, unknown>) {
  const metric = updateMetric({ id, ...data } as Parameters<typeof updateMetric>[0]);
  revalidatePath('/metrics');
  revalidatePath('/health');
  revalidatePath('/finance');
  return { metric };
}

export async function deleteMetricAction(id: string) {
  deleteMetric(id);
  revalidatePath('/metrics');
  revalidatePath('/today');
  revalidatePath('/health');
  revalidatePath('/finance');
}

// ============================================================
// EVENT ACTIONS
// ============================================================

export async function createEventAction(formData: FormData) {
  const title = formData.get('title') as string;
  const eventDate = formData.get('eventDate') as string;

  if (!title?.trim()) return { error: 'Title is required' };
  if (!eventDate?.trim()) return { error: 'Event date is required' };

  const event = createEvent({
    title: title.trim(),
    body: (formData.get('body') as string) || undefined,
    eventDate: eventDate.trim(),
    eventEndDate: (formData.get('eventEndDate') as string) || undefined,
    eventType: (formData.get('eventType') as 'life_event' | 'milestone' | 'trip' | 'memory' | 'achievement') || undefined,
    importance: Number.parseInt((formData.get('importance') as string) || '', 10) || undefined,
  });

  revalidatePath('/timeline');
  revalidatePath('/search');
  if (event?.id) revalidatePath(`/events/${event.id}`);
  return { event };
}

export async function updateEventAction(id: string, data: Record<string, unknown>) {
  const event = updateEvent({ id, ...data } as Parameters<typeof updateEvent>[0]);
  revalidatePath('/timeline');
  revalidatePath('/search');
  revalidatePath(`/events/${id}`);
  return { event };
}

export async function archiveEventAction(id: string) {
  archiveEvent(id);
  revalidatePath('/timeline');
  revalidatePath('/search');
  revalidatePath(`/events/${id}`);
}

// ============================================================
// SEARCH ACTIONS
// ============================================================

export async function searchAction(query: string, typeFilter?: ItemType) {
  const results = searchItems(query, typeFilter);
  return { results };
}

export async function rebuildSearchIndexAction() {
  rebuildSearchIndex();
  return { success: true };
}

// ============================================================
// REVIEW ACTIONS
// ============================================================

export async function generateWeeklyReviewAction(weekStart?: string) {
  const start = weekStart || startOfWeek(new Date());
  const { review, isNew } = generateWeeklyReview(start);
  if (isNew && review) {
    awardReviewXP(review.id);
  }
  revalidatePath('/reviews');
  revalidatePath('/today');
  return { review, isNew };
}

export async function generateReviewAction(reviewType: ReviewType, periodStart?: string) {
  const start = periodStart || (reviewType === 'weekly' ? startOfWeek(new Date()) : undefined);
  const { review, isNew } = start
    ? generateReviewForPeriod(reviewType, start)
    : generateReviewForPeriod(reviewType, new Date().toISOString().split('T')[0]);

  if (isNew && review && reviewType === 'weekly') {
    awardReviewXP(review.id);
  }

  revalidatePath('/reviews');
  revalidatePath('/today');
  return { review, isNew };
}

export async function updateReviewBodyAction(id: string, body: string) {
  const review = updateReviewBody(id, body);
  revalidatePath('/reviews');
  revalidatePath(`/reviews/${id}`);
  return { review };
}

export async function publishReviewAction(id: string) {
  const review = publishReview(id);
  revalidatePath('/reviews');
  revalidatePath(`/reviews/${id}`);
  return { review };
}

export async function deleteReviewAction(id: string) {
  deleteReview(id);
  revalidatePath('/reviews');
  revalidatePath('/today');
}

export async function regenerateReviewAction(id: string) {
  const review = regenerateReview(id);
  revalidatePath('/reviews');
  revalidatePath(`/reviews/${id}`);
  return { review };
}

export async function extractReviewInsightAction(
  reviewId: string,
  targetType: 'task' | 'goal',
  insight: string
) {
  const createdItem = targetType === 'task'
    ? extractTaskFromReviewInsight(reviewId, insight)
    : extractGoalFromReviewInsight(reviewId, insight);

  revalidatePath('/reviews');
  revalidatePath(`/reviews/${reviewId}`);
  revalidatePath('/today');

  if (targetType === 'task') {
    revalidatePath('/tasks');
    if (createdItem?.id) revalidatePath(`/tasks/${createdItem.id}`);
  } else {
    revalidatePath('/goals');
    if (createdItem?.id) revalidatePath(`/goals/${createdItem.id}`);
  }

  return { createdItem };
}

export async function getReviewsAction() {
  const reviews = getAllReviews();
  return { reviews };
}

// ----------------------------------------------------------
// Timeline
// ----------------------------------------------------------
export async function loadMoreTimelineAction(
  currentOffset: number,
  daysBack: number
) {
  const { getTimelineFeed } = await import('@/server/services/timeline');
  const startDate = daysBack > 0
    ? new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : undefined;

  const result = getTimelineFeed({
    offset: currentOffset,
    limit: 100,
    startDate,
  });

  return {
    dayGroups: result.dayGroups,
    hasMore: result.hasMore,
  };
}

// ============================================================
// IDEA ACTIONS
// ============================================================

export async function createIdeaAction(formData: FormData) {
  const title = formData.get('title') as string;
  if (!title?.trim()) return { error: 'Title is required' };

  const idea = createIdea({
    title: title.trim(),
    summary: (formData.get('summary') as string) || undefined,
    body: (formData.get('body') as string) || undefined,
    stage: (formData.get('stage') as 'seed' | 'developing' | 'mature' | 'archived' | 'implemented') || undefined,
    theme: (formData.get('theme') as string) || undefined,
  });

  if (idea) {
    awardIdeaXP(idea.id);
  }

  revalidatePath('/ideas');
  revalidatePath('/today');
  return { idea };
}

export async function updateIdeaAction(id: string, data: Record<string, unknown>) {
  const idea = updateIdea({ id, ...data } as Parameters<typeof updateIdea>[0]);
  revalidatePath('/ideas');
  revalidatePath(`/ideas/${id}`);
  return { idea };
}

export async function archiveIdeaAction(id: string) {
  archiveIdea(id);
  revalidatePath('/ideas');
}

// ============================================================
// ENTITY ACTIONS (People, Learning items)
// ============================================================

export async function createEntityAction(formData: FormData) {
  const title = formData.get('title') as string;
  const entityType = formData.get('entityType') as EntityType;
  if (!title?.trim()) return { error: 'Title is required' };
  if (!entityType) return { error: 'Entity type is required' };

  // Parse metadata from form (JSON string)
  let metadata: Record<string, unknown> = {};
  const metadataRaw = formData.get('metadata') as string;
  if (metadataRaw) {
    try { metadata = JSON.parse(metadataRaw); } catch { /* ignore */ }
  }

  // Also accept flat form fields for common metadata
  const author = formData.get('author') as string;
  const url = formData.get('url') as string;
  const platform = formData.get('platform') as string;
  const relationship = formData.get('relationship') as string;
  const company = formData.get('company') as string;
  if (author) metadata.author = author;
  if (url) metadata.url = url;
  if (platform) metadata.platform = platform;
  if (relationship) metadata.relationship = relationship;
  if (company) metadata.company = company;

  const entity = createEntity({
    title: title.trim(),
    entityType,
    body: (formData.get('body') as string) || undefined,
    metadata,
  });

  if (entity) {
    awardEntityXP(entity.id, entityType);
  }

  const basePath = entityType === 'person' ? '/people' : '/learning';
  revalidatePath(basePath);
  return { entity };
}

export async function updateEntityAction(id: string, data: Record<string, unknown>) {
  // If metadata is passed as a nested object, handle it
  const entity = updateEntity({ id, ...data } as Parameters<typeof updateEntity>[0]);
  const basePath = entity?.entityType === 'person' ? '/people' : '/learning';
  revalidatePath(basePath);
  revalidatePath(`${basePath}/${id}`);
  return { entity };
}

export async function archiveEntityAction(id: string, entityType?: string) {
  archiveEntity(id);
  const basePath = entityType === 'person' ? '/people' : '/learning';
  revalidatePath(basePath);
}
