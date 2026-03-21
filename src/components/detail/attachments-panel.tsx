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
      return 'border-[rgba(96,127,97,0.2)] bg-[rgba(228,239,229,0.92)] text-[rgb(78,107,81)]';
    case 'pending':
      return 'border-[rgba(90,131,188,0.18)] bg-[rgba(229,239,251,0.92)] text-[rgb(69,106,160)]';
    case 'failed':
      return 'border-[rgba(194,97,78,0.2)] bg-[rgba(252,231,227,0.92)] text-[rgb(155,77,62)]';
    default:
      return 'border-line-soft bg-surface-0/82 text-text-muted';
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
    <div className="detail-side-panel">
      <div className="detail-panel-header">
        <div className="flex min-w-0 items-start gap-3">
          <div className="capture-icon-orb h-11 w-11 border-[rgba(108,136,185,0.18)] bg-[radial-gradient(circle_at_top,rgba(230,239,250,0.96),rgba(186,208,235,0.78))]">
            <Paperclip size={16} className="text-[rgb(69,106,160)]" />
          </div>
          <div>
            <div className="section-kicker text-[0.58rem]">Attachments</div>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">
              Supporting material around the main record
            </h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Files are copied into your configured attachments directory and kept attached to this item as durable context.
            </p>
          </div>
        </div>

        <span className="shell-meta-pill">
          {attachments.length} file{attachments.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="rounded-[1.35rem] border border-dashed border-line-soft bg-surface-0/66 p-4 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)_auto] lg:items-end">
          <div className="space-y-1.5">
            <label className="detail-field-label">Files</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-[0.95rem] file:border-0 file:bg-surface-1 file:px-3 file:py-2 file:text-xs file:font-medium file:text-text-primary hover:file:bg-surface-hover"
            />
          </div>
          <div className="space-y-1.5">
            <label className="detail-field-label">Label</label>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Optional caption or note"
              className="detail-field-input"
            />
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-[1rem] bg-brand-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <FileUp size={14} />
            {isPending ? 'Uploading…' : 'Attach'}
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-status-danger">{error}</p>
        ) : null}
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm leading-6 text-text-muted">
          No attachments yet. Add PDFs, screenshots, notes, or other supporting artifacts when this record needs more context than text alone.
        </p>
      ) : (
        <div className="space-y-2.5">
          {attachments.map((attachment) => (
            <div key={attachment.linkId} className="detail-list-row">
              <div className="capture-icon-orb h-10 w-10 border-[rgba(121,95,67,0.14)] bg-[linear-gradient(135deg,rgba(255,251,245,0.9),rgba(245,235,219,0.78))]">
                <Paperclip size={14} className="text-text-secondary" />
              </div>

              <div className="min-w-0 flex-1">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-medium text-text-primary transition-colors hover:text-brand-700"
                >
                  {attachment.originalName}
                </a>
                <p className="truncate text-xs leading-5 text-text-muted">
                  {attachment.label ? `${attachment.label} · ` : ''}
                  {formatFileSize(attachment.fileSize)} · {attachment.sourceType}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium ${getSearchStatusClassName(attachment.searchStatus)}`}>
                    {getSearchStatusLabel(attachment.searchStatus)}
                  </span>
                  {attachment.sharedItemCount > 0 ? (
                    <span className="badge text-text-secondary">
                      Shared with {attachment.sharedItemCount} other item{attachment.sharedItemCount !== 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
                {attachment.searchSummary ? (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-text-secondary">
                    {attachment.searchSummary}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-1">
                <a
                  href={`${attachment.url}?download=1`}
                  className="rounded-full p-2 text-text-muted transition-colors hover:bg-surface-1 hover:text-text-primary"
                  title="Download"
                >
                  <Download size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => handleRemove(attachment.linkId)}
                  disabled={isPending}
                  className="rounded-full p-2 text-text-muted transition-colors hover:bg-surface-1 hover:text-status-danger disabled:opacity-50"
                  title="Remove link"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
