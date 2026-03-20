import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getAttachmentsForItem } from '@/server/services/attachments';
import { getJournalEntry } from '@/server/services/journal';
import { getTagsForItem } from '@/server/services/tags';
import { JournalDetailClient } from './client';

export const metadata = { title: 'Journal Entry — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JournalDetailPage({ params }: Props) {
  const { id } = await params;
  const entry = getJournalEntry(id);
  if (!entry) notFound();

  const relatedItems = getResolvedRelationsForItem('journal', id);
  const structuralItems = getStructuralConnectionsForItem('journal', id);
  const suggestedItems = getConnectionSuggestionsForItem('journal', id);
  const tags = getTagsForItem('journal', id);
  const attachments = getAttachmentsForItem('journal', id);

  return (
    <JournalDetailClient
      entry={entry}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
      attachments={attachments}
    />
  );
}
