import * as THREE from 'three';
import { makeCharacter, animateWalk, OUTFITS } from './characters.js';
import { generateMaze, buildCity, flowField, findPath, toWorld, toCell, CELL, mulberry32, NIGHT } from './city.js';
import { createInput } from './input.js';
import { unlockAudio, sfx, startMusic, stopMusic, setMusicTension, setMuted, isMuted, audioState } from './audio.js';
import { makeChopper, animateChopper } from './chopper.js';
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
const CIV_OUTFITS = ['vest', 'suit', 'hoodie', 'hivis', 'punk', 'worker'];
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
let route = [], routeEndCell = null, stepTimer = 0, groanTimer = 1, tipStage = 0;
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
input.on('tap', setRouteTo); input.on('drag', extendRoute);

const projGeo = new THREE.BoxGeometry(0.1, 0.07, 0.28), projMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
const pickGeo = new THREE.BoxGeometry(0.5, 0.18, 0.18);
const puffGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15), puffMat = new THREE.MeshBasicMaterial({ color: 0x9fc58a });

// Isometric camera: 45 deg yaw, ~35 deg elevation, follows the player.
const CAM_YAW = Math.PI / 4, CAM_ELEV = 0.72;
const camDir = new THREE.Vector3(Math.sin(CAM_YAW) * Math.cos(CAM_ELEV), Math.sin(CAM_ELEV), Math.cos(CAM_YAW) * Math.cos(CAM_ELEV)).normalize();
const screenUp = new THREE.Vector2(-Math.sin(CAM_YAW), -Math.cos(CAM_YAW)), screenRight = new THREE.Vector2(Math.cos(CAM_YAW), -Math.sin(CAM_YAW));
const camTarget = new THREE.Vector3();
function fitCamera() {
  const aspect = innerWidth / innerHeight; camera.aspect = aspect;
  const half = aspect < 1 ? 9.5 / aspect * 0.8 : 9.5; // portrait: about 3 cells wide, more tall
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
  const grow = Math.min(8, (n - 1) * 2);
  let c = (portrait ? 9 : 15) + grow, r = (portrait ? 15 : 9) + grow;
  if (c % 2 === 0) c++; if (r % 2 === 0) r++;
  cols = c; rows = r;
  const rng = mulberry32(n * 1337 + 42);
  // tutorial district is wide open: many extra openings so zombies stay visible
  const loops = tutorial ? Math.floor(cols * rows * 0.22) : Math.floor(cols * rows * 0.1) + n * 2;
  maze = generateMaze(cols, rows, loops, rng);
  startCell = { cx: 1, cy: rows - 2 };
  // exit: among the cells farthest by road, prefer ones physically close to the start (long way round)
  { const dist = flowField(maze, startCell.cx, startCell.cy); let max = 0; for (const d of dist) if (d > max) max = d;
    const cands = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) { const d = dist[y * cols + x]; if (d >= max * (tutorial ? 0.6 : 0.75)) cands.push({ x, y, d, e: Math.hypot(x - startCell.cx, y - startCell.cy) }); }
    cands.sort((a, b) => a.e - b.e); const pickFrom = cands.slice(0, Math.max(1, Math.ceil(cands.length * 0.4)));
    const ex = pickFrom[(rng() * pickFrom.length) | 0]; exitCell = { cx: ex.x, cy: ex.y }; }
  // gate puzzle from district 3: a locked gate on the route, opened by a switch elsewhere
  gate = null; switchCell = null;
  if (n >= 3) {
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
      const sw = top[(rng() * top.length) | 0]; if (sw) { switchCell = { cx: sw.x, cy: sw.y }; gate = { cx: gx, cy: gy, open: false }; }
    }
    if (!gate) maze[gy][gx] = false;
  }
  if (gate) maze[gate.cy][gate.cx] = false; // draw the road under the gate
  city = buildCity(scene, maze, n); obstacles = city.obstacles;
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
  const crowdCount = tutorial ? 3 : 4 + n * 2; totalPeople = 0;
  for (let i = 0; i < crowdCount; i++) {
    const s = pick(() => true); if (!s) break;
    const w = toWorld(s.x, s.y, cols, rows); const size = 2 + ((rng() * 3) | 0);
    for (let k = 0; k < size; k++) {
      const civ = pool.civ.pop() || makeCharacter(CIV_OUTFITS[(rng() * CIV_OUTFITS.length) | 0]);
      civ.position.set(w.x + (rng() - 0.5) * 1.6, 0, w.z + (rng() - 0.5) * 1.6); civ.rotation.y = rng() * 6.28;
      civ.userData.infect = 0; civ.userData.home = civ.position.clone(); civ.userData.goal = null; civ.userData.wait = rng() * 3; civ.scale.setScalar(0.55); scene.add(civ); civilians.push(civ); totalPeople++;
    }
  }
  // starter zombies: far from player
  const zCount = tutorial ? 1 : 1 + Math.floor(n / 2);
  for (let i = 0; i < zCount; i++) { const s = pick((s) => s.ds > Math.max(cols, rows) * (tutorial ? 0.45 : 0.6)); if (s) spawnZombie(toWorld(s.x, s.y, cols, rows), n, rng); }
  // weapons
  const wCount = 2 + Math.floor(n / 2);
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
  weapon = null; ammo = 0; flow = null; flowTimer = 0; invuln = 1; kills = 0; camTarget.copy(player.position); route = []; routeEndCell = null; showRoute();
  tipStage = 0; setTip(''); fitCamera(); updateHud();
}

function spawnZombie(pos, n, rng = Math.random) {
  const z = pool.zom.pop() || makeCharacter(CIV_OUTFITS[(rng() * CIV_OUTFITS.length) | 0], { zombie: true });
  z.position.set(pos.x, 0, pos.z); z.scale.setScalar(0.55);
  z.userData.hp = 2 + Math.floor(n / 3); z.userData.speed = (n === 1 ? 1.6 : 2.2 + n * 0.2) + rng() * 0.4; z.userData.flash = 0;
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
  ammo--; sfx.throw(); fireTimer = w.rate;
  if (ammo <= 0) weapon = null;
  updateHud();
}

function updateHud() {
  ui.score.textContent = String(score);
  ui.lives.textContent = '♥'.repeat(Math.max(0, lives));
  ui.level.textContent = level === 1 ? 'Duvallville: Tutorial' : level === FINAL_LEVEL ? 'Duvallville ' + level + ': Evac' : 'Duvallville ' + level + '/' + FINAL_LEVEL;
  ui.people.textContent = 'People safe: ' + civilians.length + '/' + totalPeople;
  ui.weapon.textContent = weapon ? WEAPONS[weapon].name + ' x' + ammo : 'Unarmed';
}

function show(screen) { if (screen) setTip(''); for (const s of [ui.start, ui.cleared, ui.over, $('won'), $('howto')]) s.classList.add('hidden'); if (screen) screen.classList.remove('hidden'); ui.hud.classList.toggle('hidden', !!screen); }

function startRun() { seen = true; unlockAudio(); startMusic(); level = 1; score = 0; lives = 3; time = 0; buildLevel(level); show(null); state = 'play'; }
function nextLevel() { if (state !== "cleared") return; level++; buildLevel(level); show(null); state = 'play'; }
function loseLife() {
  lives--; sfx.caught(); invuln = 2;
  for (let i = 0; i < 8; i++) particle(player.position, projMat);
  if (lives <= 0) { state = 'over'; input.reset(); stopMusic(); sfx.over(); const best = Math.max(getBest(), score); setBest(best);
    ui.finalScore.textContent = 'Score: ' + score + '  ·  District ' + level; ui.finalBest.textContent = 'Best: ' + best; show(ui.over); return; }
  const sp = toWorld(startCell.cx, startCell.cy, cols, rows); player.position.set(sp.x, 0, sp.z); route = []; routeEndCell = null; showRoute();
  // push zombies back a bit so the respawn is fair
  for (const z of zombies) { const c = toCell(z.position.x, z.position.z, cols, rows); if (Math.abs(c.cx - startCell.cx) + Math.abs(c.cy - startCell.cy) < 6) z.userData.stun = 2.5; }
  updateHud();
}
function clearDistrict() {
  if (level === FINAL_LEVEL) { state = 'rescue'; input.reset(); route = []; showRoute(); chopperT = 0; sfx.wave(); setTip('The chopper is coming. Hold on!'); return; }
  state = 'cleared'; input.reset(); sfx.wave();
  const saved = civilians.length, timeBonus = Math.max(0, 60 - Math.floor(time)) * 2;
  const gained = saved * 100 + kills * 10 + timeBonus; score += gained;
  ui.clearedText.innerHTML = `People saved: <b>${saved}/${totalPeople}</b> (+${saved * 100})<br>Zombies dropped: ${kills} (+${kills * 10})<br>Speed bonus: +${timeBonus}<br><br>Score: <b>${score}</b>`;
  show(ui.cleared); updateHud();
}
// ---------- how to play slides ----------
const SLIDES = [
  ['howto/1-move.jpg', 'Tap a street to walk there, or drag a route. Green dots show your path.'],
  ['howto/2-weapon.jpg', 'You start unarmed. Pick up a pistol, shotgun or rifle. It aims and fires by itself, until the ammo runs out.'],
  ['howto/3-crowd.jpg', 'Crowds are standing around the district. Any crowd a zombie reaches turns and joins the horde. Lead zombies away from people.'],
  ['howto/4-gate.jpg', 'From district 3 the route is gated. Find the yellow switch somewhere else in the district to open it.'],
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
  const saved = civilians.length, gained = saved * 100 + kills * 10 + 500; score += gained;
  const best = Math.max(getBest(), score); setBest(best);
  $('wonText').innerHTML = 'You escaped Duvallville.<br>People saved in the last district: <b>' + saved + '/' + totalPeople + '</b><br>Rescue bonus: +500<br><br>Final score: <b>' + score + '</b><br>Best: ' + best;
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
      else { const step = Math.min(d, PLAYER_SPEED * dt); player.position.x += dx / d * step; player.position.z += dz / d * step; player.rotation.y = Math.atan2(dx, dz); moving = 1; }
    }
    collide(player.position, R); animateWalk(player, dt, Math.min(1, moving));
    stepTimer -= dt; if (moving && stepTimer <= 0) { sfx.step(); stepTimer = 0.28; }
    groanTimer -= dt; if (groanTimer <= 0) { groanTimer = 2 + Math.random() * 3; let close = 0; for (const z of zombies) if (z.position.distanceTo(player.position) < 9) close++; if (close) sfx.groan(); setMusicTension(close); }
    player.visible = invuln <= 0 || Math.sin(now * 0.03) > 0;

    // exit
    const pc = toCell(player.position.x, player.position.z, cols, rows);
    if (pc.cx === exitCell.cx && pc.cy === exitCell.cy) { clearDistrict(); return render(dt); }
    if (gate && !gate.open && switchCell && pc.cx === switchCell.cx && pc.cy === switchCell.cy) {
      gate.open = true; maze[gate.cy][gate.cx] = false; const oi = obstacles.indexOf(gate.obstacle); if (oi >= 0) obstacles.splice(oi, 1);
      gate.light.material.color.set(0x7dff6a); switchCell.lever.rotation.z = -0.6; flow = null; sfx.wave(); setTip('Gate open! Head for the safe zone.');
    }
    if (gate && gate.open && gateMesh.position.y > -1.3) gateMesh.position.y -= dt * 1.5;
    if (level === 1) {
      if (tipStage === 0 && !route.length) setTip('Tap the road to walk there, or drag a route.');
      if (tipStage === 0 && route.length) { tipStage = 1; setTip('Nice. Grab the pistol nearby: it fires by itself.'); }
      if (tipStage <= 1 && weapon) { tipStage = 2; setTip('Armed. Zombies turn any crowd they reach, so lead them away from people.'); }
      if (tipStage === 2 && time > 25) { tipStage = 3; setTip('Follow the green arrow to the safe zone.'); }
    } else if (gate && !gate.open && tipStage === 0) { tipStage = 1; setTip('The route is gated. Find the yellow switch to open it.'); }
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
      if (z.userData.hp <= 0) { scene.remove(z); zombies.splice(i, 1); pool.zom.push(z); kills++; score += 10; sfx.kill(); for (let k = 0; k < 5; k++) particle(z.position, puffMat); updateHud(); continue; }
      if (z.userData.stun > 0) { z.userData.stun -= dt; animateWalk(z, dt, 0); continue; }
      // follow flow field: head to the neighbouring cell with the lowest distance
      const c = toCell(z.position.x, z.position.z, cols, rows);
      const here = flow[c.cy * cols + c.cx];
      let tx = player.position.x, tz = player.position.z;
      if (here > 1) {
        let bestD = here, bx = c.cx, by = c.cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.cx + dx, ny = c.cy + dy; const d = flow[ny * cols + nx]; if (d >= 0 && d < bestD) { bestD = d; bx = nx; by = ny; } }
        const w = toWorld(bx, by, cols, rows); tx = w.x; tz = w.z;
      } else if (here < 0) { const w = toWorld(c.cx, c.cy, cols, rows); tx = w.x; tz = w.z; }
      tmp.set(tx - z.position.x, 0, tz - z.position.z); const dl = tmp.length(); if (dl > 0.001) tmp.divideScalar(dl);
      z.position.addScaledVector(tmp, z.userData.speed * dt);
      z.rotation.y = Math.atan2(tmp.x, tmp.z);
      for (const o of zombies) if (o !== z) { const dx = z.position.x - o.position.x, dz = z.position.z - o.position.z, dd = Math.hypot(dx, dz); if (dd < 0.45 && dd > 0.001) { z.position.x += dx / dd * (0.45 - dd) * 0.5; z.position.z += dz / dd * (0.45 - dd) * 0.5; } }
      collide(z.position, R * 0.8); animateWalk(z, dt, 1);
      if (z.userData.flash > 0) { z.userData.flash -= dt; z.position.y = 0.1; } else z.position.y = 0;
      // infect civilians
      for (const civ of civilians) if (Math.hypot(civ.position.x - z.position.x, civ.position.z - z.position.z) < 0.7) civ.userData.infect += dt * 2;
      // touch player
      if (invuln <= 0 && Math.hypot(z.position.x - player.position.x, z.position.z - player.position.z) < R * 2) { loseLife(); if (state !== 'play') return render(dt); }
    }
    // civilians turning
    for (let i = civilians.length - 1; i >= 0; i--) {
      const civ = civilians[i];
      if (civ.userData.infect > 0) { civ.userData.infect -= dt * 0.5; civ.position.y = Math.random() * 0.1; if (civ.userData.infect >= 1) { turnCivilian(civ); continue; } }
      else civ.position.y = 0;
      const u = civ.userData;
      if (u.goal) {
        const dx = u.goal.x - civ.position.x, dz = u.goal.z - civ.position.z, d = Math.hypot(dx, dz);
        if (d < 0.1) { u.goal = null; u.wait = 1.5 + Math.random() * 4; animateWalk(civ, dt, 0); }
        else { const st = Math.min(d, 1.1 * dt); civ.position.x += dx / d * st; civ.position.z += dz / d * st; civ.rotation.y = Math.atan2(dx, dz); collide(civ.position, 0.2); animateWalk(civ, dt, 0.5); }
      } else {
        u.wait -= dt; animateWalk(civ, dt, 0);
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
  if (city) city.updateRain(dt);
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
    const want = player.visible || state !== 'play' ? player.position : player.position;
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
      const e = toWorld(exitCell.cx, exitCell.cy, cols, rows);
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
window.__oo = { get chopper() { return chopper; }, get chopperT() { return chopperT; }, set chopperT(v) { chopperT = v; }, routeTo: (cx, cy) => setRouteTo(toWorld(cx, cy, cols, rows)), get civilians() { return civilians; }, get maze() { return maze; }, get player() { return player; }, get gate() { return gate; }, get switchCell() { return switchCell; }, get cols() { return cols; }, get rows() { return rows; }, toWorld: (cx, cy) => toWorld(cx, cy, cols, rows), get pickups() { return pickups; }, get zombies() { return zombies; }, get exit() { return toWorld(exitCell.cx, exitCell.cy, cols, rows); }, get state() { return state; } };
