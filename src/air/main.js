// Zombie Air Raid, a Tornado Time! bonus game. The town is overrun by zombies. Take off from the airfield just outside town
// in a NAPALM BOMBER (fast, never stops, lays walls of fire) or a ROCKET HELI (slower, hovers, fires small rockets at a
// circle a little way ahead of its nose: you aim by turning it) and bring the horde down to the goal line before time runs
// out. It is Tornado Time! the other way round: every person you burn or blast and every building you set alight fills the
// COLLATERAL meter, and when that is full the mission fails. Zombies turn whoever they catch, so the slower you are, the
// bigger the horde gets. Big buildings are solid: fly into one and it comes down, and you very nearly do. From Downtown on,
// GRAVE GIANTS rise out of the ground and throw chunks of buildings at you. Out of ammo, or hurt by the gloopers' acid? Fly
// back over the airfield to reload and repair. The horde (and the giants) live in horde.js; the aircraft and the airfield
// models in craft.js.
import { markWon } from '../progress.js';
import { playerButton } from '../player.js';
import * as THREE from 'three';
import { generateMaze, buildCity, toWorld, toCell, CELL, mulberry32 } from '../city.js';
import { createFires } from '../fire.js';
import { createTwisters } from '../tornado.js';
import { createPoiFx } from '../ally/poiFx.js';
import { unlockAudio, soundToggle, setMusicDuck, setSfxPaused, skipSongBtn, sfx, stopMusic, setPlaneEngine, playSongs, gameMusic, SONGS_TORNADO, firstSong } from '../audio.js';
import { radioButton } from '../radioBox.js';
import { addCoins, townSkin } from '../skins.js';
import { forceSeason, seasonChoice, seasonPicker } from '../season.js';
import { eraPicker } from '../era.js';
import { levelKey, bestKey, quickLevel, saveLast } from '../progress.js';
import { showPrizes } from '../prizes.js';
import { stampVersion } from '../version.js';
import { initFullscreen } from '../fullscreen.js';
import { showHowTo, tip, clearTips } from '../howto.js';
import { coach, coachSeen, coachIdle, coachBusy, coachFrame, coachClear } from '../coach.js';
import { autoResolution, mergeStatic, bakeMovable, bakeUnits, setBakedGlow } from '../perf.js';
import { rides, spinners } from '../landmarks.js';
import { nukeBlast } from '../nuke.js';
import { buildOutskirts } from '../outskirts.js';
import { createPreviews } from '../livePreview.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createHorde, G_R } from './horde.js';
import { makeSaucer } from '../ally/foeModels.js';
import { makeBomber, makeHeli, makeAirfield, makeRocket, makeCanister, setPods, BASE_R } from './craft.js';
import { airSkin, craftPreview, craftSkinKey, craftSkinButton, unlockCraftBonus, disposeCraft, craftPrize } from '../craftSkins.js';
import { airTownSkin } from '../hordeSkins.js';

const $ = (id) => document.getElementById(id), Q = new URLSearchParams(location.search);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.debug.checkShaderErrors = false; // reading shader logs forces a sync compile (a hitch) every time a new material shows up
const perfTick = autoResolution(renderer); // drops the draw resolution a notch when frames run long
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x16302f); scene.fog = new THREE.Fog(0x16302f, 60, 120);
const hemi = new THREE.HemisphereLight(0xb8e0d8, 0x2a4448, 1.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xd0e8ff, 0.9); sun.position.set(-6, 10, 8); scene.add(sun);
const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 440), CAM_D = 120; // the same angled view from above as Tornado Time!
const ISO_YAW = Math.PI / 4, ISO_ELEV = 0.72, isoDir = new THREE.Vector3(Math.sin(ISO_YAW) * Math.cos(ISO_ELEV), Math.sin(ISO_ELEV), Math.cos(ISO_YAW) * Math.cos(ISO_ELEV)).normalize();
const fx = createFires(scene), twisters = createTwisters(scene); twisters.setFx(fx); // no storm here: the twisters module is only used to break buildings up into real pieces
let shake = 0; const jolt = (v) => { shake = Math.max(shake, v); };
let flashT = 0, hurtT = 0; const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;background:#fff2d8;opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(flashEl);
const hurtEl = document.createElement('div'); hurtEl.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle, #0000 45%, #6aff2a88 100%);opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(hurtEl); // acid hit: the edges of the screen flash green
let hitT = 0; const hitEl = document.createElement('div'); hitEl.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle, #0000 40%, #ff2a1aa8 100%);opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(hitEl); // a crash (a building, a giant's chunk): red
stampVersion($('taStart'));
const poiFx = createPoiFx(scene, fx, { jolt, popup: (...a) => popup(...a), flash: (v) => { flashT = Math.max(flashT, v); },
  arcTargets: (c, r, n) => buildings.filter((x) => !x.done).map((x) => [Math.hypot(x.pos.x - c.x, x.pos.z - c.z), x]).filter((e) => e[0] < r && e[0] > 2).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, x]) => ({ pos: new THREE.Vector3(x.pos.x, Math.min(x.h, 6), x.pos.z), hit: () => { if (Math.random() < 0.3) igniteB(x); } })) });

// ---------- tuning ----------
// six towns, as in the other games. zombies: how many rise in the town (more in each bigger town). civ: townsfolk to save.
// bases: airfields round the edge (the big towns get more). goal: the share of the horde that may be left at the end (set
// town by town with the autopilot, with the clock: the first two clearly winnable, the big ones a real fight). smell and
// preyR: how many street squares away a zombie smells people, and how close it lunges at them (horde.js TUNE): the first
// towns' zombies are slower to notice anyone, so the horde grows more slowly while a new pilot learns. spit: the share of
// gloopers (a smaller share in the bigger hordes, so each town has only a few more of them than the last: they are what
// wears down a heli). giants: how many GRAVE GIANTS rise during the round, gHP: how much each can take (in rockets; a fire
// patch is worth one and a half). Win: the horde down to the level's goal
const LEVELS = [
  { name: 'Small Town', size: 21, zombies: 300, time: 210, civ: 80, pois: 4, hordes: 7, drift: 0.05, goal: 0.2, smell: 2, preyR: 3.4, spit: 0.04, giants: 0, gHP: 0 },
  { name: 'Suburbs', size: 27, zombies: 350, time: 225, civ: 88, pois: 5, hordes: 8, drift: 0.15, goal: 0.2, smell: 2, preyR: 3.8, spit: 0.05, giants: 0, gHP: 0 },
  { name: 'Downtown', size: 33, zombies: 400, time: 220, civ: 96, pois: 6, hordes: 10, drift: 0.25, goal: 0.185, smell: 2, preyR: 4.0, spit: 0.055, giants: 1, gHP: 12 },
  { name: 'Metro', size: 39, zombies: 450, time: 285, civ: 104, pois: 6, hordes: 10, drift: 0.35, bases: 2, goal: 0.195, smell: 3, preyR: 4.2, spit: 0.055, giants: 2, gHP: 15 },
  { name: 'Megacity', size: 47, zombies: 525, time: 340, civ: 112, pois: 7, hordes: 11, drift: 0.45, bases: 2, goal: 0.2, smell: 3, preyR: 4.4, spit: 0.05, giants: 3, gHP: 18 },
  { name: 'The Sprawl', size: 57, zombies: 600, time: 320, civ: 120, pois: 7, hordes: 12, drift: 0.5, bases: 4, goal: 0.2, smell: 3, preyR: 4.4, spit: 0.045, giants: 4, gHP: 21 }, // drift: how keenly the hordes head for people (more in the big towns, or they'd never meet)
];
let level = 1; const L = () => LEVELS[level - 1];
const Z_MAX = 900, zombiesIn = (lv) => Math.max(1, Math.min(Z_MAX, +Q.get('z') || lv.zombies)); // ?z=N (tests): that many zombies in every town instead, up to Z_MAX (horde.js CROWD_MAX has room for that many plus the townsfolk)
const CRAFTS = {
  bomber: { name: 'NAPALM BOMBER', tag: 'BOMBER', icon: '🔥', speed: 7.6, turn: 1.8, ammo: 10, hp: 100, alt: 6.4, low: 3.1, acid: 12, r: 1.3, reload: 1.6, repair: 45, ammoName: 'NAPALM', desc: 'Fast, and it never stops. Double tap a spot to swoop over it and drop a wall of fire.', best: 'Best on big crowds in open streets' },
  heli: { name: 'ROCKET HELI', tag: 'HELI', icon: '🚀', speed: 6.4, ammo: 24, hp: 100, alt: 3.3, acid: 9, r: 1.05, reload: 1.8, repair: 40, ammoName: 'ROCKETS', desc: 'Hovers. Tap to fly there, double tap a spot to fire a rocket at it.', best: 'Precise: best near people and houses' },
}; // alt: how high each flies. The heli's height is set so houses and small shops pass under it and anything of three floors or more does not
const NAPALM_R = 1.5, NAPALM_T = 8, ROCKET_R = 1.75; // a fire patch's radius and how long it burns; a rocket's blast
const AIM_D = 6.5; // the heli's rockets land on a circle this far ahead of its nose
const AR = { dropEvery: 0.33, fireEvery: 0.3, wall: 0.1, spread: 0.12 }; // seconds between canisters while DROP is held, and between rockets while FIRE is; how close to a building a canister must burst to set it alight; the chance a burned-down building sets its neighbour alight
// big buildings are solid: one blocks an aircraft whose height is less than its roof plus margin. rc: how far round the craft
// counts. dmg: what flying into one costs (a third of full health); bump: how long before another can hurt it; warn: how far
// ahead (in seconds) the BUILDING! warning looks; clear: buildings this close to an airfield never block (the way in stays open)
const BLD = { margin: 0.25, rc: { bomber: 0.55, heli: 0.5 }, dmg: 34, bump: 1.0, warn: { bomber: 1.1, heli: 0.8 }, clear: BASE_R + 4.5 };
// GRAVE GIANTS: range (ground distance to the aircraft) at which one starts a throw; reach: how near a building must be to tear
// into; hold: how long it holds the chunk up; cd: seconds between throws; dmg: a chunk that reaches the aircraft (a quarter of
// full health); hitR: how much of the chunk's size counts for a hit; fire / rocket: what each new fire patch it touches and
// each rocket take off its health; rise: when the first climbs out of the ground, then the gap; g: the chunk's gravity
const GIANT = { range: 15, reach: 3.6, hold: 0.8, lock: 0.35, cd: [3.2, 4.6], grabR: 2.3, grab: 0.75, swipe: 0.55, hitK: 0.33, dmg: 25, hitR: 0.8, fire: 1.5, rocket: 1, rise: [16, 34], score: 5000, g: 15 }; // lock: how long before the throw its aim (the red ring) stops following you
const COLL = { civ: 8, bHit: 2, bLost: 3, poi: 25 }; // what fills the collateral meter (100 = mission failed): about a dozen people, or twenty buildings
const SC = { kill: 100, spit: 250, saved: 150, civ: -2000, bHit: -1000, bLost: -1000, poi: -10000, civEnd: 500, sec: 100 }; // points
// the big landmarks are the town's pride: hit one and it goes up in its own way (poiFx), and that is a lot of collateral
const POI = { fair: { icon: '🎡', name: 'FAIRGROUND' }, power: { icon: '⚡', name: 'POWER PLANT' }, water: { icon: '💧', name: 'WATER STATION' }, cemetery: { icon: '🪦', name: 'GRAVEYARD' }, weather: { icon: '📡', name: 'WEATHER STATION' },
  firestation: { icon: '🚒', name: 'FIRE STATION' }, police: { icon: '🚓', name: 'POLICE STATION' }, sewage: { icon: '💩', name: 'SEWAGE PLANT' }, radio: { icon: '📻', name: 'RADIO TOWER' } };
const EXTRA_POIS = ['weather', 'firestation', 'police', 'sewage', 'radio'];
const unlocked = () => { try { return Math.max(1, Math.min(LEVELS.length, +localStorage.getItem(levelKey('ar')) || 1)); } catch { return 1; } };
let craftKind = (() => { const q = Q.get('craft'); if (q === 'heli' || q === 'bomber') return q; try { return localStorage.getItem('ar_craft') === 'heli' ? 'heli' : 'bomber'; } catch { return 'bomber'; } })();

// ---------- the town ----------
let cols = 21, rows = 21, maze, city, buildings = [], pois = {}, poiOrder = [], cars = [], roads = [], bases = [], hx = 31.5, hz = 31.5, FB = { x: 45, z: 45 }, cemCell = null;
function buildWorld() {
  if (city) { scene.remove(city.group); twisters.clear(); fx.clear(); poiFx.clear(); }
  clearWeapons(); cols = rows = L().size; const seed = (Math.random() * 1e6) | 0, rng = mulberry32(seed);
  forceSeason(seasonChoice() !== 'random' ? seasonChoice() : level >= 5 ? 'none' : ['none', 'halloween', 'christmas', 'july4'][(Math.random() * 4) | 0]); /* Random leaves the two biggest towns plain: they're big enough already */
  maze = generateMaze(cols, rows, Math.floor(cols * rows * 0.12), rng);
  const mid = (cols - 1) / 2; for (let i = 1; i < cols - 1; i++) { maze[mid][i] = false; maze[i][mid] = false; } maze.avenues = { row: mid, col: mid };
  if (cols >= 33) for (const q of [Math.round((cols - 1) / 4) | 1, Math.round((cols - 1) * 3 / 4) | 1]) for (let i = 1; i < cols - 1; i++) { maze[q][i] = false; maze[i][q] = false; }
  // the fairground: three rides side by side, facing an open street (as in Tornado Time!)
  const farFromMid = (x, y) => Math.abs(x - mid) + Math.abs(y - mid) > cols * 0.3;
  let fy = rows - 4, fx0 = mid - 1; for (let k = 0; k < 60; k++) { const y = 3 + ((rng() * (rows - 7)) | 0), x = 2 + ((rng() * (cols - 7)) | 0); if (farFromMid(x + 1, y)) { fy = y; fx0 = x; break; } }
  for (let x = fx0; x <= fx0 + 2; x++) maze[fy][x] = true; for (let x = fx0 - 1; x <= fx0 + 3; x++) maze[fy + 1][x] = false;
  const near = (tx, ty) => { let best = null, bd = 1e9; for (let y = 2; y < rows - 2; y++) for (let x = 2; x < cols - 2; x++) { if (!maze[y][x] || (y === fy && x >= fx0 && x <= fx0 + 2)) continue; if (!(maze[y - 1][x] === false || maze[y + 1][x] === false || maze[y][x - 1] === false || maze[y][x + 1] === false)) continue; const d = Math.abs(x - tx) + Math.abs(y - ty); if (d < bd) { bd = d; best = [x, y]; } } return best; };
  const extra = EXTRA_POIS.slice(); for (let i = extra.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [extra[i], extra[j]] = [extra[j], extra[i]]; }
  const want = ['cemetery', 'power', 'water', ...extra].slice(0, L().pois - 1); // the graveyard is always there: that is where the dead first rose
  const taken = [[fx0 + 1, fy]], cells = new Set([fy * cols + fx0, fy * cols + fx0 + 1, fy * cols + fx0 + 2]);
  const forced = new Map([[fy * cols + fx0, 'ferris'], [fy * cols + fx0 + 1, 'coaster'], [fy * cols + fx0 + 2, 'carousel']]);
  for (const k of want) { let at = null;
    for (let sep = cols * 0.35; !at && sep >= 2; sep *= 0.8) for (let t = 0; t < 60 && !at; t++) { const x = 2 + ((rng() * (cols - 4)) | 0), y = 2 + ((rng() * (rows - 4)) | 0); if (Math.abs(x - mid) + Math.abs(y - mid) <= cols * 0.2) continue; const n = near(x, y); if (n && !cells.has(n[1] * cols + n[0]) && taken.every(([ax, ay]) => Math.abs(ax - n[0]) + Math.abs(ay - n[1]) > sep)) at = n; }
    if (!at) continue; taken.push(at); cells.add(at[1] * cols + at[0]); forced.set(at[1] * cols + at[0], k); }
  maze.forcedLandmarks = forced;
  twisters.setBounds(toWorld(cols - 1, rows - 1, cols, rows));
  hemi.intensity = 1.7; sun.intensity = 0.9; city = buildCity(scene, maze, 3 + (seed % 9973)); buildOutskirts(scene, cols, rows, seed); city.season.light(hemi, sun, scene); city.detail.clouds.visible = false; city.detail.clouds.material.opacity = 0;
  pois = {}; for (const hz0 of city.hazards) { const k = ['ferris', 'coaster', 'carousel'].includes(hz0.type) ? 'fair' : POI[hz0.type] ? hz0.type : null; if (k) (pois[k] = pois[k] || { hz: [], done: false }).hz.push(hz0); }
  for (const k in pois) { const c = new THREE.Vector3(); for (const h of pois[k].hz) { c.add(h.pos); h.ob = city.obstacles.find((o) => Math.abs(o.x - h.pos.x) < 0.3 && Math.abs(o.z - h.pos.z) < 0.3) || null; } pois[k].center = c.divideScalar(Math.max(1, pois[k].hz.length)); } poiOrder = Object.keys(pois); // each part's footprint: only a hit square on it counts
  // buildings, each with its footprint (from the town's own list of things you can't walk through)
  const obs = new Map(); for (const o of city.obstacles) { const k = Math.round(o.x) + ',' + Math.round(o.z); if (!obs.has(k)) obs.set(k, []); obs.get(k).push(o); }
  const footOf = (p) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const o of obs.get((Math.round(p.x) + dx) + ',' + (Math.round(p.z) + dz)) || []) if (Math.abs(o.x - p.x) < 0.3 && Math.abs(o.z - p.z) < 0.3) return o; return null; };
  buildings = city.buildings.map((b) => { const obj = b.parent !== city.group ? b.parent : b, pos = b.getWorldPosition(new THREE.Vector3()), h = b.userData.h || 2, ob = footOf(pos); let hw = 1.2, hd = 1.2;
    if (ob) { hw = ob.hw; hd = ob.hd; } else { const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()); hw = s.x / 2; hd = s.z / 2; }
    const body = new THREE.Box3().setFromObject(b), bx = Math.max(0.5, (body.max.x - body.min.x) / 2), bz = Math.max(0.5, (body.max.z - body.min.z) / 2); // its walls (not its whole lot): what an aircraft can fly into
    return { b, obj, pos, h, ob, hw, hd, bx, bz, nb: false, done: false, burnT: null }; });
  { const anim = new Set(city.season.anim.map((a) => a.m)); for (const x of buildings) { if (x.obj !== x.b) mergeStatic(x.obj, x.obj.children.filter((m) => !anim.has(m)));
    else { const ex = x.b.userData.extras || []; const map = mergeStatic(city.group, ex.filter((m) => !anim.has(m))); if (map.size) { const o = []; for (const e of ex) { const m = map.get(e) || e; if (!o.includes(m)) o.push(m); } x.b.userData.extras = o; } } } }
  freezeCity();
  roads = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (!maze[y][x]) roads.push([x, y]);
  cars = city.cars.map((g) => ({ g, pr: g.userData.prop, p: g.getWorldPosition(new THREE.Vector3()) }));
  hx = cols * CELL / 2; hz = rows * CELL / 2; FB = { x: hx + 14, z: hz + 14 }; buildBases();
  // the buildings an aircraft can fly into, filed by street square (the tallest, where a square has two); none near an airfield
  bAt = new Array(cols * rows).fill(null); for (const b of buildings) { b.nb = bases.some((q) => Math.hypot(q.pos.x - b.pos.x, q.pos.z - b.pos.z) < BLD.clear); const c = toCell(b.pos.x, b.pos.z, cols, rows); if (c.cx < 0 || c.cy < 0 || c.cx >= cols || c.cy >= rows) continue; const k = c.cy * cols + c.cx; if (!bAt[k] || bAt[k].h < b.h) bAt[k] = b; } rtKey = -1;
  // the graveyard's own street: the first horde shambles out of there
  cemCell = null; if (pois.cemetery) { const c = toCell(pois.cemetery.center.x, pois.cemetery.center.z, cols, rows); let bd = 1e9; for (const r of roads) { const d = Math.abs(r[0] - c.cx) + Math.abs(r[1] - c.cy); if (d < bd) { bd = d; cemCell = r; } } }
  Object.assign(horde.tune, { drift: L().drift, smell: L().smell, preyR: L().preyR }); horde.setTown(maze); horde.spawn({ zombies: zombiesIn(L()), spitShare: L().spit, civs: L().civ, hordes: L().hordes, roads, at: cemCell, rng });
}
// the airfield sits just outside the south edge of town; the big towns have a second one on the north side
function buildBases() { for (const b of bases) scene.remove(b.g); bases = [];
  for (let i = 0; i < (L().bases || 1); i++) { const g = makeAirfield(), side = [[0, 1], [0, -1], [1, 0], [-1, 0]][i]; g.position.set(side[0] * (hx + 5.6), 0, side[1] * (hz + 5.6)); g.rotation.y = Math.atan2(side[0], side[1]); scene.add(g); g.updateMatrixWorld(true); // (its far side faces away from town)
    bases.push({ g, pos: g.position.clone(), pad: g.userData.pad.clone().applyMatrix4(g.matrixWorld), ring: g.userData.ring, beacon: g.userData.beacon, sock: g.userData.sock }); } }

// ---------- frame cost: the same tricks as Tornado Time!. The static town is sorted into chunks; a chunk off screen is
// switched off whole, and everything nobody has touched is baked into a few meshes per chunk. A building is lifted back
// out (live / free) the moment anything happens to it ----------
const CHUNK = 4, noop = () => {}; let chunks = [], liveDeco = [];
function freezeCity() {
  const cg = city.group; cg.updateMatrixWorld(true); const keep = new Set();
  const mark = (o) => { while (o && o.parent && o.parent !== cg) o = o.parent; if (o && o.parent === cg) keep.add(o); };
  liveDeco = city.season.anim.filter((a) => a.bob || a.wave).map((a) => a.m); for (const r of rides) for (const o of [r.wheel, r.platform, ...(r.cars || [])]) if (o) mark(o); for (const s of spinners) mark(s.obj);
  const map = new Map(), bb = new THREE.Box3(), sz = new THREE.Vector3(), ctr = new THREE.Vector3(), span = CHUNK * CELL, ox = cols * CELL / 2, oz = rows * CELL / 2;
  for (const o of cg.children.slice()) { if (keep.has(o) || o.isLight || o.isPoints) continue; bb.setFromObject(o); if (bb.isEmpty()) { if (!o.isLine) continue; o.getWorldPosition(ctr); bb.setFromCenterAndSize(ctr, sz.set(0.1, 0.1, 0.1)); }
    bb.getSize(sz); if (Math.max(sz.x, sz.z) > span * 1.5) continue; bb.getCenter(ctr);
    const key = Math.floor((ctr.x + ox) / span) + ',' + Math.floor((ctr.z + oz) / span); let ch = map.get(key); if (!ch) { ch = new THREE.Group(); ch.isChunk = true; ch.box = new THREE.Box3(); map.set(key, ch); cg.add(ch); } ch.add(o); ch.box.union(bb); }
  const own = new Set(); for (const x of buildings) { own.add(x.obj); own.add(x.b); for (const m of x.b.userData.extras || []) own.add(m); }
  for (const pr of city.props) own.add(pr.g); for (const h of city.hazards) for (const p of h.parts || []) own.add(p); for (const a of city.season.anim) own.add(a.m);
  for (const ch of map.values()) { const list = []; for (const o of ch.children.slice()) { if (own.has(o)) continue; let skip = false; o.traverse((m) => { if (own.has(m) || m.isLine || m.isPoints || m.isInstancedMesh) skip = true; }); if (skip) continue;
      o.traverse((m) => { if (m.isMesh) list.push(m); }); }
    for (const m of list) if (m.parent !== ch) ch.attach(m); mergeStatic(ch, list);
    const props = city.props.filter((pr) => pr.g.parent === ch && !pr.knocked); const bk = bakeMovable(ch, props.map((pr) => pr.g)); if (bk) for (const pr of props) pr.bake = bk; }
  setBakedGlow(1); baked.clear(); keyOf.clear(); const skipM = new Set(); for (const a of city.season.anim) a.m.traverse((m) => skipM.add(m));
  const unitsOf = new Map(), put = (ch, key, o) => { if (!ch || !ch.isChunk) return; let U = unitsOf.get(ch); if (!U) unitsOf.set(ch, (U = new Map())); let u = U.get(key); if (!u) U.set(key, (u = { key, objs: [] })); u.objs.push(o); keyOf.set(o, key); };
  for (const x of buildings) { put(x.obj.parent, x, x.obj); if (x.obj === x.b) for (const m of x.b.userData.extras || []) if (m.parent === x.obj.parent) put(m.parent, x, m); }
  for (const h of city.hazards) for (const p of h.parts || []) put(p.parent, h, p);
  for (const [ch, U] of unitsOf) { const bk = bakeUnits(ch, [...U.values()], skipM); for (const key of U.keys()) { let l = baked.get(key); if (!l) baked.set(key, (l = [])); l.push(bk); } }
  chunks = [...map.values()]; for (const ch of chunks) { ch.box.expandByScalar(0.5); ch.updateMatrixWorld(true); ch.updateMatrixWorld = noop; }
}
const baked = new Map(), keyOf = new Map();
function live(key) { const l = baked.get(key); if (!l) return; baked.delete(key); for (const bk of l) bk.unbake(key); }
function free(o) { const k = keyOf.get(o); if (k) live(k); if (o && o.parent && o.parent.isChunk) city.group.attach(o); }
function freeKnocked() { for (const pr of city.props) if (pr.knocked && pr.g.parent && pr.g.parent.isChunk) { if (pr.bake) { pr.bake.unbake(pr.g); pr.bake = null; } free(pr.g); } }
const frus = new THREE.Frustum(), projM = new THREE.Matrix4();
function cullChunks() { cam.updateMatrixWorld(); projM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frus.setFromProjectionMatrix(projM);
  for (const ch of chunks) ch.visible = frus.intersectsBox(ch.box);
  for (const m of liveDeco) { let o = m.parent; while (o && !o.isChunk) o = o.parent; if (!o || o.visible) m.updateMatrixWorld(true); } }
// walkers bump off buildings and solid street furniture (a grid of the town's obstacles, rebuilt when one goes)
let obsGrid = null, obsN = -1, obsList = null; const OG = 6;
function obstaclesNear(x, z) { const list = city.obstacles; if (list !== obsList || list.length !== obsN || !obsGrid) { obsList = list; obsN = list.length; obsGrid = new Map(); for (const o of list) { const k = Math.floor(o.x / OG) + ',' + Math.floor(o.z / OG); let b = obsGrid.get(k); if (!b) obsGrid.set(k, (b = [])); b.push(o); } }
  const gx = Math.floor(x / OG), gz = Math.floor(z / OG), out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const b = obsGrid.get((gx + i) + ',' + (gz + j)); if (b) for (const o of b) out.push(o); } return out; }
function collidePerson(c) { const p = c.position, r = 0.15; for (const o of obstaclesNear(p.x, p.z)) { const dx = p.x - o.x, dz = p.z - o.z; if (Math.abs(dx) > o.hw + r || Math.abs(dz) > o.hd + r) continue; const qx = o.hw + r - Math.abs(dx), qz = o.hd + r - Math.abs(dz); if (qx < qz) p.x += Math.sign(dx || 1) * qx; else p.z += Math.sign(dz || 1) * qz; }
  if (cols) { const lx = hx - 0.4, lz = hz - 0.4; p.x = Math.max(-lx, Math.min(lx, p.x)); p.z = Math.max(-lz, Math.min(lz, p.z)); } }

// ---------- the horde (horde.js) ----------
const craftView = { pos: new THREE.Vector3(0, 99, 0), vel: new THREE.Vector3(), r: 1, alive: false, safe: false }; // what the gloopers (and the giants) can see of the aircraft
const horde = createHorde({ scene, fx, popup: (p, t, c) => { if (state === 'play') popup(p, t, c); }, collide: collidePerson, craft: () => craftView, fireAt, fireCells: () => fireCells, townSkin: airTownSkin, giantRip: onGiantRip, giantRelease: onGiantRelease,
  on: { bite: onBite, turned: onTurned, kill: onKill, civLost: onCivLost, spit: onSpit, hitCraft, groan: () => { if (state === 'play' && Math.random() < 0.5) sfx.groan(); }, giantStep: onGiantStep, giantThud: onGiantThud } });

// ---------- score, collateral, popups ----------
let score = 0, coll = 0, kills = 0, spitKills = 0, savedN = 0, civHit = 0, turned = 0, bHit = 0, bLost = 0, poiHit = 0, acidHits = 0, refills = 0, multiBest = 0, played = 0, tLeft = 180, ROUND = 180, zStart = 300, goalN = 30, civStart = 80, endWhy = '', bumps = 0, rockHits = 0, crushed = 0;
let biteT = 0, turnT = 0, savedT = 0, spitT = 0, coll70 = false, endZ = 0, endCiv = 0;
const now = () => performance.now() / 1000;
function addColl(v, at, label) { if (state !== 'play') return; coll = Math.min(100, coll + v); popup(at, label || 'COLLATERAL!', '#ff5a4a'); sfx.hurt(); const el = $('arColl'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  if (coll >= 100) { finish('damage'); return; } if (coll >= 70 && !coll70) { coll70 = true; banner('⚠ COLLATERAL 70%! CAREFUL'); sfx.ping(0); } }
// kills close together pop up as one: "+700 x7". Six or more in one go is a MULTI-KILL with a bonus
const buckets = new Map();
function addKill(p, pts, spit) { const k = Math.round(p.x / 4) + ',' + Math.round(p.z / 4); let b = buckets.get(k); if (!b) buckets.set(k, (b = { x: p.x, z: p.z, n: 0, pts: 0, spit: 0, t: 0.35 })); b.n++; b.pts += pts; if (spit) b.spit++; }
function flushKills(dt) { for (const [k, b] of buckets) { b.t -= dt; if (b.t > 0) continue; buckets.delete(k); let pts = b.pts;
    if (b.n >= 6) { pts += b.n * 50; multiBest = Math.max(multiBest, b.n); if (b.n >= 10) banner('🔥 MULTI-KILL x' + b.n + '!'); }
    score += pts; popup({ x: b.x, y: 0.2, z: b.z }, '+' + pts + (b.n >= 6 ? ' MULTI-KILL x' + b.n : b.n > 1 ? ' x' + b.n : b.spit ? ' GLOOPER' : ''), b.n >= 6 ? '#ff9a3a' : b.spit ? '#9aff5a' : '#ffe27a'); } }
function onKill(o, how, saved) { if (state !== 'play' || how === 'giant') return; kills++; addSup(1); /* (zombies a giant's chunk lands on are gone, but not to your credit) */ const spit = !!o.userData.spit; if (spit) spitKills++; addKill(o.position, spit ? SC.spit : SC.kill, spit);
  if (saved && now() - savedT > 0.7) { savedT = now(); savedN++; score += SC.saved; popup(saved.position, 'SAVED!', '#7dff3a'); } if (Math.random() < 0.25) sfx.splat(); }
function onCivLost(o, how) { if (state !== 'play') return; if (how === 'giant') { crushed++; popup(o.position, 'CRUSHED!', '#ff9a8a'); return; } /* a giant's doing, not yours: no collateral */ civHit++; score += SC.civ; addColl(COLL.civ, o.position, how === 'fire' ? 'PERSON BURNED!' : 'PERSON HIT!'); }
function onBite(c) { if (state !== 'play') return; if (now() - biteT > 0.6) { biteT = now(); popup(c.position, 'BITTEN!', '#ff7a6a'); if (toScreen(c.position).on) sfx.caught(); } }
function onTurned(z) { if (state !== 'play') return; turned++; if (now() - turnT > 0.8) { turnT = now(); popup(z.position, 'TURNED!', '#ff5a4a'); } }
function onSpit(o) { if (state !== 'play') return; if (now() - spitT > 0.35 && toScreen(o.position).on) { spitT = now(); sfx.pop(); } }
const pops = []; for (let i = 0; i < 16; i++) { const el = document.createElement('div'); el.className = 'pop'; el.style.display = 'none'; document.body.appendChild(el); pops.push({ el, t: 0, p: new THREE.Vector3(), f: null, dy: 0, w: 0, h: 0 }); }
// follow: a point to ride along with (the aircraft's own position), so its popups don't get left behind at the screen's edge
let popI = 0; function popup(pos, text, color, follow) { const o = pops[popI++ % pops.length]; o.t = 1; o.f = follow || null; o.dy = (pos.y || 0) + 1.2 - (follow ? follow.y : 0); o.p.set(pos.x, (pos.y || 0) + 1.2, pos.z); o.el.textContent = text; o.el.style.color = color; o.el.style.display = 'block'; o.w = o.el.offsetWidth; o.h = o.el.offsetHeight; }
// every popup stays whole on screen and clear of the bars at the top and the controls along the bottom; one whose spot is
// well off screen is not shown at all (rather than pinned to the edge, far from what it is about)
function updatePops(dt) { const W = innerWidth, H = innerHeight, top = hudH + 2, bot = H - hudB - 2;
  for (const o of pops) { if (o.t <= 0) continue; o.t -= dt * 0.9; if (o.f) { o.dy += dt * 1.6; o.p.set(o.f.x, o.f.y + o.dy, o.f.z); } else o.p.y += dt * 1.6;
    const v = o.p.clone().project(cam), x0 = (v.x * 0.5 + 0.5) * W, y0 = (-v.y * 0.5 + 0.5) * H, hw = o.w / 2 + 6, hh = o.h / 2 + 2;
    const x = Math.max(hw, Math.min(W - hw, x0)), y = Math.max(top + hh, Math.min(bot - hh, y0)), far = v.z > 1 || Math.abs(x - x0) > 70 || Math.abs(y - y0) > 70;
    o.el.style.visibility = far ? 'hidden' : ''; o.el.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)'; o.el.style.opacity = Math.min(1, o.t * 2); if (o.t <= 0) o.el.style.display = 'none'; } }
let bannerT = 0; function banner(text) { $('taBanner').textContent = text; $('taBanner').style.opacity = 1; bannerT = 2.2; }
let boomT = 0; const boom = () => { if (now() - boomT > 0.13) { boomT = now(); sfx.boom(); } };

// ---------- fire: napalm patches on the ground. Anyone walking into one catches light (zombies and, sadly, people) ----------
const patches = []; let fireCells = [], pBox = { x0: 0, x1: 0, z0: 0, z1: 0 };
function fireAt(x, z) { if (!patches.length || x < pBox.x0 || x > pBox.x1 || z < pBox.z0 || z > pBox.z1) return false; for (const P of patches) { const dx = x - P.x, dz = z - P.z; if (dx * dx + dz * dz < P.r2) return true; } return false; }
function patchesChanged() { pBox = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }; const s = new Set(); for (const P of patches) { pBox.x0 = Math.min(pBox.x0, P.x - P.r); pBox.x1 = Math.max(pBox.x1, P.x + P.r); pBox.z0 = Math.min(pBox.z0, P.z - P.r); pBox.z1 = Math.max(pBox.z1, P.z + P.r); s.add(P.ci); } fireCells = [...s]; }
const glowM = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
const patchMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), glowM(0xffffff, 1), 80); patchMesh.frustumCulled = false; patchMesh.count = 0; patchMesh.position.y = 0.12; patchMesh.setColorAt(0, new THREE.Color(0)); scene.add(patchMesh);
const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), col = new THREE.Color(), tmp = new THREE.Vector3();
function addPatch(x, z) { const c = toCell(x, z, cols, rows); patches.push({ x, z, r: NAPALM_R, r2: NAPALM_R * NAPALM_R, t: NAPALM_T, T: NAPALM_T, ci: c.cy * cols + c.cx }); if (patches.length > 80) patches.shift(); patchesChanged(); }
function updatePatches(dt) { let ch = false; for (let i = patches.length - 1; i >= 0; i--) { const P = patches[i]; P.t -= dt; if (P.t < 0.6) { P.r = NAPALM_R * Math.max(0.05, P.t / 0.6); P.r2 = P.r * P.r; } if (P.t <= 0) { patches.splice(i, 1); ch = true; } } if (ch) patchesChanged();
  let n = 0; for (const P of patches) { const k = Math.min(1, P.t / 0.8) * Math.min(1, (P.T - P.t) / 0.2 + 0.3), fl = 1.1 + Math.sin(played * 13 + P.x * 3) * 0.08 + Math.random() * 0.06; m4.compose(v3.set(P.x, 0, P.z), q4.identity(), s3.set(P.r * fl, 1, P.r * fl)); patchMesh.setMatrixAt(n, m4); patchMesh.setColorAt(n, col.setHex(0xff5a12).multiplyScalar(0.6 * k)); n++; }
  patchMesh.count = n; if (n) { patchMesh.instanceMatrix.needsUpdate = true; patchMesh.instanceColor.needsUpdate = true; } }

// ---------- what the napalm and the rockets do to the town: a building hit square-on catches fire and burns down a few
// seconds later (the real building breaking up, as in the other games); the landmarks go up in their own way; parked cars
// explode; street furniture is knocked flying ----------
const burning = [];
function igniteB(b) { if (b.done || b.burnT != null) return false; b.burnT = 8 + Math.random() * 3; burning.push(b); fx.ignite(new THREE.Vector3(b.pos.x, Math.min(b.h, 2.5), b.pos.z), 0.9 + Math.min(1.2, b.h * 0.15), b.burnT + 2);
  if (state === 'play') { bHit++; score += SC.bHit; addColl(COLL.bHit, b.pos, 'BUILDING HIT!'); } return true; }
// o.from: where the blow came from (the pieces burst away from it), o.power: how hard, o.fire = false: no fire at its foot
function collapse(b, o = {}) { if (b.done) return; free(b.obj); b.done = true; if (b.ob) { const i = city.obstacles.indexOf(b.ob); if (i >= 0) city.obstacles.splice(i, 1); } if (b.b.userData.edges) b.b.userData.edges.visible = false;
  const ex = b.obj === b.b ? (b.b.userData.extras || []).filter((m) => m.parent) : [];
  twisters.tear(b.obj, b.pos, new THREE.Box3().setFromObject(b.obj).getSize(new THREE.Vector3()), null, [], ex, { collapse: true, power: o.power || 0.7, from: o.from });
  fx.puff('smoke', new THREE.Vector3(b.pos.x, 1, b.pos.z), 1.3 + b.h * 0.15); if (o.fire !== false) fx.ignite(new THREE.Vector3(b.pos.x, 0.3, b.pos.z), 0.8, 5); fx.scorch(b.pos, 1.8, 24);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + Math.random(); fx.dust({ x: b.pos.x + Math.cos(a) * 1.1, y: 0, z: b.pos.z + Math.sin(a) * 1.1 }, 0.8 + b.h * 0.12, Math.cos(a) * 2, Math.sin(a) * 2); }
  jolt(Math.min(0.4, 0.1 + b.h * 0.04)); sfx.crunch(b.h > 5); }
function updateBuildingFires(dt) { for (let i = burning.length - 1; i >= 0; i--) { const b = burning[i]; if (b.done) { burning.splice(i, 1); continue; } b.burnT -= dt; if (b.burnT > 0) continue;
    burning.splice(i, 1); collapse(b); if (state === 'play') { bLost++; score += SC.bLost; addColl(COLL.bLost, b.pos, 'BURNED DOWN!'); }
    if (Math.random() < AR.spread) { let nb = null, nd = 3.4; for (const y of buildings) { if (y.done || y.burnT != null) continue; const d = Math.hypot(y.pos.x - b.pos.x, y.pos.z - b.pos.z); if (d < nd) { nd = d; nb = y; } } if (nb && igniteB(nb)) popup(nb.pos, 'FIRE SPREADS!', '#ff9a3a'); } } } // now and then the fire jumps next door
function wreckPoi(k) { const P = pois[k]; if (!P || P.done) return; P.done = true; poiHit++; const g = new THREE.Group(); g.position.copy(P.center); scene.add(g);
  for (const h of P.hz) { live(h); for (const part of h.parts || []) if (part.parent) g.attach(part); const i = city.obstacles.findIndex((o) => Math.abs(o.x - h.pos.x) < 0.3 && Math.abs(o.z - h.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); }
  twisters.tear(g, P.center, new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()), null, [], [], { collapse: true, now: true, power: 1.4 });
  fx.explode(new THREE.Vector3(P.center.x, 1, P.center.z), 2.2); flashT = Math.max(flashT, 0.3); jolt(1); sfx.boom(); setTimeout(() => sfx.boom(), 200); poiFx.play(k, P.center);
  if (state === 'play') { score += SUP.poiPts; popup(P.center, '+' + SUP.poiPts + ' 📦 SUPPLIES!', '#ffd24a'); banner('📦 SUPPLIES FROM THE ' + POI[k].name + '!'); addSup(Math.round(zStart * SUP.poi)); }
  if (k === 'power') { for (const [t, v] of [[0, 0.3], [0.16, 0.9], [0.34, 0.15], [0.55, 0.75], [0.8, 0.1], [1.05, 0.5]]) poiFx.after(t, () => lights(v)); poiFx.after(1.3, blackout); } // the town's lights stutter, then go out
  horde.blast(P.center.x, P.center.z, 3.2, 1.3, 'rocket', true); } /* (zombies only: blowing a landmark up for its supplies costs no collateral) */
function lights(v) { for (const x of buildings) for (const m of x.b.userData.fade || []) if (m.emissiveIntensity != null) { if (m.userData.glow0 == null) m.userData.glow0 = m.emissiveIntensity; m.emissiveIntensity = m.userData.glow0 * v; } setBakedGlow(v); }
function blackout() { hemi.intensity *= 0.6; sun.intensity *= 0.65; for (const x of buildings) for (const m of x.b.userData.fade || []) if (m.emissiveIntensity != null) m.emissiveIntensity = 0.04; setBakedGlow(0.04);
  city.group.traverse((m) => { const mt = m.material; if (mt && !Array.isArray(mt) && mt.isMeshBasicMaterial && mt.color && mt.color.getHex() === 0xf6e94a) mt.color.setHex(0x22232a); }); }
function blowCar(i) { const { p } = cars[i]; cars.splice(i, 1); fx.explode(p.clone().setY(0.4), 0.9); fx.ignite(p.clone().setY(0.2), 0.6, 5); boom(); } // (the town's own knock() flips it over)
// x, z: where a canister burst or a rocket landed
function hitThings(x, z, how) { const rocket = how === 'rocket';
  for (const b of buildings) { if (b.done) continue; const dx = Math.max(0, Math.abs(x - b.pos.x) - b.hw), dz = Math.max(0, Math.abs(z - b.pos.z) - b.hd); if (dx > 1 || dz > 1) continue; const d = Math.hypot(dx, dz);
    if (rocket) { if (d < 0.05) { if (b.burnT != null) { collapse(b); if (state === 'play') { bLost++; score += SC.bLost; addColl(COLL.bLost, b.pos, 'DESTROYED!'); } } else igniteB(b); } } // square on: it catches fire (a second rocket brings it down)
    else if (d < AR.wall) igniteB(b); } // napalm sets a building alight only when the canister comes down on it (a splash against the wall from the street does not)
  for (const k of poiOrder) { const P = pois[k]; if (P.done) continue; if (P.hz.some((h) => h.ob ? Math.abs(x - h.ob.x) < h.ob.hw + 0.2 && Math.abs(z - h.ob.z) < h.ob.hd + 0.2 : Math.hypot(h.pos.x - x, h.pos.z - z) < 1.2)) wreckPoi(k); }
  for (let i = cars.length - 1; i >= 0; i--) { const k = cars[i]; if (k.pr && k.pr.knocked) { cars.splice(i, 1); continue; } if (Math.hypot(k.p.x - x, k.p.z - z) < 1.3) blowCar(i); } // a parked car in the blast goes up
  if (city.knock(x, z, 1.4, 0, 0)) freeKnocked(); }

// the craft skin's looks, trail and quirks (craftSkins.js). With no skin worn, every call does nothing
const sk = airSkin({ scene, fx, horde, twisters, popup, sfx, jolt, hitThings, rocketR: ROCKET_R });
// ---------- weapons ----------
const cans = [], rockets = [], arBlasts = []; let drops = 0, shots = 0;
// SUPPLIES: every zombie destroyed is one, a landmark blown up is a tenth of the horde's worth. The bar unlocks a weapon at each
// mark (a share of the horde); the last is the NUKE: one shot, and another for every further SUP.more of supplies
const SUP = { at: [0.12, 0.28, 0.48], more: 0.16, poi: 0.1, poiPts: 2000, nukeR: 8, nukeG: 6 };
const WPN = { bomber: [{ icon: '🔥', name: 'NAPALM', cost: 1 }, { icon: '💣', name: 'BIG BOMB', cost: 2 }, { icon: '🎆', name: 'FIRE WALL', cost: 2 }, { icon: '☢️', name: 'NUKE', cost: 0 }],
  heli: [{ icon: '🚀', name: 'ROCKET', cost: 1 }, { icon: '💥', name: 'BIG ROCKET', cost: 2 }, { icon: '🎇', name: 'SALVO', cost: 3 }, { icon: '☢️', name: 'NUKE', cost: 0 }] };
let wpn = 0, wLv = 0, sup = 0, nukes = 0, supNuke = 0;
function addSup(n) { if (state !== 'play') return; sup += n; let ch = false; while (wLv < 3 && sup >= SUP.at[wLv] * zStart) { wLv++; ch = true; if (wLv === 3) { nukes = 1; supNuke = sup + SUP.more * zStart; } else wpn = wLv; banner('⬆ NEW WEAPON: ' + WPN[craftKind][wLv].name + '!'); sfx.power(); }
  if (wLv >= 3 && sup >= supNuke) { supNuke += SUP.more * zStart; if (nukes < 2) { nukes++; ch = true; banner('☢️ ANOTHER NUKE IS READY!'); sfx.power(); } } if (ch) drawWpns(); }
function supPct() { if (wLv >= 3) return nukes >= 2 ? 100 : (1 - (supNuke - sup) / (SUP.more * zStart)) * 100; const a = wLv ? SUP.at[wLv - 1] * zStart : 0, b = SUP.at[wLv] * zStart; return (sup - a) / (b - a) * 100; }
function drawWpns() { const box = $('arWpns'); if (!box) return; const l = WPN[craftKind]; if (box.children.length !== l.length || box.dataset.k !== craftKind) { box.innerHTML = ''; box.dataset.k = craftKind; l.forEach((w, i) => { const b = document.createElement('button'); b.innerHTML = '<b>' + w.icon + '</b><i></i>'; b.setAttribute('aria-label', w.name);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (state !== 'play' || i > wLv || (i === 3 && nukes <= 0)) return; wpn = i; sfx.click(); drawWpns(); popup(craft.pos, w.name, '#ffd24a', craft.pos); }); box.appendChild(b); }); }
  l.forEach((w, i) => { const b = box.children[i]; b.classList.toggle('lock', i > wLv || (i === 3 && nukes <= 0)); b.classList.toggle('sel', i === wpn); b.querySelector('i').textContent = i === 3 ? (i <= wLv ? '×' + nukes : '') : w.cost > 1 ? '−' + w.cost : ''; });
  const d = $('arDrop'), ic = d && d.querySelector('b'); if (ic) ic.textContent = l[wpn].icon; }
// which weapon this shot is, paid for: the one picked, or the plain one when there is not enough left for it
function useW(c) { let w = wpn; if (w === 3) { if (nukes > 0) { nukes--; wpn = Math.min(wLv, 2); drawWpns(); return 3; } w = wpn = Math.min(wLv, 2); drawWpns(); } if (c.ammo < WPN[c.kind][w].cost) w = 0; c.ammo -= WPN[c.kind][w].cost; return w; }
function fireSpot(x, z) { fx.ignite(new THREE.Vector3(x, 0.1, z), 1.0, NAPALM_T); addPatch(x, z); hitThings(x, z, 'napalm'); }
// the NUKE: a blast that burns the dead and leaves the living and the town standing (a Grave Giant in it is badly hurt)
function nukeAt(x, z) { const at = new THREE.Vector3(x, 0, z), hitG = new Set(); let done = 0; flashT = Math.max(flashT, 1); jolt(1.3); sfx.boom(); setTimeout(() => sfx.boom(), 220); banner('☢️ NUKE!');
  arBlasts.push(nukeBlast(scene, at, SUP.nukeR, { kind: 'nuke', secs: 1.8, onRadius: (r) => { if (r - done < 1) return; done = r; horde.blast(x, z, r, 1.4, 'rocket', true);
    for (const G of horde.giants) if (G.live && !hitG.has(G) && Math.hypot(G.root.position.x - x, G.root.position.z - z) < r + G_R * 0.6) { hitG.add(G); hurtG(G, SUP.nukeG); } } })); }
function updateBlasts(dt) { for (let i = arBlasts.length - 1; i >= 0; i--) if (!arBlasts[i].update(dt)) arBlasts.splice(i, 1); }
function landCan(k, x, z) { const w = k.w || 0; if (w === 3) { nukeAt(x, z); return; } napalm(x, z, k.head); if (!w) return; const fx0 = Math.sin(k.head), fz0 = Math.cos(k.head), cx = Math.cos(k.head), cz = -Math.sin(k.head);
  if (w === 1) { fx.explode(new THREE.Vector3(x, 0.4, z), 1.7); fx.shock({ x, y: 0, z }, 4.2, 0xffc070, 0.4); jolt(0.4); horde.blast(x, z, 2.5, 1.2); for (const s of [-1.4, 1.4]) fireSpot(x + fx0 * s, z + fz0 * s); for (const G of horde.giants) if (G.live && Math.hypot(G.root.position.x - x, G.root.position.z - z) < 2.5 + G_R * 0.6) hurtG(G, 2); }
  else for (const s of [-2.8, -1.4, 1.4, 2.8]) fireSpot(x + cx * s, z + cz * s); } /* FIRE WALL: five fires side by side, right across the street and the pavements */
function dropCanister(c, w = 0) { const m = sk.canister() || makeCanister(); if (w) m.scale.multiplyScalar(w === 3 ? 2.2 : 1.5); m.position.copy(c.pos); m.position.y -= 0.35; m.rotation.y = c.head; scene.add(m); cans.push({ m, w, vx: c.vel.x * 0.55, vy: -1, vz: c.vel.z * 0.55, head: c.head }); drops++; sfx.throw(); }
function updateCans(dt) { for (let i = cans.length - 1; i >= 0; i--) { const k = cans[i], m = k.m; k.vy -= 14 * dt; m.position.x += k.vx * dt; m.position.y += k.vy * dt; m.position.z += k.vz * dt; m.rotation.x = Math.min(1.1, m.rotation.x + dt * 1.8);
    if (m.position.y > 0.15) continue; scene.remove(m); cans.splice(i, 1); landCan(k, m.position.x, m.position.z); } }
function napalm(x, z, head) { const at = new THREE.Vector3(x, 0, z), cx = Math.cos(head), cz = -Math.sin(head); // (cx, cz): across the line of flight
  fx.explode(at.clone().setY(0.15), 0.75); fx.sparks({ x, y: 0.3, z }, 14, { c: [0xffe08a, 0xff5a1a], speed: 5, up: 3, life: 0.6 }); fx.glow(at, 3.2, 0xff7a1a, 0.5, 0.8); fx.scorch(at, 1.5, 26); boom(); jolt(0.18);
  for (const s of [-1, 1]) fx.ignite(new THREE.Vector3(x + cx * 0.55 * s, 0.1, z + cz * 0.55 * s), 1.0, NAPALM_T); // a wall of fire across the street, two fires wide
  addPatch(x, z); hitThings(x, z, 'napalm'); sk.napalm(x, z); }
function fireRocket(p) { const c = craft; if (!c || !c.alive || c.crash) return false; if (c.baseD < BASE_R) { if (now() - (c.ringT || 0) > 1.5) { c.ringT = now(); popup(c.pos, 'LEAVE THE RING TO FIRE', '#9fd6ff', c.pos); } return false; } if (c.ammo <= 0 && !(wpn === 3 && nukes > 0)) { if (now() - (c.emptyT || 0) > 2) { c.emptyT = now(); banner('OUT OF ROCKETS: BACK TO BASE'); } return false; } if (c.fireCd > 0) return false;
  const w = useW(c); c.fireCd = AR.fireEvery * (w ? 1.7 : 1); shots++; c.g.updateMatrixWorld(true); c.pod = 1 - c.pod; const from = new THREE.Vector3(c.pod ? 0.72 : -0.72, -0.24, 0.5).applyMatrix4(c.g.matrixWorld);
  { const px = Math.cos(c.head), pz = -Math.sin(c.head); for (const s of w === 2 ? [-1.8, 0, 1.8] : [0]) { const q = new THREE.Vector3(p.x + px * s, 0.05, p.z + pz * s), m = sk.rocket() || makeRocket(); if (w === 1 || w === 3) m.scale.multiplyScalar(w === 3 ? 2.2 : 1.6); m.position.copy(from); m.lookAt(q); scene.add(m); rockets.push({ m, from, to: q, w, t: 0, T: Math.max(0.15, from.distanceTo(q) / 34), sm: 0 }); } } fx.puff('flame', from, 0.35); sfx.whoosh(); sfx.throw(); return true; }
function updateRockets(dt) { for (let i = rockets.length - 1; i >= 0; i--) { const r = rockets[i]; r.t += dt; const k = Math.min(1, r.t / r.T); r.m.position.lerpVectors(r.from, r.to, k); r.sm -= dt; if (r.sm <= 0) { r.sm = 0.02; fx.puff('smoke', r.m.position, 0.32); }
    if (k < 1) continue; scene.remove(r.m); rockets.splice(i, 1); const p = r.to; if (r.w === 3) { nukeAt(p.x, p.z); continue; } const big = r.w === 1, RR = big ? ROCKET_R * 1.7 : ROCKET_R; if (big) { fx.explode(p.clone().setY(0.4), 1.7); fx.shock(p, 4.6, 0xffc070, 0.4); jolt(0.35); } fx.explode(p.clone().setY(0.15), 0.95); fx.shock(p, 2.8, 0xffc070, 0.32); fx.scorch(p, 0.9, 18); boom(); jolt(0.22);
    horde.blast(p.x, p.z, RR, 1); hitThings(p.x, p.z, 'rocket'); sk.blast(p);
    for (const G of horde.giants) if (G.live && Math.hypot(G.root.position.x - p.x, G.root.position.z - p.z) < RR + G_R * 0.6) hurtG(G, GIANT.rocket * (big ? 2 : 1)); } } // a Grave Giant in the blast takes a hit
function clearWeapons() { for (const b of arBlasts) b.remove(); arBlasts.length = 0; for (const k of cans) scene.remove(k.m); cans.length = 0; for (const r of rockets) scene.remove(r.m); rockets.length = 0; patches.length = 0; patchesChanged(); patchMesh.count = 0; burning.length = 0; buckets.clear();
  for (const r of rocks) for (const q of r.parts) twisters.wreck.free(q.f); rocks.length = 0; for (const s of shards) twisters.wreck.free(s.f); shards.length = 0; for (const m of rings) { m.visible = false; m.userData.used = false; } }

// ---------- the aircraft ----------
const shadowGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
/* the heli's aim: a cone of light from the heli down to where its rockets land (like the airfield tower's beam) */ const aimBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.9, 1, 18, 1, true).translate(0, -0.5, 0), glowM(0xffe27a, 0.2)), aimSpot = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24).rotateX(-Math.PI / 2), glowM(0xffe27a, 0.32)); aimBeam.material.side = THREE.DoubleSide; aimBeam.renderOrder = aimSpot.renderOrder = 4; aimSpot.material.depthTest = false; scene.add(aimBeam, aimSpot); aimBeam.visible = false; const DOWN = new THREE.Vector3(0, -1, 0), tmpB = new THREE.Vector3();
const reticle = new THREE.Mesh(mergeGeometries([new THREE.RingGeometry(0.78, 1.08, 32), new THREE.CircleGeometry(0.2, 16)]).rotateX(-Math.PI / 2), glowM(0xffa83a, 0.7)); reticle.material.depthTest = false; reticle.renderOrder = 4; reticle.position.y = 0.14; reticle.visible = false; scene.add(reticle); /* (drawn over the buildings: a street between tall ones would hide it) */ // where the napalm would land, or (the heli) where its rockets go: the circle ahead of its nose
// BUILDING! the building the aircraft is about to fly into glows red: a box round its walls and its edges
const warnG = new THREE.Group(), warnGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), warnBox = new THREE.Mesh(warnGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })), warnEdge = new THREE.LineSegments(new THREE.EdgesGeometry(warnGeo), new THREE.LineBasicMaterial({ color: 0xff6a4a, transparent: true, opacity: 0.9 }));
warnBox.renderOrder = warnEdge.renderOrder = 3; warnG.add(warnBox, warnEdge); warnG.visible = false; scene.add(warnG);
const wayMark = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.72, 24).rotateX(-Math.PI / 2), glowM(0xffd24a, 0.7)); wayMark.position.y = 0.15; wayMark.visible = false; scene.add(wayMark);
let craft = null;
function makeCraft(kind) { if (craft) { scene.remove(craft.g); scene.remove(craft.shadow); } const S = CRAFTS[kind], heli = kind === 'heli', g = sk.dress(heli ? makeHeli() : makeBomber(), kind); scene.add(g); const shadow = new THREE.Mesh(shadowGeo, shadowMat); scene.add(shadow);
  const b = bases[0], at = heli ? b.pad : b.pos;
  craft = { kind, S, g, shadow, pos: new THREE.Vector3(at.x, heli ? 0.5 : S.alt, at.z), vel: new THREE.Vector3(), head: Math.atan2(-at.x, -at.z), bank: 0, pitch: 0, hp: S.hp, ammo: S.ammo, alt: heli ? 0.5 : S.alt, dropT: 0, fireCd: 0.6, alive: true, crash: null, way: null, wayT: 0, pod: 0, bumpT: 0, kickT: 0, kickR: 0, lastHit: null, t: 0, ammoAcc: 0, refilling: false, base: b, baseD: 0, tickT: 0, smT: 0 };
  if (!heli) craft.vel.set(Math.sin(craft.head) * S.speed, 0, Math.cos(craft.head) * S.speed); setPods(g, S.ammo); place(craft); }
function place(c) { const g = c.g; g.position.copy(c.pos); g.rotation.set(0, c.head, 0); g.rotateZ(c.bank); g.rotateX(c.pitch);
  c.shadow.position.set(c.pos.x, 0.07, c.pos.z); c.shadow.scale.setScalar(c.kind === 'heli' ? 1.3 : 1.45); c.shadow.material.opacity = 0.32 - Math.min(0.18, c.pos.y * 0.02); }
const held = () => dropHeld || keys[' '] || botDrop || (!!craft && craft.autoDrop > 0); // SPACE held down (or the autopilot, or a double-tapped drop under way)
const dropping = () => !!craft && craft.kind === 'bomber' && (craft.ammo > 0 || (wpn === 3 && nukes > 0)) && held(), firing = () => !!craft && craft.kind === 'heli' && craft.alive && !craft.crash && held();
const aimPoint = (c, out) => out.set(c.pos.x + Math.sin(c.head) * AIM_D, 0, c.pos.z + Math.cos(c.head) * AIM_D); // the heli's circle: where a rocket fired now comes down
const tmpA = new THREE.Vector3(), tmpW = new THREE.Vector3();
/* the keys steer from the pilot's seat: A or the left arrow always turns the aircraft to its own left, D or the right arrow to its own right,
   whichever way it faces on screen, so holding one flies a circle; W and S (up and down arrows) fly the heli forward and back.
   A finger or mouse drag still points where to go on the screen */
const keyTurn = () => ((keys.a || keys.arrowleft) ? 1 : 0) - ((keys.d || keys.arrowright) ? 1 : 0), keyFwd = () => ((keys.w || keys.arrowup) ? 1 : 0) - ((keys.s || keys.arrowdown) ? 1 : 0);
function steerIn() { const sx = stick.x, sy = stick.y, mag = Math.min(1, Math.hypot(sx, sy));
  if (mag < 0.05) return { x: 0, z: 0, mag: 0 }; tmp.copy(right).multiplyScalar(sx).addScaledVector(upv, -sy).normalize(); return { x: tmp.x, z: tmp.z, mag }; }
function updateCraft(dt) { const c = craft, S = c.S; c.t += dt; sk.tick(dt, c); if (c.crash) { crashTick(c, dt); return; } if (c.spin) { spinTick(c, dt); return; }
  const st = steerIn(); let nb = bases[0], nd = 1e9; for (const b of bases) { const d = Math.hypot(b.pos.x - c.pos.x, b.pos.z - c.pos.z); if (d < nd) { nd = d; nb = b; } } c.base = nb; c.baseD = nd;
  const over = nd < BASE_R, need = c.ammo < S.ammo || c.hp < S.hp; if (over && need) c.orbit = true; else if (!need || nd > BASE_R + 5) { c.orbit = false; c.orbS = 0; }
  if (c.kind === 'bomber') {
    let want = c.head, rate = S.turn; const kt = keyTurn();
    if (kt) c.way = null; else if (st.mag > 0.12) { want = Math.atan2(st.x, st.z); rate *= Math.min(1, 0.3 + st.mag); c.way = null; }
    else if (c.way) { const dx = c.way.x - c.pos.x, dz = c.way.z - c.pos.z; c.wayT += dt; if (dx * dx + dz * dz < 2.4 * 2.4 || c.wayT > 7) c.way = null; else want = Math.atan2(dx, dz); }
    else if (c.orbit) { const ph = Math.atan2(c.pos.x - nb.pos.x, c.pos.z - nb.pos.z), aim = (s) => { const ta = ph + s * 0.9; return Math.atan2(nb.pos.x + Math.sin(ta) * 4.4 - c.pos.x, nb.pos.z + Math.cos(ta) * 4.4 - c.pos.z); }, off = (s) => Math.abs(Math.atan2(Math.sin(aim(s) - c.head), Math.cos(aim(s) - c.head)));
      if (!c.orbS) c.orbS = off(1) <= off(-1) ? 1 : -1; want = aim(c.orbS); } // over the airfield it circles (a point running round a circle inside the ring) until it is full
    if (!kt && st.mag <= 0.12 && (c.way || c.orbit)) want = steerClear(c, want); // on autopilot it banks round anything tall in its way
    if (Math.abs(c.pos.x) > FB.x || Math.abs(c.pos.z) > FB.z) { want = Math.atan2(-c.pos.x, -c.pos.z); rate = S.turn; if (c.t - (c.edgeT || -9) > 4) { c.edgeT = c.t; popup(c.pos, 'TURNING BACK', '#9fd6ff', c.pos); } } // off the edge of the map: it banks round
    let dh = want - c.head; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); let turn = kt && !(Math.abs(c.pos.x) > FB.x || Math.abs(c.pos.z) > FB.z) ? kt * S.turn * dt : Math.max(-rate * dt, Math.min(rate * dt, dh));
    if (c.kickT > 0) { c.kickT -= dt; turn += c.kickR * dt; } c.head += turn; // knocked aside by a building it flew into
    c.bank += (Math.max(-0.8, Math.min(0.8, -turn / Math.max(dt, 1e-4) * 0.42)) - c.bank) * Math.min(1, dt * 5);
    c.vel.set(Math.sin(c.head) * S.speed, 0, Math.cos(c.head) * S.speed); c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt;
    /* a double-tapped spot: when the canisters would land on it, a short run of them goes down */ if (c.dropAt) { c.dropAtT += dt; const ax = c.pos.x + c.vel.x * 0.5 - c.dropAt.x, az = c.pos.z + c.vel.z * 0.5 - c.dropAt.z; if (Math.hypot(ax, az) < 2) { c.autoDrop = 0.75; c.dropAt = null; } else if (c.dropAtT > 9) c.dropAt = null; } if (c.autoDrop > 0) c.autoDrop -= dt;
    const low = dropping(); c.alt += Math.max(-6 * dt, Math.min(4.2 * dt, (low ? S.low : S.alt) - c.alt)); c.pos.y = c.alt; c.pitch += ((low && c.alt > S.low + 0.2 ? 0.18 : 0) - c.pitch) * Math.min(1, dt * 4); // it dips its nose to go down and drop, and climbs back quickly when you let go
    c.dropT -= dt; if (low && c.dropT <= 0) { const w = useW(c); c.dropT = AR.dropEvery * (w ? 1.7 : 1); dropCanister(c, w); setPods(c.g, c.ammo); }
    if ((dropHeld || keys[' ']) && c.ammo <= 0 && c.t - (c.emptyT || -9) > 3) { c.emptyT = c.t; banner('OUT OF NAPALM: BACK TO BASE'); }
    for (const p of c.g.userData.props) p.rotation.z += dt * 40;
    setPlaneEngine(state === 'play' ? 0.3 + (low ? 0.14 : 0) : 0, 1 + Math.abs(c.bank) * 0.12 + (low ? 0.08 : 0)); // your own engine: a soft, steady drone that rises as you dive to drop
    // where the canisters would come down: a ring on the street ahead
    aimBeam.visible = aimSpot.visible = false; reticle.visible = c.ammo > 0 && state === 'play'; if (reticle.visible) { const h = Math.max(0.1, c.alt - 0.5), tf = (-1 + Math.sqrt(1 + 28 * h)) / 14; reticle.scale.setScalar(1); reticle.position.set(c.pos.x + c.vel.x * 0.55 * tf, 0.14, c.pos.z + c.vel.z * 0.55 * tf); reticle.material.opacity = low ? 1 : 0.62 + Math.sin(c.t * 5) * 0.14; }
  } else {
    let wx = 0, wz = 0, k = 2; const kt = keyTurn() || botKT, kf = keyFwd(); rtT -= dt;
    if (kt || kf) { c.way = null; c.kbT = c.t; c.head += kt * 2.6 * dt; const v = S.speed * (kf > 0 ? 1 : kf < 0 ? -0.6 : 0); wx = Math.sin(c.head) * v; wz = Math.cos(c.head) * v; k = 2.8; }
    else if (st.mag > 0.12) { wx = st.x * S.speed * st.mag; wz = st.z * S.speed * st.mag; c.way = null; k = 2.8; }
    else if (c.way) { const d0 = Math.hypot(c.way.x - c.pos.x, c.way.z - c.pos.z), sp0 = Math.hypot(c.vel.x, c.vel.z); if (d0 < 0.5 && sp0 < 0.25) c.way = null; /* (there, and stopped: it doesn't run on past the spot) */ else { const tw = heliRoute(c), dx = tw.x - c.pos.x, dz = tw.z - c.pos.z, d = Math.hypot(dx, dz) || 1;
      let v = Math.min(1, d0 / 3.5) * S.speed; if (sp0 > 0.5) v *= 0.45 + 0.55 * Math.max(0, (c.vel.x * dx + c.vel.z * dz) / (sp0 * d)); /* slower round a sharp turn, so it doesn't swing wide into a corner */
      wx = dx / d * v; wz = dz / d * v; k = d0 < 1.5 || bldAhead(c, 0.45) ? 6 : 3.2; } } // a tapped spot: there, round the tall buildings (braking firmly at the end, and quick to swing back if its course would take it into one)
    else if (over && need) { const dx = nb.pad.x - c.pos.x, dz = nb.pad.z - c.pos.z, d = Math.hypot(dx, dz); if (d > 0.3) { const v = Math.min(1, d / 2.5) * S.speed * 0.6; wx = dx / d * v; wz = dz / d * v; } } // over the airfield it settles on the pad
    c.vel.x += (wx - c.vel.x) * Math.min(1, dt * k); c.vel.z += (wz - c.vel.z) * Math.min(1, dt * k);
    c.pos.x = Math.max(-FB.x, Math.min(FB.x, c.pos.x + c.vel.x * dt)); c.pos.z = Math.max(-FB.z, Math.min(FB.z, c.pos.z + c.vel.z * dt));
    const onPad = over && need && Math.hypot(nb.pad.x - c.pos.x, nb.pad.z - c.pos.z) < 1.2 && st.mag < 0.12 && !c.way && !kt && !kf; c.alt += ((onPad ? 0.95 : S.alt) - c.alt) * Math.min(1, dt * 1.8); c.pos.y = c.alt + Math.sin(c.t * 1.9) * 0.08;
    const sp = Math.hypot(c.vel.x, c.vel.z), kb = c.t - (c.kbT ?? -9) < 1.2; let want = c.head; if (kt || kf) want = c.head; else if (sp > 0.7 && !kb && c.bumpT <= 0) want = Math.atan2(c.vel.x, c.vel.z); // it faces the way it flies: turning it is how you aim
    let dh = want - c.head; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.head += Math.max(-3.5 * dt, Math.min(3.5 * dt, dh));
    const fwd = c.vel.x * Math.sin(c.head) + c.vel.z * Math.cos(c.head), side = c.vel.x * Math.cos(c.head) - c.vel.z * Math.sin(c.head); c.pitch += (fwd * 0.05 - c.pitch) * Math.min(1, dt * 4); c.bank += (side * 0.05 - c.bank) * Math.min(1, dt * 4); // it leans into the way it flies
    // rockets: while FIRE (or SPACE) is held they go one after another, each to where the circle is as it fires
    c.fireCd -= dt; if (firing() && c.fireCd <= 0 && state === 'play') fireRocket(aimPoint(c, tmpA));
    for (const p of c.g.userData.props) p.rotation.y += dt * 32; if (c.g.userData.tail) c.g.userData.tail.rotation.x += dt * 40;
    setPlaneEngine(state === 'play' ? 0.28 : 0, 0.72 + sp * 0.02); // the rotor: lower and softer
    // the circle on the ground ahead of the nose (dim where it can't fire: inside the airfield's ring, or out of rockets)
    reticle.visible = false; aimSpot.visible = aimBeam.visible = state === 'play'; if (aimBeam.visible) { aimPoint(c, tmpA); c.g.updateMatrixWorld(true); const from = tmpB.set(0, -0.3, 0.45).applyMatrix4(c.g.matrixWorld), d = tmpA.clone().setY(0.05).sub(from), L0 = d.length(); aimBeam.position.copy(from); aimBeam.quaternion.setFromUnitVectors(DOWN, d.normalize()); aimBeam.scale.set(1, L0, 1); aimSpot.position.set(tmpA.x, 0.12, tmpA.z); const o = c.ammo <= 0 || nd < BASE_R ? 0.35 : firing() ? 1.6 : 1 + Math.sin(c.t * 5) * 0.15; aimBeam.material.opacity = 0.2 * o; aimSpot.material.opacity = 0.32 * o; }
  }
  // big buildings: a warning just before (the building glows red, BUILDING!), then the crash
  if (state === 'play') { c.bumpT = Math.max(0, c.bumpT - dt); const rc = BLD.rc[c.kind], hb = blockerAt(c.pos.x, c.pos.z, c.alt, rc); if (hb) { if (c.bumpT <= 0) crashInto(c, hb); else pushOut(c, hb, rc); }
    setWarn(c.alive && c.bumpT <= 0 ? bldAhead(c, lookT(c, BLD.warn[c.kind]), null, c.kind === 'bomber' && dropping() ? Math.min(c.alt, S.low) : c.alt) : null, c); }
  // reload and repair while over the airfield
  if (over && need) { if (!c.refilling) { c.refilling = true; c.ammoAcc = 0; } c.ammoAcc += dt * S.ammo / S.reload; while (c.ammoAcc >= 1 && c.ammo < S.ammo) { c.ammoAcc -= 1; c.ammo++; } c.hp = Math.min(S.hp, c.hp + dt * S.repair); setPods(c.g, c.ammo);
    c.tickT -= dt; if (c.tickT <= 0) { c.tickT = 0.3; sfx.ping(3); } if (c.ammo >= S.ammo && c.hp >= S.hp) { c.refilling = false; refills++; sfx.power(); popup(c.pos, 'REARMED!', '#7dff3a', c.pos); c.toldLow = false; } }
  else c.refilling = false;
  c.smT -= dt; if (c.hp < S.hp * 0.5 && c.smT <= 0) { c.smT = c.hp < S.hp * 0.25 ? 0.05 : 0.12; fx.puff('smoke', c.pos, 0.42); if (c.hp < S.hp * 0.25) fx.puff('flame', c.pos, 0.32); } // damaged: it trails smoke, then fire
  if (c.way) { wayMark.visible = true; wayMark.position.set(c.way.x, 0.15, c.way.z); wayMark.scale.setScalar(1 + Math.sin(c.t * 8) * 0.12); } else wayMark.visible = false;
  place(c); }
// the aircraft is hurt: acid, a building it flew into, a chunk a giant threw (why: which one; the end screen says what brought you down)
function hurtCraft(dmg, why, label, color) { const c = craft; if (!c || !c.alive || c.crash || state !== 'play') return; c.hp -= dmg; c.lastHit = why; jolt(why === 'acid' ? 0.35 : 1); popup(c.pos, label, color, c.pos); sfx.hurt(); if (why !== 'acid') hitT = Math.max(hitT, 0.55);
  if (c.hp <= 0) { c.hp = 0; c.alive = false; c.crash = { t: 0, vy: 0, roll: Math.random() < 0.5 ? -1 : 1 }; banner('💥 SHOT DOWN!'); sfx.whoosh(); dropHeld = false; reticle.visible = wayMark.visible = aimBeam.visible = aimSpot.visible = false; setWarn(null); return; }
  if (c.hp < c.S.hp * 0.35 && !c.toldLow) { c.toldLow = true; banner('⚠ BADLY HIT: BACK TO BASE!'); } }
// a blob of acid from a glooper
function hitCraft(at) { const c = craft; if (!c || !c.alive || c.crash || state !== 'play') return; acidHits++; hurtT = 0.5; sfx.splat(); hurtCraft(c.S.acid, 'acid', '-' + c.S.acid + ' ACID!', '#b4ff5a'); }

// ---------- big buildings are solid (BLD above). bAt: the building on each street square, if any. A building blocks the
// aircraft when the craft is over its walls and lower than its roof plus a little ----------
let bAt = [], warnB = null, warnT = -9;
function blockerAt(x, z, alt, rc) { const cx = Math.round(x / CELL + (cols - 1) / 2), cy = Math.round(z / CELL + (rows - 1) / 2);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= cols || Y >= rows) continue; const b = bAt[Y * cols + X];
    if (!b || b.done || b.nb || alt >= b.h + BLD.margin) continue; if (Math.abs(x - b.pos.x) < b.bx + rc && Math.abs(z - b.pos.z) < b.bz + rc) return b; } return null; }
// the first one the craft would fly into within secs on its present course (or on heading head, at height alt)
function bldAhead(c, secs, head = null, alt = c.alt) { const rc = BLD.rc[c.kind], vx = head == null ? c.vel.x : Math.sin(head) * c.S.speed, vz = head == null ? c.vel.z : Math.cos(head) * c.S.speed;
  for (let t = 0.1; t <= secs + 1e-6; t += 0.1) { const b = blockerAt(c.pos.x + vx * t, c.pos.z + vz * t, alt, rc); if (b) return b; } return null; }
// how far ahead (in seconds) the BUILDING! warning looks: a heli on its way to a tapped spot stops there, so no further than that
const lookT = (c, secs) => { const sp = Math.hypot(c.vel.x, c.vel.z); return c.kind !== 'heli' || !c.way || sp < 0.05 ? secs : Math.min(secs, (Math.hypot(c.way.x - c.pos.x, c.way.z - c.pos.z) + 0.25) / sp); };
function clearLine(x0, z0, x1, z1, alt, rc) { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.6)); for (let k = 1; k <= n; k++) if (blockerAt(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, alt, rc)) return false; return true; }
// pushed out of a building's walls the shorter way (it says which way: [x, z])
function pushOut(c, b, rc) { const dx = c.pos.x - b.pos.x, dz = c.pos.z - b.pos.z, px = b.bx + rc - Math.abs(dx), pz = b.bz + rc - Math.abs(dz);
  if (px < pz) { const s = Math.sign(dx) || 1; c.pos.x += s * (px + 0.02); return [s, 0]; } const s = Math.sign(dz) || 1; c.pos.z += s * (pz + 0.02); return [0, s]; }
// flown into: a big jolt, an explosion and sparks where it hit, the building comes down (and counts as lost), the craft is
// knocked back, and nothing else can hurt it that way for a second
function crashInto(c, b) { const rc = BLD.rc[c.kind], n = pushOut(c, b, rc), at = new THREE.Vector3(c.pos.x - n[0] * rc, Math.min(c.alt, b.h * 0.8), c.pos.z - n[1] * rc); c.bumpT = BLD.bump; bumps++;
  fx.explode(at, 1.3); fx.sparks(at, 26, { speed: 9, up: 4, life: 0.7 }); flashT = Math.max(flashT, 0.25); boom(); sfx.crunch(true);
  collapse(b, { from: at, power: 1.3 }); bLost++; score += SC.bLost; addColl(COLL.bLost, b.pos, 'CRASHED INTO IT!');
  if (c.kind === 'heli') { c.vel.set(n[0] * 6.5, 0, n[1] * 6.5); c.bank += (Math.random() < 0.5 ? -1 : 1) * 0.5; c.pitch -= 0.4; }
  else { const hx = Math.sin(c.head), hz = Math.cos(c.head), side = hx * n[1] - hz * n[0]; c.kickT = 0.45; c.kickR = (side >= 0 ? 1 : -1) * 2.1; c.bank = (side >= 0 ? -1 : 1) * 0.9; c.pos.x += n[0] * 0.3; c.pos.z += n[1] * 0.3; } // the bomber can't stop: it is knocked aside
  hurtCraft(BLD.dmg, 'building', '-' + BLD.dmg + ' CRASH!', '#ff7a5a'); }
function setWarn(b, c) { if (b !== warnB) { warnB = b; if (b) { warnG.position.set(b.pos.x, 0, b.pos.z); warnG.scale.set(b.bx * 2 + 0.14, b.h + 0.12, b.bz * 2 + 0.14); if (c && now() - warnT > 1.2) { warnT = now(); popup(c.pos, '⚠ BUILDING!', '#ff5a4a', c.pos); sfx.ping(10); } } }
  warnG.visible = !!b; if (b) { const k = 0.5 + 0.5 * Math.sin(played * 24); warnBox.material.opacity = 0.16 + 0.32 * k; warnEdge.material.opacity = 0.5 + 0.5 * k; } }
// on autopilot (a tapped spot, the minimap, circling the airfield) the bomber banks round anything tall ahead of it.
// arcHit: the first building the bomber would meet within secs, turning toward heading want as fast as it can (the curve it
// really flies), at height alt
function arcHit(c, want, secs, alt = c.alt) { const rc = BLD.rc[c.kind], S = c.S, dt = 0.1; let h = c.head, x = c.pos.x, z = c.pos.z;
  for (let t = dt; t <= secs + 1e-6; t += dt) { let dh = want - h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); h += Math.max(-S.turn * dt, Math.min(S.turn * dt, dh)); x += Math.sin(h) * S.speed * dt; z += Math.cos(h) * S.speed * dt; const b = blockerAt(x, z, alt, rc); if (b) return b; } return null; }
function steerClear(c, want) { if (!arcHit(c, want, 1.2)) return want; const s0 = Math.sign(Math.atan2(Math.sin(c.head - want), Math.cos(c.head - want))) || 1;
  for (const k of [0.35, 0.7, 1.05, 1.4, 1.8, 2.3, 2.9]) for (const s of [s0, -s0]) if (!arcHit(c, want + s * k, 1.2)) return want + s * k; return want; }
// the heli on its way to a spot: straight there when nothing tall is in the way, otherwise round the tall buildings (a map of
// how far every square is from the spot, the tall buildings left out, walked downhill to the furthest square in plain sight)
let rtF = new Int16Array(1), rtKey = -1, rtT = 0; const rtQ = [];
function routeField(ti, alt) { const N = cols * rows; if (rtF.length !== N) rtF = new Int16Array(N); rtF.fill(-1); const blk = (i) => { const b = bAt[i]; return !!b && !b.done && !b.nb && alt < b.h + BLD.margin; };
  let h = 0; rtQ.length = 0; rtF[ti] = 0; rtQ.push(ti); while (h < rtQ.length) { const i = rtQ[h++], x = i % cols, d = rtF[i] + 1; for (const j of [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, i - cols, i + cols]) { if (j < 0 || j >= N || rtF[j] >= 0 || blk(j)) continue; rtF[j] = d; rtQ.push(j); } } }
function heliRoute(c) { const w = c.way, rc = BLD.rc.heli + 0.25; if (clearLine(c.pos.x, c.pos.z, w.x, w.z, c.alt, rc)) return w; // (a little room to spare: it never quite flies the line it plans)
  const inG = (q) => { q.cx = Math.max(0, Math.min(cols - 1, q.cx)); q.cy = Math.max(0, Math.min(rows - 1, q.cy)); return q; }, tc = inG(toCell(w.x, w.z, cols, rows)), hc = inG(toCell(c.pos.x, c.pos.z, cols, rows)), ti = tc.cy * cols + tc.cx; // (a spot outside town, the airfield say: by way of the nearest edge of town)
  if (ti !== rtKey || rtT <= 0) { rtKey = ti; rtT = 1; routeField(ti, c.alt); }
  let i = hc.cy * cols + hc.cx, best = null, first = null; for (let s = 0; s < 8; s++) { let nx = -1, nv = rtF[i] >= 0 ? rtF[i] : 32000; const x = i % cols; for (const j of [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, i - cols, i + cols]) if (j >= 0 && j < rtF.length && rtF[j] >= 0 && rtF[j] < nv) { nv = rtF[j]; nx = j; } if (nx < 0) break; i = nx;
    const p = toWorld(i % cols, (i / cols) | 0, cols, rows); if (!first) first = p; if (clearLine(c.pos.x, c.pos.z, p.x, p.z, c.alt, rc)) best = p; else if (best) break; }
  if (best) return tmpW.set(best.x, 0, best.z); const r0 = BLD.rc.heli; /* nothing in plain sight with room to spare: the straight line or the first step if either only just clears, else it stops (never straight through a building) */
  if (clearLine(c.pos.x, c.pos.z, w.x, w.z, c.alt, r0)) return w; if (first && clearLine(c.pos.x, c.pos.z, first.x, first.z, c.alt, r0)) return tmpW.set(first.x, 0, first.z); c.way = null; return c.pos; }
// a spot the heli is sent to inside (or right up against) a big building's walls, by a tap on its front or on the minimap:
// it goes to a free spot just outside them instead: the near side, unless the tap was right by another of its walls
function outOf(p) { const c = craft; if (!c || c.kind !== 'heli') return p; const alt = c.S.alt, rc = BLD.rc.heli + 0.45, b = blockerAt(p.x, p.z, alt, rc); if (!b) return p;
  const ex = b.bx + rc + 0.02, ez = b.bz + rc + 0.02, score = (x, z) => Math.hypot(x - p.x, z - p.z) + 0.5 * Math.hypot(x - c.pos.x, z - c.pos.z); let best = null, bs = 1e9;
  for (const [x, z] of [[b.pos.x + ex, p.z], [b.pos.x - ex, p.z], [p.x, b.pos.z + ez], [p.x, b.pos.z - ez]]) { if (blockerAt(x, z, alt, rc)) continue; const s = score(x, z); if (s < bs) { bs = s; best = [x, z]; } }
  for (let r = 0.5; !best && r <= 8; r += 0.5) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.2832, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; if (blockerAt(x, z, alt, rc)) continue; const s = score(x, z); if (s < bs) { bs = s; best = [x, z]; } } /* (boxed in by the buildings next door: the nearest free spot round about) */
  if (best) { p.x = best[0]; p.z = best[1]; } return p; }
// shot down: it spins down trailing fire, hits the ground in a fireball and breaks up
function crashTick(c, dt) { const C = c.crash, g = c.g; C.t += dt;
  if (!C.down) { C.vy += 9 * dt; if (c.kind === 'bomber') { c.head += C.roll * 0.6 * dt; c.pos.x += Math.sin(c.head) * c.S.speed * 0.9 * dt; c.pos.z += Math.cos(c.head) * c.S.speed * 0.9 * dt; c.bank += C.roll * 4 * dt; c.pitch = Math.min(0.9, C.t * 0.6); }
    else { c.head += dt * 7; c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt; c.vel.multiplyScalar(0.97); c.bank = Math.sin(C.t * 5) * 0.4; }
    c.pos.y -= C.vy * dt; place(c); if (Math.random() < dt * 30) { fx.puff('flame', c.pos, 0.7); fx.puff('smoke', c.pos, 0.7); }
    if (c.pos.y > 0.45) return; C.down = true; const at = c.pos.clone().setY(0);
    fx.explode(at.clone().setY(0.6), 2.2); fx.scorch(at, 2.2, 26); fx.ignite(at.clone().setY(0.1), 1, 8); jolt(1); flashT = Math.max(flashT, 0.35); sfx.boom(); setTimeout(() => sfx.boom(), 180);
    sk.crash(at, g); { const xr = g.getObjectByName('xray'); if (xr) g.remove(xr); } // (its see-through-walls silhouette is not part of the wreck)
    twisters.tear(g, at, new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()), null, [], [], { collapse: true, now: true, power: 1.2, push: new THREE.Vector3(Math.sin(c.head) * 4, 2, Math.cos(c.head) * 4) }); c.shadow.visible = false; setPlaneEngine(0);
    finish('down'); } }

// ---------- GRAVE GIANTS (GIANT above; horde.js walks, poses and fells them). Here: when they rise, when they throw, and the
// chunks. A chunk is the top of the building the giant tore into, cut into real pieces of itself (wreck.js, the same pieces a
// building breaks into), held overhead while a red ring on the ground marks where it is going, then thrown on an arc through
// the point where the aircraft will be. Whatever a chunk lands on, and the building it came from, is on the giant: none of it
// counts against you ----------
let gPlan = [], gUp = 0, gDown = 0; const rocks = [], shards = [], rockO = new THREE.Object3D(), qa = new THREE.Quaternion(), ea = new THREE.Euler(), gp = new THREE.Vector3();
const rings = []; { const g = mergeGeometries([new THREE.RingGeometry(1.5, 1.86, 40), new THREE.RingGeometry(0.4, 0.55, 24), new THREE.CircleGeometry(0.15, 12)]).rotateX(-Math.PI / 2); for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(g, glowM(0xff3a2a, 0.8)); m.material.depthTest = false; m.position.y = 0.16; m.visible = false; m.renderOrder = 4; scene.add(m); rings.push(m); } } // (seen through the buildings, like the aiming circles)
const flightT = (d) => 1.15 + d * 0.05; // how long a thrown chunk takes to get there
function spawnGiant() { const c = craft, ok = (x, z) => bases.every((b) => Math.hypot(b.pos.x - x, b.pos.z - z) > 18) && (!c || Math.hypot(c.pos.x - x, c.pos.z - z) > 11) && horde.giants.every((G) => Math.hypot(G.root.position.x - x, G.root.position.z - z) > 12);
  let at = null; if (gUp === 0 && cemCell) { const w = toWorld(cemCell[0], cemCell[1], cols, rows); if (ok(w.x, w.z)) at = w; } // the first comes up out of the graveyard
  for (let t = 0; t < 90 && !at; t++) { const r = roads[(Math.random() * roads.length) | 0], w = toWorld(r[0], r[1], cols, rows); if (ok(w.x, w.z) || t > 70) at = w; }
  if (!at) return; const G = horde.addGiant(at.x, at.z, L().gHP); G.cd = 3.5 + Math.random() * 2; gUp++; const p = new THREE.Vector3(at.x, 0, at.z);
  fx.scorch(p, 2.6, 30); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; fx.dust({ x: at.x + Math.cos(a) * 1.4, y: 0, z: at.z + Math.sin(a) * 1.4 }, 1.3, Math.cos(a) * 2.5, Math.sin(a) * 2.5); } for (let i = 0; i < 14; i++) fx.bit({ x: at.x, y: 0.3, z: at.z }, 1.2, 0x4a3a2a, 6);
  if (toScreen(p).on) { jolt(0.6); sfx.stomp(4); } sfx.groan(); if (state === 'play') banner('💀 A GRAVE GIANT RISES!'); }
function updateGiants(dt) { while (gPlan.length && played >= gPlan[0]) { gPlan.shift(); spawnGiant(); } const c = craft;
  for (const G of horde.giants) { if (!G.live) continue; const P = G.root.position;
    // napalm: every fire patch it walks into (or that comes down on it) burns it, once each
    for (const Pt of patches) { if (Pt.t < 0.25 || Math.hypot(Pt.x - P.x, Pt.z - P.z) > Pt.r + G_R * 0.75) continue; if (!Pt.hg) Pt.hg = new Set(); if (Pt.hg.has(G)) continue; Pt.hg.add(G); G.burn = 3; hurtG(G, GIANT.fire); if (!G.live) break; }
    if (!G.live) continue;
    /* fly in close and it goes for you: 3 times in 4 it grabs you and tosses you, otherwise (about half the time) it swipes at you. Either costs a third of your health and sends you spinning; it only brings you down when you were already below a third */ G.atkCd = Math.max(0, (G.atkCd || 0) - dt);
    if (c && c.alive && !c.crash && !c.spin && !craftView.safe && state === 'play' && G.st !== 'rise' && G.atkCd <= 0 && Math.hypot(c.pos.x - P.x, c.pos.z - P.z) < GIANT.grabR) { const r = Math.random(), grab = r < GIANT.grab, swipe = !grab && Math.random() < GIANT.swipe; G.atkCd = grab || swipe ? 3 : 1; if (grab || swipe) giantHit(G, c, grab); }
    if (G.st === 'walk') { G.cd -= dt; if (G.cd <= 0 && c && c.alive && !c.crash && !craftView.safe && state === 'play') { const d = Math.hypot(c.pos.x - P.x, c.pos.z - P.z); if (d < GIANT.range && d > 2.5) { const b = grabbable(G); if (b) { horde.giantGrab(G, b, GIANT.hold); G.cd = GIANT.cd[0] + Math.random() * (GIANT.cd[1] - GIANT.cd[0]); } else G.cd = 0.7; } else G.cd = 0.4; } }
    if (G.rock && G.rock.held && !G.rock.locked) { if (G.st === 'throw' || (G.st === 'hold' && G.t > G.hold - GIANT.lock)) G.rock.locked = true; else aimGiant(G); } } } // while it lifts and holds the chunk up it aims where the aircraft is going, until a moment before the throw: then the ring stays put
// the building it can reach (the tallest on the squares round it, if near enough)
function grabbable(G) { const P = G.root.position, cx = Math.round(P.x / CELL + (cols - 1) / 2), cy = Math.round(P.z / CELL + (rows - 1) / 2); let best = null, bd = GIANT.reach;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= cols || Y >= rows) continue; const b = bAt[Y * cols + X]; if (!b || b.done || b.nb) continue; const d = Math.hypot(b.pos.x - P.x, b.pos.z - P.z) - Math.min(b.bx, b.bz); if (d < bd) { bd = d; best = b; } } return best; }
// where the aircraft will be when the chunk gets there (as it is flying now): the ring goes on the ground under that point
function aimGiant(G) { const c = craft, r = G.rock; if (!c) return; horde.handsOf(G, gp); const rem = (G.st === 'lift' ? 0.45 - G.t + G.hold : G.st === 'hold' ? G.hold - G.t : 0) + 0.12;
  let lead = Math.max(0, rem) + flightT(Math.hypot(c.pos.x - gp.x, c.pos.z - gp.z)); const sp = Math.hypot(c.vel.x, c.vel.z); if (sp * lead > 16) lead = 16 / sp;
  r.aim.set(c.pos.x + c.vel.x * lead, Math.max(1, c.alt), c.pos.z + c.vel.z * lead); G.face = Math.atan2(r.aim.x - G.root.position.x, r.aim.z - G.root.position.z); }
// the giant's hands reach the building: it breaks up (into its own pieces) and the top of it comes away in the giant's hands
function onGiantRip(G) { const b = G.bld; if (!b || b.done || state === 'over') return false; free(b.obj); const meshes = [], take = (o) => o.traverse((m) => { if (m.isMesh && m.visible && !m.isInstancedMesh && m.geometry) meshes.push(m); });
  b.obj.updateMatrixWorld(true); take(b.obj); if (b.obj === b.b) for (const m of b.b.userData.extras || []) if (m.parent && m.visible) { m.updateMatrixWorld(true); take(m); }
  let frags = meshes.length ? twisters.wreck.fracture(meshes, { coarse: true }) : [];
  if (frags.length) { frags.sort((p, q) => q.centre.y - p.centre.y); const top = frags[0].centre.y, keep = frags.filter((f, i) => i < 4 && f.centre.y > top - 1.4); for (const f of frags) if (!keep.includes(f)) twisters.wreck.free(f); frags = keep; }
  collapse(b, { from: G.root.position, power: 0.8, fire: false });
  if (!frags.length) return false;
  const cc = new THREE.Vector3(); for (const f of frags) cc.add(f.centre); cc.divideScalar(frags.length); let R = 0.4; const parts = frags.map((f) => { const off = f.centre.clone().sub(cc); R = Math.max(R, off.length() + f.r * 0.6); return { f, off }; });
  const s = Math.min(0.8, 1.5 / R), rk = { G, parts, p: cc, v: new THREE.Vector3(), q: new THREE.Quaternion(), spin: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 5), held: true, free: false, t: 0, s, R: R * s, aim: new THREE.Vector3(), ring: rings.find((m) => !m.userData.used) || null };
  if (rk.ring) rk.ring.userData.used = true; rocks.push(rk); G.rock = rk; aimGiant(G); placeRock(rk); if (toScreen(b.pos).on) { sfx.crunch(true); jolt(0.3); } sfx.groan(); return true; }
// the throw: an arc from its hands through the point it aimed at (the ring is under it), carrying on down from there
function onGiantRelease(G) { const r = G.rock; G.rock = null; if (!r || !r.held) return; r.held = false; r.t = 0; horde.handsOf(G, gp); r.p.copy(gp).setY(gp.y + r.R * 0.5);
  const A = r.aim, T = flightT(Math.hypot(A.x - r.p.x, A.z - r.p.z)); r.v.set((A.x - r.p.x) / T, (A.y - r.p.y + 0.5 * GIANT.g * T * T) / T, (A.z - r.p.z) / T); sfx.whoosh(); }
function placeRock(r) { for (const { f, off } of r.parts) { rockO.position.copy(off).multiplyScalar(r.s).applyQuaternion(r.q).add(r.p); rockO.quaternion.copy(r.q); rockO.scale.setScalar(r.s); twisters.wreck.place(f, rockO); } }
function updateRocks(dt) { const c = craft;
  for (let i = rocks.length - 1; i >= 0; i--) { const r = rocks[i]; r.t += dt;
    if (r.held) { const G = r.G; if (!G.live || G.rock !== r) { r.held = false; r.free = true; r.v.set(0, 1, 0); G.rock = null; } /* the giant went down holding it: it drops where it is */
      else { horde.handsOf(G, gp); gp.y += r.R * 0.5; r.p.lerp(gp, Math.min(1, dt * (r.t < 0.45 ? 7 : 30))); qa.setFromEuler(ea.set(Math.sin(r.t * 13) * 0.06, G.root.rotation.y, Math.sin(r.t * 11) * 0.06)); r.q.slerp(qa, Math.min(1, dt * 8)); } }
    if (!r.held) { r.v.y -= GIANT.g * dt; r.p.addScaledVector(r.v, dt); qa.setFromEuler(ea.set(r.spin.x * dt, r.spin.y * dt, r.spin.z * dt)); r.q.multiply(qa);
      if (!r.free && c && c.alive && !c.crash && state === 'play' && !craftView.safe && r.p.distanceTo(c.pos) < c.S.r + r.R * GIANT.hitR) { rockHit(r, i); continue; } /* (nothing reaches you over the airfield) */
      if (r.p.y <= 0.3) { rockLand(r, i); continue; } }
    placeRock(r);
    if (r.ring) { const show = !r.free && (r.held ? r.t > 0.2 : true); r.ring.visible = show && state !== 'over'; if (show) { const f = r.held && !r.locked ? 7 : 13, k = 1 + Math.sin(played * f) * 0.12; r.ring.position.set(r.aim.x, 0.16, r.aim.z); r.ring.scale.setScalar(k * (0.8 + Math.min(1.2, r.R) * 0.25)); r.ring.material.opacity = 0.6 + Math.sin(played * f) * 0.3; } } } }
function dropRing(r) { if (r.ring) { r.ring.visible = false; r.ring.userData.used = false; r.ring = null; } }
function rockHit(r, i) { rocks.splice(i, 1); dropRing(r); const at = craft.pos.clone(); fx.explode(at, 1.4); fx.sparks(at, 24, { speed: 9, up: 3, life: 0.6 }); flashT = Math.max(flashT, 0.3); boom(); sfx.crunch(true); rockHits++;
  shatterRock(r, at, 5); hurtCraft(GIANT.dmg, 'giant', '-' + GIANT.dmg + ' CHUNK!', '#ff7a5a'); }
// it comes down in town: whatever it lands on is smashed (the giant's doing, never yours)
function rockLand(r, i) { rocks.splice(i, 1); dropRing(r); const x = r.p.x, z = r.p.z, at = new THREE.Vector3(x, 0, z), seen = toScreen(at).on;
  fx.explode(at.clone().setY(0.2), 1.1); fx.shock(at, 3.4, 0xffc070, 0.4); fx.scorch(at, 1.4, 22); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; fx.dust({ x: x + Math.cos(a) * 0.9, y: 0, z: z + Math.sin(a) * 0.9 }, 1.1, Math.cos(a) * 2.6, Math.sin(a) * 2.6); }
  if (seen) { jolt(0.45); boom(); sfx.crunch(true); }
  for (const b of buildings) if (!b.done && Math.abs(x - b.pos.x) < b.bx + 0.6 && Math.abs(z - b.pos.z) < b.bz + 0.6) collapse(b, { from: at, power: 1.1 });
  horde.blast(x, z, 1.9, 1.1, 'giant'); for (let k = cars.length - 1; k >= 0; k--) { const q = cars[k]; if (q.pr && q.pr.knocked) { cars.splice(k, 1); continue; } if (Math.hypot(q.p.x - x, q.p.z - z) < 1.4) blowCar(k); } if (city.knock(x, z, 1.6, 0, 0)) freeKnocked();
  shatterRock(r, at, 3.5); }
// the chunk breaks up: its pieces fly apart, land, lie there a while and sink away
function shatterRock(r, at, pow) { for (const { f, off } of r.parts) { const o = new THREE.Object3D(); o.position.copy(off).multiplyScalar(r.s).applyQuaternion(r.q).add(r.p); o.position.y = Math.max(0.2, o.position.y); o.quaternion.copy(r.q); o.scale.setScalar(r.s); const a = Math.atan2(o.position.z - at.z, o.position.x - at.x) + (Math.random() - 0.5);
    shards.push({ f, o, v: new THREE.Vector3(Math.cos(a) * pow * (0.5 + Math.random()), 2 + Math.random() * 3, Math.sin(a) * pow * (0.5 + Math.random())), spin: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8), rest: 0, down: false }); } r.parts = []; }
function updateShards(dt) { for (let i = shards.length - 1; i >= 0; i--) { const s = shards[i], o = s.o;
    if (!s.down) { s.v.y -= 16 * dt; o.position.addScaledVector(s.v, dt); o.rotation.x += s.spin.x * dt; o.rotation.y += s.spin.y * dt; o.rotation.z += s.spin.z * dt; if (o.position.y <= 0.15) { o.position.y = 0.15; s.down = true; s.rest = 6 + Math.random() * 3; fx.dust(o.position, 0.6); } }
    else { s.rest -= dt; if (s.rest > 1.5) continue; o.position.y -= dt * 0.25; if (s.rest <= 0) { twisters.wreck.free(s.f); shards.splice(i, 1); continue; } }
    twisters.wreck.place(s.f, o); } }
// a hit on a giant (napalm, a rocket): a groan at every quarter of its health gone, and the big crash when it goes down
function giantHit(G, c, grab) { const P = G.root.position, dx = c.pos.x - P.x, dz = c.pos.z - P.z, d = Math.hypot(dx, dz) || 1; G.face = Math.atan2(dx, dz); if (G.st === 'walk') { G.st = 'throw'; G.t = 0; G.thrown = true; } sfx.groan(); jolt(0.8);
  if (c.hp < c.S.hp * GIANT.hitK) { hurtCraft(9999, 'grab', grab ? 'GRABBED!' : 'SWIPED!', '#ff5a4a'); if (c.crash) { c.crash.vy = -16; banner(grab ? '💀 GRABBED AND SLAMMED!' : '💀 SWATTED DOWN!'); } return; }
  hurtCraft(Math.round(c.S.hp * GIANT.hitK), 'grab', grab ? 'GRABBED AND TOSSED!' : 'SWIPED!', '#ff5a4a'); banner(grab ? '💀 GRABBED AND TOSSED!' : '💀 SWIPED!'); c.spin = { t: 0, T: grab ? 1.5 : 1.1, vx: dx / d * (grab ? 9 : 7), vz: dz / d * (grab ? 9 : 7), dir: Math.random() < 0.5 ? -1 : 1 }; c.way = null; }
// sent spinning by a giant: no steering for a moment, flung away from it, then flying again
function spinTick(c, dt) { const s = c.spin; s.t += dt; const k = Math.min(1, s.t / s.T), e = 1 - k; c.head += s.dir * 11 * e * dt; c.bank = Math.sin(s.t * 14) * 0.6 * e; c.pos.x += s.vx * e * dt; c.pos.z += s.vz * e * dt; c.pos.y = c.alt; place(c); if (Math.random() < dt * 14) fx.puff('smoke', c.pos, 0.5);
  if (k >= 1) { c.spin = null; c.bank = 0; if (c.kind === 'bomber') c.vel.set(Math.sin(c.head) * c.S.speed, 0, Math.cos(c.head) * c.S.speed); else c.vel.set(0, 0, 0); } }
// ---------- ENEMY UFOS (UFO_LV per town: first: seconds in, every: seconds between, max: at once, hp: tail-gun hits to
// bring one down, dmg: what a laser hit costs, sp: speed). The aircraft's TAIL GUN fires by itself at a UFO within GUN.r ----------
const UFO_LV = [{ first: 70, every: 60, max: 1, hp: 3, dmg: 8, sp: 4.2 }, { first: 55, every: 48, max: 1, hp: 3, dmg: 9, sp: 4.6 }, { first: 45, every: 40, max: 2, hp: 4, dmg: 10, sp: 5 },
  { first: 40, every: 34, max: 2, hp: 4, dmg: 11, sp: 5.3 }, { first: 32, every: 28, max: 3, hp: 5, dmg: 12, sp: 5.6 }, { first: 25, every: 22, max: 3, hp: 5, dmg: 12, sp: 6 }];
const GUN = { r: 9, every: 0.45 }, UFO_R = 7, ufos = []; let ufoT = 0, ufoDown = 0, gunT = 0;
const laserGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
function aimLine(m, a, b, w) { const d = b.clone().sub(a), L0 = d.length(); m.position.copy(a); m.lookAt(b); m.scale.set(w, w, L0); }
function spawnUfo() { const c = craft, U = UFO_LV[level - 1] || UFO_LV[0], a = Math.random() * 6.283, R = Math.max(hx, hz) + 6, g = makeSaucer(); g.scale.setScalar(0.62); g.position.set(Math.sin(a) * R, c.alt + 1.4, Math.cos(a) * R); scene.add(g);
  const line = new THREE.Mesh(laserGeo, glowM(0xff3a2a, 0.5)), beam = new THREE.Mesh(laserGeo, glowM(0x7dff3a, 0.95)); line.visible = beam.visible = false; line.renderOrder = beam.renderOrder = 4; scene.add(line, beam);
  ufos.push({ g, line, beam, hp: U.hp, U, st: 'come', t: 0, cd: 2 + Math.random(), orb: Math.random() < 0.5 ? 1 : -1, life: 34, aim: new THREE.Vector3(), flash: 0 }); banner('🛸 UFO INCOMING!'); sfx.wave(); }
function dropUfo(u) { scene.remove(u.g, u.line, u.beam); u.line.material.dispose(); u.beam.material.dispose(); const i = ufos.indexOf(u); if (i >= 0) ufos.splice(i, 1); }
function updateUfos(dt) { const c = craft, U = UFO_LV[level - 1] || UFO_LV[0]; if (state === 'play' && c && c.alive && played >= U.first) { ufoT -= dt; if (ufoT <= 0) { ufoT = U.every * (0.85 + Math.random() * 0.3); if (ufos.filter((u) => u.st !== 'fall').length < U.max) spawnUfo(); } }
  gunT -= dt;
  for (let i = ufos.length - 1; i >= 0; i--) { const u = ufos[i], P = u.g.position; u.t += dt; u.life -= dt; u.flash = Math.max(0, u.flash - dt); u.g.rotation.y += dt * 2.2; u.g.userData.ring.material.color.setRGB(u.flash > 0 ? 1 : 0.62, u.flash > 0 ? 0.3 : 1, u.flash > 0 ? 0.3 : 0.69);
    if (u.st === 'fall') { u.vy += 14 * dt; P.y -= u.vy * dt; u.g.rotation.z += dt * 3; if (Math.random() < dt * 30) fx.puff('smoke', P, 0.6); if (P.y < 0.4) { fx.explode(P.clone().setY(0.6), 1.6); fx.scorch(P.clone().setY(0), 1.6, 20); horde.blast(P.x, P.z, 1.8, 1.1, 'rocket', true); boom(); jolt(0.5); dropUfo(u); } continue; }
    if (!c || !c.alive || c.crash || state !== 'play') { u.line.visible = u.beam.visible = false; continue; }
    const dx = c.pos.x - P.x, dz = c.pos.z - P.z, d = Math.hypot(dx, dz) || 1, wantY = c.alt + 1.4; P.y += (wantY - P.y) * Math.min(1, dt * 2);
    if (u.life <= 0 || craftView.safe) { /* time up, or you are over the airfield: it backs off */ P.x -= dx / d * U.sp * dt; P.z -= dz / d * U.sp * dt; u.line.visible = u.beam.visible = false; if (u.life < -6 || d > Math.max(hx, hz) * 2.2) dropUfo(u); continue; }
    if (d > UFO_R + 1.5) { P.x += dx / d * U.sp * dt; P.z += dz / d * U.sp * dt; } else { const tx = -dz / d * u.orb, tz = dx / d * u.orb, pull = (d - UFO_R) * 0.6; P.x += (tx * U.sp * 0.6 + dx / d * pull) * dt; P.z += (tz * U.sp * 0.6 + dz / d * pull) * dt; }
    u.cd -= dt; if (u.st === 'come' && u.cd <= 0 && d < UFO_R + 3) { u.st = 'charge'; u.t = 0; sfx.ping(5); }
    if (u.st === 'charge') { if (u.t < 0.75) u.aim.set(c.pos.x + c.vel.x * 0.35, c.alt, c.pos.z + c.vel.z * 0.35); u.line.visible = true; u.line.material.opacity = 0.25 + Math.sin(u.t * 30) * 0.15 + u.t * 0.3; aimLine(u.line, P, u.aim.clone().sub(P).setLength(30).add(P), 0.06);
      if (u.t >= 1.05) { u.st = 'fire'; u.t = 0; u.line.visible = false; u.beam.visible = true; aimLine(u.beam, P, u.aim.clone().sub(P).setLength(30).add(P), 0.16); sfx.zap ? sfx.zap() : sfx.pop();
        /* a hit when the aircraft is on the line (within reach of it) */ const ax = u.aim.x - P.x, ay = u.aim.y - P.y, az = u.aim.z - P.z, al = Math.hypot(ax, ay, az) || 1, wx = c.pos.x - P.x, wy = c.alt - P.y, wz = c.pos.z - P.z, along = (wx * ax + wy * ay + wz * az) / al;
        const off = Math.hypot(wx - ax / al * along, wy - ay / al * along, wz - az / al * along); if (along > 0 && off < c.S.r * 0.8 + 0.3) hurtCraft(U.dmg, 'ufo', '-' + U.dmg + ' LASER!', '#7dff3a'); } }
    if (u.st === 'fire' && u.t > 0.2) { u.beam.visible = false; u.st = 'come'; u.cd = 2.8 + Math.random() * 1.6; }
    /* the tail gun */ if (d < GUN.r && gunT <= 0 && !craftView.safe) { gunT = GUN.every; u.hp--; u.flash = 0.12; fx.sparks(P, 6, { c: [0xffe08a, 0xffffff], speed: 4, up: 2, life: 0.3 }); sfx.pop();
      if (u.hp <= 0) { u.st = 'fall'; u.vy = 0; u.line.visible = u.beam.visible = false; ufoDown++; score += 2000; addSup(Math.round(zStart * 0.04)); popup(P, '+2000 UFO DOWN!', '#7dff3a'); banner('🛸 UFO DOWN!'); fx.explode(P.clone(), 1); } } } }
function clearUfos() { while (ufos.length) dropUfo(ufos[0]); ufoT = 0; gunT = 0; ufoDown = 0; }
function hurtG(G, dmg) { if (!G.live || state !== 'play') return; const was = G.hp; if (horde.hurtGiant(G, dmg)) giantFelled(G); else if (Math.ceil(was / G.max * 4) !== Math.ceil(G.hp / G.max * 4)) sfx.groan(); }
function giantFelled(G) { gDown++; score += GIANT.score; banner('💀 GRAVE GIANT DOWN!'); popup({ x: G.root.position.x, y: 4, z: G.root.position.z }, '+' + GIANT.score + ' GRAVE GIANT DOWN!', '#ffd24a'); sfx.wave(); setTimeout(() => sfx.power(), 300); }
function onGiantStep(G, foot) { fx.dust({ x: foot.x, y: 0, z: foot.z }, 0.9); const v = toScreen(foot); if (v.on) { sfx.stomp(3); jolt(0.08); } }
// down: it hits the ground full length. What it falls on is flattened (its doing, not yours)
function onGiantThud(G) { const P = G.root.position, fw = G.root.rotation.y, seen = toScreen(P).on; jolt(seen ? 0.9 : 0.25); if (seen) { sfx.boom(); setTimeout(() => sfx.crunch(true), 120); } fx.shock(P, 5, 0xffe2b0, 0.5);
  for (let k = 0; k < 4; k++) { const d = 1 + k * 1.5, x = P.x + Math.sin(fw) * d, z = P.z + Math.cos(fw) * d; for (let j = 0; j < 3; j++) { const a = Math.random() * 6.28; fx.dust({ x: x + Math.cos(a) * 0.8, y: 0, z: z + Math.sin(a) * 0.8 }, 1.4, Math.cos(a) * 2.4, Math.sin(a) * 2.4); }
    horde.blast(x, z, 1.5, 0.9, 'giant'); for (const b of buildings) if (!b.done && Math.abs(x - b.pos.x) < b.bx + 0.4 && Math.abs(z - b.pos.z) < b.bz + 0.4) collapse(b, { from: P, power: 0.9, fire: false }); } }
// over each giant: its name and its health; at the screen's edge an arrow when it is off screen
const gTags = [], gArrows = [];
function giantHud() { const list = horde.giants, on = state === 'play' || state === 'outro'; for (let i = 0; i < Math.max(list.length, gTags.length); i++) { const G = list[i]; let t = gTags[i], a = gArrows[i];
    if (!t) { t = document.createElement('div'); t.className = 'giTag'; t.innerHTML = '<b>💀 GRAVE GIANT</b><i><u></u></i>'; document.body.appendChild(t); gTags.push(t); a = document.createElement('div'); a.className = 'baseArrow giArrow'; a.innerHTML = '<i>➤</i><em>💀</em>'; document.body.appendChild(a); gArrows.push(a); }
    if (!G || !G.live || !on || G.root.position.y < -4) { t.style.display = 'none'; a.style.display = 'none'; continue; }
    const P = G.root.position; edgeArrow(a, gp.set(P.x, 3, P.z), state === 'play', false); gp.set(P.x, 2.5, P.z).project(cam); const onS = Math.abs(gp.x) < 1 && Math.abs(gp.y) < 1 && gp.z < 1; /* (its body on screen) */
    gp.set(P.x, 6.9, P.z).project(cam); const x = (gp.x * 0.5 + 0.5) * innerWidth, y = (-gp.y * 0.5 + 0.5) * innerHeight;
    t.style.display = onS ? 'block' : 'none'; if (onS) { if (!t._hw) { t._hw = t.offsetWidth / 2 + 4; t._h = t.offsetHeight + 4; } t.style.transform = 'translate(' + Math.round(Math.max(t._hw, Math.min(innerWidth - t._hw, x))) + 'px,' + Math.round(Math.max(hudH + 4 + t._h, Math.min(innerHeight - hudB, y))) + 'px) translate(-50%,-100%)'; /* over its head, or (a wide, short screen) just under the bar up top */ const w = Math.round(G.hp / G.max * 100) + '%'; if (t._w !== w) { t._w = w; t.lastChild.firstChild.style.width = w; } } } }

// ---------- the HUD ----------
let hudH = 116, hudB = 170, msgTop = 1e4; function measureHud() { const r = $('ta').querySelector('.top').getBoundingClientRect(); if (r.height) { hudH = Math.round(r.bottom); document.body.style.setProperty('--hudH', hudH + 'px'); }
  // hudB: how tall the band of controls along the bottom is (the mini map, the aircraft box, DROP and, on a phone, the zoom row)
  let t = innerHeight; for (const id of ['taPct', 'taMap', 'arCraft', 'arDrop', 'taZoomIn']) { const e = $(id); if (!e || e.classList.contains('hidden')) continue; const b = e.getBoundingClientRect(); if (b.height && b.top > innerHeight * 0.45) t = Math.min(t, b.top); } if (t < innerHeight) hudB = Math.round(innerHeight - t);
  const mr = $('arBaseMsg').getBoundingClientRect(); msgTop = mr.height && mr.bottom > innerHeight * 0.6 ? mr.bottom - 32 : 1e4; } // (where the RETURN TO BASE line starts, when it sits low)
addEventListener('resize', () => setTimeout(measureHud, 60));
const toScreen = (p, y = 0) => { const v = new THREE.Vector3(p.x, y, p.z).project(cam); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, on: Math.abs(v.x) < 0.86 && v.y > -0.8 && v.y < 0.62 && v.z < 1 }; };
const elMid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
// what a first-time prompt points at: the thing when it is on screen, else the arrow at the screen's edge that points to it
// (while that shows), else the spot itself: off screen, the prompt's own arrow then sits at the edge pointing out toward it.
// A spot on screen but under the bar up top or the controls along the bottom: the open screen nearest it
const onOr = (v, el) => { if (!v.on && el && el.style.display === 'block') return elMid(el); if (v.x >= 0 && v.x <= innerWidth && v.y >= 0 && v.y <= innerHeight) v.y = Math.max(hudH + 22, Math.min(innerHeight - hudB - 22, v.y)); return v; };
function edgeArrow(el, pos, show, msgOn) { const v = pos.clone().project(cam); const off = Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95 || v.z > 1; el.style.display = show && off ? 'block' : 'none'; if (!off) return v;
  const a = Math.atan2(v.y, v.x), k = 0.9 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))), W = innerWidth, H = innerHeight; let x = (Math.cos(a) * k * 0.5 + 0.5) * W, y = (-Math.sin(a) * k * 0.5 + 0.5) * H;
  y = Math.max(hudH + 36, Math.min(Math.min(H - hudB, msgOn ? msgTop : H) - 36, y)); if (x > W - 84 && y < 290) x = W - 84; // never under the top bar, the buttons down the right, the controls along the bottom or the RETURN TO BASE line
  el.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
  const dir = el.firstElementChild; if (dir && dir.tagName === 'I') dir.style.transform = 'rotate(' + (-a) + 'rad)'; return v; }
const baseArrow = document.createElement('div'); baseArrow.className = 'baseArrow'; baseArrow.innerHTML = '<i>➤</i><em>⛽</em>'; document.body.appendChild(baseArrow);
const hudCache = {}; const setT = (id, v) => { v = String(v); if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
const setW = (id, v) => { v = Math.max(0, Math.min(100, v)).toFixed(1) + '%'; if (hudCache['w' + id] !== v) { hudCache['w' + id] = v; $(id).style.width = v; } };
const setC = (id, cls, on) => { const k = 'c' + id + cls; if (hudCache[k] !== on) { hudCache[k] = on; $(id).classList.toggle(cls, on); } };
function updateHud(dt) { const c = craft, S = c.S, zl = horde.zombies;
  setT('taRank', '🧟 ' + zl); setW('taGrowFill', (zStart - zl) / zStart * 100); /* fills up as the horde goes down */ setC('taRank', 'ok', zl <= goalN);
  const m = Math.floor(tLeft / 60), s = Math.floor(tLeft % 60); setT('taTime', m + ':' + String(s).padStart(2, '0')); setC('taTime', 'low', tLeft < 20);
  setT('taTargets', horde.civs); setC('taTargets', 'low', horde.civs < civStart * 0.4); setW('arCollFill', coll); setC('arColl', 'warn', coll >= 70);
  setT('taScore', Math.max(0, Math.round(score)));
  { const pct = Math.max(0, Math.min(100, Math.round((zStart - zl) / Math.max(1, zStart - goalN) * 100))); setT('taPct', innerWidth < 761 ? '☣️ ' + pct + '%' : '☣️ ' + pct + '% CLEARED'); setC('taPct', 'ok', pct >= 100); }
  setW('arHpFill', c.hp / S.hp * 100); setC('arCraft', 'low', c.hp < S.hp * 0.35); setW('arAmmoFill', c.ammo / S.ammo * 100); setT('arAmmoTxt', c.ammo); setC('arCraft', 'empty', c.ammo <= 0);
  setW('arSupFill', Math.max(0, Math.min(100, supPct())));
  setT('arDropN', c.ammo > 0 ? c.ammo + ' LEFT' : 'RELOAD'); setC('arDrop', 'empty', c.ammo <= 0); setC('arDrop', 'held', dropping() || firing()); // DROP (the bomber) or FIRE (the heli)
  // the way home: an arrow at the edge of the screen (gold when you need it), and a word in the middle
  const needBase = c.ammo <= 0 || c.hp < S.hp * 0.35;
  let msg = ''; if (c.refilling) msg = '⛽ REARMING ' + Math.round(Math.min(c.ammo / S.ammo, c.hp / S.hp) * 100) + '%'; else if (!c.alive) msg = ''; else if (c.ammo <= 0) msg = '⛽ OUT OF ' + S.ammoName + ': RETURN TO BASE'; else if (c.hp < S.hp * 0.35) msg = '⚠ BADLY HIT: RETURN TO BASE';
  setT('arBaseMsg', msg); setC('arBaseMsg', 'on', !!msg); setC('arBaseMsg', 'refill', c.refilling); edgeArrow(baseArrow, c.base.pos, c.alive, !!msg); setC2(baseArrow, 'need', needBase);
  for (const b of bases) { b.g.userData.badge.visible = !(b === c.base && c.baseD < BASE_R + 2.5); /* (the badge would sit on top of your own aircraft) */ b.ring.material.opacity = needBase || c.refilling ? 0.35 + Math.sin(played * 6) * 0.2 : 0.22; b.beacon.rotation.y += dt * 2.4; b.sock.rotation.y = Math.sin(played * 0.7) * 0.5; b.sock.rotation.z = Math.sin(played * 3.1) * 0.08; } }
const setC2 = (el, cls, on) => { if (el._c !== on) { el._c = on; el.classList.toggle(cls, on); } };
// the minimap: the whole town, the airfields, people (white), zombies (red), gloopers (green), fires (orange), Grave Giants (big pink) and you
let mapBase = null, mapT = 0, mapTapT = -9; const mapEl = $('taMap'), mapCtx = mapEl.getContext('2d'); const right = new THREE.Vector3(), upv = new THREE.Vector3(), r3 = new THREE.Vector3(), u3 = new THREE.Vector3();
function setupMap() { const c = document.createElement('canvas'); c.width = cols * 4; c.height = rows * 4; const g = c.getContext('2d'); g.fillStyle = '#24403c'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#8fb0aa';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!maze[y][x]) g.fillRect(x * 4, y * 4, 4, 4); mapBase = c; mapT = 0; }
const mapScale = (px) => (px / 2) / ((Math.max(cols, rows) * CELL / 2 + 9) * 1.18); // the whole town and the airfields fit inside the circle
const DOT = ['#ff4a3a', '#ffffff', '#7dff3a', '#ff9a8a'];
function drawMini() { const dpr = Math.min(2, devicePixelRatio || 1), S = Math.round(mapEl.clientWidth * dpr) || 1; if (mapEl.width !== S) mapEl.width = mapEl.height = S;
  const g = mapCtx, k = mapScale(S), P2 = (x, z) => [S / 2 + k * (right.x * x + right.z * z), S / 2 - k * (upv.x * x + upv.z * z)];
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, 6.2832); g.clip();
  g.setTransform(k * right.x, -k * upv.x, k * right.z, -k * upv.z, S / 2, S / 2); if (mapBase) g.drawImage(mapBase, -cols * CELL / 2, -rows * CELL / 2, cols * CELL, rows * CELL);
  g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const b of bases) { const [x, y] = P2(b.pos.x, b.pos.z); g.fillStyle = '#0b1416'; g.beginPath(); g.arc(x, y, 7 * dpr, 0, 6.2832); g.fill(); g.strokeStyle = '#7dff3a'; g.lineWidth = 1.5 * dpr; g.stroke(); g.font = (9 * dpr) + 'px sans-serif'; g.fillText('⛽', x, y + 0.5 * dpr); }
  g.fillStyle = '#ff9a2a'; for (const P of patches) { const [x, y] = P2(P.x, P.z); g.fillRect(x - 1.6 * dpr, y - 1.6 * dpr, 3.2 * dpr, 3.2 * dpr); }
  let last = -1; horde.eachDot((p, t) => { const [x, y] = P2(p.x, p.z), s = (t === 1 ? 2.3 : t === 2 ? 2.8 : 1.7) * dpr; if (t !== last) { last = t; g.fillStyle = DOT[t]; } g.fillRect(x - s / 2, y - s / 2, s, s); });
  for (const G of horde.giants) { if (!G.live) continue; const [x, y] = P2(G.root.position.x, G.root.position.z); g.fillStyle = '#ff4aa8'; g.strokeStyle = '#ffffff'; g.lineWidth = 1.2 * dpr; g.beginPath(); g.arc(x, y, 4 * dpr, 0, 6.2832); g.fill(); g.stroke(); }
  const c = craft; if (c) { if (c.way) { const [x, y] = P2(c.way.x, c.way.z), k = (performance.now() - mapTapT) / 900; if (k < 1) { g.strokeStyle = 'rgba(255,210,74,' + (1 - k).toFixed(2) + ')'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, (5 + k * 12) * dpr, 0, 6.2832); g.stroke(); } /* just tapped: a ring flashes out from the mark */ g.strokeStyle = '#ffd24a'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(x - 4 * dpr, y - 4 * dpr); g.lineTo(x + 4 * dpr, y + 4 * dpr); g.moveTo(x + 4 * dpr, y - 4 * dpr); g.lineTo(x - 4 * dpr, y + 4 * dpr); g.stroke(); }
    const [x, y] = P2(c.pos.x, c.pos.z), [fx2, fy2] = P2(c.pos.x + Math.sin(c.head), c.pos.z + Math.cos(c.head)), a = Math.atan2(fy2 - y, fx2 - x); g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#ffd24a'; g.strokeStyle = '#1a0f2e'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(7 * dpr, 0); g.lineTo(-5 * dpr, -5 * dpr); g.lineTo(-2 * dpr, 0); g.lineTo(-5 * dpr, 5 * dpr); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  g.restore(); }
mapEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (state !== 'play' || !craft || !craft.alive) return; const r = mapEl.getBoundingClientRect(), k = mapScale(r.width); const a = (e.clientX - r.left - r.width / 2) / k, b = -(e.clientY - r.top - r.height / 2) / k;
  const det = right.x * upv.z - right.z * upv.x; const wx = (a * upv.z - b * right.z) / det, wz = (b * right.x - a * upv.x) / det; craft.way = outOf(new THREE.Vector3(Math.max(-FB.x, Math.min(FB.x, wx)), 0, Math.max(-FB.z, Math.min(FB.z, wz)))); craft.wayT = 0; mapT = 0; mapTapT = performance.now(); });

// ---------- first-time teaching: one new thing at a time, each only ever once on this device (coach.js) ----------
function coachAR() { if (coachBusy() || !craft || !craft.alive || craft.crash) return; const c = craft;
  // the urgent ones first: a building ahead (seen from further off than the BUILDING! warning, so that still comes, with time
  // to steer, once the prompt has gone; it glows red while the prompt is up), a Grave Giant climbing out of the ground
  if (!coachSeen('ar_bld') && c.bumpT <= 0 && (c.kind === 'bomber' || !c.way)) { const b = bldAhead(c, c.kind === 'bomber' ? 2.4 : 1.8, null, c.kind === 'bomber' && dropping() ? Math.min(c.alt, c.S.low) : c.alt); if (b) { setWarn(b); coach('ar_bld', { title: '🏢 BIG BUILDINGS ARE SOLID', text: 'Fly into one and it comes down, and it costs you a third of your health. Watch for the red glow and BUILDING!, and steer round. ' + (c.kind === 'heli' ? 'The heli flies over houses and small shops.' : 'The bomber clears all but the tallest towers until it dips to drop.'), at: () => onOr(toScreen(b.pos, b.h * 0.6)) }); return; } }
  { const G = horde.giants.find((g) => g.live && (g.st !== 'rise' || g.t > 1.2)); if (G && !coachSeen('ar_giant')) { coach('ar_giant', { title: '💀 GRAVE GIANT', text: 'A giant zombie! It tears chunks off buildings and throws them at you: when a red ring shows where one is coming, fly clear of it. Get too close and it grabs or swipes you: that costs a third of your health and sends you spinning. Napalm and rockets bring it down, but it takes a lot of them.', at: () => onOr(toScreen(G.root.position, 4), gArrows[horde.giants.indexOf(G)]) }); return; } }
  if (!coachSeen('ar_steer_' + c.kind)) { if (played > 0.6) coach('ar_steer_' + c.kind, c.kind === 'bomber' ? { mode: 'drag', title: '✈ STEER', text: 'Hold and drag anywhere to steer. The bomber never stops, so keep it turning. You can also tap a spot to turn toward it.' + (matchMedia('(hover: hover) and (pointer: fine)').matches ? ' Keys: A turns left, D turns right.' : '') } : { mode: 'drag', title: '🚁 FLY', text: 'Hold and drag anywhere to fly the helicopter: it turns to face the way it flies. Let go and it hovers. Tap a spot to fly there.' + (matchMedia('(hover: hover) and (pointer: fine)').matches ? ' Keys: W and S fly forward and back, A and D turn.' : '') }); return; }
  if (!coachSeen('ar_goal')) { if (played > 3 && coachIdle() > 1.5) coach('ar_goal', { title: '🧟 THE HORDE', text: 'Bring the horde down to the GOAL line before time runs out. Zombies turn anyone they catch, so the horde grows if you are slow.', at: () => elMid($('taGrow')) }); return; }
  if (c.kind === 'bomber' && !coachSeen('ar_drop') && c.ammo > 0) { const t = horde.densest(c.pos.x + c.vel.x * 1.2, c.pos.z + c.vel.z * 1.2, 9); if (t && t.n >= 4 && c.ammo > 0) coach('ar_drop', { mode: 'tap', title: '🔥 NAPALM', text: 'Hold DROP, or double tap the zombies to swoop over them, to drop a wall of fire (one tap just turns you that way). Zombies that walk into the fire burn. Keep it on the street, away from houses.', at: () => toScreen(t) }); return; }
  if (c.kind === 'heli' && !coachSeen('ar_fire2') && c.ammo > 0) { const z = c.baseD > BASE_R + 0.5 ? horde.nearestZombie(aimPoint(c, tmpA).x, tmpA.z, 7) : null; if ((z && toScreen(z.position).on) || (played > 14 && c.baseD > BASE_R + 0.5)) coach('ar_fire2', { mode: 'tap', title: '🚀 ROCKETS', text: 'Hold FIRE to fire rockets where the beam of light points, or double tap a zombie to fire at it (one tap flies you there).' + (matchMedia('(hover: hover) and (pointer: fine)').matches ? ' SPACE fires where the beam of light points.' : ''), at: () => (z ? toScreen(z.position) : null) }); return; }
  if (!coachSeen('ar_spare')) { if (played > 9 && coachIdle() > 3) coach('ar_spare', { title: '👥 SPARE THE PEOPLE', text: 'Fire and rockets hurt people and buildings too, and each one fills the COLLATERAL meter. Fill it and the mission fails.', at: () => elMid($('arColl')) }); return; }
  if (!coachSeen('ar_gloop') && coachIdle() > 2) { const sp = horde.Z.find((o) => o.userData.spit && toScreen(o.position).on); if (sp) { coach('ar_gloop', { title: '🟢 GLOOPERS', text: 'Gloopers, the glowing green zombies, lob acid at aircraft flying low. The heli is always low; the bomber dips while it drops. Take them out first.', at: () => toScreen(sp.position, 0.4) }); return; } }
  if (!coachSeen('ar_base') && (c.ammo <= 0 || c.hp < c.S.hp * 0.5) && coachIdle() > 1) { coach('ar_base', { title: '⛽ BACK TO BASE', text: 'Fly over the airfield just outside town to reload and repair. Follow the ⛽ arrow at the edge of the screen.', at: () => onOr(toScreen(c.base.pos), baseArrow) }); }
}

// ---------- input: drag anywhere for a stick; a quick tap flies you to the spot (heli) or turns you toward it (bomber). A
// second finger can tap while the first one steers. DROP / FIRE is its own button (hold it). Keys on a computer ----------
const stick = { id: null, cx: 0, cy: 0, x: 0, y: 0, on: false }; const stickEl = $('taStick'), knobEl = $('taKnob'), keys = {}, touches = new Map(); let dropHeld = false, botDrop = false;
function pDown(id, x, y) { if (state !== 'play') return; touches.set(id, { x0: x, y0: y, t0: performance.now(), moved: 0 });
  if (stick.id === null) { stick.id = id; stick.cx = x; stick.cy = y; stick.x = stick.y = 0; stick.on = false; stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.style.display = 'none'; knobEl.style.transform = 'translate(-50%,-50%)'; } }
function pMove(id, x, y) { const t = touches.get(id); if (!t) return; t.moved = Math.max(t.moved, Math.hypot(x - t.x0, y - t.y0)); if (id !== stick.id || t.moved < 10) return;
  stick.on = true; stickEl.style.display = 'block'; if (craft) craft.way = null; const dx = x - stick.cx, dy = y - stick.cy, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 55); stick.x = dx / d * m / 55; stick.y = dy / d * m / 55;
  knobEl.style.transform = 'translate(calc(-50% + ' + stick.x * 36 + 'px), calc(-50% + ' + stick.y * 36 + 'px))'; }
function pUp(id) { const t = touches.get(id); if (!t) return; touches.delete(id); const tap = t.moved < 10 && performance.now() - t.t0 < 320; if (id === stick.id) stickOff(); if (tap && state === 'play') tapAt(t.x0, t.y0); }
function stickOff() { stick.id = null; stick.x = stick.y = 0; stick.on = false; stickEl.style.display = 'none'; }
const ray = new THREE.Raycaster(), groundP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(cx, cy) { cam.updateMatrixWorld(); ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), cam); const p = new THREE.Vector3(); return ray.ray.intersectPlane(groundP, p) ? p : null; }
let tap0 = null; /* the last tap (a second one close by, soon after, is a double tap) */
function tapAt(cx, cy) { if (state !== 'play' || !craft || !craft.alive || craft.crash) return; const p = groundAt(cx, cy); if (!p) return; const t = now(), dbl = tap0 && t - tap0.t < 0.35 && Math.hypot(cx - tap0.x, cy - tap0.y) < 45; tap0 = dbl ? null : { t, x: cx, y: cy };
  if (dbl && craft.kind === 'bomber') { craft.dropAt = p.clone(); craft.dropAtT = 0; craft.way = outOf(p); craft.wayT = 0; popup(p, '🔥', '#ffd24a'); return; } /* the bomber: a double tap flies over the spot and drops on it */
  if (dbl && craft.kind === 'heli') { craft.way = craft.prevWay || null; craft.fireCd = 0; if (fireRocket(p)) popup(p, '🎯', '#ffd24a'); return; } /* the heli: a double tap shoots the spot (and keeps the course it had before the first tap) */
  craft.prevWay = craft.way; craft.way = outOf(p); craft.wayT = 0; rtT = 0; } // a tap on the town: fly there (the heli) or turn toward it (the bomber)
const ZOOM_MIN = 0.55, ZOOM_MAX = 1.6; let zoom = 1; try { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +localStorage.getItem('ar_zoom') || 1)); } catch { /* ignore */ }
function setZoom(z) { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); try { localStorage.setItem('ar_zoom', String(zoom)); } catch { /* ignore */ } }
// a pinch counts only fingers on the town itself: a thumb held on DROP while the other one steers is not a pinch
let pinch = 0; const pinchD = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), onTown = (e) => [...e.touches].filter((t) => t.target === canvas);
canvas.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) pDown('t' + t.identifier, t.clientX, t.clientY); const tt0 = onTown(e); if (tt0.length >= 2 && !stick.on) { pinch = pinchD(tt0); for (const tt of touches.values()) tt.moved = 99; /* a pinch is never a tap */ stickOff(); } }, { passive: true });
canvas.addEventListener('touchmove', (e) => { const tt0 = onTown(e); if (tt0.length >= 2 && pinch > 0) { const d = pinchD(tt0); if (d > 0) setZoom(zoom * pinch / d); pinch = d; if (e.cancelable) e.preventDefault(); return; } for (const t of e.changedTouches) pMove('t' + t.identifier, t.clientX, t.clientY); if (state === 'play' && e.cancelable) e.preventDefault(); }, { passive: false });
const tUp = (e) => { for (const t of e.changedTouches) pUp('t' + t.identifier); if (onTown(e).length < 2) pinch = 0; }; addEventListener('touchend', tUp); addEventListener('touchcancel', tUp);
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') pDown(e.pointerId, e.clientX, e.clientY); });
// a first-time prompt that opens mid-drag stops the release from bubbling up to the window, so the release is caught on the
// way down instead; and a mouse moving with no button held has let go, whatever happened to its release
const letGo = (id) => { if (!touches.delete(id)) return; if (id === stick.id) stickOff(); };
addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; if (e.pointerType === 'mouse' && !e.buttons && touches.has(e.pointerId)) { letGo(e.pointerId); return; } pMove(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') pUp(e.pointerId); }, true); addEventListener('pointercancel', (e) => { if (e.pointerType !== 'touch') letGo(e.pointerId); }, true);
addEventListener('wheel', (e) => { if (e.target !== canvas || state !== 'play') return; e.preventDefault(); setZoom(zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
for (const [id, k] of [['taZoomIn', 0.85], ['taZoomOut', 1.18]]) $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); setZoom(zoom * k); });
{ const b = $('arDrop'); b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (state !== 'play') return; dropHeld = true; try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { dropHeld = false; }); b.addEventListener('contextmenu', (e) => e.preventDefault()); }
addEventListener('keydown', (e) => { if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault(); keys[e.key.toLowerCase()] = true; if (e.key === 'Escape' || e.key === 'p') togglePause(); }); // SPACE held: drop (the bomber) or fire (the heli)
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; dropHeld = false; });

// ---------- flow ----------
let state = 'start', roundId = 0, roundN = 0;
soundToggle($('taStart'), $('taPaused')); playerButton($('taPaused'), $('taPaused').querySelector('.menuBtn')); skipSongBtn($('ta')); eraPicker($('taLevels'), () => { level = unlocked(); drawLevels(); }); seasonPicker($('eraRow'));
gameMusic($('taPaused'), SONGS_TORNADO); radioButton($('taPaused'), $('taPaused').querySelector('.menuBtn'));
const fsMode = initFullscreen(() => state === 'play' || state === 'outro'); // full screen on play, back in after a browser drop-out, no page scrolling mid-round (and its button stays out of the way while the HUD still shows)
function start() { firstSong('ar', 'music/napalm-requiem.mp3'); /* (the first round ever opens on Napalm Requiem) */
  fsMode.play(); coachClear(); saveLast('ar', level); horde.crowd.clear(); if (state !== 'start' || roundN > 0) roundN++; roundId++;
  unlockAudio(); sk.clear(); buildWorld(); makeCraft(craftKind); setupMap(); /* (sk.clear first: it frees the last round's baby twisters while the twisters module still has them) */
  score = coll = kills = spitKills = savedN = civHit = turned = bHit = bLost = poiHit = acidHits = refills = multiBest = drops = shots = bumps = rockHits = crushed = gUp = gDown = 0; wpn = wLv = sup = nukes = supNuke = 0; played = 0; coll70 = false; endWhy = ''; dropHeld = false; botDrop = false; botKT = 0; stickOff(); touches.clear(); setWarn(null);
  clearUfos();
  gPlan = []; for (let i = 0; i < (L().giants || 0); i++) gPlan.push(GIANT.rise[0] + i * GIANT.rise[1]); // when each Grave Giant climbs out of the ground
  ROUND = +Q.get('time') || L().time; tLeft = ROUND; zStart = horde.zombies; goalN = Math.max(1, Math.round(zStart * L().goal)); civStart = horde.civs;
  $('arGoalTick').style.left = ((zStart - goalN) / zStart * 100) + '%'; { const b = $('arDrop'), heli = craftKind === 'heli'; b.innerHTML = heli ? '<b>🚀</b><span>FIRE</span><i id="arDropN"></i>' : '<b>🔥</b><span>DROP</span><i id="arDropN"></i>'; b.setAttribute('aria-label', heli ? 'Fire rockets' : 'Drop napalm'); b.classList.remove('hidden'); } drawWpns(); /* the big button: DROP napalm, or FIRE rockets; beside it, the weapons the supplies unlock */ $('arAmmoIcon').textContent = craftKind === 'bomber' ? '🔥' : '🚀'; $('arCraftTag').textContent = CRAFTS[craftKind].icon + ' ' + CRAFTS[craftKind].tag;
  for (const s of ['taStart', 'taEnd', 'taPaused', 'taPrize']) $(s).classList.add('hidden'); $('ta').classList.remove('hidden');
  state = 'play'; playSongs(); sfx.whoosh(); banner('LEVEL ' + level + ': ' + L().name.toUpperCase()); const rid = roundId; setTimeout(() => { if (state === 'play' && rid === roundId) banner('WIPE OUT THE HORDE!'); }, 2400);
  renderer.compile(scene, cam); $('taLevel').textContent = 'L' + level + ' · ' + L().name; measureHud(); for (const k in hudCache) delete hudCache[k]; baseArrow._c = undefined;
  camTarget.set(craft.pos.x, 0, craft.pos.z);
}
function togglePause() { if (state === 'play') { state = 'paused'; setPlaneEngine(0); stopMusic(); dropHeld = false; stickOff(); touches.clear(); $('taPaused').classList.remove('hidden'); } else if (state === 'paused') { state = 'play'; $('taPaused').classList.add('hidden'); playSongs(); } }
// the round is over: a few seconds to see how it ended, then the prize game, then the score
const END_TITLE = { win: 'TOWN SAVED!', damage: 'TOO MUCH DAMAGE!', down: 'SHOT DOWN!', nociv: 'NO SURVIVORS...', time: "TIME'S UP!" };
let outroT = 0;
function finish(why) { if (state !== 'play') return; aimBeam.visible = aimSpot.visible = false; flushKills(1); /* (kills still being added up count too) */ endZ = horde.zombies; endCiv = horde.civs; if (craft) updateHud(0); /* the HUD shows how it ended (green at the goal) through the outro */ setT('arBaseMsg', ''); setC('arBaseMsg', 'on', false); endWhy = why; state = 'outro'; outroT = 0; dropHeld = false; botDrop = false; stickOff(); touches.clear(); clearTips(); setPlaneEngine(0); stopMusic(); reticle.visible = wayMark.visible = false; setWarn(null); baseArrow.style.display = 'none';
  banner(END_TITLE[why]); if (why === 'win') { sfx.wave(); setTimeout(() => sfx.power(), 400); let n = 0; for (const o of horde.C) { if (o.userData.st !== 'idle' && o.userData.st !== 'flee') continue; o.userData.panic = true; if (n++ < 10 && toScreen(o.position).on) popup(o.position, 'SAVED!', '#7dff3a'); } } else sfx.over(); }
function outroTick(dt) { outroT += dt; horde.update(dt); if (craft) sk.tick(dt, craft); updateCans(dt); updateRockets(dt); updateBlasts(dt); updatePatches(dt); updateBuildingFires(dt); updateRocks(dt); updateShards(dt);
  const c = craft; if (c && !c.crash) { if (c.kind === 'bomber') { c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt; c.alt += dt * 1.5; c.pos.y = c.alt; for (const p of c.g.userData.props) p.rotation.z += dt * 40; } else { c.alt += dt * 1.2; c.pos.y = c.alt; c.head += dt * (endWhy === 'win' ? 2.5 : 0); for (const p of c.g.userData.props) p.rotation.y += dt * 32; } place(c); } else if (c && c.crash && !c.crash.down) crashTick(c, dt);
  if (outroT >= 3.2) finishNow(); }
function finishNow() {
  state = 'over'; setPlaneEngine(0); stopMusic(); clearTips(); baseArrow.style.display = 'none'; for (const m of rings) m.visible = false; /* (no red ring frozen on behind the prize and score screens) */ const won = endWhy === 'win', alive = endCiv, zl = endZ, lv0 = L(); // (as it stood when the round ended: the outro doesn't count)
  let timeB = 0, civB = won ? alive * SC.civEnd : 0; /* everyone still alive is a bonus, for a town you saved */ if (won) { timeB = Math.round(tLeft) * SC.sec; } score = Math.max(0, Math.round(score + civB + timeB));
  let best = 0; const bk = bestKey('ar', level); try { best = +localStorage.getItem(bk) || 0; if (score > best) { best = score; localStorage.setItem(bk, String(score)); } } catch { /* ignore */ }
  const scoreCoins = Math.floor(score / 10000) / 100; if (scoreCoins > 0) addCoins(scoreCoins); // one coin per million points, as in the other games
  if (won) markWon('ar', level);
  if (won && level < LEVELS.length && unlocked() <= level) { try { localStorage.setItem(levelKey('ar'), String(level + 1)); } catch { /* ignore */ } }
  const gotSkins = won && level >= LEVELS.length ? unlockCraftBonus('air') : []; /* beating The Sprawl (the last town) wins the Acid craft skins: said on the score screen below */
  const T = { win: level >= 5 ? L().name.toUpperCase().replace('THE ', '') + '<br>SAVED!' : 'TOWN<br>SAVED!', damage: 'TOO MUCH<br>DAMAGE', down: 'SHOT<br>DOWN', nociv: 'NO<br>SURVIVORS', time: "TIME'S<br>UP" };
  $('taEndTitle').innerHTML = T[endWhy] || "TIME'S<br>UP";
  $('taAgain').textContent = won && level < LEVELS.length ? 'NEXT LEVEL' : won ? 'PLAY AGAIN' : 'TRY AGAIN';
  const why = { win: level < LEVELS.length ? 'Level ' + (level + 1) + ' unlocked: ' + LEVELS[level].name + '.' : 'Every town saved. Hero.', damage: 'Too many people and buildings were hit. Drop your napalm down the middle of the street and keep rockets off the houses.',
    down: { acid: "The gloopers' acid brought you down. Take the glowing green ones out first, and fly back to the airfield to repair when you are hurt.", building: 'You flew into one building too many. Big buildings are solid: watch for the red glow and BUILDING!, and steer round them.', grab: 'A Grave Giant caught you when you were already badly hurt. Each grab or swipe costs a third of your health: repair at the airfield before you go back for it.', ufo: 'A UFO\'s laser brought you down. When a red line points at you, change course: the laser fires along it a moment later. Your tail gun shoots back at any UFO close by.', giant: "A Grave Giant's throw brought you down. When a red ring shows where a chunk is coming, fly clear of it." }[(craft && craft.lastHit) || 'acid'], nociv: 'The horde caught everyone. Go for the zombies closest to people first.', time: 'Bring the horde down to ' + goalN + ' or fewer before time runs out (there were ' + zl + ' left).' };
  $('taGoalLine').textContent = why[endWhy] || '';
  if (gotSkins.length) { const u = document.createElement('div'); u.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:10px;border:2px solid #7dff3a;background:#0e2a0acc;color:#7dff3a;font-weight:900;font-size:15px;box-shadow:0 0 14px #7dff3a66'; u.innerHTML = '🏆 BONUS SKINS UNLOCKED: <b>' + gotSkins.join(' AND ').toUpperCase() + '</b><br><small style="color:#cfe8c8;font-weight:700;font-size:11px">Put them on with CHOOSE SKIN, or in the skin shop.</small>'; $('taGoalLine').appendChild(u); }
  if (won && level < LEVELS.length) level++; saveLast('ar', level); drawLevels();
  $('taStats').innerHTML = [['🧟 Zombies destroyed', kills + (spitKills ? ' (' + spitKills + ' gloopers)' : '')], ...(lv0.giants ? [['💀 Grave Giants downed', gDown + ' / ' + lv0.giants]] : []), ['Horde left', zl + ' (goal ' + goalN + ')'], [won ? '👥 People saved' : '👥 People alive', alive + ' / ' + civStart + (won ? '  +' + civB : '')], ['People turned', turned], ['People you hit', civHit], ['🏚️ Buildings hit', bHit + (bLost ? ' (' + bLost + ' destroyed)' : '')], ...(bumps ? [['✈️ Buildings flown into', bumps]] : []), ['💥 Collateral', Math.round(coll) + '%'],
    ...(won ? [['⏱️ Time bonus', '+' + timeB]] : []), ['Aircraft', CRAFTS[craft.kind].name], ['Score', score], ['Score coins', '+' + scoreCoins + ' 🪙'], ['Best', best]].map(([a, b]) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>').join('');
  const kept = won && alive >= civStart * 0.7, goes = Math.min(3, 1 + (won ? 1 : 0) + (kept ? 1 : 0));
  showPrizes($('taChests'), goes, ['1 go for flying the mission', won && '+1 for saving the town', kept && '+1 for keeping 70% of the people alive'].filter(Boolean).join(', '), () => { location.href = 'store.html?from=airraid'; }, craftPrize(craft.kind, won, goes), () => { $('taPrize').classList.add('hidden'); $('taEnd').classList.remove('hidden'); }, 'craft');
  $('ta').classList.add('hidden'); $('taPrize').classList.remove('hidden'); // the prize game first, then the score
}
const HOWTO = [
  ['🧟', 'The town is overrun', 'Bring the horde down to the GOAL line on the bar up top before time runs out. Zombies turn anyone they catch, so be quick.'],
  ['🔥', 'Napalm bomber', 'Fast, and it never stops. Drag to steer, or tap a spot to turn toward it. Double tap a spot to swoop over it and drop a wall of fire there; zombies that walk into the fire burn. Best down open streets.'],
  ['🚀', 'Rocket heli', 'Slower, and it hovers. Drag to fly, let go to stop: it turns to face the way it flies. Tap a spot to fly there; double tap a spot to fire a rocket at it.'],
  ['🏢', 'Big buildings are solid', 'Fly into a big building and it comes down, and it costs you a third of your health. The heli flies over houses and small shops; the bomber clears all but the tallest towers until it dips to drop. A red glow and BUILDING! warn you first.'],
  ['👥', 'Spare the people', 'Burning or blasting people, or setting buildings alight, fills the COLLATERAL meter. Fill it and the mission fails.'],
  ['📦', 'Supplies and new weapons', 'Every zombie you destroy adds to the SUPPLIES bar, and blowing up a big landmark (the fairground, the power plant...) adds a lot, at no cost. Fill the bar to unlock a bigger bomb, then a second new weapon, then the NUKE. Pick your weapon with the buttons on the right.'],
  ['🟢', 'Gloopers', 'Gloopers, the glowing green zombies, lob acid at aircraft that fly low. The heli is always low; the bomber dips low while it drops. Take them out first.'],
  ['🛸', 'UFOs', 'UFOs come after you, more of them in the bigger towns. When one points a red line at you, change course: its laser fires along it a moment later. Your tail gun shoots back by itself at any UFO close by.'],
  ['💀', 'Grave Giants', 'From Downtown on, giant zombies climb out of the ground. They tear chunks off buildings and throw them at you: a red ring shows where one is coming, so fly clear. Get too close and it grabs or swipes you, costing a third of your health. Napalm and rockets bring them down, but it takes a lot.'],
  ['⛽', 'The airfield', 'Out of ammo or hurt? Fly over the airfield just outside town to reload and repair (nobody fires from inside its ring). Follow the ⛽ arrow at the edge of the screen.'],
  ['⌨️', 'On a computer', 'A and D (or the left and right arrows) always turn the aircraft to its own left and right: hold one to fly a circle. Hold SPACE to drop (bomber) or fire (heli). Heli: W and S (or up and down) fly forward and back. Click the town to fly there.'],
  ['🏆', 'Save the town', 'Save a town to open the next one. Everyone still alive at the end is a bonus.'],
];
$('taHow').addEventListener('click', () => showHowTo(HOWTO));
function loadThen(fn) { if (window.__bootTip) window.__bootTip(); document.body.classList.add('booting'); requestAnimationFrame(() => requestAnimationFrame(() => { try { fn(); } finally { document.body.classList.remove('booting'); } })); }
const playNow = () => { fsMode.play(); unlockAudio(); loadThen(start); }; // full screen and sound have to be asked for in the tap itself
$('taPlay').addEventListener('click', playNow); $('taAgain').addEventListener('click', playNow);
function drawLevels() { const box = $('taLevels'); box.innerHTML = ''; const un = unlocked(); LEVELS.forEach((lv, i) => { const b = document.createElement('button'), n = i + 1; let best = 0; try { best = +localStorage.getItem(bestKey('ar', n)) || 0; } catch { /* ignore */ }
  b.className = 'lvl' + (n === level ? ' on' : ''); b.disabled = n > un; b.innerHTML = '<b>' + (n > un ? '🔒' : n) + '</b><span>' + lv.name.replace('Small Town', 'Town').replace('The Sprawl', 'Sprawl') + '</span>' + (best ? '<i>' + best + '</i>' : ''); b.addEventListener('click', () => { level = n; drawLevels(); }); box.appendChild(b); }); }
level = unlocked(); if (import.meta.env.DEV) { const q = +Q.get('level'); if (q >= 1 && q <= LEVELS.length) level = q; } drawLevels();
$('taPause').addEventListener('click', togglePause); $('taResume').addEventListener('click', togglePause);
{ const rb = $('taRestart'); let armT = 0; const reset = () => { armT = 0; rb.textContent = '↺ RESTART LEVEL'; rb.classList.remove('armed'); };
  rb.addEventListener('click', () => { if (!armT || performance.now() - armT > 3000) { armT = performance.now(); rb.textContent = '↺ SURE? TAP AGAIN TO RESTART'; rb.classList.add('armed'); setTimeout(() => { if (armT && performance.now() - armT >= 2900) reset(); }, 3000); return; }
    reset(); $('taPaused').classList.add('hidden'); playNow(); }); }
// ---------- pick your aircraft: two cards, each with the aircraft turning on it (livePreview.js) ----------
const pv = createPreviews({ perFrame: 2, cam: [0, 2.3, 4.7], look: [0, 0.1, 0], fov: 34 });
const onDouble = (el, fn) => { let t0 = 0; el.addEventListener('click', () => { const t = performance.now(); if (t - t0 < 380) { t0 = 0; fn(); } else t0 = t; }); };
function shopBtn() { const host = $('taStart'), row = host.querySelector('.soundRow'); let b = host.querySelector('.psBtn'); if (b) b.remove(); b = document.createElement('button'); b.className = 'ghost psBtn'; b.textContent = '🎨 SKINS'; b.addEventListener('click', (e) => { e.stopPropagation(); location.href = 'store.html?from=airraid'; }); if (row) { row.insertBefore(b, row.firstChild); row.style.display = 'grid'; row.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))'; b.style.margin = '0'; } else host.appendChild(b); }
// the craft cards: a tap picks one; a double tap opens the skin shop on its skins (SKINS beside SOUND does the same)
function drawCrafts() { const box = $('arCrafts'); box.innerHTML = ''; pv.clear(); shopBtn();
  for (const k of ['bomber', 'heli']) { const S = CRAFTS[k], b = document.createElement('button'); b.className = 'craftCard' + (k === craftKind ? ' on' : ''); b.innerHTML = '<canvas width="150" height="150"></canvas><b>' + S.icon + ' ' + S.name + '</b><i class="skHint">DOUBLE TAP: SKINS</i><span>' + S.desc + '</span><small>' + S.best + '</small>'; box.appendChild(b);
    const ck = craftSkinKey(k); pv.add(b.querySelector('canvas'), ck ? () => craftPreview(k, ck, { fitTo: 2.7 }) : () => { const g = k === 'heli' ? makeHeli() : makeBomber(), o = new THREE.Group(), bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()); g.scale.multiplyScalar(2.7 / Math.max(sz.x, sz.z)); bb.setFromObject(g); g.position.sub(bb.getCenter(new THREE.Vector3())); o.add(g); o.userData.g = g; return o; },
      ck ? (dt, t, o) => o.userData.tick(dt, t) : (dt, t, o) => { const g = o.userData.g; o.rotation.y = 0.6 + t * 0.5; o.rotation.z = Math.sin(t * 0.9) * 0.08; o.position.y = Math.sin(t * 1.6) * 0.06; for (const p of g.userData.props || []) { if (k === 'heli') p.rotation.y += dt * 25; else p.rotation.z += dt * 40; } if (g.userData.tail) g.userData.tail.rotation.x += dt * 30; });
    b.addEventListener('click', () => { if (craftKind === k) return; craftKind = k; try { localStorage.setItem('ar_craft', k); } catch { /* ignore */ } box.querySelectorAll('.craftCard').forEach((x, i) => x.classList.toggle('on', ['bomber', 'heli'][i] === k)); if (state === 'start' && craft) { const old = craft; makeCraft(craftKind); disposeCraft(old.g, old.kind); } });
    onDouble(b, () => { try { localStorage.setItem('ar_craft', k); } catch { /* ignore */ } location.href = 'store.html?from=airraid'; }); } }
drawCrafts();

// ---------- the autopilot (a test hook: __ar.bot = true flies the round by itself, through the same controls) ----------
let bot = false, botT = 0, botAim = null, botRun = 0, botKT = 0; // botKT: the autopilot's turn key (the heli), the same as holding A or D
function botTick(dt) { const c = craft; botKT = 0; if (!c || !c.alive || c.crash) return; const S = c.S; botT -= dt; botRun -= dt;
  if (c.ammo <= 0 || c.hp < S.hp * (c.kind === 'heli' ? 0.45 : 0.35) || c.refilling) { botDrop = false; c.way = c.kind === 'heli' ? c.base.pad.clone() : c.base.pos.clone(); c.wayT = 0; return; }
  // a red ring where it is going (a giant's throw): out of the way first
  for (const r of rocks) { if (r.free) continue; const px = c.pos.x + c.vel.x * 0.6, pz = c.pos.z + c.vel.z * 0.6, d = Math.hypot(px - r.aim.x, pz - r.aim.z); if (d < 3.8) { botDrop = false; botRun = 0; const ax = d > 0.01 ? (px - r.aim.x) / d : 1, az = d > 0.01 ? (pz - r.aim.z) / d : 0; c.way = new THREE.Vector3(c.pos.x + ax * 8, 0, c.pos.z + az * 8); c.wayT = 0; return; } }
  if (botT <= 0 || !botAim) { botT = 0.4; botAim = (c.kind === 'heli' && botGlooper(c)) || horde.densest(c.pos.x, c.pos.z) || null; } if (!botAim) return; const t = botAim, d = Math.hypot(t.x - c.pos.x, t.z - c.pos.z);
  if (c.kind === 'bomber') { const lowAhead = () => { for (let k = 1; k <= 12; k++) { const s = k * 0.1, b = blockerAt(c.pos.x + c.vel.x * s, c.pos.z + c.vel.z * s, S.low, BLD.rc.bomber); if (b && (b.h + BLD.margin - c.alt) / 4.2 + 0.2 > s) return true; } return false; }; // (a building it must let go of DROP now to climb over in time)
    // a tower lit up red ahead (too tall to clear even at cruising height): off the run and round it (as a player would)
    if (arcHit(c, c.way ? Math.atan2(c.way.x - c.pos.x, c.way.z - c.pos.z) : c.head, 1.1, S.alt)) { botDrop = false; botRun = 0; c.botExt = 0; const h = steerClear(c, c.head); c.way = new THREE.Vector3(c.pos.x + Math.sin(h) * 9, 0, c.pos.z + Math.cos(h) * 9); c.wayT = 0; return; }
    if (botRun > 0) { botDrop = !lowAhead() && horde.count(reticle.position.x, reticle.position.z, 2.2, horde.C) === 0; c.way = null; return; } botDrop = false; // (it holds off where people are, and over anything tall)
    let off = Math.atan2(t.x - c.pos.x, t.z - c.pos.z) - c.head; off = Math.atan2(Math.sin(off), Math.cos(off));
    if (c.botExt > 0) { c.botExt -= dt; c.way = null; return; } if (d < 7 && Math.abs(off) > 0.6) { c.botExt = 1.4; c.way = null; return; } // too close to turn onto it: fly on and come round again
    c.way = new THREE.Vector3(t.x, 0, t.z); c.wayT = 0; if (Math.hypot(reticle.position.x - t.x, reticle.position.z - t.z) < 2.6 && !lowAhead()) botRun = 1.0; return; }
  // the heli, by the same rules as a player: get to a spot where the circle ahead reaches the crowd, turn to put the circle on
  // the zombies, and hold FIRE while it is on them (not where people are)
  if (c.baseD < BASE_R + 0.6 || d > AIM_D + 7) { botDrop = false; c.way = hoverSpot(t, c); c.wayT = 0; return; }
  const z = horde.nearestZombie(t.x, t.z, 3), tx = z ? z.position.x : t.x, tz = z ? z.position.z : t.z, dd = Math.hypot(tx - c.pos.x, tz - c.pos.z);
  if (Math.abs(dd - AIM_D) > 2.0) { botDrop = false; c.way = hoverSpot({ x: tx, z: tz }, c); c.wayT = 0; return; }
  c.way = null; let off = Math.atan2(tx - c.pos.x, tz - c.pos.z) - c.head; off = Math.atan2(Math.sin(off), Math.cos(off)); botKT = Math.abs(off) > 0.07 ? Math.sign(off) : 0;
  aimPoint(c, tmpA); const people = horde.count(tmpA.x, tmpA.z, ROCKET_R + 0.6, horde.C), zs = horde.count(tmpA.x, tmpA.z, ROCKET_R + 0.2);
  botDrop = Math.abs(off) < 0.3 && zs >= 1 && !people; }
// the heli goes for a glooper close by first (its acid is what hurts a heli hovering to aim)
function botGlooper(c) { let best = null, bd = 12; for (const o of horde.Z) { if (!o.userData.spit) continue; const d = Math.hypot(o.position.x - c.pos.x, o.position.z - c.pos.z); if (d < bd) { bd = d; best = o; } } return best ? { x: best.position.x, z: best.position.z, n: 1 } : null; }
// a spot AIM_D from the target, on the near side if it is clear of anything tall (or round to one that is)
function hoverSpot(t, c) { const dx = c.pos.x - t.x, dz = c.pos.z - t.z, d = Math.hypot(dx, dz) || 1, a0 = Math.atan2(dx, dz);
  for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7, 2.3, -2.3, 3.14]) { const a = a0 + da, x = t.x + Math.sin(a) * AIM_D, z = t.z + Math.cos(a) * AIM_D; if (!blockerAt(x, z, c.alt, BLD.rc.heli + 0.4)) return new THREE.Vector3(x, 0, z); }
  return new THREE.Vector3(t.x + dx / d * AIM_D, 0, t.z + dz / d * AIM_D); }

// ---------- update ----------
function update(dt) {
  played += dt; tLeft -= dt; if (tLeft <= 0) { tLeft = 0; finish(horde.zombies <= goalN ? 'win' : 'time'); return; }
  coachAR(); if (coachBusy()) return; /* a prompt has just come up: the round waits from this moment (a building it is about stays lit up red) */ if (played > 30) tip('ar_map', '🗺️ Tap the minimap to fly across town.'); if (bot) botTick(dt);
  updateCraft(dt); const c = craft; craftView.pos.copy(c.pos); craftView.vel.copy(c.vel); craftView.r = c.S.r; craftView.alive = c.alive && !c.crash; craftView.safe = c.baseD < BASE_R + 1; craftView.stealth = c.stealth || 1; // the airfield is a safe zone: the acid (and the giants) can't reach it
  horde.update(dt); updateGiants(dt); updateUfos(dt); updateRocks(dt); updateShards(dt); updateCans(dt); updateRockets(dt); updateBlasts(dt); updatePatches(dt); updateBuildingFires(dt); flushKills(dt);
  if (state !== 'play') return; // something above ended the round
  if (horde.zombies <= goalN) { finish('win'); return; } if (horde.civs <= 0) { finish('nociv'); return; }
  updateHud(dt); mapT -= dt; if (mapT <= 0) { mapT = 0.1; drawMini(); }
}
// the title screen: the town behind it, the horde about its business and a bomber circling overhead
let menuA = 0;
function attract(dt) { horde.update(dt); updatePatches(dt); const c = craft; if (!c) return; menuA += dt * 0.32; const R = Math.min(20, hx * 0.6); c.pos.set(Math.cos(menuA) * R, c.S.alt, Math.sin(menuA) * R); c.head = Math.atan2(-Math.sin(menuA), Math.cos(menuA)); c.bank = -0.35; c.vel.set(Math.sin(c.head) * c.S.speed, 0, Math.cos(c.head) * c.S.speed);
  for (const p of c.g.userData.props) { if (c.kind === 'heli') p.rotation.y += dt * 32; else p.rotation.z += dt * 40; } place(c); sk.tick(dt, c, true); }

addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight, false)); renderer.setSize(innerWidth, innerHeight, false);
const camTarget = new THREE.Vector3(); let last = performance.now(), pausedShown = false; const view = { x: 0, y: 0, z: 0, r: r3, u: u3, hw: 10, hh: 10 };
function frame(nowMs) {
  requestAnimationFrame(frame); const dt = Math.max(0, Math.min(0.05, (nowMs - last) / 1000)); last = nowMs;
  setSfxPaused(state === 'paused'); { const rb = document.getElementById('radioBox'); setMusicDuck(state === 'play' || state === 'outro' ? 1 : state === 'paused' && !(rb && !rb.classList.contains('hidden')) ? 0 : 0.5); } // music: full in a round, paused on pause (unless the radio is open), half on menus
  { const pz = state === 'paused'; if (pz !== pausedShown) { pausedShown = pz; document.body.classList.toggle('paused', pz); } }
  const hold = coachFrame(state === 'play'); if (hold) $('taBanner').style.opacity = 0; // a first-time prompt is up: the round waits for the player
  if (state === 'play') { if (!hold) update(dt); } else if (state === 'outro') outroTick(dt); else if (state === 'start') attract(dt);
  if (city) { const fdt = state === 'paused' || hold ? 0 : dt; twisters.update(fdt); fx.update(fdt); poiFx.update(fdt); city.updateRain(fdt); } // (paused, or a prompt up: the fires, the landmarks' effects and the rain wait too)
  bannerT -= dt; if (bannerT <= 0) $('taBanner').style.opacity = 0;
  flashT = Math.max(0, flashT - dt); flashEl.style.opacity = Math.min(0.7, flashT * 3); hurtT = Math.max(0, hurtT - dt); hurtEl.style.opacity = Math.min(0.9, hurtT * 2.2); hitT = Math.max(0, hitT - dt); hitEl.style.opacity = Math.min(0.9, hitT * 2);
  // camera: from above at an angle, a little ahead of the aircraft. The heli's view is a touch closer. (Close enough that
  // the zombies read as a crowd on a phone; the zoom buttons pull back for more of the town)
  const a = innerWidth / innerHeight, base = craft && craft.kind === 'heli' ? 8.6 : 9.6, half = (a < 1 ? base / a * 0.74 : base) * zoom; /* (a phone held upright sits a little closer, so a lone zombie is more than a speck) */
  cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
  if (craft) { const c = craft, heli = c.kind === 'heli', ah = heli && state !== 'start' ? AIM_D * 0.42 : 0, lead = heli ? 0.3 : 0.5; tmp.set(c.pos.x + c.vel.x * lead + Math.sin(c.head) * ah, Math.max(0, c.pos.y) * 0.45, c.pos.z + c.vel.z * lead + Math.cos(c.head) * ah); camTarget.lerp(tmp, Math.min(1, dt * (heli ? 2.6 : 3.2))); } // the heli's view is drawn a little ahead of its nose, so the circle it aims with stays on screen
  cam.position.copy(camTarget).addScaledVector(isoDir, CAM_D); cam.lookAt(camTarget);
  if (shake > 0) { shake = Math.max(0, shake - dt * 2.2); const k = shake * shake * 0.5 * Math.min(2, half / 14); cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k; }
  { const wide = Math.max(0, half - (a < 1 ? 10.14 / a * 0.8 : 10.14)) * 1.1; scene.fog.near = CAM_D - 20 + wide; scene.fog.far = CAM_D + 40 + wide; }
  cam.updateMatrixWorld(); r3.setFromMatrixColumn(cam.matrixWorld, 0); u3.setFromMatrixColumn(cam.matrixWorld, 1); right.copy(r3).setY(0).normalize(); upv.copy(u3).setY(0).normalize();
  view.x = camTarget.x; view.y = camTarget.y; view.z = camTarget.z; view.hw = half * a + 1.5; view.hh = half + 1.5; horde.sync(view, dt);
  updatePops(dt); giantHud(); cullChunks(); perfTick(); renderer.render(scene, cam);
}
// QUICK PLAY on the main menu comes in with ?quick: no title screen, straight into the town you left off in. Otherwise the
// town behind the title screen, with a bomber circling
if (Q.has('quick')) { if (!(import.meta.env.DEV && +Q.get('level'))) level = quickLevel('ar'); drawLevels(); start(); }
else { buildWorld(); makeCraft(craftKind); camTarget.set(0, 0, 0); }
requestAnimationFrame(frame); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('booting'))); // the start screen is ready now

window.__ar = { start, finish, finishNow, tapAt, fireRocket, wreckPoi, igniteB, hitThings, setZoom, THREE, renderer, scene, cam, horde, fx, twisters, spawnGiant, blockerAt, bldAhead, collapse, BLD, GIANT, AIM_D,
  get aim() { return craft && craft.kind === 'heli' ? aimPoint(craft, new THREE.Vector3()) : reticle.position.clone(); }, get giants() { return horde.giants; }, get ufos() { return ufos; }, get ufoDown() { return ufoDown; }, get rocks() { return rocks; }, get rings() { return rings; }, get warn() { return warnB; }, get bumps() { return bumps; }, get gDown() { return gDown; }, get gUp() { return gUp; }, get rockHits() { return rockHits; }, get crushed() { return crushed; }, get acidHits() { return acidHits; }, get shots() { return shots; }, get drops() { return drops; }, get refills() { return refills; }, get gPlan() { return gPlan; },
  get state() { return state; }, get craft() { return craft; }, get level() { return level; }, set level(v) { level = v; drawLevels(); }, get craftKind() { return craftKind; }, set craftKind(k) { craftKind = k; drawCrafts(); },
  get bot() { return bot; }, set bot(v) { bot = !!v; }, get botInfo() { return { aim: botAim, run: +botRun.toFixed(2), drop: botDrop, kt: botKT }; }, set drop(v) { dropHeld = !!v; }, get score() { return score; }, get coll() { return coll; }, get zombies() { return horde.zombies; }, get civs() { return horde.civs; }, get goal() { return goalN; },
  get tLeft() { return tLeft; }, set tLeft(v) { tLeft = v; }, get kills() { return kills; }, get turned() { return turned; }, get civHit() { return civHit; }, get bHit() { return bHit; }, get bLost() { return bLost; }, get poiHit() { return poiHit; },
  get buildings() { return buildings; }, get pois() { return pois; }, get patches() { return patches; }, get bases() { return bases; }, get zoom() { return zoom; }, get calls() { return renderer.info.render.calls; }, get tris() { return renderer.info.render.triangles; },
  get endWhy() { return endWhy; }, LEVELS, CRAFTS, AR, get coachUp() { return coachBusy(); }, get chunks() { return chunks; }, get sceneN() { return scene.children.length; },
  bench(n = 20) { renderer.render(scene, cam); const t0 = performance.now(); for (let i = 0; i < n; i++) renderer.render(scene, cam); renderer.getContext().finish(); return (performance.now() - t0) / n; },
  toScreen(p, y) { return toScreen(p, y); }, groundAt, get stick() { return stick; }, get touches() { return touches; }, get pinch() { return pinch; },
  // fast-forward the round without drawing (for the balance tests): returns how it stood every `every` seconds
  fast(secs, every = 30) { const out = [], dt = 1 / 30; let t = 0, next = every; while (t < secs && state === 'play') { update(dt); fx.update(dt); twisters.update(dt); t += dt; if (t >= next) { next += every; out.push({ t: Math.round(played), z: horde.zombies, civ: horde.civs, kills, coll: Math.round(coll) }); } } out.push({ t: Math.round(played), z: horde.zombies, civ: horde.civs, kills, coll: Math.round(coll), state, endWhy }); return out; } };
