import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getMetric } from '@/server/services/metrics';
import { getTagsForItem } from '@/server/services/tags';
import { MetricDetailClient } from './client';

export const metadata = { title: 'Metric — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MetricDetailPage({ params }: Props) {
  const { id } = await params;
  const metric = getMetric(id);
  if (!metric) notFound();

  const relatedItems = getResolvedRelationsForItem('metric', id);
  const structuralItems = getStructuralConnectionsForItem('metric', id);
  const suggestedItems = getConnectionSuggestionsForItem('metric', id);
  const tags = getTagsForItem('metric', id);

  return (
    <MetricDetailClient
      metric={metric}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
    />
  );
}
