import { z } from 'zod';
import { buildCapturePreview } from './capture-preview';
import { capturePreviewSchema } from './capture-preview';
import type { CaptureParseResult } from './types';

const STORAGE_KEY = 'lifeos.capture.queue.v1';
const QUEUE_EVENT = 'lifeos:capture-queue-changed';

export interface QueuedCaptureItem {
  id: string;
  rawText: string;
  mode: 'smart' | 'inbox';
  preview: CaptureParseResult;
  createdAt: number;
}

const queuedCaptureSchema = z.object({
  id: z.string(),
  rawText: z.string(),
  mode: z.enum(['smart', 'inbox']),
  preview: capturePreviewSchema,
  createdAt: z.number(),
});

const queuedCaptureListSchema = z.array(queuedCaptureSchema);

export function getQueuedCaptures(): QueuedCaptureItem[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return queuedCaptureListSchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function getQueuedCaptureCount() {
  return getQueuedCaptures().length;
}

export function enqueueOfflineCapture(rawText: string, mode: 'smart' | 'inbox' = 'smart') {
  const queue = getQueuedCaptures();
  const item: QueuedCaptureItem = {
    id: createClientId(),
    rawText,
    mode,
    preview: buildCapturePreview(rawText, { projectResolution: 'defer' }),
    createdAt: Date.now(),
  };

  writeQueue([...queue, item]);
  return item;
}

export async function flushQueuedCaptures() {
  const queue = getQueuedCaptures();
  if (!canUseStorage() || queue.length === 0 || !window.navigator.onLine) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const remaining: QueuedCaptureItem[] = [];
  let processed = 0;
  let succeeded = 0;

  for (const item of queue) {
    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawText: item.rawText,
          mode: item.mode,
          preview: item.preview,
        }),
      });

      if (!response.ok) {
        throw new Error(`Capture sync failed with status ${response.status}`);
      }

      processed += 1;
      succeeded += 1;
    } catch {
      remaining.push(item);
      processed += 1;
    }
  }

  writeQueue(remaining);
  return {
    processed,
    succeeded,
    failed: remaining.length,
  };
}

export function subscribeToQueuedCaptures(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  };
  const handleCustomEvent = () => listener();

  window.addEventListener('storage', handleStorage);
  window.addEventListener(QUEUE_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(QUEUE_EVENT, handleCustomEvent);
  };
}

function writeQueue(queue: QueuedCaptureItem[]) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT));
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `capture-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
