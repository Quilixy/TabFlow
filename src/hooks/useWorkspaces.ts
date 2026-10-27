import { useCallback, useMemo, useState } from 'react';
import { readKey, useStorage } from './useStorage';
import { queryOpenTabs, useTabManager, type OpenTab } from './useTabManager';
import type { PageInfo, Point, SavedTab, Workspace, WorkspaceMap } from '../types';
import { mergeWorkspaces, undoImport, type ImportUndo, type MergeStats } from '../utils/backup';
import { isFolderColor, isFolderIcon } from '../utils/folderStyle';
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

const STORAGE_KEY = 'workspaces';
const EMPTY: WorkspaceMap = {};

const toSavedTab = (page: PageInfo, position: Point): SavedTab => ({
  id: crypto.randomUUID(),
  url: page.url,
  title: page.title,
  favIconUrl: page.favIconUrl,
  pinned: page.pinned,
  x: position.x,
  y: position.y,
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

  /** Klasörü alt klasörleriyle birlikte siler; "Geri al" için silinenleri döndürür. */
  const removeFolder = useCallback(
    async (id: string): Promise<Workspace[]> => {
      let removed: Workspace[] = [];
      await update((current) => {
        removed = collectSubtree(buildChildrenIndex(current), current, id);
        if (removed.length === 0) return current;
        const next = { ...current };
        for (const folder of removed) delete next[folder.id];
        return next;
      });
      return removed;
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

  /** Silinen klasörleri olduğu gibi geri koyar (Geri al). */
  const reinsertFolders = useCallback(
    async (folders: Workspace[]): Promise<void> => {
      await update((current) => {
        const next = { ...current };
        const now = Date.now();
        for (const folder of folders) next[folder.id] = { ...folder, updatedAt: now };
        return next;
      });
    },
    [update],
  );

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
        const target = current[folderId];
        if (!target) throw new Error('Hedef klasör bulunamadı.');
        if (target.tabs.some((t) => t.url === tab.url)) {
          added = false;
          return current;
        }
        const pos = position ?? gridPosition(siblingItemCount(current, folderId));
        return {
          ...current,
          [folderId]: { ...target, updatedAt: Date.now(), tabs: [...target.tabs, toSavedTab(tab, pos)] },
        };
      });
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

  /** Tek bir sekmeyi listeden kaldırır; "Geri al" için silineni döndürür. */
  const removeTab = useCallback(
    async (folderId: string, tabId: string): Promise<{ tab: SavedTab; index: number } | undefined> => {
      let removed: { tab: SavedTab; index: number } | undefined;
      await update((current) => {
        const folder = current[folderId];
        const position = folder ? folder.tabs.findIndex((t) => t.id === tabId) : -1;
        if (!folder || position === -1) return current;
        removed = { tab: folder.tabs[position], index: position };
        return {
          ...current,
          [folderId]: { ...folder, updatedAt: Date.now(), tabs: folder.tabs.filter((t) => t.id !== tabId) },
        };
      });
      return removed;
    },
    [update],
  );

  /** Kaldırılan sekmeyi geri koyar (Geri al). */
  const insertTab = useCallback(
    async (folderId: string, tab: SavedTab, position: number): Promise<void> => {
      await update((current) => {
        const folder = current[folderId];
        if (!folder) return current;
        const tabs = [...folder.tabs];
        tabs.splice(Math.min(position, tabs.length), 0, tab);
        return { ...current, [folderId]: { ...folder, updatedAt: Date.now(), tabs } };
      });
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
  };
}