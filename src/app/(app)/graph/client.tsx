'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Filter,
  Focus,
  Maximize2,
  Network,
  Save,
  Tag,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { GraphEdge, GraphNode } from '@/lib/types';

const TYPE_COLORS: Record<string, string> = {
  task: '#3b82f6',
  habit: '#8b5cf6',
  journal: '#f59e0b',
  note: '#10b981',
  idea: '#eab308',
  project: '#6366f1',
  goal: '#ef4444',
  metric: '#06b6d4',
  entity: '#ec4899',
  event: '#f97316',
  review: '#14b8a6',
  inbox: '#6b7280',
};

const TYPE_LABELS: Record<string, string> = {
  task: 'Tasks',
  habit: 'Habits',
  journal: 'Journal',
  note: 'Notes',
  idea: 'Ideas',
  project: 'Projects',
  goal: 'Goals',
  metric: 'Metrics',
  entity: 'Entities',
  event: 'Events',
  review: 'Reviews',
};

const EDGE_TYPE_LABELS: Record<GraphEdge['edgeType'], string> = {
  relation: 'Explicit relations',
  structural: 'Structural links',
  tag: 'Shared tags',
  attachment: 'Shared attachments',
};

const EDGE_TYPE_STYLES: Record<GraphEdge['edgeType'], { color: string; dash?: string }> = {
  relation: { color: 'var(--color-text-tertiary)' },
  structural: { color: 'var(--color-brand-400)', dash: '4 2' },
  tag: { color: 'var(--color-text-muted)', dash: '2 4' },
  attachment: { color: 'var(--color-brand-600)', dash: '6 3' },
};

const NODE_RADIUS = 18;
const CANVAS_SIZE = 1000;
const STORAGE_KEY = 'lifeos.graph.filters.v1';

interface Props {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  availableTags: { id: string; name: string; color: string | null }[];
}

interface SavedFilters {
  enabledTypes?: string[];
  enabledEdgeTypes?: GraphEdge['edgeType'][];
  selectedTagId?: string;
  focusDepth?: 1 | 2;
}

function computeNeighborhood(
  selectedNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  depth: 1 | 2
) {
  const visited = new Set<string>([selectedNodeId]);
  let frontier = new Set<string>([selectedNodeId]);

  for (let level = 0; level < depth; level += 1) {
    const nextFrontier = new Set<string>();
    for (const edge of edges) {
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

  return {
    nodes: nodes.filter((node) => visited.has(node.id)),
    edges: edges.filter((edge) => visited.has(edge.sourceId) && visited.has(edge.targetId)),
  };
}

export function GraphClient({ initialNodes, initialEdges, availableTags }: Props) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [nodes] = useState(initialNodes);
  const [edges] = useState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(() => {
    const types = new Set<string>();
    for (const node of initialNodes) types.add(node.type);
    return types;
  });
  const [enabledEdgeTypes, setEnabledEdgeTypes] = useState<Set<GraphEdge['edgeType']>>(
    new Set<GraphEdge['edgeType']>(['relation', 'structural', 'tag', 'attachment'])
  );
  const [selectedTagId, setSelectedTagId] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [focusDepth, setFocusDepth] = useState<1 | 2>(1);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: CANVAS_SIZE, h: CANVAS_SIZE });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setPreferencesLoaded(true);
        return;
      }

      const parsed = JSON.parse(raw) as SavedFilters;
      if (Array.isArray(parsed.enabledTypes) && parsed.enabledTypes.length > 0) {
        setEnabledTypes(new Set(parsed.enabledTypes));
      }
      if (Array.isArray(parsed.enabledEdgeTypes) && parsed.enabledEdgeTypes.length > 0) {
        setEnabledEdgeTypes(new Set(parsed.enabledEdgeTypes));
      }
      if (parsed.selectedTagId && availableTags.some((tag) => tag.id === parsed.selectedTagId)) {
        setSelectedTagId(parsed.selectedTagId);
      }
      if (parsed.focusDepth === 2) {
        setFocusDepth(2);
      }
    } catch {
      // Ignore malformed saved filters and fall back to defaults.
    } finally {
      setPreferencesLoaded(true);
    }
  }, [availableTags]);

  useEffect(() => {
    if (!preferencesLoaded) return;

    const payload: SavedFilters = {
      enabledTypes: [...enabledTypes],
      enabledEdgeTypes: [...enabledEdgeTypes],
      selectedTagId,
      focusDepth,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [enabledEdgeTypes, enabledTypes, focusDepth, preferencesLoaded, selectedTagId]);

  const baseNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (!enabledTypes.has(node.type)) return false;
      if (selectedTagId && !(node.tagIds ?? []).includes(selectedTagId)) return false;
      return true;
    });
  }, [enabledTypes, nodes, selectedTagId]);

  const baseNodeIds = useMemo(() => new Set(baseNodes.map((node) => node.id)), [baseNodes]);

  const baseEdges = useMemo(() => {
    return edges.filter((edge) => {
      if (!enabledEdgeTypes.has(edge.edgeType)) return false;
      return baseNodeIds.has(edge.sourceId) && baseNodeIds.has(edge.targetId);
    });
  }, [baseNodeIds, edges, enabledEdgeTypes]);

  const focusedGraph = useMemo(() => {
    if (!focusMode || !selectedNodeId || !baseNodeIds.has(selectedNodeId)) {
      return { nodes: baseNodes, edges: baseEdges };
    }

    return computeNeighborhood(selectedNodeId, baseNodes, baseEdges, focusDepth);
  }, [baseEdges, baseNodeIds, baseNodes, focusDepth, focusMode, selectedNodeId]);

  const visibleNodes = focusedGraph.nodes;
  const visibleEdges = focusedGraph.edges;
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const hoveredNode = hoveredNodeId ? nodes.find((node) => node.id === hoveredNodeId) ?? null : null;

  const neighborIds = useMemo(() => {
    if (!selectedNodeId || !visibleNodeIds.has(selectedNodeId)) return new Set<string>();

    const ids = new Set<string>([selectedNodeId]);
    for (const edge of visibleEdges) {
      if (edge.sourceId === selectedNodeId) ids.add(edge.targetId);
      if (edge.targetId === selectedNodeId) ids.add(edge.sourceId);
    }
    return ids;
  }, [selectedNodeId, visibleEdges, visibleNodeIds]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of visibleNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [visibleNodes]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of nodes) {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
    }
    return counts;
  }, [nodes]);

  const availableTypes = useMemo(() => Object.keys(typeCounts).sort(), [typeCounts]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId((previous) => (previous === nodeId ? null : nodeId));
  }, []);

  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    router.push(node.detailUrl);
  }, [router]);

  const handleZoom = useCallback((factor: number) => {
    setViewBox((previous) => {
      const nextWidth = Math.max(200, Math.min(2000, previous.w * factor));
      const nextHeight = Math.max(200, Math.min(2000, previous.h * factor));
      const dx = (previous.w - nextWidth) / 2;
      const dy = (previous.h - nextHeight) / 2;
      return { x: previous.x + dx, y: previous.y + dy, w: nextWidth, h: nextHeight };
    });
  }, []);

  const handleResetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: CANVAS_SIZE, h: CANVAS_SIZE });
  }, []);

  const handleResetFilters = useCallback(() => {
    setEnabledTypes(new Set(availableTypes));
    setEnabledEdgeTypes(new Set<GraphEdge['edgeType']>(['relation', 'structural', 'tag', 'attachment']));
    setSelectedTagId('');
    setFocusDepth(1);
    setFocusMode(false);
    localStorage.removeItem(STORAGE_KEY);
  }, [availableTypes]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    handleZoom(event.deltaY > 0 ? 1.1 : 0.9);
  }, [handleZoom]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (
      event.target === svgRef.current
      || (event.target as Element).tagName === 'line'
      || (event.target as Element).tagName === 'rect'
    ) {
      setIsPanning(true);
      setPanStart({ x: event.clientX, y: event.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isPanning) return;

    const dx = (event.clientX - panStart.x) * (viewBox.w / (containerRef.current?.clientWidth ?? 800));
    const dy = (event.clientY - panStart.y) * (viewBox.h / (containerRef.current?.clientHeight ?? 600));

    setViewBox((previous) => ({
      ...previous,
      x: previous.x - dx,
      y: previous.y - dy,
    }));
    setPanStart({ x: event.clientX, y: event.clientY });
  }, [isPanning, panStart.x, panStart.y, viewBox.h, viewBox.w]);

  const toggleType = useCallback((type: string) => {
    setEnabledTypes((previous) => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleEdgeType = useCallback((edgeType: GraphEdge['edgeType']) => {
    setEnabledEdgeTypes((previous) => {
      const next = new Set(previous);
      if (next.has(edgeType)) next.delete(edgeType);
      else next.add(edgeType);
      return next;
    });
  }, []);

  const selectedTag = selectedTagId
    ? availableTags.find((tag) => tag.id === selectedTagId) ?? null
    : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-surface-3 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Network size={20} className="text-brand-500" />
            <div>
              <h1 className="text-lg font-semibold text-text-primary">Graph Explorer</h1>
              <p className="text-2xs text-text-muted">
                {visibleNodes.length} nodes · {visibleEdges.length} edges
                {focusMode && selectedNode ? ` · focused on ${selectedNode.title}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((value) => !value)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                showFilters ? 'bg-brand-100 text-brand-700' : 'text-text-muted hover:bg-surface-2'
              )}
            >
              <Filter size={14} />
              Filters
            </button>
            <button
              onClick={() => setFocusMode((value) => !value)}
              disabled={!selectedNode}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
                focusMode ? 'bg-brand-100 text-brand-700' : 'text-text-muted hover:bg-surface-2'
              )}
            >
              <Focus size={14} />
              {focusMode ? 'Show All' : 'Focus'}
            </button>
            <button
              onClick={() => handleZoom(0.8)}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => handleZoom(1.25)}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={handleResetView}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2"
              title="Reset View"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showFilters ? (
          <div className="w-72 flex-shrink-0 space-y-5 overflow-y-auto border-r border-surface-3 p-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Save size={14} className="text-brand-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Saved Filters
                </h3>
              </div>
              <p className="text-2xs text-text-muted">
                Type, edge, tag, and focus-depth filters auto-save on this device.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Node Types
              </h3>
              <div className="space-y-1">
                {availableTypes.map((type) => (
                  <label key={type} className="group flex cursor-pointer items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={enabledTypes.has(type)}
                      onChange={() => toggleType(type)}
                      className="rounded border-surface-3 text-brand-500 focus:ring-brand-500"
                    />
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[type] ?? '#6b7280' }}
                    />
                    <span className="flex-1 text-sm text-text-secondary transition-colors group-hover:text-text-primary">
                      {TYPE_LABELS[type] ?? type}
                    </span>
                    <span className="text-2xs text-text-muted">{typeCounts[type] ?? 0}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Edge Types
              </h3>
              <div className="space-y-2">
                {(['relation', 'structural', 'tag', 'attachment'] as const).map((edgeType) => (
                  <label key={edgeType} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enabledEdgeTypes.has(edgeType)}
                      onChange={() => toggleEdgeType(edgeType)}
                      className="rounded border-surface-3 text-brand-500 focus:ring-brand-500"
                    />
                    <svg width="24" height="2">
                      <line
                        x1="0"
                        y1="1"
                        x2="24"
                        y2="1"
                        stroke={EDGE_TYPE_STYLES[edgeType].color}
                        strokeWidth="1.5"
                        strokeDasharray={EDGE_TYPE_STYLES[edgeType].dash}
                      />
                    </svg>
                    <span className="text-sm text-text-secondary">{EDGE_TYPE_LABELS[edgeType]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Tag size={14} className="text-text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Tag Filter
                </h3>
              </div>
              <select
                value={selectedTagId}
                onChange={(event) => setSelectedTagId(event.target.value)}
                className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="">All tags</option>
                {availableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-2xs text-text-muted">
                {selectedTag ? `Showing nodes tagged #${selectedTag.name}.` : 'No tag constraint applied.'}
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Focus Depth
              </h3>
              <div className="flex gap-2">
                {[1, 2].map((depth) => (
                  <button
                    key={depth}
                    onClick={() => setFocusDepth(depth as 1 | 2)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      focusDepth === depth
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                    )}
                  >
                    {depth}-hop
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Quick Views
              </h3>
              <div className="space-y-1 text-2xs">
                <button
                  onClick={() => setEnabledTypes(new Set(availableTypes))}
                  className="text-brand-500 transition-colors hover:text-brand-600"
                >
                  Show all
                </button>
                <span className="mx-1 text-text-muted">·</span>
                <button
                  onClick={() => setEnabledTypes(new Set(['project', 'goal', 'note', 'idea']))}
                  className="text-brand-500 transition-colors hover:text-brand-600"
                >
                  Planning view
                </button>
                <span className="mx-1 text-text-muted">·</span>
                <button
                  onClick={() => setEnabledTypes(new Set(['task', 'habit', 'review', 'event']))}
                  className="text-brand-500 transition-colors hover:text-brand-600"
                >
                  Execution view
                </button>
              </div>
            </div>

            <button
              onClick={handleResetFilters}
              className="w-full rounded-md border border-surface-3 px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2"
            >
              Reset Filters
            </button>
          </div>
        ) : null}

        <div
          ref={containerRef}
          className="relative flex-1 cursor-grab overflow-hidden bg-surface-1 active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          {visibleNodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Network size={32} className="mx-auto mb-2 text-text-muted" />
                <p className="text-sm text-text-muted">No graph nodes match the active filters.</p>
                <p className="mt-1 text-2xs text-text-muted">
                  Try clearing the tag filter, re-enabling types, or leaving focus mode.
                </p>
              </div>
            </div>
          ) : (
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              onWheel={handleWheel}
              className="select-none"
            >
              <rect
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.w}
                height={viewBox.h}
                fill="transparent"
              />

              <g className="edges">
                {visibleEdges.map((edge) => {
                  const source = nodeMap.get(edge.sourceId);
                  const target = nodeMap.get(edge.targetId);
                  if (!source || !target) return null;

                  const style = EDGE_TYPE_STYLES[edge.edgeType];
                  const isHighlighted = selectedNodeId && (
                    edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId
                  );
                  const isDimmed = selectedNodeId && !isHighlighted;

                  return (
                    <line
                      key={edge.id}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={style.color}
                      strokeWidth={isHighlighted ? 2 : 1}
                      strokeDasharray={style.dash}
                      opacity={isDimmed ? 0.15 : isHighlighted ? 1 : 0.4}
                      className="transition-opacity duration-200"
                    />
                  );
                })}
              </g>

              <g className="nodes">
                {visibleNodes.map((node) => {
                  const color = TYPE_COLORS[node.type] ?? '#6b7280';
                  const isSelected = node.id === selectedNodeId;
                  const isNeighbor = neighborIds.has(node.id);
                  const isDimmed = selectedNodeId && !isNeighbor;
                  const isHovered = node.id === hoveredNodeId;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNodeClick(node.id);
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        handleNodeDoubleClick(node);
                      }}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className="cursor-pointer"
                      style={{ opacity: isDimmed ? 0.2 : 1, transition: 'opacity 200ms' }}
                    >
                      {isSelected ? (
                        <circle
                          r={NODE_RADIUS + 5}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          opacity={0.5}
                        />
                      ) : null}
                      <circle
                        r={isSelected ? NODE_RADIUS + 2 : NODE_RADIUS}
                        fill={color}
                        opacity={0.85}
                        stroke={isHovered ? '#fff' : 'none'}
                        strokeWidth={isHovered ? 2 : 0}
                      />
                      <text
                        y={NODE_RADIUS + 14}
                        textAnchor="middle"
                        fontSize="11"
                        fill="var(--color-text-secondary)"
                        className="pointer-events-none select-none"
                      >
                        {node.title.length > 20 ? `${node.title.slice(0, 18)}…` : node.title}
                      </text>
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="12"
                        fontWeight="600"
                        fill="#fff"
                        className="pointer-events-none select-none"
                      >
                        {node.type.charAt(0).toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {hoveredNode && !selectedNode ? (
            <div className="pointer-events-none absolute right-4 top-4 max-w-xs card p-3 shadow-lg">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[hoveredNode.type] }}
                />
                <span className="text-2xs font-medium uppercase text-text-muted">
                  {TYPE_LABELS[hoveredNode.type] ?? hoveredNode.type}
                </span>
              </div>
              <p className="text-sm font-medium text-text-primary">{hoveredNode.title}</p>
              {hoveredNode.subtitle ? (
                <p className="mt-0.5 text-2xs text-text-muted">{hoveredNode.subtitle}</p>
              ) : null}
              {hoveredNode.date ? <p className="text-2xs text-text-muted">{hoveredNode.date}</p> : null}
              {hoveredNode.attachmentCount ? (
                <p className="text-2xs text-text-muted">
                  {hoveredNode.attachmentCount} attachment{hoveredNode.attachmentCount !== 1 ? 's' : ''}
                </p>
              ) : null}
            </div>
          ) : null}

          {selectedNode ? (
            <div className="absolute right-4 top-4 w-80 card p-4 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[selectedNode.type] }}
                  />
                  <span className="text-2xs font-medium uppercase text-text-muted">
                    {TYPE_LABELS[selectedNode.type] ?? selectedNode.type}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-text-muted transition-colors hover:text-text-primary"
                >
                  <X size={14} />
                </button>
              </div>

              <h3 className="mb-1 text-sm font-semibold text-text-primary">{selectedNode.title}</h3>
              {selectedNode.subtitle ? (
                <p className="mb-1 text-2xs text-text-muted">{selectedNode.subtitle}</p>
              ) : null}
              {selectedNode.status ? (
                <span className="mb-1 inline-block rounded bg-surface-2 px-1.5 py-0.5 text-2xs text-text-secondary">
                  {selectedNode.status}
                </span>
              ) : null}
              {selectedNode.date ? <p className="text-2xs text-text-muted">{selectedNode.date}</p> : null}
              {(selectedNode.tagIds && selectedNode.tagIds.length > 0) || selectedNode.attachmentCount ? (
                <p className="mt-1 text-2xs text-text-muted">
                  {[
                    selectedNode.tagIds && selectedNode.tagIds.length > 0
                      ? `${selectedNode.tagIds.length} tag${selectedNode.tagIds.length !== 1 ? 's' : ''}`
                      : null,
                    selectedNode.attachmentCount
                      ? `${selectedNode.attachmentCount} attachment${selectedNode.attachmentCount !== 1 ? 's' : ''}`
                      : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              ) : null}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setFocusMode((value) => !value)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    focusMode
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                  )}
                >
                  {focusMode ? 'Show Full Graph' : `Focus ${focusDepth}-hop`}
                </button>
                <button
                  onClick={() => router.push(selectedNode.detailUrl)}
                  className="flex-1 rounded-md bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-700"
                >
                  Open Detail
                </button>
              </div>

              <div className="mt-3 border-t border-surface-3 pt-3">
                <p className="mb-1.5 text-2xs text-text-muted">
                  {neighborIds.size - 1} visible connection{neighborIds.size - 1 !== 1 ? 's' : ''}
                </p>
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {visibleEdges
                    .filter((edge) => edge.sourceId === selectedNode.id || edge.targetId === selectedNode.id)
                    .slice(0, 12)
                    .map((edge) => {
                      const otherId = edge.sourceId === selectedNode.id ? edge.targetId : edge.sourceId;
                      const other = nodeMap.get(otherId);
                      if (!other) return null;

                      return (
                        <button
                          key={edge.id}
                          onClick={() => handleNodeClick(otherId)}
                          className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-surface-2"
                        >
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: TYPE_COLORS[other.type] }}
                          />
                          <span className="flex-1 truncate text-2xs text-text-secondary">{other.title}</span>
                          <span className="text-2xs text-text-muted">{edge.label}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
