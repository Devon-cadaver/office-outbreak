import * as THREE from 'three';
import { makeCharacter, animateWalk } from './poster/characters.js';
import { generateMaze, buildCity, flowField, findPath, toWorld, toCell, CELL, mulberry32, NIGHT } from './city.js';
import { createInput } from './input.js';
import { unlockAudio, sfx, startMusic, stopMusic, setMusicTension, setMuted, isMuted, audioState } from './audio.js';
import { makeChopper, animateChopper } from './chopper.js';
import { buildRuins } from './ruins.js';
import { makeCar, animateCar } from './car.js';
// ---------- economy / store ----------
let cash = 0, cashThisDistrict = 0;
const inv = { shoes: 0, vest: false, flare: false, ammo: false, car: null, carHp: 0 };
const STORE = [
  { id: 'ammo', name: 'Ammo crate', desc: 'Start the next district with a rifle, 20 shots.', price: 60, once: true },
  { id: 'medkit', name: 'Medkit', desc: 'One extra life (max 5).', price: 120 },
  { id: 'vest', name: 'Kevlar vest', desc: 'Absorbs one zombie touch next district.', price: 150, once: true },
  { id: 'shoes', name: 'Running shoes', desc: '+10% speed, permanent. Stacks 3 times.', price: 200, max: 3 },
  { id: 'flare', name: 'Flare pack', desc: 'Sprinting drops a flare that lures zombies for 6 s.', price: 90, once: true },
  { id: 'car', name: 'Car keys', desc: 'Drive the next district. Run zombies down. 5 hits wrecks it.', price: 600 },
  { id: 'repair', name: 'Repair car', desc: 'Restore the car to full health.', price: 150 },
];
let car = null, driving = false, carHits = 0;
function earn(n) { cash += n; cashThisDistrict += n; }
function ownedCount(id) { return id === 'shoes' ? inv.shoes : id === 'vest' ? +inv.vest : id === 'flare' ? +inv.flare : id === 'ammo' ? +inv.ammo : id === 'car' ? +!!inv.car : 0; }
function canBuy(it) {
  if (cash < it.price) return false;
  if (it.id === 'medkit') return lives < 5;
  if (it.id === 'shoes') return inv.shoes < 3;
  if (it.id === 'car') return !inv.car;
  if (it.id === 'repair') return !!inv.car && inv.carHp < 5;
  if (it.once) return !ownedCount(it.id);
  return true;
}
function buy(it) {
  if (!canBuy(it)) return; cash -= it.price; sfx.pickup();
  if (it.id === 'medkit') lives = Math.min(5, lives + 1);
  else if (it.id === 'shoes') inv.shoes++;
  else if (it.id === 'vest') inv.vest = true;
  else if (it.id === 'flare') inv.flare = true;
  else if (it.id === 'ammo') inv.ammo = true;
  else if (it.id === 'car') { inv.car = true; inv.carHp = 5; }
  else if (it.id === 'repair') inv.carHp = 5;
  renderStore();
}
function renderStore() {
  const el = $('store'); if (!el) return;
  el.innerHTML = '<div class="cash">Cash: $' + cash + '</div>' + STORE.filter((it) => it.id !== 'repair' || inv.car).map((it) => {
    const owned = ownedCount(it.id); const tag = it.id === 'shoes' ? ' (' + inv.shoes + '/3)' : it.id === 'car' && inv.car ? ' (owned, ' + inv.carHp + '/5)' : it.id === 'repair' && inv.car ? ' (' + inv.carHp + '/5)' : owned && it.once ? ' (owned)' : it.id === 'medkit' ? ' (' + lives + '/5 lives)' : '';
    return '<button class="item" data-id="' + it.id + '"' + (canBuy(it) ? '' : ' disabled') + '><span class="iname">' + it.name + tag + '</span><span class="iprice">$' + it.price + '</span><span class="idesc">' + it.desc + '</span></button>';
  }).join('');
  for (const b of el.querySelectorAll('.item')) b.addEventListener('click', () => buy(STORE.find((it) => it.id === b.dataset.id)));
}
let ruins = null, stragglerTimer = 0;
const FINAL_LEVEL = 10;

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(NIGHT.sky);
scene.fog = new THREE.Fog(NIGHT.sky, 70, 120);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xb8e0d8, 0x2a4448, 1.7));
const sun = new THREE.DirectionalLight(0xd0e8ff, 0.9); sun.position.set(-6, 10, 8); scene.add(sun);

function resize() { renderer.setSize(innerWidth, innerHeight, false); fitCamera(); }
addEventListener('resize', resize);

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const ui = { hud: $('hud'), score: $('score'), lives: $('lives'), level: $('level'), people: $('people'), weapon: $('weapon'),
  start: $('start'), cleared: $('cleared'), clearedText: $('clearedText'), over: $('over'), best: $('best'), finalScore: $('finalScore'), finalBest: $('finalBest') };
const input = createInput(canvas, camera);
const getBest = () => { try { return +localStorage.getItem('oo_best') || 0; } catch { return 0; } };
const setBest = (v) => { try { localStorage.setItem('oo_best', String(v)); } catch { /* storage unavailable */ } };
ui.best.textContent = getBest() ? 'Best: ' + getBest() : '';

// ---------- constants ----------
const PLAYER_SPEED = 4.2, R = 0.25;
const CIV_OUTFITS = ['vest', 'suit', 'hoodie', 'hivis', 'punk', 'worker', 'pink', 'plaid'];
const WEAPONS = {
  pistol:  { name: 'Pistol',  ammo: 12, rate: 0.35, range: 9,  speed: 22, pellets: 1, dmg: 1, color: 0x333333 },
  shotgun: { name: 'Shotgun', ammo: 6,  rate: 0.7,  range: 7,  speed: 18, pellets: 4, dmg: 1, color: 0x7a4a1a },
  rifle:   { name: 'Rifle',   ammo: 20, rate: 0.18, range: 11, speed: 26, pellets: 1, dmg: 1, color: 0x2a3a2a },
};

// ---------- state ----------
let state = 'start', level = 1, score = 0, lives = 3, time = 0;
let maze = null, city = null, cols = 0, rows = 0, obstacles = [];
let chopper = null, chopperT = 0, padMesh = null;
let startCell = null, exitCell = null, exitMesh = null, gate = null, switchCell = null, gateMesh = null, switchMesh = null, tip = '';
const player = makeCharacter('worker'); scene.add(player); player.visible = false;
let civilians = [], zombies = [], pickups = [], projectiles = [], particles = [];
const pool = { civ: [], zom: [] };
let weapon = null, ammo = 0, fireTimer = 0, flow = null, flowTimer = 0, invuln = 0, totalPeople = 0, kills = 0;
// player route: list of [cx, cy] cells to walk through
let route = [], routeEndCell = null, stepTimer = 0, groanTimer = 1, tipStage = 0, followers = [], rescuedTotal = 0;
let vestUp = false, flare = null, flareT = 0, noisePos = new THREE.Vector3(), noiseT = 0;
let sprint = 0, sprintCd = 0, lastTapT = 0, lastTapW = null, streak = 0, streakT = 0, respawnCell = null, previewT = 0;
const previewGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 8), previewMat = new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.5 });
const previews = []; for (let i = 0; i < 140; i++) { const mk = new THREE.Mesh(previewGeo, previewMat); mk.visible = false; scene.add(mk); previews.push(mk); }
function showPreview(cells) { previews.forEach((mk, i) => { const c = cells[i]; mk.visible = !!c; if (c) { const w = toWorld(c[0], c[1], cols, rows); mk.position.set(w.x, 0.03, w.z); } }); }
// speech bubbles: small HTML labels that track a character's head
const PLAYER_LINES = ['Follow me!', "Let's get out of here!", 'This way, hurry!', 'Stay close!', 'Come on, move!', 'With me. Now!', "I know a way out!"];
const CIV_LINES = ['Right behind you!', 'Okay, okay!', 'Thank you!', "Don't leave me!", 'Go go go!', 'Lead the way!'];
const bubbles = []; // { el, target, t, dy }
for (let i = 0; i < 4; i++) { const el = document.createElement('div'); el.className = 'bubble hidden'; document.body.appendChild(el); bubbles.push({ el, target: null, t: 0 }); }
function say(target, text, dur = 2.2) {
  let b = bubbles.find((x) => x.t <= 0) || bubbles[0];
  b.target = target; b.t = dur; b.el.textContent = text; b.el.classList.remove('hidden');
}
function updateBubbles(dt) {
  for (const b of bubbles) {
    if (b.t <= 0) continue; b.t -= dt;
    if (b.t <= 0 || !b.target) { b.el.classList.add('hidden'); continue; }
    const v = b.target.position.clone(); v.y += 1.5 * b.target.scale.y + 1.0; v.project(camera);
    b.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%, -100%)';
  }
}
function objectiveCell() { return gate && !gate.open ? (gate.found ? switchCell : gate) : exitCell; }
function addScore(base) { const mult = Math.min(5, 1 + streak); score += base * mult; earn(Math.round(base * mult / 2)); streak++; streakT = 8; updateHud(); }
const tipEl = document.getElementById('tip');
function setTip(t) { if (tip === t) return; tip = t; tipEl.textContent = t; tipEl.classList.toggle('hidden', !t); }
const markerGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 10), markerMat = new THREE.MeshBasicMaterial({ color: 0x7dff6a, transparent: true, opacity: 0.75 });
const markers = []; for (let i = 0; i < 60; i++) { const mk = new THREE.Mesh(markerGeo, markerMat); mk.visible = false; scene.add(mk); markers.push(mk); }
function showRoute() { markers.forEach((mk, i) => { const c = route[i]; mk.visible = !!c; if (c) { const w = toWorld(c[0], c[1], cols, rows); mk.position.set(w.x, 0.04, w.z); } }); }
function playerCell() { return toCell(player.position.x, player.position.z, cols, rows); }
function openCell(c) { return maze[c.cy]?.[c.cx] === false; }
function setRouteTo(w) {
  if (state !== 'play') return;
  const target = toCell(w.x, w.z, cols, rows); if (!openCell(target)) return;
  route = findPath(maze, playerCell(), target); routeEndCell = target; showRoute();
}
function extendRoute(w, first) {
  if (state !== 'play') return;
  const target = toCell(w.x, w.z, cols, rows); if (!openCell(target)) return;
  if (first) { route = []; routeEndCell = playerCell(); }
  if (routeEndCell && target.cx === routeEndCell.cx && target.cy === routeEndCell.cy) return;
  const seg = findPath(maze, routeEndCell || playerCell(), target);
  if (seg.length && route.length + seg.length <= 60) { route.push(...seg); routeEndCell = target; showRoute(); }
}
input.on('tap', (w) => {
  const now = performance.now();
  if (lastTapW && now - lastTapT < 380 && Math.hypot(w.x - lastTapW.x, w.z - lastTapW.z) < 2.5 && sprintCd <= 0 && state === 'play') { sprint = 3; sprintCd = 7; sfx.wave(); if (inv.flare) dropFlare(); say(player, ['Run!', 'Go go go!', 'Move it!'][(Math.random() * 3) | 0], 1.2); }
  lastTapT = now; lastTapW = w; camPan.set(0, 0, 0); setRouteTo(w);
});
input.on('drag', extendRoute);
// binoculars: look mode. One finger pans, pinch zooms, taps never route the player.
const lookBtn = document.getElementById('lookBtn');
function setLook(on) {
  input.setLook(on); lookBtn.classList.toggle('on', on); document.body.classList.toggle('look', on);
  if (on) { if (route.length) { route.length = 0; showRoute(); } say(player, 'Looking around', 1.5); }
  else { camPan.set(0, 0, 0); }
}
lookBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
lookBtn.addEventListener('click', (e) => { e.stopPropagation(); setLook(!input.look); });
window.__setLook = setLook;
input.on('hold', (w) => { if (state !== 'play') return; const path = findPath(maze, playerCell(), objectiveCell()); showPreview(path); previewT = 3; void w; });
input.on('pan', (dx, dy) => { const k = (camera.top - camera.bottom) / innerHeight; camPan.x += (screenRight.x * -dx + screenUp.x * dy) * k; camPan.z += (screenRight.y * -dx + screenUp.y * dy) * k; const lim = Math.max(cols, rows) * CELL * 0.6; camPan.x = Math.max(-lim, Math.min(lim, camPan.x)); camPan.z = Math.max(-lim, Math.min(lim, camPan.z)); });
input.on('zoom', (f) => { zoom = Math.max(0.5, Math.min(2.2, zoom * f)); try { localStorage.setItem('oo_zoom', String(zoom)); } catch { /* ignore */ } fitCamera(); });

const projGeo = new THREE.BoxGeometry(0.1, 0.07, 0.28), projMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
const pickGeo = new THREE.BoxGeometry(0.5, 0.18, 0.18);
const puffGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15), puffMat = new THREE.MeshBasicMaterial({ color: 0x9fc58a });

// Isometric camera: 45 deg yaw, ~35 deg elevation, follows the player.
const CAM_YAW = Math.PI / 4, CAM_ELEV = 0.72;
const camDir = new THREE.Vector3(Math.sin(CAM_YAW) * Math.cos(CAM_ELEV), Math.sin(CAM_ELEV), Math.cos(CAM_YAW) * Math.cos(CAM_ELEV)).normalize();
const screenUp = new THREE.Vector2(-Math.sin(CAM_YAW), -Math.cos(CAM_YAW)), screenRight = new THREE.Vector2(Math.cos(CAM_YAW), -Math.sin(CAM_YAW));
const camTarget = new THREE.Vector3(), camPan = new THREE.Vector3();
let zoom = 1; try { zoom = +localStorage.getItem('oo_zoom') || 1; } catch { /* ignore */ }
function fitCamera() {
  const aspect = innerWidth / innerHeight; camera.aspect = aspect;
  const half = (aspect < 1 ? 9.5 / aspect * 0.8 : 9.5) * zoom; // portrait: about 3 cells wide, more tall
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
  camera.updateProjectionMatrix();
}

function collide(pos, radius) {
  for (const o of obstacles) {
    const dx = pos.x - o.x, dz = pos.z - o.z;
    if (Math.abs(dx) > o.hw + radius + 0.01 || Math.abs(dz) > o.hd + radius + 0.01) continue;
    const px = o.hw + radius - Math.abs(dx), pz = o.hd + radius - Math.abs(dz);
    if (px < pz) pos.x += Math.sign(dx || 1) * px; else pos.z += Math.sign(dz || 1) * pz;
  }
}

function clearLevel() {
  if (city) scene.remove(city.group);
  if (exitMesh) scene.remove(exitMesh);
  if (gateMesh) scene.remove(gateMesh); if (switchMesh) scene.remove(switchMesh); gateMesh = switchMesh = null;
  for (const c of civilians) { scene.remove(c); pool.civ.push(c); }
  for (const z of zombies) { scene.remove(z); pool.zom.push(z); }
  for (const p of pickups) scene.remove(p.mesh);
  for (const p of projectiles) scene.remove(p);
  for (const p of particles) scene.remove(p);
  civilians = []; zombies = []; pickups = []; projectiles = []; particles = [];
}

function buildLevel(n) {
  clearLevel();
  const portrait = innerWidth < innerHeight;
  const tutorial = n === 1;
  const grow = Math.min(12, Math.max(0, n - 2) * 2);
  let c = (portrait ? (tutorial ? 15 : 19) : (tutorial ? 23 : 29)) + grow, r = (portrait ? (tutorial ? 23 : 29) : (tutorial ? 15 : 19)) + grow;
  if (c % 2 === 0) c++; if (r % 2 === 0) r++;
  cols = c; rows = r;
  const rng = mulberry32(n * 1337 + 42);
  // tutorial district is wide open: many extra openings so zombies stay visible
  const loops = tutorial ? Math.floor(cols * rows * 0.16) : Math.floor(cols * rows * 0.1) + n * 2;
  maze = generateMaze(cols, rows, loops, rng);
  if (true) {
    // main avenues: one straight across and one straight down, through the middle of town
    const ay = 1 + 2 * Math.floor((rows - 2) / 4), ax = 1 + 2 * Math.floor((cols - 2) / 4);
    for (let x = 1; x < cols - 1; x++) maze[ay][x] = false;
    for (let y = 1; y < rows - 1; y++) maze[y][ax] = false;
    maze.avenues = { row: ay, col: ax };
  }
  startCell = { cx: 1, cy: rows - 2 };
  // exit: among the cells farthest by road, prefer ones physically close to the start (long way round)
  { const dist = flowField(maze, startCell.cx, startCell.cy); let max = 0; for (const d of dist) if (d > max) max = d;
    const cands = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) { const d = dist[y * cols + x]; if (d >= max * (tutorial ? 0.6 : 0.75)) cands.push({ x, y, d, e: Math.hypot(x - startCell.cx, y - startCell.cy) }); }
    cands.sort((a, b) => a.e - b.e); const pickFrom = cands.slice(0, Math.max(1, Math.ceil(cands.length * 0.4)));
    const ex = pickFrom[(rng() * pickFrom.length) | 0]; exitCell = { cx: ex.x, cy: ex.y }; }
  // gate puzzle from district 3: a locked gate on the route, opened by a switch elsewhere
  gate = null; switchCell = null;
  if (n >= 2) {
    const path = findPath(maze, startCell, exitCell);
    const onMain = new Set(path.map(([x, y]) => y * cols + x)); onMain.add(startCell.cy * cols + startCell.cx);
    const gi = Math.floor(path.length * (0.4 + rng() * 0.3)); const [gx, gy] = path[gi];
    maze[gy][gx] = true;
    // seal alternate routes with buildings (never on the main route) until the gate is the only way
    for (let k = 0; k < 10; k++) {
      const alt = findPath(maze, startCell, exitCell); if (!alt.length) break;
      const cands = alt.map(([x, y], i) => ({ x, y, i })).filter(o => !onMain.has(o.y * cols + o.x));
      if (!cands.length) break;
      const mid = cands[Math.floor(cands.length / 2)]; maze[mid.y][mid.x] = true;
    }
    const d2 = flowField(maze, startCell.cx, startCell.cy);
    if (d2[exitCell.cy * cols + exitCell.cx] < 0) {
      const reach = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) { const d = d2[y * cols + x]; if (d > 4) reach.push({ x, y, d }); }
      reach.sort((a, b) => b.d - a.d); const top = reach.slice(0, Math.max(1, Math.ceil(reach.length * 0.3)));
      const sw = top[(rng() * top.length) | 0]; if (sw) { switchCell = { cx: sw.x, cy: sw.y }; gate = { cx: gx, cy: gy, open: false, found: false }; }
    }
    if (!gate) maze[gy][gx] = false;
  }
  if (gate) maze[gate.cy][gate.cx] = false; // draw the road under the gate
  city = buildCity(scene, maze, n); obstacles = city.obstacles;
  if (ruins) scene.remove(ruins.group); ruins = buildRuins(scene, cols, rows, rng);
  stragglerTimer = 20;
  if (gate) {
    maze[gate.cy][gate.cx] = true; // blocked for pathing until opened
    const gw = toWorld(gate.cx, gate.cy, cols, rows);
    gateMesh = new THREE.Group(); gateMesh.position.set(gw.x, 0, gw.z);
    const barMat = new THREE.MeshLambertMaterial({ color: 0x9a3a4a }), postMat = new THREE.MeshLambertMaterial({ color: 0x4a5a5e });
    const horiz = maze[gate.cy][gate.cx - 1] === false || maze[gate.cy][gate.cx + 1] === false;
    for (let k = -3; k <= 3; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), barMat); bar.position.set(horiz ? 0 : k * 0.4, 0.55, horiz ? k * 0.4 : 0); gateMesh.add(bar); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.1 : 2.8, 0.1, horiz ? 2.8 : 0.1), postMat); rail.position.y = 1.1; gateMesh.add(rail);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xff3a3a })); light.position.set(0, 1.3, 0); gateMesh.add(light); gate.light = light;
    scene.add(gateMesh); gate.obstacle = { x: gw.x, z: gw.z, hw: CELL / 2 - 0.05, hd: CELL / 2 - 0.05 }; obstacles.push(gate.obstacle);
    const sw = toWorld(switchCell.cx, switchCell.cy, cols, rows);
    switchMesh = new THREE.Group(); switchMesh.position.set(sw.x, 0, sw.z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), postMat); base.position.y = 0.25; switchMesh.add(base);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), new THREE.MeshLambertMaterial({ color: 0xffd24a })); lever.position.set(0, 0.75, 0); lever.rotation.z = 0.6; switchMesh.add(lever); switchCell.lever = lever;
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 12), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.5 })); glow.position.y = 0.03; switchMesh.add(glow);
    scene.add(switchMesh);
  }

  // exit marker
  const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows);
  exitMesh = new THREE.Mesh(new THREE.BoxGeometry(CELL - 0.4, 0.12, CELL - 0.4), new THREE.MeshBasicMaterial({ color: n === FINAL_LEVEL ? 0xffd24a : 0x7dff6a }));
  exitMesh.position.set(ep.x, 0.06, ep.z); scene.add(exitMesh);
  if (padMesh) { scene.remove(padMesh); padMesh = null; }
  if (n === FINAL_LEVEL) {
    // helipad "H" + waiting chopper hovering high above the pad
    padMesh = new THREE.Group(); padMesh.position.set(ep.x, 0.13, ep.z);
    const hm = new THREE.MeshBasicMaterial({ color: 0x1e262e });
    for (const [sx, sz, x] of [[0.25, 1.4, -0.5], [0.25, 1.4, 0.5], [1.0, 0.25, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.02, sz), hm); b.position.x = x; padMesh.add(b); }
    scene.add(padMesh);
    chopper = makeChopper(); chopper.position.set(ep.x, 14, ep.z); chopper.scale.setScalar(0.6); scene.add(chopper); chopperT = 0;
  } else if (chopper) { scene.remove(chopper); chopper = null; }

  // street cells excluding start/exit neighborhoods
  const streets = [];
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (!maze[y][x]) {
    const ds = Math.abs(x - startCell.cx) + Math.abs(y - startCell.cy), de = Math.abs(x - exitCell.cx) + Math.abs(y - exitCell.cy);
    if (ds > 3 && de > 2) streets.push({ x, y, ds, de });
  }
  const pick = (filter) => { const arr = streets.filter(filter); if (!arr.length) return null; const i = (rng() * arr.length) | 0; const s = arr[i]; streets.splice(streets.indexOf(s), 1); return s; };

  // crowds
  const crowdCount = tutorial ? 6 : Math.min(40, 6 + n * 2 + Math.floor(cols * rows / 45)); totalPeople = 0;
  for (let i = 0; i < crowdCount; i++) {
    const s = pick(() => true); if (!s) break;
    const w = toWorld(s.x, s.y, cols, rows); const size = 2 + ((rng() * 3) | 0);
    for (let k = 0; k < size; k++) {
      const civ = pool.civ.pop() || makeCharacter(CIV_OUTFITS[(rng() * CIV_OUTFITS.length) | 0]);
      civ.position.set(w.x + (rng() - 0.5) * 1.6, 0, w.z + (rng() - 0.5) * 1.6); civ.rotation.y = rng() * 6.28;
      civ.userData.infect = 0; civ.userData.follow = false; civ.userData.home = civ.position.clone(); civ.userData.goal = null; civ.userData.wait = rng() * 3; civ.scale.setScalar(0.55); scene.add(civ); civilians.push(civ); totalPeople++;
    }
  }
  // starter zombies: far from player
  const zCount = tutorial ? 2 : 3 + Math.floor(n / 2) + Math.floor(cols * rows / 250);
  for (let i = 0; i < zCount; i++) { const s = pick((s) => s.ds > Math.max(cols, rows) * (tutorial ? 0.45 : 0.6)); if (s) spawnZombie(toWorld(s.x, s.y, cols, rows), n, rng); }
  // weapons
  const wCount = 3 + Math.floor(n / 2) + Math.floor(cols * rows / 200);
  const names = Object.keys(WEAPONS);
  for (let i = 0; i < wCount; i++) {
    const s = (tutorial && i === 0) ? (pick((s) => s.ds <= 6) || pick(() => true)) : pick(() => true); if (!s) break;
    const type = names[Math.min(names.length - 1, (rng() * (n >= 3 ? 3 : 2)) | 0)];
    const w = toWorld(s.x, s.y, cols, rows);
    const mesh = new THREE.Mesh(pickGeo, new THREE.MeshLambertMaterial({ color: WEAPONS[type].color }));
    mesh.position.set(w.x, 0.35, w.z); scene.add(mesh); pickups.push({ mesh, type });
  }

  const sp = toWorld(startCell.cx, startCell.cy, cols, rows);
  player.position.set(sp.x, 0, sp.z); player.rotation.y = 0; player.visible = true; player.scale.setScalar(0.55);
  weapon = inv.ammo ? 'rifle' : 'pistol'; ammo = inv.ammo ? 20 : 6; inv.ammo = false; vestUp = inv.vest; inv.vest = false; carHits = 0;
  if (inv.car && inv.carHp > 0 && n > 1) startDriving(); else if (driving) parkCar();
  flow = null; flowTimer = 0; invuln = 1; kills = 0; respawnCell = null; sprint = 0; sprintCd = 0; streak = 0; previewT = 0; showPreview([]); camTarget.copy(player.position); route = []; routeEndCell = null; showRoute();
  tipStage = 0; setTip(''); fitCamera(); updateHud();
}

function spawnZombie(pos, n, rng = Math.random) {
  const z = pool.zom.pop() || makeCharacter(CIV_OUTFITS[(rng() * CIV_OUTFITS.length) | 0], { zombie: true });
  z.position.set(pos.x, 0, pos.z); z.scale.setScalar(0.55);
  z.userData.hp = 2 + Math.floor(n / 3); z.userData.speed = Math.min(PLAYER_SPEED * 0.85, (n === 1 ? 1.6 : 2.3 + n * 0.15) + rng() * 0.3); z.userData.flash = 0;
  scene.add(z); zombies.push(z); return z;
}

function turnCivilian(civ) {
  scene.remove(civ); civilians.splice(civilians.indexOf(civ), 1); pool.civ.push(civ);
  spawnZombie(civ.position, level);
  for (let i = 0; i < 4; i++) particle(civ.position, puffMat);
  sfx.hurt(); updateHud();
}

function particle(pos, mat) {
  const m = new THREE.Mesh(puffGeo, mat); m.position.copy(pos); m.position.y = 1;
  m.userData = { vel: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.5 };
  scene.add(m); particles.push(m);
}

function fire(target) {
  const w = WEAPONS[weapon];
  const base = new THREE.Vector3().subVectors(target.position, player.position).setY(0).normalize();
  for (let i = 0; i < w.pellets; i++) {
    const dir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), w.pellets > 1 ? (i - (w.pellets - 1) / 2) * 0.12 : 0);
    const m = new THREE.Mesh(projGeo, projMat); m.position.copy(player.position); m.position.y = 0.6;
    m.userData = { vel: dir.multiplyScalar(w.speed), life: w.range / w.speed, dmg: w.dmg };
    m.lookAt(m.position.clone().add(dir)); scene.add(m); projectiles.push(m);
  }
  ammo--; sfx.throw(); fireTimer = w.rate; noisePos.copy(player.position); noiseT = 4;
  if (ammo <= 0) weapon = null;
  updateHud();
}

function updateHud() {
  ui.score.textContent = String(score) + (streak >= 1 ? '  x' + Math.min(5, 1 + streak) : '');
  ui.lives.textContent = '♥'.repeat(Math.max(0, lives)) + (sprintCd <= 0 ? '  ⚡' : '');
  ui.level.textContent = level === 1 ? 'Duvallville: Tutorial' : level === FINAL_LEVEL ? 'Duvallville ' + level + ': Evac' : 'Duvallville ' + level + '/' + FINAL_LEVEL;
  const fol = civilians.filter((c) => c.userData.follow).length; ui.people.textContent = 'People safe: ' + civilians.length + '/' + totalPeople + (fol ? '  ·  Following: ' + fol : '');
  ui.weapon.textContent = (driving ? '🚗 ' + inv.carHp + '/5  ·  ' : '') + (weapon ? WEAPONS[weapon].name + ' x' + ammo : 'Unarmed') + '  ·  $' + cash;
}

function show(screen) { if (screen) setTip(''); for (const s of [ui.start, ui.cleared, ui.over, $('won'), $('howto')]) s.classList.add('hidden'); if (screen) screen.classList.remove('hidden'); ui.hud.classList.toggle('hidden', !!screen); document.getElementById('lookBtn').classList.toggle('hidden', !!screen); }

function startRun() { seen = true; unlockAudio(); startMusic(); level = 1; score = 0; lives = 3; time = 0; cash = 0; cashThisDistrict = 0; Object.assign(inv, { shoes: 0, vest: false, flare: false, ammo: false, car: null, carHp: 0 }); if (car) { scene.remove(car); car = null; } driving = false; buildLevel(level); show(null); state = 'play'; }
function nextLevel() { if (state !== "cleared") return; level++; buildLevel(level); show(null); state = 'play'; }
function loseLife() {
  lives--; sfx.caught(); invuln = 2;
  for (let i = 0; i < 8; i++) particle(player.position, projMat);
  if (lives <= 0) { state = 'over'; input.reset(); stopMusic(); sfx.over(); const best = Math.max(getBest(), score); setBest(best);
    ui.finalScore.textContent = 'Score: ' + score + '  ·  District ' + level; ui.finalBest.textContent = 'Best: ' + best; show(ui.over); return; }
  const rc = respawnCell || startCell; const sp = toWorld(rc.cx, rc.cy, cols, rows); player.position.set(sp.x, 0, sp.z); route = []; routeEndCell = null; showRoute();
  // push zombies back a bit so the respawn is fair
  for (const z of zombies) { const c = toCell(z.position.x, z.position.z, cols, rows); if (Math.abs(c.cx - rc.cx) + Math.abs(c.cy - rc.cy) < 6) z.userData.stun = 2.5; }
  updateHud();
}
function startDriving() {
  if (!car) { car = makeCar(); scene.add(car); }
  car.userData.hp = inv.carHp; driving = true; car.visible = true; player.visible = false;
  say(car, 'Buckle up!'); setTip('Driving. Zombies you hit go down, but every hit dents the car.');
}
function parkCar() { driving = false; if (car) car.visible = false; player.visible = true; }
function wreckCar() {
  for (let k = 0; k < 16; k++) particle(car.position, k % 2 ? projMat : puffMat); sfx.over(); say(player, 'The car is done!');
  inv.car = null; inv.carHp = 0; parkCar(); invuln = 1.5;
}
function dropFlare() {
  if (!flare) { flare = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8), new THREE.MeshBasicMaterial({ color: 0xff5a3a })); scene.add(flare); }
  flare.position.copy(player.position); flare.position.y = 0.12; flare.visible = true; flareT = 6;
}
function clearDistrict() {
  if (level === FINAL_LEVEL) { state = 'rescue'; input.reset(); route = []; showRoute(); chopperT = 0; sfx.wave(); setTip('The chopper is coming. Hold on!'); return; }
  state = 'cleared'; input.reset(); sfx.wave();
  const rescued = civilians.filter((c) => c.userData.follow && c.position.distanceTo(player.position) < 6).length;
  const saved = civilians.length - rescued, timeBonus = Math.max(0, 60 - Math.floor(time)) * 2;
  const gained = saved * 100 + rescued * 250 + kills * 10 + timeBonus; score += gained;
  const pay = rescued * 60 + saved * 10 + 100; earn(pay);
  ui.clearedText.innerHTML = 'Rescued with you: <b>' + rescued + '</b> (+' + (rescued * 250) + ')<br>Still alive: ' + saved + '/' + totalPeople + ' (+' + (saved * 100) + ')<br>Zombies dropped: ' + kills + ' (+' + (kills * 10) + ')<br>Speed bonus: +' + timeBonus + '<br>Score: <b>' + score + '</b><br><span class="pay">Paid out: $' + cashThisDistrict + '</span>';
  cashThisDistrict = 0; if (driving) parkCar();
  renderStore(); show(ui.cleared); updateHud();
}
// ---------- how to play slides ----------
const SLIDES = [
  ['howto/1-move.jpg', 'Tap a street to walk there, or drag a route. Double-tap to sprint. Hold a finger down to preview the way to your objective.'],
  ['howto/2-weapon.jpg', 'You start each district with a few pistol shots. Pick up more weapons on the way. They aim and fire by themselves. Chain kills and rescues quickly for a score multiplier.'],
  ['howto/3-crowd.jpg', 'Zombies go for people before you. Any crowd they reach turns and joins the horde, so lead the horde away from crowds.'],
  ['howto/6-follow.jpg', 'Walk up to people and they follow you. Get them to the safe zone for 250 points each. Or keep them between you and the horde: zombies take the nearest person first.'],
  ['howto/4-gate.jpg', 'From district 2 the way out is gated. The arrow leads you to the gate, then to the yellow switch that opens it, then to the safe zone.'],
  ['howto/5-exit.jpg', 'Follow the green arrow to the safe zone. One touch from a zombie costs a life. Ten districts, then the chopper pulls you out.'],
];
let slide = 0;
function showSlide(i) { slide = i; $('slideImg').src = SLIDES[i][0]; $('slideText').textContent = SLIDES[i][1]; $('slideDots').textContent = SLIDES.map((_, k) => k === i ? '●' : '○').join(' '); $('slideNext').textContent = i === SLIDES.length - 1 ? 'START SHIFT' : 'NEXT'; }
function openHowto() { show($('howto')); showSlide(0); }
$('slideNext').addEventListener('click', () => { if (slide < SLIDES.length - 1) showSlide(slide + 1); else { try { localStorage.setItem('oo_seen', '1'); } catch { /* ignore */ } startRun(); } });
$('slideSkip').addEventListener('click', () => { try { localStorage.setItem('oo_seen', '1'); } catch { /* ignore */ } startRun(); });
$('howtoBtn').addEventListener('click', openHowto);
let seen = false; try { seen = localStorage.getItem('oo_seen') === '1'; } catch { /* ignore */ }
$('startBtn').addEventListener('click', () => { unlockAudio(); if (seen) startRun(); else openHowto(); });
// unlock audio on the very first touch anywhere, and offer a mute toggle
const soundBtn = $('soundBtn');
const refreshSoundBtn = () => { soundBtn.textContent = isMuted() ? '🔇 Sound: off' : '🔊 Sound: on' + (audioState() === 'running' ? '' : ' (tap to enable)'); };
refreshSoundBtn();
addEventListener('pointerdown', () => { unlockAudio(); setTimeout(refreshSoundBtn, 150); }, { passive: true });
soundBtn.addEventListener('click', () => { unlockAudio(); setMuted(!isMuted()); if (!isMuted()) sfx.pickup(); refreshSoundBtn(); });
$('retryBtn').addEventListener('click', startRun);
$('nextBtn').addEventListener('click', nextLevel);
function finishGame() {
  state = 'won'; stopMusic();
  const rescued = civilians.filter((c) => c.userData.follow && c.position.distanceTo(player.position) < 8).length;
  const saved = civilians.length - rescued, gained = saved * 100 + rescued * 250 + kills * 10 + 500; score += gained;
  const best = Math.max(getBest(), score); setBest(best);
  $('wonText').innerHTML = 'You escaped Duvallville.<br>On the chopper with you: <b>' + rescued + '</b> (+' + rescued * 250 + ')<br>Still alive: ' + saved + '/' + totalPeople + '<br>Rescue bonus: +500<br><br>Final score: <b>' + score + '</b><br>Best: ' + best;
  show($('won'));
}
$('wonBtn').addEventListener('click', startRun);

// ---------- loop ----------
const tmp = new THREE.Vector3();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;

  if (state === 'rescue' && chopper) {
    chopperT += dt; animateChopper(chopper, dt, chopperT);
    const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows);
    if (chopperT < 3) { chopper.position.y = 14 - (14 - 1.1) * (chopperT / 3); chopper.position.x = ep.x; chopper.position.z = ep.z; }
    else if (chopperT < 4) { player.position.set(ep.x, 0.45 + (chopperT - 3) * 0.4, ep.z); animateWalk(player, dt, 0); }
    else { const u = chopperT - 4; chopper.position.y = 1.1 + u * u * 2.2; chopper.position.x = ep.x + u * 1.5; chopper.position.z = ep.z - u * 1.5; chopper.rotation.z = -0.15; player.position.set(chopper.position.x, chopper.position.y - 0.6, chopper.position.z); if (u > 3.5) finishGame(); }
    for (const z of zombies) animateWalk(z, dt, 0.3);
    for (const c of civilians) if (c.userData.follow) { const dx = player.position.x - c.position.x, dz = player.position.z - c.position.z, d = Math.hypot(dx, dz); if (d > 1.0) { c.position.x += dx / d * 3 * dt; c.position.z += dz / d * 3 * dt; animateWalk(c, dt, 1); } }
    camTarget.lerp(player.position, 1 - Math.pow(0.002, dt));
  }
  if (chopper && state === 'play') animateChopper(chopper, dt, time);
  if (state === 'play') {
    time += dt; invuln -= dt; fireTimer -= dt; flowTimer -= dt;

    // player
    let moving = 0;
    if (route.length) {
      const w = toWorld(route[0][0], route[0][1], cols, rows);
      const dx = w.x - player.position.x, dz = w.z - player.position.z, d = Math.hypot(dx, dz);
      if (d < 0.35) { route.shift(); showRoute(); }
      else { const spd = PLAYER_SPEED * (1 + inv.shoes * 0.1) * (sprint > 0 ? 1.6 : 1) * (driving ? 1.7 : 1); const step = Math.min(d, spd * dt); player.position.x += dx / d * step; player.position.z += dz / d * step; player.rotation.y = Math.atan2(dx, dz); moving = 1; if (sprint > 0 && Math.random() < 0.5) particle(player.position, markerMat); }
    }
    if (driving && car) { car.position.copy(player.position); car.rotation.y = player.rotation.y; animateCar(car, dt, moving); car.userData.hp = inv.carHp; }
    if (flare) { flareT -= dt; if (flareT <= 0) flare.visible = false; else { flare.scale.setScalar(1 + Math.sin(now * 0.03) * 0.3); if (Math.random() < 0.3) particle(flare.position, flare.material); } }
    noiseT -= dt;
    sprint -= dt; sprintCd -= dt; streakT -= dt; if (streakT <= 0 && streak) { streak = 0; updateHud(); }
    previewT -= dt; if (previewT <= 0 && previews[0].visible) showPreview([]);
    collide(player.position, R); animateWalk(player, dt, Math.min(1, moving));
    stepTimer -= dt; if (moving && stepTimer <= 0) { sfx.step(); stepTimer = 0.28; }
    groanTimer -= dt; if (groanTimer <= 0) { groanTimer = 2 + Math.random() * 3; let close = 0; for (const z of zombies) if (z.position.distanceTo(player.position) < 9) close++; if (close) sfx.groan(); setMusicTension(close); }
    player.visible = !driving && (invuln <= 0 || Math.sin(now * 0.03) > 0);

    // exit
    const pc = toCell(player.position.x, player.position.z, cols, rows);
    if (pc.cx === exitCell.cx && pc.cy === exitCell.cy) { clearDistrict(); return render(dt); }
    if (gate && !gate.open && switchCell && pc.cx === switchCell.cx && pc.cy === switchCell.cy) {
      gate.open = true; maze[gate.cy][gate.cx] = false; const oi = obstacles.indexOf(gate.obstacle); if (oi >= 0) obstacles.splice(oi, 1);
      gate.light.material.color.set(0x7dff6a); switchCell.lever.rotation.z = -0.6; flow = null; sfx.wave(); respawnCell = { cx: switchCell.cx, cy: switchCell.cy }; setTip('Gate open! Checkpoint set. Head for the safe zone.'); say(player, 'That did it!');
    }
    if (gate && gate.open && gateMesh.position.y > -1.3) gateMesh.position.y -= dt * 1.5;
    if (level === 1) {
      if (tipStage === 0 && !route.length) setTip('Tap the road to walk there, or drag a route.');
      if (tipStage === 0 && route.length) { tipStage = 1; setTip('Nice. Double-tap to sprint. Hold a finger down to preview the route.'); }
      if (tipStage === 1 && time > 6) { tipStage = 2; setTip('Your pistol fires by itself. Zombies hunt people first, so walk up to a crowd and they follow you.'); }
      if (tipStage === 2 && time > 25) { tipStage = 3; setTip('Follow the green arrow to the safe zone.'); }
    } else if (gate && !gate.open) {
      if (!gate.found && Math.abs(pc.cx - gate.cx) + Math.abs(pc.cy - gate.cy) <= 3) { gate.found = true; tipStage = 2; sfx.hit(); setTip('Locked. The arrow now points to the switch that opens it.'); }
      else if (tipStage === 0) { tipStage = 1; setTip('Follow the arrow. Something is blocking the way out.'); }
    }
    else if (level === FINAL_LEVEL && tipStage === 0) { tipStage = 1; setTip('Last district. Reach the helipad and the chopper will pull you out.'); }

    // flow field toward player, refreshed a few times per second
    if (flowTimer <= 0 || !flow) { flow = flowField(maze, pc.cx, pc.cy); flowTimer = 0.2; }

    // pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.mesh.rotation.y += dt * 2; p.mesh.position.y = 0.35 + Math.sin(now * 0.004) * 0.08;
      if (p.mesh.position.distanceTo(player.position) < 0.7) { weapon = p.type; ammo = WEAPONS[p.type].ammo; scene.remove(p.mesh); pickups.splice(i, 1); sfx.pickup(); updateHud(); }
    }

    // auto fire
    if (weapon && fireTimer <= 0 && zombies.length) {
      let best = null, bd = WEAPONS[weapon].range;
      for (const z of zombies) { const d = z.position.distanceTo(player.position); if (d < bd && lineClear(player.position, z.position)) { bd = d; best = z; } }
      if (best) fire(best);
    }

    // projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; p.position.addScaledVector(p.userData.vel, dt); p.userData.life -= dt;
      let dead = p.userData.life <= 0;
      if (!dead) { const c = toCell(p.position.x, p.position.z, cols, rows); if (maze[c.cy]?.[c.cx] !== false) dead = true; }
      if (!dead) for (const z of zombies) {
        if (Math.hypot(z.position.x - p.position.x, z.position.z - p.position.z) < R + 0.15) {
          z.userData.hp -= p.userData.dmg; z.userData.flash = 0.12; sfx.hit();
          tmp.copy(p.userData.vel).normalize().multiplyScalar(0.5).setY(0); z.position.add(tmp); dead = true; break;
        }
      }
      if (dead) { scene.remove(p); projectiles.splice(i, 1); }
    }

    // zombies
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      if (z.userData.hp <= 0) { scene.remove(z); zombies.splice(i, 1); pool.zom.push(z); kills++; addScore(10); sfx.kill(); for (let k = 0; k < 5; k++) particle(z.position, puffMat); updateHud(); continue; }
      if (z.userData.stun > 0) { z.userData.stun -= dt; animateWalk(z, dt, 0); continue; }
      const c = toCell(z.position.x, z.position.z, cols, rows);
      const here = flow[c.cy * cols + c.cx];
      let tx = player.position.x, tz = player.position.z;
      const zu = z.userData; zu.alert = (zu.alert || 0) - dt;
      const dPlayer = z.position.distanceTo(player.position);
      // senses: sight of the player, gunfire, a flare, or a nearby alerted zombie
      if (dPlayer < 9 && lineClear(z.position, player.position)) zu.alert = 6;
      if (noiseT > 0 && noisePos.distanceTo(z.position) < 14) { zu.alert = Math.max(zu.alert, 4); zu.noise = noisePos.clone(); }
      if (zu.alert <= 0) for (const o of zombies) if (o !== z && o.userData.alert > 2 && o.position.distanceTo(z.position) < 4) { zu.alert = 3; break; }
      // prey: nearest civilian in sight comes first, the player second
      let prey = null, pd = 9;
      for (const civ of civilians) { const d = civ.position.distanceTo(z.position); if (d < pd && lineClear(z.position, civ.position)) { pd = d; prey = civ; } }
      let speedMul = 1;
      if (flare && flareT > 0 && flare.position.distanceTo(z.position) < 12) { tx = flare.position.x; tz = flare.position.z; }
      else if (prey) { tx = prey.position.x; tz = prey.position.z; }
      else if (zu.alert <= 0) {
        // shamble: drift toward a random nearby street cell, slowly
        if (!zu.wander || zu.wanderT <= 0 || (Math.abs(zu.wander.x - z.position.x) + Math.abs(zu.wander.z - z.position.z) < 0.4)) {
          const nx = c.cx + ((Math.random() * 7) | 0) - 3, ny = c.cy + ((Math.random() * 7) | 0) - 3; const ok = openCell({ cx: nx, cy: ny }) ? { cx: nx, cy: ny } : c;
          const w = toWorld(ok.cx, ok.cy, cols, rows); zu.wander = new THREE.Vector3(w.x, 0, w.z); zu.wanderT = 3 + Math.random() * 4;
        }
        zu.wanderT -= dt; tx = zu.wander.x; tz = zu.wander.z; speedMul = 0.45;
      }
      else if (zu.noise && dPlayer > 9 && !lineClear(z.position, player.position)) { tx = zu.noise.x; tz = zu.noise.z; if (zu.noise.distanceTo(z.position) < 0.8) zu.noise = null; }
      else if (here > 1) {
        let bestD = here, bx = c.cx, by = c.cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.cx + dx, ny = c.cy + dy; const d = flow[ny * cols + nx]; if (d >= 0 && d < bestD) { bestD = d; bx = nx; by = ny; } }
        const w = toWorld(bx, by, cols, rows); tx = w.x; tz = w.z;
      } else if (here < 0) { const w = toWorld(c.cx, c.cy, cols, rows); tx = w.x; tz = w.z; }
      tmp.set(tx - z.position.x, 0, tz - z.position.z); const dl = tmp.length(); if (dl > 0.001) tmp.divideScalar(dl);
      z.position.addScaledVector(tmp, z.userData.speed * speedMul * dt);
      z.rotation.y = Math.atan2(tmp.x, tmp.z);
      for (const o of zombies) if (o !== z) { const dx = z.position.x - o.position.x, dz = z.position.z - o.position.z, dd = Math.hypot(dx, dz); if (dd < 0.45 && dd > 0.001) { z.position.x += dx / dd * (0.45 - dd) * 0.5; z.position.z += dz / dd * (0.45 - dd) * 0.5; } }
      collide(z.position, R * 0.8); animateWalk(z, dt, speedMul);
      if (z.userData.flash > 0) { z.userData.flash -= dt; z.position.y = 0.1; } else z.position.y = 0;
      // infect civilians
      for (const civ of civilians) if (Math.hypot(civ.position.x - z.position.x, civ.position.z - z.position.z) < 0.7) civ.userData.infect += dt * 2;
      // touch player
      const touchD = Math.hypot(z.position.x - player.position.x, z.position.z - player.position.z);
      if (driving && touchD < 1.1) {
        scene.remove(z); zombies.splice(i, 1); pool.zom.push(z); kills++; addScore(10); sfx.kill(); for (let k = 0; k < 6; k++) particle(z.position, puffMat);
        inv.carHp--; carHits++; sfx.hit(); if (inv.carHp <= 0) wreckCar(); updateHud(); continue;
      }
      if (invuln <= 0 && touchD < R * 2) { if (vestUp) { vestUp = false; invuln = 1.2; sfx.hit(); say(player, 'Vest took it!'); for (let k = 0; k < 6; k++) particle(player.position, projMat); } else { loseLife(); if (state !== 'play') return render(dt); } }
    }
    if (level > 1) { stragglerTimer -= dt; if (stragglerTimer <= 0 && zombies.length < 10 + level * 3) { stragglerTimer = 22 - Math.min(12, level); const edges = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (!maze[y][x] && (x === 1 || y === 1 || x === cols - 2 || y === rows - 2)) edges.push([x, y]); const far = edges.filter(([x, y]) => Math.abs(x - pc.cx) + Math.abs(y - pc.cy) > 8); if (far.length) { const [x, y] = far[(Math.random() * far.length) | 0]; spawnZombie(toWorld(x, y, cols, rows), level); } } }
    // civilians turning / following
    followers = civilians.filter((c) => c.userData.follow);
    for (let i = civilians.length - 1; i >= 0; i--) {
      const civ = civilians[i];
      if (civ.userData.infect > 0) { civ.userData.infect -= dt * 0.5; civ.position.y = Math.random() * 0.1; if (civ.userData.infect >= 1) { turnCivilian(civ); continue; } }
      else civ.position.y = 0;
      const u = civ.userData;
      if (!u.follow && civ.position.distanceTo(player.position) < 1.3) { u.follow = true; u.goal = null; rescuedTotal++; addScore(25); sfx.pickup(); updateHud(); say(player, PLAYER_LINES[(Math.random() * PLAYER_LINES.length) | 0]); setTimeout(() => { if (civ.userData.follow) say(civ, CIV_LINES[(Math.random() * CIV_LINES.length) | 0], 1.8); }, 700); if (level === 1 && tipStage < 4) { tipStage = 4; setTip('They will follow you. Bring people to the safe zone for extra points.'); } }
      if (u.follow) {
        // target: a spot behind the player, staggered per follower
        const idx = followers.indexOf(civ); const leaderPos = idx <= 0 ? player.position : followers[idx - 1].position;
        const dx = leaderPos.x - civ.position.x, dz = leaderPos.z - civ.position.z, d = Math.hypot(dx, dz);
        if (d > 0.9) { const st = Math.min(d - 0.7, PLAYER_SPEED * 1.1 * dt); civ.position.x += dx / d * st; civ.position.z += dz / d * st; civ.rotation.y = Math.atan2(dx, dz); collide(civ.position, 0.2); animateWalk(civ, dt, 1); }
        else animateWalk(civ, dt, 0);
        continue;
      }
      let threat = null, td = 4.5; for (const z of zombies) { const d = z.position.distanceTo(civ.position); if (d < td) { td = d; threat = z; } }
      if (threat && civ.position.distanceTo(player.position) < 7 && !driving) {
        // run to the player for protection
        const dx = player.position.x - civ.position.x, dz = player.position.z - civ.position.z, d = Math.hypot(dx, dz) || 1;
        civ.position.x += dx / d * 2.8 * dt; civ.position.z += dz / d * 2.8 * dt; collide(civ.position, 0.2); civ.rotation.y = Math.atan2(dx, dz); animateWalk(civ, dt, 1);
        if (!u.yelled) { u.yelled = true; say(civ, ['Help!', 'Over here!', 'Wait for me!'][(Math.random() * 3) | 0], 1.5); }
        u.goal = null; continue;
      }
      if (threat) {
        if (!u.yelled && Math.random() < 0.3) { u.yelled = true; say(civ, ['Run!', 'Zombies!', 'Get away!'][(Math.random() * 3) | 0], 1.4); }
        const dx = civ.position.x - threat.position.x, dz = civ.position.z - threat.position.z, d = Math.hypot(dx, dz) || 1;
        const nx = civ.position.x + dx / d * 2.4 * dt, nz = civ.position.z + dz / d * 2.4 * dt; const nc = toCell(nx, nz, cols, rows);
        if (openCell(nc)) { civ.position.x = nx; civ.position.z = nz; } collide(civ.position, 0.2);
        civ.rotation.y = Math.atan2(dx, dz); animateWalk(civ, dt, 1); u.goal = null; u.wait = 1; continue;
      }
      if (u.goal) {
        const dx = u.goal.x - civ.position.x, dz = u.goal.z - civ.position.z, d = Math.hypot(dx, dz);
        if (d < 0.1) { u.goal = null; u.wait = 1.5 + Math.random() * 4; animateWalk(civ, dt, 0); }
        else { const st = Math.min(d, 1.1 * dt); civ.position.x += dx / d * st; civ.position.z += dz / d * st; civ.rotation.y = Math.atan2(dx, dz); collide(civ.position, 0.2); animateWalk(civ, dt, 0.5); }
      } else {
        u.wait -= dt; animateWalk(civ, dt, 0); u.yelled = false;
        if (Math.random() < dt * 0.02) say(civ, ['Did you hear that?', "We should go.", 'Is it safe?', 'Where is everyone?', "I'm scared."][(Math.random() * 5) | 0], 1.6);
        // chat: face the nearest neighbour while waiting
        let near = null, nd = 1.6; for (const o of civilians) if (o !== civ) { const d = o.position.distanceTo(civ.position); if (d < nd) { nd = d; near = o; } }
        if (near) civ.rotation.y = Math.atan2(near.position.x - civ.position.x, near.position.z - civ.position.z);
        if (u.wait <= 0) { const a = Math.random() * 6.283, r = 0.4 + Math.random() * 0.9; u.goal = new THREE.Vector3(u.home.x + Math.cos(a) * r, 0, u.home.z + Math.sin(a) * r); const c = toCell(u.goal.x, u.goal.z, cols, rows); if (!openCell(c)) u.goal = null; }
      }
    }
    // particles
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.position.addScaledVector(p.userData.vel, dt); p.userData.vel.y -= 12 * dt; p.userData.life -= dt; if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); } }
  } else {
    for (const z of zombies) animateWalk(z, dt, 0.3);
  }
  updateBubbles(dt);
  if (city) city.updateRain(dt);
  if (ruins) ruins.update(dt, now / 1000);
  render(dt);
}

function lineClear(a, b) {
  // sample along the segment; blocked if it crosses a building cell
  const steps = Math.ceil(a.distanceTo(b) / 0.8);
  for (let i = 1; i < steps; i++) { const t = i / steps; const c = toCell(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, cols, rows); if (maze[c.cy]?.[c.cx] !== false) return false; }
  return true;
}

const arrowEl = document.getElementById('exitArrow');
function render(dt = 0.016) {
  if (cols) {
    const lim = { x: cols * CELL / 2, z: rows * CELL / 2 };
    const want = player.position.clone().add(camPan);
    camTarget.lerp(want, state === 'play' ? 1 - Math.pow(0.002, dt) : 1);
    camera.position.copy(camTarget).addScaledVector(camDir, 60); camera.lookAt(camTarget);
    // buildings between the camera and the player go see-through
    for (const b of city.buildings) {
      const dx = b.position.x - player.position.x, dz = b.position.z - player.position.z;
      const towardCam = dx * camDir.x + dz * camDir.z; const dist = Math.hypot(dx, dz);
      const fade = dist < 4.5 || (towardCam > 0.3 && dist < 9 && Math.abs(dx * camDir.z - dz * camDir.x) < 3.8);
      const op = fade ? 0.12 : 1; for (const mat of b.userData.fade) if (mat.opacity !== op) { mat.opacity = op; }
      if (b.userData.edges) b.userData.edges.visible = fade;
    }
    // exit arrow
    if (state === 'play' && exitCell) {
      const tc = gate && !gate.open ? (gate.found ? switchCell : gate) : exitCell;
      const e = toWorld(tc.cx, tc.cy, cols, rows);
      const v = new THREE.Vector3(e.x, 0.5, e.z).project(camera);
      const onScreen = Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.85;
      arrowEl.classList.toggle('hidden', onScreen);
      if (!onScreen) {
        const ang = Math.atan2(-v.y, v.x); const rx = Math.cos(ang), ry = Math.sin(ang);
        const k = Math.min(0.9 / Math.abs(rx || 1e-6), 0.82 / Math.abs(ry || 1e-6));
        const sx = (rx * k * 0.5 + 0.5) * innerWidth, sy = (ry * k * 0.5 + 0.5) * innerHeight;
        arrowEl.style.transform = 'translate(' + (sx - 22) + 'px,' + (sy - 22) + 'px) rotate(' + ang + 'rad)';
      }
    } else arrowEl.classList.add('hidden');
    void lim;
  }
  renderer.render(scene, camera);
}
resize();
requestAnimationFrame(frame);

// Debug hook for automated testing (harmless in production).
window.__oo = { get cash() { return cash; }, set cash(v) { cash = v; renderStore(); }, get driving() { return driving; }, get inv() { return inv; }, get chopper() { return chopper; }, get chopperT() { return chopperT; }, set chopperT(v) { chopperT = v; }, routeTo: (cx, cy) => setRouteTo(toWorld(cx, cy, cols, rows)), get civilians() { return civilians; }, get maze() { return maze; }, get player() { return player; }, get gate() { return gate; }, get switchCell() { return switchCell; }, get cols() { return cols; }, get rows() { return rows; }, toWorld: (cx, cy) => toWorld(cx, cy, cols, rows), get pickups() { return pickups; }, get zombies() { return zombies; }, get exit() { return toWorld(exitCell.cx, exitCell.cy, cols, rows); }, get state() { return state; } };
