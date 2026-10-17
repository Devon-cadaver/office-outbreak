// Dead City Nights: a third-person, joystick take on Extraction: Dead City, running on the Zombieville engine.
// Survive three nights, collect spell books, reach the helipad at dawn. Kept deliberately small.
import * as THREE from 'three';
import { generateMaze, buildCity, flowField, toWorld, toCell, CELL, mulberry32, NIGHT } from '../city.js';
import { makeCharacter, animateWalk } from '../poster/characters.js';
import { createFires } from '../fire.js';
import { makeChopper, animateChopper } from '../chopper.js';
import { unlockAudio, sfx, startMusic, stopMusic, setMusicChase } from '../audio.js';
import { loadMap, decodeCustom } from '../tools.js';
import { rides } from '../landmarks.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene(); scene.background = new THREE.Color(NIGHT.sky); scene.fog = new THREE.Fog(NIGHT.sky, 30, 70);
const hemi = new THREE.HemisphereLight(0xb8e0d8, 0x2a4448, 1.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xd0e8ff, 0.9); sun.position.set(-6, 10, 8); scene.add(sun);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const isoCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200); let iso = false; const ISO_YAW = Math.PI / 4, ISO_ELEV = 0.72;
const isoDir = new THREE.Vector3(Math.sin(ISO_YAW) * Math.cos(ISO_ELEV), Math.sin(ISO_ELEV), Math.cos(ISO_YAW) * Math.cos(ISO_ELEV)).normalize();
const fx = createFires(scene);

// ---------- world ----------
let maze, cols, rows, city, obstacles = [], startCell, exitCell, flow = null, flowT = 0;
function buildWorld() {
  if (city) scene.remove(city.group);
  const custom = new URLSearchParams(location.search).get('custom') === '1' ? loadMap() : null;
  if (custom) { const dec = decodeCustom(custom); maze = dec.maze; cols = dec.cols; rows = dec.rows; startCell = dec.start; exitCell = dec.exit; }
  else {
    cols = 25; rows = 25; const rng = mulberry32(99); maze = generateMaze(cols, rows, 60, rng);
    const a = 13; for (let i = 1; i < cols - 1; i++) { maze[a][i] = false; maze[i][a] = false; } maze.avenues = { row: a, col: a };
    startCell = { cx: 1, cy: rows - 2 }; exitCell = { cx: cols - 2, cy: 1 };
  }
  if (!startCell) startCell = { cx: 1, cy: rows - 2 }; if (!exitCell) exitCell = { cx: cols - 2, cy: 1 };
  const have = maze.custom ? new Set(maze.custom.landmarks.values()) : new Set(); maze.extraLandmarks = ['base', 'cemetery', 'lab'].filter((k) => !have.has(k));
  city = buildCity(scene, maze, 3); obstacles = city.obstacles;
  for (const hz of city.hazards) { const c = toCell(hz.pos.x, hz.pos.z, cols, rows); maze[c.cy][c.cx] = false;
    const i = obstacles.findIndex((o) => Math.abs(o.x - hz.pos.x) < 0.01 && Math.abs(o.z - hz.pos.z) < 0.01 && o.hw > 1); if (i >= 0) obstacles.splice(i, 1);
    if (hz.type === 'base') obstacles.push({ x: hz.pos.x, z: hz.pos.z - 0.4, hw: 1.15, hd: 0.8 }); if (hz.type === 'lab') obstacles.push({ x: hz.pos.x, z: hz.pos.z - 0.3, hw: 1.15, hd: 0.9 });
    if (hz.type === 'gas') for (const dx of [-0.6, 0.6]) obstacles.push({ x: hz.pos.x + dx, z: hz.pos.z, hw: 0.2, hd: 0.15 }); }
  const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: 0x7dff3a, transparent: true, opacity: 0.35 })); pad.rotation.x = -Math.PI / 2; pad.position.set(ep.x, 0.03, ep.z); city.group.add(pad);
}
const poi = (type) => { const h = city.hazards.find((x) => x.type === type); return h ? h.pos : toWorld(startCell.cx, startCell.cy, cols, rows); };
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 10, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x7dff3a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); beacon.position.y = 5; beacon.visible = false; scene.add(beacon);
function collide(pos, r) { for (const o of obstacles) { const dx = pos.x - o.x, dz = pos.z - o.z; if (Math.abs(dx) > o.hw + r || Math.abs(dz) > o.hd + r) continue; const px = o.hw + r - Math.abs(dx), pz = o.hd + r - Math.abs(dz); if (px < pz) pos.x += Math.sign(dx || 1) * px; else pos.z += Math.sign(dz || 1) * pz; } }
const openCell = (c) => maze[c.cy]?.[c.cx] === false;
function collideCar(pos) { for (const o of obstacles) { const dx = pos.x - o.x, dz = pos.z - o.z; if (Math.abs(dx) > o.hw + 0.6 || Math.abs(dz) > o.hd + 0.6) continue; const px = o.hw + 0.6 - Math.abs(dx), pz = o.hd + 0.6 - Math.abs(dz); if (px < pz) pos.x += Math.sign(dx || 1) * px; else pos.z += Math.sign(dz || 1) * pz; } }
function lineClear(a, b) { const n = Math.ceil(a.distanceTo(b) / 0.8); for (let i = 1; i < n; i++) { const t = i / n; if (!openCell(toCell(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, cols, rows))) return false; } return true; }
function randomOpen(minDist) { for (let k = 0; k < 200; k++) { const c = { cx: 1 + ((Math.random() * (cols - 2)) | 0), cy: 1 + ((Math.random() * (rows - 2)) | 0) }; if (!openCell(c)) continue; const w = toWorld(c.cx, c.cy, cols, rows); if (Math.hypot(w.x - player.position.x, w.z - player.position.z) >= minDist) return w; } return toWorld(startCell.cx, startCell.cy, cols, rows); }

// ---------- player, camera, controls ----------
const SCALE = 0.32; const player = makeCharacter('hoodie'); player.scale.setScalar(SCALE); scene.add(player);
let hp = 100, invuln = 0, yaw = 0, camYaw = 0, state = 'start', driving = false, car = null, carHp = 5;
const VEH = { car: { hp: 5, speed: 6, burn: 3.5, name: 'Car' }, van: { hp: 8, speed: 5.2, burn: 4.5, name: 'Van' }, truck: { hp: 10, speed: 4.6, burn: 5.5, name: 'Truck' }, tank: { hp: 25, speed: 3.4, burn: 7, name: 'Tank' } };
const vstat = () => VEH[(car && car.userData.kind) || 'car'];
function vehState(c) { const u = c.userData; if (u.fuel == null) { u.fuel = 35 + Math.random() * 45; u.hp = VEH[u.kind || 'car'].hp; u.keys = u.kind !== 'tank'; } return u; }
let outOfGasSaid = false;
function enterCar(c) { const u = vehState(c); if (!u.keys) { openGame('keys', c); return; } car = c; driving = true; carHp = u.hp; player.visible = false; outOfGasSaid = false; const wp = c.userData.worldPos().clone(); const pr = c.userData.prop; if (!pr.detached) { pr.g.remove(c); scene.add(c); c.position.set(wp.x, 0, wp.z); pr.knocked = true; pr.detached = true; pr.t = 1; c.userData.worldPos = () => c.position; } if (pr.ob) { const i = obstacles.indexOf(pr.ob); if (i >= 0) obstacles.splice(i, 1); } yaw = car.rotation.y; say(VEH[u.kind || 'car'].name + ': ' + Math.round(u.fuel) + '% fuel. Double-tap to get out.'); sfx.pickup(); }
function leaveCar() { if (!car) return; car.userData.hp = carHp; driving = false; player.visible = true; player.position.set(car.position.x + Math.cos(yaw) * 1.2, 0, car.position.z - Math.sin(yaw) * 1.2); collide(player.position, 0.25); if (carHp <= 0) car.userData.wrecked = true; car = null; }
const stick = { x: 0, y: 0, id: null, cx: 0, cy: 0 }; const look = { id: null, lx: 0 };
const knob = $('dcKnob'), stickEl = $('dcStick');
addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; if (state !== 'play') return; if (e.clientX < innerWidth / 2 && stick.id === null) { stick.id = e.pointerId; stick.cx = e.clientX; stick.cy = e.clientY; stickEl.style.left = (e.clientX - 65) + 'px'; stickEl.style.top = (e.clientY - 65) + 'px'; stickEl.style.bottom = 'auto'; } else if (look.id === null) { look.id = e.pointerId; look.lx = e.clientX; } });
addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) { const dx = e.clientX - stick.cx, dy = e.clientY - stick.cy; const d = Math.hypot(dx, dy) || 1, m = Math.min(d, 55); stick.x = dx / d * m / 55; stick.y = dy / d * m / 55; knob.style.transform = 'translate(calc(-50% + ' + (stick.x * 40) + 'px), calc(-50% + ' + (stick.y * 40) + 'px))'; } if (e.pointerId === look.id) { camYaw -= (e.clientX - look.lx) * 0.008; look.lx = e.clientX; } });
let lastTap = 0, lastTapX = 0, lastTapY = 0;
addEventListener('pointerdown', (e) => { if (e.target.closest('button') || state !== 'play') return; const now = performance.now(); if (now - lastTap < 350 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 30) { lastTap = 0; const nearRide = !driving && !riding && rides.find((rr) => Math.hypot(rr.pos.x - player.position.x, rr.pos.z - player.position.z) < 3.4); if (nearRide) { openGame('ride', nearRide); return; }
    if (driving) { const g = city.hazards.find((x) => x.type === 'gas'); if (g && Math.hypot(g.pos.x - car.position.x, g.pos.z - car.position.z) < 4) openGame('pump', car); else leaveCar(); } else { let best = null, bd = 2.2; for (const c of city.cars) { if (c.userData.wrecked || (c.userData.prop.knocked && !c.userData.prop.detached)) continue; const wp = c.userData.worldPos(); const d = Math.hypot(wp.x - player.position.x, wp.z - player.position.z); if (d < bd) { bd = d; best = c; } } if (best) enterCar(best); else say('No car close enough.'); } } else { lastTap = now; lastTapX = e.clientX; lastTapY = e.clientY; } });
const release = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; knob.style.transform = 'translate(-50%, -50%)'; } if (e.pointerId === look.id) look.id = null; };
addEventListener('pointerup', release); addEventListener('pointercancel', release);
// keyboard for the PC crowd
const keys = {}; addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (['1', '2', '3'].includes(e.key)) castSlot(+e.key - 1); if (e.key === ' ') throwTrash(); }); addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// ---------- zombies ----------
const zombies = [], pool = [];
function spawnZombie(pos, strong) { const z = pool.pop() || makeCharacter(['worker', 'vest', 'suit', 'punk'][(Math.random() * 4) | 0], { zombie: true }); z.position.set(pos.x, 0, pos.z); z.scale.setScalar(SCALE); z.rotation.set(0, 0, 0); Object.assign(z.userData, { hp: strong ? 5 : 3, speed: 1.9 + Math.random() * 0.6 + night * 0.25, rag: null, stun: 0, slow: 0, poison: 0, alert: 0 }); scene.add(z); zombies.push(z); return z; }
function killZombie(i) { const z = zombies[i]; scene.remove(z); zombies.splice(i, 1); pool.push(z); kills++; sfx.kill(); }
function fling(z, dir, power) { const d = Math.hypot(dir.x, dir.z) || 1; z.userData.rag = { vel: new THREE.Vector3(dir.x / d * power, 5, dir.z / d * power), t: 0 }; }
function updateZombies(dt) {
  if (flowT <= 0 || !flow) { const pc = toCell(player.position.x, player.position.z, cols, rows); flow = flowField(maze, pc.cx, pc.cy); flowT = 0.25; } flowT -= dt;
  let hunted = false;
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i], u = z.userData;
    if (u.rag) { u.rag.t += dt; u.rag.vel.y -= 16 * dt; z.position.addScaledVector(u.rag.vel, dt); z.rotation.x += dt * 9; if (z.position.y <= 0 && u.rag.t > 0.3) killZombie(i); continue; }
    if (u.poison > 0) { u.poison -= dt; u.hp -= dt * 0.8; }
    if (u.hp <= 0) { killZombie(i); continue; }
    if (u.stun > 0) { u.stun -= dt; animateWalk(z, dt, 0); continue; }
    u.slow = Math.max(0, u.slow - dt);
    const d = z.position.distanceTo(player.position);
    if (d < 16 && lineClear(z.position, player.position)) u.alert = 6; u.alert -= dt; if (u.alert > 0) hunted = true;
    let tx, tz, mul = u.alert > 0 ? 1 : 0.45;
    if (u.alert > 0 && d > 1) {
      const c = toCell(z.position.x, z.position.z, cols, rows); let best = flow[c.cy * cols + c.cx], bx = c.cx, by = c.cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = flow[(c.cy + dy) * cols + c.cx + dx]; if (v >= 0 && v < best) { best = v; bx = c.cx + dx; by = c.cy + dy; } }
      if (best <= 1) { tx = player.position.x; tz = player.position.z; } else { const w = toWorld(bx, by, cols, rows); tx = w.x; tz = w.z; }
    } else { if (!u.wander || Math.random() < dt * 0.3) { const c = toCell(z.position.x, z.position.z, cols, rows); const n = { cx: c.cx + ((Math.random() * 5) | 0) - 2, cy: c.cy + ((Math.random() * 5) | 0) - 2 }; u.wander = toWorld(openCell(n) ? n.cx : c.cx, openCell(n) ? n.cy : c.cy, cols, rows); } tx = u.wander.x; tz = u.wander.z; }
    const dx = tx - z.position.x, dz = tz - z.position.z, dl = Math.hypot(dx, dz);
    if (dl > 0.05) { const sp = u.speed * mul * (u.slow > 0 ? 0.4 : 1) * dt; z.position.x += dx / dl * sp; z.position.z += dz / dl * sp; z.rotation.y = Math.atan2(dx, dz); }
    for (const o of zombies) if (o !== z) { const ox = z.position.x - o.position.x, oz = z.position.z - o.position.z, od = Math.hypot(ox, oz); if (od < 0.5 && od > 0.001) { z.position.x += ox / od * (0.5 - od) * 0.5; z.position.z += oz / od * (0.5 - od) * 0.5; } }
    collide(z.position, 0.22); animateWalk(z, dt, mul);
    if (driving && d < 1.2 && !u.rag) { fling(z, { x: z.position.x - player.position.x, z: z.position.z - player.position.z }, 8); if (!carArmor || Math.random() < 0.5) carHp--; sfx.hit(); if (carHp <= 0) { fx.ignite(new THREE.Vector3(car.position.x, 0.6, car.position.z), 0.9); say('The car is done!'); leaveCar(); } continue; }
    if (u.latch > 0) { u.latch -= dt; const dir = player.position.clone().sub(z.position).setY(0).normalize(); z.position.copy(player.position).addScaledVector(dir, -0.42); z.rotation.y = Math.atan2(dir.x, dir.z); u.armL.rotation.x = u.armR.rotation.x = -1.6; if (u.latch <= 0) { u.stun = 0.7; z.position.addScaledVector(dir, -0.9); collide(z.position, 0.22); } continue; }
    for (let k = survivors.length - 1; k >= 0; k--) { const s = survivors[k]; if (z.position.distanceTo(s.position) < 0.45) { scene.remove(s); survivors.splice(k, 1); say('A survivor was lost.'); sfx.hurt(); } }
    if (riding) continue;
    if (d < 0.45 && invuln <= 0) { u.latch = 0.7; hp -= 20; invuln = 1; sfx.hurt(); $('hp2').style.width = Math.max(0, hp / maxHp * 100) + '%'; if (hp <= 0) return gameOver(false); }
  }
  setMusicChase(hunted);
}

// ---------- spells, books, trash ----------
const SPELLS = {
  hellfire: { name: 'HELLFIRE', cd: 1.4, cast() { const dir = facing(); const p = player.position.clone().addScaledVector(dir, 1); const ball = { pos: p, vel: dir.multiplyScalar(14), t: 0 }; fireballs.push(ball); sfx.throw(); } },
  beam: { name: 'BEAM', cd: 1.1, cast() { const dir = facing(); for (let i = zombies.length - 1; i >= 0; i--) { const z = zombies[i]; const rel = z.position.clone().sub(player.position); const along = rel.dot(dir); if (along > 0 && along < 20 && rel.clone().addScaledVector(dir, -along).length() < 1) { z.userData.hp -= 4; } } flash(0x9a5fff); sfx.wave(); } },
  repulse: { name: 'REPULSE', cd: 2.0, cast() { for (const z of zombies) if (z.position.distanceTo(player.position) < 6 && !z.userData.rag) fling(z, { x: z.position.x - player.position.x, z: z.position.z - player.position.z }, 9); flash(0x7dff3a); sfx.boom(); } },
  entomb: { name: 'ENTOMB', cd: 2.4, cast() { for (const z of zombies) if (z.position.distanceTo(player.position) < 7) z.userData.stun = 4; flash(0xd0d0ff); sfx.hit(); } },
  wrath: { name: 'WRATH', cd: 1.6, cast() { let best = null, bd = 12; for (const z of zombies) { const d = z.position.distanceTo(player.position); if (d < bd) { bd = d; best = z; } } if (!best) return; fx.explode(best.position, 0.8); for (const z of zombies) if (z.position.distanceTo(best.position) < 4) z.userData.hp -= 4; sfx.boom(); } },
  maelstrom: { name: 'MAELSTROM', cd: 3.0, cast() { const c = player.position.clone().addScaledVector(facing(), 5); for (const z of zombies) if (z.position.distanceTo(c) < 7 && !z.userData.rag) fling(z, { x: c.x - z.position.x, z: c.z - z.position.z }, 6); flash(0x3fdfff); sfx.whoosh(); } },
  pestilence: { name: 'PESTILENCE', cd: 1.6, cast() { const c = player.position.clone().addScaledVector(facing(), 4); for (const z of zombies) if (z.position.distanceTo(c) < 4) z.userData.poison = 5; fx.ignite(new THREE.Vector3(c.x, 0.2, c.z), 0.7, 4); sfx.hurt(); } },
  diminish: { name: 'DIMINISH', cd: 2.2, cast() { for (const z of zombies) if (z.position.distanceTo(player.position) < 8) z.userData.slow = 6; flash(0xffd24a); sfx.hit(); } },
};
const slots = [null, null, null], cds = [0, 0, 0]; let trashCd = 0, kills = 0, booksFound = 0;
const books = []; const bookGeo = new THREE.BoxGeometry(0.5, 0.12, 0.7), bookMat = new THREE.MeshBasicMaterial({ color: 0xc06cff });
function placeBooks() { for (const b of books) scene.remove(b.mesh); books.length = 0; for (const key of Object.keys(SPELLS)) { const w = randomOpen(8); const mesh = new THREE.Mesh(bookGeo, bookMat); mesh.position.set(w.x, 0.5, w.z); scene.add(mesh); books.push({ mesh, key }); } }
function facing() { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }
const flashMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(flashMesh); let flashT = 0;
function flash(color) { flashMesh.material.color.set(color); flashT = 0.3; }
function castSlot(i) { const key = slots[i]; if (!key || cds[i] > 0 || state !== 'play') return; SPELLS[key].cast(); cds[i] = SPELLS[key].cd * cdMul; }
const fireballs = [], junk = []; const junkGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2), junkMat = new THREE.MeshLambertMaterial({ color: 0x3fbf4a }), fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
function segDist(a, b, p) { const ab = b.clone().sub(a), ap = p.clone().sub(a); const t = Math.max(0, Math.min(1, ap.dot(ab) / (ab.lengthSq() || 1))); return a.clone().addScaledVector(ab, t).setY(p.y).distanceTo(p); }
let trashDmg = 1;
function throwTrash() { if (trashCd > 0 || state !== 'play') return;
  if (driving && car.userData.kind === 'tank') { trashCd = 1.2; const dir = facing(); const p = car.position.clone().addScaledVector(dir, 1.4); fireballs.push({ pos: p, vel: dir.multiplyScalar(16), t: 0, shell: true }); sfx.boom(); return; }
  trashCd = 0.45; let dir = facing(); let best = null, bd = 9; for (const z of zombies) { const d = z.position.distanceTo(player.position); if (d < bd && lineClear(player.position, z.position)) { bd = d; best = z; } } if (best) dir = best.position.clone().sub(player.position).setY(0).normalize(); const m = new THREE.Mesh(junkGeo, junkMat); m.position.copy(player.position).setY(0.9); scene.add(m); junk.push({ mesh: m, vel: dir.multiplyScalar(16), t: 0 }); sfx.throw(); }
function updateShots(dt) {
  for (let i = junk.length - 1; i >= 0; i--) { const j = junk[i]; j.mesh.position.addScaledVector(j.vel, dt); j.t += dt; j.mesh.rotation.x += dt * 10; let dead = j.t > 0.8 || !openCell(toCell(j.mesh.position.x, j.mesh.position.z, cols, rows)); const prev = j.mesh.position.clone().addScaledVector(j.vel, -dt); for (const z of zombies) if (!dead && segDist(prev, j.mesh.position, z.position) < 0.5) { z.userData.hp -= trashDmg; z.userData.alert = 6; z.userData.stun = Math.max(z.userData.stun, 0.25); dead = true; } if (dead) { scene.remove(j.mesh); junk.splice(i, 1); } }
  for (let i = fireballs.length - 1; i >= 0; i--) { const f = fireballs[i]; f.t += dt; f.pos.addScaledVector(f.vel, dt); if (!f.mesh) { f.mesh = new THREE.Mesh(junkGeo, fireMat); f.mesh.scale.setScalar(f.shell ? 2.4 : 1.6); scene.add(f.mesh); } f.mesh.position.copy(f.pos).setY(0.9); let hit = f.t > 0.7 || !openCell(toCell(f.pos.x, f.pos.z, cols, rows)); const fprev = f.pos.clone().addScaledVector(f.vel, -dt); for (const z of zombies) if (segDist(fprev, f.pos, z.position) < 0.8) hit = true; if (hit) { fx.explode(f.pos, f.shell ? 1.4 : 0.9); if (f.shell) city.knock(f.pos.x, f.pos.z, 2.2, f.vel.x, f.vel.z); for (const z of zombies) if (z.position.distanceTo(f.pos) < (f.shell ? 3.2 : 2.5)) { z.userData.hp -= f.shell ? 6 : 3; if (!z.userData.rag) fling(z, { x: z.position.x - f.pos.x, z: z.position.z - f.pos.z }, 4); } sfx.boom(); scene.remove(f.mesh); fireballs.splice(i, 1); } }
}
function updateActs() { for (let i = 0; i < 3; i++) { const b = document.querySelector('[data-slot="' + i + '"]'); const key = slots[i]; b.textContent = key ? SPELLS[key].name : '—'; b.classList.toggle('empty', !key); b.style.opacity = key && cds[i] > 0 ? 0.5 : ''; } $('trash').style.opacity = trashCd > 0 ? 0.5 : ''; }
document.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); castSlot(+b.dataset.slot); }));
$('trash').addEventListener('pointerdown', (e) => { e.stopPropagation(); throwTrash(); });

// ---------- nights ----------
const DAY = 55, NIGHT_LEN = 45, NIGHTS = 6;
// ---------- the base computer and the night missions (Dead City's six, simplified) ----------
const MISSIONS = [
  { title: 'RESCUE', brief: 'Find two survivors and bring them to the base.', kind: 'rescue', need: 2, reward: 'Max health +20', apply() { maxHp += 20; hp += 20; } },
  { title: 'POWER', brief: 'Restart the generator at the gas station and bring back the fuel can.', kind: 'fetch', at: 'gas', item: 'Fuel can', game: 'power', reward: 'Trash hits harder', apply() { trashDmg += 1; } },
  { title: 'WATER', brief: 'Prime the pump at the water station and bring back the valve.', kind: 'fetch', at: 'slime', item: 'Pump valve', game: 'water', reward: 'Spells recharge faster', apply() { cdMul = 0.7; } },
  { title: 'SUPPLIES', brief: 'Collect three crates from the market.', kind: 'collect', at: 'school', need: 3, item: 'Supply crate', reward: 'Max health +30', apply() { maxHp += 30; hp += 30; } },
  { title: 'CEMETERY', brief: 'Seal the three crypts. Stand by each one.', kind: 'seal', at: 'cemetery', need: 3, reward: 'Car armour', apply() { carArmor = true; } },
  { title: 'LABORATORY', brief: 'Bring the antidote back from the lab.', kind: 'fetch', at: 'lab', item: 'Antidote', reward: 'The chopper is on its way', apply() {} },
];
let mission = null, mIndex = 0, mCount = 0, mCarry = null, maxHp = 100, cdMul = 1, carArmor = false, rescued = 0, sealT = 0;
const survivors = [], crates = []; const crateGeo = new THREE.BoxGeometry(0.45, 0.4, 0.45), crateMat = new THREE.MeshLambertMaterial({ color: 0xd8a24a });
function placeSurvivors() { for (const s of survivors) scene.remove(s); survivors.length = 0; for (let i = 0; i < 5; i++) { const s = makeCharacter(['worker', 'pink', 'plaid', 'hivis', 'suit'][i]); s.scale.setScalar(SCALE); const w = randomOpen(10); s.position.set(w.x, 0, w.z); s.userData.follow = false; scene.add(s); survivors.push(s); } }
function startMission(i) {
  mission = MISSIONS[i] || null; mCount = 0; mCarry = null; for (const c of crates) scene.remove(c); crates.length = 0; if (!mission) { beacon.visible = false; return; }
  if (mission.kind === 'fetch') { const p = poi(mission.at); const c = new THREE.Mesh(crateGeo, crateMat); c.position.set(p.x + 1.9, 0.2, p.z + 1.2); scene.add(c); crates.push(c); }
  if (mission.kind === 'collect') { const p = poi(mission.at); for (let k = 0; k < mission.need; k++) { const c = new THREE.Mesh(crateGeo, crateMat); const a = k * 2.1; c.position.set(p.x + Math.cos(a) * 2.2, 0.2, p.z + Math.sin(a) * 2.2); scene.add(c); crates.push(c); } }
  say('Mission: ' + mission.title + '. ' + mission.brief); $('mission').textContent = mission.title + ': ' + mission.brief;
}
function completeMission() { say('Mission complete! ' + mission.reward); mission.apply(); sfx.wave(); mIndex++; $('hp2').style.width = (hp / maxHp * 100) + '%'; startMission(mIndex); }
function updateMissions(dt) {
  const base = poi('base'); const nearBase = Math.hypot(player.position.x - base.x, player.position.z - base.z) < 2.6;
  // survivors: walk up to recruit, lead them home
  for (let i = survivors.length - 1; i >= 0; i--) { const s = survivors[i]; const d = s.position.distanceTo(player.position);
    if (!s.userData.follow && d < 1.0) { s.userData.follow = true; say('Survivor: "Get me out of here!"'); sfx.pickup(); }
    if (s.userData.follow) { const lead = i > 0 && survivors[i - 1].userData.follow ? survivors[i - 1].position : player.position; const dx = lead.x - s.position.x, dz = lead.z - s.position.z, dl = Math.hypot(dx, dz); if (dl > 0.8) { s.position.x += dx / dl * 3.6 * dt; s.position.z += dz / dl * 3.6 * dt; s.rotation.y = Math.atan2(dx, dz); collide(s.position, 0.2); animateWalk(s, dt, 1); } else animateWalk(s, dt, 0);
      if (Math.hypot(s.position.x - base.x, s.position.z - base.z) < 2.6) { scene.remove(s); survivors.splice(i, 1); rescued++; if (mission && mission.kind === 'rescue') mCount++; say('Survivor safe at the base. ' + rescued + ' rescued.'); sfx.pickup(); } }
    else animateWalk(s, dt, 0); }
  if (!mission) return;
  let target = base;
  if (mission.kind === 'rescue') { if (mCount >= mission.need) completeMission(); else { const s = survivors.find((x) => !x.userData.follow); target = survivors.some((x) => x.userData.follow) ? base : s ? s.position : base; } }
  else if (mission.kind === 'fetch' || mission.kind === 'collect') {
    for (let i = crates.length - 1; i >= 0; i--) { const c = crates[i]; c.rotation.y += dt; if (c.position.distanceTo(player.position) < 0.9) {
      if (mission.game && !c.done) { if (!game) openGame(mission.game, c); continue; } // power and water: beat the mini-game first (the game marks the crate done)
      scene.remove(c); crates.splice(i, 1); mCarry = mission.item; if (!mission.game) mCount++; say('Got the ' + mission.item.toLowerCase() + '. Back to the base.'); sfx.pickup(); } }
    const done = mission.kind === 'fetch' ? mCount >= 1 : mCount >= mission.need;
    if (done && nearBase) completeMission(); else target = crates.length && !(mission.kind === 'fetch' && mCount) ? crates[0].position : base;
  }
  else if (mission.kind === 'seal') { const p = poi(mission.at); const cr = [[-0.9, -0.9], [0, -0.9], [0.9, -0.9]]; const k = mCount; if (k >= mission.need) { if (nearBase) completeMission(); target = base; } else { const cx = p.x + cr[k][0], cz = p.z + cr[k][1] - 1.2; target = new THREE.Vector3(cx, 0, cz); if (Math.hypot(player.position.x - cx, player.position.z - cz) < 1.4) { sealT += dt; if (sealT > 2) { sealT = 0; mCount++; say('Crypt sealed ' + mCount + '/3'); sfx.hit(); for (let q = 0; q < 3; q++) spawnZombie({ x: p.x + (Math.random() - 0.5) * 2, z: p.z + 2.2 }, true); } } else sealT = 0; } }
  beacon.visible = true; beacon.position.set(target.x, 5, target.z);
}
let night = 0, clock = 0, isNight = false, chopper = null, chopperT = 0, extracting = false, spawnT = 0;
function updateNights(dt) {
  clock += dt;
  if (!isNight && clock > DAY) { if (night >= NIGHTS && mIndex >= MISSIONS.length) { if (!chopper) { chopper = makeChopper(); chopper.scale.setScalar(0.6); const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows); chopper.position.set(ep.x, 14, ep.z); scene.add(chopper); say('Dawn. The chopper is at the helipad!'); } } else { isNight = true; night++; clock = 0; say('Night ' + night + ' falls. They are coming.'); sfx.wave(); } }
  if (isNight && clock > NIGHT_LEN) { isNight = false; clock = 0; say('You made it to morning.'); sfx.pickup(); }
  const dark = isNight ? Math.min(1, clock / 6) : Math.max(0, 1 - clock / 6);
  hemi.intensity = 1.7 - dark * 1.1; sun.intensity = 0.9 - dark * 0.6; const fogFar = iso ? 50 : 0; scene.fog.near = fogFar + 30 - dark * 14; scene.fog.far = fogFar + 70 - dark * 30;
  spawnT -= dt; const cap = isNight ? 10 + night * 8 : 5; if (spawnT <= 0 && zombies.length < cap) { spawnT = isNight ? 1.4 : 5; const cem = poi('cemetery'); const fromGrave = isNight && Math.random() < 0.5; spawnZombie(fromGrave ? { x: cem.x + (Math.random() - 0.5) * 3, z: cem.z + 2.2 } : randomOpen(14), night >= 3); }
  $('night').textContent = (isNight ? 'Night ' : 'Day after night ') + night + ' / ' + NIGHTS; $('veh').textContent = driving ? vstat().name + ' ♥' + carHp + ' ⛽' + Math.round(car.userData.fuel) + '%' : ''; $('clock').textContent = isNight ? ((NIGHT_LEN - clock) | 0) + ' s to dawn' : night >= NIGHTS ? 'Get to the helipad' : ((DAY - clock) | 0) + ' s of daylight';
  if (chopper) { chopperT += dt; animateChopper(chopper, dt, chopperT); const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows); chopper.position.y = Math.max(1.1, 14 - chopperT * 4); if (!extracting && Math.hypot(player.position.x - ep.x, player.position.z - ep.z) < 1.5 && chopper.position.y <= 1.2) { extracting = true; chopperT = 0; } if (extracting) { chopper.position.y = 1.1 + chopperT * chopperT * 2; player.position.set(ep.x, chopper.position.y - 0.6, ep.z); if (chopperT > 3) gameOver(true); } }
}
// ---------- mini-games: PUMP (tap to fill a leaking meter) and KEYS (hit the needle in the zone three times) ----------
let game = null;
function openGame(mode, veh) { game = { mode, veh, fill: 0, time: 8, t: 0, hits: 0, zoneC: 0.5, zoneW: 0.26, speed: 2.4 }; state = 'game'; $('dcGame').classList.remove('hidden'); $('gTitle').textContent = { pump: 'GAS PUMP', keys: 'FIND THE KEYS', ride: 'RIDE OPERATOR', power: 'POWER STATION', water: 'WATER PUMP' }[mode]; $('gText').textContent = { pump: 'Tap PUMP fast. The hose leaks, so keep going until the tank is full.', keys: 'Hotwire it: tap when the needle is in the green. Three good hits.', ride: 'Start the motor: tap when the needle is in the green. Three good hits.', power: 'Sync the generator: tap when the needle is in the green. Three good hits.', water: 'Prime the pump: tap fast until the pressure is full.' }[mode]; const needle = mode !== 'pump' && mode !== 'water'; $('gHit').textContent = needle ? 'HIT' : 'PUMP'; $('gZone').style.display = needle ? '' : 'none'; $('gNeedle').style.display = needle ? '' : 'none'; $('gFill').style.width = '0%'; game.needle = needle; if (needle) placeZone(); }
function placeZone() { game.zoneC = 0.2 + Math.random() * 0.6; $('gZone').style.left = ((game.zoneC - game.zoneW / 2) * 100) + '%'; $('gZone').style.width = (game.zoneW * 100) + '%'; }
function closeGame() { $('dcGame').classList.add('hidden'); game = null; if (state === 'game') state = 'play'; }
function updateGame(dt) { if (!game.needle) { game.time -= dt; game.fill = Math.max(0, game.fill - dt * 0.25); $('gFill').style.width = (game.fill * 100) + '%'; $('gText').textContent = Math.max(0, game.time).toFixed(1) + ' s left'; if (game.time <= 0) { game.time = 8; game.fill = 0; sfx.hit(); } } else { game.t += dt * game.speed; game.pos = 0.5 + 0.5 * Math.sin(game.t); $('gNeedle').style.left = (game.pos * 100) + '%'; } }
$('gHit').addEventListener('click', () => { if (!game || game.done) return;
  if (!game.needle) { game.fill += 0.1; sfx.throw(); if (game.fill >= 1) { game.done = true; gameWon(); } }
  else if (Math.abs(game.pos - game.zoneC) < game.zoneW / 2) { game.hits++; sfx.pickup(); $('gFill').style.width = (game.hits / 3 * 100) + '%'; if (game.hits >= 3) { game.done = true; gameWon(); } else { game.speed += 0.8; game.zoneW = Math.max(0.14, game.zoneW - 0.05); placeZone(); } }
  else { game.hits = 0; sfx.hit(); $('gFill').style.width = '0%'; } });
function gameWon() { sfx.wave(); const g = game; setTimeout(() => { closeGame();
  if (g.mode === 'pump') { g.veh.userData.fuel = 100; say('Tank full.'); }
  else if (g.mode === 'keys') { g.veh.userData.keys = true; say('Got the keys!'); enterCar(g.veh); }
  else if (g.mode === 'ride') startRide(g.veh);
  else { mCount++; g.veh.done = true; say('Done. Back to the base.'); } }, 450); }
$('gClose').addEventListener('click', closeGame);
// ---------- fairground rides: three spins, zombies swarm the ride and get flung ----------
let riding = null;
function startRide(ride) { riding = { ride, ang: 0, back: player.position.clone(), hits: 0 }; ride.speed = ride.type === 'coaster' ? 6 : ride.type === 'carousel' ? 5 : 4; if (driving) leaveCar(); say('Three spins. Hold on!'); sfx.pickup(); }
function updateRide(dt) {
  const ride = riding.ride; let done = 0; const pu = player.userData;
  if (ride.type === 'ferris') { const w = ride.wheel; riding.ang += dt * 0.35 * ride.speed; done = Math.floor(riding.ang / (Math.PI * 2)); const a = w.rotation.z; w.updateWorldMatrix(true, false); const p = w.localToWorld(new THREE.Vector3(Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0)); player.position.set(p.x, p.y - 0.3, p.z + 0.1); }
  else if (ride.type === 'coaster') { riding.ang += dt * 0.05 * ride.speed; done = Math.floor(riding.ang); const p = ride.curve.getPointAt(ride.u), t = ride.curve.getTangentAt(ride.u); player.position.set(p.x, p.y + 0.02, p.z); player.rotation.y = Math.atan2(t.x, t.z); }
  else { const pl = ride.platform; riding.ang += dt * 0.3 * ride.speed; done = Math.floor(riding.ang / (Math.PI * 2)); pl.updateWorldMatrix(true, false); const p = ride.horses[0].getWorldPosition(new THREE.Vector3()); player.position.set(p.x, p.y - 0.1, p.z); }
  animateWalk(player, dt, 0); pu.legL.rotation.x = pu.legR.rotation.x = -1.4;
  for (const z of zombies) { if (z.userData.rag) continue; z.userData.alert = 6; const dx = z.position.x - ride.pos.x, dz = z.position.z - ride.pos.z; if (Math.hypot(dx, dz) < 2.1) { fling(z, { x: dx, z: dz }, 8); riding.hits++; } }
  const exiting = done >= 3; say(exiting ? 'Exiting' : 'Spin ' + (done + 1) + '/3'); if (exiting) ride.speed = Math.max(1, ride.speed - dt * 3);
  if (exiting && ride.speed <= 1) { player.position.copy(riding.back); player.position.y = 0; invuln = 1.5; say(riding.hits ? 'Strike! ' + riding.hits + ' flung.' : 'Fun ride.'); riding = null; }
}
let msgT = 0; function say(t) { $('msg').textContent = t; msgT = 3; }

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'game' && game) updateGame(dt);
  if (state === 'play') {
    invuln -= dt; trashCd -= dt; for (let i = 0; i < 3; i++) cds[i] -= dt; msgT -= dt; if (msgT <= 0) $('msg').textContent = '';
    // movement: stick is camera-relative
    let mx = stick.x + (keys.d ? 1 : 0) - (keys.a ? 1 : 0), my = stick.y + (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag > 0.08 && !extracting && !riding) {
      const cy = iso ? ISO_YAW + Math.PI : camYaw; const fwd = new THREE.Vector3(Math.sin(cy), 0, Math.cos(cy)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const dir = fwd.multiplyScalar(-my).add(right.multiplyScalar(mx)).normalize(); yaw = Math.atan2(dir.x, dir.z);
      const held = zombies.some((z) => z.userData.latch > 0) ? 0.3 : 1; const sprint = (mag > 0.95 ? 1.5 : 1) * held; if (driving) { const u = car.userData; if (u.fuel > 0) { u.fuel = Math.max(0, u.fuel - vstat().burn * mag * dt); car.position.addScaledVector(dir, vstat().speed * mag * dt); collideCar(car.position); car.rotation.y = yaw; player.position.copy(car.position); if (city.knock(car.position.x, car.position.z, 1.3, dir.x, dir.z)) sfx.hit(); } else if (!outOfGasSaid) { outOfGasSaid = true; say('Out of gas. Find the gas station, or walk.'); } } else { player.position.addScaledVector(dir, 4.2 * mag * sprint * dt); collide(player.position, 0.25); player.rotation.y = yaw; animateWalk(player, dt, mag * sprint); }
    } else { animateWalk(player, dt, 0); if (look.id === null && stick.id === null) { let d = yaw - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); camYaw += d * Math.min(1, dt * 2); } }
    player.visible = !driving && (invuln <= 0 || Math.sin(now * 0.03) > 0);
    for (let i = books.length - 1; i >= 0; i--) { const b = books[i]; b.mesh.rotation.y += dt * 2; b.mesh.position.y = 0.5 + Math.sin(now * 0.004 + i) * 0.1; if (b.mesh.position.distanceTo(player.position) < 0.9) { scene.remove(b.mesh); books.splice(i, 1); booksFound++; const free = slots.indexOf(null); slots[free >= 0 ? free : booksFound % 3] = b.key; say('Spell book: ' + SPELLS[b.key].name); sfx.pickup(); $('books').textContent = '📖 ' + booksFound; } }
    if (riding) updateRide(dt);
    updateZombies(dt); if (state !== 'play') return; updateShots(dt); updateNights(dt); updateMissions(dt); fx.update(dt); updateActs();
    flashT -= dt; flashMesh.position.copy(player.position).setY(1); flashMesh.scale.setScalar(1 + (0.3 - Math.max(0, flashT)) * 20); flashMesh.material.opacity = Math.max(0, flashT) * 2;
    if (city) city.updateRain(dt);
  }
  // third-person camera: behind and above, buildings in between go see-through
  const back = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  const target = (driving ? car : player).position.clone().setY(driving ? 1.0 : 0.9); const want = target.clone().addScaledVector(back, driving ? 8 : 5.5).add(new THREE.Vector3(0, driving ? 4.5 : 3.2, 0));
  camera.position.lerp(want, 1 - Math.pow(0.001, dt)); camera.lookAt(target);
  isoCam.position.copy(target).addScaledVector(isoDir, 60); isoCam.lookAt(target); const cam = iso ? isoCam : camera;
  if (city) { const cd = cam.position.clone().sub(target); for (const b of city.buildings) { const rel = b.position.clone().sub(target); const along = rel.dot(cd) / cd.lengthSq(); const fade = along > 0.05 && along < 1 && rel.clone().addScaledVector(cd, -along).length() < 3; const op = fade ? 0.15 : 1; for (const m of b.userData.fade) if (m.opacity !== op) m.opacity = op; if (b.userData.extras) for (const e of b.userData.extras) e.visible = !fade; if (b.userData.edges) b.userData.edges.visible = fade; } }
  renderer.render(scene, cam);
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); const a = innerWidth / innerHeight, half = a < 1 ? 8 / a * 0.8 : 8; isoCam.left = -half * a; isoCam.right = half * a; isoCam.top = half; isoCam.bottom = -half; isoCam.updateProjectionMatrix(); }
$('view').addEventListener('pointerdown', (e) => { e.stopPropagation(); iso = !iso; $('view').textContent = iso ? 'ISO' : '3RD'; });
addEventListener('resize', resize); resize();

// ---------- start / end ----------
function startRun() {
  unlockAudio(); startMusic(); buildWorld(); for (const z of zombies) scene.remove(z); zombies.length = 0; fx.clear(); if (chopper) { scene.remove(chopper); chopper = null; } extracting = false;
  driving = false; car = null; maxHp = 100; cdMul = 1; carArmor = false; trashDmg = 1; rescued = 0; mIndex = 0; hp = 100; invuln = 0; night = 0; clock = 0; isNight = false; kills = 0; booksFound = 0; slots.fill(null); cds.fill(0); $('hp2').style.width = '100%'; $('books').textContent = '📖 0';
  const sp = toWorld(startCell.cx, startCell.cy, cols, rows); player.position.set(sp.x, 0, sp.z); camYaw = yaw = 0; placeBooks(); placeSurvivors(); startMission(0);
  if (new URLSearchParams(location.search).get('horde')) { const n = +new URLSearchParams(location.search).get('horde') || 100; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, rr = 5 + Math.random() * 10; const w = { x: player.position.x + Math.cos(a) * rr, z: player.position.z + Math.sin(a) * rr }; if (openCell(toCell(w.x, w.z, cols, rows))) spawnZombie(w, false); else spawnZombie(randomOpen(6), false); } say('Horde test: ' + zombies.length + ' zombies.'); }
  $('dcStart').classList.add('hidden'); $('dcOver').classList.add('hidden'); $('dc').classList.remove('hidden'); state = 'play'; say('Find the spell books before dark.');
}
function gameOver(won) { state = 'over'; stopMusic(); (won ? sfx.wave : sfx.over)(); $('dcOverTitle').textContent = won ? 'EXTRACTED' : 'OVERRUN'; $('dcOverText').textContent = (won ? 'You survived all six nights and made the chopper. ' : 'The dead got you on night ' + night + '. ') + 'Kills: ' + kills + ' · Books: ' + booksFound + ' · Rescued: ' + rescued; $('dc').classList.add('hidden'); $('dcOver').classList.remove('hidden'); }
$('dcPlay').addEventListener('click', startRun); $('dcAgain').addEventListener('click', startRun);
requestAnimationFrame(frame);
window.__dc = { get cars() { return city.cars; }, get driving() { return driving; }, get game() { return game; }, openGame, enterCar, get riding() { return riding; }, rides, set iso(v) { iso = v; }, get iso() { return iso; }, get city() { return city; }, get zombies() { return zombies; }, get player() { return player; }, get state() { return state; }, get slots() { return slots; }, spawnZombie, castSlot, throwTrash, get night() { return night; }, set clock(v) { clock = v; }, get books() { return books; }, get hp() { return hp; } };
