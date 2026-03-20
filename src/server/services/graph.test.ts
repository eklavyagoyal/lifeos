import { describe, expect, it } from 'vitest';
import { withTestContext } from '@/test/test-db';

describe('graph service', () => {
  it('includes deterministic structural links and tag metadata for nodes', async () => {
    await withTestContext(async () => {
      const { createGoal } = await import('./goals');
      const { createProject } = await import('./projects');
      const { createTask } = await import('./tasks');
      const { createNote } = await import('./notes');
      const { attachBufferToItem } = await import('./attachments');
      const { getOrCreateTag, addTagToItem } = await import('./tags');
      const { getFullGraph } = await import('./graph');

      const goal = createGoal({ title: 'Ship Wave 3' });
      const project = createProject({ title: 'Discoverability pass', goalId: goal!.id });
      const task = createTask({
        title: 'Wire search and backlinks',
        projectId: project!.id,
        goalId: goal!.id,
      });
      const note = createNote({
        title: 'Graph ideas',
        body: 'Focus mode and saved filters.',
      });
      const evidence = createNote({
        title: 'Supporting evidence',
        body: 'Attachment-backed context.',
      });
      const tag = getOrCreateTag('wave3');
      addTagToItem('task', task!.id, tag.id);
      addTagToItem('note', note!.id, tag.id);
      attachBufferToItem({
        itemType: 'note',
        itemId: note!.id,
        originalName: 'wave3.txt',
        data: Buffer.from('attachment-backed graph context'),
      });
      attachBufferToItem({
        itemType: 'note',
        itemId: evidence!.id,
        originalName: 'wave3.txt',
        data: Buffer.from('attachment-backed graph context'),
      });

      const graph = getFullGraph({ includeTagEdges: true });
      const taskNode = graph.nodes.find((node) => node.id === `task:${task!.id}`);
      const noteNode = graph.nodes.find((node) => node.id === `note:${note!.id}`);

      expect(taskNode?.tagIds).toContain(tag.id);
      expect(noteNode?.attachmentCount).toBe(1);
      expect(graph.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceId: `task:${task!.id}`,
            targetId: `goal:${goal!.id}`,
            edgeType: 'structural',
            label: 'supports',
          }),
          expect.objectContaining({
            sourceId: `project:${project!.id}`,
            targetId: `goal:${goal!.id}`,
            edgeType: 'structural',
            label: 'advances',
          }),
          expect.objectContaining({
            edgeType: 'attachment',
            label: 'shared wave3.txt',
          }),
        ])
      );

      expect(
        graph.edges.some((edge) => {
          if (edge.edgeType !== 'tag') return false;
          const endpoints = new Set([edge.sourceId, edge.targetId]);
          return endpoints.has(`task:${task!.id}`) && endpoints.has(`note:${note!.id}`);
        })
      ).toBe(true);
    });
  });
});
