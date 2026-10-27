import { describe, expect, it } from 'vitest';
import type { WorkspaceMap } from '../types';
import {
  addSnapshot,
  makeSnapshot,
  normalizeSnapshots,
  shouldSnapshot,
  SNAPSHOT_INTERVAL_MS,
  SNAPSHOT_KEEP,
  type Snapshot,
} from './snapshots';

const map: WorkspaceMap = { a: { id: 'a', name: 'A', createdAt: 1, updatedAt: 1, parentId: null, x: 0, y: 0, tabs: [] } };

describe('otomatik yedekler', () => {
  it('ilk seferde ve süre dolunca yedek alınır', () => {
    expect(shouldSnapshot(null, 1000)).toBe(true);
    expect(shouldSnapshot({ lastAt: 1000 }, 1000 + SNAPSHOT_INTERVAL_MS - 1)).toBe(false);
    expect(shouldSnapshot({ lastAt: 1000 }, 1000 + SNAPSHOT_INTERVAL_MS)).toBe(true);
  });

  it('saat geri alınmışsa (gelecekteki kayıt) yeniden yedek alınır', () => {
    expect(shouldSnapshot({ lastAt: 5000 }, 1000)).toBe(true);
  });

  it('en fazla belirli sayıda yedek tutar, yeniden eskiye', () => {
    let list: Snapshot[] = [];
    for (let i = 0; i < SNAPSHOT_KEEP + 3; i++) list = addSnapshot(list, makeSnapshot(map, i));
    expect(list).toHaveLength(SNAPSHOT_KEEP);
    expect(list[0].takenAt).toBe(SNAPSHOT_KEEP + 2);
  });

  it('özet sayılarını hesaplar ve bozuk veriyi eler', () => {
    expect(makeSnapshot(map, 1)).toMatchObject({ folderCount: 1, tabCount: 0, reason: 'auto' });
    expect(normalizeSnapshots([{ takenAt: 1 }, makeSnapshot(map, 2), null])).toHaveLength(1);
  });
});
