import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { templates } from '../db/schema';
import { newId, now } from '@/lib/utils';

export interface EnsureTemplateInput {
  name: string;
  templateType: 'journal' | 'note' | 'review' | 'project' | 'task';
  content: string;
  defaultFields?: Record<string, unknown>;
}

export function getTemplateByName(templateType: EnsureTemplateInput['templateType'], name: string) {
  return db.select().from(templates)
    .where(and(eq(templates.templateType, templateType), eq(templates.name, name)))
    .get();
}

export function ensureTemplate(input: EnsureTemplateInput) {
  const existing = getTemplateByName(input.templateType, input.name);
  if (existing) {
    return existing;
  }

  const id = newId();
  const timestamp = now();

  db.insert(templates).values({
    id,
    name: input.name,
    templateType: input.templateType,
    content: input.content,
    defaultFields: input.defaultFields ? JSON.stringify(input.defaultFields) : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  return getTemplateByName(input.templateType, input.name);
}
