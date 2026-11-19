import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ArrowLeft,
  Bookmark as BookmarkIcon,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Highlighter,
  List,
  Maximize2,
  Minimize2,
  Search,
  Sliders,
  Sun,
  Upload,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getDownloadedPdfBuffer } from '../services/offlineStorage';
import {
  fetchOrSynthesizePdf,
  getDriveDownloadUrl,
  getDrivePreviewUrl,
} from '../services/pdfService';
import type {
  Author,
  Book,
  Bookmark,
  Highlight,
  HighlightColor,
  HighlightRect,
  Note,
  ReaderMode,
  ReaderPreferences,
  ReaderTheme,
} from '../types/zentra';
import { toDateKey } from '../utils/analyticsLogic';
import {
  computeDoublePageSpread,
  computeNextSpreadPage,
  computePrevSpreadPage,
} from '../utils/readerLogic';
import { PdfPageCanvas } from './PdfPageCanvas';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfReaderViewProps {
  book: Book;
  author?: Author;
  initialPage: number;
  isOnline: boolean;
  isDownloaded: boolean;
  preferences: ReaderPreferences;
  highlights: Highlight[];
  notes: Note[];
  bookmarks: Bookmark[];
  onClose: () => void;
  onUpdatePreferences: (patch: Partial<ReaderPreferences>) => void;
  onSaveProgress: (bookId: string, page: number, totalPages: number) => void;
  onRecordSession: (bookId: string, durationSeconds: number, pagesRead: number, dateKey: string) => void;
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
  onImportOfflinePdf?: (bookId: string, file: File) => Promise<void>;
}

export const PdfReaderView: React.FC<PdfReaderViewProps> = ({
  book,
  author,
  initialPage,
  isOnline,
  isDownloaded,
  preferences,
  highlights,
  notes,
  bookmarks,
  onClose,
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
  const readerRootRef = useRef<HTMLDivElement>(null);
  const localPdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [readerEngine, setReaderEngine] = useState<'drive_embed' | 'pdfjs'>('pdfjs');
  const [preferStudyEdition, setPreferStudyEdition] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [loadError, setLoadError] = useState<'offline_unavailable' | string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(book.pageCount ?? 10);
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, initialPage));
  const [mode, setMode] = useState<ReaderMode>(preferences.defaultMode);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(preferences.readerTheme);
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1);
  const [fitMode, setFitMode] = useState<'page' | 'width'>('page');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [turnDirection, setTurnDirection] = useState<'next' | 'prev' | null>(null);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  const drivePreviewUrl = getDrivePreviewUrl(book);
  const driveDownloadUrl = getDriveDownloadUrl(book);

  // Panels & popovers
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showAnnotationsDrawer, setShowAnnotationsDrawer] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ page: number; snippet: string }>>([]);
  const [isSearchingPdf, setIsSearchingPdf] = useState(false);

  // Knowledge capture popovers
  const [pendingSelection, setPendingSelection] = useState<{
    page: number;
    text: string;
    rects: HighlightRect[];
  } | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [attachedHighlightId, setAttachedHighlightId] = useState<string | undefined>(undefined);

  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [jumpInput, setJumpInput] = useState('');
  const [hasSelectableTextWarning, setHasSelectableTextWarning] = useState(false);

  // Active reading session tracking (genuine active seconds only)
  const activeSecondsRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const visitedPagesRef = useRef<Set<number>>(new Set([Math.max(1, initialPage)]));
  const currentPageRef = useRef(currentPage);
  const totalPagesRef = useRef(totalPages);
  currentPageRef.current = currentPage;
  totalPagesRef.current = totalPages;

  const markUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Viewport resize listener
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load PDF (Offline IndexedDB -> Embedded Google Drive Reader if online -> Direct/Study PDF.js)
  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedDoc: PDFDocumentProxy | null = null;

    async function load() {
      setLoadingPdf(true);
      setLoadError(null);
      setPdfDoc(null);
      try {
        let buffer = await getDownloadedPdfBuffer(book.id);

        if (!buffer && drivePreviewUrl && !preferStudyEdition) {
          if (!isOnline && !isDownloaded) {
            if (!cancelled) {
              setLoadError('offline_unavailable');
              setLoadingPdf(false);
            }
            return;
          }
          if (!cancelled) {
            setReaderEngine('drive_embed');
            const fallbackPages = book.pageCount ?? 10;
            setTotalPages(fallbackPages);
            const start = Math.max(1, Math.min(initialPage, fallbackPages));
            setCurrentPage(start);
            onSaveProgress(book.id, start, fallbackPages);
            setLoadingPdf(false);
          }
          return;
        }

        if (!buffer) {
          if (!isOnline && !isDownloaded) {
            if (!cancelled) {
              setLoadError('offline_unavailable');
              setLoadingPdf(false);
            }
            return;
          }
          buffer = await fetchOrSynthesizePdf(book, author, {
            forceStudyEdition: preferStudyEdition,
          });
        }

        if (cancelled) return;
        setReaderEngine('pdfjs');
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        loadedDoc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }
        setPdfDoc(loadedDoc);
        setTotalPages(loadedDoc.numPages);
        const clampedStart = Math.max(1, Math.min(initialPage, loadedDoc.numPages));
        setCurrentPage(clampedStart);
        onSaveProgress(book.id, clampedStart, loadedDoc.numPages);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Unable to open PDF document.'
          );
        }
      } finally {
        if (!cancelled) setLoadingPdf(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      loadedDoc?.cleanup?.();
      loadingTask?.destroy().catch(() => {});
    };
  }, [book.id, book.pdfUrl, isOnline, isDownloaded, drivePreviewUrl, preferStudyEdition]);

  // WakeLock while reading if enabled
  useEffect(() => {
    let wakeLock: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (preferences.keepScreenAwake && nav.wakeLock?.request) {
      nav.wakeLock
        .request('screen')
        .then((wl) => {
          wakeLock = wl;
        })
        .catch(() => {});
    }
    return () => {
      wakeLock?.release().catch(() => {});
    };
  }, [preferences.keepScreenAwake]);

  // Genuine active reading timer + periodic progress persistence
  useEffect(() => {
    const flushSession = () => {
      if (activeSecondsRef.current >= 3) {
        onRecordSession(
          book.id,
          activeSecondsRef.current,
          visitedPagesRef.current.size,
          toDateKey(new Date())
        );
        activeSecondsRef.current = 0;
        visitedPagesRef.current = new Set([currentPageRef.current]);
      }
      onSaveProgress(book.id, currentPageRef.current, totalPagesRef.current);
    };

    const interval = setInterval(() => {
      const isVisible = document.visibilityState === 'visible';
      const isActiveRecently = Date.now() - lastActivityRef.current < 90_000;
      if (isVisible && isActiveRecently && !loadingPdf && !loadError) {
        activeSecondsRef.current += 1;
      }
      if (activeSecondsRef.current > 0 && activeSecondsRef.current % 10 === 0) {
        onSaveProgress(book.id, currentPageRef.current, totalPagesRef.current);
      }
    }, 1000);

    window.addEventListener('beforeunload', flushSession);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', flushSession);
      flushSession();
    };
  }, [book.id, loadingPdf, loadError]);

  // Save progress whenever page changes
  useEffect(() => {
    if (!loadingPdf && !loadError && totalPages > 0) {
      visitedPagesRef.current.add(currentPage);
      onSaveProgress(book.id, currentPage, totalPages);
    }
  }, [currentPage, totalPages, book.id, loadingPdf, loadError]);

  const goToPage = useCallback(
    (targetPage: number, direction?: 'next' | 'prev') => {
      markUserActivity();
      const clamped = Math.max(1, Math.min(totalPages, targetPage));
      if (direction && preferences.pageTurnAnimation) {
        setTurnDirection(direction);
        setTimeout(() => setTurnDirection(null), 240);
      }
      setCurrentPage(clamped);
      setPendingSelection(null);
    },
    [totalPages, preferences.pageTurnAnimation, markUserActivity]
  );

  const handleNextPage = useCallback(() => {
    const next = computeNextSpreadPage(
      currentPage,
      totalPages,
      mode === 'double',
      preferences.coverSpreadOffset
    );
    if (next !== currentPage) goToPage(next, 'next');
  }, [currentPage, totalPages, mode, preferences.coverSpreadOffset, goToPage]);

  const handlePrevPage = useCallback(() => {
    const prev = computePrevSpreadPage(
      currentPage,
      totalPages,
      mode === 'double',
      preferences.coverSpreadOffset
    );
    if (prev !== currentPage) goToPage(prev, 'prev');
  }, [currentPage, totalPages, mode, preferences.coverSpreadOffset, goToPage]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'ArrowRight') handleNextPage();
      if (e.key === 'ArrowLeft') handlePrevPage();
      if (e.key === 'Escape') {
        if (pendingSelection) setPendingSelection(null);
        else if (showSettingsSheet) setShowSettingsSheet(false);
        else if (showAnnotationsDrawer) setShowAnnotationsDrawer(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNextPage, handlePrevPage, pendingSelection, showSettingsSheet, showAnnotationsDrawer]);

  // Search inside PDF text
  const handleRunPdfSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfDoc || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearchingPdf(true);
    const q = searchQuery.trim().toLowerCase();
    const matches: Array<{ page: number; snippet: string }> = [];
    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const tc = await page.getTextContent();
      const fullText = tc.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ');
      const idx = fullText.toLowerCase().indexOf(q);
      if (idx !== -1) {
        const start = Math.max(0, idx - 32);
        const end = Math.min(fullText.length, idx + q.length + 48);
        matches.push({
          page: p,
          snippet: `…${fullText.slice(start, end).trim()}…`,
        });
      }
    }
    setSearchResults(matches);
    setIsSearchingPdf(false);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && readerRootRef.current) {
      await readerRootRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Compute responsive target page width
  const marginPad =
    preferences.pageMarginSize === 'compact'
      ? 16
      : preferences.pageMarginSize === 'wide'
        ? 64
        : 32;

  const basePageWidth = useMemo(() => {
    const avail = Math.max(280, viewportWidth - marginPad * 2);
    if (mode === 'double') {
      const spreadCap = fitMode === 'width' ? avail / 2 - 8 : Math.min(500, avail / 2 - 8);
      return Math.max(240, Math.round(spreadCap * zoomMultiplier));
    }
    const singleCap = fitMode === 'width' ? Math.min(960, avail) : Math.min(640, avail);
    return Math.max(260, Math.round(singleCap * zoomMultiplier));
  }, [viewportWidth, marginPad, mode, fitMode, zoomMultiplier]);

  const spread = computeDoublePageSpread(
    currentPage,
    totalPages,
    preferences.coverSpreadOffset
  );

  const progressPct = Math.round((currentPage / Math.max(1, totalPages)) * 100);

  const surfaceBgClass =
    readerTheme === 'dark'
      ? 'bg-[#0F1218] text-slate-100'
      : readerTheme === 'sepia'
        ? 'bg-[#F4ECD8] text-stone-900'
        : 'bg-[#F1F5F9] text-slate-900';

  const chromeBgClass =
    readerTheme === 'dark'
      ? 'bg-[#161B22]/95 border-slate-800 text-slate-100'
      : readerTheme === 'sepia'
        ? 'bg-[#EAE0C8]/95 border-stone-300 text-stone-900'
        : 'bg-white/95 border-slate-200 text-slate-900';

  const handleSaveHighlight = (color: HighlightColor, alsoAddNote = false) => {
    if (!pendingSelection) return;
    const created = onAddHighlight(
      book.id,
      pendingSelection.page,
      pendingSelection.text,
      color,
      pendingSelection.rects
    );
    window.getSelection()?.removeAllRanges();
    if (alsoAddNote) {
      setAttachedHighlightId(created.id);
      setNoteTitle(`Note on page ${pendingSelection.page}`);
      setNoteContent('');
      setShowNoteModal(true);
    }
    setPendingSelection(null);
  };

  const handleCreateBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    onAddBookmark(
      book.id,
      currentPage,
      bookmarkLabel.trim() || `Page ${currentPage} Bookmark`
    );
    setBookmarkLabel('');
    setShowBookmarkModal(false);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    onAddNote(
      book.id,
      currentPage,
      noteTitle.trim() || `Page ${currentPage} Reflection`,
      noteContent.trim(),
      attachedHighlightId
    );
    setNoteTitle('');
    setNoteContent('');
    setAttachedHighlightId(undefined);
    setShowNoteModal(false);
  };

  // Swipe support for touch screens
  const touchStartXRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.getSelection()?.toString()) return;
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || mode === 'vertical') return;
    if (window.getSelection()?.toString()) {
      touchStartXRef.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(dx) > 60) {
      if (dx < 0) handleNextPage();
      else handlePrevPage();
    }
  };

  const handleAttachLocalPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportOfflinePdf) return;
    setImportError(null);
    try {
      await onImportOfflinePdf(book.id, file);
      setPreferStudyEdition(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import PDF file.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      ref={readerRootRef}
      onMouseMove={markUserActivity}
      onKeyDown={markUserActivity}
      className={`min-h-screen h-dvh flex flex-col ${surfaceBgClass} transition-colors`}
    >
      <input
        ref={localPdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleAttachLocalPdf}
        className="hidden"
      />

      {/* Brightness dimmer overlay */}
      {preferences.brightnessPercent < 100 && (
        <div
          className="fixed inset-0 pointer-events-none z-[60] bg-black"
          style={{ opacity: (100 - preferences.brightnessPercent) / 115 }}
          aria-hidden="true"
        />
      )}

      {/* Top Reader Toolbar */}
      {controlsVisible && (
        <header
          className={`h-14 px-3 sm:px-6 border-b backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-30 ${chromeBgClass}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Exit PDF reader"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-sm sm:text-base truncate">
                {book.title}
              </h1>
              <p className="text-[11px] opacity-70 truncate">
                {author?.name ?? book.authorName} ·{' '}
                {isDownloaded
                  ? 'Offline Copy'
                  : readerEngine === 'drive_embed'
                    ? 'Google Drive Reader'
                    : 'Study Edition'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {drivePreviewUrl && !isDownloaded && (
              <button
                type="button"
                onClick={() => setPreferStudyEdition((v) => !v)}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-current/15 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 min-h-[36px] whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                {preferStudyEdition ? 'Full Drive PDF' : 'Study Notes PDF'}
              </button>
            )}

            {driveDownloadUrl && !isDownloaded && (
              <a
                href={driveDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download original PDF from Google Drive"
                title="Download original PDF"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Download className="w-4 h-4" />
              </a>
            )}

            {onImportOfflinePdf && !isDownloaded && (
              <button
                type="button"
                onClick={() => localPdfInputRef.current?.click()}
                aria-label="Import local PDF file for offline reading"
                title="Attach downloaded PDF for offline reading"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Upload className="w-4 h-4" />
              </button>
            )}

            {readerEngine === 'pdfjs' && (
              <button
                type="button"
                onClick={() => setShowSearchBar((v) => !v)}
                aria-label="Search within PDF text"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setBookmarkLabel(`Page ${currentPage}`);
                setShowBookmarkModal(true);
              }}
              aria-label="Bookmark current page"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
            >
              <BookmarkIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setAttachedHighlightId(undefined);
                setNoteTitle(`Page ${currentPage} Note`);
                setShowNoteModal(true);
              }}
              aria-label="Add note on current page"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowAnnotationsDrawer((v) => !v)}
              aria-label="View notes, highlights, and bookmarks"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
            >
              <List className="w-4 h-4" />
            </button>

            {readerEngine === 'pdfjs' && (
              <button
                type="button"
                onClick={() => setShowSettingsSheet((v) => !v)}
                aria-label="Reader appearance and layout settings"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="hidden sm:flex min-w-[40px] min-h-[40px] items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setControlsVisible(false)}
              aria-label="Hide reading controls"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {importError && (
        <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-200 flex items-center justify-between">
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            aria-label="Dismiss import error"
            className="p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Show Controls floating trigger when hidden */}
      {!controlsVisible && (
        <button
          type="button"
          onClick={() => setControlsVisible(true)}
          aria-label="Show reading controls"
          className="fixed top-3 right-3 z-40 min-w-[44px] min-h-[44px] rounded-full bg-slate-900/75 text-white flex items-center justify-center backdrop-blur-xs shadow-lg"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}

      {/* Search Bar Overlay */}
      {showSearchBar && controlsVisible && (
        <div className={`px-4 py-3 border-b z-20 ${chromeBgClass}`}>
          <form onSubmit={handleRunPdfSearch} className="max-w-2xl mx-auto flex gap-2">
            <label htmlFor="pdf-text-search" className="sr-only">
              Search inside PDF
            </label>
            <input
              id="pdf-text-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search words inside this PDF…"
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-medium min-h-[40px]"
            >
              {isSearchingPdf ? 'Searching…' : 'Find'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSearchBar(false);
                setSearchResults([]);
              }}
              aria-label="Close PDF search"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="max-w-2xl mx-auto mt-2.5 max-h-40 overflow-y-auto space-y-1.5">
              {searchResults.map((res, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    goToPage(res.page);
                    setShowSearchBar(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-blue-500/15 text-xs flex items-center justify-between gap-3"
                >
                  <span className="truncate">{res.snippet}</span>
                  <span className="font-mono-tabular font-semibold shrink-0">
                    Page {res.page}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main PDF Reading Surface */}
      <div
        className={`flex-1 relative flex justify-center ${
          readerEngine === 'drive_embed' && !loadingPdf && !loadError
            ? 'overflow-hidden p-0'
            : 'overflow-auto items-start p-4 sm:p-8'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loadingPdf ? (
          <div className="my-auto text-center space-y-3">
            <div className="w-10 h-10 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm opacity-80">Opening book pages…</p>
          </div>
        ) : loadError === 'offline_unavailable' ? (
          <div className="my-auto max-w-md p-8 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center space-y-4 text-slate-900 dark:text-white">
            <WifiOff className="w-10 h-10 text-amber-600 mx-auto" />
            <h2 className="font-display text-2xl font-semibold">
              Book Unavailable Offline
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You are currently offline and “{book.title}” has not been saved to Zentra’s
              offline vault yet. Reconnect to read online, or attach a downloaded PDF file.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {onImportOfflinePdf && (
                <button
                  type="button"
                  onClick={() => localPdfInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-medium min-h-[44px]"
                >
                  Attach Local PDF
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium min-h-[44px]"
              >
                Back to Book Details
              </button>
            </div>
          </div>
        ) : loadError ? (
          <div className="my-auto max-w-md p-8 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <p className="font-display text-xl font-semibold">Unable to open PDF</p>
            <p className="text-sm opacity-75">{loadError}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium min-h-[44px]"
            >
              Return
            </button>
          </div>
        ) : readerEngine === 'drive_embed' && drivePreviewUrl ? (
          <iframe
            src={drivePreviewUrl}
            title={`${book.title} PDF Reader`}
            allow="autoplay; fullscreen"
            className="w-full h-full border-0 bg-white"
            data-testid="drive-pdf-iframe"
          />
        ) : pdfDoc ? (
          <div className="w-full flex flex-col items-center">
            {hasSelectableTextWarning && (
              <div className="mb-4 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs">
                This page contains no selectable text layer (scanned/image PDF). Page notes and
                bookmarks remain available.
              </div>
            )}

            {mode === 'vertical' ? (
              <div className="flex flex-col items-center gap-6 pb-10">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                  <div key={pNum} className="space-y-1.5 text-center">
                    <PdfPageCanvas
                      pdfDoc={pdfDoc}
                      pageNumber={pNum}
                      targetWidth={basePageWidth}
                      readerTheme={readerTheme}
                      highlights={highlights.filter((h) => h.page === pNum)}
                      onPageMeasured={(_, hasText) => {
                        if (!hasText) setHasSelectableTextWarning(true);
                      }}
                      onTextSelected={(page, text, rects) =>
                        setPendingSelection({ page, text, rects })
                      }
                    />
                    <p className="text-[11px] font-mono-tabular opacity-60">Page {pNum}</p>
                  </div>
                ))}
              </div>
            ) : mode === 'double' ? (
              <div
                className={`relative flex items-stretch justify-center my-auto rounded-lg overflow-hidden shadow-2xl ${
                  turnDirection === 'next'
                    ? 'animate-page-next'
                    : turnDirection === 'prev'
                      ? 'animate-page-prev'
                      : ''
                }`}
              >
                {/* Left Spread Page */}
                {spread.leftPage ? (
                  <PdfPageCanvas
                    pdfDoc={pdfDoc}
                    pageNumber={spread.leftPage}
                    targetWidth={basePageWidth}
                    readerTheme={readerTheme}
                    highlights={highlights.filter((h) => h.page === spread.leftPage)}
                    onPageMeasured={(_, hasText) => {
                      if (!hasText) setHasSelectableTextWarning(true);
                    }}
                    onTextSelected={(page, text, rects) =>
                      setPendingSelection({ page, text, rects })
                    }
                  />
                ) : (
                  <div
                    style={{
                      width: basePageWidth,
                      height: Math.round(basePageWidth * 1.414),
                    }}
                    className={`flex items-center justify-center border-r border-slate-200/60 dark:border-slate-800 ${
                      readerTheme === 'dark'
                        ? 'bg-[#141820]'
                        : readerTheme === 'sepia'
                          ? 'bg-[#EDE3CB]'
                          : 'bg-slate-100'
                    }`}
                    aria-label="Blank inside cover"
                  >
                    <span className="font-display italic text-sm opacity-35">Zentra</span>
                  </div>
                )}

                {/* Realistic Center Book Spine Gutter */}
                <div
                  className="w-4 sm:w-6 book-spread-spine pointer-events-none z-10 -mx-2 sm:-mx-3"
                  aria-hidden="true"
                />

                {/* Right Spread Page */}
                {spread.rightPage ? (
                  <PdfPageCanvas
                    pdfDoc={pdfDoc}
                    pageNumber={spread.rightPage}
                    targetWidth={basePageWidth}
                    readerTheme={readerTheme}
                    highlights={highlights.filter((h) => h.page === spread.rightPage)}
                    onPageMeasured={(_, hasText) => {
                      if (!hasText) setHasSelectableTextWarning(true);
                    }}
                    onTextSelected={(page, text, rects) =>
                      setPendingSelection({ page, text, rects })
                    }
                  />
                ) : (
                  <div
                    style={{
                      width: basePageWidth,
                      height: Math.round(basePageWidth * 1.414),
                    }}
                    className="bg-transparent"
                  />
                )}
              </div>
            ) : (
              /* Single Page Mode */
              <div
                className={`my-auto ${
                  turnDirection === 'next'
                    ? 'animate-page-next'
                    : turnDirection === 'prev'
                      ? 'animate-page-prev'
                      : ''
                }`}
              >
                <PdfPageCanvas
                  pdfDoc={pdfDoc}
                  pageNumber={currentPage}
                  targetWidth={basePageWidth}
                  readerTheme={readerTheme}
                  highlights={highlights.filter((h) => h.page === currentPage)}
                  onPageMeasured={(_, hasText) => {
                    if (!hasText) setHasSelectableTextWarning(true);
                  }}
                  onTextSelected={(page, text, rects) =>
                    setPendingSelection({ page, text, rects })
                  }
                />
              </div>
            )}
          </div>
        ) : null}

        {/* Left/Right Edge Tap Zones in Single & Double Mode */}
        {mode !== 'vertical' && pdfDoc && (
          <>
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-14 rounded-xl bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={
                mode === 'double'
                  ? (spread.rightPage ?? spread.leftPage ?? currentPage) >= totalPages
                  : currentPage >= totalPages
              }
              aria-label="Next page"
              className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-14 rounded-xl bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center disabled:opacity-20 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Floating Text Selection Highlight Toolbar */}
      {pendingSelection && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white shadow-xl flex items-center gap-3">
          <Highlighter className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">Highlight:</span>
          {(['amber', 'sky', 'sage', 'rose'] as HighlightColor[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleSaveHighlight(c, false)}
              aria-label={`Highlight in ${c}`}
              className={`w-6 h-6 rounded-full border border-white/40 ${
                c === 'amber'
                  ? 'bg-amber-400'
                  : c === 'sky'
                    ? 'bg-sky-400'
                    : c === 'sage'
                      ? 'bg-emerald-400'
                      : 'bg-rose-400'
              }`}
            />
          ))}
          <button
            type="button"
            onClick={() => handleSaveHighlight('amber', true)}
            className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-medium whitespace-nowrap"
          >
            + Note
          </button>
          <button
            type="button"
            onClick={() => setPendingSelection(null)}
            aria-label="Cancel selection"
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Reader Progress & Navigation Bar (PDF.js engine only) */}
      {controlsVisible && readerEngine === 'pdfjs' && pdfDoc && (
        <footer
          className={`px-4 sm:px-6 py-2.5 border-t backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0 z-30 ${chromeBgClass}`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <span className="text-xs font-mono-tabular whitespace-nowrap">
              {mode === 'double' && spread.leftPage && spread.rightPage
                ? `Pages ${spread.leftPage}–${spread.rightPage} / ${totalPages}`
                : `Page ${currentPage} / ${totalPages}`}
            </span>
            <input
              type="range"
              aria-label="Reading page scrubber"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
              className="flex-1 accent-blue-700 cursor-pointer"
            />
            <span className="text-xs font-mono-tabular font-semibold whitespace-nowrap">
              {progressPct}%
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const p = Number(jumpInput);
                if (!isNaN(p) && p >= 1) {
                  goToPage(p);
                  setJumpInput('');
                }
              }}
              className="flex items-center gap-1"
            >
              <label htmlFor="jump-page-input" className="sr-only">
                Jump to page number
              </label>
              <input
                id="jump-page-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Go #"
                className="w-16 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-mono-tabular text-center"
              />
            </form>

            <button
              type="button"
              onClick={() => setZoomMultiplier((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
              aria-label="Zoom out"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomMultiplier((z) => Math.min(2.2, +(z + 0.15).toFixed(2)))}
              aria-label="Zoom in"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </footer>
      )}

      {/* Reader Appearance & Mode Sheet */}
      {showSettingsSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowSettingsSheet(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#161B22] text-slate-900 dark:text-white p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Reader Display</h2>
              <button
                type="button"
                onClick={() => setShowSettingsSheet(false)}
                aria-label="Close reader settings"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Reading Mode</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('single');
                    onUpdatePreferences({ defaultMode: 'single' });
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 ${
                    mode === 'single'
                      ? 'bg-blue-700 border-blue-700 text-white'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Single Page
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('double');
                    onUpdatePreferences({ defaultMode: 'double' });
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 ${
                    mode === 'double'
                      ? 'bg-blue-700 border-blue-700 text-white'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Columns2 className="w-4 h-4" />
                  Book Spread
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('vertical');
                    onUpdatePreferences({ defaultMode: 'vertical' });
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 ${
                    mode === 'vertical'
                      ? 'bg-blue-700 border-blue-700 text-white'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Vertical
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Surface Theme</p>
              <div className="grid grid-cols-3 gap-2">
                {(['light', 'sepia', 'dark'] as ReaderTheme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setReaderTheme(t);
                      onUpdatePreferences({ readerTheme: t });
                    }}
                    className={`py-2.5 rounded-xl border text-xs font-medium capitalize ${
                      readerTheme === t
                        ? 'ring-2 ring-blue-600 border-blue-600'
                        : 'border-slate-200 dark:border-slate-700'
                    } ${
                      t === 'light'
                        ? 'bg-white text-slate-900'
                        : t === 'sepia'
                          ? 'bg-[#F4ECD8] text-stone-900'
                          : 'bg-[#12161E] text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Fit & Alignment</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFitMode('page');
                    setZoomMultiplier(1);
                  }}
                  className={`py-2 rounded-xl border text-xs font-medium ${
                    fitMode === 'page'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Fit to Page
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFitMode('width');
                    setZoomMultiplier(1);
                  }}
                  className={`py-2 rounded-xl border text-xs font-medium ${
                    fitMode === 'width'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Fit to Width
                </button>
              </div>
            </div>

            {mode === 'double' && (
              <label className="flex items-center justify-between gap-3 text-xs cursor-pointer">
                <span>Shift book spread alignment (pair pages 1–2)</span>
                <input
                  type="checkbox"
                  checked={preferences.coverSpreadOffset}
                  onChange={(e) =>
                    onUpdatePreferences({ coverSpreadOffset: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-700"
                />
              </label>
            )}

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Sun className="w-3.5 h-3.5" />
                  Reading Brightness
                </span>
                <span className="font-mono-tabular">{preferences.brightnessPercent}%</span>
              </div>
              <input
                type="range"
                aria-label="Reading brightness"
                min={55}
                max={100}
                value={preferences.brightnessPercent}
                onChange={(e) =>
                  onUpdatePreferences({ brightnessPercent: Number(e.target.value) })
                }
                className="w-full accent-blue-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Annotations, Notes & Bookmarks Drawer */}
      {showAnnotationsDrawer && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex justify-end"
          onClick={() => setShowAnnotationsDrawer(false)}
        >
          <div
            className="w-full max-w-md h-full bg-white dark:bg-[#161B22] text-slate-900 dark:text-white p-6 overflow-y-auto space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Book Knowledge</h2>
              <button
                type="button"
                onClick={() => setShowAnnotationsDrawer(false)}
                aria-label="Close book annotations drawer"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Bookmarks ({bookmarks.length})
              </h3>
              {bookmarks.length === 0 ? (
                <p className="text-xs text-slate-500">No bookmarks in this book yet.</p>
              ) : (
                bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        goToPage(bm.page);
                        setShowAnnotationsDrawer(false);
                      }}
                      className="text-left text-sm font-medium hover:text-blue-700"
                    >
                      {bm.label} · <span className="font-mono-tabular text-xs">p.{bm.page}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBookmark(bm.id)}
                      className="text-xs text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Highlights ({highlights.length})
              </h3>
              {highlights.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Select text on any page to highlight passages.
                </p>
              ) : (
                highlights.map((hl) => (
                  <div
                    key={hl.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        goToPage(hl.page);
                        setShowAnnotationsDrawer(false);
                      }}
                      className="text-left text-xs font-display italic line-clamp-3 hover:text-blue-700"
                    >
                      “{hl.text}” (p.{hl.page})
                    </button>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onDeleteHighlight(hl.id)}
                        className="text-[11px] text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Notes ({notes.length})
              </h3>
              {notes.length === 0 ? (
                <p className="text-xs text-slate-500">No personal notes added yet.</p>
              ) : (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        goToPage(n.page);
                        setShowAnnotationsDrawer(false);
                      }}
                      className="text-left text-sm font-semibold hover:text-blue-700"
                    >
                      {n.title} · <span className="font-mono-tabular text-xs">p.{n.page}</span>
                    </button>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{n.content}</p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onDeleteNote(n.id)}
                        className="text-[11px] text-rose-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bookmark Modal */}
      {showBookmarkModal && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onClick={() => setShowBookmarkModal(false)}
        >
          <form
            onSubmit={handleCreateBookmark}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#161B22] text-slate-900 dark:text-white p-6 space-y-4 shadow-2xl"
          >
            <h2 className="font-display text-xl font-semibold">
              Bookmark Page {currentPage}
            </h2>
            <div>
              <label
                htmlFor="bookmark-name-input"
                className="block text-xs font-medium text-slate-500 mb-1.5"
              >
                Bookmark name
              </label>
              <input
                id="bookmark-name-input"
                type="text"
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                placeholder={`Page ${currentPage}`}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBookmarkModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-700 text-white text-xs font-medium min-h-[40px]"
              >
                Save Bookmark
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onClick={() => setShowNoteModal(false)}
        >
          <form
            onSubmit={handleSaveNote}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#161B22] text-slate-900 dark:text-white p-6 space-y-4 shadow-2xl"
          >
            <h2 className="font-display text-xl font-semibold">
              Add Note · Page {currentPage}
            </h2>
            <div>
              <label
                htmlFor="reader-note-title"
                className="block text-xs font-medium text-slate-500 mb-1"
              >
                Note title
              </label>
              <input
                id="reader-note-title"
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Summary or key idea"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="reader-note-content"
                className="block text-xs font-medium text-slate-500 mb-1"
              >
                Your note
              </label>
              <textarea
                id="reader-note-content"
                rows={4}
                required
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write your reflection or synthesis…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-700 text-white text-xs font-medium min-h-[40px]"
              >
                Save Note
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
