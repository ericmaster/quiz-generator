import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { existsSync } from 'fs';

let localConfig = {};
if (existsSync('./vite.config.local.js')) {
  const localConfigPath = './vite.config.local.js';
  localConfig = await import(localConfigPath).then(
    (module) => module.default
  );
}

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  ...(process.env.VITEST ? {
    resolve: {
      conditions: ['browser']
    }
  } : {}),
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
  },
  ...localConfig,
});
