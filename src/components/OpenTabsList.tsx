import { useEffect, useState, type DragEvent, type MouseEvent } from 'react';
import { useContextMenu } from '../hooks/useContextMenu';
import { queryOpenTabs, type OpenTab } from '../hooks/useTabManager';
import type { FolderRef } from '../types';
import { beginOpenTabDrag, DND_OPEN_TAB_MIME, endOpenTabDrag } from '../utils/dnd';
import { normalizeQuery, tabMatches } from '../utils/search';
import { Favicon } from './Favicon';
import { ArchiveIcon, ChevronDownIcon, GripIcon, PinIcon, SearchIcon, XIcon } from './ui/icons';
import { IconButton } from './ui/IconButton';
import { folderTargets, type MenuEntry } from './ui/menu';



const REFRESH_DEBOUNCE_MS = 150;

interface OpenTabsListProps {
  /** Dış kapsayıcıya göre boyut: yığılmış düzende varsayılan %45, kenar çubuğunda `h-full`. */
  className?: string;
  query: string;
  folders: FolderRef[];
  disabled: boolean;
  onActivate: (tabId: number) => void;
  onCloseTab: (tabId: number) => void;
  onAddToFolder: (workspaceId: string, tab: OpenTab, closeOriginal: boolean) => void;
  onSaveAll: () => void;
}

export function OpenTabsList({
  className = 'max-h-[45%]',
  query,
  folders,
  disabled,
  onActivate,
  onCloseTab,
  onAddToFolder,
  onSaveAll,
}: OpenTabsListProps) {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  // Listeye özel arama (üstteki genel `query` doluysa o öncelikli).
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const { menu, openAt } = useContextMenu();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      try {
        const open = await queryOpenTabs({ includePinned: true });
        if (!cancelled) setTabs(open);
      } catch (e) {
        console.warn('[TabFlow] Açık sekmeler yenilenemedi.', e);
      }
    };

    // Art arda gelen olayları tek bir yenilemede birleştirir.
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
    };

    // onUpdated sayfa yüklenirken sürekli tetiklenir; yalnızca listeyi etkileyen alanlara bak.
    const onUpdated = (
      _tabId: number,
      changeInfo: { title?: string; url?: string; favIconUrl?: string; pinned?: boolean },
    ) => {
      if (
        changeInfo.title !== undefined ||
        changeInfo.url !== undefined ||
        changeInfo.favIconUrl !== undefined ||
        changeInfo.pinned !== undefined
      ) {
        scheduleRefresh();
      }
    };

    void refresh();

    chrome.tabs.onCreated.addListener(scheduleRefresh);
    chrome.tabs.onRemoved.addListener(scheduleRefresh);
    chrome.tabs.onMoved.addListener(scheduleRefresh);
    chrome.tabs.onAttached.addListener(scheduleRefresh);
    chrome.tabs.onDetached.addListener(scheduleRefresh);
    chrome.tabs.onReplaced.addListener(scheduleRefresh);
    chrome.tabs.onActivated.addListener(scheduleRefresh);
    chrome.tabs.onUpdated.addListener(onUpdated);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      chrome.tabs.onCreated.removeListener(scheduleRefresh);
      chrome.tabs.onRemoved.removeListener(scheduleRefresh);
      chrome.tabs.onMoved.removeListener(scheduleRefresh);
      chrome.tabs.onAttached.removeListener(scheduleRefresh);
      chrome.tabs.onDetached.removeListener(scheduleRefresh);
      chrome.tabs.onReplaced.removeListener(scheduleRefresh);
      chrome.tabs.onActivated.removeListener(scheduleRefresh);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  const q = normalizeQuery(query !== '' ? query : localQuery);
  const visibleTabs = q === '' ? tabs : tabs.filter((t) => tabMatches(t, q));

  const handleDragStart = (e: DragEvent<HTMLLIElement>, tab: OpenTab) => {
    beginOpenTabDrag(tab);
    e.dataTransfer.setData(DND_OPEN_TAB_MIME, JSON.stringify({ id: tab.id }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const buildMenu = (tab: OpenTab): MenuEntry[] => {
    const entries: MenuEntry[] = [{ label: 'Sekmeye git', onSelect: () => onActivate(tab.id) }];
    if (folders.length === 0) {
      entries.push({ label: 'Önce bir klasör oluştur', onSelect: () => undefined, disabled: true });
    } else {
      entries.push(
        { type: 'heading', label: 'Klasöre taşı (sekme kapanır)' },
        ...folderTargets(folders, (f) => onAddToFolder(f.id, tab, true)),
        { type: 'heading', label: 'Klasöre kopyala' },
        ...folderTargets(folders, (f) => onAddToFolder(f.id, tab, false)),
      );
    }
    entries.push({ type: 'separator' }, { label: 'Sekmeyi kapat', onSelect: () => onCloseTab(tab.id), danger: true });
    return entries;
  };

  const handleContextMenu = (e: MouseEvent<HTMLElement>, tab: OpenTab) => {
    e.preventDefault();
    openAt(e.clientX, e.clientY, buildMenu(tab));
  };

  return (
    <section
      aria-label="Açık sekmeler"
      className={`flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white ${className}`}
    >
      <header className="flex items-center gap-1 p-1.5">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left hover:bg-gray-50"
        >
          <ChevronDownIcon className={`shrink-0 text-gray-500 transition ${isExpanded ? '' : '-rotate-90'}`} />
          <span className="text-sm font-semibold text-gray-900">Açık sekmeler</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {visibleTabs.length}
          </span>
        </button>
        <IconButton
          label="Açık sekmelerde ara"
          aria-pressed={isSearchOpen}
          onClick={() => {
            if (isSearchOpen) setLocalQuery('');
            setIsSearchOpen((v) => !v);
            setIsExpanded(true);
          }}
        >
          <SearchIcon />
        </IconButton>
        <IconButton
          label="Tüm sekmeleri bir klasöre kaydet ve kapat"
          onClick={onSaveAll}
          disabled={disabled || tabs.length === 0}
        >
          <ArchiveIcon />
        </IconButton>
      </header>

      {isExpanded && isSearchOpen && (
        <div className="px-3 pb-1.5">
          <input
            type="text"
            value={localQuery}
            autoFocus
            placeholder="Açık sekmelerde ara…"
            aria-label="Açık sekmelerde ara"
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setLocalQuery('');
                setIsSearchOpen(false);
              }
            }}
            className="block w-full rounded-md border-0 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-900 ring-1 ring-gray-300 ring-inset placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      )}

      {isExpanded && (
        <>
          <p className="px-3 pb-1.5 text-xs text-gray-500">
            Klasöre sürükle · Alt: kopyala · Sağ tık: menü
          </p>
          {visibleTabs.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-gray-500">
              {q === '' ? 'Listelenecek açık sekme yok.' : 'Aramayla eşleşen açık sekme yok.'}
            </p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-1.5">
              {visibleTabs.map((tab) => (
                <li
                  key={tab.id}
                  draggable={!disabled}
                  onDragStart={(e) => handleDragStart(e, tab)}
                  onDragEnd={endOpenTabDrag}
                  onContextMenu={(e) => handleContextMenu(e, tab)}
                  className={`group flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-gray-50 ${
                    tab.active ? 'bg-indigo-50' : ''
                  }`}
                >
                  <GripIcon className="shrink-0 cursor-grab text-gray-400" />
                  <button
                    type="button"
                    onClick={() => onActivate(tab.id)}
                    aria-current={tab.active ? 'true' : undefined}
                    title={`${tab.title}\n${tab.url}`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <Favicon pageUrl={tab.url} fallbackUrl={tab.favIconUrl} title={tab.title} />
                    <span className="truncate text-sm text-gray-800">{tab.title}</span>
                    {tab.pinned && <PinIcon className="size-3.5 shrink-0 text-gray-500" />}
                  </button>
                  <IconButton
                    label="Sekmeyi kapat"
                    onClick={() => onCloseTab(tab.id)}
                    className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                  >
                    <XIcon />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {menu}
    </section>
  );
}