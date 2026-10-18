// Tornado Alley: you are the storm. Steer a tornado through town, rip up houses and towers, suck up the people,
// and take out the three big targets (power plant, water station, fairground). The more you wreck, the bigger you
// grow, up to three times your starting size; tall towers only give way once you're big enough.
import * as THREE from 'three';
import { generateMaze, buildCity, toWorld, toCell, findPath, CELL, mulberry32 } from '../city.js';
import { makeCharacter, animateWalk } from '../poster/characters.js';
import { makeCar } from '../car.js';
import { createTwisters } from '../tornado.js';
import { createFires } from '../fire.js';
import { unlockAudio, sfx, startMusic, stopMusic, setMusicChase } from '../audio.js';
import { equippedSkin, CHAR_SKINS } from '../skins.js';
import { showChests } from '../chests.js';
import { stampVersion } from '../version.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x16302f); scene.fog = new THREE.Fog(0x16302f, 60, 120);
const hemi = new THREE.HemisphereLight(0xb8e0d8, 0x2a4448, 1.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xd0e8ff, 0.9); sun.position.set(-6, 10, 8); scene.add(sun);
const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
const ISO_YAW = Math.PI / 4, ISO_ELEV = 0.72;
const isoDir = new THREE.Vector3(Math.sin(ISO_YAW) * Math.cos(ISO_ELEV), Math.sin(ISO_ELEV), Math.cos(ISO_YAW) * Math.cos(ISO_ELEV)).normalize();
const fx = createFires(scene);
let flashT = 0; const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;background:#dfeaff;opacity:0;pointer-events:none;z-index:5'; document.body.appendChild(flashEl);
const twisters = createTwisters(scene, { onBolt: (p, ground) => { flashT = Math.max(flashT, ground ? 0.18 : 0.1); if (ground && Math.random() < 0.3) sfx.boom(); if (ground) fx.puff('smoke', new THREE.Vector3(p.x, 0.3, p.z), 0.6); } });
stampVersion($('taStart'));

// ---------- tuning ----------
const ROUND = 120, S0 = 0.42, MAX_S = 3; // tornado scale at size 1, and the final size (3x)
const F_NEED = { water: 2, power: 3, fair: 4 }; // Fujita rank needed for each target
const POI_PTS = { power: 3000, water: 2500, fair: 4000 }, POI_NAME = { power: 'POWER PLANT', water: 'WATER STATION', fair: 'FAIRGROUND' };
const rankOf = (s) => Math.min(5, Math.floor(((s - 1) / (MAX_S - 1)) * 5 + 0.0001));

// ---------- world ----------
let cols, rows, maze, city, buildings = [], people = [], cars = [], pois = {}, hMax = 3, massTarget = 1, totalB = 1;
let roadCells = [], drivers = [], soldiers = [], tanks = [], shots = [];
function makeTank() {
  const g = new THREE.Group(); const olive = new THREE.MeshLambertMaterial({ color: 0x4a5a32 }), dark = new THREE.MeshLambertMaterial({ color: 0x2a3020 });
  const part = (geo, mat, sx, sy, sz, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m; };
  const bx = new THREE.BoxGeometry(1, 1, 1); part(bx, dark, 0.95, 0.28, 1.5, 0, 0.16, 0); part(bx, olive, 0.85, 0.3, 1.3, 0, 0.42, 0);
  const turret = new THREE.Group(); turret.position.set(0, 0.62, -0.05); g.add(turret); part(bx, olive, 0.55, 0.24, 0.6, 0, 0, 0, turret); part(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), dark, 1, 0.8, 1, 0, 0.02, 0.62, turret).rotation.x = Math.PI / 2;
  g.userData.turret = turret; return g;
}
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
  const m = new THREE.Mesh(big ? shellGeo : tracerGeo, big ? shellMat : tracerMat); m.position.copy(from); m.lookAt(to); scene.add(m);
  shots.push({ m, vel: dir.multiplyScalar(big ? 16 : 28), life: L / (big ? 16 : 28), big }); fx.puff('flame', from, big ? 0.6 : 0.25); if (big) sfx.boom(); else if (Math.random() < 0.3) sfx.throw();
}
function buildWorld() {
  if (city) { scene.remove(city.group); twisters.clear(); fx.clear(); for (const p of people) scene.remove(p); }
  cols = 21; rows = 21; const seed = (Math.random() * 1e6) | 0; const rng = mulberry32(seed);
  maze = generateMaze(cols, rows, Math.floor(cols * rows * 0.12), rng);
  const mid = (cols - 1) / 2; for (let i = 1; i < cols - 1; i++) { maze[mid][i] = false; maze[i][mid] = false; } maze.avenues = { row: mid, col: mid };
  // the fairground: three rides side by side on the south side, facing an open street
  const fy = rows - 4, fx0 = mid - 1; for (let x = fx0; x <= fx0 + 2; x++) maze[fy][x] = true; for (let x = fx0 - 1; x <= fx0 + 3; x++) maze[fy + 1][x] = false;
  const near = (tx, ty) => { let best = null, bd = 1e9; for (let y = 2; y < rows - 2; y++) for (let x = 2; x < cols - 2; x++) { if (!maze[y][x] || (y === fy && x >= fx0 && x <= fx0 + 2)) continue; if (!(maze[y - 1][x] === false || maze[y + 1][x] === false || maze[y][x - 1] === false || maze[y][x + 1] === false)) continue; const d = Math.abs(x - tx) + Math.abs(y - ty); if (d < bd) { bd = d; best = [x, y]; } } return best; };
  const pw = near(3, 3), wt = near(cols - 4, 3);
  const forced = new Map([[fy * cols + fx0, 'ferris'], [fy * cols + fx0 + 1, 'coaster'], [fy * cols + fx0 + 2, 'carousel'], [pw[1] * cols + pw[0], 'power'], [wt[1] * cols + wt[0], 'water']]);
  maze.forcedLandmarks = forced;
  hemi.intensity = 1.7; sun.intensity = 0.9; city = buildCity(scene, maze, 4); city.season.light(hemi, sun, scene); city.detail.clouds.visible = false; city.detail.clouds.material.opacity = 0;
  // targets
  pois = { power: { hz: [], done: false }, water: { hz: [], done: false }, fair: { hz: [], done: false } };
  for (const hz of city.hazards) { const k = hz.type === 'power' ? 'power' : hz.type === 'water' ? 'water' : ['ferris', 'coaster', 'carousel'].includes(hz.type) ? 'fair' : null; if (k) pois[k].hz.push(hz); }
  for (const k in pois) { const c = new THREE.Vector3(); for (const hz of pois[k].hz) c.add(hz.pos); pois[k].center = c.divideScalar(Math.max(1, pois[k].hz.length)); pois[k].reach = k === 'fair' ? 4.2 : 1.6; }
  // buildings
  buildings = city.buildings.map((b) => { const obj = b.parent !== city.group ? b.parent : b; const wp = b.getWorldPosition(new THREE.Vector3()); const h = b.userData.h || 2; return { b, obj, pos: wp, h, pts: Math.round((obj === b ? 70 : 55) * h), done: false, shake: 0 }; });
  hMax = Math.max(3.2, ...buildings.map((x) => x.h)); totalB = buildings.length;
  // people: small crowds out on the streets
  people = []; const roads = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (!maze[y][x]) roads.push([x, y]);
  for (let g = 0; g < 44; g++) { const [x, y] = roads[(rng() * roads.length) | 0]; const w = toWorld(x, y, cols, rows); if (Math.hypot(w.x, w.z) < 6) continue; const n = 2 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) { const c = makeCharacter(['worker', 'pink', 'plaid', 'hivis', 'suit', 'hoodie', 'punk', 'vest'][(rng() * 8) | 0], { skin: equippedSkin('npc') }); c.scale.setScalar(0.25); c.position.set(w.x + (rng() - 0.5) * 1.6, 0, w.z + (rng() - 0.5) * 1.6); c.rotation.y = rng() * 6.28; c.userData.home = c.position.clone(); c.userData.goal = null; c.userData.wait = rng() * 3; scene.add(c); people.push(c); } }
  cars = city.cars.slice();
  // traffic, army squads and tanks
  roadCells = roads; for (const o of [...drivers, ...soldiers, ...tanks]) scene.remove(o.g || o); drivers = []; soldiers = []; tanks = []; for (const s of shots) scene.remove(s.m); shots = [];
  const farRoad = (min) => { for (let k = 0; k < 60; k++) { const [x, y] = roads[(rng() * roads.length) | 0]; const w = toWorld(x, y, cols, rows); if (Math.hypot(w.x, w.z) > min) return [x, y]; } return roads[0]; };
  for (let i = 0; i < 9; i++) { const [x, y] = farRoad(5); const c = makeCar([0xc23b3b, 0x4f8fd6, 0xe8d54a, 0xd8dde0, 0x3a8a5a][(rng() * 5) | 0]); c.scale.setScalar(0.8); const w = toWorld(x, y, cols, rows); c.position.set(w.x, 0, w.z); scene.add(c); drivers.push({ g: c, cell: [x, y], path: [], speed: 3 + rng() * 1.5 }); }
  for (let sq = 0; sq < 5; sq++) { const [x, y] = farRoad(12); const w = toWorld(x, y, cols, rows); for (let i = 0; i < 3; i++) { const s = makeCharacter('vest', { skin: CHAR_SKINS.hunter }); s.scale.setScalar(0.25); s.position.set(w.x + (i - 1) * 0.5, 0, w.z + (rng() - 0.5) * 0.6); const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.6), new THREE.MeshLambertMaterial({ color: 0x22262a })); gun.position.set(0, -0.72, 0.25); s.userData.armR.add(gun); s.userData.cd = rng() * 2; scene.add(s); soldiers.push(s); } }
  for (let i = 0; i < 3; i++) { const [x, y] = farRoad(16); const t = makeTank(); const w = toWorld(x, y, cols, rows); t.position.set(w.x, 0, w.z); scene.add(t); tanks.push({ g: t, cell: [x, y], path: [], cd: 2 + rng() * 2, repath: 0 }); }
  massTarget = buildings.reduce((s, x) => s + x.h, 0) * 0.42 + 12;
}

// ---------- the storm ----------
let tw = null, twObj = null, size = 1, sizeShown = 1, mass = 0;
function makeStorm() {
  const junk = []; const c = makeCar([0xc23b3b, 0x4f8fd6, 0xe8d54a][(Math.random() * 3) | 0]); c.scale.setScalar(0.28); junk.push(c);
  junk.push(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.45, 10), new THREE.MeshLambertMaterial({ color: 0x3a6a8a })));
  twObj = twisters.make(true, junk); twObj.position.set(0, 0, 0); scene.add(twObj); tw = twObj.userData.twister; [0x55555f, 0x8b8b98, 0xb0a48c].forEach((c, i) => tw.layers[i] && tw.layers[i].material.color.setHex(c));
  size = sizeShown = 1; mass = 0; twObj.scale.setScalar(S0);
}
const reach = () => 1.6 * sizeShown; // ground radius that wrecks things
function collidePerson(c) { const p = c.position, r = 0.15; for (const o of city.obstacles) { const dx = p.x - o.x, dz = p.z - o.z; if (Math.abs(dx) > o.hw + r || Math.abs(dz) > o.hd + r) continue; const qx = o.hw + r - Math.abs(dx), qz = o.hd + r - Math.abs(dz); if (qx < qz) p.x += Math.sign(dx || 1) * qx; else p.z += Math.sign(dz || 1) * qz; } }
const maxH = (s) => 3.2 + ((s - 1) / (MAX_S - 1)) * (hMax - 3.2 + 0.1);

// ---------- score, combo, popups ----------
let score = 0, chain = 0, lastHit = -9, tLeft = ROUND, played = 0, peopleN = 0, carsN = 0, propsN = 0, bDone = 0, tooBigT = 0;
const mult = () => Math.min(5, 1 + Math.floor(chain / 4));
function award(base, pos, label) {
  if (played - lastHit < 2.5) chain++; else chain = 0; lastHit = played;
  const pts = Math.round(base * mult()); score += pts; popup(pos, '+' + pts + (label ? ' ' + label : ''), mult() > 1 ? '#ff9a3a' : '#ffe27a'); return pts;
}
const pops = []; for (let i = 0; i < 14; i++) { const el = document.createElement('div'); el.className = 'pop'; el.style.display = 'none'; document.body.appendChild(el); pops.push({ el, t: 0, p: new THREE.Vector3() }); }
let popI = 0; function popup(pos, text, color) { const o = pops[popI++ % pops.length]; o.t = 1; o.p.set(pos.x, (pos.y || 0) + 1.5, pos.z); o.el.textContent = text; o.el.style.color = color; o.el.style.display = 'block'; }
function updatePops(dt) { for (const o of pops) { if (o.t <= 0) continue; o.t -= dt * 0.9; o.p.y += dt * 1.6; const v = o.p.clone().project(cam); o.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%)'; o.el.style.opacity = Math.min(1, o.t * 2); if (o.t <= 0) o.el.style.display = 'none'; } }
let bannerT = 0; function banner(text) { $('taBanner').textContent = text; $('taBanner').style.opacity = 1; bannerT = 2.2; }

// ---------- wreckage ----------
function grow(m) { mass += m; size = Math.min(MAX_S, 1 + (MAX_S - 1) * Math.min(1, mass / massTarget)); }
function wreckBuilding(x) {
  x.done = true; bDone++; { const i = city.obstacles.findIndex((o) => Math.abs(o.x - x.pos.x) < 0.3 && Math.abs(o.z - x.pos.z) < 0.3); if (i >= 0) city.obstacles.splice(i, 1); } const size3 = new THREE.Box3().setFromObject(x.obj).getSize(new THREE.Vector3()); const loose = x.obj === x.b ? (x.b.userData.extras || []).filter((m) => m.parent) : [];
  if (x.b.userData.edges) x.b.userData.edges.visible = false; twisters.tear(x.obj, x.pos, size3, tw, loose); award(x.pts, x.pos); grow(x.h); sfx.boom();
  if (x.h > 5) { fx.explode(new THREE.Vector3(x.pos.x, 1, x.pos.z), 1.4); flashT = 0.12; }
}
function wreckPoi(k) {
  const P = pois[k]; P.done = true; const g = new THREE.Group(); g.position.copy(P.center); scene.add(g);
  for (const hz of P.hz) for (const part of hz.parts || []) if (part.parent) g.attach(part);
  twisters.tear(g, P.center, new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()), tw, []); grow(6);
  award(POI_PTS[k], P.center, POI_NAME[k]); $('poi' + k[0].toUpperCase() + k.slice(1)).classList.add('done'); sfx.wave(); sfx.boom(); fx.explode(new THREE.Vector3(P.center.x, 1, P.center.z), 2.2); flashT = 0.3;
  if (k === 'power') { banner('BLACKOUT!'); blackout(); }
  else if (k === 'water') { banner('WATERSPOUT!'); for (const L of tw.layers) L.material.color.setHex(0x4f9fe0); }
  else banner("THE FAIR'S OVER!");
}
function blackout() {
  hemi.intensity *= 0.55; sun.intensity *= 0.6;
  for (const x of buildings) for (const m of x.b.userData.fade || []) if (m.emissiveIntensity != null) m.emissiveIntensity = 0.04;
  city.group.traverse((m) => { const mt = m.material; if (mt && !Array.isArray(mt) && mt.isMeshBasicMaterial && mt.color && mt.color.getHex() === 0xf6e94a) mt.color.setHex(0x22232a); });
}

// ---------- input: drag anywhere for a stick (touch on the canvas, mouse), or keys ----------
const stick = { id: null, cx: 0, cy: 0, x: 0, y: 0 }; const stickEl = $('taStick'), knobEl = $('taKnob'); const keys = {};
function sDown(id, x, y) { if (stick.id !== null || state !== 'play') return; stick.id = id; stick.cx = x; stick.cy = y; stick.x = stick.y = 0; stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.style.display = 'block'; knobEl.style.transform = 'translate(-50%,-50%)'; }
function sMove(id, x, y) { if (id !== stick.id) return; const dx = x - stick.cx, dy = y - stick.cy, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 55); stick.x = dx / d * m / 55; stick.y = dy / d * m / 55; knobEl.style.transform = 'translate(calc(-50% + ' + stick.x * 36 + 'px), calc(-50% + ' + stick.y * 36 + 'px))'; }
function sUp(id) { if (id !== stick.id) return; stick.id = null; stick.x = stick.y = 0; stickEl.style.display = 'none'; }
canvas.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) sDown('t' + t.identifier, t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) sMove('t' + t.identifier, t.clientX, t.clientY); if (state === 'play') e.preventDefault(); }, { passive: false });
const tUp = (e) => { for (const t of e.changedTouches) sUp('t' + t.identifier); }; addEventListener('touchend', tUp); addEventListener('touchcancel', tUp);
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') sDown(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') sMove(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') sUp(e.pointerId); });
addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape' || e.key === 'p') togglePause(); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// ---------- flow ----------
let state = 'start';
function start() {
  unlockAudio(); buildWorld(); makeStorm(); score = 0; chain = 0; lastHit = -9; tLeft = ROUND; played = 0; peopleN = carsN = propsN = bDone = 0;
  for (const k of ['Power', 'Water', 'Fair']) $('poi' + k).classList.remove('done');
  for (const s of ['taStart', 'taEnd', 'taPaused']) $(s).classList.add('hidden'); $('ta').classList.remove('hidden');
  state = 'play'; startMusic(); setMusicChase(true); sfx.whoosh(); banner('TOUCHDOWN!');
}
function togglePause() { if (state === 'play') { state = 'paused'; $('taPaused').classList.remove('hidden'); } else if (state === 'paused') { state = 'play'; $('taPaused').classList.add('hidden'); } }
function finish() {
  state = 'over'; stopMusic(); sUp(stick.id); const done = ['power', 'water', 'fair'].filter((k) => pois[k].done);
  let best = 0; try { best = +localStorage.getItem('ta_best') || 0; if (score > best) { best = score; localStorage.setItem('ta_best', String(score)); } } catch { /* ignore */ }
  const pct = Math.round((bDone / totalB) * 100);
  $('taEndTitle').innerHTML = pct >= 90 && done.length === 3 ? 'TOWN<br>FLATTENED' : "STORM'S<br>OVER";
  $('taStats').innerHTML = [['Buildings', bDone + ' / ' + totalB + ' (' + pct + '%)'], ['People swept up', peopleN], ['Cars thrown', carsN], ['Power plant', pois.power.done ? '⚡ down' : 'standing'], ['Water station', pois.water.done ? '💧 down' : 'standing'], ['Fairground', pois.fair.done ? '🎡 down' : 'standing'], ['Peak size', 'F' + rankOf(size) + ' (' + size.toFixed(1) + 'x)'], ['Score', score], ['Best', best]].map(([a, b]) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>').join('');
  showChests($('taChests'), Math.min(3, 1 + done.length));
  $('ta').classList.add('hidden'); $('taEnd').classList.remove('hidden');
}
$('taPlay').addEventListener('click', start); $('taAgain').addEventListener('click', start);
$('taPause').addEventListener('click', togglePause); $('taResume').addEventListener('click', togglePause);
try { const b = +localStorage.getItem('ta_best') || 0; if (b) $('taBestLine').textContent = 'Best: ' + b; } catch { /* ignore */ }

// ---------- update ----------
const right = new THREE.Vector3(), upv = new THREE.Vector3(), tmp = new THREE.Vector3();
function update(dt) {
  played += dt; tLeft -= dt; if (tLeft <= 0) { tLeft = 0; finish(); return; }
  // steering, in screen space mapped onto the ground
  let sx = stick.x + ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0), sy = stick.y + ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0);
  cam.updateMatrixWorld(); right.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize(); upv.setFromMatrixColumn(cam.matrixWorld, 1).setY(0).normalize();
  const mag = Math.min(1, Math.hypot(sx, sy)); const speed = 3.2 + sizeShown * 0.7;
  if (mag > 0.05) { tmp.copy(right).multiplyScalar(sx).addScaledVector(upv, -sy).normalize(); twObj.position.addScaledVector(tmp, speed * mag * dt); }
  else { twObj.position.x += Math.sin(played * 0.9) * dt * 0.6; twObj.position.z += Math.cos(played * 0.7) * dt * 0.6; } // a tornado never sits still
  const lim = toWorld(cols - 1, rows - 1, cols, rows); twObj.position.x = Math.max(-lim.x, Math.min(lim.x, twObj.position.x)); twObj.position.z = Math.max(-lim.z, Math.min(lim.z, twObj.position.z));
  sizeShown += (size - sizeShown) * Math.min(1, dt * 1.5); twObj.scale.setScalar(S0 * sizeShown);
  const px = twObj.position.x, pz = twObj.position.z, R = reach();
  if (Math.random() < dt * 8) fx.puff('smoke', new THREE.Vector3(px + (Math.random() - 0.5) * R * 2, 0.3, pz + (Math.random() - 0.5) * R * 2), 0.6 + sizeShown * 0.3);
  // buildings
  tooBigT -= dt;
  for (const x of buildings) { if (x.done) continue; const d = Math.hypot(x.pos.x - px, x.pos.z - pz); if (d > R + 1.15) continue;
    if (x.h <= maxH(sizeShown)) wreckBuilding(x);
    else { x.obj.rotation.z = Math.sin(played * 40) * 0.02; if (tooBigT <= 0) { tooBigT = 2; popup(x.pos, 'TOO BIG - GROW!', '#ff7a5a'); } } }
  // targets
  for (const k of ['power', 'water', 'fair']) { const P = pois[k]; if (P.done || !P.hz.length) continue; if (Math.hypot(P.center.x - px, P.center.z - pz) > R + P.reach) continue;
    if (rankOf(sizeShown) >= F_NEED[k]) wreckPoi(k); else if (tooBigT <= 0) { tooBigT = 2; popup(P.center, 'NEED F' + F_NEED[k] + '!', '#ff7a5a'); } }
  // people flee, then get swept up
  for (let i = people.length - 1; i >= 0; i--) { const c = people[i], u = c.userData; const dx = c.position.x - px, dz = c.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
    if (d < R + 0.35) { people.splice(i, 1); twisters.suck(c, tw); peopleN++; award(25, c.position); grow(0.12); continue; }
    const pull = R * 2.6; if (d < pull) { const k = 1 - d / pull; const sp = (2.8 * k - 1.2 * (1 - k)) * dt; c.position.x -= dx / d * sp; c.position.z -= dz / d * sp; c.position.y = k * k * 0.6; c.rotation.y += dt * 8 * k; animateWalk(c, dt, 1.5); collidePerson(c); u.goal = null; }
    else if (d < 9 + sizeShown * 2) { const sp = 1.7 * dt; c.position.y = 0; c.position.x += dx / d * sp; c.position.z += dz / d * sp; c.rotation.y = Math.atan2(dx, dz); animateWalk(c, dt, 1.3); collidePerson(c); u.goal = null; }
    else { u.wait -= dt; if (!u.goal && u.wait <= 0) { u.goal = new THREE.Vector3(u.home.x + (Math.random() - 0.5) * 2, 0, u.home.z + (Math.random() - 0.5) * 2); }
      if (u.goal) { const gx = u.goal.x - c.position.x, gz = u.goal.z - c.position.z, gl = Math.hypot(gx, gz); if (gl < 0.1) { u.goal = null; u.wait = 1 + Math.random() * 3; animateWalk(c, dt, 0); } else { c.position.x += gx / gl * 0.6 * dt; c.position.z += gz / gl * 0.6 * dt; c.rotation.y = Math.atan2(gx, gz); animateWalk(c, dt, 0.5); } } else animateWalk(c, dt, 0); } }
  // cars and street props
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; const wp = c.getWorldPosition(tmp); if (Math.hypot(wp.x - px, wp.z - pz) < R + 0.7) { cars.splice(i, 1); twisters.suck(c, tw); carsN++; award(60, wp); grow(0.4); sfx.hit(); } }
  if (city.knock(px, pz, R, 0, 0)) { propsN++; award(8, twObj.position); }
  // traffic: cruise the streets, flee the storm, get thrown
  for (let i = drivers.length - 1; i >= 0; i--) { const o = drivers[i], p = o.g.position, d = Math.hypot(p.x - px, p.z - pz);
    if (d < R + 0.7) { drivers.splice(i, 1); twisters.suck(o.g, tw); carsN++; award(60, p); grow(0.4); sfx.hit(); continue; }
    if (!o.path.length) o.path = roadPathTo(o.cell, d < 14 ? px : p.x + (Math.random() - 0.5) * 30, d < 14 ? pz : p.z + (Math.random() - 0.5) * 30, d < 14); followPath(o, o.speed * (d < 14 ? 1.5 : 1), dt); }
  // soldiers hold their ground and shoot at the storm, backing off when it gets close
  for (let i = soldiers.length - 1; i >= 0; i--) { const s = soldiers[i], dx = s.position.x - px, dz = s.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
    if (d < R + 0.35) { soldiers.splice(i, 1); twisters.suck(s, tw); award(40, s.position, 'SOLDIER'); grow(0.15); continue; }
    if (d < 18) { s.rotation.y = Math.atan2(-dx, -dz); s.userData.cd -= dt; if (d < 5 + sizeShown) { s.position.x += dx / d * 1.4 * dt; s.position.z += dz / d * 1.4 * dt; animateWalk(s, dt, 1); } else animateWalk(s, dt, 0); s.userData.armR.rotation.x = -1.45; s.userData.armL.rotation.x = -1.3;
      if (s.userData.cd <= 0) { s.userData.cd = 0.35 + Math.random() * 0.6; fireAt(s.position.clone().setY(0.45).addScaledVector(new THREE.Vector3(-dx / d, 0, -dz / d), 0.3), false); } } else animateWalk(s, dt, 0); }
  // tanks roll in along the streets and shell it
  for (let i = tanks.length - 1; i >= 0; i--) { const t = tanks[i], p = t.g.position, d = Math.hypot(p.x - px, p.z - pz);
    if (d < R + 0.8 && rankOf(sizeShown) >= 2) { tanks.splice(i, 1); twisters.suck(t.g, tw); award(200, p, 'TANK'); grow(1); sfx.boom(); continue; }
    t.repath -= dt; if (t.repath <= 0) { t.repath = 2; t.path = d > 9 ? roadPathTo(t.cell, px, pz, false) : d < 5 ? roadPathTo(t.cell, px, pz, true) : []; } followPath(t, 1.8, dt);
    const tur = t.g.userData.turret; const want = Math.atan2(px - p.x, pz - p.z) - t.g.rotation.y; tur.rotation.y += (Math.atan2(Math.sin(want - tur.rotation.y), Math.cos(want - tur.rotation.y))) * Math.min(1, dt * 4);
    t.cd -= dt; if (d < 20 && t.cd <= 0) { t.cd = 2 + Math.random() * 1.5; const muzzle = new THREE.Vector3(0, 0.64, 1.25).applyMatrix4(tur.matrixWorld); fireAt(muzzle, true); } }
  for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.life -= dt; if (s.big) s.vel.y -= 2 * dt; s.m.position.addScaledVector(s.vel, dt); if (s.life <= 0) { if (s.big) fx.explode(s.m.position.clone(), 0.5); else fx.puff('smoke', s.m.position.clone(), 0.25); scene.remove(s.m); shots.splice(i, 1); } }
  // HUD
  const m = Math.floor(tLeft / 60), s = Math.floor(tLeft % 60);
  $('taTime').textContent = m + ':' + String(s).padStart(2, '0'); $('taTime').style.color = tLeft < 15 ? '#ff5a3a' : '';
  $('taScore').textContent = score; $('taCombo').textContent = mult() > 1 && played - lastHit < 2.5 ? 'x' + mult() + ' COMBO' : '';
  $('taRank').textContent = 'F' + rankOf(sizeShown); $('taPct').textContent = Math.round((bDone / totalB) * 100) + '% destroyed'; $('taPeople').textContent = peopleN + ' people';
  $('taGrowFill').style.width = ((sizeShown - 1) / (MAX_S - 1) * 100) + '%';
  if (bDone >= totalB && ['power', 'water', 'fair'].every((k) => pois[k].done)) { tLeft = Math.min(tLeft, 1.5); }
}

function resize() { renderer.setSize(innerWidth, innerHeight, false); }
addEventListener('resize', resize); resize();
const camTarget = new THREE.Vector3(); let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (state === 'play') update(dt);
  if (city) { twisters.update(dt); fx.update(dt); city.updateRain(dt); }
  bannerT -= dt; if (bannerT <= 0) $('taBanner').style.opacity = 0;
  flashT = Math.max(0, flashT - dt); flashEl.style.opacity = Math.min(0.75, flashT * 3);
  // camera: iso, following the storm and pulling back as it grows
  const a = innerWidth / innerHeight, s = twObj ? sizeShown : 1, half = (a < 1 ? (6.5 + s * 2.6) / a * 0.8 : 6.5 + s * 2.6);
  cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
  if (twObj) camTarget.lerp(tmp.set(twObj.position.x, 1.2 * s, twObj.position.z), Math.min(1, dt * 3)); cam.position.copy(camTarget).addScaledVector(isoDir, 80); cam.lookAt(camTarget);
  updatePops(dt);
  renderer.render(scene, cam);
}
// a calm town behind the title screen
buildWorld(); makeStorm(); twObj.position.set(-12, 0, -12); camTarget.set(0, 1, 0);
requestAnimationFrame(frame);
window.__ta = { get tanks() { return tanks; }, get soldiers() { return soldiers; }, get drivers() { return drivers; }, get state() { return state; }, get score() { return score; }, get size() { return sizeShown; }, get storm() { return twObj; }, get pois() { return pois; }, get buildings() { return buildings; }, get people() { return people; }, set tLeft(v) { tLeft = v; }, grow, start };
