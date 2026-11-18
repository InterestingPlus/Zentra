import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Download,
  FileDown,
  RefreshCw,
  Smartphone,
  Upload,
} from 'lucide-react';
import {
  createBackupPayload,
  exportNotesAndHighlightsMarkdown,
  restoreFromBackupJson,
} from '../services/localDb';
import {
  getNotificationPermission,
  requestLocalNotificationPermission,
  usePWAInstall,
} from '../services/notificationService';
import type {
  AppSettings,
  AppThemeMode,
  CatalogData,
  PersonalDatabase,
  ReaderMode,
  ReaderTheme,
} from '../types/zentra';
import { toDateKey } from '../utils/analyticsLogic';

interface SettingsViewProps {
  catalog: CatalogData;
  db: PersonalDatabase;
  syncStatusMessage: string;
  onBack: () => void;
  onUpdateSettings: (updater: (prev: AppSettings) => AppSettings) => void;
  onRefreshCatalog: (customUrl?: string) => void;
  onImportCustomCatalogJson: (jsonText: string) => { ok: boolean; message: string };
  onRestoreMergedDb: (mergedDb: PersonalDatabase) => void;
  onOpenDownloads: () => void;
  onReplayOnboarding: () => void;
}

const WEEKDAYS = [
  { idx: 1, label: 'M' },
  { idx: 2, label: 'T' },
  { idx: 3, label: 'W' },
  { idx: 4, label: 'T' },
  { idx: 5, label: 'F' },
  { idx: 6, label: 'S' },
  { idx: 0, label: 'S' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  catalog,
  db,
  syncStatusMessage,
  onBack,
  onUpdateSettings,
  onRefreshCatalog,
  onImportCustomCatalogJson,
  onRestoreMergedDb,
  onOpenDownloads,
  onReplayOnboarding,
}) => {
  const { settings } = db;
  const [catalogUrlInput, setCatalogUrlInput] = useState(settings.catalogUrl);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [catalogImportMsg, setCatalogImportMsg] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState(getNotificationPermission());
  const [showIOSInstallHelp, setShowIOSInstallHelp] = useState(false);

  const restoreInputRef = useRef<HTMLInputElement>(null);
  const catalogFileRef = useRef<HTMLInputElement>(null);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const triggerDownloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportBackup = async (includePdfs: boolean) => {
    try {
      const payload = await createBackupPayload(db, includePdfs);
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerDownloadFile(
        `zentra-backup-${includePdfs ? 'full' : 'data'}-${dateStr}.json`,
        JSON.stringify(payload, null, 2),
        'application/json'
      );
      setBackupMessage(
        includePdfs
          ? `Full backup exported (including ${payload.embeddedPdfs?.length ?? 0} downloaded PDFs).`
          : 'Personal reading data backup exported.'
      );
    } catch (err) {
      setBackupMessage(
        err instanceof Error ? err.message : 'Unable to export backup.'
      );
    }
  };

  const handleExportNotes = () => {
    const bookTitles = new Map<string, string>();
    catalog.books.forEach((b) => bookTitles.set(b.id, b.title));
    const md = exportNotesAndHighlightsMarkdown(db, bookTitles);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownloadFile(`zentra-knowledge-${dateStr}.md`, md, 'text/markdown');
    setBackupMessage('Notes, highlights, and bookmarks exported as Markdown.');
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { mergedDb, summary } = await restoreFromBackupJson(text, db);
      onRestoreMergedDb(mergedDb);
      setBackupMessage(
        `Backup restored: +${summary.notesAdded} notes, +${summary.highlightsAdded} highlights, +${summary.bookmarksAdded} bookmarks, +${summary.pdfsRestored} offline PDFs.`
      );
    } catch (err) {
      setBackupMessage(
        `Restore failed: ${err instanceof Error ? err.message : 'Invalid backup file.'}`
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleImportCatalogFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = onImportCustomCatalogJson(text);
    setCatalogImportMsg(res.message);
    e.target.value = '';
  };

  const todayKey = toDateKey(new Date());
  const isSkippedToday = settings.reminders.skipTodayDate === todayKey;

  return (
    <div className="space-y-8 max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white min-h-[44px] pr-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">
          Settings & Backup
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure appearance, PDF reader behavior, local reminders, catalog source, and device
          backups.
        </p>
      </div>

      {/* PWA Install Card */}
      {!isInstalled && (isInstallable || isIOS) && (
        <section className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Install Zentra on Your Device
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Launch Zentra full-screen like a native app with instant offline access.
              </p>
            </div>
          </div>

          {isInstallable ? (
            <button
              type="button"
              onClick={install}
              className="px-4 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-semibold min-h-[44px] whitespace-nowrap shrink-0"
            >
              Install App
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowIOSInstallHelp((v) => !v)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold min-h-[44px] whitespace-nowrap shrink-0"
            >
              Install on iOS
            </button>
          )}
        </section>
      )}

      {showIOSInstallHelp && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161B22] text-sm text-slate-700 dark:text-slate-300">
          In Safari, tap the <strong>Share</strong> icon and choose{' '}
          <strong>Add to Home Screen</strong> to install Zentra.
        </div>
      )}

      {/* Appearance */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Appearance
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {(['light', 'dark', 'system'] as AppThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                onUpdateSettings((prev) => ({ ...prev, themeMode: mode }))
              }
              aria-pressed={settings.themeMode === mode}
              className={`py-2.5 px-3 rounded-xl border text-xs font-medium capitalize min-h-[44px] ${
                settings.themeMode === mode
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {mode} Theme
            </button>
          ))}
        </div>
      </section>

      {/* Reading Preferences */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Reader Preferences
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="default-reader-mode"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Default Reading Mode
            </label>
            <select
              id="default-reader-mode"
              value={settings.reader.defaultMode}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  reader: { ...prev.reader, defaultMode: e.target.value as ReaderMode },
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            >
              <option value="single">Single Page</option>
              <option value="double">Double-Page Book Spread</option>
              <option value="vertical">Vertical Scroll</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="default-reader-theme"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Default Reader Surface
            </label>
            <select
              id="default-reader-theme"
              value={settings.reader.readerTheme}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  reader: { ...prev.reader, readerTheme: e.target.value as ReaderTheme },
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            >
              <option value="light">Light Paper</option>
              <option value="sepia">Warm Sepia</option>
              <option value="dark">Dark Charcoal</option>
            </select>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Keep screen awake while reading
            </span>
            <input
              type="checkbox"
              checked={settings.reader.keepScreenAwake}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  reader: { ...prev.reader, keepScreenAwake: e.target.checked },
                }))
              }
              className="w-5 h-5 accent-blue-700"
            />
          </label>

          <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Page-turn transition animation
            </span>
            <input
              type="checkbox"
              checked={settings.reader.pageTurnAnimation}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  reader: { ...prev.reader, pageTurnAnimation: e.target.checked },
                }))
              }
              className="w-5 h-5 accent-blue-700"
            />
          </label>

          <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Cover spread alignment offset (pair pages 1-2 instead of blank left)
            </span>
            <input
              type="checkbox"
              checked={settings.reader.coverSpreadOffset}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  reader: { ...prev.reader, coverSpreadOffset: e.target.checked },
                }))
              }
              className="w-5 h-5 accent-blue-700"
            />
          </label>
        </div>
      </section>

      {/* Goals & Local Reminders */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Goals & Local Reminders
          </h2>
          {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
            <button
              type="button"
              onClick={async () => setNotifPerm(await requestLocalNotificationPermission())}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium min-h-[38px]"
            >
              <Bell className="w-3.5 h-3.5" />
              Enable Notifications
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="settings-daily-goal"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Daily Goal (minutes)
            </label>
            <input
              id="settings-daily-goal"
              type="number"
              min={5}
              max={240}
              value={settings.reminders.dailyGoalMinutes}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  reminders: {
                    ...prev.reminders,
                    dailyGoalMinutes: Math.max(5, Number(e.target.value) || 15),
                  },
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono-tabular"
            />
          </div>

          <div>
            <label
              htmlFor="settings-reminder-time"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Reminder Time
            </label>
            <input
              id="settings-reminder-time"
              type="time"
              value={settings.reminders.primaryReminderTime}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  reminders: { ...prev.reminders, primaryReminderTime: e.target.value },
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono-tabular"
            />
          </div>

          <div>
            <label
              htmlFor="settings-quiet-start"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Quiet Hours (Start – End)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="settings-quiet-start"
                type="time"
                value={settings.reminders.quietHoursStart}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    reminders: { ...prev.reminders, quietHoursStart: e.target.value },
                  }))
                }
                className="w-full px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono-tabular"
              />
              <input
                aria-label="Quiet hours end"
                type="time"
                value={settings.reminders.quietHoursEnd}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    reminders: { ...prev.reminders, quietHoursEnd: e.target.value },
                  }))
                }
                className="w-full px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono-tabular"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Reading Days
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const active = settings.reminders.preferredDays.includes(d.idx);
              return (
                <button
                  key={d.idx}
                  type="button"
                  onClick={() =>
                    onUpdateSettings((prev) => {
                      const days = prev.reminders.preferredDays;
                      const next = days.includes(d.idx)
                        ? days.length > 1
                          ? days.filter((x) => x !== d.idx)
                          : days
                        : [...days, d.idx];
                      return { ...prev, reminders: { ...prev.reminders, preferredDays: next } };
                    })
                  }
                  className={`w-10 h-10 rounded-xl text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() =>
              onUpdateSettings((prev) => ({
                ...prev,
                reminders: {
                  ...prev.reminders,
                  skipTodayDate: isSkippedToday ? undefined : todayKey,
                },
              }))
            }
            className={`px-3.5 py-2 rounded-xl border text-xs font-medium min-h-[40px] ${
              isSkippedToday
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-800 dark:text-amber-200'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {isSkippedToday ? 'Skipped Today (Undo)' : 'Skip Today'}
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings((prev) => ({
                ...prev,
                reminders: { ...prev.reminders, vacationMode: !prev.reminders.vacationMode },
              }))
            }
            className={`px-3.5 py-2 rounded-xl border text-xs font-medium min-h-[40px] ${
              settings.reminders.vacationMode
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 text-blue-800 dark:text-blue-200'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            Vacation Mode: {settings.reminders.vacationMode ? 'On' : 'Off'}
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings((prev) => ({
                ...prev,
                reminders: { ...prev.reminders, paused: !prev.reminders.paused },
              }))
            }
            className={`px-3.5 py-2 rounded-xl border text-xs font-medium min-h-[40px] ${
              settings.reminders.paused
                ? 'bg-slate-900 text-white border-slate-900'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {settings.reminders.paused ? 'Reminders Paused' : 'Pause All'}
          </button>
        </div>
      </section>

      {/* Online Catalog & Downloads */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Online Catalog & Storage
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{syncStatusMessage}</p>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <label htmlFor="catalog-endpoint-input" className="sr-only">
            Catalog JSON URL
          </label>
          <input
            id="catalog-endpoint-input"
            type="url"
            value={catalogUrlInput}
            onChange={(e) => setCatalogUrlInput(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono-tabular"
          />
          <button
            type="button"
            onClick={() => {
              onUpdateSettings((prev) => ({ ...prev, catalogUrl: catalogUrlInput.trim() }));
              onRefreshCatalog(catalogUrlInput.trim());
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-medium min-h-[44px] whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Now
          </button>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={onOpenDownloads}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium min-h-[40px]"
          >
            Manage Downloaded PDFs
          </button>

          <button
            type="button"
            onClick={() => catalogFileRef.current?.click()}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium min-h-[40px]"
          >
            Load Local Catalog JSON
          </button>
          <button
            type="button"
            onClick={() => {
              triggerDownloadFile('data.json', JSON.stringify(catalog, null, 2), 'application/json');
              setCatalogImportMsg('Downloaded data.json — place it at books/data.json on your site.');
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium min-h-[40px]"
          >
            Download data.json
          </button>
          <input
            ref={catalogFileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportCatalogFile}
            className="hidden"
          />
        </div>
        {catalogImportMsg && (
          <p className="text-xs text-blue-700 dark:text-blue-400">{catalogImportMsg}</p>
        )}
      </section>

      {/* Data & Backup */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Backup & Restore
        </h2>

        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Zentra stores all reading progress, notes, highlights, and bookmarks locally on your
            device with no mandatory cloud account. Clearing browser storage or uninstalling the
            app will erase local data unless you export a backup file.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => handleExportBackup(false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5" />
            Export Personal Data
          </button>

          <button
            type="button"
            onClick={() => handleExportBackup(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5" />
            Full Backup (incl. PDFs)
          </button>

          <button
            type="button"
            onClick={handleExportNotes}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium min-h-[44px]"
          >
            <FileDown className="w-3.5 h-3.5" />
            Export Notes (.md)
          </button>

          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-medium min-h-[44px]"
          >
            <Upload className="w-3.5 h-3.5" />
            Restore Backup
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleRestoreFile}
            className="hidden"
          />
        </div>

        {backupMessage && (
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">{backupMessage}</p>
        )}
      </section>

      {/* About Zentra */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            About Zentra
          </h2>
          <button
            type="button"
            onClick={onReplayOnboarding}
            className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline py-1"
          >
            Re-run setup guide
          </button>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 font-mono-tabular">
          <p>App Version: 1.0.0 · Personal Knowledge Universe</p>
          <p>
            Catalog Schema: v{catalog.version} · Updated {catalog.lastUpdated}
          </p>
          <p>Privacy: Zero tracking, zero accounts, local-first personal database.</p>
        </div>
      </section>
    </div>
  );
};
