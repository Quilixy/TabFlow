import { describe, expect, it } from 'vitest';
import { applyTheme, resolveTheme, type ThemeSettings } from './theme';

const base: ThemeSettings = { theme: 'system', accent: 'indigo', animation: 'pop', pack: 'default', decor: true };
const fakeRoot = () => ({ dataset: {} as Record<string, string | undefined> });

describe('resolveTheme', () => {
  it('sistem seçiliyken işletim sistemi tercihini izler', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('açık/koyu seçimi sistem tercihini yok sayar', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('ayarları data-* özniteliklerine yazar', () => {
    const root = fakeRoot();
    applyTheme({ ...base, theme: 'dark', accent: 'emerald', animation: 'slide' }, false, root);
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.accent).toBe('emerald');
    expect(root.dataset.anim).toBe('slide');
    expect(root.dataset.pack).toBe('default');
  });

  it('geçersiz/bozuk kayıtlı değerlerde güvenli varsayılana döner', () => {
    const root = fakeRoot();
    applyTheme(
      { theme: 'mor' as never, accent: 'neon' as never, animation: 'zıplama' as never, pack: 'orman' as never, decor: true },
      true,
      root,
    );
    expect(root.dataset.theme).toBe('dark'); // 'system' varsayılanı + sistem koyu
    expect(root.dataset.accent).toBe('indigo');
    expect(root.dataset.anim).toBe('pop');
    expect(root.dataset.pack).toBe('default');
  });
});

describe('tema paketleri', () => {
  it('paket, kullanıcının Açık/Koyu seçimini değiştirmez (her paket iki tonda çalışır)', () => {
    for (const pack of ['sakura', 'space'] as const) {
      const light = fakeRoot();
      applyTheme({ ...base, theme: 'light', pack }, true, light);
      expect(light.dataset.theme).toBe('light');
      expect(light.dataset.pack).toBe(pack);

      const dark = fakeRoot();
      applyTheme({ ...base, theme: 'dark', pack }, false, dark);
      expect(dark.dataset.theme).toBe('dark');
    }
  });

  it('Sistem seçiliyken paketler işletim sistemi tonunu izler', () => {
    const root = fakeRoot();
    applyTheme({ ...base, theme: 'system', pack: 'sakura' }, true, root);
    expect(root.dataset.theme).toBe('dark');
    applyTheme({ ...base, theme: 'system', pack: 'sakura' }, false, root);
    expect(root.dataset.theme).toBe('light');
  });

  it('süsler yalnızca paketlerde ve açıkken "on" olur', () => {
    const defaultPack = fakeRoot();
    applyTheme({ ...base, pack: 'default', decor: true }, false, defaultPack);
    expect(defaultPack.dataset.decor).toBe('off');

    const on = fakeRoot();
    applyTheme({ ...base, pack: 'sakura', decor: true }, false, on);
    expect(on.dataset.decor).toBe('on');

    const off = fakeRoot();
    applyTheme({ ...base, pack: 'sakura', decor: false }, false, off);
    expect(off.dataset.decor).toBe('off');
  });

  it('paketten çıkınca paket özniteliği ve süsler kalkar, ton aynı kalır', () => {
    const root = fakeRoot();
    applyTheme({ ...base, theme: 'light', pack: 'space' }, true, root);
    expect(root.dataset.theme).toBe('light');
    applyTheme({ ...base, theme: 'light', pack: 'default' }, true, root);
    expect(root.dataset.pack).toBe('default');
    expect(root.dataset.decor).toBe('off');
    expect(root.dataset.theme).toBe('light');
  });
});
