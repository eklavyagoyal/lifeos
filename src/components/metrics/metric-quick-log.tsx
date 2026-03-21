'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Check, Moon, Smile, Zap } from 'lucide-react';
import { quickLogMetricsAction } from '@/app/actions';
import { cn } from '@/lib/cn';
import { ENERGY_LABELS, MOOD_LABELS } from '@/lib/constants';

interface TodayMetric {
  metricType: string;
  valueNumeric: number | null;
}

interface MetricQuickLogProps {
  todayMetrics: TodayMetric[];
}

const SCALE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function MetricQuickLog({ todayMetrics }: MetricQuickLogProps) {
  const [sleep, setSleep] = useState('');
  const [mood, setMood] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const existingSleep = todayMetrics.find((metric) => metric.metricType === 'sleep');
  const existingMood = todayMetrics.find((metric) => metric.metricType === 'mood');
  const existingEnergy = todayMetrics.find((metric) => metric.metricType === 'energy');
  const loggedCount = [existingSleep, existingMood, existingEnergy].filter(Boolean).length;
  const canSubmit = !!sleep || mood > 0 || energy > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    await quickLogMetricsAction({
      sleep: sleep ? parseFloat(sleep) : undefined,
      mood: mood || undefined,
      energy: energy || undefined,
    });
    setSaved(true);
    setSubmitting(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="surface-panel overflow-hidden p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="section-kicker text-[0.63rem]">Life Signals</div>
          <h2 className="mt-2 font-display text-[1.8rem] leading-none tracking-[-0.05em] text-text-primary">
            Read the body before you ask it to perform.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Keep today grounded in sleep, mood, and energy so the rest of the system reflects real conditions, not ideal ones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="shell-meta-pill">
            <BarChart3 size={12} />
            {loggedCount}/3 logged
          </span>
          <Link href="/metrics/log" className="shell-meta-pill transition-colors hover:text-text-primary">
            Full log
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <SignalCard
          title="Sleep"
          icon={<Moon size={18} className="text-indigo-500" />}
          accentClass="from-indigo-100/90 to-surface-0"
          loggedValue={existingSleep?.valueNumeric ? `${existingSleep.valueNumeric}h` : null}
          loggedCaption="Already recorded for today"
        >
          {!existingSleep ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                  placeholder="7.5"
                  className="capture-bar max-w-[8rem] bg-surface-0/88 text-center text-base"
                />
                <div className="text-xs text-text-tertiary">
                  Hours slept last night.
                </div>
              </div>
            </div>
          ) : null}
        </SignalCard>

        <SignalCard
          title="Mood"
          icon={<Smile size={18} className="text-amber-500" />}
          accentClass="from-amber-100/90 to-surface-0"
          loggedValue={existingMood?.valueNumeric ? `${existingMood.valueNumeric}/10` : null}
          loggedCaption={
            existingMood?.valueNumeric
              ? MOOD_LABELS[Math.round(existingMood.valueNumeric)] || 'Logged'
              : 'Already recorded for today'
          }
        >
          {!existingMood ? (
            <ScaleSelector
              value={mood}
              onChange={setMood}
              description={mood > 0 ? `${mood} — ${MOOD_LABELS[mood]}` : 'Choose how the day feels right now.'}
              activeClass="bg-amber-500 text-white border-amber-500"
            />
          ) : null}
        </SignalCard>

        <SignalCard
          title="Energy"
          icon={<Zap size={18} className="text-emerald-500" />}
          accentClass="from-emerald-100/90 to-surface-0"
          loggedValue={existingEnergy?.valueNumeric ? `${existingEnergy.valueNumeric}/10` : null}
          loggedCaption={
            existingEnergy?.valueNumeric
              ? ENERGY_LABELS[Math.round(existingEnergy.valueNumeric)] || 'Logged'
              : 'Already recorded for today'
          }
        >
          {!existingEnergy ? (
            <ScaleSelector
              value={energy}
              onChange={setEnergy}
              description={energy > 0 ? `${energy} — ${ENERGY_LABELS[energy]}` : 'How much fuel is actually available today?'}
              activeClass="bg-emerald-600 text-white border-emerald-600"
            />
          ) : null}
        </SignalCard>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-[1.5rem] border border-line-soft bg-surface-0/60 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        {saved ? (
          <div className="flex items-center gap-2 text-sm font-medium text-status-success">
            <Check size={18} />
            Today’s signals are recorded.
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-text-primary">Log what is true, then plan from there.</p>
            <p className="mt-1 text-xs text-text-secondary">
              Only missing signals are editable. Existing values stay visible so the panel remains a calm dashboard after logging.
            </p>
          </div>
        )}

        {!saved ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="rounded-[1rem] bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Saving…' : 'Log signals'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SignalCard({
  title,
  icon,
  accentClass,
  loggedValue,
  loggedCaption,
  children,
}: {
  title: string;
  icon: ReactNode;
  accentClass: string;
  loggedValue: string | null;
  loggedCaption: string;
  children: ReactNode;
}) {
  const isLogged = !!loggedValue;

  return (
    <div
      className={cn(
        'rounded-[1.55rem] border border-line-soft bg-gradient-to-br p-4 shadow-soft',
        accentClass,
        isLogged && 'ring-1 ring-[rgba(174,93,44,0.08)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-kicker text-[0.6rem]">{title}</div>
          <h3 className="mt-2 text-lg font-semibold text-text-primary">
            {loggedValue ?? `Log ${title.toLowerCase()}`}
          </h3>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {loggedCaption}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/70 bg-white/70 shadow-soft">
          {icon}
        </div>
      </div>

      {!isLogged ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function ScaleSelector({
  value,
  onChange,
  description,
  activeClass,
}: {
  value: number;
  onChange: (value: number) => void;
  description: string;
  activeClass: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-text-secondary">{description}</p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {SCALE_VALUES.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(value === entry ? 0 : entry)}
            className={cn(
              'flex h-9 items-center justify-center rounded-xl border text-xs font-semibold transition-all duration-200',
              value === entry
                ? activeClass
                : 'border-line-soft bg-surface-0/74 text-text-secondary hover:border-brand-300 hover:bg-surface-hover'
            )}
          >
            {entry}
          </button>
        ))}
      </div>
    </div>
  );
}
