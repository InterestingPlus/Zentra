import React from 'react';
import { CheckCircle2, Download, Heart } from 'lucide-react';
import type { Book, DownloadRecord, ReadingProgress } from '../types/zentra';
import { BookCover } from './BookCover';

interface BookCardProps {
  book: Book;
  authorName: string;
  progress?: ReadingProgress;
  downloadRecord?: DownloadRecord;
  isFavorite: boolean;
  onOpenBook: (bookId: string) => void;
  onOpenAuthor: (authorId: string) => void;
  compact?: boolean;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  authorName,
  progress,
  downloadRecord,
  isFavorite,
  onOpenBook,
  onOpenAuthor,
  compact = false,
}) => {
  const totalPages = progress?.totalPages || book.pageCount || 10;
  const pct =
    progress && progress.status !== 'unread'
      ? Math.min(100, Math.round((progress.currentPage / Math.max(1, totalPages)) * 100))
      : 0;

  const isDownloaded = downloadRecord?.status === 'downloaded';

  return (
    <article
      className={`group flex flex-col ${
        compact ? 'w-36 sm:w-40 shrink-0' : 'w-full'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenBook(book.id)}
        aria-label={`Open ${book.title} by ${authorName}`}
        className="relative text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-xl transition-transform duration-200 group-hover:-translate-y-0.5"
      >
        <BookCover
          book={book}
          authorName={authorName}
          progressPercent={pct > 0 ? pct : undefined}
        />
        {(isFavorite || isDownloaded || progress?.status === 'completed') && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-950/75 text-white px-1.5 py-1 rounded-md backdrop-blur-xs">
            {progress?.status === 'completed' && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-label="Completed" />
            )}
            {isDownloaded && (
              <Download className="w-3.5 h-3.5 text-blue-300" aria-label="Downloaded offline" />
            )}
            {isFavorite && (
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" aria-label="Favorite" />
            )}
          </div>
        )}
      </button>

      <div className="mt-2.5 flex flex-col gap-0.5 min-w-0">
        <button
          type="button"
          onClick={() => onOpenBook(book.id)}
          className="text-left font-display font-semibold text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 line-clamp-2 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
        >
          {book.title}
        </button>

        <button
          type="button"
          onClick={() => onOpenAuthor(book.authorId)}
          className="text-left text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 truncate w-fit max-w-full py-0.5"
        >
          {authorName}
        </button>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {book.language && book.language !== 'English' && (
            <>
              <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">
                {book.language}
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="truncate">{book.category}</span>
          {pct > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-blue-700 dark:text-blue-400 font-medium shrink-0">
                {pct}%
              </span>
            </>
          )}
          {pct === 0 && book.pageCount && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular shrink-0">{book.pageCount}p</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
};
