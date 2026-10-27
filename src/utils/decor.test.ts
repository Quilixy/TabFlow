import { describe, expect, it } from 'vitest';
import { CARD_DECOR_VARIANTS, cardDecorFor, makeBurst, makePetals, makeShootingStars, makeStars, seededRandom } from './decor';

describe('seededRandom', () => {
  it('aynı tohumla aynı diziyi üretir, değerler [0,1) aralığındadır', () => {
    const a = seededRandom(5);
    const b = seededRandom(5);
    for (let i = 0; i < 20; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value >= 0 && value < 1).toBe(true);
    }
  });
});

describe('süs parametreleri', () => {
  it('yapraklar kararlıdır ve makul aralıklardadır', () => {
    const petals = makePetals(14);
    expect(petals).toHaveLength(14);
    expect(makePetals(14)).toEqual(petals);
    for (const p of petals) {
      expect(p.x >= 0 && p.x <= 100).toBe(true);
      expect(p.size >= 10 && p.size <= 18).toBe(true);
      expect(p.duration >= 14 && p.duration <= 26).toBe(true);
      expect(p.delay <= 0 && p.delay >= -p.duration).toBe(true); // animasyon ortada başlar
      expect(p.opacity > 0 && p.opacity <= 0.9).toBe(true);
    }
  });

  it('yıldızlar ekran içindedir', () => {
    const stars = makeStars(26);
    expect(stars).toHaveLength(26);
    for (const s of stars) {
      expect(s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100).toBe(true);
      expect(s.size >= 1 && s.size <= 2.6).toBe(true);
    }
  });

  it('yaprak dağılması her yöne yayılır ve tohuma göre değişir', () => {
    const burst = makeBurst(12, 1);
    expect(burst).toHaveLength(12);
    expect(burst.some((p) => p.dx > 0) && burst.some((p) => p.dx < 0)).toBe(true);
    expect(burst.some((p) => p.dy > 0) && burst.some((p) => p.dy < 0)).toBe(true);
    expect(makeBurst(12, 2)).not.toEqual(burst);
  });
});

describe('cardDecorFor', () => {
  it('aynı klasöre her zaman aynı köşeyi ve deseni verir', () => {
    expect(cardDecorFor('klasor-1')).toEqual(cardDecorFor('klasor-1'));
  });

  it('sol üst köşeyi hiç kullanmaz, tüm köşe ve desenleri kullanır', () => {
    const corners = new Set<string>();
    const variants = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const { corner, variant } = cardDecorFor(crypto.randomUUID());
      corners.add(corner);
      variants.add(variant);
      expect(variant >= 0 && variant < CARD_DECOR_VARIANTS).toBe(true);
    }
    expect([...corners].sort()).toEqual(['bl', 'br', 'tr']);
    expect(variants.size).toBe(CARD_DECOR_VARIANTS);
  });
});

describe('uzay süsleri', () => {
  it('yıldız renk tonları geçerli ve çoğu tema renginde', () => {
    const stars = makeStars(60);
    expect(stars.every((s) => [0, 1, 2, 3].includes(s.tint))).toBe(true);
    expect(stars.filter((s) => s.tint === 0).length).toBeGreaterThan(30);
  });

  it('kayan yıldızlar kararlı ve ekranın üst yarısından başlar', () => {
    const shots = makeShootingStars(3);
    expect(makeShootingStars(3)).toEqual(shots);
    for (const s of shots) {
      expect(s.top >= 4 && s.top <= 45).toBe(true);
      expect(s.delay >= 0).toBe(true);
    }
  });
});
