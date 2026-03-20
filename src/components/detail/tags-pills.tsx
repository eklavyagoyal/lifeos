'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus } from 'lucide-react';
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
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.itemTagId}
          className="group inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-2xs font-medium text-text-secondary"
        >
          {tag.name}
          <button
            onClick={() => handleRemove(tag.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-status-danger"
          >
            <X size={10} />
          </button>
        </span>
      ))}

      {isAdding ? (
        <input
          autoFocus
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') {
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
          className="rounded-full border border-brand-300 bg-surface-0 px-2.5 py-0.5 text-2xs outline-none focus:ring-1 focus:ring-brand-200 w-24"
        />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-surface-4 px-2 py-0.5 text-2xs text-text-muted hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <Plus size={10} />
          Tag
        </button>
      )}
    </div>
  );
}
