import type {
  Author,
  Book,
  CatalogData,
  Category,
  PersonalDatabase,
} from '../types/zentra';

export type BookSortOption = 'popular' | 'newest' | 'title' | 'author';

export type LibraryFilterScope =
  | 'all'
  | 'favorites'
  | 'reading'
  | 'want_to_read'
  | 'completed'
  | 'downloaded'
  | 'recent';

export interface BookFilterOptions {
  query?: string;
  category?: string;
  language?: string;
  scope?: LibraryFilterScope;
  customListId?: string;
  sortBy?: BookSortOption;
  downloadedBookIds?: Set<string>;
}

const COVER_ACCENT_PALETTE = [
  '#1E3A8A', // Deep Cobalt
  '#9A6B2F', // Warm Ochre
  '#0F766E', // Forest Teal
  '#334155', // Slate Ink
  '#7C2D12', // Terracotta
  '#4338CA', // Indigo
  '#065F46', // Emerald Pine
  '#7F1D1D', // Oxblood
];

function deriveCoverAccent(bookId: string, category: string): string {
  const seed = `${category}:${bookId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COVER_ACCENT_PALETTE[hash % COVER_ACCENT_PALETTE.length];
}

function slugifyId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveCatalogRelativeUrl(rawUrl: string, baseCatalogUrl?: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^http:\/\/books\.google\.com\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  if (/^(https?:\/\/|zentra:\/\/|\/src\/|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  if (!baseCatalogUrl || !/^https?:\/\//i.test(baseCatalogUrl)) {
    return trimmed;
  }
  try {
    return new URL(trimmed, baseCatalogUrl).toString();
  } catch {
    return trimmed;
  }
}

export function extractGoogleDriveFileId(urlOrId?: string | null): string | undefined {
  if (!urlOrId || typeof urlOrId !== 'string') return undefined;
  const trimmed = urlOrId.trim();
  if (!trimmed) return undefined;
  if (/^[a-zA-Z0-9_-]{15,80}$/.test(trimmed)) {
    return trimmed;
  }
  const pathMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,80})/i);
  if (pathMatch) return pathMatch[1];
  const queryMatch = trimmed.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]{10,80})/i);
  if (queryMatch) return queryMatch[1];
  return undefined;
}

export function validateAndNormalizeCatalog(
  raw: unknown,
  baseCatalogUrl?: string
): CatalogData {
  if (!raw || (typeof raw !== 'object' && !Array.isArray(raw))) {
    throw new Error('Catalog payload must be a JSON object or array of books.');
  }

  const obj: Record<string, unknown> = Array.isArray(raw)
    ? { books: raw }
    : (raw as Record<string, unknown>);

  if (!Array.isArray(obj.books)) {
    throw new Error('Catalog JSON must include a "books" array.');
  }

  const authorsMap = new Map<string, Author>();
  const authorNameToId = new Map<string, string>();
  const authors: Author[] = [];

  if (Array.isArray(obj.authors)) {
    for (const rawAuthor of obj.authors) {
      if (!rawAuthor || typeof rawAuthor !== 'object') continue;
      const a = rawAuthor as Record<string, unknown>;
      if (typeof a.id !== 'string' || typeof a.name !== 'string' || !a.id.trim() || !a.name.trim()) {
        continue;
      }
      const bioText =
        typeof a.bio === 'string' && a.bio.trim()
          ? a.bio.trim()
          : 'Author profile details are still being verified in this catalog.';
      const normalizedAuthor: Author = {
        id: a.id.trim(),
        name: a.name.trim(),
        photoUrl:
          typeof a.photoUrl === 'string' && a.photoUrl.trim()
            ? resolveCatalogRelativeUrl(a.photoUrl, baseCatalogUrl)
            : '',
        bio: bioText,
        description:
          typeof a.description === 'string' && a.description.trim()
            ? a.description.trim()
            : undefined,
        expertise: Array.isArray(a.expertise)
          ? a.expertise.filter((x): x is string => typeof x === 'string')
          : undefined,
        bookIds: Array.isArray(a.bookIds)
          ? a.bookIds.filter((x): x is string => typeof x === 'string')
          : [],
        relatedAuthorIds: Array.isArray(a.relatedAuthorIds)
          ? a.relatedAuthorIds.filter((x): x is string => typeof x === 'string')
          : undefined,
      };
      authorsMap.set(normalizedAuthor.id, normalizedAuthor);
      if (normalizedAuthor.name.toLowerCase() !== 'unknown') {
        authorNameToId.set(normalizedAuthor.name.toLowerCase(), normalizedAuthor.id);
      }
      authors.push(normalizedAuthor);
    }
  }

  const books: Book[] = [];
  const seenBookIds = new Set<string>();
  const derivedCategories = new Set<string>();

  for (const rawBook of obj.books) {
    if (!rawBook || typeof rawBook !== 'object') continue;
    const b = rawBook as Record<string, unknown>;
    if (typeof b.title !== 'string' || !b.title.trim()) {
      continue;
    }

    const title = b.title.trim();
    const language =
      typeof b.language === 'string' && b.language.trim() ? b.language.trim() : 'English';

    let id =
      typeof b.id === 'string' && b.id.trim()
        ? b.id.trim()
        : `book_${slugifyId(title)}_${slugifyId(language)}`;

    if (seenBookIds.has(id)) {
      id = `${id}_${seenBookIds.size + 1}`;
    }
    seenBookIds.add(id);

    const rawAuthorName =
      typeof b.authorName === 'string' && b.authorName.trim()
        ? b.authorName.trim()
        : typeof b.author === 'string' && b.author.trim()
          ? b.author.trim()
          : '';

    const rawAuthorIds = Array.isArray(b.authorIds)
      ? b.authorIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
      : [];

    let authorId =
      typeof b.primaryAuthorId === 'string' && b.primaryAuthorId.trim()
        ? b.primaryAuthorId.trim()
        : typeof b.authorId === 'string' && b.authorId.trim()
          ? b.authorId.trim()
          : rawAuthorIds[0] ?? '';

    if (!authorId && rawAuthorName) {
      authorId =
        authorNameToId.get(rawAuthorName.toLowerCase()) ??
        `author_${slugifyId(rawAuthorName) || 'unknown'}`;
    }
    if (!authorId) {
      authorId = 'author_unknown';
    }

    const allAuthorIds = Array.from(
      new Set([authorId, ...rawAuthorIds].filter(Boolean))
    );

    const resolvedAuthorNames: string[] = [];
    for (const aId of allAuthorIds) {
      let linked = authorsMap.get(aId);
      if (!linked) {
        const fallbackName = aId === authorId && rawAuthorName ? rawAuthorName : 'Unknown';
        linked = {
          id: aId,
          name: fallbackName,
          photoUrl: '',
          bio: `${fallbackName} is featured in the Zentra library catalog.`,
          bookIds: [],
        };
        authorsMap.set(aId, linked);
        if (fallbackName.toLowerCase() !== 'unknown') {
          authorNameToId.set(fallbackName.toLowerCase(), aId);
        }
        authors.push(linked);
      }
      if (!linked.bookIds.includes(id)) {
        linked.bookIds.push(id);
      }
      if (!resolvedAuthorNames.includes(linked.name)) {
        resolvedAuthorNames.push(linked.name);
      }
    }

    const joinedAuthorName =
      resolvedAuthorNames.length > 0
        ? resolvedAuthorNames.join(' & ')
        : rawAuthorName || 'Unknown';

    const category =
      typeof b.category === 'string' && b.category.trim() ? b.category.trim() : 'General';
    derivedCategories.add(category);

    // Nested or flat cover
    let rawCover = '';
    if (typeof b.coverUrl === 'string') {
      rawCover = b.coverUrl;
    } else if (typeof b.cover === 'string') {
      rawCover = b.cover;
    } else if (b.cover && typeof b.cover === 'object') {
      const coverObj = b.cover as Record<string, unknown>;
      if (typeof coverObj.url === 'string') {
        rawCover = coverObj.url;
      }
    }

    // Nested or flat pdf
    let rawPdf = '';
    let pdfFileId: string | undefined;
    let pdfReaderUrl: string | undefined;
    if (typeof b.pdfUrl === 'string') {
      rawPdf = b.pdfUrl;
    } else if (typeof b.pdf === 'string') {
      rawPdf = b.pdf;
    } else if (b.pdf && typeof b.pdf === 'object') {
      const pdfObj = b.pdf as Record<string, unknown>;
      if (typeof pdfObj.downloadUrl === 'string' && pdfObj.downloadUrl.trim()) {
        rawPdf = pdfObj.downloadUrl;
      } else if (typeof pdfObj.sourceUrl === 'string' && pdfObj.sourceUrl.trim()) {
        rawPdf = pdfObj.sourceUrl;
      }
      if (typeof pdfObj.fileId === 'string' && pdfObj.fileId.trim()) {
        pdfFileId = pdfObj.fileId.trim();
      }
      if (typeof pdfObj.readerUrl === 'string' && pdfObj.readerUrl.trim()) {
        pdfReaderUrl = pdfObj.readerUrl.trim();
      }
    }
    const resolvedPdfUrl = resolveCatalogRelativeUrl(rawPdf, baseCatalogUrl);
    if (!pdfFileId) {
      pdfFileId = extractGoogleDriveFileId(resolvedPdfUrl);
    }

    // Nested or flat summary + keyTakeaways + chapterSummaries
    let summaryText = '';
    let rawTakeaways: unknown = b.keyTakeaways;
    let rawChapters: unknown = b.chapterSummaries;
    if (typeof b.summary === 'string') {
      summaryText = b.summary;
    } else if (b.summary && typeof b.summary === 'object') {
      const sObj = b.summary as Record<string, unknown>;
      if (typeof sObj.short === 'string') {
        summaryText = sObj.short;
      } else if (typeof sObj.long === 'string') {
        summaryText = sObj.long;
      }
      if (Array.isArray(sObj.keyTakeaways)) {
        rawTakeaways = sObj.keyTakeaways;
      }
      if (Array.isArray(sObj.chapterSummaries)) {
        rawChapters = sObj.chapterSummaries;
      }
    }

    // Nested or flat metadata
    const metaObj =
      b.metadata && typeof b.metadata === 'object'
        ? (b.metadata as Record<string, unknown>)
        : null;

    const rawPageCount =
      typeof metaObj?.pageCount === 'number'
        ? metaObj.pageCount
        : typeof b.pageCount === 'number'
          ? b.pageCount
          : undefined;

    const publishedYear =
      typeof metaObj?.publicationYear === 'number'
        ? metaObj.publicationYear
        : typeof b.publishedYear === 'number'
          ? b.publishedYear
          : undefined;

    const isbn =
      typeof metaObj?.isbn === 'string' && metaObj.isbn.trim()
        ? metaObj.isbn.trim()
        : typeof b.isbn === 'string' && b.isbn.trim()
          ? b.isbn.trim()
          : undefined;

    const publisher =
      typeof metaObj?.publisher === 'string' && metaObj.publisher.trim()
        ? metaObj.publisher.trim()
        : typeof b.publisher === 'string' && b.publisher.trim()
          ? b.publisher.trim()
          : undefined;

    const book: Book = {
      id,
      title,
      subtitle: typeof b.subtitle === 'string' && b.subtitle.trim() ? b.subtitle.trim() : undefined,
      authorId,
      authorIds: allAuthorIds,
      authorName: joinedAuthorName,
      coverUrl: resolveCatalogRelativeUrl(rawCover, baseCatalogUrl),
      coverAccent:
        typeof b.coverAccent === 'string' && b.coverAccent.trim()
          ? b.coverAccent.trim()
          : deriveCoverAccent(id, category),
      pdfUrl: resolvedPdfUrl,
      pdfFileId,
      pdfReaderUrl,
      description:
        typeof b.description === 'string' && b.description.trim()
          ? b.description.trim()
          : `${title} (${language}) in ${category}.`,
      summary: summaryText,
      chapterSummaries: Array.isArray(rawChapters)
        ? rawChapters.filter(
            (c): c is { chapterNumber: number; title: string; summary: string } =>
              !!c &&
              typeof c === 'object' &&
              typeof (c as Record<string, unknown>).title === 'string' &&
              typeof (c as Record<string, unknown>).summary === 'string'
          )
        : undefined,
      keyTakeaways: Array.isArray(rawTakeaways)
        ? rawTakeaways
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => {
              const t = x.trim();
              return t.charAt(0).toUpperCase() + t.slice(1);
            })
        : [],
      practicalLessons: Array.isArray(b.practicalLessons)
        ? b.practicalLessons.filter((x): x is string => typeof x === 'string')
        : undefined,
      importantQuotes: Array.isArray(b.importantQuotes)
        ? b.importantQuotes.filter((x): x is string => typeof x === 'string')
        : undefined,
      category,
      subcategory:
        typeof b.subcategory === 'string' && b.subcategory.trim() ? b.subcategory.trim() : undefined,
      language,
      tags: Array.isArray(b.tags)
        ? b.tags.filter((x): x is string => typeof x === 'string')
        : [category, language],
      publishedYear,
      pageCount: typeof rawPageCount === 'number' && rawPageCount > 0 ? rawPageCount : undefined,
      isbn,
      publisher,
      difficulty:
        b.difficulty === 'Foundational' ||
        b.difficulty === 'Intermediate' ||
        b.difficulty === 'Advanced'
          ? b.difficulty
          : undefined,
      featured: Boolean(b.featured),
      popular: Boolean(b.popular),
      newlyAdded: Boolean(b.newlyAdded),
      addedDate: typeof b.addedDate === 'string' ? b.addedDate : undefined,
      relatedBookIds: Array.isArray(b.relatedBookIds)
        ? b.relatedBookIds.filter((x): x is string => typeof x === 'string')
        : undefined,
      sampleChapters: Array.isArray(b.sampleChapters)
        ? (b.sampleChapters as { title: string; paragraphs: string[] }[])
        : undefined,
    };

    books.push(book);
  }

  const rawCategories = Array.isArray(obj.categories) ? obj.categories : [];
  const categoriesMap = new Map<string, Category>();
  for (const rc of rawCategories) {
    if (!rc || typeof rc !== 'object') continue;
    const c = rc as Record<string, unknown>;
    if (typeof c.id !== 'string' || typeof c.name !== 'string') continue;
    categoriesMap.set(c.name, {
      id: c.id,
      name: c.name,
      description: typeof c.description === 'string' ? c.description : '',
      coverUrl:
        typeof c.coverUrl === 'string'
          ? resolveCatalogRelativeUrl(c.coverUrl, baseCatalogUrl)
          : undefined,
    });
  }

  for (const catName of derivedCategories) {
    if (!categoriesMap.has(catName)) {
      categoriesMap.set(catName, {
        id: catName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: catName,
        description: `Curated works in ${catName}.`,
      });
    }
  }

  const parsedVersion =
    typeof obj.version === 'number'
      ? obj.version
      : typeof obj.schemaVersion === 'number'
        ? obj.schemaVersion
        : 1;

  return {
    version: parsedVersion,
    lastUpdated:
      typeof obj.lastUpdated === 'string'
        ? obj.lastUpdated
        : new Date().toISOString().slice(0, 10),
    books,
    authors,
    categories: Array.from(categoriesMap.values()),
  };
}

export function getAuthorName(book: Book, authors: Author[]): string {
  if (book.authorIds && book.authorIds.length > 0) {
    const names = book.authorIds
      .map((id) => authors.find((a) => a.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) {
      return Array.from(new Set(names)).join(' & ');
    }
  }
  const found = authors.find((a) => a.id === book.authorId);
  return found?.name ?? book.authorName ?? 'Unknown';
}

export function filterAndSortBooks(
  catalog: CatalogData,
  db: PersonalDatabase,
  options: BookFilterOptions
): Book[] {
  const {
    query = '',
    category = 'All',
    language = 'All',
    scope = 'all',
    customListId,
    sortBy = 'popular',
    downloadedBookIds = new Set<string>(),
  } = options;

  const q = query.trim().toLowerCase();

  let list = catalog.books.filter((book) => {
    if (category !== 'All' && book.category !== category) {
      return false;
    }
    if (language !== 'All' && book.language !== language) {
      return false;
    }

    if (customListId) {
      const customList = db.customLists.find((l) => l.id === customListId);
      if (!customList || !customList.bookIds.includes(book.id)) {
        return false;
      }
    } else if (scope !== 'all') {
      const progress = db.progressByBook[book.id];
      if (scope === 'favorites' && !db.favorites.includes(book.id)) return false;
      if (scope === 'reading' && progress?.status !== 'reading') return false;
      if (scope === 'want_to_read' && progress?.status !== 'want_to_read') return false;
      if (scope === 'completed' && progress?.status !== 'completed') return false;
      if (scope === 'downloaded' && !downloadedBookIds.has(book.id)) return false;
      if (scope === 'recent' && !db.recentlyViewed.includes(book.id)) return false;
    }

    if (q) {
      const authorName = getAuthorName(book, catalog.authors).toLowerCase();
      const haystack = [
        book.title,
        book.subtitle ?? '',
        authorName,
        book.category,
        book.subcategory ?? '',
        book.description,
        book.publisher ?? '',
        ...book.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  if (scope === 'recent' && !customListId) {
    list = [...list].sort(
      (a, b) => db.recentlyViewed.indexOf(a.id) - db.recentlyViewed.indexOf(b.id)
    );
    return list;
  }

  list = [...list].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'author':
        return getAuthorName(a, catalog.authors).localeCompare(
          getAuthorName(b, catalog.authors)
        );
      case 'newest': {
        const da = a.addedDate ?? String(a.publishedYear ?? 0);
        const dbDate = b.addedDate ?? String(b.publishedYear ?? 0);
        return dbDate.localeCompare(da);
      }
      case 'popular':
      default: {
        const scoreA = (a.popular ? 2 : 0) + (a.featured ? 1 : 0) + (a.coverUrl ? 1 : 0);
        const scoreB = (b.popular ? 2 : 0) + (b.featured ? 1 : 0) + (b.coverUrl ? 1 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.title.localeCompare(b.title);
      }
    }
  });

  return list;
}

export interface RecommendationBundle {
  recommendedForYou: Book[];
  becauseYouReadAnchor: Book | null;
  becauseYouReadBooks: Book[];
  exploreNewCategoryName: string | null;
  exploreNewCategoryBooks: Book[];
}

export function computeRecommendations(
  catalog: CatalogData,
  db: PersonalDatabase
): RecommendationBundle {
  const excluded = new Set(db.notInterestedIds);
  const scoreByBook = new Map<string, number>();

  const preferredCategories = new Set(db.settings.interests);
  const preferredAuthors = new Set<string>();
  const preferredTags = new Set<string>();
  const readCategories = new Set<string>();

  for (const favId of db.favorites) {
    const b = catalog.books.find((x) => x.id === favId);
    if (b) {
      preferredCategories.add(b.category);
      preferredAuthors.add(b.authorId);
      b.tags.forEach((t) => preferredTags.add(t.toLowerCase()));
    }
  }

  let latestActiveBook: Book | null = null;
  let latestReadAt = 0;

  for (const progress of Object.values(db.progressByBook)) {
    const b = catalog.books.find((x) => x.id === progress.bookId);
    if (!b) continue;
    readCategories.add(b.category);
    preferredCategories.add(b.category);
    preferredAuthors.add(b.authorId);
    b.tags.forEach((t) => preferredTags.add(t.toLowerCase()));
    if (progress.lastReadAt > latestReadAt) {
      latestReadAt = progress.lastReadAt;
      latestActiveBook = b;
    }
  }

  for (const book of catalog.books) {
    if (excluded.has(book.id)) continue;
    const progress = db.progressByBook[book.id];
    if (progress?.status === 'completed') continue;

    let score = 0;
    if (preferredCategories.has(book.category)) score += 5;
    if (preferredAuthors.has(book.authorId)) score += 4;
    for (const tag of book.tags) {
      if (preferredTags.has(tag.toLowerCase())) score += 2;
    }
    if (book.featured) score += 2;
    if (book.popular) score += 2;
    if (book.coverUrl) score += 1;
    if (db.favorites.includes(book.id)) score += 1;
    if (progress?.status === 'want_to_read') score += 3;

    scoreByBook.set(book.id, score);
  }

  const recommendedForYou = catalog.books
    .filter((b) => !excluded.has(b.id) && scoreByBook.has(b.id))
    .sort((a, b) => (scoreByBook.get(b.id) ?? 0) - (scoreByBook.get(a.id) ?? 0))
    .slice(0, 6);

  let becauseYouReadBooks: Book[] = [];
  if (latestActiveBook) {
    const anchor = latestActiveBook;
    becauseYouReadBooks = catalog.books
      .filter((b) => b.id !== anchor.id && !excluded.has(b.id))
      .map((b) => {
        let sim = 0;
        if (anchor.relatedBookIds?.includes(b.id)) sim += 6;
        if (b.category === anchor.category) sim += 4;
        if (b.authorId === anchor.authorId) sim += 3;
        for (const t of b.tags) {
          if (anchor.tags.includes(t)) sim += 2;
        }
        return { book: b, sim };
      })
      .filter((x) => x.sim > 0)
      .sort((a, b) => b.sim - a.sim)
      .map((x) => x.book)
      .slice(0, 5);
  }

  const unexploredCategories = catalog.categories.filter(
    (c) =>
      !readCategories.has(c.name) &&
      catalog.books.some((b) => b.category === c.name && !excluded.has(b.id))
  );
  const exploreCat = unexploredCategories[0] ?? catalog.categories[0] ?? null;
  const exploreNewCategoryBooks = exploreCat
    ? catalog.books
        .filter((b) => b.category === exploreCat.name && !excluded.has(b.id))
        .slice(0, 5)
    : [];

  return {
    recommendedForYou,
    becauseYouReadAnchor: latestActiveBook,
    becauseYouReadBooks,
    exploreNewCategoryName: exploreCat?.name ?? null,
    exploreNewCategoryBooks,
  };
}
