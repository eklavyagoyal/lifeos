import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import {
  attachmentLinks,
  attachments,
  habits,
  importedRecords,
  importRuns,
  itemTags,
  journalEntries,
  milestones,
  notes,
  projects,
  relations as relationsTable,
  tasks,
} from '../db/schema';
import { newId, now, wordCount } from '@/lib/utils';
import { archiveAttachmentIfUnused, attachFilePathToItem, removeAttachmentLink } from './attachments';
import { archiveProject, createProject, getAllProjects, getProject } from './projects';
import { archiveJournalEntry, createJournalEntry } from './journal';
import { archiveNote, createNote } from './notes';
import { createRelation, removeRelation } from './relations';
import { reindexSearchItem } from './search';
import { getOrCreateTag, addTagToItem } from './tags';
import { archiveTask, createTask } from './tasks';
import { resolveItemsBatch } from './graph-helpers';
import type { ImportRunStatus, ImportType, ItemType, TaskPriority, TaskStatus } from '@/lib/types';

type ImportDestinationType = 'task' | 'note' | 'journal';

interface PlannedAttachment {
  sourcePath: string;
  originalName?: string;
  label?: string;
}

interface PlannedRelation {
  targetSourceKey: string;
  relationType: 'mentions' | 'related_to';
}

interface PlannedImportItem {
  sourceRecordKey: string;
  sourceChecksum: string;
  sourceLabel: string;
  destinationType: ImportDestinationType;
  title: string;
  body?: string;
  collection?: string;
  tags: string[];
  attachmentPlans: PlannedAttachment[];
  relationPlans: PlannedRelation[];
  createdAt?: number;
  updatedAt?: number;
  taskStatus?: TaskStatus;
  taskPriority?: TaskPriority;
  taskDueDate?: string;
  taskContext?: string;
  taskProjectTitle?: string;
  taskParentSourceKey?: string;
  taskCompletedAt?: number;
  journalEntryDate?: string;
  journalEntryTime?: string;
  journalEntryType?: string;
}

interface ImportPlan {
  importType: ImportType;
  sourcePath: string;
  sourceLabel: string;
  items: PlannedImportItem[];
  warnings: string[];
}

export interface ImportPreviewItem {
  sourceRecordKey: string;
  sourceLabel: string;
  destinationType: ImportDestinationType;
  title: string;
  subtitle?: string;
  tags: string[];
  attachmentCount: number;
  attachmentNames: string[];
  relationCount: number;
  mappedFields: ImportPreviewField[];
  autoProjectTitle?: string;
  duplicate: boolean;
  duplicateTarget?: {
    itemType: ItemType;
    itemId: string;
    title: string;
    detailUrl?: string;
  };
}

export interface ImportPreviewField {
  label: string;
  value: string;
}

export interface ImportPreviewStats {
  totalItems: number;
  tasks: number;
  notes: number;
  journalEntries: number;
  attachments: number;
  relations: number;
  duplicates: number;
  imported: number;
}

export interface ImportPreviewMappingGroup {
  id: string;
  sourceLabel: string;
  destinationLabel: string;
  description: string;
  coverageCount: number;
  sampleValues: string[];
}

export interface ImportPreviewDiffSummary {
  newItems: number;
  duplicateItems: number;
  attachmentCopies: number;
  relationLinks: number;
  tagAssignments: number;
  autoCreateProjectTitles: string[];
}

export interface ImportPreviewResult {
  importType: ImportType;
  sourcePath: string;
  sourceLabel: string;
  warnings: string[];
  stats: ImportPreviewStats;
  mappingGroups: ImportPreviewMappingGroup[];
  diff: ImportPreviewDiffSummary;
  items: ImportPreviewItem[];
}

export interface ImportRollbackSummary {
  status: 'available' | 'rolled_back' | 'no_changes';
  summary: string;
  rolledBackAt: number | null;
  archivedItemCount: number;
  removedRelationCount: number;
  removedAttachmentLinkCount: number;
  archivedAttachmentCount: number;
  archivedProjectCount: number;
  skippedProjectTitles: string[];
}

export interface ImportRunDetails {
  message: string;
  preview?: {
    mappingGroups: ImportPreviewMappingGroup[];
    diff: ImportPreviewDiffSummary;
  };
  createdArtifacts?: {
    relationIds: string[];
    attachmentLinkIds: string[];
    projectIds: string[];
  };
  rollback?: ImportRollbackSummary;
  raw?: string | null;
}

export interface ImportRunSummary {
  id: string;
  importType: ImportType;
  sourcePath: string;
  sourceLabel: string | null;
  mode: 'preview' | 'import';
  status: ImportRunStatus;
  summary: string | null;
  warnings: string[];
  stats: ImportPreviewStats | null;
  details: ImportRunDetails | null;
  startedAt: number;
  completedAt: number | null;
  createdAt: number;
}

export interface ImportExecutionResult extends ImportPreviewResult {
  runId: string;
  createdItems: Array<{ itemType: ItemType; itemId: string; title: string }>;
}

const TODOIST_PRIORITY_MAP: Record<string, TaskPriority> = {
  '4': 'p1',
  '3': 'p2',
  '2': 'p3',
  '1': 'p4',
  p1: 'p1',
  p2: 'p2',
  p3: 'p3',
  p4: 'p4',
  high: 'p2',
  medium: 'p3',
  low: 'p4',
};

const EMPTY_IMPORT_STATS: ImportPreviewStats = {
  totalItems: 0,
  tasks: 0,
  notes: 0,
  journalEntries: 0,
  attachments: 0,
  relations: 0,
  duplicates: 0,
  imported: 0,
};

interface ImportMappingDefinition {
  id: string;
  sourceLabel: string;
  destinationLabel: string;
  description: string;
  isRelevant: (item: PlannedImportItem) => boolean;
  collectSamples: (item: PlannedImportItem) => string[];
}

interface CreatedImportArtifacts {
  relationIds: string[];
  attachmentLinkIds: string[];
  projectIds: string[];
}

interface SerializedImportRunDetails extends Omit<ImportRunDetails, 'raw'> {
  formatVersion: 1;
}

function createArtifactsTracker(): CreatedImportArtifacts {
  return {
    relationIds: [],
    attachmentLinkIds: [],
    projectIds: [],
  };
}

function uniqueStrings(values: Array<string | null | undefined>, limit = Infinity) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= limit) break;
  }

  return result;
}

function truncatePreviewValue(value: string, maxLength = 72) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s+[0-9a-f]{32}$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseListLikeValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseListLikeValue(entry));
  }

  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parseListLikeValue(parsed);
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return trimmed
    .split(/[,\n;]/)
    .map((entry) => entry.replace(/^#/, '').trim())
    .filter(Boolean);
}

function parseDateValue(value: string): { isoDate?: string; timestamp?: number; time?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    return { isoDate: trimmed, timestamp: parsed.getTime() };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return {};
  }

  return {
    isoDate: parsed.toISOString().slice(0, 10),
    timestamp: parsed.getTime(),
    time: parsed.toISOString().slice(11, 16),
  };
}

function buildBodyFromFields(record: Record<string, string>, excludedHeaders: string[]) {
  const excluded = new Set(excludedHeaders.map((header) => normalizeHeader(header)));
  return Object.entries(record)
    .filter(([, value]) => safeTrim(value))
    .filter(([key]) => !excluded.has(normalizeHeader(key)))
    .map(([key, value]) => `- **${key}**: ${value}`)
    .join('\n');
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function rowsToObjects(rows: string[][]): Array<Record<string, string>> {
  if (rows.length === 0) return [];
  const headers = rows[0].map((cell, index) => cell.trim() || `column_${index + 1}`);
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() || '';
    });
    return record;
  });
}

function walkFiles(rootPath: string): string[] {
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
    } else {
      files.push(absolutePath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function parseFrontmatter(markdown: string): { attributes: Record<string, string | string[]>; body: string } {
  if (!markdown.startsWith('---\n')) {
    return { attributes: {}, body: markdown };
  }

  const closingIndex = markdown.indexOf('\n---', 4);
  if (closingIndex === -1) {
    return { attributes: {}, body: markdown };
  }

  const frontmatterBlock = markdown.slice(4, closingIndex).trim();
  const body = markdown.slice(closingIndex + 4).replace(/^\n/, '');
  const attributes: Record<string, string | string[]> = {};
  let currentKey: string | null = null;

  for (const rawLine of frontmatterBlock.split('\n')) {
    const line = rawLine.trimEnd();
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentKey) {
      const existing = attributes[currentKey];
      const nextValue = listMatch[1].trim().replace(/^['"]|['"]$/g, '');
      if (Array.isArray(existing)) {
        existing.push(nextValue);
      } else if (typeof existing === 'string' && existing) {
        attributes[currentKey] = [existing, nextValue];
      } else {
        attributes[currentKey] = [nextValue];
      }
      continue;
    }

    const keyValueMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyValueMatch) continue;

    currentKey = normalizeHeader(keyValueMatch[1]);
    const rawValue = keyValueMatch[2].trim();
    if (!rawValue) {
      attributes[currentKey] = [];
      continue;
    }

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      attributes[currentKey] = rawValue
        .slice(1, -1)
        .split(',')
        .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      continue;
    }

    attributes[currentKey] = rawValue.replace(/^['"]|['"]$/g, '');
  }

  return { attributes, body };
}

function extractInlineTags(markdown: string) {
  return [...new Set(
    [...markdown.matchAll(/(^|\s)#([a-z0-9][a-z0-9-]*)/gi)].map((match) => match[2].toLowerCase())
  )];
}

function extractFirstHeading(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function cleanImportedTitle(fileName: string): string {
  return path.basename(fileName, path.extname(fileName))
    .replace(/\s+[0-9a-f]{32}$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function buildSourceLabel(sourcePath: string): string {
  return path.basename(sourcePath).replace(/\.(csv|json|zip)$/i, '');
}

function findLikelyFile(rootPath: string, extensions: string[]): string | null {
  const candidates = fs.statSync(rootPath).isDirectory() ? walkFiles(rootPath) : [rootPath];
  const match = candidates.find((candidate) => extensions.includes(path.extname(candidate).toLowerCase()));
  return match || null;
}

function buildFileIndex(rootPath: string) {
  const map = new Map<string, string[]>();
  const files = fs.statSync(rootPath).isDirectory() ? walkFiles(rootPath) : [rootPath];

  for (const filePath of files) {
    const baseName = path.basename(filePath).toLowerCase();
    const existing = map.get(baseName) ?? [];
    existing.push(filePath);
    map.set(baseName, existing);
  }

  return map;
}

function resolveAssetPath(options: {
  rawTarget: string;
  currentDirectory: string;
  rootPath: string;
  fileIndex?: Map<string, string[]>;
}): string | null {
  const target = decodeURIComponent(options.rawTarget.split('#')[0].split('|')[0].trim());
  if (!target || /^https?:\/\//i.test(target) || target.startsWith('mailto:')) {
    return null;
  }

  const directCandidate = path.resolve(options.currentDirectory, target);
  if (fs.existsSync(directCandidate) && fs.statSync(directCandidate).isFile()) {
    return directCandidate;
  }

  const rootCandidate = path.resolve(options.rootPath, target.replace(/^\/+/, ''));
  if (fs.existsSync(rootCandidate) && fs.statSync(rootCandidate).isFile()) {
    return rootCandidate;
  }

  const baseName = path.basename(target).toLowerCase();
  const indexed = options.fileIndex?.get(baseName) ?? [];
  return indexed[0] || null;
}

function toImportStats(items: PlannedImportItem[], duplicateKeys: Set<string>): ImportPreviewStats {
  return {
    totalItems: items.length,
    tasks: items.filter((item) => item.destinationType === 'task').length,
    notes: items.filter((item) => item.destinationType === 'note').length,
    journalEntries: items.filter((item) => item.destinationType === 'journal').length,
    attachments: items.reduce((sum, item) => sum + item.attachmentPlans.length, 0),
    relations: items.reduce((sum, item) => sum + item.relationPlans.length, 0),
    duplicates: duplicateKeys.size,
    imported: Math.max(items.length - duplicateKeys.size, 0),
  };
}

function parseTags(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
    .filter(Boolean);
}

function parseTodoistStatus(record: Record<string, string>) {
  const statusValue = [
    record.Status,
    record.status,
    record.Checked,
    record.checked,
    record.Completed,
    record.completed,
  ].find((value) => safeTrim(value));

  const normalized = normalizeHeader(statusValue || '');
  if (['1', 'checked', 'done', 'complete', 'completed', 'yes', 'true'].includes(normalized)) {
    return 'done' as const;
  }
  if (['inprogress', 'doing', 'active'].includes(normalized)) {
    return 'in_progress' as const;
  }
  if (['cancelled', 'canceled'].includes(normalized)) {
    return 'cancelled' as const;
  }
  return 'todo' as const;
}

function parseTaskStatus(value: string): TaskStatus {
  const normalized = normalizeHeader(value);
  if (['done', 'completed', 'complete', 'checked'].includes(normalized)) return 'done';
  if (['inprogress', 'doing', 'active'].includes(normalized)) return 'in_progress';
  if (['cancelled', 'canceled', 'archived'].includes(normalized)) return 'cancelled';
  if (['inbox'].includes(normalized)) return 'inbox';
  return 'todo';
}

function parseTaskPriority(value: string): TaskPriority | undefined {
  return TODOIST_PRIORITY_MAP[normalizeHeader(value)] || undefined;
}

function formatPriorityLabel(priority: TaskPriority | undefined) {
  return priority ? `P${priority.slice(1)}` : '';
}

function formatImportSubtitle(item: PlannedImportItem) {
  if (item.destinationType === 'task') {
    return [item.taskProjectTitle, item.taskDueDate].filter(Boolean).join(' · ') || undefined;
  }

  if (item.destinationType === 'journal') {
    return [item.journalEntryDate, item.journalEntryTime].filter(Boolean).join(' · ') || undefined;
  }

  return item.collection || undefined;
}

function buildPreviewMappedFields(item: PlannedImportItem): ImportPreviewField[] {
  const fields: ImportPreviewField[] = [];

  if (item.destinationType === 'task') {
    if (item.taskStatus) fields.push({ label: 'Status', value: item.taskStatus });
    if (item.taskPriority) fields.push({ label: 'Priority', value: formatPriorityLabel(item.taskPriority) });
    if (item.taskDueDate) fields.push({ label: 'Due', value: item.taskDueDate });
    if (item.taskContext) fields.push({ label: 'Section', value: item.taskContext });
    if (item.taskProjectTitle) fields.push({ label: 'Project', value: item.taskProjectTitle });
    if (item.taskParentSourceKey) fields.push({ label: 'Parent', value: 'Nested under imported parent task' });
  } else if (item.destinationType === 'journal') {
    if (item.journalEntryDate) fields.push({ label: 'Date', value: item.journalEntryDate });
    if (item.journalEntryTime) fields.push({ label: 'Time', value: item.journalEntryTime });
    if (item.journalEntryType) fields.push({ label: 'Entry type', value: item.journalEntryType });
  } else {
    if (item.collection) fields.push({ label: 'Collection', value: item.collection });
  }

  if (item.body) {
    fields.push({
      label: 'Body',
      value: `${wordCount(item.body)} word${wordCount(item.body) === 1 ? '' : 's'}`,
    });
  }

  return fields.slice(0, 6);
}

function getImportMappingDefinitions(importType: ImportType): ImportMappingDefinition[] {
  switch (importType) {
    case 'todoist_csv':
      return [
        {
          id: 'todoist-content',
          sourceLabel: 'Todoist CONTENT / DESCRIPTION',
          destinationLabel: 'Task title and body',
          description: 'Task rows become tasks, while descriptions and comments are appended into the task body.',
          isRelevant: (item) => item.destinationType === 'task',
          collectSamples: (item) => [item.title, item.body ?? ''],
        },
        {
          id: 'todoist-priority',
          sourceLabel: 'Todoist PRIORITY',
          destinationLabel: 'Task priority',
          description: 'Todoist priority numbers are normalized into lifeOS P1-P4 priority labels.',
          isRelevant: (item) => item.destinationType === 'task' && Boolean(item.taskPriority),
          collectSamples: (item) => [formatPriorityLabel(item.taskPriority)],
        },
        {
          id: 'todoist-schedule',
          sourceLabel: 'Todoist DATE / section',
          destinationLabel: 'Due date and task context',
          description: 'Due dates land on the task, and Todoist sections become the task context.',
          isRelevant: (item) => item.destinationType === 'task' && Boolean(item.taskDueDate || item.taskContext),
          collectSamples: (item) => [item.taskDueDate ?? '', item.taskContext ?? ''],
        },
        {
          id: 'todoist-labels',
          sourceLabel: 'Todoist LABELS',
          destinationLabel: 'Task tags',
          description: 'Todoist labels are converted into normalized lifeOS tags.',
          isRelevant: (item) => item.tags.length > 0,
          collectSamples: (item) => item.tags.map((tag) => `#${tag}`),
        },
        {
          id: 'todoist-indent',
          sourceLabel: 'Todoist INDENT',
          destinationLabel: 'Parent task nesting',
          description: 'Indented Todoist tasks keep their hierarchy by linking to the imported parent task.',
          isRelevant: (item) => item.destinationType === 'task' && Boolean(item.taskParentSourceKey),
          collectSamples: (item) => [item.title],
        },
      ];
    case 'obsidian_vault':
      return [
        {
          id: 'obsidian-title',
          sourceLabel: 'Markdown filename / first heading',
          destinationLabel: 'Note title',
          description: 'Markdown file names and top headings become note titles.',
          isRelevant: (item) => item.destinationType === 'note',
          collectSamples: (item) => [item.title],
        },
        {
          id: 'obsidian-tags',
          sourceLabel: 'Frontmatter tags and inline hashtags',
          destinationLabel: 'Note tags',
          description: 'Frontmatter tag arrays and inline hashtags are merged into a deduped tag set.',
          isRelevant: (item) => item.tags.length > 0,
          collectSamples: (item) => item.tags.map((tag) => `#${tag}`),
        },
        {
          id: 'obsidian-links',
          sourceLabel: 'Wiki links and markdown links',
          destinationLabel: 'Mention relations',
          description: 'Resolvable internal links are converted into explicit `mentions` relations.',
          isRelevant: (item) => item.relationPlans.length > 0,
          collectSamples: (item) => [item.title],
        },
        {
          id: 'obsidian-attachments',
          sourceLabel: 'Embedded local files',
          destinationLabel: 'Local attachments',
          description: 'Embeds like `![[file]]` and local markdown embeds are copied into attachment storage.',
          isRelevant: (item) => item.attachmentPlans.length > 0,
          collectSamples: (item) =>
            item.attachmentPlans.map((attachment) => attachment.originalName ?? path.basename(attachment.sourcePath)),
        },
      ];
    case 'notion_export':
      return [
        {
          id: 'notion-pages',
          sourceLabel: 'Markdown pages',
          destinationLabel: 'Notes',
          description: 'Markdown page exports become notes, keeping collection context from folder structure.',
          isRelevant: (item) => item.destinationType === 'note',
          collectSamples: (item) => [item.title, item.collection ?? ''],
        },
        {
          id: 'notion-csv-name',
          sourceLabel: 'Database row Name / Title',
          destinationLabel: 'Task or note title',
          description: 'CSV database rows map into tasks when the schema looks task-like, otherwise into notes.',
          isRelevant: () => true,
          collectSamples: (item) => [item.title],
        },
        {
          id: 'notion-csv-status',
          sourceLabel: 'Status / Priority / Due',
          destinationLabel: 'Task workflow fields',
          description: 'Task-like CSV rows preserve status, priority, and due date when those fields are present.',
          isRelevant: (item) =>
            item.destinationType === 'task' && Boolean(item.taskStatus || item.taskPriority || item.taskDueDate),
          collectSamples: (item) => [item.taskStatus ?? '', formatPriorityLabel(item.taskPriority), item.taskDueDate ?? ''],
        },
        {
          id: 'notion-tags',
          sourceLabel: 'Tags / Labels columns',
          destinationLabel: 'Tags',
          description: 'List-like Notion tag fields are normalized into lifeOS tags.',
          isRelevant: (item) => item.tags.length > 0,
          collectSamples: (item) => item.tags.map((tag) => `#${tag}`),
        },
      ];
    case 'day_one_json':
      return [
        {
          id: 'dayone-text',
          sourceLabel: 'Entry text and title',
          destinationLabel: 'Journal title and body',
          description: 'Day One entry text is kept as the journal body, with a derived or explicit title.',
          isRelevant: (item) => item.destinationType === 'journal',
          collectSamples: (item) => [item.title],
        },
        {
          id: 'dayone-date',
          sourceLabel: 'Creation / modified dates',
          destinationLabel: 'Journal entry date and time',
          description: 'Entry timestamps are normalized into the journal date and optional time fields.',
          isRelevant: (item) => item.destinationType === 'journal' && Boolean(item.journalEntryDate),
          collectSamples: (item) => [item.journalEntryDate ?? '', item.journalEntryTime ?? ''],
        },
        {
          id: 'dayone-tags',
          sourceLabel: 'Day One tags',
          destinationLabel: 'Journal tags',
          description: 'Day One tags are preserved as journal tags in lifeOS.',
          isRelevant: (item) => item.tags.length > 0,
          collectSamples: (item) => item.tags.map((tag) => `#${tag}`),
        },
        {
          id: 'dayone-media',
          sourceLabel: 'Photos, audio, and video assets',
          destinationLabel: 'Local attachments',
          description: 'Resolvable Day One media assets are copied into local attachment storage.',
          isRelevant: (item) => item.attachmentPlans.length > 0,
          collectSamples: (item) =>
            item.attachmentPlans.map((attachment) => attachment.originalName ?? path.basename(attachment.sourcePath)),
        },
      ];
  }
}

function buildMappingGroups(plan: ImportPlan): ImportPreviewMappingGroup[] {
  return getImportMappingDefinitions(plan.importType).flatMap((definition) => {
    const relevantItems = plan.items.filter((item) => definition.isRelevant(item));
    const sampleValues = uniqueStrings(
      relevantItems.flatMap((item) => definition.collectSamples(item).map((sample) => truncatePreviewValue(sample)))
    , 3);

    if (relevantItems.length === 0 && sampleValues.length === 0) {
      return [];
    }

    return [{
      id: definition.id,
      sourceLabel: definition.sourceLabel,
      destinationLabel: definition.destinationLabel,
      description: definition.description,
      coverageCount: relevantItems.length,
      sampleValues,
    }];
  });
}

function getExistingProjectTitleSet() {
  return new Set(getAllProjects().map((project) => normalizeKey(project.title)));
}

function buildDiffSummary(
  plan: ImportPlan,
  duplicateKeys: Set<string>,
  existingProjectTitles: Set<string>
): ImportPreviewDiffSummary {
  const autoCreateProjectTitles = uniqueStrings(
    plan.items.flatMap((item) => {
      if (item.destinationType !== 'task' || !item.taskProjectTitle) return [];
      return existingProjectTitles.has(normalizeKey(item.taskProjectTitle)) ? [] : [item.taskProjectTitle];
    })
  );

  return {
    newItems: Math.max(plan.items.length - duplicateKeys.size, 0),
    duplicateItems: duplicateKeys.size,
    attachmentCopies: plan.items.reduce((sum, item) => sum + item.attachmentPlans.length, 0),
    relationLinks: plan.items.reduce((sum, item) => sum + item.relationPlans.length, 0),
    tagAssignments: plan.items.reduce((sum, item) => sum + new Set(item.tags).size, 0),
    autoCreateProjectTitles,
  };
}

function serializeImportRunDetails(details?: ImportRunDetails | string | null) {
  if (!details) return null;
  if (typeof details === 'string') return details;

  const payload: SerializedImportRunDetails = {
    formatVersion: 1,
    message: details.message,
    preview: details.preview,
    createdArtifacts: details.createdArtifacts,
    rollback: details.rollback,
  };

  return JSON.stringify(payload);
}

function parseImportRunDetails(value: string | null): ImportRunDetails | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Partial<SerializedImportRunDetails>;
      if (typeof record.message === 'string') {
        return {
          message: record.message,
          preview: record.preview,
          createdArtifacts: record.createdArtifacts,
          rollback: record.rollback,
          raw: value,
        };
      }
    }
  } catch {
    return {
      message: value,
      raw: value,
    };
  }

  return {
    message: value,
    raw: value,
  };
}

function createImportRun(input: {
  importType: ImportType;
  sourcePath: string;
  sourceLabel: string;
  mode: 'preview' | 'import';
}) {
  const id = newId();
  const timestamp = now();

  db.insert(importRuns).values({
    id,
    importType: input.importType,
    sourcePath: input.sourcePath,
    sourceLabel: input.sourceLabel,
    mode: input.mode,
    status: 'running',
    summary: null,
    warnings: null,
    stats: null,
    details: null,
    startedAt: timestamp,
    completedAt: null,
    createdAt: timestamp,
  }).run();

  return id;
}

function finalizeImportRun(input: {
  runId: string;
  status: ImportRunStatus;
  summary: string;
  warnings: string[];
  stats: ImportPreviewStats;
  details?: ImportRunDetails | string | null;
}) {
  db.update(importRuns)
    .set({
      status: input.status,
      summary: input.summary,
      warnings: JSON.stringify(input.warnings),
      stats: JSON.stringify(input.stats),
      details: serializeImportRunDetails(input.details),
      completedAt: now(),
    })
    .where(eq(importRuns.id, input.runId))
    .run();
}

function getImportedRecordMap(importType: ImportType, sourceRecordKeys: string[]) {
  const map = new Map<string, { itemType: ItemType; itemId: string }>();
  if (sourceRecordKeys.length === 0) return map;

  for (let index = 0; index < sourceRecordKeys.length; index += 250) {
    const chunk = sourceRecordKeys.slice(index, index + 250);
    const rows = db.select().from(importedRecords)
      .where(and(eq(importedRecords.importType, importType), inArray(importedRecords.sourceRecordKey, chunk)))
      .all();

    for (const row of rows) {
      map.set(row.sourceRecordKey, {
        itemType: row.itemType as ItemType,
        itemId: row.itemId,
      });
    }
  }

  return map;
}

function resolveZipSource(sourcePath: string) {
  if (path.extname(sourcePath).toLowerCase() !== '.zip') {
    return {
      workingPath: sourcePath,
      cleanup: () => undefined,
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-import-'));
  const zip = new AdmZip(sourcePath);
  zip.extractAllTo(tempDir, true);

  return {
    workingPath: tempDir,
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function applyImportedTimestamps(
  itemType: ImportDestinationType,
  itemId: string,
  timestamps: {
    createdAt?: number;
    updatedAt?: number;
    completedAt?: number;
  }
) {
  if (!timestamps.createdAt && !timestamps.updatedAt && !timestamps.completedAt) return;

  if (itemType === 'task') {
    db.update(tasks)
      .set({
        createdAt: timestamps.createdAt,
        updatedAt: timestamps.updatedAt ?? timestamps.createdAt,
        completedAt: timestamps.completedAt,
      })
      .where(eq(tasks.id, itemId))
      .run();
    reindexSearchItem('task', itemId);
    return;
  }

  if (itemType === 'note') {
    db.update(notes)
      .set({
        createdAt: timestamps.createdAt,
        updatedAt: timestamps.updatedAt ?? timestamps.createdAt,
      })
      .where(eq(notes.id, itemId))
      .run();
    reindexSearchItem('note', itemId);
    return;
  }

  db.update(journalEntries)
    .set({
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt ?? timestamps.createdAt,
    })
    .where(eq(journalEntries.id, itemId))
    .run();
  reindexSearchItem('journal', itemId);
}

function ensureProjectByTitle(title: string) {
  const normalized = normalizeKey(title);
  const existing = getAllProjects().find((project) => normalizeKey(project.title) === normalized);
  if (existing) {
    return { project: existing, created: false };
  }

  const project = createProject({ title });
  if (!project) {
    throw new Error(`Failed to create import project "${title}".`);
  }

  return { project, created: true };
}

function applyTags(itemType: ItemType, itemId: string, tags: string[]) {
  for (const tagName of [...new Set(tags.map((tag) => tag.toLowerCase()))]) {
    const tag = getOrCreateTag(tagName);
    addTagToItem(itemType, itemId, tag.id);
  }
}

function inferNotionDestinationType(filePath: string, headers: string[]): ImportDestinationType {
  const normalizedHeaders = new Set(headers.map((header) => normalizeHeader(header)));
  const baseName = normalizeKey(path.basename(filePath));
  if (
    baseName.includes('task') ||
    baseName.includes('todo') ||
    (normalizedHeaders.has('status') && (normalizedHeaders.has('due') || normalizedHeaders.has('duedate') || normalizedHeaders.has('priority')))
  ) {
    return 'task';
  }
  return 'note';
}

function buildTodoistPlan(sourcePath: string, sourceLabel: string): ImportPlan {
  const csvPath = findLikelyFile(sourcePath, ['.csv']);
  if (!csvPath) {
    throw new Error('Todoist import expects a CSV file or a zip containing a CSV file.');
  }

  const rows = rowsToObjects(parseCsv(fs.readFileSync(csvPath, 'utf8')));
  const warnings: string[] = [];
  const items: PlannedImportItem[] = [];
  const indentStack = new Map<number, string>();
  let currentSection = '';

  rows.forEach((record, rowIndex) => {
    const type = normalizeHeader(record.TYPE || record.type || 'task');
    const title = safeTrim(record.CONTENT || record.content || record.Title || record.title);

    if (type === 'section') {
      currentSection = title;
      return;
    }

    if ((type === 'note' || type === 'comment') && items.length > 0) {
      const bodySegment = safeTrim(record.CONTENT || record.content || record.DESCRIPTION || record.description);
      if (bodySegment) {
        const lastItem = items[items.length - 1];
        lastItem.body = [lastItem.body, `Imported comment:\n${bodySegment}`].filter(Boolean).join('\n\n');
      }
      return;
    }

    if (!title) return;

    const normalizedPriority = parseTaskPriority(record.PRIORITY || record.priority || '');
    const dueValue = safeTrim(record.DATE || record.date || record['Due date'] || record['Due Date'] || record.due);
    const dueDate = parseDateValue(dueValue).isoDate;
    if (dueValue && !dueDate) {
      warnings.push(`Could not normalize Todoist due date "${dueValue}" for "${title}".`);
    }

    const description = safeTrim(record.DESCRIPTION || record.description);
    const labels = parseTags(record.LABELS || record.labels || record.Labels || '');
    const indentValue = Number.parseInt(record.INDENT || record.indent || '1', 10);
    const indent = Number.isNaN(indentValue) ? 1 : Math.max(indentValue, 1);
    const taskStatus = parseTodoistStatus(record);
    const completedAt = taskStatus === 'done'
      ? parseDateValue(record['Completed at'] || record.completedat || record.completed || '').timestamp
      : undefined;

    const sourceRecordKey = `todoist:${rowIndex + 1}:${hashString([
      title,
      description,
      dueValue,
      record.PRIORITY || record.priority || '',
      labels.join(','),
      currentSection,
    ].join('|')).slice(0, 20)}`;

    const bodyParts = [description];
    if (dueValue && !dueDate) {
      bodyParts.push(`Imported due date: ${dueValue}`);
    }

    const item: PlannedImportItem = {
      sourceRecordKey,
      sourceChecksum: hashString(JSON.stringify(record)),
      sourceLabel: title,
      destinationType: 'task',
      title,
      body: bodyParts.filter(Boolean).join('\n\n') || undefined,
      tags: labels,
      attachmentPlans: [],
      relationPlans: [],
      taskStatus,
      taskPriority: normalizedPriority,
      taskDueDate: dueDate,
      taskContext: currentSection || undefined,
      taskProjectTitle: sourceLabel,
      taskParentSourceKey: indent > 1 ? indentStack.get(indent - 1) : undefined,
      taskCompletedAt: completedAt,
    };

    items.push(item);
    indentStack.set(indent, sourceRecordKey);
    for (const key of [...indentStack.keys()]) {
      if (key > indent) indentStack.delete(key);
    }
  });

  return {
    importType: 'todoist_csv',
    sourcePath,
    sourceLabel,
    items,
    warnings: [...new Set(warnings)],
  };
}

function buildMarkdownFolderPlan(importType: ImportType, sourcePath: string, sourceLabel: string): ImportPlan {
  const root = fs.statSync(sourcePath).isDirectory() ? sourcePath : path.dirname(sourcePath);
  const files = walkFiles(root);
  const fileIndex = buildFileIndex(root);
  const warnings: string[] = [];
  const items: PlannedImportItem[] = [];
  const titleLookup = new Map<string, string>();
  const pathLookup = new Map<string, string>();
  const pendingWikiLinks = new Map<string, string[]>();
  const pendingMarkdownLinks = new Map<string, string[]>();

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension !== '.md' && !(importType === 'notion_export' && extension === '.csv')) {
      continue;
    }

    if (extension === '.csv') {
      const rows = rowsToObjects(parseCsv(fs.readFileSync(filePath, 'utf8')));
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const destinationType = inferNotionDestinationType(filePath, headers);

      rows.forEach((record, rowIndex) => {
        const title = safeTrim(record.Name || record.name || record.Title || record.title || record.Page || record.page)
          || `Untitled row ${rowIndex + 1}`;
        const tags = parseListLikeValue(record.Tags || record.tags || record.Labels || record.labels).map((tag) => tag.toLowerCase());
        const created = parseDateValue(record['Created time'] || record.createdtime || record.Created || record.created || '');
        const updated = parseDateValue(record['Last edited time'] || record.lasteditedtime || record.Updated || record.updated || '');
        const relativePath = path.relative(root, filePath).replaceAll(path.sep, '/');
        const sourceRecordKey = `notion-csv:${relativePath}:row-${rowIndex + 1}`;
        const body = buildBodyFromFields(record, ['Name', 'Title', 'Page', 'Tags', 'Labels', 'Created time', 'Created', 'Last edited time', 'Updated']);

        items.push({
          sourceRecordKey,
          sourceChecksum: hashString(JSON.stringify(record)),
          sourceLabel: title,
          destinationType,
          title,
          body: body || undefined,
          collection: path.dirname(relativePath) === '.' ? cleanImportedTitle(path.basename(filePath)) : path.dirname(relativePath),
          tags,
          attachmentPlans: [],
          relationPlans: [],
          createdAt: created.timestamp,
          updatedAt: updated.timestamp ?? created.timestamp,
          taskStatus: destinationType === 'task'
            ? parseTaskStatus(record.Status || record.status || record.State || record.state || '')
            : undefined,
          taskPriority: destinationType === 'task'
            ? parseTaskPriority(record.Priority || record.priority || '')
            : undefined,
          taskDueDate: destinationType === 'task'
            ? parseDateValue(record.Due || record['Due date'] || record.duedate || '').isoDate
            : undefined,
          taskProjectTitle: destinationType === 'task' ? cleanImportedTitle(path.basename(filePath)) : undefined,
        });
      });

      continue;
    }

    const relativePath = path.relative(root, filePath).replaceAll(path.sep, '/');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { attributes, body } = parseFrontmatter(fileContent);
    const title =
      safeTrim(attributes.title) ||
      extractFirstHeading(body) ||
      cleanImportedTitle(filePath);
    const tags = [
      ...parseListLikeValue(attributes.tags).map((tag) => tag.toLowerCase()),
      ...extractInlineTags(body),
    ];

    const created = parseDateValue(safeTrim(attributes.created) || safeTrim(attributes.createdtime));
    const updated = parseDateValue(safeTrim(attributes.updated) || safeTrim(attributes.lasteditedtime));
    const sourceRecordKey = `${importType}:${relativePath}`;
    const sourceChecksum = hashString(fileContent);
    const currentDirectory = path.dirname(filePath);
    const attachmentPlans: PlannedAttachment[] = [];
    const wikiLinks: string[] = [];
    const markdownLinks: string[] = [];

    for (const match of body.matchAll(/!\[\[([^\]]+)\]\]/g)) {
      const rawTarget = match[1].trim();
      const resolved = resolveAssetPath({
        rawTarget,
        currentDirectory,
        rootPath: root,
        fileIndex,
      });
      if (resolved && path.extname(resolved).toLowerCase() !== '.md') {
        attachmentPlans.push({
          sourcePath: resolved,
          originalName: path.basename(resolved),
        });
      } else {
        wikiLinks.push(rawTarget);
      }
    }

    for (const match of body.matchAll(/(?<!!)\[\[([^\]]+)\]\]/g)) {
      wikiLinks.push(match[1].trim());
    }

    for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const rawTarget = match[1].trim();
      const matchIndex = match.index ?? 0;
      const isEmbed = matchIndex > 0 && body[matchIndex - 1] === '!';
      const resolved = resolveAssetPath({
        rawTarget,
        currentDirectory,
        rootPath: root,
        fileIndex,
      });
      if (resolved && path.extname(resolved).toLowerCase() !== '.md' && isEmbed) {
        attachmentPlans.push({
          sourcePath: resolved,
          originalName: path.basename(resolved),
        });
      } else if (rawTarget.toLowerCase().includes('.md')) {
        markdownLinks.push(rawTarget);
      }
    }

    items.push({
      sourceRecordKey,
      sourceChecksum,
      sourceLabel: title,
      destinationType: 'note',
      title,
      body: body.trim() || undefined,
      collection: path.dirname(relativePath) === '.' ? nullToUndefined(importType === 'obsidian_vault' ? undefined : sourceLabel) : path.dirname(relativePath),
      tags: [...new Set(tags)],
      attachmentPlans: dedupeAttachments(attachmentPlans),
      relationPlans: [],
      createdAt: created.timestamp,
      updatedAt: updated.timestamp ?? created.timestamp,
    });

    titleLookup.set(normalizeKey(title), sourceRecordKey);
    titleLookup.set(normalizeKey(cleanImportedTitle(filePath)), sourceRecordKey);
    pathLookup.set(normalizeKey(relativePath), sourceRecordKey);
    pathLookup.set(normalizeKey(relativePath.replace(/\.md$/i, '')), sourceRecordKey);
    pendingWikiLinks.set(sourceRecordKey, wikiLinks);
    pendingMarkdownLinks.set(sourceRecordKey, markdownLinks);
  }

  for (const item of items) {
    for (const rawTarget of pendingWikiLinks.get(item.sourceRecordKey) ?? []) {
      const normalizedTarget = normalizeKey(rawTarget.split('|')[0].split('#')[0]);
      const targetSourceKey = titleLookup.get(normalizedTarget) || pathLookup.get(normalizedTarget);
      if (targetSourceKey && targetSourceKey !== item.sourceRecordKey) {
        item.relationPlans.push({ targetSourceKey, relationType: 'mentions' });
      } else if (normalizedTarget) {
        warnings.push(`Could not resolve markdown wiki link "${rawTarget}" from "${item.title}".`);
      }
    }

    for (const rawTarget of pendingMarkdownLinks.get(item.sourceRecordKey) ?? []) {
      const normalizedTarget = normalizeKey(rawTarget.split('#')[0]);
      const targetSourceKey = pathLookup.get(normalizedTarget) || titleLookup.get(normalizedTarget);
      if (targetSourceKey && targetSourceKey !== item.sourceRecordKey) {
        item.relationPlans.push({ targetSourceKey, relationType: 'mentions' });
      } else if (normalizedTarget) {
        warnings.push(`Could not resolve markdown link "${rawTarget}" from "${item.title}".`);
      }
    }
  }

  return {
    importType,
    sourcePath,
    sourceLabel,
    items,
    warnings: [...new Set(warnings)],
  };
}

function dedupeAttachments(attachments: PlannedAttachment[]) {
  const seen = new Set<string>();
  return attachments.filter((attachment) => {
    const key = `${attachment.sourcePath}:${attachment.originalName ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

function buildDayOnePlan(sourcePath: string, sourceLabel: string): ImportPlan {
  const jsonPath = findLikelyFile(sourcePath, ['.json']);
  if (!jsonPath) {
    throw new Error('Day One import expects a JSON export file or a zip containing JSON.');
  }

  const rootPath = fs.statSync(sourcePath).isDirectory() ? sourcePath : path.dirname(sourcePath);
  const fileIndex = buildFileIndex(rootPath);
  const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as { entries?: unknown[] } | unknown[];
  const entries = Array.isArray(payload) ? payload : Array.isArray(payload.entries) ? payload.entries : [];
  const warnings: string[] = [];
  const items: PlannedImportItem[] = [];

  for (const rawEntry of entries) {
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry = rawEntry as Record<string, unknown>;
    const text = safeTrim(entry.text) || safeTrim(entry.markdown) || safeTrim(entry.content);
    const title = safeTrim(entry.title) || text.split('\n').find((line) => line.trim())?.trim() || 'Day One Entry';
    const created = parseDateValue(safeTrim(entry.creationDate) || safeTrim(entry.creationdate) || safeTrim(entry.date));
    const updated = parseDateValue(safeTrim(entry.modifiedDate) || safeTrim(entry.modifieddate) || safeTrim(entry.lastUpdated));
    const entryId = safeTrim(entry.uuid) || safeTrim(entry.id) || hashString(`${title}|${text}|${created.timestamp || ''}`).slice(0, 16);
    const attachments: PlannedAttachment[] = [];

    for (const key of ['photos', 'videos', 'audioFiles', 'audiofiles', 'assets']) {
      const list = entry[key];
      if (!Array.isArray(list)) continue;

      for (const asset of list) {
        const assetPath = resolveAssetCandidate(asset, rootPath, fileIndex);
        if (assetPath) {
          attachments.push({
            sourcePath: assetPath,
            originalName: path.basename(assetPath),
          });
        } else {
          warnings.push(`Could not resolve Day One media reference for "${title}".`);
        }
      }
    }

    items.push({
      sourceRecordKey: `dayone:${entryId}`,
      sourceChecksum: hashString(JSON.stringify(entry)),
      sourceLabel: title,
      destinationType: 'journal',
      title,
      body: text || undefined,
      tags: parseListLikeValue(entry.tags).map((tag) => tag.toLowerCase()),
      attachmentPlans: dedupeAttachments(attachments),
      relationPlans: [],
      createdAt: created.timestamp,
      updatedAt: updated.timestamp ?? created.timestamp,
      journalEntryDate: created.isoDate,
      journalEntryTime: created.time,
      journalEntryType: 'daily',
    });
  }

  return {
    importType: 'day_one_json',
    sourcePath,
    sourceLabel,
    items,
    warnings: [...new Set(warnings)],
  };
}

function resolveAssetCandidate(
  asset: unknown,
  rootPath: string,
  fileIndex: Map<string, string[]>
): string | null {
  if (typeof asset === 'string') {
    return resolveAssetPath({
      rawTarget: asset,
      currentDirectory: rootPath,
      rootPath,
      fileIndex,
    });
  }

  if (!asset || typeof asset !== 'object') return null;
  const record = asset as Record<string, unknown>;
  const candidates = [
    safeTrim(record.path),
    safeTrim(record.relativePath),
    safeTrim(record.filePath),
    safeTrim(record.filename),
    safeTrim(record.name),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = resolveAssetPath({
      rawTarget: candidate,
      currentDirectory: rootPath,
      rootPath,
      fileIndex,
    });
    if (resolved) return resolved;
  }

  return null;
}

function buildImportPlan(
  importType: ImportType,
  sourcePath: string,
  sourceLabel = buildSourceLabel(sourcePath),
  displaySourcePath = sourcePath
): ImportPlan {

  switch (importType) {
    case 'todoist_csv':
      return { ...buildTodoistPlan(sourcePath, sourceLabel), sourcePath: displaySourcePath };
    case 'obsidian_vault':
      return { ...buildMarkdownFolderPlan('obsidian_vault', sourcePath, sourceLabel), sourcePath: displaySourcePath };
    case 'notion_export':
      return { ...buildMarkdownFolderPlan('notion_export', sourcePath, sourceLabel), sourcePath: displaySourcePath };
    case 'day_one_json':
      return { ...buildDayOnePlan(sourcePath, sourceLabel), sourcePath: displaySourcePath };
  }
}

function withImportPlan<T>(
  input: { importType: ImportType; sourcePath: string },
  run: (plan: ImportPlan) => T
) {
  if (!fs.existsSync(input.sourcePath)) {
    throw new Error(`Source path does not exist: ${input.sourcePath}`);
  }

  const { workingPath, cleanup } = resolveZipSource(input.sourcePath);
  const sourceLabel = buildSourceLabel(input.sourcePath);

  try {
    return run(buildImportPlan(input.importType, workingPath, sourceLabel, input.sourcePath));
  } finally {
    cleanup();
  }
}

function toPreview(plan: ImportPlan): ImportPreviewResult {
  const existing = getImportedRecordMap(plan.importType, plan.items.map((item) => item.sourceRecordKey));
  const duplicateKeys = new Set(existing.keys());
  const stats = toImportStats(plan.items, duplicateKeys);
  const existingProjects = getExistingProjectTitleSet();
  const resolvedExisting = resolveItemsBatch(
    [...duplicateKeys].flatMap((sourceRecordKey) => {
      const record = existing.get(sourceRecordKey);
      if (!record) return [];
      return [{ type: record.itemType, id: record.itemId }];
    })
  );

  return {
    importType: plan.importType,
    sourcePath: plan.sourcePath,
    sourceLabel: plan.sourceLabel,
    warnings: plan.warnings,
    stats,
    mappingGroups: buildMappingGroups(plan),
    diff: buildDiffSummary(plan, duplicateKeys, existingProjects),
    items: plan.items.slice(0, 30).map((item) => ({
      sourceRecordKey: item.sourceRecordKey,
      sourceLabel: item.sourceLabel,
      destinationType: item.destinationType,
      title: item.title,
      subtitle: formatImportSubtitle(item),
      tags: item.tags,
      attachmentCount: item.attachmentPlans.length,
      attachmentNames: uniqueStrings(
        item.attachmentPlans.map((attachment) => attachment.originalName ?? path.basename(attachment.sourcePath)),
        3
      ),
      relationCount: item.relationPlans.length,
      mappedFields: buildPreviewMappedFields(item),
      autoProjectTitle:
        item.destinationType === 'task' &&
        item.taskProjectTitle &&
        !existingProjects.has(normalizeKey(item.taskProjectTitle))
          ? item.taskProjectTitle
          : undefined,
      duplicate: duplicateKeys.has(item.sourceRecordKey),
      duplicateTarget: (() => {
        const record = existing.get(item.sourceRecordKey);
        if (!record) return undefined;

        const resolved = resolvedExisting.get(`${record.itemType}:${record.itemId}`);
        return {
          itemType: record.itemType,
          itemId: record.itemId,
          title: resolved?.title ?? item.sourceLabel,
          detailUrl: resolved?.detailUrl,
        };
      })(),
    })),
  };
}

function materializePlannedItem(
  item: PlannedImportItem,
  importType: ImportType,
  createdArtifacts: CreatedImportArtifacts
): { itemType: ImportDestinationType; itemId: string; title: string } {
  if (item.destinationType === 'task') {
    const project = item.taskProjectTitle ? ensureProjectByTitle(item.taskProjectTitle) : null;
    if (project?.created && !createdArtifacts.projectIds.includes(project.project.id)) {
      createdArtifacts.projectIds.push(project.project.id);
    }

    const task = createTask({
      title: item.title,
      body: item.body,
      status: item.taskStatus,
      priority: item.taskPriority,
      dueDate: item.taskDueDate,
      context: item.taskContext,
      projectId: project?.project.id,
    });

    if (!task) {
      throw new Error(`Failed to import task "${item.title}".`);
    }

    applyImportedTimestamps('task', task.id, {
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      completedAt: item.taskCompletedAt,
    });
    applyTags('task', task.id, item.tags);
    for (const attachment of item.attachmentPlans) {
      const { link } = attachFilePathToItem({
        itemType: 'task',
        itemId: task.id,
        sourcePath: attachment.sourcePath,
        originalName: attachment.originalName,
        label: attachment.label,
        sourceType: 'import',
        metadata: { importType },
      });
      createdArtifacts.attachmentLinkIds.push(link.id);
    }

    return { itemType: 'task', itemId: task.id, title: item.title };
  }

  if (item.destinationType === 'journal') {
    const entry = createJournalEntry({
      title: item.title,
      body: item.body,
      entryDate: item.journalEntryDate,
      entryTime: item.journalEntryTime,
      entryType: item.journalEntryType || 'daily',
    });

    if (!entry) {
      throw new Error(`Failed to import journal entry "${item.title}".`);
    }

    db.update(journalEntries)
      .set({
        wordCount: wordCount(item.body || ''),
      })
      .where(eq(journalEntries.id, entry.id))
      .run();

    applyImportedTimestamps('journal', entry.id, {
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
    applyTags('journal', entry.id, item.tags);
    for (const attachment of item.attachmentPlans) {
      const { link } = attachFilePathToItem({
        itemType: 'journal',
        itemId: entry.id,
        sourcePath: attachment.sourcePath,
        originalName: attachment.originalName,
        label: attachment.label,
        sourceType: 'import',
        metadata: { importType },
      });
      createdArtifacts.attachmentLinkIds.push(link.id);
    }

    return { itemType: 'journal', itemId: entry.id, title: item.title };
  }

  const note = createNote({
    title: item.title,
    body: item.body,
    collection: item.collection,
  });

  if (!note) {
    throw new Error(`Failed to import note "${item.title}".`);
  }

  applyImportedTimestamps('note', note.id, {
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  });
  applyTags('note', note.id, item.tags);
  for (const attachment of item.attachmentPlans) {
    const { link } = attachFilePathToItem({
      itemType: 'note',
      itemId: note.id,
      sourcePath: attachment.sourcePath,
      originalName: attachment.originalName,
      label: attachment.label,
      sourceType: 'import',
      metadata: { importType },
    });
    createdArtifacts.attachmentLinkIds.push(link.id);
  }

  return { itemType: 'note', itemId: note.id, title: item.title };
}

function recordImportedItem(input: {
  importRunId: string;
  importType: ImportType;
  sourceRecordKey: string;
  sourceChecksum: string;
  sourceLabel: string;
  itemType: ItemType;
  itemId: string;
}) {
  db.insert(importedRecords).values({
    id: newId(),
    importRunId: input.importRunId,
    importType: input.importType,
    sourceRecordKey: input.sourceRecordKey,
    sourceChecksum: input.sourceChecksum,
    sourceLabel: input.sourceLabel,
    itemType: input.itemType,
    itemId: input.itemId,
    createdAt: now(),
  }).run();
}

export function previewImport(input: { importType: ImportType; sourcePath: string }): ImportPreviewResult {
  const runId = createImportRun({
    importType: input.importType,
    sourcePath: input.sourcePath,
    sourceLabel: buildSourceLabel(input.sourcePath),
    mode: 'preview',
  });

  try {
    const preview = withImportPlan(input, (plan) => toPreview(plan));

    finalizeImportRun({
      runId,
      status: 'completed',
      summary: `Prepared ${preview.stats.totalItems} item${preview.stats.totalItems !== 1 ? 's' : ''} for preview.`,
      warnings: preview.warnings,
      stats: preview.stats,
      details: {
        message: `Previewed ${preview.importType} from ${preview.sourceLabel}.`,
        preview: {
          mappingGroups: preview.mappingGroups,
          diff: preview.diff,
        },
      },
    });

    return preview;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown import preview error';
    finalizeImportRun({
      runId,
      status: 'failed',
      summary: 'Preview failed.',
      warnings: [message],
      stats: EMPTY_IMPORT_STATS,
      details: {
        message,
      },
    });
    throw error;
  }
}

export function runImport(input: { importType: ImportType; sourcePath: string }): ImportExecutionResult {
  const runId = createImportRun({
    importType: input.importType,
    sourcePath: input.sourcePath,
    sourceLabel: buildSourceLabel(input.sourcePath),
    mode: 'import',
  });

  try {
    return withImportPlan(input, (plan) => {
      const preview = toPreview(plan);
      const existingMap = getImportedRecordMap(plan.importType, plan.items.map((item) => item.sourceRecordKey));
      const createdItems: Array<{ itemType: ItemType; itemId: string; title: string }> = [];
      const sourceToCreated = new Map<string, { itemType: ItemType; itemId: string }>();
      const createdArtifacts = createArtifactsTracker();

      for (const item of plan.items) {
        const existing = existingMap.get(item.sourceRecordKey);
        if (existing) {
          sourceToCreated.set(item.sourceRecordKey, existing);
          continue;
        }

        const created = materializePlannedItem(item, plan.importType, createdArtifacts);
        createdItems.push(created);
        sourceToCreated.set(item.sourceRecordKey, {
          itemType: created.itemType,
          itemId: created.itemId,
        });

        recordImportedItem({
          importRunId: runId,
          importType: plan.importType,
          sourceRecordKey: item.sourceRecordKey,
          sourceChecksum: item.sourceChecksum,
          sourceLabel: item.sourceLabel,
          itemType: created.itemType,
          itemId: created.itemId,
        });
      }

      for (const item of plan.items) {
        if (item.destinationType !== 'task' || !item.taskParentSourceKey) continue;
        const source = sourceToCreated.get(item.sourceRecordKey);
        const parent = sourceToCreated.get(item.taskParentSourceKey) || existingMap.get(item.taskParentSourceKey);
        if (!source || !parent || source.itemType !== 'task' || parent.itemType !== 'task') continue;

        db.update(tasks)
          .set({ parentTaskId: parent.itemId })
          .where(eq(tasks.id, source.itemId))
          .run();
        reindexSearchItem('task', source.itemId);
      }

      for (const item of plan.items) {
        const source = sourceToCreated.get(item.sourceRecordKey);
        if (!source) continue;

        for (const relation of item.relationPlans) {
          const target = sourceToCreated.get(relation.targetSourceKey) || existingMap.get(relation.targetSourceKey);
          if (!target) continue;

          const existingRelation = db.select().from(relationsTable)
            .where(
              and(
                eq(relationsTable.sourceType, source.itemType),
                eq(relationsTable.sourceId, source.itemId),
                eq(relationsTable.targetType, target.itemType),
                eq(relationsTable.targetId, target.itemId),
                eq(relationsTable.relationType, relation.relationType)
              )
            )
            .get();
          if (existingRelation) continue;

          const createdRelation = createRelation({
            sourceType: source.itemType,
            sourceId: source.itemId,
            targetType: target.itemType,
            targetId: target.itemId,
            relationType: relation.relationType,
          });

          if (createdRelation && !createdArtifacts.relationIds.includes(createdRelation.id)) {
            createdArtifacts.relationIds.push(createdRelation.id);
          }
        }
      }

      const stats = {
        ...preview.stats,
        imported: createdItems.length,
        duplicates: preview.stats.totalItems - createdItems.length,
      };
      const rollback: ImportRollbackSummary =
        createdItems.length > 0
          ? {
              status: 'available',
              summary: 'Rollback is available for the new items and tracked import artifacts from this run.',
              rolledBackAt: null,
              archivedItemCount: 0,
              removedRelationCount: 0,
              removedAttachmentLinkCount: 0,
              archivedAttachmentCount: 0,
              archivedProjectCount: 0,
              skippedProjectTitles: [],
            }
          : {
              status: 'no_changes',
              summary: 'This run only matched existing imported records, so there is nothing new to roll back.',
              rolledBackAt: null,
              archivedItemCount: 0,
              removedRelationCount: 0,
              removedAttachmentLinkCount: 0,
              archivedAttachmentCount: 0,
              archivedProjectCount: 0,
              skippedProjectTitles: [],
            };

      finalizeImportRun({
        runId,
        status: 'completed',
        summary: `Imported ${createdItems.length} new item${createdItems.length !== 1 ? 's' : ''}.`,
        warnings: preview.warnings,
        stats,
        details: {
          message: `Imported ${plan.importType} from ${plan.sourceLabel}.`,
          preview: {
            mappingGroups: preview.mappingGroups,
            diff: preview.diff,
          },
          createdArtifacts,
          rollback,
        },
      });

      return {
        ...preview,
        runId,
        createdItems,
        stats,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown import error';
    finalizeImportRun({
      runId,
      status: 'failed',
      summary: 'Import failed.',
      warnings: [message],
      stats: EMPTY_IMPORT_STATS,
      details: {
        message,
      },
    });
    throw error;
  }
}

function getImportRunRecord(runId: string) {
  return db.select().from(importRuns).where(eq(importRuns.id, runId)).get();
}

function getImportedItemSnapshot(itemType: ItemType, itemId: string) {
  if (itemType === 'task') {
    const row = db.select({
      title: tasks.title,
      archivedAt: tasks.archivedAt,
    }).from(tasks).where(eq(tasks.id, itemId)).get();

    return row ? { title: row.title, archivedAt: row.archivedAt } : null;
  }

  if (itemType === 'note') {
    const row = db.select({
      title: notes.title,
      archivedAt: notes.archivedAt,
    }).from(notes).where(eq(notes.id, itemId)).get();

    return row ? { title: row.title, archivedAt: row.archivedAt } : null;
  }

  const row = db.select({
    title: journalEntries.title,
    entryDate: journalEntries.entryDate,
    archivedAt: journalEntries.archivedAt,
  }).from(journalEntries).where(eq(journalEntries.id, itemId)).get();

  return row
    ? {
        title: row.title || `Journal — ${row.entryDate}`,
        archivedAt: row.archivedAt,
      }
    : null;
}

function archiveImportedItem(itemType: ItemType, itemId: string) {
  const snapshot = getImportedItemSnapshot(itemType, itemId);
  if (!snapshot || snapshot.archivedAt) {
    return {
      title: snapshot?.title ?? itemId,
      archived: false,
    };
  }

  if (itemType === 'task') {
    archiveTask(itemId);
  } else if (itemType === 'note') {
    archiveNote(itemId);
  } else if (itemType === 'journal') {
    archiveJournalEntry(itemId);
  }

  return {
    title: snapshot.title,
    archived: true,
  };
}

function collectAttachmentLinkIdsForRollback(
  importedRows: Array<{ itemType: string; itemId: string }>,
  trackedIds: string[]
) {
  if (trackedIds.length > 0) {
    return [...new Set(trackedIds)];
  }

  const ids = new Set<string>();

  for (const row of importedRows) {
    const links = db.select().from(attachmentLinks)
      .where(and(eq(attachmentLinks.itemType, row.itemType), eq(attachmentLinks.itemId, row.itemId)))
      .all();

    for (const link of links) {
      ids.add(link.id);
    }
  }

  return [...ids];
}

function collectRelationIdsForRollback(
  importedRows: Array<{ itemType: string; itemId: string }>,
  trackedIds: string[]
) {
  if (trackedIds.length > 0) {
    return [...new Set(trackedIds)];
  }

  const ids = new Set<string>();

  for (const row of importedRows) {
    const relations = db.select().from(relationsTable)
      .where(
        or(
          and(eq(relationsTable.sourceType, row.itemType), eq(relationsTable.sourceId, row.itemId)),
          and(eq(relationsTable.targetType, row.itemType), eq(relationsTable.targetId, row.itemId))
        )
      )
      .all();

    for (const relation of relations) {
      ids.add(relation.id);
    }
  }

  return [...ids];
}

function canArchiveAutoCreatedProject(projectId: string) {
  const project = getProject(projectId);
  if (!project || project.archivedAt) {
    return { canArchive: false, title: project?.title ?? projectId };
  }

  const hasActiveTask = db.select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
    .limit(1)
    .get();
  const hasActiveHabit = db.select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.projectId, projectId), isNull(habits.archivedAt)))
    .limit(1)
    .get();
  const hasActiveMilestone = db.select({ id: milestones.id })
    .from(milestones)
    .where(and(eq(milestones.projectId, projectId), isNull(milestones.archivedAt)))
    .limit(1)
    .get();
  const hasAttachment = db.select({ id: attachmentLinks.id })
    .from(attachmentLinks)
    .where(and(eq(attachmentLinks.itemType, 'project'), eq(attachmentLinks.itemId, projectId)))
    .limit(1)
    .get();
  const hasTags = db.select({ id: itemTags.id })
    .from(itemTags)
    .where(and(eq(itemTags.itemType, 'project'), eq(itemTags.itemId, projectId)))
    .limit(1)
    .get();
  const hasRelations = db.select({ id: relationsTable.id })
    .from(relationsTable)
    .where(
      or(
        and(eq(relationsTable.sourceType, 'project'), eq(relationsTable.sourceId, projectId)),
        and(eq(relationsTable.targetType, 'project'), eq(relationsTable.targetId, projectId))
      )
    )
    .limit(1)
    .get();
  const hasMeaningfulMetadata = Boolean(
    project.summary ||
      project.body ||
      project.goalId ||
      project.reviewCadence ||
      project.startDate ||
      project.targetDate ||
      project.endDate ||
      project.health ||
      (project.progress ?? 0) > 0 ||
      project.status !== 'planning'
  );

  return {
    canArchive: !hasActiveTask && !hasActiveHabit && !hasActiveMilestone && !hasAttachment && !hasTags && !hasRelations && !hasMeaningfulMetadata,
    title: project.title,
  };
}

export function rollbackImportRun(runId: string): ImportRollbackSummary {
  const run = getImportRunRecord(runId);
  if (!run) {
    throw new Error('Import run not found.');
  }
  if (run.mode !== 'import') {
    throw new Error('Only completed import runs can be rolled back.');
  }
  if (run.status !== 'completed') {
    throw new Error('This import run has not completed successfully.');
  }

  const existingDetails = parseImportRunDetails(run.details);
  if (existingDetails?.rollback?.status === 'rolled_back') {
    return existingDetails.rollback;
  }

  const importedRows = db.select().from(importedRecords)
    .where(eq(importedRecords.importRunId, runId))
    .all();

  if (importedRows.length === 0) {
    const rollback: ImportRollbackSummary = existingDetails?.rollback?.status === 'no_changes'
      ? existingDetails.rollback
      : {
          status: 'no_changes',
          summary: 'This run has no imported records left to roll back.',
          rolledBackAt: null,
          archivedItemCount: 0,
          removedRelationCount: 0,
          removedAttachmentLinkCount: 0,
          archivedAttachmentCount: 0,
          archivedProjectCount: 0,
          skippedProjectTitles: [],
        };

    db.update(importRuns)
      .set({
        details: serializeImportRunDetails({
          message:
            existingDetails?.message ||
            run.summary ||
            `Imported ${run.importType} from ${run.sourceLabel ?? run.sourcePath}.`,
          preview: existingDetails?.preview,
          createdArtifacts: existingDetails?.createdArtifacts,
          rollback,
        }),
      })
      .where(eq(importRuns.id, runId))
      .run();

    return rollback;
  }

  const relationIds = collectRelationIdsForRollback(importedRows, existingDetails?.createdArtifacts?.relationIds ?? []);
  const attachmentLinkIds = collectAttachmentLinkIdsForRollback(
    importedRows,
    existingDetails?.createdArtifacts?.attachmentLinkIds ?? []
  );
  const attachmentIds = new Set<string>();

  let removedRelationCount = 0;
  for (const relationId of relationIds) {
    const relation = db.select({ id: relationsTable.id }).from(relationsTable).where(eq(relationsTable.id, relationId)).get();
    if (!relation) continue;
    removeRelation(relationId);
    removedRelationCount += 1;
  }

  let removedAttachmentLinkCount = 0;
  for (const linkId of attachmentLinkIds) {
    const link = db.select().from(attachmentLinks).where(eq(attachmentLinks.id, linkId)).get();
    if (!link) continue;
    attachmentIds.add(link.attachmentId);
    removeAttachmentLink(linkId);
    removedAttachmentLinkCount += 1;
  }

  let archivedAttachmentCount = 0;
  for (const attachmentId of attachmentIds) {
    if (archiveAttachmentIfUnused(attachmentId)) {
      archivedAttachmentCount += 1;
    }
  }

  let archivedItemCount = 0;
  for (const imported of importedRows) {
    const result = archiveImportedItem(imported.itemType as ItemType, imported.itemId);
    if (result.archived) {
      archivedItemCount += 1;
    }
  }

  let archivedProjectCount = 0;
  const skippedProjectTitles: string[] = [];
  for (const projectId of [...new Set(existingDetails?.createdArtifacts?.projectIds ?? [])]) {
    const projectState = canArchiveAutoCreatedProject(projectId);
    if (!projectState.canArchive) {
      skippedProjectTitles.push(projectState.title);
      continue;
    }

    archiveProject(projectId);
    archivedProjectCount += 1;
  }

  db.delete(importedRecords)
    .where(eq(importedRecords.importRunId, runId))
    .run();

  const rolledBackAt = now();
  const rollback: ImportRollbackSummary = {
    status: 'rolled_back',
    summary: `Rolled back ${archivedItemCount} imported item${archivedItemCount !== 1 ? 's' : ''} and cleaned up tracked import artifacts.`,
    rolledBackAt,
    archivedItemCount,
    removedRelationCount,
    removedAttachmentLinkCount,
    archivedAttachmentCount,
    archivedProjectCount,
    skippedProjectTitles: uniqueStrings(skippedProjectTitles),
  };

  db.update(importRuns)
    .set({
      details: serializeImportRunDetails({
        message:
          existingDetails?.message ||
          run.summary ||
          `Imported ${run.importType} from ${run.sourceLabel ?? run.sourcePath}.`,
        preview: existingDetails?.preview,
        createdArtifacts: existingDetails?.createdArtifacts ?? {
          relationIds,
          attachmentLinkIds,
          projectIds: [],
        },
        rollback,
      }),
    })
    .where(eq(importRuns.id, runId))
    .run();

  return rollback;
}

export function getRecentImportRuns(limit = 15): ImportRunSummary[] {
  return db.select().from(importRuns)
    .orderBy(desc(importRuns.createdAt))
    .limit(limit)
    .all()
    .map((run) => ({
      ...run,
      importType: run.importType as ImportType,
      mode: run.mode as 'preview' | 'import',
      status: run.status as ImportRunStatus,
      warnings: parseJsonArray(run.warnings),
      stats: parseJsonObject<ImportPreviewStats>(run.stats),
      details: parseImportRunDetails(run.details),
    }));
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
