import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { db } from '../db';
import { events } from '../db/schema';
import { newId, now } from '@/lib/utils';
import { removeSearchDocument, syncSearchDocument } from './search';

export interface CreateEventInput {
  title: string;
  body?: string;
  eventDate: string;
  eventEndDate?: string;
  eventType?: 'life_event' | 'milestone' | 'trip' | 'memory' | 'achievement';
  importance?: number;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  id: string;
}

export function createEvent(input: CreateEventInput) {
  const id = newId();
  const timestamp = now();

  db.insert(events).values({
    id,
    title: input.title,
    body: input.body ?? null,
    eventDate: input.eventDate,
    eventEndDate: input.eventEndDate ?? null,
    eventType: input.eventType ?? 'life_event',
    importance: input.importance ?? 3,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  syncSearchDocument({
    itemId: id,
    itemType: 'event',
    title: input.title,
    body: [input.body, input.eventType, input.eventDate, input.eventEndDate].filter(Boolean).join(' '),
  });

  return getEvent(id);
}

export function getEvent(id: string) {
  return db.select().from(events).where(eq(events.id, id)).get();
}

export function getAllEvents() {
  return db
    .select()
    .from(events)
    .where(isNull(events.archivedAt))
    .orderBy(desc(events.eventDate), desc(events.createdAt))
    .all();
}

export function getEventsForDateRange(startDate: string, endDate: string) {
  return db
    .select()
    .from(events)
    .where(
      and(
        isNull(events.archivedAt),
        gte(events.eventDate, startDate),
        lte(events.eventDate, endDate)
      )
    )
    .orderBy(asc(events.eventDate), desc(events.importance), desc(events.createdAt))
    .all();
}

export function updateEvent(input: UpdateEventInput) {
  const updates: Record<string, unknown> = { updatedAt: now() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) updates.body = input.body;
  if (input.eventDate !== undefined) updates.eventDate = input.eventDate;
  if (input.eventEndDate !== undefined) updates.eventEndDate = input.eventEndDate;
  if (input.eventType !== undefined) updates.eventType = input.eventType;
  if (input.importance !== undefined) updates.importance = input.importance;

  db.update(events).set(updates).where(eq(events.id, input.id)).run();

  const event = getEvent(input.id);
  if (event && !event.archivedAt) {
    syncSearchDocument({
      itemId: event.id,
      itemType: 'event',
      title: event.title,
      body: [event.body, event.eventType, event.eventDate, event.eventEndDate].filter(Boolean).join(' '),
    });
  }

  return event;
}

export function archiveEvent(id: string) {
  db.update(events)
    .set({ archivedAt: now(), updatedAt: now() })
    .where(eq(events.id, id))
    .run();

  removeSearchDocument(id, 'event');
}
