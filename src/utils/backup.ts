import type { SavedTab, Workspace, WorkspaceMap } from '../types';
import { isHttpUrl } from './url';
import { normalizeWorkspaces } from './workspaceTree';
import { t } from '../i18n';

export const BACKUP_APP = 'TabFlow';
export const BACKUP_SCHEMA_VERSION = 2;
/** Bu boyutun üstündeki dosyalar içe aktarılmaz (yanlış dosya seçimine karşı). */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string; // ISO
  workspaces: WorkspaceMap;
}

export interface ParsedBackup {
  workspaces: WorkspaceMap;
  skippedFolders: number;
  skippedTabs: number;
}

export interface MergeStats {
  added: number;
  updated: number;
  unchanged: number;
}

export function createBackup(workspaces: WorkspaceMap, now: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    workspaces,
  };
}

export const serializeBackup = (backup: BackupFile): string => JSON.stringify(backup, null, 2);

export const backupFileName = (now: Date = new Date()): string =>
  `tabflow-yedek-${now.toISOString().slice(0, 10)}.json`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Nesne anahtarı olarak atanınca prototipi değiştirebilecek adlar. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Dosyadan gelen zaman damgası gelecekte olamaz: aksi halde sonraki her birleştirmede "daha yeni" sayılırdı. */
const clampTime = (value: unknown, now: number): unknown =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(value, now) : value;

/**
 * Yedek dosyasını okur ve doğrular. Kabul edilen şekiller:
 *  - { app, schemaVersion, workspaces: {...} }  (bu uygulamanın dışa aktardığı)
 *  - doğrudan { id: Workspace } haritası (eski v1 depo içeriği)
 * Dosya içeriği güvenilmez sayılır: geçersiz klasör/sekmeler atlanır ve sayılır.
 */
export function parseBackup(text: string, now: number = Date.now()): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t('backup.err.json'));
  }
  if (!isRecord(data)) throw new Error(t('backup.err.unknown'));

  if (typeof data.schemaVersion === 'number' && data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(t('backup.err.newer'));
  }

  const rawMap = isRecord(data.workspaces) ? data.workspaces : data;

  let skippedFolders = 0;
  let skippedTabs = 0;
  const cleaned: Record<string, unknown> = {};

  for (const [id, value] of Object.entries(rawMap)) {
    if (UNSAFE_KEYS.has(id) || !isRecord(value) || typeof value.name !== 'string' || !Array.isArray(value.tabs)) {
      skippedFolders++;
      continue;
    }
    const tabs: unknown[] = [];
    for (const tab of value.tabs) {
      if (!isRecord(tab) || !isHttpUrl(tab.url)) {
        skippedTabs++;
        continue;
      }
      tabs.push({ ...tab, favIconUrl: isHttpUrl(tab.favIconUrl) ? tab.favIconUrl : null });
    }
    cleaned[id] = { ...value, createdAt: clampTime(value.createdAt, now), updatedAt: clampTime(value.updatedAt, now), tabs };
  }

  const workspaces = normalizeWorkspaces(cleaned);
  if (Object.keys(workspaces).length === 0) throw new Error(t('backup.err.empty'));
  return { workspaces, skippedFolders, skippedTabs };
}

/** İçe aktarmayı geri almak için: eklenen ve değiştirilen klasörlerin aktarım sonrası halleri. */
export interface ImportUndo {
  /** Yeni eklenen klasörler (aktarım sonrası hal). */
  added: Workspace[];
  /** Var olup değişen klasörler: önceki ve aktarım sonrası hal. */
  changed: { before: Workspace; after: Workspace }[];
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** `base` sekmelerine, `extra` içinde olup URL'si `base`de bulunmayanları ekler (kimlik çakışması olursa yenisini verir). */
function unionTabs(base: SavedTab[], extra: SavedTab[]): SavedTab[] {
  const urls = new Set(base.map((t) => t.url));
  const ids = new Set(base.map((t) => t.id));
  const result = [...base];
  for (const tab of extra) {
    if (urls.has(tab.url)) continue;
    urls.add(tab.url);
    const id = ids.has(tab.id) ? crypto.randomUUID() : tab.id;
    ids.add(id);
    result.push(id === tab.id ? tab : { ...tab, id });
  }
  return result;
}

/**
 * Yedeği mevcut verinin ÜZERİNE YAZMADAN birleştirir; hiçbir klasör ya da sekme silinmez:
 * aynı kimlikli klasör iki yerde varsa ad, renk, konum gibi bilgiler `updatedAt` değeri daha yeni olandan alınır,
 * sekmeler ise URL'ye göre birleştirilir (yalnızca bir tarafta olan sekme korunur).
 * Sonda normalize edilir: birleşmeden doğan yetim üst klasör ve döngüler düzelir.
 */
export function mergeWorkspaces(
  current: WorkspaceMap,
  incoming: WorkspaceMap,
): { map: WorkspaceMap; stats: MergeStats; undo: ImportUndo } {
  const map: WorkspaceMap = { ...current };
  const stats: MergeStats = { added: 0, updated: 0, unchanged: 0 };
  const addedIds: string[] = [];
  const changedIds: string[] = [];

  for (const [id, workspace] of Object.entries(incoming)) {
    const existing = map[id];
    if (!existing) {
      map[id] = workspace;
      addedIds.push(id);
      continue;
    }
    const merged =
      workspace.updatedAt > existing.updatedAt
        ? { ...workspace, tabs: unionTabs(workspace.tabs, existing.tabs) }
        : { ...existing, tabs: unionTabs(existing.tabs, workspace.tabs) };
    if (sameJson(merged, existing)) {
      stats.unchanged++;
    } else {
      map[id] = merged;
      changedIds.push(id);
    }
  }

  const normalized = normalizeWorkspaces(map);
  // Normalize, birleşmeden doğan döngüyü kırarken aktarımda olmayan bir yerel klasörü de köke alabilir:
  // geri alınabilmesi için onu da "değişen" say.
  const touched = new Set([...addedIds, ...changedIds]);
  for (const id of Object.keys(current)) {
    if (!touched.has(id) && normalized[id] && !sameJson(normalized[id], current[id])) {
      changedIds.push(id);
      stats.unchanged = Math.max(0, stats.unchanged - (incoming[id] ? 1 : 0));
    }
  }
  stats.added = addedIds.length;
  stats.updated = changedIds.length;
  return {
    map: normalized,
    stats,
    undo: {
      added: addedIds.map((id) => normalized[id]).filter(Boolean),
      changed: changedIds.filter((id) => normalized[id]).map((id) => ({ before: current[id], after: normalized[id] })),
    },
  };
}

/**
 * İçe aktarmayı geri alır; yalnızca aktarımın dokunduğu ve o zamandan beri DEĞİŞMEMİŞ klasörlere dokunur.
 * Aktarımdan sonra yapılan değişiklikler (başka bir pencereden kayıt, yeniden adlandırma…) korunur.
 */
export function undoImport(current: WorkspaceMap, undo: ImportUndo): WorkspaceMap {
  const map: WorkspaceMap = { ...current };
  let touched = false;
  for (const after of undo.added) {
    if (map[after.id] && sameJson(map[after.id], after)) {
      delete map[after.id];
      touched = true;
    }
  }
  for (const { before, after } of undo.changed) {
    if (map[after.id] && sameJson(map[after.id], after)) {
      map[after.id] = before;
      touched = true;
    }
  }
  return touched ? normalizeWorkspaces(map) : current;
}
