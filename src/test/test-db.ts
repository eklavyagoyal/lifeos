import fs from 'fs';
import os from 'os';
import path from 'path';
import { vi } from 'vitest';

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle', 'migrations');

interface TestContextOptions {
  authSecret?: string;
}

interface TestContext {
  tempDir: string;
  dbPath: string;
  attachmentsPath: string;
  cleanup: () => Promise<void>;
}

export async function createTestContext(options: TestContextOptions = {}): Promise<TestContext> {
  const env = process.env as Record<string, string | undefined>;
  const previous = {
    databasePath: env.DATABASE_PATH,
    attachmentsPath: env.ATTACHMENTS_PATH,
    authSecret: env.AUTH_SECRET,
    nodeEnv: env.NODE_ENV,
  };

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const dbPath = path.join(tempDir, 'lifeos.db');
  const attachmentsPath = path.join(tempDir, 'attachments');
  fs.mkdirSync(attachmentsPath, { recursive: true });

  env.DATABASE_PATH = dbPath;
  env.ATTACHMENTS_PATH = attachmentsPath;
  env.AUTH_SECRET = options.authSecret ?? 'correct horse battery staple';
  env.NODE_ENV = 'test';

  vi.resetModules();

  const { db, sqlite } = await import('@/server/db');
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');

  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    tempDir,
    dbPath,
    attachmentsPath,
    cleanup: async () => {
      sqlite.close();
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
    },
  };
}

export async function withTestContext<T>(
  run: (context: TestContext) => Promise<T>,
  options: TestContextOptions = {}
): Promise<T> {
  const context = await createTestContext(options);

  try {
    return await run(context);
  } finally {
    await context.cleanup();
  }
}
