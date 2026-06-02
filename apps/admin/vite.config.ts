import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Redirect bare :5174/ to /admin/ so React Router basename works in dev. */
function adminRootRedirect() {
  return {
    name: 'admin-root-redirect',
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { writeHead: (code: number, h: Record<string, string>) => void; end: () => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '') {
          res.writeHead(302, { Location: '/admin/' });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  // In production the server serves admin at /admin, so build with that base
  base: '/admin',
  plugins: [react(), adminRootRedirect()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    open: '/admin/',
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
  resolve: { alias: { '@': '/src' } },
});
