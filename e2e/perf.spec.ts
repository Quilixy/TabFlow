import { expect, folder, SITE, test } from './fixtures';

/**
 * 5000 sekmelik bir kitaplıkla temel akışların süresini ölçer: uygulamanın açılması, 2000 sekmelik
 * klasörün tuvalde çizilmesi, ağaçta arama ve popup'ta arama.
 * Sınırlar yavaş CI makineleri için cömerttir; amaç ani gerilemeleri (ör. her tuşta tüm veriyi
 * yeniden işlemek) yakalamaktır. Ölçümler test raporuna not olarak yazılır.
 */
const BIG = 2000;
const SMALL_FOLDERS = 30;
const PER_SMALL = 100;

function library() {
  const tabs = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ url: `${SITE}/${prefix}/${i}`, title: `${prefix} sayfası ${i}` }));
  const map: Record<string, unknown> = {
    big: { ...folder('big', 'Büyük arşiv', tabs('arsiv', BIG)), x: 32, y: 32 },
  };
  for (let f = 0; f < SMALL_FOLDERS; f++) {
    map[`f${f}`] = { ...folder(`f${f}`, `Konu ${f}`, tabs(`konu${f}`, PER_SMALL)), x: 32 + (f % 6) * 300, y: 200 + Math.floor(f / 6) * 160 };
  }
  // Aranacak tek bir iğne
  (map.f17 as { tabs: { title: string }[] }).tabs[42].title = 'Samanlıktaki iğne';
  return map;
}

test.describe('5000 sekme', () => {
  test.describe.configure({ timeout: 120_000 });

  test('uygulama, tuval ve arama büyük kitaplıkta hızlı kalır', async ({ openApp, openPopup, seed }, testInfo) => {
    const timings: Record<string, number> = {};
    const time = async (name: string, fn: () => Promise<unknown>) => {
      const start = Date.now();
      await fn();
      timings[name] = Date.now() - start;
    };

    const setup = await openApp();
    await seed(library());
    // Ağaç sanal: yalnızca görünen satırlar çizilir, bu yüzden üstteki klasörü bekle.
    await setup.getByRole('treeitem', { name: /Büyük arşiv/ }).waitFor();
    await setup.close();

    let app = await openApp();
    await time('açılış', async () => {
      await app.close();
      app = await openApp();
      await app.getByRole('treeitem', { name: /Büyük arşiv/ }).waitFor();
    });

    await time('büyük klasörü aç', async () => {
      await app.getByRole('treeitem', { name: /Büyük arşiv/ }).click();
      await expect(app.getByRole('group', { name: new RegExp(`arsiv sayfası ${BIG - 1}\\b`) })).toBeAttached();
    });

    await time('ağaçta ara', async () => {
      await app.getByRole('button', { name: 'Ara', exact: true }).click();
      await app.getByPlaceholder('Klasör veya sekme ara…').fill('samanlık');
      await expect(app.getByRole('treeitem', { name: /Konu 17/ })).toBeVisible();
      await expect(app.getByRole('treeitem')).toHaveCount(1);
    });

    const popup = await openPopup();
    await time('popup ara', async () => {
      await popup.getByRole('searchbox').fill('samanlık');
      await expect(popup.getByText('Samanlıktaki iğne')).toBeVisible();
    });

    testInfo.annotations.push(...Object.entries(timings).map(([type, ms]) => ({ type, description: `${ms} ms` })));
    console.log('5000 sekme ölçümleri:', timings);

    expect(timings['açılış']).toBeLessThan(5_000);
    expect(timings['büyük klasörü aç']).toBeLessThan(6_000);
    expect(timings['ağaçta ara']).toBeLessThan(3_000);
    expect(timings['popup ara']).toBeLessThan(3_000);
  });
});
