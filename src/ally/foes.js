// Tornado Alley's bigger enemies: things for the storm to fight. Each first turns up one town later than the last, and
// (until The Sprawl) only one of the roaming three is about at a time, so each fight can be read on a phone.
//   ROGUE TWISTER (Suburbs on): a second storm that eats the town before you can. Smaller than you: it runs, and you
//     swallow it whole for everything it stole. Bigger: it hunts you and strips your size. Lightning cuts it down.
//   STORM CANNON (Downtown on): a horn truck parked by a big target. It charges (you see the line), then fires a
//     shockwave that blasts the storm back and shrinks it. Two strikes, one while it charges, or run it over.
//   GUNSHIPS (Metro on): a pair of helicopters circling the storm, firing freeze rockets that slow it. One strike each.
//   UFO (Megacity on): a shielded saucer with a shrink ray. The shield drops while it beams people up: three strikes.
// Whatever is struck out of the sky crashes like the seeding planes do: a blast, then a burning furrow through town.
// main.js hands in what this needs (E) and calls update / tap / targets / eachDot / coachTick / clear.
import * as THREE from 'three';
import { toWorld } from '../city.js';
import { sfx } from '../audio.js';
import { makeHornTruck, makeGunship, makeSaucer } from './foeModels.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), rnd = (a, b) => a + Math.random() * (b - a), UP = V(0, 1, 0);
const turnTo = (cur, want, max) => { let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); return cur + Math.max(-max, Math.min(max, d)); };
export const FOE_FIRST = { rival: 2, cannon: 3, ship: 4, ufo: 5 }; // the town each one first turns up in
// the rogue twister's look: near-black violet with a hot pink glow, unlike any storm the player can wear
const ROGUE = { layers: [0x16061e, 0x5a1a8a, 0xff3ad0], op: [0.9, 0.55, 0.3], cloud: 0x140818, dust: 0x3a1a4a, junk: [0x1a1020, 0x8a2ab0, 0xff3ad0, 0x2a2a30], bolts: [0xff3ad0, 0xff8af0], boltGlow: 0xff2ac0, lights: [0xff3ad0, 0xb03aff, 0xffffff], glow: true };
// THE MAELSTROM (the boss): blood red and black with gold lightning, and bigger than any storm is allowed to be
const MAEL = { layers: [0x1a0404, 0x8a1208, 0xffb02a], op: [0.92, 0.6, 0.35], cloud: 0x180606, dust: 0x4a1a0a, junk: [0x201010, 0xb0300a, 0xffb02a, 0x2a2a30], bolts: [0xffd24a, 0xfff0b0], boltGlow: 0xff9a1a, lights: [0xffb02a, 0xff3a1a, 0xffffff], glow: true };
const lineGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), waveGeo = new THREE.TorusGeometry(1, 0.07, 6, 28);
const rocketGeo = new THREE.BoxGeometry(0.12, 0.12, 0.55), rocketMat = new THREE.MeshBasicMaterial({ color: 0xbff2ff });
const rayGeo = new THREE.CylinderGeometry(1, 0.3, 1, 18, 1, true).translate(0, 0.5, 0), markGeo = new THREE.RingGeometry(0.82, 1, 36).rotateX(-Math.PI / 2);
const RANGE = 26, WAVE_V = 24, CHARGE = 1.5;

export function createFoes(E) {
  const { scene, fx, twisters } = E, statusEl = document.getElementById('taFoe');
  let rival = null, cannons = [], ships = [], ufo = null; const falling = [], rockets = [], waves = [], lifted = [];
  const T = { rival: 0, cannon: 0, ship: 0, ufo: 0 }; // seconds until the next of each may turn up
  let slowT = 0, statusT = 0, frostT = 0, lx = 0, lz = 0; const kick = V(), sv = V();
  const lim = () => toWorld(E.cols - 1, E.cols - 1, E.cols, E.cols), on = (k) => E.level >= FOE_FIRST[k] && !(E.skip && E.skip.includes(k)); // E.skip: enemies a game leaves out (Kaiju Madness has its own rival)
  const mkArrow = (txt, col) => { const a = document.createElement('div'); a.className = 'planeArrow foeArrow'; a.textContent = txt; a.style.color = col; document.body.appendChild(a); return a; };
  const mkTag = () => { const t = document.createElement('div'); t.className = 'foeTag'; document.body.appendChild(t); return t; };
  function tagAt(el, pos, y, text, cls) { const s = E.toScreen(pos, y); if (!s.on) { el.style.display = 'none'; return; } el.style.display = 'block'; el.style.transform = 'translate(' + Math.max(74, Math.min(innerWidth - 74, s.x)) + 'px,' + s.y + 'px) translate(-50%,-100%)'; if (el._t !== text) { el._t = text; el.textContent = text; } if (el._c !== cls) { el._c = cls; el.className = 'foeTag ' + cls; } }
  function status(text) { statusT = 0.4; if (statusEl && statusEl._t !== text) { statusEl._t = text; statusEl.textContent = text; } }
  const seen = (pos, y = 0) => E.toScreen(pos, y).on;
  const pink = { c: [0xffffff, 0xff5ae0], speed: 7, up: 4, life: 0.55 };

  // ---------- rogue twister ----------
  const sizeOf = (r) => Math.max(0.6, Math.min(r.boss ? E.MAX_S * 1.4 : E.MAX_S, r.s0 + Math.min(1, r.mass * 0.014) + r.fed - r.cut)); // it grows on what it eats (and on you), and shrinks when struck
  function spawnRival(boss = false) {
    const P = E.twObj.position, b = lim(); let at = null;
    for (let k = 0; k < 40 && !at; k++) { const a = Math.random() * 6.28, d = rnd(15, 22), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d; if (Math.abs(x) < b.x - 1 && Math.abs(z) < b.z - 1) at = V(x, 0, z); }
    if (!at) at = V(-Math.sign(P.x || 1) * b.x * 0.6, 0, -Math.sign(P.z || 1) * b.z * 0.6);
    const g = twisters.make(true, [], null, { skin: boss ? MAEL : ROGUE }); g.position.copy(at); g.scale.setScalar(0.001); scene.add(g);
    const s0 = boss ? E.MAX_S * 1.3 : Math.max(0.85, Math.min(E.MAX_S, E.size * (E.level >= 4 ? rnd(0.9, 1.2) : rnd(0.8, 1.05)))); // about your size: sometimes lunch, sometimes trouble (the boss: far bigger than you can be)
    rival = { g, tw: g.userData.twister, s0, s: s0, cut: 0, fed: 0, shown: 0.05, mass: 0, life: boss ? 1e9 : 50, boss, r0: s0 / E.size, eatT: 1.5, stun: 0, immune: 0, biteT: 0, clashT: 0, pickT: 0, goal: null, out: null, eaten: false, kv: V(), wa: Math.random() * 6.28, arrow: mkArrow(boss ? '👑' : '🌪️', '#ff5ae0'), tag: mkTag() };
    E.banner(boss ? '⚠️ BOSS: THE MAELSTROM!\nSTRIKE IT, THEN SWALLOW IT' : '🌪️ ROGUE TWISTER!'); sfx.whoosh(); sfx.hurt();
  }
  function removeRival() { const r = rival; if (!r) return; twisters.remove(r.g, true); r.arrow.remove(); r.tag.remove(); rival = null; }
  function endRival(eaten) { const r = rival; r.out = 0; r.eaten = eaten; r.arrow.style.display = 'none'; r.tag.style.display = 'none'; T.rival = rnd(28, 40); }
  function swallow() { const r = rival, p = r.g.position.clone(); endRival(true); E.speedBurst(3); if (r.boss && E.bossDown) E.bossDown(p); // you take back everything it stole, and more
    E.award(1500, p, 'TWISTER SWALLOWED'); E.grow(3 + r.mass * 0.8); E.banner('🌪️ ROGUE TWISTER SWALLOWED!'); sfx.boom(); sfx.power(); E.jolt(0.8); E.flash(0.25); fx.shock(p, 7, 0xff5ae0, 0.5);
    for (let i = 0; i < 3; i++) fx.sparks(V(p.x, 1 + i * 1.5, p.z), 14, { ...pink, speed: 8, up: 5, life: 0.7 }); }
  function zapRival() { const r = rival, p = r.g.position, at = V(p.x, 2.3 * r.shown, p.z); E.boltTo(at); if (r.immune > 0) { E.popup(p, 'NO EFFECT YET', '#d8b0e8'); return; }
    r.immune = r.boss ? 1.5 : 2.4; r.stun = 1.4; r.cut += r.boss ? 0.15 : 0.22; fx.sparks(at, 16, pink); E.popup(p, 'SHRUNK!', '#ffd24a'); E.award(100, p); E.jolt(0.3); }
  // whatever shrinks your storm shrinks the rogue twister too (a seeding plane's spray, a cannon's blast, a gunship's rocket, the
  // UFO's ray): step aside and let them hit it. rivalAt: the rogue, if (x, z) is within its funnel plus `pad`
  function rivalAt(x, z, pad = 0, k = 1) { const r = rival; if (!r || r.out != null) return null; const p = r.g.position; return Math.hypot(p.x - x, p.z - z) < 1.6 * r.shown * k + pad ? r : null; }
  function hurtRival(r, amt, text, col = '#ffd24a') { r.cut += amt; r.sayT = (r.sayT || 0); if (text && E.played - r.sayT > 0.45) { r.sayT = E.played; E.popup(r.g.position, text, col); } }
  function updateRival(dt, px, pz, R) {
    const r = rival, g = r.g, p = g.position, P = E.twObj.position;
    if (r.out != null) { r.out += dt; const k = Math.min(1, r.out / 0.6); g.scale.setScalar(Math.max(0.001, E.S0 * r.shown * (1 - k))); if (r.eaten) p.lerp(P, Math.min(1, dt * 6)); else p.y = k * 2; if (k >= 1) removeRival(); return; } // drawn into your storm, or winding itself out
    r.life -= dt; r.stun -= dt; r.immune -= dt; r.eatT -= dt; r.clashT -= dt; r.biteT -= dt; r.holdT = Math.max(r.holdT < -9 ? -99 : 0, (r.holdT || 0) - dt * 0.4); /* its grip: counts up while it has you (above), eases off when you break free */
    r.s = sizeOf(r); r.shown += (r.s - r.shown) * Math.min(1, dt * 1.6); g.scale.setScalar(E.S0 * r.shown); const rr = 1.6 * r.shown, b = lim();
    if (r.life <= 0) { if (seen(p, 2)) E.banner('🌪️ THE ROGUE TWISTER BLEW OUT'); endRival(false); return; }
    const dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz) || 0.01, ratio = r.shown / E.size, big = ratio > 1.1, small = ratio < 0.92, mySp = 3.2 + E.size * 0.7;
    // where to: bigger than you and close, it hunts you; smaller and close, it runs; otherwise it feeds on the town
    let tx = 0, tz = 0, sp = 2.3 + r.shown * 0.45;
    if (r.stun > 0) sp = 0;
    else if (big && d < 15 + rr) { tx = dx / d; tz = dz / d; sp = mySp * 0.8; }
    else if (small && d < 10 + R + rr) { tx = -dx / d; tz = -dz / d; sp = mySp * 0.72; const e = Math.max(Math.abs(p.x) / b.x, Math.abs(p.z) / b.z); if (e > 0.8) { const l = Math.hypot(p.x, p.z) || 1, w = (e - 0.8) * 5; tx -= p.x / l * w; tz -= p.z / l * w; const n = Math.hypot(tx, tz) || 1; tx /= n; tz /= n; } } // at the edge of town it has to double back
    else { r.pickT -= dt; if (!r.goal || r.goal.done || r.pickT <= 0) { r.pickT = 1.5; const mh = E.maxH(r.shown); let best = null, bd = 1e9; for (const x of E.buildings) { if (x.done || x.h > mh) continue; let q = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (small && Math.hypot(x.pos.x - px, x.pos.z - pz) < 12) q += 30; if (q < bd) { bd = q; best = x; } } r.goal = best; }
      if (r.goal) { const gx = r.goal.pos.x - p.x, gz = r.goal.pos.z - p.z, gl = Math.hypot(gx, gz) || 0.01; tx = gx / gl; tz = gz / gl; } }
    r.wa += dt * 1.3; p.x += (tx * sp + Math.sin(r.wa) * 0.5 + r.kv.x) * dt; p.z += (tz * sp + Math.cos(r.wa * 0.8) * 0.5 + r.kv.z) * dt; r.kv.multiplyScalar(Math.max(0, 1 - dt * 3));
    p.x = Math.max(-b.x, Math.min(b.x, p.x)); p.z = Math.max(-b.z, Math.min(b.z, p.z));
    // it eats: a building every second or so (lost to you: no points, no growth), and anyone in its way
    if (r.eatT <= 0) { const mh = E.maxH(r.shown), q = rr + 1.1; for (const x of E.buildings) { if (x.done || x.h > mh || Math.abs(x.pos.x - p.x) > q || Math.hypot(x.pos.x - p.x, x.pos.z - p.z) > q) continue; E.rivalWreck(x, r.tw); r.mass += x.h; r.eatT = 1.2; if (seen(x.pos)) E.popup(x.pos, 'STOLEN!', '#ff5ae0'); break; } }
    { const ppl = E.people, q = rr + 0.3; for (let i = ppl.length - 1; i >= 0; i--) { const c = ppl[i]; if (Math.abs(c.position.x - p.x) > q || Math.hypot(c.position.x - p.x, c.position.z - p.z) > q) continue; ppl.splice(i, 1); delete c.updateMatrixWorld; twisters.suck(c, r.tw); } }
    // the two storms meet
    if (d < (R + rr) * 0.8) { const mid = V((p.x + px) / 2, 1.5, (p.z + pz) / 2);
      if (small) { swallow(); return; }
      if (r.stun > 0) { /* stunned: it can't hurt you */ }
      else if (big) { E.grow(-E.massTarget * 0.03 * dt); kick.set(dx / d * 6, 0, dz / d * 6); r.holdT = (r.holdT || 0) + dt; status('🌪️ IT IS ABSORBING YOU! GET AWAY ' + Math.max(1, Math.ceil(3 - r.holdT)));
        if (r.holdT >= 3) { r.holdT = -99; fx.shock(mid, 8, 0xff5ae0, 0.6); for (let i = 0; i < 3; i++) fx.sparks(V(px, 1 + i * 1.5, pz), 14, { ...pink, speed: 8, up: 5, life: 0.7 }); E.jolt(0.9); E.flash(0.3); sfx.boom(); E.absorbed(p); return; } // three seconds in its grip: it swallows your storm and the round is lost // it strips your size and throws you off
        if (r.biteT <= 0) { r.biteT = 0.45; E.grow(-E.massTarget * 0.012); r.fed = Math.min(0.5, r.fed + 0.04); E.popup(P, '-SIZE', '#ff5ae0'); fx.sparks(mid, 8, pink); E.jolt(0.35); sfx.hurt(); } }
      else if (r.clashT <= 0) { r.clashT = 0.9; kick.set(dx / d * 9, 0, dz / d * 9); r.kv.set(-dx / d * 9, 0, -dz / d * 9); E.grow(-E.massTarget * 0.008); r.cut += 0.05; fx.sparks(mid, 14, pink); fx.shock(mid, 4, 0xffd24a); E.popup(mid, 'CLASH!', '#ffd24a'); E.jolt(0.5); sfx.boom(); status('🌪️ EVEN MATCH! STRIKE IT'); } } // an even match: both are thrown back
    const col = small ? '#7dff3a' : big ? '#ff5a4a' : '#ffd24a'; if (r.arrow._c !== col) { r.arrow._c = col; r.arrow.style.color = col; }
    tagAt(r.tag, p, 4.62 * r.shown + 0.5, (r.boss ? '👑 ' : '') + 'F' + Math.max(0, E.rankOf(r.shown)) + (small ? ' ▼ EAT IT' : big ? ' ▲ TOO BIG' : ' ⚡ STRIKE IT'), r.stun > 0 ? 'hit' : small ? 'eat' : big ? 'run' : 'even'); E.edgeArrow(r.arrow, p, true);
  }

  // ---------- storm cannon ----------
  function spawnCannon() {
    const P = E.twObj.position, cells = E.roadCells; if (!cells.length) return;
    // it parks on a street beside a big target that is still standing, well away from the storm
    const live = E.poiOrder.filter((k) => !E.pois[k].done), c0 = live.length ? E.pois[live[(Math.random() * live.length) | 0]].center : null; let best = null, bs = 1e9;
    for (let k = 0; k < 90; k++) { const c = cells[(Math.random() * cells.length) | 0], w = toWorld(c[0], c[1], E.cols, E.cols), ds = Math.hypot(w.x - P.x, w.z - P.z); if (ds < 12 || ds > 36) continue; if (cannons.some((o) => Math.hypot(o.g.position.x - w.x, o.g.position.z - w.z) < 10)) continue; const sc = c0 ? Math.hypot(w.x - c0.x, w.z - c0.z) : Math.abs(ds - 18); if (sc < bs) { bs = sc; best = w; } }
    if (!best) return;
    const g = makeHornTruck(); g.position.set(best.x, 0, best.z); const aim = Math.atan2(P.x - best.x, P.z - best.z); g.rotation.y = Math.round(aim / (Math.PI / 2)) * (Math.PI / 2); scene.add(g);
    const line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.3, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); line.renderOrder = 8; line.visible = false; line.position.set(best.x, 0.14, best.z); scene.add(line);
    cannons.push({ g, line, hp: 2, mode: 'idle', t: rnd(1.6, 2.6), aim, stun: 0, sp: 0, arrow: mkArrow('📢', '#ffb030') }); E.banner('📢 STORM CANNON!'); sfx.whoosh();
  }
  function killCannon(c, how) { E.speedBurst(2.2); const i = cannons.indexOf(c); if (i >= 0) cannons.splice(i, 1); scene.remove(c.line); c.arrow.remove(); const p = c.g.position.clone(); T.cannon = rnd(26, 38);
    if (how === 'crushed' && E.tw) twisters.suck(c.g, E.tw); else { const big = how === 'over' ? 3.2 : 2.6, at = p.clone().setY(0.6); twisters.scatter([c.g], p, 7); fx.explode(at, big); fx.shock(p, big * 2.1, 0xffb060, 0.5); fx.glow(p, big * 2.3, 0xffa040, 1, 0.5); fx.scorch(p, 2.4); fx.sparks(at, 26, { speed: 9, up: 8, life: 0.9 }); E.flash(0.2); /* struck by lightning: a big blast, then smaller ones around it */
      for (let k = 0; k < 4; k++) { const a = k * 1.57 + Math.random(), o = V(p.x + Math.cos(a) * 1.3, 0.5, p.z + Math.sin(a) * 1.3); setTimeout(() => fx.explode(o, 1.1), 90 + k * 70); } setTimeout(() => sfx.boom(), 160);
      /* its sound wave lets go all at once: a ring races outward and flattens what stands close by */
      fx.shock(p, 9, 0xffd9a0, 0.75); setTimeout(() => { fx.shock(p, 13, 0xffc060, 0.9); for (let k = 0; k < 10; k++) { const a = k * 0.628; fx.dust({ x: p.x + Math.cos(a) * 2.5, y: 0, z: p.z + Math.sin(a) * 2.5 }, 1.3, Math.cos(a) * 6, Math.sin(a) * 6); } E.crashDamage(p.clone(), how === 'over' ? 4.2 : 3.2, V(0, 0, 1)); E.jolt(0.8); }, 140); }
    E.award(600, p, how === 'crushed' ? 'CANNON CRUSHED' : how === 'over' ? 'OVERLOAD' : 'CANNON'); E.grow(1.5); E.banner(how === 'over' ? '📢 CANNON OVERLOADED!' : '📢 CANNON DESTROYED!'); sfx.boom(); E.jolt(0.6); }
  function zapCannon(c) { const p = c.g.position, over = c.mode === 'charge'; E.boltTo(V(p.x, 1, p.z)); c.hp -= over ? 2 : 1; // struck while it charges, it blows itself up
    if (c.hp <= 0) { killCannon(c, over ? 'over' : 'zap'); return; }
    c.stun = 3.5; c.mode = 'idle'; c.t = 1; c.line.visible = false; c.g.userData.glow.material.opacity = 0; fx.sparks(V(p.x, 1, p.z), 14, { speed: 6, up: 5, life: 0.5 }); E.popup(p, 'JAMMED! HIT IT AGAIN', '#ffd24a'); E.award(150, p); }
  function fire(c) { c.mode = 'idle'; c.t = rnd(2.6, 3.6); c.line.visible = false; c.g.userData.glow.material.opacity = 0; const dir = V(Math.sin(c.aim), 0, Math.cos(c.aim)), from = c.g.position.clone().addScaledVector(dir, 1.3);
    const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(waveGeo, mat); m.position.z = -i * 1.1; m.scale.setScalar(1 - i * 0.18); g.add(m); }
    g.position.copy(from).setY(1.2); g.rotation.y = c.aim; scene.add(g); waves.push({ g, mat, dir, far: 0, hit: false }); fx.shock(from, 3.5, 0xffc060); for (let i = 0; i < 4; i++) fx.dust(from, 1.2, dir.x * 4, dir.z * 4); sfx.boom(); if (seen(from)) E.jolt(0.3); }
  function updateCannons(dt, px, pz, R) {
    for (let i = cannons.length - 1; i >= 0; i--) { const c = cannons[i], g = c.g, p = g.position, ud = g.userData, dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz) || 0.01, want = Math.atan2(dx, dz); c.t -= dt; c.stun -= dt;
      if (d < R + 0.9 && !E.flying) { killCannon(c, 'crushed'); continue; } /* E.flying: the player flies over the trucks (BEAM 'EM UP!'s saucer) and never runs one over */
      if (c.stun > 0) { c.sp -= dt; if (c.sp <= 0) { c.sp = 0.18; fx.sparks(V(p.x, 1.1, p.z), 3, { speed: 3, up: 3, life: 0.35 }); } }
      else if (c.mode === 'idle') { c.aim = turnTo(c.aim, want, dt * 2.2); if (c.t <= 0 && d < RANGE) { c.mode = 'charge'; c.t = CHARGE; sfx.laser(); } }
      else { const lock = c.t < 0.45; if (!lock) c.aim = turnTo(c.aim, want, dt * 1.7); const k = 1 - c.t / CHARGE; // it locks for the last moment: that is when to step aside
        ud.glow.material.opacity = k * (0.7 + Math.sin(E.played * 30) * 0.3); c.line.visible = true; c.line.rotation.y = c.aim; c.line.scale.set(1.5 + R * 0.25, 1, RANGE); c.line.material.opacity = lock ? 0.85 : 0.3 + k * 0.3 + Math.sin(E.played * 22) * 0.1; c.line.material.color.setHex(lock ? 0xff4a2a : 0xffa030);
        if (c.t <= 0) fire(c); }
      ud.horn.rotation.y = c.aim - g.rotation.y; E.edgeArrow(c.arrow, p, true); }
    for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i], st = WAVE_V * dt, p = w.g.position; p.addScaledVector(w.dir, st); w.far += st; const k = 1 + w.far * 0.07; w.g.scale.setScalar(k); w.mat.opacity = Math.max(0, 0.9 * (1 - w.far / (RANGE + 3)));
      if (Math.random() < 0.6) fx.dust({ x: p.x, y: 0, z: p.z }, 0.9, w.dir.x * 3, w.dir.z * 3);
      { const rv = !w.hitR && rivalAt(p.x, p.z, 1.1 * k, 0.6); if (rv) { w.hitR = true; hurtRival(rv, 0.2, 'BLASTED! -SIZE', '#ffb030'); rv.kv.copy(w.dir).multiplyScalar(14); rv.stun = Math.max(rv.stun, 0.8); fx.shock(rv.g.position, 1.6 * rv.shown * 2.4, 0xffc060, 0.5); if (seen(rv.g.position, 2)) sfx.boom(); } }
      if (!w.hit && Math.hypot(p.x - px, p.z - pz) < R * 0.6 + 1.1 * k) { w.hit = true; kick.copy(w.dir).multiplyScalar(17); E.grow(-E.massTarget * 0.035); E.popup(E.twObj.position, 'BLASTED! -SIZE', '#ffb030'); E.banner('📢 BLASTED BACK!'); E.jolt(0.7); sfx.hurt(); fx.shock({ x: px, y: 0, z: pz }, R * 2.4, 0xffc060, 0.5); }
      if (w.far > RANGE + 3) { scene.remove(w.g); w.mat.dispose(); waves.splice(i, 1); } }
  }

  // ---------- gunships ----------
  function spawnShips() { const b = lim(), a0 = Math.random() * 6.28, R0 = Math.max(b.x, b.z) + 9; T.ship = rnd(38, 52);
    for (let k = 0; k < 2; k++) { const g = makeGunship(), a = a0 + k * 0.3; g.position.set(Math.cos(a) * R0, 5 + k * 0.9, Math.sin(a) * R0); scene.add(g); ships.push({ g, ph: a0 + Math.PI + k * Math.PI, y0: 5 + k * 0.9, head: Math.atan2(-Math.cos(a), -Math.sin(a)), life: 36, cd: 3 + k * 1.4, vel: V(), arrow: mkArrow('🚁', '#9fe8ff') }); }
    E.banner('🚁 GUNSHIPS!'); sfx.whoosh(); }
  function fireRocket(s, px, pz) { const from = s.g.position.clone(); from.y -= 0.3; const d = Math.hypot(px - from.x, pz - from.z), tf = d / 13, to = V(px + sv.x * tf * 0.6, 1.2, pz + sv.z * tf * 0.6); // aimed a little ahead of the storm: keep moving, and turn
    const m = new THREE.Mesh(rocketGeo, rocketMat); m.position.copy(from); m.lookAt(to); scene.add(m); rockets.push({ m, vel: to.sub(from).normalize().multiplyScalar(13), sm: 0 }); fx.puff('smoke', from, 0.3); if (seen(from, from.y)) sfx.throw(); }
  function zapShip(s) { E.speedBurst(2.2); const g = s.g, p = g.position.clone(), i = ships.indexOf(s); if (i >= 0) ships.splice(i, 1); s.arrow.remove(); E.boltTo(p.clone()); fx.explode(p.clone(), 0.6); E.popup(p, 'HIT!', '#ffd24a'); E.award(200, p); sfx.whoosh();
    const sp = Math.hypot(s.vel.x, s.vel.z); fall(g, sp > 1 ? Math.atan2(s.vel.x, s.vel.z) : s.head, Math.max(4, sp), { blast: 1.6, plough: rnd(3.5, 6), r: 1.5, pts: 400, label: 'GUNSHIP DOWN', banner: '🚁 GUNSHIP DOWN!', grow: 1.5, size: 0.8 }); }
  function updateShips(dt, px, pz, R) { const b = lim(), far = Math.max(b.x, b.z) + 14;
    for (let i = ships.length - 1; i >= 0; i--) { const s = ships[i], g = s.g, p = g.position; s.life -= dt; s.cd -= dt; s.ph += dt * 0.5; if (E.radarDown) s.life = Math.min(s.life, 0);
      const orbit = 6 + R, leave = s.life <= 0; let tx, tz; if (leave) { const l = Math.hypot(p.x, p.z) || 1; tx = p.x / l * (far + 8); tz = p.z / l * (far + 8); } else { tx = px + Math.cos(s.ph) * orbit; tz = pz + Math.sin(s.ph) * orbit; }
      const ex = tx - p.x, ez = tz - p.z, el = Math.hypot(ex, ez) || 0.01, want = Math.min(10, el * 1.6), e = Math.min(1, dt * 2.2); s.vel.x += (ex / el * want - s.vel.x) * e; s.vel.z += (ez / el * want - s.vel.z) * e; p.x += s.vel.x * dt; p.z += s.vel.z * dt; p.y = s.y0 + Math.sin(E.played * 2 + s.ph) * 0.25;
      const dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz), sp = Math.hypot(s.vel.x, s.vel.z);
      s.head = turnTo(s.head, !leave && d < orbit + 6 ? Math.atan2(dx, dz) : Math.atan2(s.vel.x, s.vel.z), dt * 3); g.rotation.set(0, s.head, 0); g.rotateX(Math.min(0.3, sp * 0.03)); // nose on the storm while it circles
      for (const r of g.userData.props) r.rotation.y += dt * 30; g.userData.tail.rotation.x += dt * 40;
      if (!leave && s.cd <= 0 && d < orbit + 3) { s.cd = rnd(2.6, 3.6); fireRocket(s, px, pz); }
      E.edgeArrow(s.arrow, p, !leave);
      if (leave && Math.hypot(p.x, p.z) > far) { scene.remove(g); s.arrow.remove(); ships.splice(i, 1); } }
    const top = 4.62 * E.size;
    for (let i = rockets.length - 1; i >= 0; i--) { const k = rockets[i], p = k.m.position; p.addScaledVector(k.vel, dt); k.sm -= dt; if (k.sm <= 0) { k.sm = 0.04; fx.puff('smoke', p, 0.22); }
      const hit = p.y < top && Math.hypot(p.x - px, p.z - pz) < R * 0.55 + 0.4;
      if (hit) { slowT = Math.min(3.4, Math.max(0, slowT) + 1.8); E.grow(-E.massTarget * 0.012); E.popup(E.twObj.position, 'FROZEN!', '#9fe8ff'); fx.sparks(p, 12, { c: [0xffffff, 0x9fe8ff], speed: 5, up: 3, life: 0.6 }); E.jolt(0.25); sfx.hurt(); }
      else if (p.y <= 0.15) { fx.explode(p.clone().setY(0.3), 0.4); fx.glow(p, 1.8, 0x9fe8ff, 0.9, 0.6); }
      const rv = !hit && p.y > 0.15 && rivalAt(p.x, p.z, 0.4, 0.55); const hitR = !!rv && p.y < 4.62 * rv.shown; if (hitR) { hurtRival(rv, 0.08, 'FROZEN!', '#9fe8ff'); rv.stun = Math.max(rv.stun, 1.2); fx.sparks(p, 12, { c: [0xffffff, 0x9fe8ff], speed: 5, up: 3, life: 0.6 }); }
      if (hit || hitR || p.y <= 0.15) { scene.remove(k.m); rockets.splice(i, 1); } }
  }

  // ---------- UFO ----------
  function spawnUfo() { const b = lim(), a = Math.random() * 6.28, R0 = Math.max(b.x, b.z) + 9, g = makeSaucer(); g.position.set(Math.cos(a) * R0, 8, Math.sin(a) * R0); scene.add(g);
    const ray = new THREE.Mesh(rayGeo, new THREE.MeshBasicMaterial({ color: 0x8aff5a, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); ray.visible = false; ray.renderOrder = 4; ray.frustumCulled = false; scene.add(ray);
    const mark = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0xffe24a, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, side: THREE.DoubleSide })); mark.visible = false; mark.renderOrder = 8; scene.add(mark);
    ufo = { g, ray, mark, hp: 3, mode: 'prowl', t: 5, life: 85, hurt: 0, pingT: 0, sayT: 0, tick: 0, ph: a + Math.PI, vel: V(), foot: V(), spot: V(), arrow: mkArrow('🛸', '#7dffb0'), tag: mkTag() };
    E.banner('🛸 UFO!'); sfx.laser(); setTimeout(() => sfx.laser(), 220); }
  function dropUfo() { const u = ufo; if (!u) return; ufo = null; scene.remove(u.ray); scene.remove(u.mark); u.ray.material.dispose(); u.mark.material.dispose(); u.arrow.remove(); u.tag.remove(); T.ufo = rnd(55, 75); return u; }
  function beam(u, foot, col, op, rad) { const from = u.g.position.clone(); from.y -= 0.45; const dir = V(foot.x - from.x, 0.05 - from.y, foot.z - from.z), len = dir.length(); dir.normalize(); const m = u.ray; m.visible = true; m.position.copy(from); m.quaternion.setFromUnitVectors(UP, dir); m.scale.set(rad, len, rad); m.material.color.setHex(col); m.material.opacity = op * (0.8 + Math.random() * 0.4); }
  function pickSpot(p, px, pz, R) { let best = null, bd = 1e9; for (const c of E.people) { const ds = Math.hypot(c.position.x - px, c.position.z - pz); if (ds < R + 4 || ds > R + 13 || !E.toScreen(c.position, 4.4).on) continue; const q = Math.hypot(c.position.x - p.x, c.position.z - p.z); if (q < bd) { bd = q; best = c; } } // a crowd near the storm, but not under it
    if (best) return V(best.position.x, 0, best.position.z); const b = lim(), o = R + 5.5; let alt = null, ad = 1e9; for (let k = 0; k < 10; k++) { const a = k * 0.628, q = V(Math.max(-b.x, Math.min(b.x, px + Math.cos(a) * o)), 0, Math.max(-b.z, Math.min(b.z, pz + Math.sin(a) * o))); if (!E.toScreen(q, 4.4).on) continue; const dq = Math.hypot(q.x - p.x, q.z - p.z); if (dq < ad) { ad = dq; alt = q; } } return alt || V(px + o, 0, pz); }
  function zapUfo() { const u = ufo, p = u.g.position, open = u.mode === 'harvest' || u.mode === 'reel';
    if (!open) { E.boltTo(V(p.x, p.y + 1, p.z)); u.pingT = 0.25; fx.sparks(p, 10, { c: [0xffffff, 0x6affd8], speed: 6, up: 2, life: 0.4 }); E.popup(p, 'SHIELDED!', '#6affd8'); return; } // lightning slides off the shield
    E.boltTo(p.clone()); if (u.hurt > 0) return; u.hurt = 1; u.hp--; fx.explode(p.clone(), 0.8); E.jolt(0.5); E.award(400, p, 'HIT');
    if (u.hp > 0) { E.banner('🛸 HIT! ' + u.hp + ' TO GO'); u.mode = 'reel'; u.t = 1.3; u.ray.visible = false; return; }
    const g = u.g, sp = Math.hypot(u.vel.x, u.vel.z); dropUfo(); g.rotation.z = 0; E.banner('🛸 THE UFO IS GOING DOWN!'); E.speedBurst(3.5); // three strikes: it comes down hard
    fall(g, sp > 0.5 ? Math.atan2(u.vel.x, u.vel.z) : Math.random() * 6.28, 5, { blast: 3, plough: rnd(9, 13), r: 2.3, pts: 3000, label: 'UFO DOWN', banner: '🛸 UFO DOWN!', grow: 6, size: 1.7, flat: true }); }
  function updateUfo(dt, px, pz, R) {
    const u = ufo, g = u.g, p = g.position, ud = g.userData; u.t -= dt; u.life -= dt; u.hurt -= dt; u.tick -= dt; u.pingT -= dt; u.sayT -= dt;
    ud.ring.material.map.offset.x += dt * 0.6; g.rotation.y += dt * 0.5;
    const d = Math.hypot(px - p.x, pz - p.z); let tx = p.x, tz = p.z, alt = 7.5, shield = true, vmax = 8;
    if (u.mode === 'leave') { const b = lim(), far = Math.max(b.x, b.z) + 12, l = Math.hypot(p.x, p.z) || 1; tx = p.x / l * (far + 8); tz = p.z / l * (far + 8); alt = 11; vmax = 11; if (l > far) { scene.remove(g); dropUfo(); return; } }
    else if (u.mode === 'prowl') { u.ph += dt * 0.45; const o = 5.5 + R; tx = px + Math.cos(u.ph) * o; tz = pz + Math.sin(u.ph) * o; // circling, shield up, until it is close enough to fire
      if (u.t <= 0) { if (u.life <= 0) { u.mode = 'leave'; E.banner('🛸 THE UFO FLEW OFF'); } else if (d < o + 5) { u.mode = 'aim'; u.t = 1.1; u.foot.set(px, 0, pz); sfx.laser(); } } }
    else if (u.mode === 'aim' || u.mode === 'ray') { vmax = 0; // it hangs still to fire. The circle shows where the ray will land; it creeps after the storm, slower than the storm moves
      const fr = 1.5 + R * 0.35, fd = Math.hypot(px - u.foot.x, pz - u.foot.z), crawl = (u.mode === 'ray' ? 2.5 : 1.2) * dt; if (fd > 0.05) { u.foot.x += (px - u.foot.x) / fd * Math.min(fd, crawl); u.foot.z += (pz - u.foot.z) / fd * Math.min(fd, crawl); }
      u.mark.visible = true; u.mark.position.set(u.foot.x, 0.16, u.foot.z); u.mark.scale.setScalar(fr); u.mark.material.opacity = 0.55 + Math.sin(E.played * 18) * 0.3;
      if (u.mode === 'aim') { u.mark.material.color.setHex(0xffe24a); if (u.t <= 0) { u.mode = 'ray'; u.t = 2.4; sfx.laser(); if (seen(p, p.y)) E.jolt(0.3); } }
      else { u.mark.material.color.setHex(0x8aff5a); beam(u, u.foot, 0x8aff5a, 0.45, fr * 0.8);
        if (u.tick <= 0) { u.tick = 0.2; fx.sparks(V(u.foot.x, 0.2, u.foot.z), 5, { c: [0xffffff, 0x8aff5a], speed: 4, up: 4, life: 0.4 }); fx.glow(u.foot, fr * 1.4, 0x8aff5a, 0.3, 0.5); fx.scorch(u.foot, 0.7, 10); }
        { const rv = rivalAt(u.foot.x, u.foot.z, fr, 0.35); if (rv) hurtRival(rv, 0.3 * dt, '-SIZE', '#8aff5a'); }
        if (fd < fr + R * 0.35) { E.grow(-E.massTarget * 0.05 * dt); status('🛸 SHRINK RAY! MOVE!'); if (u.sayT <= 0) { u.sayT = 0.5; E.popup(E.twObj.position, '-SIZE', '#8aff5a'); sfx.hurt(); } }
        if (u.t <= 0) { u.mode = 'seek'; u.t = 3; u.ray.visible = false; u.mark.visible = false; u.spot = pickSpot(p, px, pz, R); } } }
    else if (u.mode === 'seek') { tx = u.spot.x; tz = u.spot.z; vmax = 9; if (Math.hypot(tx - p.x, tz - p.z) < 0.8 || u.t <= 0) { u.mode = 'harvest'; u.t = 5.5; if (seen(p, p.y)) E.banner('🛸 SHIELD DOWN! STRIKE IT'); } }
    else if (u.mode === 'harvest') { shield = false; alt = 4.4; tx = u.spot.x; tz = u.spot.z; vmax = 3; u.foot.set(p.x, 0, p.z); beam(u, u.foot, 0x7df0ff, 0.4, 1.9); // down low over a crowd, shield off, beaming them up: now it can be hit
      if (lifted.length < 8) { const ppl = E.people; for (let i = ppl.length - 1; i >= 0 && lifted.length < 8; i--) { const c = ppl[i]; if (Math.abs(c.position.x - p.x) > 2.1 || Math.hypot(c.position.x - p.x, c.position.z - p.z) > 2.1) continue; ppl.splice(i, 1); delete c.updateMatrixWorld; lifted.push(c); } }
      if (u.t <= 0) { u.mode = 'prowl'; u.t = 4; u.ray.visible = false; } }
    else { shield = false; alt = 5.5; vmax = 0; g.rotation.z = Math.sin(u.t * 30) * 0.25; if (Math.random() < dt * 20) fx.puff('smoke', p, 0.7); if (u.t <= 0) { g.rotation.z = 0; u.mode = 'prowl'; u.t = 3.5; } } // reeling from a hit
    const ex = tx - p.x, ez = tz - p.z, el = Math.hypot(ex, ez) || 0.01, want = Math.min(vmax, el * 1.8), e = Math.min(1, dt * 2.5); u.vel.x += (ex / el * want - u.vel.x) * e; u.vel.z += (ez / el * want - u.vel.z) * e; p.x += u.vel.x * dt; p.z += u.vel.z * dt; p.y += (alt + Math.sin(E.played * 1.7) * 0.2 - p.y) * Math.min(1, dt * 1.8);
    ud.shield.visible = shield; if (shield) ud.shield.material.opacity = 0.14 + Math.sin(E.played * 5) * 0.04 + (u.pingT > 0 ? 0.35 : 0);
    tagAt(u.tag, p, p.y + 1.5, shield ? '🛡 SHIELD UP' : '⚡ TAP IT! ' + '●'.repeat(u.hp), shield ? 'shield' : 'hit'); E.edgeArrow(u.arrow, p, true);
  }
  function updateLifted(dt) { for (let i = lifted.length - 1; i >= 0; i--) { const c = lifted[i]; if (!ufo) { scene.remove(c); lifted.splice(i, 1); continue; } const q = ufo.g.position, e = Math.min(1, dt * 3); c.position.x += (q.x - c.position.x) * e; c.position.z += (q.z - c.position.z) * e; c.position.y += dt * 2.6; c.rotation.y += dt * 5;
      if (c.position.y >= q.y - 0.7) { scene.remove(c); lifted.splice(i, 1); if (seen(q, q.y)) E.popup(q, 'BEAMED UP!', '#7df0ff'); } } }

  // ---------- shot down: it spins down on fire the way it was going, blows up where it lands, and what is left ploughs on,
  // wrecking a strip of town (the same end the seeding planes meet) ----------
  function fall(g, heading, speed, o) { falling.push({ g, heading, speed, vy: 0.4, t: 0, roll: (Math.random() < 0.5 ? -1 : 1) * rnd(5, 8), sm: 0, o, down: false }); }
  function updateFalling(dt) { const b = lim();
    for (let i = falling.length - 1; i >= 0; i--) { const C = falling[i], g = C.g, o = C.o; C.t += dt;
      if (!C.down) { C.vy += 11 * dt; const sp = C.speed * (1.1 + C.t * 0.5); C.heading += C.roll * 0.04 * dt; g.position.x += Math.sin(C.heading) * sp * dt; g.position.z += Math.cos(C.heading) * sp * dt; g.position.y -= C.vy * dt;
        if (o.flat) { g.rotation.set(Math.sin(C.t * 9) * 0.5, g.rotation.y + dt * 6, Math.cos(C.t * 7) * 0.5); } else { g.rotation.set(0, C.heading, 0); g.rotateX(Math.min(0.9, C.t * 0.7)); g.rotateZ(C.t * C.roll); for (const r of g.userData.props || []) r.rotation.y += dt * 12; }
        C.sm -= dt; if (C.sm <= 0) { C.sm = 0.035; fx.puff('flame', g.position, 0.9 * o.size); fx.puff('smoke', g.position, 0.9 * o.size); if (Math.random() < 0.4) fx.sparks(g.position, 2, { speed: 2, up: 0, life: 0.5 }); }
        if (g.position.y > 0.5) continue;
        const at = g.position.clone().setY(0), dir = V(Math.sin(C.heading), 0, Math.cos(C.heading)); C.down = true; C.pos = at; C.dir = dir; C.left = o.plough; C.v = Math.max(8, C.speed * 2); C.acc = 1;
        fx.explode(at.clone().setY(0.6), o.blast); fx.scorch(at, o.blast, 26); E.jolt(1); E.flash(0.3); sfx.boom(); setTimeout(() => sfx.boom(), 180); E.banner(o.banner); E.award(o.pts, at, o.label); E.grow(o.grow);
        for (const m of g.userData.strip || []) g.remove(m); g.rotation.set(0, C.heading, 0); g.updateMatrixWorld(true);
        twisters.tear(g, at, new THREE.Box3().setFromObject(g).getSize(V()), null, [], [], { collapse: true, now: true, power: 1.2, push: dir.clone().multiplyScalar(7).setY(3) }); continue; }
      const step = C.v * dt; C.pos.addScaledVector(C.dir, step); C.left -= step; C.acc += step; C.v = Math.max(4, C.v - 9 * dt);
      const p = C.pos, out = Math.abs(p.x) > b.x || Math.abs(p.z) > b.z; fx.puff('flame', { x: p.x, y: 0.3, z: p.z }, 1.3); if (Math.random() < 0.5) fx.dust(p, 1.1); E.jolt(0.25);
      if (C.acc >= 0.9 && !out) { C.acc = 0; fx.ignite(V(p.x + rnd(-0.4, 0.4), 0.1, p.z + rnd(-0.4, 0.4)), rnd(0.7, 1.2), rnd(7, 13)); fx.scorch(p, rnd(1.1, 1.6), 28); if (Math.random() < 0.45) fx.explode(V(p.x, 0.4, p.z), 0.7); E.crashDamage(p, o.r, C.dir); }
      if (C.left <= 0 || out) { if (!out) fx.explode(V(p.x, 0.5, p.z), 1.5); falling.splice(i, 1); } }
  }

  // ---------- who turns up, and when ----------
  function schedule(dt) { const lv = E.level, late = lv >= 6 ? 0.7 : 1, about = (rival ? 1 : 0) + (ships.length ? 1 : 0) + (ufo ? 1 : 0), room = about < (lv >= 6 ? 2 : 1);
    if (on('cannon') && cannons.length < (lv >= 5 ? 2 : 1)) { T.cannon -= dt; if (T.cannon <= 0) { T.cannon = rnd(24, 34) * late; spawnCannon(); } }
    if (!room) return;
    if (on('ufo') && !ufo && !falling.some((f) => f.o.flat)) { T.ufo -= dt; if (T.ufo <= 0) { T.ufo = rnd(55, 75) * late; spawnUfo(); return; } }
    if (on('ship') && !ships.length && !E.radarDown) { T.ship -= dt; if (T.ship <= 0) { spawnShips(); T.ship *= late; return; } }
    if (on('rival') && !rival) { T.rival -= dt; if (T.rival <= 0) { T.rival = rnd(28, 40) * late; spawnRival(); } } }
  function update(dt, px, pz, R) {
    if (dt > 0) sv.set((px - lx) / dt, 0, (pz - lz) / dt).clampLength(0, 8); lx = px; lz = pz;
    // thrown back (a cannon's blast, a bigger twister): the storm slides that way for a moment, whatever the player does
    if (kick.lengthSq() > 0.02) { const P = E.twObj.position, b = lim(); P.x = Math.max(-b.x, Math.min(b.x, P.x + kick.x * dt)); P.z = Math.max(-b.z, Math.min(b.z, P.z + kick.z * dt)); kick.multiplyScalar(Math.max(0, 1 - dt * 3.5)); px = P.x; pz = P.z; }
    slowT = Math.max(0, slowT - dt); if (slowT > 0) { status('❄ FROZEN! SLOWED'); frostT -= dt; if (frostT <= 0) { frostT = 0.12; const a = Math.random() * 6.28; fx.sparks(V(px + Math.cos(a) * R, rnd(0.5, 3), pz + Math.sin(a) * R), 2, { c: [0xffffff, 0x9fe8ff], speed: 1.5, up: 2, life: 0.6 }); fx.glow({ x: px, y: 0, z: pz }, R * 1.7, 0x9fe8ff, 0.25, 0.3); } }
    schedule(dt * (E.foeK ? E.foeK() : 1)); /* (foeK: a harder round sends the enemies in faster) */
    if (rival) updateRival(dt, px, pz, R); updateCannons(dt, px, pz, R); updateShips(dt, px, pz, R); if (ufo) updateUfo(dt, px, pz, R); updateLifted(dt); updateFalling(dt);
    statusT -= dt; if (statusEl) statusEl.style.opacity = statusT > 0 ? 1 : 0;
  }
  function clear() {
    removeRival(); for (const c of cannons) { scene.remove(c.g); scene.remove(c.line); c.arrow.remove(); } cannons = []; for (const s of ships) { scene.remove(s.g); s.arrow.remove(); } ships = [];
    if (ufo) { const u = dropUfo(); scene.remove(u.g); } for (const c of lifted) scene.remove(c); lifted.length = 0; for (const f of falling) if (!f.down) scene.remove(f.g); falling.length = 0;
    for (const k of rockets) scene.remove(k.m); rockets.length = 0; for (const w of waves) { scene.remove(w.g); w.mat.dispose(); } waves.length = 0;
    slowT = statusT = 0; kick.set(0, 0, 0); if (statusEl) statusEl.style.opacity = 0;
    // the newest enemy for this town comes first, so the player meets it early; the others follow
    const roam = ['rival', 'ship', 'ufo'].filter(on), newest = roam[roam.length - 1]; let later = 46; for (const k of roam) { if (k === newest) T[k] = 22; else { T[k] = later; later += 16; } } T.cannon = 30;
  }
  // a tap on one of them strikes it instead of moving the storm. Returns true, or a spot to head for (a twister you can eat)
  function tap(near) {
    if (ufo && ufo.mode !== 'leave' && near(ufo.g.position, 70)) { zapUfo(); return true; }
    for (const s of ships) if (near(s.g.position, 60)) { zapShip(s); return true; }
    for (const c of cannons) if (near(V(c.g.position.x, 0.8, c.g.position.z), 56)) { zapCannon(c); return true; }
    if (rival && rival.out == null) { const r = rival, p = r.g.position, h = 4.62 * r.shown; if (near(V(p.x, h * 0.25, p.z), 54) || near(V(p.x, h * 0.6, p.z), 62)) { const eat = r.shown / E.size < 0.92; zapRival(); return eat ? V(p.x, 0, p.z) : true; } }
    return false;
  }
  // for the SPACE bolt on a computer: everything that can be struck, with where it is
  function targets() { const out = []; if (ufo && ufo.mode !== 'leave') out.push({ pos: ufo.g.position, zap: zapUfo }); for (const s of ships) out.push({ pos: s.g.position, zap: () => zapShip(s) }); for (const c of cannons) out.push({ pos: c.g.position, zap: () => zapCannon(c) }); if (rival && rival.out == null && rival.immune <= 0) out.push({ pos: rival.g.position, zap: zapRival }); return out; }
  function eachDot(fn) { if (rival && rival.out == null) fn(rival.g.position, '🌪️', rival.shown / E.size < 0.92 ? '#7dff3a' : '#ff5ae0'); for (const c of cannons) fn(c.g.position, '📢', '#ffb030'); for (const s of ships) fn(s.g.position, '🚁', '#9fe8ff'); if (ufo) fn(ufo.g.position, '🛸', '#7dffb0'); }
  // first-time prompts: each enemy is explained the first time it is on screen
  function coachTick() { const { coach, coachSeen, toScreen } = E;
    if (rival && rival.out == null && rival.shown > 0.5 && !coachSeen('ta_rival') && seen(rival.g.position, 2)) { const r = rival; return coach('ta_rival', { mode: 'tap', title: '🌪️ ROGUE TWISTER', text: 'It eats your town. Its tag shows who is bigger. Green: run into it and swallow it. Red: keep away, and tap it to strike it down to size.', at: () => (rival === r ? toScreen(r.g.position, 2.3 * r.shown) : null) }); }
    if (cannons.length && !coachSeen('ta_cannon')) { const c = cannons.find((o) => seen(o.g.position, 0.8)); if (c) return coach('ta_cannon', { mode: 'tap', title: '📢 STORM CANNON', text: (E.words || {}).cannon || 'It charges, then blasts along the orange line: that knocks you back and shrinks you. Step off the line, then tap the truck to strike it, or run it over.', at: () => (cannons.includes(c) ? toScreen(c.g.position, 0.8) : null) }); }
    if (ships.length && !coachSeen('ta_gunship')) { const s = ships.find((o) => o.life > 0 && seen(o.g.position, o.g.position.y)); if (s) return coach('ta_gunship', { mode: 'tap', title: '🚁 GUNSHIPS', text: (E.words || {}).ship || 'Their freeze rockets slow your storm down. Keep moving, and tap each helicopter to strike it out of the sky.', at: () => (ships.includes(s) ? toScreen(s.g.position, s.g.position.y) : null) }); }
    if (ufo && ufo.mode !== 'leave' && !coachSeen('ta_ufo') && seen(ufo.g.position, ufo.g.position.y)) { const u = ufo; return coach('ta_ufo', { mode: 'ok', title: '🛸 UFO', text: (E.words || {}).ufo || 'Its shield stops lightning, and its green ray shrinks you: get out of the circle. When it drops low to beam people up, the shield is off. Tap it then. Three strikes bring it down.', at: () => (ufo === u ? toScreen(u.g.position, u.g.position.y) : null) }); }
    return false; }
  // anything that lands a blow over an area (Kaiju Madness: a punch, a spell, a body skidding through town) strikes what is in it.
  // Each one can only be struck so often, so one long skid is one hit
  function hitAt(c, r) { let n = 0; const now = E.played, ok = (o, gap) => { if ((o.hitCd || -9) > now) return false; o.hitCd = now + gap; return true; };
    for (const cn of cannons.slice()) if (Math.hypot(cn.g.position.x - c.x, cn.g.position.z - c.z) < r + 1 && ok(cn, 0.5)) { zapCannon(cn); n++; }
    for (const s of ships.slice()) if (Math.hypot(s.g.position.x - c.x, s.g.position.z - c.z) < r + 1.4) { zapShip(s); n++; }
    if (ufo && ufo.mode !== 'leave' && Math.hypot(ufo.g.position.x - c.x, ufo.g.position.z - c.z) < r + 2 && ok(ufo, 0.6)) { zapUfo(); n++; }
    return n; }
  return { update, clear, tap, targets, eachDot, coachTick, hitAt, rivalAt, hurtRival, get slow() { return slowT > 0 ? 0.5 : 1; },
    // the boss: spawnBoss() brings the Maelstrom in (false while another rogue is about); boss: it, while it is up; bossFrac(): how far it still is from small enough to swallow (1..0); dropBoss(): it winds itself out
    spawnBoss() { if (rival) return false; spawnRival(true); return true; }, get boss() { return rival && rival.boss && rival.out == null ? rival : null; }, bossFrac() { const r = rival; return r && r.boss ? Math.max(0, Math.min(1, (r.shown / E.size - 0.92) / Math.max(0.05, r.r0 - 0.92))) : 0; }, dropBoss() { if (rival && rival.boss && rival.out == null) endRival(false); },
    // for tests
    spawn(k) { if (k === 'rival') { removeRival(); spawnRival(); } else if (k === 'cannon') spawnCannon(); else if (k === 'ship') spawnShips(); else if (k === 'ufo') { if (ufo) scene.remove(dropUfo().g); spawnUfo(); } }, get state() { return { rival, cannons, ships, ufo, falling, rockets, waves, lifted, T, slowT, kick }; }, zapRival, zapCannon, zapShip, zapUfo };
}
