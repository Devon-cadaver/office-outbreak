// City maze: grid of street cells and building cells, generated per level.
// Visual style (from reference art): isometric rainy night, teal/purple palette,
// flat shading, big glowing windows, warm street lamps, wires, trees, parked cars.
import * as THREE from 'three';
import { pickLandmarks, buildLandmark, resetLandmarks, updateLandmarks } from './landmarks.js';

export const CELL = 3; // world units per grid cell

export function generateMaze(cols, rows, loops, rng = Math.random) {
  const wall = Array.from({ length: rows }, () => Array(cols).fill(true));
  const carve = (x, y) => { wall[y][x] = false; };
  const stack = [[1, 1]]; carve(1, 1);
  const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = dirs.map(([dx, dy]) => [x + dx, y + dy, x + dx / 2, y + dy / 2])
      .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && wall[ny][nx]);
    if (!options.length) { stack.pop(); continue; }
    const [nx, ny, mx, my] = options[(rng() * options.length) | 0];
    carve(mx, my); carve(nx, ny); stack.push([nx, ny]);
  }
  let punched = 0, guard = 0;
  while (punched < loops && guard++ < 5000) {
    const x = 1 + ((rng() * (cols - 2)) | 0), y = 1 + ((rng() * (rows - 2)) | 0);
    if (!wall[y][x]) continue;
    const h = !wall[y][x - 1] && !wall[y][x + 1], v = !wall[y - 1][x] && !wall[y + 1][x];
    if (h !== v) {
      wall[y][x] = false;
      // a loop that opens a 2x2 block makes a wide area; allow a few of those (they become small parks) and refuse the rest
      const blk = (bx, by) => !wall[by]?.[bx] && !wall[by]?.[bx + 1] && !wall[by + 1]?.[bx] && !wall[by + 1]?.[bx + 1];
      const makesBlock = blk(x, y) || blk(x - 1, y) || blk(x, y - 1) || blk(x - 1, y - 1);
      if (makesBlock && rng() > 0.1) { wall[y][x] = true; continue; }
      punched++;
    }
  }
  return wall;
}

export const toWorld = (cx, cy, cols, rows) => ({ x: (cx - (cols - 1) / 2) * CELL, z: (cy - (rows - 1) / 2) * CELL });
export const toCell = (x, z, cols, rows) => ({ cx: Math.round(x / CELL + (cols - 1) / 2), cy: Math.round(z / CELL + (rows - 1) / 2) });

export function flowField(wall, tx, ty) {
  const rows = wall.length, cols = wall[0].length;
  const dist = new Int32Array(rows * cols).fill(-1);
  if (wall[ty]?.[tx] !== false) return dist;
  const q = [ty * cols + tx]; dist[ty * cols + tx] = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i], x = p % cols, y = (p / cols) | 0, d = dist[p];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || wall[ny][nx]) continue;
      const np = ny * cols + nx; if (dist[np] >= 0) continue;
      dist[np] = d + 1; q.push(np);
    }
  }
  return dist;
}

// Shortest path (list of [cx, cy]) between two street cells, excluding the start cell.
export function findPath(wall, from, to) {
  const rows = wall.length, cols = wall[0].length;
  const dist = flowField(wall, to.cx, to.cy);
  if (dist[from.cy * cols + from.cx] < 0) return [];
  const path = []; let x = from.cx, y = from.cy;
  while (!(x === to.cx && y === to.cy)) {
    let best = null, bd = dist[y * cols + x];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const d = dist[ny * cols + nx]; if (d >= 0 && d < bd) { bd = d; best = [nx, ny]; } }
    if (!best) break; [x, y] = best; path.push([x, y]);
  }
  return path;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const NIGHT = {
  sky: 0x1c3a3a, ground: 0x264846,
  buildings: [0x4c6b6c, 0x3f5e68, 0x5a6a7c, 0x4a5b70, 0x55707a, 0x3e5a5a, 0x5f6b86, 0x476770, 0x6a4f7a, 0x3a5f6a],
  roof: 0x6c8488, cars: [0x7a3f8a, 0x8c2d6b, 0x2f8a6c, 0x3f6f9a, 0x6a2d4a, 0x2a6f7a, 0x9a3a4a, 0x3f8a3a],
  lamp: 0xffe27a, leaves: 0x2e8a63, trunk: 0x6a5a3a, wire: 0x0e1a1a, eye: 0xb8ffff,
};

// ---------- textures ----------
let T = null;
function makeTextures() {
  if (T) return T;
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, repeat = false) => { const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

  // facade: one floor = two big windows with a cross frame (like the reference). A = one lit, B = both dark.
  const facade = (litA, litB) => {
    const [wc, wg] = canvas(64, 32), [ec, eg] = canvas(64, 32);
    wg.fillStyle = '#fff'; wg.fillRect(0, 0, 64, 32); eg.fillStyle = '#000'; eg.fillRect(0, 0, 64, 32);
    const win = (x, lit) => {
      wg.fillStyle = lit ? '#fff8c0' : '#34506e'; wg.fillRect(x, 7, 20, 18);
      wg.fillStyle = '#222'; wg.fillRect(x + 9, 7, 2, 18); wg.fillRect(x, 15, 20, 2);
      if (lit) { eg.fillStyle = '#f6e94a'; eg.fillRect(x, 7, 20, 18); eg.fillStyle = '#000'; eg.fillRect(x + 9, 7, 2, 18); eg.fillRect(x, 15, 20, 2); }
    };
    win(7, litA); win(37, litB);
    return [tex(wc, true), tex(ec, true)];
  };
  const [facadeA, glowA] = facade(true, false), [facadeB, glowB] = facade(false, false);

  const asphalt = (g) => { g.fillStyle = '#3e5257'; g.fillRect(0, 0, 96, 96); g.fillStyle = '#445a60'; for (let i = 0; i < 60; i++) g.fillRect((Math.random() * 96) | 0, (Math.random() * 96) | 0, 2, 2); };
  const [sc, sg] = canvas(96, 96); asphalt(sg);
  sg.fillStyle = '#e0cf6a'; sg.fillRect(0, 44, 96, 2); sg.fillRect(0, 50, 96, 2); // avenue: double yellow line
  const roadStraight = tex(sc);
  const [ssc, ssg] = canvas(96, 96); asphalt(ssg);
  const roadSide = tex(ssc);
  const [jc, jg] = canvas(96, 96); asphalt(jg);
  const roadJunction = tex(jc);
  const [cc, cg] = canvas(96, 96); asphalt(cg);
  const roadCorner = tex(cc);

  const [lc, lg] = canvas(64, 64);
  const grad = lg.createRadialGradient(32, 32, 2, 32, 32, 32); grad.addColorStop(0, 'rgba(255,226,122,0.6)'); grad.addColorStop(1, 'rgba(255,226,122,0)');
  lg.fillStyle = grad; lg.fillRect(0, 0, 64, 64);
  const lampPool = tex(lc);

  return (T = { facadeA, glowA, facadeB, glowB, roadStraight, roadSide, roadJunction, roadCorner, lampPool });
}

const box = new THREE.BoxGeometry(1, 1, 1);
// gabled roof prism, unit size: width 1 (x), depth 1 (z), height 1 (y), base at y=0, ridge along z
const roofGeo = (() => {
  // Gabled roof, unit size: x width, z depth (ridge runs along z), y height. Base at y=0.
  // Built from explicit outward-facing triangles (counter-clockwise seen from outside) and a closed underside.
  const L = -0.5, Rr = 0.5, F = 0.5, B = -0.5, T = 1;
  const tri = (a, b, cc) => [...a, ...b, ...cc];
  const v = [
    // left slope (faces -x): normal (-1, 0.5, 0)
    ...tri([L, 0, B], [0, T, F], [0, T, B]), ...tri([L, 0, B], [L, 0, F], [0, T, F]),
    // right slope (faces +x)
    ...tri([Rr, 0, B], [0, T, B], [0, T, F]), ...tri([Rr, 0, B], [0, T, F], [Rr, 0, F]),
    // front gable (faces +z)
    ...tri([L, 0, F], [Rr, 0, F], [0, T, F]),
    // back gable (faces -z)
    ...tri([Rr, 0, B], [L, 0, B], [0, T, B]),
    // underside (faces -y)
    ...tri([L, 0, B], [Rr, 0, B], [Rr, 0, F]), ...tri([L, 0, B], [Rr, 0, F], [L, 0, F]),
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
})();
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const cone = new THREE.ConeGeometry(0.5, 1, 8);
const ball = new THREE.IcosahedronGeometry(0.5, 1);

export function buildCity(scene, wall, level) {
  const T = makeTextures(); resetLandmarks();
  const rows = wall.length, cols = wall[0].length;
  const group = new THREE.Group(); scene.add(group);
  const obstacles = [], buildings = [], cars = [], hazards = [];
  const rng = mulberry32(level * 7919 + 13);
  const W = cols * CELL, D = rows * CELL;
  const M = (o) => new THREE.MeshLambertMaterial(o);
  const add = (geo, mat, sx, sy, sz, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry; group.add(m); return m; };
  // knockable props: each lives in its own group so a car can send the whole thing tumbling.
  // solid props block walkers until knocked; poles and lights never block anyone.
  const props = [];
  const prop = (x, z, kind, solid, hw = 0.2, hd = 0.2) => {
    const pg = new THREE.Group(); pg.position.set(x, 0, z); group.add(pg);
    const ob = solid ? { x, z, hw, hd } : null; if (ob) obstacles.push(ob);
    const p = { g: pg, x, z, kind, ob, knocked: false, t: 0 }; props.push(p);
    p.add = (geo, mat, sx, sy, sz, ax, ay, az, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(ax - x, ay, az - z); m.rotation.y = ry; pg.add(m); return m; };
    return p;
  };
  const knock = (x, z, radius, dx, dz) => {
    let n = 0;
    for (const p of props) { if (p.knocked || Math.hypot(p.x - x, p.z - z) > radius) continue; p.knocked = true; n++;
      const ax = p.x - x, az = p.z - z, al = Math.hypot(ax, az) || 1; p.dir = { x: (dx * 0.6 + ax / al * 0.4), z: (dz * 0.6 + az / al * 0.4) };
      if (p.ob) { const i = obstacles.indexOf(p.ob); if (i >= 0) obstacles.splice(i, 1); } }
    return n;
  };
  const updateProps = (dt) => { for (const p of props) { if (!p.knocked || p.t >= 1) continue; p.t = Math.min(1, p.t + dt * 2.2); const k = p.t; const lift = p.kind === 'car' ? 0.6 : 0.25;
    p.g.position.x = p.x + p.dir.x * k * (p.kind === 'car' ? 2.2 : 1.2); p.g.position.z = p.z + p.dir.z * k * (p.kind === 'car' ? 2.2 : 1.2); p.g.position.y = Math.sin(k * Math.PI) * lift;
    const ang = k * (p.kind === 'car' ? Math.PI : 1.45); p.g.rotation.x = p.dir.z * ang; p.g.rotation.z = -p.dir.x * ang; } };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 16, D + 16), M({ color: NIGHT.ground }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; group.add(ground);

  // ---------- roads ----------
  const streetCells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!wall[y][x]) streetCells.push([x, y]);
  const open = (x, y) => wall[y]?.[x] === false;
  {
    const P = 64, cw = cols * P, chh = rows * P, RW = 38; // road strip width in px (cell is 64)
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const g = cv.getContext('2d');
    const isAveRow = (y) => wall.avenues && y === wall.avenues.row, isAveCol = (x) => wall.avenues && x === wall.avenues.col;
    const aveCell = (x, y) => !!(cz && cz.avenue.has(y * cols + x)), crossCell = (x, y) => !!(cz && cz.cross.has(y * cols + x));
    // park cells: any open cell that belongs to a 2x2 block of open cells. Roads only run through the rest.
    const blk = (x, y) => open(x, y) && open(x + 1, y) && open(x, y + 1) && open(x + 1, y + 1);
    const park = (x, y) => open(x, y) && (wall.custom ? wall.custom.parks.has(y * cols + x) : (blk(x, y) || blk(x - 1, y) || blk(x, y - 1) || blk(x - 1, y - 1)));
    const cz = wall.custom, idx = (x, y) => y * cols + x;
    const plaza = (x, y) => !!(cz && cz.plaza.has(idx(x, y)));
    // generated maps: roads run straight through parks. builder maps: grass is plain ground, roads only where placed
    const road = (x, y) => open(x, y) && !plaza(x, y) && !(cz && cz.parks.has(idx(x, y)));
    // a road link between two cells exists when both are road and neither cell's shape mask forbids it
    const maskOf = (x, y) => (cz && cz.conn ? cz.conn.get(idx(x, y)) : undefined);
    const DIRS = { N: [0, -1, 1, 4], S: [0, 1, 4, 1], E: [1, 0, 2, 8], W: [-1, 0, 8, 2] };
    const link = (x, y, d) => { const [dx, dy, bit, obit] = DIRS[d]; if (!road(x, y) || !road(x + dx, y + dy)) return false; const a = maskOf(x, y), b = maskOf(x + dx, y + dy); return (a == null || !!(a & bit)) && (b == null || !!(b & obit)); };
    const deg = (x, y) => link(x, y, 'N') + link(x, y, 'S') + link(x, y, 'E') + link(x, y, 'W');
    wall.park = park;
    const C = (x) => x * P + P / 2;
    // 1. pavement wherever there is open ground: light concrete with a faint slab grid
    g.fillStyle = '#8c9a9e'; for (const [x, y] of streetCells) g.fillRect(x * P, y * P, P, P);
    g.strokeStyle = '#7f8d91'; g.lineWidth = 1; for (const [x, y] of streetCells) { g.strokeRect(x * P + 0.5, y * P + 0.5, P / 2, P / 2); g.strokeRect(x * P + P / 2 + 0.5, y * P + P / 2 + 0.5, P / 2, P / 2); }
    // 1b. grass for the parks, with a pavement rim on edges that meet a road cell or a building
    for (const [x, y] of streetCells) if (park(x, y)) { const X = x * P, Y = y * P; g.fillStyle = '#2f5a38'; g.fillRect(X, Y, P, P);
      g.fillStyle = '#3a6a44'; for (let i = 0; i < 40; i++) g.fillRect(X + ((rng() * P) | 0), Y + ((rng() * P) | 0), 2, 1);
      g.fillStyle = '#8c9a9e'; if (!park(x, y - 1)) g.fillRect(X, Y, P, 5); if (!park(x, y + 1)) g.fillRect(X, Y + P - 5, P, 5); if (!park(x - 1, y)) g.fillRect(X, Y, 5, P); if (!park(x + 1, y)) g.fillRect(X + P - 5, Y, 5, P); }
    // 2. roads: strips between the centres of neighbouring road cells (gutter first, asphalt on top), square joints at every centre.
    //    A road meeting a park runs up to the park's edge.
    const strip = (x0, y0, x1, y1, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    for (const pass of [[RW + 6, '#2d3c41'], [RW, '#3a4c52']]) {
      const col = pass[1];
      for (const [x, y] of streetCells) { if (!road(x, y)) continue; const w = pass[0] + (aveCell(x, y) ? 14 : 0);
        if (link(x, y, 'E')) strip(C(x), C(y), C(x + 1), C(y), w, col); else if (!cz && park(x + 1, y)) strip(C(x), C(y), x * P + P, C(y), w, col);
        if (link(x, y, 'S')) strip(C(x), C(y), C(x), C(y + 1), w, col); else if (!cz && park(x, y + 1)) strip(C(x), C(y), C(x), y * P + P, w, col);
        if (park(x - 1, y)) strip(x * P, C(y), C(x), C(y), w, col); if (park(x, y - 1)) strip(C(x), y * P, C(x), C(y), w, col); }
      g.fillStyle = col; for (const [x, y] of streetCells) if (road(x, y)) { const w = pass[0] + (aveCell(x, y) ? 14 : 0); g.fillRect(C(x) - w / 2, C(y) - w / 2, w, w); }
    }
    // 3. wear: speckles and patches on the road only
    g.fillStyle = '#425860'; for (const [x, y] of streetCells) if (road(x, y)) for (let i = 0; i < 18; i++) { const a = (rng() - 0.5) * RW * 0.9, b = (rng() - 0.5) * RW * 0.9; g.fillRect(C(x) + a, C(y) + b, 2, 2); }
    g.fillStyle = '#33444a'; for (const [x, y] of streetCells) if (road(x, y) && rng() < 0.2) { g.beginPath(); g.ellipse(C(x) + (rng() - 0.5) * 12, C(y) + (rng() - 0.5) * 12, 5 + rng() * 7, 4 + rng() * 5, rng() * 3, 0, Math.PI * 2); g.fill(); }
    // 4. double yellow centre line: along every road strip except inside junction boxes. A straight or corner cell draws
    //    from its centre to each open edge (corners as a curve); a T keeps the through street; a 4-way stays clear.
    const yellow = (fn) => { g.save(); g.strokeStyle = '#e3c84f'; g.lineWidth = 2; g.lineCap = 'butt'; for (const o of [-2.4, 2.4]) { g.beginPath(); fn(o); g.stroke(); } g.restore(); };
    const stopShort = 9;
    for (const [x, y] of streetCells) {
      if (!road(x, y)) continue;
      const n = cz ? link(x, y, 'N') : open(x, y - 1), s = cz ? link(x, y, 'S') : open(x, y + 1), e = cz ? link(x, y, 'E') : open(x + 1, y), wv = cz ? link(x, y, 'W') : open(x - 1, y); const d = n + s + e + wv;
      const cx = C(x), cy = C(y), X = x * P, Y = y * P;
      // where does this half-line end? at the cell edge normally, short of it if the neighbour is a 4-way box
      const endE = e ? (deg(x + 1, y) === 4 ? X + P - stopShort : X + P) : cx, endW = wv ? (deg(x - 1, y) === 4 ? X + stopShort : X) : cx;
      const endS = s ? (deg(x, y + 1) === 4 ? Y + P - stopShort : Y + P) : cy, endN = n ? (deg(x, y - 1) === 4 ? Y + stopShort : Y) : cy;
      if (d === 4) continue;
      if (d === 3) {
        if (e && wv) yellow((o) => { g.moveTo(endW, cy + o); g.lineTo(endE, cy + o); });
        else yellow((o) => { g.moveTo(cx + o, endN); g.lineTo(cx + o, endS); });
        continue;
      }
      if (d === 2 && e && wv) { yellow((o) => { g.moveTo(endW, cy + o); g.lineTo(endE, cy + o); }); continue; }
      if (d === 2 && n && s) { yellow((o) => { g.moveTo(cx + o, endN); g.lineTo(cx + o, endS); }); continue; }
      if (d === 2) { // corner curve around the inside corner of the cell
        const kx = e ? X + P : X, ky = s ? Y + P : Y; const a0 = Math.atan2(cy - ky, 0), a1 = Math.atan2(0, cx - kx); const sweep = (((a1 - a0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        g.save(); g.strokeStyle = '#e3c84f'; g.lineWidth = 2; for (const r of [P / 2 - 2.4, P / 2 + 2.4]) { g.beginPath(); g.arc(kx, ky, r, a0, a1, sweep > Math.PI); g.stroke(); } g.restore();
        continue;
      }
      if (d === 1) { // dead end: stop a little before the end of the road
        if (wv) yellow((o) => { g.moveTo(endW, cy + o); g.lineTo(cx + 6, cy + o); }); if (e) yellow((o) => { g.moveTo(endE, cy + o); g.lineTo(cx - 6, cy + o); });
        if (n) yellow((o) => { g.moveTo(cx + o, endN); g.lineTo(cx + o, cy + 6); }); if (s) yellow((o) => { g.moveTo(cx + o, endS); g.lineTo(cx + o, cy - 6); });
      }
    }
    // 5. zebra crossings on the approaches to a 4-way or an avenue junction, only where the approach is a plain street cell
    for (const [x, y] of streetCells) {
      if (!road(x, y)) continue;
      const n = link(x, y, 'N'), s = link(x, y, 'S'), e = link(x, y, 'E'), wv = link(x, y, 'W'); const d = n + s + e + wv;
      if (crossCell(x, y) ? d < 1 : (d < 3 || !(d === 4 || isAveRow(y) || isAveCol(x) || aveCell(x, y)))) continue;
      const X = x * P, Y = y * P, depth = 8, half = RW / 2 - 2;
      for (const [dx, dy, ok] of [[0, -1, n], [0, 1, s], [1, 0, e], [-1, 0, wv]]) { if (!ok || deg(x + dx, y + dy) >= 3) continue;
        if (dx) { const bx = dx > 0 ? X + P + 1 : X - 1 - depth; g.fillStyle = '#e8eef0'; for (let k = C(y) - half; k < C(y) + half - 2; k += 6) g.fillRect(bx, k, depth, 3); }
        else { const by = dy > 0 ? Y + P + 1 : Y - 1 - depth; g.fillStyle = '#e8eef0'; for (let k = C(x) - half; k < C(x) + half - 2; k += 6) g.fillRect(k, by, 3, depth); }
      }
    }
    // 6. manhole covers on a few straight cells
    g.fillStyle = '#2a363b'; g.strokeStyle = '#4a5c62'; g.lineWidth = 1;
    for (const [x, y] of streetCells) { if (!road(x, y)) continue; const n = open(x, y - 1), s = open(x, y + 1), e = open(x + 1, y), wv = open(x - 1, y); if (n + s + e + wv !== 2 || rng() > 0.08) continue; const mx = C(x) + (e && wv ? 0 : 9), my = C(y) + (e && wv ? 9 : 0); g.beginPath(); g.arc(mx, my, 4, 0, Math.PI * 2); g.fill(); g.stroke(); }
        const roadTex = new THREE.CanvasTexture(cv); roadTex.magFilter = THREE.LinearFilter; roadTex.minFilter = THREE.LinearMipmapLinearFilter; roadTex.anisotropy = 4;
    const roads = new THREE.Mesh(new THREE.PlaneGeometry(cols * CELL, rows * CELL), new THREE.MeshLambertMaterial({ map: roadTex, transparent: true }));
    roads.rotation.x = -Math.PI / 2; roads.position.y = 0.008; group.add(roads);
    // park furniture: a tree or a bench at the corner shared by four park cells, never on the paths
    const trunk = M({ color: 0x4a3324 }), leaf = M({ color: 0x2f7a3f }), leaf2 = M({ color: 0x3f9a4a }), benchMat = M({ color: 0x6a4a2a });
    if (wall.custom) for (const i of wall.custom.benches) { const bx = i % cols, by = (i / cols) | 0; const bw = toWorld(bx, by, cols, rows);
      // ten placements: which edge or corner the bench sits on, which way it faces, and what sits next to it
      const vi = (wall.custom.vars && wall.custom.vars.get(i)) || 0;
      const spots = [[0, 1.05, 0], [0, -1.05, Math.PI], [1.05, 0, -Math.PI / 2], [-1.05, 0, Math.PI / 2], [0.9, 0.9, -Math.PI / 4], [-0.9, 0.9, Math.PI / 4], [0, 1.05, 0], [1.05, 0, -Math.PI / 2], [0, -1.05, Math.PI], [-1.05, 0, Math.PI / 2]];
      const [ox, oz, ry] = spots[vi]; const wx = bw.x + ox, wz = bw.z + oz;
      const bprop = prop(wx, wz, 'bench', true, 0.5, 0.25); const bench = new THREE.Group(); bench.rotation.y = ry; bprop.g.add(bench);
      const seat = new THREE.Mesh(box, benchMat); seat.scale.set(1.0, 0.08, 0.35); seat.position.y = 0.4; bench.add(seat); const back = new THREE.Mesh(box, benchMat); back.scale.set(1.0, 0.3, 0.06); back.position.set(0, 0.55, 0.17); bench.add(back);
      for (const lx of [-0.4, 0.4]) { const leg = new THREE.Mesh(box, M({ color: 0x2a3438 })); leg.scale.set(0.08, 0.4, 0.3); leg.position.set(lx, 0.2, 0); bench.add(leg); }
      if (vi >= 6 && vi <= 7) { const bin = new THREE.Mesh(cyl, M({ color: 0x3a4a52 })); bin.scale.set(0.3, 0.5, 0.3); bin.position.set(0.85, 0.25, 0); bench.add(bin); }
      if (vi >= 8) { const post = new THREE.Mesh(cyl, M({ color: 0x2a3438 })); post.scale.set(0.08, 2.2, 0.08); post.position.set(-0.85, 1.1, 0); bench.add(post); const lampB = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0xffe27a })); lampB.scale.setScalar(0.2); lampB.position.set(-0.85, 2.2, 0); bench.add(lampB); } }
    if (!wall.custom) for (const [x, y] of streetCells) if (park(x, y) && park(x + 1, y) && park(x, y + 1) && park(x + 1, y + 1)) {
      const wx = toWorld(x, y, cols, rows).x + CELL / 2, wz = toWorld(x, y, cols, rows).z + CELL / 2; const r = rng();
      if (r < 0.55) { const tp = prop(wx, wz, 'tree', true, 0.3, 0.3); tp.add(cyl, trunk, 0.14, 0.9, 0.14, wx, 0.45, wz); tp.add(ball, r < 0.3 ? leaf : leaf2, 1.1, 1.0, 1.1, wx, 1.25, wz); tp.add(ball, leaf, 0.7, 0.6, 0.7, wx + 0.3, 1.6, wz - 0.2); }
      else if (r < 0.8) { const bp = prop(wx, wz, 'bench', true, 0.5, 0.2); bp.add(box, benchMat, 1.0, 0.08, 0.35, wx, 0.4, wz); bp.add(box, benchMat, 1.0, 0.3, 0.06, wx, 0.55, wz - 0.17); for (const bx of [-0.4, 0.4]) bp.add(box, M({ color: 0x2a3438 }), 0.08, 0.4, 0.3, wx + bx, 0.2, wz); }
    }
  }

  // ---------- sidewalk curbs and corner street lights ----------
  {
    const curbs = []; // [x, z, w, d]
    for (const [x, y] of streetCells) {
      const w = toWorld(x, y, cols, rows); const h = CELL / 2;
      const SW = 0.6; // sidewalk width
      if (wall.park(x, y)) continue;
      if (!open(x, y - 1)) curbs.push([w.x, w.z - h + SW / 2, CELL, SW]);
      if (!open(x, y + 1)) curbs.push([w.x, w.z + h - SW / 2, CELL, SW]);
      if (!open(x - 1, y)) curbs.push([w.x - h + SW / 2, w.z, SW, CELL]);
      if (!open(x + 1, y)) curbs.push([w.x + h - SW / 2, w.z, SW, CELL]);
      // inside corner fill where two street cells meet around a building corner
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (open(x + dx, y) && open(x, y + dz) && !open(x + dx, y + dz)) curbs.push([w.x + dx * (h - SW / 2), w.z + dz * (h - SW / 2), SW, SW]);
    }
    const curbMesh = new THREE.InstancedMesh(box, M({ color: 0xaab9bd }), curbs.length);
    const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), cs = new THREE.Vector3(), cp = new THREE.Vector3();
    curbs.forEach(([cx, cz, cw, cd], i) => { cm.compose(cp.set(cx, 0.05, cz), cq, cs.set(cw, 0.1, cd)); curbMesh.setMatrixAt(i, cm); });
    curbMesh.instanceMatrix.needsUpdate = true; group.add(curbMesh);
    // street lights: a post on a building-side corner of every junction cell, every other junction
    const postMat = M({ color: 0x2a3438 }), headMat = M({ color: 0x1e2a2c }), lightMat = new THREE.MeshBasicMaterial({ color: NIGHT.lamp });
    const poolMat2 = new THREE.MeshBasicMaterial({ map: T.lampPool, transparent: true, depthWrite: false });
    let jn = 0;
    for (const [x, y] of streetCells) {
      const n = open(x, y - 1), s = open(x, y + 1), e = open(x + 1, y), wv = open(x - 1, y);
      if (n + s + e + wv < 3) continue; if (jn++ % 2) continue;
      const w = toWorld(x, y, cols, rows);
      // pick a corner that touches a building diagonal so the post is on the sidewalk, not in the road
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].filter(([dx, dz]) => !open(x + dx, y + dz));
      if (!corners.length) continue; const [dx, dz] = corners[(rng() * corners.length) | 0];
      const px = w.x + dx * 1.15, pz = w.z + dz * 1.15; const lp = prop(px, pz, 'light', false);
      lp.add(cyl, postMat, 0.09, 2.3, 0.09, px, 1.15, pz);
      lp.add(cyl, postMat, 0.09, 0.09, 0.9, px - dx * 0.4, 2.3, pz - dz * 0.4).rotation.set(Math.PI / 2 * Math.abs(dz), 0, Math.PI / 2 * Math.abs(dx) * (dz === 0 ? 1 : 0));
      lp.add(box, headMat, 0.42, 0.14, 0.42, px - dx * 0.8, 2.26, pz - dz * 0.8);
      lp.add(box, lightMat, 0.3, 0.04, 0.3, px - dx * 0.8, 2.18, pz - dz * 0.8);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), poolMat2); pool.rotation.x = -Math.PI / 2; pool.position.set(px - dx * 0.8, 0.13, pz - dz * 0.8); group.add(pool);
    }
  }

  // ---------- buildings ----------
  const roofMat = M({ color: NIGHT.roof }), corniceMat = M({ color: 0x8aa0a4 }), doorMat = new THREE.MeshBasicMaterial({ color: 0xf6e94a }), frameMat = M({ color: 0x2a3a40 });
  const awningMats = [M({ color: 0x9a3a4a }), M({ color: 0x2f6f8a }), M({ color: 0x7a3f8a })];
  // the border has its own random stream so editing the map inside does not reshuffle it; the builder can bump the seed
  const borderSeed = wall.custom ? 1000 + (wall.custom.border || 0) : level; const prng = mulberry32(borderSeed * 9176 + 5);
  const perimeterSeed = prng();
  const perimeterStyle = (seg, orient) => { const r = ((Math.sin(seg * 12.9898 + (orient === 'v' ? 7 : 3) + perimeterSeed * 100) * 43758.5453) % 1 + 1) % 1; return r < 0.4 ? 'fence' : r < 0.65 ? 'wall' : 'building'; };
  const pfenceMat = M({ color: 0x6a7a80 }), meshMat = new THREE.MeshBasicMaterial({ color: 0x8fa3a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }), barrierMat = M({ color: 0x9aa4a8 }), sandMat = M({ color: 0x8a7a55 }), wallMat2 = M({ color: 0x5a6a70 }), wireMat2 = M({ color: 0x3a4448 });
  const perimeterPiece = (style, w, x, y) => {
    const vertical = x === 0 || x === cols - 1; // run direction along the border
    const L = CELL;
    if (style === 'fence') {
      for (let k = -1; k <= 1; k++) add(cyl, pfenceMat, 0.08, 1.6, 0.08, w.x + (vertical ? 0 : k * 1.0), 0.8, w.z + (vertical ? k * 1.0 : 0));
      const panel = add(box, meshMat, vertical ? 0.03 : L, 1.5, vertical ? L : 0.03, w.x, 0.8, w.z); void panel;
      add(box, wireMat2, vertical ? 0.05 : L, 0.05, vertical ? L : 0.05, w.x, 1.58, w.z); // top rail (barbed)
      if (rng() < 0.6) { const b = add(box, barrierMat, vertical ? 0.5 : 1.6, 0.6, vertical ? 1.6 : 0.5, w.x + (vertical ? (x === 0 ? 0.9 : -0.9) : 0), 0.3, w.z + (vertical ? 0 : (y === 0 ? 0.9 : -0.9))); void b; }
    } else if (style === 'wall') {
      add(box, wallMat2, vertical ? 0.5 : L, 1.0, vertical ? L : 0.5, w.x, 0.5, w.z);
      for (let k = -1; k <= 1; k++) for (let r = 0; r < 2; r++) add(box, sandMat, 0.55, 0.28, 0.4, w.x + (vertical ? (x === 0 ? 0.6 : -0.6) : k * 0.8), 0.14 + r * 0.26, w.z + (vertical ? k * 0.8 : (y === 0 ? 0.6 : -0.6)));
      if (rng() < 0.3) add(box, wireMat2, vertical ? 0.08 : 1.2, 0.08, vertical ? 1.2 : 0.08, w.x, 1.1, w.z);
    }
  };
  const HOUSE_WALLS = [0xe8d54a, 0x3f6fb0, 0xb8473a, 0x8a5a3a, 0xd9c7a8, 0x6a8f5a], HOUSE_ROOFS = [0x4a3324, 0x3a3a44, 0x5a2e2a, 0x2f3d4a];
  const roofTrim = M({ color: 0x2a2a30 }), brickMat = M({ color: 0xb8473a }), litWin = new THREE.MeshBasicMaterial({ color: 0xf6e94a }), darkWin = M({ color: 0x34506e }), doorMatH = M({ color: 0x2a2320 });
  const house = (w, x, y, openFaces, rr = rng, vi = -1) => {
    const wall = new THREE.Color(HOUSE_WALLS[(rr() * HOUSE_WALLS.length) | 0]), roofC = HOUSE_ROOFS[(rr() * HOUSE_ROOFS.length) | 0];
    const bw = 2.1, bd = 1.9, bh = 1.0 + (rr() < 0.3 ? 0.9 : 0), rh = 0.9;
    const ry = vi >= 0 ? (openFaces.length ? openFaces[vi % openFaces.length][2] : (vi % 4) * Math.PI / 2) : openFaces.length ? openFaces[(rr() * openFaces.length) | 0][2] : 0; // face the street
    const g = new THREE.Group(); g.position.set(w.x, 0, w.z); g.rotation.y = ry; group.add(g);
    const wallMat = M({ color: wall, transparent: true }), roofMat = new THREE.MeshLambertMaterial({ color: roofC, transparent: true, side: THREE.DoubleSide, flatShading: true });
    const body = new THREE.Mesh(box, wallMat); body.scale.set(bw, bh, bd); body.position.y = bh / 2; g.add(body);
    const roof = new THREE.Mesh(roofGeo, roofMat); roof.scale.set(bw + 0.5, rh, bd + 0.5); roof.position.y = bh - 0.04; g.add(roof);
    const ridge = new THREE.Mesh(box, roofTrim); ridge.scale.set(0.12, 0.08, bd + 0.56); ridge.position.y = bh + rh - 0.02; g.add(ridge);
    const soffit = new THREE.Mesh(box, roofTrim); soffit.scale.set(bw + 0.5, 0.06, bd + 0.5); soffit.position.y = bh - 0.07; g.add(soffit);
    const chim = new THREE.Mesh(box, brickMat); chim.scale.set(0.25, 0.7, 0.25); chim.position.set(bw * 0.3, bh + rh * 0.6, -bd * 0.2); g.add(chim);
    // door + windows on the street face (local +z)
    const door = new THREE.Mesh(box, doorMatH); door.scale.set(0.42, 0.7, 0.06); door.position.set(-0.55, 0.35, bd / 2 + 0.03); g.add(door);
    for (const [wx, wy] of [[0.45, 0.6], [0.45, bh > 1.2 ? 1.45 : -1]]) if (wy > 0) { const win = new THREE.Mesh(box, rr() < 0.55 ? litWin : darkWin); win.scale.set(0.5, 0.4, 0.06); win.position.set(wx, wy, bd / 2 + 0.03); g.add(win); const fr = new THREE.Mesh(box, doorMatH); fr.scale.set(0.56, 0.46, 0.04); fr.position.set(wx, wy, bd / 2 + 0.02); g.add(fr); }
    const side = new THREE.Mesh(box, rr() < 0.4 ? litWin : darkWin); side.scale.set(0.06, 0.4, 0.5); side.position.set(bw / 2 + 0.03, 0.6, 0.2); g.add(side);
    if (rr() < 0.5) { const porch = new THREE.Mesh(box, roofMat); porch.scale.set(1.0, 0.06, 0.5); porch.position.set(-0.55, 0.95, bd / 2 + 0.25); g.add(porch); }
    // fade + outline on the body mesh so the see-through logic works
    body.userData.fade = [wallMat, roofMat]; body.userData.h = bh + rh; body.userData.extras = g.children.filter((ch) => ch !== body && ch !== roof);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), outlineMat); edges.scale.set(bw, bh + rh, bd); edges.position.set(w.x, (bh + rh) / 2, w.z); edges.rotation.y = ry; edges.visible = false; group.add(edges); body.userData.edges = edges;
    body.position.set(0, bh / 2, 0);
    buildings.push(body);
  };
  const outlineMat = new THREE.LineBasicMaterial({ color: 0xbfe6e8, transparent: true, opacity: 0.8 });
  const landmarkCells = wall.custom ? wall.custom.landmarks : pickLandmarks(wall, rng);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (wall[y][x]) {
    const w = toWorld(x, y, cols, rows);
    const lm = landmarkCells.get(y * cols + x);
    if (lm) { buildLandmark(lm, group, w, rng, M, add); obstacles.push({ x: w.x, z: w.z, hw: CELL / 2 - 0.05, hd: CELL / 2 - 0.05 }); hazards.push({ type: lm, pos: new THREE.Vector3(w.x, 0, w.z) }); continue; }
    const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
    const vi = wall.custom && wall.custom.vars ? (wall.custom.vars.get(y * cols + x) || 0) : 0;
    const R = edge ? mulberry32(x * 131 + y * 17 + borderSeed * 7) : wall.custom ? mulberry32(x * 131 + y * 17 + vi * 977 + 3) : rng; // border buildings stay the same whatever happens inside; builder cells get a look per variant
    if (wall.custom && wall.custom.trees.has(y * cols + x)) {
      // a tree cell: grass lot with trees, blocks the way like a building would. Ten looks, picked in the builder.
      add(box, M({ color: 0x2f5a38 }), CELL - 0.3, 0.06, CELL - 0.3, w.x, 0.03, w.z);
      const vi = (wall.custom.vars && wall.custom.vars.get(y * cols + x)) || 0;
      const trunk = M({ color: 0x4a3324 }), lf = M({ color: 0x2f7a3f }), lf2 = M({ color: 0x3f9a4a }), lf3 = M({ color: 0x1f5a2f }), pine = M({ color: 0x245a3a });
      const treeAt = (tx, tz, s, kind) => {
        if (kind === 'pine') { add(cyl, trunk, 0.18 * s, 1.0 * s, 0.18 * s, tx, 0.5 * s, tz); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 2.2 * s, 7), pine); cone.position.set(tx, 1.9 * s, tz); group.add(cone); const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.65 * s, 1.5 * s, 7), lf3); cone2.position.set(tx, 2.9 * s, tz); group.add(cone2); }
        else if (kind === 'bush') { add(ball, lf2, 1.1 * s, 0.7 * s, 1.1 * s, tx, 0.35 * s, tz); add(ball, lf, 0.8 * s, 0.6 * s, 0.8 * s, tx + 0.4 * s, 0.4 * s, tz + 0.2 * s); }
        else { add(cyl, trunk, 0.22 * s, 1.3 * s, 0.22 * s, tx, 0.65 * s, tz); add(ball, kind === 'dark' ? lf3 : lf, 1.9 * s, 1.6 * s, 1.9 * s, tx, 1.8 * s, tz); add(ball, lf2, 1.2 * s, 1.0 * s, 1.2 * s, tx + 0.5 * s, 2.3 * s, tz - 0.3 * s); }
      };
      switch (vi) {
        case 0: treeAt(w.x, w.z, 1.0, 'round'); break;
        case 1: treeAt(w.x, w.z, 1.35, 'round'); break;
        case 2: treeAt(w.x + 0.3, w.z - 0.2, 0.7, 'round'); break;
        case 3: treeAt(w.x, w.z, 1.0, 'pine'); break;
        case 4: treeAt(w.x - 0.4, w.z + 0.3, 1.3, 'pine'); break;
        case 5: treeAt(w.x - 0.7, w.z - 0.5, 0.75, 'round'); treeAt(w.x + 0.7, w.z + 0.5, 0.9, 'dark'); break;
        case 6: treeAt(w.x - 0.8, w.z + 0.6, 0.6, 'pine'); treeAt(w.x + 0.6, w.z - 0.6, 0.8, 'pine'); treeAt(w.x + 0.2, w.z + 0.9, 0.5, 'bush'); break;
        case 7: treeAt(w.x, w.z, 1.0, 'bush'); treeAt(w.x - 0.9, w.z - 0.8, 0.7, 'bush'); treeAt(w.x + 0.9, w.z + 0.7, 0.8, 'bush'); break;
        case 8: treeAt(w.x + 0.2, w.z, 1.1, 'dark'); treeAt(w.x - 0.9, w.z + 0.8, 0.5, 'bush'); break;
        default: treeAt(w.x - 0.6, w.z + 0.2, 1.2, 'round'); treeAt(w.x + 0.8, w.z - 0.7, 0.6, 'pine'); break;
      }
      obstacles.push({ x: w.x, z: w.z, hw: CELL / 2 - 0.05, hd: CELL / 2 - 0.05 }); continue;
    }
    if (edge) {
      // varied perimeter: fence runs, low walls with sandbags, and only some buildings
      const seg = Math.floor(((x === 0 || x === cols - 1) ? y : x) / 4); const style = perimeterStyle(seg, x === 0 || x === cols - 1 ? 'v' : 'h');
      if (style !== 'building') { perimeterPiece(style, w, x, y); obstacles.push({ x: w.x, z: w.z, hw: CELL / 2 - 0.05, hd: CELL / 2 - 0.05 }); continue; }
    }
    // zoning: downtown blocks north, mixed middle, houses south
    const zone = y < rows * 0.35 ? 'downtown' : y > rows * 0.6 ? 'houses' : 'mixed';
    const wantHouse = zone === 'houses' ? 0.85 : zone === 'mixed' ? 0.45 : 0.08;
    if (!edge && (wall.custom ? wall.custom.houses.has(y * cols + x) : R() < wantHouse)) {
      const facesH = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]].filter(([dx, dz]) => open(x + dx, y + dz));
      house(w, x, y, facesH, R, wall.custom ? vi : -1); obstacles.push({ x: w.x, z: w.z, hw: CELL / 2 - 0.05, hd: CELL / 2 - 0.05 }); continue;
    }
    const tower = wall.custom ? wall.custom.towers.has(y * cols + x) : (!edge && zone === 'downtown' && R() < 0.14);
    const floors = edge ? 2 : tower ? 6 + ((R() * 6) | 0) : zone === 'downtown' ? 2 + ((R() * 2) | 0) + (R() < 0.25 ? 1 : 0) : 1 + ((R() * 2) | 0);
    const fh = 1.1, h = floors * fh + 0.25;
    const base = new THREE.Color(NIGHT.buildings[(R() * NIGHT.buildings.length) | 0]); if (edge) base.multiplyScalar(0.7);
    const useA = R() < 0.6;
    const map = (useA ? T.facadeA : T.facadeB).clone(), glow = (useA ? T.glowA : T.glowB).clone();
    map.needsUpdate = glow.needsUpdate = true;
    map.repeat.set(1, floors); glow.repeat.set(1, floors); const ox = R() < 0.5 ? 0 : 0.5; map.offset.set(ox, 0); glow.offset.set(ox, 0);
    const side = M({ color: base, map, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 1, transparent: true });
    const footprint = CELL - 0.7;
    const roofM = roofMat.clone(); roofM.transparent = true; const extras = []; const addX = (...a) => { const m = add(...a); extras.push(m); return m; };
    const mesh = add(box, [side, side, roofM, roofM, side, side], footprint, h, footprint, w.x, h / 2, w.z);
    mesh.userData.fade = [side, roofM]; mesh.userData.h = h; mesh.userData.extras = extras;
    if (tower) { addX(box, M({ color: 0x3a4a52 }), 0.3, 1.6, 0.3, w.x, h + 0.8, w.z); addX(box, new THREE.MeshBasicMaterial({ color: 0xff3a3a }), 0.14, 0.14, 0.14, w.x, h + 1.65, w.z); }
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), outlineMat); edges.scale.copy(mesh.scale); edges.position.copy(mesh.position); edges.visible = false; group.add(edges); mesh.userData.edges = edges;
    addX(box, corniceMat, footprint + 0.15, 0.12, footprint + 0.15, w.x, h + 0.02, w.z);
    if (!edge && R() < 0.4) addX(box, M({ color: 0x4f6366 }), 0.5, 0.35, 0.5, w.x + (R() - 0.5) * 1.4, h + 0.25, w.z + (R() - 0.5) * 1.4);
    if (!edge && R() < 0.25) addX(cyl, M({ color: 0x5c6f73 }), 0.5, 0.6, 0.5, w.x + (R() - 0.5) * 1.2, h + 0.38, w.z + (R() - 0.5) * 1.2);
    const faces = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]].filter(([dx, dz]) => open(x + dx, y + dz));
    if (faces.length && !edge) {
      const [dx, dz, ry] = faces[wall.custom ? vi % faces.length : (R() * faces.length) | 0];
      const fx = w.x + dx * (footprint / 2 + 0.03), fz = w.z + dz * (footprint / 2 + 0.03);
      addX(box, frameMat, 0.7, 0.95, 0.06, fx, 0.48, fz, ry); addX(box, doorMat, 0.5, 0.8, 0.07, fx, 0.42, fz, ry);
      if (R() < 0.5) addX(box, awningMats[(R() * 3) | 0], 1.3, 0.08, 0.5, fx + dx * 0.25, 1.05, fz + dz * 0.25, ry);
    }
    obstacles.push({ x: w.x, z: w.z, hw: CELL / 2 - 0.05, hd: CELL / 2 - 0.05 });
    buildings.push(mesh);
  }

  // ---------- cars ----------
  const glass = M({ color: 0x5a86a8 }), wheelMat = M({ color: 0x101416 }), headMat = new THREE.MeshBasicMaterial({ color: NIGHT.lamp }), tailMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
  const bodyGeo = new THREE.BoxGeometry(0.9, 0.36, 1.8), cabinGeo = new THREE.BoxGeometry(0.8, 0.34, 0.95);
  const fleet = ['tank', 'truck', 'van', 'van', 'car', 'car', 'car'].sort(() => rng() - 0.5);
  const vehicle = (kind) => {
    const car = new THREE.Group(); const part = (geo, mat, sx, sy, sz, x, y, z) => { const mm = new THREE.Mesh(geo, mat); mm.scale.set(sx, sy, sz); mm.position.set(x, y, z); car.add(mm); return mm; };
    const wheels = (r, pts) => { for (const [wx, wz] of pts) { const wh = part(cyl, wheelMat, r, 0.16, r, wx, r / 2, wz); wh.rotation.z = Math.PI / 2; } };
    if (kind === 'van') { const mat = M({ color: [0xd8dde0, 0x4f8fd6, 0xe8d54a][(rng() * 3) | 0] }); part(box, mat, 1.0, 0.7, 2.1, 0, 0.55, -0.1); part(box, glass, 0.9, 0.3, 0.3, 0, 0.75, 0.95); part(box, mat, 0.9, 0.3, 0.5, 0, 0.35, 0.95); wheels(0.34, [[-0.48, 0.65], [0.48, 0.65], [-0.48, -0.7], [0.48, -0.7]]); for (const hx of [-0.32, 0.32]) part(box, headMat, 0.16, 0.1, 0.05, hx, 0.45, 1.21); }
    else if (kind === 'truck') { const mat = M({ color: [0xc23b3b, 0x3a5a8a][(rng() * 2) | 0] }); part(box, mat, 1.0, 0.8, 0.9, 0, 0.75, 0.75); part(box, glass, 0.9, 0.3, 0.2, 0, 0.95, 1.2); part(box, M({ color: 0x4a4f55 }), 1.05, 0.35, 1.5, 0, 0.5, -0.55); part(box, M({ color: 0x2a2e33 }), 0.9, 0.08, 1.4, 0, 0.7, -0.55); wheels(0.42, [[-0.5, 0.75], [0.5, 0.75], [-0.5, -0.5], [0.5, -0.5], [-0.5, -1.0], [0.5, -1.0]]); for (const hx of [-0.32, 0.32]) part(box, headMat, 0.16, 0.1, 0.05, hx, 0.55, 1.21); }
    else if (kind === 'tank') { const olive = M({ color: 0x4a5a3a }), dark = M({ color: 0x2a3326 }); part(box, olive, 1.2, 0.45, 2.3, 0, 0.5, 0); part(box, dark, 0.3, 0.55, 2.3, -0.6, 0.3, 0); part(box, dark, 0.3, 0.55, 2.3, 0.6, 0.3, 0); const turret = part(box, olive, 0.85, 0.35, 0.95, 0, 0.9, -0.15); car.userData.turret = turret; const barrel = part(cyl, dark, 0.1, 1.5, 0.1, 0, 0.92, 0.95); barrel.rotation.x = Math.PI / 2; part(ball, M({ color: 0x3fdf6a }), 0.15, 0.15, 0.15, 0, 1.12, -0.3); }
    else { const bodyMat = M({ color: NIGHT.cars[(rng() * NIGHT.cars.length) | 0] }); part(bodyGeo, bodyMat, 1, 1, 1, 0, 0.36, 0); part(box, bodyMat, 0.8, 0.12, 0.5, 0, 0.6, 0.55); part(cabinGeo, glass, 1, 1, 1, 0, 0.7, -0.15); part(box, bodyMat, 0.82, 0.06, 0.97, 0, 0.9, -0.15); wheels(0.34, [[-0.44, 0.58], [0.44, 0.58], [-0.44, -0.58], [0.44, -0.58]]); for (const hx of [-0.3, 0.3]) { part(box, headMat, 0.16, 0.1, 0.05, hx, 0.42, 0.91); part(box, tailMat, 0.16, 0.08, 0.05, hx, 0.42, -0.91); } }
    car.scale.setScalar(0.85); return car;
  };
  for (const [x, y] of streetCells) {
    if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) continue;
    const n = open(x, y - 1), s = open(x, y + 1), e = open(x + 1, y), w0 = open(x - 1, y);
    const straightH = e && w0 && !n && !s, straightV = n && s && !e && !w0;
    const w = toWorld(x, y, cols, rows);
    const forceCar = wall.custom && wall.custom.cars.has(y * cols + x);
    // generated maps get a small fleet: three cars, two vans, a truck and a tank. builder maps: one per placed car cell, kind by variant
    if (wall.custom ? forceCar : ((straightH || straightV) && fleet.length && rng() < 0.06)) {
      const sideSign = rng() < 0.5 ? -1 : 1;
      const kind = wall.custom ? ['car', 'van', 'truck', 'tank'][(wall.custom.vars.get(y * cols + x) || 0) % 4] : fleet.pop();
      const car = vehicle(kind); car.userData.kind = kind;
      const horizCar = straightH || (!straightV && (e || w0)); const cx = horizCar ? w.x : w.x + sideSign * 0.95, czz = horizCar ? w.z + sideSign * 0.95 : w.z;
      car.rotation.y = horizCar ? Math.PI / 2 * (rng() < 0.5 ? 1 : -1) : (rng() < 0.5 ? 0 : Math.PI); car.position.set(cx, 0, czz);
      const cp = prop(cx, czz, 'car', true, horizCar ? 0.9 : 0.45, horizCar ? 0.45 : 0.9); cp.g.add(car); car.position.set(0, 0, 0); car.userData.prop = cp; car.userData.worldPos = () => cp.g.position;
      cars.push(car);
    }
  }

  // ---------- lamps, poles, wires ----------
  // Poles stand along straight street runs at a regular spacing, on one side of the road.
  // Wires connect consecutive poles down the same street only, so lines follow the roads.
  const poleMat = M({ color: 0x1e2a2c }), bulbMat = new THREE.MeshBasicMaterial({ color: NIGHT.lamp });
  const poolMat = new THREE.MeshBasicMaterial({ map: T.lampPool, transparent: true, depthWrite: false });
  const wirePts = [], lamps = [];
  const SPACING = 2; // cells between poles
  const makePole = (px, pz, facing) => {
    // facing: +1 lamp arm points to +x (east), -1 to -x, +2 to +z, -2 to -z
    const pp = prop(px, pz, 'pole', false);
    pp.add(cyl, poleMat, 0.1, 2.8, 0.1, px, 1.4, pz);
    pp.add(box, poleMat, 0.8, 0.06, 0.06, px, 2.45, pz).rotation.y = Math.abs(facing) === 2 ? Math.PI / 2 : 0; // crossbar along the street
    const ax = facing === 1 ? 0.5 : facing === -1 ? -0.5 : 0, az = facing === 2 ? 0.5 : facing === -2 ? -0.5 : 0;
    const arm = pp.add(box, poleMat, 0.55, 0.07, 0.07, px + ax * 0.55, 2.75, pz + az * 0.55); arm.rotation.y = Math.abs(facing) === 2 ? Math.PI / 2 : 0;
    pp.add(cone, poleMat, 0.36, 0.22, 0.36, px + ax, 2.7, pz + az).rotation.x = Math.PI;
    const bulb = pp.add(cyl, bulbMat.clone(), 0.18, 0.06, 0.18, px + ax, 2.58, pz + az);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), poolMat.clone()); pool.rotation.x = -Math.PI / 2; pool.position.set(px + ax, 0.02, pz + az); group.add(pool);
    if (rng() < 0.3) lamps.push({ bulb, pool, t: rng() * 10, on: true });
    return new THREE.Vector3(px, 2.47, pz);
  };
  const wire = (a, b) => { const segs = 8; const sag = (t) => -Math.sin(t * Math.PI) * 0.35; for (let k = 0; k < segs; k++) { const t0 = k / segs, t1 = (k + 1) / segs; for (const off of [-0.12, 0.12]) { const ox = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? 0 : off, oz = Math.abs(a.x - b.x) > Math.abs(a.z - b.z) ? off : 0; wirePts.push(a.x + (b.x - a.x) * t0 + ox, a.y + sag(t0), a.z + (b.z - a.z) * t0 + oz, a.x + (b.x - a.x) * t1 + ox, a.y + sag(t1), a.z + (b.z - a.z) * t1 + oz); } } };
  // horizontal runs (left-right streets): poles on the north side, lamp arm pointing south over the road
  for (let y = 1; y < rows - 1; y++) {
    let x = 1;
    while (x < cols - 1) {
      if (wall[y][x]) { x++; continue; }
      let x2 = x; while (x2 < cols - 1 && !wall[y][x2]) x2++;
      const len = x2 - x; // run of open cells
      if (len >= 3 && rng() < 0.75) {
        let prev = null;
        for (let k = 0; k < len; k += SPACING) {
          const cx = x + k; if (!(wall[y - 1][cx])) continue; // need a building edge to stand against on the north side
          const w = toWorld(cx, y, cols, rows); const top = makePole(w.x - 1.0, w.z - 1.2, 2);
          if (prev && prev.distanceTo(top) < CELL * SPACING + 0.5) wire(prev, top); prev = top;
        }
      }
      x = x2;
    }
  }
  // vertical runs (up-down streets): poles on the east side, lamp arm pointing west
  for (let x = 1; x < cols - 1; x++) {
    let y = 1;
    while (y < rows - 1) {
      if (wall[y][x]) { y++; continue; }
      let y2 = y; while (y2 < rows - 1 && !wall[y2][x]) y2++;
      const len = y2 - y;
      if (len >= 3 && rng() < 0.75) {
        let prev = null;
        for (let k = 0; k < len; k += SPACING) {
          const cy = y + k; if (!(wall[cy][x + 1])) continue; // building edge on the east side
          if (!wall[cy - 1]?.[x] === false && !wall[cy][x - 1] && !wall[cy][x + 1]) continue;
          const w = toWorld(x, cy, cols, rows); const top = makePole(w.x + 1.2, w.z + 1.0, -1);
          if (prev && prev.distanceTo(top) < CELL * SPACING + 0.5) wire(prev, top); prev = top;
        }
      }
      y = y2;
    }
  }
  if (wirePts.length) { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3)); group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: NIGHT.wire }))); }

  // ---------- props: trees, barrels, hydrants, fences ----------
  const trunkMat = M({ color: NIGHT.trunk }), leafMat = M({ color: NIGHT.leaves, flatShading: true }), leafMat2 = M({ color: 0x3aa06f, flatShading: true });
  const barrelMat = M({ color: 0x1b2428 }), barrelTop = M({ color: 0x2c383d }), hydrantMat = M({ color: 0xc23b3b }), fenceMat = M({ color: 0x8a7a5a });
  for (const [x, y] of streetCells) {
    if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) continue;
    const n = open(x, y - 1), s = open(x, y + 1), e = open(x + 1, y), w0 = open(x - 1, y);
    if ((n || s) && (e || w0)) continue;
    const w = toWorld(x, y, cols, rows); const r = rng();
    const sideSign = rng() < 0.5 ? -1 : 1; const horiz = e && w0;
    const px = horiz ? w.x + (rng() - 0.5) * 1.6 : w.x + sideSign * 1.2, pz = horiz ? w.z + sideSign * 1.2 : w.z + (rng() - 0.5) * 1.6;
const sp = prop(px, pz, 'street', false);
        if (r < 0.05) {
      sp.add(cyl, trunkMat, 0.18, 1.0, 0.18, px, 0.5, pz);
      for (let k = 0; k < 3; k++) { const l = sp.add(ball, k % 2 ? leafMat2 : leafMat, 1.1 + rng() * 0.5, 0.9 + rng() * 0.4, 1.1 + rng() * 0.5, px + (rng() - 0.5) * 0.5, 1.2 + k * 0.3, pz + (rng() - 0.5) * 0.5); l.rotation.y = rng() * 3; }
      sp.ob = { x: px, z: pz, hw: 0.2, hd: 0.2 }; obstacles.push(sp.ob);
    } else if (r < 0.08) {
      for (let k = 0; k < 2 + ((rng() * 2) | 0); k++) { const bx = px + (rng() - 0.5) * 0.7, bz = pz + (rng() - 0.5) * 0.7; sp.add(cyl, barrelMat, 0.42, 0.6, 0.42, bx, 0.3, bz); sp.add(cyl, barrelTop, 0.36, 0.04, 0.36, bx, 0.61, bz); }
      sp.ob = { x: px, z: pz, hw: 0.45, hd: 0.45 }; obstacles.push(sp.ob);
    } else if (r < 0.1) {
      sp.add(cyl, hydrantMat, 0.2, 0.5, 0.2, px, 0.25, pz); sp.add(box, hydrantMat, 0.36, 0.1, 0.12, px, 0.35, pz); sp.add(ball, hydrantMat, 0.24, 0.2, 0.24, px, 0.55, pz);
    } else if (r < 0.13) {
      for (let k = -2; k <= 2; k++) sp.add(box, fenceMat, 0.08, 0.5, 0.08, px + k * 0.3 * (horiz ? 1 : 0), 0.25, pz + k * 0.3 * (horiz ? 0 : 1));
      sp.add(box, fenceMat, horiz ? 1.4 : 0.06, 0.06, horiz ? 0.06 : 1.4, px, 0.35, pz);
    }
  }

  // ---------- rain (diagonal streaks) ----------
  const RAIN = 300; const rainPos = new Float32Array(RAIN * 6);
  for (let i = 0; i < RAIN; i++) { const rx = (rng() - 0.5) * (W + 12), rz = (rng() - 0.5) * (D + 12), ry = rng() * 22; rainPos.set([rx, ry, rz, rx + 0.25, ry - 1.1, rz + 0.25], i * 6); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  group.add(new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfeaea, transparent: true, opacity: 0.3 })));
  const updateLamps = (dt) => { for (const l of lamps) { l.t -= dt; if (l.t <= 0) { l.on = !l.on; l.t = l.on ? 1 + rng() * 6 : 0.05 + rng() * 0.25; l.bulb.visible = l.on; l.pool.visible = l.on; } } };
  const updateRain = (dt) => {
    updateLamps(dt);
    const a = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN; i++) { const o = i * 6; a[o + 1] -= 24 * dt; a[o + 4] -= 24 * dt; if (a[o + 4] < 0) { a[o + 1] += 22; a[o + 4] += 22; } }
    rainGeo.attributes.position.needsUpdate = true;
  };

  return { group, obstacles, cols, rows, updateRain: (dt) => { updateRain(dt); updateLandmarks(dt); updateProps(dt); }, buildings, cars, hazards, props, knock };
}
