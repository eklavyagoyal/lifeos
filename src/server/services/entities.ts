import { db } from '../db';
import { entities } from '../db/schema';
import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { newId, now } from '@/lib/utils';
import type { EntityType } from '@/lib/types';
import { removeSearchDocument, syncSearchDocument } from './search';

// ============================================================
// Entities Service — People, Books, Articles, Courses, etc.
// ============================================================

// -- Metadata type shapes for type-specific fields ------------

export interface PersonMetadata {
  relationship?: string;
  company?: string;
  role?: string;
  email?: string;
  phone?: string;
  lastContactDate?: string;
  [key: string]: unknown;
}

export interface BookMetadata {
  author?: string;
  status?: 'to_read' | 'reading' | 'completed' | 'abandoned';
  rating?: number;
  startDate?: string;
  endDate?: string;
  pageCount?: number;
  [key: string]: unknown;
}

export interface ArticleMetadata {
  url?: string;
  source?: string;
  status?: 'to_read' | 'read';
  readDate?: string;
  [key: string]: unknown;
}

export interface CourseMetadata {
  platform?: string;
  instructor?: string;
  status?: 'planned' | 'in_progress' | 'completed' | 'abandoned';
  progress?: number;
  url?: string;
  [key: string]: unknown;
}

export type EntityMetadata = PersonMetadata | BookMetadata | ArticleMetadata | CourseMetadata | Record<string, unknown>;

// -- CRUD interfaces ------------------------------------------

export interface CreateEntityInput {
  title: string;
  entityType: EntityType;
  body?: string;
  metadata?: EntityMetadata;
  isPinned?: boolean;
}

export interface UpdateEntityInput {
  id: string;
  title?: string;
  body?: string;
  metadata?: EntityMetadata;
  isPinned?: boolean;
}

// -- Helpers ---------------------------------------------------

function serializeMetadata(meta?: EntityMetadata): string | null {
  if (!meta) return null;
  return JSON.stringify(meta);
}

function parseMetadata<T = EntityMetadata>(raw: string | null): T {
  if (!raw) return {} as T;
  try { return JSON.parse(raw) as T; } catch { return {} as T; }
}

// -- CRUD functions -------------------------------------------

/** Create a new entity */
export function createEntity(input: CreateEntityInput) {
  const id = newId();
  const timestamp = now();
  const serializedMetadata = serializeMetadata(input.metadata);

  db.insert(entities).values({
    id,
    title: input.title,
    entityType: input.entityType,
    body: input.body ?? null,
    metadata: serializedMetadata,
    isPinned: input.isPinned ? 1 : 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  syncSearchDocument({
    itemId: id,
    itemType: 'entity',
    title: input.title,
    body: [input.entityType, input.body].filter(Boolean).join(' '),
  });

  return getEntity(id);
}

/** Get a single entity */
export function getEntity(id: string) {
  const row = db.select().from(entities).where(eq(entities.id, id)).get();
  if (!row) return undefined;
  return { ...row, parsedMetadata: parseMetadata(row.metadata) };
}

/** Update an entity */
export function updateEntity(input: UpdateEntityInput) {
  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) updates.body = input.body;
  if (input.metadata !== undefined) updates.metadata = serializeMetadata(input.metadata);
  if (input.isPinned !== undefined) updates.isPinned = input.isPinned ? 1 : 0;

  db.update(entities).set(updates).where(eq(entities.id, input.id)).run();
  const entity = getEntity(input.id);
  if (entity && !entity.archivedAt) {
    syncSearchDocument({
      itemId: entity.id,
      itemType: 'entity',
      title: entity.title,
      body: [entity.entityType, entity.body].filter(Boolean).join(' '),
    });
  }
  return entity;
}

/** Get all entities (optionally filtered by type) */
export function getAllEntities(typeFilter?: EntityType | EntityType[], limit = 200) {
  if (typeFilter) {
    const types = Array.isArray(typeFilter) ? typeFilter : [typeFilter];
    return db
      .select()
      .from(entities)
      .where(and(inArray(entities.entityType, types), isNull(entities.archivedAt)))
      .orderBy(desc(entities.updatedAt))
      .limit(limit)
      .all()
      .map(r => ({ ...r, parsedMetadata: parseMetadata(r.metadata) }));
  }

  return db
    .select()
    .from(entities)
    .where(isNull(entities.archivedAt))
    .orderBy(desc(entities.updatedAt))
    .limit(limit)
    .all()
    .map(r => ({ ...r, parsedMetadata: parseMetadata(r.metadata) }));
}

/** Get all people */
export function getAllPeople(limit = 200) {
  return getAllEntities('person', limit);
}

/** Get all learning items (books, articles, courses) */
export function getAllLearningItems(limit = 200) {
  return getAllEntities(['book', 'article', 'course'], limit);
}

/** Archive an entity */
export function archiveEntity(id: string) {
  db.update(entities)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(entities.id, id))
    .run();
  removeSearchDocument(id, 'entity');
}
