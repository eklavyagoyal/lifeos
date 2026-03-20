'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useMode } from '@/stores/mode-store';
import { logoutAction } from '@/app/actions';
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
  Zap,
  Moon,
  LogOut,
  TrendingUp,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    items: [
      { label: 'Today', href: '/today', icon: <Sun size={18} /> },
      { label: 'Inbox', href: '/inbox', icon: <Inbox size={18} /> },
    ],
  },
  {
    label: 'Track',
    items: [
      { label: 'Tasks', href: '/tasks', icon: <CheckSquare size={18} /> },
      { label: 'Habits', href: '/habits', icon: <Repeat size={18} /> },
      { label: 'Journal', href: '/journal', icon: <BookOpen size={18} /> },
      { label: 'Notes', href: '/notes', icon: <StickyNote size={18} /> },
      { label: 'Ideas', href: '/ideas', icon: <Lightbulb size={18} /> },
    ],
  },
  {
    label: 'Plan',
    items: [
      { label: 'Projects', href: '/projects', icon: <FolderKanban size={18} /> },
      { label: 'Goals', href: '/goals', icon: <Target size={18} /> },
    ],
  },
  {
    label: 'Life',
    items: [
      { label: 'Health', href: '/health', icon: <Heart size={18} /> },
      { label: 'Finance', href: '/finance', icon: <DollarSign size={18} /> },
      { label: 'Learning', href: '/learning', icon: <GraduationCap size={18} /> },
      { label: 'People', href: '/people', icon: <Users size={18} /> },
    ],
  },
  {
    label: 'Analyze',
    items: [
      { label: 'Insights', href: '/insights', icon: <TrendingUp size={18} /> },
      { label: 'Metrics', href: '/metrics', icon: <BarChart3 size={18} /> },
      { label: 'Graph', href: '/graph', icon: <Network size={18} /> },
      { label: 'Reviews', href: '/reviews', icon: <ClipboardList size={18} /> },
      { label: 'Timeline', href: '/timeline', icon: <Clock size={18} /> },
    ],
  },
  {
    items: [
      { label: 'Search', href: '/search', icon: <Search size={18} /> },
      { label: 'Imports', href: '/imports', icon: <Upload size={18} /> },
      { label: 'Settings', href: '/settings', icon: <Settings size={18} /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, toggleMode, isQuick } = useMode();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-sidebar flex-col border-r border-surface-3 bg-surface-0">
      {/* Logo / Header */}
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/today" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white text-sm font-bold">
            L
          </div>
          <span className="text-sm font-semibold text-text-primary">lifeOS</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navigation.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && 'mt-4')}>
            {group.label && (
              <div className="mb-1 px-3 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'nav-item',
                    isActive && 'nav-item-active'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto badge bg-brand-100 text-brand-700">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Mode Toggle & Logout */}
      <div className="border-t border-surface-3 p-3 space-y-1">
        <button
          onClick={toggleMode}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
            'hover:bg-surface-2'
          )}
        >
          {isQuick ? <Zap size={18} className="text-brand-500" /> : <Moon size={18} className="text-brand-500" />}
          <span className="text-text-secondary">
            {isQuick ? 'Quick Mode' : 'Deep Mode'}
          </span>
          <span
            className={cn(
              'ml-auto h-5 w-9 rounded-full p-0.5 transition-colors',
              isQuick ? 'bg-brand-500' : 'bg-surface-4'
            )}
          >
            <span
              className={cn(
                'block h-4 w-4 rounded-full bg-white transition-transform',
                !isQuick && 'translate-x-4'
              )}
            />
          </span>
        </button>
        <button
          onClick={async () => {
            await logoutAction();
            router.push('/login');
            router.refresh();
          }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
        >
          <LogOut size={18} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
