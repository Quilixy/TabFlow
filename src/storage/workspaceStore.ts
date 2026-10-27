import type { WorkspaceMap } from '../types';
import { normalizeWorkspaces } from '../utils/workspaceTree';
import { WORKSPACES_KEY } from './keys';
import { StorageError, withLock } from './kv';
import { t } from '../i18n';

/**
 * Klasörlerin depolanması: her klasör kendi anahtarında (`ws:<id>`), kimlik listesi `wsIndex`te.
 * Bir kart sürüklemek yalnızca o klasörü yazar; onChanged da yalnızca değişen klasörleri taşır. (Eskiden tüm harita
 * tek anahtardaydı: her değişiklik binlerce sekmeyi yeniden yazıp her pencereye gönderiyordu.)
 * Eski tek anahtar (WORKSPACES_KEY) okunur ve ilk fırsatta bu düzene taşınır; içine yazılan bir harita (eski sürüm,
 * test verisi) yine taşınır ve tüm klasörlerin yerini alır.
 */

export const FOLDER_KEY_PREFIX = 'ws:';
export const FOLDER_INDEX_KEY = 'wsIndex';
const LEGACY_KEY = WORKSPACES_KEY;
const LOCK_NAME = 'workspaces';

/** Depodaki ham klasörler (kimlik → kayıt). Normalize edilmemiştir. */
export type RawWorkspaces = Record<string, unknown>;

export const folderKey = (id: string): string => FOLDER_KEY_PREFIX + id;

const isIndex = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

interface RawRead {
  raw: RawWorkspaces;
  /** Eski tek anahtarda veri var: bir sonraki yazmada yeni düzene taşınmalı. */
  legacy: boolean;
  /** Dizindeki kimlikler (yeni düzen). */
  index: string[];
}

async function readRawState(): Promise<RawRead> {
  try {
    const head = await chrome.storage.local.get([LEGACY_KEY, FOLDER_INDEX_KEY]);
    const index = isIndex(head[FOLDER_INDEX_KEY]) ? head[FOLDER_INDEX_KEY] : [];
    if (isRecord(head[LEGACY_KEY])) return { raw: head[LEGACY_KEY], legacy: true, index };
    if (index.length === 0) return { raw: {}, legacy: false, index };

    const data = await chrome.storage.local.get(index.map(folderKey));
    const raw: RawWorkspaces = {};
    for (const id of index) {
      const value = data[folderKey(id)];
      if (value !== undefined) raw[id] = value;
    }
    return { raw, legacy: false, index };
  } catch (e) {
    throw new StorageError(t('error.readFolders'), e);
  }
}

/** Depodaki ham klasörler (React kancası ilk yüklemede kullanır). */
export async function readRawWorkspaces(): Promise<RawWorkspaces> {
  return (await readRawState()).raw;
}

export async function readWorkspaceMap(): Promise<WorkspaceMap> {
  return normalizeWorkspaces(await readRawWorkspaces());
}

/**
 * Klasörleri kilitli olarak okuyup `fn` ile dönüştürür ve yalnızca değişenleri yazar. Değişen klasörler referansla
 * bulunur: `fn` dokunmadığı klasörün nesnesini aynen bırakmalıdır (tüm işlemler böyle yazılmıştır).
 * fn haritayı aynen döndürürse hiçbir şey yazılmaz.
 */
export function updateWorkspaces(fn: (map: WorkspaceMap) => WorkspaceMap): Promise<WorkspaceMap> {
  return withLock(LOCK_NAME, async () => {
    const { raw, legacy, index } = await readRawState();
    const current = normalizeWorkspaces(raw);
    const next = fn(current);
    if (next === current && !legacy) return current;

    const writes: Record<string, unknown> = {};
    const removals: string[] = [];
    const nextIds = Object.keys(next);

    if (legacy) {
      // Yeni düzene taşı: her klasör yazılır, eski düzende kalan fazlalıklar silinir.
      for (const id of nextIds) writes[folderKey(id)] = next[id];
      const keep = new Set(nextIds);
      for (const id of index) if (!keep.has(id)) removals.push(folderKey(id));
      removals.push(LEGACY_KEY);
    } else {
      for (const id of nextIds) if (next[id] !== current[id]) writes[folderKey(id)] = next[id];
      for (const id of Object.keys(current)) if (!(id in next)) removals.push(folderKey(id));
    }
    const idsChanged = legacy || removals.length > 0 || nextIds.some((id) => !(id in current));
    if (idsChanged) writes[FOLDER_INDEX_KEY] = nextIds;

    try {
      // Önce yaz (dizin dahil, tek çağrıda), sonra sil: silme başarısız olursa artıklar dizinde olmadığı için görünmez.
      if (Object.keys(writes).length > 0) await chrome.storage.local.set(writes);
    } catch (e) {
      throw new StorageError(t('error.writeFolders'), e);
    }
    if (removals.length > 0) await chrome.storage.local.remove(removals).catch(() => undefined);
    return next;
  });
}

/** Eski tek anahtardaki veriyi (varsa) yeni düzene taşır. */
export async function migrateLegacyWorkspaces(): Promise<void> {
  await updateWorkspaces((map) => map);
}

/** onChanged olayının klasörlerle ilgili olup olmadığı. */
export function isWorkspaceChange(changes: Record<string, chrome.storage.StorageChange>): boolean {
  return Object.keys(changes).some((key) => key === FOLDER_INDEX_KEY || key === LEGACY_KEY || key.startsWith(FOLDER_KEY_PREFIX));
}

/**
 * Bellekteki ham klasörlere bir onChanged olayını uygular (yalnızca değişen klasörler gelir). İlgili değişiklik yoksa
 * null. Eski anahtara yazılan harita her şeyin yerini alır (ardından yeni düzene taşınır).
 */
export function applyWorkspaceChanges(
  raw: RawWorkspaces,
  changes: Record<string, chrome.storage.StorageChange>,
): RawWorkspaces | null {
  const legacy = changes[LEGACY_KEY]?.newValue;
  if (isRecord(legacy)) return { ...legacy };

  let next: RawWorkspaces | null = null;
  for (const [key, change] of Object.entries(changes)) {
    if (!key.startsWith(FOLDER_KEY_PREFIX)) continue;
    next ??= { ...raw };
    const id = key.slice(FOLDER_KEY_PREFIX.length);
    if (change.newValue === undefined) delete next[id];
    else next[id] = change.newValue;
  }
  const index = changes[FOLDER_INDEX_KEY]?.newValue;
  if (isIndex(index)) {
    next ??= { ...raw };
    const keep = new Set(index);
    for (const id of Object.keys(next)) if (!keep.has(id)) delete next[id];
  }
  return next;
}

/**
 * Değişiklikten ÖNCEKİ ham klasörler: şimdiki hale olayın eski değerleri geri uygulanır. Otomatik yedek, yedeği
 * tetikleyen değişiklikten önceki hali saklamak için kullanır.
 */
export function revertWorkspaceChanges(
  raw: RawWorkspaces,
  changes: Record<string, chrome.storage.StorageChange>,
): RawWorkspaces {
  // Eski anahtar değiştiyse (taşıma ya da üzerine yazma) önceki hal onun eski değeridir.
  const legacyOld = changes[LEGACY_KEY]?.oldValue;
  if (isRecord(legacyOld)) return { ...legacyOld };

  const before: RawWorkspaces = { ...raw };
  for (const [key, change] of Object.entries(changes)) {
    if (!key.startsWith(FOLDER_KEY_PREFIX)) continue;
    const id = key.slice(FOLDER_KEY_PREFIX.length);
    if (change.oldValue === undefined) delete before[id];
    else before[id] = change.oldValue;
  }
  const oldIndex = changes[FOLDER_INDEX_KEY]?.oldValue;
  if (isIndex(oldIndex)) {
    const keep = new Set(oldIndex);
    for (const id of Object.keys(before)) if (!keep.has(id)) delete before[id];
  }
  return before;
}
