import type { PageInfo, Workspace, WorkspaceMap } from '../types';
import { isHttpUrl } from './url';
import { gridPosition, siblingItemCount } from './workspaceTree';
import { toSavedTab } from './workspaceOps';

/**
 * Başka araçlardan içe aktarma: OneTab dışa aktarım metni / düz adres listesi ve Chrome yer imleri.
 * Yalnızca http(s) adresler alınır (gelen veri güvenilmezdir); diğerleri atlanır ve sayılır.
 */

export interface ParsedTabList {
  /** Boş satırla ayrılmış gruplar (OneTab'ın her "sekme grubu"). */
  groups: PageInfo[][];
  /** Adres olmayan ya da http(s) olmayan satırlar. */
  skipped: number;
}

const page = (url: string, title: string): PageInfo => ({ url, title: title || url, favIconUrl: null, pinned: false });

/**
 * OneTab ("adres | başlık") ya da düz adres listesi (her satıra bir adres). Boş satırlar grupları ayırır; aynı
 * gruptaki tekrar eden adres bir kez alınır.
 */
export function parseTabList(text: string): ParsedTabList {
  const groups: PageInfo[][] = [];
  let current: PageInfo[] = [];
  let seen = new Set<string>();
  let skipped = 0;
  const closeGroup = () => {
    if (current.length > 0) groups.push(current);
    current = [];
    seen = new Set();
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') {
      closeGroup();
      continue;
    }
    const sep = line.indexOf(' | ');
    const url = (sep === -1 ? line : line.slice(0, sep)).trim();
    const title = sep === -1 ? '' : line.slice(sep + 3).trim();
    if (!isHttpUrl(url)) {
      skipped++;
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    current.push(page(url, title));
  }
  closeGroup();
  return { groups, skipped };
}

/** Chrome yer imi düğümünün içe aktarmada kullanılan kısmı (chrome.bookmarks.BookmarkTreeNode ile uyumlu). */
export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
}

/** Yer imi klasörü seçici için: klasörler, derinlikleriyle ve içlerindeki (alt klasörler dahil) web adresi sayısıyla. */
export function listBookmarkFolders(roots: BookmarkNode[]): { node: BookmarkNode; depth: number; links: number }[] {
  const out: { node: BookmarkNode; depth: number; links: number }[] = [];
  const countLinks = (node: BookmarkNode): number =>
    (node.children ?? []).reduce((sum, child) => sum + (child.url ? (isHttpUrl(child.url) ? 1 : 0) : countLinks(child)), 0);
  const walk = (node: BookmarkNode, depth: number) => {
    for (const child of node.children ?? []) {
      if (child.url !== undefined) continue;
      out.push({ node: child, depth, links: countLinks(child) });
      walk(child, depth + 1);
    }
  };
  for (const root of roots) walk(root, 0);
  return out;
}

/**
 * İçe aktarılan klasör ağacını haritaya ekler (tek yazma). `root.groups` boşsa yalnızca sekmeler, birden çok grup
 * varsa her grup bir alt klasör olur. Döndürülen kimlik, "Geri al" için kök klasördür.
 */
export interface ImportFolderSpec {
  name: string;
  pages: PageInfo[];
  children: ImportFolderSpec[];
}

export function addImportedTree(
  map: WorkspaceMap,
  spec: ImportFolderSpec,
  parentId: string | null,
  now: number,
): { map: WorkspaceMap; rootId: string; folders: number; tabs: number } {
  const next: WorkspaceMap = { ...map };
  let folders = 0;
  let tabs = 0;
  const add = (node: ImportFolderSpec, parent: string | null, pos: { x: number; y: number }): string => {
    const id = crypto.randomUUID();
    const folder: Workspace = {
      id,
      name: node.name,
      createdAt: now,
      updatedAt: now,
      parentId: parent,
      x: pos.x,
      y: pos.y,
      // Tuvalde önce alt klasörler, ardından sekmeler dizilir.
      tabs: node.pages.map((p, i) => toSavedTab(p, gridPosition(node.children.length + i))),
    };
    next[id] = folder;
    folders++;
    tabs += node.pages.length;
    node.children.forEach((child, i) => add(child, id, gridPosition(i)));
    return id;
  };
  const rootId = add(spec, parentId, gridPosition(siblingItemCount(map, parentId)));
  return { map: next, rootId, folders, tabs };
}

/** Metin listesinden klasör tanımı: tek grupsa düz klasör, birden çoksa her grup bir alt klasör. */
export function specFromTabList(name: string, parsed: ParsedTabList, groupName: (index: number) => string): ImportFolderSpec {
  if (parsed.groups.length === 1) return { name, pages: parsed.groups[0], children: [] };
  return {
    name,
    pages: [],
    children: parsed.groups.map((pages, i) => ({ name: groupName(i + 1), pages, children: [] })),
  };
}

/** Yer imi klasöründen klasör tanımı (alt klasörler korunur; boş alt klasörler atlanır). */
export function specFromBookmarks(node: BookmarkNode, fallbackName: string): { spec: ImportFolderSpec; skipped: number } {
  let skipped = 0;
  const build = (n: BookmarkNode): ImportFolderSpec | null => {
    const pages: PageInfo[] = [];
    const children: ImportFolderSpec[] = [];
    const seen = new Set<string>();
    for (const child of n.children ?? []) {
      if (child.url !== undefined) {
        if (!isHttpUrl(child.url)) skipped++;
        else if (!seen.has(child.url)) {
          seen.add(child.url);
          pages.push(page(child.url, child.title));
        }
      } else {
        const sub = build(child);
        if (sub) children.push(sub);
      }
    }
    if (pages.length === 0 && children.length === 0 && n !== node) return null;
    return { name: n.title.trim() || fallbackName, pages, children };
  };
  return { spec: build(node) ?? { name: fallbackName, pages: [], children: [] }, skipped };
}
