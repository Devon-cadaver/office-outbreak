// The bonus games' craft skins (names and prices in craftSkinData.js): one per storm skin for Zombie Air Raid's bomber
// and heli and Beam 'Em Up!'s saucer. Each takes its storm's colours and things:
//   PAINT and DECORATIONS: the model's own colours swapped (recolor), plus a few small parts (fins, ears, rings, drips)
//   PILOT: a little head in the canopy (bomber, heli) or in the dome (the saucer's pilot is rebuilt)
//   FOLLOWERS and TRAIL: things that fly with the craft (bats, reindeer, ghosts, moons) and particles it leaves behind
//   WEAPON: the bomber's canisters and its fire, the heli's rockets, the saucer's beam and death ray, and a burst of the
//     skin's colours wherever they land
//   SHOT DOWN: a burst of its own when it is brought down
// makeRig() runs the followers and trail; craftPreview() is the live picture in the shop and the games' menus.
import * as THREE from 'three';
import { STORM_ITEMS as I } from './tornado.js';
import { mergeParts } from './perf.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { recolor, makeBomber, makeHeli } from './air/craft.js';
import { makeShip, makeBeam } from './ufo/models.js';
import { getEquipped, pauseSkinRow, grantSkin, getOwned, equip } from './skins.js';
import { HORDE_IDS, HORDE_SKINS } from './hordeSkinData.js';
import { CRAFT_SKINS, CRAFT_STORMS } from './craftSkinData.js';
import { setFlamePalette } from './fire.js';

// the skin a craft wears (the storm key), or null for its own look
export function craftSkinKey(kind) { const id = getEquipped()['cr_' + kind], k = id ? String(id).split(':')[2] : null; return k && CRAFT_SKINS[kind] && CRAFT_SKINS[kind][k] ? k : null; }
export const craftSkinId = (kind, key) => 'craft:' + kind + ':' + key;

// ---------- small parts ----------
const starGeo = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.2 : 0.5; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); })();
const arrowGeo = (() => { const s = new THREE.Shape(), p = [[0, 0.5], [0.32, 0.02], [0.11, 0.04], [0.14, -0.42], [-0.14, -0.42], [-0.11, 0.04], [-0.32, 0.02]]; s.moveTo(...p[0]); for (const q of p.slice(1)) s.lineTo(...q); return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2); })();
const GEO = { b: new THREE.BoxGeometry(1, 1, 1), s: new THREE.SphereGeometry(0.5, 12, 8), h: new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), c: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), k: new THREE.ConeGeometry(0.5, 1, 10), t: new THREE.TorusGeometry(0.5, 0.1, 6, 20), r: new THREE.TorusGeometry(0.5, 0.025, 4, 36), o: new THREE.TorusGeometry(0.5, 0.032, 8, 40), st: starGeo, ar: arrowGeo };
const mL = new Map(), mB = new Map();
const L = (c) => { let m = mL.get(c); if (!m) mL.set(c, (m = new THREE.MeshLambertMaterial({ color: c }))); return m; };
const B = (c) => { let m = mB.get(c); if (!m) mB.set(c, (m = new THREE.MeshBasicMaterial({ color: c }))); return m; };
const GL = (c, op = 0.45) => new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: op, depthWrite: false });
function P(g, k, c, sx, sy, sz, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, glow = false) { const m = new THREE.Mesh(GEO[k], glow ? B(c) : L(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; }
// a list of parts: [geo, colour, sx, sy, sz, x, y, z, rx, ry, rz, flags]. Flags: g glows, m is mirrored on the other side
function parts(g, list) { for (const p of list) { const [k, c, sx, sy, sz, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, f = ''] = p, gl = f.includes('g'); P(g, k, c, sx, sy, sz, x, y, z, rx, ry, rz, gl); if (f.includes('m')) P(g, k, c, sx, sy, sz, -x, y, z, rx, -ry, -rz, gl); } return g; }
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[(Math.random() * a.length) | 0];
const grp = (...ch) => { const g = new THREE.Group(); for (const c of ch) g.add(c); return g; };
// fit a model into a box of the given size, centred on the origin
function fit(o, size) { const g = new THREE.Group(); g.add(o); const bb = new THREE.Box3().setFromObject(o), s = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()); const k = size / Math.max(s.x, s.y, s.z, 0.001); o.position.sub(c); g.scale.setScalar(k); return g; }

// ---------- canvas textures ----------
const texCache = new Map();
function tex(key, w, h, draw, rx = 1, ry = 1) { let t = texCache.get(key); if (t) return t; const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t; }
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
// the saucer's running lights: lit segments on a dark band (it scrolls round). Two colours alternate if given
const ringTex = (a, b = a) => tex('ring' + a + b, 64, 8, (x) => { x.fillStyle = '#0c0c10'; x.fillRect(0, 0, 64, 8); x.fillStyle = hex(a); x.fillRect(4, 0, 22, 8); x.fillStyle = hex(b); x.fillRect(36, 0, 22, 8); }, 10, 1);
const TEX = {
  tent: () => tex('tent', 64, 8, (x) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#ff3a5a'; x.fillRect(i * 8, 0, 8, 8); } }, 2, 1),
  bands: () => tex('bands', 8, 64, (x) => { const c = ['#d8a24a', '#f0e0b0', '#b86a2a', '#e8c070', '#8a4a2a', '#f0e0b0', '#d8a24a', '#c8803a']; c.forEach((s, i) => { x.fillStyle = s; x.fillRect(0, i * 8, 8, 8); }); }),
  grid: () => tex('grid', 64, 64, (x) => { x.fillStyle = '#000000'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#3af0ff'; x.fillRect(0, 0, 64, 3); x.fillRect(0, 0, 3, 64); }, 12, 6),
  spiral: () => tex('spiral', 64, 64, (x) => { x.fillStyle = '#0a2ad8'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#ff9a3a'; x.lineWidth = 12; for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); } }, 4, 1),
  checker: () => tex('checker', 16, 16, (x) => { x.fillStyle = '#ff2ad0'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#111118'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); }, 16, 4),
  manhole: () => tex('manhole', 64, 64, (x) => { x.fillStyle = '#4a3a28'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#2a2016'; for (let i = 0; i < 64; i += 8) { x.fillRect(i, 0, 3, 64); x.fillRect(0, i, 64, 3); } }, 8, 4),
  egg: () => tex('egg', 64, 32, (x) => { const c = ['#fff09a', '#ff9ad8', '#b4f0dc', '#c8b4f4']; c.forEach((s, i) => { x.fillStyle = s; x.fillRect(0, i * 8, 64, 8); }); x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= 64; i += 8) x.lineTo(i, i % 16 ? 10 : 22); x.stroke(); }, 4, 1),
  lava: () => tex('lava', 64, 64, (x) => { x.fillStyle = '#000000'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#ffffff'; x.lineWidth = 2; let px = 0, py = 10; x.beginPath(); for (let i = 0; i < 40; i++) { const nx = (px + 9 + (i * 37) % 13) % 64, ny = (py + (i * 53) % 29) % 64; if (Math.abs(nx - px) < 30) { x.moveTo(px, py); x.lineTo(nx, ny); } px = nx; py = ny; } x.stroke(); }, 3, 2),
  waves: () => tex('waves', 64, 16, (x) => { x.fillStyle = '#1a5aa0'; x.fillRect(0, 0, 64, 16); x.strokeStyle = '#e0f2ff'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= 64; i++) x.lineTo(i, 8 + Math.sin(i / 64 * Math.PI * 4) * 3); x.stroke(); }, 6, 1),
  dots: () => tex('dots', 64, 64, (x) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); const c = ['#ff3a5a', '#ffd24a', '#3ad0ff', '#7dff3a', '#ff7ae0']; for (let i = 0; i < 18; i++) { x.fillStyle = c[i % 5]; x.beginPath(); x.arc((i * 23) % 64, (i * 37) % 64, 5, 0, 7); x.fill(); } }),
  starry: () => tex('starry', 64, 64, (x) => { x.fillStyle = '#5a4ab8'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#ffffff'; for (let i = 0; i < 26; i++) x.fillRect((i * 29) % 64, (i * 41) % 64, 2, 2); }),
  swirl: () => tex('swirl', 64, 64, (x) => { const g = x.createConicGradient ? x.createConicGradient(0, 32, 32) : null; if (g) { g.addColorStop(0, '#0a2ad8'); g.addColorStop(0.25, '#ff9a3a'); g.addColorStop(0.5, '#0a2ad8'); g.addColorStop(0.75, '#ff9a3a'); g.addColorStop(1, '#0a2ad8'); x.fillStyle = g; } else x.fillStyle = '#3a6aff'; x.fillRect(0, 0, 64, 64); }),
  gridDisc: () => tex('gridDisc', 64, 64, (x) => { x.fillStyle = '#062a3a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#3af0ff'; for (let i = 0; i < 64; i += 8) { x.fillRect(i, 0, 1, 64); x.fillRect(0, i, 64, 1); } }),
  pastel: () => tex('pastel', 64, 64, (x) => { const c = ['#ff9ad8', '#9ad8ff', '#fff09a', '#b4f0dc', '#d8b4ff']; for (let i = 0; i < 5; i++) { x.fillStyle = c[i]; x.fillRect(0, i * 13, 64, 13); } }),
};

// ---------- pilots: a head about one unit across round the origin, with its hat or helmet ----------
function pilot(kind) { const g = new THREE.Group(), skin = 0xf0c9a6;
  const head = (c, sx = 1, sy = 1, sz = 1) => P(g, 's', c, sx, sy, sz);
  const eyes = (c, y = 0.08, z = 0.42, s = 0.14, glow = true) => { for (const x of [-0.17, 0.17]) P(g, 's', c, s, s * 1.2, s * 0.6, x, y, z, 0, 0, 0, glow); };
  const goggles = (c = 0x7ad0ff, y = 0.14) => { P(g, 'c', 0x3a2a1a, 1.04, 0.12, 1.04, 0, y, 0); for (const x of [-0.18, 0.18]) P(g, 'c', c, 0.24, 0.12, 0.24, x, y, 0.47, Math.PI / 2, 0, 0, true); };
  switch (kind) {
    case 'gasmask': head(skin); P(g, 'h', 0xe8c82a, 1.1, 0.9, 1.1, 0, 0.12, 0); P(g, 'c', 0xe8c82a, 1.3, 0.06, 1.3, 0, 0.12, 0.05); P(g, 'c', 0x5a5e62, 0.5, 0.2, 0.5, 0, -0.16, 0.42, Math.PI / 2, 0, 0); for (const x of [-0.3, 0.3]) P(g, 'c', 0x3a3e42, 0.22, 0.24, 0.22, x, -0.28, 0.36, 1.3, 0, 0); for (const x of [-0.17, 0.17]) P(g, 's', 0x9ad8ff, 0.2, 0.2, 0.1, x, 0.04, 0.44, 0, 0, 0, true); break;
    case 'rat': head(0x8a7a6a, 0.9, 0.85, 1.1); P(g, 'k', 0x8a7a6a, 0.5, 0.6, 0.5, 0, -0.08, 0.55, Math.PI / 2, 0, 0); P(g, 's', 0xff9ac8, 0.16, 0.16, 0.16, 0, -0.08, 0.86); for (const x of [-0.32, 0.32]) P(g, 's', 0xb8a898, 0.36, 0.36, 0.1, x, 0.46, 0); goggles(); break;
    case 'skeleton': head(0xe8e2c8); for (const x of [-0.18, 0.18]) P(g, 's', 0x111111, 0.2, 0.22, 0.1, x, 0, 0.44); P(g, 'b', 0x111111, 0.3, 0.06, 0.1, 0, -0.24, 0.43); P(g, 'h', 0x5a3a20, 1.06, 0.85, 1.06, 0, 0.1, 0); goggles(0xff8a1a, 0.2); break;
    case 'witch': head(0x9fe08a); eyes(0x111111, 0.06, 0.44, 0.12, false); P(g, 'c', 0x1a1024, 1.5, 0.05, 1.5, 0, 0.32, 0); P(g, 'k', 0x1a1024, 0.8, 1.3, 0.8, 0, 0.98, 0, -0.2, 0, 0); P(g, 'c', 0xf07a1a, 0.82, 0.1, 0.82, 0, 0.4, 0); break;
    case 'pumpkin': g.add(fit(I.pumpkin(), 1.15)); P(g, 'c', 0x3a6a2a, 0.12, 0.3, 0.12, 0, 0.5, 0); break;
    case 'snowman': head(0xf6f8fb); P(g, 'h', 0xc23b3b, 1.04, 0.7, 1.04, 0, 0.16, 0); P(g, 's', 0xffffff, 0.3, 0.3, 0.3, 0, 0.62, 0); P(g, 'k', 0xf07a1a, 0.14, 0.4, 0.14, 0, -0.02, 0.6, Math.PI / 2, 0, 0); eyes(0x111111, 0.12, 0.44, 0.1, false); P(g, 't', 0xc23b3b, 0.9, 0.9, 1.4, 0, -0.42, 0, Math.PI / 2, 0, 0); break;
    case 'elf': head(skin); P(g, 'k', 0x1e8a4a, 0.95, 1.2, 0.95, 0, 0.75, -0.1, -0.35, 0, 0); P(g, 's', 0xffffff, 0.24, 0.24, 0.24, 0, 1.25, -0.4); for (const x of [-0.5, 0.5]) P(g, 'k', skin, 0.16, 0.4, 0.12, x, 0.06, 0, 0, 0, -Math.sign(x) * 1.1); eyes(0x111111, 0.06, 0.44, 0.1, false); break;
    case 'salamander': head(0xe86a1a, 0.95, 0.85, 1.1); eyes(0xffd24a, 0.1, 0.46); P(g, 'h', 0xc8ccd2, 1.06, 0.8, 1.06, 0, 0.14, -0.04); P(g, 'b', 0x3a2a1a, 0.7, 0.16, 0.1, 0, 0.18, 0.5); break;
    case 'lava': head(0x3a0a04); eyes(0xffd24a, 0.1, 0.44, 0.18); for (let i = 0; i < 5; i++) P(g, 'b', 0xff6a1a, 0.06, 0.6, 0.06, Math.cos(i * 1.3) * 0.48, -0.05, Math.sin(i * 1.3) * 0.48, 0.3 * i, 0, 0.4, true); break;
    case 'shark': head(0x7a8a98, 0.85, 0.85, 1.3); P(g, 'k', 0x7a8a98, 0.12, 0.6, 0.45, 0, 0.6, -0.1); P(g, 'b', 0x2a6aa0, 0.8, 0.26, 0.12, 0, 0.12, 0.62, 0, 0, 0, true); P(g, 'c', 0xffd24a, 0.08, 0.6, 0.08, 0.36, 0.4, 0.3); break;
    case 'bunny': case 'bunnyPink': case 'bunnyLilac': { const c = kind === 'bunny' ? 0xf8f8f8 : kind === 'bunnyPink' ? 0xf4c8e0 : 0xd8c8f8; head(c); for (const x of [-0.18, 0.18]) { P(g, 's', c, 0.24, 1.1, 0.16, x, 0.85, 0); P(g, 's', 0xff9ac8, 0.12, 0.8, 0.06, x, 0.85, 0.06); } P(g, 's', 0xff9ac8, 0.14, 0.12, 0.1, 0, -0.08, 0.48); if (kind === 'bunnyLilac') eyes(0x111111, 0.1, 0.44, 0.12, false); else goggles(); break; }
    case 'hazmat': case 'hazmatAlien': head(0xe8d54a, 1.05, 1.05, 1.05); P(g, 'b', 0x1a2a2a, 0.7, 0.36, 0.2, 0, 0.04, 0.44); if (kind === 'hazmatAlien') { P(g, 's', 0x7dd84a, 0.5, 0.3, 0.1, 0, 0.04, 0.5); eyes(0x0a0a12, 0.06, 0.56, 0.12, false); } break;
    case 'eagle': head(0xf2f2f2); P(g, 'k', 0xffc020, 0.26, 0.5, 0.26, 0, -0.08, 0.58, Math.PI / 2, 0, 0); goggles(0x7ad0ff, 0.16); P(g, 's', 0x5a3a1a, 0.9, 0.5, 0.9, 0, -0.5, 0); break;
    case 'tophat': head(0x7dd84a); eyes(0x0a0a12, 0.04, 0.44, 0.18, false); P(g, 'c', 0x2f5fbf, 1.2, 0.06, 1.2, 0, 0.42, 0); P(g, 'c', 0xf2f2f2, 0.7, 0.8, 0.7, 0, 0.84, 0); P(g, 'c', 0xc23b3b, 0.72, 0.16, 0.72, 0, 0.56, 0); for (let i = 0; i < 3; i++) P(g, 'st', 0x2f5fbf, 0.2, 1, 0.2, (i - 1) * 0.2, 0.92, 0.36, Math.PI / 2, 0, 0, true); break;
    case 'clown': head(0xf8f4e8); P(g, 's', 0xff2a2a, 0.26, 0.26, 0.26, 0, -0.04, 0.5); eyes(0x2a3a8a, 0.14, 0.44, 0.12, false); for (const [x, y, c] of [[-0.45, 0.2, 0xff3a5a], [0.45, 0.2, 0x3ad0ff], [-0.3, 0.42, 0xffd24a], [0.3, 0.42, 0x7dff3a], [0, 0.5, 0xff7ae0]]) P(g, 's', c, 0.4, 0.4, 0.4, x, y, -0.05); P(g, 'c', 0x2a2a3a, 0.36, 0.3, 0.36, 0, 0.78, 0); P(g, 'c', 0x2a2a3a, 0.5, 0.04, 0.5, 0, 0.64, 0); break;
    case 'zombie': head(0x8fbf7a); eyes(0xff3a2a, 0.06, 0.44, 0.12); P(g, 'h', 0x4a4a3a, 1.06, 0.8, 1.06, 0, 0.12, -0.04, 0, 0, 0.3); P(g, 'b', 0x7a2a22, 0.3, 0.08, 0.08, 0.1, -0.2, 0.44); break;
    case 'zombieAlien': head(0x8fbf7a); P(g, 's', 0x0a0a12, 0.18, 0.24, 0.1, -0.16, 0.08, 0.44); P(g, 's', 0xffffff, 0.2, 0.2, 0.2, 0.16, -0.2, 0.52); P(g, 's', 0x111111, 0.08, 0.08, 0.06, 0.16, -0.2, 0.62); P(g, 'b', 0x8fbf7a, 0.05, 0.48, 0.05, 0, 0.6, 0); P(g, 's', 0x9dff3a, 0.16, 0.16, 0.16, 0, 0.86, 0, 0, 0, 0, true); break;
    case 'ghost': head(0xffffff, 1, 1.1, 1); P(g, 'c', 0xffffff, 1, 0.5, 1, 0, -0.3, 0); for (const x of [-0.18, 0.18]) P(g, 's', 0x10201a, 0.16, 0.22, 0.1, x, 0.06, 0.46); goggles(0x7dffb0, 0.26); break;
    case 'mallow': P(g, 'c', 0xfff4e4, 0.95, 1.05, 0.95); P(g, 'c', 0xe8b070, 0.97, 0.12, 0.97, 0, 0.5, 0); P(g, 'c', 0xd89a50, 0.97, 0.08, 0.97, 0, -0.5, 0); goggles(0x7ad0ff, 0.14); P(g, 'b', 0x5a3420, 0.3, 0.06, 0.08, 0, -0.18, 0.47); break;
    case 'astronaut': P(g, 's', 0xf2f2f2, 1.15, 1.15, 1.15); P(g, 's', 0xc8a040, 0.8, 0.5, 0.36, 0, 0.04, 0.44, 0, 0, 0, true); P(g, 'c', 0xc23b3b, 0.12, 0.12, 0.12, 0.4, 0.3, 0.3, Math.PI / 2, 0, 0); break;
    case 'spaceAlien': head(0x7dd84a, 0.8, 0.8, 0.8); eyes(0x0a0a12, 0.04, 0.34, 0.14, false); g.add(new THREE.Mesh(GEO.s, GL(0xd8f0ff, 0.35))).scale.setScalar(1.25); break;
    case 'silver': P(g, 's', 0xc8d0d8, 1.1, 1.1, 1.1); P(g, 's', 0x3a7aff, 0.8, 0.46, 0.36, 0, 0.04, 0.44, 0, 0, 0, true); break;
    case 'silverAlien': head(0x7dd84a, 0.85, 0.85, 0.85); eyes(0x0a0a12, 0.04, 0.36, 0.14, false); P(g, 't', 0xc8d0d8, 1.1, 1.1, 1.6, 0, -0.36, 0, Math.PI / 2, 0, 0); P(g, 'b', 0x3a7aff, 0.7, 0.12, 0.1, 0, 0.18, 0.4, 0, 0, 0, true); break;
    case 'wire': case 'wireAlien': { const w = new THREE.Mesh(GEO.s, new THREE.MeshBasicMaterial({ color: 0x3af0ff, wireframe: true })); g.add(w); if (kind === 'wireAlien') P(g, 'b', 0x3af0ff, 0.04, 0.4, 0.04, 0, 0.62, 0, 0, 0, 0, true); eyes(0xffffff, 0.08, 0.4, 0.12); break; }
    case 'eyes': head(0x050308, 0.9, 0.9, 0.9); eyes(0x9a6aff, 0.06, 0.44, 0.16); break;
    case 'pixel': P(g, 'b', skin, 0.9, 0.9, 0.9); P(g, 'b', 0x2a1a10, 0.94, 0.3, 0.94, 0, 0.36, 0); for (const x of [-0.2, 0.2]) P(g, 'b', 0x111111, 0.14, 0.14, 0.05, x, 0.04, 0.46); P(g, 'b', 0x2aff6a, 0.36, 0.08, 0.05, 0, -0.22, 0.46, 0, 0, 0, true); P(g, 'b', 0xff2ad0, 0.3, 0.3, 0.92, -0.32, -0.3, 0, 0, 0, 0, true); break;
    case 'pixelAlien': P(g, 'b', 0x7dd84a, 0.9, 0.9, 0.9); for (const x of [-0.2, 0.2]) P(g, 'b', 0x0a0a12, 0.18, 0.22, 0.05, x, 0.04, 0.46); P(g, 't', 0xffffff, 0.5, 0.5, 0.5, 0, 0.82, 0, Math.PI / 2, 0, 0, true); break;
    default: head(0x7dd84a); eyes(0x0a0a12, 0.04, 0.42, 0.16, false);
  }
  return g; }
// the saucer's two special pilots: a shark swimming round its bowl, a snowman with snow swirling round him
function ufoPilot(kind) { const g = new THREE.Group();
  if (kind === 'sharkSwim') { const sw = new THREE.Group(); sw.name = 'swim'; const s = fit(I.shark(), 0.62); s.position.set(0.3, 0.2, 0); s.rotation.y = Math.PI; sw.add(s); g.add(sw); return g; }
  if (kind === 'snowGlobe') { g.add(fit(I.snowman(), 0.62)).position.y = 0.18; const sn = new THREE.Group(); sn.name = 'snow'; for (let i = 0; i < 14; i++) P(sn, 's', 0xffffff, 0.05, 0.05, 0.05, Math.cos(i * 2.4) * rnd(0.15, 0.55), rnd(-0.05, 0.55), Math.sin(i * 2.4) * rnd(0.15, 0.55), 0, 0, 0, true); g.add(sn); return g; }
  const p = pilot(kind); p.scale.setScalar(0.5); p.position.y = 0.26; g.add(p); P(g, 's', kind === 'pumpkin' ? 0x1a1024 : 0x5a3a8a, 0.5, 0.3, 0.42, 0, -0.06, 0); return g; }

// ---------- weapons: what the bomber drops and the heli fires ----------
const BUILD = {
  present: () => parts(new THREE.Group(), [['b', 0xc23b3b, 0.5, 0.5, 0.5], ['b', 0x1e8a4a, 0.52, 0.52, 0.1], ['b', 0x1e8a4a, 0.1, 0.52, 0.52], ['s', 0x1e8a4a, 0.18, 0.12, 0.12, 0.08, 0.3, 0], ['s', 0x1e8a4a, 0.18, 0.12, 0.12, -0.08, 0.3, 0]]),
  fuelCan: () => parts(new THREE.Group(), [['b', 0xc41a0a, 0.36, 0.5, 0.24], ['b', 0xffd24a, 0.38, 0.1, 0.26], ['c', 0x2a2a2a, 0.08, 0.14, 0.08, 0.12, 0.3, 0]]),
  fwCake: () => { const g = parts(new THREE.Group(), [['b', 0xc23b3b, 0.5, 0.3, 0.5], ['b', 0xf2f2f2, 0.52, 0.06, 0.52, 0, 0.16, 0]]); for (let i = 0; i < 9; i++) P(g, 'c', 0x2f5fbf, 0.1, 0.12, 0.1, ((i % 3) - 1) * 0.15, 0.22, (((i / 3) | 0) - 1) * 0.15); return g; },
  coffin: () => parts(new THREE.Group(), [['b', 0x5a3a22, 0.36, 0.16, 0.7], ['b', 0x5a3a22, 0.26, 0.15, 0.2, 0, 0, -0.42], ['b', 0xc9a35a, 0.06, 0.02, 0.36, 0, 0.09, 0.05], ['b', 0xc9a35a, 0.2, 0.02, 0.06, 0, 0.09, 0.12]]),
  jar: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(GEO.c, GL(0xbfffe6, 0.5))).scale.set(0.42, 0.56, 0.42); P(g, 'c', 0x7a8a8a, 0.44, 0.08, 0.44, 0, 0.3, 0); const gh = fit(I.ghost(), 0.3); g.add(gh); return g; },
  warpBall: () => parts(new THREE.Group(), [['s', 0x0a2ad8, 0.5, 0.5, 0.5], ['t', 0xff9a3a, 0.56, 0.56, 0.56, 0, 0, 0, Math.PI / 2, 0, 0, 'g'], ['t', 0xff9a3a, 0.5, 0.5, 0.5, 0, 0, 0, 0.6, 0.6, 0, 'g']]),
  voidBall: () => parts(new THREE.Group(), [['s', 0x050308, 0.5, 0.5, 0.5], ['r', 0x6a3aff, 0.6, 0.6, 0.6, 0, 0, 0, Math.PI / 2, 0, 0, 'g']]),
  errBox: () => parts(new THREE.Group(), [['b', 0xe8e8f0, 0.6, 0.4, 0.08], ['b', 0xff2a4a, 0.6, 0.08, 0.09, 0, 0.16, 0, 0, 0, 0, 'g'], ['b', 0x1a1a22, 0.5, 0.22, 0.09, 0, -0.04, 0], ['b', 0xffffff, 0.06, 0.06, 0.1, 0.25, 0.16, 0]]),
  icicle: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(GEO.k, GL(0xcfeeff, 0.85))).scale.set(0.16, 0.6, 0.16); g.children[0].rotation.x = Math.PI / 2; return g; },
  torpedo: () => parts(new THREE.Group(), [['c', 0x8a9aa8, 0.14, 0.5, 0.14, 0, 0, 0, Math.PI / 2, 0, 0], ['s', 0x3a4a5a, 0.14, 0.14, 0.2, 0, 0, 0.26], ['b', 0x2a6aa0, 0.3, 0.02, 0.1, 0, 0, -0.24], ['b', 0x2a6aa0, 0.02, 0.3, 0.1, 0, 0, -0.24]]),
  carrot: () => parts(new THREE.Group(), [['k', 0xff8a1a, 0.16, 0.5, 0.16, 0, 0, 0.05, Math.PI / 2, 0, 0], ['b', 0x3aa04a, 0.04, 0.2, 0.06, 0, 0.06, -0.26, -0.5, 0, 0], ['b', 0x3aa04a, 0.04, 0.2, 0.06, 0.06, 0, -0.26, -0.5, 0, 0.9], ['b', 0x3aa04a, 0.04, 0.2, 0.06, -0.06, 0, -0.26, -0.5, 0, -0.9]]),
  vial: () => { const g = parts(new THREE.Group(), [['c', 0x7dff3a, 0.11, 0.36, 0.11, 0, 0, -0.04, Math.PI / 2, 0, 0, 'g'], ['c', 0x8a5a2a, 0.1, 0.08, 0.1, 0, 0, 0.24, Math.PI / 2, 0, 0]]); const gl = new THREE.Mesh(GEO.c, GL(0xe8fff0, 0.4)); gl.scale.set(0.15, 0.5, 0.15); gl.rotation.x = Math.PI / 2; g.add(gl); return g; },
  bottleRocket: () => parts(new THREE.Group(), [['c', 0xc23b3b, 0.12, 0.34, 0.12, 0, 0, 0.05, Math.PI / 2, 0, 0], ['k', 0xf2f2f2, 0.12, 0.14, 0.12, 0, 0, 0.29, Math.PI / 2, 0, 0], ['b', 0x2f5fbf, 0.13, 0.13, 0.06, 0, 0, -0.04], ['c', 0x8a6a3a, 0.02, 0.5, 0.02, 0.06, 0, -0.3, Math.PI / 2, 0, 0]]),
  bone: () => parts(new THREE.Group(), [['c', 0xe8e2c8, 0.08, 0.5, 0.08, 0, 0, 0, Math.PI / 2, 0, 0], ['s', 0xe8e2c8, 0.12, 0.12, 0.12, 0.05, 0, 0.25, 0, 0, 0, 'm'], ['s', 0xe8e2c8, 0.12, 0.12, 0.12, 0.05, 0, -0.25, 0, 0, 0, 'm']]),
  flamingMallow: () => { const g = grp(fit(I.mallow(), 0.3)); P(g, 'k', 0xffb02a, 0.16, 0.3, 0.16, 0, 0, -0.2, -Math.PI / 2, 0, 0, true); return g; },
  drill: () => parts(new THREE.Group(), [['k', 0x7ab8ff, 0.18, 0.5, 0.18, 0, 0, 0, Math.PI / 2, 0, 0], ['t', 0xff9a3a, 0.16, 0.16, 0.3, 0, 0, -0.08, 0, 0, 0, 'g'], ['t', 0xff9a3a, 0.1, 0.1, 0.3, 0, 0, 0.06, 0, 0, 0, 'g']]),
  dataBolt: () => parts(new THREE.Group(), [['b', 0xffffff, 0.06, 0.06, 0.56, 0, 0, 0, 0, 0, 0, 'g'], ['b', 0x3af0ff, 0.12, 0.12, 0.4, 0, 0, -0.02, 0, 0, 0, 'g']]),
  darkStreak: () => parts(new THREE.Group(), [['s', 0x08040f, 0.16, 0.16, 0.6], ['r', 0x6a3aff, 0.24, 0.24, 0.24, 0, 0, 0.1, 0, 0, 0, 'g']]),
  pointer: () => { const g = new THREE.Group(); const k = new THREE.Mesh(GEO.ar, new THREE.MeshBasicMaterial({ color: 0x0a0a12, side: THREE.DoubleSide })); k.scale.setScalar(0.62); k.position.y = -0.01; const w = new THREE.Mesh(GEO.ar, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); w.scale.setScalar(0.5); g.add(k, w); return g; },
};

// ---------- the 17 looks. Colours are hex; the base model's own colours are listed in BOMBER/HELI below ----------
// fire: [flames, glow] for the fires and blasts; blast: colours thrown up where a weapon lands; boom: the shot-down burst
// b/h/u: the bomber, heli and saucer. paint: colour swaps; deco: parts (see parts()); pilot; fol: followers; trail
const S = Math.PI;
const tipDrips = (c, y, z, xs, f = 'm') => xs.map((x) => ['k', c, 0.06, 0.14, 0.06, x, y, z, S, 0, 0, f]);
const LOOK = {
  poo: { fire: [[0x9ad83a, 0x7a8a2a, 0xc8a050], 0x8ac83a], blast: [0x6a4220, 0x9ad83a, 0xf4f2ea], pool: 0x4a3612, boom: [0x6a4220, 0xf4f2ea, 0x9ad83a],
    b: { paint: { body: 0x5a3a1a, wing: 0x6a7a24, sand: 0xc89a3a, glass: 0x9ab07a, dark: 0x4a3018 }, pilot: 'gasmask', trail: ['tp', 'flies'], can: () => I.sludge(),
      deco: [['c', 0x8a5a2a, 0.04, 0.36, 0.04, 0, 0.68, -1.1], ['k', 0xc23b3b, 0.22, 0.16, 0.22, 0, 0.9, -1.1, S, 0, 0], ...tipDrips(0x7a8a24, -0.02, -0.18, [0.5, 1.0, 1.45], 'm')] },
    h: { paint: { body: 0x6a7a24, belly: 0x4a3018, stripe: 0xf4f2ea, fin: 0x6a7a24, tip: 0xf4f2ea, dark: 0x3a3424, glass: 0x9ab07a }, blur: 0x9aaa5a, pilot: 'gasmask', trail: ['tp', 'flies'], rocket: () => { const t = I.tp(); t.rotation.y = Math.PI; return grp(t); },
      deco: [['b', 0xf4f2ea, 0.66, 0.2, 0.36, 0, 0.02, 0.2], ['b', 0x9ab0b8, 0.67, 0.02, 0.37, 0, 0.02, 0.2], ['t', 0xc87a3a, 0.36, 0.36, 0.5, 0, 0.12, -0.62], ['t', 0xc87a3a, 0.3, 0.3, 0.5, 0, 0.12, -1.4]] },
    u: { hull: [0xffffff, 0x0a0804], map: 'manhole', under: 0x2e2812, lights: [0x9ad83a], band: 0x7a8a2a, dome: [0x7a8a2a, 0x1a2a0a, 0.72], pods: 0x9ad83a, eye: 0x9ad83a, shield: 0x8ac83a, beam: [0x8a9a3a, 0xc8d88a, 0x9ad83a, 0x7a8a2a], ray: [0x8a6a3a, 0xd8c890], pilot: 'rat', trail: ['fliesU'],
      deco: rep(10, (i) => { const a = i / 10 * S * 2; return ['k', 0x7a8a24, 0.1, 0.24, 0.1, Math.cos(a) * 1.95, -0.12, Math.sin(a) * 1.95, S, 0, 0]; }) } },
  halloween: { fire: [[0xff7a1a, 0xffa02a, 0x7dff3a], 0xff7a1a], blast: [0xff8a1a, 0x7dff3a, 0xb05cff], boom: [0xff8a1a, 0x16121c, 0x7dff3a, 0xf07a1a],
    b: { paint: { body: 0x16121c, wing: 0x16121c, sand: 0xf07a1a, glass: 0x3a1f4a, dark: 0x0a080e }, pilot: 'skeleton', fol: 'bats', can: () => I.pumpkin(),
      deco: [['b', 0xf07a1a, 0.14, 0.1, 0.62, 1.62, 0.05, 0.1, 0, 0, 0, 'm'], ['k', 0xffe27a, 0.1, 0.1, 0.03, 0.09, 0.07, 1.21, 0, 0, 0, 'mg'], ['b', 0xffe27a, 0.24, 0.05, 0.03, 0, -0.08, 1.21, 0, 0, 0, 'g']] },
    h: { paint: { body: 0x16121c, belly: 0x2a1f30, stripe: 0xf07a1a, fin: 0xf07a1a, tip: 0xff8a1a, dark: 0x0a080e, glass: 0xff9a2a }, blur: 0xff8a1a, pilot: 'witch', fol: 'bats', rocket: () => I.pumpkin(),
      deco: [['b', 0xf07a1a, 0.22, 0.22, 0.12, 0, 0.12, -0.95], ['b', 0xf07a1a, 0.22, 0.22, 0.12, 0, 0.12, -1.25], ['k', 0x111111, 0.12, 0.12, 0.03, 0.12, 0.14, 1.12, 0, 0, 0, 'm'], ['b', 0x111111, 0.3, 0.05, 0.03, 0, -0.02, 1.12]] },
    u: { hull: [0x16121c, 0x1a0a20], under: 0x2a1f30, lights: [0xff8a1a], band: 0x5a2a7a, dome: [0xb05cff, 0x3a0a5a, 0.62], pods: 0xff8a1a, eye: 0xff8a1a, shield: 0xff8a1a, beam: [0xff8a1a, 0xffd0a0, 0xffa040, 0xff8a1a], ray: [0x7dff3a, 0xeaffd8], pilot: 'pumpkin', fol: 'bats' } },
  christmas: { fire: [[0x9ad8ff, 0xe8f6ff, 0x3a8aff], 0x7ab8ff], blast: [0xffffff, 0xbfe6ff, 0xff3a3a, 0x3aff6a], boom: [0xffffff, 0xff3a3a, 0x3aff6a, 0xbfe6ff],
    b: { paint: { body: 0xf4f8fc, wing: 0xbcd0e2, sand: 0xc23b3b, glass: 0x9ad8ff, dark: 0x9aa8b8 }, pilot: 'snowman', trail: ['snow'], can: BUILD.present,
      deco: [...tipDrips(0xcfeeff, -0.03, -0.2, [0.3, 0.6, 0.9, 1.2, 1.5], 'm'), ...rep(4, (i) => ['b', i % 2 ? 0xffffff : 0xc23b3b, 0.07, 0.08, 0.43, 0, 0.12 + i * 0.1, -1.05])] },
    h: { paint: { body: 0xc62828, belly: 0xf4f8fc, stripe: 0xf4f8fc, fin: 0xf4f8fc, tip: 0xbfe6ff, dark: 0xd8a83a, glass: 0xbfe6ff }, blur: 0xffffff, pilot: 'elf', fol: 'reindeer', trail: ['snow'], rocket: BUILD.icicle,
      deco: [['b', 0xf4f8fc, 0.66, 0.12, 1.54, 0, -0.24, 0.1], ['t', 0x1e8a4a, 0.34, 0.34, 0.5, 0, -0.04, 1.27], ['s', 0xff2a2a, 0.07, 0.07, 0.07, 0.12, 0.06, 1.3, 0, 0, 0, 'm']] },
    u: { hull: [0xdfe8f2, 0x223040], under: 0x9aa8b8, lights: [0xff3a3a, 0x3aff6a], band: 0xc23b3b, dome: [0xe8f6ff, 0x405060, 0.42], pods: 0xffffff, eye: 0x9ad8ff, shield: 0xbfe6ff, beam: [0x9ad8ff, 0xe8f6ff, 0xffffff, 0x9ad8ff], ray: [0xff3a3a, 0xffffff], pilot: 'snowGlobe', trail: ['snowU'] } },
  fire: { fire: [[0xff3a0a, 0xff8a1a, 0xffd24a], 0xff5a0a], blast: [0xffd24a, 0xff6a1a, 0xff2a1a], boom: [0xff3a0a, 0xffd24a, 0x2a0a06], boomRing: 0x3a2a24,
    b: { paint: { body: 0x2a1a10, wing: 0x8a1408, sand: 0xff4a12, glass: 0xffb02a, dark: 0x1a0a06 }, pilot: 'salamander', trail: ['embers'], can: BUILD.fuelCan,
      deco: [['b', 0xff6a1a, 0.02, 0.07, 0.5, 0.215, 0.02, 0.75, 0.25, 0, 0, 'mg'], ['b', 0xffd24a, 0.02, 0.05, 0.36, 0.216, -0.06, 0.8, -0.2, 0, 0, 'mg'], ['s', 0xffb02a, 0.2, 0.2, 0.1, 0.9, 0, 0.66, 0, 0, 0, 'mg']] },
    h: { paint: { body: 0xc41a0a, belly: 0x2a0a06, stripe: 0xffb02a, fin: 0xff6a1a, tip: 0xffd24a, dark: 0x2a0a06, glass: 0xffd24a }, blur: 0xff6a1a, pilot: 'salamander', trail: ['embersRotor'], rocket: () => I.fireball(),
      deco: [['b', 0xffd24a, 0.21, 0.04, 0.5, 0, 0.18, -1.0, 0, 0.25, 0, 'g'], ['b', 0xff8a1a, 0.21, 0.04, 0.4, 0, 0.06, -1.3, 0, -0.25, 0, 'g']] },
    u: { hull: [0xffffff, 0x000000], map: 'lava', glowMap: 0xff6a1a, under: 0x1a0604, lights: [0xff4a12], band: 0xff4a12, dome: [0xffb02a, 0xff6a1a, 0.75], pods: 0xff6a1a, eye: 0xff6a1a, shield: 0xff6a1a, beam: [0xff4a12, 0xffb02a, 0xff8a1a, 0xff4a12], ray: [0xff8a1a, 0xfff0c0], pilot: 'lava', trail: ['embersU'] } },
  shark: { fire: [[0xff7a1a, 0xffb02a, 0x6ac8ff], 0xff8a2a], blast: [0xffffff, 0xbfe6ff, 0x4fa8ff], pool: 0x2a6a9a, boom: [0xffffff, 0x4fa8ff, 0x6f879e],
    b: { paint: { body: 0x7a8a98, wing: 0x6a7a88, sand: 0xe0f2ff, glass: 0x6ac8ff, dark: 0xe0f2ff }, pilot: 'shark', trail: ['spray'], can: () => I.shark(),
      deco: [['k', 0x7a8a98, 0.06, 0.4, 0.34, 0, 0.36, -0.2], ['b', 0xc23b3b, 0.02, 0.08, 0.3, 0.215, -0.08, 0.95, 0, 0, 0, 'm'], ...rep(4, (i) => ['k', 0xffffff, 0.04, 0.06, 0.04, 0.218, -0.04, 0.84 + i * 0.07, S, 0, 0, 'm']), ...rep(3, (i) => ['b', 0x3a4a5a, 0.02, 0.14, 0.02, 0.215, 0.04, 0.5 + i * 0.06, 0, 0, 0, 'm'])] },
    h: { paint: { body: 0x4a6a8a, belly: 0xe0f2ff, stripe: 0x4a6a8a, fin: 0x4a6a8a, tip: 0x8a9aa8, dark: 0x2a3a4a, glass: 0x6ac8ff }, blur: 0xbfe6ff, pilot: 'shark', trail: ['spray'], rocket: BUILD.torpedo,
      deco: [['k', 0x4a6a8a, 0.05, 0.18, 0.3, 0, 0.34, -0.35], ...rep(5, (i) => ['k', 0xffffff, 0.05, 0.08, 0.05, -0.16 + i * 0.08, -0.2, 1.26, S, 0, 0]), ['k', 0x4a6a8a, 0.05, 0.4, 0.2, 0, 0.62, -1.9, -0.5, 0, 0], ['k', 0x4a6a8a, 0.05, 0.3, 0.16, 0, 0.12, -1.9, -2.4, 0, 0]] },
    u: { hull: [0xffffff, 0x0a2a50], map: 'waves', under: 0x22405e, lights: [0x6ac8ff], band: 0xe0f2ff, dome: [0x9ad8ff, 0x1a4a7a, 0.45], pods: 0x6ac8ff, eye: 0x6ac8ff, shield: 0x6ac8ff, beam: [0x4a9ad8, 0xe0f8ff, 0xbfe6ff, 0x4a9ad8], ray: [0xbfe6ff, 0xffffff], pilot: 'sharkSwim', fol: 'sharks', trail: ['bubbles'] } },
  easter: { fire: [[0xff9ad8, 0xd8b4ff, 0xfff09a], 0xff9ad8], blast: [0xff9ad8, 0x9ad8ff, 0xfff09a, 0xb4f0dc, 0xd8b4ff], boom: [0xff9ad8, 0x9ad8ff, 0xfff09a, 0xffffff],
    b: { paint: { body: 0xf4a6c8, wing: 0xc8b4f4, sand: 0xb4f0dc, glass: 0xd8f0ff, dark: 0xb4f0dc }, pilot: 'bunny', trail: ['beans'], can: () => I.egg(0x9ad8ff),
      deco: [['s', 0xffffff, 0.2, 0.2, 0.2, 0, 0.1, -1.24], ...rep(5, (i) => ['b', 0xb4f0dc, 0.3, 0.012, 0.06, 0.25 + i * 0.3, 0.095, 0.1 + (i % 2 ? 0.1 : -0.1), 0, i % 2 ? 0.6 : -0.6, 0, 'm'])] },
    h: { paint: { body: 0xb4f0dc, belly: 0xf4a6c8, stripe: 0xc8b4f4, fin: 0xf4a6c8, tip: 0xff9a3a, dark: 0x8a7ab0, glass: 0xd8f0ff }, blurMap: 'pastel', pilot: 'bunnyPink', trail: ['beans'], rocket: BUILD.carrot,
      deco: [['b', 0xff8a1a, 0.42, 0.32, 0.12, 0, -0.06, 1.24], ['s', 0xf8f8f8, 0.12, 0.4, 0.08, 0.09, 0.66, 0.1, 0, 0, -0.15, 'm'], ['s', 0xff9ac8, 0.06, 0.28, 0.04, 0.09, 0.66, 0.13, 0, 0, -0.15, 'm']] },
    u: { hull: [0xffffff, 0x2a2410], map: 'egg', under: 0xc8b4f4, lights: [0xff9ad8, 0xb4f0dc], band: 0xb4f0dc, dome: [0xf8f8f8, 0x303030, 0.85], pods: 0xff9ad8, eye: 0xff9ad8, shield: 0xff9ad8, beam: [0xff9ad8, 0xffe0f0, 0xffc0e8, 0xff9ad8], ray: [0xff6ac8, 0xfff09a], pilot: 'bunnyLilac', fol: 'chicks' } },
  acid: { fire: [[0x7dff3a, 0xb8ff3a, 0x3aff8a], 0x7dff3a], blast: [0xd8ff6a, 0x3aff3a, 0x7dff3a], pool: 0x3a8a1a, glowC: 0x7dff3a, boom: [0x7dff3a, 0xd8ff6a, 0x2a2a20],
    b: { paint: { body: 0x1f6a0a, wing: 0x2a2a20, sand: 0xd8c81a, glass: 0x7dff3a, dark: 0x2a2a20 }, pilot: 'hazmat', trail: ['acid'], can: () => I.drum(),
      deco: [...rep(6, (i) => ['b', i % 2 ? 0x2a2a20 : 0xd8c81a, 0.25, 0.09, 0.08, 0.2 + i * 0.25, 0.05, 0.42, 0, 0, 0, 'm']), ['b', 0xd8c81a, 0.03, 0.18, 0.18, 0.04, 0.3, -1.05, 0, 0, 0, 'm']] },
    h: { paint: { body: 0x2a2a20, belly: 0x1f6a0a, stripe: 0x7dff3a, fin: 0x7dff3a, tip: 0x7dff3a, dark: 0x14300c, glass: 0xb8ff3a }, blur: 0x7dff3a, pilot: 'hazmat', trail: ['acid', 'mist'], rocket: BUILD.vial,
      deco: [['b', 0x7dff3a, 0.64, 0.06, 0.06, 0, 0.1, 0.4, 0, 0, 0, 'g'], ['b', 0x7dff3a, 0.64, 0.06, 0.06, 0, 0.1, -0.2, 0, 0, 0, 'g']] },
    u: { hull: [0x4ac81a, 0x1a6a0a], under: 0x14300c, lights: [0x7dff3a, 0xd8c81a], band: 0xd8c81a, dome: [0x7dff3a, 0x2a8a1a, 0.7], pods: 0x7dff3a, eye: 0x7dff3a, shield: 0x7dff3a, beam: [0x7dff3a, 0xd8ff6a, 0xb8ff3a, 0x7dff3a], ray: [0xb8ff3a, 0xf0ffd0], pilot: 'hazmatAlien', trail: ['acidRain'] } },
  july4: { fire: null, blast: [0xff3a3a, 0xffffff, 0x3a7aff, 0xffd24a], star: true, boom: [0xff3a3a, 0xffffff, 0x3a7aff], fireworks: true,
    b: { paint: { body: 0x2a3a6a, wing: 0x2f5fbf, sand: 0xff2a4a, glass: 0x2ad8ff, dark: 0x1e2440 }, pilot: 'eagle', trail: ['sparkler'], can: BUILD.fwCake,
      deco: [...rep(3, (i) => ['st', 0xffffff, 0.22, 1, 0.22, 0.5 + i * 0.4, 0.1, 0.1, 0, 0, 0, 'mg']), ...rep(4, (i) => ['b', i % 2 ? 0xffffff : 0xff2a4a, 0.07, 0.08, 0.43, 0, 0.12 + i * 0.1, -1.05]), ['t', 0xff2a4a, 0.3, 0.3, 0.3, 0.9, 0, 0.66, 0, 0, 0, 'g'], ['t', 0x2ad8ff, 0.3, 0.3, 0.3, -0.9, 0, 0.66, 0, 0, 0, 'g']] },
    h: { paint: { body: 0xf2f2f2, belly: 0xc23b3b, stripe: 0xc23b3b, fin: 0x2ad8ff, tip: 0xff2a4a, dark: 0x2a3a6a, glass: 0x8ab8ff }, blur: 0x3a7aff, pilot: 'eagle', trail: ['fuse'], rocket: BUILD.bottleRocket,
      deco: [['b', 0xc23b3b, 0.64, 0.54, 0.1, 0, 0, 0.5, 0.35, 0, 0], ['b', 0xc23b3b, 0.64, 0.54, 0.1, 0, 0, -0.3, 0.35, 0, 0], ['c', 0x8a6a3a, 0.03, 0.3, 0.03, 0, 0.2, -2.0, 1.2, 0, 0], ['s', 0xffd24a, 0.08, 0.08, 0.08, 0, 0.3, -2.12, 0, 0, 0, 'g'], ['r', 0xff2a4a, 3.4, 3.4, 3.4, 0, 0.43, 0.1, S / 2, 0, 0, 'g']] },
    u: { hull: [0x1e2440, 0x0a0e2a], under: 0x2a2a3a, lights: [0xffffff, 0xff2a4a], band: 0xff2a4a, dome: [0x2ad8ff, 0x0a5a7a, 0.6], pods: 0xffffff, eye: 0xffffff, shield: 0x2ad8ff, beam: [0x3a7aff, 0xd8e8ff, 0xff3a3a, 0x3a7aff], ray: [0xff3a3a, 0xffffff], pilot: 'tophat', trail: ['fireworks'],
      deco: rep(6, (i) => { const a = i / 6 * S * 2; return ['st', 0xffffff, 0.3, 1, 0.3, Math.cos(a) * 1.35, 0.27, Math.sin(a) * 1.35, 0, 0, 0, 'g']; }), spinRings: [0xff2a4a, 0x2ad8ff], flag: true } },
  clown: { fire: [[0xff7ae0, 0xffd24a, 0x3ad0ff], 0xff7ae0], blast: [0xffffff, 0xffd0e0, 0xff3a5a, 0xffd24a, 0x3ad0ff, 0x7dff3a], pool: 0xf4ece0, boom: [0xff3a5a, 0xffd24a, 0x3ad0ff, 0x7dff3a, 0xff7ae0], honk: true,
    b: { paint: { body: 0xff3a5a, wing: 0xffd24a, sand: 0x3ad0ff, glass: 0xbfe8ff, dark: 0x7dff3a }, pilot: 'clown', trail: ['confetti'], can: () => I.pie(),
      deco: [['s', 0xff2a2a, 0.24, 0.24, 0.24, 0, 0, 1.24], ['k', 0xffd24a, 0.12, 0.24, 0.12, 0, 0.62, -1.18, -S / 2, 0, 0], ['s', 0xff2a2a, 0.12, 0.12, 0.12, 0, 0.62, -1.3], ...rep(6, (i) => ['c', [0xff3a5a, 0x3ad0ff, 0x7dff3a, 0xff7ae0, 0xffffff, 0x3ad0ff][i], 0.14, 0.01, 0.14, 0.25 + i * 0.24, 0.095, i % 2 ? 0.25 : -0.05, 0, 0, 0, 'm'])] },
    h: { paint: { body: 0xffd24a, belly: 0x3ad0ff, stripe: 0xff3a5a, fin: 0x7dff3a, tip: 0xfff4e0, dark: 0x5a2a6a, glass: 0xbfe8ff }, blurMap: 'dots', pilot: 'clown', trail: ['confetti'], rocket: () => I.pie(),
      deco: [['s', 0xff2a2a, 0.24, 0.24, 0.24, 0, -0.04, 1.28], ['k', 0xffd24a, 0.1, 0.22, 0.1, 0, 0.5, -1.78, -S / 2, 0, 0], ['s', 0xff2a2a, 0.1, 0.1, 0.1, 0, 0.5, -1.9], ['b', 0x7dff3a, 0.63, 0.53, 0.1, 0, 0, 0.0], ['b', 0xff7ae0, 0.63, 0.53, 0.1, 0, 0, 0.3]] },
    u: { hull: [0xffffff, 0x200a0e], map: 'tent', under: 0xffffff, lights: [0xffd24a, 0xffffff], band: 0xff3a5a, dome: [0xbfe8ff, 0x1a3a4a, 0.55], pods: 0xffd24a, eye: 0xffd24a, shield: 0xff7ae0, beam: [0xff7ae0, 0xffd24a, 0x3ad0ff, 0x7dff3a], ray: [0xff7ae0, 0xfff4e0], pilot: 'clown', fol: 'balloons', trail: ['confettiU'],
      deco: [['c', 0xdddddd, 0.04, 0.5, 0.04, 0, 1.3, 0], ['k', 0xff3a5a, 0.2, 0.36, 0.04, 0.12, 1.42, 0, 0, 0, -S / 2]] } },
  zombie: { fire: [[0x9dff3a, 0x5a8a1a, 0xc8ff6a], 0x7aff2a], blast: [0x6a7a4a, 0x9dff3a, 0x4a3a2a], boom: [0x9dff3a, 0x7a9a6a, 0x5a3a22, 0x7a1a14],
    b: { paint: { body: 0x5a6a2a, wing: 0x26321a, sand: 0x8a8f96, glass: 0x6a7a4a, dark: 0x3a2a1a }, pilot: 'zombie', fol: 'crows', can: BUILD.coffin,
      deco: [['b', 0x8a8f96, 0.08, 0.52, 0.44, 0, 0.3, -1.05], ...rep(4, (i) => ['b', 0x1a1a10, 0.44, 0.02, 0.03, 0, 0.21, -0.6 + i * 0.4]), ['b', 0x7a2a22, 0.16, 0.02, 0.2, 0.08, 0.212, 0.2], ['b', 0x6a8a3a, 0.4, 0.012, 0.3, 0.9, 0.095, 0.2, 0, 0.3, 0, 'm'], ['b', 0x7a2a22, 0.2, 0.012, 0.14, 1.3, 0.096, 0.0, 0, 0, 0, 'm']] },
    h: { paint: { body: 0x5a3a22, belly: 0x3a2412, stripe: 0xc9a35a, fin: 0x8a8f96, tip: 0xe8e2c8, dark: 0x2a1a0e, glass: 0x6a7a4a }, blur: 0x6a8a3a, pilot: 'zombie', fol: 'crows', rocket: BUILD.bone,
      deco: [['c', 0x8a8f96, 0.32, 0.06, 0.32, 0, 0.64, -1.82, 0, 0, S / 2], ['b', 0xc9a35a, 0.04, 0.06, 0.2, 0.32, 0.06, 0.4, 0, 0, 0, 'm'], ['b', 0xc9a35a, 0.04, 0.06, 0.2, 0.32, 0.06, -0.2, 0, 0, 0, 'm']] },
    u: { hull: [0x3a4a2a, 0x0e1a08], under: 0x26321a, lights: [0x9dff3a, 0xff4a3a], band: 0x5a6a2a, dome: [0x9dff3a, 0x2a5a0a, 0.65], pods: 0x9dff3a, eye: 0xff4a3a, shield: 0x9dff3a, beam: [0x7a9a3a, 0xc8e08a, 0x9dff3a, 0x7a9a3a], ray: [0xff2a2a, 0xffb0a0], pilot: 'zombieAlien', fol: 'crows', trail: ['mist'], tombs: true } },
  ghost: { fire: [[0x6affb8, 0xd8fff0, 0x3aff9a], 0x3aff9a], blast: [0x7dffb0, 0xffffff, 0x3aff9a], glowC: 0x7dffb0, boom: [0xffffff, 0x7dffb0, 0x3aff9a], ghosts: true,
    b: { paint: { body: 0xd8fff0, wing: 0xbff0e0, sand: 0x7dffb0, glass: 0x9affd0, dark: 0xa8e8d0 }, pilot: 'ghost', fol: 'ghosts', trail: ['ecto'], look: { ghost: 0.6 }, can: BUILD.jar,
      deco: tipDrips(0x3aff9a, -0.02, -0.18, [0.4, 0.9, 1.4], 'mg') },
    h: { paint: { body: 0xbfe8d8, belly: 0x9ad8c0, stripe: 0x7dffb0, fin: 0xd8fff0, tip: 0xffffff, dark: 0x5a7a70, glass: 0xd8fff0 }, blur: 0x7dffb0, pilot: 'ghost', fol: 'ghosts', trail: ['ecto'], look: { ghost: 0.6 }, rocket: () => I.ghost(),
      deco: [0.3, -0.3].flatMap((x) => rep(4, (i) => ['t', 0x5a5e62, 0.08, 0.08, 0.08, x, -0.6 - i * 0.07, 0.15, 0, i % 2 ? S / 2 : 0, 0])) },
    u: { hull: [0xd8fff0, 0x3a8a6a], under: 0x9affd0, lights: [0x7dffb0], band: 0x6affb8, dome: [0x9affd0, 0x2a8a6a, 0.45], pods: 0x7dffb0, eye: 0x7dffb0, shield: 0x7dffb0, beam: [0xd8fff0, 0xffffff, 0x7dffb0, 0x9affd0], ray: [0x3aff9a, 0xd8fff0], pilot: 'ghost', fol: 'furniture', trail: ['ectoU'], flicker: true,
      deco: rep(8, (i) => { const a = i / 8 * S * 2; return ['k', 0x3aff9a, 0.1, 0.26, 0.1, Math.cos(a) * 1.95, -0.12, Math.sin(a) * 1.95, S, 0, 0, 'g']; }) } },
  mallow: { fire: [[0xffb06a, 0xffd28a, 0xfff0d0], 0xffb06a], blast: [0xffffff, 0xffe8f0, 0xfff4e4], pool: 0xf4ece0, boom: [0xffffff, 0x5a3420, 0xffd28a],
    b: { paint: { body: 0xf8f2e8, wing: 0xc89a5a, sand: 0xe8b070, glass: 0xffd0e0, dark: 0x5a3420 }, pilot: 'mallow', trail: ['mallows', 'smoke'], can: () => I.choc(),
      deco: [['b', 0x5a3420, 0.08, 0.52, 0.44, 0, 0.3, -1.05], ...rep(8, (i) => ['b', 0x8a5a2a, 0.04, 0.012, 0.04, 0.3 + (i % 4) * 0.35, 0.095, (i < 4 ? 0.0 : 0.22), 0, 0, 0, 'm'])] },
    h: { paint: { body: 0xf8f2e8, belly: 0x5a3420, stripe: 0xc89a5a, fin: 0x5a3420, tip: 0xffe8c8, dark: 0x5a3420, glass: 0xffd0e0 }, blur: 0xffd0e0, pilot: 'mallow', trail: ['mallows', 'smoke'], rocket: BUILD.flamingMallow,
      deco: [['b', 0xc89a5a, 1.74, 0.08, 0.36, 0, -0.1, 0.1]] },
    u: { hull: [0xc89a5a, 0x2a1a0a], under: 0x5a3420, lights: [0xfff4ec], band: 0xf8f2e8, dome: [0xffd0e0, 0x4a2a30, 0.55], pods: 0xffb0d0, eye: 0xffb0d0, shield: 0xffd0e0, beam: [0xffd0e0, 0xfff4ec, 0xffffff, 0xffd0e0], ray: [0xffb0d0, 0xffffff], pilot: 'mallow', fol: 'mallows', trail: ['smokeU'],
      deco: [['o', 0xfff8f0, 4.0, 4.0, 4.0, 0, 0.02, 0, S / 2, 0, 0], ...rep(8, (i) => { const a = i / 8 * S * 2 + 0.3; return ['k', 0x5a3420, 0.12, 0.22, 0.12, Math.cos(a) * 1.9, -0.12, Math.sin(a) * 1.9, S, 0, 0]; }), ...rep(10, (i) => { const a = i / 10 * S * 2; return ['b', 0x8a5a2a, 0.06, 0.03, 0.06, Math.cos(a) * 1.3, 0.27, Math.sin(a) * 1.3]; })] } },
  planet: { fire: [[0x9a8aff, 0x5a4ab8, 0xfff0b0], 0x9a8aff], blast: [0xffffff, 0xfff0b0, 0x9a8aff], ring: 0xffffff, boom: [0xffffff, 0xfff0b0, 0x9ad0ff], boomRing: 0xffffff,
    b: { paint: { body: 0x0a0a2a, wing: 0x2a1a6a, sand: 0xffd24a, glass: 0x9ad0ff, dark: 0x06061a }, pilot: 'astronaut', fol: 'moon', trail: ['stardust'], can: () => I.planet(0),
      deco: [...rep(14, (i) => ['b', 0xffffff, 0.03, 0.03, 0.03, ((i * 0.37) % 1 - 0.5) * (i < 7 ? 0.4 : 3.2), i < 7 ? 0.215 : 0.095, i < 7 ? -1 + i * 0.3 : ((i * 0.53) % 1) * 0.5 - 0.15, 0, 0, 0, 'g']), ['s', 0xd8b878, 0.14, 0.14, 0.14, 0.045, 0.36, -1.08], ['r', 0xf0e0b0, 0.3, 0.3, 0.3, 0.05, 0.36, -1.08, 0, S / 2, 0.4], ['b', 0xffd24a, 3.42, 0.02, 0.03, 0, 0.09, 0.4, 0, 0, 0, 'g']] },
    h: { paint: { body: 0x2a1a6a, belly: 0x06061a, stripe: 0x5a4ab8, fin: 0x5a4ab8, tip: 0xffd24a, dark: 0x0a0a2a, glass: 0x9ad0ff }, blurMap: 'starry', pilot: 'astronaut', trail: ['stardust'], rocket: () => I.meteor(), orbit: true,
      deco: [['s', 0xfff0a0, 0.3, 0.3, 0.3, 0, 0.5, 0.1, 0, 0, 0, 'g']] },
    u: { hull: [0xffffff, 0x2a1a0a], map: 'bands', under: 0x8a4a2a, lights: [0xe8f0ff], band: 0x8a4a2a, dome: [0x9ad0ff, 0x1a3a6a, 0.55], pods: 0xffd24a, eye: 0xffffff, shield: 0x9a8aff, beam: [0x9a8aff, 0xe0d8ff, 0xffffff, 0x9a8aff], ray: [0xffd24a, 0xffffff], pilot: 'spaceAlien', fol: 'moons',
      deco: [['r', 0xf0e0b0, 5.4, 5.4, 5.4, 0, 0.04, 0, S / 2, 0, 0.12, 'g'], ['r', 0xd8c8a0, 5.0, 5.0, 5.0, 0, 0.04, 0, S / 2, 0, 0.12, 'g']] } },
  wormhole: { fire: [[0x3a7aff, 0xff9a3a, 0x7ab8ff], 0x3a7aff], blast: [0x7ab8ff, 0xffb05a, 0xffffff], ring: 0xff9a3a, boom: [0x7ab8ff, 0xffb05a, 0xffffff], boomRing: 0x3a7aff,
    b: { paint: { body: 0x0a2ad8, wing: 0x0c1030, sand: 0xff9a3a, glass: 0x7ab8ff, dark: 0x0c1030 }, pilot: 'silver', trail: ['stars'], can: BUILD.warpBall,
      deco: [...rep(5, (i) => ['b', 0xff9a3a, 0.44, 0.44, 0.07, 0, 0, -0.9 + i * 0.4, 0.4, 0, 0]), ['s', 0x7ab8ff, 0.2, 0.2, 0.1, 0.9, 0, 0.66, 0, 0, 0, 'g'], ['s', 0xff9a3a, 0.2, 0.2, 0.1, -0.9, 0, 0.66, 0, 0, 0, 'g']] },
    h: { paint: { body: 0x0a2ad8, belly: 0x0c1030, stripe: 0xff9a3a, fin: 0xff9a3a, tip: 0xff9a3a, dark: 0x0c1030, glass: 0x7ab8ff }, blurMap: 'swirl', spinBlur: true, pilot: 'silver', trail: ['stars'], rocket: BUILD.drill,
      deco: rep(4, (i) => ['b', 0xff9a3a, 0.23, 0.23, 0.06, 0, 0.12, -0.75 - i * 0.3, 0.45, 0, 0]) },
    u: { hull: [0xffffff, 0x0a1a6a], map: 'spiral', under: 0x0c1030, lights: [0xff9a3a, 0x7ab8ff], band: 0xff9a3a, dome: [0x7ab8ff, 0x0a3a9a, 0.55], pods: 0x7ab8ff, eye: 0xffffff, shield: 0x3a7aff, beam: [0xff9a3a, 0x3a7aff, 0xff9a3a, 0x3a7aff], ray: [0xffb05a, 0x7ab8ff], pilot: 'silverAlien', trail: ['starsU'], fastRing: true } },
  grid: { fire: [[0x3af0ff, 0x2a7aff, 0xffffff], 0x3af0ff], blast: [0x3af0ff, 0xffffff], words: ['DELETED'], wordC: '#3af0ff', boom: [0x3af0ff, 0x2a7aff, 0xffffff], cubes: true,
    b: { paint: { body: 0x02040a, wing: 0x061826, sand: 0x3af0ff, glass: 0x0a2a44, dark: 0x02040a }, pilot: 'wire', trail: ['cubes'], look: { edges: [0x3af0ff, 0.9] }, can: () => I.cube(),
      deco: [['b', 0x2a7aff, 3.42, 0.02, 0.03, 0, 0.09, 0.4, 0, 0, 0, 'g'], ['b', 0x2a7aff, 3.42, 0.02, 0.03, 0, 0.09, -0.2, 0, 0, 0, 'g']] },
    h: { paint: { body: 0x02040a, belly: 0x0a2a44, stripe: 0x3af0ff, fin: 0x3af0ff, tip: 0xffffff, dark: 0x061826, glass: 0x061826 }, blurMap: 'gridDisc', pilot: 'wire', trail: ['cubes'], look: { edges: [0x3af0ff, 0.9] }, rocket: BUILD.dataBolt,
      deco: [['r', 0x3af0ff, 3.4, 3.4, 3.4, 0, 0.43, 0.1, S / 2, 0, 0, 'g']] },
    u: { hull: [0xffffff, 0x000000], map: 'grid', glowMap: 0x3af0ff, under: 0x061826, lights: [0x3af0ff], band: 0x3af0ff, dome: [0x3af0ff, 0x0a3a4a, 0.85], wireDome: true, pods: 0x3af0ff, eye: 0x3af0ff, shield: 0x3af0ff, beam: [0x3af0ff, 0x2a7aff, 0x3af0ff, 0x3af0ff], ray: [0x3af0ff, 0xffffff], pilot: 'wireAlien', fol: 'cubes' } },
  void: { fire: [[0x6a3aff, 0x3a1f7a, 0x9a6aff], 0x3a1f7a], blast: [0x6a3aff, 0x3a1f7a, 0x9a6aff], ring: 0x6a3aff, boom: [0x6a3aff, 0x1a0f2e, 0x9a6aff], boomRing: 0x6a3aff, implode: true,
    b: { paint: { body: 0x020104, wing: 0x08040f, sand: 0x08040f, glass: 0x0a0612, dark: 0x020104 }, pilot: 'eyes', look: { edges: [0x6a3aff, 0.55] }, dim: true, can: BUILD.voidBall },
    h: { paint: { body: 0x020104, belly: 0x08040f, stripe: 0x08040f, fin: 0x08040f, tip: 0x3a1f7a, dark: 0x050308, glass: 0x0a0612 }, blur: 0x3a1f7a, pilot: 'eyes', look: { edges: [0x6a3aff, 0.55] }, dim: true, rocket: BUILD.darkStreak },
    u: { hull: [0x020104, 0x000000], under: 0x08040f, lights: [0x1a0f2e], band: 0x08040f, dome: [0x0a0612, 0x000000, 0.85], pods: 0x1a0f2e, eye: 0x3a1f7a, shield: 0x3a1f7a, beam: [0x6a3aff, 0x1a0f2e, 0x9a6aff, 0x3a1f7a], ray: [0x6a3aff, 0x2a1a5a], pilot: 'eyes', dim: true,
      deco: [['r', 0x9a6aff, 4.2, 4.2, 4.2, 0, 0.04, 0, S / 2, 0, 0, 'g']] } },
  glitch: { fire: [[0xff2a4a, 0x2aff6a, 0x2a6aff], 0xff2ad0], blast: [0xff2a4a, 0x2aff6a, 0x2a6aff, 0xffffff], words: ['ERROR', '404', 'NaN', 'CRASH'], wordC: '#ff2ad0', boom: [0xff2a4a, 0x2aff6a, 0x2a6aff], boomText: 'FATAL ERROR', boomTextU: 'SAUCER NOT FOUND',
    b: { paint: { body: 0xff2ad0, wing: 0x1a1a22, sand: 0x2aff6a, glass: 0x2a6aff, dark: 0x1a1a22 }, pilot: 'pixel', trail: ['pixels'], look: { glitch: true }, can: BUILD.errBox,
      deco: [...rep(8, (i) => ['b', 0x111118, 0.12, 0.012, 0.12, ((i % 4) - 1.5) * 0.11, 0.212, -0.8 + ((i / 4) | 0) * 0.5 + (i % 2) * 0.12]), ...rep(6, (i) => ['b', 0xff2ad0, 0.2, 0.012, 0.2, 0.3 + i * 0.22, 0.095, i % 2 ? 0.2 : 0.0, 0, 0, 0, 'm'])] },
    h: { paint: { body: 0x1a1a22, belly: 0xff2ad0, stripe: 0x2af0ff, fin: 0xff2ad0, tip: 0xffffff, dark: 0x1a1a22, glass: 0x2aff6a }, blurMap: 'checkerDisc', pilot: 'pixel', trail: ['pixels'], look: { glitch: true }, rocket: BUILD.pointer,
      deco: rep(6, (i) => ['b', 0xff2ad0, 0.12, 0.012, 0.12, ((i % 3) - 1) * 0.16, 0.262, -0.2 + ((i / 3) | 0) * 0.4]) },
    u: { hull: [0x2a6aff, 0x0a1a5a], under: 0x1a1a22, lights: [0xff2a4a, 0x2aff6a], band: 0x2aff6a, dome: [0x2aff6a, 0x0a5a2a, 0.6], pods: 0xff2ad0, eye: 0xffffff, shield: 0xff2ad0, beam: [0x2af0ff, 0xff2ad0, 0x2aff6a, 0xff2a4a], ray: [0xff2ad0, 0xffffff], pilot: 'pixelAlien', fol: 'errors', glitch: true } },
};
TEX.checkerDisc = () => tex('checkerDisc', 16, 16, (x) => { x.fillStyle = '#ff2ad0'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#111118'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); }, 6, 6);
export const hasCraftLook = (key) => !!LOOK[key];

// the flame colours for a skin's fires and blasts (fire.js setFlamePalette), or the usual ones
export const DEFAULT_FLAMES = { flames: [0xff7a1a, 0xffb02a, 0xffe06a], glow: 0xff8a2a };
export function craftFlames(key) { const f = LOOK[key] && LOOK[key].fire; return f ? { flames: f[0], glow: f[1] } : DEFAULT_FLAMES; }

// ---------- dressing the models ----------
const BOMBER = { body: 0x56653a, wing: 0x3b4828, glass: 0x7ab0d0, sand: 0xc8b070, dark: 0x2a3020 };
const HELI = { body: 0x55643c, belly: 0x2c3422, stripe: 0xc8b070, fin: 0x46552e, tip: 0xff8a3a, dark: 0x15191c, glass: 0x6ab0c8 };
const pairsOf = (base, p) => Object.keys(p).filter((k) => base[k] != null && p[k] != null).map((k) => [base[k], p[k]]);
const fxTag = (o) => { o.userData.skinFx = true; return o; };
// remove the skin's see-through extras (glowing edges, colour ghosts) before a model is broken up
export function stripSkin(g) { const out = []; g.traverse((o) => { if (o.userData.skinFx) out.push(o); }); for (const o of out) if (o.parent) o.parent.remove(o); }
function applyLook(g, look) { const meshes = []; g.traverse((m) => { if (m.isMesh && !m.isInstancedMesh && !m.userData.skinFx) { let x = m; while (x && x !== g) { if (x.name === 'xray') return; x = x.parent; } meshes.push(m); } });
  if (look.ghost) for (const m of meshes) { if (m.material.transparent) continue; m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = look.ghost; }
  if (look.edges) { const mat = new THREE.LineBasicMaterial({ color: look.edges[0], transparent: true, opacity: look.edges[1] }); for (const m of meshes) { if (m.material.transparent || m.material.wireframe) continue; m.add(fxTag(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), mat))); } }
  if (look.glitch) { const copies = []; for (const [c, dx] of [[0xff2a4a, 0.1], [0x2a6aff, -0.1]]) { const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }); for (const m of meshes) { if (m.parent !== g || !m.geometry.attributes.color) continue; const k = fxTag(new THREE.Mesh(m.geometry, mat)); k.position.copy(m.position); k.scale.copy(m.scale); k.visible = false; k.userData.dx = dx; g.add(k); copies.push(k); } }
    let gt = 0; addAnim(g, (dt) => { gt -= dt; if (gt > 0) return; gt = 0.05 + Math.random() * 0.16; const on = Math.random() < 0.35; for (const k of copies) { k.visible = on; k.position.x = on ? k.userData.dx * (1 + Math.random() * 1.5) : 0; } const vis = Math.random() > 0.06, xr = g.getObjectByName('xray'); for (const m of meshes) if (m.parent === g) m.visible = vis; if (xr) xr.visible = vis; }); } }
function addAnim(o, f) { const prev = o.userData.skinAnim; o.userData.skinAnim = prev ? (dt, t) => { prev(dt, t); f(dt, t); } : f; }
let ghostXray = null; const GHOST_XRAY = () => ghostXray || (ghostXray = new THREE.MeshBasicMaterial({ color: 0x765a16, blending: THREE.AdditiveBlending, depthTest: true, depthFunc: THREE.GreaterDepth, depthWrite: false }));
// the bomber or heli in a skin (g from makeBomber/makeHeli)
export function dressCraft(g, kind, key) { const L = LOOK[key], s = L && L[kind === 'heli' ? 'h' : 'b']; if (!s) return g;
  recolor(g, pairsOf(kind === 'heli' ? HELI : BOMBER, s.paint));
  const d = new THREE.Group(); d.name = 'skinDeco'; g.add(d); if (s.deco) parts(d, s.deco);
  const pl = pilot(s.pilot); if (kind === 'heli') { pl.scale.setScalar(0.2); pl.position.set(0, 0.3, 0.8); } else { pl.scale.setScalar(0.17); pl.position.set(0, 0.34, 0.72); } d.add(pl); mergeParts(d);
  if (kind === 'heli') { const blur = g.userData.strip && g.userData.strip[0]; if (blur) { blur.material = blur.material.clone(); if (s.blurMap) { blur.material.map = TEX[s.blurMap](); blur.material.color.setHex(0xffffff); blur.material.opacity = 0.42; } else if (s.blur != null) { blur.material.color.setHex(s.blur); blur.material.opacity = 0.32; } blur.material.needsUpdate = true; if (s.spinBlur) addAnim(g, (dt) => { blur.rotation.z += dt * 6; }); }
    if (s.orbit) { const o = new THREE.Group(); o.name = 'skinOrbit'; o.position.set(0, 0.62, 0.1); g.add(o); const pl = new THREE.Group(); for (let i = 0; i < 3; i++) { const p = fit(I.planet(i + 1), 0.22); p.position.set(Math.cos(i * 2.1) * 0.5, 0.05 * i, Math.sin(i * 2.1) * 0.5); pl.add(p); } o.add(flatten(pl)); /* (the three planets baked together: a few draws) */ addAnim(g, (dt) => { o.rotation.y += dt * 2.2; }); } }
  else if (g.userData.pods) { const c = canister(key); if (c) { g.userData.pods.geometry = c.geo; g.userData.pods.material = c.mat; } }
  if (s.look) applyLook(g, s.look); g.userData.skinKey = key;
  for (const part of [d, g.getObjectByName('skinOrbit')]) if (part) part.traverse((m) => { if (m.isMesh) m.renderOrder = 6; });
  { const xr = g.getObjectByName('xray'); let xm = null; if (xr) xr.traverse((m) => { if (!xm && m.isMesh && m.material) xm = m.material; }); if (xm) { const c = d.clone(true); c.traverse((m) => { if (!m.isMesh) return; if (m.material && m.material.transparent) { m.visible = false; return; } m.material = xm; m.renderOrder = 5; }); xr.add(c); } } /* the skin's own parts join the gold see-through silhouette */ /* (after the gold x-ray silhouette at 5, as the craft is) */
  if (s.look && s.look.ghost) { const xr = g.getObjectByName('xray'); if (xr) { const mat = GHOST_XRAY(); xr.traverse((m) => { if (m.isMesh) m.material = mat; }); } } /* (gold only where a building hides it, never over its own see-through body) */
  return g; }
// the bomber's hanging canisters are one batch (InstancedMesh), so a skin's canister is baked into one geometry
const canCache = new Map();
function bake(o) { o.updateMatrixWorld(true); const pos = [], nor = [], col = [], tmpC = new THREE.Color();
  o.traverse((m) => { if (!m.isMesh) return; let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrixWorld); if (!g.attributes.normal) g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal; tmpC.copy(m.material.color || new THREE.Color(0xffffff)); for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(tmpC.r, tmpC.g, tmpC.b); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; }
function canister(key) { if (canCache.has(key)) return canCache.get(key); const s = LOOK[key] && LOOK[key].b; let c = null; if (s && s.can) { c = { geo: bake(fit(s.can(), 0.3)), mat: new THREE.MeshLambertMaterial({ vertexColors: true }) }; } canCache.set(key, c); return c; }
// a falling canister (the full model, not the baked one: there are only ever a few in the air)
const shotCache = new Map(), cached = (k, make) => { if (!shotCache.has(k)) shotCache.set(k, make()); const m = shotCache.get(k); return m ? m.clone() : null; }; // (clones share the geometry: nothing new on the graphics card per shot)
export function skinCanister(key) { return cached('can:' + key, () => { const s = LOOK[key] && LOOK[key].b; if (!s || !s.can) return null; const o = fit(s.can(), 0.42); mergeParts(o); return o; }); }
// a rocket in flight, pointing along +z, with a glow at the back in the skin's flame colour
export function skinRocket(key) { return cached('rk:' + key, () => makeSkinRocket(key)); }
function makeSkinRocket(key) { const L = LOOK[key], s = L && L.h; if (!s || !s.rocket) return null; const raw = s.rocket(), d = new THREE.Box3().setFromObject(raw).getSize(new THREE.Vector3()), o = fit(raw, Math.max(d.x, d.y, d.z) / Math.max(0.001, Math.min(d.x, d.y, d.z)) < 1.8 ? 0.42 : 0.62); mergeParts(o); const g = new THREE.Group(); g.add(o); P(g, 's', L.fire ? L.fire[1] : 0xffc060, 0.12, 0.12, 0.16, 0, 0, -0.34, 0, 0, 0, true); return g; }

// the saucer in a skin (body from makeShip)
export function dressShip(body, key) { const L = LOOK[key], s = L && L.u; if (!s) return body; const u = body.userData;
  let hull = null; body.traverse((m) => { if (m.isMesh && m.geometry.type === 'LatheGeometry') hull = m; });
  if (hull) { const hm = hull.material = hull.material.clone(); hm.color.setHex(s.hull[0]); hm.emissive.setHex(s.hull[1]); if (s.map) { const t = TEX[s.map](); hm.map = t; if (s.glowMap != null) { hm.emissiveMap = t; hm.emissive.setHex(s.glowMap); } } hm.needsUpdate = true; u.hullMat = hm; }
  recolor(body, [[0x3a2260, s.under], [0xc9a6ff, s.band], [0xff5ae0, s.pods]]);
  const dm = u.dome.material = u.dome.material.clone(); dm.color.setHex(s.dome[0]); dm.emissive.setHex(s.dome[1]); dm.opacity = s.dome[2]; if (s.wireDome) dm.wireframe = true; u.domeE = s.dome[1];
  const rm = u.ring.material = u.ring.material.clone(); rm.map = ringTex(s.lights[0], s.lights[1]).clone(); rm.map.needsUpdate = true; rm.color.setHex(0xffffff);
  u.eye.material = u.eye.material.clone(); u.eye.material.color.setHex(s.eye); u.shield.material = u.shield.material.clone(); u.shield.material.color.setHex(s.shield);
  const pg = u.pilot; for (const c of pg.children.slice()) pg.remove(c); pg.add(ufoPilot(s.pilot)); mergeParts(pg);
  const swim = pg.getObjectByName('swim'), snow = pg.getObjectByName('snow'); if (swim) addAnim(body, (dt) => { swim.rotation.y += dt * 1.6; }); if (snow) addAnim(body, (dt, t) => { snow.rotation.y += dt * 0.9; snow.position.y = Math.sin(t * 1.7) * 0.05; });
  const d = new THREE.Group(); d.name = 'skinDeco'; body.add(d); if (s.deco) parts(d, s.deco);
  if (s.tombs) for (let i = 0; i < 6; i++) { const a = i / 6 * S * 2, tb = fit(I.tomb(), 0.32); tb.position.set(Math.cos(a) * 1.45, 0.38, Math.sin(a) * 1.45); tb.rotation.y = -a + S / 2; d.add(tb); }
  if (s.flag) { const f = I.flag(); f.scale.setScalar(0.9); f.position.set(0, 1.5, 0); d.add(f); }
  mergeParts(d);
  if (s.spinRings) { const rg = s.spinRings.map((c, i) => { const r = new THREE.Mesh(GEO.r, B(c)); r.scale.setScalar(4.6 + i * 0.3); r.rotation.x = S / 2 + (i ? -0.35 : 0.35); body.add(r); return r; }); addAnim(body, (dt) => { rg[0].rotation.z += dt * 2.4; rg[1].rotation.z -= dt * 2.0; }); }
  if (s.flicker && u.hullMat) addAnim(body, (dt, t) => { const k = 0.55 + Math.sin(t * 3.1) * 0.25 + (Math.random() < 0.02 ? -0.4 : 0); u.hullMat.transparent = true; u.hullMat.opacity = Math.max(0.15, k); dm.opacity = Math.max(0.15, k * 0.8); });
  if (s.glitch && u.hullMat) { let gt = 0; addAnim(body, (dt) => { gt -= dt; if (gt > 0) return; gt = 0.06 + Math.random() * 0.2; u.hullMat.color.setHex(Math.random() < 0.3 ? 0xff2ad0 : s.hull[0]); body.position.x = Math.random() < 0.18 ? (Math.random() - 0.5) * 0.5 : 0; }); }
  if (s.fastRing) addAnim(body, (dt) => { u.ring.material.map.offset.x += dt * 2.5; }); body.userData.skinKey = key; return body; }
// the tractor beam and death ray colours
export function skinBeam(beam, key) { const ch = beam.g.children, ix = [0, 1, 2, 5]; if (!beam.g.userData.baseC) beam.g.userData.baseC = ix.map((i) => ch[i].material.color.getHex()); /* (its own colours, for Default) */ const s = LOOK[key] && LOOK[key].u, cols = s && s.beam ? s.beam : beam.g.userData.baseC; ix.forEach((i, j) => ch[i].material.color.setHex(cols[j])); }
export function rayColors(key) { const s = LOOK[key] && LOOK[key].u; return s && s.ray ? s.ray : null; }

// ---------- followers ----------
const chick = () => parts(new THREE.Group(), [['s', 0xffe14a, 0.4, 0.36, 0.44], ['s', 0xffe14a, 0.28, 0.28, 0.28, 0, 0.24, 0.16], ['k', 0xff8a1a, 0.08, 0.14, 0.08, 0, 0.22, 0.34, S / 2, 0, 0], ['s', 0x111111, 0.05, 0.05, 0.05, 0.08, 0.28, 0.27, 0, 0, 0, 'm'], ['b', 0xffd02a, 0.5, 0.04, 0.2, 0, 0.04, -0.02]]);
const crow = () => { const b = I.bat(); recolorTree(b, 0x0e0e12); b.traverse((m) => { if (m.isMesh && m.geometry.type === 'ConeGeometry') m.visible = false; }); return b; };
const balloon = (c) => parts(new THREE.Group(), [['s', c, 0.5, 0.6, 0.5, 0, 0.6, 0], ['c', 0xdddddd, 0.02, 0.9, 0.02, 0, -0.1, 0]]);
function recolorTree(o, c) { o.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); if (m.material.color) m.material.color.setHex(c); } }); }
// mode: trail (follows behind), orbit (circles it), wing (flies beside it). s: size against the craft
const FOLLOW = {
  bats: () => ({ mode: 'trail', list: rep(5, () => I.bat()), s: 0.45, flap: true }),
  batsU: () => ({ mode: 'orbit', list: rep(6, () => I.bat()), s: 0.4, flap: true, sp: 1.3 }),
  reindeer: () => ({ mode: 'wing', list: rep(2, () => I.reindeer()), s: 0.55 }),
  ghosts: () => ({ mode: 'trail', list: rep(2, () => I.ghost()), s: 0.45 }),
  sharks: () => ({ mode: 'orbit', list: rep(2, () => I.shark()), s: 0.5, sp: 0.9, y: -0.15 }),
  chicks: () => ({ mode: 'trail', list: rep(4, chick), s: 0.26, gap: 0.42 }),
  crows: () => ({ mode: 'trail', list: rep(3, crow), s: 0.38, flap: true }),
  balloons: () => ({ mode: 'trail', list: [0xff3a5a, 0xffd24a, 0x3ad0ff].map(balloon), s: 0.36, gap: 0.3, y: 0.45 }),
  moon: () => ({ mode: 'orbit', list: [I.planet(4)], s: 0.28, sp: 1.6 }),
  moons: () => ({ mode: 'orbit', list: [I.planet(4), I.planet(4)], s: 0.32, sp: 0.7 }),
  furniture: () => ({ mode: 'trail', list: [I.chair(), I.table()], s: 0.42, gap: 0.8 }),
  errors: () => ({ mode: 'orbit', list: rep(3, (i) => I.errPanel(i)), s: 0.45, sp: 1.1, face: true }),
  mallows: () => ({ mode: 'orbit', list: rep(3, () => I.mallow()), s: 0.3, sp: 0.8, bob: true }),
  cubes: () => ({ mode: 'orbit', list: rep(4, () => I.cube()), s: 0.26, sp: 1.4, bob: true }),
};
// ---------- trails: particles left behind (only in the games, where there is an fx system) ----------
// at: where they come from. tail, wings, engines, rotor, around, rim, ahead
const TRAIL = {
  tp: { at: 'tail', every: 0.035, f: (fx, p) => fx.spray(p, 1, { c: 0xf4f2ea, speed: 0.25, up: [-0.4, 0], life: 1.2, size: 0.2, grav: 0.6, shape: 1, stretch: 1, soft: true }) },
  flies: { at: 'around', every: 0.07, f: (fx, p) => fx.spray(p, 1, { c: 0x16160e, speed: 1.4, up: [-0.6, 0.6], life: 0.5, size: 0.06, grav: 0, shape: 0, stretch: 1, soft: true }) },
  fliesU: { at: 'around', every: 0.05, f: (fx, p) => fx.spray(p, 1, { c: 0x16160e, speed: 1.6, up: [-0.6, 0.6], life: 0.5, size: 0.07, grav: 0, shape: 0, stretch: 1, soft: true }) },
  snow: { at: 'wings', every: 0.025, f: (fx, p) => fx.spray(p, 1, { c: 0xffffff, speed: 0.4, up: [-0.6, 0], life: 1.8, size: 0.1, grav: 1.4, shape: 0, stretch: 1 }) },
  snowU: { at: 'around', every: 0.04, f: (fx, p) => fx.spray(p, 1, { c: 0xffffff, speed: 0.3, up: [-0.5, 0], life: 2, size: 0.1, grav: 0.8, shape: 0, stretch: 1 }) },
  embers: { at: 'engines', every: 0.03, f: (fx, p) => fx.ember(p, 0.8) },
  embersRotor: { at: 'rotor', every: 0.03, f: (fx, p) => fx.ember(p, 0.8) },
  embersU: { at: 'rim', every: 0.03, f: (fx, p) => fx.ember(p, 0.9) },
  spray: { at: 'wings', every: 0.035, f: (fx, p) => fx.spray(p, 1, { c: [0xffffff, 0x9ad8ff], speed: 0.8, up: [0, 1], life: 0.7, size: 0.1, grav: 4, shape: 0, stretch: 1.5 }) },
  bubbles: { at: 'around', every: 0.06, f: (fx, p) => fx.spray(p, 1, { c: 0xd8f4ff, speed: 0.3, up: [0.6, 1.4], life: 1.2, size: 0.09, grav: -0.5, shape: 2, stretch: 1 }) },
  beans: { at: 'tail', every: 0.05, f: (fx, p) => fx.spray(p, 1, { c: [0xff6ac8, 0x9ad8ff, 0xfff09a, 0x7dff3a, 0xff9a3a, 0xd8b4ff], pick: true, speed: 0.8, up: [-0.5, 0.5], life: 1.4, size: 0.11, grav: 9, shape: 0, stretch: 1.6, soft: true }) },
  acid: { at: 'wings', every: 0.045, f: (fx, p) => fx.spray(p, 1, { c: [0x7dff3a, 0xb8ff3a], pick: true, speed: 0.1, up: [-1, -0.4], life: 1.2, size: 0.09, grav: 10, shape: 0, stretch: 2.4 }) },
  acidRain: { at: 'rim', every: 0.02, f: (fx, p) => fx.spray(p, 1, { c: 0xb8ff3a, speed: 0.05, up: [-3, -2], life: 0.9, size: 0.06, grav: 6, shape: 3, stretch: 4 }) },
  mist: { at: 'rotor', every: 0.09, f: (fx, p) => fx.dust(p, 0.5, 0, 0, 0x6aff4a) },
  ecto: { at: 'wings', every: 0.05, f: (fx, p) => fx.spray(p, 1, { c: [0x3aff9a, 0x9affd0], pick: true, speed: 0.1, up: [-1, -0.3], life: 1.3, size: 0.1, grav: 8, shape: 0, stretch: 2 }) },
  ectoU: { at: 'rim', every: 0.05, f: (fx, p) => fx.spray(p, 1, { c: [0x3aff9a, 0x9affd0], pick: true, speed: 0.1, up: [-1, -0.3], life: 1.3, size: 0.11, grav: 8, shape: 0, stretch: 2 }) },
  sparkler: { at: 'wings', every: 0.025, f: (fx, p) => fx.sparks(p, 1, { c: [0xffffff, pick([0xff3a3a, 0xffffff, 0x3a7aff])], speed: 2, up: 1, life: 0.4, size: 0.07 }) },
  fuse: { at: 'tail', every: 0.025, f: (fx, p) => fx.sparks(p, 1, { c: [0xffffff, 0xffd24a], speed: 2.5, up: 2, life: 0.35, size: 0.07 }) },
  fireworks: { at: 'burst', every: 1.3, f: (fx, p) => fx.sparks(p, 22, { c: [0xffffff, pick([0xff3a3a, 0xffffff, 0x3a7aff])], speed: 5, up: 2, life: 0.7, size: 0.1 }) },
  confetti: { at: 'tail', every: 0.035, f: (fx, p) => fx.spray(p, 1, { c: [0xff3a5a, 0xffd24a, 0x3ad0ff, 0x7dff3a, 0xff7ae0], pick: true, speed: 0.8, up: [-0.4, 0.6], life: 1.5, size: 0.12, grav: 2.5, shape: 0, stretch: 1 }) },
  confettiU: { at: 'around', every: 0.05, f: (fx, p) => fx.spray(p, 1, { c: [0xff3a5a, 0xffd24a, 0x3ad0ff, 0x7dff3a, 0xff7ae0], pick: true, speed: 0.8, up: [-0.4, 0.6], life: 1.5, size: 0.12, grav: 2.5, shape: 0, stretch: 1 }) },
  mallows: { at: 'tail', every: 0.16, f: (fx, p) => fx.spray(p, 1, { c: 0xfffaf2, speed: 0.5, up: [0, 1], life: 1.6, size: 0.22, grav: 8, shape: 0, stretch: 1, soft: true }) },
  smoke: { at: 'tail', every: 0.12, f: (fx, p) => fx.dust(p, 0.5, 0, 0, 0xd8d0c8) },
  smokeU: { at: 'around', every: 0.14, f: (fx, p) => fx.dust(p, 0.6, 0, 0, 0xd8d0c8) },
  stardust: { at: 'tail', every: 0.018, f: (fx, p) => fx.spray(p, 1, { c: [0xfff0b0, 0xffffff, 0x9ad0ff], pick: true, speed: 0.15, up: [-0.1, 0.1], life: 1.6, size: 0.13, grav: 0, shape: 0, stretch: 1 }) },
  stars: { at: 'ahead', every: 0.03, f: (fx, p, F) => fx.spray(p, 1, { c: 0xffffff, speed: 0.1, up: [-0.1, 0.1], life: 0.45, size: 0.07, grav: 0, shape: 3, stretch: 4, vx: -F.x * 9, vz: -F.z * 9 }) },
  starsU: { at: 'around', every: 0.04, f: (fx, p, F, P) => fx.spray(p, 1, { c: [0xffffff, 0xffb05a], pick: true, speed: 0.1, up: [-0.2, 0.2], life: 0.6, size: 0.08, grav: 0, shape: 3, stretch: 3, vx: (p.z - P.z) * 3, vz: -(p.x - P.x) * 3 }) },
  cubes: { at: 'tail', every: 0.09, f: (fx, p) => fx.spray(p, 1, { c: 0x3af0ff, speed: 0, up: [0, 0], life: 0.9, size: 0.15, grav: 0, shape: 0, stretch: 1 }) },
  pixels: { at: 'tail', every: 0.035, f: (fx, p) => fx.spray(p, 1, { c: [0xff2a4a, 0x2aff6a, 0x2a6aff], pick: true, speed: 0.6, up: [-0.4, 0.4], life: 0.6, size: 0.11, grav: 0, shape: 0, stretch: 1 }) },
};
// a follower as one group of a few merged meshes (its own geometry copies, so drop() can free them)
function flipWinding(geo) { for (const a of Object.values(geo.attributes)) { const s = a.itemSize, r = a.array; for (let i = 0; i + 2 < a.count; i += 3) for (let k = 0; k < s; k++) { const t = r[(i + 1) * s + k]; r[(i + 1) * s + k] = r[(i + 2) * s + k]; r[(i + 2) * s + k] = t; } } }
function flatten(g) { g.updateMatrixWorld(true); const out = new THREE.Group(); g.traverse((m) => { if (!m.isMesh) return; const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld); if (m.matrixWorld.determinant() < 0) flipWinding(geo); /* (a mirrored wing: its triangles face the right way again) */ const k = new THREE.Mesh(geo, m.material); k.renderOrder = m.renderOrder; out.add(k); }); mergeParts(out); byMaterial(out); return out; }
function byMaterial(out) { const by = new Map(); for (const m of out.children) if (m.isMesh && !m.isInstancedMesh) { if (!by.has(m.material)) by.set(m.material, []); by.get(m.material).push(m); }
  for (const [mat, list] of by) { if (list.length < 2) continue; const geos = list.map((m) => (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry)); const keys = Object.keys(geos[0].attributes).sort().join(); if (geos.some((g) => Object.keys(g.attributes).sort().join() !== keys)) continue; const merged = mergeGeometries(geos); if (!merged) continue;
    const k = new THREE.Mesh(merged, mat); k.renderOrder = list[0].renderOrder; out.add(k); for (const m of list) { out.remove(m); m.geometry.dispose(); } } }
// identical followers (same parts, same materials) as one InstancedMesh per part: a flock costs a few draws, not one per bird
const matKey = (m) => m.type + ':' + (m.color ? m.color.getHex() : '') + ':' + m.opacity + ':' + m.transparent + ':' + m.side + ':' + (m.map ? m.map.uuid : '') + ':' + m.vertexColors + ':' + m.blending;
function instanceFollowers(items) { if (items.length < 2) return null; const k0 = items[0].o.children;
  const same = (a, b) => { if (!a || !b) return a === b; if (a.array.length !== b.array.length) return false; for (let i = 0; i < a.array.length; i++) if (Math.abs(a.array[i] - b.array[i]) > 1e-5) return false; return true; };
  for (const f of items) { const c = f.o.children; if (c.length !== k0.length || c.some((m, j) => !m.isMesh || matKey(m.material) !== matKey(k0[j].material) || !same(m.geometry.attributes.position, k0[j].geometry.attributes.position) || !same(m.geometry.attributes.color, k0[j].geometry.attributes.color))) return null; }
  const ims = k0.map((m) => { const im = new THREE.InstancedMesh(m.geometry, m.material, items.length); im.frustumCulled = false; im.renderOrder = m.renderOrder; return im; });
  for (const f of items.slice(1)) f.o.traverse((m) => { if (m.isMesh) m.geometry.dispose(); }); return ims; }
function drop(root, o) { root.remove(o); o.traverse((m) => { if (m.isMesh) m.geometry.dispose(); }); }
// the followers and trail of a craft in a skin. root: where the followers live (the scene, or a preview's group);
// fx: the game's effects (none in a preview); size: half the craft's width
export function makeRig({ root, fx = null, kind, key, size = 2, model = null }) {
  const L = LOOK[key], s = L && L[kind === 'heli' ? 'h' : kind === 'ufo' ? 'u' : 'b']; const R = { tick() {}, crash() {}, clear() {}, setVisible() {} }; if (!s) return R;
  let fol = null; const folKey = s.fol && (kind === 'ufo' && FOLLOW[s.fol + 'U'] ? s.fol + 'U' : s.fol); if (folKey) { fol = FOLLOW[folKey](); fol.items = fol.list.map((o, i) => { const g = flatten(fit(o, size * fol.s)); if (fol.face) g.rotation.order = 'YXZ'; return { o: g, w: !!o.userData.wings, i, v: new THREE.Vector3(), on: false }; }); fol.ims = instanceFollowers(fol.items); if (fol.ims) root.add(...fol.ims); else for (const f of fol.items) root.add(f.o); }
  const dropFol = () => { if (!fol) return; if (fol.ims) { for (const im of fol.ims) { root.remove(im); im.geometry.dispose(); im.dispose(); } } else for (const f of fol.items) drop(root, f.o); fol = null; };
  const trails = (s.trail || []).map((n) => ({ ...TRAIL[n], acc: Math.random() * 0.1 }));
  let dim = null; if (s.dim && fx) { dim = new THREE.Mesh(new THREE.CircleGeometry(size * 1.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })); dim.renderOrder = 1; root.add(dim); }
  let t = 0, scat = 0; const side = new THREE.Vector3(), q = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3();
  const where = (k, P, F) => { side.set(F.z, 0, -F.x); const r = size;
    if (k === 'tail') return at.copy(P).addScaledVector(F, kind === 'heli' ? -r * 1.15 : -r * 0.75);
    if (k === 'wings') return at.copy(P).addScaledVector(side, (Math.random() < 0.5 ? -1 : 1) * r * (kind === 'heli' ? 0.45 : 0.92)).addScaledVector(F, -0.1);
    if (k === 'engines') return at.copy(P).addScaledVector(side, (Math.random() < 0.5 ? -1 : 1) * r * 0.5).addScaledVector(F, r * 0.3);
    if (k === 'rotor') { const a = Math.random() * 6.28; return at.set(P.x + Math.cos(a) * r, P.y + 0.5, P.z + Math.sin(a) * r); }
    if (k === 'rim') { const a = Math.random() * 6.28; return at.set(P.x + Math.cos(a) * r, P.y - 0.1, P.z + Math.sin(a) * r); }
    if (k === 'ahead') return at.copy(P).addScaledVector(F, r * 1.5).addScaledVector(side, rnd(-1.5, 1.5) * r).add(q.set(0, rnd(-0.8, 0.8), 0));
    if (k === 'burst') { const a = Math.random() * 6.28, rr = r * rnd(1.4, 2.4); return at.set(P.x + Math.cos(a) * rr, P.y + rnd(0, 1.5), P.z + Math.sin(a) * rr); }
    return at.set(P.x + rnd(-1, 1) * r, P.y + rnd(-0.4, 0.6), P.z + rnd(-1, 1) * r); };
  R.tick = (dt, P, F, live = true) => { t += dt; if (model && model.userData.skinAnim) model.userData.skinAnim(dt, t);
    if (dim) { dim.visible = live; dim.position.set(P.x, 0.13, P.z); }
    if (fol) for (const f of fol.items) { const o = f.o, i = f.i, n = fol.items.length;
      if (scat > 0) { o.position.addScaledVector(f.v, dt); f.v.y -= 6 * dt; o.rotation.x += dt * 4; continue; }
      if (fol.mode === 'orbit') { const a = t * (fol.sp || 1) + i * Math.PI * 2 / n, r = size * 1.3; q.set(P.x + Math.cos(a) * r, P.y + (fol.y || 0.1) + (fol.bob ? Math.sin(t * 2 + i) * 0.2 : 0), P.z + Math.sin(a) * r); }
      else if (fol.mode === 'wing') { side.set(F.z, 0, -F.x); q.copy(P).addScaledVector(side, (i ? 1 : -1) * size * 1.35).addScaledVector(F, -size * 0.2); q.y += Math.sin(t * 2.4 + i * 2) * 0.15; }
      else { side.set(F.z, 0, -F.x); q.copy(P).addScaledVector(F, -size * 0.9 - (fol.gap || 0.7) * size * (i + 1)).addScaledVector(side, Math.sin(t * 1.4 + i * 1.7) * size * 0.3); q.y += (fol.y || 0.15) + Math.sin(t * 2.1 + i) * 0.2; }
      if (!f.on) { o.position.copy(q); f.on = true; } const dx = q.x - o.position.x, dz = q.z - o.position.z; o.position.lerp(q, 1 - Math.exp(-dt * 4));
      if (fol.face) o.rotation.set(-0.9, Math.atan2(o.position.x - P.x, o.position.z - P.z), 0); else if (Math.abs(dx) + Math.abs(dz) > 0.002) o.rotation.y = Math.atan2(dx, dz); else if (fol.mode === 'wing') o.rotation.y = Math.atan2(F.x, F.z);
      if (f.w) o.scale.x = 0.7 + Math.abs(Math.sin(t * 15 + i * 1.3)) * 0.3; } /* wings flap */
    if (fol && fol.ims) { for (const f of fol.items) { f.o.updateMatrix(); for (const im of fol.ims) im.setMatrixAt(f.i, f.o.matrix); } for (const im of fol.ims) im.instanceMatrix.needsUpdate = true; }
    if (scat > 0) { scat -= dt; if (scat <= 0 && fol) dropFol(); }
    if (fx && live) for (const tr of trails) { tr.acc -= dt; let k = 0; while (tr.acc <= 0 && k++ < 4) { tr.acc += tr.every; tr.f(fx, where(tr.at, P, F), F, P); } } };
  R.crash = () => { if (!fol) return; scat = 2.2; for (const f of fol.items) f.v.set(rnd(-5, 5), rnd(2, 6), rnd(-5, 5)); };
  R.setVisible = (v) => { if (fol) { if (fol.ims) for (const im of fol.ims) im.visible = v; else for (const f of fol.items) f.o.visible = v; } if (dim) dim.visible = v; };
  R.clear = () => { dropFol(); if (dim) { root.remove(dim); dim.geometry.dispose(); dim.material.dispose(); } dim = null; };
  return R; }

// ---------- what the weapons do on landing, and the burst when it is shot down ----------
// how: napalm, rocket or ray. popup(at, text, colour) is the game's floating label
let lastWord = 0; // the ray fires often (automatic shots too): its words come up at most every 3.5 s
export function weaponFx(fx, key, at, how, popup) { const L = LOOK[key]; if (!L || !fx) return; const p = { x: at.x, y: (at.y || 0) + 0.4, z: at.z }, big = how === 'napalm';
  if (L.blast) fx.spray(p, big ? 22 : 14, { c: L.blast, pick: true, speed: big ? 5 : 4, up: [2, 6], life: 0.9, size: 0.14, grav: 10, shape: 0, stretch: 1.4 });
  if (L.pool) fx.pool(at, big ? 1.3 : 0.9, L.pool, 8, 0.5); if (L.glowC) fx.glow(at, big ? 2.6 : 1.8, L.glowC, 0.6, 0.6); if (L.ring) fx.shock(at, big ? 3 : 2.2, L.ring, 0.35);
  if (L.star) for (const c of [0xff3a3a, 0xffffff, 0x3a7aff]) fx.sparks({ x: at.x, y: 1.2, z: at.z }, 10, { c: [0xffffff, c], speed: 6, up: 3, life: 0.7, size: 0.1 });
  if (L.ghosts) fx.spray(p, 6, { c: [0xffffff, 0x7dffb0], speed: 1.5, up: [1, 3], life: 1, size: 0.5, grav: -1, shape: 0, stretch: 0 });
  if (L.words && popup && Math.random() < 0.6 && (how !== 'ray' || performance.now() - lastWord > 3500)) { lastWord = performance.now(); popup(at, pick(L.words), L.wordC); } }
export function crashFx(fx, key, at, kind, popup) { const L = LOOK[key]; if (!L || !fx) return; const p = { x: at.x, y: at.y + 0.4, z: at.z };
  fx.spray(p, 46, { c: L.boom, pick: true, speed: 7, up: [3, 8], life: 1.3, size: 0.18, grav: 9, shape: 0, stretch: 1.3 }); for (let i = 0; i < 10; i++) fx.bit(p, 1.3, pick(L.boom));
  if (L.boomRing) fx.shock({ x: at.x, y: 0, z: at.z }, 5, L.boomRing, 0.5); if (L.implode) fx.flash(p, 2.5, 0x9a6aff);
  if (L.fireworks) for (let i = 0; i < 4; i++) fx.sparks({ x: at.x + rnd(-2, 2), y: at.y + rnd(1, 3), z: at.z + rnd(-2, 2) }, 26, { c: [0xffffff, [0xff3a3a, 0xffffff, 0x3a7aff, 0xff3a3a][i]], speed: 7, up: 3, life: 0.9, size: 0.12 });
  if (L.ghosts) fx.spray(p, 10, { c: [0xffffff, 0x7dffb0], speed: 2, up: [1, 4], life: 1.4, size: 0.6, grav: -1, shape: 0, stretch: 0 });
  if (L.cubes) for (let i = 0; i < 12; i++) fx.bit(p, 1, 0x3af0ff);
  if (popup && (L.boomText || L.words)) popup(at, kind === 'ufo' && L.boomTextU ? L.boomTextU : L.boomText || L.words[0], L.wordC || '#ffffff');
  return !!L.honk; }

// ---------- the live picture: a craft in a skin, turning, with its followers, dropping or firing now and then ----------
// fitTo: how wide the craft is drawn. For the shop and the games' menus (livePreview.js)
export function craftPreview(kind, key, { fitTo = 2.7, y = 0, tilt = 0 } = {}) {
  const o = new THREE.Group(), stage = new THREE.Group(); o.add(stage); o.position.y = y; o.rotation.x = tilt; let g, beam = null;
  if (kind === 'ufo') { g = makeShip(); if (key) dressShip(g, key); g.scale.setScalar(fitTo / 4.1); beam = makeBeam(); if (key) skinBeam(beam, key); beam.g.position.y = -0.45 * fitTo / 4.1; stage.add(beam.g); }
  else { g = kind === 'heli' ? makeHeli() : makeBomber(); if (key) dressCraft(g, kind, key); const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()); g.scale.multiplyScalar(fitTo / Math.max(sz.x, sz.z)); bb.setFromObject(g); g.position.sub(bb.getCenter(new THREE.Vector3())); }
  stage.add(g); const rig = key ? makeRig({ root: stage, kind, key, size: fitTo / 2, model: g }) : null;
  const L = key && LOOK[key], ray = kind === 'ufo' && key ? rayColors(key) : null, drop = { m: null, t: 0, cd: 1.2 }, F = new THREE.Vector3(0, 0, 1), O = new THREE.Vector3();
  const flashM = new THREE.MeshBasicMaterial({ color: L && L.fire ? L.fire[1] : 0xff8a2a, transparent: true, opacity: 0.8, depthWrite: false }), flash = new THREE.Mesh(GEO.s, flashM); flash.visible = false; stage.add(flash);
  o.userData.tick = (dt, t) => { stage.rotation.y = 0.6 + t * 0.5; stage.rotation.z = Math.sin(t * 0.9) * 0.06; stage.position.y = Math.sin(t * 1.6) * 0.06;
    for (const p of g.userData.props || []) { if (kind === 'heli') p.rotation.y += dt * 25; else p.rotation.z += dt * 40; } if (g.userData.tail) g.userData.tail.rotation.x += dt * 30;
    if (kind === 'ufo') { const u = g.userData; u.ring.material.map.offset.x += dt * 0.8; u.pilot.rotation.y = Math.sin(t * 0.7) * 0.9; beam.update(dt, 1.9 * fitTo / 2.7, 1.1 * fitTo / 2.7, Math.sin(t * 0.9) > -0.3); }
    if (rig) rig.tick(dt, O, F, true); else if (g.userData.skinAnim) g.userData.skinAnim(dt, t);
    // now and then: a canister falls, a rocket shoots out, the death ray flashes
    drop.cd -= dt; if (drop.cd <= 0 && !drop.m && drop.keep) { drop.cd = 2.4; drop.t = 0; drop.m = drop.keep; drop.m.visible = true; drop.m.rotation.x = 0; stage.add(drop.m); }
    if (drop.cd <= 0 && !drop.m) { drop.cd = 2.4; drop.t = 0;
      if (kind === 'bomber') drop.m = (key && skinCanister(key)) || fit(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.46, 8).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x39461f })), 0.3);
      else if (kind === 'heli') drop.m = (key && skinRocket(key)) || fit(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x7c8466 })), 0.5);
      else { const c = ray || [0xff3ad0, 0xffffff]; drop.m = new THREE.Group(); const a = new THREE.Mesh(GEO.c, new THREE.MeshBasicMaterial({ color: c[0], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })), b = new THREE.Mesh(GEO.c, new THREE.MeshBasicMaterial({ color: c[1], transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })); a.scale.set(0.09, 2.2, 0.09); b.scale.set(0.035, 2.2, 0.035); a.position.y = b.position.y = -1.1; drop.m.add(a, b); drop.m.rotation.z = 0.5; drop.m.position.set(0, -0.3 * fitTo / 4.1, 0); }
      if (kind !== 'ufo') drop.m.scale.multiplyScalar(fitTo / 2.7); drop.keep = drop.m; stage.add(drop.m); }
    if (drop.m) { drop.t += dt; const m = drop.m;
      if (kind === 'bomber') { m.position.set(0, -0.25 - drop.t * drop.t * 4, -0.1); m.rotation.x = drop.t * 2; if (drop.t > 0.55) { flash.visible = true; flash.position.copy(m.position); } }
      else if (kind === 'heli') { m.position.set(0.35, -0.2 - drop.t * 0.6, 0.3 + drop.t * 4.5); if (drop.t > 0.4) { flash.visible = true; flash.position.copy(m.position); } }
      else m.visible = drop.t < 0.25;
      if (flash.visible) { const k = (drop.t - (kind === 'bomber' ? 0.55 : 0.4)) / 0.3; flash.scale.setScalar(0.2 + k * 0.6); flashM.opacity = Math.max(0, 0.85 - k); m.visible = false; }
      if (drop.t > 0.9) { stage.remove(m); drop.m = null; flash.visible = false; } } };
  return o; }


// ---------- in the games: everything a skin does there, behind a few calls ----------
const fwdOf = (h, v) => v.set(Math.sin(h), 0, Math.cos(h));
const distTo = (o, x, z) => Math.hypot(o.position.x - x, o.position.z - z);
// free an aircraft that is being replaced: everything it owns, not the shapes and paints every aircraft shares (found once
// per kind by building two and keeping what they have in common)
const sharedSets = {}; function sharedOf(kind, key) { const sk = kind + ':' + (key || ''); if (sharedSets[sk]) return sharedSets[sk]; const sets = [0, 1].map(() => { let g = kind === 'heli' ? makeHeli() : makeBomber(); if (key) g = dressCraft(g, kind, key); const s = new Set(); g.traverse((m) => { if (m.geometry) s.add(m.geometry); const ml = m.material ? [].concat(m.material) : []; for (const x of ml) s.add(x); }); return s; });
  return (sharedSets[sk] = new Set([...sets[0]].filter((x) => sets[1].has(x)))); }
export function disposeCraft(g, kind) { if (!g) return; const keep = sharedOf(kind, g.userData.skinKey || null), canKeep = new Set(); for (const c of canCache.values()) if (c) { canKeep.add(c.geo); canKeep.add(c.mat); } if (ghostXray) canKeep.add(ghostXray);
  if (g.parent) g.parent.remove(g); g.traverse((m) => { if (m.geometry && !keep.has(m.geometry) && !canKeep.has(m.geometry)) m.geometry.dispose(); for (const x of m.material ? [].concat(m.material) : []) if (!keep.has(x) && !canKeep.has(x)) x.dispose(); if (m.isInstancedMesh) m.dispose(); }); } /* (the canister batch's own instance buffers too) */
// the CHOOSE SKIN button on a game's start screen: Default plus the skins owned for that craft (skins.js pauseSkinRow)
export function craftSkinButton(host, kind, onPick) { if (!host) return; const icon = kind === 'ufo' ? '🛸' : kind === 'heli' ? '🚁' : '✈️', l = CRAFT_SKINS[kind];
  pauseSkinRow(host, icon, 'cr_' + kind, CRAFT_STORMS.filter((k) => l[k]).map((k) => [craftSkinId(kind, k), l[k].name]), (id) => { if (onPick) onPick(id); return true; }); /* (beside SOUND and MUSIC: the start screen still fits a phone) */ const b = host.querySelector('.psBtn'), row = host.querySelector('.soundRow'); if (b && row) { if (b.parentNode !== row) row.insertBefore(b, row.firstChild); row.style.display = 'grid'; row.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))'; b.style.margin = '0'; b.title = b.textContent; b.textContent = b.textContent.split(' ')[0] + ' SKIN'; /* (the name it wears shows in the menu) */ } }
// beating The Sprawl (the last town) wins that game's Acid skins, as the Acid Storm is won in Tornado Time!. Returns the names won
// the prize game's own prize: a skin for the craft just flown (3 in 4 after a win, 1 in 4 after a loss), on one go picked at
// random. One time in four it is a zombie horde instead (or when every skin for the craft is owned). It goes straight on.
export function craftPrize(kind, won, goes) { let n = 0; const go = Math.random() < (won ? 0.75 : 0.25) ? (Math.random() * goes) | 0 : -1;
  return () => { if (n++ !== go) return null; const own = getOwned(), l = CRAFT_SKINS[kind], cl = Object.keys(l).filter((k) => !l[k].bonus && !own.includes(craftSkinId(kind, k))), hl = HORDE_IDS.filter((k) => !own.includes('horde:' + k));
    if (hl.length && (!cl.length || Math.random() < 0.25)) { const k = hl[(Math.random() * hl.length) | 0]; grantSkin('horde:' + k); return { kind: 'craft', text: 'NEW ZOMBIES: ' + HORDE_SKINS[k].name.toUpperCase() + '! Put them on in the skin shop.' }; }
    if (!cl.length) return null; const k = cl[(Math.random() * cl.length) | 0]; grantSkin(craftSkinId(kind, k)); equip('cr_' + kind, craftSkinId(kind, k)); return { kind: 'craft', text: 'NEW SKIN: ' + l[k].name.toUpperCase() + '! It is on for your next round.' }; }; }
export function unlockCraftBonus(game) { const won = []; for (const k of game === 'ufo' ? ['ufo'] : ['bomber', 'heli']) if (grantSkin(craftSkinId(k, 'acid'))) won.push(CRAFT_SKINS[k].acid.name); return won; }
// things a quirk throws (pies, meteors, moons): they arc from a to (x, z) over T seconds, then land()
function makeFlying(scene) { const list = [];
  return { add(m, a, x, z, T, land, arc = 1.5) { m.position.copy(a); scene.add(m); list.push({ m, a: a.clone(), x, z, t: 0, T, land, arc }); },
    tick(dt) { for (let i = list.length - 1; i >= 0; i--) { const f = list[i]; f.t += dt; const k = Math.min(1, f.t / f.T); f.m.position.set(f.a.x + (f.x - f.a.x) * k, f.a.y * (1 - k) + 0.3 * k + Math.sin(k * Math.PI) * f.arc, f.a.z + (f.z - f.a.z) * k); f.m.rotation.x += dt * 6; if (k >= 1) { scene.remove(f.m); list.splice(i, 1); f.land(); } } },
    clear() { for (const f of list) scene.remove(f.m); list.length = 0; } }; }
// a baby twister (the Acid quirks): grows, wanders for life seconds, fades. hit(x, z) is called every few tenths of a second
function makeBabies(scene, twisters) { const list = [];
  return { get n() { return list.length; }, add(x, z, life, hit, bounds = null) { if (!twisters || list.length > 3) return false; const g = twisters.make(false, [], 'acid', { baby: true, quiet: true }); g.position.set(x, 0, z); g.scale.setScalar(0.001); scene.add(g); list.push({ g, t: 0, life, h: Math.random() * 6.28, hitT: 0.3, hit, x0: x, z0: z, bounds }); return true; },
    tick(dt) { for (let i = list.length - 1; i >= 0; i--) { const b = list[i], g = b.g; b.t += dt; b.h += (Math.random() - 0.5) * dt * 3; g.position.x += Math.cos(b.h) * 3.2 * dt; g.position.z += Math.sin(b.h) * 3.2 * dt;
        if (Math.hypot(g.position.x - b.x0, g.position.z - b.z0) > 8) b.h = Math.atan2(b.z0 - g.position.z, b.x0 - g.position.x); if (b.bounds) { g.position.x = Math.max(-b.bounds.x, Math.min(b.bounds.x, g.position.x)); g.position.z = Math.max(-b.bounds.z, Math.min(b.bounds.z, g.position.z)); }
        const k = Math.min(1, b.t / 0.5) * Math.max(0, Math.min(1, (b.life - b.t) / 0.6)); g.scale.setScalar(Math.max(0.001, 0.55 * k)); b.hitT -= dt; if (b.hitT <= 0 && k > 0.5) { b.hitT = 0.3; b.hit(g.position.x, g.position.z); }
        if (b.t >= b.life) { twisters.remove(g, true); list.splice(i, 1); } } },
    clear() { for (const b of list) twisters.remove(b.g, true); list.length = 0; } }; }

// ZOMBIE AIR RAID. env: { scene, fx, horde, twisters, popup(at, text, colour), sfx, jolt(k), hitThings(x, z, how), rocketR }
// Calls: dress(g, kind) on a new aircraft, canister() / rocket() for what falls or flies (null: the usual one), napalm(x, z) and
// blast(p) where they land, tick(dt, craft) every frame, crash(at, g) as the wreck hits the ground (before it is torn up)
export function airSkin(env) { const { scene, fx, horde } = env; let key = null, kind = null, rig = null, drops = 0, shots = 0, metT = 30, metReady = false; const F = new THREE.Vector3(), flying = makeFlying(scene), babies = makeBabies(scene, env.twisters);
  const Z = () => horde.Z || [], C = () => horde.C || [], say = (at, t, c) => { if (env.popup) env.popup(at, t, c); };
  // stand still (a zombie's own 'feed' state, so it still burns if it is in the fire), or walk to a spot for t seconds
  const holdZ = (x, z, r, t) => { let n = 0; for (const o of Z()) { const u = o.userData; if (!u || u.st === 'rise' || distTo(o, x, z) > r) continue; u.st = 'feed'; u.t = Math.max(u.t || 0, t); u.prey = null; n++; } return n; };
  const lureZ = (x, z, r, t, jit = 0) => { let n = 0; for (const o of Z()) { const u = o.userData; if (!u || u.st !== 'walk' || distTo(o, x, z) > r) continue; u.prey = null; u.tx = x + rnd(-jit, jit); u.tz = z + rnd(-jit, jit); u.think = t; n++; } return n; };
  const holdC = (x, z, r, t) => { let n = 0; for (const o of C()) { const u = o.userData; if (!u || u.st === 'turn' || distTo(o, x, z) > r) continue; u.st = 'idle'; u.goal = null; u.wait = t; u.think = t; n++; } return n; };
  const babyHit = (x, z) => { horde.blast(x, z, 1.0, 0.9, 'rocket', true); }; // zombies only: no people, buildings or landmarks
  function meteor(from, x, z, big, small = false) { let r = big ? 2.7 : 2.3; flying.add(cached(big ? 'met:big' : 'met', () => fit(I.meteor(), big ? 1.3 : 1.0)), from, x, z, 0.8, () => { const at = new THREE.Vector3(x, 0, z); fx.explode(at.clone().setY(0.3), big ? 1.8 : 1.5); fx.scorch(at, 2, 24); fx.shock(at, 3.6, 0xffd24a, 0.4); if (small) { r = 1.6; while (r > 0.3 && horde.count && horde.count(x, z, r) > 8) r -= 0.1; } /* (sized as it lands: about 8 zombies at most) */ horde.blast(x, z, r, 1.4, 'rocket', small); if (env.hitThings && !small) env.hitThings(x, z, 'rocket'); say(at, 'METEOR!', '#ffd24a'); if (env.sfx && env.sfx.boom) env.sfx.boom(); if (env.jolt) env.jolt(0.4); }, 0.5); }
  const api = {
    get key() { return key; },
    dress(g, k) { api.clear(); kind = k; key = craftSkinKey(k); setFlamePalette(craftFlames(key)); drops = shots = 0; metT = kind === 'heli' ? 30 : 45; metReady = false; if (!key) return g; dressCraft(g, k, key); rig = makeRig({ root: scene, fx, kind: k, key, size: k === 'heli' ? 2.1 : 2.05, model: g }); return g; },
    canister() { return key ? skinCanister(key) : null; },
    rocket() { return key ? skinRocket(key) : null; },
    napalm(x, z) { if (!key) return; const at = new THREE.Vector3(x, 0, z); weaponFx(fx, key, at, 'napalm', env.popup); drops++;
      if (key === 'acid' && drops % 4 === 0) { if (babies.add(x, z, 5, babyHit)) say(at, 'BABY TWISTER!', '#b8ff3a'); }
      else if (key === 'clown') for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = rnd(1.8, 2.6), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        flying.add(cached('pie', () => fit(I.pie(), 0.4)), new THREE.Vector3(x, 0.6, z), px, pz, 0.45, () => { fx.spray({ x: px, y: 0.3, z: pz }, 10, { c: [0xffffff, 0xffd0e0], pick: true, speed: 3, up: [1, 3], life: 0.6, size: 0.12, grav: 9, shape: 0, stretch: 1 }); fx.pool({ x: px, z: pz }, 0.6, 0xf4ece0, 6, 0.6);
          for (const o of Z()) { const u = o.userData; if (u && u.st === 'walk' && distTo(o, px, pz) < 1.1) { u.prey = null; u.tx = o.position.x + rnd(-1.6, 1.6); u.tz = o.position.z + rnd(-1.6, 1.6); u.think = 2; } } }, 1.2); } // blinded: they stumble about, some into the flames
      else if (key === 'zombie') { if (lureZ(x, z, 5.5, 2.2, 0.4)) say(at, 'GROAN!', '#9dff3a'); fx.glow(at, 2.4, 0x9dff3a, 1.2, 0.5); }
      else if (key === 'ghost' && drops % 3 === 0) { if (lureZ(x, z, 4.4, 3, 0.3)) say(at, 'POSSESSED!', '#b8ffd8'); fx.spray({ x, y: 0.6, z }, 10, { c: [0xffffff, 0x7dffb0], speed: 2, up: [1, 3], life: 1.2, size: 0.5, grav: -1, shape: 0, stretch: 0 }); }
      else if (key === 'mallow') { const n = holdZ(x, z, 2.6, 3) + holdC(x, z, 2.6, 3); fx.pool(at, 2.2, 0xf4ece0, 8, 0.6); if (n) say(at, 'STUCK!', '#ffe8f0'); } },
    blast(p) { if (!key) return; const at = new THREE.Vector3(p.x, 0, p.z), R = env.rocketR || 1.75; weaponFx(fx, key, at, 'rocket', env.popup); shots++;
      if (key === 'acid' && shots % 6 === 0) { if (babies.add(p.x, p.z, 4, babyHit)) say(at, 'BABY TWISTER!', '#b8ff3a'); }
      else if (key === 'clown') { if (holdZ(p.x, p.z, R + 1.4, 3)) say(at, 'PIED!', '#ffffff'); }
      else if (key === 'zombie') { if (lureZ(p.x, p.z, 4.5, 2, 0.3)) say(at, 'GROAN!', '#9dff3a'); fx.glow(at, 2, 0x9dff3a, 1.2, 0.5); }
      else if (key === 'ghost') { if (lureZ(p.x, p.z, 4, 3, 0.3)) say(at, 'LURED!', '#b8ffd8'); }
      else if (key === 'mallow') { if (holdZ(p.x, p.z, R + 1.6, 4)) say(at, 'GLUED!', '#ffe8f0'); fx.pool(at, 1.6, 0xf4ece0, 8, 0.6); }
      else if (key === 'planet' && metReady) { metReady = false; metT = 30; meteor(new THREE.Vector3(p.x + 3, 12, p.z - 3), p.x, p.z, true); } },
    tick(dt, c, title = false) { flying.tick(dt); babies.tick(dt); if (!key || !c) return; const live = c.alive && !c.crash; if (rig) rig.tick(dt, c.pos, fwdOf(c.head, F), live); if (title) return; /* (the title screen: looks only) */
      if (key === 'void') c.stealth = 0.8; // the gloopers must be a little closer to see it (horde.js), still beyond the heli's aim
      if (key === 'planet' && live) { metT -= dt; if (metT <= 0) { if (kind === 'heli') { if (!metReady) { metReady = true; say(c.pos, 'METEOR READY: FIRE!', '#ffd24a'); } } else { const d = horde.densest ? horde.densest(c.pos.x, c.pos.z, 26) : null; if (d) { metT = 45; meteor(c.pos.clone(), d.x, d.z, false, true); } else metT = 3; } } } },
    crash(at, g) { if (g) stripSkin(g); if (!key) return; if (rig) rig.crash(); if (crashFx(fx, key, at, kind, env.popup) && env.sfx && env.sfx.honk) env.sfx.honk(); },
    clear() { if (rig) rig.clear(); rig = null; babies.clear(); flying.clear(); },
  };
  return api; }

// BEAM 'EM UP!. env: { scene, fx, twisters, popup, sfx, jolt, people: () => list, buildings: () => list, crumble(b, from, label),
// army, addPerson(x, z, o), collide(person), played: () => seconds, beamOn: () => bool, lim: () => { x, z } }
// Calls: dress(body) on a new saucer (and beam(b) for its tractor beam, rayColors() for the death ray), hit(at) where the
// ray lands, tick(dt, ship) every frame, crash(at) when it goes down. panic and lured(c, d) are read by the townsfolk loop
export function ufoSkin(env) { const { scene, fx } = env; let key = null, rig = null, qT = 0, lureT = 14, lureOn = false, zT = 0; const F = new THREE.Vector3(0, 0, 1), P = new THREE.Vector3(), flying = makeFlying(scene), babies = makeBabies(scene, env.twisters), zombies = [];
  const people = () => (env.people ? env.people() : []), now = () => (env.played ? env.played() : 0), say = (at, t, c) => { if (env.popup) env.popup(at, t, c); };
  const babyHit = (x, z) => { /* the army and a short stun only: no buildings */
    if (env.army && env.army.hitArea) env.army.hitArea(new THREE.Vector3(x, 0, z), 0.9, { quiet: true }); for (const c of people()) if (distTo(c, x, z) < 1.5) c.userData.stun = now() + 1.5; };
  function pie(s) { let best = null, bd = 9; for (const c of people()) { const u = c.userData; if (u.zombie || u.stun > now()) continue; const d = distTo(c, s.x, s.z); if (d > 1.2 && d < bd) { bd = d; best = c; } } if (!best) return;
    const x = best.position.x, z = best.position.z; flying.add(cached('pie', () => fit(I.pie(), 0.4)), new THREE.Vector3(s.x, s.y - 0.6, s.z), x, z, 0.6, () => { let n = 0; for (const c of people()) if (!c.userData.zombie && distTo(c, x, z) < 1.3) { c.userData.stun = now() + 3; n++; } fx.spray({ x, y: 0.3, z }, 12, { c: [0xffffff, 0xffd0e0], pick: true, speed: 3, up: [1, 3], life: 0.6, size: 0.12, grav: 9, shape: 0, stretch: 1 }); fx.pool({ x, z }, 0.7, 0xf4ece0, 6, 0.6); if (n) say(new THREE.Vector3(x, 0.5, z), 'PIED!', '#ffffff'); if (env.sfx && env.sfx.honk) env.sfx.honk(); }, 1); }
  function dropZombie(s) { if (!env.addPerson || zombies.length >= 8) return; let x = s.x, z = s.z; const near = people().filter((c) => !c.userData.zombie && distTo(c, s.x, s.z) < 9); if (near.length) { const c = pick(near), a = Math.random() * 6.28; x = c.position.x + Math.cos(a) * 1.6; z = c.position.z + Math.sin(a) * 1.6; }
    const zb = env.addPerson(x, z, { kind: 'zombie' }); if (!zb) return; if (env.collide) env.collide(zb); zombies.push(zb); fx.dust({ x, y: 0, z }, 1.1, 0, 0, 0x6a7a4a); fx.glow({ x, z }, 1.4, 0x9dff3a, 0.6, 0.5); say(new THREE.Vector3(x, 0.6, z), 'ZOMBIE!', '#9dff3a'); }
  function moon(s) { const t = env.army && env.army.nearest ? env.army.nearest(new THREE.Vector3(s.x, 0, s.z), 13, true) : null; if (!t) { qT = 4; return; } const b = { pos: t.pos.clone() }; /* the nearest army unit, never a building */
    flying.add(cached('moon', () => fit(I.planet(4), 0.9)), new THREE.Vector3(s.x, s.y, s.z), b.pos.x, b.pos.z, 0.9, () => { const at = new THREE.Vector3(b.pos.x, 0, b.pos.z); if (env.army && env.army.hitArea) env.army.hitArea(at, 1.4, { quiet: true }); say(at, 'MOON!', '#ffffff'); fx.explode(at.clone().setY(0.4), 1.3); fx.shock(at, 3, 0xffffff, 0.4); if (env.sfx && env.sfx.boom) env.sfx.boom(); if (env.jolt) env.jolt(0.3); }, 0.6); }
  const api = {
    get key() { return key; },
    get panic() { return key === 'void' ? 0.75 : 1; }, // The Void: people only run when it is nearly on top of them
    lured(c, d) { return lureOn && d < 9 && !c.userData.zombie; }, // Spook Saucer: now and then people in its glow walk to the beam
    dress(b) { api.clear(); key = craftSkinKey('ufo'); setFlamePalette(craftFlames(key)); qT = key === 'planet' ? 12 : 6; lureT = 14; lureOn = false; if (!key) return b; dressShip(b, key); rig = makeRig({ root: scene, fx, kind: 'ufo', key, size: 1.95, model: b }); return b; },
    beam(bm) { skinBeam(bm, key); },
    rayColors() { return key ? rayColors(key) : null; },
    hit(to) { if (!key) return; weaponFx(fx, key, to, 'ray', env.popup); if (key === 'mallow') { let n = 0; for (const c of people()) if (distTo(c, to.x, to.z) < 1.8) { c.userData.stun = now() + 7; n++; } fx.pool(to, 1.4, 0xf4ece0, 8, 0.6); if (n) say(to, 'STUCK!', '#ffe8f0'); } },
    tick(dt, s, title = false) { flying.tick(dt); babies.tick(dt); if (!key || !s) return; const live = s.alive !== false && !s.fall, on = env.beamOn ? env.beamOn() : false; P.set(s.x, s.y, s.z); if (s.vel && Math.hypot(s.vel.x, s.vel.z) > 0.3) F.set(s.vel.x, 0, s.vel.z).normalize(); if (rig) rig.tick(dt, P, F, live); if (title) return; /* (the title screen and the climb away: looks only) */
      if (!live) return; qT -= dt;
      if (key === 'acid' && qT <= 0 && on) { qT = 14; babies.add(s.x, s.z, 8, babyHit, env.lim ? env.lim() : null); say(P, 'BABY TWISTER!', '#b8ff3a'); }
      else if (key === 'clown' && qT <= 0 && on) { qT = 4; pie(s); }
      else if (key === 'zombie' && qT <= 0) { qT = 15; dropZombie(s); }
      else if (key === 'planet' && qT <= 0) { qT = 20; moon(s); }
      if (key === 'ghost') { lureT -= dt; if (lureT <= 0) { lureOn = !lureOn; lureT = lureOn ? 8 : 20; if (lureOn) { say(P, 'COME CLOSER...', '#b8ffd8'); fx.glow({ x: s.x, z: s.z }, 9, 0x7dffb0, 1.5, 0.35); } } }
      if (zombies.length) { zT -= dt; const list = people(); if (zT <= 0) { zT = 0.5; for (let i = zombies.length - 1; i >= 0; i--) if (!list.includes(zombies[i])) zombies.splice(i, 1); } // (beamed up, or gone)
        if (false) for (const zb of zombies) for (let i = list.length - 1; i >= 0; i--) { /* (no bites: just extra zombies to beam up) */ const c = list[i], u = c.userData; if (u.zombie) continue; const dx = c.position.x - zb.position.x, dz = c.position.z - zb.position.z, d = Math.hypot(dx, dz) || 0.01; if (d > 2.6) continue;
          if (d < 0.42 && zombies.length < 8) { list.splice(i, 1); scene.remove(c); const nz = env.addPerson(c.position.x, c.position.z, { kind: 'zombie' }); if (nz) zombies.push(nz); say(c.position, 'BITTEN!', '#9dff3a'); break; }
          c.position.x += dx / d * 1.8 * dt; c.position.z += dz / d * 1.8 * dt; u.goal = null; u.panic = true; } } },
    crash(at) { if (!key) return; if (rig) rig.crash(); if (crashFx(fx, key, at, 'ufo', env.popup) && env.sfx && env.sfx.honk) env.sfx.honk(); },
    clear() { if (rig) rig.clear(); rig = null; babies.clear(); flying.clear(); zombies.length = 0; },
  };
  return api; }
