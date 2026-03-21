'use client';

import { useRouter } from 'next/navigation';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { StatusBadge } from '@/components/detail/status-badge';
import { AttachmentsPanel, type AttachmentListItem } from '@/components/detail/attachments-panel';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { updateJournalAction, archiveJournalAction } from '@/app/actions';
import { formatDate, formatISODate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import { MOOD_LABELS } from '@/lib/constants';

interface JournalEntry {
  id: string;
  title: string | null;
  body: string | null;
  entryDate: string;
  entryTime: string | null;
  entryType: string | null;
  mood: number | null;
  energy: number | null;
  wordCount: number | null;
  isPinned: number | null;
  createdAt: number;
  updatedAt: number;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
  itemTagId: string;
}

type RelatedItem = ConnectionItem;
type SuggestedItem = ConnectionSuggestion;

const ENTRY_TYPE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'reflection', label: 'Reflection' },
  { value: 'gratitude', label: 'Gratitude' },
  { value: 'freeform', label: 'Freeform' },
  { value: 'evening_review', label: 'Evening Review' },
];

const MOOD_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} — ${MOOD_LABELS[i + 1] || ''}`,
}));

const ENERGY_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}/10`,
}));

interface JournalDetailClientProps {
  entry: JournalEntry;
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
  attachments: AttachmentListItem[];
}

export function JournalDetailClient({
  entry,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
  attachments,
}: JournalDetailClientProps) {
  const router = useRouter();

  const displayTitle = entry.title || `Journal — ${formatISODate(entry.entryDate)}`;

  const handleUpdate = async (field: string, value: unknown) => {
    await updateJournalAction(entry.id, { [field]: value });
    router.refresh();
  };

  const handleArchive = async () => {
    await archiveJournalAction(entry.id);
    router.push('/journal');
  };

  return (
    <DetailPageShell
      backHref="/journal"
      backLabel="Journal"
      title={displayTitle}
      onTitleChange={(title) => handleUpdate('title', title)}
      subtitle={`${formatISODate(entry.entryDate)}${entry.entryTime ? ` at ${entry.entryTime}` : ''}`}
      badge={entry.entryType ? <StatusBadge status={entry.entryType} /> : undefined}
      onArchive={handleArchive}
    >
      {/* Mood & Energy */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Entry Type"
            value={entry.entryType}
            onSave={(v) => handleUpdate('entryType', v)}
            type="select"
            options={ENTRY_TYPE_OPTIONS}
          />
          <EditableField
            label="Mood"
            value={entry.mood?.toString()}
            onSave={(v) => handleUpdate('mood', parseInt(v) || null)}
            type="select"
            options={MOOD_OPTIONS}
          />
          <EditableField
            label="Energy"
            value={entry.energy?.toString()}
            onSave={(v) => handleUpdate('energy', parseInt(v) || null)}
            type="select"
            options={ENERGY_OPTIONS}
          />
          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Words
            </span>
            <p className="text-sm text-text-primary">{entry.wordCount ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="card">
        <EditableField
          label="Entry"
          value={entry.body}
          onSave={(v) => handleUpdate('body', v)}
          type="textarea"
          placeholder="Write your thoughts..."
          emptyLabel="Start writing..."
        />
      </div>

      {/* Tags */}
      <div className="card">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">Tags</h3>
        <TagsPills itemType="journal" itemId={entry.id} tags={tags} />
      </div>

      <AttachmentsPanel itemType="journal" itemId={entry.id} attachments={attachments} />

      {/* Relations */}
      <RelationsPanel
        items={relatedItems}
        structuralItems={structuralItems}
        suggestions={suggestedItems}
        currentItemType="journal"
        currentItemId={entry.id}
      />
    </DetailPageShell>
  );
}
