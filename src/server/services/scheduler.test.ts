import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTestContext } from '@/test/test-db';

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduler', () => {
  it('materializes the next recurring task exactly once when a completed task becomes due again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T10:00:00Z'));

    await withTestContext(async () => {
      const { createTask, getAllTasks, updateTask } = await import('./tasks');
      const { runSchedulerPass } = await import('./scheduler');

      const recurringTask = createTask({
        title: 'Take vitamins',
        dueDate: '2026-03-19',
        recurrenceRule: 'daily',
        priority: 'p2',
      });

      updateTask({ id: recurringTask!.id, status: 'done' });

      await runSchedulerPass({ source: 'test', maxJobs: 25 });

      const firstPassTasks = getAllTasks().filter((task) => task.parentTaskId === recurringTask!.id);
      expect(firstPassTasks).toHaveLength(1);
      expect(firstPassTasks[0].source).toBe('recurrence');
      expect(firstPassTasks[0].status).toBe('todo');
      expect(firstPassTasks[0].dueDate).toBe('2026-03-20');

      await runSchedulerPass({ source: 'test', maxJobs: 25 });

      const secondPassTasks = getAllTasks().filter((task) => task.parentTaskId === recurringTask!.id);
      expect(secondPassTasks).toHaveLength(1);
    });
  });

  it('creates project review reminders and scheduled reviews without duplicating open prompts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T10:00:00Z'));

    await withTestContext(async () => {
      const { createProject } = await import('./projects');
      const { getAllTasks } = await import('./tasks');
      const { getReviewsByType } = await import('./reviews');
      const { getProjectReviewTitlePrefix, runSchedulerPass } = await import('./scheduler');

      const project = createProject({
        title: 'Ship Wave 2 scheduler',
        status: 'active',
        reviewCadence: 'weekly',
      });

      await runSchedulerPass({ source: 'test', maxJobs: 25 });

      const reviewReminderTitlePrefix = getProjectReviewTitlePrefix();
      const reviewTasks = getAllTasks().filter((task) =>
        task.projectId === project!.id && task.title.startsWith(reviewReminderTitlePrefix)
      );

      expect(reviewTasks).toHaveLength(1);
      expect(reviewTasks[0].source).toBe('review');
      expect(getReviewsByType('daily')).toHaveLength(1);
      expect(getReviewsByType('weekly')).toHaveLength(1);
      expect(getReviewsByType('monthly')).toHaveLength(1);
      expect(getReviewsByType('yearly')).toHaveLength(1);

      await runSchedulerPass({ source: 'test', maxJobs: 25 });

      const secondPassReviewTasks = getAllTasks().filter((task) =>
        task.projectId === project!.id && task.title.startsWith(reviewReminderTitlePrefix)
      );
      expect(secondPassReviewTasks).toHaveLength(1);
    });
  });
});
