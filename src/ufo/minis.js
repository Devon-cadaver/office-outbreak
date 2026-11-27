// Beam 'Em Up!'s MINI BOSSES: one for each of the first five towns (The Sprawl keeps the Iron Mammoth). A mini boss turns up
// when the town's three goals are half met; the town's clock stops and its own runs (main.js startMini / miniTick).
// Each is beaten its own way:
//   THE GENERAL (Small Town)      an armored command car that runs from you and calls in help. Rays bounce off it: hover
//                                 over it and beam it up, General and all
//   THE SHIELD TANK (Suburbs)     a heavy tank under a dome fed by two generator trucks: zap the trucks, then the tank
//   THE HORN KING (Downtown)      a giant horn truck whose blast throws you back. It glows red-hot after each blast: zap it then
//   THE SKY CARRIER (Metro)       a flying carrier that sends jets at you: tap its four rotors, one by one
//   THE ROCKET BATTERY (Megacity) three armored missile trucks: zap a missile as it launches and it falls back on its truck
// All the models are our own designs. army.js makes this (createMinis) and hands it what it needs of its own (A): shots,
// routes along the streets, arrows at the screen's edge, the crash of an aircraft; E is what main.js gave the army.
import * as THREE from 'three';
import { sfx } from '../audio.js';
import { makeTank } from '../ally/units.js';
import { makeLauncher } from './models.js';
import { toWorld } from '../city.js';
export const MINIS = [
  { key: 'general', name: '⭐ THE GENERAL', short: 'THE GENERAL', hint: '🎯 RAYS BOUNCE OFF: BEAM HIM UP', intro: 'RAYS BOUNCE OFF HIS CAR.\nHOVER OVER IT AND BEAM HIM UP!', time: 75, hp: 1, score: 8000 },
  { key: 'shield', name: '🛡 THE SHIELD TANK', short: 'THE SHIELD TANK', hint: '🎯 ZAP ITS TWO GENERATORS FIRST', intro: 'TWO GENERATOR TRUCKS FEED ITS SHIELD.\nZAP THEM FIRST!', time: 80, hp: 6, score: 9000 },
  { key: 'horn', name: '📯 THE HORN KING', short: 'THE HORN KING', hint: '🎯 ZAP IT WHILE IT GLOWS RED', intro: 'ITS BLAST THROWS YOU BACK.\nZAP IT WHILE IT GLOWS RED-HOT!', time: 80, hp: 8, score: 10000 },
  { key: 'carrier', name: '🚁 THE SKY CARRIER', short: 'THE SKY CARRIER', hint: '🎯 SHOOT OFF ITS FOUR ROTORS', intro: 'IT SENDS JETS AFTER YOU.\nTAP ITS FOUR ROTORS, ONE BY ONE!', time: 85, hp: 4, score: 11000 },
  { key: 'battery', name: '🚀 THE ROCKET BATTERY', short: 'THE ROCKET BATTERY', hint: '🎯 ZAP A MISSILE AS IT LAUNCHES', intro: 'ITS TRUCKS ARE ARMORED.\nZAP A MISSILE AS IT LAUNCHES\nAND IT FALLS BACK ON THEM!', time: 90, hp: 3, score: 12000 },
];
// GEN: seconds in the beam to lift the General, how fast his car runs, seconds between his calls for help.
// HORN: how far the blast reaches, what it costs, how far it throws the saucer, seconds it charges, seconds it stays hot.
// BAT: seconds between launches, seconds a fresh missile can be sent back, how fast it leaves the rack
export const GEN = { lift: 4.2, speed: 2.5, call: 8 }, HORNK = { r: 12, dmg: 10, push: 7, charge: 1.4, hot: 3.6, cd: 2.6 }, BAT = { every: 3.6, fresh: 1.9, v0: 3.2, lock: 1.2 };

const L = (c, e = 0, side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ color: c, emissive: e, side }), B = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
const ADD = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
const bx = new THREE.BoxGeometry(1, 1, 1), cy = new THREE.CylinderGeometry(0.5, 0.5, 1, 12), sp = new THREE.SphereGeometry(0.5, 12, 9), tip = new THREE.ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0), lineG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
const P = (par, geo, mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); par.add(m); return m; };
const wheels = (g, mat, r, w, xs, zs) => { for (const z of zs) for (const x of xs) P(g, cy, mat, r * 2, w, r * 2, x, r, z).rotation.z = Math.PI / 2; };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), rnd = (a, b) => a + Math.random() * (b - a);

// ---------- THE GENERAL's command car: long, open-topped, six wheels, flags on the wings, gold stars on the doors, a dish
// turning at the back, and the General himself standing in it with his megaphone ----------
export function makeStaffCar() {
  const g = new THREE.Group(), olive = L(0x56683a), dark = L(0x2a3220), tire = L(0x18181a), glass = L(0x8fc4d8, 0x0a1a22), gold = L(0xf2c84a, 0x3a2a06), red = L(0xc8282a), skin = L(0xe0b090), white = L(0xf2f2ea);
  P(g, bx, dark, 1.0, 0.18, 2.7, 0, 0.3, 0); P(g, bx, olive, 1.15, 0.42, 2.8, 0, 0.58, 0); P(g, bx, gold, 1.17, 0.05, 2.82, 0, 0.44, 0); P(g, bx, olive, 1.1, 0.14, 0.95, 0, 0.84, 0.92); P(g, bx, olive, 1.15, 0.28, 0.8, 0, 0.9, -1.0);
  P(g, bx, glass, 1.0, 0.36, 0.05, 0, 1.0, 0.42).rotation.x = -0.25; P(g, bx, dark, 0.8, 0.26, 0.06, 0, 0.6, 1.42); wheels(g, tire, 0.24, 0.2, [-0.6, 0.6], [1.0, -0.15, -0.95]);
  for (const s of [-1, 1]) { P(g, sp, white, 0.2, 0.2, 0.1, s * 0.42, 0.68, 1.42); P(g, cy, dark, 0.03, 0.7, 0.03, s * 0.52, 1.2, 1.25); P(g, bx, red, 0.02, 0.22, 0.34, s * 0.52, 1.42, 1.07); P(g, cy, gold, 0.34, 0.02, 0.34, s * 0.585, 0.62, -0.1).rotation.z = Math.PI / 2; }
  const dish = new THREE.Group(); dish.position.set(0, 1.04, -1.05); g.add(dish); P(dish, cy, dark, 0.06, 0.5, 0.06, 0, 0.25, 0); { const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 6, 0, 6.2832, 0, 1.1), L(0xc8ccd2, 0, THREE.DoubleSide)); b.rotation.x = Math.PI / 2 + 0.5; b.position.set(0, 0.62, 0); dish.add(b); }
  const gen = new THREE.Group(); gen.position.set(0, 1.0, -0.25); g.add(gen); P(gen, bx, olive, 0.46, 0.52, 0.3, 0, 0.26, 0); P(gen, sp, skin, 0.36, 0.36, 0.36, 0, 0.68, 0); P(gen, cy, gold, 0.48, 0.05, 0.48, 0, 0.82, 0); P(gen, cy, olive, 0.5, 0.1, 0.5, 0, 0.89, 0); P(gen, cy, red, 0.4, 0.06, 0.4, 0, 0.96, 0); P(gen, bx, dark, 0.32, 0.03, 0.2, 0, 0.83, 0.24);
  P(gen, bx, white, 0.24, 0.06, 0.06, 0, 0.6, 0.18); for (let i = 0; i < 3; i++) P(gen, bx, gold, 0.07, 0.09, 0.03, -0.14 + i * 0.09, 0.4, 0.16); for (const s of [-1, 1]) P(gen, bx, gold, 0.14, 0.05, 0.3, s * 0.27, 0.53, 0);
  const arm = new THREE.Group(); arm.position.set(0.27, 0.44, 0.05); gen.add(arm); P(arm, bx, olive, 0.12, 0.12, 0.42, 0, 0, 0.2); { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.05, 0.46, 10, 1, true), L(0xf2f2ea, 0, THREE.DoubleSide)); c.rotation.x = Math.PI / 2; c.position.set(0, 0.02, 0.6); arm.add(c); P(arm, cy, red, 0.46, 0.03, 0.46, 0, 0.02, 0.82).rotation.x = Math.PI / 2; } arm.rotation.x = -0.5;
  g.userData = { dish, gen, arm }; g.scale.setScalar(1.15); return g;
}
// ---------- a GENERATOR TRUCK: a yellow cab, a flatbed, and on it a coil tower that glows blue while it feeds the shield
export function makeGenTruck() {
  const g = new THREE.Group(), dark = L(0x23262c), bed = L(0x3a4450), cab = L(0xe0a62a), tire = L(0x18181a), glass = L(0x8fc4d8, 0x0a1a22), steel = L(0x9aa2ac), coilM = B(0x6ad8ff), warn = L(0x1a1a1c);
  P(g, bx, dark, 0.9, 0.16, 2.3, 0, 0.3, 0); P(g, bx, bed, 1.05, 0.14, 1.5, 0, 0.46, -0.35); P(g, bx, cab, 0.98, 0.6, 0.62, 0, 0.72, 0.85); P(g, bx, glass, 0.86, 0.22, 0.04, 0, 0.84, 1.17); wheels(g, tire, 0.2, 0.18, [-0.48, 0.48], [0.85, -0.3, -0.85]);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) P(g, bx, i % 2 ? cab : warn, 0.03, 0.12, 0.3, s * 0.535, 0.46, -1.0 + i * 0.3);
  P(g, cy, steel, 0.24, 1.6, 0.24, 0, 1.3, -0.4); for (let i = 0; i < 5; i++) P(g, new THREE.TorusGeometry(0.38 - i * 0.035, 0.06, 6, 16).rotateX(Math.PI / 2), coilM, 1, 1, 1, 0, 0.72 + i * 0.27, -0.4);
  const top = P(g, sp, coilM, 0.5, 0.5, 0.5, 0, 2.2, -0.4); for (const s of [-1, 1]) P(g, cy, steel, 0.26, 0.5, 0.26, s * 0.3, 0.78, 0.15);
  g.userData = { top, coilM }; g.scale.setScalar(1.2); return g;
}
// ---------- THE SHIELD TANK: a tank half as big again, in navy, with a mast and ring over the turret that catches the beams
export function makeShieldTank() { const g = makeTank(false), seen = new Set(); g.traverse((m) => { if (!m.isMesh || seen.has(m.geometry)) return; seen.add(m.geometry); const c = m.geometry.attributes.color; if (!c) { if (!seen.has(m.material)) { seen.add(m.material); const k = m.material.color, l = k.r * 0.3 + k.g * 0.59 + k.b * 0.11; k.setRGB(l * 0.7 + 0.02, l * 1.2 + 0.04, l * 2.1 + 0.07); } return; }
    for (let i = 0; i < c.count; i++) { const l = c.getX(i) * 0.3 + c.getY(i) * 0.59 + c.getZ(i) * 0.11; c.setXYZ(i, l * 0.7 + 0.02, l * 1.2 + 0.04, l * 2.1 + 0.07); } c.needsUpdate = true; });
  const tur = g.userData.turret, steel = L(0x9aa2ac), ringM = B(0x6ad8ff); P(tur, cy, steel, 0.06, 0.7, 0.06, 0, 0.6, -0.15); const recv = P(tur, new THREE.TorusGeometry(0.2, 0.05, 6, 14).rotateX(Math.PI / 2), ringM, 1, 1, 1, 0, 0.98, -0.15); for (const s of [-1, 1]) P(tur, bx, ringM, 0.05, 0.05, 0.5, s * 0.3, 0.3, 0);
  g.userData.recv = recv; g.userData.ringM = ringM; g.scale.setScalar(2.1); return g; }
// ---------- THE HORN KING: a big red rig with a crown on its cab, and on its back a brass horn as long as a house is wide,
// four smaller ones beside it. userData.horn turns to face the saucer; bellM is the brass (it glows when it is hot)
export function makeHornKing() {
  const g = new THREE.Group(), dark = L(0x23262c), red = L(0xc62a26), chrome = L(0xd8dde4, 0x1a1c20), tire = L(0x18181a), glass = L(0x8fc4d8, 0x0a1a22), gold = L(0xf2c84a, 0x3a2a06), wood = L(0x4a3426), white = L(0xfff4c8, 0x554a20), bellM = new THREE.MeshLambertMaterial({ color: 0xd8a23a, emissive: 0x2a1a04, side: THREE.DoubleSide });
  P(g, bx, dark, 1.3, 0.22, 4.0, 0, 0.5, 0); P(g, bx, red, 1.4, 0.95, 1.0, 0, 1.12, 1.4); P(g, bx, glass, 1.2, 0.4, 0.05, 0, 1.3, 1.92); P(g, bx, chrome, 1.2, 0.5, 0.08, 0, 0.8, 1.93); P(g, bx, chrome, 1.5, 0.16, 0.2, 0, 0.5, 2.0); P(g, bx, wood, 1.4, 0.16, 2.7, 0, 0.68, -0.55);
  for (const s of [-1, 1]) { P(g, sp, white, 0.24, 0.24, 0.1, s * 0.5, 0.82, 1.98); P(g, cy, chrome, 0.16, 1.5, 0.16, s * 0.78, 1.7, 0.82); P(g, cy, red, 0.36, 1.1, 0.36, s * 0.48, 0.95, -1.5).rotation.x = Math.PI / 2; }
  wheels(g, tire, 0.38, 0.3, [-0.72, 0.72], [1.4, 0.2, -0.7, -1.5]); for (const z of [1.4, 0.2, -0.7, -1.5]) for (const s of [-1, 1]) P(g, cy, chrome, 0.3, 0.32, 0.3, s * 0.72, 0.38, z).rotation.z = Math.PI / 2;
  // the crown on the cab: a gold band, six points, a red cushion
  { const c = new THREE.Group(); c.position.set(0, 1.62, 1.4); g.add(c); P(c, cy, gold, 0.9, 0.16, 0.9, 0, 0.08, 0); P(c, sp, red, 0.7, 0.36, 0.7, 0, 0.2, 0); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; P(c, tip, gold, 0.16, 0.34, 0.16, Math.cos(a) * 0.4, 0.16, Math.sin(a) * 0.4); P(c, sp, red, 0.09, 0.09, 0.09, Math.cos(a) * 0.4, 0.52, Math.sin(a) * 0.4); } }
  // the horn on its turntable
  const horn = new THREE.Group(); horn.position.set(0, 0.78, -0.55); g.add(horn); P(horn, cy, chrome, 1.2, 0.16, 1.2, 0, 0.08, 0); for (const s of [-1, 1]) P(horn, bx, chrome, 0.1, 0.8, 0.2, s * 0.42, 0.5, 0);
  const prof = [[0.12, 0], [0.15, 0.5], [0.22, 1.0], [0.38, 1.5], [0.72, 1.95], [1.3, 2.3]].map(([r, y]) => new THREE.Vector2(r, y)), bellG = new THREE.LatheGeometry(prof, 20);
  const bell = new THREE.Mesh(bellG, bellM); bell.position.set(0, 0.75, -0.9); bell.rotation.x = Math.PI / 2 - 0.42; horn.add(bell); const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 6, 24).rotateX(Math.PI / 2), gold); rim.position.y = 2.3; bell.add(rim);
  for (const [x, y] of [[-0.62, 0.55], [0.62, 0.55], [-0.5, 1.25], [0.5, 1.25]]) { const b = new THREE.Mesh(bellG, bellM); b.scale.setScalar(0.34); b.position.set(x, y, 0.15); b.rotation.x = Math.PI / 2 - 0.3; horn.add(b); }
  g.userData = { horn, bell, bellM }; return g;
}
// ---------- THE SKY CARRIER: a flying deck with a runway painted down it, a bridge to one side, and a shrouded rotor at
// each corner (userData.rotors: { g, blades, alive }); guns and a red light under it ----------
export function makeCarrier() {
  const g = new THREE.Group(), slate = L(0x52647e, 0x0a0e14), deck = L(0x2c3442, 0x06080a), dark = L(0x1c2028), orange = L(0xff8a2a, 0x3a1a04), yellow = B(0xffd84a), white = B(0xe8f0ff), tower = L(0x6a7c98, 0x0c1016), bladeM = L(0xc8ccd2), rotors = [];
  P(g, bx, slate, 2.3, 0.45, 5.4, 0, 0, 0); P(g, bx, deck, 2.1, 0.06, 5.2, 0, 0.25, 0); P(g, bx, slate, 1.7, 0.4, 0.7, 0, -0.02, 2.95); P(g, bx, dark, 1.2, 0.26, 0.1, 0, 0.0, 3.31); P(g, bx, orange, 2.34, 0.08, 5.44, 0, -0.16, 0);
  for (let z = -2.2; z <= 2.21; z += 0.8) P(g, bx, yellow, 0.1, 0.02, 0.42, -0.25, 0.29, z); P(g, bx, white, 0.05, 0.02, 4.8, -0.98, 0.29, 0); P(g, bx, white, 0.05, 0.02, 4.8, 0.42, 0.29, 0);
  P(g, bx, tower, 0.5, 0.7, 1.2, 0.8, 0.62, 0.3); P(g, bx, B(0x9fe8ff), 0.52, 0.14, 0.9, 0.8, 0.84, 0.36); P(g, cy, dark, 0.05, 0.6, 0.05, 0.8, 1.26, 0.1); const radar = P(g, bx, orange, 0.7, 0.06, 0.12, 0.8, 1.56, 0.1);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { P(g, bx, dark, 1.0, 0.14, 0.3, sx * 1.5, 0.02, sz * 2.05); const r = new THREE.Group(); r.position.set(sx * 2.15, 0.12, sz * 2.05); g.add(r);
    P(r, new THREE.TorusGeometry(0.85, 0.09, 6, 18).rotateX(Math.PI / 2), orange, 1, 1, 1, 0, 0, 0); P(r, cy, dark, 0.3, 0.3, 0.3, 0, 0, 0); const blades = new THREE.Group(); r.add(blades); P(blades, bx, bladeM, 1.56, 0.03, 0.15, 0, 0.1, 0); P(blades, bx, bladeM, 0.15, 0.03, 1.56, 0, 0.1, 0); P(blades, new THREE.CircleGeometry(0.8, 16).rotateX(-Math.PI / 2), ADD(0xffffff, 0.1), 1, 1, 1, 0, 0.12, 0);
    rotors.push({ g: r, blades, alive: true }); }
  P(g, sp, B(0xff3a2a), 0.4, 0.3, 0.4, 0, -0.3, 0); for (const s of [-1, 1]) { P(g, bx, dark, 0.3, 0.22, 0.8, s * 0.6, -0.3, 1.2); P(g, new THREE.CircleGeometry(0.3, 12).rotateY(Math.PI), B(0xffb04a), 1, 1, 1, s * 0.55, 0, -2.71); }
  g.userData = { rotors, props: rotors.map((r) => r.blades), radar }; return g;
}
// ---------- a ROCKET BATTERY truck: the missile truck in dark red armor, skirts down its sides, a blast shield behind the rack
export function makeBatteryTruck() { const g = makeLauncher(), armor = L(0x7a2a26, 0x160606), dark = L(0x1c1e22), warn = L(0xf0b428), u = g.userData;
  for (const s of [-1, 1]) { P(g, bx, armor, 0.08, 0.52, 2.3, s * 0.56, 0.52, 0); for (let i = 0; i < 4; i++) P(g, bx, i % 2 ? warn : dark, 0.09, 0.1, 0.3, s * 0.565, 0.3, -0.9 + i * 0.6); }
  P(g, bx, armor, 1.12, 0.5, 0.08, 0, 0.66, 1.16); P(g, bx, dark, 0.7, 0.1, 0.09, 0, 0.82, 1.17); P(g, bx, armor, 1.0, 0.07, 0.72, 0, 1.05, 0.8); P(u.rack, bx, armor, 0.98, 0.66, 0.08, 0, 0, -0.46); P(u.rack, bx, armor, 0.9, 0.08, 1.12, 0, 0.33, 0.1);
  g.scale.setScalar(1.5); return g; }

// ---------- the mini bosses in play ----------
export function createMinis(A) { const { E, scene, fx } = A;
  let m = null; const junk = [];
  const own = (o) => { scene.add(o); junk.push(o); return o; }, live = () => !!m && m.live;
  const say = (pos, text, col = '#c8dcff') => { if (!m || E.played - (m.sayT || -9) < 1.4) return; m.sayT = E.played; E.popup(pos, text, col); };
  const bounce = (pos, text) => { fx.sparks(pos, 7, { c: [0xd8f6ff, 0x7df0ff], speed: 5, up: 3, life: 0.35 }); say(pos, text); sfx.ping(2); };
  const beaten = (pos) => { if (!live()) return; m.live = false; m.t = 0; if (E.miniDown) E.miniDown(pos); };
  const aimLine = (l, a, b, w) => { l.position.copy(a); l.lookAt(b); l.scale.set(w, w, a.distanceTo(b)); };
  function clear() { if (m) { for (const o of m.objs) A.drop(o); for (const a of m.arrows) a.remove(); } for (const o of junk) { scene.remove(o); if (o.material) o.material.dispose(); if (o.geometry && o.geometry !== lineG && o.geometry !== sp) o.geometry.dispose(); } junk.length = 0; m = null; }
  // a street square between minR and maxR from `at` (never right under the saucer, never on top of one of `avoid`): every street is looked at, so one is found if there is one
  const spot = (at, minR, maxR, avoid = []) => { const t = E.town, S = E.ship.pos, ok = []; for (const c of t.roads) { const w = toWorld(c[0], c[1], t.cols, t.rows), d = Math.hypot(w.x - at.x, w.z - at.z); if (d < minR || d > maxR || Math.hypot(w.x - S.x, w.z - S.z) < 9 || avoid.some((q) => Math.hypot(w.x - q.x, w.z - q.z) < 3.5)) continue; ok.push({ c, w }); } return ok.length ? ok[(Math.random() * ok.length) | 0] : A.farRoad(minR); };
  const gone = (g) => { const i = m.objs.indexOf(g); if (i >= 0) m.objs.splice(i, 1); A.drop(g); };

  // ---- THE GENERAL ----
  function general() { const { c, w } = spot(E.ship.pos, 12, 22), g = makeStaffCar(), u = g.userData, o = { g, cell: c, path: [], repath: 0 }, arrow = A.mkArrow('⭐', '#ffd24a'); g.position.set(w.x, 0, w.z); scene.add(g); let lift = 0, call = 5, n = 0;
    return { objs: [g], arrows: [arrow], pos: () => g.position, frac: () => 1 - lift, beamSpot: () => g.position,
      update(dt) { const S = E.ship, p = g.position, d = Math.hypot(S.pos.x - p.x, S.pos.z - p.z), over = S.alive && d < E.pullR && E.beamOn; u.dish.rotation.y += dt * 3;
        lift = over ? Math.min(1, lift + dt / GEN.lift) : Math.max(0, lift - dt * 0.3);
        if (lift <= 0.01) { p.y = 0; g.rotation.z = 0; o.repath -= dt; if (o.repath <= 0) { o.repath = 1.5; o.path = d < 13 ? A.roadPathTo(o.cell, S.pos.x, S.pos.z, true) : []; } A.followPath(o, GEN.speed, dt); }
        else { const e = Math.min(1, dt * 2.2); p.x += (S.pos.x - p.x) * e; p.z += (S.pos.z - p.z) * e; p.y = lift * Math.max(1, S.pos.y - 1.6); g.rotation.z = Math.sin(E.played * 9) * 0.14; g.rotation.y += dt * 1.6 * lift; if (over) E.status('⭐ BEAMING UP THE GENERAL: ' + Math.round(lift * 100) + '%'); }
        u.arm.rotation.x = -0.5 + Math.sin(E.played * (lift > 0.01 ? 18 : 6)) * 0.25;
        call -= dt; if (call <= 0 && lift < 0.2 && S.alive) { call = GEN.call; for (let i = 0; i < 3; i++) A.addSoldier(p.x + rnd(-1.2, 1.2), p.z + rnd(-1.2, 1.2)); if (n++ % 2 === 1) A.addTank(8, 1, p, 9); E.popup(p.clone().setY(1.8), '📣 SEND EVERYTHING!', '#ffd24a'); sfx.ping(4); }
        E.edgeArrow(arrow, p, S.alive);
        if (lift >= 1) { const at = p.clone(); fx.sparks(at, 22, { c: [0xffffff, 0x7dff3a], speed: 5, up: 4, life: 0.6 }); sfx.pickup(); g.visible = false; arrow.style.display = 'none'; beaten(at); } },
      targets(consider) { const p = g.position; consider('general', p.clone().setY(0.7), 56, () => bounce(p.clone().setY(1.1), 'RAYS BOUNCE OFF! HOVER OVER IT TO BEAM IT UP'), live); },
      area() { return 0; } }; }

  // ---- THE SHIELD TANK and its two generator trucks ----
  function shield(hp) { const { c, w } = spot(E.ship.pos, 14, 24), g = makeShieldTank(), arrow = A.mkArrow('🛡', '#6ad8ff'), o = { g, cell: c, path: [], repath: 0 }; g.position.set(w.x, 0, w.z); scene.add(g);
    const glow = own(new THREE.Mesh(sp, ADD(0xff7a2a, 0))); glow.visible = false; glow.renderOrder = 6;
    const dome = own(new THREE.Group()), bubM = ADD(0x4ab4ff, 0.22), net = new THREE.Mesh(new THREE.IcosahedronGeometry(2.42, 1), new THREE.MeshBasicMaterial({ color: 0x9adcff, wireframe: true, transparent: true, opacity: 0.55, depthWrite: false })); dome.add(new THREE.Mesh(new THREE.SphereGeometry(2.7, 18, 12), bubM), net); net.scale.setScalar(1.125); dome.traverse((q) => { q.renderOrder = 5; });
    const taken = [w], gens = [0, 1].map(() => { const r = spot(w, 5, 11, taken), tg = makeGenTruck(); taken.push(r.w); tg.position.set(r.w.x, 0, r.w.z); tg.rotation.y = Math.random() * 6.28; scene.add(tg); const line = own(new THREE.Mesh(lineG, ADD(0x6ad8ff, 0.7))); line.frustumCulled = false; line.renderOrder = 6; return { g: tg, hp: 2, line, arrow: A.mkArrow('⚡', '#6ad8ff') }; });
    let cd = 4, charge = 0, immune = 0, tHp = hp;
    const hitGen = (q) => { const i = gens.indexOf(q); if (i < 0) return; const at = q.g.position.clone(); q.hp--; if (q.hp > 0) { fx.sparks(at.clone().setY(1.2), 14, { speed: 6, up: 5, life: 0.5 }); fx.ignite(V(at.x, 0.6, at.z), 0.6, 6); E.popup(at, 'DAMAGED! ZAP IT AGAIN', '#ffd24a'); E.award(150, at); return; }
      gens.splice(i, 1); scene.remove(q.line); q.arrow.remove(); gone(q.g); A.tankBoom(at); E.award(500, at, 'GENERATOR'); if (gens.length) E.popup(at.clone().setY(2), '⚡ ONE GENERATOR LEFT!', '#6ad8ff'); else { fx.shock(g.position, 6, 0x6ad8ff, 0.6); E.banner('🛡 THE SHIELD IS DOWN!\nZAP THE TANK'); sfx.power(); } };
    const hitTank = (dmg) => { const at = g.position.clone().setY(1.2); if (gens.length) return bounce(at.clone().setY(2), '🛡 SHIELDED! ZAP THE GENERATOR TRUCKS'); const now = performance.now(); if (now < immune) return; immune = now + 260; const d = dmg || (E.gunPow ? E.gunPow() : 1); tHp -= d; fx.sparks(at, 16, { c: [0xffe08a, 0xff5a3a], speed: 7, up: 4, life: 0.5 }); fx.explode(at, 0.8); E.popup(at.clone().setY(2.6), '-' + d, '#ffb02a'); sfx.boom(); E.jolt(0.25);
      if (tHp > 0) return; const q = g.position.clone(); for (let k = 0; k < 3; k++) E.after(0.2 + k * 0.28, () => A.tankBoom(V(q.x + rnd(-1.2, 1.2), 0, q.z + rnd(-1.2, 1.2)))); A.tankBoom(q); glow.visible = false; g.visible = false; arrow.style.display = 'none'; beaten(q); };
    return { objs: [g, ...gens.map((q) => q.g)], arrows: [arrow, ...gens.map((q) => q.arrow)], pos: () => g.position, frac: () => 0.4 * gens.reduce((s, q) => s + q.hp, 0) / 4 + 0.6 * Math.max(0, tHp) / hp,
      update(dt) { const S = E.ship, p = g.position, dx = S.pos.x - p.x, dz = S.pos.z - p.z, d = Math.hypot(dx, dz), tur = g.userData.turret;
        o.repath -= dt; if (o.repath <= 0) { o.repath = 2; o.path = d > 10 ? A.roadPathTo(o.cell, S.pos.x, S.pos.z, false) : []; } if (!charge) A.followPath(o, d > 20 ? 2.4 : 1.4, dt);
        const want = Math.atan2(dx, dz) - g.rotation.y; tur.rotation.y += Math.atan2(Math.sin(want - tur.rotation.y), Math.cos(want - tur.rotation.y)) * Math.min(1, dt * 4);
        cd -= dt; if (!charge && d < 24 && cd <= 0 && S.alive) { charge = 0.9; glow.visible = true; }
        if (charge) { charge = Math.max(0, charge - dt); g.updateMatrixWorld(true); const mz = V(0, 0.64, 1.25).applyMatrix4(tur.matrixWorld), k = 1 - charge / 0.9; glow.position.copy(mz); glow.scale.setScalar(0.5 + k * 0.9); glow.material.opacity = 0.4 + k * 0.55;
          if (charge <= 0) { glow.visible = false; cd = rnd(2.2, 3); A.shoot('shell', mz, S.pos.clone().add(V(rnd(-0.5, 0.5), 0, rnd(-0.5, 0.5))).sub(mz).normalize().multiplyScalar(13), { dmg: 8, life: 3.2 }); fx.puff('flame', mz, 0.9); fx.puff('smoke', mz, 1); sfx.boom(); E.jolt(0.12); } }
        dome.visible = gens.length > 0; dome.position.set(p.x, 0.9, p.z); net.rotation.y += dt * 0.5; net.rotation.x += dt * 0.2; bubM.opacity = 0.18 + Math.sin(E.played * 5) * 0.05; g.userData.ringM.color.setHex(gens.length ? 0x6ad8ff : 0x30343a);
        const to = g.userData.recv.getWorldPosition(V()); for (const q of gens) { q.g.userData.coilM.color.setRGB(0.42 + Math.sin(E.played * 12) * 0.15, 0.85, 1); aimLine(q.line, q.g.userData.top.getWorldPosition(V()), to, 0.07 + Math.random() * 0.05); E.edgeArrow(q.arrow, q.g.position, S.alive); }
        E.edgeArrow(arrow, p, S.alive); },
      targets(consider) { for (const q of gens) consider('gen', q.g.position.clone().setY(1), 58, () => hitGen(q), () => live() && gens.includes(q), true); consider('stank', g.position.clone().setY(0.9), 78, () => hitTank(0), live); },
      area(c, r) { let n = 0; for (const q of gens.slice()) if (Math.hypot(q.g.position.x - c.x, q.g.position.z - c.z) < r + 0.6) { q.hp = 1; hitGen(q); n++; } if (!gens.length && Math.hypot(g.position.x - c.x, g.position.z - c.z) < r + 0.8) { hitTank(r >= 5 ? 3 : r >= 3 ? 2 : 1); n++; } return n; } }; }

  // ---- THE HORN KING ----
  function horn(hp) { const { c, w } = spot(E.ship.pos, 15, 24), g = makeHornKing(), u = g.userData, arrow = A.mkArrow('📯', '#ffc23a'), o = { g, cell: c, path: [], repath: 0 }; g.position.set(w.x, 0, w.z); scene.add(g); let st = 'roll', t = 0, cd = 3, immune = 0, tHp = hp, sm = 0; const heat = new THREE.Color();
    const hit = (dmg) => { const at = g.position.clone().setY(1.6); if (st !== 'hot') return bounce(at.clone().setY(2.8), 'ITS SOUND WALL STOPS YOUR RAY! WAIT FOR IT TO GLOW RED'); const now = performance.now(); if (now < immune) return; immune = now + 380; const d = dmg || 1; tHp -= d; fx.sparks(at, 16, { c: [0xffe08a, 0xff5a3a], speed: 7, up: 4, life: 0.5 }); fx.explode(at, 0.8); E.popup(at.clone().setY(3), '-' + d, '#ffb02a'); sfx.boom(); E.jolt(0.25);
      if (tHp > 0) return; const q = g.position.clone(); for (let k = 0; k < 3; k++) E.after(0.2 + k * 0.28, () => A.tankBoom(V(q.x + rnd(-1.4, 1.4), 0, q.z + rnd(-1.4, 1.4)))); A.tankBoom(q); g.visible = false; arrow.style.display = 'none'; beaten(q); };
    return { objs: [g], arrows: [arrow], pos: () => g.position, frac: () => Math.max(0, tHp) / hp,
      update(dt) { const S = E.ship, p = g.position, dx = S.pos.x - p.x, dz = S.pos.z - p.z, d = Math.hypot(dx, dz) || 1; t += dt; cd -= dt;
        u.horn.rotation.y += Math.atan2(Math.sin(Math.atan2(dx, dz) - g.rotation.y - u.horn.rotation.y), Math.cos(Math.atan2(dx, dz) - g.rotation.y - u.horn.rotation.y)) * Math.min(1, dt * 3);
        if (st === 'roll') { o.repath -= dt; if (o.repath <= 0) { o.repath = 2; o.path = d > 8 ? A.roadPathTo(o.cell, S.pos.x, S.pos.z, false) : []; } A.followPath(o, d > 20 ? 2.6 : 1.7, dt); if (cd <= 0 && d < HORNK.r + 3 && S.alive) { st = 'charge'; t = 0; sfx.ping(5); } u.bell.scale.setScalar(1); }
        else if (st === 'charge') { E.status('📯 THE HORN KING IS ABOUT TO BLOW! GET CLEAR'); const k = t / HORNK.charge; u.bell.scale.setScalar(1 + k * 0.12 + Math.sin(t * 60) * 0.03 * k); if (Math.random() < dt * 12) fx.shock(p.clone().setY(0.4), 2 + k * 3, 0xffc060, 0.3);
          if (t >= HORNK.charge) { st = 'hot'; t = 0; u.bell.scale.setScalar(1); const at = p.clone().setY(0.4); for (let i = 0; i < 3; i++) E.after(i * 0.12, () => fx.shock(at, HORNK.r * (0.6 + i * 0.2), 0xffc060, 0.55)); fx.sparks(p.clone().setY(2.5), 24, { c: [0xffffff, 0xffb030], speed: 9, up: 3, life: 0.6 }); sfx.wave(); E.jolt(0.5);
            if (S.alive && d < HORNK.r) { E.hurt(HORNK.dmg, 'horn', S.pos); E.shove(dx / d, dz / d, HORNK.push); } E.popup(p.clone().setY(3.4), '🔥 OVERHEATED: ZAP IT NOW!', '#ffe14a'); } }
        else { /* hot: the brass glows and steams, and the ray gets through */ sm -= dt; if (sm <= 0) { sm = 0.09; fx.puff('smoke', V(p.x + rnd(-0.6, 0.6), 2.2 + rnd(0, 1), p.z + rnd(-0.6, 0.6)), 0.6); } if (t >= HORNK.hot) { st = 'roll'; t = 0; cd = HORNK.cd; } }
        const hk = st === 'hot' ? Math.min(1, (HORNK.hot - t) / 0.6) * (0.75 + Math.sin(E.played * 14) * 0.25) : st === 'charge' ? t / HORNK.charge * 0.35 : 0; u.bellM.emissive.copy(heat.setRGB(0.165 + hk * 0.83, 0.1 + hk * 0.1, 0.016)); u.bellM.color.setRGB(0.85, 0.64 - hk * 0.3, 0.23 - hk * 0.1);
        E.edgeArrow(arrow, p, S.alive); },
      targets(consider) { consider('hornking', g.position.clone().setY(1.4), 84, () => hit(0), live); },
      area(c, r) { if (st !== 'hot' || Math.hypot(g.position.x - c.x, g.position.z - c.z) > r + 1) return 0; hit(r >= 5 ? 3 : 2); return 1; } }; }

  // ---- THE SKY CARRIER ----
  function carrier() { const S0 = E.ship, b = E.town.lim, a0 = Math.random() * 6.28, R0 = Math.max(b.x, b.z) + 10, g = makeCarrier(), u = g.userData, arrow = A.mkArrow('🚁', '#ff8a2a'); g.position.set(Math.cos(a0) * R0, S0.pos.y + 2, Math.sin(a0) * R0); scene.add(g);
    let ph = a0 + Math.PI, head = 0, jetT = 7, rkT = 4, left = 4, down = false; const vel = V(), lean = V();
    const hitRotor = (r) => { if (!r.alive || down) return; r.alive = false; left--; const at = r.g.getWorldPosition(V()); r.blades.visible = false; fx.explode(at.clone(), 1.1); fx.sparks(at, 20, { c: [0xffe08a, 0xff8a2a], speed: 8, up: 5, life: 0.7 }); sfx.boom(); E.jolt(0.3); E.award(400, at, 'ROTOR'); lean.x += r.g.position.x > 0 ? 1 : -1; lean.z += r.g.position.z > 0 ? 1 : -1;
      if (left > 0) { E.popup(at.clone().setY(at.y + 1), '💥 ROTOR DOWN! ' + left + ' TO GO', '#ffd24a'); return; }
      down = true; arrow.style.display = 'none'; const i = m.objs.indexOf(g); if (i >= 0) m.objs.splice(i, 1); const pos = g.position.clone(), sp0 = Math.hypot(vel.x, vel.z); A.fall(g, sp0 > 1 ? Math.atan2(vel.x, vel.z) : head, Math.max(4, sp0), { blast: 3.4, plough: 8, r: 2.6, pts: 0, label: '', banner: '', size: 1.8, own: true, done: (q) => beaten(q) }); E.popup(pos, '💥 IT IS GOING DOWN!', '#ffd24a'); };
    return { objs: [g], arrows: [arrow], pos: () => g.position, frac: () => left / 4,
      update(dt) { if (down) return; const S = E.ship, p = g.position; ph += dt * (0.2 + left * 0.035); const orbit = 8, tx = S.pos.x + Math.cos(ph) * orbit, tz = S.pos.z + Math.sin(ph) * orbit, ex = tx - p.x, ez = tz - p.z, el = Math.hypot(ex, ez) || 0.01, want = Math.min(4 + left * 0.9, el * 1.4), e = Math.min(1, dt * 1.6);
        vel.x += (ex / el * want - vel.x) * e; vel.z += (ez / el * want - vel.z) * e; p.x += vel.x * dt; p.z += vel.z * dt; p.y += (Math.max(6.2, S.pos.y + 0.6 + left * 0.35) + Math.sin(E.played * 1.3) * 0.2 - p.y) * Math.min(1, dt * 1.2);
        if (Math.hypot(vel.x, vel.z) > 0.4) { let dh = Math.atan2(vel.x, vel.z) - head; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); head += dh * Math.min(1, dt * 1.5); } g.rotation.set(0, head, 0); g.rotateX(lean.z * 0.07 + Math.sin(E.played * 3) * 0.01 * (4 - left)); g.rotateZ(-lean.x * 0.07);
        u.radar.rotation.y += dt * 3; for (const r of u.rotors) { if (r.alive) r.blades.rotation.y += dt * 34; else if (Math.random() < dt * 16) fx.puff('smoke', r.g.getWorldPosition(V()), 0.6); }
        const dS = Math.hypot(S.pos.x - p.x, S.pos.z - p.z); jetT -= dt; if (jetT <= 0 && S.alive) { jetT = 10 - (4 - left); A.startRun(); E.popup(p.clone(), '✈ JETS AWAY!', '#ff9a8a'); }
        rkT -= dt; if (rkT <= 0 && S.alive && dS < 18) { rkT = 3.2; const from = p.clone(); from.y -= 0.5; const tof = from.distanceTo(S.pos) / 12, to = S.pos.clone().addScaledVector(S.vel, tof * 0.5); A.shoot('rocket', from, to.sub(from).normalize().multiplyScalar(12), { dmg: 5, life: 3.4 }); fx.puff('smoke', from, 0.4); sfx.throw(); }
        E.edgeArrow(arrow, p, S.alive); },
      targets(consider) { if (down) return; for (const r of u.rotors) if (r.alive) consider('rotor', r.g.getWorldPosition(V()), 50, () => hitRotor(r), () => live() && r.alive, true); consider('carrier', g.position, 44, () => say(g.position, 'AIM FOR ITS ROTORS!', '#ffd24a'), live, true); },
      area() { return 0; } }; }

  // ---- THE ROCKET BATTERY ----
  function battery() { const anchor = spot(E.ship.pos, 14, 22).w, taken = [anchor], halo = own(new THREE.Mesh(sp, ADD(0xffe14a, 0.5))); halo.visible = false; halo.renderOrder = 7; let next = 3, turn = 0, fresh = null;
    const trucks = [0, 1, 2].map((i) => { const r = i ? spot(anchor, 3.5, 9, taken) : { w: anchor }, g = makeBatteryTruck(); taken.push(r.w); g.position.set(r.w.x, 0, r.w.z); g.rotation.y = Math.random() * 6.28; scene.add(g); const line = own(new THREE.Mesh(lineG, ADD(0xff2a2a, 0.6))); line.visible = false; line.frustumCulled = false; line.renderOrder = 7; return { g, line, mode: 'idle', t: 0, alive: true, arrow: A.mkArrow('🚀', '#ff5a4a') }; });
    const rackPos = (q) => { q.g.updateMatrixWorld(true); return V(0, 0, 0.3).applyMatrix4(q.g.userData.rack.matrixWorld); };
    const sentBack = (sh, q) => { if (fresh === sh) fresh = null; if (!q.alive || sh.t > BAT.fresh || !live()) { if (q.alive && live()) say(sh.p.clone(), 'TOO LATE! ZAP IT THE MOMENT IT LAUNCHES', '#ffd24a'); return; }
      q.alive = false; q.line.visible = false; q.arrow.remove(); const at = q.g.position.clone(), from = sh.p.clone(); fx.sparks(from, 14, { c: [0xffffff, 0xff5a3a], speed: 6, up: 2, life: 0.5 }); const fallLine = own(new THREE.Mesh(lineG, ADD(0xffb04a, 0.9))); fallLine.frustumCulled = false; aimLine(fallLine, from, at.clone().setY(0.8), 0.16); E.after(0.22, () => { fallLine.visible = false; });
      E.after(0.2, () => { A.tankBoom(at); if (m && m.objs.includes(q.g)) gone(q.g); E.award(800, at, 'RETURN TO SENDER!'); const n = trucks.filter((o) => o.alive).length; if (n) E.popup(at.clone().setY(2.4), '💥 ' + n + ' TO GO', '#ffd24a'); else beaten(at); }); };
    return { objs: trucks.map((q) => q.g), arrows: trucks.map((q) => q.arrow), pos: () => (trucks.find((q) => q.alive) || trucks[0]).g.position, frac: () => trucks.filter((q) => q.alive).length / 3,
      update(dt) { const S = E.ship, up = trucks.filter((q) => q.alive); next -= dt; if (next <= 0 && up.length && S.alive && !up.some((q) => q.mode === 'lock')) { next = BAT.every; const q = up[turn++ % up.length]; if (Math.hypot(S.pos.x - q.g.position.x, S.pos.z - q.g.position.z) < 30) { q.mode = 'lock'; q.t = BAT.lock; sfx.laser(); } }
        for (const q of up) { const g = q.g, p = g.position, ud = g.userData, dx = S.pos.x - p.x, dz = S.pos.z - p.z, d = Math.hypot(dx, dz); let dr = Math.atan2(dx, dz) - g.rotation.y - ud.turret.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); ud.turret.rotation.y += dr * Math.min(1, dt * 2.4); ud.rack.rotation.x = -Math.min(1.1, Math.atan2(S.pos.y, Math.max(1, d)));
          if (q.mode === 'idle') ud.lamp.material.opacity = 0.2; else { q.t -= dt; const from = rackPos(q); q.line.visible = true; aimLine(q.line, from, S.pos, 0.07); q.line.material.opacity = 0.35 + Math.sin(E.played * 30) * 0.25; ud.lamp.material.opacity = Math.sin(E.played * 28) > 0 ? 1 : 0.3; E.status('🚀 ZAP THE MISSILE AS IT LAUNCHES!');
            if (q.t <= 0 || !S.alive) { q.mode = 'idle'; q.line.visible = false; if (S.alive) { const v = S.pos.clone().sub(from).normalize(); v.y = Math.max(v.y, 0.9); v.normalize().multiplyScalar(BAT.v0); A.shoot('missile', from, v, { dmg: 9, life: 6, home: 3.4, vmax: 13, px: 86, onZap: (sh) => sentBack(sh, q) }); fresh = A.shots[A.shots.length - 1]; fx.puff('smoke', from, 1); fx.puff('flame', from, 0.6); sfx.whoosh(); } } }
          E.edgeArrow(q.arrow, p, S.alive && d < 40); }
        if (fresh && (fresh.t > BAT.fresh || !A.shots.includes(fresh))) fresh = null; halo.visible = !!fresh; if (fresh) { halo.position.copy(fresh.p); halo.scale.setScalar(1.6 + Math.sin(E.played * 20) * 0.4); halo.material.opacity = 0.35 + (1 - fresh.t / BAT.fresh) * 0.4; } },
      targets(consider) { for (const q of trucks) if (q.alive) consider('battery', q.g.position.clone().setY(1), 54, () => bounce(q.g.position.clone().setY(1.8), 'ARMORED! ZAP ITS MISSILE AS IT LAUNCHES'), () => live() && q.alive, true); },
      area() { return 0; } }; }

  const MAKE = { general, shield, horn, carrier, battery };
  function start(key, hp) { clear(); const o = MAKE[key](hp); m = Object.assign(o, { key, live: true, t: 0, sayT: -9 }); return m; }
  function update(dt) { if (!m) return; if (!m.live) { m.t += dt; if (m.t > 4) clear(); return; } m.update(dt); }
  // out of time: whatever is left of it pulls out
  function leave() { if (!m || !m.live) return; for (const o of m.objs) fx.puff('smoke', o.position.clone().setY(1), 2); clear(); }
  return { start, update, clear, leave, targets: (consider) => { if (live()) m.targets(consider); }, area: (c, r) => (live() ? m.area(c, r) : 0), eachDot: (fn) => { if (live()) fn(m.pos(), 'mini'); },
    frac: () => (m ? m.frac() : 0), pos: () => (m ? m.pos() : null), beamSpot: () => (live() && m.beamSpot ? m.beamSpot() : null), get m() { return m; } };
}
