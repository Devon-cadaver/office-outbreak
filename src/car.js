// The player's car: a chunky sedan in the town's style, with headlights, dents and smoke as it takes damage.
import * as THREE from 'three';
import { ghostify } from './skins.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const M = (c) => new THREE.MeshLambertMaterial({ color: c });

export function makeCar(color = 0x3f6fd8, skin = null) {
  if (skin) color = skin.color;
  const g = new THREE.Group();
  const body = M(color), glass = M(0x5a86a8), dark = M(0x101416), head = new THREE.MeshBasicMaterial({ color: 0xffe27a }), tail = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
  const part = (geo, mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; };
  const partC = (geo, c, sx, sy, sz, x, y, z) => part(geo, M(c), sx, sy, sz, x, y, z);
  if (skin && skin.replace) { skin.dress(partC, 'car'); }
  else {
  part(box, body, 0.95, 0.38, 1.9, 0, 0.38, 0);
  part(box, body, 0.85, 0.12, 0.5, 0, 0.62, 0.6);
  part(box, glass, 0.82, 0.36, 1.0, 0, 0.72, -0.15);
  part(box, body, 0.86, 0.06, 1.02, 0, 0.93, -0.15);
  for (const [wx, wz] of [[-0.47, 0.6], [0.47, 0.6], [-0.47, -0.6], [0.47, -0.6]]) { const w = part(cyl, dark, 0.36, 0.16, 0.36, wx, 0.18, wz); w.rotation.z = Math.PI / 2; }
  for (const hx of [-0.32, 0.32]) { part(box, head, 0.18, 0.1, 0.05, hx, 0.44, 0.96); part(box, tail, 0.18, 0.08, 0.05, hx, 0.44, -0.96); }
  if (skin) skin.dress(partC, 'car'); }
  if (skin && skin.ghost) ghostify(g);
  // headlight beams on the road ahead
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, depthWrite: false }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.03, 2.5); g.add(beam);
  // smoke puffs appear as damage mounts
  const smokeMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e, transparent: true, opacity: 0.55, depthWrite: false });
  const smokes = []; for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(box, smokeMat); s.visible = false; g.add(s); smokes.push({ m: s, t: Math.random() }); }
  g.userData = { smokes, body, hp: 5, maxHp: 5, t: 0 };
  return g;
}

// wheels spin about their axle and animal-shaped rides walk, in proportion to distance travelled
const spokeMat = new THREE.MeshLambertMaterial({ color: 0x8a8f96 }), spokeGeo = new THREE.BoxGeometry(1, 1.1, 0.16);
function setupMotion(car) {
  const wheels = [], legs = [];
  car.traverse((m) => { if (!m.isMesh || !m.geometry) return; const t = m.geometry.type;
    if (t === 'CylinderGeometry' && Math.abs(m.rotation.z - Math.PI / 2) < 0.01 && m.scale.x === m.scale.z) { const sp = new THREE.Mesh(spokeGeo, spokeMat); m.add(sp); wheels.push(m); }
    else if (t === 'BoxGeometry' && m.scale.y >= 0.4 && m.scale.y > 2.4 * Math.max(m.scale.x, m.scale.z) && m.position.y - m.scale.y / 2 < 0.06) legs.push({ m, x: m.position.x, y: m.position.y, z: m.position.z, h: m.scale.y }); });
  car.motion = { wheels, legs, phase: 0 };
}
export function rollVehicle(car, dist) {
  if (!car.motion) setupMotion(car); const mo = car.motion;
  for (const w of mo.wheels) w.rotation.x += dist / Math.max(0.05, w.scale.x * 0.5);
  if (mo.legs.length) { mo.phase += dist * 3.2; mo.legs.forEach((L, i) => { const a = Math.sin(mo.phase + ((i % 2) ^ (L.z > 0 ? 1 : 0) ? Math.PI : 0)) * 0.55 * Math.min(1, dist * 30); const top = L.y + L.h / 2; L.m.rotation.x = a; L.m.position.y = top - Math.cos(a) * L.h / 2; L.m.position.z = L.z - Math.sin(a) * L.h / 2; }); }
}
export function animateCar(g, dt, moving) {
  const u = g.userData; u.t += dt; if (moving) rollVehicle(g, 6.5 * dt);
  // engine shake and damage smoke
  g.position.y = moving ? Math.sin(u.t * 40) * 0.01 : 0;
  const dmg = 1 - u.hp / u.maxHp; const n = Math.round(dmg * 4);
  u.smokes.forEach((s, i) => { s.m.visible = i < n; if (!s.m.visible) return; s.t += dt * 0.8; if (s.t > 1) s.t = 0; s.m.position.set(0.2 + Math.sin(u.t * 2 + i) * 0.15, 0.75 + s.t * 1.2, 0.5 - i * 0.2); s.m.scale.setScalar(0.2 + s.t * 0.5); s.m.material.opacity = 0.55 * (1 - s.t); });
}
