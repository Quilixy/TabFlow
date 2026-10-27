import { describe, expect, it } from 'vitest';
import type { Workspace } from '../types';
import { normalizeQuery, tabMatches, workspaceMatches } from './search';

const tab = (title: string, url = 'https://ornek.com') => ({ title, url });
const folder = (name: string, tabs: { title: string; url: string }[] = []): Workspace => ({
  id: name,
  name,
  createdAt: 0,
  updatedAt: 0,
  parentId: null,
  x: 0,
  y: 0,
  tabs: tabs.map((t, i) => ({ ...t, id: `${name}-${i}`, favIconUrl: null, pinned: false, x: 0, y: 0 })),
});

describe('arama', () => {
  it('Türkçe büyük/küçük harfleri eşler (İ/i, I/ı)', () => {
    expect(tabMatches(tab('İstanbul Haberleri'), normalizeQuery('istanbul'))).toBe(true);
    expect(tabMatches(tab('istanbul'), normalizeQuery('İSTANBUL'))).toBe(true);
    expect(workspaceMatches(folder('IŞIK'), normalizeQuery('ışık'))).toBe(true);
  });

  it('Türkçe karakter yazmadan da bulur', () => {
    expect(workspaceMatches(folder('Çalışma'), normalizeQuery('calisma'))).toBe(true);
    expect(tabMatches(tab('Şarkı listesi'), normalizeQuery('sarki'))).toBe(true);
  });

  it('URL içinde de arar', () => {
    expect(tabMatches(tab('Başlık', 'https://github.com/x'), normalizeQuery('GitHub'))).toBe(true);
  });

  it('boş ya da yalnızca boşluk olan sorgu her klasörü eşler', () => {
    expect(normalizeQuery('   ')).toBe('');
    expect(workspaceMatches(folder('Herhangi'), normalizeQuery('  '))).toBe(true);
  });

  it('klasör adı veya sekmesi eşleşmezse false', () => {
    expect(workspaceMatches(folder('İş', [tab('Takvim')]), normalizeQuery('müzik'))).toBe(false);
    expect(workspaceMatches(folder('İş', [tab('Müzik')]), normalizeQuery('muzik'))).toBe(true);
  });
});
