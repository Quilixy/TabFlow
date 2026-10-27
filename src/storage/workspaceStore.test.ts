import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workspace, WorkspaceMap } from '../types';
import {
  applyWorkspaceChanges,
  FOLDER_INDEX_KEY,
  folderKey,
  readWorkspaceMap,
  revertWorkspaceChanges,
  updateWorkspaces,
} from './workspaceStore';

// Bellek içi chrome.storage.local taklidi; her set/remove çağrısı kaydedilir.
let store: Record<string, unknown>;
let setCalls: Record<string, unknown>[];
let removeCalls: string[][];

beforeEach(() => {
  store = {};
  setCalls = [];
  removeCalls = [];
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
        },
        set: async (items: Record<string, unknown>) => {
          setCalls.push(items);
          Object.assign(store, structuredClone(items));
        },
        remove: async (keys: string[]) => {
          removeCalls.push(keys);
          for (const k of keys) delete store[k];
        },
      },
    },
  });
});

const folder = (id: string, name = id.toUpperCase()): Workspace => ({
  id,
  name,
  createdAt: 1,
  updatedAt: 1,
  parentId: null,
  x: 0,
  y: 0,
  tabs: [],
});

describe('klasör deposu', () => {
  it('eski tek anahtardaki veriyi ilk yazmada klasör başına anahtarlara taşır', async () => {
    store.workspaces = { a: folder('a'), b: folder('b') };
    expect(Object.keys(await readWorkspaceMap()).sort()).toEqual(['a', 'b']);

    await updateWorkspaces((map) => map);
    expect(store.workspaces).toBeUndefined();
    expect(store[FOLDER_INDEX_KEY]).toEqual(['a', 'b']);
    expect((store[folderKey('a')] as Workspace).name).toBe('A');
  });

  it('yalnızca değişen klasörü yazar', async () => {
    store.workspaces = { a: folder('a'), b: folder('b') };
    await updateWorkspaces((map) => map);
    setCalls = [];

    await updateWorkspaces((map) => ({ ...map, b: { ...map.b, name: 'Yeni' } }));
    expect(setCalls).toHaveLength(1);
    expect(Object.keys(setCalls[0])).toEqual([folderKey('b')]);
  });

  it('değişiklik yoksa hiç yazmaz', async () => {
    store.workspaces = { a: folder('a') };
    await updateWorkspaces((map) => map);
    setCalls = [];
    await updateWorkspaces((map) => map);
    expect(setCalls).toHaveLength(0);
  });

  it('eklenen ve silinen klasörlerde dizini günceller, silineni kaldırır', async () => {
    store.workspaces = { a: folder('a'), b: folder('b') };
    await updateWorkspaces((map) => map);

    await updateWorkspaces((map) => {
      const next: WorkspaceMap = { ...map, c: folder('c') };
      delete next.a;
      return next;
    });
    expect(store[FOLDER_INDEX_KEY]).toEqual(['b', 'c']);
    expect(store[folderKey('a')]).toBeUndefined();
    expect(Object.keys(await readWorkspaceMap()).sort()).toEqual(['b', 'c']);
  });

  it('eş zamanlı güncellemeler birbirini ezmez', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        updateWorkspaces((map) => ({ ...map, [`f${i}`]: folder(`f${i}`) })),
      ),
    );
    expect(Object.keys(await readWorkspaceMap())).toHaveLength(10);
  });

  it('eski anahtara sonradan yazılan harita her şeyin yerini alır', async () => {
    store.workspaces = { a: folder('a') };
    await updateWorkspaces((map) => map);
    store.workspaces = { z: folder('z') };
    await updateWorkspaces((map) => map);
    expect(Object.keys(await readWorkspaceMap())).toEqual(['z']);
    expect(store[folderKey('a')]).toBeUndefined();
  });
});

describe('değişiklik olayları', () => {
  const raw = { a: folder('a'), b: folder('b') };

  it('yalnızca değişen klasörü yamar; ilgisiz olayda null', () => {
    const next = applyWorkspaceChanges(raw, { [folderKey('b')]: { newValue: folder('b', 'Yeni') } });
    expect((next?.b as Workspace).name).toBe('Yeni');
    expect(next?.a).toBe(raw.a);
    expect(applyWorkspaceChanges(raw, { theme: { newValue: 'dark' } })).toBeNull();
  });

  it('silinen klasörü ve dizin dışında kalanları atar', () => {
    const next = applyWorkspaceChanges(raw, {
      [folderKey('a')]: { oldValue: raw.a },
      [FOLDER_INDEX_KEY]: { newValue: ['b'] },
    });
    expect(Object.keys(next ?? {})).toEqual(['b']);
  });

  it('değişiklikten önceki hali geri kurar', () => {
    const after = { b: folder('b', 'Yeni'), c: folder('c') };
    const before = revertWorkspaceChanges(after, {
      [folderKey('a')]: { oldValue: raw.a },
      [folderKey('b')]: { oldValue: raw.b, newValue: after.b },
      [folderKey('c')]: { newValue: after.c },
      [FOLDER_INDEX_KEY]: { oldValue: ['a', 'b'], newValue: ['b', 'c'] },
    });
    expect(before).toEqual(raw);
  });

  it('taşımada önceki hal eski anahtarın değeridir', () => {
    expect(revertWorkspaceChanges({}, { workspaces: { oldValue: raw } })).toEqual(raw);
  });
});
