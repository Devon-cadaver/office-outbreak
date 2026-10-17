// Erase the painted people and zombies from the night poster.
// Mask = character layers from the final vector file. Fill = day render without characters,
// re-tinted with the local night/day colour ratio measured on the surrounding unmasked pixels.
import fs from 'fs';
import sharp from 'sharp';
import { execFileSync } from 'child_process';

const AI = 'example sprites/illustrator/ISO/_Flat_tobe main_Flat.ai';
const NIGHT = 'example sprites/_FINAL-NIGHT2.jpg';
const OUT = 'tools/poster/build/night-clean.png';
const SCALE = +process.argv[2] || 2;
const W = Math.round(1170 * SCALE), H = Math.round(2826 * SCALE);
const PEOPLE = 'Town people,school zombies,lower zombies,Zombies_Sub-Sk8,zombots,Bikers,people test,lower cars,free way cars,CAR PLACE HOLDERS';
const ALL = 'Layer 10,coaster,upper buildings,tree,accedent,sk8 park,GRASS,Houses,poster,shocking,upper poles,gas station,watersuply,Light Poles,Layer 29,Layer 23,Telaphone poles,Layer 19,potato field,Fire and smoke,Layer 21,water,ROADS,LINES ON ROADS,seans house,lower lines,Layer 30';

const render = (name, layers) => {
  const out = `tools/poster/build/${name}.png`; fs.mkdirSync('tools/poster/build', { recursive: true });
  if (!fs.existsSync(out)) { try { execFileSync('node', ['--max-old-space-size=8192', 'tools/ai-layers.mjs', AI, String(SCALE), out, layers], { stdio: 'ignore' }); } catch { /* exit crash after write */ } if (!fs.existsSync(out)) throw new Error('render failed: ' + name); }
  return out;
};

const night = await sharp(NIGHT).resize(W, H, { fit: 'fill' }).raw().toBuffer();
const people = await sharp(render('people2', PEOPLE)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const day = await sharp(render('day-nopeople2', ALL)).flatten({ background: '#1f3b3a' }).raw().toBuffer({ resolveWithObject: true });

// mask: character alpha, dilated by DIL px (glowing eyes and soft edges in the painting spill a little)
const DIL = 7;
const m0 = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (people.data[i * 4 + 3] > 25) m0[i] = 1;
const mask = new Uint8Array(W * H);
// separable dilation (square)
const tmp = new Uint8Array(W * H);
for (let y = 0; y < H; y++) { let run = 0; for (let x = 0; x < W + DIL; x++) { if (x < W && m0[y * W + x]) run = 2 * DIL + 1; if (run > 0 && x - DIL >= 0 && x - DIL < W) tmp[y * W + x - DIL] = 1; if (run > 0) run--; } }
for (let x = 0; x < W; x++) { let run = 0; for (let y = 0; y < H + DIL; y++) { if (y < H && tmp[y * W + x]) run = 2 * DIL + 1; if (run > 0 && y - DIL >= 0 && y - DIL < H) mask[(y - DIL) * W + x] = 1; if (run > 0) run--; } }
let masked = 0; for (let i = 0; i < W * H; i++) masked += mask[i];
console.log('masked px', masked, (100 * masked / (W * H)).toFixed(2) + '%');

// local night/day ratio on a coarse grid using unmasked pixels (normalized box filter)
const G = 12, gw = Math.ceil(W / G), gh = Math.ceil(H / G);
const sumN = new Float64Array(gw * gh * 3), sumD = new Float64Array(gw * gh * 3), cnt = new Float64Array(gw * gh);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (mask[i]) continue; const g = ((y / G) | 0) * gw + ((x / G) | 0); cnt[g]++; for (let c = 0; c < 3; c++) { sumN[g * 3 + c] += night[i * 3 + c]; sumD[g * 3 + c] += day.data[i * 3 + c]; } }
// blur the sums over a radius so masked cells get neighbours' statistics
const RAD = 4; const bN = new Float64Array(gw * gh * 3), bD = new Float64Array(gw * gh * 3), bC = new Float64Array(gw * gh);
for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
  let c = 0; const n = [0, 0, 0], d = [0, 0, 0];
  for (let dy = -RAD; dy <= RAD; dy++) for (let dx = -RAD; dx <= RAD; dx++) { const yy = gy + dy, xx = gx + dx; if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue; const g = yy * gw + xx; c += cnt[g]; for (let k = 0; k < 3; k++) { n[k] += sumN[g * 3 + k]; d[k] += sumD[g * 3 + k]; } }
  const g = gy * gw + gx; bC[g] = c; for (let k = 0; k < 3; k++) { bN[g * 3 + k] = n[k]; bD[g * 3 + k] = d[k]; }
}
const out = Buffer.from(night);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x; if (!mask[i]) continue;
  // bilinear sample of the blurred statistics
  const fx = x / G - 0.5, fy = y / G - 0.5; const x0 = Math.max(0, Math.min(gw - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(gh - 2, Math.floor(fy))); const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
  const ws = [[y0 * gw + x0, (1 - tx) * (1 - ty)], [y0 * gw + x0 + 1, tx * (1 - ty)], [(y0 + 1) * gw + x0, (1 - tx) * ty], [(y0 + 1) * gw + x0 + 1, tx * ty]];
  let cw = 0; for (const [g, wgt] of ws) cw += bC[g] * wgt; if (cw < 1) continue;
  for (let k = 0; k < 3; k++) {
    let sn = 0, sd = 0; for (const [g, wgt] of ws) { sn += bN[g * 3 + k] * wgt; sd += bD[g * 3 + k] * wgt; }
    const mn = sn / cw, md = sd / cw;
    // affine match: scale by mean ratio, keep some of the day contrast
    const v = md > 1 ? day.data[i * 3 + k] * (mn / md) : mn;
    out[i * 3 + k] = Math.max(0, Math.min(255, Math.round(v)));
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 6 }).toFile(OUT);
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).resize({ width: 900 }).jpeg({ quality: 82 }).toFile('tools/poster/night-clean-preview.jpg');
console.log('wrote', OUT);
