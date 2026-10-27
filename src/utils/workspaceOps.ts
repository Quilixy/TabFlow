import type { PageInfo, Point, SavedTab, Workspace, WorkspaceMap } from '../types';
import type { TrashEntry } from './trash';
import { canReparent, compareSiblings, gridPosition, siblingItemCount } from './workspaceTree';

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
