'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', callback);
    return () => mediaQuery.removeEventListener('change', callback);
  }

  mediaQuery.addListener(callback);
  return () => mediaQuery.removeListener(callback);
}

function getSnapshot() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
