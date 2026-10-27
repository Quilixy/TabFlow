/** Düşen yaprak sayısı (canvas-scene.css her birine ayrı yol ve süre verir). */
const PETALS = Array.from({ length: 10 }, (_, i) => i);

/**
 * Sakura temasının manzarası: sol alttan yükselen üç parça kiraz dalı ve düşen yapraklar.
 * Klasör paneli ile tuvali kapsayan satırın en altında durur; paneller yarı saydam olduğundan panel
 * açılıp kapansa da ağaç pencerenin sol altında yerinde kalır. Görünürlük ve hareket canvas-scene.css'te
 * (yalnızca transform/opacity, GPU'da).
 */
export function SakuraScene() {
  return (
    <>
      <div className="tf-scene-tree" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="tf-scene-petals" aria-hidden="true">
        {PETALS.map((i) => (
          <i key={i} />
        ))}
      </div>
    </>
  );
}
