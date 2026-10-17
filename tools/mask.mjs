// Classify poster cells as walkable (smooth dark asphalt) vs blocked. Writes grid JSON + overlay preview.
import sharp from 'sharp';
import fs from 'fs';
const SRC = 'example sprites/_FINAL-NIGHT2.jpg';
const CELLPX = +process.argv[2] || 96; // poster pixels per grid cell
const meta = await sharp(SRC).metadata();
const cols = Math.floor(meta.width / CELLPX), rows = Math.floor(meta.height / CELLPX);
// downsample to 4 samples per cell for speed
const S = 4; const { data, info } = await sharp(SRC).resize(cols * S, rows * S, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
const grid = [];
for (let y = 0; y < rows; y++) { const row = []; for (let x = 0; x < cols; x++) {
  let n = 0, sr = 0, sg = 0, sb = 0, sl2 = 0, sl = 0;
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const i = ((y * S + dy) * info.width + (x * S + dx)) * 3; const r = data[i], g = data[i + 1], b = data[i + 2]; const l = (r + g + b) / 3; sr += r; sg += g; sb += b; sl += l; sl2 += l * l; n++; }
  const r = sr / n, g = sg / n, b = sb / n, l = sl / n, sd = Math.sqrt(Math.max(0, sl2 / n - l * l));
  const maxc = Math.max(r, g, b), minc = Math.min(r, g, b), sat = maxc ? (maxc - minc) / maxc : 0;
  // asphalt: dark, bluish-grey, low saturation, smooth
  const walk = l > 14 && l < 70 && sat < 0.45 && b >= r && sd < 14;
  row.push(walk ? 1 : 0);
} grid.push(row); }
fs.writeFileSync('tools/poster/grid.json', JSON.stringify({ cellpx: CELLPX, cols, rows, grid }));
// overlay
const svgRects = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid[y][x]) svgRects.push(`<rect x="${x * CELLPX}" y="${y * CELLPX}" width="${CELLPX}" height="${CELLPX}" fill="#00ff88" fill-opacity="0.35"/>`);
const svg = Buffer.from(`<svg width="${meta.width}" height="${meta.height}">${svgRects.join('')}</svg>`);
await sharp(SRC).composite([{ input: svg }]).resize({ width: 900 }).jpeg({ quality: 80 }).toFile('tools/poster/mask-overlay.jpg');
const count = grid.flat().filter(Boolean).length; console.log('cells', cols, rows, 'walkable', count, (100 * count / (cols * rows)).toFixed(1) + '%');
