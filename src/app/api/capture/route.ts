import { NextResponse } from 'next/server';
import { z } from 'zod';
import { capturePreviewSchema } from '@/lib/capture-preview';
import { revalidateCapturePaths } from '@/server/services/capture-paths';
import { submitCapture } from '@/server/services/capture';

export const dynamic = 'force-dynamic';

const captureRequestSchema = z.object({
  rawText: z.string().min(1),
  mode: z.enum(['smart', 'inbox']).default('smart'),
  preview: capturePreviewSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const payload = captureRequestSchema.parse(await request.json());
    const result = submitCapture(payload.rawText, payload.mode, payload.preview);
    revalidateCapturePaths();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Capture request failed.';
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
