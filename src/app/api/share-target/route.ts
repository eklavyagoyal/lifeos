import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { addTagToItem, getOrCreateTag } from '@/server/services/tags';
import { attachBufferToItem } from '@/server/services/attachments';
import { submitCapture } from '@/server/services/capture';
import { createNote } from '@/server/services/notes';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const formData = await request.formData();
  const title = readTrimmedValue(formData, 'title');
  const text = readTrimmedValue(formData, 'text');
  const url = readTrimmedValue(formData, 'url');
  const files = formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length > 0 || title || url) {
    const note = createNote({
      title: title || url || files[0]?.name || 'Shared item',
      body: [text, url].filter(Boolean).join('\n\n') || undefined,
      noteType: 'reference',
    });

    if (!note) {
      return NextResponse.redirect(new URL('/inbox', request.url), 303);
    }

    const sharedTag = getOrCreateTag('shared');
    addTagToItem('note', note.id, sharedTag.id);

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachBufferToItem({
        itemType: 'note',
        itemId: note.id,
        originalName: file.name,
        data: buffer,
        label: title || url || undefined,
        sourceType: 'upload',
        metadata: {
          sharedFrom: 'web-share-target',
          sharedAt: new Date().toISOString(),
          sharedTitle: title,
          sharedUrl: url,
        },
      });
    }

    revalidatePath('/notes');
    revalidatePath(`/notes/${note.id}`);
    revalidatePath('/search');
    revalidatePath('/graph');
    return NextResponse.redirect(new URL(`/notes/${note.id}`, request.url), 303);
  }

  if (text) {
    submitCapture(text, 'inbox');
    revalidatePath('/inbox');
    revalidatePath('/today');
  }

  return NextResponse.redirect(new URL('/inbox?shared=1', request.url), 303);
}

function readTrimmedValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string') return '';
  return value.trim();
}
