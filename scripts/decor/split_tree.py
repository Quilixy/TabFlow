"""Sakura SVG'sini salınım gruplarına (üst/orta/alt dal) göre üç durağan SVG'ye böler.
Her parça aynı viewBox, stil ve şablonları taşır; üst üste konunca tek görselle aynı görünür."""
import copy
import re
import xml.etree.ElementTree as ET

NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
q = lambda tag: f'{{{NS}}}{tag}'  # noqa: E731

KEYS = ['upper', 'mid', 'lower']
NAMES = {'upper': '1-ust', 'mid': '2-orta', 'lower': '3-alt'}


def cls(el):
    return (el.get('class') or '').split()


def group_of(el):
    for k in KEYS:
        if f'kinematic-bough-{k}' in cls(el):
            return k
    return None


def y_of(el):
    m = re.search(r'translate\(\s*[-\d.]+\s*,\s*([-\d.]+)', el.get('transform') or '')
    return float(m.group(1)) if m else None


def band(y):
    return 'upper' if y < 200 else 'mid' if y < 470 else 'lower'


def shallow(el):
    c = ET.Element(el.tag, el.attrib)
    c.text, c.tail = el.text, el.tail
    return c


def filter_by_y(el, key):
    """Ayrıntı katmanı tek grupta toplanmış; öğeleri dikey konumlarına göre dala ata."""
    out = shallow(el)
    for ch in el:
        y = y_of(ch)
        if y is not None:
            if band(y) == key:
                out.append(copy.deepcopy(ch))
        else:
            sub = filter_by_y(ch, key)
            if len(sub):
                out.append(sub)
    return out


def part(key):
    new_root = shallow(root_g)
    for ch in root_g:
        g = group_of(ch)
        if g is not None:
            if g == key:
                new_root.append(copy.deepcopy(ch))
            continue
        if 'layer-micro-details' in cls(ch):
            sub = filter_by_y(ch, key)
        else:
            sub = shallow(ch)
            for gc in ch:
                if group_of(gc) == key:
                    sub.append(copy.deepcopy(gc))
        if len(sub):
            new_root.append(sub)
    out = ET.Element(svg.tag, svg.attrib)
    for ch in svg:
        if ch is root_g:
            out.append(new_root)
        elif ch.tag in (q('style'), q('defs')):
            out.append(copy.deepcopy(ch))
    # Erişilebilirlik bilgisi gereksiz: süs görseli
    for a in ('role', 'aria-label', 'id'):
        out.attrib.pop(a, None)
    return out



def split(src, out_dir) -> list[str]:
    """src'yi üç parçaya böler, out_dir/sakura-dal-*.svg olarak yazar; yazılan yolları döner."""
    global svg, root_g
    svg = ET.parse(src).getroot()
    root_g = svg.find(q('g'))
    written = []
    for k in KEYS:
        xml = ET.tostring(part(k), encoding='unicode')
        # Stil #sakura-panel-svg'ye bağlı değişkenleri kullanıyor; kök seçicisini :root yap
        xml = xml.replace('#sakura-panel-svg {', ':root {')
        path = f'{out_dir}/sakura-dal-{NAMES[k]}.svg'
        open(path, 'w', encoding='utf-8', newline='\n').write('<?xml version="1.0" encoding="UTF-8"?>\n' + xml + '\n')
        written.append(path)
    return written
