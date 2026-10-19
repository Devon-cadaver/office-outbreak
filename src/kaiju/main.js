// Kaiju Madness: you are the monster. It plays like Tornado Alley, but the city fights back for real. You stomp through
// town eating people (that's how you grow), your kaiju hits whatever's closest on its own, and a tap walks you somewhere,
// or, when your Power bar is full, casts your spell at what you tapped. One bar is your size and your health: the army,
// napalm planes and rival kaiju drain it, and you shrink a stage (Colossus -> Titan -> Hatchling) when it drops below a
// stage's line. Empty it as a Hatchling and the round's over. Two rival kaiju come for you at each stage. New kaiju are won in the end-of-round prize games.
import * as THREE from 'three';
import { generateMaze, buildCity, toWorld, toCell, findPath, CELL, mulberry32 } from '../city.js';
import { makeCharacter, animateWalk } from '../poster/characters.js';
import { makeCar } from '../car.js';
import { createTwisters } from '../tornado.js';
import { createFires } from '../fire.js';
import { unlockAudio, soundToggle, sfx, stopMusic, setPlaneEngine, startStormMusic, setStormLevel, stormBoost } from '../audio.js';
import { equippedSkin, skinnedCarArgs, addCoins, CHAR_SKINS, getEquipped } from '../skins.js';
import { forceSeason } from '../season.js';
import { showPrizes } from '../prizes.js';
import { nukeBlast } from '../nuke.js';
import { stampVersion } from '../version.js';
import { initFullscreen } from '../fullscreen.js';
import { showHowTo, tip, tipsSeen, markSeen, clearTips } from '../howto.js';
import { autoResolution, mergeStatic } from '../perf.js';
import { rides, spinners } from '../landmarks.js';
import { makePlane } from '../ally/units.js';
import { KAIJU, KAIJU_IDS, buildKaiju } from './rigs.js';
import { createSpells } from './spells.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.debug.checkShaderErrors = false;
const perfTick = autoResolution(renderer);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1e2a2c); scene.fog = new THREE.Fog(0x1e2a2c, 60, 120);
const hemi = new THREE.HemisphereLight(0xc8e0d8, 0x2a3a3c, 1.75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xe0f0ff, 0.95); sun.position.set(-6, 10, 8); scene.add(sun);
const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
const ISO_YAW = Math.PI / 4, ISO_ELEV = 0.72;
const isoDir = new THREE.Vector3(Math.sin(ISO_YAW) * Math.cos(ISO_ELEV), Math.sin(ISO_ELEV), Math.cos(ISO_YAW) * Math.cos(ISO_ELEV)).normalize();
const fx = createFires(scene);
let flashT = 0, hurtT = 0; const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;background:#dfeaff;opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(flashEl);
let darkT = 0; const darkEl = document.createElement('div'); darkEl.style.cssText = 'position:fixed;inset:0;background:#05020c;opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(darkEl);
const hurtEl = document.createElement('div'); hurtEl.style.cssText = 'position:fixed;inset:0;box-shadow:inset 0 0 40px 6px #ff2a2a;opacity:0;pointer-events:none;z-index:5;transition:opacity .1s'; document.body.appendChild(hurtEl);
const twisters = createTwisters(scene); // only its debris (chunks flying and landing as rubble) is used here
stampVersion($('taStart'));

// ---------- tuning ----------
const LEVELS = [
  { name: 'Small Town', size: 21, time: 150, goal: 35, pois: 5, need: 2 },
  { name: 'Suburbs', size: 27, time: 170, goal: 35, pois: 6, need: 3 },
  { name: 'Downtown', size: 33, time: 195, goal: 35, pois: 7, need: 4 },
  { name: 'Metro', size: 39, time: 220, goal: 30, pois: 8, need: 6 },
  { name: 'Megacity', size: 47, time: 270, goal: 30, pois: 10, need: 10 },
];
let level = 1; const L = () => LEVELS[level - 1];
const STAGE = ['', 'HATCHLING', 'TITAN', 'COLOSSUS'];
const stageOf = (f) => (f < 1 / 3 ? 1 : f < 2 / 3 ? 2 : 3);
const scaleOf = (f) => 1.5 + f * 3.2; // rigs are ~2 units tall at scale 1: about 3 tall as a hatchling, 9 as a colossus
const MAX_H = [0, 3.3, 6.3, 99]; // the tallest building each stage can flatten
const CHARGE = 9; // seconds for a full Power bar (smashing things fills it faster)
const unlockedLevel = () => { try { return Math.max(1, Math.min(LEVELS.length, +localStorage.getItem('kj_level') || 1)); } catch { return 1; } };
const unlockedKaiju = () => { try { const u = JSON.parse(localStorage.getItem('kj_unlocked') || '[]'); return ['godzilly', ...u.filter((x) => KAIJU[x] && x !== 'godzilly')]; } catch { return ['godzilly']; } };
const unlockKaiju = (id) => { const u = unlockedKaiju(); if (u.includes(id)) return false; u.push(id); try { localStorage.setItem('kj_unlocked', JSON.stringify(u.filter((x) => x !== 'godzilly'))); } catch { /* ignore */ } return true; };
let pick = 'godzilly'; try { const p = localStorage.getItem('kj_pick'); if (unlockedKaiju().includes(p)) pick = p; } catch { /* ignore */ }
// big targets: same ten as Tornado Alley; `stage` is the size needed to take one
const POI = { fair: { icon: '🎡', name: 'FAIRGROUND', stage: 3, pts: 4000 }, power: { icon: '⚡', name: 'POWER PLANT', stage: 2, pts: 3000 }, water: { icon: '💧', name: 'WATER STATION', stage: 2, pts: 2500 },
  cemetery: { icon: '🪦', name: 'GRAVEYARD', stage: 1, pts: 1500 }, weather: { icon: '📡', name: 'WEATHER STATION', stage: 1, pts: 2000 }, firestation: { icon: '🚒', name: 'FIRE STATION', stage: 1, pts: 2200 },
  police: { icon: '🚓', name: 'POLICE STATION', stage: 2, pts: 2200 }, sewage: { icon: '💩', name: 'SEWAGE PLANT', stage: 2, pts: 2200 }, radio: { icon: '📻', name: 'RADIO TOWER', stage: 3, pts: 3500 },
  nuclear: { icon: '☢️', name: 'NUCLEAR PLANT', stage: 3, pts: 8000 } };
const EXTRA_POIS = ['cemetery', 'weather', 'firestation', 'police', 'sewage', 'radio'];

// ---------- world (the same towns as Tornado Alley) ----------
let cols, rows, maze, city, buildings = [], people = [], cars = [], pois = {}, massTarget = 1, totalB = 1;
let roadCells = [], drivers = [], soldiers = [], tanks = [], shots = [];
function makeTank() {
  const g = new THREE.Group(); const olive = new THREE.MeshLambertMaterial({ color: 0x4a5a32 }), dark = new THREE.MeshLambertMaterial({ color: 0x2a3020 });
  const part = (geo, mat, sx, sy, sz, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m; };
  const bx = new THREE.BoxGeometry(1, 1, 1); part(bx, dark, 0.95, 0.28, 1.5, 0, 0.16, 0); part(bx, olive, 0.85, 0.3, 1.3, 0, 0.42, 0);
  const turret = new THREE.Group(); turret.position.set(0, 0.62, -0.05); g.add(turret); part(bx, olive, 0.55, 0.24, 0.6, 0, 0, 0, turret); part(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), dark, 1, 0.8, 1, 0, 0.02, 0.62, turret).rotation.x = Math.PI / 2;
  g.userData.turret = turret; return g;
}
function roadPathTo(cell, wx, wz, away) {
  let target = toCell(wx, wz, cols, rows); if (away) { let best = null, bd = -1; for (let k = 0; k < 12; k++) { const c = roadCells[(Math.random() * roadCells.length) | 0]; const w = toWorld(c[0], c[1], cols, rows); const d = Math.hypot(w.x - wx, w.z - wz); if (d > bd) { bd = d; best = c; } } target = { cx: best[0], cy: best[1] }; }
  if (maze[target.cy]?.[target.cx] !== false) { let best = null, bd = 1e9; for (const c of roadCells) { const d = Math.abs(c[0] - target.cx) + Math.abs(c[1] - target.cy); if (d < bd) { bd = d; best = c; } } target = { cx: best[0], cy: best[1] }; }
  return findPath(maze, { cx: cell[0], cy: cell[1] }, target).slice(0, 14);
}
function followPath(o, speed, dt) {
  if (!o.path.length) return false; const [cx, cy] = o.path[0]; const w = toWorld(cx, cy, cols, rows); const g = o.g; const dx = w.x - g.position.x, dz = w.z - g.position.z, d = Math.hypot(dx, dz);
  if (d < 0.25) { o.cell = o.path.shift(); return true; } const st = Math.min(d, speed * dt); g.position.x += dx / d * st; g.position.z += dz / d * st; const want = Math.atan2(dx, dz); let dr = want - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 8); return true;
}
const tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 0.5), tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe27a }), shellGeo = new THREE.SphereGeometry(0.12, 8, 6), shellMat = new THREE.MeshBasicMaterial({ color: 0xffb04a });
function fireAt(from, big) {
  // the army aims at the monster; this time it hurts
  const to = me.g.position.clone().setY(0.6 + Math.random() * 2 * meScale); const dir = to.clone().sub(from); const Ld = dir.length(); dir.normalize();
  const m = new THREE.Mesh(big ? shellGeo : tracerGeo, big ? shellMat : tracerMat); m.position.copy(from); m.lookAt(to); scene.add(m);
  shots.push({ m, vel: dir.multiplyScalar(big ? 16 : 28), life: Ld / (big ? 16 : 28), big }); fx.puff('flame', from, big ? 0.6 : 0.25); if (big) sfx.boom(); else if (Math.random() < 0.3) sfx.throw();
}
function buildWorld() {
  if (city) { scene.remove(city.group); twisters.clear(); fx.clear(); for (const p of people) scene.remove(p); }
  cols = rows = L().size; const seed = (Math.random() * 1e6) | 0; const rng = mulberry32(seed); const big = cols / 21; forceSeason('none');
  maze = generateMaze(cols, rows, Math.floor(cols * rows * 0.12), rng);
  const mid = (cols - 1) / 2; for (let i = 1; i < cols - 1; i++) { maze[mid][i] = false; maze[i][mid] = false; } maze.avenues = { row: mid, col: mid };
  if (cols >= 33) for (const q of [Math.round((cols - 1) / 4) | 1, Math.round((cols - 1) * 3 / 4) | 1]) for (let i = 1; i < cols - 1; i++) { maze[q][i] = false; maze[i][q] = false; }
  const farFromMid = (x, y) => Math.abs(x - mid) + Math.abs(y - mid) > cols * 0.3;
  let fy = rows - 4, fx0 = mid - 1; for (let k = 0; k < 60; k++) { const y = 3 + ((rng() * (rows - 7)) | 0), x = 2 + ((rng() * (cols - 7)) | 0); if (farFromMid(x + 1, y)) { fy = y; fx0 = x; break; } }
  for (let x = fx0; x <= fx0 + 2; x++) maze[fy][x] = true; for (let x = fx0 - 1; x <= fx0 + 3; x++) maze[fy + 1][x] = false;
  const near = (tx, ty) => { let best = null, bd = 1e9; for (let y = 2; y < rows - 2; y++) for (let x = 2; x < cols - 2; x++) { if (!maze[y][x] || (y === fy && x >= fx0 && x <= fx0 + 2)) continue; if (!(maze[y - 1][x] === false || maze[y + 1][x] === false || maze[y][x - 1] === false || maze[y][x + 1] === false)) continue; const d = Math.abs(x - tx) + Math.abs(y - ty); if (d < bd) { bd = d; best = [x, y]; } } return best; };
  const extra = EXTRA_POIS.slice(); for (let i = extra.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [extra[i], extra[j]] = [extra[j], extra[i]]; }
  const want = ['power', 'water', ...(level >= 4 ? ['nuclear'] : []), ...extra].slice(0, L().pois - 1);
  const taken = [[fx0 + 1, fy]], cells = new Set([fy * cols + fx0, fy * cols + fx0 + 1, fy * cols + fx0 + 2]);
  const forced = new Map([[fy * cols + fx0, 'ferris'], [fy * cols + fx0 + 1, 'coaster'], [fy * cols + fx0 + 2, 'carousel']]);
  for (const k of want) { let at = null; for (let sep = cols * 0.35; !at && sep >= 2; sep *= 0.8) for (let t = 0; t < 60 && !at; t++) { const x = 2 + ((rng() * (cols - 4)) | 0), y = 2 + ((rng() * (rows - 4)) | 0); if (Math.abs(x - mid) + Math.abs(y - mid) <= cols * 0.2) continue; const n = near(x, y); if (n && !cells.has(n[1] * cols + n[0]) && taken.every(([ax, ay]) => Math.abs(ax - n[0]) + Math.abs(ay - n[1]) > sep)) at = n; }
    if (!at) continue; taken.push(at); cells.add(at[1] * cols + at[0]); forced.set(at[1] * cols + at[0], k); }
  maze.forcedLandmarks = forced;
  twisters.setBounds(toWorld(cols - 1, rows - 1, cols, rows));
  hemi.intensity = 1.75; sun.intensity = 0.95; city = buildCity(scene, maze, 3 + (seed % 9973)); city.season.light(hemi, sun, scene); city.detail.clouds.visible = false; city.detail.clouds.material.opacity = 0;
  pois = {}; for (const hz of city.hazards) { const k = ['ferris', 'coaster', 'carousel'].includes(hz.type) ? 'fair' : POI[hz.type] ? hz.type : null; if (k) (pois[k] = pois[k] || { hz: [], done: false }).hz.push(hz); }
  for (const k in pois) { const c = new THREE.Vector3(); for (const hz of pois[k].hz) c.add(hz.pos); pois[k].center = c.divideScalar(Math.max(1, pois[k].hz.length)); pois[k].reach = k === 'fair' ? 4.2 : 1.6; }
  buildings = city.buildings.map((b) => { const obj = b.parent !== city.group ? b.parent : b; const wp = b.getWorldPosition(new THREE.Vector3()); const h = b.userData.h || 2; return { b, obj, pos: wp, h, pts: Math.round((obj === b ? 70 : 55) * h), done: false }; });
  totalB = buildings.length;
  { const anim = new Set(city.season.anim.map((a) => a.m)); for (const x of buildings) { if (x.obj !== x.b) mergeStatic(x.obj, x.obj.children.filter((m) => !anim.has(m)));
    else { const ex = x.b.userData.extras || []; const map = mergeStatic(city.group, ex.filter((m) => !anim.has(m))); if (map.size) { const o = []; for (const e of ex) { const m = map.get(e) || e; if (!o.includes(m)) o.push(m); } x.b.userData.extras = o; } } } }
  freezeCity();
  people = []; const roads = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (!maze[y][x]) roads.push([x, y]);
  const groups = Math.min(120, Math.round(70 * Math.pow(big, 1.3)));
  for (let g = 0; g < groups; g++) { const [x, y] = roads[(rng() * roads.length) | 0]; const w = toWorld(x, y, cols, rows); if (Math.hypot(w.x, w.z) < 5) continue; const n = 2 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) { const c = makeCharacter(['worker', 'pink', 'plaid', 'hivis', 'suit', 'hoodie', 'punk', 'vest'][(rng() * 8) | 0], { skin: equippedSkin('npc') }); c.scale.setScalar(0.25); c.position.set(w.x + (rng() - 0.5) * 1.6, 0, w.z + (rng() - 0.5) * 1.6); c.rotation.y = rng() * 6.28; c.userData.home = c.position.clone(); c.userData.goal = null; c.userData.wait = rng() * 3; scene.add(c); people.push(c); } }
  cars = city.cars.slice();
  roadCells = roads; for (const o of [...drivers, ...soldiers, ...tanks]) scene.remove(o.g || o); drivers = []; soldiers = []; tanks = []; for (const s of shots) scene.remove(s.m); shots = [];
  const farRoad = (min) => { for (let k = 0; k < 60; k++) { const [x, y] = roads[(rng() * roads.length) | 0]; const w = toWorld(x, y, cols, rows); if (Math.hypot(w.x, w.z) > min) return [x, y]; } return roads[0]; };
  for (let i = 0; i < 9 + 3 * (level - 1); i++) { const [x, y] = farRoad(5); const c = makeCar(...skinnedCarArgs([0xc23b3b, 0x4f8fd6, 0xe8d54a, 0xd8dde0, 0x3a8a5a][(rng() * 5) | 0])); c.scale.setScalar(0.8); const w = toWorld(x, y, cols, rows); c.position.set(w.x, 0, w.z); scene.add(c); drivers.push({ g: c, cell: [x, y], path: [], speed: 3 + rng() * 1.5 }); }
  for (let sq = 0; sq < 4 + 2 * (level - 1); sq++) { const [x, y] = farRoad(14); const w = toWorld(x, y, cols, rows); for (let i = 0; i < 3; i++) { const s = makeCharacter('vest', { skin: CHAR_SKINS.hunter }); s.scale.setScalar(0.25); s.position.set(w.x + (i - 1) * 0.5, 0, w.z + (rng() - 0.5) * 0.6); const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.6), new THREE.MeshLambertMaterial({ color: 0x22262a })); gun.position.set(0, -0.72, 0.25); s.userData.armR.add(gun); s.userData.cd = 1 + rng() * 2; scene.add(s); soldiers.push(s); } }
  for (let i = 0; i < 2 + (level - 1); i++) { const [x, y] = farRoad(18); const t = makeTank(); const w = toWorld(x, y, cols, rows); t.position.set(w.x, 0, w.z); scene.add(t); tanks.push({ g: t, cell: [x, y], path: [], cd: 3 + rng() * 2, repath: 0 }); }
  massTarget = buildings.reduce((s, x) => s + x.h, 0) * 0.3 * Math.sqrt(1 / big) + 40;
}

// ---------- the same frame-cost tricks as Tornado Alley: the static town in frozen chunks, switched off out of view ----------
const CHUNK = 4, noop = () => {}; let chunks = [];
function freezeCity() {
  const cg = city.group; cg.updateMatrixWorld(true); const keep = new Set();
  const mark = (o) => { while (o && o.parent && o.parent !== cg) o = o.parent; if (o && o.parent === cg) keep.add(o); };
  for (const r of rides) for (const o of [r.wheel, r.platform, ...(r.cars || [])]) if (o) mark(o); for (const s of spinners) mark(s.obj);
  const map = new Map(), bb = new THREE.Box3(), sz = new THREE.Vector3(), ctr = new THREE.Vector3(), span = CHUNK * CELL, ox = cols * CELL / 2, oz = rows * CELL / 2;
  for (const o of cg.children.slice()) { if (keep.has(o) || o.isLight || o.isPoints) continue; bb.setFromObject(o); if (bb.isEmpty()) { if (!o.isLine) continue; o.getWorldPosition(ctr); bb.setFromCenterAndSize(ctr, sz.set(0.1, 0.1, 0.1)); }
    bb.getSize(sz); if (Math.max(sz.x, sz.z) > span * 1.5) continue; bb.getCenter(ctr);
    const key = Math.floor((ctr.x + ox) / span) + ',' + Math.floor((ctr.z + oz) / span); let ch = map.get(key); if (!ch) { ch = new THREE.Group(); ch.isChunk = true; ch.box = new THREE.Box3(); map.set(key, ch); cg.add(ch); } ch.add(o); ch.box.union(bb); }
  chunks = [...map.values()]; for (const ch of chunks) { ch.box.expandByScalar(0.5); ch.updateMatrixWorld(true); ch.updateMatrixWorld = noop; }
}
function free(o) { if (o && o.parent && o.parent.isChunk) city.group.attach(o); }
function freeKnocked() { for (const pr of city.props) if (pr.knocked && pr.g.parent && pr.g.parent.isChunk) free(pr.g); }
const frus = new THREE.Frustum(), projM = new THREE.Matrix4();
// ?cine=side: a trailer camera, low and beside the monster, slowly circling, with the HUD hidden
const CINE = new URLSearchParams(location.search).get('cine'); if (CINE) document.body.classList.add('cine'); const cineCam = new THREE.PerspectiveCamera(46, 1, 0.1, 400), cineTo = new THREE.Vector3(), cineAt = new THREE.Vector3(), cineLook = new THREE.Vector3();
const viewCam = () => (CINE ? cineCam : cam);
function cullChunks() { const vc = viewCam(); vc.updateMatrixWorld(); projM.multiplyMatrices(vc.projectionMatrix, vc.matrixWorldInverse); frus.setFromProjectionMatrix(projM); for (const ch of chunks) ch.visible = frus.intersectsBox(ch.box); }

// ---------- you ----------
let me = null, mass = 0, meF = 0.15, meScale = 1.5, stage = 1, topStage = 1, power = 0, slowT = 0, boostT = 0, meleeCd = 0, leap = null, faceY = 0;
function makeMe() { if (me) scene.remove(me.g); me = buildKaiju(pick, !!getEquipped()['kj_' + pick]); me.g.position.set(0, 0, 0); scene.add(me.g); mass = massTarget * 0.25; meF = 0.25; meScale = scaleOf(meF); me.g.scale.setScalar(meScale); stage = 1; topStage = 1; power = 0.4; leap = null; }
const reach = () => 0.55 + meScale * 0.5; // how far your stomps and jaws reach
function grow(m) { if (m > 0) m *= [1, 1.5, 1.2, 1][stage]; mass = Math.min(massTarget, mass + m); } // a hatchling grows fast
const ARMY_DMG = [0, 0.4, 0.75, 1]; // army damage by stage: small kaiju get off lightly
function hurt(pct, from) {
  if (state !== 'play' || !me || megaT > 0) return; mass -= massTarget * pct / 100; hurtT = 0.35; slowT = Math.max(slowT, 0.6);
  if (from && Math.random() < 0.5) popup(me.g.position.clone().setY(meScale * 1.6), '-' + Math.max(1, Math.round(pct)) + '%', '#ff6a5a');
  if (mass <= 0) { mass = 0; die(); }
}
// a tap: walk there, or (Power full) cast this stage's spell at what was tapped
function aimAt(cx, cy) {
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), cam); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return null;
  const lim = toWorld(cols - 1, rows - 1, cols, rows); p.x = Math.max(-lim.x, Math.min(lim.x, p.x)); p.z = Math.max(-lim.z, Math.min(lim.z, p.z));
  // snap to whatever was tapped: a rival, a plane, a tank (screen distance)
  const near = (pos, px) => { const v = pos.clone().project(cam); return Math.hypot((v.x * 0.5 + 0.5) * innerWidth - cx, (-v.y * 0.5 + 0.5) * innerHeight - cy) < px; };
  if (rival && rival.hp > 0 && near(rival.g.position.clone().setY(rival.scale), 70)) return rival.g.position.clone();
  for (const pl of planes) if (pl.life > 0 && near(pl.g.position, 50)) return pl.g.position.clone().setY(0);
  for (const t of tanks) if (near(t.g.position, 40)) return t.g.position.clone();
  return p;
}
let moveTo = null;
function tapAt(cx, cy) {
  const p = aimAt(cx, cy); if (!p) return;
  if (megaT > 0 && !megaUsed) { megaBlast(); return; }
  if (power >= 1 && !leap) { power = 0; const face = Math.atan2(p.x - me.g.position.x, p.z - me.g.position.z); me.g.rotation.y = faceY = face; spells.cast(caster(me, stage), stage, p, {}); popup(me.g.position.clone().setY(meScale * 2), KAIJU[me.id].spells[stage - 1].toUpperCase() + '!', '#7dff3a'); markSeen('kj_cast'); return; }
  moveTo = p;
}
const caster = (k, st) => ({ id: k.id, rig: k, g: k.g, stage: st });

// ---------- what spells and hits do to the world ----------
const spells = createSpells({ scene, fx, sfx, flash: (k) => { flashT = Math.max(flashT, k); }, dark: (s) => { darkT = Math.max(darkT, s); },
  hitArea, grabCar, grabBuilding, leap: (c, to, secs, onLand, h = 4, step = null, hide = false) => { if (c.rig === me) { leap = { from: me.g.position.clone(), to: to.clone(), t: 0, secs, onLand, h, step, hide, stepT: 0 }; if (hide) me.body.visible = false; } else onLand(); } });
const sinking = [];
function crumble(x, label, fire) {
  // a building comes down: its pieces fly, the shell sinks into a cloud of dust
  free(x.obj); x.done = true; bDone++; { const i = city.obstacles.findIndex((o) => Math.abs(o.x - x.pos.x) < 0.3 && Math.abs(o.z - x.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); }
  if (x.b.userData.edges) x.b.userData.edges.visible = false; const loose = x.obj === x.b ? (x.b.userData.extras || []).filter((m) => m.parent) : [];
  const cols3 = []; x.obj.traverse((m) => { if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.color) cols3.push(m.material.color.getHex()); }); if (!cols3.length) cols3.push(0x8a8f96);
  const bits = []; for (let i = 0; i < Math.min(12, 4 + x.h * 2); i++) { const m = new THREE.Mesh(chunkGeo, chunkMat(cols3[(Math.random() * cols3.length) | 0])); const s = 0.2 + Math.random() * 0.4; m.scale.set(s, s * 0.6, s); m.position.set(x.pos.x + (Math.random() - 0.5) * 1.5, Math.random() * x.h, x.pos.z + (Math.random() - 0.5) * 1.5); scene.add(m); bits.push(m); }
  twisters.scatter([...bits, ...loose], x.pos, 3.5); sinking.push({ obj: x.obj, t: 0, h: x.h, y0: x.obj.position.y });
  fx.puff('smoke', new THREE.Vector3(x.pos.x, 0.8, x.pos.z), 1.2 + x.h * 0.15); if (fire) fx.ignite(new THREE.Vector3(x.pos.x, 0.5, x.pos.z), 0.9, 5);
  spill(x.pos, Math.min(6, 2 + Math.floor(x.h * 0.7))); award(x.pts, x.pos, label); grow(x.h * 0.35); power = Math.min(1, power + 0.025); if (x.h > 5) { sfx.boom(); flashT = Math.max(flashT, 0.1); } else if (Math.random() < 0.5) sfx.hit();
}
const chunkGeo = new THREE.BoxGeometry(1, 1, 1), chunkMats = new Map(); const chunkMat = (c) => { if (!chunkMats.has(c)) chunkMats.set(c, new THREE.MeshLambertMaterial({ color: c })); return chunkMats.get(c); };
function eat(c, i, bonus) { people.splice(i, 1); peopleN++; gulps.push({ c, t: 0, from: c.position.clone() }); award(bonus || 25, c.position); grow(1.2); power = Math.min(1, power + 0.01); }
const gulps = []; // people on their way into the kaiju's mouth
// eaten people go back in a pool and come out of the next building that falls, so spilling crowds costs nothing to build
const pool = [], OUTFITS = ['worker', 'pink', 'plaid', 'hivis', 'suit', 'hoodie', 'punk', 'vest'];
function spill(at, n) {
  if (people.length > 420) return; let made = 0;
  for (let i = 0; i < n; i++) { let c = pool.pop(); if (!c) { if (made >= 3) break; c = makeCharacter(OUTFITS[(Math.random() * 8) | 0], { skin: equippedSkin('npc') }); made++; }
    c.scale.setScalar(0.25); c.rotation.set(0, Math.random() * 6.28, 0); const a = Math.random() * 6.28, r = 0.6 + Math.random() * 1.4; c.position.set(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r);
    Object.assign(c.userData, { home: c.position.clone(), goal: null, wait: Math.random(), frz: false }); delete c.updateMatrixWorld; scene.add(c); people.push(c); }
}
function blowCar(g, q) { free(g); twisters.scatter([g], q, 6); fx.explode(q.clone().setY(0.4), 1); fx.ignite(q.clone().setY(0.2), 0.7, 5); carsN++; award(80, q, 'BOOM'); grow(0.5); }
function hitArea(c, r, pow, o = {}) {
  if (o.hostile) { if (me && Math.hypot(me.g.position.x - c.x, me.g.position.z - c.z) < r + reach() * 0.6) hurt(pow * 0.13, true); return; }
  const cap = megaT > 0 || o.mega ? 99 : MAX_H[Math.min(3, stage + 1)];
  for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - c.x, x.pos.z - c.z); if (d > r) continue; if (x.h <= cap) crumble(x, o.freeze ? 'SHATTERED' : '', o.fire); else if (o.fire) fx.ignite(new THREE.Vector3(x.pos.x, 1, x.pos.z), 0.8, 4); }
  for (let i = people.length - 1; i >= 0; i--) { const p = people[i]; if (Math.hypot(p.position.x - c.x, p.position.z - c.z) < r) { people.splice(i, 1); peopleN++; award(20, p.position); grow(0.5); if (o.push) twisters.scatter([p], c, 6); else { scene.remove(p); fx.puff(o.freeze ? 'smoke' : 'flame', p.position.clone().setY(0.3), 0.4); } } }
  for (let i = drivers.length - 1; i >= 0; i--) { const q = drivers[i].g.position; if (Math.hypot(q.x - c.x, q.z - c.z) < r + 0.5) { const g = drivers[i].g; drivers.splice(i, 1); blowCar(g, q.clone()); } }
  for (let i = cars.length - 1; i >= 0; i--) { const q = cars[i].getWorldPosition(new THREE.Vector3()); if (Math.hypot(q.x - c.x, q.z - c.z) < r + 0.5) { const g = cars[i]; cars.splice(i, 1); blowCar(g, q); } }
  for (let i = soldiers.length - 1; i >= 0; i--) { const s = soldiers[i]; if (Math.hypot(s.position.x - c.x, s.position.z - c.z) < r) { soldiers.splice(i, 1); delete s.updateMatrixWorld; twisters.scatter([s], c, 5); award(40, s.position, 'SOLDIER'); grow(0.6); } }
  for (let i = tanks.length - 1; i >= 0; i--) { const t = tanks[i]; if (Math.hypot(t.g.position.x - c.x, t.g.position.z - c.z) < r + 0.6) { tanks.splice(i, 1); twisters.scatter([t.g], c, 4); fx.explode(t.g.position.clone(), 1); award(250, t.g.position, 'TANK'); grow(1.5); } }
  for (const pl of planes) if (pl.life > 0 && Math.hypot(pl.g.position.x - c.x, pl.g.position.z - c.z) < r + 1.6) downPlane(pl);
  if (rival && rival.hp > 0 && Math.hypot(rival.g.position.x - c.x, rival.g.position.z - c.z) < r + rival.scale * 0.6) { if (!o.hitRival || !o.hitRival.has(rival)) { o.hitRival = o.hitRival || new Set(); o.hitRival.add(rival); hitRival(pow, o.freeze); } }
  if (city.knock(c.x, c.z, r, 0, 0)) freeKnocked();
}
function grabCar(at) { let best = null, bd = 12, bi = -1, list = null; for (let i = 0; i < drivers.length; i++) { const d = drivers[i].g.position.distanceTo(at); if (d < bd) { bd = d; best = drivers[i].g; bi = i; list = drivers; } } for (let i = 0; i < cars.length; i++) { const d = cars[i].getWorldPosition(new THREE.Vector3()).distanceTo(at); if (d < bd) { bd = d; best = cars[i]; bi = i; list = cars; } }
  if (!best) return null; list.splice(bi, 1); free(best); scene.attach(best); carsN++; return best; }
function grabBuilding(at) { let best = null, bd = 14; for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - at.x, x.pos.z - at.z); if (d < bd) { bd = d; best = x; } } if (!best) return null;
  free(best.obj); best.done = true; bDone++; { const i = city.obstacles.findIndex((o) => Math.abs(o.x - best.pos.x) < 0.3 && Math.abs(o.z - best.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); } if (best.b.userData.edges) best.b.userData.edges.visible = false;
  award(best.pts, best.pos, 'RIPPED UP'); grow(best.h * 0.35); scene.attach(best.obj); return best.obj; }

// ---------- score, popups, banners ----------
let score = 0, chain = 0, lastHit = -9, tLeft = 150, played = 0, peopleN = 0, carsN = 0, bDone = 0, tooBigT = 0, ko = 0;
const mult = () => Math.min(5, 1 + Math.floor(chain / 4));
function award(base, pos, label) { if (played - lastHit < 2.5) chain++; else chain = 0; lastHit = played; const pts = Math.round(base * mult()); score += pts; popup(pos, '+' + pts + (label ? ' ' + label : ''), mult() > 1 ? '#ff9a3a' : '#ffe27a'); return pts; }
const pops = []; for (let i = 0; i < 14; i++) { const el = document.createElement('div'); el.className = 'pop'; el.style.display = 'none'; document.body.appendChild(el); pops.push({ el, t: 0, p: new THREE.Vector3() }); }
let popI = 0; function popup(pos, text, color) { const o = pops[popI++ % pops.length]; o.t = 1; o.p.set(pos.x, (pos.y || 0) + 1.5, pos.z); o.el.textContent = text; o.el.style.color = color; o.el.style.display = 'block'; }
function updatePops(dt) { for (const o of pops) { if (o.t <= 0) continue; o.t -= dt * 0.9; o.p.y += dt * 1.6; const v = o.p.clone().project(cam); o.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%)'; o.el.style.opacity = Math.min(1, o.t * 2); if (o.t <= 0) o.el.style.display = 'none'; } }
let bannerT = 0; function banner(text) { $('taBanner').textContent = text; $('taBanner').style.opacity = 1; bannerT = 2.2; }

// ---------- napalm planes: they hunt you and carpet the street with fire ----------
let planes = [], planeT = 35, noPlanes = false; const bombs = [], fires = [];
const bombGeo = new THREE.SphereGeometry(0.16, 8, 6), bombMat = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });
function spawnPlane() {
  const lim = toWorld(cols - 1, rows - 1, cols, rows); const a = Math.random() * Math.PI * 2, R0 = Math.max(lim.x, lim.z) + 8;
  const g = makePlane(); g.position.set(Math.cos(a) * R0, 7 + Math.random(), Math.sin(a) * R0); scene.add(g);
  g.traverse((m) => { if (m.isMesh && m.material.color && m.material.color.getHex() === 0xf07a28) m.material = m.material.clone(), m.material.color.setHex(0x8a2a1a); }); // dark red: these ones drop napalm
  const arrow = document.createElement('div'); arrow.className = 'planeArrow'; arrow.textContent = '✈'; document.body.appendChild(arrow);
  planes.push({ g, arrow, heading: Math.atan2(-g.position.x, -g.position.z), life: 28, cool: 0, dropT: 0 }); banner('✈ NAPALM PLANE!'); sfx.whoosh(); tip('kj_plane', '✈ Napalm plane! It drops fire that burns you. Walk out of the fire, or zap it with a spell.');
}
function downPlane(pl) { pl.life = -1; pl.dead = true; fx.explode(pl.g.position.clone(), 1.2); award(500, pl.g.position, 'PLANE DOWN'); grow(2); twisters.scatter([pl.g], pl.g.position.clone(), 5); pl.arrow.remove(); sfx.boom(); }
function updatePlanes(dt, px, pz) {
  planeT -= dt; const maxUp = 1 + Math.floor((level - 1) / 2); if (!noPlanes && planeT <= 0) { planeT = Math.max(18, 32 - 3 * (level - 1)) + Math.random() * 8; if (planes.length < maxUp) spawnPlane(); }
  let nd = Infinity;
  for (let i = planes.length - 1; i >= 0; i--) { const pl = planes[i], g = pl.g; if (pl.dead) { planes.splice(i, 1); continue; } pl.life -= dt;
    const dx = px - g.position.x, dz = pz - g.position.z, d = Math.hypot(dx, dz); nd = Math.min(nd, d);
    pl.cool -= dt; if (d < 7) pl.near = true; else if (pl.near) { pl.near = false; pl.cool = 6; }
    if (pl.life > 0 && pl.cool <= 0) { const want = Math.atan2(dx, dz); let dr = want - pl.heading; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); pl.heading += Math.max(-1, Math.min(1, dr)) * (0.6 + 0.08 * level) * dt; }
    g.position.x += Math.sin(pl.heading) * (6 + 0.5 * level) * dt; g.position.z += Math.cos(pl.heading) * (6 + 0.5 * level) * dt; g.rotation.set(0, pl.heading, 0); for (const p of g.userData.props) p.rotation.z += dt * 40;
    // napalm: a string of bombs along its path while it's over you
    pl.dropT -= dt; if (pl.life > 0 && pl.cool <= 0 && d < 7 && pl.dropT <= 0) { pl.dropT = 0.22; const m = new THREE.Mesh(bombGeo, bombMat); m.position.copy(g.position).y -= 0.4; scene.add(m); bombs.push({ m, vy: 0 }); }
    // a colossus swats planes out of the sky
    if (stage === 3 && d < reach() + 1.6 && g.position.y < meScale * 2.4) { me.act('hit'); downPlane(pl); continue; }
    edgeArrow(pl.arrow, g.position, pl.life > 0);
    if (pl.life <= 0 && Math.hypot(g.position.x, g.position.z) > Math.max(cols, rows) * CELL * 0.75) { scene.remove(g); pl.arrow.remove(); planes.splice(i, 1); } }
  setPlaneEngine(nd === Infinity ? 0 : Math.pow(Math.max(0, 1 - (nd - 3) / 34), 1.6), 1);
  for (let i = bombs.length - 1; i >= 0; i--) { const b = bombs[i]; b.vy -= 14 * dt; b.m.position.y += b.vy * dt; if (b.m.position.y <= 0.1) { scene.remove(b.m); bombs.splice(i, 1); const at = b.m.position.clone().setY(0); fx.explode(at.clone().setY(0.4), 0.7); fx.ignite(at.clone().setY(0.1), 0.9, 5); const ring = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.35, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.copy(at).setY(0.08); scene.add(ring); fires.push({ at, t: 5, ring }); } }
  // standing in the napalm hurts
  let burning = false; for (let i = fires.length - 1; i >= 0; i--) { const f = fires[i]; f.t -= dt; f.ring.material.opacity = 0.35 * Math.min(1, f.t); if (f.t <= 0) { scene.remove(f.ring); fires.splice(i, 1); continue; } if (Math.hypot(f.at.x - px, f.at.z - pz) < 1.5 + reach() * 0.4) burning = true; }
  if (burning) { hurt(3.2 * ARMY_DMG[stage] * dt); if (Math.random() < dt * 3) popup(me.g.position.clone().setY(meScale), 'BURNING!', '#ff7a3a'); }
}
function edgeArrow(el, pos, show) { const v = pos.clone().project(cam); const off = Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95; el.style.display = show && off ? 'block' : 'none'; if (!off) return v;
  const a = Math.atan2(v.y, v.x), k = 0.9 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); el.style.transform = 'translate(' + ((Math.cos(a) * k * 0.5 + 0.5) * innerWidth) + 'px,' + ((-Math.sin(a) * k * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%)'; const dir = el.firstElementChild; if (dir && dir.tagName === 'I') dir.style.transform = 'rotate(' + (-a) + 'rad)'; return v; }

// ---------- rival kaiju: two come for you at each stage you reach ----------
let rival = null, rivalQueue = [], rivalWait = 0; const rivalEl = $('kjRival'), rivalArrow = document.createElement('div'); rivalArrow.className = 'planeArrow rivalArrow'; rivalArrow.innerHTML = '<i>➤</i><em>👹</em>'; document.body.appendChild(rivalArrow);
function queueRivals(st) { rivalQueue.push(18, 40); } // seconds after reaching the stage
function spawnRival() {
  const pool = KAIJU_IDS.filter((x) => x !== me.id); const id = pool[(Math.random() * pool.length) | 0]; const st = Math.min(3, stage + (Math.random() < 0.3 ? 1 : 0));
  const rig = buildKaiju(id); const f = (st - 0.5) / 3, sc = scaleOf(f); rig.g.scale.setScalar(sc);
  const far = []; for (const c of roadCells) { const w = toWorld(c[0], c[1], cols, rows); const d = Math.hypot(w.x - me.g.position.x, w.z - me.g.position.z); if (d > 20 && d < 34) far.push(w); }
  const w = far.length ? far[(Math.random() * far.length) | 0] : toWorld(1, 1, cols, rows); rig.g.position.set(w.x, 0, w.z); scene.add(rig.g);
  rival = { id, rig, g: rig.g, stage: st, scale: sc, hp: 45 + 55 * st, max: 45 + 55 * st, cd: 1.5, castT: 6 + Math.random() * 3, stun: 0, koT: 0 };
  $('kjRivalName').textContent = KAIJU[id].name + ' · ' + STAGE[st]; rivalEl.classList.remove('hidden'); banner('👹 RIVAL: ' + KAIJU[id].name + '!'); sfx.wave(); tip('kj_rival', '👹 A rival kaiju! Walk up and your kaiju fights it on its own. Spells hit it hard. KO it and eat it for a big boost.');
}
function hitRival(pow, freeze) { if (!rival || rival.hp <= 0) return; rival.hp -= pow; rival.rig.act('hit'); if (freeze) rival.stun = 2.5; popup(rival.g.position.clone().setY(rival.scale * 1.8), '-' + Math.round(pow), '#ffb02a'); if (rival.hp <= 0) rivalKO(); }
function rivalKO() {
  const r = rival; r.hp = 0; r.koT = 2.2; r.rig.act('ko'); ko++; award(2500 * r.stage, r.g.position, 'K.O.!'); sfx.boom(); flashT = 0.3; mini = null; miniEl.className = 'hidden';
  // ...and then you eat it: a monster meal is a big boost (size, full Power, a burst of speed)
  setTimeout(() => { if (state !== 'play') return; grow(massTarget * (0.16 + 0.06 * r.stage)); power = 1; boostT = 5; me.act('cast'); banner('MONSTER MEAL!'); popup(me.g.position.clone().setY(meScale * 2), '+SIZE +POWER', '#7dff3a'); sfx.pickup(); }, 1300);
  banner('K.O.!'); stormBoost(2);
}
const unlockedNow = [];

// ---------- MEGA KAIJU: now and then a glowing booster drops somewhere nearby. Grab it and for 10 seconds you are bigger
// than a Colossus, smash anything, take no damage, and get one MEGA spell: tap and it goes off around you (a nuke for
// the atomic monsters and the machines, a huge sonic roar for the rest). Not used by the end? It goes off anyway. ----------
const MEGA_SECS = 10;
let megaT = 0, megaUsed = false, megaDrop = null, megaDropT = 30; const blasts = [];
const megaArrow = document.createElement('div'); megaArrow.className = 'planeArrow megaArrow'; megaArrow.innerHTML = '<i>➤</i><em>⚡</em>'; document.body.appendChild(megaArrow);
const megaEl = document.createElement('div'); megaEl.id = 'kjMega'; megaEl.className = 'hidden'; document.body.appendChild(megaEl);
const NUKERS = new Set(['godzilly', 'mecha', 'mechax', 'destroyah', 'spaceyzilla', 'smogorah', 'megalawn']);
const megaKind = (id) => (id === 'soundwavy' ? 'wave' : KAIJU[id].kind === 'robot' || NUKERS.has(id) ? 'nuke' : 'wave');
function dropMega() {
  const spots = []; for (const cc of roadCells) { const w = toWorld(cc[0], cc[1], cols, rows); const d = Math.hypot(w.x - me.g.position.x, w.z - me.g.position.z); if (d > 10 && d < 24) spots.push(w); } if (!spots.length) return;
  const w = spots[(Math.random() * spots.length) | 0], g = new THREE.Group(); g.position.set(w.x, 0, w.z);
  const glowM = (col, o) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0xffd21a })); orb.position.y = 2; g.add(orb);
  const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), glowM(0xffb02a, 0.35)); halo.position.y = 2; g.add(halo);
  const rings = [0, 1].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 0.4, 0.08, 6, 32), glowM(0xfff27a, 0.8)); r.position.y = 2; g.add(r); return r; });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 40, 12, 1, true), glowM(0xffd21a, 0.18)); beam.position.y = 20; g.add(beam);
  const pad = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), glowM(0xffd21a, 0.6)); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.1; g.add(pad);
  scene.add(g); megaDrop = { g, orb, halo, rings, life: 25 }; banner('⚡ MEGA BOOSTER DROPPED!'); sfx.pickup(); popup(g.position.clone().setY(4), 'MEGA BOOSTER!', '#ffd21a');
}
function updateMega(dt) {
  if (megaDrop) { const D = megaDrop; D.life -= dt; const t = played; D.orb.rotation.y += dt * 2; D.orb.position.y = D.halo.position.y = 2 + Math.sin(t * 3) * 0.3; D.rings[0].rotation.set(t * 1.7, t, 0); D.rings[1].rotation.set(-t, t * 1.3, 0.5); D.halo.scale.setScalar(1 + Math.sin(t * 6) * 0.1);
    edgeArrow(megaArrow, D.g.position, true);
    if (Math.hypot(D.g.position.x - me.g.position.x, D.g.position.z - me.g.position.z) < reach() + 1.6) { scene.remove(D.g); megaDrop = null; megaArrow.style.display = 'none'; goMega(); }
    else if (D.life <= 0) { scene.remove(D.g); megaDrop = null; megaArrow.style.display = 'none'; megaDropT = 40 + Math.random() * 30; } }
  else if (megaT <= 0 && !mini) { megaDropT -= dt; if (megaDropT <= 0) dropMega(); }
  if (megaT > 0) { megaT -= dt; if (Math.random() < dt * 14) fx.puff('flame', me.g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * meScale, 0.3, (Math.random() - 0.5) * meScale)), 0.8);
    megaEl.textContent = '⚡ MEGA ' + KAIJU[me.id].name + ' · ' + Math.ceil(megaT) + 's' + (megaUsed ? '' : ' · TAP FOR MEGA ' + (megaKind(me.id) === 'nuke' ? 'NUKE' : 'ROAR') + '!');
    if (megaT <= 0) { if (!megaUsed) megaBlast(); megaT = 0; megaEl.className = 'hidden'; banner('MEGA OVER'); megaDropT = 50 + Math.random() * 30; } }
  for (let i = blasts.length - 1; i >= 0; i--) if (!blasts[i].update(dt)) blasts.splice(i, 1);
}
function goMega() { megaT = MEGA_SECS; megaUsed = false; power = 1; boostT = MEGA_SECS; megaEl.className = ''; banner('⚡ MEGA ' + KAIJU[me.id].name + '!'); me.act('cast'); sfx.boom(); flashT = 0.35; stormBoost(3); }
function megaBlast() {
  megaUsed = true; const at = me.g.position.clone().setY(0), kind = megaKind(me.id), R = 18 + meScale * 1.2, o = {};
  banner(kind === 'nuke' ? '☢️ MEGA NUKE!' : '🔊 MEGA ROAR!'); me.act('cast'); flashT = kind === 'nuke' ? 1.2 : 0.5; sfx.boom(); setTimeout(() => sfx.boom(), 200); setTimeout(() => sfx.boom(), 450);
  let done = 0; blasts.push(nukeBlast(scene, at, R, { kind, color: me.tint ?? null, secs: kind === 'nuke' ? 1.6 : 1.1, onRadius: (r) => { if (r - done < 1.2) return; done = r; hitArea(at, r, 45, o); } }));
}
// each round's prize games hand out monsters: 90% of rounds give at least one, 20% give two (on the first goes; if the
// round has fewer goes, the last go gives the rest). One you already have pays a whole coin
let kjLeft = 0, goesLeft = 0;
function kaijuRound(goes) { const r = Math.random(); kjLeft = r < 0.2 ? 2 : r < 0.9 ? 1 : 0; goesLeft = goes; }
function kaijuPrize() { goesLeft--; if (kjLeft <= 0) return null; const n = goesLeft <= 0 ? kjLeft : 1; kjLeft -= n; const pool = KAIJU_IDS.filter((x) => x !== 'godzilly'); let fresh = false; const txt = [];
  for (let i = 0; i < n; i++) { const id = pool[(Math.random() * pool.length) | 0], name = KAIJU[id].name; if (unlockKaiju(id)) { fresh = true; txt.push('NEW: ' + name + '!'); } else { addCoins(1); txt.push(name + ' (owned): +1 coin'); } }
  if (fresh) drawPicker(); return fresh ? { kind: 'kaiju', text: txt.join('  ') } : { kind: 'dupe', slot: 'kaiju', text: txt.join('  ') }; }
function updateRival(dt, px, pz) {
  if (!rival) { rivalWait -= dt; for (let i = 0; i < rivalQueue.length; i++) rivalQueue[i] -= dt; if (rivalQueue.length && rivalQueue[0] <= 0 && rivalWait <= 0) { rivalQueue.shift(); spawnRival(); } rivalEl.classList.add('hidden'); rivalArrow.style.display = 'none'; return; }
  const r = rival, g = r.g; r.rig.anim(dt, r.koT > 0 ? 0 : r.moving ? 1 : 0.15);
  if (r.koT > 0) { r.koT -= dt; if (r.koT <= 1.0 && me) { const k = Math.min(1, dt * 3); const mth = me.mouth.getWorldPosition(tmp); g.position.lerp(mth, k); g.scale.setScalar(Math.max(0.01, r.scale * (r.koT / 1.0))); } if (r.koT <= 0) { scene.remove(g); fx.puff('smoke', g.position.clone().setY(1), 2.5); rival = null; rivalWait = 6; } rivalEl.classList.add('hidden'); rivalArrow.style.display = 'none'; return; }
  if (r.toss) { const T = r.toss; T.t += dt; const k = Math.min(1, T.t / T.secs); g.position.lerpVectors(T.from, T.to, k); g.position.y = T.from.y * (1 - k) + Math.sin(k * Math.PI) * T.h; g.rotation.x += dt * 8; r.stun = Math.max(r.stun, 0.5); if (Math.random() < dt * 25) fx.puff('smoke', g.position.clone(), 0.5);
    if (k >= 1) { r.toss = null; g.position.y = 0; g.rotation.x = g.rotation.z = 0; r.stun = 1.5; const land = g.position.clone(); hitArea(land, 3.6, 14, {}); fx.explode(land.clone().setY(0.5), 2.4); flashT = 0.3; sfx.boom(); popup(land.clone().setY(r.scale * 2), 'CRASH!', '#ffb02a'); hitRival(30 + 10 * stage); if (!rival || r.hp <= 0) return; } }
  const dx = px - g.position.x, dz = pz - g.position.z, d = Math.hypot(dx, dz) || 0.01, touch = reach() + r.scale * 0.45;
  r.stun -= dt; r.moving = false;
  if (mini) r.stun = Math.max(r.stun, 0.05);
  if (r.stun <= 0) {
    const want = Math.atan2(dx, dz); let dr = want - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 4);
    if (d > touch * 0.9) { const sp = (3.6 + r.scale * 0.4) * KAIJU[r.id].speed * 0.8; g.position.x += dx / d * sp * dt; g.position.z += dz / d * sp * dt; r.moving = true; }
    r.cd -= dt; if (d < touch + 0.3 && r.cd <= 0 && !mini) startMini(r);
    r.roarCd = (r.roarCd ?? 6) - dt; if (!mini && d > 7 && d < 15 && r.roarCd <= 0 && Math.random() < dt * 0.35) startMini(r, 'roar');
    r.castT -= dt; if (r.castT <= 0 && d < 18) { r.castT = 8 + Math.random() * 3; spells.cast(caster(r.rig, r.stage), r.stage, me.g.position.clone(), { hostile: true }); popup(g.position.clone().setY(r.scale * 2), KAIJU[r.id].spells[r.stage - 1].toUpperCase() + '!', '#ff5a5a'); }
  }
  // its health bar floats over its head
  const v = g.position.clone().setY(r.scale * 2.2).project(cam); const on = Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
  rivalEl.classList.toggle('hidden', !on); if (on) { rivalEl.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-100%)'; $('kjRivalFill').style.width = Math.max(0, r.hp / r.max * 100) + '%'; }
  edgeArrow(rivalArrow, g.position, true);
}

// ---------- close combat: mini games ----------
// Up close a fight is one of five mini games, picked at random: BRAWL (mash to win a tug of war), SWIPE COMBO (swipe each
// arrow in time; every miss and the rival hits you), WEAK SPOTS (tap the glowing spots on the rival before they fade),
// DODGE & COUNTER (swipe away from the side it swings from, then tap to hit back) and SPIN & THROW (circle your finger to
// swing it by the tail and hurl it into the town). From across the street a rival can start a ROAR-OFF: hold to build
// your roar and let go in the green.
let mini = null, lastMini = ''; const miniEl = $('kjMini');
const CLOSE = ['brawl', 'swipe', 'spots', 'dodge', 'spin'];
const ARROWS = { L: '⬅', R: '➡', U: '⬆', D: '⬇' };
function startMini(r, type) {
  if (!type) { const pool = CLOSE.filter((x) => x !== lastMini); type = pool[(Math.random() * pool.length) | 0]; } lastMini = type;
  const face = Math.atan2(r.g.position.x - me.g.position.x, r.g.position.z - me.g.position.z); me.g.rotation.y = faceY = face; r.g.rotation.y = face + Math.PI;
  mini = { type, r, t: 0, v: 0 }; const m = mini; $('kjMiniSeq').innerHTML = ''; $('kjMiniSpots').innerHTML = ''; miniEl.dataset.side = '';
  const title = { brawl: '👊 BRAWL! TAP TAP TAP!', swipe: '🌀 SWIPE COMBO! SWIPE THE ARROWS', spots: '🎯 WEAK SPOTS! TAP THEM', dodge: '💨 DODGE! SWIPE AWAY FROM THE HIT', spin: '🌪️ SPIN & THROW! CIRCLE YOUR FINGER', roar: '🦖 ROAR-OFF! HOLD, LET GO IN THE GREEN' }[type];
  $('kjMiniTitle').textContent = title; banner({ brawl: 'BRAWL!', swipe: 'SWIPE COMBO!', spots: 'WEAK SPOTS!', dodge: 'DODGE!', spin: 'SPIN & THROW!', roar: 'ROAR-OFF!' }[type]);
  if (type === 'swipe') { const n = 4 + Math.min(2, r.stage - 1); m.seq = Array.from({ length: n }, () => 'LRU'[(Math.random() * 3) | 0]); m.i = 0; m.tt = 0; m.limit = Math.max(0.8, 1.4 - 0.15 * (r.stage - 1)); m.good = 0;
    $('kjMiniSeq').innerHTML = m.seq.map((d, i) => '<span id="kjA' + i + '">' + ARROWS[d] + '</span>').join(''); }
  if (type === 'spots') { m.spawned = 0; m.total = 8; m.next = 0.2; m.live = []; }
  if (type === 'dodge') { m.round = 0; nextDodge(m); }
  if (type === 'spin') { m.ang = 0; m.last = null; m.spinA = Math.atan2(r.g.position.z - me.g.position.z, r.g.position.x - me.g.position.x); m.lift = 0; r.spun = true; r.rig.shadow.visible = false; me.act('cast'); }
  if (type === 'roar') { m.zone = [0.7, 0.9]; m.hold = false; $('kjMiniZone').style.left = '70%'; $('kjMiniZone').style.width = '20%'; me.act('cast'); r.rig.act('cast'); }
  miniEl.className = 'm-' + type; sfx.wave();
}
function nextDodge(m) { m.round++; m.phase = 'warn'; m.pt = 0; m.side = Math.random() < 0.5 ? 'L' : 'R'; miniEl.dataset.side = m.side; m.r.rig.act('cast'); $('kjMiniSeq').innerHTML = '<span class="on">' + (m.side === 'L' ? 'SWIPE ➡' : '⬅ SWIPE') + '</span>'; }
// gestures on the overlay
let gest = null;
miniEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!mini || state !== 'play') return; gest = { x: e.clientX, y: e.clientY, t: performance.now() }; const m = mini;
  if (m.type === 'brawl') { m.v += 0.12 + 0.025 * (stage - m.r.stage); me.act('hit'); if (Math.random() < 0.5) sfx.hit(); fx.puff('smoke', m.r.g.position.clone().setY(m.r.scale), 0.4); }
  else if (m.type === 'roar') { m.hold = true; }
  else if (m.type === 'dodge' && m.phase === 'counter') { hitRival(14 + 4 * stage); me.act('hit'); sfx.boom(); popup(m.r.g.position.clone().setY(m.r.scale * 2), 'COUNTER!', '#7dff3a'); m.phase = 'gap'; m.pt = 0; $('kjMiniSeq').innerHTML = ''; }
  else if (m.type === 'spin') { m.last = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); } });
miniEl.addEventListener('pointermove', (e) => { const m = mini; if (!m || m.type !== 'spin' || m.last == null) return; const a = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); let d = a - m.last; d = Math.atan2(Math.sin(d), Math.cos(d)); m.ang += Math.abs(d); m.last = a; m.spinA += d; });
miniEl.addEventListener('pointerup', (e) => { const m = mini; if (!m || !gest) return; const dx = e.clientX - gest.x, dy = e.clientY - gest.y; gest = null;
  if (m.type === 'roar' && m.hold) { m.hold = false; if (m.v >= m.zone[0] && m.v <= m.zone[1]) endMini('roarWin'); else endMini('roarWeak'); return; }
  if (m.type === 'spin') { m.last = null; return; }
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return; const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
  if (m.type === 'swipe') swipeAnswer(m, dir);
  else if (m.type === 'dodge' && m.phase === 'warn') { if ((m.side === 'L' && dir === 'R') || (m.side === 'R' && dir === 'L')) { m.phase = 'counter'; m.pt = 0; miniEl.dataset.side = ''; knock(me.g, m.r.g.position, 0.6); $('kjMiniSeq').innerHTML = '<span class="on">TAP!</span>'; popup(me.g.position.clone().setY(meScale * 2), 'DODGED!', '#9fd6ff'); } else dodgeHit(m); } });
function swipeAnswer(m, dir) { const ok = dir === m.seq[m.i]; const el = $('kjA' + m.i); if (el) el.className = ok ? 'ok' : 'bad';
  if (ok) { m.good++; hitRival(8 + 3 * stage); me.act('hit'); sfx.hit(); } else { m.r.rig.act('hit'); hurt(1.5 + m.r.stage, true); sfx.hurt(); }
  m.i++; m.tt = 0; if (m.i >= m.seq.length) { if (m.good === m.seq.length) { hitRival(15); popup(m.r.g.position.clone().setY(m.r.scale * 2), 'PERFECT COMBO!', '#7dff3a'); } endMini('done'); } }
function dodgeHit(m) { m.r.rig.act('hit'); hurt(3 + 1.5 * m.r.stage, true); sfx.hurt(); miniEl.dataset.side = ''; m.phase = 'gap'; m.pt = 0; $('kjMiniSeq').innerHTML = '<span class="bad">HIT!</span>'; }
function spot(m) { const v = m.r.g.position.clone().setY(m.r.scale * 1.1).project(cam); const x = Math.max(40, Math.min(innerWidth - 40, (v.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 140)), y = Math.max(120, Math.min(innerHeight - 220, (-v.y * 0.5 + 0.5) * innerHeight + (Math.random() - 0.5) * 160));
  const b = document.createElement('div'); b.className = 'kjSpot'; b.style.left = x + 'px'; b.style.top = y + 'px'; $('kjMiniSpots').appendChild(b); const s = { b, life: 1.05, dead: false };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (s.dead || !mini) return; s.dead = true; b.classList.add('pop'); setTimeout(() => b.remove(), 200); hitRival(7 + 3 * stage); me.act('hit'); sfx.hit(); });
  m.live.push(s); }
function updateMini(dt) {
  const m = mini, r = m.r; m.t += dt; if (!rival || r.hp <= 0) return endMini(null);
  if (m.type === 'brawl') { m.v -= dt * Math.max(0.3, 0.55 + 0.12 * (r.stage - 1) - 0.08 * (stage - 1)); if (Math.random() < dt * 2.2) { r.rig.act('hit'); sfx.hit(); }
    $('kjMiniMark').style.left = ((1 - m.v) * 50) + '%'; if (m.v >= 1) return endMini('win'); if (m.v <= -1) return endMini('lose'); if (m.t > 7) return endMini('draw'); }
  else if (m.type === 'swipe') { m.tt += dt; $('kjMiniMark').style.left = Math.max(0, 100 - m.tt / m.limit * 100) + '%'; const el = $('kjA' + m.i); if (el && el.className !== 'on') el.className = 'on'; if (m.tt >= m.limit) swipeAnswer(m, '-'); }
  else if (m.type === 'spots') { m.next -= dt; if (m.next <= 0 && m.spawned < m.total) { m.next = 0.42; m.spawned++; spot(m); }
    for (const s of m.live) { if (s.dead) continue; s.life -= dt; if (s.life <= 0) { s.dead = true; s.b.classList.add('miss'); setTimeout(() => s.b.remove(), 250); r.rig.act('hit'); hurt(1 + 0.5 * r.stage, true); } }
    $('kjMiniMark').style.left = (100 - m.spawned / m.total * 100) + '%'; if (m.spawned >= m.total && m.live.every((s) => s.dead)) return endMini('done'); }
  else if (m.type === 'dodge') { m.pt += dt; $('kjMiniMark').style.left = (100 - m.round / 3 * 100) + '%';
    if (m.phase === 'warn' && m.pt > Math.max(0.6, 1.0 - 0.1 * (r.stage - 1))) dodgeHit(m);
    else if (m.phase === 'counter' && m.pt > 0.8) { m.phase = 'gap'; m.pt = 0; $('kjMiniSeq').innerHTML = ''; }
    else if (m.phase === 'gap' && m.pt > 0.45) { if (m.round >= 3) return endMini('done'); nextDodge(m); } }
  else if (m.type === 'spin') { m.lift = Math.min(1, m.lift + dt * 2.5); const P = me.g.position, R = meScale * 0.55 + r.scale * 0.4, cy = me.fly ? meScale * 0.1 : meScale * 2.3, k = m.lift < 1 ? Math.min(1, dt * 8) : 1;
    const tx = P.x + Math.cos(m.spinA) * R, tz = P.z + Math.sin(m.spinA) * R; r.g.position.x += (tx - r.g.position.x) * k; r.g.position.z += (tz - r.g.position.z) * k; r.g.position.y += (cy - r.g.position.y) * k;
    r.g.rotation.set(0, Math.PI / 2 - m.spinA, 1.35 * m.lift); me.g.rotation.y = faceY = Math.atan2(tx - P.x, tz - P.z);
    const need = Math.PI * 2 * (2.5 + 0.5 * r.stage); $('kjMiniMark').style.left = Math.min(100, m.ang / need * 100) + '%'; if (m.ang >= need) return endMini('throw'); if (m.t > 5) return endMini('freed'); }
  else if (m.type === 'roar') { if (m.hold) m.v += dt * 0.7; $('kjMiniMark').style.left = Math.min(100, m.v * 100) + '%'; if (m.v > 1) return endMini('choke'); if (m.t > 4.5 && !m.hold) return endMini('roared'); }
}
function knock(g, from, dist) { const dx = g.position.x - from.x, dz = g.position.z - from.z, d = Math.hypot(dx, dz) || 1; g.position.x += dx / d * dist; g.position.z += dz / d * dist; }
function endMini(res) {
  const m0 = mini, r = mini && mini.r; mini = null; miniEl.className = 'hidden'; $('kjMiniSpots').innerHTML = '';
  if (r && r.spun) { r.spun = false; r.rig.shadow.visible = true; if (res !== 'throw' || r.hp <= 0) { r.g.rotation.x = r.g.rotation.z = 0; r.g.position.y = 0; } }
  if (!r || !rival || r.hp <= 0) return; r.cd = 3;
  if (res === 'win') { banner('SMACKDOWN!'); hitRival(30 + 10 * stage); knock(r.g, me.g.position, 3); flashT = 0.15; sfx.boom(); }
  else if (res === 'lose') { banner('OUCH!'); r.rig.act('hit'); hurt(4 + 2 * r.stage, true); knock(me.g, r.g.position, 2.5); sfx.hurt(); }
  else if (res === 'draw') { banner('STALEMATE'); hitRival(8); hurt(2, true); knock(me.g, r.g.position, 1.5); knock(r.g, me.g.position, 1.5); }
  else if (res === 'done') { knock(r.g, me.g.position, 2.5); }
  else if (res === 'throw') { banner('GIANT SWING!'); me.act('cast'); sfx.throw(); flashT = 0.1; const a = m0 ? m0.spinA : 0, D = 24 + 3 * stage, hx = cols * CELL / 2 - 3, hz = rows * CELL / 2 - 3;
    const to = new THREE.Vector3(Math.max(-hx, Math.min(hx, r.g.position.x + Math.cos(a) * D)), 0, Math.max(-hz, Math.min(hz, r.g.position.z + Math.sin(a) * D)));
    r.toss = { from: r.g.position.clone(), to, t: 0, secs: 1.3, h: 5 + meScale * 1.5 }; r.stun = 3; }
  else if (res === 'freed') { banner('IT BROKE FREE!'); r.rig.act('hit'); hurt(3 + r.stage, true); knock(me.g, r.g.position, 2); }
  else if (res === 'roarWin') { banner('TERRIFYING ROAR!'); me.act('cast'); hitRival(10 + 4 * stage); r.stun = 2.5; knock(r.g, me.g.position, 3); fx.puff('smoke', me.g.position.clone().setY(1), 2); sfx.boom(); r.roarCd = 14; }
  else if (res === 'roarWeak') { banner('WEAK ROAR...'); r.stun = 0.8; r.roarCd = 14; }
  else if (res === 'choke') { banner('YOU CHOKED!'); hurt(2, true); slowT = 1.5; r.roarCd = 14; }
  else if (res === 'roared') { banner('IT OUT-ROARED YOU!'); slowT = 2; hurt(1.5, true); r.roarCd = 14; }
}

// ---------- targets, minimap (as in Tornado Alley) ----------
let poiOrder = [], mapBase = null, mapT = 0; const mapEl = $('taMap'), mapCtx = mapEl.getContext('2d');
function setupPoiHud() {
  poiOrder = Object.keys(pois).sort((a, b) => POI[a].stage - POI[b].stage || POI[a].pts - POI[b].pts);
  $('taPois').innerHTML = poiOrder.map((k) => '<span class="poiChip" id="poi_' + k + '"><em>' + POI[k].icon + '</em><b>' + 'HTC'[POI[k].stage - 1] + '</b><i></i></span>').join('');
  for (const el of document.querySelectorAll('.poiArrow')) el.remove();
  for (const k of poiOrder) { const a = document.createElement('div'); a.className = 'poiArrow'; a.innerHTML = '<i>➤</i><em>' + POI[k].icon + '</em>'; document.body.appendChild(a); pois[k].arrow = a; pois[k].chip = $('poi_' + k); }
  const c = document.createElement('canvas'); c.width = cols * 4; c.height = rows * 4; const g = c.getContext('2d'); g.fillStyle = '#24403c'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#8fb0aa';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!maze[y][x]) g.fillRect(x * 4, y * 4, 4, 4); mapBase = c; mapT = 0;
}
const mapScale = (px) => (px / 2) / (Math.hypot(cols, rows) * CELL / 2);
function drawMini() {
  const dpr = Math.min(2, devicePixelRatio || 1), S = Math.round(mapEl.clientWidth * dpr) || 1; if (mapEl.width !== S) mapEl.width = mapEl.height = S;
  const g = mapCtx, k = mapScale(S), P2 = (x, z) => [S / 2 + k * (right.x * x + right.z * z), S / 2 - k * (upv.x * x + upv.z * z)];
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, 6.2832); g.clip();
  g.setTransform(k * right.x, -k * upv.x, k * right.z, -k * upv.z, S / 2, S / 2); if (mapBase) g.drawImage(mapBase, -cols * CELL / 2, -rows * CELL / 2, cols * CELL, rows * CELL);
  g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const kk of poiOrder) { const P = pois[kk], [x, y] = P2(P.center.x, P.center.z); if (P.done) { g.font = 'bold ' + (13 * dpr) + 'px sans-serif'; g.fillStyle = '#7dff3a'; g.fillText('✓', x, y); } else { const ready = stage >= POI[kk].stage; if (ready) { g.fillStyle = '#ffd24a66'; g.beginPath(); g.arc(x, y, 9 * dpr, 0, 6.2832); g.fill(); } g.globalAlpha = ready ? 1 : 0.6; g.font = (13 * dpr) + 'px sans-serif'; g.fillText(POI[kk].icon, x, y); g.globalAlpha = 1; } }
  for (const pl of planes) { if (pl.life <= 0) continue; const [x, y] = P2(pl.g.position.x, pl.g.position.z); g.fillStyle = '#ff9a6a'; g.font = 'bold ' + (12 * dpr) + 'px sans-serif'; g.fillText('✈', x, y); }
  if (rival && rival.hp > 0) { const [x, y] = P2(rival.g.position.x, rival.g.position.z); g.fillStyle = '#ff3a3a'; g.beginPath(); g.arc(x, y, 4.5 * dpr, 0, 6.2832); g.fill(); }
  if (moveTo) { const [x, y] = P2(moveTo.x, moveTo.z); g.strokeStyle = '#ffd24a'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(x - 4 * dpr, y - 4 * dpr); g.lineTo(x + 4 * dpr, y + 4 * dpr); g.moveTo(x + 4 * dpr, y - 4 * dpr); g.lineTo(x - 4 * dpr, y + 4 * dpr); g.stroke(); }
  if (me) { const [x, y] = P2(me.g.position.x, me.g.position.z); g.fillStyle = '#7dff3a'; g.strokeStyle = '#1a0f2e'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, 4.5 * dpr, 0, 6.2832); g.fill(); g.stroke(); }
  g.restore();
}
mapEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (state !== 'play') return; const r = mapEl.getBoundingClientRect(), k = mapScale(r.width); const a = (e.clientX - r.left - r.width / 2) / k, b = -(e.clientY - r.top - r.height / 2) / k;
  const lim = toWorld(cols - 1, rows - 1, cols, rows); moveTo = new THREE.Vector3(Math.max(-lim.x, Math.min(lim.x, right.x * a + upv.x * b)), 0, Math.max(-lim.z, Math.min(lim.z, right.z * a + upv.z * b))); mapT = 0; });
function wreckPoi(k) {
  const P = pois[k]; P.done = true; const g = new THREE.Group(); g.position.copy(P.center); scene.add(g);
  for (const hz of P.hz) { for (const part of hz.parts || []) if (part.parent) g.attach(part); const i = city.obstacles.findIndex((o) => Math.abs(o.x - hz.pos.x) < 0.3 && Math.abs(o.z - hz.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); }
  const parts = g.children.slice(); twisters.scatter(parts, P.center, 5); scene.remove(g); for (const m of parts) if (!m.parent) scene.add(m);
  award(POI[k].pts, P.center, POI[k].name); grow(massTarget * 0.04); power = Math.min(1, power + 0.3); sfx.wave(); sfx.boom(); fx.explode(new THREE.Vector3(P.center.x, 1, P.center.z), 2.2); flashT = 0.3;
  { const chip = $('poi_' + k); if (chip) { chip.classList.remove('ready'); chip.classList.add('done', 'boom'); } if (P.arrow) P.arrow.style.display = 'none'; }
  if (k === 'power') { banner('BLACKOUT!'); hemi.intensity *= 0.55; sun.intensity *= 0.6; city.group.traverse((m) => { const mt = m.material; if (mt && !Array.isArray(mt) && mt.isMeshBasicMaterial && mt.color && mt.color.getHex() === 0xf6e94a) mt.color.setHex(0x22232a); }); }
  else if (k === 'water') { banner('A BIG DRINK! +HEALTH'); grow(massTarget * 0.12); }
  else if (k === 'weather') { banner('RADAR DOWN! NO MORE PLANES'); noPlanes = true; for (const pl of planes) pl.life = 0; }
  else if (k === 'radio') { banner('OFF THE AIR! RIVALS DELAYED'); for (let i = 0; i < rivalQueue.length; i++) rivalQueue[i] += 30; }
  else if (k === 'police') { banner('JAILBREAK! SNACKS!'); for (let i = 0; i < 12; i++) spawnWalker(P.center); }
  else if (k === 'nuclear') { banner('MELTDOWN! POWER SURGE'); grow(massTarget * 0.2); power = 1; flashT = 0.7; }
  else banner(POI[k].name + ' DOWN!');
}
function spawnWalker(c) { const ch = makeCharacter('worker', { skin: { outfit: { shirt: 0xff7a1a, pants: 0xff7a1a, tie: null } } }); const a = Math.random() * 6.28, r = reach() + 1.5 + Math.random() * 2.5; ch.scale.setScalar(0.25); ch.position.set(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r); Object.assign(ch.userData, { home: ch.position.clone(), goal: null, wait: Math.random() }); scene.add(ch); people.push(ch); }

// ---------- input: drag for a stick, tap to walk / cast ----------
const stick = { id: null, cx: 0, cy: 0, x: 0, y: 0 }; const stickEl = $('taStick'), knobEl = $('taKnob'); const keys = {};
function sDown(id, x, y) { if (stick.id !== null || state !== 'play') return; stick.id = id; stick.cx = x; stick.cy = y; stick.x = stick.y = 0; stick.t0 = performance.now(); stick.moved = 0; stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.style.display = 'none'; knobEl.style.transform = 'translate(-50%,-50%)'; }
function sMove(id, x, y) { if (id !== stick.id) return; const dx = x - stick.cx, dy = y - stick.cy, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 55); stick.moved = Math.max(stick.moved, d); if (stick.moved < 10) return; stickEl.style.display = 'block'; moveTo = null; stick.x = dx / d * m / 55; stick.y = dy / d * m / 55; knobEl.style.transform = 'translate(calc(-50% + ' + stick.x * 36 + 'px), calc(-50% + ' + stick.y * 36 + 'px))'; }
function sUp(id, x, y) { if (id !== stick.id) return; const tap = stick.moved < 10 && performance.now() - stick.t0 < 300; stick.id = null; stick.x = stick.y = 0; stickEl.style.display = 'none'; if (tap && x != null && state === 'play') tapAt(stick.cx, stick.cy); }
const ZOOM_MIN = 0.6, ZOOM_MAX = 1.3; let zoom = 1, camK = 1; // camK: the size step (wider at each stage, widest for mega) try { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +localStorage.getItem('kj_zoom') || 1)); } catch { /* ignore */ }
function setZoom(z) { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); try { localStorage.setItem('kj_zoom', String(zoom)); } catch { /* ignore */ } }
let pinch = 0; const pinchD = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
canvas.addEventListener('touchstart', (e) => { if (e.touches.length >= 2) { sUp(stick.id); pinch = pinchD(e.touches); return; } for (const t of e.changedTouches) sDown('t' + t.identifier, t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchmove', (e) => { if (e.touches.length >= 2 && pinch > 0) { const d = pinchD(e.touches); if (d > 0) setZoom(zoom * pinch / d); pinch = d; if (e.cancelable) e.preventDefault(); return; } for (const t of e.changedTouches) sMove('t' + t.identifier, t.clientX, t.clientY); if (state === 'play' && e.cancelable) e.preventDefault(); }, { passive: false });
addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = 0; });
addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
for (const [id, k] of [['taZoomIn', 0.85], ['taZoomOut', 1.18]]) $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); setZoom(zoom * k); });
const tUp = (e) => { for (const t of e.changedTouches) sUp('t' + t.identifier, t.clientX, t.clientY); }; addEventListener('touchend', tUp); addEventListener('touchcancel', tUp);
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') sDown(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') sMove(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') sUp(e.pointerId, e.clientX, e.clientY); });
addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape' || e.key === 'p') togglePause(); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// ---------- flow ----------
let state = 'start', died = false;
soundToggle($('taStart'), $('taPaused')); // sound on/off on the start and pause screens
const fsMode = initFullscreen(() => state === 'play'); // full screen on play, back in after a browser drop-out, no page scrolling mid-round
function start() {
  fsMode.play();
  megaT = 0; megaUsed = false; megaDropT = 25 + Math.random() * 15; if (megaDrop) scene.remove(megaDrop.g); megaDrop = null; megaArrow.style.display = 'none'; megaEl.className = 'hidden'; blasts.length = 0; camK = 1;
  unlockAudio(); buildWorld(); makeMe(); spells.clear(); score = 0; chain = 0; lastHit = -9; tLeft = L().time; played = 0; peopleN = carsN = bDone = 0; ko = 0; died = false; moveTo = null; slowT = 0; boostT = 0;
  for (const pl of planes) { scene.remove(pl.g); pl.arrow.remove(); } planes = []; planeT = 50 + Math.random() * 10; noPlanes = false; for (const b of bombs) scene.remove(b.m); bombs.length = 0; for (const f of fires) scene.remove(f.ring); fires.length = 0;
  if (rival) scene.remove(rival.g); rival = null; mini = null; lastMini = ''; miniEl.className = 'hidden'; rivalQueue = []; rivalWait = 0; queueRivals(1); unlockedNow.length = 0; sinking.length = 0; gulps.length = 0;
  setupPoiHud(); for (const s of ['taStart', 'taEnd', 'taPaused', 'taPrize', 'kjPickScr']) $(s).classList.add('hidden'); $('ta').classList.remove('hidden');
  state = 'play'; startStormMusic(); setStormLevel(1); sfx.whoosh(); banner(KAIJU[me.id].name + ' VS ' + L().name.toUpperCase()); setTimeout(() => { if (state === 'play') banner('TAKE OUT ' + (L().need >= poiOrder.length ? 'ALL ' + poiOrder.length : L().need) + ' TARGETS'); }, 2600);
  renderer.compile(scene, cam); $('taLevel').textContent = 'L' + level + ' · goal ' + L().goal + '%'; for (const k in hudCache) delete hudCache[k];
}
function togglePause() { if (state === 'play') { state = 'paused'; setPlaneEngine(0); stopMusic(); $('taPaused').classList.remove('hidden'); } else if (state === 'paused') { state = 'play'; $('taPaused').classList.add('hidden'); startStormMusic(); setStormLevel(stage * 2 - 1); } }
function die() { if (died) return; died = true; me.act('ko'); banner('KAIJU DOWN!'); sfx.over(); setTimeout(finish, 1800); state = 'dying'; }
function finish() {
  state = 'over'; mini = null; miniEl.className = 'hidden'; stopMusic(); setPlaneEngine(0); sUp(stick.id); clearTips(); const done = poiOrder.filter((k) => pois[k].done); for (const k of poiOrder) if (pois[k].arrow) pois[k].arrow.style.display = 'none'; rivalEl.classList.add('hidden'); rivalArrow.style.display = 'none'; for (const pl of planes) pl.arrow.style.display = 'none';
  let best = 0; const bk = 'kj_best_' + level; try { best = +localStorage.getItem(bk) || 0; if (score > best) { best = score; localStorage.setItem(bk, String(score)); } } catch { /* ignore */ }
  const pct = Math.round((bDone / totalB) * 100); const need = Math.min(L().need, poiOrder.length); const cleared = !died && pct >= L().goal && done.length >= need;
  const scoreCoins = Math.floor(score / 10000) / 100; if (scoreCoins > 0) addCoins(scoreCoins);
  if (cleared && level < LEVELS.length && unlockedLevel() <= level) { try { localStorage.setItem('kj_level', String(level + 1)); } catch { /* ignore */ } }
  $('taEndTitle').innerHTML = died ? 'KAIJU<br>DOWN' : cleared ? (level === LEVELS.length ? 'MEGACITY<br>CRUSHED' : 'LEVEL ' + level + '<br>CRUSHED') : "TIME'S<br>UP";
  $('taAgain').textContent = cleared && level < LEVELS.length ? 'NEXT LEVEL' : cleared ? 'PLAY AGAIN' : 'TRY AGAIN'; $('taAgain').dataset.next = cleared && level < LEVELS.length ? '1' : '';
  $('taGoalLine').textContent = died ? 'The army got you. Eat more people to grow back, and walk out of the napalm.' : cleared ? (level < LEVELS.length ? 'Level ' + (level + 1) + ' unlocked: ' + LEVELS[level].name + '.' : 'Every town crushed. Monster.') : 'Flatten ' + L().goal + '% of ' + L().name + ' and take out ' + (need >= poiOrder.length ? 'every big target' : need + ' big targets') + ' (you got ' + pct + '% and ' + done.length + ').';
  for (const id of unlockedNow) { const u = document.createElement('div'); u.className = 'bonusSkin'; u.innerHTML = '🏆 NEW KAIJU UNLOCKED: <b>' + KAIJU[id].name + '</b>'; $('taGoalLine').appendChild(u); }
  $('taStats').innerHTML = [['Buildings', bDone + ' / ' + totalB + ' (' + pct + '%)'], ['People eaten', peopleN], ['Cars wrecked', carsN], ['Rivals KO\'d', ko], ['Big targets', done.length + ' / ' + poiOrder.length + ' ' + done.map((k) => POI[k].icon).join('')], ['Biggest', STAGE[topStage]], ['Score', score], ['Score coins', '+' + scoreCoins + ' 🪙'], ['Best', best]].map(([a, b]) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>').join('');
  const goes = Math.min(3, 1 + (cleared ? 1 : 0) + Math.floor(done.length / 2)); kaijuRound(goes); showPrizes($('taChests'), goes, '1 go, +1 for clearing the level, +1 for every 2 big targets destroyed (max 3)', () => { location.href = 'store.html?from=kaiju'; }, kaijuPrize, () => { $('taPrize').classList.add('hidden'); $('taEnd').classList.remove('hidden'); });
  $('ta').classList.add('hidden'); $('taPrize').classList.remove('hidden'); drawPicker(); // the prize game first, then the score
}
const HOWTO = [
  ['🦖', 'You are the monster', 'Tap a spot to walk there. Your kaiju eats people and smashes whatever is closest all by itself.'],
  ['🍖', 'Eat to grow', 'Every person you eat makes you bigger: Hatchling, then Titan, then Colossus. Bigger kaiju flatten taller buildings.'],
  ['⚡', 'Spells', 'Your Power bar fills over time. When it is full, tap an enemy, a tank or a spot to cast your spell. Every size has a different spell.'],
  ['❤️', 'Size is health', 'The army, napalm and rivals shrink you. Drop below a size and you go back down. Shrink away as a Hatchling and it is over.'],
  ['✈️', 'Napalm planes', 'Planes drop fire on you. Walk out of the flames, or blast them with a spell. A Colossus swats them.'],
  ['👹', 'Rival kaiju', 'Two rivals come for you at each size. Fight them up close or hit them with spells. KO one and eat it for a big boost.'],
  ['👹', 'Win new kaiju', 'Most rounds the prize games hand you a new kaiju or robot (sometimes two). Win one you already have and you get a whole coin.'],
  ['🏆', 'Crush the town', 'Flatten the goal % and take out enough big targets before time runs out to unlock the next town.'],
];
$('taHow').addEventListener('click', () => showHowTo(HOWTO));
$('taPlay').addEventListener('click', () => { if (tipsSeen('kj_howto')) start(); else { markSeen('kj_howto'); showHowTo(HOWTO, start); } });
$('taAgain').addEventListener('click', () => { if ($('taAgain').dataset.next) level++; start(); });
$('taEndPick').addEventListener('click', openPicker);
function drawLevels() { const box = $('taLevels'); box.innerHTML = ''; const un = unlockedLevel(); LEVELS.forEach((lv, i) => { const b = document.createElement('button'); const n = i + 1; let best = 0; try { best = +localStorage.getItem('kj_best_' + n) || 0; } catch { /* ignore */ }
  b.className = 'lvl' + (n === level ? ' on' : ''); b.disabled = n > un; b.innerHTML = '<b>' + (n > un ? '🔒' : n) + '</b><span>' + lv.name + '</span>' + (best ? '<i>' + best + '</i>' : ''); b.addEventListener('click', () => { level = n; drawLevels(); }); box.appendChild(b); }); }
// ---------- the monster picker: the start screen shows your monster; CHOOSE MONSTER opens a scrolling screen with a
// picture of every one (locked ones are dark silhouettes). Pictures are rendered once each, a few per frame ----------
const thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); thumbR.setSize(150, 150); thumbR.setPixelRatio(1);
const thumbS = new THREE.Scene(); thumbS.add(new THREE.HemisphereLight(0xe0e8ff, 0x3a2a4a, 1.6)); { const l = new THREE.DirectionalLight(0xffffff, 0.9); l.position.set(3, 6, 5); thumbS.add(l); }
const thumbC = new THREE.PerspectiveCamera(30, 1, 0.1, 50); thumbC.position.set(2.1, 1.8, 4.3); thumbC.lookAt(0, 1.15, 0);
const thumbCache = new Map(), thumbQ = [];
function thumb(id, cv) { const skin = !!getEquipped()['kj_' + id], key = id + (skin ? '+' : ''); const g2 = cv.getContext('2d');
  if (thumbCache.has(key)) { g2.clearRect(0, 0, cv.width, cv.height); g2.drawImage(thumbCache.get(key), 0, 0, cv.width, cv.height); return; }
  thumbQ.push(() => { const rig = buildKaiju(id, skin); rig.anim(0.4, 0); const g = rig.g; g.rotation.y = -0.5; const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()); const k = 2.5 / Math.max(sz.x, sz.y, sz.z); g.scale.setScalar(k); bb.setFromObject(g); g.position.y -= bb.min.y; g.position.x -= (bb.min.x + bb.max.x) / 2; g.position.z -= (bb.min.z + bb.max.z) / 2;
    thumbS.add(g); thumbR.render(thumbS, thumbC); thumbS.remove(g); const img = document.createElement('canvas'); img.width = img.height = 150; img.getContext('2d').drawImage(thumbR.domElement, 0, 0); thumbCache.set(key, img); g2.clearRect(0, 0, cv.width, cv.height); g2.drawImage(img, 0, 0, cv.width, cv.height); }); }
(function thumbPump() { requestAnimationFrame(thumbPump); for (let i = 0; i < 3 && thumbQ.length; i++) thumbQ.shift()(); })();
function drawPicker() { const un = unlockedKaiju(), K = KAIJU[pick];
  $('kjChosenName').textContent = K.name; $('kjChosenSpells').textContent = K.spells.join(' → '); thumb(pick, $('kjChosenCv'));
  $('kjPickInfo').innerHTML = un.length + ' of ' + KAIJU_IDS.length + ' unlocked. Win more in the prize games after each round.';
  if ($('kjPickScr').classList.contains('hidden')) return;
  const box = $('kjPick'); box.innerHTML = '';
  for (const id of KAIJU_IDS) { const KK = KAIJU[id], open = un.includes(id); const b = document.createElement('button'); b.className = 'kjCard' + (id === pick ? ' on' : '') + (open ? '' : ' locked'); b.disabled = !open;
    b.innerHTML = '<canvas width="150" height="150"></canvas><b>' + (open ? '' : '🔒 ') + KK.name + '</b>'; thumb(id, b.querySelector('canvas'));
    b.addEventListener('click', () => { pick = id; try { localStorage.setItem('kj_pick', id); } catch { /* ignore */ } for (const o of box.children) o.classList.remove('on'); b.classList.add('on'); drawPicker(); showcase(); }); box.appendChild(b); } }
function openPicker() { $('taStart').classList.add('hidden'); $('taEnd').classList.add('hidden'); state = 'start'; $('kjPickScr').classList.remove('hidden'); $('kjPickScr').scrollTop = 0; drawPicker(); }
$('kjChoose').addEventListener('click', openPicker);
$('kjPickDone').addEventListener('click', () => { $('kjPickScr').classList.add('hidden'); $('taStart').classList.remove('hidden'); drawPicker(); });
level = unlockedLevel(); drawLevels(); drawPicker();
$('taPause').addEventListener('click', togglePause); $('taResume').addEventListener('click', togglePause);
// restart the level from the pause screen; the first tap asks, a second tap within 3 seconds does it
{ const rb = $('taRestart'); let armT = 0; const reset = () => { armT = 0; rb.textContent = '↺ RESTART LEVEL'; rb.classList.remove('armed'); };
  rb.addEventListener('click', () => { if (!armT || performance.now() - armT > 3000) { armT = performance.now(); rb.textContent = '↺ SURE? TAP AGAIN TO RESTART'; rb.classList.add('armed'); setTimeout(() => { if (armT && performance.now() - armT >= 2900) reset(); }, 3000); return; }
    reset(); $('taPaused').classList.add('hidden'); start(); }); }

// ---------- update ----------
const right = new THREE.Vector3(), upv = new THREE.Vector3(), tmp = new THREE.Vector3(); let frameN = 0;
const hudCache = {}; const setT = (id, v) => { v = String(v); if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
function update(dt) {
  played += dt; tLeft -= dt; if (tLeft <= 0) { tLeft = 0; finish(); return; }
  if (played > 1) tip('kj_walk', '👆 Tap a spot to walk there. Your kaiju eats people and smashes things on its own.'); if (power >= 1 && !tipsSeen('kj_cast')) tip('kj_power', '⚡ Power full! Tap an enemy or a spot to cast ' + KAIJU[me.id].spells[stage - 1] + '.');
  const g = me.g, K = KAIJU[me.id];
  // size = health: the bar, the stage, the scale
  meF = mass / massTarget; const st = stageOf(meF);
  if (st !== stage) { if (st > stage) { banner(STAGE[st] + '!'); stormBoost(3); boostT = 3; sfx.whoosh(); if (st > topStage) { topStage = st; queueRivals(st); } } else { banner('SHRANK TO ' + STAGE[st] + '!'); sfx.hurt(); } stage = st; }
  meScale += ((megaT > 0 ? scaleOf(1) * 1.5 : scaleOf(meF)) - meScale) * Math.min(1, dt * 2); g.scale.setScalar(meScale);
  updateMega(dt);
  power = Math.min(1, power + dt / CHARGE);
  // moving: a tap target, the stick or the keys; slowed when hit, faster after growing
  let sx = stick.x + ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0), sy = stick.y + ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0);
  cam.updateMatrixWorld(); right.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize(); upv.setFromMatrixColumn(cam.matrixWorld, 1).setY(0).normalize();
  slowT -= dt; boostT -= dt; const speed = (4.0 + meScale * 0.45) * K.speed * (slowT > 0 ? 0.6 : 1) * (boostT > 0 ? 1.4 : 1);
  const mag = Math.min(1, Math.hypot(sx, sy)); let moving = 0;
  if (mini) { updateMini(dt); moveTo = null; }
  else if (leap) { leap.t += dt; const k = Math.min(1, leap.t / leap.secs); g.position.lerpVectors(leap.from, leap.to, k); g.position.y = Math.sin(k * Math.PI) * leap.h; if (leap.step) { leap.stepT -= dt; if (leap.stepT <= 0) { leap.stepT = 0.08; leap.step(g.position.clone().setY(0)); } } if (leap.hide && Math.random() < dt * 30) fx.puff('smoke', g.position.clone().setY(0.3), 0.8); if (k >= 1) { g.position.y = 0; me.body.visible = true; const f = leap.onLand; leap = null; f(); } }
  else if (mag > 0.05) { moveTo = null; tmp.copy(right).multiplyScalar(sx).addScaledVector(upv, -sy).normalize(); g.position.addScaledVector(tmp, speed * mag * dt); faceY = Math.atan2(tmp.x, tmp.z); moving = mag; }
  else if (moveTo) { const dx = moveTo.x - g.position.x, dz = moveTo.z - g.position.z, dl = Math.hypot(dx, dz); if (dl < 0.4) moveTo = null; else { g.position.x += dx / dl * Math.min(dl, speed * dt); g.position.z += dz / dl * Math.min(dl, speed * dt); faceY = Math.atan2(dx, dz); moving = 1; } }
  const lim = toWorld(cols - 1, rows - 1, cols, rows); g.position.x = Math.max(-lim.x, Math.min(lim.x, g.position.x)); g.position.z = Math.max(-lim.z, Math.min(lim.z, g.position.z));
  { let dr = faceY - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 6); }
  me.anim(dt, moving);
  const px = g.position.x, pz = g.position.z, R = reach();
  // stomping: buildings it walks into come down (if it's big enough)
  tooBigT -= dt;
  for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - px, x.pos.z - pz); if (d > R + 1.0) continue;
    if (x.h <= (megaT > 0 ? 99 : MAX_H[stage])) { crumble(x); if (Math.random() < 0.4) me.act('hit'); } else if (tooBigT <= 0) { tooBigT = 2; popup(x.pos, 'TOO BIG - EAT MORE!', '#ff7a5a'); } }
  for (const k of poiOrder) { const P = pois[k]; if (P.done || !P.hz.length) continue; if (Math.hypot(P.center.x - px, P.center.z - pz) > R + P.reach) continue;
    if ((megaT > 0 ? 3 : stage) >= POI[k].stage) { me.act('hit'); wreckPoi(k); } else if (tooBigT <= 0) { tooBigT = 2; popup(P.center, 'NEED ' + STAGE[POI[k].stage] + '!', '#ff7a5a'); } }
  // people: they run, and the ones it reaches get eaten
  frameN++;
  for (let i = people.length - 1; i >= 0; i--) { const c = people[i], u = c.userData; const dx = c.position.x - px, dz = c.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
    if (u.frz && d <= 34) { u.frz = false; delete c.updateMatrixWorld; }
    if (d < R + 1.2) { if (u.frz) { u.frz = false; delete c.updateMatrixWorld; } eat(c, i); if (Math.random() < 0.5) me.act('hit'); continue; }
    if (d < 8 + meScale * 1.5) { const sp = 1.6 * dt; c.position.y = 0; c.position.x += dx / d * sp; c.position.z += dz / d * sp; c.rotation.y = Math.atan2(dx, dz); animateWalk(c, dt, 1.3); u.goal = null; }
    else if (d > 34) { if (!u.frz) { u.frz = true; c.updateMatrixWorld(true); c.updateMatrixWorld = noop; } }
    else if ((i + frameN) & 1) { /* every other frame */ } else { const dw = dt * 2; u.wait -= dw; if (!u.goal && u.wait <= 0) u.goal = new THREE.Vector3(u.home.x + (Math.random() - 0.5) * 2, 0, u.home.z + (Math.random() - 0.5) * 2);
      if (u.goal) { const gx = u.goal.x - c.position.x, gz = u.goal.z - c.position.z, gl = Math.hypot(gx, gz); if (gl < 0.1) { u.goal = null; u.wait = 1 + Math.random() * 3; animateWalk(c, dw, 0); } else { c.position.x += gx / gl * 0.6 * dw; c.position.z += gz / gl * 0.6 * dw; c.rotation.y = Math.atan2(gx, gz); animateWalk(c, dw, 0.5); } } else animateWalk(c, dw, 0); } }
  // gulp: the eaten fly up into its mouth
  { const mouth = me.mouth.getWorldPosition(tmp); for (let i = gulps.length - 1; i >= 0; i--) { const q = gulps[i]; q.t += dt * 3; q.c.position.lerpVectors(q.from, mouth, Math.min(1, q.t)); q.c.scale.setScalar(0.25 * Math.max(0.1, 1 - q.t * 0.7)); if (q.t >= 1) { scene.remove(q.c); if (pool.length < 80) pool.push(q.c); gulps.splice(i, 1); } } }
  // auto-fight: it swats the nearest car, soldier or tank in reach, and brawls with a rival
  meleeCd -= dt;
  for (let i = cars.length - 1; i >= 0; i--) { const q = cars[i].getWorldPosition(tmp); if (Math.hypot(q.x - px, q.z - pz) < R + 0.6) { const c = cars[i]; cars.splice(i, 1); blowCar(c, q.clone()); me.act('hit'); } }
  if (city.knock(px, pz, R, 0, 0)) freeKnocked();
  if (meleeCd <= 0) {
    let target = null, td = 1e9; const consider = (pos, extra, kind, ref) => { const d = Math.hypot(pos.x - px, pos.z - pz); if (d < R + extra && d < td) { td = d; target = { kind, ref, pos }; } };

    for (const t of tanks) consider(t.g.position, 1.2, 'tank', t); for (const s of soldiers) consider(s.position, 0.9, 'soldier', s); for (const o of drivers) consider(o.g.position, 0.8, 'car', o);
    if (target) { meleeCd = 0.55; me.act('hit'); faceY = Math.atan2(target.pos.x - px, target.pos.z - pz);
      if (target.kind === 'rival') { /* close combat with a rival is the brawl mini game */ }
      else if (target.kind === 'tank') { const i = tanks.indexOf(target.ref); if (i >= 0) { tanks.splice(i, 1); twisters.scatter([target.ref.g], g.position.clone(), 5); fx.explode(target.pos.clone(), 1); award(250, target.pos, 'TANK'); grow(1.5); sfx.boom(); } }
      else if (target.kind === 'soldier') { const i = soldiers.indexOf(target.ref); if (i >= 0) { soldiers.splice(i, 1); delete target.ref.updateMatrixWorld; twisters.scatter([target.ref], g.position.clone(), 6); award(40, target.pos, 'SOLDIER'); grow(0.6); sfx.hit(); } }
      else { const i = drivers.indexOf(target.ref); if (i >= 0) { drivers.splice(i, 1); blowCar(target.ref.g, target.pos.clone()); } } } }
  // traffic flees
  for (const o of drivers) { const p = o.g.position, d = Math.hypot(p.x - px, p.z - pz); if (!o.path.length) o.path = roadPathTo(o.cell, d < 14 ? px : p.x + (Math.random() - 0.5) * 30, d < 14 ? pz : p.z + (Math.random() - 0.5) * 30, d < 14); followPath(o, o.speed * (d < 14 ? 1.5 : 1), dt); }
  // soldiers and tanks shoot, and it hurts
  for (const s of soldiers) { const dx = s.position.x - px, dz = s.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
    if (d > 30) { if (!s.userData.frz) { s.userData.frz = true; s.updateMatrixWorld(true); s.updateMatrixWorld = noop; } continue; } if (s.userData.frz) { s.userData.frz = false; delete s.updateMatrixWorld; }
    if (d < 16) { s.rotation.y = Math.atan2(-dx, -dz); s.userData.cd -= dt; if (d < 4 + meScale) { s.position.x += dx / d * 1.4 * dt; s.position.z += dz / d * 1.4 * dt; animateWalk(s, dt, 1); } else animateWalk(s, dt, 0); s.userData.armR.rotation.x = -1.45; s.userData.armL.rotation.x = -1.3;
      if (s.userData.cd <= 0) { s.userData.cd = (stage === 1 ? 1.4 : 0.8) + Math.random() * 1.0; fireAt(s.position.clone().setY(0.45).addScaledVector(new THREE.Vector3(-dx / d, 0, -dz / d), 0.3), false); } } else animateWalk(s, dt, 0); }
  for (const t of tanks) { const p = t.g.position, d = Math.hypot(p.x - px, p.z - pz);
    t.repath -= dt; if (t.repath <= 0) { t.repath = 2; t.path = d > 10 ? roadPathTo(t.cell, px, pz, false) : d < 6 ? roadPathTo(t.cell, px, pz, true) : []; } followPath(t, 1.8, dt);
    const tur = t.g.userData.turret; const want = Math.atan2(px - p.x, pz - p.z) - t.g.rotation.y; tur.rotation.y += (Math.atan2(Math.sin(want - tur.rotation.y), Math.cos(want - tur.rotation.y))) * Math.min(1, dt * 4);
    t.cd -= dt; if (d < 20 && t.cd <= 0) { t.cd = 2.6 + Math.random() * 1.5; fireAt(new THREE.Vector3(0, 0.64, 1.25).applyMatrix4(tur.matrixWorld), true); } }
  for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.life -= dt; if (s.big) s.vel.y -= 2 * dt; s.m.position.addScaledVector(s.vel, dt);
    if (s.life <= 0) { if (s.big) fx.explode(s.m.position.clone(), 0.5); else fx.puff('smoke', s.m.position.clone(), 0.25); scene.remove(s.m); shots.splice(i, 1);
      if (Math.hypot(s.m.position.x - px, s.m.position.z - pz) < R + 0.8) hurt((s.big ? 1.6 : 0.35) * ARMY_DMG[stage], s.big); } }
  updatePlanes(dt, px, pz); updateRival(dt, px, pz);
  for (let i = sinking.length - 1; i >= 0; i--) { const s = sinking[i]; s.t = Math.min(1, s.t + dt * 1.1); s.obj.rotation.z = s.t * 0.4; s.obj.position.y = s.y0 - s.t * s.h * 0.95; if (s.t >= 1) { s.obj.visible = false; sinking.splice(i, 1); } }
  // HUD
  const m = Math.floor(tLeft / 60), s = Math.floor(tLeft % 60); setT('taTime', m + ':' + String(s).padStart(2, '0')); if (hudCache.red !== (tLeft < 15)) { hudCache.red = tLeft < 15; $('taTime').style.color = tLeft < 15 ? '#ff5a3a' : ''; }
  setT('taScore', score); setT('taCombo', mult() > 1 && played - lastHit < 2.5 ? 'x' + mult() + ' COMBO' : ''); setT('taRank', STAGE[stage]); setT('taPct', Math.round((bDone / totalB) * 100) + '% destroyed'); setT('taPeople', peopleN + ' eaten');
  { const w = (meF * 100).toFixed(1) + '%'; if (hudCache.grow !== w) { hudCache.grow = w; $('taGrowFill').style.width = w; } const pw = Math.round(power * 100) + '%'; if (hudCache.pw !== pw) { hudCache.pw = pw; $('kjPowerFill').style.width = pw; $('kjPower').classList.toggle('full', power >= 1); setT('kjPowerTxt', power >= 1 ? '⚡ ' + K.spells[stage - 1].toUpperCase() + ' READY: TAP A TARGET' : '⚡ POWER'); } }
  setStormLevel(stage * 2 - 1 + (rival && rival.hp > 0 ? 1 : 0));
  if (bDone >= totalB && poiOrder.every((k) => pois[k].done)) tLeft = Math.min(tLeft, 1.5);
  { let n = 0; for (const k of poiOrder) { const P = pois[k]; if (P.done) { n++; continue; } const ready = stage >= POI[k].stage; if (P.chip) P.chip.classList.toggle('ready', ready); P.arrow.classList.toggle('ready', ready); edgeArrow(P.arrow, P.center, true); }
    const need = Math.min(L().need, poiOrder.length); setT('taTargets', '🎯 ' + n + '/' + need); if (hudCache.tgtOk !== (n >= need)) { hudCache.tgtOk = n >= need; $('taTargets').style.color = n >= need ? '#7dff3a' : ''; } }
  mapT -= dt; if (mapT <= 0) { mapT = 0.08; drawMini(); }
}

addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight, false)); renderer.setSize(innerWidth, innerHeight, false);
const camTarget = new THREE.Vector3(); let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (state === 'play') update(dt); else if (state === 'dying' && me) { me.anim(dt, 0); if (rival) rival.rig.anim(dt, 0); } else if (me) me.anim(dt, 0.15);
  if (city) { twisters.update(dt); fx.update(dt); city.updateRain(dt); spells.update(dt); }
  bannerT -= dt; if (bannerT <= 0) $('taBanner').style.opacity = 0;
  flashT = Math.max(0, flashT - dt); flashEl.style.opacity = Math.min(0.75, flashT * 3); hurtT = Math.max(0, hurtT - dt); darkT = Math.max(0, darkT - dt); darkEl.style.opacity = Math.min(0.72, darkT * 1.4); hurtEl.style.opacity = Math.min(0.55, hurtT * 2);
  camK += ((megaT > 0 ? 1.15 : [1, 1, 1.15, 1.32][stage]) - camK) * Math.min(1, dt * 1.2);
  const a = innerWidth / innerHeight, s = me ? meScale / 1.5 : 1, base = 7.2 + s * 2.8, half = (a < 1 ? base / a * 0.8 : base) * zoom * camK;
  cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
  if (me) camTarget.lerp(tmp.set(me.g.position.x, 1 + meScale * 0.4, me.g.position.z), Math.min(1, dt * 3)); cam.position.copy(camTarget).addScaledVector(isoDir, 80); cam.lookAt(camTarget);
  if (CINE && me) { cineCam.aspect = a; cineCam.updateProjectionMatrix(); const P = me.g.position, R = rival && rival.hp > 0 && rival.koT <= 0 ? rival.g.position : null, sep = R ? Math.hypot(R.x - P.x, R.z - P.z) : 0;
    // side-on: with a rival close by, frame both from beside the line between them; otherwise circle the monster slowly
    let mx = P.x, mz = P.z, px, pz; if (R && sep < 30) { mx = (P.x + R.x) / 2; mz = (P.z + R.z) / 2; px = -(R.z - P.z) / (sep || 1); pz = (R.x - P.x) / (sep || 1); } else { const an = 1.2 + played * 0.04; px = Math.cos(an); pz = Math.sin(an); }
    const d = 3 + meScale * 1.7 + (R && sep < 30 ? sep * 0.5 : 0); cineTo.set(mx + px * d, 0.8 + meScale * 1.5, mz + pz * d); cineAt.set(mx, meScale * 1.05, mz); if (!cineCam.userData.on) { cineCam.position.copy(cineTo); cineCam.userData.on = 1; cineLook.copy(cineAt); }
    cineCam.position.lerp(cineTo, Math.min(1, dt * 2)); cineLook.lerp(cineAt, Math.min(1, dt * 2)); cineCam.lookAt(cineLook); }
  updatePops(dt); cullChunks(); perfTick(); renderer.render(scene, viewCam());
}
// the title screen: a calm town with your kaiju in it
function showcase() { if (state !== 'start') return; makeMe(); me.g.position.set(0, 0, 0); camTarget.set(0, 2, 0); }
buildWorld(); makeMe(); camTarget.set(0, 2, 0);
requestAnimationFrame(frame);
window.__kj = { dropMega, goMega, megaBlast, get megaT() { return megaT; }, get megaDrop() { return megaDrop; }, THREE, get me() { return me; }, get moveTo() { return moveTo; }, get mass() { return mass; }, set mass(v) { mass = v; }, get massTarget() { return massTarget; }, get stage() { return stage; }, get power() { return power; }, set power(v) { power = v; }, get rival() { return rival; }, spawnRival, spawnPlane, get planes() { return planes; }, get state() { return state; }, get score() { return score; }, get people() { return people; }, get buildings() { return buildings; }, get pois() { return pois; }, get tanks() { return tanks; }, get soldiers() { return soldiers; }, tapAt, get cam() { return cam; }, set tLeft(v) { tLeft = v; }, set level(v) { level = v; }, start, hurt, get calls() { return renderer.info.render.calls; }, get fires() { return fires; }, get mini() { return mini && { ...mini, side: mini.side }; }, startMini, get pool() { return pool.length; }, get unlocked() { return unlockedKaiju(); }, set pick(v) { pick = v; } };
