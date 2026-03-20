import { db } from '../db';
import { relations as relationsTable } from '../db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { newId, now } from '@/lib/utils';
import type { ItemType, RelationType } from '@/lib/types';
import { reindexSearchItem, type SearchIndexItemType } from './search';

const SEARCHABLE_ITEM_TYPES = new Set<SearchIndexItemType>([
  'task',
  'habit',
  'journal',
  'note',
  'idea',
  'project',
  'goal',
  'entity',
  'metric',
  'event',
  'review',
]);

export interface CreateRelationInput {
  sourceType: ItemType;
  sourceId: string;
  targetType: ItemType;
  targetId: string;
  relationType: RelationType;
  metadata?: string;
}

/** Create a relation between two items */
export function createRelation(input: CreateRelationInput) {
  const id = newId();

  // Check for duplicate (same source-target pair with same relation type)
  const existing = db
    .select()
    .from(relationsTable)
    .where(
      and(
        eq(relationsTable.sourceType, input.sourceType),
        eq(relationsTable.sourceId, input.sourceId),
        eq(relationsTable.targetType, input.targetType),
        eq(relationsTable.targetId, input.targetId),
        eq(relationsTable.relationType, input.relationType)
      )
    )
    .get();

  if (existing) return existing;

  db.insert(relationsTable).values({
    id,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    targetType: input.targetType,
    targetId: input.targetId,
    relationType: input.relationType,
    metadata: input.metadata ?? null,
    createdAt: now(),
  }).run();

  if (SEARCHABLE_ITEM_TYPES.has(input.sourceType as SearchIndexItemType)) {
    reindexSearchItem(input.sourceType as SearchIndexItemType, input.sourceId);
  }
  if (SEARCHABLE_ITEM_TYPES.has(input.targetType as SearchIndexItemType)) {
    reindexSearchItem(input.targetType as SearchIndexItemType, input.targetId);
  }

  return db.select().from(relationsTable).where(eq(relationsTable.id, id)).get();
}

/** Get all relations where item is source or target */
export function getRelationsForItem(itemType: string, itemId: string) {
  return db
    .select()
    .from(relationsTable)
    .where(
      or(
        and(eq(relationsTable.sourceType, itemType), eq(relationsTable.sourceId, itemId)),
        and(eq(relationsTable.targetType, itemType), eq(relationsTable.targetId, itemId))
      )
    )
    .orderBy(desc(relationsTable.createdAt))
    .all();
}

/** Get relations where item is source */
export function getOutgoingRelations(itemType: string, itemId: string) {
  return db
    .select()
    .from(relationsTable)
    .where(
      and(eq(relationsTable.sourceType, itemType), eq(relationsTable.sourceId, itemId))
    )
    .orderBy(desc(relationsTable.createdAt))
    .all();
}

/** Get relations where item is target */
export function getIncomingRelations(itemType: string, itemId: string) {
  return db
    .select()
    .from(relationsTable)
    .where(
      and(eq(relationsTable.targetType, itemType), eq(relationsTable.targetId, itemId))
    )
    .orderBy(desc(relationsTable.createdAt))
    .all();
}

/** Remove a relation by ID */
export function removeRelation(id: string) {
  const relation = db.select().from(relationsTable).where(eq(relationsTable.id, id)).get();
  db.delete(relationsTable).where(eq(relationsTable.id, id)).run();

  if (!relation) return;

  if (SEARCHABLE_ITEM_TYPES.has(relation.sourceType as SearchIndexItemType)) {
    reindexSearchItem(relation.sourceType as SearchIndexItemType, relation.sourceId);
  }
  if (SEARCHABLE_ITEM_TYPES.has(relation.targetType as SearchIndexItemType)) {
    reindexSearchItem(relation.targetType as SearchIndexItemType, relation.targetId);
  }
}

/** Remove all relations for an item */
export function removeAllRelationsForItem(itemType: string, itemId: string) {
  db.delete(relationsTable)
    .where(
      or(
        and(eq(relationsTable.sourceType, itemType), eq(relationsTable.sourceId, itemId)),
        and(eq(relationsTable.targetType, itemType), eq(relationsTable.targetId, itemId))
      )
    )
    .run();
}
