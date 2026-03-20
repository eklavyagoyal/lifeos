'use client';

import { useRouter } from 'next/navigation';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { StatusBadge } from '@/components/detail/status-badge';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { updateEntityAction, archiveEntityAction } from '@/app/actions';
import { formatDate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';

interface Entity {
  id: string;
  title: string;
  entityType: string;
  body: string | null;
  metadata: string | null;
  parsedMetadata: Record<string, unknown>;
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

// Status options per learning type
const BOOK_STATUS_OPTIONS = [
  { value: 'to_read', label: 'To Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
];

const ARTICLE_STATUS_OPTIONS = [
  { value: 'to_read', label: 'To Read' },
  { value: 'read', label: 'Read' },
];

const COURSE_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
];

const TYPE_LABELS: Record<string, string> = {
  book: '📚 Book',
  article: '📄 Article',
  course: '🎓 Course',
};

interface LearningDetailClientProps {
  entity: Entity;
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
}

export function LearningDetailClient({
  entity,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
}: LearningDetailClientProps) {
  const router = useRouter();
  const meta = entity.parsedMetadata as Record<string, unknown>;

  const statusOptions = entity.entityType === 'book'
    ? BOOK_STATUS_OPTIONS
    : entity.entityType === 'article'
    ? ARTICLE_STATUS_OPTIONS
    : COURSE_STATUS_OPTIONS;

  const handleUpdate = async (field: string, value: unknown) => {
    await updateEntityAction(entity.id, { [field]: value });
  };

  const handleMetadataUpdate = async (key: string, value: unknown) => {
    const newMeta = { ...meta, [key]: value };
    await updateEntityAction(entity.id, { metadata: newMeta });
  };

  const handleArchive = async () => {
    await archiveEntityAction(entity.id, entity.entityType);
    router.push('/learning');
  };

  return (
    <DetailPageShell
      backHref="/learning"
      backLabel="Learning"
      title={entity.title}
      onTitleChange={(title) => handleUpdate('title', title)}
      badge={
        meta.status ? (
          <StatusBadge status={meta.status as string} />
        ) : (
          <span className="badge bg-surface-2 text-text-muted text-2xs">
            {TYPE_LABELS[entity.entityType] ?? entity.entityType}
          </span>
        )
      }
      onArchive={handleArchive}
    >
      {/* Metadata — varies by type */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Status"
            value={(meta.status as string) ?? null}
            onSave={(v) => handleMetadataUpdate('status', v)}
            type="select"
            options={statusOptions}
          />

          {/* Book: author, rating */}
          {entity.entityType === 'book' && (
            <>
              <EditableField
                label="Author"
                value={(meta.author as string) ?? null}
                onSave={(v) => handleMetadataUpdate('author', v)}
                placeholder="Book author..."
              />
              <EditableField
                label="Rating"
                value={meta.rating !== undefined ? String(meta.rating) : null}
                onSave={(v) => handleMetadataUpdate('rating', v ? parseInt(v) : null)}
                placeholder="1–5"
              />
            </>
          )}

          {/* Article: url, source */}
          {entity.entityType === 'article' && (
            <>
              <EditableField
                label="URL"
                value={(meta.url as string) ?? null}
                onSave={(v) => handleMetadataUpdate('url', v)}
                placeholder="https://..."
              />
              <EditableField
                label="Source"
                value={(meta.source as string) ?? null}
                onSave={(v) => handleMetadataUpdate('source', v)}
                placeholder="Blog, publication..."
              />
            </>
          )}

          {/* Course: platform, instructor, progress */}
          {entity.entityType === 'course' && (
            <>
              <EditableField
                label="Platform"
                value={(meta.platform as string) ?? null}
                onSave={(v) => handleMetadataUpdate('platform', v)}
                placeholder="Coursera, Udemy..."
              />
              <EditableField
                label="Instructor"
                value={(meta.instructor as string) ?? null}
                onSave={(v) => handleMetadataUpdate('instructor', v)}
                placeholder="Instructor name..."
              />
            </>
          )}

          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Type
            </span>
            <p className="text-sm text-text-primary capitalize">{entity.entityType}</p>
          </div>
        </div>
      </div>

      {/* Course progress bar */}
      {entity.entityType === 'course' && (
        <div className="card">
          <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">Progress</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-surface-3">
              <div
                className="h-2 rounded-full bg-brand-500 transition-all"
                style={{ width: `${Math.min(100, Number(meta.progress) || 0)}%` }}
              />
            </div>
            <EditableField
              label=""
              value={meta.progress !== undefined ? String(meta.progress) : null}
              onSave={(v) => handleMetadataUpdate('progress', v ? parseInt(v) : 0)}
              placeholder="0"
            />
            <span className="text-xs text-text-muted">%</span>
          </div>
        </div>
      )}

      {/* Notes / Takeaways */}
      <div className="card">
        <EditableField
          label="Notes & Takeaways"
          value={entity.body}
          onSave={(v) => handleUpdate('body', v)}
          type="textarea"
          placeholder="Key insights, highlights, reflections..."
          emptyLabel="Add your notes..."
        />
      </div>

      {/* Tags */}
      <div className="card">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">Tags</h3>
        <TagsPills itemType="entity" itemId={entity.id} tags={tags} />
      </div>

      {/* Relations */}
      <RelationsPanel
        items={relatedItems}
        structuralItems={structuralItems}
        suggestions={suggestedItems}
        currentItemType="entity"
        currentItemId={entity.id}
      />
    </DetailPageShell>
  );
}
