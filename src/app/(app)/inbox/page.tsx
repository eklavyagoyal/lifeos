import { getPendingInboxItems } from '@/server/services/inbox';
import { InboxItemList } from '@/components/inbox/inbox-item-list';
import { QuickCapture } from '@/components/capture/quick-capture';
import { Inbox as InboxIcon } from 'lucide-react';

export const metadata = { title: 'Inbox — lifeOS' };
export const dynamic = 'force-dynamic';

export default function InboxPage() {
  const items = getPendingInboxItems();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Inbox</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            This is the holding orbit for captures that still need a decision. Use Quick Capture above to keep the stream moving without losing shape.
          </p>
        </div>
        <span className="shell-meta-pill">
          {items.length} pending
        </span>
      </div>

      <QuickCapture placeholder="Capture a task, note, signal, or person before it drifts away..." />

      {items.length === 0 ? (
        <div className="secondary-empty-state py-12">
          <InboxIcon size={32} className="mb-2 text-text-muted" />
          <p className="text-sm text-text-muted">Inbox zero! 🎉</p>
          <p className="text-2xs text-text-muted mt-1">Capture something with the bar above.</p>
        </div>
      ) : (
        <InboxItemList items={items} />
      )}
    </div>
  );
}
