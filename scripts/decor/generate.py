"""Tema süslerini üretir. Proje kökünden: npm run decor  (ya da: python scripts/decor/generate.py)

Yazılan dosyalar (hepsi commit'lenir; elle düzenlenmez):
  src/styles/card-decor.css          kart köşe süsleri (popup + tam ekran)
  src/styles/canvas-scene.css        tuval manzarası (yalnızca tam ekran)
  src/assets/uzay-galaksi-*.svg      Uzay galaksisi
  src/assets/sakura-dal-*.svg        kaynak: src/assets/sakura-saf-agac-oshima.svg
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import card_decor  # noqa: E402
import scene  # noqa: E402
import split_tree  # noqa: E402
from common import ROOT  # noqa: E402


def write(rel: str, text: str) -> None:
    path = ROOT / rel
    path.write_text(text, encoding='utf-8', newline='\n')
    print(f'{rel}  {len(text.encode()):,} bayt')


write('src/styles/card-decor.css', card_decor.build())
write('src/styles/canvas-scene.css', scene.build())
for name, svg in scene.galaxy_assets().items():
    write(f'src/assets/{name}', svg)
for path in split_tree.split(ROOT / 'src/assets/sakura-saf-agac-oshima.svg', ROOT / 'src/assets'):
    print(Path(path).relative_to(ROOT))
