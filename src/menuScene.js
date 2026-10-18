// The main menu's live title scene: a side view down a city street, built from the game itself. The Acid Storm rolls
// in small, grows as it tears the buildings apart, shrugs off a seeding plane, then turns on the storm chaser who came
// for a photo and runs it down. A lightning flash, a fresh town, and round again.
import * as THREE from 'three';
import { generateMaze, buildCity, mulberry32 } from './city.js';
import { createTwisters } from './tornado.js';
import { makePlane, makeChaser } from './ally/units.js';
import { forceSeason } from './season.js';

const LOOP = 16;
export function startMenuScene(canvas, flashEl) {
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const cam = new THREE.PerspectiveCamera(44, 1.4, 0.1, 200);
  const sky = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#07060c'); gr.addColorStop(0.45, '#161a1e'); gr.addColorStop(0.7, '#2a3a2a'); gr.addColorStop(0.82, '#46553a'); gr.addColorStop(1, '#22262a'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c); })();
  let S = null, seed = 11;

  function dispose(scene) {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) for (const mm of Array.isArray(m) ? m : [m]) { for (const k in mm) { const v = mm[k]; if (v && v.isTexture) v.dispose(); } mm.dispose(); } if (o.isInstancedMesh) o.dispose(); });
  }
  function build() {
    if (S) dispose(S.scene);
    const scene = new THREE.Scene(); scene.background = sky; scene.fog = new THREE.Fog(0x22262a, 22, 70);
    const hemi = new THREE.HemisphereLight(0x9ab0a4, 0x2a2622, 1.35); scene.add(hemi); const sun = new THREE.DirectionalLight(0xc8e0d0, 0.75); sun.position.set(-8, 12, 10); scene.add(sun);
    const flash = new THREE.PointLight(0xc8ffb0, 0, 70); flash.position.set(0, 18, 0); scene.add(flash);
    // the town: three rows of buildings behind an avenue, open street in front where the chaser drives
    forceSeason('none'); const cols = 25, rows = 13, rng = mulberry32(seed++); const maze = generateMaze(cols, rows, 30, rng);
    for (let x = 1; x < cols - 1; x++) { maze[4][x] = false; for (let y = 5; y < rows - 1; y++) maze[y][x] = false; } maze.avenues = { row: 4, col: -1 };
    const city = buildCity(scene, maze, 3 + (seed % 97)); city.detail.clouds.visible = false;
    for (const pr of city.props) if (pr.z > -4) pr.g.visible = false; // a clear street in front of the camera
    const blds = city.buildings.map((b) => { const obj = b.parent !== city.group ? b.parent : b; const pos = b.getWorldPosition(new THREE.Vector3()); return { b, obj, pos, h: b.userData.h || 2, done: false }; }).filter((x) => x.pos.z > -13.5 && x.pos.z < -4);
    const tw = createTwisters(scene, { onBolt: () => { flash.intensity = 2.5; } }); tw.setBounds({ x: 30, z: 3.5 }); // babies roam the street but never right up to the camera
    const storm = tw.make(true, [], 'acid'); storm.position.set(-16, 0, -6); storm.scale.setScalar(0.3); scene.add(storm);
    const plane = makePlane(); plane.scale.setScalar(1.5); plane.visible = false; scene.add(plane);
    const chaser = makeChaser(); chaser.scale.setScalar(1.7); chaser.visible = false; chaser.rotation.y = -Math.PI / 2; scene.add(chaser);
    S = { scene, city, blds, tw, storm, T: storm.userData.twister, plane, chaser, flash, t: 0, x: -16, s: 0.3, pl: { x: 18, h: -Math.PI / 2, on: false, hit: false }, ch: { x: 16, mode: 'off', caught: false }, drops: [], bolts: [], camX: -6 };
  }
  const tmp = new THREE.Vector3();
  function bolt(to) { const pts = []; let x = to.x + (Math.random() - 0.5) * 3, z = to.z; for (let y = 22; y > to.y; y -= 2) { pts.push(new THREE.Vector3(x, y, z)); x += (to.x - x) * 0.3 + (Math.random() - 0.5) * 1.2; } pts.push(to.clone());
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xb8ff6a })); S.scene.add(l); S.bolts.push({ l, t: 0.25 }); S.flash.intensity = 3; }

  function step(dt) {
    const s = S; s.t += dt; const t = s.t;
    // the storm: rolls in, grows, then lunges after the chaser
    const speed = t < 9 ? 1.75 : t < 12.5 ? 4.6 : 1.2; s.x += speed * dt;
    const want = t < 8.5 ? 0.3 + (t / 8.5) * 0.5 : 0.85; const seeded = s.pl.on && Math.abs(s.plane.position.x - s.x) < 2.8 && !s.pl.hit;
    s.s += ((seeded ? want * 0.8 : want) - s.s) * Math.min(1, dt * 2); s.storm.scale.setScalar(s.s); s.storm.position.x = s.x;
    for (const L of s.T.layers) { if (L.userData.op0 == null) L.userData.op0 = L.material.opacity; L.material.opacity = L.userData.op0 * (seeded ? 0.5 : 1); }
    // buildings it reaches are torn up and spun into the funnel (taller ones once it has grown)
    const reach = 1.4 + s.s * 3.4, maxH = 2.5 + s.s * 9;
    for (const x of s.blds) { if (x.done || Math.abs(x.pos.x - s.x) > reach || x.h > maxH) continue; x.done = true; const size = new THREE.Box3().setFromObject(x.obj).getSize(new THREE.Vector3()); const loose = x.obj === x.b ? (x.b.userData.extras || []).filter((m) => m.parent) : []; if (x.b.userData.edges) x.b.userData.edges.visible = false; s.tw.tear(x.obj, x.pos, size, s.T, loose); }
    // the seeding plane: flies in, sprays the storm (it shrinks), loops back - and gets struck and sent packing
    const P = s.pl; if (!P.on && t > 2.6) { P.on = true; s.plane.visible = true; P.x = s.x + 26; }
    if (P.on) { if (t > 8 && !P.turned) { P.turned = true; P.turnT = 0; } if (P.turned && !P.hit) { P.turnT += dt; P.h = -Math.PI / 2 + Math.min(1, P.turnT / 1.6) * Math.PI; }
      if (!P.hit && t > 9.6) { P.hit = true; bolt(s.plane.position.clone()); P.h = Math.PI / 2 + 0.6; }
      P.x += Math.sin(P.h) * 7 * dt; const z = -2.5 + (P.turned ? Math.sin(P.turnT * 1.3) * 2 : 0); s.plane.position.set(P.x, 5.2 + Math.sin(t * 1.7) * 0.25, z + (P.hit ? (t - 9.6) * 2 : 0)); s.plane.rotation.set(0, P.h, P.turned && P.turnT < 1.6 ? -0.5 : 0);
      for (const pr of s.plane.userData.props) pr.rotation.z += dt * 40;
      if (seeded && Math.random() < dt * 30) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), new THREE.MeshBasicMaterial({ color: 0xe8f6ff })); m.position.copy(s.plane.position).add(tmp.set((Math.random() - 0.5) * 2.4, -0.2, 0)); s.scene.add(m); s.drops.push({ m, life: 1.4 }); } }
    for (let i = s.drops.length - 1; i >= 0; i--) { const d = s.drops[i]; d.life -= dt; d.m.position.y -= dt * 5; if (d.life <= 0) { s.scene.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); s.drops.splice(i, 1); } }
    // the storm chaser: drives in, parks for its photos, then runs - and doesn't make it
    const C = s.ch, cg = s.chaser; if (C.mode === 'off' && t > 4) { C.mode = 'in'; cg.visible = true; C.x = s.x + 22; }
    if (C.mode === 'in') { C.x -= 4.5 * dt; if (C.x - s.x < 7.5) C.mode = 'shoot'; cg.rotation.y = -Math.PI / 2; }
    else if (C.mode === 'shoot') { cg.userData.flash.material.opacity = Math.random() < dt * 4 ? 1 : cg.userData.flash.material.opacity * 0.8; if (t > 9) { C.mode = 'flee'; cg.rotation.y = Math.PI / 2; } }
    else if (C.mode === 'flee') { C.x += 4.8 * dt; cg.userData.flash.material.opacity *= 0.8; if (C.x - s.x < reach * 0.8) { C.mode = 'gone'; s.tw.suck(cg, s.T); s.flash.intensity = 3.5; } }
    if (C.mode !== 'gone' && C.mode !== 'off') { cg.position.set(C.x, 0, 1.5); cg.userData.mast.rotation.y += dt * 4; }
    for (let i = s.bolts.length - 1; i >= 0; i--) { const b = s.bolts[i]; b.t -= dt; b.l.visible = Math.random() < 0.85; if (b.t <= 0) { s.scene.remove(b.l); b.l.geometry.dispose(); b.l.material.dispose(); s.bolts.splice(i, 1); } }
    s.tw.update(dt); s.city.updateRain(dt); s.flash.intensity = Math.max(0, s.flash.intensity - dt * 9);
    // camera: low, side-on across the street, drifting with the storm
    s.camX += (Math.max(-7, Math.min(14, s.x * 0.75)) - s.camX) * Math.min(1, dt * 1.5); cam.position.set(s.camX, 2.6, 14.5); cam.lookAt(s.camX + 1, 4.4, -8);
    // the end: a white-out flash, then a fresh town
    if (flashEl) flashEl.style.opacity = t > LOOP - 0.6 ? Math.min(1, (t - (LOOP - 0.6)) / 0.35) : t < 0.5 && s.fresh ? 1 - t / 0.5 : 0;
  }

  let last = performance.now(), raf = 0, running = true;
  function frame(now) {
    raf = requestAnimationFrame(frame); const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; if (!running) return;
    const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    step(dt); if (S.t >= LOOP) { build(); S.fresh = true; }
    renderer.render(S.scene, cam);
  }
  document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });
  build(); raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); running = false; }, get state() { return S; } };
}
