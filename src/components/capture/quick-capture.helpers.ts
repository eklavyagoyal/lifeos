import type { CaptureParseResult, CaptureSuggestedType } from '@/lib/types';

export type QuickCaptureVariant = 'default' | 'hero';

export type CaptureTone = 'brand' | 'moss' | 'amber' | 'clay' | 'sky' | 'rose' | 'slate';

export interface CaptureIntentMeta {
  label: string;
  noun: string;
  description: string;
  tone: CaptureTone;
}

export interface CapturePrompt {
  label: string;
  text: string;
  hint: string;
  type: Exclude<CaptureSuggestedType, 'inbox'>;
}

export interface CaptureVariantCopy {
  eyebrow: string;
  title: string;
  description: string;
  sampleTitle: string;
}

export interface CaptureLane {
  type: Exclude<CaptureSuggestedType, 'inbox'>;
  label: string;
  prefix: string;
  hint: string;
}

export const CAPTURE_LANES: CaptureLane[] = [
  { type: 'task', label: 'Task', prefix: 'task:', hint: 'Next actions with timing, tags, and priority.' },
  { type: 'note', label: 'Note', prefix: 'note:', hint: 'Reference material, fragments, and context.' },
  { type: 'idea', label: 'Idea', prefix: 'idea:', hint: 'Creative sparks before they fade.' },
  { type: 'journal', label: 'Journal', prefix: 'journal:', hint: 'Reflections, observations, and inner weather.' },
  { type: 'metric', label: 'Signal', prefix: 'sleep', hint: 'Sleep, mood, energy, and other real conditions.' },
  { type: 'entity', label: 'Person', prefix: 'person:', hint: 'People, books, topics, and other living references.' },
];

export const CAPTURE_SAMPLE_PROMPTS: Record<QuickCaptureVariant, CapturePrompt[]> = {
  default: [
    {
      label: 'Task with timing',
      text: 'task: call dentist tomorrow #health p1',
      hint: 'Task, due date, tag, and priority in one line.',
      type: 'task',
    },
    {
      label: 'Quick signal',
      text: 'sleep 7.5',
      hint: 'Numeric life signals can create directly too.',
      type: 'metric',
    },
    {
      label: 'Idea fragment',
      text: 'idea: tiny weekly reset ritual before Monday starts',
      hint: 'Loose ideas stay light but structured.',
      type: 'idea',
    },
  ],
  hero: [
    {
      label: 'Protect a real task',
      text: 'task: send tax forms Friday #finance p1 +money-cleanup',
      hint: 'Capture the action, urgency, and project in a single motion.',
      type: 'task',
    },
    {
      label: 'Log a life signal',
      text: 'energy 6',
      hint: 'Tell the system how the body actually feels before planning from fantasy.',
      type: 'metric',
    },
    {
      label: 'Keep a person in orbit',
      text: 'person: Lena from design dinner | curious about reflective tools',
      hint: 'Turn a passing encounter into a durable relationship trace.',
      type: 'entity',
    },
    {
      label: 'Catch a reflection',
      text: 'journal: I feel less scattered when I clear the inbox before dinner',
      hint: 'Small observations become future pattern recognition.',
      type: 'journal',
    },
  ],
};

export function getCaptureVariantCopy(variant: QuickCaptureVariant): CaptureVariantCopy {
  if (variant === 'hero') {
    return {
      eyebrow: 'Capture Into Today',
      title: 'Treat capture like a creative instrument.',
      description: 'Drop a task, note, signal, or person into the orbit of the day and let the parser give it shape in real time.',
      sampleTitle: 'Prompt Deck',
    };
  }

  return {
    eyebrow: 'Quick Capture',
    title: 'Catch the thought before it drifts.',
    description: 'Turn loose intent into structured memory without leaving the moment you are already in.',
    sampleTitle: 'Jump-Start Prompts',
  };
}

export function getCaptureIntentMeta(type: CaptureSuggestedType): CaptureIntentMeta {
  switch (type) {
    case 'task':
      return {
        label: 'Task',
        noun: 'task',
        description: 'A concrete action that belongs on the board.',
        tone: 'brand',
      };
    case 'note':
      return {
        label: 'Note',
        noun: 'note',
        description: 'A reference fragment or context record worth keeping.',
        tone: 'moss',
      };
    case 'idea':
      return {
        label: 'Idea',
        noun: 'idea',
        description: 'A spark that should stay light but not vanish.',
        tone: 'amber',
      };
    case 'journal':
      return {
        label: 'Journal',
        noun: 'journal entry',
        description: 'A reflection that belongs in the personal record.',
        tone: 'clay',
      };
    case 'metric':
      return {
        label: 'Signal',
        noun: 'signal',
        description: 'A measurable pulse from the body, mood, or day.',
        tone: 'sky',
      };
    case 'entity':
      return {
        label: 'Entity',
        noun: 'entity',
        description: 'A person, book, topic, or reference to keep in orbit.',
        tone: 'rose',
      };
    default:
      return {
        label: 'Inbox',
        noun: 'capture',
        description: 'A loose fragment that should be held until it becomes clearer.',
        tone: 'slate',
      };
  }
}

export function getCaptureConfidenceMeta(confidence: number, directCreateSupported: boolean) {
  if (!directCreateSupported) {
    if (confidence >= 0.8) {
      return {
        label: 'Needs a decision',
        detail: 'The parser sees the shape, but it still belongs in the inbox first.',
      };
    }

    return {
      label: 'Needs a pass',
      detail: 'Add a prefix or more detail if you want a direct create instead of inbox capture.',
    };
  }

  if (confidence >= 0.92) {
    return {
      label: 'Ready to create',
      detail: 'This is strong enough to materialize directly without extra cleanup.',
    };
  }

  if (confidence >= 0.72) {
    return {
      label: 'Likely right',
      detail: 'The parser has a solid read, but you can still nudge the shape before creating it.',
    };
  }

  return {
    label: 'Soft read',
    detail: 'The parser found a plausible direction, but the input is still a little open-ended.',
  };
}

export function getCaptureActionCopy(
  preview: CaptureParseResult | null,
  isOnline: boolean
) {
  if (!preview) {
    return {
      primaryLabel: isOnline ? 'Create capture' : 'Queue capture',
      secondaryLabel: isOnline ? 'Send to Inbox' : 'Queue for Inbox',
      shortcutHint: 'Enter submits the current capture. Shift+Enter keeps it in the inbox lane.',
    };
  }

  const intent = getCaptureIntentMeta(preview.suggestedType);

  if (!isOnline) {
    return {
      primaryLabel: preview.directCreateSupported ? `Queue ${intent.label}` : 'Queue for Inbox',
      secondaryLabel: 'Queue for Inbox',
      shortcutHint: preview.directCreateSupported
        ? `Enter queues this ${intent.noun}. Shift+Enter keeps it in the inbox lane.`
        : 'This capture will queue locally and sync as inbox material when you reconnect.',
    };
  }

  if (preview.directCreateSupported) {
    return {
      primaryLabel: `Create ${intent.label}`,
      secondaryLabel: 'Inbox instead',
      shortcutHint: `Enter creates this ${intent.noun}. Shift+Enter keeps it in the inbox lane.`,
    };
  }

  return {
    primaryLabel: 'Send to Inbox',
    secondaryLabel: 'Inbox instead',
    shortcutHint: 'Enter sends this to the inbox. Add a prefix or more detail if you want direct create.',
  };
}

export function stripKnownCapturePrefix(text: string) {
  return text
    .replace(
      /^(task:|todo:|do:|note:|note\s+-|idea:|idea\s+-|journal:|j:|reflect:|person:|people:|book:|reading:|article:|course:)\s*/i,
      ''
    )
    .trim();
}

export function getActiveCaptureLane(
  text: string,
  previewType?: CaptureSuggestedType | null
): CaptureLane | null {
  const normalized = text.trim().toLowerCase();

  if (normalized) {
    if (/^(task:|todo:|do:)/.test(normalized)) return CAPTURE_LANES.find((lane) => lane.type === 'task') ?? null;
    if (/^(note:|note\s+-)/.test(normalized)) return CAPTURE_LANES.find((lane) => lane.type === 'note') ?? null;
    if (/^(idea:|idea\s+-)/.test(normalized)) return CAPTURE_LANES.find((lane) => lane.type === 'idea') ?? null;
    if (/^(journal:|j:|reflect:)/.test(normalized)) return CAPTURE_LANES.find((lane) => lane.type === 'journal') ?? null;
    if (/^(person:|people:|book:|reading:|article:|course:)/.test(normalized)) {
      return CAPTURE_LANES.find((lane) => lane.type === 'entity') ?? null;
    }
    if (/^(sleep|mood|energy|workout|expense)\b/.test(normalized)) {
      return CAPTURE_LANES.find((lane) => lane.type === 'metric') ?? null;
    }
  }

  if (previewType && previewType !== 'inbox') {
    return CAPTURE_LANES.find((lane) => lane.type === previewType) ?? null;
  }

  return null;
}
