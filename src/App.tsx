import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { AuthorProfileView } from './components/AuthorProfileView';
import { BookDetailView } from './components/BookDetailView';
import { DownloadsView } from './components/DownloadsView';
import { HomeView } from './components/HomeView';
import { KnowledgeHubView } from './components/KnowledgeHubView';
import { LibraryView } from './components/LibraryView';
import { NavigationShell } from './components/NavigationShell';
import { OnboardingWizard } from './components/OnboardingWizard';
import { PdfReaderView } from './components/PdfReaderView';
import { ReadingDashboardView } from './components/ReadingDashboardView';
import { ReadingDeskView } from './components/ReadingDeskView';
import { SettingsView } from './components/SettingsView';
import { SEED_CATALOG } from './data/seedCatalog';
import {
  fetchAndSyncCatalog,
  loadCachedCatalog,
  saveCatalogCache,
} from './services/catalogService';
import { loadPersonalDb, savePersonalDb } from './services/localDb';
import {
  sendLocalNotification,
  useOnlineStatus,
} from './services/notificationService';
import {
  deleteDownloadedPdf,
  getAllDownloadRecords,
  saveDownloadedPdf,
  saveDownloadRecord,
} from './services/offlineStorage';
import {
  computeSha256Hex,
  fetchOrSynthesizePdf,
  importLocalPdfFile,
  verifyPdfMagicHeader,
} from './services/pdfService';
import type {
  AppSettings,
  CatalogData,
  DownloadRecord,
  Highlight,
  HighlightColor,
  HighlightRect,
  PersonalDatabase,
  ReaderPreferences,
  ReadingStatus,
  YearlyReadingGoal,
} from './types/zentra';
import {
  computeReadingStats,
  shouldTriggerReminder,
  toDateKey,
} from './utils/analyticsLogic';
import {
  type LibraryFilterScope,
  validateAndNormalizeCatalog,
} from './utils/catalogLogic';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

interface RouteNotFoundProps {
  title: string;
  description: string;
}

const RouteNotFound: React.FC<RouteNotFoundProps> = ({ title, description }) => (
  <div className="p-10 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center space-y-4 max-w-lg mx-auto my-8">
    <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
      {title}
    </h1>
    <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    <div className="flex justify-center gap-3">
      <Link
        to="/library"
        className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium min-h-[44px] inline-flex items-center"
      >
        Browse Library
      </Link>
      <Link
        to="/"
        className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium min-h-[44px] inline-flex items-center"
      >
        Home
      </Link>
    </div>
  </div>
);

const RouteLoadingState: React.FC<{ label?: string }> = ({
  label = 'Loading from catalog…',
}) => (
  <div className="p-12 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center space-y-3 max-w-md mx-auto my-12">
    <div
      className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto"
      aria-hidden="true"
    />
    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
  </div>
);

interface LibraryRouteProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  downloads: Record<string, DownloadRecord>;
  onOpenBook: (bookId: string) => void;
  onOpenAuthor: (authorId: string) => void;
  onCreateCustomList: (name: string) => void;
  onOpenDownloads: () => void;
}

const LibraryRoute: React.FC<LibraryRouteProps> = ({
  catalog,
  db,
  downloads,
  onOpenBook,
  onOpenAuthor,
  onCreateCustomList,
  onOpenDownloads,
}) => {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || 'All';
  const scopeParam = (searchParams.get('scope') as LibraryFilterScope) || 'all';
  return (
    <LibraryView
      catalog={catalog}
      db={db}
      downloads={downloads}
      initialCategory={categoryParam}
      initialScope={scopeParam}
      onOpenBook={onOpenBook}
      onOpenAuthor={onOpenAuthor}
      onCreateCustomList={onCreateCustomList}
      onOpenDownloads={onOpenDownloads}
    />
  );
};

interface BookDetailRouteProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  downloads: Record<string, DownloadRecord>;
  isSyncing: boolean;
  onRecordRecentlyViewed: (bookId: string) => void;
  onBack: () => void;
  onReadNow: (bookId: string, page?: number) => void;
  onDownloadBook: (bookId: string) => void;
  onImportOfflinePdf: (bookId: string, file: File) => Promise<void>;
  onDeleteDownload: (bookId: string) => void;
  onToggleFavorite: (bookId: string) => void;
  onChangeStatus: (bookId: string, status: ReadingStatus) => void;
  onToggleCustomList: (listId: string, bookId: string) => void;
  onOpenBook: (bookId: string) => void;
  onOpenAuthor: (authorId: string) => void;
}

const BookDetailRoute: React.FC<BookDetailRouteProps> = ({
  catalog,
  db,
  downloads,
  isSyncing,
  onRecordRecentlyViewed,
  onBack,
  onReadNow,
  onDownloadBook,
  onImportOfflinePdf,
  onDeleteDownload,
  onToggleFavorite,
  onChangeStatus,
  onToggleCustomList,
  onOpenBook,
  onOpenAuthor,
}) => {
  const { bookId } = useParams<{ bookId: string }>();
  const decodedId = bookId ? decodeURIComponent(bookId) : '';
  const book = catalog.books.find((b) => b.id === decodedId);

  useEffect(() => {
    if (book) {
      onRecordRecentlyViewed(book.id);
    }
  }, [book?.id, onRecordRecentlyViewed]);

  if (!book) {
    if (isSyncing) {
      return <RouteLoadingState label="Loading book details…" />;
    }
    return (
      <RouteNotFound
        title="Book not found"
        description="This title may have been moved or is not present in the active catalog."
      />
    );
  }

  return (
    <BookDetailView
      book={book}
      author={catalog.authors.find((a) => a.id === book.authorId)}
      catalog={catalog}
      db={db}
      downloadRecord={downloads[book.id]}
      onBack={onBack}
      onReadNow={onReadNow}
      onDownloadBook={onDownloadBook}
      onImportOfflinePdf={onImportOfflinePdf}
      onDeleteDownload={onDeleteDownload}
      onToggleFavorite={onToggleFavorite}
      onChangeStatus={onChangeStatus}
      onToggleCustomList={onToggleCustomList}
      onOpenBook={onOpenBook}
      onOpenAuthor={onOpenAuthor}
    />
  );
};

interface AuthorProfileRouteProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  downloads: Record<string, DownloadRecord>;
  isSyncing: boolean;
  onBack: () => void;
  onOpenBook: (bookId: string) => void;
  onOpenAuthor: (authorId: string) => void;
}

const AuthorProfileRoute: React.FC<AuthorProfileRouteProps> = ({
  catalog,
  db,
  downloads,
  isSyncing,
  onBack,
  onOpenBook,
  onOpenAuthor,
}) => {
  const { authorId } = useParams<{ authorId: string }>();
  const decodedId = authorId ? decodeURIComponent(authorId) : '';
  const author = catalog.authors.find((a) => a.id === decodedId);

  if (!author) {
    if (isSyncing) {
      return <RouteLoadingState label="Loading author profile…" />;
    }
    return (
      <RouteNotFound
        title="Author not found"
        description="We could not locate this author profile in the current catalog."
      />
    );
  }

  return (
    <AuthorProfileView
      author={author}
      catalog={catalog}
      db={db}
      downloads={downloads}
      onBack={onBack}
      onOpenBook={onOpenBook}
      onOpenAuthor={onOpenAuthor}
    />
  );
};

interface ReaderRouteProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  downloads: Record<string, DownloadRecord>;
  isOnline: boolean;
  isSyncing: boolean;
  activeDownloadCount: number;
  onCloseToBook: (bookId: string) => void;
  onUpdatePreferences: (patch: Partial<ReaderPreferences>) => void;
  onSaveProgress: (bookId: string, page: number, totalPages: number) => void;
  onRecordSession: (
    bookId: string,
    durationSeconds: number,
    pagesRead: number,
    dateKey: string
  ) => void;
  onAddHighlight: (
    bookId: string,
    page: number,
    text: string,
    color: HighlightColor,
    rects: HighlightRect[]
  ) => Highlight;
  onAddNote: (
    bookId: string,
    page: number,
    title: string,
    content: string,
    highlightId?: string
  ) => void;
  onAddBookmark: (bookId: string, page: number, label: string) => void;
  onDeleteHighlight: (id: string) => void;
  onDeleteBookmark: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onImportOfflinePdf: (bookId: string, file: File) => Promise<void>;
}

const ReaderRoute: React.FC<ReaderRouteProps> = ({
  catalog,
  db,
  downloads,
  isOnline,
  isSyncing,
  activeDownloadCount,
  onCloseToBook,
  onUpdatePreferences,
  onSaveProgress,
  onRecordSession,
  onAddHighlight,
  onAddNote,
  onAddBookmark,
  onDeleteHighlight,
  onDeleteBookmark,
  onDeleteNote,
  onImportOfflinePdf,
}) => {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const decodedId = bookId ? decodeURIComponent(bookId) : '';
  const readerBook = catalog.books.find((b) => b.id === decodedId);

  if (!readerBook) {
    return (
      <NavigationShell isOnline={isOnline} activeDownloadCount={activeDownloadCount}>
        {isSyncing ? (
          <RouteLoadingState label="Opening book reader…" />
        ) : (
          <RouteNotFound
            title="Book not available"
            description="We could not locate this PDF in your Zentra catalog."
          />
        )}
      </NavigationShell>
    );
  }

  const pageParam = Number(searchParams.get('page'));
  const savedPage = db.progressByBook[readerBook.id]?.currentPage ?? 1;
  const initialPage = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : savedPage;
  const readerAuthor = catalog.authors.find((a) => a.id === readerBook.authorId);

  return (
    <PdfReaderView
      book={readerBook}
      author={readerAuthor}
      initialPage={initialPage}
      isOnline={isOnline}
      isDownloaded={downloads[readerBook.id]?.status === 'downloaded'}
      preferences={db.settings.reader}
      highlights={db.highlights.filter((h) => h.bookId === readerBook.id)}
      notes={db.notes.filter((n) => n.bookId === readerBook.id)}
      bookmarks={db.bookmarks.filter((bm) => bm.bookId === readerBook.id)}
      onClose={() => onCloseToBook(readerBook.id)}
      onUpdatePreferences={onUpdatePreferences}
      onSaveProgress={onSaveProgress}
      onRecordSession={onRecordSession}
      onAddHighlight={onAddHighlight}
      onAddNote={onAddNote}
      onAddBookmark={onAddBookmark}
      onDeleteHighlight={onDeleteHighlight}
      onDeleteBookmark={onDeleteBookmark}
      onDeleteNote={onDeleteNote}
      onImportOfflinePdf={onImportOfflinePdf}
    />
  );
};

export default function App() {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();

  const [db, setDb] = useState<PersonalDatabase>(() => {
    const loaded = loadPersonalDb();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' && !loaded.settings.onboardingCompleted) {
        loaded.settings.onboardingCompleted = true;
      }
    }
    return loaded;
  });

  const [catalog, setCatalog] = useState<CatalogData>(() => {
    const cached = loadCachedCatalog();
    return cached?.catalog ?? validateAndNormalizeCatalog(SEED_CATALOG);
  });

  const [isSyncing, setIsSyncing] = useState(true);
  const [syncStatusMessage, setSyncStatusMessage] = useState(
    'Loaded locally cached catalog.'
  );
  const [downloads, setDownloads] = useState<Record<string, DownloadRecord>>({});
  const downloadControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [activeReminderBanner, setActiveReminderBanner] = useState<string | null>(null);

  // Persist personal database whenever it changes
  useEffect(() => {
    savePersonalDb(db);
  }, [db]);

  // Apply Light / Dark / System theme cleanly
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldDark =
        db.settings.themeMode === 'dark' ||
        (db.settings.themeMode === 'system' && prefersDark);
      root.classList.toggle('dark', shouldDark);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [db.settings.themeMode]);

  // Load offline download records from IndexedDB on mount
  useEffect(() => {
    getAllDownloadRecords().then(setDownloads);
  }, []);

  // Sync online catalog on startup (never overwrites personal DB)
  const handleRefreshCatalog = useCallback(
    async (overrideUrl?: string) => {
      const targetUrl = overrideUrl || db.settings.catalogUrl;
      setIsSyncing(true);
      const result = await fetchAndSyncCatalog(targetUrl);
      setCatalog(result.catalog);
      setSyncStatusMessage(result.statusMessage);
      setIsSyncing(false);
    },
    [db.settings.catalogUrl]
  );

  useEffect(() => {
    handleRefreshCatalog();
  }, []);

  // Compute live reading analytics
  const stats = useMemo(
    () =>
      computeReadingStats(
        db.sessions,
        db.progressByBook,
        catalog,
        db.settings.reminders.dailyGoalMinutes
      ),
    [db.sessions, db.progressByBook, catalog, db.settings.reminders.dailyGoalMinutes]
  );

  // Local Smart Reminder Scheduler
  useEffect(() => {
    const check = () => {
      const decision = shouldTriggerReminder(
        db.settings.reminders,
        stats.todayMinutesRead,
        db.lastSentReminders,
        new Date()
      );
      if (decision.shouldSend && decision.reminderKey) {
        const remaining = Math.max(
          1,
          db.settings.reminders.dailyGoalMinutes - stats.todayMinutesRead
        );
        const msg = `Time for your Zentra reading session — ${remaining} min left to reach today's goal.`;
        sendLocalNotification('Zentra Reading Reminder', msg);
        setActiveReminderBanner(msg);
        setDb((prev) => ({
          ...prev,
          lastSentReminders: {
            ...prev.lastSentReminders,
            [decision.reminderKey!]: toDateKey(new Date()),
          },
        }));
      }
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [db.settings.reminders, db.lastSentReminders, stats.todayMinutesRead]);

  // Router Navigation Helpers
  const recordRecentlyViewed = useCallback((bookId: string) => {
    setDb((prev) => {
      if (prev.recentlyViewed[0] === bookId) return prev;
      return {
        ...prev,
        recentlyViewed: [
          bookId,
          ...prev.recentlyViewed.filter((id) => id !== bookId),
        ].slice(0, 30),
      };
    });
  }, []);

  const openBookDetail = useCallback(
    (bookId: string) => {
      recordRecentlyViewed(bookId);
      navigate(`/book/${encodeURIComponent(bookId)}`);
    },
    [navigate, recordRecentlyViewed]
  );

  const openAuthorProfile = useCallback(
    (authorId: string) => {
      navigate(`/author/${encodeURIComponent(authorId)}`);
    },
    [navigate]
  );

  const openPdfReader = useCallback(
    (bookId: string, page?: number) => {
      const existingPage = db.progressByBook[bookId]?.currentPage ?? 1;
      const targetPage = page ?? existingPage;
      const suffix = targetPage > 1 ? `?page=${targetPage}` : '';
      navigate(`/read/${encodeURIComponent(bookId)}${suffix}`);
    },
    [navigate, db.progressByBook]
  );

  const navigateBackOrFallback = useCallback(
    (fallbackPath = '/') => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(fallbackPath);
      }
    },
    [navigate]
  );

  // Download Manager Actions (100% client-side, zero backend server)
  const handleStartDownload = async (bookId: string) => {
    const current = downloads[bookId];
    if (current?.status === 'downloading' || current?.status === 'downloaded') return;

    const book = catalog.books.find((b) => b.id === bookId);
    if (!book) return;
    const author = catalog.authors.find((a) => a.id === book.authorId);

    const controller = new AbortController();
    downloadControllersRef.current.set(bookId, controller);

    const initialRec: DownloadRecord = {
      bookId,
      status: 'downloading',
      progress: 5,
      bytesDownloaded: 0,
      totalBytes: 0,
      pdfUrl: book.pdfUrl,
    };
    setDownloads((prev) => ({ ...prev, [bookId]: initialRec }));
    await saveDownloadRecord(initialRec);

    try {
      const buffer = await fetchOrSynthesizePdf(book, author, {
        signal: controller.signal,
        onProgress: (pct, loaded, total) => {
          setDownloads((prev) => ({
            ...prev,
            [bookId]: {
              bookId,
              status: 'downloading',
              progress: pct,
              bytesDownloaded: loaded,
              totalBytes: total,
              pdfUrl: book.pdfUrl,
            },
          }));
        },
      });

      if (!verifyPdfMagicHeader(buffer)) {
        throw new Error('Downloaded file failed PDF integrity check.');
      }

      const sha256 = await computeSha256Hex(buffer);
      const completedRec: DownloadRecord = {
        bookId,
        status: 'downloaded',
        progress: 100,
        bytesDownloaded: buffer.byteLength,
        totalBytes: buffer.byteLength,
        sha256,
        pdfUrl: book.pdfUrl,
        downloadedAt: Date.now(),
      };
      await saveDownloadedPdf(bookId, buffer, completedRec);
      setDownloads((prev) => ({ ...prev, [bookId]: completedRec }));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const failedRec: DownloadRecord = {
        bookId,
        status: 'failed',
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        pdfUrl: book.pdfUrl,
        error: err instanceof Error ? err.message : 'Download failed.',
      };
      await saveDownloadRecord(failedRec);
      setDownloads((prev) => ({ ...prev, [bookId]: failedRec }));
    } finally {
      downloadControllersRef.current.delete(bookId);
    }
  };

  const handleImportOfflinePdf = useCallback(
    async (bookId: string, file: File) => {
      const buffer = await importLocalPdfFile(file);
      const sha256 = await computeSha256Hex(buffer);
      const completedRec: DownloadRecord = {
        bookId,
        status: 'downloaded',
        progress: 100,
        bytesDownloaded: buffer.byteLength,
        totalBytes: buffer.byteLength,
        sha256,
        pdfUrl: `local://${file.name}`,
        downloadedAt: Date.now(),
      };
      await saveDownloadedPdf(bookId, buffer, completedRec);
      setDownloads((prev) => ({ ...prev, [bookId]: completedRec }));
    },
    []
  );

  const handlePauseDownload = async (bookId: string) => {
    downloadControllersRef.current.get(bookId)?.abort();
    downloadControllersRef.current.delete(bookId);
    const prev = downloads[bookId];
    if (!prev) return;
    const pausedRec: DownloadRecord = { ...prev, status: 'paused' };
    setDownloads((d) => ({ ...d, [bookId]: pausedRec }));
    await saveDownloadRecord(pausedRec);
  };

  const handleCancelDownload = async (bookId: string) => {
    downloadControllersRef.current.get(bookId)?.abort();
    downloadControllersRef.current.delete(bookId);
    await deleteDownloadedPdf(bookId);
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[bookId];
      return next;
    });
  };

  const handleDeleteDownload = async (bookId: string) => {
    await deleteDownloadedPdf(bookId);
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[bookId];
      return next;
    });
  };

  // Personal Data Mutations
  const handleToggleFavorite = (bookId: string) => {
    setDb((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(bookId)
        ? prev.favorites.filter((id) => id !== bookId)
        : [bookId, ...prev.favorites],
    }));
  };

  const handleChangeStatus = (bookId: string, status: ReadingStatus) => {
    setDb((prev) => {
      const existing = prev.progressByBook[bookId];
      const book = catalog.books.find((b) => b.id === bookId);
      const now = Date.now();
      return {
        ...prev,
        progressByBook: {
          ...prev.progressByBook,
          [bookId]: {
            bookId,
            currentPage: existing?.currentPage ?? 1,
            totalPages: existing?.totalPages ?? book?.pageCount ?? 10,
            status,
            lastReadAt: now,
            completedAt:
              status === 'completed'
                ? existing?.completedAt ?? now
                : undefined,
            totalSecondsRead: existing?.totalSecondsRead ?? 0,
          },
        },
      };
    });
  };

  const handleCreateCustomList = (name: string) => {
    setDb((prev) => ({
      ...prev,
      customLists: [
        ...prev.customLists,
        { id: makeId('list'), name, bookIds: [], createdAt: Date.now() },
      ],
    }));
  };

  const handleToggleCustomList = (listId: string, bookId: string) => {
    setDb((prev) => ({
      ...prev,
      customLists: prev.customLists.map((l) => {
        if (l.id !== listId) return l;
        const exists = l.bookIds.includes(bookId);
        return {
          ...l,
          bookIds: exists
            ? l.bookIds.filter((id) => id !== bookId)
            : [...l.bookIds, bookId],
        };
      }),
    }));
  };

  const handleSaveProgress = useCallback(
    (bookId: string, page: number, totalPages: number) => {
      setDb((prev) => {
        const existing = prev.progressByBook[bookId];
        const nextStatus: ReadingStatus =
          page >= totalPages && totalPages > 1
            ? 'completed'
            : existing?.status === 'completed'
              ? 'completed'
              : 'reading';
        const now = Date.now();

        return {
          ...prev,
          progressByBook: {
            ...prev.progressByBook,
            [bookId]: {
              bookId,
              currentPage: page,
              totalPages,
              status: nextStatus,
              lastReadAt: now,
              completedAt:
                nextStatus === 'completed'
                  ? existing?.completedAt ?? now
                  : existing?.completedAt,
              totalSecondsRead: existing?.totalSecondsRead ?? 0,
            },
          },
        };
      });
    },
    []
  );

  const handleRecordSession = useCallback(
    (bookId: string, durationSeconds: number, pagesRead: number, dateKey: string) => {
      if (durationSeconds <= 0) return;
      setDb((prev) => {
        const existing = prev.progressByBook[bookId];
        return {
          ...prev,
          sessions: [
            ...prev.sessions,
            {
              id: makeId('sess'),
              bookId,
              dateKey,
              startTime: Date.now() - durationSeconds * 1000,
              endTime: Date.now(),
              durationSeconds,
              pagesRead,
            },
          ],
          progressByBook: existing
            ? {
                ...prev.progressByBook,
                [bookId]: {
                  ...existing,
                  totalSecondsRead: existing.totalSecondsRead + durationSeconds,
                },
              }
            : prev.progressByBook,
        };
      });
    },
    []
  );

  const handleUpdateYearlyGoal = useCallback((goal: YearlyReadingGoal) => {
    setDb((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        reminders: {
          ...prev.settings.reminders,
          yearlyGoals: {
            ...(prev.settings.reminders.yearlyGoals ?? {}),
            [String(goal.year)]: goal,
          },
        },
      },
    }));
  }, []);

  const handleLogManualSession = useCallback(
    (input: {
      bookId: string;
      durationMinutes: number;
      pagesRead: number;
      dateKey: string;
      markCompleted: boolean;
    }) => {
      const durationSeconds = Math.max(60, Math.round(input.durationMinutes * 60));
      const [yy, mm, dd] = input.dateKey.split('-').map(Number);
      const sessionTimestamp = new Date(yy, (mm || 1) - 1, dd || 1, 18, 0, 0).getTime();

      setDb((prev) => {
        const book = catalog.books.find((b) => b.id === input.bookId);
        const existing = prev.progressByBook[input.bookId];
        const totalPages = existing?.totalPages ?? book?.pageCount ?? Math.max(10, input.pagesRead);
        const nextPage = input.markCompleted
          ? totalPages
          : Math.min(totalPages, (existing?.currentPage ?? 0) + input.pagesRead);
        const nextStatus: ReadingStatus = input.markCompleted
          ? 'completed'
          : existing?.status === 'completed'
            ? 'completed'
            : 'reading';

        return {
          ...prev,
          sessions: [
            ...prev.sessions,
            {
              id: makeId('sess'),
              bookId: input.bookId,
              dateKey: input.dateKey,
              startTime: sessionTimestamp - durationSeconds * 1000,
              endTime: sessionTimestamp,
              durationSeconds,
              pagesRead: Math.max(0, input.pagesRead),
            },
          ],
          progressByBook: {
            ...prev.progressByBook,
            [input.bookId]: {
              bookId: input.bookId,
              currentPage: Math.max(1, nextPage),
              totalPages,
              status: nextStatus,
              lastReadAt: Math.max(existing?.lastReadAt ?? 0, sessionTimestamp),
              completedAt: input.markCompleted
                ? sessionTimestamp
                : existing?.completedAt,
              totalSecondsRead: (existing?.totalSecondsRead ?? 0) + durationSeconds,
            },
          },
        };
      });
    },
    [catalog.books]
  );

  const handleAddHighlight = (
    bookId: string,
    page: number,
    text: string,
    color: HighlightColor,
    rects: HighlightRect[]
  ): Highlight => {
    const newHl: Highlight = {
      id: makeId('hl'),
      bookId,
      page,
      text,
      color,
      rects,
      createdAt: Date.now(),
    };
    setDb((prev) => ({ ...prev, highlights: [newHl, ...prev.highlights] }));
    return newHl;
  };

  const handleAddNote = (
    bookId: string,
    page: number,
    title: string,
    content: string,
    highlightId?: string
  ) => {
    const now = Date.now();
    setDb((prev) => ({
      ...prev,
      notes: [
        {
          id: makeId('note'),
          bookId,
          page,
          highlightId,
          title,
          content,
          createdAt: now,
          updatedAt: now,
        },
        ...prev.notes,
      ],
    }));
  };

  const handleUpdateNote = (id: string, title: string, content: string) => {
    setDb((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === id ? { ...n, title, content, updatedAt: Date.now() } : n
      ),
    }));
  };

  const handleAddBookmark = (bookId: string, page: number, label: string) => {
    setDb((prev) => ({
      ...prev,
      bookmarks: [
        { id: makeId('bm'), bookId, page, label, createdAt: Date.now() },
        ...prev.bookmarks,
      ],
    }));
  };

  // Show Onboarding on first launch
  if (!db.settings.onboardingCompleted) {
    return (
      <OnboardingWizard
        categories={catalog.categories}
        initialGoal={db.settings.reminders}
        initialInterests={db.settings.interests}
        initialName={db.settings.userName}
        onComplete={({ userName, reminders, interests }) => {
          setDb((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              userName,
              reminders,
              interests,
              onboardingCompleted: true,
            },
          }));
        }}
      />
    );
  }

  const activeDownloadCount = Object.values(downloads).filter(
    (d) => d.status === 'downloading'
  ).length;

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Dedicated full-page reader route */}
        <Route
          path="/read/:bookId"
          element={
            <ReaderRoute
              catalog={catalog}
              db={db}
              downloads={downloads}
              isOnline={isOnline}
              isSyncing={isSyncing}
              activeDownloadCount={activeDownloadCount}
              onCloseToBook={(id) => navigate(`/book/${encodeURIComponent(id)}`)}
              onUpdatePreferences={(patch: Partial<ReaderPreferences>) =>
                setDb((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    reader: { ...prev.settings.reader, ...patch },
                  },
                }))
              }
              onSaveProgress={handleSaveProgress}
              onRecordSession={handleRecordSession}
              onAddHighlight={handleAddHighlight}
              onAddNote={handleAddNote}
              onAddBookmark={handleAddBookmark}
              onDeleteHighlight={(id) =>
                setDb((prev) => ({
                  ...prev,
                  highlights: prev.highlights.filter((h) => h.id !== id),
                }))
              }
              onDeleteBookmark={(id) =>
                setDb((prev) => ({
                  ...prev,
                  bookmarks: prev.bookmarks.filter((bm) => bm.id !== id),
                }))
              }
              onDeleteNote={(id) =>
                setDb((prev) => ({
                  ...prev,
                  notes: prev.notes.filter((n) => n.id !== id),
                }))
              }
              onImportOfflinePdf={handleImportOfflinePdf}
            />
          }
        />

        {/* Main navigation shell routes */}
        <Route
          element={
            <NavigationShell
              isOnline={isOnline}
              activeDownloadCount={activeDownloadCount}
            />
          }
        >
          <Route
            path="/"
            element={
              <HomeView
                catalog={catalog}
                db={db}
                stats={stats}
                downloads={downloads}
                isSyncing={isSyncing}
                syncStatusMessage={syncStatusMessage}
                activeReminderBanner={activeReminderBanner}
                onDismissReminderBanner={() => setActiveReminderBanner(null)}
                onRefreshCatalog={() => handleRefreshCatalog()}
                onOpenBook={openBookDetail}
                onReadBook={openPdfReader}
                onOpenAuthor={openAuthorProfile}
                onExploreAll={(cat) => {
                  const query = cat
                    ? `?category=${encodeURIComponent(cat)}`
                    : '';
                  navigate(`/library${query}`);
                }}
                onDismissRecommendation={(bookId) =>
                  setDb((prev) => ({
                    ...prev,
                    notInterestedIds: [...prev.notInterestedIds, bookId],
                  }))
                }
              />
            }
          />
          <Route
            path="/library"
            element={
              <LibraryRoute
                catalog={catalog}
                db={db}
                downloads={downloads}
                onOpenBook={openBookDetail}
                onOpenAuthor={openAuthorProfile}
                onCreateCustomList={handleCreateCustomList}
                onOpenDownloads={() => navigate('/downloads')}
              />
            }
          />
          <Route
            path="/reading"
            element={
              <ReadingDeskView
                catalog={catalog}
                db={db}
                downloads={downloads}
                onReadBook={openPdfReader}
                onOpenBook={openBookDetail}
                onExploreLibrary={() => navigate('/library')}
              />
            }
          />
          <Route
            path="/knowledge"
            element={
              <KnowledgeHubView
                catalog={catalog}
                db={db}
                onOpenReader={openPdfReader}
                onOpenBook={openBookDetail}
                onDeleteHighlight={(id) =>
                  setDb((prev) => ({
                    ...prev,
                    highlights: prev.highlights.filter((h) => h.id !== id),
                  }))
                }
                onDeleteNote={(id) =>
                  setDb((prev) => ({
                    ...prev,
                    notes: prev.notes.filter((n) => n.id !== id),
                  }))
                }
                onUpdateNote={handleUpdateNote}
                onDeleteBookmark={(id) =>
                  setDb((prev) => ({
                    ...prev,
                    bookmarks: prev.bookmarks.filter((bm) => bm.id !== id),
                  }))
                }
              />
            }
          />
          <Route
            path="/stats"
            element={
              <ReadingDashboardView
                catalog={catalog}
                db={db}
                stats={stats}
                onUpdateYearlyGoal={handleUpdateYearlyGoal}
                onLogManualSession={handleLogManualSession}
                onOpenReminders={() => navigate('/settings')}
              />
            }
          />
          <Route
            path="/dashboard"
            element={
              <ReadingDashboardView
                catalog={catalog}
                db={db}
                stats={stats}
                onUpdateYearlyGoal={handleUpdateYearlyGoal}
                onLogManualSession={handleLogManualSession}
                onOpenReminders={() => navigate('/settings')}
              />
            }
          />
          <Route
            path="/book/:bookId"
            element={
              <BookDetailRoute
                catalog={catalog}
                db={db}
                downloads={downloads}
                isSyncing={isSyncing}
                onRecordRecentlyViewed={recordRecentlyViewed}
                onBack={() => navigateBackOrFallback('/library')}
                onReadNow={openPdfReader}
                onDownloadBook={handleStartDownload}
                onImportOfflinePdf={handleImportOfflinePdf}
                onDeleteDownload={handleDeleteDownload}
                onToggleFavorite={handleToggleFavorite}
                onChangeStatus={handleChangeStatus}
                onToggleCustomList={handleToggleCustomList}
                onOpenBook={openBookDetail}
                onOpenAuthor={openAuthorProfile}
              />
            }
          />
          <Route
            path="/author/:authorId"
            element={
              <AuthorProfileRoute
                catalog={catalog}
                db={db}
                downloads={downloads}
                isSyncing={isSyncing}
                onBack={() => navigateBackOrFallback('/library')}
                onOpenBook={openBookDetail}
                onOpenAuthor={openAuthorProfile}
              />
            }
          />
          <Route
            path="/downloads"
            element={
              <DownloadsView
                catalog={catalog}
                downloads={downloads}
                onBack={() => navigateBackOrFallback('/library')}
                onStartDownload={handleStartDownload}
                onPauseDownload={handlePauseDownload}
                onCancelDownload={handleCancelDownload}
                onDeleteDownload={handleDeleteDownload}
                onOpenReader={(id) => openPdfReader(id)}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsView
                catalog={catalog}
                db={db}
                syncStatusMessage={syncStatusMessage}
                onBack={() => navigateBackOrFallback('/')}
                onUpdateSettings={(updater: (prev: AppSettings) => AppSettings) =>
                  setDb((prev) => ({ ...prev, settings: updater(prev.settings) }))
                }
                onRefreshCatalog={handleRefreshCatalog}
                onImportCustomCatalogJson={(jsonText) => {
                  try {
                    const parsed = JSON.parse(jsonText);
                    const normalized = validateAndNormalizeCatalog(parsed);
                    saveCatalogCache(normalized, 'local-file');
                    setCatalog(normalized);
                    setSyncStatusMessage(
                      `Loaded ${normalized.books.length} books from imported JSON catalog.`
                    );
                    return {
                      ok: true,
                      message: `Loaded ${normalized.books.length} books successfully.`,
                    };
                  } catch (err) {
                    return {
                      ok: false,
                      message:
                        err instanceof Error ? err.message : 'Invalid catalog JSON file.',
                    };
                  }
                }}
                onRestoreMergedDb={(merged) => setDb(merged)}
                onOpenDownloads={() => navigate('/downloads')}
                onReplayOnboarding={() => {
                  navigate('/');
                  setDb((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, onboardingCompleted: false },
                  }));
                }}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
