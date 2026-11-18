import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRecommendations,
  extractGoogleDriveFileId,
  filterAndSortBooks,
  getAuthorName,
  validateAndNormalizeCatalog,
} from './catalogLogic';
import {
  computeDoublePageSpread,
  computeNextSpreadPage,
  computePrevSpreadPage,
} from './readerLogic';
import {
  computeReadingStats,
  isWithinQuietHours,
  shouldTriggerReminder,
  toDateKey,
  validateAndMergeBackup,
} from './analyticsLogic';
import type { CatalogData, PersonalDatabase } from '../types/zentra';

const sampleCatalogRaw = {
  version: 2,
  lastUpdated: '2026-11-18',
  books: [
    {
      id: 'b1',
      title: 'Deep Focus Architecture',
      authorId: 'a1',
      coverUrl: '',
      pdfUrl: 'zentra://b1',
      description: 'Building calm attention.',
      summary: 'A guide to attention.',
      keyTakeaways: ['Protect morning hours'],
      category: 'Productivity',
      language: 'English',
      tags: ['Focus', 'Attention'],
      pageCount: 180,
      popular: true,
      featured: true,
      addedDate: '2026-11-01',
      relatedBookIds: ['b2'],
    },
    {
      id: 'b2',
      title: 'Systems of Stillness',
      authorId: 'a1',
      coverUrl: '',
      pdfUrl: 'zentra://b2',
      description: 'Mental clarity in motion.',
      summary: 'Clarity habits.',
      keyTakeaways: ['Single-task daily'],
      category: 'Productivity',
      language: 'English',
      tags: ['Focus', 'Clarity'],
      pageCount: 140,
      popular: false,
      featured: false,
      addedDate: '2026-11-10',
    },
    {
      id: 'b3',
      title: 'Gita on Duty',
      authorId: 'a2',
      coverUrl: '',
      pdfUrl: 'zentra://b3',
      description: 'Action without attachment.',
      summary: 'Timeless philosophy.',
      keyTakeaways: ['Focus on action, not fruit'],
      category: 'Bhagavad Gita',
      language: 'Sanskrit & English',
      tags: ['Dharma', 'Spirituality'],
      pageCount: 220,
      popular: true,
      featured: false,
      addedDate: '2026-10-15',
    },
  ],
  authors: [
    { id: 'a1', name: 'Aarav Mehta', photoUrl: '', bio: 'Systems writer', bookIds: ['b1'] },
    { id: 'a2', name: 'Swami Devendra', photoUrl: '', bio: 'Scholar', bookIds: ['b3'] },
  ],
  categories: [
    { id: 'productivity', name: 'Productivity', description: 'Focus & workflows' },
  ],
};

function makeEmptyDb(): PersonalDatabase {
  return {
    schemaVersion: 1,
    progressByBook: {},
    favorites: [],
    recentlyViewed: [],
    notInterestedIds: [],
    customLists: [],
    sessions: [],
    highlights: [],
    notes: [],
    bookmarks: [],
    lastSentReminders: {},
    settings: {
      themeMode: 'light',
      catalogUrl: 'https://zeentra.netlify.app/books/data.json',
      onboardingCompleted: true,
      userName: 'Reader',
      interests: ['Productivity'],
      reader: {
        defaultMode: 'single',
        readerTheme: 'light',
        keepScreenAwake: true,
        pageMarginSize: 'comfortable',
        coverSpreadOffset: false,
        brightnessPercent: 100,
        pageTurnAnimation: true,
      },
      reminders: {
        dailyGoalMinutes: 20,
        preferredDays: [0, 1, 2, 3, 4, 5, 6],
        primaryReminderTime: '20:00',
        enableDailyReminder: true,
        enableUnfinishedReminder: true,
        unfinishedDaysThreshold: 5,
        enableGoalReminder: true,
        enableWeeklyReport: false,
        quietHoursStart: '22:30',
        quietHoursEnd: '07:00',
        paused: false,
        vacationMode: false,
      },
    },
  };
}

test('validateAndNormalizeCatalog links authors, dedupes books, and derives categories', () => {
  const catalog = validateAndNormalizeCatalog(sampleCatalogRaw);
  assert.equal(catalog.books.length, 3);
  assert.equal(catalog.authors.length, 2);
  assert.equal(catalog.categories.length, 2); // Productivity + derived Bhagavad Gita
  assert.equal(catalog.books[1].authorName, 'Aarav Mehta');
  assert.deepEqual(catalog.authors[0].bookIds, ['b1', 'b2']);
});

test('validateAndNormalizeCatalog supports simplified book arrays and resolves relative pdf paths', () => {
  const simplified = [
    {
      title: 'Think and Grow Rich',
      author: 'Napoleon Hill',
      category: 'Self-Help & Personal Development',
      language: 'English',
      pdf: 'think-and-grow-rich-en.pdf',
    },
    {
      title: 'Think and Grow Rich',
      author: 'Napoleon Hill',
      category: 'Self-Help & Personal Development',
      language: 'Hindi',
      pdf: '/books/think-and-grow-rich-hi.pdf',
    },
  ];
  const catalog = validateAndNormalizeCatalog(
    simplified,
    'https://zeentra.netlify.app/books/data.json'
  );
  assert.equal(catalog.books.length, 2);
  assert.equal(catalog.authors.length, 1);
  assert.equal(catalog.books[0].id, 'book_think_and_grow_rich_english');
  assert.equal(catalog.books[1].id, 'book_think_and_grow_rich_hindi');
  assert.equal(
    catalog.books[0].pdfUrl,
    'https://zeentra.netlify.app/books/think-and-grow-rich-en.pdf'
  );
  assert.equal(
    catalog.books[1].pdfUrl,
    'https://zeentra.netlify.app/books/think-and-grow-rich-hi.pdf'
  );
});

test('validateAndNormalizeCatalog parses remote GitHub book.json nested schema, co-authors, and Drive IDs', () => {
  const remotePayload = {
    schemaVersion: '1.0.0',
    lastUpdated: '2026-11-18',
    authors: [
      { id: 'author_joe_navarro', name: 'Joe Navarro', bio: 'Former FBI agent.', photoUrl: null },
      { id: 'author_marvin_karlins', name: 'Marvin Karlins', bio: null, photoUrl: null },
    ],
    categories: [
      { id: 'psychology-mindset', name: 'Psychology & Mindset', description: 'Mindset & behavior.' },
    ],
    books: [
      {
        id: 'what-every-body-is-saying',
        title: 'What Every BODY Is Saying',
        subtitle: null,
        authorIds: ['author_joe_navarro', 'author_marvin_karlins'],
        primaryAuthorId: 'author_joe_navarro',
        category: 'Psychology & Mindset',
        language: 'English',
        cover: {
          url: 'http://books.google.com/books/content?id=IUFQM-6OFEsC&printsec=frontcover&img=1&zoom=1',
          provider: 'Google Books',
        },
        pdf: {
          provider: 'Google Drive',
          fileId: '1kqfud9T5rzuo7eHSUHUKHkz8RQB7BdTq',
          readerUrl: 'https://drive.google.com/file/d/1kqfud9T5rzuo7eHSUHUKHkz8RQB7BdTq/preview',
          downloadUrl: 'https://drive.google.com/uc?export=download&id=1kqfud9T5rzuo7eHSUHUKHkz8RQB7BdTq',
        },
        description: 'Introduction to nonverbal communication.',
        summary: {
          short: 'Short editorial summary.',
          keyTakeaways: ['Look for clusters of cues'],
          chapterSummaries: [],
        },
        tags: ['Body Language'],
        metadata: {
          isbn: '9780061755668',
          pageCount: 272,
          publicationYear: 2008,
          publisher: 'HarperCollins',
        },
        featured: false,
        popular: false,
      },
    ],
  };

  const catalog = validateAndNormalizeCatalog(
    remotePayload,
    'https://raw.githubusercontent.com/InterestingPlus/Zentra/refs/heads/main/book.json'
  );
  assert.equal(catalog.books.length, 1);
  const b = catalog.books[0];
  assert.equal(b.id, 'what-every-body-is-saying');
  assert.equal(b.coverUrl.startsWith('https://books.google.com/'), true);
  assert.equal(b.pdfFileId, '1kqfud9T5rzuo7eHSUHUKHkz8RQB7BdTq');
  assert.equal(b.pdfUrl, 'https://drive.google.com/uc?export=download&id=1kqfud9T5rzuo7eHSUHUKHkz8RQB7BdTq');
  assert.equal(b.summary, 'Short editorial summary.');
  assert.deepEqual(b.keyTakeaways, ['Look for clusters of cues']);
  assert.equal(b.pageCount, 272);
  assert.equal(b.publishedYear, 2008);
  assert.equal(b.publisher, 'HarperCollins');
  assert.equal(b.isbn, '9780061755668');
  assert.equal(getAuthorName(b, catalog.authors), 'Joe Navarro & Marvin Karlins');
  assert.deepEqual(catalog.authors[1].bookIds, ['what-every-body-is-saying']);
  assert.equal(catalog.authors[1].bio.length > 0, true);
  assert.equal(
    extractGoogleDriveFileId('https://drive.google.com/file/d/1kqfud9T5rzuo7eHSUHUKHkz8RQB7BdTq/view'),
    '1kqfud9T5rzuo7eHSUHUKHkz8RQB7BdTq'
  );
});

test('validateAndNormalizeCatalog rejects non-JSON / invalid catalog', () => {
  assert.throws(() => validateAndNormalizeCatalog('<html>404</html>'));
  assert.throws(() => validateAndNormalizeCatalog({ books: 'nope' }));
});

test('filterAndSortBooks filters by query, category, scope, and sorts properly', () => {
  const catalog = validateAndNormalizeCatalog(sampleCatalogRaw);
  const db = makeEmptyDb();
  db.favorites = ['b3'];
  db.progressByBook['b1'] = {
    bookId: 'b1',
    currentPage: 12,
    totalPages: 180,
    status: 'reading',
    lastReadAt: 1000,
    totalSecondsRead: 300,
  };

  const searched = filterAndSortBooks(catalog, db, { query: 'aarav' });
  assert.deepEqual(
    searched.map((b) => b.id),
    ['b1', 'b2']
  );

  const favs = filterAndSortBooks(catalog, db, { scope: 'favorites' });
  assert.deepEqual(
    favs.map((b) => b.id),
    ['b3']
  );

  const byNewest = filterAndSortBooks(catalog, db, { sortBy: 'newest' });
  assert.deepEqual(
    byNewest.map((b) => b.id),
    ['b2', 'b1', 'b3']
  );
});

test('computeDoublePageSpread follows conventional book pagination and supports cover offset', () => {
  // Standard book pagination: page 1 right with blank left, then (2,3), (4,5)
  assert.deepEqual(computeDoublePageSpread(1, 10, false), { leftPage: null, rightPage: 1 });
  assert.deepEqual(computeDoublePageSpread(2, 10, false), { leftPage: 2, rightPage: 3 });
  assert.deepEqual(computeDoublePageSpread(3, 10, false), { leftPage: 2, rightPage: 3 });
  assert.deepEqual(computeDoublePageSpread(10, 10, false), { leftPage: 10, rightPage: null });

  // Next / Prev spread navigation
  assert.equal(computeNextSpreadPage(1, 10, true, false), 2);
  assert.equal(computeNextSpreadPage(2, 10, true, false), 4);
  assert.equal(computePrevSpreadPage(4, 10, true, false), 3);
  assert.equal(computePrevSpreadPage(2, 10, true, false), 1);

  // Offset alignment for unusual front matter
  assert.deepEqual(computeDoublePageSpread(1, 10, true), { leftPage: 1, rightPage: 2 });
  assert.deepEqual(computeDoublePageSpread(4, 10, true), { leftPage: 3, rightPage: 4 });
});

test('computeRecommendations uses local signals and respects notInterestedIds', () => {
  const catalog: CatalogData = validateAndNormalizeCatalog(sampleCatalogRaw);
  const db = makeEmptyDb();
  db.progressByBook['b1'] = {
    bookId: 'b1',
    currentPage: 40,
    totalPages: 180,
    status: 'reading',
    lastReadAt: 5000,
    totalSecondsRead: 900,
  };
  db.notInterestedIds = ['b2'];

  const recs = computeRecommendations(catalog, db);
  assert.equal(recs.recommendedForYou.some((b) => b.id === 'b2'), false);
  assert.equal(recs.becauseYouReadAnchor?.id, 'b1');
  assert.equal(recs.exploreNewCategoryName, 'Bhagavad Gita');
});

test('computeReadingStats calculates streaks, daily goal completion, and achievements accurately', () => {
  const catalog = validateAndNormalizeCatalog(sampleCatalogRaw);
  const now = new Date(2026, 10, 18, 15, 0, 0); // Nov 18, 2026
  const todayKey = toDateKey(now);
  const yesterdayKey = toDateKey(new Date(2026, 10, 17));
  const twoDaysAgoKey = toDateKey(new Date(2026, 10, 16));

  const sessions = [
    { id: 's1', bookId: 'b1', dateKey: twoDaysAgoKey, startTime: 1, endTime: 2, durationSeconds: 1500, pagesRead: 40 },
    { id: 's2', bookId: 'b1', dateKey: yesterdayKey, startTime: 3, endTime: 4, durationSeconds: 1500, pagesRead: 35 },
    { id: 's3', bookId: 'b1', dateKey: todayKey, startTime: 5, endTime: 6, durationSeconds: 1200, pagesRead: 30 },
  ];

  const progressMap = {
    b1: {
      bookId: 'b1',
      currentPage: 105,
      totalPages: 180,
      status: 'completed' as const,
      lastReadAt: now.getTime(),
      totalSecondsRead: 4200,
    },
  };

  const stats = computeReadingStats(sessions, progressMap, catalog, 20, now);
  assert.equal(stats.currentStreakDays, 3);
  assert.equal(stats.longestStreakDays, 3);
  assert.equal(stats.todayMinutesRead, 20);
  assert.equal(stats.dailyGoalCompletionRate, 100);
  assert.equal(stats.totalPagesRead, 105);
  assert.equal(stats.achievements.find((a) => a.id === 'first_completed')?.unlocked, true);
  assert.equal(stats.achievements.find((a) => a.id === 'hundred_pages')?.unlocked, true);
});

test('shouldTriggerReminder respects quiet hours, daily goal completion, and duplicate prevention', () => {
  const db = makeEmptyDb();
  const settings = db.settings.reminders;

  // Overnight quiet hours check
  assert.equal(isWithinQuietHours(new Date(2026, 10, 18, 23, 0), '22:30', '07:00'), true);
  assert.equal(isWithinQuietHours(new Date(2026, 10, 18, 20, 10), '22:30', '07:00'), false);

  // Within primary reminder window, goal not reached
  const triggerOk = shouldTriggerReminder(settings, 10, {}, new Date(2026, 10, 18, 20, 10));
  assert.equal(triggerOk.shouldSend, true);
  assert.equal(triggerOk.reminderKey, 'daily_primary');

  // Stop once daily goal is reached
  const goalReached = shouldTriggerReminder(settings, 20, {}, new Date(2026, 10, 18, 20, 10));
  assert.equal(goalReached.shouldSend, false);
  assert.equal(goalReached.reason, 'goal_already_reached');

  // Prevent duplicate on same day
  const duplicate = shouldTriggerReminder(
    settings,
    5,
    { daily_primary: '2026-11-18' },
    new Date(2026, 10, 18, 20, 15)
  );
  assert.equal(duplicate.shouldSend, false);
});

test('validateAndMergeBackup restores data safely without duplicates', () => {
  const currentDb = makeEmptyDb();
  currentDb.notes.push({
    id: 'n1',
    bookId: 'b1',
    page: 5,
    title: 'Existing',
    content: 'Keep me',
    createdAt: 100,
    updatedAt: 100,
  });

  const backup = {
    backupVersion: 1,
    exportedAt: '2026-11-18T00:00:00Z',
    app: 'Zentra' as const,
    personalDb: {
      ...makeEmptyDb(),
      favorites: ['b3'],
      notes: [
        currentDb.notes[0],
        {
          id: 'n2',
          bookId: 'b1',
          page: 9,
          title: 'Restored',
          content: 'From backup',
          createdAt: 200,
          updatedAt: 200,
        },
      ],
    },
  };

  const { mergedDb, summary } = validateAndMergeBackup(backup, currentDb);
  assert.equal(summary.notesAdded, 1);
  assert.equal(mergedDb.notes.length, 2);
  assert.deepEqual(mergedDb.favorites, ['b3']);
});
