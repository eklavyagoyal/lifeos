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
      <div className="detail-field-card detail-field-card-editing space-y-3">
        <div className="detail-field-label">{label}</div>
        {type === 'textarea' ? (
          <textarea
            autoFocus
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') handleCancel();
              if (event.key === 'Enter' && event.metaKey) handleSave();
            }}
            placeholder={placeholder}
            rows={4}
            className="detail-field-textarea"
          />
        ) : type === 'select' && options ? (
          <select
            autoFocus
            value={editValue}
            onChange={(event) => {
              setEditValue(event.target.value);
              onSave(event.target.value);
              setIsEditing(false);
            }}
            className="detail-field-select"
          >
            <option value="">—</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            type={type}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onBlur={handleSave}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSave();
              if (event.key === 'Escape') handleCancel();
            }}
            placeholder={placeholder}
            className="detail-field-input"
          />
        )}

        {type === 'textarea' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-[0.95rem] bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-[0.95rem] border border-line-soft bg-surface-0/76 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-300 hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        'detail-field-card group',
        type === 'textarea' && 'min-h-[8.5rem]'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="detail-field-label">{label}</span>
        <span className="inline-flex items-center gap-1 text-2xs text-text-muted opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil size={11} />
          Edit
        </span>
      </div>

      <div
        className={cn(
          'mt-3',
          type === 'textarea'
            ? value
              ? 'whitespace-pre-wrap text-sm leading-7 text-text-primary'
              : 'text-sm italic text-text-muted'
            : value || selectedOption
              ? 'text-sm font-medium leading-6 text-text-primary'
              : 'text-sm italic text-text-muted'
        )}
      >
        {selectedOption?.label || value || emptyLabel}
      </div>
    </button>
  );
}
