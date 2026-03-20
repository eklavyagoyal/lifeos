import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { withTestContext } from '@/test/test-db';

describe('imports', () => {
  it('imports an Obsidian vault with wiki links, attachments, and dedupe on rerun', async () => {
    await withTestContext(async (context) => {
      const vaultPath = path.join(context.tempDir, 'vault');
      fs.mkdirSync(vaultPath, { recursive: true });

      fs.writeFileSync(
        path.join(vaultPath, 'Health.md'),
        [
          '---',
          'tags:',
          '  - fitness',
          '---',
          '# Health',
          '',
          'Track training and recovery.',
        ].join('\n')
      );

      fs.writeFileSync(
        path.join(vaultPath, 'Plans.md'),
        [
          '# Plans',
          '',
          'See [[Health]] before the next block.',
          '',
          '![[photo.png]]',
        ].join('\n')
      );

      fs.writeFileSync(path.join(vaultPath, 'photo.png'), Buffer.from('png-data'));

      const { getAttachment, getAttachmentsForItem, getAttachmentUsageCount } = await import('./attachments');
      const { getResolvedRelationsForItem } = await import('./connections');
      const { previewImport, rollbackImportRun, runImport, getRecentImportRuns } = await import('./imports');
      const { getAllNotes } = await import('./notes');

      const preview = previewImport({
        importType: 'obsidian_vault',
        sourcePath: vaultPath,
      });

      expect(preview.stats.notes).toBe(2);
      expect(preview.stats.attachments).toBe(1);
      expect(preview.stats.duplicates).toBe(0);
      expect(preview.mappingGroups.some((group) => group.id === 'obsidian-links')).toBe(true);
      expect(preview.diff.relationLinks).toBe(1);
      expect(preview.items.find((item) => item.title === 'Plans')?.attachmentNames).toEqual(['photo.png']);

      const result = runImport({
        importType: 'obsidian_vault',
        sourcePath: vaultPath,
      });

      expect(result.createdItems).toHaveLength(2);

      const notes = getAllNotes(10);
      const plans = notes.find((note) => note.title === 'Plans');
      const health = notes.find((note) => note.title === 'Health');

      expect(plans).toBeTruthy();
      expect(health).toBeTruthy();
      expect(getAttachmentsForItem('note', plans!.id)).toHaveLength(1);
      expect(getResolvedRelationsForItem('note', plans!.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: health!.id,
            type: 'note',
            relationLabel: 'mentions',
          }),
        ])
      );

      const rerun = runImport({
        importType: 'obsidian_vault',
        sourcePath: vaultPath,
      });

      expect(rerun.createdItems).toHaveLength(0);
      expect(rerun.stats.duplicates).toBe(2);

      const run = getRecentImportRuns().find((entry) => entry.id === result.runId);
      expect(run?.details?.rollback?.status).toBe('available');

      const attachmentId = getAttachmentsForItem('note', plans!.id)[0]?.attachmentId;
      const rollback = rollbackImportRun(result.runId);

      expect(rollback.status).toBe('rolled_back');
      expect(rollback.archivedItemCount).toBe(2);
      expect(rollback.removedRelationCount).toBe(1);
      expect(rollback.removedAttachmentLinkCount).toBe(1);
      expect(getAllNotes(10)).toHaveLength(0);
      expect(getAttachmentUsageCount(attachmentId!)).toBe(0);
      expect(getAttachment(attachmentId!)?.archivedAt).toBeTruthy();

      const rerunAfterRollback = runImport({
        importType: 'obsidian_vault',
        sourcePath: vaultPath,
      });

      expect(rerunAfterRollback.createdItems).toHaveLength(2);
    });
  });

  it('imports Todoist CSV tasks with sections, tags, priorities, and parent-child nesting', async () => {
    await withTestContext(async (context) => {
      const csvPath = path.join(context.tempDir, 'Trip Planning.csv');
      fs.writeFileSync(
        csvPath,
        [
          'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,LABELS,DATE,Checked',
          'section,Personal,,,,,,',
          'task,Book flights,Use points if possible,4,1,travel;booking,2026-04-01,',
          'task,Reserve hotel,,3,2,travel,,1',
        ].join('\n')
      );

      const { previewImport, rollbackImportRun, runImport } = await import('./imports');
      const { getAllTasks } = await import('./tasks');
      const { getAllProjects } = await import('./projects');
      const { getTagsForItem } = await import('./tags');

      const preview = previewImport({
        importType: 'todoist_csv',
        sourcePath: csvPath,
      });

      expect(preview.diff.autoCreateProjectTitles).toEqual(['Trip Planning']);
      expect(preview.mappingGroups.some((group) => group.id === 'todoist-priority')).toBe(true);
      expect(preview.items.find((item) => item.title === 'Book flights')?.mappedFields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Priority', value: 'P1' }),
          expect.objectContaining({ label: 'Project', value: 'Trip Planning' }),
        ])
      );

      const result = runImport({
        importType: 'todoist_csv',
        sourcePath: csvPath,
      });

      expect(result.stats.tasks).toBe(2);
      expect(result.createdItems).toHaveLength(2);

      const tasks = getAllTasks();
      const flights = tasks.find((task) => task.title === 'Book flights');
      const hotel = tasks.find((task) => task.title === 'Reserve hotel');
      const importedProject = getAllProjects().find((project) => project.title === 'Trip Planning');

      expect(importedProject).toBeTruthy();
      expect(flights?.priority).toBe('p1');
      expect(flights?.dueDate).toBe('2026-04-01');
      expect(flights?.context).toBe('Personal');
      expect(hotel?.parentTaskId).toBe(flights?.id);
      expect(hotel?.status).toBe('done');
      expect(getTagsForItem('task', flights!.id).map((tag) => tag.name)).toContain('travel');

      const rollback = rollbackImportRun(result.runId);
      expect(rollback.archivedProjectCount).toBe(1);
      expect(getAllTasks()).toHaveLength(0);
      expect(getAllProjects().some((project) => project.title === 'Trip Planning')).toBe(false);

      const rerunAfterRollback = runImport({
        importType: 'todoist_csv',
        sourcePath: csvPath,
      });
      expect(rerunAfterRollback.createdItems).toHaveLength(2);
    });
  });

  it('imports a Day One JSON export with tags and media attachments', async () => {
    await withTestContext(async (context) => {
      const exportDir = path.join(context.tempDir, 'day-one');
      const mediaDir = path.join(exportDir, 'media');
      fs.mkdirSync(mediaDir, { recursive: true });
      fs.writeFileSync(path.join(mediaDir, 'sunrise.jpg'), Buffer.from('jpg-data'));
      fs.writeFileSync(
        path.join(exportDir, 'entries.json'),
        JSON.stringify({
          entries: [
            {
              uuid: 'entry-1',
              creationDate: '2025-12-24T06:30:00Z',
              modifiedDate: '2025-12-24T07:00:00Z',
              text: 'Sunrise walk along the river',
              tags: ['travel', 'reflection'],
              photos: [{ path: 'media/sunrise.jpg' }],
            },
          ],
        })
      );

      const { runImport } = await import('./imports');
      const { getAllJournalEntries } = await import('./journal');
      const { getAttachmentsForItem } = await import('./attachments');
      const { getTagsForItem } = await import('./tags');

      const result = runImport({
        importType: 'day_one_json',
        sourcePath: exportDir,
      });

      expect(result.stats.journalEntries).toBe(1);
      expect(result.stats.attachments).toBe(1);

      const entries = getAllJournalEntries(10);
      const entry = entries.find((item) => item.title === 'Sunrise walk along the river');
      expect(entry).toBeTruthy();
      expect(entry?.entryDate).toBe('2025-12-24');
      expect(getAttachmentsForItem('journal', entry!.id)).toHaveLength(1);
      expect(getTagsForItem('journal', entry!.id).map((tag) => tag.name).sort()).toEqual(['reflection', 'travel']);
    });
  });

  it('imports a Notion export folder with markdown pages and task-like CSV rows', async () => {
    await withTestContext(async (context) => {
      const notionDir = path.join(context.tempDir, 'notion');
      fs.mkdirSync(notionDir, { recursive: true });

      fs.writeFileSync(
        path.join(notionDir, 'Writing.md'),
        [
          '---',
          'tags: [writing, reference]',
          'created: 2025-02-10',
          '---',
          '# Writing',
          '',
          'Working notes for the essay draft.',
        ].join('\n')
      );

      fs.writeFileSync(
        path.join(notionDir, 'Tasks.csv'),
        [
          'Name,Status,Due,Tags,Priority,Notes',
          'Review draft,In Progress,2026-05-01,writing,high,Polish section 2',
        ].join('\n')
      );

      const { previewImport, runImport, getRecentImportRuns } = await import('./imports');
      const { getAllNotes } = await import('./notes');
      const { getAllTasks } = await import('./tasks');

      const preview = previewImport({
        importType: 'notion_export',
        sourcePath: notionDir,
      });

      expect(preview.stats.notes).toBe(1);
      expect(preview.stats.tasks).toBe(1);

      runImport({
        importType: 'notion_export',
        sourcePath: notionDir,
      });

      expect(getAllNotes(10).some((note) => note.title === 'Writing')).toBe(true);
      expect(
        getAllTasks().some((task) => task.title === 'Review draft' && task.status === 'in_progress' && task.dueDate === '2026-05-01')
      ).toBe(true);
      expect(getRecentImportRuns().some((run) => run.importType === 'notion_export' && run.status === 'completed')).toBe(true);
    });
  });
});
