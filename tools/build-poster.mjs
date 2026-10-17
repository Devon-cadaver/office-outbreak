// Build poster-world assets from the night JPG + the final Illustrator layers.
// Outputs to public/poster/: ground tiles, structure tiles (night pixels masked by vector alpha),
// a strip manifest for depth-sorted occluders, a walk grid, and metadata.
import fs from 'fs';
import sharp from 'sharp';
import { execFileSync } from 'child_process';

const AI = 'example sprites/illustrator/ISO/_Flat_tobe main_Flat.ai';
const NIGHT = 'example sprites/_FINAL-NIGHT2.jpg';
const OUT = 'public/poster';
const SCALE = +process.argv[2] || 2;
const W = Math.round(1170 * SCALE), H = Math.round(2826 * SCALE);
const TILESX = 2, TILESY = 4, TW = Math.ceil(W / TILESX), TH = Math.ceil(H / TILESY);
const CELL = 24, STRIP = 40;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg')) fs.unlinkSync(`${OUT}/${f}`);

const render = (name, layers) => {
  const out = `tools/poster/build/${name}.png`; fs.mkdirSync('tools/poster/build', { recursive: true });
  if (!fs.existsSync(out)) { try { execFileSync('node', ['--max-old-space-size=8192', 'tools/ai-layers.mjs', AI, String(SCALE), out, layers], { stdio: 'ignore' }); } catch { /* node may crash on exit after writing */ } if (!fs.existsSync(out)) throw new Error('render failed: ' + name); }
  return out;
};

const night = await sharp(NIGHT).resize(W, H, { fit: 'fill' }).raw().toBuffer();

// 1. ground tiles
for (let ty = 0; ty < TILESY; ty++) for (let tx = 0; tx < TILESX; tx++) {
  const left = tx * TW, top = ty * TH, w = Math.min(TW, W - left), h = Math.min(TH, H - top);
  await sharp(night, { raw: { width: W, height: H, channels: 3 } }).extract({ left, top, width: w, height: h }).jpeg({ quality: 74 }).toFile(`${OUT}/ground_${tx}_${ty}.jpg`);
}
console.log('ground tiles', TILESX, 'x', TILESY, TW, 'x', TH);

// 2. walk grid
const roads = await sharp(render('roads', 'ROADS')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const cars = await sharp(render('cars', 'lower cars,free way cars')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const isRoad = (x, y) => { const i = (y * W + x) * 4, d = roads.data; return d[i + 3] > 30 && d[i] < 175 && Math.abs(d[i] - d[i + 2]) < 25; };
const isCar = (x, y) => cars.data[(y * W + x) * 4 + 3] > 60;
const gcols = Math.floor(W / CELL), grows = Math.floor(H / CELL);
const grid = new Uint8Array(gcols * grows); let walk = 0;
for (let gy = 0; gy < grows; gy++) for (let gx = 0; gx < gcols; gx++) {
  let road = 0, car = 0, n = 0;
  for (let y = gy * CELL + 2; y < (gy + 1) * CELL; y += 4) for (let x = gx * CELL + 2; x < (gx + 1) * CELL; x += 4) { n++; if (isRoad(x, y)) road++; if (isCar(x, y)) car++; }
  const ok = road / n > 0.55 && car / n < 0.2; grid[gy * gcols + gx] = ok ? 1 : 0; if (ok) walk++;
}
console.log('walk grid', gcols, 'x', grows, 'walkable', walk);

// 3. structures: alpha from vector layers, colour from the night poster; tiles + vertical strips
const st = await sharp(render('structures', 'Houses,upper buildings,gas station,watersuply,coaster,seans house,accedent,poster,shocking,tree,Light Poles,lower cars,free way cars')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { rgba[i * 4] = night[i * 3]; rgba[i * 4 + 1] = night[i * 3 + 1]; rgba[i * 4 + 2] = night[i * 3 + 2]; rgba[i * 4 + 3] = st.data[i * 4 + 3]; }
for (let ty = 0; ty < TILESY; ty++) for (let tx = 0; tx < TILESX; tx++) {
  const left = tx * TW, top = ty * TH, w = Math.min(TW, W - left), h = Math.min(TH, H - top);
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).extract({ left, top, width: w, height: h }).webp({ quality: 80, alphaQuality: 90 }).toFile(`${OUT}/struct_${tx}_${ty}.webp`);
}
// strips: for each STRIP-wide column, find runs of rows with any alpha; each run becomes a quad anchored at its bottom
const strips = [];
for (let x0 = 0; x0 < W; x0 += STRIP) {
  const w = Math.min(STRIP, W - x0);
  const rowHas = new Uint8Array(H);
  for (let y = 0; y < H; y++) for (let x = x0; x < x0 + w; x++) if (st.data[(y * W + x) * 4 + 3] > 40) { rowHas[y] = 1; break; }
  let y = 0;
  while (y < H) {
    if (!rowHas[y]) { y++; continue; }
    let y1 = y; let gap = 0;
    while (y1 < H && gap < 6) { if (rowHas[y1]) gap = 0; else gap++; y1++; }
    const yEnd = y1 - gap; // exclusive
    if (yEnd - y >= 6) strips.push([x0, y, w, yEnd - y]);
    y = y1;
  }
}
console.log('strips', strips.length);

fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify({ width: W, height: H, scale: SCALE, tilesX: TILESX, tilesY: TILESY, tw: TW, th: TH, cell: CELL, gcols, grows, strips }));
fs.writeFileSync(`${OUT}/walk.bin`, Buffer.from(grid));
console.log('done', W, H);
