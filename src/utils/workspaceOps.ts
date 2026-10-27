import type { PageInfo, Point, SavedTab, Workspace, WorkspaceMap } from '../types';
import type { TrashEntry } from './trash';
import {
  buildChildrenIndex,
  canReparent,
  collectSubtree,
  compareSiblings,
  gridPosition,
  siblingItemCount,
} from './workspaceTree';

/**
 * Klasör haritası üzerinde saf işlemler. Hem React kancası (useWorkspaces) hem service worker (sağ tık menüsü,
 * kısayol) aynı mantığı kullanır. Girdi haritası normalize edilmiş olmalı.
 */

export const toSavedTab = (page: PageInfo, position: Point): SavedTab => ({
  id: crypto.randomUUID(),
  url: page.url,
  title: page.title,
  favIconUrl: page.favIconUrl,
  pinned: page.pinned,
  x: position.x,
  y: position.y,
});

/** Sayfayı klasöre ekler; aynı URL zaten varsa haritayı aynen döndürür (added: false). */
export function appendTab(
  map: WorkspaceMap,
  folderId: string,
  page: PageInfo,
  now: number,
  position?: Point,
): { map: WorkspaceMap; added: boolean } {
  const target = map[folderId];
  if (!target) throw new Error('Hedef klasör bulunamadı.');
  if (target.tabs.some((t) => t.url === page.url)) return { map, added: false };
  const pos = position ?? gridPosition(siblingItemCount(map, folderId));
  return {
    map: { ...map, [folderId]: { ...target, updatedAt: now, tabs: [...target.tabs, toSavedTab(page, pos)] } },
    added: true,
  };
}

/**
 * Çöp kutusundaki öğeyi haritaya geri koyar. Tekrar çağrılması zararsızdır: zaten var olan klasörlere ve
 * klasörde zaten bulunan URL'ye dokunmaz. Sekmenin klasörü artık yoksa aynı adla kökte yeniden oluşturulur.
 */
export function restoreTrashEntry(map: WorkspaceMap, entry: TrashEntry, now: number): WorkspaceMap {
  if (entry.kind === 'folder') {
    const next = { ...map };
    let changed = false;
    for (const folder of entry.folders) {
      if (next[folder.id]) continue;
      next[folder.id] = { ...folder, updatedAt: now };
      changed = true;
    }
    return changed ? next : map;
  }

  const folder: Workspace = map[entry.folderId] ?? {
    id: entry.folderId,
    name: entry.folderName,
    createdAt: now,
    updatedAt: now,
    parentId: null,
    ...gridPosition(siblingItemCount(map, null)),
    tabs: [],
  };
  if (folder.tabs.some((t) => t.url === entry.tab.url)) return map;
  const tabs = [...folder.tabs];
  const tab = tabs.some((t) => t.id === entry.tab.id) ? { ...entry.tab, id: crypto.randomUUID() } : entry.tab;
  tabs.splice(Math.min(entry.index, tabs.length), 0, tab);
  return { ...map, [folder.id]: { ...folder, updatedAt: now, tabs } };
}

export type DropPlacement = 'before' | 'after';

/**
 * Klasörü bir kardeşinin önüne/arkasına taşır (gerekirse onun üst klasörüne geçer). Yeni kardeş listesindeki
 * herkes 0, 1, 2… sırasını alır: elle sıralama bir kez yapılınca tüm liste kalıcı sıralı olur.
 * Taşıma döngü yaratacaksa hata verir.
 */
export function reorderFolder(
  map: WorkspaceMap,
  folderId: string,
  targetId: string,
  placement: DropPlacement,
  now: number,
): WorkspaceMap {
  const folder = map[folderId];
  const target = map[targetId];
  if (!folder || !target) throw new Error('Klasör bulunamadı.');
  if (folderId === targetId) return map;
  const parentId = target.parentId;
  if (!canReparent(map, folderId, parentId)) throw new Error('Bir klasör kendi alt klasörüne taşınamaz.');
  // Sabitlenmiş ve sabitlenmemiş klasörler ayrı gruplarda durur: hedefin grubuna katılır.
  const favorite = Boolean(target.favorite);

  const siblings = Object.values(map)
    .filter((w) => w.parentId === parentId && w.id !== folderId && Boolean(w.favorite) === favorite)
    .sort(compareSiblings);
  const at = siblings.findIndex((w) => w.id === targetId) + (placement === 'after' ? 1 : 0);
  const moved: Workspace = { ...folder, favorite: favorite || undefined };
  if (!moved.favorite) delete moved.favorite;
  if (folder.parentId !== parentId) {
    const pos = gridPosition(siblingItemCount(map, parentId));
    Object.assign(moved, { parentId, x: pos.x, y: pos.y, updatedAt: now });
  }
  siblings.splice(at, 0, moved);

  const next = { ...map };
  siblings.forEach((w, i) => {
    if (w.order !== i || w === moved) next[w.id] = { ...w, order: i };
  });
  return next;
}

/** Klasörü sabitler ya da sabitlemeyi kaldırır (sıralamayı etkiler, updatedAt'i değil). */
export function setFolderFavorite(map: WorkspaceMap, folderId: string, favorite: boolean): WorkspaceMap {
  const folder = map[folderId];
  if (!folder || Boolean(folder.favorite) === favorite) return map;
  const next: Workspace = { ...folder };
  if (favorite) next.favorite = true;
  else delete next.favorite;
  return { ...map, [folderId]: next };
}

export interface MoveItemsResult {
  map: WorkspaceMap;
  movedTabs: number;
  movedFolders: number;
  /** Hedefte aynı URL zaten olduğu için taşınmayan sekmeler. */
  duplicateTabs: number;
  /** Döngü yaratacağı ya da zaten orada olduğu için taşınmayan klasörler. */
  skippedFolders: number;
}

/**
 * Seçili sekmeleri (fromFolderId klasöründen) ve klasörleri tek yazmada `toFolderId` altına taşır.
 * copy: sekmeler kopyalanır (klasörler her zaman taşınır). Sekmeler köke taşınamaz.
 */
export function moveItems(
  map: WorkspaceMap,
  fromFolderId: string | null,
  tabIds: string[],
  folderIds: string[],
  toFolderId: string | null,
  copy: boolean,
  now: number,
): MoveItemsResult {
  const next = { ...map };
  let movedTabs = 0;
  let movedFolders = 0;
  let duplicateTabs = 0;
  let skippedFolders = 0;

  for (const id of folderIds) {
    const folder = next[id];
    if (!folder || folder.parentId === toFolderId || !canReparent(next, id, toFolderId)) {
      skippedFolders++;
      continue;
    }
    const pos = gridPosition(siblingItemCount(next, toFolderId));
    next[id] = { ...folder, parentId: toFolderId, x: pos.x, y: pos.y, updatedAt: now };
    movedFolders++;
  }

  const source = fromFolderId !== null ? next[fromFolderId] : undefined;
  const target = toFolderId !== null ? next[toFolderId] : undefined;
  if (tabIds.length > 0 && source && target && source.id !== target.id) {
    const moving = new Set(tabIds);
    const targetTabs = [...target.tabs];
    const urls = new Set(targetTabs.map((t) => t.url));
    const moved = new Set<string>();
    for (const tab of source.tabs) {
      if (!moving.has(tab.id)) continue;
      if (urls.has(tab.url)) {
        duplicateTabs++;
        continue;
      }
      urls.add(tab.url);
      const pos = gridPosition(siblingItemCount(next, target.id) + moved.size);
      targetTabs.push({ ...tab, id: copy ? crypto.randomUUID() : tab.id, x: pos.x, y: pos.y });
      moved.add(tab.id);
    }
    movedTabs = moved.size;
    if (movedTabs > 0) {
      next[target.id] = { ...target, updatedAt: now, tabs: targetTabs };
      if (!copy) next[source.id] = { ...source, updatedAt: now, tabs: source.tabs.filter((t) => !moved.has(t.id)) };
    }
  }

  const changed = movedTabs + movedFolders > 0;
  return { map: changed ? next : map, movedTabs, movedFolders, duplicateTabs, skippedFolders };
}

/**
 * Seçili sekmeleri ve klasörleri (alt klasörleriyle) tek yazmada kaldırır; çöp kutusu kayıtlarını döndürür.
 * Başka bir seçili klasörün içinde kalan klasör ayrıca kaydedilmez (üstüyle birlikte gider).
 */
export function removeItems(
  map: WorkspaceMap,
  parentFolderId: string | null,
  tabIds: string[],
  folderIds: string[],
  now: number,
): { map: WorkspaceMap; entries: TrashEntry[] } {
  const next = { ...map };
  const entries: TrashEntry[] = [];
  const index = buildChildrenIndex(map);
  const removed = new Set<string>();

  for (const id of folderIds) {
    if (removed.has(id) || !map[id]) continue;
    const subtree = collectSubtree(index, map, id);
    for (const folder of subtree) {
      removed.add(folder.id);
      delete next[folder.id];
    }
    entries.push({ id: crypto.randomUUID(), kind: 'folder', deletedAt: now, folders: subtree });
  }

  const parent = parentFolderId !== null ? next[parentFolderId] : undefined;
  if (parent && tabIds.length > 0) {
    const removing = new Set(tabIds);
    parent.tabs.forEach((tab, index) => {
      if (!removing.has(tab.id)) return;
      entries.push({
        id: crypto.randomUUID(),
        kind: 'tab',
        deletedAt: now,
        folderId: parent.id,
        folderName: parent.name,
        index,
        tab,
      });
    });
    const kept = parent.tabs.filter((t) => !removing.has(t.id));
    if (kept.length !== parent.tabs.length) next[parent.id] = { ...parent, updatedAt: now, tabs: kept };
  }

  return { map: entries.length > 0 ? next : map, entries };
}
