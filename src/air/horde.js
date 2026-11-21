// Zombie Air Raid: the horde and the town's last survivors. Every zombie and every townsperson is only an empty marker (a
// position, a facing, outfit colours and a step): the crowd (crowd.js) draws all of them as one batch, so three hundred
// zombies cost the same single draw as thirty, and only the ones on screen are handed to it each frame. Their glowing eyes,
// the gloopers' glands and the acid in flight are one batch each as well.
//   ZOMBIES shamble toward the nearest living person along the streets: a map of the town that says, for every street
//     square, how far it is to the nearest person, is worked out a few times a second, and each zombie walks downhill on
//     it. Close up they go straight for you. Whoever they catch drops, twitches and gets up as one of them.
//   GLOOPERS (about one in twelve, glowing green) stop and lob acid at an aircraft flying close and low.
//   GRAVE GIANTS (from Downtown on) climb out of the ground nearly as big as a kaiju and lumber along the streets; the game
//     has them rip chunks off buildings and throw them at the aircraft (see the end of this file).
//   PEOPLE run from zombies, giants and fire (the same kind of map, from the zombies' squares, climbed uphill), shout for
//     help, and mill about near home when it is quiet.
// Burning or blasted bodies fly, fall and lie about for a few seconds, still drawn by the same batch.
import * as THREE from 'three';
import { CELL, toWorld } from '../city.js';
import { OUTFITS } from '../poster/characters.js';
import { createCrowd } from '../crowd.js';
import { hordeLook, hordeAny, hordeCols, hordeOf, hordeFigure, patchCrowdShader, hordeGiant, puffPair } from '../hordeSkins.js';
import { mergeParts } from '../perf.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const rnd = (a, b) => a + Math.random() * (b - a), noop = () => {};
const DARK = (c, f) => new THREE.Color(c).multiplyScalar(f).getHex(); // the same darkening characters.js uses for its zombies
const ZSKIN = 0x9cf57a, BURNT = [0x1c1612, 0x16120f, 0x2a1e16, 0x120e0b], SCORCH = [0x3a2a1e, 0x2a2018, 0x5a4a3a, 0x2a2018];
const MIX = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
// sizes: people are drawn at the town's usual 0.25; zombies a size up and gloopers bigger still, so that from up in the
// air the horde reads as a horde, and a lone zombie as more than a speck (one draw for all of them either way: the crowd
// takes each marker's own scale)
export const CIV_S = 0.25, ZOMBIE_S = 0.35, SPIT_S = 0.39;
// CROWD_MAX: how many figures the crowd (and the zombies' glowing eyes) can draw at once. Nobody new ever appears in a round
// (the bitten move from the people to the horde, the dead drop out), so a town needs room for its zombies plus its people:
// the biggest town has 600 + 120, and the test override (?z=N in main.js, at most 900) 900 + 120, with room to spare
export const CROWD_MAX = 1200;
const colsOf = (o) => [o.shirt, o.pants, o.skin, o.hair == null ? o.skin : o.hair];
const zombieCols = (o) => [MIX(DARK(o.shirt, 0.7), 0x6f9e4e, 0.55), MIX(DARK(o.pants, 0.6), 0x34422a, 0.5), ZSKIN, o.hair == null ? ZSKIN : MIX(DARK(o.hair, 0.55), 0x2a3a1e, 0.4)]; // rags gone green-grey, sickly green skin: the horde reads as one green mass, people keep their bright clothes
const SPIT_COLS = [0xb4f03a, 0x3e6a1a, 0xeaff9a, 0x8ad02a]; // gloopers: bright acid green all over, so they stand out in the horde
const OUTS = ['worker', 'pink', 'plaid', 'hivis', 'suit', 'hoodie', 'punk', 'vest'];
const SHOUTS = ['HELP!', 'RUN!', 'AAAH!', 'ZOMBIES!', 'NOT ME!', 'SAVE US!'];
const SPIT_R = 9.5, SPIT_TOP = 4.7, GRAV = 9, MAXB = 28; // spit reach (ground distance), how high an aircraft must be to be safe, acid's gravity, most blobs in the air
// the numbers that set how fast the town falls (the test hooks can change them: __ar.horde.tune)
//   zv: zombie walking speeds; smell: how many street squares away a zombie notices someone (further off it just wanders);
//   fv: how fast people run; panic: how many squares away a zombie has to be before people run; feed: how long a zombie
//   stays down over its victim; turn: how long the victim lies there before getting up as one of them
export const TUNE = { zv: [0.5, 0.75], sv: [0.45, 0.6], smell: 3, fv: [2.0, 2.4], panic: 3, feed: 3, turn: 2, preyR: 4.4, wander: 0.5, roam: 0.7, hordeStep: [6, 10], drift: 0.2 }; // drift: how often a horde's rally point steps toward the nearest person rather than anywhere
// ---------- GRAVE GIANTS: zombies grown nearly as big as a kaiju, in the horde's own look (grey-green skin, torn clothes,
// glowing eyes), hunched over on long arms. They climb out of the ground, lumber along the streets (people run from them)
// and, when an aircraft comes near, rip a chunk off a building, hold it up and throw it. This file walks, poses and fells
// them; the game (main.js) says when to throw and works out the chunk, the red ring and where it lands. A giant is a handful
// of merged meshes, one per limb, with a material of its own so it can flash when it is hit ----------
const GSKIN = 0x80a06c, GSKIN2 = 0x5c7650, GBOOT = 0x1c1e18, WOUND = 0x8a1010, GRAGS = [[0x3c4c7c, 0x282a3a], [0x7c3630, 0x30241f], [0x6c5032, 0x2c241c], [0x60666e, 0x2a2c32]]; // grey-green skin and dark rags (navy, maroon, brown, grey: never purple, so nothing about it says a certain green comic-book giant): a rotting body that stands out from the pale streets
export const G_HIP = 2.2, G_SIZE = 1.45, G_R = 1.75; // hip height and overall scale (about 7.3 tall, hunched over: above all but the towers); G_R: how wide it is, for hits
const gMats = new Map(), gMat = (c) => { let m = gMats.get(c); if (!m) gMats.set(c, (m = new THREE.MeshLambertMaterial({ color: c }))); return m; };
const gBall = new THREE.IcosahedronGeometry(0.5, 1), gCap = new THREE.CapsuleGeometry(0.5, 1, 2, 7), gBox = new THREE.BoxGeometry(1, 1, 1); // low-poly and flat-shaded, like the kaiju: the facets give it a shape you can read from the air
// the eyes: a hot core and a soft halo each, glowing, so they show from high up (one draw for all four)
const gEyes = (() => { const parts = []; for (const s of [-1, 1]) for (const [r, c] of [[0.15, 0xf2ffc0], [0.26, 0x4a9a1a]]) { const g = new THREE.SphereGeometry(r, 10, 8).translate(s * 0.22, 0.4, 0.47), n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g); } return mergeGeometries(parts); })();
const gEyeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const gShadow = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), gShadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
// the outline: each limb's shape pushed out along its surface and drawn from the inside, near-black (one extra draw a limb)
const gLineMat = new THREE.MeshBasicMaterial({ color: 0x0a1208, side: THREE.BackSide, fog: false });
const gOutline = (geo, w) => { const g = new THREE.BufferGeometry(), P = geo.attributes.position, N = geo.attributes.normal, a = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) { a[i * 3] = P.getX(i) + N.getX(i) * w; a[i * 3 + 1] = P.getY(i) + N.getY(i) * w; a[i * 3 + 2] = P.getZ(i) + N.getZ(i) * w; } g.setAttribute('position', new THREE.BufferAttribute(a, 3)); if (geo.index) g.setIndex(geo.index); return g; };
// a horde skin's giant (hordeSkins.js hordeGiant) gets the same finish as makeGiant's: flat, unfogged paint and the outline
function paintGiant(m) { const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x0e120c, flatShading: true, fog: false }), limbs = []; m.root.traverse((o) => { if (o.isMesh && o.material && o.material.vertexColors && !o.material.transparent) { o.material = mat; limbs.push(o); } });
  for (const o of limbs) { const l = new THREE.Mesh(gOutline(o.geometry, 0.07), gLineMat); l.position.copy(o.position); l.quaternion.copy(o.quaternion); l.scale.copy(o.scale); o.parent.add(l); } m.mat.dispose(); m.mat = mat; return m; }
export function makeGiant(k = 0) { const [shirt, pants] = GRAGS[k % GRAGS.length], root = new THREE.Group(); root.rotation.order = 'YXZ'; /* it topples forward, whichever way it faces */
  const P = (par, geo, c, sx, sy, sz, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, gMat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); par.add(m); return m; };
  const grp = (par, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; }, wob = () => Math.random() - 0.5;
  const body = grp(root, 0, 0, 0); body.scale.setScalar(G_SIZE); const hips = grp(body, 0, G_HIP, 0);
  const legs = [-1, 1].map((s) => { const L = grp(hips, s * 0.56, 0, 0); P(L, gCap, pants, 0.74, 0.62, 0.74, 0, -0.62, 0); P(L, gCap, GSKIN2, 0.56, 0.48, 0.56, 0, -1.5, 0.03); /* a bare shin under the torn trouser leg */
    for (let i = 0; i < 3; i++) P(L, gBox, pants, 0.22, 0.34 + Math.random() * 0.2, 0.1, (i - 1) * 0.24, -1.2, 0.34 - Math.abs(i - 1) * 0.1, 0.2, wob() * 0.6); /* rags round the hem */
    P(L, gBox, GBOOT, 0.64, 0.32, 1.0, 0, -2.04, 0.2); return L; });
  const torso = grp(hips, 0, 0, 0);
  P(torso, gCap, shirt, 2.1, 0.76, 1.45, 0, 1.18, 0); P(torso, gBall, shirt, 2.35, 1.2, 1.5, 0, 1.95, -0.22); /* a broad, hunched back */
  P(torso, gBall, GSKIN, 1.05, 0.85, 0.42, 0.26, 0.86, 0.62); P(torso, gBall, GSKIN2, 0.62, 0.48, 0.3, -0.52, 1.52, 0.66); /* skin through the torn shirt */
  for (let i = 0; i < 3; i++) P(torso, gBall, WOUND, 0.32, 0.2, 0.08, -0.62 + i * 0.52 + wob() * 0.2, 1.15 + Math.random() * 0.6, 0.72);
  for (let i = 0; i < 5; i++) P(torso, gBox, shirt, 0.3, 0.5 + Math.random() * 0.35, 0.1, -0.86 + i * 0.43, 0.2, 0.56 - (i % 2) * 0.12, 0.12, wob() * 0.8); /* the shirt hangs in rags */
  P(torso, gBox, pants, 2.02, 0.24, 1.36, 0, 0.34, 0);
  const head = grp(torso, 0, 2.42, 0.56);
  P(head, gBall, GSKIN, 1.02, 0.94, 1.02, 0, 0.32, 0.04); P(head, gBox, GSKIN2, 0.9, 0.17, 0.3, 0, 0.56, 0.4); P(head, gBox, GSKIN2, 0.68, 0.28, 0.52, 0, 0.0, 0.3); P(head, gBox, WOUND, 0.48, 0.11, 0.14, 0, 0.12, 0.53); /* a heavy brow, a slack jaw, a gaping mouth */
  for (let i = 0; i < 4; i++) P(head, gBox, 0x2a2e22, 0.17, 0.24, 0.17, -0.3 + i * 0.2, 0.8, -0.05 + (i % 2) * 0.16, wob() * 0.7, wob() * 0.7);
  const eyes = new THREE.Mesh(gEyes, gEyeMat); eyes.renderOrder = 2; head.add(eyes);
  const arms = [-1, 1].map((s) => { const A = grp(torso, s * 1.16, 1.96, 0.1); P(A, gCap, shirt, 0.64, 0.46, 0.64, 0, -0.52, 0); P(A, gCap, GSKIN, 0.52, 0.76, 0.52, 0, -1.34, 0); P(A, gCap, GSKIN, 0.48, 0.72, 0.48, 0, -2.24, 0.04); P(A, gBall, GSKIN2, 0.74, 0.6, 0.64, 0, -2.96, 0.08);
    for (let i = 0; i < 3; i++) P(A, gBox, GSKIN2, 0.13, 0.42, 0.15, (i - 1) * 0.21, -3.3, 0.18, 0.3); /* long fingers */
    const hand = new THREE.Object3D(); hand.position.set(0, -3.05, 0.12); A.add(hand); A.userData.hand = hand; A.rotation.z = s * 0.12; return A; });
  mergeParts(root); const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x0e120c, flatShading: true, fog: false }); /* (no haze on it: it stands out from the town in every season) */ const limbs = []; root.traverse((m) => { if (m.isMesh && m.material && m.material.vertexColors && !m.material.transparent) { m.material = mat; limbs.push(m); } }); // its own paint, so a hit can flash it
  for (const m of limbs) { const o = new THREE.Mesh(gOutline(m.geometry, 0.07), gLineMat); o.position.copy(m.position); o.quaternion.copy(m.quaternion); o.scale.copy(m.scale); m.parent.add(o); }
  const shadow = new THREE.Mesh(gShadow, gShadowMat); shadow.scale.setScalar(2.3); shadow.position.y = 0.06; shadow.renderOrder = 1;
  return { root, body, hips, torso, head, legs, arms, mat, shadow };
}
const ease = (k) => k * k * (3 - 2 * k), mix = (a, b, k) => a + (b - a) * k;
const turnTo = (o, want, k) => { let d = want - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, k); };

export function createHorde(E) { // E: { scene, fx, popup, collide(o), craft(), fireAt(x, z), fireCells(), townSkin(), giantRip(G), giantRelease(G), on: { bite, turned, kill, civLost, spit, hitCraft, saved, giantStep, giantThud } }
  const { scene, fx } = E, on = E.on;
  const crowd = createCrowd(scene, CROWD_MAX), hordeCrowds = {}; let puffN = 0, skinned = false; // one more batch for each horde skin worn (hordeSkins.js); skinned: some zombie wears one
  const Z = [], C = [], B = [], D = []; // zombies, people, the burning (already counted as lost), the dead
  // HORDES stick together: each has a rally point that wanders the streets a square at a time, and a map of how far every
  // square is from it. A zombie with nobody to chase heads back to its horde's rally point and mills about there
  const H = [];
  let cols = 1, rows = 1, N = 1, walk = new Uint8Array(1), zF = new Int16Array(1), cF = new Int16Array(1), Q = new Int32Array(1);
  let civAt = [], zAt = [], usedC = [], usedZ = [], fieldT = 0, flip = 0, groanT = 2, flameBudget = 0, shoutT = 0, civLive = 0, turning = 0;
  const cellOf = (x, z) => { const cx = Math.round(x / CELL + (cols - 1) / 2), cy = Math.round(z / CELL + (rows - 1) / 2); return cx < 0 || cy < 0 || cx >= cols || cy >= rows ? -1 : cy * cols + cx; };
  const cx0 = (i) => ((i % cols) - (cols - 1) / 2) * CELL, cz0 = (i) => (((i / cols) | 0) - (rows - 1) / 2) * CELL;
  function setTown(maze) { rows = maze.length; cols = maze[0].length; N = cols * rows; walk = new Uint8Array(N); for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) walk[y * cols + x] = maze[y][x] === false ? 1 : 0;
    zF = new Int16Array(N).fill(-1); cF = new Int16Array(N).fill(-1); Q = new Int32Array(N); civAt = Array.from({ length: N }, () => []); zAt = Array.from({ length: N }, () => []); usedC = []; usedZ = []; }
  // how far (in street squares) every square is from the nearest of `src`: one breadth-first sweep of the town
  function sweep(F, src) { F.fill(-1); let h = 0, t = 0; for (const i of src) if (i >= 0 && walk[i] && F[i] < 0) { F[i] = 0; Q[t++] = i; }
    while (h < t) { const i = Q[h++], d = F[i] + 1, x = i % cols; if (x > 0 && walk[i - 1] && F[i - 1] < 0) { F[i - 1] = d; Q[t++] = i - 1; } if (x < cols - 1 && walk[i + 1] && F[i + 1] < 0) { F[i + 1] = d; Q[t++] = i + 1; }
      if (i >= cols && walk[i - cols] && F[i - cols] < 0) { F[i - cols] = d; Q[t++] = i - cols; } if (i + cols < N && walk[i + cols] && F[i + cols] < 0) { F[i + cols] = d; Q[t++] = i + cols; } } }
  const srcC = [], srcZ = [];
  function sweepCivs() { srcC.length = 0; for (const o of C) { const u = o.userData; if (u.st !== 'turn') srcC.push(u.ci); } sweep(zF, srcC); }
  function sweepZombies() { srcZ.length = 0; for (const o of Z) srcZ.push(o.userData.ci); for (const i of E.fireCells()) srcZ.push(i); for (const G of GI) if (G.live) srcZ.push(cellOf(G.root.position.x, G.root.position.z)); sweep(cF, srcZ); } // people run from fire and from the giants as well
  function regrid() { for (const i of usedC) civAt[i].length = 0; for (const i of usedZ) zAt[i].length = 0; usedC.length = usedZ.length = 0;
    for (const o of C) { const u = o.userData, i = (u.ci = cellOf(o.position.x, o.position.z)); if (i < 0) continue; if (!civAt[i].length) usedC.push(i); civAt[i].push(o); }
    for (const o of Z) { const u = o.userData, i = (u.ci = cellOf(o.position.x, o.position.z)); if (i < 0) continue; if (!zAt[i].length) usedZ.push(i); zAt[i].push(o); } }
  // everyone in the 3 x 3 squares round square i
  function near(grid, i, fn) { if (i < 0) return; const x = i % cols; for (let dy = -1; dy <= 1; dy++) { const r = i + dy * cols; if (r < 0 || r >= N) continue; for (let dx = -1; dx <= 1; dx++) { if (x + dx < 0 || x + dx >= cols) continue; const l = grid[r + dx]; for (let k = 0; k < l.length; k++) fn(l[k]); } } }
  const nbr = (i, k) => { const x = i % cols; return k === 0 ? (x < cols - 1 ? i + 1 : -1) : k === 1 ? (x > 0 ? i - 1 : -1) : k === 2 ? (i + cols < N ? i + cols : -1) : i >= cols ? i - cols : -1; };

  // ---------- markers ----------
  function marker(cols0, kind) { const o = new THREE.Object3D(); o.rotation.order = 'YXZ'; /* falls over backwards relative to the way it faces */ o.scale.setScalar(kind === 'z' ? ZOMBIE_S : CIV_S); o.matrixAutoUpdate = false; o.updateMatrixWorld = noop; /* the crowd works out its matrix itself */
    Object.assign(o.userData, { cols: cols0, kind, phase: Math.random() * 6, sp: 0, ox: rnd(-0.85, 0.85), oz: rnd(-0.85, 0.85), think: Math.random() * 0.4, st: 'walk', t: 0, ci: -1 }); scene.add(o); return o; }
  function addZombie(x, z, spit = false) { const hs = hordeLook(), o = marker(hs ? hordeCols(hs, spit) : spit ? SPIT_COLS : zombieCols(OUTFITS[OUTS[(Math.random() * 8) | 0]]), 'z'); o.userData.hs = hs; if (hs) skinned = true; /* its horde skin (null: the classic green) */ o.position.set(x, 0, z); o.rotation.y = Math.random() * 6.28;
    Object.assign(o.userData, { zombie: true, h: -1, spit, v: spit ? rnd(TUNE.sv[0], TUNE.sv[1]) : rnd(TUNE.zv[0], TUNE.zv[1]), spitCd: rnd(1, 3), charge: 0, tx: x, tz: z }); Z.push(o); return o; }
  function addCiv(x, z) { const sk = E.townSkin ? E.townSkin() : null, base = OUTFITS[OUTS[(Math.random() * 8) | 0]], of = sk && sk.outfit ? { ...base, ...sk.outfit } : base;
    const o = marker(colsOf(of), 'c'); o.position.set(x, 0, z); o.rotation.y = Math.random() * 6.28; Object.assign(o.userData, { outfit: of, st: 'idle', home: o.position.clone(), goal: null, wait: Math.random() * 2, fv: rnd(TUNE.fv[0], TUNE.fv[1]), tx: x, tz: z }); C.push(o); return o; }
  function drop(o) { if (o.parent) o.parent.remove(o); }
  function clear() { H.length = 0; for (const l of [Z, C, B, D]) { for (const o of l) drop(o); l.length = 0; } for (const b of blobs) b.dead = true; blobs.length = 0; crowd.clear(); for (const k in hordeCrowds) hordeCrowds[k].clear(); for (const k in hv) for (const l of hv[k]) l.length = 0; skinned = false; civLive = 0; turning = 0; while (GI.length) dropGiant(GI[0]); }

  // ---------- the town fills up: hordes of zombies here and there, stragglers everywhere, and little groups of people
  // as far from the hordes as the streets allow. o: { zombies, spitShare, civs, hordes, roads: [[x, y]...], rng } ----------
  function spawn(o) { clear(); const rng = o.rng || Math.random, roads = o.roads, W = (c) => toWorld(c[0], c[1], cols, rows), key = (c) => c[1] * cols + c[0];
    const spread = (n, avoid) => { const out = []; for (let k = 0; k < n; k++) { let best = null, bd = -1; for (let t = 0; t < 24; t++) { const c = roads[(rng() * roads.length) | 0]; if (avoid && avoid.has(key(c))) continue; const d = out.length ? Math.min(...out.map((q) => Math.abs(q[0] - c[0]) + Math.abs(q[1] - c[1]))) : 99; if (d > bd) { bd = d; best = c; } } if (best) out.push(best); } return out; };
    // people: little groups of two to five, spread round town
    const groups = spread(Math.ceil(o.civs / 3.5)), safe = new Set(); let left = o.civs;
    groups.forEach((c, k) => { const w = W(c), n = k === groups.length - 1 ? left : Math.min(left, 2 + ((rng() * 4) | 0)); for (let i = 0; i < n; i++) addCiv(w.x + (rng() - 0.5) * 1.8, w.z + (rng() - 0.5) * 1.8); left -= n; });
    // keep the zombies two squares clear of every group to begin with (one, if that would leave them too little of the town)
    for (const rad of [2, 1]) { safe.clear(); for (const c of groups) for (const r of roads) if (Math.abs(r[0] - c[0]) + Math.abs(r[1] - c[1]) <= rad) safe.add(key(r)); if (roads.length - safe.size >= roads.length * 0.3) break; }
    // zombies: most of them in hordes, the rest straggling about, none on the squares right round the people
    const open = roads.filter((r) => !safe.has(key(r))), pool = open.length > 8 ? open : roads, centres = spread(o.hordes, safe); if (o.at && !safe.has(key(o.at))) centres[0] = o.at; // the first horde comes out of the graveyard
    const pools = centres.map((c) => pool.filter((r) => Math.abs(r[0] - c[0]) + Math.abs(r[1] - c[1]) <= 2)), inHordes = Math.round(o.zombies * (o.inHordes ?? 0.85)), weights = centres.map(() => 0.5 + rng()), wsum = weights.reduce((p, q) => p + q, 0);
    let made = 0; centres.forEach((c, k) => { const h = { ci: key(c), t: rnd(2, 8), F: new Int16Array(N) }; sweep(h.F, [h.ci]); H.push(h); const n = k === centres.length - 1 ? inHordes - made : Math.round(inHordes * weights[k] / wsum);
      for (let i = 0; i < n && made < inHordes; i++, made++) { const l = pools[k], r = l.length ? l[(rng() * l.length) | 0] : c, w = W(r); addZombie(w.x + (rng() - 0.5) * 2.2, w.z + (rng() - 0.5) * 2.2).userData.h = k; } });
    while (Z.length < o.zombies) { const w = W(pool[(rng() * pool.length) | 0]); addZombie(w.x + (rng() - 0.5) * 2, w.z + (rng() - 0.5) * 2); }
    for (let i = 0, k = Math.round(o.zombies * o.spitShare), t = 0; i < k && t < 5000; t++) { const z = Z[(rng() * Z.length) | 0], u = z.userData; if (u.spit) continue; u.spit = true; u.cols = u.hs ? hordeCols(u.hs, true) : SPIT_COLS; u.v = rnd(TUNE.sv[0], TUNE.sv[1]); z.scale.setScalar(SPIT_S); i++; }
    regrid(); sweepCivs(); sweepZombies(); civLive = C.length; }

  // ---------- each frame ----------
  function update(dt) { puffN = 0;
    fieldT -= dt; if (fieldT <= 0) { fieldT = 0.2; flip ^= 1; if (flip) sweepCivs(); else sweepZombies(); }
    regrid(); flameBudget = Math.min(40, flameBudget + dt * 260); shoutT -= dt;
    for (const h of H) { h.t -= dt; if (h.t > 0) continue; h.t = rnd(TUNE.hordeStep[0], TUNE.hordeStep[1]); const opts = []; let near1 = -1, nv = zF[h.ci] >= 0 ? zF[h.ci] : 32000; for (let k = 0; k < 4; k++) { const j = nbr(h.ci, k); if (j < 0 || !walk[j]) continue; if (j !== h.prev) opts.push(j); if (zF[j] >= 0 && zF[j] < nv) { nv = zF[j]; near1 = j; } } if (!opts.length) continue;
      h.prev = h.ci; h.ci = near1 >= 0 && Math.random() < TUNE.drift ? near1 : opts[(Math.random() * opts.length) | 0]; sweep(h.F, [h.ci]); } // a rally point moves a square at a time, rarely straight back
    for (let i = Z.length - 1; i >= 0; i--) stepZombie(Z[i], i, dt);
    let live = 0, turn = 0; for (let i = C.length - 1; i >= 0; i--) { const st = stepCiv(C[i], i, dt); if (st === 1) live++; else if (st === 2) turn++; } civLive = live; turning = turn;
    for (let i = B.length - 1; i >= 0; i--) stepBurn(B[i], i, dt);
    for (let i = D.length - 1; i >= 0; i--) stepDead(D[i], i, dt);
    if (D.length > 170) for (let i = 0; i < D.length - 170; i++) { const u = D[i].userData; if (!u.fly && u.lie < 2.6) u.lie = 2.6; } // too many bodies about: the oldest sink sooner
    updateBlobs(dt); separate(); for (let i = GI.length - 1; i >= 0; i--) stepGiant(GI[i], dt);
    groanT -= dt; if (groanT <= 0) { groanT = rnd(2.5, 5); if (on.groan) on.groan(); }
  }
  // zombies standing on one another look like one: nudge the ones sharing a spot apart (only within a square)
  function separate() { for (const i of usedZ) { const l = zAt[i]; if (l.length < 2) continue; for (let a = 0; a < l.length; a++) { const p = l[a].position; for (let b = a + 1; b < l.length; b++) { const q = l[b].position, dx = q.x - p.x, dz = q.z - p.z, d2 = dx * dx + dz * dz; if (d2 > 0.1 || d2 < 1e-6) continue; const d = Math.sqrt(d2), k = (0.32 - d) * 0.25 / d; p.x -= dx * k; p.z -= dz * k; q.x += dx * k; q.z += dz * k; } } } }

  function stepZombie(o, i, dt) { const u = o.userData, P = o.position;
    if (E.fireAt(P.x, P.z)) { Z.splice(i, 1); burn(o, 'z'); on.kill(o, 'fire', savedNear(P)); return; }
    if (u.st === 'rise') { u.t += dt; const k = Math.max(0, 1 - u.t / 0.55); o.rotation.x = -Math.PI / 2 * k; P.y = 0.08 * k; u.sp = 0; if (u.t >= 0.55) { u.st = 'walk'; o.rotation.x = 0; P.y = 0; } return; }
    if (u.st === 'feed') { u.t -= dt; u.sp = 0.15; u.phase += dt * 2; if (u.t <= 0) { u.st = 'walk'; u.think = 0; } return; }
    if (u.spit && spitTick(o, u, dt)) return;
    u.think -= dt; if (u.think <= 0 || (u.prey && u.prey.userData.st !== 'idle' && u.prey.userData.st !== 'flee')) think(o, u);
    let tx = u.tx, tz = u.tz; if (u.prey) { const q = u.prey.position; tx = q.x; tz = q.z; if (Math.hypot(tx - P.x, tz - P.z) < 0.42) { bite(o, u.prey); return; } }
    const dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz);
    if (d > 0.04) { const st = Math.min(d, u.v * (u.lazy && !u.prey ? (u.h >= 0 ? TUNE.roam : TUNE.wander) : 1) * dt); P.x += dx / d * st; P.z += dz / d * st; turnTo(o, Math.atan2(dx, dz), dt * 4); } else if (!u.prey) u.think = 0;
    if (d < 0.3 && !u.prey) u.think = 0;
    u.sp = 0.55 + u.v * 0.3; u.phase += dt * 5.5 * u.sp; E.collide(o);
  }
  function think(o, u) { u.think = 0.25 + Math.random() * 0.2; const P = o.position, i = u.ci;
    // someone close by: straight for them
    let best = null, bd = TUNE.preyR * TUNE.preyR; near(civAt, i, (c) => { const cu = c.userData; if (cu.st !== 'idle' && cu.st !== 'flee') return; const dx = c.position.x - P.x, dz = c.position.z - P.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = c; } });
    u.prey = best; if (best) { u.lazy = false; return; }
    // someone within smelling distance: downhill on the map of how far the nearest person is
    const d0 = i >= 0 ? zF[i] : -1;
    if (d0 >= 0 && d0 <= TUNE.smell) { let bj = -1, bv = d0; for (let k = 0; k < 4; k++) { const j = nbr(i, k); if (j >= 0 && walk[j] && zF[j] >= 0 && zF[j] < bv) { bv = zF[j]; bj = j; } }
      if (bj >= 0) { u.lazy = false; u.tx = cx0(bj) + u.ox; u.tz = cz0(bj) + u.oz; return; } }
    // nobody about: back to the horde, and mill about where it has got to
    u.lazy = true; u.think = 1.2 + Math.random(); if (i < 0) { u.tx = 0; u.tz = 0; return; }
    const hh = u.h >= 0 ? H[u.h] : null; if (hh) { const F = hh.F, f0 = F[i];
      if (f0 > 0) { let bj = -1, bv = f0; for (let k = 0; k < 4; k++) { const j = nbr(i, k); if (j >= 0 && walk[j] && F[j] >= 0 && F[j] < bv) { bv = F[j]; bj = j; } } if (bj >= 0) { u.tx = cx0(bj) + u.ox; u.tz = cz0(bj) + u.oz; u.think = 0.6 + Math.random() * 0.6; return; } }
      else if (f0 === 0) { u.tx = cx0(i) + rnd(-1.3, 1.3); u.tz = cz0(i) + rnd(-1.3, 1.3); u.think = 1.5 + Math.random() * 2; return; } }
    // a straggler: shamble aimlessly along the streets, mostly carrying on the way it was going
    let k = u.wd == null ? (Math.random() * 4) | 0 : u.wd, j = nbr(i, k);
    if (j < 0 || !walk[j] || Math.random() < 0.15) { const opts = []; for (let n = 0; n < 2 && !opts.length; n++) for (let kk = 0; kk < 4; kk++) { const jj = nbr(i, kk); if (jj >= 0 && walk[jj] && (n || kk !== (k ^ 1))) opts.push(kk); } if (opts.length) k = opts[(Math.random() * opts.length) | 0]; j = nbr(i, k); }
    u.wd = k; if (j >= 0 && walk[j]) { u.tx = cx0(j) + u.ox; u.tz = cz0(j) + u.oz; } else { u.tx = P.x + rnd(-1, 1); u.tz = P.z + rnd(-1, 1); } }
  function bite(z, c) { const zu = z.userData, cu = c.userData; cu.st = 'turn'; cu.t = 0; cu.panic = false; cu.h = zu.h; cu.riseHs = zu.hs || null; /* the bitten join the biter's horde, and get up in its look (rise) */ c.rotation.y = Math.atan2(z.position.x - c.position.x, z.position.z - c.position.z); /* facing the zombie, so it falls back away from it */ zu.st = 'feed'; zu.t = TUNE.feed; zu.prey = null; on.bite(c); }
  // a zombie dies near someone it was after: they were saved
  function savedNear(P) { let s = null; near(civAt, cellOf(P.x, P.z), (c) => { if (s || c.userData.st !== 'flee') return; if (Math.hypot(c.position.x - P.x, c.position.z - P.z) < 2.4) s = c; }); return s; }

  // a person's turn. Returns 1 while they are alive and well, 2 while they are turning, 0 once gone from the list
  function stepCiv(o, i, dt) { const u = o.userData, P = o.position;
    if (u.st === 'turn') { u.t += dt; const k = Math.min(1, u.t / 0.3); o.rotation.x = -Math.PI / 2 * k; P.y = 0.08 * k; o.rotation.z = u.t > 0.3 ? Math.sin(u.t * 31) * 0.14 * Math.max(0, 1 - (u.t - 0.3) / 1.3) : 0; u.sp = 0;
      if (E.fireAt(P.x, P.z)) { C.splice(i, 1); burn(o, 'z'); on.kill(o, 'fire', null); return 0; } // already lost: it counts as a zombie
      if (u.t >= TUNE.turn) { C.splice(i, 1); rise(o); return 0; } return 2; }
    if (E.fireAt(P.x, P.z)) { C.splice(i, 1); burn(o, 'c'); on.civLost(o, 'fire'); return 0; }
    u.think -= dt; if (u.think <= 0) civThink(o, u);
    if (u.st === 'flee') { const x0 = P.x, z0 = P.z, dx = u.tx - P.x, dz = u.tz - P.z, d = Math.hypot(dx, dz); if (d > 0.05) { const st = Math.min(d, u.fv * dt); P.x += dx / d * st; P.z += dz / d * st; turnTo(o, Math.atan2(dx, dz), dt * 8); } else u.think = 0; E.collide(o); /* legs only run while the feet really move: cornered or blocked, they stand and cower */ const mv = Math.hypot(P.x - x0, P.z - z0) > u.fv * dt * 0.25; u.stuck = mv ? 0 : (u.stuck || 0) + dt; if (mv || u.stuck < 0.15) { u.sp = 1.3; u.phase += dt * 13 * 1.3; } else { u.sp = 0; if (u.stuck > 0.6) { u.stuck = 0; u.ox = rnd(-0.3, 0.3); u.oz = rnd(-0.3, 0.3); u.think = 0; } } return 1; }
    // quiet: mill about near home, now and then
    u.wait -= dt; if (!u.goal && u.wait <= 0) u.goal = new THREE.Vector3(u.home.x + rnd(-1.2, 1.2), 0, u.home.z + rnd(-1.2, 1.2));
    if (u.goal) { const dx = u.goal.x - P.x, dz = u.goal.z - P.z, d = Math.hypot(dx, dz); if (d < 0.1) { u.goal = null; u.wait = 1 + Math.random() * 3; u.sp = 0; } else { P.x += dx / d * 0.6 * dt; P.z += dz / d * 0.6 * dt; turnTo(o, Math.atan2(dx, dz), dt * 5); u.sp = 0.5; u.phase += dt * 10 * 0.5; E.collide(o); } } else u.sp = 0;
    return 1; }
  function civThink(o, u) { u.think = 0.18 + Math.random() * 0.14; const P = o.position, i = u.ci, dz0 = i >= 0 ? cF[i] : -1;
    let nz = null, nd = 2.6 * 2.6; near(zAt, i, (z) => { const dx = z.position.x - P.x, dz = z.position.z - P.z, d = dx * dx + dz * dz; if (d < nd) { nd = d; nz = z; } });
    if (!nz) for (const G of GI) { if (!G.live || G.st === 'rise') continue; const q = G.root.position; if ((q.x - P.x) ** 2 + (q.z - P.z) ** 2 < 6.5 * 6.5) { nz = G.root; break; } } // a giant close by: run
    if (!nz && !(dz0 >= 0 && dz0 <= TUNE.panic)) { if (u.st === 'flee') { u.st = 'idle'; u.panic = false; u.home = P.clone(); u.goal = null; u.wait = 0.5 + Math.random(); } return; }
    if (u.st !== 'flee') { u.st = 'flee'; u.panic = true; u.goal = null; }
    // uphill: the next square further from the zombies (and from any fire)
    let bj = -1, bv = dz0; for (let k = 0; k < 4; k++) { const j = i >= 0 ? nbr(i, k) : -1; if (j >= 0 && walk[j] && cF[j] > bv) { bv = cF[j]; bj = j; } }
    let tx = bj >= 0 ? cx0(bj) + u.ox : P.x, tz = bj >= 0 ? cz0(bj) + u.oz : P.z;
    if (nz) { const ax = P.x - nz.position.x, az = P.z - nz.position.z, al = Math.hypot(ax, az) || 1; tx = (tx + P.x + ax / al * 2.5) / 2; tz = (tz + P.z + az / al * 2.5) / 2; } // one right behind: straight away from it as well
    u.tx = tx; u.tz = tz; if (shoutT <= 0 && Math.random() < 0.06) { shoutT = 1.2; E.popup(P, SHOUTS[(Math.random() * SHOUTS.length) | 0], '#ffffff'); } }
  function rise(o) { const u = o.userData; u.kind = 'z'; u.zombie = true; u.hs = u.riseHs || null; u.cols = u.hs ? hordeCols(u.hs) : zombieCols(u.outfit); o.scale.setScalar(ZOMBIE_S); u.st = 'rise'; u.t = 0; u.v = rnd(TUNE.zv[0], TUNE.zv[1]); u.wd = null; u.lazy = false; if (u.h == null) u.h = -1; u.think = 0.6; u.prey = null; u.spit = false; u.panic = false; u.charge = 0; u.spitCd = 3; o.rotation.z = 0; Z.push(o); on.turned(o); }

  // ---------- fire and blasts ----------
  function burn(o, who) { const u = o.userData; u.st = 'burn'; u.who = who; u.burnT = who === 'c' ? rnd(2.2, 3) : rnd(1.0, 1.6); u.zombie = false; u.panic = true; u.dir = Math.random() * 6.28; u.ph = 0; u.prey = null; o.rotation.x = 0; o.rotation.z = 0; o.position.y = 0; u.burnt = false; B.push(o); }
  function stepBurn(o, i, dt) { const u = o.userData, P = o.position; u.burnT -= dt; u.ph -= dt; if (u.ph <= 0) { u.ph = rnd(0.25, 0.5); u.dir = Math.random() * 6.28; }
    const v = u.who === 'c' ? 2.4 : 1.3; P.x += Math.sin(u.dir) * v * dt; P.z += Math.cos(u.dir) * v * dt; o.rotation.y = u.dir; u.sp = 1.3; u.phase += dt * 15; E.collide(o);
    if (!u.burnt && u.burnT < 0.7) { u.burnt = true; u.cols = SCORCH; }
    if (flameBudget >= 1 && Math.random() < dt * 14) { flameBudget--; fx.puff('flame', new THREE.Vector3(P.x, 0.28, P.z), 0.34); }
    if (u.burnT <= 0) { B.splice(i, 1); if (u.hs && puffN < 8) { puffN++; E.fx.sparks({ x: o.position.x, y: 0.4, z: o.position.z }, 5, { c: puffPair(u.hs), speed: 3, up: 3, life: 0.5 }); } /* a horde skin's own fall, burnt too */ die(o, BURNT); } }
  function die(o, colsK) { const u = o.userData; u.kind = 'd'; u.st = 'dead'; u.zombie = false; u.panic = false; u.sp = 0; u.cols = colsK || u.cols; u.fly = false; u.fall = 0; u.lie = 0; u.smoke = colsK === BURNT; D.push(o); }
  function fling(o, x, z, pow) { if (o.userData.hs && o.userData.kind === 'z' && puffN < 8) { puffN++; E.fx.sparks({ x: o.position.x, y: 0.4, z: o.position.z }, 5, { c: puffPair(o.userData.hs), speed: 3, up: 3, life: 0.5 }); } /* a horde skin's own fall */ const u = o.userData, P = o.position, a = Math.atan2(P.z - z, P.x - x) + rnd(-0.4, 0.4), sp = (2.6 + Math.random() * 3) * pow; die(o, u.cols === SPIT_COLS || (u.hs && u.spit && !u.burnt) ? u.cols : u.cols.map((c) => DARK(c, 0.8)));
    u.fly = true; u.vx = Math.cos(a) * sp; u.vz = Math.sin(a) * sp; u.vy = 3.8 + Math.random() * 3.4 * pow; u.sx = rnd(-10, 10); u.sz = rnd(-7, 7); o.rotation.z = 0; }
  function stepDead(o, i, dt) { const u = o.userData, P = o.position;
    if (u.fly) { u.vy -= 16 * dt; P.x += u.vx * dt; P.y += u.vy * dt; P.z += u.vz * dt; o.rotation.x += u.sx * dt; o.rotation.z += u.sz * dt;
      if (P.y <= 0.08 && u.vy < 0) { P.y = 0.08; u.fly = false; u.fall = 1; o.rotation.x = Math.random() < 0.5 ? -Math.PI / 2 : Math.PI / 2; o.rotation.z = 0; fx.dust(P, 0.45); } return; }
    if (u.fall < 1) { u.fall = Math.min(1, u.fall + dt / 0.35); const e = u.fall * u.fall; o.rotation.x = -Math.PI / 2 * e; P.y = 0.08 * e; return; }
    u.lie += dt; if (u.smoke && u.lie < 1.5 && flameBudget >= 1 && Math.random() < dt * 3) { flameBudget--; fx.puff('smoke', new THREE.Vector3(P.x, 0.2, P.z), 0.35); }
    if (u.lie > 2.6) P.y -= dt * 0.2; if (u.lie > 4) { D.splice(i, 1); drop(o); } }
  // a rocket (or a chunk a giant threw, or a giant falling: how says which): everyone within r is thrown. Returns how many
  // zombies and people were caught in it
  function blast(x, z, r, pow = 1, how = 'rocket', zOnly = false) { let nz = 0, nc = 0; const r2 = r * r, hit = (P) => { const dx = P.x - x, dz = P.z - z; return dx * dx + dz * dz <= r2; };
    for (let i = Z.length - 1; i >= 0; i--) { const o = Z[i]; if (!hit(o.position)) continue; Z.splice(i, 1); const s = how === 'rocket' ? savedNear(o.position) : null; fling(o, x, z, pow); nz++; on.kill(o, how, s); }
    if (!zOnly) for (let i = C.length - 1; i >= 0; i--) { const o = C[i]; if (!hit(o.position)) continue; C.splice(i, 1); const turned = o.userData.st === 'turn'; fling(o, x, z, pow); if (turned) { nz++; on.kill(o, how, null); } else { nc++; on.civLost(o, how); } }
    if (!zOnly) for (let i = B.length - 1; i >= 0; i--) { const o = B[i]; if (!hit(o.position)) continue; B.splice(i, 1); fling(o, x, z, pow); }
    for (const o of D) { const u = o.userData; if (u.fly || !hit(o.position)) continue; u.fly = true; u.vx = rnd(-2, 2); u.vz = rnd(-2, 2); u.vy = 3 + Math.random() * 2; u.sx = rnd(-8, 8); u.sz = rnd(-6, 6); u.lie = 0; }
    return { nz, nc }; }

  // ---------- gloopers: they stop, wind up (their glands flare), and lob a blob of acid where the aircraft is going ----------
  const blobs = [];
  function spitTick(o, u, dt) { u.spitCd -= dt; const cr = E.craft(); if (!cr || !cr.alive) { u.charge = 0; return false; }
    const P = o.position, dx = cr.pos.x - P.x, dz = cr.pos.z - P.z, d = Math.hypot(dx, dz), reach = d < SPIT_R * (cr.stealth || 1) && cr.pos.y < SPIT_TOP && !cr.safe; /* (nothing reaches over the airfield) */
    if (u.charge > 0) { u.charge += dt; turnTo(o, Math.atan2(dx, dz), dt * 8); u.sp = 0; if (u.charge >= 0.65) { u.charge = 0; u.spitCd = rnd(2.6, 3.8); if (reach) lob(o, cr, d); } return true; }
    if (u.spitCd <= 0 && reach && blobs.length < MAXB) { u.charge = 0.001; return true; } return false; }
  function lob(o, cr, d) { const from = new THREE.Vector3(o.position.x, 0.55, o.position.z), T = 0.8 + d / 20, aim = cr.pos.clone().addScaledVector(cr.vel, T * 0.8);
    const v = aim.sub(from).divideScalar(T); v.y += 0.5 * GRAV * T; blobs.push({ p: from, v, t: 0, hs: o.userData.hs || null }); if (on.spit) on.spit(o); }
  function updateBlobs(dt) { const cr = E.craft();
    for (let i = blobs.length - 1; i >= 0; i--) { const b = blobs[i]; b.t += dt; b.v.y -= GRAV * dt; b.p.addScaledVector(b.v, dt);
      if (cr && cr.alive && b.p.distanceTo(cr.pos) < cr.r) { blobs.splice(i, 1); fx.spray(b.p, 14, { c: b.hs ? hordeOf(b.hs).acidHit : [0xe8ff8a, 0x5aff2a], speed: 3, up: [0, 2], life: 0.5, size: 0.14, grav: 8 }); on.hitCraft(b.p); continue; }
      if (b.p.y <= 0.06 || b.t > 3.5) { blobs.splice(i, 1); const g = new THREE.Vector3(b.p.x, 0, b.p.z); fx.pool(g, 0.55, b.hs ? hordeOf(b.hs).acidPool : 0x4a9a1a, 6, 0.55); fx.spray(g.setY(0.15), 8, { c: b.hs ? hordeOf(b.hs).acidHit : [0xd8ff6a, 0x3aff3a], speed: 2, up: [1, 3], life: 0.45, size: 0.1, grav: 9 }); continue; }
      if (Math.random() < dt * 24) fx.spray(b.p, 1, { c: b.hs ? hordeOf(b.hs).acidHit : [0xd8ff6a, 0x3aff3a], speed: 0.4, up: [0, 0.3], life: 0.3, size: 0.12, grav: 1, shape: 0, stretch: 0 }); } }

// ---------- the GRAVE GIANTS (see makeGiant above). st: rise, walk, reach (for a building), lift (the chunk it tore off),
  // hold (it overhead, while the game aims), throw, recover, fall (brought down), dead. Arm angles are measured from
  // straight down (forward is negative), whatever the hunch ----------
  const GI = [], gv = new THREE.Vector3(), gv2 = new THREE.Vector3();
  function addGiant(x, z, hp) { const gk = GI.length + ((Math.random() * 4) | 0), hs = hordeAny(), m = hs ? paintGiant(hordeGiant(hs, gk, { size: G_SIZE, hip: G_HIP })) : makeGiant(gk), G = { m, root: m.root, st: 'rise', t: 0, hp, max: hp, live: true, ph: Math.random() * 6, wd: null, tx: x, tz: z, v: 0.75, cd: 3, flash: 0, burn: 0, step: 0, face: 0, hold: 1, bld: null, aim: null };
    m.root.position.set(x, -6.5, z); m.root.rotation.y = Math.random() * 6.28; scene.add(m.root); m.shadow.position.set(x, 0.06, z); scene.add(m.shadow); GI.push(G); poseGiant(G, 0.55, -2.4, -2.4, 0, G_HIP, 0, 0); return G; }
  function dropGiant(G) { const i = GI.indexOf(G); if (i >= 0) GI.splice(i, 1); scene.remove(G.root); scene.remove(G.m.shadow); G.root.traverse((m) => { if (m.isMesh && m.geometry !== gEyes) m.geometry.dispose(); }); G.m.mat.dispose(); }
  // a hit: returns true when it brings the giant down
  function hurtGiant(G, dmg) { if (!G.live) return false; G.hp -= dmg; G.flash = 0.22; if (G.hp > 0) return false; G.hp = 0; G.live = false; G.st = 'fall'; G.t = 0; return true; }
  // the game picked a building to tear into: b.pos is where it stands. hold: how long the chunk is held up before the throw
  function giantGrab(G, b, hold) { if (!G.live || G.st !== 'walk') return false; G.st = 'reach'; G.t = 0; G.bld = b; G.hold = hold; G.ripped = G.thrown = false; G.face = Math.atan2(b.pos.x - G.root.position.x, b.pos.z - G.root.position.z); return true; }
  // where its two hands are now (the middle of them)
  function handsOf(G, out) { const [a, b] = G.m.arms; a.userData.hand.getWorldPosition(gv); b.userData.hand.getWorldPosition(gv2); return out.copy(gv).add(gv2).multiplyScalar(0.5); }
  function poseGiant(G, lean, aL, aR, legA, hipY, sway, headX) { const M = G.m; M.torso.rotation.x = lean; M.arms[0].rotation.x = aL - lean; M.arms[1].rotation.x = aR - lean; M.head.rotation.x = -lean * 0.8 + headX; M.head.rotation.z = Math.sin(G.ph * 0.5) * 0.12;
    M.hips.position.y = hipY; M.hips.rotation.z = sway; M.legs[0].rotation.x = legA; M.legs[1].rotation.x = -legA; G.root.updateMatrixWorld(true); }
  // along the streets: toward the aircraft when it is about, otherwise on the way it was going, turning now and then
  function giantNext(G) { const P = G.root.position, i = cellOf(P.x, P.z); if (i < 0) { G.tx = 0; G.tz = 0; return; } const opts = []; for (let k = 0; k < 4; k++) { const j = nbr(i, k); if (j >= 0 && walk[j]) opts.push([k, j]); } if (!opts.length) { G.tx = cx0(i); G.tz = cz0(i); return; }
    const back = G.wd == null ? -1 : G.wd ^ 1, cr = E.craft(); let pick = null;
    if (cr && cr.alive && Math.hypot(cr.pos.x - P.x, cr.pos.z - P.z) < 26) { let bd = 1e9; for (const o of opts) { if (o[0] === back && opts.length > 1) continue; const d = Math.hypot(cx0(o[1]) - cr.pos.x, cz0(o[1]) - cr.pos.z); if (d < bd) { bd = d; pick = o; } } }
    else { const ahead = opts.find((o) => o[0] === G.wd); if (ahead && Math.random() < 0.75) pick = ahead; else { const l = opts.filter((o) => o[0] !== back), L2 = l.length ? l : opts; pick = L2[(Math.random() * L2.length) | 0]; } }
    G.wd = pick[0]; G.tx = cx0(pick[1]); G.tz = cz0(pick[1]); }
  const turnG = (G, want, rate, dt) => { let d = want - G.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); G.root.rotation.y += Math.max(-rate * dt, Math.min(rate * dt, d)); return d; };
  function stepGiant(G, dt) { const r = G.root, P = r.position, M = G.m; G.t += dt; G.flash = Math.max(0, G.flash - dt); G.burn = Math.max(0, G.burn - dt);
    let lean = 0.55, aL = -0.3, aR = -0.3, legA = 0, hipY = G_HIP, sway = 0, headX = 0, k;
    switch (G.st) {
      case 'rise': { k = Math.min(1, G.t / 2.6); P.y = -6.5 * (1 - ease(k)); lean = 0.3; aL = -2.6 + k * 1.6 + Math.sin(G.t * 6) * 0.25; aR = -2.4 + k * 1.4 - Math.sin(G.t * 6) * 0.25; sway = Math.sin(G.t * 5) * 0.12 * (1 - k); /* it claws its way up out of the ground */
        if (k >= 1) { P.y = 0; G.st = 'walk'; G.t = 0; giantNext(G); } break; }
      case 'walk': { let dx = G.tx - P.x, dz = G.tz - P.z, d = Math.hypot(dx, dz); if (d < 0.35) { giantNext(G); dx = G.tx - P.x; dz = G.tz - P.z; d = Math.hypot(dx, dz); }
        G.ph += dt * 2.4; const s = Math.sin(G.ph), lurch = 0.4 + 0.6 * Math.abs(Math.cos(G.ph)), dh = d > 0.05 ? turnG(G, Math.atan2(dx, dz), 1.3, dt) : 0; /* heavy: quick mid-stride, all but stopped as each foot comes down */
        if (d > 0.05) { const go = Math.min(d, G.v * lurch * dt * (Math.abs(dh) > 0.9 ? 0.25 : 1)); P.x += dx / d * go; P.z += dz / d * go; }
        legA = s * 0.46; hipY = G_HIP - Math.abs(s) * 0.15; sway = s * 0.07; lean = 0.55 + Math.abs(s) * 0.05; aL = -0.32 - s * 0.3; aR = -0.32 + s * 0.3; headX = Math.sin(G.ph * 0.5) * 0.08;
        const st = Math.floor((G.ph - Math.PI / 2) / Math.PI); if (st !== G.step) { G.step = st; const side = s > 0 ? 1 : -1, fw = r.rotation.y; gv.set(P.x + Math.sin(fw) * 1.1 + Math.cos(fw) * side * 0.65, 0, P.z + Math.cos(fw) * 1.1 - Math.sin(fw) * side * 0.65); if (on.giantStep) on.giantStep(G, gv); } break; }
      case 'reach': { turnG(G, G.face, 2.6, dt); k = ease(Math.min(1, G.t / 0.5)); lean = mix(0.55, 0.95, k); aL = aR = mix(-0.32, -1.45, k);
        if (G.t >= 0.5 && !G.ripped) { G.ripped = true; if (E.giantRip && E.giantRip(G)) { G.st = 'lift'; G.t = 0; } else { G.st = 'recover'; G.t = 0.3; G.cd = 1.5; } } break; }
      case 'lift': { k = ease(Math.min(1, G.t / 0.45)); lean = mix(0.95, 0.12, k); aL = aR = mix(-1.45, -3.0, k); if (G.t >= 0.45) { G.st = 'hold'; G.t = 0; } break; }
      case 'hold': { turnG(G, G.face, 2.2, dt); lean = 0.04; aL = aR = -3.0 + Math.sin(G.t * 21) * 0.05; hipY = G_HIP - 0.08; if (G.t >= G.hold) { G.st = 'throw'; G.t = 0; } break; }
      case 'throw': { k = Math.min(1, G.t / 0.3); const e = 1 - (1 - k) ** 3; lean = mix(0.04, 0.85, e); aL = aR = mix(-3.0, -0.6, e); hipY = G_HIP - 0.08 * (1 - e);
        if (!G.thrown && G.t >= 0.12) { G.thrown = true; if (E.giantRelease) E.giantRelease(G); } if (k >= 1) { G.st = 'recover'; G.t = 0; } break; }
      case 'recover': { k = ease(Math.min(1, G.t / 0.6)); lean = mix(0.85, 0.55, k); aL = aR = mix(-0.6, -0.32, k); if (k >= 1) { G.st = 'walk'; G.t = 0; } break; }
      case 'fall': { k = Math.min(1, G.t / 1.15); r.rotation.x = k * k * 1.42; lean = mix(0.55, 0.2, k); aL = -2.3 + Math.sin(G.t * 9) * 0.45; aR = -2.1 - Math.sin(G.t * 8) * 0.45; legA = -0.2 * k; /* it topples forward, arms thrown up */
        if (k >= 1) { G.st = 'dead'; G.t = 0; if (on.giantThud) on.giantThud(G); } break; }
      case 'dead': { r.rotation.x = 1.42 + Math.sin(Math.min(1, G.t / 0.35) * Math.PI) * 0.06; lean = 0.2; aL = -2.5; aR = -2.2; legA = -0.2; if (G.t > 3.5) P.y -= dt * 0.8; if (G.t > 6.5) { dropGiant(G); return; } break; }
    }
    poseGiant(G, lean, aL, aR, legA, hipY, sway, headX);
    { const fw = r.rotation.y, lie = G.st === 'fall' || G.st === 'dead' ? Math.sin(Math.min(1.42, r.rotation.x)) * 2.9 : 0; M.shadow.position.set(P.x + Math.sin(fw) * lie, 0.06, P.z + Math.cos(fw) * lie); M.shadow.scale.set(2.3, 1, 2.3 + lie * 0.7); M.shadow.rotation.y = fw; M.shadow.visible = P.y > -3; }
    const f = G.flash > 0 ? G.flash / 0.22 : 0, b = G.burn > 0 ? 0.35 + Math.sin(G.t * 30) * 0.12 : 0; M.mat.emissive.setRGB(Math.max(0.085, f * 0.95, b), Math.max(0.1, f * 0.3, b * 0.35), Math.max(0.075, f * 0.1)); /* a faint glow of its own (it has to read at night), a flash when hit, a flicker of orange while it burns */
  }

  // ---------- drawing: the crowd gets only who is on screen; the eyes, glands and acid are one batch each ----------
  const visZ = [], visC = [], visB = [], visD = [], lists = [[visZ, 1], [visC, 0], [visB, 0], [visD, 0]], hv = {}; // hv: each horde skin's [walkers, burning, fallen]
  const part = (l, j) => { let w = 0; for (let i = 0; i < l.length; i++) { const o = l[i], h = o.userData.hs; if (h && o.userData.kind !== 'c') (hv[h] || (hv[h] = [[], [], []]))[j].push(o); else l[w++] = o; } l.length = w; };
  const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const eyes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), glowMat(0xb4ff5a), CROWD_MAX), sacs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), glowMat(0xffffff), 160), acid = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), glowMat(0xc8ff4a), MAXB);
  for (const m of [eyes, sacs, acid]) { m.frustumCulled = false; m.count = 0; m.renderOrder = 2; scene.add(m); } sacs.setColorAt(0, new THREE.Color(0));
  let hEyes = null, hAcid = null; const hBatch = (geo, n) => { const m = new THREE.InstancedMesh(geo, glowMat(0xffffff), n); m.frustumCulled = false; m.count = 0; m.renderOrder = 2; m.setColorAt(0, new THREE.Color(0)); scene.add(m); return m; }; // the horde skins' eyes and acid, each its own colour (made the first time one is needed)
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), EYE = new THREE.Vector3(0, 2.13, 0.33), EYE_S = new THREE.Vector3(0.1, 0.042, 0.03), col = new THREE.Color(); // the eyes glow wide enough to show from the air: a green glint on every zombie
  let clock = 0;
  function sync(view, dt = 0.016) { clock += dt; // view: { x, y, z } the camera's aim, r/u its right and up (unit), hw/hh half the view (plus a margin)
    const { r, u } = view, vis = (P) => { const dx = P.x - view.x, dy = P.y - view.y, dz = P.z - view.z; return Math.abs(dx * r.x + dy * r.y + dz * r.z) < view.hw && Math.abs(dx * u.x + dy * u.y + dz * u.z) < view.hh; };
    visZ.length = visC.length = visB.length = visD.length = 0;
    for (const o of Z) if (vis(o.position)) visZ.push(o); for (const o of C) if (vis(o.position)) visC.push(o); for (const o of B) if (vis(o.position)) visB.push(o); for (const o of D) if (vis(o.position)) visD.push(o);
    if (skinned) { for (const k in hv) for (const l of hv[k]) l.length = 0; part(visZ, 0); part(visB, 1); part(visD, 2); } /* the horde skins' figures go to their own batches */
    crowd.sync(lists, 1e6, 1e6, 0);
    for (const k in hv) { const H = hv[k]; let cr = hordeCrowds[k]; if (!H[0].length && !H[1].length && !H[2].length && (!cr || !cr.count)) continue; if (!cr) cr = hordeCrowds[k] = createCrowd(scene, 720, { geo: hordeFigure(k), shader: patchCrowdShader }); cr.sync([[H[0], 1], [H[1], 0], [H[2], 0]], 1e6, 1e6, 0); } // everyone is far from (1e6, 1e6): nobody needs a body of their own
    let n = 0, s = 0; for (const o of visZ) { if (n >= CROWD_MAX) break; v3.copy(EYE).applyMatrix4(o.matrix); m4.compose(v3, o.quaternion, EYE_S); eyes.setMatrixAt(n++, m4); /* (the crowd has just worked out o.matrix) */
      const uu = o.userData; if (uu.spit && s < 160) { const k = uu.charge > 0 ? 1.4 + uu.charge * 1.6 : 1 + Math.sin(clock * 5 + uu.ox * 9) * 0.15; v3.set(0, 1.25, -0.05).applyMatrix4(o.matrix); m4.compose(v3, o.quaternion, s3.setScalar(0.17 * k)); sacs.setMatrixAt(s, m4); sacs.setColorAt(s, col.setHex(0x6aff2a).multiplyScalar(uu.charge > 0 ? 1 : 0.7)); s++; } }
    eyes.count = n; eyes.instanceMatrix.needsUpdate = true;
    if (skinned || hEyes) { let hn = 0; for (const k in hv) { const HL = hordeOf(k); for (const o of hv[k][0]) { for (const g of HL.glows) { if (hn >= CROWD_MAX) break; v3.set(g[0], g[1], g[2]).applyMatrix4(o.matrix); m4.compose(v3, o.quaternion, s3.set(g[3], g[4], g[5])); if (!hEyes) hEyes = hBatch(eyes.geometry, CROWD_MAX); hEyes.setMatrixAt(hn, m4); hEyes.setColorAt(hn++, HL.eyeC); }
        const uu = o.userData; if (uu.spit && s < 160) { const kk = uu.charge > 0 ? 1.4 + uu.charge * 1.6 : 1 + Math.sin(clock * 5 + uu.ox * 9) * 0.15; v3.set(0, 1.25, -0.05).applyMatrix4(o.matrix); m4.compose(v3, o.quaternion, s3.setScalar(0.17 * kk)); sacs.setMatrixAt(s, m4); sacs.setColorAt(s, col.copy(HL.glandC).multiplyScalar(uu.charge > 0 ? 1 : 0.7)); s++; } } }
      if (hEyes) { hEyes.count = hn; for (const a of [hEyes.instanceMatrix, hEyes.instanceColor]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, hn) * a.itemSize); a.needsUpdate = true; } } sacs.count = s; if (s) { sacs.instanceMatrix.needsUpdate = true; sacs.instanceColor.needsUpdate = true; } } /* (the horde skins' eyes, and their gloopers' glands in their colour) */ sacs.count = s; if (s) { sacs.instanceMatrix.needsUpdate = true; sacs.instanceColor.needsUpdate = true; }
    let a = 0; for (const b of blobs) { if (b.hs) continue; m4.compose(b.p, q4.identity(), s3.setScalar(0.2 + Math.sin(clock * 20 + a) * 0.03)); acid.setMatrixAt(a++, m4); } acid.count = a; if (a) acid.instanceMatrix.needsUpdate = true;
    if (skinned || hAcid) { let ha = 0; for (const b of blobs) { if (!b.hs) continue; if (!hAcid) hAcid = hBatch(acid.geometry, MAXB); m4.compose(b.p, q4.identity(), s3.setScalar(0.2 + Math.sin(clock * 20 + ha) * 0.03)); hAcid.setColorAt(ha, hordeOf(b.hs).glandC); hAcid.setMatrixAt(ha++, m4); } if (hAcid) { hAcid.count = ha; hAcid.instanceMatrix.needsUpdate = true; hAcid.instanceColor.needsUpdate = true; } } /* (a horde skin's acid, in its colour) */
  }

  // ---------- questions the game asks ----------
  // the busiest spot: the square whose 3 x 3 neighbourhood holds the most zombies (for the coach and the autopilot)
  function densest(fromX, fromZ, maxD = 1e9) { let best = -1, bn = 0; for (const i of usedZ) { const w = toW(i); if (Math.hypot(w.x - fromX, w.z - fromZ) > maxD) continue; let n = 0; near(zAt, i, () => { n++; }); if (n > bn) { bn = n; best = i; } }
    if (best < 0) return null; let sx = 0, sz = 0, k = 0; near(zAt, best, (o) => { sx += o.position.x; sz += o.position.z; k++; }); return { x: sx / k, z: sz / k, n: bn }; }
  const toW = (i) => ({ x: cx0(i), z: cz0(i) });
  function nearestZombie(x, z, maxD) { let best = null, bd = maxD * maxD; for (const o of Z) { const dx = o.position.x - x, dz = o.position.z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = o; } } return best; }
  function count(x, z, r, list = Z) { let n = 0; for (const o of list) if (Math.hypot(o.position.x - x, o.position.z - z) < r) n++; return n; }
  function eachDot(fn) { for (const o of C) fn(o.position, o.userData.st === 'turn' ? 3 : 1); for (const o of Z) fn(o.position, o.userData.spit ? 2 : 0); }

  return { tune: TUNE, setTown, spawn, update, sync, clear, blast, densest, nearestZombie, count, eachDot, crowd, Z, C, B, D, blobs, giants: GI, addGiant, hurtGiant, giantGrab, handsOf,
    get zombies() { return Z.length + turning; }, get civs() { return civLive; }, get turning() { return turning; }, get fields() { return { zF, cF }; }, get hordes() { return H; } };
}
