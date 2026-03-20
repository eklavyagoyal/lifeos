import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getEntity } from '@/server/services/entities';
import { getTagsForItem } from '@/server/services/tags';
import { LearningDetailClient } from './client';

export const metadata = { title: 'Learning Item — lifeOS' };
export const dynamic = 'force-dynamic';

const LEARNING_TYPES = new Set(['book', 'article', 'course']);

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LearningDetailPage({ params }: Props) {
  const { id } = await params;
  const entity = getEntity(id);
  if (!entity || !LEARNING_TYPES.has(entity.entityType)) notFound();

  const relatedItems = getResolvedRelationsForItem('entity', id);
  const structuralItems = getStructuralConnectionsForItem('entity', id);
  const suggestedItems = getConnectionSuggestionsForItem('entity', id);
  const tags = getTagsForItem('entity', id);

  return (
    <LearningDetailClient
      entity={entity}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
    />
  );
}
