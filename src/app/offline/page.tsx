import Link from 'next/link';
import { CloudOff, Wifi, Inbox } from 'lucide-react';

export const metadata = { title: 'Offline — lifeOS' };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
      <div className="w-full rounded-3xl border border-surface-3 bg-surface-0 p-8 shadow-sm">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <CloudOff size={22} />
        </div>

        <h1 className="text-2xl font-semibold text-text-primary">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-text-secondary">
          lifeOS can still queue quick captures for you right now. Once you&apos;re back online,
          the queue will sync automatically from the capture bar.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-surface-3 bg-surface-1 p-4">
            <div className="mb-2 flex items-center gap-2 text-text-secondary">
              <Inbox size={16} />
              <p className="text-sm font-medium text-text-primary">Capture-first offline mode</p>
            </div>
            <p className="text-xs text-text-muted">
              Open the Today or Inbox page after reconnecting and queued captures will flush in the background.
            </p>
          </div>
          <div className="rounded-2xl border border-surface-3 bg-surface-1 p-4">
            <div className="mb-2 flex items-center gap-2 text-text-secondary">
              <Wifi size={16} />
              <p className="text-sm font-medium text-text-primary">Reconnect when you can</p>
            </div>
            <p className="text-xs text-text-muted">
              Detail pages and imports still depend on a live connection to your self-hosted instance.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/today"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            Open Today
          </Link>
          <Link
            href="/inbox"
            className="rounded-md border border-surface-3 px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-1"
          >
            Open Inbox
          </Link>
        </div>
      </div>
    </div>
  );
}
