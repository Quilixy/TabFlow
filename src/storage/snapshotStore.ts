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

/**
 * Klasör haritasının bir yedeğini alır (boş haritada almaz). `onlyIfDue`: kilidin İÇİNDE son yedeğin zamanına
 * yeniden bakılır; arka arkaya gelen iki tetikleme aynı gün iki yedek alıp eski bir yedeği düşürmesin.
 */
export async function takeSnapshot(
  workspaces: WorkspaceMap,
  now: number,
  reason: Snapshot['reason'] = 'auto',
  onlyIfDue = false,
): Promise<boolean> {
  if (Object.keys(workspaces).length === 0) return false;
  let taken = false;
  await updateKey<unknown>(SNAPSHOTS_KEY, [], (raw) => {
    const list = normalizeSnapshots(raw);
    if (onlyIfDue && list.length > 0 && !shouldSnapshot({ lastAt: list[0].takenAt }, now)) return raw;
    taken = true;
    return addSnapshot(list, makeSnapshot(workspaces, now, reason));
  });
  // Meta her durumda güncellenir: hızlı yol (meta okuması) bir sonraki tetiklemede listeyi boşuna okumasın.
  await chrome.storage.local.set({ [SNAPSHOT_META_KEY]: { lastAt: taken ? now : await latestTakenAt(now) } });
  return taken;
}

async function latestTakenAt(fallback: number): Promise<number> {
  return (await readSnapshots())[0]?.takenAt ?? fallback;
}

/** Son yedekten bu yana yeterli süre geçtiyse yedek alır. Hızlı yol küçük meta anahtarını okur; yedek listesini değil. */
export async function takeSnapshotIfDue(workspaces: WorkspaceMap, now: number): Promise<boolean> {
  const meta = await readKey<SnapshotMeta | null>(SNAPSHOT_META_KEY, null);
  if (!shouldSnapshot(meta, now) || Object.keys(workspaces).length === 0) return false;
  return takeSnapshot(workspaces, now, 'auto', true);
}

export async function readSnapshots(): Promise<Snapshot[]> {
  return normalizeSnapshots(await readKey<unknown>(SNAPSHOTS_KEY, []));
}
