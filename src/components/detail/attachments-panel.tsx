'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileUp, Paperclip, Trash2 } from 'lucide-react';
import { removeAttachmentLinkAction, uploadAttachmentAction } from '@/app/actions';
import type { ItemType } from '@/lib/types';

export interface AttachmentListItem {
  linkId: string;
  attachmentId: string;
  label: string | null;
  originalName: string;
  fileExtension: string | null;
  mimeType: string | null;
  fileSize: number;
  sourceType: 'upload' | 'import';
  searchStatus: 'pending' | 'indexed' | 'unsupported' | 'failed';
  searchSummary: string | null;
  sharedItemCount: number;
  createdAt: number;
  url: string;
}

interface AttachmentsPanelProps {
  itemType: ItemType;
  itemId: string;
  attachments: AttachmentListItem[];
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getSearchStatusLabel(status: AttachmentListItem['searchStatus']) {
  switch (status) {
    case 'indexed':
      return 'Searchable';
    case 'pending':
      return 'Indexing';
    case 'failed':
      return 'Index failed';
    default:
      return 'Binary';
  }
}

function getSearchStatusClassName(status: AttachmentListItem['searchStatus']) {
  switch (status) {
    case 'indexed':
      return 'bg-green-500/10 text-green-700';
    case 'pending':
      return 'bg-brand-100 text-brand-700';
    case 'failed':
      return 'bg-red-500/10 text-red-700';
    default:
      return 'bg-surface-2 text-text-muted';
  }
}

export function AttachmentsPanel({ itemType, itemId, attachments }: AttachmentsPanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleUpload = () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      setError('Choose one or more files first.');
      return;
    }

    const formData = new FormData();
    if (label.trim()) {
      formData.set('label', label.trim());
    }
    for (const file of files) {
      formData.append('files', file);
    }

    startTransition(async () => {
      setError(null);
      const result = await uploadAttachmentAction(itemType, itemId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setLabel('');
      router.refresh();
    });
  };

  const handleRemove = (linkId: string) => {
    startTransition(async () => {
      await removeAttachmentLinkAction(linkId, itemType, itemId);
      router.refresh();
    });
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip size={16} className="text-text-muted" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Attachments</h3>
            <p className="text-2xs text-text-muted">
              Files are copied into your configured attachments directory.
            </p>
          </div>
        </div>
        <span className="text-2xs text-text-muted">
          {attachments.length} file{attachments.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="rounded-lg border border-dashed border-surface-3 bg-surface-1 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="block text-2xs font-medium uppercase tracking-wider text-text-muted">
              Files
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text-primary hover:file:bg-surface-3"
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-56">
            <label className="block text-2xs font-medium uppercase tracking-wider text-text-muted">
              Label
            </label>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Optional note or caption"
              className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <FileUp size={14} />
            {isPending ? 'Uploading…' : 'Attach'}
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-xs text-status-danger">{error}</p>
        ) : null}
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-text-muted">
          No attachments yet. Upload files here to keep supporting material alongside this item.
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.linkId}
              className="flex items-center gap-3 rounded-lg border border-surface-3 bg-surface-1 px-3 py-2"
            >
              <Paperclip size={14} className="text-text-muted" />
              <div className="min-w-0 flex-1">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm text-text-primary hover:text-brand-600"
                >
                  {attachment.originalName}
                </a>
                <p className="truncate text-2xs text-text-muted">
                  {attachment.label ? `${attachment.label} · ` : ''}
                  {formatFileSize(attachment.fileSize)} · {attachment.sourceType}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-2xs ${getSearchStatusClassName(attachment.searchStatus)}`}>
                    {getSearchStatusLabel(attachment.searchStatus)}
                  </span>
                  {attachment.sharedItemCount > 0 ? (
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-2xs text-text-muted">
                      Shared with {attachment.sharedItemCount} other item{attachment.sharedItemCount !== 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
                {attachment.searchSummary ? (
                  <p className="mt-1 line-clamp-2 text-2xs text-text-muted">
                    {attachment.searchSummary}
                  </p>
                ) : null}
              </div>
              <a
                href={`${attachment.url}?download=1`}
                className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
                title="Download"
              >
                <Download size={14} />
              </a>
              <button
                type="button"
                onClick={() => handleRemove(attachment.linkId)}
                disabled={isPending}
                className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-status-danger disabled:opacity-50"
                title="Remove link"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
