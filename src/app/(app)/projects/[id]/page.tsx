import { notFound } from 'next/navigation';
import {
  getConnectionSuggestionsForItem,
  getResolvedRelationsForItem,
  getStructuralConnectionsForItem,
} from '@/server/services/connections';
import { getAttachmentsForItem } from '@/server/services/attachments';
import { getProject, getProjectTasks } from '@/server/services/projects';
import { getAllGoals, getGoal } from '@/server/services/goals';
import { getTagsForItem } from '@/server/services/tags';
import { ProjectDetailClient } from './client';

export const metadata = { title: 'Project — lifeOS' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  const tasks = getProjectTasks(id);
  const goal = project.goalId ? getGoal(project.goalId) : null;
  const goals = getAllGoals();
  const relatedItems = getResolvedRelationsForItem('project', id);
  const structuralItems = getStructuralConnectionsForItem('project', id);
  const suggestedItems = getConnectionSuggestionsForItem('project', id);
  const tags = getTagsForItem('project', id);
  const attachments = getAttachmentsForItem('project', id);

  return (
    <ProjectDetailClient
      project={project}
      goal={goal}
      goals={goals.map((item) => ({ id: item.id, title: item.title }))}
      tasks={tasks}
      relatedItems={relatedItems}
      structuralItems={structuralItems}
      suggestedItems={suggestedItems}
      tags={tags}
      attachments={attachments}
    />
  );
}
