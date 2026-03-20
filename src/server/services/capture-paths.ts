import { revalidatePath } from 'next/cache';

export const CAPTURE_REVALIDATE_PATHS = [
  '/today',
  '/inbox',
  '/tasks',
  '/notes',
  '/ideas',
  '/journal',
  '/people',
  '/learning',
  '/metrics',
  '/health',
  '/finance',
] as const;

export function revalidateCapturePaths() {
  for (const path of CAPTURE_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}
