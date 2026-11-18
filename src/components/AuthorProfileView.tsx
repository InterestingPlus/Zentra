import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type {
  Author,
  CatalogData,
  DownloadRecord,
  PersonalDatabase,
} from '../types/zentra';
import { BookCard } from './BookCard';

interface AuthorProfileViewProps {
  author: Author;
  catalog: CatalogData;
  db: PersonalDatabase;
  downloads: Record<string, DownloadRecord>;
  onBack: () => void;
  onOpenBook: (bookId: string) => void;
  onOpenAuthor: (authorId: string) => void;
}

export const AuthorProfileView: React.FC<AuthorProfileViewProps> = ({
  author,
  catalog,
  db,
  downloads,
  onBack,
  onOpenBook,
  onOpenAuthor,
}) => {
  const authorBooks = catalog.books.filter(
    (b) => b.authorId === author.id || b.authorIds?.includes(author.id)
  );
  const popularBooks = authorBooks.filter((b) => b.popular || b.featured);
  const relatedAuthors = (author.relatedAuthorIds ?? [])
    .map((id) => catalog.authors.find((a) => a.id === id))
    .filter((a): a is Author => Boolean(a));

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

      {/* Spotify-inspired Author Hero */}
      <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center sm:items-end gap-6">
        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 book-cover-shadow">
          {author.photoUrl ? (
            <img
              src={author.photoUrl}
              alt={author.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-display text-4xl font-semibold text-slate-700 dark:text-slate-200">
              {author.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
          )}
        </div>

        <div className="text-center sm:text-left space-y-2 flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Author Profile ·{' '}
            <span className="font-mono-tabular">
              {authorBooks.length} {authorBooks.length === 1 ? 'book' : 'books'} in Zentra
            </span>
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white">
            {author.name}
          </h1>
          {author.expertise && author.expertise.length > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {author.expertise.join(' · ')}
            </p>
          )}
        </div>
      </section>

      {/* Biography */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Biography & Background
        </h2>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{author.bio}</p>
        {author.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {author.description}
          </p>
        )}
      </section>

      {/* Popular Works */}
      {popularBooks.length > 0 && (
        <section className="space-y-3.5">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Popular Works
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {popularBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                authorName={author.name}
                progress={db.progressByBook[book.id]}
                downloadRecord={downloads[book.id]}
                isFavorite={db.favorites.includes(book.id)}
                onOpenBook={onOpenBook}
                onOpenAuthor={onOpenAuthor}
              />
            ))}
          </div>
        </section>
      )}

      {/* All Books by Author */}
      <section className="space-y-3.5">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          All Books by {author.name}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {authorBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              authorName={author.name}
              progress={db.progressByBook[book.id]}
              downloadRecord={downloads[book.id]}
              isFavorite={db.favorites.includes(book.id)}
              onOpenBook={onOpenBook}
              onOpenAuthor={onOpenAuthor}
            />
          ))}
        </div>
      </section>

      {/* Related Authors */}
      {relatedAuthors.length > 0 && (
        <section className="space-y-3.5">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Related Authors
          </h2>
          <div className="flex flex-wrap gap-4">
            {relatedAuthors.map((rel) => (
              <button
                key={rel.id}
                type="button"
                onClick={() => onOpenAuthor(rel.id)}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 hover:border-blue-400 transition-colors min-h-[56px]"
              >
                <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  {rel.photoUrl ? (
                    <img
                      src={rel.photoUrl}
                      alt={rel.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-semibold">
                      {rel.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{rel.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                    {rel.bookIds.length} {rel.bookIds.length === 1 ? 'book' : 'books'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
