import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Flame,
  RefreshCw,
  Target,
  X,
} from 'lucide-react';
import { HERO_SANCTUARY_IMAGE } from '../data/seedCatalog';
import type {
  Author,
  Book,
  CatalogData,
  DownloadRecord,
  PersonalDatabase,
} from '../types/zentra';
import type { ReadingStatsSummary } from '../utils/analyticsLogic';
import { computeRecommendations, getAuthorName } from '../utils/catalogLogic';
import { BookCard } from './BookCard';
import { BookCover } from './BookCover';

interface HomeViewProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  stats: ReadingStatsSummary;
  downloads: Record<string, DownloadRecord>;
  isSyncing: boolean;
  syncStatusMessage: string;
  activeReminderBanner: string | null;
  onDismissReminderBanner: () => void;
  onRefreshCatalog: () => void;
  onOpenBook: (bookId: string) => void;
  onReadBook: (bookId: string, page?: number) => void;
  onOpenAuthor: (authorId: string) => void;
  onExploreAll: (category?: string) => void;
  onDismissRecommendation: (bookId: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const HomeView: React.FC<HomeViewProps> = ({
  catalog,
  db,
  stats,
  downloads,
  isSyncing,
  syncStatusMessage,
  activeReminderBanner,
  onDismissReminderBanner,
  onRefreshCatalog,
  onOpenBook,
  onReadBook,
  onOpenAuthor,
  onExploreAll,
  onDismissRecommendation,
}) => {
  const recs = computeRecommendations(catalog, db);

  const inProgressBooks = Object.values(db.progressByBook)
    .filter((p) => p.status === 'reading')
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .map((p) => ({
      progress: p,
      book: catalog.books.find((b) => b.id === p.bookId),
    }))
    .filter((x): x is { progress: NonNullable<typeof x.progress>; book: Book } => Boolean(x.book));

  const continuePrimary = inProgressBooks[0] ?? null;

  const recentlyOpened = db.recentlyViewed
    .map((id) => catalog.books.find((b) => b.id === id))
    .filter((b): b is Book => Boolean(b))
    .slice(0, 6);

  const popularRaw = catalog.books.filter((b) => b.popular);
  const popularBooks = (
    popularRaw.length > 0
      ? popularRaw
      : catalog.books.filter((b) => Boolean(b.coverUrl)).concat(catalog.books.filter((b) => !b.coverUrl))
  ).slice(0, 8);

  const featuredRaw = catalog.books.filter((b) => b.featured);
  const featuredBooks = (
    featuredRaw.length > 0
      ? featuredRaw
      : catalog.books.filter((b) => Boolean(b.coverUrl))
  ).slice(0, 8);

  const newlyAddedBooks = [...catalog.books]
    .sort((a, b) => (b.addedDate ?? '').localeCompare(a.addedDate ?? ''))
    .slice(0, 8);

  const discoverAuthors = catalog.authors.filter(
    (a) => a.name.trim().toLowerCase() !== 'unknown' && a.bookIds.length > 0
  );

  const goalPct = Math.min(
    100,
    Math.round((stats.todayMinutesRead / Math.max(1, stats.dailyGoalMinutes)) * 100)
  );

  const renderShelf = (title: string, books: Book[], allowDismiss = false) => {
    if (books.length === 0) return null;
    return (
      <section className="space-y-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <Link
            to="/library"
            className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 py-1"
          >
            Explore all
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto shelf-scroll pb-2">
          {books.map((book) => (
            <div key={book.id} className="relative shrink-0">
              <BookCard
                book={book}
                authorName={getAuthorName(book, catalog.authors)}
                progress={db.progressByBook[book.id]}
                downloadRecord={downloads[book.id]}
                isFavorite={db.favorites.includes(book.id)}
                onOpenBook={onOpenBook}
                onOpenAuthor={onOpenAuthor}
                compact
              />
              {allowDismiss && (
                <button
                  type="button"
                  onClick={() => onDismissRecommendation(book.id)}
                  aria-label={`Mark ${book.title} as not interested`}
                  title="Not interested"
                  className="absolute top-2 left-2 w-7 h-7 rounded-full bg-slate-950/70 text-white flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-8">
      {/* Gentle Reminder Banner if active */}
      {activeReminderBanner && (
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-between gap-4">
          <p className="text-sm text-blue-950 dark:text-blue-100">{activeReminderBanner}</p>
          <button
            type="button"
            onClick={onDismissReminderBanner}
            aria-label="Dismiss reading reminder"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Daily Habit Strip */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white mt-1 text-balance">
            {getGreeting()}, {db.settings.userName || 'Reader'}.
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <Link
            to="/stats"
            className="flex items-center gap-2.5 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors rounded-xl px-3.5 py-2"
          >
            <Target className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400 block">Daily goal</span>
              <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {stats.todayMinutesRead} / {stats.dailyGoalMinutes}m ({goalPct}%)
              </span>
            </div>
          </Link>

          <Link
            to="/stats"
            className="flex items-center gap-2.5 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors rounded-xl px-3.5 py-2"
          >
            <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400 block">Streak</span>
              <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                {stats.currentStreakDays} {stats.currentStreakDays === 1 ? 'day' : 'days'}
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onRefreshCatalog}
            disabled={isSyncing}
            aria-label="Refresh online book catalog"
            title={syncStatusMessage}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing…' : 'Sync catalog'}</span>
          </button>
        </div>
      </section>

      {/* Continue Reading Hero OR Editorial Discovery Hero */}
      {continuePrimary ? (
        <section className="rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 p-5 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <BookCover
            book={continuePrimary.book}
            authorName={getAuthorName(continuePrimary.book, catalog.authors)}
            progressPercent={Math.round(
              (continuePrimary.progress.currentPage /
                Math.max(1, continuePrimary.progress.totalPages)) *
                100
            )}
            size="lg"
            className="w-28 sm:w-36 shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-3">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Continue Reading
            </p>
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
                {continuePrimary.book.title}
              </h2>
              <Link
                to={`/author/${encodeURIComponent(continuePrimary.book.authorId)}`}
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mt-0.5 inline-block"
              >
                {getAuthorName(continuePrimary.book, catalog.authors)}
              </Link>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
              <span>
                Page {continuePrimary.progress.currentPage} of{' '}
                {continuePrimary.progress.totalPages}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {Math.round(
                  (continuePrimary.progress.currentPage /
                    Math.max(1, continuePrimary.progress.totalPages)) *
                    100
                )}
                % complete
              </span>
            </div>
            <div className="pt-1 flex flex-wrap items-center gap-3">
              <Link
                to={`/read/${encodeURIComponent(continuePrimary.book.id)}${
                  continuePrimary.progress.currentPage > 1
                    ? `?page=${continuePrimary.progress.currentPage}`
                    : ''
                }`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium min-h-[44px] whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-4 h-4" />
                Resume Page {continuePrimary.progress.currentPage}
              </Link>
              <Link
                to={`/book/${encodeURIComponent(continuePrimary.book.id)}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px] whitespace-nowrap shrink-0"
              >
                Book details
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[240px] sm:min-h-[280px] flex items-end">
          <img
            src={HERO_SANCTUARY_IMAGE}
            alt="Quiet reading desk with open hardcover book"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-tr from-slate-950/92 via-slate-950/65 to-slate-950/35"
            aria-hidden="true"
          />
          <div className="relative z-10 p-6 sm:p-8 max-w-2xl space-y-3 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-200">
              Featured Sanctuary Pick
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-balance">
              {featuredBooks[0]?.title ?? 'Begin Your Daily Reading Ritual'}
            </h2>
            <p className="text-sm text-slate-200 line-clamp-2">
              {featuredBooks[0]?.description ??
                'Open any book directly online or download for offline reading anywhere.'}
            </p>
            <div className="pt-1 flex flex-wrap gap-3">
              {featuredBooks[0] && (
                <Link
                  to={`/read/${encodeURIComponent(featuredBooks[0].id)}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-sm font-semibold min-h-[44px] whitespace-nowrap shrink-0"
                >
                  <BookOpen className="w-4 h-4" />
                  Start Reading
                </Link>
              )}
              <Link
                to="/library"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-xs text-white text-sm font-medium min-h-[44px] whitespace-nowrap shrink-0"
              >
                <Compass className="w-4 h-4" />
                Browse Catalog
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Shelves */}
      {renderShelf('Recently Opened', recentlyOpened)}
      {renderShelf('Recommended For You', recs.recommendedForYou, true)}

      {recs.becauseYouReadAnchor && recs.becauseYouReadBooks.length > 0 &&
        renderShelf(
          `Because You Read ${recs.becauseYouReadAnchor.title}`,
          recs.becauseYouReadBooks,
          true
        )}

      {/* Favorite / Featured Authors (Spotify-style row) */}
      <section className="space-y-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">
            Authors to Discover
          </h2>
        </div>

        <div className="flex gap-4 overflow-x-auto shelf-scroll pb-2">
          {discoverAuthors.map((author: Author) => (
            <Link
              key={author.id}
              to={`/author/${encodeURIComponent(author.id)}`}
              className="group w-32 sm:w-36 shrink-0 flex flex-col items-center text-center p-3 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                {author.photoUrl ? (
                  <img
                    src={author.photoUrl}
                    alt={author.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-xl font-semibold text-slate-700 dark:text-slate-200">
                    {author.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                )}
              </div>
              <span className="mt-2.5 text-sm font-medium text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                {author.name}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular mt-0.5">
                {author.bookIds.length} {author.bookIds.length === 1 ? 'book' : 'books'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {renderShelf('Popular Books', popularBooks)}
      {renderShelf('Featured Editions', featuredBooks)}
      {renderShelf('Recently Added', newlyAddedBooks)}

      {recs.exploreNewCategoryName &&
        recs.exploreNewCategoryBooks.length > 0 &&
        renderShelf(`Explore ${recs.exploreNewCategoryName}`, recs.exploreNewCategoryBooks)}

      {/* Category Quick Jump & Explore All CTA */}
      <section className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Browse by Discipline
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {catalog.categories.length} catalog categories · {catalog.books.length} books available
          </p>
        </div>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium min-h-[44px] whitespace-nowrap shrink-0 w-fit"
        >
          <span>Explore All Books</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
};
