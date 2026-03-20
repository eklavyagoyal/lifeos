/**
 * lifeOS — Export Service
 *
 * Generates portable exports of all user data.
 * Formats: structured JSON, raw SQLite DB copy.
 */

import { db, sqlite } from '@/server/db';
import {
  tasks, habits, habitCompletions, journalEntries,
  notes, ideas, projects, goals, metricLogs,
  reviews, inboxItems, relations, tags, itemTags,
  gamificationProfile, xpEvents, achievements,
  entities, events, templates, appSettings, scheduledJobs, jobRuns, milestones,
  attachments, attachmentLinks, importRuns, importedRecords,
} from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { APP_VERSION } from '@/lib/app-info';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ============================================================
// Full JSON Export
// ============================================================

export interface LifeOSExport {
  meta: {
    app: string;
    version: string;
    exportedAt: string;
    format: 'lifeos-json-v1';
    tables: Record<string, number>;
  };
  data: {
    tasks: unknown[];
    habits: unknown[];
    habitCompletions: unknown[];
    journalEntries: unknown[];
    notes: unknown[];
    ideas: unknown[];
    projects: unknown[];
    goals: unknown[];
    milestones: unknown[];
    metricLogs: unknown[];
    reviews: unknown[];
    inboxItems: unknown[];
    entities: unknown[];
    events: unknown[];
    templates: unknown[];
    attachments: unknown[];
    attachmentLinks: unknown[];
    relations: unknown[];
    tags: unknown[];
    itemTags: unknown[];
    gamificationProfile: unknown[];
    xpEvents: unknown[];
    achievements: unknown[];
    appSettings: unknown[];
    scheduledJobs: unknown[];
    jobRuns: unknown[];
    importRuns: unknown[];
    importedRecords: unknown[];
  };
}

/**
 * Generate a full structured JSON export of all user data.
 * Includes metadata, row counts, and all table contents.
 */
export function exportFullJSON(): LifeOSExport {
  const allTasks = db.select().from(tasks).orderBy(desc(tasks.createdAt)).all();
  const allHabits = db.select().from(habits).orderBy(desc(habits.createdAt)).all();
  const allHabitCompletions = db.select().from(habitCompletions).orderBy(desc(habitCompletions.createdAt)).all();
  const allJournal = db.select().from(journalEntries).orderBy(desc(journalEntries.createdAt)).all();
  const allNotes = db.select().from(notes).orderBy(desc(notes.createdAt)).all();
  const allIdeas = db.select().from(ideas).orderBy(desc(ideas.createdAt)).all();
  const allProjects = db.select().from(projects).orderBy(desc(projects.createdAt)).all();
  const allGoals = db.select().from(goals).orderBy(desc(goals.createdAt)).all();
  const allMilestones = db.select().from(milestones).orderBy(desc(milestones.createdAt)).all();
  const allMetrics = db.select().from(metricLogs).orderBy(desc(metricLogs.createdAt)).all();
  const allReviews = db.select().from(reviews).orderBy(desc(reviews.createdAt)).all();
  const allInbox = db.select().from(inboxItems).orderBy(desc(inboxItems.createdAt)).all();
  const allEntities = db.select().from(entities).orderBy(desc(entities.createdAt)).all();
  const allEvents = db.select().from(events).orderBy(desc(events.createdAt)).all();
  const allTemplates = db.select().from(templates).orderBy(desc(templates.createdAt)).all();
  const allAttachments = db.select().from(attachments).orderBy(desc(attachments.createdAt)).all();
  const allAttachmentLinks = db.select().from(attachmentLinks).orderBy(desc(attachmentLinks.createdAt)).all();
  const allRelations = db.select().from(relations).orderBy(desc(relations.createdAt)).all();
  const allTags = db.select().from(tags).orderBy(desc(tags.createdAt)).all();
  const allItemTags = db.select().from(itemTags).orderBy(desc(itemTags.createdAt)).all();
  const allProfile = db.select().from(gamificationProfile).all();
  const allXpEvents = db.select().from(xpEvents).orderBy(desc(xpEvents.createdAt)).all();
  const allAchievements = db.select().from(achievements).orderBy(desc(achievements.createdAt)).all();
  const allSettings = db.select().from(appSettings).all();
  const allScheduledJobs = db.select().from(scheduledJobs).orderBy(desc(scheduledJobs.createdAt)).all();
  const allJobRuns = db.select().from(jobRuns).orderBy(desc(jobRuns.createdAt)).all();
  const allImportRuns = db.select().from(importRuns).orderBy(desc(importRuns.createdAt)).all();
  const allImportedRecords = db.select().from(importedRecords).orderBy(desc(importedRecords.createdAt)).all();

  const data = {
    tasks: allTasks,
    habits: allHabits,
    habitCompletions: allHabitCompletions,
    journalEntries: allJournal,
    notes: allNotes,
    ideas: allIdeas,
    projects: allProjects,
    goals: allGoals,
    milestones: allMilestones,
    metricLogs: allMetrics,
    reviews: allReviews,
    inboxItems: allInbox,
    entities: allEntities,
    events: allEvents,
    templates: allTemplates,
    attachments: allAttachments,
    attachmentLinks: allAttachmentLinks,
    relations: allRelations,
    tags: allTags,
    itemTags: allItemTags,
    gamificationProfile: allProfile,
    xpEvents: allXpEvents,
    achievements: allAchievements,
    appSettings: allSettings,
    scheduledJobs: allScheduledJobs,
    jobRuns: allJobRuns,
    importRuns: allImportRuns,
    importedRecords: allImportedRecords,
  };

  const tableCounts: Record<string, number> = {};
  for (const [key, rows] of Object.entries(data)) {
    tableCounts[key] = (rows as unknown[]).length;
  }

  return {
    meta: {
      app: 'lifeOS',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      format: 'lifeos-json-v1',
      tables: tableCounts,
    },
    data,
  };
}

// ============================================================
// Raw DB Backup
// ============================================================

/**
 * Get the path to the SQLite database file.
 */
export function getDBPath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'lifeos.db');
}

/**
 * Create a safe backup copy of the SQLite database.
 * Uses SQLite's built-in backup API for consistency.
 * Returns the path to the backup file (in temp directory).
 */
export function createDBBackup(): string {
  const backupDir = os.tmpdir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `lifeos-backup-${timestamp}.db`);

  // Use SQLite's backup API for a consistent snapshot
  sqlite.backup(backupPath);

  return backupPath;
}

// ============================================================
// Data Statistics
// ============================================================

export interface DataStats {
  tasks: number;
  habits: number;
  journalEntries: number;
  notes: number;
  ideas: number;
  projects: number;
  goals: number;
  metricLogs: number;
  entities: number;
  reviews: number;
  tags: number;
  attachments: number;
  importRuns: number;
  xpEvents: number;
  totalRecords: number;
  dbSizeBytes: number;
  dbSizeFormatted: string;
}

/**
 * Get statistics about the data in the database.
 */
export function getDataStats(): DataStats {
  // Use raw SQL COUNT for efficiency — avoids loading all rows
  const counts = sqlite.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tasks) as tasks,
      (SELECT COUNT(*) FROM habits) as habits,
      (SELECT COUNT(*) FROM journal_entries) as journal_entries,
      (SELECT COUNT(*) FROM notes) as notes,
      (SELECT COUNT(*) FROM ideas) as ideas,
      (SELECT COUNT(*) FROM projects) as projects,
      (SELECT COUNT(*) FROM goals) as goals,
      (SELECT COUNT(*) FROM metric_logs) as metric_logs,
      (SELECT COUNT(*) FROM entities) as entities,
      (SELECT COUNT(*) FROM reviews) as reviews,
      (SELECT COUNT(*) FROM tags) as tags,
      (SELECT COUNT(*) FROM attachments) as attachments,
      (SELECT COUNT(*) FROM import_runs) as import_runs,
      (SELECT COUNT(*) FROM xp_events) as xp_events
  `).get() as Record<string, number>;

  const dbPath = getDBPath();
  let dbSizeBytes = 0;
  try {
    const stat = fs.statSync(dbPath);
    dbSizeBytes = stat.size;
    // Also add WAL file size if it exists
    const walPath = dbPath + '-wal';
    if (fs.existsSync(walPath)) {
      dbSizeBytes += fs.statSync(walPath).size;
    }
  } catch {
    // DB file might not exist yet
  }

  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return {
    tasks: counts.tasks,
    habits: counts.habits,
    journalEntries: counts.journal_entries,
    notes: counts.notes,
    ideas: counts.ideas,
    projects: counts.projects,
    goals: counts.goals,
    metricLogs: counts.metric_logs,
    entities: counts.entities,
    reviews: counts.reviews,
    tags: counts.tags,
    attachments: counts.attachments,
    importRuns: counts.import_runs,
    xpEvents: counts.xp_events,
    totalRecords,
    dbSizeBytes,
    dbSizeFormatted: formatBytes(dbSizeBytes),
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
