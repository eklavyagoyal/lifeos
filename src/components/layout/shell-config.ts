import type { LucideIcon } from 'lucide-react';
import {
  Sun,
  Inbox,
  CheckSquare,
  Repeat,
  BookOpen,
  StickyNote,
  Lightbulb,
  FolderKanban,
  Target,
  Heart,
  DollarSign,
  GraduationCap,
  Users,
  BarChart3,
  Network,
  ClipboardList,
  Clock,
  Search,
  Upload,
  Settings,
  TrendingUp,
} from 'lucide-react';

export interface ShellNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  eyebrow: string;
  scene: string;
  accent: string;
  secondary: string;
  highlight: string;
}

export interface ShellNavGroup {
  label?: string;
  description?: string;
  items: ShellNavItem[];
}

export const shellNavigation: ShellNavGroup[] = [
  {
    label: 'Center',
    description: 'The home orbit for active intention and rapid capture.',
    items: [
      {
        label: 'Today',
        href: '/today',
        icon: Sun,
        description: 'Set the tone, surface the signals, and steer the day with intention.',
        eyebrow: 'Daily Orbit',
        scene: 'Ritual Desk',
        accent: '216 131 74',
        secondary: '95 116 95',
        highlight: '255 244 227',
      },
      {
        label: 'Inbox',
        href: '/inbox',
        icon: Inbox,
        description: 'Sort fragments, sparks, and loose capture into deliberate next steps.',
        eyebrow: 'Capture Bay',
        scene: 'Sorting Table',
        accent: '192 132 62',
        secondary: '122 106 91',
        highlight: '255 245 229',
      },
    ],
  },
  {
    label: 'Track',
    description: 'Daily motions, repeatable rhythms, and the raw record of living.',
    items: [
      {
        label: 'Tasks',
        href: '/tasks',
        icon: CheckSquare,
        description: 'Shape concrete moves, commitments, and near-term execution.',
        eyebrow: 'Work Bench',
        scene: 'Execution Rail',
        accent: '170 106 89',
        secondary: '95 116 95',
        highlight: '252 239 233',
      },
      {
        label: 'Habits',
        href: '/habits',
        icon: Repeat,
        description: 'Track the rituals and repeating rhythms that hold the floor of the day.',
        eyebrow: 'Rhythm Loop',
        scene: 'Cadence Engine',
        accent: '95 116 95',
        secondary: '176 132 87',
        highlight: '240 246 237',
      },
      {
        label: 'Journal',
        href: '/journal',
        icon: BookOpen,
        description: 'Hold memory, texture, and meaning in a slower reflective surface.',
        eyebrow: 'Memory Field',
        scene: 'Reflection Ledger',
        accent: '141 110 92',
        secondary: '184 133 83',
        highlight: '249 241 234',
      },
      {
        label: 'Notes',
        href: '/notes',
        icon: StickyNote,
        description: 'Keep a living commonplace of thoughts, references, and fragments.',
        eyebrow: 'Commonplace',
        scene: 'Reference Shelf',
        accent: '176 132 87',
        secondary: '116 95 80',
        highlight: '255 245 231',
      },
      {
        label: 'Ideas',
        href: '/ideas',
        icon: Lightbulb,
        description: 'Catch sparks, speculative threads, and unfinished possibilities.',
        eyebrow: 'Spark Archive',
        scene: 'Idea Lantern',
        accent: '215 134 78',
        secondary: '110 116 96',
        highlight: '255 240 225',
      },
    ],
  },
  {
    label: 'Plan',
    description: 'The longer arc: projects, milestones, and directional intent.',
    items: [
      {
        label: 'Projects',
        href: '/projects',
        icon: FolderKanban,
        description: 'Organize active bodies of work and shape their momentum over time.',
        eyebrow: 'Project Atelier',
        scene: 'Momentum Board',
        accent: '190 140 78',
        secondary: '95 116 95',
        highlight: '252 245 228',
      },
      {
        label: 'Goals',
        href: '/goals',
        icon: Target,
        description: 'Keep the north stars visible and connect work back to what matters.',
        eyebrow: 'North Star',
        scene: 'Alignment Chamber',
        accent: '191 130 62',
        secondary: '95 116 95',
        highlight: '255 243 223',
      },
    ],
  },
  {
    label: 'Life',
    description: 'The human domains that make the system personal instead of abstract.',
    items: [
      {
        label: 'Health',
        href: '/health',
        icon: Heart,
        description: 'Keep vital care visible and grounded in lived patterns.',
        eyebrow: 'Vital Signs',
        scene: 'Care Console',
        accent: '95 116 95',
        secondary: '184 133 83',
        highlight: '239 246 237',
      },
      {
        label: 'Finance',
        href: '/finance',
        icon: DollarSign,
        description: 'Watch resources, obligations, and stability with calm clarity.',
        eyebrow: 'Resource Ledger',
        scene: 'Stewardship Desk',
        accent: '192 154 74',
        secondary: '110 96 82',
        highlight: '252 247 227',
      },
      {
        label: 'Learning',
        href: '/learning',
        icon: GraduationCap,
        description: 'Collect what you are studying, practicing, and becoming.',
        eyebrow: 'Apprenticeship',
        scene: 'Study Table',
        accent: '107 134 182',
        secondary: '110 121 95',
        highlight: '239 244 252',
      },
      {
        label: 'People',
        href: '/people',
        icon: Users,
        description: 'Keep your relationship constellation visible and warm.',
        eyebrow: 'People Constellation',
        scene: 'Relationship Atlas',
        accent: '184 106 119',
        secondary: '141 110 92',
        highlight: '252 239 243',
      },
    ],
  },
  {
    label: 'Analyze',
    description: 'Zoom out, find signal, and understand the shape of your system.',
    items: [
      {
        label: 'Insights',
        href: '/insights',
        icon: TrendingUp,
        description: 'Surface patterns, inflection points, and meaningful change over time.',
        eyebrow: 'Signal Room',
        scene: 'Pattern Lens',
        accent: '107 134 182',
        secondary: '184 133 83',
        highlight: '239 244 252',
      },
      {
        label: 'Metrics',
        href: '/metrics',
        icon: BarChart3,
        description: 'Measure what matters with a more deliberate visual pulse.',
        eyebrow: 'Measurement Deck',
        scene: 'Quantitative Rail',
        accent: '86 132 123',
        secondary: '192 132 62',
        highlight: '237 246 244',
      },
      {
        label: 'Graph',
        href: '/graph',
        icon: Network,
        description: 'Explore your life as a constellation of linked artifacts and themes.',
        eyebrow: 'Constellation',
        scene: 'Memory Atlas',
        accent: '107 134 182',
        secondary: '95 116 95',
        highlight: '236 244 252',
      },
      {
        label: 'Reviews',
        href: '/reviews',
        icon: ClipboardList,
        description: 'Return to the chapters of your life with a more editorial rhythm.',
        eyebrow: 'Review Chamber',
        scene: 'Reflection Archive',
        accent: '183 128 78',
        secondary: '95 116 95',
        highlight: '252 242 232',
      },
      {
        label: 'Timeline',
        href: '/timeline',
        icon: Clock,
        description: 'Follow the arc of events, reviews, and notable moments through time.',
        eyebrow: 'Life Arc',
        scene: 'Chronicle Ribbon',
        accent: '141 110 92',
        secondary: '107 134 182',
        highlight: '247 240 234',
      },
    ],
  },
  {
    label: 'Operate',
    description: 'Lookup, migration, and operating controls for the system itself.',
    items: [
      {
        label: 'Search',
        href: '/search',
        icon: Search,
        description: 'Traverse the system quickly through names, relations, and context.',
        eyebrow: 'Lookup Atlas',
        scene: 'Search Window',
        accent: '121 107 94',
        secondary: '107 134 182',
        highlight: '246 240 234',
      },
      {
        label: 'Imports',
        href: '/imports',
        icon: Upload,
        description: 'Bring prior history into the system with visibility and control.',
        eyebrow: 'Migration Dock',
        scene: 'Transfer Bay',
        accent: '184 133 83',
        secondary: '95 116 95',
        highlight: '253 245 230',
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        description: 'Tune the environment, runtime, and self-hosted operating conditions.',
        eyebrow: 'Control Room',
        scene: 'Runtime Console',
        accent: '121 107 94',
        secondary: '95 116 95',
        highlight: '243 238 233',
      },
    ],
  },
];

const fallbackNavItem = shellNavigation[0].items[0];

export function isShellNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getActiveShellNavItem(pathname: string) {
  const normalized = pathname === '/' ? '/today' : pathname;
  for (const group of shellNavigation) {
    for (const item of group.items) {
      if (isShellNavItemActive(normalized, item.href)) {
        return item;
      }
    }
  }
  return fallbackNavItem;
}
