/**
 * Diske otomatik yedek: klasörlerin JSON yedeği belirli aralıklarla İndirilenler/TabFlow klasörüne yazılır.
 * Eklenti kaldırılırsa Chrome eklentinin tüm verisini (otomatik anlık görüntüler dahil) siler; diskteki bu dosyalar
 * ise kalır ve "Yedekten içe aktar" ile geri yüklenebilir.
 */

export const AUTO_EXPORT_INTERVALS = ['off', 'daily', 'weekly'] as const;
export type AutoExportInterval = (typeof AUTO_EXPORT_INTERVALS)[number];

export interface AutoExportSettings {
  interval: AutoExportInterval;
  /** Son başarılı diske yedeğin zamanı. */
  lastAt: number | null;
}

/** Varsayılan açık: veri kaybına karşı koruma kullanıcı bir şey yapmadan çalışmalı. */
export const DEFAULT_AUTO_EXPORT: AutoExportSettings = { interval: 'weekly', lastAt: null };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Aralıklar biraz kısa tutulur: tarayıcı her gün aynı saatte açılmasa da yedek kaymasın. */
const INTERVAL_MS: Record<Exclude<AutoExportInterval, 'off'>, number> = {
  daily: DAY_MS - 2 * 60 * 60 * 1000,
  weekly: 7 * DAY_MS - 6 * 60 * 60 * 1000,
};

/** İndirilenler klasörü içindeki alt klasör. */
export const AUTO_EXPORT_FOLDER = 'TabFlow';

export function normalizeAutoExport(raw: unknown): AutoExportSettings {
  const value = (raw ?? {}) as Partial<AutoExportSettings>;
  const interval = (AUTO_EXPORT_INTERVALS as readonly unknown[]).includes(value.interval)
    ? (value.interval as AutoExportInterval)
    : DEFAULT_AUTO_EXPORT.interval;
  const lastAt = typeof value.lastAt === 'number' && Number.isFinite(value.lastAt) ? value.lastAt : null;
  return { interval, lastAt };
}

export function isAutoExportDue(settings: AutoExportSettings, now: number): boolean {
  if (settings.interval === 'off') return false;
  if (settings.lastAt === null || settings.lastAt > now) return true; // hiç alınmamış ya da saat geri alınmış
  return now - settings.lastAt >= INTERVAL_MS[settings.interval];
}

/** "TabFlow/tabflow-auto-backup-2026-10-27.json" (dilden bağımsız; aynı gün ikinci kez alınırsa Chrome numaralar). */
export function autoExportFileName(now: Date): string {
  return `${AUTO_EXPORT_FOLDER}/tabflow-auto-backup-${now.toISOString().slice(0, 10)}.json`;
}

/** Metni UTF-8 base64'e çevirir (service worker'da Blob URL yok; indirme data: adresiyle yapılır). */
export function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
