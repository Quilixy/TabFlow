import { describe, expect, it } from 'vitest';
import { filterCommands, type PaletteCommand } from './palette';

const cmd = (label: string): PaletteCommand => ({ id: label, label, group: 'folder', run: () => undefined });
const all = [cmd('İş / Proje Alfa'), cmd('İş / Toplantılar'), cmd('Okuma / Çalışma notları'), cmd('Yeni klasör')];

describe('komut paleti araması', () => {
  it('boş aramada hepsini verir', () => {
    expect(filterCommands(all, '  ')).toHaveLength(4);
  });

  it('her kelime geçmeli; sıra ve Türkçe karakter önemsiz', () => {
    expect(filterCommands(all, 'proje is').map((c) => c.label)).toEqual(['İş / Proje Alfa']);
    expect(filterCommands(all, 'calisma').map((c) => c.label)).toEqual(['Okuma / Çalışma notları']);
    expect(filterCommands(all, 'yok')).toEqual([]);
  });

  it('en fazla 50 sonuç döndürür', () => {
    const many = Array.from({ length: 80 }, (_, i) => cmd(`Klasör ${i}`));
    expect(filterCommands(many, 'klasor')).toHaveLength(50);
  });
});
