import type { Point } from '../types';
import { CELL_W, GRID_COLS, type PreviewRow } from './workspaceTree';

export interface View {
  x: number; // Ekran çevirisi (px)
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2;
export const DEFAULT_VIEW: View = { x: 24, y: 24, scale: 1 };

export const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** (px, py) ekran noktasının altındaki dünya noktasını sabit tutarak yakınlaştırır. */
export function zoomAt(view: View, factor: number, px: number, py: number): View {
  const scale = clampScale(view.scale * factor);
  if (scale === view.scale) return view;
  const wx = (px - view.x) / view.scale;
  const wy = (py - view.y) / view.scale;
  return { scale, x: px - wx * scale, y: py - wy * scale };
}

/**
 * İki parmakla yakınlaştırma: başlangıç görünümünden, parmak arası uzaklığın oranı kadar başlangıç orta noktası
 * etrafında yakınlaştırır ve orta noktanın kayması kadar kaydırır. Uzaklıklar ekran pikseli.
 */
export function pinchView(start: View, startMid: Point, startDistance: number, mid: Point, distance: number): View {
  const zoomed = startDistance > 0 ? zoomAt(start, distance / startDistance, startMid.x, startMid.y) : start;
  return { ...zoomed, x: zoomed.x + (mid.x - startMid.x), y: zoomed.y + (mid.y - startMid.y) };
}

export function screenToWorld(view: View, px: number, py: number): Point {
  return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
}

/** Kart boyutları (px, dünya koordinatı). Izgara/sığdırma hesapları bunlara dayanır. */
export const TAB_CARD_W = 240;
export const TAB_CARD_H = 76;
export const FOLDER_CARD_W = 220;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * İçeriği görünür alana sığdırır. Hepsi okunur bir ölçekte (>= minScale) sığıyorsa yatayda ortalar;
 * sığmıyorsa okunabilirliği korur ve içeriğin sol-üstünden başlar (gerisi kaydırılır).
 */
export function fitView(
  bounds: Rect | null,
  viewport: { width: number; height: number },
  options: { padding?: number; minScale?: number; maxScale?: number } = {},
): View {
  if (!bounds || viewport.width <= 0 || viewport.height <= 0) return DEFAULT_VIEW;
  const padding = options.padding ?? 32;
  const minScale = options.minScale ?? 0.5;
  const maxScale = options.maxScale ?? 1;

  const fit = Math.min((viewport.width - padding * 2) / bounds.w, (viewport.height - padding * 2) / bounds.h);
  const scale = clampScale(Math.min(maxScale, Math.max(minScale, fit)));

  const contentW = bounds.w * scale;
  const x =
    contentW + padding * 2 <= viewport.width
      ? (viewport.width - contentW) / 2 - bounds.x * scale
      : padding - bounds.x * scale;
  const y = padding - bounds.y * scale;
  return { x, y, scale };
}

/**
 * Klasör kartı boyutları (px), FolderCard'ın Tailwind sınıflarından: p-3 + kenarlık = 26, simge kutusu h-10 = 40
 * (2 satırlık adda ~59), önizleme listesi mt-3 = 12, satırlar arası 6. Satır yüksekliği türüne göre değişir
 * (sekme 20: favicon, klasör 16, "+N daha" ~17). Tarayıcıda ölçülen değerlerle ±5px içinde tutuyor.
 * FolderCard'ın dolgusu/boşlukları değişirse bu sabitler de güncellenmeli.
 */
const CARD_FRAME_H = 26;
const CARD_HEADER_H = 40;
const CARD_HEADER_TWO_LINE_H = 59;
/** Kartın ad sütununa (~106px) sığan yaklaşık karakter sayısı; fazlası 2 satıra sarar (line-clamp-2). */
const NAME_CHARS_PER_LINE = 14;
const PREVIEW_TOP_GAP_H = 12;
const PREVIEW_ROW_GAP_H = 6;
const EMPTY_NOTE_H = 16;
const PREVIEW_ROW_H: Record<PreviewRow['kind'], number> = { tab: 20, folder: 16, more: 17 };

/** Önizleme satırlarından ve addan kartın (yaklaşık) yüksekliği. Yerleşim ve sığdırma hesapları için. */
export function estimateFolderCardHeight(rows: PreviewRow[], name = ''): number {
  const header = name.length > NAME_CHARS_PER_LINE ? CARD_HEADER_TWO_LINE_H : CARD_HEADER_H;
  const list =
    rows.length === 0
      ? EMPTY_NOTE_H // "Boş klasör" notu
      : rows.reduce((sum, row) => sum + PREVIEW_ROW_H[row.kind], 0) + PREVIEW_ROW_GAP_H * (rows.length - 1);
  return CARD_FRAME_H + header + PREVIEW_TOP_GAP_H + list;
}

export interface LayoutItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Kartlar birbirinin üstüne binmesin: yukarıdan aşağıya sıralayıp, bir öncekilerle çakışan kartı
 * çakıştığı kartın altına iter. Yalnızca gösterim içindir (depodaki konumlar değişmez).
 * Yatayda yan yana duran kartlar etkilenmez. Tekrar uygulanınca aynı sonucu verir.
 */
export function resolveOverlaps(items: LayoutItem[], gap = 16): Record<string, Point> {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1));
  const placed: LayoutItem[] = [];
  const result: Record<string, Point> = {};

  for (const item of sorted) {
    let y = item.y;
    for (;;) {
      const blocker = placed.find(
        (p) => item.x < p.x + p.w && p.x < item.x + item.w && y < p.y + p.h + gap && p.y < y + item.h + gap,
      );
      if (!blocker) break;
      y = blocker.y + blocker.h + gap;
    }
    placed.push({ ...item, y });
    result[item.id] = { x: item.x, y };
  }
  return result;
}

/** Öğeleri satır satır ızgaraya dizer; her satırın yüksekliği o satırdaki en uzun kart kadardır. */
export function arrangeGrid(
  items: { id: string; h: number }[],
  options: { cols?: number; cellWidth?: number; pad?: number; gapY?: number } = {},
): Record<string, Point> {
  const cols = options.cols ?? GRID_COLS;
  const cellWidth = options.cellWidth ?? CELL_W;
  const pad = options.pad ?? 32;
  const gapY = options.gapY ?? 20;

  const positions: Record<string, Point> = {};
  let y = pad;
  for (let start = 0; start < items.length; start += cols) {
    const row = items.slice(start, start + cols);
    row.forEach((item, column) => {
      positions[item.id] = { x: pad + column * cellWidth, y };
    });
    y += Math.max(...row.map((item) => item.h)) + gapY;
  }
  return positions;
}