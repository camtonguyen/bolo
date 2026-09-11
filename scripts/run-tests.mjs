// Executes every src/**/*.test.ts file through Vite's SSR module loader, so
// their plain relative imports resolve exactly as they do in the app — no
// test framework, no build step of its own.
import { createServer } from 'vite';
import { readdirSync } from 'node:fs';

const testFiles = readdirSync('src', { recursive: true })
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => `/src/${f.split('\\').join('/')}`);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  for (const file of testFiles) await server.ssrLoadModule(file);
} finally {
  await server.close();
}
