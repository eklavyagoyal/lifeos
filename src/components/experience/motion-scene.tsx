'use client';

import type {
  CSSProperties,
  HTMLAttributes,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

type SpatialElement = 'div' | 'section' | 'aside';

interface SpatialSceneProps extends HTMLAttributes<HTMLElement> {
  as?: SpatialElement;
  children: ReactNode;
  className?: string;
  intensity?: number;
}

interface DepthPlaneProps extends HTMLAttributes<HTMLElement> {
  as?: SpatialElement;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  depth?: number;
  tilt?: number;
  float?: 'none' | 'soft' | 'drift';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function SpatialScene({
  as = 'div',
  children,
  className,
  intensity = 1,
  style,
  onPointerMove,
  onPointerLeave,
  ...props
}: SpatialSceneProps) {
  const Component = as;
  const rootRef = useRef<HTMLElement | null>(null);
  const planesRef = useRef<HTMLElement[]>([]);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const prefersReducedMotion = usePrefersReducedMotion();
  const [supportsPointerDepth, setSupportsPointerDepth] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(pointer: fine)');
    const update = () => setSupportsPointerDepth(mediaQuery.matches);

    update();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  const interactive = supportsPointerDepth && !prefersReducedMotion;

  const applyScene = useCallback(
    (x: number, y: number) => {
      const root = rootRef.current;
      if (!root) return;

      root.style.setProperty('--scene-glow-x', `${50 + x * 18}%`);
      root.style.setProperty('--scene-glow-y', `${50 + y * 18}%`);
      root.style.setProperty('--scene-active', interactive ? '1' : '0');

      planesRef.current.forEach((plane) => {
        const depth = Number(plane.dataset.depth ?? 12) * intensity;
        const tilt = Number(plane.dataset.tilt ?? 0.7) * intensity;
        const offsetX = Number((x * depth).toFixed(2));
        const offsetY = Number((y * depth).toFixed(2));
        const rotateX = Number((-y * tilt * 4.5).toFixed(2));
        const rotateY = Number((x * tilt * 5.5).toFixed(2));

        plane.style.transform =
          `translate3d(${offsetX}px, ${offsetY}px, 0px) ` +
          `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });
    },
    [interactive, intensity]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const updatePlanes = () => {
      planesRef.current = [...root.querySelectorAll<HTMLElement>('[data-motion-plane="true"]')];
    };

    updatePlanes();

    if (typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(updatePlanes);
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!interactive) {
      applyScene(0, 0);
    }
  }, [applyScene, interactive]);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const scheduleScene = useCallback(
    (x: number, y: number) => {
      pointerRef.current = { x, y };

      if (frameRef.current) return;

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        applyScene(pointerRef.current.x, pointerRef.current.y);
      });
    },
    [applyScene]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!interactive || !rootRef.current) {
        onPointerMove?.(event);
        return;
      }

      const bounds = rootRef.current.getBoundingClientRect();
      const x = clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
      const y = clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);

      scheduleScene(x, y);
      onPointerMove?.(event);
    },
    [interactive, onPointerMove, scheduleScene]
  );

  const handlePointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (interactive) {
        scheduleScene(0, 0);
      }

      onPointerLeave?.(event);
    },
    [interactive, onPointerLeave, scheduleScene]
  );

  const mergedStyle = useMemo(() => {
    return {
      '--scene-glow-x': '50%',
      '--scene-glow-y': '50%',
      '--scene-active': interactive ? 1 : 0,
      ...(style as CSSProperties),
    } as CSSProperties;
  }, [interactive, style]);

  return (
    <Component
      {...props}
      ref={rootRef as never}
      className={cn('motion-scene', interactive && 'motion-scene-interactive', className)}
      style={mergedStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </Component>
  );
}

export function DepthPlane({
  as = 'div',
  children,
  className,
  innerClassName,
  depth = 12,
  tilt = 0.75,
  float = 'none',
  style,
  ...props
}: DepthPlaneProps) {
  const Component = as;
  const mergedStyle = useMemo(() => style as CSSProperties | undefined, [style]);

  return (
    <Component
      {...props}
      data-motion-plane="true"
      data-depth={depth}
      data-tilt={tilt}
      className={cn('motion-plane', className)}
      style={mergedStyle}
    >
      <div
        className={cn(
          'motion-plane-inner',
          float === 'soft' && 'motion-float-soft',
          float === 'drift' && 'motion-float-drift',
          innerClassName
        )}
      >
        {children}
      </div>
    </Component>
  );
}
