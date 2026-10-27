import { describe, expect, it } from 'vitest';
import type { Workspace } from '../types';
import { contextMenuItems, folderIdFromMenuItem, MENU_FOLDER_LIMIT, MENU_ROOT_ID } from './contextMenu';

const folder = (id: string, updatedAt: number, parentId: string | null = null, name = id.toUpperCase()): Workspace => ({
  id,
  name,
  createdAt: 1,
  updatedAt,
  parentId,
  x: 0,
  y: 0,
  tabs: [],
});

describe('sağ tık menüsü', () => {
  it('klasör yoksa yalnızca devre dışı bir ipucu gösterir', () => {
    const items = contextMenuItems({}, null);
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ parentId: MENU_ROOT_ID, enabled: false });
  });

  it('son kullanılanı başa koyar, kalanları yeniden eskiye ve tam yoluyla listeler', () => {
    const map = { a: folder('a', 1), b: folder('b', 3, 'a'), c: folder('c', 2) };
    const titles = contextMenuItems(map, 'c').map((i) => i.title ?? i.type);
    expect(titles.slice(1)).toEqual(['Son kullanılan: C', 'separator', 'A / B', 'A']);
  });

  it('en fazla belirli sayıda klasör listeler ve & işaretini kaçırır', () => {
    const map = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, folder(`f${i}`, i, null, 'Ar&Ge')]));
    const items = contextMenuItems(map, null);
    expect(items).toHaveLength(1 + MENU_FOLDER_LIMIT);
    expect(items[1].title).toBe('Ar&&Ge');
  });

  it('tıklanan öğeden klasör kimliğini çıkarır', () => {
    const [, item] = contextMenuItems({ a: folder('a', 1) }, null);
    expect(folderIdFromMenuItem(item.id)).toBe('a');
    expect(folderIdFromMenuItem('tabflow-last')).toBe('');
    expect(folderIdFromMenuItem(MENU_ROOT_ID)).toBeNull();
  });
});
