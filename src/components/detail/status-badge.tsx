import { cn } from '@/lib/cn';

interface StatusBadgeProps {
  status: string;
  colorMap?: Record<string, string>;
  labelMap?: Record<string, string>;
  dotMap?: Record<string, string>;
  size?: 'sm' | 'md';
}

const DEFAULT_COLORS: Record<string, string> = {
  planning: 'border-[rgba(90,131,188,0.18)] bg-[rgba(229,239,251,0.92)] text-[rgb(69,106,160)]',
  active: 'border-[rgba(96,127,97,0.2)] bg-[rgba(228,239,229,0.92)] text-[rgb(78,107,81)]',
  paused: 'border-[rgba(195,150,72,0.2)] bg-[rgba(252,244,223,0.92)] text-[rgb(151,111,34)]',
  completed: 'border-[rgba(90,144,113,0.2)] bg-[rgba(229,243,235,0.92)] text-[rgb(68,117,90)]',
  cancelled: 'border-[rgba(140,128,113,0.16)] bg-[rgba(241,236,231,0.92)] text-[rgb(108,99,88)]',
  achieved: 'border-[rgba(90,144,113,0.2)] bg-[rgba(229,243,235,0.92)] text-[rgb(68,117,90)]',
  abandoned: 'border-[rgba(140,128,113,0.16)] bg-[rgba(241,236,231,0.92)] text-[rgb(108,99,88)]',
  inbox: 'border-[rgba(138,108,182,0.18)] bg-[rgba(240,232,251,0.92)] text-[rgb(111,77,152)]',
  todo: 'border-[rgba(90,131,188,0.18)] bg-[rgba(229,239,251,0.92)] text-[rgb(69,106,160)]',
  in_progress: 'border-[rgba(195,150,72,0.2)] bg-[rgba(252,244,223,0.92)] text-[rgb(151,111,34)]',
  done: 'border-[rgba(96,127,97,0.2)] bg-[rgba(228,239,229,0.92)] text-[rgb(78,107,81)]',
  on_track: 'border-[rgba(96,127,97,0.2)] bg-[rgba(228,239,229,0.92)] text-[rgb(78,107,81)]',
  at_risk: 'border-[rgba(195,150,72,0.2)] bg-[rgba(252,244,223,0.92)] text-[rgb(151,111,34)]',
  off_track: 'border-[rgba(194,97,78,0.2)] bg-[rgba(252,231,227,0.92)] text-[rgb(155,77,62)]',
  seed: 'border-[rgba(196,152,76,0.18)] bg-[rgba(252,244,223,0.92)] text-[rgb(151,111,34)]',
  developing: 'border-[rgba(96,127,97,0.2)] bg-[rgba(228,239,229,0.92)] text-[rgb(78,107,81)]',
  mature: 'border-[rgba(90,144,113,0.2)] bg-[rgba(229,243,235,0.92)] text-[rgb(68,117,90)]',
  implemented: 'border-[rgba(90,131,188,0.18)] bg-[rgba(229,239,251,0.92)] text-[rgb(69,106,160)]',
  archived: 'border-[rgba(140,128,113,0.16)] bg-[rgba(241,236,231,0.92)] text-[rgb(108,99,88)]',
  to_read: 'border-[rgba(196,152,76,0.18)] bg-[rgba(252,244,223,0.92)] text-[rgb(151,111,34)]',
  reading: 'border-[rgba(90,131,188,0.18)] bg-[rgba(229,239,251,0.92)] text-[rgb(69,106,160)]',
  read: 'border-[rgba(96,127,97,0.2)] bg-[rgba(228,239,229,0.92)] text-[rgb(78,107,81)]',
  planned: 'border-[rgba(140,128,113,0.16)] bg-[rgba(241,236,231,0.92)] text-[rgb(108,99,88)]',
  draft: 'border-[rgba(188,124,82,0.2)] bg-[rgba(248,235,223,0.92)] text-[rgb(150,93,55)]',
  published: 'border-[rgba(96,127,97,0.2)] bg-[rgba(228,239,229,0.92)] text-[rgb(78,107,81)]',
};

const DEFAULT_DOTS: Record<string, string> = {
  planning: 'bg-[rgb(90,131,188)]',
  active: 'bg-[rgb(96,127,97)]',
  paused: 'bg-[rgb(195,150,72)]',
  completed: 'bg-[rgb(90,144,113)]',
  cancelled: 'bg-[rgb(140,128,113)]',
  achieved: 'bg-[rgb(90,144,113)]',
  abandoned: 'bg-[rgb(140,128,113)]',
  inbox: 'bg-[rgb(138,108,182)]',
  todo: 'bg-[rgb(90,131,188)]',
  in_progress: 'bg-[rgb(195,150,72)]',
  done: 'bg-[rgb(96,127,97)]',
  on_track: 'bg-[rgb(96,127,97)]',
  at_risk: 'bg-[rgb(195,150,72)]',
  off_track: 'bg-[rgb(194,97,78)]',
  seed: 'bg-[rgb(196,152,76)]',
  developing: 'bg-[rgb(96,127,97)]',
  mature: 'bg-[rgb(90,144,113)]',
  implemented: 'bg-[rgb(90,131,188)]',
  archived: 'bg-[rgb(140,128,113)]',
  to_read: 'bg-[rgb(196,152,76)]',
  reading: 'bg-[rgb(90,131,188)]',
  read: 'bg-[rgb(96,127,97)]',
  planned: 'bg-[rgb(140,128,113)]',
  draft: 'bg-[rgb(188,124,82)]',
  published: 'bg-[rgb(96,127,97)]',
};

const DEFAULT_LABELS: Record<string, string> = {
  planning: 'Planning',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  achieved: 'Achieved',
  abandoned: 'Abandoned',
  inbox: 'Inbox',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  on_track: 'On Track',
  at_risk: 'At Risk',
  off_track: 'Off Track',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  multi_year: 'Multi-Year',
  life: 'Life',
  daily: 'Daily',
  reflection: 'Reflection',
  gratitude: 'Gratitude',
  freeform: 'Freeform',
  evening_review: 'Evening Review',
  note: 'Note',
  reference: 'Reference',
  meeting: 'Meeting',
  snippet: 'Snippet',
  evergreen: 'Evergreen',
  seed: 'Seed',
  developing: 'Developing',
  mature: 'Mature',
  implemented: 'Implemented',
  archived: 'Archived',
  to_read: 'To Read',
  reading: 'Reading',
  read: 'Read',
  planned: 'Planned',
  draft: 'Draft',
  published: 'Published',
};

export function StatusBadge({
  status,
  colorMap = DEFAULT_COLORS,
  labelMap = DEFAULT_LABELS,
  dotMap = DEFAULT_DOTS,
  size = 'sm',
}: StatusBadgeProps) {
  const color = colorMap[status] ?? 'border-line-soft bg-surface-0/82 text-text-secondary';
  const label = labelMap[status] ?? status;
  const dot = dotMap[status] ?? 'bg-text-muted';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium shadow-soft',
        color,
        size === 'sm' ? 'px-2.5 py-1 text-2xs' : 'px-3 py-1.5 text-xs'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
}
