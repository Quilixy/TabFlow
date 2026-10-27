import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { FolderComposer, type ComposerMode } from '../components/FolderComposer';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { ExpandIcon, PlusIcon, SearchIcon } from '../components/ui/icons';
import { PopupFolderRow } from '../components/popup/PopupFolderRow';
import { Toast } from '../components/ui/Toast';
import type { SavedTab, Workspace } from '../types';
import { useConfirm } from '../hooks/useConfirm';
import { useContextMenu } from '../hooks/useContextMenu';
import { restoreEntries } from '../components/ui/menu';
import { queryActiveTab } from '../hooks/useTabManager';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { getErrorMessage, useUiStore } from '../store/useUiStore';
import { formatSaveAllMessage } from '../utils/format';
import { formatRestoreResult, type RestoreMode } from '../utils/restore';
import { normalizeQuery, tabMatches } from '../utils/search';
import { NAVIGATE_KEY } from '../utils/uiSync';
import { buildChildrenIndex, collectSubtree, computeVisibleIds, countTabs, flattenTree } from '../utils/workspaceTree';

const SAVE_ACTION = '__save__';
const CREATE_ACTION = '__create__';
const ADDED_FEEDBACK_MS = 1600;
/** Bu sayıdan fazla sekme tek hamlede açılacaksa onay istenir (tam ekran uygulamayla aynı eşik). */
const RESTORE_CONFIRM_THRESHOLD = 25;

export default function PopupApp() {
  const { workspaces, isLoading, error, createFolder, createFolderWithTab, saveAndClose, addOpenTab, restoreFolder, openTab } =
    useWorkspaces();

  const query = useUiStore((s) => s.query);
  const setQuery = useUiStore((s) => s.setQuery);
  const closeOnAdd = useUiStore((s) => s.closeOnAdd);
  const setCloseOnAdd = useUiStore((s) => s.setCloseOnAdd);
  const errorMessage = useUiStore((s) => s.errorMessage);
  const showError = useUiStore((s) => s.showError);
  const clearError = useUiStore((s) => s.clearError);
  const showToast = useUiStore((s) => s.showToast);
  const expandedFolders = useUiStore((s) => s.popupExpanded);
  const setPopupExpanded = useUiStore((s) => s.setPopupExpanded);

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerMode | null>(null);
  // Aramada eşleşen sekmeler kendiliğinden gösterilir; kullanıcının bu aramada açıp kapattıkları burada tutulur
  // (sorgu değişince geçersizleşir).
  const [searchOverrides, setSearchOverrides] = useState<{ query: string; ids: Record<string, boolean> }>({
    query: '',
    ids: {},
  });
  const { dialog: confirmDialog, confirm } = useConfirm();

  // Animasyonların birbirini ezmemesi için id tabanlı kayıt
  const [justAddedIds, setJustAddedIds] = useState<Record<string, number>>({});
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Arama performansını artırmak için Debounce
  const deferredQuery = useDeferredValue(query);
  const q = normalizeQuery(deferredQuery);
  const hasQuery = q !== '';

  const index = useMemo(() => buildChildrenIndex(workspaces), [workspaces]);
  const visibleIds = useMemo(() => computeVisibleIds(workspaces, q), [workspaces, q]);

  const treeRows = useMemo(() => {
    if (hasQuery && visibleIds && visibleIds.size === 0) return [];
    return flattenTree(index, expandedFolders, visibleIds, hasQuery);
  }, [index, expandedFolders, visibleIds, hasQuery]);

  // Aramada her klasörün eşleşen sekmeleri (arama yoksa null: tüm sekmeler gösterilir).
  const matchingTabs = useMemo(() => {
    if (!hasQuery) return null;
    const result = new Map<string, SavedTab[]>();
    for (const row of treeRows) result.set(row.workspace.id, row.workspace.tabs.filter((t) => tabMatches(t, q)));
    return result;
  }, [treeRows, hasQuery, q]);

  useEffect(() => {
    const timers = timeoutRefs.current;
    return () => {
      // Bileşen silinirken bekleyen animasyon zamanlayıcılarını temizle
      for (const id in timers) clearTimeout(timers[id]);
    };
  }, []);

  const isRowExpanded = (id: string): boolean => {
    if (!matchingTabs) return expandedFolders[id] === true;
    const override = searchOverrides.query === q ? searchOverrides.ids[id] : undefined;
    return override ?? (matchingTabs.get(id)?.length ?? 0) > 0;
  };

  const toggleRow = (id: string) => {
    if (matchingTabs) {
      const ids = searchOverrides.query === q ? searchOverrides.ids : {};
      setSearchOverrides({ query: q, ids: { ...ids, [id]: !isRowExpanded(id) } });
    }
    else setPopupExpanded(id, !expandedFolders[id]);
  };

  const run = useCallback(
    async (actionId: string, task: () => Promise<unknown>): Promise<boolean> => {
      setPendingAction(actionId);
      clearError();
      try {
        await task();
        return true;
      } catch (e) {
        showError(getErrorMessage(e));
        return false;
      } finally {
        setPendingAction(null);
      }
    },
    [clearError, showError],
  );

  const handleComposerSubmit = useCallback(
    (name: string, includePinned: boolean) => {
      if (composer === 'saveAll') {
        return run(SAVE_ACTION, async () => {
          const { folder, skipped, closeFailed } = await saveAndClose(name, includePinned, null);
          showToast(formatSaveAllMessage(folder.tabs.length, folder.name, skipped, closeFailed));
        });
      }
      if (composer === 'saveActive') {
        return run(CREATE_ACTION, async () => {
          // Önce sayfayı doğrula: kaydedilemeyen bir sayfada boş klasör oluşmasın. Klasör ve sekme tek yazmada.
          const activeTab = await queryActiveTab();
          const { folder, closeFailed } = await createFolderWithTab(name, null, activeTab, closeOnAdd);
          showToast(`Aktif sayfa “${folder.name}” klasörüne kaydedildi.${closeFailed ? ' Sekme kapatılamadı.' : ''}`);
        });
      }
      return run(CREATE_ACTION, async () => {
        const created = await createFolder(name, null);
        showToast(`“${created.name}” klasörü oluşturuldu.`);
      });
    },
    [composer, run, saveAndClose, createFolder, createFolderWithTab, closeOnAdd, showToast],
  );

  const handleAddActive = useCallback(
    (folderId: string, folderName: string) => {
      void run(`add:${folderId}`, async () => {
        const activeTab = await queryActiveTab();
        const { added, closeFailed } = await addOpenTab(folderId, activeTab, closeOnAdd);
        if (!added) {
          showToast(`Bu sayfa “${folderName}” klasöründe zaten var.`);
          return;
        }
        if (closeFailed) showToast(`Sayfa “${folderName}” klasörüne eklendi, ancak sekme kapatılamadı.`);

        // Başarı animasyonu
        setJustAddedIds((prev) => ({ ...prev, [folderId]: Date.now() }));
        if (timeoutRefs.current[folderId]) clearTimeout(timeoutRefs.current[folderId]);
        timeoutRefs.current[folderId] = setTimeout(() => {
          setJustAddedIds((prev) => {
            const next = { ...prev };
            delete next[folderId];
            return next;
          });
        }, ADDED_FEEDBACK_MS);
      });
    },
    [run, addOpenTab, closeOnAdd, showToast],
  );

  const handleRestore = useCallback(
    (folder: Workspace, recursive: boolean, total: number, mode: RestoreMode = 'tabs') => {
      void run(`restore:${folder.id}`, async () => {
        if (total > RESTORE_CONFIRM_THRESHOLD) {
          const ok = await confirm({
            title: `En fazla ${total} sekme açılacak`,
            message:
              mode === 'window'
                ? 'Hepsi yeni bir pencerede açılır. Devam edilsin mi?'
                : 'Bu pencerede zaten açık olanlar atlanır. Devam edilsin mi?',
            confirmLabel: 'Sekmeleri aç',
          });
          if (!ok) return;
        }
        showToast(formatRestoreResult(await restoreFolder(folder.id, recursive, true, mode), folder.name));
      });
    },
    [run, confirm, restoreFolder, showToast],
  );

  const { menu, openAt } = useContextMenu();

  const subtreeTabCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of Object.keys(workspaces)) counts.set(id, countTabs(collectSubtree(index, workspaces, id)));
    return counts;
  }, [index, workspaces]);

  // "Aç": klasörün kendi sekmeleri; kendi sekmesi yoksa (yalnızca alt klasör tutuyorsa) alt klasörlerdekiler.
  const handleOpenClick = useCallback(
    (folder: Workspace) => {
      const subtreeTabs = subtreeTabCounts.get(folder.id) ?? folder.tabs.length;
      if (folder.tabs.length > 0) handleRestore(folder, false, folder.tabs.length);
      else handleRestore(folder, true, subtreeTabs);
    },
    [subtreeTabCounts, handleRestore],
  );

  // "Aç ▾": tüm açma seçenekleri (alt klasörlerle, sekme grubu, yeni pencere).
  const handleOpenMenu = useCallback(
    (e: MouseEvent<HTMLButtonElement>, folder: Workspace) => {
      const subtreeTabs = subtreeTabCounts.get(folder.id) ?? folder.tabs.length;
      const rect = e.currentTarget.getBoundingClientRect();
      openAt(
        rect.right - 210,
        rect.bottom + 4,
        restoreEntries(folder.tabs.length, subtreeTabs, false, (recursive, mode) =>
          handleRestore(folder, recursive, recursive ? subtreeTabs : folder.tabs.length, mode),
        ),
      );
    },
    [subtreeTabCounts, handleRestore, openAt],
  );

  const handleOpenSavedTab = useCallback(
    (tab: SavedTab) => {
      void run(`open-tab:${tab.id}`, async () => {
        const status = await openTab(tab);
        showToast(status === 'opened' ? 'Sekme arka planda açıldı.' : 'Bu sayfa zaten açık.');
      });
    },
    [run, openTab, showToast],
  );

  /** Tam ekran uygulamayı açar; folderId verilirse o klasöre gider (uygulama zaten açıksa da). */
  const openFullApp = (folderId?: string) => {
    if (folderId) {
      try {
        localStorage.setItem(NAVIGATE_KEY, JSON.stringify({ id: folderId, at: Date.now() }));
      } catch {
        // Depolama kullanılamıyorsa yalnızca uygulamayı aç.
      }
    }
    chrome.runtime
      .openOptionsPage()
      .then(() => window.close())
      .catch((e) => showError(getErrorMessage(e)));
  };

  const isBusy = pendingAction !== null;
  const bannerMessage = errorMessage ?? error?.message ?? null;

  return (
    <main className="flex h-[560px] max-h-[600px] w-[380px] flex-col gap-3 p-3">
      <header className="flex shrink-0 items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">TabFlow</h1>
        <Button variant="secondary" size="sm" onClick={() => openFullApp()}>
          <ExpandIcon />
          Tam ekranda aç
        </Button>
      </header>

      <div className="relative shrink-0">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-500" />
        <input
          type="search"
          value={query}
          autoFocus={!composer}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Klasör veya sekme ara…"
          aria-label="Klasör veya sekme ara"
          className="block w-full rounded-md border-0 bg-white py-2 pr-3 pl-8 text-sm text-gray-900 ring-1 ring-gray-300 ring-inset placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      {bannerMessage && (
        <div className="shrink-0">
          <ErrorBanner message={bannerMessage} onDismiss={errorMessage ? clearError : undefined} />
        </div>
      )}

      {composer && (
        <div className="shrink-0">
          <FolderComposer
            key={composer}
            mode={composer}
            isBusy={pendingAction === SAVE_ACTION || pendingAction === CREATE_ACTION}
            disabled={isBusy}
            onSubmit={handleComposerSubmit}
            onClose={() => setComposer(null)}
          />
        </div>
      )}

      <section aria-label="Klasörler" className="flex min-h-0 flex-1 flex-col">
        <h2 className="mb-1.5 shrink-0 text-xs font-medium text-gray-500">
          {hasQuery ? 'Sonuçlar' : 'Klasörler'}
        </h2>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-gray-500">Yükleniyor…</p>
        ) : treeRows.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">
            {hasQuery ? 'Eşleşen klasör yok.' : 'Henüz klasör yok. Aşağıdan oluştur.'}
          </p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--tf-card-border)] bg-white p-1 shadow-sm">
            {treeRows.map((row) => {
              const { workspace } = row;
              return (
                <PopupFolderRow
                  key={workspace.id}
                  workspace={workspace}
                  depth={row.depth}
                  parentName={workspace.parentId !== null ? (workspaces[workspace.parentId]?.name ?? null) : null}
                  childCount={index.get(workspace.id)?.length ?? 0}
                  subtreeTabCount={subtreeTabCounts.get(workspace.id) ?? workspace.tabs.length}
                  isExpanded={isRowExpanded(workspace.id)}
                  matchingTabs={matchingTabs?.get(workspace.id) ?? null}
                  justAdded={!!justAddedIds[workspace.id]}
                  busy={isBusy}
                  onToggle={() => toggleRow(workspace.id)}
                  onAdd={() => handleAddActive(workspace.id, workspace.name)}
                  onOpenAll={() => handleOpenClick(workspace)}
                  onOpenMenu={(e) => handleOpenMenu(e, workspace)}
                  onOpenTab={handleOpenSavedTab}
                  onShowMore={() => openFullApp(workspace.id)}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* Sabit bildirim dar popup'ta düğmelerin üstüne binerdi: listenin altında, akış içinde göster. */}
      <Toast inline />

      <footer className="shrink-0 space-y-2 border-t border-gray-200 pt-3">
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => setComposer('saveAll')} disabled={isBusy}>
            Tümünü kaydet
          </Button>
          <Button variant="soft" size="sm" className="flex-1" onClick={() => setComposer('saveActive')} disabled={isBusy}>
            Aktifi kaydet
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setComposer('empty')}
            disabled={isBusy}
            title="Yeni klasör oluştur"
            aria-label="Yeni klasör oluştur"
          >
            <PlusIcon />
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={closeOnAdd}
            onChange={(e) => setCloseOnAdd(e.target.checked)}
            className="size-4 accent-indigo-600"
          />
          Eklediğim sayfayı kapat
        </label>
      </footer>

      {menu}
      {confirmDialog}
    </main>
  );
}