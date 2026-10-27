import { describe, expect, it } from 'vitest';
import type { SavedTab, Workspace, WorkspaceMap } from '../types';
import type { TrashEntry } from './trash';
import { buildChildrenIndex, normalizeWorkspaces } from './workspaceTree';
import {
  addSavedFolder,
  appendTab,
  groupPagesByDomain,
  moveItems,
  removeItems,
  reorderFolder,
  restoreTrashEntry,
  setFolderFavorite,
} from './workspaceOps';

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

describe('klasör sırası ve sabitleme', () => {
  const names = (map: WorkspaceMap, parentId: string | null = null) =>
    (buildChildrenIndex(map).get(parentId) ?? []).map((w) => w.id);
  const base = (): WorkspaceMap => ({ a: folder('a'), b: folder('b'), c: folder('c') });

  it('varsayılan sıra ada göre; sabitlenen en üste çıkar', () => {
    expect(names(base())).toEqual(['a', 'b', 'c']);
    expect(names(setFolderFavorite(base(), 'c', true))).toEqual(['c', 'a', 'b']);
  });

  it('klasörü bir kardeşin önüne/arkasına taşır ve tüm listeyi sıralı yapar', () => {
    const moved = reorderFolder(base(), 'c', 'a', 'before', 5);
    expect(names(moved)).toEqual(['c', 'a', 'b']);
    expect(['a', 'b', 'c'].map((id) => moved[id].order)).toEqual([1, 2, 0]);
    expect(names(reorderFolder(moved, 'c', 'b', 'after', 6))).toEqual(['a', 'b', 'c']);
  });

  it('elle sıralamadan sonra eklenen klasör sıralıların ardına gelir', () => {
    const moved = reorderFolder(base(), 'c', 'a', 'before', 5);
    expect(names({ ...moved, aa: folder('aa') })).toEqual(['c', 'a', 'b', 'aa']);
  });

  it('başka bir üst klasördeki kardeşin yanına bırakılınca oraya taşınır', () => {
    const map: WorkspaceMap = { ...base(), x: folder('x', [], 'a') };
    const moved = reorderFolder(map, 'c', 'x', 'after', 9);
    expect(moved.c.parentId).toBe('a');
    expect(moved.c.updatedAt).toBe(9);
    expect(names(moved, 'a')).toEqual(['x', 'c']);
  });

  it('sabitlenmiş grubun içine bırakılan klasör sabitlenir, dışına bırakılan çözülür', () => {
    const pinned = setFolderFavorite(base(), 'a', true);
    const joined = reorderFolder(pinned, 'c', 'a', 'after', 1);
    expect(joined.c.favorite).toBe(true);
    expect(names(joined)).toEqual(['a', 'c', 'b']);
    const left = reorderFolder(joined, 'a', 'b', 'after', 2);
    expect(left.a.favorite).toBeUndefined();
  });

  it('klasör kendi alt klasörünün yanına taşınamaz', () => {
    const map: WorkspaceMap = { a: folder('a'), x: folder('x', [], 'a') };
    expect(() => reorderFolder(map, 'a', 'x', 'before', 1)).toThrow('kendi alt klasörüne');
  });

  it('sıra ve sabitleme normalize ile korunur', () => {
    const moved = setFolderFavorite(reorderFolder(base(), 'c', 'a', 'before', 5), 'b', true);
    const roundTrip = normalizeWorkspaces(JSON.parse(JSON.stringify(moved)));
    expect(names(roundTrip)).toEqual(['b', 'c', 'a']);
  });
});

describe('toplu işlemler', () => {
  const sample = (): WorkspaceMap => ({
    src: folder('src', [tab('t1', 'https://1.com'), tab('t2', 'https://2.com'), tab('t3', 'https://3.com')]),
    dst: folder('dst', [tab('d1', 'https://2.com')]),
    sub: folder('sub', [], 'src'),
    deep: folder('deep', [], 'sub'),
  });

  it('seçili sekmeleri ve klasörleri tek seferde taşır; hedefte olan URL atlanır', () => {
    const r = moveItems(sample(), 'src', ['t1', 't2'], ['sub'], 'dst', false, 7);
    expect(r).toMatchObject({ movedTabs: 1, duplicateTabs: 1, movedFolders: 1, skippedFolders: 0 });
    expect(r.map.dst.tabs.map((t) => t.url)).toEqual(['https://2.com', 'https://1.com']);
    expect(r.map.src.tabs.map((t) => t.id)).toEqual(['t2', 't3']);
    expect(r.map.sub.parentId).toBe('dst');
  });

  it('kopyalarken kaynağa dokunmaz ve yeni kimlik verir', () => {
    const r = moveItems(sample(), 'src', ['t1'], [], 'dst', true, 7);
    expect(r.map.src.tabs).toHaveLength(3);
    const copied = r.map.dst.tabs.find((t) => t.url === 'https://1.com');
    expect(copied?.id).not.toBe('t1');
  });

  it('klasörü kendi alt klasörüne taşımaz; hiçbir şey değişmezse haritayı aynen döndürür', () => {
    const start = sample();
    const r = moveItems(start, null, [], ['src'], 'deep', false, 7);
    expect(r.skippedFolders).toBe(1);
    expect(r.map).toBe(start);
  });

  it('seçilenleri kaldırır; iç içe seçilen klasör tek kayıt olur', () => {
    const { map, entries } = removeItems(sample(), 'src', ['t1', 't3'], ['sub', 'deep'], 9);
    expect(map.sub).toBeUndefined();
    expect(map.deep).toBeUndefined();
    expect(map.src.tabs.map((t) => t.id)).toEqual(['t2']);
    expect(entries.map((e) => e.kind)).toEqual(['folder', 'tab', 'tab']);
  });

  it('kaldırılanlar kayıtlarından eski sırasıyla geri gelir', () => {
    const start = sample();
    const { map, entries } = removeItems(start, 'src', ['t1', 't3'], ['sub'], 9);
    const restored = entries.reduce((m, e) => restoreTrashEntry(m, e, 10), map);
    expect(restored.src.tabs.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(restored.deep.parentId).toBe('sub');
  });
});

describe('siteye göre gruplama', () => {
  const page = (url: string) => ({ url, title: url, favIconUrl: null, pinned: false });
  const pages = [
    page('https://www.github.com/a'),
    page('https://github.com/b'),
    page('https://youtube.com/1'),
    page('https://youtube.com/2'),
    page('https://youtube.com/3'),
    page('https://tek.com/x'),
  ];

  it('en az iki sekmeli siteleri büyükten küçüğe ayırır, kalanı ana klasörde bırakır (www yok sayılır)', () => {
    const { groups, rest } = groupPagesByDomain(pages);
    expect(groups.map((g) => [g.host, g.pages.length])).toEqual([
      ['youtube.com', 3],
      ['github.com', 2],
    ]);
    expect(rest.map((p) => p.url)).toEqual(['https://tek.com/x']);
  });

  it('hepsi tek sitedense ayırmaz', () => {
    const same = [page('https://a.com/1'), page('https://a.com/2')];
    expect(groupPagesByDomain(same)).toEqual({ groups: [], rest: same });
  });

  it('klasörü ve site alt klasörlerini tek seferde ekler', () => {
    const { map, subfolders } = addSavedFolder({}, { id: 'root', name: 'Oturum', parentId: null, pages, groupByDomain: true, now: 5 });
    expect(subfolders).toBe(2);
    expect(map.root.tabs.map((t) => t.url)).toEqual(['https://tek.com/x']);
    const children = Object.values(map).filter((w) => w.parentId === 'root');
    expect(children.map((c) => [c.name, c.tabs.length]).sort()).toEqual([
      ['github.com', 2],
      ['youtube.com', 3],
    ]);
  });

  it('gruplama kapalıyken hepsi ana klasörde', () => {
    const { map, subfolders } = addSavedFolder({}, { id: 'root', name: 'Oturum', parentId: null, pages, groupByDomain: false, now: 5 });
    expect(subfolders).toBe(0);
    expect(map.root.tabs).toHaveLength(6);
  });
});
