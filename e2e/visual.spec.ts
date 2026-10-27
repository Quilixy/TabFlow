import { existsSync } from 'node:fs';
import { expect, SAMPLE_LIBRARY, setLook, test, type Look } from './fixtures';

/**
 * Tema paketlerinin görsel karşılaştırması (toHaveScreenshot). Tabanlar platforma özgüdür (yazı tipi
 * çizimi farklıdır): `e2e/visual.spec.ts-snapshots/*-<platform>.png`. Bu platformun tabanı yoksa CI'da
 * test atlanır; yerelde ilk çalıştırma tabanı yazar. Bilerek yapılan bir görünüm değişikliğinden sonra:
 *   npx playwright test e2e/visual.spec.ts --update-snapshots
 * Linux (CI) tabanları "Görsel tabanlar" iş akışıyla üretilip indirilebilir.
 * Süslerin konumu sabit tohumla üretilir; sonsuz animasyonlar başlangıç karesinde durdurulur.
 */
const LOOKS: (Look & { name: string })[] = [
  { name: 'default-light', pack: 'default', theme: 'light' },
  { name: 'default-dark', pack: 'default', theme: 'dark', accent: 'emerald' },
  { name: 'sakura-light', pack: 'sakura', theme: 'light' },
  { name: 'sakura-dark', pack: 'sakura', theme: 'dark' },
  { name: 'space-light', pack: 'space', theme: 'light' },
  { name: 'space-dark', pack: 'space', theme: 'dark' },
];

const SCREENSHOT = { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } as const;

function skipWithoutBaseline(file: string) {
  const info = test.info();
  const updating = info.config.updateSnapshots === 'all' || info.config.updateSnapshots === 'changed';
  const missing = !existsSync(info.snapshotPath(file, { kind: 'screenshot' }));
  test.skip(!!process.env.CI && !updating && missing, `Bu platform için görsel taban yok: ${file}`);
}

test.describe('görsel karşılaştırma', () => {
  for (const look of LOOKS) {
    test(`tam ekran: ${look.name}`, async ({ openApp, seed }) => {
      skipWithoutBaseline(`app-${look.name}.png`);
      const app = await openApp();
      await app.setViewportSize({ width: 1280, height: 720 });
      await seed(SAMPLE_LIBRARY);
      await setLook(app, look);
      await app.getByRole('treeitem', { name: /İş/ }).click();
      await expect(app.getByRole('group', { name: /Proje klasörü/ })).toBeVisible();
      await expect(app).toHaveScreenshot(`app-${look.name}.png`, SCREENSHOT);
    });
  }

  for (const look of [LOOKS[0], LOOKS[3]]) {
    test(`popup: ${look.name}`, async ({ openPopup, seed }) => {
      skipWithoutBaseline(`popup-${look.name}.png`);
      const popup = await openPopup();
      await popup.setViewportSize({ width: 380, height: 560 });
      await seed(SAMPLE_LIBRARY);
      await setLook(popup, look);
      await expect(popup.getByText('Okuma')).toBeVisible();
      await expect(popup).toHaveScreenshot(`popup-${look.name}.png`, SCREENSHOT);
    });
  }
});
