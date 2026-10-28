import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  // Eklenti eklentisi dist/'i kendisi boşaltmaz; bu bayrak olmadan eski derlemelerin dosyaları pakette kalır.
  build: { emptyOutDir: true },
  plugins: [react(), tailwindcss(), webExtension({ manifest: 'manifest.json' })],
});
