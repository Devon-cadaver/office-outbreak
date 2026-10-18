// Dead City Nights: a third-person, joystick take on Extraction: Dead City, running on the Zombieville engine.
// Survive three nights, collect spell books, reach the helipad at dawn. Kept deliberately small.
import * as THREE from 'three';
import { bindSeasonSelect } from '../season.js';
import { equippedSkin, addCoins, CHAR_SKINS } from '../skins.js';
import { generateMaze, buildCity, flowField, findPath, toWorld, toCell, CELL, mulberry32, NIGHT } from '../city.js';
import { makeCharacter, animateWalk } from '../poster/characters.js';
import { createFires, setFlamePalette } from '../fire.js';
import { makeChopper, animateChopper } from '../chopper.js';
import { makeCar, rollVehicle } from '../car.js';
import { stampVersion, VERSION } from '../version.js';
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
const fadeTmp = new THREE.Vector3(); const isoCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200); let iso = true; const ISO_YAW = Math.PI / 4, ISO_ELEV = 0.72;
const isoDir = new THREE.Vector3(Math.sin(ISO_YAW) * Math.cos(ISO_ELEV), Math.sin(ISO_ELEV), Math.cos(ISO_YAW) * Math.cos(ISO_ELEV)).normalize();
const fx = createFires(scene); { const e = equippedSkin('fx'); if (e && e.flames) setFlamePalette(e); }

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
  city = buildCity(scene, maze, 3); obstacles = city.obstacles; city.season.light(hemi, sun, scene); rainLine = city.group.children.find((c) => c.isLineSegments && c.material.color.getHex() === 0xcfeaea); clearTornadoes(); clearCans(); clearGuns(); clearCorpses(); clearAmbient(); flame = 0; stillT = 0; stillWarned = false; repairKits = 0; carNoise = 0; gasCans = 0; setWeather('clear'); weather.next = 30 + Math.random() * 20;
  houseDoors = []; for (const b of city.buildings) { if (b.parent === city.group) continue; const dr = b.parent.localToWorld(new THREE.Vector3(-0.55, 0, 1.6)); if (openCell(toCell(dr.x, dr.z, cols, rows))) houseDoors.push({ x: dr.x, z: dr.z }); } spawnRate = 1;
  for (const hz of city.hazards) { const c = toCell(hz.pos.x, hz.pos.z, cols, rows); maze[c.cy][c.cx] = false;
    const i = obstacles.findIndex((o) => Math.abs(o.x - hz.pos.x) < 0.01 && Math.abs(o.z - hz.pos.z) < 0.01 && o.hw > 1); if (i >= 0) obstacles.splice(i, 1);
    if (hz.type === 'base') obstacles.push({ x: hz.pos.x, z: hz.pos.z - 0.4, hw: 1.15, hd: 0.8 }); if (hz.type === 'lab') obstacles.push({ x: hz.pos.x, z: hz.pos.z - 0.3, hw: 1.15, hd: 0.9 });
    if (hz.type === 'gas') for (const dx of [-0.6, 0.6]) obstacles.push({ x: hz.pos.x + dx, z: hz.pos.z, hw: 0.2, hd: 0.15 }); }
  const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: 0x7dff3a, transparent: true, opacity: 0.35 })); pad.rotation.x = -Math.PI / 2; pad.position.set(ep.x, 0.03, ep.z); city.group.add(pad);
}
const poi = (type) => { const h = city.hazards.find((x) => x.type === type); return h ? h.pos : toWorld(startCell.cx, startCell.cy, cols, rows); };
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 10, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x7dff3a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); beacon.position.y = 5; beacon.visible = false; scene.add(beacon);
function collide(pos, r) { for (const o of obstacles) { const dx = pos.x - o.x, dz = pos.z - o.z; if (Math.abs(dx) > o.hw + r || Math.abs(dz) > o.hd + r) continue; const px = o.hw + r - Math.abs(dx), pz = o.hd + r - Math.abs(dz); if (px < pz) pos.x += Math.sign(dx || 1) * px; else pos.z += Math.sign(dz || 1) * pz; } clampToGrid(pos, r); }
function clampToGrid(pos, r) { if (!cols) return; const a = toWorld(1, 1, cols, rows), b = toWorld(cols - 2, rows - 2, cols, rows); const h = CELL / 2 - r; pos.x = Math.max(Math.min(a.x, b.x) - h, Math.min(Math.max(a.x, b.x) + h, pos.x)); pos.z = Math.max(Math.min(a.z, b.z) - h, Math.min(Math.max(a.z, b.z) + h, pos.z)); }
const openCell = (c) => maze[c.cy]?.[c.cx] === false;
function collideCar(pos) { for (const o of obstacles) { const dx = pos.x - o.x, dz = pos.z - o.z; if (Math.abs(dx) > o.hw + 0.6 || Math.abs(dz) > o.hd + 0.6) continue; const px = o.hw + 0.6 - Math.abs(dx), pz = o.hd + 0.6 - Math.abs(dz); if (px < pz) pos.x += Math.sign(dx || 1) * px; else pos.z += Math.sign(dz || 1) * pz; } }
function lineClear(a, b) { const n = Math.ceil(a.distanceTo(b) / 0.8); for (let i = 1; i < n; i++) { const t = i / n; if (!openCell(toCell(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, cols, rows))) return false; } return true; }
function randomOpen(minDist) { for (let k = 0; k < 200; k++) { const c = { cx: 1 + ((Math.random() * (cols - 2)) | 0), cy: 1 + ((Math.random() * (rows - 2)) | 0) }; if (!openCell(c)) continue; const w = toWorld(c.cx, c.cy, cols, rows); if (Math.hypot(w.x - player.position.x, w.z - player.position.z) >= minDist) return w; } return toWorld(startCell.cx, startCell.cy, cols, rows); }

// ---------- player, camera, controls ----------
const SCALE = 0.25; const player = makeCharacter('hoodie', { skin: equippedSkin('player') }); player.scale.setScalar(SCALE); scene.add(player);
let hearts = 3, maxHearts = 3, armor = 0, invuln = 0, yaw = 0, camYaw = 0, state = 'start', driving = false, car = null, carHp = 5;
const VEH = { car: { hp: 5, speed: 6, burn: 1.5, name: 'Car' }, van: { hp: 8, speed: 5.2, burn: 2, name: 'Van' }, truck: { hp: 10, speed: 4.6, burn: 2.5, name: 'Truck' }, tank: { hp: 25, speed: 3.4, burn: 3.5, name: 'Tank' } };
const vstat = () => VEH[(car && car.userData.kind) || 'car'];
function vehState(c) { const u = c.userData; if (u.fuel == null) { u.fuel = 70 + Math.random() * 30; u.hp = VEH[u.kind || 'car'].hp; u.keys = u.kind !== 'tank'; } return u; }
let outOfGasSaid = false;
// hearts: red up to 5, blue armour hearts from a flak jacket on top
function drawHearts() { $('hp2').textContent = '❤️'.repeat(Math.max(0, hearts)) + '🖤'.repeat(Math.max(0, maxHearts - hearts)) + '💙'.repeat(armor); }
function hurt(n) { if (state !== 'play') return true; invuln = Math.max(invuln, 2); sfx.hurt(); while (n-- > 0 && hearts > 0) { if (armor > 0) armor--; else hearts--; } drawHearts(); if (hearts <= 0) { gameOver(false); return true; } return false; }
function addHeart() { if (maxHearts < 5) maxHearts++; hearts = Math.min(maxHearts, hearts + 1); drawHearts(); }
function addFlak() { armor = 2; drawHearts(); }
function boardFollowers(on) { for (const s of survivors) { if (!s.userData.follow || s.userData.saved) continue; if (on) { s.userData.aboard = true; s.visible = false; } else if (s.userData.aboard) { s.userData.aboard = false; s.visible = true; const a = Math.random() * 6.28; s.position.set(player.position.x + Math.cos(a) * 0.9, 0, player.position.z + Math.sin(a) * 0.9); collide(s.position, 0.2); } } }
function enterCar(c) { if (driving) leaveCar(); const u = vehState(c); if (!u.keys) { openGame('keys', c); return; } car = c; driving = true; carHp = u.hp; player.visible = false; outOfGasSaid = false; const wp = c.userData.worldPos().clone(); const pr = c.userData.prop; if (!pr.detached) { pr.g.remove(c); scene.add(c); c.position.set(wp.x, 0, wp.z); pr.knocked = true; pr.detached = true; pr.t = 1; c.userData.worldPos = () => c.position; } if (pr.ob) { const i = obstacles.indexOf(pr.ob); if (i >= 0) obstacles.splice(i, 1); } yaw = car.rotation.y; boardFollowers(true); carNoise = 0; say(VEH[u.kind || 'car'].name + ': ' + Math.round(u.fuel) + '% fuel. Double-tap to get out.'); sfx.pickup(); }
function leaveCar() { if (!car) return; car.userData.hp = carHp; driving = false; player.visible = true; player.position.set(car.position.x + Math.cos(yaw) * 1.2, 0, car.position.z - Math.sin(yaw) * 1.2); collide(player.position, 0.25); if (carHp <= 0) car.userData.wrecked = true; car = null; boardFollowers(false); }
const stick = { x: 0, y: 0, id: null, cx: 0, cy: 0 }; const look = { id: null, lx: 0 };
const knob = $('dcKnob'), stickEl = $('dcStick'); const verEl = stampVersion($('dcPlay').closest('.screen') || document.body);
const inDbg = { on: false, ts: 0, tm: 0, te: 0, pd: 0, pm: 0, tgt: '' }; try { inDbg.on = new URLSearchParams(location.search).has('input') || localStorage.getItem('dc_input_dbg') === '1'; } catch { /* ignore */ }
const inDbgEl = document.createElement('div'); inDbgEl.style.cssText = 'position:fixed;left:6px;top:70px;z-index:60;font:11px monospace;color:#7dff3a;background:#000a;padding:3px 5px;border-radius:4px;pointer-events:none;white-space:pre'; document.body.appendChild(inDbgEl);
{ let n = 0, t0 = 0; verEl.style.pointerEvents = 'auto'; verEl.addEventListener('click', () => { const now = performance.now(); n = now - t0 < 700 ? n + 1 : 1; t0 = now; if (n >= 3) { n = 0; inDbg.on = !inDbg.on; try { localStorage.setItem('dc_input_dbg', inDbg.on ? '1' : '0'); } catch { /* ignore */ } verEl.textContent = 'v' + VERSION + (inDbg.on ? ' · input on' : ''); } }); if (inDbg.on) verEl.textContent += ' · input on'; }
function drawInDbg() { inDbgEl.style.display = inDbg.on ? 'block' : 'none'; if (!inDbg.on) return; inDbgEl.textContent = 'touch s/m/e ' + inDbg.ts + '/' + inDbg.tm + '/' + inDbg.te + '  ptr d/m ' + inDbg.pd + '/' + inDbg.pm + '\ntarget ' + inDbg.tgt + '  state ' + state + '\nstick ' + stick.id + ' ' + stick.x.toFixed(2) + ',' + stick.y.toFixed(2) + '  look ' + look.id + '\nplayer ' + player.position.x.toFixed(1) + ',' + player.position.z.toFixed(1); }
function resetStick() { stick.id = null; stick.x = stick.y = 0; knob.style.transform = 'translate(-50%, -50%)'; look.id = null; }
// one set of stick/look handlers, fed by mouse/pen pointer events or by raw touches (ids 't' + identifier)
function stickDown(id, x, y) { if (x < innerWidth / 2 && stick.id === null) { stick.id = id; stick.cx = x; stick.cy = y; stickEl.style.left = (x - 65) + 'px'; stickEl.style.top = (y - 65) + 'px'; stickEl.style.bottom = 'auto'; } else if (look.id === null) { look.id = id; look.lx = x; } }
function stickMove(id, x, y) { if (id === stick.id) { const dx = x - stick.cx, dy = y - stick.cy; const d = Math.hypot(dx, dy) || 1, m = Math.min(d, 55); stick.x = dx / d * m / 55; stick.y = dy / d * m / 55; knob.style.transform = 'translate(calc(-50% + ' + (stick.x * 40) + 'px), calc(-50% + ' + (stick.y * 40) + 'px))'; } if (id === look.id) { camYaw -= (x - look.lx) * 0.008; look.lx = x; } }
function stickUp(id) { if (id === stick.id) { stick.id = null; stick.x = stick.y = 0; knob.style.transform = 'translate(-50%, -50%)'; } if (id === look.id) look.id = null; }
canvas.addEventListener('pointerdown', (e) => { inDbg.pd++; if (e.pointerType === 'touch' || state !== 'play') return; if (e.isPrimary && (stick.id !== null || look.id !== null)) resetStick(); stickDown(e.pointerId, e.clientX, e.clientY); });
addEventListener('pointermove', (e) => { inDbg.pm++; if (e.pointerType !== 'touch') stickMove(e.pointerId, e.clientX, e.clientY); });
const onUi = (t) => t && t.closest && t.closest('button, select, a, .screen, #dcStore');
canvas.addEventListener('touchstart', (e) => { inDbg.ts++; inDbg.tgt = e.target && (e.target.id || e.target.tagName); if (state !== 'play') return; if (e.touches.length === e.changedTouches.length && (stick.id !== null || look.id !== null)) resetStick(); if (e.touches.length >= 2 && stick.id === null) return; for (const t of e.changedTouches) stickDown('t' + t.identifier, t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchmove', (e) => { inDbg.tm++; for (const t of e.changedTouches) stickMove('t' + t.identifier, t.clientX, t.clientY); if (state === 'play') e.preventDefault(); }, { passive: false }); // no page scroll/bounce while playing
const touchUp = (e) => { inDbg.te++; for (const t of e.changedTouches) stickUp('t' + t.identifier); };
addEventListener('touchend', touchUp); addEventListener('touchcancel', touchUp);
let lastTap = 0, lastTapX = 0, lastTapY = 0;
addEventListener('pointerdown', (e) => { if (e.target.closest('button') || state !== 'play') return; const now = performance.now(); if (now - lastTap < 350 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 30) { lastTap = 0; const nearRide = !driving && !riding && rides.find((rr) => Math.hypot(rr.pos.x - player.position.x, rr.pos.z - player.position.z) < 3.4); if (nearRide) { openGame('ride', nearRide); return; }
    if (driving) { const g = city.hazards.find((x) => x.type === 'gas'); if (g && Math.hypot(g.pos.x - car.position.x, g.pos.z - car.position.z) < 4) openGame('pump', car); else leaveCar(); } else { let best = null, bd = 2.2; for (const c of city.cars) { if (c.userData.wrecked || (c.userData.prop.knocked && !c.userData.prop.detached)) continue; const wp = c.userData.worldPos(); const d = Math.hypot(wp.x - player.position.x, wp.z - player.position.z); if (d < bd) { bd = d; best = c; } } if (best) enterCar(best); else say('No car close enough.'); } } else { lastTap = now; lastTapX = e.clientX; lastTapY = e.clientY; } });
// zoom: pinch or mouse wheel, remembered between runs; starts closer than before
let zoom = 0.7; try { zoom = +localStorage.getItem('dc_zoom') || 0.7; } catch { /* ignore */ }
function setZoom(z) { zoom = Math.max(0.45, Math.min(1.6, z)); try { localStorage.setItem('dc_zoom', String(zoom)); } catch { /* ignore */ } resize(); }
let pinchD = 0; const dist2 = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
addEventListener('touchstart', (e) => { if (e.touches.length >= 2) { e.preventDefault(); pinchD = dist2(e.touches); stick.id = null; stick.x = stick.y = 0; knob.style.transform = 'translate(-50%, -50%)'; look.id = null; } }, { passive: false });
addEventListener('touchmove', (e) => { if (e.touches.length >= 2) { e.preventDefault(); const d = dist2(e.touches); if (pinchD > 0 && d > 0) setZoom(zoom * pinchD / d); pinchD = d; } }, { passive: false });
addEventListener('touchend', (e) => { if (e.touches.length < 2) pinchD = 0; if (!e.touches.length) resetStick(); });
addEventListener('touchcancel', (e) => { if (!e.touches.length) { pinchD = 0; resetStick(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) resetStick(); });
addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
let goRoute = []; const tapStart = new Map();
function tapMove(cx, cy) { const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); const ray = new THREE.Raycaster(); const cam0 = iso ? isoCam : camera; if (iso) { const tg = (driving ? car : player).position.clone().setY(0.9); isoCam.position.copy(tg).addScaledVector(isoDir, 60); isoCam.lookAt(tg); } cam0.updateMatrixWorld(); ray.setFromCamera(ndc, cam0); const o = ray.ray.origin, dr = ray.ray.direction; if (Math.abs(dr.y) < 1e-4) return 'flat'; const t = -o.y / dr.y; if (t < 0) return 'behind'; const w = { x: o.x + dr.x * t, z: o.z + dr.z * t }; const target = toCell(w.x, w.z, cols, rows); if (!openCell(target)) return 'blocked ' + target.cx + ',' + target.cy; const from = toCell(player.position.x, player.position.z, cols, rows); const path = findPath(maze, from, target); if (!path.length) return 'nopath'; goRoute = path.slice(0, 12); say('Heading there.'); return 'ok ' + path.length; }
addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) tapStart.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() }); });
const release = (e) => { const ts = tapStart.get(e.pointerId); tapStart.delete(e.pointerId); if (ts && state === 'play' && performance.now() - ts.t < 300 && Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 12 && !e.target.closest('button')) tapMove(e.clientX, e.clientY);
  if (e.pointerType !== 'touch') stickUp(e.pointerId); };
addEventListener('pointerup', release); addEventListener('pointercancel', release);
// keyboard for the PC crowd
const keys = {}; addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (['1', '2', '3'].includes(e.key)) castSlot(+e.key - 1); if (e.key === ' ') { fireHeld = true; throwTrash(); } }); addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; if (e.key === ' ') fireHeld = false; });

// ---------- zombies ----------
const zombies = [], pool = [];
let houseDoors = [], spawnRate = 1, carNoise = 0, noiseSpawnT = 0, carMoving = false;
function updateCarNoise(dt) { if (!driving) { carNoise = Math.max(0, carNoise - dt * 2); return; } carNoise += dt; noiseSpawnT -= dt; if (noiseSpawnT <= 0 && zombies.length < 150) { noiseSpawnT = Math.max(0.35, 3 - carNoise * 0.12); for (let tries = 0; tries < 8; tries++) { const a = Math.random() * Math.PI * 2, rr = 6 + Math.random() * 8; const w = { x: car.position.x + Math.cos(a) * rr, z: car.position.z + Math.sin(a) * rr }; if (openCell(toCell(w.x, w.z, cols, rows))) { const z = spawnZombie(w, Math.random() < fastFrac(Math.max(1, night)), Math.random() < 0.5 ? 'ground' : undefined); z.userData.alert = 8; break; } } } }
// standing still is a bad idea: the longer you stay put, the more crawl out of the ground around you
let stillT = 0, stillSpawnT = 0, stillWarned = false; const stillPos = new THREE.Vector3();
function updateStill(dt) {
  if (driving || riding || game) { stillT = 0; stillPos.copy(player.position); return; }
  if (player.position.distanceTo(stillPos) > 1.5) { stillT = 0; stillPos.copy(player.position); stillWarned = false; return; }
  stillT += dt; const grace = isNight ? 5 : 10; if (stillT < grace) return;
  if (!stillWarned) { stillWarned = true; say('The ground stirs under you. Keep moving.'); sfx.hurt(); }
  stillSpawnT -= dt; if (stillSpawnT <= 0 && zombies.length < 140) { stillSpawnT = Math.max(1.2, 6 - (stillT - grace) * 0.4); const a = Math.random() * Math.PI * 2, rr = 2.5 + Math.random() * 2.5; const w = { x: player.position.x + Math.cos(a) * rr, z: player.position.z + Math.sin(a) * rr }; if (openCell(toCell(w.x, w.z, cols, rows))) spawnZombie(w, Math.random() < fastFrac(Math.max(1, night)), 'ground'); }
}
function spawnSite() { const r = Math.random(); if (r < 0.4 && houseDoors.length) { const dr = houseDoors[(Math.random() * houseDoors.length) | 0]; if (Math.hypot(dr.x - player.position.x, dr.z - player.position.z) > 5) return { pos: dr, mode: 'house' }; }
  if (isNight && r > 0.8) { const cem = poi('cemetery'); return { pos: { x: cem.x + (Math.random() - 0.5) * 3, z: cem.z + 2.2 }, mode: 'ground' }; } return { pos: randomOpen(10), mode: 'ground' }; }
function spawnFrom(fast) { const s = spawnSite(); return spawnZombie(s.pos, fast, s.mode); }
function spawnZombie(pos, strong, mode) { const z = pool.pop() || makeCharacter(['worker', 'vest', 'suit', 'punk'][(Math.random() * 4) | 0], { zombie: true }); z.position.set(pos.x, 0, pos.z); z.scale.setScalar(SCALE); z.rotation.set(0, 0, 0); Object.assign(z.userData, { hp: 3, fast: !!strong, speed: strong ? 1.9 + Math.random() * 0.3 : 0.8 + Math.random() * 0.3, charged: 0, burn: 0, rag: null, stun: 0, slow: 0, poison: 0, alert: 0 }); z.userData.lean = strong ? 0.5 : 0.12; z.userData.rise = null;
  if (mode === 'ground') { z.userData.rise = 0; z.position.y = -1.3; for (let i = 0; i < 5; i++) fx.puff('debris', new THREE.Vector3(pos.x, 0.05, pos.z), 0.5); } else if (mode === 'house') { z.userData.rise = 0.6; z.position.y = 0; }
  scene.add(z); zombies.push(z); return z; }
// death: fall over, bleach to bones, sink away, then back to the pool
const corpses = []; const boneMat = new THREE.MeshLambertMaterial({ color: 0xe8e2c8 });
function killZombie(i) { const z = zombies[i]; zombies.splice(i, 1); kills++; earn(night >= 4 ? 8 : 15); sfx.kill(); const roll = Math.random(); if (roll < 0.06) dropCan(z.position); else if (roll < 0.10) dropLoot(z.position, 'heart'); else if (roll < 0.115) dropLoot(z.position, 'flak'); else if (roll < 0.125) dropLoot(z.position, 'repair'); const lying = !!z.userData.rag; z.userData.rag = null; z.position.y = Math.max(0, z.position.y); corpses.push({ z, t: 0, rx0: z.rotation.x, lying, bones: false }); }
const pilePool = []; const boneGeo = new THREE.BoxGeometry(0.34, 0.05, 0.05), skullGeo = new THREE.SphereGeometry(0.1, 8, 6), ribGeo = new THREE.TorusGeometry(0.09, 0.015, 5, 10, Math.PI);
function makePile() { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(boneGeo, boneMat); b.position.set((Math.random() - 0.5) * 0.5, 0.03 + i * 0.012, (Math.random() - 0.5) * 0.5); b.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4); g.add(b); }
  for (let i = 0; i < 3; i++) { const rb = new THREE.Mesh(ribGeo, boneMat); rb.position.set((Math.random() - 0.5) * 0.3, 0.04, (Math.random() - 0.5) * 0.3); rb.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI); g.add(rb); }
  const sk = new THREE.Mesh(skullGeo, boneMat); sk.scale.set(1, 0.85, 1.1); sk.position.set((Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3); g.add(sk); return g; }
function setBones(z, on) { if (on) { z.visible = false; const pile = pilePool.pop() || makePile(); pile.position.set(z.position.x, 0, z.position.z); pile.rotation.y = Math.random() * 6; scene.add(pile); z.userData.pile = pile; } else if (z.userData.pile) { scene.remove(z.userData.pile); pilePool.push(z.userData.pile); z.userData.pile = null; z.visible = true; } }
function updateCorpses(dt) { for (let i = corpses.length - 1; i >= 0; i--) { const c = corpses[i], z = c.z; c.t += dt;
  if (c.t < 0.6) { const k = Math.min(1, c.t / 0.6); z.rotation.x = c.lying ? c.rx0 : c.rx0 + (-Math.PI / 2 - c.rx0) * k; z.position.y = c.lying ? 0.12 : 0.12 * k; }
  else if (c.t < 3.5) { if (!c.bones) { c.bones = true; setBones(z, true); } }
  else if (c.t < 5) { if (z.userData.pile) z.userData.pile.position.y = -(c.t - 3.5) / 1.5 * 0.3; }
  else { scene.remove(z); setBones(z, false); z.rotation.set(0, 0, 0); z.position.y = 0; pool.push(z); corpses.splice(i, 1); } } }
function clearCorpses() { for (const c of corpses) { scene.remove(c.z); setBones(c.z, false); c.z.rotation.set(0, 0, 0); pool.push(c.z); } corpses.length = 0; }
// gas cans: rare drops that refill an empty car on their own
const cans = []; let gasCans = 0, repairKits = 0; const canGeo = new THREE.BoxGeometry(0.3, 0.36, 0.2), canMat = new THREE.MeshLambertMaterial({ color: 0xe03a2a });
const lootMats = { repair: new THREE.MeshLambertMaterial({ color: 0xd6d6e0 }), can: canMat, heart: new THREE.MeshBasicMaterial({ color: 0xff3a6a }), flak: new THREE.MeshLambertMaterial({ color: 0x3a7aff }) }; const heartGeo = new THREE.SphereGeometry(0.16, 8, 6), flakGeo = new THREE.BoxGeometry(0.4, 0.3, 0.16);
function dropLoot(p, kind) { const m = new THREE.Mesh(kind === 'heart' ? heartGeo : kind === 'flak' ? flakGeo : canGeo, lootMats[kind]); m.position.set(p.x, 0.25, p.z); m.userData.kind = kind; scene.add(m); cans.push(m); }
function dropCan(p) { dropLoot(p, 'can'); }
function clearCans() { for (const c of cans) scene.remove(c); cans.length = 0; }
function updateCans(dt) {
  for (let i = cans.length - 1; i >= 0; i--) { const c = cans[i]; c.rotation.y += dt * 2; if (c.userData.kind === 'can' && gasCans >= 2) continue; if (c.position.distanceTo(player.position) < 0.9) { scene.remove(c); cans.splice(i, 1); sfx.pickup(); const k = c.userData.kind; if (k === 'repair') { repairKits++; say('Repair kit! (' + repairKits + ')'); } else if (k === 'heart') { addHeart(); say(maxHearts >= 5 && hearts === 5 ? 'Heart (full).' : 'Heart!'); } else if (k === 'flak') { addFlak(); say('Flak jacket: two blue hearts.'); } else { gasCans++; say('Gas can! (' + gasCans + ')'); } } }
  if (driving && gasCans > 0 && car.userData.fuel < 20) { gasCans--; car.userData.fuel = Math.min(100, car.userData.fuel + 40); say('Poured in a gas can.'); sfx.pickup(); }
  if (driving && repairKits > 0 && carHp <= Math.ceil(vstat().hp / 3)) { repairKits--; carHp = vstat().hp; say('Repair kit used. Back to full.'); sfx.pickup(); }
}
function fling(z, dir, power) { const d = Math.hypot(dir.x, dir.z) || 1; z.userData.rag = { vel: new THREE.Vector3(dir.x / d * power, 5, dir.z / d * power), t: 0 }; }
function updateZombies(dt) {
  if (flowT <= 0 || !flow) { const pc = toCell(player.position.x, player.position.z, cols, rows); flow = flowField(maze, pc.cx, pc.cy); flowT = 0.25; } flowT -= dt;
  let hunted = false;
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i], u = z.userData;
    if (u.rag) { u.rag.t += dt; u.rag.vel.y -= 16 * dt; z.position.addScaledVector(u.rag.vel, dt); z.rotation.x += dt * 9; if (z.position.y <= 0 && u.rag.t > 0.3) killZombie(i); continue; }
    if (u.rise != null) { u.rise += dt / 1.6; if (u.rise >= 1) { u.rise = null; z.position.y = 0; } else { z.position.y = Math.min(0, -1.3 + 1.3 * u.rise); animateWalk(z, dt, 0.4); if (Math.random() < dt * 6) fx.puff('smoke', new THREE.Vector3(z.position.x, 0.1, z.position.z), 0.4); continue; } }
    if (u.poison > 0) { u.poison -= dt; u.hp -= dt * 0.8; }
    if (u.burn > 0) { u.burn -= dt; u.hp -= dt * 1.2; if (Math.random() < dt * 12) fx.puff('flame', new THREE.Vector3(z.position.x, 0.5 + Math.random() * 0.5, z.position.z), 0.6); }
    if (u.hp <= 0) { killZombie(i); continue; }
    if (u.stun > 0) { u.stun -= dt; animateWalk(z, dt, 0); continue; }
    u.slow = Math.max(0, u.slow - dt); u.charged = Math.max(0, (u.charged || 0) - dt); if (u.spark) u.spark.visible = u.charged > 0;
    const d = z.position.distanceTo(player.position);
    if (d < 16 && lineClear(z.position, player.position)) u.alert = 6; u.alert -= dt; if (u.alert > 0) hunted = true;
    const hunting = u.alert > 0 || (isNight && !u.rag); let tx, tz, mul = u.alert > 0 ? 1 : hunting ? 0.6 : 0.45;
    if (hunting && d > 1) {
      const c = toCell(z.position.x, z.position.z, cols, rows); let best = flow[c.cy * cols + c.cx], bx = c.cx, by = c.cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = flow[(c.cy + dy) * cols + c.cx + dx]; if (v >= 0 && v < best) { best = v; bx = c.cx + dx; by = c.cy + dy; } }
      if (best <= 1) { tx = player.position.x; tz = player.position.z; } else { const w = toWorld(bx, by, cols, rows); tx = w.x; tz = w.z; }
    } else if (hunting) { tx = player.position.x; tz = player.position.z; }
    else { if (!u.wander || Math.random() < dt * 0.3) { const c = toCell(z.position.x, z.position.z, cols, rows); const n = { cx: c.cx + ((Math.random() * 5) | 0) - 2, cy: c.cy + ((Math.random() * 5) | 0) - 2 }; u.wander = toWorld(openCell(n) ? n.cx : c.cx, openCell(n) ? n.cy : c.cy, cols, rows); } tx = u.wander.x; tz = u.wander.z; }
    if (u.chase) { u.chaseT -= dt; if (!u.chase.parent || u.chaseT <= 0) u.chase = null; else { tx = u.chase.position.x; tz = u.chase.position.z; mul = 1; } }
    const dx = tx - z.position.x, dz = tz - z.position.z, dl = Math.hypot(dx, dz);
    if (dl > 0.05) { const sp = u.speed * mul * (u.slow > 0 ? 0.4 : 1) * (u.charged > 0 ? 1.7 : 1) * dt; z.position.x += dx / dl * sp; z.position.z += dz / dl * sp; z.rotation.y = Math.atan2(dx, dz); }
    for (const o of zombies) if (o !== z) { const ox = z.position.x - o.position.x, oz = z.position.z - o.position.z, od = Math.hypot(ox, oz); if (od < 0.4 && od > 0.001) { z.position.x += ox / od * (0.4 - od) * 0.5; z.position.z += oz / od * (0.4 - od) * 0.5; } }
    collide(z.position, 0.22); animateWalk(z, dt, mul);
    if (driving && !carMoving && d < 1.3 && !u.rag) { u.alert = 6; carHp -= dt * 0.25; if (Math.random() < dt * 1.5) { sfx.hit(); say('They are on the car. Drive!'); } if (carHp <= 0) { fx.ignite(new THREE.Vector3(car.position.x, 0.6, car.position.z), 0.9); say('The car is done!'); leaveCar(); } continue; }
    if (driving && d < 1.2 && !u.rag) { fling(z, { x: z.position.x - player.position.x, z: z.position.z - player.position.z }, 8); if (!carArmor || Math.random() < 0.5) carHp--; sfx.hit(); if (carHp <= 0) { fx.ignite(new THREE.Vector3(car.position.x, 0.6, car.position.z), 0.9); say('The car is done!'); leaveCar(); } continue; }
    if (u.latch > 0) { u.latch -= dt; const dir = player.position.clone().sub(z.position).setY(0).normalize(); z.position.copy(player.position).addScaledVector(dir, -0.42); z.rotation.y = Math.atan2(dir.x, dir.z); u.armL.rotation.x = u.armR.rotation.x = -1.6; if (u.latch <= 0) { u.stun = 0.7; z.position.addScaledVector(dir, -0.9); collide(z.position, 0.22); } continue; }
    for (let k = survivors.length - 1; k >= 0; k--) { const s = survivors[k]; if (!s.userData.aboard && z.position.distanceTo(s.position) < 0.45) { scene.remove(s); survivors.splice(k, 1); say('A survivor was lost.'); sfx.hurt(); } }
    if (riding) continue;
    if (d < 0.6 && invuln <= 0) { u.latch = 0.4; if (hurt(u.charged > 0 ? 2 : 1)) return; const kb = player.position.clone().sub(z.position).setY(0).normalize(); player.position.addScaledVector(kb, 1.2); collide(player.position, 0.25); for (const o of zombies) if (o !== z && !o.userData.rag && o.position.distanceTo(player.position) < 1.2) o.userData.stun = Math.max(o.userData.stun, 0.5); }
  }
  setMusicChase(hunted);
}

// ---------- spells, books, trash ----------
const SPELLS = {
  hellfire: { name: 'HELLFIRE', cd: 2.6, cast() { flame = 1.2; sfx.whoosh(); } },
  beam: { name: 'BEAM', cd: 1.1, cast() { const dir = facing(); for (let i = zombies.length - 1; i >= 0; i--) { const z = zombies[i]; const rel = z.position.clone().sub(player.position); const along = rel.dot(dir); if (along > 0 && along < 20 && rel.clone().addScaledVector(dir, -along).length() < 1) { z.userData.hp -= 4; } } flash(0x9a5fff); sfx.wave(); } },
  repulse: { name: 'REPULSE', cd: 2.8, cast() { for (const z of zombies) if (z.position.distanceTo(player.position) < 6 && !z.userData.rag) fling(z, { x: z.position.x - player.position.x, z: z.position.z - player.position.z }, 9); flash(0x7dff3a); sfx.boom(); } },
  entomb: { name: 'ENTOMB', cd: 3.4, cast() { for (const z of zombies) if (z.position.distanceTo(player.position) < 7) z.userData.stun = 4; flash(0xd0d0ff); sfx.hit(); } },
  wrath: { name: 'WRATH', cd: 1.6, cast() { let best = null, bd = 12; for (const z of zombies) { const d = z.position.distanceTo(player.position); if (d < bd) { bd = d; best = z; } } if (!best) return; fx.explode(best.position, 0.8); for (const z of zombies) if (z.position.distanceTo(best.position) < 4) z.userData.hp -= 4; sfx.boom(); } },
  maelstrom: { name: 'MAELSTROM', cd: 3.0, cast() { const dir = facing(); spawnTornado(player.position.clone().addScaledVector(dir, 2), dir, { life: 5, radius: 2.2, speed: 4, big: false }); flash(0x3fdfff); sfx.whoosh(); } },
  chain: { name: 'ARC', cd: 2.2, cast() { // bolt from the player to the nearest zombie, then hops zombie to zombie across the area
    let from = player.position.clone().setY(0.9); const hit = new Set(); const pts = [from.clone()];
    for (let hop = 0; hop < 12; hop++) { let best = null, bd = hop === 0 ? 8 : 5; for (const z of zombies) { if (hit.has(z) || z.userData.rag) continue; const dd = z.position.distanceTo(from); if (dd < bd) { bd = dd; best = z; } } if (!best) break;
      hit.add(best); best.userData.hp -= 3; best.userData.stun = Math.max(best.userData.stun, 0.6); best.userData.alert = 6; from = best.position.clone().setY(0.9); pts.push(from.clone()); }
    if (pts.length < 2) { say('No target.'); return; } drawChain(pts); flash(0x9fd8ff); sfx.boom(); } },
  diminish: { name: 'DIMINISH', cd: 2.2, cast() { for (const z of zombies) if (z.position.distanceTo(player.position) < 8) z.userData.slow = 6; flash(0xffd24a); sfx.hit(); } },
};
// ---------- tornadoes ----------
const tornadoes = []; const funnelMat = new THREE.MeshBasicMaterial({ color: 0x9a9aa8, transparent: true, opacity: 0.35, depthWrite: false });
function spawnTornado(pos, dir, o) { const g = new THREE.Group(); const n = o.big ? 9 : 6; for (let i = 0; i < n; i++) { const k = i / (n - 1); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3 + k * (o.big ? 3.2 : 1.6), o.big ? 0.22 : 0.12, 6, 18), funnelMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2 + k * (o.big ? 9 : 4); g.add(ring); } g.position.set(pos.x, 0, pos.z); scene.add(g);
  tornadoes.push({ g, dir: new THREE.Vector3(dir.x, 0, dir.z).normalize(), life: o.life, radius: o.radius, speed: o.speed, big: o.big, turn: 0 }); return g; }
function clearTornadoes() { for (const t of tornadoes) scene.remove(t.g); tornadoes.length = 0; wrecks.length = 0; }
const wrecks = [];
function wreckBuilding(body) { const u = body.userData; if (u.wrecked) return; u.wrecked = true; const obj = body.parent !== city.group ? body.parent : body; const wp = body.getWorldPosition(new THREE.Vector3()); wrecks.push({ obj, t: 0, h: u.h || 1.5 }); if (u.edges) u.edges.visible = false;
  const c = toCell(wp.x, wp.z, cols, rows); if (maze[c.cy]) maze[c.cy][c.cx] = false; const w = toWorld(c.cx, c.cy, cols, rows); const i = obstacles.findIndex((o) => Math.abs(o.x - w.x) < 0.3 && Math.abs(o.z - w.z) < 0.3 && o.hw > 0.8); if (i >= 0) obstacles.splice(i, 1); }
function updateTornadoes(dt) {
  for (const w of wrecks) { if (w.t >= 1) continue; w.t = Math.min(1, w.t + dt * 0.7); const k = w.t; w.obj.rotation.z = k * 1.3; w.obj.position.y = -k * w.h * 0.55; }
  for (let i = tornadoes.length - 1; i >= 0; i--) { const t = tornadoes[i]; t.life -= dt; if (t.life <= 0) { scene.remove(t.g); tornadoes.splice(i, 1); continue; }
    if (t.big) { t.g.scale.setScalar(0.15 + 0.85 * weather.k); t.turn += (Math.random() - 0.5) * dt * 2; const a = Math.atan2(t.dir.x, t.dir.z) + t.turn * dt; t.dir.set(Math.sin(a), 0, Math.cos(a)); }
    t.g.position.addScaledVector(t.dir, t.speed * dt); t.g.rotation.y += dt * 9; for (const ring of t.g.children) ring.position.x = Math.sin(t.g.rotation.y * 0.5 + ring.position.y) * 0.15;
    const half = (cols * CELL) / 2; if (Math.abs(t.g.position.x) > half || Math.abs(t.g.position.z) > (rows * CELL) / 2) t.dir.negate();
    const px = t.g.position.x, pz = t.g.position.z, R = t.radius;
    for (const z of zombies) if (!z.userData.rag && Math.hypot(z.position.x - px, z.position.z - pz) < R) { fling(z, { x: z.position.x - px + t.dir.x * 2, z: z.position.z - pz + t.dir.z * 2 }, t.big ? 9 : 6); z.userData.rag.vel.y = t.big ? 11 : 7; }
    for (const s of survivors) if (!s.userData.rag && Math.hypot(s.position.x - px, s.position.z - pz) < R) s.userData.rag = { vel: new THREE.Vector3((s.position.x - px) * 2 + t.dir.x * 3, 9, (s.position.z - pz) * 2 + t.dir.z * 3), t: 0 };
    if (city.knock(px, pz, R, t.dir.x, t.dir.z)) sfx.hit();
    if (t.big) for (const b of city.buildings) { if (b.userData.wrecked) continue; const wp = b.getWorldPosition(new THREE.Vector3()); if (Math.hypot(wp.x - px, wp.z - pz) < R) { wreckBuilding(b); sfx.boom(); } }
    const who = driving ? car.position : player.position; if (t.big && Math.hypot(who.x - px, who.z - pz) < R && invuln <= 0) { if (driving) { carHp -= 2; leaveCar(); } say('Caught in the tornado!'); if (hurt(1)) return; invuln = 1.5; toss = new THREE.Vector3((who.x - px) * 2 + t.dir.x * 3, 7, (who.z - pz) * 2 + t.dir.z * 3); }
  }
}
let toss = null;
let flame = 0;
const chainMat = new THREE.LineBasicMaterial({ color: 0xbfe8ff }); const chains = [];
function drawChain(pts) { const jag = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; for (let k = 0; k < 5; k++) { const p = a.clone().lerp(b, k / 5); if (k > 0) { p.x += (Math.random() - 0.5) * 0.4; p.y += (Math.random() - 0.5) * 0.5; p.z += (Math.random() - 0.5) * 0.4; } jag.push(p); } } jag.push(pts[pts.length - 1]);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(jag), chainMat); scene.add(line); chains.push({ line, t: 0.25 }); for (const p of pts.slice(1)) for (let i = 0; i < 4; i++) fx.puff('flame', p, 0.5); }
function updateChains(dt) { for (let i = chains.length - 1; i >= 0; i--) { const c = chains[i]; c.t -= dt; if (c.t <= 0) { scene.remove(c.line); c.line.geometry.dispose(); chains.splice(i, 1); } } }
function burnBuilding(b) { if (b.userData.burning || b.userData.wrecked) return; b.userData.burning = true; const wp = b.getWorldPosition(new THREE.Vector3()); const h = b.userData.h || 2; fx.ignite(new THREE.Vector3(wp.x + (Math.random() - 0.5) * 0.8, Math.min(h, 2.4), wp.z + (Math.random() - 0.5) * 0.8), 1.1, 30); fx.ignite(new THREE.Vector3(wp.x, 0.3, wp.z + 1), 0.7, 30); }
function updateFlame(dt) {
  if (flame <= 0) return; flame -= dt; const dir = facing(); const o = player.position.clone().setY(0.8).addScaledVector(dir, 0.4);
  for (let i = 0; i < 7; i++) { const along = 0.3 + Math.random() * 3.8; const spread = (Math.random() - 0.5) * (0.3 + along * 0.4); const p = new THREE.Vector3(o.x + dir.x * along - dir.z * spread, 0.3 + Math.random() * 0.9 + along * 0.12, o.z + dir.z * along + dir.x * spread); fx.puff('flame', p, 0.9 + along * 0.2); }
  if (Math.random() < dt * 8) fx.puff('smoke', o.clone().addScaledVector(dir, 3), 0.8);
  for (const z of zombies) { const rel = z.position.clone().sub(player.position); const along = rel.dot(dir); if (along < 0 || along > 4.4) continue; if (rel.clone().addScaledVector(dir, -along).length() > 0.5 + along * 0.35) continue; z.userData.hp -= dt * 3.5; z.userData.burn = 4; z.userData.alert = 6; }
  for (const b of city.buildings) { if (b.userData.burning) continue; const wp = b.getWorldPosition(fadeTmp); const rx = wp.x - player.position.x, rz = wp.z - player.position.z; const along = rx * dir.x + rz * dir.z; if (along > 0.5 && along < 4.5 && Math.abs(-rx * dir.z + rz * dir.x) < 1.6) burnBuilding(b); }
}
const slots = [null, null, null], cds = [0, 0, 0]; let trashCd = 0, kills = 0, booksFound = 0;
const books = []; const bookGeo = new THREE.BoxGeometry(0.5, 0.12, 0.7), bookMat = new THREE.MeshBasicMaterial({ color: 0xc06cff });
function placeBooks() { for (const b of books) scene.remove(b.mesh); books.length = 0; for (const key of Object.keys(SPELLS)) { const w = randomOpen(8); const mesh = new THREE.Mesh(bookGeo, bookMat); mesh.position.set(w.x, 0.5, w.z); scene.add(mesh); books.push({ mesh, key }); } }
function facing() { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }
const flashMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(flashMesh); let flashT = 0;
function flash(color) { flashMesh.material.color.set(color); flashT = 0.3; }
function castSlot(i) { const key = slots[i]; if (!key || cds[i] > 0 || state !== 'play') return; SPELLS[key].cast(); cds[i] = SPELLS[key].cd * cdMul; }
const fireballs = [], junk = []; const junkGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2), junkMat = new THREE.MeshLambertMaterial({ color: (equippedSkin('fx') && equippedSkin('fx').junk) || 0x3fbf4a }), bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe08a }), fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
function segDist(a, b, p) { const ab = b.clone().sub(a), ap = p.clone().sub(a); const t = Math.max(0, Math.min(1, ap.dot(ab) / (ab.lengthSq() || 1))); return a.clone().addScaledVector(ab, t).setY(p.y).distanceTo(p); }
let trashDmg = 1;
const GUNS = { trash: { name: 'TRASH', rate: 0.7, dmg: 1, range: 8, speed: 14, pellets: 1, ammo: Infinity, color: 0x3fbf4a }, pistol: { name: 'PISTOL', rate: 0.32, dmg: 2, range: 10, speed: 20, pellets: 1, ammo: 12, color: 0x222222 }, shotgun: { name: 'SHOTGUN', rate: 0.75, dmg: 2, range: 7, speed: 17, pellets: 4, ammo: 6, color: 0x7a4a1a }, rifle: { name: 'RIFLE', rate: 0.16, dmg: 2, range: 12, speed: 24, pellets: 1, ammo: 24, color: 0x2a3a2a } };
let gun = 'trash', ammo = Infinity; const gunDrops = []; const gunGeo = new THREE.BoxGeometry(0.5, 0.14, 0.14); let gunT = 0;
function dropGun(p) { const key = ['pistol', 'shotgun', 'rifle'][(Math.random() * 3) | 0]; const m = new THREE.Mesh(gunGeo, new THREE.MeshLambertMaterial({ color: GUNS[key].color })); m.position.set(p.x, 0.35, p.z); m.userData.key = key; scene.add(m); gunDrops.push(m); }
function clearGuns() { for (const g of gunDrops) scene.remove(g); gunDrops.length = 0; gun = 'trash'; ammo = Infinity; gunT = 0; }
function updateGuns(dt) {
  gunT -= dt; if (gunT <= 0 && gunDrops.length < 1) { gunT = 45; dropGun(randomOpen(6)); }
  for (let i = gunDrops.length - 1; i >= 0; i--) { const g = gunDrops[i]; g.rotation.y += dt * 2; if (g.position.distanceTo(player.position) < 0.9) { scene.remove(g); gunDrops.splice(i, 1); gun = g.userData.key; ammo = GUNS[gun].ammo; mercAmmo(); say(GUNS[gun].name + ' x' + ammo); sfx.pickup(); } }
  if (fireHeld && trashCd <= 0 && !driving && !riding && !game) throwTrash();
}
function throwTrash() { if (trashCd > 0 || state !== 'play') return;
  if (driving && car.userData.kind === 'tank') { trashCd = 1.2; const dir = facing(); const p = car.position.clone().addScaledVector(dir, 1.4); fireballs.push({ pos: p, vel: dir.multiplyScalar(16), t: 0, shell: true }); sfx.boom(); return; }
  let W = GUNS[gun]; let dir = facing(); let best = null, bd = W.range + 1; for (const z of zombies) { const d = z.position.distanceTo(player.position); if (d < bd && lineClear(player.position, z.position)) { bd = d; best = z; } } if (best) dir = best.position.clone().sub(player.position).setY(0).normalize();
  const useGun = gun !== 'trash' && !!best; if (!useGun) W = GUNS.trash; trashCd = W.rate;
  for (let k = 0; k < W.pellets; k++) { const a = W.pellets > 1 ? (k - (W.pellets - 1) / 2) * 0.16 : 0; const v = new THREE.Vector3(dir.x * Math.cos(a) - dir.z * Math.sin(a), 0, dir.x * Math.sin(a) + dir.z * Math.cos(a)); const m = new THREE.Mesh(junkGeo, useGun ? bulletMat : junkMat); if (useGun) m.scale.set(0.9, 0.4, 0.4); m.position.copy(player.position).setY(0.9); m.rotation.y = Math.atan2(v.x, v.z); scene.add(m); junk.push({ mesh: m, vel: v.multiplyScalar(W.speed), t: 0, dmg: W.dmg + trashDmg - 1, life: W.range / W.speed }); }
  if (useGun && --ammo <= 0) { gun = 'trash'; ammo = Infinity; say('Out of ammo. Back to trash.'); } sfx.throw(); }
function updateShots(dt) {
  for (let i = junk.length - 1; i >= 0; i--) { const j = junk[i]; j.mesh.position.addScaledVector(j.vel, dt); j.t += dt; j.mesh.rotation.x += dt * 10; let dead = j.t > (j.life || 0.8) || !openCell(toCell(j.mesh.position.x, j.mesh.position.z, cols, rows)); const prev = j.mesh.position.clone().addScaledVector(j.vel, -dt); for (const z of zombies) if (!dead && segDist(prev, j.mesh.position, z.position) < 0.5) { z.userData.hp -= j.dmg || trashDmg; z.userData.alert = 6; z.userData.stun = Math.max(z.userData.stun, 0.25); dead = true; } if (dead) { scene.remove(j.mesh); junk.splice(i, 1); } }
  for (let i = fireballs.length - 1; i >= 0; i--) { const f = fireballs[i]; f.t += dt; f.pos.addScaledVector(f.vel, dt); if (!f.mesh) { f.mesh = new THREE.Mesh(junkGeo, fireMat); f.mesh.scale.setScalar(f.shell ? 2.4 : 1.6); scene.add(f.mesh); } f.mesh.position.copy(f.pos).setY(0.9); let hit = f.t > 0.7 || !openCell(toCell(f.pos.x, f.pos.z, cols, rows)); const fprev = f.pos.clone().addScaledVector(f.vel, -dt); for (const z of zombies) if (segDist(fprev, f.pos, z.position) < 0.8) hit = true; if (hit) { fx.explode(f.pos, f.shell ? 1.4 : 0.9); if (f.shell) city.knock(f.pos.x, f.pos.z, 2.2, f.vel.x, f.vel.z); for (const z of zombies) if (z.position.distanceTo(f.pos) < (f.shell ? 3.2 : 2.5)) { z.userData.hp -= f.shell ? 6 : 3; if (!z.userData.rag) fling(z, { x: z.position.x - f.pos.x, z: z.position.z - f.pos.z }, 4); } sfx.boom(); scene.remove(f.mesh); fireballs.splice(i, 1); } }
}
function updateActs() { for (let i = 0; i < 3; i++) { const b = document.querySelector('[data-slot="' + i + '"]'); const key = slots[i]; b.textContent = key ? SPELLS[key].name : '—'; b.classList.toggle('empty', !key); b.style.opacity = key && cds[i] > 0 ? 0.5 : ''; } $('trash').style.opacity = trashCd > 0 ? 0.5 : ''; $('trash').textContent = 'FIRE' + (gun === 'trash' ? '' : ' ' + GUNS[gun].name[0] + ammo); }
document.querySelectorAll('[data-slot]').forEach((b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); castSlot(+b.dataset.slot); }); });
let fireHeld = false;
$('trash').addEventListener('pointerdown', (e) => { e.stopPropagation(); fireHeld = true; throwTrash(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('trash').addEventListener(ev, () => { fireHeld = false; });
addEventListener('pointerup', () => { fireHeld = false; });

// ---------- cash and the dawn store ----------
let cash = 0, shoes = 0;
function hudBooks() { $('books').textContent = '📖' + booksFound + ' $' + cash; }
function earn(n) { cash += n; hudBooks(); }
const STORE = [
  { id: 'heart', name: 'Heart', desc: 'One more red heart (max 5).', price: 250 },
  { id: 'flak', name: 'Flak jacket', desc: 'Two blue hearts that take hits first.', price: 300 },
  { id: 'pistol', name: 'Pistol', desc: 'Start the night with 12 rounds.', price: 150 },
  { id: 'shotgun', name: 'Shotgun', desc: 'Four pellets a shot, 6 shells.', price: 250 },
  { id: 'rifle', name: 'Rifle', desc: 'Fast and long range, 24 rounds.', price: 350 },
  { id: 'can', name: 'Gas can', desc: 'Pours itself into a car that runs low.', price: 80 },
  { id: 'shoes', name: 'Running shoes', desc: '+10% walk speed, permanent. Stacks 3 times.', price: 350 },
  { id: 'focus', name: 'Spell focus', desc: 'Spells recharge 30% faster.', price: 400 },
];
function canBuy(it) { if (cash < priceOf(it)) return false;
  if (it.id === 'heart') return maxHearts < 5 || hearts < maxHearts; if (it.id === 'flak') return armor < 2; if (it.id === 'shoes') return shoes < 3; if (it.id === 'focus') return cdMul > 0.7;
  if (GUNS[it.id]) return gun !== it.id || ammo < GUNS[it.id].ammo; if (it.id === 'can') return gasCans < 2; return true; }
const priceOf = (it) => GUNS[it.id] && gun === it.id ? 60 : it.price;
function buy(it) { if (typeof it === 'string') it = STORE.find((x) => x.id === it); if (!it || !canBuy(it)) return; cash -= priceOf(it); sfx.pickup();
  if (it.id === 'heart') addHeart(); else if (it.id === 'flak') addFlak(); else if (it.id === 'can') gasCans++; else if (it.id === 'shoes') shoes++; else if (it.id === 'focus') cdMul = 0.7; else { gun = it.id; ammo = GUNS[gun].ammo; mercAmmo(); }
  hudBooks(); renderStore(); }
function renderStore() { const el = $('store'); el.innerHTML = '<div class="cash">Cash: $' + cash + '</div>' + STORE.map((it) => { const tag = it.id === 'heart' ? ' (' + hearts + '/' + maxHearts + ')' : it.id === 'shoes' ? ' (' + shoes + '/3)' : it.id === 'flak' && armor ? ' (' + armor + ' on)' : GUNS[it.id] && gun === it.id ? ' (' + ammo + ' left, top up)' : it.id === 'focus' && cdMul <= 0.7 ? ' (owned)' : it.id === 'can' && gasCans ? ' (' + gasCans + ')' : '';
  return '<button class="item" data-id="' + it.id + '"' + (canBuy(it) ? '' : ' disabled') + '><span class="iname">' + it.name + tag + '</span><span class="iprice">$' + priceOf(it) + '</span><span class="idesc">' + it.desc + '</span></button>'; }).join('');
  for (const b of el.querySelectorAll('.item')) b.addEventListener('click', () => buy(STORE.find((it) => it.id === b.dataset.id))); }
function dawnStore() { state = 'cleared'; setMusicChase(false); sfx.wave(); const failed = mission && !nightDone; const pay = failed ? Math.round((100 + night * 40) / 2) : 100 + night * 40; hearts = Math.min(maxHearts, hearts + 1); drawHearts(); earn(pay); if (failed) missionDebt *= 1.25; nightDone = false; if (driving) leaveCar();
  for (const z of zombies) { scene.remove(z); pool.push(z); } zombies.length = 0;
  $('dcClearedTitle').innerHTML = 'NIGHT ' + night + '<br>SURVIVED'; $('dcClearedText').innerHTML = 'Zombies dropped: ' + kills + ' · Rescued: ' + rescued + (failed ? '<br><span style="color:#ff6a6a">Mission not finished: half pay, and 25% more of them next night.</span>' : '<br><span style="color:#7dff3a">Night mission done: full pay.</span>') + '<br>Next night: about ' + nightTotal(night + 1) + ' zombies, ' + Math.round(fastFrac(night + 1) * 100) + '% fast.<br><span class="pay">Paid out: $' + pay + '</span>';
  renderStore(); $('dc').classList.add('hidden'); $('dcCleared').classList.remove('hidden'); }
$('dcNext').addEventListener('click', () => { if (state !== 'cleared') return; $('dcCleared').classList.add('hidden'); $('dc').classList.remove('hidden'); state = 'play'; clock = 0; addSurvivors(2); scans = 3; hudScan(); saveGame(); say('Day ' + (night + 1) + '. Get ready before dark.'); });
// ---------- nights ----------
const DAY = 55, NIGHT_LEN = 45, NIGHTS = 6;
const nightTotal = (n) => Math.round(18 * Math.pow(1.4, n - 1) * missionDebt); const fastFrac = (n) => Math.min(1, (n - 1) * 0.15); const nightLen = () => NIGHT_LEN + night * 5; let nightLeft = 0;
// ---------- the base computer and the night missions (Dead City's six, simplified) ----------
const MISSIONS = [
  { title: 'RESCUE', brief: 'Find a survivor and lead them to the green zone.', kind: 'rescue', need: 1, reward: '+1 heart', apply() { addHeart(); } },
  { title: 'POWER', brief: 'Restart the generator at the gas station and bring back the fuel can.', kind: 'fetch', at: 'gas', item: 'Fuel can', game: 'power', reward: 'Trash hits harder', apply() { trashDmg += 1; } },
  { title: 'WATER', brief: 'Prime the pump at the water station and bring back the valve.', kind: 'fetch', at: 'slime', item: 'Pump valve', game: 'water', reward: 'Spells recharge faster', apply() { cdMul = Math.min(cdMul, 0.7); } },
  { title: 'SUPPLIES', brief: 'Collect three crates from the market.', kind: 'collect', at: 'school', need: 3, item: 'Supply crate', reward: 'Flak jacket (2 blue hearts)', apply() { addFlak(); } },
  { title: 'CEMETERY', brief: 'Seal the three crypts. Stand by each one.', kind: 'seal', at: 'cemetery', need: 3, reward: 'Car armour', apply() { carArmor = true; } },
  { title: 'LABORATORY', brief: 'Bring the antidote back from the lab.', kind: 'fetch', at: 'lab', item: 'Antidote', reward: 'Hearts restored and one more to carry', apply() { if (maxHearts < 5) maxHearts++; hearts = maxHearts; } },
];
let mission = null, mIndex = 0, mCount = 0, mCarry = null, cdMul = 1, carArmor = false, rescued = 0, sealT = 0;
const survivors = [], crates = []; const crateGeo = new THREE.BoxGeometry(0.45, 0.4, 0.45), crateMat = new THREE.MeshLambertMaterial({ color: 0xd8a24a });
function placeSurvivors() { for (const s of survivors) scene.remove(s); survivors.length = 0; addSurvivors(5); }
// ---------- mercenaries: 1-2 per map. They flank you, shoot what gets close, and when the ammo runs dry
// they charge in with the rifle butt to drag the horde off you, then come back if they live ----------
const MERC_AMMO = 30; const mercs = []; const mercMark = new THREE.MeshBasicMaterial({ color: 0xffd24a });
function placeMercs() { for (const m of mercs) scene.remove(m); mercs.length = 0; const n = 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) { const m = makeCharacter('vest', { skin: CHAR_SKINS.hunter }); m.scale.setScalar(SCALE); const w = randomOpen(12); m.position.set(w.x, 0, w.z); const mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), mercMark); mk.position.y = 3.6; m.add(mk);
    Object.assign(m.userData, { merc: true, mstate: 'idle', ammo: MERC_AMMO, hp: 3, cd: 0, side: i ? -1 : 1, mark: mk, home: m.position.clone() }); scene.add(m); mercs.push(m); } }
function mercAmmo() { let any = false; for (const m of mercs) if (m.userData.mstate !== 'idle') { m.userData.ammo = MERC_AMMO; if (m.userData.mstate === 'melee') m.userData.mstate = 'return'; any = true; } if (any) say('Mercs reloaded.'); }
function updateMercs(dt) {
  const fw = facing();
  for (let i = mercs.length - 1; i >= 0; i--) { const m = mercs[i], u = m.userData; u.cd -= dt;
    if (u.mstate === 'idle') { u.mark.position.y = 3.6 + Math.sin(performance.now() * 0.004) * 0.3; u.mark.rotation.y += dt * 2; animateWalk(m, dt, 0); m.rotation.y += dt * 0.3;
      if (m.position.distanceTo(player.position) < 1.4) { u.mstate = 'follow'; m.remove(u.mark); say(['Merc: "I\'ve got your back."', 'Merc: "Point me at them."', 'Merc: "Stay close, I\'ll cover you."'][(Math.random() * 3) | 0]); sfx.pickup(); }
      continue; }
    if (driving || riding) { m.visible = false; m.position.copy(player.position); continue; } if (!m.visible) { m.visible = true; const a = Math.random() * 6.28; m.position.set(player.position.x + Math.cos(a), 0, player.position.z + Math.sin(a)); collide(m.position, 0.2); }
    // bitten while in the thick of it
    let biters = 0; for (const z of zombies) if (!z.userData.rag && z.userData.rise == null && z.position.distanceTo(m.position) < 0.5) biters++;
    if (biters) { u.hp -= dt * 0.7 * biters; if (u.hp <= 0) { scene.remove(m); mercs.splice(i, 1); spawnZombie({ x: m.position.x, z: m.position.z }, true); say('A merc went down. He\'s one of them now.'); sfx.hurt(); continue; } }
    let near = null, nd = 99; for (const z of zombies) { if (z.userData.rag || z.userData.rise != null) continue; const dd = z.position.distanceTo(m.position); if (dd < nd) { nd = dd; near = z; } }
    const threat = zombies.filter((z) => !z.userData.rag && z.userData.rise == null && z.position.distanceTo(player.position) < 5);
    let goal = null, spd = 3.0;
    if (u.mstate === 'follow') {
      const right = new THREE.Vector3(fw.z, 0, -fw.x); goal = player.position.clone().addScaledVector(fw, 1.4).addScaledVector(right, 1.7 * u.side);
      if (u.ammo > 0 && near && nd < 7 && u.cd <= 0 && lineClear(m.position, near.position)) { u.cd = 0.55; u.ammo--; const dir = near.position.clone().sub(m.position).setY(0).normalize(); const b = new THREE.Mesh(junkGeo, bulletMat); b.scale.set(0.9, 0.4, 0.4); b.position.copy(m.position).setY(0.9); b.rotation.y = Math.atan2(dir.x, dir.z); scene.add(b); junk.push({ mesh: b, vel: dir.multiplyScalar(20), t: 0, dmg: 2, life: 0.45 }); m.rotation.y = Math.atan2(dir.x, dir.z); sfx.throw(); if (!u.ammo) say('Merc: "I\'m dry! Going in with the stock!"'); }
      if (!u.ammo && threat.length) { u.mstate = 'melee'; u.prey = threat.sort((a, b) => a.position.distanceTo(player.position) - b.position.distanceTo(player.position))[0]; }
    } else if (u.mstate === 'melee') {
      if (!u.prey || !zombies.includes(u.prey) || u.prey.userData.rag) u.prey = threat[0] || (near && nd < 6 ? near : null);
      if (!u.prey) { u.mstate = 'return'; } else { goal = u.prey.position.clone(); spd = 3.2;
        if (m.position.distanceTo(u.prey.position) < 0.8 && u.cd <= 0) { u.cd = 0.6; u.prey.userData.hp -= 1.5; u.prey.userData.stun = Math.max(u.prey.userData.stun, 0.4); sfx.hit(); m.userData.armR.rotation.x = -2.2; }
        for (const z of zombies) if (!z.userData.rag && z.position.distanceTo(m.position) < 6) { z.userData.chase = m; z.userData.chaseT = 3; } }
    }
    if (u.mstate === 'return') { goal = player.position.clone(); spd = 3.3; if (m.position.distanceTo(player.position) < 2.5) u.mstate = 'follow'; }
    if (goal) { const dx = goal.x - m.position.x, dz = goal.z - m.position.z, dl = Math.hypot(dx, dz); if (dl > 0.35) { const st = Math.min(dl, spd * dt); m.position.x += dx / dl * st; m.position.z += dz / dl * st; if (u.cd <= 0.2) m.rotation.y = Math.atan2(dx, dz); collide(m.position, 0.22); animateWalk(m, dt, Math.min(1, dl)); } else animateWalk(m, dt, 0); }
  }
}
// ---------- the city is alive: fleeing cars, runners with zombies on their heels, hordes rising, aircraft going down ----------
const amb = { t: 25, actors: [] };
function farCell(minD) { for (let k = 0; k < 120; k++) { const c = { cx: 1 + ((Math.random() * (cols - 2)) | 0), cy: 1 + ((Math.random() * (rows - 2)) | 0) }; if (!openCell(c)) continue; const w = toWorld(c.cx, c.cy, cols, rows); if (Math.hypot(w.x - player.position.x, w.z - player.position.z) > minD) return c; } return null; }
function routeNear(minD) { for (let k = 0; k < 10; k++) { const a = farCell(minD), b = farCell(8); if (!a || !b) continue; const p = findPath(maze, a, b); if (p.length > 10) return [[a.cx, a.cy], ...p]; } return null; }
function chasers(target, n, fast) { const out = []; const fw = target.position; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; const z = spawnZombie({ x: fw.x - Math.cos(a) * (2 + i * 0.7), z: fw.z - Math.sin(a) * (2 + i * 0.7) }, fast); z.userData.chase = target; z.userData.chaseT = 40; z.userData.speed = Math.max(z.userData.speed, fast ? 2.3 : 2.0); out.push(z); } return out; }
function ambFleeingCar() { const path = routeNear(14); if (!path) return; const c = makeCar(0x8a3a3a); c.scale.setScalar(0.85); const w = toWorld(path[0][0], path[0][1], cols, rows); c.position.set(w.x, 0, w.z); scene.add(c); amb.actors.push({ kind: 'car', obj: c, path, i: 1, speed: 4.6 }); chasers(c, 3 + ((Math.random() * 4) | 0), Math.random() < 0.5); say('An engine roars past. They are chasing it.'); }
function ambRunner() { const path = routeNear(12); if (!path) return; const s = makeCharacter(['worker', 'pink', 'plaid', 'hivis', 'suit'][(Math.random() * 5) | 0], { skin: equippedSkin('npc') }); s.scale.setScalar(SCALE); const w = toWorld(path[0][0], path[0][1], cols, rows); s.position.set(w.x, 0, w.z); scene.add(s); const a = { kind: 'runner', obj: s, path, i: 1, speed: 2.4 }; amb.actors.push(a); a.chasers = chasers(s, 1 + ((Math.random() * 5) | 0), false); sfx.help(0.06); say('Someone is running for their life. Help them!'); }
function ambHorde() { const c = farCell(16); if (!c) return; const w = toWorld(c.cx, c.cy, cols, rows); const n = 8 + ((Math.random() * 8) | 0) + night * 2; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, rr = Math.random() * 3; const z = spawnZombie({ x: w.x + Math.cos(a) * rr, z: w.z + Math.sin(a) * rr }, Math.random() < fastFrac(Math.max(1, night)), 'ground'); } const dir = Math.abs(w.x - player.position.x) > Math.abs(w.z - player.position.z) ? (w.x > player.position.x ? 'east' : 'west') : (w.z > player.position.z ? 'south' : 'north'); say('A horde is rising to the ' + dir + '!'); sfx.wave(); }
function ambCrash() { const live = city.buildings.filter((b) => !b.userData.wrecked && !b.userData.burning); if (!live.length) return; let best = null; for (let k = 0; k < 12; k++) { const b = live[(Math.random() * live.length) | 0]; const p = b.getWorldPosition(new THREE.Vector3()); const dd = Math.hypot(p.x - player.position.x, p.z - player.position.z); if (dd > 7 && dd < 30) { best = { b, p }; break; } } if (!best) return;
  const heli = Math.random() < 0.5; let craft; if (heli) { craft = makeChopper(); craft.scale.setScalar(0.5); } else { craft = new THREE.Group(); const m = (c) => new THREE.MeshLambertMaterial({ color: c }); const part = (sx, sy, sz, x, y, z, c) => { const p = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m(c)); p.position.set(x, y, z); craft.add(p); }; part(0.7, 0.7, 4.2, 0, 0, 0, 0xd6d6e0); part(5, 0.12, 1.1, 0, 0, 0.2, 0xb8bcc8); part(1.8, 0.1, 0.6, 0, 0.1, -1.9, 0xb8bcc8); part(0.1, 0.9, 0.7, 0, 0.5, -1.9, 0xc62828); part(0.5, 0.3, 0.5, 0, 0.15, 2.1, 0x5a86a8); }
  const a = Math.random() * 6.28; const from = new THREE.Vector3(best.p.x + Math.cos(a) * 40, 22, best.p.z + Math.sin(a) * 40); craft.position.copy(from); craft.lookAt(best.p.x, (best.b.userData.h || 2) * 0.6, best.p.z); scene.add(craft);
  amb.actors.push({ kind: 'crash', obj: craft, from, to: new THREE.Vector3(best.p.x, (best.b.userData.h || 2) * 0.6, best.p.z), b: best.b, t: 0, dur: 4.5, heli }); say(heli ? 'A helicopter is going down!' : 'A plane is coming down!'); sfx.whoosh(); }
function updateAmbient(dt) {
  amb.t -= dt; if (amb.t <= 0 && !chopper) { amb.t = isNight ? 14 + Math.random() * 14 : 22 + Math.random() * 20; const r = Math.random(); if (r < 0.3) ambRunner(); else if (r < 0.55) ambFleeingCar(); else if (r < 0.8) ambHorde(); else ambCrash(); }
  for (let i = amb.actors.length - 1; i >= 0; i--) { const a = amb.actors[i], o = a.obj;
    if (a.kind === 'crash') { a.t += dt; const k = Math.min(1, a.t / a.dur); o.position.lerpVectors(a.from, a.to, k); o.position.y = a.from.y + (a.to.y - a.from.y) * (k * k); o.rotation.z += dt * (a.heli ? 4 : 0.6); if (a.heli) animateChopper(o, dt, a.t); if (Math.random() < dt * 20) fx.puff('smoke', o.position.clone(), 0.8);
      if (k >= 1) { scene.remove(o); amb.actors.splice(i, 1); fx.explode(a.to, 2); fx.explode(new THREE.Vector3(a.to.x, 0.3, a.to.z), 1.4); burnBuilding(a.b); if (Math.random() < 0.6) wreckBuilding(a.b); for (const z of zombies) if (!z.userData.rag && z.position.distanceTo(a.to) < 5) fling(z, { x: z.position.x - a.to.x, z: z.position.z - a.to.z }, 9); if (Math.hypot(player.position.x - a.to.x, player.position.z - a.to.z) < 4 && invuln <= 0) { say('Caught in the crash!'); hurt(1); } dropGun({ x: a.to.x + 2, z: a.to.z }); dropLoot({ x: a.to.x - 2, z: a.to.z }, Math.random() < 0.5 ? 'flak' : 'repair'); sfx.boom(); }
      continue; }
    if (!o.parent) { amb.actors.splice(i, 1); continue; }
    const cell = a.path[a.i]; if (!cell) { scene.remove(o); amb.actors.splice(i, 1); continue; }
    const w = toWorld(cell[0], cell[1], cols, rows); const dx = w.x - o.position.x, dz = w.z - o.position.z, dl = Math.hypot(dx, dz);
    if (dl < 0.3) { a.i++; continue; }
    const st = Math.min(dl, a.speed * dt); if (a.kind === 'car') rollVehicle(o, st); o.position.x += dx / dl * st; o.position.z += dz / dl * st; o.rotation.y = Math.atan2(dx, dz);
    if (a.kind === 'car') { if (city.knock(o.position.x, o.position.z, 1.1, dx / dl, dz / dl)) sfx.hit(); for (const z of zombies) if (!z.userData.rag && z.position.distanceTo(o.position) < 1.1) fling(z, { x: z.position.x - o.position.x, z: z.position.z - o.position.z }, 8); if (Math.random() < dt * 8) fx.puff('smoke', new THREE.Vector3(o.position.x, 0.3, o.position.z), 0.4); }
    else { animateWalk(o, dt, 1.4);
      if (o.position.distanceTo(player.position) < 1.3) { amb.actors.splice(i, 1); o.userData.follow = true; o.userData.saved = false; survivors.push(o); for (const z of a.chasers || []) z.userData.chase = null; say('Survivor: "You saved me!"'); sfx.pickup(); earn(40); continue; }
      if ((a.chasers || []).some((z) => zombies.includes(z) && !z.userData.rag && z.position.distanceTo(o.position) < 0.5)) { scene.remove(o); amb.actors.splice(i, 1); spawnZombie({ x: o.position.x, z: o.position.z }, false); sfx.hurt(); say('They got the runner.'); continue; } } }
}
function clearAmbient() { for (const a of amb.actors) scene.remove(a.obj); amb.actors.length = 0; amb.t = 25; }
function addSurvivors(n) { for (let i = 0; i < n; i++) { const s = makeCharacter(['worker', 'pink', 'plaid', 'hivis', 'suit'][(Math.random() * 5) | 0], { skin: equippedSkin('npc') }); s.scale.setScalar(SCALE); const w = randomOpen(10); s.position.set(w.x, 0, w.z); s.userData.follow = false; s.userData.saved = false; scene.add(s); survivors.push(s); } }
// the green zone: the biggest patch of park grass. Survivors wait there and a chopper lifts them out within 5 s
let lz = null, lzChopper = null, lzT = 0, lzUp = false;
const lzRing = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.7, 28), new THREE.MeshBasicMaterial({ color: 0x7dff3a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); lzRing.rotation.x = -Math.PI / 2; lzRing.position.y = 0.06; scene.add(lzRing);
const lzLight = new THREE.Group(); { const c = new THREE.Mesh(new THREE.ConeGeometry(1.8, 12, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); c.position.y = -6; lzLight.add(c); lzLight.position.y = 12; scene.add(lzLight); }
const lzFlag = new THREE.Group(); lzFlag.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd }))); const flagCloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.03), new THREE.MeshBasicMaterial({ color: 0x7dff3a })); flagCloth.position.set(0.27, 0.6, 0); lzFlag.add(flagCloth); lzFlag.children[0].position.y = 0.8; scene.add(lzFlag);
// street signs: a post at spread-out junctions, arms pointing at the nearest landmarks and the green zone
let signsG = null; const signTex = {}; const postMat = new THREE.MeshLambertMaterial({ color: 0x3a3a40 }), armMat = new THREE.MeshLambertMaterial({ color: 0x1f5a2f });
function labelTex(text) { if (signTex[text]) return signTex[text]; const c = document.createElement('canvas'); c.width = 128; c.height = 24; const g = c.getContext('2d'); g.fillStyle = '#1f5a2f'; g.fillRect(0, 0, 128, 24); g.fillStyle = '#fff'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text + ' ▶', 64, 13); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; signTex[text] = t; return t; }
const SIGN_NAMES = { gas: 'GAS', cemetery: 'CEMETERY', lab: 'LAB', slime: 'WATER', school: 'MARKET', ferris: 'FAIR', coaster: 'FAIR', carousel: 'FAIR', base: 'BASE', skate: 'SKATE PARK' };
function buildSigns() {
  if (signsG) scene.remove(signsG); signsG = new THREE.Group(); scene.add(signsG);
  const targets = city.hazards.filter((h) => SIGN_NAMES[h.type]).map((h) => ({ name: SIGN_NAMES[h.type], x: h.pos.x, z: h.pos.z })); targets.push({ name: 'GREEN ZONE', x: lz.x, z: lz.z }); const hp = toWorld(exitCell.cx, exitCell.cy, cols, rows); targets.push({ name: 'HELIPAD', x: hp.x, z: hp.z });
  const spots = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) { if (!openCell({ cx: x, cy: y })) continue; let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (openCell({ cx: x + dx, cy: y + dy })) n++; if (n >= 3) spots.push({ x, y }); }
  spots.sort(() => Math.random() - 0.5); const chosen = []; for (const s of spots) { if (chosen.length >= 14) break; if (chosen.some((c) => Math.abs(c.x - s.x) + Math.abs(c.y - s.y) < 7)) continue; chosen.push(s); }
  for (const s of chosen) { const w = toWorld(s.x, s.y, cols, rows); const px = w.x + 1.15, pz = w.z + 1.15; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6), postMat); post.position.set(px, 1.0, pz); signsG.add(post);
    const near = targets.map((t) => ({ t, d: Math.hypot(t.x - px, t.z - pz) })).filter((o) => o.d > 4).sort((p, q) => p.d - q.d).slice(0, 3);
    near.forEach((o, i) => { const arm = new THREE.Group(); arm.position.set(px, 1.35 + i * 0.2, pz); arm.rotation.y = Math.atan2(o.t.x - px, o.t.z - pz); signsG.add(arm);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.7), armMat); plank.position.z = 0.38; arm.add(plank);
      for (const side of [1, -1]) { const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.15), new THREE.MeshBasicMaterial({ map: labelTex(o.t.name) })); face.position.set(side * 0.017, 0, 0.38); face.rotation.y = side * Math.PI / 2; arm.add(face); } });
  }
}
function findLZ() { let best = null, bs = 0; const sp = toWorld(startCell.cx, startCell.cy, cols, rows);
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) { if (!maze.park || !maze.park(x, y)) continue; let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (maze.park(x + dx, y + dy)) s++; const w = toWorld(x, y, cols, rows); if (Math.hypot(w.x - sp.x, w.z - sp.z) < 6) s -= 3; if (s > bs) { bs = s; best = w; } }
  lz = best || randomOpen(8); lzRing.position.set(lz.x, 0.06, lz.z); lzFlag.position.set(lz.x + 1.4, 0, lz.z); lzLight.position.set(lz.x, 12, lz.z); if (lzChopper) { scene.remove(lzChopper); lzChopper = null; } }
let sigT = 0, shoutT = 0;
function updateSignals(dt) {
  lzLight.rotation.z = Math.sin(performance.now() * 0.0007) * 0.3; lzLight.rotation.x = Math.cos(performance.now() * 0.0007) * 0.3;
  sigT -= dt; shoutT -= dt; const idle = survivors.filter((s) => !s.userData.follow && !s.userData.saved && !s.userData.rag);
  for (const s of idle) { if (!s.userData.flare) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), new THREE.MeshBasicMaterial({ color: 0xff3a3a })); f.position.set(0.9, 0.05, 0); s.add(f); s.userData.flare = f; } s.userData.flare.visible = true;
    if (sigT <= 0) { fx.puff('smoke', new THREE.Vector3(s.position.x + 0.3, 0.3, s.position.z), 1.3); fx.puff('flame', new THREE.Vector3(s.position.x + 0.3, 0.1, s.position.z), 0.35); } }
  for (const s of survivors) if (s.userData.flare && (s.userData.follow || s.userData.saved)) s.userData.flare.visible = false;
  if (sigT <= 0) sigT = 0.12;
  if (shoutT <= 0 && idle.length) { shoutT = 2.5 + Math.random() * 2.5; let bd = 30; for (const s of idle) bd = Math.min(bd, s.position.distanceTo(player.position)); if (bd < 30) sfx.help(0.015 + 0.08 * (1 - bd / 30)); }
}
function updateLZ(dt) {
  if (!lzChopper) { if (survivors.some((s) => s.userData.saved)) { lzChopper = makeChopper(); lzChopper.scale.setScalar(0.45); lzChopper.position.set(lz.x, 14, lz.z); scene.add(lzChopper); lzT = 0; lzUp = false; } return; }
  lzT += dt; animateChopper(lzChopper, dt, lzT);
  if (!lzUp) { lzChopper.position.y = Math.max(1.0, 14 - lzT * 4.5); if (lzT >= 5) { lzUp = true; let n = 0; for (let i = survivors.length - 1; i >= 0; i--) if (survivors[i].userData.saved) { scene.remove(survivors[i]); survivors.splice(i, 1); rescued++; n++; earn(100); if (mission && mission.kind === 'rescue') mCount++; } say('Chopper lifted ' + n + ' out. ' + rescued + ' rescued.'); sfx.wave(); lzT = 0; } }
  else { lzChopper.position.y = 1 + lzT * lzT * 2.5; if (lzChopper.position.y > 18) { scene.remove(lzChopper); lzChopper = null; } }
}
function startMission(i) {
  mission = MISSIONS[i] || null; mCount = 0; mCarry = null; for (const c of crates) scene.remove(c); crates.length = 0; if (!mission) { beacon.visible = false; $('mission').textContent = 'All missions done. Make it to the helipad after night ' + NIGHTS + '.'; return; }
  if (mission.kind === 'fetch') { const p = poi(mission.at); const c = new THREE.Mesh(crateGeo, crateMat); c.position.set(p.x + 1.9, 0.2, p.z + 1.2); scene.add(c); crates.push(c); }
  if (mission.kind === 'collect') { const p = poi(mission.at); for (let k = 0; k < mission.need; k++) { const c = new THREE.Mesh(crateGeo, crateMat); const a = k * 2.1; c.position.set(p.x + Math.cos(a) * 2.2, 0.2, p.z + Math.sin(a) * 2.2); scene.add(c); crates.push(c); } }
  say('Mission: ' + mission.title + '. ' + mission.brief); $('mission').textContent = mission.title + ' · ' + mission.brief;
}
let nightDone = false, missionDebt = 1;
function completeMission() { say('Mission complete! ' + mission.reward); mission.apply(); sfx.wave(); mIndex++; if (isNight && !nightDone) { nightDone = true; earn(250); hearts = maxHearts; say('Night mission done: +$250 and hearts restored.'); } drawHearts(); startMission(mIndex); }
function updateMissions(dt) {
  const base = lz; const nearBase = Math.hypot(player.position.x - base.x, player.position.z - base.z) < 2.6; updateLZ(dt); updateSignals(dt); updateScan(dt);
  // survivors: walk up to recruit, lead them home
  for (let i = survivors.length - 1; i >= 0; i--) { const s = survivors[i]; const d = s.position.distanceTo(player.position);
    if (s.userData.rag) { const rg = s.userData.rag; rg.t += dt; rg.vel.y -= 16 * dt; s.position.addScaledVector(rg.vel, dt); s.rotation.x += dt * 8; if (s.position.y <= 0 && rg.t > 0.3) { s.position.y = 0; s.rotation.x = 0; s.userData.rag = null; collide(s.position, 0.2); } continue; }
    if (s.userData.aboard) { s.position.copy(player.position); continue; }
    if (s.userData.saved) { animateWalk(s, dt, 0); s.rotation.y += dt; continue; }
    if (!s.userData.follow && d < 1.0) { s.userData.follow = true; say('Survivor: "Get me out of here!"'); sfx.pickup(); }
    if (s.userData.follow) { const lead = i > 0 && survivors[i - 1].userData.follow && !survivors[i - 1].userData.saved ? survivors[i - 1].position : player.position; const dx = lead.x - s.position.x, dz = lead.z - s.position.z, dl = Math.hypot(dx, dz); if (dl > 0.8) { s.position.x += dx / dl * 2.2 * dt; s.position.z += dz / dl * 2.2 * dt; s.rotation.y = Math.atan2(dx, dz); collide(s.position, 0.2); animateWalk(s, dt, 1); } else animateWalk(s, dt, 0);
      if (Math.hypot(s.position.x - base.x, s.position.z - base.z) < 2.2) { s.userData.saved = true; s.userData.follow = false; say('Survivor at the green zone. Chopper inbound.'); sfx.pickup(); } }
    else { const u2 = s.userData; if (!u2.home) u2.home = s.position.clone(); u2.wt = (u2.wt || 0) - dt; if (u2.wt <= 0) { u2.wt = 2 + Math.random() * 4; const a = Math.random() * 6.28, rr = Math.random() * 2.2; u2.wgo = new THREE.Vector3(u2.home.x + Math.cos(a) * rr, 0, u2.home.z + Math.sin(a) * rr); if (Math.random() < 0.35) u2.wgo = null; }
      if (u2.wgo) { const dx = u2.wgo.x - s.position.x, dz = u2.wgo.z - s.position.z, dl = Math.hypot(dx, dz); if (dl > 0.2) { s.position.x += dx / dl * 0.9 * dt; s.position.z += dz / dl * 0.9 * dt; s.rotation.y = Math.atan2(dx, dz); collide(s.position, 0.2); animateWalk(s, dt, 0.5); } else { u2.wgo = null; animateWalk(s, dt, 0); } } else { animateWalk(s, dt, 0); s.rotation.y += Math.sin(performance.now() * 0.001 + s.id) * dt * 0.6; } } }
  if (chopper) { const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows); beacon.visible = true; beacon.position.set(ep.x, 5, ep.z); return; }
  if (!mission) return;
  let target = base;
  if (mission.kind === 'rescue') { if (mCount >= mission.need) completeMission(); else { const s = survivors.find((x) => !x.userData.follow); target = survivors.some((x) => x.userData.follow) ? base : s ? s.position : base; } }
  else if (mission.kind === 'fetch' || mission.kind === 'collect') {
    for (let i = crates.length - 1; i >= 0; i--) { const c = crates[i]; c.rotation.y += dt; if (c.position.distanceTo(player.position) < 0.9) {
      if (mission.game && !c.done) { if (!game) openGame(mission.game, c); continue; } // power and water: beat the mini-game first (the game marks the crate done)
      scene.remove(c); crates.splice(i, 1); mCarry = mission.item; if (!mission.game) mCount++; say(mission.kind === 'collect' && mCount < mission.need ? mission.item + ' ' + mCount + '/' + mission.need + '.' : 'Got the ' + mission.item.toLowerCase() + '. Back to the green zone.'); sfx.pickup(); } }
    const done = mission.kind === 'fetch' ? mCount >= 1 : mCount >= mission.need;
    if (done && nearBase) completeMission(); else target = crates.length && !(mission.kind === 'fetch' && mCount) ? crates[0].position : base;
  }
  else if (mission.kind === 'seal') { const p = poi(mission.at); const cr = [[-0.9, -0.9], [0, -0.9], [0.9, -0.9]]; const k = mCount; if (k >= mission.need) { if (nearBase) completeMission(); target = base; } else { const cx = p.x + cr[k][0], cz = p.z + cr[k][1] - 1.2; target = new THREE.Vector3(cx, 0, cz); if (Math.hypot(player.position.x - cx, player.position.z - cz) < 1.4) { sealT += dt; if (sealT > 2) { sealT = 0; mCount++; say('Crypt sealed ' + mCount + '/3'); sfx.hit(); for (let q = 0; q < 3; q++) spawnZombie({ x: p.x + (Math.random() - 0.5) * 2, z: p.z + 2.2 }, night >= 3, 'ground'); } } else sealT = 0; } }
  beacon.visible = true; beacon.position.set(target.x, 5, target.z); scanTarget = target;
}
let scans = 3, scanTarget = null; const ripples = []; const rippleGeo = new THREE.RingGeometry(0.75, 1, 32);
function hudScan() { $('scan').textContent = 'SCAN' + scans; $('scan').style.opacity = scans > 0 ? '' : 0.4; }
function doScan() { if (state !== 'play' || scans <= 0) return; scans--; hudScan(); sfx.wave();
  let t = scanTarget; if (!t) { const idle = survivors.filter((s) => !s.userData.follow && !s.userData.saved); t = idle.length ? idle.sort((p, q) => p.position.distanceTo(player.position) - q.position.distanceTo(player.position))[0].position : lz; }
  const dir = new THREE.Vector3(t.x - player.position.x, 0, t.z - player.position.z); const dist = dir.length(); dir.normalize();
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0x7dff3a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.copy(player.position).setY(0.08); scene.add(m); ripples.push({ m, t: -i * 0.25, dir, reach: Math.min(dist, 7) }); }
  say(dist < 4 ? 'It is right here.' : 'The ripple leans the way to go. ' + Math.round(dist / 3) + ' blocks.'); }
function updateScan(dt) { for (let i = ripples.length - 1; i >= 0; i--) { const rp = ripples[i]; rp.t += dt; if (rp.t < 0) continue; const k = rp.t / 1.4; if (k >= 1) { scene.remove(rp.m); ripples.splice(i, 1); continue; } rp.m.scale.setScalar(0.5 + k * 5); rp.m.material.opacity = 0.8 * (1 - k); rp.m.position.copy(player.position).setY(0.08).addScaledVector(rp.dir, k * rp.reach); } }
$('scan').addEventListener('pointerdown', (e) => e.stopPropagation()); $('scan').addEventListener('click', doScan);
let night = 0, clock = 0, isNight = false, chopper = null, chopperT = 0, extracting = false, spawnT = 0;
function callChopper() { if (chopper) return; for (let i = zombies.length - 1; i >= 0; i--) if (Math.random() < 0.7) { const z = zombies[i]; scene.remove(z); zombies.splice(i, 1); pool.push(z); fx.puff('smoke', new THREE.Vector3(z.position.x, 0.2, z.position.z), 0.5); } chopper = makeChopper(); chopper.scale.setScalar(0.6); chopperT = 0; const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows); chopper.position.set(ep.x, 14, ep.z); scene.add(chopper); beacon.visible = true; beacon.position.set(ep.x, 5, ep.z); say('Dawn. The chopper is landing at the helipad!'); sfx.wave(); }
function updateNights(dt) {
  clock += dt;
  if (!isNight && clock > DAY && night < NIGHTS) { isNight = true; night++; clock = 0; nightDone = false; nightLeft = nightTotal(night); if (mission) setTimeout(() => say('Tonight: ' + mission.title + '. Finish it before dawn for a bonus.'), 3200); if (night > 1) spawnRate *= 1.1 + Math.random() * 0.2; say('Night ' + night + ' falls. ' + nightLeft + ' of them are coming.'); sfx.wave(); for (let k = 0; k < Math.round(nightLeft * 0.1); k++) { nightLeft--; spawnZombie(randomOpen(10), Math.random() < fastFrac(night), 'ground'); } }
  if (isNight && clock > nightLen()) { isNight = false; clock = 0; nightLeft = 0; if (night >= NIGHTS) callChopper(); else { dawnStore(); return; } }
  const dark = isNight ? Math.min(1, clock / 6) : Math.max(0, 1 - clock / 6);
  hemi.intensity = 1.7 - dark * 1.1; sun.intensity = 0.9 - dark * 0.6; const fogFar = iso ? 50 : 0; scene.fog.near = fogFar + 30 - dark * 14; scene.fog.far = fogFar + 70 - dark * 30;
  { const k = weather.k; let wn = scene.fog.near, wf = scene.fog.far; if (weather.type === 'sand') { wn = fogFar + 3; wf = fogFar + 16; } else if (weather.type === 'fog') { wn = fogFar + 1.5; wf = fogFar + 11; } else if (weather.type === 'rain' || weather.type === 'storm') { wn -= 10; wf -= 25; } scene.fog.near += (wn - scene.fog.near) * k; scene.fog.far += (wf - scene.fog.far) * k; } hemi.intensity += lightFlash * 8;
  spawnT -= dt; if (spawnT <= 0) { if (isNight && nightLeft > 0 && zombies.length < 120) { spawnT = nightLen() * 0.8 / nightTotal(night) / spawnRate; nightLeft--; spawnFrom(Math.random() < fastFrac(night)); } else if (!isNight && !chopper && zombies.length < 4) { spawnT = 6; spawnFrom(false); } else spawnT = 0.5; }
  $('night').textContent = (night >= NIGHTS && !isNight ? 'Dawn' : (isNight ? 'N' : 'D') + (isNight ? night : night + 1) + '/' + NIGHTS) + (weather.type !== 'clear' ? ' ' + WEATHER[weather.type] : ''); $('veh').textContent = (driving ? vstat().name + ' ♥' + carHp + ' ⛽' + Math.round(car.userData.fuel) + '%' : '') + (gasCans ? ' 🛢' + gasCans : '') + (repairKits ? ' 🔧' + repairKits : ''); $('clock').textContent = isNight ? ((nightLen() - clock) | 0) + 's · ' + (zombies.length + nightLeft) + ' left' : night >= NIGHTS ? 'helipad!' : ((DAY - clock) | 0) + 's';
  if (chopper) { chopperT += dt; animateChopper(chopper, dt, chopperT); const ep = toWorld(exitCell.cx, exitCell.cy, cols, rows); chopper.position.y = Math.max(1.1, 14 - chopperT * 4); if (!extracting && Math.hypot(player.position.x - ep.x, player.position.z - ep.z) < 1.5 && chopper.position.y <= 1.2) { extracting = true; chopperT = 0; } if (extracting) { chopper.position.y = 1.1 + chopperT * chopperT * 2; player.position.set(ep.x, chopper.position.y - 0.6, ep.z); if (chopperT > 3) gameOver(true); } }
}
// ---------- mini-games: PUMP (tap to fill a leaking meter) and KEYS (hit the needle in the zone three times) ----------
let game = null;
function openGame(mode, veh) { if (zombies.some((z) => !z.userData.rag && z.position.distanceTo(player.position) < 4)) { say('Too dangerous with them this close.'); sfx.hit(); return; } game = { mode, veh, fill: 0, time: 8, t: 0, hits: 0, zoneC: 0.5, zoneW: 0.26, speed: 2.4 }; state = 'game'; $('dcGame').classList.remove('hidden'); $('gTitle').textContent = { pump: 'GAS PUMP', keys: 'FIND THE KEYS', ride: 'RIDE OPERATOR', power: 'POWER STATION', water: 'WATER PUMP' }[mode]; $('gText').textContent = { pump: 'Tap PUMP fast. The hose leaks, so keep going until the tank is full.', keys: 'Hotwire it: tap when the needle is in the green. Three good hits.', ride: 'Start the motor: tap when the needle is in the green. Three good hits.', power: 'Sync the generator: tap when the needle is in the green. Three good hits.', water: 'Prime the pump: tap fast until the pressure is full.' }[mode]; const needle = mode !== 'pump' && mode !== 'water'; $('gHit').textContent = needle ? 'HIT' : 'PUMP'; $('gZone').style.display = needle ? '' : 'none'; $('gNeedle').style.display = needle ? '' : 'none'; $('gFill').style.width = '0%'; game.needle = needle; if (needle) placeZone(); }
function placeZone() { game.zoneC = 0.2 + Math.random() * 0.6; $('gZone').style.left = ((game.zoneC - game.zoneW / 2) * 100) + '%'; $('gZone').style.width = (game.zoneW * 100) + '%'; }
function closeGame() { $('dcGame').classList.add('hidden'); game = null; if (state === 'game') state = 'play'; }
function updateGame(dt) { if (!game.needle) { game.time -= dt; game.fill = Math.max(0, game.fill - dt * 0.25); $('gFill').style.width = (game.fill * 100) + '%'; $('gText').textContent = Math.max(0, game.time).toFixed(1) + ' s left'; if (game.time <= 0) { game.time = 8; game.fill = 0; sfx.hit(); } } else { game.t += dt * game.speed; game.pos = 0.5 + 0.5 * Math.sin(game.t); $('gNeedle').style.left = (game.pos * 100) + '%'; } }
$('gHit').addEventListener('click', () => { if (!game || game.done) return;
  if (!game.needle) { game.fill += 0.14; sfx.throw(); if (game.fill >= 1) { game.done = true; gameWon(); } }
  else if (Math.abs(game.pos - game.zoneC) < game.zoneW / 2) { game.hits++; sfx.pickup(); $('gFill').style.width = (game.hits / 3 * 100) + '%'; if (game.hits >= 3) { game.done = true; gameWon(); } else { game.speed += 0.8; game.zoneW = Math.max(0.14, game.zoneW - 0.05); placeZone(); } }
  else { game.hits = 0; sfx.hit(); $('gFill').style.width = '0%'; } });
function gameWon() { sfx.wave(); const g = game; setTimeout(() => { closeGame();
  if (g.mode === 'pump') { g.veh.userData.fuel = 100; say('Tank full.'); }
  else if (g.mode === 'keys') { g.veh.userData.keys = true; say('Got the keys!'); enterCar(g.veh); }
  else if (g.mode === 'ride') startRide(g.veh);
  else { mCount++; g.veh.done = true; say('Done. Back to the green zone.'); } }, 450); }
$('gClose').addEventListener('click', closeGame);
// ---------- fairground rides: three spins, zombies swarm the ride and get flung ----------
let riding = null;
function startRide(ride) { riding = { ride, ang: 0, back: player.position.clone(), hits: 0 }; ride.speed = ride.type === 'coaster' ? 6 : ride.type === 'carousel' ? 5 : 4; if (driving) leaveCar(); boardFollowers(true); say('Three spins. Hold on!'); sfx.pickup(); }
function updateRide(dt) {
  const ride = riding.ride; let done = 0; const pu = player.userData;
  if (ride.type === 'ferris') { const w = ride.wheel; riding.ang += dt * 0.35 * ride.speed; done = Math.floor(riding.ang / (Math.PI * 2)); const a = w.rotation.z; w.updateWorldMatrix(true, false); const p = w.localToWorld(new THREE.Vector3(Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0)); player.position.set(p.x, p.y - 0.3, p.z + 0.1); }
  else if (ride.type === 'coaster') { riding.ang += dt * 0.05 * ride.speed; done = Math.floor(riding.ang); const p = ride.curve.getPointAt(ride.u), t = ride.curve.getTangentAt(ride.u); player.position.set(p.x, p.y + 0.02, p.z); player.rotation.y = Math.atan2(t.x, t.z); }
  else { const pl = ride.platform; riding.ang += dt * 0.3 * ride.speed; done = Math.floor(riding.ang / (Math.PI * 2)); pl.updateWorldMatrix(true, false); const p = ride.horses[0].getWorldPosition(new THREE.Vector3()); player.position.set(p.x, p.y - 0.1, p.z); }
  animateWalk(player, dt, 0); pu.legL.rotation.x = pu.legR.rotation.x = -1.4;
  for (const z of zombies) { if (z.userData.rag) continue; z.userData.alert = 6; const dx = z.position.x - ride.pos.x, dz = z.position.z - ride.pos.z; if (Math.hypot(dx, dz) < 2.1) { fling(z, { x: dx, z: dz }, 8); riding.hits++; } }
  const exiting = done >= 3; say(exiting ? 'Exiting' : 'Spin ' + (done + 1) + '/3'); if (exiting) ride.speed = Math.max(1, ride.speed - dt * 3);
  if (exiting && ride.speed <= 1) { player.position.copy(riding.back); player.position.y = 0; invuln = 1.5; say(riding.hits ? 'Strike! ' + riding.hits + ' flung.' : 'Fun ride.'); riding = null; boardFollowers(false); }
}
// ---------- weather: sand, fog, rain, lightning storms, tornadoes ----------
const SKY = scene.background.clone(); const WEATHER = { clear: 'Clear', sand: 'Sandstorm', fog: 'Fog', rain: 'Rain', storm: 'Lightning storm', tornado: 'TORNADO' };
const weather = { type: 'clear', t: 0, next: 30, k: 0, fading: false }; let rainLine = null, boltT = 0, lightFlash = 0; let boltLife = 0; const bolts = [], pendingBolts = []; const boltMat = new THREE.LineBasicMaterial({ color: 0xffffff }), boltGlow = new THREE.LineBasicMaterial({ color: 0x8ad0ff, transparent: true, opacity: 0.6 }); const markGeo = new THREE.RingGeometry(0.5, 0.9, 24), markMat = new THREE.MeshBasicMaterial({ color: 0x4a9aff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
function boltLine(p) { const pts = []; let x = p.x + (Math.random() - 0.5) * 3, z = p.z + (Math.random() - 0.5) * 3; for (let y = 18; y > 0; y -= 1.5) { pts.push(new THREE.Vector3(x, y, z)); x += (x < p.x ? 1 : -1) * Math.random() * 0.9 + (Math.random() - 0.5) * 0.5; z += (z < p.z ? 1 : -1) * Math.random() * 0.9 + (Math.random() - 0.5) * 0.5; } pts.push(new THREE.Vector3(p.x, 0, p.z));
  const g = new THREE.Group(); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), boltMat)); for (const o of [[0.08, 0], [-0.08, 0], [0, 0.08], [0, -0.08]]) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((q) => new THREE.Vector3(q.x + o[0], q.y, q.z + o[1]))), boltGlow); g.add(l); }
  const bi = 3 + ((Math.random() * 4) | 0); const bp = [pts[bi]]; for (let i = 1; i < 4; i++) bp.push(new THREE.Vector3(pts[bi].x + i * (Math.random() - 0.5) * 1.6, pts[bi].y - i * 1.4, pts[bi].z + i * (Math.random() - 0.5) * 1.6)); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bp), boltGlow)); return g; }
function setWeather(type) { if (type === 'clear') { if (weather.type !== 'clear') { weather.fading = true; return; } weather.k = 0; weather.fading = false; weather.next = 25 + Math.random() * 35; return; } weather.type = type; weather.k = 0; weather.fading = false; weather.t = 18 + Math.random() * 20; weather.next = 25 + Math.random() * 35;
  if (type !== 'clear') { say(WEATHER[type] + (type === 'storm' ? '! Lightning can hit you, and it charges the dead.' : type === 'tornado' ? '! Run!' : '.')); sfx.whoosh(); }
  if (type === 'tornado') { const w = randomOpen(14); const a = Math.random() * Math.PI * 2; spawnTornado(w, { x: Math.sin(a), z: Math.cos(a) }, { life: weather.t, radius: 3.4, speed: 1.8, big: true }); } }
function strike() { const near = night >= 3 && Math.random() < 0.25; const a = Math.random() * Math.PI * 2, rr = near ? Math.random() * 1.5 : 2 + Math.random() * 9; const p = new THREE.Vector3(player.position.x + Math.sin(a) * rr, 0, player.position.z + Math.cos(a) * rr); const mark = new THREE.Mesh(markGeo, markMat.clone()); mark.rotation.x = -Math.PI / 2; mark.position.set(p.x, 0.05, p.z); scene.add(mark); pendingBolts.push({ p, mark, t: 2.5 }); }
function landBolt(p) { const g = boltLine(p); scene.add(g); bolts.push({ g, t: 0.18 }); lightFlash = 0.3; sfx.boom(); fx.ignite(new THREE.Vector3(p.x, 0.2, p.z), 0.3, 1.5);
  if (Math.hypot(player.position.x - p.x, player.position.z - p.z) < 1.4 && invuln <= 0) { say('Struck by lightning!'); if (hurt(1)) return; }
  for (const z of zombies) if (Math.hypot(z.position.x - p.x, z.position.z - p.z) < 2.5) { z.userData.charged = 8; z.userData.alert = 6; if (!z.userData.spark) { const sp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.35, depthWrite: false })); sp.position.y = 2.6; z.add(sp); z.userData.spark = sp; } z.userData.spark.visible = true; } }
function updateWeather(dt) {
  if (weather.type === 'clear') { weather.next -= dt; if (weather.next <= 0) setWeather(['sand', 'fog', 'rain', 'storm', 'tornado'][(Math.random() * 5) | 0]); }
  else if (weather.fading) { weather.k = Math.max(0, weather.k - dt / 4); if (weather.k <= 0) { weather.type = 'clear'; weather.fading = false; weather.next = 25 + Math.random() * 35; } }
  else { weather.k = Math.min(1, weather.k + dt / 4); weather.t -= dt; if (weather.t <= 0) { setWeather('clear'); say('The weather clears.'); } }
  if (rainLine) { const wet = weather.type === 'rain' || weather.type === 'storm'; rainLine.visible = wet && weather.k > 0; rainLine.material.opacity = 0.3 * weather.k; }
  if (weather.type === 'storm' && weather.k > 0.5) { boltT -= dt; if (boltT <= 0) { boltT = 1 + Math.random() * 2.5; strike(); } }
  for (let i = pendingBolts.length - 1; i >= 0; i--) { const b = pendingBolts[i]; b.t -= dt; const k = 1 - b.t / 2.5; b.mark.scale.setScalar(1 + k * 1.2); b.mark.material.opacity = 0.25 + k * 0.55 + Math.sin(performance.now() * 0.02) * 0.1; if (b.t <= 0) { scene.remove(b.mark); pendingBolts.splice(i, 1); landBolt(b.p); } }
  for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.t -= dt; b.g.visible = Math.random() < 0.85; if (b.t <= 0) { scene.remove(b.g); bolts.splice(i, 1); } }
  lightFlash = Math.max(0, lightFlash - dt);
  const col = weather.type === 'sand' ? 0xc9a35a : weather.type === 'fog' ? 0x8f9aa0 : weather.type === 'storm' ? 0x2a2838 : null; const want = col == null ? SKY : new THREE.Color(col); scene.fog.color.lerp(want, Math.min(1, dt * 0.6)); scene.background.copy(scene.fog.color);
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
    if (Math.hypot(mx, my) > 0.08) goRoute = [];
    else if (goRoute.length && !riding && !toss) { const w = toWorld(goRoute[0][0], goRoute[0][1], cols, rows); const dx = w.x - player.position.x, dz = w.z - player.position.z, dl = Math.hypot(dx, dz); if (dl < 0.4) goRoute.shift(); else { const cy0 = iso ? ISO_YAW + Math.PI : camYaw; const fwd = new THREE.Vector3(Math.sin(cy0), 0, Math.cos(cy0)), right = new THREE.Vector3(-fwd.z, 0, fwd.x); const d = new THREE.Vector3(dx / dl, 0, dz / dl); mx = d.dot(right); my = -d.dot(fwd); } }
    const mag = Math.min(1, Math.hypot(mx, my)) * (goRoute.length && stick.id === null ? 0.94 : 1);
    if (toss) { toss.y -= 16 * dt; player.position.addScaledVector(toss, dt); player.rotation.x += dt * 6; if (player.position.y <= 0) { player.position.y = 0; player.rotation.x = 0; toss = null; collide(player.position, 0.25); } }
    carMoving = false; if (!toss && !riding) clampToGrid(player.position, 0.25); if (car && driving) clampToGrid(car.position, 0.6);
    if (mag > 0.08 && !extracting && !riding && !toss) { carMoving = driving;
      const cy = iso ? ISO_YAW + Math.PI : camYaw; const fwd = new THREE.Vector3(Math.sin(cy), 0, Math.cos(cy)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const dir = fwd.multiplyScalar(-my).add(right.multiplyScalar(mx)).normalize(); yaw = Math.atan2(dir.x, dir.z); if (look.id === null && !iso) { let dd = yaw - camYaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); camYaw += dd * Math.min(1, dt * 2.5); }
      const held = zombies.some((z) => z.userData.latch > 0) ? 0.3 : 1; const sprint = (mag > 0.95 ? 1.45 : 1) * held; if (driving) { const u = car.userData; if (u.fuel > 0) { u.fuel = Math.max(0, u.fuel - vstat().burn * mag * dt); car.position.addScaledVector(dir, vstat().speed * mag * dt); rollVehicle(car, vstat().speed * mag * dt); collideCar(car.position); car.rotation.y = yaw; player.position.copy(car.position); if (city.knock(car.position.x, car.position.z, 1.3, dir.x, dir.z)) sfx.hit(); } else if (!outOfGasSaid) { outOfGasSaid = true; say('Out of gas. Find the gas station, or walk.'); } } else { player.position.addScaledVector(dir, 2.0 * (1 + shoes * 0.1) * mag * sprint * dt); collide(player.position, 0.25); player.rotation.y = yaw; animateWalk(player, dt, mag * sprint); }
    } else { animateWalk(player, dt, 0); if (look.id === null && stick.id === null) { let d = yaw - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); camYaw += d * Math.min(1, dt * 2); } }
    player.visible = !driving && (invuln <= 0 || Math.sin(now * 0.03) > 0);
    for (let i = books.length - 1; i >= 0; i--) { const b = books[i]; b.mesh.rotation.y += dt * 2; b.mesh.position.y = 0.5 + Math.sin(now * 0.004 + i) * 0.1; if (b.mesh.position.distanceTo(player.position) < 0.9) { scene.remove(b.mesh); books.splice(i, 1); booksFound++; const free = slots.indexOf(null); slots[free >= 0 ? free : booksFound % 3] = b.key; say('Spell book: ' + SPELLS[b.key].name); sfx.pickup(); hudBooks(); } }
    if (riding) updateRide(dt);
    updateZombies(dt); if (state !== 'play') return; updateShots(dt); updateStill(dt); updateCarNoise(dt); updateAmbient(dt); updateMercs(dt); updateGuns(dt); updateFlame(dt); updateChains(dt); updateCans(dt); updateCorpses(dt); updateTornadoes(dt); updateWeather(dt); updateNights(dt); updateMissions(dt); fx.update(dt); updateActs();
    flashT -= dt; flashMesh.position.copy(player.position).setY(1); flashMesh.scale.setScalar(1 + (0.3 - Math.max(0, flashT)) * 20); flashMesh.material.opacity = Math.max(0, flashT) * 2;
    if (city) city.updateRain(dt);
  }
  // third-person camera: behind and above, buildings in between go see-through
  const back = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  const target = (driving ? car : player).position.clone().setY(driving ? 1.0 : 0.6); const want = target.clone().addScaledVector(back, (driving ? 8 : 5.5) * zoom).add(new THREE.Vector3(0, (driving ? 4.5 : 3.2) * zoom, 0));
  camera.position.lerp(want, 1 - Math.pow(0.001, dt)); camera.lookAt(target);
  isoCam.position.copy(target).addScaledVector(isoDir, 60); isoCam.lookAt(target); const cam = iso ? isoCam : camera;
  if (city) { const cd = cam.position.clone().sub(target); const ch = Math.hypot(cd.x, cd.z) || 1, ux = cd.x / ch, uz = cd.z / ch, slope = cd.y / ch;
    for (const b of city.buildings) { const wp = b.getWorldPosition(fadeTmp); const rx = wp.x - target.x, rz = wp.z - target.z; const d = rx * ux + rz * uz; const perp = Math.abs(-rx * uz + rz * ux); const h = b.userData.h || 2;
      const fade = iso && d > 0.3 && d < ch + 1 && perp < 2.2 && h > target.y + d * slope - 0.6; const op = fade ? 0.15 : 1; for (const m of b.userData.fade) if (m.opacity !== op) m.opacity = op; if (b.userData.extras) for (const e of b.userData.extras) e.visible = !fade; if (b.userData.edges) b.userData.edges.visible = fade; } }
  if (city && city.detail) city.detail.sky(iso);
  drawInDbg();
  renderer.render(scene, cam);
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); const a = innerWidth / innerHeight, half = (a < 1 ? 8 / a * 0.8 : 8) * zoom; isoCam.left = -half * a; isoCam.right = half * a; isoCam.top = half; isoCam.bottom = -half; isoCam.updateProjectionMatrix(); }
$('view').addEventListener('pointerdown', (e) => { e.stopPropagation(); iso = !iso; $('view').textContent = iso ? 'ISO' : '3RD'; });
addEventListener('resize', resize); resize();

// ---------- start / end ----------
// ---- save: the game as it stands at the start of a day ----
const SAVE_KEY = 'oo_save_dc';
function saveGame() { const s = { night, hearts, maxHearts, armor, cash, shoes, cdMul, gun, ammo: ammo === Infinity ? null : ammo, gasCans, repairKits, missionDebt, slots: slots.slice(), booksFound, kills, rescued, mIndex, trashDmg, carArmor }; try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
function loadGame() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } }
function clearGame() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
function applySave(s) { night = s.night || 0; hearts = s.hearts; maxHearts = s.maxHearts; armor = s.armor || 0; cash = s.cash || 0; shoes = s.shoes || 0; cdMul = s.cdMul || 1; gun = s.gun || 'trash'; ammo = s.ammo == null ? Infinity : s.ammo; gasCans = s.gasCans || 0; repairKits = s.repairKits || 0; missionDebt = s.missionDebt || 1; for (let i = 0; i < 3; i++) { const k = (s.slots || [])[i]; slots[i] = k && SPELLS[k] ? k : null; } booksFound = s.booksFound || 0; kills = s.kills || 0; rescued = s.rescued || 0; mIndex = s.mIndex || 0; trashDmg = s.trashDmg || 1; carArmor = !!s.carArmor;
  for (let i = books.length - 1; i >= 0; i--) if (slots.includes(books[i].key)) { scene.remove(books[i].mesh); books.splice(i, 1); } drawHearts(); hudBooks(); startMission(mIndex); clock = 0; isNight = false; }
// ---- pause ----
function pauseGame() { if (state !== 'play') return; state = 'paused'; setMusicChase(false); stick.id = null; stick.x = stick.y = 0; knob.style.transform = 'translate(-50%, -50%)'; look.id = null; $('dcPauseText').textContent = (isNight ? 'Night ' : 'Day after night ') + night + ' · $' + cash + '. Saving keeps your hearts, cash, gear and spells from the start of this day.'; $('dc').classList.add('hidden'); $('dcPaused').classList.remove('hidden'); }
function resumeGame() { if (state !== 'paused') return; $('dcPaused').classList.add('hidden'); $('dc').classList.remove('hidden'); state = 'play'; }
$('dcPause').addEventListener('pointerdown', (e) => e.stopPropagation()); $('dcPause').addEventListener('click', pauseGame); $('dcResume').addEventListener('click', resumeGame);
$('dcSave').addEventListener('click', () => { saveGame(); location.href = 'index.html'; }); $('dcQuit').addEventListener('click', () => { location.href = 'index.html'; });
addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'p') { if (state === 'play') pauseGame(); else if (state === 'paused') resumeGame(); } });
{ const sv = loadGame(); if (sv) { $('dcContinue').classList.remove('hidden'); $('dcContinue').textContent = 'CONTINUE · DAY ' + ((sv.night || 0) + 1); $('dcContinue').addEventListener('click', () => startRun(sv)); } }
function startRun(save) {
  unlockAudio(); startMusic(); buildWorld(); for (const z of zombies) scene.remove(z); zombies.length = 0; fx.clear(); if (chopper) { scene.remove(chopper); chopper = null; } extracting = false;
  driving = false; car = null; hearts = maxHearts = 3; armor = 0; drawHearts(); cdMul = 1; carArmor = false; trashDmg = 1; rescued = 0; mIndex = 0; invuln = 0; night = 0; clock = 0; isNight = false; kills = 0; booksFound = 0; cash = 0; shoes = 0; nightLeft = 0; missionDebt = 1; nightDone = false; slots.fill(null); cds.fill(0); hudBooks(); $('dcCleared').classList.add('hidden');
  const sp = toWorld(startCell.cx, startCell.cy, cols, rows); player.position.set(sp.x, 0, sp.z); camYaw = yaw = 0; findLZ(); buildSigns(); placeBooks(); placeSurvivors(); placeMercs(); startMission(0); scans = 3; hudScan();
  if (new URLSearchParams(location.search).get('horde')) { const n = +new URLSearchParams(location.search).get('horde') || 100; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, rr = 5 + Math.random() * 10; const w = { x: player.position.x + Math.cos(a) * rr, z: player.position.z + Math.sin(a) * rr }; if (openCell(toCell(w.x, w.z, cols, rows))) spawnZombie(w, false); else spawnZombie(randomOpen(6), false); } say('Horde test: ' + zombies.length + ' zombies.'); }
  if (save && save.night != null) applySave(save); else saveGame();
  $('dcStart').classList.add('hidden'); $('dcOver').classList.add('hidden'); $('dc').classList.remove('hidden'); state = 'play'; say(save ? 'Day ' + (night + 1) + '. Welcome back.' : 'Find the spell books before dark.');
}
function gameOver(won) { state = 'over'; clearGame(); if (won) addCoins(1); stopMusic(); (won ? sfx.wave : sfx.over)(); $('dcOverTitle').textContent = won ? 'EXTRACTED' : 'OVERRUN'; $('dcOverText').textContent = (won ? 'You survived all six nights and made the chopper. +1 coin for the skin shop. Cash: $' + cash + ' · ' : 'The dead got you on night ' + night + '. ') + 'Kills: ' + kills + ' · Books: ' + booksFound + ' · Rescued: ' + rescued; $('dc').classList.add('hidden'); $('dcOver').classList.remove('hidden'); }
$('dcPlay').addEventListener('click', () => startRun()); $('dcAgain').addEventListener('click', () => startRun());
requestAnimationFrame(frame);
window.__dc = { get cars() { return city.cars; }, get driving() { return driving; }, get game() { return game; }, openGame, enterCar, get riding() { return riding; }, rides, setWeather, get weather() { return weather; }, spawnTornado, strike, dropCan, dropLoot, hurt, get hearts() { return [hearts, maxHearts, armor]; }, spawnFrom, doScan, get houseDoors() { return houseDoors; }, get spawnRate() { return spawnRate; }, get stillT() { return stillT; }, tapMove, get goRoute() { return goRoute; }, ambient: (k) => ({ car: ambFleeingCar, runner: ambRunner, horde: ambHorde, crash: ambCrash })[k](), get amb() { return amb; }, get mercs() { return mercs; }, dropGun, get gun() { return gun; }, get gasCans() { return gasCans; }, get tornadoes() { return tornadoes; }, set iso(v) { iso = v; }, setZoom, get zoom() { return zoom; }, get iso() { return iso; }, get city() { return city; }, get zombies() { return zombies; }, get player() { return player; }, get state() { return state; }, get slots() { return slots; }, spawnZombie, castSlot, throwTrash, get night() { return night; }, set clock(v) { clock = v; }, get books() { return books; }, get hp() { return hearts; }, set clock(v) { clock = v; }, get clock() { return clock; }, get night() { return night; }, get isNight() { return isNight; }, get nightLeft() { return nightLeft; }, get cash() { return cash; }, set cash(v) { cash = v; hudBooks(); }, get lz() { return lz; }, get survivors() { return survivors; }, get chopper() { return chopper; }, get lzChopper() { return lzChopper; }, get extracting() { return extracting; }, get exit() { return toWorld(exitCell.cx, exitCell.cy, cols, rows); }, buy, STORE, get rescued() { return rescued; } };

bindSeasonSelect(document.getElementById('seasonSel'));
