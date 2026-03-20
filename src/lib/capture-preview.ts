import { z } from 'zod';
import type {
  CaptureParseResult,
  CaptureSuggestedType,
  EntityType,
  MetricType,
  TaskPriority,
} from './types';

const CAPTURE_SUGGESTED_TYPES = ['task', 'note', 'idea', 'journal', 'metric', 'entity', 'inbox'] as const;
const TASK_PRIORITIES = ['p1', 'p2', 'p3', 'p4'] as const;
const ENTITY_TYPES = ['person', 'book', 'article', 'course', 'place', 'symptom', 'routine', 'tool', 'medication', 'topic'] as const;
const METRIC_TYPES = ['sleep', 'mood', 'energy', 'workout', 'symptom', 'expense', 'focus_session', 'body_metric', 'custom'] as const;
const TASK_VERB_RE = /^(buy|call|email|fix|plan|pay|review|schedule|send|update|write|book|prepare|follow up)\b/i;

export interface CaptureProjectOption {
  id: string;
  title: string;
}

export interface BuildCapturePreviewOptions {
  baseDate?: Date;
  projects?: CaptureProjectOption[];
  projectResolution?: 'resolve' | 'defer';
}

export const capturePreviewSchema = z.object({
  rawText: z.string(),
  suggestedType: z.enum(CAPTURE_SUGGESTED_TYPES),
  title: z.string(),
  body: z.string().optional(),
  tags: z.array(z.string()),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  projectId: z.string().optional(),
  projectLabel: z.string().optional(),
  metricType: z.enum(METRIC_TYPES).optional(),
  metricValue: z.number().finite().optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  directCreateSupported: z.boolean(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});

export function buildCapturePreview(
  rawText: string,
  options: BuildCapturePreviewOptions = {}
): CaptureParseResult {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return capturePreviewSchema.parse({
      rawText: '',
      suggestedType: 'inbox',
      title: '',
      tags: [],
      directCreateSupported: false,
      confidence: 0,
      warnings: [],
    });
  }

  const warnings: string[] = [];
  let working = trimmed;
  let suggestedType: CaptureSuggestedType = 'inbox';
  let entityType: EntityType | undefined;
  let confidence = 0.3;

  const explicitPrefixes: Array<{
    pattern: RegExp;
    type: CaptureSuggestedType;
    entityType?: EntityType;
    confidence: number;
  }> = [
    { pattern: /^(task:|todo:|do:)\s*/i, type: 'task', confidence: 0.96 },
    { pattern: /^(note:|note\s+-)\s*/i, type: 'note', confidence: 0.95 },
    { pattern: /^(idea:|idea\s+-)\s*/i, type: 'idea', confidence: 0.95 },
    { pattern: /^(journal:|j:|reflect:)\s*/i, type: 'journal', confidence: 0.95 },
    { pattern: /^(person:|people:)\s*/i, type: 'entity', entityType: 'person', confidence: 0.97 },
    { pattern: /^(book:|reading:)\s*/i, type: 'entity', entityType: 'book', confidence: 0.97 },
    { pattern: /^(article:)\s*/i, type: 'entity', entityType: 'article', confidence: 0.97 },
    { pattern: /^(course:)\s*/i, type: 'entity', entityType: 'course', confidence: 0.97 },
  ];

  for (const prefix of explicitPrefixes) {
    if (prefix.pattern.test(working)) {
      working = working.replace(prefix.pattern, '').trim();
      suggestedType = prefix.type;
      entityType = prefix.entityType;
      confidence = prefix.confidence;
      break;
    }
  }

  const { tags, text: withoutTags } = extractTags(working);
  working = withoutTags;

  const metricGuess = parseMetricPayload(working);
  if (suggestedType === 'inbox' && metricGuess) {
    suggestedType = 'metric';
    confidence = 0.9;
  } else if (suggestedType === 'inbox' && TASK_VERB_RE.test(working)) {
    suggestedType = 'task';
    confidence = 0.72;
  }

  let priority: TaskPriority | undefined;
  let dueDate: string | undefined;
  let projectId: string | undefined;
  let projectLabel: string | undefined;

  if (suggestedType === 'task') {
    const priorityResult = extractPriority(working);
    priority = priorityResult.priority;
    working = priorityResult.text;

    const dateResult = extractDueDate(working, options.baseDate);
    dueDate = dateResult.dueDate;
    working = dateResult.text;

    const projectResult = resolveProjectReference(working, options);
    projectId = projectResult.projectId;
    projectLabel = projectResult.projectLabel;
    working = projectResult.text;
    warnings.push(...projectResult.warnings);
  }

  let title = '';
  let body: string | undefined;
  let metricType: MetricType | undefined;
  let metricValue: number | undefined;

  if (suggestedType === 'metric') {
    metricType = metricGuess?.metricType;
    metricValue = metricGuess?.metricValue;
    body = metricGuess?.note;
    title = metricType && metricValue !== undefined
      ? `${metricType} ${metricValue}`
      : cleanText(working);
  } else if (suggestedType === 'journal') {
    const split = splitCaptureContent(working);
    title = split.right ? split.left : '';
    body = split.right ?? cleanText(working);
  } else {
    const split = splitCaptureContent(working);
    title = cleanText(split.left || working);
    body = split.right;
  }

  if (suggestedType === 'entity' && !entityType) {
    warnings.push('Entity captures need a type such as person:, book:, article:, or course:.');
  }

  return capturePreviewSchema.parse({
    rawText: trimmed,
    suggestedType,
    title,
    body,
    tags,
    priority,
    dueDate,
    scheduledDate: undefined,
    projectId,
    projectLabel,
    metricType,
    metricValue,
    entityType,
    directCreateSupported: getDirectCreateSupport({
      suggestedType,
      title,
      body,
      metricType,
      metricValue,
      entityType,
    }),
    confidence,
    warnings,
  });
}

export function mergeCapturePreviews(
  preservedPreview: CaptureParseResult,
  resolvedPreview: CaptureParseResult
): CaptureParseResult {
  const suggestedType = preservedPreview.suggestedType !== 'inbox'
    ? preservedPreview.suggestedType
    : resolvedPreview.suggestedType;
  const title = preservedPreview.title || resolvedPreview.title;
  const body = preservedPreview.body ?? resolvedPreview.body;
  const metricType = preservedPreview.metricType ?? resolvedPreview.metricType;
  const metricValue = preservedPreview.metricValue ?? resolvedPreview.metricValue;
  const entityType = preservedPreview.entityType ?? resolvedPreview.entityType;
  const resolvedProjectId = preservedPreview.projectId ?? resolvedPreview.projectId;
  const resolvedProjectLabel = preservedPreview.projectId
    ? preservedPreview.projectLabel ?? resolvedPreview.projectLabel
    : resolvedPreview.projectId
      ? resolvedPreview.projectLabel ?? preservedPreview.projectLabel
      : preservedPreview.projectLabel ?? resolvedPreview.projectLabel;

  return capturePreviewSchema.parse({
    rawText: resolvedPreview.rawText,
    suggestedType,
    title,
    body,
    tags: [...new Set([...preservedPreview.tags, ...resolvedPreview.tags])],
    priority: preservedPreview.priority ?? resolvedPreview.priority,
    dueDate: preservedPreview.dueDate ?? resolvedPreview.dueDate,
    scheduledDate: preservedPreview.scheduledDate ?? resolvedPreview.scheduledDate,
    projectId: resolvedProjectId,
    projectLabel: resolvedProjectLabel,
    metricType,
    metricValue,
    entityType,
    directCreateSupported: getDirectCreateSupport({
      suggestedType,
      title,
      body,
      metricType,
      metricValue,
      entityType,
    }),
    confidence: Math.max(preservedPreview.confidence, resolvedPreview.confidence),
    warnings: [...new Set([...preservedPreview.warnings, ...resolvedPreview.warnings])],
  });
}

export function getDirectCreateSupport(input: {
  suggestedType: CaptureSuggestedType;
  title: string;
  body?: string;
  metricType?: MetricType;
  metricValue?: number;
  entityType?: EntityType;
}) {
  switch (input.suggestedType) {
    case 'task':
    case 'note':
    case 'idea':
      return input.title.length > 0;
    case 'journal':
      return Boolean(input.body || input.title);
    case 'metric':
      return Boolean(input.metricType) && input.metricValue !== undefined;
    case 'entity':
      return Boolean(input.entityType) && input.title.length > 0;
    default:
      return false;
  }
}

function extractTags(text: string) {
  const tags: string[] = [];
  const nextText = text.replace(/(^|\s)#([a-z0-9][a-z0-9-]*)/gi, (match, prefix: string, tag: string) => {
    tags.push(tag.toLowerCase());
    return prefix;
  });

  return { tags: [...new Set(tags)], text: cleanText(nextText) };
}

function extractPriority(text: string) {
  const match = text.match(/\bp([1-4])\b/i);
  if (!match) return { priority: undefined, text };

  return {
    priority: `p${match[1]}` as TaskPriority,
    text: cleanText(text.replace(match[0], ' ')),
  };
}

function extractDueDate(text: string, baseDate: Date = new Date()) {
  const matchers: Array<{
    pattern: RegExp;
    toDate: (match: RegExpMatchArray) => string;
  }> = [
    {
      pattern: /\btomorrow\b/i,
      toDate: () => offsetDate(1, baseDate),
    },
    {
      pattern: /\btoday\b/i,
      toDate: () => offsetDate(0, baseDate),
    },
    {
      pattern: /\bnext week\b/i,
      toDate: () => offsetDate(7, baseDate),
    },
    {
      pattern: /\b(\d{4}-\d{2}-\d{2})\b/,
      toDate: (match) => match[1],
    },
  ];

  for (const matcher of matchers) {
    const match = text.match(matcher.pattern);
    if (match) {
      return {
        dueDate: matcher.toDate(match),
        text: cleanText(text.replace(matcher.pattern, ' ')),
      };
    }
  }

  return { dueDate: undefined, text };
}

function resolveProjectReference(text: string, options: BuildCapturePreviewOptions) {
  const match = text.match(/(?:^|\s)(?:\+|project:)([a-z0-9][a-z0-9-]*)\b/i);
  if (!match) {
    return { projectId: undefined, projectLabel: undefined, text, warnings: [] as string[] };
  }

  const query = match[1];
  const normalizedQuery = normalizeProjectKey(query);
  const cleanedText = cleanText(text.replace(match[0], ' '));
  const projects = options.projects ?? [];

  if (projects.length > 0) {
    const exact = projects.find((project) => normalizeProjectKey(project.title) === normalizedQuery);
    if (exact) {
      return {
        projectId: exact.id,
        projectLabel: exact.title,
        text: cleanedText,
        warnings: [] as string[],
      };
    }

    return {
      projectId: undefined,
      projectLabel: query,
      text: cleanedText,
      warnings: [`No project matched "${query}".`],
    };
  }

  if (options.projectResolution === 'defer') {
    return {
      projectId: undefined,
      projectLabel: query,
      text: cleanedText,
      warnings: [] as string[],
    };
  }

  return {
    projectId: undefined,
    projectLabel: query,
    text: cleanedText,
    warnings: [`No project matched "${query}".`],
  };
}

function parseMetricPayload(text: string): {
  metricType: MetricType;
  metricValue: number;
  note?: string;
} | null {
  const patterns: Array<{ metricType: MetricType; pattern: RegExp }> = [
    { metricType: 'sleep', pattern: /^sleep:?[\s]+([\d.]+)\b(?:\s+(.*))?$/i },
    { metricType: 'mood', pattern: /^mood:?[\s]+([\d.]+)\b(?:\s+(.*))?$/i },
    { metricType: 'energy', pattern: /^energy:?[\s]+([\d.]+)\b(?:\s+(.*))?$/i },
    { metricType: 'workout', pattern: /^(?:workout|exercise|gym|ran):?[\s]+([\d.]+)\b(?:\s+(.*))?$/i },
    { metricType: 'expense', pattern: /^(?:expense|spent|paid|bought):?[\s]+\$?([\d.]+)\b(?:\s+(.*))?$/i },
  ];

  for (const entry of patterns) {
    const match = text.match(entry.pattern);
    if (!match) continue;

    const value = Number(match[1]);
    if (!Number.isFinite(value)) return null;

    return {
      metricType: entry.metricType,
      metricValue: value,
      note: cleanText(match[2] || '') || undefined,
    };
  }

  return null;
}

function splitCaptureContent(text: string) {
  const separators = [' -- ', ' | '];

  for (const separator of separators) {
    const index = text.indexOf(separator);
    if (index >= 0) {
      return {
        left: cleanText(text.slice(0, index)),
        right: cleanText(text.slice(index + separator.length)) || undefined,
      };
    }
  }

  return { left: cleanText(text), right: undefined };
}

function cleanText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeProjectKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function offsetDate(days: number, baseDate: Date) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
