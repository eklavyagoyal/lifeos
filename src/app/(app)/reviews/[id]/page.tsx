import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getReview } from '@/server/services/reviews';
import { getTagsForItem } from '@/server/services/tags';
import { ReviewDetailClient } from './client';

export const metadata = { title: 'Review — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReviewDetailPage({ params }: Props) {
  const { id } = await params;
  const review = getReview(id);
  if (!review) notFound();

  const relatedItems = getResolvedRelationsForItem('review', id);
  const structuralItems = getStructuralConnectionsForItem('review', id);
  const suggestedItems = getConnectionSuggestionsForItem('review', id);
  const tags = getTagsForItem('review', id);

  return (
    <ReviewDetailClient
      review={review}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
    />
  );
}
