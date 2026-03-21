import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

const HERO_STARS = [
  { left: '8%', top: '16%', size: 6, delay: '0s' },
  { left: '22%', top: '62%', size: 4, delay: '0.9s' },
  { left: '34%', top: '26%', size: 5, delay: '1.8s' },
  { left: '52%', top: '14%', size: 4, delay: '0.4s' },
  { left: '70%', top: '58%', size: 5, delay: '1.3s' },
  { left: '84%', top: '22%', size: 6, delay: '2.2s' },
] as const;

const STAGE_STARS = [
  { left: '7%', top: '20%', size: 5, delay: '0.2s' },
  { left: '14%', top: '68%', size: 6, delay: '1.1s' },
  { left: '25%', top: '36%', size: 4, delay: '1.6s' },
  { left: '38%', top: '14%', size: 5, delay: '0.6s' },
  { left: '47%', top: '54%', size: 7, delay: '2s' },
  { left: '58%', top: '29%', size: 4, delay: '0.9s' },
  { left: '66%', top: '72%', size: 6, delay: '1.9s' },
  { left: '74%', top: '18%', size: 5, delay: '1.4s' },
  { left: '82%', top: '46%', size: 7, delay: '2.4s' },
  { left: '91%', top: '28%', size: 4, delay: '0.7s' },
] as const;

interface ConstellationDepthFieldProps {
  variant?: 'hero' | 'stage';
  className?: string;
}

export function ConstellationDepthField({
  variant = 'stage',
  className,
}: ConstellationDepthFieldProps) {
  const stars = variant === 'hero' ? HERO_STARS : STAGE_STARS;

  return (
    <div
      className={cn(
        'constellation-depth-field',
        variant === 'hero' ? 'constellation-depth-field-hero' : 'constellation-depth-field-stage',
        className
      )}
      aria-hidden="true"
    >
      <div className="constellation-depth-cloud constellation-depth-cloud-brass" />
      <div className="constellation-depth-cloud constellation-depth-cloud-moss" />
      <div className="constellation-depth-orbit constellation-depth-orbit-a" />
      <div className="constellation-depth-orbit constellation-depth-orbit-b" />

      {stars.map((star, index) => (
        <span
          key={`${variant}-star-${index}`}
          className="constellation-depth-star"
          style={
            {
              '--star-left': star.left,
              '--star-top': star.top,
              '--star-size': `${star.size}px`,
              '--star-delay': star.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
