'use client';

import { useRouter } from 'next/navigation';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { StatusBadge } from '@/components/detail/status-badge';
import { AttachmentsPanel, type AttachmentListItem } from '@/components/detail/attachments-panel';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { updateIdeaAction, archiveIdeaAction } from '@/app/actions';
import { formatDate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';

interface Idea {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  stage: string | null;
  theme: string | null;
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

const STAGE_OPTIONS = [
  { value: 'seed', label: '🌱 Seed' },
  { value: 'developing', label: '🌿 Developing' },
  { value: 'mature', label: '🌳 Mature' },
  { value: 'implemented', label: '✅ Implemented' },
  { value: 'archived', label: '📦 Archived' },
];

interface IdeaDetailClientProps {
  idea: Idea;
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
  attachments: AttachmentListItem[];
}

export function IdeaDetailClient({
  idea,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
  attachments,
}: IdeaDetailClientProps) {
  const router = useRouter();

  const handleUpdate = async (field: string, value: unknown) => {
    await updateIdeaAction(idea.id, { [field]: value });
  };

  const handleArchive = async () => {
    await archiveIdeaAction(idea.id);
    router.push('/ideas');
  };

  return (
    <DetailPageShell
      backHref="/ideas"
      backLabel="Ideas"
      title={idea.title}
      onTitleChange={(title) => handleUpdate('title', title)}
      badge={
        idea.stage ? (
          <StatusBadge status={idea.stage} />
        ) : undefined
      }
      onArchive={handleArchive}
    >
      {/* Metadata */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Stage"
            value={idea.stage}
            onSave={(v) => handleUpdate('stage', v)}
            type="select"
            options={STAGE_OPTIONS}
          />
          <EditableField
            label="Theme"
            value={idea.theme}
            onSave={(v) => handleUpdate('theme', v)}
            placeholder="e.g. productivity, health..."
          />
          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Created
            </span>
            <p className="text-sm text-text-primary">{formatDate(idea.createdAt)}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Updated
            </span>
            <p className="text-sm text-text-primary">{formatDate(idea.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="card">
        <EditableField
          label="Summary"
          value={idea.summary}
          onSave={(v) => handleUpdate('summary', v)}
          placeholder="One-liner pitch for this idea..."
          emptyLabel="Add a summary..."
        />
      </div>

      {/* Body */}
      <div className="card">
        <EditableField
          label="Notes"
          value={idea.body}
          onSave={(v) => handleUpdate('body', v)}
          type="textarea"
          placeholder="Explore the idea... (markdown supported)"
          emptyLabel="Start exploring..."
        />
      </div>

      {/* Tags */}
      <div className="card">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">Tags</h3>
        <TagsPills itemType="idea" itemId={idea.id} tags={tags} />
      </div>

      <AttachmentsPanel itemType="idea" itemId={idea.id} attachments={attachments} />

      {/* Relations */}
      <RelationsPanel
        items={relatedItems}
        structuralItems={structuralItems}
        suggestions={suggestedItems}
        currentItemType="idea"
        currentItemId={idea.id}
      />
    </DetailPageShell>
  );
}
