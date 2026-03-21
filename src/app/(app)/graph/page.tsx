import { getFullGraph, getGraphTags } from '@/server/services/graph';
import { GraphClient } from './client';

export const metadata = { title: 'Memory Atlas — lifeOS' };
export const dynamic = 'force-dynamic';

export default function GraphPage() {
  const graph = getFullGraph({ includeTagEdges: true });
  const allTags = getGraphTags();

  return (
    <div className="-mx-4 pb-4 sm:-mx-6 lg:-mx-8">
      <GraphClient
        initialNodes={graph.nodes}
        initialEdges={graph.edges}
        availableTags={allTags}
      />
    </div>
  );
}
