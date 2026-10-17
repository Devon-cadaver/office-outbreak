import * as THREE from 'three';
import { makeCharacter, animateWalk, OUTFITS } from './characters.js';
import { generateMaze, buildCity, flowField, findPath, toWorld, toCell, CELL, mulberry32, NIGHT } from './city.js';
import { createInput } from './input.js';
import { unlockAudio, sfx } from './audio.js';

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(NIGHT.sky);
scene.fog = new THREE.Fog(NIGHT.sky, 70, 120);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0x9fd0c8, 0x1c3236, 1.35));
const sun = new THREE.DirectionalLight(0xbfe0ff, 0.7); sun.position.set(-6, 10, 8); scene.add(sun);

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
const PLAYER_SPEED = 6.5, R = 0.45;
const CIV_OUTFITS = ['vest', 'suit', 'hoodie', 'hivis', 'punk', 'worker'];
const WEAPONS = {
  pistol:  { name: 'Pistol',  ammo: 12, rate: 0.35, range: 9,  speed: 22, pellets: 1, dmg: 1, color: 0x333333 },
  shotgun: { name: 'Shotgun', ammo: 6,  rate: 0.7,  range: 7,  speed: 18, pellets: 4, dmg: 1, color: 0x7a4a1a },
  rifle:   { name: 'Rifle',   ammo: 20, rate: 0.18, range: 11, speed: 26, pellets: 1, dmg: 1, color: 0x2a3a2a },
};

// ---------- state ----------
let state = 'start', level = 1, score = 0, lives = 3, time = 0;
let maze = null, city = null, cols = 0, rows = 0, obstacles = [];
let startCell = null, exitCell = null, exitMesh = null;
const player = makeCharacter('worker'); scene.add(player); player.visible = false;
let civilians = [], zombies = [], pickups = [], projectiles = [], particles = [];
const pool = { civ: [], zom: [] };
let weapon = null, ammo = 0, fireTimer = 0, flow = null, flowTimer = 0, invuln = 0, totalPeople = 0, kills = 0;
// player route: list of [cx, cy] cells to walk through
let route = [], routeEndCell = null;
const markerGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 10), markerMat = new THREE.MeshBasicMaterial({ color: 0x7dff6a, transparent: true, opacity: 0.6 });
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

const projGeo = new THREE.BoxGeometry(0.18, 0.12, 0.45), projMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
const pickGeo = new THREE.BoxGeometry(0.9, 0.3, 0.3);
const puffGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3), puffMat = new THREE.MeshBasicMaterial({ color: 0x9fc58a });

// Isometric camera: 45 deg yaw, ~35 deg elevation, follows the player.
const CAM_YAW = Math.PI / 4, CAM_ELEV = 0.62;
const camDir = new THREE.Vector3(Math.sin(CAM_YAW) * Math.cos(CAM_ELEV), Math.sin(CAM_ELEV), Math.cos(CAM_YAW) * Math.cos(CAM_ELEV)).normalize();
const screenUp = new THREE.Vector2(-Math.sin(CAM_YAW), -Math.cos(CAM_YAW)), screenRight = new THREE.Vector2(Math.cos(CAM_YAW), -Math.sin(CAM_YAW));
const camTarget = new THREE.Vector3();
function fitCamera() {
  const aspect = innerWidth / innerHeight; camera.aspect = aspect;
  const half = aspect < 1 ? 9.5 / aspect * 0.85 : 10; // portrait: about 3 cells wide, more tall
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
  const grow = Math.min(4, n - 1) * 2;
  let c = (portrait ? 11 : 19) + grow, r = (portrait ? 21 : 11) + grow;
  if (c % 2 === 0) c++; if (r % 2 === 0) r++;
  cols = c; rows = r;
  const rng = mulberry32(n * 1337 + 42);
  maze = generateMaze(cols, rows, Math.floor(cols * rows * 0.06) + n * 2, rng);
  city = buildCity(scene, maze, n); obstacles = city.obstacles;
  startCell = { cx: 1, cy: rows - 2 }; exitCell = { cx: cols - 2, cy: 1 };

  // exit marker
  const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows);
  exitMesh = new THREE.Mesh(new THREE.BoxGeometry(CELL - 0.4, 0.12, CELL - 0.4), new THREE.MeshBasicMaterial({ color: 0x7dff6a }));
  exitMesh.position.set(ep.x, 0.06, ep.z); scene.add(exitMesh);

  // street cells excluding start/exit neighborhoods
  const streets = [];
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (!maze[y][x]) {
    const ds = Math.abs(x - startCell.cx) + Math.abs(y - startCell.cy), de = Math.abs(x - exitCell.cx) + Math.abs(y - exitCell.cy);
    if (ds > 3 && de > 2) streets.push({ x, y, ds, de });
  }
  const pick = (filter) => { const arr = streets.filter(filter); if (!arr.length) return null; const i = (rng() * arr.length) | 0; const s = arr[i]; streets.splice(streets.indexOf(s), 1); return s; };

  // crowds
  const crowdCount = 5 + n * 2; totalPeople = 0;
  for (let i = 0; i < crowdCount; i++) {
    const s = pick(() => true); if (!s) break;
    const w = toWorld(s.x, s.y, cols, rows); const size = 2 + ((rng() * 3) | 0);
    for (let k = 0; k < size; k++) {
      const civ = pool.civ.pop() || makeCharacter(CIV_OUTFITS[(rng() * CIV_OUTFITS.length) | 0]);
      civ.position.set(w.x + (rng() - 0.5) * 1.6, 0, w.z + (rng() - 0.5) * 1.6); civ.rotation.y = rng() * 6.28;
      civ.userData.infect = 0; civ.scale.setScalar(1.3); scene.add(civ); civilians.push(civ); totalPeople++;
    }
  }
  // starter zombies: far from player
  const zCount = 1 + Math.floor(n / 2);
  for (let i = 0; i < zCount; i++) { const s = pick((s) => s.ds > Math.max(cols, rows) * 0.6); if (s) spawnZombie(toWorld(s.x, s.y, cols, rows), n, rng); }
  // weapons
  const wCount = 2 + Math.floor(n / 2);
  const names = Object.keys(WEAPONS);
  for (let i = 0; i < wCount; i++) {
    const s = pick(() => true); if (!s) break;
    const type = names[Math.min(names.length - 1, (rng() * (n >= 3 ? 3 : 2)) | 0)];
    const w = toWorld(s.x, s.y, cols, rows);
    const mesh = new THREE.Mesh(pickGeo, new THREE.MeshLambertMaterial({ color: WEAPONS[type].color }));
    mesh.position.set(w.x, 0.6, w.z); scene.add(mesh); pickups.push({ mesh, type });
  }

  const sp = toWorld(startCell.cx, startCell.cy, cols, rows);
  player.position.set(sp.x, 0, sp.z); player.rotation.y = 0; player.visible = true; player.scale.setScalar(1.3);
  weapon = null; ammo = 0; flow = null; flowTimer = 0; invuln = 1; kills = 0; camTarget.copy(player.position); route = []; routeEndCell = null; showRoute();
  fitCamera(); updateHud();
}

function spawnZombie(pos, n, rng = Math.random) {
  const z = pool.zom.pop() || makeCharacter(CIV_OUTFITS[(rng() * CIV_OUTFITS.length) | 0], { zombie: true });
  z.position.set(pos.x, 0, pos.z); z.scale.setScalar(1.3);
  z.userData.hp = 2 + Math.floor(n / 3); z.userData.speed = 3.2 + n * 0.25 + rng() * 0.5; z.userData.flash = 0;
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
    const m = new THREE.Mesh(projGeo, projMat); m.position.copy(player.position); m.position.y = 1.1;
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
  ui.level.textContent = 'Duvallville ' + level;
  ui.people.textContent = 'People safe: ' + civilians.length + '/' + totalPeople;
  ui.weapon.textContent = weapon ? WEAPONS[weapon].name + ' x' + ammo : 'Unarmed';
}

function show(screen) { for (const s of [ui.start, ui.cleared, ui.over]) s.classList.add('hidden'); if (screen) screen.classList.remove('hidden'); ui.hud.classList.toggle('hidden', !!screen); }

function startRun() { unlockAudio(); level = 1; score = 0; lives = 3; time = 0; buildLevel(level); show(null); state = 'play'; }
function nextLevel() { level++; buildLevel(level); show(null); state = 'play'; }
function loseLife() {
  lives--; sfx.over(); invuln = 2;
  for (let i = 0; i < 8; i++) particle(player.position, projMat);
  if (lives <= 0) { state = 'over'; input.reset(); const best = Math.max(getBest(), score); setBest(best);
    ui.finalScore.textContent = 'Score: ' + score + '  ·  District ' + level; ui.finalBest.textContent = 'Best: ' + best; show(ui.over); return; }
  const sp = toWorld(startCell.cx, startCell.cy, cols, rows); player.position.set(sp.x, 0, sp.z); route = []; routeEndCell = null; showRoute();
  // push zombies back a bit so the respawn is fair
  for (const z of zombies) { const c = toCell(z.position.x, z.position.z, cols, rows); if (Math.abs(c.cx - startCell.cx) + Math.abs(c.cy - startCell.cy) < 6) z.userData.stun = 2.5; }
  updateHud();
}
function clearDistrict() {
  state = 'cleared'; input.reset(); sfx.wave();
  const saved = civilians.length, timeBonus = Math.max(0, 60 - Math.floor(time)) * 2;
  const gained = saved * 100 + kills * 10 + timeBonus; score += gained;
  ui.clearedText.innerHTML = `People saved: <b>${saved}/${totalPeople}</b> (+${saved * 100})<br>Zombies dropped: ${kills} (+${kills * 10})<br>Speed bonus: +${timeBonus}<br><br>Score: <b>${score}</b>`;
  show(ui.cleared); updateHud();
}
$('startBtn').addEventListener('click', startRun);
$('retryBtn').addEventListener('click', startRun);
$('nextBtn').addEventListener('click', nextLevel);

// ---------- loop ----------
const tmp = new THREE.Vector3();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;

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
    player.visible = invuln <= 0 || Math.sin(now * 0.03) > 0;

    // exit
    const pc = toCell(player.position.x, player.position.z, cols, rows);
    if (pc.cx === exitCell.cx && pc.cy === exitCell.cy) { clearDistrict(); return render(dt); }

    // flow field toward player, refreshed a few times per second
    if (flowTimer <= 0 || !flow) { flow = flowField(maze, pc.cx, pc.cy); flowTimer = 0.2; }

    // pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.mesh.rotation.y += dt * 2; p.mesh.position.y = 0.6 + Math.sin(now * 0.004) * 0.1;
      if (p.mesh.position.distanceTo(player.position) < 1) { weapon = p.type; ammo = WEAPONS[p.type].ammo; scene.remove(p.mesh); pickups.splice(i, 1); sfx.wave(); updateHud(); }
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
      for (const o of zombies) if (o !== z) { const dx = z.position.x - o.position.x, dz = z.position.z - o.position.z, dd = Math.hypot(dx, dz); if (dd < 0.7 && dd > 0.001) { z.position.x += dx / dd * (0.7 - dd) * 0.5; z.position.z += dz / dd * (0.7 - dd) * 0.5; } }
      collide(z.position, R * 0.8); animateWalk(z, dt, 1);
      if (z.userData.flash > 0) { z.userData.flash -= dt; z.position.y = 0.1; } else z.position.y = 0;
      // infect civilians
      for (const civ of civilians) if (Math.hypot(civ.position.x - z.position.x, civ.position.z - z.position.z) < 1.1) civ.userData.infect += dt * 2;
      // touch player
      if (invuln <= 0 && Math.hypot(z.position.x - player.position.x, z.position.z - player.position.z) < R * 2) { loseLife(); if (state !== 'play') return render(dt); }
    }
    // civilians turning
    for (let i = civilians.length - 1; i >= 0; i--) {
      const civ = civilians[i];
      if (civ.userData.infect > 0) { civ.userData.infect -= dt * 0.5; civ.position.y = Math.random() * 0.1; if (civ.userData.infect >= 1) { turnCivilian(civ); continue; } }
      else civ.position.y = 0;
      animateWalk(civ, dt, 0);
      // panic: civilians near a zombie face away and shuffle slightly (cheap flavour)
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
      const fade = towardCam > 0.5 && dist < 5.5 && Math.abs(dx * camDir.z - dz * camDir.x) < 2.6;
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
window.__oo = { get player() { return player; }, get pickups() { return pickups; }, get zombies() { return zombies; }, get exit() { return toWorld(exitCell.cx, exitCell.cy, cols, rows); }, get state() { return state; } };
