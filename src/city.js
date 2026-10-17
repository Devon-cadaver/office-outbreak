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
    if (h !== v) { wall[y][x] = false; punched++; }
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

  const asphalt = (g) => { g.fillStyle = '#56777c'; g.fillRect(0, 0, 96, 96); g.fillStyle = '#5c7f86'; for (let i = 0; i < 60; i++) g.fillRect((Math.random() * 96) | 0, (Math.random() * 96) | 0, 2, 2); };
  const [sc, sg] = canvas(96, 96); asphalt(sg);
  sg.fillStyle = '#8da4a8'; sg.fillRect(0, 0, 96, 12); sg.fillRect(0, 84, 96, 12);
  sg.fillStyle = '#5b7579'; sg.fillRect(0, 11, 96, 2); sg.fillRect(0, 83, 96, 2);
  sg.fillStyle = '#e0cf6a'; for (let x = 6; x < 96; x += 24) sg.fillRect(x, 46, 12, 3);
  const roadStraight = tex(sc);
  const [jc, jg] = canvas(96, 96); asphalt(jg);
  jg.fillStyle = '#8da4a8'; for (const [x, y] of [[0, 0], [84, 0], [0, 84], [84, 84]]) jg.fillRect(x, y, 12, 12);
  jg.fillStyle = '#e8e8e8'; for (let i = 16; i < 80; i += 12) { jg.fillRect(i, 2, 6, 10); jg.fillRect(i, 84, 6, 10); jg.fillRect(2, i, 10, 6); jg.fillRect(84, i, 10, 6); }
  const roadJunction = tex(jc);
  const [cc, cg] = canvas(96, 96); asphalt(cg);
  cg.fillStyle = '#8da4a8'; cg.fillRect(0, 0, 96, 12); cg.fillRect(0, 84, 96, 12); cg.fillRect(0, 0, 12, 96); cg.fillRect(84, 0, 12, 96);
  const roadCorner = tex(cc);

  const [lc, lg] = canvas(64, 64);
  const grad = lg.createRadialGradient(32, 32, 2, 32, 32, 32); grad.addColorStop(0, 'rgba(255,226,122,0.6)'); grad.addColorStop(1, 'rgba(255,226,122,0)');
  lg.fillStyle = grad; lg.fillRect(0, 0, 64, 64);
  const lampPool = tex(lc);

  return (T = { facadeA, glowA, facadeB, glowB, roadStraight, roadJunction, roadCorner, lampPool });
}

const box = new THREE.BoxGeometry(1, 1, 1);
// gabled roof prism, unit size: width 1 (x), depth 1 (z), height 1 (y), base at y=0, ridge along z
const roofGeo = (() => {
  const g = new THREE.BufferGeometry();
  const v = [
    // left slope
    -0.5, 0, -0.5,  0, 1, -0.5,  0, 1, 0.5,   -0.5, 0, -0.5,  0, 1, 0.5,  -0.5, 0, 0.5,
    // right slope
    0.5, 0, -0.5,   0.5, 0, 0.5,  0, 1, 0.5,   0.5, 0, -0.5,  0, 1, 0.5,  0, 1, -0.5,
    // gables
    -0.5, 0, 0.5,  0, 1, 0.5,  0.5, 0, 0.5,    0.5, 0, -0.5,  0, 1, -0.5,  -0.5, 0, -0.5,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
})();
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const cone = new THREE.ConeGeometry(0.5, 1, 8);
const ball = new THREE.IcosahedronGeometry(0.5, 1);

export function buildCity(scene, wall, level) {
  const T = makeTextures(); resetLandmarks();
  const rows = wall.length, cols = wall[0].length;
  const group = new THREE.Group(); scene.add(group);
  const obstacles = [], buildings = [];
  const rng = mulberry32(level * 7919 + 13);
  const W = cols * CELL, D = rows * CELL;
  const M = (o) => new THREE.MeshLambertMaterial(o);
  const add = (geo, mat, sx, sy, sz, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry; group.add(m); return m; };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 16, D + 16), M({ color: NIGHT.ground }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; group.add(ground);

  // ---------- roads ----------
  const streetCells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!wall[y][x]) streetCells.push([x, y]);
  const open = (x, y) => wall[y]?.[x] === false;
  const kinds = { straight: [], junction: [], corner: [] };
  for (const [x, y] of streetCells) {
    const n = open(x, y - 1), s = open(x, y + 1), e = open(x + 1, y), w = open(x - 1, y);
    const count = n + s + e + w;
    if (count >= 3) kinds.junction.push([x, y, 0]);
    else if (e && w && !n && !s) kinds.straight.push([x, y, 0]);
    else if (n && s && !e && !w) kinds.straight.push([x, y, Math.PI / 2]);
    else kinds.corner.push([x, y, 0]);
  }
  const plane = new THREE.PlaneGeometry(CELL, CELL);
  const mtx = new THREE.Matrix4(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1), quat = new THREE.Quaternion(), eul = new THREE.Euler();
  for (const [kind, texture] of [['straight', T.roadStraight], ['junction', T.roadJunction], ['corner', T.roadCorner]]) {
    const list = kinds[kind]; if (!list.length) continue;
    const im = new THREE.InstancedMesh(plane, M({ map: texture }), list.length);
    list.forEach(([x, y, rz], i) => { const w = toWorld(x, y, cols, rows); eul.set(-Math.PI / 2, 0, rz); quat.setFromEuler(eul); mtx.compose(pos.set(w.x, 0, w.z), quat, scl); im.setMatrixAt(i, mtx); });
    im.instanceMatrix.needsUpdate = true; group.add(im);
  }

  // ---------- buildings ----------
  const roofMat = M({ color: NIGHT.roof }), corniceMat = M({ color: 0x8aa0a4 }), doorMat = new THREE.MeshBasicMaterial({ color: 0xf6e94a }), frameMat = M({ color: 0x2a3a40 });
  const awningMats = [M({ color: 0x9a3a4a }), M({ color: 0x2f6f8a }), M({ color: 0x7a3f8a })];
  const HOUSE_WALLS = [0xe8d54a, 0x3f6fb0, 0xb8473a, 0x8a5a3a, 0xd9c7a8, 0x6a8f5a], HOUSE_ROOFS = [0x4a3324, 0x3a3a44, 0x5a2e2a, 0x2f3d4a];
  const brickMat = M({ color: 0xb8473a }), litWin = new THREE.MeshBasicMaterial({ color: 0xf6e94a }), darkWin = M({ color: 0x34506e }), doorMatH = M({ color: 0x2a2320 });
  const house = (w, x, y, openFaces) => {
    const wall = new THREE.Color(HOUSE_WALLS[(rng() * HOUSE_WALLS.length) | 0]), roofC = HOUSE_ROOFS[(rng() * HOUSE_ROOFS.length) | 0];
    const bw = 2.1, bd = 1.9, bh = 1.0 + (rng() < 0.3 ? 0.9 : 0), rh = 0.9;
    const ry = openFaces.length ? openFaces[(rng() * openFaces.length) | 0][2] : 0; // face the street
    const g = new THREE.Group(); g.position.set(w.x, 0, w.z); g.rotation.y = ry; group.add(g);
    const wallMat = M({ color: wall, transparent: true }), roofMat = M({ color: roofC, transparent: true });
    const body = new THREE.Mesh(box, wallMat); body.scale.set(bw, bh, bd); body.position.y = bh / 2; g.add(body);
    const roof = new THREE.Mesh(roofGeo, roofMat); roof.scale.set(bw + 0.3, rh, bd + 0.3); roof.position.y = bh; g.add(roof);
    const chim = new THREE.Mesh(box, brickMat); chim.scale.set(0.25, 0.7, 0.25); chim.position.set(bw * 0.3, bh + rh * 0.6, -bd * 0.2); g.add(chim);
    // door + windows on the street face (local +z)
    const door = new THREE.Mesh(box, doorMatH); door.scale.set(0.42, 0.7, 0.06); door.position.set(-0.55, 0.35, bd / 2 + 0.03); g.add(door);
    for (const [wx, wy] of [[0.45, 0.6], [0.45, bh > 1.2 ? 1.45 : -1]]) if (wy > 0) { const win = new THREE.Mesh(box, rng() < 0.55 ? litWin : darkWin); win.scale.set(0.5, 0.4, 0.06); win.position.set(wx, wy, bd / 2 + 0.03); g.add(win); const fr = new THREE.Mesh(box, doorMatH); fr.scale.set(0.56, 0.46, 0.04); fr.position.set(wx, wy, bd / 2 + 0.02); g.add(fr); }
    const side = new THREE.Mesh(box, rng() < 0.4 ? litWin : darkWin); side.scale.set(0.06, 0.4, 0.5); side.position.set(bw / 2 + 0.03, 0.6, 0.2); g.add(side);
    if (rng() < 0.5) { const porch = new THREE.Mesh(box, roofMat); porch.scale.set(1.0, 0.06, 0.5); porch.position.set(-0.55, 0.95, bd / 2 + 0.25); g.add(porch); }
    // fade + outline on the body mesh so the see-through logic works
    body.userData.fade = [wallMat, roofMat];
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), outlineMat); edges.scale.set(bw, bh + rh, bd); edges.position.set(w.x, (bh + rh) / 2, w.z); edges.rotation.y = ry; edges.visible = false; group.add(edges); body.userData.edges = edges;
    body.position.set(0, bh / 2, 0);
    buildings.push(body);
  };
  const outlineMat = new THREE.LineBasicMaterial({ color: 0xbfe6e8, transparent: true, opacity: 0.8 });
  const landmarkCells = pickLandmarks(wall, rng);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (wall[y][x]) {
    const w = toWorld(x, y, cols, rows);
    const lm = landmarkCells.get(y * cols + x);
    if (lm) { buildLandmark(lm, group, w, rng, M, add); obstacles.push({ x: w.x, z: w.z, hw: CELL / 2 - 0.05, hd: CELL / 2 - 0.05 }); continue; }
    const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
    if (!edge && rng() < 0.5) {
      const facesH = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]].filter(([dx, dz]) => open(x + dx, y + dz));
      house(w, x, y, facesH); obstacles.push({ x: w.x, z: w.z, hw: CELL / 2 - 0.05, hd: CELL / 2 - 0.05 }); continue;
    }
    const floors = edge ? 2 : 1 + ((rng() * 2) | 0) + (rng() < 0.08 ? 1 : 0);
    const fh = 1.1, h = floors * fh + 0.25;
    const base = new THREE.Color(NIGHT.buildings[(rng() * NIGHT.buildings.length) | 0]); if (edge) base.multiplyScalar(0.7);
    const useA = rng() < 0.6;
    const map = (useA ? T.facadeA : T.facadeB).clone(), glow = (useA ? T.glowA : T.glowB).clone();
    map.needsUpdate = glow.needsUpdate = true;
    map.repeat.set(1, floors); glow.repeat.set(1, floors); const ox = rng() < 0.5 ? 0 : 0.5; map.offset.set(ox, 0); glow.offset.set(ox, 0);
    const side = M({ color: base, map, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 1, transparent: true });
    const footprint = CELL - 0.7;
    const mesh = add(box, [side, side, roofMat, roofMat, side, side], footprint, h, footprint, w.x, h / 2, w.z);
    mesh.userData.fade = [side];
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), outlineMat); edges.scale.copy(mesh.scale); edges.position.copy(mesh.position); edges.visible = false; group.add(edges); mesh.userData.edges = edges;
    add(box, corniceMat, footprint + 0.15, 0.12, footprint + 0.15, w.x, h + 0.02, w.z);
    if (!edge && rng() < 0.4) add(box, M({ color: 0x4f6366 }), 0.5, 0.35, 0.5, w.x + (rng() - 0.5) * 1.4, h + 0.25, w.z + (rng() - 0.5) * 1.4);
    if (!edge && rng() < 0.25) add(cyl, M({ color: 0x5c6f73 }), 0.5, 0.6, 0.5, w.x + (rng() - 0.5) * 1.2, h + 0.38, w.z + (rng() - 0.5) * 1.2);
    const faces = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]].filter(([dx, dz]) => open(x + dx, y + dz));
    if (faces.length && !edge) {
      const [dx, dz, ry] = faces[(rng() * faces.length) | 0];
      const fx = w.x + dx * (footprint / 2 + 0.03), fz = w.z + dz * (footprint / 2 + 0.03);
      add(box, frameMat, 0.7, 0.95, 0.06, fx, 0.48, fz, ry); add(box, doorMat, 0.5, 0.8, 0.07, fx, 0.42, fz, ry);
      if (rng() < 0.5) add(box, awningMats[(rng() * 3) | 0], 1.3, 0.08, 0.5, fx + dx * 0.25, 1.05, fz + dz * 0.25, ry);
    }
    obstacles.push({ x: w.x, z: w.z, hw: CELL / 2 - 0.05, hd: CELL / 2 - 0.05 });
    buildings.push(mesh);
  }

  // ---------- cars ----------
  const glass = M({ color: 0x5a86a8 }), wheelMat = M({ color: 0x101416 }), headMat = new THREE.MeshBasicMaterial({ color: NIGHT.lamp }), tailMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
  const bodyGeo = new THREE.BoxGeometry(0.9, 0.36, 1.8), cabinGeo = new THREE.BoxGeometry(0.8, 0.34, 0.95);
  const poleCells = [];
  for (const [x, y] of streetCells) {
    if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) continue;
    const n = open(x, y - 1), s = open(x, y + 1), e = open(x + 1, y), w0 = open(x - 1, y);
    const straightH = e && w0 && !n && !s, straightV = n && s && !e && !w0;
    const w = toWorld(x, y, cols, rows);
    if ((straightH || straightV) && rng() < 0.12) {
      const sideSign = rng() < 0.5 ? -1 : 1;
      const car = new THREE.Group();
      const bodyMat = M({ color: NIGHT.cars[(rng() * NIGHT.cars.length) | 0] });
      const b1 = new THREE.Mesh(bodyGeo, bodyMat); b1.position.y = 0.36; car.add(b1);
      const hood = new THREE.Mesh(box, bodyMat); hood.scale.set(0.8, 0.12, 0.5); hood.position.set(0, 0.6, 0.55); car.add(hood);
      const b2 = new THREE.Mesh(cabinGeo, glass); b2.position.set(0, 0.7, -0.15); car.add(b2);
      const roofC = new THREE.Mesh(box, bodyMat); roofC.scale.set(0.82, 0.06, 0.97); roofC.position.set(0, 0.9, -0.15); car.add(roofC);
      for (const [wx, wz] of [[-0.44, 0.58], [0.44, 0.58], [-0.44, -0.58], [0.44, -0.58]]) { const wh = new THREE.Mesh(cyl, wheelMat); wh.rotation.z = Math.PI / 2; wh.scale.set(0.34, 0.14, 0.34); wh.position.set(wx, 0.17, wz); car.add(wh); }
      for (const hx of [-0.3, 0.3]) { const hl = new THREE.Mesh(box, headMat); hl.scale.set(0.16, 0.1, 0.05); hl.position.set(hx, 0.42, 0.91); car.add(hl); const tl = new THREE.Mesh(box, tailMat); tl.scale.set(0.16, 0.08, 0.05); tl.position.set(hx, 0.42, -0.91); car.add(tl); }
      if (straightH) { car.rotation.y = Math.PI / 2 * (rng() < 0.5 ? 1 : -1); car.position.set(w.x, 0, w.z + sideSign * 0.95); obstacles.push({ x: w.x, z: w.z + sideSign * 0.95, hw: 0.9, hd: 0.45 }); }
      else { car.rotation.y = rng() < 0.5 ? 0 : Math.PI; car.position.set(w.x + sideSign * 0.95, 0, w.z); obstacles.push({ x: w.x + sideSign * 0.95, z: w.z, hw: 0.45, hd: 0.9 }); }
      group.add(car);
    }
    if (rng() < 0.1) poleCells.push([x, y]);
  }

  // ---------- lamps, poles, wires ----------
  const poleMat = M({ color: 0x1e2a2c }), bulbMat = new THREE.MeshBasicMaterial({ color: NIGHT.lamp });
  const poolMat = new THREE.MeshBasicMaterial({ map: T.lampPool, transparent: true, depthWrite: false });
  const poleTops = [], wirePts = [], lamps = [];
  for (const [x, y] of poleCells) {
    const w = toWorld(x, y, cols, rows); const px = w.x + 1.22, pz = w.z + 1.22;
    add(cyl, poleMat, 0.1, 2.8, 0.1, px, 1.4, pz);
    add(box, poleMat, 0.55, 0.07, 0.07, px - 0.27, 2.75, pz);
    add(cone, poleMat, 0.36, 0.22, 0.36, px - 0.5, 2.7, pz).rotation.x = Math.PI;
    const bulb = add(cyl, bulbMat.clone(), 0.18, 0.06, 0.18, px - 0.5, 2.58, pz);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), poolMat.clone()); pool.rotation.x = -Math.PI / 2; pool.position.set(px - 0.5, 0.02, pz); group.add(pool);
    if (rng() < 0.3) lamps.push({ bulb, pool, t: rng() * 10, on: true });
    add(box, poleMat, 0.8, 0.06, 0.06, px, 2.45, pz);
    poleTops.push(new THREE.Vector3(px, 2.47, pz));
    obstacles.push({ x: px, z: pz, hw: 0.1, hd: 0.1 });
  }
  for (let i = 0; i < poleTops.length; i++) {
    const a = poleTops[i];
    const near = poleTops.map((b, j) => ({ j, d: a.distanceTo(b) })).filter(o => o.j !== i && o.d < 15).sort((u, v) => u.d - v.d).slice(0, 2);
    for (const { j } of near) if (j > i) {
      const b = poleTops[j]; const segs = 8; const sag = (t) => -Math.sin(t * Math.PI) * 0.55;
      for (let k = 0; k < segs; k++) { const t0 = k / segs, t1 = (k + 1) / segs; wirePts.push(a.x + (b.x - a.x) * t0, a.y + sag(t0), a.z + (b.z - a.z) * t0, a.x + (b.x - a.x) * t1, a.y + sag(t1), a.z + (b.z - a.z) * t1); }
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
    if (r < 0.05) {
      add(cyl, trunkMat, 0.18, 1.0, 0.18, px, 0.5, pz);
      for (let k = 0; k < 3; k++) { const l = add(ball, k % 2 ? leafMat2 : leafMat, 1.1 + rng() * 0.5, 0.9 + rng() * 0.4, 1.1 + rng() * 0.5, px + (rng() - 0.5) * 0.5, 1.2 + k * 0.3, pz + (rng() - 0.5) * 0.5); l.rotation.y = rng() * 3; }
      obstacles.push({ x: px, z: pz, hw: 0.2, hd: 0.2 });
    } else if (r < 0.08) {
      for (let k = 0; k < 2 + ((rng() * 2) | 0); k++) { const bx = px + (rng() - 0.5) * 0.7, bz = pz + (rng() - 0.5) * 0.7; add(cyl, barrelMat, 0.42, 0.6, 0.42, bx, 0.3, bz); add(cyl, barrelTop, 0.36, 0.04, 0.36, bx, 0.61, bz); }
      obstacles.push({ x: px, z: pz, hw: 0.45, hd: 0.45 });
    } else if (r < 0.1) {
      add(cyl, hydrantMat, 0.2, 0.5, 0.2, px, 0.25, pz); add(box, hydrantMat, 0.36, 0.1, 0.12, px, 0.35, pz); add(ball, hydrantMat, 0.24, 0.2, 0.24, px, 0.55, pz);
    } else if (r < 0.13) {
      for (let k = -2; k <= 2; k++) add(box, fenceMat, 0.08, 0.5, 0.08, px + k * 0.3 * (horiz ? 1 : 0), 0.25, pz + k * 0.3 * (horiz ? 0 : 1));
      add(box, fenceMat, horiz ? 1.4 : 0.06, 0.06, horiz ? 0.06 : 1.4, px, 0.35, pz);
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

  return { group, obstacles, cols, rows, updateRain: (dt) => { updateRain(dt); updateLandmarks(dt); }, buildings };
}
