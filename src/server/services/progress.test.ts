import { describe, expect, it } from 'vitest';
import { withTestContext } from '@/test/test-db';

describe('goal progress rollups', () => {
  it('averages milestone-backed work and direct contributors without double counting linked projects', async () => {
    await withTestContext(async () => {
      const { createGoal } = await import('./goals');
      const { createProject } = await import('./projects');
      const { createTask, updateTask } = await import('./tasks');
      const { createMilestone, getGoalMilestonesWithComputedState } = await import('./milestones');
      const { calculateGoalRollup } = await import('./progress');

      const goal = createGoal({
        title: 'Make review automation reliable',
      });

      const project = createProject({
        title: 'Scheduler stabilization',
        goalId: goal!.id,
        status: 'active',
      });

      const projectTaskOne = createTask({
        title: 'Ship recurring task materialization',
        projectId: project!.id,
      });
      const projectTaskTwo = createTask({
        title: 'Write migration notes',
        projectId: project!.id,
      });

      updateTask({ id: projectTaskOne!.id, status: 'done' });
      updateTask({ id: projectTaskTwo!.id, status: 'todo' });

      const directGoalTask = createTask({
        title: 'Interview one power user',
        goalId: goal!.id,
      });
      updateTask({ id: directGoalTask!.id, status: 'done' });

      createMilestone({
        goalId: goal!.id,
        title: 'Stabilize scheduler project',
        projectId: project!.id,
        status: 'active',
      });

      const summary = calculateGoalRollup(goal!.id);
      const milestones = getGoalMilestonesWithComputedState(goal!.id);

      expect(summary.usesDerivedProgress).toBe(true);
      expect(summary.milestoneCount).toBe(1);
      expect(summary.linkedProjectCount).toBe(0);
      expect(summary.linkedTaskCount).toBe(1);
      expect(summary.contributorCount).toBe(2);
      expect(summary.progress).toBe(75);

      expect(milestones).toHaveLength(1);
      expect(milestones[0].computed.source).toBe('project');
      expect(milestones[0].computed.progress).toBe(50);
      expect(milestones[0].computed.linkedItem?.title).toBe('Scheduler stabilization');
    });
  });
});
