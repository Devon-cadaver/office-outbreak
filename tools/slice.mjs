// Slice sprites out of the big sheet using connected components over non-background pixels.
import sharp from 'sharp';
import fs from 'fs';
const SRC = 'example sprites/ALL.png';
const OUT = process.argv[2] || 'tools/out';
fs.mkdirSync(OUT, { recursive: true });
const img = sharp(SRC);
const meta = await img.metadata();
const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
console.log('size', W, H, 'channels', info.channels);
const isBg = (i) => {
  const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
  if (a < 10) return true;
  if (r > 225 && g > 225 && b > 225) return true; // white-ish
  return false;
};
// downsample mask by 4 for speed of labeling
const S = 4; const w = Math.ceil(W / S), h = Math.ceil(H / S);
const mask = new Uint8Array(w * h);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!isBg((y * W + x) * 4)) mask[((y / S) | 0) * w + ((x / S) | 0)] = 1;
}
// dilate mask a bit so limbs join bodies
const dil = new Uint8Array(w * h); const R = 2;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < h && xx >= 0 && xx < w) dil[yy * w + xx] = 1;
  }
}
const label = new Int32Array(w * h); let boxes = [];
const stack = [];
for (let i = 0; i < w * h; i++) if (dil[i] && !label[i]) {
  const id = boxes.length + 1; let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1, cnt = 0;
  stack.push(i); label[i] = id;
  while (stack.length) {
    const p = stack.pop(); const px = p % w, py = (p / w) | 0; cnt++;
    if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const xx = px + dx, yy = py + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = yy * w + xx; if (dil[q] && !label[q]) { label[q] = id; stack.push(q); }
    }
  }
  boxes.push({ id, x: minx * S, y: miny * S, w: (maxx - minx + 1) * S, h: (maxy - miny + 1) * S, cnt });
}
boxes = boxes.filter(b => b.w > 60 && b.h > 60);
boxes.sort((a, b) => (Math.round(a.y / 300) - Math.round(b.y / 300)) || (a.x - b.x));
console.log('components', boxes.length);
fs.writeFileSync(`${OUT}/boxes.json`, JSON.stringify(boxes, null, 1));
let n = 0;
for (const b of boxes) {
  const x = Math.max(0, b.x - 4), y = Math.max(0, b.y - 4);
  const bw = Math.min(W - x, b.w + 8), bh = Math.min(H - y, b.h + 8);
  await sharp(SRC).extract({ left: x, top: y, width: bw, height: bh }).png().toFile(`${OUT}/c${String(n).padStart(3,'0')}_${x}_${y}_${bw}x${bh}.png`);
  n++;
}
console.log('wrote', n);
