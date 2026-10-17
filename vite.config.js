import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2019',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), zombieville: resolve(__dirname, 'zombieville.html'), store: resolve(__dirname, 'store.html'), editor: resolve(__dirname, 'editor.html'), deadcity: resolve(__dirname, 'deadcity.html') } },
  },
});
