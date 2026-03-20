'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { StatusBadge } from '@/components/detail/status-badge';
import { AttachmentsPanel, type AttachmentListItem } from '@/components/detail/attachments-panel';
import { ProgressBar } from '@/components/detail/progress-bar';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { TaskList } from '@/components/tasks/task-list';
import {
  updateProjectAction,
  archiveProjectAction,
} from '@/app/actions';
import { formatDate, formatISODate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import { Calendar, CheckSquare, Target } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  scheduledDate: string | null;
  projectId: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
  itemTagId: string;
}

type RelatedItem = ConnectionItem;
type SuggestedItem = ConnectionSuggestion;

interface Project {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  status: string;
  health: string | null;
  startDate: string | null;
  targetDate: string | null;
  endDate: string | null;
  progress: number | null;
  goalId: string | null;
  reviewCadence: string | null;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}

interface Goal {
  id: string;
  title: string;
}

interface GoalOption {
  id: string;
  title: string;
}

interface ProjectDetailClientProps {
  project: Project;
  goal: Goal | null | undefined;
  goals: GoalOption[];
  tasks: Task[];
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
  attachments: AttachmentListItem[];
}

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const HEALTH_OPTIONS = [
  { value: 'on_track', label: 'On Track' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'off_track', label: 'Off Track' },
];

const CADENCE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function ProjectDetailClient({
  project,
  goal,
  goals,
  tasks,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
  attachments,
}: ProjectDetailClientProps) {
  const router = useRouter();

  const handleUpdate = async (field: string, value: unknown) => {
    await updateProjectAction(project.id, { [field]: value });
    router.refresh();
  };

  const handleArchive = async () => {
    await archiveProjectAction(project.id);
    router.push('/projects');
  };

  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;

  return (
    <DetailPageShell
      backHref="/projects"
      backLabel="Projects"
      title={project.title}
      onTitleChange={(title) => handleUpdate('title', title)}
      badge={<StatusBadge status={project.status} size="md" />}
      onArchive={handleArchive}
    >
      {/* Metadata Grid */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Status"
            value={project.status}
            onSave={(v) => handleUpdate('status', v)}
            type="select"
            options={STATUS_OPTIONS}
          />
          <EditableField
            label="Health"
            value={project.health}
            onSave={(v) => handleUpdate('health', v)}
            type="select"
            options={HEALTH_OPTIONS}
          />
          <EditableField
            label="Start Date"
            value={project.startDate}
            onSave={(v) => handleUpdate('startDate', v)}
            type="date"
          />
          <EditableField
            label="Target Date"
            value={project.targetDate}
            onSave={(v) => handleUpdate('targetDate', v)}
            type="date"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Review Cadence"
            value={project.reviewCadence}
            onSave={(v) => handleUpdate('reviewCadence', v)}
            type="select"
            options={CADENCE_OPTIONS}
          />
          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Progress
            </span>
            <ProgressBar value={project.progress ?? 0} size="md" />
          </div>
          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Created
            </span>
            <p className="text-sm text-text-primary">{formatDate(project.createdAt)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <EditableField
            label="Goal"
            value={project.goalId}
            onSave={(value) => handleUpdate('goalId', value || null)}
            type="select"
            options={goals.map((item) => ({ value: item.id, label: item.title }))}
            emptyLabel="No goal linked"
          />
          <div className="space-y-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Ended
            </span>
            <p className="text-sm text-text-primary">
              {project.endDate ? formatISODate(project.endDate) : 'Not ended'}
            </p>
          </div>
        </div>
      </div>

      {goal ? (
        <div className="card">
          <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
            Linked Goal
          </span>
          <Link
            href={`/goals/${goal.id}`}
            className="mt-1 flex items-center gap-2 text-sm text-brand-600 transition-colors hover:text-brand-700"
          >
            <Target size={14} />
            {goal.title}
          </Link>
        </div>
      ) : null}

      {/* Summary / Description */}
      <div className="card">
        <EditableField
          label="Summary"
          value={project.summary}
          onSave={(v) => handleUpdate('summary', v)}
          type="textarea"
          placeholder="Describe the project..."
          emptyLabel="Add a summary..."
        />
      </div>

      {/* Body / Notes */}
      <div className="card">
        <EditableField
          label="Notes"
          value={project.body}
          onSave={(v) => handleUpdate('body', v)}
          type="textarea"
          placeholder="Project notes, plans, context..."
          emptyLabel="Add notes..."
        />
      </div>

      {/* Tags */}
      <div className="card">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">
          Tags
        </h3>
        <TagsPills itemType="project" itemId={project.id} tags={tags} />
      </div>

      <AttachmentsPanel itemType="project" itemId={project.id} attachments={attachments} />

      {/* Project Tasks */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-text-muted" />
            <h3 className="text-sm font-semibold text-text-primary">Tasks</h3>
            {totalTasks > 0 && (
              <span className="text-2xs text-text-muted">
                {doneTasks}/{totalTasks} done
              </span>
            )}
          </div>
        </div>
        <TaskList
          tasks={tasks}
          showAddButton={true}
          emptyMessage="No tasks in this project yet."
        />
      </div>

      {/* Relations */}
      <RelationsPanel
        items={relatedItems}
        structuralItems={structuralItems}
        suggestions={suggestedItems}
        currentItemType="project"
        currentItemId={project.id}
      />
    </DetailPageShell>
  );
}
