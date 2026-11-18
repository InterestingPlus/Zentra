import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Download,
  Heart,
  Pause,
  Play,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { summaryTts, type TtsState } from '../services/ttsService';
import type {
  Author,
  Book,
  CatalogData,
  DownloadRecord,
  PersonalDatabase,
  ReadingStatus,
} from '../types/zentra';
import { getAuthorName } from '../utils/catalogLogic';
import { BookCard } from './BookCard';
import { BookCover } from './BookCover';

interface BookDetailViewProps {
  book: Book;
  author?: Author;
  catalog: CatalogData;
  db: PersonalDatabase;
  downloadRecord?: DownloadRecord;
  onBack: () => void;
  onReadNow: (bookId: string, page?: number) => void;
  onDownloadBook: (bookId: string) => void;
  onDeleteDownload: (bookId: string) => void;
  onToggleFavorite: (bookId: string) => void;
  onChangeStatus: (bookId: string, status: ReadingStatus) => void;
  onToggleCustomList: (listId: string, bookId: string) => void;
  onOpenBook: (bookId: string) => void;
  onOpenAuthor: (authorId: string) => void;
}

export const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  author,
  catalog,
  db,
  downloadRecord,
  onBack,
  onReadNow,
  onDownloadBook,
  onDeleteDownload,
  onToggleFavorite,
  onChangeStatus,
  onToggleCustomList,
  onOpenBook,
  onOpenAuthor,
}) => {
  const [ttsState, setTtsState] = useState<TtsState>(summaryTts.getState());
  const progress = db.progressByBook[book.id];
  const isFavorite = db.favorites.includes(book.id);
  const currentStatus: ReadingStatus = progress?.status ?? 'unread';

  useEffect(() => {
    return summaryTts.subscribe(setTtsState);
  }, []);

  const linkedAuthors = (book.authorIds && book.authorIds.length > 0 ? book.authorIds : [book.authorId])
    .map((id) => catalog.authors.find((a) => a.id === id))
    .filter((a): a is Author => Boolean(a));
  const authorName = author?.name ?? getAuthorName(book, catalog.authors);
  const moreByAuthor = catalog.books.filter(
    (b) =>
      b.id !== book.id &&
      (b.authorId === book.authorId || b.authorIds?.includes(book.authorId))
  );
  const relatedBooks = catalog.books.filter(
    (b) =>
      b.id !== book.id &&
      (book.relatedBookIds?.includes(b.id) || b.category === book.category)
  ).slice(0, 5);

  const isThisBookSpeaking = ttsState.currentBookId === book.id && ttsState.status !== 'idle';

  const handleToggleTts = () => {
    if (!ttsState.supported) return;
    if (!isThisBookSpeaking) {
      const fullSpeech = [
        `${book.title} by ${authorName}.`,
        book.summary || book.description,
        book.keyTakeaways.length > 0
          ? `Key takeaways. ${book.keyTakeaways.join('. ')}`
          : '',
      ].join(' ');
      summaryTts.play(book.id, fullSpeech);
    } else if (ttsState.status === 'playing') {
      summaryTts.pause();
    } else if (ttsState.status === 'paused') {
      summaryTts.resume();
    }
  };

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white min-h-[44px] pr-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Top Hero */}
      <section className="flex flex-col md:flex-row gap-7 items-start">
        <BookCover
          book={book}
          authorName={authorName}
          size="xl"
          progressPercent={
            progress && progress.status !== 'unread'
              ? Math.round((progress.currentPage / Math.max(1, progress.totalPages)) * 100)
              : undefined
          }
          className="mx-auto md:mx-0 shrink-0"
        />

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{book.category}</span>
            {book.subcategory && (
              <>
                <span aria-hidden="true">·</span>
                <span>{book.subcategory}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{book.language}</span>
            {book.pageCount && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{book.pageCount} pages</span>
              </>
            )}
            {book.publishedYear && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{book.publishedYear}</span>
              </>
            )}
            {book.publisher && (
              <>
                <span aria-hidden="true">·</span>
                <span>{book.publisher}</span>
              </>
            )}
            {book.isbn && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">ISBN {book.isbn}</span>
              </>
            )}
            {book.difficulty && (
              <>
                <span aria-hidden="true">·</span>
                <span>{book.difficulty}</span>
              </>
            )}
          </div>

          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white text-balance">
              {book.title}
            </h1>
            {book.subtitle && (
              <p className="mt-1.5 text-base text-slate-600 dark:text-slate-300">
                {book.subtitle}
              </p>
            )}
          </div>

          {/* Clickable Author Links */}
          <div className="flex flex-wrap items-center gap-2">
            {(linkedAuthors.length > 0
              ? linkedAuthors
              : [{ id: book.authorId, name: authorName, photoUrl: author?.photoUrl ?? '' }]
            ).map((authItem) => (
              <button
                key={authItem.id}
                type="button"
                onClick={() => onOpenAuthor(authItem.id)}
                className="inline-flex items-center gap-3 py-1.5 pr-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left min-h-[44px]"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  {authItem.photoUrl ? (
                    <img
                      src={authItem.photoUrl}
                      alt={authItem.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {authItem.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white block">
                    {authItem.name}
                  </span>
                  <span className="text-[11px] text-blue-700 dark:text-blue-400">
                    View author profile
                  </span>
                </div>
              </button>
            ))}
          </div>

          <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">
            {book.description}
          </p>

          {/* Primary Action Bar */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onReadNow(book.id, progress?.currentPage ?? 1)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold min-h-[48px] whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-4 h-4" />
              {progress && progress.currentPage > 1
                ? `Resume Reading (Page ${progress.currentPage})`
                : 'Read Now'}
            </button>

            {downloadRecord?.status === 'downloaded' ? (
              <div className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-medium min-h-[48px] whitespace-nowrap">
                  <Check className="w-4 h-4" />
                  Offline Ready
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteDownload(book.id)}
                  aria-label={`Remove offline copy of ${book.title}`}
                  title="Delete offline PDF"
                  className="min-w-[44px] min-h-[48px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 dark:text-slate-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : downloadRecord?.status === 'downloading' ? (
              <span className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 text-xs font-mono-tabular min-h-[48px]">
                Downloading {downloadRecord.progress}%…
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onDownloadBook(book.id)}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 min-h-[48px] whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                Download Offline
              </button>
            )}

            <button
              type="button"
              onClick={() => onToggleFavorite(book.id)}
              aria-pressed={isFavorite}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium min-h-[48px] whitespace-nowrap shrink-0 transition-colors ${
                isFavorite
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-slate-700 dark:text-slate-200'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              {isFavorite ? 'Favorited' : 'Favorite'}
            </button>
          </div>

          {/* Reading Status & Custom Lists */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <label htmlFor="book-status-select" className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Reading status:
            </label>
            <select
              id="book-status-select"
              value={currentStatus}
              onChange={(e) => onChangeStatus(book.id, e.target.value as ReadingStatus)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-800 dark:text-slate-100 min-h-[40px]"
            >
              <option value="unread">Not Started</option>
              <option value="want_to_read">Want to Read</option>
              <option value="reading">Currently Reading</option>
              <option value="completed">Completed</option>
            </select>

            {db.customLists.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">Lists:</span>
                {db.customLists.map((list) => {
                  const inList = list.bookIds.includes(book.id);
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => onToggleCustomList(list.id, book.id)}
                      aria-pressed={inList}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium min-h-[36px] transition-colors ${
                        inList
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {inList ? `✓ ${list.name}` : `+ ${list.name}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Listen Summary (TTS) Player */}
      <section className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Listen to Summary
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ttsState.supported
                ? isThisBookSpeaking
                  ? `${ttsState.status === 'paused' ? 'Paused' : 'Playing'} · ${ttsState.progressPercent}%`
                  : 'Device text-to-speech · Works offline'
                : 'Speech synthesis is not supported in this browser.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!ttsState.supported}
            onClick={handleToggleTts}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium min-h-[40px] disabled:opacity-40 whitespace-nowrap"
          >
            {isThisBookSpeaking && ttsState.status === 'playing' ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                {isThisBookSpeaking && ttsState.status === 'paused' ? 'Resume' : 'Listen Summary'}
              </>
            )}
          </button>

          {isThisBookSpeaking && (
            <button
              type="button"
              onClick={() => summaryTts.stop()}
              aria-label="Stop summary audio"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}

          <label htmlFor="tts-speed-select" className="sr-only">
            Speech rate
          </label>
          <select
            id="tts-speed-select"
            value={ttsState.rate}
            onChange={(e) => summaryTts.setRate(Number(e.target.value))}
            className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono-tabular min-h-[40px]"
          >
            <option value={0.85}>0.85x</option>
            <option value={1}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>
        </div>
      </section>

      {/* Complete Directly-Readable Summary & Takeaways */}
      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div>
            <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Book Summary
            </h2>
            <p className="mt-3 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {book.summary || book.description}
            </p>
          </div>

          {book.chapterSummaries && book.chapterSummaries.length > 0 && (
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Chapter-by-Chapter Breakdown
              </h3>
              <div className="space-y-4">
                {book.chapterSummaries.map((ch) => (
                  <div key={ch.chapterNumber} className="space-y-1">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {String(ch.chapterNumber).padStart(2, '0')}. {ch.title}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {ch.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {book.importantQuotes && book.importantQuotes.length > 0 && (
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Notable Passages
              </h3>
              <div className="space-y-3">
                {book.importantQuotes.map((q, idx) => (
                  <blockquote
                    key={idx}
                    className="py-3 border-y border-slate-200/80 dark:border-slate-800 font-display italic text-lg text-slate-800 dark:text-slate-200"
                  >
                    “{q}”
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {book.keyTakeaways.length > 0 && (
            <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Key Takeaways
              </h2>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                {book.keyTakeaways.map((item, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="font-mono-tabular text-xs text-blue-700 dark:text-blue-400 font-semibold mt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {book.practicalLessons && book.practicalLessons.length > 0 && (
            <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Practical Applications
              </h2>
              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 list-disc pl-4">
                {book.practicalLessons.map((lesson, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {lesson}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {book.tags.length > 0 && (
            <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Topics & Keywords
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {book.tags.join(' · ')}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* More by Author */}
      {moreByAuthor.length > 0 && (
        <section className="space-y-3.5">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            More from {authorName}
          </h2>
          <div className="flex gap-4 overflow-x-auto shelf-scroll pb-2">
            {moreByAuthor.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                authorName={authorName}
                progress={db.progressByBook[b.id]}
                downloadRecord={undefined}
                isFavorite={db.favorites.includes(b.id)}
                onOpenBook={onOpenBook}
                onOpenAuthor={onOpenAuthor}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Related Books */}
      {relatedBooks.length > 0 && (
        <section className="space-y-3.5">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Related Books
          </h2>
          <div className="flex gap-4 overflow-x-auto shelf-scroll pb-2">
            {relatedBooks.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                authorName={getAuthorName(b, catalog.authors)}
                progress={db.progressByBook[b.id]}
                downloadRecord={undefined}
                isFavorite={db.favorites.includes(b.id)}
                onOpenBook={onOpenBook}
                onOpenAuthor={onOpenAuthor}
                compact
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
