import { describe, expect, it } from 'vitest';
import { withTestContext } from '@/test/test-db';

describe('connection resolution', () => {
  it('resolves backlinks and structural links with real destinations', async () => {
    await withTestContext(async () => {
      const { createGoal } = await import('./goals');
      const { createProject } = await import('./projects');
      const { createTask } = await import('./tasks');
      const { createNote } = await import('./notes');
      const { createRelation } = await import('./relations');
      const {
        getResolvedRelationsForItem,
        getStructuralConnectionsForItem,
      } = await import('./connections');

      const goal = createGoal({ title: 'Run a marathon' });
      const project = createProject({ title: 'Spring training block', goalId: goal!.id });
      const task = createTask({
        title: 'Register for Berlin Half Marathon',
        goalId: goal!.id,
        projectId: project!.id,
      });
      const note = createNote({
        title: 'Race logistics',
        body: 'Need to book trains and a hotel.',
      });

      createRelation({
        sourceType: 'note',
        sourceId: note!.id,
        targetType: 'task',
        targetId: task!.id,
        relationType: 'mentions',
      });

      expect(getResolvedRelationsForItem('task', task!.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: note!.id,
            type: 'note',
            direction: 'incoming',
            relationLabel: 'mentions',
            detailUrl: `/notes/${note!.id}`,
          }),
        ])
      );

      expect(getStructuralConnectionsForItem('goal', goal!.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: project!.id,
            type: 'project',
            direction: 'structural',
            relationLabel: 'advances',
            detailUrl: `/projects/${project!.id}`,
          }),
          expect.objectContaining({
            id: task!.id,
            type: 'task',
            direction: 'structural',
            relationLabel: 'supports',
            detailUrl: `/tasks/${task!.id}`,
          }),
        ])
      );
    });
  });

  it('merges shared-tag and mention suggestions and drops them after a direct relation is created', async () => {
    await withTestContext(async () => {
      const { createTask } = await import('./tasks');
      const { createNote } = await import('./notes');
      const { createRelation } = await import('./relations');
      const { getOrCreateTag, addTagToItem } = await import('./tags');
      const { getConnectionSuggestionsForItem } = await import('./connections');

      const task = createTask({ title: 'Plan Berlin itinerary' });
      const note = createNote({
        title: 'Trip research',
        body: 'Plan Berlin itinerary with museum stops and train timing.',
      });
      const tag = getOrCreateTag('travel');
      addTagToItem('task', task!.id, tag.id);
      addTagToItem('note', note!.id, tag.id);

      expect(getConnectionSuggestionsForItem('task', task!.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: note!.id,
            type: 'note',
            reason: 'shared_tags_and_mentions',
            sharedTags: ['travel'],
            detailUrl: `/notes/${note!.id}`,
          }),
        ])
      );

      createRelation({
        sourceType: 'task',
        sourceId: task!.id,
        targetType: 'note',
        targetId: note!.id,
        relationType: 'related_to',
      });

      expect(
        getConnectionSuggestionsForItem('task', task!.id).some(
          (suggestion) => suggestion.type === 'note' && suggestion.id === note!.id
        )
      ).toBe(false);
    });
  });

  it('treats shared attachments as inferred connections', async () => {
    await withTestContext(async () => {
      const { createNote } = await import('./notes');
      const { attachBufferToItem } = await import('./attachments');
      const { getStructuralConnectionsForItem } = await import('./connections');

      const noteA = createNote({ title: 'Travel logistics' });
      const noteB = createNote({ title: 'Expense backup' });

      attachBufferToItem({
        itemType: 'note',
        itemId: noteA!.id,
        originalName: 'receipt.txt',
        data: Buffer.from('Taxi receipt and station transfer details'),
      });
      attachBufferToItem({
        itemType: 'note',
        itemId: noteB!.id,
        originalName: 'receipt.txt',
        data: Buffer.from('Taxi receipt and station transfer details'),
      });

      expect(getStructuralConnectionsForItem('note', noteA!.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: noteB!.id,
            type: 'note',
            direction: 'structural',
            relationLabel: 'shared receipt.txt',
            detailUrl: `/notes/${noteB!.id}`,
          }),
        ])
      );
    });
  });
});
