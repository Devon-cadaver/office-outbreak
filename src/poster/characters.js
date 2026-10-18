// Rounded, flat-shaded characters in the poster's style: round heads, capsule bodies and limbs,
// big glowing eyes on zombies. Same animation hooks as the blocky characters.
import * as THREE from 'three';

export const OUTFITS = {
  worker:  { skin: 0xf0c9a6, hair: 0x4a2f1c, shirt: 0x4f8fd6, pants: 0x3b3f55, tie: 0x2a3d7a },
  vest:    { skin: 0xf0c9a6, hair: 0x1f2740, shirt: 0xff8a2a, pants: 0x2c3148 },
  suit:    { skin: 0xf3d2b3, hair: null,     shirt: 0x3a3d4a, pants: 0x30333f, tie: 0xc62828 },
  hoodie:  { skin: 0xf0c9a6, hair: 0x7a3fa8, shirt: 0x2a2730, pants: 0x3a5fa8 },
  hivis:   { skin: 0xf0c9a6, hair: 0x1f2740, shirt: 0xd8f03a, pants: 0x2c3148 },
  punk:    { skin: 0xf0c9a6, hair: 0x3fbf4a, shirt: 0x1e1b22, pants: 0x3a4a6a },
  pink:    { skin: 0xf0c9a6, hair: 0xe85aa0, shirt: 0xc23b6b, pants: 0x2f4f6a },
  plaid:   { skin: 0xe9c39e, hair: 0x2a1a10, shirt: 0x9a3a4a, pants: 0x2b3a2b },
};
const matCache = new Map();
const mat = (c) => { if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(c); };
const sphere = new THREE.SphereGeometry(0.5, 14, 10);
const capsule = new THREE.CapsuleGeometry(0.5, 1, 4, 10);
const box = new THREE.BoxGeometry(1, 1, 1);
// zombie eye beams: a short narrow cone from each eye, widening forward
const beamGeo = new THREE.ConeGeometry(0.07, 0.55, 8, 1, true); beamGeo.translate(0, -0.275, 0); beamGeo.rotateX(-Math.PI / 2);
const beamMat = new THREE.MeshBasicMaterial({ color: 0x8aff4a, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const part = (geo, c, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(geo, mat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; };

function zombify(o) {
  const dark = (c, f) => { const col = new THREE.Color(c); col.multiplyScalar(f); return col.getHex(); };
  return { ...o, skin: 0x7fd3b0, shirt: dark(o.shirt, 0.6), pants: dark(o.pants, 0.6), hair: o.hair == null ? null : dark(o.hair, 0.55) };
}

// clown zombies from the poster's fairground: pale yellow head, blue hair puffs, red nose, loud outfit, a hammer or balloons
const CLOWNS = [
  { skin: 0xe8e86a, hair: 0x3a5fd6, shirt: 0x2ad6e0, pants: 0x3a2fd0 },
  { skin: 0xd6e86a, hair: 0xe03a3a, shirt: 0xe84aa0, pants: 0xd6d6e0 },
];
export function makeCharacter(outfitName, { zombie = false, clown = null, skin = null } = {}) {
  let o = OUTFITS[outfitName] || OUTFITS.worker; if (skin && !zombie) o = { ...o, ...skin.outfit }; if (zombie) o = zombify(o);
  if (clown) o = { ...CLOWNS[clown === 'hammer' ? 0 : 1], skin: CLOWNS[clown === 'hammer' ? 0 : 1].skin };
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  // legs: capsules hanging from the hip
  const legL = new THREE.Group(); legL.position.set(-0.16, 0.95, 0); legL.add(part(capsule, o.pants, 0.26, 0.42, 0.26, 0, -0.42, 0)); legL.add(part(sphere, 0x1a1a1a, 0.3, 0.2, 0.4, 0, -0.85, 0.06));
  const legR = legL.clone(); legR.position.x = 0.16; body.add(legL, legR);
  // torso: a chubby capsule
  body.add(part(capsule, o.shirt, 0.78, 0.46, 0.6, 0, 1.3, 0));
  if (o.tie) body.add(part(capsule, o.tie, 0.1, 0.25, 0.08, 0, 1.3, 0.32));
  // arms
  const armL = new THREE.Group(); armL.position.set(-0.46, 1.68, 0); armL.add(part(capsule, o.shirt, 0.2, 0.3, 0.2, 0, -0.3, 0)); armL.add(part(sphere, o.skin, 0.2, 0.2, 0.2, 0, -0.66, 0));
  const armR = armL.clone(); armR.position.x = 0.46; body.add(armL, armR);
  // head: big round head with a hair cap
  const head = new THREE.Group(); head.position.y = 1.78; body.add(head);
  head.add(part(sphere, o.skin, 0.66, 0.66, 0.66, 0, 0.33, 0));
  if (clown) { for (const sx of [-1, 1]) head.add(part(sphere, o.hair, 0.36, 0.36, 0.36, sx * 0.36, 0.32, -0.05)); head.add(part(sphere, 0xff2a2a, 0.17, 0.17, 0.17, 0, 0.2, 0.36)); }
  else if (o.hair) { const cap = part(sphere, o.hair, 0.7, 0.5, 0.7, 0, 0.42, -0.04); head.add(cap); }
  const eyeC = zombie ? 0x6cff2a : 0x1a1a1a; const eyeMat = zombie ? new THREE.MeshBasicMaterial({ color: eyeC }) : mat(eyeC);
  for (const ex of [-0.13, 0.13]) { const e = new THREE.Mesh(sphere, eyeMat); e.scale.setScalar(zombie ? 0.14 : 0.08); e.position.set(ex, 0.34, 0.3); head.add(e);
    if (zombie) { e.scale.setScalar(0.1); const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.set(ex, 0.34, 0.33); beam.rotation.x = 0.12; head.add(beam); } }
  // face and clothing detail
  const dark = (cc, f) => new THREE.Color(cc).multiplyScalar(f).getHex();
  head.add(part(sphere, dark(o.skin, 0.88), 0.11, 0.1, 0.12, 0, 0.27, 0.33));
  head.add(part(box, zombie ? 0x3a0a0a : 0x5a2a2a, zombie ? 0.18 : 0.12, zombie ? 0.07 : 0.025, 0.04, 0, 0.17, 0.3));
  if (!zombie) for (const ex of [-0.13, 0.13]) head.add(part(box, o.hair || 0x3a2a1a, 0.12, 0.025, 0.04, ex, 0.43, 0.3));
  body.add(part(sphere, dark(o.pants, 0.7), 0.8, 0.09, 0.62, 0, 1.07, 0));
  if (zombie) { const wound = mat(0x5a0f14); for (let i = 0; i < 2; i++) { const w = new THREE.Mesh(sphere, wound); w.scale.set(0.16, 0.12, 0.06); w.position.set((Math.random() - 0.5) * 0.5, 1.15 + Math.random() * 0.35, 0.29); body.add(w); }
    const rag = part(box, o.shirt, 0.14, 0.22, 0.04, (Math.random() - 0.5) * 0.4, 0.98, 0.28); rag.rotation.z = (Math.random() - 0.5) * 0.6; body.add(rag); }
  if (zombie) { armL.rotation.x = -1.3; armR.rotation.x = -1.3; body.rotation.x = 0.12; head.rotation.z = 0.15; }
  if (clown === 'hammer') {
    const hammer = new THREE.Group(); hammer.position.set(0, -0.7, 0.1); armR.add(hammer);
    hammer.add(part(box, 0x8a5a3a, 0.08, 0.9, 0.08, 0, 0.3, 0)); hammer.add(part(box, 0xd6d6e0, 0.32, 0.24, 0.24, 0, 0.8, 0)); hammer.add(part(box, 0xe03a3a, 0.34, 0.06, 0.26, 0, 0.8, 0));
    hammer.rotation.x = 1.2;
  } else if (clown === 'balloons') {
    const bal = new THREE.Group(); bal.position.set(0, -0.66, 0); armL.add(bal);
    const cols = [0x3fdf4a, 0xffd24a, 0x2ad6e0]; cols.forEach((c, i) => { bal.add(part(box, 0x333333, 0.015, 1.2 + i * 0.15, 0.015, 0, 0.6 + i * 0.08, 0)); bal.add(part(sphere, c, 0.34, 0.42, 0.34, (i - 1) * 0.28, 1.3 + i * 0.18, (i % 2) * 0.2 - 0.1)); });
    bal.userData.sway = true;
  }
  if (skin && !zombie && skin.dress) skin.dress({ g, body, head, armL, armR, legL, legR, part });
  g.userData = { body, legL, legR, armL, armR, head, zombie, clown, phase: Math.random() * 6, idle: Math.random() * 6, lean: zombie ? 0.12 : 0, limp: 0.5 + Math.random() * 0.5 };
  return g;
}

export function animateWalk(g, dt, speed) {
  const u = g.userData; u.idle = (u.idle || 0) + dt; const sp = Math.max(speed, 0);
  if (u.zombie) {
    const runner = (u.lean || 0) > 0.3; u.phase += dt * (runner ? 9 : 5.5) * Math.max(sp, 0.001); const ph = u.phase, s = Math.sin(ph), lim = u.limp || 0.7;
    // shamble: one leg strides, the other drags; the body rolls side to side and the head lolls
    u.legL.rotation.x = s * (runner ? 0.85 : 0.6) * sp; u.legR.rotation.x = -Math.sin(ph + 0.7) * (runner ? 0.85 : 0.6 * lim) * sp;
    u.body.position.y = Math.abs(Math.sin(ph)) * (runner ? 0.09 : 0.05) * sp;
    u.body.rotation.z = Math.sin(ph) * (runner ? 0.06 : 0.13) * Math.max(sp, 0.3) + Math.sin(u.idle * 0.7) * 0.03;
    u.body.rotation.x = (u.lean || 0.12) + Math.abs(Math.sin(ph)) * 0.06 * sp;
    u.head.rotation.z = 0.15 + Math.sin(ph * 0.5 + u.idle * 0.3) * 0.18; u.head.rotation.x = Math.sin(ph * 0.7) * 0.14 + 0.08;
    const reach = runner ? -1.55 : -1.3; u.armL.rotation.x = reach + Math.sin(ph + 1.2) * (runner ? 0.45 : 0.22); u.armR.rotation.x = reach - Math.sin(ph) * (runner ? 0.45 : 0.22);
    u.armL.rotation.z = 0.12 + Math.sin(u.idle * 1.3) * 0.08; u.armR.rotation.z = -0.12 - Math.sin(u.idle * 1.1) * 0.08;
    if (u.clown === 'hammer') u.armR.rotation.x = -2.6 + Math.sin(u.phase * 0.5) * 0.5; if (u.clown === 'balloons') u.armL.rotation.x = -2.9;
    return; }
  if (sp < 0.05) { // idle: breathe, shift weight, glance around
    u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8; u.body.position.y = Math.sin(u.idle * 2.2) * 0.012; u.body.rotation.x *= 0.85; u.body.rotation.y = Math.sin(u.idle * 0.5) * 0.05;
    u.armL.rotation.x = Math.sin(u.idle * 2.2) * 0.04; u.armR.rotation.x = -Math.sin(u.idle * 2.2) * 0.04; u.armL.rotation.z = 0.06; u.armR.rotation.z = -0.06;
    u.head.rotation.y = Math.sin(u.idle * 0.6) * 0.35 * (Math.sin(u.idle * 0.17) > 0 ? 1 : 0.2); u.head.rotation.x = Math.sin(u.idle * 1.1) * 0.03; return; }
  const run = sp > 1.05; u.phase += dt * (run ? 13 : 10) * Math.min(sp, 1.5); const s = Math.sin(u.phase);
  const stride = (run ? 0.95 : 0.7) * Math.min(sp, 1.2);
  u.legL.rotation.x = s * stride; u.legR.rotation.x = -s * stride;
  u.armL.rotation.x = -s * stride * (run ? 1.1 : 0.8); u.armR.rotation.x = s * stride * (run ? 1.1 : 0.8); u.armL.rotation.z = run ? 0.15 : 0.05; u.armR.rotation.z = run ? -0.15 : -0.05;
  u.body.position.y = Math.abs(s) * (run ? 0.13 : 0.07) * Math.min(sp, 1.2);
  u.body.rotation.x = (run ? 0.22 : 0.06) * Math.min(sp, 1.2); u.body.rotation.y = s * (run ? 0.12 : 0.07); u.body.rotation.z = 0;
  u.head.rotation.y = -s * 0.06; u.head.rotation.x = -u.body.rotation.x * 0.6 + Math.abs(s) * 0.03;
}
