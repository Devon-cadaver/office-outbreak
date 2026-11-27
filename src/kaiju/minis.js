// Kaiju Madness's MINI BOSSES: one for each of the first five towns (The Sprawl keeps the Champion). A mini boss turns up
// when the town's goals are half met (and no rival is about); the town's clock stops and its own runs (main.js startMB / mbTick).
// Each is beaten its own way:
//   THE TAG TEAM (Small Town)    two rivals with the same star over their heads: knock one out and its partner tags in, fresh
//   THE STEEL TITAN (Suburbs)    an army machine in olive steel: punches bounce off it. Throw it, slam it or blast it
//   THE SKY ADMIRAL (Downtown)   a huge bomber out of reach: when it dives at you, tap it to swat it (three times)
//   THE GLUTTON (Metro)          a rival in a chef's hat that grows as it eats the town: while it is bigger than you your
//                                hits do next to nothing, so keep eating
//   THE IRON MASK (Megacity)     a wrestler that shrugs off punches: daze it and land three wrestling moves, GOOD or better
// Here: the list, what each one wears (r: the rival, top: how high its head is, in its own units) and the Admiral's aircraft.
// All our own designs.
import * as THREE from 'three';
export const MINIS = [
  { key: 'tag', name: '🤼 THE TAG TEAM', short: 'THE TAG TEAM', hint: '🎯 BEAT ONE AND ITS PARTNER TAGS IN', intro: 'TWO OF THEM!\nBEAT ONE AND ITS PARTNER TAGS IN, FRESH.', time: 110, score: 8000 },
  { key: 'titan', name: '🤖 THE STEEL TITAN', short: 'THE STEEL TITAN', hint: '🎯 PUNCHES BOUNCE OFF: THROW OR BLAST IT', intro: 'PUNCHES BOUNCE OFF ITS ARMOR.\nTHROW IT, SLAM IT OR BLAST IT!', time: 100, score: 9000 },
  { key: 'admiral', name: '✈ THE SKY ADMIRAL', short: 'THE SKY ADMIRAL', hint: '🎯 TAP IT WHEN IT DIVES AT YOU', intro: 'IT BOMBS YOU FROM OUT OF REACH.\nWHEN IT DIVES, TAP IT TO SWAT IT!', time: 90, hp: 3, score: 10000 },
  { key: 'glutton', name: '🍴 THE GLUTTON', short: 'THE GLUTTON', hint: '🎯 STAY BIGGER THAN IT: KEEP EATING', intro: 'IT GROWS AS IT EATS THE TOWN.\nSTAY BIGGER THAN IT, OR YOUR HITS DO NOTHING!', time: 110, score: 11000 },
  { key: 'mask', name: '🎭 THE IRON MASK', short: 'THE IRON MASK', hint: '🎯 ONLY WRESTLING MOVES COUNT: LAND 3', intro: 'IT SHRUGS OFF EVERY PUNCH.\nDAZE IT, THEN LAND THREE WRESTLING MOVES!', time: 110, score: 12000 },
];
const basic = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1, side: THREE.DoubleSide }), lam = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
const add = (par, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); par.add(m); return m; };
const aura = (r, col) => { const a = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 28).rotateX(-Math.PI / 2), basic(col, 0.55)); a.position.y = 0.06; r.g.add(a); };
// what floats over its head turns slowly (main.js: r.crown)
const over = (r, g, top, h) => { g.position.y = top + h; r.g.add(g); r.crown = g; };
// THE TAG TEAM: a pink star, the same over both of them, and a pink ring at their feet
export function teamGear(r, top) { const g = new THREE.Group(), sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832 + Math.PI / 2, q = i % 2 ? 0.2 : 0.46; if (i) sh.lineTo(Math.cos(a) * q, Math.sin(a) * q); else sh.moveTo(Math.cos(a) * q, Math.sin(a) * q); }
  add(g, new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }), basic(0xff3ab4), 0, 0, -0.05); add(g, new THREE.TorusGeometry(0.56, 0.035, 5, 24), basic(0xffffff), 0, 0, 0); over(r, g, top, 0.9); aura(r, 0xff3ab4); }
// THE GLUTTON: a chef's hat
export function chefGear(r, top) { const g = new THREE.Group(), white = lam(0xfafafa, 0x3a3a3a); add(g, new THREE.CylinderGeometry(0.3, 0.27, 0.36, 14), white, 0, 0, 0); add(g, new THREE.SphereGeometry(0.5, 14, 10), white, 0, 0.3, 0, 0.92, 0.6, 0.92); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.2832; add(g, new THREE.SphereGeometry(0.22, 8, 6), white, Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3); }
  add(g, new THREE.CylinderGeometry(0.31, 0.31, 0.08, 14), lam(0xff8a2a, 0x3a1a04), 0, -0.12, 0); over(r, g, top, 0.62); aura(r, 0xff8a2a); }
// THE IRON MASK: a steel visor over its head: one T-shaped slit, gold rivets at the corners, a gold rim
export function maskGear(r, top) { const g = new THREE.Group(), steel = lam(0xa4acb6, 0x1e2126), dark = basic(0x0c0c10), gold = basic(0xf2c84a); add(g, new THREE.SphereGeometry(0.5, 16, 12), steel, 0, 0, 0, 0.82, 1, 0.3); add(g, new THREE.TorusGeometry(0.455, 0.03, 5, 22), gold, 0, 0, 0, 0.9, 1.1, 1);
  for (const z of [0.158, -0.158]) { add(g, new THREE.BoxGeometry(0.52, 0.07, 0.01), dark, 0, 0.13, z); add(g, new THREE.BoxGeometry(0.07, 0.44, 0.01), dark, 0, -0.1, z); for (const [x, y] of [[-0.27, 0.3], [0.27, 0.3], [-0.24, -0.28], [0.24, -0.28]]) add(g, new THREE.CircleGeometry(0.035, 8), gold, x, y, z * 0.9); } over(r, g, top, 0.9); aura(r, 0xa4acb6); }
// THE STEEL TITAN: the machine's own shapes in olive steel (its paint is copied first: the next one of its kind keeps its
// colours), a mast with a red lamp, an olive ring
export function steelGear(r, top) { const done = new Map();
  r.g.traverse((m) => { if (!m.isMesh || !m.material || Array.isArray(m.material) || m.material.transparent) return; const c = m.geometry.attributes.color;
    if (c) { if (!done.has(m.geometry)) { const g2 = m.geometry.clone(), k = g2.attributes.color; for (let i = 0; i < k.count; i++) { const l = k.getX(i) * 0.3 + k.getY(i) * 0.59 + k.getZ(i) * 0.11; k.setXYZ(i, l * 0.62 + 0.07, l * 0.72 + 0.09, l * 0.4 + 0.05); } k.needsUpdate = true; done.set(m.geometry, g2); } m.geometry = done.get(m.geometry); }
    else if (m.material.color) { if (!done.has(m.material)) { const m2 = m.material.clone(), k = m2.color, l = k.r * 0.3 + k.g * 0.59 + k.b * 0.11; k.setRGB(l * 0.62 + 0.07, l * 0.72 + 0.09, l * 0.4 + 0.05); done.set(m.material, m2); } m.material = done.get(m.material); } });
  const g = new THREE.Group(); add(g, new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5), lam(0x30343a), 0, 0, 0); add(g, new THREE.SphereGeometry(0.1, 8, 6), basic(0xff3a2a), 0, 0.4, 0); add(g, new THREE.BoxGeometry(0.5, 0.05, 0.05), lam(0x30343a), 0, 0.15, 0); over(r, g, top, 0.75); aura(r, 0x8a9a52); }
// THE SKY ADMIRAL's aircraft: a six-engined bomber, navy and white with gold bands, a wingspan of three streets.
// Nose toward +z; userData.props: its propellers (they turn about z)
export function makeAdmiral() { const g = new THREE.Group(), navy = lam(0x2e4a7a, 0x060a12), white = lam(0xe8ecf2, 0x1a1c20), gold = lam(0xf2c84a, 0x3a2a06), dark = lam(0x1c2028), glass = lam(0x9fd8f0, 0x12303a), props = [], bx = new THREE.BoxGeometry(1, 1, 1), cy = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const fus = add(g, cy, navy, 0, 0, 0, 1.0, 6.6, 1.0); fus.rotation.x = Math.PI / 2; add(g, new THREE.SphereGeometry(0.5, 12, 9), glass, 0, 0, 3.3, 1, 1, 1.3); add(g, new THREE.SphereGeometry(0.5, 12, 9), navy, 0, 0, -3.3, 1, 1, 1.6); add(g, bx, white, 0, -0.26, 0.2, 0.9, 0.5, 5.6);
  for (const z of [1.6, -1.2]) { const b = add(g, cy, gold, 0, 0, z, 1.03, 0.22, 1.03); b.rotation.x = Math.PI / 2; }
  add(g, bx, navy, 0, 0.1, 0.5, 9.6, 0.14, 1.7); add(g, bx, gold, 0, 0.18, 1.2, 9.6, 0.03, 0.14); for (const s of [-1, 1]) { add(g, bx, white, s * 4.4, 0.19, 0.5, 0.7, 0.03, 1.7); add(g, new THREE.CircleGeometry(0.42, 5).rotateX(-Math.PI / 2), gold, s * 3.0, 0.19, 0.45); }
  for (const s of [-1, 1]) for (const x of [1.3, 2.5, 3.7]) { const e = add(g, cy, dark, s * x, -0.05, 1.05, 0.44, 1.3, 0.44); e.rotation.x = Math.PI / 2; add(g, new THREE.SphereGeometry(0.2, 8, 6), gold, s * x, -0.05, 1.75); const p = new THREE.Group(); p.position.set(s * x, -0.05, 1.86); add(p, bx, dark, 0, 0, 0, 1.3, 0.1, 0.03); add(p, bx, dark, 0, 0, 0, 0.1, 1.3, 0.03); g.add(p); props.push(p); }
  add(g, bx, navy, 0, 0.15, -3.2, 3.4, 0.1, 0.9); for (const s of [-1, 1]) { add(g, bx, navy, s * 1.6, 0.6, -3.3, 0.1, 1.0, 0.9); add(g, bx, gold, s * 1.6, 1.04, -3.3, 0.12, 0.12, 0.9); }
  add(g, new THREE.SphereGeometry(0.34, 10, 8), glass, 0, 0.5, 0.8); add(g, bx, dark, 0, -0.56, 0.2, 0.6, 0.1, 2.2); g.userData.props = props; return g; }
