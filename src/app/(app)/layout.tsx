import { Sidebar } from '@/components/layout/sidebar';
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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-sidebar flex-1 min-h-screen">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
