// Kaiju Madness: high-detail rigs (pilot). Same interface and proportions as the blocky rigs in rigs.js (about 2.2 units
// tall at scale 1, facing +z; returns { mouth, hand, chest, anim(t, dt, move, act, k) }), but built from smooth shapes:
// rounded and tapered bodies, teeth, claws, jagged glowing back plates, suckers, bevelled robot panels. Colours still
// come from K.pal, so skins work. Materials and geometries are shared and cached; each monster stays a few thousand
// triangles, which is small next to the city.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const mats = new Map();
// smooth-shaded matte (skin), shiny (metal) or glowing (eyes, plates)
const M = (c, kind = 'skin') => { const k = c + kind; if (!mats.has(k)) mats.set(k, kind === 'glow' ? new THREE.MeshBasicMaterial({ color: c }) : kind === 'metal' ? new THREE.MeshPhongMaterial({ color: c, shininess: 60, specular: 0x555555 }) : new THREE.MeshLambertMaterial({ color: c })); return mats.get(k); };
const geos = new Map(); const geo = (k, make) => { if (!geos.has(k)) geos.set(k, make()); return geos.get(k); };
const SPH = () => geo('sph', () => new THREE.SphereGeometry(0.5, 14, 9));
const CAP = () => geo('cap', () => new THREE.CapsuleGeometry(0.5, 1, 3, 10));
const CON = () => geo('con', () => new THREE.ConeGeometry(0.5, 1, 6));
const CYL = () => geo('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12));
const RBX = () => geo('rbx', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.12));
const TOR = () => geo('tor', () => new THREE.TorusGeometry(0.5, 0.12, 6, 16));
const PLATE = () => geo('plate', () => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(-0.32, 0.38); s.lineTo(-0.18, 0.3); s.lineTo(0, 1); s.lineTo(0.18, 0.3); s.lineTo(0.32, 0.38); s.lineTo(0.5, 0); s.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1 }); g.translate(0, 0, -0.06); return g; });
function part(parent, g, m, sx, sy, sz, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(g, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; }
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const S = (k, a) => Math.sin(k * Math.PI) * a;
const koTip = (body, k) => { body.rotation.z = Math.min(1.5, k * 2); body.position.y = -k * 0.2; };
const UP = new THREE.Vector3(0, 1, 0);
function rod(parent, m, a, b, r) { const d = new THREE.Vector3().subVectors(b, a), len = d.length(); const o = new THREE.Mesh(CAP(), m); o.scale.set(r, len, r); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(UP, d.normalize()); parent.add(o); return o; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

// ---------- the lizard: Godzilly ----------
function bipedHD(body, K) {
  const [skin, dark, belly, acc, eyeC] = K.pal, o = K.opt || {}; if (o.toad) return toadHD(body, K); if (o.tree) return treeHD(body, K);
  const mt = o.mech ? 'metal' : 'skin', sk = M(skin, mt), dk = M(dark, mt), bl = M(belly, mt), bone = M(0xe8e2d0), eye = M(eyeC, 'glow'), black = M(0x0a0a0e);
  const plateM = o.glow ? M(acc, 'glow') : M(acc, mt); const lift = o.hover ? 0.3 : 0;
  const hip = grp(body, 0, 0.95 + lift, 0); const torso = grp(hip, 0, 0.02, 0); torso.rotation.x = 0.28;
  part(hip, SPH(), sk, 0.78, 0.6, 0.66, 0, 0.02, -0.04);                       // pelvis
  part(torso, SPH(), sk, 0.74, 0.92, 0.62, 0, 0.46, 0);                       // gut
  part(torso, SPH(), sk, 0.8, 0.62, 0.62, 0, 0.82, 0.02);                     // chest
  part(torso, SPH(), bl, 0.54, 0.86, 0.36, 0, 0.5, 0.2);                      // belly
  for (let i = 0; i < 6; i++) part(torso, CAP(), dk, 0.035, 0.24 - Math.abs(i - 2.5) * 0.02, 0.035, 0, 0.18 + i * 0.13, 0.37 - Math.abs(i - 2.5) * 0.012, 0, 0, Math.PI / 2); // belly scales
  // neck and head: a heavy skull, brow ridges, a snout, glowing eyes and two rows of teeth
  const neck = grp(torso, 0, 1.0, 0.14); part(neck, CAP(), sk, 0.36, 0.22, 0.36, 0, 0.08, 0.02, 0.5);
  const head = grp(neck, 0, 0.2, 0.1);
  part(head, SPH(), sk, 0.44, 0.38, 0.5, 0, 0.06, 0.04); part(head, RBX(), sk, 0.32, 0.2, 0.36, 0, 0.02, 0.32); part(head, SPH(), sk, 0.3, 0.16, 0.2, 0, 0.0, 0.48);
  for (const s of [-1, 1]) { part(head, CAP(), dk, 0.09, 0.14, 0.09, s * 0.13, 0.17, 0.3, 0.2, 0, Math.PI / 2 + s * 0.35); part(head, SPH(), eye, 0.08, 0.06, 0.06, s * 0.14, 0.11, 0.33); part(head, SPH(), black, 0.035, 0.05, 0.03, s * 0.145, 0.11, 0.36); part(head, SPH(), dk, 0.04, 0.03, 0.03, s * 0.06, 0.06, 0.58); }
  for (let i = 0; i < 7; i++) { const z = 0.18 + i * 0.06, x = 0.13 - i * 0.004; for (const s of [-1, 1]) part(head, CON(), bone, 0.03, 0.06, 0.03, s * x, -0.07, z, Math.PI); }
  const jaw = grp(head, 0, -0.08, 0.06); part(jaw, RBX(), dk, 0.3, 0.09, 0.44, 0, -0.03, 0.24); part(jaw, SPH(), M(0x6a1a20), 0.22, 0.04, 0.34, 0, 0.02, 0.24);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) part(jaw, CON(), bone, 0.025, 0.05, 0.025, s * (0.11 - i * 0.005), 0.03, 0.12 + i * 0.06);
  const mouth = grp(head, 0, -0.04, 0.6);
  if (o.mech) { for (const y of [0.22, 0.62]) part(torso, TOR(), M(dark, 'metal'), 0.86, 0.86, 1.2, 0, y, 0, Math.PI / 2); part(torso, CYL(), M(0xffd24a, 'glow'), 0.26, 0.05, 0.26, 0, 0.62, 0.33, Math.PI / 2); for (const s of [-1, 1]) part(head, RBX(), M(dark, 'metal'), 0.06, 0.06, 0.3, s * 0.2, 0.14, 0.1); }
  if (o.horn) part(head, CON(), M(o.horn === true ? acc : o.horn), 0.1, 0.42, 0.1, 0, 0.22, 0.42, -0.7);
  if (o.frill) { const fr = grp(head, 0, 0.12, -0.12); fr.rotation.x = -0.35; part(fr, geo('frill', () => new THREE.CircleGeometry(0.55, 20, 0, Math.PI)), M(acc), 1, 1, 1); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI; part(fr, CON(), M(o.horn || 0xe8e0c8), 0.07, 0.24, 0.07, Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.01, 0, 0, a - Math.PI / 2); } }
  // arms with three hooked claws
  const drills = [];
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.42, 0.74, 0.18); part(a, SPH(), sk, 0.26, 0.26, 0.26, 0, 0, 0); part(a, CAP(), sk, 0.15, 0.22, 0.15, 0, -0.15, 0.05, -0.4);
    const fa = grp(a, 0, -0.3, 0.12); part(fa, CAP(), sk, 0.13, 0.2, 0.13, 0, -0.08, 0.06, -0.9); const h = grp(fa, 0, -0.14, 0.2); part(h, SPH(), sk, 0.15, 0.12, 0.15);
    if (o.drills) { const d = grp(fa, 0, -0.28, 0.32); d.rotation.x = -0.9; part(d, CON(), M(0xb8c0c8, 'metal'), 0.24, 0.62, 0.24, 0, -0.3, 0, Math.PI); for (let i = 0; i < 3; i++) part(d, TOR(), M(0x6a727c, 'metal'), 0.2 - i * 0.05, 0.2 - i * 0.05, 0.4, 0, -0.12 - i * 0.14, 0, Math.PI / 2); drills.push(d); }
    else for (const c of [-1, 0, 1]) part(h, CON(), bone, 0.035, 0.12, 0.035, c * 0.05, -0.06, 0.06, 2.2); return { a, fa }; });
  const hand = grp(arms[1].fa, 0, -0.2, 0.25);
  // legs: big thighs, shins and clawed feet
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.33, 0, 0); part(l, SPH(), sk, 0.42, 0.62, 0.48, 0, -0.18, 0.02); const k = grp(l, 0, -0.44, 0.04);
    part(k, CAP(), sk, 0.27, 0.26, 0.27, 0, -0.16, -0.03); const f = grp(k, 0, -0.42, 0.06); part(f, SPH(), dk, 0.36, 0.14, 0.5, 0, 0, 0.06);
    for (const c of [-1, 0, 1]) part(f, CON(), bone, 0.05, 0.14, 0.05, c * 0.11, -0.02, 0.32, Math.PI / 2); return { l, k }; });
  // tail: tapering segments, plates down the first ones
  const tail = []; if (!o.noTail) { let prev = grp(hip, 0, 0.0, -0.36); for (let i = 0; i < 9; i++) { const s = 1 - i * 0.095; part(prev, SPH(), i % 2 ? sk : lerpC(skin, dark, 0.25) === skin ? sk : M(lerpC(skin, dark, 0.2)), 0.44 * s, 0.4 * s, 0.4, 0, 0, -0.16); tail.push(prev); prev = grp(prev, 0, -0.012, -0.3); } }
  // the jagged back plates: three rows down the spine and along the tail, glowing if the kaiju glows
  const glowMat = plateM, glow0 = plateM.color.clone();
  if (o.plates !== false) {
    for (let i = 0; i < 6; i++) { const y = 1.05 - i * 0.17, z = -0.3 + i * 0.012, sc = 0.38 - Math.abs(i - 1.5) * 0.05; part(torso, PLATE(), glowMat, sc, sc * 1.2, 1, 0, y, z, -0.55, Math.PI / 2, 0);
      for (const s of [-1, 1]) part(torso, PLATE(), glowMat, sc * 0.6, sc * 0.75, 1, s * 0.14, y - 0.06, z + 0.02, -0.55, Math.PI / 2 + s * 0.25, 0); }
    tail.slice(0, 7).forEach((seg, i) => part(seg, PLATE(), glowMat, 0.26 - i * 0.03, 0.3 - i * 0.035, 1, 0, 0.12 - i * 0.01, -0.16, 0, Math.PI / 2, 0)); }
  if (o.crystals) { const cm = o.glow ? M(acc, 'glow') : M(acc, 'metal'); for (const [x, y, z, s, r] of [[-0.42, 1.0, -0.12, 0.9, -0.4], [0.42, 1.0, -0.12, 0.9, 0.4], [-0.2, 1.08, -0.32, 0.65, -0.2], [0.2, 1.08, -0.32, 0.65, 0.2], [0, 0.92, -0.4, 0.55, 0], [-0.5, 0.75, 0, 0.5, -0.8], [0.5, 0.75, 0, 0.5, 0.8]]) part(torso, geo('oct', () => new THREE.OctahedronGeometry(0.5, 0)), cm, 0.28 * s, 0.95 * s, 0.28 * s, x, y, z, 0, 0, r); }
  if (o.beetle) { part(torso, geo('dome', () => new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), M(dark, 'metal'), 0.95, 0.9, 0.5, 0, 0.55, -0.24, -Math.PI / 2); part(torso, CAP(), M(acc, 'metal'), 0.04, 0.82, 0.04, 0, 0.55, -0.5); }
  const wings = []; if (o.wings) for (const s of [-1, 1]) { const pv = grp(torso, s * 0.3, 0.9, -0.28); const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.7 * s, 0.9, 1.6 * s, 0.75); sh.quadraticCurveTo(1.4 * s, 0.3, 1.75 * s, 0.05); sh.quadraticCurveTo(1.3 * s, 0.05, 1.15 * s, -0.3); sh.quadraticCurveTo(0.8 * s, -0.1, 0.55 * s, -0.4); sh.quadraticCurveTo(0.35 * s, -0.15, 0, -0.3); sh.lineTo(0, 0);
    const wm = new THREE.Mesh(new THREE.ShapeGeometry(sh, 10), new THREE.MeshLambertMaterial({ color: o.wings === true ? acc : o.wings, side: THREE.DoubleSide })); pv.add(wm); for (const [x, y] of [[1.6, 0.75], [1.75, 0.05], [1.15, -0.3], [0.55, -0.4]]) { const len = Math.hypot(x, y); const b = part(pv, CAP(), dk, 0.035, len, 0.035, s * x / 2, y / 2, 0.01); b.rotation.z = Math.atan2(-s * x, y); } pv.rotation.y = s * 0.5; wings.push({ pv, s }); }
  const chest = grp(torso, 0, 0.8, 0.3);
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (5.5 + move * 2), sw = Math.sin(w) * 0.55 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; legs[0].k.rotation.x = Math.max(0, -Math.sin(w)) * 0.6 * move; legs[1].k.rotation.x = Math.max(0, Math.sin(w)) * 0.6 * move;
      hip.position.y = 0.95 + lift + Math.abs(Math.sin(w)) * 0.05 * move + (o.hover ? Math.sin(t * 2) * 0.08 : 0); for (const d of drills) d.rotation.y += dt * 18; for (const wg of wings) wg.pv.rotation.y = wg.s * (0.35 + Math.sin(t * 2.6) * 0.3); hip.rotation.z = Math.sin(w) * 0.05 * move; torso.rotation.x = 0.28 + Math.sin(t * 1.6) * 0.02;
      arms[0].a.rotation.x = -sw * 0.4; arms[1].a.rotation.x = sw * 0.4; tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 2.2 - i * 0.6) * (0.1 + move * 0.07); s.rotation.x = 0.04; });
      neck.rotation.x = 0; head.rotation.y = Math.sin(t * 0.7) * 0.12; jaw.rotation.x = 0.06 + Math.sin(t * 1.3) * 0.04; let glowK = 0;
      if (act === 'hit') { const s = S(k, 1); neck.rotation.x = 0.45 * s; torso.rotation.x += 0.2 * s; jaw.rotation.x = 0.5 * s; arms[1].a.rotation.x = -1.6 * s; }
      else if (act === 'cast') { const s = S(k, 1); neck.rotation.x = -0.45 * s; jaw.rotation.x = 0.8 * s; glowK = s; arms[0].a.rotation.z = -0.4 * s; arms[1].a.rotation.z = 0.4 * s; }
      else { arms[0].a.rotation.z = arms[1].a.rotation.z = 0; if (act === 'ko') koTip(body, k); }
      if (o.glow) glowMat.color.copy(glow0).multiplyScalar(1 + glowK * 1.2 + Math.sin(t * 3) * 0.08);
    } };
}

// ---------- the walking tree (I Am Groove): a bark trunk with a carved face, a big leafy crown, branch arms with twig
// fingers, root feet ----------
function treeHD(body, K) {
  const [bark, dark, light, leafC, eyeC] = K.pal; const bk = M(bark), dk = M(dark), lt = M(light), eye = M(eyeC, 'glow'), black = M(0x120a06);
  const leaves = [M(leafC), M(lerpC(leafC, 0x1a3a10, 0.35)), M(lerpC(leafC, 0xd8ff8a, 0.25))];
  const trunkG = geo('trunk', () => new THREE.CylinderGeometry(0.36, 0.48, 1, 14));
  const hip = grp(body, 0, 0.9, 0); const torso = grp(hip, 0, 0, 0); torso.rotation.x = 0.06;
  part(torso, trunkG, bk, 1, 1.5, 1, 0, 0.7, 0); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; part(torso, CAP(), dk, 0.06, 1.25, 0.06, Math.cos(a) * 0.41, 0.66, Math.sin(a) * 0.41); }
  for (const [y, a] of [[0.35, 0.5], [0.9, 2.6], [1.15, 4.4]]) part(torso, SPH(), lt, 0.16, 0.22, 0.1, Math.cos(a) * 0.43, y, Math.sin(a) * 0.43, 0, -a + Math.PI / 2); // knots
  const neck = grp(torso, 0, 1.45, 0.02), head = grp(neck, 0, 0, 0);
  part(head, geo('trunkTop', () => new THREE.CylinderGeometry(0.3, 0.36, 1, 14)), bk, 1, 0.5, 1, 0, 0.22, 0);
  for (const s of [-1, 1]) { part(head, SPH(), black, 0.14, 0.1, 0.08, s * 0.12, 0.28, 0.3); part(head, SPH(), eye, 0.07, 0.05, 0.04, s * 0.12, 0.28, 0.33); part(head, CAP(), dk, 0.05, 0.16, 0.05, s * 0.12, 0.38, 0.3, 0, 0, Math.PI / 2 + s * 0.3); }
  const jaw = grp(head, 0, 0.1, 0.3); part(jaw, SPH(), black, 0.22, 0.07, 0.06, 0, 0, 0);
  // the crown: a big layered canopy of leaf clusters
  const crown = grp(head, 0, 0.5, -0.05); for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 0.25 + (i % 4) * 0.13, y = (i % 3) * 0.16; part(crown, SPH(), leaves[i % 3], 0.5 - (i % 4) * 0.05, 0.4, 0.5 - (i % 4) * 0.05, Math.cos(a) * r, 0.1 + y, Math.sin(a) * r); }
  part(crown, SPH(), leaves[0], 0.8, 0.6, 0.8, 0, 0.35, 0); for (const s of [-1, 1]) part(crown, CAP(), bk, 0.08, 0.5, 0.08, s * 0.2, -0.1, 0, 0, 0, -s * 0.6);
  const mouth = grp(head, 0, 0.15, 0.4), chest = grp(torso, 0, 1.0, 0.42);
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.42, 1.25, 0.05); part(a, SPH(), bk, 0.24, 0.24, 0.24); part(a, geo('branch', () => new THREE.CylinderGeometry(0.07, 0.11, 1, 8)), bk, 1, 0.5, 1, 0, -0.24, 0.04, -0.2);
    const fa = grp(a, 0, -0.48, 0.08); part(fa, geo('branch', () => new THREE.CylinderGeometry(0.07, 0.11, 1, 8)), bk, 0.9, 0.48, 0.9, 0, -0.22, 0.06, -0.5);
    part(fa, SPH(), leaves[1], 0.24, 0.2, 0.24, s * 0.08, -0.05, -0.05); const h = grp(fa, 0, -0.46, 0.2); for (let i = 0; i < 4; i++) part(h, CAP(), dk, 0.035, 0.28, 0.035, -0.09 + i * 0.06, -0.1, 0.04, 0.5 + i * 0.05, 0, (i - 1.5) * 0.25);
    part(a, SPH(), leaves[2], 0.3, 0.24, 0.3, s * 0.12, 0.16, -0.05); return { a, fa }; });
  const hand = grp(arms[1].fa, 0, -0.55, 0.25);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.24, 0.05, 0); part(l, geo('stump', () => new THREE.CylinderGeometry(0.15, 0.2, 1, 10)), bk, 1, 0.5, 1, 0, -0.22, 0); const k = grp(l, 0, -0.46, 0);
    part(k, geo('stump', () => new THREE.CylinderGeometry(0.15, 0.2, 1, 10)), bk, 1.05, 0.42, 1.05, 0, -0.18, 0); const f = grp(k, 0, -0.42, 0.02); for (let i = 0; i < 5; i++) { const a = -1.1 + i * 0.55; part(f, CAP(), dk, 0.07, 0.36, 0.07, Math.sin(a) * 0.17, -0.02, Math.cos(a) * 0.17 + 0.04, Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2); } return { l, k }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (4.2 + move * 2), sw = Math.sin(w) * 0.45 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; legs[0].k.rotation.x = Math.max(0, -Math.sin(w)) * 0.5 * move; legs[1].k.rotation.x = Math.max(0, Math.sin(w)) * 0.5 * move;
      hip.position.y = 0.9 + Math.abs(Math.sin(w)) * 0.05 * move; torso.rotation.z = Math.sin(w) * 0.05 * move + Math.sin(t * 0.9) * 0.02; crown.rotation.z = Math.sin(t * 1.3) * 0.05; crown.rotation.x = Math.sin(t * 1.1) * 0.04;
      arms[0].a.rotation.x = -sw * 0.5; arms[1].a.rotation.x = sw * 0.5; arms[0].a.rotation.z = -0.25; arms[1].a.rotation.z = 0.25; neck.rotation.x = 0; jaw.scale.y = 1;
      if (act === 'hit') { const s = S(k, 1); arms[1].a.rotation.x = -1.7 * s; torso.rotation.x = 0.06 + 0.2 * s; }
      else if (act === 'cast') { const s = S(k, 1); arms[0].a.rotation.z = -0.25 - 1.2 * s; arms[1].a.rotation.z = 0.25 + 1.2 * s; jaw.scale.y = 1 + 2 * s; crown.scale.setScalar(1 + 0.15 * s); } else crown.scale.setScalar(1);
      if (act === 'ko') koTip(body, k);
    } };
}
function toadHD(body, K) {
  const [skin, dark, belly, acc, eyeC] = K.pal; const sk = M(skin), dk = M(dark), bl = M(belly), ac = M(acc), eye = M(eyeC, 'glow'), black = M(0x0a0a0e), white = M(0xf0e8d0);
  const hip = grp(body, 0, 0.6, 0); const torso = grp(hip, 0, 0, 0); torso.rotation.x = 0.1;
  part(torso, SPH(), sk, 1.25, 1.0, 1.1, 0, 0.42, 0); part(torso, SPH(), bl, 0.95, 0.8, 0.5, 0, 0.36, 0.34);
  for (let i = 0; i < 14; i++) { const a = i * 2.39, y = 0.5 + (i * 0.31) % 0.45; part(torso, SPH(), ac, 0.14, 0.1, 0.1, Math.cos(a) * 0.55, y, Math.sin(a) * 0.45 - 0.05); }
  const neck = grp(torso, 0, 0.72, 0.28), head = grp(neck, 0, 0.05, 0.1);
  part(head, SPH(), sk, 0.9, 0.42, 0.62, 0, 0.02, 0.05);
  for (const s of [-1, 1]) { part(head, SPH(), sk, 0.3, 0.3, 0.3, s * 0.28, 0.2, 0.02); part(head, SPH(), white, 0.24, 0.24, 0.2, s * 0.3, 0.24, 0.1); part(head, SPH(), eye, 0.14, 0.14, 0.08, s * 0.31, 0.26, 0.19); part(head, SPH(), black, 0.12, 0.05, 0.04, s * 0.31, 0.26, 0.22); }
  const jaw = grp(head, 0, -0.08, 0.04); part(jaw, SPH(), dk, 0.86, 0.2, 0.58, 0, -0.04, 0.04); part(jaw, SPH(), M(0xc84a5a), 0.7, 0.08, 0.46, 0, 0.03, 0.06);
  const mouth = grp(head, 0, 0, 0.4), chest = grp(torso, 0, 0.45, 0.6);
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.55, 0.45, 0.32); part(a, CAP(), sk, 0.15, 0.24, 0.15, 0, -0.16, 0.06, -0.3); const f = grp(a, 0, -0.32, 0.1); for (const c of [-1, 0, 1]) part(f, SPH(), sk, 0.1, 0.05, 0.16, c * 0.07, 0, 0.06 + Math.abs(c) * -0.02, 0, c * 0.4); return { a }; });
  const hand = grp(arms[1].a, 0, -0.34, 0.2);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.48, 0.1, -0.1); part(l, SPH(), sk, 0.46, 0.4, 0.6, 0, 0, 0); const k = grp(l, 0, -0.22, 0.12); part(k, CAP(), sk, 0.16, 0.12, 0.16, 0, -0.06, 0);
    const ft = grp(k, 0, -0.18, 0.1); for (const c of [-1, 0, 1]) part(ft, SPH(), dk, 0.12, 0.06, 0.32, c * 0.1, 0, 0.1, 0, c * 0.35); return { l, k }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (4 + move * 2), hop = Math.max(0, Math.sin(w * 0.5)) * move; hip.position.y = 0.6 + hop * 0.5; legs[0].l.rotation.x = legs[1].l.rotation.x = -hop * 0.8; legs[0].k.rotation.x = legs[1].k.rotation.x = hop * 1.2;
      torso.scale.set(1 + Math.sin(t * 2.4) * 0.02, 1 - Math.sin(t * 2.4) * 0.02, 1); jaw.rotation.x = 0.04 + Math.sin(t * 1.3) * 0.03; neck.rotation.x = 0; arms[0].a.rotation.x = arms[1].a.rotation.x = -hop * 0.6;
      if (act === 'hit') { const s = S(k, 1); neck.rotation.x = 0.4 * s; jaw.rotation.x = 0.6 * s; arms[1].a.rotation.x = -1.6 * s; }
      else if (act === 'cast') { const s = S(k, 1); torso.scale.set(1 + 0.3 * s, 1 + 0.2 * s, 1 + 0.3 * s); jaw.rotation.x = 0.7 * s; neck.rotation.x = -0.4 * s; }
      else if (act === 'ko') koTip(body, k);
    } };
}

// ---------- the squid: Geezora ----------
function squidHD(body, K) {
  const [skin, dark, light, acc, eyeC] = K.pal;
  const sk = M(skin), dk = M(dark), lt = M(light), ac = M(acc), white = M(0xf0e8d0), eye = M(eyeC, 'glow'), black = M(0x0a0a0e);
  const hip = grp(body, 0, 0.6, 0); const mantle = grp(hip, 0, 0.2, 0);
  part(hip, SPH(), sk, 0.86, 0.62, 0.8, 0, 0.12, 0);
  // the mantle: a smooth tapering bulb with dark spots and two fins
  const prof = []; for (let i = 0; i <= 16; i++) { const u = i / 16; prof.push(new THREE.Vector2(Math.max(0.001, Math.sin(Math.pow(u, 0.75) * Math.PI) * (0.55 - u * 0.18)), u * 2.0)); }
  part(mantle, geo('mantle', () => new THREE.LatheGeometry(prof, 18)), sk, 1, 1, 1, 0, -0.05, 0);
  for (let i = 0; i < 16; i++) { const a = i * 2.39, y = 0.3 + (i * 0.37) % 1.3; const r = Math.sin(Math.pow(y / 2, 0.75) * Math.PI) * (0.55 - y / 2 * 0.18); part(mantle, SPH(), dk, 0.1, 0.07, 0.04, Math.cos(a) * r * 0.97, y, Math.sin(a) * r * 0.97, 0, -a + Math.PI / 2); }
  const finG = geo('fin', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.55, 0.15, 0.5, 0.75); s.quadraticCurveTo(0.2, 0.55, 0, 0.9); s.lineTo(0, 0); return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }); });
  for (const s of [-1, 1]) part(mantle, finG, ac, s, 1, 1, s * 0.3, 1.05, -0.02, 0, 0, 0);
  // big eyes: white, coloured iris, slit pupil
  for (const s of [-1, 1]) { part(mantle, SPH(), white, 0.34, 0.34, 0.24, s * 0.36, 0.18, 0.3); part(mantle, SPH(), eye, 0.2, 0.2, 0.1, s * 0.37, 0.18, 0.41); part(mantle, SPH(), black, 0.05, 0.14, 0.04, s * 0.375, 0.18, 0.46); part(mantle, TOR(), dk, 0.36, 0.36, 0.3, s * 0.36, 0.18, 0.33); }
  // eight arms and two long tentacles: tapering chains with suckers underneath
  const tents = []; for (let i = 0; i < 10; i++) { const longT = i >= 8; const a = longT ? (i === 8 ? -0.5 : 0.5) + Math.PI / 2 : (i / 8) * Math.PI * 2; let prev = grp(hip, Math.cos(a) * 0.3, -0.06, Math.sin(a) * 0.3); prev.rotation.y = -a + Math.PI / 2;
    const segs = []; const n = longT ? 8 : 6; for (let j = 0; j < n; j++) { const s = 1 - j / (n + 1); part(prev, CAP(), j % 2 ? sk : M(lerpC(skin, light, 0.3)), 0.3 * s, 0.2, 0.3 * s, 0, 0, 0.13, Math.PI / 2);
      if (j % 2 === 0) part(prev, CYL(), lt, 0.1 * s + 0.03, 0.02, 0.1 * s + 0.03, 0, -0.14 * s, 0.13); segs.push(prev); prev = grp(prev, 0, 0, 0.26); }
    if (longT) part(prev, SPH(), sk, 0.22, 0.12, 0.32, 0, 0, 0.1); tents.push({ segs, ph: i * 0.7, longT }); }
  const beak = grp(hip, 0, -0.1, 0.35); part(beak, CON(), M(0x2a1a14), 0.14, 0.2, 0.14, 0, -0.05, 0, Math.PI);
  const mouth = grp(hip, 0, 0.1, 0.55), hand = grp(hip, 0, 0, 0.9), chest = grp(mantle, 0, 0.3, 0.5);
  return { mouth, hand, chest, shadowK: 1.6,
    anim(t, dt, move, act, k) {
      for (const tn of tents) tn.segs.forEach((s, j) => { s.rotation.x = (j === 0 ? 0.9 : 0) + (tn.longT ? 0.12 : 0.22) + Math.sin(t * (2.6 + move * 3) + tn.ph + j * 0.7) * (0.22 + j * 0.03); s.rotation.y = Math.sin(t * 1.7 + tn.ph + j * 0.4) * 0.18; });
      hip.position.y = 0.6 + Math.sin(t * 2) * 0.06; mantle.rotation.x = Math.sin(t * 1.3) * 0.06 + move * 0.2; mantle.rotation.z = Math.sin(t * 0.9) * 0.04; mantle.scale.set(1 + Math.sin(t * 2.4) * 0.02, 1, 1 + Math.sin(t * 2.4) * 0.02);
      if (act === 'hit') { const s = S(k, 1); mantle.rotation.x = 0.5 * s; for (const tn of tents) tn.segs[0].rotation.x = -0.7 * s; }
      else if (act === 'cast') { const s = S(k, 1); mantle.scale.set(1 + 0.22 * s, 1 - 0.15 * s, 1 + 0.22 * s); for (const tn of tents) tn.segs[0].rotation.x = 0.3 - 1.1 * s; }
      if (act === 'ko') { hip.position.y = 0.6 - k * 0.5; mantle.rotation.x = Math.min(1.4, k * 2); }
    } };
}

// ---------- giant robots: bevelled panels built from the same kit as the blocky robots (crests, pads, windows, a tape
// deck, a glowing core, swords, shields, cannons, jet or spiked wings, lion colours); opt.ed and opt.pod get their own ----------
function robotHD(body, K) {
  const [main, legC, trim, acc, eyeC] = K.pal, o = K.opt || {}; if (o.ed) return edHD(body, K); if (o.pod) return podHD(body, K);
  const wd = o.chunky ? 1.15 : o.slim ? 0.82 : 1;
  const mn = M(main, 'metal'), lg = M(legC, 'metal'), silver = M(trim, 'metal'), ac = M(acc, 'metal'), dark = M(0x1a1a22, 'metal'), tire = M(0x16161a), glass = M(0x7ac8ff, 'glow'), eye = M(eyeC, 'glow');
  const armC = (s) => (o.multi ? M(s < 0 ? 0x2a9a3a : 0xd82a2a, 'metal') : mn), legM = (s) => (o.multi ? M(s < 0 ? 0x2a4ac8 : 0xffd24a, 'metal') : lg);
  const line = (p, w, h, x, y, z) => part(p, RBX(), dark, w, h, 0.02, x, y, z);
  const hip = grp(body, 0, 1.0, 0); const torso = grp(hip, 0, 0.1, 0);
  part(hip, RBX(), silver, 0.62 * wd, 0.22, 0.42, 0, 0, 0); part(hip, RBX(), lg, 0.24, 0.2, 0.44, 0, -0.02, 0.02);
  // waist with a grille, then the chest and its options
  part(torso, RBX(), silver, 0.5 * wd, 0.28, 0.38, 0, 0.18, 0); for (let i = 0; i < 6; i++) part(torso, RBX(), dark, 0.42 * wd, 0.02, 0.02, 0, 0.1 + i * 0.035, 0.2);
  const chest = grp(torso, 0, 0.66, 0); part(chest, RBX(), mn, 1.0 * wd, 0.62, 0.56, 0, 0, 0); part(chest, RBX(), mn, 0.86 * wd, 0.12, 0.5, 0, 0.36, -0.02);
  part(chest, RBX(), silver, 0.62 * wd, 0.24, 0.05, 0, -0.16, 0.28); line(chest, 0.9 * wd, 0.015, 0, -0.03, 0.285);
  if (o.windows) for (const s of [-1, 1]) { part(chest, RBX(), silver, 0.36, 0.28, 0.04, s * 0.23, 0.12, 0.28); part(chest, RBX(), glass, 0.31, 0.23, 0.04, s * 0.23, 0.12, 0.3); line(chest, 0.02, 0.24, s * 0.23, 0.12, 0.32); }
  if (o.chestV) for (const s of [-1, 1]) part(chest, RBX(), ac, 0.46, 0.12, 0.06, s * 0.18, 0.16, 0.29, 0, 0, s * 0.5);
  if (o.deck) { part(chest, RBX(), M(0x2a2a3a, 'metal'), 0.52, 0.3, 0.05, 0, 0.12, 0.29); part(chest, RBX(), glass, 0.4, 0.14, 0.03, 0, 0.14, 0.32); for (const s of [-1, 1]) part(chest, CYL(), silver, 0.08, 0.03, 0.08, s * 0.1, 0.14, 0.34, Math.PI / 2); }
  if (o.core) { part(chest, CYL(), M(o.core, 'glow'), 0.3, 0.05, 0.3, 0, 0.12, 0.3, Math.PI / 2); part(chest, TOR(), silver, 0.36, 0.36, 0.6, 0, 0.12, 0.3); }
  if (!o.windows && !o.chestV && !o.deck && !o.core) { part(chest, RBX(), silver, 0.62 * wd, 0.26, 0.04, 0, 0.12, 0.29); line(chest, 0.015, 0.24, 0, 0.12, 0.31); }
  if (o.stacks) for (const s of [-1, 1]) { const st = grp(chest, s * 0.42 * wd, 0.22, -0.2); part(st, CYL(), silver, 0.1, 0.62, 0.1, 0, 0.2, 0); part(st, CYL(), dark, 0.12, 0.05, 0.12, 0, 0.5, 0); }
  if (o.jet) for (const s of [-1, 1]) { const wv = grp(torso, s * 0.4, 0.95, -0.32); part(wv, RBX(), mn, 0.95, 0.05, 0.5, s * 0.45, 0, 0, 0, 0, s * 0.45); part(wv, RBX(), ac, 0.3, 0.06, 0.2, s * 0.85, 0.15, 0.12, 0, 0, s * 0.45); }
  if (o.getter) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) part(torso, CON(), ac, 0.18 - i * 0.04, 1.1 - i * 0.25, 0.4, s * (0.5 + i * 0.12), 1.4 - i * 0.12, -0.3, 0, 0, -s * (0.55 + i * 0.25));
  // head: helmet (or a tower, or a dome), face plate, eyes, crests
  const neck = grp(torso, 0, 1.03, 0.02), head = grp(neck, 0, 0.12, 0);
  if (o.tower) part(head, CYL(), mn, 0.36, 0.46, 0.36, 0, 0.12, 0); else if (o.round) part(head, SPH(), mn, 0.44, 0.4, 0.42, 0, 0.1, 0); else part(head, RBX(), lg === mn ? mn : M(legC === main ? main : acc, 'metal'), 0.36, 0.34, 0.34, 0, 0.08, 0);
  part(head, RBX(), silver, 0.24, 0.16, 0.06, 0, 0.0, 0.18); for (let i = 0; i < 3; i++) part(head, RBX(), dark, 0.16, 0.012, 0.02, 0, -0.03 + i * 0.03, 0.215);
  for (const s of [-1, 1]) part(head, RBX(), eye, 0.1, 0.035, 0.03, s * 0.065, 0.12, 0.19);
  if (o.v) for (const s of [-1, 1]) part(head, CON(), M(0xffd24a, 'metal'), 0.05, 0.36, 0.05, s * 0.1, 0.32, 0.14, 0, 0, -s * 0.75);
  if (o.horns) for (const s of [-1, 1]) part(head, CON(), ac, 0.08, 0.36, 0.08, s * 0.18, 0.3, 0, 0, 0, -s * 0.5);
  if (o.horn) part(head, CON(), ac, 0.08, 0.46, 0.08, 0, 0.36, 0.1, -0.5);
  if (o.fins) for (const s of [-1, 1]) { part(head, RBX(), ac, 0.05, 0.3, 0.14, s * 0.2, 0.2, 0.02, 0, 0, s * -0.1); part(head, CYL(), silver, 0.03, 0.14, 0.03, s * 0.2, 0.4, 0.02); }
  if (o.antenna) { part(head, CYL(), lg, 0.03, 0.34, 0.03, 0, 0.42, 0); part(head, SPH(), eye, 0.06, 0.06, 0.06, 0, 0.6, 0); }
  const mouth = grp(head, 0, 0, 0.25);
  for (const s of [-1, 1]) { part(torso, RBX(), o.multi ? armC(s) : ac, 0.34 * wd, 0.26, 0.46, s * 0.64 * wd, 0.95, 0); part(torso, RBX(), silver, 0.36 * wd, 0.05, 0.48, s * 0.64 * wd, 1.07, 0); }
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.66 * wd, 0.82, 0); part(a, CAP(), silver, 0.18 * wd, 0.2, 0.18 * wd, 0, -0.18, 0);
    const f = grp(a, 0, -0.4, 0); part(f, RBX(), armC(s), 0.28 * wd, 0.42, 0.3, 0, -0.2, 0); part(f, RBX(), silver, 0.3 * wd, 0.06, 0.32, 0, -0.04, 0); line(f, 0.02, 0.3, s * 0.142 * wd, -0.2, 0);
    const fist = grp(f, 0, -0.48, 0.02); part(fist, RBX(), lg, 0.22, 0.18, 0.24); for (let i = 0; i < 4; i++) part(fist, RBX(), lg, 0.045, 0.08, 0.06, -0.075 + i * 0.05, -0.06, 0.13); return { a, f }; });
  const hand = grp(arms[1].f, 0, -0.5, 0.1);
  if (o.sword) { const sw = grp(arms[1].f, 0, -0.5, 0.1); part(sw, RBX(), M(0xd8dce4, 'metal'), 0.06, 0.16, 1.5, 0, 0, 0.75); part(sw, RBX(), M(0xffd24a, 'metal'), 0.3, 0.06, 0.08, 0, 0, 0.02); }
  if (o.shield) { part(arms[0].f, RBX(), M(o.shield, 'metal'), 0.08, 0.86, 0.56, -0.22, -0.2, 0.05); part(arms[0].f, RBX(), M(0xffd24a, 'metal'), 0.09, 0.5, 0.06, -0.24, -0.2, 0.05); }
  if (o.cannon) { part(arms[1].f, CYL(), lg, 0.22, 0.66, 0.22, 0.14, -0.3, 0.12); part(arms[1].f, CYL(), dark, 0.14, 0.05, 0.14, 0.14, -0.64, 0.12); }
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.26 * wd, 0, 0); part(l, RBX(), legM(s), 0.32 * wd, 0.52, 0.36, 0, -0.26, 0); const k = grp(l, 0, -0.5, 0);
    part(k, RBX(), silver, 0.3 * wd, 0.12, 0.38, 0, 0.0, 0.03); part(k, RBX(), legM(s), 0.36 * wd, 0.44, 0.42, 0, -0.22, 0); line(k, 0.3 * wd, 0.015, 0, -0.1, 0.215); line(k, 0.3 * wd, 0.015, 0, -0.32, 0.215);
    if (o.windows || o.stacks) { const wh = grp(k, s * 0.2 * wd, -0.18, -0.04); part(wh, CYL(), tire, 0.3, 0.1, 0.3, 0, 0, 0, 0, 0, Math.PI / 2); part(wh, CYL(), silver, 0.15, 0.11, 0.15, 0, 0, 0, 0, 0, Math.PI / 2); }
    part(k, RBX(), silver, 0.4 * wd, 0.12, 0.56, 0, -0.45, 0.06); part(k, RBX(), legM(s), 0.38 * wd, 0.06, 0.14, 0, -0.41, 0.31); return { l, k }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (5 + move * 2), sw = Math.sin(w) * 0.5 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; legs[0].k.rotation.x = Math.max(0, -Math.sin(w)) * 0.6 * move; legs[1].k.rotation.x = Math.max(0, Math.sin(w)) * 0.6 * move;
      hip.position.y = 1.0 + Math.abs(Math.sin(w)) * 0.05 * move; torso.rotation.y = Math.sin(w) * 0.08 * move; neck.rotation.x = 0; head.rotation.y = Math.sin(t * 0.6) * 0.15;
      arms[0].a.rotation.x = -sw * 0.5; arms[1].a.rotation.x = sw * 0.5; arms[0].f.rotation.x = arms[1].f.rotation.x = -0.15 - move * 0.2;
      if (act === 'hit') { const s = S(k, 1); arms[1].a.rotation.x = -1.6 * s; arms[1].f.rotation.x = 0; torso.rotation.y = -0.4 * s; }
      else if (act === 'cast') { const s = S(k, 1); arms[0].a.rotation.x = arms[1].a.rotation.x = -1.4 * s; neck.rotation.x = -0.3 * s; }
      else if (act === 'ko') koTip(body, k);
    } };
}
// the two-gun walker: a wide armoured body, no head, gun arms, backward-bending bird legs
function edHD(body, K) {
  const [main, legC, trim, , eyeC] = K.pal; const mn = M(main, 'metal'), lg = M(legC, 'metal'), tr = M(trim, 'metal'), dark = M(0x1a1a22, 'metal'), eye = M(eyeC, 'glow');
  const hip = grp(body, 0, 1.15, 0); const torso = grp(hip, 0, 0.1, 0);
  part(torso, RBX(), mn, 1.3, 0.62, 1.0, 0, 0.3, 0); part(torso, RBX(), tr, 1.1, 0.16, 0.86, 0, 0.64, -0.04); part(torso, RBX(), dark, 0.7, 0.24, 0.2, 0, 0.32, 0.52); part(torso, RBX(), eye, 0.5, 0.05, 0.03, 0, 0.42, 0.62);
  for (let i = 0; i < 4; i++) part(torso, RBX(), dark, 0.02, 0.4, 0.02, -0.45 + i * 0.3, 0.3, 0.505);
  const chest = grp(torso, 0, 0.3, 0.55), mouth = grp(torso, 0, 0.35, 0.65);
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.78, 0.32, 0.05); part(a, RBX(), mn, 0.32, 0.34, 0.54, 0, 0, 0.1); part(a, CYL(), lg, 0.14, 0.7, 0.14, 0, 0.04, 0.6, Math.PI / 2); part(a, CYL(), lg, 0.14, 0.7, 0.14, 0, -0.1, 0.6, Math.PI / 2); part(a, RBX(), tr, 0.2, 0.36, 0.2, 0, -0.02, 0.32); return { a, f: a }; });
  const hand = grp(arms[1].a, 0, 0, 0.95);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.5, 0, 0); part(l, RBX(), lg, 0.3, 0.56, 0.36, 0, -0.24, 0.12, -0.35); const k = grp(l, 0, -0.5, 0.24); part(k, RBX(), lg, 0.26, 0.56, 0.3, 0, -0.24, -0.1, 0.4); part(k, RBX(), dark, 0.5, 0.1, 0.64, 0, -0.5, 0.02); for (const c of [-1, 1]) part(k, RBX(), tr, 0.12, 0.08, 0.3, c * 0.16, -0.5, 0.36); return { l, k }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (4.5 + move * 2), sw = Math.sin(w) * 0.45 * move; legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; hip.position.y = 1.15 + Math.abs(Math.sin(w)) * 0.06 * move; torso.rotation.y = Math.sin(t * 0.8) * 0.15;
      for (const a of arms) a.a.rotation.x = Math.sin(t * 1.4) * 0.05;
      if (act === 'hit') { const s = S(k, 1); torso.rotation.x = 0.2 * s; for (const a of arms) a.a.rotation.x = -0.3 * s; } else if (act === 'cast') { const s = S(k, 1); torso.position.y = 0.1 + 0.1 * s; torso.rotation.x = -0.15 * s; } else { torso.rotation.x = 0; torso.position.y = 0.1; }
      if (act === 'ko') koTip(body, k);
    } };
}
// the pilot pod: a round shell with a cockpit, twin cannons and stubby legs
function podHD(body, K) {
  const [main, legC, trim, acc, eyeC] = K.pal; const mn = M(main, 'metal'), lg = M(legC, 'metal'), tr = M(trim, 'metal'), ac = M(acc, 'metal'), glass = M(0x7ac8ff, 'glow'), eye = M(eyeC, 'glow');
  const hip = grp(body, 0, 1.0, 0); const torso = grp(hip, 0, 0.1, 0);
  part(torso, SPH(), mn, 1.45, 1.1, 1.35, 0, 0.42, 0); part(torso, SPH(), tr, 0.7, 0.4, 0.2, 0, 0.5, 0.62); part(torso, SPH(), glass, 0.5, 0.26, 0.12, 0, 0.52, 0.7);
  for (const s of [-1, 1]) { part(torso, RBX(), ac, 0.12, 0.5, 0.6, s * 0.7, 0.62, -0.05); part(torso, SPH(), lg, 0.2, 0.2, 0.2, s * 0.25, 0.86, 0.48); }
  part(torso, geo('ear', () => new THREE.ConeGeometry(0.5, 1, 3)), ac, 0.18, 0.4, 0.1, -0.35, 1.0, 0.1, 0, 0, 0.4); part(torso, geo('ear', () => new THREE.ConeGeometry(0.5, 1, 3)), ac, 0.18, 0.4, 0.1, 0.35, 1.0, 0.1, 0, 0, -0.4);
  const chest = grp(torso, 0, 0.5, 0.7), mouth = grp(torso, 0, 0.5, 0.75);
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.78, 0.4, 0.1); part(a, RBX(), mn, 0.3, 0.3, 0.46, 0, 0, 0.05); part(a, CYL(), lg, 0.16, 0.72, 0.16, 0, 0, 0.55, Math.PI / 2); part(a, CYL(), eye, 0.1, 0.02, 0.1, 0, 0, 0.92, Math.PI / 2); return { a, f: a }; });
  const hand = grp(arms[1].a, 0, 0, 0.95);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.42, 0, 0); part(l, CAP(), lg, 0.24, 0.34, 0.24, 0, -0.26, 0); const k = grp(l, 0, -0.52, 0.02); part(k, RBX(), tr, 0.3, 0.3, 0.34, 0, -0.14, 0); part(k, RBX(), mn, 0.36, 0.12, 0.5, 0, -0.38, 0.08); return { l, k }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (5.5 + move * 2), sw = Math.sin(w) * 0.5 * move; legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; hip.position.y = 1.0 + Math.abs(Math.sin(w)) * 0.07 * move; torso.rotation.z = Math.sin(w) * 0.05 * move;
      if (act === 'hit') { const s = S(k, 1); torso.rotation.x = 0.25 * s; } else if (act === 'cast') { const s = S(k, 1); torso.scale.setScalar(1 + 0.08 * s); } else { torso.rotation.x = 0; torso.scale.setScalar(1); }
      if (act === 'ko') koTip(body, k);
    } };
}

// ---------- the ape: a hulking chest, long arms that knuckle-walk, a heavy brow (opt.pants: bare skin with torn shorts;
// opt.bark: a tree-ent with a leafy crown and twig fingers) ----------
function apeHD(body, K) {
  const [fur, dark, face, , eyeA] = K.pal || [0x3b2c24, 0x241a14, 0x6a5040, 0, 0xffb02a], o = K.opt || {};
  const fr = M(fur), dk = M(dark), fc = M(face), eye = M(eyeA, 'glow'), black = M(0x0a0a0e), bone = M(0xe8e2d0), leaf = M(0x3a8a2a);
  const hip = grp(body, 0, 0.75, 0); const torso = grp(hip, 0, 0.05, 0); torso.rotation.x = 0.45;
  part(hip, SPH(), o.pants ? dk : fr, 0.86, 0.5, 0.66, 0, 0, -0.02);
  part(torso, SPH(), fr, 1.05, 0.92, 0.8, 0, 0.45, 0); part(torso, SPH(), fr, 1.25, 0.7, 0.86, 0, 0.82, 0.02);
  for (const s of [-1, 1]) part(torso, SPH(), fc, 0.44, 0.36, 0.2, s * 0.2, 0.72, 0.36);                       // pecs
  part(torso, SPH(), fc, 0.5, 0.44, 0.2, 0, 0.36, 0.34);                                                         // belly
  if (!o.pants && !o.bark) for (let i = 0; i < 14; i++) { const a = i * 2.4, y = 0.3 + (i * 0.29) % 0.75; part(torso, CON(), dk, 0.1, 0.22, 0.1, Math.cos(a) * 0.5, y, Math.sin(a) * 0.36 - 0.06, 0.4 * Math.sin(a), 0, -0.4 * Math.cos(a)); } // fur tufts
  if (o.bark) { for (let i = 0; i < 10; i++) part(torso, CAP(), dk, 0.05, 0.5, 0.05, -0.45 + i * 0.1, 0.55, -0.32 + (i % 2) * 0.05); for (const s of [-1, 1]) part(torso, SPH(), leaf, 0.36, 0.26, 0.36, s * 0.55, 1.05, 0); }
  const chest = grp(torso, 0, 0.6, 0.45);
  const neck = grp(torso, 0, 1.05, 0.22); const head = grp(neck, 0, 0.12, 0.08);
  part(head, SPH(), fr, 0.52, 0.5, 0.5, 0, 0.1, 0); part(head, RBX(), dk, 0.54, 0.1, 0.18, 0, 0.24, 0.18); part(head, SPH(), fc, 0.4, 0.3, 0.3, 0, 0.0, 0.2);
  for (const s of [-1, 1]) { part(head, SPH(), eye, 0.07, 0.05, 0.04, s * 0.11, 0.15, 0.24); part(head, SPH(), black, 0.03, 0.04, 0.02, s * 0.11, 0.15, 0.265); part(head, SPH(), fc, 0.12, 0.16, 0.08, s * 0.28, 0.12, 0); part(head, SPH(), black, 0.05, 0.035, 0.03, s * 0.05, 0.04, 0.34); }
  if (o.bark) { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; part(head, SPH(), leaf, 0.3, 0.22, 0.3, Math.cos(a) * 0.22, 0.38 + (i % 2) * 0.06, Math.sin(a) * 0.2); } part(head, CON(), M(0x9ad8ff), 0.04, 0.4, 0.04, 0, 0.22, 0.22, 0.2); } // leafy crown, a mossy beard
  const jaw = grp(head, 0, -0.12, 0.16); part(jaw, SPH(), fc, 0.34, 0.14, 0.26, 0, -0.02, 0.06); for (const s of [-1, 1]) part(jaw, CON(), bone, 0.04, 0.08, 0.04, s * 0.08, 0.04, 0.16);
  const mouth = grp(head, 0, -0.05, 0.42);
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.68, 0.88, 0.15); part(a, SPH(), fr, 0.4, 0.38, 0.38, 0, 0, 0); part(a, CAP(), fr, 0.28, 0.42, 0.3, 0, -0.3, 0);
    const el = grp(a, 0, -0.58, 0); part(el, CAP(), fr, 0.26, 0.42, 0.28, 0, -0.28, 0.04); const fist = grp(el, 0, -0.62, 0.06); part(fist, SPH(), o.bark ? dk : fc, 0.34, 0.24, 0.36);
    for (let i = 0; i < 4; i++) part(fist, o.bark ? CAP() : SPH(), o.bark ? dk : fc, o.bark ? 0.05 : 0.09, o.bark ? 0.3 : 0.1, o.bark ? 0.05 : 0.12, -0.11 + i * 0.075, -0.1, 0.14, o.bark ? 0.5 : 0); return { a, el }; });
  const hand = grp(arms[1].el, 0, -0.62, 0.15);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.34, 0, -0.05); part(l, CAP(), o.pants ? dk : fr, 0.36, 0.32, 0.38, 0, -0.18, 0); if (o.pants) part(l, CON(), dk, 0.42, 0.14, 0.42, 0, -0.38, 0, Math.PI);
    const k = grp(l, 0, -0.38, 0); part(k, CAP(), fr, 0.3, 0.22, 0.32, 0, -0.12, 0); part(k, SPH(), o.bark ? dk : fc, 0.36, 0.14, 0.52, 0, -0.32, 0.08); return { l, k }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (4.6 + move * 2), sw = Math.sin(w) * 0.5 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; arms[0].a.rotation.x = -0.35 - sw * 0.9; arms[1].a.rotation.x = -0.35 + sw * 0.9; arms[0].el.rotation.x = 0.25; arms[1].el.rotation.x = 0.25;
      hip.position.y = 0.75 + Math.abs(Math.sin(w)) * 0.07 * move; torso.rotation.x = 0.45 + Math.sin(t * 1.4) * 0.02; torso.rotation.z = Math.sin(w) * 0.06 * move; neck.rotation.x = 0; jaw.rotation.x = Math.sin(t * 1.1) * 0.04;
      if (act === 'hit') { const s = S(k, 1); arms[1].a.rotation.x = -0.35 - 2.2 * s; arms[1].el.rotation.x = 0.25 - 0.4 * s; torso.rotation.x = 0.45 + 0.25 * s; }
      else if (act === 'cast') { const s = S(k, 1); const beat = Math.sin(k * Math.PI * 8) * 0.4 * s; torso.rotation.x = 0.45 - 0.4 * s; arms[0].a.rotation.x = -1.6 * s + beat; arms[1].a.rotation.x = -1.6 * s - beat; arms[0].el.rotation.x = arms[1].el.rotation.x = -1.2 * s; jaw.rotation.x = 0.5 * s; neck.rotation.x = -0.4 * s; }
      else if (act === 'ko') { body.rotation.x = -Math.min(1.5, k * 2); body.position.y = -k * 0.2; }
    } };
}

// ---------- four-legged beasts: spikes, a shell, a sail, a horn, tusks ----------
function quadHD(body, K) {
  const [skin, dark, belly, acc, eyeC] = K.pal, o = K.opt || {};
  const sk = M(skin), dk = M(dark), bl = M(belly), ac = M(acc), eye = M(eyeC, 'glow'), black = M(0x0a0a0e), bone = M(0xf0e8d0);
  const hip = grp(body, 0, 0.88, 0);
  part(hip, CAP(), sk, 1.0, 1.1, 0.82, 0, 0.12, 0, Math.PI / 2); part(hip, SPH(), sk, 1.05, 0.86, 0.9, 0, 0.18, 0.45); part(hip, CAP(), bl, 0.74, 0.9, 0.3, 0, -0.18, 0.05, Math.PI / 2);
  for (let i = 0; i < 6; i++) part(hip, CAP(), dk, 0.03, 0.5, 0.03, 0, -0.32, -0.5 + i * 0.2, 0, 0, Math.PI / 2);
  if (o.shell) { part(hip, geo('dome', () => new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), ac, 1.7, 1.05, 2.2, 0, 0.32, -0.05);
    for (let i = 0; i < 9; i++) { const a = (i % 3 - 1) * 0.45, z = -0.7 + Math.floor(i / 3) * 0.6; part(hip, geo('hex', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6)), dk, 0.42, 0.06, 0.42, a, 0.78 - Math.abs(a) * 0.35 - Math.abs(z) * 0.12, z, Math.abs(a) * -0.6 * Math.sign(a) * 0, 0, -a * 0.8); } }
  if (o.spikes) for (let i = 0; i < 14; i++) { const x = ((i % 3) - 1) * 0.28, z = -0.75 + Math.floor(i / 3) * 0.36; part(hip, CON(), ac, 0.13, 0.5, 0.13, x, 0.6 - Math.abs(x) * 0.3, z, -0.35, 0, x * 1.2); }
  let sail = null; if (o.sail) { sail = grp(hip, 0, 0.5, 0); const shp = new THREE.Shape(); shp.moveTo(-0.9, 0); shp.quadraticCurveTo(-0.3, 1.4, 0.5, 1.0); shp.quadraticCurveTo(0.85, 0.5, 0.9, 0); shp.lineTo(-0.9, 0); const sm = new THREE.Mesh(geo('sail', () => new THREE.ShapeGeometry(shp, 12)), new THREE.MeshLambertMaterial({ color: acc, side: THREE.DoubleSide })); sm.rotation.y = Math.PI / 2; sail.add(sm); for (let i = 0; i < 7; i++) { const z = -0.75 + i * 0.25, h = 0.2 + Math.sin((i + 0.5) / 7 * Math.PI) * 1.05; part(sail, CAP(), dk, 0.035, h, 0.035, 0, h / 2, z); } }
  const neck = grp(hip, 0, 0.25, 0.92); part(neck, CAP(), sk, 0.5, 0.3, 0.5, 0, 0.0, 0.05, 1.2); const head = grp(neck, 0, 0.05, 0.22);
  part(head, SPH(), sk, 0.6, 0.48, 0.62, 0, 0.06, 0.15); part(head, RBX(), sk, 0.44, 0.26, 0.42, 0, -0.03, 0.52); part(head, RBX(), dk, 0.5, 0.08, 0.2, 0, 0.24, 0.22);
  for (const s of [-1, 1]) { part(head, SPH(), eye, 0.08, 0.06, 0.06, s * 0.2, 0.17, 0.38); part(head, SPH(), black, 0.035, 0.05, 0.03, s * 0.205, 0.17, 0.41); part(head, SPH(), dk, 0.05, 0.04, 0.03, s * 0.08, 0.02, 0.73); }
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) part(head, CON(), bone, 0.035, 0.07, 0.035, s * (0.18 - i * 0.004), -0.15, 0.36 + i * 0.065, Math.PI);
  const jaw = grp(head, 0, -0.17, 0.18); part(jaw, RBX(), dk, 0.42, 0.1, 0.56, 0, -0.03, 0.28); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) part(jaw, CON(), bone, 0.03, 0.06, 0.03, s * 0.17, 0.04, 0.2 + i * 0.07);
  if (o.horn) { part(head, CON(), ac, 0.16, 0.5, 0.16, 0, 0.24, 0.66, 1.0); part(head, CON(), ac, 0.1, 0.28, 0.1, 0, 0.3, 0.3, 0.5); }
  if (o.tusks) for (const s of [-1, 1]) part(jaw, CON(), bone, 0.08, 0.4, 0.08, s * 0.16, 0.14, 0.5, -0.4);
  const mouth = grp(head, 0, -0.1, 0.85), chest = grp(hip, 0, 0.1, 0.95), hand = grp(head, 0, 0, 0.7);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => { const l = grp(hip, sx * 0.44, -0.12, sz * 0.6); part(l, SPH(), sk, 0.42, 0.56, 0.46, 0, -0.14, 0); const kn = grp(l, 0, -0.38, 0); part(kn, CAP(), sk, 0.26, 0.22, 0.28, 0, -0.12, 0);
    const ft = grp(kn, 0, -0.32, 0.04); part(ft, SPH(), dk, 0.34, 0.14, 0.42, 0, 0, 0.05); for (const c of [-1, 0, 1]) part(ft, CON(), bone, 0.05, 0.12, 0.05, c * 0.1, -0.02, 0.26, Math.PI / 2); return { l, kn, ph: (sx * sz > 0 ? 0 : Math.PI) }; });
  const tail = []; let prev = grp(hip, 0, 0.08, -0.95); for (let i = 0; i < 6; i++) { const s = 1 - i * 0.14; part(prev, SPH(), sk, 0.4 * s, 0.34 * s, 0.42, 0, 0, -0.16); if (o.spikes) part(prev, CON(), ac, 0.1 * s + 0.04, 0.3 * s, 0.1 * s + 0.04, 0, 0.2 * s, -0.16); tail.push(prev); prev = grp(prev, 0, -0.01, -0.3); }
  if (o.spikes) part(prev, SPH(), ac, 0.24, 0.24, 0.24, 0, 0, -0.05);
  return { mouth, hand, chest, shadowK: 1.25,
    anim(t, dt, move, act, k) {
      const w = t * (5 + move * 2.5); for (const lg of legs) { lg.l.rotation.x = Math.sin(w + lg.ph) * 0.5 * move; lg.kn.rotation.x = Math.max(0, Math.sin(w + lg.ph + 1)) * 0.5 * move; }
      hip.position.y = 0.88 + Math.abs(Math.sin(w)) * 0.05 * move; hip.rotation.x = 0; neck.rotation.x = Math.sin(t * 1.5) * 0.05; head.rotation.y = Math.sin(t * 0.7) * 0.12; jaw.rotation.x = 0.05 + Math.sin(t * 1.3) * 0.03;
      tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 2.4 - i * 0.6) * (0.12 + move * 0.08); });
      if (act === 'hit') { const s = S(k, 1); neck.rotation.x = 0.4 * s; jaw.rotation.x = 0.6 * s; hip.position.y += 0.2 * s; }
      else if (act === 'cast') { const s = S(k, 1); neck.rotation.x = -0.5 * s; jaw.rotation.x = 0.7 * s; hip.rotation.x = -0.15 * s; if (sail) sail.scale.setScalar(1 + 0.3 * s); }
      else if (sail) sail.scale.setScalar(1);
      if (act === 'ko') koTip(body, k);
    } };
}

// ---------- the crab: a bumpy carapace, huge claws, eye stalks, jointed legs ----------
function crabHD(body, K) {
  const [shell, dark, light, acc] = K.pal; const sh = M(shell), dk = M(dark), lt = M(light), ac = M(acc), black = M(0x0a0a0e);
  const hip = grp(body, 0, 0.72, 0);
  part(hip, SPH(), sh, 1.45, 0.62, 1.15, 0, 0.12, 0); part(hip, SPH(), lt, 1.1, 0.24, 0.85, 0, -0.12, 0.04);
  for (let i = 0; i < 12; i++) { const a = i * 2.4, r = 0.25 + (i % 3) * 0.14; part(hip, SPH(), dk, 0.12, 0.07, 0.12, Math.cos(a) * r, 0.4 - r * 0.25, Math.sin(a) * r * 0.75); }
  for (let i = 0; i < 5; i++) part(hip, CON(), dk, 0.08, 0.16, 0.08, -0.4 + i * 0.2, 0.22, 0.56, 0.9);
  const tail = []; let prev = grp(hip, 0, 0.0, -0.52); for (let i = 0; i < 4; i++) { const s = 1 - i * 0.15; part(prev, RBX(), sh, 0.6 * s, 0.24 * s, 0.32, 0, 0, -0.15); tail.push(prev); prev = grp(prev, 0, -0.03, -0.3); } part(prev, SPH(), lt, 0.5, 0.1, 0.32, 0, 0, -0.1);
  const head = grp(hip, 0, 0.12, 0.56);
  for (const s of [-1, 1]) { part(head, CAP(), dk, 0.05, 0.3, 0.05, s * 0.15, 0.24, 0.05); part(head, SPH(), black, 0.12, 0.12, 0.12, s * 0.15, 0.44, 0.05); part(head, SPH(), M(0xffffff, 'glow'), 0.035, 0.035, 0.03, s * 0.17, 0.46, 0.1); part(head, CAP(), ac, 0.015, 0.6, 0.015, s * 0.12, 0.2, 0.36, -1.0, s * 0.3, 0); }
  for (let i = 0; i < 4; i++) part(head, CAP(), lt, 0.04, 0.12, 0.04, -0.06 + i * 0.04, -0.06, 0.06, 0.3);
  const claws = [-1, 1].map((s) => { const a = grp(hip, s * 0.6, 0.06, 0.38); part(a, CAP(), sh, 0.22, 0.34, 0.22, 0, 0, 0.22, Math.PI / 2, s * -0.3);
    const p = grp(a, s * -0.18, 0, 0.58); part(p, SPH(), sh, 0.5, 0.36, 0.62, 0, 0, 0.18); for (let i = 0; i < 4; i++) part(p, CON(), dk, 0.05, 0.08, 0.05, -0.12 + i * 0.08, 0.17, 0.12 + i * 0.04);
    part(p, CON(), lt, 0.16, 0.42, 0.14, s * -0.08, -0.06, 0.6, Math.PI / 2); const pin = grp(p, 0, 0.04, 0.32); part(pin, CON(), lt, 0.14, 0.42, 0.12, s * 0.12, 0, 0.24, Math.PI / 2); return { a, p, pin, s }; });
  const legs = []; for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const l = grp(hip, s * 0.62, -0.02, 0.12 - i * 0.3); part(l, CAP(), sh, 0.09, 0.42, 0.09, s * 0.24, 0.07, 0, 0, 0, s * (Math.PI / 2 - 0.4)); const kn = grp(l, s * 0.46, 0.17, 0); part(kn, CAP(), dk, 0.08, 0.5, 0.08, 0, -0.32, 0, 0, 0, s * 0.25); part(kn, CON(), dk, 0.06, 0.16, 0.06, s * 0.08, -0.62, 0, Math.PI); legs.push({ l, s, ph: i * 2 + (s > 0 ? 1 : 0) }); }
  const mouth = grp(head, 0, 0, 0.2), hand = grp(claws[1].p, 0, 0, 0.5), chest = grp(hip, 0, 0, 0.6);
  return { mouth, hand, chest, shadowK: 1.35,
    anim(t, dt, move, act, k) {
      const w = t * (7 + move * 4); for (const lg of legs) lg.l.rotation.y = Math.sin(w + lg.ph) * 0.4 * move; hip.position.y = 0.72 + Math.abs(Math.sin(w)) * 0.04 * move; hip.rotation.z = Math.sin(w) * 0.05 * move;
      for (const c of claws) { c.a.rotation.x = Math.sin(t * 1.5 + c.s) * 0.1; c.pin.rotation.y = c.s * (0.15 + Math.max(0, Math.sin(t * 2 + c.s)) * 0.3); } tail.forEach((s, i) => { s.rotation.x = Math.sin(t * 2 - i) * 0.08; });
      if (act === 'hit') { const s = S(k, 1); for (const c of claws) { c.a.rotation.x = -0.6 * s; c.pin.rotation.y = c.s * 0.6 * s; } }
      else if (act === 'cast') { const s = S(k, 1); for (const c of claws) c.a.rotation.x = -1.0 * s; hip.position.y += 0.2 * s; }
      else if (act === 'ko') koTip(body, k);
    } };
}

// ---------- the spider: a hairy body, a striped abdomen with an hourglass, eight jointed legs, fangs, a cluster of eyes ----------
function spiderHD(body, K) {
  const [blk, dark, stripe, , eyeC] = K.pal; const bk = M(blk), dk = M(dark), st = M(stripe), eye = M(eyeC, 'glow');
  const hip = grp(body, 0, 1.0, 0);
  part(hip, SPH(), bk, 0.84, 0.62, 0.86, 0, 0, 0.3); const abd = grp(hip, 0, 0.15, -0.55); part(abd, SPH(), bk, 1.35, 1.12, 1.6, 0, 0.1, -0.22);
  for (let i = 0; i < 3; i++) part(abd, TOR(), st, 1.05 - i * 0.25, 1.4 - i * 0.3, 0.5, 0, 0.12, -0.22 - i * 0.02, -0.3 - i * 0.45, 0, 0);
  part(abd, geo('hourglass', () => new THREE.ConeGeometry(0.5, 1, 3)), M(0xff2a2a, 'glow'), 0.18, 0.2, 0.06, 0, 0.66, -0.3, -1.2); part(abd, geo('hourglass', () => new THREE.ConeGeometry(0.5, 1, 3)), M(0xff2a2a, 'glow'), 0.18, 0.2, 0.06, 0, 0.6, -0.5, -1.9);
  for (let i = 0; i < 24; i++) { const a = i * 2.4, y = (i * 0.27) % 0.9 - 0.3; part(abd, CON(), dk, 0.04, 0.2, 0.04, Math.cos(a) * 0.62, 0.1 + y, -0.22 + Math.sin(a) * 0.72, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
  for (const [x, y, r] of [[-0.14, 0.12, 0.11], [0.14, 0.12, 0.11], [-0.26, 0.03, 0.08], [0.26, 0.03, 0.08], [-0.07, 0.22, 0.07], [0.07, 0.22, 0.07], [-0.2, 0.2, 0.05], [0.2, 0.2, 0.05]]) part(hip, SPH(), eye, r, r, r * 0.8, x, y, 0.7);
  const fangs = [-1, 1].map((s) => { const f = grp(hip, s * 0.12, -0.15, 0.64); part(f, SPH(), dk, 0.14, 0.18, 0.14, 0, 0, 0); part(f, CON(), M(0xe8e2d0), 0.07, 0.26, 0.07, 0, -0.18, 0.06, Math.PI - 0.3); return f; });
  const legs = []; for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const l = grp(hip, s * 0.32, 0.05, 0.45 - i * 0.22); l.rotation.y = s * (-0.6 + i * 0.4);
    part(l, SPH(), bk, 0.16, 0.16, 0.16, 0, 0, 0); part(l, CAP(), bk, 0.11, 0.8, 0.11, s * 0.42, 0.25, 0, 0, 0, s * -(Math.PI / 2 - 0.5)); const kn = grp(l, s * 0.82, 0.48, 0); part(kn, SPH(), st, 0.13, 0.13, 0.13, 0, 0, 0);
    part(kn, CAP(), bk, 0.09, 0.94, 0.09, s * 0.12, -0.5, 0, 0, 0, s * 0.25); part(kn, CON(), dk, 0.07, 0.18, 0.07, s * 0.24, -1.0, 0, Math.PI); legs.push({ l, s, ph: i + (s > 0 ? 0.5 : 0) }); }
  const mouth = grp(hip, 0, -0.1, 0.75), hand = grp(hip, 0, -0.2, 0.7), chest = grp(hip, 0, 0, 0.7);
  return { mouth, hand, chest, shadowK: 1.6,
    anim(t, dt, move, act, k) {
      const w = t * (8 + move * 4); for (const lg of legs) { lg.l.rotation.x = Math.sin(w + lg.ph * Math.PI) * 0.35 * move; lg.l.rotation.z = Math.max(0, Math.sin(w + lg.ph * Math.PI)) * 0.25 * move * lg.s; }
      hip.position.y = 1.0 + Math.sin(w * 2) * 0.03 * move; abd.rotation.x = Math.sin(t * 1.5) * 0.06; for (const f of fangs) f.rotation.x = Math.sin(t * 3) * 0.1;
      if (act === 'hit') { const s = S(k, 1); hip.rotation.x = -0.35 * s; for (const f of fangs) f.rotation.x = 0.8 * s; legs[0].l.rotation.x = legs[1].l.rotation.x = -0.8 * s; }
      else if (act === 'cast') { const s = S(k, 1); hip.rotation.x = 0.3 * s; abd.rotation.x = -0.7 * s; } else hip.rotation.x = 0;
      if (act === 'ko') { body.rotation.z = Math.min(Math.PI, k * 3); body.position.y = k * 0.6; }
    } };
}

// ---------- moths: a fuzzy body, feathery antennae, two pairs of patterned wings with veins ----------
function mothWing(front, m) { const s = new THREE.Shape(); if (front) { s.moveTo(0, 0); s.bezierCurveTo(0.4 * m, 0.55, 1.4 * m, 0.95, 1.95 * m, 0.45); s.bezierCurveTo(1.75 * m, -0.05, 1.0 * m, -0.32, 0, -0.12); } else { s.moveTo(0, -0.05); s.bezierCurveTo(0.5 * m, -0.1, 1.25 * m, -0.2, 1.35 * m, -0.68); s.bezierCurveTo(0.95 * m, -1.05, 0.3 * m, -0.62, 0, -0.25); } s.closePath(); return new THREE.ShapeGeometry(s, 16); }
function mothHD(body, K) {
  const [fuzz, wingC, edge, red, eyeC] = K.pal, dark = K.opt && K.opt.horn; const yel = dark ? 0xe8b82a : 0xffd24a; const fz = M(fuzz), eye = M(eyeC, 'glow'), leg = M(0x6a4a30);
  const hover = grp(body, 0, 1.6, 0);
  part(hover, SPH(), fz, 0.66, 0.58, 0.76, 0, 0, 0.1); for (let i = 0; i < 16; i++) { const a = i * 2.4; part(hover, SPH(), fz, 0.16, 0.12, 0.16, Math.cos(a) * 0.3, Math.sin(a) * 0.25, 0.1 + ((i * 0.37) % 0.6) - 0.3, Math.sin(a), 0, -Math.cos(a)); }
  const abd = grp(hover, 0, -0.05, -0.25); for (let i = 0; i < 5; i++) part(abd, SPH(), M(i % 2 ? (dark ? 0x3a3a5a : 0xd8c090) : fuzz), 0.5 - i * 0.07, 0.44 - i * 0.06, 0.38, 0, -0.04 * i, -0.24 * i);
  const head = grp(hover, 0, 0.08, 0.5); part(head, SPH(), fz, 0.4, 0.36, 0.36, 0, 0, 0);
  for (const x of [-0.14, 0.14]) part(head, SPH(), eye, 0.2, 0.22, 0.2, x, 0.04, 0.1);
  if (dark) part(head, CON(), M(0xe8b82a), 0.12, 0.6, 0.12, 0, 0.12, 0.3, 1.0);
  const ant = [-1, 1].map((s) => { const a = grp(head, s * 0.08, 0.15, 0.06); a.rotation.z = s * -0.35; a.rotation.x = 0.3; part(a, CAP(), leg, 0.025, 0.5, 0.025, 0, 0.25, 0); for (let i = 0; i < 6; i++) part(a, CAP(), leg, 0.015, 0.12, 0.015, s * 0.04, 0.12 + i * 0.07, 0, 0, 0, s * 1.0); return a; });
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) part(hover, CAP(), leg, 0.04, 0.4, 0.04, s * 0.24, -0.32, 0.22 - i * 0.18, 0.2, 0, s * 0.5);
  const mouth = grp(head, 0, 0.3, 0.2), hand = grp(hover, 0, -0.35, 0.2), chest = grp(hover, 0, 0, 0.4);
  const mk = (g, c, y) => { const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = y; return m; };
  const wings = []; for (const front of [true, false]) for (const s of [-1, 1]) { const piv = grp(hover, s * 0.2, 0.05, front ? 0.12 : -0.08); const w = grp(piv);
    const g = mothWing(front, s); const base = mk(g, wingC, 0), rim = mk(g, edge, -0.01); rim.scale.set(1.06, 1.08, 1); w.add(rim, base);
    for (const [cx, cz, r, c] of front ? [[1.35, -0.45, 0.24, edge], [1.35, -0.45, 0.15, red], [1.35, -0.45, 0.06, 0x111111], [0.7, -0.25, 0.12, yel]] : [[0.75, 0.45, 0.17, red], [0.75, 0.45, 0.07, 0x111111], [0.45, 0.25, 0.08, yel]]) { const d = new THREE.Mesh(geo('disc', () => new THREE.CircleGeometry(1, 18)), new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); d.scale.setScalar(r); d.rotation.x = -Math.PI / 2; d.position.set(cx * s, 0.012, cz); w.add(d); }
    for (const [x, y] of front ? [[1.85, 0.42], [1.3, 0.62], [1.5, -0.1], [0.9, -0.2]] : [[1.25, -0.6], [0.9, -0.85], [0.5, -0.55]]) rod(w, M(edge), V(0, 0.015, 0), V(s * x * 0.95, 0.015, -y * 0.95), 0.012);
    wings.push({ piv, front, s }); }
  return { mouth, hand, chest, shadowK: 1.3,
    anim(t, dt, move, act, k) {
      const sp = 5 + move * 4, f = Math.sin(t * sp);
      for (const w of wings) { w.piv.rotation.z = w.s * (0.25 + f * (w.front ? 0.65 : 0.5)); w.piv.rotation.y = w.s * (w.front ? 0.1 : -0.15); }
      hover.position.y = 1.6 + Math.sin(t * sp) * 0.08 + Math.sin(t * 1.1) * 0.1; hover.rotation.x = 0.12 * move; hover.rotation.z = 0; abd.rotation.x = Math.sin(t * 1.7) * 0.08; ant.forEach((a, i) => { a.rotation.x = 0.3 + Math.sin(t * 3 + i) * 0.15; });
      if (act === 'hit') { const s = S(k, 1); hover.rotation.x = 0.12 * move + 0.5 * s; hover.position.y -= 0.4 * s; }
      else if (act === 'cast') { const s = S(k, 1); for (const w of wings) w.piv.rotation.z = w.s * (0.25 - 0.4 * s); hover.position.y += 0.3 * s; }
      else if (act === 'ko') { hover.position.y = Math.max(0.2, 1.6 - k * 1.6); hover.rotation.z = k * 1.2; }
    } };
}

// ---------- winged flyers: a pterosaur (or a three-headed dragon), with finger-boned membrane wings ----------
function pteroHD(body, K) {
  const [skin, dark, belly, acc, eyeC] = K.pal, heads = (K.opt && K.opt.heads) || 1; const sk = M(skin), dk = M(dark), bl = M(belly), ac = M(acc), eye = M(eyeC, 'glow'), bone = M(0xe8e2d0);
  const hover = grp(body, 0, 1.8, 0);
  part(hover, CAP(), sk, 0.62, 0.62, 0.62, 0, 0, 0.02, Math.PI / 2); part(hover, SPH(), bl, 0.48, 0.26, 0.9, 0, -0.18, 0.05);
  const necks = []; const xs = heads === 3 ? [-0.35, 0, 0.35] : [0];
  for (const x of xs) { const n = grp(hover, x, 0.15, 0.42); n.rotation.x = -0.5; n.rotation.y = x * 0.6; part(n, CAP(), sk, 0.17, 0.62, 0.17, 0, 0, 0.32, Math.PI / 2); const h = grp(n, 0, 0, 0.72); h.rotation.x = 0.5;
    part(h, SPH(), sk, 0.28, 0.26, 0.36, 0, 0, 0.05); part(h, CON(), ac, 0.15, 0.62, 0.12, 0, -0.02, 0.4, Math.PI / 2); part(h, CON(), dk, 0.12, 0.5, 0.06, 0, -0.07, 0.36, Math.PI / 2);
    if (heads === 3) { for (const s of [-1, 1]) part(h, CON(), ac, 0.06, 0.32, 0.06, s * 0.1, 0.2, -0.1, -0.5); for (let i = 0; i < 4; i++) part(h, CON(), bone, 0.025, 0.06, 0.025, 0, -0.08, 0.2 + i * 0.07, Math.PI); } else part(h, geo('crest', () => new THREE.ConeGeometry(0.5, 1, 3)), ac, 0.1, 0.6, 0.3, 0, 0.12, -0.28, -1.2);
    for (const s of [-1, 1]) part(h, SPH(), eye, 0.06, 0.05, 0.05, s * 0.11, 0.05, 0.13); necks.push(n); }
  const mouth = grp(necks[(necks.length / 2) | 0], 0, 0, 1.15);
  const tails = (heads === 3 ? [-0.2, 0.2] : [0]).map((x) => { const tl = grp(hover, x, 0, -0.45); let p = tl; for (let i = 0; i < 4; i++) { part(p, SPH(), sk, 0.16 - i * 0.03, 0.16 - i * 0.03, 0.34, 0, 0, -0.14); p = grp(p, 0, 0, -0.26); } part(p, geo('crest', () => new THREE.ConeGeometry(0.5, 1, 3)), ac, 0.24, 0.3, 0.05, 0, 0, -0.05, Math.PI / 2); return tl; });
  const legs = [-1, 1].map((s) => { const l = grp(hover, s * 0.2, -0.28, -0.1); part(l, CAP(), dk, 0.08, 0.36, 0.08, 0, -0.2, 0); for (const c of [-1, 0, 1]) part(l, CON(), bone, 0.04, 0.14, 0.04, c * 0.06, -0.44, 0.08, Math.PI / 2 + 0.6); return l; });
  const wings = [-1, 1].map((s) => { const piv = grp(hover, s * 0.28, 0.15, 0.1); const shp = new THREE.Shape(); shp.moveTo(0, 0.25); shp.quadraticCurveTo(1.0 * s, 0.5, 1.5 * s, 0.38); shp.lineTo(2.5 * s, 0.05); shp.quadraticCurveTo(2.1 * s, -0.15, 1.75 * s, -0.4); shp.quadraticCurveTo(1.4 * s, -0.15, 1.0 * s, -0.3); shp.quadraticCurveTo(0.7 * s, -0.25, 0.42 * s, -0.55); shp.quadraticCurveTo(0.2 * s, -0.4, 0, -0.42); shp.closePath();
    const wm = new THREE.Mesh(new THREE.ShapeGeometry(shp, 10), new THREE.MeshLambertMaterial({ color: heads === 3 ? acc : skin, side: THREE.DoubleSide })); wm.rotation.x = -Math.PI / 2; piv.add(wm);
    const arm = grp(piv); for (const [x0, y0, x1, y1, r] of [[0, 0.25, 1.5, 0.38, 0.06], [1.5, 0.38, 2.5, 0.05, 0.045], [1.5, 0.38, 1.75, -0.4, 0.028], [1.5, 0.38, 1.0, -0.3, 0.028]]) rod(arm, dk, V(s * x0, 0.02, -y0), V(s * x1, 0.02, -y1), r);
    part(arm, CON(), bone, 0.05, 0.16, 0.05, s * 1.5, 0.04, -0.46, -Math.PI / 2); return { piv, s }; });
  const hand = grp(hover, 0, -0.5, 0.2), chest = grp(hover, 0, 0, 0.6);
  return { mouth, hand, chest, shadowK: heads === 3 ? 1.6 : 1.3,
    anim(t, dt, move, act, k) {
      const f = Math.sin(t * (3.5 + move * 2.5)); for (const w of wings) w.piv.rotation.z = w.s * (0.15 + f * 0.6);
      hover.position.y = 1.8 - f * 0.12 + Math.sin(t * 1.2) * 0.1; hover.rotation.x = 0.15 * move; hover.rotation.z = 0;
      necks.forEach((n, i) => { n.rotation.y = (i - (necks.length - 1) / 2) * 0.5 + Math.sin(t * 2 + i * 2) * 0.15; }); tails.forEach((tl, i) => { tl.rotation.y = Math.sin(t * 2.5 + i) * 0.3; }); for (const l of legs) l.rotation.x = 0.4 + Math.sin(t * 2) * 0.1;
      if (act === 'hit') { const s = S(k, 1); hover.rotation.x = 0.6 * s; hover.position.y -= 0.5 * s; for (const n of necks) n.rotation.x = -0.5 + 0.6 * s; }
      else if (act === 'cast') { const s = S(k, 1); for (const w of wings) w.piv.rotation.z = w.s * (0.15 - 0.5 * s); for (const n of necks) n.rotation.x = -0.5 - 0.3 * s; }
      else for (const n of necks) n.rotation.x = -0.5;
      if (act === 'ko') { hover.position.y = Math.max(0.3, 1.8 - k * 1.8); hover.rotation.z = k * 1.3; }
    } };
}

// ---------- the blob: glossy lumps that ooze, bubbles, two slit eyes, a dribbling mouth ----------
function blobHD(body, K) {
  const [skin, dark, light, slime, eyeC] = K.pal; const gl = (c) => { const k = c + 'gloss'; if (!mats.has(k)) mats.set(k, new THREE.MeshPhongMaterial({ color: c, shininess: 90, specular: 0x88aa66 })); return mats.get(k); };
  const core = grp(body); const lumps = [];
  for (const [x, y, z, s, c] of [[0, 0.7, 0, 1.45, skin], [0.28, 1.4, 0.1, 0.95, skin], [-0.32, 1.25, -0.1, 0.85, dark], [0, 1.95, 0.05, 0.75, skin], [0.42, 0.5, -0.3, 0.72, dark], [-0.46, 0.45, 0.3, 0.68, light], [0.5, 1.0, 0.35, 0.5, light], [-0.55, 0.95, -0.4, 0.55, skin], [0.1, 0.3, 0.6, 0.6, dark]]) lumps.push(part(core, SPH(), gl(c), s, s * 0.9, s, x, y, z));
  for (let i = 0; i < 10; i++) { const a = i * 2.4, y = 0.4 + (i * 0.33) % 1.5; part(core, SPH(), gl(light), 0.12, 0.12, 0.12, Math.cos(a) * 0.68, y, Math.sin(a) * 0.62); }
  for (const s of [-1, 1]) { part(core, SPH(), M(0xf0e070), 0.32, 0.4, 0.2, s * 0.17, 1.72, 0.4); part(core, geo('oct', () => new THREE.OctahedronGeometry(0.5, 0)), M(eyeC, 'glow'), 0.14, 0.42, 0.1, s * 0.17, 1.72, 0.48, 0, 0, s * 0.15); }
  part(core, SPH(), M(0x2a1a14), 0.5, 0.14, 0.18, 0, 1.35, 0.6); for (let i = 0; i < 5; i++) part(core, CON(), M(0xd8d0a0), 0.05, 0.1, 0.05, -0.16 + i * 0.08, 1.4, 0.68, Math.PI);
  const drips = []; for (let i = 0; i < 8; i++) { const d = part(core, SPH(), M(slime, 'glow'), 0.12, 0.22, 0.12, Math.cos(i) * 0.62, 0.6, Math.sin(i) * 0.62); drips.push({ d, ph: i }); }
  const mouth = grp(core, 0, 1.4, 0.62), hand = grp(core, 0, 1.0, 0.6), chest = grp(core, 0, 1.0, 0.6);
  return { mouth, hand, chest, shadowK: 1.35,
    anim(t, dt, move, act, k) {
      const w = t * (3 + move * 3); core.scale.set(1 + Math.sin(w) * 0.08, 1 - Math.sin(w) * 0.08, 1 + Math.sin(w) * 0.08); lumps.forEach((l, i) => { l.position.y += Math.sin(t * 2 + i) * 0.002; });
      for (const d of drips) { const k2 = ((t * 0.6 + d.ph * 0.17) % 1); d.d.position.y = 0.9 - k2 * 0.9; d.d.scale.set(0.12 * (1 - k2 * 0.5), 0.22 * (1 - k2 * 0.3), 0.12 * (1 - k2 * 0.5)); }
      if (act === 'hit') { const s = S(k, 1); core.scale.set(1 + 0.3 * s, 1 - 0.25 * s, 1 + 0.3 * s); }
      else if (act === 'cast') { const s = S(k, 1); core.scale.set(1 - 0.15 * s, 1 + 0.3 * s, 1 - 0.15 * s); }
      else if (act === 'ko') core.scale.set(1 + k, Math.max(0.15, 1 - k), 1 + k);
    } };
}

// ---------- the plant: a toothy bloom of curled petals on a tapering stalk with leaves, thorny vines writhing round its roots ----------
function plantHD(body, K) {
  const [green, dark, red, teeth, light] = K.pal; const gr = M(green), dk = M(dark), rd = M(red), th = M(teeth), lt = M(light);
  const base = grp(body); part(base, SPH(), dk, 1.7, 0.62, 1.7, 0, 0.18, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(base, CAP(), dk, 0.12, 0.5, 0.12, Math.cos(a) * 0.75, 0.08, Math.sin(a) * 0.75, Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3); }
  const stalk = grp(base, 0, 0.4, 0); part(stalk, geo('stalk', () => new THREE.CylinderGeometry(0.15, 0.24, 1, 12)), gr, 1, 1.25, 1, 0, 0.62, 0);
  const leafG = geo('leaf', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.3, 0.2, 0.7, 0); s.quadraticCurveTo(0.3, -0.2, 0, 0); return new THREE.ShapeGeometry(s, 8); });
  for (const [y, a] of [[0.45, 0.3], [0.8, 2.4], [1.0, 4.4]]) { const lf = new THREE.Mesh(leafG, new THREE.MeshLambertMaterial({ color: light, side: THREE.DoubleSide })); lf.position.set(0, y, 0); lf.rotation.set(-0.5, a, 0.4); stalk.add(lf); }
  const head = grp(stalk, 0, 1.35, 0.1); head.rotation.x = 0.5;
  const petalG = geo('petal', () => { const s = new THREE.Shape(); s.moveTo(-0.18, 0); s.quadraticCurveTo(-0.3, 0.45, 0, 0.62); s.quadraticCurveTo(0.3, 0.45, 0.18, 0); s.lineTo(-0.18, 0); return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }); });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const p = new THREE.Mesh(petalG, i % 2 ? gr : lt); p.position.set(Math.cos(a) * 0.32, Math.sin(a) * 0.32, -0.08); p.rotation.set(0, 0, a - Math.PI / 2); p.rotateX(-0.5); head.add(p); }
  const jawT = grp(head, 0, 0.12, 0.05), jawB = grp(head, 0, -0.12, 0.05); part(jawT, SPH(), rd, 0.74, 0.34, 0.64, 0, 0.1, 0.25); part(jawB, SPH(), rd, 0.74, 0.34, 0.64, 0, -0.1, 0.25);
  for (const j of [jawT, jawB]) for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.275; part(j, CON(), th, 0.05, 0.16, 0.05, Math.sin(a) * 0.32, j === jawT ? -0.04 : 0.04, 0.25 + Math.cos(a) * 0.28, j === jawT ? Math.PI : 0); }
  for (let i = 0; i < 6; i++) part(jawT, SPH(), lt, 0.06, 0.06, 0.06, -0.25 + i * 0.1, 0.24, 0.3);
  const vines = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; let prev = grp(base, Math.cos(a) * 0.6, 0.3, Math.sin(a) * 0.6); prev.rotation.y = -a + Math.PI / 2; const segs = [];
    for (let j = 0; j < 5; j++) { const s = 1 - j * 0.15; part(prev, CAP(), j % 2 ? gr : lt, 0.15 * s, 0.32, 0.15 * s, 0, 0, 0.18, Math.PI / 2); part(prev, CON(), rd, 0.04, 0.1, 0.04, 0, 0.08 * s, 0.18); segs.push(prev); prev = grp(prev, 0, 0, 0.34); }
    part(prev, SPH(), rd, 0.22, 0.16, 0.26, 0, 0, 0.1); vines.push({ segs, ph: i }); }
  const mouth = grp(head, 0, 0, 0.6), hand = grp(head, 0, 0, 0.6), chest = grp(stalk, 0, 1.2, 0.4);
  return { mouth, hand, chest, shadowK: 1.5,
    anim(t, dt, move, act, k) {
      for (const v of vines) v.segs.forEach((s, j) => { s.rotation.x = Math.sin(t * 2 + v.ph + j * 0.7) * 0.35 - 0.15; s.rotation.y = Math.sin(t * 1.6 + v.ph * 2 + j) * 0.3 * (1 + move); });
      stalk.rotation.x = Math.sin(t * 1.2) * 0.08 + move * 0.15; stalk.rotation.z = Math.sin(t * 0.9) * 0.08; jawT.rotation.x = -0.15 - Math.max(0, Math.sin(t * 1.4)) * 0.15; jawB.rotation.x = 0.15 + Math.max(0, Math.sin(t * 1.4)) * 0.15;
      if (act === 'hit') { const s = S(k, 1); stalk.rotation.x = 0.6 * s; jawT.rotation.x = -0.7 * s; jawB.rotation.x = 0.7 * s; }
      else if (act === 'cast') { const s = S(k, 1); stalk.rotation.x = -0.3 * s; head.scale.setScalar(1 + 0.3 * s); } else head.scale.setScalar(1);
      if (act === 'ko') stalk.rotation.x = Math.min(1.4, k * 2);
    } };
}

// ---------- MIKE FERGUSON THE BOUNTY HUNTER: a giant man in a black tactical vest (MOLLE webbing, pouches, a flag patch, a red
// name tape and a BOUNTY HUNTER tab, a yellow taser), black tee, cargo pants with knee pads and boots, sleeve tattoos,
// studded fingerless gloves, a white beard and a grey buzz cut, dragging a sledgehammer. pal: [gear, tee, skin, patch, eyes] ----------
const texs = new Map();
function canvasTex(key, w, h, draw) { if (!texs.has(key)) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texs.set(key, t); } return texs.get(key); }
const texMat = (key, color, tex) => { const k = 'tx' + key + color; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color, map: tex })); return mats.get(k); };
// full-sleeve tattoos: dense black linework with teal, red and gold fills, wrapping round the arm
const tattooTex = () => canvasTex('tattoo', 256, 256, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); let r = 7; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 34; i++) { const x = rnd() * w, y = rnd() * h, s = 14 + rnd() * 34; g.fillStyle = ['#2a8a8a', '#a8322a', '#c89a2a', '#3a5aa8', '#2a2a2a'][i % 5]; g.globalAlpha = 0.32; g.beginPath(); g.ellipse(x, y, s, s * 0.6, rnd() * 3, 0, 7); g.fill(); g.globalAlpha = 1; }
  g.strokeStyle = '#141414'; g.lineCap = 'round'; for (let i = 0; i < 30; i++) { g.lineWidth = 1.5 + rnd() * 2.5; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.bezierCurveTo(x + rnd() * 80 - 40, y + rnd() * 80 - 40, x + rnd() * 80 - 40, y + rnd() * 80 - 40, x + rnd() * 90 - 45, y + rnd() * 90 - 45); g.stroke(); }
  for (let i = 0; i < 8; i++) { const x = rnd() * w, y = rnd() * h; g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 6; a++) g.lineTo(x + Math.cos(a * 2.5) * 16, y + Math.sin(a * 2.5) * 16); g.closePath(); g.stroke(); } });
const flagTex = () => canvasTex('flag', 96, 60, (g, w, h) => { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f4f0e6' : '#b8282e'; g.fillRect(0, i * h / 13, w, h / 13 + 1); } g.fillStyle = '#26306a'; g.fillRect(0, 0, w * 0.42, h * 0.54); g.fillStyle = '#f4f0e6'; for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) g.fillRect(3 + x * 6.4 + (y % 2) * 3, 3 + y * 6, 2, 2); g.strokeStyle = '#d8c070'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); });
const tabTex = (txt, bg, fg, key) => canvasTex(key, 256, 64, (g, w, h) => { g.fillStyle = bg; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 14); g.fill(); g.strokeStyle = '#dcdcdc'; g.lineWidth = 4; g.stroke(); g.fillStyle = fg; g.font = 'bold 34px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2, w - 24); });
const BOX = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
const PLN = () => geo('pln', () => new THREE.PlaneGeometry(1, 1));
const DOME = () => geo('dome', () => new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45));
function mikeHD(body, K) {
  const [gearC, teeC, skinC, patchC, eyeC] = K.pal;
  const gear = M(gearC), tee = M(teeC), skin = M(skinC), web = M(lerpC(gearC, 0x8a8a90, 0.18)), black = M(0x0c0c10), boot = M(0x141418, 'metal'), steel = M(0x9aa0a8, 'metal'), silver = M(0xc8ccd2, 'metal'),
    beard = M(0xece8e0), beardG = M(0xb8b4ac), stubble = M(0x8a8884), eyeW = M(0xf2f0ea), iris = M(eyeC), lip = M(lerpC(skinC, 0x6a2a2a, 0.35)), yellow = M(0xf0c81a), wood = M(0x2a2420), pad = M(0x26272c, 'metal');
  const tat = texMat('tat', skinC, tattooTex()), flag = texMat('flag', 0xffffff, flagTex()), nameTab = texMat('name', 0xffffff, tabTex('MIKE', '#' + new THREE.Color(patchC).getHexString(), '#111', 'name' + patchC)), bhTab = texMat('bh', 0xffffff, tabTex('BOUNTY HUNTER', '#3a3a3e', '#e8e8e8', 'bh'));
  // legs: cargo pants with thigh pockets, knee pads, laced boots
  const hip = grp(body, 0, 1.0, 0);
  part(hip, SPH(), gear, 0.6, 0.32, 0.4, 0, -0.05, 0); part(hip, CYL(), black, 0.62, 0.08, 0.42, 0, 0.03, 0); part(hip, RBX(), silver, 0.09, 0.07, 0.03, 0, 0.03, 0.21);
  for (const s of [-1, 1]) { part(hip, RBX(), web, 0.11, 0.11, 0.07, s * 0.23, -0.02, 0.18); part(hip, BOX(), black, 0.05, 0.04, 0.08, s * 0.3, 0.03, -0.15); } // belt pouches, loops
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.17, -0.06, 0);
    part(l, CAP(), gear, 0.3, 0.24, 0.31, 0, -0.24, 0); part(l, RBX(), web, 0.06, 0.16, 0.14, s * 0.15, -0.28, 0.01); part(l, BOX(), gear, 0.065, 0.04, 0.15, s * 0.15, -0.2, 0.01); // cargo pocket + flap
    const k = grp(l, 0, -0.48, 0);
    part(k, RBX(), pad, 0.24, 0.22, 0.1, 0, -0.02, 0.135); part(k, CYL(), black, 0.27, 0.03, 0.28, 0, 0.06, 0); part(k, CYL(), black, 0.26, 0.03, 0.27, 0, -0.1, 0); // knee pad + straps
    part(k, CAP(), gear, 0.25, 0.19, 0.27, 0, -0.2, 0);
    const ft = grp(k, 0, -0.42, 0); part(ft, CYL(), boot, 0.26, 0.13, 0.28, 0, 0.06, 0); part(ft, RBX(), boot, 0.27, 0.14, 0.4, 0, -0.03, 0.06); part(ft, RBX(), black, 0.29, 0.045, 0.43, 0, -0.1, 0.06);
    for (let i = 0; i < 3; i++) part(ft, BOX(), silver, 0.12, 0.014, 0.014, 0, 0.0 + i * 0.04, 0.17 - i * 0.025); // laces
    return { l, k }; });
  // torso: black tee under a plate-carrier vest
  const torso = grp(hip, 0, 0.06, 0); const tb = grp(torso); tb.scale.set(1.16, 1, 1.14);
  part(tb, SPH(), tee, 0.58, 0.62, 0.38, 0, 0.36, 0); part(tb, SPH(), tee, 0.74, 0.3, 0.38, 0, 0.6, 0);
  part(tb, RBX(), gear, 0.56, 0.5, 0.38, 0, 0.32, 0);
  for (const s of [-1, 1]) { part(tb, RBX(), gear, 0.13, 0.08, 0.38, s * 0.17, 0.6, 0); part(tb, BOX(), black, 0.04, 0.26, 0.02, s * 0.26, 0.42, 0.19); } // shoulder straps, side straps
  for (let i = 0; i < 6; i++) { const y = 0.12 + i * 0.065; part(tb, BOX(), web, 0.5, 0.016, 0.012, 0, y, 0.192); part(tb, BOX(), web, 0.5, 0.016, 0.012, 0, y, -0.192); } // MOLLE rows, front and back
  for (let i = 0; i < 4; i++) part(tb, RBX(), web, 0.11, 0.13, 0.06, -0.19 + i * 0.125, 0.15, 0.215); // magazine pouches
  for (let i = 0; i < 4; i++) part(tb, BOX(), gear, 0.115, 0.04, 0.066, -0.19 + i * 0.125, 0.205, 0.217);
  part(tb, BOX(), silver, 0.012, 0.42, 0.012, 0, 0.36, 0.195); // zip
  for (const y of [0.3, 0.4]) { part(tb, BOX(), black, 0.24, 0.035, 0.012, 0, y, 0.2); part(tb, BOX(), silver, 0.05, 0.045, 0.016, -0.05, y, 0.205); part(tb, BOX(), silver, 0.05, 0.045, 0.016, 0.05, y, 0.205); } // chest straps + buckles
  part(tb, PLN(), flag, 0.13, 0.08, 1, -0.15, 0.47, 0.192); part(tb, PLN(), nameTab, 0.14, 0.04, 1, 0.15, 0.49, 0.192); part(tb, PLN(), bhTab, 0.17, 0.045, 1, 0.14, 0.4, 0.21);
  part(tb, RBX(), yellow, 0.035, 0.08, 0.035, -0.08, 0.34, 0.225); part(tb, RBX(), black, 0.04, 0.025, 0.04, -0.08, 0.385, 0.225); // taser
  part(tb, RBX(), web, 0.1, 0.07, 0.05, 0.12, 0.27, 0.215); // radio pouch
  const chest = grp(torso, 0, 0.4, 0.24);
  // head: buzz cut, heavy brows, big white beard
  const neck = grp(torso, 0, 0.72, 0.02); part(neck, CAP(), skin, 0.17, 0.07, 0.17, 0, 0.02, 0);
  const head = grp(neck, 0, 0.19, 0.01);
  part(head, SPH(), skin, 0.3, 0.34, 0.32, 0, 0.02, 0); part(head, DOME(), stubble, 0.31, 0.33, 0.33, 0, 0.04, -0.012, -0.3);
  for (const s of [-1, 1]) { part(head, SPH(), skin, 0.05, 0.08, 0.05, s * 0.15, 0.0, -0.01); // ears
    part(head, BOX(), beardG, 0.09, 0.022, 0.03, s * 0.065, 0.075, 0.148, 0, 0, s * 0.22); // brows, angled into a scowl
    part(head, SPH(), eyeW, 0.05, 0.03, 0.02, s * 0.062, 0.042, 0.146); part(head, SPH(), iris, 0.022, 0.024, 0.012, s * 0.06, 0.042, 0.155); part(head, SPH(), skin, 0.06, 0.02, 0.025, s * 0.062, 0.022, 0.145); } // eyes + bags
  part(head, SPH(), skin, 0.06, 0.085, 0.07, 0, 0.0, 0.17); part(head, SPH(), skin, 0.075, 0.035, 0.045, 0, -0.03, 0.17); // nose
  part(head, SPH(), skin, 0.2, 0.08, 0.06, 0, 0.11, 0.135); // brow ridge
  part(head, SPH(), beard, 0.15, 0.045, 0.06, 0, -0.065, 0.16); part(head, SPH(), beardG, 0.06, 0.03, 0.04, 0, -0.07, 0.178); // moustache
  part(head, BOX(), lip, 0.07, 0.014, 0.02, 0, -0.09, 0.15);
  const jaw = grp(head, 0, -0.1, 0.03);
  part(jaw, SPH(), beard, 0.27, 0.19, 0.22, 0, -0.03, 0.04); part(jaw, SPH(), beard, 0.19, 0.17, 0.15, 0, -0.1, 0.08);
  for (const s of [-1, 1]) { part(jaw, SPH(), beard, 0.08, 0.17, 0.13, s * 0.13, 0.06, -0.02); part(jaw, SPH(), beardG, 0.06, 0.1, 0.08, s * 0.08, -0.08, 0.1); }
  for (let i = 0; i < 7; i++) part(jaw, CON(), i % 2 ? beard : beardG, 0.05, 0.08, 0.05, -0.09 + i * 0.03, -0.17 + Math.abs(i - 3) * 0.008, 0.08, Math.PI, 0, 0); // wispy beard ends
  const mouth = grp(head, 0, -0.1, 0.2);
  // arms: tee sleeves, tattooed sleeves, studded fingerless gloves; the right hand drags a sledgehammer
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.45, 0.6, 0);
    part(a, SPH(), tee, 0.31, 0.29, 0.31, 0, -0.02, 0); part(a, CAP(), tee, 0.28, 0.09, 0.28, 0, -0.11, 0);
    part(a, CAP(), tat, 0.23, 0.15, 0.23, 0, -0.24, 0); part(a, SPH(), tat, 0.22, 0.17, 0.2, 0, -0.2, 0.03); // shoulder-to-elbow ink + bicep
    const el = grp(a, 0, -0.41, 0); part(el, SPH(), tat, 0.2, 0.17, 0.2, 0, 0, 0); part(el, CAP(), tat, 0.21, 0.15, 0.2, 0, -0.18, 0.01);
    const fist = grp(el, 0, -0.39, 0.02);
    part(fist, BOX(), black, 0.19, 0.045, 0.18, 0, 0.07, 0); // wrist strap
    part(fist, RBX(), black, 0.18, 0.15, 0.15, 0, -0.02, 0); part(fist, SPH(), skin, 0.05, 0.05, 0.05, s * -0.07, -0.02, 0.05); // glove + thumb
    for (let i = 0; i < 4; i++) { part(fist, CAP(), skin, 0.04, 0.035, 0.05, -0.06 + i * 0.04, -0.11, 0.045); part(fist, SPH(), silver, 0.035, 0.035, 0.035, -0.06 + i * 0.04, -0.035, 0.08); } // fingertips, knuckle studs
    if (s > 0) part(fist, TOR(), black, 0.17, 0.17, 0.35, 0, 0.11, 0, Math.PI / 2); // bead bracelet
    return { a, el, fist }; });
  const ham = grp(arms[0].fist, 0, -0.03, 0.02); ham.rotation.x = 0.15;
  part(ham, CYL(), wood, 0.065, 0.82, 0.065, 0, -0.32, 0); part(ham, CYL(), black, 0.08, 0.16, 0.08, 0, 0.0, 0); // handle + grip
  part(ham, RBX(), steel, 0.19, 0.19, 0.44, 0, -0.76, 0.02); for (const z of [-0.2, 0.24]) part(ham, CYL(), silver, 0.19, 0.04, 0.19, 0, -0.76, z, Math.PI / 2); // sledge head, striking faces
  const hand = grp(ham, 0, -0.76, 0.05);
  return { mouth, hand, chest, hammer: ham,
    anim(t, dt, move, act, k) {
      const w = t * (4.4 + move * 2), sw = Math.sin(w) * 0.55 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; legs[0].k.rotation.x = Math.max(0, -Math.sin(w)) * 0.7 * move; legs[1].k.rotation.x = Math.max(0, Math.sin(w)) * 0.7 * move;
      arms[0].a.rotation.set(-0.1 - sw * 0.4, 0, -0.12); arms[1].a.rotation.set(-0.1 + sw * 0.8, 0, 0.1); arms[0].el.rotation.x = -0.25; arms[1].el.rotation.x = -0.35 - Math.abs(sw) * 0.3;
      hip.position.y = 1.0 + Math.abs(Math.sin(w)) * 0.05 * move; torso.rotation.set(0.06 * move + Math.sin(t * 1.3) * 0.015, Math.sin(w) * 0.08 * move, 0); neck.rotation.x = -0.04; jaw.rotation.x = 0; head.rotation.y = Math.sin(t * 0.5) * 0.15 * (1 - move);
      if (act === 'hit') { // sledgehammer overhead, then SLAM
        const up = k < 0.45 ? k / 0.45 : Math.max(0, 1 - (k - 0.45) / 0.15), down = k < 0.45 ? 0 : k < 0.6 ? (k - 0.45) / 0.15 : Math.max(0, 1 - (k - 0.6) / 0.4);
        arms[0].a.rotation.x = -0.1 - 3.0 * up - 1.4 * down; arms[0].el.rotation.x = -0.25 - 0.6 * up; arms[1].a.rotation.x = -0.1 - 1.0 * up - 1.2 * down;
        torso.rotation.x = -0.25 * up + 0.45 * down; jaw.rotation.x = 0.35 * down; }
      else if (act === 'win') { const s = Math.min(1, k * 5) * Math.min(1, (1 - k) * 4); // both hands in the air
        for (const [i, d] of [[0, -1], [1, 1]]) { arms[i].a.rotation.set(-2.95 * s, 0, d * 0.3 * s); arms[i].el.rotation.x = -0.15 * s; } torso.rotation.x = -0.15 * s; neck.rotation.x = -0.35 * s; jaw.rotation.x = 0.45 * s; }
      else if (act === 'cast') { const s = S(k, 1), shake = Math.sin(k * Math.PI * 10) * 0.12 * s; // the snarl and claw-hands flex
        for (const [i, d] of [[0, -1], [1, 1]]) { arms[i].a.rotation.set(-1.0 * s + shake, 0, d * 0.7 * s); arms[i].el.rotation.x = -1.7 * s; }
        torso.rotation.x = 0.2 * s; neck.rotation.x = 0.15 * s; jaw.rotation.x = 0.4 * s; }
      else if (act === 'ko') { body.rotation.x = -Math.min(1.5, k * 2); body.position.y = -k * 0.2; }
    } };
}

// merge the meshes that sit still together inside each moving group (same material -> one mesh), so a detailed monster
// costs about as many draw calls as a blocky one
function mergeStatic(root) { const groups = []; root.traverse((o) => { if (!o.isMesh) groups.push(o); });
  for (const g of groups) { const by = new Map(); for (const ch of g.children) if (ch.isMesh) { if (!by.has(ch.material)) by.set(ch.material, []); by.get(ch.material).push(ch); }
    for (const [m, list] of by) { if (list.length < 2) continue; const gs = list.map((ch) => { ch.updateMatrix(); const gg = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone(); for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k); return gg.applyMatrix4(ch.matrix); });
      const merged = mergeGeometries(gs, false); if (!merged) continue; for (const ch of list) g.remove(ch); g.add(new THREE.Mesh(merged, m)); } } }
const withMerge = (fn) => (body, K) => { const r = fn(body, K); mergeStatic(body); return r; };
export const HD = { biped: withMerge(bipedHD), squid: withMerge(squidHD), robot: withMerge(robotHD), ape: withMerge(apeHD), quad: withMerge(quadHD), crab: withMerge(crabHD), spider: withMerge(spiderHD), moth: withMerge(mothHD), ptero: withMerge(pteroHD), blob: withMerge(blobHD), plant: withMerge(plantHD), human: withMerge(mikeHD) };
