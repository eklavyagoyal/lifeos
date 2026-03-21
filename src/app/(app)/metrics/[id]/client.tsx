'use client';

import { useRouter } from 'next/navigation';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { updateMetricAction, deleteMetricAction } from '@/app/actions';
import { formatDate, formatISODate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import {
  METRIC_TYPE_LABELS,
  METRIC_TYPE_ICONS,
  MOOD_LABELS,
  ENERGY_LABELS,
} from '@/lib/constants';

interface Metric {
  id: string;
  metricType: string;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  loggedAt: number;
  loggedDate: string;
  note: string | null;
  journalId: string | null;
  habitId: string | null;
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

function formatValueDisplay(metric: Metric): string {
  const { metricType, valueNumeric, valueText, unit } = metric;

  if (metricType === 'mood' && valueNumeric) {
    return `${valueNumeric}/10 — ${MOOD_LABELS[valueNumeric] || ''}`;
  }
  if (metricType === 'energy' && valueNumeric) {
    return `${valueNumeric}/10 — ${ENERGY_LABELS[valueNumeric] || ''}`;
  }
  if (metricType === 'sleep' && valueNumeric) {
    const quality = valueText ? ` (${valueText})` : '';
    return `${valueNumeric} ${unit || 'hours'}${quality}`;
  }
  if (metricType === 'workout') {
    const parts: string[] = [];
    if (valueText) parts.push(valueText.charAt(0).toUpperCase() + valueText.slice(1));
    if (valueNumeric) parts.push(`${valueNumeric} ${unit || 'min'}`);
    return parts.join(' · ') || 'Workout';
  }
  if (metricType === 'expense') {
    const parts: string[] = [];
    if (valueNumeric) parts.push(`$${valueNumeric.toFixed(2)}`);
    if (valueText) parts.push(valueText.charAt(0).toUpperCase() + valueText.slice(1));
    return parts.join(' · ') || 'Expense';
  }
  if (valueNumeric !== null) {
    return `${valueNumeric}${unit ? ` ${unit}` : ''}`;
  }
  return valueText || '—';
}

interface MetricDetailClientProps {
  metric: Metric;
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
}

export function MetricDetailClient({
  metric,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
}: MetricDetailClientProps) {
  const router = useRouter();

  const handleUpdate = async (field: string, value: unknown) => {
    await updateMetricAction(metric.id, { [field]: value });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteMetricAction(metric.id);
    router.push('/metrics');
  };

  const typeLabel = METRIC_TYPE_LABELS[metric.metricType] || metric.metricType;
  const typeIcon = METRIC_TYPE_ICONS[metric.metricType] || '📊';

  return (
    <DetailPageShell
      backHref="/metrics"
      backLabel="Metrics"
      title={`${typeIcon} ${typeLabel}`}
      subtitle={formatISODate(metric.loggedDate)}
      onArchive={handleDelete}
      destructiveLabel="Delete metric"
      badge={
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-text-secondary">
          {typeLabel}
        </span>
      }
    >
      {/* Value display */}
      <div className="card p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Value</h3>
        <p className="text-xl font-semibold text-text-primary">{formatValueDisplay(metric)}</p>
      </div>

      {/* Metadata grid */}
      <div className="card grid grid-cols-2 gap-4 p-4">
        <div>
          <h4 className="text-xs font-medium text-text-muted">Date</h4>
          <p className="text-sm text-text-primary">{formatISODate(metric.loggedDate)}</p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-text-muted">Logged At</h4>
          <p className="text-sm text-text-primary">{formatDate(metric.loggedAt)}</p>
        </div>
        {metric.unit && (
          <div>
            <h4 className="text-xs font-medium text-text-muted">Unit</h4>
            <p className="text-sm text-text-primary">{metric.unit}</p>
          </div>
        )}
        <div>
          <h4 className="text-xs font-medium text-text-muted">Created</h4>
          <p className="text-sm text-text-primary">{formatDate(metric.createdAt)}</p>
        </div>
      </div>

      {/* Note */}
      <div className="card p-4">
        <EditableField
          label="Note"
          value={metric.note || ''}
          type="textarea"
          onSave={(val) => handleUpdate('note', val)}
          placeholder="Add a note..."
        />
      </div>

      {/* Tags */}
      <div className="card p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Tags</h3>
        <TagsPills tags={tags} itemType="metric" itemId={metric.id} />
      </div>

      {/* Relations */}
      <div className="card p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Relations
        </h3>
        <RelationsPanel
          items={relatedItems}
          structuralItems={structuralItems}
          suggestions={suggestedItems}
          currentItemType="metric"
          currentItemId={metric.id}
        />
      </div>
    </DetailPageShell>
  );
}
