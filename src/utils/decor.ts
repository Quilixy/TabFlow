/** Basit, tohumlu rastgele sayı üreteci (mulberry32): aynı tohum her zaman aynı süsleri üretir. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (random: () => number, min: number, max: number): number => min + random() * (max - min);

export interface PetalParams {
  x: number; // % (yatay başlangıç)
  size: number; // px
  duration: number; // sn
  delay: number; // sn (negatif: animasyon baştan ortada başlar)
  drift: number; // px (yatay sürüklenme)
  spin: number; // derece
  opacity: number;
}

export function makePetals(count: number, seed = 7): PetalParams[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const duration = between(random, 14, 26);
    return {
      x: between(random, 0, 100),
      size: between(random, 10, 18),
      duration,
      delay: -random() * duration,
      drift: between(random, -120, 160),
      spin: between(random, 360, 900),
      opacity: between(random, 0.55, 0.9),
    };
  });
}

export interface StarParams {
  x: number; // %
  y: number; // %
  size: number; // px
  duration: number; // sn
  delay: number; // sn
  /** 0: tema rengi, 1: mavi, 2: mor, 3: pembe (birkaç yıldız renkli parlar). */
  tint: number;
}

export function makeStars(count: number, seed = 11): StarParams[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: between(random, 0, 100),
    y: between(random, 0, 100),
    size: between(random, 1, 2.6),
    duration: between(random, 2.5, 6),
    delay: -random() * 6,
    tint: random() < 0.7 ? 0 : 1 + Math.floor(random() * 3),
  }));
}

export interface ShootingStarParams {
  top: number; // %
  left: number; // %
  angle: number; // derece
  length: number; // px
  duration: number; // sn (bir döngü; çoğu sırasında görünmez)
  delay: number; // sn
}

/** Ekranın farklı yerlerinden, farklı aralıklarla geçen kayan yıldızlar. */
export function makeShootingStars(count: number, seed = 23): ShootingStarParams[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, i) => ({
    top: between(random, 4, 45),
    left: between(random, 35, 95),
    angle: between(random, 200, 230),
    length: between(random, 90, 160),
    duration: between(random, 9, 17),
    delay: i * 3.5 + between(random, 0, 3),
  }));
}

export type DecorCorner = 'tr' | 'br' | 'bl';
const DECOR_CORNERS: readonly DecorCorner[] = ['tr', 'br', 'bl'];
/** card-decor.css'teki desen sayısı (her pakette). */
export const CARD_DECOR_VARIANTS = 5;

/** Metinden kararlı bir 32 bit tohum (FNV-1a). */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Klasör kartının köşe süsü: hangi köşe (sol üst hariç: orada klasör simgesi var) ve hangi desen.
 * Klasör kimliğinden türetilir: rastgele görünür ama aynı klasör her açılışta aynı süsü alır.
 */
export function cardDecorFor(id: string): { corner: DecorCorner; variant: number } {
  const random = seededRandom(hashString(id));
  return {
    corner: DECOR_CORNERS[Math.floor(random() * DECOR_CORNERS.length)],
    variant: Math.floor(random() * CARD_DECOR_VARIANTS),
  };
}

export interface BurstParticle {
  dx: number; // px
  dy: number; // px
  rotate: number; // derece
  size: number; // px
  delay: number; // ms
}

/** Bir noktadan her yöne dağılan yapraklar. */
export function makeBurst(count: number, seed = 3): BurstParticle[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + between(random, -0.25, 0.25);
    const distance = between(random, 36, 84);
    return {
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance - 10), // hafif yukarı savrulur
      rotate: Math.round(between(random, -360, 360)),
      size: between(random, 9, 15),
      delay: Math.round(random() * 90),
    };
  });
}
