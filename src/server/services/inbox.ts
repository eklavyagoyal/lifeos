import { db } from '../db';
import { sqlite } from '../db';
import { inboxItems } from '../db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { newId, now } from '@/lib/utils';
import type { CaptureParseResult } from '@/lib/types';
import { buildCapturePreview } from './capture';

/** Capture an item to inbox */
export function captureToInbox(rawText: string, parsed?: CaptureParseResult) {
  const id = newId();
  const timestamp = now();
  const preview = parsed ?? buildCapturePreview(rawText);

  db.insert(inboxItems).values({
    id,
    rawText,
    parsedType: preview.suggestedType,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  return { id, parsed: preview };
}

/** Get pending inbox items */
export function getPendingInboxItems() {
  return db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.status, 'pending'))
    .orderBy(desc(inboxItems.createdAt))
    .all()
    .map((item) => ({
      ...item,
      preview: buildCapturePreview(item.rawText),
    }));
}

/** Get pending inbox items by IDs */
export function getPendingInboxItemsByIds(ids: string[]) {
  if (ids.length === 0) return [];

  return db
    .select()
    .from(inboxItems)
    .where(inArray(inboxItems.id, ids))
    .all()
    .filter((item) => item.status === 'pending');
}

/** Get inbox count */
export function getInboxCount(): number {
  const row = sqlite.prepare(`
    SELECT COUNT(*) AS count
    FROM inbox_items
    WHERE status = 'pending'
  `).get() as { count: number };

  return row.count;
}

/** Triage an inbox item */
export function triageInboxItem(id: string, toType: string, toId: string) {
  db.update(inboxItems)
    .set({
      status: 'triaged',
      triagedToType: toType,
      triagedToId: toId,
      updatedAt: now(),
    })
    .where(eq(inboxItems.id, id))
    .run();
}

/** Dismiss an inbox item */
export function dismissInboxItem(id: string) {
  db.update(inboxItems)
    .set({ status: 'dismissed', updatedAt: now() })
    .where(eq(inboxItems.id, id))
    .run();
}
