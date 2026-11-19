// The countryside round a town: what shows past the last street when the camera pulls back or the storm is at the edge.
// Fields, a ring road with country roads running out from the avenues, woods, farms with a light on, ponds and a ring of
// low hills on the horizon. It is scenery only (nothing here can be wrecked or walked on), it never moves, and the whole
// of it is four meshes (the land, the trees as one batch, the buildings and hills, the lit windows), so it costs a phone
// next to nothing. The Wild West gets scrub, cactus and mesas; the Future gets glowing field lines and spires.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CELL, NIGHT, mulberry32 } from './city.js';
import { isPast, isFuture } from './era.js';

let last = null;
const PAL = {
  now: { ground: NIGHT.ground, fields: [0x2c5a44, 0x356a4c, 0x3f6238, 0x525f33, 0x22503f, 0x44503a, 0x5e6e38, 0x2a5a58], wood: 0x1f4238, road: 0x1c2628, dash: 0xb8a850, verge: 0x2f4f48, water: 0x2a6a8a, shore: 0x1c3c3c, leaf: [NIGHT.leaves, 0x246b50, 0x3a8a4a], trunk: NIGHT.trunk, hill: [0x1c3836, 0x2c5450], barn: [0x7a2a22, 0x6a3a2a, 0x8a8f96], roof: 0x2a2a30, house: 0xb0a890, yard: 0x4a4a38, lamp: 0xf6e94a },
  past: { ground: 0x8a6a44, fields: [0x7a6a3c, 0x93744a, 0x80603c, 0x6f6a40, 0x9a7a4c], wood: 0x7a5c38, road: 0x6a4f30, dash: null, verge: 0x7c5e3c, water: 0x3a7a8a, shore: 0x6a5a3a, leaf: [0x4a7a3a, 0x5a8a44, 0x3f6a36], trunk: 0x4a7a3a, hill: [0x7a4a30, 0x9a6a44], barn: [0x6a4a2c, 0x7a5a36, 0x5a4028], roof: 0x3a2a1c, house: 0x9a8260, yard: 0x7a5c38, lamp: 0xffb24a },
  future: { ground: NIGHT.ground, fields: [0x1f3f50, 0x234a5a, 0x1d3a44, 0x2a4460, 0x1a3440], wood: 0x183038, road: 0x101820, dash: 0x3af0ff, verge: 0x1c3a44, water: 0x2ad0e0, shore: 0x1a4a54, leaf: [0x2ea0a0, 0x2a8a9a, 0x3ab8a8], trunk: 0x3a4a5a, hill: [0x14222c, 0x2a6a7a], barn: [0xc8d0d8, 0x9aa6b4, 0xe0e6ec], roof: 0x2a3a4a, house: 0xd8dee6, yard: 0x223844, lamp: 0x3af0ff },
};

export function buildOutskirts(scene, cols, rows, seed = 1) {
  if (last) { if (last.parent) last.parent.remove(last); last.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); last = null; }
  const rng = mulberry32((seed | 0) * 31 + cols * 7 + 5), R = (a, b) => a + rng() * (b - a), pick = (l) => l[(rng() * l.length) | 0];
  const PAST = isPast(), FUT = isFuture(), pal = PAST ? PAL.past : FUT ? PAL.future : PAL.now;
  const hx = cols * CELL / 2, hz = rows * CELL / 2, EDGE = 8.5, REACH = 78, FAR = 340, RING = EDGE + 3.2, RW = 1.5; // EDGE: how far the town's own ground reaches. REACH: how far out the detail goes. RING: the ring road
  const g = new THREE.Group(); g.name = 'outskirts';

  // ---------- the land: every flat thing (ground, fields, roads, water) in one mesh, coloured by vertex ----------
  const P = [], C = [], col = new THREE.Color();
  const quad = (x0, z0, x1, z1, y, hex, shade = 1) => { col.setHex(hex).multiplyScalar(shade); for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z0], [x0, z1], [x1, z1]]) { P.push(x, y, z); C.push(col.r, col.g, col.b); } };
  const disc = (cx, cz, rx, rz, y, hex, n = 14, wob = 0) => { col.setHex(hex); const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832, k = 1 + (wob ? Math.sin(a * 3 + cx) * wob : 0); pts.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]); }
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; P.push(cx, y, cz, b[0], y, b[1], a[0], y, a[1]); for (let k = 0; k < 3; k++) C.push(col.r, col.g, col.b); } };
  quad(-FAR, -FAR, FAR, FAR, -0.09, pal.ground);
  // roads: a ring round the town, and a country road straight out from the end of each avenue
  const mid = (cols - 1) / 2, lines = [mid, ...(cols >= 33 ? [Math.round((cols - 1) / 4) | 1, Math.round((cols - 1) * 3 / 4) | 1] : [])].map((q) => (q - mid) * CELL);
  const rx = hx + RING, rz = hz + RING, roads = []; // [x0, z0, x1, z1]
  roads.push([-rx - RW, -rz - RW, rx + RW, -rz + RW], [-rx - RW, rz - RW, rx + RW, rz + RW], [-rx - RW, -rz, -rx + RW, rz], [rx - RW, -rz, rx + RW, rz]);
  for (const a of lines) roads.push([a - RW, -FAR, a + RW, -rz], [a - RW, rz, a + RW, FAR], [-FAR, a - RW, -rx, a + RW], [rx, a - RW, FAR, a + RW]);
  const onRoad = (x, z, pad) => roads.some((r) => x > r[0] - pad && x < r[2] + pad && z > r[1] - pad && z < r[3] + pad);
  for (const r of roads) { quad(r[0] - 0.5, r[1] - 0.5, r[2] + 0.5, r[3] + 0.5, -0.05, pal.verge); quad(r[0], r[1], r[2], r[3], -0.04, pal.road); }
  if (pal.dash) for (const a of lines) for (let d = 3; d < REACH + 30; d += 4.5) for (const s of [-1, 1]) { quad(a - 0.09, s * (rz + d) - 0.7, a + 0.09, s * (rz + d) + 0.7, -0.03, pal.dash, 0.8); quad(s * (rx + d) - 0.7, a - 0.09, s * (rx + d) + 0.7, a + 0.09, -0.03, pal.dash, 0.8); }
  if (FUT) for (const r of roads) { const lon = r[3] - r[1] > r[2] - r[0]; if (lon) for (const x of [r[0], r[2]]) quad(x - 0.06, r[1], x + 0.06, r[3], -0.03, 0x3af0ff, 0.7); else for (const z of [r[1], r[3]]) quad(r[0], z - 0.06, r[2], z + 0.06, -0.03, 0x3af0ff, 0.7); }
  // fields: a patchwork of plots out to REACH, some striped with crop rows, some left as woods or meadow
  const S = 13, spots = { wood: [], lone: [], farm: [], pond: [] }, n0 = Math.ceil((Math.max(hx, hz) + REACH) / S);
  for (let gz = -n0; gz <= n0; gz++) for (let gx = -n0; gx <= n0; gx++) { const cx = gx * S + ((gz & 1) ? S * 0.5 : 0), cz = gz * S; // every other row is half a plot along, so it does not read as a grid
    if (Math.abs(cx) < hx + EDGE + S * 0.5 && Math.abs(cz) < hz + EDGE + S * 0.5) continue; const out = Math.max(Math.abs(cx) - hx, Math.abs(cz) - hz); if (out > REACH) continue;
    const x0 = cx - S / 2 + 0.6, x1 = cx + S / 2 - 0.6, z0 = cz - S / 2 + 0.6, z1 = cz + S / 2 - 0.6, k = rng(), near = onRoad(cx, cz, S * 0.5);
    if (k < 0.56) { const hex = pick(pal.fields), sh = R(0.82, 1.12); quad(x0, z0, x1, z1, -0.07, hex, sh);
      if (rng() < 0.45) { const rowsN = 6, alongX = rng() < 0.5; for (let i = 0; i < rowsN; i++) { if (i & 1) continue; const a = i / rowsN, b = (i + 1) / rowsN; if (alongX) quad(x0, z0 + (z1 - z0) * a, x1, z0 + (z1 - z0) * b, -0.06, hex, sh * 0.8); else quad(x0 + (x1 - x0) * a, z0, x0 + (x1 - x0) * b, z1, -0.06, hex, sh * 0.8); } }
      if (FUT) { for (const [a, b, c2, d] of [[x0, z0, x1, z0 + 0.1], [x0, z1 - 0.1, x1, z1], [x0, z0, x0 + 0.1, z1], [x1 - 0.1, z0, x1, z1]]) quad(a, b, c2, d, -0.055, 0x3af0ff, 0.35); }
      if (!near && rng() < 0.17) spots.farm.push([cx, cz]); else if (rng() < 0.5) spots.lone.push([x0 + 0.5, z0 + 0.5], [x1 - 0.5, z1 - 0.5]); }
    else if (k < 0.76) { quad(x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6, -0.07, pal.wood); if (!near) spots.wood.push([cx, cz]); else spots.lone.push([cx + R(-3, 3), cz + R(-3, 3)]); }
    else if (k < 0.8 && !near && out > 14) spots.pond.push([cx, cz]);
    else for (let i = 0; i < 2; i++) spots.lone.push([cx + R(-5, 5), cz + R(-5, 5)]); }
  for (const [cx, cz] of spots.pond.slice(0, PAST ? 1 : 5)) { const a = R(3.4, 5.4), b = R(2.6, 4.4); disc(cx, cz, a + 0.7, b + 0.7, -0.07, pal.shore, 14, 0.08); disc(cx, cz, a, b, -0.06, pal.water, 14, 0.08); }
  // ---------- trees: one batch. Woods, loners along the field edges, and a row down each country road ----------
  const tint = (geo, hex, hex2) => { const c = new THREE.Color(hex), c2 = hex2 == null ? c : new THREE.Color(hex2), pos = geo.attributes.position, n = pos.count, arr = new Float32Array(n * 3); geo.computeBoundingBox(); const y0 = geo.boundingBox.min.y, yh = Math.max(1e-3, geo.boundingBox.max.y - y0);
    for (let i = 0; i < n; i++) { const t = (pos.getY(i) - y0) / yh; arr[i * 3] = c.r + (c2.r - c.r) * t; arr[i * 3 + 1] = c.g + (c2.g - c.g) * t; arr[i * 3 + 2] = c.b + (c2.b - c.b) * t; } geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return geo; };
  const piece = (geo, hex, x = 0, y = 0, z = 0, hex2) => { const q = geo.index ? geo.toNonIndexed() : geo; q.deleteAttribute('uv'); q.translate(x, y, z); q.computeVertexNormals(); return tint(q, hex, hex2); };
  const treeGeo = PAST
    ? mergeGeometries([piece(new THREE.CylinderGeometry(0.2, 0.22, 2, 6), 0xffffff, 0, 1, 0), piece(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 5), 0xffffff, 0.45, 1.5, 0), piece(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 5).rotateZ(Math.PI / 2), 0xffffff, 0.25, 1.1, 0), piece(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 5), 0xffffff, -0.42, 1.15, 0), piece(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 5).rotateZ(Math.PI / 2), 0xffffff, -0.22, 0.85, 0)]) // a cactus
    : mergeGeometries([piece(new THREE.CylinderGeometry(0.11, 0.16, 1.1, 5), 0x8a7a5a, 0, 0.55, 0), piece(new THREE.IcosahedronGeometry(0.85, 0), 0xffffff, 0, 1.75, 0), piece(new THREE.IcosahedronGeometry(0.55, 0), 0xffffff, 0.35, 2.35, 0.2)]); // a round-headed tree
  const trees = [];
  const tree = (x, z, s) => { if (trees.length >= 1100 || onRoad(x, z, 1) || (Math.abs(x) < hx + EDGE + 1 && Math.abs(z) < hz + EDGE + 1)) return; trees.push([x, z, s]); };
  for (const [cx, cz] of spots.wood) { const n = PAST ? 4 : 12 + ((rng() * 9) | 0); for (let i = 0; i < n; i++) tree(cx + R(-6, 6), cz + R(-6, 6), R(0.6, 1.1)); }
  for (const [x, z] of spots.lone) if (rng() < (PAST ? 0.35 : 0.7)) tree(x + R(-0.6, 0.6), z + R(-0.6, 0.6), R(0.55, 0.95));
  if (!PAST) for (const a of lines) for (let d = 5; d < REACH; d += 6.5) for (const s of [-1, 1]) { const side = ((d / 6.5) & 1) ? 1 : -1; tree(a + side * (RW + 1.3), s * (rz + d), R(0.7, 0.9)); tree(s * (rx + d), a + side * (RW + 1.3), R(0.7, 0.9)); }
  if (trees.length) { const im = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), trees.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    trees.forEach(([x, z, s], i) => { e.set(0, rng() * 6.28, 0); q.setFromEuler(e); p.set(x, -0.05, z); sc.set(s, s * R(0.9, 1.25), s); m4.compose(p, q, sc); im.setMatrixAt(i, m4); im.setColorAt(i, col.setHex(pick(pal.leaf)).multiplyScalar(R(0.8, 1.1))); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.frustumCulled = false; g.add(im); }

  // ---------- farms and hills: one mesh; the lit windows: another ----------
  const solid = [], lit = [], box = (w, h, d, hex, x, y, z, ry = 0) => { const q = piece(new THREE.BoxGeometry(w, h, d).rotateY(ry), hex, x, y, z); solid.push(q); return q; };
  const gable = (w, h, d, hex, x, y, z, ry) => { const s = w / Math.SQRT2, q = new THREE.BoxGeometry(s, s, d + 0.2).rotateZ(Math.PI / 4).scale(1, h / (w / 2), 1).rotateY(ry); solid.push(piece(q, hex, x, y, z)); }; // a square bar on its edge, its lower half inside the walls: a pitched roof
  const pane = (x, y, z, ry, w = 0.34, h = 0.3) => { const q = new THREE.PlaneGeometry(w, h).rotateY(ry); q.deleteAttribute('uv'); q.deleteAttribute('normal'); q.translate(x, y, z); lit.push(q.toNonIndexed()); };
  for (const [cx, cz] of spots.farm.slice(0, 26)) { const ry = (rng() * 4 | 0) * Math.PI / 2, c = Math.cos(ry), s = Math.sin(ry), at = (dx, dz) => [cx + dx * c + dz * s, cz - dx * s + dz * c];
    quad(cx - 4.6, cz - 4.2, cx + 4.6, cz + 4.2, -0.055, pal.yard); // the farmyard (the land mesh is put together after the farms for this)
    const [bx, bz] = at(-1.8, -0.6); box(2.6, 1.9, 3.6, pal.barn[0], bx, 0.95, bz, ry); gable(2.6, 1.0, 3.6, pal.roof, bx, 1.9, bz, ry);
    const [sx, sz] = at(-3.4, 1.6); solid.push(piece(new THREE.CylinderGeometry(0.62, 0.62, 2.8, 8), pal.barn[2], sx, 1.4, sz), piece(new THREE.SphereGeometry(0.62, 8, 4, 0, 6.2832, 0, Math.PI / 2), pal.barn[2], sx, 2.8, sz));
    const [ox, oz] = at(2, 0.8); box(1.9, 1.5, 2.2, pal.house, ox, 0.75, oz, ry); gable(1.9, 0.8, 2.2, pal.barn[1], ox, 1.5, oz, ry);
    for (const dz of [-0.5, 0.5]) { const [wx, wz] = at(2 + 0.96, 0.8 + dz); pane(wx, 0.85, wz, ry + Math.PI / 2); } { const [wx, wz] = at(2, 0.8 + 1.11); pane(wx, 0.85, wz, ry); }
    if (rng() < 0.6) { const [tx, tz] = at(0.4, -2.6); box(1.2, 0.5, 0.7, pal.barn[1], tx, 0.25, tz, ry); } }
  { const far0 = REACH + 8, n = 34; for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832 + R(-0.07, 0.07), d = R(far0, far0 + 46), ex = hx + d, ez = hz + d, k = 1 / Math.max(Math.abs(Math.cos(a)) / ex, Math.abs(Math.sin(a)) / ez), x = Math.cos(a) * k, z = Math.sin(a) * k, r = R(9, 19), h = R(4, 10); // a ring of them, following the town's square outline
      const geo = PAST ? new THREE.CylinderGeometry(r * R(0.45, 0.7), r, h * 0.9, 7, 1) : FUT ? new THREE.ConeGeometry(r * 0.35, h * 2.6, 4, 1) : new THREE.ConeGeometry(r, h, 7, 2);
      if (!PAST && !FUT) geo.scale(1, 1, R(0.7, 1.3)); solid.push(piece(geo.rotateY(rng() * 6.28), pal.hill[0], x, (PAST ? h * 0.45 : FUT ? h * 1.3 : h / 2) - 0.1, z, pal.hill[1])); } }
  const land = new THREE.BufferGeometry(); land.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); land.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  { const nrm = new Float32Array(P.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; land.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); }
  g.add(new THREE.Mesh(land, new THREE.MeshLambertMaterial({ vertexColors: true })));

  if (solid.length) g.add(new THREE.Mesh(mergeGeometries(solid), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  if (lit.length) g.add(new THREE.Mesh(mergeGeometries(lit), new THREE.MeshBasicMaterial({ color: pal.lamp, side: THREE.DoubleSide })));
  g.traverse((m) => { m.matrixAutoUpdate = false; m.updateMatrix(); }); g.updateMatrixWorld(true);
  scene.add(g); last = g; return g;
}
