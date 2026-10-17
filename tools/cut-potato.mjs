// Cut the potato monster out of the cleaned night image using its vector layer alpha,
// and paint the ground under it with nearby field colour so the sprite can roam.
import fs from 'fs';
import sharp from 'sharp';
const W = 2340, H = 5652;
const clean = 'tools/poster/build/night-clean.png';
const layer = await sharp('tools/poster/build/potato.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const img = await sharp(clean).raw().toBuffer({ resolveWithObject: true });
// monster bbox (from inspection), excluding the field rows below it
const X0 = 1780, Y0 = 4540, X1 = 2310, Y1 = 5300;
const w = X1 - X0, h = Y1 - Y0;
const rgba = Buffer.alloc(w * h * 4);
let bottom = 0, bxs = [];
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const gi = (Y0 + y) * W + (X0 + x); const a = layer.data[gi * 4 + 3];
  rgba[(y * w + x) * 4] = img.data[gi * 3]; rgba[(y * w + x) * 4 + 1] = img.data[gi * 3 + 1]; rgba[(y * w + x) * 4 + 2] = img.data[gi * 3 + 2]; rgba[(y * w + x) * 4 + 3] = a;
  if (a > 40) { if (y > bottom) { bottom = y; bxs = [x]; } else if (y === bottom) bxs.push(x); }
}
await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toFile('public/poster/potato.png');
const ax = X0 + bxs.reduce((s, v) => s + v, 0) / bxs.length, ay = Y0 + bottom - 20; // anchor a little above the root tips
fs.writeFileSync('public/poster/potato.json', JSON.stringify({ x: X0, y: Y0, w, h, ax: Math.round(ax), ay: Math.round(ay) }));
// erase from the ground: fill masked pixels with the average of unmasked pixels in a ring around them (coarse)
const out = Buffer.from(img.data);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const gi = (Y0 + y) * W + (X0 + x); if (layer.data[gi * 4 + 3] <= 40) continue;
  // sample 8 directions until an unmasked pixel is found
  let r = 0, g = 0, b = 0, n = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    for (let k = 4; k < 400; k += 4) { const xx = X0 + x + dx * k, yy = Y0 + y + dy * k; if (xx < 0 || yy < 0 || xx >= W || yy >= H) break; const j = yy * W + xx; if (layer.data[j * 4 + 3] <= 40) { r += img.data[j * 3]; g += img.data[j * 3 + 1]; b += img.data[j * 3 + 2]; n++; break; } }
  }
  if (n) { out[gi * 3] = r / n; out[gi * 3 + 1] = g / n; out[gi * 3 + 2] = b / n; }
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 6 }).toFile(clean);
console.log('potato sprite', w, 'x', h, 'anchor', Math.round(ax), Math.round(ay));
