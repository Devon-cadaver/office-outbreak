// Low-poly block characters. Outfits sampled from the reference sprite sheet.
import * as THREE from 'three';

export const OUTFITS = {
  worker:  { skin: 0xf1c7a0, hair: 0x5a3a22, shirt: 0x4f8fd6, pants: 0x3b3f55, shoes: 0x2a2320, tie: 0x2a3d7a },
  vest:    { skin: 0xf1c7a0, hair: 0x1f2740, shirt: 0xff7a1a, pants: 0x2c3148, shoes: 0x1a1a1a, tie: null, cap: 0x1f2740 },
  suit:    { skin: 0xf3d2b3, hair: null,     shirt: 0x3a3d4a, pants: 0x30333f, shoes: 0x1a1a1a, tie: 0xc62828 },
  hoodie:  { skin: 0xf1c7a0, hair: 0x7a3fa8, shirt: 0x2a2730, pants: 0x3a5fa8, shoes: 0x1a1a1a, tie: null },
  hivis:   { skin: 0xf1c7a0, hair: 0x1f2740, shirt: 0xd8f03a, pants: 0x2c3148, shoes: 0x1a1a1a, tie: null, cap: 0x1f2740 },
  punk:    { skin: 0xf1c7a0, hair: 0x3fbf4a, shirt: 0x1e1b22, pants: 0x3a4a6a, shoes: 0x1a1a1a, tie: null },
};

const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}
const box = new THREE.BoxGeometry(1, 1, 1);
function part(color, w, h, d, x, y, z) {
  const m = new THREE.Mesh(box, mat(color));
  m.scale.set(w, h, d); m.position.set(x, y, z);
  return m;
}

function zombify(o) {
  const dark = (c, f) => { const col = new THREE.Color(c); col.multiplyScalar(f); return col.getHex(); };
  return { ...o, skin: 0x6fd0a8, shirt: dark(o.shirt, 0.55), pants: dark(o.pants, 0.55), hair: o.hair == null ? null : dark(o.hair, 0.5), blood: 0x8b1a1a };
}

export function makeCharacter(outfitName, { zombie = false } = {}) {
  let o = OUTFITS[outfitName] || OUTFITS.worker;
  if (zombie) o = zombify(o);
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);

  // legs (pivot at hip)
  const legL = new THREE.Group(); legL.position.set(-0.17, 0.9, 0); legL.add(part(o.pants, 0.28, 0.75, 0.3, 0, -0.38, 0)); legL.add(part(o.shoes, 0.3, 0.16, 0.42, 0, -0.82, 0.05));
  const legR = legL.clone(); legR.position.x = 0.17;
  body.add(legL, legR);
  // torso
  body.add(part(o.shirt, 0.8, 0.9, 0.5, 0, 1.35, 0));
  if (o.tie) body.add(part(o.tie, 0.12, 0.6, 0.06, 0, 1.4, 0.27));
  if (zombie) body.add(part(o.blood, 0.3, 0.25, 0.06, 0.2, 1.3, 0.27));
  // arms (pivot at shoulder)
  const armL = new THREE.Group(); armL.position.set(-0.52, 1.75, 0); armL.add(part(o.shirt, 0.22, 0.5, 0.26, 0, -0.25, 0)); armL.add(part(o.skin, 0.2, 0.32, 0.24, 0, -0.65, 0));
  const armR = armL.clone(); armR.position.x = 0.52;
  body.add(armL, armR);
  // head
  const head = new THREE.Group(); head.position.y = 1.85; body.add(head);
  head.add(part(o.skin, 0.62, 0.62, 0.62, 0, 0.31, 0));
  if (o.hair) head.add(part(o.hair, 0.68, 0.22, 0.68, 0, 0.58, -0.03));
  if (o.cap) head.add(part(o.cap, 0.7, 0.2, 0.7, 0, 0.6, 0), part(o.cap, 0.7, 0.06, 0.3, 0, 0.52, 0.45));
  // eyes
  if (zombie) { const em = new THREE.MeshBasicMaterial({ color: 0xb8ffff }); for (const ex of [-0.14, 0.14]) { const e = new THREE.Mesh(box, em); e.scale.set(0.12, 0.12, 0.06); e.position.set(ex, 0.35, 0.31); head.add(e); } }
  else head.add(part(0x222222, 0.08, 0.1, 0.05, -0.14, 0.35, 0.31), part(0x222222, 0.08, 0.1, 0.05, 0.14, 0.35, 0.31));

  if (zombie) { armL.rotation.x = -1.3; armR.rotation.x = -1.3; body.rotation.x = 0.12; head.rotation.z = 0.15; }

  g.userData = { body, legL, legR, armL, armR, head, zombie, phase: Math.random() * 6 };
  return g;
}

// Animate walking: speed 0..1
export function animateWalk(g, dt, speed) {
  const u = g.userData;
  u.phase += dt * (u.zombie ? 6 : 11) * Math.max(speed, 0.001);
  const s = Math.sin(u.phase) * 0.7 * speed;
  u.legL.rotation.x = s; u.legR.rotation.x = -s;
  if (u.zombie) { u.armL.rotation.x = -1.3 + s * 0.2; u.armR.rotation.x = -1.3 - s * 0.2; u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.05 * speed; }
  else { u.armL.rotation.x = -s; u.armR.rotation.x = s; u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.08 * speed; }
}
