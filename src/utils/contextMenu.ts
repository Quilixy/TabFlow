import type { WorkspaceMap } from '../types';
import { pathLabel } from './workspaceTree';

/** Sağ tık menüsünün kökü ("TabFlow'a kaydet"). */
export const MENU_ROOT_ID = 'tabflow-save';
const LAST_ITEM_ID = 'tabflow-last';
const FOLDER_PREFIX = 'tabflow-folder:';
/** Menüde gösterilecek en fazla klasör (en son güncellenenler). */
export const MENU_FOLDER_LIMIT = 12;
const TITLE_MAX = 60;

export interface MenuItemSpec {
  id: string;
  title?: string;
  parentId?: string;
  type?: 'normal' | 'separator';
  enabled?: boolean;
}

/** Windows'ta "&" kısayol harfi sayılır: çiftlenir. Çok uzun yollar kısaltılır. */
function menuTitle(text: string): string {
  const short = text.length > TITLE_MAX ? `…${text.slice(-(TITLE_MAX - 1))}` : text;
  return short.replace(/&/g, '&&');
}

/** "TabFlow'a kaydet" menüsünün öğeleri: son kullanılan klasör, ardından en son güncellenen klasörler. */
export function contextMenuItems(map: WorkspaceMap, lastFolderId: string | null): MenuItemSpec[] {
  const items: MenuItemSpec[] = [{ id: MENU_ROOT_ID, title: "TabFlow'a kaydet" }];
  const folders = Object.values(map);
  if (folders.length === 0) {
    items.push({ id: 'tabflow-empty', parentId: MENU_ROOT_ID, title: 'Önce bir klasör oluştur', enabled: false });
    return items;
  }

  const last = lastFolderId !== null ? map[lastFolderId] : undefined;
  if (last) {
    items.push(
      { id: LAST_ITEM_ID, parentId: MENU_ROOT_ID, title: menuTitle(`Son kullanılan: ${pathLabel(map, last.id)}`) },
      { id: 'tabflow-sep', parentId: MENU_ROOT_ID, type: 'separator' },
    );
  }
  const recent = folders
    .filter((f) => f.id !== last?.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MENU_FOLDER_LIMIT);
  for (const folder of recent) {
    items.push({ id: FOLDER_PREFIX + folder.id, parentId: MENU_ROOT_ID, title: menuTitle(pathLabel(map, folder.id)) });
  }
  return items;
}

/** Tıklanan öğenin klasör kimliği; '' = "son kullanılan" (tıklama anında çözülür); klasör öğesi değilse null. */
export function folderIdFromMenuItem(menuItemId: string): string | null {
  if (menuItemId === LAST_ITEM_ID) return '';
  return menuItemId.startsWith(FOLDER_PREFIX) ? menuItemId.slice(FOLDER_PREFIX.length) : null;
}
