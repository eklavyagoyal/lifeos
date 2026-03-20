import { getRecentImportRuns } from '@/server/services/imports';
import { getSystemInfo } from '@/server/services/system';
import { ImportsClient } from './client';

export const metadata = { title: 'Imports — lifeOS' };
export const dynamic = 'force-dynamic';

export default function ImportsPage() {
  const runs = getRecentImportRuns();
  const system = getSystemInfo();

  return <ImportsClient initialRuns={runs} attachmentsPath={system.attachmentsPath} />;
}
