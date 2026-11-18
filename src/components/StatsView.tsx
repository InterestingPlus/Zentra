import React, { useState } from 'react';
import { Award, BookCheck, Clock, Flame, Target } from 'lucide-react';
import type { ReadingStatsSummary } from '../utils/analyticsLogic';

interface StatsViewProps {
  stats: ReadingStatsSummary;
  onOpenReminders: () => void;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export const StatsView: React.FC<StatsViewProps> = ({ stats, onOpenReminders }) => {
  const [chartRange, setChartRange] = useState<'weekly' | 'monthly'>('weekly');
  const activeSeries = chartRange === 'weekly' ? stats.weeklyActivity : stats.monthlyActivity;
  const maxMinutes = Math.max(stats.dailyGoalMinutes, ...activeSeries.map((p) => p.minutes), 10);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">
            Reading Statistics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generated strictly from genuine active reading sessions recorded on your device.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenReminders}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap w-fit"
        >
          Configure Goals & Reminders
        </button>
      </div>

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Reading Time</span>
            <Clock className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          </div>
          <p className="font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-white">
            {formatDuration(stats.totalSecondsRead)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
            Avg {stats.averageDailyMinutes}m / active day
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Current Streak</span>
            <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-white">
            {stats.currentStreakDays}d
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
            Longest: {stats.longestStreakDays} days
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pages & Books</span>
            <BookCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-white">
            {stats.totalPagesRead}p
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
            {stats.completedCount} completed · {stats.currentlyReadingCount} active
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Goal Completion</span>
            <Target className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          </div>
          <p className="font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-white">
            {stats.dailyGoalCompletionRate}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
            Today: {stats.todayMinutesRead}/{stats.dailyGoalMinutes}m
          </p>
        </div>
      </section>

      {/* Catalog & Library Breakdown Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center">
        <div>
          <span className="font-mono-tabular text-lg font-semibold text-slate-900 dark:text-white block">
            {stats.totalCatalogBooks}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Catalog Books</span>
        </div>
        <div>
          <span className="font-mono-tabular text-lg font-semibold text-slate-900 dark:text-white block">
            {stats.currentlyReadingCount}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Reading</span>
        </div>
        <div>
          <span className="font-mono-tabular text-lg font-semibold text-slate-900 dark:text-white block">
            {stats.wantToReadCount}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Want to Read</span>
        </div>
        <div>
          <span className="font-mono-tabular text-lg font-semibold text-slate-900 dark:text-white block">
            {stats.completedCount}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Completed</span>
        </div>
      </section>

      {/* Activity Chart & Category Distribution */}
      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Reading Activity
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Minutes read per day against your {stats.dailyGoalMinutes}m goal
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setChartRange('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[34px] ${
                  chartRange === 'weekly'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setChartRange('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[34px] ${
                  chartRange === 'monthly'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          <div className="h-48 flex items-end gap-1.5 sm:gap-2.5 pt-4 border-b border-slate-200 dark:border-slate-800 pb-2 relative">
            {activeSeries.map((pt, idx) => {
              const heightPct = Math.round((pt.minutes / maxMinutes) * 100);
              const metGoal = pt.minutes >= stats.dailyGoalMinutes;
              return (
                <div
                  key={pt.dateKey}
                  className="flex-1 h-full flex flex-col justify-end items-center gap-1 group"
                  title={`${pt.dateKey}: ${pt.minutes}m (${pt.pages} pages)`}
                >
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      className={`w-full max-w-[32px] rounded-t-md transition-all duration-300 ${
                        metGoal
                          ? 'bg-blue-700 dark:bg-blue-500'
                          : pt.minutes > 0
                            ? 'bg-blue-300 dark:bg-blue-800'
                            : 'bg-slate-100 dark:bg-slate-800/80'
                      }`}
                      style={{ height: `${Math.max(4, heightPct)}%` }}
                    />
                  </div>
                  {(chartRange === 'weekly' || idx % 5 === 0) && (
                    <span className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400 truncate max-w-full">
                      {pt.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Category Focus
          </h2>
          {stats.categoryDistribution.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Start reading a book to see your discipline distribution here.
            </p>
          ) : (
            <div className="space-y-3.5">
              {stats.categoryDistribution.slice(0, 6).map((cat) => {
                const maxCat = Math.max(
                  ...stats.categoryDistribution.map((c) => c.minutes || c.booksCount),
                  1
                );
                const val = cat.minutes || cat.booksCount;
                const pct = Math.round((val / maxCat) * 100);
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {cat.category}
                      </span>
                      <span className="font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0">
                        {cat.minutes}m · {cat.booksCount}b
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-700 dark:bg-blue-500 rounded-full"
                        style={{ width: `${Math.max(8, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Achievements */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Milestones & Achievements
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.achievements.map((badge) => (
            <div
              key={badge.id}
              className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                badge.unlocked
                  ? 'bg-white dark:bg-[#161B22] border-blue-200 dark:border-blue-900'
                  : 'bg-slate-50/70 dark:bg-[#12161E] border-slate-200/70 dark:border-slate-800/70 opacity-75'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  badge.unlocked
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {badge.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {badge.description}
                </p>
                <p className="text-[11px] font-mono-tabular text-blue-700 dark:text-blue-400 mt-1.5 font-medium">
                  {badge.unlocked ? 'Unlocked' : badge.progressLabel}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
