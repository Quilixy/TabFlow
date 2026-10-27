import type { WorkspaceMap } from '../types';
import {
  addSnapshot,
  makeSnapshot,
  normalizeSnapshots,
  shouldSnapshot,
  type Snapshot,
  type SnapshotMeta,
} from '../utils/snapshots';
import { SNAPSHOT_META_KEY, SNAPSHOTS_KEY } from './keys';
import { readKey, updateKey } from './kv';

/** Klasör haritasının bir yedeğini hemen alır (boş haritada almaz). */
export async function takeSnapshot(
  workspaces: WorkspaceMap,
  now: number,
  reason: Snapshot['reason'] = 'auto',
): Promise<void> {
  if (Object.keys(workspaces).length === 0) return;
  await updateKey<unknown>(SNAPSHOTS_KEY, [], (raw) =>
    addSnapshot(normalizeSnapshots(raw), makeSnapshot(workspaces, now, reason)),
  );
  await chrome.storage.local.set({ [SNAPSHOT_META_KEY]: { lastAt: now } satisfies SnapshotMeta });
}

/** Son yedekten bu yana yeterli süre geçtiyse yedek alır. Küçük meta anahtarını okur; yedek listesini değil. */
export async function takeSnapshotIfDue(workspaces: WorkspaceMap, now: number): Promise<boolean> {
  const meta = await readKey<SnapshotMeta | null>(SNAPSHOT_META_KEY, null);
  if (!shouldSnapshot(meta, now) || Object.keys(workspaces).length === 0) return false;
  await takeSnapshot(workspaces, now, 'auto');
  return true;
}

export async function readSnapshots(): Promise<Snapshot[]> {
  return normalizeSnapshots(await readKey<unknown>(SNAPSHOTS_KEY, []));
}
