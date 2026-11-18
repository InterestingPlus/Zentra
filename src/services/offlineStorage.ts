import type { DownloadRecord } from '../types/zentra';

const DB_NAME = 'zentra_offline_db';
const DB_VERSION = 1;
const STORE_FILES = 'pdf_files';
const STORE_META = 'download_records';

interface StoredPdfEntry {
  bookId: string;
  buffer: ArrayBuffer;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'bookId' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'bookId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB.'));
  });
}

export async function getAllDownloadRecords(): Promise<Record<string, DownloadRecord>> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.getAll();
      req.onsuccess = () => {
        const map: Record<string, DownloadRecord> = {};
        for (const rec of (req.result ?? []) as DownloadRecord[]) {
          // Recover any downloads interrupted mid-flight when app restarted
          if (rec.status === 'downloading' || rec.status === 'waiting') {
            map[rec.bookId] = {
              ...rec,
              status: 'paused',
              error: 'Download interrupted when app closed. Tap Retry to resume.',
            };
          } else {
            map[rec.bookId] = rec;
          }
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

export async function saveDownloadRecord(record: DownloadRecord): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function saveDownloadedPdf(
  bookId: string,
  buffer: ArrayBuffer,
  record: DownloadRecord
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite');
    tx.objectStore(STORE_FILES).put({
      bookId,
      buffer,
      savedAt: Date.now(),
    } satisfies StoredPdfEntry);
    tx.objectStore(STORE_META).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDownloadedPdfBuffer(bookId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const req = tx.objectStore(STORE_FILES).get(bookId);
      req.onsuccess = () => {
        const entry = req.result as StoredPdfEntry | undefined;
        resolve(entry?.buffer ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function getAllDownloadedPdfBuffers(): Promise<
  Array<{ bookId: string; buffer: ArrayBuffer; record: DownloadRecord }>
> {
  try {
    const db = await openDb();
    const records = await getAllDownloadRecords();
    const entries = await new Promise<StoredPdfEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const req = tx.objectStore(STORE_FILES).getAll();
      req.onsuccess = () => resolve((req.result ?? []) as StoredPdfEntry[]);
      req.onerror = () => reject(req.error);
    });
    return entries
      .filter((e) => records[e.bookId]?.status === 'downloaded')
      .map((e) => ({
        bookId: e.bookId,
        buffer: e.buffer,
        record: records[e.bookId],
      }));
  } catch {
    return [];
  }
}

export async function deleteDownloadedPdf(bookId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite');
    tx.objectStore(STORE_FILES).delete(bookId);
    tx.objectStore(STORE_META).delete(bookId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStorageUsageSummary(): Promise<{
  downloadedCount: number;
  downloadedBytes: number;
  quotaBytes: number | null;
  usageBytes: number | null;
}> {
  const records = await getAllDownloadRecords();
  const downloaded = Object.values(records).filter((r) => r.status === 'downloaded');
  const downloadedBytes = downloaded.reduce((sum, r) => sum + (r.totalBytes || r.bytesDownloaded || 0), 0);

  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      quotaBytes = est.quota ?? null;
      usageBytes = est.usage ?? null;
    } catch {
      // Ignore
    }
  }

  return {
    downloadedCount: downloaded.length,
    downloadedBytes,
    quotaBytes,
    usageBytes,
  };
}
