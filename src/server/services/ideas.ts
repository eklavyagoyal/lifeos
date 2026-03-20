import { db } from '../db';
import { ideas } from '../db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { newId, now } from '@/lib/utils';
import { removeSearchDocument, syncSearchDocument } from './search';

// ============================================================
// Ideas Service — Stage-driven idea pipeline
// ============================================================

export type IdeaStage = 'seed' | 'developing' | 'mature' | 'archived' | 'implemented';

export interface CreateIdeaInput {
  title: string;
  summary?: string;
  body?: string;
  stage?: IdeaStage;
  theme?: string;
}

export interface UpdateIdeaInput extends Partial<CreateIdeaInput> {
  id: string;
}

/** Create a new idea */
export function createIdea(input: CreateIdeaInput) {
  const id = newId();
  const timestamp = now();

  db.insert(ideas).values({
    id,
    title: input.title,
    summary: input.summary ?? null,
    body: input.body ?? null,
    stage: (input.stage as IdeaStage) ?? 'seed',
    theme: input.theme ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  syncSearchDocument({
    itemId: id,
    itemType: 'idea',
    title: input.title,
    body: [input.summary, input.body].filter(Boolean).join(' '),
  });

  return getIdea(id);
}

/** Get a single idea */
export function getIdea(id: string) {
  return db.select().from(ideas).where(eq(ideas.id, id)).get();
}

/** Update an idea */
export function updateIdea(input: UpdateIdeaInput) {
  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.summary !== undefined) updates.summary = input.summary;
  if (input.body !== undefined) updates.body = input.body;
  if (input.stage !== undefined) updates.stage = input.stage;
  if (input.theme !== undefined) updates.theme = input.theme;

  db.update(ideas).set(updates).where(eq(ideas.id, input.id)).run();
  const idea = getIdea(input.id);
  if (idea && !idea.archivedAt) {
    syncSearchDocument({
      itemId: idea.id,
      itemType: 'idea',
      title: idea.title,
      body: [idea.summary, idea.body].filter(Boolean).join(' '),
    });
  }
  return idea;
}

/** Get all ideas (not archived) */
export function getAllIdeas(limit = 200) {
  return db
    .select()
    .from(ideas)
    .where(isNull(ideas.archivedAt))
    .orderBy(desc(ideas.updatedAt))
    .limit(limit)
    .all();
}

/** Get ideas filtered by stage */
export function getIdeasByStage(stage: IdeaStage, limit = 100) {
  return db
    .select()
    .from(ideas)
    .where(and(eq(ideas.stage, stage), isNull(ideas.archivedAt)))
    .orderBy(desc(ideas.updatedAt))
    .limit(limit)
    .all();
}

/** Archive an idea */
export function archiveIdea(id: string) {
  db.update(ideas)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(ideas.id, id))
    .run();
  removeSearchDocument(id, 'idea');
}
