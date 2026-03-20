'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EditableFieldProps {
  label: string;
  value: string | null | undefined;
  onSave: (value: string) => void;
  type?: 'text' | 'textarea' | 'date' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  emptyLabel?: string;
}

export function EditableField({
  label,
  value,
  onSave,
  type = 'text',
  options,
  placeholder,
  emptyLabel = 'Not set',
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? '');
  const selectedOption = useMemo(
    () => (type === 'select' ? options?.find((option) => option.value === value) : undefined),
    [options, type, value]
  );

  useEffect(() => {
    setEditValue(value ?? '');
  }, [value]);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value ?? '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-1">
        <label className="text-2xs font-medium uppercase tracking-wider text-text-muted">
          {label}
        </label>
        {type === 'textarea' ? (
          <textarea
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancel();
              if (e.key === 'Enter' && e.metaKey) handleSave();
            }}
            placeholder={placeholder}
            rows={4}
            className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100 resize-y"
          />
        ) : type === 'select' && options ? (
          <select
            autoFocus
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              onSave(e.target.value);
              setIsEditing(false);
            }}
            className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="">—</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder={placeholder}
            className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
          />
        )}
        {type === 'textarea' && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-md bg-brand-600 px-3 py-1 text-2xs font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="rounded-md px-3 py-1 text-2xs font-medium text-text-muted hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="group cursor-pointer space-y-0.5"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <Pencil
          size={10}
          className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
      <p
        className={cn(
          'text-sm',
          value ? 'text-text-primary' : 'text-text-muted italic'
        )}
      >
        {selectedOption?.label || value || emptyLabel}
      </p>
    </div>
  );
}
