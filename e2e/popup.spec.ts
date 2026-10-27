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
});
