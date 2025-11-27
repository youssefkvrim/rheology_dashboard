/* Allow using process without @types/node installed */
declare const process: { env?: Record<string, string | undefined> } | undefined;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: [
      'js-806cdd3e-6896-40f7-8d07-5d82cb2bafdd.apps.dev.dc1.cloud.safran',
      'developer-jetlab.analytics.safran',
    ],
    proxy: {
      // keep if you use /api/...
      '/api': 'http://localhost:3001',

      // also handle direct endpoints like /slurries, /health, /user-prefs
      '/slurries': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
      '/user-prefs': 'http://localhost:3001',
    },
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts: [
      'js-806cdd3e-6896-40f7-8d07-5d82cb2bafdd.apps.dev.dc1.cloud.safran',
      'developer-jetlab.analytics.safran',
    ],
    proxy: {
      '/api': 'http://localhost:3001',
      '/slurries': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
      '/user-prefs': 'http://localhost:3001',
    },
  },
});