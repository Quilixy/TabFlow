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
import { TrashPanel } from '../components/TrashPanel';
import { ArchiveIcon, ChevronDownIcon, ExternalLinkIcon, PlusIcon, TrashIcon } from '../components/ui/icons';
import { restoreEntries } from '../components/ui/menu';
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
import { formatAgo, formatDateTime, formatSaveAllMessage } from '../utils/format';
import { formatRestoreResult, type RestoreMode } from '../utils/restore';
import type { Snapshot } from '../utils/snapshots';
import { AUTO_EXPORT_INTERVALS, normalizeAutoExport, type AutoExportInterval } from '../utils/autoExport';
import { AUTO_EXPORT_KEY } from '../storage/keys';
import { useStorage } from '../hooks/useStorage';
import type { DropPlacement } from '../utils/workspaceOps';
import { LEAVE_ANIMATION_MS } from '../utils/theme';
import { NAVIGATE_KEY, parseNavigateRequest } from '../utils/uiSync';
import { canReparent, collectSubtree, countTabs, getPath, pathLabel } from '../utils/workspaceTree';
import { t } from '../i18n';

const SAVE_ACTION = '__save__';
const CREATE_ACTION = '__create__';
/** Bu sayıdan fazla sekme tek hamlede açılacaksa kullanıcıdan onay istenir. */
const RESTORE_CONFIRM_THRESHOLD = 25;

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
    trash,
    restoreFromTrash,
    restoreManyFromTrash,
    deleteFromTrash,
    emptyTrash,
    moveFolder,
    reorderFolder,
    setFavorite,
    setFolderPosition,
    applyLayout,
    addOpenTab,
    moveTab,
    moveItems,
    removeItems,
    setTabPosition,
    removeTab,
    importWorkspaces,
    revertImport,
    listSnapshots,
    restoreSnapshot,
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
  const [showTrash, setShowTrash] = useState(false);
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

  // Popup, yan panel ya da adres çubuğu "şu klasörü göster" dediyse oraya git (uygulama yeni açıldıysa da,
  // zaten açıksa da). İstek tek seferliktir: okunup silinir.
  const revealRef = useRef<string | null>(null);
  useEffect(() => {
    const handle = (raw: unknown) => {
      const id = parseNavigateRequest(raw);
      if (!id) return;
      void chrome.storage.local.remove(NAVIGATE_KEY).catch(() => undefined);
      revealRef.current = id;
      setSelectedFolder(id);
    };
    chrome.storage.local.get(NAVIGATE_KEY).then((items) => handle(items[NAVIGATE_KEY]), () => undefined);
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[NAVIGATE_KEY]?.newValue) handle(changes[NAVIGATE_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [setSelectedFolder]);

  // Veri yüklenince gidilen klasörün üst dallarını aç (ağaçta görünsün).
  useEffect(() => {
    const id = revealRef.current;
    if (id === null || !workspaces[id]) return;
    revealRef.current = null;
    expandMany(getPath(workspaces, id).map((w) => w.id));
  }, [workspaces, selectedFolderId, expandMany]);

  const nameOf = useCallback((id: string) => workspaces[id]?.name ?? t('common.folderFallback'), [workspaces]);

  // ---- Klasör oluşturma ----------------------------------------------------------
  const handleComposerSubmit = useCallback(
    (name: string, includePinned: boolean, groupByDomain: boolean) => {
      if (!composer) return Promise.resolve(false);
      if (composer.mode === 'saveAll') {
        return run(SAVE_ACTION, async () => {
          const { folder: created, saved, subfolders, skipped, closeFailed } = await saveAndClose(name, includePinned, composer.parentId, groupByDomain);
          markEntering([created.id]);
          emitFolderBurst(created.id);
          showToast(formatSaveAllMessage(saved, created.name, skipped, closeFailed, subfolders));
        });
      }
      return run(CREATE_ACTION, async () => {
        const created = await createFolder(name, composer.parentId);
        markEntering([created.id]);
        emitFolderBurst(created.id);
        showToast(t('app.folderCreated', { name: created.name }));
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
        showToast(t('app.selectFolderFirst'));
        return;
      }
      void run(`drop:${folderId}:${tab.id}`, async () => {
        // Bırakılan veri başka bir sayfadan gelmiş olabilir: sekmeyi tarayıcıdan yeniden oku.
        const real = await resolveOpenTabById(tab.id);
        if (!real) throw new Error(t('error.droppedTab'));
        const { added, closeFailed } = await addOpenTab(folderId, real, closeOriginal, position);
        if (added) emitFolderBurst(folderId);
        showToast(
          !added
            ? t('app.alreadyInFolder', { folder: nameOf(folderId) })
            : closeFailed
              ? t('app.addedNotClosed', { folder: nameOf(folderId) })
              : t(closeOriginal ? 'app.tabMovedTo' : 'app.tabCopiedTo', { folder: nameOf(folderId) }),
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
          showToast(t(copy ? 'app.duplicateNotCopied' : 'app.duplicateNotMoved', { folder: nameOf(toFolderId) }));
          return;
        }
        emitFolderBurst(toFolderId);
        showToast(t(copy ? 'app.tabCopiedTo' : 'app.tabMovedTo', { folder: nameOf(toFolderId) }));
      });
    },
    [run, moveTab, showToast, nameOf],
  );

  const handleMoveFolder = useCallback(
    (folderId: string, newParentId: string | null, position?: Point) => {
      if (folderId === newParentId) return;
      if (!canReparent(workspaces, folderId, newParentId)) {
        showToast(t('error.cycle'));
        return;
      }
      void run(`move-folder:${folderId}`, async () => {
        const status = await moveFolder(folderId, newParentId, position);
        if (status !== 'moved') return; // aynı yerde kaldı ya da yalnızca tuvaldeki konumu değişti
        showToast(
          newParentId === null
            ? t('app.folderMovedRoot', { name: nameOf(folderId) })
            : t('app.folderMovedInto', { name: nameOf(folderId), parent: nameOf(newParentId) }),
        );
        if (newParentId !== null) expandMany([newParentId]);
      });
    },
    [workspaces, run, moveFolder, showToast, nameOf, expandMany],
  );

  const handleReorderFolder = useCallback(
    (folderId: string, targetId: string, placement: DropPlacement) => {
      void run(`reorder:${folderId}`, () => reorderFolder(folderId, targetId, placement));
    },
    [run, reorderFolder],
  );

  const handleToggleFavorite = useCallback(
    (id: string) => {
      const folder = workspaces[id];
      if (!folder) return;
      void run(`favorite:${id}`, async () => {
        await setFavorite(id, !folder.favorite);
        showToast(t(folder.favorite ? 'app.unpinned' : 'app.pinned', { name: folder.name }));
      });
    },
    [workspaces, run, setFavorite, showToast],
  );

  // ---- Tuvalde çoklu seçim: toplu taşıma, silme ve konum ------------------------------
  const handleMoveItems = useCallback(
    (tabIds: string[], folderIds: string[], toFolderId: string | null, copy: boolean) => {
      void run('move-items', async () => {
        const r = await moveItems(currentId, tabIds, folderIds, toFolderId, copy);
        const moved = r.movedTabs + r.movedFolders;
        const notes: string[] = [];
        if (r.duplicateTabs > 0) notes.push(t('app.bulk.duplicates', { n: r.duplicateTabs }));
        if (r.skippedFolders > 0) notes.push(t('app.bulk.skippedFolders', { n: r.skippedFolders }));
        const noteText = notes.length > 0 ? ` (${notes.join(', ')})` : '';
        const copied = copy && r.movedFolders === 0;
        showToast(
          moved === 0
            ? t('app.bulk.nothing', { notes: noteText })
            : toFolderId === null
              ? t('app.bulk.movedRoot', { n: moved, notes: noteText })
              : t(copied ? 'app.bulk.copiedTo' : 'app.bulk.movedTo', { n: moved, folder: nameOf(toFolderId), notes: noteText }),
        );
        if (moved > 0 && toFolderId !== null) emitFolderBurst(toFolderId);
      });
    },
    [run, moveItems, currentId, nameOf, showToast],
  );

  const handleDeleteItems = useCallback(
    (tabIds: string[], folderIds: string[]) => {
      void run('delete-items', async () => {
        const trashIds = await removeItems(currentId, tabIds, folderIds);
        if (trashIds.length === 0) return;
        if (folderIds.some((id) => getPath(workspaces, currentId).some((w) => w.id === id))) setSelectedFolder(null);
        showToast(t('app.bulk.trashed', { n: tabIds.length + folderIds.length }), {
          label: t('common.undo'),
          run: () => void run('undo-delete-items', () => restoreManyFromTrash(trashIds)),
        });
      });
    },
    [run, removeItems, restoreManyFromTrash, currentId, workspaces, setSelectedFolder, showToast],
  );

  const handleSetPositions = useCallback(
    (positions: Record<string, Point>) => runQuiet(() => applyLayout(currentId, positions)),
    [runQuiet, applyLayout, currentId],
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
        showToast(t('app.arranged'), {
          label: t('common.undo'),
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
      // Onay sorulmaz: silinen her şey çöp kutusuna gider ve oradan geri yüklenebilir.
      void run(`delete:${id}`, async () => {
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
        const { removed: folders, trashId } = removed;
        if (folders.length === 0 || trashId === null) return;
        if (isInside) setSelectedFolder(folder.parentId);
        const extra = folders.length - 1;
        showToast(extra > 0 ? t('app.folderTrashedWithSub', { name: folder.name, n: extra }) : t('app.folderTrashed', { name: folder.name }), {
          label: t('common.undo'),
          run: () =>
            void run(`undo-delete:${id}`, async () => {
              await restoreFromTrash(trashId);
              markEntering(folders.map((w) => w.id));
            }),
        });
      });
    },
    [
      workspaces,
      currentId,
      run,
      removeFolder,
      restoreFromTrash,
      setSelectedFolder,
      showToast,
      animation,
      setLeaving,
      markEntering,
    ],
  );

  const handleRestore = useCallback(
    (id: string, recursive: boolean, mode: RestoreMode = 'tabs') => {
      const folder = workspaces[id];
      if (!folder) return;
      const folders = recursive ? collectSubtree(index, workspaces, id) : [folder];
      const total = countTabs(folders);

      void run(`restore:${id}`, async () => {
        if (total > RESTORE_CONFIRM_THRESHOLD) {
          const ok = await confirm({
            title: t('restoreConfirm.title', { n: total }),
            message:
              mode === 'window'
                ? t('restoreConfirm.window')
                : t('restoreConfirm.tabs'),
            confirmLabel: t('restoreConfirm.action'),
          });
          if (!ok) return;
        }
        // 'tabs' modunda tam ekran uygulamadan ayrılma; grup ve pencere ise doğrudan gösterilir.
        const result = await restoreFolder(id, recursive, mode !== 'tabs', mode);
        showToast(formatRestoreResult(result, folder.name));
      });
    },
    [workspaces, index, run, confirm, restoreFolder, showToast],
  );

  const handleRemoveTab = useCallback(
    (folderId: string, tabId: string) => {
      void run(`remove-tab:${tabId}`, async () => {
        const removed = await removeTab(folderId, tabId);
        if (!removed) return;
        showToast(t('app.tabTrashed'), {
          label: t('common.undo'),
          run: () => void run(`undo-remove-tab:${tabId}`, () => restoreFromTrash(removed.trashId)),
        });
      });
    },
    [run, removeTab, restoreFromTrash, showToast],
  );

  // ---- Çöp kutusu ------------------------------------------------------------------
  const handleTrashRestore = useCallback(
    (entryId: string) => {
      void run(`trash-restore:${entryId}`, async () => {
        const restored = await restoreFromTrash(entryId);
        showToast(restored ? t('app.restored') : t('app.notInTrash'));
      });
    },
    [run, restoreFromTrash, showToast],
  );

  const handleTrashDelete = useCallback(
    (entryId: string) => {
      void run(`trash-delete:${entryId}`, () => deleteFromTrash(entryId));
    },
    [run, deleteFromTrash],
  );

  const handleTrashEmpty = useCallback(() => {
    void run('trash-empty', async () => {
      await emptyTrash();
      showToast(t('app.trashEmptied'));
    });
  }, [run, emptyTrash, showToast]);

  // ---- Yedekleme -------------------------------------------------------------------
  const handleExport = useCallback(() => {
    void run('export', async () => {
      const count = Object.keys(workspaces).length;
      if (count === 0) throw new Error(t('app.nothingToBackup'));
      downloadTextFile(backupFileName(), serializeBackup(createBackup(workspaces)));
      setLastBackupAt(Date.now());
      showToast(t('app.backedUp', { n: count }));
    });
  }, [workspaces, run, setLastBackupAt, showToast]);

  const handleImportFile = useCallback(
    (file: File) => {
      void run('import', async () => {
        if (file.size > MAX_BACKUP_BYTES) throw new Error(t('app.fileTooLarge'));
        const parsed = parseBackup(await file.text());
        const incoming = Object.values(parsed.workspaces);
        const skipped = parsed.skippedFolders + parsed.skippedTabs;
        const ok = await confirm({
          title: t('app.import.title', { folders: incoming.length, tabs: countTabs(incoming) }),
          message:
            t('app.import.message') + (skipped > 0 ? `\n${t('app.import.skipped', { n: skipped })}` : ''),
          confirmLabel: t('app.import.action'),
        });
        if (!ok) return;

        const { undo, stats } = await importWorkspaces(parsed.workspaces);
        if (stats.added + stats.updated === 0) {
          showToast(t('app.import.nothing'));
          return;
        }
        showToast(t('app.import.done', { added: stats.added, updated: stats.updated }), {
          label: t('common.undo'),
          run: () => void run('undo-import', () => revertImport(undo)),
        });
      });
    },
    [run, confirm, importWorkspaces, revertImport, showToast],
  );

  // ---- Diske otomatik yedek ayarı (service worker uygular) ----------------------------
  const { data: rawAutoExport } = useStorage<unknown>(AUTO_EXPORT_KEY, null);
  const autoExport = normalizeAutoExport(rawAutoExport);
  const handleAutoExportInterval = useCallback(
    (interval: AutoExportInterval) => {
      void run('auto-export', async () => {
        const current = normalizeAutoExport((await chrome.storage.local.get(AUTO_EXPORT_KEY))[AUTO_EXPORT_KEY]);
        await chrome.storage.local.set({ [AUTO_EXPORT_KEY]: { ...current, interval } });
        showToast(t('autoExport.changed', { interval: t(`autoExport.${interval}`) }));
      });
    },
    [run, showToast],
  );

  const handleRestoreSnapshot = useCallback(
    (snapshot: Snapshot) => {
      void run('restore-snapshot', async () => {
        const ok = await confirm({
          title: t('app.snapshot.title', { date: formatDateTime(snapshot.takenAt) }),
          message:
            t('app.snapshot.message', { folders: snapshot.folderCount, tabs: snapshot.tabCount }),
          confirmLabel: t('app.snapshot.action'),
          danger: true,
        });
        if (!ok) return;
        await restoreSnapshot(snapshot.takenAt);
        setSelectedFolder(null);
        showToast(t('app.snapshot.done', { date: formatDateTime(snapshot.takenAt) }));
      });
    },
    [run, confirm, restoreSnapshot, setSelectedFolder, showToast],
  );

  const openBackupMenu = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const show = (snapshots: Snapshot[]) =>
      openBackupMenuAt(rect.right, rect.bottom + 4, [
        { type: 'heading', label: lastBackupAt ? t('backupMenu.last', { ago: formatAgo(lastBackupAt) }) : t('backupMenu.never') },
        { label: t('backupMenu.download'), onSelect: handleExport },
        { label: t('backupMenu.import'), onSelect: () => fileInputRef.current?.click() },
        { type: 'separator' },
        { type: 'heading', label: t('backupMenu.autoHeading') },
        ...(snapshots.length === 0
          ? [{ label: t('backupMenu.autoNone'), onSelect: () => undefined, disabled: true }]
          : snapshots.map((s) => ({
              label:
                t('backupMenu.autoItem', { date: formatDateTime(s.takenAt), folders: s.folderCount, tabs: s.tabCount }) +
                (s.reason === 'before-restore' ? t('backupMenu.beforeRestore') : ''),
              onSelect: () => handleRestoreSnapshot(s),
              disabled: isBusy,
            }))),
        { type: 'separator' },
        { type: 'heading', label: t('autoExport.heading') },
        ...AUTO_EXPORT_INTERVALS.map((interval) => ({
          // Seçili aralık onay işaretiyle (menü bileşeninin seçim durumu yok).
          label: `${autoExport.interval === interval ? '✓' : ' '} ${t(`autoExport.${interval}`)}`,
          onSelect: () => handleAutoExportInterval(interval),
        })),
        {
          type: 'heading',
          label: autoExport.lastAt ? t('autoExport.last', { ago: formatAgo(autoExport.lastAt) }) : t('autoExport.never'),
        },
      ]);
    // Liste okunamazsa menü yine açılsın (yalnızca otomatik yedekler eksik kalır).
    listSnapshots().then(show, () => show([]));
  };

  const handleOpenSavedTab = useCallback(
    (tab: SavedTab) => {
      void run(`open-tab:${tab.id}`, async () => {
        const status = await openTab(tab);
        showToast(status === 'opened' ? t('tab.openedBackground') : t('tab.alreadyOpen'));
      });
    },
    [run, openTab, showToast],
  );

  const openCurrentFolderTabs = (e: MouseEvent<HTMLButtonElement>) => {
    if (!current) return;
    const subtreeTabs = countTabs(collectSubtree(index, workspaces, current.id));
    const rect = e.currentTarget.getBoundingClientRect();
    openRestoreMenuAt(
      rect.right - 230,
      rect.bottom + 4,
      restoreEntries(current.tabs.length, subtreeTabs, isBusy, (recursive, mode) =>
        handleRestore(current.id, recursive, mode),
      ),
    );
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
            {currentId ? t('app.newSubfolder') : t('app.newFolder')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowOpenTabs((v) => !v)} aria-pressed={showOpenTabs}>
            {t('app.openTabs')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="relative"
            onClick={openBackupMenu}
            title={needsBackup ? t('app.backupStale') : t('app.backupTitle')}
          >
            <ArchiveIcon />
            {t('app.backup')}
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTrash(true)}
            title={t('trash.buttonTitle')}
            aria-label={t('trash.buttonLabel', { n: trash.length })}
          >
            <TrashIcon />
            {trash.length > 0 && <span className="tabular-nums">{trash.length}</span>}
          </Button>
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
            onReorderFolder={handleReorderFolder}
            onToggleFavorite={handleToggleFavorite}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-3 py-1.5 text-sm">
            <nav aria-label={t('app.breadcrumb')} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => navigate(null)}
                className="shrink-0 rounded px-1.5 py-1 text-gray-600 hover:bg-gray-100"
              >
                {t('common.all')}
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
                aria-haspopup="menu"
              >
                <ExternalLinkIcon />
                {t('app.openFolderTabs')}
                <ChevronDownIcon width={12} height={12} className="-mr-0.5 text-gray-500" />
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
              <p className="p-6 text-sm text-gray-500">{t('common.loading')}</p>
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
                onToggleFavorite={handleToggleFavorite}
                onRestoreFolder={handleRestore}
                onNewSubfolder={(parentId) => setComposer({ mode: 'empty', parentId })}
                onDropOpenTab={handleDropOpenTab}
                onArrange={handleArrange}
                onMoveItems={handleMoveItems}
                onDeleteItems={handleDeleteItems}
                onSetPositions={handleSetPositions}
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
      {showTrash && (
        <TrashPanel
          entries={trash}
          busy={isBusy}
          onRestore={handleTrashRestore}
          onDelete={handleTrashDelete}
          onEmpty={handleTrashEmpty}
          onClose={() => setShowTrash(false)}
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