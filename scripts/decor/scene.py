"""src/styles/canvas-scene.css ve Uzay galaksisi görselleri: tam ekran uygulamanın tuval manzarası.

Sakura: SakuraScene (sol alttan yükselen üç parça dal + düşen yapraklar). Dal parçaları split_tree.py ile
src/assets/sakura-saf-agac-oshima.svg'den üretilir.
Uzay: tuvalin ortasında dönen galaksi (src/assets/uzay-galaksi-*.svg) ve parıldayan Avcı takımyıldızı.
Hareketli her şey yalnızca transform/opacity ile canlanır (GPU'da); SVG'lerin içinde animasyon olmaz.
"""
import math
import random

from common import uri

def galaxy_face(core, arm, star, seed=5):
    """Yüzü dönük sarmal galaksi: iki ana, iki ince ara kol ve kolların çevresinde yoğun yıldız tozu."""
    r = random.Random(seed)
    arms_paths = []
    buckets = {0.35: [], 0.6: [], 0.9: []}  # opaklık -> yıldızlar

    def dot(x, y, rad):
        o = min(buckets, key=lambda b: abs(b - r.uniform(0.3, 1)))
        buckets[o].append(f"<circle cx='{x:.0f}' cy='{y:.0f}' r='{rad:.1f}'/>")

    for a_i in range(4):
        main = a_i % 2 == 0  # ana kollar kalın ve yoğun, aradakiler ince ve seyrek
        pts = []
        for i in range(120):
            th = i / 120 * 9.4
            rad = 11 * math.exp(0.3 * th)
            ang = th + a_i * math.pi / 2
            pts.append((200 + math.cos(ang) * rad, 200 + math.sin(ang) * rad))
            if main or i % 2 == 0:
                j = rad * 0.15
                for _ in range(3 if main else 1):
                    dot(pts[-1][0] + r.uniform(-j, j), pts[-1][1] + r.uniform(-j, j), r.uniform(0.7, 2.0))
        for c in range(0, len(pts) - 1, 12):
            seg = pts[c : c + 13]
            k = c / len(pts)
            d = 'M' + 'L'.join(f'{x:.0f} {y:.0f}' for x, y in seg)
            arms_paths.append(
                f"<path d='{d}' stroke-width='{(34 - 24 * k) * (1 if main else 0.55):.0f}' "
                f"opacity='{(0.45 - 0.25 * k) * (1 if main else 0.6):.2f}'/>"
            )
    for _ in range(140):
        a = r.uniform(0, math.tau)
        rad = 20 + 170 * r.random() ** 0.8
        dot(200 + math.cos(a) * rad, 200 + math.sin(a) * rad, r.uniform(0.5, 1.3))
    stars = ''.join(f"<g opacity='{o}'>{''.join(c)}</g>" for o, c in buckets.items())
    return (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><defs>"
        f"<radialGradient id='d'><stop offset='0' stop-color='{arm}' stop-opacity='0.45'/><stop offset='1' stop-color='{arm}' stop-opacity='0'/></radialGradient>"
        f"<radialGradient id='c'><stop offset='0' stop-color='{core}'/><stop offset='0.4' stop-color='{core}' stop-opacity='0.6'/><stop offset='1' stop-color='{arm}' stop-opacity='0'/></radialGradient>"
        "<filter id='f' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='7'/></filter></defs>"
        "<circle cx='200' cy='200' r='195' fill='url(#d)'/>"
        f"<g fill='none' stroke='{arm}' stroke-linecap='round' filter='url(#f)'>{''.join(arms_paths)}</g>"
        f"<g fill='{star}'>{stars}</g>"
        "<circle cx='200' cy='200' r='46' fill='url(#c)'/></svg>"
    )


GALAXY_DARK = galaxy_face('#fdf4ff', '#a78bfa', '#eef2ff')
GALAXY_LIGHT = galaxy_face('#f5d0fe', '#7c3aed', '#5b21b6')


def galaxy_assets() -> dict[str, str]:
    """src/assets'e yazılacak galaksi görselleri (~40 KB; CSS'e gömülmez)."""
    size = "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'"
    return {
        f'uzay-galaksi-{name}.svg': svg.replace("<svg xmlns='http://www.w3.org/2000/svg'", size) + '\n'
        for name, svg in (('koyu', GALAXY_DARK), ('acik', GALAXY_LIGHT))
    }


# Avcı (Orion) takımyıldızı: gökyüzündeki konumlar (derece; x doğuya/sola, y kuzeye/yukarı ters), kadir ve renk.
ORION = [
    ('Meissa', -0.15, -9.93, 3.4, None),
    ('Betelgeuse', -5.1, -7.4, 0.5, 'red'),
    ('Bellatrix', 2.4, -6.35, 1.6, None),
    ('Mintaka', 0.75, 0.3, 2.2, None),
    ('Alnilam', -0.3, 1.2, 1.7, None),
    ('Alnitak', -1.5, 1.94, 1.8, None),
    ('Hatysa', -0.4, 5.9, 2.8, None),
    ('Saiph', -3.3, 9.67, 2.1, None),
    ('Rigel', 5.1, 8.2, 0.1, 'blue'),
]
ORION_LINKS = [('Meissa', 'Betelgeuse'), ('Meissa', 'Bellatrix'), ('Betelgeuse', 'Alnitak'), ('Bellatrix', 'Mintaka'),
               ('Mintaka', 'Alnilam'), ('Alnilam', 'Alnitak'), ('Alnitak', 'Saiph'), ('Mintaka', 'Rigel')]
_pos = {n: (x, y) for n, x, y, _m, _k in ORION}


def orion_lines(color):
    d = ''.join(f'M{_pos[a][0]} {_pos[a][1]}L{_pos[b][0]} {_pos[b][1]}' for a, b in ORION_LINKS)
    return uri(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='-7 -12 14 24'>"
        f"<path d='{d}' stroke='{color}' stroke-width='.09' stroke-dasharray='.35 .3' stroke-linecap='round' fill='none'/></svg>"
    )


STAR_TINT = {  # (koyu renk, koyu ışıma, açık renk, açık ışıma)
    'red': ('#ffb38a', 'rgb(255 150 100 / 0.85)', '#ea580c', 'rgb(234 88 12 / 0.45)'),
    'blue': ('#dbeafe', 'rgb(147 197 253 / 0.95)', '#2563eb', 'rgb(37 99 235 / 0.45)'),
}
ORION_RULES = '\n'.join(
    f".tf-canvas-orion i:nth-child({n}) {{ left: {(x + 7) / 14 * 100:.1f}%; top: {(y + 12) / 24 * 100:.1f}%; "
    f"--d: {2 + (3.5 - m) * 0.9:.1f}px; --t: {2.4 + (n * 0.83) % 2.4:.1f}s; --dl: {-n * 0.53:.2f}s;"
    + (f" --c: {STAR_TINT[k][0]}; --g: {STAR_TINT[k][1]}; --cl: {STAR_TINT[k][2]}; --gl: {STAR_TINT[k][3]};" if k else '')
    + ' }'
    for n, (_name, x, y, m, k) in enumerate(ORION, 1)
)

# Düşen yaprak: SVG'deki "tumbling-petal-a" biçimi; açık pembe zeminde seçilsin diye daha koyu tonlarla
PETAL_URI = uri(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='-10 -18 20 19'><defs>"
    "<linearGradient id='g' x1='0' y1='1' x2='0' y2='0'><stop offset='0' stop-color='#e98fb3'/>"
    "<stop offset='.55' stop-color='#f8bfd5'/><stop offset='1' stop-color='#ffe9f1'/></linearGradient></defs>"
    "<path d='M0 0C-5.5 -3.5 -9.5 -11 -4.5 -16C-2.2 -18 0 -14.8 0 -12.5C.8 -14.8 2.8 -18 5 -16C9.5 -11 5.5 -3.5 0 0Z'"
    " fill='url(#g)' stroke='#d97aa0' stroke-width='.7'/></svg>"
)
# (sol px, görseldeki dikey konum %, süre s, gecikme s, yol, boyut çarpanı) - başlangıçlar dalların kapladığı bölgede
PETAL_SPECS = [
    (70, 18, 13, -1, 'a', 1), (160, 30, 11, -4, 'b', 0.8), (250, 14, 14, -7, 'a', 0.9),
    (330, 36, 12, -2.5, 'b', 1.1), (120, 48, 15, -9, 'a', 0.75), (400, 22, 13.5, -5.5, 'b', 0.85),
    (210, 55, 12.5, -11, 'a', 1), (40, 34, 16, -3.5, 'b', 0.9), (300, 8, 11.5, -8, 'a', 0.8),
    (450, 42, 14.5, -12.5, 'b', 1),
]
PETAL_RULES = '\n'.join(
    f".tf-scene-petals i:nth-child({n}) {{ left: {round(x * 0.74)}px; top: calc(100% - min(560px, 80%) * {round(1 - y / 100, 2)}); --s: {sc}; animation: tf-petal-{k} {d}s linear {dl}s infinite; }}"
    for n, (x, y, d, dl, k, sc) in enumerate(PETAL_SPECS, 1)
)

scene_css = []
scene_css.append(f"""
/* ---- Tuval manzarası: kartların arkasında, kaydırma/yakınlaştırmadan bağımsız ---- */
/* Sakura: sol alttan yükselen kiraz dalları (SakuraScene: .tf-scene-tree > i). Klasör paneli ve tuvalin
   arkasında, pencerenin sol altına yaslıdır; yarı saydam yüzeylerin ardından görünür.
   sakura-saf-agac-oshima.svg üst/orta/alt dal gruplarına bölündü; parçalar durağan SVG'dir (bkz. dosyadaki
   not). Her parça kendi katmanında, dalın tuvale girdiği noktanın çevresinde döner: yalnızca transform
   canlandırıldığı için GPU'da taşınır, görsel yeniden çizilmez. */
.tf-scene-tree {{ display: none; }}
html[data-pack='sakura'][data-decor='on'] .tf-scene-tree {{
  display: block; position: absolute; left: 0; bottom: 0; pointer-events: none;
  height: min(560px, 80%); aspect-ratio: 600 / 760; opacity: 0.8;
}}
html[data-pack='sakura'][data-theme='dark'][data-decor='on'] .tf-scene-tree {{ opacity: 0.5; }}
.tf-scene-tree i {{ position: absolute; inset: 0; background: center / contain no-repeat; }}
.tf-scene-tree i:nth-child(1) {{ background-image: url('../assets/sakura-dal-1-ust.svg'); transform-origin: 0 55%; }}
.tf-scene-tree i:nth-child(2) {{ background-image: url('../assets/sakura-dal-2-orta.svg'); transform-origin: 0 81%; }}
.tf-scene-tree i:nth-child(3) {{ background-image: url('../assets/sakura-dal-3-alt.svg'); transform-origin: 0 95%; }}
html[data-pack='sakura'][data-decor='on']:not([data-anim='none']) .tf-scene-tree i {{ will-change: transform; }}
html[data-pack='sakura'][data-decor='on']:not([data-anim='none']) .tf-scene-tree i:nth-child(1) {{
  animation: tf-bough-upper 6.2s cubic-bezier(0.42, 0, 0.58, 1) infinite alternate;
}}
html[data-pack='sakura'][data-decor='on']:not([data-anim='none']) .tf-scene-tree i:nth-child(2) {{
  animation: tf-bough-mid 7.1s cubic-bezier(0.42, 0, 0.58, 1) -1.9s infinite alternate;
}}
html[data-pack='sakura'][data-decor='on']:not([data-anim='none']) .tf-scene-tree i:nth-child(3) {{
  animation: tf-bough-lower 5.9s cubic-bezier(0.42, 0, 0.58, 1) -3.4s infinite alternate;
}}
@keyframes tf-bough-upper {{
  from {{ transform: rotate(-1deg) translateY(1.5px); }}
  to {{ transform: rotate(1.5deg) translateY(-3px); }}
}}
@keyframes tf-bough-mid {{
  from {{ transform: rotate(-1.4deg) translateX(-1px); }}
  to {{ transform: rotate(1.9deg) translateX(2.5px); }}
}}
@keyframes tf-bough-lower {{
  from {{ transform: rotate(-1.7deg) translateY(-1.5px); }}
  to {{ transform: rotate(2.4deg) translateY(3.5px); }}
}}
@media (prefers-reduced-motion: reduce) {{
  .tf-scene-tree i {{ animation: none !important; }}
}}

/* Sakura: dallardan düşen yapraklar (SakuraScene: .tf-scene-petals > i). Yalnızca transform ve opacity
   canlandırılır; tarayıcı bunları GPU'da taşır, sayfa yeniden çizilmez. */
.tf-scene-petals {{ display: none; }}
html[data-pack='sakura'][data-decor='on']:not([data-anim='none']) .tf-scene-petals {{
  display: block; position: absolute; inset: 0; overflow: hidden; pointer-events: none;
}}
html[data-pack='sakura'][data-decor='on'] .tf-scene-petals {{ opacity: 0.75; }}
html[data-pack='sakura'][data-theme='dark'][data-decor='on'] .tf-scene-petals {{ opacity: 0.5; }}
.tf-scene-petals i {{
  position: absolute; width: calc(19px * var(--s, 1)); aspect-ratio: 20 / 19; opacity: 0;
  background: {PETAL_URI} center / contain no-repeat;
  animation: tf-petal-a 13s linear infinite; will-change: transform, opacity;
}}
{PETAL_RULES}
@keyframes tf-petal-a {{
  0% {{ transform: translate(0, 0) rotate(0deg) rotateY(0deg); opacity: 0; }}
  8% {{ opacity: 0.95; }}
  50% {{ transform: translate(100px, 115px) rotate(150deg) rotateY(180deg); }}
  86% {{ opacity: 0.85; }}
  100% {{ transform: translate(210px, 230px) rotate(320deg) rotateY(360deg); opacity: 0; }}
}}
@keyframes tf-petal-b {{
  0% {{ transform: translate(0, 0) rotate(-20deg) rotateX(0deg); opacity: 0; }}
  10% {{ opacity: 0.9; }}
  35% {{ transform: translate(70px, 75px) rotate(-90deg) rotateX(140deg); }}
  65% {{ transform: translate(45px, 160px) rotate(-200deg) rotateX(260deg); opacity: 0.85; }}
  100% {{ transform: translate(165px, 225px) rotate(-340deg) rotateX(360deg); opacity: 0; }}
}}
@media (prefers-reduced-motion: reduce) {{
  .tf-scene-petals {{ display: none !important; }}
}}
/* Uzay: sağ altta (yakınlaştırma çubuğunun üstünde) küçük, parıldayan Avcı (Orion) takımyıldızı (Canvas'taki .tf-canvas-orion > i).
   Çizgiler durağan arka plan; yıldızlar ayrı öğeler, yalnızca opacity/transform ile parıldar (GPU'da). */
.tf-canvas-orion {{ display: none; }}
html[data-pack='space'][data-decor='on'] .tf-canvas-orion {{
  display: block; position: absolute; right: 44px; bottom: 84px; width: 84px; aspect-ratio: 14 / 24; pointer-events: none;
  background: {orion_lines('#c4b5fd')} center / contain no-repeat; opacity: 0.85;
}}
html[data-pack='space'][data-theme='light'][data-decor='on'] .tf-canvas-orion {{
  background-image: {orion_lines('#7c3aed')}; opacity: 0.8;
}}
.tf-canvas-orion i {{
  position: absolute; width: var(--d); height: var(--d); margin: calc(var(--d) / -2) 0 0 calc(var(--d) / -2);
  border-radius: 50%; background: var(--c, #f5f3ff); box-shadow: 0 0 5px 1px var(--g, rgb(200 210 255 / 0.75));
}}
html[data-pack='space'][data-theme='light'] .tf-canvas-orion i {{
  background: var(--cl, #6d28d9); box-shadow: 0 0 4px 1px var(--gl, rgb(124 58 237 / 0.4));
}}
{ORION_RULES}
html[data-pack='space'][data-decor='on']:not([data-anim='none']) .tf-canvas-orion i {{
  animation: tf-orion-twinkle var(--t) ease-in-out var(--dl) infinite;
}}
@keyframes tf-orion-twinkle {{
  0%, 100% {{ opacity: 0.55; transform: scale(0.85); }}
  50% {{ opacity: 1; transform: scale(1.2); }}
}}
@media (prefers-reduced-motion: reduce) {{
  .tf-canvas-orion i {{ animation: none !important; }}
}}

/* Uzay: tuvalin ortasında yavaşça dönen, eğik ve saydam galaksi (Canvas'taki .tf-canvas-art).
   Görseller src/assets'te; durağan SVG, dönüşü GPU yapar. */
.tf-canvas-art {{ display: none; }}
html[data-pack='space'][data-decor='on'] .tf-canvas-art {{
  display: block; position: absolute; left: 50%; top: 50%; pointer-events: none;
  width: min(720px, 95%); aspect-ratio: 1;
  background: url('../assets/uzay-galaksi-koyu.svg') center / contain no-repeat;
  opacity: 0.32;
  transform: translate(-50%, -50%) rotateX(58deg) rotate(0deg);
  animation: tf-galaxy-spin 240s linear infinite;
}}
html[data-pack='space'][data-theme='light'][data-decor='on'] .tf-canvas-art {{
  background-image: url('../assets/uzay-galaksi-acik.svg');
  opacity: 0.28;
}}
@keyframes tf-galaxy-spin {{
  to {{ transform: translate(-50%, -50%) rotateX(58deg) rotate(-360deg); }}
}}
html[data-anim='none'] .tf-canvas-art {{ animation: none; }}
@media (prefers-reduced-motion: reduce) {{
  .tf-canvas-art {{ animation: none !important; }}
}}
""")


def build() -> str:
    return (
        "/* Tuval manzarası (yalnızca tam ekran uygulama). ÜRETİLMİŞ DOSYA: scripts/decor/scene.py üretir (npm run decor); elle düzenlemeyin. Sakura dalları ve Uzay galaksisi src/assets'ten gelir. */\n"
        + '\n'.join(scene_css)
    )
