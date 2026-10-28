"""src/styles/card-decor.css: klasör kartlarının köşe süsleri (Sakura, Uzay), Uzay'da klasör eklenince
saçılan yıldız ve ThemeDecor'un ay/uydu görselleri. Bu dosya popup'ta da yüklenir; küçük tutulmalı."""
from common import uri

# ---- Sakura ---------------------------------------------------------------
PETAL = "M0 0C-3 -1.4 -3.5 -4.3 -1.3 -5.4L0 -4.5L1.3 -5.4C3.5 -4.3 3 -1.4 0 0Z"
BARK = '#8a5a44'


def flower(x, y, s=1.0, fill='#ffc7da', stroke='#f27aa5', rot=0, center='#f59e0b'):
    petals = ''.join(
        f"<path d='{PETAL}' transform='rotate({a})' fill='{fill}' stroke='{stroke}' stroke-width='0.45'/>"
        for a in (0, 72, 144, 216, 288)
    )
    stamens = ''.join(
        f"<line x1='0' y1='0' x2='0' y2='-2.2' transform='rotate({a})' stroke='{stroke}' stroke-width='0.35'/>"
        for a in (20, 92, 164, 236, 308)
    )
    return f"<g transform='translate({x} {y}) rotate({rot}) scale({s})'>{petals}{stamens}<circle r='1.05' fill='{center}'/></g>"


def bud(x, y, s=1.0, rot=0, fill='#f9a8c9'):
    return (
        f"<g transform='translate({x} {y}) rotate({rot}) scale({s})'>"
        f"<path d='M0 0C-1.8 -1.6 -1.6 -4 0 -5C1.6 -4 1.8 -1.6 0 0Z' fill='{fill}' stroke='#f27aa5' stroke-width='0.4'/>"
        f"<path d='M-1 0.2L0 1.6L1 0.2Z' fill='#7a9a5a'/></g>"
    )


def leaf(x, y, s=1.0, rot=0):
    return (
        f"<g transform='translate({x} {y}) rotate({rot}) scale({s})'>"
        "<path d='M0 0C2 -2 5 -2.4 7 -1C5 0.6 2 0.8 0 0Z' fill='#9cc47c' stroke='#6f9a52' stroke-width='0.35'/></g>"
    )


def loose_petal(x, y, s=1.0, rot=0):
    return (
        f"<g transform='translate({x} {y}) rotate({rot}) scale({s})'>"
        "<path d='M0 0C-2.4 -1.2 -2.8 -3.6 -1 -4.6L0 -3.8L1 -4.6C2.8 -3.6 2.4 -1.2 0 0Z' fill='#ffd1e1' stroke='#f27aa5' stroke-width='0.4'/></g>"
    )


def svg84(body):
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 84 60'>{body}</svg>"


SAKURA = [
    # 0 · Klasik dal: uzun dal, dört çiçek
    svg84(
        f"<path d='M84 2C70 10 56 20 44 28S22 42 6 52' stroke='{BARK}' stroke-width='2.4' fill='none' stroke-linecap='round'/>"
        f"<path d='M56 20C58 30 54 38 46 44' stroke='{BARK}' stroke-width='1.6' fill='none' stroke-linecap='round'/>"
        f"<path d='M30 36C28 42 24 46 18 48' stroke='{BARK}' stroke-width='1.3' fill='none' stroke-linecap='round'/>"
        + flower(66, 12, 1.1) + flower(44, 28, 1.0) + flower(46, 44, 0.75, rot=30) + flower(20, 47, 0.85, rot=15)
        + bud(78, 5, 0.9, rot=-40) + bud(31, 35, 0.8, rot=-70) + bud(9, 51, 0.7, rot=-60)
    ),
    # 1 · Tek iri çiçek, tomurcuklar ve yapraklar
    svg84(
        f"<path d='M84 3C76 8 68 13 58 19S44 28 36 33' stroke='{BARK}' stroke-width='2.2' fill='none' stroke-linecap='round'/>"
        f"<path d='M66 14C64 20 60 24 54 26' stroke='{BARK}' stroke-width='1.3' fill='none' stroke-linecap='round'/>"
        + leaf(72, 9, 1.1, rot=-150) + leaf(48, 24, 1.0, rot=160) + leaf(58, 19, 0.9, rot=40)
        + flower(60, 18, 1.75, rot=12)
        + bud(38, 32, 1.0, rot=-80) + bud(54, 27, 0.9, rot=-120) + bud(78, 6, 0.8, rot=-30)
    ),
    # 2 · Çiçek kümesi (dalsız)
    svg84(
        f"<path d='M84 0C80 4 76 8 72 10M84 0C82 8 80 14 76 20M84 0C76 2 68 4 62 8' stroke='{BARK}' stroke-width='1.2' fill='none' stroke-linecap='round'/>"
        + flower(70, 11, 1.3, rot=8) + flower(60, 9, 1.0, fill='#ffe0ea', rot=-20) + flower(75, 22, 1.05, rot=35)
        + flower(62, 20, 0.8, fill='#ffb3cc', rot=50)
        + bud(52, 12, 0.85, rot=-100) + bud(68, 28, 0.8, rot=-160)
        + loose_petal(48, 26, 0.9, rot=40) + loose_petal(56, 33, 0.7, rot=-30)
    ),
    # 3 · Savrulan yapraklar: kısa dal, bir çiçek ve rüzgârda yapraklar
    svg84(
        f"<path d='M84 2C78 6 72 9 64 12' stroke='{BARK}' stroke-width='2' fill='none' stroke-linecap='round'/>"
        + leaf(74, 6, 0.9, rot=-160)
        + flower(66, 12, 1.3, rot=-10) + bud(78, 5, 0.8, rot=-30)
        + loose_petal(54, 20, 1.1, rot=30) + loose_petal(44, 27, 0.95, rot=-40) + loose_petal(34, 33, 0.85, rot=70)
        + loose_petal(24, 41, 0.75, rot=-15) + loose_petal(14, 47, 0.65, rot=110) + loose_petal(46, 38, 0.6, rot=160)
    ),
    # 4 · Beyaz ve pembe: ince dal, açık ve koyu çiçekler
    svg84(
        f"<path d='M84 4C72 8 60 14 50 20S30 32 14 40' stroke='{BARK}' stroke-width='1.6' fill='none' stroke-linecap='round'/>"
        f"<path d='M62 13C66 20 66 26 62 32' stroke='{BARK}' stroke-width='1' fill='none' stroke-linecap='round'/>"
        + flower(72, 8, 1.05, fill='#fff6f9', stroke='#f9a8c9', rot=20)
        + flower(52, 19, 0.95, fill='#f9a8c9', stroke='#e8558a', rot=-15)
        + flower(62, 31, 0.8, fill='#fff6f9', stroke='#f9a8c9', rot=40)
        + flower(33, 30, 0.9, fill='#ffc7da', stroke='#e8558a', rot=5)
        + bud(18, 38, 0.8, rot=-70) + bud(42, 24, 0.75, rot=-110, fill='#fff0f5') + bud(80, 4, 0.7, rot=-20)
    ),
]

# ---- Uzay -------------------------------------------------------------------


def svg64(body, defs=''):
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs>{defs}</defs>{body}</svg>"


def twinkle(x, y, r=1.2, fill='#fff'):
    return f"<path d='M{x} {y - r * 2}L{x + r * 0.45} {y - r * 0.45}L{x + r * 2} {y}L{x + r * 0.45} {y + r * 0.45}L{x} {y + r * 2}L{x - r * 0.45} {y + r * 0.45}L{x - r * 2} {y}L{x - r * 0.45} {y - r * 0.45}Z' fill='{fill}'/>"


SPACE = [
    # 0 · Halkalı gezegen
    svg64(
        "<ellipse cx='34' cy='30' rx='27' ry='7.5' transform='rotate(-18 34 30)' fill='none' stroke='#c4b5fd' stroke-width='2.2' opacity='0.55'/>"
        "<circle cx='34' cy='30' r='14' fill='url(#p)'/>"
        "<path d='M22 25C28 23 40 23 46 26' stroke='#fff' stroke-width='1.2' fill='none' opacity='0.25'/>"
        "<path d='M21 33C28 35 40 35 47 32' stroke='#4c1d95' stroke-width='1.4' fill='none' opacity='0.35'/>"
        "<path d='M7.6 38.2A27 7.5 -18 0 0 60.4 21.8' transform='rotate(0)' fill='none' stroke='#ddd6fe' stroke-width='2.2' opacity='0.9'/>"
        + twinkle(10, 12, 1.3) + twinkle(56, 50, 1.0) + "<circle cx='52' cy='10' r='0.9' fill='#fff'/>",
        "<radialGradient id='p' cx='0.35' cy='0.3' r='0.8'><stop offset='0' stop-color='#f5d0fe'/><stop offset='0.45' stop-color='#a78bfa'/><stop offset='1' stop-color='#4c1d95'/></radialGradient>",
    ),
    # 1 · Hilal ay ve yıldızlar
    svg64(
        "<path d='M40 8A22 22 0 1 0 54 46A17 17 0 1 1 40 8Z' fill='url(#m)'/>"
        "<circle cx='28' cy='40' r='2.6' fill='#94a3b8' opacity='0.45'/><circle cx='22' cy='28' r='1.7' fill='#94a3b8' opacity='0.45'/>"
        "<circle cx='34' cy='50' r='1.4' fill='#94a3b8' opacity='0.4'/>"
        + twinkle(52, 14, 1.6) + twinkle(58, 30, 1.0) + "<circle cx='46' cy='22' r='0.9' fill='#fff'/>",
        "<linearGradient id='m' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fef9c3'/><stop offset='1' stop-color='#fcd34d'/></linearGradient>",
    ),
    # 2 · Roket
    svg64(
        "<g transform='rotate(40 32 32)'>"
        "<path d='M28 46L32 60L36 46Z' fill='url(#f)'/>"
        "<path d='M32 4C40 12 42 24 40 44H24C22 24 24 12 32 4Z' fill='#e2e8f0' stroke='#64748b' stroke-width='1'/>"
        "<path d='M32 4C36 8 38.5 12 39.5 16H24.5C25.5 12 28 8 32 4Z' fill='#f472b6'/>"
        "<circle cx='32' cy='24' r='4.2' fill='#38bdf8' stroke='#475569' stroke-width='1.2'/>"
        "<path d='M24 34L16 46L24 44Z' fill='#8b5cf6'/><path d='M40 34L48 46L40 44Z' fill='#8b5cf6'/>"
        "<path d='M30 44H34V48H30Z' fill='#475569'/></g>"
        + twinkle(10, 14, 1.2) + twinkle(54, 54, 1.0),
        "<linearGradient id='f' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fde047'/><stop offset='0.5' stop-color='#fb923c'/><stop offset='1' stop-color='#ef4444' stop-opacity='0'/></linearGradient>",
    ),
    # 3 · Uydu
    svg64(
        "<g transform='rotate(-25 32 32)'>"
        "<rect x='4' y='27' width='17' height='10' rx='1' fill='#3b82f6' stroke='#1e3a8a' stroke-width='0.8'/>"
        "<path d='M9.7 27V37M15.4 27V37M4 32H21' stroke='#93c5fd' stroke-width='0.6'/>"
        "<rect x='43' y='27' width='17' height='10' rx='1' fill='#3b82f6' stroke='#1e3a8a' stroke-width='0.8'/>"
        "<path d='M48.7 27V37M54.4 27V37M43 32H60' stroke='#93c5fd' stroke-width='0.6'/>"
        "<path d='M21 32H25M39 32H43' stroke='#94a3b8' stroke-width='1.6'/>"
        "<rect x='25' y='24' width='14' height='16' rx='2.5' fill='#e2e8f0' stroke='#64748b' stroke-width='1'/>"
        "<path d='M32 24V17' stroke='#94a3b8' stroke-width='1.2'/><path d='M27 17A5 3 0 0 0 37 17Z' fill='#cbd5e1' stroke='#64748b' stroke-width='0.8'/>"
        "<circle cx='32' cy='32' r='2.2' fill='#a78bfa'/></g>"
        + twinkle(54, 10, 1.3) + twinkle(10, 54, 1.0) + "<circle cx='14' cy='12' r='0.9' fill='#fff'/>",
    ),
    # 4 · Takımyıldız
    svg64(
        "<path d='M8 46L20 34L34 38L44 22L56 12M34 38L40 52' stroke='#c4b5fd' stroke-width='0.9' fill='none' stroke-dasharray='2 2' opacity='0.85'/>"
        + twinkle(8, 46, 1.5) + twinkle(20, 34, 1.9) + twinkle(34, 38, 1.4) + twinkle(44, 22, 2.2) + twinkle(56, 12, 1.6) + twinkle(40, 52, 1.3)
        + "<circle cx='44' cy='22' r='4.5' fill='#a78bfa' opacity='0.25'/><circle cx='20' cy='34' r='3.6' fill='#7dd3fc' opacity='0.25'/>",
    ),
]

SPARKLE = (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><defs><radialGradient id='s'>"
    "<stop offset='0' stop-color='#fff'/><stop offset='0.6' stop-color='#ddd6fe'/><stop offset='1' stop-color='#a78bfa'/></radialGradient></defs>"
    "<path d='M8 0L9.6 6.4L16 8L9.6 9.6L8 16L6.4 9.6L0 8L6.4 6.4Z' fill='url(#s)'/></svg>"
)


# ---- Uzay arka planı (ThemeDecor: köşedeki ay, ekranı geçen uydu) ---------------------
BIG_MOON = (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs>"
    "<radialGradient id='m' cx='0.38' cy='0.35' r='0.75'><stop offset='0' stop-color='#ffffff'/><stop offset='0.7' stop-color='#e2e8f0'/><stop offset='1' stop-color='#94a3b8'/></radialGradient>"
    "<radialGradient id='g'><stop offset='0.55' stop-color='#e0e7ff' stop-opacity='0.5'/><stop offset='1' stop-color='#e0e7ff' stop-opacity='0'/></radialGradient></defs>"
    "<circle cx='50' cy='50' r='48' fill='url(#g)'/><circle cx='50' cy='50' r='30' fill='url(#m)'/>"
    "<g fill='#94a3b8' opacity='0.45'><circle cx='40' cy='42' r='6'/><circle cx='60' cy='58' r='4.5'/><circle cx='56' cy='36' r='3'/>"
    "<circle cx='38' cy='62' r='3.5'/><circle cx='66' cy='46' r='2.2'/></g></svg>"
)
MINI_SAT = (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 20'>"
    "<rect x='1' y='6' width='12' height='8' rx='1' fill='#60a5fa' stroke='#1e3a8a' stroke-width='0.6'/>"
    "<rect x='27' y='6' width='12' height='8' rx='1' fill='#60a5fa' stroke='#1e3a8a' stroke-width='0.6'/>"
    "<path d='M13 10H27' stroke='#cbd5e1' stroke-width='1.4'/><rect x='15' y='4' width='10' height='12' rx='2' fill='#f1f5f9' stroke='#64748b' stroke-width='0.8'/>"
    "<circle cx='20' cy='10' r='1.8' fill='#a78bfa'/></svg>"
)

css = []
css.append("""/*
 * Klasör kartlarının köşe süsleri (Sakura ve Uzay paketleri, yalnızca "Dekoratif efektler" açıkken).
 * ÜRETİLMİŞ DOSYA: scripts/decor/card_decor.py üretir (npm run decor); elle düzenlemeyin. Köşe ve desen her klasör için kimliğinden türetilir
 * (FolderCard: data-decor-corner / data-decor-variant), böylece kartlar her açılışta aynı görünür.
 * Sol üst köşe hiç kullanılmaz: orada klasör simgesi durur.
 */

/* ---- Ortak: konum ---- */
html[data-decor='on']:is([data-pack='sakura'], [data-pack='space']) [data-decor-corner]::after {
  content: ''; position: absolute; pointer-events: none;
  background-position: center; background-size: contain; background-repeat: no-repeat;
}

/* ---- Sakura: dal/çiçek (köşeye göre aynalanır, dal hep karttan dışarı uzanır) ---- */
html[data-pack='sakura'][data-decor='on'] [data-decor-corner]::after { width: 76px; height: 54px; }
html[data-pack='sakura'][data-decor='on'] [data-decor-corner='tr']::after { top: -21px; right: -15px; }
html[data-pack='sakura'][data-decor='on'] [data-decor-corner='br']::after { bottom: -21px; right: -15px; transform: scaleY(-1); }
html[data-pack='sakura'][data-decor='on'] [data-decor-corner='bl']::after { bottom: -21px; left: -15px; transform: scale(-1, -1); }
""")
for i, svg in enumerate(SAKURA):
    css.append(f"html[data-pack='sakura'][data-decor='on'] [data-decor-variant='{i}']::after {{ background-image: {uri(svg)}; }}")

css.append("""
/* ---- Uzay: gezegen, ay, roket, uydu, takımyıldız (aynalanmaz; hafifçe süzülür) ---- */
html[data-pack='space'][data-decor='on'] [data-decor-corner]::after {
  width: 50px; height: 50px;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--ac-400) 55%, transparent));
  animation: tf-decor-float 7s ease-in-out infinite;
}
html[data-pack='space'][data-decor='on'] [data-decor-corner='tr']::after { top: -20px; right: -16px; }
html[data-pack='space'][data-decor='on'] [data-decor-corner='br']::after { bottom: -20px; right: -16px; animation-delay: -2.3s; }
html[data-pack='space'][data-decor='on'] [data-decor-corner='bl']::after { bottom: -20px; left: -16px; animation-delay: -4.6s; }
@keyframes tf-decor-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -3px; } }
""")
for i, svg in enumerate(SPACE):
    css.append(f"html[data-pack='space'][data-decor='on'] [data-decor-variant='{i}']::after {{ background-image: {uri(svg)}; }}")

# Açık ton: beyaz yıldızlar açık zeminde kaybolur; mor tonlarla yeniden boya.
SPACE_LIGHT = [
    svg.replace("fill='#fff'", "fill='#7c3aed'").replace("stroke='#c4b5fd'", "stroke='#7c3aed'")
    for svg in SPACE
]
css.append("/* Açık ton: yıldızlar ve çizgiler koyu mor */")
for i, svg in enumerate(SPACE_LIGHT):
    if svg != SPACE[i]:
        css.append(f"html[data-pack='space'][data-theme='light'][data-decor='on'] [data-decor-variant='{i}']::after {{ background-image: {uri(svg)}; }}")

css.append(f"""
/* ---- Uzay: klasör eklenince yıldız saçılması (PetalBurst'ün parçacıkları yıldıza döner) ---- */
html[data-pack='space'] .tf-burst-petal {{
  height: var(--s);
  background-image: {uri(SPARKLE)};
  filter: drop-shadow(0 0 4px rgb(196 181 253 / 0.9));
}}

/* ---- Uzay arka planı: ay ve ekranı boydan boya geçen uydu (ThemeDecor) ---- */
.tf-moon {{ background-image: {uri(BIG_MOON)}; }}
.tf-satellite {{ background-image: {uri(MINI_SAT)}; }}

@media (prefers-reduced-motion: reduce) {{
  html[data-pack='space'][data-decor='on'] [data-decor-corner]::after {{ animation: none; }}
}}
""")


def build() -> str:
    return '\n'.join(css)
