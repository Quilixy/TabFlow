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
});
