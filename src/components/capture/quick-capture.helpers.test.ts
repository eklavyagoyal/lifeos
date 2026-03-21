import { describe, expect, it } from 'vitest';
import {
  CAPTURE_SAMPLE_PROMPTS,
  getActiveCaptureLane,
  getCaptureActionCopy,
  getCaptureConfidenceMeta,
  getCaptureIntentMeta,
  stripKnownCapturePrefix,
} from './quick-capture.helpers';
import type { CaptureParseResult } from '@/lib/types';

function makePreview(overrides: Partial<CaptureParseResult> = {}): CaptureParseResult {
  return {
    rawText: 'task: call dentist tomorrow',
    suggestedType: 'task',
    title: 'call dentist',
    tags: ['health'],
    directCreateSupported: true,
    confidence: 0.94,
    warnings: [],
    ...overrides,
  };
}

describe('quick capture helpers', () => {
  it('returns intent metadata for supported types', () => {
    expect(getCaptureIntentMeta('metric')).toMatchObject({
      label: 'Signal',
      noun: 'signal',
      tone: 'sky',
    });
  });

  it('describes confidence differently for direct create vs inbox-bound captures', () => {
    expect(getCaptureConfidenceMeta(0.95, true).label).toBe('Ready to create');
    expect(getCaptureConfidenceMeta(0.45, false).label).toBe('Needs a pass');
  });

  it('builds action copy that reflects online direct-create behavior', () => {
    expect(getCaptureActionCopy(makePreview(), true)).toMatchObject({
      primaryLabel: 'Create Task',
      secondaryLabel: 'Inbox instead',
    });
  });

  it('builds action copy that reflects offline queue behavior', () => {
    expect(getCaptureActionCopy(makePreview(), false)).toMatchObject({
      primaryLabel: 'Queue Task',
      secondaryLabel: 'Queue for Inbox',
    });
  });

  it('strips known capture prefixes cleanly', () => {
    expect(stripKnownCapturePrefix('note: restaurant ideas')).toBe('restaurant ideas');
    expect(stripKnownCapturePrefix('journal:')).toBe('');
  });

  it('detects the active lane from either explicit prefixes or inferred preview type', () => {
    expect(getActiveCaptureLane('energy 6', null)?.type).toBe('metric');
    expect(getActiveCaptureLane('', 'idea')?.type).toBe('idea');
  });

  it('keeps the hero prompt deck richer than the default one', () => {
    expect(CAPTURE_SAMPLE_PROMPTS.hero.length).toBeGreaterThan(CAPTURE_SAMPLE_PROMPTS.default.length);
  });
});
