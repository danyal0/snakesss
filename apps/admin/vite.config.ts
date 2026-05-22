import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // In production the server serves admin at /admin, so build with that base
  base: '/admin',
  plugins: [react()],
  server: {
    port: 5174,
    // Admin dev server also proxies socket/api to backend
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
  resolve: { alias: { '@': '/src' } },
});
