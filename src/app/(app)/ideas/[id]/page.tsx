import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getAttachmentsForItem } from '@/server/services/attachments';
import { getIdea } from '@/server/services/ideas';
import { getTagsForItem } from '@/server/services/tags';
import { IdeaDetailClient } from './client';

export const metadata = { title: 'Idea — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function IdeaDetailPage({ params }: Props) {
  const { id } = await params;
  const idea = getIdea(id);
  if (!idea) notFound();

  const relatedItems = getResolvedRelationsForItem('idea', id);
  const structuralItems = getStructuralConnectionsForItem('idea', id);
  const suggestedItems = getConnectionSuggestionsForItem('idea', id);
  const tags = getTagsForItem('idea', id);
  const attachments = getAttachmentsForItem('idea', id);

  return (
    <IdeaDetailClient
      idea={idea}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
      attachments={attachments}
    />
  );
}
