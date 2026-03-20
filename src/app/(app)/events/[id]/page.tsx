import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getEvent } from '@/server/services/events';
import { getTagsForItem } from '@/server/services/tags';
import { EventDetailClient } from './client';

export const metadata = { title: 'Event — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const event = getEvent(id);
  if (!event || event.archivedAt) notFound();

  const relatedItems = getResolvedRelationsForItem('event', id);
  const structuralItems = getStructuralConnectionsForItem('event', id);
  const suggestedItems = getConnectionSuggestionsForItem('event', id);
  const tags = getTagsForItem('event', id);

  return (
    <EventDetailClient
      event={event}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
    />
  );
}
