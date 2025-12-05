import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import wasm from 'vite-plugin-wasm';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), wasm()],
  build: {
    target: 'esnext',
    minify: false
  },
  server: {
    hmr: {
        host: 'localhost',
    },
    watch: {
        usePolling: true
    }
  },
  define: {
    "process.env.IS_PREACT": JSON.stringify("false"),
    "process.env.NODE_ENV": JSON.stringify("development")
  }
});

