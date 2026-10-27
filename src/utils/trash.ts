import type { SavedTab, Workspace } from '../types';

/** Çöp kutusundaki öğeler bu süre sonra kendiliğinden silinir. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Çöp kutusu en fazla bu kadar öğe tutar (en eskiler atılır). */
export const TRASH_MAX_ENTRIES = 200;

export type TrashEntry =
  | {
      id: string;
      kind: 'folder';
      deletedAt: number;
      /** Silinen klasör ve tüm alt klasörleri; ilki silinen klasörün kendisi. */
      folders: Workspace[];
    }
  | {
      id: string;
      kind: 'tab';
      deletedAt: number;
      folderId: string;
      /** Klasör de silinmişse geri yüklerken bu adla yeniden oluşturulur. */
      folderName: string;
      index: number;
      tab: SavedTab;
    };

/** Süresi dolmuş öğeleri atar; liste değişmediyse aynı diziyi döndürür. */
export function pruneTrash(entries: TrashEntry[], now: number): TrashEntry[] {
  const kept = entries.filter((e) => now - e.deletedAt < TRASH_RETENTION_MS).slice(0, TRASH_MAX_ENTRIES);
  return kept.length === entries.length ? entries : kept;
}

/** Yeni öğeyi başa ekler (yeniden eskiye) ve eskileri budar. */
export function pushTrash(entries: TrashEntry[], entry: TrashEntry, now: number): TrashEntry[] {
  return pruneTrash([entry, ...entries.filter((e) => e.id !== entry.id)], now);
}

export function removeTrashEntry(entries: TrashEntry[], id: string): TrashEntry[] {
  const next = entries.filter((e) => e.id !== id);
  return next.length === entries.length ? entries : next;
}

/** Depodan gelen değeri güvenle diziye çevirir (bozuk/eksik veride boş liste). */
export function normalizeTrash(raw: unknown): TrashEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is TrashEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as TrashEntry).id === 'string' &&
      typeof (e as TrashEntry).deletedAt === 'number' &&
      (((e as TrashEntry).kind === 'folder' && Array.isArray((e as { folders?: unknown }).folders)) ||
        ((e as TrashEntry).kind === 'tab' && typeof (e as { tab?: unknown }).tab === 'object')),
  );
}

/** Listede gösterilecek kısa özet. */
export function describeTrashEntry(entry: TrashEntry): { title: string; detail: string } {
  if (entry.kind === 'tab') return { title: entry.tab.title, detail: `Sekme · “${entry.folderName}” klasöründen` };
  const [root, ...rest] = entry.folders;
  const tabs = entry.folders.reduce((sum, f) => sum + f.tabs.length, 0);
  const parts = [`${tabs} sekme`];
  if (rest.length > 0) parts.push(`${rest.length} alt klasör`);
  return { title: root?.name ?? 'Klasör', detail: `Klasör · ${parts.join(' · ')}` };
}
