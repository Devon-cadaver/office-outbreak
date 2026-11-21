import { radioButton } from '../radioBox.js';
// Kaiju Madness: you are the monster. It plays like Tornado Alley, but the city fights back for real. You stomp through
// town eating people (that's how you grow), your kaiju hits whatever's closest on its own, and a tap walks you somewhere,
// or, when your Power bar is full, casts your spell at what you tapped. One bar is your size and your health: the army,
// napalm planes and rival kaiju drain it, and you shrink a stage (Colossus -> Titan -> Hatchling) when it drops below a
// stage's line. Empty it as a Hatchling and the round's over. Two rival kaiju come for you at each stage. New kaiju are won in the end-of-round prize games.
import * as THREE from 'three';
import { generateMaze, buildCity, toWorld, toCell, findPath, CELL, mulberry32 } from '../city.js';
import { makeCharacter, animateWalk } from '../poster/characters.js';
import { makeCar } from '../car.js';
import { isFuture, isPast, hoverize, futurePlane, pastPlane, buildCannon, buildChaserCoach, eraPicker, levelKey, bestKey, futureTank, laserBolt } from '../era.js';
import { createTwisters } from '../tornado.js';
import { createFires } from '../fire.js';
import { unlockAudio, soundToggle, setMusicDuck, setSfxPaused, skipSongBtn, sfx, stopMusic, setPlaneEngine, setStormLevel, stormBoost, playSongs, songState, gameMusic, SONGS_KAIJU } from '../audio.js';
import { armySkin, townSkin, equippedSkin, skinnedCarArgs, addCoins, CHAR_SKINS, getEquipped, totalReward, pauseSkinRow } from '../skins.js';
import { forceSeason, seasonChoice, seasonPicker } from '../season.js';
import { showPrizes } from '../prizes.js';
import { nukeBlast } from '../nuke.js';
import { stampVersion } from '../version.js';
import { initFullscreen } from '../fullscreen.js';
import { showHowTo, tip, clearTips } from '../howto.js';
import { coach, coachSeen, coachIdle, coachBusy, coachFrame, coachClear } from '../coach.js';
import { quickLevel, saveLast } from '../progress.js';
import { createCrowd } from '../crowd.js';
import { buildOutskirts } from '../outskirts.js';
import { createPreviews } from '../livePreview.js';
import { autoResolution, mergeStatic, bakeMovable, bakeUnits, setBakedGlow } from '../perf.js';
import { rides, spinners } from '../landmarks.js';
import { makePlane, makeTank } from '../ally/units.js';
import { KAIJU, KAIJU_IDS, FREE_KAIJU, KAIJU_SKINS, SKIN_LOOKS, buildKaiju } from './rigs.js';
import { buildChopper } from './rigsHD.js';
import { createSpells } from './spells.js';
import { createFoes } from '../ally/foes.js';
import { createPoiFx } from '../ally/poiFx.js';

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
const crowd = createCrowd(scene, 640), crowdLists = [[null, 0], [null, 1]]; // townsfolk and soldiers away from the monster: one draw call for the lot
let flashT = 0, hurtT = 0; const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;background:#dfeaff;opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(flashEl);
let darkT = 0; const darkEl = document.createElement('div'); darkEl.style.cssText = 'position:fixed;inset:0;background:#05020c;opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(darkEl);
const hurtEl = document.createElement('div'); hurtEl.style.cssText = 'position:fixed;inset:0;box-shadow:inset 0 0 40px 6px #ff2a2a;opacity:0;pointer-events:none;z-index:5;transition:opacity .1s'; document.body.appendChild(hurtEl);
const twisters = createTwisters(scene); twisters.setFx(fx); // only its debris (chunks flying and landing as rubble) is used here
stampVersion($('taStart'));

// ---------- tuning ----------
const LEVELS = [
  { name: 'Small Town', size: 21, time: 150, goal: 35, pois: 5, need: 2 },
  { name: 'Suburbs', size: 27, time: 170, goal: 35, pois: 6, need: 3 },
  { name: 'Downtown', size: 33, time: 195, goal: 35, pois: 7, need: 4 },
  { name: 'Metro', size: 39, time: 220, goal: 30, pois: 8, need: 6 },
  { name: 'Megacity', size: 47, time: 270, goal: 30, pois: 10, need: 10 },
  { name: 'The Sprawl', size: 57, time: 320, goal: 30, pois: 10, need: 10 }, // half as big again as Megacity
];
let level = 1; const L = () => LEVELS[level - 1];
const ramp = () => Math.min(1, (level - 1) / 4); // fights reach full strength in Megacity and stay there in The Sprawl
const SIZE_GUARD = [0, 0.6, 0.8, 1]; // a rival's hits on a Hatchling do 60%, a Titan 80%: early fights in big towns stay survivable while you grow
const RIVAL_HP = 300; // your hits do a set amount (a share of a Small Town rival), so tougher rivals in later towns really take longer // 0 in Small Town, 1 in Megacity: how much tougher fights get
const STAGE = ['', 'HATCHLING', 'TITAN', 'COLOSSUS'];
const stageOf = (f) => (f < 1 / 3 ? 1 : f < 2 / 3 ? 2 : 3);
const scaleOf = (f) => 1.5 + f * 3.2; // rigs are ~2 units tall at scale 1: about 3 tall as a hatchling, 9 as a colossus
const MAX_H = [0, 3.3, 6.3, 99]; // the tallest building each stage can flatten
const CHARGE = 9; // seconds for a full Power bar (smashing things fills it faster)
const unlockedLevel = () => { try { return Math.max(1, Math.min(LEVELS.length, +localStorage.getItem(levelKey('kj')) || 1)); } catch { return 1; } };
const unlockedKaiju = () => { try { const u = JSON.parse(localStorage.getItem('kj_unlocked') || '[]'); return [...FREE_KAIJU, ...u.filter((x) => KAIJU[x] && !FREE_KAIJU.includes(x))]; } catch { return [...FREE_KAIJU]; } };
const unlockKaiju = (id) => { const u = unlockedKaiju(); if (u.includes(id)) return false; u.push(id); try { localStorage.setItem('kj_unlocked', JSON.stringify(u.filter((x) => !FREE_KAIJU.includes(x)))); } catch { /* ignore */ } return true; };
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
  if (big && isFuture()) { const m = laserBolt(); m.position.copy(from); m.lookAt(to); scene.add(m); shots.push({ m, vel: dir.multiplyScalar(36), life: Ld / 36, big, laser: true }); fx.puff('flame', from, 0.3); sfx.laser(); return; }
  const m = new THREE.Mesh(big ? shellGeo : tracerGeo, big ? shellMat : tracerMat); m.position.copy(from); m.lookAt(to); scene.add(m);
  shots.push({ m, vel: dir.multiplyScalar(big ? 16 : 28), life: Ld / (big ? 16 : 28), big }); fx.puff('flame', from, big ? 0.6 : 0.25); if (big) sfx.boom(); else if (Math.random() < 0.3) sfx.throw();
}
function buildWorld() {
  if (city) { scene.remove(city.group); twisters.clear(); fx.clear(); poiFx.clear(); foes.clear(); for (const p of people) scene.remove(p); }
  cols = rows = L().size; const seed = (Math.random() * 1e6) | 0; const rng = mulberry32(seed); const big = cols / 21; forceSeason(seasonChoice() !== 'random' ? seasonChoice() : level >= 5 ? 'none' : ['none', 'halloween', 'christmas', 'july4'][(Math.random() * 4) | 0]); /* Random leaves Megacity plain: it's big enough already */
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
  hemi.intensity = 1.75; sun.intensity = 0.95; city = buildCity(scene, maze, 3 + (seed % 9973)); buildOutskirts(scene, cols, rows, seed); city.season.light(hemi, sun, scene); city.detail.clouds.visible = false; city.detail.clouds.material.opacity = 0;
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
    for (let i = 0; i < n; i++) { const c = makeCharacter(['worker', 'pink', 'plaid', 'hivis', 'suit', 'hoodie', 'punk', 'vest'][(rng() * 8) | 0], { skin: townSkin(), look: Math.random() }); c.scale.setScalar(0.25); c.position.set(w.x + (rng() - 0.5) * 1.6, 0, w.z + (rng() - 0.5) * 1.6); c.rotation.y = rng() * 6.28; c.userData.home = c.position.clone(); c.userData.goal = null; c.userData.wait = rng() * 3; scene.add(c); people.push(c); } }
  cars = city.cars.slice();
  roadCells = roads; for (const o of [...drivers, ...soldiers, ...tanks]) scene.remove(o.g || o); drivers = []; soldiers = []; tanks = []; for (const s of shots) scene.remove(s.m); shots = [];
  const farRoad = (min) => { for (let k = 0; k < 60; k++) { const [x, y] = roads[(rng() * roads.length) | 0]; const w = toWorld(x, y, cols, rows); if (Math.hypot(w.x, w.z) > min) return [x, y]; } return roads[0]; };
  for (let i = 0; i < 9 + 3 * (level - 1); i++) { const [x, y] = farRoad(5); const c = makeCar(...skinnedCarArgs([0xc23b3b, 0x4f8fd6, 0xe8d54a, 0xd8dde0, 0x3a8a5a][(rng() * 5) | 0])); c.scale.setScalar(0.8); const w = toWorld(x, y, cols, rows); c.position.set(w.x, 0, w.z); scene.add(c); drivers.push({ g: c, cell: [x, y], path: [], speed: 3 + rng() * 1.5 }); }
  for (let sq = 0; sq < 4 + 2 * (level - 1); sq++) { const [x, y] = farRoad(14); const w = toWorld(x, y, cols, rows); for (let i = 0; i < 3; i++) { const s = makeCharacter('vest', { skin: armySkin() }); s.scale.setScalar(0.25); s.position.set(w.x + (i - 1) * 0.5, 0, w.z + (rng() - 0.5) * 0.6); const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.6), new THREE.MeshLambertMaterial({ color: 0x22262a })); gun.position.set(0, -0.72, 0.25); s.userData.armR.add(gun); s.userData.cd = 1 + rng() * 2; scene.add(s); soldiers.push(s); } }
  for (let i = 0; i < 2 + (level - 1); i++) { const [x, y] = farRoad(18); const t = isPast() ? buildCannon() : makeTank(isFuture()); if (isFuture()) hoverize(futureTank(t), 0xff4fd8); const w = toWorld(x, y, cols, rows); t.position.set(w.x, 0, w.z); scene.add(t); tanks.push({ g: t, cell: [x, y], path: [], cd: 3 + rng() * 2, repath: 0 }); }
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
  // the scenery nothing ever moves (roads, trees, lamps, fences...) is baked into a few meshes per chunk, and so are the props
  const own = new Set(); for (const x of buildings) { own.add(x.obj); own.add(x.b); for (const m of x.b.userData.extras || []) own.add(m); }
  for (const pr of city.props) own.add(pr.g); for (const hz of city.hazards) for (const p of hz.parts || []) own.add(p); for (const a of city.season.anim) own.add(a.m);
  for (const ch of map.values()) { const list = []; for (const o of ch.children.slice()) { if (own.has(o)) continue; let skip = false; o.traverse((m) => { if (own.has(m) || m.isLine || m.isPoints || m.isInstancedMesh) skip = true; }); if (skip) continue;
      o.traverse((m) => { if (m.isMesh) list.push(m); }); }
    for (const m of list) if (m.parent !== ch) ch.attach(m); mergeStatic(ch, list);
    const props = city.props.filter((pr) => pr.g.parent === ch && !pr.knocked); const bk = bakeMovable(ch, props.map((pr) => pr.g)); if (bk) for (const pr of props) pr.bake = bk; }
  // whole buildings and landmarks are baked too, a few meshes per chunk for the lot (each used to be six or more draws
  // of its own). One is lifted back out, exactly as it was, the moment anything touches it: see live()
  setBakedGlow(1); baked.clear(); keyOf.clear(); const skipM = new Set(); for (const a of city.season.anim) a.m.traverse((m) => skipM.add(m));
  const unitsOf = new Map(), put = (ch, key, o) => { if (!ch || !ch.isChunk) return; let U = unitsOf.get(ch); if (!U) unitsOf.set(ch, (U = new Map())); let u = U.get(key); if (!u) U.set(key, (u = { key, objs: [] })); u.objs.push(o); keyOf.set(o, key); };
  for (const x of buildings) { put(x.obj.parent, x, x.obj); if (x.obj === x.b) for (const m of x.b.userData.extras || []) if (m.parent === x.obj.parent) put(m.parent, x, m); }
  for (const hz of city.hazards) for (const p of hz.parts || []) put(p.parent, hz, p);
  for (const [ch, U] of unitsOf) { const bk = bakeUnits(ch, [...U.values()], skipM); for (const key of U.keys()) { let l = baked.get(key); if (!l) baked.set(key, (l = [])); l.push(bk); } }
  chunks = [...map.values()]; for (const ch of chunks) { ch.box.expandByScalar(0.5); ch.updateMatrixWorld(true); ch.updateMatrixWorld = noop; }
}
const baked = new Map(), keyOf = new Map(); // which bakes hold each building or landmark, and which of those each object belongs to
function live(key) { const l = baked.get(key); if (!l) return; baked.delete(key); for (const bk of l) bk.unbake(key); } // out of the bake: its own meshes show again
function free(o) { const k = keyOf.get(o); if (k) live(k); if (o && o.parent && o.parent.isChunk) city.group.attach(o); } // back to the live group before anything moves it
function freeKnocked() { for (const pr of city.props) if (pr.knocked && pr.g.parent && pr.g.parent.isChunk) { if (pr.bake) { pr.bake.unbake(pr.g); pr.bake = null; } free(pr.g); } }
const frus = new THREE.Frustum(), projM = new THREE.Matrix4();
// ?cine=side: a trailer camera, low and beside the monster, slowly circling, with the HUD hidden
const CINE = new URLSearchParams(location.search).get('cine'); if (CINE) document.body.classList.add('cine'); const cineCam = new THREE.PerspectiveCamera(46, 1, 0.1, 400), cineTo = new THREE.Vector3(), cineAt = new THREE.Vector3(), cineLook = new THREE.Vector3();
const viewCam = () => (CINE ? cineCam : cam);
function cullChunks() { const vc = viewCam(); vc.updateMatrixWorld(); projM.multiplyMatrices(vc.projectionMatrix, vc.matrixWorldInverse); frus.setFromProjectionMatrix(projM); for (const ch of chunks) ch.visible = frus.intersectsBox(ch.box); }

// ---------- you ----------
let me = null, mass = 0, meF = 0.15, meScale = 1.5, stage = 1, topStage = 1, power = 0, slowT = 0, boostT = 0, meleeCd = 0, leap = null, faceY = 0;
function makeMe() { if (me) scene.remove(me.g); me = buildKaiju(pick, getEquipped()['kj_' + pick] || false); me.g.position.set(0, 0, 0); scene.add(me.g); mass = massTarget * 0.25; meF = 0.25; meScale = scaleOf(meF); me.g.scale.setScalar(meScale); stage = 1; topStage = 1; power = 0.4; leap = null; }
const reach = () => 0.55 + meScale * 0.5; // how far your stomps and jaws reach
function grow(m) { if (m > 0) m *= [1, 1.5, 1.2, 1][stage]; mass = Math.min(massTarget, mass + m); } // a hatchling grows fast
const ARMY_DMG = [0, 0.4, 0.75, 1]; // army damage by stage: small kaiju get off lightly
function hurt(pct, from) { if (bout && bout.buff < 0 && from) pct *= 1.5;
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
  for (const fo of foes.targets()) if (near(fo.pos, 60)) return fo.pos.clone().setY(0);
  return p;
}
let moveTo = null, stepT = 0, powerFull = false;
let shake = 0, hitStop = 0, slowMo = 0, mvx = 0, mvz = 0, wantX = 0, wantZ = 0, freeMove = false, stepSide = 1; const jolt = (v) => { shake = Math.max(shake, v); };
// shake: a jolt of the camera (0..1). hitStop: seconds the fight freezes on a big hit. slowMo: seconds of slow motion after a
// knockout. mvx/mvz: the monster's own velocity, which chases where the player is steering (bigger monsters take longer to get going and to stop)
function castAt(p) { power = 0; const face = Math.atan2(p.x - me.g.position.x, p.z - me.g.position.z); me.g.rotation.y = faceY = face; spells.cast(caster(me, stage), stage, p, {}); popup(me.g.position.clone().setY(meScale * 2), KAIJU[me.id].spells[stage - 1].toUpperCase() + '!', '#7dff3a'); }
// SPACE (computers): cast without aiming. It goes for the nearest rival, plane or tank in range; with none about, it lands
// a good stride ahead of the monster (further as it grows), so jumps, charges, beams and blasts all have room
function castKey() {
  if (state !== 'play' || !me || leap) return; if (megaT > 0 && !megaUsed) { megaBlast(); return; }
  if (power < 1) { popup(me.g.position.clone().setY(meScale * 2), 'POWER NOT READY', '#9fd6ff'); return; }
  const P = me.g.position, range = 12 + meScale * 1.5; let best = null, bd = range;
  const consider = (pos) => { const d = Math.hypot(pos.x - P.x, pos.z - P.z); if (d < bd) { bd = d; best = pos; } };
  if (rival && rival.hp > 0 && rival.koT <= 0) consider(rival.g.position); for (const t of tanks) consider(t.g.position); for (const pl of planes) if (pl.life > 0) consider(pl.g.position);
  let at; if (best) at = new THREE.Vector3(best.x, 0, best.z);
  else { const d = 5 + meScale * 1.4, lim = toWorld(cols - 1, rows - 1, cols, rows); at = new THREE.Vector3(Math.max(-lim.x, Math.min(lim.x, P.x + Math.sin(faceY) * d)), 0, Math.max(-lim.z, Math.min(lim.z, P.z + Math.cos(faceY) * d))); }
  castAt(at);
}
// keys in the mini games: SPACE taps (hold it for the Roar-Off), the arrow keys swipe
function miniKey(e, down) { const cx = innerWidth / 2, cy = innerHeight / 2, fire = (type, x, y) => miniEl.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
  if (e.key === ' ') { if (down && !e.repeat) fire('pointerdown', cx, cy); else if (!down) fire('pointerup', cx, cy); return true; }
  const dir = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[e.key.toLowerCase()]; if (dir && down && !e.repeat) { fire('pointerdown', cx, cy); fire('pointerup', cx + dir[0] * 90, cy + dir[1] * 90); return true; } return !!dir; }
function tapAt(cx, cy) {
  if (!finishBtn.classList.contains('hidden')) return; // the SPIN / RANDOM choice is up: taps elsewhere do nothing until you pick one
  const p = aimAt(cx, cy); if (!p) return;
  if (rival && rival.dazedT > 0 && !finishing && Math.hypot(p.x - rival.g.position.x, p.z - rival.g.position.z) < rival.scale * 1.2 && Math.hypot(me.g.position.x - rival.g.position.x, me.g.position.z - rival.g.position.z) < reach() + rival.scale * 1.1 + 1.5) { doFinisher(); return; }
  if (power >= 1 && !leap) { castAt(p); return; }
  if (nearRival() && !rival.dazedT) { playerSwing(); return; }
  moveTo = p;
}
const caster = (k, st) => ({ id: k.id, rig: k, g: k.g, stage: st });

// ---------- what spells and hits do to the world ----------
const spells = createSpells({ scene, fx, sfx, flash: (k) => { flashT = Math.max(flashT, k); }, dark: (s) => { darkT = Math.max(darkT, s); },
  hitArea, grabCar, grabBuilding, leap: (c, to, secs, onLand, h = 4, step = null, hide = false) => { if (c.rig === me) { leap = { from: me.g.position.clone(), to: to.clone(), t: 0, secs, onLand, h, step, hide, stepT: 0 }; if (hide) me.body.visible = false; } else onLand(); } });
// Tornado Time!'s enemies come here too: STORM CANNONS (Downtown on), GUNSHIPS (Metro on) and the UFO (Megacity on). Their
// blasts, rockets and ray hurt the monster instead of shrinking a storm; punches, spells and thrown bodies strike them
const foes = createFoes({ skip: ['rival'], scene, fx, twisters, S0: 1, MAX_S: 6, maxH: () => 99, rankOf: () => 0, rivalWreck() {}, absorbed() {},
  words: { cannon: 'It charges, then blasts along the orange line: that knocks you back and hurts. Step off the line, then smash the truck or blast it.', ship: 'Their freeze rockets slow your monster down. Keep moving, and swat them or blast them out of the sky.', ufo: 'Its shield stops your blows, and its green ray hurts: get out of the circle. When it drops low to beam people up, the shield is off: smash it or blast it. Three hits bring it down.' },
  speedBurst: (s) => { boostT = Math.max(boostT, s * 0.6); }, popup: (...a) => popup(...a), banner: (...a) => banner(...a), award: (...a) => award(...a), jolt: (v) => jolt(v), edgeArrow: (...a) => edgeArrow(...a), toScreen: (...a) => toScreen(...a), coach: (...a) => coach(...a), coachSeen: (...a) => coachSeen(...a),
  grow: (v) => { if (v >= 0) grow(v); else hurt(-v / massTarget * 100, true); }, flash: (v) => { flashT = Math.max(flashT, v); }, crashDamage: (p, r) => hitArea(p.clone().setY(0), r, 0, {}),
  boltTo: (at) => { fx.sparks(at, 14, { c: [0xffffff, 0xffd24a], speed: 7, up: 4, life: 0.45 }); fx.flash(at, 0.8, 0xfff0c0); }, // a blow lands (Tornado Time! strikes them with lightning)
  get twObj() { return me.g; }, get size() { return meScale * 0.5; }, get level() { return level; }, get played() { return played; }, get cols() { return cols; }, get massTarget() { return massTarget; },
  get buildings() { return buildings; }, get people() { return people; }, get roadCells() { return roadCells; }, get pois() { return pois; }, get poiOrder() { return poiOrder; }, radarDown: false });
// each big target goes up in its own way, as in Tornado Time!
const poiFx = createPoiFx(scene, fx, { jolt: (v) => jolt(v), popup: (...a) => popup(...a), flash: (v) => { flashT = Math.max(flashT, v); },
  arcTargets: (c, r, n) => buildings.filter((x) => !x.done).map((x) => [Math.hypot(x.pos.x - c.x, x.pos.z - c.z), x]).filter((e) => e[0] < r && e[0] > 2).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, x]) => ({ pos: new THREE.Vector3(x.pos.x, Math.min(x.h, 6), x.pos.z), hit: () => { if (!x.done && Math.random() < 0.4) fx.ignite(new THREE.Vector3(x.pos.x, 1, x.pos.z), 0.8, 4); } })) });
// a tank blown up goes up big: its ammunition cooks off in a ring of smaller blasts
function tankBoom(q) { const at = q.clone().setY(0.6); fx.explode(at, 2.6); fx.shock(q, 5.5, 0xffb060, 0.5); fx.glow(q, 6, 0xffa040, 1, 0.5); fx.scorch(q, 2.4); fx.sparks(at, 26, { speed: 9, up: 8, life: 0.9 }); flashT = Math.max(flashT, 0.2); jolt(0.6); sfx.boom();
  for (let k = 0; k < 4; k++) { const a = k * 1.57 + Math.random(), p = new THREE.Vector3(q.x + Math.cos(a) * 1.3, 0.5, q.z + Math.sin(a) * 1.3); anims.push({ wait: 0.09 + k * 0.07, t: 0, dur: 0.01, go() { fx.explode(p, 1.1); }, f() {}, end() {} }); } setTimeout(() => sfx.boom(), 160); if (city.knock(q.x, q.z, 2.6, 0, 0)) freeKnocked(); }
const sinking = [];
function crumble(x, label, fire, from, squash) { // from: where the blow came from. squash: trodden flat by something far bigger
  // a building comes down in a cloud of dust
  free(x.obj); x.done = true; bDone++; { const i = city.obstacles.findIndex((o) => Math.abs(o.x - x.pos.x) < 0.3 && Math.abs(o.z - x.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); }
  if (x.b.userData.edges) x.b.userData.edges.visible = false; const ex = x.obj === x.b ? (x.b.userData.extras || []).filter((m) => m.parent) : [];
  // it cracks, then bursts into pieces of itself (walls with their windows, the floors inside), thrown away from the blow
  twisters.tear(x.obj, x.pos, new THREE.Box3().setFromObject(x.obj).getSize(new THREE.Vector3()), null, [], ex, { collapse: true, from: from || null, power: 0.8 + Math.min(1.2, meScale * 0.25), squash: !!squash });
  fx.puff('smoke', new THREE.Vector3(x.pos.x, 0.8, x.pos.z), 1.2 + x.h * 0.15); if (fire) fx.ignite(new THREE.Vector3(x.pos.x, 0.5, x.pos.z), 0.9, 5);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28 + Math.random(); fx.dust({ x: x.pos.x + Math.cos(a) * 1.1, y: 0, z: x.pos.z + Math.sin(a) * 1.1 }, 0.8 + x.h * 0.12, Math.cos(a) * 2, Math.sin(a) * 2); } fx.sparks({ x: x.pos.x, y: Math.min(2, x.h * 0.5), z: x.pos.z }, 6, { speed: 4, up: 3, life: 0.45 }); jolt(Math.min(0.45, 0.1 + x.h * 0.05));
  spill(x.pos, Math.min(6, 2 + Math.floor(x.h * 0.7))); award(x.pts, x.pos, label); grow(x.h * 0.35); power = Math.min(1, power + 0.025); sfx.crunch(x.h > 5); if (x.h > 5) { sfx.boom(); flashT = Math.max(flashT, 0.1); } else if (Math.random() < 0.5) sfx.hit();
}
const chunkGeo = new THREE.BoxGeometry(1, 1, 1), chunkMats = new Map(); const chunkMat = (c) => { if (!chunkMats.has(c)) chunkMats.set(c, new THREE.MeshLambertMaterial({ color: c })); return chunkMats.get(c); };
function eat(c, i, bonus) { people.splice(i, 1); peopleN++; gulps.push({ c, t: 0, from: c.position.clone() }); award(bonus || 25, c.position); grow(1.2); power = Math.min(1, power + 0.01); }
const gulps = []; // people on their way into the kaiju's mouth
// eaten people go back in a pool and come out of the next building that falls, so spilling crowds costs nothing to build
const pool = [], OUTFITS = ['worker', 'pink', 'plaid', 'hivis', 'suit', 'hoodie', 'punk', 'vest'];
function spill(at, n) {
  if (people.length > 420) return; let made = 0;
  for (let i = 0; i < n; i++) { let c = pool.pop(); if (!c) { if (made >= 3) break; c = makeCharacter(OUTFITS[(Math.random() * 8) | 0], { skin: townSkin() }); made++; }
    c.scale.setScalar(0.25); c.rotation.set(0, Math.random() * 6.28, 0); const a = Math.random() * 6.28, r = 0.6 + Math.random() * 1.4; c.position.set(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r);
    Object.assign(c.userData, { home: c.position.clone(), goal: null, wait: Math.random(), frz: false }); delete c.updateMatrixWorld; scene.add(c); people.push(c); }
}
function blowCar(g, q) { free(g); twisters.scatter([g], q, 6); fx.explode(q.clone().setY(0.4), 1); fx.ignite(q.clone().setY(0.2), 0.7, 5); carsN++; award(80, q, 'BOOM'); grow(0.5); }
function hitArea(c, r, pow, o = {}) {
  if (o.hostile) { if (me && Math.hypot(me.g.position.x - c.x, me.g.position.z - c.z) < r + reach() * 0.6) hurt(pow * 0.13, true); return; }
  const cap = megaT > 0 || o.mega ? 99 : MAX_H[Math.min(3, stage + 1)];
  for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - c.x, x.pos.z - c.z); if (d > r) continue; if (x.h <= cap) { crumble(x, o.freeze ? 'SHATTERED' : '', o.fire, c); o.n = (o.n || 0) + 1; } else if (o.fire) fx.ignite(new THREE.Vector3(x.pos.x, 1, x.pos.z), 0.8, 4); }
  for (let i = people.length - 1; i >= 0; i--) { const p = people[i]; if (Math.hypot(p.position.x - c.x, p.position.z - c.z) < r) { people.splice(i, 1); peopleN++; award(20, p.position); grow(0.5); if (o.push) twisters.scatter([p], c, 6); else { scene.remove(p); fx.puff(o.freeze ? 'smoke' : 'flame', p.position.clone().setY(0.3), 0.4); } } }
  for (let i = drivers.length - 1; i >= 0; i--) { const q = drivers[i].g.position; if (Math.hypot(q.x - c.x, q.z - c.z) < r + 0.5) { const g = drivers[i].g; drivers.splice(i, 1); blowCar(g, q.clone()); } }
  for (let i = cars.length - 1; i >= 0; i--) { const q = cars[i].getWorldPosition(new THREE.Vector3()); if (Math.hypot(q.x - c.x, q.z - c.z) < r + 0.5) { const g = cars[i]; cars.splice(i, 1); blowCar(g, q); } }
  for (let i = soldiers.length - 1; i >= 0; i--) { const s = soldiers[i]; if (Math.hypot(s.position.x - c.x, s.position.z - c.z) < r) { soldiers.splice(i, 1); delete s.updateMatrixWorld; twisters.scatter([s], c, 5); award(40, s.position, 'SOLDIER'); grow(0.6); } }
  for (let i = tanks.length - 1; i >= 0; i--) { const t = tanks[i]; if (Math.hypot(t.g.position.x - c.x, t.g.position.z - c.z) < r + 0.6) { tanks.splice(i, 1); twisters.scatter([t.g], c, 6); tankBoom(t.g.position.clone()); award(250, t.g.position, 'TANK'); grow(1.5); } }
  for (const pl of planes) if (pl.life > 0 && Math.hypot(pl.g.position.x - c.x, pl.g.position.z - c.z) < r + 1.6) downPlane(pl);
  if (rival && rival.hp > 0 && Math.hypot(rival.g.position.x - c.x, rival.g.position.z - c.z) < r + rival.scale * 0.6) { if (!o.hitRival || !o.hitRival.has(rival)) { o.hitRival = o.hitRival || new Set(); o.hitRival.add(rival); hitRival(pow, o.freeze); } }
  if (!o.hostile) foes.hitAt(c, r);
  if (city.knock(c.x, c.z, r, 0, 0)) freeKnocked();
}
// a body swung low or skidding along the ground wrecks buildings, cars, tanks and people under it (throttled by distance)
function plough(at, rad, skip) { if (skip.lastP && skip.lastP.distanceToSquared(at) < 0.8) return; skip.lastP = at.clone(); { const o = { hitRival: skip.set, push: true }; hitArea(at.clone().setY(0), rad, 0, o); skip.n = (skip.n || 0) + (o.n || 0); } if (Math.random() < 0.5) fx.puff('smoke', at.clone().setY(0.3), 0.5 + rad * 0.3); }
function grabCar(at) { let best = null, bd = 12, bi = -1, list = null; for (let i = 0; i < drivers.length; i++) { const d = drivers[i].g.position.distanceTo(at); if (d < bd) { bd = d; best = drivers[i].g; bi = i; list = drivers; } } for (let i = 0; i < cars.length; i++) { const d = cars[i].getWorldPosition(new THREE.Vector3()).distanceTo(at); if (d < bd) { bd = d; best = cars[i]; bi = i; list = cars; } }
  if (!best) return null; list.splice(bi, 1); free(best); scene.attach(best); carsN++; return best; }
function grabBuilding(at) { let best = null, bd = 14; for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - at.x, x.pos.z - at.z); if (d < bd) { bd = d; best = x; } } if (!best) return null;
  free(best.obj); best.done = true; bDone++; { const i = city.obstacles.findIndex((o) => Math.abs(o.x - best.pos.x) < 0.3 && Math.abs(o.z - best.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); } if (best.b.userData.edges) best.b.userData.edges.visible = false;
  if (best.obj === best.b) for (const m of best.b.userData.extras || []) m.visible = false; /* its snow, lights and signs go with it instead of hanging in the air */ award(best.pts, best.pos, 'RIPPED UP'); grow(best.h * 0.35); scene.attach(best.obj); return best.obj; }

// ---------- score, popups, banners ----------
let score = 0, chain = 0, lastHit = -9, tLeft = 150, played = 0, peopleN = 0, carsN = 0, bDone = 0, tooBigT = 0, ko = 0;
const mult = () => Math.min(5, 1 + Math.floor(chain / 4));
function award(base, pos, label) { if (played - lastHit < 2.5) chain++; else chain = 0; lastHit = played; sfx.coin(chain); const pts = Math.round(base * mult()); score += pts; popup(pos, '+' + pts + (label ? ' ' + label : ''), mult() > 1 ? '#ff9a3a' : '#ffe27a'); return pts; }
const pops = []; for (let i = 0; i < 14; i++) { const el = document.createElement('div'); el.className = 'pop'; el.style.display = 'none'; document.body.appendChild(el); pops.push({ el, t: 0, p: new THREE.Vector3() }); }
const SHOUTS = ['RUN!', 'AAAH!', 'MONSTER!', 'NOPE!', 'IT IS HUGE!', 'DO NOT EAT ME!', 'HELP!']; // what people yell as they leg it
let popI = 0; function popup(pos, text, color) { const o = pops[popI++ % pops.length]; o.t = 1; o.p.set(pos.x, (pos.y || 0) + 1.5, pos.z); o.el.textContent = text; o.el.style.color = color; o.el.style.display = 'block'; }
function updatePops(dt) { for (const o of pops) { if (o.t <= 0) continue; o.t -= dt * 0.9; o.p.y += dt * 1.6; const v = o.p.clone().project(cam); o.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%)'; o.el.style.opacity = Math.min(1, o.t * 2); if (o.t <= 0) o.el.style.display = 'none'; } }
let bannerT = 0; function banner(text) { $('taBanner').textContent = text; $('taBanner').style.opacity = 1; bannerT = 2.2; }

// ---------- napalm planes: they hunt you and carpet the street with fire ----------
let planes = [], planeT = 35, noPlanes = false; const bombs = [], fires = [];
const bombGeo = new THREE.SphereGeometry(0.16, 8, 6), bombMat = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });
function spawnPlane() {
  const lim = toWorld(cols - 1, rows - 1, cols, rows); const a = Math.random() * Math.PI * 2, R0 = Math.max(lim.x, lim.z) + 8;
  const g = makePlane(); if (isFuture()) futurePlane(g); else if (isPast()) pastPlane(g); g.position.set(Math.cos(a) * R0, 7 + Math.random(), Math.sin(a) * R0); scene.add(g);
  g.traverse((m) => { if (m.isMesh && m.material.color && m.material.color.getHex() === 0xf07a28) m.material = m.material.clone(), m.material.color.setHex(0x8a2a1a); }); // dark red: these ones drop napalm
  const arrow = document.createElement('div'); arrow.className = 'planeArrow'; arrow.textContent = '✈'; document.body.appendChild(arrow);
  planes.push({ g, arrow, heading: Math.atan2(-g.position.x, -g.position.z), life: 28, cool: 0, dropT: 0 }); banner('✈ NAPALM PLANE!'); sfx.whoosh();
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
// how far down the top bar reaches: arrows, tips and first-time cards all keep below it
let hudH = 116; function measureHud() { const r = $('ta').querySelector('.top').getBoundingClientRect(); if (r.height) { hudH = Math.round(r.bottom); document.body.style.setProperty('--hudH', hudH + 'px'); } }
addEventListener('resize', () => setTimeout(measureHud, 60));
function edgeArrow(el, pos, show) { const v = pos.clone().project(cam); const off = Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95; el.style.display = show && off ? 'block' : 'none'; if (!off) return v;
  const a = Math.atan2(v.y, v.x), k = 0.9 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); el.style.transform = 'translate(' + ((Math.cos(a) * k * 0.5 + 0.5) * innerWidth) + 'px,' + Math.max(hudH + 22, (-Math.sin(a) * k * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%)'; /* never up under the top bar */ const dir = el.firstElementChild; if (dir && dir.tagName === 'I') dir.style.transform = 'rotate(' + (-a) + 'rad)'; return v; }

// ---------- rival kaiju: two come for you at each stage you reach ----------
let rival = null, rivalQueue = [], rivalWait = 0; const rivalEl = $('kjRival'), rivalArrow = document.createElement('div'); rivalArrow.className = 'planeArrow rivalArrow'; rivalArrow.innerHTML = '<i>➤</i><em>👹</em>'; document.body.appendChild(rivalArrow);
function queueRivals(st) { rivalQueue.push(18, 40); } // seconds after reaching the stage
function spawnRival(forceId) {
  const pool = KAIJU_IDS.filter((x) => x !== me.id); const id = forceId || pool[(Math.random() * pool.length) | 0]; const st = Math.min(3, stage + (Math.random() < 0.3 ? 1 : 0));
  const rig = buildKaiju(id); const f = (st - 0.5) / 3, sc = scaleOf(f); rig.g.scale.setScalar(sc);
  const far = []; for (const c of roadCells) { const w = toWorld(c[0], c[1], cols, rows); const d = Math.hypot(w.x - me.g.position.x, w.z - me.g.position.z); if (d > 20 && d < 34) far.push(w); }
  const w = far.length ? far[(Math.random() * far.length) | 0] : toWorld(1, 1, cols, rows); rig.g.position.set(w.x, 0, w.z); scene.add(rig.g);
  const hp0 = Math.round(RIVAL_HP * (1 + 0.6 * ramp())); rival = { id, rig, g: rig.g, stage: st, scale: sc, hp: hp0, max: hp0, cd: 1.5, castT: (6 + Math.random() * 3) * (1 - 0.3 * ramp()), stun: 0, koT: 0, daze: 0, dazedT: 0, atk: null };
  $('kjRivalName').textContent = KAIJU[id].name + ' · ' + STAGE[st]; rivalEl.classList.remove('hidden'); banner('👹 RIVAL: ' + KAIJU[id].name + '!'); sfx.wave();
}
function hitRival(pow, freeze) { if (!rival || rival.hp <= 0) return; if (bout && bout.buff > 0) pow *= 1.5; rival.hp -= pow; flashRig(rival.rig); if (me) shove(rival.rig, rival.g.position.x - me.g.position.x, rival.g.position.z - me.g.position.z, Math.min(0.3, 0.06 + pow / RIVAL_HP * 2)); if (freeze) rival.stun = 2.5; popup(rival.g.position.clone().setY(rival.scale * 1.8), '-' + Math.round(pow), '#ffb02a'); if (rival.hp <= 0) rivalKO(); }
function rivalKO() {
  const r = rival; clearDots(); fightEdge.classList.add('hidden'); if (r.ring) scene.remove(r.ring); r.atk = null; finishBtn.classList.add('hidden'); r.hp = 0; r.koT = 2.2; r.rig.act('ko'); ko++; award(2500 * r.stage, r.g.position, 'K.O.!'); sfx.boom(); flashT = 0.3; jolt(1); slowMo = 0.55; fx.shock(r.g.position, r.scale * 3); for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; fx.dust({ x: r.g.position.x + Math.cos(a) * r.scale, y: 0, z: r.g.position.z + Math.sin(a) * r.scale }, 0.8 + r.scale * 0.3, Math.cos(a) * 3, Math.sin(a) * 3); } // the knockout: the world slows for a beat mini = null; miniEl.className = 'hidden';
  // ...and then you eat it: a monster meal is a big boost (size, full Power, a burst of speed)
  const rid = roundId; setTimeout(() => { if (state !== 'play' || rid !== roundId) return; grow(massTarget * (0.16 + 0.06 * r.stage)); power = 1; boostT = 5; me.act('cast'); banner('MONSTER MEAL!'); popup(me.g.position.clone().setY(meScale * 2), '+SIZE +POWER', '#7dff3a'); sfx.pickup(); }, 1300);
  banner('K.O.!'); stormBoost(2);
}

// ---------- MEGA KAIJU: now and then a glowing booster drops somewhere nearby. Grab it and for 10 seconds you are bigger
// than a Colossus, smash anything, take no damage, and get one MEGA spell: tap and it goes off around you (a nuke for
// the atomic monsters and the machines, a huge sonic roar for the rest). Not used by the end? It goes off anyway. ----------
const MEGA_SECS = 10;
let megaT = 0, megaUsed = false, megaDrop = null, megaDropT = 30; const blasts = [];
const megaArrow = document.createElement('div'); megaArrow.className = 'planeArrow megaArrow'; megaArrow.innerHTML = '<i>➤</i><em>⚡</em>'; document.body.appendChild(megaArrow);
const megaEl = document.createElement('div'); megaEl.id = 'kjMega'; megaEl.className = 'hidden'; document.body.appendChild(megaEl);
// the mega blast has its own button, so you can save it for the right moment (it still goes off by itself when mega runs out)
const megaBtn = document.createElement('button'); megaBtn.id = 'kjMegaBtn'; megaBtn.className = 'hidden'; document.body.appendChild(megaBtn);
megaBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (state === 'play' && megaT > 0 && !megaUsed) { megaBlast(); megaBtn.classList.add('hidden'); } });
const NUKERS = new Set(['mike', 'godzilly', 'mecha', 'mechax', 'destroyah', 'spaceyzilla', 'smogorah', 'megalawn']);
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
  scene.add(g); megaDrop = { g, orb, halo, rings, life: 25 }; banner('⚡ MEGA BOOSTER DROPPED!'); sfx.power(); popup(g.position.clone().setY(4), 'MEGA BOOSTER!', '#ffd21a');
}
function updateMega(dt) {
  if (megaDrop) { const D = megaDrop; D.life -= dt; const t = played; D.orb.rotation.y += dt * 2; D.orb.position.y = D.halo.position.y = 2 + Math.sin(t * 3) * 0.3; D.rings[0].rotation.set(t * 1.7, t, 0); D.rings[1].rotation.set(-t, t * 1.3, 0.5); D.halo.scale.setScalar(1 + Math.sin(t * 6) * 0.1);
    edgeArrow(megaArrow, D.g.position, true);
    if (Math.hypot(D.g.position.x - me.g.position.x, D.g.position.z - me.g.position.z) < reach() + 1.6) { scene.remove(D.g); megaDrop = null; megaArrow.style.display = 'none'; goMega(); }
    else if (D.life <= 0) { scene.remove(D.g); megaDrop = null; megaArrow.style.display = 'none'; megaDropT = 40 + Math.random() * 30; } }
  else if (megaT <= 0 && !mini) { megaDropT -= dt; if (megaDropT <= 0) dropMega(); }
  if (megaT > 0) { megaT -= dt; if (Math.random() < dt * 14) fx.puff('flame', me.g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * meScale, 0.3, (Math.random() - 0.5) * meScale)), 0.8);
    megaEl.textContent = '⚡ MEGA ' + KAIJU[me.id].name + ' · ' + Math.ceil(megaT) + 's' + ''; megaBtn.textContent = megaKind(me.id) === 'nuke' ? '☢️ MEGA NUKE' : '📣 MEGA ROAR'; megaBtn.classList.toggle('hidden', megaUsed || !!mini || !finishBtn.classList.contains('hidden') || !rangedBtn.classList.contains('hidden'));
    if (megaT <= 0) { if (!megaUsed) megaBlast(); megaT = 0; megaEl.className = 'hidden'; megaBtn.classList.add('hidden'); banner('MEGA OVER'); megaDropT = 50 + Math.random() * 30; } }
  for (let i = blasts.length - 1; i >= 0; i--) if (!blasts[i].update(dt)) blasts.splice(i, 1);
}
function goMega() { megaT = MEGA_SECS; megaUsed = false; power = 1; boostT = MEGA_SECS; megaEl.className = ''; banner('⚡ MEGA ' + KAIJU[me.id].name + '!'); me.act('cast'); sfx.boom(); flashT = 0.35; stormBoost(3); }
function megaBlast() {
  megaUsed = true; const at = me.g.position.clone().setY(0), kind = megaKind(me.id), R = 18 + meScale * 1.2, o = {};
  banner(kind === 'nuke' ? '☢️ MEGA NUKE!' : '🔊 MEGA ROAR!'); me.act('cast'); flashT = kind === 'nuke' ? 1.2 : 0.5; sfx.boom(); setTimeout(() => sfx.boom(), 200); setTimeout(() => sfx.boom(), 450);
  let done = 0; blasts.push(nukeBlast(scene, at, R, { kind, color: me.tint ?? null, green: me.id === 'mike', secs: kind === 'nuke' ? 1.6 : 1.1, onRadius: (r) => { if (r - done < 1.2) return; done = r; hitArea(at, r, 45, o); } }));
}
// each round's prize games hand out monsters: 90% of rounds give at least one, 20% give two (on the first goes; if the
// round has fewer goes, the last go gives the rest). One you already have pays a whole coin
let kjLeft = 0, goesLeft = 0;
function kaijuRound(goes) { const r = Math.random(); kjLeft = r < 0.2 ? 2 : r < 0.9 ? 1 : 0; goesLeft = goes; }
function kaijuPrize() { goesLeft--; if (kjLeft <= 0) return null; const n = goesLeft <= 0 ? kjLeft : 1; kjLeft -= n; const pool = KAIJU_IDS.filter((x) => !FREE_KAIJU.includes(x)); let fresh = false; const txt = [];
  for (let i = 0; i < n; i++) { const id = pool[(Math.random() * pool.length) | 0], name = KAIJU[id].name; if (unlockKaiju(id)) { fresh = true; txt.push('NEW: ' + name + '!'); } else { addCoins(1); txt.push(name + ' (owned): +1 coin'); } }
  if (fresh) drawPicker(); return fresh ? { kind: 'kaiju', text: txt.join('  ') } : { kind: 'dupe', slot: 'kaiju', text: txt.join('  ') }; }
function updateRival(dt, px, pz) {
  if (!rival) { rivalWait -= dt; for (let i = 0; i < rivalQueue.length; i++) rivalQueue[i] -= dt; if (rivalQueue.length && rivalQueue[0] <= 0 && rivalWait <= 0) { rivalQueue.shift(); spawnRival(); } rivalEl.classList.add('hidden'); rivalArrow.style.display = 'none'; return; }
  const r = rival, g = r.g; r.rig.anim(dt, r.koT > 0 ? 0 : r.moving ? 1 : 0.15);
  if (r.koT > 0) { r.koT -= dt; if (r.koT <= 1.0 && me) { const k = Math.min(1, dt * 3); const mth = me.mouth.getWorldPosition(tmp); g.position.lerp(mth, k); g.scale.setScalar(Math.max(0.01, r.scale * (r.koT / 1.0))); } if (r.koT <= 0) { scene.remove(g); fx.puff('smoke', g.position.clone().setY(1), 2.5); rival = null; rivalWait = 6; } rivalEl.classList.add('hidden'); rivalArrow.style.display = 'none'; return; }
  if (r.toss) { const T = r.toss; T.t += dt; const k = Math.min(1, T.t / T.secs), q = 1 - Math.pow(1 - k, 2); g.position.lerpVectors(T.from, T.to, q); g.position.y = T.from.y * Math.max(0, 1 - k * 4) + Math.sin(Math.min(1, k / 0.25) * Math.PI) * r.scale * 0.5; g.rotation.x = -Math.PI / 2; g.rotation.z += dt * 9 * (1 - k); plough(g.position, r.scale * 0.75, T.pl || (T.pl = { set: new Set([r]) })); r.stun = Math.max(r.stun, 0.5); if (Math.random() < dt * 25) fx.puff('smoke', g.position.clone(), 0.5);
    if (k >= 1) { r.toss = null; g.position.y = 0; g.rotation.z = 0; flashRig(r.rig); jolt(0.7); getUp(g); r.stun = 2; const land = g.position.clone(); followUp(me, land, false); hitArea(land, 3.6, 14, {}); fx.explode(land.clone().setY(0.5), 2.4); flashT = 0.3; sfx.boom(); popup(land.clone().setY(r.scale * 2), 'CRASH!', '#ffb02a'); hitRival(RIVAL_HP * 0.18); if (!rival || r.hp <= 0) return; } }
  const dx = px - g.position.x, dz = pz - g.position.z, d = Math.hypot(dx, dz) || 0.01, touch = reach() + r.scale * 0.45;
  r.stun -= dt; r.cd -= dt; r.armorT = (r.armorT || 0) - dt; r.moving = false; if (r.stagT > 0) { r.stagT -= dt; r.moving = true; }
  if (mini) r.stun = Math.max(r.stun, 0.05);
  if (r.stun <= 0) {
    const want = Math.atan2(dx, dz); let dr = want - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 4);
    if (d > touch * 0.9 && !bout && !r.atk) { const sp = (3.6 + r.scale * 0.4) * KAIJU[r.id].speed * 0.8; g.position.x += dx / d * sp * dt; g.position.z += dz / d * sp * dt; r.moving = true; }
    if (d < touch + 0.4 && r.cd <= 0 && !r.atk && !mini && !meToss) rivalWindUp(r, touch);
    r.castT -= dt; if (r.castT <= 0 && d < 18) { r.castT = (8 + Math.random() * 3) * (1 - 0.3 * ramp()); spells.cast(caster(r.rig, r.stage), r.stage, me.g.position.clone(), { hostile: true }); popup(g.position.clone().setY(r.scale * 2), KAIJU[r.id].spells[r.stage - 1].toUpperCase() + '!', '#ff5a5a'); }
  }
  if (r.atk) rivalSwing(r, dt);
  const choosing = !finishBtn.classList.contains('hidden'); if (r.dazedT > 0) { if (!choosing) r.dazedT -= dt; r.stun = Math.max(r.stun, 0.1); g.rotation.z = Math.sin(played * 7) * 0.12; if (Math.random() < dt * 4) popup(g.position.clone().setY(r.scale * 2.3), '💫', '#ffd24a'); if (r.dazedT <= 0) { r.daze = 0; g.rotation.z = 0; } }
  finishBtn.classList.toggle('hidden', !(r.dazedT > 0 && (choosing || d < touch + r.scale * 0.6 + 1.5) && !finishing && !mini && !grabbed));
  // bodies collide: you can't walk through each other (except while it's being swung or thrown)
  if (!r.toss && !r.launch && !(mini && (mini.type === 'spin' || mini.type === 'escape')) && !leap && !(bout && bout.anim) && !meToss) { const ex = g.position.x - me.g.position.x, ez = g.position.z - me.g.position.z, ed = Math.hypot(ex, ez) || 0.01, minD = 0.42 * (meScale + r.scale);
    if (ed < minD) { const push = (minD - ed) / 2, ux = ex / ed, uz = ez / ed; g.position.x += ux * push; g.position.z += uz * push; me.g.position.x -= ux * push; me.g.position.z -= uz * push; } }
  // its health bar floats over its head
  const v = g.position.clone().setY(r.scale * 2.2).project(cam); const on = Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
  rivalEl.classList.toggle('hidden', !on); if (on) { rivalEl.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-100%)'; $('kjRivalFill').style.width = Math.max(0, r.hp / r.max * 100) + '%'; $('kjDazeFill').style.width = (r.dazedT > 0 ? 100 : r.daze * 100) + '%'; $('kjDaze').classList.toggle('full', r.dazedT > 0); }
  edgeArrow(rivalArrow, g.position, true);
}

// ---------- FIGHTING, free in the world: walk into the rival and your attacks hit it like anything else, and every hit fills
// its DAZE meter. It fights back with wind-up swings you can see coming (a red ring grows under it; step out of the ring and
// it misses). Daze it fully and it reels: get close and hit FINISH IT! for your big finishing move. ----------
const ringGeo = new THREE.RingGeometry(0.7, 1, 40).rotateX(-Math.PI / 2), ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.6, depthWrite: false });
// two ways to punish a dazed rival: SPIN & TOSS (circle your finger to swing it and hurl it across town) or a RANDOM wrestling move
const finishBtn = document.createElement('div'); finishBtn.id = 'kjFinish'; finishBtn.className = 'hidden'; finishBtn.innerHTML = '<button id="kjFinSpin">🌀 SPIN &amp; TOSS</button><button id="kjFinMove">🤼 WRESTLE IT</button>'; document.body.appendChild(finishBtn);
let finishing = false;
function rivalWindUp(r, touch) { const ring = r.ring || (r.ring = new THREE.Mesh(ringGeo, ringMat)); ring.position.set(0, 0.06, 0); scene.add(ring); r.atk = { t: 0, dur: Math.max(0.5, 1.05 - 0.3 * ramp() - 0.06 * (r.stage - 1)) * (r.quick ? 0.7 : 1), reach: touch + 0.5 }; r.quick = false; r.rig.act('cast'); popup(r.g.position.clone().setY(r.scale * 2.4), '❗', '#ff5a5a'); }
function rivalSwing(r, dt) { const A = r.atk; A.t += dt; const k = Math.min(1, A.t / A.dur), ring = r.ring; ring.position.set(r.g.position.x, 0.06, r.g.position.z); ring.scale.setScalar(A.reach * (0.25 + 0.75 * k)); ring.material.opacity = 0.5 + 0.45 * k;
  r.g.rotation.x = -0.25 * Math.sin(k * Math.PI * 0.5);
  if (k < 1) return; scene.remove(ring); r.atk = null; r.g.rotation.x = 0; r.rig.act('hit'); shove(r.rig, me.g.position.x - r.g.position.x, me.g.position.z - r.g.position.z, 0.45, 0, 0.08); r.cd = (0.9 + Math.random() * 0.8) * (1 - 0.35 * ramp());
  const dx = me.g.position.x - r.g.position.x, dz = me.g.position.z - r.g.position.z;
  const dodged = r.dodged; r.dodged = null;
  if (Math.hypot(dx, dz) < A.reach && !leap && !meToss && !grabbed && !dodged && dodgeT <= 0) { r.hits = (r.hits || 0) + 1; if (r.hits >= 2 || Math.random() < 0.2 + 0.2 * ramp()) { r.hits = 0; return rivalGrab(r); } hurt(Math.min(4 + level, 3 + r.stage + level * 0.6) * SIZE_GUARD[stage] * (1 + 0.6 * ramp()), true); knock(me.g, r.g.position, 1.6); fx.explode(me.g.position.clone().setY(meScale), Math.min(1.5, 0.3 * r.scale)); sfx.boom(); flashT = Math.max(flashT, 0.12); flashRig(me); shove(me, dx, dz, 0.45, 0, 0.2); combo = 0; }
  else { const pd = dodged === 'perfect'; popup(r.g.position.clone().setY(r.scale * 2), pd ? 'PERFECT DODGE!' : 'MISS!', '#7dff3a'); sfx.whoosh(); shove(r.rig, dx, dz, 0.35); r.stun = Math.max(r.stun, pd ? 1.2 : 0.5); // it over-reaches and stumbles
    if (pd) { slowMo = Math.max(slowMo, 0.8); counterT = 1.6; banner('⚡ COUNTER! HIT IT NOW!'); sfx.power(); } } }
let grabbed = false;
function rivalGrab(r) { grabbed = true; moveTo = null; finishBtn.classList.add('hidden'); r.stun = 3; const spin = Math.random() < 0.5; r.rig.act(spin ? 'clutch' : 'lift'); flashRig(me); shove(me, me.g.position.x - r.g.position.x, me.g.position.z - r.g.position.z, 0.4); sfx.hurt();
  startGMove(r, 'escape'); gm.need = Math.round(6 + 4 * ramp()); gm.limit = 1.7 - 0.25 * ramp(); gm.then = () => rivalGrabGo(r, spin); banner('⚠️ ' + KAIJU[r.id].name + ' GRABS YOU!'); }
function rivalGrabGo(r, spin) { if (rival !== r || r.hp <= 0 || state !== 'play') { grabbed = false; return; } r.stun = 3;
  if (spin) { // the giant swing: round and round, then it lets go and you fly
    banner('🌀 ' + KAIJU[r.id].name + ' SPINS YOU!'); r.rig.act('clutch'); me.act('hit'); sfx.whoosh(); let ang = Math.atan2(me.g.position.z - r.g.position.z, me.g.position.x - r.g.position.x); const p0 = me.g.position.clone();
    anims.push({ wait: 0, t: 0, dur: 1.6, go() {}, f(k) { if (!rival || rival !== r) return; const P = r.g.position, R0 = r.scale * 0.75 + meScale * 0.6, w = Math.min(1, k * 5); ang += (2 + k * 10) * 0.016 * 1.6;
        me.g.position.set(p0.x + (P.x + Math.cos(ang) * R0 - p0.x) * w, meScale * 0.35 * w, p0.z + (P.z + Math.sin(ang) * R0 - p0.z) * w); me.g.rotation.set(0, Math.PI / 2 - ang, 1.5 * w); if (w > 0.6) plough(me.g.position, meScale * 0.7, this.pl || (this.pl = { set: new Set([r]) })); r.g.rotation.y = Math.atan2(me.g.position.x - P.x, me.g.position.z - P.z); },
      end() { grabbed = false; if (!rival || rival !== r) { me.g.position.y = 0; me.g.rotation.x = me.g.rotation.z = 0; return; } r.rig.act(null); const D = 20 + 3 * r.stage, hx = cols * CELL / 2 - 3, hz = rows * CELL / 2 - 3, from = me.g.position.clone();
        const to = new THREE.Vector3(Math.max(-hx, Math.min(hx, from.x - Math.sin(ang) * D)), 0, Math.max(-hz, Math.min(hz, from.z + Math.cos(ang) * D))); me.g.rotation.z = 0; meToss = { from, to, t: 0, secs: 1.6, h: 0 }; banner('THROWN!'); sfx.throw(); } }); return; }
  const mv = FINISHERS[(Math.random() * FINISHERS.length) | 0]; banner(KAIJU[r.id].name + ': ' + MOVE_NAME[mv] + '!'); me.g.position.y = 0; me.g.rotation.x = me.g.rotation.z = 0; const dur = wrestle(mv, 'them', 'me');
  anims.push({ wait: dur * 0.6, t: 0, dur: 0.01, go() { hurt(Math.min(5 + level, 4 + r.stage + level * 0.7) * SIZE_GUARD[stage], true); }, f() {}, end() {} }); anims.push({ wait: dur + 0.9, t: 0, dur: 0.01, go() { grabbed = false; }, f() {}, end() {} }); }
// fighting a rival, swings alternate so it looks like a real fight: Mike mixes golf swings and overhead slams, wrestlers mix
// two-fisted slams and big boots, each with its own short pause after it
let fightN = 0; const SWING_ORDER = ['golf', 'hit', 'golf', 'golf', 'hit'], SWING_GAP = [0.75, 0.9, 0.7, 0.8, 0.95];
function fightSwing() { const k = SWING_ORDER[fightN++ % SWING_ORDER.length]; if (me.hammer) me.act(k); else me.act(me.wrestler && k === 'hit' ? 'kick' : 'hit'); }
// within striking distance of the rival, taps are swings
const nearRival = () => rival && me && rival.hp > 0 && !rival.koT && !rival.toss && !finishing && !grabbed && !mini && !meToss && Math.hypot(rival.g.position.x - me.g.position.x, rival.g.position.z - me.g.position.z) < reach() + rival.scale * 0.6 + 1.2;
let swingCd = 0;
// TAP near the rival: quick punches that chain into a COMBO (keep tapping within a second); every third is an UPPERCUT
function playerSwing(crit) { if (!nearRival() || (swingCd > 0 && !crit)) return false; const r = rival, P = me.g.position, Q = r.g.position; let ux = Q.x - P.x, uz = Q.z - P.z; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
  if (comboT <= 0) combo = 0; const n = ++combo, counter = counterT > 0, kind = counter ? 'counter' : crit || n % 3 === 0 ? 'upper' : n % 3 === 2 ? 'cross' : 'jab', big = kind === 'upper' || kind === 'counter';
  if (counter) counterT = 0; swingCd = big ? 0.5 : 0.28; comboT = 1.1; moveTo = null; me.g.rotation.y = faceY = Math.atan2(ux, uz); fightSwing(); const side = n % 2 ? 1 : -1;
  shove(me, -ux, -uz, big ? 0.22 : 0.1, side * (big ? 0.35 : 0.2)); // the wind-up: lean back and twist
  anims.push({ wait: big ? 0.2 : 0.12, t: 0, dur: 0.01, go() { if (rival !== r || r.hp <= 0) return; shove(me, ux, uz, big ? 0.4 : 0.22, -side * (big ? 0.6 : 0.35)); knock(me.g, me.g.position.clone().addScaledVector(V3(ux, 0, uz), -1), big ? 0.5 : 0.2); // ...then the blow: twist through and step in
    landHit(r, kind, ux, uz); if (counter) popup(r.g.position.clone().setY(r.scale * 2.4), 'COUNTER!', '#7dff3a'); else if (n >= 2) comboPop(r, n); }, f() {}, end() {} }); return true; }
// ---- WEAK SPOTS: glowing dots pop up on the rival during a fight. GOLD = a crit (3x damage, big daze), RED = shows while it
// winds up a swing (tap it to counter and stagger it), PURPLE (rare) = instant daze. Plain taps still chip away.
const dotLayer = document.createElement('div'); dotLayer.id = 'kjDots'; document.body.appendChild(dotLayer); const dots = []; let dotT = 1.5;
const fightEdge = document.createElement('div'); fightEdge.id = 'kjFightEdge'; fightEdge.className = 'hidden'; document.body.appendChild(fightEdge);
function addDot(kind, life) { const r = rival; if (!r) return; const el = document.createElement('button'); el.className = 'fdot ' + kind; el.textContent = { gold: '★', red: '!', purple: '✦' }[kind];
  const side = Math.random() < 0.5 ? -1 : 1, d = { el, kind, r, life, max: life, ox: kind === 'red' ? 0 : side * r.scale * (0.35 + Math.random() * 0.4), oy: kind === 'red' ? r.scale * 2.0 : r.scale * (0.4 + Math.random() * 0.9) }; /* red sits up by the head, the others spread out to the sides so they never overlap */
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (state !== 'play' || !rival || rival !== d.r) return; hitDot(d); }); dotLayer.appendChild(el); dots.push(d); return d; }
function hitDot(d) { const r = d.r, i = dots.indexOf(d); if (i >= 0) dots.splice(i, 1); d.el.classList.add('pop'); setTimeout(() => d.el.remove(), 200);
  if (d.kind === 'gold') { swingCd = 0; playerSwing(true) || strikeRival(r, true); popup(r.g.position.clone().setY(r.scale * 2.2), 'CRIT!', '#ffd24a'); }
  else if (d.kind === 'red') { if (r.atk) { scene.remove(r.ring); r.atk = null; r.g.rotation.x = 0; } r.stun = 1.3 * (1 - 0.4 * ramp()); r.cd = Math.max(r.cd, 1.2 * (1 - 0.4 * ramp())); swingCd = 0; playerSwing(); knock(r.g, me.g.position, 1.6); popup(r.g.position.clone().setY(r.scale * 2.2), 'COUNTER!', '#7dff3a'); sfx.boom(); }
  else { swingCd = 0; playerSwing(true); r.daze = 1; if (!r.dazedT) { r.dazedT = 3.5; r.atk = null; if (r.ring) scene.remove(r.ring); banner('💫 JACKPOT! SPIN IT OR SLAM IT!'); sfx.power(); } } }
function clearDots() { for (const d of dots) d.el.remove(); dots.length = 0; }
function updateDots(dt) { updateGMove(dt); swingCd -= dt; comboT -= dt; counterT -= dt; dodgeT -= dt; heavyCd -= dt; updateLean(me, dt); if (rival) updateLean(rival.rig, dt); const r = rival, fighting = !!(r && me && r.hp > 0 && !r.koT && state === 'play' && Math.hypot(r.g.position.x - me.g.position.x, r.g.position.z - me.g.position.z) < reach() + r.scale * 0.6 + 6);
  fightEdge.classList.toggle('hidden', !nearRival() && counterT <= 0); fightEdge.classList.toggle('counter', counterT > 0);
  if (!fighting) { if (dots.length) clearDots(); return; }
  const slow = 1 + 0.25 * ramp(), quick = 1 - 0.35 * ramp(); dotT -= dt;
  if (false && dotT <= 0 && !r.dazedT && !mini && !grabbed && !finishing && dots.filter((d) => d.kind !== 'red').length < 2) { dotT = (1.6 + Math.random() * 0.9) * slow; addDot(Math.random() < 0.1 * (1 - 0.5 * ramp()) ? 'purple' : 'gold', Math.max(0.8, 1.6 * quick)); }
  for (let i = dots.length - 1; i >= 0; i--) { const d = dots[i]; d.life -= dt; if (d.life <= 0 || d.r !== rival || (d.kind === 'red' && !r.atk) || r.dazedT > 0) { d.el.remove(); dots.splice(i, 1); continue; }
    const v = new THREE.Vector3(r.g.position.x + d.ox, d.oy, r.g.position.z).project(cam); d.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%) scale(' + (0.7 + 0.3 * Math.min(1, d.life / d.max * 2)) + ')'; } }
// ---- RANGED ATTACK: when the rival is on screen but out of reach (it just turned up, or you spun and tossed it), a button
// fires your ranged special and then you charge it: Mike, wrestlers and apes rip up a building and hurl it, everyone else
// fires their own spell at it; then you run and leap at it (Mike and the wrestlers come down with the FLYING ELBOW, the
// rest with a leaping slam). 8 s cooldown.
const RANGED_NAME = (k) => (k.hammer || k.wrestler || k.def.kind === 'ape' ? '🏢 AIM & THROW' : '🎯 AIM & BLAST');
const rangedBtn = document.createElement('button'); rangedBtn.id = 'kjRanged'; rangedBtn.className = 'hidden'; document.body.appendChild(rangedBtn);
let rangedCd = 0, rangedBusy = false;
const rangedOk = () => { const r = rival; if (!r || !me || r.hp <= 0 || r.koT || r.toss || mini || grabbed || meToss || finishing || leap || rangedBusy || rangedCd > 0 || state !== 'play') return false;
  const d = Math.hypot(r.g.position.x - me.g.position.x, r.g.position.z - me.g.position.z); if (d < reach() + r.scale * 0.6 + 2.5 || d > 40) return false; const v = r.g.position.clone().setY(r.scale).project(cam); return Math.abs(v.x) < 1 && Math.abs(v.y) < 1; };
function rangedAttack(T, charge = 0, force = false) { if (!(force ? rival && rival.hp > 0 && !rangedBusy && state === 'play' && !grabbed && !meToss && !leap : rangedOk())) return; const r = rival, P = me.g.position; T = (T || r.g.position).clone().setY(0); rangedBusy = true; rangedCd = 8; rangedBtn.classList.add('hidden'); moveTo = null; me.g.rotation.y = faceY = Math.atan2(T.x - P.x, T.z - P.z);
  const thrower = me.hammer || me.wrestler || me.def.kind === 'ape', near = () => rival === r && r.hp > 0 && Math.hypot(r.g.position.x - T.x, r.g.position.z - T.z) < 1.8 + r.scale * 0.7;
  const direct = (dmg, txt) => { if (!near()) { popup(T.clone().setY(2), 'MISSED IT!', '#c9a6ff'); return; } hitRival(RIVAL_HP * dmg); if (rival !== r) return; r.daze = Math.min(1, r.daze + 0.15); r.stun = Math.max(r.stun, 1); popup(r.g.position.clone().setY(r.scale * 2.2), txt, '#ffd24a'); };
  if (thrower) { // rip up the nearest building and hurl it at the spot you aimed at
    let mesh = grabBuilding(P); if (!mesh) { mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x5a6a7c })); mesh.scale.set(2, 3.4, 2); scene.add(mesh); }
    me.act('cast'); shove(me, P.x - T.x, P.z - T.z, 0.35, 0.5); banner(me.hammer ? 'WARRANT SERVED!' : 'BUILDING TOSS!'); sfx.throw(); const a0 = P.clone().setY(meScale * 2.4), to = T.clone().setY(1), arcH = meScale * 1.5 + a0.distanceTo(to) * 0.15; mesh.position.copy(a0);
    anims.push({ wait: 0.25, t: 0, dur: 0.75, go() { shove(me, T.x - P.x, T.z - P.z, 0.5, -0.8); }, f(k) { mesh.position.lerpVectors(a0, to, k); mesh.position.y += Math.sin(k * Math.PI) * arcH; mesh.rotation.x += 0.2; mesh.rotation.z += 0.13; },
      end() { twisters.tear(mesh, mesh.position.clone(), new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()), null, [], [], { collapse: true, now: true, from: a0, power: 1.6 });
        fx.explode(T.clone().setY(0.8), Math.min(2.4, 0.5 * meScale + 0.6)); fx.shock(T, 3 + meScale * 0.5); sfx.boom(); flashT = Math.max(flashT, 0.2); jolt(0.6); hitArea(T, 1.6 + meScale * 0.35, 0, { hitRival: new Set([r]) }); // it flattens what it lands on
        direct(charge >= 1 ? 0.11 : 0.08, 'DIRECT HIT!'); } }); }
  else { spells.cast(caster(me, stage), stage, T.clone()); shove(me, P.x - T.x, P.z - T.z, 0.3); banner(KAIJU[me.id].spells[stage - 1].toUpperCase() + (charge >= 1 ? ' · CHARGED!' : '!')); direct(0.03, 'HIT!');
    if (charge >= 1) anims.push({ wait: 0.35, t: 0, dur: 0.01, go() { if (state !== 'play') return; spells.cast(caster(me, stage), stage, T.clone()); fx.shock(T, 4 + meScale * 0.5, 0x9ff0ff); direct(0.05, 'CHARGED HIT!'); }, f() {}, end() {} }); }
  // ...then the charge: a run-up and a leap that comes down on it (Mike and the wrestlers with the FLYING ELBOW). A ring on
  // the ground shrinks onto the landing spot: tap just as it closes for a PERFECT landing (double damage and a shockwave)
  const elbow = me.hammer || me.wrestler;
  anims.push({ wait: thrower ? 1.05 : 0.8, t: 0, dur: 0.01, go() { if (rival !== r || r.hp <= 0 || state !== 'play' || grabbed || meToss) { rangedBusy = false; return; }
      const Q = r.g.position, dir = new THREE.Vector3(Q.x - me.g.position.x, 0, Q.z - me.g.position.z), dist = dir.length() || 1; dir.divideScalar(dist); const to = me.g.position.clone().addScaledVector(dir, Math.max(0, dist - (meScale + r.scale) * 0.45)).setY(0);
      me.g.rotation.y = faceY = Math.atan2(dir.x, dir.z); me.act(elbow ? 'elbow' : 'cast'); shove(me, 0, 0, 0, 0, 0.2, -0.3); banner(elbow ? 'FLYING ELBOW!' : 'CHARGE!'); sfx.whoosh();
      const ringIn = new THREE.Mesh(landRingGeo, landMat(0xffffff, 0.75)), ringOut = new THREE.Mesh(landRingGeo, landMat(0xffd24a, 0.9)), R0 = 1 + r.scale * 0.5; ringIn.position.copy(to).setY(0.12); ringOut.position.copy(to).setY(0.13); ringIn.scale.setScalar(R0); scene.add(ringIn, ringOut);
      startGMove(r, 'elbow'); const m = gm;
      leap = { from: me.g.position.clone(), to, t: 0, secs: Math.min(1.2, 0.6 + dist * 0.025), h: 3 + meScale * 1.4, step: null, hide: false, stepT: 0,
        tick(k) { if (m.steer) { to.x += m.steer.x; to.z += m.steer.z; m.steer = null; ringIn.position.x = ringOut.position.x = to.x; ringIn.position.z = ringOut.position.z = to.z; } m.k = k; ringOut.scale.setScalar(R0 * (1 + 2.6 * (1 - k))); ringOut.material.color.setHex(k > 0.78 && k < 0.97 ? 0x7dff3a : 0xffd24a); },
        onLand() { rangedBusy = false; scene.remove(ringIn, ringOut); ringIn.material.dispose(); ringOut.material.dispose(); const grade = m.grade || 'miss'; endGMove(); const at = me.g.position.clone(), pf = grade === 'perfect'; if (elbow) me.act('sprawl'); fx.explode(at.clone().setY(0.5), Math.min(2.6, (pf ? 0.7 : 0.5) * meScale)); sfx.boom(); flashT = Math.max(flashT, pf ? 0.4 : 0.25); jolt(pf ? 1 : 0.6);
          hitArea(at, (pf ? 3.2 : 2) + meScale * (pf ? 0.9 : 0.6), 0, { hitRival: new Set(rival ? [rival] : []) }); if (pf) { fx.shock(at, 6 + meScale * 1.5, 0xfff0a0, 0.6); slowMo = Math.max(slowMo, 0.4); hitStop = Math.max(hitStop, 0.1); }
          popup(at.clone().setY(meScale * 2.6), { perfect: 'PERFECT LANDING!', good: 'GOOD!', ok: 'OK', miss: '' }[grade], pf ? '#7dff3a' : '#ffd24a');
          if (rival === r && r.hp > 0 && Math.hypot(r.g.position.x - at.x, r.g.position.z - at.z) < 2.6 + r.scale * 0.6 + meScale * 0.4) { hitRival(RIVAL_HP * { perfect: 0.2, good: 0.12, ok: 0.1, miss: 0.08 }[grade]); if (rival === r) { flashRig(r.rig); shove(r.rig, r.g.position.x - at.x, r.g.position.z - at.z, 0.5, 0, 0.2, 0.3); knock(r.g, at, pf ? 2.4 : 1.4); r.daze = Math.min(1, r.daze + (pf ? 0.45 : 0.25)); if (r.daze >= 1 && !r.dazedT) { r.dazedT = 3.5; r.atk = null; if (r.ring) scene.remove(r.ring); banner('💫 DAZED! SPIN IT OR SLAM IT!'); sfx.power(); } } } } }; }, f() {}, end() {} }); }
// AIM: press the button and drag to move the target ring (the throw's arc shows); hold to charge a blast; let go to fire.
// A quick tap fires straight at the rival
const landRingGeo = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), landMat = (c, op) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
const aimRing = new THREE.Mesh(landRingGeo, landMat(0xffd24a, 0.85)), aimDot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16).rotateX(-Math.PI / 2), landMat(0xffd24a, 0.6)), aimArc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.8, depthTest: false }));
aimRing.renderOrder = aimDot.renderOrder = aimArc.renderOrder = 9; aimArc.frustumCulled = false;
let aimS = null;
function startAim(e) { if (!rangedOk() || aimS) return; const r = rival, thrower = me.hammer || me.wrestler || me.def.kind === 'ape'; aimS = { id: e.pointerId, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, at: r.g.position.clone().setY(0), thrower, charge: 0 };
  scene.add(aimRing, aimDot); if (thrower) scene.add(aimArc); gmEl.className = 'm-aim' + (thrower ? '' : ' bar'); gmHint(thrower ? 'DRAG TO AIM · LET GO TO THROW' : 'HOLD TO CHARGE · DRAG TO AIM · LET GO'); rangedBtn.classList.add('hidden'); }
function endAim(fire) { const s = aimS; aimS = null; scene.remove(aimRing, aimDot, aimArc); gmEl.className = 'hidden'; if (fire && s) rangedAttack(s.at, s.charge, true); }
addEventListener('pointermove', (e) => { const s = aimS; if (!s || e.pointerId !== s.id) return; const a = groundAt(s.x, s.y), b = groundAt(e.clientX, e.clientY); s.moved += Math.hypot(e.clientX - s.x, e.clientY - s.y); s.x = e.clientX; s.y = e.clientY; if (!a || !b || !me) return;
  const lim = toWorld(cols - 1, rows - 1, cols, rows), P = me.g.position; s.at.x = Math.max(-lim.x, Math.min(lim.x, s.at.x + b.x - a.x)); s.at.z = Math.max(-lim.z, Math.min(lim.z, s.at.z + b.z - a.z)); const dx = s.at.x - P.x, dz = s.at.z - P.z, d = Math.hypot(dx, dz); if (d > 40) { s.at.x = P.x + dx / d * 40; s.at.z = P.z + dz / d * 40; } });
addEventListener('pointerup', (e) => { if (aimS && e.pointerId === aimS.id) endAim(true); });
addEventListener('pointercancel', (e) => { if (aimS && e.pointerId === aimS.id) endAim(false); });
rangedBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); startAim(e); });
function updateRanged(dt) { rangedCd -= dt;
  if (aimS) { const s = aimS; if (!rival || rival.hp <= 0 || state !== 'play' || grabbed || meToss) { endAim(false); return; } s.charge = s.thrower ? 0 : Math.min(1, (performance.now() - s.t0) / 1100); const pul = 1 + Math.sin(played * 10) * 0.08, R = (1.8 + rival.scale * 0.7) * pul * (1 + s.charge * 0.3);
    aimRing.position.copy(s.at).setY(0.14); aimRing.scale.setScalar(R); aimDot.position.copy(s.at).setY(0.13); aimRing.material.color.setHex(s.charge >= 1 ? 0x9ff0ff : 0xffd24a); gmBar(s.charge, s.charge >= 1);
    if (s.thrower) { const a0 = me.g.position.clone().setY(meScale * 2.4), to = s.at.clone().setY(1), h = meScale * 1.5 + a0.distanceTo(to) * 0.15, pos = aimArc.geometry.attributes.position; for (let i = 0; i < 24; i++) { const k = i / 23, p = a0.clone().lerp(to, k); p.y += Math.sin(k * Math.PI) * h; pos.setXYZ(i, p.x, p.y, p.z); } pos.needsUpdate = true; } return; }
  const ok = rangedOk() && finishBtn.classList.contains('hidden') && !gm; rangedBtn.classList.toggle('hidden', !ok); if (ok && me) rangedBtn.textContent = RANGED_NAME(me); }
// ---------- FIGHT FEEL: combos, haymakers, dodges, bodies through buildings, hit reactions ----------
// FLICK (a quick swipe) near the rival: a HAYMAKER that sends it flying the way you flicked, through anything small enough to
// break (each building it smashes hurts it more) and into a WALL SLAM if something too big stops it. As the third hit of a
// combo it is a LAUNCHER and flies further. While the red ring grows under it, FLICK to DODGE; dodge late and time slows:
// hit it then for a COUNTER. Every hit flashes the one struck white for an instant and rocks it on a spring
let combo = 0, comboT = 0, counterT = 0, dodgeT = 0, heavyCd = 0;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), flashMats = new Map(), WHITE = new THREE.Color(0xffffff);
const flashOf = (mt) => { let f = flashMats.get(mt); if (!f) { f = new THREE.MeshBasicMaterial({ color: (mt.color ? mt.color.clone() : new THREE.Color(0x888888)).lerp(WHITE, 0.7) }); f.userData.flash = true; flashMats.set(mt, f); } return f; }; /* each part lit up in a pale version of its own colour, so it still reads as the monster */
function flashRig(rig, secs = 0.07) { if (!rig || !rig.body || rig._flash) return; const list = []; rig.body.traverse((m) => { if (m.isMesh && m.visible && m.material && !Array.isArray(m.material) && !m.material.transparent) { list.push([m, m.material]); m.material = flashOf(m.material); } }); rig._flash = true;
  anims.push({ wait: 0, t: 0, dur: secs, go() {}, f() {}, end() { for (const [m, mt] of list) if (m.material && m.material.userData.flash) m.material = mt; rig._flash = false; } }); }
// the flinch: a group slipped in between the monster and its body leans (and twists and dips) on a spring, so blows rock it
// and it sways back, on top of whatever its own animation is doing
function reactOf(rig) { if (!rig.react) { const w = new THREE.Group(); rig.g.add(w); w.add(rig.body); rig.react = w; rig.lean = { x: 0, z: 0, vx: 0, vz: 0, t: 0, vt: 0, d: 0, vd: 0, s: 0, vs: 0 }; } return rig.react; }
function shove(rig, dx, dz, a, tw = 0, dip = 0, sq = 0) { if (!rig || !rig.g || !rig.body) return; reactOf(rig); const L = rig.lean, l = Math.hypot(dx, dz) || 1; L.vx += dx / l * a * 16; L.vz += dz / l * a * 16; L.vt += tw * 16; L.vd += dip * 16; L.vs += sq * 16; } // sq: squash (+) or stretch (-)
function updateLean(rig, dt) { if (!rig || !rig.lean) return; const L = rig.lean, h = Math.min(dt, 0.04);
  for (const [p, v] of [['x', 'vx'], ['z', 'vz'], ['t', 'vt'], ['d', 'vd'], ['s', 'vs']]) { L[v] += (-150 * L[p] - 15 * L[v]) * h; L[p] += L[v] * h; }
  const c = (x) => Math.max(-0.7, Math.min(0.7, x)), th = rig.g.rotation.y, cs = Math.cos(th), sn = Math.sin(th), lx = L.x * cs - L.z * sn, lz = L.x * sn + L.z * cs;
  rig.react.rotation.set(c(lz), c(L.t), c(-lx)); rig.react.position.y = -Math.max(-0.3, Math.min(0.35, L.d)); const s = Math.max(-0.3, Math.min(0.35, L.s)); rig.react.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5); }
// what each blow does: damage (a share of a Small Town rival), daze, stun (s), flinch, knock back
const HIT = { jab: [0.022, 0.09, 0.18, 0.15, 0.3], cross: [0.026, 0.1, 0.18, 0.2, 0.35], upper: [0.045, 0.2, 0.7, 0.4, 1.5], heavy: [0.05, 0.2, 1, 0.35, 0], launch: [0.06, 0.25, 1.2, 0.4, 0], counter: [0.08, 0.4, 1.4, 0.45, 0] };
function landHit(r, kind, ux, uz) { if (!r || r.hp <= 0 || rival !== r) return; if (r.dazedT > 0) { hitRival(RIVAL_HP * 0.01); return; }
  const [dmg, dz, st, lean, kb] = HIT[kind], big = kind !== 'jab' && kind !== 'cross'; hitRival(RIVAL_HP * dmg); if (rival !== r || r.hp <= 0) return;
  const at = r.g.position.clone().addScaledVector(V3(ux, 0, uz), -r.scale * 0.3).setY(Math.min(meScale, r.scale) * 1.15);
  fx.sparks(at, big ? 18 : 8, { c: [0xffffff, 0xffd24a], speed: big ? 10 : 6, up: 4, life: 0.45, size: 0.13 }); fx.flash(at, big ? 1 : 0.45, 0xfff0c0); fx.dust({ x: r.g.position.x, y: 0, z: r.g.position.z }, 0.5 + r.scale * 0.3, ux * 3, uz * 3); jolt(big ? 0.6 : 0.25);
  if (big) { hitStop = Math.max(hitStop, kind === 'counter' ? 0.13 : 0.07); fx.shock(r.g.position, r.scale * 1.6); flashT = Math.max(flashT, 0.15); sfx.boom(); } else sfx.hit();
  shove(r.rig, ux, uz, lean, (Math.random() - 0.5) * lean, big ? 0.25 : 0.06); if (!(r.armorT > 0) || kind === 'counter') { r.stun = Math.max(r.stun, st * (1 - 0.3 * ramp())); r.stagT = big ? 0.5 : 0.25; } // it staggers: its legs scramble for footing
  r.taken = (played - (r.hitAt || -9) < 1.2 ? r.taken || 0 : 0) + 1; r.hitAt = played;
  if (!big && r.taken >= Math.round(5 - 2 * ramp()) && !r.atk && !r.dazedT) { r.taken = 0; r.armorT = 1.4; r.stun = 0; r.stagT = 0; r.cd = 0; r.quick = true; popup(r.g.position.clone().setY(r.scale * 2.6), 'IT BREAKS FREE!', '#ff5a5a'); shove(r.rig, -ux, -uz, 0.4); sfx.hurt(); } // the combo breaker
  r.daze = Math.min(1, r.daze + dz * (1 - 0.3 * ramp())); if (r.atk && (kind === 'counter' || (!(r.armorT > 0) && ((kind === 'heavy' || kind === 'launch') && r.atk.t / r.atk.dur < 1 - 0.55 * ramp() || (ramp() < 0.3 && r.daze >= 0.5))))) { /* punches do not stop a swing once it has started: a flick does, or dodge it */ scene.remove(r.ring); r.atk = null; r.g.rotation.x = 0; popup(r.g.position.clone().setY(r.scale * 2), 'INTERRUPTED!', '#7dff3a'); }
  if (kb && !r.atk && !(r.armorT > 0)) knock(r.g, me.g.position, kb); /* winding up a swing it plants its feet: punches do not push it out of reach */
  if (kind === 'heavy' || kind === 'launch' || kind === 'counter') launchRival(r, ux, uz, kind === 'launch' ? 6 + 2 * r.scale : kind === 'counter' ? 5 + 1.5 * r.scale : 3.5 + 1.2 * r.scale, kind !== 'heavy');
  if (r.daze >= 1 && !r.dazedT) { r.dazedT = 3.5; r.atk = null; if (r.ring) scene.remove(r.ring); banner('💫 DAZED! SPIN IT OR SLAM IT!'); sfx.power(); } }
function comboPop(r, n) { popup(r.g.position.clone().setY(r.scale * 2.5), n + ' HIT COMBO' + (n >= 6 ? ' 🔥' : '!'), n >= 6 ? '#ff7a3a' : n >= 3 ? '#ffd24a' : '#fff'); }
// sent flying: it skids along the ground (on its back for a launcher), wrecking what it hits; a building too tall to break stops it dead
function launchRival(r, ux, uz, dist, flat) { const g = r.g, from = g.position.clone(), lim = toWorld(cols - 1, rows - 1, cols, rows), to = V3(Math.max(-lim.x, Math.min(lim.x, from.x + ux * dist)), 0, Math.max(-lim.z, Math.min(lim.z, from.z + uz * dist)));
  const skip = { set: new Set([r]), n: 0 }, dur = 0.42 + dist * 0.035, tip = flat ? -Math.PI / 2 : -0.5, cap = megaT > 0 ? 99 : MAX_H[Math.min(3, stage + 1)]; let got = 0, slam = false; r.launch = true; r.stun = Math.max(r.stun, dur + 0.4); if (r.atk) { scene.remove(r.ring); r.atk = null; }
  anims.push({ wait: 0, t: 0, dur, go() {}, f(k) { if (rival !== r || r.hp <= 0 || slam) return; const q = 1 - Math.pow(1 - k, 2.2); g.position.lerpVectors(from, to, q); g.position.y = Math.sin(Math.min(1, k * 1.6) * Math.PI) * r.scale * (flat ? 0.45 : 0.2); g.rotation.x = tip * Math.min(1, k * 3);
      if (k > 0.08) plough(g.position, r.scale * 0.6, skip);
      if (skip.n > got) { const n = Math.min(3, skip.n) - Math.min(3, got); got = skip.n; if (n > 0) { hitRival(RIVAL_HP * 0.03 * n); if (rival !== r || r.hp <= 0) return; popup(g.position.clone().setY(r.scale * 2), got > 1 ? 'SMASH x' + got + '!' : 'SMASH!', '#ffb02a'); jolt(0.5); hitStop = Math.max(hitStop, 0.04); sfx.crunch(true); fx.explode(g.position.clone().setY(r.scale * 0.6), Math.min(2, 0.4 * r.scale)); } }
      if (k > 0.1) for (const x of buildings) { if (x.done || x.h <= cap || Math.abs(x.pos.x - g.position.x) > 3 || Math.hypot(x.pos.x - g.position.x, x.pos.z - g.position.z) > 0.9 + r.scale * 0.35) continue; // too big to break: WALL SLAM
        slam = true; g.position.y = 0; hitRival(RIVAL_HP * 0.04); if (rival !== r || r.hp <= 0) return; popup(g.position.clone().setY(r.scale * 2.2), 'WALL SLAM!', '#ff7a3a'); jolt(0.8); hitStop = Math.max(hitStop, 0.09); sfx.boom(); flashRig(r.rig); fx.shock(g.position, r.scale * 1.8); fx.explode(V3(x.pos.x, x.h * 0.4, x.pos.z), 1.2); r.stun = Math.max(r.stun, 1.4); break; }
      if (Math.random() < 0.6) fx.dust({ x: g.position.x, y: 0, z: g.position.z }, 0.5 + r.scale * 0.25, -ux * 2, -uz * 2); },
    end() { r.launch = false; if (rival !== r || r.hp <= 0) return; g.position.y = 0; fx.dust({ x: g.position.x, y: 0, z: g.position.z }, 1 + r.scale * 0.4); if (got) banner(got > 1 ? '🏢 WALL SMASH x' + got + '!' : '🏢 WALL SMASH!'); r.stun = Math.max(r.stun, 0.8 + 0.3 * Math.min(3, got)); getUp(g); } }); }
// FLICK near the rival: the haymaker (or the launcher, third in a combo; or the counter)
function playerHeavy(wx = 0, wz = 0) { if (!nearRival() || heavyCd > 0) return false; const r = rival, P = me.g.position, Q = r.g.position; let ax = Q.x - P.x, az = Q.z - P.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  let ux = wx, uz = wz; const ul = Math.hypot(ux, uz); if (ul < 1e-3) { ux = ax; uz = az; } else { ux /= ul; uz /= ul; }
  const dot = ux * ax + uz * az; if (dot < 0.15) { ux += ax * (0.15 - dot) * 1.6; uz += az * (0.15 - dot) * 1.6; const l2 = Math.hypot(ux, uz) || 1; ux /= l2; uz /= l2; } // it goes the way you flicked, but never back through you
  const counter = counterT > 0, kind = counter ? 'counter' : comboT > 0 && combo >= 2 ? 'launch' : 'heavy'; if (counter) counterT = 0; combo = 0; comboT = 0; heavyCd = 0.75; swingCd = 0.45; moveTo = null;
  me.g.rotation.y = faceY = Math.atan2(ax, az); me.act(me.wrestler ? 'kick' : me.hammer ? 'golf' : 'hit'); const side = ux * az - uz * ax > 0 ? 1 : -1; shove(me, -ax, -az, 0.3, side * 0.6); sfx.whoosh();
  anims.push({ wait: 0.22, t: 0, dur: 0.01, go() { if (rival !== r || r.hp <= 0) return; shove(me, ux, uz, 0.5, -side * 0.9); knock(me.g, me.g.position.clone().addScaledVector(V3(ax, 0, az), -1), 0.6); landHit(r, kind, ux, uz); popup(r.g.position.clone().setY(r.scale * 2.4), { heavy: 'HAYMAKER!', launch: 'LAUNCHER!', counter: 'COUNTER!' }[kind], kind === 'counter' ? '#7dff3a' : '#ffd24a'); }, f() {}, end() {} }); return true; }
// FLICK while it winds up: dodge the way you flicked (sideways if that was toward it); late enough is a PERFECT dodge
function playerDodge(wx = 0, wz = 0) { const r = rival; if (!r || !r.atk || dodgeT > 0 || !me || leap || grabbed || meToss || mini) return false; const P = me.g.position, Q = r.g.position; let ax = P.x - Q.x, az = P.z - Q.z; const d = Math.hypot(ax, az) || 1; ax /= d; az /= d; if (d > r.atk.reach + 2) return false;
  let ux = wx, uz = wz; const ul = Math.hypot(ux, uz); if (ul < 1e-3) { ux = ax; uz = az; } else { ux /= ul; uz /= ul; } if (ux * ax + uz * az < 0) { const s = ux * -az + uz * ax >= 0 ? 1 : -1; ux = -az * s; uz = ax * s; }
  const late = r.atk.t / r.atk.dur >= 0.5, lim = toWorld(cols - 1, rows - 1, cols, rows), go = r.atk.reach * 0.9 + 1, from = P.clone(), to = V3(Math.max(-lim.x, Math.min(lim.x, P.x + ux * go)), 0, Math.max(-lim.z, Math.min(lim.z, P.z + uz * go)));
  r.dodged = late ? 'perfect' : 'ok'; dodgeT = 0.5; moveTo = null; mvx = mvz = 0; combo = 0; shove(me, ux, uz, 0.35, 0, 0.15); sfx.whoosh(); for (let i = 0; i < 3; i++) fx.dust({ x: P.x, y: 0, z: P.z }, 0.6 + meScale * 0.3, -ux * 3, -uz * 3);
  anims.push({ wait: 0, t: 0, dur: 0.22, go() {}, f(k) { const q = 1 - Math.pow(1 - k, 2); me.g.position.x = from.x + (to.x - from.x) * q; me.g.position.z = from.z + (to.z - from.z) * q; me.g.position.y = Math.sin(k * Math.PI) * meScale * 0.15; }, end() { me.g.position.y = 0; } }); return true; }
// a quick swipe on the screen: which way it went on the ground
function groundAt(cx, cy) { const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), cam); const p = V3(0, 0, 0); return ray.ray.intersectPlane(new THREE.Plane(V3(0, 1, 0), 0), p) ? p : null; }
function fightFlick(x0, y0, x1, y1) { if (state !== 'play' || !me || !rival || rival.hp <= 0 || mini || finishing || grabbed) return false; const a = groundAt(x0, y0), b = groundAt(x1, y1); if (!a || !b) return false; const wx = b.x - a.x, wz = b.z - a.z;
  if (rival.atk && playerDodge(wx, wz)) return true; return playerHeavy(wx, wz); }
// ---------- MOVES BY FINGER: the wrestling moves follow your finger, like the spin toss ----------
// CHOKESLAM: drag up to lift it by the throat, flick down to slam (lift it all the way and flick hard for PERFECT).
// SUPLEX: drag a big arc to swing it over your head (quick is PERFECT). SPEAR: pull back like a slingshot and let go (a full
// pull is PERFECT). PILEDRIVER: drag up to lift it, then tap at the top of the jump. SUPERKICK: tap as the ring closes on it.
// BREAK FREE (it grabbed you): tap fast. FLYING ELBOW: tap just as you land; drag in the air to steer.
// Grades: PERFECT 1.5x damage and a crater, GOOD 1x, OK 0.6x. Take too long and the move happens anyway, weakly
const gmEl = document.createElement('div'); gmEl.id = 'kjMove'; gmEl.className = 'hidden'; gmEl.innerHTML = '<div class="gmHint"></div><div class="gmBar"><i></i><b></b></div><div class="gmRing"></div><div class="gmTarget"></div>'; document.body.appendChild(gmEl);
const gmHint = (t) => { const h = gmEl.querySelector('.gmHint'); if (h._t !== t) { h._t = t; h.textContent = t; } };
const gmBar = (v, hot, zone) => { const b = gmEl.querySelector('.gmBar b'), z = gmEl.querySelector('.gmBar i'); b.style.width = Math.max(0, Math.min(1, v)) * 100 + '%'; b.classList.toggle('hot', !!hot); z.style.display = zone ? 'block' : 'none'; if (zone) { z.style.left = zone[0] * 100 + '%'; z.style.width = (zone[1] - zone[0]) * 100 + '%'; } };
const GRADE = { perfect: ['PERFECT!', '#7dff3a', 1.5], good: ['GOOD!', '#ffd24a', 1], ok: ['OK', '#c9a6ff', 0.6] };
let gm = null;
function startGMove(r, type) { const drive = { k: 0 }; gm = { type, r, drive, t: 0, phase: 'input', down: null, auto: 0, grade: null, len: 0, pull: 0, lift: 0, ring: 2.4, taps: 0 };
  gmEl.className = 'm-' + type + (type === 'spear' || type === 'escape' || type === 'piledriver' ? ' bar' : ''); gmBar(0);
  if (type === 'escape' || type === 'elbow') { gmHint(type === 'escape' ? 'TAP TAP TAP TO BREAK FREE!' : 'TAP JUST AS YOU LAND!'); return; }
  gmHint({ chokeslam: '⬆ DRAG UP TO LIFT IT', suplex: '↷ DRAG A BIG ARC TO SWING IT OVER', spear: '↙ PULL BACK... AND LET GO!', piledriver: '⬆ DRAG UP TO LIFT IT', superkick: '🦶 TAP WHEN THE RING CLOSES!' }[type]);
  if (type === 'spear') gmBar(0, false, [0.85, 1]);
  wrestle(type, 'me', 'them', { drive, onHit() { gmLand(); }, onEnd() { if (gm && gm.drive === drive) endGMove(); finishing = false; } }); }
function endGMove() { gm = null; gmEl.className = 'hidden'; }
// it goes: from here on the move plays out by itself at a speed set by how well you did
function gmGo(grade, speed = 1) { const m = gm; if (!m || m.phase !== 'input') return; m.phase = 'auto'; if (!m.grade) m.grade = grade; m.auto = speed; if (m.type === 'piledriver') { m.phase = 'hop'; gmHint('TAP AT THE TOP OF THE JUMP!'); gmBar(0, false, [0.37, 0.74]); } else gmEl.classList.add('go'); }
function gmLand() { const m = gm; if (!m) return; const r = m.r, [txt, col, mult] = GRADE[m.grade || 'ok']; if (rival !== r || r.hp <= 0) return; const at = r.g.position.clone();
  popup(at.clone().setY(r.scale * 2.8), txt, col); hitRival(RIVAL_HP * 0.2 * mult); flashRig(r.rig); jolt(m.grade === 'perfect' ? 1 : 0.6);
  if (m.grade === 'perfect') { slowMo = Math.max(slowMo, 0.45); hitStop = Math.max(hitStop, 0.1); fx.shock(at, 5 + r.scale * 1.5, 0xfff0a0, 0.6); hitArea(at, 2.2 + r.scale * 0.6, 0, { hitRival: new Set([r]) }); } // a crater: what stands close by comes down
  if (rival === r) { r.stun = 2.2; followUp(me, at, false); } gmEl.classList.add('go'); gmHint(''); }
function gmTap() { const m = gm; if (!m || state !== 'play') return;
  if (m.type === 'escape') { m.taps++; shove(me, Math.random() - 0.5, Math.random() - 0.5, 0.12); sfx.hit(); return; }
  if (m.type === 'elbow') { if (!m.grade) { const k = m.k || 0; m.grade = k > 0.78 && k < 0.97 ? 'perfect' : k > 0.6 ? 'good' : 'ok'; gmHint(GRADE[m.grade][0]); } return; }
  if (m.type === 'superkick' && m.phase === 'input') { const s = m.ring; gmGo(Math.abs(s - 1) < 0.16 ? 'perfect' : Math.abs(s - 1) < 0.4 ? 'good' : 'ok', 1.25); return; }
  if (m.type === 'piledriver' && m.phase === 'hop' && !m.tapped) { m.tapped = true; const k = m.drive.k; m.grade = k > 0.45 && k < 0.55 ? 'perfect' : k > 0.4 && k < 0.6 ? 'good' : 'ok'; gmHint(GRADE[m.grade][0]); m.auto = 1.4; } }
function gmDown(x, y) { const m = gm; if (!m) return; m.down = { x, y, t: performance.now(), lx: x, ly: y, lt: performance.now(), top: y }; gmTap(); }
function gmMove(x, y) { const m = gm; if (m && m.type === 'elbow') { if (m.down && leap) { const a = groundAt(m.down.lx, m.down.ly), b = groundAt(x, y); if (a && b) m.steer = { x: (b.x - a.x) * 0.5, z: (b.z - a.z) * 0.5 }; m.down.lx = x; m.down.ly = y; } return; } // steer in the air
  if (!m || !m.down || m.phase !== 'input') return;
  const D = m.down, now = performance.now(), H = innerHeight, vy = (y - D.ly) / Math.max(1, now - D.lt); m.len += Math.hypot(x - D.lx, y - D.ly); D.lx = x; D.ly = y; D.lt = now; D.top = Math.min(D.top, y);
  if (m.type === 'chokeslam' || m.type === 'piledriver') { const kTop = m.type === 'chokeslam' ? 0.45 : 0.35, up = Math.max(m.lift, Math.min(1, (D.y - D.top) / (H * 0.22)));
    if (y - D.top > 40 && m.lift >= 0.5 && m.type === 'chokeslam') { gmGo(m.lift >= 0.9 && vy > 1.1 ? 'perfect' : m.lift >= 0.75 ? 'good' : 'ok', vy > 1.1 ? 1.8 : 1.2); return; } // the flick down
    m.lift = up; m.drive.k = kTop * up; if (up >= 0.9) { if (m.type === 'piledriver') gmGo('ok', 0.9); else gmHint('⬇ NOW FLICK DOWN TO SLAM!'); } return; }
  if (m.type === 'suplex') { const p = Math.min(1, m.len / (Math.min(innerWidth, H) * 0.9)); m.drive.k = 0.15 + 0.6 * p; if (p >= 1) gmGo(m.t < 0.9 ? 'perfect' : m.t < 1.8 ? 'good' : 'ok', 1.3); return; }
  if (m.type === 'spear') { m.pull = Math.min(1, Math.hypot(x - D.x, y - D.y) / (H * 0.25)); gmBar(m.pull, m.pull >= 0.85, [0.85, 1]); shove(me, 0, 0, 0, 0, 0.01); } }
function gmUp() { const m = gm; if (!m || !m.down) return; m.down = null; if (m.phase !== 'input') return;
  if (m.type === 'spear' && m.pull > 0.12) gmGo(m.pull >= 0.85 ? 'perfect' : m.pull >= 0.5 ? 'good' : 'ok', 0.9 + 0.8 * m.pull);
  else if (m.type === 'chokeslam' && m.lift >= 0.5) gmGo('ok', 1);
  else if (m.type === 'piledriver' && m.lift >= 0.5) gmGo('ok', 0.9);
  else if (m.type === 'suplex' && m.drive.k > 0.45) gmGo('ok', 1.1); }
gmEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); gmDown(e.clientX, e.clientY); });
gmEl.addEventListener('pointermove', (e) => { e.preventDefault(); gmMove(e.clientX, e.clientY); });
gmEl.addEventListener('pointerup', (e) => { e.preventDefault(); e.stopPropagation(); gmUp(); });
function updateGMove(dt) { const m = gm; if (!m) return; m.t += dt; const r = m.r;
  if (m.type === 'escape') { gmBar(m.taps / m.need, m.taps >= m.need * 0.7); if (m.taps >= m.need) { endGMove(); grabbed = false; r.rig.act(null); popup(me.g.position.clone().setY(meScale * 2.4), 'BROKE FREE!', '#7dff3a'); knock(r.g, me.g.position, 2.6); shove(r.rig, r.g.position.x - me.g.position.x, r.g.position.z - me.g.position.z, 0.5, 0, 0.15); flashRig(r.rig); r.stun = 1.3; r.cd = Math.max(r.cd, 1.5); counterT = 1.3; sfx.boom(); jolt(0.6); banner('⚡ BROKE FREE! COUNTER IT!'); return; }
    if (m.t >= m.limit) { const f = m.then; endGMove(); f(); } return; }
  if (m.type === 'elbow') return;
  if (rival !== r || r.hp <= 0) { m.drive.k = 1; return; } r.stun = Math.max(r.stun, 0.5);
  if (m.phase === 'input') { if (m.type === 'superkick') { m.ring = Math.max(0.3, 2.4 - m.t * 1.7); const ring = gmEl.querySelector('.gmRing'), tgt = gmEl.querySelector('.gmTarget'), v = r.g.position.clone().setY(r.scale * 1.3).project(cam), sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight, R = 34 + r.scale * 14;
        ring.style.transform = 'translate(' + sx + 'px,' + sy + 'px) scale(' + (m.ring * R / 50) + ')'; tgt.style.transform = 'translate(' + sx + 'px,' + sy + 'px) scale(' + (R / 50) + ')'; ring.classList.toggle('hot', Math.abs(m.ring - 1) < 0.16); r.g.rotation.z = Math.sin(m.t * 9) * 0.12; // it reels toward you
        if (m.ring <= 0.3) { r.g.rotation.z = 0; gmGo('ok', 1.1); } }
      else if (m.t > 4.5) { if (m.type === 'chokeslam' || m.type === 'piledriver') m.drive.k = m.type === 'chokeslam' ? 0.45 : 0.35; gmGo('ok', 1); } // waited too long: it happens anyway, weakly
      return; }
  if (m.type === 'superkick') r.g.rotation.z = 0;
  const k = m.drive.k, slow = m.phase === 'hop' && !m.tapped && k > 0.35 && k < 0.62 ? 0.5 : 1; m.drive.k = Math.min(1, k + m.auto * dt * slow);
  if (m.phase === 'hop') { gmBar((m.drive.k - 0.35) / 0.27, false, [0.37, 0.74]); if (m.drive.k >= 0.62) { m.phase = 'auto'; if (!m.grade) m.grade = 'ok'; } }
  if (m.type === 'spear' && m.drive.k > 0.2 && m.drive.k < 0.8) { plough(me.g.position, meScale * 0.55, m.pl || (m.pl = { set: new Set([r]) })); if (m.drive.k > 0.36) plough(r.g.position, r.scale * 0.6, m.pl); } } // the charge ploughs through the town
// your hit on the rival: damage, a little knock back, and daze
function strikeRival(r, crit) { if (!r || r.hp <= 0 || r.dazedT > 0) { if (r && r.dazedT > 0) hitRival(RIVAL_HP * 0.01); return; } hitRival(RIVAL_HP * (crit ? 0.07 : 0.025));
  { const p = r.g.position.clone().lerp(me.g.position, 0.35).setY(Math.min(meScale, r.scale) * 1.15); fx.sparks(p, crit ? 16 : 7, { c: [0xffffff, 0xffd24a], speed: crit ? 9 : 6, up: 4, life: 0.45, size: 0.13 }); fx.flash(p, crit ? 0.9 : 0.4, 0xfff0c0); fx.dust({ x: r.g.position.x, y: 0, z: r.g.position.z }, 0.5 + r.scale * 0.3); jolt(crit ? 0.55 : 0.22); if (crit) { fx.shock(r.g.position, r.scale * 1.6); hitStop = 0.07; } } // sparks off the blow; a critical hit freezes the frame for an instant
  if (!rival) return; knock(r.g, me.g.position, crit ? 1.2 : 0.5);
  r.daze = Math.min(1, r.daze + (crit ? 0.34 : 0.11) * (1 - 0.3 * ramp())); if (r.atk && (crit || (ramp() < 0.3 && r.daze >= 0.5))) { scene.remove(r.ring); r.atk = null; r.g.rotation.x = 0; popup(r.g.position.clone().setY(r.scale * 2), 'INTERRUPTED!', '#7dff3a'); }
  if (r.daze >= 1) { r.dazedT = 3.5; r.atk = null; if (r.ring) scene.remove(r.ring); banner('💫 DAZED! SPIN IT OR SLAM IT!'); sfx.power(); } }
// the finisher: your signature wrestling move on the dazed rival, then your spell lands on it while it's down
const FINISHERS = ['chokeslam', 'piledriver', 'suplex', 'spear', 'superkick'];
function doFinisher() { const r = rival; if (!r || r.dazedT <= 0 || finishing) return; finishing = true; r.stun = 3; finishBtn.classList.add('hidden'); r.dazedT = 0; r.daze = 0; r.g.rotation.z = 0; moveTo = null;
  const mv = FINISHERS[(Math.random() * FINISHERS.length) | 0]; me.g.rotation.y = faceY = Math.atan2(r.g.position.x - me.g.position.x, r.g.position.z - me.g.position.z); banner(MOVE_NAME[mv] + '!'); startGMove(r, mv); }
finishBtn.querySelector('#kjFinMove').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (state === 'play') doFinisher(); });
finishBtn.querySelector('#kjFinSpin').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); const r = rival; if (state !== 'play' || !r || r.dazedT <= 0 || finishing || mini) return; r.dazedT = 0; r.daze = 0; r.g.rotation.z = 0; finishBtn.classList.add('hidden'); moveTo = null; startMini(r, 'spin'); });

// ---------- close combat: mini games ----------
// Up close a fight is one of five mini games, picked at random: BRAWL (mash to win a tug of war), SWIPE COMBO (swipe each
// arrow in time; every miss and the rival hits you), WEAK SPOTS (tap the glowing spots on the rival before they fade),
// DODGE & COUNTER (swipe away from the side it swings from, then tap to hit back) and SPIN & THROW (circle your finger to
// swing it by the tail and hurl it into the town). From across the street a rival can start a ROAR-OFF: hold to build
// your roar and let go in the green.
let mini = null, lastMini = ''; const miniEl = $('kjMini');
// ---------- a FIGHT (bout): when a rival reaches you, you're locked in together until a knockout, a giant-swing throw or
// the break after a few moves. It opens with a ROAR-OFF (the winner is PUMPED: +50% damage for the whole fight), then
// wrestling moves chain straight into each other with no pause. Nail a move's input and you hit it; flub it and the rival
// reverses it on you ----------
let bout = null;
const MOVES = ['chokeslam', 'piledriver', 'suplex', 'spear', 'superkick', 'spin'];
const MOVE_NAME = { chokeslam: 'SKYSCRAPER CHOKESLAM', piledriver: 'GRAVEYARD PILEDRIVER', suplex: 'TOWER SUPLEX', spear: 'WRECKING SPEAR', superkick: 'THUNDER SUPERKICK' };
function startBout(r) { bout = { r, n: 0, buff: 0, wait: 0, max: 4 + (Math.random() < 0.5 ? 1 : 0), anim: false }; moveTo = null; banner('🔔 FIGHT!'); sfx.wave(); startMini(r, 'roar'); }
function endBout(why) { if (!bout) return; const r = bout.r; bout = null; if (why === 'break' && r && rival === r && r.hp > 0) { banner('BREAK!'); knock(r.g, me.g.position, 3.5); knock(me.g, r.g.position, 1.5); r.cd = 4; r.stun = 1; } }
function boutTick(dt) { const b = bout; if (!rival || rival !== b.r || rival.hp <= 0 || died) { bout = null; return 0; } if (rival.toss) return 0;
  let walk = 0; if (!b.anim) { const P = me.g.position, Q = rival.g.position, d = new THREE.Vector3(Q.x - P.x, 0, Q.z - P.z), dist = d.length() || 1; d.divideScalar(dist);
    const want = (meScale + rival.scale) * 0.85, err = dist - want; b.spaceT = Math.abs(err) > 0.08 ? (b.spaceT || 0) + dt : 0; if (Math.abs(err) > 0.08 && b.spaceT < 1.5) { /* gives up after 1.5 s so a fight can never stall */ const st = Math.min(Math.abs(err) / 2, dt * 2.6 * Math.max(meScale, rival.scale)) * Math.sign(err); P.addScaledVector(d, st); Q.addScaledVector(d, -st); walk = 0.7; if (b.wait < 0.25) b.wait = 0.25; }
    const turn = (g, y) => { let dr = y - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 8); }; faceY = Math.atan2(d.x, d.z); turn(me.g, faceY); turn(rival.g, faceY + Math.PI); }
  b.wait -= dt; if (b.wait > 0) return walk; if (b.n >= b.max) { endBout('break'); return 0; }
  if (b.n >= 1 && lastMini !== 'escape' && Math.random() < 0.35 + 0.08 * (rival.stage - stage)) { startEscape(rival); return 0; }
  const pool = MOVES.filter((x) => x !== lastMini && (x !== 'spin' || b.n >= 2)); startMini(rival, pool[(Math.random() * pool.length) | 0]); return 0; }
// a free cast of the attacker's own spell on the downed fighter (yours on the rival, or the rival's on you)
function followUp(who, at, hostile) { const rig = who === me ? me : who, st = who === me ? stage : (rival ? rival.stage : 1); const rid = roundId;
  anims.push({ wait: 0.3, t: 0, dur: 0.01, go() { if (rid !== roundId || state !== 'play' || !rig.g.parent) return; spells.cast(caster(rig, st), st, at.clone(), hostile ? { hostile: true } : {}); popup(rig.g.position.clone().setY((who === me ? meScale : rival.scale) * 2.2), KAIJU[rig.id].spells[st - 1].toUpperCase() + '!', hostile ? '#ff5a5a' : '#7dff3a'); }, f() {}, end() {} }); }
// ---------- the rival goes for a move on you: an ESCAPE mini game (tap fast to break the hold). Break free and you shove
// it off with a counter; fail and the move lands, and its giant swing throws you across town ----------
const THREATS = ['chokeslam', 'piledriver', 'suplex', 'spin'];
let meToss = null;
function startEscape(r) { const mv = THREATS[(Math.random() * THREATS.length) | 0]; startMini(r, 'escape'); const m = mini; m.move = mv; m.v = 0; m.limit = mv === 'spin' ? 3 : 2.4;
  m.ang = Math.atan2(me.g.position.z - r.g.position.z, me.g.position.x - r.g.position.x); r.rig.act(mv === 'spin' ? 'clutch' : 'lift'); me.act('hit');
  $('kjMiniTitle').textContent = '⚠️ ' + KAIJU[r.id].name + ' ' + { chokeslam: 'GOING FOR A CHOKESLAM', piledriver: 'GOING FOR A PILEDRIVER', suplex: 'GOING FOR A SUPLEX', spin: 'SWINGING YOU ROUND' }[mv] + '! TAP FAST TO BREAK FREE!'; banner('ESCAPE!'); }
const actor = (who) => (who === 'me' ? { g: me.g, rig: me, s: meScale, body: me.body } : { g: rival.g, rig: rival.rig, s: rival.scale, body: rival.rig.body });
// the big moves, played on whoever is attacking (A) and defending (D); they end with D back in grappling range of A
function wrestle(type, aWho, dWho, o = {}) { const A = actor(aWho), D = actor(dWho); if (!A.g || !D.g) return 1;
  const a0 = A.g.position.clone(), fwd = new THREE.Vector3(D.g.position.x - a0.x, 0, D.g.position.z - a0.z); if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, 1); fwd.normalize();
  const grip = 0.5 * (A.s + D.s), H = 2.2 * D.s, ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2), cl = (x) => Math.max(0, Math.min(1, x)), at = (d, y = 0) => a0.clone().addScaledVector(fwd, d).setY(y);
  const crash = (p, big) => { fx.explode(p.clone().setY(0.4), Math.min(2.2, (big ? 0.42 : 0.3) * D.s)); fx.puff('smoke', p.clone().setY(0.3), 0.6 * D.s); sfx.boom(); flashT = Math.max(flashT, big ? 0.22 : 0.12); hitArea(p.clone().setY(0), 1.4 * D.s, 0, {}); hitAt = played; shove(D.rig, 0, 0, 0, 0, 0, 0.35); fx.dust({ x: p.x, y: 0, z: p.z }, 1 + D.s * 0.4); if (o.onHit) o.onHit(); };
  let hit = false, dur = 1.15, hitAt = -9; if (bout) bout.anim = true;
  const f = {
    chokeslam: (k) => { if (k < 0.45) { const q = ease(k / 0.45); D.g.position.copy(at(grip * 0.8, A.s * 1.9 * q)); D.g.rotation.x = 0; }
      else if (k < 0.6) { const q = (k - 0.45) / 0.15; D.g.position.copy(at(grip * 0.9, A.s * 1.9 * (1 - q * q))); D.g.rotation.x = -Math.PI / 2 * q; }
      else { if (!hit) { hit = true; crash(D.g.position, true); } D.g.position.y = 0; D.g.rotation.x = -Math.PI / 2; } },
    piledriver: (k) => { const top = H + A.s * 0.5; if (k < 0.35) { const q = ease(k / 0.35); D.g.position.copy(at(grip * 0.6, top * q)); D.g.rotation.z = Math.PI * q; }
      else if (k < 0.62) { const hop = Math.sin((k - 0.35) / 0.27 * Math.PI) * A.s * 0.5; A.g.position.y = hop; D.g.position.copy(at(grip * 0.6, top + hop)); }
      else if (k < 0.72) { const q = (k - 0.62) / 0.1; A.g.position.y = 0; A.body.rotation.x = 0.35 * q; D.g.position.copy(at(grip * 0.6, top - (top - H * 0.92) * q)); }
      else { if (!hit) { hit = true; crash(D.g.position, true); } const q = cl((k - 0.75) / 0.25); D.g.rotation.z = Math.PI - (Math.PI / 2) * q; D.g.position.y = H * 0.92 * (1 - q); A.body.rotation.x = 0.35 * (1 - q); } },
    suplex: (k) => { if (k < 0.15) { D.g.position.copy(at(grip * 0.6)); }
      else if (k < 0.8) { const u = ease((k - 0.15) / 0.65); D.g.position.copy(at(grip * 0.6 - u * (grip * 0.6 + A.s * 0.9), Math.sin(u * Math.PI) * A.s * 2.3)); D.g.rotation.x = -u * Math.PI * 1.5; A.body.rotation.x = -0.75 * Math.sin(u * Math.PI); }
      else { if (!hit) { hit = true; D.g.position.y = 0; crash(D.g.position, true); } D.g.rotation.x = -Math.PI * 1.5; A.body.rotation.x = 0; } },
    spear: (k) => { dur = 0.95; if (k < 0.35) { const q = ease(k / 0.35); A.g.position.copy(a0.clone().addScaledVector(fwd, -A.s * 0.6 + q * (A.s * 0.6 + Math.max(0, Math.hypot(d1.x - a0.x, d1.z - a0.z) - grip * 0.75)))); A.body.rotation.x = 0.6 * q; }
      else { const q = cl((k - 0.35) / 0.4); if (!hit) { hit = true; crash(D.g.position, false); } D.g.position.copy(d1.clone().addScaledVector(fwd, A.s * 1.6 * ease(q)).setY(0)); D.g.rotation.x = -Math.PI / 2 * ease(q); A.body.rotation.x = 0.6 * (1 - q); } },
    superkick: (k) => { dur = 0.85; if (k < 0.3) { A.body.rotation.y = Math.PI * 2 * ease(k / 0.3); if (k < 0.05) A.rig.act('hit'); }
      else { A.body.rotation.y = 0; const q = cl((k - 0.3) / 0.35); if (!hit) { hit = true; crash(D.g.position.clone().setY(D.s), false); popup(D.g.position.clone().setY(D.s * 2.2), '💫💫', '#ffd24a'); } D.g.position.copy(d1.clone().addScaledVector(fwd, A.s * 0.9 * ease(q)).setY(0)); D.g.rotation.x = -0.7 * Math.sin(q * Math.PI); } },
  }[type];
  if (!f) { if (bout) bout.anim = false; return 0.3; }
  if (type !== 'superkick') A.rig.act(type === 'spear' ? 'clutch' : 'lift'); D.rig.act('hit');
  const a1 = A.g.position.clone(), d1 = D.g.position.clone(); /* where they stood: the move eases in from there (they step in and grab) instead of snapping */
  anims.push({ wait: 0, t: 0, dur: o.drive ? 1e6 : dur, go() {}, f(k) { if (o.drive) { k = Math.min(1, o.drive.k); if (k >= 1) this.t = this.dur; } if (!A.g.parent || !D.g.parent) return; f(k);
      if (hit) { const u = played - hitAt, b = u < 0.3 ? Math.sin(u / 0.3 * Math.PI) * 0.3 * D.s : u < 0.5 ? Math.sin((u - 0.3) / 0.2 * Math.PI) * 0.08 * D.s : 0; D.g.position.y += b - (this.lb || 0); this.lb = b; } /* the body bounces once off the ground */ if (k < 0.2) { const w = ease(k / 0.2); A.g.position.x = a1.x + (A.g.position.x - a1.x) * w; A.g.position.z = a1.z + (A.g.position.z - a1.z) * w; D.g.position.x = d1.x + (D.g.position.x - d1.x) * w; D.g.position.z = d1.z + (D.g.position.z - d1.z) * w; } },
    end() { D.g.position.y = 0; A.g.position.y = 0; A.body.rotation.set(0, 0, 0); if (['grab', 'cast', 'lift', 'clutch'].includes(A.rig.acting)) A.rig.act(null); getUp(D.g); if (o.onEnd) o.onEnd(); } });
  return dur;
}
// a downed fighter stays put for a moment, then rolls back up onto its feet where it landed
function getUp(g) { const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), rx = wrap(g.rotation.x), rz = wrap(g.rotation.z); if (bout) { bout.anim = true; bout.wait = Math.max(bout.wait, 1.1); }
  if (Math.abs(rx) + Math.abs(rz) < 0.05) { g.rotation.x = g.rotation.z = 0; if (bout) bout.anim = false; return; }
  const e2 = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2), rg = me && g === me.g ? me : rival && g === rival.g ? rival.rig : null;
  anims.push({ wait: 0.3, t: 0, dur: 0.85, go() {}, f(k) { const up = k < 0.4 ? e2(k / 0.4) * 0.55 : k < 0.58 ? 0.55 : 0.55 + 0.45 * e2((k - 0.58) / 0.42), q = 1 - up; g.rotation.x = rx * q; g.rotation.z = rz * q; g.position.y = k > 0.58 ? Math.sin((k - 0.58) / 0.42 * Math.PI) * 0.12 * g.scale.x : 0; },
    end() { g.rotation.x = g.rotation.z = 0; g.position.y = 0; if (rg) shove(rg, 0, 0, 0, 0, 0.18, 0.12); if (bout) bout.anim = false; } }); }
const CLOSE = ['brawl', 'swipe', 'spots', 'dodge', 'spin'];
const ARROWS = { L: '⬅', R: '➡', U: '⬆', D: '⬇' };
function startMini(r, type) {
  if (!type) { const pool = CLOSE.filter((x) => x !== lastMini); type = pool[(Math.random() * pool.length) | 0]; } lastMini = type;
  const face = Math.atan2(r.g.position.x - me.g.position.x, r.g.position.z - me.g.position.z); me.g.rotation.y = faceY = face; r.g.rotation.y = face + Math.PI;
  mini = { type, r, t: 0, v: 0 }; const m = mini; $('kjMiniSeq').innerHTML = ''; $('kjMiniSpots').innerHTML = ''; miniEl.dataset.side = '';
  const title = { escape: '⚠️ BREAK FREE!', chokeslam: '🦍 CHOKESLAM! HOLD, LET GO IN THE GREEN', piledriver: '⚰️ PILEDRIVER! TAP TAP TAP!', suplex: '🌀 SUPLEX! SWIPE ⬆ THEN ⬇', spear: '🏈 SPEAR! TAP WHEN IT\'S IN THE GREEN', superkick: '🦶 SUPERKICK! WAIT... TAP ON THE FLASH!', brawl: '👊 BRAWL! TAP TAP TAP!', swipe: '🌀 SWIPE COMBO! SWIPE THE ARROWS', spots: '🎯 WEAK SPOTS! TAP THEM', dodge: '💨 DODGE! SWIPE AWAY FROM THE HIT', spin: '🌪️ SPIN & THROW! CIRCLE YOUR FINGER', roar: '🦖 ROAR-OFF! HOLD, LET GO IN THE GREEN' }[type];
  $('kjMiniTitle').textContent = title; banner({ escape: 'ESCAPE!', chokeslam: 'CHOKESLAM?', piledriver: 'PILEDRIVER?', suplex: 'SUPLEX?', spear: 'SPEAR?', superkick: 'SUPERKICK?', brawl: 'BRAWL!', swipe: 'SWIPE COMBO!', spots: 'WEAK SPOTS!', dodge: 'DODGE!', spin: 'SPIN & THROW!', roar: 'ROAR-OFF!' }[type]);
  if (type === 'swipe') { const n = 4 + Math.min(2, r.stage - 1); m.seq = Array.from({ length: n }, () => 'LRU'[(Math.random() * 3) | 0]); m.i = 0; m.tt = 0; m.limit = Math.max(0.8, 1.4 - 0.15 * (r.stage - 1)); m.good = 0;
    $('kjMiniSeq').innerHTML = m.seq.map((d, i) => '<span id="kjA' + i + '">' + ARROWS[d] + '</span>').join(''); }
  if (type === 'spots') { m.spawned = 0; m.total = 8; m.next = 0.2; m.live = []; }
  if (type === 'dodge') { m.round = 0; nextDodge(m); }
  if (type === 'spin') { m.ang = 0; m.last = null; m.spinA = Math.atan2(r.g.position.z - me.g.position.z, r.g.position.x - me.g.position.x); m.lift = 0; r.spun = true; r.rig.shadow.visible = false; me.act('cast'); }
  if (type === 'chokeslam' || type === 'spear') { const z0 = 0.35 + Math.random() * 0.4, zw = type === 'spear' ? 0.16 : 0.2; m.zone = [z0, z0 + zw]; m.hold = false; m.pos = 0; m.dir = 1; $('kjMiniZone').style.left = z0 * 100 + '%'; $('kjMiniZone').style.width = zw * 100 + '%'; }
  if (type === 'piledriver') m.v = 0;
  if (type === 'suplex') { m.seq = ['U', 'D']; m.i = 0; m.tt = 0; m.limit = 1.1; $('kjMiniSeq').innerHTML = m.seq.map((d, i) => '<span id="kjA' + i + '">' + ARROWS[d] + '</span>').join(''); }
  if (type === 'superkick') { m.flashAt = 0.8 + Math.random() * 1.4; m.flashed = false; m.ft = 0; }
  if (type === 'roar') { m.zone = [0.7, 0.9]; m.hold = false; $('kjMiniZone').style.left = '70%'; $('kjMiniZone').style.width = '20%'; me.act('cast'); r.rig.act('cast'); }
  miniEl.className = 'm-' + type; sfx.wave(); placeMiniPanel(true);
}
// ---------- fight moves: every hit in a mini game is shown. Machines (the robots and the Mecha-Godzillys) rock back and
// unload (a burst of tracer rounds, rockets on the big hits); monsters spin round and fling a bolt in their spell colour.
// The rival does the same when it hits you ----------
const anims = []; // { wait, t, dur, go(), f(k), end() }
const isGunner = (rig) => rig.def.kind === 'robot' || rig.id === 'mecha' || rig.id === 'mechax';
const spellCol = (rig) => rig.tint ?? (rig.def.pal ? rig.def.pal[3] : 0xffb02a);
const fxMat = new Map(); const fxM = (col) => { if (!fxMat.has(col)) fxMat.set(col, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })); return fxMat.get(col); };
const boxG = new THREE.BoxGeometry(1, 1, 1), ballG = new THREE.IcosahedronGeometry(1, 1), rocketG = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); rocketG.rotateX(Math.PI / 2);
const wpos = (o) => o.getWorldPosition(new THREE.Vector3());
function shoot(rig, target, kind, wait) { const s = rig.g.scale.x;
  const A = { wait, t: 0, dur: kind === 'bullet' ? 0.13 : kind === 'rocket' ? 0.34 : kind === 'laser' ? 0.5 : 0.26, m: null, a: null, b: null,
    go() { this.a = wpos(kind === 'spell' ? rig.mouth : rig.hand || rig.chest || rig.mouth); this.b = target.g.position.clone().setY(target.g.scale.x * (0.9 + Math.random() * 0.5)); this.b.x += (Math.random() - 0.5) * target.g.scale.x * 0.5; this.b.z += (Math.random() - 0.5) * target.g.scale.x * 0.5;
      const m = new THREE.Group();
      if (kind === 'laser') { const col = rig.tint ?? 0xff3a3a; this.beam = new THREE.Mesh(rocketG, fxM(col)); this.core = new THREE.Mesh(rocketG, fxM(0xfffffe)); scene.add(this.beam, this.core); this.m = new THREE.Group(); scene.add(this.m); sfx.whoosh(); return; }
      if (kind === 'bullet') { const t = new THREE.Mesh(boxG, fxM(0xffe27a)); t.scale.set(0.06 * s, 0.06 * s, 0.5 * s); m.add(t); if (Math.random() < 0.5) sfx.hit(); }
      else if (kind === 'rocket') { const body = new THREE.Mesh(rocketG, new THREE.MeshBasicMaterial({ color: 0xc8cdd2 })); body.scale.set(0.12 * s, 0.12 * s, 0.45 * s); const flame = new THREE.Mesh(ballG, fxM(0xff8a2a)); flame.scale.setScalar(0.12 * s); flame.position.z = -0.28 * s; m.add(body, flame); sfx.whoosh(); }
      else { const col = spellCol(rig), core = new THREE.Mesh(ballG, fxM(0xfffffe)), glow = new THREE.Mesh(ballG, fxM(col)); core.scale.setScalar(0.12 * s); glow.scale.setScalar(0.26 * s); m.add(core, glow); m.userData.col = col; }
      m.position.copy(this.a); m.lookAt(this.b); scene.add(m); this.m = m; },
    f(k) { if (kind === 'laser') { const mid = this.a.clone().lerp(this.b, 0.5), len = this.a.distanceTo(this.b), w = s * 0.12 * (1 + Math.sin(k * 40) * 0.25) * Math.sin(k * Math.PI); for (const [m, ww] of [[this.beam, w], [this.core, w * 0.4]]) { m.position.copy(mid); m.lookAt(this.b); m.scale.set(ww, ww, len); } if (Math.random() < 0.5) fx.puff('flame', this.b, 0.1 * s); return; }
      this.m.position.lerpVectors(this.a, this.b, k); if (kind === 'rocket') this.m.position.y += Math.sin(k * Math.PI) * s * 0.4; if (kind !== 'bullet' && Math.random() < 0.6) fx.puff(kind === 'rocket' ? 'smoke' : 'flame', this.m.position.clone(), 0.15 * s); },
    end() { scene.remove(this.m); if (this.beam) scene.remove(this.beam, this.core); if (kind === 'laser') { fx.explode(this.b, Math.min(1.4, 0.26 * s)); return; } if (kind === 'bullet') fx.puff('flame', this.b, 0.12 * s); else { fx.explode(this.b, Math.min(1.6, (kind === 'rocket' ? 0.3 : 0.24) * s)); if (kind === 'rocket') sfx.boom(); } } };
  anims.push(A); }
// Mike's fight move: the two-handed overhead slam, a shockwave where it lands (the slam hits about 0.4 s in)
// smashing a building, a target or a snack: a quick hit, or for Mike a golf swing with his hammer
function smashAct() { if (!me.hammer) return me.act('hit'); if (!me.acting) me.act('golf'); }
function hammerSlam(rig, target, big) { if (rig.acting !== 'hit') rig.act('hit');
  anims.push({ wait: 0.38, t: 0, dur: 0.01, go() { const p = wpos(rig.hand).setY(0.2); fx.explode(p, Math.min(1.6, 0.3 * rig.g.scale.x)); fx.puff('smoke', p, 0.5 * rig.g.scale.x); sfx.boom(); flashT = big ? 0.15 : 0.06; if (big) knock(target.g, rig.g.position, 1.2); }, f() {}, end() {} });
  shoot(rig, target, 'spell', 0.4); if (big) shoot(rig, target, 'spell', 0.52); }
function flourish(rig, target, big = false) {
  if (!rig || !target || !target.g) return; if (!big && played - (rig.flT ?? -9) < 0.3) return; rig.flT = played;
  if (isGunner(rig)) { // rock back and unload
    anims.push({ wait: 0, t: 0, dur: big ? 0.5 : 0.32, go() {}, f(k) { rig.body.position.z = -(big ? 0.45 : 0.3) * Math.sin(k * Math.PI); rig.body.rotation.x = -0.12 * Math.sin(k * Math.PI); }, end() { rig.body.position.z = 0; rig.body.rotation.x = 0; } });
    if (big) { knock(rig.g, target.g.position, 0.5); for (let i = 0; i < 4; i++) shoot(rig, target, 'rocket', 0.08 + i * 0.1); } else for (let i = 0; i < 4; i++) shoot(rig, target, 'bullet', i * 0.06);
  } else if (rig.hammer || rig.wrestler) { if (rig.acting !== 'hit') hammerSlam(rig, target, big); }
  else { // spin round and fling a bolt
    anims.push({ wait: 0, t: 0, dur: big ? 0.55 : 0.38, go() {}, f(k) { rig.body.rotation.y = Math.PI * 2 * (big ? 2 : 1) * (1 - Math.pow(1 - k, 2)); }, end() { rig.body.rotation.y = 0; } });
    shoot(rig, target, 'spell', big ? 0.2 : 0.16); if (big) { shoot(rig, target, 'spell', 0.32); shoot(rig, target, 'spell', 0.44); }
  }
}
// the brawl's big moves, taking turns: machines unload a machine-gun burst, then a laser, then a cannon volley; monsters throw a
// spinning haymaker, then a double spin with a fan of bolts, then a rearing blast. One move plays out fully before the next.
function bigMove(rig, target, n) {
  if (!rig || !target || !target.g) return; const step = n % 3, recoil = (amt, dur) => anims.push({ wait: 0, t: 0, dur, go() {}, f(k) { rig.body.position.z = -amt * Math.sin(k * Math.PI); rig.body.rotation.x = -0.15 * Math.sin(k * Math.PI); }, end() { rig.body.position.z = 0; rig.body.rotation.x = 0; } });
  if (isGunner(rig)) {
    if (step === 0) { recoil(0.25, 0.7); for (let i = 0; i < 10; i++) shoot(rig, target, 'bullet', i * 0.06); }
    else if (step === 1) { rig.act('cast'); shoot(rig, target, 'laser', 0.12); }
    else { recoil(0.5, 0.6); for (let i = 0; i < 4; i++) shoot(rig, target, 'rocket', 0.05 + i * 0.12); }
  } else if (rig.hammer || rig.wrestler) { // slam, a double slam, then the boomerang hammer throw (a wrestler throws a big boot)
    if (step === 0) hammerSlam(rig, target, true);
    else if (step === 1) { hammerSlam(rig, target, true); anims.push({ wait: 0.78, t: 0, dur: 0.01, go() { rig.act(null); hammerSlam(rig, target, true); }, f() {}, end() {} }); }
    else if (rig.hammer) throwHammer(rig, target.g);
    else bootAway(rig, target);
  } else {
    const spin = (turns, dur) => anims.push({ wait: 0, t: 0, dur, go() {}, f(k) { rig.body.rotation.y = Math.PI * 2 * turns * (1 - Math.pow(1 - k, 2)); }, end() { rig.body.rotation.y = 0; } });
    if (step === 0) { spin(1, 0.55); anims.push({ wait: 0.3, t: 0, dur: 0.01, go() { rig.act('hit'); sfx.hit(); }, f() {}, end() {} }); shoot(rig, target, 'spell', 0.32); }
    else if (step === 1) { spin(2, 0.75); for (let i = 0; i < 3; i++) shoot(rig, target, 'spell', 0.3 + i * 0.12); }
    else { rig.act('cast'); for (let i = 0; i < 2; i++) shoot(rig, target, 'spell', 0.25 + i * 0.1); anims.push({ wait: 0.55, t: 0, dur: 0.01, go() { fx.explode(target.g.position.clone().setY(target.g.scale.x), Math.min(2, 0.35 * rig.g.scale.x)); sfx.boom(); }, f() {}, end() {} }); }
  }
}
// ---------- the roar-off result: the winner celebrates and the loser sulks, each body type its own way ----------
const env = (k) => Math.sin(k * Math.PI);
const EMOTE = {
  win: {
    biped: (b, k, s) => { b.rotation.x = -0.35 * s; b.position.y = Math.abs(Math.sin(k * Math.PI * 4)) * 0.25 * s; }, // rears back, stomp-stomp
    ape: (b, k, s) => { b.position.y = Math.abs(Math.sin(k * Math.PI * 5)) * 0.45 * s; b.rotation.z = Math.sin(k * Math.PI * 5) * 0.15 * s; }, // hops side to side
    robot: (b, k) => { const q = Math.min(1, k * 1.4); b.rotation.y = Math.PI * 2 * q; b.position.y = Math.sin(q * Math.PI) * 0.6; }, // victory spin and jump
    quad: (b, k, s) => { b.rotation.x = -0.75 * s; b.position.y = 0.3 * s; }, // rears up on its hind legs
    crab: (b, k, s) => { b.position.x = Math.sin(k * Math.PI * 6) * 0.35 * s; b.position.y = 0.15 * s; }, // side-shuffle dance
    spider: (b, k, s) => { b.position.y = Math.abs(Math.sin(k * Math.PI * 8)) * 0.3 * s; b.rotation.y = Math.sin(k * Math.PI * 4) * 0.4 * s; }, // jittery bouncing
    moth: (b, k) => { b.rotation.x = -Math.PI * 2 * k; b.position.y = Math.sin(k * Math.PI) * 1.2; }, // loop-the-loop
    ptero: (b, k) => { b.rotation.x = -Math.PI * 2 * k; b.position.y = Math.sin(k * Math.PI) * 1.2; },
    blob: (b, k, s) => { const q = Math.sin(k * Math.PI * 6) * 0.3 * s; b.scale.set(1 - q * 0.5, 1 + q, 1 - q * 0.5); b.position.y = Math.max(0, q) * 0.5; }, // boing-boing
    plant: (b, k, s) => { b.rotation.z = Math.sin(k * Math.PI * 6) * 0.35 * s; }, // wild swaying dance
    squid: (b, k) => { b.rotation.y = Math.PI * 4 * k; b.position.y = Math.sin(k * Math.PI) * 0.8; }, // twirls up
    human: (b, k, s) => { b.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.2 * s; },
    wrestler: (b, k, s) => { b.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.2 * s; },
  },
  lose: {
    any: (b, k, s) => { b.rotation.x = 0.35 * s; b.position.y = -0.15 * s; b.rotation.y = Math.sin(k * Math.PI * 6) * 0.25 * s; }, // slumps and shakes its head
    robot: (b, k, s) => { b.rotation.z = Math.sin(k * Math.PI * 14) * 0.12 * s; b.position.y = -0.25 * s; }, // shudders and sags
    blob: (b, k, s) => { b.scale.set(1 + 0.4 * s, 1 - 0.5 * s, 1 + 0.4 * s); }, // deflates
    moth: (b, k, s) => { b.rotation.z = Math.sin(k * Math.PI * 5) * 0.5 * s; b.position.y = -0.4 * s; }, // wobbles and sinks
    ptero: (b, k, s) => { b.rotation.z = Math.sin(k * Math.PI * 5) * 0.5 * s; b.position.y = -0.4 * s; },
    crab: (b, k, s) => { b.position.y = -0.3 * s; b.rotation.x = 0.2 * s; }, // hides in its shell
    spider: (b, k, s) => { b.rotation.z = Math.PI * Math.min(1, s * 1.6); b.position.y = 0.4 * s; }, // flips onto its back
    plant: (b, k, s) => { b.rotation.x = 0.7 * s; }, // wilts
  },
};
function emote(rig, good) { if (!rig || !rig.body) return; const b = rig.body, set = EMOTE[good ? 'win' : 'lose'], fn = set[rig.def.kind] || set.any || set.biped;
  if (good) rig.act(rig.hammer || rig.wrestler ? 'win' : 'cast');
  anims.push({ wait: 0, t: 0, dur: 1.5, go() {}, f(k) { fn(b, k, env(k)); }, end() { b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1); } }); }
// Mike's victory: the sledgehammer spins out at the enemy, smashes it and flies back to his hand
function throwHammer(rig, target, delay = 0) { const h = rig.hammer; if (!h || h.userData.flying || !target) return; const home = h.parent, p0 = h.position.clone(), q0 = h.quaternion.clone(), s = rig.g.scale.x;
  h.userData.flying = true; anims.push({ wait: delay, t: 0, dur: 0.01, go() { rig.g.rotation.y = Math.atan2(target.position.x - rig.g.position.x, target.position.z - rig.g.position.z); rig.act('bat'); }, f() {}, end() {} });
  anims.push({ wait: delay + 0.42, t: 0, dur: 1.5, hit: false,
    go() { scene.attach(h); this.a = wpos(h); sfx.throw(); },
    f(k) { const to = target.position.clone().setY(target.scale.x * 1.3), back = wpos(home), out = k < 0.5, q = out ? k / 0.5 : (k - 0.5) / 0.5;
      if (out) h.position.lerpVectors(this.a, to, q); else h.position.lerpVectors(to, back, q);
      h.position.y += Math.sin(q * Math.PI) * s * 0.8; h.rotation.set(k * Math.PI * 10, 0, 0.3);
      if (Math.random() < 0.5) fx.puff('smoke', h.position.clone(), 0.12 * s);
      if (!out && !this.hit) { this.hit = true; fx.explode(to.clone(), Math.min(1.8, 0.35 * s)); sfx.boom(); flashT = 0.12; banner('HAMMER THROW!'); } },
    end() { home.attach(h); h.position.copy(p0); h.quaternion.copy(q0); h.userData.flying = false; } }); }
// the big boot: a front kick that sends a close rival flying back
function bootAway(rig, target, delay = 0) { const tg = target.g || target;
  anims.push({ wait: delay, t: 0, dur: 0.01, go() { rig.g.rotation.y = Math.atan2(tg.position.x - rig.g.position.x, tg.position.z - rig.g.position.z); rig.act('kick'); sfx.whoosh(); }, f() {}, end() {} });
  anims.push({ wait: delay + 0.2, t: 0, dur: 0.01, go() { if (!tg.parent) return; knock(tg, rig.g.position, 2.2); const p = tg.position.clone().setY(tg.scale.x * 1.2); fx.explode(p, Math.min(1.6, 0.3 * rig.g.scale.x)); sfx.boom(); flashT = 0.12; popup(p, 'BOOT!', '#ffd24a'); }, f() {}, end() {} }); }
function updateAnims(dt) { for (let i = anims.length - 1; i >= 0; i--) { const A = anims[i]; if (A.wait > 0) { A.wait -= dt; continue; } if (A.t === 0) A.go(); A.t += dt; const k = Math.min(1, A.t / A.dur); A.f(k); if (k >= 1) { anims.splice(i, 1); A.end(); } } }
function clearAnims() { for (const A of anims) { if (A.m) scene.remove(A.m); if (A.t > 0) A.end(); } anims.length = 0; }
function nextDodge(m) { m.round++; m.phase = 'warn'; m.pt = 0; m.side = Math.random() < 0.5 ? 'L' : 'R'; miniEl.dataset.side = m.side; m.r.rig.act('cast'); $('kjMiniSeq').innerHTML = '<span class="on">' + (m.side === 'L' ? 'SWIPE ➡' : '⬅ SWIPE') + '</span>'; }
// gestures on the overlay
let gest = null;
miniEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!mini || state !== 'play') return; gest = { x: e.clientX, y: e.clientY, t: performance.now() }; const m = mini;
  if (m.type === 'brawl') { m.v += 0.12 + 0.025 * (stage - m.r.stage); m.lastTap = played; if (Math.random() < 0.3) fx.puff('smoke', m.r.g.position.clone().setY(m.r.scale), 0.3); }
  else if (m.type === 'roar' || m.type === 'chokeslam') { m.hold = true; }
  else if (m.type === 'piledriver') { m.v += 0.15 + 0.02 * (stage - m.r.stage); }
  else if (m.type === 'escape') { m.v += 0.12 + 0.02 * (stage - m.r.stage); if (Math.random() < 0.4) fx.puff('smoke', me.g.position.clone().setY(meScale), 0.3); }
  else if (m.type === 'spear') { endMini(m.pos >= m.zone[0] && m.pos <= m.zone[1] ? 'pin' : 'rev'); return; }
  else if (m.type === 'superkick') { endMini(m.flashed && m.ft <= 0.55 ? 'pin' : 'rev'); return; }
  else if (m.type === 'dodge' && m.phase === 'counter') { flourish(me, m.r, true); hitRival(14 + 4 * stage); me.act('hit'); sfx.boom(); popup(m.r.g.position.clone().setY(m.r.scale * 2), 'COUNTER!', '#7dff3a'); m.phase = 'gap'; m.pt = 0; $('kjMiniSeq').innerHTML = ''; }
  else if (m.type === 'spin') { m.last = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); } });
miniEl.addEventListener('pointermove', (e) => { const m = mini; if (!m || m.type !== 'spin' || m.last == null) return; const a = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); let d = a - m.last; d = Math.atan2(Math.sin(d), Math.cos(d)); m.ang += Math.abs(d); m.last = a; m.spinA += d; });
miniEl.addEventListener('pointerup', (e) => { const m = mini; if (!m || !gest) return; const dx = e.clientX - gest.x, dy = e.clientY - gest.y; gest = null;
  if (m.type === 'roar' && m.hold) { m.hold = false; if (m.v >= m.zone[0] && m.v <= m.zone[1]) endMini('roarWin'); else endMini('roarWeak'); return; }
  if (m.type === 'chokeslam' && m.hold) { m.hold = false; endMini(m.v >= m.zone[0] && m.v <= m.zone[1] ? 'pin' : 'rev'); return; }
  if (m.type === 'spin') { m.last = null; return; }
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return; const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
  if (m.type === 'swipe') swipeAnswer(m, dir);
  else if (m.type === 'suplex') { const ok = dir === m.seq[m.i], el = $('kjA' + m.i); if (el) el.className = ok ? 'ok' : 'bad'; if (!ok) return endMini('rev'); m.i++; m.tt = 0; if (m.i >= m.seq.length) endMini('pin'); }
  else if (m.type === 'dodge' && m.phase === 'warn') { if ((m.side === 'L' && dir === 'R') || (m.side === 'R' && dir === 'L')) { m.phase = 'counter'; m.pt = 0; miniEl.dataset.side = ''; knock(me.g, m.r.g.position, 0.6); $('kjMiniSeq').innerHTML = '<span class="on">TAP!</span>'; popup(me.g.position.clone().setY(meScale * 2), 'DODGED!', '#9fd6ff'); } else dodgeHit(m); } });
function swipeAnswer(m, dir) { const ok = dir === m.seq[m.i]; const el = $('kjA' + m.i); if (el) el.className = ok ? 'ok' : 'bad';
  if (ok) { m.good++; flourish(me, m.r); hitRival(8 + 3 * stage); me.act('hit'); sfx.hit(); } else { m.r.rig.act('hit'); flourish(m.r.rig, me); hurt(1.5 + m.r.stage, true); sfx.hurt(); }
  m.i++; m.tt = 0; if (m.i >= m.seq.length) { if (m.good === m.seq.length) { hitRival(15); popup(m.r.g.position.clone().setY(m.r.scale * 2), 'PERFECT COMBO!', '#7dff3a'); } endMini('done'); } }
function dodgeHit(m) { m.r.rig.act('hit'); flourish(m.r.rig, me, true); hurt(3 + 1.5 * m.r.stage, true); sfx.hurt(); miniEl.dataset.side = ''; m.phase = 'gap'; m.pt = 0; $('kjMiniSeq').innerHTML = '<span class="bad">HIT!</span>'; }
function spot(m) { const v = m.r.g.position.clone().setY(m.r.scale * 1.1).project(cam); const x = Math.max(40, Math.min(innerWidth - 40, (v.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 140)), y = Math.max(120, Math.min(innerHeight - 220, (-v.y * 0.5 + 0.5) * innerHeight + (Math.random() - 0.5) * 160));
  const b = document.createElement('div'); b.className = 'kjSpot'; b.style.left = x + 'px'; b.style.top = y + 'px'; $('kjMiniSpots').appendChild(b); const s = { b, life: 1.05, dead: false };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (s.dead || !mini) return; s.dead = true; b.classList.add('pop'); setTimeout(() => b.remove(), 200); flourish(me, mini.r); hitRival(7 + 3 * stage); me.act('hit'); sfx.hit(); });
  m.live.push(s); }
// the mini game's panel follows the fight: it sits just under the two monsters' feet, kept inside the screen, so the
// player's eyes don't have to jump to the bottom of the screen and back
const miniPanel = miniEl.querySelector('.panel'), miniAt = { x: -1, y: -1 };
function placeMiniPanel(snap) { if (!mini || !me) return; const r = mini.r, P = me.g.position, R = r.g.position, near = Math.hypot(R.x - P.x, R.z - P.z) < 30;
  const v = tmp.set(near ? (P.x + R.x) / 2 : P.x, 0, near ? (P.z + R.z) / 2 : P.z).project(cam); const w = miniPanel.offsetWidth || 300, h = miniPanel.offsetHeight || 90, pad = 10;
  const x = Math.max(w / 2 + pad, Math.min(innerWidth - w / 2 - pad, (v.x * 0.5 + 0.5) * innerWidth)), y = Math.max(90, Math.min(innerHeight - h - 60, (-v.y * 0.5 + 0.5) * innerHeight + 24));
  if (snap || miniAt.x < 0) { miniAt.x = x; miniAt.y = y; } else { miniAt.x += (x - miniAt.x) * 0.2; miniAt.y += (y - miniAt.y) * 0.2; }
  miniPanel.style.left = miniAt.x + 'px'; miniPanel.style.top = miniAt.y + 'px'; miniPanel.style.bottom = 'auto'; }
function updateMini(dt) {
  const m = mini, r = m.r; m.t += dt; if (!rival || r.hp <= 0) return endMini(null); placeMiniPanel(false);
  if (m.type === 'brawl') { m.v -= dt * Math.max(0.3, 0.55 + 0.12 * (r.stage - 1) - 0.08 * (stage - 1));
    m.myT = (m.myT ?? 0.1) - dt; if (played - (m.lastTap ?? -9) < 0.45 && m.myT <= 0) { m.myT = 0.8; bigMove(me, r, m.myN = (m.myN ?? -1) + 1); }
    m.rvT = (m.rvT ?? 0.6) - dt; if (m.rvT <= 0) { m.rvT = 1.3 + Math.random() * 0.5; bigMove(r.rig, me, m.rvN = (m.rvN ?? -1) + 1); }
    $('kjMiniMark').style.left = ((1 - m.v) * 50) + '%'; if (m.v >= 1) return endMini('win'); if (m.v <= -1) return endMini('lose'); if (m.t > 7) return endMini('draw'); }
  else if (m.type === 'swipe') { m.tt += dt; $('kjMiniMark').style.left = Math.max(0, 100 - m.tt / m.limit * 100) + '%'; const el = $('kjA' + m.i); if (el && el.className !== 'on') el.className = 'on'; if (m.tt >= m.limit) swipeAnswer(m, '-'); }
  else if (m.type === 'spots') { m.next -= dt; if (m.next <= 0 && m.spawned < m.total) { m.next = 0.42; m.spawned++; spot(m); }
    for (const s of m.live) { if (s.dead) continue; s.life -= dt; if (s.life <= 0) { s.dead = true; s.b.classList.add('miss'); setTimeout(() => s.b.remove(), 250); r.rig.act('hit'); flourish(r.rig, me); hurt(1 + 0.5 * r.stage, true); } }
    $('kjMiniMark').style.left = (100 - m.spawned / m.total * 100) + '%'; if (m.spawned >= m.total && m.live.every((s) => s.dead)) return endMini('done'); }
  else if (m.type === 'dodge') { m.pt += dt; $('kjMiniMark').style.left = (100 - m.round / 3 * 100) + '%';
    if (m.phase === 'warn' && m.pt > Math.max(0.6, 1.0 - 0.1 * (r.stage - 1))) dodgeHit(m);
    else if (m.phase === 'counter' && m.pt > 0.8) { m.phase = 'gap'; m.pt = 0; $('kjMiniSeq').innerHTML = ''; }
    else if (m.phase === 'gap' && m.pt > 0.45) { if (m.round >= 3) return endMini('done'); nextDodge(m); } }
  else if (m.type === 'spin') { m.lift = Math.min(1, m.lift + dt * 2.5); const P = me.g.position, R = meScale * 0.75 + r.scale * 0.6, cy = me.fly ? meScale * 0.1 : r.scale * 0.35, k = m.lift < 1 ? Math.min(1, dt * 8) : 1;
    const tx = P.x + Math.cos(m.spinA) * R, tz = P.z + Math.sin(m.spinA) * R; r.g.position.x += (tx - r.g.position.x) * k; r.g.position.z += (tz - r.g.position.z) * k; r.g.position.y += (cy - r.g.position.y) * k;
    r.g.rotation.set(0, Math.PI / 2 - m.spinA, 1.5 * m.lift); if (m.lift > 0.6) plough(r.g.position, r.scale * 0.7, m.pl || (m.pl = { set: new Set([r]) })); me.g.rotation.y = faceY = Math.atan2(tx - P.x, tz - P.z); if (me.hammer && me.acting !== 'grab') me.act('grab'); // Mike: arms out, hauling it round
    const need = Math.PI * 2 * (2.5 + 0.5 * r.stage); $('kjMiniMark').style.left = Math.min(100, m.ang / need * 100) + '%'; if (m.ang >= need) return endMini('throw'); if (m.t > 5) return endMini('freed'); }
  else if (m.type === 'escape') { m.v = Math.max(0, m.v - dt * (0.3 + 0.06 * (r.stage - 1))); $('kjMiniMark').style.left = Math.min(100, m.v * 100) + '%'; const q = Math.min(1, m.t / m.limit), P = r.g.position;
    if (m.move === 'spin') { m.ang += dt * (2 + q * 9); const R0 = r.scale * 0.55 + meScale * 0.4, cy = r.scale * 2.3 * Math.min(1, m.t * 2.5), w = Math.min(1, m.t * 4); if (!m.p0) m.p0 = me.g.position.clone(); me.g.position.set(m.p0.x + (P.x + Math.cos(m.ang) * R0 - m.p0.x) * w, cy, m.p0.z + (P.z + Math.sin(m.ang) * R0 - m.p0.z) * w); me.g.rotation.set(0, Math.PI / 2 - m.ang, 1.35 * Math.min(1, m.t * 2.5)); r.g.rotation.y = Math.atan2(me.g.position.x - P.x, me.g.position.z - P.z); }
    else { const fw = new THREE.Vector3(Math.cos(m.ang), 0, Math.sin(m.ang)), grip = 0.5 * (r.scale + meScale), w = Math.min(1, m.t * 4); if (!m.p0) m.p0 = me.g.position.clone(); me.g.position.set(m.p0.x + (P.x + fw.x * grip * 0.8 - m.p0.x) * w, r.scale * 1.6 * Math.min(1, q * 1.6), m.p0.z + (P.z + fw.z * grip * 0.8 - m.p0.z) * w); if (m.move === 'piledriver') me.g.rotation.z = Math.PI * Math.min(1, q * 1.6); }
    if (m.v >= 1) return endMini('escaped'); if (m.t > m.limit) return endMini('caught'); }
  else if (m.type === 'chokeslam') { if (m.hold) m.v += dt * 0.75; $('kjMiniMark').style.left = Math.min(100, m.v * 100) + '%'; if (m.v > 1) return endMini('rev'); if (m.t > 4.5 && !m.hold) return endMini('rev'); }
  else if (m.type === 'piledriver') { m.v = Math.max(0, m.v - dt * (0.32 + 0.06 * (r.stage - 1))); $('kjMiniMark').style.left = Math.min(100, m.v * 100) + '%'; if (m.v >= 1) return endMini('pin'); if (m.t > 2.8) return endMini('rev'); }
  else if (m.type === 'suplex') { m.tt += dt; const el = $('kjA' + m.i); if (el && el.className !== 'on') el.className = 'on'; $('kjMiniMark').style.left = Math.max(0, 100 - m.tt / m.limit * 100) + '%'; if (m.tt >= m.limit) return endMini('rev'); }
  else if (m.type === 'spear') { m.pos += m.dir * dt * (1.1 + 0.15 * r.stage); if (m.pos > 1) { m.pos = 1; m.dir = -1; } if (m.pos < 0) { m.pos = 0; m.dir = 1; } $('kjMiniMark').style.left = m.pos * 100 + '%'; if (m.t > 5) return endMini('rev'); }
  else if (m.type === 'superkick') { if (!m.flashed && m.t > m.flashAt) { m.flashed = true; m.ft = 0; miniEl.classList.add('kick'); $('kjMiniTitle').textContent = '⚡ NOW! ⚡'; } if (m.flashed) { m.ft += dt; if (m.ft > 0.55) return endMini('rev'); } }
  else if (m.type === 'roar') { if (m.hold) m.v += dt * 0.7; $('kjMiniMark').style.left = Math.min(100, m.v * 100) + '%'; if (m.v > 1) return endMini('choke'); if (m.t > 4.5 && !m.hold) return endMini('roared'); }
}
function knock(g, from, dist) { const dx = g.position.x - from.x, dz = g.position.z - from.z, d = Math.hypot(dx, dz) || 1, ux = dx / d * dist, uz = dz / d * dist; let done = 0;
  anims.push({ wait: 0, t: 0, dur: 0.28, go() {}, f(k) { const q = 1 - Math.pow(1 - k, 2), s = q - done; done = q; g.position.x += ux * s; g.position.z += uz * s; }, end() {} }); }
function endMini(res) { if (me && me.acting === 'grab') me.act(null);
  const m0 = mini, r = mini && mini.r; mini = null; miniEl.className = 'hidden'; $('kjMiniSpots').innerHTML = '';
  if (r && r.spun) { r.spun = false; r.rig.shadow.visible = true; if (res !== 'throw' || r.hp <= 0) { r.g.rotation.x = r.g.rotation.z = 0; r.g.position.y = 0; } }
  if (!r || !rival || r.hp <= 0) return; r.cd = bout ? 0 : 3;
  if (m0 && m0.type === 'escape') { const mv = m0.move; r.rig.act(null); r.stun = 1.5; bout && bout.n++;
    if (res === 'escaped') { me.g.position.y = 0; me.g.rotation.x = me.g.rotation.z = 0; banner('BROKE FREE!'); flourish(me, r, true); hitRival(10 + 4 * stage); knock(r.g, me.g.position, 1.5); sfx.boom(); if (bout) bout.wait = 0.7; return; }
    if (mv === 'spin') { // it lets go: you fly across town
      const a = m0.ang, D = 20 + 3 * r.stage, hx = cols * CELL / 2 - 3, hz = rows * CELL / 2 - 3, from = me.g.position.clone(); const to = new THREE.Vector3(Math.max(-hx, Math.min(hx, from.x - Math.sin(a) * D)), 0, Math.max(-hz, Math.min(hz, from.z + Math.cos(a) * D)));
      meToss = { from, to, t: 0, secs: 1.3, h: 5 + r.scale * 1.5 }; me.g.rotation.y = faceY = Math.atan2(r.g.position.x - to.x, r.g.position.z - to.z); banner('THROWN!'); sfx.throw(); endBout('thrown'); return; }
    me.g.position.y = 0; me.g.rotation.x = me.g.rotation.z = 0; banner(MOVE_NAME[mv] + '!'); const dur = wrestle(mv, 'them', 'me');
    anims.push({ wait: dur * 0.6, t: 0, dur: 0.01, go() { hurt(4 + 1.5 * r.stage, true); }, f() {}, end() {} }); if (bout) bout.wait = dur + 0.15; return; }
  if (bout && (res === 'pin' || res === 'rev')) { const name = MOVE_NAME[m0.type], good = res === 'pin'; bout.n++; r.stun = 2;
    banner(good ? name + '!' : 'REVERSED!'); if (!good) popup(me.g.position.clone().setY(meScale * 2.2), name, '#ff7a5a');
    const dur = wrestle(m0.type, good ? 'me' : 'them', good ? 'them' : 'me');
    anims.push({ wait: dur * 0.6, t: 0, dur: 0.01, go() { if (!rival || rival !== r) return; if (good) { hitRival(16 + 6 * stage); r.rig.act('hit'); } else { hurt(3 + 1.5 * r.stage, true); } }, f() {}, end() {} });
    bout.wait = dur + 0.15; if (good && bout.n >= bout.max) followUp(me, r.g.position.clone(), false); return; }
  if (res === 'win') { flourish(me, r, true); banner('SMACKDOWN!'); hitRival(30 + 10 * stage); knock(r.g, me.g.position, 3); flashT = 0.15; sfx.boom(); }
  else if (res === 'lose') { flourish(r.rig, me, true); banner('OUCH!'); r.rig.act('hit'); hurt(4 + 2 * r.stage, true); knock(me.g, r.g.position, 2.5); sfx.hurt(); }
  else if (res === 'draw') { banner('STALEMATE'); hitRival(8); hurt(2, true); knock(me.g, r.g.position, 1.5); knock(r.g, me.g.position, 1.5); }
  else if (res === 'done') { knock(r.g, me.g.position, 2.5); }
  else if (res === 'throw') { endBout('throw'); banner('GIANT SWING!'); me.act('cast'); sfx.throw(); flashT = 0.1; const a = m0 ? m0.spinA : 0, D = 24 + 3 * stage, hx = cols * CELL / 2 - 3, hz = rows * CELL / 2 - 3;
    const to = new THREE.Vector3(Math.max(-hx, Math.min(hx, r.g.position.x + Math.cos(a) * D)), 0, Math.max(-hz, Math.min(hz, r.g.position.z + Math.sin(a) * D)));
    r.toss = { from: r.g.position.clone(), to, t: 0, secs: 1.6, h: 0 }; r.stun = 3; }
  else if (res === 'freed') { if (bout) bout.wait = 0.6; banner('IT BROKE FREE!'); r.rig.act('hit'); hurt(3 + r.stage, true); knock(me.g, r.g.position, 2); }
  else if (res === 'roarWin') { banner(bout ? '💪 PUMPED UP! +50% POWER THIS FIGHT' : 'TERRIFYING ROAR!'); if (bout) { bout.buff = 1; bout.wait = 1.5; } emote(me, true); emote(r.rig, false); { const near = me.g.position.distanceTo(r.g.position) < (meScale + r.scale) * 1.15; if (near && (me.hammer || me.wrestler)) bootAway(me, r, 0.15); if (me.hammer) throwHammer(me, r.g, near ? 0.75 : 0); } fx.puff('smoke', me.g.position.clone().setY(1), 2); sfx.boom(); r.stun = 2; if (!bout) { hitRival(10 + 4 * stage); knock(r.g, me.g.position, 3); } }
  else if (res === 'roarWeak') { banner(bout ? 'WEAK ROAR... IT\'S PUMPED UP!' : 'WEAK ROAR...'); if (bout) { bout.buff = -1; bout.wait = 1.5; } emote(me, false); emote(r.rig, true); r.stun = 2; }
  else if (res === 'choke') { banner(bout ? 'YOU CHOKED! IT\'S PUMPED UP!' : 'YOU CHOKED!'); if (bout) { bout.buff = -1; bout.wait = 1.5; } emote(me, false); emote(r.rig, true); r.stun = 2; }
  else if (res === 'roared') { banner(bout ? 'IT OUT-ROARED YOU! IT\'S PUMPED UP!' : 'IT OUT-ROARED YOU!'); if (bout) { bout.buff = -1; bout.wait = 1.5; } emote(me, false); emote(r.rig, true); if (r.rig.hammer) throwHammer(r.rig, me.g); r.stun = 2; }
}

// ---------- targets, minimap (as in Tornado Alley) ----------
let poiOrder = [], mapBase = null, mapT = 0; const mapEl = $('taMap'), mapCtx = mapEl.getContext('2d');
// every big target still standing wears a floating badge with its icon and a ring on the ground, so the mission is in the
// world as well as up top: grey until you're big enough for it, then bright, gold-ringed and bobbing
const poiMarks = [];
function addPoiMarks() { for (const g of poiMarks) scene.remove(g); poiMarks.length = 0;
  for (const k of poiOrder) { const P = pois[k], g = new THREE.Group(), r = k === 'fair' ? 4.6 : 2.1; g.position.set(P.center.x, 0, P.center.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.32, 40), new THREE.MeshBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; g.add(ring);
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#1a0f2e'; x.beginPath(); x.arc(64, 64, 55, 0, 6.2832); x.fill(); x.lineWidth = 10; x.strokeStyle = '#ffd24a'; x.stroke(); x.font = '62px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(POI[k].icon, 64, 70);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); badge.renderOrder = 9; g.add(badge);
    g.userData = { ring, badge }; scene.add(g); P.mark = g; poiMarks.push(g); } }
function tickPoiMark(g, ready) { const u = g.userData, view = (cam.top - cam.bottom); // sized against the view, so a badge reads the same however far the camera has pulled back
  u.badge.scale.setScalar(view * (ready ? 0.085 : 0.055)); u.badge.position.y = 4.4 + view * 0.03 + (ready ? Math.sin(played * 3.2) * 0.35 : 0); u.badge.material.color.setHex(ready ? 0xffffff : 0x66707c); u.badge.material.opacity = ready ? 1 : 0.5;
  u.ring.material.color.setHex(ready ? 0xffd24a : 0x9fb4c8); u.ring.material.opacity = ready ? 0.6 + Math.sin(played * 5) * 0.25 : 0.2; }
// tap a target's chip up top: the monster heads for it (if it's big enough yet) and its arrow flashes
function goToPoi(k) { const P = pois[k]; if (state !== 'play' || !P || P.done) return; const ok = stage >= POI[k].stage; banner(ok ? '➤ ' + POI[k].icon + ' ' + POI[k].name : POI[k].icon + ' ' + POI[k].name + ' NEEDS A ' + STAGE[POI[k].stage]); if (ok) moveTo = new THREE.Vector3(P.center.x, 0, P.center.z);
  P.arrow.classList.remove('ping'); void P.arrow.offsetWidth; P.arrow.classList.add('ping'); }
function setupPoiHud() {
  poiOrder = Object.keys(pois).sort((a, b) => POI[a].stage - POI[b].stage || POI[a].pts - POI[b].pts);
  $('taPois').style.setProperty('--n', poiOrder.length); /* the chips share one line: more targets, smaller chips */
  $('taPois').innerHTML = poiOrder.map((k) => '<span class="poiChip" id="poi_' + k + '"><em>' + POI[k].icon + '</em><b>' + 'HTC'[POI[k].stage - 1] + '</b><i></i></span>').join('');
  for (const el of document.querySelectorAll('.poiArrow')) el.remove();
  for (const k of poiOrder) { const a = document.createElement('div'); a.className = 'poiArrow'; a.innerHTML = '<i>➤</i><em>' + POI[k].icon + '</em>'; document.body.appendChild(a); pois[k].arrow = a; pois[k].chip = $('poi_' + k); pois[k].chip.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); goToPoi(k); }); }
  addPoiMarks();
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
  const P = pois[k]; P.done = true; if (P.mark) { scene.remove(P.mark); P.mark = null; } const g = new THREE.Group(); g.position.copy(P.center); scene.add(g);
  for (const hz of P.hz) { live(hz); for (const part of hz.parts || []) if (part.parent) g.attach(part); const i = city.obstacles.findIndex((o) => Math.abs(o.x - hz.pos.x) < 0.3 && Math.abs(o.z - hz.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); }
  twisters.tear(g, P.center, new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()), null, [], [], { collapse: true, now: true, from: me ? me.g.position : null, power: 1.5 }); jolt(1); // it bursts into pieces of itself
  award(POI[k].pts, P.center, POI[k].name); grow(massTarget * 0.04); power = Math.min(1, power + 0.3); sfx.wave(); sfx.boom(); fx.explode(new THREE.Vector3(P.center.x, 1, P.center.z), 2.2); flashT = 0.3; poiFx.play(k, P.center);
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
function sUp(id, x, y) { if (id !== stick.id) return; const tap = stick.moved < 10 && performance.now() - stick.t0 < 300, flick = x != null && performance.now() - stick.t0 < 320 && Math.hypot(x - stick.cx, y - stick.cy) > 30; stick.id = null; stick.x = stick.y = 0; stickEl.style.display = 'none'; if (flick && fightFlick(stick.cx, stick.cy, x, y)) return; if (tap && x != null && state === 'play') tapAt(stick.cx, stick.cy); }
const ZOOM_MIN = 0.6, ZOOM_MAX = 1.6; let zoom = 1, camK = 1, fightFit = 1; // camK: the size step (wider at each stage, widest for mega) try { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +localStorage.getItem('kj_zoom') || 1)); } catch { /* ignore */ }
function setZoom(z) { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); try { localStorage.setItem('kj_zoom', String(zoom)); } catch { /* ignore */ } }
let pinch = 0; const pinchD = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
canvas.addEventListener('touchstart', (e) => { if (e.touches.length >= 2) { sUp(stick.id); pinch = pinchD(e.touches); return; } for (const t of e.changedTouches) sDown('t' + t.identifier, t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchmove', (e) => { if (e.touches.length >= 2 && pinch > 0) { const d = pinchD(e.touches); if (d > 0) setZoom(zoom * pinch / d); pinch = d; if (e.cancelable) e.preventDefault(); return; } for (const t of e.changedTouches) sMove('t' + t.identifier, t.clientX, t.clientY); if (state === 'play' && e.cancelable) e.preventDefault(); }, { passive: false });
addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = 0; });
addEventListener('wheel', (e) => { if (e.target !== canvas || state !== 'play') return; e.preventDefault(); setZoom(zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false }); // only over the game, never over menus (the skin list scrolls)
for (const [id, k] of [['taZoomIn', 0.85], ['taZoomOut', 1.18]]) $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); setZoom(zoom * k); });
const tUp = (e) => { for (const t of e.changedTouches) sUp('t' + t.identifier, t.clientX, t.clientY); }; addEventListener('touchend', tUp); addEventListener('touchcancel', tUp);
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') sDown(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') sMove(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') sUp(e.pointerId, e.clientX, e.clientY); });
addEventListener('keydown', (e) => { if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault(); if (mini && state === 'play' && miniKey(e, true)) return; keys[e.key.toLowerCase()] = true; if (gm && e.key === ' ' && !e.repeat) { gmTap(); return; } if (e.key === 'Escape' || e.key === 'p') togglePause(); else if (state === 'play' && !e.repeat && e.key.toLowerCase() === 'f') playerHeavy(); else if (state === 'play' && !e.repeat && e.key === 'Shift') playerDodge(); else if (e.key === ' ' && !e.repeat) castKey(); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; if (mini && state === 'play') miniKey(e, false); });

// ---------- flow ----------
let state = 'start', died = false, roundId = 0; // roundId: delayed effects from an earlier round check it and stand down
soundToggle($('taStart'), $('taPaused')); skipSongBtn($('ta')); eraPicker($('taLevels'), () => { level = unlockedLevel(); drawLevels(); }); seasonPicker($('eraRow')); // sound on/off on the start and pause screens
// the soundtrack starts on the first tap and keeps rotating songs for as long as you're on Kaiju Madness
gameMusic($('taPaused'), SONGS_KAIJU); radioButton($('taPaused'), $('taPaused').querySelector('.menuBtn'));
const fsMode = initFullscreen(() => state === 'play' || state === 'outro'); // full screen on play, back in after a browser drop-out, no page scrolling mid-round
function start() {
  fsMode.play();
  megaT = 0; megaUsed = false; megaDropT = 25 + Math.random() * 15; if (megaDrop) scene.remove(megaDrop.g); megaDrop = null; megaArrow.style.display = 'none'; megaEl.className = 'hidden'; megaBtn.classList.add('hidden'); for (const b of blasts) b.remove(); blasts.length = 0; camK = 1; roundId++;
  clearAnims();
  coachClear(); saveLast('kj', level); crowd.clear(); mvx = mvz = 0; shake = hitStop = slowMo = 0; fightFit = 1; if (gm) endGMove(); if (aimS) endAim(false); combo = 0; counterT = 0;
  unlockAudio(); buildWorld(); makeMe(); trip = 0; tripAt.copy(me.g.position); spells.clear(); score = 0; totalD = 0; camHold = false; bike = null; bout = null; meToss = null; finishing = false; grabbed = false; rangedBusy = false; rangedCd = 0; rangedBtn.classList.add('hidden'); clearDots(); fightEdge.classList.add('hidden'); finishBtn.classList.add('hidden'); /* a new round: the camera follows again after a ride-off; no fight carries over */ chain = 0; lastHit = -9; tLeft = L().time; played = 0; peopleN = carsN = bDone = 0; ko = 0; died = false; moveTo = null; slowT = 0; boostT = 0;
  for (const pl of planes) { scene.remove(pl.g); pl.arrow.remove(); } planes = []; planeT = 50 + Math.random() * 10; noPlanes = false; for (const b of bombs) scene.remove(b.m); bombs.length = 0; for (const f of fires) scene.remove(f.ring); fires.length = 0;
  if (rival) scene.remove(rival.g); rival = null; mini = null; lastMini = ''; miniEl.className = 'hidden'; rivalQueue = []; rivalWait = 0; queueRivals(1); sinking.length = 0; gulps.length = 0;
  setupPoiHud(); for (const s of ['taStart', 'taEnd', 'taPaused', 'taPrize', 'kjPickScr']) $(s).classList.add('hidden'); $('ta').classList.remove('hidden');
  state = 'play'; playSongs(); setStormLevel(1); sfx.whoosh(); banner(KAIJU[me.id].name + ' VS ' + L().name.toUpperCase()); setTimeout(() => { if (state === 'play') banner('TAKE OUT ' + (L().need >= poiOrder.length ? 'ALL ' + poiOrder.length : L().need) + ' TARGETS'); }, 2600);
  renderer.compile(scene, cam); $('taLevel').textContent = 'L' + level + ' · ' + L().name; measureHud(); for (const k in hudCache) delete hudCache[k];
}
// a new look from the pause menu: the same monster, size and place
function swapMe() { if (!me) return; const old = me, nu = buildKaiju(pick, getEquipped()['kj_' + pick] || false); nu.g.position.copy(old.g.position); nu.g.rotation.copy(old.g.rotation); nu.g.scale.copy(old.g.scale); scene.remove(old.g); scene.add(nu.g); me = nu; }
const drawPauseSkins = () => pauseSkinRow($('taPaused'), '👹', 'kj_' + pick, Object.keys(KAIJU_SKINS[pick]).map((lk) => ['kaiju:' + pick + ':' + lk, KAIJU_SKINS[pick][lk].short || KAIJU_SKINS[pick][lk].name.split(' ')[0]]), swapMe);
function togglePause() { if (state === 'play') { state = 'paused'; drawPauseSkins(); setPlaneEngine(0); stopMusic(); $('taPaused').classList.remove('hidden'); } else if (state === 'paused') { state = 'play'; $('taPaused').classList.add('hidden'); playSongs(); setStormLevel(stage * 2 - 1); } }
function die() { if (died) return; died = true; me.act('ko'); banner('KAIJU DOWN!'); sfx.over(); setTimeout(finishNow, 1800); state = 'dying'; }
// time's up: the monster burrows back into the ground (flyers take off into the sky) and the city goes quiet, then the
// prizes and the score
let outroT = 0, camHold = false, bike = null;
function finish() { if (state !== 'play') return; foes.clear(); state = 'outro'; outroT = 0; camHold = false; bike = null; bout = null; meToss = null; finishing = false; rangedBtn.classList.add('hidden'); finishBtn.classList.add('hidden'); megaBtn.classList.add('hidden'); mini = null; miniEl.className = 'hidden'; stopMusic(); setPlaneEngine(0); sUp(stick.id); clearTips(); moveTo = null; megaT = 0; megaEl.className = 'hidden';
  banner(totalD ? 'THE TOWN WAS DESTROYED' : 'THE MADNESS HAS ENDED!'); me.act('cast'); sfx.boom(); setTimeout(() => sfx.whoosh(), 500); setTimeout(() => sfx.boom(), 1300); }
// Mike leaves town on his chopper: it bursts up out of the street (0-0.9 s), he hops on (0.9-1.5), revs, and guns it
function rideOff(dt) { const g = me.g, T = outroT, s = g.scale.x;
  if (!bike) { bike = buildChopper(me.hammer ? undefined : me.def.pal[0]); bike.g.position.set(1.2, -1.6, 0.22); g.add(bike.g); bike.v = 0; sfx.boom(); }
  const fwd = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)), at = (x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
  if (T < 0.9) { const q = T / 0.9; bike.g.position.y = -1.6 * Math.pow(1 - q, 3); bike.g.rotation.z = Math.sin(q * 14) * 0.08 * (1 - q); me.anim(dt, 0);
    if (Math.random() < dt * 40) fx.puff('smoke', at(1.2 + (Math.random() - 0.5) * 1.6, 0.2, 0.2 + (Math.random() - 0.5) * 2.4), 0.5 + s * 0.25); if (T % 0.3 < dt) { flashT = Math.max(flashT, 0.05); sfx.hit(); } }
  else if (T < 1.5) { if (me.acting !== 'ride') me.act('ride'); const q = (T - 0.9) / 0.6; bike.g.position.set(1.2 * (1 - q * q), 0, 0.22); bike.g.rotation.z = 0; me.body.position.y = Math.sin(q * Math.PI) * 0.7 - 0.27 * q; me.anim(dt, 0); }
  else { camHold = true; me.body.position.y = -0.27; if (T < 1.85) { bike.g.rotation.z = Math.sin(T * 70) * 0.02; if (T % 0.12 < dt) fx.puff('smoke', at(bike.pipe.x, bike.pipe.y, bike.pipe.z), 0.3 * s); if (T % 0.25 < dt) sfx.whoosh(); }
    else { bike.v = Math.min(bike.v + dt * 34, 46); g.position.addScaledVector(fwd, bike.v * dt * s * 0.25); const wl = Math.max(0, 1 - (T - 1.85) / 0.6); g.rotation.x = -0.32 * Math.sin(Math.min(1, (T - 1.85) / 0.6) * Math.PI); me.body.position.y = -0.27;
      bike.front.rotation.x += bike.v * dt * 0.8; bike.rear.rotation.x += bike.v * dt * 0.8; if (Math.random() < dt * 30) fx.puff('smoke', at(bike.pipe.x, bike.pipe.y, bike.pipe.z), (0.25 + wl * 0.3) * s); }
    me.anim(dt, 0); }
  if (T >= 3.7) { g.visible = false; g.rotation.x = 0; finishNow(); } }
// a caped wrestler's exit: fireworks pop all round while it poses, then it flies off forward, fists out front
function pyroOff(dt) { const g = me.g, T = outroT, s = g.scale.x, at = (x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
  if (T < 1.4) { if (me.acting !== 'win') me.act('win'); if (T % 0.2 < dt) { const a = Math.random() * 6.28; fx.explode(at(Math.cos(a) * 1.4, 0.2, Math.sin(a) * 1.4), 0.4 + s * 0.15); sfx.hit(); flashT = Math.max(flashT, 0.05); } me.anim(dt, 0); }
  else { camHold = true; if (me.acting !== 'fly') { me.act('fly'); const vd = cam.getWorldDirection(new THREE.Vector3()); g.rotation.y = Math.atan2(vd.x, vd.z); } /* faces away from the camera, so it flies off into the distance */ const q = T - 1.4, fwd = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)); g.position.addScaledVector(fwd, dt * s * 6); g.position.y += dt * s * (3 + q * 8); if (Math.random() < dt * 30) fx.puff('smoke', g.position.clone(), 0.4 * s); me.anim(dt, 0); }
  if (T >= 3.2) { g.visible = false; finishNow(); } }
function outroTick(dt) { if (me.wrestler && me.def.opt && me.def.opt.exit === 'pyro') { outroT += dt; return pyroOff(dt); } if ((me.hammer || me.wrestler) && !me.fly) { outroT += dt; return rideOff(dt); } outroT += dt; const g = me.g, k = Math.min(1, outroT / 2.6);
  if (me.fly) { if (!me.flyOff) { me.flyOff = true; camHold = true; const vd = cam.getWorldDirection(new THREE.Vector3()); g.rotation.y = Math.atan2(vd.x, vd.z); } /* turns away from the camera and flies off into the distance */ g.position.addScaledVector(new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)), dt * meScale * (2 + outroT * 3)); g.position.y += dt * (2 + outroT * 9); me.anim(dt, 1); if (Math.random() < dt * 12) fx.puff('smoke', g.position.clone().setY(0.3), 0.5 + meScale * 0.2); }
  else { g.position.y = -k * k * meScale * 2.4; me.anim(dt, 0.6); if (outroT % 0.45 < dt) me.act('hit');
    if (Math.random() < dt * 30 * (1 - k * 0.5)) { const a = Math.random() * 6.28, r = meScale * (0.4 + Math.random() * 0.6); fx.puff('smoke', new THREE.Vector3(g.position.x + Math.cos(a) * r, 0.2, g.position.z + Math.sin(a) * r), 0.6 + meScale * 0.25); }
    if (outroT % 0.6 < dt) { flashT = Math.max(flashT, 0.06); sfx.hit(); } }
  if (outroT >= 3.1) { g.visible = false; finishNow(); } }
// TOTAL DESTRUCTION: every building and every big target gone before the clock runs out. Points for every second left,
// an extra prize go, and a free skin at the end
let totalD = 0;
function totalWipe(at) { totalD = 5000 + Math.round(tLeft) * 250; score += totalD; banner('THE TOWN WAS DESTROYED'); popup(at.clone().setY(4), '+' + totalD + ' TIME BONUS', '#ffd24a'); sfx.boom(); setTimeout(() => sfx.boom(), 300); flashT = 0.5; }
function finishNow() {
  state = 'over'; mini = null; miniEl.className = 'hidden'; stopMusic(); setPlaneEngine(0); sUp(stick.id); clearTips(); const done = poiOrder.filter((k) => pois[k].done); for (const k of poiOrder) if (pois[k].arrow) pois[k].arrow.style.display = 'none'; rivalEl.classList.add('hidden'); rivalArrow.style.display = 'none'; for (const pl of planes) pl.arrow.style.display = 'none';
  let best = 0; const bk = bestKey('kj', level); try { best = +localStorage.getItem(bk) || 0; if (score > best) { best = score; localStorage.setItem(bk, String(score)); } } catch { /* ignore */ }
  const pct = Math.round((bDone / totalB) * 100); const need = Math.min(L().need, poiOrder.length); const cleared = !died && pct >= L().goal && done.length >= need;
  const scoreCoins = Math.floor(score / 10000) / 100; if (scoreCoins > 0) addCoins(scoreCoins);
  if (cleared && level < LEVELS.length && unlockedLevel() <= level) { try { localStorage.setItem(levelKey('kj'), String(level + 1)); } catch { /* ignore */ } }
  $('taEndTitle').innerHTML = died ? 'KAIJU<br>DOWN' : cleared ? (level >= 5 ? L().name.toUpperCase().replace('THE ', '') + '<br>CRUSHED' : 'LEVEL ' + level + '<br>CRUSHED') : "TIME'S<br>UP";
  $('taAgain').textContent = cleared && level < LEVELS.length ? 'NEXT LEVEL' : cleared ? 'PLAY AGAIN' : 'TRY AGAIN'; $('taAgain').dataset.next = cleared && level < LEVELS.length ? '1' : '';
  $('taGoalLine').textContent = died ? 'The army got you. Eat more people to grow back, and walk out of the napalm.' : cleared ? (level < LEVELS.length ? 'Level ' + (level + 1) + ' unlocked: ' + LEVELS[level].name + '.' : 'Every town crushed. Monster.') : 'Flatten ' + L().goal + '% of ' + L().name + ' and take out ' + (need >= poiOrder.length ? 'every big target' : need + ' big targets') + ' (you got ' + pct + '% and ' + done.length + ').';
  if (totalD) { $('taEndTitle').innerHTML = 'THE TOWN WAS<br>DESTROYED'; totalReward(unlockedKaiju().flatMap((k) => Object.keys(KAIJU_SKINS[k]).map((lk) => 'kaiju:' + k + ':' + lk)), (id) => { const [, k, lk] = id.split(':'); return KAIJU_SKINS[k][lk].name; }, $('taGoalLine')); }
  if (cleared && level < LEVELS.length) level++; saveLast('kj', level); /* the next town is open and picked right away, wherever you go from here (change monster, the shop, NEXT LEVEL) */
  drawLevels(); /* and the start screen shows the new best score without a reload */
  $('taStats').innerHTML = [...(totalD ? [['💥 Total destruction', '+' + totalD]] : []), ['Buildings', bDone + ' / ' + totalB + ' (' + pct + '%)'], ['People eaten', peopleN], ['Cars wrecked', carsN], ['Rivals KO\'d', ko], ['Big targets', done.length + ' / ' + poiOrder.length + ' ' + done.map((k) => POI[k].icon).join('')], ['Biggest', STAGE[topStage]], ['Score', score], ['Score coins', '+' + scoreCoins + ' 🪙'], ['Best', best]].map(([a, b]) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>').join('');
  const goes = Math.min(3, 1 + (cleared ? 1 : 0) + Math.floor(done.length / 2)) + (totalD ? 1 : 0); kaijuRound(goes); showPrizes($('taChests'), goes, '1 go, +1 for clearing the level, +1 for every 2 big targets destroyed (max 3)', () => { location.href = 'store.html?from=kaiju'; }, kaijuPrize, () => { $('taPrize').classList.add('hidden'); $('taEnd').classList.remove('hidden'); });
  $('ta').classList.add('hidden'); $('taPrize').classList.remove('hidden'); drawPicker(); // the prize game first, then the score
}
const HOWTO = [
  ['🦖', 'You are the monster', 'Tap a spot to walk there. Your kaiju eats people and smashes whatever is closest all by itself.'],
  ['🍖', 'Eat to grow', 'Every person you eat makes you bigger: Hatchling, then Titan, then Colossus. Bigger kaiju flatten taller buildings.'],
  ['⚡', 'Spells', 'Your Power bar fills over time. When it is full, tap an enemy, a tank or a spot to cast your spell (on a computer, press SPACE). Every size has a different spell.'],
  ['❤️', 'Size is health', 'The army, napalm and rivals shrink you. Drop below a size and you go back down. Shrink away as a Hatchling and it is over.'],
  ['✈️', 'Napalm planes', 'Planes drop fire on you. Walk out of the flames, or blast them with a spell. A Colossus swats them.'],
  ['👹', 'Rival kaiju', 'Two rivals come for you at each size. Up close, tap to punch (keep tapping for a combo) and flick to send it flying, through buildings for extra damage. A red ring means it is about to hit: flick to dodge, and dodge late for a slow-motion counter. KO one and eat it for a big boost.'],
  ['🤼', 'Finish it', 'Daze a rival and pick SPIN & TOSS or WRESTLE IT. Wrestling moves follow your finger: lift and slam, swing it over, pull back and charge. Out of reach? AIM & THROW (or BLAST): drag to aim, let go, then tap as you land.'],
  ['🛸', 'More enemies', 'From Downtown on, storm cannons blast you along an orange line; from Metro, gunships fire freeze rockets; in Megacity a UFO burns you with its ray. Smash them or blast them.'],
  ['👹', 'Win new kaiju', 'Most rounds the prize games hand you a new kaiju or robot (sometimes two). Win one you already have and you get a whole coin.'],
  ['🎯', 'Big targets', 'The big targets are the mission. Each one wears a badge in town, with an arrow to it at the edge of the screen: dim while you are too small for it, bright gold once you are big enough. Follow the arrow, or tap its icon up top to head there.'],
  ['🏆', 'Crush the town', 'Flatten the goal % and take out enough big targets before time runs out to unlock the next town.'],
];
$('taHow').addEventListener('click', () => showHowTo(HOWTO));
// building a town takes a moment: put the loading screen up first, then do the work once it has been drawn
function loadThen(fn) { if (window.__bootTip) window.__bootTip(); document.body.classList.add('booting'); requestAnimationFrame(() => requestAnimationFrame(() => { try { fn(); } finally { document.body.classList.remove('booting'); } })); }
const playNow = () => { fsMode.play(); unlockAudio(); loadThen(start); }; // full screen and sound have to be asked for in the tap itself
$('taPlay').addEventListener('click', playNow); // straight in: the cards are there if you ask (HOW TO PLAY), and the round itself shows a new player each thing as it comes up
$('taAgain').addEventListener('click', playNow);
$('taEndPick').addEventListener('click', openPicker);
function drawLevels() { const box = $('taLevels'); box.innerHTML = ''; const un = unlockedLevel(); LEVELS.forEach((lv, i) => { const b = document.createElement('button'); const n = i + 1; let best = 0; try { best = +localStorage.getItem(bestKey('kj', n)) || 0; } catch { /* ignore */ }
  b.className = 'lvl' + (n === level ? ' on' : ''); b.disabled = n > un; b.innerHTML = '<b>' + (n > un ? '🔒' : n) + '</b><span>' + lv.name.replace('Small Town', 'Town').replace('The Sprawl', 'Sprawl') + '</span>' + (best ? '<i>' + best + '</i>' : ''); b.addEventListener('click', () => { level = n; drawLevels(); }); box.appendChild(b); }); }
// ---------- the monster picker: the start screen shows your monster; CHOOSE MONSTER opens a scrolling screen with a
// picture of every one (locked ones are dark silhouettes). Pictures are rendered once each, a few per frame ----------
// the monsters on the menu are live: each card shows its monster walking on the spot and turning (livePreview.js)
const kjPV = createPreviews({ perFrame: 4, cam: [2.1, 1.8, 4.3], look: [0, 1.15, 0], fov: 30 }), kjLive = new Map();
function thumb(id, cv, slot = 'card') { const skin = getEquipped()['kj_' + id] || false, key = slot + ':' + id + '+' + skin; // one monster per card, built when the card is first seen, then kept
  kjPV.add(cv, () => { let e = kjLive.get(key); if (e) return e; const rig = buildKaiju(id, skin); rig.anim(0.4, 0); const g = rig.g, bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()), k = 2.5 / Math.max(sz.x, sz.y, sz.z); g.scale.setScalar(k); bb.setFromObject(g); g.position.y -= bb.min.y; g.position.x -= (bb.min.x + bb.max.x) / 2; g.position.z -= (bb.min.z + bb.max.z) / 2;
    e = new THREE.Group(); e.add(g); e.userData.rig = rig; kjLive.set(key, e); return e; }, (dt, t, e) => { e.userData.rig.anim(dt, 0.5); e.rotation.y = -0.5 + Math.sin(t * 0.5) * 0.6; }); }
function drawPicker() { const un = unlockedKaiju(), K = KAIJU[pick];
  $('kjChosenName').textContent = K.name; $('kjChosenSpells').textContent = K.spells.join(' → '); kjPV.clear(); thumb(pick, $('kjChosenCv'), 'chosen');
  $('kjPickInfo').innerHTML = un.length + ' of ' + KAIJU_IDS.length + ' unlocked. Win more in the prize games after each round.';
  if ($('kjPickScr').classList.contains('hidden')) return;
  const box = $('kjPick'); box.innerHTML = '';
  for (const id of [...KAIJU_IDS.filter((x) => un.includes(x)), ...KAIJU_IDS.filter((x) => !un.includes(x))]) { const KK = KAIJU[id], open = un.includes(id); /* yours first */ const b = document.createElement('button'); b.className = 'kjCard' + (id === pick ? ' on' : '') + (open ? '' : ' locked');
    b.innerHTML = '<canvas width="150" height="150"></canvas><b>' + KK.name + '</b>'; thumb(id, b.querySelector('canvas'));
    b.addEventListener('click', () => { if (!open) { $('kjPickInfo').textContent = KK.name + ' is locked. Win monsters in the prize games after each round.'; for (const c of box.children) c.classList.remove('want'); b.classList.add('want'); return; } /* a locked monster still shows, moving, in full colour */ pick = id; try { localStorage.setItem('kj_pick', id); } catch { /* ignore */ } for (const o of box.children) o.classList.remove('on'); b.classList.add('on'); drawPicker(); showcase(); }); box.appendChild(b); } }
function openPicker() { $('taStart').classList.add('hidden'); $('taEnd').classList.add('hidden'); state = 'start'; $('kjPickScr').classList.remove('hidden'); $('kjPickScr').scrollTop = 0; drawPicker(); }
$('kjChoose').addEventListener('click', openPicker);
$('kjPickDone').addEventListener('click', () => { $('kjPickScr').classList.add('hidden'); $('taStart').classList.remove('hidden'); drawPicker(); drawLevels(); });
level = unlockedLevel(); drawLevels(); drawPicker();
$('taPause').addEventListener('click', togglePause); $('taResume').addEventListener('click', togglePause);
// restart the level from the pause screen; the first tap asks, a second tap within 3 seconds does it
{ const rb = $('taRestart'); let armT = 0; const reset = () => { armT = 0; rb.textContent = '↺ RESTART LEVEL'; rb.classList.remove('armed'); };
  rb.addEventListener('click', () => { if (!armT || performance.now() - armT > 3000) { armT = performance.now(); rb.textContent = '↺ SURE? TAP AGAIN TO RESTART'; rb.classList.add('armed'); setTimeout(() => { if (armT && performance.now() - armT >= 2900) reset(); }, 3000); return; }
    reset(); $('taPaused').classList.add('hidden'); playNow(); }); }

// ---------- update ----------
const right = new THREE.Vector3(), upv = new THREE.Vector3(), tmp = new THREE.Vector3(); let frameN = 0;
// ---------- first-time coaching: one new thing at a time. The round holds still while a card and an arrow show it (see
// coach.js); it carries on when the player does it, and each one only ever shows once on this device ----------
let trip = 0; const tripAt = new THREE.Vector3(); // how far the monster has walked since the last prompt
const toScreen = (p, y = 0) => { const v = new THREE.Vector3(p.x, y, p.z).project(cam); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, on: Math.abs(v.x) < 0.86 && v.y > -0.8 && v.y < 0.62 }; };
const elMid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
function coachKJ() {
  trip += me.g.position.distanceTo(tripAt); tripAt.copy(me.g.position); if (coachBusy() || mini || finishing || grabbed || meToss || leap) return; // never in the middle of a move
  if (foes.coachTick()) return;
  if (!coachSeen('kj_move')) { if (played > 0.5) coach('kj_move', { mode: 'drag', title: 'MOVE', text: 'Hold and drag anywhere on the screen to walk your monster.', done() { trip = 0; } }); return; }
  // a rival: each part of the fight is shown as it happens
  if (rival && rival.hp > 0 && !rival.koT && !rival.toss && !mini) { const r = rival, rAt = () => toScreen(r.g.position, r.scale);
    if (!finishBtn.classList.contains('hidden')) { if (coach('kj_finish', { mode: 'tap', title: '💫 IT IS DAZED!', text: 'Finish it: spin it round and toss it across town, or WRESTLE IT: a move you do with your finger.', at: () => elMid(finishBtn) })) return; }
    else if (rival.atk && !coachSeen('kj_dodge')) { if (coach('kj_dodge', { title: '💨 DODGE!', text: 'A red ring means it is about to hit you. Flick your finger to dodge (SHIFT on a computer). Dodge at the last moment and time slows: hit it then for a COUNTER.', at: rAt })) return; }
    else if (nearRival()) { if (coach('kj_fight2', { mode: 'tap', title: '👊 FIGHT!', text: 'Tap to punch: keep tapping for a combo. Flick your finger for a haymaker (F on a computer) that sends it flying the way you flicked, through buildings for extra damage.', at: rAt })) return; }
    else if (!rangedBtn.classList.contains('hidden')) { if (coach('kj_ranged', { mode: 'tap', title: 'HIT IT FROM HERE', text: 'The rival is out of reach. Press this to blast it from range and charge in.', at: () => elMid(rangedBtn) })) return; }
    else if (coachIdle() > 1 && coach('kj_rival', { title: '👹 RIVAL KAIJU', text: 'Another monster is coming for you. Knock it out and you eat it for a big boost.', at: rAt })) return; }
  // whatever turns up on its own is shown the moment it's on screen
  if (!coachSeen('kj_plane')) { const pl = planes.find((p) => p.life > 0 && toScreen(p.g.position, p.g.position.y).on); if (pl && coach('kj_plane', { title: '✈ NAPALM PLANE', text: 'It drops fire that burns and shrinks your monster. Walk out of the flames, or blast the plane with your power.', at: () => toScreen(pl.g.position, pl.g.position.y) })) return; }
  if (megaDrop && !coachSeen('kj_mega') && toScreen(megaDrop.g.position).on) { const D = megaDrop; if (coach('kj_mega', { title: '⚡ MEGA BOOSTER', text: 'Walk into it to go MEGA for a while: huge, nothing can hurt you, and you get one mega blast to fire when you like.', at: () => toScreen(D.g.position, 1) })) return; }
  if (coachIdle() < 2) return;
  if (!coachSeen('kj_tap')) { if (trip > 5) coach('kj_tap', { mode: 'tap', finger: true, title: 'TAP TO WALK', text: 'Tap any spot and your monster walks there.', at: () => ({ x: innerWidth * 0.72, y: innerHeight * 0.45 }) }); return; }
  if (!coachSeen('kj_eat')) { let best = null, bd = 1e9; for (const c of people) { const d = c.position.distanceTo(me.g.position); if (d < bd && d > 1 && toScreen(c.position).on) { bd = d; best = c; } }
    if (best) coach('kj_eat', { title: '🍖 EAT TO GROW', text: 'Walk into people to eat them: every one makes your monster bigger. It smashes cars and buildings in reach on its own.', at: () => toScreen(best.position, 0.3) }); return; }
  if (power >= 1 && !megaT && coach('kj_power', { mode: 'tap', title: '⚡ POWER FULL', text: 'Tap an enemy or any spot to fire ' + KAIJU[me.id].spells[stage - 1] + '.', at: () => elMid($('kjPower')) })) return;
  if (!coachSeen('kj_goal')) { if (coachIdle() > 4) coach('kj_goal', { title: '🎯 YOUR MISSION', text: 'Destroy the big targets to clear the town. Each tag shows the size you need. Tap a target up here to head for it.', at: () => elMid($('taPois')) }); return; }
  if (!coachSeen('kj_target')) { const k = poiOrder.find((p) => !pois[p].done && stage >= POI[p].stage); if (k) coach('kj_target', { title: POI[k].icon + ' ' + POI[k].name + ' IS READY', text: 'Your monster is big enough for this target now. Follow its gold arrow and smash it.', at: () => toScreen(pois[k].center) }); }
}
const hudCache = {}; const setT = (id, v) => { v = String(v); if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
function update(dt) {
  played += dt; if (!(totalD && rival)) tLeft -= dt; /* town destroyed: the clock waits for a fight to finish */ if (tLeft <= 0) { tLeft = 0; finish(); return; }
  coachKJ();
  const g = me.g, K = KAIJU[me.id];
  // size = health: the bar, the stage, the scale
  meF = mass / massTarget; const st = stageOf(meF);
  if (st !== stage) { if (st > stage) { banner(STAGE[st] + '!'); { const b = $('taRank'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } stormBoost(3); boostT = 3; sfx.whoosh(); if (st > topStage) { topStage = st; queueRivals(st); } } else { banner('SHRANK TO ' + STAGE[st] + '!'); sfx.hurt(); } stage = st; }
  meScale += ((megaT > 0 ? scaleOf(1) * 1.5 : scaleOf(meF)) - meScale) * Math.min(1, dt * 2); g.scale.setScalar(meScale);
  updateMega(dt);
  power = Math.min(1, power + dt / CHARGE);
  // moving: a tap target, the stick or the keys; slowed when hit, faster after growing
  let sx = stick.x + ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0), sy = stick.y + ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0);
  cam.updateMatrixWorld(); right.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize(); upv.setFromMatrixColumn(cam.matrixWorld, 1).setY(0).normalize();
  slowT -= dt; boostT -= dt; const speed = (4.0 + meScale * 0.45) * K.speed * (slowT > 0 ? 0.6 : 1) * (boostT > 0 ? 1.4 : 1) * foes.slow;
  const mag = Math.min(1, Math.hypot(sx, sy)); let moving = 0;
  updateAnims(dt);
  if (meToss) { const T = meToss; T.t += dt; const k = Math.min(1, T.t / T.secs), q = 1 - Math.pow(1 - k, 2); g.position.lerpVectors(T.from, T.to, q); g.position.y = T.from.y * Math.max(0, 1 - k * 4) + Math.sin(Math.min(1, k / 0.25) * Math.PI) * meScale * 0.5; g.rotation.x = -Math.PI / 2; g.rotation.z += dt * 9 * (1 - k); plough(g.position, meScale * 0.75, T.pl || (T.pl = { set: new Set(rival ? [rival] : []) })); moveTo = null; if (Math.random() < dt * 25) fx.puff('smoke', g.position.clone(), 0.5);
    if (k >= 1) { meToss = null; g.position.y = 0; g.rotation.x = -Math.PI / 2; g.rotation.z = 0; flashRig(me); jolt(0.7); getUp(g); const land = g.position.clone(); hitArea(land, 3.6, 14, {}); fx.explode(land.clone().setY(0.5), 2.4); flashT = 0.3; sfx.boom(); popup(land.clone().setY(meScale * 2), 'CRASH!', '#ff5a5a'); hurt(6 + 2 * (rival ? rival.stage : 1), true); if (rival) followUp(rival.rig, land, true); } }
  else if (mini) { updateMini(dt); moveTo = null; }
  else if (bout) { moving = boutTick(dt) || 0; moveTo = null; }
  else if (grabbed) { moveTo = null; } // locked in the fight: no walking away
  else if (leap) { leap.t += dt; const k = Math.min(1, leap.t / leap.secs); g.position.lerpVectors(leap.from, leap.to, k); g.position.y = Math.sin(k * Math.PI) * leap.h; if (leap.step) { leap.stepT -= dt; if (leap.stepT <= 0) { leap.stepT = 0.08; leap.step(g.position.clone().setY(0)); } } if (leap.hide && Math.random() < dt * 30) fx.puff('smoke', g.position.clone().setY(0.3), 0.8); if (leap.tick) leap.tick(k); if (k >= 1) { g.position.y = 0; me.body.visible = true; shove(me, 0, 0, 0, 0, 0.25, 0.3); const f = leap.onLand; leap = null; f(); } }
  else if (mag > 0.05) { moveTo = null; tmp.copy(right).multiplyScalar(sx).addScaledVector(upv, -sy).normalize(); wantX = tmp.x * speed * mag; wantZ = tmp.z * speed * mag; faceY = Math.atan2(tmp.x, tmp.z); freeMove = true; }
  else if (moveTo) { const dx = moveTo.x - g.position.x, dz = moveTo.z - g.position.z, dl = Math.hypot(dx, dz); if (dl < 0.4) moveTo = null; else { const sp = speed * Math.min(1, 0.35 + dl / 1.2); wantX = dx / dl * sp; wantZ = dz / dl * sp; faceY = Math.atan2(dx, dz); } freeMove = true; }
  else freeMove = true;
  // its velocity chases where it's being steered: a hatchling is nippy, a colossus takes a moment to get going and to stop
  if (freeMove) { const acc = Math.min(1, dt * (me.fly ? 8 : 11 / (0.7 + meScale * 0.35))); mvx += (wantX - mvx) * acc; mvz += (wantZ - mvz) * acc; g.position.x += mvx * dt; g.position.z += mvz * dt; moving = Math.min(1, Math.hypot(mvx, mvz) / Math.max(0.01, speed)); if (moving < 0.04) moving = 0; } else mvx = mvz = 0;
  wantX = wantZ = 0; freeMove = false;
  const lim = toWorld(cols - 1, rows - 1, cols, rows); g.position.x = Math.max(-lim.x, Math.min(lim.x, g.position.x)); g.position.z = Math.max(-lim.z, Math.min(lim.z, g.position.z));
  { let dr = faceY - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 6); }
  me.anim(dt, moving); updateDots(dt); updateRanged(dt);
  if (moving > 0.15 && !leap) { stepT -= dt; if (stepT <= 0) { stepT = me.fly ? 0.38 : 0.4; if (me.fly) sfx.flap(); else { sfx.stomp(meScale); stepSide = -stepSide; const fc = Math.cos(g.rotation.y), fs2 = Math.sin(g.rotation.y); for (let i = 0; i < (stage >= 2 ? 2 : 1); i++) fx.dust({ x: g.position.x + fc * stepSide * meScale * 0.28, y: 0, z: g.position.z - fs2 * stepSide * meScale * 0.28 }, 0.3 + meScale * 0.28); if (stage >= 2) jolt(stage >= 3 ? 0.2 : 0.09); } } } else stepT = 0.15;
  if (power >= 1 && !powerFull) { powerFull = true; sfx.power(); } else if (power < 1) powerFull = false;
  const px = g.position.x, pz = g.position.z, R = reach();
  // stomping: buildings it walks into come down (if it's big enough)
  tooBigT -= dt;
  for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - px, x.pos.z - pz); if (d > R + 1.0) continue;
    if (x.h <= (megaT > 0 ? 99 : MAX_H[stage])) { crumble(x, undefined, false, me.g.position, meScale * 1.5 > x.h * 1.6); if (Math.random() < 0.4) smashAct(); } else if (tooBigT <= 0) { tooBigT = 2; popup(x.pos, 'TOO BIG - EAT MORE!', '#ff7a5a'); } }
  for (const k of poiOrder) { const P = pois[k]; if (P.done || !P.hz.length) continue; if (Math.hypot(P.center.x - px, P.center.z - pz) > R + P.reach) continue;
    if ((megaT > 0 ? 3 : stage) >= POI[k].stage) { smashAct(); wreckPoi(k); } else if (tooBigT <= 0) { tooBigT = 2; popup(P.center, 'NEED ' + STAGE[POI[k].stage] + '!', '#ff7a5a'); } }
  // people: they run, and the ones it reaches get eaten
  frameN++;
  for (let i = people.length - 1; i >= 0; i--) { const c = people[i], u = c.userData; u.panic = false; const dx = c.position.x - px, dz = c.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
    if (u.frz && d <= 34) { u.frz = false; delete c.updateMatrixWorld; }
    if (d < R + 1.2) { if (u.frz) { u.frz = false; delete c.updateMatrixWorld; } eat(c, i); if (Math.random() < 0.5) smashAct(); continue; }
    if (d < 8 + meScale * 1.5) { const sp = 1.6 * dt; u.panic = true; if (Math.random() < dt * 0.05) popup(c.position, SHOUTS[(Math.random() * SHOUTS.length) | 0], '#ffffff'); c.position.y = 0; c.position.x += dx / d * sp; c.position.z += dz / d * sp; c.rotation.y = Math.atan2(dx, dz); animateWalk(c, dt, 1.3); u.goal = null; }
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

    for (const t of tanks) consider(t.g.position, 1.2, 'tank', t); for (const fo of foes.targets()) consider(fo.pos, 1.6, 'foe', fo); for (const s of soldiers) consider(s.position, 0.9, 'soldier', s); for (const o of drivers) consider(o.g.position, 0.8, 'car', o);
    if (target) { meleeCd = 0.55; if (target.kind === 'rival') fightSwing(); else smashAct(); faceY = Math.atan2(target.pos.x - px, target.pos.z - pz);
      if (target.kind === 'rival') { meleeCd = SWING_GAP[fightN % SWING_GAP.length]; strikeRival(target.ref); }
      else if (target.kind === 'tank') { const i = tanks.indexOf(target.ref); if (i >= 0) { tanks.splice(i, 1); twisters.scatter([target.ref.g], g.position.clone(), 6); tankBoom(target.pos.clone()); award(250, target.pos, 'TANK'); grow(1.5); } }
      else if (target.kind === 'foe') { meleeCd = 0.45; target.ref.zap(); }
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
  for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.life -= dt; if (s.big && !s.laser) s.vel.y -= 2 * dt; s.m.position.addScaledVector(s.vel, dt);
    if (s.life <= 0) { if (s.big) fx.explode(s.m.position.clone(), 0.5); else fx.puff('smoke', s.m.position.clone(), 0.25); scene.remove(s.m); shots.splice(i, 1);
      if (Math.hypot(s.m.position.x - px, s.m.position.z - pz) < R + 0.8) hurt((s.big ? 1.6 : 0.35) * ARMY_DMG[stage], s.big); } }
  updatePlanes(dt, px, pz); updateRival(dt, px, pz); foes.update(dt, me.g.position.x, me.g.position.z, Math.max(1, reach() * 0.7));
  for (let i = sinking.length - 1; i >= 0; i--) { const s = sinking[i]; s.t = Math.min(1, s.t + dt * 1.1); s.obj.rotation.z = s.t * 0.4; s.obj.position.y = s.y0 - s.t * s.h * 0.95; if (s.t >= 1) { s.obj.visible = false; sinking.splice(i, 1); } }
  // HUD
  crowdLists[0][0] = people; crowdLists[1][0] = soldiers; crowd.sync(crowdLists, me.g.position.x, me.g.position.z, 6 + meScale * 1.6);
  const m = Math.floor(tLeft / 60), s = Math.floor(tLeft % 60); setT('taTime', m + ':' + String(s).padStart(2, '0')); if (hudCache.red !== (tLeft < 15)) { hudCache.red = tLeft < 15; $('taTime').style.color = tLeft < 15 ? '#ff5a3a' : ''; }
  setT('taScore', score); setT('taCombo', mult() > 1 && played - lastHit < 2.5 ? 'x' + mult() + ' COMBO' : ''); setT('taRank', STAGE[stage]); { const pct = Math.round((bDone / totalB) * 100); setT('taPct', innerWidth < 761 ? '💥 ' + pct + '%' : '🏚️ ' + pct + '% DESTROYED'); /* (a phone: just the blast and the number) */ /* town destroyed: the badge over the mini map (it turns green at the goal) */ if (hudCache.pctOk !== (pct >= L().goal)) { hudCache.pctOk = pct >= L().goal; $('taPct').classList.toggle('ok', pct >= L().goal); } }
  { const w = (meF * 100).toFixed(1) + '%'; if (hudCache.grow !== w) { hudCache.grow = w; $('taGrowFill').style.width = w; } const pw = Math.round(power * 100) + '%'; if (hudCache.pw !== pw) { hudCache.pw = pw; $('kjPowerFill').style.width = pw; $('kjPower').classList.toggle('full', power >= 1); setT('kjPowerTxt', power >= 1 ? '⚡ ' + K.spells[stage - 1].toUpperCase() + ' READY: TAP A TARGET' : '⚡ POWER'); } }
  setStormLevel(stage * 2 - 1 + (rival && rival.hp > 0 ? 1 : 0));
  if (Math.round((bDone / totalB) * 100) >= 100 && poiOrder.every((k) => pois[k].done)) { /* as soon as the HUD reads 100% (it rounds, so a stray building or two can't hold the round open) */ if (!totalD && !died) totalWipe(me.g.position); rivalQueue = []; if (!rival) tLeft = Math.min(tLeft, 1.5); }
  { let n = 0; for (const k of poiOrder) { const P = pois[k]; if (P.done) { n++; continue; } const ready = stage >= POI[k].stage; if (P.chip) P.chip.classList.toggle('ready', ready); P.arrow.classList.toggle('ready', ready); edgeArrow(P.arrow, P.center, true); if (P.mark) tickPoiMark(P.mark, ready); } // too small for it yet: its badge and arrow stay, but dim and grey
    const need = Math.min(L().need, poiOrder.length); setT('taTargets', n + '/' + need); if (hudCache.tgtOk !== (n >= need)) { hudCache.tgtOk = n >= need; $('taTargets').classList.toggle('ok', n >= need); } }
  mapT -= dt; if (mapT <= 0) { mapT = 0.08; drawMini(); }
}

addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight, false)); renderer.setSize(innerWidth, innerHeight, false);
const camTarget = new THREE.Vector3(); let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  setSfxPaused(state === 'paused'); { const rb = document.getElementById('radioBox'); setMusicDuck(state === 'play' || state === 'outro' ? 1 : state === 'paused' && !(rb && !rb.classList.contains('hidden')) ? 0 : 0.5); } // music: full in a round, paused on pause (unless the radio is open), half on menus
  const hold = coachFrame(state === 'play'); if (hold) $('taBanner').style.opacity = 0; // a first-time prompt is up: the round waits for the player
  let dtU = dt; if (hitStop > 0) { hitStop -= dt; dtU = 0; } else if (slowMo > 0) { slowMo -= dt; dtU = dt * 0.35; }
  if (state === 'play') { if (!hold) { if (dtU > 0) update(dtU); } else { me.anim(dt, 0.15); if (rival) rival.rig.anim(dt, 0.15); } } else if (state === 'outro' && me) outroTick(dt); else if (state === 'dying' && me) { me.anim(dt, 0); if (rival) rival.rig.anim(dt, 0); } else if (me) me.anim(dt, 0.15);
  if (city) { twisters.update(dt); fx.update(dt); poiFx.update(dt); city.updateRain(dt); if (!hold) spells.update(dt); }
  bannerT -= dt; if (bannerT <= 0) $('taBanner').style.opacity = 0;
  flashT = Math.max(0, flashT - dt); flashEl.style.opacity = Math.min(0.75, flashT * 3); hurtT = Math.max(0, hurtT - dt); darkT = Math.max(0, darkT - dt); darkEl.style.opacity = Math.min(0.72, darkT * 1.4); hurtEl.style.opacity = Math.min(0.55, hurtT * 2);
  camK += ((megaT > 0 ? 1.15 : [1, 1, 1.15, 1.32][stage]) * (bout ? 0.68 : 1) - camK) * Math.min(1, dt * 1.6); /* the fight cam: in close while you wrestle */
  const a = innerWidth / innerHeight, s = me ? meScale / 1.5 : 1, base = 7.2 + s * 2.8; let half = (a < 1 ? base / a * 0.8 : base) * zoom * camK;
  const foe = rival && me && !rival.koT ? rival.g.position : null, fd = foe ? Math.hypot(foe.x - me.g.position.x, foe.z - me.g.position.z) : 1e9, inFight = fd < 24, close = !!foe && fd < (meScale + rival.scale) * 1.3 + 3.5 && !rival.toss;
  // the view's half-height has to cover the gap between you (the iso view squashes depth, so ~0.62 of it) plus both bodies, on a phone's narrow side too
  // toe to toe the camera comes right in (up to twice as close), so the blows can be seen; fightFit is how much wider or tighter than usual
  const need = inFight ? (fd * 0.62 + (meScale + rival.scale) * (close ? 1.15 : 1.4)) / (a < 1 ? a : 1) : 0; fightFit += ((close ? Math.max(need, half * 0.5) / half : inFight ? Math.max(1, need / half) : 1) - fightFit) * Math.min(1, dt * 2.4); half *= fightFit;
  cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
  if (me && !camHold) { if (inFight) tmp.set((me.g.position.x + foe.x) / 2, 1 + meScale * 0.4, (me.g.position.z + foe.z) / 2); else tmp.set(me.g.position.x, 1 + meScale * 0.4, me.g.position.z); camTarget.lerp(tmp, Math.min(1, dt * 3)); } cam.position.copy(camTarget).addScaledVector(isoDir, 80); cam.lookAt(camTarget);
  if (shake > 0) { shake = Math.max(0, shake - dt * 2.2); const k = shake * shake * 0.5 * Math.min(2, half / 14); cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k; }
  if (CINE && me) { cineCam.aspect = a; cineCam.updateProjectionMatrix(); const P = me.g.position, R = rival && rival.hp > 0 && rival.koT <= 0 ? rival.g.position : null, sep = R ? Math.hypot(R.x - P.x, R.z - P.z) : 0;
    // side-on: with a rival close by, frame both from beside the line between them; otherwise circle the monster slowly
    let mx = P.x, mz = P.z, px, pz; if (R && sep < 30) { mx = (P.x + R.x) / 2; mz = (P.z + R.z) / 2; px = -(R.z - P.z) / (sep || 1); pz = (R.x - P.x) / (sep || 1); } else { const an = 1.2 + played * 0.04; px = Math.cos(an); pz = Math.sin(an); }
    const d = 3 + meScale * 1.7 + (R && sep < 30 ? sep * 0.5 : 0); cineTo.set(mx + px * d, 0.8 + meScale * 1.5, mz + pz * d); cineAt.set(mx, meScale * 1.05, mz); if (!cineCam.userData.on) { cineCam.position.copy(cineTo); cineCam.userData.on = 1; cineLook.copy(cineAt); }
    cineCam.position.lerp(cineTo, Math.min(1, dt * 2)); cineLook.lerp(cineAt, Math.min(1, dt * 2)); cineCam.lookAt(cineLook); }
  updatePops(dt); cullChunks(); perfTick(); renderer.render(scene, viewCam());
}
// the title screen: a calm town with your kaiju in it
function showcase() { if (state !== 'start') return; makeMe(); me.g.position.set(0, 0, 0); camTarget.set(0, 2, 0); }
// QUICK PLAY on the main menu comes in with ?quick: no title screen, straight into the town you left off in with the
// monster you last used. Otherwise, a calm town behind the title screen
if (new URLSearchParams(location.search).has('quick')) { level = quickLevel('kj'); drawLevels(); start(); camTarget.set(me.g.position.x, 2, me.g.position.z); }
else { buildWorld(); makeMe(); camTarget.set(0, 2, 0); }
requestAnimationFrame(frame); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('booting'))); // the start screen is ready now
window.__kj = { get pois() { return pois; }, get poiOrder() { return poiOrder; }, get foes() { return foes; }, get poiFx() { return poiFx; }, wreckPoi, get gm() { return gm; }, gmTap, gmAuto(g) { if (!gm) return; if (gm.type === 'escape') { if (g !== 'fail') gm.taps = gm.need; return; } if (gm.type === 'chokeslam' || gm.type === 'piledriver') gm.drive.k = gm.type === 'chokeslam' ? 0.45 : 0.35; gm.grade = g; gmGo(g, 1.3); }, get aiming() { return !!aimS; }, startAim, endAim, playerHeavy, playerDodge, fightFlick, get counterT() { return counterT; }, get comboN() { return combo; }, get coachUp() { return coachBusy(); }, get crowd() { return crowd; }, get people() { return people; }, get soldiers() { return soldiers; }, get bout() { return bout; }, rangedAttack, get rangedReady() { return rangedOk(); }, get leaping() { return !!leap; }, get dots() { return dots; }, hitDot, playerSwing, get nearRival() { return nearRival(); }, get grabbed() { return grabbed; }, rivalGrab: (r) => rivalGrab(r), strikeRival: (r) => strikeRival(r), doFinisher, get finishing() { return finishing; }, get meToss() { return meToss; }, startEscape: (r) => startEscape(r), startBout: (r) => startBout(r), wrestle, finish, get tLeft() { return tLeft; }, get camHold() { return camHold; }, get died() { return died; }, get outroT() { return outroT; }, get bike() { return bike; }, get totalD() { return totalD; }, set bDone(v) { bDone = v; }, get totalB() { return totalB; }, emote, throwHammer, endMini: (res) => endMini(res), get song() { return songState(); }, get sceneN() { return scene.children.length; }, flourish, get anims() { return anims.length; }, dropMega, goMega, megaBlast, get megaT() { return megaT; }, get megaDrop() { return megaDrop; }, THREE, get me() { return me; }, get moveTo() { return moveTo; }, get mass() { return mass; }, set mass(v) { mass = v; }, get massTarget() { return massTarget; }, get stage() { return stage; }, get power() { return power; }, set power(v) { power = v; }, get rival() { return rival; }, spawnRival, spawnPlane, get planes() { return planes; }, get state() { return state; }, get score() { return score; }, get people() { return people; }, get buildings() { return buildings; }, get pois() { return pois; }, get tanks() { return tanks; }, get soldiers() { return soldiers; }, tapAt, get cam() { return cam; }, set tLeft(v) { tLeft = v; }, set level(v) { level = v; }, start, hurt, get calls() { return renderer.info.render.calls; }, get fires() { return fires; }, get mini() { return mini && { ...mini, side: mini.side }; }, startMini, get pool() { return pool.length; }, get unlocked() { return unlockedKaiju(); }, set pick(v) { pick = v; } };
