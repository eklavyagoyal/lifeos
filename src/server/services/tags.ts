import { db } from '../db';
import { tags, itemTags } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { newId, now } from '@/lib/utils';
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

/** Create a tag */
export function createTag(name: string, color?: string) {
  const existing = db.select().from(tags).where(eq(tags.name, name.toLowerCase().trim())).get();
  if (existing) return existing;

  const id = newId();
  db.insert(tags).values({
    id,
    name: name.toLowerCase().trim(),
    color: color ?? null,
    createdAt: now(),
  }).run();

  return db.select().from(tags).where(eq(tags.id, id)).get()!;
}

/** Get or create a tag by name */
export function getOrCreateTag(name: string, color?: string) {
  return createTag(name, color);
}

/** Get all tags */
export function getAllTags() {
  return db
    .select()
    .from(tags)
    .orderBy(tags.name)
    .all();
}

/** Get a tag by ID */
export function getTag(id: string) {
  return db.select().from(tags).where(eq(tags.id, id)).get();
}

/** Add a tag to an item */
export function addTagToItem(itemType: string, itemId: string, tagId: string) {
  // Check for duplicate
  const existing = db
    .select()
    .from(itemTags)
    .where(
      and(
        eq(itemTags.itemType, itemType),
        eq(itemTags.itemId, itemId),
        eq(itemTags.tagId, tagId)
      )
    )
    .get();

  if (existing) return existing;

  const id = newId();
  db.insert(itemTags).values({
    id,
    itemType,
    itemId,
    tagId,
    createdAt: now(),
  }).run();

  if (SEARCHABLE_ITEM_TYPES.has(itemType as SearchIndexItemType)) {
    reindexSearchItem(itemType as SearchIndexItemType, itemId);
  }

  return db.select().from(itemTags).where(eq(itemTags.id, id)).get()!;
}

/** Remove a tag from an item */
export function removeTagFromItem(itemType: string, itemId: string, tagId: string) {
  db.delete(itemTags)
    .where(
      and(
        eq(itemTags.itemType, itemType),
        eq(itemTags.itemId, itemId),
        eq(itemTags.tagId, tagId)
      )
    )
    .run();

  if (SEARCHABLE_ITEM_TYPES.has(itemType as SearchIndexItemType)) {
    reindexSearchItem(itemType as SearchIndexItemType, itemId);
  }
}

/** Get all tags for an item */
export function getTagsForItem(itemType: string, itemId: string) {
  const itemTagRows = db
    .select()
    .from(itemTags)
    .where(and(eq(itemTags.itemType, itemType), eq(itemTags.itemId, itemId)))
    .orderBy(desc(itemTags.createdAt))
    .all();

  // Resolve tag details
  return itemTagRows.map(it => {
    const tag = db.select().from(tags).where(eq(tags.id, it.tagId)).get();
    return tag ? { ...tag, itemTagId: it.id } : null;
  }).filter(Boolean) as (typeof tags.$inferSelect & { itemTagId: string })[];
}

/** Get all items with a specific tag */
export function getItemsByTag(tagId: string) {
  return db
    .select()
    .from(itemTags)
    .where(eq(itemTags.tagId, tagId))
    .all();
}
