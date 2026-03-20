/**
 * lifeOS — Shared Visualization Helpers
 *
 * Resolution layer used by both Graph and Timeline services.
 * Batch-resolves item metadata (title, subtitle, status, date, URL)
 * with one SELECT per ItemType instead of N+1 queries.
 */

import { db, sqlite } from '../db';
import {
  tasks, habits, journalEntries, notes, ideas,
  projects, goals, metricLogs, entities, events, reviews,
} from '../db/schema';
import { inArray } from 'drizzle-orm';
import type { ItemType } from '@/lib/types';
import { toISODate } from '@/lib/utils';

// ----------------------------------------------------------
// Item Metadata — the common shape both graph and timeline need
// ----------------------------------------------------------
export interface ResolvedItem {
  id: string;
  type: ItemType;
  title: string;
  subtitle?: string;
  status?: string;
  date?: string;       // ISO date
  detailUrl: string;
}

// ----------------------------------------------------------
// URL mapping
// ----------------------------------------------------------
const TYPE_URL_PREFIX: Record<ItemType, string> = {
  task: '/tasks',
  habit: '/habits',
  journal: '/journal',
  note: '/notes',
  idea: '/ideas',
  project: '/projects',
  goal: '/goals',
  metric: '/metrics',
  entity: '/people',  // default; overridden by getDetailUrl for learning types
  event: '/events',
  review: '/reviews',
  inbox: '/inbox',
};

const LEARNING_ENTITY_TYPES = new Set(['book', 'article', 'course']);

export function getDetailUrl(type: ItemType, id: string, entitySubType?: string): string {
  if (type === 'entity' && entitySubType && LEARNING_ENTITY_TYPES.has(entitySubType)) {
    return `/learning/${id}`;
  }
  return `${TYPE_URL_PREFIX[type] ?? '/'}/${id}`;
}

// ----------------------------------------------------------
// Icon mapping (emoji, for lightweight rendering)
// ----------------------------------------------------------
const TYPE_ICONS: Record<ItemType, string> = {
  task: '✅',
  habit: '🔁',
  journal: '📓',
  note: '📝',
  idea: '💡',
  project: '📁',
  goal: '🎯',
  metric: '📊',
  entity: '👤',
  event: '📅',
  review: '📋',
  inbox: '📥',
};

export function getItemIcon(type: ItemType): string {
  return TYPE_ICONS[type] ?? '📄';
}

// ----------------------------------------------------------
// Type labels (for UI display)
// ----------------------------------------------------------
const TYPE_LABELS: Record<ItemType, string> = {
  task: 'Task',
  habit: 'Habit',
  journal: 'Journal',
  note: 'Note',
  idea: 'Idea',
  project: 'Project',
  goal: 'Goal',
  metric: 'Metric',
  entity: 'Entity',
  event: 'Event',
  review: 'Review',
  inbox: 'Inbox',
};

export function getTypeLabel(type: ItemType): string {
  return TYPE_LABELS[type] ?? type;
}

// ----------------------------------------------------------
// Graph color palette (CSS color per type)
// ----------------------------------------------------------
export const TYPE_COLORS: Record<ItemType, string> = {
  task: '#3b82f6',     // blue-500
  habit: '#8b5cf6',    // violet-500
  journal: '#f59e0b',  // amber-500
  note: '#10b981',     // emerald-500
  idea: '#eab308',     // yellow-500
  project: '#6366f1',  // indigo-500
  goal: '#ef4444',     // red-500
  metric: '#06b6d4',   // cyan-500
  entity: '#ec4899',   // pink-500
  event: '#f97316',    // orange-500
  review: '#14b8a6',   // teal-500
  inbox: '#6b7280',    // gray-500
};

// ----------------------------------------------------------
// Batch resolve items
// ----------------------------------------------------------
export function resolveItemsBatch(
  items: { type: ItemType; id: string }[]
): Map<string, ResolvedItem> {
  const result = new Map<string, ResolvedItem>();
  if (items.length === 0) return result;

  // Group by type
  const byType = new Map<ItemType, string[]>();
  for (const item of items) {
    const ids = byType.get(item.type) ?? [];
    ids.push(item.id);
    byType.set(item.type, ids);
  }

  // Resolve each type with a single query
  for (const [type, ids] of byType) {
    const uniqueIds = [...new Set(ids)];
    const resolved = resolveByType(type, uniqueIds);
    for (const r of resolved) {
      result.set(`${r.type}:${r.id}`, r);
    }
  }

  return result;
}

function resolveByType(type: ItemType, ids: string[]): ResolvedItem[] {
  if (ids.length === 0) return [];

  switch (type) {
    case 'task':
      return db.select().from(tasks).where(inArray(tasks.id, ids)).all().map(r => ({
        id: r.id, type: 'task' as const,
        title: r.title,
        subtitle: r.priority ? `P${r.priority.replace('p', '')}` : undefined,
        status: r.status,
        date: r.completedAt ? toISODate(r.completedAt) : r.dueDate ?? toISODate(r.createdAt),
        detailUrl: getDetailUrl('task', r.id),
      }));

    case 'habit':
      return db.select().from(habits).where(inArray(habits.id, ids)).all().map(r => ({
        id: r.id, type: 'habit' as const,
        title: r.name,
        subtitle: r.cadence,
        status: r.isPaused ? 'paused' : 'active',
        date: toISODate(r.createdAt),
        detailUrl: getDetailUrl('habit', r.id),
      }));

    case 'journal':
      return db.select().from(journalEntries).where(inArray(journalEntries.id, ids)).all().map(r => ({
        id: r.id, type: 'journal' as const,
        title: r.title ?? `Journal — ${r.entryDate}`,
        subtitle: r.entryType ?? undefined,
        date: r.entryDate,
        detailUrl: getDetailUrl('journal', r.id),
      }));

    case 'note':
      return db.select().from(notes).where(inArray(notes.id, ids)).all().map(r => ({
        id: r.id, type: 'note' as const,
        title: r.title,
        subtitle: r.noteType ?? undefined,
        date: toISODate(r.createdAt),
        detailUrl: getDetailUrl('note', r.id),
      }));

    case 'idea':
      return db.select().from(ideas).where(inArray(ideas.id, ids)).all().map(r => ({
        id: r.id, type: 'idea' as const,
        title: r.title,
        subtitle: r.stage ?? undefined,
        date: toISODate(r.createdAt),
        detailUrl: getDetailUrl('idea', r.id),
      }));

    case 'project':
      return db.select().from(projects).where(inArray(projects.id, ids)).all().map(r => ({
        id: r.id, type: 'project' as const,
        title: r.title,
        subtitle: r.health ?? undefined,
        status: r.status,
        date: r.startDate ?? toISODate(r.createdAt),
        detailUrl: getDetailUrl('project', r.id),
      }));

    case 'goal':
      return db.select().from(goals).where(inArray(goals.id, ids)).all().map(r => ({
        id: r.id, type: 'goal' as const,
        title: r.title,
        subtitle: r.timeHorizon ?? undefined,
        status: r.status,
        date: r.startDate ?? toISODate(r.createdAt),
        detailUrl: getDetailUrl('goal', r.id),
      }));

    case 'metric':
      return db.select().from(metricLogs).where(inArray(metricLogs.id, ids)).all().map(r => ({
        id: r.id, type: 'metric' as const,
        title: `${r.metricType}: ${r.valueNumeric ?? r.valueText ?? ''}`,
        subtitle: r.unit ?? undefined,
        date: r.loggedDate,
        detailUrl: getDetailUrl('metric', r.id),
      }));

    case 'entity':
      return db.select().from(entities).where(inArray(entities.id, ids)).all().map(r => ({
        id: r.id, type: 'entity' as const,
        title: r.title,
        subtitle: r.entityType,
        date: toISODate(r.createdAt),
        detailUrl: getDetailUrl('entity', r.id, r.entityType),
      }));

    case 'event':
      return db.select().from(events).where(inArray(events.id, ids)).all().map(r => ({
        id: r.id, type: 'event' as const,
        title: r.title,
        subtitle: r.eventType ?? undefined,
        date: r.eventDate,
        detailUrl: getDetailUrl('event', r.id),
      }));

    case 'review':
      return db.select().from(reviews).where(inArray(reviews.id, ids)).all().map(r => ({
        id: r.id, type: 'review' as const,
        title: `${r.reviewType[0].toUpperCase()}${r.reviewType.slice(1)} Review`,
        subtitle: `${r.periodStart} → ${r.periodEnd ?? r.periodStart}`,
        date: r.periodEnd ?? r.periodStart,
        detailUrl: getDetailUrl('review', r.id),
      }));

    default:
      return [];
  }
}

// ----------------------------------------------------------
// Resolve a single item (convenience wrapper)
// ----------------------------------------------------------
export function resolveItem(type: ItemType, id: string): ResolvedItem | undefined {
  const batch = resolveItemsBatch([{ type, id }]);
  return batch.get(`${type}:${id}`);
}

// ----------------------------------------------------------
// Get all structural FK edges from the database
// These are implicit graph edges from foreign key relationships
// ----------------------------------------------------------
export interface StructuralEdge {
  sourceType: ItemType;
  sourceId: string;
  targetType: ItemType;
  targetId: string;
  label: string;
}

export function getStructuralEdges(): StructuralEdge[] {
  const edges: StructuralEdge[] = [];

  // Tasks → Projects (via projectId)
  const taskProjectRows = sqlite.prepare(
    `SELECT id, project_id FROM tasks WHERE project_id IS NOT NULL AND archived_at IS NULL`
  ).all() as { id: string; project_id: string }[];
  for (const row of taskProjectRows) {
    edges.push({
      sourceType: 'task', sourceId: row.id,
      targetType: 'project', targetId: row.project_id,
      label: 'belongs to',
    });
  }

  // Tasks → Parent Tasks (via parentTaskId)
  const taskParentRows = sqlite.prepare(
    `SELECT id, parent_task_id FROM tasks WHERE parent_task_id IS NOT NULL AND archived_at IS NULL`
  ).all() as { id: string; parent_task_id: string }[];
  for (const row of taskParentRows) {
    edges.push({
      sourceType: 'task', sourceId: row.id,
      targetType: 'task', targetId: row.parent_task_id,
      label: 'subtask of',
    });
  }

  // Tasks → Goals (via goalId)
  const taskGoalRows = sqlite.prepare(
    `SELECT id, goal_id FROM tasks WHERE goal_id IS NOT NULL AND archived_at IS NULL`
  ).all() as { id: string; goal_id: string }[];
  for (const row of taskGoalRows) {
    edges.push({
      sourceType: 'task', sourceId: row.id,
      targetType: 'goal', targetId: row.goal_id,
      label: 'supports',
    });
  }

  // Habits → Goals (via goalId)
  const habitGoalRows = sqlite.prepare(
    `SELECT id, goal_id FROM habits WHERE goal_id IS NOT NULL AND archived_at IS NULL`
  ).all() as { id: string; goal_id: string }[];
  for (const row of habitGoalRows) {
    edges.push({
      sourceType: 'habit', sourceId: row.id,
      targetType: 'goal', targetId: row.goal_id,
      label: 'supports',
    });
  }

  // Habits → Projects (via projectId)
  const habitProjectRows = sqlite.prepare(
    `SELECT id, project_id FROM habits WHERE project_id IS NOT NULL AND archived_at IS NULL`
  ).all() as { id: string; project_id: string }[];
  for (const row of habitProjectRows) {
    edges.push({
      sourceType: 'habit', sourceId: row.id,
      targetType: 'project', targetId: row.project_id,
      label: 'belongs to',
    });
  }

  // Projects → Goals (via goalId)
  const projectGoalRows = sqlite.prepare(
    `SELECT id, goal_id FROM projects WHERE goal_id IS NOT NULL AND archived_at IS NULL`
  ).all() as { id: string; goal_id: string }[];
  for (const row of projectGoalRows) {
    edges.push({
      sourceType: 'project', sourceId: row.id,
      targetType: 'goal', targetId: row.goal_id,
      label: 'advances',
    });
  }

  // MetricLogs → JournalEntries (via journalId)
  const metricJournalRows = sqlite.prepare(
    `SELECT id, journal_id FROM metric_logs WHERE journal_id IS NOT NULL`
  ).all() as { id: string; journal_id: string }[];
  for (const row of metricJournalRows) {
    edges.push({
      sourceType: 'metric', sourceId: row.id,
      targetType: 'journal', targetId: row.journal_id,
      label: 'logged with',
    });
  }

  // MetricLogs → Habits (via habitId)
  const metricHabitRows = sqlite.prepare(
    `SELECT id, habit_id FROM metric_logs WHERE habit_id IS NOT NULL`
  ).all() as { id: string; habit_id: string }[];
  for (const row of metricHabitRows) {
    edges.push({
      sourceType: 'metric', sourceId: row.id,
      targetType: 'habit', targetId: row.habit_id,
      label: 'tracked by',
    });
  }

  return edges;
}

// ----------------------------------------------------------
// Get tag-shared edges (items sharing a tag are connected)
// ----------------------------------------------------------
export function getTagSharedEdges(): StructuralEdge[] {
  const rows = sqlite.prepare(`
    SELECT
      a.item_type AS a_type, a.item_id AS a_id,
      b.item_type AS b_type, b.item_id AS b_id,
      t.name AS tag_name
    FROM item_tags a
    JOIN item_tags b ON a.tag_id = b.tag_id
      AND (a.item_type || ':' || a.item_id) < (b.item_type || ':' || b.item_id)
    JOIN tags t ON t.id = a.tag_id
    LIMIT 500
  `).all() as { a_type: string; a_id: string; b_type: string; b_id: string; tag_name: string }[];

  return rows.map(r => ({
    sourceType: r.a_type as ItemType,
    sourceId: r.a_id,
    targetType: r.b_type as ItemType,
    targetId: r.b_id,
    label: `#${r.tag_name}`,
  }));
}
