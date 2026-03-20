'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { StatusBadge } from '@/components/detail/status-badge';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { updateTaskAction, archiveTaskAction, toggleTaskAction } from '@/app/actions';
import { formatDate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import { Circle, CheckCircle2, FolderKanban, Target } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Task {
  id: string;
  title: string;
  body: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  scheduledDate: string | null;
  projectId: string | null;
  goalId: string | null;
  parentTaskId: string | null;
  effortEstimate: string | null;
  energyRequired: string | null;
  context: string | null;
  source: string | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface Project {
  id: string;
  title: string;
}

interface Goal {
  id: string;
  title: string;
}

interface GoalOption {
  id: string;
  title: string;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
  itemTagId: string;
}

type RelatedItem = ConnectionItem;
type SuggestedItem = ConnectionSuggestion;

const STATUS_OPTIONS = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: 'p1', label: '🔴 P1 — Urgent' },
  { value: 'p2', label: '🟠 P2 — High' },
  { value: 'p3', label: '🔵 P3 — Medium' },
  { value: 'p4', label: '⚪ P4 — Low' },
];

const EFFORT_OPTIONS = [
  { value: 'tiny', label: 'Tiny (< 15 min)' },
  { value: 'small', label: 'Small (15–30 min)' },
  { value: 'medium', label: 'Medium (30–60 min)' },
  { value: 'large', label: 'Large (1–3 hrs)' },
  { value: 'epic', label: 'Epic (> 3 hrs)' },
];

const ENERGY_OPTIONS = [
  { value: 'low', label: 'Low Energy' },
  { value: 'medium', label: 'Medium Energy' },
  { value: 'high', label: 'High Energy' },
];

interface TaskDetailClientProps {
  task: Task;
  project: Project | null | undefined;
  goal: Goal | null | undefined;
  goals: GoalOption[];
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
}

export function TaskDetailClient({
  task,
  project,
  goal,
  goals,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
}: TaskDetailClientProps) {
  const router = useRouter();
  const isDone = task.status === 'done';

  const handleUpdate = async (field: string, value: unknown) => {
    await updateTaskAction(task.id, { [field]: value });
    router.refresh();
  };

  const handleToggle = async () => {
    await toggleTaskAction(task.id);
    router.refresh();
  };

  const handleArchive = async () => {
    await archiveTaskAction(task.id);
    router.push('/tasks');
  };

  return (
    <DetailPageShell
      backHref="/tasks"
      backLabel="Tasks"
      title={task.title}
      onTitleChange={(title) => handleUpdate('title', title)}
      badge={<StatusBadge status={task.status} size="md" />}
      actions={
        <button
          onClick={handleToggle}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            isDone
              ? 'bg-green-50 text-green-700 hover:bg-green-100'
              : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
          )}
        >
          {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
          {isDone ? 'Completed' : 'Mark Done'}
        </button>
      }
      onArchive={handleArchive}
    >
      {/* Metadata Grid */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Status"
            value={task.status}
            onSave={(v) => handleUpdate('status', v)}
            type="select"
            options={STATUS_OPTIONS}
          />
          <EditableField
            label="Priority"
            value={task.priority}
            onSave={(v) => handleUpdate('priority', v)}
            type="select"
            options={PRIORITY_OPTIONS}
          />
          <EditableField
            label="Due Date"
            value={task.dueDate}
            onSave={(v) => handleUpdate('dueDate', v)}
            type="date"
          />
          <EditableField
            label="Scheduled Date"
            value={task.scheduledDate}
            onSave={(v) => handleUpdate('scheduledDate', v)}
            type="date"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Effort"
            value={task.effortEstimate}
            onSave={(v) => handleUpdate('effortEstimate', v)}
            type="select"
            options={EFFORT_OPTIONS}
          />
          <EditableField
            label="Energy"
            value={task.energyRequired}
            onSave={(v) => handleUpdate('energyRequired', v)}
            type="select"
            options={ENERGY_OPTIONS}
          />
          <EditableField
            label="Context"
            value={task.context}
            onSave={(v) => handleUpdate('context', v)}
            placeholder="@home, @work, @errands..."
          />
          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Created
            </span>
            <p className="text-sm text-text-primary">{formatDate(task.createdAt)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <EditableField
            label="Goal"
            value={task.goalId}
            onSave={(value) => handleUpdate('goalId', value || null)}
            type="select"
            options={goals.map((item) => ({ value: item.id, label: item.title }))}
            emptyLabel="No goal linked"
          />
          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Last Updated
            </span>
            <p className="text-sm text-text-primary">{formatDate(task.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Project / Goal links */}
      {(project || goal) && (
        <div className="card">
          {goal ? (
            <div className={project ? 'mb-3' : undefined}>
              <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                Goal
              </span>
              <Link
                href={`/goals/${goal.id}`}
                className="mt-1 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 transition-colors"
              >
                <Target size={14} />
                {goal.title}
              </Link>
            </div>
          ) : null}
          {project ? (
            <div>
              <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                Project
              </span>
              <Link
                href={`/projects/${project.id}`}
                className="mt-1 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 transition-colors"
              >
                <FolderKanban size={14} />
                {project.title}
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {/* Body / Notes */}
      <div className="card">
        <EditableField
          label="Notes"
          value={task.body}
          onSave={(v) => handleUpdate('body', v)}
          type="textarea"
          placeholder="Add context, details, steps..."
          emptyLabel="Add notes..."
        />
      </div>

      {/* Tags */}
      <div className="card">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">Tags</h3>
        <TagsPills itemType="task" itemId={task.id} tags={tags} />
      </div>

      {/* Relations */}
      <RelationsPanel
        items={relatedItems}
        structuralItems={structuralItems}
        suggestions={suggestedItems}
        currentItemType="task"
        currentItemId={task.id}
      />
    </DetailPageShell>
  );
}
