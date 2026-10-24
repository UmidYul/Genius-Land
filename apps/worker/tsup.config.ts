import { defineConfig } from 'tsup';

// Workspace packages ship TypeScript sources, so they are bundled into the worker;
// npm dependencies (Prisma, pg-boss) stay external and are resolved from node_modules.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  noExternal: [/^@gl\//],
});
