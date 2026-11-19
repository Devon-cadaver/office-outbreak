// What a big target does when the storm takes it. Every target gets the blast and the break-up; on top of that each one
// goes up in its own way: the water station bursts, the fire and police stations throw siren lights in every direction,
// the fairground lets go of its balloons and fireworks. Timed in the game's own seconds (a pause holds it), and built
// from the shared particle batches plus one batch of balloons, so none of it adds more than a few draws.
import * as THREE from 'three';
import { sfx } from '../audio.js';
import { createBolts } from '../bolt.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), rnd = (a, b) => a + Math.random() * (b - a), pick = (l) => l[(Math.random() * l.length) | 0];
const beamGeo = new THREE.CircleGeometry(17, 5, -0.09, 0.18).rotateX(-Math.PI / 2); // a narrow wedge of light lying flat: a beacon's beam
const dishGeo = new THREE.SphereGeometry(1.15, 14, 6, 0, 6.2832, 0, Math.PI / 2.4).scale(1, 0.4, 1).rotateX(Math.PI), dishMat = new THREE.MeshLambertMaterial({ color: 0xe8eef2, side: THREE.DoubleSide });
const mastGeo = new THREE.BoxGeometry(0.32, 1, 0.32), mastR = new THREE.MeshLambertMaterial({ color: 0xc23b3b }), mastW = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
const PARTY = [0xff3a5a, 0xffd24a, 0x3ad0ff, 0x7dff3a, 0xff7ae0, 0xff8a2a, 0xb07aff], WATER = [0xffffff, 0x4fa8ff];

export function createPoiFx(scene, fx, E) { // E: { jolt(v), flash(v), popup(pos, text, colour), arcTargets(c, r, n) -> [{ pos, hit() }] }
  const zaps = createBolts(scene);
  const seq = [], live = [], props = []; let clock = 0; // props: meshes an effect has put in the scene for a moment
  const at = (t, fn) => seq.push({ t: clock + t, fn }), run = (fn) => live.push(fn);

  // ---------- balloons: one batch, each floating up and away until it pops ----------
  const BAL = 80, bal = [], balMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8).scale(1, 1.25, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), BAL), bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), bp = V(), bs = V(), bc = new THREE.Color();
  balMesh.frustumCulled = false; balMesh.count = 0; balMesh.setColorAt(0, bc);
  function balloon(x, y, z, col, size = 1) { if (bal.length >= BAL) return; bal.push({ x, y, z, vx: rnd(-0.9, 0.9), vz: rnd(-0.9, 0.9), vy: rnd(1.5, 3), s: rnd(0.8, 1.25) * size, life: rnd(3.5, 7), col, w: Math.random() * 6.28, t: 0 }); }
  function updateBalloons(dt) { if (!bal.length && !balMesh.count) return; if (balMesh.parent !== scene) scene.add(balMesh); let n = 0;
    for (let i = bal.length - 1; i >= 0; i--) { const b = bal[i]; b.t += dt; b.life -= dt; b.w += dt * 2.2; b.x += (b.vx + Math.sin(b.w) * 0.5) * dt; b.z += (b.vz + Math.cos(b.w * 0.8) * 0.5) * dt; b.y += b.vy * dt;
      if (b.life <= 0) { fx.sparks({ x: b.x, y: b.y, z: b.z }, 5, { c: [0xffffff, b.col], speed: 3, up: 1, life: 0.3 }); if (Math.random() < 0.3) sfx.pop(); bal.splice(i, 1); } }
    for (const b of bal) { const s = b.s * Math.min(1, b.t * 4); bp.set(b.x, b.y, b.z); bs.set(s, s, s); bm.compose(bp, bq, bs); balMesh.setMatrixAt(n, bm); balMesh.setColorAt(n, bc.setHex(b.col)); n++; }
    balMesh.count = n; balMesh.instanceMatrix.needsUpdate = true; if (balMesh.instanceColor) balMesh.instanceColor.needsUpdate = true; }

  // ---------- a firework: a rocket climbs on a trail of sparks, then bursts in two colours ----------
  function rocket(p, c1, c2) { const vel = V(rnd(-1.5, 1.5), rnd(11, 15), rnd(-1.5, 1.5)); let t = rnd(0.55, 0.85);
    run((dt) => { t -= dt; p.addScaledVector(vel, dt); vel.y -= 6 * dt; fx.spray(p, 1, { c: [0xfff2b0, 0xff8a2a], speed: 0.6, up: [-1.5, 0], life: 0.35, size: 0.1, grav: 2, stretch: 2 }); if (t > 0) return true;
      fx.spray(p, 40, { c: [0xffffff, c1], speed: 8, up: [-5, 7], life: 1.4, size: 0.3, grav: 4.5, drag: 1.5, stretch: 3 }); fx.spray(p, 26, { c: [c1, c1], speed: 7, up: [-4.5, 6], life: 1.5, size: 0.6, grav: 4, drag: 1.5, shape: 0, stretch: 0 }); fx.spray(p, 18, { c: [0xffffff, c2], speed: 3.5, up: [-2.5, 4], life: 1.2, size: 0.5, grav: 3.5, drag: 1.4, shape: 0, stretch: 0 });
      fx.flash(p, 3.6, c1); fx.glow(p, 7, c1, 0.6, 0.5); sfx.firework(); E.flash(0.07); return false; }); }

  // beams of light sweeping round a spot, fading out over `secs`: beacons, a radar
  function beams(c, cols, secs, speed, y = 1.4, op = 0.45) { const g = new THREE.Group(), list = []; g.position.set(c.x, y, c.z); let t = 0;
    cols.forEach((col, i) => { const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.rotation.y = (i / cols.length) * 6.2832; m.renderOrder = 4; g.add(m); list.push(m); }); scene.add(g); props.push(g);
    run((dt) => { t += dt; g.rotation.y += dt * speed; const k = Math.max(0, 1 - t / secs); for (const m of list) m.material.opacity = op * k * (0.7 + 0.3 * Math.sin(t * 30)); if (t < secs) return true; scene.remove(g); props.splice(props.indexOf(g), 1); for (const m of list) m.material.dispose(); return false; }); }
  // ---------- siren lights: beacons sweeping round where the station stood, and light bars racing off in every direction ----------
  function sirens(c, cols, n = 9) {
    beams(c, [0, 1, 2, 3].map((i) => cols[i % cols.length]), 4.2, 7.5);
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + rnd(-0.2, 0.2), dir = V(Math.cos(a), 0, Math.sin(a)), p = V(c.x, 0.5, c.z), sp = rnd(11, 16), off = i % cols.length; let tt = 0, gl = 0;
      run((dt) => { tt += dt; gl -= dt; p.addScaledVector(dir, sp * dt); const col = cols[(((tt * 9) | 0) + off) % cols.length]; fx.flash(p, 0.55, col); if (gl <= 0) { gl = 0.07; fx.glow(p, 1.6, col, 0.3, 0.85); }
        if (tt < 1.8) return true; fx.sparks(p, 10, { c: [0xffffff, col], speed: 5, up: 4, life: 0.5 }); return false; }); }
  }
  // a pipe or hydrant bursting: a jet of water for a few seconds, and a puddle
  function jet(p, secs = 2.6, power = 1) { let t = 0; fx.pool(p, 1.5 * power, 0x2a6a9a, 12, 0.5);
    run((dt) => { t += dt; fx.spray(p, 1, { c: WATER, speed: 1.3, up: [6 * power, 10 * power], life: 1.1, size: 0.3, grav: 15 }); if (Math.random() < dt * 14) fx.spray(p, 1, { c: [0xffffff, 0x6ab8ff], speed: 0.5, up: [5 * power, 8 * power], life: 0.9, size: 0.7, grav: 13, shape: 1, stretch: 0 }); if (Math.random() < dt * 8) fx.dust(p, 0.9, 0, 0, 0xcfe8ff); return t < secs; }); }

  const SHOW = {
    // the tanks burst: a great column of water, a wave racing out along the streets, pipes going all round, and it rains back down
    water(c) {
      const o = V(c.x, 0.5, c.z); fx.spray(o, 30, { c: [0xffffff, 0x6ab8ff], speed: 1.8, up: [7, 16], life: 1.5, size: 1.2, grav: 13, shape: 1, stretch: 0, spread: 0.7 }); // the column itself: fat white water
      fx.spray(o, 90, { c: WATER, speed: 5, up: [9, 19], life: 1.9, size: 0.36, grav: 15, stretch: 3.5, spread: 0.8 }); fx.spray(o, 60, { c: WATER, speed: 13, up: [3, 8], life: 1.3, size: 0.3, grav: 14 });
      for (let i = 0; i < 10; i++) fx.dust(V(c.x + rnd(-1.5, 1.5), 0.4, c.z + rnd(-1.5, 1.5)), 2.4, 0, 0, 0xcfe8ff);
      fx.shock(c, 14, 0x8fd0ff, 1.1); fx.shock(c, 8, 0xffffff, 0.6); fx.glow(c, 7, 0x4fa8ff, 0.9, 0.7); fx.pool(c, 4.5, 0x2a6a9a, 16, 0.55); sfx.splash(); E.jolt(1);
      let r = 1.5, wt = 0; run((dt) => { r += 13 * dt; wt -= dt; if (wt <= 0) { wt = 0.045; for (let k = 0; k < 7; k++) { const a = Math.random() * 6.28, q = V(c.x + Math.cos(a) * r, 0.15, c.z + Math.sin(a) * r); fx.spray(q, 2, { c: WATER, speed: 1.5, up: [2, 4.5], life: 0.55, size: 0.3, vx: Math.cos(a) * 5, vz: Math.sin(a) * 5 }); if (k < 2) fx.dust(q, 1.3, Math.cos(a) * 3, Math.sin(a) * 3, 0xcfe8ff); } } return r < 13; });
      for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, d = rnd(4, 11); at(rnd(0.25, 1.5), () => { sfx.whoosh(); jet(V(c.x + Math.cos(a) * d, 0.1, c.z + Math.sin(a) * d)); }); }
      at(0.9, () => { let t = 0; run((dt) => { t += dt; for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28, d = Math.random() * 11; fx.spray(V(c.x + Math.cos(a) * d, rnd(7, 10), c.z + Math.sin(a) * d), 1, { c: WATER, speed: 0.3, up: [-13, -10], life: 0.75, size: 0.22, grav: 0, drag: 0 }); } return t < 2.4; }); });
      at(0.55, () => sfx.splash());
    },
    // sirens: red and white for the fire station, with a hydrant or two going and its two-tone horn
    firestation(c) { sirens(c, [0xff2a1a, 0xffffff, 0xff2a1a, 0xffb02a]); sfx.neenaw(); for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, d = rnd(2.5, 5); at(rnd(0.2, 0.9), () => jet(V(c.x + Math.cos(a) * d, 0.1, c.z + Math.sin(a) * d), 3.2, 0.8)); }
      for (let i = 0; i < 12; i++) fx.ember(V(c.x + rnd(-2, 2), rnd(0.5, 2.5), c.z + rnd(-2, 2)), 1.6); },
    // sirens: red and blue for the police station, strobing, with the whoop of its cars
    police(c) { sirens(c, [0xff2a2a, 0x2a6aff], 10); sfx.whoop(); for (let i = 1; i < 5; i++) at(i * 0.22, () => { E.flash(0.09); fx.glow(c, 9, i % 2 ? 0x2a6aff : 0xff2a2a, 0.2, 0.5); }); },
    // the fair goes up: every balloon let go at once, fireworks one after another, confetti everywhere
    fair(c) {
      for (let i = 0; i < 60; i++) at(i < 36 ? rnd(0, 0.35) : rnd(0.4, 2.4), () => balloon(c.x + rnd(-3.8, 3.8), rnd(0.5, 2.5), c.z + rnd(-2, 2), pick(PARTY)));
      for (let i = 0; i < 12; i++) at(0.15 + i * 0.3 + rnd(0, 0.15), () => rocket(V(c.x + rnd(-4.5, 4.5), 0.6, c.z + rnd(-2.5, 2.5)), PARTY[i % PARTY.length], PARTY[(i * 3 + 2) % PARTY.length]));
      for (let i = 0; i < 46; i++) fx.bit(V(c.x + rnd(-3, 3), 1.5, c.z + rnd(-1.5, 1.5)), 1.1, pick(PARTY), 10);
      for (let i = 0; i < 4; i++) fx.spray(V(c.x + rnd(-3, 3), 1, c.z + rnd(-1.5, 1.5)), 22, { c: PARTY, pick: true, speed: 8, up: [5, 12], life: 1.6, size: 0.16, grav: 10, drag: 1.2, stretch: 1.6 });
    },
    // ghost-fire: green flame bursts up out of the graves, spirits corkscrew away, a cold fog rolls out, headstones fly
    cemetery(c) {
      const o = V(c.x, 0.3, c.z), G = [0xe8ffd0, 0x3aff6a];
      fx.spray(o, 46, { c: G, speed: 2.4, up: [3, 9], life: 1.7, size: 1.0, grav: -1.5, drag: 1.2, shape: 1, stretch: 0, spread: 1.6 }); fx.spray(o, 50, { c: [0xffffff, 0x7dff3a], speed: 7, up: [4, 10], life: 1.1, size: 0.22, grav: 9 }); // the fire rises rather than falls
      fx.shock(c, 10, 0x7dff9a, 0.9); fx.glow(c, 8, 0x3aff6a, 2.2, 0.7); fx.pool(c, 3.6, 0x16301c, 16, 0.5); sfx.ghost(); at(0.5, () => sfx.groan()); at(0.35, () => E.popup(V(c.x, 2, c.z), 'BOO!', '#b8ffc8'));
      for (let i = 0; i < 26; i++) fx.bit(V(c.x + rnd(-1.5, 1.5), 0.6, c.z + rnd(-1.5, 1.5)), 1.5, pick([0x8a8f96, 0x5a5f66, 0x6a7078]), 9);
      for (let i = 0; i < 22; i++) at(rnd(0, 1.1), () => { const a = Math.random() * 6.28; fx.dust(V(c.x + Math.cos(a) * 1.5, 0.2, c.z + Math.sin(a) * 1.5), rnd(2.2, 3.4), Math.cos(a) * 3.5, Math.sin(a) * 3.5, 0x8ab89a); });
      for (let i = 0; i < 9; i++) { const a0 = (i / 9) * 6.28, r0 = rnd(0.6, 1.6), sp = rnd(2.4, 4), up = rnd(2.2, 3.4), out = rnd(0.5, 1.3); let t = -rnd(0, 0.5); // spirits: each a glowing head on a fading tail
        run((dt) => { t += dt; if (t < 0) return true; const a = a0 + t * sp, r = r0 + t * out, p = V(c.x + Math.cos(a) * r, 0.4 + t * up, c.z + Math.sin(a) * r);
          fx.spray(p, 1, { c: [0xffffff, 0x7dff9a], speed: 0.2, up: [-0.3, 0.3], life: 0.55, size: 0.75, grav: 0, drag: 0, shape: 0, stretch: 0 }); if (Math.random() < dt * 14) fx.spray(p, 1, { c: G, speed: 0.6, up: [-1, 0], life: 0.7, size: 0.3, grav: 0, shape: 0, stretch: 0 }); return t < 2.6; }); }
    },
    // the dish flies off like a frisbee, the weather balloons get away, the radar sweeps its last, and it hails
    weather(c) {
      const RAD = 0x7dffb0, dish = new THREE.Mesh(dishGeo, dishMat), a = Math.random() * 6.28, vel = V(Math.cos(a) * rnd(6, 8), 9, Math.sin(a) * rnd(6, 8)); dish.position.set(c.x, 2.5, c.z); dish.rotation.z = 0.35; scene.add(dish); props.push(dish);
      run((dt) => { vel.y -= 9 * dt; dish.position.addScaledVector(vel, dt); dish.rotation.y += dt * 16; if (dish.position.y > 0.2) return true; const p = dish.position.clone().setY(0.2); fx.sparks(p, 16, { speed: 6, up: 5 }); for (let i = 0; i < 4; i++) fx.dust(p, 1.4); fx.scorch(p, 0.9, 12); sfx.hit(); scene.remove(dish); props.splice(props.indexOf(dish), 1); return false; });
      for (let i = 0; i < 9; i++) at(rnd(0, 0.6), () => balloon(c.x + rnd(-1.5, 1.5), rnd(1, 3), c.z + rnd(-1.5, 1.5), i % 3 ? 0xf4f4f4 : 0xff5a4a, 1.7));
      for (let i = 0; i < 5; i++) at(i * 0.28, () => { fx.shock(c, 13, RAD, 0.9); sfx.ping(i); }); beams(c, [RAD, RAD], 3.2, 4, 1.2, 0.5); fx.glow(c, 7, RAD, 1.2, 0.6);
      at(0.5, () => { let t = 0; run((dt) => { t += dt; for (let k = 0; k < 3; k++) { const b = Math.random() * 6.28, d = Math.random() * 10; fx.spray(V(c.x + Math.cos(b) * d, rnd(7, 10), c.z + Math.sin(b) * d), 1, { c: [0xffffff, 0xcfe8ff], speed: 0.4, up: [-15, -11], life: 0.7, size: 0.2, grav: 0, drag: 0 }); }
          if (Math.random() < dt * 22) { const b = Math.random() * 6.28, d = Math.random() * 9; fx.bit(V(c.x + Math.cos(b) * d, 0.3, c.z + Math.sin(b) * d), 0.7, 0xf2f8ff, 2.5); } return t < 2.6; }); });
    },
    // a brown geyser, a stink that rolls out along the streets in green clouds, and manhole covers going up all round
    sewage(c) {
      const o = V(c.x, 0.4, c.z), MUCK = [0xc49a3c, 0x6a4a18];
      fx.spray(o, 56, { soft: true, a: 1, c: MUCK, speed: 2.4, up: [8, 18], life: 1.8, size: 1.25, grav: 14, shape: 1, stretch: 0, spread: 0.9 }); fx.glow(c, 7, 0xb89030, 1.2, 0.6); fx.spray(o, 40, { soft: true, a: 0.95, c: MUCK, speed: 9, up: [3, 9], life: 1.3, size: 0.5, grav: 13, shape: 1, stretch: 0 });
      fx.pool(c, 5.5, 0x4a3612, 18, 0.7); fx.shock(c, 9, 0xb8a040, 0.7); sfx.splat(); E.jolt(0.8); at(0.3, () => E.popup(V(c.x, 2, c.z), 'PHEW!', '#c8e04a'));
      for (let i = 0; i < 30; i++) at(rnd(0, 1.6), () => { const a = Math.random() * 6.28; fx.dust(V(c.x + Math.cos(a) * 1.2, 0.2, c.z + Math.sin(a) * 1.2), rnd(2.4, 3.8), Math.cos(a) * 4, Math.sin(a) * 4, 0x8aa82a); });
      for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, d = rnd(4.5, 14), p = V(c.x + Math.cos(a) * d, 0.15, c.z + Math.sin(a) * d); // a manhole: a spout of muck, and the cover goes up
        at(0.35 + i * 0.22 + rnd(0, 0.12), () => { fx.spray(p, 10, { soft: true, a: 0.95, c: MUCK, speed: 1.2, up: [5, 10], life: 1.1, size: 0.55, grav: 14, shape: 1, stretch: 0 }); fx.bit(V(p.x, 0.3, p.z), 2.4, 0x23252a, 1.2); fx.pool(p, 1.5, 0x4a3612, 14, 0.65); for (let k = 0; k < 3; k++) fx.dust(p, 1.8, 0, 0, 0x8aa82a); sfx.pop(); if (i % 3 === 0) sfx.splat(); }); }
    },
    // the plant shorts out: lightning leaps from it to the buildings round about and on to the next, transformers go off like fireworks
    power(c) {
      const top = V(c.x, 3.2, c.z), spots = E.arcTargets(c, 15, 14), look = { color: 0xf4faff, glow: 0x5aa0ff, w: 0.22, minPx: 8, life: 0.32, forks: 2 };
      while (spots.length < 8) { const a = Math.random() * 6.28, d = rnd(5, 13); spots.push({ pos: V(c.x + Math.cos(a) * d, 0.1, c.z + Math.sin(a) * d) }); }
      fx.spray(top, 60, { c: [0xffffff, 0x7ab8ff], speed: 9, up: [2, 11], life: 0.9, size: 0.2, grav: 12 }); fx.shock(c, 12, 0x9fd0ff, 0.8); fx.glow(c, 9, 0x5aa0ff, 0.9, 0.8); sfx.zap(); at(0.2, () => sfx.powerdown());
      spots.slice(0, 8).forEach((sp, i) => at(0.08 + i * 0.16, () => { zaps.bolt(top.clone().add(V(rnd(-1, 1), rnd(-0.5, 1), rnd(-1, 1))), sp.pos, { ...look, arc: 1.2 }); fx.zap(sp.pos, 0x5aa0ff); fx.sparks(sp.pos, 14, { c: [0xffffff, 0x7ab8ff], speed: 6, up: 6 }); E.flash(0.06); if (i % 2 === 0) sfx.zap(); if (sp.hit) sp.hit();
        const nx = spots[8 + i]; if (nx) at(0.14, () => { zaps.bolt(sp.pos, nx.pos, { ...look, w: 0.15 }); fx.zap(nx.pos, 0x5aa0ff); if (nx.hit) nx.hit(); }); }));
      for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, d = rnd(5, 15), p = V(c.x + Math.cos(a) * d, rnd(1.6, 2.6), c.z + Math.sin(a) * d); at(0.5 + i * 0.24 + rnd(0, 0.1), () => { fx.flash(p, 1.6, 0xbfe0ff); fx.spray(p, 26, { c: [0xffffff, 0xffd24a], speed: 5, up: [1, 7], life: 0.9, size: 0.16, grav: 12 }); fx.glow(p, 3, 0x9fd0ff, 0.3, 0.8); sfx.zap(); }); }
    },
    // the mast comes down across the street in a shower of sparks while its last broadcast goes out in rings
    radio(c) {
      const g = new THREE.Group(), H = 7.5, yaw = Math.random() * 6.28; g.position.set(c.x, 0.2, c.z); for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(mastGeo, i % 2 ? mastW : mastR); m.position.y = (i + 0.5) * (H / 6); m.scale.set(1 - i * 0.1, H / 6, 1 - i * 0.1); g.add(m); } g.rotation.y = yaw; scene.add(g); props.push(g); let t = 0, down = false;
      run((dt) => { t += dt; const k = Math.min(1, t / 1.25); g.rotation.set(0, yaw, 0); g.rotateX(k * k * (Math.PI / 2 - 0.04)); // it leans, then falls faster
        const tip = V(0, H, 0).applyQuaternion(g.quaternion).add(g.position); if (!down && Math.random() < dt * 30) fx.sparks(tip, 3, { c: [0xffffff, 0xffd24a], speed: 3, up: 2, life: 0.4 });
        if (k >= 1 && !down) { down = true; for (let i = 1; i <= 6; i++) { const p = V(0, H * i / 6, 0).applyQuaternion(g.quaternion).add(g.position).setY(0.2); fx.sparks(p, 12, { c: [0xffffff, 0xffd24a], speed: 6, up: 5 }); fx.dust(p, 1.4); } fx.explode(tip.clone().setY(0.3), 0.9); E.jolt(0.7); sfx.crunch(true); }
        if (t < 3.2) return true; scene.remove(g); props.splice(props.indexOf(g), 1); return false; });
      for (let i = 0; i < 7; i++) at(i * 0.2, () => fx.shock(c, 15, i % 2 ? 0xffd24a : 0xff7ae0, 1)); fx.glow(c, 7, 0xffd24a, 1, 0.6); sfx.static();
      ['♪', 'BZZT!', '♫', 'KSSHH!', '♪'].forEach((txt, i) => at(0.15 + i * 0.3, () => E.popup(V(c.x + rnd(-3, 3), rnd(1.5, 4), c.z + rnd(-3, 3)), txt, i % 2 ? '#ffd24a' : '#ff9ae8')));
    },
  };
  function play(kind, center) { const f = SHOW[kind]; if (f) f(V(center.x, 0, center.z)); return !!f; }
  function update(dt) { clock += dt; for (let i = seq.length - 1; i >= 0; i--) if (seq[i].t <= clock) { const s = seq[i]; seq.splice(i, 1); s.fn(); } for (let i = live.length - 1; i >= 0; i--) if (!live[i](dt)) live.splice(i, 1); updateBalloons(dt); zaps.update(dt); }
  function clear() { zaps.clear(); seq.length = 0; live.length = 0; for (const g of props) scene.remove(g); props.length = 0; bal.length = 0; balMesh.count = 0; }
  return { play, update, clear, after: at, // after(t, fn): run fn in t game seconds
    get kinds() { return Object.keys(SHOW); }, get busy() { return seq.length + live.length + bal.length; } };
}
