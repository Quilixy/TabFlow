import { expect, folder, SITE, test } from './fixtures';

test.describe('yan panel', () => {
  test('popup arayüzünü pencere boyunca gösterir ve etkin sekmeyi izler', async ({ context, extensionId, seed, openSite }) => {
    await seed({ a: folder('a', 'Okuma', [{ url: `${SITE}/kayitli`, title: 'Kayıtlı' }]) });
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
    await expect(panel.getByText('Okuma')).toBeVisible();
    // Yan panelde "yan panelde aç" düğmesi olmaz.
    await expect(panel.getByRole('button', { name: /Yan panelde aç/ })).toHaveCount(0);

    // Kayıtlı bir sayfaya geçilince gösterge belirir, kayıtsız bir sayfaya geçilince kaybolur.
    const saved = await openSite('/kayitli'); // başlık parametresi adrese eklenirdi; kayıtlı adresle aynı olmalı
    await saved.bringToFront();
    await expect(panel.getByText('Bu sayfa zaten kayıtlı:')).toBeVisible();

    const other = await openSite('/baska');
    await other.bringToFront();
    await expect(panel.getByText('Bu sayfa zaten kayıtlı:')).toHaveCount(0);
  });

  test('popup başlığında yan panel düğmesi vardır', async ({ openPopup }) => {
    const popup = await openPopup();
    await expect(popup.getByRole('button', { name: 'Yan panelde aç' })).toBeVisible();
  });
});
