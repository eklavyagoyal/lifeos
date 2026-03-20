import { describe, expect, it } from 'vitest';
import { withTestContext } from '@/test/test-db';

describe('capture parsing and materialization', () => {
  it('parses a task capture with priority, due date, and tags', async () => {
    await withTestContext(async () => {
      const { buildCapturePreview } = await import('./capture');

      const preview = buildCapturePreview('task: call dentist tomorrow #health p1');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(preview.suggestedType).toBe('task');
      expect(preview.title).toBe('call dentist');
      expect(preview.priority).toBe('p1');
      expect(preview.tags).toEqual(['health']);
      expect(preview.dueDate).toBe(tomorrow.toISOString().split('T')[0]);
      expect(preview.directCreateSupported).toBe(true);
    });
  });

  it('materializes a task capture with project and tags', async () => {
    await withTestContext(async () => {
      const { createProject } = await import('./projects');
      const { buildCapturePreview, materializeCapturePreview } = await import('./capture');
      const { getTask } = await import('./tasks');
      const { getTagsForItem } = await import('./tags');

      const project = createProject({ title: 'Health Admin' });
      const preview = buildCapturePreview('task: call dentist tomorrow #health p1 +health-admin');
      const materialized = materializeCapturePreview(preview);
      const task = getTask(materialized.createdId);
      const tags = getTagsForItem('task', materialized.createdId);

      expect(task?.title).toBe('call dentist');
      expect(task?.priority).toBe('p1');
      expect(task?.projectId).toBe(project?.id);
      expect(tags.map((tag) => tag.name)).toEqual(['health']);
      expect(materialized.redirectPath).toBe(`/tasks/${materialized.createdId}`);
    });
  });

  it('parses and materializes metric captures', async () => {
    await withTestContext(async () => {
      const { buildCapturePreview, materializeCapturePreview } = await import('./capture');
      const { getMetric } = await import('./metrics');

      const preview = buildCapturePreview('sleep 7.5 restful night');
      const materialized = materializeCapturePreview(preview);
      const metric = getMetric(materialized.createdId);

      expect(preview.suggestedType).toBe('metric');
      expect(preview.metricType).toBe('sleep');
      expect(preview.metricValue).toBe(7.5);
      expect(metric?.metricType).toBe('sleep');
      expect(metric?.valueNumeric).toBe(7.5);
      expect(metric?.note).toBe('restful night');
    });
  });

  it('preserves deferred offline date parsing while resolving project links later', async () => {
    await withTestContext(async () => {
      const { buildCapturePreview: buildOfflinePreview } = await import('@/lib/capture-preview');
      const { createProject } = await import('./projects');
      const { resolveCapturePreview } = await import('./capture');

      const project = createProject({ title: 'Health Admin' });
      const preserved = buildOfflinePreview('task: call dentist tomorrow +health-admin', {
        baseDate: new Date('2026-03-20T09:00:00Z'),
        projectResolution: 'defer',
      });

      const resolved = resolveCapturePreview('task: call dentist tomorrow +health-admin', preserved);

      expect(preserved.dueDate).toBe('2026-03-21');
      expect(preserved.projectId).toBeUndefined();
      expect(preserved.projectLabel).toBe('health-admin');
      expect(resolved.dueDate).toBe('2026-03-21');
      expect(resolved.projectId).toBe(project?.id);
      expect(resolved.projectLabel).toBe('Health Admin');
    });
  });
});
