import { and, eq, isNull } from 'drizzle-orm';
import { db, sqlite } from '../db';
import { attachmentLinks, attachments } from '../db/schema';
import type { AttachmentSearchStatus, ItemType } from '@/lib/types';

export interface AttachmentSummary {
  attachmentId: string;
  originalName: string;
  label: string | null;
  searchStatus: AttachmentSearchStatus;
  searchSummary: string | null;
}

export interface SharedAttachmentReference {
  type: ItemType;
  id: string;
  attachmentNames: string[];
  sharedCount: number;
}

function joinSearchParts(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

export function getAttachmentSearchContextForItem(itemType: ItemType, itemId: string): string {
  const rows = db.select({
    originalName: attachments.originalName,
    label: attachmentLinks.label,
    mimeType: attachments.mimeType,
    fileExtension: attachments.fileExtension,
    searchText: attachments.searchText,
    searchSummary: attachments.searchSummary,
  })
    .from(attachmentLinks)
    .innerJoin(attachments, eq(attachmentLinks.attachmentId, attachments.id))
    .where(
      and(
        eq(attachmentLinks.itemType, itemType),
        eq(attachmentLinks.itemId, itemId),
        isNull(attachments.archivedAt)
      )
    )
    .all();

  if (rows.length === 0) return '';

  return rows
    .map((row) => joinSearchParts([
      row.originalName,
      row.label,
      row.mimeType,
      row.fileExtension,
      row.searchSummary,
      row.searchText,
    ]))
    .join(' ');
}

export function getAttachmentSummariesForItems(
  items: Array<{ type: ItemType; id: string }>,
  limitPerItem = 2
) {
  const itemKeys = [...new Set(items.map((item) => `${item.type}:${item.id}`))];
  const counts = new Map<string, number>();
  const names = new Map<string, string[]>();

  if (itemKeys.length === 0) {
    return { counts, names };
  }

  const placeholders = itemKeys.map(() => '?').join(', ');
  const rows = sqlite.prepare(`
    SELECT
      l.item_type AS item_type,
      l.item_id AS item_id,
      a.original_name AS original_name
    FROM attachment_links l
    JOIN attachments a ON a.id = l.attachment_id
    WHERE a.archived_at IS NULL
      AND (l.item_type || ':' || l.item_id) IN (${placeholders})
    ORDER BY l.created_at DESC
  `).all(...itemKeys) as Array<{
    item_type: string;
    item_id: string;
    original_name: string;
  }>;

  for (const row of rows) {
    const key = `${row.item_type}:${row.item_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);

    const currentNames = names.get(key) ?? [];
    if (currentNames.length < limitPerItem && !currentNames.includes(row.original_name)) {
      currentNames.push(row.original_name);
      names.set(key, currentNames);
    } else if (!names.has(key)) {
      names.set(key, currentNames);
    }
  }

  return { counts, names };
}

export function getSharedAttachmentReferencesForItem(itemType: ItemType, itemId: string): SharedAttachmentReference[] {
  const attachmentRows = db.select({
    attachmentId: attachmentLinks.attachmentId,
    originalName: attachments.originalName,
  })
    .from(attachmentLinks)
    .innerJoin(attachments, eq(attachmentLinks.attachmentId, attachments.id))
    .where(
      and(
        eq(attachmentLinks.itemType, itemType),
        eq(attachmentLinks.itemId, itemId),
        isNull(attachments.archivedAt)
      )
    )
    .all();

  if (attachmentRows.length === 0) return [];

  const attachmentIds = attachmentRows.map((row) => row.attachmentId);
  const placeholders = attachmentIds.map(() => '?').join(', ');
  const rows = sqlite.prepare(`
    SELECT
      l.item_type AS item_type,
      l.item_id AS item_id,
      l.attachment_id AS attachment_id,
      a.original_name AS original_name
    FROM attachment_links l
    JOIN attachments a ON a.id = l.attachment_id
    WHERE a.archived_at IS NULL
      AND l.attachment_id IN (${placeholders})
  `).all(...attachmentIds) as Array<{
    item_type: string;
    item_id: string;
    attachment_id: string;
    original_name: string;
  }>;

  const grouped = new Map<string, SharedAttachmentReference>();
  const attachmentIdsByKey = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.item_type === itemType && row.item_id === itemId) continue;

    const key = `${row.item_type}:${row.item_id}`;
    const current = grouped.get(key) ?? {
      type: row.item_type as ItemType,
      id: row.item_id,
      attachmentNames: [],
      sharedCount: 0,
    };
    const attachmentIds = attachmentIdsByKey.get(key) ?? new Set<string>();

    if (!current.attachmentNames.includes(row.original_name)) {
      current.attachmentNames.push(row.original_name);
    }
    attachmentIds.add(row.attachment_id);
    current.sharedCount = attachmentIds.size;

    grouped.set(key, current);
    attachmentIdsByKey.set(key, attachmentIds);
  }

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      attachmentNames: entry.attachmentNames.sort(),
    }))
    .sort((a, b) => {
      const diff = b.sharedCount - a.sharedCount;
      if (diff !== 0) return diff;
      return `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`);
    });
}

export function getSharedAttachmentEdges(): Array<{
  sourceType: ItemType;
  sourceId: string;
  targetType: ItemType;
  targetId: string;
  label: string;
}> {
  const rows = sqlite.prepare(`
    SELECT
      l.attachment_id AS attachment_id,
      l.item_type AS item_type,
      l.item_id AS item_id,
      a.original_name AS original_name
    FROM attachment_links l
    JOIN attachments a ON a.id = l.attachment_id
    WHERE a.archived_at IS NULL
    ORDER BY l.attachment_id, l.created_at
  `).all() as Array<{
    attachment_id: string;
    item_type: string;
    item_id: string;
    original_name: string;
  }>;

  const byAttachment = new Map<string, Array<{ type: ItemType; id: string; originalName: string }>>();
  for (const row of rows) {
    const current = byAttachment.get(row.attachment_id) ?? [];
    current.push({
      type: row.item_type as ItemType,
      id: row.item_id,
      originalName: row.original_name,
    });
    byAttachment.set(row.attachment_id, current);
  }

  const pairs = new Map<string, {
    sourceType: ItemType;
    sourceId: string;
    targetType: ItemType;
    targetId: string;
    attachmentIds: Set<string>;
    names: Set<string>;
  }>();

  for (const [attachmentId, refs] of byAttachment.entries()) {
    const uniqueRefs = [...new Map(
      refs.map((ref) => [`${ref.type}:${ref.id}`, ref])
    ).values()];

    for (let index = 0; index < uniqueRefs.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < uniqueRefs.length; nextIndex += 1) {
        const source = uniqueRefs[index];
        const target = uniqueRefs[nextIndex];
        const ordered = [`${source.type}:${source.id}`, `${target.type}:${target.id}`].sort();
        const pairKey = ordered.join('::');
        const current = pairs.get(pairKey) ?? {
          sourceType: ordered[0].split(':')[0] as ItemType,
          sourceId: ordered[0].split(':')[1],
          targetType: ordered[1].split(':')[0] as ItemType,
          targetId: ordered[1].split(':')[1],
          attachmentIds: new Set<string>(),
          names: new Set<string>(),
        };
        current.attachmentIds.add(attachmentId);
        current.names.add(source.originalName);
        pairs.set(pairKey, current);
      }
    }
  }

  return [...pairs.values()].map((pair) => {
    const names = [...pair.names].sort();
    const sharedCount = [...pair.attachmentIds].filter(Boolean).length || names.length;
    const label = sharedCount === 1
      ? `shared ${names[0]}`
      : `shared files (${sharedCount})`;

    return {
      sourceType: pair.sourceType,
      sourceId: pair.sourceId,
      targetType: pair.targetType,
      targetId: pair.targetId,
      label,
    };
  });
}
