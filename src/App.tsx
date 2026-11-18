import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthorProfileView } from './components/AuthorProfileView';
import { BookDetailView } from './components/BookDetailView';
import { DownloadsView } from './components/DownloadsView';
import { HomeView } from './components/HomeView';
import { KnowledgeHubView } from './components/KnowledgeHubView';
import { LibraryView } from './components/LibraryView';
import { NavigationShell } from './components/NavigationShell';
import { OnboardingWizard } from './components/OnboardingWizard';
import { PdfReaderView } from './components/PdfReaderView';
import { ReadingDeskView } from './components/ReadingDeskView';
import { SettingsView } from './components/SettingsView';
import { StatsView } from './components/StatsView';
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
  verifyPdfMagicHeader,
} from './services/pdfService';
import type {
  ActiveTab,
  AppSettings,
  CatalogData,
  DownloadRecord,
  Highlight,
  HighlightColor,
  HighlightRect,
  PersonalDatabase,
  ReaderPreferences,
  ReadingStatus,
  SubView,
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

export default function App() {
  const isOnline = useOnlineStatus();

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

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState(
    'Loaded locally cached catalog.'
  );
  const [downloads, setDownloads] = useState<Record<string, DownloadRecord>>({});
  const downloadControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [subViewStack, setSubViewStack] = useState<SubView[]>([]);
  const [libraryFilterCategory, setLibraryFilterCategory] = useState<string>('All');
  const [libraryFilterScope, setLibraryFilterScope] = useState<LibraryFilterScope>('all');
  const [readerState, setReaderState] = useState<{ bookId: string; page: number } | null>(
    null
  );
  const [activeReminderBanner, setActiveReminderBanner] = useState<string | null>(null);

  const currentSubView: SubView =
    subViewStack.length > 0 ? subViewStack[subViewStack.length - 1] : { type: 'none' };

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

  // Navigation Helpers
  const pushSubView = (view: SubView) => {
    setSubViewStack((prev) => [...prev, view]);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const popSubView = () => {
    setSubViewStack((prev) => prev.slice(0, -1));
  };

  const selectMainTab = (tab: ActiveTab) => {
    setSubViewStack([]);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const openBookDetail = (bookId: string) => {
    setDb((prev) => ({
      ...prev,
      recentlyViewed: [
        bookId,
        ...prev.recentlyViewed.filter((id) => id !== bookId),
      ].slice(0, 30),
    }));
    pushSubView({ type: 'book_detail', bookId });
  };

  const openAuthorProfile = (authorId: string) => {
    pushSubView({ type: 'author_profile', authorId });
  };

  const openPdfReader = (bookId: string, page?: number) => {
    const existingPage = db.progressByBook[bookId]?.currentPage ?? 1;
    setReaderState({ bookId, page: page ?? existingPage });
  };

  // Download Manager Actions
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
      return {
        ...prev,
        progressByBook: {
          ...prev.progressByBook,
          [bookId]: {
            bookId,
            currentPage: existing?.currentPage ?? 1,
            totalPages: existing?.totalPages ?? book?.pageCount ?? 10,
            status,
            lastReadAt: Date.now(),
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

        return {
          ...prev,
          progressByBook: {
            ...prev.progressByBook,
            [bookId]: {
              bookId,
              currentPage: page,
              totalPages,
              status: nextStatus,
              lastReadAt: Date.now(),
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

  // Fullscreen PDF Reader overlay if open
  if (readerState) {
    const readerBook = catalog.books.find((b) => b.id === readerState.bookId);
    if (readerBook) {
      const readerAuthor = catalog.authors.find(
        (a) => a.id === readerBook.authorId
      );
      return (
        <PdfReaderView
          book={readerBook}
          author={readerAuthor}
          initialPage={readerState.page}
          isOnline={isOnline}
          isDownloaded={downloads[readerBook.id]?.status === 'downloaded'}
          preferences={db.settings.reader}
          highlights={db.highlights.filter((h) => h.bookId === readerBook.id)}
          notes={db.notes.filter((n) => n.bookId === readerBook.id)}
          bookmarks={db.bookmarks.filter((bm) => bm.bookId === readerBook.id)}
          onClose={() => setReaderState(null)}
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
        />
      );
    }
  }

  const activeDownloadCount = Object.values(downloads).filter(
    (d) => d.status === 'downloading'
  ).length;

  const renderBody = () => {
    if (currentSubView.type === 'book_detail') {
      const book = catalog.books.find((b) => b.id === currentSubView.bookId);
      if (book) {
        return (
          <BookDetailView
            book={book}
            author={catalog.authors.find((a) => a.id === book.authorId)}
            catalog={catalog}
            db={db}
            downloadRecord={downloads[book.id]}
            onBack={popSubView}
            onReadNow={openPdfReader}
            onDownloadBook={handleStartDownload}
            onDeleteDownload={handleDeleteDownload}
            onToggleFavorite={handleToggleFavorite}
            onChangeStatus={handleChangeStatus}
            onToggleCustomList={handleToggleCustomList}
            onOpenBook={openBookDetail}
            onOpenAuthor={openAuthorProfile}
          />
        );
      }
    }

    if (currentSubView.type === 'author_profile') {
      const author = catalog.authors.find(
        (a) => a.id === currentSubView.authorId
      );
      if (author) {
        return (
          <AuthorProfileView
            author={author}
            catalog={catalog}
            db={db}
            downloads={downloads}
            onBack={popSubView}
            onOpenBook={openBookDetail}
            onOpenAuthor={openAuthorProfile}
          />
        );
      }
    }

    if (currentSubView.type === 'downloads') {
      return (
        <DownloadsView
          catalog={catalog}
          downloads={downloads}
          onBack={popSubView}
          onStartDownload={handleStartDownload}
          onPauseDownload={handlePauseDownload}
          onCancelDownload={handleCancelDownload}
          onDeleteDownload={handleDeleteDownload}
          onOpenReader={(id) => openPdfReader(id)}
        />
      );
    }

    if (currentSubView.type === 'settings') {
      return (
        <SettingsView
          catalog={catalog}
          db={db}
          syncStatusMessage={syncStatusMessage}
          onBack={popSubView}
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
          onOpenDownloads={() => pushSubView({ type: 'downloads' })}
          onReplayOnboarding={() => {
            setSubViewStack([]);
            setDb((prev) => ({
              ...prev,
              settings: { ...prev.settings, onboardingCompleted: false },
            }));
          }}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
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
              setLibraryFilterCategory(cat ?? 'All');
              setLibraryFilterScope('all');
              selectMainTab('library');
            }}
            onDismissRecommendation={(bookId) =>
              setDb((prev) => ({
                ...prev,
                notInterestedIds: [...prev.notInterestedIds, bookId],
              }))
            }
          />
        );
      case 'library':
        return (
          <LibraryView
            catalog={catalog}
            db={db}
            downloads={downloads}
            initialCategory={libraryFilterCategory}
            initialScope={libraryFilterScope}
            onOpenBook={openBookDetail}
            onOpenAuthor={openAuthorProfile}
            onCreateCustomList={handleCreateCustomList}
            onOpenDownloads={() => pushSubView({ type: 'downloads' })}
          />
        );
      case 'reading':
        return (
          <ReadingDeskView
            catalog={catalog}
            db={db}
            downloads={downloads}
            onReadBook={openPdfReader}
            onOpenBook={openBookDetail}
            onExploreLibrary={() => selectMainTab('library')}
          />
        );
      case 'knowledge':
        return (
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
        );
      case 'stats':
        return (
          <StatsView
            stats={stats}
            onOpenReminders={() => pushSubView({ type: 'settings' })}
          />
        );
    }
  };

  return (
    <NavigationShell
      activeTab={activeTab}
      subView={currentSubView}
      isOnline={isOnline}
      activeDownloadCount={activeDownloadCount}
      onSelectTab={selectMainTab}
      onOpenSearch={() => {
        setLibraryFilterCategory('All');
        setLibraryFilterScope('all');
        selectMainTab('library');
      }}
      onOpenDownloads={() => pushSubView({ type: 'downloads' })}
      onOpenSettings={() => pushSubView({ type: 'settings' })}
    >
      {renderBody()}
    </NavigationShell>
  );
}
