import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { cp, mkdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default defineConfig(({ mode }) => {
  // Unprefixed secrets are available only to the Node development API.
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);
  return {
    plugins: [react(), {
      name: 'photobooth-local-api',
      configureServer(server) {
        server.middlewares.use('/api/generate', async (req: IncomingMessage, res: ServerResponse) => {
          const { default: handler } = await import('./api/generate.mjs');
          await handler(req, res);
        });
      },
      async closeBundle() {
        await mkdir('dist/Assets', { recursive: true });
        await cp('Assets', 'dist/Assets', { recursive: true });
        await cp('StarVille-Logo.png', 'dist/StarVille-Logo.png');
      },
    }],
    server: { port: 5173 },
  };
});
