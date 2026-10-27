import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceMap } from '../types';
import { SNAPSHOT_INTERVAL_MS } from '../utils/snapshots';
import { readSnapshots, takeSnapshot, takeSnapshotIfDue } from './snapshotStore';

// Bellek içi chrome.storage.local taklidi.
let store: Record<string, unknown>;

beforeEach(() => {
  store = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: structuredClone(store[key]) }),
        set: async (items: Record<string, unknown>) => {
          await Promise.resolve();
          Object.assign(store, structuredClone(items));
        },
      },
    },
  });
});

const map: WorkspaceMap = { a: { id: 'a', name: 'A', createdAt: 1, updatedAt: 1, parentId: null, x: 0, y: 0, tabs: [] } };

describe('otomatik yedek deposu', () => {
  it('aynı anda gelen iki tetikleme tek yedek alır', async () => {
    const results = await Promise.all([takeSnapshotIfDue(map, 1000), takeSnapshotIfDue(map, 1001)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await readSnapshots()).toHaveLength(1);
  });

  it('süre dolmadan yeni yedek almaz, dolunca alır', async () => {
    await takeSnapshotIfDue(map, 1000);
    expect(await takeSnapshotIfDue(map, 2000)).toBe(false);
    expect(await takeSnapshotIfDue(map, 1000 + SNAPSHOT_INTERVAL_MS)).toBe(true);
    expect(await readSnapshots()).toHaveLength(2);
  });

  it('boş haritanın yedeğini almaz', async () => {
    expect(await takeSnapshotIfDue({}, 1000)).toBe(false);
    expect(store.snapshots).toBeUndefined();
  });

  it('dönüşten önceki yedek süreye bakmadan alınır', async () => {
    await takeSnapshot(map, 1000, 'auto');
    expect(await takeSnapshot(map, 1001, 'before-restore')).toBe(true);
    expect((await readSnapshots()).map((s) => s.reason)).toEqual(['before-restore', 'auto']);
  });
});
