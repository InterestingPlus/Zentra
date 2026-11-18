import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Bookmark as BookmarkIcon,
  Edit3,
  FileText,
  Highlighter,
  Quote,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  Book,
  CatalogData,
  HighlightColor,
  PersonalDatabase,
} from '../types/zentra';
import { getAuthorName } from '../utils/catalogLogic';
import { BookCover } from './BookCover';

interface KnowledgeHubViewProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  onOpenReader: (bookId: string, page: number) => void;
  onOpenBook: (bookId: string) => void;
  onDeleteHighlight: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onUpdateNote: (id: string, title: string, content: string) => void;
  onDeleteBookmark: (id: string) => void;
}

type KnowledgeTab = 'notes' | 'highlights' | 'bookmarks' | 'quotes' | 'summaries';

const HIGHLIGHT_DOT: Record<HighlightColor, string> = {
  amber: 'bg-amber-400',
  sky: 'bg-sky-400',
  sage: 'bg-emerald-400',
  rose: 'bg-rose-400',
};

export const KnowledgeHubView: React.FC<KnowledgeHubViewProps> = ({
  catalog,
  db,
  onOpenReader,
  onOpenBook,
  onDeleteHighlight,
  onDeleteNote,
  onUpdateNote,
  onDeleteBookmark,
}) => {
  const [tab, setTab] = useState<KnowledgeTab>('notes');
  const [query, setQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const bookMap = useMemo(() => {
    const map = new Map<string, Book>();
    for (const b of catalog.books) map.set(b.id, b);
    return map;
  }, [catalog.books]);

  const q = query.trim().toLowerCase();

  const filteredNotes = useMemo(
    () =>
      db.notes
        .filter((n) => (selectedBookId === 'all' ? true : n.bookId === selectedBookId))
        .filter((n) => {
          if (!q) return true;
          const b = bookMap.get(n.bookId);
          return (
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            (b?.title.toLowerCase().includes(q) ?? false)
          );
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [db.notes, selectedBookId, q, bookMap]
  );

  const filteredHighlights = useMemo(
    () =>
      db.highlights
        .filter((h) => (selectedBookId === 'all' ? true : h.bookId === selectedBookId))
        .filter((h) => {
          if (!q) return true;
          const b = bookMap.get(h.bookId);
          return (
            h.text.toLowerCase().includes(q) ||
            (b?.title.toLowerCase().includes(q) ?? false)
          );
        })
        .sort((a, b) => b.createdAt - a.createdAt),
    [db.highlights, selectedBookId, q, bookMap]
  );

  const filteredBookmarks = useMemo(
    () =>
      db.bookmarks
        .filter((bm) => (selectedBookId === 'all' ? true : bm.bookId === selectedBookId))
        .filter((bm) => {
          if (!q) return true;
          const b = bookMap.get(bm.bookId);
          return (
            bm.label.toLowerCase().includes(q) ||
            (b?.title.toLowerCase().includes(q) ?? false)
          );
        })
        .sort((a, b) => b.createdAt - a.createdAt),
    [db.bookmarks, selectedBookId, q, bookMap]
  );

  const catalogQuotes = useMemo(() => {
    const items: Array<{ id: string; book: Book; text: string; kind: 'quote' | 'highlight' }> = [];
    for (const h of db.highlights) {
      const b = bookMap.get(h.bookId);
      if (b) items.push({ id: `hl_${h.id}`, book: b, text: h.text, kind: 'highlight' });
    }
    for (const b of catalog.books) {
      for (let i = 0; i < (b.importantQuotes?.length ?? 0); i++) {
        items.push({
          id: `cat_${b.id}_${i}`,
          book: b,
          text: b.importantQuotes![i],
          kind: 'quote',
        });
      }
    }
    return items
      .filter((it) => (selectedBookId === 'all' ? true : it.book.id === selectedBookId))
      .filter((it) =>
        !q
          ? true
          : it.text.toLowerCase().includes(q) || it.book.title.toLowerCase().includes(q)
      );
  }, [db.highlights, catalog.books, bookMap, selectedBookId, q]);

  const summaryBooks = useMemo(
    () =>
      catalog.books
        .filter((b) => Boolean(b.summary))
        .filter((b) => (selectedBookId === 'all' ? true : b.id === selectedBookId))
        .filter((b) =>
          !q
            ? true
            : b.title.toLowerCase().includes(q) || b.summary.toLowerCase().includes(q)
        ),
    [catalog.books, selectedBookId, q]
  );

  const tabs: Array<{
    id: KnowledgeTab;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'notes', label: 'All Notes', count: db.notes.length, icon: Edit3 },
    { id: 'highlights', label: 'Highlights', count: db.highlights.length, icon: Highlighter },
    { id: 'bookmarks', label: 'Bookmarks', count: db.bookmarks.length, icon: BookmarkIcon },
    { id: 'quotes', label: 'Important Quotes', count: catalogQuotes.length, icon: Quote },
    { id: 'summaries', label: 'Book Summaries', count: summaryBooks.length, icon: FileText },
  ];

  const renderBookHeader = (bookId: string, page?: number, dateMs?: number) => {
    const book = bookMap.get(bookId);
    const authorName = book ? getAuthorName(book, catalog.authors) : 'Catalog Book';
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {book && (
            <BookCover book={book} authorName={authorName} size="sm" className="shrink-0" />
          )}
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => book && onOpenBook(book.id)}
              className="text-left text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 truncate block max-w-full"
            >
              {book?.title ?? `Book (${bookId})`}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {authorName}
              {typeof page === 'number' && ` · Page ${page}`}
              {dateMs ? ` · ${new Date(dateMs).toLocaleDateString()}` : ''}
            </p>
          </div>
        </div>
        {typeof page === 'number' && (
          <button
            type="button"
            onClick={() => onOpenReader(bookId, page)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-xs font-medium min-h-[40px] whitespace-nowrap shrink-0 hover:bg-blue-100 dark:hover:bg-blue-900/60"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Open Page
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">
          My Knowledge Hub
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Every note, highlight, bookmark, quote, and book summary saved across your device.
        </p>
      </div>

      {/* Search & Book Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="knowledge-search-input" className="sr-only">
            Search saved notes, highlights, and quotes
          </label>
          <input
            id="knowledge-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all notes, highlights, bookmarks, and summaries…"
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-sm text-slate-900 dark:text-white"
          />
        </div>

        <label htmlFor="knowledge-book-filter" className="sr-only">
          Filter by book
        </label>
        <select
          id="knowledge-book-filter"
          value={selectedBookId}
          onChange={(e) => setSelectedBookId(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-xs font-medium text-slate-700 dark:text-slate-200 min-h-[44px]"
        >
          <option value="all">All Books</option>
          {catalog.books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </div>

      {/* 5 Knowledge Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto shelf-scroll pb-1" role="tablist">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 min-h-[44px] transition-colors ${
                active
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              <span className="font-mono-tabular opacity-75">({t.count})</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'notes' && (
        <div className="space-y-4">
          {filteredNotes.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <p className="font-display text-lg font-medium text-slate-900 dark:text-white">
                No notes captured yet
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Open any book in the PDF reader and tap Add Note to record thoughts tied to a page
                or highlight.
              </p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <article
                key={note.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-3"
              >
                {renderBookHeader(note.bookId, note.page, note.updatedAt)}

                {editingNoteId === note.id ? (
                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-medium"
                      placeholder="Note title"
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateNote(note.id, editTitle, editContent);
                          setEditingNoteId(null);
                        }}
                        className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-medium min-h-[36px]"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-4 py-2 rounded-lg text-xs text-slate-500 min-h-[36px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1 space-y-1.5">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {note.title || 'Untitled Note'}
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {note.content}
                    </p>
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditTitle(note.title);
                          setEditContent(note.content);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white py-1"
                      >
                        Edit note
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="text-xs text-rose-600 hover:underline py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}

      {tab === 'highlights' && (
        <div className="space-y-4">
          {filteredHighlights.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <p className="font-display text-lg font-medium text-slate-900 dark:text-white">
                No highlights saved yet
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select any text inside a selectable PDF page to highlight it in your chosen color.
              </p>
            </div>
          ) : (
            filteredHighlights.map((hl) => (
              <article
                key={hl.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-3"
              >
                {renderBookHeader(hl.bookId, hl.page, hl.createdAt)}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 flex items-start gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${HIGHLIGHT_DOT[hl.color]}`}
                    aria-label={`${hl.color} highlight`}
                  />
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-display italic">
                    “{hl.text}”
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onDeleteHighlight(hl.id)}
                    aria-label="Delete highlight"
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline py-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove highlight
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {tab === 'bookmarks' && (
        <div className="space-y-3">
          {filteredBookmarks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <p className="font-display text-lg font-medium text-slate-900 dark:text-white">
                No bookmarks yet
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tap the bookmark icon in the PDF reader to save named pages for instant recall.
              </p>
            </div>
          ) : (
            filteredBookmarks.map((bm) => (
              <article
                key={bm.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-3"
              >
                {renderBookHeader(bm.bookId, bm.page, bm.createdAt)}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {bm.label}
                  </p>
                  <button
                    type="button"
                    onClick={() => onDeleteBookmark(bm.id)}
                    className="text-xs text-rose-600 hover:underline py-1"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {tab === 'quotes' && (
        <div className="space-y-4">
          {catalogQuotes.map((qItem) => (
            <article
              key={qItem.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <blockquote className="font-display italic text-lg text-slate-900 dark:text-slate-100 leading-relaxed">
                “{qItem.text}”
              </blockquote>
              <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {qItem.book.title} · {getAuthorName(qItem.book, catalog.authors)} ·{' '}
                  {qItem.kind === 'highlight' ? 'Your Highlight' : 'Curated Quote'}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenBook(qItem.book.id)}
                  className="text-blue-700 dark:text-blue-400 font-medium hover:underline whitespace-nowrap"
                >
                  Open Book
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'summaries' && (
        <div className="space-y-4">
          {summaryBooks.map((book) => (
            <article
              key={book.id}
              className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-3"
            >
              {renderBookHeader(book.id)}
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {book.summary}
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenBook(book.id)}
                  className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
                >
                  Read full summary & listen
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
