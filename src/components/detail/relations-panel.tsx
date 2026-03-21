'use client';

import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const visibleCount = outgoing.length + incoming.length + structuralItems.length;
  const hasAnyContent = visibleCount > 0 || suggestions.length > 0;

  if (!hasAnyContent && !onAddClick) return null;

  return (
    <div className="detail-side-panel">
      <div className="detail-panel-header">
        <div className="flex min-w-0 items-start gap-3">
          <div className="capture-icon-orb h-11 w-11 border-[rgba(103,126,105,0.18)] bg-[radial-gradient(circle_at_top,rgba(228,239,229,0.96),rgba(191,213,193,0.78))]">
            <Link2 size={16} className="text-[rgb(78,107,81)]" />
          </div>
          <div>
            <div className="section-kicker text-[0.58rem]">Connections</div>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">
              Companion links around this record
            </h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Backlinks, outgoing links, inferred structure, and suggestion candidates all live here so the main artifact never feels isolated.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visibleCount > 0 ? (
            <span className="shell-meta-pill">{visibleCount} linked</span>
          ) : null}
          {onAddClick ? (
            <button
              type="button"
              onClick={onAddClick}
              className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-0/78 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              <Plus size={12} />
              Link
            </button>
          ) : null}
        </div>
      </div>

      {!hasAnyContent ? (
        <p className="text-sm text-text-muted">
          No connected items yet. Add a link once this record starts pointing outward.
        </p>
      ) : (
        <div className="space-y-5">
          {incoming.length > 0 ? (
            <ConnectionSection
              title="Backlinks"
              description="Items that already point here."
              items={incoming}
            />
          ) : null}

          {outgoing.length > 0 ? (
            <ConnectionSection
              title="Outgoing Links"
              description="Items this page intentionally points to."
              items={outgoing}
            />
          ) : null}

          {structuralItems.length > 0 ? (
            <ConnectionSection
              title="Inferred Links"
              description="Connections inferred from structure, shared files, or parent relationships."
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
    <div className="space-y-2.5">
      <div>
        <div className="section-kicker text-[0.58rem]">{title}</div>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <RelationRow
            key={`${item.direction}:${item.type}:${item.id}:${item.relation?.id ?? item.relationLabel}`}
            item={item}
            structural={structural}
          />
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
    <div className={cn('detail-list-row group', isRemoving && 'opacity-40')}>
      <div className="capture-icon-orb h-10 w-10 border-[rgba(121,95,67,0.14)] bg-[linear-gradient(135deg,rgba(255,251,245,0.9),rgba(245,235,219,0.78))]">
        <span className="text-text-secondary">{icon}</span>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className="block truncate text-sm font-medium text-text-primary transition-colors hover:text-brand-700"
        >
          {item.title}
        </Link>
        {item.subtitle ? (
          <p className="truncate text-xs leading-5 text-text-muted">{item.subtitle}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="badge text-text-secondary">{relationLabel}</span>
        {!structural && item.relation ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            className="rounded-full p-1 text-text-muted opacity-0 transition-all hover:bg-surface-1 hover:text-status-danger group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        ) : null}
      </div>
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
    <div className="space-y-2.5">
      <div>
        <div className="section-kicker text-[0.58rem]">Suggested Connections</div>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Nearby items surfaced from shared tags and mention-like text matches.
        </p>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const key = `${suggestion.type}:${suggestion.id}`;
          const icon = TYPE_ICONS[suggestion.type] ?? <Link2 size={14} />;

          return (
            <div key={key} className="detail-list-row">
              <div className="capture-icon-orb h-10 w-10 border-[rgba(121,95,67,0.14)] bg-[linear-gradient(135deg,rgba(255,251,245,0.9),rgba(245,235,219,0.78))]">
                <span className="text-text-secondary">{icon}</span>
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  href={suggestion.detailUrl}
                  className="block truncate text-sm font-medium text-text-primary transition-colors hover:text-brand-700"
                >
                  {suggestion.title}
                </Link>
                {suggestion.subtitle ? (
                  <p className="truncate text-xs leading-5 text-text-muted">{suggestion.subtitle}</p>
                ) : null}
                <p className="truncate text-xs leading-5 text-text-secondary">
                  {getSuggestionSummary(suggestion)}
                </p>
                {suggestion.reason === 'shared_tags_and_mentions' && suggestion.snippet ? (
                  <p className="truncate text-xs leading-5 text-text-muted">
                    Mention match: {suggestion.snippet}
                  </p>
                ) : null}
              </div>

              {currentItemType && currentItemId ? (
                <button
                  type="button"
                  onClick={() => handleConnect(suggestion)}
                  disabled={isPending && pendingKey === key}
                  className="rounded-full border border-line-soft bg-surface-0/8 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
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
