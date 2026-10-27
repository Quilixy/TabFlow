import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, SAMPLE_LIBRARY, setLook, test, type Look } from './fixtures';

/**
 * axe ile WCAG 2.1 A/AA denetimi: tam ekran uygulama (her tema paketi, açık ve koyu), popup ve diyaloglar.
 * Süs katmanı (aria-hidden) denetim dışıdır; içerik her temada kontrast kurallarını geçmelidir.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).exclude('.tf-decor').analyze();
  // Hata iletisinde kuralı ve sorunlu öğeleri göster
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const LOOKS: Look[] = [
  { pack: 'default', theme: 'light' },
  { pack: 'default', theme: 'dark' },
  { pack: 'default', theme: 'light', accent: 'amber' },
  { pack: 'sakura', theme: 'light' },
  { pack: 'sakura', theme: 'dark' },
  { pack: 'space', theme: 'light' },
  { pack: 'space', theme: 'dark' },
];

test.describe('erişilebilirlik (axe)', () => {
  for (const look of LOOKS) {
    test(`tam ekran: ${look.pack} · ${look.theme}${look.accent ? ` · ${look.accent}` : ''}`, async ({ openApp, seed }) => {
      const app = await openApp();
      await seed(SAMPLE_LIBRARY);
      await setLook(app, look);
      await app.getByRole('treeitem', { name: /İş/ }).click();
      await expect(app.getByRole('group', { name: /Proje klasörü/ })).toBeVisible();
      expect(await audit(app)).toEqual([]);
    });
  }

  test('popup', async ({ openPopup, seed }) => {
    const popup = await openPopup();
    await seed(SAMPLE_LIBRARY);
    await expect(popup.getByText('Okuma')).toBeVisible();
    expect(await audit(popup)).toEqual([]);
  });

  test('diyaloglar: görünüm menüsü, çöp kutusu, içe aktarma, komut paleti', async ({ openApp, seed }) => {
    const app = await openApp();
    await seed(SAMPLE_LIBRARY);
    await expect(app.getByRole('treeitem', { name: /İş/ })).toBeVisible();

    await app.getByRole('button', { name: /Görünüm/ }).click();
    await expect(app.getByRole('dialog')).toBeVisible();
    expect(await audit(app)).toEqual([]);
    await app.keyboard.press('Escape');

    await app.getByRole('button', { name: /Çöp kutusu/ }).click();
    await expect(app.getByRole('dialog', { name: 'Çöp kutusu' })).toBeVisible();
    expect(await audit(app)).toEqual([]);
    await app.keyboard.press('Escape');

    await app.getByRole('button', { name: 'Yedek' }).click();
    await app.getByRole('menuitem', { name: /Metinden içe aktar/ }).click();
    await expect(app.getByRole('dialog', { name: 'Metinden içe aktar' })).toBeVisible();
    expect(await audit(app)).toEqual([]);
    await app.keyboard.press('Escape');

    await app.keyboard.press('Control+k');
    await expect(app.getByRole('dialog')).toBeVisible();
    expect(await audit(app)).toEqual([]);
  });
});
