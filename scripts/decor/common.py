"""Süs üreticilerinin ortak yardımcıları."""
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]


def uri(svg: str) -> str:
    """SVG'yi CSS url("data:...") değerine çevirir (boşluklar sıkıştırılır, gereken karakterler kaçırılır)."""
    svg = ' '.join(svg.split())
    return 'url("data:image/svg+xml,' + quote(svg, safe=" =:/'(),.-") + '")'
