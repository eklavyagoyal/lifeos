import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { itemTags, tags } from '../db/schema';
import type { ConnectionItem, ConnectionRelation, ConnectionSuggestion, ItemType } from '@/lib/types';
import { getSharedAttachmentReferencesForItem } from './attachment-queries';
import { getStructuralEdges, resolveItem, resolveItemsBatch } from './graph-helpers';
import { getRelationsForItem } from './relations';
import { searchItems } from './search';

function isNonNullable<T>(value: T | null): value is T {
  return value !== null;
}

const CONNECTION_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'before',
  'by',
  'daily',
  'entry',
  'event',
  'for',
  'from',
  'goal',
  'habit',
  'idea',
  'in',
  'into',
  'journal',
  'meeting',
  'metric',
  'monthly',
  'note',
  'of',
  'on',
  'or',
  'project',
  'review',
  'task',
  'the',
  'to',
  'weekly',
  'with',
  'yearly',
]);

function prettifyRelationLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function normalizeSnippet(snippet: string): string {
  return snippet
    .replaceAll('<mark>', '')
    .replaceAll('</mark>', '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildExcludedKeys(
  itemType: ItemType,
  itemId: string,
  structuralConnections = getStructuralConnectionsForItem(itemType, itemId)
) {
  const explicitRelations = getRelationsForItem(itemType, itemId);

  return new Set<string>([
    `${itemType}:${itemId}`,
    ...explicitRelations.flatMap((relation) => [
      `${relation.sourceType}:${relation.sourceId}`,
      `${relation.targetType}:${relation.targetId}`,
    ]),
    ...structuralConnections.map((connection) => `${connection.type}:${connection.id}`),
  ]);
}

function buildMentionQuery(title: string): string | null {
  const significantTokens = [...new Set(
    tokenize(title).filter((token) => token.length >= 3 && !CONNECTION_STOP_WORDS.has(token))
  )];

  if (significantTokens.length === 0) return null;
  return significantTokens.slice(0, 4).join(' ');
}

export function getResolvedRelationsForItem(itemType: ItemType, itemId: string): ConnectionItem[] {
  const relations = getRelationsForItem(itemType, itemId);

  if (relations.length === 0) return [];

  const relatedRefs = relations.map((relation) => {
    const isSource = relation.sourceType === itemType && relation.sourceId === itemId;
    return {
      relation,
      direction: isSource ? 'outgoing' as const : 'incoming' as const,
      type: (isSource ? relation.targetType : relation.sourceType) as ItemType,
      id: isSource ? relation.targetId : relation.sourceId,
    };
  });

  const resolved = resolveItemsBatch(relatedRefs.map((item) => ({ type: item.type, id: item.id })));

  return relatedRefs
    .map((item) => {
      const related = resolved.get(`${item.type}:${item.id}`);
      if (!related) return null;

      return {
        relation: item.relation as ConnectionRelation,
        type: item.type,
        id: item.id,
        title: related.title,
        subtitle: related.subtitle,
        detailUrl: related.detailUrl,
        direction: item.direction,
        relationLabel: prettifyRelationLabel(item.relation.relationType),
      };
    })
    .filter(isNonNullable);
}

export function getStructuralConnectionsForItem(itemType: ItemType, itemId: string): ConnectionItem[] {
  const structuralEdges = getStructuralEdges().filter(
    (edge) =>
      (edge.sourceType === itemType && edge.sourceId === itemId) ||
      (edge.targetType === itemType && edge.targetId === itemId)
  );

  const refs = structuralEdges.map((edge) => {
    const isSource = edge.sourceType === itemType && edge.sourceId === itemId;
    return {
      direction: 'structural' as const,
      relationLabel: edge.label,
      type: (isSource ? edge.targetType : edge.sourceType) as ItemType,
      id: isSource ? edge.targetId : edge.sourceId,
    };
  });

  const sharedAttachmentRefs = getSharedAttachmentReferencesForItem(itemType, itemId).map((item) => ({
    direction: 'structural' as const,
    relationLabel: item.sharedCount === 1
      ? `shared ${item.attachmentNames[0]}`
      : `shared files (${item.sharedCount})`,
    type: item.type,
      id: item.id,
    }));
  const allRefs = [...refs, ...sharedAttachmentRefs];

  if (allRefs.length === 0) return [];

  const resolved = resolveItemsBatch(allRefs.map((item) => ({ type: item.type, id: item.id })));
  const seen = new Set<string>();

  return allRefs
    .map((item) => {
      const related = resolved.get(`${item.type}:${item.id}`);
      if (!related) return null;

      const key = `${item.type}:${item.id}:${item.relationLabel}`;
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        type: item.type,
        id: item.id,
        title: related.title,
        subtitle: related.subtitle,
        detailUrl: related.detailUrl,
        direction: item.direction,
        relationLabel: item.relationLabel,
      };
    })
    .filter(isNonNullable);
}

export function getSharedTagSuggestionsForItem(
  itemType: ItemType,
  itemId: string,
  limit = 6
): ConnectionSuggestion[] {
  const currentTags = db.select({
    tagId: itemTags.tagId,
    tagName: tags.name,
  })
    .from(itemTags)
    .innerJoin(tags, eq(itemTags.tagId, tags.id))
    .where(and(eq(itemTags.itemType, itemType), eq(itemTags.itemId, itemId)))
    .all();

  if (currentTags.length === 0) return [];

  const currentTagIds = currentTags.map((tag) => tag.tagId);
  const currentTagNames = new Map(currentTags.map((tag) => [tag.tagId, tag.tagName]));
  const structuralConnections = getStructuralConnectionsForItem(itemType, itemId);
  const excludedKeys = buildExcludedKeys(itemType, itemId, structuralConnections);

  const candidateRows = db.select()
    .from(itemTags)
    .where(inArray(itemTags.tagId, currentTagIds))
    .all()
    .filter((row) => !(row.itemType === itemType && row.itemId === itemId));

  const candidates = new Map<string, { type: ItemType; id: string; sharedTags: Set<string> }>();

  for (const row of candidateRows) {
    const key = `${row.itemType}:${row.itemId}`;
    if (excludedKeys.has(key)) continue;

    const entry = candidates.get(key) ?? {
      type: row.itemType as ItemType,
      id: row.itemId,
      sharedTags: new Set<string>(),
    };
    const tagName = currentTagNames.get(row.tagId);
    if (tagName) {
      entry.sharedTags.add(tagName);
    }
    candidates.set(key, entry);
  }

  const ranked = [...candidates.values()]
    .sort((a, b) => {
      const diff = b.sharedTags.size - a.sharedTags.size;
      if (diff !== 0) return diff;
      return `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`);
    })
    .slice(0, limit);

  const resolved = resolveItemsBatch(ranked.map((item) => ({ type: item.type, id: item.id })));

  return ranked
    .map((item) => {
      const related = resolved.get(`${item.type}:${item.id}`);
      if (!related) return null;

      return {
        type: item.type,
        id: item.id,
        title: related.title,
        subtitle: related.subtitle,
        detailUrl: related.detailUrl,
        sharedTags: [...item.sharedTags].sort(),
        reason: 'shared_tags' as const,
      };
    })
    .filter(isNonNullable);
}

export function getMentionSuggestionsForItem(
  itemType: ItemType,
  itemId: string,
  limit = 6
): ConnectionSuggestion[] {
  const currentItem = resolveItem(itemType, itemId);
  if (!currentItem) return [];

  const mentionQuery = buildMentionQuery(currentItem.title);
  if (!mentionQuery) return [];

  const structuralConnections = getStructuralConnectionsForItem(itemType, itemId);
  const excludedKeys = buildExcludedKeys(itemType, itemId, structuralConnections);
  const titleTokens = [...new Set(
    tokenize(currentItem.title).filter((token) => token.length >= 3 && !CONNECTION_STOP_WORDS.has(token))
  )];
  const requiredOverlap = titleTokens.length >= 3 ? 2 : 1;

  return searchItems(mentionQuery, undefined, limit * 4)
    .filter((result) => !excludedKeys.has(`${result.itemType}:${result.itemId}`))
    .map((result) => {
      const normalizedSnippet = normalizeSnippet(result.snippet);
      const candidateText = `${result.title} ${result.subtitle ?? ''} ${normalizedSnippet}`.toLowerCase();
      const overlap = titleTokens.filter((token) => candidateText.includes(token)).length;
      if (overlap < requiredOverlap) return null;

      return {
        type: result.itemType,
        id: result.itemId,
        title: result.title,
        subtitle: result.subtitle,
        detailUrl: result.detailUrl,
        sharedTags: [],
        reason: 'mentions' as const,
        snippet: normalizedSnippet,
      };
    })
    .filter(isNonNullable)
    .slice(0, limit);
}

export function getConnectionSuggestionsForItem(
  itemType: ItemType,
  itemId: string,
  limit = 6
): ConnectionSuggestion[] {
  const suggestions = new Map<string, ConnectionSuggestion>();

  for (const suggestion of getSharedTagSuggestionsForItem(itemType, itemId, limit)) {
    suggestions.set(`${suggestion.type}:${suggestion.id}`, suggestion);
  }

  for (const suggestion of getMentionSuggestionsForItem(itemType, itemId, limit)) {
    const key = `${suggestion.type}:${suggestion.id}`;
    const existing = suggestions.get(key);
    if (!existing) {
      suggestions.set(key, suggestion);
      continue;
    }

    suggestions.set(key, {
      ...existing,
      reason: 'shared_tags_and_mentions',
      snippet: suggestion.snippet ?? existing.snippet,
      sharedTags: [...new Set([...existing.sharedTags, ...suggestion.sharedTags])].sort(),
    });
  }

  return [...suggestions.values()]
    .sort((a, b) => {
      const reasonWeight = (suggestion: ConnectionSuggestion) => {
        switch (suggestion.reason) {
          case 'shared_tags_and_mentions':
            return 3;
          case 'shared_tags':
            return 2;
          case 'mentions':
            return 1;
        }
      };

      const reasonDiff = reasonWeight(b) - reasonWeight(a);
      if (reasonDiff !== 0) return reasonDiff;

      const tagDiff = b.sharedTags.length - a.sharedTags.length;
      if (tagDiff !== 0) return tagDiff;

      return `${a.type}:${a.title}:${a.id}`.localeCompare(`${b.type}:${b.title}:${b.id}`);
    })
    .slice(0, limit);
}
