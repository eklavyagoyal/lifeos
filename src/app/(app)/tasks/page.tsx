import { getAllTasks } from '@/server/services/tasks';
import { TaskList } from '@/components/tasks/task-list';

export const metadata = { title: 'Tasks — lifeOS' };
export const dynamic = 'force-dynamic';

export default function TasksPage() {
  const activeTasks = getAllTasks();
  const todoTasks = activeTasks.filter(t => t.status === 'todo' || t.status === 'in_progress');
  const inboxTasks = activeTasks.filter(t => t.status === 'inbox');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker">Work Bench</div>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Tasks</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Keep the active board focused and let the quieter rows carry the work without stealing attention from the flagship routes.
          </p>
        </div>
        <span className="shell-meta-pill">
          {todoTasks.length} active
        </span>
      </div>

      {inboxTasks.length > 0 && (
        <div className="secondary-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="section-kicker">Holding Orbit</div>
              <h2 className="mt-2 text-lg font-semibold text-text-primary">Task inbox</h2>
            </div>
            <span className="secondary-chip">{inboxTasks.length} waiting</span>
          </div>
          <TaskList tasks={inboxTasks} showAddButton={false} />
        </div>
      )}

      <div className="secondary-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="section-kicker">Active Board</div>
            <h2 className="mt-2 text-lg font-semibold text-text-primary">To do</h2>
          </div>
          <span className="secondary-chip">{todoTasks.length} on deck</span>
        </div>
        <TaskList tasks={todoTasks} showAddButton={true} emptyMessage="All clear! Add a task to get started." />
      </div>
    </div>
  );
}
