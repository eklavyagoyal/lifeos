import {
  Shield, Database, Download, Server,
  HardDrive, FileJson, CheckCircle, AlertTriangle, Activity, XCircle,
} from 'lucide-react';
import { getDataStats } from '@/server/services/export';
import { getSystemInfo } from '@/server/services/system';
import { getRuntimeDiagnostics } from '@/server/services/runtime';
import { getProfile } from '@/server/services/gamification';
import { calculateLevel } from '@/lib/constants';
import { LogoutButton } from './logout-button';
import { ExportActions } from './export-actions';

export const metadata = { title: 'Settings — lifeOS' };
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const stats = getDataStats();
  const system = getSystemInfo();
  const diagnostics = getRuntimeDiagnostics();
  const profile = getProfile();
  const level = calculateLevel(profile.totalXp ?? 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
          v{system.appVersion}
        </span>
      </div>

      {/* Security Section */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-brand-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Security</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Authentication</p>
              <p className="text-2xs text-text-tertiary">
                Passphrase protection for your instance
              </p>
            </div>
            {system.authConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Using default
              </span>
            )}
          </div>

          {!system.authConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">
                Set a strong <code className="rounded bg-amber-100 px-1 py-0.5 text-2xs font-mono">AUTH_SECRET</code> in
                your environment variables for production use.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm text-text-primary">Session</p>
              <p className="text-2xs text-text-tertiary">
                Sessions expire after 7 days
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </section>

      {/* Data & Export Section */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-brand-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Data & Export</h2>
        </div>

        <p className="text-xs text-text-tertiary">
          Your data is stored locally in a SQLite database. You own it completely.
          Export or back up at any time.
        </p>

        {/* Data summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Tasks" value={stats.tasks} />
          <StatCard label="Habits" value={stats.habits} />
          <StatCard label="Journal" value={stats.journalEntries} />
          <StatCard label="Notes" value={stats.notes} />
          <StatCard label="Ideas" value={stats.ideas} />
          <StatCard label="Projects" value={stats.projects} />
          <StatCard label="Goals" value={stats.goals} />
          <StatCard label="Metrics" value={stats.metricLogs} />
          <StatCard label="People & Learning" value={stats.entities} />
          <StatCard label="Attachments" value={stats.attachments} />
          <StatCard label="Import Runs" value={stats.importRuns} />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-surface-1 px-3 py-2">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-text-muted" />
            <span className="text-xs text-text-secondary">
              {stats.totalRecords.toLocaleString()} total records
            </span>
          </div>
          <span className="text-xs text-text-muted">
            DB size: {stats.dbSizeFormatted}
          </span>
        </div>

        {/* Export actions */}
        <ExportActions />
      </section>

      {/* Runtime Diagnostics */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-brand-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Runtime Diagnostics</h2>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-surface-1 px-3 py-2">
          <div>
            <p className="text-sm text-text-primary">Current readiness</p>
            <p className="text-2xs text-text-tertiary">
              {diagnostics.errorCount > 0
                ? `${diagnostics.errorCount} blocking issue${diagnostics.errorCount !== 1 ? 's' : ''}`
                : diagnostics.warningCount > 0
                ? `${diagnostics.warningCount} warning${diagnostics.warningCount !== 1 ? 's' : ''}`
                : 'All core checks look healthy'}
            </p>
          </div>
          <RuntimeStatusBadge status={diagnostics.status} />
        </div>

        <div className="space-y-2">
          {diagnostics.checks.map((check) => (
            <div
              key={check.key}
              className="rounded-lg border border-surface-3 bg-surface-1 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-text-primary">{check.label}</p>
                  <p className="text-2xs text-text-tertiary">{check.message}</p>
                </div>
                <CheckStatusBadge status={check.status} />
              </div>
              {check.details.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {check.details.map((detail) => (
                    <p key={detail} className="text-2xs text-text-muted">
                      {detail}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* System Info Section */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-brand-primary" />
          <h2 className="text-sm font-semibold text-text-primary">System</h2>
        </div>

        <div className="space-y-2">
          <InfoRow label="App version" value={`v${system.appVersion}`} />
          <InfoRow label="Environment" value={system.environment} />
          <InfoRow label="Node.js" value={system.nodeVersion} />
          <InfoRow label="Platform" value={system.platform} />
          <InfoRow label="Uptime" value={system.uptime} />
          <InfoRow label="Database" value={system.dbPath} mono />
          <InfoRow label="Data directory" value={system.dataDir} mono />
          <InfoRow label="Attachments" value={system.attachmentsPath} mono />
        </div>

        {/* Profile summary */}
        <div className="rounded-lg bg-surface-1 px-3 py-2">
          <p className="text-xs text-text-secondary">
            Level {level} · {(profile.totalXp ?? 0).toLocaleString()} XP ·{' '}
            {stats.reviews} review{stats.reviews !== 1 ? 's' : ''} generated
          </p>
        </div>

        {/* Backup guidance */}
        <div className="rounded-lg border border-surface-3 px-3 py-2">
          <p className="text-2xs font-medium text-text-secondary mb-1">
            Backup guidance
          </p>
          <ul className="space-y-0.5 text-2xs text-text-tertiary">
            <li>• Your database is a single SQLite file at the path shown above</li>
            <li>• Use &ldquo;Download Database&rdquo; above for a consistent backup</li>
            <li>• In Docker, data is in the <code className="rounded bg-surface-2 px-1 font-mono">lifeos-data</code> volume</li>
            <li>• To restore: stop the app, replace the DB file, restart</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-1 px-3 py-2">
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      <p className="text-2xs text-text-muted">{label}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-tertiary">{label}</span>
      <span className={`text-text-secondary ${mono ? 'font-mono text-2xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function RuntimeStatusBadge({ status }: { status: 'ok' | 'degraded' | 'error' }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600">
        <CheckCircle className="h-3.5 w-3.5" />
        Ready
      </span>
    );
  }

  if (status === 'degraded') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        Degraded
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
      <XCircle className="h-3.5 w-3.5" />
      Blocked
    </span>
  );
}

function CheckStatusBadge({ status }: { status: 'ok' | 'warn' | 'error' }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-2xs font-medium text-green-600">
        <CheckCircle className="h-3 w-3" />
        OK
      </span>
    );
  }

  if (status === 'warn') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-600">
        <AlertTriangle className="h-3 w-3" />
        Warning
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-600">
      <XCircle className="h-3 w-3" />
      Error
    </span>
  );
}
