import * as THREE from 'three';
import { makeCharacter, animateWalk } from './poster/characters.js';
import { generateMaze, buildCity, flowField, findPath, toWorld, toCell, CELL, mulberry32, NIGHT } from './city.js';
import { createInput } from './input.js';
import { unlockAudio, sfx, startMusic, stopMusic, setMusicTension, setMusicChase, setMuted, isMuted, audioState } from './audio.js';
import { makeChopper, animateChopper } from './chopper.js';
import { buildRuins } from './ruins.js';
import { makeCar, animateCar } from './car.js';
import { rides } from './landmarks.js';
import { createFires } from './fire.js';
import { GROUPS, OPEN_CODES, loadMap, saveMap, blankMap, fillSelect } from './tools.js';
const BUILD = new URLSearchParams(location.search).get('build') === '1';
// ---------- economy / store ----------
let cash = 0, cashThisDistrict = 0;
const inv = { shoes: 0, vest: false, flare: false, ammo: false, car: null, carHp: 0 };
const STORE = [
  { id: 'ammo', name: 'Ammo crate', desc: 'Start the next district with a rifle, 20 shots.', price: 100, once: true },
  { id: 'medkit', name: 'Medkit', desc: 'One extra life (max 5).', price: 250 },
  { id: 'vest', name: 'Kevlar vest', desc: 'Absorbs one zombie touch next district.', price: 300, once: true },
  { id: 'shoes', name: 'Running shoes', desc: '+10% speed, permanent. Stacks 3 times.', price: 350, max: 3 },
  { id: 'flare', name: 'Flare pack', desc: 'Sprinting drops a flare that lures zombies for 6 s.', price: 150, once: true },
  { id: 'car', name: 'Car keys', desc: 'Drive the next district. Run zombies down. 5 hits wrecks it.', price: 1500 },
  { id: 'repair', name: 'Repair car', desc: 'Restore the car to full health.', price: 400 },
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
let flyby = null, flybyT = 30, riding = null, rideCd = 0, playerInfect = 0, puzzle = null, ferrisHinted = false;
const rideAt = (x, z, rad) => { let best = null, bd = rad; for (const rr of rides) { const d = Math.hypot(x - rr.pos.x, z - rr.pos.z); if (d < bd) { bd = d; best = rr; } } return best; };
let infected = 0, antidote = null, goo = [];
const rideAnchor = new THREE.Object3D(); scene.add(rideAnchor);
const gooGeo = new THREE.CircleGeometry(0.2, 10); gooGeo.rotateX(-Math.PI / 2);
const gooBase = new THREE.MeshBasicMaterial({ color: 0x5cff3a, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
const antidoteMat = new THREE.MeshBasicMaterial({ color: 0xd07cff });
function dropGoo(pos) {
  const g = new THREE.Mesh(gooGeo, gooBase.clone()); g.position.set(pos.x + (Math.random() - 0.5) * 0.3, 0.02, pos.z + (Math.random() - 0.5) * 0.3); g.scale.setScalar(0.7 + Math.random() * 0.7); g.userData.t = 5;
  scene.add(g); goo.push(g); if (goo.length > 160) { const old = goo.shift(); scene.remove(old); }
}
function updateGoo(dt) {
  for (let i = goo.length - 1; i >= 0; i--) { const g = goo[i]; g.userData.t -= dt; if (g.userData.t <= 0) { scene.remove(g); goo.splice(i, 1); continue; } g.material.opacity = Math.min(0.75, g.userData.t * 0.3); }
}
function infectPlayer() {
  if (infected > 0 || invuln > 0 || state !== 'play') return;
  infected = 25; sfx.hurt(); say(player, 'Infected! Need antidote!', 2.2);
  // antidote somewhere a short run away
  const pc = playerCell(); const d = flowField(maze, pc.cx, pc.cy); const cands = [];
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) { const v = d[y * cols + x]; if (v >= 5 && v <= 14) cands.push([x, y]); }
  const [ax, ay] = cands.length ? cands[(Math.random() * cands.length) | 0] : [pc.cx, pc.cy];
  const w = toWorld(ax, ay, cols, rows); const mesh = new THREE.Mesh(pickGeo, antidoteMat); mesh.position.set(w.x, 0.35, w.z); scene.add(mesh);
  antidote = { mesh, cx: ax, cy: ay }; pickups.push({ mesh, type: 'antidote' });
  setTip('Infected! Reach the purple beam for the antidote before the timer runs out.');
}
function clearAntidote() { if (antidote) { scene.remove(antidote.mesh); const i = pickups.findIndex((p) => p.type === 'antidote'); if (i >= 0) pickups.splice(i, 1); antidote = null; } infected = 0; }
// objective beacon: a tall glowing column over the current goal
const beaconMat = new THREE.MeshBasicMaterial({ color: 0x7dff6a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 12, 14, 1, true), beaconMat); beacon.position.y = 6; beacon.visible = false; scene.add(beacon);
const beaconRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 24), new THREE.MeshBasicMaterial({ color: 0x7dff6a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })); beaconRing.rotation.x = -Math.PI / 2; beaconRing.position.y = 0.06; beaconRing.visible = false; scene.add(beaconRing);
const objectiveEl = document.getElementById('objective');
// ---- fires and explosions: the horde leaves the city burning behind it ----
const fx = createFires(scene);
let fireCheck = 0, shake = 0;
const burntMat = new THREE.MeshLambertMaterial({ color: 0x1a1c1e });
function burnCar(car) { if (car.userData.burning) return; car.userData.burning = true; car.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() !== 0x5a86a8) o.material = burntMat; }); fx.ignite(new THREE.Vector3(car.position.x, 0.6, car.position.z), 0.8); sfx.whoosh(); }
function burnBuilding(b) { if (b.userData.burning) return; b.userData.burning = true; const h = b.userData.h || 2; fx.ignite(new THREE.Vector3(b.position.x + (Math.random() - 0.5) * 0.8, Math.min(h, 2.2), b.position.z + (Math.random() - 0.5) * 0.8), 1.1 + Math.random() * 0.5); if (b.userData.fade) for (const mat of b.userData.fade) if (mat.emissive) { mat.emissive.set(0xff5a1a); mat.emissiveIntensity = 0.35; } }
function explodeAt(pos, size, label) {
  fx.explode(pos, size); sfx.boom(); shake = 0.7; say(player, label || 'Whoa!', 1.4);
  for (let i = zombies.length - 1; i >= 0; i--) { const z = zombies[i]; const d = z.position.distanceTo(pos); if (d < 4.5 * size && !z.userData.rag) flingZombie(z, { x: z.position.x - pos.x, z: z.position.z - pos.z }, 9 + Math.random() * 4); }
  for (let i = civilians.length - 1; i >= 0; i--) { const cv = civilians[i]; if (cv.position.distanceTo(pos) < 2.6 * size) { scene.remove(cv); civilians.splice(i, 1); pool.civ.push(cv); for (let k = 0; k < 4; k++) particle(cv.position, puffMat); } }
  if (!riding && invuln <= 0 && player.position.distanceTo(pos) < 2.6 * size) { if (driving) { inv.carHp -= 2; if (inv.carHp <= 0) wreckCar(); else { sfx.hit(); invuln = 1; } } else loseLife(); }
  for (let k = 0; k < 2; k++) fx.ignite(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 1.6, 0.4, pos.z + (Math.random() - 0.5) * 1.6), 1.3);
  updateHud();
}
function updateFires(dt) {
  fx.update(dt); fireCheck -= dt; if (fireCheck > 0) return; fireCheck = 0.5;
  const hot = zombies.filter((z) => z.userData.alert > 0 && !z.userData.rag);
  // parked cars catch fire when zombies pass them
  for (const car of city.cars) if (!car.userData.burning) for (const z of zombies) if (Math.abs(z.position.x - car.position.x) < 1.4 && Math.abs(z.position.z - car.position.z) < 1.4 && Math.random() < 0.35) { burnCar(car); break; }
  // the gas station blows when the horde reaches it
  for (const hz of city.hazards) if (hz.type === 'gas' && !hz.done) { let near = 0; for (const z of zombies) if (z.position.distanceTo(hz.pos) < 3.2) near++; if (near >= 2 || (near && Math.random() < 0.15)) { hz.done = true; explodeAt(hz.pos, 1.6, 'The gas station!'); } }
  // a lingering horde sets buildings alight; fire spreads next door now and then
  if (hot.length && fx.fires.length < 14 && Math.random() < 0.35) {
    const z = hot[(Math.random() * hot.length) | 0]; let best = null, bd = 2.6;
    for (const b of city.buildings) { if (b.userData.burning) continue; const d = Math.hypot(b.position.x - z.position.x, b.position.z - z.position.z); if (d < bd) { bd = d; best = b; } }
    if (best) burnBuilding(best);
  }
  if (fx.fires.length < 14 && Math.random() < 0.08) { const burning = city.buildings.filter((b) => b.userData.burning); if (burning.length) { const src = burning[(Math.random() * burning.length) | 0]; for (const b of city.buildings) if (!b.userData.burning && Math.hypot(b.position.x - src.position.x, b.position.z - src.position.z) < CELL * 1.5) { burnBuilding(b); break; } } }
}
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
const PLAYER_LINES = ['Follow me!', "Let's go!", 'This way!', 'Stay close!', 'Move it!', 'With me!', 'I know a way!'];
const CIV_LINES = ['Right behind you!', 'Okay, okay!', 'Thank you!', "Don't leave me!", 'Go go go!', 'Lead the way!'];
const bubbles = []; // { el, target, t, dy }
for (let i = 0; i < 4; i++) { const el = document.createElement('div'); el.className = 'bubble hidden'; document.body.appendChild(el); bubbles.push({ el, target: null, t: 0 }); }
function say(target, text, dur = 2.2) {
  let b = bubbles.find((x) => x.target === target && x.t > 0) || bubbles.find((x) => x.t <= 0) || bubbles[0];
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
function objectiveCell() { return infected > 0 && antidote ? antidote : gate && !gate.open ? (gate.found ? switchCell : gate) : exitCell; }
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
  const MAXR = 10; let path = findPath(maze, playerCell(), target);
  if (path.length > MAXR) { path = path.slice(0, MAXR); if (!routeHintT || performance.now() - routeHintT > 4000) { routeHintT = performance.now(); say(player, "That's as far as I plan.", 1.4); } }
  route = path; routeEndCell = path.length ? { cx: path[path.length - 1][0], cy: path[path.length - 1][1] } : playerCell(); showRoute();
}
let routeHintT = 0;
function extendRoute(w, first) {
  if (state !== 'play') return;
  const target = toCell(w.x, w.z, cols, rows); if (!openCell(target)) return;
  if (first) { route = []; routeEndCell = playerCell(); }
  if (routeEndCell && target.cx === routeEndCell.cx && target.cy === routeEndCell.cy) return;
  const seg = findPath(maze, routeEndCell || playerCell(), target);
  if (seg.length && route.length + seg.length <= 10) { route.push(...seg); routeEndCell = target; showRoute(); }
}
// ---- in-world build mode (index.html?build=1): tap a cell to place the selected item on the real map ----
let bTool = 0, bMap = null, bRebuild = 0;
let bLastTap = 0;
function buildPlace(w) {
  const c = toCell(w.x, w.z, cols, rows); if (c.cx <= 0 || c.cy <= 0 || c.cx >= cols - 1 || c.cy >= rows - 1) { setTip('Edge cells stay buildings.'); return; }
  const name = (GROUPS.flatMap(([, it]) => it).find((t) => t[1] === bTool) || ['?'])[0]; setTip(name + ' at ' + c.cx + ', ' + c.cy);
  if (bTool === 11 || bTool === 12) for (const row of bMap.cells) for (let x = 0; x < row.length; x++) if (row[x] === bTool) row[x] = 0;
  if (bMap.cells[c.cy][c.cx] === bTool) return;
  bMap.cells[c.cy][c.cx] = bTool; saveMap(bMap); sfx.throw(); clearTimeout(bRebuild); bRebuild = setTimeout(buildRefresh, 120);
}
function buildRefresh() { const keep = camPan.clone(); buildLevel(1); for (const cv of civilians) scene.remove(cv); for (const z of zombies) scene.remove(z); civilians = []; zombies = []; for (const p of pickups) scene.remove(p.mesh); pickups = []; camPan.copy(keep); setTip(''); state = 'build'; player.visible = true; updateHud(); }
function startBuild() {
  bMap = loadMap(); fillSelect($('bTool')); $('bTool').value = '0'; $('bTool').addEventListener('change', () => { bTool = +$('bTool').value; });
  $('bView').addEventListener('click', () => { setTopView(!topView); $('bView').textContent = topView ? 'Angle' : 'Top'; });
  $('bErase').addEventListener('click', () => { bTool = 1; $('bTool').value = '1'; });
  $('bRestart').addEventListener('click', () => { if (!confirm('Clear the whole map and start over?')) return; bMap = blankMap(bMap.cols, bMap.rows); bMap.cells[bMap.rows - 2][1] = 11; bMap.cells[1][bMap.cols - 2] = 12; saveMap(bMap); buildRefresh(); });
  $('bMenu').addEventListener('change', () => { const v = $('bMenu').value; $('bMenu').value = '';
    if (v === 'play') location.href = 'index.html?custom=1';
    else if (v === 'export') { const s = JSON.stringify(bMap); try { navigator.clipboard.writeText(s); } catch { /* ignore */ } prompt('Map text (copied). Paste it to Claude:', s); }
    else if (v === 'import') { const s = prompt('Paste map text:'); try { const mm = JSON.parse(s); if (mm && mm.cells) { bMap = mm; saveMap(bMap); buildRefresh(); } } catch { alert('That is not a map.'); } }
    else if (v === 'random') { const wall = generateMaze(bMap.cols, bMap.rows, Math.floor(bMap.cols * bMap.rows * 0.08)); bMap.cells = wall.map((row) => row.map((x) => (x ? 1 : 0))); bMap.cells[bMap.rows - 2][1] = 11; bMap.cells[1][bMap.cols - 2] = 12; saveMap(bMap); buildRefresh(); }
    else if (v === 'clear') { bMap = blankMap(bMap.cols, bMap.rows); bMap.cells[bMap.rows - 2][1] = 11; bMap.cells[1][bMap.cols - 2] = 12; saveMap(bMap); buildRefresh(); }
    else if (v === 'grid') location.href = 'editor.html';
    else if (v === 'exit') location.href = 'index.html'; });
  // phones: the plain click event is the most reliable tap; place from it too (duplicates are ignored)
  const bRay = new THREE.Raycaster(), bGround = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), bHit = new THREE.Vector3();
  const placeAt = (sx, sy) => { if (performance.now() - bLastTap < 300) return; bLastTap = performance.now(); bRay.setFromCamera(new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1), camera); if (bRay.ray.intersectPlane(bGround, bHit)) buildPlace({ x: bHit.x, z: bHit.z }); };
  // iPhone: touch events are the one thing Safari always delivers, so place from a clean single-finger tap
  let tStart = null; canvas.addEventListener('touchstart', (e) => { tStart = e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY, performance.now()] : null; }, { passive: true });
  canvas.addEventListener('touchend', (e) => { if (!tStart || e.touches.length || e.changedTouches.length !== 1) { tStart = null; return; } const t = e.changedTouches[0]; const moved = Math.hypot(t.clientX - tStart[0], t.clientY - tStart[1]); const held = performance.now() - tStart[2]; tStart = null; if (moved < 12 && held < 600) { placeAt(t.clientX, t.clientY); e.preventDefault(); } }, { passive: false });
  canvas.addEventListener('click', (e) => { if (performance.now() - bLastTap < 300) return; bLastTap = performance.now(); bRay.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera); if (bRay.ray.intersectPlane(bGround, bHit)) buildPlace({ x: bHit.x, z: bHit.z }); });
  unlockAudio(); show(null); $('build').classList.remove('hidden'); ui.hud.classList.add('hidden'); $('lookBtn').classList.add('hidden');
  input.setLook(true); input.lookTap = true; buildRefresh(); zoom = 0.9; fitCamera();
  setTip('Build mode: tap to place, drag to pan, pinch to zoom. The start marker is where you stand.');
}
input.on('tap', (w) => {
  if (BUILD) { if (performance.now() - bLastTap > 300) { bLastTap = performance.now(); buildPlace(w); } return; }
  const now = performance.now();
  const tappedRide = state === 'play' && !riding ? rideAt(w.x, w.z, 2.8) : null;
  if (tappedRide) {
    const near = player.position.distanceTo(tappedRide.pos) < CELL * 1.3;
    if (lastTapW && now - lastTapT < 380 && Math.hypot(w.x - lastTapW.x, w.z - lastTapW.z) < 2.5) {
      lastTapT = 0; lastTapW = null;
      if (!near) { say(player, 'Get closer first.', 1.4); return; }
      if (rideCd > 0) { say(player, 'Rides are cooling.', 1.4); return; }
      openRideGame(tappedRide); return;
    }
    lastTapT = now; lastTapW = w; if (near) say(player, 'Double-tap to ride.', 1.2); return;
  }
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
let topView = false;
function setTopView(on) { topView = on; const el = on ? 1.36 : CAM_ELEV, yaw = on ? 0 : CAM_YAW; camDir.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).normalize(); screenUp.set(-Math.sin(yaw), -Math.cos(yaw)); screenRight.set(Math.cos(yaw), -Math.sin(yaw)); }
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
  civilians = []; zombies = []; pickups = []; projectiles = []; particles = []; antidote = null; infected = 0;
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
  // custom map from the builder (editor.html): district 1 only
  let custom = null;
  if (n === 1 && (BUILD || new URLSearchParams(location.search).get('custom') === '1')) { custom = loadMap(); if (BUILD && !custom) { custom = blankMap(); custom.cells[custom.rows - 2][1] = 11; custom.cells[1][custom.cols - 2] = 12; saveMap(custom); } }
  if (custom && custom.cells) {
    cols = custom.cols; rows = custom.rows; const LM = { 4: 'gas', 5: 'ferris', 6: 'coaster', 7: 'carousel', 8: 'school', 9: 'skate', 10: 'slime' };
    // open: road 0, park 3, start 11, exit 12, avenue 13, crosswalk 14, plaza 15, bench 18, parked car 19. Blocked: building 1, house 2, tower 16, tree 17, landmarks 4..10
    const OPEN = new Set([0, 3, 11, 12, 13, 14, 15, 18, 19]);
    maze = custom.cells.map((row) => row.map((v) => !OPEN.has(v)));
    maze.custom = { landmarks: new Map(), houses: new Set(), parks: new Set(), avenue: new Set(), cross: new Set(), plaza: new Set(), towers: new Set(), trees: new Set(), benches: new Set(), cars: new Set() }; let sc = null, ec = null;
    custom.cells.forEach((row, y) => row.forEach((v, x) => { const i = y * cols + x; const cu = maze.custom;
      if (LM[v]) cu.landmarks.set(i, LM[v]); if (v === 2) cu.houses.add(i); if (v === 3 || v === 18) cu.parks.add(i); if (v === 13) cu.avenue.add(i); if (v === 14) cu.cross.add(i); if (v === 15) cu.plaza.add(i);
      if (v === 16) cu.towers.add(i); if (v === 17) cu.trees.add(i); if (v === 18) cu.benches.add(i); if (v === 19) cu.cars.add(i); if (v === 11) sc = { cx: x, cy: y }; if (v === 12) ec = { cx: x, cy: y }; }));
    maze.avenues = null; startCell = sc || { cx: 1, cy: rows - 2 }; exitCell = ec || { cx: cols - 2, cy: 1 };
  }
  // tutorial district is wide open: many extra openings so zombies stay visible
  const loops = tutorial ? Math.floor(cols * rows * 0.16) : Math.floor(cols * rows * 0.1) + n * 2;
  if (!custom) maze = generateMaze(cols, rows, loops, rng);
  if (!custom) {
    // main avenues: one straight across and one straight down, through the middle of town
    const ay = 1 + 2 * Math.floor((rows - 2) / 4), ax = 1 + 2 * Math.floor((cols - 2) / 4);
    for (let x = 1; x < cols - 1; x++) maze[ay][x] = false;
    for (let y = 1; y < rows - 1; y++) maze[y][ax] = false;
    maze.avenues = { row: ay, col: ax };
  }
  if (!custom) startCell = { cx: 1, cy: rows - 2 };
  // exit: among the cells farthest by road, prefer ones physically close to the start (long way round)
  if (!custom) { const dist = flowField(maze, startCell.cx, startCell.cy); let max = 0; for (const d of dist) if (d > max) max = d;
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
  parked = false; ferrisHinted = false; for (const rr of rides) rr.speed = 1; clearAntidote(); fx.clear(); shake = 0; for (const g of goo) scene.remove(g); goo = []; if (flyby) { scene.remove(flyby); flyby = null; } flybyT = 20 + Math.random() * 20; riding = null; rideCd = 0; playerInfect = 0; $('puzzle').classList.add('hidden'); puzzle = null; closeWheelGame(); closeCoasterGame(); closeCarouselGame();
}

function spawnZombie(pos, n, rng = Math.random) {
  // clown zombies haunt the fairground rides; a few wander elsewhere
  const nearRide = rides.some((rr) => Math.hypot(rr.pos.x - pos.x, rr.pos.z - pos.z) < 9);
  const wantClown = rng() < (nearRide ? 0.7 : 0.08) ? (rng() < 0.5 ? 'hammer' : 'balloons') : null;
  let z = null;
  if (wantClown) { const i = pool.zom.findIndex((p) => p.userData.clown === wantClown); if (i >= 0) z = pool.zom.splice(i, 1)[0]; }
  else { const i = pool.zom.findIndex((p) => !p.userData.clown); if (i >= 0) z = pool.zom.splice(i, 1)[0]; }
  if (!z) z = makeCharacter(CIV_OUTFITS[(rng() * CIV_OUTFITS.length) | 0], { zombie: true, clown: wantClown });
  z.position.set(pos.x, 0, pos.z); z.scale.setScalar(0.55); z.rotation.set(0, 0, 0); z.userData.rag = null; z.userData.stun = 0; z.userData.alert = 0;
  z.userData.hp = 2 + Math.floor(n / 3); z.userData.speed = Math.min(PLAYER_SPEED * 0.85, (n === 1 ? 1.6 : 2.3 + n * 0.15) + rng() * 0.3); z.userData.flash = 0;
  scene.add(z); zombies.push(z); return z;
}

function turnCivilian(civ) {
  scene.remove(civ); civilians.splice(civilians.indexOf(civ), 1); pool.civ.push(civ);
  spawnZombie(civ.position, level);
  for (let i = 0; i < 4; i++) particle(civ.position, puffMat);
  sfx.hurt(); updateHud();
}

function flingZombie(z, dir, power) {
  const d = Math.hypot(dir.x, dir.z) || 1;
  z.userData.rag = { vel: new THREE.Vector3(dir.x / d * power, 4.5 + power * 0.5, dir.z / d * power), t: 0, spin: new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12) };
  z.userData.alert = 0; sfx.hit(); for (let k = 0; k < 4; k++) particle(z.position, puffMat);
}
function removeZombie(i, z) { scene.remove(z); zombies.splice(i, 1); z.rotation.set(0, 0, 0); z.position.y = 0; z.userData.rag = null; pool.zom.push(z); kills++; addScore(10); sfx.kill(); for (let k = 0; k < 5; k++) particle(z.position, puffMat); updateHud(); }
function updateFlyby(dt) {
  flybyT -= dt;
  if (!flyby && flybyT <= 0 && level !== FINAL_LEVEL) {
    flyby = makeChopper(); flyby.scale.setScalar(0.7); const span = Math.max(cols, rows) * CELL * 0.75; const a = Math.random() * Math.PI * 2;
    const from = new THREE.Vector3(Math.cos(a) * span, 9, Math.sin(a) * span), to = from.clone().multiplyScalar(-1); to.y = 9; to.x += (Math.random() - 0.5) * span * 0.6; to.z += (Math.random() - 0.5) * span * 0.6;
    flyby.userData.from = from; flyby.userData.to = to; flyby.userData.t = 0; flyby.userData.dur = 13 + Math.random() * 5;
    flyby.position.copy(from); flyby.rotation.y = Math.atan2(to.x - from.x, to.z - from.z); flyby.rotation.x = 0.12; scene.add(flyby);
  }
  if (flyby) {
    const u = flyby.userData; u.t += dt; const k = u.t / u.dur; animateChopper(flyby, dt, u.t);
    flyby.position.lerpVectors(u.from, u.to, k); flyby.position.y = 9 + Math.sin(u.t * 1.3) * 0.5;
    if (k >= 1) { scene.remove(flyby); flyby = null; flybyT = 45 + Math.random() * 45; }
  }
}
function startRide(ride) {
  const pc = playerCell(); riding = { ride, t: 0, ang: 0, spins: 3, cell: pc, back: player.position.clone(), world: toWorld(pc.cx, pc.cy, cols, rows), hits: 0 };
  ride.speed = ride.type === 'coaster' ? 6 : ride.type === 'carousel' ? 5 : 4;
  route = []; routeEndCell = null; showRoute(); input.reset(); sfx.pickup(); say(player, ride.type === 'coaster' ? 'Hold on!' : 'Wheee!', 2);
  const unit = ride.type === 'ferris' ? 'spins' : ride.type === 'coaster' ? 'laps' : 'turns';
  setTip('Three ' + unit + '. Zombies swarm the ride and get knocked flying.');
}
function updateRide(dt) {
  riding.t += dt; const ride = riding.ride; const unit = ride.type === 'ferris' ? 'Spin' : ride.type === 'coaster' ? 'Lap' : 'Turn';
  let done = 0; const pu = player.userData;
  if (ride.type === 'ferris') {
    const w = ride.wheel; riding.ang += dt * 0.35 * ride.speed; done = Math.floor(riding.ang / (Math.PI * 2));
    const a = w.rotation.z; w.updateWorldMatrix(true, false); const p = w.localToWorld(new THREE.Vector3(Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0));
    player.position.set(p.x, p.y - 0.42, p.z + 0.1); player.rotation.y = CAM_YAW + Math.PI; animateWalk(player, dt, 0);
    pu.legL.rotation.x = pu.legR.rotation.x = -1.45; pu.armL.rotation.x = pu.armR.rotation.x = -0.5;
    rideAnchor.position.set(w.position.x, w.position.y + 1.3, w.position.z);
  } else if (ride.type === 'coaster') {
    riding.ang += dt * 0.05 * ride.speed; done = Math.floor(riding.ang);
    const u = ride.u; const p = ride.curve.getPointAt(u), t = ride.curve.getTangentAt(u);
    player.position.set(p.x, p.y + 0.02, p.z); player.rotation.y = Math.atan2(t.x, t.z); animateWalk(player, dt, 0);
    pu.legL.rotation.x = pu.legR.rotation.x = -1.45; pu.armL.rotation.x = pu.armR.rotation.x = Math.PI + 0.3; // arms up!
    rideAnchor.position.set(ride.pos.x, 3.3, ride.pos.z);
  } else {
    const pl = ride.platform; riding.ang += dt * 0.3 * ride.speed; done = Math.floor(riding.ang / (Math.PI * 2));
    pl.updateWorldMatrix(true, false); const h = ride.horses[0]; const p = h.getWorldPosition(new THREE.Vector3());
    player.position.set(p.x, p.y - 0.1, p.z); player.rotation.y = pl.rotation.y + Math.PI; animateWalk(player, dt, 0);
    pu.legL.rotation.x = -1.2; pu.legR.rotation.x = -1.2; pu.armL.rotation.x = pu.armR.rotation.x = -0.9;
    rideAnchor.position.set(ride.pos.x, 2.9, ride.pos.z);
  }
  const exiting = done >= riding.spins; say(rideAnchor, exiting ? 'Exiting' : unit + ' ' + Math.min(riding.spins, done + 1) + '/' + riding.spins, 0.4);
  if (exiting) ride.speed = Math.max(1, ride.speed - dt * 3);
  for (let i = zombies.length - 1; i >= 0; i--) { const z = zombies[i]; if (z.userData.rag) continue; const dx = z.position.x - ride.pos.x, dz = z.position.z - ride.pos.z; if (Math.hypot(dx, dz) < 2.1) { flingZombie(z, { x: dx, z: dz }, 7 + Math.random() * 3); riding.hits++; } }
  if (exiting && ride.speed <= 1) { ride.speed = 1; player.position.copy(riding.back); player.position.y = 0; invuln = 1.5; rideCd = 25; say(player, riding.hits ? 'Strike! ' + riding.hits + ' down.' : 'Fun ride.', 2); setTip(''); riding = null; }
}
function openRideGame(ride) { if (ride.type === 'ferris') openWheelGame(ride); else if (ride.type === 'coaster') openCoasterGame(ride); else openCarouselGame(ride); }
// ---- launch pump (coaster): tap fast to fill a leaking meter before time runs out ----
let cg = null;
function openCoasterGame(ride) { cg = { ride, fill: 0, time: 8 }; $('coasterGame').classList.remove('hidden'); $('cgText').textContent = 'Tap PUMP fast to charge the launch. It leaks, so keep tapping until it is full.'; $('cgFill').style.width = '0%'; state = 'wheel'; input.reset(); route = []; routeEndCell = null; showRoute(); }
function updateCoasterGame(dt) {
  cg.time -= dt; cg.fill = Math.max(0, cg.fill - dt * 0.3); $('cgFill').style.width = (cg.fill * 100) + '%'; $('cgTime').textContent = Math.max(0, cg.time).toFixed(1) + ' s';
  if (cg.time <= 0) { cg.time = 8; cg.fill = 0; sfx.hit(); $('cgText').textContent = 'Out of steam. Try again, faster!'; }
}
function closeCoasterGame() { $('coasterGame').classList.add('hidden'); cg = null; if (state === 'wheel' && !wg && !mg) state = 'play'; }
$('cgHit').addEventListener('click', () => { if (!cg || cg.done) return; cg.fill += 0.11; sfx.throw(); if (cg.fill >= 1) { cg.done = true; $('cgFill').style.width = '100%'; $('cgText').textContent = 'Launch ready!'; sfx.wave(); const ride = cg.ride; setTimeout(() => { closeCoasterGame(); if (driving) leaveCar('Ooh, a ride!'); startRide(ride); }, 600); } });
$('cgClose').addEventListener('click', closeCoasterGame);
// ---- ticket booth (carousel): repeat the sequence of lit horses ----
let mg = null;
function openCarouselGame(ride) {
  mg = { ride, seq: Array.from({ length: 4 }, () => (Math.random() * 4) | 0), step: 0, showing: true };
  $('carouselGame').classList.remove('hidden'); $('mgText').textContent = 'Watch which horses light up, then tap them in the same order.'; $('mgLights').textContent = '○ ○ ○ ○'; $('mgLights').classList.remove('bad');
  state = 'wheel'; input.reset(); route = []; routeEndCell = null; showRoute(); showSequence();
}
function showSequence() {
  if (!mg) return; mg.showing = true; const btns = [...document.querySelectorAll('.mgBtn')];
  mg.seq.forEach((i, k) => { setTimeout(() => { if (!mg) return; btns[i].classList.add('lit'); sfx.throw(); }, 500 + k * 600); setTimeout(() => { if (!mg) return; btns[i].classList.remove('lit'); }, 500 + k * 600 + 380); });
  setTimeout(() => { if (mg) { mg.showing = false; $('mgText').textContent = 'Your turn. Tap the horses in order.'; } }, 500 + mg.seq.length * 600);
}
function closeCarouselGame() { $('carouselGame').classList.add('hidden'); mg = null; if (state === 'wheel' && !wg && !cg) state = 'play'; }
for (const b of document.querySelectorAll('.mgBtn')) b.addEventListener('click', () => {
  if (!mg || mg.showing || mg.done) return; const i = +b.dataset.i; b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 200);
  if (i === mg.seq[mg.step]) {
    mg.step++; sfx.pickup(); $('mgLights').textContent = '● '.repeat(mg.step).trim() + (mg.step < 4 ? ' ' + '○ '.repeat(4 - mg.step).trim() : '');
    if (mg.step >= mg.seq.length) { mg.done = true; $('mgText').textContent = 'Ticket punched!'; sfx.wave(); const ride = mg.ride; setTimeout(() => { closeCarouselGame(); if (driving) leaveCar('Ooh, a ride!'); startRide(ride); }, 600); }
  } else { mg.step = 0; sfx.hit(); $('mgLights').textContent = '○ ○ ○ ○'; $('mgLights').classList.add('bad'); $('mgText').textContent = 'Wrong horse. Watch again.'; setTimeout(() => { if (mg) { $('mgLights').classList.remove('bad'); showSequence(); } }, 700); }
});
$('mgClose').addEventListener('click', closeCarouselGame);
// ---- ride operator: hit the needle in the yellow three times to start the motor ----
let wg = null;
function openWheelGame(ride) {
  wg = { ride, t: 0, speed: 2.2, hits: 0, zoneC: 0.5, zoneW: 0.28, flash: 0 };
  $('wheelGame').classList.remove('hidden'); $('wgLights').textContent = '○ ○ ○'; $('wgLights').classList.remove('bad'); $('wgText').textContent = 'Tap START when the needle is in the yellow. Three good hits start the motor.';
  state = 'wheel'; input.reset(); route = []; routeEndCell = null; showRoute(); placeZone();
}
function placeZone() { wg.zoneC = 0.2 + Math.random() * 0.6; const z = $('wgZone'); z.style.left = ((wg.zoneC - wg.zoneW / 2) * 100) + '%'; z.style.width = (wg.zoneW * 100) + '%'; }
function updateWheelGame(dt) {
  wg.t += dt * wg.speed; wg.flash -= dt; wg.pos = 0.5 + 0.5 * Math.sin(wg.t);
  $('wgNeedle').style.left = (wg.pos * 100) + '%';
  if (wg.flash <= 0) $('wgLights').classList.remove('bad');
}
function closeWheelGame() { $('wheelGame').classList.add('hidden'); wg = null; if (state === 'wheel' && !cg && !mg) state = 'play'; }
$('wgHit').addEventListener('click', () => {
  if (!wg) return;
  if (Math.abs(wg.pos - wg.zoneC) < wg.zoneW / 2) {
    wg.hits++; sfx.pickup(); $('wgLights').textContent = '● '.repeat(wg.hits).trim() + (wg.hits < 3 ? ' ' + '○ '.repeat(3 - wg.hits).trim() : '');
    if (wg.hits >= 3) { $('wgText').textContent = 'Motor running!'; sfx.wave(); const ride = wg.ride; setTimeout(() => { closeWheelGame(); if (driving) leaveCar('Ooh, a ride!'); startRide(ride); }, 600); return; }
    wg.speed += 0.9; wg.zoneW = Math.max(0.14, wg.zoneW - 0.06); placeZone();
  } else { wg.hits = 0; sfx.hit(); $('wgLights').textContent = '○ ○ ○'; $('wgLights').classList.add('bad'); wg.flash = 0.4; $('wgText').textContent = 'Missed. The motor stalls. Try again.'; }
});
$('wgClose').addEventListener('click', closeWheelGame);
// ---- power box puzzle: rotate wires to connect the source to the gate ----
const PZW = 4, PZH = 3;
const tileConns = (t) => t.type === 's' ? (t.rot % 2 === 0 ? [0, 2] : [1, 3]) : [t.rot, (t.rot + 1) % 4];
function connsToTile(a, b) { if ((a + 2) % 4 === b) return { type: 's', rot: a % 2 }; for (let r = 0; r < 4; r++) { const s = [r, (r + 1) % 4]; if (s.includes(a) && s.includes(b)) return { type: 'c', rot: r }; } return { type: 's', rot: 0 }; }
function genPuzzle() {
  const tiles = Array.from({ length: PZW * PZH }, () => ({ type: Math.random() < 0.5 ? 's' : 'c', rot: (Math.random() * 4) | 0 }));
  let x = 0, y = (Math.random() * PZH) | 0; const path = [[x, y]], seen = new Set([y * PZW + x]);
  while (x < PZW - 1) { const o = [[1, 0]]; if (y > 0 && !seen.has((y - 1) * PZW + x)) o.push([0, -1]); if (y < PZH - 1 && !seen.has((y + 1) * PZW + x)) o.push([0, 1]); const [dx, dy] = o[(Math.random() * o.length) | 0]; x += dx; y += dy; path.push([x, y]); seen.add(y * PZW + x); }
  const dirOf = (f, t) => t[0] > f[0] ? 1 : t[0] < f[0] ? 3 : t[1] > f[1] ? 2 : 0;
  for (let i = 0; i < path.length; i++) {
    const inD = i === 0 ? 3 : dirOf(path[i], path[i - 1]), outD = i === path.length - 1 ? 1 : dirOf(path[i], path[i + 1]);
    const t = tiles[path[i][1] * PZW + path[i][0]]; const s = connsToTile(inD, outD); t.type = s.type; t.rot = (s.rot + 1 + ((Math.random() * 3) | 0)) % 4;
  }
  const pz = { tiles, src: path[0][1], powered: new Set() };
  if (solvePuzzle(pz)) { const t = tiles[path[1][1] * PZW + path[1][0]]; t.rot = (t.rot + 1) % 4; solvePuzzle(pz); }
  return pz;
}
function solvePuzzle(pz) {
  const has = (i, d) => tileConns(pz.tiles[i]).includes(d);
  pz.powered = new Set(); const q = [];
  if (has(pz.src * PZW, 3)) { q.push(pz.src * PZW); pz.powered.add(pz.src * PZW); }
  const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  while (q.length) { const i = q.pop(); const x = i % PZW, y = (i / PZW) | 0; for (const d of tileConns(pz.tiles[i])) { const nx = x + D[d][0], ny = y + D[d][1]; if (nx < 0 || ny < 0 || nx >= PZW || ny >= PZH) continue; const j = ny * PZW + nx; if (!pz.powered.has(j) && has(j, (d + 2) % 4)) { pz.powered.add(j); q.push(j); } } }
  pz.done = [...pz.powered].some((i) => i % PZW === PZW - 1 && has(i, 1));
  return pz.done;
}
function renderPuzzle() {
  const grid = $('pzGrid'); grid.innerHTML = '';
  for (let i = 0; i < PZW * PZH; i++) {
    const t = puzzle.tiles[i]; const d = document.createElement('div'); d.className = 'pzTile' + (puzzle.powered.has(i) ? ' on' : '');
    d.innerHTML = '<svg viewBox="0 0 60 60"><path d="' + (t.type === 's' ? 'M30 2 V58' : 'M30 2 V30 H58') + '" /></svg>'; d.firstChild.style.transform = 'rotate(' + t.rot * 90 + 'deg)';
    d.addEventListener('click', () => { if (puzzle.done) return; t.rot = (t.rot + 1) % 4; sfx.throw(); solvePuzzle(puzzle); renderPuzzle(); if (puzzle.done) { sfx.wave(); setTimeout(closePuzzle, 700); } });
    grid.appendChild(d);
  }
  const L = $('pzL'), Rr = $('pzR'); L.innerHTML = ''; Rr.innerHTML = '';
  for (let y = 0; y < PZH; y++) { const a = document.createElement('div'); a.textContent = y === puzzle.src ? '⚡' : ''; a.className = y === puzzle.src ? 'on' : ''; L.appendChild(a); const b = document.createElement('div'); b.textContent = '🚧'; b.className = puzzle.done ? 'on' : ''; Rr.appendChild(b); }
}
function openPuzzle() { puzzle = genPuzzle(); renderPuzzle(); $('puzzle').classList.remove('hidden'); state = 'puzzle'; input.reset(); route = []; routeEndCell = null; showRoute(); }
function closePuzzle() {
  $('puzzle').classList.add('hidden'); const solved = puzzle && puzzle.done; puzzle = null; if (state === 'puzzle') state = 'play';
  if (solved && gate && !gate.open) openGate(); else if (switchCell) switchCell.dismissed = true;
}
function openGate() {
  gate.open = true; maze[gate.cy][gate.cx] = false; const oi = obstacles.indexOf(gate.obstacle); if (oi >= 0) obstacles.splice(oi, 1);
  gate.light.material.color.set(0x7dff6a); switchCell.lever.rotation.z = -0.6; flow = null; sfx.wave(); respawnCell = { cx: switchCell.cx, cy: switchCell.cy }; setTip('Power on! Gate open, checkpoint set. Head for the safe zone.'); say(player, 'That did it!');
}
$('puzzleClose').addEventListener('click', closePuzzle);
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

function startRun() { seen = true; unlockAudio(); setMusicChase(false); startMusic(); level = 1; score = 0; lives = 3; time = 0; cash = 0; cashThisDistrict = 0; Object.assign(inv, { shoes: 0, vest: false, flare: false, ammo: false, car: null, carHp: 0 }); if (car) { scene.remove(car); car = null; } driving = false; buildLevel(level); show(null); state = 'play'; }
function nextLevel() { if (state !== "cleared") return; level++; buildLevel(level); show(null); state = 'play'; }
function loseLife() {
  lives--; sfx.caught(); invuln = 2; if (riding) { riding.ride.speed = 1; riding = null; } playerInfect = 0; clearAntidote();
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
function parkCar() { driving = false; if (car) car.visible = false; player.visible = true; parked = false; }
// hop out at the current spot: the car stays on the street and you can walk back to it
let parked = false, parkedCd = 0;
function leaveCar(reason) {
  if (!driving) return; driving = false; parked = true; parkedCd = 1.0; player.visible = true; car.visible = true; player.position.x += Math.cos(player.rotation.y) * 1.0; player.position.z -= Math.sin(player.rotation.y) * 1.0; collide(player.position, R);
  say(player, reason || 'Back in a sec.', 1.5); setTip('You hopped out. Walk back to the car to drive again.');
}
function updateParkedCar(dt) {
  parkedCd -= dt;
  if (parked && car && !driving && inv.car && inv.carHp > 0 && parkedCd <= 0 && state === 'play' && !riding && player.position.distanceTo(car.position) < 0.8) { parked = false; startDriving(); route = []; routeEndCell = null; showRoute(); }
}
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
  state = 'cleared'; input.reset(); setMusicChase(false); sfx.wave();
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
  ['howto/6-follow.jpg', 'Walk up to people and they follow you. Get them to the safe zone for 250 points each. Or keep them between you and the horde: zombies take the nearest person first. Careful: a bitten follower spreads it down the line, and then to you.'],
  ['howto/4-gate.jpg', 'From district 2 the way out is gated. Glowing beams mark your goal: red for the gate, yellow for the power box. Rotate the wires to power the gate open.'],
  ['howto/5-exit.jpg', 'Follow the green arrow to the safe zone. One touch from a zombie costs a life. Ten districts, then the chopper pulls you out. Tap the binoculars to look around without walking. Double-tap a fairground ride (wheel, coaster, carousel) to ride it.'],
];
let slide = 0;
function showSlide(i) { slide = i; $('slideImg').src = SLIDES[i][0]; $('slideText').textContent = SLIDES[i][1]; $('slideDots').textContent = SLIDES.map((_, k) => k === i ? '●' : '○').join(' '); $('slideNext').textContent = i === SLIDES.length - 1 ? 'START SHIFT' : 'NEXT'; }
function openHowto() { show($('howto')); showSlide(0); }
$('slideNext').addEventListener('click', () => { if (slide < SLIDES.length - 1) showSlide(slide + 1); else { try { localStorage.setItem('oo_seen', '1'); } catch { /* ignore */ } startRun(); } });
$('slideSkip').addEventListener('click', () => { try { localStorage.setItem('oo_seen', '1'); } catch { /* ignore */ } startRun(); });
$('howtoBtn').addEventListener('click', openHowto);
let seen = false; try { seen = localStorage.getItem('oo_seen') === '1'; } catch { /* ignore */ }
$('startBtn').addEventListener('click', () => { unlockAudio(); if (seen) startRun(); else openHowto(); });
if (BUILD) startBuild();
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
  $('wonText').innerHTML = 'Extracted from Zombieville.<br>On the chopper with you: <b>' + rescued + '</b> (+' + rescued * 250 + ')<br>Still alive: ' + saved + '/' + totalPeople + '<br>Rescue bonus: +500<br><br>Final score: <b>' + score + '</b><br>Best: ' + best;
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
  if (state === 'wheel' && wg) updateWheelGame(dt);
  if (state === 'wheel' && cg) updateCoasterGame(dt);
  if (state === 'play') {
    time += dt; invuln -= dt; fireTimer -= dt; flowTimer -= dt;

    // player
    let moving = 0;
    if (route.length) {
      const w = toWorld(route[0][0], route[0][1], cols, rows);
      const dx = w.x - player.position.x, dz = w.z - player.position.z, d = Math.hypot(dx, dz);
      if (d < 0.35) { route.shift(); showRoute(); }
      else { const spd = PLAYER_SPEED * (1 + inv.shoes * 0.1) * (sprint > 0 ? 1.6 : 1) * (driving ? 1.7 : 1) * (infected > 0 ? 0.85 : 1); const step = Math.min(d, spd * dt); player.position.x += dx / d * step; player.position.z += dz / d * step; player.rotation.y = Math.atan2(dx, dz); moving = 1; if (sprint > 0 && Math.random() < 0.5) particle(player.position, previewMat); }
    }
    if (driving && car) { car.position.copy(player.position); car.rotation.y = player.rotation.y; animateCar(car, dt, moving); car.userData.hp = inv.carHp; }
    if (flare) { flareT -= dt; if (flareT <= 0) flare.visible = false; else { flare.scale.setScalar(1 + Math.sin(now * 0.03) * 0.3); if (Math.random() < 0.3) particle(flare.position, flare.material); } }
    noiseT -= dt;
    sprint -= dt; sprintCd -= dt; streakT -= dt; if (streakT <= 0 && streak) { streak = 0; updateHud(); }
    previewT -= dt; if (previewT <= 0 && previews[0].visible) showPreview([]);
    collide(player.position, R); animateWalk(player, dt, Math.min(1, moving));
    stepTimer -= dt; if (moving && stepTimer <= 0) { sfx.step(); stepTimer = 0.28; }
    // chase music while an alerted zombie is close
    { let hunted = false; for (const z of zombies) if (z.userData.alert > 0 && !z.userData.rag && z.position.distanceTo(player.position) < 13) { hunted = true; break; } setMusicChase(hunted); }
    groanTimer -= dt; if (groanTimer <= 0) { groanTimer = 2 + Math.random() * 3; let close = 0; for (const z of zombies) if (z.position.distanceTo(player.position) < 9) close++; if (close) sfx.groan(); setMusicTension(close); }
    player.visible = !driving && (invuln <= 0 || Math.sin(now * 0.03) > 0);

    // exit
    const pc = toCell(player.position.x, player.position.z, cols, rows);
    if (pc.cx === exitCell.cx && pc.cy === exitCell.cy) { clearDistrict(); return render(dt); }
    if (gate && !gate.open && switchCell) {
      const onSwitch = pc.cx === switchCell.cx && pc.cy === switchCell.cy;
      if (!onSwitch) switchCell.dismissed = false;
      else if (!switchCell.dismissed) { if (driving) leaveCar('Hang on, power box.'); openPuzzle(); return render(dt); }
    }
    // fly-bys, the ferris wheel ride, follower infection creeping toward you
    updateFlyby(dt); rideCd -= dt; updateFires(dt);
    if (riding) updateRide(dt);

    if (!riding && !ferrisHinted) { const nr = rideAt(player.position.x, player.position.z, 9); if (nr) { ferrisHinted = true; say(player, nr.name + '! Double-tap it.', 2.4); } }
    updateParkedCar(dt);
    playerInfect = Math.max(0, playerInfect - dt * 0.12);
    if (playerInfect >= 1) { playerInfect = 0; infectPlayer(); }
    updateGoo(dt);
    if (infected > 0) { infected -= dt; if (Math.random() < dt * 4) particle(player.position, gooBase); if (infected <= 0) { clearAntidote(); say(player, 'Too late...', 1.5); loseLife(); if (state !== 'play') return render(dt); } }
    if (!driving && !riding && invuln <= 0 && infected <= 0) for (const g of goo) if (Math.abs(g.position.x - player.position.x) < 0.3 && Math.abs(g.position.z - player.position.z) < 0.3) { infectPlayer(); break; }
    if (gate && gate.open && gateMesh.position.y > -1.3) gateMesh.position.y -= dt * 1.5;
    if (level === 1) {
      if (tipStage === 0 && !route.length) setTip('Tap the road to walk there, or drag a route.');
      if (tipStage === 0 && route.length) { tipStage = 1; setTip('Nice. Double-tap to sprint. Hold a finger down to preview the route.'); }
      if (tipStage === 1 && time > 6) { tipStage = 2; setTip('Your pistol fires by itself. Zombies hunt people first, so walk up to a crowd and they follow you.'); }
      if (tipStage === 2 && time > 25) { tipStage = 3; setTip('Follow the green arrow to the safe zone.'); }
    } else if (gate && !gate.open) {
      if (!gate.found && Math.abs(pc.cx - gate.cx) + Math.abs(pc.cy - gate.cy) <= 3) { gate.found = true; tipStage = 2; sfx.hit(); setTip('Locked. No power. The arrow now points to the power box that opens it.'); }
      else if (tipStage === 0) { tipStage = 1; setTip('Follow the arrow. Something is blocking the way out.'); }
    }
    else if (level === FINAL_LEVEL && tipStage === 0) { tipStage = 1; setTip('Last district. Reach the helipad and the chopper will pull you out.'); }

    // flow field toward player, refreshed a few times per second
    if (flowTimer <= 0 || !flow) { const fc = riding ? riding.cell : pc; flow = flowField(maze, fc.cx, fc.cy); flowTimer = 0.2; }

    // pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.mesh.rotation.y += dt * 2; p.mesh.position.y = 0.35 + Math.sin(now * 0.004) * 0.08;
      if (p.mesh.position.distanceTo(player.position) < 0.7) {
        if (p.type === 'antidote') { clearAntidote(); addScore(50); sfx.wave(); say(player, 'Cured!', 1.5); setTip(''); continue; }
        weapon = p.type; ammo = WEAPONS[p.type].ammo; scene.remove(p.mesh); pickups.splice(i, 1); sfx.pickup(); updateHud(); }
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
      const zu = z.userData;
      if (zu.rag) { const r = zu.rag; r.t += dt; r.vel.y -= 16 * dt; z.position.addScaledVector(r.vel, dt); z.rotation.x += r.spin.x * dt; z.rotation.z += r.spin.z * dt; if (z.position.y <= 0 && r.t > 0.35) removeZombie(i, z); continue; }
      if (zu.hp <= 0) { removeZombie(i, z); continue; }
      if (zu.stun > 0) { zu.stun -= dt; animateWalk(z, dt, 0); continue; }
      const c = toCell(z.position.x, z.position.z, cols, rows);
      const here = flow[c.cy * cols + c.cx];
      let tx = player.position.x, tz = player.position.z;
      zu.alert = (zu.alert || 0) - dt;
      if (riding) { zu.alert = 6; }
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
      else if (riding) { const rw = riding.world, rp = riding.ride.pos; if (Math.abs(rp.x - z.position.x) + Math.abs(rp.z - z.position.z) < 3.5) { tx = rp.x; tz = rp.z; } else if (here > 1) { let best = here, bx = c.cx, by = c.cy; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.cx + dx, ny = c.cy + dy; const v = flow[ny * cols + nx]; if (v >= 0 && v < best) { best = v; bx = nx; by = ny; } } const w = toWorld(bx, by, cols, rows); tx = w.x; tz = w.z; } else { tx = rw.x; tz = rw.z; } }
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
      if (dl > 0.05 && Math.random() < dt * 2.5) dropGoo(z.position);
      if (z.userData.flash > 0) { z.userData.flash -= dt; z.position.y = 0.1; } else z.position.y = 0;
      // infect civilians
      for (const civ of civilians) if (Math.hypot(civ.position.x - z.position.x, civ.position.z - z.position.z) < 0.7) civ.userData.infect += dt * 2;
      // touch player
      const touchD = Math.hypot(z.position.x - player.position.x, z.position.z - player.position.z);
      if (driving && touchD < 1.1) {
        const fwd = { x: Math.sin(player.rotation.y), z: Math.cos(player.rotation.y) };
        flingZombie(z, { x: (z.position.x - player.position.x) * 0.6 + fwd.x, z: (z.position.z - player.position.z) * 0.6 + fwd.z }, 6 + Math.random() * 3);
        inv.carHp--; carHits++; if (inv.carHp <= 0) wreckCar(); updateHud(); continue;
      }
      if (riding) continue;
      if (invuln <= 0 && touchD < R * 2) { if (vestUp) { vestUp = false; invuln = 1.2; sfx.hit(); say(player, 'Vest took it!'); for (let k = 0; k < 6; k++) particle(player.position, projMat); } else { loseLife(); if (state !== 'play') return render(dt); } }
    }
    if (level > 1) { stragglerTimer -= dt; if (stragglerTimer <= 0 && zombies.length < 10 + level * 3) { stragglerTimer = 22 - Math.min(12, level); const edges = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (!maze[y][x] && (x === 1 || y === 1 || x === cols - 2 || y === rows - 2)) edges.push([x, y]); const far = edges.filter(([x, y]) => Math.abs(x - pc.cx) + Math.abs(y - pc.cy) > 8); if (far.length) { const [x, y] = far[(Math.random() * far.length) | 0]; const sz = spawnZombie(toWorld(x, y, cols, rows), level); if (Math.random() < 0.5) { let best = null, bd = 4; for (const b of city.buildings) { if (b.userData.burning) continue; const d = Math.hypot(b.position.x - sz.position.x, b.position.z - sz.position.z); if (d < bd) { bd = d; best = b; } } if (best) burnBuilding(best); } } } }
    // civilians turning / following
    followers = civilians.filter((c) => c.userData.follow);
    for (let i = civilians.length - 1; i >= 0; i--) {
      const civ = civilians[i];
      const u = civ.userData;
      if (u.infect <= 0) for (const g of goo) if (Math.abs(g.position.x - civ.position.x) < 0.3 && Math.abs(g.position.z - civ.position.z) < 0.3) { u.infect = 0.05; break; }
      if (u.infect > 0) { u.infect += dt * 0.2; u.infectT = (u.infectT || 0) + dt; civ.position.y = Math.random() * 0.1; if (u.infect >= 1) { turnCivilian(civ); continue; } }
      else { civ.position.y = 0; u.infectT = 0; u.sick = false; u.warned = false; }
      if (u.infect > 0) {
        if (!u.sick) { u.sick = true; say(civ, ['I feel sick...', 'Something bit me.', "I'm fine. Go."][(Math.random() * 3) | 0], 2); }
        if (u.infectT > 2) {
          // two seconds in, it spreads to anyone close, and onto you if you stay near
          for (const o of civilians) if (o !== civ && !(o.userData.infect > 0) && o.position.distanceTo(civ.position) < 1.4) o.userData.infect += dt * 0.6;
          if (!driving && !riding && infected <= 0 && civ.position.distanceTo(player.position) < 1.0) { playerInfect += dt * 0.8; if (!u.warned) { u.warned = true; say(player, 'Back off! Bitten!', 1.5); if (level <= 3) setTip('Infected people spread it to anyone close, you included. Sprint away.'); } }
        }
      }
      if (!u.follow && civ.position.distanceTo(player.position) < 1.3 && !riding) { u.follow = true; u.goal = null; rescuedTotal++; addScore(25); sfx.pickup(); updateHud(); say(player, PLAYER_LINES[(Math.random() * PLAYER_LINES.length) | 0]); setTimeout(() => { if (civ.userData.follow) say(civ, CIV_LINES[(Math.random() * CIV_LINES.length) | 0], 1.8); }, 700); if (level === 1 && tipStage < 4) { tipStage = 4; setTip('They will follow you. Bring people to the safe zone for extra points.'); } }
      if (u.follow) {
        // target: a spot behind the player, staggered per follower
        const idx = followers.indexOf(civ); const leaderPos = idx <= 0 ? player.position : followers[idx - 1].position;
        const dx = leaderPos.x - civ.position.x, dz = leaderPos.z - civ.position.z, d = Math.hypot(dx, dz);
        if (riding) { animateWalk(civ, dt, 0); continue; }
        if (d > 0.9) { const st = Math.min(d - 0.7, PLAYER_SPEED * (u.infect > 0 ? 0.7 : 1.1) * dt); civ.position.x += dx / d * st; civ.position.z += dz / d * st; civ.rotation.y = Math.atan2(dx, dz); collide(civ.position, 0.2); animateWalk(civ, dt, 1); }
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
        if (Math.random() < dt * 0.02) say(civ, ['Hear that?', 'We should go.', 'Is it safe?', 'Where is everyone?', "I'm scared."][(Math.random() * 5) | 0], 1.6);
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
    // keep the view inside the walls (plus a strip of ruins) instead of centring on the player at the edge
    { const halfW = camera.right, halfH = camera.top / Math.sin(CAM_ELEV); const ext = (halfW + halfH) * Math.SQRT1_2 * 0.92;
      const bx = cols * CELL / 2 + 5, bz = rows * CELL / 2 + 5;
      want.x = ext >= bx ? 0 : Math.max(-bx + ext, Math.min(bx - ext, want.x)); want.z = ext >= bz ? 0 : Math.max(-bz + ext, Math.min(bz - ext, want.z)); }
    camTarget.lerp(want, state === 'play' ? 1 - Math.pow(0.002, dt) : 1);
    camera.position.copy(camTarget).addScaledVector(camDir, 60); camera.lookAt(camTarget);
    if (shake > 0) { shake -= dt; const k = shake * 0.35; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
    // buildings between the camera and the player go see-through
    for (const b of city.buildings) {
      const dx = b.position.x - player.position.x, dz = b.position.z - player.position.z;
      const towardCam = dx * camDir.x + dz * camDir.z; const dist = Math.hypot(dx, dz);
      const fade = towardCam > 0.25 && dist < 5.5 + (b.userData.h || 2) * 0.9 && Math.abs(dx * camDir.z - dz * camDir.x) < 3.6;
      const op = fade ? 0.12 : 1; for (const mat of b.userData.fade) if (mat.opacity !== op) { mat.opacity = op; }
      if (b.userData.edges) b.userData.edges.visible = fade;
      if (b.userData.extras) for (const e of b.userData.extras) e.visible = !fade;
    }
    // objective beacon + HUD line
    if ((state === 'play' || state === 'puzzle') && exitCell) {
      const oc = objectiveCell(); const ow = toWorld(oc.cx, oc.cy, cols, rows); const kind = infected > 0 && antidote ? 'antidote' : gate && !gate.open ? (gate.found ? 'switch' : 'gate') : 'exit';
      const col = kind === 'antidote' ? 0xd07cff : kind === 'gate' ? 0xff5c5c : kind === 'switch' ? 0xffd24a : 0x7dff6a;
      beacon.visible = beaconRing.visible = true; beacon.position.set(ow.x, 6, ow.z); beaconRing.position.set(ow.x, 0.06, ow.z); beaconMat.color.set(col); beaconRing.material.color.set(col);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004); beaconMat.opacity = 0.14 + pulse * 0.14; beaconRing.scale.setScalar(1 + pulse * 0.35);
      const text = kind === 'antidote' ? '☣ Antidote (purple beam) · ' + Math.ceil(infected) + 's' : level === FINAL_LEVEL && kind === 'exit' ? '➤ Reach the helipad' : kind === 'gate' ? '➤ Find the gate (red beam)' : kind === 'switch' ? '➤ Find the power box (yellow beam)' : '➤ Reach the safe zone (green beam)';
      if (objectiveEl.textContent !== text) objectiveEl.textContent = text; objectiveEl.classList.toggle('warn', kind === 'gate' || kind === 'antidote');
    } else { beacon.visible = beaconRing.visible = false; }
    // exit arrow
    if (state === 'play' && exitCell) {
      const tc = objectiveCell(); const pc0 = playerCell();
      const e = toWorld(tc.cx, tc.cy, cols, rows);
      const v = new THREE.Vector3(e.x, 0.5, e.z).project(camera), pv = player.position.clone().project(camera);
      const far = Math.abs(tc.cx - pc0.cx) + Math.abs(tc.cy - pc0.cy) > 2;
      arrowEl.classList.toggle('hidden', !far);
      if (far) {
        // orbit the player at a fixed distance, pointing at the objective
        const ang = Math.atan2(-(v.y - pv.y) * innerHeight, (v.x - pv.x) * innerWidth); const px = (pv.x * 0.5 + 0.5) * innerWidth, py = (-pv.y * 0.5 + 0.5) * innerHeight;
        const sx = px + Math.cos(ang) * 64, sy = py + Math.sin(ang) * 64;
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
window.__oo = { get cash() { return cash; }, set cash(v) { cash = v; renderStore(); }, get driving() { return driving; }, get inv() { return inv; }, get chopper() { return chopper; }, get chopperT() { return chopperT; }, set chopperT(v) { chopperT = v; }, routeTo: (cx, cy) => setRouteTo(toWorld(cx, cy, cols, rows)), get civilians() { return civilians; }, get maze() { return maze; }, get player() { return player; }, get gate() { return gate; }, get switchCell() { return switchCell; }, get cols() { return cols; }, get rows() { return rows; }, toWorld: (cx, cy) => toWorld(cx, cy, cols, rows), get pickups() { return pickups; }, get zombies() { return zombies; }, get exit() { return toWorld(exitCell.cx, exitCell.cy, cols, rows); }, get state() { return state; }, get rides() { return rides; }, get riding() { return riding; }, startRide, openRideGame, openPuzzle, flyby: () => { flybyT = 0; }, get flybyObj() { return flyby; }, get puzzle() { return puzzle; }, flingZombie, leaveCar, get parked() { return parked; }, infectPlayer, get infected() { return infected; }, get goo() { return goo; }, dropGoo, openWheelGame, get wg() { return wg; }, get mg() { return mg; }, camera, fx, explodeAt, burnBuilding, burnCar, get city() { return city; } };
