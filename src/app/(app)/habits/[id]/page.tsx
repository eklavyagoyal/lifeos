import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getAllHabits, getHabit, getHabitCompletions } from '@/server/services/habits';
import { getAllGoals, getGoal } from '@/server/services/goals';
import { getAllProjects, getProject } from '@/server/services/projects';
import { getTagsForItem } from '@/server/services/tags';
import { todayISO } from '@/lib/utils';
import { HabitDetailClient } from './client';

export const metadata = { title: 'Habit — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HabitDetailPage({ params }: Props) {
  const { id } = await params;
  const habit = getHabit(id);
  if (!habit) notFound();

  const goal = habit.goalId ? getGoal(habit.goalId) : null;
  const project = habit.projectId ? getProject(habit.projectId) : null;
  const goals = getAllGoals();
  const projects = getAllProjects();

  // Get last 30 days of completions
  const today = todayISO();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];
  const completions = getHabitCompletions(id, startDate, today);

  const relatedItems = getResolvedRelationsForItem('habit', id);
  const structuralItems = getStructuralConnectionsForItem('habit', id);
  const suggestedItems = getConnectionSuggestionsForItem('habit', id);
  const tags = getTagsForItem('habit', id);

  return (
    <HabitDetailClient
      habit={habit}
      goal={goal}
      goals={goals.map((item) => ({ id: item.id, title: item.title }))}
      project={project}
      projects={projects.map((item) => ({ id: item.id, title: item.title }))}
      completions={completions}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
    />
  );
}
