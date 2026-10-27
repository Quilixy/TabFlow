import { useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useUiStore } from '../store/useUiStore';
import { makePetals, makeShootingStars, makeStars } from '../utils/decor';

const PETAL_COUNT = 14;
const STAR_COUNT = 40;
const SHOOTING_STAR_COUNT = 3;

/** Özel özellik (CSS değişkeni) taşıyan stil nesneleri için küçük yardımcı. */
const vars = (values: Record<string, string | number>): CSSProperties => values as CSSProperties;

function PetalRain() {
  const petals = useMemo(() => makePetals(PETAL_COUNT), []);
  return (
    <div className="tf-decor" aria-hidden="true" data-testid="petal-rain">
      {petals.map((p, i) => (
        <span
          key={i}
          className="tf-petal"
          style={vars({
            '--x': `${p.x}%`,
            '--s': `${p.size}px`,
            '--dur': `${p.duration}s`,
            '--delay': `${p.delay}s`,
            '--drift': `${p.drift}px`,
            '--spin': `${p.spin}deg`,
            '--o': p.opacity,
          })}
        />
      ))}
    </div>
  );
}

function StarField() {
  const stars = useMemo(() => makeStars(STAR_COUNT), []);
  const shootingStars = useMemo(() => makeShootingStars(SHOOTING_STAR_COUNT), []);
  return (
    <div className="tf-decor" aria-hidden="true" data-testid="star-field">
      {stars.map((s, i) => (
        <span
          key={i}
          className="tf-star"
          data-tint={s.tint}
          style={vars({
            '--x': `${s.x}%`,
            '--y': `${s.y}%`,
            '--s': `${s.size}px`,
            '--dur': `${s.duration}s`,
            '--delay': `${s.delay}s`,
          })}
        />
      ))}
      {/* Yüzen gezegen ve çevresinde dönen uydu; köşede ay */}
      <div className="tf-planet-wrap">
        <span className="tf-planet" />
        <span className="tf-satellite" />
      </div>
      <span className="tf-moon" />
      {shootingStars.map((s, i) => (
        <span
          key={i}
          className="tf-shooting"
          style={vars({
            '--top': `${s.top}%`,
            '--left': `${s.left}%`,
            '--angle': `${s.angle}deg`,
            '--len': `${s.length}px`,
            '--dur': `${s.duration}s`,
            '--delay': `${s.delay}s`,
          })}
        />
      ))}
      <span className="tf-comet" />
    </div>
  );
}

/**
 * Tema paketinin hareketli süsleri (düşen yapraklar / yıldızlar, gezegen, ay, kayan yıldızlar). Süsler kapalıysa ya da animasyon "Yok" ise çizilmez.
 * Statik süsler (Uzay arka planı, Sakura kart dalı) CSS ile gelir; bu bileşen yalnızca hareketli katmanı ekler.
 */
export function ThemeDecor() {
  const pack = useUiStore((s) => s.pack);
  const decor = useUiStore((s) => s.decor);
  const animation = useUiStore((s) => s.animation);

  if (pack === 'default' || !decor || animation === 'none') return null;
  return createPortal(pack === 'sakura' ? <PetalRain /> : <StarField />, document.body);
}
