import { describe, expect, it } from 'vitest';
import { formatRestoreResult, tabGroupColor, type RestoreResult } from './restore';

const result = (patch: Partial<RestoreResult>): RestoreResult => ({
  mode: 'tabs',
  opened: 0,
  skipped: 0,
  deferred: 0,
  grouped: 0,
  ...patch,
});

describe('formatRestoreResult', () => {
  it('bu pencerede açınca sonuca göre tek cümle üretir', () => {
    expect(formatRestoreResult(result({ skipped: 3 }), 'A')).toBe('Tüm sekmeler zaten açık.');
    expect(formatRestoreResult(result({ opened: 4 }), 'A')).toBe('4 sekme açıldı.');
    expect(formatRestoreResult(result({ opened: 3, skipped: 2 }), 'A')).toBe('3 sekme açıldı, 2 tanesi zaten açıktı.');
    expect(formatRestoreResult(result({ opened: 25, skipped: 5, deferred: 15 }), 'A')).toBe(
      '25 sekme açıldı, 5 tanesi zaten açıktı (15 tanesi tıklanınca yüklenecek).',
    );
  });

  it('sekme grubu ve yeni pencere için ayrı ileti verir', () => {
    expect(formatRestoreResult(result({ mode: 'group', opened: 2, skipped: 1, grouped: 3 }), 'İş')).toBe(
      '“İş” sekme grubu: 3 sekme, 1 tanesi zaten açıktı.',
    );
    expect(formatRestoreResult(result({ mode: 'group' }), 'İş')).toContain('Gruplanacak sekme yok');
    expect(formatRestoreResult(result({ mode: 'window', opened: 12, deferred: 2 }), 'İş')).toBe(
      '12 sekme yeni pencerede açıldı (2 tanesi tıklanınca yüklenecek).',
    );
  });
});

describe('tabGroupColor', () => {
  it('klasör rengini en yakın grup rengine eşler, renksizde mavi', () => {
    expect(tabGroupColor('emerald')).toBe('green');
    expect(tabGroupColor('amber')).toBe('orange');
    expect(tabGroupColor(undefined)).toBe('blue');
    expect(tabGroupColor('bilinmeyen')).toBe('blue');
  });
});
