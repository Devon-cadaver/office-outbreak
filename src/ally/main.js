import { radioButton } from '../radioBox.js';
// Tornado Alley: you are the storm. Steer a tornado through town, rip up houses and towers, suck up the people,
// and take out the big targets (power plant, water station, fairground and more on bigger maps). The more you wreck, the bigger you
// grow, up to three times your starting size; tall towers only give way once you're big enough.
import * as THREE from 'three';
import { nukeBlast } from '../nuke.js';
import { generateMaze, buildCity, toWorld, toCell, findPath, CELL, mulberry32 } from '../city.js';
import { makeCharacter, animateWalk } from '../poster/characters.js';
import { makeCar } from '../car.js';
import { isFuture, isPast, hoverize, futurePlane, pastPlane, buildCannon, buildChaserCoach, eraPicker, levelKey, bestKey, futureTank, laserBolt } from '../era.js';
import { createTwisters, TWISTER_SKINS } from '../tornado.js';
import { createFires } from '../fire.js';
import { unlockAudio, soundToggle, skipSongBtn, sfx, stopMusic, setPlaneEngine, planeEngineLevel, setStormLevel, stormBoost, stormMusicState, playSongs, songState, gameMusic, SONGS_TORNADO } from '../audio.js';
import { armySkin, townSkin, equippedSkin, equippedTornado, skinnedCarArgs, addCoins, grantSkin, equip, CHAR_SKINS, totalReward, pauseSkinRow, getOwned, getEquipped } from '../skins.js';
import { forceSeason, seasonChoice, seasonPicker } from '../season.js';
import { showPrizes } from '../prizes.js';
import { stampVersion } from '../version.js';
import { initFullscreen } from '../fullscreen.js';
import { showHowTo, tip, clearTips } from '../howto.js';
import { coach, coachSeen, coachIdle, coachBusy, coachFrame, coachClear } from '../coach.js';
import { quickLevel, saveLast } from '../progress.js';
import { createCrowd } from '../crowd.js';
import { autoResolution, mergeStatic, bakeMovable, bakeUnits, setBakedGlow } from '../perf.js';
import { rides, spinners } from '../landmarks.js';
import { makePlane, makeChaser, makeTank } from './units.js';
import { createFoes } from './foes.js';
import { createPoiFx } from './poiFx.js';
import { buildOutskirts } from '../outskirts.js';
import { createPreviews } from '../livePreview.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.debug.checkShaderErrors = false; // reading shader logs forces a sync compile (a hitch) every time a new material shows up
const perfTick = autoResolution(renderer); // drops the draw resolution a notch when frames run long
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x16302f); scene.fog = new THREE.Fog(0x16302f, 60, 120);
const hemi = new THREE.HemisphereLight(0xb8e0d8, 0x2a4448, 1.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xd0e8ff, 0.9); sun.position.set(-6, 10, 8); scene.add(sun);
const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 440), CAM_D = 120; // CAM_D: how far back the camera sits (it sees the same from anywhere, but must clear the ground when zoomed right out)
// optional chase view: low behind the storm, looking across town the way it is heading
// ?cine=side: a trailer camera, low and to the side of the storm, slowly circling, with the HUD hidden
const CINE = new URLSearchParams(location.search).get('cine'); if (CINE) document.body.classList.add('cine');
const cam3 = new THREE.PerspectiveCamera(58, 1, 0.1, 300); let third = !!CINE, camYaw = Math.PI * 1.25; // the chase view is hidden for now, so everyone plays top-down
const viewCam = () => (third ? cam3 : cam);
const ISO_YAW = Math.PI / 4, ISO_ELEV = 0.72;
const isoDir = new THREE.Vector3(Math.sin(ISO_YAW) * Math.cos(ISO_ELEV), Math.sin(ISO_ELEV), Math.cos(ISO_YAW) * Math.cos(ISO_ELEV)).normalize();
const fx = createFires(scene);
const crowd = createCrowd(scene, 640), crowdLists = [[null, 0], [null, 1]]; // townsfolk and soldiers away from the storm: one draw call for the lot
let shake = 0; const jolt = (v) => { shake = Math.max(shake, v); }; // camera shake (0..1): a short jolt when something big comes down
let flashT = 0; const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;background:#dfeaff;opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(flashEl);
const twisters = createTwisters(scene, { onToss: (kind, p, who, vel) => stormToss(kind, p, who, vel), onBolt: (p, ground, who) => { const mine = !who || who === tw, sk = (who || tw || {}).skin; if (mine) { flashT = Math.max(flashT, ground ? 0.1 : 0.05); if (ground && Math.random() < 0.3) sfx.boom(); } if (ground) fx.zap(p, sk && sk.boltGlow ? sk.boltGlow : 0x9fd0ff); } }); twisters.setFx(fx); // another storm's bolts (the rogue twister) don't flash the screen
stampVersion($('taStart'));
const poiFx = createPoiFx(scene, fx, { jolt, popup, flash: (v) => { flashT = Math.max(flashT, v); },
  // the nearest buildings still standing, for the power plant's lightning to jump to (some of them catch fire)
  arcTargets: (c, r, n) => buildings.filter((x) => !x.done).map((x) => [Math.hypot(x.pos.x - c.x, x.pos.z - c.z), x]).filter((e) => e[0] < r && e[0] > 2).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, x]) => ({ pos: new THREE.Vector3(x.pos.x, Math.min(x.h, 6), x.pos.z), hit: () => { if (!x.done && x.burnT == null && Math.random() < 0.4) ignite(x); } })) }); // each big target goes up in its own way

// ---------- tuning ----------
const S0 = 0.42, MAX_S = 3; // tornado scale at size 1, and the final size (3x)
// five levels, each a bigger town; clear one by flattening the goal share of its buildings and taking out `need` of its
// big targets (a few in Small Town, every last one in Megacity)
const LEVELS = [
  { name: 'Small Town', size: 21, time: 120, goal: 35, pois: 5, need: 2 },
  { name: 'Suburbs', size: 27, time: 140, goal: 35, pois: 6, need: 3 },
  { name: 'Downtown', size: 33, time: 165, goal: 35, pois: 7, need: 4 },
  { name: 'Metro', size: 39, time: 190, goal: 30, pois: 8, need: 6 },
  { name: 'Megacity', size: 47, time: 270, goal: 30, pois: 10, need: 10 },
  { name: 'The Sprawl', size: 57, time: 320, goal: 30, pois: 10, need: 10 }, // half as big again as Megacity: only possible now the city is drawn in batches
];
let level = 1; const L = () => LEVELS[level - 1];
const SEASON_CYCLE = ['none', 'halloween', 'christmas', 'july4'], SEASON_NAME = { none: 'Clear skies', halloween: 'Halloween', christmas: 'Christmas', july4: '4th of July' };
let seasonI = 0; { let last = -1; try { last = +(localStorage.getItem('ta_season_start') ?? -1); } catch { /* ignore */ } seasonI = (Math.max(0, last) + 1 + ((Math.random() * (SEASON_CYCLE.length - 1)) | 0)) % SEASON_CYCLE.length; if (seasonI === last) seasonI = (seasonI + 1) % SEASON_CYCLE.length; try { localStorage.setItem('ta_season_start', String(seasonI)); } catch { /* ignore */ } }
let roundN = 0; const seasonNow = () => SEASON_CYCLE[(seasonI + roundN) % SEASON_CYCLE.length];
const seasonFor = () => (seasonChoice() !== 'random' ? seasonChoice() : level >= 5 ? 'none' : seasonNow()); // Megacity and The Sprawl: no decorations, they're big enough already
const unlocked = () => { try { return Math.max(1, Math.min(LEVELS.length, +localStorage.getItem(levelKey('ta')) || 1)); } catch { return 1; } };
let ROUND = LEVELS[0].time;
// big targets: HUD icon, banner name, the Fujita rank that can take it, points. Each round has the classic three plus
// a random pick of the others, more on bigger maps; the nuclear plant only turns up from Downtown on.
const POI = { fair: { icon: '🎡', name: 'FAIRGROUND', f: 4, pts: 4000 }, power: { icon: '⚡', name: 'POWER PLANT', f: 3, pts: 3000 }, water: { icon: '💧', name: 'WATER STATION', f: 2, pts: 2500 },
  cemetery: { icon: '🪦', name: 'GRAVEYARD', f: 1, pts: 1500 }, weather: { icon: '📡', name: 'WEATHER STATION', f: 1, pts: 2000 }, firestation: { icon: '🚒', name: 'FIRE STATION', f: 2, pts: 2200 },
  police: { icon: '🚓', name: 'POLICE STATION', f: 2, pts: 2200 }, sewage: { icon: '💩', name: 'SEWAGE PLANT', f: 2, pts: 2200 }, radio: { icon: '📻', name: 'RADIO TOWER', f: 3, pts: 3500 },
  nuclear: { icon: '☢️', name: 'NUCLEAR PLANT', f: 5, pts: 8000 } };
const EXTRA_POIS = ['cemetery', 'weather', 'firestation', 'police', 'sewage', 'radio'];
const rankOf = (s) => Math.min(5, Math.floor(((s - 1) / (MAX_S - 1)) * 5 + 0.02));

// ---------- world ----------
let cols, rows, maze, city, buildings = [], people = [], cars = [], pois = {}, hMax = 3, massTarget = 1, totalB = 1;
let roadCells = [], drivers = [], soldiers = [], tanks = [], shots = [];
function roadPathTo(cell, wx, wz, away) {
  // a route along the streets toward (or away from) a point
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
  // shots fly at the storm and burst against it; a tornado shrugs off bullets and shells alike
  const to = twObj.position.clone().setY(1 + Math.random() * 3 * sizeShown); const dir = to.clone().sub(from); const L = dir.length(); dir.normalize();
  if (big && isFuture()) { const m = laserBolt(); m.position.copy(from); m.lookAt(to); scene.add(m); shots.push({ m, vel: dir.multiplyScalar(36), life: L / 36, big, laser: true }); fx.puff('flame', from, 0.3); sfx.laser(); return; }
  const m = new THREE.Mesh(big ? shellGeo : tracerGeo, big ? shellMat : tracerMat); m.position.copy(from); m.lookAt(to); scene.add(m);
  shots.push({ m, vel: dir.multiplyScalar(big ? 16 : 28), life: L / (big ? 16 : 28), big }); fx.puff('flame', from, big ? 0.6 : 0.25); if (big) sfx.boom(); else if (Math.random() < 0.3) sfx.throw();
}
function buildWorld() {
  if (city) { scene.remove(city.group); twisters.clear(); fx.clear(); poiFx.clear(); for (const p of people) scene.remove(p); }
  cols = rows = L().size; const seed = (Math.random() * 1e6) | 0; const rng = mulberry32(seed); const big = cols / 21; forceSeason(seasonFor());
  maze = generateMaze(cols, rows, Math.floor(cols * rows * 0.12), rng);
  const mid = (cols - 1) / 2; for (let i = 1; i < cols - 1; i++) { maze[mid][i] = false; maze[i][mid] = false; } maze.avenues = { row: mid, col: mid };
  if (cols >= 33) for (const q of [Math.round((cols - 1) / 4) | 1, Math.round((cols - 1) * 3 / 4) | 1]) for (let i = 1; i < cols - 1; i++) { maze[q][i] = false; maze[i][q] = false; }
  // the fairground: three rides side by side on the south side, facing an open street
  const farFromMid = (x, y) => Math.abs(x - mid) + Math.abs(y - mid) > cols * 0.3;
  let fy = rows - 4, fx0 = mid - 1; for (let k = 0; k < 60; k++) { const y = 3 + ((rng() * (rows - 7)) | 0), x = 2 + ((rng() * (cols - 7)) | 0); if (farFromMid(x + 1, y)) { fy = y; fx0 = x; break; } }
  for (let x = fx0; x <= fx0 + 2; x++) maze[fy][x] = true; for (let x = fx0 - 1; x <= fx0 + 3; x++) maze[fy + 1][x] = false;
  const near = (tx, ty) => { let best = null, bd = 1e9; for (let y = 2; y < rows - 2; y++) for (let x = 2; x < cols - 2; x++) { if (!maze[y][x] || (y === fy && x >= fx0 && x <= fx0 + 2)) continue; if (!(maze[y - 1][x] === false || maze[y + 1][x] === false || maze[y][x - 1] === false || maze[y][x + 1] === false)) continue; const d = Math.abs(x - tx) + Math.abs(y - ty); if (d < bd) { bd = d; best = [x, y]; } } return best; };
  const extra = EXTRA_POIS.slice(); for (let i = extra.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [extra[i], extra[j]] = [extra[j], extra[i]]; }
  const want = ['power', 'water', ...(level >= 3 ? ['nuclear'] : []), ...extra].slice(0, L().pois - 1);
  const taken = [[fx0 + 1, fy]], cells = new Set([fy * cols + fx0, fy * cols + fx0 + 1, fy * cols + fx0 + 2]);
  const forced = new Map([[fy * cols + fx0, 'ferris'], [fy * cols + fx0 + 1, 'coaster'], [fy * cols + fx0 + 2, 'carousel']]);
  for (const k of want) { let at = null; // as far from the others as the map allows, never right on top of the storm's start
    for (let sep = cols * 0.35; !at && sep >= 2; sep *= 0.8) for (let t = 0; t < 60 && !at; t++) { const x = 2 + ((rng() * (cols - 4)) | 0), y = 2 + ((rng() * (rows - 4)) | 0); if (Math.abs(x - mid) + Math.abs(y - mid) <= cols * 0.2) continue; const n = near(x, y); if (n && !cells.has(n[1] * cols + n[0]) && taken.every(([ax, ay]) => Math.abs(ax - n[0]) + Math.abs(ay - n[1]) > sep)) at = n; }
    if (!at) continue; taken.push(at); cells.add(at[1] * cols + at[0]); forced.set(at[1] * cols + at[0], k); }
  maze.forcedLandmarks = forced;
  twisters.setBounds(toWorld(cols - 1, rows - 1, cols, rows));
  hemi.intensity = 1.7; sun.intensity = 0.9; city = buildCity(scene, maze, 3 + (seed % 9973)); buildOutskirts(scene, cols, rows, seed); city.season.light(hemi, sun, scene); city.detail.clouds.visible = false; city.detail.clouds.material.opacity = 0;
  // targets
  pois = {}; for (const hz of city.hazards) { const k = ['ferris', 'coaster', 'carousel'].includes(hz.type) ? 'fair' : POI[hz.type] ? hz.type : null; if (k) (pois[k] = pois[k] || { hz: [], done: false }).hz.push(hz); }
  for (const k in pois) { const c = new THREE.Vector3(); for (const hz of pois[k].hz) c.add(hz.pos); pois[k].center = c.divideScalar(Math.max(1, pois[k].hz.length)); pois[k].reach = k === 'fair' ? 4.2 : 1.6; }
  // buildings
  buildings = city.buildings.map((b) => { const obj = b.parent !== city.group ? b.parent : b; const wp = b.getWorldPosition(new THREE.Vector3()); const h = b.userData.h || 2; return { b, obj, pos: wp, h, pts: Math.round((obj === b ? 70 : 55) * h), done: false, shake: 0 }; });
  hMax = Math.max(3.2, ...buildings.map((x) => x.h)); totalB = buildings.length;
  // fewer draw calls: each house's pieces and each shop's trim merge into a few meshes (this mode never fades buildings)
  { const anim = new Set(city.season.anim.map((a) => a.m)); for (const x of buildings) { if (x.obj !== x.b) mergeStatic(x.obj, x.obj.children.filter((m) => !anim.has(m)));
    else { const ex = x.b.userData.extras || []; const map = mergeStatic(city.group, ex.filter((m) => !anim.has(m))); if (map.size) { const o = []; for (const e of ex) { const m = map.get(e) || e; if (!o.includes(m)) o.push(m); } x.b.userData.extras = o; } } } }
  freezeCity();
  // people: small crowds out on the streets
  people = []; const roads = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (!maze[y][x]) roads.push([x, y]);
  const groups = Math.min(80, Math.round(44 * Math.pow(big, 1.3)));
  for (let g = 0; g < groups; g++) { const [x, y] = roads[(rng() * roads.length) | 0]; const w = toWorld(x, y, cols, rows); if (Math.hypot(w.x, w.z) < 6) continue; const n = 2 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) { const c = makeCharacter(['worker', 'pink', 'plaid', 'hivis', 'suit', 'hoodie', 'punk', 'vest'][(rng() * 8) | 0], { skin: townSkin(), look: Math.random() }); c.scale.setScalar(0.25); c.position.set(w.x + (rng() - 0.5) * 1.6, 0, w.z + (rng() - 0.5) * 1.6); c.rotation.y = rng() * 6.28; c.userData.home = c.position.clone(); c.userData.goal = null; c.userData.wait = rng() * 3; scene.add(c); people.push(c); } }
  cars = city.cars.slice();
  // traffic, army squads and tanks
  roadCells = roads; for (const o of [...drivers, ...soldiers, ...tanks]) scene.remove(o.g || o); drivers = []; soldiers = []; tanks = []; for (const s of shots) scene.remove(s.m); shots = [];
  const farRoad = (min) => { for (let k = 0; k < 60; k++) { const [x, y] = roads[(rng() * roads.length) | 0]; const w = toWorld(x, y, cols, rows); if (Math.hypot(w.x, w.z) > min) return [x, y]; } return roads[0]; };
  for (let i = 0; i < 9 + 3 * (level - 1); i++) { const [x, y] = farRoad(5); const c = makeCar(...skinnedCarArgs([0xc23b3b, 0x4f8fd6, 0xe8d54a, 0xd8dde0, 0x3a8a5a][(rng() * 5) | 0])); c.scale.setScalar(0.8); const w = toWorld(x, y, cols, rows); c.position.set(w.x, 0, w.z); scene.add(c); drivers.push({ g: c, cell: [x, y], path: [], speed: 3 + rng() * 1.5 }); }
  for (let sq = 0; sq < 5 + 2 * (level - 1); sq++) { const [x, y] = farRoad(12); const w = toWorld(x, y, cols, rows); for (let i = 0; i < 3; i++) { const s = makeCharacter('vest', { skin: armySkin() }); s.scale.setScalar(0.25); s.position.set(w.x + (i - 1) * 0.5, 0, w.z + (rng() - 0.5) * 0.6); const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.6), new THREE.MeshLambertMaterial({ color: 0x22262a })); gun.position.set(0, -0.72, 0.25); s.userData.armR.add(gun); s.userData.cd = rng() * 2; scene.add(s); soldiers.push(s); } }
  for (let i = 0; i < 3 + (level - 1); i++) { const [x, y] = farRoad(16); const t = isPast() ? buildCannon() : makeTank(isFuture()); if (isFuture()) hoverize(futureTank(t), 0xff4fd8); const w = toWorld(x, y, cols, rows); t.position.set(w.x, 0, w.z); scene.add(t); tanks.push({ g: t, cell: [x, y], path: [], cd: 2 + rng() * 2, repath: 0 }); }
  massTarget = buildings.reduce((s, x) => s + x.h, 0) * 0.42 * Math.sqrt(1 / big) + 12; // bigger towns: a smaller share grows you to full size
}

// ---------- frame cost: the static town is sorted into chunks (8x8 cells). A chunk's positions are worked out once and
// never again, and a chunk that's off screen (or past the fog in the chase view) is switched off whole, so the renderer
// skips thousands of objects with one check. Anything the storm grabs is moved back out to the live city group first,
// so it animates exactly as before. Rides, spinning parts and animated decorations never go into a chunk. ----------
const CHUNK = 4, noop = () => {}; let chunks = [], liveDeco = [];
function freezeCity() {
  const cg = city.group; cg.updateMatrixWorld(true); const keep = new Set();
  const mark = (o) => { while (o && o.parent && o.parent !== cg) o = o.parent; if (o && o.parent === cg) keep.add(o); };
  liveDeco = city.season.anim.filter((a) => a.bob || a.wave).map((a) => a.m); for (const r of rides) for (const o of [r.wheel, r.platform, ...(r.cars || [])]) if (o) mark(o); for (const s of spinners) mark(s.obj);
  const map = new Map(), bb = new THREE.Box3(), sz = new THREE.Vector3(), ctr = new THREE.Vector3(), span = CHUNK * CELL, ox = cols * CELL / 2, oz = rows * CELL / 2;
  for (const o of cg.children.slice()) { if (keep.has(o) || o.isLight || o.isPoints) continue; bb.setFromObject(o); if (bb.isEmpty()) { if (!o.isLine) continue; o.getWorldPosition(ctr); bb.setFromCenterAndSize(ctr, sz.set(0.1, 0.1, 0.1)); }
    bb.getSize(sz); if (Math.max(sz.x, sz.z) > span * 1.5) continue; bb.getCenter(ctr);
    const key = Math.floor((ctr.x + ox) / span) + ',' + Math.floor((ctr.z + oz) / span); let ch = map.get(key); if (!ch) { ch = new THREE.Group(); ch.isChunk = true; ch.box = new THREE.Box3(); map.set(key, ch); cg.add(ch); } ch.add(o); ch.box.union(bb); }
  // the scenery nothing ever moves (roads, trees, lamps, fences...) is baked into a few meshes per chunk: thousands of
  // separate draws were what made the big maps lag on phones. Buildings, props, landmarks and animated bits stay apart.
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
function cullChunks() { const vc = viewCam(); vc.updateMatrixWorld(); projM.multiplyMatrices(vc.projectionMatrix, vc.matrixWorldInverse); frus.setFromProjectionMatrix(projM); const far = third ? scene.fog.far + 4 : Infinity;
  for (const ch of chunks) ch.visible = frus.intersectsBox(ch.box) && (far === Infinity || ch.box.distanceToPoint(vc.position) < far);
  for (const m of liveDeco) { let o = m.parent; while (o && !o.isChunk) o = o.parent; if (!o || o.visible) m.updateMatrixWorld(true); } }

// ---------- first-time coaching: one new thing at a time. The round holds still while a card and an arrow show it (see
// coach.js); it carries on when the player does it, and each one only ever shows once on this device ----------
let trip = 0; const tripAt = new THREE.Vector3(); // how far the storm has gone since the last prompt
const toScreen = (p, y = 0) => { const v = new THREE.Vector3(p.x, y, p.z).project(viewCam()); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, on: Math.abs(v.x) < 0.86 && v.y > -0.8 && v.y < 0.62 && v.z < 1 }; };
const elMid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
function coachTA() {
  trip += twObj.position.distanceTo(tripAt); tripAt.copy(twObj.position); if (coachBusy()) return;
  if (!coachSeen('ta_move')) { if (played > 0.5) coach('ta_move', { mode: 'drag', title: 'MOVE', text: 'Hold and drag anywhere on the screen to steer your storm.', done() { trip = 0; } }); return; }
  // whatever turns up on its own is shown the moment it's on screen
  if (!coachSeen('ta_plane')) { const pl = planes.find((p) => p.life > 0 && !p.crash && toScreen(p.g.position, p.g.position.y).on); if (pl && coach('ta_plane', { mode: 'tap', title: '✈ SEEDING PLANE', text: 'Its blue spray shrinks your storm. Dodge the ring under it, or tap the plane to strike it down.', at: () => toScreen(pl.g.position, pl.g.position.y) })) return; }
  if (!coachSeen('ta_chaser') && chaser && chaser.g && (chaser.mode === 'shoot' || toScreen(chaser.g.position).on)) { const c = chaser; /* it often parks just off the side of a phone screen: the arrow then points the way */ if (coach('ta_chaser', { mode: 'tap', title: '📷 STORM CHASER', text: 'It is taking photos of your storm. Tap it to blow it up with lightning, or chase it down and hurl it away, before it escapes.', at: () => (c.g ? toScreen(c.g.position, 0.5) : null) })) return; }
  if (foes.coachTick()) return;
  if (coachIdle() < 2) return;
  if (!coachSeen('ta_tap')) { if (trip > 6) coach('ta_tap', { mode: 'tap', finger: true, title: 'TAP TO MOVE', text: 'Tap any spot. Lightning strikes it and your storm heads there.', at: () => ({ x: innerWidth * 0.72, y: innerHeight * 0.45 }) }); return; }
  if (!coachSeen('ta_wreck')) { let best = null, bd = 1e9; for (const x of buildings) { if (x.done || x.h > maxH(sizeShown)) continue; const d = x.pos.distanceTo(twObj.position); if (d < bd && d > 1.5 && toScreen(x.pos).on) { bd = d; best = x; } }
    if (best) coach('ta_wreck', { title: 'WRECK IT', text: 'Run into houses, cars and people to tear them up. Everything you wreck makes your storm grow.', at: () => toScreen(best.pos, Math.min(1.2, best.h * 0.5)) }); return; }
  if (!coachSeen('ta_goal')) { if (coachIdle() > 4) coach('ta_goal', { title: '🎯 YOUR MISSION', text: 'Destroy the big targets to clear the town. Each tag shows the storm size you need. Tap a target up here to head for it.', at: () => elMid($('taPois')) }); return; }
  if (!coachSeen('ta_target')) { const rk = rankOf(sizeShown), k = poiOrder.find((p) => !pois[p].done && rk >= POI[p].f); if (k) coach('ta_target', { title: POI[k].icon + ' ' + POI[k].name + ' IS READY', text: 'Your storm is big enough for this target now. Follow its gold arrow and wreck it.', at: () => toScreen(pois[k].center) }); }
}

// ---------- the storm ----------
let tw = null, twObj = null, size = 1, sizeShown = 1, mass = 0, boostT = 0, lastRank = 0;
function stormJunk() { const junk = []; const c = makeCar(...skinnedCarArgs([0xc23b3b, 0x4f8fd6, 0xe8d54a][(Math.random() * 3) | 0])); c.scale.setScalar(0.28); junk.push(c);
  junk.push(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.45, 10), new THREE.MeshLambertMaterial({ color: 0x3a6a8a })));
  return junk; }
function makeStorm() {
  twObj = twisters.make(true, stormJunk(), equippedTornado()); twObj.position.set(0, 0, 0); twObj.visible = true; scene.add(twObj); tw = twObj.userData.twister; tw.layers.forEach((L) => { L.userData.op0 = L.material.opacity; });
  size = sizeShown = 1; mass = 0; twObj.scale.setScalar(S0); nukeT = 0; nukeSave = null; nukeHalo = null; for (const b of blasts) b.remove(); blasts.length = 0; roundId++; stormPrev = null;
}
const reach = () => 1.6 * sizeShown; // ground radius that wrecks things
let obsGrid = null, obsN = -1; const OG = 6;
function obstaclesNear(x, z) { const list = city.obstacles; if (list.length !== obsN || !obsGrid) { obsN = list.length; obsGrid = new Map(); for (const o of list) { const k = Math.floor(o.x / OG) + ',' + Math.floor(o.z / OG); let b = obsGrid.get(k); if (!b) obsGrid.set(k, (b = [])); b.push(o); } }
  const gx = Math.floor(x / OG), gz = Math.floor(z / OG), out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const b = obsGrid.get((gx + i) + ',' + (gz + j)); if (b) out.push(...b); } return out; }
function collidePerson(c) { const p = c.position, r = 0.15; for (const o of obstaclesNear(p.x, p.z)) { const dx = p.x - o.x, dz = p.z - o.z; if (Math.abs(dx) > o.hw + r || Math.abs(dz) > o.hd + r) continue; const qx = o.hw + r - Math.abs(dx), qz = o.hd + r - Math.abs(dz); if (qx < qz) p.x += Math.sign(dx || 1) * qx; else p.z += Math.sign(dz || 1) * qz; } }
const maxH = (s) => 3.2 + ((s - 1) / (MAX_S - 1)) * (hMax - 3.2 + 0.1);

// ---------- score, combo, popups ----------
let score = 0, chain = 0, lastHit = -9, tLeft = ROUND, played = 0, peopleN = 0, carsN = 0, propsN = 0, bDone = 0, tooBigT = 0;
const mult = () => Math.min(5, 1 + Math.floor(chain / 4));
function award(base, pos, label) {
  if (played - lastHit < 2.5) chain++; else chain = 0; lastHit = played; sfx.coin(chain);
  const pts = Math.round(base * mult()); score += pts; popup(pos, '+' + pts + (label ? ' ' + label : ''), mult() > 1 ? '#ff9a3a' : '#ffe27a'); return pts;
}
const pops = []; for (let i = 0; i < 14; i++) { const el = document.createElement('div'); el.className = 'pop'; el.style.display = 'none'; document.body.appendChild(el); pops.push({ el, t: 0, p: new THREE.Vector3() }); }
const SHOUTS = ['RUN!', 'AAAH!', 'TWISTER!', 'NOPE!', 'GET INSIDE!', 'MY CAR!', 'HELP!']; // what people yell as they leg it
let popI = 0; function popup(pos, text, color) { const o = pops[popI++ % pops.length]; o.t = 1; o.p.set(pos.x, (pos.y || 0) + 1.5, pos.z); o.el.textContent = text; o.el.style.color = color; o.el.style.display = 'block'; }
function updatePops(dt) { for (const o of pops) { if (o.t <= 0) continue; o.t -= dt * 0.9; o.p.y += dt * 1.6; const v = o.p.clone().project(viewCam()); o.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%)'; o.el.style.opacity = Math.min(1, o.t * 2); if (o.t <= 0) o.el.style.display = 'none'; } }
let bannerT = 0; function banner(text) { $('taBanner').textContent = text; $('taBanner').style.opacity = 1; bannerT = 2.2; }

// ---------- wreckage ----------
function grow(m) { mass = Math.max(0, mass + m); size = Math.min(MAX_S, 1 + (MAX_S - 1) * Math.min(1, mass / massTarget)); }

// ---------- the storm's enemy: cloud-seeding planes. They hunt the storm and spray it, and the spray shrinks it.
// Grow to F3 and a plane that flies into the funnel gets swallowed instead. ----------
let planes = [], seedT = 30, seededT = 0; const sprayDrops = [];
const SEED = () => { const k = level - 1; return { speed: 5.5 + 0.6 * k, turn: 0.5 + 0.08 * k, hit: 2 + 0.3 * k, sticks: 1.5 + 0.25 * k, bite: 0.03 + 0.006 * k, cool: 6 - 0.4 * k, first: [45, 38, 32, 28, 24][k], every: Math.max(14, 34 - 4 * k), minRank: k < 2 ? 1 : 0 }; };
const sprayGeo = new THREE.SphereGeometry(0.07, 6, 4), sprayMat = new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.85, depthWrite: false });
function spawnPlane() {
  const lim = toWorld(cols - 1, rows - 1, cols, rows); const a = Math.random() * Math.PI * 2, R0 = Math.max(lim.x, lim.z) + 8;
  const g = makePlane(); if (isFuture()) futurePlane(g); else if (isPast()) pastPlane(g); g.position.set(Math.cos(a) * R0, 6.5 + Math.random(), Math.sin(a) * R0); scene.add(g);
  const zone = new THREE.Mesh(new THREE.RingGeometry(3.2, 4, 32), new THREE.MeshBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); zone.rotation.x = -Math.PI / 2; scene.add(zone);
  const arrow = document.createElement('div'); arrow.className = 'planeArrow'; arrow.textContent = '✈'; document.body.appendChild(arrow);
  planes.push({ g, zone, arrow, heading: Math.atan2(-g.position.x, -g.position.z), life: 26, spraying: false }); banner('✈ CLOUD SEEDER!'); sfx.whoosh();
}
function updatePlanes(dt, px, pz, R) {
  const S = SEED(); seedT -= dt; const maxUp = 1 + Math.floor((level - 1) / 2) + extraSeeders; if (!radarDown && seedT <= 0 && rankOf(sizeShown) >= S.minRank) { seedT = S.every + Math.random() * 6; if (planes.length < maxUp) spawnPlane(); }
  const topR = R * 1.4, stormH = 11 * S0 * sizeShown; let sprayed = false;
  for (let i = planes.length - 1; i >= 0; i--) { const pl = planes[i], g = pl.g; if (pl.crash) { crashPlane(pl, i, dt); continue; } pl.life -= dt;
    // hunt: turn toward the storm (with a limited turn rate, so they swing past and come round again); leave when time's up
    const dx = px - g.position.x, dz = pz - g.position.z, d = Math.hypot(dx, dz);
    pl.cool = (pl.cool || 0) - dt; if (d < 9) pl.near = true; else if (pl.near) { pl.near = false; pl.cool = S.cool; }
    if (pl.life > 0 && pl.cool <= 0) { const want = Math.atan2(dx, dz); let dr = want - pl.heading; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); pl.heading += Math.max(-1, Math.min(1, dr)) * S.turn * dt; }
    g.position.x += Math.sin(pl.heading) * S.speed * dt; g.position.z += Math.cos(pl.heading) * S.speed * dt; g.rotation.set(0, pl.heading, 0); g.rotateZ(-Math.max(-0.6, Math.min(0.6, (pl.lastH != null ? (pl.heading - pl.lastH) / Math.max(dt, 1e-3) : 0) * 0.5))); pl.lastH = pl.heading;
    for (const p of g.userData.props) p.rotation.z += dt * 40;
    { const zr = (S.hit + R * 0.5) / 4; pl.zone.position.set(g.position.x, 0.09, g.position.z); pl.zone.scale.setScalar(zr); pl.zone.material.opacity = pl.spraying ? 0.5 + Math.sin(played * 12) * 0.15 : 0.22; pl.zone.visible = pl.life > 0;
      const v = g.position.clone().project(viewCam()); const off = Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95; pl.arrow.style.display = off && pl.life > 0 ? 'block' : 'none';
      if (off) { const a = Math.atan2(v.y, v.x), k = 0.9 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); const sx = (Math.cos(a) * k * 0.5 + 0.5) * innerWidth, sy = (-Math.sin(a) * k * 0.5 + 0.5) * innerHeight; pl.arrow.style.transform = 'translate(' + sx + 'px,' + sy + 'px) translate(-50%,-50%) rotate(' + (-a + Math.PI / 4) + 'rad)'; } }
    // swallowed by a big enough storm
    if (rankOf(sizeShown) >= 3 && d < topR && g.position.y < stormH + 1) { planes.splice(i, 1); scene.remove(pl.zone); pl.arrow.remove(); twisters.suck(g, tw); award(500, g.position, 'PLANE DOWN'); grow(2); banner('PLANE DOWN!'); sfx.boom(); fx.explode(g.position.clone(), 1); continue; }
    // spraying: when it's over the storm, seeding drops rain down and the storm shrinks
    pl.spraying = d < 9 && pl.life > 0 && pl.cool <= 0;
    if (pl.spraying && Math.random() < dt * 40) { for (const sx of [-1.35, 1.35]) { const m = new THREE.Mesh(sprayGeo, sprayMat); m.position.copy(new THREE.Vector3(sx, -0.1, 0).applyMatrix4(g.matrixWorld)); scene.add(m); sprayDrops.push({ m, vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, -3 - Math.random() * 2, (Math.random() - 0.5) * 1.5), life: 2.2 }); } }
    if (pl.spraying && d < S.hit + R * 0.5) sprayed = true;
    if (pl.life <= 0 && Math.hypot(g.position.x, g.position.z) > Math.max(cols, rows) * CELL * 0.75) { scene.remove(g); scene.remove(pl.zone); pl.arrow.remove(); planes.splice(i, 1); }
  }
  // sound: the propeller drone swells as the nearest plane closes in (higher pitch coming, lower going); an INCOMING!
  // popup once each time one closes in for a pass
  { let nd = Infinity, vr = 0; for (const pl of planes) { const d = Math.hypot(pl.g.position.x - px, pl.g.position.z - pz); const r = pl.lastD != null ? (pl.lastD - d) / Math.max(dt, 1e-3) : 0; pl.lastD = d; if (d < nd) { nd = d; vr = r; }
      if (pl.life > 0 && !pl.crash && pl.cool <= 0 && d < 15 && !pl.warned) { pl.warned = true; popup(pl.g.position, 'INCOMING!', '#9fd6ff'); } else if (d > 24) pl.warned = false; }
    setPlaneEngine(nd === Infinity ? 0 : Math.pow(Math.max(0, 1 - (nd - 3) / 34), 1.6), 1 + Math.max(-0.22, Math.min(0.22, vr / 40))); }
  for (let i = sprayDrops.length - 1; i >= 0; i--) { const s = sprayDrops[i]; s.life -= dt; s.m.position.addScaledVector(s.vel, dt); s.m.scale.setScalar(1 + (2.2 - s.life) * 1.5); if (s.life <= 0 || s.m.position.y < 0) { scene.remove(s.m); sprayDrops.splice(i, 1); } }
  // the seeding bites: the storm loses size while it's under the spray
  if (sprayed) { if (seededT <= 0) sfx.hurt(); seededT = S.sticks; } // the seed sticks: it keeps shrinking the storm for 3 s after a pass
  if (seededT > 0) { grow(-massTarget * S.bite * dt); if (Math.random() < dt * 2.5) popup(twObj.position, '-SIZE', '#9fd6ff'); }
  seededT -= dt; const pale = seededT > 0; for (const L of tw.layers) L.material.opacity = L.userData.op0 * (pale ? 0.45 + Math.random() * 0.15 : 1);
  $('taSeeded').style.opacity = pale ? 1 : 0;
}
// ---------- storm chaser: an armoured intercept vehicle that drives in on the roads, stops close to photograph the storm,
// then races off, a little faster than the storm but stuck to the streets. Catch it for a big bonus; if it gets away with
// its pictures, an extra seeding plane joins the hunt for the rest of the level. ----------
let chaser = null, chaserT = 25, extraSeeders = 0, chasersCaught = 0, chasersLost = 0;
function spawnChaser() {
  const far = []; for (const c of roadCells) { const w = toWorld(c[0], c[1], cols, rows); const d = Math.hypot(w.x - twObj.position.x, w.z - twObj.position.z); if (d > 22 && d < 40) far.push(c); }
  const cell = (far.length ? far : roadCells)[(Math.random() * (far.length || roadCells.length)) | 0]; const w = toWorld(cell[0], cell[1], cols, rows);
  const g = isPast() ? buildChaserCoach() : makeChaser(); if (isFuture()) hoverize(g); g.position.set(w.x, 0, w.z); scene.add(g); const arrow = document.createElement('div'); arrow.className = 'planeArrow chaserArrow'; arrow.textContent = '📷'; document.body.appendChild(arrow);
  const bar = document.createElement('div'); bar.className = 'photoBar'; bar.innerHTML = '<i></i>'; document.body.appendChild(bar);
  chaser = { g, cell, path: [], repath: 0, mode: 'approach', shots: 0, fleeT: 0, arrow, bar, flashT: 0 }; banner('📷 STORM CHASER!'); sfx.whoosh();
}
function removeChaser() { if (!chaser) return; scene.remove(chaser.g); chaser.arrow.remove(); chaser.bar.remove(); chaser = null; }
// how far down the top bar reaches: arrows, tips and first-time cards all keep below it
let hudH = 116; function measureHud() { const r = $('ta').querySelector('.top').getBoundingClientRect(); if (r.height) { hudH = Math.round(r.bottom); document.body.style.setProperty('--hudH', hudH + 'px'); } }
addEventListener('resize', () => setTimeout(measureHud, 60));
function edgeArrow(el, pos, show) { const v = pos.clone().project(viewCam()); const off = Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95 || v.z > 1; el.style.display = show && off ? 'block' : 'none'; if (!off) return v;
  const a = Math.atan2(v.y, v.x), k = 0.9 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); el.style.transform = 'translate(' + ((Math.cos(a) * k * 0.5 + 0.5) * innerWidth) + 'px,' + Math.max(hudH + 22, (-Math.sin(a) * k * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%)'; /* never up under the top bar */
  const dir = el.firstElementChild; if (dir && dir.tagName === 'I') dir.style.transform = 'rotate(' + (-a) + 'rad)'; return v; }
// ---------- finding the targets: a chip per target under the size bar, an arrow at the screen edge for each one still
// standing (bright once you're big enough to take it), and a minimap of the whole town you can tap to head somewhere ----------
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
// tap a target's chip up top: the storm heads for it (if it's big enough yet) and its arrow flashes
function goToPoi(k) { const P = pois[k]; if (state !== 'play' || !P || P.done) return; const ok = rankOf(sizeShown) >= POI[k].f; banner(ok ? '➤ ' + POI[k].icon + ' ' + POI[k].name : POI[k].icon + ' ' + POI[k].name + ' NEEDS F' + POI[k].f); if (ok) moveTo = new THREE.Vector3(P.center.x, 0, P.center.z);
  P.arrow.classList.remove('ping'); void P.arrow.offsetWidth; P.arrow.classList.add('ping'); }
function setupPoiHud() {
  poiOrder = Object.keys(pois).sort((a, b) => POI[a].f - POI[b].f || POI[a].pts - POI[b].pts);
  $('taPois').innerHTML = poiOrder.map((k) => '<span class="poiChip" id="poi_' + k + '"><em>' + POI[k].icon + '</em><b>F' + POI[k].f + '</b><i></i></span>').join('');
  for (const el of document.querySelectorAll('.poiArrow')) el.remove();
  for (const k of poiOrder) { const a = document.createElement('div'); a.className = 'poiArrow'; a.innerHTML = '<i>➤</i><em>' + POI[k].icon + '</em>'; document.body.appendChild(a); pois[k].arrow = a; pois[k].chip = $('poi_' + k); pois[k].chip.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); goToPoi(k); }); }
  addPoiMarks();
  const c = document.createElement('canvas'); c.width = cols * 4; c.height = rows * 4; const g = c.getContext('2d'); g.fillStyle = '#24403c'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#8fb0aa';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!maze[y][x]) g.fillRect(x * 4, y * 4, 4, 4); mapBase = c; mapT = 0;
}
const mapScale = (px) => (px / 2) / (Math.hypot(cols, rows) * CELL / 2); // the whole town fits inside the circle
function drawMini() {
  const dpr = Math.min(2, devicePixelRatio || 1), S = Math.round(mapEl.clientWidth * dpr) || 1; if (mapEl.width !== S) mapEl.width = mapEl.height = S;
  const g = mapCtx, k = mapScale(S), P2 = (x, z) => [S / 2 + k * (right.x * x + right.z * z), S / 2 - k * (upv.x * x + upv.z * z)];
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, 6.2832); g.clip();
  g.setTransform(k * right.x, -k * upv.x, k * right.z, -k * upv.z, S / 2, S / 2); if (mapBase) g.drawImage(mapBase, -cols * CELL / 2, -rows * CELL / 2, cols * CELL, rows * CELL);
  g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'center'; g.textBaseline = 'middle'; const rk = rankOf(sizeShown);
  for (const kk of poiOrder) { const P = pois[kk], [x, y] = P2(P.center.x, P.center.z);
    if (P.done) { g.font = 'bold ' + (13 * dpr) + 'px sans-serif'; g.fillStyle = '#7dff3a'; g.fillText('✓', x, y); }
    else { const ready = rk >= POI[kk].f; if (ready) { g.fillStyle = '#ffd24a66'; g.beginPath(); g.arc(x, y, 9 * dpr, 0, 6.2832); g.fill(); } g.globalAlpha = ready ? 1 : 0.6; g.font = (13 * dpr) + 'px sans-serif'; g.fillText(POI[kk].icon, x, y); g.globalAlpha = 1; } }
  for (const pl of planes) { if (pl.life <= 0) continue; const [x, y] = P2(pl.g.position.x, pl.g.position.z); g.fillStyle = '#9fd6ff'; g.font = 'bold ' + (12 * dpr) + 'px sans-serif'; g.fillText('✈', x, y); }
  foes.eachDot((p, icon, col) => { const [x, y] = P2(p.x, p.z); g.strokeStyle = col; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(x, y, 7 * dpr, 0, 6.2832); g.stroke(); g.fillStyle = col; g.font = (11 * dpr) + 'px sans-serif'; g.fillText(icon, x, y); });
  if (chaser) { const [x, y] = P2(chaser.g.position.x, chaser.g.position.z); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 2.5 * dpr, 0, 6.2832); g.fill(); }
  if (moveTo) { const [x, y] = P2(moveTo.x, moveTo.z); g.strokeStyle = '#ffd24a'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(x - 4 * dpr, y - 4 * dpr); g.lineTo(x + 4 * dpr, y + 4 * dpr); g.moveTo(x + 4 * dpr, y - 4 * dpr); g.lineTo(x - 4 * dpr, y + 4 * dpr); g.stroke(); }
  if (twObj) { const [x, y] = P2(twObj.position.x, twObj.position.z); g.fillStyle = '#ffffff'; g.strokeStyle = '#ff7a3a'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, Math.max(3, reach() * k), 0, 6.2832); g.fill(); g.stroke(); }
  g.restore();
}
mapEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (state !== 'play') return; const r = mapEl.getBoundingClientRect(), k = mapScale(r.width); const a = (e.clientX - r.left - r.width / 2) / k, b = -(e.clientY - r.top - r.height / 2) / k;
  const lim = toWorld(cols - 1, rows - 1, cols, rows); moveTo = new THREE.Vector3(Math.max(-lim.x, Math.min(lim.x, right.x * a + upv.x * b)), 0, Math.max(-lim.z, Math.min(lim.z, right.z * a + upv.z * b))); mapT = 0; });
function updateChaser(dt, px, pz, R) {
  if (!chaser) { if (radioDown) return; chaserT -= dt; if (chaserT <= 0) { chaserT = 32 + Math.random() * 14; spawnChaser(); } return; }
  const c = chaser, g = c.g, p = g.position, d = Math.hypot(p.x - px, p.z - pz), stormSpeed = 3.2 + sizeShown * 0.7;
  if (d < R + 1.1) { chasersCaught++; twisters.suck(g, tw, { onLand: (m) => { const at = m.position.clone().setY(0); blowChaser(m, at); award(200, at, 'KABOOM'); } }); g.userData.flash.visible = false; c.g = null; chaser.arrow.remove(); chaser.bar.remove(); chaser = null; award(800, p, 'CHASER CAUGHT'); grow(1.5); banner('📷 CHASER CAUGHT!'); sfx.boom(); return; }
  c.repath -= dt;
  if (c.mode === 'approach') { // drive in until close enough for a good picture
    if (d < 9 + sizeShown * 1.5 && d > R + 2.5) { c.mode = 'shoot'; c.path = []; }
    else if (c.repath <= 0) { c.repath = 1.2; c.path = roadPathTo(c.cell, px, pz, false); }
    followPath(c, stormSpeed * 0.9, dt);
  } else if (c.mode === 'shoot') { // parked, snapping away; bolts early if the storm comes right at it
    const want = Math.atan2(px - p.x, pz - p.z); let dr = want - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 3);
    c.shots += dt; c.flashT -= dt; if (c.flashT <= 0) { c.flashT = 0.35 + Math.random() * 0.3; g.userData.flash.material.opacity = 1; if (Math.random() < 0.5) popup(p, 'SNAP!', '#ffffff'); }
    if (c.shots >= 3 || d < R + 3.2) { c.mode = 'flee'; c.repath = 0; banner(c.shots >= 3 ? '📷 GOT THE SHOT! CATCH IT!' : '📷 CHASER BOLTING!'); }
  } else { // flee: race off along the streets, a touch faster than the storm
    // head for the road farthest from the storm and stick with it; only re-plan when the storm closes in or it arrives
    c.fleeT += dt; if (!c.path.length || (c.repath <= 0 && d < 7)) { c.repath = 2; let best = null, bd = -1; for (const rc of roadCells) { const w = toWorld(rc[0], rc[1], cols, rows); const dd = Math.hypot(w.x - px, w.z - pz) - Math.hypot(w.x - p.x, w.z - p.z) * 0.35; if (dd > bd) { bd = dd; best = rc; } } c.path = findPath(maze, { cx: c.cell[0], cy: c.cell[1] }, { cx: best[0], cy: best[1] }); }
    followPath(c, stormSpeed * 1.12, dt);
    if (c.fleeT > 4 && d > 26 + sizeShown * 4) { if (c.shots >= 1.5) { chasersLost++; extraSeeders++; banner('📷 IT GOT AWAY! +1 SEEDER'); seedT = Math.min(seedT, 2); } else banner('📷 CHASER LEFT'); removeChaser(); return; }
  }
  g.userData.flash.material.opacity = Math.max(0, g.userData.flash.material.opacity - dt * 6); g.userData.mast.rotation.y += dt * 4;
  const v = edgeArrow(c.arrow, p, true);
  if (v && c.mode === 'shoot') { c.bar.style.display = 'block'; c.bar.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight - 38) + 'px) translate(-50%,-50%)'; c.bar.firstChild.style.width = Math.min(100, c.shots / 3 * 100) + '%'; } else c.bar.style.display = 'none';
}
function clearPlanes() { foes.clear(); clearHunters(); setPlaneEngine(0); removeChaser(); chaserT = 25; extraSeeders = 0; chasersCaught = 0; chasersLost = 0; for (const pl of planes) { scene.remove(pl.g); scene.remove(pl.zone); pl.arrow.remove(); } planes = []; for (const s of sprayDrops) scene.remove(s.m); sprayDrops.length = 0; seedT = SEED().first; seededT = 0; }
function wreckBuilding(x, quiet = false, into = tw, how = undefined) { // how: for a building knocked apart with no storm (see tear() in tornado.js)
  free(x.obj); x.done = true; bDone++; { const i = city.obstacles.findIndex((o) => Math.abs(o.x - x.pos.x) < 0.3 && Math.abs(o.z - x.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); } const size3 = new THREE.Box3().setFromObject(x.obj).getSize(new THREE.Vector3()); const ex = x.obj === x.b ? (x.b.userData.extras || []).filter((m) => m.parent) : []; // its cornice, shopfront, whatever is on the roof: broken up along with it
  if (x.b.userData.edges) x.b.userData.edges.visible = false; twisters.tear(x.obj, x.pos, size3, into, [], ex, how); award(x.pts, x.pos); grow(x.h); sfx.crunch(x.h > 5); if (!quiet) sfx.boom();
  if (!quiet) jolt(Math.min(0.5, 0.12 + x.h * 0.05));
  if (x.h > 5 && !quiet) { fx.explode(new THREE.Vector3(x.pos.x, 1, x.pos.z), 1.4); flashT = 0.12; jolt(0.7); }
}
function wreckPoi(k) {
  const P = pois[k]; P.done = true; if (P.mark) { scene.remove(P.mark); P.mark = null; } const g = new THREE.Group(); g.position.copy(P.center); scene.add(g);
  for (const hz of P.hz) { live(hz); for (const part of hz.parts || []) if (part.parent) g.attach(part); const i = city.obstacles.findIndex((o) => Math.abs(o.x - hz.pos.x) < 0.3 && Math.abs(o.z - hz.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); }
  twisters.tear(g, P.center, new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()), tw, []); grow(6);
  award(POI[k].pts, P.center, POI[k].name); sfx.wave(); sfx.boom(); if (k !== 'water') fx.explode(new THREE.Vector3(P.center.x, 1, P.center.z), 2.2); flashT = 0.3; jolt(1); poiFx.play(k, P.center);
  { const chip = $('poi_' + k); if (chip) { chip.classList.remove('ready'); chip.classList.add('done', 'boom'); } if (P.arrow) P.arrow.style.display = 'none'; }
  const c = P.center, tint = (hex) => { for (const L of tw.layers) L.material.color.setHex(hex); };
  if (k === 'power') { banner('BLACKOUT!'); for (const [t, v] of [[0, 0.3], [0.16, 0.9], [0.34, 0.15], [0.55, 0.75], [0.8, 0.1], [1.05, 0.5]]) poiFx.after(t, () => lights(v)); poiFx.after(1.3, blackout); } // the town's lights stutter, then go out for good
  else if (k === 'water') { banner('WATERSPOUT!'); tint(0x4f9fe0); washAway(c, 9); }
  else if (k === 'fair') banner("THE FAIR'S OVER!");
  else if (k === 'cemetery') { banner('THE DEAD RISE!'); for (let i = 0; i < 10; i++) spawnWalker(c, true); } // zombies shamble straight at the storm
  else if (k === 'weather') { banner('RADAR DOWN! NO AIRCRAFT'); radarDown = true; for (const pl of planes) pl.life = 0; } // the planes can't find you any more
  else if (k === 'radio') { banner('OFF THE AIR! NO CHASERS'); radioDown = true; if (chaser) { chaser.shots = 0; chaser.mode = 'flee'; chaser.fleeT = 4; chaser.path = []; } }
  else if (k === 'firestation') { banner('NO FIRE CREWS! FIRES SPREAD'); fireBoost = true; buildings.filter((x) => !x.done && x.burnT == null).map((x) => [Math.hypot(x.pos.x - c.x, x.pos.z - c.z), x]).filter((e) => e[0] < 10).sort((a, b) => a[0] - b[0]).slice(0, 6).forEach((e) => ignite(e[1])); } // lightning fires get bigger, burn faster and jump between buildings
  else if (k === 'police') { banner('JAILBREAK!'); for (let i = 0; i < 12; i++) spawnWalker(c, false); }
  else if (k === 'sewage') { banner('STINK STORM!'); tint(0x8a6a32); stink = true; } // people gag on the smell and can barely run
  else if (k === 'nuclear') { banner('☢️ MELTDOWN!'); flashT = 1.2; sfx.boom(); setTimeout(() => sfx.boom(), 250); goNuke(c); } // a nuclear blast, then the Nukular Nado
}
let radarDown = false, radioDown = false, fireBoost = false, stink = false;
// the water station's wave: everyone and every car near it is swept off their feet and thrown clear
function washAway(c, r) { let n = 0;
  for (let i = people.length - 1; i >= 0; i--) { const q = people[i]; if (Math.hypot(q.position.x - c.x, q.position.z - c.z) > r) continue; people.splice(i, 1); delete q.updateMatrixWorld; twisters.scatter([q], c, 6); peopleN++; award(25, q.position, n++ % 5 ? '' : 'WASHED AWAY'); grow(0.12); }
  for (let i = drivers.length - 1; i >= 0; i--) { const o = drivers[i], q = o.g.position; if (Math.hypot(q.x - c.x, q.z - c.z) > r) continue; drivers.splice(i, 1); free(o.g); twisters.scatter([o.g], c, 6); carsN++; award(60, q); } }

// ---------- the nuclear plant goes up: a mushroom cloud and a shockwave that flattens everything in a wide ring (any
// height), then the storm turns into the NUKULAR NADO for a few seconds: bigger, glowing bright yellow, and it wrecks
// anything it touches ----------
const NUKE_R = 22, NUKULAR_SECS = 30; const blasts = []; let nukeT = 0, nukeSave = null, nukeHalo = null, nukeTold = false;
function goNuke(c) {
  const at = new THREE.Vector3(c.x, 0, c.z); let done = 0;
  blasts.push(nukeBlast(scene, at, NUKE_R, { kind: 'nuke', secs: 1.8, onRadius: (r) => { if (r - done < 1.2) return; done = r;
    for (const x of buildings) if (!x.done && Math.hypot(x.pos.x - at.x, x.pos.z - at.z) < r) wreckBuilding(x, true);
    for (let i = people.length - 1; i >= 0; i--) { const q = people[i]; if (Math.hypot(q.position.x - at.x, q.position.z - at.z) < r) { people.splice(i, 1); scene.remove(q); fx.puff('flame', q.position.clone().setY(0.3), 0.4); peopleN++; award(25, q.position); grow(0.12); } }
    for (let i = drivers.length - 1; i >= 0; i--) { const q = drivers[i].g.position; if (Math.hypot(q.x - at.x, q.z - at.z) < r) { const o = drivers[i]; drivers.splice(i, 1); blowCar(o.g, q.clone()); } }
    for (let i = cars.length - 1; i >= 0; i--) { const q = cars[i].getWorldPosition(new THREE.Vector3()); if (Math.hypot(q.x - at.x, q.z - at.z) < r) { const o = cars[i]; cars.splice(i, 1); blowCar(o, q); } } } }));
  const rid = roundId; setTimeout(() => { if (state === 'play' && rid === roundId) goNukular(); }, 900);
}
function goNukular() {
  nukeT = NUKULAR_SECS; nukeTold = false; banner('☢️ NUKULAR NADO!'); boostT = Math.max(boostT, NUKULAR_SECS); sfx.whoosh(); sfx.power();
  if (!nukeSave) nukeSave = tw.layers.map((L) => [L.material.color.getHex(), L.material.opacity]); for (const L of tw.layers) { L.material.color.setHex(0xffe600); L.material.opacity = Math.max(0.75, L.material.opacity); }
  if (!nukeHalo) { nukeHalo = new THREE.Mesh(new THREE.CylinderGeometry(tw.r1 * 1.3, tw.r0 * 2, tw.H, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe21a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); nukeHalo.position.y = tw.H / 2; tw.g.add(nukeHalo); }
}
function updateNuke(dt) {
  for (let i = blasts.length - 1; i >= 0; i--) if (!blasts[i].update(dt)) blasts.splice(i, 1);
  if (nukeT <= 0) return; nukeT -= dt; const k = Math.sin(played * 14) * 0.5 + 0.5;
  if (nukeHalo) { nukeHalo.material.opacity = 0.22 + 0.2 * k; nukeHalo.rotation.y += dt * 3; } for (const L of tw.layers) L.material.color.setHex(k > 0.5 ? 0xffe600 : 0xfff27a); if (nukeT < NUKULAR_SECS - 2.5 && !nukeTold) { nukeTold = true; banner('☢️ NUKULAR NADO!'); }
  if (Math.random() < dt * 20) fx.puff('flame', twObj.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * reach() * 2, 0.4 + Math.random() * 3, (Math.random() - 0.5) * reach() * 2)), 0.6);
  if (nukeT <= 0) { nukeT = 0; if (nukeSave) tw.layers.forEach((L, i) => { L.material.color.setHex(nukeSave[i][0]); L.material.opacity = nukeSave[i][1]; }); nukeSave = null; if (nukeHalo) { tw.g.remove(nukeHalo); nukeHalo = null; } banner('NUKULAR OVER'); }
}
function spawnWalker(c, zombie) {
  const ch = zombie ? makeCharacter(['worker', 'suit', 'hoodie', 'plaid'][(Math.random() * 4) | 0], { zombie: true }) : makeCharacter('worker', { skin: { outfit: { shirt: 0xff7a1a, pants: 0xff7a1a, tie: null } } });
  const a = Math.random() * 6.28, r = reach() + 1.5 + Math.random() * 2.5; ch.scale.setScalar(0.25); ch.position.set(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r); collidePerson(ch);
  Object.assign(ch.userData, { home: ch.position.clone(), goal: null, wait: Math.random(), zombie, convict: !zombie }); scene.add(ch); people.push(ch);
}
function lights(v) { for (const x of buildings) for (const m of x.b.userData.fade || []) if (m.emissiveIntensity != null) { if (m.userData.glow0 == null) m.userData.glow0 = m.emissiveIntensity; m.emissiveIntensity = m.userData.glow0 * v; } setBakedGlow(v); } // every lit window in town, to a share of its usual brightness
function blackout() {
  hemi.intensity *= 0.55; sun.intensity *= 0.6;
  for (const x of buildings) for (const m of x.b.userData.fade || []) if (m.emissiveIntensity != null) m.emissiveIntensity = 0.04; setBakedGlow(0.04);
  city.group.traverse((m) => { const mt = m.material; if (mt && !Array.isArray(mt) && mt.isMeshBasicMaterial && mt.color && mt.color.getHex() === 0xf6e94a) mt.color.setHex(0x22232a); });
}

// ---------- input: drag anywhere for a stick (touch on the canvas, mouse), or keys ----------
const stick = { id: null, cx: 0, cy: 0, x: 0, y: 0 }; const stickEl = $('taStick'), knobEl = $('taKnob'); const keys = {};
function sDown(id, x, y) { if (stick.id !== null || state !== 'play') return; stick.id = id; stick.cx = x; stick.cy = y; stick.x = stick.y = 0; stick.t0 = performance.now(); stick.moved = 0; stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.style.display = 'none'; knobEl.style.transform = 'translate(-50%,-50%)'; }
function sMove(id, x, y) { if (id !== stick.id) return; const dx = x - stick.cx, dy = y - stick.cy, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 55); stick.moved = Math.max(stick.moved, d); if (stick.moved < 10) return; stickEl.style.display = 'block'; moveTo = null; stick.x = dx / d * m / 55; stick.y = dy / d * m / 55; knobEl.style.transform = 'translate(calc(-50% + ' + stick.x * 36 + 'px), calc(-50% + ' + stick.y * 36 + 'px))'; }
function sUp(id, x, y) { if (id !== stick.id) return; const tap = stick.moved < 10 && performance.now() - stick.t0 < 300; stick.id = null; stick.x = stick.y = 0; stickEl.style.display = 'none'; if (tap && x != null && state === 'play') tapAt(stick.cx, stick.cy); }
// ---------- tap to move: the storm heads for the spot, and a bolt of lightning lands there first and sets it alight ----------
let moveTo = null, zapCd = 0; const zapRay = new THREE.Raycaster(), zapPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function tapAt(cx, cy) {
  const vc = viewCam(); vc.updateMatrixWorld(); zapRay.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), vc); const p = new THREE.Vector3(); if (!zapRay.ray.intersectPlane(zapPlane, p)) return;
  const lim = toWorld(cols - 1, rows - 1, cols, rows); p.x = Math.max(-lim.x, Math.min(lim.x, p.x)); p.z = Math.max(-lim.z, Math.min(lim.z, p.z));
  // a tap on a seeding plane or the storm chaser zaps it instead of moving the storm
  const near = (pos, px) => { const v = pos.clone().project(vc); return v.z < 1 && Math.hypot((v.x * 0.5 + 0.5) * innerWidth - cx, (-v.y * 0.5 + 0.5) * innerHeight - cy) < px; };
  if (zapCd <= 0) { const f = foes.tap(near); if (f) { zapCd = 0.45; if (f.isVector3) moveTo = f; return; } } // one of the bigger enemies: struck (and, for a twister small enough to swallow, chased)
  if (zapCd <= 0) { for (const pl of planes) if (pl.life > 0 && !pl.crash && near(pl.g.position, 56)) { zapCd = 0.45; zapPlane2(pl); return; }
    if (chaser && near(chaser.g.position.clone().setY(0.6), 52)) { zapCd = 0.45; zapChaser(); return; } }
  moveTo = p.clone();
  if (zapCd <= 0) { zapCd = 0.45; strike(p); }
}
// SPACE (computers): a bolt aimed ahead of the storm. Only targets inside a cone in front of it (the way it's heading,
// up to 60 degrees either side) and in range count, by priority: a seeding plane, the storm chaser, a tank, a soldier,
// a townsperson, then a building. Nothing there? The bolt hits the ground just ahead. The storm doesn't move.
let stormHead = 0, stormPrev = null; // which way the storm is heading (radians, like rotation.y), from how it has been moving
function trackHeading() { if (!twObj) return; const P = twObj.position; if (stormPrev) { const dx = P.x - stormPrev.x, dz = P.z - stormPrev.z; if (Math.hypot(dx, dz) > 0.004) { const want = Math.atan2(dx, dz); let d = want - stormHead; d = Math.atan2(Math.sin(d), Math.cos(d)); stormHead += d * 0.25; } } stormPrev = P.clone(); }
function zapKey() {
  if (state !== 'play' || !twObj || zapCd > 0) return; const P = twObj.position, range = 13 + sizeShown * 2.5, half = Math.PI / 3, fx0 = Math.sin(stormHead), fz0 = Math.cos(stormHead);
  const inCone = (q) => { const dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz); if (d > range) return Infinity; if (d < 1.2) return d; return Math.acos(Math.max(-1, Math.min(1, (dx * fx0 + dz * fz0) / d))) <= half ? d : Infinity; };
  const nearest = (list, posOf) => { let best = null, bd = Infinity; for (const o of list) { const q = posOf(o); if (!q) continue; const d = inCone(q); if (d < bd) { bd = d; best = o; } } return best; };
  zapCd = 0.45;
  const pl = nearest(planes, (o) => (o.life > 0 && !o.crash ? o.g.position : null)); if (pl) { zapPlane2(pl); return; } /* planes already on their way down are left alone */
  { const ft = nearest(foes.targets(), (o) => o.pos); if (ft) { ft.zap(); return; } }
  if (chaser && inCone(chaser.g.position) < Infinity) { zapChaser(); return; }
  const tk = nearest(tanks, (o) => o.g.position); if (tk) { strike(tk.g.position.clone().setY(0)); return; }
  const so = nearest(soldiers, (o) => o.position); if (so) { strike(so.position.clone().setY(0)); return; }
  const pe = nearest(people, (o) => (o.userData.burnT > 0 ? null : o.position)); if (pe) { strike(pe.position.clone().setY(0)); return; }
  const bu = nearest(buildings, (o) => (o.done || o.burnT != null ? null : o.pos)); if (bu) { strike(new THREE.Vector3(bu.pos.x, 0, bu.pos.z)); return; }
  const d = 3 + sizeShown * 1.6, lim = toWorld(cols - 1, rows - 1, cols, rows); strike(new THREE.Vector3(Math.max(-lim.x, Math.min(lim.x, P.x + fx0 * d)), 0, Math.max(-lim.z, Math.min(lim.z, P.z + fz0 * d))));
}
// the storm throws a bolt at p (which can be in the air): out of its cloud, in its skin's lightning colours
function boltTo(p) { const c = twisters.strikeAt(tw, p); flashT = Math.max(flashT, 0.12); sfx.boom(); fx.zap(p, c || 0x9fd0ff); }
function zapPlane2(pl) { // struck by lightning: it loses control, comes down in flames and crashes
  if (pl.crash) return; boltTo(pl.g.position.clone()); fx.explode(pl.g.position.clone(), 0.6);
  pl.crash = { t: 0, vy: 0.4, roll: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3), sm: 0 }; pl.spraying = false; pl.zone.visible = false; pl.arrow.style.display = 'none';
  popup(pl.g.position, 'HIT!', '#ffd24a'); banner('✈ PLANE HIT!'); award(250, pl.g.position); sfx.whoosh();
}
// A crashing plane, in two parts. In the air: it spins down along the way it was flying, on fire. On the ground: it blows
// up, and what's left ploughs on in the same line, wrecking every building in the way, flinging people, cars and the army
// about, setting the neighbours alight and leaving a burnt furrow of fires behind it.
function crashPlane(pl, i, dt) { const g = pl.g, C = pl.crash, S = SEED(); C.t += dt;
  if (!C.down) { C.vy += 11 * dt; const sp = S.speed * (1.25 + C.t * 0.5); pl.heading += C.roll * 0.04 * dt; g.position.x += Math.sin(pl.heading) * sp * dt; g.position.z += Math.cos(pl.heading) * sp * dt; g.position.y -= C.vy * dt;
    g.rotation.set(0, pl.heading, 0); g.rotateX(Math.min(0.9, C.t * 0.7)); g.rotateZ(C.t * C.roll); for (const p of g.userData.props || []) p.rotation.z += dt * 15;
    C.sm -= dt; if (C.sm <= 0) { C.sm = 0.035; fx.puff('flame', g.position, 0.9); fx.puff('smoke', g.position, 0.9); if (Math.random() < 0.4) fx.sparks(g.position, 2, { speed: 2, up: 0, life: 0.5 }); }
    if (g.position.y > 0.5) return;
    // it hits: a big blast, and the airframe breaks up, its pieces thrown on ahead
    const at = g.position.clone().setY(0), dir = new THREE.Vector3(Math.sin(pl.heading), 0, Math.cos(pl.heading)); C.down = true; C.pos = at; C.dir = dir; C.left = 7 + Math.random() * 4; C.v = S.speed * 2.2; C.acc = 1;
    fx.explode(at.clone().setY(0.6), 2.2); fx.scorch(at, 2.2, 26); jolt(1); flashT = Math.max(flashT, 0.3); sfx.boom(); setTimeout(() => sfx.boom(), 180); banner('💥 PLANE DOWN!'); award(500, at, 'PLANE DOWN'); grow(2);
    twisters.tear(g, at, new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()), null, [], [], { collapse: true, now: true, power: 1.2, push: dir.clone().multiplyScalar(7).setY(3) }); return; }
  const lim = toWorld(cols - 1, rows - 1, cols, rows), step = C.v * dt; C.pos.addScaledVector(C.dir, step); C.left -= step; C.acc += step; C.v = Math.max(4, C.v - 9 * dt);
  const p = C.pos, out = Math.abs(p.x) > lim.x || Math.abs(p.z) > lim.z; fx.puff('flame', { x: p.x, y: 0.3, z: p.z }, 1.3); if (Math.random() < 0.5) fx.dust(p, 1.1); jolt(0.25);
  if (C.acc >= 0.9 && !out) { C.acc = 0; fx.ignite(new THREE.Vector3(p.x + (Math.random() - 0.5) * 0.8, 0.1, p.z + (Math.random() - 0.5) * 0.8), 0.7 + Math.random() * 0.5, 7 + Math.random() * 6); fx.scorch(p, 1.1 + Math.random() * 0.5, 28); if (Math.random() < 0.45) fx.explode(new THREE.Vector3(p.x, 0.4, p.z), 0.7); crashDamage(p, 1.7, C.dir); }
  if (C.left <= 0 || out) { if (!out) fx.explode(new THREE.Vector3(p.x, 0.5, p.z), 1.5); scene.remove(pl.zone); pl.arrow.remove(); planes.splice(i, 1); }
}
function crashDamage(p, r, dir) { const from = p.clone().addScaledVector(dir, -2);
  for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < r + 1.15) { wreckBuilding(x, true, null, { collapse: true, from, power: 1.5 }); sfx.crunch(x.h > 5); } else if (d < r + 3.2 && x.burnT == null && Math.random() < 0.3) ignite(x); } // what it hits is smashed; what's next door catches fire
  for (let i = people.length - 1; i >= 0; i--) { const c = people[i]; if (Math.hypot(c.position.x - p.x, c.position.z - p.z) < r) { people.splice(i, 1); delete c.updateMatrixWorld; twisters.scatter([c], from, 6); peopleN++; award(25, c.position); } }
  for (let i = tanks.length - 1; i >= 0; i--) { const t = tanks[i], q = t.g.position; if (Math.hypot(q.x - p.x, q.z - p.z) < r + 0.4) { tanks.splice(i, 1); free(t.g); twisters.scatter([t.g], from, 5); fx.explode(q.clone().setY(0.6), 1); award(200, q, 'TANK'); } }
  for (let i = soldiers.length - 1; i >= 0; i--) { const s = soldiers[i]; if (Math.hypot(s.position.x - p.x, s.position.z - p.z) < r) { soldiers.splice(i, 1); delete s.updateMatrixWorld; twisters.scatter([s], from, 6); award(40, s.position, 'SOLDIER'); } }
  if (city.knock(p.x, p.z, r, dir.x, dir.z)) freeKnocked();
}
function blowChaser(g, p) { // the chaser's truck goes up: a fireball, burning wreckage thrown about, a fire where it stood, the buildings beside it alight
  fx.explode(p.clone().setY(0.6), 1.7); fx.ignite(new THREE.Vector3(p.x, 0.15, p.z), 0.9, 8); fx.scorch(p, 1.8, 24); jolt(0.7); flashT = Math.max(flashT, 0.2); sfx.boom(); setTimeout(() => sfx.boom(), 140);
  twisters.tear(g, p, new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()), null, [], [], { collapse: true, now: true, power: 1.5, push: new THREE.Vector3(0, 3, 0) });
  for (const x of buildings) if (!x.done && x.burnT == null && Math.hypot(x.pos.x - p.x, x.pos.z - p.z) < 2.6 && Math.random() < 0.5) ignite(x); }
function zapChaser() { // struck by lightning: it blows up where it stands
  const c = chaser, g = c.g, p = g.position.clone(); boltTo(p.clone().setY(0.9)); chasersCaught++; g.userData.flash.visible = false; c.g = null; c.arrow.remove(); c.bar.remove(); chaser = null;
  blowChaser(g, p); award(500, p, 'CHASER DESTROYED'); grow(1); banner('📷 CHASER DESTROYED!'); }
function strike(p) {
  boltTo(p.clone().setY(0.05));
  // tanks it lands on blow up, soldiers are flung
  for (let i = tanks.length - 1; i >= 0; i--) { const t = tanks[i], q = t.g.position; if (Math.hypot(q.x - p.x, q.z - p.z) < 2) { tanks.splice(i, 1); free(t.g); twisters.scatter([t.g], q.clone(), 4); fx.explode(q.clone().setY(0.6), 1); award(200, q, 'TANK'); grow(1); } }
  for (let i = soldiers.length - 1; i >= 0; i--) { const s = soldiers[i]; if (Math.hypot(s.position.x - p.x, s.position.z - p.z) < 1.8) { soldiers.splice(i, 1); delete s.updateMatrixWorld; twisters.scatter([s], p, 5); award(40, s.position, 'SOLDIER'); grow(0.15); } }
  // cars in the blast blow up; people catch fire and run about in a panic
  for (let i = drivers.length - 1; i >= 0; i--) { const o = drivers[i], q = o.g.position; if (Math.hypot(q.x - p.x, q.z - p.z) < 1.8) { drivers.splice(i, 1); blowCar(o.g, q.clone()); } }
  for (let i = cars.length - 1; i >= 0; i--) { const q = cars[i].getWorldPosition(new THREE.Vector3()); if (Math.hypot(q.x - p.x, q.z - p.z) < 1.8) { const c = cars[i]; cars.splice(i, 1); blowCar(c, q); } }
  for (const c of people) { const u = c.userData; if (!(u.burnT > 0) && Math.hypot(c.position.x - p.x, c.position.z - p.z) < 1.8) { u.burnT = 5 + Math.random() * 2; u.ph = 0; award(30, c.position, 'ON FIRE'); } }
  // whatever it hits catches fire: buildings burn down on their own, people scatter
  let lit = 0; for (const x2 of buildings) { if (x2.done || x2.burnT != null) continue; if (Math.hypot(x2.pos.x - p.x, x2.pos.z - p.z) < (fireBoost ? 3.6 : 2.4)) { ignite(x2); lit++; } }
  if (lit) popup(p, lit > 1 ? 'FIRE x' + lit : 'FIRE!', '#ff9a3a'); else fx.ignite(p.clone().setY(0.1), 0.6, 4);
}
function ignite(x) { x.burnT = fireBoost ? 4 + Math.random() * 2 : 7 + Math.random() * 3; fx.ignite(new THREE.Vector3(x.pos.x, Math.min(x.h, 2.5), x.pos.z), 0.9 + Math.min(1.2, x.h * 0.15), x.burnT + 2); }
function blowCar(g, q) { free(g); twisters.scatter([g], q, 6); fx.explode(q.clone().setY(0.4), 1); fx.ignite(q.clone().setY(0.2), 0.7, 6); carsN++; award(80, q, 'BOOM'); }
const sinking = [];
function updateZaps(dt) {
  zapCd -= dt;
  // burning buildings collapse when the fire's done with them (half points, half growth)
  for (const x of buildings) { if (x.done || x.burnT == null) continue; x.burnT -= dt; if (x.burnT > 0) continue; free(x.obj); x.done = true; bDone++; { const i = city.obstacles.findIndex((o) => Math.abs(o.x - x.pos.x) < 0.3 && Math.abs(o.z - x.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); }
    if (x.b.userData.edges) x.b.userData.edges.visible = false; const loose = x.obj === x.b ? (x.b.userData.extras || []).filter((m) => m.parent && ((!m.userData.merged && !(m.userData.deco && m.userData.owner)) || ((m.visible = false), false))).map((m) => (free(m), m)) : []; twisters.scatter(loose, x.pos, 2); sinking.push({ obj: x.obj, t: 0, h: x.h, y0: x.obj.position.y }); award(Math.round(x.pts * 0.5), x.pos, 'BURNED'); grow(x.h * 0.5); fx.puff('smoke', new THREE.Vector3(x.pos.x, 1, x.pos.z), 1.6);
    if (fireBoost && Math.random() < 0.7) { let nb = null, nd = 3.4; for (const y of buildings) { if (y.done || y.burnT != null) continue; const d = Math.hypot(y.pos.x - x.pos.x, y.pos.z - x.pos.z); if (d < nd) { nd = d; nb = y; } } if (nb) { ignite(nb); popup(nb.pos, 'FIRE SPREADS!', '#ff9a3a'); } } }
  for (let i = sinking.length - 1; i >= 0; i--) { const s = sinking[i]; s.t = Math.min(1, s.t + dt * 0.6); s.obj.rotation.z = s.t * 0.5; s.obj.position.y = s.y0 - s.t * s.h * 0.85; if (s.t >= 1) { s.obj.visible = false; sinking.splice(i, 1); } }
}
// zoom: pinch with two fingers, the mouse wheel, or the +/- buttons; remembered
const ZOOM_MIN = 0.55, ZOOM_MAX = 1.6;
let zoom = 1; try { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +localStorage.getItem('ta_zoom') || 1)); } catch { /* ignore */ }
function setZoom(z) { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); try { localStorage.setItem('ta_zoom', String(zoom)); } catch { /* ignore */ } }
let pinch = 0; const pinchD = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
canvas.addEventListener('touchstart', (e) => { if (e.touches.length >= 2) { sUp(stick.id); pinch = pinchD(e.touches); return; } for (const t of e.changedTouches) sDown('t' + t.identifier, t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchmove', (e) => { if (e.touches.length >= 2 && pinch > 0) { const d = pinchD(e.touches); if (d > 0) setZoom(zoom * pinch / d); pinch = d; if (e.cancelable) e.preventDefault(); return; } for (const t of e.changedTouches) sMove('t' + t.identifier, t.clientX, t.clientY); if (state === 'play' && e.cancelable) e.preventDefault(); }, { passive: false });
addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = 0; });
addEventListener('wheel', (e) => { if (e.target !== canvas || state !== 'play') return; e.preventDefault(); setZoom(zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false }); // only over the game, never over menus (the skin list scrolls)
for (const [id, k] of [['taZoomIn', 0.85], ['taZoomOut', 1.18]]) document.getElementById(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); setZoom(zoom * k); });
const tUp = (e) => { for (const t of e.changedTouches) sUp('t' + t.identifier, t.clientX, t.clientY); }; addEventListener('touchend', tUp); addEventListener('touchcancel', tUp);
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') sDown(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') sMove(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') sUp(e.pointerId, e.clientX, e.clientY); });
addEventListener('keydown', (e) => { if (e.key === ' ') e.preventDefault(); keys[e.key.toLowerCase()] = true; if (e.key === 'Escape' || e.key === 'p') togglePause(); else if (e.key === ' ' && !e.repeat) zapKey(); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// ---------- flow ----------
let state = 'start', roundId = 0; // roundId: delayed effects from an earlier round check it and stand down
// ---------- YOUR TORNADO: the storm you play as. Default and the Poonado are free; the rest come from prizes and the shop ----------
// the storms on the menu are live: each card shows its storm turning, and throwing whatever it throws (livePreview.js)
const twPV = createPreviews({ perFrame: 4, cam: [0, 6.4, 25], look: [0, 5.7, 0], fov: 32 }), twPVT = createTwisters(twPV.scene), twLive = new Map(); twPV.onTick = (dt, n) => { if (n) twPVT.update(dt); };
function twThumb(key, cv, slot = 'card') { const id = slot + ':' + (key || 'default'); // one storm per card, built when the card is first seen, then kept
  twPV.add(cv, () => { let s = twLive.get(id); if (!s) twLive.set(id, (s = twPVT.make(true, [], key))); return s; }, null, (v, s) => { s.userData.twister.asleep = !v; }); }
const twName = (k) => (k ? TWISTER_SKINS[k].name : 'Classic Twister'), twDesc = (k) => (k ? TWISTER_SKINS[k].desc : 'Free! The classic grey funnel with blue-white lightning.');
function drawTwPicker() { const cur = equippedTornado(); $('twChosenName').textContent = twName(cur).toUpperCase(); $('twChosenDesc').textContent = twDesc(cur); twPV.clear(); twThumb(cur, $('twChosenCv'), 'chosen');
  if ($('twPickScr').classList.contains('hidden')) return; const owned = getOwned(), all = [null, ...Object.keys(TWISTER_SKINS)], mine = (k) => !k || owned.includes('tornado:' + k);
  $('twPickInfo').textContent = all.filter(mine).length + ' of ' + all.length + ' storms are yours. Win more in TOTAL DESTRUCTION and the prize games, or buy them in the skin shop.';
  const box = $('twPick'); box.innerHTML = '';
  for (const k of [...all.filter(mine), ...all.filter((x) => !mine(x))]) { const open = mine(k), b = document.createElement('button'); b.className = 'kjCard' + (k === cur ? ' on' : '') + (open ? '' : ' locked'); const S = k ? TWISTER_SKINS[k] : null;
    b.innerHTML = '<canvas width="150" height="150"></canvas><b>' + twName(k) + '</b>' + (open ? '' : '<span>' + (S.bonus ? '🏆 bonus' : '🪙 ' + S.price + ' in the shop') + '</span>'); twThumb(k, b.querySelector('canvas'));
    b.addEventListener('click', () => { if (!open) { $('twPickInfo').textContent = S.bonus ? twName(k) + ': ' + S.bonus + ' to unlock it.' : twName(k) + ' costs ' + S.price + ' coins in the skin shop. You can also win it in the prize games.'; for (const c of box.children) c.classList.remove('want'); b.classList.add('want'); return; } equip('tornado', k ? 'tornado:' + k : null); drawTwPicker(); }); box.appendChild(b); } } // a locked storm still shows, turning, in full colour: tapping it says how to get it

$('twChoose').addEventListener('click', () => { $('taStart').classList.add('hidden'); $('twPickScr').classList.remove('hidden'); $('twPickScr').scrollTop = 0; drawTwPicker(); });
$('twPickDone').addEventListener('click', () => { $('twPickScr').classList.add('hidden'); $('taStart').classList.remove('hidden'); drawTwPicker(); });
drawTwPicker();
soundToggle($('taStart'), $('taPaused')); skipSongBtn($('ta')); eraPicker($('taLevels'), () => { level = unlocked(); drawLevels(); }); seasonPicker($('eraRow')); // sound on/off on the start and pause screens
// the soundtrack starts on the first tap and keeps rotating songs for as long as you're on Tornado Alley
gameMusic($('taPaused'), SONGS_TORNADO); radioButton($('taPaused'), $('taPaused').querySelector('.menuBtn'));
const fsMode = initFullscreen(() => state === 'play'); // full screen on play, back in after a browser drop-out, no page scrolling mid-round
function start() {
  fsMode.play();
  coachClear(); saveLast('ta', level); crowd.clear();
  if (state !== 'start' || roundN > 0) roundN++; ROUND = L().time; unlockAudio(); buildWorld(); makeStorm(); trip = 0; tripAt.copy(twObj.position); score = 0; totalD = 0; chain = 0; lastHit = -9; tLeft = ROUND; played = 0; boostT = 0; lastRank = 0; moveTo = null; sinking.length = 0; peopleN = carsN = propsN = bDone = 0; clearPlanes();
  radarDown = radioDown = fireBoost = stink = false; setupPoiHud();
  for (const s of ['taStart', 'taEnd', 'taPaused', 'taPrize', 'twPickScr']) $(s).classList.add('hidden'); $('ta').classList.remove('hidden');
  state = 'play'; playSongs(); setStormLevel(0); sfx.whoosh(); banner('LEVEL ' + level + ': ' + L().name.toUpperCase()); setTimeout(() => { if (state === 'play') banner(SEASON_NAME[seasonFor()].toUpperCase()); }, 2300);
  renderer.compile(scene, viewCam()); // compile every material in the new town now, not mid-play
  $('taLevel').textContent = 'L' + level + ' · ' + L().name; measureHud(); for (const k in hudCache) delete hudCache[k]; rankShown = -1;
  setTimeout(() => { if (state === 'play') banner('TAKE OUT ' + (L().need >= poiOrder.length ? 'ALL ' + poiOrder.length : L().need) + ' TARGETS'); }, 4600);
}
// a new storm skin from the pause menu: the same storm, same size and place, in its new look
function swapStorm() { if (!twObj) return; if (nukeT > 0) { banner('NOT WHILE NUKULAR!'); return false; } const pos = twObj.position.clone(), sc = twObj.scale.x; twisters.remove(twObj);
  twObj = twisters.make(true, stormJunk(), equippedTornado()); twObj.position.copy(pos); twObj.scale.setScalar(sc); twObj.visible = true; scene.add(twObj); tw = twObj.userData.twister; tw.layers.forEach((L) => { L.userData.op0 = L.material.opacity; }); }
const drawPauseSkins = () => pauseSkinRow($('taPaused'), '🌪️', 'tornado', Object.keys(TWISTER_SKINS).map((k) => ['tornado:' + k, TWISTER_SKINS[k].name]), swapStorm);
function togglePause() { if (state === 'play') { state = 'paused'; drawPauseSkins(); setPlaneEngine(0); stopMusic(); $('taPaused').classList.remove('hidden'); } else if (state === 'paused') { state = 'play'; $('taPaused').classList.add('hidden'); playSongs(); setStormLevel(rankOf(sizeShown)); } }
// TOTAL DESTRUCTION: every building and every big target gone before the clock runs out. Points for every second left,
// an extra prize go, and a free skin at the end
let totalD = 0;
function totalWipe(at) { totalD = 5000 + Math.round(tLeft) * 250; score += totalD; banner('💥 TOTAL DESTRUCTION! 💥'); popup(at.clone().setY(4), '+' + totalD + ' TIME BONUS', '#ffd24a'); sfx.boom(); setTimeout(() => sfx.boom(), 300); flashT = 0.5; }
// the round's over: the storm winds down and fades away in the town (about 3 s), then the prizes and the score
let outroT = 0;
function finish() { if (state !== 'play') return; state = 'outro'; outroT = 0; foes.clear(); stopMusic(); setPlaneEngine(0); sUp(stick.id); clearTips(); moveTo = null;
  banner('THE DESTRUCTION HAS ENDED!'); sfx.whoosh(); setTimeout(() => sfx.boom(), 350); setTimeout(() => sfx.whoosh(), 1200);
  if (tw) tw.layers.forEach((Lr) => { Lr.userData.opOut = Lr.material.opacity; }); }
function outroTick(dt) { outroT += dt; const k = Math.min(1, outroT / 2.6), e = Math.pow(1 - k, 1.6);
  if (twObj) { twObj.scale.setScalar(S0 * sizeShown * (0.15 + 0.85 * e)); twObj.position.y = k * 2; for (const Lr of tw.layers) Lr.material.opacity = (Lr.userData.opOut ?? Lr.material.opacity) * e;
    if (Math.random() < dt * 20 * (1 - k)) fx.puff('smoke', twObj.position.clone().setY(0.4 + Math.random() * 3), 0.6 + sizeShown * 0.3); }
  if (outroT >= 3.1) { state = 'over'; if (twObj) twObj.visible = false; finishNow(); } }
function finishNow() {
  state = 'over'; stopMusic(); setPlaneEngine(0); sUp(stick.id); clearTips(); const done = poiOrder.filter((k) => pois[k].done); for (const k of poiOrder) if (pois[k].arrow) pois[k].arrow.style.display = 'none';
  let best = 0; const bk = bestKey('ta', level); try { best = +localStorage.getItem(bk) || 0; if (score > best) { best = score; localStorage.setItem(bk, String(score)); } } catch { /* ignore */ }
  const pct = Math.round((bDone / totalB) * 100); const need = Math.min(L().need, poiOrder.length); const cleared = pct >= L().goal && done.length >= need;
  const scoreCoins = Math.floor(score / 10000) / 100; if (scoreCoins > 0) addCoins(scoreCoins); // one coin per million points
  if (cleared && level < LEVELS.length && unlocked() <= level) { try { localStorage.setItem(levelKey('ta'), String(level + 1)); } catch { /* ignore */ } }
  $('taEndTitle').innerHTML = cleared ? (level >= 5 ? L().name.toUpperCase().replace('THE ', '') + '<br>FLATTENED' : 'LEVEL ' + level + '<br>CLEARED') : "STORM'S<br>OVER";
  $('taAgain').textContent = cleared && level < LEVELS.length ? 'NEXT LEVEL' : cleared ? 'PLAY AGAIN' : 'TRY AGAIN';
  $('taAgain').dataset.next = cleared && level < LEVELS.length ? '1' : '';
  $('taGoalLine').textContent = cleared ? (level < LEVELS.length ? 'Level ' + (level + 1) + ' unlocked: ' + LEVELS[level].name + '.' : 'You flattened every town. Legend.') : 'Flatten ' + L().goal + '% of ' + L().name + ' and take out ' + (need >= poiOrder.length ? 'every big target' : need + ' big targets') + ' to clear it (you got ' + pct + '% and ' + done.length + ').';
  if (cleared && level >= 5 && grantSkin('tornado:acid')) { equip('tornado', 'tornado:acid'); const u = document.createElement('div'); u.className = 'bonusSkin'; u.innerHTML = '🏆 BONUS SKIN UNLOCKED: <b>ACID STORM</b><br><small>Acid rain, green lightning and baby tornadoes. It\'s on now; change it in the skin shop.</small>'; $('taGoalLine').appendChild(u); }
  if (totalD) { $('taEndTitle').innerHTML = 'TOTAL<br>DESTRUCTION!'; totalReward(Object.keys(TWISTER_SKINS).filter((k) => !TWISTER_SKINS[k].bonus).map((k) => 'tornado:' + k), (id) => TWISTER_SKINS[id.split(':')[1]].name, $('taGoalLine')); }
  if (cleared && level < LEVELS.length) level++; saveLast('ta', level); /* the next town is open and picked right away, wherever you go from here (change monster, the shop, NEXT LEVEL) */
  drawLevels(); /* and the start screen shows the new best score without a reload */
  $('taStats').innerHTML = [...(totalD ? [['💥 Total destruction', '+' + totalD]] : []), ['Buildings', bDone + ' / ' + totalB + ' (' + pct + '%)'], ['People swept up', peopleN], ['Cars thrown', carsN], ['Storm chasers', chasersCaught + ' destroyed, ' + chasersLost + ' got away'], ['Big targets', done.length + ' / ' + poiOrder.length + ' ' + done.map((k) => POI[k].icon).join('')], ['Peak size', 'F' + rankOf(size) + ' (' + size.toFixed(1) + 'x)'], ['Score', score], ['Score coins', '+' + scoreCoins + ' 🪙'], ['Best', best]].map(([a, b]) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>').join('');
  showPrizes($('taChests'), Math.min(3, 1 + (cleared ? 1 : 0) + Math.floor(done.length / 2)) + (totalD ? 1 : 0), '1 go, +1 for clearing the level, +1 for every 2 big targets destroyed (max 3), +1 for TOTAL DESTRUCTION', () => { location.href = 'store.html?from=alley'; }, null, () => { $('taPrize').classList.add('hidden'); $('taEnd').classList.remove('hidden'); });
  $('ta').classList.add('hidden'); $('taPrize').classList.remove('hidden'); // the prize game first, then the score
}
const HOWTO = [
  ['🌪️', 'Steer', 'Drag anywhere to steer. Tap a spot to zap it with lightning and send the storm there. On a computer, SPACE zaps the nearest plane, chaser, tank, soldier, person or building.'],
  ['🏚️', 'Grow', 'Wreck buildings, cars and people to grow from F0 to F5. Tall towers need a bigger storm.'],
  ['🎯', 'Big targets', 'The big targets are the mission. Each one wears a badge in town, with an arrow to it at the edge of the screen: dim while you are too small for it, bright gold once you are big enough. Follow the arrow, or tap its icon up top to head there.'],
  ['✈️', 'Seeding planes', 'Planes hunt you and their spray shrinks you. Dodge the blue ring under them, or tap a plane to strike it with lightning: it comes down in flames and takes a strip of town with it. You will hear their engines coming.'],
  ['📷', 'Storm chasers', 'Chasers race in to photograph you. Tap one to blow it up with lightning, or run it down: your storm hurls it away and it explodes where it lands. If one gets away with its pictures, another plane joins the hunt.'],
  ['🌪️', 'Rogue twister', 'From the Suburbs on, a second storm turns up and eats your town. Its tag shows who is bigger. Green: run into it and swallow it for a big bonus. Red: keep away, and tap it to strike it down to size.'],
  ['📢', 'Storm cannon', 'From Downtown on, a horn truck guards a big target. It charges, then blasts along the orange line, knocking you back. Step off the line, then tap it twice (once if it is charging) or run it over.'],
  ['🚁', 'Gunships', 'From Metro on, helicopters circle you and fire freeze rockets that slow you down. Keep moving and tap each one to strike it out of the sky. Wreck the weather station and no aircraft can find you.'],
  ['🛸', 'UFO', 'In Megacity and The Sprawl a saucer hunts you with a shrink ray: get out of its circle. Lightning slides off its shield, so wait until it drops low to beam people up, then tap it. Three strikes and it crashes.'],
  ['🏆', 'Clear the town', 'Flatten the goal % and take out enough targets before time runs out to unlock the next town.'],
];
$('taHow').addEventListener('click', () => showHowTo(HOWTO));
// building a town takes a moment: put the loading screen up first, then do the work once it has been drawn
function loadThen(fn) { if (window.__bootTip) window.__bootTip(); document.body.classList.add('booting'); requestAnimationFrame(() => requestAnimationFrame(() => { try { fn(); } finally { document.body.classList.remove('booting'); } })); }
const playNow = () => { fsMode.play(); unlockAudio(); loadThen(start); }; // full screen and sound have to be asked for in the tap itself
$('taPlay').addEventListener('click', playNow); // straight in: the cards are there if you ask (HOW TO PLAY), and the round itself shows a new player each thing as it comes up
$('taAgain').addEventListener('click', playNow);
function drawLevels() { const box = $('taLevels'); box.innerHTML = ''; const un = unlocked(); LEVELS.forEach((lv, i) => { const b = document.createElement('button'); const n = i + 1; let best = 0; try { best = +localStorage.getItem(bestKey('ta', n)) || 0; } catch { /* ignore */ }
  b.className = 'lvl' + (n === level ? ' on' : ''); b.disabled = n > un; b.innerHTML = '<b>' + (n > un ? '🔒' : n) + '</b><span>' + lv.name + '</span>' + (best ? '<i>' + best + '</i>' : ''); b.addEventListener('click', () => { level = n; drawLevels(); }); box.appendChild(b); }); }
level = unlocked(); if (import.meta.env.DEV) { const q = +new URLSearchParams(location.search).get('level'); if (q >= 1 && q <= LEVELS.length) level = q; } drawLevels();
$('taPause').addEventListener('click', togglePause); $('taResume').addEventListener('click', togglePause);
// restart the level from the pause screen; the first tap asks, a second tap within 3 seconds does it
{ const rb = $('taRestart'); let armT = 0; const reset = () => { armT = 0; rb.textContent = '↺ RESTART LEVEL'; rb.classList.remove('armed'); };
  rb.addEventListener('click', () => { if (!armT || performance.now() - armT > 3000) { armT = performance.now(); rb.textContent = '↺ SURE? TAP AGAIN TO RESTART'; rb.classList.add('armed'); setTimeout(() => { if (armT && performance.now() - armT >= 2900) reset(); }, 3000); return; }
    reset(); $('taPaused').classList.add('hidden'); playNow(); }); }


// ---------- the bigger enemies (foes.js): a rogue twister, the storm cannon, gunships and a UFO ----------
function rivalWreck(x, into) { // a building the rogue twister takes: gone, but not yours (no points, no growth), and it stops counting toward the town
  free(x.obj); x.done = true; totalB = Math.max(1, totalB - 1); { const i = city.obstacles.findIndex((o) => Math.abs(o.x - x.pos.x) < 0.3 && Math.abs(o.z - x.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); }
  const size3 = new THREE.Box3().setFromObject(x.obj).getSize(new THREE.Vector3()), ex = x.obj === x.b ? (x.b.userData.extras || []).filter((m) => m.parent) : []; if (x.b.userData.edges) x.b.userData.edges.visible = false;
  twisters.tear(x.obj, x.pos, size3, into, [], ex); sfx.crunch(x.h > 5); }
const foes = createFoes({ scene, fx, twisters, S0, MAX_S, maxH, rankOf, popup, banner, award, grow, jolt, boltTo, edgeArrow, toScreen, rivalWreck, crashDamage, coach, coachSeen, flash: (v) => { flashT = Math.max(flashT, v); },
  get twObj() { return twObj; }, get tw() { return tw; }, get size() { return sizeShown; }, get level() { return level; }, get played() { return played; }, get cols() { return cols; }, get massTarget() { return massTarget; },
  get buildings() { return buildings; }, get people() { return people; }, get roadCells() { return roadCells; }, get pois() { return pois; }, get poiOrder() { return poiOrder; }, get radarDown() { return radarDown; } });

// ---------- what the storm's skin throws out, where it lands (tornado.js throws them: see `toss` in TWISTER_SKINS) ----------
let tossSfx = 0; const hunters = [];
function stormToss(kind, p, who, vel) {
  if (who !== tw || state !== 'play') return false; const at = new THREE.Vector3(p.x, 0, p.z), near = toScreen(at).on;
  const hit = (r, label) => { let n = 0; // people there are knocked flying, cars go up, street furniture goes over
    for (let i = people.length - 1; i >= 0; i--) { const c = people[i]; if (c.userData.zombie || Math.hypot(c.position.x - p.x, c.position.z - p.z) > r) continue; people.splice(i, 1); delete c.updateMatrixWorld; twisters.scatter([c], at, 5); peopleN++; award(25, c.position, n++ ? '' : label); grow(0.12); }
    for (let i = drivers.length - 1; i >= 0; i--) { const q = drivers[i].g.position; if (Math.hypot(q.x - p.x, q.z - p.z) < r) { const d = drivers[i]; drivers.splice(i, 1); blowCar(d.g, q.clone()); } }
    if (city.knock(p.x, p.z, r, 0, 0)) freeKnocked(); return n; };
  const light = (r) => { let nb = null, nd = r; for (const x of buildings) { if (x.done || x.burnT != null) continue; const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < nd) { nd = d; nb = x; } } if (nb) ignite(nb); };
  const up = (y) => at.clone().setY(y), splat = (cols, soft = true, n = 16) => fx.spray(up(0.2), n, { soft, a: 0.95, c: cols, speed: 4, up: [2, 6], life: 0.9, size: soft ? 0.5 : 0.22, grav: 13, shape: soft ? 1 : 3, stretch: soft ? 0 : 3 });
  const thud = () => { if (near && played - tossSfx > 0.25) { tossSfx = played; sfx.hit(); } };
  switch (kind) {
    case 'firework': if (near && played - tossSfx > 0.3) { tossSfx = played; sfx.firework(); } return true;
    case 'shark': hit(1.3, 'CHOMP!'); splat([0xffffff, 0x4fa8ff], false, 22); fx.pool(at, 1.1, 0x2a6a9a, 6, 0.5); thud(); break;
    case 'pumpkin': hit(1.2, 'SPLAT!'); fx.explode(up(0.3), 0.7); splat([0xffb02a, 0xf07a1a]); light(1.9); break;
    case 'fireball': fx.explode(up(0.3), 0.8); fx.ignite(up(0.1), 0.7, 5); light(2.1); hit(1, 'TOAST!'); break;
    case 'ice': hit(1.5, 'ICED!'); splat([0xffffff, 0xbfe6ff], false, 26); for (let i = 0; i < 4; i++) fx.dust(at, 1.3, 0, 0, 0xe8f6ff); for (let i = 0; i < 8; i++) fx.bit(up(0.4), 1.3, 0xcfeaff, 6); jolt(0.2); if (near) sfx.crunch(); break;
    case 'egg': hit(1.1, 'EGGED!'); fx.spray(up(0.3), 20, { c: [0xff9ad8, 0x9ad8ff, 0xfff09a, 0xb4f0dc, 0xd8b4ff], pick: true, speed: 4, up: [2, 6], life: 1, size: 0.16, grav: 10, stretch: 1.6 }); thud(); break;
    case 'poo': hit(1.2, 'EW!'); splat([0x7a5a2a, 0x4a3018]); fx.pool(at, 1, 0x4a3612, 10, 0.65); thud(); break;
    case 'drum': hit(1.4, 'MELTED!'); splat([0xd8ff6a, 0x3aff3a], false, 24); fx.pool(at, 1.4, 0x3a8a1a, 10, 0.6); fx.glow(at, 2.4, 0x7dff3a, 0.6, 0.6); thud(); break;
    case 'pie': hit(1.2, 'PIED!'); splat([0xffffff, 0xffd0e0]); fx.pool(at, 0.9, 0xf4ece0, 8, 0.6); if (near && played - tossSfx > 0.6) { tossSfx = played; sfx.honk(); } break;
    case 'chicken': hit(1, 'SQUAWK!'); splat([0xfff09a, 0xf4d43a], true, 10); thud(); break;
    case 'chair': hit(1.2, 'BONK!'); for (let i = 0; i < 8; i++) fx.bit(up(0.3), 1, 0x7a5a3a, 5); fx.dust(at, 1); thud(); break;
    case 'cube': hit(1.1, 'DELETED'); fx.sparks(up(0.3), 18, { c: [0xffffff, 0x3af0ff], speed: 6, up: 5 }); fx.glow(at, 2, 0x3af0ff, 0.4, 0.7); thud(); break;
    case 'star': hit(1, 'ZAP!'); fx.sparks(up(0.3), 16, { c: [0xffffff, 0x7ab8ff], speed: 6, up: 5 }); fx.glow(at, 2.2, 0xffb05a, 0.4, 0.7); break;
    case 'error': hit(1.2, ['ERROR', '404', 'NaN', 'CRASH'][(Math.random() * 4) | 0]); for (const c of [0xff2a4a, 0x2aff6a, 0x2a6aff]) fx.sparks(up(0.3), 7, { c: [0xffffff, c], speed: 6, up: 5 }); thud(); break;
    case 'meteor': { fx.explode(up(0.4), 1.3); fx.scorch(at, 1.6, 22); jolt(0.5); if (near) sfx.boom(); hit(1.6, 'SMASH!'); light(2.4); // the building under it is flattened (it counts as yours)
      const from = at.clone().addScaledVector(new THREE.Vector3(vel.x, 0, vel.z).normalize(), -2); let nb = null, nd = 1.9; for (const x of buildings) { if (x.done || x.h > maxH(sizeShown)) continue; const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < nd) { nd = d; nb = x; } } if (nb) wreckBuilding(nb, true, null, { collapse: true, from, power: 1.4 }); break; }
    case 'mallow': { splat([0xffffff, 0xffe8f0]); fx.pool(at, 1.5, 0xf4ece0, 9, 0.7); let n = 0; for (const c of people) if (!c.userData.zombie && Math.hypot(c.position.x - p.x, c.position.z - p.z) < 2.2) { c.userData.stuck = played + 7; n++; } if (n) popup(at, 'STUCK!', '#ffe8f0'); thud(); break; }
    case 'ghost': { fx.glow(at, 3, 0x7dffb0, 0.8, 0.7); fx.spray(up(0.4), 14, { c: [0xffffff, 0x7dffb0], speed: 2, up: [1, 4], life: 1, size: 0.5, grav: -1, shape: 0, stretch: 0 }); let n = 0; for (const c of people) if (!c.userData.zombie && Math.hypot(c.position.x - p.x, c.position.z - p.z) < 3) { c.userData.lure = played + 8; n++; } if (n) popup(at, 'POSSESSED!', '#b8ffd8'); if (near && played - tossSfx > 1.5) { tossSfx = played; sfx.ghost(); } break; }
    case 'zombie': { for (let i = 0; i < 3; i++) fx.dust(at, 1.1, 0, 0, 0x6a7a4a); if (hunters.length < 12) spawnHunter(at); thud(); break; }
    default: return false;
  }
  return true;
}
// Zombienado: the dead it drops go after the living. A bite turns the victim, who hunts too (a dozen at most)
function spawnHunter(at) { const z = makeCharacter(['worker', 'suit', 'hoodie', 'plaid'][(Math.random() * 4) | 0], { zombie: true }); z.scale.setScalar(0.25); z.position.set(at.x, 0, at.z); collidePerson(z); scene.add(z); hunters.push({ c: z, prey: null, pickT: 0, life: 26 }); }
function updateHunters(dt, px, pz, R) {
  for (let i = hunters.length - 1; i >= 0; i--) { const h = hunters[i], c = h.c, P = c.position; h.life -= dt; h.pickT -= dt;
    if (Math.hypot(P.x - px, P.z - pz) < R + 0.35) { hunters.splice(i, 1); twisters.suck(c, tw); award(40, P, 'ZOMBIE'); grow(0.12); continue; } // the storm takes its own back
    if (h.life <= 0) { hunters.splice(i, 1); Object.assign(c.userData, { home: P.clone(), goal: null, wait: 0 }); people.push(c); continue; } // it loses interest: an ordinary zombie now
    if (h.pickT <= 0 || (h.prey && !people.includes(h.prey))) { h.pickT = 0.6; h.prey = null; let bd = 11; for (const q of people) { if (q.userData.zombie || q.userData.burnT > 0) continue; const d = Math.hypot(q.position.x - P.x, q.position.z - P.z); if (d < bd) { bd = d; h.prey = q; } } }
    if (!h.prey) { animateWalk(c, dt, 0); continue; }
    const q = h.prey.position, dx = q.x - P.x, dz = q.z - P.z, d = Math.hypot(dx, dz) || 0.01;
    if (d < 0.4) { const j = people.indexOf(h.prey); if (j >= 0) people.splice(j, 1); scene.remove(h.prey); award(30, q, 'BITTEN'); peopleN++; fx.sparks(new THREE.Vector3(q.x, 0.4, q.z), 6, { c: [0xff4a3a, 0x7a1a14], speed: 3, up: 3, life: 0.4 }); if (hunters.length < 12) spawnHunter(q); h.prey = null; h.pickT = 0; continue; }
    P.x += dx / d * 2.1 * dt; P.z += dz / d * 2.1 * dt; c.rotation.y = Math.atan2(dx, dz); animateWalk(c, dt, 1.6); collidePerson(c); }
}
function clearHunters() { for (const h of hunters) scene.remove(h.c); hunters.length = 0; }

// ---------- update ----------
const right = new THREE.Vector3(), upv = new THREE.Vector3(), tmp = new THREE.Vector3(); let frameN = 0;
const hudCache = {}; const setT = (id, v) => { v = String(v); if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }; let rankShown = -1;
function update(dt) {
  played += dt; tLeft -= dt; if (tLeft <= 0) { tLeft = 0; finish(); return; }
  coachTA(); if (played > 24) tip('ta_map', '🗺️ Tap the minimap to head across town.');
  // steering, in screen space mapped onto the ground
  let sx = stick.x + ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0), sy = stick.y + ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0);
  const vc = viewCam(); vc.updateMatrixWorld(); right.setFromMatrixColumn(vc.matrixWorld, 0).setY(0).normalize(); upv.setFromMatrixColumn(vc.matrixWorld, 1).setY(0).normalize();
  const mag = Math.min(1, Math.hypot(sx, sy)); boostT -= dt; const speed = (3.2 + sizeShown * 0.7) * (boostT > 0 ? 1.7 : 1) * foes.slow; // freeze rockets slow it
  { const r = rankOf(sizeShown); if (r > lastRank) { lastRank = r; boostT = 3; stormBoost(3); banner('F' + r + '! SPEED BOOST'); sfx.whoosh(); sfx.power(); for (let i = 0; i < 6; i++) fx.puff('smoke', new THREE.Vector3(twObj.position.x + (Math.random() - 0.5) * 3, 0.4, twObj.position.z + (Math.random() - 0.5) * 3), 1.2); } }
  if (mag > 0.05) moveTo = null;
  if (mag <= 0.05 && moveTo) { const dx = moveTo.x - twObj.position.x, dz = moveTo.z - twObj.position.z, dl = Math.hypot(dx, dz); if (dl < 0.5) moveTo = null; else { tmp.set(dx / dl, 0, dz / dl); twObj.position.addScaledVector(tmp, Math.min(dl, speed * dt)); if (third) { let dd = Math.atan2(tmp.x, tmp.z) - camYaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); camYaw += dd * Math.min(1, dt * 1.6); } } }
  if (mag > 0.05) { tmp.copy(right).multiplyScalar(sx).addScaledVector(upv, -sy).normalize(); twObj.position.addScaledVector(tmp, speed * mag * dt);
    if (third) { let dd = Math.atan2(tmp.x, tmp.z) - camYaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); camYaw += dd * Math.min(1, dt * 1.6) * mag; } }
  else if (!moveTo) { twObj.position.x += Math.sin(played * 0.9) * dt * 0.6; twObj.position.z += Math.cos(played * 0.7) * dt * 0.6; } // a tornado never sits still
  const lim = toWorld(cols - 1, rows - 1, cols, rows); twObj.position.x = Math.max(-lim.x, Math.min(lim.x, twObj.position.x)); twObj.position.z = Math.max(-lim.z, Math.min(lim.z, twObj.position.z));
  updateNuke(dt); trackHeading();
  sizeShown += ((nukeT > 0 ? size * 1.35 : size) - sizeShown) * Math.min(1, dt * 1.5); twObj.scale.setScalar(S0 * sizeShown);
  const px = twObj.position.x, pz = twObj.position.z, R = reach();
  if (Math.random() < dt * 8) fx.puff('smoke', new THREE.Vector3(px + (Math.random() - 0.5) * R * 2, 0.3, pz + (Math.random() - 0.5) * R * 2), 0.6 + sizeShown * 0.3);
  // buildings
  tooBigT -= dt;
  for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - px, x.pos.z - pz); if (d > R + 1.15) continue;
    if (x.h <= maxH(sizeShown) || nukeT > 0) wreckBuilding(x);
    else { free(x.obj); x.obj.rotation.z = Math.sin(played * 40) * 0.02; if (tooBigT <= 0) { tooBigT = 2; popup(x.pos, 'TOO BIG - GROW!', '#ff7a5a'); tip('ta_toobig', '🏢 Too tall for now. Wreck smaller stuff first to grow.'); } } }
  // targets
  for (const k of poiOrder) { const P = pois[k]; if (P.done || !P.hz.length) continue; if (Math.hypot(P.center.x - px, P.center.z - pz) > R + P.reach) continue;
    if (rankOf(sizeShown) >= POI[k].f) wreckPoi(k); else if (tooBigT <= 0) { tooBigT = 2; popup(P.center, 'NEED F' + POI[k].f + '!', '#ff7a5a'); } }
  // people flee, then get swept up
  frameN++;
  for (let i = people.length - 1; i >= 0; i--) { const c = people[i], u = c.userData; u.panic = false; const dx = c.position.x - px, dz = c.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
    if (u.frz && (d <= 34 || u.burnT > 0)) { u.frz = false; delete c.updateMatrixWorld; }
    if (d < R + 0.35) { people.splice(i, 1); twisters.suck(c, tw); peopleN++; award(u.zombie ? 40 : u.convict ? 50 : 25, c.position, u.zombie ? 'ZOMBIE' : u.convict ? 'CONVICT' : ''); grow(0.12); continue; }
    if (u.burnT > 0) { u.burnT -= dt; u.ph -= dt; if (u.ph <= 0) { u.ph = 0.3 + Math.random() * 0.4; u.dir = Math.random() * 6.28; } c.position.y = 0; c.position.x += Math.sin(u.dir) * 2.6 * dt; c.position.z += Math.cos(u.dir) * 2.6 * dt; c.rotation.y = u.dir; animateWalk(c, dt, 1.8); collidePerson(c);
      if (Math.random() < dt * 14) fx.puff('flame', new THREE.Vector3(c.position.x, 0.25, c.position.z), 0.32); u.goal = null; if (u.burnT <= 0) u.home = c.position.clone(); continue; }
    const pull = R * 2.6; if (d < pull) { const k = 1 - d / pull; const sp = (2.8 * k - 1.2 * (1 - k)) * dt; c.position.x -= dx / d * sp; c.position.z -= dz / d * sp; c.position.y = k * k * 0.6; c.rotation.y += dt * 8 * k; animateWalk(c, dt, 1.5); collidePerson(c); u.goal = null; }
    else if (d < (9 + sizeShown * 2) * (tw.skin && tw.skin.stealth ? 0.45 : 1) || u.lure > played) { const lured = u.lure > played, sp = (u.zombie ? -0.9 : lured ? -1.5 : u.stuck > played ? 0.12 : stink ? 0.55 : 1.7) * dt; u.panic = !u.zombie && !stink && !lured; /* possessed (Ghostnado): they walk into the storm. Stuck (Mallownado): they barely move. The Void: nobody sees it until it is close */ if (u.panic && Math.random() < dt * 0.05) popup(c.position, SHOUTS[(Math.random() * SHOUTS.length) | 0], '#ffffff'); c.position.y = 0; c.position.x += dx / d * sp; c.position.z += dz / d * sp; c.rotation.y = Math.atan2(dx, dz) + (u.zombie || lured ? Math.PI : 0); animateWalk(c, dt, 1.3); collidePerson(c); u.goal = null; }
    else if (d > 34) { if (!u.frz) { u.frz = true; c.updateMatrixWorld(true); c.updateMatrixWorld = noop; } } // out of sight: hold still, matrices frozen
    else if ((i + frameN) & 1) { /* every other frame */ } else { const dw = dt * 2; u.wait -= dw; if (!u.goal && u.wait <= 0) { u.goal = new THREE.Vector3(u.home.x + (Math.random() - 0.5) * 2, 0, u.home.z + (Math.random() - 0.5) * 2); }
      if (u.goal) { const gx = u.goal.x - c.position.x, gz = u.goal.z - c.position.z, gl = Math.hypot(gx, gz); if (gl < 0.1) { u.goal = null; u.wait = 1 + Math.random() * 3; animateWalk(c, dw, 0); } else { c.position.x += gx / gl * 0.6 * dw; c.position.z += gz / gl * 0.6 * dw; c.rotation.y = Math.atan2(gx, gz); animateWalk(c, dw, 0.5); } } else animateWalk(c, dw, 0); } }
  // cars and street props
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; const wp = c.getWorldPosition(tmp); if (Math.hypot(wp.x - px, wp.z - pz) < R + 0.7) { cars.splice(i, 1); twisters.suck(c, tw); carsN++; award(60, wp); grow(0.4); sfx.hit(); } }
  if (city.knock(px, pz, R, 0, 0)) { propsN++; award(8, twObj.position); freeKnocked(); }
  // traffic: cruise the streets, flee the storm, get thrown
  for (let i = drivers.length - 1; i >= 0; i--) { const o = drivers[i], p = o.g.position, d = Math.hypot(p.x - px, p.z - pz);
    if (d < R + 0.7) { drivers.splice(i, 1); twisters.suck(o.g, tw); carsN++; award(60, p); grow(0.4); sfx.hit(); continue; }
    if (!o.path.length) o.path = roadPathTo(o.cell, d < 14 ? px : p.x + (Math.random() - 0.5) * 30, d < 14 ? pz : p.z + (Math.random() - 0.5) * 30, d < 14); followPath(o, o.speed * (d < 14 ? 1.5 : 1), dt); }
  // soldiers hold their ground and shoot at the storm, backing off when it gets close
  for (let i = soldiers.length - 1; i >= 0; i--) { const s = soldiers[i], dx = s.position.x - px, dz = s.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
    if (d > 30) { if (!s.userData.frz) { s.userData.frz = true; s.updateMatrixWorld(true); s.updateMatrixWorld = noop; } continue; } if (s.userData.frz) { s.userData.frz = false; delete s.updateMatrixWorld; }
    if (d < R + 0.35) { soldiers.splice(i, 1); twisters.suck(s, tw); award(40, s.position, 'SOLDIER'); grow(0.15); continue; }
    if (d < 18) { s.rotation.y = Math.atan2(-dx, -dz); s.userData.cd -= dt; if (d < 5 + sizeShown) { s.position.x += dx / d * 1.4 * dt; s.position.z += dz / d * 1.4 * dt; animateWalk(s, dt, 1); } else animateWalk(s, dt, 0); s.userData.armR.rotation.x = -1.45; s.userData.armL.rotation.x = -1.3;
      if (s.userData.cd <= 0) { s.userData.cd = 0.35 + Math.random() * 0.6; fireAt(s.position.clone().setY(0.45).addScaledVector(new THREE.Vector3(-dx / d, 0, -dz / d), 0.3), false); } } else animateWalk(s, dt, 0); }
  // tanks roll in along the streets and shell it
  for (let i = tanks.length - 1; i >= 0; i--) { const t = tanks[i], p = t.g.position, d = Math.hypot(p.x - px, p.z - pz);
    if (d < R + 0.8 && rankOf(sizeShown) >= 2) { tanks.splice(i, 1); twisters.suck(t.g, tw); award(200, p, 'TANK'); grow(1); sfx.boom(); continue; }
    t.repath -= dt; if (t.repath <= 0) { t.repath = 2; t.path = d > 9 ? roadPathTo(t.cell, px, pz, false) : d < 5 ? roadPathTo(t.cell, px, pz, true) : []; } followPath(t, 1.8, dt);
    const tur = t.g.userData.turret; const want = Math.atan2(px - p.x, pz - p.z) - t.g.rotation.y; tur.rotation.y += (Math.atan2(Math.sin(want - tur.rotation.y), Math.cos(want - tur.rotation.y))) * Math.min(1, dt * 4);
    t.cd -= dt; if (d < 20 && t.cd <= 0) { t.cd = 2 + Math.random() * 1.5; const muzzle = new THREE.Vector3(0, 0.64, 1.25).applyMatrix4(tur.matrixWorld); fireAt(muzzle, true); } }
  for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.life -= dt; if (s.big && !s.laser) s.vel.y -= 2 * dt; s.m.position.addScaledVector(s.vel, dt); if (s.life <= 0) { if (s.big) fx.explode(s.m.position.clone(), 0.5); else fx.puff('smoke', s.m.position.clone(), 0.25); scene.remove(s.m); shots.splice(i, 1); } }
  for (const bb of twisters.babies) { if (bb.reach < 0.25) continue; const bp = bb.g.position, br = bb.reach;
    for (let i = people.length - 1; i >= 0; i--) { const c = people[i]; if (Math.hypot(c.position.x - bp.x, c.position.z - bp.z) < br + 0.3) { people.splice(i, 1); twisters.suck(c, bb.tw); peopleN++; award(25, c.position); grow(0.12); } }
    for (let i = drivers.length - 1; i >= 0; i--) { const p = drivers[i].g.position; if (Math.hypot(p.x - bp.x, p.z - bp.z) < br + 0.6) { twisters.suck(drivers[i].g, bb.tw); drivers.splice(i, 1); carsN++; award(60, p); grow(0.4); } }
    for (let i = cars.length - 1; i >= 0; i--) { const wp = cars[i].getWorldPosition(tmp); if (Math.hypot(wp.x - bp.x, wp.z - bp.z) < br + 0.6) { twisters.suck(cars[i], bb.tw); cars.splice(i, 1); carsN++; award(60, wp); grow(0.4); } }
    if (city.knock(bp.x, bp.z, br, 0, 0)) { propsN++; freeKnocked(); }
    for (const x of buildings) if (!x.done && x.h <= 2.2 && Math.hypot(x.pos.x - bp.x, x.pos.z - bp.z) < br + 0.9) wreckBuilding(x, true, bb.tw); }
  updatePlanes(dt, px, pz, R); updateChaser(dt, px, pz, R); updateZaps(dt); foes.update(dt, px, pz, R); updateHunters(dt, px, pz, R);
  // HUD
  const m = Math.floor(tLeft / 60), s = Math.floor(tLeft % 60);
  setT('taTime', m + ':' + String(s).padStart(2, '0')); if (hudCache.red !== (tLeft < 15)) { hudCache.red = tLeft < 15; $('taTime').style.color = tLeft < 15 ? '#ff5a3a' : ''; }
  setT('taScore', score); setT('taCombo', mult() > 1 && played - lastHit < 2.5 ? 'x' + mult() + ' COMBO' : '');
  setT('taRank', 'F' + rankOf(sizeShown)); setStormLevel(rankOf(sizeShown)); { const pct = Math.round((bDone / totalB) * 100); setT('taPct', '🏚️ ' + pct + '% / ' + L().goal + '%'); if (hudCache.pctOk !== (pct >= L().goal)) { hudCache.pctOk = pct >= L().goal; $('taPct').classList.toggle('ok', pct >= L().goal); } }
  { const w = ((sizeShown - 1) / (MAX_S - 1) * 100).toFixed(1) + '%'; if (hudCache.grow !== w) { hudCache.grow = w; $('taGrowFill').style.width = w; } const r = rankOf(sizeShown); if (r !== rankShown) { if (rankShown >= 0 && r > rankShown) { const b = $('taRank'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } rankShown = r; document.querySelectorAll('#taGrow .tick').forEach((t, i) => t.classList.toggle('got', i < r)); } }
  if (Math.round((bDone / totalB) * 100) >= 100 && poiOrder.every((k) => pois[k].done)) { /* as soon as the HUD reads 100% (it rounds, so a stray building or two can't hold the round open) */ if (!totalD) totalWipe(twObj.position); tLeft = Math.min(tLeft, 1.5); }
  crowdLists[0][0] = people; crowdLists[1][0] = soldiers; crowd.sync(crowdLists, px, pz, 7 + R);
  // target tray, edge arrows and the minimap
  { const rk = rankOf(sizeShown); let n = 0; for (const k of poiOrder) { const P = pois[k]; if (P.done) { n++; continue; } const ready = rk >= POI[k].f; if (P.chip) P.chip.classList.toggle('ready', ready); P.arrow.classList.toggle('ready', ready); edgeArrow(P.arrow, P.center, true); if (P.mark) tickPoiMark(P.mark, ready); } // too small for it yet: its badge and arrow stay, but dim and grey
    const need = Math.min(L().need, poiOrder.length); setT('taTargets', n + '/' + need); if (hudCache.tgtOk !== (n >= need)) { hudCache.tgtOk = n >= need; $('taTargets').classList.toggle('ok', n >= need); } }
  mapT -= dt; if (mapT <= 0) { mapT = 0.08; drawMini(); }
}

function resize() { renderer.setSize(innerWidth, innerHeight, false); cam3.aspect = innerWidth / innerHeight; cam3.updateProjectionMatrix(); }
function setView(t) { third = t; document.getElementById('taView').textContent = third ? '3RD' : 'ISO'; try { localStorage.setItem('ta_view', third ? '3rd' : 'iso'); } catch { /* ignore */ } if (third && twObj) { cam3.position.set(twObj.position.x - Math.sin(camYaw) * 12, 7, twObj.position.z - Math.cos(camYaw) * 12); } }
document.getElementById('taView').addEventListener('pointerdown', (e) => { e.stopPropagation(); setView(!third); }); setView(third);
addEventListener('resize', resize); resize();
const camTarget = new THREE.Vector3(); let last = performance.now(), pausedShown = false;
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  { const pz = state === 'paused'; if (pz !== pausedShown) { pausedShown = pz; document.body.classList.toggle('paused', pz); } } // the tags and arrows that float over the town step aside for the pause menu
  const hold = coachFrame(state === 'play'); if (hold) $('taBanner').style.opacity = 0; // a first-time prompt is up: the round waits for the player
  if (state === 'play') { if (!hold) update(dt); } else if (state === 'outro') outroTick(dt);
  if (city) { twisters.update(dt); fx.update(dt); poiFx.update(dt); city.updateRain(dt); }
  bannerT -= dt; if (bannerT <= 0) $('taBanner').style.opacity = 0;
  flashT = Math.max(0, flashT - dt); flashEl.style.opacity = Math.min(0.75, flashT * 3);
  // camera: iso, following the storm and pulling back as it grows
  const a = innerWidth / innerHeight, s = twObj ? sizeShown : 1, view = 6.5 + s * 2.6 + Math.max(0, s - 1.4) * 3.2, half = (a < 1 ? view / a * 0.8 : view) * zoom; // the same as ever up to F1, then it pulls back faster with each F level (over a third more in view at F5)
  cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
  if (twObj) camTarget.lerp(tmp.set(twObj.position.x, 1.2 * s, twObj.position.z), Math.min(1, dt * 3)); cam.position.copy(camTarget).addScaledVector(isoDir, CAM_D); cam.lookAt(camTarget);
  if (shake > 0) { shake = Math.max(0, shake - dt * 2.2); const k = shake * shake * 0.55 * Math.min(2, half / 14); cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k; }
  if (third && twObj) { const fx = Math.sin(camYaw), fz = Math.cos(camYaw), back = (6 + s * 7.5) * zoom, up = (2.5 + s * 4.5) * zoom; const want = tmp.set(twObj.position.x - fx * back, up, twObj.position.z - fz * back); cam3.position.lerp(want, Math.min(1, dt * 2.5)); cam3.lookAt(twObj.position.x + fx * 5, 1.4 * s, twObj.position.z + fz * 5); }
  if (CINE && twObj) { const a = 0.5 + played * 0.05, d = 9 + s * 8, P = twObj.position; cam3.position.set(P.x + Math.cos(a) * d, 1.6 + s * 1.6, P.z + Math.sin(a) * d); cam3.lookAt(P.x, 2.6 * s, P.z); }
  { const wide = Math.max(0, half - (a < 1 ? 10.14 / a * 0.8 : 10.14)) * 1.1; scene.fog.near = third ? 24 : CAM_D - 20 + wide; scene.fog.far = third ? 72 : CAM_D + 40 + wide; } // the haze keeps its distance as the view widens
  updatePops(dt);
  cullChunks(); perfTick(); renderer.render(scene, viewCam());
}
// QUICK PLAY on the main menu comes in with ?quick: no title screen, straight into the town you left off in with the
// storm you last used. Otherwise, a calm town behind the title screen
if (new URLSearchParams(location.search).has('quick')) { level = quickLevel('ta'); drawLevels(); start(); camTarget.set(twObj.position.x, 1.2, twObj.position.z); }
else { buildWorld(); makeStorm(); twObj.position.set(-12, 0, -12); camTarget.set(0, 1, 0); }
requestAnimationFrame(frame); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('booting'))); // the start screen is ready now
window.__ta = { get twisters() { return twisters; }, get hunters() { return hunters; }, stormToss, swapStorm, get foes() { return foes; }, get poiFx() { return poiFx; }, wreckPoi, get fx() { return fx; }, get crowd() { return crowd; }, get sceneN() { return scene.children.length; }, get tLeft() { return tLeft; }, get totalD() { return totalD; }, get nukeOn() { return nukeT > 0; }, get stormHead() { return stormHead; }, set moveToSet(v) { moveTo = v; }, get tanks() { return tanks; }, get soldiers() { return soldiers; }, get people() { return people; }, start, finish, goNuke, grow, get massTarget() { return massTarget; }, get nukeT() { return nukeT; }, get stormPos() { return twObj.position; }, THREE, get cam() { return viewCam(); }, get px() { return perfTick.ratio; }, get poiOrder() { return poiOrder; }, get coachUp() { return coachBusy(); }, get zapCd() { return zapCd; }, get engine() { return planeEngineLevel(); }, get music() { return stormMusicState(); }, get song() { return songState(); }, get chunks() { return chunks; }, get flags() { return { radarDown, radioDown, fireBoost, stink }; }, get moveToV() { return moveTo; }, get city() { return city; }, tapAt, get moveTo() { return moveTo; }, get boostT() { return boostT; }, bench(n = 20) { const vc = viewCam(); renderer.render(scene, vc); const t0 = performance.now(); for (let i = 0; i < n; i++) renderer.render(scene, vc); renderer.getContext().finish(); return (performance.now() - t0) / n; }, get animN() { return city.season.anim.length; }, setSeason(s) { seasonI = SEASON_CYCLE.indexOf(s); roundN = 0; }, get season() { return seasonNow(); }, get calls() { return renderer.info.render.calls; }, get tris() { return renderer.info.render.triangles; }, spawnChaser, get chaser() { return chaser; }, get zoom() { return zoom; }, setZoom, get extraSeeders() { return extraSeeders; }, setView, get third() { return third; }, spawnPlane, get planes() { return planes; }, get mass() { return mass; }, get level() { return level; }, set level(v) { level = v; }, get bDone() { return bDone; }, set bDone(n) { bDone = n; }, get babies() { return twisters.babies; }, get totalB() { return totalB; }, get tanks() { return tanks; }, get soldiers() { return soldiers; }, get drivers() { return drivers; }, get state() { return state; }, get score() { return score; }, get size() { return sizeShown; }, get storm() { return twObj; }, get pois() { return pois; }, get buildings() { return buildings; }, get people() { return people; }, set tLeft(v) { tLeft = v; }, grow, start };
