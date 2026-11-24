import { radioButton } from '../radioBox.js';
// BEAM 'EM UP!: a Tornado Time! bonus game. You are the UFO, and it plays like the tornado: drag anywhere to fly, tap a
// spot to fly there (and the death ray zaps whatever you tapped: a building, a big target, the army), and the ray zaps the
// buildings you fly over or beside by itself. Press and hold on the saucer (or BEAM, or SPACE) to pull the townsfolk up into
// it. Big buildings are solid: fly into one and it comes down, but it costs a lot of energy.
// One bar is both your shield and your fuel (ENERGY): flying burns a little, army hits and crashes burn more, and every
// person you beam up fills it again (faster when you grab them one after another). Run out and the saucer comes down in flames.
// Clear a town by beaming up enough people and wrecking enough of it before the time runs out.
// The town, people, fires, wreckage, big-target blasts, crowd drawing, music and menus are Tornado Time!'s own (shared
// modules), and so are the horn trucks (its storm cannons, ../ally/foes.js); this game's own parts are town.js (its copy of
// the town builder), army.js (who shoots at you) and models.js.
import { markWon } from '../progress.js';
import { playerButton } from '../player.js';
import * as THREE from 'three';
import { toWorld, toCell, findPath, CELL } from '../city.js';
import { makeCharacter, animateWalk } from '../poster/characters.js';
import { makeCar } from '../car.js';
import { createTwisters } from '../tornado.js';
import { createFires } from '../fire.js';
import { nukeBlast } from '../nuke.js';
import { unlockAudio, soundToggle, setMusicDuck, setSfxPaused, skipSongBtn, sfx, stopMusic, setPlaneEngine, setWind, playSongs, songState, gameMusic, SONGS_ALL, firstSong } from '../audio.js';
import { townSkin, skinnedCarArgs, addCoins } from '../skins.js';
import { forceSeason, seasonChoice, seasonPicker } from '../season.js';
import { eraPicker } from '../era.js';
import { showPrizes } from '../prizes.js';
import { stampVersion } from '../version.js';
import { initFullscreen } from '../fullscreen.js';
import { showHowTo, tip, clearTips, markSeen } from '../howto.js';
import { coach, coachSeen, coachIdle, coachBusy, coachFrame, coachClear, tipsSetup } from '../coach.js';
import { FUN, MODE, funInit, diffPicker, roundK, starTag, awardStars, comboHud, bossBar, bossDue, makeEvents, meteorShower, clearMeteors, funTick, buzz, dailyLevel, dailyWon, endlessLevel, endlessEnd, endlessLine } from '../fun.js';
import { levelKey, bestKey, quickLevel, saveLast } from '../progress.js';
import { createCrowd } from '../crowd.js';
import { autoResolution, setBakedGlow, mergeParts } from '../perf.js';
import { createPoiFx } from '../ally/poiFx.js';
import { createFoes } from '../ally/foes.js';
import { createPreviews } from '../livePreview.js';
import { buildTown, POI } from './town.js';
import { createArmy, ARMY_FIRST } from './army.js';
import { makeShip, makeBeam, makeRay } from './models.js';
import { ufoSkin, craftPreview, craftSkinKey, craftSkinButton, unlockCraftBonus, craftPrize, walkerPal } from '../craftSkins.js';
import { makeWalker, walkerTick, aimLight, WALK_Y } from './walker.js';
import { hordeLook, hordeBody, airTownSkin } from '../hordeSkins.js'; // (airTownSkin: townsfolk leave off an outfit the hordes worn borrow)

const $ = (id) => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), rnd = (a, b) => a + Math.random() * (b - a), noop = () => {};
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.debug.checkShaderErrors = false; // reading shader logs forces a sync compile (a hitch) every time a new material shows up
const perfTick = autoResolution(renderer); // drops the draw resolution a notch when frames run long
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x16302f); scene.fog = new THREE.Fog(0x16302f, 60, 120);
const hemi = new THREE.HemisphereLight(0xb8e0d8, 0x2a4448, 1.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xd0e8ff, 0.9); sun.position.set(-6, 10, 8); scene.add(sun);
const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 440), CAM_D = 120; // CAM_D: how far back the camera sits (it must clear the ground when zoomed right out)
const ISO_YAW = Math.PI / 4, ISO_ELEV = 0.72;
const isoDir = V3(Math.sin(ISO_YAW) * Math.cos(ISO_ELEV), Math.sin(ISO_ELEV), Math.cos(ISO_YAW) * Math.cos(ISO_ELEV)).normalize();
const fx = createFires(scene);
const crowd = createCrowd(scene, 900), crowdLists = [[null, 0], [null, 1]]; // townsfolk and soldiers away from the ship: one draw call for the lot
// a soft glow on the street under everyone: green under the townsfolk (as on the mini map), orange under the soldiers. On a phone
// people are a few pixels tall, and the glow is what shows where the crowds are. One draw for the lot (P3)
const GLOW_MAX = 700, glows = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }), GLOW_MAX);
  m.frustumCulled = false; m.count = 0; m.renderOrder = 1; m.setColorAt(0, new THREE.Color()); const a = m.instanceMatrix.array; for (let i = 0; i < GLOW_MAX; i++) { a[i * 16] = a[i * 16 + 10] = 1.7; a[i * 16 + 5] = a[i * 16 + 15] = 1; a[i * 16 + 13] = 0.04; } scene.add(m); return m; })();
function syncGlows() { const a = glows.instanceMatrix.array, col = glows.instanceColor.array; let n = 0;
  for (const [list, r, g, b] of [[people, 0.35, 1, 0.18], [army.soldiers, 1, 0.42, 0.12]]) for (const c of list) { if (n >= GLOW_MAX) break; if (c.userData.far && c.userData.frz) continue; a[n * 16 + 12] = c.position.x; a[n * 16 + 14] = c.position.z; col[n * 3] = r; col[n * 3 + 1] = g; col[n * 3 + 2] = b; n++; }
  glows.count = n; glows.instanceMatrix.clearUpdateRanges(); glows.instanceMatrix.addUpdateRange(0, Math.max(1, n) * 16); glows.instanceMatrix.needsUpdate = true; glows.instanceColor.clearUpdateRanges(); glows.instanceColor.addUpdateRange(0, Math.max(1, n) * 3); glows.instanceColor.needsUpdate = true; }
let shake = 0; const jolt = (v) => { shake = Math.max(shake, v); buzz(v); }; funInit('bu'); // camera shake (0..1), and the phone's buzz
let flashT = 0; const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;background:#dfeaff;opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(flashEl);
let hurtK = 0; const hurtEl = document.createElement('div'); hurtEl.style.cssText = 'position:fixed;inset:0;box-shadow:inset 0 0 60px 10px #ff2a2a;opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(hurtEl); // the red edge when the ship is hit
const twisters = createTwisters(scene); twisters.setFx(fx); // only its wreckage is used here: buildings breaking into real pieces of themselves
stampVersion($('taStart'));
const poiFx = createPoiFx(scene, fx, { jolt, popup: (...a) => popup(...a), flash: (v) => { flashT = Math.max(flashT, v); },
  arcTargets: (c, r, n) => buildings.filter((x) => !x.done).map((x) => [Math.hypot(x.pos.x - c.x, x.pos.z - c.z), x]).filter((e) => e[0] < r && e[0] > 2).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, x]) => ({ pos: V3(x.pos.x, Math.min(x.h, 6), x.pos.z), hit: () => { if (!x.done && Math.random() < 0.4) fx.ignite(V3(x.pos.x, 1, x.pos.z), 0.8, 4); } })) }); // each big target goes up in its own way
const rays = makeRay(scene);
// a replaced town's (or saucer's) meshes let go of their GPU buffers. Pieces shared with other things simply upload again when next drawn
const disposeTree = (root) => { if (root) root.traverse((m) => { if (m.geometry && !m.isSprite) m.geometry.dispose(); for (const mt of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) { if (mt.map && mt.map.isCanvasTexture) mt.map.dispose(); mt.dispose(); } }); };

// ---------- tuning ----------
// six towns, each bigger. abduct: people to beam up. goal: % of the town to wreck. time: seconds. fly: how high the saucer
// flies. Houses and small shops always pass under it; in Small Town only the towers are in its way, in Suburbs the four-floor
// blocks too, and from Downtown on anything of three floors or more (see BLD)
const LEVELS = [
  { name: 'Small Town', size: 21, time: 150, abduct: 55, goal: 45, pois: 5, fly: 5.7 }, /* the first town: a new player's first round, so the gentlest army */
  { name: 'Suburbs', size: 27, time: 170, abduct: 60, goal: 35, pois: 6, fly: 4.6 },
  { name: 'Downtown', size: 33, time: 190, abduct: 65, goal: 27, pois: 7, fly: 3.75 },
  { name: 'Metro', size: 39, time: 215, abduct: 80, goal: 24, pois: 8, fly: 3.75 },
  { name: 'Megacity', size: 47, time: 270, abduct: 95, goal: 20, pois: 10, fly: 3.75 },
  { name: 'The Sprawl', size: 57, time: 320, abduct: 110, goal: 16, pois: 10, fly: 3.75 },
];
let level = 1; const L = () => LEVELS[level - 1];
const ramp = () => Math.min(1, (level - 1) / 5); // 0 in Small Town, 1 in The Sprawl
let noSave = false, simming = false, memOpen = 0; /* noSave: a test page (?level=N, or the balance robot): bests, unlocks, coins and QUICK PLAY's town are left alone */
const unlocked = () => { let n = 1; try { n = +localStorage.getItem(levelKey('bu')) || 1; } catch { n = 1; } return Math.max(1, Math.min(LEVELS.length, Math.max(n, memOpen))); };
// the machine: the saucer, or the LONGSHANKS walker (walker.js). WALK_HOLD: seconds in the walker's searchlight before it is
// beamed up; WALK_REACH: how far ahead the light reaches; WALK_SPD: its walking speed as a share of the saucer's
let craftKind = (() => { try { return localStorage.getItem('bu_craft') === 'walker' ? 'walker' : 'ufo'; } catch { return 'ufo'; } })(); const WALK = () => craftKind === 'walker';
const WALK_HOLD = 3, WALK_REACH = 8.5, WALK_SPD = 0.47;
const SHIP_SCALE = 0.95, SHIELD_R = 2.7 * SHIP_SCALE, flyY = () => L().fly; // the saucer's size, its shield, and how high it flies in this town (LEVELS)
const GRAB_R = 2.1, PULL_R = 4.6, PANIC_R = 7, LIFT_MAX = 9; // the beam grabs anyone this close to the spot under the ship, and drags in anyone in PULL_R
const SPEED = 7.2, BEAM_SLOW = 0.55, BOOST = 1.6, ACC = 3.4; // flying speed, the share of it while beaming, a speed boost, and how quickly the ship answers the stick
// the death ray is free. A tapped shot waits RAY_CD after the last one; the ray also fires by itself every AUTO_CD at the
// nearest building within AUTO_R of the saucer's middle (measured to its walls), the way the tornado wrecks what it touches
const AUTO_BEAM = 3; /* seconds people (or a car) must stay in the circle under the saucer before the beam comes down by itself */
const E_MAX = 100, RAY_CD = 0.3, RAY_RANGE = 30, AUTO_CD = 0.5, AUTO_R = 2.4;
// big buildings are solid: one blocks the saucer when its roof is higher than the saucer's underside (under: how far below
// its middle that is) less margin. rc: how far round its middle counts (less than its rim, so it fits down a street with a
// big building on each side); dmg: what flying into one costs; bump: how long before another can hurt it; warn: how far
// ahead (seconds) the BUILDING! warning looks
const BLD = { under: 0.45, margin: 0.15, rc: 1.25, dmg: 30, bump: 1.0, warn: 0.75 };
const HORN = { dmg: 15, r: 1.5 }; // a horn truck's blast (foes.js): what it costs, and how wide the saucer counts for it
const fuelRate = () => 0.38 + 0.12 * ramp(); // energy a second the ship burns just flying

// ---------- world ----------
let T = null, buildings = [], pois = {}, poiOrder = [], people = [], drivers = [], totalB = 1, bDone = 0; const bGrid = new Map(), poolP = [];
const OUTFITS = ['worker', 'pink', 'plaid', 'hivis', 'suit', 'hoodie', 'punk', 'vest'];
function addPerson(x, z, o = {}) { let c = !o.kind ? poolP.pop() : null; // a townsperson beamed up earlier comes back out of the next building that falls: no need to build a new one
  if (!c) { c = o.kind === 'zombie' ? makeCharacter(['worker', 'suit', 'hoodie', 'plaid'][(Math.random() * 4) | 0], { zombie: true, horde: hordeBodyNow() }) : o.kind === 'convict' ? makeCharacter('worker', { skin: { outfit: { shirt: 0xff7a1a, pants: 0xff7a1a, tie: null } } }) : makeCharacter(OUTFITS[(Math.random() * 8) | 0], { skin: airTownSkin(), look: Math.random() }); }
  c.scale.setScalar(0.25); c.rotation.set(0, Math.random() * 6.28, 0); c.position.set(x, 0, z); delete c.updateMatrixWorld; c.visible = true;
  Object.assign(c.userData, { home: c.position.clone(), goal: null, wait: Math.random() * 3, frz: false, far: false, stun: 0, kind: o.kind || null, zombie: o.kind === 'zombie' }); scene.add(c); people.push(c); return c; }
function roadPathTo(cell, wx, wz, away) { let target = toCell(wx, wz, T.cols, T.rows);
  if (away) { let best = null, bd = -1; for (let k = 0; k < 12; k++) { const c = T.roads[(Math.random() * T.roads.length) | 0]; const w = toWorld(c[0], c[1], T.cols, T.rows); const d = Math.hypot(w.x - wx, w.z - wz); if (d > bd) { bd = d; best = c; } } target = { cx: best[0], cy: best[1] }; }
  if (T.maze[target.cy]?.[target.cx] !== false) { let best = null, bd = 1e9; for (const c of T.roads) { const d = Math.abs(c[0] - target.cx) + Math.abs(c[1] - target.cy); if (d < bd) { bd = d; best = c; } } target = { cx: best[0], cy: best[1] }; }
  return findPath(T.maze, { cx: cell[0], cy: cell[1] }, target).slice(0, 14); }
function followPath(o, speed, dt) { if (!o.path.length) return false; const [cx, cy] = o.path[0], w = toWorld(cx, cy, T.cols, T.rows), g = o.g, dx = w.x - g.position.x, dz = w.z - g.position.z, d = Math.hypot(dx, dz);
  if (d < 0.25) { o.cell = o.path.shift(); return true; } const st = Math.min(d, speed * dt); g.position.x += dx / d * st; g.position.z += dz / d * st; const want = Math.atan2(dx, dz); let dr = want - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 8); return true; }
function buildWorld() {
  if (T) { scene.remove(T.city.group); twisters.clear(); fx.clear(); poiFx.clear(); rays.clear(); for (const p of people) scene.remove(p); for (const o of drivers) scene.remove(o.g);
    disposeTree(T.city.group); for (const c of [...people, ...poolP, ...lifted.map((l) => l.c)]) disposeTree(c); for (const o of drivers) disposeTree(o.g); }
  for (const l of lifted) scene.remove(l.c); lifted.length = 0; army.clear(); foes.clear(); for (const b of blasts) b.remove(); blasts.length = 0; sinking.length = 0;
  forceSeason(seasonChoice() !== 'random' ? seasonChoice() : level >= 5 ? 'none' : ['none', 'halloween', 'christmas', 'july4'][(Math.random() * 4) | 0]); /* Random leaves the two biggest towns plain: they are busy enough */
  T = buildTown(scene, { size: L().size, pois: L().pois, nuclear: level >= 3, hemi, sun }); twisters.setBounds(T.lim);
  buildings = T.buildings; totalB = buildings.length; bDone = 0; pois = T.pois;
  // which buildings stand in each cell (what the automatic ray looks for round the saucer)
  bGrid.clear(); for (const x of buildings) { const c = toCell(x.pos.x, x.pos.z, T.cols, T.rows), k = c.cy * T.cols + c.cx; let l = bGrid.get(k); if (!l) bGrid.set(k, (l = [])); l.push(x); }
  // the solid ones (BLD): taller than the saucer's underside in this town. bAt: the tallest on each street square. bx, bz: half its walls' size
  { const top = flyY() - BLD.under - BLD.margin; bAt = new Array(T.cols * T.rows).fill(null); rtKey = -1;
    for (const x of buildings) { x.solid = x.h > top; x.bx = Math.max(0.5, (x.box.max.x - x.box.min.x) / 2); x.bz = Math.max(0.5, (x.box.max.z - x.box.min.z) / 2); if (!x.solid) continue; const c = toCell(x.pos.x, x.pos.z, T.cols, T.rows); if (c.cx < 0 || c.cy < 0 || c.cx >= T.cols || c.cy >= T.rows) continue; const k = c.cy * T.cols + c.cx; if (!bAt[k] || bAt[k].h < x.h) bAt[k] = x; } }
  // each big target's box, for tapping it
  for (const k in pois) { const P = pois[k], box = new THREE.Box3(); for (const hz of P.hz) for (const p of hz.parts || []) box.expandByObject(p); if (box.isEmpty() || box.getSize(V3()).length() > 40) box.setFromCenterAndSize(P.center.clone().setY(1.2), V3(3, 2.4, 3)); P.box = box; }
  // people: small crowds out on the streets (more than in Tornado Time!: here they are what keeps you flying)
  people = []; poolP.length = 0; const rng = T.rng, big = T.cols / 21, groups = Math.min(150, Math.round(46 * Math.pow(big, 1.5)));
  for (let g = 0; g < groups; g++) { const [x, y] = T.roads[(rng() * T.roads.length) | 0]; const w = toWorld(x, y, T.cols, T.rows); if (Math.hypot(w.x, w.z) < 6) continue; const n = 2 + ((rng() * 3) | 0); for (let i = 0; i < n; i++) addPerson(w.x + (rng() - 0.5) * 1.6, w.z + (rng() - 0.5) * 1.6); }
  // traffic
  drivers = []; for (let i = 0; i < 6 + 2 * (level - 1); i++) { const [x, y] = T.roads[(rng() * T.roads.length) | 0], w = toWorld(x, y, T.cols, T.rows); if (Math.hypot(w.x, w.z) < 5) continue; const c = makeCar(...skinnedCarArgs([0xc23b3b, 0x4f8fd6, 0xe8d54a, 0xd8dde0, 0x3a8a5a][(rng() * 5) | 0])); mergeParts(c); /* a dozen pieces become three draws */ c.scale.setScalar(0.8); c.position.set(w.x, 0, w.z); scene.add(c); drivers.push({ g: c, cell: [x, y], path: [], speed: 3 + rng() * 1.5 }); }
}
// people bump into buildings (a grid of the obstacles, rebuilt when one is knocked down)
let obsGrid = null, obsN = -1; const OG = 6;
function obstaclesNear(x, z) { const list = T.city.obstacles; if (list.length !== obsN || !obsGrid) { obsN = list.length; obsGrid = new Map(); for (const o of list) { const k = Math.floor(o.x / OG) + ',' + Math.floor(o.z / OG); let b = obsGrid.get(k); if (!b) obsGrid.set(k, (b = [])); b.push(o); } }
  const gx = Math.floor(x / OG), gz = Math.floor(z / OG), out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const b = obsGrid.get((gx + i) + ',' + (gz + j)); if (b) out.push(...b); } return out; }
function collidePerson(c) { const p = c.position, r = 0.15; for (const o of obstaclesNear(p.x, p.z)) { const dx = p.x - o.x, dz = p.z - o.z; if (Math.abs(dx) > o.hw + r || Math.abs(dz) > o.hd + r) continue; const qx = o.hw + r - Math.abs(dx), qz = o.hd + r - Math.abs(dz); if (qx < qz) p.x += Math.sign(dx || 1) * qx; else p.z += Math.sign(dz || 1) * qz; }
  const b = T.lim; p.x = Math.max(-b.x - 1, Math.min(b.x + 1, p.x)); p.z = Math.max(-b.z - 1, Math.min(b.z + 1, p.z)); }
const dropObstacle = (p) => { const i = T.city.obstacles.findIndex((o) => Math.abs(o.x - p.x) < 0.3 && Math.abs(o.z - p.z) < 0.3); if (i >= 0) T.city.obstacles.splice(i, 1); };

// ---------- screen helpers, score, popups, banners, game-time timers ----------
const toScreen = (p, y = 0) => { const v = V3(p.x, y, p.z).project(cam); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, on: Math.abs(v.x) < 0.86 && v.y > -0.8 && v.y < 0.62 && v.z < 1 }; };
const elMid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
let score = 0, chain = 0, lastHit = -9, tLeft = 150, played = 0, clock = 0, abd = 0, stats = {};
const mult = () => Math.min(5, 1 + Math.floor(chain / 4));
function award(base, pos, label, quiet) { if (played - lastHit < 2.5) chain++; else chain = 0; lastHit = played; if (!quiet) sfx.coin(chain); const pts = Math.round(base * mult()); score += pts; if (!quiet) popup(pos, '+' + pts + (label ? ' ' + label : ''), mult() > 1 ? '#ff9a3a' : '#ffe27a'); return pts; }
const pops = []; for (let i = 0; i < 20; i++) { const el = document.createElement('div'); el.className = 'pop'; el.style.display = 'none'; document.body.appendChild(el); pops.push({ el, t: 0, p: V3() }); }
const SHOUTS = ['AAAH!', 'NOT ME!', 'PUT ME DOWN!', 'ALIENS!', 'HELP!', 'MOMMY!', 'I CAN FLY?!', 'NOOO!'];
let popI = 0; const popA = V3(), popB = V3();
function popup(pos, text, color) { const o = pops[popI++ % pops.length]; o.t = 1; o.p.set(pos.x, (pos.y || 0) + 1.5, pos.z); o.el.textContent = text; o.el.style.color = color; o.el.style.display = 'block';
  // several at once in one spot (a crash: the damage, the points, a crack) stack up instead of landing on top of each other
  for (let n = 0; n < 4; n++) { popA.copy(o.p).project(cam); let clash = false; for (const q of pops) { if (q === o || q.t < 0.55) continue; popB.copy(q.p).project(cam); if (Math.abs(popA.y - popB.y) * innerHeight < 40 && Math.abs(popA.x - popB.x) * innerWidth < 180) { clash = true; break; } } if (!clash) break; o.p.y += 1.3; } }
function updatePops(dt) { for (const o of pops) { if (o.t <= 0) continue; o.t -= dt * 0.9; o.p.y += dt * 1.6; const v = o.p.clone().project(cam); o.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%)'; o.el.style.opacity = Math.min(1, o.t * 2); if (o.t <= 0) o.el.style.display = 'none'; } }
let bannerT = 0; function banner(text) { $('taBanner').textContent = text; $('taBanner').style.opacity = 1; bannerT = 2.2; }
let statusT = 0; function status(text) { statusT = 0.4; const el = $('taFoe'); if (el._t !== text) { el._t = text; el.textContent = text; foeBox.r = null; } }
const timers = []; function after(t, fn) { timers.push({ at: clock + t, fn, rid: roundId }); }
function runTimers(dt) { clock += dt; for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= clock) { const t = timers[i]; timers.splice(i, 1); if (t.rid === roundId) t.fn(); } }
// how far down the top bar reaches: arrows, tips and first-time cards all keep below it
// and the boxes of everything else on the HUD (buttons, mini map, badge, BEAM): the arrows at the screen edge keep clear of them
let hudH = 116, hudBoxes = []; const foeBox = { r: null };
function measureHud() { const top = $('ta').querySelector('.top'), r = top.getBoundingClientRect(); if (r.height) { hudH = Math.round(r.bottom); document.body.style.setProperty('--hudH', hudH + 'px'); }
  hudBoxes = []; for (const el of [top, $('taPause'), $('taZoomIn'), $('taZoomOut'), $('ta').querySelector('.skipHud'), $('buBeam'), $('taMap'), $('taPct')]) { if (!el) continue; const b = el.getBoundingClientRect(); if (b.width && b.height) hudBoxes.push([b.left, b.top, b.right, b.bottom]); } foeBox.r = null; }
const foeBoxNow = () => { if (!foeBox.r) { const b = $('taFoe').getBoundingClientRect(); foeBox.r = b.width ? [b.left, b.top, b.right, b.bottom] : null; } return foeBox.r; }; /* the status bar (SHIELD LOW, MISSILE LOCK) while it shows */
addEventListener('resize', () => setTimeout(measureHud, 60)); if (document.fonts) document.fonts.ready.then(() => measureHud());
// an arrow at the screen edge, pointing at something off screen. It sits where the line from the middle of the screen to the thing
// meets the edge (but never up under the top bar: it drops straight down below it); if the HUD is there (or another arrow), it
// slides in along the line from the middle until it is clear
const placed = []; /* this frame's arrows (emptied each frame) */
function edgeArrow(el, pos, show) { const v = pos.clone().project(cam); const off = Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95 || v.z > 1; el.style.display = show && off ? 'block' : 'none'; if (!off || !show) return v;
  const W = innerWidth, H = innerHeight, a = Math.atan2(v.y, v.x), k = 0.9 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))), cx = W / 2, cy = H / 2, R = el._r || (el._r = el.classList.contains('poiArrow') ? 32 : 21);
  const dx = Math.cos(a) * k * 0.5 * W, dy = Math.max(-Math.sin(a) * k * 0.5 * H, hudH + R - cy), len = Math.hypot(dx, dy) || 1, boxes = statusT > 0 && foeBoxNow() ? [...hudBoxes, foeBox.r] : hudBoxes; let t = 1;
  for (let n = 0; n < 12 && t >= 0.3; n++) { const x = cx + dx * t, y = cy + dy * t; let hit = false;
    for (const b of boxes) { if (x <= b[0] - R || x >= b[2] + R || y <= b[1] - R || y >= b[3] + R) continue; const tx = dx > 0 ? (b[0] - R - cx) / dx : dx < 0 ? (b[2] + R - cx) / dx : -1, ty = dy > 0 ? (b[1] - R - cy) / dy : dy < 0 ? (b[3] + R - cy) / dy : -1; t = Math.max(tx, ty) - 0.002; hit = true; break; } /* in to where the line enters that box */
    if (!hit && t > 0.6) for (const p of placed) if (Math.hypot(p[0] - x, p[1] - y) < 30) { t -= 32 / len; hit = true; break; }
    if (!hit) break; }
  t = Math.max(0.3, t); const x = cx + dx * t, y = cy + dy * t;
  if (R > 30) { let near = 1e9; for (const p of placed) near = Math.min(near, Math.hypot(p[0] - x, p[1] - y)); el._hid = near < (el._hid ? 30 : 22); if (el._hid) { el.style.display = 'none'; return v; } } /* a big target's arrow with no room left beside the others waits its turn (the army's arrows always show) */
  placed.push([x, y]);
  el.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
  const dir = el.firstElementChild; if (dir && dir.tagName === 'I') dir.style.transform = 'rotate(' + (-a) + 'rad)'; return v; }

// ---------- the saucer ----------
const ship = { g: null, body: null, x: 0, z: 0, y: 5, vel: V3(), alive: true, center: V3(0, 5, 0), fall: null, spin: 0 };
const shipState = { pos: ship.center, vel: ship.vel, r: SHIELD_R, get alive() { return ship.alive && state === 'play'; } }; // what the army aims at
const beam = makeBeam(); scene.add(beam.g);
// the spot under the saucer: a soft shadow and a ring as wide as the beam, so you can see who it will catch
const reticle = (() => { const g = new THREE.Group(), c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sh.scale.setScalar(2.4); sh.renderOrder = 1; g.add(sh);
  const ring = new THREE.Mesh(new THREE.RingGeometry(GRAB_R - 0.12, GRAB_R + 0.05, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7df0ff, transparent: true, opacity: 0.4, depthWrite: false })); ring.renderOrder = 2; g.add(ring); g.userData.ring = ring; g.position.y = 0.13; scene.add(g); return g; })();
let boostRayT = 0, energy = E_MAX, boostT = 0, nukeT = 0, hitT = 0, hurtSfx = 0, dmgPop = 0, dmgPopT = 0, hits = 0, lowWarned = false, lowAt = -9, beepT = 0, rayCd = 0, beamHeld = false, beamOn = false, hoverT = 0, autoBeamT = 0, moveTo = null, lastGrab = -9, grabChain = 0;
let blindT = 0, radarDown = false, radioDown = false, fireBoost = false, stink = false, bumpT = 0, autoT = 0, pend = null, botDrag = null;
const hordeBodyNow = () => { const hs = hordeLook(); return hs ? hordeBody(hs) : null; }; // a graveyard zombie in one of the hordes worn (hordeSkins.js)
function makePlayerShip() { if (ship.g) { scene.remove(ship.g); disposeTree(ship.g); } const root = new THREE.Group(); let body; if (WALK()) { body = makeWalker(walkerPal(craftSkinKey('walker'))); rays.setColors(null); beam.g.visible = true; } else { body = sk.dress(makeShip()); sk.beam(beam); rays.setColors(sk.rayColors()); body.scale.setScalar(SHIP_SCALE); beam.g.visible = true; } root.add(body); scene.add(root);
  Object.assign(ship, { g: root, body, x: 0, z: 0, y: shipY(), alive: true, fall: null, spin: 0, face: 0 }); ship.vel.set(0, 0, 0); ship.center.set(0, ship.y, 0); root.position.copy(ship.center); }
const shipY = () => (WALK() ? WALK_Y : flyY());
const eyePos = () => V3(ship.x, ship.y - 0.42 * SHIP_SCALE, ship.z);
const addEnergy = (v) => { energy = Math.min(E_MAX, energy + v); };
const right = V3(), upv = V3(), tmp = V3(), want = V3();
// flying: the stick (a drag, or the keys) flies it straight; a tapped spot (moveTo) is reached by way of the streets round the
// big buildings (route). It flies at the one height all round town (no climbing over towers: they are solid, see below)
function fly(dt) {
  let sx = stick.x + ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0), sy = stick.y + ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0);
  cam.updateMatrixWorld(); right.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize(); upv.setFromMatrixColumn(cam.matrixWorld, 1).setY(0).normalize();
  const mag = Math.min(1, Math.hypot(sx, sy)), spd = SPEED * (boostT > 0 ? BOOST : 1) * (beamOn ? BEAM_SLOW : 1) * (WALK() ? WALK_SPD : 1); let acc = ACC; want.set(0, 0, 0); rtT -= dt;
  if (botDrag) { moveTo = null; want.set(botDrag.x, 0, botDrag.z).multiplyScalar(spd); } /* the balance robot dragging (a world direction, length up to 1) */
  else if (mag > 0.05) { moveTo = null; want.copy(right).multiplyScalar(sx).addScaledVector(upv, -sy).normalize().multiplyScalar(spd * mag); }
  else if (moveTo) { const dl = Math.hypot(moveTo.x - ship.x, moveTo.z - ship.z), sp0 = Math.hypot(ship.vel.x, ship.vel.z); if (dl < 0.35) moveTo = null;
    else { const w = WALK() ? moveTo : route(moveTo), dx = w.x - ship.x, dz = w.z - ship.z, d = Math.hypot(dx, dz) || 1; let v = Math.min(spd, dl * 2.4); /* it slows as it arrives */ if (sp0 > 0.5) v *= 0.45 + 0.55 * Math.max(0, (ship.vel.x * dx + ship.vel.z * dz) / (sp0 * d)); /* and round a sharp corner */
      want.set(dx / d * v, 0, dz / d * v); if (bldAhead(0.45)) acc = 6.5; } } // quick to swing away if its course would take it into a building
  ship.vel.lerp(want, Math.min(1, dt * acc)); ship.x += ship.vel.x * dt; ship.z += ship.vel.z * dt; // a little drift: it answers the stick quickly, not instantly
  const b = T.lim; ship.x = Math.max(-b.x - 2, Math.min(b.x + 2, ship.x)); ship.z = Math.max(-b.z - 2, Math.min(b.z + 2, ship.z));
  ship.y += (shipY() - ship.y) * Math.min(1, dt * 2);
  // big buildings: a warning just before (the building glows red, BUILDING!), then the crash
  if (state === 'play' && ship.alive && !WALK()) { bumpT = Math.max(0, bumpT - dt); const hb = blockerAt(ship.x, ship.z, BLD.rc); if (hb) { if (bumpT <= 0) crashInto(hb); else pushOut(hb); } if (!bldCard()) setWarn(bumpT <= 0 ? bldAhead(moveTo ? 0.4 : BLD.warn) : null); } /* (on its way to a tapped spot it steers round them itself: only a hit that is really coming is warned of. The BIG BUILDINGS card keeps its own building lit) */
  if (warnB && (WALK() || warnB.done) && !bldCard()) setWarn(null); /* (no warning for the walker, which steps over buildings, and none left on a building that has come down) */
  ship.center.set(ship.x, ship.y, ship.z); }

// ---------- big buildings are solid (BLD). bAt: the solid building on each street square, if any ----------
let bAt = [], warnB = null, warnT = -9;
function blockerAt(x, z, rc) { if (!T) return null; const cols = T.cols, rows = T.rows, cx = Math.round(x / CELL + (cols - 1) / 2), cy = Math.round(z / CELL + (rows - 1) / 2);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= cols || Y >= rows) continue; const b = bAt[Y * cols + X];
    if (!b || b.done) continue; if (Math.abs(x - b.pos.x) < b.bx + rc && Math.abs(z - b.pos.z) < b.bz + rc) return b; } return null; }
// the first one the saucer would fly into within secs, going the way it is going
function bldAhead(secs) { const vx = ship.vel.x, vz = ship.vel.z; if (vx * vx + vz * vz < 0.25) return null; for (let t = 0.1; t <= secs + 1e-6; t += 0.1) { const b = blockerAt(ship.x + vx * t, ship.z + vz * t, BLD.rc); if (b) return b; } return null; }
function clearLine(x0, z0, x1, z1, rc) { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.6)); for (let k = 1; k <= n; k++) if (blockerAt(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, rc)) return false; return true; }
// pushed out of a building's walls the shorter way (it says which way: [x, z])
function pushOut(b) { const rc = BLD.rc, dx = ship.x - b.pos.x, dz = ship.z - b.pos.z, px = b.bx + rc - Math.abs(dx), pz = b.bz + rc - Math.abs(dz);
  if (px < pz) { const s = Math.sign(dx) || 1; ship.x += s * (px + 0.02); return [s, 0]; } const s = Math.sign(dz) || 1; ship.z += s * (pz + 0.02); return [0, s]; }
// flown into: a big jolt, an explosion where it hit, the building collapses into pieces of itself (it counts toward the town
// destroyed: ramming is a costly way to wreck), the saucer is knocked back, and nothing else can hurt it that way for a second
function crashInto(b) { const n = pushOut(b), at = V3(ship.x - n[0] * BLD.rc, Math.min(ship.y - 0.2, b.h * 0.8), ship.z - n[1] * BLD.rc); bumpT = BLD.bump; stats.bumps = (stats.bumps || 0) + 1;
  fx.explode(at, 1.4); fx.sparks(at, 26, { speed: 9, up: 4, life: 0.7 }); fx.sparks(ship.center, 14, { c: [0xffffff, 0x7dff3a], speed: 6, up: 2, life: 0.4 }); flashT = Math.max(flashT, 0.25); sfx.boom(); sfx.crunch(true);
  crumble(b, at, 'CRASH!'); ship.vel.set(n[0] * 7, 0, n[1] * 7); moveTo = null; pend = null; setWarn(null);
  popup(at, '💥 CRASH!', '#ff7a5a'); hurt(BLD.dmg, 'building', at); }
// BUILDING! the building the saucer is about to fly into glows red: a box round its walls and its edges
const warnG = new THREE.Group(), warnGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), warnBox = new THREE.Mesh(warnGeo, new THREE.MeshBasicMaterial({ color: 0xff2410, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })), warnEdge = new THREE.LineSegments(new THREE.EdgesGeometry(warnGeo), new THREE.LineBasicMaterial({ color: 0xff7a5a, transparent: true, opacity: 0.9, fog: false }));
warnBox.renderOrder = warnEdge.renderOrder = 3; warnG.add(warnBox, warnEdge); warnG.visible = false; scene.add(warnG);
function setWarn(b) { if (b !== warnB) { warnB = b; if (b) { warnG.position.set(b.pos.x, 0, b.pos.z); warnG.scale.set(b.bx * 2 + 0.14, b.h + 0.12, b.bz * 2 + 0.14); if (played - warnT > 1.2 && state === 'play') { warnT = played; popup(ship.center, '⚠ BUILDING!', '#ff5a4a'); sfx.ping(10); } } }
  warnG.visible = !!b; if (b) { const k = 0.5 + 0.5 * Math.sin(performance.now() * 0.024); /* (real time: it keeps flashing while a card holds the round) */ warnBox.material.opacity = 0.3 + 0.45 * k; warnEdge.material.opacity = 0.6 + 0.4 * k; } } /* a bright red flash over the building, even on a red brick one */
// the way to a tapped spot round the big buildings: a map of how far every square is from the spot (the solid buildings left
// out), walked downhill to the furthest square in plain sight. Straight there when nothing solid is in the way (as Zombie Air Raid's heli)
let rtF = new Int16Array(1), rtKey = -1, rtT = 0; const rtQ = [], tmpW = V3();
function routeField(ti) { const cols = T.cols, N = cols * T.rows; if (rtF.length !== N) rtF = new Int16Array(N); rtF.fill(-1);
  let h = 0; rtQ.length = 0; rtF[ti] = 0; rtQ.push(ti); while (h < rtQ.length) { const i = rtQ[h++], x = i % cols, d = rtF[i] + 1; for (const j of [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, i - cols, i + cols]) { if (j < 0 || j >= N || rtF[j] >= 0) continue; const b = bAt[j]; if (b && !b.done) continue; rtF[j] = d; rtQ.push(j); } } }
function route(w) { const rc = BLD.rc + 0.35; if (clearLine(ship.x, ship.z, w.x, w.z, rc)) return w; // (a little room to spare: it never quite flies the line it plans)
  const cols = T.cols, rows = T.rows, inG = (q) => { q.cx = Math.max(0, Math.min(cols - 1, q.cx)); q.cy = Math.max(0, Math.min(rows - 1, q.cy)); return q; }, tc = inG(toCell(w.x, w.z, cols, rows)), hc = inG(toCell(ship.x, ship.z, cols, rows)), ti = tc.cy * cols + tc.cx;
  if (ti !== rtKey || rtT <= 0) { rtKey = ti; rtT = 1; routeField(ti); } /* (worked out again each second: buildings come down) */
  let i = hc.cy * cols + hc.cx, best = null, first = null; for (let s = 0; s < 8; s++) { let nx = -1, nv = rtF[i] >= 0 ? rtF[i] : 32000; const x = i % cols; for (const j of [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, i - cols, i + cols]) if (j >= 0 && j < rtF.length && rtF[j] >= 0 && rtF[j] < nv) { nv = rtF[j]; nx = j; } if (nx < 0) break; i = nx;
    const p = toWorld(i % cols, (i / cols) | 0, cols, rows); if (!first) first = p; if (clearLine(ship.x, ship.z, p.x, p.z, rc)) best = p; else if (best) break; }
  if (best) return tmpW.set(best.x, 0, best.z); /* nothing in plain sight with room to spare: the straight line or the first step if either only just clears */
  if (clearLine(ship.x, ship.z, w.x, w.z, BLD.rc)) return w; if (first && clearLine(ship.x, ship.z, first.x, first.z, BLD.rc)) return tmpW.set(first.x, 0, first.z); return first ? tmpW.set(first.x, 0, first.z) : w; }
// a spot inside (or right against) a big building's walls, from a tap on it or the minimap: a free spot just outside them
// instead, on the side the saucer is coming from
function outOf(p) { const rc = BLD.rc + 0.3, b = blockerAt(p.x, p.z, rc); if (!b) return p;
  const ex = b.bx + rc + 0.05, ez = b.bz + rc + 0.05, score = (x, z) => Math.hypot(x - p.x, z - p.z) + 0.6 * Math.hypot(x - ship.x, z - ship.z); let best = null, bs = 1e9;
  for (const [x, z] of [[b.pos.x + ex, p.z], [b.pos.x - ex, p.z], [p.x, b.pos.z + ez], [p.x, b.pos.z - ez]]) { if (blockerAt(x, z, rc)) continue; const s = score(x, z); if (s < bs) { bs = s; best = [x, z]; } }
  for (let r = 0.5; !best && r <= 8; r += 0.5) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.2832, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; if (blockerAt(x, z, rc)) continue; const s = score(x, z); if (s < bs) { bs = s; best = [x, z]; } }
  if (best) { p.x = best[0]; p.z = best[1]; } return p; }
// fly to a spot (a tap, the minimap, a big target's chip): inside the town, outside any big building's walls
const wayMark = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.78, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7df0ff, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false })); wayMark.renderOrder = 4; wayMark.visible = false; scene.add(wayMark);
function goTo(x, z) { const b = T.lim; moveTo = outOf(V3(Math.max(-b.x, Math.min(b.x, x)), 0, Math.max(-b.z, Math.min(b.z, z)))); return moveTo; }
// how the saucer looks each frame: bobbing, leaning into its turns, lights racing round faster the quicker it goes, the pilot looking where it's going, and the shield
const shieldCol = new THREE.Color(), GOLD = new THREE.Color(0xffd24a), LOWC = new THREE.Color(0xff3a2a), MIDC = new THREE.Color(0xffd24a), OKC = new THREE.Color(0x7dff3a), WHITE = new THREE.Color(0xffffff), DOMEC = new THREE.Color(0xd8ffb0);
function walkerLook(dt) { const u = ship.body.userData, sp = Math.hypot(ship.vel.x, ship.vel.z); if (sp > 0.6) { let d = Math.atan2(ship.vel.x, ship.vel.z) - ship.face; d = Math.atan2(Math.sin(d), Math.cos(d)); ship.face += d * Math.min(1, dt * 4); }
  reticle.visible = false; ship.g.position.set(ship.x, ship.y, ship.z); ship.g.rotation.set(0, 0, 0); u.ring.material.map.offset.x += dt * (0.4 + sp * 0.2); u.pods.rotation.y += dt;
  const steps = walkerTick(ship.body, dt, ship.x, ship.z, ship.y, ship.vel.x, ship.vel.z, ship.face); aimLight(ship.body, WALK_REACH, ship.face, 1 + (u.catching || 0) * 1.4);
  u.domeK = Math.max(0, (u.domeK || 0) - dt * 3); const k = energy / E_MAX; hitT = Math.max(0, hitT - dt); u.shield.material.opacity = (0.06 + hitT * 1.4) * (k < 0.25 && Math.random() < 0.25 ? 0.2 : 1);
  if (state === 'play') for (const p of steps) { stats.steps = (stats.steps || 0) + 1; stomp(p); } }
// a foot comes down: whatever building it lands on takes a hit (as the kaiju's do); dust and a thud
function stomp(p) { fx.sparks(V3(p.x, 0.2, p.z), 5, { c: [0xb8a888, 0x8a7a68], speed: 2, up: 1.5, life: 0.5 }); if (toScreen(p).on) { sfx.stomp ? sfx.stomp(2) : sfx.pop(); jolt(0.06); }
  if (!T) return; const cols = T.cols, c = toCell(p.x, p.z, cols, T.rows); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const l = bGrid.get((c.cy + j) * cols + c.cx + i); if (l) for (const x of l) { if (x.done) continue; const b = x.box; if (p.x > b.min.x - 0.7 && p.x < b.max.x + 0.7 && p.z > b.min.z - 0.7 && p.z < b.max.z + 0.7) { hitBuilding(x, p.clone().setY(Math.min(x.h, 1.5))); stats.stomps = (stats.stomps || 0) + 1; } } } }
// the searchlight: anyone (or any car, or soldier) standing in it for WALK_HOLD seconds is beamed up
const inLight = (q) => { const f = ship.face, dx = q.x - ship.x, dz = q.z - ship.z, along = dx * Math.sin(f) + dz * Math.cos(f), lat = Math.abs(dx * Math.cos(f) - dz * Math.sin(f)); return along > 0.4 && along < WALK_REACH + 0.6 && lat < 0.5 + along * 0.2; };
function walkerBeam(dt) { const u = ship.body.userData; let n = 0;
  const tick = (o, pos) => { if (inLight(pos)) { o.wb = (o.wb || 0) + dt; n++; if (o.wb >= WALK_HOLD - 0.6 && !o.wbShown) { o.wbShown = true; popup(pos, '🔦', '#b8ffd0'); } return o.wb >= WALK_HOLD; } o.wb = 0; o.wbShown = false; return false; };
  for (let i = people.length - 1; i >= 0 && lifted.length < LIFT_MAX; i--) { const c = people[i]; if (tick(c.userData, c.position)) { people.splice(i, 1); lift(c, c.userData.kind || 'person'); } }
  const S = army.soldiers; for (let i = S.length - 1; i >= 0 && lifted.length < LIFT_MAX; i--) { const s0 = S[i]; if (tick(s0.userData, s0.position)) { S.splice(i, 1); lift(s0, 'soldier'); } }
  for (let i = drivers.length - 1; i >= 0 && lifted.length < LIFT_MAX; i--) { const o = drivers[i]; if (tick(o, o.g.position)) { drivers.splice(i, 1); lift(o.g, 'car'); } }
  u.catching = Math.min(1, n * 0.5); }
function shipLook(dt) { if (WALK()) { walkerLook(dt); return; } const g = ship.g, u = ship.body.userData, sp = Math.hypot(ship.vel.x, ship.vel.z); reticle.visible = !ship.fall && g.visible; if (ship.fall) return;
  reticle.position.set(ship.x, 0.13, ship.z); reticle.userData.ring.material.opacity = beamOn ? 0.8 : 0.3 + Math.sin(played * 4) * 0.12;
  g.position.set(ship.x, ship.y + Math.sin(played * 2.1) * 0.12, ship.z); g.rotation.set(ship.vel.z * 0.032 + Math.sin(played * 1.3) * 0.03, 0, -ship.vel.x * 0.032 + Math.cos(played * 1.1) * 0.03);
  u.ring.material.map.offset.x += dt * (0.5 + sp * 0.22 + (boostT > 0 ? 1.4 : 0)); ship.spin += dt * (0.4 + sp * 0.05 + (boostT > 0 ? 7 : 0)); u.pods.rotation.y = ship.spin; /* (boosted: the disc spins fast) */
  const face = sp > 0.6 ? Math.atan2(ship.vel.x, ship.vel.z) : ISO_YAW; let d = face - u.pilot.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); u.pilot.rotation.y += d * Math.min(1, dt * 5); u.pilot.rotation.x += ((beamOn ? 0.45 : 0) - u.pilot.rotation.x) * Math.min(1, dt * 6); // it looks down while beaming
  u.domeK = Math.max(0, (u.domeK || 0) - dt * 3); u.dome.material.emissive.setHex(u.domeE ?? 0x2a7a1a).lerp(DOMEC, u.domeK); // it lights up as each one comes aboard
  u.eye.material.color.setHex(beamOn ? 0xd8ffff : 0x7df0ff); u.eye.scale.setScalar(beamOn ? 1.3 + Math.sin(played * 30) * 0.1 : 1);
  const k = energy / E_MAX; hitT = Math.max(0, hitT - dt); const sh = u.shield;
  if (nukeT > 0) shieldCol.copy(GOLD); else if (k > 0.5) shieldCol.copy(OKC); else if (k > 0.25) shieldCol.copy(MIDC).lerp(OKC, (k - 0.25) / 0.25); else shieldCol.copy(LOWC);
  sh.material.color.copy(shieldCol); if (hitT > 0) sh.material.color.lerp(WHITE, Math.min(1, hitT * 4));
  const flick = k < 0.25 && nukeT <= 0 ? (Math.random() < 0.25 ? 0.03 : 1) : 1; sh.material.opacity = (0.1 + 0.05 * Math.sin(played * 5) + hitT * 1.6 + (nukeT > 0 ? 0.2 : 0)) * flick; sh.scale.set(1 + hitT * 0.4, 0.5 + hitT * 0.2, 1 + hitT * 0.4); } // the bubble flashes when it is hit, and stutters when it is running out

// ---------- the tractor beam: hold BEAM and anyone under the ship floats up, spinning, into it ----------
const lifted = [];
function lift(c, kind) { delete c.updateMatrixWorld; c.userData.frz = false; c.userData.panic = true; lifted.push({ c, kind, t: 0, spin: rnd(4, 8) * (Math.random() < 0.5 ? -1 : 1), s0: c.scale.x }); if (kind !== 'car' && Math.random() < 0.3) popup(c.position, SHOUTS[(Math.random() * SHOUTS.length) | 0], '#ffffff'); }
function updateLifted(dt) { const top = ship.y - 0.45;
  for (let i = lifted.length - 1; i >= 0; i--) { const l = lifted[i], c = l.c, p = c.position; l.t += dt;
    if (!ship.alive || ship.fall) { p.y = Math.max(0, p.y - dt * 4); c.rotation.z *= 0.9; if (p.y <= 0) { lifted.splice(i, 1); c.rotation.set(0, c.rotation.y, 0); c.scale.setScalar(l.s0); if (l.kind === 'car') scene.remove(c); else { Object.assign(c.userData, { home: p.clone(), goal: null, stun: played + 1.5 }); (l.kind === 'soldier' ? army.soldiers : people).push(c); } } continue; } // the ship is going down: they drop back to the street
    const e = Math.min(1, dt * 2.6); p.x += (ship.x - p.x) * e; p.z += (ship.z - p.z) * e; p.y += (1.1 + l.t * 3.3) * dt * (l.kind === 'car' ? 0.6 : 1); c.rotation.y += l.spin * dt; c.rotation.z = Math.sin(l.t * 7) * 0.35; // drawn into the middle of the beam, tumbling up
    if (l.kind !== 'car') animateWalk(c, dt, 1.6);
    const k = Math.max(0, Math.min(1, (p.y - (top - 1.8)) / 1.8)); c.scale.setScalar(l.s0 * (1 - 0.75 * k)); // shrinking into the hatch
    if (p.y >= top) { lifted.splice(i, 1); scene.remove(c); aboard(l); } } }
// someone is aboard: energy (more for a quick run of them), points, and the dome lights up
function aboard(l) { const c = l.c, kind = l.kind, at = ship.center.clone().setY(ship.y + 0.6);
  if (played - lastGrab < 2.2) grabChain++; else grabChain = 0; lastGrab = played;
  const gain = (kind === 'car' ? 0.8 : kind === 'soldier' ? 3 : kind === 'zombie' ? 1.2 : 2) + Math.min(grabChain, 8) * 0.35; /* (half what it was: health is harder to win back) */ addEnergy(gain);
  if (kind !== 'car') abd++; addPower(EP[kind] || 1); { const key = { car: 'cars', soldier: 'soldiers', zombie: 'zombies', convict: 'convicts' }[kind] || 'people'; stats[key] = (stats[key] || 0) + 1; }
  const label = kind === 'car' ? 'CAR NAPPED' : kind === 'soldier' ? 'SOLDIER' : kind === 'zombie' ? 'ZOMBIE' : kind === 'convict' ? 'CONVICT' : '';
  award(kind === 'car' ? 150 : kind === 'soldier' ? 60 : kind === 'zombie' ? 80 : kind === 'convict' ? 90 : 30, at, label, true);
  popup(at, '+' + Math.round(gain) + '⚡' + (label ? ' ' + label : '') + (grabChain >= 2 ? '  x' + (grabChain + 1) : ''), grabChain >= 2 ? '#c8ff6a' : '#7dff3a');
  if (grabChain > 0 && grabChain % 5 === 0) { banner('👽 BEAM CHAIN x' + (grabChain + 1) + '!'); sfx.power(); }
  ship.body.userData.domeK = 1; sfx.pickup(); fx.sparks(at, 6, { c: [0xffffff, 0x7dff3a], speed: 3, up: 3, life: 0.4 });
  if (kind === 'person') { c.rotation.set(0, 0, 0); c.scale.setScalar(0.25); poolP.push(c); } else if (kind === 'zombie') c.traverse((m) => { if (m.isMesh && m.material && m.material.vertexColors) m.geometry.dispose(); }); /* a zombie is never reused: free its own merged shapes (not the shared eyes and beams) */ // back in the pool: they come out of the next building to fall
  if (abd === L().abduct) { banner(pct() >= L().goal ? '👽 ENOUGH PEOPLE!' : '👽 ENOUGH PEOPLE! NOW WRECK THE TOWN'); sfx.wave(); } }

// ---------- the death ray. A tap flies the saucer to the spot and zaps what is there; the ray also zaps the buildings round
// the saucer by itself (autoRay). It costs no energy ----------
const zapRay = new THREE.Raycaster(), groundPlane = new THREE.Plane(V3(0, 1, 0), 0), hitV = V3(), tmp2 = V3();
// what is under a point on the screen, and the spot on the ground there. Worked out the moment the finger lands (the view keeps
// moving while a tap is down: the thing the player put a finger on is the thing that gets zapped)
function pickAt(cx, cy) {
  if (!T) return null; cam.updateMatrixWorld(); zapRay.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), cam);
  const sd = (pos) => { const v = tmp.copy(pos).project(cam); return v.z > 1 ? Infinity : Math.hypot((v.x * 0.5 + 0.5) * innerWidth - cx, (-v.y * 0.5 + 0.5) * innerHeight - cy); };
  // the army first (small, and what the player is usually aiming at; the horn trucks with it), then whatever building or big target the tap goes through
  let tgt = army.pick(sd, foes.targets().map((f) => hornTgt(f, 58)));
  if (!tgt) { let bt = Infinity;
    for (const k of poiOrder) { const P = pois[k]; if (P.done) continue; const h = zapRay.ray.intersectBox(P.box, hitV), onBadge = P.mark && sd(P.mark.userData.badge.getWorldPosition(tmp2)) < 46; // its floating badge is drawn on top of everything, so a tap on the badge wins
      const t = onBadge ? 0 : h ? h.distanceTo(zapRay.ray.origin) : sd(P.center.clone().setY(1.2)) < 54 ? 1e6 : Infinity; if (t < bt) { bt = t; const at = h && !onBadge ? h.clone() : P.center.clone().setY(1.2); tgt = { kind: 'poi', k, pos: at, go: P.center, hit: () => hitPoi(k, at), ok: () => !P.done }; } }
    for (const x of buildings) { if (x.done) continue; const h = zapRay.ray.intersectBox(x.box, hitV); if (!h) continue; const t = h.distanceTo(zapRay.ray.origin); if (t < bt) { bt = t; const at = h.clone(); tgt = { kind: 'building', pos: at, go: x.pos, hit: () => hitBuilding(x, at), ok: () => !x.done }; } } }
  const p = V3(); if (!zapRay.ray.intersectPlane(groundPlane, p)) return null; return { tgt, p }; }
// a tap on the town (as in Tornado Time!): the saucer flies to the spot (to a building's or a big target's own spot, or a tank's
// or a soldier's), and the death ray zaps whatever was tapped. Aircraft, missiles, shells and the trucks (tgt.stay) are zapped
// where they are and the saucer keeps its course, as the tornado's lightning does with the planes. Too far for the ray, or the
// ray still cooling? It fires as soon as it can
function tapAt(cx, cy, aim) {
  if (state !== 'play' || coachBusy()) return; /* a first-time card is holding the round */ const h = aim || pickAt(cx, cy); if (!h) return; let tgt = h.tgt; if (tgt && tgt.ok && !tgt.ok()) tgt = null; /* gone since the finger landed */
  if (!tgt || !tgt.stay) { const at = tgt ? (tgt.go || tgt.pos) : h.p, w = goTo(at.x, at.z); fx.shock(w, 1.2, 0x7df0ff, 0.35); }
  if (tgt) { if (!fireAt(tgt)) pend = { tgt, t: 3 }; else pend = null; } }
// a still tap is lifted (touch or mouse). card: it began while a first-time card was up (or just after one closed), so it only
// closed that card. The FLY card says a tap flies the saucer, so a tap answers it and flies
function tapUp(x, y, aim, card) { if (coachBusy()) { if (flyCard()) { answerCard(); tapAt(x, y, aim); } return; } if (!card) tapAt(x, y, aim); }
const flyCard = () => coachBusy() && !!curCard && curCard.key === 'bu_move'; /* (while it is up, even a press on the saucer itself is a tap: the round is holding, so there is nothing to beam) */
const inReach = (tgt) => Math.hypot(tgt.pos.x - ship.x, tgt.pos.z - ship.z) <= RAY_RANGE;
// the one place the death ray is fired from, taps and automatic shots alike (o.auto: the ray's own shot, no cooldown, quieter)
// the ray's levels: unlocked at these shares of the town's people goal (L().abduct); the nukes are one shot each, and come
// back with every SW.more of the goal beamed up after that
// E LEVELS: POWER (EP: per person beamed up, building wrecked, big target) sets the level; at: the share of the town's
// people goal (L().abduct) of power each level needs; lose: power lost per point of damage taken
const SW = { at: [0.15, 0.35, 0.6, 0.9], more: 0.3, miniR: 7, lose: 0.2, start: 0.9, nukeCd: 25, l: [{ icon: '🔫', name: 'E1 RAY' }, { icon: '⚡', name: 'E2 HEAVY RAY' }, { icon: '🔱', name: 'E3 TRIPLE RAY' }, { icon: '💥', name: 'E4 MINI NUKE' }, { icon: '☢️', name: 'E5 BIG NUKE' }] };
const EP = { person: 1, soldier: 2, car: 2, zombie: 1, convict: 1, building: 0.5, poi: 6 };
let sw = 0, swLv = 0, swN = [0, 0], swNext = 0, power = 0, shotLv = 0; const nukeCd = [0, 0];
function addPower(n) { if (state !== 'play') return; power = Math.max(0, power + n); swCheck(); }
function swCheck() { const g = L().abduct; let ch = false; while (swLv < 4 && power >= SW.at[swLv] * g) { swLv++; ch = true; if (swLv >= 3 && swN[swLv - 3] < 1) swN[swLv - 3] = 1; if (swLv === 4) swNext = power + SW.more * g; sw = swLv; banner('⬆ E' + (swLv + 1) + ': ' + SW.l[swLv].name.slice(3) + '!'); sfx.wave(); }
  while (swLv > 0 && power < SW.at[swLv - 1] * g) { swLv--; ch = true; banner('⬇ E' + (swLv + 1) + ': TOO MANY HITS!'); sfx.hurt(); } if (sw > swLv) sw = swLv;

  const el = $('buE'); if (el) { if (el.textContent !== 'E' + (swLv + 1)) { el.textContent = 'E' + (swLv + 1); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } } drawEBar(); poiReady();
  if (ch) drawSw(); }
// the E bar: one bar across all five levels (a tick at each), filled to your power; red when you are close to going down
function drawEBar() { const g = L().abduct, top = SW.at[3] * g * 1.2, f = $('buGrowFill'); if (!f) return; f.style.width = Math.max(0, Math.min(100, power / top * 100)).toFixed(1) + '%'; const bar = $('buGrow'); bar.classList.toggle('low', false); bar.classList.toggle('nuke', nukeT > 0);
  if (bar.dataset.g !== String(g)) { bar.dataset.g = String(g); bar.querySelectorAll('.tick').forEach((t) => t.remove()); SW.at.forEach((a, i) => { const t = document.createElement('i'); t.className = 'tick'; t.style.left = (a * g / top * 100).toFixed(1) + '%'; t.innerHTML = '<b>E' + (i + 2) + '</b>'; bar.appendChild(t); }); }
  bar.querySelectorAll('.tick').forEach((t, i) => t.classList.toggle('got', swLv > i)); }
// the big targets your gun can take light up (chip, arrow and the badge in town); the others stay dim
function poiReady() { for (const k of poiOrder) { const P = pois[k]; if (!P || P.done) continue; const ok = swLv + 1 >= poiNeed(k); if (P.chip) P.chip.classList.toggle('ready', ok); if (P.arrow) P.arrow.classList.toggle('ready', ok); if (P.mark) P.mark.visible = true, P.mark.userData.dim = !ok; } }
function drawSw() { const box = $('buWpns'); if (!box) return; if (!box.children.length) SW.l.forEach((w, i) => { const b = document.createElement('button'); b.innerHTML = '<b>' + w.icon + '</b><i>E' + (i + 1) + '</i>'; b.setAttribute('aria-label', w.name);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (state !== 'play' || i > swLv || (i >= 3 && swN[i - 3] <= 0)) return; sw = i; drawSw(); popup(ship.center, w.name, '#ffd24a'); }); box.appendChild(b); });
  SW.l.forEach((w, i) => { const b = box.children[i]; b.classList.toggle('lock', i > swLv || (i >= 3 && swN[i - 3] <= 0)); b.classList.toggle('sel', i === sw); b.querySelector('i').textContent = i >= 3 && swN[i - 3] <= 0 && i <= swLv ? Math.ceil(nukeCd[i - 3]) + 's' : 'E' + (i + 1); }); }
function nukeTick(dt) { for (const k of [0, 1]) { if (swN[k] >= 1 || swLv < 3 + k) continue; const was = Math.ceil(nukeCd[k]); nukeCd[k] -= dt; if (nukeCd[k] <= 0) { swN[k] = 1; banner('☢️ ' + SW.l[3 + k].name.slice(3) + ' READY!'); sfx.power(); drawSw(); } else if (Math.ceil(nukeCd[k]) !== was) drawSw(); } }
// a tap's shot at the picked level (the ray's own automatic shots stay plain)
// a tap on a big target picks the gun it needs by itself (the smallest one that will do, if you have it ready)
function autoGun(need) { if (sw + 1 >= need && (sw < 3 || swN[sw - 3] > 0)) return; for (let i = need - 1; i <= swLv; i++) if (i < 3 || swN[i - 3] > 0) { if (sw !== i) { sw = i; drawSw(); } return; } }
function swShot(tgt, to) { if (sw >= 3) { const k = sw - 3; if (swN[k] > 0) { swN[k]--; nukeCd[k] = SW.nukeCd; if (tgt.kind === 'poi' && !pois[tgt.k].done) wreckPoi(tgt.k); /* (a nuke takes a big target out in one go) */ goNuke(to, k ? NUKE_R : SW.miniR); stats.nukes = (stats.nukes || 0) + 1; } sw = Math.min(swLv, 2); drawSw(); return; }
  if (sw >= 1) { fx.glow(to, 3.2, 0xffffff, 0.5, 0.6); tgt.hit(); } /* the heavy ray: twice the damage */
  if (sw === 2) { let n = 0; for (const x of buildings) { if (n >= 2) break; if (x.done || x.pos.distanceTo(to) > 6 || x.pos.distanceTo(to) < 0.5) continue; const at = x.pos.clone().setY(Math.min(x.h * 0.6, 2.5)); rays.fire(eyePos(), at); hitBuilding(x, at); hitBuilding(x, at); n++; } } }
function fireAt(tgt, o = {}) { if (tgt.ok && !tgt.ok()) return false; if (!o.auto && tgt.kind === 'poi') autoGun(poiNeed(tgt.k)); shotLv = o.auto ? 0 : sw; /* (the gun this shot is: a big target needs one of its E level) */ /* already gone (a waiting shot drops it) */ if (!o.auto) { if (rayCd > 0 || !inReach(tgt)) return false; rayCd = RAY_CD; stats.shots = (stats.shots || 0) + 1; } else stats.auto = (stats.auto || 0) + 1;
  const from = eyePos(), to = tgt.pos.clone(); rays.fire(from, to); (WALK() || sk.hit(to));
  // where every ray lands (taps and automatic shots alike)
  fx.flash(to, o.auto ? 0.6 : 0.9, 0xff9af0); fx.sparks(to, o.auto ? 7 : 12, { c: [0xffffff, 0xff5ae0], speed: 6, up: 4, life: 0.45 }); fx.glow(to, o.auto ? 1.4 : 2, 0xff3ad0, 0.4, 0.7);
  if (o.auto) sfx.zap(); else { sfx.laser(); sfx.zap(); jolt(0.08); ship.vel.addScaledVector(V3(ship.x - to.x, 0, ship.z - to.z).normalize(), 0.6); } // a little kick back
  tgt.hit(); if (!o.auto) swShot(tgt, to); return true; }
// the ray's own shots: the nearest standing building the saucer is over or right beside, every AUTO_CD (free). Aimed at the
// nearest point of the building to the saucer's lamp: down onto a roof below, straight across at a wall alongside
const boxD = (bx, x, z) => Math.hypot(Math.max(bx.min.x - x, 0, x - bx.max.x), Math.max(bx.min.z - z, 0, z - bx.max.z));
function autoRay(dt) { autoT -= dt; if (autoT > 0 || !ship.alive || !T) return; autoT = 0.12; const cols = T.cols, c = toCell(ship.x, ship.z, cols, T.rows); let best = null, bd = AUTO_R;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = c.cx + i, Y = c.cy + j; if (X < 0 || Y < 0 || X >= cols || Y >= T.rows) continue; const l = bGrid.get(Y * cols + X); if (l) for (const x of l) { if (x.done) continue; const d = boxD(x.box, ship.x, ship.z); if (d < bd) { bd = d; best = x; } } }
  if (!best) return; autoT = AUTO_CD; const x = best, e = eyePos(), at = x.box.clampPoint(e, V3()); if (at.y > e.y - 0.3 && Math.hypot(at.x - e.x, at.z - e.z) < 0.4) at.y = e.y - 0.3;
  fireAt({ kind: 'building', pos: at, hit: () => hitBuilding(x, at) }, { auto: true }); }
// F on a computer: the nearest attacker in range (or the nearest building ahead if there is none). The saucer stays where it is
function zapKey() { if (state !== 'play' || coachBusy()) return; let t = army.nearest(ship.center, 16); const dS = (q) => Math.hypot(q.pos.x - ship.x, q.pos.z - ship.z);
  for (const f of foes.targets()) { const h = hornTgt(f, 58); if (dS(h) < 16 && (!t || t.kind === 'soldier' || dS(h) < dS(t))) t = h; } /* the horn trucks too (before a soldier) */ if (t) { fireAt(t); return; }
  let best = null, bd = 9; const fx0 = ship.vel.x, fz0 = ship.vel.z, l = Math.hypot(fx0, fz0); for (const x of buildings) { if (x.done) continue; const dx = x.pos.x - ship.x, dz = x.pos.z - ship.z, d = Math.hypot(dx, dz); if (l > 0.5 && (dx * fx0 + dz * fz0) / (d * l + 1e-6) < 0.3) continue; if (d < bd) { bd = d; best = x; } }
  if (best) { const at = best.pos.clone().setY(Math.min(best.h * 0.6, 2.5)); fireAt({ kind: 'building', pos: at, hit: () => hitBuilding(best, at) }); } }
function hitBuilding(x, at) { if (x.done) return; x.hp--;
  if (x.hp > 0) { fx.ignite(V3(x.pos.x, Math.min(x.h * 0.7, 4), x.pos.z), 0.7, 5); fx.puff('smoke', at, 0.8); fx.sparks(at, 10, { speed: 5, up: 3, life: 0.5 }); popup(x.pos.clone().setY(x.h * 0.6), 'CRACKED! ' + x.hp + ' MORE', '#ffd24a'); sfx.crunch(); jolt(0.12); }
  else crumble(x, V3(ship.x, 0, ship.z));
  // the ray's splash: anything else right where it lands takes a hit too
  for (const y of buildings) if (y !== x && !y.done && Math.hypot(y.pos.x - at.x, y.pos.z - at.z) < 1.1) { y.hp--; if (y.hp <= 0) crumble(y, at); }
  if (fireBoost) for (const y of buildings) if (!y.done && y.burnT == null && Math.hypot(y.pos.x - at.x, y.pos.z - at.z) < 2.6) ignite(y);
  if (T.city.knock(at.x, at.z, 1.2, 0, 0)) T.freeKnocked(); }
const free = (o) => T.free(o);
// a building comes down: it cracks, then bursts into pieces of itself, and the people inside run out into the street
function crumble(x, from, label = '') { addPower(EP.building);
  free(x.obj); x.done = true; bDone++; dropObstacle(x.pos); if (x.b.userData.edges) x.b.userData.edges.visible = false; const ex = x.obj === x.b ? (x.b.userData.extras || []).filter((m) => m.parent) : [];
  twisters.tear(x.obj, x.pos, new THREE.Box3().setFromObject(x.obj).getSize(V3()), null, [], ex, { collapse: true, from: from || null, power: 1 });
  fx.puff('smoke', V3(x.pos.x, 0.8, x.pos.z), 1.2 + x.h * 0.15); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + Math.random(); fx.dust({ x: x.pos.x + Math.cos(a) * 1.1, y: 0, z: x.pos.z + Math.sin(a) * 1.1 }, 0.8 + x.h * 0.12, Math.cos(a) * 2, Math.sin(a) * 2); }
  jolt(Math.min(0.45, 0.1 + x.h * 0.05)); award(x.pts, x.pos, label); sfx.crunch(x.h > 5); if (x.h > 5) { sfx.boom(); flashT = Math.max(flashT, 0.08); }
  spill(x.pos, 1 + (x.h > 3 ? 1 : 0) + (Math.random() < 0.4 ? 1 : 0)); }
// people pour out of a building that comes down (a few at a time, so the town never fills up)
function spill(at, n) { if (people.length > 520) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 1.4 + Math.random() * 1.2, c = addPerson(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r); collidePerson(c); c.userData.stun = played + 0.4; } }
// a blast on the ground: the buildings in it come down, the army in it is done for, people are knocked off their feet
function blast(c, r, o = {}) { let n = 0; if (!T) return 0;
  for (const x of buildings) { if (x.done) continue; if (Math.hypot(x.pos.x - c.x, x.pos.z - c.z) < r + 0.9) { crumble(x, o.from || c, o.label); n++; } }
  army.hitArea(c, r); foes.hitAt(c, r); for (const p of people) if (Math.hypot(p.position.x - c.x, p.position.z - c.z) < r + 1.5) p.userData.stun = played + 2;
  for (let i = drivers.length - 1; i >= 0; i--) { const q = drivers[i].g.position; if (Math.hypot(q.x - c.x, q.z - c.z) < r + 0.5) { const d = drivers[i]; drivers.splice(i, 1); blowCar(d.g, q.clone()); } }
  if (T.city.knock(c.x, c.z, r, 0, 0)) T.freeKnocked(); return n; }
function blowCar(g, q) { twisters.scatter([g], q, 6); fx.explode(q.clone().setY(0.4), 1); fx.ignite(q.clone().setY(0.2), 0.7, 5); award(80, q, 'BOOM'); }
// the army's own shells and rockets that miss the saucer land in town, and what they hit counts for you
function groundHit(p, kind) { if (state !== 'play') return; let nb = null, nd = kind === 'bullet' ? 0 : 1.6; for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < nd) { nd = d; nb = x; } }
  if (nb && --nb.hp <= 0) { crumble(nb, p, 'FRIENDLY FIRE!'); stats.friendly = (stats.friendly || 0) + 1; }
  for (const c of people) if (Math.hypot(c.position.x - p.x, c.position.z - p.z) < 1.2) c.userData.stun = played + 1.5; if (T.city.knock(p.x, p.z, 1, 0, 0)) T.freeKnocked(); }
// after the fire station goes, a ray sets things alight; a building that burns out comes down, and the fire spreads
function ignite(x) { x.burnT = 6 + Math.random() * 3; fx.ignite(V3(x.pos.x, Math.min(x.h, 2.5), x.pos.z), 0.9 + Math.min(1.2, x.h * 0.15), x.burnT + 2); }
const sinking = [];
function updateBurning(dt) { for (const x of buildings) { if (x.done || x.burnT == null) continue; x.burnT -= dt; if (x.burnT > 0) continue; crumble(x, null, 'BURNED');
    if (Math.random() < 0.6) { let nb = null, nd = 3.4; for (const y of buildings) { if (y.done || y.burnT != null) continue; const d = Math.hypot(y.pos.x - x.pos.x, y.pos.z - x.pos.z); if (d < nd) { nd = d; nb = y; } } if (nb) { ignite(nb); popup(nb.pos, 'FIRE SPREADS!', '#ff9a3a'); } } } }

// ---------- energy: the shield and the fuel, one bar ----------
function hurt(dmg, kind, at) { if (state !== 'play' || !ship.alive) return;
  if (nukeT > 0) { if (played - dmgPopT > 0.3) { dmgPopT = played; popup(ship.center, 'BLOCKED!', '#ffd24a'); } fx.sparks(at, 8, { c: [0xffffff, 0xffd24a], speed: 5, up: 2, life: 0.4 }); return; } // the nuclear shield: nothing gets through
  dmg *= RK.hurt; energy -= dmg; hits++; power = Math.max(0, power - dmg * SW.lose); swCheck(); /* (a hit costs health, and some power: enough hits drop your E level) */ stats.dmg = (stats.dmg || 0) + dmg; stats['d_' + kind] = (stats['d_' + kind] || 0) + dmg; /* (by who did it: for the balance robot) */ hitT = Math.min(0.35, hitT + 0.1 + dmg * 0.02); hurtK = Math.min(1, hurtK + 0.15 + dmg * 0.06); jolt(Math.min(0.55, 0.05 + dmg * 0.045));
  if (played - hurtSfx > 0.13) { hurtSfx = played; sfx.hurt(); } dmgPop += dmg; if (played - dmgPopT > 0.35 || dmg >= 4) { popup(ship.center.clone().setY(ship.y - 1), '-' + Math.max(1, Math.round(dmgPop)), '#ff6a5a'); dmgPop = 0; dmgPopT = played; } // small hits add up into one number
  if (energy <= 0) { energy = 0; finish('crash', kind === 'building' ? 'building' : undefined); } }

// ---------- big targets: a chip each in the top bar, a badge over each one in town, an arrow at the screen edge ----------
let mapBase = null, mapT = 0; const mapEl = $('taMap'), mapCtx = mapEl.getContext('2d'); const poiMarks = [];
function drawBadge(k) { const P = pois[k], x = P.badgeCtx; x.clearRect(0, 0, 128, 160); x.fillStyle = '#1a0f2e'; x.beginPath(); x.arc(64, 64, 55, 0, 6.2832); x.fill(); x.lineWidth = 10; x.strokeStyle = '#ff5ae0'; x.stroke(); x.font = '62px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(POI[k].icon, 64, 70);
  x.font = 'bold 30px sans-serif'; x.fillStyle = '#ffd24a'; x.fillText('●'.repeat(P.hp) + '○'.repeat(P.max - P.hp), 64, 143); P.badgeTex.needsUpdate = true; } // the dots under it: zaps still needed
function addPoiMarks() { for (const g of poiMarks) { scene.remove(g); disposeTree(g); } poiMarks.length = 0;
  for (const k of poiOrder) { const P = pois[k], g = new THREE.Group(), r = k === 'fair' ? 4.6 : 2.1; g.position.set(P.center.x, 0, P.center.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.32, 40), new THREE.MeshBasicMaterial({ color: 0xff5ae0, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; g.add(ring);
    const c = document.createElement('canvas'); c.width = 128; c.height = 160; P.badgeCtx = c.getContext('2d'); P.badgeTex = new THREE.CanvasTexture(c); P.badgeTex.colorSpace = THREE.SRGBColorSpace; drawBadge(k);
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.badgeTex, depthTest: false, transparent: true })); badge.renderOrder = 9; g.add(badge); g.userData = { ring, badge }; scene.add(g); P.mark = g; poiMarks.push(g); } }
function tickPoiMark(g) { const u = g.userData, view = cam.top - cam.bottom; u.badge.scale.set(view * 0.06, view * 0.075, 1); u.badge.position.y = 4.4 + view * 0.03 + Math.sin(played * 3.2) * 0.3; u.ring.material.opacity = (0.45 + Math.sin(played * 5) * 0.2) * (u.dim ? 0.3 : 1); u.badge.material.opacity = u.dim ? 0.4 : 1; } // (dim until your gun can take it)
function goToPoi(k) { const P = pois[k]; if (state !== 'play' || !P || P.done) return; banner('➤ ' + POI[k].icon + ' ' + POI[k].name); goTo(P.center.x, P.center.z); pend = null; P.arrow.classList.remove('ping'); void P.arrow.offsetWidth; P.arrow.classList.add('ping'); }
function setupPoiHud() {
  poiOrder = Object.keys(pois).sort((a, b) => POI[a].hp - POI[b].hp || POI[a].pts - POI[b].pts);
  $('taPois').style.setProperty('--n', poiOrder.length); /* the chips share one line: more targets, smaller chips */
  $('taPois').innerHTML = poiOrder.map((k) => '<span class="poiChip ready" id="poi_' + k + '"><em>' + POI[k].icon + '</em><b>E' + poiNeed(k) + '</b><i></i></span>').join('');
  for (const el of document.querySelectorAll('.poiArrow')) el.remove();
  for (const k of poiOrder) { const a = document.createElement('div'); a.className = 'poiArrow ready'; a.innerHTML = '<i>➤</i><em>' + POI[k].icon + '</em>'; document.body.appendChild(a); pois[k].arrow = a; pois[k].chip = $('poi_' + k); pois[k].chip.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); goToPoi(k); }); }
  addPoiMarks();
  const c = document.createElement('canvas'); c.width = T.cols * 4; c.height = T.rows * 4; const g = c.getContext('2d'); g.fillStyle = '#24403c'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#8fb0aa';
  for (let y = 0; y < T.rows; y++) for (let x = 0; x < T.cols; x++) if (!T.maze[y][x]) g.fillRect(x * 4, y * 4, 4, 4); mapBase = c; mapT = 0;
}
const poiGoal = () => Math.max(1, Math.ceil(poiOrder.length * 0.6)), poisDone = () => poiOrder.filter((k) => pois[k].done).length; // the big targets a town needs taken out
const poiNeed = (k) => Math.max(2, Math.min(5, POI[k].hp - 1)); // the E level of gun a big target takes: the tougher the target, the bigger the gun
function hitPoi(k, at) { const P = pois[k]; if (P.done) return; const need = poiNeed(k); if (shotLv + 1 < need && !P.nuked) { if (played - (P.noT || -9) > 1.2) { P.noT = played; popup(P.center.clone().setY(2.4), POI[k].icon + (swLv + 1 >= need ? ' E' + need + ' GUN RECHARGING' : ' NEEDS E' + need), '#ff9a8a'); sfx.ping(2); } fx.sparks(at, 6, { c: [0xffffff, 0xff9a8a], speed: 3, up: 2, life: 0.3 }); return; } P.hp--; fx.ignite(at.clone(), 0.7, 6); fx.explode(at.clone(), 0.5); jolt(0.2); sfx.crunch(true);
  if (P.chip) P.chip.querySelector('b').textContent = String(Math.max(0, P.hp)); if (P.hp > 0) { drawBadge(k); popup(P.center.clone().setY(2), POI[k].icon + ' ' + P.hp + ' MORE!', '#ffd24a'); return; }
  wreckPoi(k); }
// a big target goes up: its own special blast, its neighbours knocked flat, a speed boost and a big refill for the ship, and something happens in town
function wreckPoi(k) { addPower(EP.poi);
  const P = pois[k]; P.done = true; P.hp = 0; if (P.mark) { scene.remove(P.mark); disposeTree(P.mark); P.mark = null; } const g = new THREE.Group(); g.position.copy(P.center); scene.add(g);
  for (const hz of P.hz) { T.live(hz); for (const part of hz.parts || []) if (part.parent) g.attach(part); dropObstacle(hz.pos); }
  twisters.tear(g, P.center, new THREE.Box3().setFromObject(g).getSize(V3()), null, [], [], { collapse: true, now: true, from: V3(ship.x, 0, ship.z), power: 1.5 });
  award(POI[k].pts, P.center, POI[k].name); sfx.wave(); sfx.boom(); fx.explode(V3(P.center.x, 1, P.center.z), 2.2); flashT = 0.3; jolt(1); poiFx.play(k, P.center); stats.pois = (stats.pois || 0) + 1;
  addEnergy(35); boostT = Math.max(boostT, 7); popup(ship.center, '+35⚡ ENERGY! SPEED BOOST!', '#7dff3a'); sfx.power(); after(0.25, () => blast(P.center, k === 'fair' ? 4.4 : 3, { from: P.center }));
  { const chip = $('poi_' + k); if (chip) { chip.classList.remove('ready'); chip.classList.add('done', 'boom'); } if (P.arrow) P.arrow.style.display = 'none'; }
  const c = P.center;
  if (k === 'power') { banner("BLACKOUT! THE ARMY CAN'T SEE YOU"); blindT = 22; for (const [t, v] of [[0, 0.3], [0.16, 0.9], [0.34, 0.15], [0.55, 0.75], [0.8, 0.1], [1.05, 0.5]]) poiFx.after(t, () => lights(v)); poiFx.after(1.3, blackout); }
  else if (k === 'water') { banner('FLOOD! EVERYONE IS SWEPT OFF THEIR FEET'); for (const p of people) if (Math.hypot(p.position.x - c.x, p.position.z - c.z) < 11) p.userData.stun = played + 6; }
  else if (k === 'fair') { banner("THE FAIR'S OVER! EVERYONE OUT!"); spill(c, 14); }
  else if (k === 'cemetery') { banner('THE DEAD RISE! BEAM THEM UP!'); for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 3; addPerson(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, { kind: 'zombie' }); } }
  else if (k === 'weather') { radarDown = true; banner('RADAR DOWN! NO MORE AIRCRAFT'); } /* the helicopters fly off, and no more come (nor jets) */
  else if (k === 'radio') { banner('OFF THE AIR! NO REINFORCEMENTS'); radioDown = true; }
  else if (k === 'firestation') { banner('NO FIRE CREWS! YOUR RAY STARTS FIRES'); fireBoost = true; buildings.filter((x) => !x.done && x.burnT == null).map((x) => [Math.hypot(x.pos.x - c.x, x.pos.z - c.z), x]).filter((e) => e[0] < 9).sort((a, b) => a[0] - b[0]).slice(0, 5).forEach((e) => ignite(e[1])); }
  else if (k === 'police') { banner('JAILBREAK! GRAB THE CONVICTS!'); for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 3; addPerson(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, { kind: 'convict' }); } }
  else if (k === 'sewage') { banner('STINK BOMB! NOBODY CAN RUN'); stink = true; }
  else if (k === 'nuclear') { banner('☢️ MELTDOWN! NUCLEAR SHIELD!'); flashT = 1.2; after(0.25, () => sfx.boom()); goNuke(c); nukeT = 12; energy = E_MAX; }
}
// the nuclear plant: a mushroom cloud and a shock wave that flattens a wide ring of town (and the army in it); people are knocked flat
const NUKE_R = 20, blasts = [];
function goNuke(c, R0 = NUKE_R) { const at = V3(c.x, 0, c.z); let done = 0; if (R0 !== NUKE_R) { flashT = Math.max(flashT, 0.8); jolt(1); sfx.boom(); }
  blasts.push(nukeBlast(scene, at, R0, { kind: 'nuke', secs: 1.8, onRadius: (r) => { if (r - done < 1.2) return; done = r;
    for (const x of buildings) if (!x.done && Math.hypot(x.pos.x - at.x, x.pos.z - at.z) < r) crumble(x, at);
    army.hitArea(at, r); foes.hitAt(at, r); for (const p of people) if (Math.hypot(p.position.x - at.x, p.position.z - at.z) < r) p.userData.stun = played + 6;
    for (let i = drivers.length - 1; i >= 0; i--) { const q = drivers[i].g.position; if (Math.hypot(q.x - at.x, q.z - at.z) < r) { const d = drivers[i]; drivers.splice(i, 1); blowCar(d.g, q.clone()); } } } })); }
function lights(v) { for (const x of buildings) for (const m of x.b.userData.fade || []) if (m.emissiveIntensity != null) { if (m.userData.glow0 == null) m.userData.glow0 = m.emissiveIntensity; m.emissiveIntensity = m.userData.glow0 * v; } setBakedGlow(v); }
function blackout() { hemi.intensity *= 0.55; sun.intensity *= 0.6; for (const x of buildings) for (const m of x.b.userData.fade || []) if (m.emissiveIntensity != null) m.emissiveIntensity = 0.04; setBakedGlow(0.04);
  T.city.group.traverse((m) => { const mt = m.material; if (mt && !Array.isArray(mt) && mt.isMeshBasicMaterial && mt.color && mt.color.getHex() === 0xf6e94a) mt.color.setHex(0x22232a); }); }

// ---------- the minimap: the town, the crowds (green), the army (red), the big targets and the ship. Tap it to fly there ----------
const mapScale = (px) => (px / 2) / (Math.hypot(T.cols, T.rows) * CELL / 2);
function drawMini() {
  const dpr = Math.min(2, devicePixelRatio || 1), S = Math.round(mapEl.clientWidth * dpr) || 1; if (mapEl.width !== S) mapEl.width = mapEl.height = S;
  const g = mapCtx, k = mapScale(S), P2 = (x, z) => [S / 2 + k * (right.x * x + right.z * z), S / 2 - k * (upv.x * x + upv.z * z)];
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, 6.2832); g.clip();
  g.setTransform(k * right.x, -k * upv.x, k * right.z, -k * upv.z, S / 2, S / 2); if (mapBase) g.drawImage(mapBase, -T.cols * CELL / 2, -T.rows * CELL / 2, T.cols * CELL, T.rows * CELL);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#7dff3a'; const ds = 1.6 * dpr; for (const p of people) { const [x, y] = P2(p.position.x, p.position.z); g.fillRect(x - ds / 2, y - ds / 2, ds, ds); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const kk of poiOrder) { const P = pois[kk], [x, y] = P2(P.center.x, P.center.z); if (P.done) { g.font = 'bold ' + (13 * dpr) + 'px sans-serif'; g.fillStyle = '#7dff3a'; g.fillText('✓', x, y); } else { g.fillStyle = '#ff5ae066'; g.beginPath(); g.arc(x, y, 9 * dpr, 0, 6.2832); g.fill(); g.font = (13 * dpr) + 'px sans-serif'; g.fillText(POI[kk].icon, x, y); } }
  for (const r of army.runs) { const a = P2(r.c.x - r.dir.x * 30, r.c.z - r.dir.z * 30), e = P2(r.c.x + r.dir.x * 30, r.c.z + r.dir.z * 30); g.strokeStyle = '#ff3a2a'; g.lineWidth = 3 * dpr; g.setLineDash([4 * dpr, 3 * dpr]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(e[0], e[1]); g.stroke(); g.setLineDash([]); } // a jet's lane
  army.eachDot((p, kind) => { const [x, y] = P2(p.x, p.z); if (kind === 'gunship' || kind === 'jet') { g.fillStyle = kind === 'jet' ? '#ff5a4a' : '#9fe8ff'; g.font = 'bold ' + (11 * dpr) + 'px sans-serif'; g.fillText(kind === 'jet' ? '✈' : '🚁', x, y); } else { g.fillStyle = kind === 'launcher' ? '#ff9a3a' : '#ff4a3a'; const s = (kind === 'launcher' ? 3.6 : 3) * dpr; g.fillRect(x - s / 2, y - s / 2, s, s); } });
  foes.eachDot((p, icon, col) => { const [x, y] = P2(p.x, p.z); g.fillStyle = col; g.font = 'bold ' + (11 * dpr) + 'px sans-serif'; g.fillText(icon, x, y); }); /* the horn trucks */
  if (moveTo) { const [x, y] = P2(moveTo.x, moveTo.z); g.strokeStyle = '#7df0ff'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(x - 4 * dpr, y - 4 * dpr); g.lineTo(x + 4 * dpr, y + 4 * dpr); g.moveTo(x + 4 * dpr, y - 4 * dpr); g.lineTo(x - 4 * dpr, y + 4 * dpr); g.stroke(); }
  { const [x, y] = P2(ship.x, ship.z); g.fillStyle = '#c9a6ff'; g.strokeStyle = '#ffffff'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, Math.max(3.5 * dpr, PULL_R * k), 0, 6.2832); g.fill(); g.stroke(); }
  g.restore(); }
mapEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (state !== 'play') return; const r = mapEl.getBoundingClientRect(), k = mapScale(r.width); const a = (e.clientX - r.left - r.width / 2) / k, b = -(e.clientY - r.top - r.height / 2) / k;
  goTo(right.x * a + upv.x * b, right.z * a + upv.z * b); pend = null; mapT = 0; });

// first-time cards (coach.js), noted here so the balance robot can answer them (answerCard), and how long since the last one
// closed in game time (the round holds still while one is up, so this is the time the player has been playing since)
let curCard = null, cardUp = false, cardShutAt = -99;
const card = (key, o) => { if (!coach(key, o)) return false; curCard = { key, done: o.done }; cardUp = true; return true; };
const cardIdle = () => (coachBusy() ? 0 : played - cardShutAt);
function answerCard() { const c = curCard; curCard = null; if (c) markSeen('c_' + c.key); coachClear(); if (c && c.done) c.done(); }
const bldCard = () => coachBusy() && !!curCard && curCard.key === 'bu_bld'; /* the BIG BUILDINGS card is up: the building it points at stays lit red (fly, holdQuiet) */

// ---------- the army (army.js) ----------
// ---------- THE FUN PACK (fun.js). RK: this round's numbers (difficulty, a daily twist, or how deep an endless run is).
// BOSS: THE IRON MAMMOTH rolls in on the last town once all three goals are met: the town's clock stops and the boss clock
// runs. Stop it in time for the bonus and the star; if the clock runs out it pulls back and the town is cleared all the same ----------
let RK = { time: 1, foe: 1, hurt: 1, coins: 1, tag: '' }, boss = null, bossBeat = false; const BOSS = { time: 90, hp: 18, score: 25000, name: '👑 THE IRON MAMMOTH' };
function startBoss() { const t = army.addBoss(BOSS.hp); boss = { t, left: BOSS.time, dead: false }; banner('⚠️ BOSS: THE IRON MAMMOTH!\nTAP IT TO FIRE'); sfx.wave(); jolt(0.6); flashT = Math.max(flashT, 0.3); }
function bossDown(q) { if (!boss || boss.dead) return; boss.dead = true; boss.left = 3.2; bossBeat = true; score += BOSS.score; banner('💥 IRON MAMMOTH DESTROYED!\n+' + BOSS.score); jolt(1); flashT = Math.max(flashT, 0.5); }
function bossTick(dt) { const b = boss; b.left -= dt; if (b.left <= 0) { boss = null; bossBar(null); if (!b.dead) { popup(ship.center, 'THE IRON MAMMOTH PULLED BACK!', '#ff9a8a'); army.dropBoss(); } finish('win'); return true; } if (b.dead) bossBar(null); else bossBar(BOSS.name, b.t.hp / b.t.max, b.left); return false; }
const events = makeEvents([
  { can: () => army.tanks.length + army.soldiers.length > 2, run() { banner('☄️ METEOR SHOWER ON THE ARMY!'); sfx.wave(); meteorShower(scene, 6, () => { const l = [...army.tanks.map((t) => t.g.position), ...army.soldiers.map((o) => o.position)]; if (!l.length) return null; const q = l[(Math.random() * l.length) | 0]; return { x: q.x, z: q.z }; }, (x, z) => { if (state !== 'play') return; const at = V3(x, 0.5, z); fx.explode(at, 1.4); fx.scorch(V3(x, 0, z), 1.5); army.hitArea(at, 2.2, { quiet: true }); sfx.boom(); if (toScreen(at).on) jolt(0.3); }); } },
  { can: () => ship.alive, run() { addEnergy(35); boostT = Math.max(boostT, 7); banner('⚡ POWER SURGE!\n+HEALTH AND A SPEED BOOST'); popup(ship.center, '+35 ❤️', '#7dff3a'); sfx.power(); } },
  { can: () => blindT <= 0, run() { blindT = 14; banner("🌑 BLACKOUT! THE ARMY CAN'T SEE YOU"); sfx.wave(); } },
]);
const army = createArmy({ foeK: () => RK.foe, bossDown: (q) => bossDown(q), gunPow: () => 1 + (shotLv || 0) * 0.5, scene, fx, twisters, toScreen, edgeArrow, popup, banner, award, jolt, coach: card, coachSeen, inView: (...a) => inView(...a), flash: (v) => { flashT = Math.max(flashT, v); },
  hurt: (d, k, p) => hurt(d, k, p), groundHit: (p, k) => groundHit(p, k), blast: (c, r, o) => blast(c, r, o), collide: (c) => collidePerson(c), status, after, free: (o) => { if (T) T.free(o); },
  stat: (k) => { stats[k] = (stats[k] || 0) + 1; }, poiCenters: () => poiOrder.filter((k) => !pois[k].done).map((k) => pois[k].center),
  get ship() { return shipState; }, get town() { return T; }, get level() { return level; }, get played() { return played; }, get blind() { return blindT; }, get radarDown() { return radarDown; }, get radioDown() { return radioDown; } });

// ---------- the horn trucks (Downtown on): Tornado Time!'s storm cannons (foes.js) turned on the saucer. Each charges, then
// blasts along its orange line: a hit drains the shield and throws the saucer back. Zap it twice, or once while it charges,
// and it goes up with a shock wave that flattens what stands round it. foes.js's rogue twister, UFO and gunships are left
// out (the helicopters are army.js's), and its words become this game's: a HORN TRUCK
const hornWords = (t) => (t ? String(t).replace('STORM CANNON', 'HORN TRUCK').replace(/CANNON/g, 'HORN TRUCK').replace(' -SIZE', '').replace('HIT IT AGAIN', 'ZAP IT AGAIN') : t);
// a horn truck as the death ray sees it (a tap, F): ok while it is still there (a waiting shot never strikes a wreck); stay: it is zapped where it is
const hornTgt = (f, px) => ({ kind: 'horn', pos: f.pos.clone().setY(0.9), px, hit: f.zap, ok: () => foes.state.cannons.some((c) => c.g.position === f.pos), stay: true });
const kickP = V3(), kickObj = { position: kickP }; // the saucer as foes.js sees it: a blast's kick moves this, and the saucer follows
const foes = createFoes({ skip: ['rival', 'ship', 'ufo'], flying: true, scene, fx, twisters, S0: 1, MAX_S: 1, maxH: () => 0, rankOf: () => 0, rivalWreck() {}, absorbed() {},
  speedBurst: (s) => { boostT = Math.max(boostT, s); }, popup: (p, t, c) => popup(p, hornWords(t), c), banner: (t) => banner(hornWords(t)), award: (pts, p, label) => { if (/CANNON|OVERLOAD/.test(label || '')) stats.horns = (stats.horns || 0) + 1; return award(pts, p, hornWords(label)); },
  jolt: (v) => jolt(v), edgeArrow: (...a) => edgeArrow(...a), toScreen: (...a) => toScreen(...a), coach: card, coachSeen, flash: (v) => { flashT = Math.max(flashT, v); },
  grow: (v) => { if (v < 0) hornHit(); }, crashDamage: (p, r) => blast(V3(p.x, 0, p.z), r, { from: p }), boltTo: (at) => fx.sparks(at, 10, { c: [0xffffff, 0xff5ae0], speed: 6, up: 3, life: 0.4 }),
  get twObj() { return kickObj; }, get size() { return 1; }, get level() { return level; }, get played() { return played; }, get cols() { return T ? T.cols : 21; }, get massTarget() { return 100; },
  get buildings() { return buildings; }, get people() { return people; }, get roadCells() { return T ? T.roads : []; }, get pois() { return pois; }, get poiOrder() { return poiOrder; }, radarDown: false });
// a blast reaches the saucer: the shield takes it and flashes, and the saucer is thrown back (foes.js's kick). Thrown into a big
// building it bounces off without crashing (bumpT)
function hornHit() { if (state !== 'play' || !ship.alive) return; hurt(HORN.dmg, 'horn', ship.center); bumpT = Math.max(bumpT, 1); moveTo = null; pend = null; fx.shock(ship.center.clone().setY(ship.y - 0.3), 4.5, 0xffc060, 0.5); fx.sparks(ship.center, 16, { c: [0xffffff, 0xffb030], speed: 7, up: 2, life: 0.5 }); }
// each frame: foes.js moves the trucks and their blasts; the saucer takes any kick; the horns tilt up at the saucer and their
// rings of sound climb toward its height as they go (foes.js sends them along the street, for a storm)
function updateHorns(dt) { kickP.set(ship.x, ship.y, ship.z); foes.update(dt, ship.x, ship.z, HORN.r); if (kickP.x !== ship.x || kickP.z !== ship.z) { ship.x = kickP.x; ship.z = kickP.z; ship.center.set(ship.x, ship.y, ship.z); }
  const st = foes.state; for (const w of st.waves) w.g.position.y = Math.min(ship.y - 0.4, 1.2 + w.far * 0.35);
  for (const c of st.cannons) { const h = c.g.userData.horn; if (h.rotation.order !== 'YXZ') h.rotation.order = 'YXZ'; h.rotation.x = -0.35; } }

// ---------- first-time coaching: one new thing at a time. The round holds still while a card and an arrow show it (see
// coach.js); it carries on when the player does it, and each one only ever shows once on this device ----------
const peopleNear = (r) => people.find((p) => Math.hypot(p.position.x - ship.x, p.position.z - ship.z) < r && toScreen(p.position).on);
// on screen and clear of the HUD (the top bar, the buttons, the mini map, BEAM): somewhere a first-time card can point at
const inView = (p, y = 0) => { const s = toScreen(p, y); if (!s.on || s.y < hudH + 24) return false; for (const b of hudBoxes) if (s.x > b[0] - 34 && s.x < b[2] + 34 && s.y > b[1] - 34 && s.y < b[3] + 34) return false; return true; };
const nearestPerson = (r) => { let best = null, bd = r; for (const p of people) { const d = Math.hypot(p.position.x - ship.x, p.position.z - ship.z); if (d < bd && toScreen(p.position).on) { bd = d; best = p; } } return best; };
// teaching the beam: while people are under the saucer and the beam is off, a ring round the saucer says HOLD (until the beam has
// been switched on there a few times)
const holdEl = $('buHold'); let holdN = 0, holdOn = false;
const peopleUnder = () => people.some((p) => Math.abs(p.position.x - ship.x) < GRAB_R + 0.6 && Math.hypot(p.position.x - ship.x, p.position.z - ship.z) < GRAB_R + 0.6);
function holdHint() { const want = false && state === 'play' && ship.alive && !beamOn && holdN < 6 && bumpT <= 0 && peopleUnder(); /* (not just after a crash or a blast: its words would crowd the popups there) */ if (want !== holdOn) { if (holdOn && beamOn) holdN++; holdOn = want; holdEl.style.display = want ? 'block' : 'none'; } if (!want) return;
  const s = toScreen(ship.center, ship.y), d = Math.round(shipPx() * 1.5); holdEl.style.width = holdEl.style.height = d + 'px'; holdEl.style.transform = 'translate(' + Math.round(s.x) + 'px,' + Math.round(s.y) + 'px) translate(-50%,-50%)'; }
// The cards about the army and the dangers say how to beat them and wait for a tap (mode 'ok': that tap never reaches the game)
function coachBU() {
  if (coachBusy()) return;
  if (!coachSeen('bu_move')) { if (played > 0.5) card('bu_move', { mode: 'drag', title: '🛸 FLY', text: 'Drag anywhere on the screen to fly your saucer. Or tap a spot: it flies there.' }); return; }
  if (!coachSeen('bu_bld') && bumpT <= 0 && cardIdle() > 0.5) { const b = bldAhead(1.4); if (b) { setWarn(b); card('bu_bld', { mode: 'ok', title: '🏢 BIG BUILDINGS ARE SOLID', text: 'Fly into one and it comes down, but it costs you a lot of energy. Watch for the red glow and BUILDING!, and fly round. Houses and small shops pass under you.', at: () => toScreen(b.pos, b.h * 0.6), done: () => { warnT = -9; } }); return; } } /* danger first, whatever else is still to learn (once it closes, BUILDING! pops up again when the real warning comes) */
  if (!coachSeen('bu_beam')) { if (abd > 0) { markSeen('c_bu_beam'); return; } /* already beaming people up: nothing to teach */ const c = cardIdle() > 1 && !beamOn && nearestPerson(10); /* (not while the beam is already on) */ if (c && card('bu_beam', { mode: 'ok', title: '🔦 BEAM THEM UP', text: WALK() ? 'Two beams: stand over people or cars for three seconds and the beam underneath takes them; anything in your searchlight for three seconds is beamed up too.' : 'Hover over people or cars for three seconds and the beam comes down by itself. Everyone you beam up refills your health.', at: () => toScreen(ship.center, ship.y), done: () => { beamCoach = false; const n = nearestPerson(10) || c; goTo(n.position.x, n.position.z); } })) beamCoach = true; return; } /* once it is pressed the saucer glides over the nearest crowd, so the first try works */
  if (army.coachTick()) return;
  if (!coachSeen('bu_horn')) { const cn = foes.state.cannons.find((o) => inView(o.g.position, 0.8)); if (cn) { card('bu_horn', { mode: 'ok', title: '📢 HORN TRUCK', text: 'It charges, then blasts along its orange line: that drains your shield and throws you back. Get your shadow off the line! Tap the truck to zap it: twice, or once while it charges.', at: () => (foes.state.cannons.includes(cn) ? toScreen(cn.g.position, 0.8) : null) }); return; } }
  if (!coachSeen('bu_energy') && hits > 2 && cardIdle() > 2) { card('bu_energy', { mode: 'ok', title: '⚡ YOUR E LEVEL', text: 'The green bar is your health: army hits and crashes drain it, beaming people up refills it, and at zero you go down. Hits also drain some of your E power, so too many can drop your E level.', at: () => elMid($('buEnergy')) }); return; }
  if (!coachSeen('bu_low') && energy < 30 && cardIdle() > 1.5) { card('bu_low', { mode: 'ok', title: '⚠ SHIELD LOW!', text: 'Find a crowd, then press and hold on your saucer to BEAM! Grab people one after another for a BEAM CHAIN: it fills your shield faster.', at: () => toScreen(ship.center, ship.y) }); return; }
  if (cardIdle() < 6 || (abd < 2 && played < 30)) return; /* the rest wait until the beam has been used, and come a few seconds apart */
  if (!coachSeen('bu_ray')) { const t = army.tanks.find((o) => inView(o.g.position, 0.4)) || army.soldiers.find((o) => inView(o.position, 0.4) && Math.hypot(o.position.x - ship.x, o.position.z - ship.z) < 12); if (t) { const p = (t.g || t).position; if (card('bu_ray', { mode: 'ok', title: '⚡ TAP TO ZAP', text: 'Tap a tank, a soldier or a building: your saucer flies there and the death ray zaps it. It costs no energy.', at: () => toScreen(p, 0.4) })) return; } }
  if (!coachSeen('bu_wreck')) { let best = null, bd = 1e9; for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - ship.x, x.pos.z - ship.z); if (d > 2.5 && d < bd && inView(x.pos, Math.min(1.2, x.h * 0.5))) { bd = d; best = x; } }
    if (best) card('bu_wreck', { mode: 'ok', title: '🏚️ WRECK THE TOWN', text: 'Your ray zaps the buildings you fly over by itself, and any you tap. People run out of them: beam them up! Tall ones take two or three zaps.', at: () => toScreen(best.pos, Math.min(1.2, best.h * 0.5)) }); return; }
  if (!coachSeen('bu_goal')) { if (cardIdle() > 8) card('bu_goal', { mode: 'ok', title: '🎯 YOUR MISSION', text: 'Beam up ' + L().abduct + ' people and wreck ' + L().goal + '% of ' + L().name + ' before the time runs out.', at: () => elMid($('buCount')) }); return; }
  if (!coachSeen('bu_target')) { const k = poiOrder.find((q) => !pois[q].done && inView(pois[q].center, 1)); if (k) card('bu_target', { mode: 'ok', title: POI[k].icon + ' BIG TARGET', text: 'Tap it to zap it ' + pois[k].hp + ' times. It blows up in its own way, and your saucer gets a SPEED BOOST and a big ENERGY refill.', at: () => toScreen(pois[k].center, 1) }); }
}

// ---------- input (as in Tornado Time!): drag anywhere for a stick (touch on the canvas, mouse); tap to fly there and zap
// what is there; press and hold on the saucer itself to beam (or hold BEAM, or SPACE) ----------
const stick = { id: null, cx: 0, cy: 0, x: 0, y: 0, moved: 0, aim: null, card: false }; const stickEl = $('taStick'), knobEl = $('taKnob'); const keys = {};
// a press that starts on the saucer itself (its body on screen, with a generous margin round it) is the tractor beam: on for as
// long as it is held. Slide it SLIDE_PX off and it steers as well, like any drag (the stick centred where it began), with the beam
// still on; a steering finger that comes onto the saucer turns the beam on too. Lifting the finger ends both
const SLIDE_PX = 22; let beamPress = null, mouseShip = null; /* beamPress: the press holding the beam on ('t' + a touch's id, or 'm' for the mouse) */
const shipPx = () => Math.max(64, 2.05 * SHIP_SCALE * innerHeight / (cam.top - cam.bottom) + 26);
function onShip(x, y) { return false; /* (no holding on the saucer to beam: the beam comes down by itself) */ if (state !== 'play' || !ship.alive || !ship.g || !ship.g.visible) return false; const s = toScreen(ship.center, ship.y); return Math.hypot(s.x - x, s.y - y) < shipPx(); }
const closing = () => coachBusy() || coachIdle() < 0.25; /* a press that closes a first-time card: it never taps (no zap, no flying off) */
function sDown(id, x, y) { if (stick.id !== null || state !== 'play') return; stick.id = id; stick.cx = x; stick.cy = y; stick.x = stick.y = 0; stick.moved = 0; stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.style.display = 'none'; knobEl.style.transform = 'translate(-50%,-50%)'; }
function sMove(id, x, y) { if (id !== stick.id) return; const dx = x - stick.cx, dy = y - stick.cy, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 55); stick.moved = Math.max(stick.moved, d); if (stick.moved < 10) return; stickEl.style.display = 'block'; moveTo = null; stick.x = dx / d * m / 55; stick.y = dy / d * m / 55; knobEl.style.transform = 'translate(calc(-50% + ' + stick.x * 36 + 'px), calc(-50% + ' + stick.y * 36 + 'px))'; }
function sUp(id) { if (id !== stick.id) return; stick.id = null; stick.x = stick.y = 0; stickEl.style.display = 'none'; } /* a tap is worked out by whoever calls this (touch or mouse) */
const ZOOM_MIN = 0.6, ZOOM_MAX = 1.6; let zoom = 1; try { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +localStorage.getItem('bu_zoom') || 1)); } catch { /* ignore */ }
function setZoom(z) { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); try { localStorage.setItem('bu_zoom', String(zoom)); } catch { /* ignore */ } }
// touches on the town: one that starts on the saucer beams (above). Of the others, the first one to slide steers (the stick).
// One that lifts without sliding is a tap (fly there and zap what is there), however long it was held, even while another
// finger steers or beams. Two that land together and both move are a pinch (zoom). A thumb held on BEAM is never one of
// these: only touches that land on the town are
const touchOn = new Map(); let pinch = null; const pinchD = () => { const [a, b] = [...touchOn.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
canvas.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) { const id = 't' + t.identifier, o = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, moved: 0, pz: false, aim: null, ship: false, card: closing() };
    if (beamPress === null && onShip(t.clientX, t.clientY)) { o.ship = true; beamPress = id; unlockAudio(); } else { o.aim = state === 'play' ? pickAt(t.clientX, t.clientY) : null; if (stick.id === null) sDown(id, t.clientX, t.clientY); }
    touchOn.set(t.identifier, o); }
  pinch = touchOn.size === 2 && ![...touchOn.values()].some((q) => q.ship) && !(stick.id !== null && stick.moved >= 10) ? { d: pinchD(), on: false } : null; }, { passive: true }); /* a second finger while the first is already steering (or beaming) is a tap, never a pinch */
canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) { const o = touchOn.get(t.identifier); if (o) { o.x = t.clientX; o.y = t.clientY; o.moved = Math.max(o.moved, Math.hypot(o.x - o.x0, o.y - o.y0)); } }
  if (pinch && touchOn.size === 2) { const all = [...touchOn.values()], d = pinchD();
    if (!pinch.on) { if (stick.id !== null && stick.moved >= 10) pinch = null; else if (all.every((q) => q.moved >= 8)) { pinch.on = true; pinch.d = d; for (const q of all) q.pz = true; sUp(stick.id); } } /* both fingers moving: a pinch */
    if (pinch && pinch.on) { if (d > 0 && pinch.d > 0) setZoom(zoom * pinch.d / d); pinch.d = d; if (e.cancelable) e.preventDefault(); return; } }
  for (const t of e.changedTouches) { const o = touchOn.get(t.identifier), id = 't' + t.identifier; if (!o || o.pz) continue;
    if (o.ship) { if (o.moved < SLIDE_PX) continue; o.ship = false; if (stick.id === null || stick.moved < 10) { sUp(stick.id); sDown(id, o.x0, o.y0); } sMove(id, t.clientX, t.clientY); continue; } /* slid off the saucer: it steers, and the beam stays on until the finger lifts */
    if (o.moved >= 10 && stick.id !== id && (stick.id === null || stick.moved < 10)) { sUp(stick.id); sDown(id, t.clientX, t.clientY); } sMove(id, t.clientX, t.clientY); if (beamPress === null && stick.id === id && state === 'play' && onShip(t.clientX, t.clientY)) { beamPress = id; unlockAudio(); } } /* the finger that slides steers; steer it onto the saucer and the beam comes on too, until it lifts */
  if (state === 'play' && e.cancelable) e.preventDefault(); }, { passive: false });
addEventListener('wheel', (e) => { if (e.target !== canvas || state !== 'play') return; e.preventDefault(); setZoom(zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
for (const [id, k] of [['taZoomIn', 0.85], ['taZoomOut', 1.18]]) $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); setZoom(zoom * k); });
const tUp = (e) => { for (const t of e.changedTouches) { const o = touchOn.get(t.identifier), id = 't' + t.identifier; touchOn.delete(t.identifier); if (beamPress === id) beamPress = null; sUp(id); if (o && (!o.ship || flyCard()) && !o.pz && o.moved < 10 && e.type === 'touchend') tapUp(o.x0, o.y0, o.aim, o.card); } if (touchOn.size < 2) pinch = null; };
addEventListener('touchend', tUp); addEventListener('touchcancel', tUp);
// the mouse: the left button held on the saucer beams (drag it off to steer); a click elsewhere flies there and zaps; a drag steers.
// The canvas keeps hold of the pointer (capture), so the release always comes back here: a first-time card that opens mid-drag
// (it covers the screen) never swallows it and leaves the stick or the beam stuck on
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  if (e.button === 0 && beamPress === null && onShip(e.clientX, e.clientY)) { mouseShip = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; beamPress = 'm'; unlockAudio(); return; }
  sDown(e.pointerId, e.clientX, e.clientY); if (stick.id === e.pointerId) { stick.aim = pickAt(e.clientX, e.clientY); stick.card = closing(); } });
addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; const m = mouseShip; if (m && e.pointerId === m.id) { if (Math.hypot(e.clientX - m.x0, e.clientY - m.y0) < SLIDE_PX) return; mouseShip = null; sDown(e.pointerId, m.x0, m.y0); } sMove(e.pointerId, e.clientX, e.clientY); });
const mUp = (e, cancel) => { if (e.pointerType === 'touch') return; if (beamPress === 'm') beamPress = null; const m = mouseShip; if (m && e.pointerId === m.id) { mouseShip = null; if (beamPress === 'm') beamPress = null; if (!cancel && flyCard()) tapUp(m.x0, m.y0, null, true); return; }
  if (e.pointerId !== stick.id) return; const tap = !cancel && stick.moved < 10; sUp(e.pointerId); if (tap) tapUp(stick.cx, stick.cy, stick.aim, stick.card); }; /* a click that did not drag: fly there and zap what is there */
addEventListener('pointerup', (e) => mUp(e, false)); addEventListener('pointercancel', (e) => mUp(e, true));
// while the BEAM card is up, only a press on the saucer, BEAM (or SPACE) carries on: other presses are swallowed, so the player
// learns it (P2). The pause button and Esc/P still pause. These run before coach.js's own listeners (they are added first), so the
// card never sees them
let beamCoach = false; const beamCard = () => false; /* (the BEAM card used to wait for a press on the saucer; the beam is automatic now, so it closes with a tap like any card) */
addEventListener('pointerdown', (e) => { if (!beamCard()) return; const t = e.target && e.target.closest ? e.target : null; if (t && t.closest('#buBeam')) return; if (e.target === canvas && onShip(e.clientX, e.clientY)) return; e.stopImmediatePropagation(); if (!(t && t.closest('#taPause'))) e.preventDefault(); }, true);
addEventListener('keydown', (e) => { if (!beamCard() || e.key === ' ') return; e.stopImmediatePropagation(); if ((e.key === 'Escape' || e.key === 'p') && !e.repeat) togglePause(); }, true);
// BEAM: held down with a thumb (it keeps hold of that finger even if it slides off the button), or SPACE on a computer
{ const b = $('buBeam'), on = (e) => { e.preventDefault(); e.stopPropagation(); if (state !== 'play') return; beamHeld = true; try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ } unlockAudio(); }, off = () => { beamHeld = false; };
  b.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, off); b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false }); }
addEventListener('keydown', (e) => { if (e.key === ' ') e.preventDefault(); keys[e.key.toLowerCase()] = true; if (e.key === 'Escape' || e.key === 'p') togglePause(); else if ((e.key === 'f' || e.key === 'F') && !e.repeat) zapKey(); else if (e.key === '+' || e.key === '=') setZoom(zoom * 0.85); else if (e.key === '-' || e.key === '_') setZoom(zoom * 1.18); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { beamHeld = false; beamPress = mouseShip = null; sUp(stick.id); touchOn.clear(); pinch = null; for (const k in keys) keys[k] = false; }); // a lost window never leaves the beam or the stick stuck on

// ---------- flow ----------
let state = 'start', roundId = 0, outro = null; // roundId: delayed effects from an earlier round check it and stand down
const pct = () => Math.round((bDone / totalB) * 100);
soundToggle($('taStart'), $('taPaused')); playerButton($('taPaused'), $('taPaused').querySelector('.menuBtn')); tipsSetup('bu', $('taPaused'), $('taPaused').querySelector('.menuBtn')); diffPicker($('taLevels'), 'bu'); skipSongBtn($('ta')); eraPicker($('taLevels'), () => { level = unlocked(); drawLevels(); }); seasonPicker($('eraRow'));
gameMusic($('taPaused'), SONGS_ALL); radioButton($('taPaused'), $('taPaused').querySelector('.menuBtn'));
const fsMode = initFullscreen(() => state === 'play' || state === 'outro'); // full screen on play, back in after a browser drop-out, no page scrolling mid-round (the outro is still the round)
const hudCache = {}; const setT = (id, v) => { v = String(v); if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
const setC = (id, cls, on) => { const k = id + '.' + cls; if (hudCache[k] !== on) { hudCache[k] = on; $(id).classList.toggle(cls, on); } };
function start() { if (MODE === 'endless') level = endlessLevel(LEVELS.length); RK = roundK('bu'); boss = null; bossBeat = false; bossBar(null); comboHud(1, 0); clearMeteors(); events.reset(); firstSong('bu', 'music/beam-beam-baby.mp3'); /* (the first round ever opens on Beam Beam Baby) */
  fsMode.play(); coachClear(); if (!noSave) saveLast('bu', level); crowd.clear(); unlockAudio(); roundId++; timers.length = 0; sk.clear(); /* (last round's baby twisters, freed while the twisters module still has them) */
  buildWorld(); makePlayerShip(); setupPoiHud();
  score = 0; chain = 0; lastHit = -9; tLeft = Math.round(L().time * RK.time); played = 0; abd = 0; stats = {}; sw = swLv = swNext = 0; power = SW.start * SW.at[0] * L().abduct; swN = [0, 0]; nukeCd[0] = nukeCd[1] = 0; drawSw(); swCheck(); energy = E_MAX; /* (the E badge and bar start from this round's level, not the last one's) */ boostT = nukeT = hitT = hurtK = 0; hits = 0; lowWarned = false; rayCd = 0; moveTo = null; lastGrab = -9; grabChain = 0; dmgPop = 0; dmgPopT = hurtSfx = lowAt = -9; outro = null; beamCoach = false;
  blindT = 0; radarDown = radioDown = fireBoost = stink = false; beamHeld = false; hoverT = autoBeamT = 0; beamPress = mouseShip = botDrag = null; bumpT = autoT = 0; pend = null; warnT = -9; setWarn(null); curCard = null; cardUp = false; cardShutAt = -99; holdN = 0;
  army.spawnTown();
  for (const s of ['taStart', 'taEnd', 'taPaused', 'taPrize']) $(s).classList.add('hidden'); $('ta').classList.remove('hidden');
  state = 'play'; playSongs(); sfx.whoosh(); banner('LEVEL ' + level + ': ' + L().name.toUpperCase());
  after(2.4, () => banner('BEAM UP ' + L().abduct + ' PEOPLE\nWRECK ' + L().goal + '% OF TOWN\nTAKE OUT ' + poiGoal() + ' BIG TARGETS'));
  renderer.compile(scene, cam); // compile every material in the new town now, not mid-play
  $('taLevel').textContent = 'L' + level + ' · ' + L().name + (RK.tag ? ' · ' + RK.tag : ''); for (const k in hudCache) delete hudCache[k]; measureHud(); camTarget.set(0, flyY() * 0.5, 0);
}
function togglePause() { if (state === 'play') { state = 'paused'; beamHeld = false; beamPress = mouseShip = null; setPlaneEngine(0); setWind(0); stopMusic(); $('taPaused').classList.remove('hidden'); } else if (state === 'paused') { state = 'play'; $('taPaused').classList.add('hidden'); playSongs(); } }
// the round is over. kind: 'win' (both goals met), 'crash' (no energy left), 'time' (the clock ran out)
let timeBonus = 0;
function finish(kind, why) { if (state !== 'play') return; state = 'outro'; outro = { kind, why, t: 0 }; bossBar(null); comboHud(1, 0); beamHeld = false; beamPress = mouseShip = null; sUp(stick.id); clearTips(); moveTo = null; pend = null; setWarn(null); wayMark.visible = false; holdOn = false; holdEl.style.display = 'none'; foes.clear(); setPlaneEngine(0); setWind(0);
  for (const k of poiOrder) if (pois[k].arrow) pois[k].arrow.style.display = 'none';
  if (kind === 'win') { timeBonus = Math.round(tLeft) * 60; score += timeBonus; banner('🛸 MISSION COMPLETE!'); if (timeBonus) popup(ship.center, '+' + timeBonus + ' TIME BONUS', '#ffd24a'); sfx.power(); after(0.4, () => sfx.wave()); }
  else if (kind === 'crash') { ship.alive = false; WALK() || sk.crash(ship.center.clone()); banner(why === 'fuel' ? '⚡ OUT OF POWER!' : why === 'building' ? '💥 CRASHED!' : '💥 SHIP DOWN!'); sfx.over(); const d = Math.hypot(ship.vel.x, ship.vel.z) > 0.5 ? Math.atan2(ship.vel.x, ship.vel.z) : Math.random() * 6.28; ship.fall = { t: 0, vy: 0, head: d, sp: Math.max(3, Math.hypot(ship.vel.x, ship.vel.z)), sm: 0 };
    fx.sparks(ship.center, 30, { c: [0xffffff, 0x7dff3a], speed: 9, up: 3, life: 0.6 }); fx.explode(ship.center.clone(), 0.9); jolt(0.7); flashT = 0.25; ship.body.userData.shield.visible = false; } // the shield bursts, and down it goes
  else { banner("⏰ TIME'S UP!"); sfx.over(); } }
function outroTick(dt) { const o = outro; o.t += dt; runTimers(dt); army.update(dt); updateLifted(dt); const g = ship.g; reticle.visible = false; setT('taScore', score); beam.update(dt, Math.max(0.5, ship.y - 0.34), GRAB_R, false); for (let i = blasts.length - 1; i >= 0; i--) if (!blasts[i].update(dt)) blasts.splice(i, 1);
  if (o.kind === 'crash') { (WALK() || sk.tick(dt, ship)); const f = ship.fall; if (f && !f.down) { f.t += dt; f.vy += 9 * dt; ship.x += Math.sin(f.head) * f.sp * dt; ship.z += Math.cos(f.head) * f.sp * dt; ship.y -= f.vy * dt; g.position.set(ship.x, ship.y, ship.z); g.rotation.set(Math.sin(f.t * 9) * 0.6, g.rotation.y + dt * 9, Math.cos(f.t * 7) * 0.6);
      f.sm -= dt; if (f.sm <= 0) { f.sm = 0.03; fx.puff('flame', g.position, 0.9); fx.puff('smoke', g.position, 1.1); if (Math.random() < 0.4) fx.sparks(g.position, 3, { speed: 3, up: 1, life: 0.5 }); }
      if (ship.y <= 0.6) { f.down = true; const at = V3(ship.x, 0, ship.z); fx.explode(at.clone().setY(0.8), 2.6); fx.scorch(at, 2.6, 30); fx.shock(at, 7, 0x7dff3a, 0.6); jolt(1); flashT = 0.4; sfx.boom(); after(0.2, () => sfx.boom());
        const u = ship.body.userData; for (const m of u.strip || []) if (m.parent) m.parent.remove(m); twisters.tear(ship.body, at, V3(3.4, 0.9, 3.4), null, [], [], { collapse: true, now: true, power: 1.4 }); blast(at, 2.4, { from: at }); } }
    if (o.t >= 3.4) finishNow(); return; }
  // won, or out of time: the saucer spins up, climbs, and is gone in a flash
  const k = Math.min(1, o.t / 2.2); ship.y += (1.5 + o.t * o.t * 9) * dt; ship.spin += dt * (2 + o.t * 14); g.position.set(ship.x, ship.y, ship.z); g.rotation.set(0, ship.spin, 0); ship.body.userData.ring.material.map.offset.x += dt * 4; if (!o.gone) (WALK() || sk.tick(dt, ship, true));
  if (o.t > 1.6 && !o.gone) { o.gone = true; sk.clear(); /* (its followers go with it) */ flashT = 0.35; sfx.whoosh(); fx.flash(ship.center, 3, 0xd8ffe8); g.visible = false; }
  if (k >= 1 && o.t >= 2.6) finishNow(); }
function finishNow() {
  state = 'over'; stopMusic(); setPlaneEngine(0); setWind(0); clearTips(); army.clear(); /* its arrows and tags go too */ for (const o of pops) { o.t = 0; o.el.style.display = 'none'; } crowdLists[0][0] = people; crowdLists[1][0] = army.soldiers; crowd.sync(crowdLists, ship.x, ship.z, 4); const done = poiOrder.filter((k) => pois[k].done), kind = outro ? outro.kind : 'time', cleared = kind === 'win', p = pct(), lv = level, fuelOut = kind === 'crash' && outro.why === 'fuel' && (stats.dmg || 0) < 30;
  if (endlessEnd(cleared, score, () => start())) return; /* an endless run goes straight on to the next town */
  let best = 0; const bk = bestKey('bu', level); try { best = +localStorage.getItem(bk) || 0; if (score > best) { best = score; if (!noSave) localStorage.setItem(bk, String(score)); } } catch { /* ignore */ }
  const scoreCoins = Math.floor(score * RK.coins / 10000) / 100; if (scoreCoins > 0 && !noSave) addCoins(scoreCoins); // one coin per million points (MAYHEM pays half as much again)
  const gotSkins = cleared && level >= LEVELS.length && !noSave ? unlockCraftBonus('ufo') : []; // beating The Sprawl (the last town) wins the Acid Saucer
  if (cleared && !noSave) markWon('bu', level);
  if (cleared && level < LEVELS.length && unlocked() <= level) { if (noSave) memOpen = level + 1; else try { localStorage.setItem(levelKey('bu'), String(level + 1)); } catch { /* ignore */ } }
  const rammed = kind === 'crash' && outro.why === 'building';
  $('taEndTitle').innerHTML = cleared ? (level >= 5 ? L().name.toUpperCase().replace('THE ', '') + '<br>ABDUCTED!' : 'LEVEL ' + level + '<br>CLEARED') : kind === 'crash' ? (fuelOut ? 'OUT OF<br>ENERGY' : rammed ? 'CRASHED!' : 'SHOT<br>DOWN!') : "TIME'S<br>UP";
  $('taAgain').textContent = cleared && level < LEVELS.length ? 'NEXT LEVEL' : cleared ? 'PLAY AGAIN' : 'TRY AGAIN';
  $('taGoalLine').textContent = cleared ? (level < LEVELS.length ? 'Level ' + (level + 1) + ' unlocked: ' + LEVELS[level].name + '.' : 'Every town beamed up. The whole planet is yours.')
    : kind === 'crash' ? (fuelOut ? 'Your energy ran out. Flying uses it up: beam people up to keep flying' : rammed ? 'You flew into a big building. Watch for the red glow and BUILDING!, and fly round them' : 'Your shield ran out. Keep moving so the shots miss, and beam people up to fill it') + ' (' + abd + ' of ' + L().abduct + ' people, ' + p + '% of the town destroyed, goal ' + L().goal + '%).'
    : 'Beam up ' + L().abduct + ' people and wreck ' + L().goal + '% of ' + L().name + ' to clear it (you got ' + abd + ' and ' + p + '%).';
  { const host = $('taGoalLine'), last = lv >= LEVELS.length; if (!noSave) awardStars('bu', lv, [['Clear the town', cleared], ['Finish with half your health', cleared && energy >= E_MAX * 0.5], last ? ['Destroy the Iron Mammoth in time', cleared && bossBeat] : ['Wreck every big target', cleared && done.length >= poiOrder.length]], host); if (cleared) dailyWon(host); endlessLine(host); }
  if (cleared && level < LEVELS.length && MODE === 'normal') level++; if (!noSave) saveLast('bu', level); /* the next town is picked right away, wherever you go from here */
  drawLevels();
  if (gotSkins.length) { const u = document.createElement('div'); u.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:10px;border:2px solid #7dff3a;background:#0e2a0acc;color:#7dff3a;font-weight:900;font-size:15px;box-shadow:0 0 14px #7dff3a66'; u.innerHTML = '🏆 BONUS SKIN UNLOCKED: <b>' + gotSkins.join(' AND ').toUpperCase() + '</b><br><small style="color:#cfe8c8;font-weight:700;font-size:11px">Put it on with CHOOSE SKIN, or in the skin shop.</small>'; $('taGoalLine').appendChild(u); }
  const n = (k) => stats[k] || 0;
  $('taStats').innerHTML = [...(cleared && timeBonus ? [['⏱ Time bonus', '+' + timeBonus]] : []), ['People beamed up', n('people') + (n('zombies') ? ' + ' + n('zombies') + ' zombies' : '') + (n('convicts') ? ' + ' + n('convicts') + ' convicts' : '')], ['Soldiers beamed up', n('soldiers')], ['Cars beamed up', n('cars')],
    ['Buildings', bDone + ' / ' + totalB + ' (' + p + '%)' + (n('bumps') ? ', ' + n('bumps') + ' rammed' : '')], ['Tanks blown up', n('tanks')], ['Aircraft shot down', n('aircraft')], ...(lv >= 3 || n('horns') ? [['Horn trucks', n('horns')]] : []), ...(lv >= ARMY_FIRST.launcher || n('launchers') ? [['Missile trucks', n('launchers')]] : []), ['Big targets', done.length + ' / ' + poiOrder.length + ' ' + done.map((k) => POI[k].icon).join('')],
    ['Damage taken', Math.round(n('dmg'))], ['Score', score], ['Score coins', '+' + scoreCoins + ' 🪙'], ['Best', best]].map(([a, b]) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>').join('');
  const goes = Math.min(3, 1 + (cleared ? 1 : 0) + Math.floor(done.length / 2));
  if (simming) { $('ta').classList.add('hidden'); $('taEnd').classList.remove('hidden'); return; } /* the balance robot: no prize game */
  showPrizes($('taChests'), goes, '1 go, +1 for clearing the level, +1 for every 2 big targets destroyed (max 3)', () => { location.href = 'store.html?from=beamup'; }, craftPrize('ufo', cleared, goes), () => { $('taPrize').classList.add('hidden'); $('taEnd').classList.remove('hidden'); }, 'craft');
  $('ta').classList.add('hidden'); $('taPrize').classList.remove('hidden'); // the prize game first, then the score
}
const HOWTO = [
  ['🛸', 'Fly', 'Drag anywhere to fly your saucer. Tap a spot to fly there, or tap the minimap to cross town. On a computer: WASD or the arrow keys, or click.'],
  ['⚡', 'E levels', 'Beaming people up and wrecking the town powers you up from E1 to E5 (the pill beside your people count fills toward the next). Each level opens a bigger gun on the right: E2 heavy ray, E3 triple ray, E4 mini nuke, E5 big nuke. Every hit you take drains power, so take too many and you drop a level. Each big target needs a gun of its level: its chip shows which (E2 to E5).'],
  ['🦿', 'The Longshanks', 'Pick the WALKER on the start screen instead of the saucer. It walks on three long legs and stamps on the buildings its feet come down on. Its death ray works like the saucer’s, and it has two beams: the saucer’s beam underneath (stand over people or cars for three seconds), and a searchlight that shines the way it walks (anyone or any car in it for three seconds is beamed up).'],
  ['🔦', 'Beam them up', 'Hover over people or cars for three seconds and the beam comes down by itself. Keep them in the circle under you. Soldiers and cars can be beamed up as well.'],
  ['⚡', 'Death ray', 'It zaps the buildings you fly over or beside by itself. Tap a building, a big target, a tank or a soldier: your saucer flies there and zaps it. Tap an aircraft, a missile or a truck: the ray zaps it where it is. It costs no energy. Tall buildings take two or three zaps. On a computer, F zaps the nearest attacker.'],
  ['🏢', 'Big buildings', 'Big buildings are solid. Fly into one and it comes down, but it costs a lot of energy. The red glow and BUILDING! warn you just before. Houses and small shops pass under you.'],
  ['🛡', 'Energy', 'Your shield and your fuel are one bar. Flying burns a little, army hits and crashes burn more, and everyone you beam up fills it again. Grab them one after another for a BEAM CHAIN: it fills faster.'],
  ['🏚️', 'Wreck the town', 'People run out of the buildings you knock down. Beam them up! Shells that miss you land in town too, and so does anything you shoot down.'],
  ['🎯', 'Big targets', 'Each big target takes a few zaps (the dots on its badge). When it blows up, your saucer gets a SPEED BOOST and a big ENERGY refill, and something happens in town.'],
  ['🪖', 'The army', 'Soldiers fire tracers, and a tank\'s barrel glows before it fires. Helicopters circle you firing rockets. Jets (Suburbs on) strafe along a red lane: get out of it. Horn trucks (Downtown on) blast along an orange line. Missile trucks (Metro on) lock on with a red line. Tap any of them to zap it.'],
  ['🏆', 'Clear the town', 'Beam up enough people and wreck enough of the town before the time runs out. Then the next town opens.'],
];
$('taHow').addEventListener('click', () => showHowTo(HOWTO));
// building a town takes a moment: put the loading screen up first, then do the work once it has been drawn
function loadThen(fn) { if (window.__bootTip) window.__bootTip(); document.body.classList.add('booting'); requestAnimationFrame(() => requestAnimationFrame(() => { try { fn(); } finally { document.body.classList.remove('booting'); } })); }
const playNow = () => { fsMode.play(); unlockAudio(); loadThen(start); }; // full screen and sound have to be asked for in the tap itself
$('taPlay').addEventListener('click', playNow); $('taAgain').addEventListener('click', playNow);
function drawLevels() { const box = $('taLevels'); box.innerHTML = ''; const un = unlocked(); LEVELS.forEach((lv, i) => { const b = document.createElement('button'); const n = i + 1; let best = 0; try { best = +localStorage.getItem(bestKey('bu', n)) || 0; } catch { /* ignore */ }
  b.className = 'lvl' + (n === level ? ' on' : ''); b.disabled = n > un; b.innerHTML = '<b>' + (n > un ? '🔒' : n) + '</b><span>' + lv.name.replace('Small Town', 'Town').replace('The Sprawl', 'Sprawl') + '</span>' + (best ? '<i>' + best + '</i>' : '') + starTag('bu', n); b.addEventListener('click', () => { level = n; drawLevels(); }); box.appendChild(b); }); }
const params = new URLSearchParams(location.search);
level = unlocked(); const devLevel = import.meta.env.DEV ? +params.get('level') : 0; if (devLevel >= 1 && devLevel <= LEVELS.length) { level = devLevel; noSave = true; } drawLevels();
$('taPause').addEventListener('click', togglePause); $('taResume').addEventListener('click', togglePause);
// restart the level from the pause screen; the first tap asks, a second tap within 3 seconds does it
{ const rb = $('taRestart'); let armT = 0; const reset = () => { armT = 0; rb.textContent = '↺ RESTART LEVEL'; rb.classList.remove('armed'); };
  rb.addEventListener('click', () => { if (!armT || performance.now() - armT > 3000) { armT = performance.now(); rb.textContent = '↺ SURE? TAP AGAIN TO RESTART'; rb.classList.add('armed'); setTimeout(() => { if (armT && performance.now() - armT >= 2900) reset(); }, 3000); return; }
    reset(); $('taPaused').classList.add('hidden'); playNow(); }); }
// the saucer on the start screen: live, hovering and turning, its beam on (livePreview.js)
const pv = createPreviews({ perFrame: 1, cam: [0, 2.1, 6.4], look: [0, -0.35, 0], fov: 34 });
const onDouble = (el, fn) => { let t0 = 0; el.addEventListener('click', () => { const t = performance.now(); if (t - t0 < 380) { t0 = 0; fn(); } else t0 = t; }); };
function shopBtn() { const host = $('taStart'), row = host.querySelector('.soundRow'); let b = host.querySelector('.psBtn'); if (b) b.remove(); b = document.createElement('button'); b.className = 'ghost psBtn'; b.textContent = '🎨 SKINS'; b.addEventListener('click', (e) => { e.stopPropagation(); location.href = 'store.html?from=beamup'; }); if (row) { row.insertBefore(b, row.firstChild); row.style.display = 'grid'; row.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))'; b.style.margin = '0'; } else host.appendChild(b); }
// the two machines, as cards: a tap picks one; a double tap opens the skin shop on its skins (SKINS beside SOUND does the same)
const BU_CRAFTS = [['ufo', '🛸 THE BEAMER', 'A saucer: a tractor beam, a death ray, and a shield that runs on people.'], ['walker', '🦿 THE LONGSHANKS', 'A walker: stamps on buildings, a beam underneath and a searchlight ahead.']];
function shipPv(k) { const ck = craftSkinKey(k); if (k === 'walker') return [() => craftPreview('walker', ck, { fitTo: 2.6 }), (dt, t, o) => o.userData.tick(dt, t)];
  return ck ? [() => craftPreview('ufo', ck, { fitTo: 2.7 }), (dt, t, o) => o.userData.tick(dt, t)] : [() => { const g = new THREE.Group(), s0 = makeShip(), b = makeBeam(); s0.scale.setScalar(0.62); g.add(s0); b.g.position.y = -0.45; g.add(b.g); g.userData = { s: s0, b }; return g; },
    (dt, t, o) => { const { s: s0, b } = o.userData; s0.position.y = Math.sin(t * 2) * 0.08; s0.rotation.z = Math.sin(t * 1.3) * 0.06; s0.userData.ring.material.map.offset.x += dt * 0.8; s0.userData.pilot.rotation.y = Math.sin(t * 0.7) * 0.9; b.update(dt, 1.9, 1.1, Math.sin(t * 0.9) > -0.3); }]; }
function drawShipPv() { const box = $('buCrafts'); box.innerHTML = ''; pv.clear(); shopBtn();
  for (const [k, name, desc] of BU_CRAFTS) { const b = document.createElement('button'); b.className = 'craftCard' + (k === craftKind ? ' on' : ''); b.innerHTML = '<canvas width="150" height="150"></canvas><b>' + name + '</b><i class="skHint">DOUBLE TAP: SKINS</i><span>' + desc + '</span>'; box.appendChild(b);
    const [mk, tk] = shipPv(k); pv.add(b.querySelector('canvas'), mk, tk);
    b.addEventListener('click', () => { if (k === craftKind) return; craftKind = k; try { localStorage.setItem('bu_craft', k); } catch { /* ignore */ } box.querySelectorAll('.craftCard').forEach((x, i) => x.classList.toggle('on', BU_CRAFTS[i][0] === k)); if (state !== 'play' && ship.g) makePlayerShip(); });
    onDouble(b, () => { try { localStorage.setItem('bu_craft', k); } catch { /* ignore */ } location.href = 'store.html?from=beamup'; }); } }
drawShipPv();

// the saucer skin's looks, followers and quirks (craftSkins.js). With no skin worn, every call does nothing
const sk = ufoSkin({ scene, fx, twisters, popup, sfx, jolt, people: () => people, buildings: () => buildings, army, addPerson, collide: collidePerson, played: () => played, beamOn: () => beamOn, lim: () => (T ? T.lim : null) });
// ---------- update ----------
function update(dt) {
  placed.length = 0; played += dt; funTick(dt); if (boss) { if (bossTick(dt)) return; } else tLeft -= dt; /* (a boss fight: the town's clock stops, the boss clock runs) */ runTimers(dt); if (tLeft <= 0) { tLeft = 0; finish('time'); return; }
  events.tick(dt, !boss && tLeft > 12 && played > 20 && ship.alive); comboHud(mult(), 1 - (played - lastHit) / 2.5);
  if (cardUp && !coachBusy()) { cardUp = false; curCard = null; cardShutAt = played; } /* a first-time card has just been closed */
  coachBU(); if (played > 30) tip('bu_map', '🗺️ Tap the minimap to fly across town. Green dots are people.');
  /* the beam comes down by itself once people have stayed in the circle under the saucer for a second, and stays on while there are people about */ { let near = false; if (ship.alive && state === 'play') for (const c of people) if (Math.hypot(c.position.x - ship.x, c.position.z - ship.z) < PULL_R * 0.8) { near = true; break; } if (!near && ship.alive && state === 'play') for (const d of drivers) if (Math.hypot(d.g.position.x - ship.x, d.g.position.z - ship.z) < PULL_R * 0.8) { near = true; break; } /* (a car counts too) */ hoverT = near ? hoverT + dt : 0; autoBeamT = hoverT >= AUTO_BEAM ? 0.45 : Math.max(0, autoBeamT - dt); }
  beamOn = (beamHeld || autoBeamT > 0) && ship.alive; if (WALK() && ship.alive) walkerBeam(dt); fly(dt); shipLook(dt); (WALK() || sk.tick(dt, ship));
  boostT -= dt; nukeT = Math.max(0, nukeT - dt); blindT = Math.max(0, blindT - dt); rayCd -= dt;
  /* (flying costs nothing now: power, the E bar, is the only health) */
  const sx = ship.x, sz = ship.z, bl = ship.y - 0.42 * SHIP_SCALE; beam.g.position.set(sx, bl, sz); beam.update(dt, bl, GRAB_R, beamOn);
  setPlaneEngine(beamOn ? 0.75 : 0, 2.4 + Math.sin(played * 3) * 0.05); setWind(0.32 + Math.min(0.4, Math.hypot(ship.vel.x, ship.vel.z) * 0.05), 0.2); // a buzzing hum while beaming, the rush of air as it flies
  if (beamOn && Math.random() < dt * 14) { const a = Math.random() * 6.28, r = Math.random() * GRAB_R; fx.sparks(V3(sx + Math.cos(a) * r, 0.2 + Math.random() * bl * 0.8, sz + Math.sin(a) * r), 1, { c: [0xffffff, 0x7df0ff], speed: 0.6, up: 3, life: 0.8 }); } // motes of light drifting up the beam
  nukeTick(dt);
  { const u = ship.body && ship.body.userData, on = boostT > 0 && ship.alive; if (u) { const k = on ? 1.6 + Math.sin(played * 18) * 0.25 : 1; if (u.pods) { u.pods.scale.setScalar(k); u.pods.rotation.y += on ? dt * 9 : 0; } if (u.eye) u.eye.scale.setScalar(on ? 1.5 : 1); if (u.shield) u.shield.material.opacity = Math.max(u.shield.material.opacity, on ? 0.28 + Math.sin(played * 14) * 0.08 : 0); if (u.ring) u.ring.material.map.offset.x += on ? dt * 3 : 0; }
    if (on) { boostRayT -= dt; if (boostRayT <= 0) { boostRayT = 0.16; const a = Math.random() * 6.283, r = 3 + Math.random() * 5, to = V3(ship.x + Math.sin(a) * r, 0.2, ship.z + Math.cos(a) * r); let best = null, bd = 6; for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - to.x, x.pos.z - to.z); if (d < bd) { bd = d; best = x; } }
      if (best) { const at = best.pos.clone().setY(Math.min(best.h * 0.6, 2.5)); fireAt({ kind: 'building', pos: at, hit: () => hitBuilding(best, at) }, { auto: true }); } else { rays.fire(eyePos(), to); fx.flash(to, 0.6, 0xff9af0); } } } } /* boosted: the ray fires all round, by itself */
  if (boostT > 0 && Math.random() < dt * 30) fx.sparks(V3(sx - ship.vel.x * 0.15 + rnd(-1, 1), ship.y - 0.2, sz - ship.vel.z * 0.15 + rnd(-1, 1)), 1, { c: [0xffffff, 0xc9a6ff], speed: 1, up: 0.5, life: 0.5 }); // a speed boost leaves a sparkling trail
  // people: they wander, run from the saucer, and once the beam has them they are dragged in and lifted
  for (let i = people.length - 1; i >= 0; i--) { const c = people[i], u = c.userData; u.panic = false; const dx = c.position.x - sx, dz = c.position.z - sz, d = Math.hypot(dx, dz) || 0.01;
    if (u.frz && d <= 34) { u.frz = false; delete c.updateMatrixWorld; }
    if (beamOn && d < GRAB_R && lifted.length < LIFT_MAX) { people.splice(i, 1); lift(c, u.kind || 'person'); continue; }
    if (u.wb > 0) { u.panic = true; c.rotation.y = Math.atan2(-dx, -dz); c.position.y = Math.min(0.5, u.wb * 0.15); animateWalk(c, dt, 0); continue; } /* caught in the walker's searchlight: frozen to the spot, lifting a little off the ground */
    if (u.stun > played) { animateWalk(c, dt, 0); continue; } // knocked flat (a blast, a flood): they can't run
    if (beamOn && d < PULL_R) { const k = 1 - d / PULL_R, sp = (2.3 + 2.4 * k) * dt; c.position.x -= dx / d * sp; c.position.z -= dz / d * sp; c.rotation.y = Math.atan2(dx, dz); u.panic = true; animateWalk(c, dt, 1.4); collidePerson(c); u.goal = null; if (Math.random() < dt * 0.25) popup(c.position, SHOUTS[(Math.random() * SHOUTS.length) | 0], '#ffffff'); continue; } // dragged in, legs going, arms up
    if (d < PANIC_R * (WALK() ? 1 : sk.panic) && !u.zombie && !(!WALK() && sk.lured(c, d))) { const sp = (stink ? 0.5 : 1.7) * dt, x0 = c.position.x, z0 = c.position.z; c.position.x += dx / d * sp; c.position.z += dz / d * sp; c.rotation.y = Math.atan2(dx, dz); u.panic = !stink; collidePerson(c); /* a wall in the way: run along it instead of running on the spot */ if (Math.hypot(c.position.x - x0, c.position.z - z0) < sp * 0.4) { const sd = u.side || (u.side = Math.random() < 0.5 ? 1 : -1); c.position.x = x0 - dz / d * sp * sd; c.position.z = z0 + dx / d * sp * sd; c.rotation.y = Math.atan2(-dz * sd, dx * sd); collidePerson(c); if (Math.hypot(c.position.x - x0, c.position.z - z0) < sp * 0.4) u.side = -sd; } if (Math.hypot(c.position.x - x0, c.position.z - z0) > sp * 0.25) animateWalk(c, dt, stink ? 0.6 : 1.3); u.goal = null; if (u.panic && Math.random() < dt * 0.04) popup(c.position, SHOUTS[(Math.random() * SHOUTS.length) | 0], '#ffffff'); continue; }
    if ((u.zombie || (!WALK() && sk.lured(c, d))) && d < 14) { const sp = 0.7 * dt; c.position.x -= dx / d * sp; c.position.z -= dz / d * sp; c.rotation.y = Math.atan2(-dx, -dz); animateWalk(c, dt, 0.8); collidePerson(c); continue; } // the dead shamble toward the light
    if (d > 34) { if (!u.frz) { u.frz = true; c.updateMatrixWorld(true); c.updateMatrixWorld = noop; } continue; } // out of sight: hold still, matrices frozen
    if ((i + frameN) & 1) continue; const dw = dt * 2; u.wait -= dw; if (!u.goal && u.wait <= 0) u.goal = V3(u.home.x + (Math.random() - 0.5) * 2, 0, u.home.z + (Math.random() - 0.5) * 2); // every other frame: just strolling about
    if (u.goal) { const gx = u.goal.x - c.position.x, gz = u.goal.z - c.position.z, gl = Math.hypot(gx, gz); if (gl < 0.1) { u.goal = null; u.wait = 1 + Math.random() * 3; animateWalk(c, dw, 0); } else { c.position.x += gx / gl * 0.6 * dw; c.position.z += gz / gl * 0.6 * dw; c.rotation.y = Math.atan2(gx, gz); animateWalk(c, dw, 0.5); } } else animateWalk(c, dw, 0); }
  // soldiers can be beamed up too (army.js keeps the list)
  if (beamOn) { const S = army.soldiers; for (let i = S.length - 1; i >= 0 && lifted.length < LIFT_MAX; i--) { const s = S[i]; if (Math.hypot(s.position.x - sx, s.position.z - sz) < GRAB_R) { S.splice(i, 1); lift(s, 'soldier'); } } }
  // traffic: cruises the streets, races away from the saucer, and can be beamed up (slowly: cars are heavy)
  for (let i = drivers.length - 1; i >= 0; i--) { const o = drivers[i], p = o.g.position, d = Math.hypot(p.x - sx, p.z - sz);
    if (beamOn && d < GRAB_R * 0.8 && lifted.length < LIFT_MAX) { drivers.splice(i, 1); lift(o.g, 'car'); continue; }
    if (!o.path.length) o.path = roadPathTo(o.cell, d < 12 ? sx : p.x + (Math.random() - 0.5) * 30, d < 12 ? sz : p.z + (Math.random() - 0.5) * 30, d < 12); followPath(o, o.speed * (d < 12 ? 1.5 : 1), dt); }
  updateLifted(dt); updateBurning(dt); for (let i = blasts.length - 1; i >= 0; i--) if (!blasts[i].update(dt)) blasts.splice(i, 1);
  // the death ray's own shots, and a tapped one still waiting (out of reach, or the ray cooling)
  autoRay(dt); if (pend) { pend.t -= dt; if (pend.t <= 0 || (pend.tgt.ok && !pend.tgt.ok())) pend = null; else if (fireAt(pend.tgt)) pend = null; }
  army.update(dt); if (state === 'play') updateHorns(dt); if (state !== 'play') return; frameN++;
  if (moveTo) { wayMark.visible = true; wayMark.position.set(moveTo.x, 0.15, moveTo.z); wayMark.scale.setScalar(1 + Math.sin(played * 8) * 0.12); } else wayMark.visible = false; /* the spot it is flying to */
  holdHint();
  // warnings: the shield running low beeps, flashes the bar and says so (once each time it dips)
  const lowE = energy < 25; if (lowE && !lowWarned) { lowWarned = true; lowAt = played; banner('⚠ SHIELD LOW! BEAM SOMEONE UP!'); } else if (energy > 40) lowWarned = false;
  if (lowE) { beepT -= dt; if (beepT <= 0) { beepT = energy < 12 ? 0.45 : 0.9; sfx.ping(12); } if (played - lowAt > 2.3) status(energy < 12 ? '⚠ SHIELD CRITICAL! BEAM PEOPLE UP!' : '⚠ SHIELD LOW!'); } /* the banner says it first */
  // HUD
  const m = Math.floor(tLeft / 60), s = Math.floor(tLeft % 60); setT('taTime', m + ':' + String(s).padStart(2, '0')); setC('taTime', 'red', tLeft < 15);
  setT('taScore', score); setT('taCombo', !FUN.combo && mult() > 1 && played - lastHit < 2.5 ? 'x' + mult() + ' COMBO' : grabChain >= 2 && played - lastGrab < 2.2 ? '👽 x' + (grabChain + 1) + ' CHAIN' : '');
  setT('buCount', '👽 ' + abd + '/' + L().abduct); setC('buCount', 'ok', abd >= L().abduct);
  drawEBar(); if (frameN % 15 === 0) poiReady(); if (nukeT > 0) setT('buE', '☢️'); else if ($('buE').textContent === '☢️') $('buE').textContent = 'E' + (swLv + 1); { const hb = $('buEnergy'), sp2 = toScreen(ship.center, ship.y + (WALK() ? 2.7 : 1.3)); hb.classList.toggle('off', !ship.alive || !sp2.on); hb.style.left = Math.round(sp2.x) + 'px'; hb.style.top = Math.round(sp2.y - 8) + 'px'; } /* (the health bar floats over the machine) */
  { const k = Math.max(0, energy / E_MAX), w = (k * 100).toFixed(1) + '%'; if (hudCache.ew !== w) { hudCache.ew = w; $('buEnergyFill').style.width = w; } setT('buEnergyTxt', nukeT > 0 ? '☢️ NUCLEAR SHIELD ' + Math.ceil(nukeT) + 's' : '❤️ HEALTH ' + Math.ceil(k * 100) + '%'); setC('buEnergy', 'low', k < 0.25 && nukeT <= 0); setC('buEnergy', 'mid', k >= 0.25 && k < 0.5 && nukeT <= 0); setC('buEnergy', 'nuke', nukeT > 0); setC('buEnergy', 'hit', hitT > 0.05); }
  { const p = pct(); setT('taPct', innerWidth < 761 ? '💥 ' + p + '%' : '🏚️ ' + p + '% DESTROYED'); setC('taPct', 'ok', p >= L().goal); }
  setC('buBeam', 'on', beamOn); setC('buBeam', 'hint', !beamOn && !!peopleNear(PULL_R + 1));
  let nDone = 0; for (const k of poiOrder) { const P = pois[k]; if (P.done) { nDone++; continue; } edgeArrow(P.arrow, P.center, true); if (P.mark) tickPoiMark(P.mark); } setT('taTargets', nDone + '/' + poiGoal()); setC('taTargets', 'ok', nDone >= poiGoal());
  crowdLists[0][0] = people; crowdLists[1][0] = army.soldiers; crowd.sync(crowdLists, sx, sz, 4); syncGlows();
  mapT -= dt; if (mapT <= 0) { mapT = 0.1; drawMini(); } if (frameN % 60 === 0) measureHud();
  if (!boss && abd >= L().abduct && pct() >= L().goal && poisDone() >= poiGoal()) { if (bossDue(level, LEVELS.length) && !bossBeat) startBoss(); else finish('win'); } // all three goals met: mission complete (in the last town, the boss comes first)
}

// a first-time card is up and the round is holding still: the beam's hum and the wind stop, and the beam fades out
function holdQuiet(dt) { setPlaneEngine(0); setWind(0); beamOn = false; beam.update(dt, ship.y - 0.42 * SHIP_SCALE, GRAB_R, false); setC('buBeam', 'on', false); if (holdOn) { holdOn = false; holdEl.style.display = 'none'; } if (warnB) setWarn(warnB); } /* (the HOLD ring steps aside for the card; a building lit red keeps flashing) */
function resize() { renderer.setSize(innerWidth, innerHeight, false); }
addEventListener('resize', resize); resize();
const camTarget = V3(0, 2.5, 0); let last = performance.now(), pausedShown = false, frameN = 0;
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; placed.length = 0;
  setSfxPaused(state === 'paused'); { const rb = document.getElementById('radioBox'); setMusicDuck(state === 'play' || state === 'outro' ? 1 : state === 'paused' && !(rb && !rb.classList.contains('hidden')) ? 0 : 0.5); } // music: full in a round, paused on pause (unless the radio is open), half on menus
  { const pz = state === 'paused'; if (pz !== pausedShown) { pausedShown = pz; document.body.classList.toggle('paused', pz); } } // the tags and arrows that float over the town step aside for the pause menu
  const hold = coachFrame(state === 'play'); if (hold) { $('taBanner').style.opacity = 0; holdQuiet(dt); } // a first-time prompt is up: the round waits for the player
  if (state === 'play') { if (!hold) update(dt); } else if (state === 'outro') outroTick(dt);
  else if (state === 'start' && ship.g) { ship.x = Math.sin(now / 4000) * 7 - 4; ship.z = Math.cos(now / 5000) * 6 - 4; ship.vel.set(Math.cos(now / 4000) * 1.75, 0, -Math.sin(now / 5000) * 1.2); ship.y = shipY(); played += dt; shipLook(dt); (WALK() || sk.tick(dt, ship, true)); beam.g.position.set(ship.x, ship.y - 0.34, ship.z); beam.update(dt, ship.y - 0.34, GRAB_R, Math.sin(now / 1500) > 0.2); crowdLists[0][0] = people; crowdLists[1][0] = army.soldiers; crowd.sync(crowdLists, ship.x, ship.z, 4); syncGlows(); } // the title screen: the saucer cruising over a quiet town (its people drawn as the crowd)
  if (T && state !== 'paused') { twisters.update(dt); fx.update(dt); poiFx.update(dt); T.city.updateRain(dt); rays.update(dt); }
  bannerT -= dt; if (bannerT <= 0) $('taBanner').style.opacity = 0; statusT -= dt; $('taFoe').style.opacity = statusT > 0 ? 1 : 0;
  flashT = Math.max(0, flashT - dt); flashEl.style.opacity = Math.min(0.75, flashT * 3); hurtK = Math.max(0, hurtK - dt * 2.2); hurtEl.style.opacity = Math.min(0.85, hurtK + (state === 'play' && energy < 25 ? 0.25 + Math.sin(now / 160) * 0.2 : 0));
  placeCam(dt); updatePops(dt);
  if (T) T.cull(cam); perfTick(); renderer.render(scene, cam);
}
// camera: angled top-down, following the saucer (a little ahead of it), centred between the ship and the spot under it
function placeCam(dt) {
  const a = innerWidth / innerHeight, half = (a < 1 ? 10.5 / a * 0.8 : 11.5) * zoom; // a phone sees a little closer (its screen is narrow), a computer a little wider
  const lift = innerHeight < 520 && a > 1 ? hudH / innerHeight * half : 0; /* a phone held sideways: the top bar is a quarter of the screen, so the view centres on the space under it (and the saucer sits clear of the arrows along its edge) */
  cam.left = -half * a; cam.right = half * a; cam.top = half + lift; cam.bottom = -half + lift; cam.updateProjectionMatrix();
  camTarget.lerp(tmp.set(ship.x + ship.vel.x * 0.35, Math.min(ship.y, 9) * 0.5, ship.z + ship.vel.z * 0.35), Math.min(1, dt * 3)); cam.position.copy(camTarget).addScaledVector(isoDir, CAM_D); cam.lookAt(camTarget);
  if (shake > 0) { shake = Math.max(0, shake - dt * 2.2); const k = shake * shake * 0.55 * Math.min(2, half / 14); cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k; }
  { const wide = Math.max(0, half - (a < 1 ? 10.14 / a * 0.8 : 10.14)) * 1.1; scene.fog.near = CAM_D - 20 + wide; scene.fog.far = CAM_D + 40 + wide; } // the haze keeps its distance as the view widens
}
// for tests (the balance robot): play `secs` of game time as fast as the computer can, without drawing, with bot(hook) steering every `every` seconds.
// A first-time card that comes up is answered at once (the round holds still while one is up, so it takes no game time)
function sim(secs, bot, every = 0.25) { const dt = 1 / 30; let acc = 0; noSave = simming = true;
  for (let t = 0; t < secs && state === 'play'; t += dt) { if (coachBusy()) { stats.cards = (stats.cards || 0) + 1; answerCard(); } if (bot && (acc += dt) >= every) { acc = 0; bot(window.__bu); } update(dt); placeCam(dt); if (T) { twisters.update(dt); fx.update(dt); poiFx.update(dt); rays.update(dt); } }
  for (let n = 0; n < 300 && state === 'outro'; n++) { outroTick(dt); twisters.update(dt); fx.update(dt); } simming = false;
  return { state, abd, pct: pct(), energy: +energy.toFixed(1), tLeft: +tLeft.toFixed(1), score, kind: outro && outro.kind }; }
// QUICK PLAY on the main menu comes in with ?quick: no title screen, straight into the town you left off in. Otherwise a
// quiet town behind the title screen, with the saucer cruising over it
if (params.has('quick')) { level = quickLevel('bu'); if (devLevel >= 1 && devLevel <= LEVELS.length) level = devLevel; drawLevels(); start(); }
else if (MODE === 'daily') { level = dailyLevel(unlocked()); drawLevels(); start(); } else if (MODE === 'endless') start(); /* a daily challenge or an endless run: straight in */
else { buildWorld(); makePlayerShip(); setupPoiHud(); for (const k of poiOrder) pois[k].arrow.style.display = 'none'; }
requestAnimationFrame(frame); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('booting'))); // the start screen is ready now
window.__bu = { startBoss, get boss() { return boss; }, get RK() { return RK; }, events, army, stomp: (p) => stomp(p), get sw() { return [sw, swLv, swN.slice(), swNext, abd, L().abduct]; }, start, finish, tapAt, fireAt, zapKey, sim, L, LEVELS, wreckPoi, hitPoi, hitBuilding, crumble, blast, hurt, setZoom, THREE, renderer, scene, cam, army, crowd, fx, toScreen, foes, goTo, blockerAt, bldAhead, onShip, shipPx, answerCard, BLD, flyY,
  get card() { return curCard; }, get beamPress() { return beamPress; }, get warnB() { return warnB; }, get bumpT() { return bumpT; }, get pend() { return pend; }, get bAt() { return bAt; }, drag(d) { botDrag = d ? { x: d.x, z: d.z } : null; },
  get state() { return state; }, get level() { return level; }, set level(v) { level = v; }, get ship() { return ship; }, get energy() { return energy; }, set energy(v) { energy = v; }, get abd() { return abd; }, set abd(v) { abd = v; },
  get beamOn() { return beamOn; }, set beam(v) { beamHeld = !!v; }, get moveTo() { return moveTo; }, set moveTo(v) { moveTo = v; }, get tLeft() { return tLeft; }, set tLeft(v) { tLeft = v; }, get score() { return score; }, get stats() { return stats; },
  get people() { return people; }, get drivers() { return drivers; }, get lifted() { return lifted; }, get buildings() { return buildings; }, get pois() { return pois; }, get poiOrder() { return poiOrder; }, get bDone() { return bDone; }, set bDone(v) { bDone = v; }, get totalB() { return totalB; }, get pct() { return pct(); },
  get soldiers() { return army.soldiers; }, get tanks() { return army.tanks; }, get town() { return T; }, get chunks() { return T && T.chunks; }, get coachUp() { return coachBusy(); }, get zoom() { return zoom; }, get song() { return songState(); }, get sceneN() { return scene.children.length; }, get px() { return perfTick.ratio; },
  get calls() { return renderer.info.render.calls; }, get tris() { return renderer.info.render.triangles; }, get flags() { return { blindT, radarDown, radioDown, fireBoost, stink, nukeT, boostT }; }, get outro() { return outro; }, get noSave() { return noSave; }, set noSave(v) { noSave = !!v; }, get hudBoxes() { return hudBoxes; }, measureHud,
  bench(n = 20) { renderer.render(scene, cam); const t0 = performance.now(); for (let i = 0; i < n; i++) renderer.render(scene, cam); renderer.getContext().finish(); return (performance.now() - t0) / n; } };
