import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  HardDrive,
  Pause,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { getStorageUsageSummary } from '../services/offlineStorage';
import type { Book, CatalogData, DownloadRecord } from '../types/zentra';
import { getAuthorName } from '../utils/catalogLogic';
import { BookCover } from './BookCover';

interface DownloadsViewProps {
  catalog: CatalogData;
  downloads: Record<string, DownloadRecord>;
  onBack: () => void;
  onStartDownload: (bookId: string) => void;
  onPauseDownload: (bookId: string) => void;
  onCancelDownload: (bookId: string) => void;
  onDeleteDownload: (bookId: string) => void;
  onOpenReader: (bookId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  catalog,
  downloads,
  onBack,
  onStartDownload,
  onPauseDownload,
  onCancelDownload,
  onDeleteDownload,
  onOpenReader,
}) => {
  const [storageInfo, setStorageInfo] = useState<{
    downloadedCount: number;
    downloadedBytes: number;
    quotaBytes: number | null;
    usageBytes: number | null;
  } | null>(null);

  useEffect(() => {
    getStorageUsageSummary().then(setStorageInfo);
  }, [downloads]);

  const records = Object.values(downloads).sort(
    (a, b) => (b.downloadedAt ?? 0) - (a.downloadedAt ?? 0)
  );

  const bookMap = new Map<string, Book>();
  catalog.books.forEach((b) => bookMap.set(b.id, b));

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white min-h-[44px] pr-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">
            Offline Downloads
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            PDFs stored in Zentra’s private app storage. Deleting an offline copy never erases
            notes or reading progress.
          </p>
        </div>
      </div>

      {/* Storage Summary */}
      <section className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              App-Managed Offline Storage
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
              {storageInfo
                ? `${storageInfo.downloadedCount} PDFs · ${formatBytes(
                    storageInfo.downloadedBytes
                  )} used${
                    storageInfo.quotaBytes
                      ? ` · ${formatBytes(storageInfo.quotaBytes)} available quota`
                      : ''
                  }`
                : 'Calculating storage…'}
            </p>
          </div>
        </div>
      </section>

      {/* Download Queue & Downloaded Books */}
      {records.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <Download className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="font-display text-lg font-medium text-slate-900 dark:text-white">
            No offline downloads yet
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Tap Download Offline on any book’s detail page to keep a verified copy ready without
            internet access.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((rec) => {
            const book = bookMap.get(rec.bookId);
            const authorName = book
              ? getAuthorName(book, catalog.authors)
              : 'Offline Archive';
            return (
              <div
                key={rec.bookId}
                className="p-4 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {book && (
                    <BookCover
                      book={book}
                      authorName={authorName}
                      size="sm"
                      className="shrink-0"
                    />
                  )}
                  <div className="min-w-0 space-y-1">
                    <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white truncate">
                      {book?.title ?? `Saved Book (${rec.bookId})`}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {authorName}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
                      {rec.status === 'downloaded' && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified ({formatBytes(rec.totalBytes)})
                        </span>
                      )}
                      {rec.status === 'downloading' && (
                        <span className="text-blue-700 dark:text-blue-400">
                          Downloading {rec.progress}%…
                        </span>
                      )}
                      {rec.status === 'paused' && (
                        <span className="text-amber-700 dark:text-amber-400">
                          Paused at {rec.progress}%
                        </span>
                      )}
                      {rec.status === 'failed' && (
                        <span className="text-rose-600 dark:text-rose-400">
                          Failed: {rec.error || 'Network interrupted'}
                        </span>
                      )}
                      {rec.sha256 && rec.status === 'downloaded' && (
                        <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                          SHA-256: {rec.sha256.slice(0, 10)}…
                        </span>
                      )}
                    </div>

                    {(rec.status === 'downloading' || rec.status === 'paused') && (
                      <div className="w-48 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-blue-700 dark:bg-blue-500 transition-all"
                          style={{ width: `${rec.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {rec.status === 'downloaded' && (
                    <button
                      type="button"
                      onClick={() => onOpenReader(rec.bookId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium min-h-[40px] whitespace-nowrap"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Read Offline
                    </button>
                  )}

                  {rec.status === 'downloading' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onPauseDownload(rec.bookId)}
                        aria-label="Pause download"
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCancelDownload(rec.bookId)}
                        aria-label="Cancel download"
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-rose-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {(rec.status === 'paused' || rec.status === 'failed') && (
                    <button
                      type="button"
                      onClick={() => onStartDownload(rec.bookId)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium min-h-[40px] whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry
                    </button>
                  )}

                  {rec.status === 'downloaded' && (
                    <button
                      type="button"
                      onClick={() => onDeleteDownload(rec.bookId)}
                      aria-label={`Delete offline copy of ${book?.title ?? rec.bookId}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
