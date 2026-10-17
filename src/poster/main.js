import * as THREE from 'three';
import { makeCharacter, animateWalk } from '../characters.js';
import { createInput } from '../input.js';
import { unlockAudio, sfx, startMusic, stopMusic, setMusicTension, setMuted, isMuted, audioState } from '../audio.js';
import { loadWorld, flowField, findPath, nearestOpen, CAM_DIR, pxToWorld, worldToPx, PPU } from './world.js';

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1a1c);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
scene.add(new THREE.HemisphereLight(0xbfe6e0, 0x24383c, 1.6));
const sun = new THREE.DirectionalLight(0xd0e8ff, 0.8); sun.position.set(-6, 10, 8); scene.add(sun);

function fitCamera() {
  const aspect = innerWidth / innerHeight; renderer.setSize(innerWidth, innerHeight, false);
  const half = aspect < 1 ? 12 / aspect * 0.62 : 10; // portrait phones see about 600 px of painting across
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
}
addEventListener('resize', fitCamera); fitCamera();

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const ui = { hud: $('hud'), score: $('score'), lives: $('lives'), level: $('level'), people: $('people'), weapon: $('weapon'), start: $('start'), cleared: $('cleared'), clearedText: $('clearedText'), over: $('over'), best: $('best'), finalScore: $('finalScore'), finalBest: $('finalBest'), tip: $('tip'), arrow: $('exitArrow') };
const getBest = () => { try { return +localStorage.getItem('dv_best') || 0; } catch { return 0; } };
const setBest = (v) => { try { localStorage.setItem('dv_best', String(v)); } catch { /* ignore */ } };
ui.best.textContent = getBest() ? 'Best: ' + getBest() : '';
let tip = ''; function setTip(t) { if (tip === t) return; tip = t; ui.tip.textContent = t; ui.tip.classList.toggle('hidden', !t); }
function show(screen) { if (screen) setTip(''); for (const s of [ui.start, ui.cleared, ui.over]) s.classList.add('hidden'); if (screen) screen.classList.remove('hidden'); ui.hud.classList.toggle('hidden', !!screen); }
const soundBtn = $('soundBtn');
const refreshSoundBtn = () => { soundBtn.textContent = isMuted() ? '🔇 Sound: off' : '🔊 Sound: on' + (audioState() === 'running' ? '' : ' (tap to enable)'); };
refreshSoundBtn(); addEventListener('pointerdown', () => { unlockAudio(); setTimeout(refreshSoundBtn, 150); }, { passive: true });
soundBtn.addEventListener('click', () => { unlockAudio(); setMuted(!isMuted()); if (!isMuted()) sfx.pickup(); refreshSoundBtn(); });

// ---------- constants ----------
const PLAYER_SPEED = 4.5, R = 0.3, CHAR_SCALE = 1.3;
const CIV_OUTFITS = ['vest', 'suit', 'hoodie', 'hivis', 'punk', 'worker'];
const WEAPONS = {
  pistol:  { name: 'Pistol',  ammo: 12, rate: 0.35, range: 9,  speed: 22, pellets: 1, dmg: 1, color: 0x333333 },
  shotgun: { name: 'Shotgun', ammo: 6,  rate: 0.7,  range: 7,  speed: 18, pellets: 4, dmg: 1, color: 0x7a4a1a },
  rifle:   { name: 'Rifle',   ammo: 20, rate: 0.18, range: 11, speed: 26, pellets: 1, dmg: 1, color: 0x2a3a2a },
};

// ---------- state ----------
let world = null, state = 'loading', score = 0, lives = 3, time = 0, kills = 0, totalPeople = 0;
let startCell = null, exitCell = null, exitMesh = null;
const player = makeCharacter('worker'); scene.add(player); player.visible = false; player.scale.setScalar(CHAR_SCALE);
let civilians = [], zombies = [], pickups = [], projectiles = [], particles = [], followers = [];
const pool = { civ: [], zom: [] };
let weapon = null, ammo = 0, fireTimer = 0, flow = null, flowTimer = 0, invuln = 0, stepTimer = 0, groanTimer = 1;
let route = [], routeEndCell = null;
const projGeo = new THREE.BoxGeometry(0.12, 0.08, 0.3), projMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
const pickGeo = new THREE.BoxGeometry(0.6, 0.2, 0.2);
const puffGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16), puffMat = new THREE.MeshBasicMaterial({ color: 0x9fc58a });
const markerGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 10), markerMat = new THREE.MeshBasicMaterial({ color: 0x7dff6a, transparent: true, opacity: 0.8 });
const markers = []; for (let i = 0; i < 80; i++) { const mk = new THREE.Mesh(markerGeo, markerMat); mk.visible = false; scene.add(mk); markers.push(mk); }
const camTarget = new THREE.Vector3();
const input = createInput(canvas, camera);

function showRoute() { markers.forEach((mk, i) => { const c = route[i]; mk.visible = !!c; if (c) { const w = world.cellCenter(c[0], c[1]); mk.position.set(w.x, 0.03, w.z); } }); }
const playerCell = () => world.cellOf(player.position.x, player.position.z);
function setRouteTo(w) { if (state !== 'play') return; const t = world.cellOf(w.x, w.z); if (!world.open(t.cx, t.cy)) return; route = findPath(world, playerCell(), t); routeEndCell = t; showRoute(); }
function extendRoute(w, first) {
  if (state !== 'play') return; const t = world.cellOf(w.x, w.z); if (!world.open(t.cx, t.cy)) return;
  if (first) { route = []; routeEndCell = playerCell(); }
  if (routeEndCell && t.cx === routeEndCell.cx && t.cy === routeEndCell.cy) return;
  const seg = findPath(world, routeEndCell || playerCell(), t); if (seg.length && route.length + seg.length <= 80) { route.push(...seg); routeEndCell = t; showRoute(); }
}
input.on('tap', setRouteTo); input.on('drag', extendRoute);

// collision: stay on walkable cells (cheap: push back toward last good position)
const lastGood = new THREE.Vector3();
function keepOnRoad(obj, last) {
  const c = world.cellOf(obj.position.x, obj.position.z);
  if (world.open(c.cx, c.cy)) { last.copy(obj.position); return; }
  obj.position.copy(last);
}

// ---------- level ----------
function pickOpenCells(filter, rng) { const out = []; for (let r = 0; r < world.grows; r++) for (let c = 0; c < world.gcols; c++) if (world.open(c, r) && filter(c, r)) out.push([c, r]); return out.sort(() => rng() - 0.5); }

function buildLevel() {
  for (const c of civilians) { scene.remove(c); pool.civ.push(c); } for (const z of zombies) { scene.remove(z); pool.zom.push(z); }
  for (const p of pickups) scene.remove(p.mesh); for (const p of projectiles) scene.remove(p); for (const p of particles) scene.remove(p);
  civilians = []; zombies = []; pickups = []; projectiles = []; particles = []; followers = [];
  const rng = Math.random;
  const { gcols, grows } = world;
  // start: bottom band, exit: top band
  const bottom = pickOpenCells((c, r) => r > grows * 0.9, rng), top = pickOpenCells((c, r) => r < grows * 0.08, rng);
  startCell = { cx: bottom[0][0], cy: bottom[0][1] }; exitCell = { cx: top[0][0], cy: top[0][1] };
  const ep = world.cellCenter(exitCell.cx, exitCell.cy);
  if (exitMesh) scene.remove(exitMesh);
  exitMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 20), new THREE.MeshBasicMaterial({ color: 0x7dff6a, transparent: true, opacity: 0.7 }));
  exitMesh.position.set(ep.x, 0.03, ep.z); scene.add(exitMesh);
  // crowds along the way
  const mid = pickOpenCells((c, r) => r > grows * 0.1 && r < grows * 0.88, rng);
  const dist = flowField(world, startCell.cx, startCell.cy);
  totalPeople = 0; let placed = 0;
  for (const [c, r] of mid) { if (placed >= 14) break; if (dist[r * gcols + c] < 12) continue; if (civilians.some((civ) => { const q = world.cellOf(civ.position.x, civ.position.z); return Math.abs(q.cx - c) + Math.abs(q.cy - r) < 10; })) continue;
    const w = world.cellCenter(c, r); const size = 2 + ((rng() * 3) | 0);
    for (let k = 0; k < size; k++) { const civ = pool.civ.pop() || makeCharacter(CIV_OUTFITS[(rng() * CIV_OUTFITS.length) | 0]); civ.position.set(w.x + (rng() - 0.5) * 1.0, 0, w.z + (rng() - 0.5) * 1.0); civ.rotation.y = rng() * 6.28; civ.scale.setScalar(CHAR_SCALE); Object.assign(civ.userData, { infect: 0, follow: false, home: civ.position.clone(), goal: null, wait: rng() * 3, last: civ.position.clone() }); scene.add(civ); civilians.push(civ); totalPeople++; }
    placed++;
  }
  // starter zombies: in the top half, away from the start
  let zc = 0; for (const [c, r] of mid) { if (zc >= 4) break; if (r > grows * 0.6) continue; if (dist[r * gcols + c] < 40) continue; const w = world.cellCenter(c, r); if (civilians.some((civ) => civ.position.distanceTo(new THREE.Vector3(w.x, 0, w.z)) < 12)) continue; spawnZombie(w); zc++; }
  // weapons
  let wc = 0; const names = Object.keys(WEAPONS);
  for (const [c, r] of mid.slice().reverse()) { if (wc >= 5) break; if (dist[r * gcols + c] < 8) continue; const type = names[(rng() * 3) | 0]; const w = world.cellCenter(c, r); const mesh = new THREE.Mesh(pickGeo, new THREE.MeshLambertMaterial({ color: WEAPONS[type].color })); mesh.position.set(w.x, 0.3, w.z); scene.add(mesh); pickups.push({ mesh, type }); wc++; }
  const sp = world.cellCenter(startCell.cx, startCell.cy); player.position.set(sp.x, 0, sp.z); lastGood.copy(player.position); player.visible = true;
  weapon = null; ammo = 0; flow = null; invuln = 1; kills = 0; time = 0; route = []; routeEndCell = null; showRoute(); camTarget.copy(player.position);
  updateHud();
}
function spawnZombie(pos) {
  const z = pool.zom.pop() || makeCharacter(CIV_OUTFITS[(Math.random() * CIV_OUTFITS.length) | 0], { zombie: true });
  z.position.set(pos.x, 0, pos.z); z.scale.setScalar(CHAR_SCALE); Object.assign(z.userData, { hp: 2, speed: 2.6 + Math.random() * 0.5, flash: 0, stun: 0, last: z.position.clone() }); scene.add(z); zombies.push(z); return z;
}
function turnCivilian(civ) { scene.remove(civ); civilians.splice(civilians.indexOf(civ), 1); pool.civ.push(civ); spawnZombie(civ.position); for (let i = 0; i < 4; i++) particle(civ.position, puffMat); sfx.hurt(); updateHud(); }
function particle(pos, mat) { const m = new THREE.Mesh(puffGeo, mat); m.position.copy(pos); m.position.y = 1; m.userData = { vel: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.5 }; scene.add(m); particles.push(m); }
function fire(target) {
  const w = WEAPONS[weapon]; const base = new THREE.Vector3().subVectors(target.position, player.position).setY(0).normalize();
  for (let i = 0; i < w.pellets; i++) { const dir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), w.pellets > 1 ? (i - (w.pellets - 1) / 2) * 0.12 : 0); const m = new THREE.Mesh(projGeo, projMat); m.position.copy(player.position); m.position.y = 1.0; m.userData = { vel: dir.multiplyScalar(w.speed), life: w.range / w.speed, dmg: w.dmg }; m.lookAt(m.position.clone().add(dir)); scene.add(m); projectiles.push(m); }
  ammo--; sfx.throw(); fireTimer = w.rate; if (ammo <= 0) weapon = null; updateHud();
}
function lineClear(a, b) { const steps = Math.ceil(a.distanceTo(b) / 0.4); for (let i = 1; i < steps; i++) { const t = i / steps; const c = world.cellOf(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t); if (!world.open(c.cx, c.cy)) return false; } return true; }
function updateHud() {
  ui.score.textContent = String(score); ui.lives.textContent = '♥'.repeat(Math.max(0, lives));
  const fol = civilians.filter((c) => c.userData.follow).length; ui.people.textContent = 'People safe: ' + civilians.length + '/' + totalPeople + (fol ? '  ·  Following: ' + fol : '');
  ui.weapon.textContent = weapon ? WEAPONS[weapon].name + ' x' + ammo : 'Unarmed';
}
function startRun() { unlockAudio(); startMusic(); score = 0; lives = 3; buildLevel(); show(null); state = 'play'; setTip('Tap a street to walk. Head north, follow the arrow.'); }
function loseLife() {
  lives--; sfx.caught(); invuln = 2; for (let i = 0; i < 8; i++) particle(player.position, projMat);
  if (lives <= 0) { state = 'over'; input.reset(); stopMusic(); sfx.over(); const best = Math.max(getBest(), score); setBest(best); ui.finalScore.textContent = 'Score: ' + score; ui.finalBest.textContent = 'Best: ' + best; show(ui.over); return; }
  // respawn a little way back along the road and stun nearby zombies
  for (const z of zombies) if (z.position.distanceTo(player.position) < 6) z.userData.stun = 2.5;
  route = []; routeEndCell = null; showRoute(); updateHud();
}
function clearLevel() {
  state = 'cleared'; input.reset(); sfx.wave();
  const rescued = civilians.filter((c) => c.userData.follow && c.position.distanceTo(player.position) < 6).length;
  const saved = civilians.length - rescued, timeBonus = Math.max(0, 180 - Math.floor(time)) * 2;
  score += saved * 100 + rescued * 250 + kills * 10 + timeBonus; const best = Math.max(getBest(), score); setBest(best);
  ui.clearedText.innerHTML = `Rescued with you: <b>${rescued}</b> (+${rescued * 250})<br>Still alive: ${saved}/${totalPeople} (+${saved * 100})<br>Zombies dropped: ${kills} (+${kills * 10})<br>Speed bonus: +${timeBonus}<br><br>Score: <b>${score}</b><br>Best: ${best}`;
  show(ui.cleared);
}
$('startBtn').addEventListener('click', startRun); $('retryBtn').addEventListener('click', startRun); $('nextBtn').addEventListener('click', startRun);

// ---------- rain ----------
let rain = null, rainGeo = null; const RAIN = 350;
function makeRain() {
  const pos = new Float32Array(RAIN * 6); for (let i = 0; i < RAIN; i++) { pos.set([0, 0, 0, 0.2, -0.9, 0.2], i * 6); }
  rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfeaea, transparent: true, opacity: 0.25 })); scene.add(rain);
  for (let i = 0; i < RAIN; i++) resetDrop(i, true);
}
function resetDrop(i, randomY) { const a = rainGeo.attributes.position.array; const o = i * 6; const x = camTarget.x + (Math.random() - 0.5) * 40, z = camTarget.z + (Math.random() - 0.5) * 40, y = randomY ? Math.random() * 20 : 20; a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = x + 0.2; a[o + 4] = y - 0.9; a[o + 5] = z + 0.2; }
function updateRain(dt) { const a = rainGeo.attributes.position.array; for (let i = 0; i < RAIN; i++) { const o = i * 6; a[o + 1] -= 22 * dt; a[o + 4] -= 22 * dt; if (a[o + 4] < 0) resetDrop(i, false); } rainGeo.attributes.position.needsUpdate = true; }

// ---------- loop ----------
const tmp = new THREE.Vector3();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play') {
    time += dt; invuln -= dt; fireTimer -= dt; flowTimer -= dt;
    let moving = 0;
    if (route.length) {
      const w = world.cellCenter(route[0][0], route[0][1]); const dx = w.x - player.position.x, dz = w.z - player.position.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { route.shift(); showRoute(); } else { const step = Math.min(d, PLAYER_SPEED * dt); player.position.x += dx / d * step; player.position.z += dz / d * step; player.rotation.y = Math.atan2(dx, dz); moving = 1; }
    }
    keepOnRoad(player, lastGood); animateWalk(player, dt, moving); player.visible = invuln <= 0 || Math.sin(now * 0.03) > 0;
    stepTimer -= dt; if (moving && stepTimer <= 0) { sfx.step(); stepTimer = 0.28; }
    groanTimer -= dt; if (groanTimer <= 0) { groanTimer = 2 + Math.random() * 3; let close = 0; for (const z of zombies) if (z.position.distanceTo(player.position) < 9) close++; if (close) sfx.groan(); setMusicTension(close); }
    const pc = playerCell();
    if (pc.cx === exitCell.cx && pc.cy === exitCell.cy || player.position.distanceTo(exitMesh.position) < 1.2) { clearLevel(); return render(dt); }
    if (flowTimer <= 0 || !flow) { flow = flowField(world, pc.cx, pc.cy); flowTimer = 0.3; }
    for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i]; p.mesh.rotation.y += dt * 2; p.mesh.position.y = 0.3 + Math.sin(now * 0.004) * 0.08; if (p.mesh.position.distanceTo(player.position) < 0.8) { weapon = p.type; ammo = WEAPONS[p.type].ammo; scene.remove(p.mesh); pickups.splice(i, 1); sfx.pickup(); updateHud(); } }
    if (weapon && fireTimer <= 0 && zombies.length) { let best = null, bd = WEAPONS[weapon].range; for (const z of zombies) { const d = z.position.distanceTo(player.position); if (d < bd && lineClear(player.position, z.position)) { bd = d; best = z; } } if (best) fire(best); }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; p.position.addScaledVector(p.userData.vel, dt); p.userData.life -= dt; let dead = p.userData.life <= 0;
      if (!dead) { const c = world.cellOf(p.position.x, p.position.z); if (!world.open(c.cx, c.cy)) dead = true; }
      if (!dead) for (const z of zombies) { if (Math.hypot(z.position.x - p.position.x, z.position.z - p.position.z) < R + 0.15) { z.userData.hp -= p.userData.dmg; z.userData.flash = 0.12; sfx.hit(); dead = true; break; } }
      if (dead) { scene.remove(p); projectiles.splice(i, 1); }
    }
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      if (z.userData.hp <= 0) { scene.remove(z); zombies.splice(i, 1); pool.zom.push(z); kills++; score += 10; sfx.kill(); for (let k = 0; k < 5; k++) particle(z.position, puffMat); updateHud(); continue; }
      if (z.userData.stun > 0) { z.userData.stun -= dt; animateWalk(z, dt, 0); continue; }
      let prey = null, pd = time > 8 ? 7 : 0; for (const civ of civilians) { const d = civ.position.distanceTo(z.position); if (d < pd && lineClear(z.position, civ.position)) { pd = d; prey = civ; } }
      let tx = player.position.x, tz = player.position.z;
      if (prey) { tx = prey.position.x; tz = prey.position.z; }
      else { const c = world.cellOf(z.position.x, z.position.z); const here = flow[c.cy * world.gcols + c.cx];
        if (here > 1) { let bd = here, bc = c.cx, br = c.cy; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c.cx + dc, nr = c.cy + dr; if (!world.open(nc, nr)) continue; const d = flow[nr * world.gcols + nc]; if (d >= 0 && d < bd) { bd = d; bc = nc; br = nr; } } const w = world.cellCenter(bc, br); tx = w.x; tz = w.z; }
        else if (here < 0) { const w = world.cellCenter(c.cx, c.cy); tx = w.x; tz = w.z; } }
      tmp.set(tx - z.position.x, 0, tz - z.position.z); const dl = tmp.length(); if (dl > 0.001) tmp.divideScalar(dl);
      z.position.addScaledVector(tmp, z.userData.speed * dt); z.rotation.y = Math.atan2(tmp.x, tmp.z);
      for (const o of zombies) if (o !== z) { const dx = z.position.x - o.position.x, dz = z.position.z - o.position.z, dd = Math.hypot(dx, dz); if (dd < 0.5 && dd > 0.001) { z.position.x += dx / dd * (0.5 - dd) * 0.5; z.position.z += dz / dd * (0.5 - dd) * 0.5; } }
      keepOnRoad(z, z.userData.last); animateWalk(z, dt, 1);
      if (z.userData.flash > 0) { z.userData.flash -= dt; z.position.y = 0.1; } else z.position.y = 0;
      for (const civ of civilians) if (Math.hypot(civ.position.x - z.position.x, civ.position.z - z.position.z) < 0.7) civ.userData.infect += dt * 2;
      if (invuln <= 0 && Math.hypot(z.position.x - player.position.x, z.position.z - player.position.z) < R * 2) { loseLife(); if (state !== 'play') return render(dt); }
    }
    followers = civilians.filter((c) => c.userData.follow);
    for (let i = civilians.length - 1; i >= 0; i--) {
      const civ = civilians[i]; const u = civ.userData;
      if (u.infect > 0) { u.infect -= dt * 0.5; civ.position.y = Math.random() * 0.1; if (u.infect >= 1) { turnCivilian(civ); continue; } } else civ.position.y = 0;
      if (!u.follow && civ.position.distanceTo(player.position) < 1.4) { u.follow = true; u.goal = null; sfx.pickup(); updateHud(); setTip('They will follow you. Get them to the green circle.'); }
      if (u.follow) {
        const idx = followers.indexOf(civ); const leader = idx <= 0 ? player.position : followers[idx - 1].position;
        const dx = leader.x - civ.position.x, dz = leader.z - civ.position.z, d = Math.hypot(dx, dz);
        if (d > 0.9) { const st = Math.min(d - 0.7, PLAYER_SPEED * 1.1 * dt); civ.position.x += dx / d * st; civ.position.z += dz / d * st; civ.rotation.y = Math.atan2(dx, dz); keepOnRoad(civ, u.last); animateWalk(civ, dt, 1); } else animateWalk(civ, dt, 0);
        continue;
      }
      if (u.goal) { const dx = u.goal.x - civ.position.x, dz = u.goal.z - civ.position.z, d = Math.hypot(dx, dz); if (d < 0.1) { u.goal = null; u.wait = 1.5 + Math.random() * 4; animateWalk(civ, dt, 0); } else { const st = Math.min(d, 1.1 * dt); civ.position.x += dx / d * st; civ.position.z += dz / d * st; civ.rotation.y = Math.atan2(dx, dz); keepOnRoad(civ, u.last); animateWalk(civ, dt, 0.5); } }
      else { u.wait -= dt; animateWalk(civ, dt, 0); let near = null, nd = 1.6; for (const o of civilians) if (o !== civ) { const d = o.position.distanceTo(civ.position); if (d < nd) { nd = d; near = o; } } if (near) civ.rotation.y = Math.atan2(near.position.x - civ.position.x, near.position.z - civ.position.z);
        if (u.wait <= 0) { const a = Math.random() * 6.283, r = 0.3 + Math.random() * 0.8; u.goal = new THREE.Vector3(u.home.x + Math.cos(a) * r, 0, u.home.z + Math.sin(a) * r); const c = world.cellOf(u.goal.x, u.goal.z); if (!world.open(c.cx, c.cy)) u.goal = null; } }
    }
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.position.addScaledVector(p.userData.vel, dt); p.userData.vel.y -= 12 * dt; p.userData.life -= dt; if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); } }
  } else if (state !== 'loading') { for (const z of zombies) animateWalk(z, dt, 0.3); }
  if (rain) updateRain(dt);
  render(dt);
}
function render(dt = 0.016) {
  if (world) {
    camTarget.lerp(player.position, state === 'play' ? 1 - Math.pow(0.002, dt) : 1);
    camera.position.copy(camTarget).addScaledVector(CAM_DIR, 120); camera.lookAt(camTarget);
    if (state === 'play' && exitMesh) {
      const v = exitMesh.position.clone().project(camera); const onScreen = Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.85;
      ui.arrow.classList.toggle('hidden', onScreen);
      if (!onScreen) { const ang = Math.atan2(-v.y, v.x); const rx = Math.cos(ang), ry = Math.sin(ang); const k = Math.min(0.9 / Math.abs(rx || 1e-6), 0.82 / Math.abs(ry || 1e-6)); const sx = (rx * k * 0.5 + 0.5) * innerWidth, sy = (ry * k * 0.5 + 0.5) * innerHeight; ui.arrow.style.transform = 'translate(' + (sx - 22) + 'px,' + (sy - 22) + 'px) rotate(' + ang + 'rad)'; }
    } else ui.arrow.classList.add('hidden');
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ---------- boot ----------
(async () => {
  try {
    world = await loadWorld(scene, 'poster/');
    makeRain();
    // idle view on the title screen: middle of town
    const mid = pxToWorld(world.meta.width / 2, world.meta.height * 0.55); player.position.set(mid.x, 0, mid.z); camTarget.copy(player.position);
    state = 'start'; $('loading').textContent = 'Town loaded. ' + Math.round(world.meta.width) + '×' + Math.round(world.meta.height) + ' px of Duvallville.'; $('startBtn').disabled = false;
  } catch (e) { $('loading').textContent = 'Could not load the town: ' + e.message; }
})();
window.__dv = { get world() { return world; }, get player() { return player; }, get state() { return state; }, get zombies() { return zombies; }, get civilians() { return civilians; }, get pickups() { return pickups; }, get exit() { return exitMesh && exitMesh.position; }, routeTo: (c, r) => { const w = world.cellCenter(c, r); setRouteTo(w); }, px: worldToPx, toWorld: pxToWorld, PPU };
