// Tornado visuals and wreckage: a swirling streaked funnel under a dark cloud cap with a dust skirt, junk tumbling up
// the vortex, lightning crackling out of it, and buildings it hits lifted, torn into chunks, spun round and flung as rubble.
import * as THREE from 'three';
import { createBolts } from './bolt.js';
import { createWreckage } from './wreck.js';
import { makeCharacter } from './poster/characters.js';

const box = new THREE.BoxGeometry(1, 1, 1), puffGeo = new THREE.IcosahedronGeometry(1, 1);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();

// ---------- tornado skins: funnel colours, glowing lights, lightning colours, an effect, and things riding the vortex ----------
const lmC = new Map(), bmC = new Map(); // one material per colour, shared: the things a storm throws out come and go all round
const LM = (c, o) => { if (o) return new THREE.MeshLambertMaterial({ color: c, ...o }); let m = lmC.get(c); if (!m) lmC.set(c, (m = new THREE.MeshLambertMaterial({ color: c }))); return m; }, BM = (c) => { let m = bmC.get(c); if (!m) bmC.set(c, (m = new THREE.MeshBasicMaterial({ color: c }))); return m; };
const sph = new THREE.SphereGeometry(0.5, 10, 8), coneG = new THREE.ConeGeometry(0.5, 1, 8), cylG = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
function piece(parent, geo, mat, sx, sy, sz, x, y, z) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m; }
const batWing = (() => { const pts = [[0, 0], [0.36, 0.12], [0.8, 0.03], [0.64, -0.14], [0.54, -0.4], [0.42, -0.2], [0.3, -0.44], [0.2, -0.22], [0.06, -0.32]], pos = []; // x: out along the wing, y: forward. A fan from the shoulder
  for (let i = 1; i < pts.length - 1; i++) pos.push(0, 0, 0, pts[i][0], 0, pts[i][1], pts[i + 1][0], 0, pts[i + 1][1]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; })();
const batSkin = new THREE.MeshLambertMaterial({ color: 0x2a1c34, side: THREE.DoubleSide });
function bat() { const g = new THREE.Group(), b = LM(0x16121a); piece(g, sph, b, 0.26, 0.24, 0.4, 0, 0, 0); piece(g, sph, b, 0.2, 0.19, 0.2, 0, 0.07, 0.22); piece(g, sph, LM(0x2a2030), 0.08, 0.07, 0.1, 0, 0.03, 0.32); for (const x of [-0.07, 0.07]) { piece(g, coneG, b, 0.08, 0.2, 0.05, x, 0.22, 0.2); piece(g, sph, BM(0xff3a3a), 0.035, 0.035, 0.035, x * 0.8, 0.1, 0.31); }
  const wings = [-1, 1].map((sd) => { const w = new THREE.Group(); w.position.set(sd * 0.1, 0.05, 0.02); g.add(w); const m = new THREE.Mesh(batWing, batSkin); m.scale.set(sd * 1.05, 1, 1.05); w.add(m); piece(w, box, b, 0.8, 0.025, 0.03, sd * 0.4, 0.005, 0.07).rotation.y = sd * -0.12; return w; }); g.userData.wings = wings; g.userData.fly = true; return g; }
function pumpkin() { const g = new THREE.Group(); piece(g, sph, LM(0xf07a1a), 0.62, 0.5, 0.62, 0, 0, 0); piece(g, cylG, LM(0x3a6a2a), 0.06, 0.14, 0.06, 0, 0.29, 0); const lit = BM(0xffe27a); for (const x of [-0.12, 0.12]) piece(g, coneG, lit, 0.09, 0.1, 0.04, x, 0.06, 0.29); piece(g, box, lit, 0.26, 0.06, 0.04, 0, -0.1, 0.29); return g; }
function reindeer() { const g = new THREE.Group(), br = LM(0x8a5a3a), dk = LM(0x3a2a1a); piece(g, box, br, 0.3, 0.26, 0.62, 0, 0, 0); for (const [x, z] of [[-0.1, -0.22], [0.1, -0.22], [-0.1, 0.22], [0.1, 0.22]]) piece(g, box, dk, 0.07, 0.3, 0.07, x, -0.26, z);
  piece(g, box, br, 0.14, 0.3, 0.14, 0, 0.2, 0.3); piece(g, box, br, 0.18, 0.16, 0.24, 0, 0.36, 0.38); piece(g, sph, BM(0xff2a2a), 0.08, 0.08, 0.08, 0, 0.36, 0.52); for (const x of [-0.08, 0.08]) { piece(g, box, dk, 0.03, 0.22, 0.03, x, 0.52, 0.34); piece(g, box, dk, 0.14, 0.03, 0.03, x * 1.8, 0.6, 0.34); } g.userData.fly = true; return g; }
function snowman() { const g = new THREE.Group(), w = LM(0xf6f8fb); piece(g, sph, w, 0.5, 0.5, 0.5, 0, 0, 0); piece(g, sph, w, 0.38, 0.38, 0.38, 0, 0.38, 0); piece(g, sph, w, 0.28, 0.28, 0.28, 0, 0.68, 0); piece(g, coneG, LM(0xf07a1a), 0.06, 0.18, 0.06, 0, 0.68, 0.18).rotation.x = Math.PI / 2;
  piece(g, cylG, LM(0x1a1a1f), 0.26, 0.04, 0.26, 0, 0.8, 0); piece(g, cylG, LM(0x1a1a1f), 0.17, 0.2, 0.17, 0, 0.9, 0); piece(g, box, LM(0xc23b3b), 0.34, 0.06, 0.34, 0, 0.53, 0); return g; }
function shark() { const g = new THREE.Group(), sk = LM(0x6f879e), bel = LM(0xe8eef2); piece(g, sph, sk, 0.34, 0.34, 1.15, 0, 0, 0); piece(g, sph, bel, 0.28, 0.2, 0.95, 0, -0.07, 0.03); piece(g, coneG, sk, 0.08, 0.3, 0.26, 0, 0.26, -0.05);
  const tail = new THREE.Group(); tail.position.z = -0.55; g.add(tail); piece(tail, coneG, sk, 0.05, 0.36, 0.2, 0, 0.12, -0.08).rotation.x = -0.6; piece(tail, coneG, sk, 0.05, 0.26, 0.16, 0, -0.08, -0.06).rotation.x = -2.4; for (const x of [-0.1, 0.1]) piece(g, sph, BM(0x101010), 0.04, 0.04, 0.04, x, 0.06, 0.48); piece(g, box, LM(0x3a1a1a), 0.16, 0.03, 0.06, 0, -0.06, 0.52);
  g.userData.tail = tail; g.userData.fly = true; return g; }
function bunny(c = 0xf8f8f8) { const g = new THREE.Group(), w = LM(c), pk = LM(0xff9ac8); piece(g, sph, w, 0.42, 0.4, 0.48, 0, 0, 0); piece(g, sph, w, 0.3, 0.3, 0.3, 0, 0.25, 0.18); for (const x of [-0.07, 0.07]) { piece(g, box, w, 0.07, 0.34, 0.05, x, 0.52, 0.16); piece(g, box, pk, 0.04, 0.26, 0.02, x, 0.52, 0.19); } piece(g, sph, w, 0.14, 0.14, 0.14, 0, 0.02, -0.25); piece(g, sph, pk, 0.05, 0.05, 0.05, 0, 0.25, 0.33); return g; }
function egg(c) { const g = new THREE.Group(); piece(g, sph, LM(c), 0.24, 0.32, 0.24, 0, 0, 0); piece(g, cylG, LM(0xffffff), 0.245, 0.04, 0.245, 0, 0.03, 0); return g; }
let flagTex = null; function flag() { if (!flagTex) { const c = document.createElement('canvas'); c.width = 76; c.height = 40; const x = c.getContext('2d'); for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#c23b3b'; x.fillRect(0, i * 40 / 13, 76, 40 / 13 + 1); } x.fillStyle = '#2f4f9f'; x.fillRect(0, 0, 32, 21); x.fillStyle = '#fff'; for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) x.fillRect(3 + k * 6, 3 + r * 4.5, 2, 2); flagTex = new THREE.CanvasTexture(c); }
  const g = new THREE.Group(); piece(g, cylG, LM(0xd8d8d8), 0.03, 1, 0.03, 0, 0, 0); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide })); f.position.set(0.32, 0.3, 0); g.add(f); g.userData.cloth = f; return g; }
function fireball() { const g = new THREE.Group(); piece(g, sph, new THREE.MeshBasicMaterial({ color: 0xffb02a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0.36, 0.36, 0.36, 0, 0, 0); piece(g, sph, BM(0xfff0a0), 0.18, 0.18, 0.18, 0, 0, 0); return g; }
function drum() { const g = new THREE.Group(); piece(g, cylG, LM(0xd8c81a), 0.34, 0.48, 0.34, 0, 0, 0); for (const y of [-0.12, 0.12]) piece(g, cylG, LM(0x2a2a20), 0.35, 0.04, 0.35, 0, y, 0); piece(g, cylG, BM(0x7dff3a), 0.3, 0.03, 0.3, 0, 0.25, 0); return g; }
function poo() { const g = new THREE.Group(), br = LM(0x6a4220), dk = LM(0x4a2c14); piece(g, sph, br, 0.62, 0.26, 0.62, 0, 0, 0); piece(g, sph, br, 0.46, 0.22, 0.46, 0, 0.16, 0); piece(g, sph, dk, 0.3, 0.2, 0.3, 0, 0.3, 0); piece(g, coneG, dk, 0.14, 0.2, 0.14, 0.03, 0.44, 0);
  for (const x of [-0.09, 0.09]) { piece(g, sph, LM(0xffffff), 0.1, 0.1, 0.06, x, 0.18, 0.21); piece(g, sph, LM(0x111111), 0.05, 0.05, 0.04, x, 0.18, 0.24); } return g; }
function tp() { const g = new THREE.Group(); piece(g, cylG, LM(0xf4f2ea), 0.34, 0.34, 0.34, 0, 0, 0).rotation.z = Math.PI / 2; piece(g, cylG, LM(0xb8a888), 0.12, 0.36, 0.12, 0, 0, 0).rotation.z = Math.PI / 2; piece(g, box, LM(0xf4f2ea), 0.3, 0.02, 0.7, 0, -0.17, 0.4); return g; }
function sludge() { const g = new THREE.Group(); piece(g, cylG, LM(0x5a4a2a), 0.34, 0.48, 0.34, 0, 0, 0); for (const y of [-0.12, 0.12]) piece(g, cylG, LM(0x2a2416), 0.35, 0.04, 0.35, 0, y, 0); piece(g, cylG, BM(0x8ac83a), 0.3, 0.03, 0.3, 0, 0.25, 0); return g; }
// ---- more things to ride the vortex, and to be thrown out of it ----
const icoG = new THREE.IcosahedronGeometry(0.5, 0), torG = new THREE.TorusGeometry(0.5, 0.06, 6, 22), errGeo = new THREE.PlaneGeometry(0.9, 0.45), ORANGE = new THREE.Color(0xff8a2a);
const iceMat = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, flatShading: true, transparent: true, opacity: 0.92 }), rockMat = new THREE.MeshLambertMaterial({ color: 0x4a3a34, flatShading: true }), ghostMat = new THREE.MeshBasicMaterial({ color: 0xdcfff0, transparent: true, opacity: 0.82, depthWrite: false }), hotMat = new THREE.MeshBasicMaterial({ color: 0xffb02a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
function iceChunk() { const g = new THREE.Group(), s = 0.7 + Math.random() * 0.5; piece(g, icoG, iceMat, s, s * (0.7 + Math.random() * 0.5), s * (0.8 + Math.random() * 0.4), 0, 0, 0); piece(g, icoG, iceMat, s * 0.5, s * 0.6, s * 0.5, s * 0.35, s * 0.2, 0).rotation.set(1, 2, 0.5); return g; }
function meteor() { const g = new THREE.Group(); piece(g, icoG, rockMat, 0.9, 0.8, 0.85, 0, 0, 0); piece(g, sph, hotMat, 1.3, 1.3, 1.3, 0, 0, 0); for (const [x, y, z] of [[0.3, 0.2, 0.25], [-0.3, -0.1, 0.3], [0.1, -0.3, -0.3]]) piece(g, sph, BM(0xff7a1a), 0.2, 0.2, 0.2, x, y, z); g.userData.trail = true; return g; }
function pie() { const g = new THREE.Group(); piece(g, cylG, LM(0xb8bcc4), 0.56, 0.06, 0.56, 0, 0, 0); piece(g, cylG, LM(0xd8a860), 0.5, 0.1, 0.5, 0, 0.07, 0); piece(g, sph, LM(0xfffaf0), 0.46, 0.24, 0.46, 0, 0.16, 0); piece(g, sph, LM(0xe0203a), 0.12, 0.12, 0.12, 0, 0.3, 0); return g; }
function chicken() { const g = new THREE.Group(), y = LM(0xf4d43a), og = LM(0xf08a1a); piece(g, sph, y, 0.3, 0.3, 0.62, 0, 0, 0); piece(g, sph, y, 0.16, 0.36, 0.16, 0, 0.14, 0.3).rotation.x = 0.5; piece(g, sph, y, 0.2, 0.2, 0.2, 0, 0.32, 0.42); piece(g, coneG, og, 0.08, 0.16, 0.08, 0, 0.3, 0.56).rotation.x = Math.PI / 2; piece(g, box, LM(0xe0203a), 0.04, 0.1, 0.14, 0, 0.44, 0.4); for (const x of [-0.08, 0.08]) { piece(g, box, og, 0.04, 0.3, 0.04, x, -0.24, -0.22); piece(g, sph, BM(0x111111), 0.035, 0.035, 0.035, x, 0.35, 0.5); } return g; }
function clown() { const c = makeCharacter('worker', { clown: Math.random() < 0.5 ? 'hammer' : 'balloons' }); c.scale.setScalar(0.42); return c; }
function zombie() { const z = makeCharacter(['worker', 'suit', 'hoodie', 'plaid'][(Math.random() * 4) | 0], { zombie: true }); z.scale.setScalar(0.42); return z; }
function limb() { const g = new THREE.Group(), sk = LM(0x7a9a6a); piece(g, box, sk, 0.13, 0.5, 0.13, 0, 0, 0); piece(g, sph, sk, 0.17, 0.17, 0.17, 0, 0.3, 0); piece(g, box, LM(0x7a1a14), 0.14, 0.05, 0.14, 0, -0.26, 0); return g; }
function tomb() { const g = new THREE.Group(), st = LM(0x8a9298); piece(g, box, st, 0.4, 0.5, 0.12, 0, 0, 0); piece(g, cylG, st, 0.4, 0.12, 0.4, 0, 0.25, 0).rotation.x = Math.PI / 2; return g; }
function ghost() { const g = new THREE.Group(), dk = BM(0x10201a); piece(g, sph, ghostMat, 0.6, 0.6, 0.6, 0, 0.12, 0); piece(g, cylG, ghostMat, 0.6, 0.42, 0.6, 0, -0.1, 0); for (const [x, z] of [[-0.2, 0.1], [0, -0.14], [0.2, 0.1]]) piece(g, sph, ghostMat, 0.24, 0.3, 0.24, x, -0.34, z); for (const x of [-0.11, 0.11]) piece(g, sph, dk, 0.1, 0.14, 0.06, x, 0.16, 0.27); piece(g, sph, dk, 0.1, 0.16, 0.06, 0, -0.04, 0.29); g.userData.fly = true; return g; }
function chair() { const g = new THREE.Group(), w = LM(0x7a5a3a); piece(g, box, w, 0.42, 0.06, 0.42, 0, 0, 0); piece(g, box, w, 0.42, 0.46, 0.06, 0, 0.25, -0.18); for (const x of [-0.17, 0.17]) for (const z of [-0.17, 0.17]) piece(g, box, w, 0.05, 0.36, 0.05, x, -0.2, z); return g; }
function table() { const g = new THREE.Group(), w = LM(0x5a4030); piece(g, box, w, 0.8, 0.06, 0.5, 0, 0, 0); for (const x of [-0.34, 0.34]) for (const z of [-0.19, 0.19]) piece(g, box, w, 0.06, 0.4, 0.06, x, -0.22, z); return g; }
function mallow() { const g = new THREE.Group(); piece(g, cylG, LM(0xfffaf2), 0.46, 0.42, 0.46, 0, 0, 0); piece(g, cylG, LM(0xd8a860), 0.42, 0.03, 0.42, 0, 0.22, 0); return g; }
function cracker() { const g = new THREE.Group(); piece(g, box, LM(0xc8965a), 0.56, 0.06, 0.56, 0, 0, 0); return g; }
function choc() { const g = new THREE.Group(); piece(g, box, LM(0x5a3420), 0.5, 0.07, 0.5, 0, 0, 0); for (const x of [-0.12, 0.12]) for (const z of [-0.12, 0.12]) piece(g, box, LM(0x6a4028), 0.2, 0.05, 0.2, x, 0.05, z); return g; }
function planet(i = 0) { const g = new THREE.Group(), k = i % 6;
  if (k === 0) { piece(g, sph, LM(0xd8b878), 0.7, 0.66, 0.7, 0, 0, 0); piece(g, torG, LM(0xf0e0b0), 1.3, 1.3, 0.3, 0, 0, 0).rotation.x = 1.25; } // ringed
  else if (k === 1) { piece(g, sph, LM(0xc8502a), 0.5, 0.5, 0.5, 0, 0, 0); piece(g, sph, LM(0x8a3018), 0.2, 0.2, 0.08, 0.1, 0.1, 0.2); } // red
  else if (k === 2) { piece(g, sph, LM(0x2a6ad8), 0.6, 0.6, 0.6, 0, 0, 0); for (const [x, y, z] of [[0.15, 0.1, 0.22], [-0.2, -0.05, 0.16], [0, 0.2, -0.2]]) piece(g, sph, LM(0x3aa04a), 0.26, 0.2, 0.14, x, y, z); } // blue and green
  else if (k === 3) { piece(g, sph, LM(0xe09a4a), 0.86, 0.82, 0.86, 0, 0, 0); for (const y of [-0.14, 0.12]) piece(g, cylG, LM(0xb86a2a), 0.84, 0.07, 0.84, 0, y, 0); } // a striped giant
  else if (k === 4) { piece(g, sph, LM(0x9a9aa4), 0.36, 0.36, 0.36, 0, 0, 0); piece(g, sph, LM(0x6a6a74), 0.12, 0.12, 0.05, 0.05, 0.05, 0.16); } // a moon
  else { piece(g, sph, BM(0xfff0a0), 0.6, 0.6, 0.6, 0, 0, 0); piece(g, sph, hotMat, 0.95, 0.95, 0.95, 0, 0, 0); } // a little sun
  return g; }
function star() { const g = new THREE.Group(); piece(g, icoG, BM(0xffffff), 0.3, 0.3, 0.3, 0, 0, 0); piece(g, sph, hotMat, 0.7, 0.7, 0.7, 0, 0, 0); return g; }
function cube() { const g = new THREE.Group(), n = BM(0x3af0ff); piece(g, box, LM(0x061018), 0.36, 0.36, 0.36, 0, 0, 0); piece(g, box, n, 0.4, 0.07, 0.07, 0, 0, 0); piece(g, box, n, 0.07, 0.4, 0.07, 0, 0, 0); piece(g, box, n, 0.07, 0.07, 0.4, 0, 0, 0); return g; }
const errMat = [], ERRS = [['ERROR', '#ff2a4a'], ['404', '#2af0ff'], ['?!#@', '#2aff6a'], ['NaN', '#ff2ad0']];
function errPanel(i = 0) { const k = i % ERRS.length; if (!errMat[k]) { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#0a0a12'; x.fillRect(0, 0, 128, 64); x.strokeStyle = ERRS[k][1]; x.lineWidth = 6; x.strokeRect(3, 3, 122, 58); x.fillStyle = ERRS[k][1]; x.font = 'bold 34px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ERRS[k][0], 64, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; errMat[k] = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }); }
  const g = new THREE.Group(); g.add(new THREE.Mesh(errGeo, errMat[k])); return g; }
// what a skin throws out: K names the thing (the game decides what it does where it lands), T says how often (seconds, from - to)
const K = (kind, f) => { const m = f(); m.userData.kind = kind; return m; }, T = (make, every = [1.3, 2.6], o = {}) => ({ make, every, ...o });
const rep = (n, f) => Array.from({ length: n }, f);
export const TWISTER_SKINS = {
  // free from the start, so there are two storms to pick from right away
  poo: { name: 'Poonado', price: 0, free: true, desc: 'Free! A brown and green sewer storm full of poo, toilet paper and sewage barrels, leaving a trail of sewage behind it.', layers: [0x4a3018, 0x6a7a24, 0x8a6a3a], op: [0.85, 0.55, 0.36], cloud: 0x2e2812, dust: 0x6a5a2a, junk: [0x5a3a1a, 0x7a8a2a, 0xf4f2ea, 0x3a2a14], bolts: [0x9ad83a, 0xc8a050], boltGlow: 0x6a8a1a, lights: [0x9ad83a, 0xc89a3a], fx: 'sewage', items: () => [...rep(4, poo), ...rep(3, tp), ...rep(2, sludge)], toss: T(() => K('poo', poo), [1.5, 3]) },
  halloween: { name: 'Hallowstorm', price: 2, desc: 'Black funnel, bats and jack-o-lanterns, green, purple and orange lights.', layers: [0x16121c, 0x3a1f4a, 0x4a2a12], op: [0.82, 0.5, 0.32], cloud: 0x120c18, dust: 0x2a1f30, junk: [0x2a1f30, 0x5a3a20, 0x111111, 0xf07a1a], bolts: [0x7dff3a, 0xb05cff, 0xff8a1a], lights: [0x7dff3a, 0xb05cff, 0xff8a1a], items: () => [...rep(8, (_, i) => { const b = bat(); if (i > 3) b.userData.out = 1.5 + Math.random() * 0.7; return b; }), ...rep(4, pumpkin)], toss: T(() => K('pumpkin', pumpkin), [1, 2.1]) }, // half the bats fly wide of the funnel
  christmas: { name: 'Blizzard', price: 2, desc: 'White and snowing, with reindeer and snowmen; red and green lightning.', layers: [0xdfe8f2, 0xf4f8fc, 0xbcd0e2], op: [0.78, 0.5, 0.3], cloud: 0x9aa8b8, dust: 0xf0f6fc, junk: [0xf4f8fc, 0xc23b3b, 0x2a8a3a], bolts: [0xff3a3a, 0x3aff6a], lights: [0x3a8aff, 0xff3a3a], fx: 'snow', items: () => [...rep(3, reindeer), ...rep(3, snowman), ...rep(3, iceChunk)], toss: T(() => K('ice', iceChunk), [0.8, 1.7], { speed: 1.25, scale: 1.8 }) },
  fire: { name: 'Firenado', price: 2, desc: 'A column of fire, embers and red lightning.', layers: [0x8a1408, 0xff4a12, 0xffb02a], op: [0.85, 0.55, 0.35], cloud: 0x2a0a06, dust: 0x5a1a0a, junk: [0x2a1a10, 0xff6a1a, 0x5a2a10], bolts: [0xff2a1a, 0xff6a1a], lights: [0xff3a0a, 0xff8a1a, 0xffd24a], fx: 'embers', glow: true, items: () => rep(5, fireball), toss: T(() => K('fireball', () => { const f = fireball(); f.userData.trail = true; return f; }), [1.1, 2.2]) },
  shark: { name: 'Chompnado', price: 2, desc: 'A spinning waterspout full of sharks.', layers: [0x1a5aa0, 0x4a9ad8, 0xe0f2ff], op: [0.75, 0.52, 0.38], cloud: 0x22405e, dust: 0xbfe6ff, junk: [0x3a6a8a, 0xe0f2ff, 0x1a3a5a], bolts: [0xbfe8ff], lights: [0x6ac8ff, 0xe0f8ff], fx: 'spray', items: () => rep(6, shark), toss: T(() => K('shark', shark), [0.8, 1.7], { speed: 1.2, scale: 1.8 }) },
  easter: { name: 'Bunnynado', price: 2, desc: 'Pastel swirls, bunnies and eggs; pink lightning.', layers: [0xf4a6c8, 0xc8b4f4, 0xb4f0dc], op: [0.72, 0.5, 0.35], cloud: 0xe0c4e8, dust: 0xfce4f2, junk: [0xf4a6c8, 0xc8b4f4, 0xb4f0dc, 0xfff09a], bolts: [0xff6ac8, 0xff9ad8], lights: [0xff9ad8, 0xb49aff, 0x9affd8, 0xfff09a], items: () => [...rep(4, (_, i) => bunny([0xf8f8f8, 0xf4c8e0, 0xd8c8f8, 0xc8f0e0][i])), ...rep(5, (_, i) => egg([0xff9ad8, 0x9ad8ff, 0xfff09a, 0xb4f0dc, 0xd8b4ff][i]))], toss: T(() => K('egg', () => egg([0xff9ad8, 0x9ad8ff, 0xfff09a, 0xb4f0dc, 0xd8b4ff][(Math.random() * 5) | 0])), [0.9, 1.8]) },
  // the bonus skin for beating Megacity: an acid storm with acid rain, bright green lightning and baby tornadoes
  acid: { name: 'Acid Storm', price: 0, bonus: 'Beat Megacity in Tornado Time!', desc: 'Toxic green funnel, acid rain, bright green lightning, and baby tornadoes that spin off, circle you and roam the town.', layers: [0x1f6a0a, 0x7dff3a, 0xd8ff6a], op: [0.85, 0.5, 0.32], cloud: 0x14300c, dust: 0x5aff2a, junk: [0x3a5a1a, 0x7dff3a, 0x2a2a20, 0xd8c81a], bolts: [0x7dff3a, 0xb8ff3a, 0x3aff8a], boltGlow: 0x7dff3a, boltRate: 2, lights: [0x7dff3a, 0xd8ff3a, 0x3aff8a], fx: 'acid', glow: true, babies: true, items: () => rep(5, drum), toss: T(() => K('drum', drum), [1.8, 3.4]) },
  july4: { name: 'Liberty Twister', price: 2, desc: 'A dark funnel wrapped in spinning neon red and blue rings, flags flying, fireworks bursting out.', layers: [0x2a2a3a, 0x5a3a52, 0x2a3a6a], op: [0.8, 0.45, 0.3], neon: [0xff2a4a, 0x2ad8ff], cloud: 0x1e2440, dust: 0xd8dde0, junk: [0xc23b3b, 0xf2f2f2, 0x2f5fbf], bolts: [0xff3a3a, 0xffffff, 0x3a7aff, 0xffd24a], lights: [0xff3a3a, 0xffffff, 0x3a7aff], fx: 'fireworks', items: () => rep(4, flag) },
  // ---- the second set (3 coins each) ----
  clown: { name: 'Honknado', price: 3, desc: 'A rainbow funnel full of clowns, rubber chickens and cream pies. It throws the pies.', layers: [0xffffff, 0xffffff, 0xffffff], op: [0.8, 0.5, 0.32], paint: (k, a, i, c) => c.setHSL((k * 1.3 + i * 0.13) % 1, 1, 0.55), cloud: 0x5a2a6a, dust: 0xffd24a, junk: [0xff3a5a, 0xffd24a, 0x3ad0ff, 0x7dff3a], bolts: [0xff7ae0, 0xffd24a, 0x3ad0ff], boltGlow: 0xff7ae0, lights: [0xff3a5a, 0xffd24a, 0x3ad0ff, 0x7dff3a], fx: 'confetti', items: () => [...rep(3, clown), ...rep(3, chicken), ...rep(3, pie)], toss: T(() => (Math.random() < 0.6 ? K('pie', pie) : K('chicken', chicken)), [0.9, 1.9]) },
  zombie: { name: 'Zombienado', price: 3, desc: 'A rotten green funnel full of the dead. It drops zombies into the streets, and they go after the living.', layers: [0x26321a, 0x5a6a2a, 0x7a2a22], op: [0.85, 0.52, 0.3], cloud: 0x1a2014, dust: 0x4a5a2a, junk: [0x3a4a2a, 0x7a2a22, 0x8a8f96, 0x2a2a20], bolts: [0x9dff3a, 0xff4a3a], boltGlow: 0x5a8a1a, lights: [0x9dff3a, 0xff4a3a], items: () => [...rep(4, zombie), ...rep(3, limb), ...rep(2, tomb)], toss: T(() => K('zombie', zombie), [2.2, 4]) },
  ghost: { name: 'Ghostnado', price: 3, desc: 'A pale, glowing funnel of ghosts and flying furniture, dripping green ectoplasm. Anyone a ghost lands beside walks straight into the storm.', layers: [0x16382c, 0x6affb8, 0xd8fff0], op: [0.6, 0.42, 0.3], cloud: 0x1a2a2a, dust: 0x9affd0, junk: [0xd8fff0, 0x5a4a3a, 0x7dffb0], bolts: [0x7dffb0, 0xd8fff0], boltGlow: 0x3aff9a, lights: [0x7dffb0, 0xd8fff0], fx: 'ecto', glow: true, items: () => [...rep(4, ghost), ...rep(2, chair), table()], toss: T(() => (Math.random() < 0.55 ? K('ghost', ghost) : K('chair', chair)), [1.4, 2.6]) },
  mallow: { name: 'Mallownado', price: 3, desc: 'A sticky white storm of marshmallows, crackers and chocolate. Its blobs glue people to the spot.', layers: [0xe8dccc, 0xffffff, 0xffd0e0], op: [0.88, 0.55, 0.3], cloud: 0xd8ccc0, dust: 0xffffff, junk: [0xffffff, 0xc89a5a, 0x5a3420, 0xffd0e0], bolts: [0xffffff, 0xffb0d0], boltGlow: 0xffd0e0, lights: [0xffffff, 0xffd0e0], items: () => [...rep(5, mallow), ...rep(2, cracker), ...rep(2, choc)], toss: T(() => K('mallow', mallow), [1.1, 2.2], { scale: 1.8 }) },
  planet: { name: 'Planetnado', price: 3, desc: 'A little solar system caught in a dark funnel. Now and then a meteor breaks loose and flattens a building.', layers: [0x06061a, 0x2a1a6a, 0x5a4ab8], op: [0.88, 0.5, 0.28], cloud: 0x0a0a20, dust: 0x3a2a7a, junk: [0x8a8f96, 0x5a4a3a, 0xffd24a], bolts: [0xffffff, 0xffd24a, 0x9a8aff], boltGlow: 0x9a8aff, lights: [0xffffff, 0xfff0b0, 0x9ad0ff], fx: 'stars', glow: true, items: () => rep(6, (_, i) => planet(i)), toss: T(() => K('meteor', meteor), [2, 3.6], { scale: 1.7 }) },
  wormhole: { name: 'Wormhole', price: 3, desc: 'A blue and orange tunnel through space, turning like a drill, with stars streaming round it.', layers: [0xffffff, 0xffffff, 0xffffff], op: [0.92, 0.42, 0.2], paint: (k, a, i, c) => { const s = Math.sin(a * 2 + k * 10 + i * 1.3); return c.setHex(0x0a2ad8).lerp(ORANGE, s > 0.25 ? 1 : s < -0.25 ? 0 : (s + 0.25) * 2).multiplyScalar(i ? 0.7 : 1); }, cloud: 0x0c1030, dust: 0x3a7aff, junk: [0xffffff, 0x7ab8ff, 0xffb05a], bolts: [0x7ab8ff, 0xffb05a, 0xffffff], boltGlow: 0x3a7aff, lights: [0xffffff, 0x7ab8ff, 0xffb05a], fx: 'stars', items: () => rep(4, star), toss: T(() => K('star', star), [1.6, 3]) },
  grid: { name: 'Gridnado', price: 3, desc: 'A black funnel wrapped in a glowing blue grid, with neon rings and bright fragments of data.', layers: [0x02040a, 0x061826, 0x0a2a44], op: [0.92, 0.6, 0.3], neon: [0x3af0ff, 0x2a7aff], wire: 0x3af0ff, cloud: 0x04080e, dust: 0x0a3a5a, junk: [0x3af0ff, 0x0a1a2a, 0x2a7aff], bolts: [0x3af0ff, 0xffffff], boltGlow: 0x3af0ff, lights: [0x3af0ff, 0x2a7aff], items: () => rep(6, cube), toss: T(() => K('cube', cube), [1.2, 2.4]) },
  void: { name: 'The Void', price: 3, desc: 'Almost nothing to see: a dark hole in the sky that swallows the light. People do not notice it until it is on top of them.', layers: [0x020104, 0x08040f, 0x3a1f7a], op: [0.94, 0.6, 0.34], cloud: 0x030206, dust: 0x0a0612, junk: [0x0a0612, 0x1a0f2e, 0x2a1a5a], bolts: [0x6a3aff, 0x2a1a5a], boltGlow: 0x3a1a8a, fx: 'void', stealth: true, items: () => [] },
  glitch: { name: 'Glitchnado', price: 3, desc: 'A broken storm: it jumps, splits into red, green and blue, drops out for a frame, and throws error messages about.', layers: [0xff2a4a, 0x2aff6a, 0x2a6aff], op: [0.7, 0.5, 0.45], cloud: 0x1a1a22, dust: 0xff2ad0, junk: [0xff2a4a, 0x2aff6a, 0x2a6aff, 0xffffff], bolts: [0xff2ad0, 0x2af0ff, 0xffffff], boltGlow: 0xff2ad0, lights: [0xff2a4a, 0x2aff6a, 0x2a6aff], fx: 'pixels', glow: true, glitch: true, items: () => rep(5, (_, i) => errPanel(i)), toss: T(() => K('error', () => errPanel((Math.random() * 4) | 0)), [1.1, 2.2]) },
};
// the soft shadow a storm throws on the ground under it
let shadowTex = null; function shadowTexture() { if (shadowTex) return shadowTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); shadowTex = new THREE.CanvasTexture(c); return shadowTex; }
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
// lightning matches the skin (its own bolts and the tap-to-move bolts in Tornado Alley); boltEdge draws a dark outline
// instead of a glow (Hallowstorm: orange bolts edged in black)
const BOLTS = { halloween: { bolts: [0xff7a1a, 0xff9a2a], boltGlow: 0x000000, boltEdge: true }, christmas: { bolts: [0xff3a3a, 0x3aff6a], boltGlow: 0xffffff }, fire: { bolts: [0xff2a1a, 0xff5a1a], boltGlow: 0xff3a0a }, shark: { bolts: [0xbfe6ff, 0x6ac8ff], boltGlow: 0x3a9aff }, easter: { bolts: [0xff8ad8, 0xffb4e8], boltGlow: 0xff6ac8 }, acid: { bolts: [0x7dff3a, 0xb8ff3a, 0x3aff8a], boltGlow: 0x7dff3a }, july4: { bolts: [0xff3a3a, 0xffffff, 0x3a6aff], boltGlow: 0xb8c8ff } };
for (const k in BOLTS) if (TWISTER_SKINS[k]) Object.assign(TWISTER_SKINS[k], BOLTS[k]);

function streakTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) { const y = Math.random() * 128, h = 2 + Math.random() * 7; g.fillStyle = Math.random() < 0.5 ? 'rgba(40,40,50,0.55)' : 'rgba(255,255,255,0.75)'; g.save(); g.translate(0, y); g.transform(1, -0.35, 0, 1, 0, 0); g.fillRect(-20, 0, 180, h); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function createTwisters(scene, { onBolt, onToss } = {}) {
  const tex = streakTexture();
  const layerMats = [[0x55555f, 0.6], [0x8b8b98, 0.38], [0xb0a48c, 0.2]].map(([c, o]) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(3, 2); return new THREE.MeshBasicMaterial({ color: c, map: t, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide }); });
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0x3a3a46, transparent: true, opacity: 0.62, depthWrite: false });
  const dustMat = new THREE.MeshBasicMaterial({ color: 0x9c8c70, transparent: true, opacity: 0.32, depthWrite: false });
  const junkMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const JUNK = [0x7a5a3a, 0x5a3a26, 0x3a3a40, 0xd8d0c0, 0x8a8f96, 0xa04030, 0x2f6f8a, 0x6a7a40];
  const twisters = [], chunks = [], zaps = createBolts(scene), wreck = createWreckage(scene), UPV = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0); let fx = null; // fx: the game's fire and smoke (set with setFx), for dust, sparks and burning wreckage
  const rnd = (a, b) => a + Math.random() * (b - a), WHITE = new THREE.Color(0xdfe8ff), bo = { x: 0, z: 0 };
  // torn-off chunks are all drawn as ONE instanced mesh (a draw each used to bog phones down on the big maps); each chunk
  // is a plain Object3D that's moved as before, then copied in here once a frame
  const RUB_MAX = 700, rub = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xffffff }), RUB_MAX); rub.frustumCulled = false; rub.count = 0;
  rub.setColorAt(0, new THREE.Color()); const rubCol = new THREE.Color();
  function drawRubble() { if (rub.parent !== scene) scene.add(rub); let n = 0;
    for (const c of chunks) { if (!c.inst || c.t < 0 || !c.m.visible) continue; if (n >= RUB_MAX) break; c.m.updateMatrix(); rub.setMatrixAt(n, c.m.matrix); rub.setColorAt(n, rubCol.setHex(c.hex)); n++; }
    rub.count = n; rub.instanceMatrix.needsUpdate = true; if (rub.instanceColor) rub.instanceColor.needsUpdate = true; }

  // funnel radius at height y (0..H)
  const radiusAt = (tw, y) => tw.r0 + Math.pow(Math.max(0, y) / tw.H, 1.7) * tw.r1;

  // the funnel bends: its top trails behind the way it's moving and a slow S-wave runs up it. The offset at each height is
  // worked out once a frame (33 steps) and everything riding the funnel reads it from there
  function bendLut(tw) { const L = tw.lut; for (let i = 0; i <= 32; i++) { const k = i / 32, kk = Math.pow(k, 1.6), y = k * tw.H; L[i * 2] = tw.bx * kk + Math.sin(tw.t * 1.6 + y * 0.55) * 0.32 * k * tw.wob; L[i * 2 + 1] = tw.bz * kk + Math.cos(tw.t * 1.3 + y * 0.5) * 0.32 * k * tw.wob; } }
  const bendAt = (tw, y) => { const i = Math.max(0, Math.min(32, Math.round((y / tw.H) * 32))) * 2; bo.x = tw.lut[i]; bo.z = tw.lut[i + 1]; return bo; };
  // shift a mesh's vertices by the bend at their height (rot: how far the mesh itself has spun round, so the bend stays put)
  function bendMesh(tw, m, rot) { const P = m.geometry.attributes.position, A = P.array, B = m.userData.base || (m.userData.base = A.slice()), ca = Math.cos(rot), sa = Math.sin(rot);
    for (let q = 0; q < A.length; q += 3) { const b = bendAt(tw, B[q + 1]); A[q] = B[q] + b.x * ca - b.z * sa; A[q + 2] = B[q + 2] + b.x * sa + b.z * ca; } P.needsUpdate = true; }
  function make(big, extras = [], skinKey = null, opts = {}) {
    const H = big ? 11 : 4.5, r0 = big ? 0.35 : 0.18, r1 = big ? 3.6 : 1.3; const skin = opts.skin || TWISTER_SKINS[skinKey] || null; /* opts.skin: a look of its own that isn't in the shop (the rogue twister) */
    const g = new THREE.Group(); const tw = { g, big, H, r0, r1, t: Math.random() * 10, layers: [], junk: null, items: [], boltT: 1, k: 1, skin, skinKey, fxT: 0, baby: !!opts.baby, quiet: !!opts.quiet, tossT: 1.2 + Math.random() * 1.5, gT: 0, babyT: 1.5, bx: 0, bz: 0, wob: big ? 1 : 0.45, lut: new Float32Array(66), prev: null, flash: 0, dustT: 0, capHex: skin ? skin.cloud : 0x3a3a46 };
    const mats = layerMats.map((m, i) => { const c = m.clone(); c.map = m.map.clone(); c.map.needsUpdate = true; if (skin) { c.color.setHex(skin.layers[i]); c.opacity = skin.op[i]; if (skin.glow && i > 0) c.blending = THREE.AdditiveBlending; } return c; });
    const capMat = skin ? cloudMat.clone() : cloudMat; if (skin) capMat.color.setHex(skin.cloud); const skirtMat = skin ? dustMat.clone() : dustMat; if (skin) skirtMat.color.setHex(skin.dust);
    const junkCols = skin ? skin.junk : JUNK; tw.own = [...mats, ...(skin ? [capMat, skirtMat] : [])]; if (skin && skin.items && !opts.baby) extras = [...extras, ...skin.items().map((o) => { o.scale.multiplyScalar(big ? 1.9 : 1.2); return o; })];
    // three nested funnel layers, each a lathe with streaks scrolling round it
    [1, 1.12, 1.3].forEach((s, i) => { const pts = []; for (let j = 0; j <= 14; j++) { const y = (j / 14) * H; pts.push(new THREE.Vector2(radiusAt(tw, y) * s, y)); } const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), mats[i]); m.renderOrder = 2; m.frustumCulled = false; g.add(m); tw.layers.push(m); });
    // a funnel painted by height and angle (a rainbow, a spiral) rather than one colour a layer
    if (skin && skin.paint) tw.layers.forEach((L, i) => { const P = L.geometry.attributes.position, col = new Float32Array(P.count * 3); for (let q = 0; q < P.count; q++) { const c = skin.paint(P.getY(q) / H, Math.atan2(P.getZ(q), P.getX(q)), i, tmpC); col[q * 3] = c.r; col[q * 3 + 1] = c.g; col[q * 3 + 2] = c.b; } L.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); L.material.vertexColors = true; L.material.color.setHex(0xffffff); L.material.needsUpdate = true; });
    // dark cloud cap and a dust skirt, as instanced puffs
    // (the big storm's cap is two rings: the thick wall cloud round the funnel's mouth, and a wider, flatter shelf above it)
    const capIn = big ? 16 : 6, capN = big ? 24 : 6; const cap = new THREE.InstancedMesh(puffGeo, capMat, capN); tw.cap = cap; tw.capP = [];
    for (let i = 0; i < capN; i++) { const out = i >= capIn, a = (i / (out ? capN - capIn : capIn)) * Math.PI * 2 + (out ? 0.3 : 0), rr = out ? 4.2 + Math.random() * 1.4 : (big ? 2 : 0.8) + Math.random() * (big ? 3 : 1.2); tw.capP.push({ a, rr, y: H + (out ? 0.9 + Math.random() * 0.7 : Math.random() * 0.8), s: out ? 1.3 + Math.random() * 0.7 : (big ? 1.2 : 0.6) + Math.random() * (big ? 1 : 0.4) }); }
    cap.frustumCulled = false; g.add(cap);
    const dustN = big ? 14 : 6; const dust = new THREE.InstancedMesh(puffGeo, skirtMat, dustN); tw.dust = dust; tw.dustP = []; for (let i = 0; i < dustN; i++) tw.dustP.push({ a: Math.random() * 6.28, rr: (big ? 1 : 0.4) + Math.random() * (big ? 1.6 : 0.6), s: (big ? 0.5 : 0.25) + Math.random() * 0.4, v: 3 + Math.random() * 3 });
    dust.frustumCulled = false; g.add(dust);
    // junk riding the vortex
    const jn = big ? 60 : 16; const junk = new THREE.InstancedMesh(box, junkMat, jn); junk.frustumCulled = false; tw.junk = junk; tw.junkP = [];
    for (let i = 0; i < jn; i++) { const plank = Math.random() < 0.5; tw.junkP.push({ a: Math.random() * 6.28, y: Math.random() * H * 0.9, sz: plank ? [0.5 + Math.random() * 0.5, 0.06, 0.12] : [0.12 + Math.random() * 0.2, 0.12 + Math.random() * 0.2, 0.1 + Math.random() * 0.2], spin: [Math.random() * 6, Math.random() * 6, Math.random() * 6], jit: Math.random() * 0.5 }); junk.setColorAt(i, tmpC.set(junkCols[(Math.random() * junkCols.length) | 0])); }
    g.add(junk);
    // glowing lights swirling in the funnel
    if (skin && skin.lights) { const ln = big ? 22 : 10; const lights = new THREE.InstancedMesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), ln); lights.frustumCulled = false; tw.lights = lights; tw.lightP = []; tw.own.push(lights.material);
      for (let i = 0; i < ln; i++) { tw.lightP.push({ a: Math.random() * 6.28, y: Math.random() * H, v: 2 + Math.random() * 3, s: 0.12 + Math.random() * 0.12 }); lights.setColorAt(i, tmpC.set(skin.lights[i % skin.lights.length])); } g.add(lights); }
    // neon rings (Liberty Twister): glowing red and blue bands spiralling round the funnel, spinning fast
    if (skin && skin.neon) { const ng = new THREE.Group(); tw.neonG = ng; tw.neon = []; const n = big ? 9 : 5, th = big ? 0.08 : 0.035;
      for (let i = 0; i < n; i++) { const y0 = H * (0.04 + i / n * 0.9), dy = H * (0.06 + Math.random() * 0.06), a0 = Math.random() * 6.28, turns = 0.75 + Math.random() * 0.6, pts = [];
        for (let j = 0; j <= 24; j++) { const s = j / 24, y = y0 + s * dy, a = a0 + s * turns * Math.PI * 2, r = radiusAt(tw, y) * (1.12 + 0.12 * Math.sin(s * Math.PI)); pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
        const curve = new THREE.CatmullRomCurve3(pts), col = skin.neon[i % skin.neon.length];
        for (const [w, op, core] of [[th * 3.2, 0.28, false], [th, 1, false], [th * 0.45, 1, true]]) { const geo = new THREE.TubeGeometry(curve, 40, w, 6, false), mat = new THREE.MeshBasicMaterial({ color: core ? 0xffffff : col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
          const m = new THREE.Mesh(geo, mat); m.renderOrder = 3; ng.add(m); tw.neon.push(m); tw.own.push(mat); } }
      g.add(ng); }
    // a glowing grid wrapped round the funnel (Gridnado)
    if (skin && skin.wire) { const pts = []; for (let j = 0; j <= 9; j++) { const y = (j / 9) * H; pts.push(new THREE.Vector2(radiusAt(tw, y) * 1.34, y)); } const w = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.LatheGeometry(pts, 14)), new THREE.LineBasicMaterial({ color: skin.wire, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); w.frustumCulled = false; w.renderOrder = 3; g.add(w); tw.wire = w; tw.own.push(w.material); }
    for (const it of extras) { g.add(it); tw.items.push({ o: it, a: Math.random() * 6.28, y: H * (0.25 + Math.random() * 0.5), spin: 1 + Math.random() * 2 }); }
    if (!opts.baby) { const sh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.85 })); sh.scale.set(r1 * 3.4, 1, r1 * 3.4); sh.position.y = 0.16 / 0.42; sh.renderOrder = 1; g.add(sh); tw.shadow = sh; tw.own.push(sh.material); }
    twisters.push(tw); g.userData.twister = tw; return g;
  }

  function remove(g, gone) { const i = twisters.findIndex((t) => t.g === g); if (i >= 0) { if (gone) dispose(twisters[i]); twisters.splice(i, 1); } if (g.parent) g.parent.remove(g); } // gone: it is never coming back, so its GPU resources go too
  // free a twister's own GPU resources (babies come and go all round)
  function dispose(tw) { for (const m of tw.own || []) { if (m.map) m.map.dispose(); m.dispose(); } for (const L of [...tw.layers, ...(tw.neon || []), ...(tw.wire ? [tw.wire] : [])]) L.geometry.dispose(); for (const m of [tw.cap, tw.dust, tw.junk, tw.lights]) if (m) m.dispose(); }

  // baby tornadoes (Acid Storm): spin off the storm, circle it, wander out across town and fade away
  const babies = []; let bounds = null;
  function spawnBaby(p) { const g = make(false, [], p.skinKey, { baby: true }); g.position.copy(p.g.position); g.scale.setScalar(0.001); (p.g.parent || scene).add(g); babies.push({ g, tw: g.userData.twister, parent: p, t: 0, a: Math.random() * 6.28, life: 6 + Math.random() * 3, heading: 0, reach: 0 }); }
  function updateBabies(dt) {
    for (let i = babies.length - 1; i >= 0; i--) { const b = babies[i], g = b.g, P = b.parent.g, k = Math.max(0.6, P.scale.x / 0.42); b.t += dt;
      if (b.t < 2.2) { b.a += dt * 2.6; const R = k * (1.6 + b.t * 1.4); g.position.set(P.position.x + Math.cos(b.a) * R, 0, P.position.z + Math.sin(b.a) * R); b.heading = b.a + 0.8 + (Math.random() - 0.5) * 0.6; }
      else { b.heading += (Math.random() - 0.5) * dt * 3; const sp = 4.2 * k; g.position.x += Math.cos(b.heading) * sp * dt; g.position.z += Math.sin(b.heading) * sp * dt;
        if (bounds) { if (Math.abs(g.position.x) > bounds.x) { g.position.x = Math.sign(g.position.x) * bounds.x; b.heading = Math.PI - b.heading; } if (Math.abs(g.position.z) > bounds.z) { g.position.z = Math.sign(g.position.z) * bounds.z; b.heading = -b.heading; } } }
      const grow = Math.min(1, b.t / 0.6), fade = Math.max(0, Math.min(1, (b.life - b.t) / 0.9)); g.scale.setScalar(Math.max(0.001, P.scale.x * 1.1 * grow * fade)); b.reach = 0.75 * k * grow * fade;
      if (b.t >= b.life) { remove(g); dispose(b.tw); babies.splice(i, 1); } }
  }

  const boltLook = (tw) => ({ color: tw.skin && tw.skin.bolts ? tw.skin.bolts[(Math.random() * tw.skin.bolts.length) | 0] : 0xe8f4ff, glow: tw.skin && tw.skin.boltGlow != null ? tw.skin.boltGlow : 0x7ab8ff, edge: !!(tw.skin && tw.skin.boltEdge) });
  function bolt(tw) {
    const g = tw.g, sc = g.scale.x, y0 = tw.H * (0.25 + Math.random() * 0.7), a = Math.random() * 6.28, r = radiusAt(tw, y0) * sc, b = bendAt(tw, y0);
    const start = new THREE.Vector3(g.position.x + Math.cos(a) * r + b.x * sc, y0 * g.scale.y, g.position.z + Math.sin(a) * r + b.z * sc);
    const toGround = Math.random() < 0.55; const reach = 3 + Math.random() * 5;
    const end = toGround ? new THREE.Vector3(g.position.x + Math.cos(a) * (r + reach), 0.05, g.position.z + Math.sin(a) * (r + reach)) : new THREE.Vector3(g.position.x + Math.cos(a + 0.8) * (r + reach * 0.6), (tw.H + 0.5) * g.scale.y, g.position.z + Math.sin(a + 0.8) * (r + reach * 0.6));
    zaps.bolt(start, end, { ...boltLook(tw), w: 0.1 + 0.09 * sc, minPx: 5, life: 0.2 + Math.random() * 0.1, jit: 0.9 * Math.max(0.6, sc), forks: 2 }); tw.flash = 1;
    if (onBolt) onBolt(end, toGround, tw);
  }
  // the bolt the storm throws at a spot (a tap, a plane, a chaser): out of the cloud, arcing over and down. Returns its glow colour
  function strikeAt(tw, p) { const g = tw.g, sc = g.scale.x, dx = p.x - g.position.x, dz = p.z - g.position.z, d = Math.hypot(dx, dz) || 1, r = Math.min(d * 0.5, radiusAt(tw, tw.H) * sc * 0.75), b = bendAt(tw, tw.H), look = boltLook(tw);
    const from = new THREE.Vector3(g.position.x + (dx / d) * r + b.x * sc, Math.max(p.y + 2, tw.H * g.scale.y * 0.95), g.position.z + (dz / d) * r + b.z * sc);
    zaps.bolt(from, p.clone(), { ...look, w: 0.22 + 0.16 * sc, minPx: 11, life: 0.4, arc: Math.min(2.5, d * 0.1), forks: 3 }); tw.flash = 1; return look.edge ? look.color : look.glow; }

  // rip a building apart, in stages. First it shudders and bursts (dust kicked out round the walls, windows blowing out in
  // sparks and glass); a small house may be plucked up whole and spun. Then it breaks along jagged cracks into real pieces
  // of itself (wreck.js: its own walls with their windows, its roof, the floors inside), which hang there trembling and are
  // torn away from the top down into the funnel, some of them on fire, before being flung out to lie in the street.
  // parts: other meshes that belong to it (cornice, shopfront, roof clutter). o.collapse: no storm, it is knocked apart:
  // o.from is where the blow came from (pieces burst away from it), o.power how hard, o.squash flattens it instead (trodden
  // on by something far bigger), o.push is a velocity every piece carries on with, o.now skips the shudder.
  const CRACK = 0.26, LIFT = 0.7;
  function tear(obj, center, size, tw, loose = [], parts = [], o = {}) {
    const cols = []; obj.traverse((m) => { if (m.isMesh && m.material) { const mt = Array.isArray(m.material) ? m.material[0] : m.material; if (mt.color) cols.push(mt.color.getHex()); } });
    if (!cols.length) cols.push(0x8a8f96);
    const lift = !!tw && !obj.isMesh && size.y < 2.7 && size.x < 2.7 && size.z < 2.7 && Math.random() < 0.45;
    for (const m of loose) { if (!m.parent) continue; m.getWorldPosition(tmpP); scene.attach(m); addChunk(m, tw, (lift ? LIFT : CRACK) + Math.random() * 0.3); }
    chunks.push({ shell: obj, t: o.now ? CRACK : 0, base: obj.position.clone(), s0: obj.scale.clone(), r0: obj.rotation.clone(), tw, lift, spec: { cols, size: size.clone(), center: center.clone(), parts, collapse: !!o.collapse, from: o.from ? o.from.clone() : null, power: o.power || 1, squash: !!o.squash, push: o.push ? o.push.clone() : null } });
    if (fx) { const n = Math.min(8, 3 + Math.round(size.x + size.z)); for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + Math.random(); fx.dust({ x: center.x + Math.cos(a) * size.x * 0.55, y: 0, z: center.z + Math.sin(a) * size.z * 0.55 }, 0.7 + size.y * 0.12, Math.cos(a) * 1.6, Math.sin(a) * 1.6); }
      for (let i = 0; i < Math.min(4, 1 + Math.round(size.y * 0.6)); i++) { const p = { x: center.x + rnd(-0.5, 0.5) * size.x, y: rnd(0.4, 1) * size.y, z: center.z + rnd(-0.5, 0.5) * size.z }; fx.sparks(p, 5, { speed: 4, up: 2, life: 0.4 }); fx.bit(p, 0.5, 0xa8dcf0, 5); } }
  }
  // the shell has had its moment: cut the real thing up where it stands (or hangs, if it was plucked up) and let the pieces go
  function shatter(c) { const o = c.shell, S = c.spec, tw = c.tw, few = chunks.length > 520, meshes = [];
    const take = (r) => r.traverse((m) => { if (m.isMesh && m.visible && !m.isInstancedMesh) meshes.push(m); }); o.updateMatrixWorld(true); take(o); for (const p of S.parts) if (p.parent && p.visible) { p.updateMatrixWorld(true); take(p); }
    const body = new THREE.Box3().setFromObject(o), mid = body.getCenter(new THREE.Vector3()), top = body.max.y, hgt = Math.max(0.5, top - body.min.y);
    const frags = wreck.fracture(meshes, { coarse: few, floors: S.size.y > 1.6 && S.size.x < 6 ? Math.round(S.size.y / 1.15) : 0, box: body });
    o.visible = false; for (const p of S.parts) p.visible = false;
    let burning = 0; for (const k of chunks) if (k.burn) burning++;
    const away = S.from ? new THREE.Vector3(mid.x - S.from.x, 0, mid.z - S.from.z) : null; if (away) { if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5); away.normalize(); }
    // knocked apart: each piece is thrown out from the middle, up (higher pieces more) and away from the blow
    const burst = (k, cy) => { const up = Math.max(0, Math.min(1, (cy - body.min.y) / hgt)), sp = rnd(0.8, 2.6), a = k.out == null ? Math.random() * 6.28 : k.out; k.v0 = new THREE.Vector3(Math.cos(a) * sp, S.squash ? rnd(0.3, 1.3) : rnd(1.5, 3.5) + up * 3 * S.power, Math.sin(a) * sp); if (S.squash) k.v0.multiplyScalar(1.5).setY(k.v0.y / 1.5); if (away) k.v0.addScaledVector(away, rnd(1.2, 3.4) * S.power * (0.5 + up)); if (S.push) k.v0.add(S.push); k.wait = up * 0.14 + Math.random() * 0.1; k.spin.multiplyScalar(1.5); };
    for (const f of frags) { const m = new THREE.Object3D(); m.position.copy(f.centre); m.position.x += (f.centre.x - mid.x) * 0.07; m.position.z += (f.centre.z - mid.z) * 0.07; m.position.y += (f.centre.y - mid.y) * 0.03; // eased apart a little: the cracks open
      addChunk(m, tw, 0); const k = chunks[chunks.length - 1]; k.frag = f; k.collapse = S.collapse; k.out = tmpP.set(f.centre.x - mid.x, 0, f.centre.z - mid.z).length() > 0.01 ? Math.atan2(f.centre.z - mid.z, f.centre.x - mid.x) : Math.random() * 6.28;
      k.wait = S.collapse ? ((f.centre.y - body.min.y) / hgt) * 0.25 + Math.random() * 0.1 : ((top - f.centre.y) / hgt) * (0.3 + hgt * 0.07) + Math.random() * 0.14; // a storm peels it from the top; a collapse goes from the bottom
      k.spin.multiplyScalar(0.3 + 0.25 / (0.4 + f.r)); if (S.collapse) burst(k, f.centre.y); if (!few && burning < 12 && Math.random() < 0.14) { k.burn = true; burning++; } wreck.place(f, m); }
    // grit: a few small loose bits as well
    const n = Math.round((frags.length ? 3 + Math.min(5, S.size.y) : 8 + Math.min(8, S.size.y * 2)) * (few ? 0.4 : 1));
    for (let i = 0; i < n; i++) { const m = new THREE.Object3D(), s = 0.09 + Math.random() * Math.min(0.26, S.size.x * 0.12);
      m.scale.set(s, 0.06 + Math.random() * s * 0.6, s * (0.4 + Math.random() * 0.8)); m.position.set(mid.x + (Math.random() - 0.5) * S.size.x, body.min.y + Math.random() * hgt, mid.z + (Math.random() - 0.5) * S.size.z); addChunk(m, tw, i * 0.03); const k = chunks[chunks.length - 1]; k.inst = true; k.hex = S.cols[(Math.random() * S.cols.length) | 0]; k.collapse = S.collapse; if (S.collapse) burst(k, m.position.y); }
    if (fx) { for (let i = 0; i < 4; i++) fx.dust({ x: mid.x + rnd(-0.5, 0.5) * S.size.x, y: body.min.y + rnd(0, 0.6) * hgt, z: mid.z + rnd(-0.5, 0.5) * S.size.z }, 0.8 + S.size.y * 0.15);
      fx.sparks(mid, few ? 4 : 9, { speed: 5, up: 3, life: 0.5 }); if (!few && S.size.y > 4.2 && Math.random() < 0.4) fx.explode(new THREE.Vector3(mid.x, mid.y * 0.8, mid.z), 0.7); } // something inside goes up: a boiler, a gas main
  }
  // knocked loose without a tornado (a crash): pieces just fly outward and land
  function scatter(meshes, center, power = 5) {
    for (const m of meshes) { if (!m.parent) continue; scene.attach(m); const a = Math.atan2(m.position.z - center.z, m.position.x - center.x) + (Math.random() - 0.5); chunks.push({ m, phase: 'fly', t: 0, vel: new THREE.Vector3(Math.cos(a) * power * (0.5 + Math.random()), 3 + Math.random() * 4, Math.sin(a) * power * (0.5 + Math.random())), spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), rest: 0 }); }
  }
  function addChunk(m, tw, delay) { chunks.push({ m, tw, phase: 'suck', t: -delay, a: Math.random() * 6.28, y: m.position.y, vel: new THREE.Vector3(), spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), hold: 1.2 + Math.random() * 1.8, rest: 0 }); }

  function update(dt) { updateFx(dt); updateBabies(dt); updateTossed(dt);
    for (const tw of twisters) { if (tw.asleep) continue; // asleep: a preview that is off screen
      tw.t += dt; const g = tw.g, t = tw.t, sc0 = Math.max(0.05, g.scale.x); if (tw.shadow) tw.shadow.position.y = 0.16 / sc0; // the shadow stays on the ground however big the storm gets
      { if (!tw.prev) tw.prev = g.position.clone(); let vx = (g.position.x - tw.prev.x) / Math.max(dt, 0.001), vz = (g.position.z - tw.prev.z) / Math.max(dt, 0.001); if (Math.hypot(g.position.x - tw.prev.x, g.position.z - tw.prev.z) > 4) vx = vz = 0; /* put somewhere new, not moved */ tw.prev.copy(g.position);
        const sp = Math.hypot(vx, vz), B = sp > 0.01 ? Math.min(3, (sp * 0.3) / sc0) / sp : 0, e = Math.min(1, dt * 2.5); tw.bx += (-vx * B - tw.bx) * e; tw.bz += (-vz * B - tw.bz) * e; bendLut(tw); }
      tw.layers.forEach((L, i) => { L.material.map.offset.x -= dt * (1.4 + i * 0.5); L.material.map.offset.y += dt * 0.25; L.rotation.y += dt * (2.5 - i * 0.6); L.position.x = Math.sin(t * 1.3 + i) * 0.12 * (tw.big ? 1 : 0.5); L.position.z = Math.cos(t * 1.1 + i) * 0.12 * (tw.big ? 1 : 0.5); bendMesh(tw, L, L.rotation.y); });
      g.rotation.z = Math.sin(t * 0.7) * 0.03; g.rotation.x = Math.cos(t * 0.53) * 0.025;
      if (tw.wire) { tw.wire.rotation.y -= dt * 1.2; bendMesh(tw, tw.wire, tw.wire.rotation.y); }
      if (tw.skin && tw.skin.glitch) { tw.gT -= dt; if (tw.gT <= 0) { tw.gT = 0.05 + Math.random() * 0.14; for (const L of tw.layers) { L.visible = Math.random() > 0.12; L.scale.set(1 + (Math.random() - 0.5) * 0.16, 1, 1 + (Math.random() - 0.5) * 0.16); L.userData.gx = (Math.random() - 0.5) * 0.6; L.userData.gz = (Math.random() - 0.5) * 0.3; } } for (const L of tw.layers) { L.position.x += L.userData.gx || 0; L.position.z += L.userData.gz || 0; } } // it tears: each layer jumps sideways, stretches, and now and then drops out
      if (tw.flash > 0 || tw.capLit) { tw.flash = Math.max(0, tw.flash - dt * 5); tw.capLit = tw.flash > 0; tw.cap.material.color.setHex(tw.capHex).lerp(WHITE, tw.flash * 0.75); } // lightning lights the cloud up from inside
      tw.capP.forEach((p, i) => { p.a += dt * 0.35; { const b = bendAt(tw, tw.H); tmpP.set(Math.cos(p.a) * p.rr + b.x, p.y + Math.sin(t + i) * 0.15, Math.sin(p.a) * p.rr + b.z); } tmpS.set(p.s * 1.6, p.s * 0.55, p.s); tmpM.compose(tmpP, tmpQ.identity(), tmpS); tw.cap.setMatrixAt(i, tmpM); }); tw.cap.instanceMatrix.needsUpdate = true;
      tw.dustP.forEach((p, i) => { p.a += dt * p.v; const pulse = 1 + Math.sin(t * 3 + i) * 0.25; tmpP.set(Math.cos(p.a) * p.rr, p.s * 0.6, Math.sin(p.a) * p.rr); tmpS.setScalar(p.s * pulse); tmpM.compose(tmpP, tmpQ.identity(), tmpS); tw.dust.setMatrixAt(i, tmpM); }); tw.dust.instanceMatrix.needsUpdate = true;
      tw.junkP.forEach((p, i) => { p.y += dt * (1.2 + p.jit); if (p.y > tw.H * 0.95) p.y = 0.1; p.a += dt * (5.5 - (p.y / tw.H) * 3); const r = radiusAt(tw, p.y) * (0.95 + p.jit * 0.5);
        { const b = bendAt(tw, p.y); tmpP.set(Math.cos(p.a) * r + b.x, p.y, Math.sin(p.a) * r + b.z); } tmpE.set(t * p.spin[0], t * p.spin[1], t * p.spin[2]); tmpQ.setFromEuler(tmpE); tmpS.set(p.sz[0], p.sz[1], p.sz[2]); tmpM.compose(tmpP, tmpQ, tmpS); tw.junk.setMatrixAt(i, tmpM); }); tw.junk.instanceMatrix.needsUpdate = true;
      for (const it of tw.items) { it.a += dt * 2.2; it.y += dt * 0.6; if (it.y > tw.H * 0.85) it.y = tw.H * 0.2; const o = it.o, u = o.userData, r = radiusAt(tw, it.y) * (u.out || 1.05); { const b = bendAt(tw, it.y); o.position.set(Math.cos(it.a) * r + b.x, it.y, Math.sin(it.a) * r + b.z); }
        if (u.fly) { o.rotation.set(0, Math.atan2(-Math.sin(it.a), Math.cos(it.a)), 0); o.rotateZ(-0.4); o.position.y += Math.sin(t * 3 + it.a) * 0.2; if (u.wings) { const f = Math.sin(t * 16 + it.a * 3) * 0.7; u.wings[0].rotation.z = f; u.wings[1].rotation.z = -f; } if (u.tail) u.tail.rotation.y = Math.sin(t * 9 + it.a) * 0.5; }
        else { o.rotation.x += dt * it.spin; o.rotation.z += dt * it.spin * 0.7; if (u.cloth) u.cloth.rotation.y = Math.sin(t * 8 + it.a) * 0.4; } }
      if (tw.lights) { tw.lightP.forEach((p, i) => { p.a += dt * p.v; p.y += dt * 0.8; if (p.y > tw.H) p.y = 0.2; const r = radiusAt(tw, p.y) * 0.8; { const b = bendAt(tw, p.y); tmpP.set(Math.cos(p.a) * r + b.x, p.y, Math.sin(p.a) * r + b.z); } tmpS.setScalar(p.s * (1 + Math.sin(t * 6 + i) * 0.35)); tmpM.compose(tmpP, tmpQ.identity(), tmpS); tw.lights.setMatrixAt(i, tmpM); }); tw.lights.instanceMatrix.needsUpdate = true; }
      if (tw.neonG) { tw.neonG.rotation.y += dt * 4.5; for (const m of tw.neon) bendMesh(tw, m, tw.neonG.rotation.y); const pulse = 0.22 + Math.sin(t * 7) * 0.08; for (let i = 0; i < tw.neon.length; i += 3) tw.neon[i].material.opacity = pulse; }
      if (tw.skin && tw.skin.fx && g.parent && !tw.quiet) skinFx(tw, dt);
      // a wall of dust dragged round the foot of the funnel
      if (fx && tw.big && !tw.baby && g.parent === scene && g.visible && sc0 > 0.1) { tw.dustT -= dt; if (tw.dustT <= 0) { tw.dustT = 0.075; const a = Math.random() * 6.28, rr = (tw.r0 + 1.1) * sc0 * 1.5; fx.dust({ x: g.position.x + Math.cos(a) * rr, y: 0, z: g.position.z + Math.sin(a) * rr }, 0.6 + sc0 * 1.1, -Math.sin(a) * 2.4 * sc0, Math.cos(a) * 2.4 * sc0, tw.skin ? tw.skin.dust : 0x9c8c70); } }
      if (tw.big && g.parent === scene) { tw.boltT -= dt; if (tw.boltT <= 0 && g.scale.x > 0.5) { /* (not in a menu preview: lightning is drawn in the scene itself, so it would show on every card) */ tw.boltT = (0.35 + Math.random() * 1.3) / ((tw.skin && tw.skin.boltRate) || 1); bolt(tw); } }
      if (tw.skin && tw.skin.babies && tw.big && !tw.baby && !tw.quiet && g.parent && g.scale.x > 0.15) { tw.babyT -= dt; if (tw.babyT <= 0) { tw.babyT = 3 + Math.random() * 3; if (babies.filter((b) => b.parent === tw).length < 4) spawnBaby(tw); } }
      if (tw.skin && tw.skin.toss && tw.big && !tw.baby && !tw.quiet && g.parent && g.visible && sc0 > 0.1) { tw.tossT -= dt; if (tw.tossT <= 0) { const e = tw.skin.toss.every; tw.tossT = e[0] + Math.random() * (e[1] - e[0]); if (tossed.length < 12) toss(tw); } }
    }
    zaps.update(dt); let budget = 10, cuts = 2; // dust and spark puffs the wreckage may throw this frame; buildings that may be cut up this frame
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i];
      if (c.shell) { c.t += dt; const o = c.shell, t = c.t;
        if (c.lift) { const k = Math.min(1, t / LIFT); o.position.y = c.base.y + k * k * 3.4; o.rotation.y = c.r0.y + k * k * 5; o.rotation.z = c.r0.z + Math.sin(t * 9) * 0.2 * k; o.rotation.x = c.r0.x + Math.cos(t * 7) * 0.14 * k;
          if (c.tw && c.tw.g.parent) { o.position.x += (c.tw.g.position.x - o.position.x) * Math.min(1, dt * 1.2); o.position.z += (c.tw.g.position.z - o.position.z) * Math.min(1, dt * 1.2); } }
        else { o.rotation.z = c.r0.z + Math.sin(t * 95) * 0.035; o.rotation.x = c.r0.x + Math.cos(t * 78) * 0.03; o.position.y = c.base.y + t * 0.9; o.position.x = c.base.x + Math.sin(t * 120) * 0.04; }
        if (t >= (c.lift ? LIFT : CRACK) && cuts-- > 0) { shatter(c); chunks.splice(chunks.indexOf(c), 1); } continue; }
      const m = c.m; c.t += dt; if (c.t < 0) continue;
      if (c.phase === 'suck') {
        if (c.wait > 0) { c.wait -= dt; m.rotation.z = Math.sin(c.t * 45 + c.a) * (c.frag ? 0.025 : 0.05); if (c.frag) wreck.place(c.frag, m); if (c.wait <= 0 && fx && budget-- > 0) { fx.dust(m.position, 0.5 + (c.frag ? c.frag.r * 0.5 : m.scale.x * 0.4)); if (Math.random() < 0.35) fx.sparks(m.position, 3, { speed: 3, up: 2, life: 0.35 }); } continue; } // cracked but still standing: it trembles until its turn
        const tw = c.tw; if (!tw || !tw.g.parent) { c.phase = 'fly'; if (c.v0) c.vel.copy(c.v0); else c.vel.set((Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6); continue; }
        if (c.burn && fx) { c.bt = (c.bt || 0) - dt; if (c.bt <= 0) { c.bt = 0.08; fx.puff('flame', m.position, 0.5 + m.scale.x * 0.3); if (Math.random() < 0.25) fx.puff('smoke', m.position, 0.5); } }
        const cx = tw.g.position.x, cz = tw.g.position.z, sc = tw.g.scale.x; c.y = Math.min(tw.H * 0.8, c.y + dt * 2.6); c.a += dt * (5 - (c.y / tw.H) * 2.5); const r = radiusAt(tw, c.y) * sc * 1.05;
        const bb = bendAt(tw, c.y), want = tmpP.set(cx + Math.cos(c.a) * r + bb.x * sc, c.y * sc, cz + Math.sin(c.a) * r + bb.z * sc); m.position.lerp(want, Math.min(1, dt * 4)); m.rotation.x += c.spin.x * dt; m.rotation.y += c.spin.y * dt; m.rotation.z += c.spin.z * dt;
        if (c.frag) wreck.place(c.frag, m);
        if (c.t > c.hold) { c.phase = 'fly'; const out = new THREE.Vector3(Math.cos(c.a), 0, Math.sin(c.a)), tan = new THREE.Vector3(-Math.sin(c.a), 0, Math.cos(c.a)); c.vel.copy(tan.multiplyScalar(9 + Math.random() * 6)).add(out.multiplyScalar(5 + Math.random() * 5)); c.vel.y = 3 + Math.random() * 5; }
      } else if (c.phase === 'fly') {
        if (c.burn && fx) { c.bt = (c.bt || 0) - dt; if (c.bt <= 0) { c.bt = 0.09; fx.puff('flame', m.position, 0.5 + m.scale.x * 0.3); } }
        c.vel.y -= 16 * dt; m.position.addScaledVector(c.vel, dt); m.rotation.x += c.spin.x * dt; m.rotation.y += c.spin.y * dt; m.rotation.z += c.spin.z * dt;
        const floor = c.frag ? 0.1 : Math.max(0.03, m.scale.y * 0.5); if (c.frag && m.position.y > floor) wreck.place(c.frag, m);
        if (m.position.y <= floor && c.onLand) { m.position.y = floor; const f = c.onLand; chunks.splice(i, 1); f(m); continue; }
        if (m.position.y <= floor) { m.position.y = floor; c.phase = 'rest'; m.rotation.x = 0; m.rotation.z = 0; c.rest = c.frag ? 9 + Math.random() * 5 : c.inst ? 30 : 3; /* a building's own loose parts are a draw each, so they clear away soon */
          if (c.frag) { m.quaternion.setFromUnitVectors(c.frag.n, Math.random() < 0.7 ? UPV : DOWN); m.rotateY(Math.random() * 6.28); m.position.y = 0.07 + Math.random() * 0.1; wreck.place(c.frag, m); } // a wall piece lands flat: face up, mostly
          if (fx && c.inst && m.scale.x > 0.3 && budget-- > 0) { fx.dust({ x: m.position.x, y: 0, z: m.position.z }, 0.5 + m.scale.x * 0.5); if (c.burn) { fx.scorch(m.position, 0.45, 9); fx.ignite(new THREE.Vector3(m.position.x, 0.1, m.position.z), 0.45, 2.5); } } c.burn = false; }
      } else if (c.phase === 'rest') { c.rest -= dt; if (c.rest < 2) { m.position.y -= dt * 0.2; if (c.frag) wreck.place(c.frag, m); } if (c.rest <= 0) { if (c.frag) wreck.free(c.frag); scene.remove(m); chunks.splice(i, 1); } }
    }
    // keep the rubble pile bounded (oldest go first), then draw every chunk in one go
    let rest = 0; for (const c of chunks) if (c.phase === 'rest') rest++; for (const c of chunks) { if (rest <= 250) break; if (c.phase === 'rest' && c.rest > 1) { c.rest = 1; rest--; } }
    drawRubble(); wreck.flush();
  }

  // per-skin effects in world space: snow, embers, spray and fireworks
  const fxParts = []; const fxMat = new Map(); const fxM = (c) => { if (!fxMat.has(c)) fxMat.set(c, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })); return fxMat.get(c); };
  const fxGeo = new THREE.SphereGeometry(0.06, 5, 4);
  let fxHome = scene; // where a storm's own sparks go: the group the storm is in (the scene in a game; a preview has a stage of its own)
  function spark(pos, vel, c, life, grav, size = 1, home = fxHome) { if (fxParts.length > 260 || !home) return; const m = new THREE.Mesh(fxGeo, fxM(c)); m.position.copy(pos); m.scale.setScalar(size); home.add(m); fxParts.push({ m, vel, life, max: life, grav }); }
  // ---------- things a storm's skin throws out (sharks, pumpkins, lumps of ice...): flung from high in the funnel, they arc
  // out and come down in town. The game says what each does where it lands (onToss); with no game, a puff of sparks ----------
  const tossed = [];
  function toss(tw) { const S = tw.skin.toss, g = tw.g, sc = g.scale.x, o = S.make(), y = tw.H * (0.5 + Math.random() * 0.35), a = Math.random() * 6.28, r = radiusAt(tw, y) * sc, k = (S.speed || 1) * (0.55 + sc * 1.1);
    o.scale.multiplyScalar(1.9 * sc * (S.scale || 1.5)); /* thrown things are drawn half as big again as the ones riding inside, so they read from high up */ o.position.set(g.position.x + Math.cos(a) * r, y * sc, g.position.z + Math.sin(a) * r); (g.parent || scene).add(o);
    const out = 2.2 + Math.random() * 3.2, tan = 1.5 + Math.random() * 2; tossed.push({ o, tw, kind: o.userData.kind, vel: new THREE.Vector3((Math.cos(a) * out - Math.sin(a) * tan) * k, (2.5 + Math.random() * 3) * Math.sqrt(k), (Math.sin(a) * out + Math.cos(a) * tan) * k), spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), t: 0, pt: 0 }); }
  function updateTossed(dt) { for (let i = tossed.length - 1; i >= 0; i--) { const c = tossed[i], o = c.o, p = o.position; c.t += dt; c.vel.y -= 12 * dt; p.addScaledVector(c.vel, dt);
      if (o.userData.fly) { tmpP.copy(p).add(c.vel); o.lookAt(tmpP); if (o.userData.tail) o.userData.tail.rotation.y = Math.sin(c.t * 22) * 0.6; if (o.userData.wings) { const f = Math.sin(c.t * 18) * 0.7; o.userData.wings[0].rotation.z = f; o.userData.wings[1].rotation.z = -f; } } else { o.rotation.x += c.spin.x * dt; o.rotation.y += c.spin.y * dt; o.rotation.z += c.spin.z * dt; }
      if (fx && o.userData.trail && o.parent === scene) { c.pt -= dt; if (c.pt <= 0) { c.pt = 0.04; fx.puff('flame', p, 0.4 + o.scale.x * 0.5); } }
      if (p.y > 0.12 && c.t < 6 && o.parent) continue;
      tossed.splice(i, 1); p.y = 0; const home = o.parent; if (home) home.remove(o);
      if (home === scene && onToss && onToss(c.kind, p, c.tw, c.vel) !== false) continue; // the game took it from here
      if (fx && home === scene) fx.dust(p, 0.8); else if (home) for (let q = 0; q < 6; q++) spark(p.clone().setY(0.05), new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), (c.tw.skin.lights || c.tw.skin.junk)[q % 2], 0.5, 6, 1.2, home); } }
  const puddleG = new THREE.CircleGeometry(0.8, 14).rotateX(-Math.PI / 2), puddleM = [0x5a3e1a, 0x6a7a24].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false }));
  function skinFx(tw, dt) {
    const g = tw.g, sc = g.scale.x, kind = tw.skin.fx; tw.fxT -= dt; fxHome = g.parent || scene;
    const at = (y, rr) => { const a = Math.random() * 6.28; return { a, p: new THREE.Vector3(g.position.x + Math.cos(a) * rr * sc, y * sc, g.position.z + Math.sin(a) * rr * sc) }; };
    if (kind === 'snow' && Math.random() < dt * 40) { const { p } = at(tw.H * (0.4 + Math.random() * 0.6), radiusAt(tw, tw.H) * (0.5 + Math.random())); spark(p, new THREE.Vector3((Math.random() - 0.5) * 1.5, -1.2 - Math.random(), (Math.random() - 0.5) * 1.5), 0xffffff, 3.5, 0, 1.4); }
    if (kind === 'embers' && Math.random() < dt * 45) { const y = Math.random() * tw.H; const { a, p } = at(y, radiusAt(tw, y)); spark(p, new THREE.Vector3(Math.cos(a) * 2 - Math.sin(a) * 3, 1.5 + Math.random() * 2, Math.sin(a) * 2 + Math.cos(a) * 3), [0xff6a1a, 0xffb02a, 0xff3a0a][(Math.random() * 3) | 0], 1.4, -1, 1.2); }
    if (kind === 'spray' && Math.random() < dt * 35) { const y = Math.random() * tw.H * 0.6; const { a, p } = at(y, radiusAt(tw, y)); spark(p, new THREE.Vector3(Math.cos(a) * 4, 2 + Math.random() * 2, Math.sin(a) * 4), 0xcfeaff, 1.2, 9, 1.1); }
    if (kind === 'acid' && tw.big && Math.random() < dt * 120) { const { p } = at(tw.H * 0.98, radiusAt(tw, tw.H) * (0.3 + Math.random() * 1.5)); fxParts.push({ m: (() => { const m = new THREE.Mesh(fxGeo, fxM([0x7dff3a, 0xb8ff3a, 0x3aff8a][(Math.random() * 3) | 0])); m.position.copy(p); m.scale.set(1, 5, 1); fxHome.add(m); return m; })(), vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, -11 - Math.random() * 4, (Math.random() - 0.5) * 0.8), life: 2, max: 2, grav: 0, keep: true, fizz: true }); }
    if (kind === 'sewage') { // splashes flung off the funnel, and puddles dropped behind it that shrink away
      if (Math.random() < dt * 30) { const y = Math.random() * tw.H * 0.5; const { a, p } = at(y, radiusAt(tw, y)); spark(p, new THREE.Vector3(Math.cos(a) * 3, 1.5 + Math.random() * 2, Math.sin(a) * 3), [0x6a4a1a, 0x8a9a2a][(Math.random() * 2) | 0], 1.1, 9, 1.2); }
      const lp = tw.sewP || (tw.sewP = g.position.clone()); if (lp.distanceToSquared(g.position) > (0.35 * sc) ** 2 && fxParts.length < 250) { lp.copy(g.position); const m = new THREE.Mesh(puddleG, puddleM[(Math.random() * 2) | 0]); m.position.set(g.position.x + (Math.random() - 0.5) * sc * 2, 0.06 + Math.random() * 0.01, g.position.z + (Math.random() - 0.5) * sc * 2); m.scale.setScalar(sc * (2.2 + Math.random() * 1.2)); fxHome.add(m); fxParts.push({ m, vel: new THREE.Vector3(), life: 2.2, max: 2.2, grav: 0, puddle: true, s0: m.scale.x }); } }
    // fireworks: a rocket every half second or so, climbing out of the top; it bursts in updateFx
    if (kind === 'fireworks' && tw.fxT <= 0) { tw.fxT = 0.28 + Math.random() * 0.5; const { a, p } = at(tw.H * 0.9, radiusAt(tw, tw.H) * 0.5), k = Math.max(0.5, sc / 0.42), c = [0xff3a3a, 0xffffff, 0x3a7aff, 0xffd24a, 0x7dff3a, 0xff7ae0][(Math.random() * 6) | 0];
      fxParts.push({ rocket: true, tw, k, m: (() => { const m = new THREE.Mesh(fxGeo, fxM(0xffe27a)); m.position.copy(p); m.scale.setScalar(2.2); fxHome.add(m); return m; })(), vel: new THREE.Vector3(Math.cos(a) * 5.5 * k, (4.5 + Math.random() * 3.5) * Math.sqrt(k), Math.sin(a) * 5.5 * k), life: 0.4 + Math.random() * 0.3, max: 1, grav: 4, c }); } // out to the side more than up, so the burst stays in view from above
    const S = sc * 2.4; // about the storm's size, 1 to 3
    if (kind === 'void' && Math.random() < dt * 26) { const y = Math.random() * tw.H; const { a, p } = at(y, radiusAt(tw, y) * 2.4 + 1); spark(p, new THREE.Vector3(-Math.cos(a) * 3.4 * S, 0.6, -Math.sin(a) * 3.4 * S), [0x6a3aff, 0x3a1a8a, 0x9a7aff][(Math.random() * 3) | 0], 0.7, 0, 1.4); } // specks of light dragged in and swallowed
    if (kind === 'stars' && Math.random() < dt * 38) { const y = Math.random() * tw.H; const { a, p } = at(y, radiusAt(tw, y) * 1.2); spark(p, new THREE.Vector3(-Math.sin(a) * 5 * S, 1.2, Math.cos(a) * 5 * S), [0xffffff, 0x7ab8ff, 0xffb05a][(Math.random() * 3) | 0], 0.9, 0, 1.1); } // stars streaming round it
    if (kind === 'ecto' && Math.random() < dt * 26) { const y = tw.H * (0.2 + Math.random() * 0.7); const { p } = at(y, radiusAt(tw, y) * 1.1); spark(p, new THREE.Vector3(0, -1, 0), [0x7dffb0, 0x3aff9a][(Math.random() * 2) | 0], 1.3, 5, 1.3); } // ectoplasm dripping off it
    if (kind === 'confetti' && Math.random() < dt * 34) { const y = tw.H * (0.4 + Math.random() * 0.6); const { a, p } = at(y, radiusAt(tw, y) * 1.1); spark(p, new THREE.Vector3(Math.cos(a) * 2 * S, 1 + Math.random(), Math.sin(a) * 2 * S), [0xff3a5a, 0xffd24a, 0x3ad0ff, 0x7dff3a, 0xff7ae0][(Math.random() * 5) | 0], 1.5, 3, 1.3); }
    if (kind === 'pixels' && Math.random() < dt * 30) { const y = Math.random() * tw.H; const { p } = at(y, radiusAt(tw, y) * (0.6 + Math.random() * 1.4)); spark(p, new THREE.Vector3(0, 0, 0), [0xff2a4a, 0x2aff6a, 0x2a6aff, 0xffffff][(Math.random() * 4) | 0], 0.25, 0, 2.2); } // dead pixels popping in and out
  }
  function updateFx(dt) { for (let i = fxParts.length - 1; i >= 0; i--) { const f = fxParts[i]; f.life -= dt; f.vel.y -= f.grav * dt; f.m.position.addScaledVector(f.vel, dt);
      if (f.rocket) { const home = f.m.parent; if (Math.random() < 0.7) spark(f.m.position.clone(), new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.5, (Math.random() - 0.5) * 0.4), 0xffb02a, 0.4, 0, 0.9, home);
        if (f.life <= 0) { const p = f.m.position, k = f.k || 1; // it bursts: a wide shell of streaks round a slower heart of glowing stars (in the batched particles when the game has them)
          if (fx && fx.spray && home === scene) { fx.spray(p, 60, { c: [0xffffff, f.c], speed: 11 * k, up: [-6 * k, 8.5 * k], life: 1.6, size: 0.42 * k, grav: 4.5, drag: 1.4, stretch: 3.2 }); fx.spray(p, 30, { c: [f.c, f.c], speed: 7.5 * k, up: [-4.5 * k, 6 * k], life: 1.7, size: 0.9 * k, grav: 4, drag: 1.4, shape: 0, stretch: 0 }); fx.spray(p, 14, { c: [0xffffff, 0xffe27a], speed: 3 * k, up: [-2 * k, 3 * k], life: 0.9, size: 0.5 * k, grav: 2, drag: 1, shape: 0, stretch: 0 }); fx.flash(p, 5.5 * k, f.c); fx.glow(p, 5 * k, f.c, 0.5, 0.45); }
          else for (let q = 0; q < 34; q++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.4, Math.random() - 0.5).normalize().multiplyScalar((4 + Math.random() * 3.5) * Math.sqrt(k)); spark(p.clone(), v, q % 4 ? f.c : 0xffffff, 1.1 + Math.random() * 0.4, 3, 2.1, home); }
          if (onToss && home === scene) onToss('firework', p, f.tw, f.vel); } }
      else if (f.puddle) f.m.scale.setScalar(f.s0 * Math.max(0.05, f.life / f.max));
      else if (!f.keep) f.m.scale.setScalar(Math.max(0.2, f.life / f.max) * (f.m.scale.x > 0 ? 1 : 1));
      if (f.life <= 0 || f.m.position.y < 0) { const home = f.m.parent; if (home) home.remove(f.m); fxParts.splice(i, 1); if (f.fizz && Math.random() < 0.5) { const q = f.m.position.clone().setY(0.05); for (let k = 0; k < 2; k++) spark(q, new THREE.Vector3((Math.random() - 0.5) * 1.6, 1 + Math.random(), (Math.random() - 0.5) * 1.6), 0xb8ff3a, 0.35, 6, 0.8, home || undefined); } } } }
  function clear() { for (const b of babies) dispose(b.tw); babies.length = 0; for (const f of fxParts) if (f.m.parent) f.m.parent.remove(f.m); fxParts.length = 0; for (const c of tossed) if (c.o.parent) c.o.parent.remove(c.o); tossed.length = 0; for (const tw of twisters) scene.remove(tw.g); twisters.length = 0; zaps.clear(); wreck.clear(); for (const c of chunks) { if (c.m) scene.remove(c.m); } chunks.length = 0; rub.count = 0; }
  function suck(m, tw, o) { scene.attach(m); addChunk(m, tw, 0); if (o && o.onLand) chunks[chunks.length - 1].onLand = o.onLand; } // o.onLand(m): called where it comes down, instead of it lying there (the storm chaser blows up)
  return { make, remove, tear, scatter, suck, update, clear, radiusAt, strikeAt, get tossed() { return tossed; }, setFx(f) { fx = f; }, get wreck() { return wreck; }, get chunks() { return chunks; }, get babies() { return babies; }, setBounds(b) { bounds = b; } };
}
