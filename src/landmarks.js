// Landmarks from the reference art: gas station, fairground wheel, toxic slime pond, school, skate park.
import * as THREE from 'three';
import { CELL } from './city.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const ball = new THREE.IcosahedronGeometry(0.5, 1);
export const LANDMARKS = ['gas', 'ferris', 'slime', 'school', 'skate'];
const spinners = [];
export const ferris = { pos: null, wheel: null };
export function resetLandmarks() { spinners.length = 0; ferris.pos = null; ferris.wheel = null; }
export function updateLandmarks(dt) { for (const s of spinners) s.rotation.z += dt * 0.35; }

export function pickLandmarks(wall, rng) {
  const rows = wall.length, cols = wall[0].length, picked = new Map(), spots = [];
  for (let y = 2; y < rows - 2; y++) for (let x = 2; x < cols - 2; x++) if (wall[y][x]) {
    if (!wall[y - 1][x] || !wall[y + 1][x] || !wall[y][x - 1] || !wall[y][x + 1]) spots.push([x, y]);
  }
  const taken = [];
  for (const type of LANDMARKS) {
    const far = spots.filter(([x, y]) => taken.every(([tx, ty]) => Math.abs(tx - x) + Math.abs(ty - y) > 4));
    if (!far.length) break;
    const [x, y] = far[(rng() * far.length) | 0]; taken.push([x, y]); picked.set(y * cols + x, type);
  }
  return picked;
}

function textTexture(text, bg, fg, w = 256, h = 64, font = 'bold 40px sans-serif') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.LinearFilter; return t;
}
const signMesh = (text, bg, fg, w, h, pw, ph, font) => new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: textTexture(text, bg, fg, w, h, font), side: THREE.DoubleSide }));

export function buildLandmark(type, group, w, rng, M, add) {
  const F = CELL - 0.3;
  const slab = (color, h = 0.08) => add(box, M({ color }), F, h, F, w.x, h / 2, w.z);
  const glowMat = (color) => new THREE.MeshBasicMaterial({ color });

  if (type === 'gas') {
    slab(0x56707a, 0.06);
    const post = M({ color: 0x9aa7ab });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(cyl, post, 0.12, 2.2, 0.12, w.x + dx * 1.05, 1.1, w.z + dz * 0.8);
    add(box, M({ color: 0xd8dde0 }), F, 0.18, 2.2, w.x, 2.25, w.z); add(box, M({ color: 0xc23b3b }), F, 0.1, 2.25, w.x, 2.38, w.z);
    const pump = M({ color: 0x7a3f8a });
    for (const dx of [-0.6, 0.6]) { add(box, pump, 0.4, 0.9, 0.3, w.x + dx, 0.45, w.z); add(box, glowMat(0xffe27a), 0.25, 0.2, 0.05, w.x + dx, 0.7, w.z + 0.16); }
    const sign = signMesh('GAS-CO', '#c23b3b', '#111', 256, 64, 1.8, 0.5); sign.position.set(w.x, 2.75, w.z + 0.95); group.add(sign);
    add(cyl, post, 0.1, 3.4, 0.1, w.x - 1.1, 1.7, w.z + 1.1);
    const top = signMesh('GAS', '#111', '#ffe27a', 256, 64, 1.2, 0.6); top.position.set(w.x - 1.1, 3.6, w.z + 1.1); top.rotation.y = Math.PI / 4; group.add(top);
  } else if (type === 'ferris') {
    slab(0x3e5a5a, 0.06);
    const frame = M({ color: 0x6a3f8a });
    for (const dx of [-0.5, 0.5]) { const leg = add(box, frame, 0.12, 3.2, 0.12, w.x + dx, 1.5, w.z - 0.9 + (dx > 0 ? 0.45 : -0.45)); leg.rotation.x = dx > 0 ? -0.28 : 0.28; }
    const wheel = new THREE.Group(); wheel.position.set(w.x, 2.1, w.z - 0.9); group.add(wheel);
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.06, 6, 24), frame));
    for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(box, frame); sp.scale.set(0.05, 2.9, 0.05); sp.rotation.z = i * Math.PI / 8; wheel.add(sp); }
    const cab = M({ color: 0x8c2d6b }), cab2 = M({ color: 0x2f8a6c });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const cm = new THREE.Mesh(box, i % 2 ? cab : cab2); cm.scale.set(0.42, 0.38, 0.35); cm.position.set(Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0); wheel.add(cm); }
    spinners.push(wheel); ferris.pos = new THREE.Vector3(w.x, 0, w.z); ferris.wheel = wheel;
    add(box, M({ color: 0x9a3a4a }), 1.0, 0.7, 0.6, w.x + 0.9, 0.35, w.z + 0.8);
    const bulbs = glowMat(0xffe27a); for (let i = 0; i < 6; i++) add(ball, bulbs, 0.12, 0.12, 0.12, w.x - 1.2 + i * 0.48, 1.1, w.z + 1.25);
    const rides = signMesh('RIDES OPEN', '#ffe27a', '#6a3f8a', 320, 64, 1.6, 0.32, 'bold 44px sans-serif'); rides.position.set(w.x + 0.9, 0.95, w.z + 1.12); group.add(rides);
    const rides2 = signMesh('RIDES OPEN', '#ffe27a', '#6a3f8a', 320, 64, 1.6, 0.32, 'bold 44px sans-serif'); rides2.position.set(w.x + 1.32, 0.95, w.z + 0.8); rides2.rotation.y = Math.PI / 2; group.add(rides2);
  } else if (type === 'slime') {
    slab(0x2a4a44, 0.04);
    const glow = glowMat(0x6fff3a);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1.05, 18), glow); pond.rotation.x = -Math.PI / 2; pond.position.set(w.x - 0.2, 0.06, w.z + 0.1); pond.scale.set(1.15, 0.8, 1); group.add(pond);
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.2), glow); stream.rotation.x = -Math.PI / 2; stream.rotation.z = 0.6; stream.position.set(w.x + 0.8, 0.06, w.z - 0.6); group.add(stream);
    for (let i = 0; i < 5; i++) add(ball, glow, 0.14, 0.1, 0.14, w.x - 0.9 + rng() * 1.6, 0.1, w.z - 0.5 + rng() * 1.2);
    const barrel = M({ color: 0x1b2428 });
    for (let i = 0; i < 3; i++) { const bx = w.x + 0.8 + (rng() - 0.5) * 0.5, bz = w.z + 0.9 + (rng() - 0.5) * 0.4; add(cyl, barrel, 0.42, 0.6, 0.42, bx, 0.3, bz); add(cyl, glow, 0.3, 0.04, 0.3, bx, 0.62, bz); }
    const warn = signMesh('TOXIC SLUDGE', '#2f8a6c', '#dfffe0', 256, 64, 1.0, 0.32, 'bold 34px sans-serif'); warn.position.set(w.x - 0.9, 0.7, w.z - 1.1); group.add(warn);
    add(cyl, M({ color: 0x9aa7ab }), 0.06, 0.6, 0.06, w.x - 0.9, 0.3, w.z - 1.12);
  } else if (type === 'school') {
    add(box, M({ color: 0x5a6a7c }), F, 2.3, F, w.x, 1.15, w.z);
    add(box, M({ color: 0x8aa0a4 }), F + 0.15, 0.12, F + 0.15, w.x, 2.32, w.z);
    const winMat = glowMat(0xf6e94a), dark = M({ color: 0x34506e });
    for (const [dx, dz, ry] of [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]]) for (const row of [0.6, 1.6]) for (const off of [-0.8, 0, 0.8]) {
      add(box, rng() < 0.45 ? winMat : dark, 0.45, 0.55, 0.06, w.x + dx * (F / 2 + 0.03) + (dz ? off : 0), row, w.z + dz * (F / 2 + 0.03) + (dx ? off : 0), ry);
    }
    const sign = signMesh('DUVALL HIGH SCHOOL', '#3e5a5a', '#dfe8e8', 512, 80, 2.4, 0.4, 'bold 44px sans-serif'); sign.position.set(w.x, 2.0, w.z + F / 2 + 0.05); group.add(sign);
    add(cyl, M({ color: 0x9aa7ab }), 0.06, 3.2, 0.06, w.x + 1.1, 1.6, w.z + 1.1); add(box, M({ color: 0xc23b3b }), 0.5, 0.3, 0.02, w.x + 1.35, 3.0, w.z + 1.1);
    add(box, M({ color: 0x2a3a40 }), 0.8, 1.0, 0.1, w.x, 0.5, w.z + F / 2 + 0.02);
  } else if (type === 'skate') {
    slab(0x7f9396, 0.1);
    const conc = M({ color: 0x8fa3a6 });
    for (const dx of [-1, 1]) { const ramp = add(box, conc, 0.6, 0.6, 1.2, w.x + dx * 0.9, 0.3, w.z); ramp.rotation.z = dx > 0 ? 0.6 : -0.6; }
    const rail = M({ color: 0x9aa7ab }); add(box, rail, 1.6, 0.05, 0.05, w.x, 0.5, w.z + 0.9); add(box, rail, 0.05, 0.45, 0.05, w.x - 0.75, 0.25, w.z + 0.9); add(box, rail, 0.05, 0.45, 0.05, w.x + 0.75, 0.25, w.z + 0.9);
    const bowl = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), M({ color: 0x6b7f82 })); bowl.rotation.x = -Math.PI / 2; bowl.position.set(w.x, 0.11, w.z - 0.7); group.add(bowl);
    const fence = M({ color: 0x4a5a5e }); for (let i = -3; i <= 3; i++) add(box, fence, 0.05, 0.6, 0.05, w.x + i * 0.42, 0.3, w.z - 1.3); add(box, fence, 2.6, 0.04, 0.04, w.x, 0.55, w.z - 1.3);
  }
}
