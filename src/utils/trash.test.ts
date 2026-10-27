import { describe, expect, it } from 'vitest';
import type { SavedTab, Workspace } from '../types';
import {
  describeTrashEntry,
  normalizeTrash,
  pruneTrash,
  pushTrash,
  removeTrashEntry,
  TRASH_MAX_ENTRIES,
  TRASH_RETENTION_MS,
  type TrashEntry,
} from './trash';

const tab: SavedTab = { id: 't1', url: 'https://x.com', title: 'X', favIconUrl: null, pinned: false, x: 0, y: 0 };
const folder = (id: string, tabs: SavedTab[] = []): Workspace => ({
  id,
  name: id.toUpperCase(),
  createdAt: 1,
  updatedAt: 1,
  parentId: null,
  x: 0,
  y: 0,
  tabs,
});
const tabEntry = (id: string, deletedAt: number): TrashEntry => ({
  id,
  kind: 'tab',
  deletedAt,
  folderId: 'a',
  folderName: 'A',
  index: 0,
  tab,
});

describe('çöp kutusu', () => {
  it('yeni öğeyi başa ekler', () => {
    const list = pushTrash([tabEntry('eski', 1)], tabEntry('yeni', 2), 3);
    expect(list.map((e) => e.id)).toEqual(['yeni', 'eski']);
  });

  it('süresi dolanları ve sınırı aşanları atar', () => {
    const now = TRASH_RETENTION_MS + 100;
    expect(pruneTrash([tabEntry('a', now), tabEntry('b', 50)], now).map((e) => e.id)).toEqual(['a']);
    const many = Array.from({ length: TRASH_MAX_ENTRIES + 5 }, (_, i) => tabEntry(`e${i}`, now));
    expect(pruneTrash(many, now)).toHaveLength(TRASH_MAX_ENTRIES);
  });

  it('değişiklik yoksa aynı diziyi döndürür (gereksiz yazma olmaz)', () => {
    const list = [tabEntry('a', 10)];
    expect(pruneTrash(list, 20)).toBe(list);
    expect(removeTrashEntry(list, 'yok')).toBe(list);
  });

  it('bozuk depo verisini eler', () => {
    expect(normalizeTrash(null)).toEqual([]);
    expect(normalizeTrash([{ id: 'x' }, tabEntry('ok', 1), { id: 'f', kind: 'folder', deletedAt: 1 }])).toHaveLength(1);
  });

  it('özet metni klasör ve sekmeyi ayırır', () => {
    const entry: TrashEntry = { id: 'f', kind: 'folder', deletedAt: 1, folders: [folder('a', [tab]), folder('b', [tab, tab])] };
    expect(describeTrashEntry(entry)).toEqual({ title: 'A', detail: 'Klasör · 3 sekme · 1 alt klasör' });
    expect(describeTrashEntry(tabEntry('t', 1)).detail).toContain('“A” klasöründen');
  });
});
