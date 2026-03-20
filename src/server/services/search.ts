import { and, eq, isNull, or } from 'drizzle-orm';
import { db, sqlite } from '../db';
import {
  entities,
  events,
  goals,
  habits,
  ideas,
  itemTags,
  journalEntries,
  metricLogs,
  milestones,
  notes,
  projects,
  relations as relationsTable,
  reviews,
  tags,
  tasks,
} from '../db/schema';
import type { ItemType, SearchResultItem, SearchableItemType } from '@/lib/types';
import { getAttachmentSearchContextForItem, getAttachmentSummariesForItems } from './attachment-queries';
import { resolveItemsBatch } from './graph-helpers';

export type SearchIndexItemType = SearchableItemType;

export interface SearchDocumentInput {
  itemId: string;
  itemType: SearchIndexItemType;
  title: string;
  body?: string | null;
}

export type SearchResult = SearchResultItem;

function isNonNullable<T>(value: T | null): value is T {
  return value !== null;
}

function joinSearchParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

// ============================================================
// FTS5 Search Index — Single virtual table for all searchable types
// ============================================================

export function ensureSearchIndex() {
  const existing = sqlite.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'search_index'
  `).get() as { sql?: string } | undefined;

  if (existing?.sql && (existing.sql.includes("content=''") || existing.sql.includes('contentless_delete=1'))) {
    sqlite.exec(`DROP TABLE IF EXISTS search_index;`);
  }

  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      item_id UNINDEXED,
      item_type UNINDEXED,
      title,
      body,
      tokenize='porter unicode61'
    );
  `);
}

function getSearchIndexCount(): number {
  ensureSearchIndex();
  const row = sqlite.prepare('SELECT COUNT(*) AS count FROM search_index').get() as { count: number };
  return row.count;
}

function getTagSearchContext(itemType: SearchIndexItemType, itemId: string): string {
  const tagRows = db.select({
    name: tags.name,
  })
    .from(itemTags)
    .innerJoin(tags, eq(itemTags.tagId, tags.id))
    .where(and(eq(itemTags.itemType, itemType), eq(itemTags.itemId, itemId)))
    .all();

  if (tagRows.length === 0) return '';
  return tagRows.map((tagRow) => `#${tagRow.name}`).join(' ');
}

function getRelationSearchContext(itemType: SearchIndexItemType, itemId: string): string {
  const relations = db.select().from(relationsTable)
    .where(
      or(
        and(eq(relationsTable.sourceType, itemType), eq(relationsTable.sourceId, itemId)),
        and(eq(relationsTable.targetType, itemType), eq(relationsTable.targetId, itemId))
      )
    )
    .all();

  if (relations.length === 0) return '';

  const otherItems = relations.map((relation) => {
    const isSource = relation.sourceType === itemType && relation.sourceId === itemId;
    return {
      type: (isSource ? relation.targetType : relation.sourceType) as ItemType,
      id: isSource ? relation.targetId : relation.sourceId,
      relationType: relation.relationType.replaceAll('_', ' '),
    };
  });

  const resolved = resolveItemsBatch(otherItems.map(({ type, id }) => ({ type, id })));

  return otherItems
    .map(({ type, id, relationType }) => {
      const related = resolved.get(`${type}:${id}`);
      if (!related) return relationType;
      return joinSearchParts([relationType, related.title, related.subtitle, related.type]);
    })
    .join(' ');
}

function getGoalMilestoneSearchContext(goalId: string): string {
  const goalMilestones = db.select().from(milestones)
    .where(and(eq(milestones.goalId, goalId), isNull(milestones.archivedAt)))
    .all();

  if (goalMilestones.length === 0) return '';

  return goalMilestones
    .map((milestone) => joinSearchParts([milestone.title, milestone.body]))
    .join(' ');
}

function buildIndexedBody(document: SearchDocumentInput): string {
  const baseBody = document.body?.trim() || '';
  const tagContext = getTagSearchContext(document.itemType, document.itemId);
  const relationContext = getRelationSearchContext(document.itemType, document.itemId);
  const milestoneContext = document.itemType === 'goal'
    ? getGoalMilestoneSearchContext(document.itemId)
    : '';
  const attachmentContext = getAttachmentSearchContextForItem(document.itemType, document.itemId);

  return joinSearchParts([baseBody, tagContext, relationContext, milestoneContext, attachmentContext]);
}

function insertSearchDocument(document: SearchDocumentInput) {
  const title = document.title.trim();
  const body = buildIndexedBody(document);

  if (!title && !body) return;

  sqlite.prepare(
    `INSERT INTO search_index(item_id, item_type, title, body) VALUES (?, ?, ?, ?)`
  ).run(document.itemId, document.itemType, title, body);
}

export function syncSearchDocument(document: SearchDocumentInput) {
  ensureSearchIndex();

  sqlite.prepare(
    `DELETE FROM search_index WHERE item_id = ? AND item_type = ?`
  ).run(document.itemId, document.itemType);

  insertSearchDocument(document);
}

export function removeSearchDocument(itemId: string, itemType: SearchIndexItemType) {
  ensureSearchIndex();
  sqlite.prepare(
    `DELETE FROM search_index WHERE item_id = ? AND item_type = ?`
  ).run(itemId, itemType);
}

function getSearchDocument(itemType: SearchIndexItemType, itemId: string): SearchDocumentInput | null {
  switch (itemType) {
    case 'task': {
      const task = db.select().from(tasks).where(eq(tasks.id, itemId)).get();
      if (!task || task.archivedAt) return null;
      return {
        itemId: task.id,
        itemType: 'task',
        title: task.title,
        body: joinSearchParts([task.body, task.priority, task.context, task.status]),
      };
    }
    case 'habit': {
      const habit = db.select().from(habits).where(eq(habits.id, itemId)).get();
      if (!habit || habit.archivedAt) return null;
      return {
        itemId: habit.id,
        itemType: 'habit',
        title: habit.name,
        body: joinSearchParts([habit.description, habit.body, habit.domain, habit.cadence, habit.difficulty]),
      };
    }
    case 'journal': {
      const journal = db.select().from(journalEntries).where(eq(journalEntries.id, itemId)).get();
      if (!journal || journal.archivedAt) return null;
      return {
        itemId: journal.id,
        itemType: 'journal',
        title: journal.title || journal.entryDate,
        body: joinSearchParts([journal.body, journal.entryType, journal.entryDate]),
      };
    }
    case 'note': {
      const note = db.select().from(notes).where(eq(notes.id, itemId)).get();
      if (!note || note.archivedAt) return null;
      return {
        itemId: note.id,
        itemType: 'note',
        title: note.title,
        body: joinSearchParts([note.body, note.noteType]),
      };
    }
    case 'idea': {
      const idea = db.select().from(ideas).where(eq(ideas.id, itemId)).get();
      if (!idea || idea.archivedAt) return null;
      return {
        itemId: idea.id,
        itemType: 'idea',
        title: idea.title,
        body: joinSearchParts([idea.summary, idea.body, idea.stage, idea.theme]),
      };
    }
    case 'project': {
      const project = db.select().from(projects).where(eq(projects.id, itemId)).get();
      if (!project || project.archivedAt) return null;
      return {
        itemId: project.id,
        itemType: 'project',
        title: project.title,
        body: joinSearchParts([
          project.summary,
          project.body,
          project.status,
          project.health,
          project.reviewCadence,
        ]),
      };
    }
    case 'goal': {
      const goal = db.select().from(goals).where(eq(goals.id, itemId)).get();
      if (!goal || goal.archivedAt) return null;
      return {
        itemId: goal.id,
        itemType: 'goal',
        title: goal.title,
        body: joinSearchParts([goal.description, goal.body, goal.timeHorizon, goal.status, goal.outcomeMetric]),
      };
    }
    case 'entity': {
      const entity = db.select().from(entities).where(eq(entities.id, itemId)).get();
      if (!entity || entity.archivedAt) return null;
      return {
        itemId: entity.id,
        itemType: 'entity',
        title: entity.title,
        body: joinSearchParts([entity.entityType, entity.body, entity.metadata]),
      };
    }
    case 'metric': {
      const metric = db.select().from(metricLogs).where(eq(metricLogs.id, itemId)).get();
      if (!metric) return null;
      const primaryValue = metric.valueNumeric !== null && metric.valueNumeric !== undefined
        ? String(metric.valueNumeric)
        : metric.valueText;
      return {
        itemId: metric.id,
        itemType: 'metric',
        title: joinSearchParts([metric.metricType, primaryValue || 'entry']),
        body: joinSearchParts([metric.unit, metric.note, metric.loggedDate]),
      };
    }
    case 'event': {
      const event = db.select().from(events).where(eq(events.id, itemId)).get();
      if (!event || event.archivedAt) return null;
      return {
        itemId: event.id,
        itemType: 'event',
        title: event.title,
        body: joinSearchParts([
          event.body,
          event.eventType,
          event.eventDate,
          event.eventEndDate,
          `importance ${event.importance ?? 3}`,
        ]),
      };
    }
    case 'review': {
      const review = db.select().from(reviews).where(eq(reviews.id, itemId)).get();
      if (!review) return null;
      return {
        itemId: review.id,
        itemType: 'review',
        title: `${review.reviewType[0].toUpperCase()}${review.reviewType.slice(1)} Review`,
        body: joinSearchParts([
          review.body,
          review.reviewType,
          review.periodStart,
          review.periodEnd,
          review.statsSnapshot,
        ]),
      };
    }
  }
}

export function reindexSearchItem(itemType: SearchIndexItemType, itemId: string) {
  const document = getSearchDocument(itemType, itemId);
  if (!document) {
    removeSearchDocument(itemId, itemType);
    return;
  }

  syncSearchDocument(document);
}

export function reindexSearchItems(items: Array<{ itemType: SearchIndexItemType; itemId: string }>) {
  for (const item of items) {
    reindexSearchItem(item.itemType, item.itemId);
  }
}

// ============================================================
// Full rebuild
// ============================================================

export function rebuildSearchIndex() {
  ensureSearchIndex();
  sqlite.exec(`DELETE FROM search_index;`);

  const allDocuments: SearchDocumentInput[] = [];

  for (const task of db.select().from(tasks).where(isNull(tasks.archivedAt)).all()) {
    allDocuments.push({
      itemId: task.id,
      itemType: 'task',
      title: task.title,
      body: joinSearchParts([task.body, task.priority, task.context, task.status]),
    });
  }

  for (const habit of db.select().from(habits).where(isNull(habits.archivedAt)).all()) {
    allDocuments.push({
      itemId: habit.id,
      itemType: 'habit',
      title: habit.name,
      body: joinSearchParts([habit.description, habit.body, habit.domain, habit.cadence, habit.difficulty]),
    });
  }

  for (const journal of db.select().from(journalEntries).where(isNull(journalEntries.archivedAt)).all()) {
    allDocuments.push({
      itemId: journal.id,
      itemType: 'journal',
      title: journal.title || journal.entryDate,
      body: joinSearchParts([journal.body, journal.entryType, journal.entryDate]),
    });
  }

  for (const note of db.select().from(notes).where(isNull(notes.archivedAt)).all()) {
    allDocuments.push({
      itemId: note.id,
      itemType: 'note',
      title: note.title,
      body: joinSearchParts([note.body, note.noteType]),
    });
  }

  for (const idea of db.select().from(ideas).where(isNull(ideas.archivedAt)).all()) {
    allDocuments.push({
      itemId: idea.id,
      itemType: 'idea',
      title: idea.title,
      body: joinSearchParts([idea.summary, idea.body, idea.stage, idea.theme]),
    });
  }

  for (const project of db.select().from(projects).where(isNull(projects.archivedAt)).all()) {
    allDocuments.push({
      itemId: project.id,
      itemType: 'project',
      title: project.title,
      body: joinSearchParts([
        project.summary,
        project.body,
        project.status,
        project.health,
        project.reviewCadence,
      ]),
    });
  }

  for (const goal of db.select().from(goals).where(isNull(goals.archivedAt)).all()) {
    allDocuments.push({
      itemId: goal.id,
      itemType: 'goal',
      title: goal.title,
      body: joinSearchParts([goal.description, goal.body, goal.timeHorizon, goal.status, goal.outcomeMetric]),
    });
  }

  for (const entity of db.select().from(entities).where(isNull(entities.archivedAt)).all()) {
    allDocuments.push({
      itemId: entity.id,
      itemType: 'entity',
      title: entity.title,
      body: joinSearchParts([entity.entityType, entity.body, entity.metadata]),
    });
  }

  for (const metric of db.select().from(metricLogs).all()) {
    const primaryValue = metric.valueNumeric !== null && metric.valueNumeric !== undefined
      ? String(metric.valueNumeric)
      : metric.valueText;
    allDocuments.push({
      itemId: metric.id,
      itemType: 'metric',
      title: joinSearchParts([metric.metricType, primaryValue || 'entry']),
      body: joinSearchParts([metric.unit, metric.note, metric.loggedDate]),
    });
  }

  for (const event of db.select().from(events).where(isNull(events.archivedAt)).all()) {
    allDocuments.push({
      itemId: event.id,
      itemType: 'event',
      title: event.title,
      body: joinSearchParts([
        event.body,
        event.eventType,
        event.eventDate,
        event.eventEndDate,
        `importance ${event.importance ?? 3}`,
      ]),
    });
  }

  for (const review of db.select().from(reviews).all()) {
    allDocuments.push({
      itemId: review.id,
      itemType: 'review',
      title: `${review.reviewType[0].toUpperCase()}${review.reviewType.slice(1)} Review`,
      body: joinSearchParts([review.body, review.reviewType, review.periodStart, review.periodEnd, review.statsSnapshot]),
    });
  }

  const insertAll = sqlite.transaction(() => {
    for (const document of allDocuments) {
      insertSearchDocument(document);
    }
  });

  insertAll();
}

// ============================================================
// Query
// ============================================================

export function searchItems(query: string, typeFilter?: ItemType, limit = 50): SearchResult[] {
  if (!query.trim()) return [];

  ensureSearchIndex();

  const sanitized = query
    .replace(/['"(){}[\]^~*:]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word}"*`)
    .join(' ');

  if (!sanitized) return [];

  let sql = `
    SELECT
      item_id,
      item_type,
      title,
      snippet(search_index, 3, '<mark>', '</mark>', '...', 48) as snippet,
      rank
    FROM search_index
    WHERE search_index MATCH ?
      AND item_id IS NOT NULL
  `;

  const params: (string | number)[] = [sanitized];

  if (typeFilter) {
    sql += ` AND item_type = ?`;
    params.push(typeFilter);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);

  try {
    const rows = sqlite.prepare(sql).all(...params) as Array<{
      item_id: string;
      item_type: SearchIndexItemType;
      title: string;
      snippet: string;
      rank: number;
    }>;

    const resolved = resolveItemsBatch(
      rows.map((row) => ({ type: row.item_type as ItemType, id: row.item_id }))
    );
    const attachmentSummaries = getAttachmentSummariesForItems(
      rows.map((row) => ({ type: row.item_type as ItemType, id: row.item_id }))
    );

    return rows
      .map((row) => {
        const item = resolved.get(`${row.item_type}:${row.item_id}`);
        if (!item) return null;
        const key = `${row.item_type}:${row.item_id}`;

        return {
          itemId: row.item_id,
          itemType: row.item_type,
          title: item.title || row.title,
          snippet: row.snippet || '',
          rank: row.rank,
          detailUrl: item.detailUrl,
          subtitle: item.subtitle,
          attachmentCount: attachmentSummaries.counts.get(key) ?? 0,
          attachmentNames: attachmentSummaries.names.get(key) ?? [],
        };
      })
      .filter(isNonNullable);
  } catch {
    return [];
  }
}

export function initializeSearch() {
  ensureSearchIndex();
  if (getSearchIndexCount() === 0) {
    rebuildSearchIndex();
  }
}
