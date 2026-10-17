// Poster world: the night painting as the ground, vector-masked structures as depth-sorted strips.
// Image pixel space (u right, v down) maps to a y=0 ground plane seen by a true isometric camera.
import * as THREE from 'three';

export const PPU = 50;                       // image pixels per world unit (along screen axes)
const E = Math.atan(1 / Math.SQRT2);         // true isometric elevation, 35.264 deg (30-degree lines)
const S45 = Math.SQRT1_2;
export const A = S45 * PPU;                  // px per unit of (wx - wz)
export const B = S45 * Math.sin(E) * PPU;    // px per unit of (wx + wz)
export const CAM_DIR = new THREE.Vector3(S45 * Math.cos(E), Math.sin(E), S45 * Math.cos(E)).normalize();
export const RIGHT = new THREE.Vector3(S45, 0, -S45);
export const UP = new THREE.Vector3(-S45 * Math.sin(E), Math.cos(E), -S45 * Math.sin(E));

let meta = null, cx = 0, cy = 0;
export const pxToWorld = (u, v) => { const p = (u - cx) / A, q = (v - cy) / B; return { x: (p + q) / 2, z: (q - p) / 2 }; };
export const worldToPx = (x, z) => ({ u: cx + (x - z) * A, v: cy + (x + z) * B });

export async function loadWorld(scene, base = 'poster/') {
  meta = await (await fetch(base + 'meta.json')).json();
  cx = meta.width / 2; cy = meta.height / 2;
  const walk = new Uint8Array(await (await fetch(base + 'walk.bin')).arrayBuffer());
  const loader = new THREE.TextureLoader();
  const tex = (url) => new Promise((res, rej) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; res(t); }, undefined, rej));
  const group = new THREE.Group(); scene.add(group);

  // ground quads
  for (let ty = 0; ty < meta.tilesY; ty++) for (let tx = 0; tx < meta.tilesX; tx++) {
    const t = await tex(`${base}ground_${tx}_${ty}.jpg`);
    const x0 = tx * meta.tw, y0 = ty * meta.th, w = Math.min(meta.tw, meta.width - x0), h = Math.min(meta.th, meta.height - y0);
    const corners = [[x0, y0 + h], [x0 + w, y0 + h], [x0, y0], [x0 + w, y0]]; // bl, br, tl, tr
    const pos = []; for (const [u, v] of corners) { const p = pxToWorld(u, v); pos.push(p.x, 0, p.z); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    g.setIndex([0, 1, 2, 2, 1, 3]); g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t })));
  }

  // structure strips, batched per tile as camera-facing quads anchored at their bottom pixel row
  for (let ty = 0; ty < meta.tilesY; ty++) for (let tx = 0; tx < meta.tilesX; tx++) {
    const x0 = tx * meta.tw, y0 = ty * meta.th, w = Math.min(meta.tw, meta.width - x0), h = Math.min(meta.th, meta.height - y0);
    const pos = [], uv = [], idx = []; let n = 0;
    for (const [sx, sy, sw, sh] of meta.strips) {
      if (sx + sw <= x0 || sx >= x0 + w) continue;
      const ya = Math.max(sy, y0), yb = Math.min(sy + sh, y0 + h); if (yb <= ya) continue; // part of the strip inside this tile
      const ax = sx + sw / 2, ay = sy + sh; // anchor at the strip's bottom (ground contact)
      const G = pxToWorld(ax, ay);
      const corner = (px, py) => { const r = (px - ax) / PPU, u = (ay - py) / PPU; return [G.x + RIGHT.x * r + UP.x * u, UP.y * u, G.z + RIGHT.z * r + UP.z * u]; };
      for (const [px, py] of [[sx, yb], [sx + sw, yb], [sx, ya], [sx + sw, ya]]) { pos.push(...corner(px, py)); uv.push((px - x0) / w, 1 - (py - y0) / h); }
      idx.push(n, n + 1, n + 2, n + 2, n + 1, n + 3); n += 4;
    }
    if (!n) continue;
    const t = await tex(`${base}struct_${tx}_${ty}.webp`);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.userData.struct = true; group.add(m);
  }

  // walk grid helpers (cells in image pixels)
  const cell = meta.cell, gcols = meta.gcols, grows = meta.grows;
  const cellOf = (x, z) => { const p = worldToPx(x, z); return { cx: Math.floor(p.u / cell), cy: Math.floor(p.v / cell) }; };
  const cellCenter = (c, r) => pxToWorld((c + 0.5) * cell, (r + 0.5) * cell);
  const open = (c, r) => c >= 0 && r >= 0 && c < gcols && r < grows && walk[r * gcols + c] === 1;
  const bounds = { minX: 0, maxX: meta.width, minY: 0, maxY: meta.height };
  return { meta, group, walk, cell, gcols, grows, cellOf, cellCenter, open, bounds };
}

// BFS distance field over the walk grid from a target cell (-1 = unreachable)
export function flowField(world, tc, tr) {
  const { gcols, grows, open } = world;
  const dist = new Int32Array(gcols * grows).fill(-1);
  if (!open(tc, tr)) return dist;
  const q = new Int32Array(gcols * grows); let qh = 0, qt = 0;
  q[qt++] = tr * gcols + tc; dist[tr * gcols + tc] = 0;
  while (qh < qt) {
    const p = q[qh++], c = p % gcols, r = (p / gcols) | 0, d = dist[p];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr; if (!open(nc, nr)) continue;
      const np = nr * gcols + nc; if (dist[np] >= 0) continue; dist[np] = d + 1; q[qt++] = np;
    }
  }
  return dist;
}

export function findPath(world, from, to) {
  const { gcols } = world; const dist = flowField(world, to.cx, to.cy);
  if (dist[from.cy * gcols + from.cx] < 0) return [];
  const path = []; let c = from.cx, r = from.cy;
  while (!(c === to.cx && r === to.cy)) {
    let best = null, bd = dist[r * gcols + c];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (!world.open(nc, nr)) continue; const d = dist[nr * gcols + nc]; if (d >= 0 && d < bd) { bd = d; best = [nc, nr]; } }
    if (!best) break; [c, r] = best; path.push([c, r]);
  }
  return path;
}

// Nearest open cell to a given cell (spiral search)
export function nearestOpen(world, c, r, maxR = 20) {
  if (world.open(c, r)) return { cx: c, cy: r };
  for (let rad = 1; rad <= maxR; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) if (Math.max(Math.abs(dr), Math.abs(dc)) === rad && world.open(c + dc, r + dr)) return { cx: c + dc, cy: r + dr };
  return null;
}
