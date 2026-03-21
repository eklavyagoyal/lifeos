import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Flame,
  FolderKanban,
  Inbox,
  Minus,
  Moon,
  Repeat,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { QuickCapture } from '@/components/capture/quick-capture';
import { DepthPlane, SpatialScene } from '@/components/experience/motion-scene';
import { TodayOrbitSculpture } from '@/components/experience/today-orbit-sculpture';
import { HabitChecklist } from '@/components/habits/habit-checklist';
import { MetricQuickLog } from '@/components/metrics/metric-quick-log';
import { TaskList } from '@/components/tasks/task-list';
import { calculateLevel, xpForLevel } from '@/lib/constants';
import { endOfWeek, startOfWeek } from '@/lib/utils';
import { getProfile } from '@/server/services/gamification';
import { getActiveHabits, getTodayCompletions } from '@/server/services/habits';
import { getInboxCount } from '@/server/services/inbox';
import { getWeeklyInsights, isFirstRun } from '@/server/services/insights';
import { getTodayMetrics } from '@/server/services/metrics';
import { getReviewForPeriod } from '@/server/services/reviews';
import { getCompletedTaskCountForDate, getTodayTasks } from '@/server/services/tasks';

export const metadata = { title: 'Today — lifeOS' };

export const dynamic = 'force-dynamic';

interface TodayHeroNarrative {
  tone: string;
  lede: string;
  supporting: string;
  rituals: string[];
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}

function formatTodayHeader(): { dayName: string; fullDate: string; greeting: string } {
  const now = new Date();
  const hour = now.getHours();

  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return { dayName, fullDate, greeting };
}

function buildTodayNarrative({
  firstRun,
  openTaskCount,
  completedTaskCount,
  habitsDone,
  habitsTotal,
  inboxCount,
  signalCount,
  hasWeeklyReview,
}: {
  firstRun: boolean;
  openTaskCount: number;
  completedTaskCount: number;
  habitsDone: number;
  habitsTotal: number;
  inboxCount: number;
  signalCount: number;
  hasWeeklyReview: boolean;
}): TodayHeroNarrative {
  if (firstRun) {
    return {
      tone: 'Blank Canvas',
      lede: 'This room is ready for its first anchor points.',
      supporting:
        'Place one task, one habit, or one note into the day. The moment something lands here, lifeOS can start reflecting it back with shape and memory.',
      rituals: [
        'Capture your first commitment',
        'Log one honest life signal',
        'Leave a note about what matters today',
      ],
    };
  }

  const remainingHabits = Math.max(0, habitsTotal - habitsDone);
  const missingSignals = Math.max(0, 3 - signalCount);

  let tone = 'Open Horizon';
  let lede = 'The board is lighter than usual.';

  if (completedTaskCount >= 3 && openTaskCount <= 2) {
    tone = 'Made Ground';
    lede = 'You already moved meaningful work today.';
  } else if (openTaskCount >= 5 || inboxCount >= 5) {
    tone = 'Heavy Orbit';
    lede = 'Today already has real weight to it.';
  } else if (inboxCount > openTaskCount && inboxCount > 0) {
    tone = 'Sorting Hour';
    lede = 'Incoming is louder than the plan right now.';
  } else if (openTaskCount > 0) {
    tone = 'Shaped Day';
    lede = 'The day has a shape you can work with.';
  } else if (remainingHabits === 0 && signalCount === 3) {
    tone = 'Steady Rhythm';
    lede = 'Most of the core rhythms are already in motion.';
  }

  const supportingParts: string[] = [];
  if (completedTaskCount > 0) {
    supportingParts.push(
      `${completedTaskCount} ${pluralize('task', completedTaskCount)} ${completedTaskCount === 1 ? 'has' : 'have'} already been closed today`
    );
  }

  if (openTaskCount > 0) {
    supportingParts.push(
      `${openTaskCount} active ${pluralize('task', openTaskCount)} ${openTaskCount === 1 ? 'is' : 'are'} on deck`
    );
  } else {
    supportingParts.push('No planned tasks are pressing yet');
  }

  if (habitsTotal > 0) {
    supportingParts.push(
      remainingHabits > 0
        ? `${remainingHabits} habit ${pluralize('ritual', remainingHabits)} still want attention`
        : 'your daily habits are already accounted for'
    );
  } else {
    supportingParts.push('no habits are tracking yet');
  }

  if (missingSignals > 0) {
    supportingParts.push(`${missingSignals} life ${pluralize('signal', missingSignals)} still need logging`);
  } else {
    supportingParts.push('your core life signals are already on the board');
  }

  if (!hasWeeklyReview) {
    supportingParts.push('the weekly review is waiting when you are ready to close the loop');
  }

  const rituals: string[] = [];
  if (inboxCount > 0) rituals.push(`Clear ${inboxCount} ${pluralize('capture', inboxCount)} from the inbox`);
  if (openTaskCount > 0) rituals.push(`Protect the next ${Math.min(openTaskCount, 2)} active ${pluralize('task', Math.min(openTaskCount, 2))}`);
  if (remainingHabits > 0) rituals.push(`Keep ${remainingHabits} habit ${pluralize('ritual', remainingHabits)} alive`);
  if (missingSignals > 0) rituals.push(`Log ${missingSignals} missing life ${pluralize('signal', missingSignals)}`);
  if (!hasWeeklyReview) rituals.push('Close the week with a review draft');
  if (rituals.length === 0) rituals.push('Choose one meaningful move before the day fills itself');

  return {
    tone,
    lede,
    supporting: `${supportingParts.slice(0, 3).join(', ')}.`,
    rituals: rituals.slice(0, 3),
  };
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp size={14} className="text-status-success" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-status-danger" />;
  return <Minus size={14} className="text-text-muted" />;
}

export default function TodayPage() {
  const { dayName, fullDate, greeting } = formatTodayHeader();
  const todayTasks = getTodayTasks();
  const habits = getActiveHabits();
  const completions = getTodayCompletions();
  const inboxCount = getInboxCount();
  const todayMetrics = getTodayMetrics();
  const weekly = getWeeklyInsights();
  const firstRun = isFirstRun();
  const completedTaskCount = getCompletedTaskCountForDate();

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weeklyReview = getReviewForPeriod('weekly', weekStart, weekEnd);
  const profile = getProfile();
  const level = calculateLevel(profile.totalXp ?? 0);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpProgress = (profile.totalXp ?? 0) - currentLevelXp;
  const xpNeeded = Math.max(1, nextLevelXp - currentLevelXp);
  const xpProgressPercent = Math.min(100, Math.max(0, (xpProgress / xpNeeded) * 100));

  const openTaskCount = todayTasks.length;
  const habitsDone = completions.length;
  const habitsTotal = habits.length;
  const signalCount = todayMetrics.filter((metric) =>
    ['sleep', 'mood', 'energy'].includes(metric.metricType)
  ).length;
  const todayMood = todayMetrics.find((metric) => metric.metricType === 'mood')?.valueNumeric ?? null;
  const todayEnergy = todayMetrics.find((metric) => metric.metricType === 'energy')?.valueNumeric ?? null;

  const heroNarrative = buildTodayNarrative({
    firstRun,
    openTaskCount,
    completedTaskCount,
    habitsDone,
    habitsTotal,
    inboxCount,
    signalCount,
    hasWeeklyReview: !!weeklyReview,
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <SpatialScene
        as="section"
        intensity={1.05}
        className="motion-reveal relative overflow-hidden rounded-[2.35rem] border border-line-soft bg-gradient-to-br from-[rgba(255,250,243,0.86)] via-[rgba(247,237,223,0.78)] to-[rgba(239,225,206,0.72)] p-6 shadow-hero lg:p-8"
        style={{ '--reveal-delay': '40ms' } as CSSProperties}
      >
        <div className="pointer-events-none absolute -left-12 top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(223,169,103,0.34),rgba(223,169,103,0))]" />
        <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(96,118,96,0.18),rgba(96,118,96,0))]" />
        <div className="pointer-events-none absolute bottom-0 right-[12%] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(188,122,83,0.16),rgba(188,122,83,0))]" />

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <DepthPlane className="h-full" innerClassName="space-y-6 h-full" depth={10} tilt={0.35}>
            <div className="flex flex-wrap items-center gap-2 motion-reveal" style={{ '--reveal-delay': '60ms' } as CSSProperties}>
              <span className="shell-meta-pill">{dayName}</span>
              <span className="shell-meta-pill">{fullDate}</span>
              <span className="shell-meta-pill">
                <Sparkles size={12} />
                {heroNarrative.tone}
              </span>
            </div>

            <div className="max-w-3xl motion-reveal" style={{ '--reveal-delay': '120ms' } as CSSProperties}>
              <div className="section-kicker">Daily Orbit</div>
              <h1 className="mt-3 font-display text-display-lg leading-[0.95] tracking-[-0.05em] text-text-primary">
                {greeting}. Shape the day before the day shapes you.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-text-secondary">
                {heroNarrative.lede} {heroNarrative.supporting}
              </p>
            </div>

            <div className="motion-reveal flex flex-wrap gap-2" style={{ '--reveal-delay': '180ms' } as CSSProperties}>
              {heroNarrative.rituals.map((ritual) => (
                <span key={ritual} className="shell-meta-pill text-text-secondary">
                  {ritual}
                </span>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroStatCard
                label="Open tasks"
                value={String(openTaskCount)}
                caption={
                  completedTaskCount > 0
                    ? `${completedTaskCount} closed today`
                    : openTaskCount > 0
                      ? 'Active work is on deck'
                      : 'The board is clear for now'
                }
                icon={<Target size={18} className="text-brand-600" />}
                delay={220}
              />
              <HeroStatCard
                label="Habit cadence"
                value={habitsTotal > 0 ? `${habitsDone}/${habitsTotal}` : 'Open'}
                caption={
                  habitsTotal > 0
                    ? `${Math.max(0, habitsTotal - habitsDone)} still to check in`
                    : 'No daily rituals yet'
                }
                icon={<Repeat size={18} className="text-accent-moss" />}
                delay={280}
              />
              <HeroStatCard
                label="Inbox drift"
                value={String(inboxCount)}
                caption={inboxCount > 0 ? 'Loose capture waiting to sort' : 'Nothing is stuck in orbit'}
                icon={<Inbox size={18} className="text-accent-clay" />}
                delay={340}
              />
              <HeroStatCard
                label="Week XP"
                value={String(weekly.weeklyXp)}
                caption={`Level ${level} is ${Math.round(xpProgressPercent)}% through`}
                icon={<Star size={18} className="text-accent-brass" />}
                delay={400}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(250px,0.8fr)]">
              <DepthPlane
                className="motion-reveal h-full"
                innerClassName="h-full"
                depth={16}
                tilt={0.7}
                style={{ '--reveal-delay': '450ms' } as CSSProperties}
              >
                <div className="surface-glass motion-sheen-card p-5">
                  <QuickCapture
                    variant="hero"
                    placeholder="Place a task, note, person, idea, or life signal into today..."
                  />
                </div>
              </DepthPlane>

              <DepthPlane
                className="motion-reveal h-full"
                innerClassName="h-full"
                depth={9}
                tilt={0.45}
                style={{ '--reveal-delay': '520ms' } as CSSProperties}
              >
                {firstRun ? (
                  <div className="surface-panel motion-sheen-card h-full p-5">
                    <div className="section-kicker text-[0.63rem]">First Steps</div>
                    <h2 className="mt-2 font-display text-[1.7rem] leading-none tracking-[-0.04em] text-text-primary">
                      Start the room with one honest anchor.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-text-secondary">
                      Once one task, habit, or note exists, the rest of Today can start to feel earned instead of empty.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <GuideAction href="/tasks" label="Add a task" />
                      <GuideAction href="/habits" label="Set up a habit" />
                      <GuideAction href="/journal" label="Write in journal" />
                    </div>
                  </div>
                ) : (
                  <ReflectionCard
                    weeklyReview={weeklyReview}
                    weeklyXp={weekly.weeklyXp}
                    xpProgress={xpProgress}
                    xpNeeded={xpNeeded}
                    level={level}
                  />
                )}
              </DepthPlane>
            </div>
          </DepthPlane>

          <DepthPlane as="aside" className="h-full" innerClassName="space-y-4 h-full" depth={20} tilt={0.85}>
            <div className="surface-obsidian motion-sheen-card overflow-hidden p-5 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xs uppercase tracking-[0.24em] text-text-inverse/58">
                    Day Compass
                  </div>
                  <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.05em] text-text-inverse">
                    Hold the center.
                  </h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-2xs text-text-inverse/70">
                  {heroNarrative.tone}
                </span>
              </div>

              <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-3">
                <TodayOrbitSculpture
                  tone={heroNarrative.tone}
                  completedTaskCount={completedTaskCount}
                  habitsDone={habitsDone}
                  habitsTotal={habitsTotal}
                  signalCount={signalCount}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
                <OrbitDial
                  label="Task flow"
                  progress={completedTaskCount + openTaskCount > 0 ? (completedTaskCount / (completedTaskCount + openTaskCount)) * 100 : 12}
                  primary={completedTaskCount > 0 ? `${completedTaskCount} closed` : 'Open'}
                  secondary={
                    completedTaskCount + openTaskCount > 0
                      ? openTaskCount > 0
                        ? `${openTaskCount} still on deck`
                        : 'the board is clear'
                      : 'no planned tasks'
                  }
                  accent="216 131 74"
                />
                <OrbitDial
                  label="Habit cadence"
                  progress={habitsTotal > 0 ? (habitsDone / habitsTotal) * 100 : 8}
                  primary={habitsTotal > 0 ? `${habitsDone}/${habitsTotal}` : 'Open'}
                  secondary={habitsTotal > 0 ? 'checked in' : 'no daily habits'}
                  accent="95 116 95"
                />
                <OrbitDial
                  label="Signals"
                  progress={(signalCount / 3) * 100}
                  primary={`${signalCount}/3`}
                  secondary={
                    todayMood !== null && todayEnergy !== null
                      ? `mood ${todayMood} · energy ${todayEnergy}`
                      : `${Math.max(0, 3 - signalCount)} missing`
                  }
                  accent="107 134 182"
                />
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-inverse">Level {level}</p>
                    <p className="mt-1 text-xs text-text-inverse/60">
                      {profile.totalXp ?? 0} total XP in the system
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-text-inverse">
                      {xpProgress}/{xpNeeded}
                    </p>
                    <p className="mt-1 text-xs text-text-inverse/60">to level {level + 1}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 transition-all"
                    style={{ width: `${xpProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </DepthPlane>
        </div>
      </SpatialScene>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <MetricQuickLog todayMetrics={todayMetrics} />

        <div className="surface-panel p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="section-kicker text-[0.63rem]">This Week</div>
              <h2 className="mt-2 font-display text-[1.8rem] leading-none tracking-[-0.05em] text-text-primary">
                Watch the pulse, not just the to-do list.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                These signals keep the day connected to the wider rhythm of the week instead of collapsing into isolated task management.
              </p>
            </div>
            <Link href="/insights" className="shell-meta-pill transition-colors hover:text-text-primary">
              Full insights
            </Link>
          </div>

          {firstRun ? (
            <div className="mt-5 rounded-[1.6rem] border border-line-soft bg-surface-0/72 p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-brand-200 bg-brand-50 text-brand-700">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">No weekly pulse yet.</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Once you log a few tasks, habits, or journal entries, this panel will start reading the week back to you with actual texture.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PulseCard
                icon={<Repeat size={18} className="text-accent-moss" />}
                label="Habit rate"
                value={`${weekly.habitRate}%`}
                caption={
                  weekly.bestStreak
                    ? `${weekly.bestStreak.name} is carrying a ${weekly.bestStreak.streak} day streak`
                    : 'Keep the rhythm warmer than the excuses'
                }
                delay={80}
              />
              <PulseCard
                icon={<Zap size={18} className="text-brand-600" />}
                label="Task momentum"
                value={String(weekly.tasksCompleted)}
                caption={`${weekly.tasksCreated} created this week`}
                trend={weekly.taskCompletionTrend}
                delay={140}
              />
              <PulseCard
                icon={<Activity size={18} className="text-accent-clay" />}
                label="Life signals"
                value={
                  weekly.avgMood !== null
                    ? `${weekly.avgMood}${weekly.avgEnergy !== null ? ` / ${weekly.avgEnergy}e` : ''}`
                    : '—'
                }
                caption={
                  weekly.avgSleep !== null
                    ? `${weekly.avgSleep}h average sleep this week`
                    : 'Start logging signals to reveal the pattern'
                }
                delay={200}
              />
              <PulseCard
                icon={<FolderKanban size={18} className="text-[rgb(107,134,182)]" />}
                label="Projects"
                value={String(weekly.activeProjects)}
                caption={
                  weekly.atRiskProjects > 0
                    ? `${weekly.atRiskProjects} need attention soon`
                    : 'No active projects are signaling trouble'
                }
                warning={weekly.atRiskProjects > 0}
                delay={260}
              />
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="surface-panel p-5 lg:p-6">
          <SectionHeader
            kicker="Today’s Work"
            title="Keep the work surface honest."
            description="What belongs to today should feel visible, bounded, and easier to start than to avoid."
            meta={
              completedTaskCount > 0
                ? `${openTaskCount} on deck · ${completedTaskCount} closed today`
                : openTaskCount > 0
                  ? `${openTaskCount} on deck`
                  : 'No active tasks on deck'
            }
          />
          <div className="mt-5">
            <TaskList
              tasks={todayTasks}
              showAddButton={true}
              emptyMessage={
                completedTaskCount > 0
                  ? 'No active tasks are pulling on today right now. Keep the space clear or capture the next meaningful move.'
                  : 'No tasks are anchored to today yet. Add one to give the day shape.'
              }
              variant="today"
            />
          </div>
        </div>

        <div className="surface-panel p-5 lg:p-6">
          <SectionHeader
            kicker="Rhythm"
            title="Keep the rituals warm."
            description="Habits are the quiet architecture underneath the louder work. Let them stay visible here."
            meta={habitsTotal > 0 ? `${habitsDone}/${habitsTotal} complete` : 'No habits yet'}
          />
          <div className="mt-5">
            <HabitChecklist habits={habits} completions={completions} variant="today" />
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroStatCard({
  icon,
  label,
  value,
  caption,
  delay = 0,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
  delay?: number;
}) {
  return (
    <div
      className="surface-glass card-interactive motion-reveal motion-sheen-card overflow-hidden p-4"
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-kicker text-[0.6rem]">{label}</div>
          <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-text-primary">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-text-secondary">{caption}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/70 bg-white/70 shadow-soft">
          {icon}
        </div>
      </div>
    </div>
  );
}

function OrbitDial({
  label,
  progress,
  primary,
  secondary,
  accent,
}: {
  label: string;
  progress: number;
  primary: string;
  secondary: string;
  accent: string;
}) {
  const safeProgress = Math.max(8, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const dialStyle = {
    background: `conic-gradient(rgb(${accent}) ${safeProgress}%, rgba(255,255,255,0.1) ${safeProgress}% 100%)`,
  } as CSSProperties;

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
      <div className="text-2xs uppercase tracking-[0.2em] text-text-inverse/56">{label}</div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full" style={dialStyle}>
          <div className="absolute inset-[10px] rounded-full bg-[rgba(36,29,24,0.92)]" />
          <div className="relative text-center">
            <div className="text-lg font-semibold tracking-[-0.04em] text-text-inverse">{primary}</div>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-inverse">{secondary}</p>
          <p className="mt-1 text-xs leading-5 text-text-inverse/60">
            Progress is shown as signal, not judgement.
          </p>
        </div>
      </div>
    </div>
  );
}

function PulseCard({
  icon,
  label,
  value,
  caption,
  trend,
  warning = false,
  delay = 0,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
  trend?: 'up' | 'down' | 'flat';
  warning?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="surface-glass motion-reveal motion-sheen-card p-4"
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/70 bg-white/70 shadow-soft">
          {icon}
        </div>
        {trend ? <TrendIcon trend={trend} /> : warning ? <AlertTriangle size={14} className="text-amber-600" /> : null}
      </div>
      <div className="mt-4">
        <div className="section-kicker text-[0.6rem]">{label}</div>
        <p className="mt-2 text-[1.65rem] font-semibold leading-none tracking-[-0.04em] text-text-primary">
          {value}
        </p>
        <p className="mt-2 text-xs leading-5 text-text-secondary">{caption}</p>
      </div>
    </div>
  );
}

function ReflectionCard({
  weeklyReview,
  weeklyXp,
  xpProgress,
  xpNeeded,
  level,
}: {
  weeklyReview: ReturnType<typeof getReviewForPeriod>;
  weeklyXp: number;
  xpProgress: number;
  xpNeeded: number;
  level: number;
}) {
  const href = weeklyReview ? `/reviews/${weeklyReview.id}` : '/reviews';

  return (
    <Link href={href} className="surface-panel card-interactive motion-sheen-card block p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="section-kicker text-[0.63rem]">Reflection</div>
          <h2 className="mt-2 font-display text-[1.7rem] leading-none tracking-[-0.05em] text-text-primary">
            {weeklyReview ? 'The weekly review is warm and waiting.' : 'The week wants a closing loop.'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            {weeklyReview
              ? `${weeklyReview.isPublished ? 'Published' : 'Draft'} review ready. Re-enter the thread of the week and pull fresh tasks or goals out of it.`
              : `You earned ${weeklyXp} XP this week. A review now will help convert motion into actual learning instead of drift.`}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-brand-200 bg-brand-50 text-brand-700 shadow-soft">
          <ClipboardList size={18} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-text-secondary">
          Level {level} is {xpProgress}/{xpNeeded} toward the next threshold.
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
          Open review
          <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  );
}

function SectionHeader({
  kicker,
  title,
  description,
  meta,
}: {
  kicker: string;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="section-kicker text-[0.63rem]">{kicker}</div>
        <h2 className="mt-2 font-display text-[1.8rem] leading-none tracking-[-0.05em] text-text-primary">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>
      </div>
      <span className="shell-meta-pill">{meta}</span>
    </div>
  );
}

function GuideAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="card-interactive inline-flex items-center gap-1 rounded-[1rem] border border-line-soft bg-surface-0/72 px-3 py-2 text-sm font-medium text-text-secondary transition-all duration-300 ease-luxury hover:border-brand-300 hover:bg-surface-0"
    >
      {label}
      <ArrowRight size={14} />
    </Link>
  );
}
