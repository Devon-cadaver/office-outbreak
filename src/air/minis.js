// Zombie Air Raid's MINI BOSSES: one for each of the first five towns (The Sprawl keeps the Mothership). A mini boss turns up
// when the horde is halfway down to the town's goal; the town's clock stops and its own runs (main.js startMini / miniTick).
// Each is beaten its own way:
//   THE GRAVEDIGGER (Small Town)  a Grave Giant in a top hat, carrying a tombstone as a shield: only hits on its back count
//   THE BROOD QUEEN (Suburbs)     armored until she rears up to lay a brood: hit her then
//   THE TWIN SAUCERS (Downtown)   down one and its twin revives it: both have to go down within a few seconds
//   THE SIEGE WALKER (Metro)      a walker under a shield that only drops while it fires (and cools down after)
//   THE HIVE (Megacity)           a nest that spits gloopers: only the big weapons hurt it
// Here: the models (all our own designs), and the two that are things of their own, the Queen and the Hive (makeMinis).
// The Gravedigger is one of the horde's giants, the twins are UFOs and the Siege Walker is a walker: main.js runs those.
import * as THREE from 'three';
export const MINIS = [
  { key: 'digger', name: '⚰️ THE GRAVEDIGGER', short: 'THE GRAVEDIGGER', hint: '🎯 ONLY HITS ON ITS BACK COUNT', intro: 'ITS TOMBSTONE BLOCKS YOUR SHOTS.\nHIT IT FROM BEHIND!', time: 75, hp: 12, score: 8000 },
  { key: 'queen', name: '👑 THE BROOD QUEEN', short: 'THE BROOD QUEEN', hint: '🎯 HIT HER WHEN SHE REARS UP', intro: 'SHE IS ARMORED UNTIL SHE REARS UP.\nHIT HER THEN!', time: 75, hp: 22, score: 9000 },
  { key: 'twins', name: '🛸 THE TWIN SAUCERS', short: 'THE TWIN SAUCERS', hint: '🎯 DOWN BOTH WITHIN 7 SECONDS', intro: 'DOWN ONE AND ITS TWIN REVIVES IT.\nGET BOTH, FAST!', time: 80, hp: 4, score: 10000 },
  { key: 'siege', name: '🦿 THE SIEGE WALKER', short: 'THE SIEGE WALKER', hint: '🎯 ITS SHIELD DROPS WHEN IT FIRES', intro: 'ITS SHIELD ONLY DROPS WHEN IT FIRES.\nHIT IT THEN!', time: 80, hp: 24, score: 11000 },
  { key: 'hive', name: '🟣 THE HIVE', short: 'THE HIVE', hint: '🎯 ONLY YOUR BIG WEAPONS HURT IT', intro: 'IT SPITS GLOOPERS.\nONLY YOUR BIG WEAPONS HURT IT!', time: 85, hp: 24, score: 12000 },
];
// the Queen: seconds armored, seconds reared up, how many she lays each time, her acid. The Hive: seconds between spits, gloopers a spit
export const QUEEN = { crawl: 5, rear: 4.6, brood: 16, acid: 7, reach: 18 }, HIVE = { every: 6.5, gloop: 4, acid: 7, reach: 20 }, TWIN = { revive: 7 };

const M = (c, e = 0, side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ color: c, emissive: e, flatShading: true, fog: false, side });
const B = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, fog: false, depthWrite: o >= 1 });
const sph = new THREE.SphereGeometry(1, 14, 10), tip = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), UP = new THREE.Vector3(0, 1, 0);
const add = (par, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); par.add(m); return m; };
// a tube from a to b ([x, y, z] each), r0 thick at a and r1 at b
const tube = (par, mat, a, b, r0, r1 = r0) => { const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 7), mat); m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.clone().normalize()); par.add(m); return m; };
const ease = (k) => k * k * (3 - 2 * k);

// ---------- THE GRAVEDIGGER: what a Grave Giant wears to be one (m: the giant's rig from horde.js; its parts are in the
// rig's own units, forward is +z). Returns { slab, lamp }: the tombstone (it flashes when it blocks) and the lantern on its back
export function dressDigger(m) {
  const stone = M(0xa2a8b0, 0x16181c), cut = M(0x4e545c, 0x0a0c0e), moss = M(0x5c8c3c, 0x0c1a06), wood = M(0x4c3424, 0x100a06), black = M(0x17171d, 0x050508), band = M(0x7a3a9a, 0x1a0a22), iron = M(0x3a3e46, 0x08090b);
  // the tombstone, held in front of it: a slab with a round top, a cross cut into it, moss on a shoulder, a crack, chains
  const g = new THREE.Group(), sh = new THREE.Shape(); sh.moveTo(-1.3, -1.6); sh.lineTo(1.3, -1.6); sh.lineTo(1.3, 0.6); sh.absarc(0, 0.6, 1.3, 0, Math.PI, false); sh.lineTo(-1.3, -1.6);
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 1, curveSegments: 8 }), stone); slab.position.z = -0.18; g.add(slab);
  add(g, new THREE.BoxGeometry(0.22, 1.5, 0.1), cut, 0, 0.35, 0.27); add(g, new THREE.BoxGeometry(0.9, 0.22, 0.1), cut, 0, 0.75, 0.27);
  for (const [x, y, r] of [[-0.25, -1.1, 0.5], [0.15, -0.75, -0.45], [0.42, -0.5, 0.35]]) add(g, new THREE.BoxGeometry(0.07, 0.5, 0.06), cut, x, y, 0.27).rotation.z = r;
  add(g, sph, moss, -1.0, 1.25, 0.2, 0.5, 0.3, 0.2); add(g, sph, moss, 0.95, -1.35, 0.2, 0.55, 0.25, 0.2); add(g, sph, moss, -0.75, 1.6, 0.16, 0.3, 0.2, 0.16);
  for (const y of [-0.2, -1.05]) add(g, new THREE.BoxGeometry(2.85, 0.14, 0.5), iron, 0, y, 0);
  g.position.set(0, 1.25, 1.42); g.rotation.x = -0.1; m.torso.add(g);
  // on its back: a coffin on straps, split open, and the soul lantern inside it (the way in)
  const c = new THREE.Group(); add(c, new THREE.BoxGeometry(1.25, 2.5, 0.5), wood, 0, 0, 0); add(c, new THREE.BoxGeometry(1.4, 0.16, 0.6), iron, 0, 0.75, 0); add(c, new THREE.BoxGeometry(1.4, 0.16, 0.6), iron, 0, -0.75, 0);
  const lampM = B(0xa6ff5a), lamp = add(c, sph, lampM, 0, 0.1, -0.32, 0.46); add(c, new THREE.TorusGeometry(0.58, 0.08, 6, 14), iron, 0, 0.1, -0.3); c.position.set(0, 1.55, -1.28); c.rotation.x = 0.16; m.torso.add(c);
  // the top hat, with a band, tipped a little
  const hat = new THREE.Group(); add(hat, new THREE.CylinderGeometry(1.0, 1.0, 0.09, 14), black, 0, 0, 0); add(hat, new THREE.CylinderGeometry(0.7, 0.6, 1.05, 14), black, 0, 0.55, 0); add(hat, new THREE.CylinderGeometry(0.63, 0.62, 0.2, 14), band, 0, 0.16, 0);
  hat.position.set(0, 0.82, 0.02); hat.rotation.set(-0.12, 0, 0.14); m.head.add(hat);
  return { slab, lamp, lampM, stoneM: stone };
}

// ---------- THE BROOD QUEEN: a great bloated sack under plates of shell, a small body and a crowned head in front, six
// legs and two scythes. When she rears, her front lifts and the shell parts down the middle and swings open (userData.front,
// userData.wings): the sack under it glows (userData.abM), and that is when she can be hurt ----------
export function makeQueen() {
  const root = new THREE.Group(), body = new THREE.Group(); body.position.z = -3; root.add(body);
  const abM = new THREE.MeshLambertMaterial({ color: 0xbcc86e, emissive: 0x20260c, flatShading: true, fog: false }), skin = M(0xa9b65e, 0x1c220a), band = M(0x6e7c3c, 0x12160a), shell = M(0x3d2b42, 0x0e0812, THREE.DoubleSide), shellB = M(0x56405e, 0x140c18, THREE.DoubleSide), shell2 = M(0x5c4264, 0x150c19), bone = M(0xe9e2c4, 0x2a281c), gold = M(0xf4d06a, 0x4a3408), sacM = B(0xdfff7a), eyeM = B(0xff3a2a);
  const AZ = 2.0, ax = 1.8, ay = 1.45, az = 2.2, kAt = (dz) => Math.sqrt(Math.max(0.05, 1 - (dz / az) ** 2));
  add(body, sph, abM, 0, 1.5, AZ, ax, ay, az);
  const ringG = new THREE.TorusGeometry(1, 0.045, 5, 22); for (const dz of [-1.6, -0.8, 0, 0.8, 1.6]) { const k = kAt(dz); add(body, ringG, band, 0, 1.5, AZ + dz, ax * k * 1.012, ay * k * 1.012, 1.6); }
  // the shell over her back: two wing cases, each a row of plates like roof tiles with spikes along the top; they hinge low on her flanks
  const HX = 1.72, HY = 0.95, half = [0, 1].map((i) => new THREE.CylinderGeometry(1, 1, 1, 6, 1, true, Math.PI * (i ? 0.4 : 1), Math.PI * 0.6).rotateX(Math.PI / 2));
  const wings = [-1, 1].map((s) => { const w = new THREE.Group(); w.position.set(s * HX, HY, AZ); body.add(w);
    [-1.5, -0.6, 0.3, 1.2].forEach((dz, j) => { const k = kAt(dz), p = add(w, half[s > 0 ? 1 : 0], j % 2 ? shellB : shell, -s * HX, 1.5 - HY, dz, ax * k * 1.1, ay * k * 1.13, 1.2); p.rotation.x = 0.1; add(w, tip, bone, -s * HX + s * 0.3, 1.5 - HY + ay * k * 1.08, dz, 0.15, 0.6, 0.15).rotation.set(-0.25, 0, -s * 0.3); }); return w; });
  // egg sacs low on her flanks
  const sacs = []; for (const s of [-1, 1]) for (let j = 0; j < 4; j++) { const dz = -1.2 + j * 0.85, k = kAt(dz); sacs.push(add(body, sph, sacM, s * ax * k * 0.9, 0.92, AZ + dz, 0.25 + (j % 2) * 0.08)); }
  // four legs under the sack: up to a knee and down to the ground
  const leg = (par, s, z, y0, dz0) => { tube(par, shell2, [s * 1.0, y0, z], [s * 2.35, y0 + 1.0, z + 0.15], 0.17, 0.12); tube(par, shell2, [s * 2.35, y0 + 1.0, z + 0.15], [s * 3.0, dz0, z + 0.45], 0.12, 0.04); };
  for (const s of [-1, 1]) for (const z of [2.3, 3.1]) leg(body, s, z, 1.25, 0.02);
  // her front: it lifts when she rears. The body, a plate over it, two legs, the head (jaws, six eyes, a crown) and two scythes
  const front = new THREE.Group(); front.position.set(0, 1.3, 3.8); body.add(front); const F = (y, z) => [y - 1.3, z - 3.8];
  add(front, sph, skin, 0, ...F(1.75, 4.5), 0.95, 1.05, 0.9); add(front, new THREE.CylinderGeometry(1, 1, 1, 9, 1, true, Math.PI * 0.45, Math.PI * 1.1).rotateX(Math.PI / 2), shell, 0, ...F(1.75, 4.45), 1.06, 1.2, 1.0);
  for (const s of [-1, 1]) leg(front, s, 0.75, -0.05, -1.28);
  const head = new THREE.Group(); head.position.set(0, ...F(2.3, 5.25)); front.add(head); add(head, sph, shell2, 0, 0, 0, 0.68, 0.62, 0.72);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(head, sph, eyeM, s * (0.2 + i * 0.15), 0.16 - i * 0.09, 0.6 - i * 0.14, 0.09);
  const jaws = [-1, 1].map((s) => { const j = new THREE.Group(); j.position.set(s * 0.4, -0.28, 0.42); add(j, tip, bone, 0, 0, 0, 0.14, 0.95, 0.14).rotation.x = Math.PI / 2 + 0.35; j.userData.s = s; head.add(j); return j; });
  add(head, new THREE.TorusGeometry(0.5, 0.07, 6, 16).rotateX(Math.PI / 2), gold, 0, 0.42, -0.05);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832, c = add(head, tip, gold, Math.sin(a) * 0.48, 0.42, -0.05 + Math.cos(a) * 0.48, 0.1, i % 2 ? 0.42 : 0.62, 0.1); c.rotation.z = -Math.sin(a) * 0.3; c.rotation.x = Math.cos(a) * 0.3; }
  const claws = [-1, 1].map((s) => { const c = new THREE.Group(); c.position.set(s * 0.85, ...F(2.0, 4.6)); tube(c, shell2, [0, 0, 0], [s * 0.95, 0.95, 0.9], 0.2, 0.15); tube(c, bone, [s * 0.95, 0.95, 0.9], [s * 0.45, -0.55, 2.1], 0.17, 0.02); front.add(c); return c; });
  // the mark on the ground while she can be hurt
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.3, 44).rotateX(-Math.PI / 2), B(0xffe14a, 0.85)); ring.material.depthTest = false; ring.renderOrder = 4; ring.position.y = 0.14; ring.visible = false; root.add(ring);
  root.userData = { front, wings, abM, sacs, jaws, claws, ring, head }; return root;
}

// ---------- THE HIVE: a mound of lumps, pitted with glowing cells, chimneys, a toothed maw on top that swells before it
// spits, roots creeping out over the street ----------
const wob = (x, y, z, s) => Math.sin(x * 5.1 + s) * Math.cos(y * 4.3 + s * 1.7) + Math.sin(z * 6.2 + s * 0.6) * 0.6;
function lump(seed, detail = 2, amp = 0.15) { const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + amp * wob(x, y, z, seed); p.setXYZ(i, x * n, y * n, z * n); } g.computeVertexNormals(); return g; }
export function makeHive() {
  const root = new THREE.Group(), flesh = M(0x5a3260, 0x170c19), flesh2 = M(0x7e4874, 0x1d0f1d), dark = M(0x2c1830, 0x080408), bone = M(0xe6dfc2, 0x2a281c), glowM = B(0xa6ff3a), gooM = B(0xd8ff7a), SEED = 1.3, R = [2.7, 2.3, 2.7], CY = 1.15;
  add(root, lump(SEED), flesh, 0, CY, 0, R[0], R[1], R[2]);
  const lobes = [[2.0, 0.7, 0.7, 1.5, 2.1], [-1.9, 0.75, -0.8, 1.6, 3.4], [0.5, 0.6, 2.1, 1.4, 5.2], [-0.8, 0.8, -2.0, 1.5, 0.4], [1.5, 0.55, -1.6, 1.15, 4.4], [-1.7, 0.5, 1.6, 1.2, 6.1]];
  for (const [x, y, z, s, sd] of lobes) add(root, lump(sd, 1), s > 1.45 ? flesh2 : flesh, x, y, z, s, s * 0.85, s);
  // the cells: glowing six-sided pits all over the mound, each with a dark rim
  const hexG = new THREE.CircleGeometry(1, 6), rimG = new THREE.RingGeometry(0.95, 1.4, 6), cells = [];
  for (let i = 0; i < 18; i++) { const th = i * 2.39996, v = 0.08 + 0.84 * (i + 0.5) / 18, sr = Math.sqrt(1 - v * v), dx = Math.cos(th) * sr, dz = Math.sin(th) * sr, n = (1 + 0.15 * wob(dx, v, dz, SEED)) * 1.02, s = 0.2 + (i % 3) * 0.07;
    const c = new THREE.Group(); c.position.set(dx * n * R[0], CY + v * n * R[1], dz * n * R[2]); c.lookAt(c.position.x + dx / R[0], c.position.y + v / R[1], c.position.z + dz / R[2]); add(c, hexG, glowM, 0, 0, 0.02, s); add(c, rimG, dark, 0, 0, 0, s); root.add(c); cells.push(c); }
  // chimneys, lit from inside
  for (const [x, z, h, r, tx, tz] of [[1.5, 0.9, 2.3, 0.62, 0.25, 0.1], [-1.4, -0.7, 2.9, 0.7, -0.2, -0.12], [0.2, -1.7, 1.9, 0.55, 0.05, -0.3], [-0.9, 1.6, 1.6, 0.5, -0.15, 0.28]]) { const g = new THREE.Group(); g.position.set(x, 1.5, z); g.rotation.set(tz, 0, -tx); root.add(g);
    add(g, new THREE.CylinderGeometry(r * 0.62, r, h, 8), flesh2, 0, h / 2, 0); add(g, new THREE.TorusGeometry(r * 0.6, r * 0.2, 6, 10).rotateX(Math.PI / 2), dark, 0, h, 0); add(g, new THREE.CircleGeometry(r * 0.5, 8).rotateX(-Math.PI / 2), glowM, 0, h + 0.06, 0); }
  // the maw on top: a thick lip, teeth leaning in, the glow in its throat
  const maw = new THREE.Group(); maw.position.set(0, 3.82, 0); root.add(maw); add(maw, new THREE.TorusGeometry(0.95, 0.36, 7, 14).rotateX(Math.PI / 2), dark, 0, 0, 0); add(maw, new THREE.CircleGeometry(0.9, 12).rotateX(-Math.PI / 2), glowM, 0, 0.08, 0);
  for (let i = 0; i < 9; i++) { const g = new THREE.Group(); g.rotation.y = i / 9 * 6.2832; add(g, tip, bone, 0.92, 0.22, 0, 0.13, 0.6, 0.13).rotation.z = 0.55; maw.add(g); }
  // roots over the street, and sacs of goo on the lobes
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.2832 + 0.3, pt = (r, da, y) => new THREE.Vector3(Math.cos(a + da) * r, y, Math.sin(a + da) * r); root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([pt(2.0, 0, 0.6), pt(3.0, 0.22, 0.26), pt(3.7, -0.1, 0.12), pt(4.3, 0.2, 0.03)]), 8, 0.2 - (i % 2) * 0.05, 5), flesh2)); }
  const sacs = lobes.map(([x, y, z, s], i) => add(root, sph, gooM, x * 1.05, y + s * 0.8, z * 1.05, 0.24 + (i % 3) * 0.06));
  root.userData = { maw, glowM, gooM, cells, sacs }; return root;
}

// ---------- THE SIEGE WALKER: what a walker wears to be one (g: makeWalker's group, in the colours below). An armored
// collar, pauldrons, two long guns, a shield generator on its back, a pennant; and the shield itself (userData.dome) ----------
export const SIEGE_PAL = [0x7c2222, 0x2c1818, 0xffc23a, 0xfff2b0];
export function siegeKit(g) {
  const u = g.userData, head = u.head, red = M(0x8a2626, 0x1a0606), dark = M(0x26282e, 0x060608), gold = M(0xe8b43a, 0x3a2606), coilM = B(0x6ad8ff);
  add(head, new THREE.CylinderGeometry(1.3, 0.95, 0.5, 8), red, 0, 0.42, 0); add(head, new THREE.TorusGeometry(1.3, 0.07, 5, 8).rotateX(Math.PI / 2), gold, 0, 0.67, 0);
  for (const s of [-1, 1]) { add(head, sph, red, s * 1.02, 1.2, 0, 0.5, 0.42, 0.55); add(head, new THREE.CylinderGeometry(0.13, 0.16, 1.9, 8).rotateX(Math.PI / 2), dark, s * 1.02, 1.28, 0.95); add(head, new THREE.TorusGeometry(0.17, 0.05, 5, 10), gold, s * 1.02, 1.28, 1.9); add(head, new THREE.TorusGeometry(0.19, 0.05, 5, 10), gold, s * 1.02, 1.28, 0.6); }
  add(head, new THREE.BoxGeometry(0.9, 0.8, 0.5), dark, 0, 1.15, -0.85); const coils = [0.95, 1.2, 1.45].map((y) => add(head, new THREE.TorusGeometry(0.34, 0.07, 5, 12).rotateX(Math.PI / 2), coilM, 0, y, -1.2));
  add(head, new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), dark, 0.42, 2.3, -0.9); { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.9, -0.28); sh.lineTo(0, -0.56); const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xff3a2a, side: THREE.DoubleSide, fog: false })); f.position.set(0.44, 3.38, -0.9); f.rotation.y = Math.PI / 2; head.add(f); }
  // the shield: a bubble round the body (it does not turn with the head)
  const dome = new THREE.Group(); dome.position.y = 0.75; const bubM = new THREE.MeshBasicMaterial({ color: 0x4ab4ff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), netM = new THREE.MeshBasicMaterial({ color: 0x9adcff, wireframe: true, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
  const bub = add(dome, new THREE.SphereGeometry(2.9, 20, 14), bubM, 0, 0, 0), net = add(dome, new THREE.IcosahedronGeometry(2.93, 1), netM, 0, 0, 0); bub.renderOrder = net.renderOrder = 3; g.add(dome);
  u.dome = dome; u.net = net; u.bubM = bubM; u.coilM = coilM; return u;
}

// ---------- THE TWIN SAUCERS: a saucer in its twin's colours (i: 0 the blue one, 1 the pink one), with the mast the beam
// between them runs from. Returns its colour ----------
export function twinTint(g, i) { const col = i ? 0xff5ad8 : 0x4ad8ff, u = g.userData;
  g.children[0].material = new THREE.MeshLambertMaterial({ color: i ? 0xb85aa6 : 0x4a9cc0, emissive: i ? 0x2a0a22 : 0x08222e }); const dome = u.strip[2]; dome.material.color.setHex(col); dome.material.emissive.setHex(i ? 0x8a1a6a : 0x1a6a8a); u.eye.material.color.setHex(col); u.shield.material.color.setHex(col);
  add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.8, 5), M(0x30343a), 0, 1.4, 0); u.mast = add(g, sph, B(col), 0, 1.9, 0, 0.2); return col; }

// ---------- the Queen and the Hive in play. E: { scene, fx, sfx, horde, popup, craft(), safe(), hurtCraft(dmg, why, label, color), boom(), jolt(k) }
// m: the one that is up (or null): { key, root, x, z, aim (where to shoot at it), hp, max, live, st, t }.
// hit() and blast() return 0 (nothing), 1 (hurt) or 2 (that finished it) ----------
export function makeMinis(E) {
  let m = null; const globs = [], globG = new THREE.SphereGeometry(0.3, 8, 6), globM = B(0xb4ff4a), col = new THREE.Color(), GREEN = { c: [0xb4ff5a, 0x5a9a1a], speed: 5, up: 4, life: 0.6 };
  const free = (o) => o.traverse((q) => { if (q.isMesh) { q.geometry.dispose(); if (q.material.dispose) q.material.dispose(); } });
  function clear() { if (m) { E.scene.remove(m.root); free(m.root); m = null; } for (const g of globs) E.scene.remove(g.m); globs.length = 0; }
  function start(key, x, z, hp) { clear(); const root = key === 'queen' ? makeQueen() : makeHive(); root.position.set(x, -4.5, z); E.scene.add(root); const c = E.craft();
    m = { key, root, x, z, aim: new THREE.Vector3(x, key === 'queen' ? 2.2 : 3, z), hp, max: hp, live: true, st: 'rise', t: 0, face: c ? Math.atan2(c.pos.x - x, c.pos.z - z) : 0, flash: 0, cd: 3, n: 0, sayT: 0, ph: 0, pitch: 0 }; root.rotation.y = m.face; return m; }
  const say = (text, color) => { if (m.sayT > 0) return; m.sayT = 1.5; E.popup(m.aim, text, color); };
  // a blob of acid, thrown where the aircraft is heading
  function spit(from, dmg) { const c = E.craft(); if (!c || !c.alive || c.crash || E.safe()) return; const T = from.distanceTo(c.pos) / 12, to = new THREE.Vector3(c.pos.x + c.vel.x * T * 0.8, c.pos.y, c.pos.z + c.vel.z * T * 0.8), g = new THREE.Mesh(globG, globM); g.position.copy(from); E.scene.add(g); globs.push({ m: g, v: to.sub(from).setLength(12), t: 0, life: T + 0.9, dmg, tr: 0 }); E.sfx.throw(); }
  function tickGlobs(dt) { const c = E.craft(); for (let i = globs.length - 1; i >= 0; i--) { const g = globs[i], P = g.m.position; P.addScaledVector(g.v, dt); g.t += dt; g.tr -= dt; if (g.tr <= 0) { g.tr = 0.05; E.fx.sparks(P, 1, { c: [0xb4ff5a, 0x5a9a1a], speed: 0.6, up: 0.3, life: 0.35 }); }
      const hit = c && c.alive && !c.crash && !E.safe() && P.distanceTo(c.pos) < c.S.r * 0.8 + 0.55; if (hit) { E.sfx.splat(); E.hurtCraft(g.dmg, 'acid', '-' + g.dmg + ' ACID!', '#b4ff5a'); } if (hit || g.t > g.life) { E.fx.sparks(P, 6, GREEN); E.scene.remove(g.m); globs.splice(i, 1); } } }
  function hit(dmg, at, big) { if (!m || !m.live || m.st === 'rise') return 0;
    if (m.key === 'queen' && m.st !== 'rear') { say('ARMORED! WAIT FOR HER TO REAR UP', '#c8cad8'); E.fx.sparks(at, 4, { c: [0xd8d8e8, 0x8a8a9a], speed: 4, up: 3, life: 0.3 }); return 0; }
    if (m.key === 'hive' && !big) { say('TOO TOUGH! USE A BIG WEAPON', '#c8cad8'); E.fx.sparks(at, 4, { c: [0xd8d8e8, 0x8a8a9a], speed: 4, up: 3, life: 0.3 }); return 0; }
    m.hp -= dmg; m.flash = 0.2; E.fx.sparks(at, 8, GREEN); if (m.hp > 0) return 1;
    m.hp = 0; m.live = false; m.st = 'dead'; m.t = 0; m.n = 0; m.root.userData.ring && (m.root.userData.ring.visible = false); E.sfx.groan(true); return 2; }
  function blast(x, z, r, dmg, big) { if (!m || !m.live) return 0; if (Math.hypot(x - m.x, z - m.z) > r + (m.key === 'hive' ? 3.1 : 2.6)) return 0; return hit(dmg, new THREE.Vector3(x, 1.2, z), big); }
  function leave() { if (m && m.live) { m.live = false; m.st = 'sink'; m.t = 0; if (m.root.userData.ring) m.root.userData.ring.visible = false; } }
  function burst(k) { const p = new THREE.Vector3(m.x + (Math.random() - 0.5) * 4 * k, 0.8 + Math.random() * 2.2, m.z + (Math.random() - 0.5) * 4 * k); E.fx.explode(p, 0.9 + Math.random() * 0.8); E.fx.sparks(p, 14, { c: [0xb4ff5a, 0xe8ff9a, 0x5a9a1a], speed: 7, up: 6, life: 0.8 }); E.boom(); }
  function tick(dt) { tickGlobs(dt); if (!m) return; const R = m.root, u = R.userData, c = E.craft(), go = !!c && c.alive && !c.crash; m.t += dt; m.ph += dt; m.flash = Math.max(0, m.flash - dt); m.sayT -= dt;
    if (m.st === 'rise') { const k = Math.min(1, m.t / 1.5); R.position.y = -4.5 * (1 - ease(k)); if (Math.random() < dt * 22) { const a = Math.random() * 6.28; E.fx.dust({ x: m.x + Math.cos(a) * 3, y: 0, z: m.z + Math.sin(a) * 3 }, 1.3, Math.cos(a) * 2, Math.sin(a) * 2); } if (k >= 1) { m.st = m.key === 'queen' ? 'crawl' : 'idle'; m.t = 0; E.jolt(0.5); E.sfx.stomp(4); } }
    else if (m.st === 'sink') { R.position.y -= dt * 2.6; if (m.t > 2.2) { clear(); return; } }
    else if (m.st === 'dead') { /* it bursts, a piece at a time, and goes flat */ if (m.t > m.n * 0.28 && m.n < 7) { m.n++; burst(1); E.jolt(0.3); } const k = Math.min(1, m.t / 2); R.scale.set(1 + k * 0.15, 1 - k * 0.8, 1 + k * 0.15); if (m.t > 2) R.position.y -= dt * 1.2;
      if (m.t > 3.4) { E.fx.scorch(new THREE.Vector3(m.x, 0, m.z), 3.2, 30); clear(); return; } }
    else if (m.key === 'queen') { let want = 0;
      if (go) { let d = Math.atan2(c.pos.x - m.x, c.pos.z - m.z) - m.face; d = Math.atan2(Math.sin(d), Math.cos(d)); m.face += d * Math.min(1, dt * 0.7); R.rotation.y = m.face; }
      if (m.st === 'crawl') { if (m.t > QUEEN.crawl && go) { m.st = 'rear'; m.t = 0; m.n = 0; m.laid = false; m.sayT = 0; say('⚠ SHE REARS UP: HIT HER NOW!', '#ffe14a'); E.sfx.groan(true); } }
      else { want = 0.85; const fx0 = Math.sin(m.face), fz0 = Math.cos(m.face); if (!m.laid && m.t > 0.7) { m.laid = true; if (E.horde.wave(QUEEN.brood, m.x, m.z)) E.popup({ x: m.x + fx0 * 3.4, y: 0.5, z: m.z + fz0 * 3.4 }, '🧟 A BROOD!', '#b4ff5a'); E.sfx.splat(); }
        if (m.n < 3 && m.t > 1 + m.n * 1.1) { m.n++; if (go && Math.hypot(c.pos.x - m.x, c.pos.z - m.z) < QUEEN.reach) spit(u.head.getWorldPosition(new THREE.Vector3()), QUEEN.acid); } if (m.t > QUEEN.rear) { m.st = 'crawl'; m.t = 0; } }
      m.pitch += (want - m.pitch) * Math.min(1, dt * 3.2); const open = m.pitch / 0.85, pulse = 0.5 + 0.5 * Math.sin(m.ph * 9); u.front.rotation.x = -open * 0.62; u.wings[0].rotation.z = open * 1.05; u.wings[1].rotation.z = -open * 1.05;
      u.ring.visible = m.st === 'rear'; u.ring.material.opacity = 0.55 + pulse * 0.4; u.ring.scale.setScalar(1 + pulse * 0.04);
      if (m.flash > 0) u.abM.emissive.setHex(0xffffff); else u.abM.emissive.setRGB(0.125 + open * (0.75 + pulse * 0.12), 0.15 + open * (0.2 + pulse * 0.16), 0.05);
      for (const j of u.jaws) j.rotation.y = j.userData.s * (0.15 + open * 0.5 + Math.sin(m.ph * 7) * 0.08); u.claws.forEach((q, i) => { q.rotation.x = -open * 0.7 + Math.sin(m.ph * 2.2 + i * 2) * 0.12; });
      u.sacs.forEach((q, i) => q.scale.setScalar((0.25 + (i % 2) * 0.08) * (1 + Math.sin(m.ph * 3 + i) * 0.14))); u.head.rotation.z = Math.sin(m.ph * 1.3) * 0.1; }
    else { /* the Hive: it swells, then spits a clutch of gloopers into the street and acid at you */ m.cd -= dt; let sw = 0;
      if (m.st === 'idle') { if (m.cd <= 0 && go) { m.st = 'swell'; m.t = 0; E.sfx.groan(true); } }
      else { sw = Math.min(1, m.t / 0.9); if (m.t >= 0.9) { m.st = 'idle'; m.cd = HIVE.every; const top = u.maw.getWorldPosition(new THREE.Vector3());
          if (E.horde.wave(HIVE.gloop, m.x, m.z, 900, 1)) E.popup({ x: m.x, y: 4.6, z: m.z }, '🟢 GLOOPERS!', '#b4ff5a'); E.fx.sparks(top, 16, GREEN); E.sfx.splat(); if (go && Math.hypot(c.pos.x - m.x, c.pos.z - m.z) < HIVE.reach) { spit(top, HIVE.acid); setTimeout(() => { if (m && m.live) spit(top, HIVE.acid); }, 450); } } }
      const pulse = 0.5 + 0.5 * Math.sin(m.ph * 3.2); u.maw.scale.setScalar(1 + sw * 0.5 + pulse * 0.05); R.scale.set(1 + pulse * 0.015, 1 + sw * 0.06 - pulse * 0.02, 1 + pulse * 0.015);
      if (m.flash > 0) u.glowM.color.setHex(0xffffff); else u.glowM.color.setRGB(0.5 + sw * 0.5 + pulse * 0.15, 0.85 + pulse * 0.15, 0.2 + sw * 0.3); u.sacs.forEach((q, i) => q.scale.setScalar((0.24 + (i % 3) * 0.06) * (1 + Math.sin(m.ph * 4 + i * 1.7) * 0.2))); } }
  return { start, clear, tick, hit, blast, leave, get m() { return m; } };
}
