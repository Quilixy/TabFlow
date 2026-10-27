import { describe, expect, it } from 'vitest';
import {
  addImportedTree,
  listBookmarkFolders,
  parseTabList,
  specFromBookmarks,
  specFromTabList,
  type BookmarkNode,
} from './externalImport';

describe('metinden içe aktarma (OneTab, adres listesi)', () => {
  it('OneTab satırlarını ve boş satırla ayrılmış grupları okur', () => {
    const text = [
      'https://a.com | A sitesi',
      'https://b.com | B | ek kısım',
      '',
      '',
      'https://c.com | C',
    ].join('\r\n');
    const { groups, skipped } = parseTabList(text);
    expect(groups.map((g) => g.map((p) => [p.url, p.title]))).toEqual([
      [
        ['https://a.com', 'A sitesi'],
        ['https://b.com', 'B | ek kısım'],
      ],
      [['https://c.com', 'C']],
    ]);
    expect(skipped).toBe(0);
  });

  it('düz adres listesini kabul eder; http(s) olmayanları atlar, tekrarı bir kez alır', () => {
    const { groups, skipped } = parseTabList('https://x.com\nchrome://settings\nnot a url\nhttps://x.com\njavascript:alert(1) | kötü');
    expect(groups).toEqual([[{ url: 'https://x.com', title: 'https://x.com', favIconUrl: null, pinned: false }]]);
    expect(skipped).toBe(3);
  });

  it('tek grup düz klasör, birden çok grup alt klasörler olur', () => {
    const one = specFromTabList('OneTab', parseTabList('https://a.com'), (i) => `Grup ${i}`);
    expect(one).toMatchObject({ name: 'OneTab', children: [] });
    const two = specFromTabList('OneTab', parseTabList('https://a.com\n\nhttps://b.com'), (i) => `Grup ${i}`);
    expect(two.children.map((c) => c.name)).toEqual(['Grup 1', 'Grup 2']);
  });
});

describe('yer imlerinden içe aktarma', () => {
  const tree: BookmarkNode[] = [
    {
      id: '0',
      title: '',
      children: [
        {
          id: '1',
          title: 'Yer imleri çubuğu',
          children: [
            { id: '10', title: 'Haber', url: 'https://haber.com' },
            {
              id: '11',
              title: 'İş',
              children: [
                { id: '110', title: 'Takvim', url: 'https://takvim.com' },
                { id: '111', title: 'Ayarlar', url: 'chrome://settings' },
                { id: '112', title: 'Boş', children: [] },
              ],
            },
          ],
        },
      ],
    },
  ];

  it('klasörleri derinlik ve web adresi sayısıyla listeler', () => {
    expect(listBookmarkFolders(tree).map((f) => [f.node.title, f.depth, f.links])).toEqual([
      ['Yer imleri çubuğu', 0, 2],
      ['İş', 1, 1],
      ['Boş', 2, 0],
    ]);
  });

  it('seçilen klasörü alt klasörleriyle dönüştürür; boş alt klasörü ve web dışı adresi atlar', () => {
    const { spec, skipped } = specFromBookmarks(tree[0].children![0], 'Yer imleri');
    expect(skipped).toBe(1);
    expect(spec.name).toBe('Yer imleri çubuğu');
    expect(spec.pages.map((p) => p.url)).toEqual(['https://haber.com']);
    expect(spec.children.map((c) => [c.name, c.pages.length, c.children.length])).toEqual([['İş', 1, 0]]);
  });

  it('ağacı tek seferde haritaya ekler', () => {
    const { spec } = specFromBookmarks(tree[0].children![0], 'Yer imleri');
    const { map, rootId, folders, tabs } = addImportedTree({}, spec, null, 7);
    expect([folders, tabs]).toEqual([2, 2]);
    expect(map[rootId].parentId).toBeNull();
    const child = Object.values(map).find((w) => w.parentId === rootId);
    expect(child?.name).toBe('İş');
    expect(child?.tabs[0].url).toBe('https://takvim.com');
  });
});
