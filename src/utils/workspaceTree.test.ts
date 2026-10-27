import { describe, expect, it } from 'vitest';
import type { Workspace } from '../types';
import { normalizeQuery } from './search';
import {
  buildChildrenIndex,
  buildFolderPreview,
  canReparent,
  collectSubtree,
  computeVisibleIds,
  countSubtreeItems,
  countTabs,
  flattenTree,
  normalizeWorkspaces,
  PREVIEW_DEEP,
  PREVIEW_SHALLOW,
  pathLabel,
  shareStructure,
  siblingItemCount,
  toFolderRefs,
} from './workspaceTree';

const tab = (id: string, title: string) => ({
  id,
  url: `https://${id}.example`,
  title,
  favIconUrl: null,
  pinned: false,
  x: 0,
  y: 0,
});

const folder = (id: string, name: string, parentId: string | null, createdAt: number, tabs = [] as ReturnType<typeof tab>[]) =>
  ({ id, name, parentId, createdAt, updatedAt: createdAt, x: 0, y: 0, tabs }) satisfies Workspace;

const sample = () =>
  normalizeWorkspaces({
    r1: folder('r1', 'Staj', null, 1, [tab('t1', 'Başvuru formu')]),
    r2: folder('r2', 'Alışveriş', null, 2),
    c1: folder('c1', 'Başvurular', 'r1', 3),
    c2: folder('c2', 'Mülakat', 'c1', 4),
  });

describe('normalizeWorkspaces', () => {
  it('v1 verisini (parentId/x/y/sekme id yok) geçerli v2 şekline getirir', () => {
    const result = normalizeWorkspaces({
      a: { id: 'a', name: 'Staj', createdAt: 1, tabs: [{ url: 'https://x.com', title: 'X' }, { url: 'https://y.com', title: 'Y', pinned: true }] },
      b: { id: 'b', name: 'Alışveriş', createdAt: 2, tabs: [] },
    });
    expect(result.a.parentId).toBeNull();
    expect(result.a.tabs[0].id).toBe('a:0');
    expect(result.a.tabs[1].id).toBe('a:1');
    expect(result.a.tabs[1].pinned).toBe(true);
    expect([result.a.x, result.a.y]).toEqual([32, 32]);
    expect([result.b.x, result.b.y]).toEqual([32 + 272, 32]);
    expect(result.a.updatedAt).toBe(1);
  });

  it('idempotenttir: normalize(normalize(x)) aynı sonucu verir', () => {
    const once = sample();
    expect(normalizeWorkspaces(once)).toEqual(once);
  });

  it('bozuk girdide boş harita döner', () => {
    expect(normalizeWorkspaces(null)).toEqual({});
    expect(normalizeWorkspaces('x')).toEqual({});
  });

  it('yetim ve kendine bağlı üst klasörleri köke taşır', () => {
    const result = normalizeWorkspaces({
      p: folder('p', 'P', 'ghost', 1),
      self: folder('self', 'S', 'self', 2),
    });
    expect(result.p.parentId).toBeNull();
    expect(result.self.parentId).toBeNull();
  });

  it('üst-alt döngülerini kırar', () => {
    const result = normalizeWorkspaces({
      c1: folder('c1', 'C1', 'c2', 1),
      c2: folder('c2', 'C2', 'c1', 2),
    });
    for (const id of ['c1', 'c2']) {
      const seen = new Set<string>();
      let current = result[id].parentId;
      while (current !== null) {
        expect(seen.has(current)).toBe(false);
        seen.add(current);
        current = result[current].parentId;
      }
    }
  });

  it('döngüye bağlanan ama döngüde olmayan klasörün üst bağını korur', () => {
    const result = normalizeWorkspaces({
      x: folder('x', 'X', 'a', 1),
      a: folder('a', 'A', 'b', 2),
      b: folder('b', 'B', 'a', 3),
    });
    expect(result.x.parentId).toBe('a');
    expect([result.a.parentId, result.b.parentId]).toContain(null);
  });

  it('yalnızca http(s) simge adreslerini saklar (data: base64 atılır)', () => {
    const result = normalizeWorkspaces({
      a: folder('a', 'A', null, 1, [
        { ...tab('t1', 'Bir'), favIconUrl: 'data:image/png;base64,AAAA' as unknown as null },
        { ...tab('t2', 'İki'), favIconUrl: 'https://x.com/f.ico' as unknown as null },
      ]),
    });
    expect(result.a.tabs.map((t) => t.favIconUrl)).toEqual([null, 'https://x.com/f.ico']);
  });
});

describe('shareStructure', () => {
  it('değişmeyen klasör ve sekmeleri önceki nesnelerle paylaşır', () => {
    const prev = sample();
    const next = normalizeWorkspaces(JSON.parse(JSON.stringify(prev)));
    expect(shareStructure(prev, next)).toBe(prev);
  });

  it('yalnızca değişen klasör yeni nesne olur', () => {
    const prev = sample();
    const raw = JSON.parse(JSON.stringify(prev));
    raw.r2.name = 'Market';
    const shared = shareStructure(prev, normalizeWorkspaces(raw));
    expect(shared).not.toBe(prev);
    expect(shared.r1).toBe(prev.r1);
    expect(shared.r1.tabs[0]).toBe(prev.r1.tabs[0]);
    expect(shared.r2).not.toBe(prev.r2);
    expect(shared.r2.name).toBe('Market');
  });

  it('silinen klasörü fark eder', () => {
    const prev = sample();
    const raw = JSON.parse(JSON.stringify(prev));
    delete raw.r2;
    const shared = shareStructure(prev, normalizeWorkspaces(raw));
    expect(shared).not.toBe(prev);
    expect(shared.r2).toBeUndefined();
  });
});

describe('ağaç yardımcıları', () => {
  it('çocukları ada göre sıralar ve yol etiketini üretir', () => {
    const map = sample();
    const index = buildChildrenIndex(map);
    expect((index.get(null) ?? []).map((w) => w.name)).toEqual(['Alışveriş', 'Staj']);
    expect(pathLabel(map, 'c2')).toBe('Staj / Başvurular / Mülakat');
  });

  it('alt ağacı ve sekme sayısını toplar', () => {
    const map = sample();
    const subtree = collectSubtree(buildChildrenIndex(map), map, 'r1');
    expect(subtree.map((w) => w.id)).toEqual(['r1', 'c1', 'c2']);
    expect(countTabs(subtree)).toBe(1);
  });

  it('klasörün kendi torununa taşınmasını reddeder', () => {
    const map = sample();
    expect(canReparent(map, 'r1', 'c2')).toBe(false);
    expect(canReparent(map, 'r1', 'r1')).toBe(false);
    expect(canReparent(map, 'c2', null)).toBe(true);
    expect(canReparent(map, 'c2', 'r2')).toBe(true);
  });

  it('tuvaldaki öğe sayısını (klasör + sekme) sayar', () => {
    const map = sample();
    expect(siblingItemCount(map, null)).toBe(2);
    expect(siblingItemCount(map, 'r1')).toBe(2); // c1 + t1
  });

  it('klasör referanslarını yol adıyla sıralı verir', () => {
    expect(toFolderRefs(sample()).map((f) => f.name)).toEqual([
      'Alışveriş',
      'Staj',
      'Staj / Başvurular',
      'Staj / Başvurular / Mülakat',
    ]);
  });
});

describe('flattenTree ve arama', () => {
  it('kapalıyken yalnızca kökleri, açıkken çocukları listeler', () => {
    const index = buildChildrenIndex(sample());
    expect(flattenTree(index, {}, null, false).map((r) => r.workspace.id)).toEqual(['r2', 'r1']);
    expect(
      flattenTree(index, { r1: true }, null, false).map((r) => [r.workspace.id, r.depth]),
    ).toEqual([['r2', 0], ['r1', 0], ['c1', 1]]);
  });

  it('aramada eşleşenleri ve üstlerini gösterir, hepsini açar', () => {
    const map = sample();
    const index = buildChildrenIndex(map);
    expect([...(computeVisibleIds(map, normalizeQuery('başvuru formu')) ?? [])].sort()).toEqual(['r1']);
    const visible = computeVisibleIds(map, normalizeQuery('Mülakat'));
    expect([...(visible ?? [])].sort()).toEqual(['c1', 'c2', 'r1']);
    expect(flattenTree(index, {}, visible, true).map((r) => [r.workspace.id, r.depth])).toEqual([
      ['r1', 0],
      ['c1', 1],
      ['c2', 2],
    ]);
    expect(computeVisibleIds(map, '')).toBeNull();
  });
});

describe('klasör rengi ve simgesi', () => {
  it('geçerli değerleri korur, geçersizleri atar', () => {
    const result = normalizeWorkspaces({
      a: { ...folder('a', 'A', null, 1), color: 'emerald', icon: 'star' },
      b: { ...folder('b', 'B', null, 2), color: 'neon', icon: '<script>' },
      c: { ...folder('c', 'C', null, 3), color: 'toString', icon: 'constructor' },
    });
    expect(result.a.color).toBe('emerald');
    expect(result.a.icon).toBe('star');
    expect(result.b.color).toBeUndefined();
    expect(result.b.icon).toBeUndefined();
    expect(result.c.color).toBeUndefined();
    expect(result.c.icon).toBeUndefined();
  });

  it('stil alanlarıyla da idempotenttir', () => {
    const once = normalizeWorkspaces({ a: { ...folder('a', 'A', null, 1), color: 'rose', icon: 'code' } });
    expect(normalizeWorkspaces(once)).toEqual(once);
  });
});

describe('klasör kartı önizlemesi (iç içe)', () => {
  // Learning ─┬─ C#    (3 sekme)
  //           └─ React (1 sekme)
  const learning = () =>
    normalizeWorkspaces({
      l: folder('l', 'Learning', null, 1),
      c: folder('c', 'C#', 'l', 2, [tab('c1', 'C# 1'), tab('c2', 'C# 2'), tab('c3', 'C# 3')]),
      r: folder('r', 'React', 'l', 3, [tab('r1', 'React 1')]),
    });
  const summarize = (rows: ReturnType<typeof buildFolderPreview>) =>
    rows.map((row) => `${row.depth}:${row.kind === 'tab' ? row.tab.title : row.kind === 'folder' ? '[' + row.folder.name + ']' : '+' + row.count}`);

  it('alt klasörlerin içeriğini girintili gösterir ve sığmayanı "+N daha" yapar', () => {
    const map = learning();
    const index = buildChildrenIndex(map);
    expect(countSubtreeItems(index, map, 'l')).toBe(6); // 2 klasör + 4 sekme
    // C# yalnızca 2 sekme gösterir (maxTabsNested), 1 tanesi "+1 daha" olur
    expect(summarize(buildFolderPreview(index, map, 'l', PREVIEW_DEEP))).toEqual([
      '0:[C#]',
      '1:C# 1',
      '1:C# 2',
      '0:[React]',
      '1:React 1',
      '0:+1',
    ]);
  });

  it('kapalı modda yalnızca kartın kendi sekmeleri ve alt klasör adlarını verir', () => {
    const map = learning();
    const index = buildChildrenIndex(map);
    expect(summarize(buildFolderPreview(index, map, 'l', PREVIEW_SHALLOW))).toEqual(['0:[C#]', '0:[React]', '0:+4']);
  });

  it('satır sınırını aşmaz ve her şey sığıyorsa "daha" satırı eklemez', () => {
    const map = learning();
    const index = buildChildrenIndex(map);
    const tight = buildFolderPreview(index, map, 'l', { ...PREVIEW_DEEP, maxRows: 3 });
    expect(tight).toHaveLength(3);
    expect(summarize(tight)[2]).toBe('0:+4');
    const roomy = buildFolderPreview(index, map, 'r', PREVIEW_DEEP); // tek sekmeli klasör
    expect(summarize(roomy)).toEqual(['0:React 1']);
  });

  it('boş klasörde satır yoktur', () => {
    const map = normalizeWorkspaces({ e: folder('e', 'Boş', null, 1) });
    expect(buildFolderPreview(buildChildrenIndex(map), map, 'e', PREVIEW_DEEP)).toEqual([]);
  });
});
