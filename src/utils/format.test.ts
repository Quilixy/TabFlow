import { describe, expect, it } from 'vitest';
import { formatAgo, formatRestoreMessage, formatSaveAllMessage } from './format';

describe('formatAgo', () => {
  const now = 1_000_000_000_000;
  it('dakika, saat ve gün cinsinden yazar', () => {
    expect(formatAgo(now - 10_000, now)).toBe('az önce');
    expect(formatAgo(now - 5 * 60_000, now)).toBe('5 dk önce');
    expect(formatAgo(now - 3 * 3_600_000, now)).toBe('3 sa önce');
    expect(formatAgo(now - 2 * 86_400_000, now)).toBe('2 gün önce');
  });
  it('gelecekteki zamanı "az önce" sayar', () => {
    expect(formatAgo(now + 5_000, now)).toBe('az önce');
  });
});
describe('formatRestoreMessage', () => {
  it('sonuca göre tek cümle üretir', () => {
    expect(formatRestoreMessage({ opened: 0, skipped: 3 })).toBe('Tüm sekmeler zaten açık.');
    expect(formatRestoreMessage({ opened: 4, skipped: 0 })).toBe('4 sekme açıldı.');
    expect(formatRestoreMessage({ opened: 3, skipped: 2 })).toBe('3 sekme açıldı, 2 tanesi zaten açıktı.');
    expect(formatRestoreMessage({ opened: 25, skipped: 0, deferred: 15 })).toBe('25 sekme açıldı (15 tanesi tıklanınca yüklenecek).');
    expect(formatRestoreMessage({ opened: 25, skipped: 5, deferred: 15 })).toBe(
      '25 sekme açıldı, 5 tanesi zaten açıktı (15 tanesi tıklanınca yüklenecek).',
    );
  });
});

describe('formatSaveAllMessage', () => {
  it('kaydedilenleri ve açık bırakılanları söyler', () => {
    expect(formatSaveAllMessage(3, 'İş', 0, false)).toBe('3 sekme “İş” klasörüne kaydedildi.');
    expect(formatSaveAllMessage(3, 'İş', 2, false)).toBe(
      '3 sekme “İş” klasörüne kaydedildi. 2 sekme web sayfası olmadığı için açık bırakıldı.',
    );
  });

  it('kapatma hatasını bildirir', () => {
    expect(formatSaveAllMessage(1, 'A', 0, true)).toBe('1 sekme “A” klasörüne kaydedildi, ancak sekmeler kapatılamadı.');
  });
});
