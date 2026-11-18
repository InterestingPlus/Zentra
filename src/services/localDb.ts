import { DEFAULT_CATALOG_URL } from '../data/seedCatalog';
import type {
  AppSettings,
  PersonalDatabase,
  ZentraBackupPayload,
} from '../types/zentra';
import { validateAndMergeBackup } from '../utils/analyticsLogic';
import { getAllDownloadedPdfBuffers, saveDownloadedPdf } from './offlineStorage';

const PERSONAL_DB_KEY = 'zentra_personal_db_v1';

export function createDefaultSettings(): AppSettings {
  return {
    themeMode: 'system',
    catalogUrl: DEFAULT_CATALOG_URL,
    onboardingCompleted: false,
    userName: 'Reader',
    interests: [
      'Self-Help & Personal Development',
      'Philosophy & Motivation',
      'Psychology & Mindset',
    ],
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
      secondaryReminderTime: '',
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
  };
}

export function createDefaultPersonalDb(): PersonalDatabase {
  return {
    schemaVersion: 1,
    progressByBook: {},
    favorites: [],
    recentlyViewed: [],
    notInterestedIds: [],
    customLists: [
      {
        id: 'list_weekend',
        name: 'Weekend Deep Reads',
        bookIds: [],
        createdAt: Date.now(),
      },
    ],
    sessions: [],
    highlights: [],
    notes: [],
    bookmarks: [],
    lastSentReminders: {},
    settings: createDefaultSettings(),
  };
}

export function loadPersonalDb(): PersonalDatabase {
  try {
    const raw = localStorage.getItem(PERSONAL_DB_KEY);
    if (!raw) return createDefaultPersonalDb();
    const parsed = JSON.parse(raw) as Partial<PersonalDatabase>;
    const defaults = createDefaultPersonalDb();
    const storedUrl = parsed.settings?.catalogUrl;
    const migratedCatalogUrl =
      !storedUrl ||
      storedUrl === 'https://zentra.netlify.app/books/data.json' ||
      storedUrl === 'https://zeentra.netlify.app/books/data.json'
        ? DEFAULT_CATALOG_URL
        : storedUrl;
    return {
      ...defaults,
      ...parsed,
      schemaVersion: 1,
      progressByBook: parsed.progressByBook ?? {},
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      recentlyViewed: Array.isArray(parsed.recentlyViewed) ? parsed.recentlyViewed : [],
      notInterestedIds: Array.isArray(parsed.notInterestedIds) ? parsed.notInterestedIds : [],
      customLists: Array.isArray(parsed.customLists) ? parsed.customLists : defaults.customLists,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      lastSentReminders: parsed.lastSentReminders ?? {},
      settings: {
        ...defaults.settings,
        ...(parsed.settings ?? {}),
        catalogUrl: migratedCatalogUrl,
        reader: {
          ...defaults.settings.reader,
          ...(parsed.settings?.reader ?? {}),
        },
        reminders: {
          ...defaults.settings.reminders,
          ...(parsed.settings?.reminders ?? {}),
        },
      },
    };
  } catch {
    return createDefaultPersonalDb();
  }
}

export function savePersonalDb(db: PersonalDatabase): void {
  try {
    localStorage.setItem(PERSONAL_DB_KEY, JSON.stringify(db));
  } catch {
    // Storage quota exceeded - silently avoid crashing active reading session
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function createBackupPayload(
  db: PersonalDatabase,
  includeDownloadedPdfs: boolean
): Promise<ZentraBackupPayload> {
  const payload: ZentraBackupPayload = {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'Zentra',
    personalDb: db,
  };

  if (includeDownloadedPdfs) {
    const stored = await getAllDownloadedPdfBuffers();
    payload.embeddedPdfs = stored.map((item) => ({
      bookId: item.bookId,
      sha256: item.record.sha256 ?? '',
      totalBytes: item.buffer.byteLength,
      base64Data: arrayBufferToBase64(item.buffer),
    }));
  }

  return payload;
}

export async function restoreFromBackupJson(
  jsonText: string,
  currentDb: PersonalDatabase
): Promise<{
  mergedDb: PersonalDatabase;
  summary: {
    notesAdded: number;
    highlightsAdded: number;
    bookmarksAdded: number;
    listsAdded: number;
    pdfsRestored: number;
  };
}> {
  const parsed = JSON.parse(jsonText) as ZentraBackupPayload;
  const { mergedDb, summary } = validateAndMergeBackup(parsed, currentDb);

  let pdfsRestored = 0;
  if (Array.isArray(parsed.embeddedPdfs)) {
    for (const embedded of parsed.embeddedPdfs) {
      if (!embedded.bookId || !embedded.base64Data) continue;
      const buf = base64ToArrayBuffer(embedded.base64Data);
      await saveDownloadedPdf(
        embedded.bookId,
        buf,
        {
          bookId: embedded.bookId,
          status: 'downloaded',
          progress: 100,
          bytesDownloaded: buf.byteLength,
          totalBytes: buf.byteLength,
          sha256: embedded.sha256,
          pdfUrl: `zentra://restored/${embedded.bookId}.pdf`,
          downloadedAt: Date.now(),
        }
      );
      pdfsRestored += 1;
    }
  }

  return {
    mergedDb,
    summary: { ...summary, pdfsRestored },
  };
}

export function exportNotesAndHighlightsMarkdown(
  db: PersonalDatabase,
  bookTitles: Map<string, string>
): string {
  const lines: string[] = [
    '# Zentra — Personal Knowledge Export',
    `Exported: ${new Date().toLocaleString()}`,
    '',
  ];

  const bookIds = new Set<string>([
    ...db.notes.map((n) => n.bookId),
    ...db.highlights.map((h) => h.bookId),
    ...db.bookmarks.map((b) => b.bookId),
  ]);

  if (bookIds.size === 0) {
    lines.push('No saved notes, highlights, or bookmarks yet.');
    return lines.join('\n');
  }

  for (const bookId of bookIds) {
    const title = bookTitles.get(bookId) ?? bookId;
    lines.push(`## ${title}`);
    lines.push('');

    const highlights = db.highlights.filter((h) => h.bookId === bookId);
    if (highlights.length > 0) {
      lines.push('### Highlights');
      for (const h of highlights) {
        lines.push(`- [Page ${h.page}] (${h.color}) "${h.text}"`);
      }
      lines.push('');
    }

    const notes = db.notes.filter((n) => n.bookId === bookId);
    if (notes.length > 0) {
      lines.push('### Notes');
      for (const n of notes) {
        lines.push(`- **${n.title || 'Note'}** (Page ${n.page}): ${n.content}`);
      }
      lines.push('');
    }

    const bookmarks = db.bookmarks.filter((b) => b.bookId === bookId);
    if (bookmarks.length > 0) {
      lines.push('### Bookmarks');
      for (const b of bookmarks) {
        lines.push(`- Page ${b.page}: ${b.label}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
