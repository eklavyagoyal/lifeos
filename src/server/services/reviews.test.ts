import { describe, expect, it } from 'vitest';
import { withTestContext } from '@/test/test-db';

describe('weekly reviews', () => {
  it('generates a weekly review from current data and reuses the existing draft', async () => {
    await withTestContext(async () => {
      const { createTask, updateTask } = await import('./tasks');
      const { createHabit, toggleHabitCompletion } = await import('./habits');
      const { createJournalEntry } = await import('./journal');
      const { createMetric } = await import('./metrics');
      const { generateWeeklyReview } = await import('./reviews');
      const { startOfWeek, todayISO } = await import('@/lib/utils');

      const weekStart = startOfWeek(new Date());
      const today = todayISO();

      const task = createTask({
        title: 'Ship Wave 1 runtime diagnostics',
        body: 'Wire health checks into settings and the public health endpoint.',
      });
      updateTask({ id: task!.id, status: 'done' });

      const habit = createHabit({ name: 'Review roadmap', cadence: 'daily' });
      toggleHabitCompletion(habit!.id, today);

      createJournalEntry({
        title: 'Wave 1 notes',
        body: 'Runtime hardening is in place and search indexing is now incremental.',
        entryDate: today,
      });

      createMetric({
        metricType: 'sleep',
        valueNumeric: 7.5,
        unit: 'hours',
        loggedDate: today,
      });

      const first = generateWeeklyReview(weekStart);
      const second = generateWeeklyReview(weekStart);

      expect(first.isNew).toBe(true);
      expect(first.review?.body).toContain('### ✅ Tasks');
      expect(first.review?.body).toContain('### 🔁 Habits');
      expect(first.review?.body).toContain('### 📊 Life Signals');
      expect(second.isNew).toBe(false);
      expect(second.review?.id).toBe(first.review?.id);
    });
  });

  it('generates daily, monthly, and yearly reviews from the same aggregation pipeline', async () => {
    await withTestContext(async () => {
      const { createTask, updateTask } = await import('./tasks');
      const { createMetric } = await import('./metrics');
      const { generateReviewForPeriod } = await import('./reviews');

      const task = createTask({
        title: 'Close the loop on scheduler jobs',
        dueDate: '2026-03-20',
      });
      updateTask({ id: task!.id, status: 'done' });

      createMetric({
        metricType: 'sleep',
        valueNumeric: 7.2,
        unit: 'hours',
        loggedDate: '2026-03-20',
      });

      const daily = generateReviewForPeriod('daily', '2026-03-20');
      const monthly = generateReviewForPeriod('monthly', '2026-03-20');
      const yearly = generateReviewForPeriod('yearly', '2026-03-20');

      expect(daily.review?.reviewType).toBe('daily');
      expect(daily.review?.body).toContain('## Day of');
      expect(monthly.review?.reviewType).toBe('monthly');
      expect(monthly.review?.periodStart).toBe('2026-03-01');
      expect(yearly.review?.reviewType).toBe('yearly');
      expect(yearly.review?.periodStart).toBe('2026-01-01');
    });
  });

  it('preserves authored user sections when a review is regenerated', async () => {
    await withTestContext(async () => {
      const { createTask, updateTask } = await import('./tasks');
      const { generateReviewForPeriod, regenerateReview, updateReviewBody } = await import('./reviews');
      const { todayISO } = await import('@/lib/utils');

      const reviewDate = todayISO();

      const firstTask = createTask({
        title: 'Close the loop on health checks',
        dueDate: reviewDate,
      });
      updateTask({ id: firstTask!.id, status: 'done' });

      const generated = generateReviewForPeriod('daily', reviewDate).review!;
      const personalizedBody = generated.body!
        .replace('_Add your own reflections here..._', 'Protect the first hour of the day for deep work.')
        .replace(
          '_What stood out, surprised you, or changed your mind?_',
          'Finishing one sharp task created more momentum than juggling five.'
        )
        .replace(
          '_Capture the follow-through you want to carry forward._',
          '- Keep the morning clear\n- Review blockers earlier'
        );

      updateReviewBody(generated.id, personalizedBody);

      const secondTask = createTask({
        title: 'Write the follow-up notes',
        dueDate: reviewDate,
      });
      updateTask({ id: secondTask!.id, status: 'done' });

      const regenerated = regenerateReview(generated.id);

      expect(regenerated?.body).toContain('Protect the first hour of the day for deep work.');
      expect(regenerated?.body).toContain('Finishing one sharp task created more momentum than juggling five.');
      expect(regenerated?.body).toContain('- Keep the morning clear');
      expect(regenerated?.body).toContain('**2** completed');
    });
  });

  it('extracts tasks and goals from review insights and links them back to the source review', async () => {
    await withTestContext(async () => {
      const {
        generateReviewForPeriod,
        extractTaskFromReviewInsight,
        extractGoalFromReviewInsight,
      } = await import('./reviews');
      const { getRelationsForItem } = await import('./relations');

      const review = generateReviewForPeriod('weekly', '2026-03-16').review!;
      const task = extractTaskFromReviewInsight(review.id, '- Follow up with the dentist');
      const goal = extractGoalFromReviewInsight(review.id, 'Improve sleep consistency');

      expect(task?.title).toBe('Follow up with the dentist');
      expect(task?.source).toBe('review');
      expect(task?.body).toContain('Derived from Weekly Review.');

      expect(goal?.title).toBe('Improve sleep consistency');
      expect(goal?.description).toContain('Derived from Weekly Review.');

      const taskRelations = getRelationsForItem('task', task!.id);
      const goalRelations = getRelationsForItem('goal', goal!.id);

      expect(
        taskRelations.some(
          (relation) =>
            relation.targetType === 'review' &&
            relation.targetId === review.id &&
            relation.relationType === 'derived_from'
        )
      ).toBe(true);

      expect(
        goalRelations.some(
          (relation) =>
            relation.targetType === 'review' &&
            relation.targetId === review.id &&
            relation.relationType === 'derived_from'
        )
      ).toBe(true);
    });
  });
});
