import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getGoal, getGoalHabits, getGoalProjects, getGoalTasks } from '@/server/services/goals';
import { getAllHabits } from '@/server/services/habits';
import { getGoalMilestonesWithComputedState } from '@/server/services/milestones';
import { getAllProjects } from '@/server/services/projects';
import { getTagsForItem } from '@/server/services/tags';
import { getAllTasks } from '@/server/services/tasks';
import { calculateGoalRollup } from '@/server/services/progress';
import { GoalDetailClient } from './client';

export const metadata = { title: 'Goal — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GoalDetailPage({ params }: Props) {
  const { id } = await params;
  const goal = getGoal(id);
  if (!goal) notFound();

  const habits = getGoalHabits(id);
  const tasks = getGoalTasks(id).filter((task) => task.source !== 'review');
  const projects = getGoalProjects(id);
  const milestones = getGoalMilestonesWithComputedState(id);
  const candidateTasks = getAllTasks().filter((task) => task.source !== 'review');
  const candidateProjects = getAllProjects();
  const candidateHabits = getAllHabits();
  const rollup = calculateGoalRollup(id);
  const relatedItems = getResolvedRelationsForItem('goal', id);
  const structuralItems = getStructuralConnectionsForItem('goal', id);
  const suggestedItems = getConnectionSuggestionsForItem('goal', id);
  const tags = getTagsForItem('goal', id);

  return (
    <GoalDetailClient
      goal={goal}
      rollup={rollup}
      habits={habits}
      tasks={tasks}
      projects={projects}
      milestones={milestones}
      candidateTasks={candidateTasks.map((task) => ({ id: task.id, title: task.title }))}
      candidateProjects={candidateProjects.map((project) => ({ id: project.id, title: project.title }))}
      candidateHabits={candidateHabits.map((habit) => ({ id: habit.id, title: habit.name }))}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
    />
  );
}
