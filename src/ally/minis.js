// Tornado Time!'s MINI BOSSES: one for each of the first five towns (The Sprawl keeps the Maelstrom). A mini boss turns up
// when the town's goals are half met; the town's clock stops and its own runs (main.js startMB / mbTick).
// Each is beaten its own way:
//   THE CHASER CONVOY (Small Town)   four armored chase trucks that run from you; the lead one harpoons you to slow you
//                                    down. Catch and swallow all four (a bolt stops one in its tracks for a moment)
//   THE CANNON RING (Suburbs)        three storm cannons round you, firing in turn: armored, except while one charges.
//                                    Strike it then and it blows itself up (they are cannons of foes.js, with ring: true)
//   THE SEEDER (Downtown)            a huge tanker plane that shrinks you with its spray. Its spray shorts out your
//                                    lightning: strike it after it has passed over, three times
//   THE ICE TWISTER (Metro)          a freezing rogue twister, bigger than you, that lightning cannot hurt. Whatever the
//                                    army fires at you shrinks it too: get it between you and them, then swallow it
//                                    (a rogue twister of foes.js, with ice: true)
//   THE WEATHER MACHINE (Megacity)   a tower that shrinks storms, behind a shield fed by four pylons: wreck the pylons
//                                    (two bolts each, or run them over), then the tower
// Here: the list, the models (our own designs) and the three that are things of their own. foes.js makes this (createMinis)
// and hands it what it needs of its own (A): the kick that throws the storm back, the freeze that slows it, arrows.
import * as THREE from 'three';
import { toWorld } from '../city.js';
import { sfx } from '../audio.js';
export const MINIS = [
  { key: 'convoy', name: '🚙 THE CHASER CONVOY', short: 'THE CHASER CONVOY', hint: '🎯 CATCH AND SWALLOW ALL FOUR TRUCKS', intro: 'THEIR HARPOON SLOWS YOU DOWN.\nCATCH AND SWALLOW ALL FOUR TRUCKS!', time: 80, score: 8000 },
  { key: 'ring', name: '📢 THE CANNON RING', short: 'THE CANNON RING', hint: '🎯 STRIKE EACH ONE WHILE IT CHARGES', intro: 'THREE ARMORED CANNONS, FIRING IN TURN.\nSTRIKE EACH ONE WHILE IT CHARGES!', time: 80, score: 9000 },
  { key: 'seeder', name: '✈ THE SEEDER', short: 'THE SEEDER', hint: '🎯 STRIKE IT AFTER IT PASSES OVER YOU', intro: 'ITS SPRAY SHRINKS YOU, AND STOPS YOUR LIGHTNING.\nSTRIKE IT RIGHT AFTER IT PASSES!', time: 85, hp: 3, score: 10000 },
  { key: 'ice', name: '❄ THE ICE TWISTER', short: 'THE ICE TWISTER', hint: '🎯 LET THE ARMY HIT IT, THEN SWALLOW IT', intro: 'LIGHTNING CANNOT HURT IT.\nLET THE ARMY\'S SHOTS HIT IT, THEN SWALLOW IT!', time: 100, score: 11000 },
  { key: 'weather', name: '🗼 THE WEATHER MACHINE', short: 'THE WEATHER MACHINE', hint: '🎯 WRECK THE FOUR PYLONS, THEN THE TOWER', intro: 'IT IS SHRINKING YOUR STORM.\nWRECK ITS FOUR PYLONS, THEN THE TOWER!', time: 100, hp: 3, score: 12000 },
];
// the Ice Twister's look: white and pale blue, with blue lightning
export const ICE = { layers: [0xdff6ff, 0x8fd8ff, 0xffffff], op: [0.9, 0.6, 0.35], cloud: 0xc8e8f8, dust: 0xbfe6ff, junk: [0xffffff, 0x9fe8ff, 0x6ab8e8, 0xdff6ff], bolts: [0x9fe8ff, 0xffffff], boltGlow: 0x6ad8ff, lights: [0x9fe8ff, 0xffffff, 0x6ab8e8], glow: true };

const L = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e }), B = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 }), ADD = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
const bx = new THREE.BoxGeometry(1, 1, 1), cy = new THREE.CylinderGeometry(0.5, 0.5, 1, 12), sp = new THREE.SphereGeometry(0.5, 12, 9), lineG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
const P = (par, geo, mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); par.add(m); return m; };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), rnd = (a, b) => a + Math.random() * (b - a);
// a chase truck: armored, big tyres, a roll cage, a dish turning on the roof; the lead one has the harpoon gun and an orange stripe
export function makeChaseTruck(lead) { const g = new THREE.Group(), body = L(lead ? 0x2a6a72 : 0x3a4a5a, 0x060a0c), dark = L(0x1c2026), tire = L(0x141416), glass = L(0x9fd8f0, 0x12303a), steel = L(0xa8b0ba), orange = L(0xff8a2a, 0x3a1a04);
  P(g, bx, dark, 0.95, 0.16, 2.1, 0, 0.36, 0); P(g, bx, body, 1.05, 0.42, 2.15, 0, 0.62, 0); P(g, bx, body, 1.0, 0.44, 0.95, 0, 1.02, 0.25); P(g, bx, glass, 0.9, 0.26, 0.04, 0, 1.06, 0.74); P(g, bx, steel, 1.1, 0.14, 0.12, 0, 0.5, 1.12); for (const z of [0.72, -0.7]) for (const x of [-0.55, 0.55]) P(g, cy, tire, 0.62, 0.26, 0.62, x, 0.31, z).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) { P(g, cy, steel, 0.05, 0.6, 0.05, s * 0.46, 1.1, -0.35); P(g, bx, lead ? orange : steel, 0.03, 0.12, 2.0, s * 0.535, 0.62, 0); } P(g, bx, steel, 0.97, 0.05, 0.05, 0, 1.4, -0.35);
  const dish = new THREE.Group(); dish.position.set(0, 1.28, 0.3); g.add(dish); P(dish, cy, dark, 0.05, 0.3, 0.05, 0, 0.15, 0); { const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 5, 0, 6.2832, 0, 1.1), new THREE.MeshLambertMaterial({ color: 0xd8dde4, side: THREE.DoubleSide })); b.rotation.x = Math.PI / 2 + 0.5; b.position.y = 0.38; dish.add(b); }
  let gun = null; if (lead) { gun = new THREE.Group(); gun.position.set(0, 0.95, -0.72); g.add(gun); P(gun, cy, dark, 0.34, 0.2, 0.34, 0, 0, 0); P(gun, cy, steel, 0.1, 1.1, 0.1, 0, 0.16, 0.45).rotation.x = Math.PI / 2; P(gun, new THREE.ConeGeometry(0.11, 0.3, 6).rotateX(Math.PI / 2), orange, 1, 1, 1, 0, 0.16, 1.1); P(gun, cy, orange, 0.34, 0.16, 0.34, 0.24, 0.1, -0.1).rotation.z = Math.PI / 2; }
  g.userData = { dish, gun }; return g; }
// the Seeder: a fat white tanker with a green belly, four engines, spray bars under its wings, two tanks. Nose toward +z
export function makeSeeder() { const g = new THREE.Group(), white = L(0xeef1f4, 0x1a1c20), green = L(0x3aa85a, 0x06200c), dark = L(0x1c2028), glass = L(0x9fd8f0, 0x12303a), steel = L(0xa8b0ba), props = [];
  const f = P(g, cy, white, 1.3, 6.0, 1.3, 0, 0, 0); f.rotation.x = Math.PI / 2; P(g, sp, white, 1.3, 1.3, 1.7, 0, 0, 3.0); P(g, sp, white, 1.3, 1.3, 2.0, 0, 0, -3.0); P(g, bx, green, 1.0, 0.4, 5.6, 0, -0.5, 0); P(g, bx, glass, 0.8, 0.3, 0.6, 0, 0.42, 2.9);
  P(g, bx, white, 9.0, 0.16, 1.6, 0, 0.3, 0.3); P(g, bx, green, 9.0, 0.03, 0.2, 0, 0.39, 0.9); P(g, bx, steel, 8.4, 0.05, 0.05, 0, -0.1, -0.5); for (let i = -7; i <= 7; i++) if (i) P(g, sp, green, 0.14, 0.14, 0.14, i * 0.58, -0.16, -0.5);
  for (const s of [-1, 1]) { for (const x of [1.6, 3.1]) { const e = P(g, cy, dark, 0.42, 1.2, 0.42, s * x, 0.16, 0.9); e.rotation.x = Math.PI / 2; const p = new THREE.Group(); p.position.set(s * x, 0.16, 1.55); P(p, bx, dark, 1.2, 0.1, 0.03, 0, 0, 0); P(p, bx, dark, 0.1, 1.2, 0.03, 0, 0, 0); g.add(p); props.push(p); } const t = P(g, cy, green, 0.6, 1.8, 0.6, s * 2.35, -0.25, 0.1); t.rotation.x = Math.PI / 2; P(g, bx, white, 0.1, 0.9, 0.9, s * 1.5, 0.75, -3.0); }
  P(g, bx, white, 3.2, 0.1, 0.9, 0, 0.3, -3.0); g.userData.props = props; return g; }
// the Weather Machine: a lattice tower on a drum, a ring turning round a glowing core, a dish on top (userData.ring, coreM)
export function makeWeatherTower() { const g = new THREE.Group(), steel = L(0x8a94a2, 0x0c0e12), dark = L(0x262a32), red = L(0xd8362a, 0x3a0806), coreM = B(0x6ad8ff), white = L(0xeef1f4);
  P(g, new THREE.CylinderGeometry(1.5, 1.7, 0.8, 8), dark, 1, 1, 1, 0, 0.4, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; P(g, bx, i % 2 ? red : white, 0.5, 0.2, 0.06, Math.cos(a) * 1.55, 0.5, Math.sin(a) * 1.55).rotation.y = -a + Math.PI / 2; }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = P(g, cy, steel, 0.14, 4.4, 0.14, sx * 0.62, 2.9, sz * 0.62); leg.rotation.set(sz * 0.14, 0, -sx * 0.14); } for (const y of [1.6, 2.7, 3.8]) { const k = 1 - (y - 0.8) / 7; for (const r of [0, Math.PI / 2]) { const b = P(g, bx, steel, 1.9 * k, 0.07, 0.07, 0, y, 0); b.rotation.y = r + Math.PI / 4; } }
  P(g, cy, dark, 1.3, 0.2, 1.3, 0, 5.1, 0); P(g, sp, coreM, 1.1, 1.1, 1.1, 0, 5.9, 0); const ring = new THREE.Group(); ring.position.y = 5.9; g.add(ring); P(ring, new THREE.TorusGeometry(1.0, 0.09, 6, 24), steel, 1, 1, 1, 0, 0, 0); P(ring, new THREE.TorusGeometry(1.25, 0.06, 6, 24).rotateX(Math.PI / 2), red, 1, 1, 1, 0, 0, 0);
  P(g, cy, steel, 0.08, 1.0, 0.08, 0, 7.0, 0); { const d = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 6, 0, 6.2832, 0, 1.0), new THREE.MeshLambertMaterial({ color: 0xd8dde4, side: THREE.DoubleSide })); d.rotation.x = Math.PI; d.position.y = 7.9; g.add(d); } P(g, sp, B(0xff3a2a), 0.2, 0.2, 0.2, 0, 7.55, 0);
  g.userData = { ring, coreM }; return g; }
export function makePylon() { const g = new THREE.Group(), dark = L(0x262a32), orbM = B(0x6ad8ff); P(g, new THREE.CylinderGeometry(0.42, 0.5, 0.4, 8), dark, 1, 1, 1, 0, 0.2, 0); for (let i = 0; i < 5; i++) P(g, cy, L(i % 2 ? 0xeef1f4 : 0xd8362a), 0.26 - i * 0.02, 0.5, 0.26 - i * 0.02, 0, 0.65 + i * 0.5, 0); P(g, new THREE.TorusGeometry(0.3, 0.05, 5, 14).rotateX(Math.PI / 2), dark, 1, 1, 1, 0, 3.0, 0); const orb = P(g, sp, orbM, 0.6, 0.6, 0.6, 0, 3.3, 0); g.userData = { orb, orbM }; return g; }

// ---------- the three in play. E: what main.js gave foes.js; A: { kick, slow(t), mkArrow, status } ----------
export function createMinis(E, A) { const { scene, fx, twisters } = E; let m = null; const junk = [];
  const own = (o) => { scene.add(o); junk.push(o); return o; }, live = () => !!m && m.live, W = (c) => toWorld(c[0], c[1], E.cols, E.cols);
  const say = (pos, text, col = '#c8dcff') => { if (!m || E.played - m.sayT < 1.3) return; m.sayT = E.played; E.popup(pos, text, col); };
  const beaten = (pos) => { if (!live()) return; m.live = false; m.t = 0; if (E.miniDown) E.miniDown(pos); };
  const drop = (o) => { scene.remove(o); o.traverse((q) => { if (q.isMesh) { if (q.geometry !== bx && q.geometry !== cy && q.geometry !== sp) q.geometry.dispose(); if (q.material.dispose) q.material.dispose(); } }); };
  function clear() { if (m) { for (const o of m.objs) drop(o); for (const a of m.arrows) a.remove(); } for (const o of junk) { scene.remove(o); if (o.material) o.material.dispose(); } junk.length = 0; m = null; }
  // street squares between minR and maxR from the storm
  const spots = (minR, maxR) => { const Pp = E.twObj.position, ok = []; for (const c of E.roadCells) { const w = W(c), d = Math.hypot(w.x - Pp.x, w.z - Pp.z); if (d >= minR && d <= maxR) ok.push(c); } return ok.length ? ok : E.roadCells.slice(); };
  const boom = (p, big) => { const at = p.clone().setY(0.6); fx.explode(at, big); fx.shock(p, big * 2.1, 0xffb060, 0.5); fx.glow(p, big * 2.3, 0xffa040, 1, 0.5); fx.scorch(p, 2.2); fx.sparks(at, 24, { speed: 9, up: 8, life: 0.9 }); E.flash(0.18); E.jolt(0.6); sfx.boom(); };

  // ---- THE CHASER CONVOY ----
  function convoy() { const roads = new Set(E.roadCells.map((c) => c[0] + ',' + c[1])), cells = spots(9, 17), trucks = []; let hCd = 4; const line = own(new THREE.Mesh(lineG, ADD(0xff8a2a, 0.9))); line.visible = false; line.frustumCulled = false; line.renderOrder = 7; let hT = 0, hFrom = null;
    for (let i = 0; i < 4; i++) { const c = cells[(Math.random() * cells.length) | 0], w = W(c), g = makeChaseTruck(i === 0); g.position.set(w.x, 0, w.z); scene.add(g); trucks.push({ g, cell: c, to: c, prev: null, lead: i === 0, stun: 0, rest: rnd(3, 6), arrow: A.mkArrow(i === 0 ? '🎯' : '🚙', i === 0 ? '#ff8a2a' : '#9fe8ff') }); }
    const next = (t, px, pz) => { const [x, y] = t.cell; let best = null, bs = -1e9; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (!roads.has(k)) continue; const c = [x + dx, y + dy], w = W(c), s = Math.hypot(w.x - px, w.z - pz) + Math.random() * 1.5 - (t.prev && t.prev[0] === c[0] && t.prev[1] === c[1] ? 4 : 0); if (s > bs) { bs = s; best = c; } } return best || t.cell; };
    return { objs: trucks.map((t) => t.g), arrows: trucks.map((t) => t.arrow), pos: () => (trucks[0] || { g: { position: E.twObj.position } }).g.position, frac: () => trucks.length / 4,
      update(dt, px, pz, R) { for (let i = trucks.length - 1; i >= 0; i--) { const t = trucks[i], g = t.g, p = g.position, d = Math.hypot(px - p.x, pz - p.z); g.userData.dish.rotation.y += dt * 4;
          if (d < R * 0.7 + 0.8) { /* caught: up it goes */ trucks.splice(i, 1); const j = m.objs.indexOf(g); if (j >= 0) m.objs.splice(j, 1); t.arrow.remove(); if (t.lead) { line.visible = false; hT = 0; } if (E.tw) twisters.suck(g, E.tw); else drop(g); E.award(500, p, 'CHASER SWALLOWED'); E.grow(1.2); E.speedBurst(1.5); sfx.pickup(); if (trucks.length) E.popup(p.clone().setY(2), trucks.length + ' TO GO', '#ffd24a'); else beaten(p.clone()); continue; }
          t.stun -= dt; t.rest -= dt; if (t.stun > 0) { if (Math.random() < dt * 12) fx.sparks(V(p.x, 1.1, p.z), 2, { speed: 3, up: 3, life: 0.3 }); } else if (t.rest < -1.1) t.rest = rnd(4, 7); else if (t.rest > 0 && d < 15) { /* (they only run while the storm is near) */ const w = W(t.to), dx = w.x - p.x, dz = w.z - p.z, dd = Math.hypot(dx, dz); if (dd < 0.12) { t.prev = t.cell; t.cell = t.to; t.to = next(t, px, pz); } else { const st = Math.min(dd, (d < 7 ? 3.3 : 2.4) * dt); p.x += dx / dd * st; p.z += dz / dd * st; let dr = Math.atan2(dx, dz) - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 8); } }
          if (t.lead) { const gun = g.userData.gun; gun.rotation.y = Math.atan2(px - p.x, pz - p.z) - g.rotation.y; hCd -= dt; if (hCd <= 0 && d < 11 && t.stun <= 0) { hCd = 7; hT = 2.4; A.slow(2.4); E.popup(E.twObj.position, '🎯 HARPOONED! SLOWED', '#ff8a2a'); sfx.throw(); E.jolt(0.3); } if (hT > 0) { hT -= dt; hFrom = V(p.x, 1.2, p.z); const to = V(px, 1.5, pz); line.visible = true; line.position.copy(hFrom); line.lookAt(to); line.scale.set(0.06, 0.06, hFrom.distanceTo(to)); } else line.visible = false; }
          E.edgeArrow(t.arrow, p, true); } },
      tap(near) { for (const t of trucks) if (near(V(t.g.position.x, 0.8, t.g.position.z), 54)) { E.boltTo(V(t.g.position.x, 1, t.g.position.z)); t.stun = 2.6; E.popup(t.g.position, 'STUNNED! GRAB IT', '#ffd24a'); return true; } return false; },
      targets(out) { for (const t of trucks) out.push({ pos: t.g.position, zap: () => { E.boltTo(V(t.g.position.x, 1, t.g.position.z)); t.stun = 2.6; } }); }, dots(fn) { for (const t of trucks) fn(t.g.position, t.lead ? '🎯' : '🚙', '#ff8a2a'); } }; }

  // ---- THE SEEDER ----
  function seeder(hp) { const g = makeSeeder(), b = toWorld(E.cols - 1, E.cols - 1, E.cols, E.cols), a0 = Math.random() * 6.283, R0 = Math.max(b.x, b.z) + 9, arrow = A.mkArrow('✈', '#7dff8a'); g.position.set(Math.cos(a0) * R0, 7.5, Math.sin(a0) * R0); scene.add(g); let head = a0 + Math.PI, st = 'pass', t = 0, immune = 0, left = hp, to = null, sm = 0;
    const hit = () => { const p = g.position; E.boltTo(p.clone()); if (st === 'pass') { say(p.clone(), 'ITS SPRAY STOPS YOUR BOLT! WAIT TILL IT HAS PASSED'); return; } if (immune > 0) return; immune = 2.6; left--; fx.explode(p.clone(), 1.2); fx.sparks(p.clone(), 18, { c: [0xffe08a, 0xffffff], speed: 8, up: 4, life: 0.6 }); sfx.blast(); E.jolt(0.4); E.award(300, p, 'STRUCK');
      if (left > 0) { E.popup(p.clone(), '⚡ ' + left + ' TO GO', '#ffd24a'); return; } const q = p.clone(), i = m.objs.indexOf(g); if (i >= 0) m.objs.splice(i, 1); arrow.remove(); twisters.scatter([g], q.clone(), 7); boom(q.clone().setY(0), 2.4); beaten(q); };
    return { objs: [g], arrows: [arrow], pos: () => g.position, frac: () => left / hp,
      update(dt, px, pz, R) { const p = g.position; t += dt; immune -= dt; let tx, tz; const dS = Math.hypot(px - p.x, pz - p.z);
        if (st === 'pass') { /* straight at the storm, spraying; once it is over and gone the spray stops and it comes round again */ if (!to) { const dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz) || 1; to = V(px + dx / d * 11, 0, pz + dz / d * 11); } tx = to.x; tz = to.z; sm -= dt; if (sm <= 0) { sm = 0.05; fx.puff('smoke', V(p.x + rnd(-2.5, 2.5), p.y - 0.6, p.z + rnd(-1, 1)), 0.7); }
          if (dS < R * 0.6 + 3.2) { E.grow(-E.massTarget * 0.03 * dt); A.status('✈ SPRAYED! SHRINKING'); } if (Math.hypot(tx - p.x, tz - p.z) < 2 || t > 9) { st = 'turn'; t = 0; to = null; E.popup(p.clone(), '⚡ STRIKE IT NOW!', '#ffe14a'); } }
        else { const a = Math.atan2(p.z - pz, p.x - px) + 0.9; tx = px + Math.cos(a) * 15; tz = pz + Math.sin(a) * 15; if (t > 5) { st = 'pass'; t = 0; to = null; } }
        let dr = Math.atan2(tx - p.x, tz - p.z) - head; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); head += Math.max(-1, Math.min(1, dr)) * (st === 'pass' ? 1.8 : 1.1) * dt; const v = st === 'pass' ? 8.5 : 6.5; p.x += Math.sin(head) * v * dt; p.z += Math.cos(head) * v * dt; g.rotation.set(0, head, 0); g.rotateZ(-Math.max(-1, Math.min(1, dr)) * 0.4); for (const q of g.userData.props) q.rotation.z += dt * 40;
        if (left < hp && Math.random() < dt * 8 * (hp - left)) fx.puff('smoke', p, 0.8); E.edgeArrow(arrow, p, true); },
      tap(near) { if (near(g.position, 84)) { hit(); return true; } return false; }, targets(out) { out.push({ pos: g.position, zap: hit }); }, dots(fn) { fn(g.position, '✈', '#7dff8a'); } }; }

  // ---- THE WEATHER MACHINE ----
  function weather(hp) { const cells = spots(13, 21), c = cells[(Math.random() * cells.length) | 0], w = W(c), at = V(w.x, 0, w.z), g = makeWeatherTower(), u = g.userData, arrow = A.mkArrow('🗼', '#6ad8ff'); E.crashDamage(at.clone(), 4.6, V(0, 0, 1)); g.position.copy(at); scene.add(g); let tHp = hp, immune = 0, pushT = 0;
    const dome = own(new THREE.Mesh(new THREE.SphereGeometry(2.7, 18, 12), ADD(0x4ab4ff, 0.2))); dome.position.set(at.x, 1.6, at.z); dome.scale.y = 1.9; dome.renderOrder = 5;
    const pyl = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => { const pg = makePylon(); pg.position.set(at.x + sx * 3.3, 0, at.z + sz * 3.3); scene.add(pg); const line = own(new THREE.Mesh(lineG, ADD(0x6ad8ff, 0.7))); line.frustumCulled = false; line.renderOrder = 6; return { g: pg, hp: 2, line }; });
    const killP = (q, how) => { const i = pyl.indexOf(q); if (i < 0) return; pyl.splice(i, 1); scene.remove(q.line); const p = q.g.position.clone(), j = m.objs.indexOf(q.g); if (j >= 0) m.objs.splice(j, 1); if (how === 'crushed' && E.tw) twisters.suck(q.g, E.tw); else twisters.scatter([q.g], p.clone(), 6); boom(p, 1.6); E.award(400, p, 'PYLON'); if (pyl.length) E.popup(p.clone().setY(2.5), pyl.length + ' PYLON' + (pyl.length > 1 ? 'S' : '') + ' LEFT', '#ffd24a'); else { fx.shock(at, 7, 0x6ad8ff, 0.6); E.banner('🗼 ITS SHIELD IS DOWN!\nWRECK THE TOWER'); sfx.power(); } };
    const zapP = (q) => { const p = q.g.position; E.boltTo(V(p.x, 3.2, p.z)); q.hp--; if (q.hp <= 0) killP(q, 'zap'); else { fx.sparks(V(p.x, 3.2, p.z), 14, { speed: 6, up: 5, life: 0.5 }); E.popup(p, 'CRACKED! HIT IT AGAIN', '#ffd24a'); } };
    const end = (how) => { const q = at.clone(), j = m.objs.indexOf(g); if (j >= 0) m.objs.splice(j, 1); arrow.remove(); if (how === 'crushed' && E.tw) twisters.suck(g, E.tw); else twisters.scatter([g], q.clone(), 8); boom(q, 3); for (let k = 0; k < 4; k++) { const a = k * 1.57, o = V(q.x + Math.cos(a) * 1.6, 0.5, q.z + Math.sin(a) * 1.6); setTimeout(() => fx.explode(o, 1.3), 100 + k * 90); } beaten(q); };
    const zapT = () => { E.boltTo(V(at.x, 5.9, at.z)); if (pyl.length) { say(at.clone().setY(6), '🛡 SHIELDED! WRECK THE PYLONS FIRST'); return; } if (immune > 0) return; immune = 0.8; tHp--; fx.explode(V(at.x, 5.9, at.z), 1.1); fx.sparks(V(at.x, 5.9, at.z), 18, { c: [0x9fe8ff, 0xffffff], speed: 8, up: 4, life: 0.6 }); sfx.blast(); E.jolt(0.4); if (tHp <= 0) end('zap'); else E.popup(at.clone().setY(6.5), '⚡ ' + tHp + ' TO GO', '#ffd24a'); };
    return { objs: [g, ...pyl.map((q) => q.g)], arrows: [arrow], pos: () => at, frac: () => (pyl.reduce((s, q) => s + q.hp, 0) + Math.max(0, tHp)) / (8 + hp),
      update(dt, px, pz, R) { const d = Math.hypot(px - at.x, pz - at.z) || 1; immune -= dt; pushT -= dt; u.ring.rotation.y += dt * 2.2; u.ring.rotation.x += dt * 0.7; u.coreM.color.setRGB(0.42 + Math.sin(E.played * 9) * 0.2, 0.85, 1); dome.visible = pyl.length > 0; dome.material.opacity = 0.16 + Math.sin(E.played * 5) * 0.05;
        E.grow(-E.massTarget * (0.0022 + 0.001 * pyl.length) * dt); if (d < 30) A.status('🗼 THE WEATHER MACHINE IS SHRINKING YOU');
        for (const q of pyl.slice()) { const p = q.g.position; q.g.userData.orb.scale.setScalar(0.6 * (1 + Math.sin(E.played * 8 + p.x) * 0.15)); q.line.position.set(p.x, 3.3, p.z); q.line.lookAt(at.x, 5.9, at.z); q.line.scale.set(0.07 + Math.random() * 0.04, 0.07, Math.hypot(p.x - at.x, 2.6, p.z - at.z)); if (Math.hypot(px - p.x, pz - p.z) < R * 0.6 + 0.7) killP(q, 'crushed'); }
        if (pyl.length) { if (d < R * 0.6 + 2.9 && pushT <= 0) { pushT = 1; A.kick.set((px - at.x) / d * 15, 0, (pz - at.z) / d * 15); E.grow(-E.massTarget * 0.012); E.popup(E.twObj.position, 'REPELLED! -SIZE', '#6ad8ff'); fx.shock(at, 6, 0x6ad8ff, 0.5); sfx.hurt(); E.jolt(0.5); } }
        else if (d < R * 0.6 + 1.2) { end('crushed'); return; } E.edgeArrow(arrow, at, true); },
      tap(near) { for (const q of pyl) if (near(V(q.g.position.x, 2.2, q.g.position.z), 54)) { zapP(q); return true; } if (near(V(at.x, 4, at.z), 74)) { zapT(); return true; } return false; },
      targets(out) { for (const q of pyl) out.push({ pos: q.g.position, zap: () => zapP(q) }); if (!pyl.length) out.push({ pos: at, zap: zapT }); }, dots(fn) { fn(at, '🗼', '#6ad8ff'); for (const q of pyl) fn(q.g.position, '⚡', '#6ad8ff'); } }; }

  const MAKE = { convoy, seeder, weather };
  function start(key, hp) { clear(); if (!MAKE[key]) return null; const o = MAKE[key](hp); m = Object.assign(o, { key, live: true, t: 0, sayT: -9 }); return m; }
  function update(dt, px, pz, R) { if (!m) return; if (!m.live) { m.t += dt; if (m.t > 4) clear(); return; } m.update(dt, px, pz, R); }
  function leave() { if (!m || !m.live) return; for (const o of m.objs) fx.puff('smoke', o.position.clone().setY(1), 2); clear(); }
  return { start, update, clear, leave, tap: (near) => (live() ? m.tap(near) : false), targets: (out) => { if (live()) m.targets(out); }, eachDot: (fn) => { if (live()) m.dots(fn); }, frac: () => (m ? m.frac() : 0), pos: () => (m ? m.pos() : null), get m() { return m; } };
}
