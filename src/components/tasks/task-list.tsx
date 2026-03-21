'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Circle, CheckCircle2, Calendar, Flag, Plus } from 'lucide-react';
import { toggleTaskAction, createTaskAction } from '@/app/actions';
import { cn } from '@/lib/cn';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants';
import { formatISODate } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  scheduledDate: string | null;
  projectId: string | null;
}

interface TaskListProps {
  tasks: Task[];
  showAddButton?: boolean;
  emptyMessage?: string;
  variant?: 'default' | 'today';
}

export function TaskList({
  tasks,
  showAddButton = true,
  emptyMessage = 'No tasks',
  variant = 'default',
}: TaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const isToday = variant === 'today';

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    const formData = new FormData();
    formData.set('title', newTaskTitle.trim());
    await createTaskAction(formData);
    setNewTaskTitle('');
    setIsAdding(false);
  };

  return (
    <div className={cn(isToday ? 'space-y-2.5' : 'space-y-2')}>
      {tasks.length === 0 && !isAdding && (
        <div
          className={cn(
            'secondary-empty-state py-8 text-sm text-text-muted',
            isToday && 'rounded-[1.4rem]'
          )}
        >
          {emptyMessage}
        </div>
      )}

      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} variant={variant} />
      ))}

      {isAdding && (
        <div
          className={cn(
            'secondary-inline-form flex items-center gap-3 px-3 py-3',
            isToday && 'rounded-[1.45rem]'
          )}
        >
          <span className="secondary-icon-badge h-9 w-9 rounded-[1rem]">
            <Circle size={17} />
          </span>
          <input
            autoFocus
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTask();
              if (e.key === 'Escape') { setIsAdding(false); setNewTaskTitle(''); }
            }}
            onBlur={() => {
              if (newTaskTitle.trim()) handleAddTask();
              else { setIsAdding(false); setNewTaskTitle(''); }
            }}
            placeholder="Task title..."
            className="secondary-input flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none"
          />
        </div>
      )}

      {showAddButton && !isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className={cn(
            'secondary-row w-full border-dashed text-left',
            isToday &&
              'rounded-[1.45rem] px-3 py-3'
          )}
        >
          <span className="secondary-icon-badge h-9 w-9 rounded-[1rem]">
            <Plus size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-text-primary">Add task</span>
            <span className="mt-0.5 block text-2xs text-text-muted">
              Drop a new commitment into the list without leaving the page.
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

function TaskItem({ task, variant }: { task: Task; variant: 'default' | 'today' }) {
  const [isToggling, setIsToggling] = useState(false);
  const isDone = task.status === 'done';
  const isToday = variant === 'today';

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsToggling(true);
    await toggleTaskAction(task.id);
    setIsToggling(false);
  };

  return (
    <Link href={`/tasks/${task.id}`}>
      <div
        className={cn(
          isToday
            ? 'card-interactive secondary-row group rounded-[1.45rem] px-3.5 py-3.5'
            : 'secondary-row group px-3 py-3',
          isToggling && 'opacity-50'
        )}
      >
        <button
          onClick={handleToggle}
          disabled={isToggling}
          className={cn(
            'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[1rem] border transition-all duration-300 ease-luxury',
            optimisticButtonState(isDone)
          )}
        >
          {isDone ? (
            <CheckCircle2 size={18} className="text-status-success" />
          ) : (
            <Circle size={18} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                isToday ? 'min-w-0 text-sm font-medium' : 'text-sm font-medium',
                isDone && 'line-through text-text-muted'
              )}
            >
              {task.title}
            </span>

            {isToday ? (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {task.priority && (
                  <span className="secondary-chip">
                    <Flag size={11} className={PRIORITY_COLORS[task.priority] || 'text-text-muted'} />
                    {PRIORITY_LABELS[task.priority] ?? task.priority.toUpperCase()}
                  </span>
                )}
                {task.dueDate && (
                  <span className="secondary-chip">
                    <Calendar size={11} />
                    {formatISODate(task.dueDate)}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {!isToday && (task.priority || task.dueDate || task.scheduledDate) ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {task.priority ? (
                <span className="secondary-chip">
                  <Flag size={11} className={PRIORITY_COLORS[task.priority] || 'text-text-muted'} />
                  {PRIORITY_LABELS[task.priority] ?? task.priority.toUpperCase()}
                </span>
              ) : null}
              {task.dueDate ? (
                <span className="secondary-chip">
                  <Calendar size={11} />
                  Due {formatISODate(task.dueDate)}
                </span>
              ) : null}
              {!task.dueDate && task.scheduledDate ? (
                <span className="secondary-chip">
                  <Calendar size={11} />
                  Scheduled {formatISODate(task.scheduledDate)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function optimisticButtonState(isDone: boolean) {
  if (isDone) {
    return 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] text-status-success shadow-[0_12px_22px_-18px_rgba(34,197,94,0.55)]';
  }

  return 'border-line-soft bg-surface-1/70 text-text-muted hover:border-brand-300 hover:text-brand-500';
}
