// Landmarks from the reference art: gas station, fairground wheel, toxic slime pond, school, skate park.
import * as THREE from 'three';
import { CELL } from './city.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const ball = new THREE.IcosahedronGeometry(0.5, 1);
export const LANDMARKS = ['ferris', 'coaster', 'carousel', 'gas', 'slime', 'school', 'skate'];
// rides: { type, pos, speed, ...parts }. speed is 1 while idle; the game raises it during a ride.
export const rides = [];
// small moving parts on landmarks (anemometer cups, clarifier arms): { obj, speed }
export const spinners = [];
export function resetLandmarks() { rides.length = 0; spinners.length = 0; }
export function updateLandmarks(dt) {
  for (const s of spinners) s.obj.rotation.y += dt * s.speed;
  for (const r of rides) {
    if (r.type === 'ferris') r.wheel.rotation.z += dt * 0.35 * r.speed;
    else if (r.type === 'carousel') { r.platform.rotation.y += dt * 0.3 * r.speed; r.bob = (r.bob || 0) + dt * 2 * r.speed; r.horses.forEach((h, i) => { h.position.y = 0.55 + Math.sin(r.bob + i) * 0.1; }); }
    else if (r.type === 'coaster') { r.u = ((((r.u || 0) + dt * 0.05 * r.speed) % 1) + 1) % 1; placeCoasterCars(r); }
  }
}
export function placeCoasterCars(r) {
  r.cars.forEach((car, i) => { const u = (((r.u + i * 0.035) % 1) + 1) % 1; const p = r.curve.getPointAt(u), t = r.curve.getTangentAt(u); car.position.copy(p); car.position.y += 0.12; car.rotation.set(0, Math.atan2(t.x, t.z), 0); car.rotateX(-Math.asin(Math.max(-1, Math.min(1, t.y)))); });
}

export function pickLandmarks(wall, rng) {
  if (wall.forcedLandmarks) return wall.forcedLandmarks; // a mode that lays out its own landmarks (Tornado Alley)
  const rows = wall.length, cols = wall[0].length, picked = new Map(), spots = [];
  for (let y = 2; y < rows - 2; y++) for (let x = 2; x < cols - 2; x++) if (wall[y][x]) {
    if (!wall[y - 1][x] || !wall[y + 1][x] || !wall[y][x - 1] || !wall[y][x + 1]) spots.push([x, y]);
  }
  const taken = [];
  for (const type of [...(wall.extraLandmarks || []), ...LANDMARKS]) {
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
  const ridesSign = (x, z, ry) => { const s = signMesh('RIDES OPEN', '#ffe27a', '#6a3f8a', 320, 64, 1.6, 0.32, 'bold 44px sans-serif'); s.position.set(x, 0.95, z); s.rotation.y = ry; group.add(s); };

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
    rides.push({ type: 'ferris', name: 'Ferris wheel', pos: new THREE.Vector3(w.x, 0, w.z), speed: 1, wheel });
    add(box, M({ color: 0x9a3a4a }), 1.0, 0.7, 0.6, w.x + 0.9, 0.35, w.z + 0.8);
    const bulbs = glowMat(0xffe27a); for (let i = 0; i < 6; i++) add(ball, bulbs, 0.12, 0.12, 0.12, w.x - 1.2 + i * 0.48, 1.1, w.z + 1.25);
    ridesSign(w.x + 0.9, w.z + 1.12, 0); ridesSign(w.x + 1.32, w.z + 0.8, Math.PI / 2);
  } else if (type === 'coaster') {
    // the poster's coaster: purple track with ties on dark tower supports, looping round a dark spire
    slab(0x2d3a4a, 0.06);
    const track = M({ color: 0x8a4fb8 }), tie = M({ color: 0x5a2f80 }), tower = M({ color: 0x1b2238 }), carMat = M({ color: 0x9a3fa0 });
    const pts = [[-1.15, 0.5, -1.1], [-0.2, 1.9, -1.25], [1.05, 1.0, -1.05], [1.25, 1.6, 0.1], [0.95, 0.5, 1.1], [-0.2, 1.75, 1.15], [-1.25, 0.9, 0.45]].map(([x, y, z]) => new THREE.Vector3(w.x + x, y, w.z + z));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.6);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.045, 6, true), track));
    for (let i = 0; i < 56; i++) { const u = i / 56; const p = curve.getPointAt(u), t = curve.getTangentAt(u); const m = new THREE.Mesh(box, tie); m.scale.set(0.3, 0.04, 0.09); m.position.copy(p); m.position.y -= 0.03; m.rotation.y = Math.atan2(t.x, t.z); group.add(m); }
    for (let i = 0; i < 9; i++) { const p = curve.getPointAt(i / 9); const m = new THREE.Mesh(box, tower); m.scale.set(0.14, p.y, 0.14); m.position.set(p.x, p.y / 2, p.z); group.add(m); }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.8, 5), tower); spire.position.set(w.x, 1.4, w.z); group.add(spire);
    add(box, tower, 0.9, 1.1, 0.9, w.x, 0.55, w.z);
    const lamp = glowMat(0xffe27a); add(ball, lamp, 0.12, 0.12, 0.12, w.x + 0.5, 1.15, w.z + 0.5); add(ball, lamp, 0.12, 0.12, 0.12, w.x - 0.5, 1.15, w.z - 0.5);
    const cars = []; for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(box, carMat); c.scale.set(0.3, 0.22, 0.42); group.add(c); cars.push(c); }
    const r = { type: 'coaster', name: 'Roller coaster', pos: new THREE.Vector3(w.x, 0, w.z), speed: 1, curve, cars, u: 0 }; placeCoasterCars(r); rides.push(r);
    ridesSign(w.x + 0.2, w.z + 1.3, 0); ridesSign(w.x + 1.3, w.z + 0.2, Math.PI / 2);
  } else if (type === 'carousel') {
    slab(0x3e5a5a, 0.06);
    const platform = new THREE.Group(); platform.position.set(w.x, 0.12, w.z); group.add(platform);
    const base = new THREE.Mesh(cyl, M({ color: 0xd04a7a })); base.scale.set(2.4, 0.12, 2.4); platform.add(base);
    const pole = M({ color: 0xffd24a }); const cp = new THREE.Mesh(cyl, pole); cp.scale.set(0.16, 1.7, 0.16); cp.position.y = 0.85; platform.add(cp);
    const horseC = [0xf0f0f0, 0x4f8fd6, 0xe85aa0, 0x3fbf4a, 0xff8a2a, 0x9a3fa0]; const horses = [];
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const hp = new THREE.Mesh(cyl, pole); hp.scale.set(0.05, 1.5, 0.05); hp.position.set(Math.cos(a) * 0.85, 0.75, Math.sin(a) * 0.85); platform.add(hp);
      const h = new THREE.Group(); h.position.set(Math.cos(a) * 0.85, 0.55, Math.sin(a) * 0.85); h.rotation.y = -a + Math.PI / 2; const hm = M({ color: horseC[i] });
      const bd = new THREE.Mesh(box, hm); bd.scale.set(0.22, 0.22, 0.5); h.add(bd); const hd = new THREE.Mesh(box, hm); hd.scale.set(0.16, 0.22, 0.2); hd.position.set(0, 0.2, 0.3); h.add(hd);
      for (const [lx, lz] of [[-0.07, 0.18], [0.07, 0.18], [-0.07, -0.18], [0.07, -0.18]]) { const lg = new THREE.Mesh(box, hm); lg.scale.set(0.05, 0.24, 0.05); lg.position.set(lx, -0.2, lz); h.add(lg); }
      platform.add(h); horses.push(h); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.7, 12), new THREE.MeshLambertMaterial({ color: 0xe8445a, transparent: true, opacity: 0.72 })); roof.position.y = 1.95; platform.add(roof);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.05, 6, 24), pole); trim.rotation.x = Math.PI / 2; trim.position.y = 1.62; platform.add(trim);
    const bulbs = glowMat(0xffe27a); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const b = new THREE.Mesh(ball, bulbs); b.scale.setScalar(0.09); b.position.set(Math.cos(a) * 1.35, 1.62, Math.sin(a) * 1.35); platform.add(b); }
    rides.push({ type: 'carousel', name: 'Carousel', pos: new THREE.Vector3(w.x, 0, w.z), speed: 1, platform, horses });
    ridesSign(w.x + 0.2, w.z + 1.3, 0); ridesSign(w.x + 1.3, w.z + 0.2, Math.PI / 2);
  } else if (type === 'base') {
    // the office: the survivors' base, with the mission computer glowing out front
    slab(0x56707a, 0.06);
    add(box, M({ color: 0x5a6a7c }), 2.3, 2.6, 1.6, w.x, 1.3, w.z - 0.4); add(box, M({ color: 0x8aa0a4 }), 2.45, 0.12, 1.75, w.x, 2.62, w.z - 0.4);
    for (const wx of [-0.7, 0, 0.7]) for (const wy of [0.8, 1.7]) add(box, glowMat(0xffe27a), 0.4, 0.4, 0.05, w.x + wx, wy, w.z + 0.43);
    add(box, M({ color: 0x2a3438 }), 0.7, 0.5, 0.5, w.x, 0.25, w.z + 0.95); add(box, glowMat(0x7dff3a), 0.5, 0.35, 0.06, w.x, 0.7, w.z + 0.98);
    const sign = signMesh('BASE', '#1a0f2e', '#7dff3a', 256, 64, 1.4, 0.4); sign.position.set(w.x, 2.9, w.z + 0.4); group.add(sign);
  } else if (type === 'cemetery') {
    slab(0x2f4a38, 0.05);
    const stone = M({ color: 0x8a9298 }), iron = M({ color: 0x2a2e33 });
    for (let i = 0; i < 10; i++) { const a = i * 0.63; add(box, iron, 0.05, 0.8, 0.05, w.x + Math.cos(a) * 1.25, 0.4, w.z + Math.sin(a) * 1.25); }
    for (let i = 0; i < 6; i++) add(box, stone, 0.3, 0.5, 0.1, w.x - 0.9 + (i % 3) * 0.6, 0.25, w.z - 0.2 + Math.floor(i / 3) * 0.7);
    for (const dx of [-0.9, 0, 0.9]) { add(box, M({ color: 0x6a7278 }), 0.6, 0.7, 0.6, w.x + dx, 0.35, w.z - 0.9); add(box, iron, 0.3, 0.4, 0.06, w.x + dx, 0.3, w.z - 0.58); }
    add(ball, glowMat(0x7dff3a), 0.3, 0.3, 0.3, w.x, 1.2, w.z - 0.9);
    const sign = signMesh('CEMETERY', '#1a0f2e', '#c9a6ff', 256, 64, 1.5, 0.4); sign.position.set(w.x, 1.9, w.z + 1.2); group.add(sign);
  } else if (type === 'power') {
    // power plant: turbine hall, two cooling towers venting steam, a striped smokestack and a transformer yard
    slab(0x4a5458, 0.06);
    add(box, M({ color: 0x9aa4a8 }), 1.3, 1.4, 1.1, w.x - 0.55, 0.7, w.z + 0.55); add(box, M({ color: 0x6a7478 }), 1.4, 0.12, 1.2, w.x - 0.55, 1.42, w.z + 0.55);
    for (const wx of [-0.9, -0.55, -0.2]) add(box, glowMat(0xffe27a), 0.2, 0.3, 0.05, w.x + wx, 0.9, w.z + 1.11);
    const tower = new THREE.LatheGeometry([0.62, 0.5, 0.42, 0.4, 0.44, 0.5].map((r, i) => new THREE.Vector2(r, i * 0.42)), 16);
    for (const [tx, tz] of [[0.55, -0.6], [-0.45, -0.75]]) { const t = new THREE.Mesh(tower, M({ color: 0xc9cfd2, side: THREE.DoubleSide })); t.position.set(w.x + tx, 0, w.z + tz); group.add(t); const steam = new THREE.Mesh(ball, new THREE.MeshLambertMaterial({ color: 0xe8eef0, transparent: true, opacity: 0.55, depthWrite: false })); steam.scale.set(0.9, 0.5, 0.9); steam.position.set(w.x + tx, 2.4, w.z + tz); group.add(steam); }
    for (let i = 0; i < 4; i++) add(cyl, M({ color: i % 2 ? 0xe8e8e8 : 0xc23b3b }), 0.24, 0.65, 0.24, w.x + 0.8, 0.33 + i * 0.65, w.z + 0.6);
    for (const dx of [0.35, 0.75]) { add(box, M({ color: 0x5a6a50 }), 0.25, 0.4, 0.25, w.x + dx, 0.2, w.z + 1.05); add(box, M({ color: 0x2a2e33 }), 0.04, 0.6, 0.04, w.x + dx, 0.6, w.z + 1.05); }
    const sign = signMesh('POWER PLANT', '#1a0f2e', '#ffe27a', 320, 64, 1.8, 0.36, 'bold 38px sans-serif'); sign.position.set(w.x - 0.55, 1.75, w.z + 1.12); group.add(sign);
  } else if (type === 'water') {
    // water station: a tall tank on legs, a pump house and a treatment pool
    slab(0x3e5a62, 0.06);
    for (const [lx, lz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) add(box, M({ color: 0x6a7a80 }), 0.08, 2.4, 0.08, w.x - 0.5 + lx, 1.2, w.z - 0.4 + lz);
    add(cyl, M({ color: 0x4f8fd6 }), 1.25, 0.9, 1.25, w.x - 0.5, 2.85, w.z - 0.4); add(new THREE.ConeGeometry(0.66, 0.4, 12), M({ color: 0x3a6a9a }), 1, 1, 1, w.x - 0.5, 3.5, w.z - 0.4);
    const tankSign = signMesh('WATER', '#4f8fd6', '#ffffff', 256, 64, 0.9, 0.24); tankSign.position.set(w.x - 0.5, 2.9, w.z + 0.24); group.add(tankSign);
    add(box, M({ color: 0xd8d0c0 }), 0.9, 0.8, 0.8, w.x + 0.65, 0.4, w.z - 0.5); add(box, M({ color: 0x7a3f3a }), 1.0, 0.12, 0.9, w.x + 0.65, 0.84, w.z - 0.5);
    add(box, M({ color: 0x8a9298 }), 1.9, 0.18, 0.95, w.x + 0.1, 0.09, w.z + 0.75); add(box, new THREE.MeshLambertMaterial({ color: 0x3fb8e8, emissive: 0x0a3a5a }), 1.75, 0.04, 0.8, w.x + 0.1, 0.18, w.z + 0.75);
    add(box, M({ color: 0x5a6a70 }), 0.1, 0.1, 0.9, w.x + 0.45, 0.2, w.z + 0.1);
  } else if (type === 'firestation') {
    // fire station: red-brick engine hall with two bay doors, a hose-drying tower and an engine parked on the apron
    slab(0x5a5a5e, 0.06);
    const brick = M({ color: 0xa8382e }), trim = M({ color: 0xe8e2d0 }), dark = M({ color: 0x22262a }), red = M({ color: 0xd42a20 }), steel = M({ color: 0xc8ccd0 });
    add(box, brick, 2.2, 1.5, 1.4, w.x - 0.15, 0.75, w.z - 0.5); add(box, trim, 2.3, 0.12, 1.5, w.x - 0.15, 1.52, w.z - 0.5);
    for (const dx of [-0.65, 0.35]) { add(box, trim, 0.82, 1.02, 0.04, w.x - 0.15 + dx, 0.51, w.z + 0.21); add(box, steel, 0.7, 0.92, 0.05, w.x - 0.15 + dx, 0.46, w.z + 0.22); for (let r = 0; r < 3; r++) add(box, dark, 0.66, 0.03, 0.06, w.x - 0.15 + dx, 0.2 + r * 0.25, w.z + 0.23); }
    add(box, brick, 0.55, 2.9, 0.55, w.x + 1.0, 1.45, w.z - 0.85); add(box, trim, 0.66, 0.1, 0.66, w.x + 1.0, 2.92, w.z - 0.85); add(box, glowMat(0xff3a3a), 0.16, 0.16, 0.16, w.x + 1.0, 3.06, w.z - 0.85);
    add(box, red, 1.4, 0.42, 0.55, w.x - 0.35, 0.34, w.z + 0.85); add(box, red, 0.42, 0.34, 0.55, w.x + 0.48, 0.5, w.z + 0.85); add(box, M({ color: 0x3a5a6a }), 0.04, 0.2, 0.46, w.x + 0.7, 0.55, w.z + 0.85);
    add(box, steel, 1.15, 0.06, 0.28, w.x - 0.42, 0.6, w.z + 0.85); add(box, glowMat(0xff2a2a), 0.12, 0.07, 0.4, w.x + 0.48, 0.71, w.z + 0.85);
    for (const dx of [-0.8, 0.0, 0.48]) for (const dz of [-0.29, 0.29]) add(cyl, dark, 0.24, 0.1, 0.24, w.x + dx, 0.12, w.z + 0.85 + dz).rotation.x = Math.PI / 2;
    const sign = signMesh('FIRE STATION', '#a8382e', '#ffffff', 320, 64, 1.7, 0.32, 'bold 38px sans-serif'); sign.position.set(w.x - 0.15, 1.25, w.z + 0.22); group.add(sign);
  } else if (type === 'police') {
    // police station: concrete block with a blue band, lit windows, two cruisers out front, a flag and a radio mast
    slab(0x56606a, 0.06);
    const wall = M({ color: 0xc9ccd0 }), blue = M({ color: 0x2a4a8a }), dark = M({ color: 0x22262a }), lit = glowMat(0xf6e94a), white = M({ color: 0xf0f0f0 });
    add(box, wall, 2.3, 1.8, 1.4, w.x, 0.9, w.z - 0.5); add(box, blue, 2.33, 0.24, 1.43, w.x, 1.42, w.z - 0.5); add(box, dark, 2.4, 0.1, 1.5, w.x, 1.84, w.z - 0.5);
    for (const wx of [-0.8, -0.4, 0.4, 0.8]) add(box, lit, 0.3, 0.35, 0.05, w.x + wx, 0.8, w.z + 0.21);
    add(box, blue, 0.5, 0.85, 0.06, w.x, 0.43, w.z + 0.22); add(box, dark, 0.05, 1.3, 0.05, w.x + 0.85, 2.5, w.z - 0.9); add(box, dark, 0.4, 0.04, 0.04, w.x + 0.85, 2.9, w.z - 0.9);
    for (const dx of [-0.6, 0.6]) { add(box, white, 0.46, 0.22, 0.9, w.x + dx, 0.2, w.z + 0.85); add(box, dark, 0.42, 0.16, 0.45, w.x + dx, 0.38, w.z + 0.8); add(box, glowMat(0xff2a2a), 0.12, 0.06, 0.1, w.x + dx - 0.08, 0.49, w.z + 0.8); add(box, glowMat(0x2a6aff), 0.12, 0.06, 0.1, w.x + dx + 0.08, 0.49, w.z + 0.8); }
    add(cyl, M({ color: 0x9aa7ab }), 0.05, 2.3, 0.05, w.x - 1.2, 1.15, w.z + 1.15); add(box, blue, 0.5, 0.3, 0.02, w.x - 0.94, 2.1, w.z + 1.15);
    const sign = signMesh('POLICE', '#2a4a8a', '#ffffff', 256, 64, 1.2, 0.3); sign.position.set(w.x, 1.42, w.z + 0.23); group.add(sign);
  } else if (type === 'weather') {
    // weather station: a radar dome on a tower, an instrument hut, a Stevenson screen and a spinning anemometer
    slab(0x3f6a48, 0.05);
    const white = M({ color: 0xeef0f2 }), grey = M({ color: 0xa8b0b4 }), dark = M({ color: 0x2a2e33 });
    add(box, grey, 0.55, 1.9, 0.55, w.x + 0.55, 0.95, w.z - 0.5); add(new THREE.SphereGeometry(0.5, 16, 12), white, 1.3, 1.3, 1.3, w.x + 0.55, 2.4, w.z - 0.5);
    add(box, white, 1.1, 0.8, 0.9, w.x - 0.6, 0.4, w.z + 0.55); add(box, grey, 1.2, 0.08, 1.0, w.x - 0.6, 0.83, w.z + 0.55); add(box, glowMat(0xf6e94a), 0.3, 0.25, 0.05, w.x - 0.6, 0.5, w.z + 1.01);
    for (const [lx, lz] of [[-0.12, -0.1], [0.12, -0.1], [-0.12, 0.1], [0.12, 0.1]]) add(box, white, 0.04, 0.6, 0.04, w.x - 0.8 + lx, 0.3, w.z - 0.7 + lz);
    add(box, white, 0.38, 0.32, 0.3, w.x - 0.8, 0.75, w.z - 0.7);
    add(box, dark, 0.05, 2.5, 0.05, w.x - 0.05, 1.25, w.z - 1.05);
    const cups = new THREE.Group(); cups.position.set(w.x - 0.05, 2.5, w.z - 1.05); group.add(cups); const cg = new THREE.SphereGeometry(0.07, 6, 4);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; const arm = new THREE.Mesh(box, dark); arm.scale.set(0.34, 0.02, 0.02); arm.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17); arm.rotation.y = -a; cups.add(arm); const c = new THREE.Mesh(cg, white); c.position.set(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34); cups.add(c); }
    spinners.push({ obj: cups, speed: 6 });
    const sign = signMesh('WEATHER STATION', '#1a3a4a', '#9fd6ff', 320, 64, 1.5, 0.3, 'bold 36px sans-serif'); sign.position.set(w.x - 0.6, 1.1, w.z + 1.02); group.add(sign);
  } else if (type === 'radio') {
    // radio tower: a tall red-and-white lattice mast with dishes and a blinking light, a transmitter hut at its foot
    slab(0x4a5458, 0.06);
    const red = M({ color: 0xd43a2a }), white = M({ color: 0xf0f0f0 }), dark = M({ color: 0x2a2e33 }), H = 8.8, b0 = 0.42, b1 = 0.08, cx = w.x + 0.3, cz = w.z - 0.3, tilt = Math.atan2(b0 - b1, H);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = add(box, dark, 0.07, H / Math.cos(tilt), 0.07, cx + sx * (b0 + b1) / 2, H / 2, cz + sz * (b0 + b1) / 2); leg.rotation.set(-sz * tilt, 0, sx * tilt); }
    for (let i = 0; i < 8; i++) { const y = 0.55 + i * 1.1, s = 2 * (b0 - (b0 - b1) * y / H); add(box, i % 2 ? white : red, s + 0.08, 0.1, s + 0.08, cx, y, cz); }
    add(box, red, 0.06, 1.4, 0.06, cx, H + 0.7, cz); add(box, glowMat(0xff2a2a), 0.18, 0.18, 0.18, cx, H + 1.45, cz);
    for (const [y, ry] of [[6.2, 0.4], [4.6, 2.2]]) { const d = add(cyl, white, 0.6, 0.12, 0.6, cx + Math.sin(ry) * 0.3, y, cz + Math.cos(ry) * 0.3); d.rotation.set(Math.PI / 2, 0, ry, 'YXZ'); }
    add(box, M({ color: 0xd8d0c0 }), 1.0, 0.8, 0.8, w.x - 0.65, 0.4, w.z + 0.6); add(box, dark, 1.1, 0.08, 0.9, w.x - 0.65, 0.84, w.z + 0.6);
    const sign = signMesh('RADIO 101.9 FM', '#1a0f2e', '#ff7ab8', 320, 64, 1.4, 0.28, 'bold 38px sans-serif'); sign.position.set(w.x - 0.65, 0.55, w.z + 1.01); group.add(sign);
  } else if (type === 'sewage') {
    // sewage plant: two round settling tanks with turning skimmer arms, an aeration basin, pipes and a pump hut
    slab(0x4a5048, 0.06);
    const conc = M({ color: 0x8a9298 }), brown = M({ color: 0x6a5626 }), murk = M({ color: 0x5a6a32 }), dark = M({ color: 0x2a2e33 }), pipe = M({ color: 0x3a6a8a });
    for (const cx of [-0.62, 0.62]) { add(cyl, conc, 1.05, 0.36, 1.05, w.x + cx, 0.18, w.z - 0.68); add(cyl, brown, 0.92, 0.04, 0.92, w.x + cx, 0.37, w.z - 0.68);
      const arm = new THREE.Group(); arm.position.set(w.x + cx, 0.42, w.z - 0.68); group.add(arm); const a = new THREE.Mesh(box, dark); a.scale.set(0.95, 0.05, 0.08); arm.add(a); const hub = new THREE.Mesh(cyl, dark); hub.scale.set(0.14, 0.14, 0.14); arm.add(hub); spinners.push({ obj: arm, speed: 0.6 }); }
    add(box, conc, 2.3, 0.3, 0.8, w.x - 0.1, 0.15, w.z + 0.68); add(box, murk, 2.15, 0.04, 0.66, w.x - 0.1, 0.31, w.z + 0.68);
    for (let i = 0; i < 6; i++) add(ball, M({ color: 0x8a8a5a }), 0.12, 0.05, 0.12, w.x - 0.95 + i * 0.34, 0.34, w.z + 0.68 + (i % 2 ? 0.15 : -0.15));
    add(cyl, pipe, 0.12, 1.4, 0.12, w.x, 0.25, w.z - 0.05).rotation.z = Math.PI / 2; add(cyl, pipe, 0.12, 0.6, 0.12, w.x + 1.2, 0.3, w.z + 0.2);
    add(box, M({ color: 0xd8d0c0 }), 0.42, 0.55, 0.4, w.x + 1.12, 0.28, w.z - 0.05); add(box, dark, 0.48, 0.06, 0.46, w.x + 1.12, 0.58, w.z - 0.05);
    const sign = signMesh('SEWAGE PLANT', '#4a3a1a', '#e8d08a', 320, 64, 1.4, 0.28, 'bold 38px sans-serif'); sign.position.set(w.x - 0.1, 0.62, w.z + 1.1); group.add(sign); add(cyl, M({ color: 0x9aa7ab }), 0.05, 0.5, 0.05, w.x - 0.1, 0.25, w.z + 1.12);
  } else if (type === 'nuclear') {
    // nuclear plant: one huge cooling tower venting steam, a domed reactor building and a turbine hall
    slab(0x4a5458, 0.06);
    const conc = M({ color: 0xc9cfd2, side: THREE.DoubleSide }), wall = M({ color: 0xd8dde0 }), grey = M({ color: 0x9aa4a8 }), dark = M({ color: 0x2a2e33 });
    const tower = new THREE.LatheGeometry([0.88, 0.72, 0.58, 0.52, 0.55, 0.63].map((r, i) => new THREE.Vector2(r, i * 0.66)), 18);
    const t = new THREE.Mesh(tower, conc); t.position.set(w.x - 0.45, 0, w.z - 0.45); group.add(t);
    const steam = new THREE.MeshLambertMaterial({ color: 0xeef2f4, transparent: true, opacity: 0.6, depthWrite: false }); for (const [s, y, ox] of [[1.3, 3.8, 0], [1.0, 4.5, 0.3], [0.7, 5.1, 0.55]]) add(ball, steam, s, s * 0.7, s, w.x - 0.45 + ox, y, w.z - 0.45);
    add(cyl, wall, 1.0, 1.0, 1.0, w.x + 0.68, 0.5, w.z + 0.55); add(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), wall, 1, 1, 1, w.x + 0.68, 1.0, w.z + 0.55);
    add(box, grey, 0.8, 0.75, 0.6, w.x + 0.85, 0.38, w.z - 0.8); add(box, dark, 0.86, 0.06, 0.66, w.x + 0.85, 0.78, w.z - 0.8);
    for (let i = 0; i < 3; i++) add(cyl, M({ color: i % 2 ? 0xe8e8e8 : 0xc23b3b }), 0.16, 0.5, 0.16, w.x + 1.1, 1.0 + i * 0.5, w.z - 0.95);
    const sign = signMesh('NUCLEAR', '#ffd21a', '#111111', 256, 64, 0.9, 0.24); sign.position.set(w.x + 0.68, 0.55, w.z + 1.06); group.add(sign);
    add(box, glowMat(0x7dff3a), 0.5, 0.06, 0.06, w.x + 0.68, 0.25, w.z + 1.06);
  } else if (type === 'lab') {
    slab(0x4a5a60, 0.06);
    add(box, M({ color: 0xd8dde0 }), 2.3, 2.0, 1.8, w.x, 1.0, w.z - 0.3);
    for (const dx of [-0.75, 0.75]) { add(cyl, new THREE.MeshLambertMaterial({ color: 0x3fdf6a, transparent: true, opacity: 0.6 }), 0.5, 1.4, 0.5, w.x + dx, 0.7, w.z + 0.9); add(cyl, M({ color: 0x2a3438 }), 0.56, 0.12, 0.56, w.x + dx, 1.45, w.z + 0.9); }
    add(box, glowMat(0x3fdf6a), 1.0, 0.3, 0.05, w.x, 1.5, w.z + 0.62);
    const sign = signMesh('LAB', '#1a0f2e', '#3fdf6a', 256, 64, 1.2, 0.4); sign.position.set(w.x, 2.3, w.z + 0.5); group.add(sign);
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
    const sign = signMesh('ASHFORD HIGH SCHOOL', '#3e5a5a', '#dfe8e8', 512, 80, 2.4, 0.4, 'bold 44px sans-serif'); sign.position.set(w.x, 2.0, w.z + F / 2 + 0.05); group.add(sign);
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
