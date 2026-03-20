import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getTask } from '@/server/services/tasks';
import { getAllGoals, getGoal } from '@/server/services/goals';
import { getProject } from '@/server/services/projects';
import { getTagsForItem } from '@/server/services/tags';
import { TaskDetailClient } from './client';

export const metadata = { title: 'Task — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) notFound();

  const project = task.projectId ? getProject(task.projectId) : null;
  const goal = task.goalId ? getGoal(task.goalId) : null;
  const goals = getAllGoals();
  const relatedItems = getResolvedRelationsForItem('task', id);
  const structuralItems = getStructuralConnectionsForItem('task', id);
  const suggestedItems = getConnectionSuggestionsForItem('task', id);
  const tags = getTagsForItem('task', id);

  return (
    <TaskDetailClient
      task={task}
      project={project}
      goal={goal}
      goals={goals.map((item) => ({ id: item.id, title: item.title }))}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
    />
  );
}
