/* Allow using process without @types/node installed */
declare const process: { env?: Record<string, string | undefined> } | undefined;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allowedHosts = String(process?.env?.VITE_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const proxy = {
  // keep if you use /api/...
  '/api': 'http://localhost:3001',

  // also handle direct endpoints like /slurries, /health, /user-prefs
  '/slurries': 'http://localhost:3001',
  '/health': 'http://localhost:3001',
  '/user-prefs': 'http://localhost:3001',
};

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts,
    proxy,
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts,
    proxy,
  },
});
