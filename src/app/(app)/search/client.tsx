'use client';

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Search,
  X,
  CheckSquare,
  Repeat,
  BookOpen,
  StickyNote,
  Lightbulb,
  FolderKanban,
  Target,
  Users,
  CalendarDays,
  ClipboardList,
  BarChart3,
} from 'lucide-react';
import { searchAction } from '@/app/actions';
import type { ItemType, SearchResultItem } from '@/lib/types';

const TYPE_CONFIG: Record<string, { label: string; icon: ReactNode; color: string }> = {
  task: { label: 'Task', icon: <CheckSquare size={14} />, color: 'text-blue-500' },
  habit: { label: 'Habit', icon: <Repeat size={14} />, color: 'text-green-500' },
  journal: { label: 'Journal', icon: <BookOpen size={14} />, color: 'text-amber-500' },
  note: { label: 'Note', icon: <StickyNote size={14} />, color: 'text-purple-500' },
  idea: { label: 'Idea', icon: <Lightbulb size={14} />, color: 'text-yellow-500' },
  project: { label: 'Project', icon: <FolderKanban size={14} />, color: 'text-indigo-500' },
  goal: { label: 'Goal', icon: <Target size={14} />, color: 'text-rose-500' },
  entity: { label: 'Entity', icon: <Users size={14} />, color: 'text-pink-500' },
  metric: { label: 'Metric', icon: <BarChart3 size={14} />, color: 'text-cyan-500' },
  event: { label: 'Event', icon: <CalendarDays size={14} />, color: 'text-orange-500' },
  review: { label: 'Review', icon: <ClipboardList size={14} />, color: 'text-teal-500' },
};

const FILTER_OPTIONS: { value: ItemType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'task', label: 'Tasks' },
  { value: 'habit', label: 'Habits' },
  { value: 'journal', label: 'Journal' },
  { value: 'note', label: 'Notes' },
  { value: 'idea', label: 'Ideas' },
  { value: 'project', label: 'Projects' },
  { value: 'goal', label: 'Goals' },
  { value: 'entity', label: 'Entities' },
  { value: 'metric', label: 'Metrics' },
  { value: 'event', label: 'Events' },
  { value: 'review', label: 'Reviews' },
];

export function SearchClient() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | 'all'>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus search input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string, filter: ItemType | 'all') => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    const { results: searchResults } = await searchAction(
      q,
      filter === 'all' ? undefined : filter
    );
    setResults(searchResults);
    setHasSearched(true);
    setSearching(false);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value, typeFilter), 200);
  };

  const handleFilterChange = (filter: ItemType | 'all') => {
    setTypeFilter(filter);
    if (query.trim()) {
      doSearch(query, filter);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-semibold text-text-primary">Search</h1>

      {/* Search input */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search tasks, notes, reviews, events, projects, goals, and attached files..."
          className="w-full rounded-lg border border-surface-3 bg-surface-1 py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleFilterChange(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              typeFilter === opt.value
                ? 'bg-brand-primary text-white'
                : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {searching && (
        <div className="py-8 text-center">
          <p className="text-sm text-text-muted">Searching...</p>
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && (
        <div className="card py-12 text-center">
          <Search size={32} className="mx-auto text-text-muted mb-2" />
          <p className="text-sm text-text-muted">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-2xs text-text-muted mt-1">Try different keywords or clear the type filter.</p>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-text-muted">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          {results.map((result) => {
            const config = TYPE_CONFIG[result.itemType];
            if (!config) return null;

            return (
              <Link
                key={`${result.itemType}-${result.itemId}`}
                href={result.detailUrl}
                className="card flex items-start gap-3 p-3 transition-colors hover:bg-surface-2"
              >
                <div className={`mt-0.5 ${config.color}`}>
                  {config.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {result.title}
                    </p>
                    <span className="flex-shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-2xs text-text-muted">
                      {config.label}
                    </span>
                  </div>
                  {result.subtitle && (
                    <p className="mt-0.5 text-2xs text-text-muted">{result.subtitle}</p>
                  )}
                  {result.attachmentCount ? (
                    <p className="mt-0.5 text-2xs text-text-muted">
                      {result.attachmentCount} attachment{result.attachmentCount !== 1 ? 's' : ''}
                      {result.attachmentNames && result.attachmentNames.length > 0
                        ? ` · ${result.attachmentNames.join(', ')}`
                        : ''}
                    </p>
                  ) : null}
                  {result.snippet && (
                    <p
                      className="mt-0.5 text-xs text-text-tertiary line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: result.snippet }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!searching && !hasSearched && (
        <div className="py-8 text-center">
          <Search size={32} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            Search across tasks, notes, journal entries, projects, goals, reviews, events, metrics, entities, and linked attachments.
          </p>
          <p className="text-2xs text-text-muted mt-1">Start typing to see results instantly.</p>
        </div>
      )}
    </div>
  );
}
