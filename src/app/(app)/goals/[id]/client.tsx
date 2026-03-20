'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { StatusBadge } from '@/components/detail/status-badge';
import { ProgressBar } from '@/components/detail/progress-bar';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import {
  archiveGoalAction,
  archiveMilestoneAction,
  createMilestoneAction,
  updateGoalAction,
  updateMilestoneAction,
} from '@/app/actions';
import { formatDate, formatISODate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import {
  Calendar,
  CheckSquare,
  Flag,
  FolderKanban,
  Link2,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface Habit {
  id: string;
  name: string;
  cadence: string | null;
  currentStreak: number | null;
  domain: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
}

interface Project {
  id: string;
  title: string;
  status: string;
  progress: number | null;
  health: string | null;
}

interface LinkedItemOption {
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

interface Goal {
  id: string;
  title: string;
  description: string | null;
  body: string | null;
  timeHorizon: string | null;
  startDate: string | null;
  targetDate: string | null;
  outcomeMetric: string | null;
  status: string;
  progress: number | null;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}

interface GoalRollup {
  progress: number;
  contributorCount: number;
  milestoneCount: number;
  linkedTaskCount: number;
  linkedProjectCount: number;
  linkedHabitCount: number;
  usesDerivedProgress: boolean;
}

interface Milestone {
  id: string;
  goalId: string;
  title: string;
  body: string | null;
  status: 'planned' | 'active' | 'done' | 'cancelled';
  targetDate: string | null;
  completedAt: number | null;
  progress: number | null;
  sortOrder: number | null;
  taskId: string | null;
  projectId: string | null;
  habitId: string | null;
  computed: {
    progress: number;
    status: 'planned' | 'active' | 'done' | 'cancelled';
    source: 'manual' | 'task' | 'project' | 'habit';
    linkedItem?: {
      id: string;
      type: 'task' | 'project' | 'habit';
      title: string;
      detailUrl: string;
      status?: string | null;
    };
  };
}

interface GoalDetailClientProps {
  goal: Goal;
  rollup: GoalRollup;
  habits: Habit[];
  tasks: Task[];
  projects: Project[];
  milestones: Milestone[];
  candidateTasks: LinkedItemOption[];
  candidateProjects: LinkedItemOption[];
  candidateHabits: LinkedItemOption[];
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'achieved', label: 'Achieved' },
  { value: 'paused', label: 'Paused' },
  { value: 'abandoned', label: 'Abandoned' },
];

const HORIZON_OPTIONS = [
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'multi_year', label: 'Multi-Year' },
  { value: 'life', label: 'Life' },
];

const MILESTONE_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

const LINK_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual milestone' },
  { value: 'task', label: 'Task-backed' },
  { value: 'project', label: 'Project-backed' },
  { value: 'habit', label: 'Habit-backed' },
] as const;

type LinkType = (typeof LINK_TYPE_OPTIONS)[number]['value'];

function getLinkTypeFromMilestone(milestone: Milestone): LinkType {
  if (milestone.taskId) return 'task';
  if (milestone.projectId) return 'project';
  if (milestone.habitId) return 'habit';
  return 'manual';
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-2 bg-surface-1/70 px-3 py-2">
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      <p className="text-2xs uppercase tracking-wider text-text-muted">{label}</p>
    </div>
  );
}

function LinkedListCard({
  title,
  icon,
  countLabel,
  emptyMessage,
  children,
}: {
  title: string;
  icon: ReactNode;
  countLabel?: string;
  emptyMessage: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {countLabel ? <span className="text-2xs text-text-muted">{countLabel}</span> : null}
      </div>
      {hasChildren ? children : <p className="py-2 text-2xs text-text-muted">{emptyMessage}</p>}
    </div>
  );
}

function MilestoneComposer({
  goalId,
  candidateTasks,
  candidateProjects,
  candidateHabits,
}: {
  goalId: string;
  candidateTasks: LinkedItemOption[];
  candidateProjects: LinkedItemOption[];
  candidateHabits: LinkedItemOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'planned' | 'active' | 'done' | 'cancelled'>('planned');
  const [targetDate, setTargetDate] = useState('');
  const [progress, setProgress] = useState('0');
  const [linkType, setLinkType] = useState<LinkType>('manual');
  const [linkedItemId, setLinkedItemId] = useState('');

  const itemOptions = useMemo(() => {
    switch (linkType) {
      case 'task':
        return candidateTasks;
      case 'project':
        return candidateProjects;
      case 'habit':
        return candidateHabits;
      default:
        return [];
    }
  }, [candidateHabits, candidateProjects, candidateTasks, linkType]);

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createMilestoneAction({
        goalId,
        title,
        body,
        status,
        targetDate: targetDate || null,
        progress: linkType === 'manual' ? Number.parseInt(progress, 10) || 0 : null,
        taskId: linkType === 'task' ? linkedItemId || null : null,
        projectId: linkType === 'project' ? linkedItemId || null : null,
        habitId: linkType === 'habit' ? linkedItemId || null : null,
      });

      if (result.error) return;

      setTitle('');
      setBody('');
      setStatus('planned');
      setTargetDate('');
      setProgress('0');
      setLinkType('manual');
      setLinkedItemId('');
      router.refresh();
    });
  };

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Add Milestone</h3>
          <p className="text-2xs text-text-muted">
            Milestones can be manual or derive their progress from a linked task, project, or habit.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isPending || title.trim().length === 0 || (linkType !== 'manual' && !linkedItemId)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus size={14} />
          Create
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Define the outcome or checkpoint..."
              className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
              Notes
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              placeholder="Optional context, definition of done, or follow-through notes..."
              className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100 resize-y"
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                Status
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
              >
                {MILESTONE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                Target Date
              </span>
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>

          <div className="rounded-lg border border-dashed border-brand-200 bg-surface-1/60 p-3">
            <div className="grid gap-3 sm:grid-cols-[180px,1fr]">
              <label className="block space-y-1">
                <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                  Source
                </span>
                <select
                  value={linkType}
                  onChange={(event) => {
                    setLinkType(event.target.value as LinkType);
                    setLinkedItemId('');
                  }}
                  className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {LINK_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {linkType === 'manual' ? (
                <label className="block space-y-1">
                  <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                    Manual Progress
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(event) => setProgress(event.target.value)}
                    className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              ) : (
                <label className="block space-y-1">
                  <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                    Linked Item
                  </span>
                  <select
                    value={linkedItemId}
                    onChange={(event) => setLinkedItemId(event.target.value)}
                    className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Choose an item…</option>
                    {itemOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <p className="mt-2 text-2xs text-text-muted">
              Linked milestones stay in sync automatically, while manual milestones let you track progress by hand.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MilestoneCard({
  milestone,
  candidateTasks,
  candidateProjects,
  candidateHabits,
}: {
  milestone: Milestone;
  candidateTasks: LinkedItemOption[];
  candidateProjects: LinkedItemOption[];
  candidateHabits: LinkedItemOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [linkType, setLinkType] = useState<LinkType>(getLinkTypeFromMilestone(milestone));
  const [linkedItemId, setLinkedItemId] = useState(
    milestone.taskId || milestone.projectId || milestone.habitId || ''
  );

  useEffect(() => {
    setLinkType(getLinkTypeFromMilestone(milestone));
    setLinkedItemId(milestone.taskId || milestone.projectId || milestone.habitId || '');
  }, [milestone]);

  const itemOptions = useMemo(() => {
    switch (linkType) {
      case 'task':
        return candidateTasks;
      case 'project':
        return candidateProjects;
      case 'habit':
        return candidateHabits;
      default:
        return [];
    }
  }, [candidateHabits, candidateProjects, candidateTasks, linkType]);

  const saveField = (field: string, value: unknown) => {
    startTransition(async () => {
      await updateMilestoneAction(milestone.id, { [field]: value });
      router.refresh();
    });
  };

  const saveLink = () => {
    startTransition(async () => {
      await updateMilestoneAction(milestone.id, {
        taskId: linkType === 'task' ? linkedItemId || null : null,
        projectId: linkType === 'project' ? linkedItemId || null : null,
        habitId: linkType === 'habit' ? linkedItemId || null : null,
      });
      router.refresh();
    });
  };

  const archiveMilestone = () => {
    startTransition(async () => {
      await archiveMilestoneAction(milestone.id, milestone.goalId);
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-surface-2 bg-surface-0 p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <EditableField
            label="Milestone"
            value={milestone.title}
            onSave={(value) => saveField('title', value)}
            placeholder="Milestone title"
          />
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={milestone.computed.status} />
          <button
            onClick={archiveMilestone}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-50"
            title="Archive milestone"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        <div className="space-y-4">
          <EditableField
            label="Notes"
            value={milestone.body}
            onSave={(value) => saveField('body', value)}
            type="textarea"
            placeholder="Definition of done, notes, or nuance..."
            emptyLabel="Add milestone notes..."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <EditableField
              label="Status"
              value={milestone.status}
              onSave={(value) => saveField('status', value)}
              type="select"
              options={MILESTONE_STATUS_OPTIONS}
            />
            <EditableField
              label="Target Date"
              value={milestone.targetDate}
              onSave={(value) => saveField('targetDate', value || null)}
              type="date"
            />
          </div>

          {milestone.computed.source === 'manual' ? (
            <EditableField
              label="Manual Progress"
              value={String(milestone.progress ?? 0)}
              onSave={(value) => saveField('progress', Number.parseInt(value, 10) || 0)}
              type="number"
              placeholder="0"
            />
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-text-muted">
                <span>Derived Progress</span>
                <span>{milestone.computed.progress}%</span>
              </div>
              <ProgressBar value={milestone.computed.progress} size="md" />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-surface-3 bg-surface-1/50 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={15} className="text-brand-600" />
            <div>
              <p className="text-sm font-medium text-text-primary">Rollup Source</p>
              <p className="text-2xs text-text-muted">
                {milestone.computed.source === 'manual'
                  ? 'This milestone is tracked manually.'
                  : `This milestone updates from a linked ${milestone.computed.source}.`}
              </p>
            </div>
          </div>

          {milestone.computed.linkedItem ? (
            <Link
              href={milestone.computed.linkedItem.detailUrl}
              className="mb-3 flex items-center gap-2 rounded-md bg-surface-0 px-3 py-2 text-sm text-brand-600 transition-colors hover:text-brand-700"
            >
              <Link2 size={14} />
              <span className="flex-1 truncate">{milestone.computed.linkedItem.title}</span>
              {milestone.computed.linkedItem.status ? (
                <span className="text-2xs text-text-muted">
                  {milestone.computed.linkedItem.status.replaceAll('_', ' ')}
                </span>
              ) : null}
            </Link>
          ) : null}

          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                Source Type
              </span>
              <select
                value={linkType}
                onChange={(event) => {
                  setLinkType(event.target.value as LinkType);
                  setLinkedItemId('');
                }}
                className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
              >
                {LINK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {linkType !== 'manual' ? (
              <label className="block space-y-1">
                <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                  Linked Item
                </span>
                <select
                  value={linkedItemId}
                  onChange={(event) => setLinkedItemId(event.target.value)}
                  className="w-full rounded-md border border-brand-300 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Choose an item…</option>
                  {itemOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <button
              onClick={saveLink}
              disabled={isPending || (linkType !== 'manual' && !linkedItemId)}
              className="w-full rounded-md bg-surface-2 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
            >
              Save Source
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GoalDetailClient({
  goal,
  rollup,
  habits,
  tasks,
  projects,
  milestones,
  candidateTasks,
  candidateProjects,
  candidateHabits,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
}: GoalDetailClientProps) {
  const router = useRouter();

  const handleUpdate = async (field: string, value: unknown) => {
    await updateGoalAction(goal.id, { [field]: value });
    router.refresh();
  };

  const handleArchive = async () => {
    await archiveGoalAction(goal.id);
    router.push('/goals');
  };

  return (
    <DetailPageShell
      backHref="/goals"
      backLabel="Goals"
      title={goal.title}
      onTitleChange={(title) => handleUpdate('title', title)}
      badge={<StatusBadge status={goal.status} size="md" />}
      onArchive={handleArchive}
    >
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Status"
            value={goal.status}
            onSave={(value) => handleUpdate('status', value)}
            type="select"
            options={STATUS_OPTIONS}
          />
          <EditableField
            label="Time Horizon"
            value={goal.timeHorizon}
            onSave={(value) => handleUpdate('timeHorizon', value)}
            type="select"
            options={HORIZON_OPTIONS}
          />
          <EditableField
            label="Start Date"
            value={goal.startDate}
            onSave={(value) => handleUpdate('startDate', value || null)}
            type="date"
          />
          <EditableField
            label="Target Date"
            value={goal.targetDate}
            onSave={(value) => handleUpdate('targetDate', value || null)}
            type="date"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <div className="space-y-4">
            <EditableField
              label="Outcome Metric"
              value={goal.outcomeMetric}
              onSave={(value) => handleUpdate('outcomeMetric', value)}
              placeholder="How will you measure success?"
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between text-2xs font-medium uppercase tracking-wider text-text-muted">
                <span>Progress</span>
                <span>{goal.progress ?? 0}%</span>
              </div>
              <ProgressBar value={goal.progress ?? 0} size="md" />
              <p className="text-2xs text-text-muted">
                {rollup.usesDerivedProgress
                  ? `Derived from ${rollup.contributorCount} active contributors.`
                  : 'No linked contributors yet. Progress remains manual until you add milestones or linked work.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryStat label="Milestones" value={String(rollup.milestoneCount)} />
            <SummaryStat label="Task Links" value={String(rollup.linkedTaskCount)} />
            <SummaryStat label="Project Links" value={String(rollup.linkedProjectCount)} />
            <SummaryStat label="Habit Links" value={String(rollup.linkedHabitCount)} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-2xs text-text-muted">
          <span>Created {formatDate(goal.createdAt)}</span>
          {goal.targetDate ? (
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              Target {formatISODate(goal.targetDate)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="card">
        <EditableField
          label="Description"
          value={goal.description}
          onSave={(value) => handleUpdate('description', value)}
          type="textarea"
          placeholder="Why does this goal matter?"
          emptyLabel="Add a description..."
        />
      </div>

      <div className="card">
        <EditableField
          label="Notes"
          value={goal.body}
          onSave={(value) => handleUpdate('body', value)}
          type="textarea"
          placeholder="Plans, milestones, and ongoing notes..."
          emptyLabel="Add notes..."
        />
      </div>

      <div className="card">
        <h3 className="mb-2 text-2xs font-medium uppercase tracking-wider text-text-muted">
          Tags
        </h3>
        <TagsPills itemType="goal" itemId={goal.id} tags={tags} />
      </div>

      <MilestoneComposer
        goalId={goal.id}
        candidateTasks={candidateTasks}
        candidateProjects={candidateProjects}
        candidateHabits={candidateHabits}
      />

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Milestones</h3>
          <p className="text-2xs text-text-muted">
            Milestones keep the goal legible. Link them to real work when you want progress to roll up automatically.
          </p>
        </div>

        {milestones.length === 0 ? (
          <div className="card py-8 text-center">
            <Flag size={24} className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-primary">No milestones yet.</p>
            <p className="text-2xs text-text-muted">
              Add a first checkpoint to turn this goal into a concrete plan.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                candidateTasks={candidateTasks}
                candidateProjects={candidateProjects}
                candidateHabits={candidateHabits}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <LinkedListCard
          title="Direct Projects"
          icon={<FolderKanban size={16} className="text-text-muted" />}
          countLabel={projects.length > 0 ? `(${projects.length})` : undefined}
          emptyMessage="No projects are linked directly to this goal yet."
        >
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block rounded-lg border border-surface-2 px-3 py-2 transition-colors hover:bg-surface-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-text-primary">{project.title}</span>
                <StatusBadge status={project.status} />
              </div>
              <div className="mt-2 space-y-1">
                <ProgressBar value={project.progress ?? 0} />
                {project.health ? (
                  <p className="text-2xs text-text-muted">
                    Health: {project.health.replaceAll('_', ' ')}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </LinkedListCard>

        <LinkedListCard
          title="Direct Tasks"
          icon={<CheckSquare size={16} className="text-text-muted" />}
          countLabel={tasks.length > 0 ? `(${tasks.length})` : undefined}
          emptyMessage="No tasks are linked directly to this goal yet."
        >
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="block rounded-lg border border-surface-2 px-3 py-2 transition-colors hover:bg-surface-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-text-primary">{task.title}</span>
                <StatusBadge status={task.status} />
              </div>
              <div className="mt-1 flex items-center gap-3 text-2xs text-text-muted">
                {task.priority ? <span>{task.priority.toUpperCase()}</span> : null}
                {task.dueDate ? <span>Due {formatISODate(task.dueDate)}</span> : null}
              </div>
            </Link>
          ))}
        </LinkedListCard>

        <LinkedListCard
          title="Direct Habits"
          icon={<Repeat size={16} className="text-text-muted" />}
          countLabel={habits.length > 0 ? `(${habits.length})` : undefined}
          emptyMessage="No habits are linked directly to this goal yet."
        >
          {habits.map((habit) => (
            <Link
              key={habit.id}
              href={`/habits/${habit.id}`}
              className="block rounded-lg border border-surface-2 px-3 py-2 transition-colors hover:bg-surface-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-text-primary">{habit.name}</span>
                {habit.currentStreak && habit.currentStreak > 0 ? (
                  <span className="text-2xs text-status-warning">🔥 {habit.currentStreak}</span>
                ) : null}
              </div>
              <div className="mt-1 flex items-center gap-3 text-2xs text-text-muted">
                {habit.cadence ? <span>{habit.cadence}</span> : null}
                {habit.domain ? <span>{habit.domain}</span> : null}
              </div>
            </Link>
          ))}
        </LinkedListCard>
      </div>

      <RelationsPanel
        items={relatedItems}
        structuralItems={structuralItems}
        suggestions={suggestedItems}
        currentItemType="goal"
        currentItemId={goal.id}
      />
    </DetailPageShell>
  );
}
