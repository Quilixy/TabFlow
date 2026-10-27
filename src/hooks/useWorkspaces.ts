import { useCallback, useMemo, useState } from 'react';
import { readKey, updateKey, useStorage } from './useStorage';
import { queryOpenTabs, useTabManager, type OpenTab } from './useTabManager';
import { LAST_FOLDER_KEY, TRASH_KEY, WORKSPACES_KEY } from '../storage/keys';
import { readSnapshots, takeSnapshot } from '../storage/snapshotStore';
import type { PageInfo, Point, SavedTab, Workspace, WorkspaceMap } from '../types';
import { mergeWorkspaces, undoImport, type ImportUndo, type MergeStats } from '../utils/backup';
import { isFolderColor, isFolderIcon } from '../utils/folderStyle';
import type { Snapshot } from '../utils/snapshots';
import { normalizeTrash, pushTrash, removeTrashEntry, type TrashEntry } from '../utils/trash';
import { appendTab, restoreTrashEntry, toSavedTab } from '../utils/workspaceOps';
import {
  buildChildrenIndex,
  canReparent,
  collectSubtree,
  gridPosition,
  normalizeWorkspaces,
  shareStructure,
  siblingItemCount,
  toFolderRefs,
} from '../utils/workspaceTree';

const STORAGE_KEY = WORKSPACES_KEY;
const EMPTY: WorkspaceMap = {};
const NO_TRASH: TrashEntry[] = [];

/** Kısayol ve sağ tık menüsünün "son kullanılan klasör"ü. Yazılamazsa önemsizdir (yalnızca kolaylık). */
const rememberLastFolder = (folderId: string) => {
  chrome.storage.local.set({ [LAST_FOLDER_KEY]: folderId }).catch(() => undefined);
};

const updateTrash = (fn: (entries: TrashEntry[]) => TrashEntry[]) =>
  updateKey<unknown>(TRASH_KEY, NO_TRASH, (raw) => {
    const entries = normalizeTrash(raw);
    const next = fn(entries);
    return next === entries ? raw : next;
  });

const requireName = (rawName: string): string => {
  const name = rawName.trim();
  if (!name) throw new Error('Klasör adı boş olamaz.');
  return name;
};

/** Önceki sonucu hatırlayan normalize: değişmeyen klasör/sekme nesneleri aynı referansla kalır. */
function createSharedNormalizer() {
  let previous: WorkspaceMap | null = null;
  return (raw: unknown): WorkspaceMap => (previous = shareStructure(previous, normalizeWorkspaces(raw)));
}

export interface SaveAndCloseResult {
  folder: Workspace;
  /** Kaydedilemeyen (web sayfası olmayan) ve açık bırakılan sekme sayısı. */
  skipped: number;
  /** Kayıt yapıldı ama sekmeler kapatılamadı. */
  closeFailed: boolean;
}

export function useWorkspaces() {
  const { data, isLoading, update: updateRaw, error } = useStorage<WorkspaceMap>(STORAGE_KEY, EMPTY);
  const { getOpenTabs, closeTabs, openTabs, openSingleTab, activateTab } = useTabManager();
  const { data: rawTrash } = useStorage<unknown>(TRASH_KEY, NO_TRASH);
  const trash = useMemo(() => normalizeTrash(rawTrash), [rawTrash]);

  // Her okumada normalize: eski (v1) veri bile geçerli v2 şekliyle görünür, ilk yazmada kalıcı olur.
  const [normalize] = useState(createSharedNormalizer);
  const workspaces = useMemo(() => normalize(data), [normalize, data]);
  const index = useMemo(() => buildChildrenIndex(workspaces), [workspaces]);
  const folderRefs = useMemo(() => toFolderRefs(workspaces), [workspaces]);

  /** Sekmeleri kapatır; açık kalan olursa (veya kapatma hiç yapılamazsa) true. Kayıt zaten yapıldığı için fırlatmaz. */
  const closeAfterSave = useCallback(
    async (tabIds: number[]): Promise<boolean> => {
      try {
        return (await closeTabs(tabIds)) > 0;
      } catch {
        return true;
      }
    },
    [closeTabs],
  );

  // Güncelleyici haritayı aynen döndürürse ham değer döner: updateKey bunu "değişiklik yok" sayıp yazmaz.
  const update = useCallback(
    (fn: (map: WorkspaceMap) => WorkspaceMap) =>
      updateRaw((current) => {
        const normalized = normalizeWorkspaces(current);
        const next = fn(normalized);
        return next === normalized ? current : next;
      }),
    [updateRaw],
  );

  // ---- Klasörler -------------------------------------------------------------

  const createFolder = useCallback(
    async (rawName: string, parentId: string | null = null, position?: Point): Promise<Workspace> => {
      const name = requireName(rawName);
      const id = crypto.randomUUID();
      const next = await update((current) => {
        if (parentId !== null && !current[parentId]) throw new Error('Üst klasör bulunamadı.');
        const now = Date.now();
        const pos = position ?? gridPosition(siblingItemCount(current, parentId));
        const folder: Workspace = { id, name, createdAt: now, updatedAt: now, parentId, x: pos.x, y: pos.y, tabs: [] };
        return { ...current, [id]: folder };
      });
      return next[id];
    },
    [update],
  );

  /** Yeni klasörü tek bir sekmeyle birlikte TEK yazmada oluşturur (yarıda kalırsa boş klasör kalmaz). */
  const createFolderWithTab = useCallback(
    async (
      rawName: string,
      parentId: string | null,
      tab: OpenTab,
      closeOriginal: boolean,
    ): Promise<{ folder: Workspace; closeFailed: boolean }> => {
      const name = requireName(rawName);
      const id = crypto.randomUUID();
      const next = await update((current) => {
        if (parentId !== null && !current[parentId]) throw new Error('Üst klasör bulunamadı.');
        const now = Date.now();
        const pos = gridPosition(siblingItemCount(current, parentId));
        const folder: Workspace = {
          id,
          name,
          createdAt: now,
          updatedAt: now,
          parentId,
          x: pos.x,
          y: pos.y,
          tabs: [toSavedTab(tab, gridPosition(0))],
        };
        return { ...current, [id]: folder };
      });
      rememberLastFolder(id);
      const closeFailed = closeOriginal ? await closeAfterSave([tab.id]) : false;
      return { folder: next[id], closeFailed };
    },
    [update, closeAfterSave],
  );

  /**
   * Önce kalıcı yaz, SONRA kapat: yazma başarısızsa hiçbir sekme kaybolmaz. Kapatma başarısız olursa hata
   * fırlatılmaz (kayıt zaten yapıldı; yeniden denemek aynı klasörü ikinci kez oluştururdu), closeFailed döner.
   */
  const saveAndClose = useCallback(
    async (rawName: string, includePinned = false, parentId: string | null = null): Promise<SaveAndCloseResult> => {
      const name = requireName(rawName);
      const { tabs: open, skipped } = await getOpenTabs({ includePinned });
      if (open.length === 0) {
        throw new Error(
          includePinned
            ? 'Kaydedilecek sekme bulunamadı.'
            : 'Kaydedilecek sekme bulunamadı (sabitlenmiş sekmeler hariç tutuldu).',
        );
      }

      const id = crypto.randomUUID();
      const next = await update((current) => {
        if (parentId !== null && !current[parentId]) throw new Error('Üst klasör bulunamadı.');
        const now = Date.now();
        const pos = gridPosition(siblingItemCount(current, parentId));
        const folder: Workspace = {
          id,
          name,
          createdAt: now,
          updatedAt: now,
          parentId,
          x: pos.x,
          y: pos.y,
          tabs: open.map((tab, i) => toSavedTab(tab, gridPosition(i))),
        };
        return { ...current, [id]: folder };
      });
      rememberLastFolder(id);
      const closeFailed = await closeAfterSave(open.map((t) => t.id));
      return { folder: next[id], skipped, closeFailed };
    },
    [getOpenTabs, closeAfterSave, update],
  );

  const renameFolder = useCallback(
    async (id: string, rawName: string): Promise<void> => {
      const name = requireName(rawName);
      await update((current) => {
        const target = current[id];
        if (!target) throw new Error('Klasör bulunamadı.');
        return { ...current, [id]: { ...target, name, updatedAt: Date.now() } };
      });
    },
    [update],
  );

  /**
   * Klasörü alt klasörleriyle birlikte çöp kutusuna taşır. Önce silinir (silinenler kesin bilinsin), sonra çöp
   * kutusuna yazılır; o yazma başarısız olursa klasörler geri konur: hiçbir şey sessizce kaybolmaz.
   * "Geri al" için çöp kutusu kaydının kimliğini döndürür.
   */
  const removeFolder = useCallback(
    async (id: string): Promise<{ removed: Workspace[]; trashId: string | null }> => {
      let removed: Workspace[] = [];
      await update((current) => {
        removed = collectSubtree(buildChildrenIndex(current), current, id);
        if (removed.length === 0) return current;
        const next = { ...current };
        for (const folder of removed) delete next[folder.id];
        return next;
      });
      if (removed.length === 0) return { removed, trashId: null };

      const now = Date.now();
      const entry: TrashEntry = { id: crypto.randomUUID(), kind: 'folder', deletedAt: now, folders: removed };
      try {
        await updateTrash((entries) => pushTrash(entries, entry, now));
      } catch (e) {
        await update((current) => restoreTrashEntry(current, entry, Date.now()));
        throw new Error('Klasör çöp kutusuna taşınamadı, silinmedi.', { cause: e });
      }
      return { removed, trashId: entry.id };
    },
    [update],
  );

  /** Klasör rengi/simgesi. null: varsayılana dön. Sıralamayı (updatedAt) etkilemez. */
  const setFolderStyle = useCallback(
    async (id: string, patch: { color?: string | null; icon?: string | null }): Promise<void> => {
      await update((current) => {
        const folder = current[id];
        if (!folder) return current;
        const next = { ...folder };
        if ('color' in patch) {
          if (isFolderColor(patch.color)) next.color = patch.color;
          else delete next.color;
        }
        if ('icon' in patch) {
          if (isFolderIcon(patch.icon)) next.icon = patch.icon;
          else delete next.icon;
        }
        return { ...current, [id]: next };
      });
    },
    [update],
  );

  // ---- Çöp kutusu --------------------------------------------------------------

  /** Çöp kutusundaki öğeyi geri yükler ve listeden kaldırır. Öğe zaten yoksa false. */
  const restoreFromTrash = useCallback(
    async (entryId: string): Promise<boolean> => {
      const entry = normalizeTrash(await readKey<unknown>(TRASH_KEY, NO_TRASH)).find((e) => e.id === entryId);
      if (!entry) return false;
      // Önce geri koy, sonra listeden sil: arada hata olursa öğe çöp kutusunda kalır (geri yükleme tekrarlanabilir).
      await update((current) => restoreTrashEntry(current, entry, Date.now()));
      await updateTrash((entries) => removeTrashEntry(entries, entryId));
      return true;
    },
    [update],
  );

  const deleteFromTrash = useCallback(async (entryId: string): Promise<void> => {
    await updateTrash((entries) => removeTrashEntry(entries, entryId));
  }, []);

  const emptyTrash = useCallback(async (): Promise<void> => {
    await updateTrash((entries) => (entries.length === 0 ? entries : []));
  }, []);

  /**
   * 'unchanged': klasör zaten bu üst klasörün altındaydı. 'repositioned': öyleydi ama konum verildiği için
   * yalnızca tuvaldeki yeri değişti (ör. ağaçtan kendi üst klasörünün tuvaline bırakıldı).
   */
  const moveFolder = useCallback(
    async (
      folderId: string,
      newParentId: string | null,
      position?: Point,
    ): Promise<'moved' | 'unchanged' | 'repositioned'> => {
      let status: 'moved' | 'unchanged' | 'repositioned' = 'moved';
      await update((current) => {
        const folder = current[folderId];
        if (!folder) throw new Error('Klasör bulunamadı.');
        if (newParentId !== null && !current[newParentId]) throw new Error('Hedef klasör bulunamadı.');
        if (!canReparent(current, folderId, newParentId)) {
          throw new Error('Bir klasör kendi alt klasörüne taşınamaz.');
        }
        if (folder.parentId === newParentId) {
          if (!position) {
            status = 'unchanged';
            return current;
          }
          status = 'repositioned';
          return { ...current, [folderId]: { ...folder, x: position.x, y: position.y } };
        }
        const pos = position ?? gridPosition(siblingItemCount(current, newParentId));
        return {
          ...current,
          [folderId]: { ...folder, parentId: newParentId, x: pos.x, y: pos.y, updatedAt: Date.now() },
        };
      });
      return status;
    },
    [update],
  );

  const setFolderPosition = useCallback(
    async (folderId: string, x: number, y: number): Promise<void> => {
      await update((current) => {
        const folder = current[folderId];
        if (!folder) return current;
        return { ...current, [folderId]: { ...folder, x, y } };
      });
    },
    [update],
  );

  /** Bir tuvaldeki öğelerin (alt klasörler + sekmeler) konumlarını toplu günceller (Izgaraya diz). */
  const applyLayout = useCallback(
    async (parentId: string | null, positions: Record<string, Point>): Promise<void> => {
      await update((current) => {
        const next = { ...current };
        for (const child of buildChildrenIndex(current).get(parentId) ?? []) {
          const pos = positions[child.id];
          if (pos) next[child.id] = { ...child, x: Math.round(pos.x), y: Math.round(pos.y) };
        }
        if (parentId !== null) {
          const folder = next[parentId];
          if (!folder) return current;
          next[parentId] = {
            ...folder,
            tabs: folder.tabs.map((tab) => {
              const pos = positions[tab.id];
              return pos ? { ...tab, x: Math.round(pos.x), y: Math.round(pos.y) } : tab;
            }),
          };
        }
        return next;
      });
    },
    [update],
  );

  // ---- Sekmeler --------------------------------------------------------------

  /** Açık bir sekmeyi klasöre ekler; aynı URL zaten varsa eklemez. İsteğe bağlı kapatır. */
  const addOpenTab = useCallback(
    async (
      folderId: string,
      tab: OpenTab,
      closeOriginal = true,
      position?: Point,
    ): Promise<{ added: boolean; closeFailed: boolean }> => {
      let added = true;
      await update((current) => {
        const result = appendTab(current, folderId, tab, Date.now(), position);
        added = result.added;
        return result.map;
      });
      if (added) rememberLastFolder(folderId);
      // Zaten klasörde olan sayfa yeniden eklenmediyse açık sekmeye dokunma: kullanıcı beklenmedik biçimde sekme kaybetmesin.
      const closeFailed = closeOriginal && added ? await closeAfterSave([tab.id]) : false;
      return { added, closeFailed };
    },
    [update, closeAfterSave],
  );

  /**
   * Kayıtlı bir sekmeyi başka klasöre taşır (copy: kopyalar). Aynı URL hedefte zaten varsa HİÇBİR ŞEY yapmaz
   * (kaynaktan silmez) ve 'duplicate' döner: kullanıcıya "taşındı" demek yanıltıcı olurdu.
   */
  const moveTab = useCallback(
    async (
      fromFolderId: string,
      tabId: string,
      toFolderId: string,
      options: { copy?: boolean; position?: Point } = {},
    ): Promise<{ status: 'moved' | 'duplicate' }> => {
      if (fromFolderId === toFolderId) return { status: 'moved' };
      let status: 'moved' | 'duplicate' = 'moved';
      await update((current) => {
        const source = current[fromFolderId];
        const target = current[toFolderId];
        if (!source || !target) throw new Error('Klasör bulunamadı.');
        const tab = source.tabs.find((t) => t.id === tabId);
        if (!tab) throw new Error('Sekme bulunamadı.');

        if (target.tabs.some((t) => t.url === tab.url)) {
          status = 'duplicate';
          return current;
        }

        const now = Date.now();
        const pos = options.position ?? gridPosition(siblingItemCount(current, toFolderId));
        const nextSource = options.copy
          ? source
          : { ...source, updatedAt: now, tabs: source.tabs.filter((t) => t.id !== tabId) };
        const nextTarget = {
          ...target,
          updatedAt: now,
          tabs: [...target.tabs, { ...tab, id: options.copy ? crypto.randomUUID() : tab.id, x: pos.x, y: pos.y }],
        };
        return { ...current, [fromFolderId]: nextSource, [toFolderId]: nextTarget };
      });
      return { status };
    },
    [update],
  );

  const setTabPosition = useCallback(
    async (folderId: string, tabId: string, x: number, y: number): Promise<void> => {
      await update((current) => {
        const folder = current[folderId];
        if (!folder) return current;
        return {
          ...current,
          [folderId]: { ...folder, tabs: folder.tabs.map((t) => (t.id === tabId ? { ...t, x, y } : t)) },
        };
      });
    },
    [update],
  );

  /** Sekmeyi klasörden kaldırıp çöp kutusuna taşır; "Geri al" için çöp kutusu kaydının kimliğini döndürür. */
  const removeTab = useCallback(
    async (folderId: string, tabId: string): Promise<{ trashId: string } | undefined> => {
      let entry: TrashEntry | undefined;
      const now = Date.now();
      await update((current) => {
        const folder = current[folderId];
        const position = folder ? folder.tabs.findIndex((t) => t.id === tabId) : -1;
        if (!folder || position === -1) return current;
        entry = {
          id: crypto.randomUUID(),
          kind: 'tab',
          deletedAt: now,
          folderId,
          folderName: folder.name,
          index: position,
          tab: folder.tabs[position],
        };
        return {
          ...current,
          [folderId]: { ...folder, updatedAt: now, tabs: folder.tabs.filter((t) => t.id !== tabId) },
        };
      });
      const removed = entry as TrashEntry | undefined;
      if (!removed) return undefined;
      try {
        await updateTrash((entries) => pushTrash(entries, removed, now));
      } catch (e) {
        await update((current) => restoreTrashEntry(current, removed, Date.now()));
        throw new Error('Sekme çöp kutusuna taşınamadı, kaldırılmadı.', { cause: e });
      }
      return { trashId: removed.id };
    },
    [update],
  );

  // ---- Yedekleme ---------------------------------------------------------------

  /** Yedeği mevcut veriyle birleştirir (silmez). "Geri al" için dokunulan klasörleri de döndürür. */
  const importWorkspaces = useCallback(
    async (incoming: WorkspaceMap): Promise<{ undo: ImportUndo; stats: MergeStats }> => {
      let undo: ImportUndo = { added: [], changed: [] };
      let stats: MergeStats = { added: 0, updated: 0, unchanged: 0 };
      await update((current) => {
        const merged = mergeWorkspaces(current, incoming);
        undo = merged.undo;
        stats = merged.stats;
        return stats.added + stats.updated > 0 ? merged.map : current;
      });
      return { undo, stats };
    },
    [update],
  );

  /** İçe aktarmayı geri alır; aktarımdan sonra değişen klasörlere dokunmaz. */
  const revertImport = useCallback(
    async (undo: ImportUndo): Promise<void> => {
      await update((current) => undoImport(current, undo));
    },
    [update],
  );

  const listSnapshots = useCallback((): Promise<Snapshot[]> => readSnapshots(), []);

  /**
   * Bir otomatik yedeğe döner (tüm veri yedektekiyle değişir). Dönmeden önce mevcut hal de yedeklenir:
   * yanlış yedeği seçen kullanıcı oradan geri dönebilir.
   */
  const restoreSnapshot = useCallback(
    async (takenAt: number): Promise<Snapshot> => {
      const snapshot = (await readSnapshots()).find((s) => s.takenAt === takenAt);
      if (!snapshot) throw new Error('Yedek bulunamadı.');
      const current = normalizeWorkspaces(await readKey<WorkspaceMap>(STORAGE_KEY, EMPTY));
      await takeSnapshot(current, Date.now(), 'before-restore');
      const restored = normalizeWorkspaces(snapshot.workspaces);
      await update(() => restored);
      return snapshot;
    },
    [update],
  );

  // ---- Tarayıcı eylemleri ----------------------------------------------------

  /**
   * Klasörün (isteğe bağlı alt klasörlerle) sekmelerini açar. Bu pencerede zaten açık URL'leri atlar.
   * activate: ilk yeni sekmeye geç (tam ekran uygulamada genelde false).
   */
  const restoreFolder = useCallback(
    async (
      id: string,
      recursive = false,
      activate = true,
    ): Promise<{ opened: number; skipped: number; deferred: number }> => {
      const current = normalizeWorkspaces(await readKey<WorkspaceMap>(STORAGE_KEY, EMPTY));
      const folder = current[id];
      if (!folder) throw new Error('Klasör bulunamadı (başka bir yerden silinmiş olabilir).');

      const folders = recursive ? collectSubtree(buildChildrenIndex(current), current, id) : [folder];
      const tabs = folders.flatMap((f) => f.tabs);
      if (tabs.length === 0) throw new Error('Açılacak sekme yok.');

      const openByUrl = new Map((await queryOpenTabs({ includePinned: true })).map((t) => [t.url, t.id]));
      const seen = new Set<string>();
      const toOpen: SavedTab[] = [];
      let skipped = 0; // yalnızca zaten açık olanlar (klasörler arasında tekrar eden adres "açık" sayılmaz)
      for (const tab of tabs) {
        if (seen.has(tab.url)) continue; // klasörler arasında tekrar eden URL'yi bir kez aç
        seen.add(tab.url);
        if (openByUrl.has(tab.url)) skipped++;
        else toOpen.push(tab);
      }
      if (toOpen.length === 0) {
        // Hepsi zaten açık: hiçbir şey olmamış gibi görünmesin, ilkine geç.
        const existing = openByUrl.get(tabs[0].url);
        if (activate && existing !== undefined) await activateTab(existing);
        return { opened: 0, skipped, deferred: 0 };
      }

      const { ids, deferred } = await openTabs(toOpen);
      if (activate && ids.length > 0) await activateTab(ids[0]);
      return { opened: ids.length, skipped, deferred };
    },
    [openTabs, activateTab],
  );

  /** Sayfayı arka planda açar; bu pencerede zaten açıksa tekrar açmaz ('already-open'). */
  const openTab = useCallback(
    async (page: PageInfo): Promise<'opened' | 'already-open'> => {
      const open = await queryOpenTabs({ includePinned: true });
      if (open.some((t) => t.url === page.url)) return 'already-open';
      await openSingleTab(page);
      return 'opened';
    },
    [openSingleTab],
  );

  const closeOpenTab = useCallback(
    async (tabId: number): Promise<void> => {
      await closeTabs([tabId]);
    },
    [closeTabs],
  );

  return {
    workspaces,
    index,
    folderRefs,
    isLoading,
    error,
    createFolder,
    createFolderWithTab,
    saveAndClose,
    renameFolder,
    setFolderStyle,
    removeFolder,
    trash,
    restoreFromTrash,
    deleteFromTrash,
    emptyTrash,
    moveFolder,
    setFolderPosition,
    applyLayout,
    addOpenTab,
    moveTab,
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
  };
}