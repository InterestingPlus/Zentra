import React from 'react';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Compass,
  Download,
  Home,
  Library,
  Search,
  Settings,
} from 'lucide-react';
import type { ActiveTab, SubView } from '../types/zentra';

interface NavigationShellProps {
  activeTab: ActiveTab;
  subView: SubView;
  isOnline: boolean;
  activeDownloadCount: number;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenSearch: () => void;
  onOpenDownloads: () => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'knowledge', label: 'Knowledge', icon: BookMarked },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];

export const NavigationShell: React.FC<NavigationShellProps> = ({
  activeTab,
  subView,
  isOnline,
  activeDownloadCount,
  onSelectTab,
  onOpenSearch,
  onOpenDownloads,
  onOpenSettings,
  children,
}) => {
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0D1117] text-slate-900 dark:text-slate-100">
      {/* Desktop Left Navigation Rail */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#12161E] px-4 py-6 justify-between"
      >
        <div>
          <div className="px-3 mb-8 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#152238] text-white flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4 text-amber-300" />
            </div>
            <span className="font-display font-semibold text-xl tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              Zentra
            </span>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id && subView.type === 'none';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800 space-y-1">
            <button
              type="button"
              onClick={onOpenSearch}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white min-h-[44px] whitespace-nowrap"
            >
              <Search className="w-[18px] h-[18px] shrink-0" />
              <span>Explore & Search</span>
            </button>

            <button
              type="button"
              onClick={onOpenDownloads}
              aria-current={subView.type === 'downloads' ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap ${
                subView.type === 'downloads'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <Download className="w-[18px] h-[18px] shrink-0" />
                <span>Downloads</span>
              </span>
              {activeDownloadCount > 0 && (
                <span className="font-mono-tabular text-xs text-blue-700 dark:text-blue-400 font-semibold">
                  {activeDownloadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              aria-current={subView.type === 'settings' ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap ${
                subView.type === 'settings'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings className="w-[18px] h-[18px] shrink-0" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        <div className="px-3 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <p className="font-medium text-slate-700 dark:text-slate-300">
            {isOnline ? 'Online Catalog Connected' : 'Offline Mode Active'}
          </p>
          <p className="mt-0.5">Personal knowledge saved on device</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Top Bar (strictly <= 52px on mobile) */}
        <header className="sticky top-0 z-30 h-12 sm:h-14 px-4 sm:px-8 flex items-center justify-between gap-4 bg-white/90 dark:bg-[#12161E]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="font-display font-semibold text-lg tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
              Zentra
            </span>
          </div>

          <div className="hidden lg:flex items-center text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <span>Personal Knowledge Universe</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search books and authors"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onOpenDownloads}
              aria-label="Open offline downloads manager"
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden"
            >
              <Download className="w-5 h-5" />
              {activeDownloadCount > 0 && (
                <span className="absolute top-2 right-2 text-[10px] font-mono-tabular font-bold text-blue-700 dark:text-blue-400">
                  {activeDownloadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Open settings and preferences"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {!isOnline && (
          <div className="px-4 sm:px-8 py-2 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
            <span>Offline mode — showing cached catalog and downloaded PDFs.</span>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-8 py-5 pb-20 lg:pb-10 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile 5-Tab Bottom Navigation (56px height, well within 15% cap) */}
      <nav
        aria-label="Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 dark:bg-[#12161E]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && subView.type === 'none';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
                isActive
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
