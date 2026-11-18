export type ReadingStatus = 'unread' | 'want_to_read' | 'reading' | 'completed';

export type ReaderMode = 'single' | 'double' | 'vertical';

export type ReaderTheme = 'light' | 'dark' | 'sepia';

export type AppThemeMode = 'light' | 'dark' | 'system';

export type HighlightColor = 'amber' | 'sky' | 'sage' | 'rose';

export type DownloadStatus =
  | 'not_downloaded'
  | 'waiting'
  | 'downloading'
  | 'paused'
  | 'failed'
  | 'downloaded'
  | 'updating';

export interface ChapterSummary {
  chapterNumber: number;
  title: string;
  summary: string;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  authorId: string;
  authorIds?: string[];
  authorName?: string;
  coverUrl: string;
  coverAccent?: string;
  pdfUrl: string;
  pdfFileId?: string;
  pdfReaderUrl?: string;
  description: string;
  summary: string;
  chapterSummaries?: ChapterSummary[];
  keyTakeaways: string[];
  practicalLessons?: string[];
  importantQuotes?: string[];
  category: string;
  subcategory?: string;
  language: string;
  tags: string[];
  publishedYear?: number;
  pageCount?: number;
  isbn?: string;
  publisher?: string;
  difficulty?: 'Foundational' | 'Intermediate' | 'Advanced';
  featured?: boolean;
  popular?: boolean;
  newlyAdded?: boolean;
  addedDate?: string;
  relatedBookIds?: string[];
  sampleChapters?: { title: string; paragraphs: string[] }[];
}

export interface Author {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  description?: string;
  expertise?: string[];
  bookIds: string[];
  relatedAuthorIds?: string[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  coverUrl?: string;
}

export interface CatalogData {
  version: number;
  lastUpdated: string;
  books: Book[];
  authors: Author[];
  categories: Category[];
}

export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  totalPages: number;
  status: ReadingStatus;
  lastReadAt: number;
  totalSecondsRead: number;
  lastScrollOffset?: number;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  dateKey: string; // YYYY-MM-DD
  startTime: number;
  endTime: number;
  durationSeconds: number;
  pagesRead: number;
}

export interface HighlightRect {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  bookId: string;
  page: number;
  text: string;
  color: HighlightColor;
  rects: HighlightRect[];
  createdAt: number;
}

export interface Note {
  id: string;
  bookId: string;
  page: number;
  highlightId?: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  page: number;
  label: string;
  createdAt: number;
}

export interface CustomReadingList {
  id: string;
  name: string;
  bookIds: string[];
  createdAt: number;
}

export interface DownloadRecord {
  bookId: string;
  status: DownloadStatus;
  progress: number; // 0..100
  bytesDownloaded: number;
  totalBytes: number;
  sha256?: string;
  pdfUrl: string;
  downloadedAt?: number;
  error?: string;
}

export interface GoalAndReminderSettings {
  dailyGoalMinutes: number;
  preferredDays: number[]; // 0 (Sun) .. 6 (Sat)
  primaryReminderTime: string; // HH:MM
  secondaryReminderTime?: string; // HH:MM
  enableDailyReminder: boolean;
  enableUnfinishedReminder: boolean;
  unfinishedDaysThreshold: number;
  enableGoalReminder: boolean;
  enableWeeklyReport: boolean;
  quietHoursStart: string; // HH:MM
  quietHoursEnd: string; // HH:MM
  paused: boolean;
  vacationMode: boolean;
  skipTodayDate?: string; // YYYY-MM-DD
}

export interface ReaderPreferences {
  defaultMode: ReaderMode;
  readerTheme: ReaderTheme;
  keepScreenAwake: boolean;
  pageMarginSize: 'compact' | 'comfortable' | 'wide';
  coverSpreadOffset: boolean;
  brightnessPercent: number;
  pageTurnAnimation: boolean;
}

export interface AppSettings {
  themeMode: AppThemeMode;
  catalogUrl: string;
  onboardingCompleted: boolean;
  userName: string;
  interests: string[];
  reader: ReaderPreferences;
  reminders: GoalAndReminderSettings;
}

export interface PersonalDatabase {
  schemaVersion: number;
  progressByBook: Record<string, ReadingProgress>;
  favorites: string[];
  recentlyViewed: string[];
  notInterestedIds: string[];
  customLists: CustomReadingList[];
  sessions: ReadingSession[];
  highlights: Highlight[];
  notes: Note[];
  bookmarks: Bookmark[];
  lastSentReminders: Record<string, string>; // reminderType -> YYYY-MM-DD
  settings: AppSettings;
}

export interface ZentraBackupPayload {
  backupVersion: number;
  exportedAt: string;
  app: 'Zentra';
  personalDb: PersonalDatabase;
  embeddedPdfs?: Array<{
    bookId: string;
    sha256: string;
    totalBytes: number;
    base64Data: string;
  }>;
}

export type ActiveTab = 'home' | 'library' | 'reading' | 'knowledge' | 'stats';

export type SubView =
  | { type: 'none' }
  | { type: 'book_detail'; bookId: string }
  | { type: 'author_profile'; authorId: string }
  | { type: 'downloads' }
  | { type: 'settings' }
  | { type: 'reminders' };
