import cron from 'node-cron';
import { and, asc, desc, eq, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { db } from '../db';
import { jobRuns, projects, scheduledJobs, tasks } from '../db/schema';
import { newId, now, toISODate, todayISO } from '@/lib/utils';
import type {
  RecurrenceFrequency,
  ReviewCadence,
  ReviewType,
  SchedulerJobType,
  SchedulerRunStatus,
  TaskPriority,
  TaskStatus,
} from '@/lib/types';
import { generateReviewForPeriod, getNextReviewPeriodStart, getReviewPeriodBounds } from './reviews';
import { syncSearchDocument } from './search';

const SCHEDULER_CRON_EXPRESSION = '*/5 * * * *';
const SCHEDULER_RUN_HOUR_UTC = 6;
const STALE_PROJECT_THRESHOLD_DAYS = 14;
const PROJECT_REVIEW_TITLE_PREFIX = 'Review project: ';
const STALE_PROJECT_TITLE_PREFIX = 'Stale project check: ';
const SYSTEM_REVIEW_TYPES: ReviewType[] = ['daily', 'weekly', 'monthly', 'yearly'];

type TaskRow = typeof tasks.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type ScheduledJobRow = typeof scheduledJobs.$inferSelect;

interface ParsedRecurrenceRule {
  frequency: RecurrenceFrequency;
}

interface JobExecutionResult {
  status: Exclude<SchedulerRunStatus, 'running'>;
  summary: string;
  details?: Record<string, unknown>;
  nextRunAt?: number | null;
  isActive?: boolean;
}

export interface SchedulerPassResult {
  source: string;
  processedJobs: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

export interface SchedulerDiagnostics {
  bootstrapped: boolean;
  activeJobs: number;
  dueJobs: number;
  failedRuns: number;
  overdueReviewTasks: number;
  staleProjects: number;
  lastSuccessfulRunAt: number | null;
  lastFailedRunAt: number | null;
}

type SchedulerGlobalState = {
  bootstrapped?: boolean;
  task?: cron.ScheduledTask;
  runPromise?: Promise<SchedulerPassResult>;
};

function getSchedulerGlobalState(): SchedulerGlobalState {
  const globalState = globalThis as typeof globalThis & {
    __lifeosSchedulerState__?: SchedulerGlobalState;
  };

  if (!globalState.__lifeosSchedulerState__) {
    globalState.__lifeosSchedulerState__ = {};
  }

  return globalState.__lifeosSchedulerState__;
}

function shouldSkipBootstrap(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  );
}

function formatISODateUTC(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseISODateUTC(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function isoDateToRunTimestamp(isoDate: string): number {
  const date = parseISODateUTC(isoDate);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    SCHEDULER_RUN_HOUR_UTC,
    0,
    0,
    0
  );
}

function addDaysUTC(isoDate: string, days: number): string {
  const date = parseISODateUTC(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODateUTC(date);
}

function addMonthsUTC(isoDate: string, months: number): string {
  const date = parseISODateUTC(isoDate);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);

  const lastDayOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 0, 0, 0, 0)
  ).getUTCDate();

  date.setUTCDate(Math.min(originalDay, lastDayOfMonth));
  return formatISODateUTC(date);
}

function addYearsUTC(isoDate: string, years: number): string {
  const date = parseISODateUTC(isoDate);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return formatISODateUTC(date);
}

function shiftDateByReviewCadence(isoDate: string, cadence: ReviewCadence): string {
  if (cadence === 'weekly') return addDaysUTC(isoDate, 7);
  if (cadence === 'biweekly') return addDaysUTC(isoDate, 14);
  return addMonthsUTC(isoDate, 1);
}

function shiftDateByRecurrence(isoDate: string, rule: ParsedRecurrenceRule): string {
  switch (rule.frequency) {
    case 'daily':
      return addDaysUTC(isoDate, 1);
    case 'weekdays': {
      let candidate = addDaysUTC(isoDate, 1);
      while ([0, 6].includes(parseISODateUTC(candidate).getUTCDay())) {
        candidate = addDaysUTC(candidate, 1);
      }
      return candidate;
    }
    case 'weekly':
      return addDaysUTC(isoDate, 7);
    case 'biweekly':
      return addDaysUTC(isoDate, 14);
    case 'monthly':
      return addMonthsUTC(isoDate, 1);
  }
}

export function parseRecurrenceRule(rawRule: string | null | undefined): ParsedRecurrenceRule | null {
  if (!rawRule) return null;

  const normalized = rawRule.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalized) as { frequency?: string; cadence?: string };
      return parseRecurrenceRule(parsed.frequency ?? parsed.cadence ?? null);
    } catch {
      return null;
    }
  }

  switch (normalized) {
    case 'daily':
    case 'every day':
    case 'everyday':
      return { frequency: 'daily' };
    case 'weekday':
    case 'weekdays':
    case 'every weekday':
      return { frequency: 'weekdays' };
    case 'weekly':
    case 'every week':
      return { frequency: 'weekly' };
    case 'biweekly':
    case 'every 2 weeks':
    case 'every two weeks':
      return { frequency: 'biweekly' };
    case 'monthly':
    case 'every month':
      return { frequency: 'monthly' };
    default:
      return null;
  }
}

function getTodayISOForTimestamp(timestamp: number): string {
  return formatISODateUTC(new Date(timestamp));
}

function buildProjectReviewTaskBody(project: ProjectRow, dueDate: string): string {
  const lines = [
    `Scheduled project review for **${project.title}**.`,
    '',
    `- Review due: ${dueDate}`,
    `- Current status: ${project.status}`,
  ];

  if (project.health) {
    lines.push(`- Current health: ${project.health.replace('_', ' ')}`);
  }

  if (project.targetDate) {
    lines.push(`- Target date: ${project.targetDate}`);
  }

  lines.push('');
  lines.push('Questions to answer:');
  lines.push('- What moved forward since the last check-in?');
  lines.push('- What is blocked or drifting?');
  lines.push('- What is the single most important next step?');

  return lines.join('\n');
}

function buildStaleProjectTaskBody(project: ProjectRow, staleDays: number, dueDate: string): string {
  const lines = [
    `This project has been quiet for at least ${staleDays} day${staleDays !== 1 ? 's' : ''}.`,
    '',
    `- Project: ${project.title}`,
    `- Last updated: ${toISODate(project.updatedAt)}`,
    `- Check-in due: ${dueDate}`,
  ];

  if (project.targetDate) {
    lines.push(`- Target date: ${project.targetDate}`);
  }

  lines.push('');
  lines.push('Prompt: decide whether to revive, pause, or close this project.');

  return lines.join('\n');
}

function insertTaskRecord(input: {
  title: string;
  body?: string;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  dueDate?: string | null;
  scheduledDate?: string | null;
  recurrenceRule?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  effortEstimate?: string | null;
  energyRequired?: string | null;
  context?: string | null;
  source?: 'manual' | 'inbox' | 'recurrence' | 'review';
}): TaskRow {
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
    completedAt: null,
    recurrenceRule: input.recurrenceRule ?? null,
    effortEstimate: input.effortEstimate ?? null,
    energyRequired: input.energyRequired ?? null,
    context: input.context ?? null,
    projectId: input.projectId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    sortOrder: 0,
    source: input.source ?? 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  } as typeof tasks.$inferInsert).run();

  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) {
    throw new Error(`Failed to load created task ${id}`);
  }

  syncSearchDocument({
    itemId: task.id,
    itemType: 'task',
    title: task.title,
    body: task.body ?? '',
  });

  return task;
}

function getTaskChildren(taskId: string) {
  return db.select().from(tasks)
    .where(eq(tasks.parentTaskId, taskId))
    .orderBy(desc(tasks.createdAt))
    .all();
}

function getOpenProjectReviewTask(projectId: string) {
  return db.select().from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.source, 'review'),
        isNull(tasks.archivedAt),
        or(
          eq(tasks.status, 'todo'),
          eq(tasks.status, 'in_progress'),
          eq(tasks.status, 'inbox')
        )
      )
    )
    .orderBy(desc(tasks.createdAt))
    .get();
}

function getLatestProjectReviewTask(projectId: string) {
  return db.select().from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.source, 'review'),
        isNull(tasks.archivedAt)
      )
    )
    .orderBy(desc(tasks.createdAt))
    .get();
}

function getOpenStaleProjectTask(projectId: string) {
  return db.select().from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.source, 'review'),
        isNull(tasks.archivedAt),
        or(
          eq(tasks.status, 'todo'),
          eq(tasks.status, 'in_progress'),
          eq(tasks.status, 'inbox')
        )
      )
    )
    .all()
    .find((task) => task.title.startsWith(STALE_PROJECT_TITLE_PREFIX));
}

function getRecurringTaskNextDates(task: TaskRow): {
  dueDate: string | null;
  scheduledDate: string | null;
  runDate: string;
} | null {
  if (!task.recurrenceRule || task.status !== 'done') return null;

  const parsedRule = parseRecurrenceRule(task.recurrenceRule);
  if (!parsedRule) return null;

  const nextDueDate = task.dueDate ? shiftDateByRecurrence(task.dueDate, parsedRule) : null;
  const nextScheduledDate = task.scheduledDate ? shiftDateByRecurrence(task.scheduledDate, parsedRule) : null;
  const fallbackBase = task.dueDate ?? task.scheduledDate ?? (task.completedAt ? toISODate(task.completedAt) : null);

  if (!fallbackBase) return null;

  const runDate = nextDueDate ?? nextScheduledDate ?? shiftDateByRecurrence(fallbackBase, parsedRule);

  return {
    dueDate: nextDueDate ?? (task.dueDate || task.scheduledDate ? null : runDate),
    scheduledDate: nextScheduledDate,
    runDate,
  };
}

function getNextProjectReviewDueDate(project: ProjectRow): string {
  const cadence = project.reviewCadence as ReviewCadence | null;
  if (!cadence) {
    return todayISO();
  }

  const currentDate = todayISO();
  const openTask = getOpenProjectReviewTask(project.id);
  if (openTask) {
    const anchor = openTask.dueDate ?? openTask.scheduledDate ?? toISODate(openTask.createdAt);
    let nextDue = shiftDateByReviewCadence(anchor, cadence);
    while (nextDue <= currentDate) {
      nextDue = shiftDateByReviewCadence(nextDue, cadence);
    }
    return nextDue;
  }

  const latestTask = getLatestProjectReviewTask(project.id);
  if (!latestTask) {
    return currentDate;
  }

  const anchor = latestTask.dueDate ?? latestTask.scheduledDate ?? toISODate(latestTask.createdAt);
  let nextDue = shiftDateByReviewCadence(anchor, cadence);
  while (nextDue < currentDate) {
    nextDue = shiftDateByReviewCadence(nextDue, cadence);
  }
  return nextDue;
}

function getStaleProjectIds(referenceTimestamp = now()): string[] {
  const cutoffDate = addDaysUTC(getTodayISOForTimestamp(referenceTimestamp), -STALE_PROJECT_THRESHOLD_DAYS);

  return db.select().from(projects)
    .where(
      and(
        isNull(projects.archivedAt),
        eq(projects.status, 'active')
      )
    )
    .all()
    .filter((project) => toISODate(project.updatedAt) <= cutoffDate)
    .map((project) => project.id);
}

function upsertScheduledJob(input: {
  jobKey: string;
  jobType: SchedulerJobType;
  subjectType?: string | null;
  subjectId?: string | null;
  cadence?: string | null;
  nextRunAt?: number | null;
  metadata?: string | null;
  isActive?: boolean;
}) {
  const existing = db.select().from(scheduledJobs).where(eq(scheduledJobs.jobKey, input.jobKey)).get();
  const timestamp = now();

  if (existing) {
    db.update(scheduledJobs)
      .set({
        jobType: input.jobType,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        cadence: input.cadence ?? null,
        nextRunAt: input.nextRunAt ?? null,
        metadata: input.metadata ?? null,
        isActive: input.isActive === false ? 0 : 1,
        updatedAt: timestamp,
      })
      .where(eq(scheduledJobs.id, existing.id))
      .run();

    return db.select().from(scheduledJobs).where(eq(scheduledJobs.id, existing.id)).get();
  }

  const id = newId();
  db.insert(scheduledJobs).values({
    id,
    jobKey: input.jobKey,
    jobType: input.jobType,
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    cadence: input.cadence ?? null,
    nextRunAt: input.nextRunAt ?? null,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    metadata: input.metadata ?? null,
    isActive: input.isActive === false ? 0 : 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  return db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get();
}

function deactivateJob(jobKey: string) {
  const timestamp = now();
  db.update(scheduledJobs)
    .set({
      isActive: 0,
      nextRunAt: null,
      updatedAt: timestamp,
    })
    .where(eq(scheduledJobs.jobKey, jobKey))
    .run();
}

function ensureSystemJobs() {
  const currentTimestamp = now();

  for (const reviewType of SYSTEM_REVIEW_TYPES) {
    const currentPeriodStart = getReviewPeriodBounds(reviewType, getTodayISOForTimestamp(currentTimestamp)).periodStart;
    const jobKey = `review-generation:${reviewType}`;
    const existing = db.select().from(scheduledJobs).where(eq(scheduledJobs.jobKey, jobKey)).get();

    if (!existing) {
      upsertScheduledJob({
        jobKey,
        jobType: 'review_generation',
        cadence: reviewType,
        nextRunAt: isoDateToRunTimestamp(currentPeriodStart),
        metadata: JSON.stringify({ reviewType }),
        isActive: true,
      });
      continue;
    }

    db.update(scheduledJobs)
      .set({
        jobType: 'review_generation',
        cadence: reviewType,
        metadata: JSON.stringify({ reviewType }),
        isActive: 1,
        updatedAt: currentTimestamp,
      })
      .where(eq(scheduledJobs.id, existing.id))
      .run();
  }

  const currentDate = getTodayISOForTimestamp(currentTimestamp);
  const staleScanKey = 'stale-project-scan';
  const staleScanJob = db.select().from(scheduledJobs).where(eq(scheduledJobs.jobKey, staleScanKey)).get();

  if (!staleScanJob) {
    upsertScheduledJob({
      jobKey: staleScanKey,
      jobType: 'stale_project_scan',
      cadence: 'daily',
      nextRunAt: isoDateToRunTimestamp(currentDate),
      metadata: JSON.stringify({ thresholdDays: STALE_PROJECT_THRESHOLD_DAYS }),
      isActive: true,
    });
    return;
  }

  db.update(scheduledJobs)
    .set({
      jobType: 'stale_project_scan',
      cadence: 'daily',
      metadata: JSON.stringify({ thresholdDays: STALE_PROJECT_THRESHOLD_DAYS }),
      isActive: 1,
      updatedAt: currentTimestamp,
    })
    .where(eq(scheduledJobs.id, staleScanJob.id))
    .run();
}

function getRecurringTaskJobKeys() {
  return db.select({ subjectId: scheduledJobs.subjectId }).from(scheduledJobs)
    .where(eq(scheduledJobs.jobType, 'recurring_task'))
    .all()
    .map((job) => job.subjectId)
    .filter((value): value is string => Boolean(value));
}

function getProjectReviewJobKeys() {
  return db.select({ subjectId: scheduledJobs.subjectId }).from(scheduledJobs)
    .where(eq(scheduledJobs.jobType, 'project_review'))
    .all()
    .map((job) => job.subjectId)
    .filter((value): value is string => Boolean(value));
}

export function syncRecurringTaskJob(taskId: string) {
  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  const jobKey = `recurring-task:${taskId}`;

  if (!task || task.archivedAt || !task.recurrenceRule || task.status !== 'done') {
    deactivateJob(jobKey);
    return;
  }

  if (!parseRecurrenceRule(task.recurrenceRule)) {
    upsertScheduledJob({
      jobKey,
      jobType: 'recurring_task',
      subjectType: 'task',
      subjectId: taskId,
      cadence: task.recurrenceRule,
      nextRunAt: null,
      metadata: JSON.stringify({ recurrenceRule: task.recurrenceRule, invalid: true }),
      isActive: false,
    });
    return;
  }

  const existingChildren = getTaskChildren(taskId);
  if (existingChildren.length > 0) {
    deactivateJob(jobKey);
    return;
  }

  const nextDates = getRecurringTaskNextDates(task);
  if (!nextDates) {
    deactivateJob(jobKey);
    return;
  }

  upsertScheduledJob({
    jobKey,
    jobType: 'recurring_task',
    subjectType: 'task',
    subjectId: taskId,
    cadence: task.recurrenceRule,
    nextRunAt: isoDateToRunTimestamp(nextDates.runDate),
    metadata: JSON.stringify(nextDates),
    isActive: true,
  });
}

export function syncProjectReviewJob(projectId: string) {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  const jobKey = `project-review:${projectId}`;

  if (
    !project ||
    project.archivedAt ||
    !project.reviewCadence ||
    project.status === 'completed' ||
    project.status === 'cancelled' ||
    project.status === 'paused'
  ) {
    deactivateJob(jobKey);
    return;
  }

  const nextDueDate = getNextProjectReviewDueDate(project);

  upsertScheduledJob({
    jobKey,
    jobType: 'project_review',
    subjectType: 'project',
    subjectId: projectId,
    cadence: project.reviewCadence,
    nextRunAt: isoDateToRunTimestamp(nextDueDate),
    metadata: JSON.stringify({ nextDueDate }),
    isActive: true,
  });
}

export function syncAllScheduledJobs() {
  ensureSystemJobs();

  const recurringTaskIds = new Set([
    ...db.select({ id: tasks.id }).from(tasks)
      .where(and(isNull(tasks.archivedAt), isNotNull(tasks.recurrenceRule)))
      .all()
      .map((task) => task.id),
    ...getRecurringTaskJobKeys(),
  ]);

  for (const taskId of recurringTaskIds) {
    syncRecurringTaskJob(taskId);
  }

  const projectIds = new Set([
    ...db.select({ id: projects.id }).from(projects)
      .where(and(isNull(projects.archivedAt), isNotNull(projects.reviewCadence)))
      .all()
      .map((project) => project.id),
    ...getProjectReviewJobKeys(),
  ]);

  for (const projectId of projectIds) {
    syncProjectReviewJob(projectId);
  }
}

function getExistingRun(runKey: string) {
  return db.select().from(jobRuns).where(eq(jobRuns.runKey, runKey)).get();
}

function createRunningRun(jobId: string, runKey: string) {
  const id = newId();
  const timestamp = now();
  db.insert(jobRuns).values({
    id,
    jobId,
    runKey,
    status: 'running',
    summary: null,
    details: null,
    startedAt: timestamp,
    completedAt: null,
    createdAt: timestamp,
  }).run();
  return db.select().from(jobRuns).where(eq(jobRuns.id, id)).get();
}

function completeRun(runId: string, result: JobExecutionResult) {
  const completedAt = now();
  db.update(jobRuns)
    .set({
      status: result.status,
      summary: result.summary,
      details: result.details ? JSON.stringify(result.details) : null,
      completedAt,
    })
    .where(eq(jobRuns.id, runId))
    .run();
}

function applyJobExecutionResult(job: ScheduledJobRow, result: JobExecutionResult) {
  const timestamp = now();
  db.update(scheduledJobs)
    .set({
      nextRunAt: result.nextRunAt ?? null,
      lastRunAt: timestamp,
      lastSuccessAt: result.status === 'failed' ? job.lastSuccessAt : timestamp,
      lastError: result.status === 'failed' ? result.summary : null,
      isActive: result.isActive === false ? 0 : 1,
      updatedAt: timestamp,
    })
    .where(eq(scheduledJobs.id, job.id))
    .run();
}

function advanceJobWithoutReplaying(job: ScheduledJobRow, dueAt: number): JobExecutionResult {
  switch (job.jobType) {
    case 'recurring_task':
      return {
        status: 'skipped',
        summary: 'Recurring task slot already processed.',
        nextRunAt: null,
        isActive: false,
      };
    case 'project_review': {
      const project = job.subjectId
        ? db.select().from(projects).where(eq(projects.id, job.subjectId)).get()
        : null;
      if (!project || !project.reviewCadence) {
        return {
          status: 'skipped',
          summary: 'Project review job no longer has an active project.',
          nextRunAt: null,
          isActive: false,
        };
      }

      const nextDueDate = shiftDateByReviewCadence(getTodayISOForTimestamp(dueAt), project.reviewCadence as ReviewCadence);
      return {
        status: 'skipped',
        summary: 'Project review slot was already handled.',
        nextRunAt: isoDateToRunTimestamp(nextDueDate),
        isActive: true,
      };
    }
    case 'review_generation': {
      const reviewType = (job.cadence as ReviewType | null) ?? 'weekly';
      const nextStart = getNextReviewPeriodStart(reviewType, getTodayISOForTimestamp(dueAt));
      return {
        status: 'skipped',
        summary: 'Review generation slot was already handled.',
        nextRunAt: isoDateToRunTimestamp(nextStart),
        isActive: true,
      };
    }
    case 'stale_project_scan':
      return {
        status: 'skipped',
        summary: 'Stale-project scan slot was already handled.',
        nextRunAt: isoDateToRunTimestamp(addDaysUTC(getTodayISOForTimestamp(dueAt), 1)),
        isActive: true,
      };
  }
}

function executeRecurringTaskJob(job: ScheduledJobRow, dueAt: number): JobExecutionResult {
  const task = job.subjectId
    ? db.select().from(tasks).where(eq(tasks.id, job.subjectId)).get()
    : null;

  if (!task || task.archivedAt || !task.recurrenceRule || task.status !== 'done') {
    return {
      status: 'skipped',
      summary: 'Recurring task source is no longer eligible.',
      nextRunAt: null,
      isActive: false,
    };
  }

  const existingChildren = getTaskChildren(task.id);
  if (existingChildren.length > 0) {
    return {
      status: 'skipped',
      summary: 'Next recurring task already exists.',
      details: { childTaskId: existingChildren[0].id },
      nextRunAt: null,
      isActive: false,
    };
  }

  const nextDates = getRecurringTaskNextDates(task);
  if (!nextDates) {
    return {
      status: 'skipped',
      summary: 'Recurring task rule could not be materialized.',
      nextRunAt: null,
      isActive: false,
    };
  }

  if (dueAt < isoDateToRunTimestamp(nextDates.runDate)) {
    return {
      status: 'skipped',
      summary: 'Recurring task is not due yet.',
      nextRunAt: isoDateToRunTimestamp(nextDates.runDate),
      isActive: true,
    };
  }

  const createdTask = insertTaskRecord({
    title: task.title,
    body: task.body ?? undefined,
    status: 'todo',
    priority: task.priority,
    dueDate: nextDates.dueDate,
    scheduledDate: nextDates.scheduledDate,
    recurrenceRule: task.recurrenceRule,
    projectId: task.projectId,
    parentTaskId: task.id,
    effortEstimate: task.effortEstimate,
    energyRequired: task.energyRequired,
    context: task.context,
    source: 'recurrence',
  });

  return {
    status: 'succeeded',
    summary: 'Created the next recurring task.',
    details: {
      createdTaskId: createdTask.id,
      dueDate: createdTask.dueDate,
      scheduledDate: createdTask.scheduledDate,
    },
    nextRunAt: null,
    isActive: false,
  };
}

function executeProjectReviewJob(job: ScheduledJobRow, dueAt: number): JobExecutionResult {
  const project = job.subjectId
    ? db.select().from(projects).where(eq(projects.id, job.subjectId)).get()
    : null;

  if (
    !project ||
    project.archivedAt ||
    !project.reviewCadence ||
    project.status === 'completed' ||
    project.status === 'cancelled' ||
    project.status === 'paused'
  ) {
    return {
      status: 'skipped',
      summary: 'Project review cadence is no longer active.',
      nextRunAt: null,
      isActive: false,
    };
  }

  const dueDate = getTodayISOForTimestamp(dueAt);
  const openTask = getOpenProjectReviewTask(project.id);
  const nextDueDate = shiftDateByReviewCadence(dueDate, project.reviewCadence as ReviewCadence);

  if (openTask) {
    return {
      status: 'skipped',
      summary: 'Project review reminder is already open.',
      details: { existingTaskId: openTask.id },
      nextRunAt: isoDateToRunTimestamp(nextDueDate),
      isActive: true,
    };
  }

  const reminderTask = insertTaskRecord({
    title: `${PROJECT_REVIEW_TITLE_PREFIX}${project.title}`,
    body: buildProjectReviewTaskBody(project, dueDate),
    status: 'todo',
    priority: 'p2',
    dueDate,
    scheduledDate: dueDate,
    projectId: project.id,
    context: 'project_review',
    source: 'review',
  });

  return {
    status: 'succeeded',
    summary: 'Created a scheduled project review reminder.',
    details: { taskId: reminderTask.id, dueDate },
    nextRunAt: isoDateToRunTimestamp(nextDueDate),
    isActive: true,
  };
}

function executeReviewGenerationJob(job: ScheduledJobRow, dueAt: number): JobExecutionResult {
  const reviewType = (job.cadence as ReviewType | null) ?? 'weekly';
  const periodStart = getTodayISOForTimestamp(dueAt);
  const { review, isNew } = generateReviewForPeriod(reviewType, periodStart);
  const nextPeriodStart = getNextReviewPeriodStart(reviewType, periodStart);

  return {
    status: 'succeeded',
    summary: isNew
      ? `Generated ${reviewType} review draft.`
      : `${reviewType[0].toUpperCase()}${reviewType.slice(1)} review already existed.`,
    details: { reviewId: review?.id ?? null, reviewType, isNew },
    nextRunAt: isoDateToRunTimestamp(nextPeriodStart),
    isActive: true,
  };
}

function executeStaleProjectScanJob(job: ScheduledJobRow, dueAt: number): JobExecutionResult {
  const referenceDate = getTodayISOForTimestamp(dueAt);
  const cutoffDate = addDaysUTC(referenceDate, -STALE_PROJECT_THRESHOLD_DAYS);
  const staleCandidates = db.select().from(projects)
    .where(
      and(
        isNull(projects.archivedAt),
        eq(projects.status, 'active')
      )
    )
    .orderBy(asc(projects.updatedAt))
    .all()
    .filter((project) => toISODate(project.updatedAt) <= cutoffDate);

  const createdTaskIds: string[] = [];

  for (const project of staleCandidates) {
    const existingPrompt = getOpenStaleProjectTask(project.id);
    if (existingPrompt) continue;

    const task = insertTaskRecord({
      title: `${STALE_PROJECT_TITLE_PREFIX}${project.title}`,
      body: buildStaleProjectTaskBody(project, STALE_PROJECT_THRESHOLD_DAYS, referenceDate),
      status: 'todo',
      priority: 'p2',
      dueDate: referenceDate,
      scheduledDate: referenceDate,
      projectId: project.id,
      context: 'stale_project_check',
      source: 'review',
    });

    createdTaskIds.push(task.id);
  }

  return {
    status: 'succeeded',
    summary: createdTaskIds.length > 0
      ? `Created ${createdTaskIds.length} stale-project prompt${createdTaskIds.length !== 1 ? 's' : ''}.`
      : 'No stale-project prompts were needed.',
    details: { createdTaskIds },
    nextRunAt: isoDateToRunTimestamp(addDaysUTC(referenceDate, 1)),
    isActive: true,
  };
}

function executeOneJob(job: ScheduledJobRow): JobExecutionResult {
  const dueAt = job.nextRunAt ?? now();

  switch (job.jobType) {
    case 'recurring_task':
      return executeRecurringTaskJob(job, dueAt);
    case 'project_review':
      return executeProjectReviewJob(job, dueAt);
    case 'review_generation':
      return executeReviewGenerationJob(job, dueAt);
    case 'stale_project_scan':
      return executeStaleProjectScanJob(job, dueAt);
  }
}

export async function runSchedulerPass(options: { maxJobs?: number; source?: string } = {}): Promise<SchedulerPassResult> {
  const { maxJobs = 25, source = 'manual' } = options;
  const state = getSchedulerGlobalState();

  if (state.runPromise) {
    return state.runPromise;
  }

  state.runPromise = (async () => {
    syncAllScheduledJobs();

    const result: SchedulerPassResult = {
      source,
      processedJobs: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };

    while (result.processedJobs < maxJobs) {
      const dueJobs = db.select().from(scheduledJobs)
        .where(
          and(
            eq(scheduledJobs.isActive, 1),
            isNotNull(scheduledJobs.nextRunAt),
            lte(scheduledJobs.nextRunAt, now())
          )
        )
        .orderBy(asc(scheduledJobs.nextRunAt))
        .limit(maxJobs - result.processedJobs)
        .all();

      if (dueJobs.length === 0) break;

      for (const job of dueJobs) {
        const dueAt = job.nextRunAt ?? now();
        const runKey = `${job.id}:${dueAt}`;
        const existingRun = getExistingRun(runKey);

        if (existingRun && existingRun.status !== 'running') {
          const replayResult = advanceJobWithoutReplaying(job, dueAt);
          applyJobExecutionResult(job, replayResult);
          result.processedJobs += 1;
          if (replayResult.status === 'succeeded') result.succeeded += 1;
          else result.skipped += 1;
          continue;
        }

        const run = existingRun ?? createRunningRun(job.id, runKey);
        if (!run) {
          result.failed += 1;
          result.processedJobs += 1;
          continue;
        }

        try {
          const execution = executeOneJob(job);
          completeRun(run.id, execution);
          applyJobExecutionResult(job, execution);

          result.processedJobs += 1;
          if (execution.status === 'succeeded') result.succeeded += 1;
          else if (execution.status === 'failed') result.failed += 1;
          else result.skipped += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown scheduler error';
          const failureResult: JobExecutionResult = {
            status: 'failed',
            summary: message,
            nextRunAt: job.nextRunAt,
            isActive: true,
          };

          completeRun(run.id, failureResult);
          applyJobExecutionResult(job, failureResult);

          result.processedJobs += 1;
          result.failed += 1;
        }
      }
    }

    return result;
  })();

  try {
    return await state.runPromise;
  } finally {
    state.runPromise = undefined;
  }
}

export function bootstrapScheduler() {
  if (shouldSkipBootstrap()) return;

  const state = getSchedulerGlobalState();
  if (state.bootstrapped) return;

  state.task = cron.schedule(SCHEDULER_CRON_EXPRESSION, () => {
    void runSchedulerPass({ source: 'cron' });
  });
  state.bootstrapped = true;

  void runSchedulerPass({ source: 'bootstrap' });
}

export function getSchedulerDiagnostics(): SchedulerDiagnostics {
  const state = getSchedulerGlobalState();

  try {
    syncAllScheduledJobs();
  } catch {
    return {
      bootstrapped: Boolean(state.bootstrapped),
      activeJobs: 0,
      dueJobs: 0,
      failedRuns: 0,
      overdueReviewTasks: 0,
      staleProjects: 0,
      lastSuccessfulRunAt: null,
      lastFailedRunAt: null,
    };
  }

  const activeJobs = db.select({ id: scheduledJobs.id }).from(scheduledJobs)
    .where(eq(scheduledJobs.isActive, 1))
    .all().length;

  const dueJobs = db.select({ id: scheduledJobs.id }).from(scheduledJobs)
    .where(
      and(
        eq(scheduledJobs.isActive, 1),
        isNotNull(scheduledJobs.nextRunAt),
        lte(scheduledJobs.nextRunAt, now())
      )
    )
    .all().length;

  const failedRuns = db.select({ id: jobRuns.id }).from(jobRuns)
    .where(eq(jobRuns.status, 'failed'))
    .all().length;

  const overdueReviewTasks = db.select({ id: tasks.id }).from(tasks)
    .where(
      and(
        eq(tasks.source, 'review'),
        isNull(tasks.archivedAt),
        or(
          eq(tasks.status, 'todo'),
          eq(tasks.status, 'in_progress'),
          eq(tasks.status, 'inbox')
        ),
        isNotNull(tasks.dueDate),
        lte(tasks.dueDate, todayISO())
      )
    )
    .all().length;

  const staleProjects = getStaleProjectIds().length;

  const latestSuccess = db.select().from(jobRuns)
    .where(eq(jobRuns.status, 'succeeded'))
    .orderBy(desc(jobRuns.completedAt))
    .get();

  const latestFailure = db.select().from(jobRuns)
    .where(eq(jobRuns.status, 'failed'))
    .orderBy(desc(jobRuns.completedAt))
    .get();

  return {
    bootstrapped: Boolean(state.bootstrapped),
    activeJobs,
    dueJobs,
    failedRuns,
    overdueReviewTasks,
    staleProjects,
    lastSuccessfulRunAt: latestSuccess?.completedAt ?? null,
    lastFailedRunAt: latestFailure?.completedAt ?? null,
  };
}

export function getProjectReviewTitlePrefix() {
  return PROJECT_REVIEW_TITLE_PREFIX;
}

export function getStaleProjectTitlePrefix() {
  return STALE_PROJECT_TITLE_PREFIX;
}
