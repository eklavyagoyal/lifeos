/**
 * lifeOS — Graph Data Service
 *
 * Builds the graph of connections across all domain items.
 * Three edge layers: explicit relations, structural FKs, shared tags.
 * Includes a lightweight force-directed layout computed server-side.
 */

import { db, sqlite } from '../db';
import { itemTags, relations as relationsTable, tags } from '../db/schema';
import { desc } from 'drizzle-orm';
import type { ItemType, GraphNode, GraphEdge, GraphFilters } from '@/lib/types';
import { getAttachmentSummariesForItems, getSharedAttachmentEdges } from './attachment-queries';
import {
  resolveItemsBatch, getStructuralEdges, getTagSharedEdges,
  getDetailUrl, TYPE_COLORS,
  type ResolvedItem,
} from './graph-helpers';

// ----------------------------------------------------------
// Default filter config
// ----------------------------------------------------------
const DEFAULT_TYPES: ItemType[] = [
  'task', 'habit', 'journal', 'note', 'idea',
  'project', 'goal', 'entity', 'event', 'review',
];

const DEFAULT_MAX_NODES = 200;
const MAX_EDGES = 500;

// ----------------------------------------------------------
// Main entry: build the full graph
// ----------------------------------------------------------
export function getFullGraph(filters?: Partial<GraphFilters>): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const allowedTypes = new Set(filters?.types ?? DEFAULT_TYPES);
  const maxNodes = filters?.maxNodes ?? DEFAULT_MAX_NODES;
  const includeTagEdges = filters?.includeTagEdges ?? false;

  // 1. Collect all edges
  const rawEdges: Array<{
    sourceType: ItemType; sourceId: string;
    targetType: ItemType; targetId: string;
    label: string; edgeType: GraphEdge['edgeType'];
  }> = [];

  // 1a. Explicit relations
  const explicitRelations = db.select().from(relationsTable)
    .orderBy(desc(relationsTable.createdAt))
    .limit(MAX_EDGES)
    .all();

  for (const rel of explicitRelations) {
    rawEdges.push({
      sourceType: rel.sourceType as ItemType,
      sourceId: rel.sourceId,
      targetType: rel.targetType as ItemType,
      targetId: rel.targetId,
      label: rel.relationType.replace(/_/g, ' '),
      edgeType: 'relation',
    });
  }

  // 1b. Structural FK edges
  const structural = getStructuralEdges();
  for (const edge of structural) {
    rawEdges.push({ ...edge, edgeType: 'structural' });
  }

  // 1c. Tag-shared edges (optional)
  if (includeTagEdges) {
    const tagEdges = getTagSharedEdges();
    for (const edge of tagEdges) {
      rawEdges.push({ ...edge, edgeType: 'tag' });
    }
  }

  // 1d. Shared attachment edges
  const attachmentEdges = getSharedAttachmentEdges();
  for (const edge of attachmentEdges) {
    rawEdges.push({ ...edge, edgeType: 'attachment' });
  }

  // 2. Filter edges to only include allowed types
  const filteredEdges = rawEdges.filter(
    e => allowedTypes.has(e.sourceType) && allowedTypes.has(e.targetType)
  );

  // 3. Collect unique node references
  const nodeRefs = new Map<string, { type: ItemType; id: string }>();
  for (const edge of filteredEdges) {
    const sKey = `${edge.sourceType}:${edge.sourceId}`;
    const tKey = `${edge.targetType}:${edge.targetId}`;
    if (!nodeRefs.has(sKey)) nodeRefs.set(sKey, { type: edge.sourceType, id: edge.sourceId });
    if (!nodeRefs.has(tKey)) nodeRefs.set(tKey, { type: edge.targetType, id: edge.targetId });
  }

  // 4. Cap nodes
  const nodeRefArray = [...nodeRefs.values()].slice(0, maxNodes);
  const allowedNodeKeys = new Set(nodeRefArray.map(n => `${n.type}:${n.id}`));

  // 5. Batch-resolve metadata
  const resolved = resolveItemsBatch(nodeRefArray);

  // 6. Build graph edges (only between resolved nodes)
  const graphEdges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const edge of filteredEdges) {
    const sKey = `${edge.sourceType}:${edge.sourceId}`;
    const tKey = `${edge.targetType}:${edge.targetId}`;
    if (!allowedNodeKeys.has(sKey) || !allowedNodeKeys.has(tKey)) continue;

    const edgeKey = `${sKey}-${tKey}-${edge.edgeType}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);

    graphEdges.push({
      id: `e-${graphEdges.length}`,
      sourceId: `${edge.sourceType}:${edge.sourceId}`,
      targetId: `${edge.targetType}:${edge.targetId}`,
      label: edge.label,
      edgeType: edge.edgeType,
    });
  }
  graphEdges.sort((a, b) =>
    `${a.sourceId}:${a.targetId}:${a.edgeType}:${a.label}`.localeCompare(
      `${b.sourceId}:${b.targetId}:${b.edgeType}:${b.label}`
    )
  );

  // 7. Build graph nodes with layout positions
  const resolvedNodes = [...resolved.values()]
    .filter(n => allowedNodeKeys.has(`${n.type}:${n.id}`))
    .sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));

  const nodeTagIds = getNodeTagIds(resolvedNodes.map((node) => ({ type: node.type, id: node.id })));
  const attachmentSummaries = getAttachmentSummariesForItems(
    resolvedNodes.map((node) => ({ type: node.type, id: node.id }))
  );
  const positions = computeLayout(resolvedNodes, graphEdges);

  const graphNodes: GraphNode[] = resolvedNodes.map((item) => {
    const key = `${item.type}:${item.id}`;
    const pos = positions.get(key) ?? { x: 0, y: 0 };
    return {
      id: key,
      type: item.type,
      title: item.title,
      subtitle: item.subtitle,
      status: item.status,
      date: item.date,
      detailUrl: item.detailUrl,
      tagIds: nodeTagIds.get(key) ?? [],
      attachmentCount: attachmentSummaries.counts.get(key) ?? 0,
      x: pos.x,
      y: pos.y,
    };
  });

  return { nodes: graphNodes, edges: graphEdges };
}

// ----------------------------------------------------------
// Neighborhood query: 1-hop from a focal node
// ----------------------------------------------------------
export function getNeighborhood(
  focalType: ItemType,
  focalId: string,
  depth: number = 1
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const focalKey = `${focalType}:${focalId}`;

  // Get the full graph (bounded) and filter to neighborhood
  const full = getFullGraph();

  // BFS to find neighbors within depth
  const visited = new Set<string>([focalKey]);
  let frontier = new Set<string>([focalKey]);

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>();
    for (const edge of full.edges) {
      if (frontier.has(edge.sourceId) && !visited.has(edge.targetId)) {
        nextFrontier.add(edge.targetId);
        visited.add(edge.targetId);
      }
      if (frontier.has(edge.targetId) && !visited.has(edge.sourceId)) {
        nextFrontier.add(edge.sourceId);
        visited.add(edge.sourceId);
      }
    }
    frontier = nextFrontier;
  }

  const nodes = full.nodes.filter(n => visited.has(n.id));
  const edges = full.edges.filter(e => visited.has(e.sourceId) && visited.has(e.targetId));

  return { nodes, edges };
}

// ----------------------------------------------------------
// Get all tags for the filter dropdown
// ----------------------------------------------------------
export function getGraphTags() {
  return db.select().from(tags).orderBy(tags.name).all();
}

function getNodeTagIds(items: Array<{ type: ItemType; id: string }>) {
  const itemKeys = items.map((item) => `${item.type}:${item.id}`);
  const result = new Map<string, string[]>();

  if (itemKeys.length === 0) return result;

  const placeholders = itemKeys.map(() => '?').join(', ');
  const rows = sqlite.prepare(`
    SELECT item_type, item_id, tag_id
    FROM item_tags
    WHERE (item_type || ':' || item_id) IN (${placeholders})
  `).all(...itemKeys) as Array<{
    item_type: string;
    item_id: string;
    tag_id: string;
  }>;

  for (const row of rows) {
    const key = `${row.item_type}:${row.item_id}`;
    const tagIds = result.get(key) ?? [];
    tagIds.push(row.tag_id);
    result.set(key, tagIds);
  }

  return result;
}

// ----------------------------------------------------------
// Simple force-directed layout
// Computes x,y positions for nodes in [0, 1000] x [0, 1000] space
// ----------------------------------------------------------
function computeLayout(
  nodes: ResolvedItem[],
  edges: GraphEdge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const n = nodes.length;

  if (n === 0) return positions;

  // Initialize with type-clustered positions + jitter
  const typeGroups = new Map<ItemType, number>();
  let groupIdx = 0;
  for (const node of nodes) {
    if (!typeGroups.has(node.type)) {
      typeGroups.set(node.type, groupIdx++);
    }
  }
  const totalGroups = typeGroups.size || 1;

  for (const node of nodes) {
    const key = `${node.type}:${node.id}`;
    const group = typeGroups.get(node.type) ?? 0;
    const angle = (group / totalGroups) * 2 * Math.PI;
    const radius = 300;
    const cx = 500 + radius * Math.cos(angle);
    const cy = 500 + radius * Math.sin(angle);
    const jitterX = (seededUnit(`${key}:x`) - 0.5) * 150;
    const jitterY = (seededUnit(`${key}:y`) - 0.5) * 150;
    positions.set(key, {
      x: cx + jitterX,
      y: cy + jitterY,
    });
  }

  // Build adjacency for force calculations
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, new Set());
    if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, new Set());
    adjacency.get(edge.sourceId)!.add(edge.targetId);
    adjacency.get(edge.targetId)!.add(edge.sourceId);
  }

  // Simple force-directed iterations
  const iterations = Math.min(100, 30 + n);
  const repulsionStrength = 50000;
  const attractionStrength = 0.005;
  const dampening = 0.95;

  const velocities = new Map<string, { vx: number; vy: number }>();
  for (const node of nodes) {
    velocities.set(`${node.type}:${node.id}`, { vx: 0, vy: 0 });
  }

  const keys = nodes.map(n => `${n.type}:${n.id}`);

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 - iter / iterations; // cooling

    // Repulsion between all pairs
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = positions.get(keys[i])!;
        const b = positions.get(keys[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const distSq = dx * dx + dy * dy + 1;
        const force = (repulsionStrength * temp) / distSq;
        const dist = Math.sqrt(distSq);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;

        const va = velocities.get(keys[i])!;
        const vb = velocities.get(keys[j])!;
        va.vx += dx; va.vy += dy;
        vb.vx -= dx; vb.vy -= dy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = positions.get(edge.sourceId);
      const b = positions.get(edge.targetId);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const force = attractionStrength * temp;

      const va = velocities.get(edge.sourceId);
      const vb = velocities.get(edge.targetId);
      if (va) { va.vx += dx * force; va.vy += dy * force; }
      if (vb) { vb.vx -= dx * force; vb.vy -= dy * force; }
    }

    // Apply velocities with dampening
    for (const key of keys) {
      const pos = positions.get(key)!;
      const vel = velocities.get(key)!;
      vel.vx *= dampening;
      vel.vy *= dampening;
      pos.x += vel.vx;
      pos.y += vel.vy;
      // Clamp to bounds
      pos.x = Math.max(50, Math.min(950, pos.x));
      pos.y = Math.max(50, Math.min(950, pos.y));
    }
  }

  return positions;
}

function seededUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 10000) / 10000;
}
