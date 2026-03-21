'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
import { ConstellationDepthField } from '@/components/experience/constellation-depth-field';
import { DepthPlane, SpatialScene } from '@/components/experience/motion-scene';
import { cn } from '@/lib/cn';
import type { GraphEdge, GraphNode } from '@/lib/types';

const TYPE_COLORS: Record<string, string> = {
  task: '#cf8151',
  habit: '#6d8d69',
  journal: '#aa7f62',
  note: '#c59a50',
  idea: '#d88b48',
  project: '#7385bb',
  goal: '#bf6d60',
  metric: '#5d9387',
  entity: '#b37390',
  event: '#cc7646',
  review: '#76866e',
  inbox: '#8d7c6f',
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

const EDGE_TYPES = ['relation', 'structural', 'tag', 'attachment'] as const;

const EDGE_TYPE_LABELS: Record<GraphEdge['edgeType'], string> = {
  relation: 'Explicit relations',
  structural: 'Structural links',
  tag: 'Shared tags',
  attachment: 'Shared attachments',
};

const EDGE_TYPE_STYLES: Record<GraphEdge['edgeType'], { color: string; dash?: string }> = {
  relation: { color: '#6d6055' },
  structural: { color: '#7385bb', dash: '6 3' },
  tag: { color: '#9a8d82', dash: '2 6' },
  attachment: { color: '#bf7b4c', dash: '10 4' },
};

const LENS_PRESETS = [
  {
    id: 'all',
    title: 'Full Atlas',
    description: 'Keep every artifact family in view.',
    types: null,
  },
  {
    id: 'momentum',
    title: 'Momentum',
    description: 'Goals, projects, tasks, habits, and reviews.',
    types: ['goal', 'project', 'task', 'habit', 'review'],
  },
  {
    id: 'memory',
    title: 'Memory',
    description: 'Notes, journal, ideas, reviews, people, and events.',
    types: ['note', 'journal', 'idea', 'review', 'entity', 'event'],
  },
  {
    id: 'signals',
    title: 'Signals',
    description: 'Metrics, habits, tasks, health context, and reviews.',
    types: ['metric', 'habit', 'task', 'review', 'event'],
  },
] as const;

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

interface ClusterInfo {
  type: string;
  count: number;
  x: number;
  y: number;
  spread: number;
  radius: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
    : normalized;

  const value = Number.parseInt(expanded, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
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

function buildEdgePath(source: GraphNode, target: GraphNode, seed: string, edgeType: GraphEdge['edgeType']) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  const midpointX = (source.x + target.x) / 2;
  const midpointY = (source.y + target.y) / 2;
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const direction = hashString(seed) % 2 === 0 ? 1 : -1;
  const curvatureMultiplier = edgeType === 'structural'
    ? 1.15
    : edgeType === 'tag'
      ? 0.75
      : edgeType === 'attachment'
        ? 1.05
        : 0.9;
  const curve = clamp(distance * 0.12 * curvatureMultiplier, 12, 56) * direction;
  const controlX = midpointX + normalX * curve;
  const controlY = midpointY + normalY * curve;

  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

function setsMatch(values: Set<string>, target: string[]) {
  if (values.size !== target.length) return false;
  for (const value of target) {
    if (!values.has(value)) return false;
  }
  return true;
}

function formatArtifactCount(count: number) {
  return `${count} artifact${count === 1 ? '' : 's'}`;
}

function formatRelationshipTone(count: number) {
  if (count >= 24) return 'Dense weave';
  if (count >= 12) return 'Active field';
  if (count >= 5) return 'Emerging cluster';
  return 'Quiet pocket';
}

function AtlasStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="graph-stat-card motion-sheen-card">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl tracking-[-0.05em] text-text-primary">
        {value}
      </div>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{detail}</p>
    </div>
  );
}

export function GraphClient({ initialNodes, initialEdges, availableTags }: Props) {
  const router = useRouter();
  const graphInstructionsId = useId();
  const filterPanelId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const panPointerIdRef = useRef<number | null>(null);

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

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of nodes) {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
    }
    return counts;
  }, [nodes]);

  const availableTypes = useMemo(() => Object.keys(typeCounts).sort(), [typeCounts]);

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

  useEffect(() => {
    if (selectedNodeId && !baseNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [baseNodeIds, selectedNodeId]);

  useEffect(() => {
    if (hoveredNodeId && !baseNodeIds.has(hoveredNodeId)) {
      setHoveredNodeId(null);
    }
  }, [baseNodeIds, hoveredNodeId]);

  useEffect(() => {
    if (focusMode && !selectedNodeId) {
      setFocusMode(false);
    }
  }, [focusMode, selectedNodeId]);

  const focusedGraph = useMemo(() => {
    if (!focusMode || !selectedNodeId || !baseNodeIds.has(selectedNodeId)) {
      return { nodes: baseNodes, edges: baseEdges };
    }

    return computeNeighborhood(selectedNodeId, baseNodes, baseEdges, focusDepth);
  }, [baseEdges, baseNodeIds, baseNodes, focusDepth, focusMode, selectedNodeId]);

  const visibleNodes = focusedGraph.nodes;
  const visibleEdges = focusedGraph.edges;
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const contextNodes = useMemo(() => {
    if (!focusMode || !selectedNodeId) return [];
    return baseNodes.filter((node) => !visibleNodeIds.has(node.id));
  }, [baseNodes, focusMode, selectedNodeId, visibleNodeIds]);

  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const hoveredNode = hoveredNodeId
    ? nodes.find((node) => node.id === hoveredNodeId) ?? null
    : null;
  const spotlightNode = selectedNode ?? hoveredNode;

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

  const clusterInfo = useMemo<ClusterInfo[]>(() => {
    const grouped = new Map<string, GraphNode[]>();

    for (const node of visibleNodes) {
      const group = grouped.get(node.type) ?? [];
      group.push(node);
      grouped.set(node.type, group);
    }

    return [...grouped.entries()]
      .map(([type, clusterNodes]) => {
        const count = clusterNodes.length;
        const x = clusterNodes.reduce((sum, node) => sum + node.x, 0) / count;
        const y = clusterNodes.reduce((sum, node) => sum + node.y, 0) / count;
        const spread = clusterNodes.reduce((sum, node) => {
          return sum + Math.hypot(node.x - x, node.y - y);
        }, 0) / count;

        return {
          type,
          count,
          x,
          y,
          spread,
          radius: clamp(110 + spread * 1.35 + count * 5.5, 110, 250),
        };
      })
      .sort((left, right) => right.count - left.count);
  }, [visibleNodes]);

  const atlasIndexNodes = useMemo(() => {
    return [...visibleNodes]
      .sort((left, right) => left.title.localeCompare(right.title))
      .slice(0, 8);
  }, [visibleNodes]);

  const selectedConnections = useMemo(() => {
    if (!spotlightNode) return [];

    return visibleEdges
      .filter((edge) => edge.sourceId === spotlightNode.id || edge.targetId === spotlightNode.id)
      .map((edge) => {
        const otherId = edge.sourceId === spotlightNode.id ? edge.targetId : edge.sourceId;
        return {
          edge,
          node: nodeMap.get(otherId) ?? null,
        };
      })
      .filter((connection): connection is { edge: GraphEdge; node: GraphNode } => !!connection.node)
      .slice(0, 10);
  }, [nodeMap, spotlightNode, visibleEdges]);

  const tagMap = useMemo(() => {
    return new Map(availableTags.map((tag) => [tag.id, tag]));
  }, [availableTags]);

  const spotlightTagNames = useMemo(() => {
    if (!spotlightNode?.tagIds?.length) return [];
    return spotlightNode.tagIds
      .map((tagId) => tagMap.get(tagId)?.name)
      .filter((tagName): tagName is string => !!tagName)
      .slice(0, 4);
  }, [spotlightNode, tagMap]);

  const selectedTag = selectedTagId
    ? availableTags.find((tag) => tag.id === selectedTagId) ?? null
    : null;

  const hiddenByFiltersCount = nodes.length - baseNodes.length;
  const outerFieldCount = baseNodes.length - visibleNodes.length;
  const visibleAttachmentCount = visibleNodes.reduce((sum, node) => sum + (node.attachmentCount ?? 0), 0);
  const persistentLabels = visibleNodes.length <= 20 || focusMode || viewBox.w < 680;

  const lensNarrative = useMemo(() => {
    if (selectedNode && focusMode) {
      return {
        lede: `Tracing ${selectedNode.title} through its nearby field.`,
        supporting: `The outer constellation recedes so the ${focusDepth}-hop neighborhood can breathe. ${outerFieldCount > 0 ? `${outerFieldCount} quieter artifacts still sit in the outer field.` : 'Everything in the active atlas remains visible.'}`,
      };
    }

    if (selectedNode) {
      return {
        lede: `${selectedNode.title} is currently spotlighted.`,
        supporting: `${neighborIds.size - 1} visible connection${neighborIds.size - 1 === 1 ? '' : 's'} sit closest to it, while the rest of the atlas stays in view for context.`,
      };
    }

    if (selectedTag) {
      return {
        lede: `Following the #${selectedTag.name} thread across the atlas.`,
        supporting: `${formatArtifactCount(baseNodes.length)} match the active tag lens, with ${visibleEdges.length} connection strand${visibleEdges.length === 1 ? '' : 's'} still visible.`,
      };
    }

    if (hiddenByFiltersCount > 0) {
      return {
        lede: `The current lens narrows the atlas to what matters right now.`,
        supporting: `${formatArtifactCount(visibleNodes.length)} remain in view while ${hiddenByFiltersCount} artifact${hiddenByFiltersCount === 1 ? '' : 's'} stay outside the current filter set.`,
      };
    }

    return {
      lede: 'Walk the links between work, memory, people, and reflection.',
      supporting: 'This atlas is meant for exploration: cluster glows show where families gather, spotlighting pulls a neighborhood forward, and the outer field helps you stay oriented instead of dropping context completely.',
    };
  }, [
    baseNodes.length,
    focusDepth,
    focusMode,
    hiddenByFiltersCount,
    neighborIds.size,
    outerFieldCount,
    selectedNode,
    selectedTag,
    visibleEdges.length,
    visibleNodes.length,
  ]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId((previous) => (previous === nodeId ? null : nodeId));
  }, []);

  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    router.push(node.detailUrl);
  }, [router]);

  const handleZoom = useCallback((factor: number) => {
    setViewBox((previous) => {
      const nextWidth = clamp(previous.w * factor, 220, 2200);
      const nextHeight = clamp(previous.h * factor, 220, 2200);
      const dx = (previous.w - nextWidth) / 2;
      const dy = (previous.h - nextHeight) / 2;
      return { x: previous.x + dx, y: previous.y + dy, w: nextWidth, h: nextHeight };
    });
  }, []);

  const handleResetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: CANVAS_SIZE, h: CANVAS_SIZE });
  }, []);

  const handleFitVisible = useCallback(() => {
    if (visibleNodes.length === 0) {
      handleResetView();
      return;
    }

    const padding = 100;
    const xValues = visibleNodes.map((node) => node.x);
    const yValues = visibleNodes.map((node) => node.y);
    const minX = Math.min(...xValues) - padding;
    const maxX = Math.max(...xValues) + padding;
    const minY = Math.min(...yValues) - padding;
    const maxY = Math.max(...yValues) + padding;
    const width = maxX - minX;
    const height = maxY - minY;
    const size = clamp(Math.max(width, height), 260, 1800);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setViewBox({
      x: centerX - size / 2,
      y: centerY - size / 2,
      w: size,
      h: size,
    });
  }, [handleResetView, visibleNodes]);

  useEffect(() => {
    if (!focusMode || !selectedNodeId) return;

    const frame = window.requestAnimationFrame(() => {
      handleFitVisible();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusDepth, focusMode, handleFitVisible, selectedNodeId]);

  const handleResetFilters = useCallback(() => {
    setEnabledTypes(new Set(availableTypes));
    setEnabledEdgeTypes(new Set<GraphEdge['edgeType']>(['relation', 'structural', 'tag', 'attachment']));
    setSelectedTagId('');
    setFocusDepth(1);
    setFocusMode(false);
    setSelectedNodeId(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [availableTypes]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    handleZoom(event.deltaY > 0 ? 1.1 : 0.9);
  }, [handleZoom]);

  const handlePanByKeyboard = useCallback((deltaX: number, deltaY: number) => {
    setViewBox((previous) => ({
      ...previous,
      x: previous.x + deltaX,
      y: previous.y + deltaY,
    }));
  }, []);

  const handleStageKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const panStep = Math.max(36, Math.round(viewBox.w * 0.06));

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handlePanByKeyboard(-panStep, 0);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      handlePanByKeyboard(panStep, 0);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      handlePanByKeyboard(0, -panStep);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      handlePanByKeyboard(0, panStep);
      return;
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      handleZoom(0.82);
      return;
    }

    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      handleZoom(1.22);
      return;
    }

    if (event.key === '0') {
      event.preventDefault();
      handleResetView();
      return;
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      handleFitVisible();
    }
  }, [handleFitVisible, handlePanByKeyboard, handleResetView, handleZoom, viewBox.w]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    const target = event.target as Element;
    const tagName = target.tagName.toLowerCase();
    const isBackground = target.getAttribute('data-graph-background') === 'true';

    if (target === svgRef.current || isBackground || tagName === 'path') {
      event.currentTarget.setPointerCapture(event.pointerId);
      panPointerIdRef.current = event.pointerId;
      setIsPanning(true);
      setPanStart({ x: event.clientX, y: event.clientY });
    }
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!isPanning || panPointerIdRef.current !== event.pointerId) return;

    const dx = (event.clientX - panStart.x) * (viewBox.w / (containerRef.current?.clientWidth ?? 800));
    const dy = (event.clientY - panStart.y) * (viewBox.h / (containerRef.current?.clientHeight ?? 600));

    setViewBox((previous) => ({
      ...previous,
      x: previous.x - dx,
      y: previous.y - dy,
    }));
    setPanStart({ x: event.clientX, y: event.clientY });
  }, [isPanning, panStart.x, panStart.y, viewBox.h, viewBox.w]);

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (panPointerIdRef.current !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    panPointerIdRef.current = null;
    setIsPanning(false);
  }, []);

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

  const applyLensPreset = useCallback((types: readonly string[] | null) => {
    if (!types) {
      setEnabledTypes(new Set(availableTypes));
      return;
    }

    const nextTypes = types.filter((type) => availableTypes.includes(type));
    setEnabledTypes(new Set(nextTypes));
  }, [availableTypes]);

  const isLensActive = useCallback((types: readonly string[] | null) => {
    const target = types ? types.filter((type) => availableTypes.includes(type)) : availableTypes;
    return setsMatch(enabledTypes, target);
  }, [availableTypes, enabledTypes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (selectedNodeId) {
        setSelectedNodeId(null);
        return;
      }

      if (showFilters) {
        setShowFilters(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, showFilters]);

  return (
    <div className="space-y-5 animate-fade-in">
      <SpatialScene as="section" intensity={1.02} className="graph-hero motion-reveal">
        <ConstellationDepthField variant="hero" />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <DepthPlane className="h-full" innerClassName="space-y-5 h-full" depth={10} tilt={0.32}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="shell-meta-pill">Constellation</span>
              <span className="shell-meta-pill">Memory Atlas</span>
              <span className="shell-meta-pill">
                {focusMode && selectedNode ? `Focused ${focusDepth}-hop view` : 'Exploration mode'}
              </span>
              {selectedTag ? (
                <span className="shell-meta-pill">
                  <Tag size={12} />
                  #{selectedTag.name}
                </span>
              ) : null}
            </div>

            <div className="max-w-4xl">
              <div className="section-kicker">Spatial Atlas</div>
              <h1 className="mt-3 font-display text-display-lg leading-[0.95] tracking-[-0.05em] text-text-primary">
                Enter the part of lifeOS that feels most like a map.
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-text-secondary">
                {lensNarrative.lede} {lensNarrative.supporting}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AtlasStat
                label="Visible"
                value={String(visibleNodes.length)}
                detail={`${formatArtifactCount(visibleNodes.length)} currently sit in the active view.`}
              />
              <AtlasStat
                label="Strands"
                value={String(visibleEdges.length)}
                detail={`${formatRelationshipTone(visibleEdges.length)} across explicit and inferred links.`}
              />
              <AtlasStat
                label="Clusters"
                value={String(clusterInfo.length)}
                detail={`${clusterInfo[0]?.count ?? 0} artifacts in the largest visible family.`}
              />
              <AtlasStat
                label="Outer Field"
                value={String(focusMode ? outerFieldCount : hiddenByFiltersCount)}
                detail={
                  focusMode
                    ? `${outerFieldCount} artifacts recede instead of disappearing entirely.`
                    : hiddenByFiltersCount > 0
                      ? `${hiddenByFiltersCount} artifacts are outside the current lens.`
                      : 'The full atlas is visible right now.'
                }
              />
            </div>
          </DepthPlane>

          <DepthPlane depth={18} tilt={0.72}>
            <div className="graph-control-dock motion-sheen-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="section-kicker">Atlas Controls</div>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-text-secondary">
                    Filters, focus, zoom, and reframing live here so the graph stays exploratory instead of overwhelming.
                  </p>
                </div>
                <span className="shell-meta-pill">
                  <Save size={12} />
                  Filters auto-save on this device
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((value) => !value)}
                  className={cn(
                    'graph-stage-pill',
                    showFilters ? 'border-[rgba(174,93,44,0.22)] bg-[rgba(255,248,240,0.92)] text-text-primary' : ''
                  )}
                  aria-expanded={showFilters}
                  aria-controls={filterPanelId}
                >
                  <Filter size={14} />
                  {showFilters ? 'Hide lenses' : 'Show lenses'}
                </button>
                <button
                  type="button"
                  onClick={() => setFocusMode((value) => !value)}
                  disabled={!selectedNode}
                  className={cn(
                    'graph-stage-pill disabled:cursor-not-allowed disabled:opacity-55',
                    focusMode ? 'border-[rgba(174,93,44,0.22)] bg-[rgba(255,248,240,0.92)] text-text-primary' : ''
                  )}
                  aria-pressed={focusMode}
                >
                  <Focus size={14} />
                  {focusMode ? 'Show full field' : 'Spotlight selection'}
                </button>
                <button type="button" onClick={() => handleZoom(0.82)} className="graph-stage-pill" title="Zoom in">
                  <ZoomIn size={14} />
                  Zoom in
                </button>
                <button type="button" onClick={() => handleZoom(1.22)} className="graph-stage-pill" title="Zoom out">
                  <ZoomOut size={14} />
                  Zoom out
                </button>
                <button type="button" onClick={handleFitVisible} className="graph-stage-pill" title="Reframe visible graph">
                  <Maximize2 size={14} />
                  Reframe
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {LENS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyLensPreset(preset.types)}
                    className={cn(
                      'graph-lens-card text-left',
                      isLensActive(preset.types)
                        ? 'border-[rgba(174,93,44,0.18)] bg-[linear-gradient(135deg,rgba(255,249,241,0.96)_0%,rgba(244,232,216,0.82)_100%)]'
                        : ''
                    )}
                    aria-pressed={isLensActive(preset.types)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-text-primary">{preset.title}</span>
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
                        {isLensActive(preset.types) ? 'Active' : 'Lens'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </DepthPlane>
        </div>
      </SpatialScene>

      <div
        className={cn(
          'grid gap-4',
          showFilters
            ? 'xl:grid-cols-[18rem_minmax(0,1fr)_20rem]'
            : 'xl:grid-cols-[minmax(0,1fr)_20rem]'
        )}
      >
        <p id={graphInstructionsId} className="sr-only">
          The memory atlas is interactive. Focus the graph stage and use the arrow keys to pan, plus or minus to zoom, zero to reset the view, and F to reframe the visible graph. Use the lens controls to narrow the visible field and the spotlight panel to open artifact details.
        </p>

        {showFilters ? (
          <aside
            id={filterPanelId}
            className="graph-side-panel motion-reveal motion-sheen-card space-y-5"
          >
            <div>
              <div className="section-kicker">Saved Lenses</div>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Type, edge, tag, and focus-depth filters stay with this browser, so your favorite views are always close.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Network size={14} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-text-primary">Artifact families</h3>
              </div>
              <div className="space-y-2">
                {availableTypes.map((type) => {
                  const active = enabledTypes.has(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={cn(
                        'graph-legend-row w-full text-left',
                        active
                          ? 'border-[rgba(174,93,44,0.16)] bg-[rgba(255,251,246,0.92)]'
                          : 'opacity-75 hover:opacity-100'
                      )}
                      aria-pressed={active}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: TYPE_COLORS[type] ?? '#8d7c6f' }}
                        />
                        <span>
                          <span className="block text-sm font-medium text-text-primary">
                            {TYPE_LABELS[type] ?? type}
                          </span>
                          <span className="block text-2xs text-text-muted">
                            {typeCounts[type] ?? 0} artifact{typeCounts[type] === 1 ? '' : 's'}
                          </span>
                        </span>
                      </span>
                      <span className="text-2xs font-medium uppercase tracking-[0.16em] text-text-muted">
                        {active ? 'On' : 'Off'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-text-primary">Connection strands</h3>
              </div>
              <div className="space-y-2">
                {EDGE_TYPES.map((edgeType) => {
                  const active = enabledEdgeTypes.has(edgeType);
                  const style = EDGE_TYPE_STYLES[edgeType];
                  return (
                    <button
                      key={edgeType}
                      type="button"
                      onClick={() => toggleEdgeType(edgeType)}
                      className={cn(
                        'graph-legend-row w-full text-left',
                        active
                          ? 'border-[rgba(174,93,44,0.16)] bg-[rgba(255,251,246,0.92)]'
                          : 'opacity-75 hover:opacity-100'
                      )}
                      aria-pressed={active}
                    >
                      <span className="flex items-center gap-3">
                        <svg width="30" height="8" className="shrink-0">
                          <path
                            d="M 2 4 Q 15 0 28 4"
                            stroke={style.color}
                            strokeWidth="1.8"
                            strokeDasharray={style.dash}
                            fill="none"
                          />
                        </svg>
                        <span className="text-sm font-medium text-text-primary">
                          {EDGE_TYPE_LABELS[edgeType]}
                        </span>
                      </span>
                      <span className="text-2xs font-medium uppercase tracking-[0.16em] text-text-muted">
                        {active ? 'On' : 'Off'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-text-primary">Tag thread</h3>
              </div>
              <select
                value={selectedTagId}
                onChange={(event) => setSelectedTagId(event.target.value)}
                className="detail-field-select"
              >
                <option value="">All tags</option>
                {availableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <p className="text-sm leading-6 text-text-secondary">
                {selectedTag
                  ? `The current lens follows the #${selectedTag.name} thread across the atlas.`
                  : 'No tag-specific thread is constraining the field right now.'}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Focus depth</h3>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((depth) => (
                  <button
                    key={depth}
                    type="button"
                    onClick={() => setFocusDepth(depth as 1 | 2)}
                    className={cn(
                      'graph-stage-pill justify-center',
                      focusDepth === depth
                        ? 'border-[rgba(174,93,44,0.22)] bg-[rgba(255,248,240,0.92)] text-text-primary'
                        : ''
                    )}
                    aria-pressed={focusDepth === depth}
                  >
                    {depth}-hop neighborhood
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="graph-stage-pill w-full justify-center"
            >
              Reset lenses
            </button>
          </aside>
        ) : null}

        <SpatialScene className="relative motion-reveal overflow-hidden rounded-[2.2rem]" intensity={1.15}>
          <section
            ref={containerRef}
            className={cn(
              'graph-stage motion-sheen-card',
              isPanning ? 'cursor-grabbing' : 'cursor-grab'
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onKeyDown={handleStageKeyDown}
            tabIndex={0}
            aria-label="Memory Atlas graph stage"
            aria-describedby={graphInstructionsId}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - 0 F"
          >
            <ConstellationDepthField variant="stage" />

            <DepthPlane className="pointer-events-none absolute left-4 top-4 z-10" depth={7} tilt={0.22}>
              <div className="flex flex-wrap gap-2">
                <span className="graph-stage-pill">Drag to pan</span>
                <span className="graph-stage-pill">Touch-drag works too</span>
                <span className="graph-stage-pill">Double-click a node to open detail</span>
                {selectedTag ? (
                  <span className="graph-stage-pill">
                    <Tag size={12} />
                    #{selectedTag.name}
                  </span>
                ) : null}
                {focusMode && selectedNode ? (
                  <span className="graph-stage-pill">
                    <Focus size={12} />
                    {focusDepth}-hop spotlight on {truncateLabel(selectedNode.title, 22)}
                  </span>
                ) : null}
              </div>
            </DepthPlane>

            <DepthPlane
              className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-sm"
              depth={12}
              tilt={0.35}
            >
              <div className="graph-control-dock motion-sheen-card p-4">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                  Atlas Notes
                </div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {focusMode
                    ? `${outerFieldCount} artifact${outerFieldCount === 1 ? '' : 's'} remain in the outer field as faint context while the spotlight stays readable.`
                    : hiddenByFiltersCount > 0
                      ? `${hiddenByFiltersCount} artifact${hiddenByFiltersCount === 1 ? '' : 's'} sit outside the current lens.`
                      : 'The full graph is visible, so clusters and long-range bridges are easiest to compare right now.'}
                </p>
              </div>
            </DepthPlane>

            {visibleNodes.length === 0 ? (
              <div className="graph-empty-state absolute inset-6">
                <Network size={34} className="text-text-muted" />
                <div className="space-y-2 text-center">
                  <h2 className="font-display text-3xl tracking-[-0.05em] text-text-primary">
                    No nodes match this lens
                  </h2>
                  <p className="max-w-md text-sm leading-6 text-text-secondary">
                    Try clearing the tag thread, re-enabling one of the artifact families, or leaving spotlight mode so the wider field can return.
                  </p>
                </div>
                <button type="button" onClick={handleResetFilters} className="graph-stage-pill">
                  Reset lenses
                </button>
              </div>
            ) : (
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                onWheel={handleWheel}
                className="select-none"
                onClick={(event) => {
                  if ((event.target as Element).getAttribute('data-graph-background') === 'true') {
                    setSelectedNodeId(null);
                  }
                }}
              >
              <defs>
                <pattern id="graph-dot-grid" width="44" height="44" patternUnits="userSpaceOnUse">
                  <circle cx="1.5" cy="1.5" r="1.5" fill="rgba(124, 99, 75, 0.14)" />
                </pattern>
                <radialGradient id="graph-vignette" cx="50%" cy="50%" r="62%">
                  <stop offset="0%" stopColor="rgba(255, 250, 242, 0)" />
                  <stop offset="100%" stopColor="rgba(48, 34, 24, 0.18)" />
                </radialGradient>
                <linearGradient id="graph-field-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255, 251, 246, 0.24)" />
                  <stop offset="100%" stopColor="rgba(107, 134, 182, 0.08)" />
                </linearGradient>
                <filter id="graph-cluster-blur">
                  <feGaussianBlur stdDeviation="34" />
                </filter>
                <filter id="graph-node-glow">
                  <feGaussianBlur stdDeviation="12" />
                </filter>
              </defs>

              <rect
                data-graph-background="true"
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.w}
                height={viewBox.h}
                fill="rgba(0,0,0,0)"
              />
              <rect
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.w}
                height={viewBox.h}
                fill="url(#graph-dot-grid)"
                opacity="0.55"
                pointerEvents="none"
              />
              <rect
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.w}
                height={viewBox.h}
                fill="url(#graph-field-sheen)"
                opacity="0.55"
                pointerEvents="none"
              />

              {[0.18, 0.34, 0.52].map((ratio, index) => {
                const radius = viewBox.w * ratio;
                const centerX = viewBox.x + viewBox.w * 0.5;
                const centerY = viewBox.y + viewBox.h * 0.5;
                return (
                  <circle
                    key={`orbit-${ratio}`}
                    cx={centerX}
                    cy={centerY}
                    r={radius}
                    fill="none"
                    stroke="rgba(124, 99, 75, 0.1)"
                    strokeWidth={index === 1 ? 1.6 : 1}
                    strokeDasharray={index === 1 ? '8 10' : '3 14'}
                    opacity={0.55 - index * 0.1}
                    pointerEvents="none"
                  />
                );
              })}

              <g pointerEvents="none">
                {clusterInfo.map((cluster) => {
                  const color = TYPE_COLORS[cluster.type] ?? '#8d7c6f';
                  return (
                    <circle
                      key={`cluster-glow-${cluster.type}`}
                      cx={cluster.x}
                      cy={cluster.y}
                      r={cluster.radius}
                      fill={hexToRgba(color, cluster.type === selectedNode?.type ? 0.18 : 0.11)}
                      filter="url(#graph-cluster-blur)"
                    />
                  );
                })}
              </g>

              <g pointerEvents="none">
                {clusterInfo
                  .filter((cluster) => cluster.count > 1)
                  .slice(0, 4)
                  .map((cluster) => {
                    const label = TYPE_LABELS[cluster.type] ?? cluster.type;
                    const labelWidth = label.length * 7.4 + 46;
                    return (
                      <g
                        key={`cluster-label-${cluster.type}`}
                        transform={`translate(${cluster.x - labelWidth / 2}, ${cluster.y - cluster.radius * 0.52})`}
                      >
                        <rect
                          width={labelWidth}
                          height={26}
                          rx={13}
                          fill="rgba(255, 249, 241, 0.74)"
                          stroke={hexToRgba(TYPE_COLORS[cluster.type] ?? '#8d7c6f', 0.2)}
                        />
                        <text x={14} y={16} fontSize="10.5" fill="rgba(61, 46, 36, 0.72)">
                          {label}
                        </text>
                        <text
                          x={labelWidth - 15}
                          y={16}
                          textAnchor="end"
                          fontSize="10.5"
                          fontWeight="700"
                          fill={TYPE_COLORS[cluster.type] ?? '#8d7c6f'}
                        >
                          {cluster.count}
                        </text>
                      </g>
                    );
                  })}
              </g>

              {contextNodes.length > 0 ? (
                <g className="pointer-events-none">
                  {contextNodes.map((node) => (
                    <circle
                      key={`context-${node.id}`}
                      cx={node.x}
                      cy={node.y}
                      r={4}
                      fill={hexToRgba(TYPE_COLORS[node.type] ?? '#8d7c6f', 0.28)}
                      opacity={0.55}
                    />
                  ))}
                </g>
              ) : null}

              <g className="edges">
                {visibleEdges.map((edge) => {
                  const source = nodeMap.get(edge.sourceId);
                  const target = nodeMap.get(edge.targetId);
                  if (!source || !target) return null;

                  const style = EDGE_TYPE_STYLES[edge.edgeType];
                  const path = buildEdgePath(source, target, edge.id, edge.edgeType);
                  const isHighlighted = selectedNodeId && (
                    edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId
                  );
                  const isHoveredEdge = hoveredNodeId && (
                    edge.sourceId === hoveredNodeId || edge.targetId === hoveredNodeId
                  );
                  const isDimmed = selectedNodeId && !isHighlighted;

                  return (
                    <g key={edge.id}>
                      {isHighlighted || isHoveredEdge ? (
                        <path
                          d={path}
                          stroke={hexToRgba(style.color, 0.18)}
                          strokeWidth={isHighlighted ? 7 : 5}
                          fill="none"
                          pointerEvents="none"
                        />
                      ) : null}
                      <path
                        d={path}
                        stroke={style.color}
                        strokeWidth={isHighlighted ? 2.6 : isHoveredEdge ? 2.1 : 1.4}
                        strokeDasharray={style.dash}
                        opacity={isDimmed ? 0.1 : isHighlighted ? 0.96 : isHoveredEdge ? 0.72 : 0.34}
                        fill="none"
                        className="transition-opacity duration-200"
                      />
                    </g>
                  );
                })}
              </g>

              <g className="nodes">
                {visibleNodes.map((node) => {
                  const color = TYPE_COLORS[node.type] ?? '#8d7c6f';
                  const isSelected = node.id === selectedNodeId;
                  const isNeighbor = neighborIds.has(node.id);
                  const isDimmed = !!selectedNodeId && !isNeighbor;
                  const isHovered = node.id === hoveredNodeId;
                  const showLabel = persistentLabels || isSelected || isNeighbor || isHovered;
                  const label = truncateLabel(node.title, 24);
                  const labelWidth = Math.max(66, label.length * 7 + 18);
                  const nodeRadius = isSelected ? NODE_RADIUS + 5 : isHovered ? NODE_RADIUS + 3 : isNeighbor ? NODE_RADIUS + 1 : NODE_RADIUS - 1;
                  const glowOpacity = isSelected ? 0.38 : isHovered ? 0.26 : isNeighbor ? 0.2 : 0.12;

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
                      onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))}
                      className="cursor-pointer"
                      style={{ opacity: isDimmed ? 0.18 : 1, transition: 'opacity 200ms' }}
                    >
                      <circle
                        r={nodeRadius + 10}
                        fill={hexToRgba(color, glowOpacity)}
                        filter="url(#graph-node-glow)"
                        className={isSelected ? 'animate-pulse' : undefined}
                      />
                      {isSelected ? (
                        <circle
                          r={nodeRadius + 8}
                          fill="none"
                          stroke={hexToRgba(color, 0.58)}
                          strokeWidth={2}
                          strokeDasharray="6 8"
                        />
                      ) : null}
                      <circle
                        r={nodeRadius + 3}
                        fill="rgba(255, 249, 241, 0.9)"
                        stroke={hexToRgba(color, 0.18)}
                        strokeWidth={1.2}
                      />
                      <circle
                        r={nodeRadius}
                        fill={hexToRgba(color, isSelected ? 0.92 : 0.84)}
                        stroke={isHovered ? '#fffaf3' : hexToRgba('#ffffff', 0.52)}
                        strokeWidth={isHovered ? 2 : 1}
                      />
                      <circle
                        cx={nodeRadius - 4}
                        cy={-nodeRadius + 4}
                        r={node.attachmentCount ? 3.5 : 0}
                        fill="rgba(255, 250, 244, 0.9)"
                        stroke={hexToRgba(color, 0.44)}
                        strokeWidth={1}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={11.5}
                        fontWeight="700"
                        fill="#fff9f1"
                        className="pointer-events-none select-none"
                      >
                        {node.type.charAt(0).toUpperCase()}
                      </text>

                      {showLabel ? (
                        <g transform={`translate(${-labelWidth / 2}, ${nodeRadius + 12})`} pointerEvents="none">
                          <rect
                            width={labelWidth}
                            height={22}
                            rx={11}
                            fill={isSelected ? 'rgba(255, 249, 241, 0.96)' : 'rgba(255, 249, 241, 0.82)'}
                            stroke={hexToRgba(color, isSelected ? 0.26 : 0.16)}
                          />
                          <text
                            x={labelWidth / 2}
                            y={14}
                            textAnchor="middle"
                            fontSize="10.5"
                            fill="var(--color-text-secondary)"
                            className="select-none"
                          >
                            {label}
                          </text>
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </g>

              <rect
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.w}
                height={viewBox.h}
                fill="url(#graph-vignette)"
                opacity="0.65"
                pointerEvents="none"
              />
              </svg>
            )}
          </section>
        </SpatialScene>

        <aside className="space-y-4">
          <section className="graph-side-panel motion-reveal motion-sheen-card">
            <div className="detail-panel-header">
              <div>
                <div className="section-kicker">Spotlight</div>
                <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-text-primary">
                  {spotlightNode ? truncateLabel(spotlightNode.title, 38) : 'Choose a node'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {selectedNode
                    ? 'This node is pinned in the foreground. Use spotlight mode to isolate its immediate neighborhood.'
                    : hoveredNode
                      ? 'Hovering lets you inspect a node gently before selecting it.'
                      : 'Select a node to pull its relationships, tags, and structural role into the foreground.'}
                </p>
              </div>
              {selectedNode ? (
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  className="graph-stage-pill shrink-0"
                  aria-label="Clear selected node"
                >
                  <X size={14} />
                  Clear
                </button>
              ) : null}
            </div>

            {spotlightNode ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shell-meta-pill">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[spotlightNode.type] ?? '#8d7c6f' }}
                    />
                    {TYPE_LABELS[spotlightNode.type] ?? spotlightNode.type}
                  </span>
                  {spotlightNode.status ? <span className="shell-meta-pill">{spotlightNode.status}</span> : null}
                  {spotlightNode.date ? <span className="shell-meta-pill">{spotlightNode.date}</span> : null}
                </div>

                {spotlightNode.subtitle ? (
                  <p className="text-sm leading-6 text-text-secondary">{spotlightNode.subtitle}</p>
                ) : null}

                {(spotlightTagNames.length > 0 || spotlightNode.attachmentCount) ? (
                  <div className="flex flex-wrap gap-2">
                    {spotlightTagNames.map((tagName) => (
                      <span key={tagName} className="graph-stage-pill">
                        #{tagName}
                      </span>
                    ))}
                    {spotlightNode.attachmentCount ? (
                      <span className="graph-stage-pill">
                        {spotlightNode.attachmentCount} attachment{spotlightNode.attachmentCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="graph-lens-card">
                    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                      Nearby links
                    </div>
                    <div className="mt-2 font-display text-3xl tracking-[-0.05em] text-text-primary">
                      {selectedConnections.length}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      Visible connection strand{selectedConnections.length === 1 ? '' : 's'} touching this node.
                    </p>
                  </div>
                  <div className="graph-lens-card">
                    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                      Cluster role
                    </div>
                    <div className="mt-2 font-display text-2xl tracking-[-0.05em] text-text-primary">
                      {formatRelationshipTone(selectedConnections.length)}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      {TYPE_LABELS[spotlightNode.type] ?? spotlightNode.type} family nodes share this local density.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusMode((value) => !value)}
                    className={cn(
                      'graph-stage-pill flex-1 justify-center',
                      focusMode ? 'border-[rgba(174,93,44,0.22)] bg-[rgba(255,248,240,0.92)] text-text-primary' : ''
                    )}
                    aria-pressed={focusMode}
                  >
                    {focusMode ? 'Show full field' : `Spotlight ${focusDepth}-hop`}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(spotlightNode.detailUrl)}
                    className="graph-stage-pill flex-1 justify-center"
                  >
                    Open detail
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                    Connection list
                  </div>
                  <div className="space-y-2">
                    {selectedConnections.length > 0 ? (
                      selectedConnections.map(({ edge, node }) => (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => handleNodeClick(node.id)}
                          className="graph-legend-row w-full text-left"
                          aria-pressed={selectedNodeId === node.id}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: TYPE_COLORS[node.type] ?? '#8d7c6f' }}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-text-primary">
                                {node.title}
                              </span>
                              <span className="block truncate text-2xs text-text-muted">
                                {edge.label} · {EDGE_TYPE_LABELS[edge.edgeType]}
                              </span>
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="graph-lens-card">
                        <p className="text-sm leading-6 text-text-secondary">
                          No visible connections are currently in-frame for this node. Try leaving spotlight mode or widening the active lens.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="graph-lens-card">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                    How to explore
                  </div>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">
                    Hover to preview, click to pin, double-click to open the underlying page, and use spotlight mode when you want the graph to breathe around a single artifact.
                  </p>
                </div>
                <div className="graph-lens-card">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                    Atlas index
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Select a visible artifact from this quick list when you want a keyboard-friendly way into the field.
                  </p>
                  <div className="mt-3 space-y-2">
                    {atlasIndexNodes.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => handleNodeClick(node.id)}
                        className="graph-legend-row w-full text-left"
                        aria-pressed={selectedNodeId === node.id}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: TYPE_COLORS[node.type] ?? '#8d7c6f' }}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-text-primary">
                              {node.title}
                            </span>
                            <span className="block truncate text-2xs text-text-muted">
                              {TYPE_LABELS[node.type] ?? node.type}
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="graph-lens-card">
                    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                      Attachments in view
                    </div>
                    <div className="mt-2 font-display text-3xl tracking-[-0.05em] text-text-primary">
                      {visibleAttachmentCount}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      Shared files become another connective tissue inside the atlas.
                    </p>
                  </div>
                  <div className="graph-lens-card">
                    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                      Active thread
                    </div>
                    <div className="mt-2 font-display text-2xl tracking-[-0.05em] text-text-primary">
                      {selectedTag ? `#${selectedTag.name}` : 'Full field'}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      Tag threads help you follow a motif across different artifact families.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="graph-side-panel motion-reveal motion-sheen-card space-y-4">
            <div>
              <div className="section-kicker">Cluster Map</div>
              <h3 className="mt-2 font-display text-[1.9rem] leading-none tracking-[-0.05em] text-text-primary">
                Families in the field
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Cluster glow and density tell you where similar artifact types are gathering right now.
              </p>
            </div>

            <div className="space-y-2">
              {clusterInfo.map((cluster) => (
                <div key={cluster.type} className="graph-legend-row">
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[cluster.type] ?? '#8d7c6f' }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-text-primary">
                        {TYPE_LABELS[cluster.type] ?? cluster.type}
                      </span>
                      <span className="block text-2xs text-text-muted">
                        {cluster.count} artifact{cluster.count === 1 ? '' : 's'} · {Math.round(cluster.spread)} spread
                      </span>
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-muted">
                Strand legend
              </div>
              {EDGE_TYPES.map((edgeType) => {
                const style = EDGE_TYPE_STYLES[edgeType];
                return (
                  <div key={edgeType} className="graph-legend-row">
                    <span className="flex items-center gap-3">
                      <svg width="30" height="8" className="shrink-0">
                        <path
                          d="M 2 4 Q 15 0 28 4"
                          stroke={style.color}
                          strokeWidth="1.8"
                          strokeDasharray={style.dash}
                          fill="none"
                        />
                      </svg>
                      <span className="text-sm font-medium text-text-primary">
                        {EDGE_TYPE_LABELS[edgeType]}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
