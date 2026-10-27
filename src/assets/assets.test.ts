import { describe, expect, it } from 'vitest';

const svgs = import.meta.glob<string>('./*.svg', { query: '?raw', import: 'default', eager: true });

describe('arka plan görselleri', () => {
  it('en az bir SVG bulunur', () => {
    expect(Object.keys(svgs).length).toBeGreaterThan(0);
  });

  // Chrome, içinde animasyon bildirilen bir SVG görselini durdurulmuş olsa bile her karede baştan çizer
  // (ölçümde ~1,5 çekirdek). Hareket gerekiyorsa ayrı HTML öğeleriyle, transform/opacity ile yapılmalı.
  it.each(Object.entries(svgs))('%s durağandır (animasyon içermez)', (_name, source) => {
    expect(source).not.toMatch(/@keyframes|animation\s*:|<animate|<set\b/);
  });
});
