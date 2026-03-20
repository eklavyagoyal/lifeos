'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  Inbox,
  Lightbulb,
  Link2,
  Plus,
  Repeat,
  StickyNote,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { createRelationAction, removeRelationAction } from '@/app/actions';
import { cn } from '@/lib/cn';
import type { ConnectionItem, ConnectionSuggestion, ItemType } from '@/lib/types';

const TYPE_ICONS: Record<string, ReactNode> = {
  task: <CheckSquare size={14} />,
  habit: <Repeat size={14} />,
  journal: <BookOpen size={14} />,
  note: <StickyNote size={14} />,
  idea: <Lightbulb size={14} />,
  project: <FolderKanban size={14} />,
  goal: <Target size={14} />,
  metric: <BarChart3 size={14} />,
  entity: <Users size={14} />,
  event: <CalendarDays size={14} />,
  review: <ClipboardList size={14} />,
  inbox: <Inbox size={14} />,
};

const RELATION_LABELS: Record<string, string> = {
  belongs_to: 'Belongs to',
  mentions: 'Mentions',
  supports: 'Supports',
  related_to: 'Related to',
  blocks: 'Blocks',
  derived_from: 'Derived from',
  summarizes: 'Summarizes',
  affects: 'Affects',
};

type RelatedItem = ConnectionItem;
type SuggestionItem = ConnectionSuggestion;

interface RelationsPanelProps {
  items: RelatedItem[];
  structuralItems?: RelatedItem[];
  suggestions?: SuggestionItem[];
  currentItemType?: ItemType;
  currentItemId?: string;
  onAddClick?: () => void;
}

function getRelationLabel(item: RelatedItem) {
  return item.relationLabel
    || (item.relation ? RELATION_LABELS[item.relation.relationType] ?? item.relation.relationType : 'Connected');
}

function getSuggestionSummary(suggestion: SuggestionItem): string {
  switch (suggestion.reason) {
    case 'shared_tags_and_mentions':
      return `Shared tags: ${suggestion.sharedTags.map((tag) => `#${tag}`).join(', ')}`;
    case 'shared_tags':
      return `Shared tags: ${suggestion.sharedTags.map((tag) => `#${tag}`).join(', ')}`;
    case 'mentions':
      return suggestion.snippet || 'Title/body appears to mention this item.';
  }
}

export function RelationsPanel({
  items,
  structuralItems = [],
  suggestions = [],
  currentItemType,
  currentItemId,
  onAddClick,
}: RelationsPanelProps) {
  const outgoing = items.filter((item) => item.direction === 'outgoing');
  const incoming = items.filter((item) => item.direction === 'incoming');
  const hasAnyContent =
    outgoing.length > 0 ||
    incoming.length > 0 ||
    structuralItems.length > 0 ||
    suggestions.length > 0;

  if (!hasAnyContent && !onAddClick) return null;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Connections</h3>
          {hasAnyContent ? (
            <span className="text-2xs text-text-muted">
              ({outgoing.length + incoming.length + structuralItems.length})
            </span>
          ) : null}
        </div>
        {onAddClick ? (
          <button
            onClick={onAddClick}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-2xs text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
          >
            <Plus size={12} />
            Link
          </button>
        ) : null}
      </div>

      {!hasAnyContent ? (
        <p className="py-2 text-2xs text-text-muted">No connected items yet.</p>
      ) : (
        <div className="space-y-4">
          {incoming.length > 0 ? (
            <ConnectionSection
              title="Backlinks"
              description="Items that point here."
              items={incoming}
            />
          ) : null}

          {outgoing.length > 0 ? (
            <ConnectionSection
              title="Outgoing Links"
              description="Items this page points to."
              items={outgoing}
            />
          ) : null}

          {structuralItems.length > 0 ? (
            <ConnectionSection
              title="Inferred Links"
              description="Connections inferred from fields like goal, project, parent relationships, or shared attachments."
              items={structuralItems}
              structural
            />
          ) : null}

          {suggestions.length > 0 ? (
            <SuggestionsSection
              suggestions={suggestions}
              currentItemType={currentItemType}
              currentItemId={currentItemId}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ConnectionSection({
  title,
  description,
  items,
  structural = false,
}: {
  title: string;
  description: string;
  items: RelatedItem[];
  structural?: boolean;
}) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-2xs font-medium uppercase tracking-wider text-text-muted">{title}</p>
        <p className="text-2xs text-text-muted">{description}</p>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <RelationRow key={`${item.direction}:${item.type}:${item.id}:${item.relation?.id ?? item.relationLabel}`} item={item} structural={structural} />
        ))}
      </div>
    </div>
  );
}

function RelationRow({ item, structural = false }: { item: RelatedItem; structural?: boolean }) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);
  const relationLabel = getRelationLabel(item);
  const icon = TYPE_ICONS[item.type] ?? <Link2 size={14} />;
  const href = item.detailUrl ?? '/';

  const handleRemove = async () => {
    if (!item.relation || structural) return;
    setIsRemoving(true);
    await removeRelationAction(item.relation.id);
    router.refresh();
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-surface-1',
        isRemoving && 'opacity-40'
      )}
    >
      <span className="text-text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className="block truncate text-sm text-text-primary transition-colors hover:text-brand-600"
        >
          {item.title}
        </Link>
        {item.subtitle ? (
          <p className="truncate text-2xs text-text-muted">{item.subtitle}</p>
        ) : null}
      </div>
      <span className="text-right text-2xs text-text-muted">{relationLabel}</span>
      {!structural && item.relation ? (
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="opacity-0 text-text-muted transition-all hover:text-status-danger group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      ) : null}
    </div>
  );
}

function SuggestionsSection({
  suggestions,
  currentItemType,
  currentItemId,
}: {
  suggestions: SuggestionItem[];
  currentItemType?: ItemType;
  currentItemId?: string;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConnect = (suggestion: SuggestionItem) => {
    if (!currentItemType || !currentItemId) return;

    const key = `${suggestion.type}:${suggestion.id}`;
    startTransition(async () => {
      setPendingKey(key);
      await createRelationAction(
        currentItemType,
        currentItemId,
        suggestion.type,
        suggestion.id,
        'related_to'
      );
      setPendingKey(null);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-2">
        <p className="text-2xs font-medium uppercase tracking-wider text-text-muted">
          Suggested Connections
        </p>
        <p className="text-2xs text-text-muted">
          Nearby items surfaced from shared tags and mention-like text matches.
        </p>
      </div>
      <div className="space-y-1">
        {suggestions.map((suggestion) => {
          const key = `${suggestion.type}:${suggestion.id}`;
          const icon = TYPE_ICONS[suggestion.type] ?? <Link2 size={14} />;

          return (
            <div
              key={key}
              className="flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-surface-1"
            >
              <span className="text-text-muted">{icon}</span>
              <div className="min-w-0 flex-1">
                <Link
                  href={suggestion.detailUrl}
                  className="block truncate text-sm text-text-primary transition-colors hover:text-brand-600"
                >
                  {suggestion.title}
                </Link>
                {suggestion.subtitle ? (
                  <p className="truncate text-2xs text-text-muted">{suggestion.subtitle}</p>
                ) : null}
                <p className="truncate text-2xs text-text-muted">
                  {getSuggestionSummary(suggestion)}
                </p>
                {suggestion.reason === 'shared_tags_and_mentions' && suggestion.snippet ? (
                  <p className="truncate text-2xs text-text-muted">
                    Mention match: {suggestion.snippet}
                  </p>
                ) : null}
              </div>
              {currentItemType && currentItemId ? (
                <button
                  onClick={() => handleConnect(suggestion)}
                  disabled={isPending && pendingKey === key}
                  className="rounded-md bg-surface-2 px-2 py-1 text-2xs font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
                >
                  Connect
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
