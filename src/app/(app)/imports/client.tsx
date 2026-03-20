'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
  FolderPlus,
  Link2,
  Loader2,
  RefreshCw,
  Undo2,
  Upload,
} from 'lucide-react';
import { previewImportAction, rollbackImportRunAction, runImportAction } from '@/app/actions';
import type { ImportType } from '@/lib/types';
import type {
  ImportPreviewItem,
  ImportPreviewMappingGroup,
  ImportPreviewResult,
  ImportRunSummary,
} from '@/server/services/imports';

const IMPORT_OPTIONS: Array<{
  value: ImportType;
  label: string;
  description: string;
  sourceHint: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'obsidian_vault',
    label: 'Obsidian Vault',
    description: 'Imports markdown notes, tags, wiki links, and embedded local files from a vault folder.',
    sourceHint: '/path/to/Obsidian/Vault',
    icon: <FolderOpen size={16} />,
  },
  {
    value: 'notion_export',
    label: 'Notion Export',
    description: 'Imports extracted or zipped Markdown and CSV exports, including markdown pages and database rows.',
    sourceHint: '/path/to/Notion Export.zip',
    icon: <FileArchive size={16} />,
  },
  {
    value: 'day_one_json',
    label: 'Day One JSON',
    description: 'Imports journal entries, tags, and media from a Day One JSON export file or zip.',
    sourceHint: '/path/to/day-one-export.zip',
    icon: <FileJson size={16} />,
  },
  {
    value: 'todoist_csv',
    label: 'Todoist CSV',
    description: 'Imports tasks, sections, priorities, labels, and project context from a Todoist CSV export.',
    sourceHint: '/path/to/todoist-export.csv',
    icon: <FileSpreadsheet size={16} />,
  },
];

interface ImportsClientProps {
  initialRuns: ImportRunSummary[];
  attachmentsPath: string;
}

function formatTimestamp(value: number | null) {
  if (!value) return 'Still running';
  return new Date(value).toLocaleString();
}

function canRollbackRun(run: ImportRunSummary) {
  return (
    run.mode === 'import' &&
    run.status === 'completed' &&
    (run.stats?.imported ?? 0) > 0 &&
    run.details?.rollback?.status !== 'rolled_back'
  );
}

function StatusBadge({ status }: { status: ImportRunSummary['status'] }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-2xs font-medium text-green-700">
        <CheckCircle2 size={12} />
        Completed
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-700">
        <AlertTriangle size={12} />
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-700">
      <Loader2 size={12} className="animate-spin" />
      Running
    </span>
  );
}

export function ImportsClient({ initialRuns, attachmentsPath }: ImportsClientProps) {
  const [importType, setImportType] = useState<ImportType>('obsidian_vault');
  const [sourcePath, setSourcePath] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [runs, setRuns] = useState(initialRuns);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  const selectedOption = useMemo(
    () => IMPORT_OPTIONS.find((option) => option.value === importType) ?? IMPORT_OPTIONS[0],
    [importType]
  );

  const handlePreview = () => {
    startTransition(async () => {
      setPendingAction('preview');
      setError(null);
      setNotice(null);

      const response = await previewImportAction(importType, sourcePath);
      if (response.error) {
        setPreview(null);
        setError(response.error);
      } else {
        setPreview(response.preview ?? null);
        if (response.preview) {
          setNotice(`Prepared a ${response.preview.importType} preview with ${response.preview.stats.totalItems} detected items.`);
        }
      }

      if (response.runs) {
        setRuns(response.runs);
      }

      setPendingAction(null);
    });
  };

  const handleImport = () => {
    startTransition(async () => {
      setPendingAction('import');
      setError(null);
      setNotice(null);

      const response = await runImportAction(importType, sourcePath);
      if (response.error) {
        setError(response.error);
      } else if (response.result) {
        setPreview(response.result);
        setNotice(
          `Imported ${response.result.stats.imported} new item${response.result.stats.imported === 1 ? '' : 's'} from ${response.result.sourceLabel}.`
        );
      }

      if (response.runs) {
        setRuns(response.runs);
      }

      setPendingAction(null);
    });
  };

  const handleRollback = (runId: string) => {
    startTransition(async () => {
      setPendingAction(`rollback:${runId}`);
      setError(null);
      setNotice(null);

      const response = await rollbackImportRunAction(runId);
      if (response.error) {
        setError(response.error);
      } else {
        setNotice(response.rollback?.summary ?? 'Import run rolled back.');
      }

      if (response.runs) {
        setRuns(response.runs);
      }

      setPendingAction(null);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Imports</h1>
          <p className="mt-1 text-sm text-text-muted">
            Preview, import, and roll back exported history from external tools into your local lifeOS database.
          </p>
        </div>
        <div className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-right">
          <p className="text-2xs font-medium uppercase tracking-wider text-text-muted">Attachment storage</p>
          <p className="mt-1 max-w-xs truncate font-mono text-2xs text-text-secondary">{attachmentsPath}</p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <DatabaseZap size={18} className="text-brand-primary" />
            <h2 className="text-sm font-semibold text-text-primary">Import Runner</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {IMPORT_OPTIONS.map((option) => {
              const active = option.value === importType;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setImportType(option.value)}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-brand-400 bg-brand-50'
                      : 'border-surface-3 bg-surface-1 hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    {option.icon}
                    {option.label}
                  </div>
                  <p className="mt-1 text-2xs text-text-muted">{option.description}</p>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label className="block text-2xs font-medium uppercase tracking-wider text-text-muted">
              Source path
            </label>
            <input
              value={sourcePath}
              onChange={(event) => setSourcePath(event.target.value)}
              placeholder={selectedOption.sourceHint}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <p className="text-2xs text-text-muted">
              Point at an extracted folder or supported export file. Zipped Notion and Day One exports are accepted.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
            >
              {pendingAction === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Preview
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {pendingAction === 'import' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Run Import
            </button>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              {notice}
            </div>
          ) : null}
        </div>

        <div className="card space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">What This Pass Handles</h2>
            <p className="mt-1 text-2xs text-text-muted">
              Imports are deduped by source-record fingerprints, preview their mapping and diff before write, and now keep enough run metadata for a clean rollback.
            </p>
          </div>
          <ul className="space-y-2 text-xs text-text-secondary">
            <li>Preview shows detected mappings, duplicate coverage, attachment copies, and projected project creation.</li>
            <li>Import runs log their created artifacts so rollback can archive imported items and clean up linked artifacts.</li>
            <li>Todoist, Obsidian, Notion, and Day One all use the same import-run history with dry-run and rerun safety.</li>
          </ul>
        </div>
      </section>

      {preview ? (
        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Preview</h2>
              <p className="mt-1 text-2xs text-text-muted">
                {preview.sourceLabel} · {preview.sourcePath}
              </p>
            </div>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-2xs font-medium text-text-secondary">
              {preview.importType}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Detected items" value={preview.stats.totalItems} />
            <StatCard label="New on import" value={preview.diff.newItems} />
            <StatCard label="Duplicates" value={preview.diff.duplicateItems} />
            <StatCard label="Relations" value={preview.diff.relationLinks} />
            <StatCard label="Attachment copies" value={preview.diff.attachmentCopies} />
            <StatCard label="Tag assignments" value={preview.diff.tagAssignments} />
            <StatCard label="Tasks" value={preview.stats.tasks} />
            <StatCard label="Journal entries" value={preview.stats.journalEntries} />
          </div>

          {preview.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-2xs font-medium uppercase tracking-wider text-amber-800">Warnings</p>
              <div className="mt-1 space-y-1">
                {preview.warnings.slice(0, 10).map((warning) => (
                  <p key={warning} className="text-xs text-amber-800">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-surface-3 bg-surface-1 px-3 py-3">
            <div className="flex items-center gap-2">
              <ArrowRight size={14} className="text-text-muted" />
              <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted">Diff Summary</h3>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <DiffPill label="New items" value={preview.diff.newItems} />
              <DiffPill label="Duplicate matches" value={preview.diff.duplicateItems} />
              <DiffPill label="Files to copy" value={preview.diff.attachmentCopies} />
              <DiffPill label="Relations to create" value={preview.diff.relationLinks} />
            </div>
            {preview.diff.autoCreateProjectTitles.length > 0 ? (
              <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-brand-800">
                  <FolderPlus size={14} />
                  Auto-created projects on import
                </div>
                <p className="mt-1 text-xs text-brand-800">
                  {preview.diff.autoCreateProjectTitles.join(', ')}
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted">Detected Mappings</h3>
              <p className="mt-1 text-xs text-text-muted">
                These are the field translations the importer inferred from the selected source.
              </p>
            </div>
            {preview.mappingGroups.length === 0 ? (
              <p className="text-xs text-text-muted">No mapping details were inferred for this source.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {preview.mappingGroups.map((group) => (
                  <MappingGroupCard key={group.id} group={group} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted">Sample Items</h3>
            {preview.items.length === 0 ? (
              <p className="text-xs text-text-muted">No importable items were detected.</p>
            ) : (
              <div className="space-y-2">
                {preview.items.map((item) => (
                  <PreviewItemCard key={item.sourceRecordKey} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Recent Runs</h2>
        </div>

        {runs.length === 0 ? (
          <p className="text-xs text-text-muted">No import previews or runs yet.</p>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <div key={run.id} className="rounded-lg border border-surface-3 bg-surface-1 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{run.sourceLabel || run.sourcePath}</p>
                      <StatusBadge status={run.status} />
                      {run.details?.rollback?.status === 'rolled_back' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-text-secondary">
                          <Undo2 size={12} />
                          Rolled back
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-2xs text-text-muted">
                      {run.importType} · {run.mode} · started {formatTimestamp(run.startedAt)}
                    </p>
                    {run.summary ? <p className="mt-1 text-xs text-text-secondary">{run.summary}</p> : null}
                    {run.details?.message && run.details.message !== run.summary ? (
                      <p className="mt-1 text-2xs text-text-muted">{run.details.message}</p>
                    ) : null}
                    {run.warnings.length > 0 ? <p className="mt-1 text-2xs text-amber-700">{run.warnings[0]}</p> : null}
                  </div>

                  <div className="space-y-2 text-right">
                    {run.stats ? (
                      <div className="grid min-w-[14rem] grid-cols-2 gap-x-4 gap-y-1 text-2xs text-text-muted">
                        <span>Items: {run.stats.totalItems}</span>
                        <span>Imported: {run.stats.imported}</span>
                        <span>Files: {run.stats.attachments}</span>
                        <span>Duplicates: {run.stats.duplicates}</span>
                      </div>
                    ) : null}

                    {canRollbackRun(run) ? (
                      <button
                        type="button"
                        onClick={() => handleRollback(run.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
                      >
                        {pendingAction === `rollback:${run.id}` ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Undo2 size={13} />
                        )}
                        Roll Back
                      </button>
                    ) : null}
                  </div>
                </div>

                {run.details?.preview ? (
                  <div className="mt-3 rounded-lg border border-surface-3 bg-surface-0 px-3 py-3">
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <DiffPill label="New items" value={run.details.preview.diff.newItems} />
                      <DiffPill label="Duplicate matches" value={run.details.preview.diff.duplicateItems} />
                      <DiffPill label="Files to copy" value={run.details.preview.diff.attachmentCopies} />
                      <DiffPill label="Relations to create" value={run.details.preview.diff.relationLinks} />
                    </div>
                    {run.details.preview.diff.autoCreateProjectTitles.length > 0 ? (
                      <p className="mt-2 text-2xs text-text-muted">
                        Auto-created projects: {run.details.preview.diff.autoCreateProjectTitles.join(', ')}
                      </p>
                    ) : null}
                    {run.details.preview.mappingGroups.length > 0 ? (
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {run.details.preview.mappingGroups.slice(0, 4).map((group) => (
                          <MappingGroupCard key={`${run.id}-${group.id}`} group={group} compact />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {run.details?.rollback ? (
                  <div className="mt-3 rounded-lg border border-surface-3 bg-surface-0 px-3 py-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-text-primary">
                      <Undo2 size={14} />
                      Rollback state
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">{run.details.rollback.summary}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <DiffPill label="Archived items" value={run.details.rollback.archivedItemCount} />
                      <DiffPill label="Removed links" value={run.details.rollback.removedAttachmentLinkCount} />
                      <DiffPill label="Removed relations" value={run.details.rollback.removedRelationCount} />
                      <DiffPill label="Archived projects" value={run.details.rollback.archivedProjectCount} />
                    </div>
                    {run.details.rollback.archivedAttachmentCount > 0 ? (
                      <p className="mt-2 text-2xs text-text-muted">
                        Archived orphaned attachments: {run.details.rollback.archivedAttachmentCount}
                      </p>
                    ) : null}
                    {run.details.rollback.skippedProjectTitles.length > 0 ? (
                      <p className="mt-2 text-2xs text-text-muted">
                        Preserved projects with additional data: {run.details.rollback.skippedProjectTitles.join(', ')}
                      </p>
                    ) : null}
                    {run.details.rollback.rolledBackAt ? (
                      <p className="mt-2 text-2xs text-text-muted">
                        Rolled back {formatTimestamp(run.details.rollback.rolledBackAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PreviewItemCard({ item }: { item: ImportPreviewItem }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{item.title}</p>
          <p className="mt-0.5 truncate text-2xs text-text-muted">
            {item.destinationType}
            {item.subtitle ? ` · ${item.subtitle}` : ''}
            {item.attachmentCount > 0 ? ` · ${item.attachmentCount} file${item.attachmentCount === 1 ? '' : 's'}` : ''}
            {item.relationCount > 0 ? ` · ${item.relationCount} relation${item.relationCount === 1 ? '' : 's'}` : ''}
          </p>

          {item.mappedFields.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.mappedFields.map((field) => (
                <span
                  key={`${item.sourceRecordKey}-${field.label}`}
                  className="rounded-full bg-surface-0 px-2 py-1 text-2xs text-text-secondary"
                >
                  {field.label}: {field.value}
                </span>
              ))}
            </div>
          ) : null}

          {item.tags.length > 0 ? (
            <p className="mt-2 truncate text-2xs text-text-muted">{item.tags.map((tag) => `#${tag}`).join(' ')}</p>
          ) : null}

          {item.attachmentNames.length > 0 ? (
            <p className="mt-1 text-2xs text-text-muted">Files: {item.attachmentNames.join(', ')}</p>
          ) : null}

          {item.autoProjectTitle ? (
            <p className="mt-1 text-2xs text-brand-700">Creates project: {item.autoProjectTitle}</p>
          ) : null}

          {item.duplicateTarget ? (
            <p className="mt-1 text-2xs text-text-muted">
              Existing match:{' '}
              {item.duplicateTarget.detailUrl ? (
                <a href={item.duplicateTarget.detailUrl} className="text-brand-primary hover:underline">
                  {item.duplicateTarget.title}
                </a>
              ) : (
                item.duplicateTarget.title
              )}{' '}
              ({item.duplicateTarget.itemType})
            </p>
          ) : null}
        </div>

        {item.duplicate ? (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-text-secondary">
            Duplicate
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MappingGroupCard({
  group,
  compact = false,
}: {
  group: ImportPreviewMappingGroup;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text-primary">{group.sourceLabel}</p>
          <div className="mt-1 flex items-center gap-2 text-2xs text-text-muted">
            <ArrowRight size={12} />
            <span>{group.destinationLabel}</span>
          </div>
        </div>
        <span className="rounded-full bg-surface-0 px-2 py-0.5 text-2xs font-medium text-text-secondary">
          {group.coverageCount}
        </span>
      </div>
      {!compact ? <p className="mt-2 text-xs text-text-secondary">{group.description}</p> : null}
      {group.sampleValues.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {group.sampleValues.map((sample) => (
            <span key={`${group.id}-${sample}`} className="rounded-full bg-surface-0 px-2 py-1 text-2xs text-text-secondary">
              {sample}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-1 px-3 py-2">
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      <p className="text-2xs text-text-muted">{label}</p>
    </div>
  );
}

function DiffPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 px-3 py-2">
      <p className="text-sm font-semibold text-text-primary">{value}</p>
      <p className="text-2xs text-text-muted">{label}</p>
    </div>
  );
}
