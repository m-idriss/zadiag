import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { version: string };
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
const shortSha = commitSha?.slice(0, 7);
const gitRef = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME;
const prNumber = process.env.VERCEL_GIT_PULL_REQUEST_ID;
const vercelEnv = process.env.VERCEL_ENV;
const isPreviewBuild = vercelEnv === 'preview' || Boolean(prNumber);
const previewRef = (prNumber ? `pr${prNumber}` : gitRef ?? 'preview').replace(/[^a-zA-Z0-9._-]/g, '-');
const computedPreviewVersion = `${packageJson.version}-preview.${previewRef}.${shortSha ?? 'dev'}`;
const appVersion = process.env.VITE_APP_VERSION ?? (isPreviewBuild ? computedPreviewVersion : packageJson.version);
const appUpdatedAt = process.env.VITE_APP_UPDATED_AT ?? new Date().toISOString();

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_APP_UPDATED_AT': JSON.stringify(appUpdatedAt),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        id: '/zadiag',
        name: 'Zadiag',
        short_name: 'Zadiag',
        description: 'Intelligent treatment follow-up for families.',
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
            purpose: 'any maskable',
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
    exclude: ['functions/**', 'rules-tests/**', 'node_modules/**', 'dist/**'],
  },
});
