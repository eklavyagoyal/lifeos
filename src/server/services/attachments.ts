import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, sqlite } from '../db';
import { attachmentLinks, attachments } from '../db/schema';
import { newId, now } from '@/lib/utils';
import type { AttachmentSearchStatus, AttachmentSourceType, ItemType } from '@/lib/types';
import { extractAttachmentSearchData } from './attachment-content';
import { reindexSearchItem, type SearchIndexItemType } from './search';

const DEFAULT_ATTACHMENTS_DIR = path.join(process.cwd(), 'data', 'attachments');

const MIME_TYPES: Record<string, string> = {
  '.aac': 'audio/aac',
  '.csv': 'text/csv',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

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

export interface AttachmentRecord {
  id: string;
  originalName: string;
  storagePath: string;
  mimeType: string | null;
  fileExtension: string | null;
  fileSize: number;
  sha256: string;
  sourceType: AttachmentSourceType;
  searchText: string | null;
  searchSummary: string | null;
  searchStatus: AttachmentSearchStatus;
  extractedAt: number | null;
  metadata: string | null;
  createdAt: number;
  archivedAt: number | null;
}

export interface AttachmentLinkRecord {
  id: string;
  attachmentId: string;
  itemType: string;
  itemId: string;
  label: string | null;
  createdAt: number;
}

export interface LinkedAttachment {
  linkId: string;
  attachmentId: string;
  label: string | null;
  originalName: string;
  fileExtension: string | null;
  mimeType: string | null;
  fileSize: number;
  sourceType: AttachmentSourceType;
  searchStatus: AttachmentSearchStatus;
  searchSummary: string | null;
  sharedItemCount: number;
  createdAt: number;
  url: string;
}

export function getAttachmentsRoot(): string {
  return process.env.ATTACHMENTS_PATH || DEFAULT_ATTACHMENTS_DIR;
}

export function ensureAttachmentsRoot(): string {
  const root = getAttachmentsRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function guessMimeType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  return MIME_TYPES[extension] || 'application/octet-stream';
}

function normalizeExtension(fileName: string): string | null {
  const extension = path.extname(fileName).toLowerCase();
  return extension || null;
}

function sanitizeBaseName(fileName: string): string {
  const normalized = fileName.normalize('NFKC').replaceAll('\\', '/');
  const basename = normalized.split('/').pop() || 'attachment';
  return basename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'attachment';
}

function computeSha256(input: Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};

  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed attachment metadata and overwrite it on next update.
  }

  return {};
}

function serializeMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return JSON.stringify(metadata);
}

function getStoragePath(sha256: string, fileName: string): string {
  const extension = normalizeExtension(fileName) || '';
  return path.join(sha256.slice(0, 2), `${sha256}${extension}`);
}

function createAttachmentRecord(input: {
  originalName: string;
  storagePath: string;
  mimeType: string;
  fileExtension: string | null;
  fileSize: number;
  sha256: string;
  sourceType: AttachmentSourceType;
  metadata?: Record<string, unknown>;
}) {
  const existing = db.select().from(attachments).where(eq(attachments.storagePath, input.storagePath)).get();
  if (existing) {
    return existing;
  }

  const id = newId();
  const createdAt = now();

  db.insert(attachments).values({
    id,
    originalName: input.originalName,
    storagePath: input.storagePath,
    mimeType: input.mimeType,
    fileExtension: input.fileExtension,
    fileSize: input.fileSize,
    sha256: input.sha256,
    sourceType: input.sourceType,
    searchText: null,
    searchSummary: null,
    searchStatus: 'pending',
    extractedAt: null,
    metadata: serializeMetadata(input.metadata),
    createdAt,
    archivedAt: null,
  }).run();

  return db.select().from(attachments).where(eq(attachments.id, id)).get()!;
}

function ensureStoredFile(storagePath: string, data: Buffer) {
  const fullPath = path.join(ensureAttachmentsRoot(), storagePath);
  if (fs.existsSync(fullPath)) return fullPath;

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, data);
  return fullPath;
}

function reindexLinkedItemsForAttachment(attachmentId: string) {
  const links = db.select({
    itemType: attachmentLinks.itemType,
    itemId: attachmentLinks.itemId,
  })
    .from(attachmentLinks)
    .where(eq(attachmentLinks.attachmentId, attachmentId))
    .all();

  for (const link of links) {
    reindexItemIfSearchable(link.itemType, link.itemId);
  }
}

function reindexItemIfSearchable(itemType: string, itemId: string) {
  if (!SEARCHABLE_ITEM_TYPES.has(itemType as SearchIndexItemType)) return;
  reindexSearchItem(itemType as SearchIndexItemType, itemId);
}

function refreshAttachmentSearchData(attachmentId: string) {
  const attachment = getAttachment(attachmentId);
  if (!attachment) return null;

  const absolutePath = getAttachmentAbsolutePath(attachment);
  if (!fs.existsSync(absolutePath)) {
    return attachment;
  }

  const extraction = extractAttachmentSearchData({
    absolutePath,
    mimeType: attachment.mimeType,
    fileExtension: attachment.fileExtension,
    fileSize: attachment.fileSize,
  });
  const nextMetadata = {
    ...parseMetadata(attachment.metadata),
    search: extraction.metadata,
  };

  db.update(attachments)
    .set({
      searchText: extraction.searchText,
      searchSummary: extraction.searchSummary,
      searchStatus: extraction.searchStatus,
      extractedAt: extraction.extractedAt,
      metadata: serializeMetadata(nextMetadata),
    })
    .where(eq(attachments.id, attachmentId))
    .run();

  reindexLinkedItemsForAttachment(attachmentId);
  return getAttachment(attachmentId);
}

export function registerAttachmentFromBuffer(input: {
  originalName: string;
  data: Buffer;
  sourceType?: AttachmentSourceType;
  metadata?: Record<string, unknown>;
}) {
  const originalName = sanitizeBaseName(input.originalName);
  const sha256 = computeSha256(input.data);
  const storagePath = getStoragePath(sha256, originalName);

  ensureStoredFile(storagePath, input.data);

  const attachment = createAttachmentRecord({
    originalName,
    storagePath,
    mimeType: guessMimeType(originalName),
    fileExtension: normalizeExtension(originalName),
    fileSize: input.data.byteLength,
    sha256,
    sourceType: input.sourceType ?? 'upload',
    metadata: input.metadata,
  });

  return refreshAttachmentSearchData(attachment.id) ?? attachment;
}

export function registerAttachmentFromPath(input: {
  sourcePath: string;
  originalName?: string;
  sourceType?: AttachmentSourceType;
  metadata?: Record<string, unknown>;
}) {
  const data = fs.readFileSync(input.sourcePath);
  return registerAttachmentFromBuffer({
    originalName: input.originalName || path.basename(input.sourcePath),
    data,
    sourceType: input.sourceType ?? 'import',
    metadata: {
      sourcePath: input.sourcePath,
      ...input.metadata,
    },
  });
}

export function linkAttachmentToItem(
  attachmentId: string,
  itemType: ItemType,
  itemId: string,
  label?: string
) {
  const existing = db.select().from(attachmentLinks)
    .where(
      and(
        eq(attachmentLinks.attachmentId, attachmentId),
        eq(attachmentLinks.itemType, itemType),
        eq(attachmentLinks.itemId, itemId)
      )
    )
    .get();

  if (existing) return existing;

  const id = newId();
  db.insert(attachmentLinks).values({
    id,
    attachmentId,
    itemType,
    itemId,
    label: label ?? null,
    createdAt: now(),
  }).run();

  reindexItemIfSearchable(itemType, itemId);

  return db.select().from(attachmentLinks).where(eq(attachmentLinks.id, id)).get()!;
}

export function attachBufferToItem(input: {
  itemType: ItemType;
  itemId: string;
  originalName: string;
  data: Buffer;
  label?: string;
  sourceType?: AttachmentSourceType;
  metadata?: Record<string, unknown>;
}) {
  const attachment = registerAttachmentFromBuffer({
    originalName: input.originalName,
    data: input.data,
    sourceType: input.sourceType,
    metadata: input.metadata,
  });

  const link = linkAttachmentToItem(attachment.id, input.itemType, input.itemId, input.label);
  return { attachment, link };
}

export function attachFilePathToItem(input: {
  itemType: ItemType;
  itemId: string;
  sourcePath: string;
  originalName?: string;
  label?: string;
  sourceType?: AttachmentSourceType;
  metadata?: Record<string, unknown>;
}) {
  const attachment = registerAttachmentFromPath({
    sourcePath: input.sourcePath,
    originalName: input.originalName,
    sourceType: input.sourceType,
    metadata: input.metadata,
  });

  const link = linkAttachmentToItem(attachment.id, input.itemType, input.itemId, input.label);
  return { attachment, link };
}

export function getAttachment(id: string) {
  return db.select().from(attachments).where(eq(attachments.id, id)).get();
}

export function getAttachmentAbsolutePath(attachment: Pick<AttachmentRecord, 'storagePath'>) {
  return path.join(getAttachmentsRoot(), attachment.storagePath);
}

export function getAttachmentsForItem(itemType: ItemType, itemId: string): LinkedAttachment[] {
  const links = db.select().from(attachmentLinks)
    .where(and(eq(attachmentLinks.itemType, itemType), eq(attachmentLinks.itemId, itemId)))
    .orderBy(desc(attachmentLinks.createdAt))
    .all();

  if (links.length === 0) return [];

  const attachmentIds = links.map((link) => link.attachmentId);
  const attachmentRows = db.select()
    .from(attachments)
    .where(and(inArray(attachments.id, attachmentIds), isNull(attachments.archivedAt)))
    .all();
  const attachmentsById = new Map(attachmentRows.map((attachment) => [attachment.id, attachment]));
  const usageCounts = getAttachmentUsageCounts(attachmentIds);

  return links.flatMap((link) => {
    const attachment = attachmentsById.get(link.attachmentId);
    if (!attachment) return [];

    return [{
      linkId: link.id,
      attachmentId: attachment.id,
      label: link.label,
      originalName: attachment.originalName,
      fileExtension: attachment.fileExtension,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      sourceType: attachment.sourceType as AttachmentSourceType,
      searchStatus: attachment.searchStatus as AttachmentSearchStatus,
      searchSummary: attachment.searchSummary,
      sharedItemCount: Math.max(0, (usageCounts.get(attachment.id) ?? 0) - 1),
      createdAt: link.createdAt,
      url: `/api/attachments/${attachment.id}`,
    }];
  });
}

export function removeAttachmentLink(linkId: string) {
  const link = db.select().from(attachmentLinks).where(eq(attachmentLinks.id, linkId)).get();
  db.delete(attachmentLinks).where(eq(attachmentLinks.id, linkId)).run();

  if (link) {
    reindexItemIfSearchable(link.itemType, link.itemId);
  }
}

export function archiveAttachmentIfUnused(attachmentId: string) {
  const attachment = getAttachment(attachmentId);
  if (!attachment || attachment.archivedAt) {
    return false;
  }

  if (getAttachmentUsageCount(attachmentId) > 0) {
    return false;
  }

  db.update(attachments)
    .set({ archivedAt: now() })
    .where(eq(attachments.id, attachmentId))
    .run();

  return true;
}

export function getAttachmentUsageCount(attachmentId: string): number {
  return getAttachmentUsageCounts([attachmentId]).get(attachmentId) ?? 0;
}

function getAttachmentUsageCounts(attachmentIds: string[]) {
  const result = new Map<string, number>();
  const uniqueIds = [...new Set(attachmentIds)];

  if (uniqueIds.length === 0) {
    return result;
  }

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const rows = sqlite.prepare(`
    SELECT attachment_id, COUNT(*) AS count
    FROM attachment_links
    WHERE attachment_id IN (${placeholders})
    GROUP BY attachment_id
  `).all(...uniqueIds) as Array<{
    attachment_id: string;
    count: number;
  }>;

  for (const row of rows) {
    result.set(row.attachment_id, row.count);
  }

  return result;
}
