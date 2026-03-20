import { db } from '../db';
import { journalEntries } from '../db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { newId, now, todayISO, currentTime, wordCount } from '@/lib/utils';
import { removeSearchDocument, syncSearchDocument } from './search';

export interface CreateJournalInput {
  title?: string;
  body?: string;
  entryDate?: string;
  entryTime?: string;
  entryType?: string;
  mood?: number;
  energy?: number;
}

export interface UpdateJournalInput extends Partial<CreateJournalInput> {
  id: string;
}

/** Create a new journal entry */
export function createJournalEntry(input: CreateJournalInput) {
  const id = newId();
  const timestamp = now();

  db.insert(journalEntries).values({
    id,
    title: input.title ?? null,
    body: input.body ?? null,
    entryDate: input.entryDate ?? todayISO(),
    entryTime: input.entryTime ?? currentTime(),
    entryType: (input.entryType as 'daily' | 'reflection' | 'gratitude' | 'freeform' | 'evening_review') ?? 'freeform',
    mood: input.mood ?? null,
    energy: input.energy ?? null,
    wordCount: input.body ? wordCount(input.body) : 0,
    isPinned: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  syncSearchDocument({
    itemId: id,
    itemType: 'journal',
    title: input.title ?? input.entryDate ?? todayISO(),
    body: input.body ?? '',
  });

  return getJournalEntry(id);
}

/** Get a single journal entry */
export function getJournalEntry(id: string) {
  return db.select().from(journalEntries).where(eq(journalEntries.id, id)).get();
}

/** Update a journal entry */
export function updateJournalEntry(input: UpdateJournalInput) {
  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) {
    updates.body = input.body;
    updates.wordCount = wordCount(input.body || '');
  }
  if (input.entryDate !== undefined) updates.entryDate = input.entryDate;
  if (input.entryTime !== undefined) updates.entryTime = input.entryTime;
  if (input.entryType !== undefined) updates.entryType = input.entryType;
  if (input.mood !== undefined) updates.mood = input.mood;
  if (input.energy !== undefined) updates.energy = input.energy;

  db.update(journalEntries).set(updates).where(eq(journalEntries.id, input.id)).run();
  const entry = getJournalEntry(input.id);
  if (entry && !entry.archivedAt) {
    syncSearchDocument({
      itemId: entry.id,
      itemType: 'journal',
      title: entry.title ?? entry.entryDate,
      body: entry.body ?? '',
    });
  }
  return entry;
}

/** Get all journal entries, newest first */
export function getAllJournalEntries(limit = 50) {
  return db
    .select()
    .from(journalEntries)
    .where(isNull(journalEntries.archivedAt))
    .orderBy(desc(journalEntries.entryDate), desc(journalEntries.entryTime))
    .limit(limit)
    .all();
}

/** Get journal entries for a specific date */
export function getJournalEntriesForDate(date: string) {
  return db
    .select()
    .from(journalEntries)
    .where(
      and(
        isNull(journalEntries.archivedAt),
        eq(journalEntries.entryDate, date)
      )
    )
    .orderBy(desc(journalEntries.entryTime))
    .all();
}

/** Get today's journal entries */
export function getTodayJournalEntries() {
  return getJournalEntriesForDate(todayISO());
}

/** Archive a journal entry */
export function archiveJournalEntry(id: string) {
  db.update(journalEntries)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(journalEntries.id, id))
    .run();
  removeSearchDocument(id, 'journal');
}
