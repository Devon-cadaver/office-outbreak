import { defineConfig } from 'vite';
import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

// dev server only: the map builders' "Send map to Claude" posts here and the map lands in maps/
const saveMap = {
  name: 'save-map',
  configureServer(server) {
    server.middlewares.use('/__save-map', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST only'); }
      let body = ''; req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
      req.on('end', () => {
        try {
          const { name, map } = JSON.parse(body); if (!map || !Array.isArray(map.cells)) throw new Error('not a map');
          const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
          const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
          const file = 'maps/' + stamp + (slug ? '-' + slug : '') + '.json';
          mkdirSync(resolve(__dirname, 'maps'), { recursive: true }); writeFileSync(resolve(__dirname, file), JSON.stringify({ name: name || '', savedAt: new Date().toISOString(), ...map }));
          res.end(file);
        } catch (e) { res.statusCode = 400; res.end(String(e.message || e)); }
      });
    });
  },
};
export default defineConfig({
  base: './',
  plugins: [saveMap],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2019',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), zombieville: resolve(__dirname, 'zombieville.html'), store: resolve(__dirname, 'store.html'), editor: resolve(__dirname, 'editor.html'), deadcity: resolve(__dirname, 'deadcity.html'), tornado: resolve(__dirname, 'tornado.html'), kaiju: resolve(__dirname, 'kaiju.html') } },
  },
});
