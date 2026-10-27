import { describe, expect, it } from 'vitest';
import {
  autoExportFileName,
  DEFAULT_AUTO_EXPORT,
  isAutoExportDue,
  normalizeAutoExport,
  toBase64Utf8,
} from './autoExport';

const DAY = 24 * 60 * 60 * 1000;

describe('diske otomatik yedek', () => {
  it('varsayılan haftalıktır ve hiç alınmadıysa zamanı gelmiştir', () => {
    expect(DEFAULT_AUTO_EXPORT.interval).toBe('weekly');
    expect(isAutoExportDue(DEFAULT_AUTO_EXPORT, 1000)).toBe(true);
  });

  it('aralığa göre zamanı hesaplar; kapalıyken hiç almaz', () => {
    const now = 100 * DAY;
    expect(isAutoExportDue({ interval: 'weekly', lastAt: now - 3 * DAY }, now)).toBe(false);
    expect(isAutoExportDue({ interval: 'weekly', lastAt: now - 7 * DAY }, now)).toBe(true);
    expect(isAutoExportDue({ interval: 'daily', lastAt: now - DAY }, now)).toBe(true);
    expect(isAutoExportDue({ interval: 'daily', lastAt: now - 3_600_000 }, now)).toBe(false);
    expect(isAutoExportDue({ interval: 'off', lastAt: null }, now)).toBe(false);
  });

  it('saat geri alınmışsa yeniden alır', () => {
    expect(isAutoExportDue({ interval: 'weekly', lastAt: 5 * DAY }, DAY)).toBe(true);
  });

  it('bozuk ayarı varsayılana çeker', () => {
    expect(normalizeAutoExport(null)).toEqual(DEFAULT_AUTO_EXPORT);
    expect(normalizeAutoExport({ interval: 'yearly', lastAt: 'dün' })).toEqual(DEFAULT_AUTO_EXPORT);
    expect(normalizeAutoExport({ interval: 'off', lastAt: 5 })).toEqual({ interval: 'off', lastAt: 5 });
  });

  it('dosya adı tarihlidir ve TabFlow klasöründedir', () => {
    expect(autoExportFileName(new Date('2026-10-27T10:00:00Z'))).toBe('TabFlow/tabflow-auto-backup-2026-10-27.json');
  });

  it('Türkçe karakterleri UTF-8 base64 olarak bozmadan kodlar', () => {
    const text = '{"name":"Çalışma İşleri ğüşıöç"}';
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(toBase64Utf8(text)), (c) => c.charCodeAt(0)));
    expect(decoded).toBe(text);
  });
});
