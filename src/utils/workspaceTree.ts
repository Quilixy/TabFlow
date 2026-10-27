import type { FolderRef, Point, SavedTab, Workspace, WorkspaceMap } from '../types';
import { isFolderColor, isFolderIcon } from './folderStyle';
import { workspaceMatches } from './search';
import { isHttpUrl } from './url';

/** Tuvaldaki bir hücre: klasör ve sekme kartları bu ızgaraya sığar. */
export const CELL_W = 272;
export const CELL_H = 176;
export const GRID_COLS = 4;
const GRID_PAD = 32;

const collator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });

const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function gridPosition(index: number, cols = GRID_COLS): Point {
  return {
    x: GRID_PAD + (index % cols) * CELL_W,
    y: GRID_PAD + Math.floor(index / cols) * CELL_H,
  };
}

type RawTab = Partial<SavedTab>;
type RawWorkspace = Partial<Omit<Workspace, 'tabs'>> & { tabs?: RawTab[] };

/**
 * Depodan okunan ham veriyi (v1 veya v2) her zaman geçerli v2 şekline getirir.
 * Deterministiktir: aynı girdi aynı çıktıyı verir; eksik alanlar ızgara düzeniyle doldurulur.
 * İlk yazmada normalize edilmiş hali kalıcı olur, ayrı bir "migration" adımı gerekmez.
 */
export function normalizeWorkspaces(raw: unknown): WorkspaceMap {
  if (!raw || typeof raw !== 'object') return {};

  const entries = Object.entries(raw as Record<string, RawWorkspace>)
    .filter(([, ws]) => ws && typeof ws === 'object')
    .sort(([, a], [, b]) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  const known = new Set(entries.map(([id]) => id));
  const siblingCount = new Map<string | null, number>();
  const result: WorkspaceMap = {};

  for (const [id, ws] of entries) {
    const parentId =
      typeof ws.parentId === 'string' && ws.parentId !== id && known.has(ws.parentId) ? ws.parentId : null;
    const slot = siblingCount.get(parentId) ?? 0;
    siblingCount.set(parentId, slot + 1);
    const pos = gridPosition(slot);
    const createdAt = isNum(ws.createdAt) ? ws.createdAt : 0;

    const tabs: SavedTab[] = (Array.isArray(ws.tabs) ? ws.tabs : []).map((tab, i) => {
      const tabPos = gridPosition(i);
      const url = String(tab.url ?? '');
      return {
        id: typeof tab.id === 'string' ? tab.id : `${id}:${i}`,
        url,
        title: String(tab.title ?? url),
        // data: (base64) simgeler haritayı şişirir; gösterimde zaten /_favicon/ önbelleği tercih edilir.
        favIconUrl: isHttpUrl(tab.favIconUrl) ? tab.favIconUrl : null,
        pinned: Boolean(tab.pinned),
        x: isNum(tab.x) ? tab.x : tabPos.x,
        y: isNum(tab.y) ? tab.y : tabPos.y,
      };
    });

    const style: Pick<Workspace, 'color' | 'icon' | 'order' | 'favorite'> = {};
    if (isFolderColor(ws.color)) style.color = ws.color;
    if (isFolderIcon(ws.icon)) style.icon = ws.icon;
    if (isNum(ws.order)) style.order = ws.order;
    if (ws.favorite === true) style.favorite = true;

    result[id] = {
      ...style,
      id,
      name: typeof ws.name === 'string' && ws.name.trim() ? ws.name : 'Adsız klasör',
      createdAt,
      updatedAt: isNum(ws.updatedAt) ? ws.updatedAt : createdAt,
      parentId,
      x: isNum(ws.x) ? ws.x : pos.x,
      y: isNum(ws.y) ? ws.y : pos.y,
      tabs,
    };
  }

  // Bozuk veride oluşabilecek üst-alt döngülerini kır. Yalnızca döngünün kendisindeki bir klasör köke alınır;
  // döngüye bağlanan (ama içinde olmayan) bir klasörün üst bağı korunur.
  for (const id of Object.keys(result)) {
    const seen = new Set<string>([id]);
    let current = result[id].parentId;
    while (current !== null) {
      if (current === id) {
        result[id] = { ...result[id], parentId: null };
        break;
      }
      if (seen.has(current)) break;
      seen.add(current);
      current = result[current]?.parentId ?? null;
    }
  }

  return result;
}

const sameTab = (a: SavedTab, b: SavedTab): boolean =>
  a.id === b.id &&
  a.url === b.url &&
  a.title === b.title &&
  a.favIconUrl === b.favIconUrl &&
  a.pinned === b.pinned &&
  a.x === b.x &&
  a.y === b.y;

const sameFolderFields = (a: Workspace, b: Workspace): boolean =>
  a.id === b.id &&
  a.name === b.name &&
  a.createdAt === b.createdAt &&
  a.updatedAt === b.updatedAt &&
  a.parentId === b.parentId &&
  a.x === b.x &&
  a.y === b.y &&
  a.color === b.color &&
  a.icon === b.icon &&
  a.order === b.order &&
  a.favorite === b.favorite;

/**
 * `next` haritasında, `prev` ile alan alan aynı kalan klasör ve sekme nesnelerini `prev`dekilerle değiştirir.
 * Her depolama yazması tüm haritayı yeni nesnelerle getirdiğinden, bu olmadan memo'lu kartların hepsi yeniden çizilirdi.
 * Hiçbir şey değişmediyse `prev`in kendisi döner.
 */
export function shareStructure(prev: WorkspaceMap | null, next: WorkspaceMap): WorkspaceMap {
  if (!prev) return next;
  const result: WorkspaceMap = {};
  let allSame = Object.keys(prev).length === Object.keys(next).length;

  for (const [id, folder] of Object.entries(next)) {
    const old = prev[id];
    if (!old) {
      result[id] = folder;
      allSame = false;
      continue;
    }
    let tabsSame = old.tabs.length === folder.tabs.length;
    const tabs = folder.tabs.map((tab, i) => {
      const oldTab = old.tabs[i];
      if (oldTab && sameTab(oldTab, tab)) return oldTab;
      tabsSame = false;
      return tab;
    });
    if (tabsSame && sameFolderFields(old, folder)) {
      result[id] = old;
    } else {
      result[id] = tabsSame ? { ...folder, tabs: old.tabs } : { ...folder, tabs };
      allSame = false;
    }
  }
  return allSame ? prev : result;
}

/**
 * Kardeş klasörlerin sırası: sabitlenenler en üstte; sonra elle sıralananlar (order); sıra verilmemişler
 * (ör. elle sıralamadan sonra eklenen yeni klasör) onların ardından ada göre.
 */
export function compareSiblings(a: Workspace, b: Workspace): number {
  if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
  const aHas = a.order !== undefined;
  const bHas = b.order !== undefined;
  if (aHas && bHas && a.order !== b.order) return (a.order as number) - (b.order as number);
  if (aHas !== bHas) return aHas ? -1 : 1;
  return collator.compare(a.name, b.name);
}

/** parentId → sıralı çocuk klasörler (bkz. compareSiblings). Kök için anahtar null. */
export function buildChildrenIndex(map: WorkspaceMap): Map<string | null, Workspace[]> {
  const index = new Map<string | null, Workspace[]>();
  for (const workspace of Object.values(map)) {
    const list = index.get(workspace.parentId);
    if (list) list.push(workspace);
    else index.set(workspace.parentId, [workspace]);
  }
  for (const list of index.values()) list.sort(compareSiblings);
  return index;
}

/** Kökten klasöre giden yol (klasör dahil). */
export function getPath(map: WorkspaceMap, id: string | null): Workspace[] {
  const path: Workspace[] = [];
  const seen = new Set<string>();
  let current = id;
  while (current !== null && map[current] && !seen.has(current)) {
    seen.add(current);
    path.unshift(map[current]);
    current = map[current].parentId;
  }
  return path;
}

export const pathLabel = (map: WorkspaceMap, id: string): string =>
  getPath(map, id)
    .map((w) => w.name)
    .join(' / ');

/** Klasör + tüm alt klasörleri (derinlik öncelikli, klasör önce). */
export function collectSubtree(
  index: Map<string | null, Workspace[]>,
  map: WorkspaceMap,
  id: string,
): Workspace[] {
  const out: Workspace[] = [];
  const seen = new Set<string>();
  const walk = (current: string) => {
    if (seen.has(current) || !map[current]) return;
    seen.add(current);
    out.push(map[current]);
    for (const child of index.get(current) ?? []) walk(child.id);
  };
  walk(id);
  return out;
}

export const countTabs = (workspaces: Workspace[]): number =>
  workspaces.reduce((sum, w) => sum + w.tabs.length, 0);

/** folderId'yi newParentId altına taşımak döngü yaratır mı? */
export function canReparent(map: WorkspaceMap, folderId: string, newParentId: string | null): boolean {
  if (newParentId === null) return true;
  if (folderId === newParentId) return false;
  const seen = new Set<string>();
  let current: string | null = newParentId;
  while (current !== null) {
    if (current === folderId || seen.has(current)) return false;
    seen.add(current);
    current = map[current]?.parentId ?? null;
  }
  return true;
}

/** Bir klasörün tuvalindeki öğe sayısı (çocuk klasörler + sekmeler). Yeni öğe için ızgara indeksi. */
export function siblingItemCount(map: WorkspaceMap, parentId: string | null): number {
  let count = 0;
  for (const workspace of Object.values(map)) if (workspace.parentId === parentId) count++;
  return count + (parentId !== null ? (map[parentId]?.tabs.length ?? 0) : 0);
}

export function toFolderRefs(map: WorkspaceMap): FolderRef[] {
  return Object.values(map)
    .map((w) => ({ id: w.id, name: pathLabel(map, w.id) }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** Arama varken görünmesi gereken klasörler: eşleşenler + üstleri. Arama yoksa null. */
export function computeVisibleIds(map: WorkspaceMap, query: string): Set<string> | null {
  if (query === '') return null;
  const visible = new Set<string>();
  for (const workspace of Object.values(map)) {
    if (!workspaceMatches(workspace, query)) continue;
    let current: string | null = workspace.id;
    while (current !== null && !visible.has(current)) {
      visible.add(current);
      current = map[current]?.parentId ?? null;
    }
  }
  return visible;
}

export interface TreeRow {
  workspace: Workspace;
  depth: number;
  hasChildren: boolean;
  isOpen: boolean;
}

/** Ağacı, sanallaştırmaya uygun düz bir satır listesine çevirir. */
export function flattenTree(
  index: Map<string | null, Workspace[]>,
  expanded: Record<string, boolean>,
  visibleIds: Set<string> | null,
  forceOpen: boolean,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const seen = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    for (const workspace of index.get(parentId) ?? []) {
      if (visibleIds && !visibleIds.has(workspace.id)) continue;
      if (seen.has(workspace.id)) continue;
      seen.add(workspace.id);
      const children = (index.get(workspace.id) ?? []).filter((c) => !visibleIds || visibleIds.has(c.id));
      const isOpen = children.length > 0 && (forceOpen || expanded[workspace.id] === true);
      rows.push({ workspace, depth, hasChildren: children.length > 0, isOpen });
      if (isOpen) walk(workspace.id, depth + 1);
    }
  };

  walk(null, 0);
  return rows;
}

// ---- Klasör kartı önizlemesi (iç içe) ----------------------------------------

export type PreviewRow =
  | { kind: 'tab'; key: string; depth: number; tab: SavedTab }
  | { kind: 'folder'; key: string; depth: number; folder: Workspace }
  | { kind: 'more'; key: string; depth: number; count: number };

export interface PreviewOptions {
  /** Kartta gösterilecek en fazla satır ("+N daha" satırı dahil). */
  maxRows: number;
  /** Kartın kendi sekmelerinden gösterilecek en fazla sayı. */
  maxTabs: number;
  /** Alt klasörlerin sekmelerinden gösterilecek en fazla sayı. */
  maxTabsNested: number;
  /** Kaç klasör düzeyinin sekmeleri açılır (1: yalnızca kartın kendisi, alt klasörler yalnızca ad olarak). */
  maxDepth: number;
}

/** Yalnızca kartın sekmeleri ve alt klasör adları. */
export const PREVIEW_SHALLOW: PreviewOptions = { maxRows: 4, maxTabs: 3, maxTabsNested: 0, maxDepth: 1 };
/** Alt klasörlerin (ve onların alt klasörlerinin) içeriği de görünür. */
export const PREVIEW_DEEP: PreviewOptions = { maxRows: 9, maxTabs: 3, maxTabsNested: 2, maxDepth: 3 };

/** Bir klasörün alt ağacındaki toplam öğe: sekmeler + alt klasörler (klasörün kendisi hariç). */
export function countSubtreeItems(index: Map<string | null, Workspace[]>, map: WorkspaceMap, id: string): number {
  const seen = new Set<string>();
  let count = 0;
  const walk = (current: string) => {
    const folder = map[current];
    if (!folder || seen.has(current)) return;
    seen.add(current);
    count += folder.tabs.length;
    for (const child of index.get(current) ?? []) {
      count += 1;
      walk(child.id);
    }
  };
  walk(id);
  return count;
}

/**
 * Klasör kartı için iç içe önizleme satırları: kartın sekmeleri, sonra her alt klasör (adı) ve girintili
 * olarak onun sekmeleri/alt klasörleri. Sığmayan kısım için son satır "+N daha" olur.
 */
export function buildFolderPreview(
  index: Map<string | null, Workspace[]>,
  map: WorkspaceMap,
  folderId: string,
  options: PreviewOptions,
): PreviewRow[] {
  const total = countSubtreeItems(index, map, folderId);

  const collect = (cap: number) => {
    const rows: PreviewRow[] = [];
    let shown = 0;
    const seen = new Set<string>();

    const walk = (id: string, level: number) => {
      const folder = map[id];
      if (!folder || seen.has(id)) return;
      seen.add(id);

      const limit = level === 0 ? options.maxTabs : options.maxTabsNested;
      for (const tab of folder.tabs.slice(0, limit)) {
        if (rows.length >= cap) return;
        rows.push({ kind: 'tab', key: `t:${tab.id}`, depth: level, tab });
        shown++;
      }
      for (const child of index.get(id) ?? []) {
        if (rows.length >= cap) return;
        rows.push({ kind: 'folder', key: `f:${child.id}`, depth: level, folder: child });
        shown++;
        if (level + 1 < options.maxDepth) walk(child.id, level + 1);
      }
    };

    walk(folderId, 0);
    return { rows, shown };
  };

  const full = collect(options.maxRows);
  if (full.shown >= total) return full.rows;

  // Her şey sığmadı: son satırı "+N daha" için ayır.
  const capped = collect(Math.max(1, options.maxRows - 1));
  return [...capped.rows, { kind: 'more', key: 'more', depth: 0, count: total - capped.shown }];
}
