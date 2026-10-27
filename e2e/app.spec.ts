import { readFileSync } from 'node:fs';
import { expect, folder, SITE, test } from './fixtures';

test.describe('tam ekran uygulama', () => {
  test('klasör oluşturur; ağaçta ve tuvalde görünür', async ({ openApp }) => {
    const app = await openApp();
    await app.getByRole('button', { name: 'Yeni klasör', exact: true }).click();
    await app.getByPlaceholder('Klasör adı').fill('Araştırma');
    await app.getByRole('button', { name: 'Oluştur' }).click();

    await expect(app.getByRole('treeitem', { name: /Araştırma/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /Araştırma klasörü/ })).toBeVisible();
  });

  test('açık sekmelerin tümünü kaydeder ve kapatır', async ({ context, openApp, openSite }) => {
    await openSite('/haber', 'Haber');
    await openSite('/blog', 'Blog');
    const app = await openApp();

    await app.getByRole('button', { name: 'Tüm sekmeleri bir klasöre kaydet ve kapat' }).click();
    await app.getByPlaceholder('Örn. Araştırma').fill('Okuma');
    await app.getByRole('button', { name: 'Kaydet', exact: true }).click();

    await expect(app.getByRole('status').getByText('2 sekme “Okuma” klasörüne kaydedildi.')).toBeVisible();
    await expect.poll(() => context.pages().filter((p) => p.url().startsWith(SITE)).length).toBe(0);
    await expect(app.getByRole('treeitem', { name: /Okuma/ })).toContainText('2');
  });

  test('silinen klasör çöp kutusuna gider ve geri yüklenir', async ({ openApp, seed }) => {
    const app = await openApp();
    await seed({ a: folder('a', 'Silinecek', [{ url: `${SITE}/x`, title: 'X' }]) });
    const row = app.getByRole('treeitem', { name: /Silinecek/ });
    await expect(row).toBeVisible();

    await row.click({ button: 'right' });
    await app.getByRole('menuitem', { name: 'Klasörü sil' }).click();
    await expect(row).toHaveCount(0);

    await app.getByRole('button', { name: /Çöp kutusu \(1 öğe\)/ }).click();
    const dialog = app.getByRole('dialog', { name: 'Çöp kutusu' });
    await dialog.getByRole('button', { name: 'Geri yükle' }).click();
    await expect(app.getByRole('treeitem', { name: /Silinecek/ })).toBeVisible();
  });

  test('klasörü üste sabitler', async ({ openApp, seed }) => {
    const app = await openApp();
    await seed({ a: folder('a', 'Alfa'), b: folder('b', 'Beta') });
    const rows = app.getByRole('treeitem');
    await expect(rows).toHaveText([/Alfa/, /Beta/]);

    await app.getByRole('treeitem', { name: /Beta/ }).click({ button: 'right' });
    await app.getByRole('menuitem', { name: 'Üste sabitle' }).click();
    await expect(rows).toHaveText([/Beta/, /Alfa/]);
  });

  test('tuvalde çoklu seçimle birden çok sekmeyi siler, geri alır', async ({ openApp, seed }) => {
    const app = await openApp();
    await seed({
      a: folder('a', 'Kutu', [
        { url: `${SITE}/1`, title: 'Bir' },
        { url: `${SITE}/2`, title: 'İki' },
        { url: `${SITE}/3`, title: 'Üç' },
      ]),
    });
    await app.getByRole('treeitem', { name: /Kutu/ }).click();

    await app.getByRole('button', { name: /^Bir / }).click();
    await app.getByRole('button', { name: /^İki / }).click({ modifiers: ['Shift'] });
    await expect(app.getByText('öğe seçili')).toContainText('2');
    await app.keyboard.press('Delete');

    await expect(app.getByRole('button', { name: /^Bir / })).toHaveCount(0);
    await expect(app.getByRole('button', { name: /^Üç / })).toBeVisible();
    await app.getByRole('button', { name: 'Geri al' }).click();
    await expect(app.getByRole('button', { name: /^Bir / })).toBeVisible();
    await expect(app.getByRole('button', { name: /^İki / })).toBeVisible();
  });

  test('bir değişiklikten sonra otomatik yedek alınır', async ({ openApp, seed, readStorage }) => {
    await openApp();
    await seed({ a: folder('a', 'İlk') });
    await seed({ a: folder('a', 'İkinci') });
    await expect
      .poll(async () => ((await readStorage<unknown[]>('snapshots')) ?? []).length, { timeout: 5_000 })
      .toBe(1);
  });

  test('iki parmakla yakınlaştırır', async ({ context, openApp, seed }) => {
    const app = await openApp();
    await seed({ a: folder('a', 'Kutu') });
    const zoomLabel = app.getByTitle('Görünümü sıfırla');
    await zoomLabel.click(); // %100'den başla
    await expect(zoomLabel).toHaveText('100%');

    const box = (await app.getByRole('application').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const cdp = await context.newCDPSession(app);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', spread: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints:
          type === 'touchEnd'
            ? []
            : [
                { x: cx - spread, y: cy, id: 0 },
                { x: cx + spread, y: cy, id: 1 },
              ],
      });
    await touch('touchStart', 50);
    for (const spread of [60, 70, 80, 90, 100]) await touch('touchMove', spread);
    await touch('touchEnd', 0);

    await expect(zoomLabel).toHaveText('200%'); // Parmaklar iki kat açıldı
  });

  test('eski tek anahtarlı veri klasör başına anahtarlara taşınır ve değişiklikler yalnızca o klasörü yazar', async ({
    openApp,
    seed,
    readStorage,
  }) => {
    const app = await openApp();
    await seed({ a: folder('a', 'Alfa'), b: folder('b', 'Beta') });
    await expect.poll(() => readStorage<string[]>('wsIndex')).toEqual(['a', 'b']);
    expect(await readStorage('workspaces')).toBeUndefined();
    await expect(app.getByRole('treeitem')).toHaveText([/Alfa/, /Beta/]);

    await app.getByRole('treeitem', { name: /Beta/ }).click({ button: 'right' });
    await app.getByRole('menuitem', { name: 'Üste sabitle' }).click();
    await expect.poll(async () => (await readStorage<{ favorite?: boolean }>('ws:b'))?.favorite).toBe(true);
    expect((await readStorage<{ favorite?: boolean }>('ws:a'))?.favorite).toBeUndefined();
  });

  test('dil İngilizceye çevrilir ve hatırlanır', async ({ openApp, readStorage }) => {
    const app = await openApp();
    await app.getByRole('button', { name: 'Görünüm' }).click();
    await app.getByRole('button', { name: 'English' }).click();

    await expect(app.getByRole('button', { name: 'New folder', exact: true })).toBeVisible();
    await expect(app.locator('html')).toHaveAttribute('lang', 'en');
    // Arka plan (sağ tık menüsü, rozet) de aynı dili kullanır.
    await expect.poll(() => readStorage<string>('language')).toBe('en');

    await app.reload();
    await expect(app.getByRole('button', { name: 'New folder', exact: true })).toBeVisible();
  });

  test('klasörler diske otomatik yedeklenir ve dosya geri yüklenebilir biçimdedir', async ({ context, seed, readStorage }) => {
    await seed({ a: folder('a', 'Önemli', [{ url: `${SITE}/x`, title: 'X' }]) });
    const worker = context.serviceWorkers()[0];
    // Playwright indirmeleri kendi geçici klasörüne rastgele adla kaydeder; dosya adını birim testi doğrular.
    // Burada dosyanın gerçekten yazıldığı ve geri yüklenebilir bir TabFlow yedeği olduğu doğrulanır.
    const findDownload = () =>
      worker.evaluate(async () => {
        const items = await chrome.downloads.search({ state: 'complete' });
        return items.find((d) => d.url.startsWith('data:application/json'))?.filename ?? null;
      });
    await expect.poll(findDownload, { timeout: 10_000 }).not.toBeNull();

    const file = (await findDownload())!;
    const backup = JSON.parse(readFileSync(file, 'utf8'));
    expect(backup.app).toBe('TabFlow');
    expect(backup.workspaces.a.name).toBe('Önemli');
    expect((await readStorage<{ lastAt: number | null }>('autoExport'))?.lastAt).toEqual(expect.any(Number));
  });

  test('popup, yan panel ya da adres çubuğundan gelen "klasöre git" isteğini uygular', async ({
    context,
    openApp,
    seed,
    readStorage,
  }) => {
    const app = await openApp();
    await seed({ a: folder('a', 'Üst'), b: folder('b', 'Hedef', [], 'a') });
    await expect(app.getByRole('treeitem', { name: /Üst/ })).toBeVisible();

    await context.serviceWorkers()[0].evaluate(() =>
      chrome.storage.local.set({ 'tabflow-navigate': { id: 'b', at: Date.now() } }),
    );
    await expect(app.getByRole('navigation', { name: 'Konum' })).toContainText('Hedef');
    await expect(app.getByRole('treeitem', { name: /Hedef/ })).toBeVisible(); // üst dal açıldı
    await expect.poll(() => readStorage('tabflow-navigate')).toBeUndefined();
  });

  test('tümünü kaydederken siteye göre alt klasörlere ayırır', async ({ openApp, openSite }) => {
    await openSite('http://haber.tabflow.test/1');
    await openSite('http://haber.tabflow.test/2');
    await openSite('http://blog.tabflow.test/1');
    const app = await openApp();

    await app.getByRole('button', { name: 'Tüm sekmeleri bir klasöre kaydet ve kapat' }).click();
    await app.getByPlaceholder('Örn. Araştırma').fill('Oturum');
    await app.getByLabel('Siteye göre alt klasörlere ayır').check();
    await app.getByRole('button', { name: 'Kaydet', exact: true }).click();

    await expect(app.getByRole('status')).toContainText('3 sekme “Oturum” klasörüne kaydedildi. 1 siteye göre alt klasörlere ayrıldı.');
    await app.getByRole('treeitem', { name: /Oturum/ }).click();
    await expect(app.getByRole('button', { name: /haber\.tabflow\.test klasörü, 2 sekme/ })).toBeVisible();
    await expect(app.getByRole('button', { name: /^1 \(blog\.tabflow\.test\)/ })).toBeVisible();
  });

  test('Ctrl+K komut paletiyle klasöre gider ve komut çalıştırır', async ({ openApp, seed }) => {
    const app = await openApp();
    await seed({ a: folder('a', 'İş'), b: folder('b', 'Çalışma notları', [], 'a') });
    await expect(app.getByRole('treeitem', { name: /İş/ })).toBeVisible();

    await app.keyboard.press('Control+k');
    const palette = app.getByRole('dialog', { name: 'Komut paleti' });
    await palette.getByRole('combobox').fill('calisma');
    await expect(palette.getByRole('option')).toHaveText([/İş \/ Çalışma notları/]);
    await app.keyboard.press('Enter');
    await expect(palette).toHaveCount(0);
    await expect(app.getByRole('navigation', { name: 'Konum' })).toContainText('Çalışma notları');

    await app.keyboard.press('Control+k');
    await palette.getByRole('combobox').fill('cop kutusu');
    await app.keyboard.press('Enter');
    await expect(app.getByRole('dialog', { name: 'Çöp kutusu' })).toBeVisible();
  });

  test('OneTab metninden gruplarıyla içe aktarır ve geri alır', async ({ openApp }) => {
    const app = await openApp();
    await app.getByRole('button', { name: /^Yedek/ }).click();
    await app.getByRole('menuitem', { name: /Metinden içe aktar/ }).click();

    const dialog = app.getByRole('dialog', { name: 'Metinden içe aktar' });
    await dialog.getByLabel('Klasör adı').fill('OneTab');
    await dialog
      .getByLabel('Metin')
      .fill(['https://a.example | A', 'https://b.example | B', '', 'https://c.example | C', 'chrome://settings | X'].join('\n'));
    await expect(dialog.getByRole('status')).toHaveText('3 sekme, 2 grup bulundu; 1 satır atlanacak.');
    await dialog.getByRole('button', { name: 'İçe aktar' }).click();

    await expect(app.getByRole('status').getByText('“OneTab” içe aktarıldı: 3 klasör, 3 sekme.')).toBeVisible();
    await expect(app.getByRole('treeitem', { name: /Grup 1/ })).toBeVisible();
    await expect(app.getByRole('treeitem', { name: /Grup 2/ })).toBeVisible();

    await app.getByRole('button', { name: 'Geri al' }).click();
    await expect(app.getByRole('treeitem', { name: /OneTab/ })).toHaveCount(0);
  });
});
