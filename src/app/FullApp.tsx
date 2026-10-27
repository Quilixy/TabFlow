import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Canvas } from '../components/app/Canvas';
import { FolderTree } from '../components/app/FolderTree';
import { FolderComposer, type ComposerMode } from '../components/FolderComposer';
import { AppearanceMenu } from '../components/AppearanceMenu';
import { PetalBurst } from '../components/PetalBurst';
import { ThemeDecor } from '../components/ThemeDecor';
import { FolderStylePicker, type FolderStylePatch } from '../components/FolderStylePicker';
import { OpenTabsList } from '../components/OpenTabsList';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { ArchiveIcon, ChevronDownIcon, ExternalLinkIcon, PlusIcon } from '../components/ui/icons';
import { Toast } from '../components/ui/Toast';
import { useConfirm } from '../hooks/useConfirm';
import { useContextMenu } from '../hooks/useContextMenu';
import { resolveOpenTabById, type OpenTab } from '../hooks/useTabManager';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { emitFolderBurst } from '../store/burst';
import { getErrorMessage, useUiStore, type RenameSource } from '../store/useUiStore';
import type { Point, SavedTab } from '../types';
import { backupFileName, createBackup, MAX_BACKUP_BYTES, parseBackup, serializeBackup } from '../utils/backup';
import { downloadTextFile } from '../utils/download';
import { formatAgo, formatRestoreMessage, formatSaveAllMessage } from '../utils/format';
import { LEAVE_ANIMATION_MS } from '../utils/theme';
import { NAVIGATE_KEY, parseNavigateRequest } from '../utils/uiSync';
import { canReparent, collectSubtree, countTabs, getPath, pathLabel } from '../utils/workspaceTree';

const SAVE_ACTION = '__save__';
const CREATE_ACTION = '__create__';
/** Bu sayıdan fazla sekme tek hamlede açılacaksa kullanıcıdan onay istenir. */
const RESTORE_CONFIRM_THRESHOLD = 25;
/** Bu kadar (veya daha fazla) sekme/alt klasör içeren bir klasör silinirken onay istenir. */
const DELETE_CONFIRM_TABS = 10;
const RECENT_FOLDER_COUNT = 15;
/** Bu süreden eski (veya hiç alınmamış) yedekte yedek düğmesinde uyarı noktası gösterilir. */
const BACKUP_REMINDER_MS = 14 * 24 * 60 * 60 * 1000;

interface ComposerState {
  mode: ComposerMode;
  parentId: string | null;
}

export default function FullApp() {
  const {
    workspaces,
    index,
    isLoading,
    error,
    createFolder,
    saveAndClose,
    renameFolder,
    setFolderStyle,
    removeFolder,
    reinsertFolders,
    moveFolder,
    setFolderPosition,
    applyLayout,
    addOpenTab,
    moveTab,
    setTabPosition,
    removeTab,
    insertTab,
    importWorkspaces,
    revertImport,
    restoreFolder,
    openTab,
    activateTab,
    closeOpenTab,
  } = useWorkspaces();

  const selectedFolderId = useUiStore((s) => s.selectedFolderId);
  const setSelectedFolder = useUiStore((s) => s.setSelectedFolder);
  const expandMany = useUiStore((s) => s.expandMany);
  const setRenamingId = useUiStore((s) => s.setRenamingId);
  const markEntering = useUiStore((s) => s.markEntering);
  const setLeaving = useUiStore((s) => s.setLeaving);
  const animation = useUiStore((s) => s.animation);
  const lastBackupAt = useUiStore((s) => s.lastBackupAt);
  const setLastBackupAt = useUiStore((s) => s.setLastBackupAt);
  const query = useUiStore((s) => s.query);
  const setQuery = useUiStore((s) => s.setQuery);
  const errorMessage = useUiStore((s) => s.errorMessage);
  const showError = useUiStore((s) => s.showError);
  const clearError = useUiStore((s) => s.clearError);
  const showToast = useUiStore((s) => s.showToast);

  // Aynı anda birden çok eylem sürebilir (ör. uzun bir geri yükleme sürerken açık sekme kapatmak):
  // biri bitince diğerleri hâlâ sürerken arayüz yeniden etkinleşmesin.
  // Sayaçlı: aynı kimlikli eylem üst üste iki kez çalışabilir (ör. art arda iki renk seçimi).
  const [pendingActions, setPendingActions] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [showOpenTabs, setShowOpenTabs] = useState(true);
  const [mountedAt] = useState(() => Date.now());
  const [stylePicker, setStylePicker] = useState<{ folderId: string; x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { menu: backupMenu, openAt: openBackupMenuAt } = useContextMenu();
  const { menu: restoreMenu, openAt: openRestoreMenuAt } = useContextMenu();
  const { dialog: confirmDialog, confirm } = useConfirm();

  // Kalıcı seçili klasör silinmişse (veya veri henüz yüklenmediyse) kökü göster; store'a dokunma.
  const currentId = selectedFolderId !== null && workspaces[selectedFolderId] ? selectedFolderId : null;
  const current = currentId !== null ? workspaces[currentId] : undefined;
  const breadcrumb = useMemo(() => getPath(workspaces, currentId), [workspaces, currentId]);

  // Menülerde yüzlerce klasör listelemek yerine en son kullanılanları göster.
  const recentFolders = useMemo(
    () =>
      Object.values(workspaces)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, RECENT_FOLDER_COUNT)
        .map((w) => ({ id: w.id, name: pathLabel(workspaces, w.id) })),
    [workspaces],
  );

  const run = useCallback(
    async (actionId: string, task: () => Promise<unknown>): Promise<boolean> => {
      setPendingActions((prev) => new Map(prev).set(actionId, (prev.get(actionId) ?? 0) + 1));
      clearError();
      try {
        await task();
        return true;
      } catch (e) {
        showError(getErrorMessage(e));
        return false;
      } finally {
        setPendingActions((prev) => {
          const next = new Map(prev);
          const count = (next.get(actionId) ?? 1) - 1;
          if (count > 0) next.set(actionId, count);
          else next.delete(actionId);
          return next;
        });
      }
    },
    [clearError, showError],
  );

  /** Arka planda sessizce kaydedilen işler (kart konumu): arayüzü kilitlemez, okunmamış hata bandını silmez. */
  const runQuiet = useCallback(
    async (task: () => Promise<unknown>): Promise<boolean> => {
      try {
        await task();
        return true;
      } catch (e) {
        showError(getErrorMessage(e));
        return false;
      }
    },
    [showError],
  );

  const navigate = useCallback(
    (id: string | null) => {
      setSelectedFolder(id);
      if (id !== null) expandMany(getPath(workspaces, id).map((w) => w.id));
    },
    [setSelectedFolder, expandMany, workspaces],
  );

  // Popup "şu klasörü tam ekranda göster" dediyse oraya git (uygulama yeni açıldıysa da, zaten açıksa da).
  const revealRef = useRef<string | null>(null);
  useEffect(() => {
    const handle = (raw: string | null) => {
      const id = parseNavigateRequest(raw);
      if (!id) return;
      try {
        localStorage.removeItem(NAVIGATE_KEY);
      } catch {
        // yok say
      }
      revealRef.current = id;
      setSelectedFolder(id);
    };
    try {
      handle(localStorage.getItem(NAVIGATE_KEY));
    } catch {
      // Depolama kullanılamıyor
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === NAVIGATE_KEY) handle(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [setSelectedFolder]);

  // Veri yüklenince gidilen klasörün üst dallarını aç (ağaçta görünsün).
  useEffect(() => {
    const id = revealRef.current;
    if (id === null || !workspaces[id]) return;
    revealRef.current = null;
    expandMany(getPath(workspaces, id).map((w) => w.id));
  }, [workspaces, selectedFolderId, expandMany]);

  const nameOf = useCallback((id: string) => workspaces[id]?.name ?? 'klasör', [workspaces]);

  // ---- Klasör oluşturma ----------------------------------------------------------
  const handleComposerSubmit = useCallback(
    (name: string, includePinned: boolean) => {
      if (!composer) return Promise.resolve(false);
      if (composer.mode === 'saveAll') {
        return run(SAVE_ACTION, async () => {
          const { folder: created, skipped, closeFailed } = await saveAndClose(name, includePinned, composer.parentId);
          markEntering([created.id]);
          emitFolderBurst(created.id);
          showToast(formatSaveAllMessage(created.tabs.length, created.name, skipped, closeFailed));
        });
      }
      return run(CREATE_ACTION, async () => {
        const created = await createFolder(name, composer.parentId);
        markEntering([created.id]);
        emitFolderBurst(created.id);
        showToast(`“${created.name}” klasörü oluşturuldu.`);
        if (composer.parentId !== null) expandMany([composer.parentId]);
      });
    },
    [composer, run, saveAndClose, createFolder, showToast, expandMany, markEntering],
  );

  // ---- Açık sekmeler -------------------------------------------------------------
  const handleActivate = useCallback(
    (tabId: number) => {
      void run(`activate:${tabId}`, () => activateTab(tabId));
    },
    [run, activateTab],
  );

  const handleCloseOpenTab = useCallback(
    (tabId: number) => {
      void run(`close:${tabId}`, () => closeOpenTab(tabId));
    },
    [run, closeOpenTab],
  );

  const handleDropOpenTab = useCallback(
    (folderId: string | null, tab: OpenTab, closeOriginal: boolean, position?: Point) => {
      if (folderId === null) {
        showToast('Sekmeyi eklemek için önce bir klasör seç.');
        return;
      }
      void run(`drop:${folderId}:${tab.id}`, async () => {
        // Bırakılan veri başka bir sayfadan gelmiş olabilir: sekmeyi tarayıcıdan yeniden oku.
        const real = await resolveOpenTabById(tab.id);
        if (!real) throw new Error('Sekme bulunamadı ya da kaydedilemiyor (yalnızca web sayfaları kaydedilir).');
        const { added, closeFailed } = await addOpenTab(folderId, real, closeOriginal, position);
        if (added) emitFolderBurst(folderId);
        showToast(
          !added
            ? `Bu sayfa “${nameOf(folderId)}” klasöründe zaten var.`
            : closeFailed
              ? `Sekme “${nameOf(folderId)}” klasörüne eklendi, ancak kapatılamadı.`
              : `Sekme “${nameOf(folderId)}” klasörüne ${closeOriginal ? 'taşındı' : 'kopyalandı'}.`,
        );
      });
    },
    [run, addOpenTab, showToast, nameOf],
  );

  // ---- Tuval / ağaç eylemleri ----------------------------------------------------
  const handleMoveTab = useCallback(
    (fromFolderId: string, tabId: string, toFolderId: string, copy: boolean) => {
      void run(`move-tab:${tabId}`, async () => {
        const { status } = await moveTab(fromFolderId, tabId, toFolderId, { copy });
        if (status === 'duplicate') {
          showToast(`Bu sayfa “${nameOf(toFolderId)}” klasöründe zaten var; ${copy ? 'kopyalanmadı' : 'taşınmadı'}.`);
          return;
        }
        emitFolderBurst(toFolderId);
        showToast(`Sekme “${nameOf(toFolderId)}” klasörüne ${copy ? 'kopyalandı' : 'taşındı'}.`);
      });
    },
    [run, moveTab, showToast, nameOf],
  );

  const handleMoveFolder = useCallback(
    (folderId: string, newParentId: string | null, position?: Point) => {
      if (folderId === newParentId) return;
      if (!canReparent(workspaces, folderId, newParentId)) {
        showToast('Bir klasör kendi alt klasörüne taşınamaz.');
        return;
      }
      void run(`move-folder:${folderId}`, async () => {
        const status = await moveFolder(folderId, newParentId, position);
        if (status !== 'moved') return; // aynı yerde kaldı ya da yalnızca tuvaldeki konumu değişti
        showToast(
          newParentId === null
            ? `“${nameOf(folderId)}” köke taşındı.`
            : `“${nameOf(folderId)}” → “${nameOf(newParentId)}” içine taşındı.`,
        );
        if (newParentId !== null) expandMany([newParentId]);
      });
    },
    [workspaces, run, moveFolder, showToast, nameOf, expandMany],
  );

  const handleSetTabPosition = useCallback(
    (folderId: string, tabId: string, x: number, y: number) => runQuiet(() => setTabPosition(folderId, tabId, x, y)),
    [runQuiet, setTabPosition],
  );

  const handleSetFolderPosition = useCallback(
    (folderId: string, x: number, y: number) => runQuiet(() => setFolderPosition(folderId, x, y)),
    [runQuiet, setFolderPosition],
  );

  const handleArrange = useCallback(
    (positions: Record<string, Point>) => {
      // Geri al için kayıtlı (ekranda çakışma çözülmemiş) konumların anlık görüntüsü.
      const before: Record<string, Point> = {};
      for (const child of index.get(currentId) ?? []) before[child.id] = { x: child.x, y: child.y };
      for (const tab of current?.tabs ?? []) before[tab.id] = { x: tab.x, y: tab.y };
      const parentId = currentId;
      void run('arrange', async () => {
        await applyLayout(parentId, positions);
        showToast('Öğeler ızgaraya dizildi.', {
          label: 'Geri al',
          run: () => void run('undo-arrange', () => applyLayout(parentId, before)),
        });
      });
    },
    [run, applyLayout, currentId, current, index, showToast],
  );

  const handleRename = useCallback(
    (id: string, source: RenameSource) => {
      setRenamingId(id, source);
    },
    [setRenamingId],
  );

  const handleRenameCommit = useCallback(
    (id: string, name: string) => {
      setRenamingId(null);
      const folder = workspaces[id];
      const trimmed = name.trim();
      if (!folder || trimmed === '' || trimmed === folder.name) return;
      void run(`rename:${id}`, () => renameFolder(id, trimmed));
    },
    [workspaces, run, renameFolder, setRenamingId],
  );

  const handleStyle = useCallback((id: string, anchor: Point) => {
    setStylePicker({ folderId: id, x: anchor.x, y: anchor.y });
  }, []);

  const handleStyleChange = useCallback(
    (patch: FolderStylePatch) => {
      if (!stylePicker) return;
      void run(`style:${stylePicker.folderId}`, () => setFolderStyle(stylePicker.folderId, patch));
    },
    [stylePicker, run, setFolderStyle],
  );

  // F2: seçili klasörü yeniden adlandır (bir yazı alanındayken karışma). Ağaç satırı görünür alana kaydırılır.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F2' || currentId === null) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      setRenamingId(currentId, 'tree');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentId, setRenamingId]);

  const handleDelete = useCallback(
    (id: string) => {
      const folder = workspaces[id];
      if (!folder) return;
      // Silinen klasörün içindeysek bir üst klasöre çık.
      const isInside = getPath(workspaces, currentId).some((w) => w.id === id);
      const subtree = collectSubtree(index, workspaces, id);
      const tabCount = countTabs(subtree);
      void run(`delete:${id}`, async () => {
        // Büyük ağaçlarda yalnızca birkaç saniyelik "Geri al" bildirimine güvenme.
        if (tabCount + subtree.length - 1 >= DELETE_CONFIRM_TABS) {
          const ok = await confirm({
            title: `“${folder.name}” silinsin mi?`,
            message:
              subtree.length > 1
                ? `${subtree.length - 1} alt klasör ve toplam ${tabCount} sekme de silinecek.`
                : `İçindeki ${tabCount} sekme de silinecek.`,
            confirmLabel: 'Sil',
            danger: true,
          });
          if (!ok) return;
        }
        // Çıkış animasyonu oynasın, sonra gerçekten sil.
        if (animation !== 'none') {
          setLeaving([id], true);
          await new Promise((resolve) => setTimeout(resolve, LEAVE_ANIMATION_MS));
        }
        let removed: Awaited<ReturnType<typeof removeFolder>>;
        try {
          removed = await removeFolder(id);
        } finally {
          setLeaving([id], false);
        }
        if (removed.length === 0) return;
        if (isInside) setSelectedFolder(folder.parentId);
        const extra = removed.length - 1;
        showToast(`“${folder.name}”${extra > 0 ? ` ve ${extra} alt klasör` : ''} silindi.`, {
          label: 'Geri al',
          run: () =>
            void run(`undo-delete:${id}`, async () => {
              await reinsertFolders(removed);
              markEntering(removed.map((w) => w.id));
            }),
        });
      });
    },
    [
      workspaces,
      index,
      currentId,
      run,
      confirm,
      removeFolder,
      reinsertFolders,
      setSelectedFolder,
      showToast,
      animation,
      setLeaving,
      markEntering,
    ],
  );

  const handleRestore = useCallback(
    (id: string, recursive: boolean) => {
      const folder = workspaces[id];
      if (!folder) return;
      const folders = recursive ? collectSubtree(index, workspaces, id) : [folder];
      const total = countTabs(folders);

      void run(`restore:${id}`, async () => {
        if (total > RESTORE_CONFIRM_THRESHOLD) {
          const ok = await confirm({
            title: `En fazla ${total} sekme açılacak`,
            message: 'Bu pencerede zaten açık olanlar atlanır. Devam edilsin mi?',
            confirmLabel: 'Sekmeleri aç',
          });
          if (!ok) return;
        }
        // Tam ekran uygulamadan ayrılmamak için ilk sekmeye geçme.
        showToast(formatRestoreMessage(await restoreFolder(id, recursive, false)));
      });
    },
    [workspaces, index, run, confirm, restoreFolder, showToast],
  );

  const handleRemoveTab = useCallback(
    (folderId: string, tabId: string) => {
      void run(`remove-tab:${tabId}`, async () => {
        const removed = await removeTab(folderId, tabId);
        if (!removed) return;
        showToast('Sekme klasörden kaldırıldı.', {
          label: 'Geri al',
          run: () => void run(`undo-remove-tab:${tabId}`, () => insertTab(folderId, removed.tab, removed.index)),
        });
      });
    },
    [run, removeTab, insertTab, showToast],
  );

  // ---- Yedekleme -------------------------------------------------------------------
  const handleExport = useCallback(() => {
    void run('export', async () => {
      const count = Object.keys(workspaces).length;
      if (count === 0) throw new Error('Yedeklenecek klasör yok.');
      downloadTextFile(backupFileName(), serializeBackup(createBackup(workspaces)));
      setLastBackupAt(Date.now());
      showToast(`${count} klasör yedeklendi.`);
    });
  }, [workspaces, run, setLastBackupAt, showToast]);

  const handleImportFile = useCallback(
    (file: File) => {
      void run('import', async () => {
        if (file.size > MAX_BACKUP_BYTES) throw new Error('Dosya çok büyük (en fazla 50 MB).');
        const parsed = parseBackup(await file.text());
        const incoming = Object.values(parsed.workspaces);
        const skipped = parsed.skippedFolders + parsed.skippedTabs;
        const ok = await confirm({
          title: `${incoming.length} klasör, ${countTabs(incoming)} sekme içe aktarılsın mı?`,
          message:
            'Mevcut verilerin silinmez. Aynı klasör iki yerde varsa adı ve konumu daha yeni olandan alınır, ' +
            'sekmeleri birleştirilir.' +
            (skipped > 0 ? `\n${skipped} geçersiz öğe atlanacak.` : ''),
          confirmLabel: 'İçe aktar',
        });
        if (!ok) return;

        const { undo, stats } = await importWorkspaces(parsed.workspaces);
        if (stats.added + stats.updated === 0) {
          showToast('Yedekteki her şey zaten mevcut; değişiklik yapılmadı.');
          return;
        }
        showToast(`İçe aktarıldı: ${stats.added} yeni, ${stats.updated} güncellenen klasör.`, {
          label: 'Geri al',
          run: () => void run('undo-import', () => revertImport(undo)),
        });
      });
    },
    [run, confirm, importWorkspaces, revertImport, showToast],
  );

  const openBackupMenu = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    openBackupMenuAt(rect.right, rect.bottom + 4, [
      { type: 'heading', label: lastBackupAt ? `Son yedek: ${formatAgo(lastBackupAt)}` : 'Henüz yedek alınmadı' },
      { label: 'Yedeği indir (JSON)', onSelect: handleExport },
      { label: 'Yedekten içe aktar…', onSelect: () => fileInputRef.current?.click() },
    ]);
  };

  const handleOpenSavedTab = useCallback(
    (tab: SavedTab) => {
      void run(`open-tab:${tab.id}`, async () => {
        const status = await openTab(tab);
        showToast(status === 'opened' ? 'Sekme arka planda açıldı.' : 'Bu sayfa zaten açık.');
      });
    },
    [run, openTab, showToast],
  );

  const openCurrentFolderTabs = (e: MouseEvent<HTMLButtonElement>) => {
    if (!current) return;
    const subtreeTabs = countTabs(collectSubtree(index, workspaces, current.id));
    if (subtreeTabs === current.tabs.length) {
      handleRestore(current.id, false);
      return;
    }
    if (current.tabs.length === 0) {
      handleRestore(current.id, true);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    openRestoreMenuAt(rect.right - 220, rect.bottom + 4, [
      { label: `Yalnızca bu klasör (${current.tabs.length} sekme)`, onSelect: () => handleRestore(current.id, false) },
      { label: `Alt klasörlerle birlikte (${subtreeTabs} sekme)`, onSelect: () => handleRestore(current.id, true) },
    ]);
  };

  const pendingAction = (id: string) => pendingActions.has(id);
  const isBusy = pendingActions.size > 0;
  const currentSubtreeTabs = current ? countTabs(collectSubtree(index, workspaces, current.id)) : 0;
  const bannerMessage = errorMessage ?? error?.message ?? null;
  const composerParentId = composer?.parentId ?? null;
  const needsBackup =
    Object.keys(workspaces).length > 0 && (lastBackupAt === null || mountedAt - lastBackupAt > BACKUP_REMINDER_MS);

  return (
    <div className="flex h-full flex-col text-gray-900">
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <h1 className="text-base font-semibold">TabFlow</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => setComposer({ mode: 'empty', parentId: currentId })} disabled={isBusy}>
            <PlusIcon />
            {currentId ? 'Yeni alt klasör' : 'Yeni klasör'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowOpenTabs((v) => !v)} aria-pressed={showOpenTabs}>
            Açık sekmeler
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="relative"
            onClick={openBackupMenu}
            title={needsBackup ? 'Uzun süredir yedek almadın' : 'Yedekle / içe aktar'}
          >
            <ArchiveIcon />
            Yedek
            {needsBackup && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500" aria-hidden="true" />
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ''; // Aynı dosya tekrar seçilebilsin
              if (file) handleImportFile(file);
            }}
          />
          {backupMenu}
          <AppearanceMenu />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 border-r border-gray-200 bg-white">
          <FolderTree
            workspaces={workspaces}
            index={index}
            query={query}
            onQueryChange={setQuery}
            selectedId={currentId}
            disabled={isBusy}
            onSelect={navigate}
            onNewFolder={(parentId) => setComposer({ mode: 'empty', parentId })}
            onRename={(id) => handleRename(id, 'tree')}
            onRenameCommit={handleRenameCommit}
            onStyle={handleStyle}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onDropOpenTab={handleDropOpenTab}
            onMoveFolder={handleMoveFolder}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-3 py-1.5 text-sm">
            <nav aria-label="Konum" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => navigate(null)}
                className="shrink-0 rounded px-1.5 py-1 text-gray-600 hover:bg-gray-100"
              >
                Tümü
              </button>
              {breadcrumb.map((w, i) => (
                <span key={w.id} className="flex shrink-0 items-center gap-1">
                  <ChevronDownIcon width={14} height={14} className="-rotate-90 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => navigate(w.id)}
                    className={`max-w-48 truncate rounded px-1.5 py-1 hover:bg-gray-100 ${
                      i === breadcrumb.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-600'
                    }`}
                  >
                    {w.name}
                  </button>
                </span>
              ))}
            </nav>
            {current && (
              <Button
                variant="secondary"
                size="sm"
                onClick={openCurrentFolderTabs}
                disabled={isBusy || currentSubtreeTabs === 0}
                aria-haspopup={currentSubtreeTabs > current.tabs.length && current.tabs.length > 0 ? 'menu' : undefined}
              >
                <ExternalLinkIcon />
                Sekmeleri aç
                {currentSubtreeTabs > current.tabs.length && current.tabs.length > 0 && (
                  <ChevronDownIcon width={12} height={12} className="-mr-0.5 text-gray-500" />
                )}
              </Button>
            )}
            {restoreMenu}
          </div>

          {bannerMessage && (
            <div className="shrink-0 p-3 pb-0">
              <ErrorBanner message={bannerMessage} onDismiss={errorMessage ? clearError : undefined} />
            </div>
          )}

          {composer && (
            <div className="max-w-md shrink-0 p-3 pb-0">
              <FolderComposer
                mode={composer.mode}
                key={composer.mode}
                isBusy={pendingAction(SAVE_ACTION) || pendingAction(CREATE_ACTION)}
                disabled={isBusy}
                parentName={composerParentId !== null ? nameOf(composerParentId) : null}
                onSubmit={handleComposerSubmit}
                onClose={() => setComposer(null)}
              />
            </div>
          )}

          <div className="min-h-0 flex-1">
            {isLoading ? (
              <p className="p-6 text-sm text-gray-500">Yükleniyor…</p>
            ) : (
              <Canvas
                key={currentId ?? '__root__'}
                folderId={currentId}
                workspaces={workspaces}
                index={index}
                moveTargets={recentFolders}
                disabled={isBusy}
                onEnterFolder={navigate}
                onMoveTab={handleMoveTab}
                onMoveFolder={handleMoveFolder}
                onSetTabPosition={handleSetTabPosition}
                onSetFolderPosition={handleSetFolderPosition}
                onOpenTab={handleOpenSavedTab}
                onRemoveTab={handleRemoveTab}
                onRenameFolder={(id) => handleRename(id, 'canvas')}
                onRenameCommit={handleRenameCommit}
                onStyleFolder={handleStyle}
                onDeleteFolder={handleDelete}
                onRestoreFolder={handleRestore}
                onNewSubfolder={(parentId) => setComposer({ mode: 'empty', parentId })}
                onDropOpenTab={handleDropOpenTab}
                onArrange={handleArrange}
              />
            )}
          </div>
        </main>

        {showOpenTabs && (
          <aside className="w-80 shrink-0 border-l border-gray-200 bg-gray-50 p-3">
            <OpenTabsList
              className="h-full"
              query=""
              folders={recentFolders}
              disabled={isBusy}
              onActivate={handleActivate}
              onCloseTab={handleCloseOpenTab}
              onAddToFolder={handleDropOpenTab}
              onSaveAll={() => setComposer({ mode: 'saveAll', parentId: currentId })}
            />
          </aside>
        )}
      </div>

      {stylePicker && workspaces[stylePicker.folderId] && (
        <FolderStylePicker
          folder={workspaces[stylePicker.folderId]}
          x={stylePicker.x}
          y={stylePicker.y}
          onChange={handleStyleChange}
          onClose={() => setStylePicker(null)}
        />
      )}
      {confirmDialog}
      <ThemeDecor />
      <PetalBurst />
      {/* Tuvalin sol altında, dar: sağ alttaki tuval araç çubuğunu ve açık sekmeler panelini kapatmasın. */}
      <Toast className="bottom-3 left-[calc(18rem+0.75rem)] w-fit max-w-sm" />
    </div>
  );
}