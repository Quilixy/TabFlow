import { ACCENT_IDS, ANIMATION_STYLES, THEME_MODES, THEME_PACKS } from './theme';
import { isLanguageSetting, type LanguageSetting } from '../i18n';

/** Pencereler (popup ↔ tam ekran) arasında canlı eşitlenen ayarlar. Gezinti durumu (seçili klasör, açık dallar) bilerek HARİÇ. */
export interface SyncedUiState {
  theme: (typeof THEME_MODES)[number];
  accent: (typeof ACCENT_IDS)[number];
  animation: (typeof ANIMATION_STYLES)[number];
  pack: (typeof THEME_PACKS)[number];
  decor: boolean;
  deepPreview: boolean;
  language: LanguageSetting;
  closeOnAdd: boolean;
  lastBackupAt: number | null;
}

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : undefined;

/**
 * localStorage'daki zustand kaydından (JSON) yalnızca senkronlanacak, DOĞRULANMIŞ alanları çıkarır.
 * Neden `persist.rehydrate()` değil: her pencere tüm nesneyi yazar; rehydrate, diğer penceredeki bayat gezinti
 * durumunu (seçili klasör vb.) bu pencerenin üzerine yazardı.
 */
export function pickSyncedState(rawJson: string | null): Partial<SyncedUiState> | null {
  if (!rawJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }
  const state = (parsed as { state?: Record<string, unknown> } | null)?.state;
  if (!state || typeof state !== 'object') return null;

  const patch: Partial<SyncedUiState> = {};
  const theme = oneOf(THEME_MODES, state.theme);
  if (theme) patch.theme = theme;
  const accent = oneOf(ACCENT_IDS, state.accent);
  if (accent) patch.accent = accent;
  const animation = oneOf(ANIMATION_STYLES, state.animation);
  if (animation) patch.animation = animation;
  const pack = oneOf(THEME_PACKS, state.pack);
  if (pack) patch.pack = pack;
  if (typeof state.decor === 'boolean') patch.decor = state.decor;
  if (typeof state.deepPreview === 'boolean') patch.deepPreview = state.deepPreview;
  if (isLanguageSetting(state.language)) patch.language = state.language;
  if (typeof state.closeOnAdd === 'boolean') patch.closeOnAdd = state.closeOnAdd;
  if (state.lastBackupAt === null || (typeof state.lastBackupAt === 'number' && Number.isFinite(state.lastBackupAt))) {
    patch.lastBackupAt = state.lastBackupAt;
  }
  return patch;
}

/**
 * Gelen yamadan yalnızca mevcut durumdan FARKLI alanları bırakır; fark yoksa null.
 * Aynı değerleri tekrar setState etmek persist'i yeniden yazdırır; bu da diğer pencerede yeni bir `storage`
 * olayı doğurur ve iki pencere birbirini sonsuza dek tetikler.
 */
export function diffSyncedState(
  current: SyncedUiState,
  patch: Partial<SyncedUiState> | null,
): Partial<SyncedUiState> | null {
  if (!patch) return null;
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof SyncedUiState)[]) {
    if (patch[key] !== current[key]) diff[key] = patch[key];
  }
  return Object.keys(diff).length > 0 ? (diff as Partial<SyncedUiState>) : null;
}

/** Popup'tan tam ekran uygulamaya "şu klasörü aç" isteği (tek seferlik localStorage anahtarı). */
export const NAVIGATE_KEY = 'tabflow-navigate';

/** Bundan eski istekler yok sayılır (ör. uygulama açılamadıysa sonradan beklenmedik gezinme olmasın). */
const NAVIGATE_TTL_MS = 60_000;

export function parseNavigateRequest(rawJson: string | null, now: number = Date.now()): string | null {
  if (!rawJson) return null;
  try {
    const { id, at } = (JSON.parse(rawJson) ?? {}) as { id?: unknown; at?: unknown };
    if (typeof id !== 'string' || id === '' || typeof at !== 'number' || now - at > NAVIGATE_TTL_MS) return null;
    return id;
  } catch {
    return null;
  }
}

/**
 * Her pencere kalıcı durumun TAMAMINI yazar. Bir pencerenin sahibi olmadığı alanları (ör. tam ekranın popup'a ait
 * `popupExpanded`'ı) kendi bayat kopyasıyla ezmemesi için, giden kayıtta bu alanlar depodaki değerle değiştirilir.
 */
export function preserveForeignFields(outgoing: string, stored: string | null, keys: readonly string[]): string {
  if (!stored || keys.length === 0) return outgoing;
  try {
    const out = JSON.parse(outgoing) as { state?: Record<string, unknown> };
    const prev = JSON.parse(stored) as { state?: Record<string, unknown> } | null;
    if (!out.state || !prev?.state) return outgoing;
    for (const key of keys) {
      if (key in prev.state) out.state[key] = prev.state[key];
    }
    return JSON.stringify(out);
  } catch {
    return outgoing;
  }
}
