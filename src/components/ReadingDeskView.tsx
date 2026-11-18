import React from 'react';
import { BookOpen, Clock, Compass } from 'lucide-react';
import type {
  Book,
  CatalogData,
  DownloadRecord,
  PersonalDatabase,
} from '../types/zentra';
import { getAuthorName } from '../utils/catalogLogic';
import { BookCover } from './BookCover';

interface ReadingDeskViewProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  downloads: Record<string, DownloadRecord>;
  onReadBook: (bookId: string, page?: number) => void;
  onOpenBook: (bookId: string) => void;
  onExploreLibrary: () => void;
}

export const ReadingDeskView: React.FC<ReadingDeskViewProps> = ({
  catalog,
  db,
  downloads,
  onReadBook,
  onOpenBook,
  onExploreLibrary,
}) => {
  const activeBooks = Object.values(db.progressByBook)
    .filter((p) => p.status === 'reading')
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .map((p) => ({
      progress: p,
      book: catalog.books.find((b) => b.id === p.bookId),
    }))
    .filter((x): x is { progress: NonNullable<typeof x.progress>; book: Book } => Boolean(x.book));

  const wantToReadBooks = Object.values(db.progressByBook)
    .filter((p) => p.status === 'want_to_read')
    .map((p) => catalog.books.find((b) => b.id === p.bookId))
    .filter((b): b is Book => Boolean(b));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">
          Reading Desk
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Resume any active book from your exact last page, online or offline.
        </p>
      </div>

      {activeBooks.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <BookOpen className="w-10 h-10 text-blue-700 dark:text-blue-400 mx-auto" />
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              Your reading desk is open
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Pick a book from the catalog to start reading. Your progress, reading time, and
              saved page positions will appear right here.
            </p>
          </div>
          <button
            type="button"
            onClick={onExploreLibrary}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-medium min-h-[44px]"
          >
            <Compass className="w-4 h-4" />
            Browse Books
          </button>
        </div>
      ) : (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Currently Reading ({activeBooks.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {activeBooks.map(({ book, progress }) => {
              const authorName = getAuthorName(book, catalog.authors);
              const pct = Math.min(
                100,
                Math.round((progress.currentPage / Math.max(1, progress.totalPages)) * 100)
              );
              const isDownloaded = downloads[book.id]?.status === 'downloaded';

              return (
                <article
                  key={book.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 flex gap-4 items-center"
                >
                  <BookCover
                    book={book}
                    authorName={authorName}
                    progressPercent={pct}
                    size="lg"
                    className="w-24 sm:w-28 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <button
                      type="button"
                      onClick={() => onOpenBook(book.id)}
                      className="text-left font-display font-semibold text-lg text-slate-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 line-clamp-2"
                    >
                      {book.title}
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {authorName} · {isDownloaded ? 'Offline Ready' : 'Online'}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-mono-tabular text-slate-600 dark:text-slate-300">
                      <span>
                        Page {progress.currentPage}/{progress.totalPages} ({pct}%)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.round(progress.totalSecondsRead / 60)}m
                      </span>
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onReadBook(book.id, progress.currentPage)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium min-h-[40px]"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Continue Reading
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {wantToReadBooks.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Up Next · Want to Read ({wantToReadBooks.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wantToReadBooks.map((book) => {
              const authorName = getAuthorName(book, catalog.authors);
              return (
                <article
                  key={book.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <BookCover book={book} authorName={authorName} size="sm" className="shrink-0" />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenBook(book.id)}
                        className="text-left text-sm font-semibold text-slate-900 dark:text-white truncate block max-w-full"
                      >
                        {book.title}
                      </button>
                      <p className="text-xs text-slate-500 truncate">{authorName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onReadBook(book.id, 1)}
                    className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium min-h-[38px] shrink-0"
                  >
                    Start
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
