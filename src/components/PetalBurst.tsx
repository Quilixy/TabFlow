import { useMemo, type CSSProperties } from 'react';
import { useUiStore } from '../store/useUiStore';
import { makeBurst } from '../utils/decor';

const PARTICLES = 12;

/** Bir klasörün üzerinde sakura yapraklarını saçar (store.burst ile tetiklenir). */
export function PetalBurst() {
  const burst = useUiStore((s) => s.burst);
  const particles = useMemo(() => (burst ? makeBurst(PARTICLES, burst.key) : []), [burst]);
  if (!burst) return null;

  return (
    <div key={burst.key} className="tf-burst" style={{ left: burst.x, top: burst.y }} aria-hidden="true" data-testid="petal-burst">
      {particles.map((p, i) => (
        <span
          key={i}
          className="tf-burst-petal"
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rotate}deg`,
              '--s': `${p.size}px`,
              '--delay': `${p.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
