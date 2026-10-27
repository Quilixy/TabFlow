import { describe, expect, it } from 'vitest';
import type { PreviewRow } from './workspaceTree';
import {
  arrangeGrid,
  boundsOf,
  DEFAULT_VIEW,
  estimateFolderCardHeight,
  fitView,
  MAX_SCALE,
  MIN_SCALE,
  pinchView,
  resolveOverlaps,
  screenToWorld,
  zoomAt,
} from './canvasMath';

describe('zoomAt', () => {
  it('imlecin altındaki dünya noktasını sabit tutar', () => {
    const view = { x: 24, y: 24, scale: 1 };
    const before = screenToWorld(view, 300, 200);
    const after = screenToWorld(zoomAt(view, 1.5, 300, 200), 300, 200);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('ölçeği alt ve üst sınırda tutar', () => {
    const view = { x: 0, y: 0, scale: 1 };
    expect(zoomAt(view, 100, 0, 0).scale).toBe(MAX_SCALE);
    expect(zoomAt(view, 0.0001, 0, 0).scale).toBe(MIN_SCALE);
  });

  it('sınırdayken görünümü değiştirmez', () => {
    const view = { x: 5, y: 5, scale: MAX_SCALE };
    expect(zoomAt(view, 2, 10, 10)).toBe(view);
  });
});

describe('boundsOf', () => {
  it('boş listede null döner, doluyken kapsayan dikdörtgeni verir', () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        { x: 10, y: 20, w: 100, h: 50 },
        { x: 200, y: 0, w: 40, h: 40 },
      ]),
    ).toEqual({ x: 10, y: 0, w: 230, h: 70 });
  });
});

describe('fitView', () => {
  const viewport = { width: 1000, height: 600 };

  it('içerik yoksa varsayılan görünümü verir', () => {
    expect(fitView(null, viewport)).toBe(DEFAULT_VIEW);
    expect(fitView({ x: 0, y: 0, w: 10, h: 10 }, { width: 0, height: 0 })).toBe(DEFAULT_VIEW);
  });

  it('küçük içerikte ölçek 1 kalır ve yatayda ortalanır', () => {
    const view = fitView({ x: 32, y: 32, w: 200, h: 100 }, viewport);
    expect(view.scale).toBe(1);
    // ortalanmış: sol boşluk = sağ boşluk
    const left = 32 * view.scale + view.x;
    const right = viewport.width - (left + 200 * view.scale);
    expect(left).toBeCloseTo(right, 6);
    expect(32 * view.scale + view.y).toBeCloseTo(32, 6); // üstten dolgu
  });

  it('sığmayan içerikte okunur minimum ölçeği korur ve sol-üstten başlar', () => {
    const view = fitView({ x: 32, y: 32, w: 5000, h: 4000 }, viewport);
    expect(view.scale).toBe(0.5);
    expect(32 * view.scale + view.x).toBeCloseTo(32, 6);
    expect(32 * view.scale + view.y).toBeCloseTo(32, 6);
  });

  it('orta büyüklükte içeriği küçülterek tamamen görünür yapar', () => {
    const view = fitView({ x: 0, y: 0, w: 1800, h: 500 }, viewport);
    expect(view.scale).toBeCloseTo((1000 - 64) / 1800, 6);
    expect(1800 * view.scale + 2 * (view.x)).toBeCloseTo(1800 * view.scale + 64, 6);
  });
});

describe('estimateFolderCardHeight', () => {
  const tab = (id: string): PreviewRow => ({
    kind: 'tab',
    key: id,
    depth: 0,
    tab: { id, url: 'https://x', title: 'x', favIconUrl: null, pinned: false, x: 0, y: 0 },
  });
  const folder: PreviewRow = {
    kind: 'folder',
    key: 'f',
    depth: 0,
    folder: { id: 'f', name: 'f', createdAt: 0, updatedAt: 0, parentId: null, x: 0, y: 0, tabs: [] },
  };
  const more: PreviewRow = { kind: 'more', key: 'm', depth: 0, count: 3 };

  it('boş klasörde "Boş klasör" notu kadar yer ayırır', () => {
    expect(estimateFolderCardHeight([])).toBe(26 + 40 + 12 + 16);
  });

  it('satır türüne göre toplar: sekme 20, klasör 16, "+N daha" 17, satır arası 6', () => {
    expect(estimateFolderCardHeight([tab('a')])).toBe(26 + 40 + 12 + 20);
    // klasör + 2 sekme + daha: 16 + 20 + 20 + 17 = 73, 3 aralık = 18
    expect(estimateFolderCardHeight([folder, tab('a'), tab('b'), more])).toBe(26 + 40 + 12 + 73 + 18);
  });

  it('uzun ad 2 satıra sarar ve kartı uzatır', () => {
    expect(estimateFolderCardHeight([tab('a')], 'Çok uzun bir klasör adı')).toBe(estimateFolderCardHeight([tab('a')], 'Kısa') + 19);
  });
});

describe('resolveOverlaps', () => {
  const card = (id: string, x: number, y: number, h: number) => ({ id, x, y, w: 200, h });

  it('çakışan kartı altına iter, yan yana olanlara dokunmaz', () => {
    const result = resolveOverlaps([card('a', 0, 0, 100), card('b', 0, 50, 80), card('c', 300, 0, 100)]);
    expect(result.a).toEqual({ x: 0, y: 0 });
    expect(result.b).toEqual({ x: 0, y: 116 }); // a'nın altı (100) + boşluk (16)
    expect(result.c).toEqual({ x: 300, y: 0 }); // yatayda ayrı: etkilenmez
  });

  it('zincirleme itme: iten kart bir sonrakini de iter', () => {
    const result = resolveOverlaps([card('a', 0, 0, 100), card('b', 0, 60, 100), card('c', 0, 130, 100)]);
    expect(result.b.y).toBe(116);
    expect(result.c.y).toBe(116 + 100 + 16);
  });

  it('zaten ayrık yerleşimi değiştirmez ve tekrar uygulanınca aynı sonucu verir', () => {
    const items = [card('a', 0, 0, 100), card('b', 0, 200, 100), card('c', 400, 10, 50)];
    const once = resolveOverlaps(items);
    expect(once).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 200 }, c: { x: 400, y: 10 } });
    const pushed = resolveOverlaps([card('a', 0, 0, 100), card('b', 0, 20, 100)]);
    const again = resolveOverlaps([card('a', 0, 0, 100), { ...card('b', 0, 20, 100), y: pushed.b.y }]);
    expect(again).toEqual(pushed);
  });
});

describe('arrangeGrid', () => {
  it('satır yüksekliği o satırdaki en uzun karta göre belirlenir', () => {
    const result = arrangeGrid(
      [
        { id: 'a', h: 100 },
        { id: 'b', h: 240 },
        { id: 'c', h: 80 },
        { id: 'd', h: 80 },
        { id: 'e', h: 60 }, // ikinci satıra düşer
      ],
      { cols: 4 },
    );
    expect(result.a).toEqual({ x: 32, y: 32 });
    expect(result.d).toEqual({ x: 32 + 3 * 272, y: 32 });
    expect(result.e).toEqual({ x: 32, y: 32 + 240 + 20 });
  });
});
describe('pinchView', () => {
  const start = { x: 0, y: 0, scale: 1 };

  it('parmaklar açılınca orta nokta etrafında yakınlaştırır (orta nokta yerinde kalır)', () => {
    const v = pinchView(start, { x: 100, y: 100 }, 100, { x: 100, y: 100 }, 150);
    expect(v.scale).toBeCloseTo(1.5);
    // Dünya noktası (100,100) ekranda hâlâ (100,100)
    expect(100 * v.scale + v.x).toBeCloseTo(100);
    expect(100 * v.scale + v.y).toBeCloseTo(100);
  });

  it('orta nokta kayınca görünümü de kaydırır', () => {
    const v = pinchView(start, { x: 100, y: 100 }, 100, { x: 130, y: 90 }, 100);
    expect(v).toEqual({ x: 30, y: -10, scale: 1 });
  });

  it('ölçek sınırlarına takılır ama kaydırma sürer', () => {
    const v = pinchView({ x: 0, y: 0, scale: 2 }, { x: 0, y: 0 }, 100, { x: 10, y: 0 }, 400);
    expect(v.scale).toBe(2);
    expect(v.x).toBe(10);
  });
});
