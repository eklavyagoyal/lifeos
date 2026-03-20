'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DetailPageShell } from '@/components/detail/detail-page-shell';
import { EditableField } from '@/components/detail/editable-field';
import { StatusBadge } from '@/components/detail/status-badge';
import { TagsPills } from '@/components/detail/tags-pills';
import { RelationsPanel } from '@/components/detail/relations-panel';
import { updateHabitAction, archiveHabitAction, toggleHabitAction } from '@/app/actions';
import { formatDate } from '@/lib/utils';
import type { ConnectionItem, ConnectionSuggestion } from '@/lib/types';
import { Flame, Target, FolderKanban } from 'lucide-react';
import { DOMAIN_LABELS, DOMAIN_ICONS } from '@/lib/constants';

interface Habit {
  id: string;
  name: string;
  description: string | null;
  body: string | null;
  cadence: string | null;
  scheduleRule: string | null;
  targetCount: number | null;
  currentStreak: number | null;
  longestStreak: number | null;
  graceDays: number | null;
  domain: string | null;
  difficulty: string | null;
  scoringWeight: number | null;
  isPaused: number | null;
  goalId: string | null;
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface Completion {
  completedDate: string;
}

interface GoalOption {
  id: string;
  title: string;
}

interface ProjectOption {
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

const CADENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS).map(([value, label]) => ({
  value,
  label: `${DOMAIN_ICONS[value] || ''} ${label}`.trim(),
}));

interface HabitDetailClientProps {
  habit: Habit;
  goal: { id: string; title: string } | null | undefined;
  goals: GoalOption[];
  project: { id: string; title: string } | null | undefined;
  projects: ProjectOption[];
  completions: Completion[];
  relatedItems: RelatedItem[];
  structuralItems: RelatedItem[];
  suggestedItems: SuggestedItem[];
  tags: Tag[];
}

export function HabitDetailClient({
  habit,
  goal,
  goals,
  project,
  projects,
  completions,
  relatedItems,
  structuralItems,
  suggestedItems,
  tags,
}: HabitDetailClientProps) {
  const router = useRouter();

  const handleUpdate = async (field: string, value: unknown) => {
    await updateHabitAction(habit.id, { [field]: value });
    router.refresh();
  };

  const handleArchive = async () => {
    await archiveHabitAction(habit.id);
    router.push('/habits');
  };

  // Build 30-day calendar
  const completionDates = new Set(completions.map((c) => c.completedDate));
  const last30Days: { date: string; completed: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    last30Days.push({ date: dateStr, completed: completionDates.has(dateStr) });
  }

  const completionRate = last30Days.length > 0
    ? Math.round((last30Days.filter((d) => d.completed).length / last30Days.length) * 100)
    : 0;

  return (
    <DetailPageShell
      backHref="/habits"
      backLabel="Habits"
      title={habit.name}
      onTitleChange={(name) => handleUpdate('name', name)}
      badge={
        habit.domain ? (
          <span className="badge bg-surface-2 text-text-tertiary">
            {DOMAIN_ICONS[habit.domain]} {DOMAIN_LABELS[habit.domain]}
          </span>
        ) : undefined
      }
      onArchive={handleArchive}
    >
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1 text-lg font-semibold text-text-primary">
            <Flame size={18} className="text-status-warning" />
            {habit.currentStreak ?? 0}
          </div>
          <p className="text-2xs text-text-muted">Current Streak</p>
        </div>
        <div className="card text-center">
          <p className="text-lg font-semibold text-text-primary">
            {habit.longestStreak ?? 0}
          </p>
          <p className="text-2xs text-text-muted">Longest Streak</p>
        </div>
        <div className="card text-center">
          <p className="text-lg font-semibold text-text-primary">
            {completionRate}%
          </p>
          <p className="text-2xs text-text-muted">30-Day Rate</p>
        </div>
      </div>

      {/* 30-Day Calendar */}
      <div className="card">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-3">
          Last 30 Days
        </h3>
        <div className="flex flex-wrap gap-1">
          {last30Days.map((day) => (
            <div
              key={day.date}
              title={day.date}
              className={`h-5 w-5 rounded-sm ${
                day.completed
                  ? 'bg-green-500'
                  : 'bg-surface-2'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <EditableField
            label="Cadence"
            value={habit.cadence}
            onSave={(v) => handleUpdate('cadence', v)}
            type="select"
            options={CADENCE_OPTIONS}
          />
          <EditableField
            label="Difficulty"
            value={habit.difficulty}
            onSave={(v) => handleUpdate('difficulty', v)}
            type="select"
            options={DIFFICULTY_OPTIONS}
          />
          <EditableField
            label="Domain"
            value={habit.domain}
            onSave={(v) => handleUpdate('domain', v)}
            type="select"
            options={DOMAIN_OPTIONS}
          />
          <EditableField
            label="Grace Days"
            value={habit.graceDays?.toString()}
            onSave={(v) => handleUpdate('graceDays', parseInt(v) || 1)}
            type="number"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <EditableField
            label="Goal"
            value={habit.goalId}
            onSave={(value) => handleUpdate('goalId', value || null)}
            type="select"
            options={goals.map((item) => ({ value: item.id, label: item.title }))}
            emptyLabel="No goal linked"
          />
          <EditableField
            label="Project"
            value={habit.projectId}
            onSave={(value) => handleUpdate('projectId', value || null)}
            type="select"
            options={projects.map((item) => ({ value: item.id, label: item.title }))}
            emptyLabel="No project linked"
          />
        </div>
      </div>

      {/* Linked Goal / Project */}
      {(goal || project) && (
        <div className="card space-y-2">
          {goal && (
            <div>
              <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">Goal</span>
              <Link
                href={`/goals/${goal.id}`}
                className="mt-1 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 transition-colors"
              >
                <Target size={14} />
                {goal.title}
              </Link>
            </div>
          )}
          {project && (
            <div>
              <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">Project</span>
              <Link
                href={`/projects/${project.id}`}
                className="mt-1 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 transition-colors"
              >
                <FolderKanban size={14} />
                {project.title}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <div className="card">
        <EditableField
          label="Description"
          value={habit.description}
          onSave={(v) => handleUpdate('description', v)}
          type="textarea"
          placeholder="Why this habit matters..."
          emptyLabel="Add a description..."
        />
      </div>

      <div className="card">
        <EditableField
          label="Notes"
          value={habit.body}
          onSave={(value) => handleUpdate('body', value)}
          type="textarea"
          placeholder="Prompts, setup notes, and nuance..."
          emptyLabel="Add notes..."
        />
      </div>

      {/* Tags */}
      <div className="card">
        <h3 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">Tags</h3>
        <TagsPills itemType="habit" itemId={habit.id} tags={tags} />
      </div>

      {/* Relations */}
      <RelationsPanel
        items={relatedItems}
        structuralItems={structuralItems}
        suggestions={suggestedItems}
        currentItemType="habit"
        currentItemId={habit.id}
      />
    </DetailPageShell>
  );
}
