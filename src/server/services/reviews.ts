/**
 * lifeOS — Reviews Service
 *
 * CRUD operations plus typed review generation across daily, weekly,
 * monthly, and yearly periods, with template-backed user sections that
 * survive regeneration.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { reviews } from '../db/schema';
import { newId, now, todayISO } from '@/lib/utils';
import { buildReviewSnapshot, type ReviewSnapshot } from './aggregation';
import { createGoal } from './goals';
import { createRelation } from './relations';
import { removeSearchDocument, syncSearchDocument } from './search';
import { createTask } from './tasks';
import { ensureTemplate, getTemplateByName } from './templates';
import type { ReviewType } from '@/lib/types';

const USER_SECTION_PATTERN = /<!--\s*lifeos:user-section:([a-z0-9_-]+):start\s*-->([\s\S]*?)<!--\s*lifeos:user-section:\1:end\s*-->/gi;

const USER_SECTION_DEFAULTS: Record<string, string> = {
  personal_notes: '_Add your own reflections here..._',
  lessons: '_What stood out, surprised you, or changed your mind?_',
  commitments: '_Capture the follow-through you want to carry forward._',
};

const DEFAULT_REVIEW_TEMPLATES: Record<ReviewType, string> = {
  daily: `{{periodHeading}}

### 🏆 Wins
{{winsList}}

### 🚧 Blockers
{{blockersList}}

### ✅ Tasks
{{tasksSummary}}

### 🔁 Habits
{{habitsSummary}}

### 📊 Life Signals
{{lifeSignalsSummary}}

### 📝 Journal
{{journalSummary}}

### 📁 Projects
{{projectsSummary}}

### 🎯 Goals
{{goalsSummary}}

### 💡 Ideas Captured
{{ideasSummary}}

{{focusHeading}}
{{focusList}}

### ✏️ Personal Notes
<!-- lifeos:user-section:personal_notes:start -->
{{user:personal_notes}}
<!-- lifeos:user-section:personal_notes:end -->

### 🧠 Lessons
<!-- lifeos:user-section:lessons:start -->
{{user:lessons}}
<!-- lifeos:user-section:lessons:end -->

### ✅ Commitments
<!-- lifeos:user-section:commitments:start -->
{{user:commitments}}
<!-- lifeos:user-section:commitments:end -->
`,
  weekly: `{{periodHeading}}

### 🏆 Wins
{{winsList}}

### 🚧 Blockers
{{blockersList}}

### ✅ Tasks
{{tasksSummary}}

### 🔁 Habits
{{habitsSummary}}

### 📊 Life Signals
{{lifeSignalsSummary}}

### 📝 Journal
{{journalSummary}}

### 📁 Projects
{{projectsSummary}}

### 🎯 Goals
{{goalsSummary}}

### 💡 Ideas Captured
{{ideasSummary}}

{{focusHeading}}
{{focusList}}

### ✏️ Personal Notes
<!-- lifeos:user-section:personal_notes:start -->
{{user:personal_notes}}
<!-- lifeos:user-section:personal_notes:end -->

### 🧠 Lessons
<!-- lifeos:user-section:lessons:start -->
{{user:lessons}}
<!-- lifeos:user-section:lessons:end -->

### ✅ Commitments
<!-- lifeos:user-section:commitments:start -->
{{user:commitments}}
<!-- lifeos:user-section:commitments:end -->
`,
  monthly: `{{periodHeading}}

### 🏆 Wins
{{winsList}}

### 🚧 Blockers
{{blockersList}}

### ✅ Tasks
{{tasksSummary}}

### 🔁 Habits
{{habitsSummary}}

### 📊 Life Signals
{{lifeSignalsSummary}}

### 📝 Journal
{{journalSummary}}

### 📁 Projects
{{projectsSummary}}

### 🎯 Goals
{{goalsSummary}}

### 💡 Ideas Captured
{{ideasSummary}}

{{focusHeading}}
{{focusList}}

### ✏️ Personal Notes
<!-- lifeos:user-section:personal_notes:start -->
{{user:personal_notes}}
<!-- lifeos:user-section:personal_notes:end -->

### 🧠 Lessons
<!-- lifeos:user-section:lessons:start -->
{{user:lessons}}
<!-- lifeos:user-section:lessons:end -->

### ✅ Commitments
<!-- lifeos:user-section:commitments:start -->
{{user:commitments}}
<!-- lifeos:user-section:commitments:end -->
`,
  yearly: `{{periodHeading}}

### 🏆 Wins
{{winsList}}

### 🚧 Blockers
{{blockersList}}

### ✅ Tasks
{{tasksSummary}}

### 🔁 Habits
{{habitsSummary}}

### 📊 Life Signals
{{lifeSignalsSummary}}

### 📝 Journal
{{journalSummary}}

### 📁 Projects
{{projectsSummary}}

### 🎯 Goals
{{goalsSummary}}

### 💡 Ideas Captured
{{ideasSummary}}

{{focusHeading}}
{{focusList}}

### ✏️ Personal Notes
<!-- lifeos:user-section:personal_notes:start -->
{{user:personal_notes}}
<!-- lifeos:user-section:personal_notes:end -->

### 🧠 Lessons
<!-- lifeos:user-section:lessons:start -->
{{user:lessons}}
<!-- lifeos:user-section:lessons:end -->

### ✅ Commitments
<!-- lifeos:user-section:commitments:start -->
{{user:commitments}}
<!-- lifeos:user-section:commitments:end -->
`,
};

function parseISODateUTC(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function formatISODateUTC(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDaysUTC(isoDate: string, days: number): string {
  const date = parseISODateUTC(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODateUTC(date);
}

function addMonthsUTC(isoDate: string, months: number): string {
  const date = parseISODateUTC(isoDate);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);

  const lastDayOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 0, 0, 0, 0)
  ).getUTCDate();

  date.setUTCDate(Math.min(originalDay, lastDayOfMonth));
  return formatISODateUTC(date);
}

function addYearsUTC(isoDate: string, years: number): string {
  const date = parseISODateUTC(isoDate);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return formatISODateUTC(date);
}

function startOfWeekUTC(isoDate: string): string {
  const date = parseISODateUTC(isoDate);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return formatISODateUTC(date);
}

function endOfMonthUTC(isoDate: string): string {
  const date = parseISODateUTC(isoDate);
  return formatISODateUTC(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 0, 0, 0, 0)));
}

export function formatReviewTypeLabel(type: ReviewType): string {
  return `${type[0].toUpperCase()}${type.slice(1)} Review`;
}

function formatPeriodLabel(isoDate: string, options?: Intl.DateTimeFormatOptions): string {
  return parseISODateUTC(isoDate).toLocaleDateString('en-US', options ?? {
    month: 'short',
    day: 'numeric',
  });
}

function getPeriodHeading(type: ReviewType, periodStart: string, periodEnd: string): string {
  switch (type) {
    case 'daily':
      return `## Day of ${formatPeriodLabel(periodStart, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    case 'weekly':
      return `## Week of ${formatPeriodLabel(periodStart)} — ${formatPeriodLabel(periodEnd)}`;
    case 'monthly':
      return `## Month of ${formatPeriodLabel(periodStart, { month: 'long', year: 'numeric' })}`;
    case 'yearly':
      return `## Year of ${parseISODateUTC(periodStart).getUTCFullYear()}`;
  }
}

function getFocusHeading(type: ReviewType): string {
  switch (type) {
    case 'daily':
      return '### 🔮 Tomorrow Focus';
    case 'weekly':
      return '### 🔮 Next Week Focus';
    case 'monthly':
      return '### 🔮 Next Month Focus';
    case 'yearly':
      return '### 🔮 Next Year Focus';
  }
}

function formatBulletedList(items: string[], empty = '- None recorded yet.'): string {
  if (items.length === 0) return empty;
  return items.map((item) => `- ${item}`).join('\n');
}

function formatIndentedList(items: string[], empty = '- None recorded yet.'): string {
  if (items.length === 0) return empty;
  return items.map((item) => `  - ${item}`).join('\n');
}

function getReviewTemplateName(type: ReviewType) {
  return `review:${type}`;
}

function ensureDefaultReviewTemplates() {
  for (const reviewType of Object.keys(DEFAULT_REVIEW_TEMPLATES) as ReviewType[]) {
    ensureTemplate({
      name: getReviewTemplateName(reviewType),
      templateType: 'review',
      content: DEFAULT_REVIEW_TEMPLATES[reviewType],
      defaultFields: { reviewType, userSections: Object.keys(USER_SECTION_DEFAULTS) },
    });
  }
}

function getReviewTemplateContent(type: ReviewType): string {
  ensureDefaultReviewTemplates();
  const specific = getTemplateByName('review', getReviewTemplateName(type));
  return specific?.content ?? DEFAULT_REVIEW_TEMPLATES[type];
}

function extractLegacyPersonalNotes(body: string): string | undefined {
  const marker = '### ✏️ Personal Notes';
  const index = body.indexOf(marker);
  if (index === -1) return undefined;

  const rest = body.slice(index + marker.length).trim();
  return rest.length > 0 ? rest : undefined;
}

function extractUserSectionsFromBody(body: string | null | undefined): Record<string, string> {
  if (!body) return {};

  const sections: Record<string, string> = {};
  let match: RegExpExecArray | null;
  const pattern = new RegExp(USER_SECTION_PATTERN);

  while ((match = pattern.exec(body)) !== null) {
    sections[match[1]] = match[2].trim();
  }

  if (Object.keys(sections).length === 0) {
    const legacyNotes = extractLegacyPersonalNotes(body);
    if (legacyNotes) {
      sections.personal_notes = legacyNotes;
    }
  }

  return sections;
}

function buildReviewTemplateTokens(type: ReviewType, snapshot: ReviewSnapshot) {
  const completedTitles = snapshot.tasks.completedTitles.slice(0, 5);
  const journalHighlights = snapshot.journal.highlights.map((highlight) => {
    const label = highlight.title || highlight.date;
    return `**${label}**: ${highlight.snippet}`;
  });
  const projectProgress = snapshot.projects.progressed.map((project) => {
    const health = project.health ? ` (${project.health.replace('_', ' ')})` : '';
    return `**${project.title}**: ${project.status}${health} — ${project.progress ?? 0}% complete`;
  });
  const goalProgress = snapshot.goals.goals.map((goal) => `${goal.title}: ${goal.progress ?? 0}%`);
  const ideas = snapshot.ideas.titles.map((title) => title);

  const tasksSummaryLines = [
    `- **${snapshot.tasks.completed}** completed, **${snapshot.tasks.created}** created`,
  ];
  if (snapshot.tasks.overdue > 0) {
    tasksSummaryLines.push(`- ${snapshot.tasks.overdue} overdue`);
  }
  if (completedTitles.length > 0) {
    tasksSummaryLines.push('- Completed:');
    tasksSummaryLines.push(formatIndentedList(completedTitles));
  }

  const habitsLines = [
    `- Overall completion: **${snapshot.habits.completionRate}%** (${snapshot.habits.totalCompletions}/${snapshot.habits.possibleCompletions})`,
    ...snapshot.habits.bestStreaks.map((streak) => `- 🔥 ${streak.name}: ${streak.streak}-day streak`),
    ...snapshot.habits.byHabit.map((habit) => `- ${habit.name}: ${habit.completions}/${habit.possible} (${habit.rate}%)`),
  ];

  const lifeSignalsLines: string[] = [];
  if (snapshot.metrics.sleepAvg !== null) {
    lifeSignalsLines.push(`- Sleep: avg **${snapshot.metrics.sleepAvg}h** (${snapshot.metrics.sleepCount} logs)`);
  }
  if (snapshot.metrics.moodAvg !== null) {
    const trendIcon = snapshot.metrics.moodTrend === 'up' ? ' ↑' : snapshot.metrics.moodTrend === 'down' ? ' ↓' : '';
    lifeSignalsLines.push(`- Mood: avg **${snapshot.metrics.moodAvg}/10**${trendIcon} (${snapshot.metrics.moodCount} logs)`);
  }
  if (snapshot.metrics.energyAvg !== null) {
    const trendIcon = snapshot.metrics.energyTrend === 'up' ? ' ↑' : snapshot.metrics.energyTrend === 'down' ? ' ↓' : '';
    lifeSignalsLines.push(`- Energy: avg **${snapshot.metrics.energyAvg}/10**${trendIcon} (${snapshot.metrics.energyCount} logs)`);
  }
  if (snapshot.metrics.workoutCount > 0) {
    lifeSignalsLines.push(`- Workouts: **${snapshot.metrics.workoutCount}** (${snapshot.metrics.workoutMinutes} min total)`);
  }
  if (snapshot.metrics.expenseCount > 0) {
    lifeSignalsLines.push(`- Expenses: **$${snapshot.metrics.expenseTotal.toFixed(2)}** across ${snapshot.metrics.expenseCount} entries`);
  }

  const journalLines: string[] = [];
  if (snapshot.journal.entryCount > 0) {
    journalLines.push(`- ${snapshot.journal.entryCount} entries, ${snapshot.journal.totalWords} words`);
    if (journalHighlights.length > 0) {
      journalLines.push('- Highlights:');
      journalLines.push(formatIndentedList(journalHighlights));
    }
  }

  return {
    periodHeading: getPeriodHeading(type, snapshot.periodStart, snapshot.periodEnd),
    winsList: formatBulletedList(snapshot.wins),
    blockersList: formatBulletedList(snapshot.blockers),
    tasksSummary: tasksSummaryLines.join('\n'),
    habitsSummary: habitsLines.join('\n'),
    lifeSignalsSummary: lifeSignalsLines.length > 0 ? lifeSignalsLines.join('\n') : '- No metrics logged in this period.',
    journalSummary: journalLines.length > 0 ? journalLines.join('\n') : '- No journal entries recorded.',
    projectsSummary: projectProgress.length > 0 ? formatBulletedList(projectProgress) : '- No project movement recorded.',
    goalsSummary: goalProgress.length > 0 ? formatBulletedList(goalProgress) : '- No active goals tracked.',
    ideasSummary: ideas.length > 0 ? formatBulletedList(ideas) : '- No new ideas captured.',
    focusHeading: getFocusHeading(type),
    focusList: formatBulletedList(snapshot.focusAreas),
  };
}

function renderReviewMarkdown(type: ReviewType, snapshot: ReviewSnapshot, previousBody?: string | null): string {
  const template = getReviewTemplateContent(type);
  const tokens = buildReviewTemplateTokens(type, snapshot);
  const preservedUserSections = extractUserSectionsFromBody(previousBody);

  let rendered = template;

  for (const [token, value] of Object.entries(tokens)) {
    rendered = rendered.replaceAll(`{{${token}}}`, value);
  }

  rendered = rendered.replace(/\{\{user:([a-z0-9_-]+)\}\}/gi, (_, key: string) => {
    return preservedUserSections[key] ?? USER_SECTION_DEFAULTS[key] ?? '';
  });

  return rendered.trimEnd() + '\n';
}

function sanitizeInsightText(insight: string): string {
  return insight.trim().replace(/^[-*]\s+/, '');
}

function buildDerivedFromReviewBody(review: ReturnType<typeof getReview>, insight: string) {
  if (!review) return insight;
  const periodEnd = review.periodEnd ?? review.periodStart;

  return [
    `Derived from ${formatReviewTypeLabel(review.reviewType as ReviewType)}.`,
    '',
    `- Review period: ${review.periodStart} → ${periodEnd}`,
    `- Insight: ${insight}`,
  ].join('\n');
}

function syncReviewSearchDocument(reviewId: string) {
  const review = getReview(reviewId);
  if (!review) return;

  syncSearchDocument({
    itemId: review.id,
    itemType: 'review',
    title: formatReviewTypeLabel(review.reviewType as ReviewType),
    body: [review.body, review.reviewType, review.periodStart, review.periodEnd, review.statsSnapshot].filter(Boolean).join(' '),
  });
}

export function getReviewPeriodBounds(type: ReviewType, referenceDate: string) {
  switch (type) {
    case 'daily':
      return { periodStart: referenceDate, periodEnd: referenceDate };
    case 'weekly': {
      const periodStart = startOfWeekUTC(referenceDate);
      return { periodStart, periodEnd: addDaysUTC(periodStart, 6) };
    }
    case 'monthly': {
      const date = parseISODateUTC(referenceDate);
      const periodStart = formatISODateUTC(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)));
      return { periodStart, periodEnd: endOfMonthUTC(periodStart) };
    }
    case 'yearly': {
      const date = parseISODateUTC(referenceDate);
      const year = date.getUTCFullYear();
      return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` };
    }
  }
}

export function getNextReviewPeriodStart(type: ReviewType, periodStart: string): string {
  switch (type) {
    case 'daily':
      return addDaysUTC(periodStart, 1);
    case 'weekly':
      return addDaysUTC(periodStart, 7);
    case 'monthly':
      return addMonthsUTC(periodStart, 1);
    case 'yearly':
      return addYearsUTC(periodStart, 1);
  }
}

export function getReview(id: string) {
  return db.select().from(reviews).where(eq(reviews.id, id)).get();
}

export function getAllReviews() {
  return db.select().from(reviews)
    .orderBy(desc(reviews.periodStart), desc(reviews.createdAt))
    .all();
}

export function getReviewsByType(type: ReviewType) {
  return db.select().from(reviews)
    .where(eq(reviews.reviewType, type))
    .orderBy(desc(reviews.periodStart))
    .all();
}

export function getReviewForPeriod(type: ReviewType, periodStart: string, periodEnd: string) {
  return db.select().from(reviews)
    .where(
      and(
        eq(reviews.reviewType, type),
        eq(reviews.periodStart, periodStart),
        eq(reviews.periodEnd, periodEnd),
      )
    )
    .get();
}

export function updateReviewBody(id: string, body: string) {
  db.update(reviews)
    .set({ body, updatedAt: now() })
    .where(eq(reviews.id, id))
    .run();
  syncReviewSearchDocument(id);
  return getReview(id);
}

export function publishReview(id: string) {
  db.update(reviews)
    .set({ isPublished: 1, updatedAt: now() })
    .where(eq(reviews.id, id))
    .run();
  syncReviewSearchDocument(id);
  return getReview(id);
}

export function deleteReview(id: string) {
  db.delete(reviews).where(eq(reviews.id, id)).run();
  removeSearchDocument(id, 'review');
}

export function generateReviewForPeriod(type: ReviewType, periodStart: string) {
  const { periodStart: resolvedStart, periodEnd } = getReviewPeriodBounds(type, periodStart);
  const existing = getReviewForPeriod(type, resolvedStart, periodEnd);
  if (existing) {
    return { review: existing, isNew: false };
  }

  const snapshot = buildReviewSnapshot(resolvedStart, periodEnd);
  const body = renderReviewMarkdown(type, snapshot);
  const timestamp = now();
  const id = newId();

  db.insert(reviews).values({
    id,
    reviewType: type,
    periodStart: resolvedStart,
    periodEnd,
    body,
    generatedAt: timestamp,
    statsSnapshot: JSON.stringify(snapshot),
    isPublished: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  syncReviewSearchDocument(id);

  return { review: getReview(id)!, isNew: true };
}

export function generateReviewForDate(type: ReviewType, referenceDate: string = todayISO()) {
  const { periodStart } = getReviewPeriodBounds(type, referenceDate);
  return generateReviewForPeriod(type, periodStart);
}

export function generateWeeklyReview(weekStart: string) {
  return generateReviewForPeriod('weekly', weekStart);
}

export function regenerateReview(id: string) {
  const review = getReview(id);
  if (!review) return null;

  const snapshot = buildReviewSnapshot(review.periodStart, review.periodEnd);
  const body = renderReviewMarkdown(review.reviewType as ReviewType, snapshot, review.body);
  const timestamp = now();

  db.update(reviews)
    .set({
      body,
      statsSnapshot: JSON.stringify(snapshot),
      generatedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(reviews.id, id))
    .run();

  syncReviewSearchDocument(id);

  return getReview(id);
}

export function extractTaskFromReviewInsight(reviewId: string, insight: string) {
  const review = getReview(reviewId);
  if (!review) return null;

  const cleanInsight = sanitizeInsightText(insight);
  if (!cleanInsight) return null;

  const task = createTask({
    title: cleanInsight,
    body: buildDerivedFromReviewBody(review, cleanInsight),
    status: 'todo',
    source: 'review',
  });

  if (task) {
    createRelation({
      sourceType: 'task',
      sourceId: task.id,
      targetType: 'review',
      targetId: review.id,
      relationType: 'derived_from',
    });
  }

  return task;
}

export function extractGoalFromReviewInsight(reviewId: string, insight: string) {
  const review = getReview(reviewId);
  if (!review) return null;

  const cleanInsight = sanitizeInsightText(insight);
  if (!cleanInsight) return null;

  const goal = createGoal({
    title: cleanInsight,
    description: buildDerivedFromReviewBody(review, cleanInsight),
    status: 'active',
  });

  if (goal) {
    createRelation({
      sourceType: 'goal',
      sourceId: goal.id,
      targetType: 'review',
      targetId: review.id,
      relationType: 'derived_from',
    });
  }

  return goal;
}
