import { DEFAULT_CATALOG_URL, SEED_CATALOG } from '../data/seedCatalog';
import type { CatalogData } from '../types/zentra';
import { validateAndNormalizeCatalog } from '../utils/catalogLogic';

const CATALOG_CACHE_KEY = 'zentra_catalog_cache_v1';

export interface CatalogSyncState {
  catalog: CatalogData;
  source: 'remote' | 'cache' | 'builtin_fallback';
  lastSyncedAt: number | null;
  statusMessage: string;
  isError: boolean;
}

interface CachedCatalogRecord {
  catalog: CatalogData;
  cachedAt: number;
  sourceUrl: string;
}

export function loadCachedCatalog(): CachedCatalogRecord | null {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalogRecord;
    if (!parsed || !parsed.catalog) return null;
    if (
      parsed.sourceUrl === 'https://zentra.netlify.app/books/data.json' ||
      parsed.sourceUrl === 'https://zeentra.netlify.app/books/data.json'
    ) {
      return null;
    }
    const sourceUrl = parsed.sourceUrl || DEFAULT_CATALOG_URL;
    const normalized = validateAndNormalizeCatalog(parsed.catalog, sourceUrl);
    return {
      catalog: normalized,
      cachedAt: parsed.cachedAt || Date.now(),
      sourceUrl,
    };
  } catch {
    return null;
  }
}

export function saveCatalogCache(catalog: CatalogData, sourceUrl: string): void {
  try {
    const record: CachedCatalogRecord = {
      catalog,
      cachedAt: Date.now(),
      sourceUrl,
    };
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota issues
  }
}

export async function fetchAndSyncCatalog(
  catalogUrl = DEFAULT_CATALOG_URL,
  options?: { timeoutMs?: number }
): Promise<CatalogSyncState> {
  const cached = loadCachedCatalog();
  const timeoutMs = options?.timeoutMs ?? 6000;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (cached) {
      return {
        catalog: cached.catalog,
        source: 'cache',
        lastSyncedAt: cached.cachedAt,
        statusMessage: 'Offline mode — showing your locally cached catalog.',
        isError: false,
      };
    }
    return {
      catalog: validateAndNormalizeCatalog(SEED_CATALOG),
      source: 'builtin_fallback',
      lastSyncedAt: null,
      statusMessage: 'Offline mode — showing built-in Zentra starter library.',
      isError: false,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(catalogUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Catalog endpoint returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        `Expected JSON catalog from ${catalogUrl}, received ${contentType || 'non-JSON response'}.`
      );
    }

    const normalized = validateAndNormalizeCatalog(parsed, catalogUrl);
    saveCatalogCache(normalized, catalogUrl);
    return {
      catalog: normalized,
      source: 'remote',
      lastSyncedAt: Date.now(),
      statusMessage: `Synced ${normalized.books.length} books from ${catalogUrl} (v${normalized.version}).`,
      isError: false,
    };
  } catch (err) {
    clearTimeout(timer);
    const reason = err instanceof Error ? err.message : 'Unable to reach catalog server.';
    if (cached) {
      return {
        catalog: cached.catalog,
        source: 'cache',
        lastSyncedAt: cached.cachedAt,
        statusMessage: `Using cached catalog (${reason}).`,
        isError: true,
      };
    }
    const fallback = validateAndNormalizeCatalog(SEED_CATALOG);
    saveCatalogCache(fallback, catalogUrl);
    return {
      catalog: fallback,
      source: 'builtin_fallback',
      lastSyncedAt: Date.now(),
      statusMessage: `Remote catalog unavailable (${reason}). Loaded curated 20-book local catalog.`,
      isError: true,
    };
  }
}
