// The main menu's opening, built from the game itself and under five seconds long: the Liberty Twister tears through a
// 4th of July town and into the graveyard (ghost-fire and all), a burning plane comes down in the distance, and a saucer
// beams people up off the street. Then the title lands, and the same scene carries on quietly behind the menu.
// Coming back to the menu from a game skips the opening: the scene starts in its quiet state.
import * as THREE from 'three';
import { generateMaze, buildCity, mulberry32, CELL } from './city.js';
import { createTwisters } from './tornado.js';
import { createFires } from './fire.js';
import { createPoiFx } from './ally/poiFx.js';
import { makePlane } from './ally/units.js';
import { makeSaucer } from './ally/foeModels.js';
import { makeCharacter, animateWalk } from './poster/characters.js';
import { buildOutskirts } from './outskirts.js';
import { forceSeason } from './season.js';
import { forceEra } from './progress.js';
import { sfx } from './audio.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), rnd = (a, b) => a + Math.random() * (b - a);
const COLS = 15, ROWS = 11, SCALE = 0.85, REACH = 1.6 * (SCALE / 0.42); // the storm's size, and how far out it wrecks things
const GRAVE = [7, 6], T_GRAVE = 2.15, T_LOGO = 3.3, T_TAP = 4.2; // when the graveyard goes up, the title lands and the button shows
const OUTFITS = ['worker', 'pink', 'plaid', 'hivis', 'suit', 'hoodie', 'punk', 'vest'];

// onBeat('logo' | 'tap' | 'flash', value): the page's cue to bring in the title, the button, or to flash the screen
export function startIntroScene(canvas, { intro = true, onBeat = () => {} } = {}) {
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.debug.checkShaderErrors = false;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); // a stormy dusk: dark overhead, a band of light on the horizon
    gr.addColorStop(0, '#07040f'); gr.addColorStop(0.2, '#1c0f33'); gr.addColorStop(0.33, '#5a3f86'); gr.addColorStop(0.42, '#3a3a66'); gr.addColorStop(1, '#16302f'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex; }
  scene.fog = new THREE.Fog(0x3a3460, 34, 120);
  scene.add(new THREE.HemisphereLight(0xb8c4ff, 0x2a2438, 1.6)); const sun = new THREE.DirectionalLight(0xd8dcff, 0.9); sun.position.set(-6, 10, 8); scene.add(sun);

  // ---------- the town: an avenue for the storm, a graveyard beside it, open ground in front of the camera ----------
  forceEra('present'); forceSeason('july4'); let city;
  try { const rng = mulberry32(20264), maze = generateMaze(COLS, ROWS, 14, rng);
    for (let x = 1; x < COLS - 1; x++) { maze[5][x] = false; for (let y = 7; y < ROWS - 1; y++) maze[y][x] = false; } maze.avenues = { row: 5, col: -1 };
    for (let x = 1; x < COLS - 1; x++) maze[6][x] = x % 4 !== 1; // the row in front of the avenue: houses, with a gap now and then
    maze[GRAVE[1]][GRAVE[0]] = true; maze.forcedLandmarks = new Map([[GRAVE[1] * COLS + GRAVE[0], 'cemetery']]);
    city = buildCity(scene, maze, 41); buildOutskirts(scene, COLS, ROWS, 41); city.detail.clouds.visible = false;
    { const bb = new THREE.Box3(), near = (ROWS / 2 - 1.2) * CELL; city.group.updateMatrixWorld(true); for (const o of city.group.children) { bb.setFromObject(o); if (!bb.isEmpty() && bb.min.z > near) o.visible = false; } } // the edge of town nearest the camera: out of the way
  } finally { forceEra(null); forceSeason(null); }
  const fx = createFires(scene), flash = (v) => onBeat('flash', v); let shake = 0; const jolt = (v) => { shake = Math.max(shake, v); };
  const tw = createTwisters(scene, { onBolt: (p, ground) => { if (ground) fx.zap(p, 0xb8c8ff); } }); tw.setFx(fx); tw.setBounds({ x: COLS * CELL / 2, z: ROWS * CELL / 2 });
  const poiFx = createPoiFx(scene, fx, { jolt, flash, popup() {}, arcTargets: () => [] });
  const blds = city.buildings.map((b) => { const obj = b.parent !== city.group ? b.parent : b; return { b, obj, pos: b.getWorldPosition(V()), h: b.userData.h || 2, done: false }; });
  const grave = city.hazards.find((h) => h.type === 'cemetery'), gravePos = grave ? grave.pos.clone() : V(0, 0, 3);
  const storm = tw.make(true, [], 'july4'), T = storm.userData.twister; storm.scale.setScalar(SCALE); scene.add(storm);
  const path = (t) => { const k = Math.min(1, t / T_GRAVE), e = 1 - (1 - k) * (1 - k); return V(-8.5 + (gravePos.x - 0.6 + 8.5) * e, 0, -1.6 + (gravePos.z - 2.6 + 1.6) * e); }; // in from the left, slowing as it reaches the graveyard

  function wreck(x, quiet) { x.done = true; const ex = x.obj === x.b ? (x.b.userData.extras || []).filter((m) => m.parent) : []; if (x.b.userData.edges) x.b.userData.edges.visible = false;
    if (quiet) { x.obj.visible = false; for (const m of ex) m.visible = false; return; }
    tw.tear(x.obj, x.pos, new THREE.Box3().setFromObject(x.obj).getSize(V()), T, [], ex); if (x.h > 4) { fx.explode(V(x.pos.x, 1, x.pos.z), 1.2); jolt(0.4); } sfx.crunch(x.h > 4); }
  function wreckNear(p, quiet, max = 9) { let n = 0; for (const x of blds) { if (x.done || Math.hypot(x.pos.x - p.x, x.pos.z - p.z) > REACH + 1.15) continue; wreck(x, quiet); if (++n >= max) break; } return n; }
  function hitGrave(quiet) { if (!grave || grave.done) return; grave.done = true;
    if (quiet) { for (const m of grave.parts) m.visible = false; return; }
    const g = new THREE.Group(); g.position.copy(gravePos); scene.add(g); for (const m of grave.parts) if (m.parent) g.attach(m);
    tw.tear(g, gravePos, new THREE.Box3().setFromObject(g).getSize(V()), T, []); fx.explode(V(gravePos.x, 1, gravePos.z), 2.2); poiFx.play('cemetery', gravePos); flash(0.3); jolt(1); sfx.boom(); }
  function strike(p) { const c = tw.strikeAt(T, p); fx.zap(p, c || 0xb8c8ff); flash(0.12); sfx.boom(); }

  // ---------- the saucer, beaming people up off the street in front ----------
  const ufo = makeSaucer(), UFO = V(gravePos.x + 3.5, 6.9, gravePos.z + 2.6); ufo.scale.setScalar(0.55); ufo.userData.shield.visible = false; ufo.position.copy(UFO); scene.add(ufo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.25, 1, 18, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: 0x7df0ff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); beam.renderOrder = 4; scene.add(beam);
  const person = () => { const c = makeCharacter(OUTFITS[(Math.random() * OUTFITS.length) | 0], { look: Math.random() }); c.scale.setScalar(0.3); scene.add(c); return c; };
  const lifted = []; for (let i = 0; i < 5; i++) lifted.push({ c: person(), t: -i * 0.55, a: Math.random() * 6.28, r: rnd(0.2, 0.9) });
  // ---------- people legging it across the front, arms in the air ----------
  const runners = []; for (let i = 0; i < 9; i++) { const c = person(); c.position.set(gravePos.x - 5 + rnd(-3, 5), 0, gravePos.z + 2.5 + rnd(0, 5)); c.userData.panic = true; runners.push({ c, sp: rnd(1.9, 2.8), dir: rnd(-0.25, 0.45) }); }
  // ---------- the plane: on fire, coming down beyond the far end of town ----------
  let plane = null; const wide = (canvas.clientWidth || innerWidth) > (canvas.clientHeight || innerHeight), P0 = wide ? V(gravePos.x - 20, 17, -12) : V(gravePos.x - 7.5, 17, -17), P1 = wide ? V(gravePos.x - 19, 0.4, -27) : V(gravePos.x - 4.6, 0.4, -27); // well off to the left on a wide screen; near the middle on a tall phone, where there is no room at the sides
  if (intro) { plane = makePlane(); plane.scale.setScalar(1.6); plane.position.copy(P0); scene.add(plane); }

  let t = intro ? 0 : 60, idleT = 0, boltT = 1.2, wp = 0, beat = 0; const pos = intro ? path(0) : V(gravePos.x - 0.6, 0, gravePos.z - 2.6), aim = V();
  if (!intro) { for (let k = 0; k <= 20; k++) wreckNear(path(k / 20 * T_GRAVE), true, 99); hitGrave(true); beat = 2; } // already through: what the opening wrecks is simply gone
  const WAY = [[2.6, -3.4], [-3.2, -5], [-5.5, -1.4], [-0.6, -2.6]]; // where it wanders once the opening is over (offsets from the graveyard)

  function step(dt) {
    t += dt;
    if (t < T_GRAVE + 0.4) { pos.copy(path(t)); wreckNear(pos, false, 2); } // the run in: everything in its way goes
    else { const w = WAY[wp % WAY.length]; aim.set(gravePos.x + w[0], 0, gravePos.z + w[1]).sub(pos); const d = aim.length(); if (d < 0.5) wp++; else pos.addScaledVector(aim, Math.min(d, 1.1 * dt) / d); idleT -= dt; if (idleT <= 0 && wreckNear(pos, false, 1)) idleT = 0.7; }
    storm.position.copy(pos);
    if (grave && !grave.done && t >= T_GRAVE) hitGrave(false);
    // lightning: a few bolts in the opening, then one every couple of seconds
    boltT -= dt; if (boltT <= 0) { boltT = t < 4 ? rnd(0.7, 1.1) : rnd(1.8, 3.6); const a = Math.random() * 6.28, d = rnd(4, 8); strike(V(pos.x + Math.cos(a) * d, 0.05, pos.z + Math.sin(a) * d * 0.6 + 1)); }
    // the plane spins down trailing fire, and goes up where it lands
    if (plane) { const k = Math.min(1, Math.max(0, (t - 0.25) / 1.75)); plane.position.lerpVectors(P0, P1, k * k * 0.6 + k * 0.4); plane.rotation.set(0.5 + k * 0.5, Math.atan2(P1.x - P0.x, P1.z - P0.z), t * 7); for (const p of plane.userData.props) p.rotation.z += dt * 30;
      for (let i = 0; i < 2; i++) { fx.puff('flame', plane.position, 2.2); fx.puff('smoke', plane.position, 2.4); }
      if (k >= 1) { const at = P1.clone(); scene.remove(plane); plane = null; fx.explode(at, 3); fx.explode(V(at.x + 2, 0.4, at.z + 1), 2.4); fx.ignite(V(at.x, 0.2, at.z), 2.4, 30); fx.ignite(V(at.x + 2.5, 0.2, at.z - 1), 1.8, 30); flash(0.25); jolt(0.5); sfx.boom(); } }
    // the saucer hovers; its catch rises up the beam, one after another, for as long as the menu is up
    ufo.position.set(UFO.x + Math.sin(t * 0.9) * 0.35, UFO.y + Math.sin(t * 1.7) * 0.18, UFO.z); ufo.rotation.y += dt * 0.8; ufo.userData.ring.material.map.offset.x += dt * 0.7;
    beam.position.set(ufo.position.x, ufo.position.y - 0.25, ufo.position.z); beam.scale.set(1, ufo.position.y - 0.3, 1); beam.material.opacity = 0.26 + Math.random() * 0.1;
    for (const L of lifted) { L.t += dt; const c = L.c, k = L.t / 2.6; if (k >= 1) { L.t = -rnd(0, 0.6); L.a = Math.random() * 6.28; L.r = rnd(0.2, 0.9); }
      c.visible = L.t >= 0; if (!c.visible) continue; const r = L.r * (1 - k * 0.8); c.position.set(ufo.position.x + Math.cos(L.a + t * 2) * r, k * (ufo.position.y - 1), ufo.position.z + Math.sin(L.a + t * 2) * r); c.rotation.y += dt * 5; c.rotation.z = Math.sin(t * 6 + L.a) * 0.3; animateWalk(c, dt, 1.4); }
    for (const R of runners) { const c = R.c; c.position.x += R.sp * dt; c.position.z += R.dir * dt; c.rotation.y = Math.PI / 2 - R.dir * 0.4; animateWalk(c, dt, 1.8); if (c.position.x > gravePos.x + 11) { c.position.x = gravePos.x - 11; c.position.z = gravePos.z + 2.5 + rnd(0, 5); } }
    if (beat === 0 && t >= T_LOGO) { beat = 1; onBeat('logo'); flash(0.2); } if (beat === 1 && t >= T_TAP) { beat = 2; onBeat('tap'); }
    tw.update(dt); fx.update(dt); poiFx.update(dt); city.updateRain(dt);
    // the camera pushes in over the opening, then drifts
    const a = cam.aspect, tall = a < 1, k = Math.min(1, t / 3.2), e = 1 - Math.pow(1 - k, 3), sway = Math.sin(t * 0.35) * 0.6, cx = gravePos.x + (tall ? 0.4 : 1.4);
    cam.fov = tall ? 62 : 44; cam.updateProjectionMatrix();
    cam.position.set(cx - 2.5 * (1 - e) + sway, (tall ? 8.6 : 7.4) - 1.6 * (1 - e), gravePos.z + (tall ? 18 : 19.5) + 6 * (1 - e)); cam.lookAt(cx + sway * 0.4, 4.3, gravePos.z - 3);
    if (shake > 0) { shake = Math.max(0, shake - dt * 2.4); const s = shake * shake * 0.5; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; }
  }

  let last = performance.now(), raf = 0, running = true, skip = false, drawn = false;
  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    if (t > 8 && (skip = !skip)) return; // once it has settled behind the menu, every other frame is plenty
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight, pr = renderer.getPixelRatio(); if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) { renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); }
    step(dt); renderer.render(scene, cam); if (!drawn) { drawn = true; onBeat('ready'); }
  }
  document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });
  renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false); cam.aspect = (canvas.clientWidth || innerWidth) / Math.max(1, canvas.clientHeight || innerHeight); cam.updateProjectionMatrix();
  step(0); renderer.compile(scene, cam); raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); running = false; }, get t() { return t; }, get calls() { return renderer.info.render.calls; }, get tris() { return renderer.info.render.triangles; }, finish() { if (t < T_TAP) { t = Math.max(t, T_TAP); } } };
}
