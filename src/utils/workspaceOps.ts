import type { PageInfo, Point, SavedTab, Workspace, WorkspaceMap } from '../types';
import type { TrashEntry } from './trash';
import { gridPosition, siblingItemCount } from './workspaceTree';

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
