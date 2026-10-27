import { describe, expect, it } from 'vitest';
import type { Workspace, WorkspaceMap } from '../types';
import { escapeXml, folderIdFromContent, MAX_SUGGESTIONS, omniboxSuggestions } from './omnibox';

const folder = (id: string, name: string, tabs: [string, string][] = [], parentId: string | null = null): Workspace => ({
  id,
  name,
  createdAt: 1,
  updatedAt: 1,
  parentId,
  x: 0,
  y: 0,
  tabs: tabs.map(([url, title], i) => ({ id: `${id}${i}`, url, title, favIconUrl: null, pinned: false, x: 0, y: 0 })),
});

const map: WorkspaceMap = {
  a: folder('a', 'İş', [['https://takvim.com', 'Takvim <ekip>']]),
  b: folder('b', 'İstanbul gezisi', [['https://muze.com', 'Müze & saraylar']], 'a'),
  c: folder('c', 'Okuma', [['https://muze.com', 'Müze (kopya)']]),
};

describe('adres çubuğu önerileri', () => {
  it('önce adı eşleşen klasörleri, sonra sekmeleri önerir (Türkçe karakterlere duyarsız)', () => {
    const items = omniboxSuggestions(map, 'istanbul');
    expect(items[0].content).toBe('tabflow-folder:b');
    expect(items[0].description).toContain('İş / İstanbul gezisi');
  });

  it('sekme önerisi adresi açar; aynı adres bir kez önerilir', () => {
    const items = omniboxSuggestions(map, 'muze');
    expect(items.map((i) => i.content)).toEqual(['https://muze.com']);
  });

  it('metni XML olarak kaçışlar', () => {
    const [item] = omniboxSuggestions(map, 'takvim');
    expect(item.description).toContain('Takvim &lt;ekip&gt;');
    expect(escapeXml(`a&b"c'`)).toBe('a&amp;b&quot;c&apos;');
  });

  it('boş aramada öneri yok; sınırı aşmaz', () => {
    expect(omniboxSuggestions(map, '   ')).toEqual([]);
    const many: WorkspaceMap = {
      x: folder('x', 'Liste', Array.from({ length: 20 }, (_, i) => [`https://s${i}.com`, `Sayfa ${i}`] as [string, string])),
    };
    expect(omniboxSuggestions(many, 'sayfa')).toHaveLength(MAX_SUGGESTIONS);
    const folders: WorkspaceMap = { p: folder('p', 'Proje A'), q: folder('q', 'Proje B'), r: folder('r', 'Proje C') };
    expect(omniboxSuggestions(folders, 'proje', 1)).toHaveLength(1);
  });

  it('klasör içeriğinden kimliği çıkarır', () => {
    expect(folderIdFromContent('tabflow-folder:b')).toBe('b');
    expect(folderIdFromContent('https://x.com')).toBeNull();
  });
});
