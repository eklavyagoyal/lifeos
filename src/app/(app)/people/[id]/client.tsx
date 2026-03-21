'use client';

import { useRouter } from 'next/navigation';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { updateEntityAction, archiveEntityAction } from '@/app/actions';
import { formatDate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import type { PersonMetadata } from '@/server/services/entities';

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

interface PersonDetailClientProps {
  entity: Entity;
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
}

export function PersonDetailClient({
  entity,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
}: PersonDetailClientProps) {
  const router = useRouter();
  const meta = entity.parsedMetadata as PersonMetadata;

  const handleUpdate = async (field: string, value: unknown) => {
    await updateEntityAction(entity.id, { [field]: value });
    router.refresh();
  };

  const handleMetadataUpdate = async (key: string, value: unknown) => {
    const newMeta = { ...meta, [key]: value };
    await updateEntityAction(entity.id, { metadata: newMeta });
    router.refresh();
  };

  const handleArchive = async () => {
    await archiveEntityAction(entity.id, 'person');
    router.push('/people');
  };

  return (
    <DetailPageShell
      backHref="/people"
      backLabel="People"
      title={entity.title}
      onTitleChange={(title) => handleUpdate('title', title)}
      onArchive={handleArchive}
    >
      {/* Contact & Context */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Relationship"
            value={meta.relationship ?? null}
            onSave={(v) => handleMetadataUpdate('relationship', v)}
            placeholder="friend, mentor, colleague..."
          />
          <EditableField
            label="Company / Org"
            value={meta.company ?? null}
            onSave={(v) => handleMetadataUpdate('company', v)}
            placeholder="Where they work..."
          />
          <EditableField
            label="Role"
            value={meta.role ?? null}
            onSave={(v) => handleMetadataUpdate('role', v)}
            placeholder="Their role..."
          />
          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Added
            </span>
            <p className="text-sm text-text-primary">{formatDate(entity.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="card">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-3">Contact</h3>
        <div className="grid grid-cols-2 gap-4">
          <EditableField
            label="Email"
            value={meta.email ?? null}
            onSave={(v) => handleMetadataUpdate('email', v)}
            placeholder="email@example.com"
          />
          <EditableField
            label="Phone"
            value={meta.phone ?? null}
            onSave={(v) => handleMetadataUpdate('phone', v)}
            placeholder="+1 234 567 890"
          />
        </div>
      </div>

      {/* Notes / Context */}
      <div className="card">
        <EditableField
          label="Notes & Context"
          value={entity.body}
          onSave={(v) => handleUpdate('body', v)}
          type="textarea"
          placeholder="What should you remember about this person?"
          emptyLabel="Add context..."
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
