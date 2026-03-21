import { getAllHabits, getTodayCompletions } from '@/server/services/habits';
import { HabitChecklist } from '@/components/habits/habit-checklist';
import { CreateHabitForm } from '@/components/habits/create-habit-form';
import { Repeat } from 'lucide-react';

export const metadata = { title: 'Habits — lifeOS' };
export const dynamic = 'force-dynamic';

export default function HabitsPage() {
  const habits = getAllHabits();
  const completions = getTodayCompletions();
  const activeHabits = habits.filter(h => !h.isPaused);
  const pausedHabits = habits.filter(h => h.isPaused);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker">Rhythm Loop</div>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Habits</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            This screen should feel rhythmic and supportive, not like a spreadsheet of recurring chores.
          </p>
        </div>
        <span className="shell-meta-pill">
          {activeHabits.length} active
        </span>
      </div>

      {habits.length === 0 ? (
        <div className="secondary-empty-state py-12">
          <Repeat size={32} className="mb-2 text-text-muted" />
          <p className="text-sm text-text-secondary">No habits yet</p>
          <p className="text-2xs text-text-muted mt-1">
            Create your first habit below to start building consistency.
          </p>
        </div>
      ) : (
        <div className="secondary-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="section-kicker">Today</div>
              <h2 className="mt-2 text-lg font-semibold text-text-primary">Active rhythms</h2>
            </div>
            <span className="secondary-chip">{completions.length} completed</span>
          </div>
          <HabitChecklist habits={activeHabits} completions={completions} />
        </div>
      )}

      <CreateHabitForm />

      {pausedHabits.length > 0 && (
        <div className="secondary-card opacity-70">
          <h2 className="mb-3 text-sm font-semibold text-text-tertiary">Paused</h2>
          <div className="space-y-2">
            {pausedHabits.map(h => (
              <div key={h.id} className="secondary-row px-3 py-3 text-sm text-text-muted">
                {h.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
