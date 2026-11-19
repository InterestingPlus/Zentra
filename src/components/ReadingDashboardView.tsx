import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Plus,
  SlidersHorizontal,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import type {
  CatalogData,
  PersonalDatabase,
  YearlyReadingGoal,
} from '../types/zentra';
import {
  computeYearlyDashboardData,
  getAvailableYears,
  getYearlyGoalForYear,
  toDateKey,
  type ReadingStatsSummary,
} from '../utils/analyticsLogic';

interface ReadingDashboardViewProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  stats: ReadingStatsSummary;
  onUpdateYearlyGoal: (goal: YearlyReadingGoal) => void;
  onLogManualSession: (input: {
    bookId: string;
    durationMinutes: number;
    pagesRead: number;
    dateKey: string;
    markCompleted: boolean;
  }) => void;
  onOpenReminders: () => void;
}

type TrendChartView = 'cumulative' | 'monthly' | 'daily30';
type TrendMetric = 'pages' | 'hours' | 'books';

function formatDuration(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export const ReadingDashboardView: React.FC<ReadingDashboardViewProps> = ({
  catalog,
  db,
  stats,
  onUpdateYearlyGoal,
  onLogManualSession,
  onOpenReminders,
}) => {
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(
    () =>
      getAvailableYears(
        db.sessions,
        db.progressByBook,
        db.settings.reminders.yearlyGoals
      ),
    [db.sessions, db.progressByBook, db.settings.reminders.yearlyGoals]
  );

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [chartView, setChartView] = useState<TrendChartView>('cumulative');
  const [metric, setMetric] = useState<TrendMetric>('pages');
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);

  const activeGoal = useMemo(
    () => getYearlyGoalForYear(db.settings.reminders.yearlyGoals, selectedYear),
    [db.settings.reminders.yearlyGoals, selectedYear]
  );

  const yearly = useMemo(
    () =>
      computeYearlyDashboardData(
        db.sessions,
        db.progressByBook,
        catalog,
        selectedYear,
        activeGoal
      ),
    [db.sessions, db.progressByBook, catalog, selectedYear, activeGoal]
  );

  // Goal editor state
  const [draftBooks, setDraftBooks] = useState(String(activeGoal.targetBooks));
  const [draftPages, setDraftPages] = useState(String(activeGoal.targetPages));
  const [draftHours, setDraftHours] = useState(String(activeGoal.targetHours));
  const [goalError, setGoalError] = useState<string | null>(null);

  useEffect(() => {
    setDraftBooks(String(activeGoal.targetBooks));
    setDraftPages(String(activeGoal.targetPages));
    setDraftHours(String(activeGoal.targetHours));
    setGoalError(null);
  }, [activeGoal]);

  // Manual session logger state
  const [logBookId, setLogBookId] = useState<string>(catalog.books[0]?.id ?? '');
  const [logDate, setLogDate] = useState<string>(toDateKey(new Date()));
  const [logMinutes, setLogMinutes] = useState<string>('30');
  const [logPages, setLogPages] = useState<string>('24');
  const [logCompleted, setLogCompleted] = useState<boolean>(false);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    if (!logBookId && catalog.books[0]) {
      setLogBookId(catalog.books[0].id);
    }
  }, [catalog.books, logBookId]);

  const isDark = useIsDarkTheme();
  const chartColors = useMemo(
    () => ({
      grid: isDark ? '#1E293B' : '#E2E8F0',
      tick: isDark ? '#94A3B8' : '#64748B',
      primary: isDark ? '#3B82F6' : '#1D4ED8',
      primaryFillStart: isDark ? 'rgba(59, 130, 246, 0.34)' : 'rgba(29, 78, 216, 0.22)',
      primaryFillEnd: isDark ? 'rgba(59, 130, 246, 0.02)' : 'rgba(29, 78, 216, 0.01)',
      paceLine: isDark ? '#94A3B8' : '#64748B',
      secondary: isDark ? '#10B981' : '#059669',
      tooltipBg: isDark ? '#0F172A' : '#FFFFFF',
      tooltipBorder: isDark ? '#334155' : '#E2E8F0',
      tooltipText: isDark ? '#F8FAFC' : '#0F172A',
      tooltipMuted: isDark ? '#94A3B8' : '#64748B',
    }),
    [isDark]
  );

  const handleSaveGoals = (e: React.FormEvent) => {
    e.preventDefault();
    const targetBooks = Number(draftBooks);
    const targetPages = Number(draftPages);
    const targetHours = Number(draftHours);

    if (
      !Number.isFinite(targetBooks) ||
      targetBooks < 1 ||
      targetBooks > 500
    ) {
      setGoalError('Enter a yearly books target between 1 and 500.');
      return;
    }
    if (
      !Number.isFinite(targetPages) ||
      targetPages < 50 ||
      targetPages > 100000
    ) {
      setGoalError('Enter a yearly pages target between 50 and 100,000.');
      return;
    }
    if (
      !Number.isFinite(targetHours) ||
      targetHours < 1 ||
      targetHours > 5000
    ) {
      setGoalError('Enter a yearly reading hours target between 1 and 5,000.');
      return;
    }

    onUpdateYearlyGoal({
      year: selectedYear,
      targetBooks: Math.round(targetBooks),
      targetPages: Math.round(targetPages),
      targetHours: Math.round(targetHours),
    });
    setGoalError(null);
    setShowGoalEditor(false);
  };

  const handleSubmitSession = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Number(logMinutes);
    const pages = Number(logPages);

    if (!logBookId) {
      setLogError('Choose a book from your library.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
      setLogError('Choose a valid session date.');
      return;
    }
    if (!Number.isFinite(mins) || mins < 1 || mins > 720) {
      setLogError('Enter reading duration between 1 and 720 minutes.');
      return;
    }
    if (!Number.isFinite(pages) || pages < 0 || pages > 2000) {
      setLogError('Enter pages read between 0 and 2,000.');
      return;
    }

    onLogManualSession({
      bookId: logBookId,
      durationMinutes: Math.round(mins),
      pagesRead: Math.round(pages),
      dateKey: logDate,
      markCompleted: logCompleted,
    });

    const loggedYear = Number(logDate.slice(0, 4));
    if (Number.isInteger(loggedYear) && loggedYear !== selectedYear) {
      setSelectedYear(loggedYear);
    }

    setLogError(null);
    setLogCompleted(false);
    setShowLogForm(false);
  };

  const paceLabel =
    yearly.paceStatus === 'ahead'
      ? 'Ahead of yearly pace'
      : yearly.paceStatus === 'on_track'
        ? 'On track with yearly pace'
        : 'Behind yearly pace';

  const paceToneClass =
    yearly.paceStatus === 'ahead'
      ? 'text-emerald-700 dark:text-emerald-400'
      : yearly.paceStatus === 'on_track'
        ? 'text-blue-700 dark:text-blue-400'
        : 'text-amber-700 dark:text-amber-400';

  const metricConfig = useMemo(() => {
    if (metric === 'hours') {
      return {
        label: 'Reading Hours',
        unit: 'hrs',
        actualKey: 'cumulativeHours' as const,
        targetKey: 'targetCumulativeHours' as const,
        monthlyKey: 'hours' as const,
        monthlyTarget: yearly.monthlyTargetHours,
        yearlyTarget: yearly.goal.targetHours,
      };
    }
    if (metric === 'books') {
      return {
        label: 'Books Completed',
        unit: 'books',
        actualKey: 'cumulativeBooks' as const,
        targetKey: 'targetCumulativeBooks' as const,
        monthlyKey: 'booksCompleted' as const,
        monthlyTarget: yearly.monthlyTargetBooks,
        yearlyTarget: yearly.goal.targetBooks,
      };
    }
    return {
      label: 'Pages Read',
      unit: 'pages',
      actualKey: 'cumulativePages' as const,
      targetKey: 'targetCumulativePages' as const,
      monthlyKey: 'pages' as const,
      monthlyTarget: yearly.monthlyTargetPages,
      yearlyTarget: yearly.goal.targetPages,
    };
  }, [metric, yearly]);

  const minSelectableYear = Math.min(...availableYears, currentYear - 1);
  const maxSelectableYear = Math.max(...availableYears, currentYear);

  const hasYearData =
    yearly.sessionsCount > 0 || yearly.booksCompleted > 0 || yearly.pagesRead > 0;

  return (
    <div className="space-y-6" data-testid="reading-dashboard">
      {/* Dashboard Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white text-balance">
            Reading Progress Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono-tabular font-medium text-slate-700 dark:text-slate-300">
              {selectedYear} Annual Tracker
            </span>
            <span aria-hidden="true">·</span>
            <span className={`font-medium ${paceToneClass}`}>{paceLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {yearly.daysRemainingInYear > 0
                ? `${yearly.daysRemainingInYear} days left in ${selectedYear}`
                : `${selectedYear} archive complete`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Selector */}
          <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] h-[44px]">
            <button
              type="button"
              onClick={() => setSelectedYear((y) => Math.max(minSelectableYear - 1, y - 1))}
              aria-label="Previous year"
              className="w-10 h-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-l-xl"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              className="px-2.5 font-mono-tabular text-sm font-semibold text-slate-900 dark:text-white select-none"
              data-testid="selected-year-label"
            >
              {selectedYear}
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear((y) => Math.min(maxSelectableYear + 1, y + 1))}
              aria-label="Next year"
              className="w-10 h-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-r-xl"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowGoalEditor((v) => !v);
              setShowLogForm(false);
            }}
            aria-expanded={showGoalEditor}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Edit Goals</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowLogForm((v) => !v);
              setShowGoalEditor(false);
            }}
            aria-expanded={showLogForm}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Log Session</span>
          </button>
        </div>
      </header>

      {/* Collapsible Yearly Goals Editor */}
      {showGoalEditor && (
        <section
          aria-label={`Edit ${selectedYear} reading goals`}
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                {selectedYear} Yearly Reading Targets
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adjusting targets updates your cumulative pace line and year-end projections immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGoalEditor(false)}
              aria-label="Close goal editor"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveGoals} className="grid sm:grid-cols-3 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Books target ({selectedYear})
              </span>
              <input
                type="number"
                min={1}
                max={500}
                value={draftBooks}
                onChange={(e) => setDraftBooks(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D1117] text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Pages target ({selectedYear})
              </span>
              <input
                type="number"
                min={50}
                max={100000}
                step={50}
                value={draftPages}
                onChange={(e) => setDraftPages(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D1117] text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Reading hours target ({selectedYear})
              </span>
              <input
                type="number"
                min={1}
                max={5000}
                value={draftHours}
                onChange={(e) => setDraftHours(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D1117] text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            {goalError && (
              <p className="sm:col-span-3 text-xs text-rose-600 dark:text-rose-400">
                {goalError}
              </p>
            )}

            <div className="sm:col-span-3 flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowGoalEditor(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                Save Goals
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Collapsible Reading Session Logger */}
      {showLogForm && (
        <section
          aria-label="Log a reading session"
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Log Reading Session
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Record print, offline, or PDF reading time directly into your personal timeline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogForm(false)}
              aria-label="Close session logger"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitSession} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block space-y-1.5 sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Book</span>
              <select
                value={logBookId}
                onChange={(e) => setLogBookId(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D1117] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {catalog.books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Date</span>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D1117] text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Minutes read
              </span>
              <input
                type="number"
                min={1}
                max={720}
                value={logMinutes}
                onChange={(e) => setLogMinutes(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D1117] text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Pages read
              </span>
              <input
                type="number"
                min={0}
                max={2000}
                value={logPages}
                onChange={(e) => setLogPages(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D1117] text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </label>

            <div className="sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer min-h-[40px]">
                <input
                  type="checkbox"
                  checked={logCompleted}
                  onChange={(e) => setLogCompleted(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>Mark this book as completed on the selected date</span>
              </label>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowLogForm(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Session
                </button>
              </div>
            </div>

            {logError && (
              <p className="sm:col-span-2 lg:col-span-4 text-xs text-rose-600 dark:text-rose-400">
                {logError}
              </p>
            )}
          </form>
        </section>
      )}

      {/* Section 1 — Focal Anchor: Yearly Goal Progress & Pace Tracker */}
      <section
        aria-label={`${selectedYear} Yearly Goal Progress`}
        className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              {selectedYear} Yearly Reading Goals
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Vertical marker indicates linear pace at {yearly.yearElapsedPct}% of the year elapsed.
            </p>
          </div>
          <div className="text-xs font-mono-tabular text-slate-600 dark:text-slate-400">
            Active days: <strong className="text-slate-900 dark:text-white">{yearly.activeDays}</strong>
            {' · '}
            Sessions: <strong className="text-slate-900 dark:text-white">{yearly.sessionsCount}</strong>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:divide-x md:divide-slate-200/80 dark:md:divide-slate-800">
          {/* Books Goal */}
          <div className="space-y-3 md:pr-2" data-testid="yearly-goal-books">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Books Completed
              </span>
              <span className="font-mono-tabular text-xs font-semibold text-blue-700 dark:text-blue-400">
                {yearly.booksPct}%
              </span>
            </div>
            <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              {yearly.booksCompleted}
              <span className="text-base font-normal text-slate-400 dark:text-slate-500">
                {' '}
                / {yearly.goal.targetBooks}
              </span>
            </p>
            <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-visible">
              <div
                className="h-full rounded-full bg-blue-700 dark:bg-blue-500 transition-all duration-300"
                style={{ width: `${yearly.booksPct}%` }}
              />
              {yearly.yearElapsedPct > 0 && yearly.yearElapsedPct < 100 && (
                <div
                  title={`Expected pace today: ${yearly.expectedBooksByNow} books`}
                  className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-slate-500 dark:bg-slate-300 rounded-full"
                  style={{ left: `${yearly.yearElapsedPct}%` }}
                />
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
              Pace target: {yearly.expectedBooksByNow} · Proj: {yearly.projectedBooksYearEnd}{' '}
              {yearly.projectedBooksYearEnd === 1 ? 'book' : 'books'}
            </p>
          </div>

          {/* Pages Goal */}
          <div className="space-y-3 md:pl-6 md:pr-2" data-testid="yearly-goal-pages">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Pages Read
              </span>
              <span className="font-mono-tabular text-xs font-semibold text-blue-700 dark:text-blue-400">
                {yearly.pagesPct}%
              </span>
            </div>
            <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              {yearly.pagesRead.toLocaleString()}
              <span className="text-base font-normal text-slate-400 dark:text-slate-500">
                {' '}
                / {yearly.goal.targetPages.toLocaleString()}
              </span>
            </p>
            <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-visible">
              <div
                className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
                style={{ width: `${yearly.pagesPct}%` }}
              />
              {yearly.yearElapsedPct > 0 && yearly.yearElapsedPct < 100 && (
                <div
                  title={`Expected pace today: ${yearly.expectedPagesByNow.toLocaleString()} pages`}
                  className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-slate-500 dark:bg-slate-300 rounded-full"
                  style={{ left: `${yearly.yearElapsedPct}%` }}
                />
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
              Pace target: {yearly.expectedPagesByNow.toLocaleString()} · Proj:{' '}
              {yearly.projectedPagesYearEnd.toLocaleString()}p
            </p>
          </div>

          {/* Hours Goal */}
          <div className="space-y-3 md:pl-6" data-testid="yearly-goal-hours">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Reading Hours
              </span>
              <span className="font-mono-tabular text-xs font-semibold text-blue-700 dark:text-blue-400">
                {yearly.hoursPct}%
              </span>
            </div>
            <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              {yearly.hoursRead}
              <span className="text-base font-normal text-slate-400 dark:text-slate-500">
                {' '}
                / {yearly.goal.targetHours}h
              </span>
            </p>
            <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-visible">
              <div
                className="h-full rounded-full bg-amber-600 dark:bg-amber-500 transition-all duration-300"
                style={{ width: `${yearly.hoursPct}%` }}
              />
              {yearly.yearElapsedPct > 0 && yearly.yearElapsedPct < 100 && (
                <div
                  title={`Expected pace today: ${yearly.expectedHoursByNow} hours`}
                  className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-slate-500 dark:bg-slate-300 rounded-full"
                  style={{ left: `${yearly.yearElapsedPct}%` }}
                />
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
              Pace target: {yearly.expectedHoursByNow}h · Proj: {yearly.projectedHoursYearEnd}h
            </p>
          </div>
        </div>
      </section>

      {/* Section 2 — Primary Interactive Trend Chart */}
      <section
        aria-label="Reading Progress Trends Chart"
        className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              {chartView === 'cumulative'
                ? `${selectedYear} Cumulative ${metricConfig.label} vs. Goal Pace`
                : chartView === 'monthly'
                  ? `${selectedYear} Monthly ${metricConfig.label}`
                  : 'Last 30 Days Reading Activity'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {chartView === 'cumulative'
                ? `Solid line shows your actual ${selectedYear} progress; dashed line shows steady pace toward ${metricConfig.yearlyTarget.toLocaleString()} ${metricConfig.unit}.`
                : chartView === 'monthly'
                  ? `Month-by-month output compared against your ${metricConfig.monthlyTarget.toLocaleString()} ${metricConfig.unit}/month benchmark.`
                  : `Daily minutes read across the past 30 days against your ${stats.dailyGoalMinutes}m daily goal.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chart Mode Segmented Control */}
            <div
              role="group"
              aria-label="Trend view mode"
              className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900"
            >
              {(
                [
                  { id: 'cumulative', label: 'Yearly Pace' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'daily30', label: '30 Days' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChartView(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[34px] whitespace-nowrap transition-colors ${
                    chartView === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Metric Switcher for Yearly Charts */}
            {chartView !== 'daily30' && (
              <div
                role="group"
                aria-label="Chart metric"
                className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900"
              >
                {(
                  [
                    { id: 'pages', label: 'Pages' },
                    { id: 'hours', label: 'Hours' },
                    { id: 'books', label: 'Books' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetric(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[34px] whitespace-nowrap transition-colors ${
                      metric === m.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inline Series Legend for Cumulative vs. Goal Pace */}
        {chartView === 'cumulative' && (
          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span
                className="w-4 h-0.5 rounded-full bg-blue-700 dark:bg-blue-500 inline-block"
                aria-hidden="true"
              />
              <span>Actual cumulative ({metricConfig.unit})</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className="w-4 h-0 border-t-2 border-dashed border-slate-500 dark:border-slate-400 inline-block"
                aria-hidden="true"
              />
              <span>Yearly goal pace ({metricConfig.yearlyTarget.toLocaleString()} {metricConfig.unit})</span>
            </span>
          </div>
        )}

        {/* Chart Viewport */}
        <div className="h-72 sm:h-80 w-full" data-testid="primary-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'cumulative' ? (
              <ComposedChart
                data={yearly.monthlyTrend}
                margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="zentraCumulativeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={chartColors.grid}
                />
                <XAxis
                  dataKey="monthLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartColors.tick, fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tick={{ fill: chartColors.tick, fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    borderColor: chartColors.tooltipBorder,
                    borderRadius: 12,
                    fontSize: 12,
                    color: chartColors.tooltipText,
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey={metricConfig.targetKey}
                  name={`Goal Pace (${metricConfig.unit})`}
                  stroke={chartColors.paceLine}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey={metricConfig.actualKey}
                  name={`Actual Cumulative (${metricConfig.unit})`}
                  stroke={chartColors.primary}
                  strokeWidth={2.5}
                  fill="url(#zentraCumulativeFill)"
                  dot={{ r: 3, fill: chartColors.primary, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            ) : chartView === 'monthly' ? (
              <BarChart
                data={yearly.monthlyTrend}
                margin={{ top: 14, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={chartColors.grid}
                />
                <XAxis
                  dataKey="monthLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartColors.tick, fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={[
                    0,
                    (dataMax: number) =>
                      Math.ceil(Math.max(dataMax, metricConfig.monthlyTarget, 1) * 1.15),
                  ]}
                  tick={{ fill: chartColors.tick, fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    borderColor: chartColors.tooltipBorder,
                    borderRadius: 12,
                    fontSize: 12,
                    color: chartColors.tooltipText,
                  }}
                />
                <ReferenceLine
                  y={metricConfig.monthlyTarget}
                  stroke={chartColors.paceLine}
                  strokeDasharray="5 5"
                  label={{
                    value: `Monthly Target (${metricConfig.monthlyTarget})`,
                    position: 'insideTopRight',
                    fill: chartColors.tick,
                    fontSize: 11,
                  }}
                />
                <Bar
                  dataKey={metricConfig.monthlyKey}
                  name={`${metricConfig.label} (${metricConfig.unit})`}
                  fill={chartColors.primary}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              </BarChart>
            ) : (
              <AreaChart
                data={stats.monthlyActivity}
                margin={{ top: 14, right: 16, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="zentraDailyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={chartColors.grid}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                  tick={{ fill: chartColors.tick, fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  domain={[
                    0,
                    (dataMax: number) =>
                      Math.ceil(Math.max(dataMax, stats.dailyGoalMinutes, 10) * 1.15),
                  ]}
                  tick={{ fill: chartColors.tick, fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    borderColor: chartColors.tooltipBorder,
                    borderRadius: 12,
                    fontSize: 12,
                    color: chartColors.tooltipText,
                  }}
                />
                <ReferenceLine
                  y={stats.dailyGoalMinutes}
                  stroke={chartColors.secondary}
                  strokeDasharray="4 4"
                  label={{
                    value: `Daily Goal (${stats.dailyGoalMinutes}m)`,
                    position: 'insideTopRight',
                    fill: chartColors.secondary,
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  name="Minutes Read"
                  stroke={chartColors.primary}
                  strokeWidth={2}
                  fill="url(#zentraDailyFill)"
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Helpful prompt when selected year has no logged sessions yet */}
        {!hasYearData && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>
              No reading sessions logged for {selectedYear} yet. Open any book in Zentra or log a session to plot your actual trend curve against your goal pace.
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowLogForm(true)}
                className="font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Log first session
              </button>
              <span aria-hidden="true">·</span>
              <Link
                to="/library"
                className="font-medium text-slate-700 dark:text-slate-300 hover:underline whitespace-nowrap"
              >
                Browse library
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Section 3 — Secondary Split Grid: Consistency Chart + Discipline Breakdown */}
      <section className="grid lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Active Days Chart */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Monthly Reading Consistency
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Active reading days per month in {selectedYear}
              </p>
            </div>
            {yearly.bestMonthLabel && (
              <span className="text-xs font-mono-tabular text-slate-600 dark:text-slate-400">
                Peak month:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {yearly.bestMonthLabel}
                </strong>
                {yearly.bestMonthPages > 0 && ` (${yearly.bestMonthPages}p)`}
              </span>
            )}
          </div>

          <div className="h-56 w-full" data-testid="consistency-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={yearly.monthlyTrend}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={chartColors.grid}
                />
                <XAxis
                  dataKey="monthLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartColors.tick, fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartColors.tick, fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    borderColor: chartColors.tooltipBorder,
                    borderRadius: 12,
                    fontSize: 12,
                    color: chartColors.tooltipText,
                  }}
                />
                <Bar
                  dataKey="activeDays"
                  name="Active Days"
                  fill={chartColors.secondary}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={26}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category / Discipline Breakdown */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              {selectedYear} Discipline Focus
            </h2>
            <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
              {yearly.categoryBreakdown.length}{' '}
              {yearly.categoryBreakdown.length === 1 ? 'discipline' : 'disciplines'}
            </span>
          </div>

          {yearly.categoryBreakdown.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <BookOpen className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No disciplines recorded in {selectedYear} yet.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Reading sessions and completed titles automatically populate your category balance.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {yearly.categoryBreakdown.slice(0, 6).map((cat) => {
                const maxVal = Math.max(
                  ...yearly.categoryBreakdown.map((c) => c.pages || c.minutes || c.booksCount),
                  1
                );
                const val = cat.pages || cat.minutes || cat.booksCount;
                const pct = Math.round((val / maxVal) * 100);
                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {cat.category}
                      </span>
                      <span className="font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0">
                        {cat.pages > 0 ? `${cat.pages}p · ` : ''}
                        {cat.minutes > 0 ? `${cat.hours}h · ` : ''}
                        {cat.booksCount} {cat.booksCount === 1 ? 'book' : 'books'}
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

      {/* Section 4 — Habit & All-Time Metrics Strip */}
      <section
        aria-label="Habit and Lifetime Reading Summary"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
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
            <span>Lifetime Reading</span>
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
            <span>Daily Goal Rate</span>
            <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-white">
            {stats.dailyGoalCompletionRate}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
            Today: {stats.todayMinutesRead} / {stats.dailyGoalMinutes}m
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Library Progress</span>
            <TrendingUp className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          </div>
          <p className="font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-white">
            {stats.completedCount} / {stats.totalCatalogBooks}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
            {stats.currentlyReadingCount} active · {stats.wantToReadCount} queued
          </p>
        </div>
      </section>

      {/* Section 5 — Milestones & Reminder Settings Link */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Reading Milestones
          </h2>
          <button
            type="button"
            onClick={onOpenReminders}
            className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5 w-fit"
          >
            <Calendar className="w-3.5 h-3.5" />
            Configure daily reminders & quiet hours
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.achievements.map((badge) => (
            <div
              key={badge.id}
              className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                badge.unlocked
                  ? 'bg-white dark:bg-[#161B22] border-blue-200 dark:border-blue-900'
                  : 'bg-slate-50/70 dark:bg-[#12161E] border-slate-200/70 dark:border-slate-800/70 opacity-80'
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
