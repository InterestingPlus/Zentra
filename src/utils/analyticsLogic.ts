import type {
  CatalogData,
  GoalAndReminderSettings,
  PersonalDatabase,
  ReadingProgress,
  ReadingSession,
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
