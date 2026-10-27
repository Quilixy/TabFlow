import { describe, expect, it } from 'vitest';
import type { SavedTab, Workspace, WorkspaceMap } from '../types';
import type { TrashEntry } from './trash';
import { appendTab, restoreTrashEntry } from './workspaceOps';

const tab = (id: string, url: string): SavedTab => ({ id, url, title: url, favIconUrl: null, pinned: false, x: 0, y: 0 });
const folder = (id: string, tabs: SavedTab[] = [], parentId: string | null = null): Workspace => ({
  id,
  name: id.toUpperCase(),
  createdAt: 1,
  updatedAt: 1,
  parentId,
  x: 0,
  y: 0,
  tabs,
});
const page = { url: 'https://yeni.com', title: 'Yeni', favIconUrl: null, pinned: false };

describe('appendTab', () => {
  it('sekmeyi ekler ve klasörü günceller', () => {
    const { map, added } = appendTab({ a: folder('a') }, 'a', page, 99);
    expect(added).toBe(true);
    expect(map.a.tabs.map((t) => t.url)).toEqual(['https://yeni.com']);
    expect(map.a.updatedAt).toBe(99);
  });

  it('aynı URL varsa haritayı aynen döndürür', () => {
    const start: WorkspaceMap = { a: folder('a', [tab('t', 'https://yeni.com')]) };
    const result = appendTab(start, 'a', page, 99);
    expect(result.added).toBe(false);
    expect(result.map).toBe(start);
  });

  it('klasör yoksa anlaşılır hata verir', () => {
    expect(() => appendTab({}, 'yok', page, 1)).toThrow('Hedef klasör bulunamadı');
  });
});

describe('restoreTrashEntry', () => {
  const folderEntry: TrashEntry = { id: 'e', kind: 'folder', deletedAt: 1, folders: [folder('a'), folder('b', [], 'a')] };
  const tabEntry: TrashEntry = {
    id: 'e2',
    kind: 'tab',
    deletedAt: 1,
    folderId: 'a',
    folderName: 'A',
    index: 0,
    tab: tab('t', 'https://x.com'),
  };

  it('klasörleri alt klasörleriyle geri koyar; tekrar çağrılması zararsızdır', () => {
    const once = restoreTrashEntry({}, folderEntry, 5);
    expect(Object.keys(once).sort()).toEqual(['a', 'b']);
    expect(once.b.parentId).toBe('a');
    expect(restoreTrashEntry(once, folderEntry, 6)).toBe(once);
  });

  it('sekmeyi eski sırasına koyar; klasör yoksa aynı adla yeniden oluşturur', () => {
    const intoExisting = restoreTrashEntry({ a: folder('a', [tab('u', 'https://y.com')]) }, tabEntry, 5);
    expect(intoExisting.a.tabs.map((t) => t.url)).toEqual(['https://x.com', 'https://y.com']);
    const recreated = restoreTrashEntry({}, tabEntry, 5);
    expect(recreated.a.name).toBe('A');
    expect(recreated.a.tabs).toHaveLength(1);
    expect(restoreTrashEntry(recreated, tabEntry, 6)).toBe(recreated);
  });
});
