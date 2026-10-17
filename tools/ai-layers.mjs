// Render chosen Illustrator (PDF-compatible) layers to PNG using pdf.js optional content groups.
// usage: node tools/ai-layers.mjs <file.ai> <scale> <out.png> [layerName,...]   (no layers = all visible)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const [file, scaleArg, out, layersArg] = process.argv.slice(2);
const scale = +scaleArg || 1;
const want = layersArg ? layersArg.split(',').map(s => s.trim()) : null;

class NodeCanvasFactory {
  create(w, h) { const canvas = createCanvas(w, h); return { canvas, context: canvas.getContext('2d') }; }
  reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
  destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; cc.canvas = null; cc.context = null; }
}

const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data, canvasFactory: new NodeCanvasFactory(), isEvalSupported: false, useSystemFonts: false, disableFontFace: true }).promise;
const page = await doc.getPage(1);
const occ = await doc.getOptionalContentConfig();
const groups = occ.getGroups ? occ.getGroups() : null;
const names = [];
if (groups) for (const [id, g] of Object.entries(groups)) { names.push(g.name); const on = !want || want.includes(g.name); occ.setVisibility(id, on); }
console.log('layers:', names.join(' | '));
if (want) console.log('visible:', want.filter(n => names.includes(n)).join(', '), '| missing:', want.filter(n => !names.includes(n)).join(', ') || 'none');

const viewport = page.getViewport({ scale });
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
const ctx = canvas.getContext('2d');
await page.render({ canvasContext: ctx, viewport, background: 'rgba(0,0,0,0)', optionalContentConfigPromise: Promise.resolve(occ), canvasFactory: new NodeCanvasFactory() }).promise;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log('wrote', out, canvas.width + 'x' + canvas.height);
