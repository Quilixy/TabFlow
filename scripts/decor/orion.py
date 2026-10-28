"""Uzay temasının Avcı (Orion) takımyıldızı: src/assets/orion-takimyildizi-astronomical.svg'den üretilir.

Kaynak dosyadaki görünür katmanlar alınır: takımyıldız çizgileri tek bir durağan arka plan olur, her yıldız
(hale + kırınım ışınları) ayrı küçük bir SVG olur. Yıldızlar uygulamada ayrı öğelerdir ve yalnızca
transform/opacity ile parıldar (GPU'da); SVG'lerin içinde animasyon yoktur. Kaynakta kapalı olan katmanlar
(bulutsu, arka plan yıldızları, etiketler, kayan yıldızlar, hedef halkaları) alınmaz.
"""
import copy
import re
import xml.etree.ElementTree as ET

from common import ROOT, uri

SOURCE = ROOT / 'src/assets/orion-takimyildizi-astronomical.svg'
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)

SPIKE_SCALE = 0.53  # kaynaktaki --spike-scale (ışınlar animasyonda bu ölçeğin çevresinde atar)
LINE_OPACITY = 0.35  # kaynakta 0.08; bu boyutta (≈130 px) görünmez kalıyordu
CROP = (100, 70, 470, 720)  # x, y, genişlik, yükseklik: yıldızların ve çizgilerin kapladığı bölge
GLOW = 5  # ışıma filtresinin taşma payı


def _q(tag):
    return f'{{{NS}}}{tag}'


def _parse():
    svg = ET.parse(SOURCE).getroot()
    style = svg.find(_q('style')).text
    variables = dict(re.findall(r'--([\w-]+):\s*([^;]+);', style))
    defs = {el.get('id'): el for el in svg.find(_q('defs')) if el.get('id')}
    layers = {el.get('id'): el for el in svg.iter(_q('g')) if el.get('id')}
    return variables, defs, layers


def _resolve(text, variables):
    return re.sub(r'var\(--([\w-]+)\)', lambda m: variables[m.group(1)].strip(), text)


def _refs(el):
    """Öğenin (ve alt öğelerinin) başvurduğu şablon kimlikleri."""
    found = set()
    for node in el.iter():
        for value in node.attrib.values():
            found.update(re.findall(r'url\(#([\w-]+)\)', value))
        href = node.get('href')
        if href and href.startswith('#'):
            found.add(href[1:])
    return found


def _with_defs(body_els, defs):
    """Gövdenin kullandığı şablonları (iç içe başvurular dahil) toplar."""
    need, queue = [], set().union(*(_refs(e) for e in body_els))
    while queue:
        ref = queue.pop()
        if ref in defs and ref not in need:
            need.append(ref)
            queue |= _refs(defs[ref]) - set(need)
    return [copy.deepcopy(defs[r]) for r in sorted(need)]


def _svg(view_box, body_els, defs, variables):
    root = ET.Element(_q('svg'), {'viewBox': view_box})
    d = ET.SubElement(root, _q('defs'))
    d.extend(_with_defs(body_els, defs))
    root.extend(body_els)
    return _resolve(ET.tostring(root, encoding='unicode'), variables)


def _translate(el):
    m = re.match(r'translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\)\s*(.*)', el.get('transform', ''))
    return float(m.group(1)), float(m.group(2)), m.group(3)


def _freeze(star):
    """Kaynaktaki animasyonların orta karesi: ışın grupları --spike-scale ölçeğinde, sınıflar atılır."""
    for node in star.iter():
        classes = (node.get('class') or '').split()
        if 'star-spike-group' in classes or 'star-spike-secondary' in classes:
            k = SPIKE_SCALE * (1 if 'star-spike-group' in classes else 0.92)
            node.set('transform', f'scale({k}) ' + node.get('transform', ''))
        node.attrib.pop('class', None)
    return star


def _radius(star):
    halo = [float(c.get('r')) for c in star.iter(_q('circle')) if 'halo' in (c.get('fill') or '')]
    return (max(halo) if halo else 16 * SPIKE_SCALE * 1.3) + GLOW


def build():
    """(çizgi arka planı, yıldızlar) döner. Yıldız: (sol %, üst %, genişlik %, CSS url değeri)."""
    variables, defs, layers = _parse()
    cx, cy, cw, ch = CROP

    lines = next(g for g in layers['constellation-lines-layer'] if g.get('filter'))  # ışımalı ana çizgiler
    lines_svg = _svg(f'{cx} {cy} {cw} {ch}', [copy.deepcopy(lines)], defs, variables)
    lines_svg = lines_svg.replace('<svg ', f"<svg opacity='{LINE_OPACITY}' ", 1)

    entries = []  # (x, y, ölçek, yıldız öğesi)
    for el in layers['major-stars-layer']:
        if el.get('id', '').startswith('star-'):
            x, y, rest = _translate(el)
            entries.append((x, y, 1.0, el))
        else:  # kalkan ve sopa: her biri küçük bir ışın, grup rengini taşır
            for g in el:
                x, y, rest = _translate(g)
                scale = float(re.search(r'scale\(([\d.]+)\)', rest).group(1)) if 'scale' in rest else 1.0
                wrapper = ET.Element(_q('g'), {'fill': el.get('fill')})
                wrapper.extend(copy.deepcopy(list(g)))
                entries.append((x, y, scale, wrapper))

    stars, cache = [], {}
    for x, y, scale, el in entries:
        star = _freeze(copy.deepcopy(el))
        star.attrib.pop('transform', None)
        star.attrib.pop('id', None)
        r = _radius(star)
        svg = _svg(f'{-r:g} {-r:g} {2 * r:g} {2 * r:g}', [star], defs, variables)
        value = cache.setdefault(svg, uri(svg))
        size = 2 * r * scale
        stars.append(((x - cx) / cw * 100, (y - cy) / ch * 100, size / cw * 100, value))
    return uri(lines_svg), stars, cw / ch
