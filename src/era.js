// Eras: the same towns in a different time. 'present' is the game as it is; 'future' swaps in glass towers, neon, pod
// houses, glowing roads, hover cars, jets and hover tanks. Future unlocks by beating Megacity in either game (or with the
// tester code); the choice is saved on this device and applies from the next round.
import * as THREE from 'three';

export const ERAS = [['past', 'Wild West'], ['present', 'Present'], ['future', 'Future']];
export function eraUnlocked(e) {
  if (e === 'present') return true;
  try { return localStorage.getItem('dc_era_' + e) === '1' || (JSON.parse(localStorage.getItem('oo_skins_owned') || '[]').includes('tornado:acid')); } catch { return false; }
}
export function unlockEra(e) { const was = eraUnlocked(e); try { localStorage.setItem('dc_era_' + e, '1'); } catch { /* ignore */ } return !was; }
export function getEra() { try { const e = localStorage.getItem('dc_era') || 'present'; return eraUnlocked(e) ? e : 'present'; } catch { return 'present'; } }
export function setEra(e) { try { localStorage.setItem('dc_era', e); } catch { /* ignore */ } }
export const isFuture = () => getEra() === 'future';

// a vehicle floats instead of rolling: wheels hidden, lifted off the road over a glowing pad
const padGeo = new THREE.CircleGeometry(0.5, 20), padMats = new Map();
const padMat = (c) => { if (!padMats.has(c)) padMats.set(c, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); return padMats.get(c); };
export function hoverize(g, col = 0x3af0ff, lift = 0.32) {
  if (g.userData.hover) return g;
  g.traverse((m) => { if (m.isMesh && m.geometry && m.geometry.type === 'CylinderGeometry' && Math.abs(m.rotation.z - Math.PI / 2) < 0.01) m.visible = false; });
  const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()), s = g.scale.x || 1;
  for (const ch of g.children) ch.position.y += lift;
  const pad = new THREE.Mesh(padGeo, padMat(col)); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.05; pad.scale.set(sz.x / s * 1.1, sz.z / s * 1.1, 1); g.add(pad);
  g.userData.hover = true; return g;
}
// the seeding plane as a sleek jet: no propellers, silver and black with neon stripes and glowing engines
export function futurePlane(p) {
  const silver = new THREE.MeshLambertMaterial({ color: 0xc8d0dc }), black = new THREE.MeshLambertMaterial({ color: 0x1a1e2a }), neon = new THREE.MeshBasicMaterial({ color: 0x3af0ff });
  p.traverse((m) => { if (!m.isMesh) return; const c = m.material.color && m.material.color.getHex(); if (c === 0xf2f2f2) m.material = silver; else if (c === 0xf07a28) m.material = neon; else if (c === 0x2a2e33) m.visible = false; });
  for (const x of [-0.9, 0.9]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4fd8 })); e.position.set(x, 0, 0.05); p.add(e); }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 10), new THREE.MeshBasicMaterial({ color: 0x8af4ff, transparent: true, opacity: 0.8 })); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0, -1.45); p.add(tail);
  void black; return p;
}

// the era row under the level buttons: PRESENT / FUTURE (locked until Megacity is beaten); applies from the next round
export function eraPicker(after) { let row = document.getElementById('eraRow'); if (!row) { row = document.createElement('div'); row.id = 'eraRow'; after.after(row); }
  const cur = getEra(); row.innerHTML = '<span class="eraLbl">ERA</span>';
  for (const [id, name] of ERAS) { const ok = eraUnlocked(id), b = document.createElement('button'); b.className = 'ghost eraBtn' + (id === cur ? ' on' : '') + (ok ? '' : ' locked');
    b.textContent = ({ future: '🚀 ', past: '🤠 ' }[id] || '🏙️ ') + name.toUpperCase() + (ok ? '' : ' 🔒'); b.title = ok ? '' : 'Beat Megacity to unlock';
    b.addEventListener('click', (ev) => { ev.stopPropagation(); if (!ok) { const h = row.querySelector('.eraHint') || row.appendChild(document.createElement('div')); h.className = 'eraHint'; h.textContent = '🔒 Beat Megacity (the last town) to unlock the ' + name + '.'; return; } setEra(id); eraPicker(after); });
    row.appendChild(b); } }

// ---------- the Wild West: horses pulling buggies, wagons and a stagecoach; a cannon for the army; a biplane ----------
export const isPast = () => getEra() === 'past';
const WM = new Map(); const wm = (c) => { if (!WM.has(c)) WM.set(c, new THREE.MeshLambertMaterial({ color: c })); return WM.get(c); };
const BX = new THREE.BoxGeometry(1, 1, 1), WHEEL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const put = (parent, geo, c, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, typeof c === 'number' ? wm(c) : c); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
// a horse facing +z at z: legs are tall thin boxes standing on the ground, so the game's walk cycle swings them
export function horse(parent, x, z, coat = 0x6a4428) {
  const mane = coat === 0xe8e0d0 ? 0x8a8a88 : 0x2a1a10;
  put(parent, BX, coat, 0.34, 0.36, 0.95, x, 0.72, z); // body
  for (const [lx, lz] of [[-0.12, 0.34], [0.12, 0.34], [-0.12, -0.34], [0.12, -0.34]]) put(parent, BX, coat, 0.09, 0.56, 0.09, x + lx, 0.28, z + lz); // legs
  put(parent, BX, coat, 0.16, 0.42, 0.18, x, 0.98, z + 0.5, -0.6); put(parent, BX, coat, 0.16, 0.16, 0.36, x, 1.16, z + 0.72, 0.25); // neck, head
  put(parent, BX, mane, 0.05, 0.3, 0.2, x, 1.08, z + 0.44, -0.6); put(parent, BX, mane, 0.08, 0.32, 0.08, x, 0.68, z - 0.52, 0.5); // mane, tail
  for (const ex of [-0.05, 0.05]) put(parent, BX, coat, 0.04, 0.1, 0.04, x + ex, 1.3, z + 0.62);
}
const spokedWheel = (parent, x, y, z, r, c = 0x4a2e1a) => { const w = put(parent, WHEEL, c, r * 2, 0.07, r * 2, x, y, z, 0, 0, Math.PI / 2); for (let i = 0; i < 3; i++) put(w, BX, 0xb08a5a, 0.06, 1.0, 0.06, 0, 0, 0, i * Math.PI / 3, 0, 0); return w; };
// car -> horse and buggy, van -> covered wagon, truck -> stagecoach, tank -> cannon. Sized like the car it replaces (+z is forward)
export function buildWagon(g, kind = 'car', paint = 0x8a3a2a) {
  if (kind === 'tank') return buildCannon(g);
  const coats = [0x6a4428, 0x3a2418, 0xa0703a, 0xe8e0d0, 0x2a2420];
  if (kind === 'car') { horse(g, 0, 0.75, coats[(Math.random() * coats.length) | 0]); put(g, BX, paint, 0.75, 0.24, 0.8, 0, 0.62, -0.5); put(g, BX, 0x2a1a10, 0.7, 0.1, 0.5, 0, 0.82, -0.62);
    put(g, BX, 0x1a1a1c, 0.8, 0.04, 0.6, 0, 1.25, -0.55); for (const sx of [-0.36, 0.36]) { put(g, BX, 0x4a2e1a, 0.04, 0.04, 0.9, sx * 0.5, 0.62, 0.15); put(g, BX, 0x2a1a10, 0.03, 0.45, 0.03, sx, 1.03, -0.6); spokedWheel(g, sx * 1.2, 0.36, -0.55, 0.36); } }
  else if (kind === 'van') { horse(g, -0.2, 0.95, coats[0]); horse(g, 0.2, 0.95, coats[2]); put(g, BX, 0x7a5232, 0.9, 0.3, 1.3, 0, 0.62, -0.5); for (let i = 0; i < 4; i++) put(g, WHEEL, 0xf0e8d0, 0.95, 1.0, 0.75, 0, 0.82, -1.05 + i * 0.36, Math.PI / 2, 0, 0); // white canvas hoops
    for (const sx of [-0.48, 0.48]) for (const sz of [-0.05, -0.95]) spokedWheel(g, sx, 0.34, sz, 0.34); }
  else { horse(g, -0.2, 1.05, coats[1]); horse(g, 0.2, 1.05, coats[4]); put(g, BX, paint === 0x8a3a2a ? 0x6a1a1a : paint, 0.85, 0.75, 1.1, 0, 0.95, -0.55); put(g, BX, 0xd8b04a, 0.88, 0.05, 1.13, 0, 1.34, -0.55); put(g, BX, 0x2a1a10, 0.7, 0.12, 0.7, 0, 1.43, -0.55);
    for (const sx of [-0.43, 0.43]) { put(g, BX, 0x1a1a24, 0.02, 0.3, 0.4, sx, 1.05, -0.5); for (const sz of [-0.1, -1.0]) spokedWheel(g, sx * 1.1, 0.38, sz, 0.38); } put(g, BX, 0x2a1a10, 0.6, 0.08, 0.3, 0, 1.0, 0.15); }
  return g;
}
// the army's cannon: a bronze barrel on a wooden carriage with two big wheels. userData.turret aims it, like the tank's
export function buildCannon(g = new THREE.Group()) {
  put(g, BX, 0x5a3a24, 0.5, 0.18, 1.2, 0, 0.42, -0.2, 0.18); for (const sx of [-0.4, 0.4]) spokedWheel(g, sx, 0.42, 0.1, 0.42);
  const turret = new THREE.Group(); turret.position.set(0, 0.62, 0.05); g.add(turret);
  const brass = new THREE.MeshPhongMaterial({ color: 0xb8863a, shininess: 50 }); put(turret, WHEEL, brass, 0.26, 1.3, 0.26, 0, 0.05, 0.4, Math.PI / 2 - 0.12); put(turret, WHEEL, brass, 0.34, 0.12, 0.34, 0, 0.12, 1.02, Math.PI / 2 - 0.12); put(turret, BX, 0x2a1a10, 0.2, 0.2, 0.2, 0, 0.02, -0.25);
  g.userData.turret = turret; return g;
}
// the storm chaser in a stagecoach: two horses, a big box camera on a tripod on the roof, and the camera's flash
export function buildChaserCoach() {
  const g = new THREE.Group(); buildWagon(g, 'truck', 0x2a3a5a);
  const mast = new THREE.Group(); mast.position.set(0, 1.5, -0.55); g.add(mast); for (const a of [0, 2.1, 4.2]) put(mast, BX, 0x2a1a10, 0.03, 0.5, 0.03, Math.cos(a) * 0.1, 0.22, Math.sin(a) * 0.1, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
  put(mast, BX, 0x1a1a1c, 0.26, 0.22, 0.3, 0, 0.55, 0); put(mast, WHEEL, 0x8a8a90, 0.14, 0.12, 0.14, 0, 0.55, 0.2, Math.PI / 2); g.userData.mast = mast;
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); flash.position.set(0, 2.1, -0.3); g.add(flash); g.userData.flash = flash;
  g.scale.setScalar(1.15); return g;
}
// the seeding plane as an early biplane: canvas and wood, a second wing on struts
export function pastPlane(p) {
  const canvas = wm(0xe8dcc0), red = wm(0xa83a2a);
  p.traverse((m) => { if (!m.isMesh) return; const c = m.material.color && m.material.color.getHex(); if (c === 0xf2f2f2) m.material = canvas; else if (c === 0xf07a28) m.material = red; });
  put(p, BX, red, 3.2, 0.06, 0.55, 0, 0.6, 0.1); for (const x of [-1.2, -0.5, 0.5, 1.2]) put(p, BX, 0x4a2e1a, 0.04, 0.55, 0.04, x, 0.32, 0.1);
  return p;
}
