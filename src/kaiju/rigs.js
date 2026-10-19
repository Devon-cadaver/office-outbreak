// Kaiju Madness: the monsters. Each one is a low-poly rig about 2 units tall at scale 1, facing +z, built from simple
// parts and animated by hand: walkers stomp with swinging legs and tails, the ape knuckle-walks, flyers hover with
// flapping wings. rig.anim(dt, move) runs the idle/walk/fly cycle (move 0..1), rig.act('hit' | 'cast' | 'ko') plays a
// one-shot over the top. rig.mouth / rig.hand / rig.chest are anchors for spells and throws.
import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1), cone = new THREE.ConeGeometry(0.5, 1, 4), ball = new THREE.IcosahedronGeometry(0.5, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const mats = new Map();
const mat = (c, basic = false) => { const k = c + (basic ? 'b' : ''); if (!mats.has(k)) mats.set(k, basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c, flatShading: true })); return mats.get(k); };
function part(parent, geo, c, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0, basic = false) { const m = new THREE.Mesh(geo, mat(c, basic)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; }
const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// the roster for phase 1 (the rest of the 20 come later); spells are [hatchling, titan, colossus]
export const KAIJU = {
  godzilly: { name: 'GODZILLY', kind: 'biped', blurb: 'Atomic lizard. Big, tough, glows blue when angry.', spells: ['Atomic Hiccup', 'Atomic Breath', 'Spine Nova'], speed: 1, glow: 0x4ab8ff },
  konk: { name: 'KING KONK', kind: 'ape', blurb: 'Giant ape. Throws cars, drums his chest, hurls whole towers.', spells: ['Car Toss', 'Chest Drum', 'Tower Toss'], speed: 1.12, glow: 0xff8a3a },
  mofra: { name: 'MOFRA', kind: 'moth', blurb: 'Giant moth. Flies over everything; gusts, glitter storms and rainbow beams.', spells: ['Wing Gust', 'Glitter Storm', 'Rainbow Beam'], speed: 1.2, fly: true, glow: 0xffd24a },
  mecha: { name: 'MECHA-GODZILLY', kind: 'biped', mech: true, blurb: 'Robot lizard. Rocket fists, missile parties and a freeze cannon.', spells: ['Rocket Fists', 'Missile Party', 'Freeze Cannon'], speed: 0.92, glow: 0x7af0ff },
};
export const KAIJU_IDS = Object.keys(KAIJU);

export function buildKaiju(id) {
  const K = KAIJU[id]; const g = new THREE.Group(); const body = grp(g, 0, 0, 0); let rig;
  if (K.kind === 'biped') rig = biped(body, K, id === 'mecha');
  else if (K.kind === 'ape') rig = ape(body);
  else rig = moth(body);
  // a soft shadow on the ground (stays on the ground even when a flyer is up high)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; g.add(shadow);
  let t = Math.random() * 10, actK = null, actT = 0;
  const api = { id, def: K, g, body, shadow, fly: !!K.fly, mouth: rig.mouth, hand: rig.hand, chest: rig.chest, glowMats: rig.glow || [],
    act(k) { actK = k; actT = 0; },
    anim(dt, move) { t += dt; if (actK) { actT += dt * (actK === 'ko' ? 0.8 : 2.4); if (actT >= 1 && actK !== 'ko') actK = null; } rig.anim(t, dt, move, actK, Math.min(1, actT)); shadow.scale.setScalar(rig.shadowK ? rig.shadowK() : 1); },
  };
  return api;
}

// ---------- two-legged lizards: Godzilly, and his metal double ----------
function biped(body, K, mech) {
  const skin = mech ? 0x9aa2ac : 0x45505e, dark = mech ? 0x4e545c : 0x2c3440, belly = mech ? 0xc8cdd2 : 0x66707e, spineC = mech ? 0x8aa0c8 : 0x4ab8ff, eyeC = mech ? 0xff2a2a : 0xffd24a;
  const hip = grp(body, 0, 0.9, 0);
  const torso = grp(hip, 0, 0.05, 0); torso.rotation.x = 0.28;
  part(torso, box, skin, 0.82, 1.0, 0.72, 0, 0.45, 0); part(torso, box, belly, 0.56, 0.78, 0.1, 0, 0.42, 0.36);
  if (mech) { part(torso, box, dark, 0.86, 0.12, 0.76, 0, 0.2, 0); part(torso, box, dark, 0.86, 0.12, 0.76, 0, 0.62, 0); }
  const chest = grp(torso, 0, 0.5, 0.42); if (mech) part(chest, cyl, 0xffd24a, 0.26, 0.06, 0.26, 0, 0, 0, Math.PI / 2, 0, 0, true);
  const neck = grp(torso, 0, 0.92, 0.18); const head = grp(neck, 0, 0.12, 0.12);
  part(head, box, skin, 0.42, 0.34, 0.5, 0, 0.06, 0.12); part(head, box, skin, 0.34, 0.2, 0.3, 0, 0, 0.48);
  const jaw = grp(head, 0, -0.1, 0.05); part(jaw, box, dark, 0.32, 0.1, 0.62, 0, -0.03, 0.28);
  for (const x of [-0.13, 0.13]) part(head, box, eyeC, 0.07, 0.05, 0.04, x, 0.13, 0.36, 0, 0, 0, true);
  const mouth = grp(head, 0, -0.04, 0.68);
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.45, 0.72, 0.22); part(a, box, skin, 0.16, 0.42, 0.16, 0, -0.18, 0.06, -0.5); part(a, cone, belly, 0.06, 0.12, 0.06, 0, -0.4, 0.22, 2.6); return a; });
  const hand = grp(arms[1], 0, -0.38, 0.2);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.3, 0, 0); part(l, box, skin, 0.34, 0.52, 0.42, 0, -0.2, 0); const k = grp(l, 0, -0.45, 0.02); part(k, box, skin, 0.25, 0.42, 0.3, 0, -0.18, -0.02); part(k, box, dark, 0.34, 0.1, 0.5, 0, -0.42, 0.08); return { l, k }; });
  const tail = []; let prev = grp(hip, 0, 0.05, -0.32); for (let i = 0; i < 5; i++) { const s = 1 - i * 0.16; part(prev, box, skin, 0.42 * s, 0.38 * s, 0.46, 0, 0, -0.2, -0.1); tail.push(prev); prev = grp(prev, 0, -0.02, -0.4); }
  // the back plates: they glow when he's about to cast
  const glowMat = mech ? mat(spineC) : new THREE.MeshBasicMaterial({ color: spineC }); const glow = [glowMat];
  for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(cone, glowMat); sp.scale.set(0.22, 0.42 - i * 0.03, 0.32); sp.position.set(0, 0.95 - i * 0.18, -0.36 + i * 0.02); sp.rotation.x = -0.6; torso.add(sp); }
  for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(cone, glowMat); sp.scale.set(0.16, 0.3 - i * 0.05, 0.22); sp.position.set(0, 0.2 * (1 - i * 0.16), -0.2); sp.rotation.x = -0.9; tail[i].add(sp); }
  if (mech) for (const s of [-1, 1]) part(legs[s < 0 ? 0 : 1].k, cyl, 0x7af0ff, 0.12, 0.05, 0.12, 0, -0.48, -0.1, 0, 0, 0, true);
  const glow0 = new THREE.Color(spineC);
  return { mouth, hand, chest, glow,
    anim(t, dt, move, act, k) {
      const w = t * (5.5 + move * 2), sw = Math.sin(w) * 0.55 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; legs[0].k.rotation.x = Math.max(0, -Math.sin(w)) * 0.6 * move; legs[1].k.rotation.x = Math.max(0, Math.sin(w)) * 0.6 * move;
      hip.position.y = 0.9 + Math.abs(Math.sin(w)) * 0.05 * move; hip.rotation.z = Math.sin(w) * 0.05 * move;
      arms[0].rotation.x = -sw * 0.4; arms[1].rotation.x = sw * 0.4; tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 2.2 - i * 0.7) * (0.12 + move * 0.08); });
      torso.rotation.x = 0.28; neck.rotation.x = 0; jaw.rotation.x = 0.05 + Math.sin(t * 1.3) * 0.03;
      let glowK = 0;
      if (act === 'hit') { const s = Math.sin(k * Math.PI); neck.rotation.x = 0.5 * s; torso.rotation.x = 0.28 + 0.2 * s; jaw.rotation.x = 0.5 * s; arms[1].rotation.x = -1.6 * s; }
      else if (act === 'cast') { const s = Math.sin(k * Math.PI); neck.rotation.x = -0.4 * s + 0.3 * Math.max(0, k - 0.5); jaw.rotation.x = 0.7 * s; glowK = s; }
      else if (act === 'ko') { body.rotation.z = Math.min(1.5, k * 2); body.position.y = -k * 0.2; }
      if (!mech) glowMat.color.copy(glow0).multiplyScalar(1 + glowK * 1.4);
    } };
}

// ---------- the ape: knuckle-walks on long arms ----------
function ape(body) {
  const fur = 0x3b2c24, face = 0x6a5040, dark = 0x241a14;
  const hip = grp(body, 0, 0.72, 0); const torso = grp(hip, 0, 0.05, 0); torso.rotation.x = 0.45;
  part(torso, box, fur, 1.1, 1.0, 0.78, 0, 0.48, 0); part(torso, box, face, 0.72, 0.6, 0.1, 0, 0.55, 0.4);
  const chest = grp(torso, 0, 0.55, 0.45);
  const neck = grp(torso, 0, 1.0, 0.18); const head = grp(neck, 0, 0.1, 0.1);
  part(head, box, fur, 0.5, 0.46, 0.46, 0, 0.1, 0); part(head, box, dark, 0.52, 0.1, 0.14, 0, 0.26, 0.2); part(head, box, face, 0.36, 0.26, 0.22, 0, 0, 0.24);
  for (const x of [-0.11, 0.11]) part(head, box, 0xffb02a, 0.07, 0.05, 0.04, x, 0.16, 0.25, 0, 0, 0, true);
  const jaw = grp(head, 0, -0.12, 0.18); part(jaw, box, face, 0.3, 0.1, 0.2, 0, -0.03, 0.04);
  const mouth = grp(head, 0, -0.05, 0.4);
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.66, 0.85, 0.15); part(a, box, fur, 0.28, 0.6, 0.3, 0, -0.26, 0); const el = grp(a, 0, -0.55, 0); part(el, box, fur, 0.26, 0.6, 0.28, 0, -0.26, 0.04); part(el, box, dark, 0.32, 0.22, 0.36, 0, -0.6, 0.06); return { a, el }; });
  const hand = grp(arms[1].el, 0, -0.62, 0.15);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.32, 0, -0.05); part(l, box, fur, 0.34, 0.4, 0.38, 0, -0.16, 0); const k = grp(l, 0, -0.36, 0); part(k, box, fur, 0.3, 0.32, 0.32, 0, -0.14, 0); part(k, box, dark, 0.34, 0.1, 0.46, 0, -0.33, 0.08); return { l, k }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (4.6 + move * 2), sw = Math.sin(w) * 0.5 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; arms[0].a.rotation.x = -0.35 - sw * 0.9; arms[1].a.rotation.x = -0.35 + sw * 0.9; arms[0].el.rotation.x = 0.25; arms[1].el.rotation.x = 0.25;
      hip.position.y = 0.72 + Math.abs(Math.sin(w)) * 0.07 * move; torso.rotation.z = Math.sin(w) * 0.06 * move; neck.rotation.x = 0; jaw.rotation.x = 0;
      if (act === 'hit') { const s = Math.sin(k * Math.PI); arms[1].a.rotation.x = -0.35 - 2.2 * s; arms[1].el.rotation.x = 0.25 - 0.4 * s; torso.rotation.x = 0.45 + 0.25 * s; }
      else if (act === 'cast') { const s = Math.sin(k * Math.PI); const beat = Math.sin(k * Math.PI * 8) * 0.4 * s; torso.rotation.x = 0.45 - 0.4 * s; arms[0].a.rotation.x = -1.6 * s + beat; arms[1].a.rotation.x = -1.6 * s - beat; arms[0].el.rotation.x = arms[1].el.rotation.x = -1.2 * s; jaw.rotation.x = 0.5 * s; neck.rotation.x = -0.4 * s; }
      else if (act === 'ko') { body.rotation.x = -Math.min(1.5, k * 2); body.position.y = -k * 0.15; }
    } };
}

// ---------- the moth: hovers with two pairs of flapping wings ----------
function wingGeo(front, m) { const s = new THREE.Shape(); if (front) { s.moveTo(0, 0); s.bezierCurveTo(0.4 * m, 0.5, 1.4 * m, 0.9, 1.9 * m, 0.45); s.bezierCurveTo(1.7 * m, -0.05, 1.0 * m, -0.3, 0, -0.12); } else { s.moveTo(0, -0.05); s.bezierCurveTo(0.5 * m, -0.1, 1.2 * m, -0.2, 1.3 * m, -0.65); s.bezierCurveTo(0.9 * m, -1.0, 0.3 * m, -0.6, 0, -0.25); } s.closePath(); return new THREE.ShapeGeometry(s, 12); }
function moth(body) {
  const fuzz = 0xe8d8b8, wingC = 0xf09a20, edge = 0x1a1410, red = 0xd8301a, yel = 0xffd24a;
  const hover = grp(body, 0, 1.6, 0);
  part(hover, ball, fuzz, 0.62, 0.55, 0.7, 0, 0, 0.1);
  const abd = grp(hover, 0, -0.05, -0.25); for (let i = 0; i < 4; i++) part(abd, ball, i % 2 ? 0xd8c090 : fuzz, 0.46 - i * 0.07, 0.42 - i * 0.06, 0.4, 0, -0.04 * i, -0.28 * i);
  const head = grp(hover, 0, 0.08, 0.48); part(head, ball, fuzz, 0.38, 0.34, 0.34, 0, 0, 0);
  for (const x of [-0.13, 0.13]) part(head, ball, 0x3aa8ff, 0.18, 0.18, 0.18, x, 0.04, 0.1, 0, 0, 0, true);
  const ant = [-1, 1].map((s) => { const a = grp(head, s * 0.08, 0.14, 0.05); part(a, box, 0x8a6a40, 0.03, 0.5, 0.03, 0, 0.24, 0.04, 0.3, 0, s * -0.35); return a; });
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) part(hover, box, 0x8a6a40, 0.04, 0.4, 0.04, s * 0.22, -0.3, 0.2 - i * 0.18, 0.2, 0, s * 0.5);
  const mouth = grp(head, 0, 0.3, 0.2), hand = grp(hover, 0, -0.35, 0.2), chest = grp(hover, 0, 0, 0.4);
  const mk = (geo, c, z) => { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = z; return m; };
  const wings = []; for (const front of [true, false]) for (const s of [-1, 1]) { const piv = grp(hover, s * 0.2, 0.05, front ? 0.12 : -0.08); const w = grp(piv, 0, 0, 0);
    const geo = wingGeo(front, s); /* mirrored for the left side (a negative scale would flip it out of sight) */ const base = mk(geo, wingC, 0); const rim = mk(geo, edge, -0.01); rim.scale.set(1.06, 1.08, 1); w.add(rim, base);
    for (const [cx, cz, r, c] of front ? [[1.35, -0.45, 0.22, edge], [1.35, -0.45, 0.13, red], [0.7, -0.25, 0.12, yel]] : [[0.75, 0.45, 0.16, red], [0.45, 0.25, 0.08, yel]]) { const d = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); d.rotation.x = -Math.PI / 2; d.position.set(cx * s, 0.012, cz); w.add(d); }
    wings.push({ piv, front, s }); }
  return { mouth, hand, chest, shadowK: () => 1.3,
    anim(t, dt, move, act, k) {
      const sp = 5 + move * 4, f = Math.sin(t * sp);
      for (const w of wings) { w.piv.rotation.z = w.s * (0.25 + f * (w.front ? 0.65 : 0.5)); w.piv.rotation.y = w.s * (w.front ? 0.1 : -0.15); }
      hover.position.y = 1.6 + Math.sin(t * sp) * 0.08 + Math.sin(t * 1.1) * 0.1; hover.rotation.x = 0.12 * move; abd.rotation.x = Math.sin(t * 1.7) * 0.08; ant.forEach((a, i) => { a.rotation.x = Math.sin(t * 3 + i) * 0.15; });
      if (act === 'hit') { const s = Math.sin(k * Math.PI); hover.rotation.x = 0.12 * move + 0.5 * s; hover.position.y -= 0.4 * s; }
      else if (act === 'cast') { const s = Math.sin(k * Math.PI); for (const w of wings) w.piv.rotation.z = w.s * (0.25 - 0.4 * s); hover.position.y += 0.3 * s; }
      else if (act === 'ko') { hover.position.y = Math.max(0.2, 1.6 - k * 1.6); hover.rotation.z = k * 1.2; }
    } };
}
