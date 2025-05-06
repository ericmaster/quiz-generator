import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
// import postcss from './postcss.config.cjs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // css: {
  //   postcss,
  // },
});
