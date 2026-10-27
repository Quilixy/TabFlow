import { expect, folder, SITE, test } from './fixtures';

test.describe('popup', () => {
  test('Türkçe karakterlere duyarlı arar ve eşleşen sekmeyi gösterir', async ({ openPopup, seed }) => {
    await seed({
      a: folder('a', 'İş', [{ url: `${SITE}/takvim`, title: 'Takvim' }]),
      b: folder('b', 'Gezi', [{ url: `${SITE}/istanbul`, title: 'İstanbul rehberi' }]),
    });
    const popup = await openPopup();
    await popup.getByRole('searchbox', { name: 'Klasör veya sekme ara' }).fill('istanbul');

    await expect(popup.getByText('Gezi')).toBeVisible();
    await expect(popup.getByText('İş', { exact: true })).toHaveCount(0);
    await expect(popup.getByRole('button', { name: /İstanbul rehberi/ })).toBeVisible();
  });

  test('aramadan ok tuşlarıyla sonuçlara iner', async ({ openPopup, seed }) => {
    await seed({ a: folder('a', 'Alfa', [{ url: `${SITE}/1`, title: 'Bir' }]), b: folder('b', 'Beta') });
    const popup = await openPopup();
    const search = popup.getByRole('searchbox', { name: 'Klasör veya sekme ara' });
    await search.focus();
    await search.press('ArrowDown');
    await expect(popup.locator('[data-nav="row"]').first()).toBeFocused();

    await popup.keyboard.press('ArrowRight'); // Alfa'yı aç
    await expect(popup.getByRole('button', { name: /Bir/ })).toBeVisible();
    await popup.keyboard.press('ArrowUp');
    await expect(search).toBeFocused();
  });

  test('alt klasörlü klasörün açma seçeneklerini gösterir', async ({ openPopup, seed }) => {
    await seed({
      a: folder('a', 'Üst', [{ url: `${SITE}/1`, title: 'Bir' }]),
      b: folder('b', 'Alt', [{ url: `${SITE}/2`, title: 'İki' }], 'a'),
    });
    const popup = await openPopup();
    await popup.getByRole('button', { name: '“Üst” açma seçenekleri' }).click();
    const menu = popup.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Sekmeleri aç (1)',
      'Alt klasörlerle birlikte aç (2)',
      'Sekme grubu olarak aç',
      'Yeni pencerede aç',
    ]);
  });

  test.describe('sekmeleri açma (service worker üzerinden)', () => {
    const seedTwo = (seed: (w: Record<string, unknown>) => Promise<void>) =>
      seed({
        a: { ...folder('a', 'Okuma', [
          { url: `${SITE}/bir`, title: 'Bir' },
          { url: `${SITE}/iki`, title: 'İki' },
        ]), color: 'emerald' },
      });
    // Eklentinin arka planda açtığı sekmeler Playwright'ın sayfa listesine her zaman düşmez: tarayıcıya sor.
    const siteTabs = (context: import('@playwright/test').BrowserContext) =>
      context.serviceWorkers()[0].evaluate(
        async (site) => (await chrome.tabs.query({})).filter((t) => (t.url || t.pendingUrl || '').startsWith(site)).length,
        SITE,
      );

    test('Aç: sekmeleri bu pencerede açar', async ({ context, openPopup, seed }) => {
      await seedTwo(seed);
      const popup = await openPopup();
      await popup.getByRole('button', { name: 'Aç', exact: true }).click();
      await expect.poll(() => siteTabs(context)).toBe(2);
    });

    test('popup hemen kapansa da tüm sekmeler açılır', async ({ context, openPopup, seed }) => {
      const tabs = Array.from({ length: 15 }, (_, i) => ({ url: `${SITE}/s${i}`, title: `Sayfa ${i}` }));
      await seed({ a: folder('a', 'Çok', tabs) });
      const popup = await openPopup();
      await popup.getByRole('button', { name: 'Aç', exact: true }).click();
      await popup.close(); // Kullanıcı sayfaya tıkladı: popup kapandı
      await expect.poll(() => siteTabs(context), { timeout: 10_000 }).toBe(15);
      // 10'dan sonrakiler ertelenir (tıklanınca yüklenir) ama adreslerini korur.
      const deferred = () =>
        context.serviceWorkers()[0].evaluate(
          async (site) => (await chrome.tabs.query({ discarded: true })).filter((t) => t.url?.startsWith(site)).length,
          SITE,
        );
      await expect.poll(deferred, { timeout: 10_000 }).toBe(5);
    });

    test('sekme grubu olarak açar; grup klasörün adını ve rengini alır', async ({ context, openPopup, seed }) => {
      await seedTwo(seed);
      const popup = await openPopup();
      await popup.getByRole('button', { name: '“Okuma” açma seçenekleri' }).click();
      await popup.getByRole('menuitem', { name: 'Sekme grubu olarak aç' }).click();

      const worker = context.serviceWorkers()[0];
      await expect
        .poll(() => worker.evaluate(async () => (await chrome.tabGroups.query({})).map((g) => `${g.title}:${g.color}`)))
        .toEqual(['Okuma:green']);
      await expect.poll(() => siteTabs(context)).toBe(2);
    });

    test('yeni pencerede açar', async ({ context, openPopup, seed }) => {
      await seedTwo(seed);
      const popup = await openPopup();
      await popup.getByRole('button', { name: '“Okuma” açma seçenekleri' }).click();
      await popup.getByRole('menuitem', { name: 'Yeni pencerede aç' }).click();

      const worker = context.serviceWorkers()[0];
      await expect.poll(() => worker.evaluate(async () => (await chrome.windows.getAll()).length)).toBe(2);
      await expect.poll(() => siteTabs(context)).toBe(2);
    });
  });
});
