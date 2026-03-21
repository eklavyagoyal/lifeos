'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  AlarmClockCheck,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Circle,
  Compass,
  FolderKanban,
  Hourglass,
  Link2,
  Loader2,
  NotebookPen,
  Orbit,
  Sparkles,
  Tags,
  Target,
  Zap,
} from 'lucide-react';
import { updateTaskAction, archiveTaskAction, toggleTaskAction } from '@/app/actions';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { ProgressBar } from '@/components/detail/progress-bar';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { StatusBadge } from '@/components/detail/status-badge';
import { TagsPills } from '@/components/detail/tags-pills';
import { cn } from '@/lib/cn';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import { formatDate, formatISODate, relativeDayLabel, wordCount } from '@/lib/utils';

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

const PRIORITY_META: Record<
  string,
  { label: string; chipClass: string; support: string }
> = {
  none: {
    label: 'Priority open',
    chipClass:
      'border-[rgba(121,102,82,0.14)] bg-[rgba(242,237,232,0.92)] text-[rgb(110,92,74)]',
    support: 'No priority signal has been set yet. Leave it open if the work does not need extra pressure.',
  },
  p1: {
    label: 'P1 / Urgent',
    chipClass:
      'border-[rgba(184,95,80,0.16)] bg-[rgba(252,234,229,0.92)] text-[rgb(156,72,56)]',
    support: 'Protect time for this soon. It carries the strongest urgency signal.',
  },
  p2: {
    label: 'P2 / High',
    chipClass:
      'border-[rgba(198,150,76,0.18)] bg-[rgba(252,244,223,0.92)] text-[rgb(151,111,34)]',
    support: 'Worth prioritizing, even if the calendar can still breathe around it.',
  },
  p3: {
    label: 'P3 / Medium',
    chipClass:
      'border-[rgba(93,132,186,0.16)] bg-[rgba(231,239,251,0.92)] text-[rgb(71,107,160)]',
    support: 'A solid supporting task. It matters, but it does not need to crowd the rest.',
  },
  p4: {
    label: 'P4 / Gentle',
    chipClass:
      'border-[rgba(121,102,82,0.14)] bg-[rgba(242,237,232,0.92)] text-[rgb(110,92,74)]',
    support: 'Low-pressure work. Keep it visible, but it can wait for a natural opening.',
  },
};

const EFFORT_LABELS: Record<string, string> = {
  tiny: 'Tiny lift',
  small: 'Small session',
  medium: 'Focused block',
  large: 'Deep work',
  epic: 'Major push',
};

const ENERGY_LABELS: Record<string, string> = {
  low: 'Low energy friendly',
  medium: 'Needs steady focus',
  high: 'Best with a sharp brain',
};

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

interface TaskNarrative {
  eyebrow: string;
  headline: string;
  summary: string;
}

function parseLocalISODate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

function getDayDifferenceFromToday(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalISODate(isoDate);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function getDateSignal(
  isoDate: string | null,
  emptyLabel: string,
  emptyNote: string
): { value: string; note: string } {
  if (!isoDate) {
    return { value: emptyLabel, note: emptyNote };
  }

  return {
    value: relativeDayLabel(isoDate),
    note: formatISODate(isoDate),
  };
}

function getDueSignal(task: Task): { value: string; note: string } {
  if (task.status === 'done' && task.completedAt) {
    return {
      value: 'Closed',
      note: `Finished ${formatDate(task.completedAt)}`,
    };
  }

  if (!task.dueDate) {
    return {
      value: 'No deadline',
      note: 'Set a due date only when timing is meaningful.',
    };
  }

  const difference = getDayDifferenceFromToday(task.dueDate);
  if (difference < 0) {
    return {
      value: `${Math.abs(difference)} day${Math.abs(difference) === 1 ? '' : 's'} overdue`,
      note: formatISODate(task.dueDate),
    };
  }

  if (difference === 0) {
    return {
      value: 'Due today',
      note: formatISODate(task.dueDate),
    };
  }

  return {
    value: relativeDayLabel(task.dueDate),
    note: formatISODate(task.dueDate),
  };
}

function getTaskNarrative(
  task: Task,
  project: Project | null | undefined,
  goal: Goal | null | undefined
): TaskNarrative {
  const anchor =
    project?.title ?? goal?.title ?? 'your current orbit';

  if (task.status === 'done') {
    return {
      eyebrow: 'Closed Loop',
      headline: 'This task has already been carried across the line.',
      summary: task.completedAt
        ? `It was wrapped on ${formatDate(task.completedAt)}. Use the notes and links below as the artifact trail for what mattered.`
        : 'It is marked complete and now lives here as a record of what was done and what it connected to.',
    };
  }

  if (task.dueDate) {
    const difference = getDayDifferenceFromToday(task.dueDate);
    if (difference < 0) {
      return {
        eyebrow: 'Pressure Window',
        headline: 'This task is overdue and asking for a deliberate decision.',
        summary: `The deadline has already passed while the task still belongs to ${anchor}. Either move it, finish it, or consciously release the pressure so it stops leaking attention.`,
      };
    }

    if (difference === 0) {
      return {
        eyebrow: 'Today Matters',
        headline: 'The finish line for this task is today.',
        summary: `Keep the task visible and concrete. It already has a real timing edge, so the job now is simply to protect enough focus to get it across.`,
      };
    }

    if (difference === 1) {
      return {
        eyebrow: 'Near Horizon',
        headline: 'This task becomes time-sensitive tomorrow.',
        summary: `There is still room to sequence it well, but the window is tightening. Make sure the notes, timing, and surrounding context are ready before tomorrow arrives.`,
      };
    }
  }

  if (task.scheduledDate) {
    const difference = getDayDifferenceFromToday(task.scheduledDate);
    if (difference > 0) {
      return {
        eyebrow: 'Calendar Anchor',
        headline: 'This task already has a future slot waiting for it.',
        summary: `The important thing now is clarity, not pressure. Use this page to make sure the work will be easy to pick up when that scheduled window arrives.`,
      };
    }

    if (difference === 0) {
      return {
        eyebrow: 'On Deck',
        headline: 'This task is on today’s calendar and ready for a real block.',
        summary: `The scheduling decision has already been made. What matters now is having clean notes, the right energy window, and enough surrounding context to execute without drift.`,
      };
    }
  }

  if (task.status === 'in_progress') {
    return {
      eyebrow: 'In Motion',
      headline: 'This task is already alive and moving.',
      summary: `Keep the friction low. Tighten the notes, confirm the next visible step, and let this page hold the context so you do not have to reconstruct it later.`,
    };
  }

  if (task.priority === 'p1') {
    return {
      eyebrow: 'Priority Signal',
      headline: 'This is important work even before the calendar says so.',
      summary: `The priority is already telling you the task deserves protection. Give it a real schedule or sharpen its notes until starting feels obvious.`,
    };
  }

  return {
    eyebrow: 'Ready State',
    headline: 'This task is shaped enough to move with a little more intention.',
    summary: `There is no hard deadline pulling it yet, which makes structure matter even more. Use this page to give the task a cleaner edge before it competes with everything else in your system.`,
  };
}

function computeTaskClarityScore(
  task: Task,
  options: { hasProject: boolean; hasGoal: boolean; hasTags: boolean }
): number {
  const fulfilled = [
    Boolean(task.body?.trim()),
    Boolean(task.priority),
    Boolean(task.dueDate || task.scheduledDate),
    Boolean(task.effortEstimate),
    Boolean(task.energyRequired),
    Boolean(task.context?.trim()),
    options.hasProject || options.hasGoal,
    options.hasTags,
  ].filter(Boolean).length;

  return Math.round((fulfilled / 8) * 100);
}

function getClarityLabel(score: number): string {
  if (score >= 88) return 'Ready to execute';
  if (score >= 63) return 'Well framed';
  if (score >= 38) return 'Needs a bit more shape';
  return 'Still hazy';
}

function getTaskSubtitle(task: Task, orbitCount: number): string | undefined {
  const parts: string[] = [];

  if (task.status === 'done' && task.completedAt) {
    parts.push(`Completed ${formatDate(task.completedAt)}`);
  } else {
    if (task.dueDate) {
      parts.push(`${relativeDayLabel(task.dueDate)} due`);
    }
    if (task.scheduledDate) {
      parts.push(`Scheduled ${relativeDayLabel(task.scheduledDate)}`);
    }
  }

  if (orbitCount > 0) {
    parts.push(`${orbitCount} surrounding signal${orbitCount === 1 ? '' : 's'}`);
  }

  return parts.join(' · ') || undefined;
}

function TaskSignalCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.45rem] border border-[rgba(121,95,67,0.12)] bg-[linear-gradient(180deg,rgba(255,252,246,0.9),rgba(246,236,223,0.72))] p-4 shadow-[0_20px_40px_-30px_rgba(58,39,24,0.24)]">
      <div className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.22em] text-text-muted">
        <span className="flex h-9 w-9 items-center justify-center rounded-[1rem] border border-[rgba(120,95,68,0.12)] bg-white/70 text-brand-700 shadow-soft">
          <Icon size={15} />
        </span>
        {label}
      </div>
      <div className="mt-4 text-lg font-semibold tracking-[-0.03em] text-text-primary">{value}</div>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{note}</p>
    </div>
  );
}

function OrbitLinkCard({
  href,
  icon: Icon,
  label,
  value,
  description,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4 text-left transition-all duration-300 ease-luxury hover:border-[rgba(255,241,226,0.18)] hover:bg-white/10"
    >
      <div className="flex min-w-0 gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/10 text-[rgba(255,239,219,0.9)] shadow-[inset_0_1px_0_rgba(255,248,239,0.08)]">
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,233,206,0.58)]">
            {label}
          </div>
          <div className="mt-2 truncate text-sm font-medium text-[rgba(255,245,233,0.96)]">
            {value}
          </div>
          <p className="mt-1 text-sm leading-6 text-[rgba(255,235,214,0.68)]">{description}</p>
        </div>
      </div>
      <ArrowUpRight
        size={16}
        className="mt-1 shrink-0 text-[rgba(255,233,206,0.54)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[rgba(255,245,233,0.92)]"
      />
    </Link>
  );
}

function LedgerRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="detail-list-row items-start">
      <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-[rgba(120,95,68,0.12)] bg-white/72 text-brand-700 shadow-soft">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-2xs font-medium uppercase tracking-[0.22em] text-text-muted">{label}</div>
        <div className="mt-2 text-sm font-medium leading-6 text-text-primary">{value}</div>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{detail}</p>
      </div>
    </div>
  );
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
  const [isPending, startTransition] = useTransition();
  const [actionLabel, setActionLabel] = useState('');
  const [noteDraft, setNoteDraft] = useState(task.body || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  useEffect(() => {
    setNoteDraft(task.body || '');
  }, [task.body]);

  const isDone = task.status === 'done';
  const narrative = getTaskNarrative(task, project, goal);
  const priorityMeta = PRIORITY_META[task.priority ?? 'none'] ?? PRIORITY_META.none;
  const dueSignal = getDueSignal(task);
  const scheduledSignal = getDateSignal(
    task.scheduledDate,
    'Open calendar',
    'No protected slot yet.'
  );
  const effortValue = EFFORT_LABELS[task.effortEstimate ?? ''] ?? 'Not sized';
  const energyValue = ENERGY_LABELS[task.energyRequired ?? ''] ?? 'Any energy window';
  const taskClarity = computeTaskClarityScore(task, {
    hasProject: Boolean(project),
    hasGoal: Boolean(goal),
    hasTags: tags.length > 0,
  });
  const clarityLabel = getClarityLabel(taskClarity);
  const orbitCount = [
    Boolean(project),
    Boolean(goal),
    Boolean(task.context?.trim()),
    tags.length > 0,
    relatedItems.length + structuralItems.length > 0,
  ].filter(Boolean).length;
  const subtitle = getTaskSubtitle(task, orbitCount);
  const noteWordCount = noteDraft.trim() ? wordCount(noteDraft) : 0;

  const runTaskMutation = (
    label: string,
    work: () => Promise<void>,
    options?: {
      onSuccess?: () => void;
      refresh?: boolean;
    }
  ) => {
    startTransition(async () => {
      setActionLabel(label);
      await work();
      options?.onSuccess?.();
      setActionLabel('');
      if (options?.refresh !== false) {
        router.refresh();
      }
    });
  };

  const handleUpdate = (field: string, value: unknown) => {
    runTaskMutation('Saving task details…', async () => {
      await updateTaskAction(task.id, { [field]: value });
    });
  };

  const handleToggle = () => {
    runTaskMutation(isDone ? 'Reopening task…' : 'Marking task complete…', async () => {
      await toggleTaskAction(task.id);
    });
  };

  const handleSaveNotes = () => {
    if (noteDraft === (task.body || '')) {
      setIsEditingNotes(false);
      return;
    }

    runTaskMutation('Saving notes…', async () => {
      await updateTaskAction(task.id, { body: noteDraft });
    }, {
      onSuccess: () => setIsEditingNotes(false),
    });
  };

  const handleArchive = async () => {
    await archiveTaskAction(task.id);
    router.push('/tasks');
  };

  const totalConnections = relatedItems.length + structuralItems.length;

  return (
    <DetailPageShell
      backHref="/tasks"
      backLabel="Tasks"
      title={task.title}
      subtitle={subtitle}
      onTitleChange={(title) => handleUpdate('title', title)}
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} size="md" />
          <span className={cn('badge text-xs', priorityMeta.chipClass)}>{priorityMeta.label}</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          {isPending ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-0/82 px-3 py-1.5 text-xs text-text-secondary shadow-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {actionLabel}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ease-luxury disabled:cursor-not-allowed disabled:opacity-60',
              isDone
                ? 'border-[rgba(96,127,97,0.18)] bg-[rgba(228,239,229,0.92)] text-[rgb(78,107,81)] hover:bg-[rgba(235,244,236,0.96)]'
                : 'border-[rgba(121,95,67,0.14)] bg-[linear-gradient(135deg,rgba(255,251,245,0.92),rgba(245,235,219,0.78))] text-text-primary hover:border-[rgba(174,93,44,0.18)] hover:bg-[linear-gradient(135deg,rgba(255,252,247,0.98),rgba(248,238,225,0.84))]'
            )}
          >
            {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            {isDone ? 'Completed' : 'Mark done'}
          </button>
        </div>
      }
      onArchive={handleArchive}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <section className="surface-panel overflow-hidden p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="section-kicker">{narrative.eyebrow}</div>
              <h2 className="mt-3 font-display text-[clamp(1.9rem,3vw,3rem)] leading-[0.96] tracking-[-0.05em] text-text-primary">
                {narrative.headline}
              </h2>
              <p className="mt-4 text-sm leading-7 text-text-secondary">{narrative.summary}</p>
            </div>
            <div className="rounded-[1.35rem] border border-[rgba(121,95,67,0.12)] bg-white/62 px-4 py-3 shadow-soft">
              <div className="text-2xs font-medium uppercase tracking-[0.22em] text-text-muted">
                Priority Read
              </div>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{priorityMeta.support}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <TaskSignalCard
              icon={CalendarDays}
              label="Urgency"
              value={dueSignal.value}
              note={dueSignal.note}
            />
            <TaskSignalCard
              icon={CalendarRange}
              label="Schedule"
              value={scheduledSignal.value}
              note={scheduledSignal.note}
            />
            <TaskSignalCard
              icon={Zap}
              label="Execution"
              value={effortValue}
              note={energyValue}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
            <div className="rounded-[1.55rem] border border-[rgba(121,95,67,0.12)] bg-[linear-gradient(180deg,rgba(255,251,245,0.88),rgba(246,236,223,0.74))] p-5 shadow-[0_22px_48px_-36px_rgba(58,39,24,0.24)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-text-primary">Execution clarity</div>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    This score tracks how much context the task already carries before you start.
                  </p>
                </div>
                <span className="shell-meta-pill">{clarityLabel}</span>
              </div>
              <ProgressBar value={taskClarity} size="md" className="mt-4" />
            </div>

            <div className="rounded-[1.55rem] border border-[rgba(121,95,67,0.12)] bg-[rgba(255,250,243,0.76)] p-5 shadow-[0_18px_36px_-30px_rgba(58,39,24,0.2)]">
              <div className="text-2xs font-medium uppercase tracking-[0.22em] text-text-muted">
                Task Orbit
              </div>
              <div className="mt-3 text-3xl font-display tracking-[-0.05em] text-text-primary">
                {orbitCount}
              </div>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                active surrounding signal{orbitCount === 1 ? '' : 's'} across context, tags, links, or parent alignment.
              </p>
            </div>
          </div>
        </section>

        <aside className="surface-obsidian overflow-hidden p-6">
          <div className="section-kicker text-[rgba(255,232,206,0.58)]">Alignment Orbit</div>
          <h3 className="mt-3 font-display text-[clamp(1.55rem,2vw,2.1rem)] leading-[0.98] tracking-[-0.04em] text-[rgba(255,245,233,0.98)]">
            The work around the work.
          </h3>
          <p className="mt-3 text-sm leading-7 text-[rgba(255,235,214,0.7)]">
            Keep the task connected to the project, goal, and context it belongs to, so reopening it later does not require rebuilding the whole mental picture.
          </p>

          <div className="mt-5 space-y-3">
            {goal ? (
              <OrbitLinkCard
                href={`/goals/${goal.id}`}
                icon={Target}
                label="Goal"
                value={goal.title}
                description="This task contributes directly to a larger outcome or chapter."
              />
            ) : null}

            {project ? (
              <OrbitLinkCard
                href={`/projects/${project.id}`}
                icon={FolderKanban}
                label="Project"
                value={project.title}
                description="The project link gives this task operational context and neighbors."
              />
            ) : null}

            {!goal && !project ? (
              <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-[rgba(255,235,214,0.74)]">
                This task is currently floating without a linked project or goal. If it belongs somewhere bigger, connect it so the surrounding system can carry more of the memory for you.
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,233,206,0.54)]">
                <Compass size={13} />
                Context
              </div>
              <p className="mt-2 text-sm leading-6 text-[rgba(255,245,233,0.94)]">
                {task.context?.trim() || 'No context label yet'}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,233,206,0.54)]">
                <Link2 size={13} />
                Source
              </div>
              <p className="mt-2 text-sm leading-6 text-[rgba(255,245,233,0.94)]">
                {task.source?.trim() || 'Captured directly in LifeOS'}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,233,206,0.54)]">
                <Tags size={13} />
                Tags
              </div>
              <p className="mt-2 text-sm leading-6 text-[rgba(255,245,233,0.94)]">
                {tags.length > 0 ? `${tags.length} tag${tags.length === 1 ? '' : 's'} attached` : 'No tags yet'}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,233,206,0.54)]">
                <Orbit size={13} />
                Connections
              </div>
              <p className="mt-2 text-sm leading-6 text-[rgba(255,245,233,0.94)]">
                {totalConnections > 0
                  ? `${totalConnections} linked item${totalConnections === 1 ? '' : 's'}`
                  : 'No linked items yet'}
              </p>
              {suggestedItems.length > 0 ? (
                <p className="mt-1 text-xs text-[rgba(255,233,206,0.62)]">
                  {suggestedItems.length} suggestion{suggestedItems.length === 1 ? '' : 's'} waiting below.
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-line-soft/60 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="section-kicker">Working Notes</div>
                <h3 className="mt-3 font-display text-[clamp(1.45rem,2vw,2.1rem)] leading-[0.98] tracking-[-0.04em] text-text-primary">
                  Keep the nuance attached to the task.
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary">
                  Capture what would otherwise be easy to forget: edge cases, next steps, assumptions, or the tiny bit of setup your future self will be grateful for.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="shell-meta-pill">
                  <NotebookPen size={12} />
                  {noteWordCount > 0 ? `${noteWordCount} words` : 'No notes yet'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingNotes) {
                      handleSaveNotes();
                    } else {
                      setIsEditingNotes(true);
                    }
                  }}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(121,95,67,0.14)] bg-[linear-gradient(135deg,rgba(255,251,245,0.92),rgba(245,235,219,0.78))] px-4 py-2 text-sm font-medium text-text-primary transition-all duration-300 ease-luxury hover:border-[rgba(174,93,44,0.18)] hover:bg-[linear-gradient(135deg,rgba(255,252,247,0.98),rgba(248,238,225,0.84))] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEditingNotes ? 'Save notes' : 'Edit notes'}
                </button>
                {isEditingNotes ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNoteDraft(task.body || '');
                      setIsEditingNotes(false);
                    }}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface-0/82 px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-brand-300 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="rounded-[1.7rem] border border-[rgba(121,95,67,0.12)] bg-[linear-gradient(180deg,rgba(255,252,247,0.94),rgba(247,238,226,0.82))] p-5 shadow-[inset_0_1px_0_rgba(255,252,246,0.92),0_26px_52px_-42px_rgba(58,39,24,0.3)]">
              {isEditingNotes ? (
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  rows={16}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      handleSaveNotes();
                    }
                    if (event.key === 'Escape') {
                      setNoteDraft(task.body || '');
                      setIsEditingNotes(false);
                    }
                  }}
                  className="min-h-[20rem] w-full resize-y rounded-[1.3rem] border border-[rgba(174,93,44,0.16)] bg-[rgba(255,253,249,0.92)] px-4 py-4 text-sm leading-7 text-text-primary shadow-[inset_0_1px_0_rgba(255,252,246,0.96),0_20px_40px_-32px_rgba(58,39,24,0.18)] outline-none transition-shadow focus:border-[rgba(174,93,44,0.24)] focus:shadow-[inset_0_1px_0_rgba(255,252,246,0.96),0_24px_46px_-34px_rgba(58,39,24,0.22),0_0_0_4px_rgba(255,234,208,0.72)]"
                  placeholder="Capture the details that make the task easier to restart later."
                />
              ) : noteDraft.trim() ? (
                <div className="whitespace-pre-wrap text-sm leading-8 text-text-primary">{noteDraft}</div>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-[rgba(121,95,67,0.16)] bg-[rgba(255,250,243,0.62)] px-4 py-5 text-sm leading-7 text-text-secondary">
                  No working notes yet. This is the right place for the hidden setup, decisions, caveats, or “do this first” instructions you do not want to reconstruct later.
                </div>
              )}
            </div>

            {isEditingNotes ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
                <span>Use <kbd className="capture-command-kbd">Cmd</kbd> + <kbd className="capture-command-kbd">Enter</kbd> to save quickly.</span>
                <span>{noteWordCount > 0 ? `${noteWordCount} words in this note` : 'Start sketching the execution details.'}</span>
              </div>
            ) : null}
          </div>
        </section>

        <div className="space-y-4">
          <section className="detail-side-panel">
            <div className="detail-panel-header">
              <div>
                <div className="section-kicker">Task Setup</div>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">
                  Shape the conditions for execution.
                </h3>
              </div>
              <span className="shell-meta-pill">
                <Sparkles size={12} />
                Adjust in place
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <EditableField
                label="Status"
                value={task.status}
                onSave={(value) => handleUpdate('status', value)}
                type="select"
                options={STATUS_OPTIONS}
              />
              <EditableField
                label="Priority"
                value={task.priority}
                onSave={(value) => handleUpdate('priority', value)}
                type="select"
                options={PRIORITY_OPTIONS}
              />
              <EditableField
                label="Due Date"
                value={task.dueDate}
                onSave={(value) => handleUpdate('dueDate', value)}
                type="date"
              />
              <EditableField
                label="Scheduled Date"
                value={task.scheduledDate}
                onSave={(value) => handleUpdate('scheduledDate', value)}
                type="date"
              />
              <EditableField
                label="Effort"
                value={task.effortEstimate}
                onSave={(value) => handleUpdate('effortEstimate', value)}
                type="select"
                options={EFFORT_OPTIONS}
              />
              <EditableField
                label="Energy"
                value={task.energyRequired}
                onSave={(value) => handleUpdate('energyRequired', value)}
                type="select"
                options={ENERGY_OPTIONS}
              />
              <EditableField
                label="Context"
                value={task.context}
                onSave={(value) => handleUpdate('context', value)}
                placeholder="@home, @work, @errands..."
              />
              <EditableField
                label="Goal"
                value={task.goalId}
                onSave={(value) => handleUpdate('goalId', value || null)}
                type="select"
                options={goals.map((item) => ({ value: item.id, label: item.title }))}
                emptyLabel="No goal linked"
              />
            </div>
          </section>

          <section className="detail-side-panel">
            <div className="detail-panel-header">
              <div>
                <div className="section-kicker">Task Ledger</div>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">
                  Timing, provenance, and closure.
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              <LedgerRow
                icon={Hourglass}
                label="Created"
                value={formatDate(task.createdAt)}
                detail="The first moment this task entered the system."
              />
              <LedgerRow
                icon={AlarmClockCheck}
                label="Updated"
                value={formatDate(task.updatedAt)}
                detail="Most recent edit, rename, or field adjustment."
              />
              <LedgerRow
                icon={isDone ? CheckCircle2 : Circle}
                label={isDone ? 'Completed' : 'Current state'}
                value={isDone && task.completedAt ? formatDate(task.completedAt) : 'Still active'}
                detail={
                  isDone
                    ? 'Completion timestamp for this artifact.'
                    : 'This task is still open and can keep collecting execution context.'
                }
              />
            </div>
          </section>

          <section className="detail-side-panel">
            <div className="detail-panel-header">
              <div>
                <div className="section-kicker">Tags</div>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">
                  Retrieval and thematic color.
                </h3>
              </div>
            </div>
            <TagsPills itemType="task" itemId={task.id} tags={tags} />
          </section>
        </div>
      </div>

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
