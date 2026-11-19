import type {
  CatalogData,
  GoalAndReminderSettings,
  PersonalDatabase,
  ReadingProgress,
  ReadingSession,
  YearlyReadingGoal,
  ZentraBackupPayload,
} from '../types/zentra';

export interface DailyActivityPoint {
  dateKey: string;
  label: string;
  minutes: number;
  pages: number;
}

export interface CategoryDistributionItem {
  category: string;
  minutes: number;
  booksCount: number;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressLabel: string;
}

export interface ReadingStatsSummary {
  totalCatalogBooks: number;
  currentlyReadingCount: number;
  completedCount: number;
  wantToReadCount: number;
  totalPagesRead: number;
  totalSecondsRead: number;
  todayMinutesRead: number;
  averageDailyMinutes: number;
  currentStreakDays: number;
  longestStreakDays: number;
  dailyGoalMinutes: number;
  dailyGoalCompletionRate: number;
  weeklyActivity: DailyActivityPoint[];
  monthlyActivity: DailyActivityPoint[];
  categoryDistribution: CategoryDistributionItem[];
  achievements: AchievementBadge[];
}

export interface MonthlyTrendPoint {
  monthIndex: number; // 0..11
  monthKey: string; // YYYY-MM
  monthLabel: string; // Jan..Dec
  minutes: number;
  hours: number;
  pages: number;
  booksCompleted: number;
  sessionsCount: number;
  activeDays: number;
  cumulativePages: number;
  cumulativeHours: number;
  cumulativeBooks: number;
  targetCumulativePages: number;
  targetCumulativeHours: number;
  targetCumulativeBooks: number;
}

export type YearlyPaceStatus = 'ahead' | 'on_track' | 'behind';

export interface YearlyCategoryStat {
  category: string;
  minutes: number;
  hours: number;
  pages: number;
  booksCount: number;
}

export interface YearlyDashboardData {
  year: number;
  goal: YearlyReadingGoal;
  booksCompleted: number;
  pagesRead: number;
  minutesRead: number;
  hoursRead: number;
  sessionsCount: number;
  activeDays: number;
  booksPct: number;
  pagesPct: number;
  hoursPct: number;
  yearElapsedPct: number;
  expectedBooksByNow: number;
  expectedPagesByNow: number;
  expectedHoursByNow: number;
  paceStatus: YearlyPaceStatus;
  paceDeltaBooks: number;
  projectedBooksYearEnd: number;
  projectedPagesYearEnd: number;
  projectedHoursYearEnd: number;
  daysRemainingInYear: number;
  monthlyTargetPages: number;
  monthlyTargetHours: number;
  monthlyTargetBooks: number;
  bestMonthLabel: string | null;
  bestMonthPages: number;
  monthlyTrend: MonthlyTrendPoint[];
  categoryBreakdown: YearlyCategoryStat[];
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, deltaDays: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + deltaDays);
  return copy;
}

export function computeReadingStats(
  sessions: ReadingSession[],
  progressMap: Record<string, ReadingProgress>,
  catalog: CatalogData,
  dailyGoalMinutes: number,
  now = new Date()
): ReadingStatsSummary {
  const progresses = Object.values(progressMap);
  const currentlyReadingCount = progresses.filter((p) => p.status === 'reading').length;
  const completedCount = progresses.filter((p) => p.status === 'completed').length;
  const wantToReadCount = progresses.filter((p) => p.status === 'want_to_read').length;

  const secondsByDay = new Map<string, number>();
  const pagesByDay = new Map<string, number>();
  let totalSessionSeconds = 0;
  let totalSessionPages = 0;

  for (const s of sessions) {
    if (s.durationSeconds <= 0) continue;
    totalSessionSeconds += s.durationSeconds;
    totalSessionPages += Math.max(0, s.pagesRead);
    secondsByDay.set(s.dateKey, (secondsByDay.get(s.dateKey) ?? 0) + s.durationSeconds);
    pagesByDay.set(s.dateKey, (pagesByDay.get(s.dateKey) ?? 0) + Math.max(0, s.pagesRead));
  }

  const totalProgressPages = progresses.reduce(
    (sum, p) => sum + (p.status === 'unread' ? 0 : Math.max(0, p.currentPage)),
    0
  );
  const totalPagesRead = Math.max(totalSessionPages, totalProgressPages);

  const todayKey = toDateKey(now);
  const todayMinutesRead = Math.round((secondsByDay.get(todayKey) ?? 0) / 60);

  const activeDaysCount = secondsByDay.size;
  const averageDailyMinutes =
    activeDaysCount > 0 ? Math.round(totalSessionSeconds / 60 / activeDaysCount) : 0;

  // Compute current & longest streak from active days (with >= 60s active reading)
  const qualifyingDates = Array.from(secondsByDay.entries())
    .filter(([, sec]) => sec >= 60)
    .map(([k]) => k)
    .sort();

  let longestStreakDays = 0;
  let running = 0;
  let prevDate: Date | null = null;

  for (const key of qualifyingDates) {
    const [yy, mm, dd] = key.split('-').map(Number);
    const dt = new Date(yy, mm - 1, dd);
    if (prevDate) {
      const diff = Math.round((dt.getTime() - prevDate.getTime()) / (24 * 3600 * 1000));
      running = diff === 1 ? running + 1 : 1;
    } else {
      running = 1;
    }
    if (running > longestStreakDays) longestStreakDays = running;
    prevDate = dt;
  }

  let currentStreakDays = 0;
  const yesterdayKey = toDateKey(addDays(now, -1));
  const checkStartOffset = (secondsByDay.get(todayKey) ?? 0) >= 60
    ? 0
    : (secondsByDay.get(yesterdayKey) ?? 0) >= 60
      ? -1
      : null;

  if (checkStartOffset !== null) {
    let offset = checkStartOffset;
    while (true) {
      const key = toDateKey(addDays(now, offset));
      if ((secondsByDay.get(key) ?? 0) >= 60) {
        currentStreakDays += 1;
        offset -= 1;
      } else {
        break;
      }
    }
  }

  // Last 7 days
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyActivity: DailyActivityPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(now, -i);
    const key = toDateKey(d);
    weeklyActivity.push({
      dateKey: key,
      label: dayNames[d.getDay()],
      minutes: Math.round((secondsByDay.get(key) ?? 0) / 60),
      pages: pagesByDay.get(key) ?? 0,
    });
  }

  // Last 30 days grouped in 5-day buckets or 14 days for crisp visualization
  const monthlyActivity: DailyActivityPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(now, -i);
    const key = toDateKey(d);
    monthlyActivity.push({
      dateKey: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      minutes: Math.round((secondsByDay.get(key) ?? 0) / 60),
      pages: pagesByDay.get(key) ?? 0,
    });
  }

  const goalThresholdSec = Math.max(60, dailyGoalMinutes * 60);
  const daysMeetingGoal = Array.from(secondsByDay.values()).filter(
    (sec) => sec >= goalThresholdSec
  ).length;
  const dailyGoalCompletionRate =
    activeDaysCount > 0 ? Math.min(100, Math.round((daysMeetingGoal / activeDaysCount) * 100)) : 0;

  // Category distribution
  const catMap = new Map<string, { minutes: number; books: Set<string> }>();
  for (const s of sessions) {
    const book = catalog.books.find((b) => b.id === s.bookId);
    const cat = book?.category ?? 'Other';
    const entry = catMap.get(cat) ?? { minutes: 0, books: new Set<string>() };
    entry.minutes += s.durationSeconds / 60;
    entry.books.add(s.bookId);
    catMap.set(cat, entry);
  }
  for (const p of progresses) {
    if (p.status === 'unread') continue;
    const book = catalog.books.find((b) => b.id === p.bookId);
    if (!book) continue;
    const entry = catMap.get(book.category) ?? { minutes: 0, books: new Set<string>() };
    entry.books.add(book.id);
    catMap.set(book.category, entry);
  }
  const categoryDistribution: CategoryDistributionItem[] = Array.from(catMap.entries())
    .map(([category, v]) => ({
      category,
      minutes: Math.round(v.minutes),
      booksCount: v.books.size,
    }))
    .sort((a, b) => b.minutes - a.minutes || b.booksCount - a.booksCount);

  const startedCount = progresses.filter((p) => p.status !== 'unread').length;

  const achievements: AchievementBadge[] = [
    {
      id: 'first_started',
      title: 'First Book Started',
      description: 'Begin reading your first book in Zentra.',
      unlocked: startedCount >= 1,
      progressLabel: `${Math.min(startedCount, 1)} / 1`,
    },
    {
      id: 'first_completed',
      title: 'First Book Completed',
      description: 'Finish reading a complete book.',
      unlocked: completedCount >= 1,
      progressLabel: `${Math.min(completedCount, 1)} / 1`,
    },
    {
      id: 'hundred_pages',
      title: '100 Pages Read',
      description: 'Accumulate 100 pages read across your library.',
      unlocked: totalPagesRead >= 100,
      progressLabel: `${Math.min(totalPagesRead, 100)} / 100`,
    },
    {
      id: 'streak_7',
      title: '7-Day Reading Streak',
      description: 'Read actively for 7 consecutive days.',
      unlocked: longestStreakDays >= 7,
      progressLabel: `${Math.min(longestStreakDays, 7)} / 7 days`,
    },
    {
      id: 'streak_30',
      title: '30-Day Reading Streak',
      description: 'Build a full month of daily reading consistency.',
      unlocked: longestStreakDays >= 30,
      progressLabel: `${Math.min(longestStreakDays, 30)} / 30 days`,
    },
    {
      id: 'five_completed',
      title: '5 Books Completed',
      description: 'Complete five full books in your personal universe.',
      unlocked: completedCount >= 5,
      progressLabel: `${Math.min(completedCount, 5)} / 5`,
    },
    {
      id: 'ten_completed',
      title: '10 Books Completed',
      description: 'Reach ten completed books in Zentra.',
      unlocked: completedCount >= 10,
      progressLabel: `${Math.min(completedCount, 10)} / 10`,
    },
  ];

  return {
    totalCatalogBooks: catalog.books.length,
    currentlyReadingCount,
    completedCount,
    wantToReadCount,
    totalPagesRead,
    totalSecondsRead: totalSessionSeconds,
    todayMinutesRead,
    averageDailyMinutes,
    currentStreakDays,
    longestStreakDays,
    dailyGoalMinutes,
    dailyGoalCompletionRate,
    weeklyActivity,
    monthlyActivity,
    categoryDistribution,
    achievements,
  };
}

const MONTH_SHORT_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function getYearlyGoalForYear(
  yearlyGoals: Record<string, YearlyReadingGoal> | undefined,
  year: number
): YearlyReadingGoal {
  const saved = yearlyGoals?.[String(year)];
  if (saved) {
    return {
      year,
      targetBooks: Math.max(1, Math.round(saved.targetBooks || 12)),
      targetPages: Math.max(50, Math.round(saved.targetPages || 3000)),
      targetHours: Math.max(1, Math.round(saved.targetHours || 120)),
    };
  }
  return {
    year,
    targetBooks: 12,
    targetPages: 3000,
    targetHours: 120,
  };
}

export function getAvailableYears(
  sessions: ReadingSession[],
  progressMap: Record<string, ReadingProgress>,
  yearlyGoals?: Record<string, YearlyReadingGoal>,
  now = new Date()
): number[] {
  const years = new Set<number>([now.getFullYear()]);
  for (const s of sessions) {
    const parsedYear = Number(s.dateKey.slice(0, 4));
    if (Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100) {
      years.add(parsedYear);
    }
  }
  for (const p of Object.values(progressMap)) {
    const ts = p.completedAt ?? p.lastReadAt;
    if (ts > 0) {
      const y = new Date(ts).getFullYear();
      if (y >= 2000 && y <= 2100) years.add(y);
    }
  }
  if (yearlyGoals) {
    for (const key of Object.keys(yearlyGoals)) {
      const y = Number(key);
      if (Number.isInteger(y) && y >= 2000 && y <= 2100) years.add(y);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function computeYearlyDashboardData(
  sessions: ReadingSession[],
  progressMap: Record<string, ReadingProgress>,
  catalog: CatalogData,
  year: number,
  goalInput: YearlyReadingGoal,
  now = new Date()
): YearlyDashboardData {
  const goal: YearlyReadingGoal = {
    year,
    targetBooks: Math.max(1, Math.round(goalInput.targetBooks)),
    targetPages: Math.max(50, Math.round(goalInput.targetPages)),
    targetHours: Math.max(1, Math.round(goalInput.targetHours)),
  };

  const monthBuckets = Array.from({ length: 12 }, (_, idx) => ({
    minutes: 0,
    pages: 0,
    booksCompleted: 0,
    sessionsCount: 0,
    activeDayKeys: new Set<string>(),
  }));

  const yearPrefix = `${year}-`;
  const activeYearDayKeys = new Set<string>();
  const categoryMap = new Map<
    string,
    { minutes: number; pages: number; books: Set<string> }
  >();
  const bookLookup = new Map(catalog.books.map((b) => [b.id, b]));

  let totalMinutes = 0;
  let totalSessionPages = 0;
  let totalSessionsCount = 0;

  for (const s of sessions) {
    if (s.durationSeconds <= 0 || !s.dateKey.startsWith(yearPrefix)) continue;
    const monthNum = Number(s.dateKey.slice(5, 7));
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) continue;

    const bucket = monthBuckets[monthNum - 1];
    const mins = s.durationSeconds / 60;
    const pages = Math.max(0, s.pagesRead);
    bucket.minutes += mins;
    bucket.pages += pages;
    bucket.sessionsCount += 1;
    bucket.activeDayKeys.add(s.dateKey);

    totalMinutes += mins;
    totalSessionPages += pages;
    totalSessionsCount += 1;
    activeYearDayKeys.add(s.dateKey);

    const book = bookLookup.get(s.bookId);
    const cat = book?.category ?? 'General Reading';
    const entry = categoryMap.get(cat) ?? { minutes: 0, pages: 0, books: new Set<string>() };
    entry.minutes += mins;
    entry.pages += pages;
    entry.books.add(s.bookId);
    categoryMap.set(cat, entry);
  }

  let booksCompleted = 0;
  let progressPagesInYear = 0;

  for (const p of Object.values(progressMap)) {
    if (p.status === 'unread') continue;
    const ts = p.status === 'completed' ? (p.completedAt ?? p.lastReadAt) : p.lastReadAt;
    if (!ts) continue;
    const dt = new Date(ts);
    if (dt.getFullYear() !== year) continue;

    const monthIdx = dt.getMonth();
    if (p.status === 'completed') {
      booksCompleted += 1;
      monthBuckets[monthIdx].booksCompleted += 1;
    }
    progressPagesInYear += Math.max(0, p.currentPage);

    const book = bookLookup.get(p.bookId);
    const cat = book?.category ?? 'General Reading';
    const entry = categoryMap.get(cat) ?? { minutes: 0, pages: 0, books: new Set<string>() };
    entry.books.add(p.bookId);
    categoryMap.set(cat, entry);
  }

  const pagesRead = Math.max(Math.round(totalSessionPages), progressPagesInYear);
  const minutesRead = Math.round(totalMinutes);
  const hoursRead = Math.round((minutesRead / 60) * 10) / 10;

  // Build Jan..Dec cumulative and monthly points
  const monthlyTrend: MonthlyTrendPoint[] = [];
  let cumPages = 0;
  let cumMinutes = 0;
  let cumBooks = 0;
  let bestMonthLabel: string | null = null;
  let bestMonthPages = 0;
  let bestMonthScore = 0;

  for (let i = 0; i < 12; i++) {
    const b = monthBuckets[i];
    const mMinutes = Math.round(b.minutes);
    const mHours = Math.round((b.minutes / 60) * 10) / 10;
    const mPages = Math.round(b.pages);
    cumPages += mPages;
    cumMinutes += b.minutes;
    cumBooks += b.booksCompleted;

    const monthScore = mPages + mMinutes + b.booksCompleted * 100;
    if (monthScore > bestMonthScore) {
      bestMonthScore = monthScore;
      bestMonthLabel = MONTH_SHORT_LABELS[i];
      bestMonthPages = mPages;
    }

    const fraction = (i + 1) / 12;
    monthlyTrend.push({
      monthIndex: i,
      monthKey: `${year}-${String(i + 1).padStart(2, '0')}`,
      monthLabel: MONTH_SHORT_LABELS[i],
      minutes: mMinutes,
      hours: mHours,
      pages: mPages,
      booksCompleted: b.booksCompleted,
      sessionsCount: b.sessionsCount,
      activeDays: b.activeDayKeys.size,
      cumulativePages: cumPages,
      cumulativeHours: Math.round((cumMinutes / 60) * 10) / 10,
      cumulativeBooks: cumBooks,
      targetCumulativePages: Math.round(goal.targetPages * fraction),
      targetCumulativeHours: Math.round(goal.targetHours * fraction * 10) / 10,
      targetCumulativeBooks: Math.round(goal.targetBooks * fraction * 10) / 10,
    });
  }

  // Year elapsed fraction & pace projection
  const startOfYear = new Date(year, 0, 1).getTime();
  const endOfYear = new Date(year + 1, 0, 1).getTime();
  const totalYearDays = Math.round((endOfYear - startOfYear) / (24 * 3600 * 1000));
  let elapsedRatio: number;
  let daysRemainingInYear: number;

  if (year < now.getFullYear()) {
    elapsedRatio = 1;
    daysRemainingInYear = 0;
  } else if (year > now.getFullYear()) {
    elapsedRatio = 0;
    daysRemainingInYear = totalYearDays;
  } else {
    const dayOfYear = Math.max(
      1,
      Math.floor((now.getTime() - startOfYear) / (24 * 3600 * 1000)) + 1
    );
    elapsedRatio = Math.min(1, dayOfYear / totalYearDays);
    daysRemainingInYear = Math.max(0, totalYearDays - dayOfYear);
  }

  const yearElapsedPct = Math.round(elapsedRatio * 100);
  const expectedBooksByNow = Math.round(goal.targetBooks * elapsedRatio * 10) / 10;
  const expectedPagesByNow = Math.round(goal.targetPages * elapsedRatio);
  const expectedHoursByNow = Math.round(goal.targetHours * elapsedRatio * 10) / 10;

  const booksPct = Math.min(100, Math.round((booksCompleted / goal.targetBooks) * 100));
  const pagesPct = Math.min(100, Math.round((pagesRead / goal.targetPages) * 100));
  const hoursPct = Math.min(100, Math.round((hoursRead / goal.targetHours) * 100));

  // Combined pace evaluation across books & pages
  const actualComposite =
    (booksCompleted / goal.targetBooks +
      pagesRead / goal.targetPages +
      hoursRead / goal.targetHours) /
    3;
  const paceDeltaBooks = Math.round((booksCompleted - expectedBooksByNow) * 10) / 10;

  let paceStatus: YearlyPaceStatus = 'on_track';
  if (elapsedRatio === 0) {
    paceStatus = 'on_track';
  } else if (actualComposite >= elapsedRatio + 0.06) {
    paceStatus = 'ahead';
  } else if (actualComposite < elapsedRatio - 0.1) {
    paceStatus = 'behind';
  }

  const projectionDivisor = elapsedRatio > 0.02 ? elapsedRatio : 1;
  const projectedBooksYearEnd =
    year < now.getFullYear()
      ? booksCompleted
      : Math.round(booksCompleted / projectionDivisor);
  const projectedPagesYearEnd =
    year < now.getFullYear() ? pagesRead : Math.round(pagesRead / projectionDivisor);
  const projectedHoursYearEnd =
    year < now.getFullYear()
      ? hoursRead
      : Math.round((hoursRead / projectionDivisor) * 10) / 10;

  const categoryBreakdown: YearlyCategoryStat[] = Array.from(categoryMap.entries())
    .map(([category, v]) => ({
      category,
      minutes: Math.round(v.minutes),
      hours: Math.round((v.minutes / 60) * 10) / 10,
      pages: Math.round(v.pages),
      booksCount: v.books.size,
    }))
    .sort((a, b) => b.pages - a.pages || b.minutes - a.minutes || b.booksCount - a.booksCount);

  return {
    year,
    goal,
    booksCompleted,
    pagesRead,
    minutesRead,
    hoursRead,
    sessionsCount: totalSessionsCount,
    activeDays: activeYearDayKeys.size,
    booksPct,
    pagesPct,
    hoursPct,
    yearElapsedPct,
    expectedBooksByNow,
    expectedPagesByNow,
    expectedHoursByNow,
    paceStatus,
    paceDeltaBooks,
    projectedBooksYearEnd,
    projectedPagesYearEnd,
    projectedHoursYearEnd,
    daysRemainingInYear,
    monthlyTargetPages: Math.round(goal.targetPages / 12),
    monthlyTargetHours: Math.round((goal.targetHours / 12) * 10) / 10,
    monthlyTargetBooks: Math.round((goal.targetBooks / 12) * 10) / 10,
    bestMonthLabel,
    bestMonthPages,
    monthlyTrend,
    categoryBreakdown,
  };
}

function parseMinutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function isWithinQuietHours(now: Date, startHHMM: string, endHHMM: string): boolean {
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const startMin = parseMinutesOfDay(startHHMM);
  const endMin = parseMinutesOfDay(endHHMM);

  if (startMin === endMin) return false;
  if (startMin < endMin) {
    return currentMin >= startMin && currentMin < endMin;
  }
  // Overnight window (e.g., 22:00 -> 07:00)
  return currentMin >= startMin || currentMin < endMin;
}

export function shouldTriggerReminder(
  settings: GoalAndReminderSettings,
  todayMinutesRead: number,
  lastSentReminders: Record<string, string>,
  now = new Date()
): { shouldSend: boolean; reminderKey?: string; reason?: string } {
  const todayKey = toDateKey(now);

  if (settings.paused) return { shouldSend: false, reason: 'paused' };
  if (settings.vacationMode) return { shouldSend: false, reason: 'vacation_mode' };
  if (settings.skipTodayDate === todayKey) return { shouldSend: false, reason: 'skipped_today' };
  if (!settings.enableDailyReminder) return { shouldSend: false, reason: 'disabled' };
  if (!settings.preferredDays.includes(now.getDay())) {
    return { shouldSend: false, reason: 'not_preferred_day' };
  }
  if (isWithinQuietHours(now, settings.quietHoursStart, settings.quietHoursEnd)) {
    return { shouldSend: false, reason: 'quiet_hours' };
  }
  if (todayMinutesRead >= settings.dailyGoalMinutes) {
    return { shouldSend: false, reason: 'goal_already_reached' };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const primaryMin = parseMinutesOfDay(settings.primaryReminderTime);
  const secondaryMin = settings.secondaryReminderTime
    ? parseMinutesOfDay(settings.secondaryReminderTime)
    : null;

  if (
    nowMinutes >= primaryMin &&
    nowMinutes <= primaryMin + 30 &&
    lastSentReminders['daily_primary'] !== todayKey
  ) {
    return { shouldSend: true, reminderKey: 'daily_primary' };
  }

  if (
    secondaryMin !== null &&
    nowMinutes >= secondaryMin &&
    nowMinutes <= secondaryMin + 30 &&
    lastSentReminders['daily_secondary'] !== todayKey
  ) {
    return { shouldSend: true, reminderKey: 'daily_secondary' };
  }

  return { shouldSend: false, reason: 'outside_schedule_window' };
}

export function validateAndMergeBackup(
  raw: unknown,
  currentDb: PersonalDatabase
): { mergedDb: PersonalDatabase; summary: { notesAdded: number; highlightsAdded: number; bookmarksAdded: number; listsAdded: number } } {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Backup file is not a valid JSON object.');
  }
  const payload = raw as Partial<ZentraBackupPayload>;
  if (payload.app !== 'Zentra' || typeof payload.backupVersion !== 'number' || !payload.personalDb) {
    throw new Error('Unrecognized backup format. Expected a Zentra backup file.');
  }
  if (payload.backupVersion > 1) {
    throw new Error(`Backup version ${payload.backupVersion} is newer than supported version 1.`);
  }

  const incoming = payload.personalDb;

  // Merge progress keeping higher page/seconds or newer timestamp
  const mergedProgress: Record<string, ReadingProgress> = { ...currentDb.progressByBook };
  for (const [bookId, incProg] of Object.entries(incoming.progressByBook ?? {})) {
    const existing = mergedProgress[bookId];
    if (!existing || incProg.lastReadAt > existing.lastReadAt) {
      mergedProgress[bookId] = {
        ...incProg,
        totalSecondsRead: Math.max(incProg.totalSecondsRead, existing?.totalSecondsRead ?? 0),
      };
    }
  }

  const favorites = Array.from(new Set([...currentDb.favorites, ...(incoming.favorites ?? [])]));
  const recentlyViewed = Array.from(
    new Set([...(incoming.recentlyViewed ?? []), ...currentDb.recentlyViewed])
  ).slice(0, 30);
  const notInterestedIds = Array.from(
    new Set([...currentDb.notInterestedIds, ...(incoming.notInterestedIds ?? [])])
  );

  // Deduplicate by ID
  const existingNoteIds = new Set(currentDb.notes.map((n) => n.id));
  const newNotes = (incoming.notes ?? []).filter((n) => !existingNoteIds.has(n.id));

  const existingHighlightIds = new Set(currentDb.highlights.map((h) => h.id));
  const newHighlights = (incoming.highlights ?? []).filter((h) => !existingHighlightIds.has(h.id));

  const existingBookmarkIds = new Set(currentDb.bookmarks.map((b) => b.id));
  const newBookmarks = (incoming.bookmarks ?? []).filter((b) => !existingBookmarkIds.has(b.id));

  const existingSessionIds = new Set(currentDb.sessions.map((s) => s.id));
  const newSessions = (incoming.sessions ?? []).filter((s) => !existingSessionIds.has(s.id));

  const existingListIds = new Set(currentDb.customLists.map((l) => l.id));
  const newLists = (incoming.customLists ?? []).filter((l) => !existingListIds.has(l.id));

  return {
    mergedDb: {
      ...currentDb,
      progressByBook: mergedProgress,
      favorites,
      recentlyViewed,
      notInterestedIds,
      customLists: [...currentDb.customLists, ...newLists],
      sessions: [...currentDb.sessions, ...newSessions],
      highlights: [...currentDb.highlights, ...newHighlights],
      notes: [...currentDb.notes, ...newNotes],
      bookmarks: [...currentDb.bookmarks, ...newBookmarks],
      settings: incoming.settings
        ? {
            ...currentDb.settings,
            ...incoming.settings,
            reader: { ...currentDb.settings.reader, ...incoming.settings.reader },
            reminders: { ...currentDb.settings.reminders, ...incoming.settings.reminders },
          }
        : currentDb.settings,
    },
    summary: {
      notesAdded: newNotes.length,
      highlightsAdded: newHighlights.length,
      bookmarksAdded: newBookmarks.length,
      listsAdded: newLists.length,
    },
  };
}
