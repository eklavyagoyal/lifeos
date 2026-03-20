import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getEntity } from '@/server/services/entities';
import { getTagsForItem } from '@/server/services/tags';
import { PersonDetailClient } from './client';

export const metadata = { title: 'Person — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PersonDetailPage({ params }: Props) {
  const { id } = await params;
  const entity = getEntity(id);
  if (!entity || entity.entityType !== 'person') notFound();

  const relatedItems = getResolvedRelationsForItem('entity', id);
  const structuralItems = getStructuralConnectionsForItem('entity', id);
  const suggestedItems = getConnectionSuggestionsForItem('entity', id);
  const tags = getTagsForItem('entity', id);

  return (
    <PersonDetailClient
      entity={entity}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
    />
  );
}
