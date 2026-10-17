import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2019',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), poster: resolve(__dirname, 'poster.html'), editor: resolve(__dirname, 'editor.html'), deadcity: resolve(__dirname, 'deadcity.html') } },
  },
});
