import { defineConfig } from 'vitest/config';

// Testler saf mantık (DOM/Chrome gerektirmez): hızlı Node ortamı.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
