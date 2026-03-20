'use client';

import { useRouter } from 'next/navigation';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { archiveEventAction, updateEventAction } from '@/app/actions';
import { formatDate, formatISODate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import { CalendarDays, Star } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  body: string | null;
  eventDate: string;
  eventEndDate: string | null;
  eventType: string | null;
  importance: number | null;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}

type RelatedItem = ConnectionItem;
type SuggestedItem = ConnectionSuggestion;

interface Tag {
  id: string;
  name: string;
  color: string | null;
  itemTagId: string;
}

interface EventDetailClientProps {
  event: Event;
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
}

const EVENT_TYPE_OPTIONS = [
  { value: 'life_event', label: 'Life Event' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'trip', label: 'Trip' },
  { value: 'memory', label: 'Memory' },
  { value: 'achievement', label: 'Achievement' },
];

export function EventDetailClient({
  event,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
}: EventDetailClientProps) {
  const router = useRouter();

  const handleUpdate = async (field: string, value: unknown) => {
    await updateEventAction(event.id, { [field]: value });
    router.refresh();
  };

  const handleArchive = async () => {
    await archiveEventAction(event.id);
    router.push('/timeline');
  };

  const subtitle = event.eventEndDate && event.eventEndDate !== event.eventDate
    ? `${formatISODate(event.eventDate)} → ${formatISODate(event.eventEndDate)}`
    : formatISODate(event.eventDate);

  return (
    <DetailPageShell
      backHref="/timeline"
      backLabel="Timeline"
      title={event.title}
      subtitle={subtitle}
      onTitleChange={(title) => handleUpdate('title', title)}
      badge={
        event.eventType ? (
          <span className="badge bg-surface-2 text-text-tertiary">
            <CalendarDays size={12} />
            {EVENT_TYPE_OPTIONS.find((option) => option.value === event.eventType)?.label ?? event.eventType}
          </span>
        ) : undefined
      }
      onArchive={handleArchive}
    >
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Event Type"
            value={event.eventType}
            onSave={(value) => handleUpdate('eventType', value || null)}
            type="select"
            options={EVENT_TYPE_OPTIONS}
          />
          <EditableField
            label="Start Date"
            value={event.eventDate}
            onSave={(value) => handleUpdate('eventDate', value)}
            type="date"
          />
          <EditableField
            label="End Date"
            value={event.eventEndDate}
            onSave={(value) => handleUpdate('eventEndDate', value || null)}
            type="date"
          />
          <EditableField
            label="Importance"
            value={String(event.importance ?? 3)}
            onSave={(value) => handleUpdate('importance', Number.parseInt(value, 10) || 3)}
            type="number"
          />
        </div>

        <div className="mt-4 flex items-center gap-4 text-2xs text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Star size={12} />
            Importance {event.importance ?? 3}/5
          </span>
          <span>Created {formatDate(event.createdAt)}</span>
          <span>Updated {formatDate(event.updatedAt)}</span>
        </div>
      </div>

      <div className="card">
        <EditableField
          label="Notes"
          value={event.body}
          onSave={(value) => handleUpdate('body', value)}
          type="textarea"
          placeholder="Context, memory details, or meaning..."
          emptyLabel="Add notes..."
        />
      </div>

      <div className="card">
        <h3 className="mb-2 text-2xs font-medium uppercase tracking-wider text-text-muted">
          Tags
        </h3>
        <TagsPills itemType="event" itemId={event.id} tags={tags} />
      </div>

      <RelationsPanel
        items={relatedItems}
        structuralItems={structuralItems}
        suggestions={suggestedItems}
        currentItemType="event"
        currentItemId={event.id}
      />
    </DetailPageShell>
  );
}
