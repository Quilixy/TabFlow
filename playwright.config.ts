import { defineConfig } from '@playwright/test';

// Uçtan uca testler: derlenmiş eklenti (dist/) gerçek bir Chromium'a yüklenir.
// Önce `npm run build` gerekir (`npm run test:e2e` ikisini birlikte yapar).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
});
