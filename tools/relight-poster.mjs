// Build a clean night poster: the vector art without people or cars, relit with the painted poster's lighting.
// out = dayClean * blur(nightJPG) / blur(dayFull), computed on a coarse grid and sampled bilinearly.
import fs from 'fs';
import sharp from 'sharp';
import { execFileSync } from 'child_process';

const AI = 'example sprites/illustrator/ISO/_Flat_tobe main_Flat.ai';
const NIGHT = 'example sprites/_FINAL-NIGHT2.jpg';
const OUT = 'tools/poster/build/night-clean.png';
const SCALE = +process.argv[2] || 2;
const W = Math.round(1170 * SCALE), H = Math.round(2826 * SCALE);
const CLEAN = 'coaster,upper buildings,tree,accedent,sk8 park,GRASS,Houses,poster,upper poles,gas station,watersuply,Light Poles,Telaphone poles,potato field,Layer 21,water,ROADS,LINES ON ROADS,seans house,lower lines';
const FULL = CLEAN + ',free way cars,lower cars,CAR PLACE HOLDERS,Town people,school zombies,lower zombies,Zombies_Sub-Sk8,zombots,Bikers,people test';

const render = (name, layers) => {
  const out = `tools/poster/build/${name}.png`; fs.mkdirSync('tools/poster/build', { recursive: true });
  if (!fs.existsSync(out)) { try { execFileSync('node', ['--max-old-space-size=8192', 'tools/ai-layers.mjs', AI, String(SCALE), out, layers], { stdio: 'ignore' }); } catch { /* exit crash after write */ } if (!fs.existsSync(out)) throw new Error('render failed: ' + name); }
  return out;
};
const bg = '#1f3b3a';
const night = await sharp(NIGHT).resize(W, H, { fit: 'fill' }).raw().toBuffer();
const dayClean = await sharp(render('day-clean2', CLEAN)).flatten({ background: bg }).raw().toBuffer();
const dayFull = await sharp(render('day-full', FULL)).flatten({ background: bg }).raw().toBuffer();

const G = 10, gw = Math.ceil(W / G), gh = Math.ceil(H / G), RAD = +process.argv[3] || 5;
const sN = new Float64Array(gw * gh * 3), sD = new Float64Array(gw * gh * 3), cnt = new Float64Array(gw * gh);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, g = ((y / G) | 0) * gw + ((x / G) | 0); cnt[g]++; for (let c = 0; c < 3; c++) { sN[g * 3 + c] += night[i * 3 + c]; sD[g * 3 + c] += dayFull[i * 3 + c]; } }
const bN = new Float64Array(gw * gh * 3), bD = new Float64Array(gw * gh * 3), bC = new Float64Array(gw * gh);
for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
  let c = 0; const n = [0, 0, 0], d = [0, 0, 0];
  for (let dy = -RAD; dy <= RAD; dy++) for (let dx = -RAD; dx <= RAD; dx++) { const yy = gy + dy, xx = gx + dx; if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue; const wgt = 1 / (1 + dx * dx + dy * dy); const g = yy * gw + xx; c += cnt[g] * wgt; for (let k = 0; k < 3; k++) { n[k] += sN[g * 3 + k] * wgt; d[k] += sD[g * 3 + k] * wgt; } }
  const g = gy * gw + gx; bC[g] = c; for (let k = 0; k < 3; k++) { bN[g * 3 + k] = n[k]; bD[g * 3 + k] = d[k]; }
}
const out = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  const fx = x / G - 0.5, fy = y / G - 0.5; const x0 = Math.max(0, Math.min(gw - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(gh - 2, Math.floor(fy))); const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
  const ws = [[y0 * gw + x0, (1 - tx) * (1 - ty)], [y0 * gw + x0 + 1, tx * (1 - ty)], [(y0 + 1) * gw + x0, (1 - tx) * ty], [(y0 + 1) * gw + x0 + 1, tx * ty]];
  let cw = 0; for (const [g, wgt] of ws) cw += bC[g] * wgt;
  let ln = 0, ld = 0; for (const [g, wgt] of ws) { ln += (bN[g * 3] * 0.3 + bN[g * 3 + 1] * 0.59 + bN[g * 3 + 2] * 0.11) * wgt; ld += (bD[g * 3] * 0.3 + bD[g * 3 + 1] * 0.59 + bD[g * 3 + 2] * 0.11) * wgt; }
  const ratio = Math.min(1.5, Math.max(0.12, (ln / cw + 3) / (ld / cw + 3)));
  const r = dayClean[i * 3], gch = dayClean[i * 3 + 1], b = dayClean[i * 3 + 2];
  const nl = night[i * 3] * 0.3 + night[i * 3 + 1] * 0.59 + night[i * 3 + 2] * 0.11; // the painted poster is bright here only at real light sources
  const yellow = r > 150 && gch > 130 && b < 110 && nl > 110 ? 1 : 0;
  const tint = yellow ? [1.15, 1.1, 0.9] : [0.72, 0.9, 0.98];
  const boost = yellow ? Math.max(ratio, 0.9) : ratio;
  out[i * 3] = Math.max(0, Math.min(255, Math.round(r * boost * tint[0])));
  out[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(gch * boost * tint[1])));
  out[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(b * boost * tint[2])));
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 6 }).toFile(OUT);
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).resize({ width: 900 }).jpeg({ quality: 82 }).toFile('tools/poster/night-clean-preview.jpg');
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).extract({ left: 0, top: 4200, width: 1400, height: 1000 }).resize({ width: 900 }).jpeg({ quality: 82 }).toFile('tools/poster/clean-crop2.jpg');
console.log('wrote', OUT);
