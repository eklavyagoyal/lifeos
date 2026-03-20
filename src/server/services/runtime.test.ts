import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '@/lib/app-info';
import { withTestContext } from '@/test/test-db';

describe('runtime diagnostics', () => {
  it('reports an OK status when core runtime dependencies are healthy', async () => {
    await withTestContext(async () => {
      const { getRuntimeDiagnostics } = await import('./runtime');

      const diagnostics = getRuntimeDiagnostics();

      expect(diagnostics.version).toBe(APP_VERSION);
      expect(diagnostics.ready).toBe(true);
      expect(diagnostics.status).toBe('ok');
      expect(diagnostics.checks.find((check) => check.key === 'database')?.status).toBe('ok');
      expect(diagnostics.checks.find((check) => check.key === 'auth')?.status).toBe('ok');
    });
  });

  it('degrades when auth is missing in non-production environments', async () => {
    await withTestContext(
      async () => {
        const { getRuntimeDiagnostics } = await import('./runtime');

        const diagnostics = getRuntimeDiagnostics();

        expect(diagnostics.ready).toBe(true);
        expect(diagnostics.status).toBe('degraded');
        expect(diagnostics.checks.find((check) => check.key === 'auth')?.status).toBe('warn');
      },
      { authSecret: '' }
    );
  });

  it('flags an outdated database schema before page queries hit missing columns', async () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = {
      databasePath: env.DATABASE_PATH,
      attachmentsPath: env.ATTACHMENTS_PATH,
      authSecret: env.AUTH_SECRET,
      nodeEnv: env.NODE_ENV,
    };

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-runtime-outdated-'));
    const dbPath = path.join(tempDir, 'lifeos.db');
    const attachmentsPath = path.join(tempDir, 'attachments');
    fs.mkdirSync(attachmentsPath, { recursive: true });

    env.DATABASE_PATH = dbPath;
    env.ATTACHMENTS_PATH = attachmentsPath;
    env.AUTH_SECRET = 'correct horse battery staple';
    env.NODE_ENV = 'test';

    const sqlite = new Database(dbPath);
    sqlite.exec(`
      CREATE TABLE tasks (
        id text primary key,
        title text,
        status text,
        project_id text,
        parent_task_id text,
        recurrence_rule text,
        source text,
        archived_at integer,
        sort_order real,
        created_at integer
      );
      CREATE TABLE habits (id text primary key, goal_id text, project_id text, archived_at integer);
      CREATE TABLE reviews (id text primary key, review_type text, period_start text, period_end text);
      CREATE TABLE app_settings (key text primary key, value text, updated_at integer);
      CREATE TABLE scheduled_jobs (id text primary key, job_key text, job_type text, subject_type text, subject_id text);
      CREATE TABLE job_runs (id text primary key, job_id text, run_key text, status text);
      CREATE TABLE milestones (id text primary key, goal_id text, project_id text, task_id text, habit_id text);
      CREATE TABLE attachments (id text primary key, search_text text, search_summary text, search_status text, extracted_at integer);
      CREATE TABLE attachment_links (id text primary key, attachment_id text, item_type text, item_id text);
      CREATE TABLE import_runs (id text primary key, mode text, details text);
      CREATE TABLE imported_records (id text primary key, import_run_id text, source_record_key text, item_type text, item_id text);
    `);
    sqlite.close();

    try {
      vi.resetModules();

      const { assertDatabaseReadyForRequests, getRuntimeDiagnostics } = await import('./runtime');
      const diagnostics = getRuntimeDiagnostics();

      expect(diagnostics.ready).toBe(false);
      expect(diagnostics.checks.find((check) => check.key === 'database')?.message).toContain('schema is out of date');
      expect(() => assertDatabaseReadyForRequests()).toThrow(/pnpm db:migrate/);
    } finally {
      vi.resetModules();

      if (previous.databasePath === undefined) delete env.DATABASE_PATH;
      else env.DATABASE_PATH = previous.databasePath;

      if (previous.attachmentsPath === undefined) delete env.ATTACHMENTS_PATH;
      else env.ATTACHMENTS_PATH = previous.attachmentsPath;

      if (previous.authSecret === undefined) delete env.AUTH_SECRET;
      else env.AUTH_SECRET = previous.authSecret;

      if (previous.nodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previous.nodeEnv;

      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
