import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { version: string };
const appVersion = process.env.VITE_APP_VERSION ?? packageJson.version;
const appUpdatedAt = process.env.VITE_APP_UPDATED_AT ?? new Date().toISOString();

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_APP_UPDATED_AT': JSON.stringify(appUpdatedAt),
  },
  plugins: [
    react(),
    {
      name: 'zadiag-app-version-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'app-version.json',
          source: `${JSON.stringify({ version: appVersion, updatedAt: appUpdatedAt }, null, 2)}\n`,
        });
      },
    },
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        id: '/zadiag',
        name: 'Zadiag',
        short_name: 'Zadiag',
        description: 'Shared family routine follow-up.',
        theme_color: '#15324b',
        background_color: '#fffbf4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['functions/**', 'rules-tests/**', 'node_modules/**', 'dist/**'],
  },
});
