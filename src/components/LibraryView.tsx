import React, { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Search, SlidersHorizontal, X } from 'lucide-react';
import type {
  CatalogData,
  DownloadRecord,
  PersonalDatabase,
} from '../types/zentra';
import {
  type BookSortOption,
  filterAndSortBooks,
  getAuthorName,
  type LibraryFilterScope,
} from '../utils/catalogLogic';
import { BookCard } from './BookCard';

interface LibraryViewProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  downloads: Record<string, DownloadRecord>;
  initialCategory?: string;
  initialScope?: LibraryFilterScope;
  onOpenBook: (bookId: string) => void;
  onOpenAuthor: (authorId: string) => void;
  onCreateCustomList: (name: string) => void;
  onOpenDownloads: () => void;
}

const SCOPES: Array<{ id: LibraryFilterScope; label: string }> = [
  { id: 'all', label: 'All Books' },
  { id: 'reading', label: 'Reading' },
  { id: 'want_to_read', label: 'Want to Read' },
  { id: 'completed', label: 'Completed' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'downloaded', label: 'Downloaded' },
  { id: 'recent', label: 'History' },
];

export const LibraryView: React.FC<LibraryViewProps> = ({
  catalog,
  db,
  downloads,
  initialCategory = 'All',
  initialScope = 'all',
  onOpenBook,
  onOpenAuthor,
  onCreateCustomList,
  onOpenDownloads,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [scope, setScope] = useState<LibraryFilterScope>(initialScope);
  const [customListId, setCustomListId] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<BookSortOption>('popular');
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setScope(initialScope);
  }, [initialScope]);

  const downloadedIds = useMemo(
    () =>
      new Set(
        Object.values(downloads)
          .filter((d) => d.status === 'downloaded')
          .map((d) => d.bookId)
      ),
    [downloads]
  );

  const languages = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const b of catalog.books) set.add(b.language);
    return Array.from(set);
  }, [catalog.books]);

  const searchSuggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    const matches = new Set<string>();
    for (const b of catalog.books) {
      if (b.title.toLowerCase().includes(q)) matches.add(b.title);
      const author = getAuthorName(b, catalog.authors);
      if (author.toLowerCase().includes(q)) matches.add(author);
      for (const t of b.tags) {
        if (t.toLowerCase().includes(q)) matches.add(t);
      }
      if (matches.size >= 5) break;
    }
    return Array.from(matches).slice(0, 5);
  }, [query, catalog.books, catalog.authors]);

  const filteredBooks = useMemo(
    () =>
      filterAndSortBooks(catalog, db, {
        query,
        category: selectedCategory,
        language: selectedLanguage,
        scope,
        customListId,
        sortBy,
        downloadedBookIds: downloadedIds,
      }),
    [catalog, db, query, selectedCategory, selectedLanguage, scope, customListId, sortBy, downloadedIds]
  );

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    onCreateCustomList(newListName.trim());
    setNewListName('');
    setShowNewListForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">
            Explore & Library
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse the online catalog, filter your personal shelves, and manage custom lists.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewListForm((v) => !v)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2 whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4" />
            New List
          </button>
          <button
            type="button"
            onClick={onOpenDownloads}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Downloads ({downloadedIds.size})
          </button>
        </div>
      </div>

      {showNewListForm && (
        <form
          onSubmit={handleCreateList}
          className="p-4 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3"
        >
          <label htmlFor="new-reading-list-name" className="sr-only">
            New reading list name
          </label>
          <input
            id="new-reading-list-name"
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Name your reading list (e.g., Philosophy Classics)"
            className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium whitespace-nowrap"
          >
            Create List
          </button>
          <button
            type="button"
            onClick={() => setShowNewListForm(false)}
            className="min-h-[44px] px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Search Bar & Suggestions */}
      <div className="space-y-2">
        <div className="relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="library-search-input" className="sr-only">
            Search books by title, author, category, or tag
          </label>
          <input
            id="library-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, author, category, tag, or keyword…"
            className="w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search query"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {searchSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Suggestions:</span>
            {searchSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="underline hover:text-blue-700 dark:hover:text-blue-400 py-1"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Personal Library Scopes & Custom Lists */}
      <div className="flex items-center gap-2 overflow-x-auto shelf-scroll pb-1">
        {SCOPES.map((item) => {
          const active = !customListId && scope === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setCustomListId(undefined);
                setScope(item.id);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 min-h-[40px] transition-colors ${
                active
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          );
        })}

        {db.customLists.map((list) => {
          const active = customListId === list.id;
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => setCustomListId(list.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 min-h-[40px] transition-colors ${
                active
                  ? 'bg-blue-700 text-white'
                  : 'bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {list.name} ({list.bookIds.length})
            </button>
          );
        })}
      </div>

      {/* Dynamic Catalog Categories + Language & Sort Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto shelf-scroll pb-1 pr-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] ${
              selectedCategory === 'All'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Categories
          </button>
          {catalog.categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] ${
                selectedCategory === cat.name
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <label htmlFor="library-language-filter" className="sr-only">
            Filter by language
          </label>
          <select
            id="library-language-filter"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-200 min-h-[40px]"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang === 'All' ? 'All Languages' : lang}
              </option>
            ))}
          </select>

          <label htmlFor="library-sort-select" className="sr-only">
            Sort books
          </label>
          <select
            id="library-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as BookSortOption)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-200 min-h-[40px]"
          >
            <option value="popular">Sort: Popular</option>
            <option value="newest">Sort: Newest</option>
            <option value="title">Sort: Title</option>
            <option value="author">Sort: Author</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
        Showing {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
      </p>

      {/* Grid or Empty State */}
      {filteredBooks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              authorName={getAuthorName(book, catalog.authors)}
              progress={db.progressByBook[book.id]}
              downloadRecord={downloads[book.id]}
              isFavorite={db.favorites.includes(book.id)}
              onOpenBook={onOpenBook}
              onOpenAuthor={onOpenAuthor}
            />
          ))}
        </div>
      ) : (
        <div className="p-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-center space-y-3">
          <p className="font-display text-lg font-medium text-slate-900 dark:text-white">
            No matching books in this view
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Try clearing your search query or switching to All Books to browse the entire Zentra
            catalog.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSelectedCategory('All');
              setSelectedLanguage('All');
              setScope('all');
              setCustomListId(undefined);
            }}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-700 text-white text-sm font-medium"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
