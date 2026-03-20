import { db } from '../db';
import { notes } from '../db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { newId, now } from '@/lib/utils';
import { removeSearchDocument, syncSearchDocument } from './search';

export interface CreateNoteInput {
  title: string;
  body?: string;
  noteType?: string;
  collection?: string;
}

export interface UpdateNoteInput extends Partial<CreateNoteInput> {
  id: string;
}

/** Create a new note */
export function createNote(input: CreateNoteInput) {
  const id = newId();
  const timestamp = now();

  db.insert(notes).values({
    id,
    title: input.title,
    body: input.body ?? null,
    noteType: (input.noteType as 'note' | 'reference' | 'meeting' | 'snippet' | 'evergreen') ?? 'note',
    collection: input.collection ?? null,
    isPinned: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  syncSearchDocument({
    itemId: id,
    itemType: 'note',
    title: input.title,
    body: input.body ?? '',
  });

  return getNote(id);
}

/** Get a single note */
export function getNote(id: string) {
  return db.select().from(notes).where(eq(notes.id, id)).get();
}

/** Update a note */
export function updateNote(input: UpdateNoteInput) {
  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) updates.body = input.body;
  if (input.noteType !== undefined) updates.noteType = input.noteType;
  if (input.collection !== undefined) updates.collection = input.collection;

  db.update(notes).set(updates).where(eq(notes.id, input.id)).run();
  const note = getNote(input.id);
  if (note && !note.archivedAt) {
    syncSearchDocument({
      itemId: note.id,
      itemType: 'note',
      title: note.title,
      body: note.body ?? '',
    });
  }
  return note;
}

/** Get all notes */
export function getAllNotes(limit = 100) {
  return db
    .select()
    .from(notes)
    .where(isNull(notes.archivedAt))
    .orderBy(desc(notes.updatedAt))
    .limit(limit)
    .all();
}

/** Archive a note */
export function archiveNote(id: string) {
  db.update(notes)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(notes.id, id))
    .run();
  removeSearchDocument(id, 'note');
}
