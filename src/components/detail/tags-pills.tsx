'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { addTagAction, removeTagAction } from '@/app/actions';

interface Tag {
  id: string;
  name: string;
  color: string | null;
  itemTagId: string;
}

interface TagsPillsProps {
  itemType: string;
  itemId: string;
  tags: Tag[];
}

export function TagsPills({ itemType, itemId, tags }: TagsPillsProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const handleAdd = async () => {
    const name = tagInput.trim();
    if (!name) return;
    await addTagAction(itemType, itemId, name);
    setTagInput('');
    setIsAdding(false);
    router.refresh();
  };

  const handleRemove = async (tagId: string) => {
    await removeTagAction(itemType, itemId, tagId);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag.itemTagId}
          className="group inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-0/82 px-3 py-1.5 text-xs font-medium text-text-secondary shadow-soft"
        >
          <span>#{tag.name}</span>
          <button
            type="button"
            onClick={() => handleRemove(tag.id)}
            className="rounded-full p-0.5 text-text-muted opacity-0 transition-all hover:bg-surface-1 hover:text-status-danger group-hover:opacity-100"
          >
            <X size={11} />
          </button>
        </span>
      ))}

      {isAdding ? (
        <input
          autoFocus
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleAdd();
            if (event.key === 'Escape') {
              setIsAdding(false);
              setTagInput('');
            }
          }}
          onBlur={() => {
            if (tagInput.trim()) handleAdd();
            else {
              setIsAdding(false);
              setTagInput('');
            }
          }}
          placeholder="Tag name..."
          className="detail-field-input w-32 rounded-full px-3 py-1.5 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-soft bg-surface-0/68 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-brand-300 hover:bg-surface-hover hover:text-brand-700"
        >
          <Plus size={12} />
          Tag
        </button>
      )}
    </div>
  );
}
