import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { withTestContext } from '@/test/test-db';

describe('attachments', () => {
  it('deduplicates stored files, indexes searchable text, and tracks shared links', async () => {
    await withTestContext(async () => {
      const { createNote } = await import('./notes');
      const {
        attachBufferToItem,
        getAttachment,
        getAttachmentAbsolutePath,
        getAttachmentsForItem,
        removeAttachmentLink,
      } = await import('./attachments');
      const { searchItems } = await import('./search');

      const noteA = createNote({ title: 'Attachment target A' });
      const noteB = createNote({ title: 'Attachment target B' });
      const fileBuffer = Buffer.from('passport checklist and travel receipts');

      const first = attachBufferToItem({
        itemType: 'note',
        itemId: noteA!.id,
        originalName: 'supporting.txt',
        data: fileBuffer,
        label: 'Reference text',
      });
      const second = attachBufferToItem({
        itemType: 'note',
        itemId: noteB!.id,
        originalName: 'supporting.txt',
        data: fileBuffer,
      });

      expect(first.attachment.id).toBe(second.attachment.id);

      const stored = getAttachment(first.attachment.id);
      expect(stored).toBeTruthy();
      expect(fs.existsSync(getAttachmentAbsolutePath(stored!))).toBe(true);
      expect(stored?.searchStatus).toBe('indexed');
      expect(stored?.searchSummary).toContain('passport checklist');

      const noteAAttachments = getAttachmentsForItem('note', noteA!.id);
      const noteBAttachments = getAttachmentsForItem('note', noteB!.id);

      expect(noteAAttachments).toHaveLength(1);
      expect(noteBAttachments).toHaveLength(1);
      expect(noteAAttachments[0]?.searchStatus).toBe('indexed');
      expect(noteAAttachments[0]?.sharedItemCount).toBe(1);
      expect(noteAAttachments[0]?.searchSummary).toContain('travel receipts');
      expect(searchItems('receipts')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemType: 'note', itemId: noteA!.id }),
          expect.objectContaining({ itemType: 'note', itemId: noteB!.id }),
        ])
      );

      removeAttachmentLink(first.link.id);

      expect(getAttachmentsForItem('note', noteA!.id)).toHaveLength(0);
      expect(getAttachmentsForItem('note', noteB!.id)[0]?.sharedItemCount).toBe(0);
    });
  });
});
