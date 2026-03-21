import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  size = 'sm',
  showLabel = true,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  const barColor =
    clamped >= 80
      ? 'from-[rgb(96,127,97)] to-[rgb(142,173,120)]'
      : clamped >= 50
        ? 'from-[rgb(90,131,188)] to-[rgb(132,170,214)]'
        : clamped >= 20
          ? 'from-[rgb(195,150,72)] to-[rgb(228,190,116)]'
          : 'from-[rgb(187,129,98)] to-[rgb(214,169,137)]';

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'overflow-hidden rounded-full border border-line-soft bg-[linear-gradient(180deg,rgba(255,251,245,0.88),rgba(240,229,214,0.72))]',
          size === 'sm' ? 'h-2' : 'h-3'
        )}
      >
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-300 ease-luxury', barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel ? (
        <div className="text-right text-2xs font-medium tabular-nums text-text-secondary">
          {clamped}%
        </div>
      ) : null}
    </div>
  );
}
