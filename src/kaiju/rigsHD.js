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
const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

// ---------- the lizard: Godzilly ----------
function bipedHD(body, K) {
  const [skin, dark, belly, acc, eyeC] = K.pal, o = K.opt || {};
  const sk = M(skin), dk = M(dark), bl = M(belly), bone = M(0xe8e2d0), eye = M(eyeC, 'glow'), black = M(0x0a0a0e);
  const plateM = o.glow ? M(acc, 'glow') : M(acc);
  const hip = grp(body, 0, 0.95, 0); const torso = grp(hip, 0, 0.02, 0); torso.rotation.x = 0.28;
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
  // arms with three hooked claws
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.42, 0.74, 0.18); part(a, SPH(), sk, 0.26, 0.26, 0.26, 0, 0, 0); part(a, CAP(), sk, 0.15, 0.22, 0.15, 0, -0.15, 0.05, -0.4);
    const fa = grp(a, 0, -0.3, 0.12); part(fa, CAP(), sk, 0.13, 0.2, 0.13, 0, -0.08, 0.06, -0.9); const h = grp(fa, 0, -0.14, 0.2); part(h, SPH(), sk, 0.15, 0.12, 0.15);
    for (const c of [-1, 0, 1]) part(h, CON(), bone, 0.035, 0.12, 0.035, c * 0.05, -0.06, 0.06, 2.2); return { a, fa }; });
  const hand = grp(arms[1].fa, 0, -0.2, 0.25);
  // legs: big thighs, shins and clawed feet
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.33, 0, 0); part(l, SPH(), sk, 0.42, 0.62, 0.48, 0, -0.18, 0.02); const k = grp(l, 0, -0.44, 0.04);
    part(k, CAP(), sk, 0.27, 0.26, 0.27, 0, -0.16, -0.03); const f = grp(k, 0, -0.42, 0.06); part(f, SPH(), dk, 0.36, 0.14, 0.5, 0, 0, 0.06);
    for (const c of [-1, 0, 1]) part(f, CON(), bone, 0.05, 0.14, 0.05, c * 0.11, -0.02, 0.32, Math.PI / 2); return { l, k }; });
  // tail: tapering segments, plates down the first ones
  const tail = []; { let prev = grp(hip, 0, 0.0, -0.36); for (let i = 0; i < 9; i++) { const s = 1 - i * 0.095; part(prev, SPH(), i % 2 ? sk : lerpC(skin, dark, 0.25) === skin ? sk : M(lerpC(skin, dark, 0.2)), 0.44 * s, 0.4 * s, 0.4, 0, 0, -0.16); tail.push(prev); prev = grp(prev, 0, -0.012, -0.3); } }
  // the jagged back plates: three rows down the spine and along the tail, glowing if the kaiju glows
  const glowMat = plateM, glow0 = plateM.color.clone();
  if (o.plates !== false) {
    for (let i = 0; i < 6; i++) { const y = 1.05 - i * 0.17, z = -0.3 + i * 0.012, sc = 0.38 - Math.abs(i - 1.5) * 0.05; part(torso, PLATE(), glowMat, sc, sc * 1.2, 1, 0, y, z, -0.55, Math.PI / 2, 0);
      for (const s of [-1, 1]) part(torso, PLATE(), glowMat, sc * 0.6, sc * 0.75, 1, s * 0.14, y - 0.06, z + 0.02, -0.55, Math.PI / 2 + s * 0.25, 0); }
    tail.slice(0, 7).forEach((seg, i) => part(seg, PLATE(), glowMat, 0.26 - i * 0.03, 0.3 - i * 0.035, 1, 0, 0.12 - i * 0.01, -0.16, 0, Math.PI / 2, 0)); }
  const chest = grp(torso, 0, 0.8, 0.3);
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (5.5 + move * 2), sw = Math.sin(w) * 0.55 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; legs[0].k.rotation.x = Math.max(0, -Math.sin(w)) * 0.6 * move; legs[1].k.rotation.x = Math.max(0, Math.sin(w)) * 0.6 * move;
      hip.position.y = 0.95 + Math.abs(Math.sin(w)) * 0.05 * move; hip.rotation.z = Math.sin(w) * 0.05 * move; torso.rotation.x = 0.28 + Math.sin(t * 1.6) * 0.02;
      arms[0].a.rotation.x = -sw * 0.4; arms[1].a.rotation.x = sw * 0.4; tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 2.2 - i * 0.6) * (0.1 + move * 0.07); s.rotation.x = 0.04; });
      neck.rotation.x = 0; head.rotation.y = Math.sin(t * 0.7) * 0.12; jaw.rotation.x = 0.06 + Math.sin(t * 1.3) * 0.04; let glowK = 0;
      if (act === 'hit') { const s = S(k, 1); neck.rotation.x = 0.45 * s; torso.rotation.x += 0.2 * s; jaw.rotation.x = 0.5 * s; arms[1].a.rotation.x = -1.6 * s; }
      else if (act === 'cast') { const s = S(k, 1); neck.rotation.x = -0.45 * s; jaw.rotation.x = 0.8 * s; glowK = s; arms[0].a.rotation.z = -0.4 * s; arms[1].a.rotation.z = 0.4 * s; }
      else { arms[0].a.rotation.z = arms[1].a.rotation.z = 0; if (act === 'ko') koTip(body, k); }
      if (o.glow) glowMat.color.copy(glow0).multiplyScalar(1 + glowK * 1.2 + Math.sin(t * 3) * 0.08);
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

// ---------- the truck robot: Optimus Grime ----------
function robotHD(body, K) {
  const [main, legC, trim, acc, eyeC] = K.pal;
  const red = M(main, 'metal'), blue = M(legC, 'metal'), silver = M(trim, 'metal'), dark = M(0x1a1a22, 'metal'), tire = M(0x16161a), glass = M(0x7ac8ff, 'glow'), eye = M(eyeC, 'glow');
  const line = (p, w, h, x, y, z) => part(p, RBX(), dark, w, h, 0.02, x, y, z);
  const hip = grp(body, 0, 1.0, 0); const torso = grp(hip, 0, 0.1, 0);
  part(hip, RBX(), silver, 0.62, 0.22, 0.42, 0, 0, 0); part(hip, RBX(), blue, 0.24, 0.2, 0.44, 0, -0.02, 0.02);
  // waist with a radiator grille, chest with two truck windows, panel lines
  part(torso, RBX(), silver, 0.5, 0.28, 0.38, 0, 0.18, 0); for (let i = 0; i < 6; i++) part(torso, RBX(), dark, 0.42, 0.02, 0.02, 0, 0.1 + i * 0.035, 0.2);
  const chest = grp(torso, 0, 0.66, 0); part(chest, RBX(), red, 1.0, 0.62, 0.56, 0, 0, 0); part(chest, RBX(), red, 0.86, 0.12, 0.5, 0, 0.36, -0.02);
  for (const s of [-1, 1]) { part(chest, RBX(), silver, 0.36, 0.28, 0.04, s * 0.23, 0.08, 0.28); part(chest, RBX(), glass, 0.31, 0.23, 0.04, s * 0.23, 0.08, 0.3); line(chest, 0.02, 0.24, s * 0.23, 0.08, 0.32); }
  line(chest, 0.9, 0.015, 0, -0.14, 0.285); line(chest, 0.015, 0.2, 0, -0.24, 0.285); part(chest, SPH(), silver, 0.12, 0.12, 0.04, 0, -0.22, 0.29);
  for (const s of [-1, 1]) { const st = grp(chest, s * 0.42, 0.22, -0.2); part(st, CYL(), silver, 0.1, 0.62, 0.1, 0, 0.2, 0); part(st, CYL(), dark, 0.12, 0.05, 0.12, 0, 0.5, 0); part(st, CYL(), silver, 0.13, 0.04, 0.13, 0, -0.02, 0); }
  // head: blue helmet with side fins and a crest, silver faceplate with mouth vents, glowing eyes
  const neck = grp(torso, 0, 1.03, 0.02), head = grp(neck, 0, 0.12, 0);
  part(head, RBX(), blue, 0.36, 0.34, 0.34, 0, 0.08, 0); part(head, RBX(), blue, 0.06, 0.16, 0.2, 0, 0.28, 0.03);
  for (const s of [-1, 1]) { part(head, RBX(), blue, 0.05, 0.3, 0.12, s * 0.2, 0.2, 0.02, 0, 0, s * -0.1); part(head, CYL(), silver, 0.03, 0.14, 0.03, s * 0.2, 0.4, 0.02); }
  part(head, RBX(), silver, 0.24, 0.16, 0.06, 0, 0.0, 0.17); for (let i = 0; i < 3; i++) part(head, RBX(), dark, 0.16, 0.012, 0.02, 0, -0.03 + i * 0.03, 0.205);
  for (const s of [-1, 1]) part(head, RBX(), eye, 0.1, 0.035, 0.03, s * 0.065, 0.12, 0.18);
  const mouth = grp(head, 0, 0, 0.25);
  // shoulders, arms, fists with fingers
  for (const s of [-1, 1]) { part(torso, RBX(), red, 0.34, 0.26, 0.46, s * 0.64, 0.95, 0); part(torso, RBX(), silver, 0.36, 0.05, 0.48, s * 0.64, 1.07, 0); }
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.66, 0.82, 0); part(a, CAP(), silver, 0.18, 0.2, 0.18, 0, -0.18, 0);
    const f = grp(a, 0, -0.4, 0); part(f, RBX(), red, 0.28, 0.42, 0.3, 0, -0.2, 0); part(f, RBX(), silver, 0.3, 0.06, 0.32, 0, -0.04, 0); line(f, 0.02, 0.3, s * 0.142, -0.2, 0);
    const fist = grp(f, 0, -0.48, 0.02); part(fist, RBX(), blue, 0.22, 0.18, 0.24); for (let i = 0; i < 4; i++) part(fist, RBX(), blue, 0.045, 0.08, 0.06, -0.075 + i * 0.05, -0.06, 0.13); part(fist, RBX(), blue, 0.06, 0.1, 0.06, s * -0.12, 0, 0.06);
    return { a, f }; });
  const hand = grp(arms[1].f, 0, -0.5, 0.1);
  // legs: blue with silver knees, a truck wheel on each, silver feet with toe caps
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.26, 0, 0); part(l, RBX(), blue, 0.32, 0.52, 0.36, 0, -0.26, 0); const k = grp(l, 0, -0.5, 0);
    part(k, RBX(), silver, 0.3, 0.12, 0.38, 0, 0.0, 0.03); part(k, RBX(), blue, 0.36, 0.44, 0.42, 0, -0.22, 0); line(k, 0.3, 0.015, 0, -0.1, 0.215); line(k, 0.3, 0.015, 0, -0.32, 0.215);
    const wh = grp(k, s * 0.2, -0.18, -0.04); part(wh, CYL(), tire, 0.3, 0.1, 0.3, 0, 0, 0, 0, 0, Math.PI / 2); part(wh, CYL(), silver, 0.15, 0.11, 0.15, 0, 0, 0, 0, 0, Math.PI / 2);
    part(k, RBX(), silver, 0.4, 0.12, 0.56, 0, -0.45, 0.06); part(k, RBX(), blue, 0.38, 0.06, 0.14, 0, -0.41, 0.31); return { l, k }; });
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

// merge the meshes that sit still together inside each moving group (same material -> one mesh), so a detailed monster
// costs about as many draw calls as a blocky one
function mergeStatic(root) { const groups = []; root.traverse((o) => { if (!o.isMesh) groups.push(o); });
  for (const g of groups) { const by = new Map(); for (const ch of g.children) if (ch.isMesh) { if (!by.has(ch.material)) by.set(ch.material, []); by.get(ch.material).push(ch); }
    for (const [m, list] of by) { if (list.length < 2) continue; const gs = list.map((ch) => { ch.updateMatrix(); const gg = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone(); for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k); return gg.applyMatrix4(ch.matrix); });
      const merged = mergeGeometries(gs, false); if (!merged) continue; for (const ch of list) g.remove(ch); g.add(new THREE.Mesh(merged, m)); } } }
const withMerge = (fn) => (body, K) => { const r = fn(body, K); mergeStatic(body); return r; };
export const HD = { biped: withMerge(bipedHD), squid: withMerge(squidHD), robot: withMerge(robotHD) };
