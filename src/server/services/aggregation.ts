/**
 * lifeOS — Aggregation Helpers
 *
 * Pure functions that summarize domain data for a given date range.
 * Used by weekly review generation and future monthly/yearly reviews.
 * Each aggregator returns a typed summary object.
 */

import { db } from '../db';
import {
  tasks, habits, habitCompletions, journalEntries,
  metricLogs, projects, goals, ideas, notes,
} from '../db/schema';
import { and, eq, gte, lte, isNull, desc } from 'drizzle-orm';

// ============================================================
// Result Types
// ============================================================

export interface TaskSummary {
  completed: number;
  created: number;
  overdue: number;
  cancelled: number;
  completedTitles: string[];
  overdueTitles: string[];
  byPriority: Record<string, number>;
}

export interface HabitSummary {
  totalActive: number;
  totalCompletions: number;
  possibleCompletions: number;
  completionRate: number; // 0-100
  byHabit: Array<{
    name: string;
    completions: number;
    possible: number;
    rate: number;
    currentStreak: number;
  }>;
  bestStreaks: Array<{ name: string; streak: number }>;
}

export interface MetricSummary {
  sleepAvg: number | null;
  sleepCount: number;
  moodAvg: number | null;
  moodCount: number;
  energyAvg: number | null;
  energyCount: number;
  workoutCount: number;
  workoutMinutes: number;
  expenseTotal: number;
  expenseCount: number;
  moodTrend: 'up' | 'down' | 'stable' | null;
  energyTrend: 'up' | 'down' | 'stable' | null;
}

export interface JournalSummary {
  entryCount: number;
  totalWords: number;
  highlights: Array<{
    id: string;
    title: string | null;
    date: string;
    snippet: string;
    mood: number | null;
  }>;
}

export interface ProjectSummary {
  activeCount: number;
  progressed: Array<{
    id: string;
    title: string;
    status: string;
    progress: number | null;
    health: string | null;
  }>;
}

export interface GoalSummary {
  activeCount: number;
  goals: Array<{
    id: string;
    title: string;
    progress: number | null;
    status: string;
  }>;
}

export interface IdeasSummary {
  capturedCount: number;
  titles: string[];
}

export interface ReviewSnapshot {
  periodStart: string;
  periodEnd: string;
  generatedAt: number;
  tasks: TaskSummary;
  habits: HabitSummary;
  metrics: MetricSummary;
  journal: JournalSummary;
  projects: ProjectSummary;
  goals: GoalSummary;
  ideas: IdeasSummary;
  wins: string[];
  blockers: string[];
  focusAreas: string[];
}

export type WeeklySnapshot = ReviewSnapshot;

// ============================================================
// Aggregators
// ============================================================

/** Count the days between two ISO date strings (inclusive) */
function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/** Compute trend from an ordered array of numbers: 'up', 'down', or 'stable' */
function computeTrend(values: number[]): 'up' | 'down' | 'stable' | null {
  if (values.length < 2) return null;
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = avgSecond - avgFirst;
  if (diff > 0.5) return 'up';
  if (diff < -0.5) return 'down';
  return 'stable';
}

export function aggregateTasks(start: string, end: string): TaskSummary {
  const allTasks = db.select().from(tasks).all();

  const completed = allTasks.filter(
    t => t.status === 'done' && t.completedAt &&
      new Date(t.completedAt).toISOString().split('T')[0] >= start &&
      new Date(t.completedAt).toISOString().split('T')[0] <= end
  );

  const created = allTasks.filter(
    t => new Date(t.createdAt).toISOString().split('T')[0] >= start &&
      new Date(t.createdAt).toISOString().split('T')[0] <= end
  );

  const overdue = allTasks.filter(
    t => t.dueDate && t.dueDate <= end && t.dueDate >= start &&
      t.status !== 'done' && t.status !== 'cancelled' && !t.archivedAt
  );

  const cancelled = allTasks.filter(
    t => t.status === 'cancelled' &&
      new Date(t.updatedAt).toISOString().split('T')[0] >= start &&
      new Date(t.updatedAt).toISOString().split('T')[0] <= end
  );

  const byPriority: Record<string, number> = {};
  for (const t of completed) {
    const p = t.priority || 'none';
    byPriority[p] = (byPriority[p] || 0) + 1;
  }

  return {
    completed: completed.length,
    created: created.length,
    overdue: overdue.length,
    cancelled: cancelled.length,
    completedTitles: completed.slice(0, 10).map(t => t.title),
    overdueTitles: overdue.slice(0, 5).map(t => t.title),
    byPriority,
  };
}

export function aggregateHabits(start: string, end: string): HabitSummary {
  const activeHabits = db.select().from(habits)
    .where(and(isNull(habits.archivedAt), eq(habits.isPaused, 0)))
    .all();

  const completions = db.select().from(habitCompletions)
    .where(
      and(
        gte(habitCompletions.completedDate, start),
        lte(habitCompletions.completedDate, end)
      )
    )
    .all();

  const days = daysBetween(start, end);

  const byHabit = activeHabits.map(h => {
    const hCompletions = completions.filter(c => c.habitId === h.id);
    // For daily habits, possible = days. For weekly, possible = 1 per week.
    const possible = h.cadence === 'daily' ? days : Math.ceil(days / 7);
    const rate = possible > 0 ? Math.round((hCompletions.length / possible) * 100) : 0;
    return {
      name: h.name,
      completions: hCompletions.length,
      possible,
      rate: Math.min(rate, 100),
      currentStreak: h.currentStreak ?? 0,
    };
  });

  const totalCompletions = completions.length;
  const possibleCompletions = byHabit.reduce((sum, h) => sum + h.possible, 0);
  const completionRate = possibleCompletions > 0
    ? Math.round((totalCompletions / possibleCompletions) * 100)
    : 0;

  const bestStreaks = byHabit
    .filter(h => h.currentStreak > 0)
    .sort((a, b) => b.currentStreak - a.currentStreak)
    .slice(0, 3)
    .map(h => ({ name: h.name, streak: h.currentStreak }));

  return {
    totalActive: activeHabits.length,
    totalCompletions,
    possibleCompletions,
    completionRate: Math.min(completionRate, 100),
    byHabit,
    bestStreaks,
  };
}

export function aggregateMetrics(start: string, end: string): MetricSummary {
  const metrics = db.select().from(metricLogs)
    .where(
      and(
        gte(metricLogs.loggedDate, start),
        lte(metricLogs.loggedDate, end)
      )
    )
    .orderBy(metricLogs.loggedDate)
    .all();

  const sleep = metrics.filter(m => m.metricType === 'sleep' && m.valueNumeric != null);
  const mood = metrics.filter(m => m.metricType === 'mood' && m.valueNumeric != null);
  const energy = metrics.filter(m => m.metricType === 'energy' && m.valueNumeric != null);
  const workouts = metrics.filter(m => m.metricType === 'workout');
  const expenses = metrics.filter(m => m.metricType === 'expense' && m.valueNumeric != null);

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return {
    sleepAvg: avg(sleep.map(m => m.valueNumeric!)),
    sleepCount: sleep.length,
    moodAvg: avg(mood.map(m => m.valueNumeric!)),
    moodCount: mood.length,
    energyAvg: avg(energy.map(m => m.valueNumeric!)),
    energyCount: energy.length,
    workoutCount: workouts.length,
    workoutMinutes: workouts.reduce((sum, m) => sum + (m.valueNumeric || 0), 0),
    expenseTotal: Math.round(expenses.reduce((sum, m) => sum + (m.valueNumeric || 0), 0) * 100) / 100,
    expenseCount: expenses.length,
    moodTrend: computeTrend(mood.map(m => m.valueNumeric!)),
    energyTrend: computeTrend(energy.map(m => m.valueNumeric!)),
  };
}

export function aggregateJournal(start: string, end: string): JournalSummary {
  const entries = db.select().from(journalEntries)
    .where(
      and(
        isNull(journalEntries.archivedAt),
        gte(journalEntries.entryDate, start),
        lte(journalEntries.entryDate, end)
      )
    )
    .orderBy(desc(journalEntries.entryDate))
    .all();

  const totalWords = entries.reduce((sum, e) => sum + (e.wordCount ?? 0), 0);

  // Highlights: entries with mood >= 7 or long body, up to 3
  const highlights = entries
    .filter(e => (e.mood && e.mood >= 7) || (e.wordCount && e.wordCount > 100))
    .slice(0, 3)
    .map(e => ({
      id: e.id,
      title: e.title,
      date: e.entryDate,
      snippet: (e.body || '').slice(0, 120).replace(/\n/g, ' ').trim() + (e.body && e.body.length > 120 ? '...' : ''),
      mood: e.mood,
    }));

  return {
    entryCount: entries.length,
    totalWords,
    highlights,
  };
}

export function aggregateProjects(start: string, end: string): ProjectSummary {
  const allProjects = db.select().from(projects)
    .where(isNull(projects.archivedAt))
    .all();

  const active = allProjects.filter(p => p.status === 'active' || p.status === 'planning');

  // Projects with activity in this period (updated during the period)
  const progressed = allProjects
    .filter(p => {
      const updatedDate = new Date(p.updatedAt).toISOString().split('T')[0];
      return updatedDate >= start && updatedDate <= end;
    })
    .map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      progress: p.progress,
      health: p.health,
    }));

  return {
    activeCount: active.length,
    progressed,
  };
}

export function aggregateGoals(start: string, end: string): GoalSummary {
  const activeGoals = db.select().from(goals)
    .where(and(isNull(goals.archivedAt), eq(goals.status, 'active')))
    .all();

  return {
    activeCount: activeGoals.length,
    goals: activeGoals.map(g => ({
      id: g.id,
      title: g.title,
      progress: g.progress,
      status: g.status,
    })),
  };
}

export function aggregateIdeas(start: string, end: string): IdeasSummary {
  const newIdeas = db.select().from(ideas)
    .where(isNull(ideas.archivedAt))
    .all()
    .filter(i => {
      const created = new Date(i.createdAt).toISOString().split('T')[0];
      return created >= start && created <= end;
    });

  return {
    capturedCount: newIdeas.length,
    titles: newIdeas.map(i => i.title),
  };
}

// ============================================================
// Insight Generators — deterministic rules
// ============================================================

export function deriveWins(snapshot: Omit<ReviewSnapshot, 'wins' | 'blockers' | 'focusAreas'>): string[] {
  const wins: string[] = [];

  if (snapshot.tasks.completed > 0) {
    wins.push(`Completed ${snapshot.tasks.completed} task${snapshot.tasks.completed !== 1 ? 's' : ''}`);
  }
  if (snapshot.tasks.byPriority['p1'] && snapshot.tasks.byPriority['p1'] > 0) {
    wins.push(`Knocked out ${snapshot.tasks.byPriority['p1']} urgent task${snapshot.tasks.byPriority['p1'] !== 1 ? 's' : ''}`);
  }
  if (snapshot.habits.completionRate >= 70) {
    wins.push(`Habit consistency at ${snapshot.habits.completionRate}%`);
  }
  for (const s of snapshot.habits.bestStreaks) {
    if (s.streak >= 7) {
      wins.push(`${s.name} streak: ${s.streak} days`);
    }
  }
  if (snapshot.metrics.moodTrend === 'up') {
    wins.push('Mood trending upward');
  }
  if (snapshot.metrics.energyTrend === 'up') {
    wins.push('Energy trending upward');
  }
  if (snapshot.metrics.workoutCount >= 3) {
    wins.push(`${snapshot.metrics.workoutCount} workouts logged`);
  }
  if (snapshot.journal.entryCount >= 3) {
    wins.push(`${snapshot.journal.entryCount} journal entries — strong reflection`);
  }
  if (snapshot.ideas.capturedCount > 0) {
    wins.push(`${snapshot.ideas.capturedCount} new idea${snapshot.ideas.capturedCount !== 1 ? 's' : ''} captured`);
  }

  return wins.length > 0 ? wins : ['Keep going — every week builds momentum'];
}

export function deriveBlockers(snapshot: Omit<ReviewSnapshot, 'wins' | 'blockers' | 'focusAreas'>): string[] {
  const blockers: string[] = [];

  if (snapshot.tasks.overdue > 0) {
    blockers.push(`${snapshot.tasks.overdue} task${snapshot.tasks.overdue !== 1 ? 's' : ''} overdue`);
  }
  if (snapshot.habits.completionRate < 50 && snapshot.habits.totalActive > 0) {
    blockers.push(`Habit completion at ${snapshot.habits.completionRate}% — below target`);
  }
  if (snapshot.metrics.moodTrend === 'down') {
    blockers.push('Mood trending downward');
  }
  if (snapshot.metrics.energyTrend === 'down') {
    blockers.push('Energy trending downward');
  }
  if (snapshot.metrics.sleepAvg !== null && snapshot.metrics.sleepAvg < 6) {
    blockers.push(`Average sleep: ${snapshot.metrics.sleepAvg}h — consider prioritizing rest`);
  }
  for (const p of snapshot.projects.progressed) {
    if (p.health === 'at_risk' || p.health === 'off_track') {
      blockers.push(`Project "${p.title}" is ${p.health?.replace('_', ' ')}`);
    }
  }

  return blockers;
}

export function deriveFocusAreas(snapshot: Omit<ReviewSnapshot, 'wins' | 'blockers' | 'focusAreas'>): string[] {
  const focus: string[] = [];

  if (snapshot.tasks.overdue > 0) {
    focus.push('Clear overdue tasks');
  }

  const weakHabits = snapshot.habits.byHabit.filter(h => h.rate < 50 && h.possible > 0);
  if (weakHabits.length > 0) {
    const names = weakHabits.slice(0, 2).map(h => h.name).join(', ');
    focus.push(`Strengthen consistency: ${names}`);
  }

  if (snapshot.metrics.sleepAvg !== null && snapshot.metrics.sleepAvg < 7) {
    focus.push('Improve sleep quality');
  }

  if (snapshot.metrics.workoutCount < 2) {
    focus.push('Aim for at least 2–3 workouts');
  }

  if (snapshot.journal.entryCount < 2) {
    focus.push('Write more journal entries for reflection');
  }

  if (focus.length === 0) {
    focus.push('Maintain your current momentum');
  }

  return focus.slice(0, 4);
}

// ============================================================
// Full Snapshot Builder
// ============================================================

export function buildReviewSnapshot(start: string, end: string): ReviewSnapshot {
  const taskData = aggregateTasks(start, end);
  const habitData = aggregateHabits(start, end);
  const metricData = aggregateMetrics(start, end);
  const journalData = aggregateJournal(start, end);
  const projectData = aggregateProjects(start, end);
  const goalData = aggregateGoals(start, end);
  const ideaData = aggregateIdeas(start, end);

  const partial = {
    periodStart: start,
    periodEnd: end,
    generatedAt: Date.now(),
    tasks: taskData,
    habits: habitData,
    metrics: metricData,
    journal: journalData,
    projects: projectData,
    goals: goalData,
    ideas: ideaData,
  };

  return {
    ...partial,
    wins: deriveWins(partial),
    blockers: deriveBlockers(partial),
    focusAreas: deriveFocusAreas(partial),
  };
}

export function buildWeeklySnapshot(start: string, end: string): WeeklySnapshot {
  return buildReviewSnapshot(start, end);
}
