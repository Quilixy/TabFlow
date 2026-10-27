import { describe, expect, it } from 'vitest';
import type { Workspace } from '../types';
import { backupFileName, createBackup, mergeWorkspaces, parseBackup, serializeBackup, undoImport } from './backup';
import { normalizeWorkspaces } from './workspaceTree';

const ws = (id: string, name: string, updatedAt: number, parentId: string | null = null, urls: string[] = []): Workspace => ({
  id,
  name,
  createdAt: 1,
  updatedAt,
  parentId,
  x: 32,
  y: 32,
  tabs: urls.map((url, i) => ({ id: `${id}-${i}`, url, title: url, favIconUrl: null, pinned: false, x: 0, y: 0 })),
});

describe('yedek dosyası', () => {
  it('dışa aktarılan dosya aynen geri okunur', () => {
    const map = normalizeWorkspaces({ a: ws('a', 'Staj', 5, null, ['https://x.com']) });
    const text = serializeBackup(createBackup(map, new Date('2026-10-16T10:00:00Z')));
    const parsed = parseBackup(text);
    expect(parsed.workspaces).toEqual(map);
    expect(parsed.skippedFolders).toBe(0);
    expect(parsed.skippedTabs).toBe(0);
  });

  it('dosya adı tarih içerir', () => {
    expect(backupFileName(new Date('2026-10-16T10:00:00Z'))).toBe('tabflow-yedek-2026-10-16.json');
  });

  it('çıplak (eski v1) depo haritasını da kabul eder', () => {
    const parsed = parseBackup(JSON.stringify({ a: { id: 'a', name: 'Eski', createdAt: 1, tabs: [{ url: 'https://x.com', title: 'X' }] } }));
    expect(parsed.workspaces.a.tabs[0].id).toBe('a:0');
  });

  it('geçersiz JSON ve tanınmayan içerik için anlaşılır hata verir', () => {
    expect(() => parseBackup('{bozuk')).toThrow('geçerli bir JSON değil');
    expect(() => parseBackup('[1,2]')).toThrow('tanınmadı');
    expect(() => parseBackup('{"app":"TabFlow"}')).toThrow('klasör bulunamadı');
  });

  it('güvenilmez veriyi eler: yalnızca http(s) sekmeler, geçersiz klasörler atlanır', () => {
    const parsed = parseBackup(
      JSON.stringify({
        workspaces: {
          a: {
            name: 'Karışık',
            tabs: [
              { url: 'https://iyi.com', title: 'İyi', favIconUrl: 'javascript:alert(1)' },
              { url: 'javascript:alert(1)', title: 'Kötü' },
              { url: 'chrome://settings', title: 'Ayarlar' },
              { title: 'URL yok' },
            ],
          },
          b: 'klasör değil',
          c: { name: 'sekme listesi yok' },
        },
      }),
    );
    expect(Object.keys(parsed.workspaces)).toEqual(['a']);
    expect(parsed.workspaces.a.tabs).toHaveLength(1);
    expect(parsed.workspaces.a.tabs[0].favIconUrl).toBeNull();
    expect(parsed.skippedTabs).toBe(3);
    expect(parsed.skippedFolders).toBe(2);
  });
});

describe('mergeWorkspaces', () => {
  it('yeni klasörü ekler, mevcutları silmez', () => {
    const current = normalizeWorkspaces({ a: ws('a', 'A', 5) });
    const incoming = normalizeWorkspaces({ b: ws('b', 'B', 5) });
    const { map, stats } = mergeWorkspaces(current, incoming);
    expect(Object.keys(map).sort()).toEqual(['a', 'b']);
    expect(stats).toEqual({ added: 1, updated: 0, unchanged: 0 });
  });

  it('daha yeni sürümü uygularken yalnızca yerelde olan sekmeleri silmez', () => {
    const current = normalizeWorkspaces({ a: ws('a', 'A', 5, null, ['https://ortak.com', 'https://yerel.com']) });
    const incoming = normalizeWorkspaces({ a: ws('a', 'A yeni', 9, null, ['https://ortak.com', 'https://yedek.com']) });
    const { map, stats } = mergeWorkspaces(current, incoming);
    expect(map.a.name).toBe('A yeni');
    expect(map.a.tabs.map((t) => t.url).sort()).toEqual(['https://ortak.com', 'https://yedek.com', 'https://yerel.com']);
    expect(new Set(map.a.tabs.map((t) => t.id)).size).toBe(3);
    expect(stats.updated).toBe(1);
  });

  it('daha eski yedekteki fazla sekmeleri de ekler', () => {
    const current = normalizeWorkspaces({ a: ws('a', 'Güncel', 9, null, ['https://x.com']) });
    const incoming = normalizeWorkspaces({ a: ws('a', 'Eski', 2, null, ['https://x.com', 'https://y.com']) });
    const { map } = mergeWorkspaces(current, incoming);
    expect(map.a.name).toBe('Güncel');
    expect(map.a.tabs.map((t) => t.url)).toEqual(['https://x.com', 'https://y.com']);
  });

  it('aynı klasör için updatedAt değeri yeni olanı tutar', () => {
    const current = normalizeWorkspaces({ a: ws('a', 'Eski ad', 5) });
    const newer = mergeWorkspaces(current, normalizeWorkspaces({ a: ws('a', 'Yeni ad', 9) }));
    expect(newer.map.a.name).toBe('Yeni ad');
    expect(newer.stats).toEqual({ added: 0, updated: 1, unchanged: 0 });

    const older = mergeWorkspaces(current, normalizeWorkspaces({ a: ws('a', 'Daha eski', 2) }));
    expect(older.map.a.name).toBe('Eski ad');
    expect(older.stats).toEqual({ added: 0, updated: 0, unchanged: 1 });
  });

  it('aynı yedeği iki kez içe aktarmak kopya oluşturmaz', () => {
    const incoming = normalizeWorkspaces({ a: ws('a', 'A', 5), b: ws('b', 'B', 5, 'a') });
    const once = mergeWorkspaces({}, incoming).map;
    const twice = mergeWorkspaces(once, incoming);
    expect(Object.keys(twice.map)).toHaveLength(2);
    expect(twice.stats.added).toBe(0);
  });

  it('birleşmeden doğan döngüyü kırar', () => {
    const current = normalizeWorkspaces({ a: ws('a', 'A', 5, 'b'), b: ws('b', 'B', 5) });
    const incoming = normalizeWorkspaces({ b: ws('b', 'B', 9, 'a'), a: ws('a', 'A', 1) });
    const { map } = mergeWorkspaces(current, incoming);
    const seen = new Set<string>();
    let cursor = map.a.parentId;
    while (cursor !== null) {
      expect(seen.has(cursor)).toBe(false);
      seen.add(cursor);
      cursor = map[cursor].parentId;
    }
  });
});

describe('undoImport', () => {
  it('içe aktarmayı geri alır', () => {
    const current = normalizeWorkspaces({ a: ws('a', 'A', 5, null, ['https://x.com']) });
    const incoming = normalizeWorkspaces({ a: ws('a', 'A yeni', 9), b: ws('b', 'B', 5) });
    const merged = mergeWorkspaces(current, incoming);
    expect(undoImport(merged.map, merged.undo)).toEqual(current);
  });

  it('aktarımdan sonra yapılan değişikliklere dokunmaz', () => {
    const current = normalizeWorkspaces({ a: ws('a', 'A', 5) });
    const merged = mergeWorkspaces(current, normalizeWorkspaces({ b: ws('b', 'B', 5) }));
    // Aktarımdan sonra: B yeniden adlandırıldı, başka bir pencereden C eklendi.
    const later = normalizeWorkspaces({ ...merged.map, b: { ...merged.map.b, name: 'B2' }, c: ws('c', 'C', 7) });
    const undone = undoImport(later, merged.undo);
    expect(undone.b.name).toBe('B2');
    expect(undone.c).toBeDefined();
  });
});

describe('undoImport ve döngüler', () => {
  it('döngü kırılırken köke alınan yerel klasörü de geri getirir', () => {
    const current = normalizeWorkspaces({ a: ws('a', 'A', 5), b: ws('b', 'B', 5, 'a') });
    // Yedekte hiyerarşi ters: A, B'nin altında. B yerelde daha yeni, A yedekte: birleşince döngü oluşur.
    const incoming = normalizeWorkspaces({ b: ws('b', 'B', 1), a: ws('a', 'A', 9, 'b') });
    const merged = mergeWorkspaces(current, incoming);
    expect(merged.map.a.parentId === null || merged.map.b.parentId === null).toBe(true);
    expect(undoImport(merged.map, merged.undo)).toEqual(current);
  });
});

describe('parseBackup güvenliği', () => {
  it('gelecekteki zaman damgalarını şimdiye çeker', () => {
    const parsed = parseBackup(JSON.stringify({ workspaces: { a: { name: 'A', updatedAt: 9e15, createdAt: 9e15, tabs: [] } } }), 1000);
    expect(parsed.workspaces.a.updatedAt).toBe(1000);
    expect(parsed.workspaces.a.createdAt).toBe(1000);
  });

  it('daha yeni şema sürümünü reddeder', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'TabFlow', schemaVersion: 99, workspaces: {} }))).toThrow('daha yeni');
  });

  it('__proto__ anahtarını atlar ve sayar', () => {
    const parsed = parseBackup('{"workspaces":{"__proto__":{"name":"X","tabs":[]},"a":{"name":"A","tabs":[]}}}');
    expect(Object.keys(parsed.workspaces)).toEqual(['a']);
    expect(parsed.skippedFolders).toBe(1);
  });
});
