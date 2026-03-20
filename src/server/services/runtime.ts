import fs from 'fs';
import path from 'path';
import { sqlite } from '../db';
import { APP_NAME, APP_VERSION } from '@/lib/app-info';
import { getDBPath } from './export';
import { bootstrapScheduler, getSchedulerDiagnostics } from './scheduler';

export type DiagnosticStatus = 'ok' | 'warn' | 'error';
export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface RuntimeCheck {
  key: string;
  label: string;
  status: DiagnosticStatus;
  message: string;
  details: string[];
}

export interface RuntimeDiagnostics {
  app: string;
  version: string;
  status: HealthStatus;
  ready: boolean;
  timestamp: string;
  warningCount: number;
  errorCount: number;
  checks: RuntimeCheck[];
}

const DEFAULT_AUTH_SECRETS = new Set([
  '',
  'changeme',
  'changeme-to-a-strong-passphrase',
  'lifeos-dev-default',
]);
const MIN_AUTH_SECRET_LENGTH = 12;
const REQUIRED_CORE_TABLES = [
  'tasks',
  'habits',
  'reviews',
  'app_settings',
  'scheduled_jobs',
  'job_runs',
  'milestones',
  'attachments',
  'attachment_links',
  'import_runs',
  'imported_records',
] as const;
const REQUIRED_TABLE_COLUMNS: Record<(typeof REQUIRED_CORE_TABLES)[number], string[]> = {
  tasks: ['id', 'title', 'status', 'project_id', 'goal_id', 'parent_task_id', 'recurrence_rule', 'source', 'archived_at'],
  habits: ['id', 'goal_id', 'project_id', 'archived_at'],
  reviews: ['id', 'review_type', 'period_start', 'period_end'],
  app_settings: ['key', 'value', 'updated_at'],
  scheduled_jobs: ['id', 'job_key', 'job_type', 'subject_type', 'subject_id'],
  job_runs: ['id', 'job_id', 'run_key', 'status'],
  milestones: ['id', 'goal_id', 'project_id', 'task_id', 'habit_id'],
  attachments: ['id', 'search_text', 'search_summary', 'search_status', 'extracted_at'],
  attachment_links: ['id', 'attachment_id', 'item_type', 'item_id'],
  import_runs: ['id', 'mode', 'details'],
  imported_records: ['id', 'import_run_id', 'source_record_key', 'item_type', 'item_id'],
};

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]?\$\d{1,2}\$.{53}$/.test(value);
}

function getAttachmentsPath(): string {
  return process.env.ATTACHMENTS_PATH || path.join(process.cwd(), 'data', 'attachments');
}

function getRequiredTableCount(): number {
  const row = sqlite.prepare(`
    SELECT COUNT(*) AS count
    FROM sqlite_master
    WHERE type = 'table' AND name IN (${REQUIRED_CORE_TABLES.map((table) => `'${table}'`).join(', ')})
  `).get() as { count: number };

  return row.count;
}

function getMissingSchemaColumns(): string[] {
  const missing: string[] = [];

  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
    const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: string }>;
    const available = new Set(rows.map((row) => row.name).filter((name): name is string => Boolean(name)));

    for (const column of requiredColumns) {
      if (!available.has(column)) {
        missing.push(`${tableName}.${column}`);
      }
    }
  }

  return missing;
}

function getDatabaseCheck(): RuntimeCheck {
  const dbPath = getDBPath();
  const dbDir = path.dirname(dbPath);
  const details = [`Path: ${dbPath}`];

  try {
    if (!fs.existsSync(dbDir)) {
      return {
        key: 'database',
        label: 'Database',
        status: 'error',
        message: 'Database directory does not exist.',
        details: [...details, `Missing directory: ${dbDir}`],
      };
    }

    fs.accessSync(dbDir, fs.constants.R_OK | fs.constants.W_OK);

    const sqliteVersion = sqlite.prepare('SELECT sqlite_version() AS version').get() as { version: string };
    details.push(`SQLite: ${sqliteVersion.version}`);
    details.push('Directory access: read/write');

    if (!fs.existsSync(dbPath)) {
      return {
        key: 'database',
        label: 'Database',
        status: 'warn',
        message: 'Database file has not been created yet.',
        details,
      };
    }

    fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    details.push('Database file access: read/write');

    const requiredTables = getRequiredTableCount();
    if (requiredTables < REQUIRED_CORE_TABLES.length) {
      return {
        key: 'database',
        label: 'Database',
        status: 'error',
        message: 'Database is reachable, but migrations still need to run.',
        details: [...details, `Core tables present: ${requiredTables}/${REQUIRED_CORE_TABLES.length}`],
      };
    }

    const missingColumns = getMissingSchemaColumns();
    if (missingColumns.length > 0) {
      const preview = missingColumns.slice(0, 8).join(', ');
      return {
        key: 'database',
        label: 'Database',
        status: 'error',
        message: 'Database schema is out of date; newer columns are missing.',
        details: [
          ...details,
          `Missing columns: ${preview}${missingColumns.length > 8 ? ` (+${missingColumns.length - 8} more)` : ''}`,
          'Run `pnpm db:migrate` to apply the latest schema changes.',
        ],
      };
    }

    return {
      key: 'database',
      label: 'Database',
      status: 'ok',
      message: 'SQLite is reachable and migrations look healthy.',
      details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return {
      key: 'database',
      label: 'Database',
      status: 'error',
      message: 'SQLite is not ready for requests.',
      details: [...details, message],
    };
  }
}

function getAuthCheck(): RuntimeCheck {
  const secret = process.env.AUTH_SECRET ?? '';
  const isProduction = process.env.NODE_ENV === 'production';
  const details = [`Environment: ${process.env.NODE_ENV || 'development'}`];

  if (!secret) {
    return {
      key: 'auth',
      label: 'Authentication',
      status: isProduction ? 'error' : 'warn',
      message: isProduction
        ? 'AUTH_SECRET is missing.'
        : 'AUTH_SECRET is not configured; auth is currently bypassed.',
      details,
    };
  }

  if (DEFAULT_AUTH_SECRETS.has(secret)) {
    return {
      key: 'auth',
      label: 'Authentication',
      status: isProduction ? 'error' : 'warn',
      message: 'AUTH_SECRET is using a default development value.',
      details,
    };
  }

  if (isBcryptHash(secret)) {
    return {
      key: 'auth',
      label: 'Authentication',
      status: 'ok',
      message: 'Authentication is configured with a bcrypt hash.',
      details,
    };
  }

  details.push('Mode: plaintext passphrase');

  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    return {
      key: 'auth',
      label: 'Authentication',
      status: isProduction ? 'error' : 'warn',
      message: `AUTH_SECRET should be at least ${MIN_AUTH_SECRET_LENGTH} characters long.`,
      details,
    };
  }

  return {
    key: 'auth',
    label: 'Authentication',
    status: 'ok',
    message: 'Authentication is configured with a custom passphrase.',
    details,
  };
}

export function assertDatabaseReadyForRequests() {
  const check = getDatabaseCheck();
  if (check.status === 'ok') return;

  throw new Error(
    `${check.message} Run \`pnpm db:migrate\` for DATABASE_PATH ${getDBPath()}.`
  );
}

function getAttachmentsCheck(): RuntimeCheck {
  const attachmentsPath = getAttachmentsPath();
  const parentDir = path.dirname(attachmentsPath);
  const details = [`Path: ${attachmentsPath}`];

  try {
    if (fs.existsSync(attachmentsPath)) {
      fs.accessSync(attachmentsPath, fs.constants.R_OK | fs.constants.W_OK);
      return {
        key: 'attachments',
        label: 'Attachments Path',
        status: 'ok',
        message: 'Attachments directory is ready.',
        details,
      };
    }

    if (!fs.existsSync(parentDir)) {
      return {
        key: 'attachments',
        label: 'Attachments Path',
        status: 'warn',
        message: 'Attachments directory does not exist yet.',
        details: [...details, `Missing parent directory: ${parentDir}`],
      };
    }

    fs.accessSync(parentDir, fs.constants.R_OK | fs.constants.W_OK);
    return {
      key: 'attachments',
      label: 'Attachments Path',
      status: 'ok',
      message: 'Attachments path is valid and can be created on first use.',
      details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown attachments path error';
    return {
      key: 'attachments',
      label: 'Attachments Path',
      status: 'warn',
      message: 'Attachments path is not writable.',
      details: [...details, message],
    };
  }
}

function getSchedulerCheck(): RuntimeCheck {
  const details = [`Tick cadence: ${'every 5 minutes'}`];

  if (process.env.NODE_ENV === 'test') {
    return {
      key: 'scheduler',
      label: 'Scheduler',
      status: 'ok',
      message: 'Scheduler bootstrap is disabled in tests.',
      details,
    };
  }

  try {
    bootstrapScheduler();
    const diagnostics = getSchedulerDiagnostics();

    details.push(`Bootstrapped: ${diagnostics.bootstrapped ? 'yes' : 'no'}`);
    details.push(`Active jobs: ${diagnostics.activeJobs}`);
    details.push(`Due jobs: ${diagnostics.dueJobs}`);
    details.push(`Failed runs: ${diagnostics.failedRuns}`);
    details.push(`Open review reminders: ${diagnostics.overdueReviewTasks}`);
    details.push(`Stale active projects: ${diagnostics.staleProjects}`);

    if (diagnostics.lastSuccessfulRunAt) {
      details.push(`Last successful run: ${new Date(diagnostics.lastSuccessfulRunAt).toISOString()}`);
    }
    if (diagnostics.lastFailedRunAt) {
      details.push(`Last failed run: ${new Date(diagnostics.lastFailedRunAt).toISOString()}`);
    }

    if (!diagnostics.bootstrapped) {
      return {
        key: 'scheduler',
        label: 'Scheduler',
        status: 'warn',
        message: 'Scheduler has not started yet in this process.',
        details,
      };
    }

    if (diagnostics.failedRuns > 0) {
      return {
        key: 'scheduler',
        label: 'Scheduler',
        status: 'warn',
        message: 'Scheduler is running, but some jobs have failed.',
        details,
      };
    }

    if (diagnostics.dueJobs > 0) {
      return {
        key: 'scheduler',
        label: 'Scheduler',
        status: 'warn',
        message: 'Scheduler is healthy, but there is still due work waiting to run.',
        details,
      };
    }

    return {
      key: 'scheduler',
      label: 'Scheduler',
      status: 'ok',
      message: 'Scheduler is running and job state looks healthy.',
      details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scheduler error';
    return {
      key: 'scheduler',
      label: 'Scheduler',
      status: 'error',
      message: 'Scheduler could not initialize cleanly.',
      details: [...details, message],
    };
  }
}

export function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const checks = [getDatabaseCheck(), getAuthCheck(), getAttachmentsCheck(), getSchedulerCheck()];
  const errorCount = checks.filter((check) => check.status === 'error').length;
  const warningCount = checks.filter((check) => check.status === 'warn').length;

  const status: HealthStatus =
    errorCount > 0 ? 'error' : warningCount > 0 ? 'degraded' : 'ok';

  return {
    app: APP_NAME,
    version: APP_VERSION,
    status,
    ready: errorCount === 0,
    timestamp: new Date().toISOString(),
    warningCount,
    errorCount,
    checks,
  };
}
