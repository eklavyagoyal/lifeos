import { describe, expect, it } from 'vitest';
import { withTestContext } from '@/test/test-db';

describe('search indexing', () => {
  it('keeps indexed task content in sync on create, update, and archive', async () => {
    await withTestContext(async () => {
      const { createTask, updateTask, archiveTask } = await import('./tasks');
      const { searchItems } = await import('./search');

      const created = createTask({
        title: 'Call dentist',
        body: 'Schedule annual cleaning before April',
      });

      expect(created?.id).toBeTruthy();
      expect(searchItems('dentist')).toHaveLength(1);

      updateTask({
        id: created!.id,
        title: 'Call doctor',
        body: 'Schedule annual physical before April',
      });

      expect(searchItems('dentist')).toHaveLength(0);
      expect(searchItems('doctor')).toHaveLength(1);

      archiveTask(created!.id);

      expect(searchItems('doctor')).toHaveLength(0);
    });
  });

  it('indexes relation context, tag context, milestone text, events, and generated reviews', async () => {
    await withTestContext(async () => {
      const { createTask, toggleTask } = await import('./tasks');
      const { createNote } = await import('./notes');
      const { attachBufferToItem } = await import('./attachments');
      const { createGoal } = await import('./goals');
      const { createMilestone } = await import('./milestones');
      const { createRelation } = await import('./relations');
      const { getOrCreateTag, addTagToItem } = await import('./tags');
      const { createEvent } = await import('./events');
      const { generateReviewForPeriod } = await import('./reviews');
      const { searchItems } = await import('./search');
      const { startOfWeek } = await import('@/lib/utils');

      const doctorTask = createTask({ title: 'Call doctor' });
      const linkedNote = createNote({
        title: 'Follow-up notes',
        body: 'Labs to review after the appointment.',
      });
      expect(doctorTask?.id).toBeTruthy();
      expect(linkedNote?.id).toBeTruthy();

      createRelation({
        sourceType: 'note',
        sourceId: linkedNote!.id,
        targetType: 'task',
        targetId: doctorTask!.id,
        relationType: 'related_to',
      });

      expect(searchItems('doctor')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemType: 'note',
            itemId: linkedNote!.id,
            detailUrl: `/notes/${linkedNote!.id}`,
          }),
        ])
      );

      const travelTag = getOrCreateTag('travel');
      const packingNote = createNote({
        title: 'Packing checklist',
        body: 'Passport, chargers, and adapters.',
      });
      addTagToItem('note', packingNote!.id, travelTag.id);

      expect(searchItems('travel')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemType: 'note',
            itemId: packingNote!.id,
          }),
        ])
      );

      attachBufferToItem({
        itemType: 'note',
        itemId: packingNote!.id,
        originalName: 'passport-checklist.txt',
        data: Buffer.from('Passport renewal receipt and museum reservation codes'),
      });

      expect(searchItems('reservation codes')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemType: 'note',
            itemId: packingNote!.id,
            detailUrl: `/notes/${packingNote!.id}`,
          }),
        ])
      );

      const goal = createGoal({
        title: 'Build race endurance',
        description: 'Train consistently through spring.',
      });
      createMilestone({
        goalId: goal!.id,
        title: 'Half marathon checkpoint',
        body: 'Break two hours over 21.1 km.',
      });

      expect(searchItems('marathon')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemType: 'goal',
            itemId: goal!.id,
            detailUrl: `/goals/${goal!.id}`,
          }),
        ])
      );

      const event = createEvent({
        title: 'Berlin trip',
        body: 'Museum Island and neighborhood walks.',
        eventDate: '2026-03-20',
        eventType: 'trip',
      });

      expect(searchItems('Berlin')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemType: 'event',
            itemId: event!.id,
            detailUrl: `/events/${event!.id}`,
          }),
        ])
      );

      const completedTask = createTask({ title: 'Roadmap cleanup' });
      toggleTask(completedTask!.id);
      const weeklyReview = generateReviewForPeriod('weekly', startOfWeek(new Date()));

      expect(searchItems('Roadmap')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemType: 'review',
            itemId: weeklyReview.review.id,
            detailUrl: `/reviews/${weeklyReview.review.id}`,
          }),
        ])
      );
    });
  });
});
