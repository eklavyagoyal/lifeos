import { and, eq, gte, isNull, lte, ne } from 'drizzle-orm';
import { db } from '../db';
import { goals, habitCompletions, habits, milestones, projects, tasks } from '../db/schema';
import { now, todayISO } from '@/lib/utils';
import type { MilestoneStatus } from '@/lib/types';

type TaskRow = typeof tasks.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type HabitRow = typeof habits.$inferSelect;
type MilestoneRow = typeof milestones.$inferSelect;

export interface ComputedMilestoneState {
  progress: number;
  status: MilestoneStatus;
  source: 'manual' | 'task' | 'project' | 'habit';
  linkedItem?: {
    id: string;
    type: 'task' | 'project' | 'habit';
    title: string;
    detailUrl: string;
    status?: string | null;
  };
}

export interface GoalRollupSummary {
  progress: number;
  contributorCount: number;
  milestoneCount: number;
  linkedTaskCount: number;
  linkedProjectCount: number;
  linkedHabitCount: number;
  usesDerivedProgress: boolean;
}

function parseISODateUTC(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function formatISODateUTC(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDaysUTC(isoDate: string, days: number): string {
  const date = parseISODateUTC(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODateUTC(date);
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getTaskProgressValue(task: TaskRow): number {
  switch (task.status) {
    case 'done':
      return 100;
    case 'in_progress':
      return 60;
    case 'cancelled':
      return 0;
    default:
      return 0;
  }
}

function mapTaskStatusToMilestoneStatus(task: TaskRow, fallback: MilestoneStatus): MilestoneStatus {
  switch (task.status) {
    case 'done':
      return 'done';
    case 'in_progress':
      return 'active';
    case 'cancelled':
      return 'cancelled';
    default:
      return fallback;
  }
}

function mapProjectStatusToMilestoneStatus(project: ProjectRow, fallback: MilestoneStatus): MilestoneStatus {
  switch (project.status) {
    case 'completed':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    case 'active':
      return 'active';
    default:
      return fallback;
  }
}

function getPossibleHabitCompletions(habit: HabitRow, startDate: string, endDate: string): number {
  const start = parseISODateUTC(startDate);
  const end = parseISODateUTC(endDate);
  const dayCount = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (habit.cadence === 'daily') {
    return dayCount;
  }

  if (habit.cadence === 'weekly') {
    return Math.ceil(dayCount / 7);
  }

  if (habit.cadence === 'custom' && habit.scheduleRule) {
    try {
      const parsed = JSON.parse(habit.scheduleRule) as { days?: number[] };
      const scheduledDays = Array.isArray(parsed.days) ? parsed.days : [];

      if (scheduledDays.length > 0) {
        let possible = 0;
        const cursor = new Date(start);

        while (cursor <= end) {
          const jsDay = cursor.getUTCDay();
          const isoDay = jsDay === 0 ? 7 : jsDay;
          if (scheduledDays.includes(jsDay) || scheduledDays.includes(isoDay)) {
            possible += 1;
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        return Math.max(possible, 1);
      }
    } catch {
      return dayCount;
    }
  }

  return dayCount;
}

export function getHabitCompletionRate(habitId: string, windowDays = 30): number {
  const habit = db.select().from(habits).where(eq(habits.id, habitId)).get();
  if (!habit || habit.archivedAt) return 0;

  const endDate = todayISO();
  const startDate = addDaysUTC(endDate, -(windowDays - 1));

  const completions = db.select().from(habitCompletions)
    .where(
      and(
        eq(habitCompletions.habitId, habitId),
        gte(habitCompletions.completedDate, startDate),
        lte(habitCompletions.completedDate, endDate)
      )
    )
    .all();

  const possible = getPossibleHabitCompletions(habit, startDate, endDate);
  if (possible <= 0) return 0;

  return clampProgress((completions.length / possible) * 100);
}

export function computeProjectProgressValue(projectId: string): number {
  const projectTasks = db.select().from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        isNull(tasks.archivedAt),
        ne(tasks.source, 'review')
      )
    )
    .all();

  if (projectTasks.length === 0) return 0;

  const total = projectTasks.reduce((sum, task) => sum + getTaskProgressValue(task), 0);
  return clampProgress(total / projectTasks.length);
}

export function getComputedMilestoneState(milestone: MilestoneRow): ComputedMilestoneState {
  if (milestone.taskId) {
    const task = db.select().from(tasks).where(eq(tasks.id, milestone.taskId)).get();
    if (task && !task.archivedAt) {
      return {
        progress: getTaskProgressValue(task),
        status: mapTaskStatusToMilestoneStatus(task, milestone.status),
        source: 'task',
        linkedItem: {
          id: task.id,
          type: 'task',
          title: task.title,
          detailUrl: `/tasks/${task.id}`,
          status: task.status,
        },
      };
    }
  }

  if (milestone.projectId) {
    const project = db.select().from(projects).where(eq(projects.id, milestone.projectId)).get();
    if (project && !project.archivedAt) {
      return {
        progress: computeProjectProgressValue(project.id),
        status: mapProjectStatusToMilestoneStatus(project, milestone.status),
        source: 'project',
        linkedItem: {
          id: project.id,
          type: 'project',
          title: project.title,
          detailUrl: `/projects/${project.id}`,
          status: project.status,
        },
      };
    }
  }

  if (milestone.habitId) {
    const habit = db.select().from(habits).where(eq(habits.id, milestone.habitId)).get();
    if (habit && !habit.archivedAt) {
      const progress = getHabitCompletionRate(habit.id);
      return {
        progress,
        status: progress >= 100 ? 'done' : progress > 0 ? 'active' : milestone.status,
        source: 'habit',
        linkedItem: {
          id: habit.id,
          type: 'habit',
          title: habit.name,
          detailUrl: `/habits/${habit.id}`,
          status: habit.isPaused ? 'paused' : habit.cadence,
        },
      };
    }
  }

  return {
    progress: clampProgress(milestone.progress ?? 0),
    status: milestone.completedAt ? 'done' : milestone.status,
    source: 'manual',
  };
}

function getDirectGoalTasks(goalId: string, excludedTaskIds: Set<string>) {
  return db.select().from(tasks)
    .where(and(eq(tasks.goalId, goalId), isNull(tasks.archivedAt)))
    .all()
    .filter((task) => !excludedTaskIds.has(task.id));
}

function getDirectGoalProjects(goalId: string, excludedProjectIds: Set<string>) {
  return db.select().from(projects)
    .where(and(eq(projects.goalId, goalId), isNull(projects.archivedAt)))
    .all()
    .filter((project) => !excludedProjectIds.has(project.id));
}

function getDirectGoalHabits(goalId: string, excludedHabitIds: Set<string>) {
  return db.select().from(habits)
    .where(and(eq(habits.goalId, goalId), isNull(habits.archivedAt)))
    .all()
    .filter((habit) => !excludedHabitIds.has(habit.id));
}

export function calculateGoalRollup(goalId: string): GoalRollupSummary {
  const goal = db.select().from(goals).where(eq(goals.id, goalId)).get();
  if (!goal || goal.archivedAt) {
    return {
      progress: 0,
      contributorCount: 0,
      milestoneCount: 0,
      linkedTaskCount: 0,
      linkedProjectCount: 0,
      linkedHabitCount: 0,
      usesDerivedProgress: false,
    };
  }

  const goalMilestones = db.select().from(milestones)
    .where(and(eq(milestones.goalId, goalId), isNull(milestones.archivedAt), ne(milestones.status, 'cancelled')))
    .all();

  const milestoneTaskIds = new Set(goalMilestones.map((milestone) => milestone.taskId).filter((value): value is string => Boolean(value)));
  const milestoneProjectIds = new Set(goalMilestones.map((milestone) => milestone.projectId).filter((value): value is string => Boolean(value)));
  const milestoneHabitIds = new Set(goalMilestones.map((milestone) => milestone.habitId).filter((value): value is string => Boolean(value)));

  const directTasks = getDirectGoalTasks(goalId, milestoneTaskIds);
  const directProjects = getDirectGoalProjects(goalId, milestoneProjectIds);
  const directHabits = getDirectGoalHabits(goalId, milestoneHabitIds);

  const contributors = [
    ...goalMilestones.map((milestone) => getComputedMilestoneState(milestone).progress),
    ...directTasks.map((task) => getTaskProgressValue(task)),
    ...directProjects.map((project) => computeProjectProgressValue(project.id)),
    ...directHabits.map((habit) => getHabitCompletionRate(habit.id)),
  ];

  const usesDerivedProgress = contributors.length > 0;
  const progress = usesDerivedProgress
    ? clampProgress(contributors.reduce((sum, value) => sum + value, 0) / contributors.length)
    : clampProgress(goal.progress ?? 0);

  return {
    progress,
    contributorCount: contributors.length,
    milestoneCount: goalMilestones.length,
    linkedTaskCount: directTasks.length,
    linkedProjectCount: directProjects.length,
    linkedHabitCount: directHabits.length,
    usesDerivedProgress,
  };
}

export function recalculateGoalProgress(goalId: string): GoalRollupSummary {
  const summary = calculateGoalRollup(goalId);

  if (summary.usesDerivedProgress) {
    db.update(goals)
      .set({ progress: summary.progress, updatedAt: now() })
      .where(eq(goals.id, goalId))
      .run();
  }

  return summary;
}

function getMilestoneGoalIdsForLink(linkField: 'taskId' | 'projectId' | 'habitId', linkId: string) {
  return db.select({ goalId: milestones.goalId }).from(milestones)
    .where(and(eq(milestones[linkField], linkId), isNull(milestones.archivedAt)))
    .all()
    .map((row) => row.goalId);
}

function recalculateGoalProgresses(goalIds: string[]) {
  for (const goalId of new Set(goalIds.filter(Boolean))) {
    recalculateGoalProgress(goalId);
  }
}

export function recalculateGoalsLinkedToTask(taskId: string) {
  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  const goalIds = [
    task?.goalId ?? '',
    ...getMilestoneGoalIdsForLink('taskId', taskId),
  ];
  recalculateGoalProgresses(goalIds);
}

export function recalculateGoalsLinkedToProject(projectId: string) {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  const goalIds = [
    project?.goalId ?? '',
    ...getMilestoneGoalIdsForLink('projectId', projectId),
  ];
  recalculateGoalProgresses(goalIds);
}

export function recalculateGoalsLinkedToHabit(habitId: string) {
  const habit = db.select().from(habits).where(eq(habits.id, habitId)).get();
  const goalIds = [
    habit?.goalId ?? '',
    ...getMilestoneGoalIdsForLink('habitId', habitId),
  ];
  recalculateGoalProgresses(goalIds);
}

export function recalculateProjectProgress(projectId: string): number {
  const progress = computeProjectProgressValue(projectId);

  db.update(projects)
    .set({ progress, updatedAt: now() })
    .where(eq(projects.id, projectId))
    .run();

  recalculateGoalsLinkedToProject(projectId);
  return progress;
}
