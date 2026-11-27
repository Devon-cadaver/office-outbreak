// BEAM 'EM UP!'s army: everything in town that fights the saucer. It gets tougher town by town:
//   SOLDIERS (every town): squads on the streets firing tracers up at the ship. Small hits. Beam them up!
//   TANKS (every town): roll in along the streets. The barrel glows, then a big glowing shell comes up at you: a big hit,
//     but slow enough to dodge if you keep moving.
//   HELICOPTERS (every town): circle the ship and fire rockets. Small Town gets one slow, weak one after the first minute;
//     Suburbs one or two; from Downtown they come in pairs (three in the biggest towns).
//   JETS (Suburbs on): strafing runs. A red dashed lane on the street first, through where the saucer is heading; then the
//     jet streaks along it firing tracers. Too fast for the automatic ray: a tap brings one down. Pairs from Downtown, and
//     from Metro each one also fires a missile that chases you.
//   MISSILE TRUCKS (Metro on): parked near the big targets. A red line means it has locked on; then a missile chases you.
// (The HORN TRUCKS, Downtown on, are Tornado Time!'s storm cannons: ../ally/foes.js, wired up in main.js.)
// Every shot is a bright moving thing with a trail, so a player can see it coming and get out of the way. All the shots of
// one kind are drawn in one go (an instanced mesh each), so a sky full of tracer costs a phone four draws.
// main.js hands in what this needs (E) and calls spawnTown / update / pick / nearest / hitArea / eachDot / coachTick / clear.
import * as THREE from 'three';
import { toWorld, toCell, findPath } from '../city.js';
import { sfx } from '../audio.js';
import { makeCharacter, animateWalk } from '../poster/characters.js';
import { makeTank } from '../ally/units.js';
import { makeGunship } from '../ally/foeModels.js';
import { isFuture, isPast, hoverize, futureTank, buildCannon } from '../era.js';
import { armySkin } from '../skins.js';
import { makeLauncher, makeJet, makeLane } from './models.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), rnd = (a, b) => a + Math.random() * (b - a), ZV = V(0, 0, 1), noop = () => {};
const turnTo = (cur, want, max) => { let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); return cur + Math.max(-max, Math.min(max, d)); };
const gunGeo = new THREE.BoxGeometry(0.12, 0.14, 0.6), gunMat = new THREE.MeshLambertMaterial({ color: 0x22262a });
const glowGeo = new THREE.SphereGeometry(0.5, 10, 8), lineGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
export const ARMY_FIRST = { ship: 1, jet: 1, jetPair: 2, jetMissile: 3, launcher: 3 }; // the town each kind first turns up in
// a jet's strafing run: warn (seconds the lane shows before the jet comes), speed, half (how far from the lane's middle it
// starts), hw (half the lane's width: where its tracers go), hitR (how close a tracer must pass the saucer to hit it), every
// (seconds between tracers), from / to (where along the lane, from its middle, the guns fire)
const JET = { warn: 1.5, speed: 30, half: 30, hw: 2.4, hitR: 1.8, every: 0.075, from: -23, to: 1 };

import { makeMammoth } from './boss.js';
import { createMinis } from './minis.js';
export function createArmy(E) {
  const { scene, fx, twisters } = E;
  let soldiers = [], tanks = [], ships = [], launchers = [], jets = [], runs = []; const falling = [], shots = [], wrecks = []; /* wrecks: aircraft down and done ploughing, waiting to leave the scene (updateFalling) */
  const T = { ship: 0, reinf: 0, tank: 0, jet: 0, column: 0 };
  // THE BOSS: the Iron Mammoth is a tank like the others here (so taps, rays and blasts reach it) with hit points: it comes
  // straight for the saucer, fires both barrels in turn, harder and from further off, and takes hp hits to stop
  let boss = null;
  function addBoss(hp) { const { c, w } = farRoad(22), g = makeMammoth(); g.position.set(w.x, 0, w.z); scene.add(g); const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.visible = false; glow.renderOrder = 6; scene.add(glow);
    boss = { g, cell: c, path: [], cd: 3, repath: 0, charge: 0, glow, arrow: mkArrow('👑', '#ff5a4a'), boss: true, hp, max: hp, immune: 0, side: 1, smoke: 0 }; tanks.push(boss); return boss; }
  function dropBoss() { const t = boss; boss = null; if (!t) return; const i = tanks.indexOf(t); if (i >= 0) tanks.splice(i, 1); scene.remove(t.glow); t.glow.material.dispose(); t.arrow.remove(); scene.remove(t.g); }
  // a TANK COLUMN: a group of 3 to 10 tanks rolling in together from one part of town (bigger in the later towns)
  function tankColumn() { const L = E.level, n = Math.max(3, Math.min(10, 3 + Math.floor((L - 1) * 1.3 + Math.random() * 2))), at = farRoad(20).w; for (let k = 0; k < n; k++) addTank(14, 1 + k * 0.5, at, 7); E.banner('🪖 TANK COLUMN: ' + n + ' TANKS!'); sfx.whoosh(); } // seconds until the next helicopters, reinforcements, tank, jet run
  const ramp = () => Math.min(1, (E.level - 1) / 5); // 0 in Small Town, 1 in The Sprawl
  const easy = () => 1 - ramp(); // 1 in Small Town, 0 in The Sprawl: the first towns start calmer and their soldiers shoot less often and less straight
  const maxTanks = () => 2 + E.level + (E.foeK ? Math.floor((E.foeK() - 1) * 6) : 0); /* (more of them in a harder round, or a later wave of an endless one) */ /* tanks in town at once: just the one in Small Town, where the death ray is new */
  const mkArrow = (txt, col) => { const a = document.createElement('div'); a.className = 'planeArrow foeArrow'; a.textContent = txt; a.style.color = col; document.body.appendChild(a); return a; };
  const seen = (pos, y = 0) => E.toScreen(pos, y).on;

  // ---------- shots: what the army fires. kind: bullet (tracer), shell (tank), rocket (gunship), missile (truck, homes in) ----------
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
  const KIND = { bullet: { geo: new THREE.BoxGeometry(0.09, 0.09, 0.85), mat: basic(0xffe27a), max: 320 }, shell: { geo: new THREE.SphereGeometry(0.24, 10, 8), mat: basic(0xffa040), max: 48 },
    rocket: { geo: new THREE.BoxGeometry(0.15, 0.15, 0.66), mat: basic(0xdff6ff), max: 48 }, missile: { geo: new THREE.BoxGeometry(0.22, 0.22, 0.95), mat: basic(0xff3a2a), max: 16 } };
  for (const k in KIND) { const K = KIND[k]; K.mesh = new THREE.InstancedMesh(K.geo, K.mat, K.max); K.mesh.frustumCulled = false; K.mesh.count = 0; K.mesh.renderOrder = 5; }
  function shoot(kind, from, vel, o = {}) { shots.push({ kind, p: from.clone(), v: vel.clone(), life: o.life || 3, t: 0, dmg: o.dmg || 1, sm: 0, home: o.home || 0, speed: vel.length(), vmax: o.vmax || vel.length(), r: o.r || 0, src: o.src || kind, px: o.px || 0, onZap: o.onZap || null }); } /* px: how near a tap must be to zap it (a mini boss's missile is easier), onZap: what else happens when it is zapped */ /* r: its own hit reach (a jet's tracers), else the ship's shield; src: who fired it (for the damage count) */
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sc4 = V(1, 1, 1), dir4 = V(), toS = V();
  function updateShots(dt) { const S = E.ship;
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.life -= dt; s.t += dt; const p = s.p;
      if (s.kind === 'missile') { if (s.home > 0 && S.alive) { s.home -= dt; toS.copy(S.pos).sub(p).normalize(); dir4.copy(s.v).normalize(); const ang = dir4.angleTo(toS), mx = 1.55 * dt; if (ang > 1e-4) dir4.lerp(toS, Math.min(1, mx / ang)).normalize(); s.v.copy(dir4); } else s.v.normalize(); // it steers after the ship for a few seconds, then flies straight
        s.speed = Math.min(s.vmax, s.speed + 7 * dt); s.v.multiplyScalar(s.speed); }
      p.addScaledVector(s.v, dt); s.sm -= dt;
      if (s.sm <= 0) { if (s.kind === 'shell') { s.sm = 0.04; fx.puff('flame', p, 0.32); if (Math.random() < 0.5) fx.puff('smoke', p, 0.3); } else if (s.kind === 'rocket') { s.sm = 0.045; fx.puff('smoke', p, 0.24); } else if (s.kind === 'missile') { s.sm = 0.03; fx.puff('flame', p, 0.34); fx.puff('smoke', p, 0.32); } else s.sm = 9; } // trails: you can see where each one came from
      if (S.alive) { const dx = p.x - S.pos.x, dy = (p.y - S.pos.y) * 1.9, dz = p.z - S.pos.z, R = s.r || S.r; if (dx * dx + dy * dy + dz * dz < R * R) { E.hurt(s.dmg, s.src, p); fx.sparks(p, s.kind === 'bullet' ? 4 : 12, { c: [0xffffff, 0x7dff3a], speed: 4, up: 2, life: 0.35 }); if (s.kind !== 'bullet') fx.explode(p.clone(), s.kind === 'missile' ? 0.9 : 0.55); shots.splice(i, 1); continue; } }
      if (p.y <= 0.12) { if (s.kind === 'bullet') fx.puff('smoke', p, 0.2); else { fx.explode(p.clone().setY(0.3), s.kind === 'missile' ? 0.9 : s.kind === 'shell' ? 0.7 : 0.45); fx.scorch(p, 0.8, 14); E.groundHit(p, s.kind); } shots.splice(i, 1); continue; }
      if (s.life <= 0) { if (s.kind !== 'bullet') { fx.explode(p.clone(), 0.6); fx.puff('smoke', p, 0.9); } shots.splice(i, 1); } } // spent in the air: a puff of flak
    for (const k in KIND) KIND[k].n = 0;
    for (const s of shots) { const K = KIND[s.kind]; if (K.n >= K.max) continue; dir4.copy(s.v).normalize(); q4.setFromUnitVectors(ZV, dir4); sc4.setScalar(s.kind === 'shell' ? 1 + Math.sin(s.t * 30) * 0.22 : 1); m4.compose(s.p, q4, sc4); K.mesh.setMatrixAt(K.n++, m4); }
    for (const k in KIND) { const K = KIND[k]; if (K.mesh.parent !== scene) scene.add(K.mesh); K.mesh.count = K.n; K.mesh.visible = K.n > 0; K.mesh.instanceMatrix.needsUpdate = true; } } // none in the air: not drawn at all

  // ---------- getting about: routes along the streets (as in Tornado Time!) ----------
  function roadPathTo(cell, wx, wz, away) { const t = E.town, roads = t.roads; let target = toCell(wx, wz, t.cols, t.rows);
    if (away) { let best = null, bd = -1; for (let k = 0; k < 12; k++) { const c = roads[(Math.random() * roads.length) | 0]; const w = toWorld(c[0], c[1], t.cols, t.rows); const d = Math.hypot(w.x - wx, w.z - wz); if (d > bd) { bd = d; best = c; } } target = { cx: best[0], cy: best[1] }; }
    if (t.maze[target.cy]?.[target.cx] !== false) { let best = null, bd = 1e9; for (const c of roads) { const d = Math.abs(c[0] - target.cx) + Math.abs(c[1] - target.cy); if (d < bd) { bd = d; best = c; } } target = { cx: best[0], cy: best[1] }; }
    return findPath(t.maze, { cx: cell[0], cy: cell[1] }, target).slice(0, 14); }
  function followPath(o, speed, dt) { if (!o.path.length) return false; const t = E.town, [cx, cy] = o.path[0], w = toWorld(cx, cy, t.cols, t.rows), g = o.g, dx = w.x - g.position.x, dz = w.z - g.position.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { o.cell = o.path.shift(); return true; } const st = Math.min(d, speed * dt); g.position.x += dx / d * st; g.position.z += dz / d * st; const want = Math.atan2(dx, dz); let dr = want - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 8); return true; }
  // a street cell at least `min` from the ship (and from the middle of town when it is the start)
  function farRoad(min, near = null, maxD = 1e9) { const t = E.town, S = E.ship.pos; for (let k = 0; k < 80; k++) { const c = t.roads[(Math.random() * t.roads.length) | 0], w = toWorld(c[0], c[1], t.cols, t.rows); if (Math.hypot(w.x - S.x, w.z - S.z) < min) continue; if (near && Math.hypot(w.x - near.x, w.z - near.z) > maxD) continue; return { c, w }; } const c = t.roads[(Math.random() * t.roads.length) | 0]; return { c, w: toWorld(c[0], c[1], t.cols, t.rows) }; }

  // ---------- soldiers ----------
  function addSoldier(x, z) { const s = makeCharacter('vest', { skin: armySkin() }); s.scale.setScalar(0.25); s.position.set(x, 0, z); s.rotation.y = Math.random() * 6.28; const gun = new THREE.Mesh(gunGeo, gunMat); gun.position.set(0, -0.72, 0.25); s.userData.armR.add(gun);
    Object.assign(s.userData, { cd: rnd(0.6, 2.6), soldier: true, home: s.position.clone() }); scene.add(s); soldiers.push(s); return s; }
  function addSquad(min) { const { w } = farRoad(min); for (let i = 0; i < 3; i++) addSoldier(w.x + (i - 1) * 0.5, w.z + rnd(-0.3, 0.3)); }
  function updateSoldiers(dt) { const S = E.ship, rk = ramp(), RANGE = 9.5 + 2.5 * rk, every = (1.9 - 0.75 * rk) * (1 + 0.4 * easy()), spread = (1.5 - 0.4 * rk) * (1 + 0.45 * easy()) * (E.blind > 0 ? 2.6 : 1);
    for (let i = soldiers.length - 1; i >= 0; i--) { const s = soldiers[i], u = s.userData, dx = S.pos.x - s.position.x, dz = S.pos.z - s.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > 32) { if (!u.frz) { u.frz = true; s.updateMatrixWorld(true); s.updateMatrixWorld = noop; } continue; } if (u.frz) { u.frz = false; delete s.updateMatrixWorld; } // out of sight: hold still, matrices frozen
      if (u.stun > E.played) { animateWalk(s, dt, 0); continue; }
      if (d < RANGE && S.alive) { s.rotation.y = Math.atan2(dx, dz); animateWalk(s, dt, 0); u.armR.rotation.x = -2.25; u.armL.rotation.x = -2.05; u.cd -= dt; // feet planted, rifle up at the saucer
        if (u.cd <= 0) { u.cd = every * rnd(0.7, 1.3); const from = s.position.clone().setY(0.5).addScaledVector(V(dx / d, 0, dz / d), 0.25), to = S.pos.clone().add(V(rnd(-1, 1) * spread, rnd(-0.5, 0.5) * spread, rnd(-1, 1) * spread)); shoot('bullet', from, to.sub(from).normalize().multiplyScalar(19), { dmg: 0.9 + 0.5 * rk, life: 1.6 }); if (Math.random() < 0.25 && seen(s.position)) sfx.throw(); } }
      else if (d < 24 && S.alive) { const sp = 1.15 * dt; s.position.x += dx / d * sp; s.position.z += dz / d * sp; s.rotation.y = Math.atan2(dx, dz); animateWalk(s, dt, 1); E.collide(s); } // closing in on foot
      else animateWalk(s, dt, 0); } }

  // ---------- tanks ----------
  function addTank(min, wait = 0, near = null, maxD = 1e9) { const { c, w } = farRoad(min, near, maxD); const t = isPast() ? buildCannon() : makeTank(isFuture()); if (isFuture()) hoverize(futureTank(t), 0xff4fd8); t.position.set(w.x, 0, w.z); scene.add(t);
    const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.visible = false; glow.renderOrder = 6; scene.add(glow);
    tanks.push({ g: t, cell: c, path: [], cd: rnd(2.5, 4.5) + wait, repath: 0, charge: 0, glow, arrow: mkArrow('💣', '#ff7a5a') }); }
  const muzzleOf = (t) => V(t.boss ? t.side * 0.3 : 0, 0.64, t.boss ? 1.8 : 1.25).applyMatrix4(t.g.userData.turret.matrixWorld);
  function updateTanks(dt) { const S = E.ship, rk = ramp(), RANGE = 16 + 3 * rk;
    for (let i = tanks.length - 1; i >= 0; i--) { const t = tanks[i], p = t.g.position, dx = S.pos.x - p.x, dz = S.pos.z - p.z, d = Math.hypot(dx, dz);
      t.repath -= dt; if (t.repath <= 0) { t.repath = 2; t.path = d > (t.boss ? 8 : 13) ? roadPathTo(t.cell, S.pos.x, S.pos.z, false) : d < 5 && !t.boss ? roadPathTo(t.cell, S.pos.x, S.pos.z, true) : []; } if (!t.charge) followPath(t, t.boss ? (d > 20 ? 2.6 : 1.3) : 1.8, dt); /* (the boss hurries until it is in range) */
      if (t.boss) { const u = t.g.userData; u.dish.rotation.y += dt * 2.4; u.eye.material.color.setHex(performance.now() < t.immune ? 0xffffff : 0xff3a2a); t.smoke -= dt; if (t.smoke <= 0) { t.smoke = 0.35; fx.puff('smoke', V(p.x - Math.sin(t.g.rotation.y) * 1.9, 2.2, p.z - Math.cos(t.g.rotation.y) * 1.9), 0.5); } }
      const tur = t.g.userData.turret, want = Math.atan2(dx, dz) - t.g.rotation.y; tur.rotation.y += Math.atan2(Math.sin(want - tur.rotation.y), Math.cos(want - tur.rotation.y)) * Math.min(1, dt * 4);
      t.cd -= dt; if (!t.charge && d < (t.boss ? 26 : RANGE) && t.cd <= 0 && S.alive) { t.charge = 0.8; t.glow.visible = true; } // the barrel glows first: that is the warning
      if (t.charge) { t.charge = Math.max(0, t.charge - dt); t.g.updateMatrixWorld(true); const mz = muzzleOf(t), k = 1 - t.charge / 0.8; t.glow.position.copy(mz); t.glow.scale.setScalar(0.25 + k * 0.5); t.glow.material.opacity = 0.4 + k * 0.55; t.glow.material.color.setHex(k > 0.7 ? 0xff3a2a : 0xff9a3a);
        if (t.charge <= 0) { t.glow.visible = false; t.cd = t.boss ? rnd(1.8, 2.5) : (3.8 - 1.3 * rk) * rnd(0.85, 1.25); if (t.boss) t.side = -t.side; const sp = t.boss ? 14 : 10.5 + 3 * rk, aim = S.pos.clone().add(V(rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6)).multiplyScalar(E.blind > 0 ? 4 : 1)); shoot('shell', mz, aim.sub(mz).normalize().multiplyScalar(sp), { dmg: t.boss ? 9 : 6 + 2.5 * rk, life: 3.2 }); fx.puff('flame', mz, 0.7); fx.puff('smoke', mz, 0.8); if (seen(p)) { sfx.boom(); E.jolt(0.12); } } }
      E.edgeArrow(t.arrow, p, d < 24 && S.alive); } }
  function tankBoom(q) { const at = q.clone().setY(0.6); fx.explode(at, 2.4); fx.shock(q, 5.5, 0xffb060, 0.5); fx.glow(q, 6, 0xffa040, 1, 0.5); fx.scorch(q, 2.4); fx.sparks(at, 26, { speed: 9, up: 8, life: 0.9 }); E.flash(0.18); E.jolt(0.6); sfx.boom();
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + Math.random(), o = V(q.x + Math.cos(a) * 1.3, 0.5, q.z + Math.sin(a) * 1.3); E.after(0.09 + k * 0.07, () => fx.explode(o, 1.1)); } E.after(0.16, () => sfx.boom()); } // its ammunition cooks off in a ring of smaller blasts
  function killTank(t, how, dmg = 0) { const i = tanks.indexOf(t); if (i < 0) return;
    if (t.boss) { const now = performance.now(); if (now < t.immune) return; t.immune = now + 260; const q0 = t.g.position, d = dmg || (E.gunPow ? E.gunPow() : 1); t.hp -= d; fx.sparks(q0.clone().setY(1.5), 16, { c: [0xffe08a, 0xff5a3a], speed: 7, up: 4, life: 0.5 }); fx.explode(q0.clone().setY(1.3), 0.8); E.popup(q0.clone().setY(2.6), '-' + d, '#ffb02a'); sfx.boom(); E.jolt(0.25);
      if (t.hp > 0) return; boss = null; const q1 = q0.clone(); for (let k = 0; k < 3; k++) E.after(0.25 + k * 0.3, () => tankBoom(V(q1.x + rnd(-1.2, 1.2), 0, q1.z + rnd(-1.2, 1.2)))); if (E.bossDown) E.bossDown(q1); } /* the boss: each hit takes some off; the last one sets off the whole machine */
    tanks.splice(i, 1); scene.remove(t.glow); t.glow.material.dispose(); t.arrow.remove(); const q = t.g.position.clone(); E.free(t.g); twisters.scatter([t.g], q.clone(), 7); tankBoom(q); E.award(250, q, 'TANK'); E.stat('tanks'); if (how !== 'quiet') E.blast(q, 2, { from: q }); } /* quiet: a skin's moon or twister, which must not knock the town down */

  // ---------- helicopters (every town) ----------
  // by town: n (how many come together), v (top speed), cd (seconds between rockets), dmg (a rocket's hit), rv (rocket speed),
  // life (seconds before they fly off), gap (seconds after they go before the next ones). Small Town's is slow and weak: the death ray is new there
  const heli = () => { const L = E.level, rk = ramp(); return L === 1 ? { n: Math.random() < 0.5 ? 1 : 2, v: 6.8, cd: 4.6, dmg: 3, rv: 10.5, life: 36, gap: [22, 30] } : L === 2 ? { n: 2, v: 8.5, cd: 4, dmg: 4, rv: 12, life: 40, gap: [22, 30] }
    : { n: L >= 6 ? 4 : L >= 5 ? 3 : Math.random() < 0.5 ? 2 : 3, v: 10.5, cd: 3.4 - 0.9 * rk, dmg: 4.5 + 2 * rk, rv: 13, life: 42, gap: [24 - 6 * rk, 34 - 6 * rk] }; }; /* (harder from the start: more of them, sooner, faster) */
  function spawnShips() { const b = E.town.lim, a0 = Math.random() * 6.28, R0 = Math.max(b.x, b.z) + 9, H = heli(), n = H.n;
    for (let k = 0; k < n; k++) { const g = makeGunship(), a = a0 + k * 0.3, y0 = 5.4 + k * 0.5; g.position.set(Math.cos(a) * R0, y0, Math.sin(a) * R0); scene.add(g); ships.push({ g, ph: a0 + Math.PI + k * (Math.PI * 2 / n), y0, head: Math.atan2(-Math.cos(a), -Math.sin(a)), life: H.life, cd: 3 + k * 1.3, vel: V(), v: H.v, cdB: H.cd, dmg: H.dmg, rv: H.rv, arrow: mkArrow('🚁', '#9fe8ff') }); }
    T.ship = rnd(H.gap[0], H.gap[1]); E.banner(n > 1 ? '🚁 HELICOPTERS INCOMING!' : '🚁 HELICOPTER INCOMING!'); sfx.whoosh(); }
  function zapShip(s) { const g = s.g, p = g.position.clone(), i = ships.indexOf(s); if (i < 0) return; ships.splice(i, 1); s.arrow.remove(); fx.explode(p.clone(), 0.7); E.popup(p, 'HIT!', '#ffd24a'); sfx.whoosh(); E.stat('aircraft');
    const sp = Math.hypot(s.vel.x, s.vel.z); fall(g, sp > 1 ? Math.atan2(s.vel.x, s.vel.z) : s.head, Math.max(4, sp), { blast: 1.6, plough: rnd(3.5, 6), r: 1.5, pts: 400, label: 'GUNSHIP DOWN', banner: '🚁 GUNSHIP DOWN!', size: 0.8, own: true }); } /* own: its shapes and paint are its own, let go of once it is gone */
  function updateShips(dt) { const S = E.ship, b = E.town.lim, far = Math.max(b.x, b.z) + 14;
    for (let i = ships.length - 1; i >= 0; i--) { const s = ships[i], g = s.g, p = g.position; s.life -= dt; s.cd -= dt; s.ph += dt * 0.45; if (E.radarDown) s.life = Math.min(s.life, 0);
      const orbit = 8.5, leave = s.life <= 0 || !S.alive; let tx, tz; if (leave) { const l = Math.hypot(p.x, p.z) || 1; tx = p.x / l * (far + 8); tz = p.z / l * (far + 8); } else { tx = S.pos.x + Math.cos(s.ph) * orbit; tz = S.pos.z + Math.sin(s.ph) * orbit; }
      const ex = tx - p.x, ez = tz - p.z, el = Math.hypot(ex, ez) || 0.01, want = Math.min(leave ? 10 : s.v, el * 1.6), e = Math.min(1, dt * 2.2); s.vel.x += (ex / el * want - s.vel.x) * e; s.vel.z += (ez / el * want - s.vel.z) * e; p.x += s.vel.x * dt; p.z += s.vel.z * dt;
      p.y += (Math.max(s.y0, S.pos.y - 0.9) + Math.sin(E.played * 2 + s.ph) * 0.25 - p.y) * Math.min(1, dt * 1.5); // it flies at about the ship's height
      const dx = S.pos.x - p.x, dz = S.pos.z - p.z, d = Math.hypot(dx, dz), sp = Math.hypot(s.vel.x, s.vel.z);
      s.head = turnTo(s.head, !leave && d < orbit + 6 ? Math.atan2(dx, dz) : Math.atan2(s.vel.x, s.vel.z), dt * 3); g.rotation.set(0, s.head, 0); g.rotateX(Math.min(0.3, sp * 0.03)); // nose on the ship while it circles
      for (const r of g.userData.props) r.rotation.y += dt * 30; g.userData.tail.rotation.x += dt * 40;
      if (!leave && s.cd <= 0 && d < orbit + 4) { s.cd = s.cdB * rnd(0.8, 1.2); const from = p.clone(); from.y -= 0.3; const tof = from.distanceTo(S.pos) / s.rv, to = S.pos.clone().addScaledVector(S.vel, tof * 0.55); if (E.blind > 0) to.add(V(rnd(-3, 3), 0, rnd(-3, 3))); shoot('rocket', from, to.sub(from).normalize().multiplyScalar(s.rv), { dmg: s.dmg, life: 3.4 }); fx.puff('smoke', from, 0.3); if (seen(from, from.y)) sfx.throw(); } // aimed a little ahead of the ship: keep moving, and turn
      E.edgeArrow(s.arrow, p, !leave);
      if (leave && Math.hypot(p.x, p.z) > far) { drop(g); s.arrow.remove(); ships.splice(i, 1); } } }

  // ---------- missile trucks (Metro on): parked near the big targets ----------
  function addLauncher(near) { const { w } = farRoad(14, near, 9); const g = makeLauncher(); g.position.set(w.x, 0, w.z); g.rotation.y = Math.random() * 6.28; scene.add(g);
    const line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); line.visible = false; line.frustumCulled = false; line.renderOrder = 7; scene.add(line);
    launchers.push({ g, line, hp: 2, mode: 'idle', t: 0, cd: rnd(4, 8), beep: 0, arrow: mkArrow('🚀', '#ff5a4a') }); }
  const rackPos = (l) => { l.g.updateMatrixWorld(true); return V(0, 0, 0.3).applyMatrix4(l.g.userData.rack.matrixWorld); };
  function updateLaunchers(dt) { const S = E.ship, rk = ramp();
    for (const l of launchers) { const g = l.g, p = g.position, ud = g.userData, dx = S.pos.x - p.x, dz = S.pos.z - p.z, d = Math.hypot(dx, dz); l.cd -= dt;
      ud.turret.rotation.y = turnTo(ud.turret.rotation.y, Math.atan2(dx, dz) - g.rotation.y, dt * 2.2); ud.rack.rotation.x = -Math.min(1.1, Math.atan2(S.pos.y, Math.max(1, d)));
      if (l.mode === 'idle') { ud.lamp.material.opacity = 0.2; if (l.cd <= 0 && d < 24 && S.alive) { l.mode = 'lock'; l.t = 1.6 + (E.blind > 0 ? 1.2 : 0); l.beep = 0; sfx.laser(); } }
      else { l.t -= dt; l.beep -= dt; const from = rackPos(l), len = from.distanceTo(S.pos); l.line.visible = true; l.line.position.copy(from); l.line.lookAt(S.pos); l.line.scale.set(0.07, 0.07, len); l.line.material.opacity = 0.35 + Math.sin(E.played * 30) * 0.25 + (l.t < 0.5 ? 0.3 : 0);
        ud.lamp.material.opacity = Math.sin(E.played * 28) > 0 ? 1 : 0.3; if (l.beep <= 0) { l.beep = l.t < 0.5 ? 0.1 : 0.22; sfx.ping(l.t < 0.5 ? 6 : 0); } E.status('🚀 MISSILE LOCK! KEEP MOVING!');
        if (l.t <= 0 || !S.alive) { l.mode = 'idle'; l.line.visible = false; l.cd = (7 - 2 * rk) * rnd(0.85, 1.2); if (S.alive) { const v = S.pos.clone().sub(from).normalize(); v.y = Math.max(v.y, 0.5); v.normalize().multiplyScalar(8); shoot('missile', from, v, { dmg: 10 + 3 * rk, life: 5.5, home: 3.2, vmax: 14.5 + 3 * rk }); fx.puff('smoke', from, 1); fx.puff('flame', from, 0.6); sfx.whoosh(); if (seen(p)) E.jolt(0.2); } } }
      E.edgeArrow(l.arrow, p, d < 30 && S.alive); } }
  function hitLauncher(l, quiet = false) { const over = l.mode === 'lock'; l.hp -= over ? 2 : 1; const p = l.g.position;
    if (l.hp <= 0) { const i = launchers.indexOf(l); if (i < 0) return; launchers.splice(i, 1); scene.remove(l.line); l.line.material.dispose(); l.arrow.remove(); const q = p.clone(); twisters.scatter([l.g], q.clone(), 6); tankBoom(q); E.award(over ? 900 : 600, q, over ? 'OVERLOAD!' : 'MISSILE TRUCK'); E.stat('launchers'); if (!quiet) E.blast(q, 2.2, { from: q }); return; }
    l.mode = 'idle'; l.line.visible = false; l.cd = 3.5; fx.sparks(V(p.x, 1, p.z), 14, { speed: 6, up: 5, life: 0.5 }); fx.ignite(V(p.x, 0.6, p.z), 0.6, 6); E.popup(p, 'DAMAGED! ZAP IT AGAIN', '#ffd24a'); E.award(150, p); }

  // ---------- jets (Suburbs on): strafing runs (JET above). A run: the warning lane first (t counts down), then its jets streak
  // along it, their guns firing down the lane as they come in; once they have all gone the lane fades ----------
  function startRun() { const S = E.ship, b = E.town.lim, lead = V(S.pos.x + S.vel.x * 1.6, 0, S.pos.z + S.vel.z * 1.6); lead.x = Math.max(-b.x, Math.min(b.x, lead.x)); lead.z = Math.max(-b.z, Math.min(b.z, lead.z)); // through where the saucer is heading
    const sp = Math.hypot(S.vel.x, S.vel.z), a = sp > 1.5 && Math.random() < 0.65 ? Math.atan2(S.vel.x, S.vel.z) + (Math.random() < 0.5 ? 1 : -1) * rnd(1, 1.7) : Math.random() * 6.2832; /* mostly across the way it is going: speed up, stop or turn to get out of it */
    const dir = V(Math.sin(a), 0, Math.cos(a)), lane = makeLane(), len = JET.half * 2 + 12; lane.position.set(lead.x, 0.15, lead.z); lane.rotation.y = a; lane.scale.set(JET.hw * 2, 1, len); lane.material.map.repeat.set(1, len / 3.2); scene.add(lane);
    runs.push({ a, dir, c: lead, lane, len, t: JET.warn, n: E.level >= ARMY_FIRST.jetPair ? 2 : 1, jets: [], out: 0, from: lead.clone().addScaledVector(dir, -JET.half), arrow: mkArrow('✈', '#ff5a4a') });
    E.status('✈ JET INCOMING!'); sfx.ping(2); E.after(0.16, () => sfx.ping(2)); }
  function launch(r) { const S = E.ship; r.arrow.style.display = 'none';
    for (let k = 0; k < r.n; k++) { const g = makeJet(), side = r.n > 1 ? (k ? 0.55 : -0.55) : 0, back = k * 8, p = r.from.clone().addScaledVector(r.dir, -back); p.x += r.dir.z * side; p.z -= r.dir.x * side; p.y = S.pos.y + 0.45; g.position.copy(p); g.rotation.y = r.a; scene.add(g);
      const j = { g, r, side, along: -JET.half - back, fireT: k * 0.03, sm: 0, missile: k === 0 && E.level >= ARMY_FIRST.jetMissile, arrow: mkArrow('✈', '#ff5a4a') }; jets.push(j); r.jets.push(j); } /* (one missile a run: the leader's) */
    sfx.whoosh(); E.after(0.25, () => sfx.whoosh()); }
  function dropRun(r) { const i = runs.indexOf(r); if (i >= 0) runs.splice(i, 1); const mt = r.lane.material; scene.remove(r.lane); mt.map.dispose(); mt.dispose(); r.lane.geometry.dispose(); r.arrow.remove(); } /* a run is over: its lane and arrow go */
  function dropJet(j) { const i = jets.indexOf(j); if (i >= 0) jets.splice(i, 1); const k = j.r.jets.indexOf(j); if (k >= 0) j.r.jets.splice(k, 1); j.arrow.remove(); }
  function zapJet(j) { if (!jets.includes(j)) return; dropJet(j); const g = j.g, p = g.position.clone(); fx.explode(p.clone(), 0.8); E.popup(p, 'HIT!', '#ffd24a'); sfx.whoosh(); E.stat('aircraft'); E.stat('jets');
    fall(g, j.r.a, 11, { blast: 1.9, plough: rnd(6, 9), r: 1.6, pts: 600, label: 'JET DOWN', banner: '✈ JET DOWN!', size: 0.9 }); } // it comes down in town, and what it lands on is wrecked
  function updateJets(dt) { const S = E.ship, rk = ramp();
    for (let i = runs.length - 1; i >= 0; i--) { const r = runs[i], mt = r.lane.material; mt.map.offset.y += dt * 3; // the dashes run the way the jet will fly
      if (r.t > 0) { if (!S.alive) { dropRun(r); continue; } /* the round is over: a run that is only warning never comes */ r.t -= dt; mt.opacity = 0.6 + 0.35 * Math.sin(E.played * 18); E.status('✈ JET INCOMING!'); E.edgeArrow(r.arrow, r.from.clone().setY(S.pos.y), true); if (r.t <= 0) launch(r); continue; }
      if (r.jets.length) { mt.opacity = 0.8; continue; }
      r.out += dt; mt.opacity = Math.max(0, 0.8 * (1 - r.out * 2.5)); if (r.out > 0.4) dropRun(r); }
    for (let i = jets.length - 1; i >= 0; i--) { const j = jets[i], g = j.g, r = j.r, st = JET.speed * dt; g.position.addScaledVector(r.dir, st); j.along += st; g.position.y += (S.pos.y + 0.45 - g.position.y) * Math.min(1, dt * 2);
      g.rotation.set(0, r.a, Math.sin(E.played * 4 + j.side * 3) * 0.06); g.userData.burner.scale.z = 0.75 + Math.random() * 0.6;
      j.sm -= dt; if (j.sm <= 0) { j.sm = 0.035; fx.puff('smoke', g.position.clone().addScaledVector(r.dir, -2), 0.28); } // a smoke trail behind it
      if (S.alive && j.along > JET.from && j.along < JET.to) { j.fireT -= dt; if (j.fireT <= 0) { j.fireT = JET.every; const f = g.position.clone().addScaledVector(r.dir, 1.9), o = rnd(-0.3, 0.3); f.y -= 0.32; f.x += r.dir.z * o; f.z -= r.dir.x * o;
          shoot('bullet', f, r.dir.clone().multiplyScalar(JET.speed + 16), { dmg: 0.95 + 0.5 * rk, life: 0.85, r: JET.hitR, src: 'jet' }); if (Math.random() < 0.3 && seen(f, f.y)) sfx.throw(); } } // its guns: tracers straight down the lane
      if (j.missile && S.alive && j.along > -15) { j.missile = false; const f = g.position.clone(); f.y -= 0.4; const v = S.pos.clone().sub(f).normalize().multiplyScalar(9); shoot('missile', f, v, { dmg: 8 + 3 * rk, life: 5, home: 2.2, vmax: 14 + 3 * rk, src: 'jetMissile' }); fx.puff('smoke', f, 0.8); sfx.whoosh(); } // from Metro on: a missile that chases you
      E.edgeArrow(j.arrow, g.position, true);
      if (j.along > JET.half + 14) { scene.remove(g); dropJet(j); } } }

  // ---------- shot down: it spins down on fire the way it was going, blows up where it lands, and what is left ploughs on,
  // wrecking a strip of town (the same end Tornado Time!'s aircraft meet; see foes.js) ----------
  function fall(g, heading, speed, o) { falling.push({ g, heading, speed, vy: 0.4, t: 0, roll: (Math.random() < 0.5 ? -1 : 1) * rnd(5, 8), sm: 0, o, down: false }); }
  function updateFalling(dt) { const b = E.town.lim;
    for (let i = falling.length - 1; i >= 0; i--) { const C = falling[i], g = C.g, o = C.o; C.t += dt;
      if (!C.down) { C.vy += 11 * dt; const sp = C.speed * (1.1 + C.t * 0.5); C.heading += C.roll * 0.04 * dt; g.position.x += Math.sin(C.heading) * sp * dt; g.position.z += Math.cos(C.heading) * sp * dt; g.position.y -= C.vy * dt;
        g.rotation.set(0, C.heading, 0); g.rotateX(Math.min(0.9, C.t * 0.7)); g.rotateZ(C.t * C.roll); for (const r of g.userData.props || []) r.rotation.y += dt * 12;
        C.sm -= dt; if (C.sm <= 0) { C.sm = 0.035; fx.puff('flame', g.position, 0.9 * o.size); fx.puff('smoke', g.position, 0.9 * o.size); if (Math.random() < 0.4) fx.sparks(g.position, 2, { speed: 2, up: 0, life: 0.5 }); }
        if (g.position.y > 0.5) continue;
        const at = g.position.clone().setY(0), dir = V(Math.sin(C.heading), 0, Math.cos(C.heading)); C.down = true; C.pos = at; C.dir = dir; C.left = o.plough; C.v = Math.max(8, C.speed * 2); C.acc = 1;
        fx.explode(at.clone().setY(0.6), o.blast); fx.scorch(at, o.blast, 26); E.jolt(0.8); E.flash(0.25); sfx.boom(); E.after(0.18, () => sfx.boom()); if (o.banner) E.banner(o.banner); if (o.pts) E.award(o.pts, at, o.label); if (o.done) o.done(at); /* (done: a mini boss that came down this way is beaten the moment it lands) */
        for (const m of g.userData.strip || []) g.remove(m); g.rotation.set(0, C.heading, 0); g.updateMatrixWorld(true);
        twisters.tear(g, at, new THREE.Box3().setFromObject(g).getSize(V()), null, [], [], { collapse: true, now: true, power: 1.2, push: dir.clone().multiplyScalar(7).setY(3) }); continue; }
      const step = C.v * dt; C.pos.addScaledVector(C.dir, step); C.left -= step; C.acc += step; C.v = Math.max(4, C.v - 9 * dt);
      const p = C.pos, out = Math.abs(p.x) > b.x || Math.abs(p.z) > b.z; fx.puff('flame', { x: p.x, y: 0.3, z: p.z }, 1.3); if (Math.random() < 0.5) fx.dust(p, 1.1); E.jolt(0.15);
      if (C.acc >= 0.9 && !out) { C.acc = 0; fx.ignite(V(p.x + rnd(-0.4, 0.4), 0.1, p.z + rnd(-0.4, 0.4)), rnd(0.7, 1.2), rnd(7, 13)); fx.scorch(p, rnd(1.1, 1.6), 28); if (Math.random() < 0.45) fx.explode(V(p.x, 0.4, p.z), 0.7); E.blast(p.clone(), o.r, { from: p.clone().addScaledVector(C.dir, -2), quiet: true }); }
      if (C.left <= 0 || out) { if (!out) fx.explode(V(p.x, 0.5, p.z), 1.5); falling.splice(i, 1); wrecks.push(C); } }
    // its own shell leaves the scene once it has been broken up into pieces of itself (twisters.tear hides it then)
    for (let i = wrecks.length - 1; i >= 0; i--) { const C = wrecks[i]; if (C.g.visible) continue; wrecks.splice(i, 1); unWreck(C); } }
  const unWreck = (C) => { if (!C.o.own) { scene.remove(C.g); return; } drop(C.g); for (const m of C.g.userData.strip || []) if (!m.parent) { m.geometry.dispose(); m.material.dispose(); } }; /* a jet shares its shapes and paint with the others: it only leaves the scene. A helicopter lets go of its own (and of the rotor blur it lost as it crashed) */

  // ---------- who turns up, and when ----------
  function spawnTown() { const L = E.level, ez = easy(); for (let i = 0; i < 3 + 2 * (L - 1); i++) addSquad(11 + 6 * ez); for (let i = 0; i < maxTanks(); i++) addTank(16 + 6 * ez, 5 * ez); /* the first towns: the army starts further off, and its tanks take a moment */
    if (L >= ARMY_FIRST.launcher) { const P = E.poiCenters(); for (let i = 0; i < Math.min(P.length, L - 3); i++) addLauncher(P[i]); }
    T.ship = [25, 22, 18, 18, 16, 15][L - 1] || 15; T.jet = L === 1 ? 34 : L === 2 ? 28 : 22; T.reinf = 14; T.tank = 22; T.column = L === 1 ? 45 : 32; } /* the first helicopter: about a minute into Small Town, sooner later on */
  function schedule(dt) { const L = E.level, rk = ramp();
    if (!E.radioDown) { T.reinf -= dt; if (T.reinf <= 0) { T.reinf = 17 - 6 * rk; if (soldiers.length < 12 + 6 * L) { addSquad(20); if (Math.random() < 0.5) E.popup(E.ship.pos, 'REINFORCEMENTS!', '#ff9a7a'); } }
      T.tank -= dt; if (T.tank <= 0) { T.tank = 30 - 10 * rk; if (tanks.length < maxTanks()) addTank(22); }
      T.column -= dt; if (T.column <= 0) { T.column = 70 - 6 * L; if (tanks.length < maxTanks() + 12) tankColumn(); } }
    if (L >= ARMY_FIRST.ship && !E.radarDown && !ships.length) { T.ship -= dt; if (T.ship <= 0) spawnShips(); } /* (spawnShips sets the gap to the next ones) */
    if (L >= ARMY_FIRST.jet && !E.radarDown && E.blind <= 0 && !runs.length) { T.jet -= dt; if (T.jet <= 0) { T.jet = L === 1 ? rnd(24, 32) : L === 2 ? rnd(20, 28) : L === 3 ? rnd(16, 24) : rnd(13, 20) - 3 * rk; startRun(); } } } /* in a blackout the jets can't find you */
  function update(dt) { if (E.ship.alive) schedule(dt * (E.foeK ? E.foeK() : 1)); /* (foeK: a harder round sends the army in faster) */ /* nothing new turns up once the round is over */ updateSoldiers(dt); updateTanks(dt); updateShips(dt); updateJets(dt); updateLaunchers(dt); updateFalling(dt); updateShots(dt); minis.update(dt); }

  // ---------- the death ray's targets: what is under the player's finger. sd(pos) = how far the tap is from pos on screen,
  // in pixels. The closest within its reach wins; returns { kind, pos, hit(), ok(), stay } or null. ok(): it is still there
  // (a shot that has to wait is dropped once it is gone). stay: zapped where it is, the saucer keeps its course (aircraft,
  // missiles, shells, the trucks). extra: more to choose from, as { kind, pos, px, hit, ok, stay } (main.js's horn trucks) ----------
  function pick(sd, extra = []) { let best = null, bs = 1;
    const consider = (kind, pos, px, hit, ok, stay = false) => { const k = sd(pos) / px; if (k < bs) { bs = k; best = { kind, pos, hit, ok, stay }; } };
    for (const j of jets) consider('jet', j.g.position, 84, () => zapJet(j), () => jets.includes(j), true); /* fast: a generous reach */
    for (const e of extra) consider(e.kind, e.pos, e.px, e.hit, e.ok, e.stay); minis.targets(consider);
    for (const s of ships) consider('gunship', s.g.position, 64, () => zapShip(s), () => ships.includes(s), true);
    for (const sh of shots) if (sh.kind === 'missile' || sh.kind === 'shell') consider(sh.kind, sh.p, sh.px || 44, () => { const i = shots.indexOf(sh); if (i < 0) return; shots.splice(i, 1); fx.explode(sh.p.clone(), 0.7); E.award(sh.kind === 'missile' ? 200 : 100, sh.p, sh.kind === 'missile' ? 'MISSILE DOWN' : 'SHELL DOWN'); if (sh.onZap) sh.onZap(sh); }, () => shots.includes(sh), true);
    for (const l of launchers) consider('launcher', l.g.position.clone().setY(0.8), 52, () => hitLauncher(l), () => launchers.includes(l), true);
    for (const t of tanks) consider('tank', t.g.position.clone().setY(t.boss ? 1.4 : 0.5), t.boss ? 92 : 48, () => killTank(t), () => tanks.includes(t));
    for (const s of soldiers) consider('soldier', s.position.clone().setY(0.35), 28, () => killSoldier(s, s.position.clone()), () => soldiers.includes(s));
    return best; }
  // for SPACE-free aiming on a computer (F): the nearest thing shooting at the ship
  function nearest(c, range, ground = false) { let best = null, bd = range; /* ground: tanks, trucks and soldiers only */ const consider = (kind, pos, hit) => { const d = Math.hypot(pos.x - c.x, pos.z - c.z); if (d < bd) { bd = d; best = { kind, pos, hit }; } };
    if (!ground) { for (const j of jets) consider('jet', j.g.position, () => zapJet(j)); for (const s of ships) consider('gunship', s.g.position, () => zapShip(s)); } for (const l of launchers) consider('launcher', l.g.position.clone().setY(0.8), () => hitLauncher(l)); for (const t of tanks) consider('tank', t.g.position.clone().setY(0.5), () => killTank(t));
    if (!best) for (const s of soldiers) consider('soldier', s.position.clone().setY(0.35), () => killSoldier(s, s.position.clone())); return best; }
  function killSoldier(s, from) { const i = soldiers.indexOf(s); if (i < 0) return; soldiers.splice(i, 1); delete s.updateMatrixWorld; twisters.scatter([s], from, 5); fx.puff('flame', s.position.clone().setY(0.3), 0.4); E.award(40, s.position, 'SOLDIER'); E.stat('soldiersDown'); }
  // a blast on the ground (a building coming down, a crash, the nuclear plant): the army caught in it is done for
  function hitArea(c, r, o = {}) { let n = 0; // o.quiet: the tanks and trucks it kills go up without blasting the town round them
    for (let i = soldiers.length - 1; i >= 0; i--) { const s = soldiers[i]; if (Math.hypot(s.position.x - c.x, s.position.z - c.z) < r) { killSoldier(s, c); n++; } }
    for (const t of tanks.slice()) if (Math.hypot(t.g.position.x - c.x, t.g.position.z - c.z) < r + 0.6) { killTank(t, o.quiet ? 'quiet' : undefined, r >= 5 ? 4 : r >= 3 ? 2 : 1); n++; } /* (the boss: a bigger blast takes more off it) */
    for (const l of launchers.slice()) if (Math.hypot(l.g.position.x - c.x, l.g.position.z - c.z) < r + 0.6) { l.hp = 1; hitLauncher(l, !!o.quiet); n++; }
    return n + minis.area(c, r); }
  function eachDot(fn) { for (const t of tanks) fn(t.g.position, 'tank'); for (const l of launchers) fn(l.g.position, 'launcher'); for (const s of ships) fn(s.g.position, 'gunship'); for (const j of jets) fn(j.g.position, 'jet'); minis.eachDot(fn); }
  // first-time prompts: each new enemy is explained the first time it is on screen. The round holds still while the card is up
  // (a tap anywhere carries on, and never reaches the game)
  function coachTick() { const { coach, coachSeen, toScreen } = E, inView = E.inView || seen; /* inView: on screen and clear of the HUD, so the card's arrow points at something the player can see */
    if (runs.length && !coachSeen('bu_jet')) { const r = runs.find((o) => o.t > 0); if (r) return coach('bu_jet', { mode: 'ok', title: '✈ JET!', text: 'A red lane means a jet is about to fly down it, guns blazing. Get your saucer\'s shadow out of the lane! Tap the jet as it streaks past to shoot it down.', at: () => (runs.includes(r) ? toScreen(r.c) : null) }); }
    if (ships.length && !coachSeen('bu_gunship')) { const s = ships.find((o) => o.life > 0 && inView(o.g.position, o.g.position.y)); if (s) return coach('bu_gunship', { mode: 'ok', title: '🚁 HELICOPTER', text: 'It circles you and fires rockets. Keep moving so they miss, and tap the helicopter to zap it out of the sky. It crashes into town!', at: () => (ships.includes(s) ? toScreen(s.g.position, s.g.position.y) : null) }); }
    if (launchers.length && !coachSeen('bu_launcher')) { const l = launchers.find((o) => o.mode === 'lock' && inView(o.g.position, 0.8)); if (l) return coach('bu_launcher', { mode: 'ok', title: '🚀 MISSILE TRUCK', text: 'The red line means it has locked on. When the missile comes, keep moving to shake it off. Zap the truck twice, or once while it is locking on.', at: () => (launchers.includes(l) ? toScreen(l.g.position, 0.8) : null) }); }
    return false; }
  // the old round's army goes, and lets go of its GPU buffers (the shared gun, glow and shot shapes stay)
  const drop = (o) => { scene.remove(o); o.traverse((m) => { if (m.geometry && m.geometry !== gunGeo && m.geometry !== glowGeo) m.geometry.dispose(); if (m.material && !Array.isArray(m.material) && m.material !== gunMat) m.material.dispose(); }); };
  function clear() { minis.clear();
    for (const s of soldiers) drop(s); soldiers = []; for (const t of tanks) { drop(t.g); scene.remove(t.glow); t.glow.material.dispose(); t.arrow.remove(); } tanks = []; boss = null;
    for (const s of ships) { drop(s.g); s.arrow.remove(); } ships = []; for (const l of launchers) { drop(l.g); scene.remove(l.line); l.line.material.dispose(); l.arrow.remove(); } launchers = [];
    for (const j of jets) { scene.remove(j.g); j.arrow.remove(); } jets = []; for (const r of runs.slice()) dropRun(r); runs = []; /* (jets share one model's shapes and paint: nothing to let go of) */
    for (const f of [...falling, ...wrecks]) unWreck(f); falling.length = wrecks.length = 0; shots.length = 0; for (const k in KIND) KIND[k].mesh.count = 0; }
  // the mini bosses (minis.js): they use the army's own shots, routes, arrows and crashes
  const minis = createMinis({ E, scene, fx, shoot, shots, farRoad, mkArrow, tankBoom, roadPathTo, followPath, addSoldier, addTank, startRun, fall, drop });
  return { minis, spawnTown, update, pick, nearest, hitArea, eachDot, coachTick, clear, killSoldier, killTank, addBoss, dropBoss, get boss() { return boss; },
    get soldiers() { return soldiers; }, get tanks() { return tanks; }, get ships() { return ships; }, get launchers() { return launchers; }, get shots() { return shots; }, get falling() { return falling; }, get jets() { return jets; }, get runs() { return runs; },
    // for tests
    spawn(k) { if (k === 'ship') spawnShips(); else if (k === 'tank') addTank(10); else if (k === 'squad') addSquad(6); else if (k === 'launcher') addLauncher(E.ship.pos); else if (k === 'jet') startRun(); }, zapShip, zapJet, hitLauncher, T, JET };
}
