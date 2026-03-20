import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getAttachmentsForItem } from '@/server/services/attachments';
import { getNote } from '@/server/services/notes';
import { getTagsForItem } from '@/server/services/tags';
import { NoteDetailClient } from './client';

export const metadata = { title: 'Note — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: Props) {
  const { id } = await params;
  const note = getNote(id);
  if (!note) notFound();

  const relatedItems = getResolvedRelationsForItem('note', id);
  const structuralItems = getStructuralConnectionsForItem('note', id);
  const suggestedItems = getConnectionSuggestionsForItem('note', id);
  const tags = getTagsForItem('note', id);
  const attachments = getAttachmentsForItem('note', id);

  return (
    <NoteDetailClient
      note={note}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
      attachments={attachments}
    />
  );
}
