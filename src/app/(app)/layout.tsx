import { AppShellFrame } from '@/components/layout/app-shell-frame';
import { assertDatabaseReadyForRequests } from '@/server/services/runtime';

/**
 * App layout — wraps all authenticated routes with the sidebar.
 * The login page is outside this group and renders without the sidebar.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV !== 'test' && process.env.NEXT_PHASE !== 'phase-production-build') {
    assertDatabaseReadyForRequests();
  }

  return (
    <AppShellFrame>{children}</AppShellFrame>
  );
}
