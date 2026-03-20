import { z } from 'zod';
import { buildCapturePreview as buildSharedCapturePreview, mergeCapturePreviews } from '@/lib/capture-preview';
import type { CaptureParseResult, EntityType, ItemType, MetricType } from '@/lib/types';
import { createEntity } from './entities';
import { awardEntityXP, awardIdeaXP, awardJournalXP, awardMetricLogXP } from './gamification';
import { createIdea } from './ideas';
import { captureToInbox } from './inbox';
import { createJournalEntry } from './journal';
import { createMetric } from './metrics';
import { createNote } from './notes';
import { getAllProjects } from './projects';
import { addTagToItem, getOrCreateTag } from './tags';
import { createTask } from './tasks';

const MATERIALIZE_OVERRIDES = ['suggested', 'task', 'note', 'idea', 'journal', 'inbox'] as const;
const materializeOverrideSchema = z.enum(MATERIALIZE_OVERRIDES);

export type CaptureMaterializeOverride = z.infer<typeof materializeOverrideSchema>;

export interface MaterializeCaptureResult {
  createdItemType: ItemType;
  createdId: string;
  redirectPath: string;
}

export type CaptureSubmitResult =
  | {
      outcome: 'created';
      preview: CaptureParseResult;
      createdItemType: ItemType;
      createdId: string;
      redirectPath: string;
    }
  | {
      outcome: 'inbox';
      preview: CaptureParseResult;
      inboxId: string;
    };

export function buildCapturePreview(rawText: string): CaptureParseResult {
  return buildSharedCapturePreview(rawText, {
    projects: getAllProjects().map((project) => ({ id: project.id, title: project.title })),
    projectResolution: 'resolve',
  });
}

export function resolveCapturePreview(
  rawText: string,
  preservedPreview?: CaptureParseResult | null
): CaptureParseResult {
  const resolvedPreview = buildCapturePreview(rawText);
  if (!preservedPreview) return resolvedPreview;
  return mergeCapturePreviews(preservedPreview, resolvedPreview);
}

export function submitCapture(
  rawText: string,
  mode: 'smart' | 'inbox' = 'smart',
  preservedPreview?: CaptureParseResult | null
): CaptureSubmitResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Text is required');
  }

  const preview = resolveCapturePreview(trimmed, preservedPreview);

  if (mode === 'inbox' || !preview.directCreateSupported) {
    const result = captureToInbox(trimmed, preview);
    return {
      outcome: 'inbox',
      preview,
      inboxId: result.id,
    };
  }

  const materialized = materializeCapturePreview(preview, 'suggested', 'manual');
  finalizeMaterializedCapture({
    createdItemType: materialized.createdItemType,
    createdId: materialized.createdId,
    metricType: preview.metricType,
    entityType: preview.entityType,
    journalWordCount: getJournalWordCountFromPreview(preview.title, preview.body),
  });

  return {
    outcome: 'created',
    preview,
    createdItemType: materialized.createdItemType,
    createdId: materialized.createdId,
    redirectPath: materialized.redirectPath,
  };
}

export function materializeCapturePreview(
  preview: CaptureParseResult,
  override: CaptureMaterializeOverride = 'suggested',
  source: 'manual' | 'inbox' = 'manual'
): MaterializeCaptureResult {
  const mode = materializeOverrideSchema.parse(override);
  const targetType = mode === 'suggested' ? preview.suggestedType : mode;

  switch (targetType) {
    case 'task': {
      const task = createTask({
        title: preview.title || preview.rawText,
        body: preview.body,
        priority: preview.priority,
        dueDate: preview.dueDate,
        scheduledDate: preview.scheduledDate,
        projectId: preview.projectId,
        source,
      });

      if (!task) throw new Error('Unable to create task from capture.');
      applyTags('task', task.id, preview.tags);
      return {
        createdItemType: 'task',
        createdId: task.id,
        redirectPath: `/tasks/${task.id}`,
      };
    }

    case 'note': {
      const note = createNote({
        title: preview.title || preview.rawText,
        body: preview.body,
      });

      if (!note) throw new Error('Unable to create note from capture.');
      applyTags('note', note.id, preview.tags);
      return {
        createdItemType: 'note',
        createdId: note.id,
        redirectPath: `/notes/${note.id}`,
      };
    }

    case 'idea': {
      const idea = createIdea({
        title: preview.title || preview.rawText,
        summary: preview.body,
      });

      if (!idea) throw new Error('Unable to create idea from capture.');
      applyTags('idea', idea.id, preview.tags);
      return {
        createdItemType: 'idea',
        createdId: idea.id,
        redirectPath: `/ideas/${idea.id}`,
      };
    }

    case 'journal': {
      const entryBody = preview.body || preview.title || preview.rawText;
      const entry = createJournalEntry({
        title: preview.body ? preview.title || undefined : undefined,
        body: entryBody,
      });

      if (!entry) throw new Error('Unable to create journal entry from capture.');
      applyTags('journal', entry.id, preview.tags);
      return {
        createdItemType: 'journal',
        createdId: entry.id,
        redirectPath: `/journal/${entry.id}`,
      };
    }

    case 'metric': {
      if (!preview.metricType || preview.metricValue === undefined) {
        throw new Error('Metric captures require a metric type and value.');
      }

      const metric = createMetric({
        metricType: preview.metricType,
        valueNumeric: preview.metricValue,
        note: preview.body,
        unit: defaultMetricUnit(preview.metricType),
      });

      if (!metric) throw new Error('Unable to create metric from capture.');
      return {
        createdItemType: 'metric',
        createdId: metric.id,
        redirectPath: `/metrics/${metric.id}`,
      };
    }

    case 'entity': {
      if (!preview.entityType || !preview.title) {
        throw new Error('Entity captures require both a title and an entity type.');
      }

      const entity = createEntity({
        title: preview.title,
        entityType: preview.entityType,
        body: preview.body,
      });

      if (!entity) throw new Error('Unable to create entity from capture.');
      applyTags('entity', entity.id, preview.tags);
      return {
        createdItemType: 'entity',
        createdId: entity.id,
        redirectPath: preview.entityType === 'person' ? `/people/${entity.id}` : `/learning/${entity.id}`,
      };
    }

    default:
      throw new Error('This capture should be kept in the inbox.');
  }
}

export function finalizeMaterializedCapture(params: {
  createdItemType: ItemType;
  createdId: string;
  metricType?: MetricType;
  entityType?: EntityType;
  journalWordCount?: number;
}) {
  if (params.createdItemType === 'journal') {
    awardJournalXP(params.createdId, params.journalWordCount ?? 0);
    return;
  }

  if (params.createdItemType === 'metric' && params.metricType) {
    awardMetricLogXP(params.createdId, params.metricType);
    return;
  }

  if (params.createdItemType === 'idea') {
    awardIdeaXP(params.createdId);
    return;
  }

  if (params.createdItemType === 'entity' && params.entityType) {
    awardEntityXP(params.createdId, params.entityType);
  }
}

export function getJournalWordCountFromPreview(title: string, body?: string) {
  const text = [title, body].filter(Boolean).join(' ').trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function applyTags(itemType: ItemType, itemId: string, tags: string[]) {
  for (const tagName of tags) {
    const tag = getOrCreateTag(tagName);
    addTagToItem(itemType, itemId, tag.id);
  }
}

function defaultMetricUnit(metricType: MetricType) {
  switch (metricType) {
    case 'sleep':
      return 'hours';
    case 'mood':
    case 'energy':
      return 'score';
    case 'workout':
      return 'minutes';
    default:
      return undefined;
  }
}
