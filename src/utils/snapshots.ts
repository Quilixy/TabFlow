import type { WorkspaceMap } from '../types';

/** Otomatik yedekler arasında en az bu kadar süre olur (günde bir). */
export const SNAPSHOT_INTERVAL_MS = 20 * 60 * 60 * 1000;
/** En fazla bu kadar otomatik yedek tutulur. */
export const SNAPSHOT_KEEP = 7;

export interface Snapshot {
  takenAt: number;
  /** "auto": günlük; "before-restore": bir yedeğe dönmeden hemen önceki hal. */
  reason: 'auto' | 'before-restore';
  folderCount: number;
  tabCount: number;
  workspaces: WorkspaceMap;
}

export interface SnapshotMeta {
  lastAt: number;
}

export function shouldSnapshot(meta: SnapshotMeta | null, now: number): boolean {
  return meta === null || now - meta.lastAt >= SNAPSHOT_INTERVAL_MS || meta.lastAt > now;
}

export function makeSnapshot(workspaces: WorkspaceMap, now: number, reason: Snapshot['reason'] = 'auto'): Snapshot {
  const folders = Object.values(workspaces);
  return {
    takenAt: now,
    reason,
    folderCount: folders.length,
    tabCount: folders.reduce((sum, f) => sum + (Array.isArray(f.tabs) ? f.tabs.length : 0), 0),
    workspaces,
  };
}

/** Yeni yedeği başa ekler, en fazla `keep` tane tutar. */
export function addSnapshot(list: Snapshot[], snapshot: Snapshot, keep = SNAPSHOT_KEEP): Snapshot[] {
  return [snapshot, ...list].slice(0, keep);
}

export function normalizeSnapshots(raw: unknown): Snapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is Snapshot =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Snapshot).takenAt === 'number' &&
      typeof (s as Snapshot).workspaces === 'object' &&
      (s as Snapshot).workspaces !== null,
  );
}
