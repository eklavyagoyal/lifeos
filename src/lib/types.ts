// ============================================================
// lifeOS — Shared TypeScript Types
// ============================================================

/** All domain object types in the system */
export type ItemType =
  | 'task'
  | 'habit'
  | 'journal'
  | 'note'
  | 'idea'
  | 'project'
  | 'goal'
  | 'metric'
  | 'entity'
  | 'event'
  | 'review'
  | 'inbox';

/** All searchable domain object types */
export type SearchableItemType = Exclude<ItemType, 'inbox'>;

/** Global app mode */
export type AppMode = 'quick' | 'deep';

/** Task status */
export type TaskStatus = 'inbox' | 'todo' | 'in_progress' | 'done' | 'cancelled';

/** Task priority */
export type TaskPriority = 'p1' | 'p2' | 'p3' | 'p4';

/** Habit cadence */
export type HabitCadence = 'daily' | 'weekly' | 'custom';

/** Supported recurrence frequencies for scheduled tasks */
export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly';

/** Life domain categories — used for gamification and grouping */
export type LifeDomain =
  | 'health'
  | 'productivity'
  | 'learning'
  | 'relationships'
  | 'finance'
  | 'creativity'
  | 'reflection';

/** Project status */
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';

/** Project health */
export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track';

/** Project review cadence */
export type ReviewCadence = 'weekly' | 'biweekly' | 'monthly';

/** Milestone status */
export type MilestoneStatus = 'planned' | 'active' | 'done' | 'cancelled';

/** Goal time horizon */
export type GoalTimeHorizon = 'quarterly' | 'yearly' | 'multi_year' | 'life';

/** Metric log types */
export type MetricType =
  | 'sleep'
  | 'mood'
  | 'energy'
  | 'workout'
  | 'symptom'
  | 'expense'
  | 'focus_session'
  | 'body_metric'
  | 'custom';

/** Entity types */
export type EntityType =
  | 'person'
  | 'book'
  | 'article'
  | 'course'
  | 'place'
  | 'symptom'
  | 'routine'
  | 'tool'
  | 'medication'
  | 'topic';

/** Relation types */
export type RelationType =
  | 'belongs_to'
  | 'mentions'
  | 'supports'
  | 'related_to'
  | 'blocks'
  | 'derived_from'
  | 'summarizes'
  | 'affects';

/** Resolved relation metadata for connection UIs */
export interface ConnectionRelation {
  id: string;
  sourceType: ItemType;
  sourceId: string;
  targetType: ItemType;
  targetId: string;
  relationType: RelationType;
}

/** A resolved relation or structural connection shown on detail pages */
export interface ConnectionItem {
  relation?: ConnectionRelation;
  type: ItemType;
  id: string;
  title: string;
  subtitle?: string;
  detailUrl: string;
  direction: 'incoming' | 'outgoing' | 'structural';
  relationLabel: string;
}

/** A suggested connection candidate derived from shared context */
export interface ConnectionSuggestion {
  type: ItemType;
  id: string;
  title: string;
  subtitle?: string;
  detailUrl: string;
  sharedTags: string[];
  reason: 'shared_tags' | 'mentions' | 'shared_tags_and_mentions';
  snippet?: string;
}

/** A resolved search result for the command palette / search page */
export interface SearchResultItem {
  itemId: string;
  itemType: SearchableItemType;
  title: string;
  snippet: string;
  rank: number;
  detailUrl: string;
  subtitle?: string;
  attachmentCount?: number;
  attachmentNames?: string[];
  matchOrigin?: 'item' | 'attachment' | 'item_and_attachment';
}

/** Review types */
export type ReviewType = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Scheduler job categories */
export type SchedulerJobType =
  | 'recurring_task'
  | 'project_review'
  | 'review_generation'
  | 'stale_project_scan';

/** Scheduler run outcomes */
export type SchedulerRunStatus = 'running' | 'succeeded' | 'failed' | 'skipped';

/** Supported import source types */
export type ImportType = 'todoist_csv' | 'notion_export' | 'obsidian_vault' | 'day_one_json';

/** Import run lifecycle states */
export type ImportRunStatus = 'running' | 'completed' | 'failed';

/** Attachment ingestion origin */
export type AttachmentSourceType = 'upload' | 'import';

/** Attachment text extraction lifecycle */
export type AttachmentSearchStatus = 'pending' | 'indexed' | 'unsupported' | 'failed';

/** Navigation section definition */
export interface NavSection {
  label: string;
  items: NavItem[];
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

/** Quick capture parsed result */
export type CaptureSuggestedType = 'task' | 'note' | 'idea' | 'journal' | 'metric' | 'entity' | 'inbox';

export interface CaptureParseResult {
  rawText: string;
  suggestedType: CaptureSuggestedType;
  title: string;
  body?: string;
  tags: string[];
  priority?: TaskPriority;
  dueDate?: string;
  scheduledDate?: string;
  projectId?: string;
  projectLabel?: string;
  metricType?: MetricType;
  metricValue?: number;
  entityType?: EntityType;
  directCreateSupported: boolean;
  confidence: number;
  warnings: string[];
}

// ============================================================
// Graph & Timeline Visualization Types
// ============================================================

/** A node in the graph explorer */
export interface GraphNode {
  id: string;
  type: ItemType;
  title: string;
  subtitle?: string;
  status?: string;
  date?: string;
  detailUrl: string;
  tagIds?: string[];
  attachmentCount?: number;
  x: number;
  y: number;
}

/** An edge in the graph explorer */
export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  edgeType: 'relation' | 'structural' | 'tag' | 'attachment';
}

/** Filter options for the graph */
export interface GraphFilters {
  types: ItemType[];
  tagId?: string;
  focalNodeType?: ItemType;
  focalNodeId?: string;
  maxNodes?: number;
  includeTagEdges?: boolean;
}

/** An item in the timeline feed */
export interface TimelineItem {
  id: string;
  type: ItemType;
  title: string;
  subtitle?: string;
  date: string;
  time?: string;
  icon: string;
  detailUrl: string;
  metadata?: Record<string, string | number>;
}

/** Filter options for the timeline */
export interface TimelineFilters {
  types?: ItemType[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
