// Kaiju Madness: the spells. Each kaiju has three, one per size stage, cast at a spot (or a target) when its Power bar
// is full. The game hands in env: { scene, fx, sfx, hitArea(c, r, pow, opts), flash(k), grabCar(at), grabBuilding(at),
// leap(caster, to, secs, onLand) }. opts.hostile marks a rival's spell (it only hurts the player). Effects run in
// update(dt) until they're done.
import * as THREE from 'three';
import { KAIJU } from './rigs.js';

const sphere = new THREE.SphereGeometry(0.5, 10, 8), cylG = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), boxG = new THREE.BoxGeometry(1, 1, 1), coneG = new THREE.ConeGeometry(0.5, 1, 8);
// spell tint: a skinned kaiju or a robot casts in its own colour. While a spell (or anything it set off later) runs,
// every glow and bolt takes the tint; beam cores stay white
let tint = null;
const glowCache = new Map(); const glow = (c0, o = 1) => { const c = tint != null && c0 !== 0xfffffe ? tint : c0; const k = c + '|' + o; if (!glowCache.has(k)) glowCache.set(k, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); return glowCache.get(k); };
const solid = new Map(); const sol = (c) => { if (!solid.has(c)) solid.set(c, new THREE.MeshLambertMaterial({ color: c })); return solid.get(c); };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

export function createSpells(env) {
  const later = (t, f) => () => { const p = tint; tint = t; try { return f(); } finally { tint = p; } };
  const setTimeout = (f, ms) => window.setTimeout(later(tint, f), ms);
  const { scene, fx, sfx } = env; const live = [];
  const add = (e) => { if (tint != null) { const u = e.update.bind(e), t = tint; e.update = (dt) => later(t, () => u(dt))(); } live.push(e); return e; };
  const wp = (o) => o.getWorldPosition(new THREE.Vector3());
  // ---------- building blocks ----------
  // a glowing ball that flies (straight or lobbed) and pops on arrival
  function shot({ from, to, color, size = 0.5, arc = 0, speed = 18, trail = true, onHit, mesh }) {
    const m = mesh || new THREE.Mesh(sphere, glow(color, 0.95)); if (!mesh) m.scale.setScalar(size); m.position.copy(from); scene.add(m);
    const d = from.distanceTo(to), T = Math.max(0.15, d / speed); let t = 0;
    return add({ update(dt) { t += dt; const k = Math.min(1, t / T); m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * arc; if (mesh) { m.rotation.x += dt * 9; m.rotation.z += dt * 7; }
      if (trail && Math.random() < dt * 40) fx.puff(color === 0xffffff || mesh ? 'smoke' : 'flame', m.position.clone(), size * 0.6);
      if (k >= 1) { scene.remove(m); onHit && onHit(to.clone()); return false; } return true; } });
  }
  // a beam between two points (a glowing tube with a white core) that fades after `life`
  function beam({ from, to, color, width = 0.5, life = 0.6, wobble = 0 }) {
    const g = new THREE.Group(); const outer = new THREE.Mesh(cylG, glow(color, 0.55)), core = new THREE.Mesh(cylG, glow(0xfffffe, 0.9)); g.add(outer, core); scene.add(g);
    const place = () => { const d = from.distanceTo(to); g.position.copy(from).add(to).multiplyScalar(0.5); g.quaternion.setFromUnitVectors(up, v1.copy(to).sub(from).normalize()); outer.scale.set(width, d, width); core.scale.set(width * 0.38, d, width * 0.38); };
    let t = 0; place(); return add({ update(dt) { t += dt; const k = 1 - t / life; const w = 1 + Math.sin(t * 40) * 0.12 + wobble * Math.sin(t * 7); outer.scale.x = outer.scale.z = width * w * Math.max(0.2, k); core.scale.x = core.scale.z = width * 0.38 * Math.max(0.2, k);
      if (t >= life) { scene.remove(g); return false; } return true; } });
  }
  // an expanding ring on the ground
  function ring({ at, color, r0 = 0.5, r1 = 5, life = 0.6 }) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), glow(color, 0.85)); m.rotation.x = -Math.PI / 2; m.position.copy(at).setY(0.15); scene.add(m); let t = 0;
    return add({ update(dt) { t += dt; const k = t / life; m.scale.setScalar(r0 + (r1 - r0) * k); m.material = glow(color, Math.max(0, 0.85 * (1 - k))); if (k >= 1) { scene.remove(m); m.geometry.dispose(); return false; } return true; } });
  }
  function blast(at, r, pow, color, opts) { env.hitArea(at, r, pow, opts); fx.explode(at.clone().setY(0.6), Math.min(3.5, r * 0.45)); ring({ at, color, r1: r, life: 0.5 }); sfx.boom(); env.flash(Math.min(0.3, r * 0.04)); }
  // a lingering cloud that keeps hurting what's inside
  function cloud({ at, r, life, color, pow, every = 0.5, opts, sparkle }) {
    const g = new THREE.Group(); g.position.copy(at); scene.add(g); const bits = [];
    for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(sphere, glow(sparkle ? [0xffd24a, 0xff8ad8, 0x9ad8ff, 0xffffff][i % 4] : color, sparkle ? 0.9 : 0.35)); const s = sparkle ? 0.18 + Math.random() * 0.2 : 1 + Math.random() * 1.4; m.scale.setScalar(s); g.add(m); bits.push({ m, a: Math.random() * 6.28, rr: Math.random() * r, y: 0.5 + Math.random() * 2.5, sp: 0.6 + Math.random() }); }
    let t = 0, tick = 0; return add({ update(dt) { t += dt; tick -= dt; for (const b of bits) { b.a += dt * b.sp; b.m.position.set(Math.cos(b.a) * b.rr, b.y + Math.sin(t * 2 + b.a) * 0.3, Math.sin(b.a) * b.rr); }
      if (tick <= 0) { tick = every; env.hitArea(at, r, pow, opts); } g.scale.setScalar(Math.min(1, t * 3) * Math.min(1, (life - t) * 2 + 0.01));
      if (t >= life) { scene.remove(g); return false; } return true; } });
  }
  // a lightning bolt from the clouds down to a point
  function bolt(to, color = 0xfff2a0) { const pts = []; let x = to.x + (Math.random() - 0.5) * 3, z = to.z + (Math.random() - 0.5) * 3; for (let y = 22; y > 0.3; y -= 2) { pts.push(new THREE.Vector3(x, y, z)); x += (to.x - x) * 0.3 + (Math.random() - 0.5) * 1.2; z += (to.z - z) * 0.3 + (Math.random() - 0.5) * 1.2; } pts.push(to.clone().setY(0.1));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: tint ?? color })); scene.add(l); let t = 0; add({ update(dt) { t += dt; l.visible = Math.random() < 0.85; if (t > 0.25) { scene.remove(l); l.geometry.dispose(); return false; } return true; } }); }
  // several things over a few seconds, spread over an area
  function rain(at, r, n, secs, fn) { let i = 0, t = 0; add({ update(dt) { t += dt; while (i < n && t >= (i / n) * secs) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r; fn(at.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr)), i); i++; } return i < n; } }); }
  // small minions that scuttle along the ground to the spot and pop
  function swarm(from, at, n, mk, r, pow, color, o) { for (let i = 0; i < n; i++) { const m = mk(); const to = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4)); const st = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)).setY(0.2);
    shot({ from: st, to: to.setY(0.2), mesh: m, arc: 0.3, speed: 7 + Math.random() * 3, trail: false, onHit: (p) => { env.hitArea(p, r, pow, o); fx.puff('smoke', p.clone().setY(0.3), 0.5); ring({ at: p, color, r1: r, life: 0.3 }); } }); } }
  // a ground pound around the caster
  function quake(c, r, pow, color, o) { const at = wp(c.g).setY(0); for (let i = 0; i < 3; i++) setTimeout(() => ring({ at, color, r0: 0.5, r1: r * (0.6 + i * 0.25), life: 0.5 }), i * 120); env.hitArea(at, r, pow, o); for (let i = 0; i < 8; i++) fx.puff('smoke', at.clone().add(new THREE.Vector3((Math.random() - 0.5) * r, 0.4, (Math.random() - 0.5) * r)), 1.2); sfx.boom(); env.flash(0.15); }
  // a bright flash around the caster: stuns and burns
  function flashAt(c, r, pow, color, o) { const at = wp(c.g).setY(0); const m = new THREE.Mesh(sphere, glow(color, 0.8)); m.position.copy(at).setY(1.5); scene.add(m); let t = 0; add({ update(dt) { t += dt; m.scale.setScalar(1 + t * r * 2.2); m.material = glow(color, Math.max(0, 0.8 - t * 1.6)); if (t > 0.5) { scene.remove(m); return false; } return true; } }); env.hitArea(at, r, pow, { ...o, freeze: true }); env.flash(0.35); sfx.boom(); }
  // a charge to the spot that flattens everything on the way
  function charge(c, at, secs, h, w, pow, color, o, end) { const to = clampTo(wp(c.g), at, 16).setY(0); env.leap(c, to, secs, () => { if (end) end(to); }, h, (p) => { env.hitArea(p, w, pow, o); if (Math.random() < 0.6) fx.puff('smoke', p.clone().setY(0.3), 0.7); }); sfx.whoosh(); if (o.hostile) env.hitArea(to, w, pow * 3, o); }
  // several points along a line
  function line(from, to, n, w, pow, o) { for (let i = 1; i <= n; i++) env.hitArea(from.clone().lerp(to, i / n).setY(0), w, pow, o); }
  const crystal = (c = 0xd0a8ff) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), glow(c, 0.95)); m.scale.set(0.5, 1, 0.5); return m; };
  const bug = (c) => () => { const m = new THREE.Mesh(sphere, sol(c)); m.scale.set(0.35, 0.2, 0.45); return m; };
  const mouthOf = (c) => wp(c.rig.mouth), handOf = (c) => wp(c.rig.hand), chestOf = (c) => wp(c.rig.chest);
  const clampTo = (from, to, max) => { const d = v2.copy(to).sub(from); d.y = 0; const l = d.length(); return l > max ? from.clone().addScaledVector(d.normalize(), max).setY(to.y) : to.clone(); };

  // ---------- the spells: [hatchling, titan, colossus] ----------
  const SP = {
    godzilly: [
      (c, at, o) => { shot({ from: mouthOf(c), to: at, color: 0x4ab8ff, size: 0.8, arc: 3, speed: 16, onHit: (p) => blast(p, 2.6, 26, 0x4ab8ff, { ...o, fire: true }) }); sfx.whoosh(); },
      (c, at, o) => { const from = mouthOf(c), to = clampTo(from, at, 16).setY(0.4); beam({ from, to, color: 0x4ab8ff, width: 0.7, life: 1.0 }); for (let i = 1; i <= 8; i++) { const p = from.clone().lerp(to, i / 8).setY(0); env.hitArea(p, 1.4, 6, { ...o, fire: true }); } fx.explode(to.clone(), 1.2); sfx.boom(); env.flash(0.15); },
      (c, at, o) => { env.leap(c, at, 0.75, () => { blast(at, 6.5, 62, 0x4ab8ff, o); ring({ at, color: 0xffffff, r1: 8, life: 0.8 }); }); sfx.whoosh(); },
    ],
    konk: [
      (c, at, o) => { const car = o.hostile ? null : env.grabCar(wp(c.g)); let mesh = car; if (!mesh) { mesh = new THREE.Mesh(boxG, sol(0x6a6a70)); mesh.scale.set(0.9, 0.6, 0.9); } mesh.position.copy(handOf(c)); scene.add(mesh);
        shot({ from: handOf(c), to: at, mesh, arc: 4, speed: 14, onHit: (p) => { blast(p, 2.4, 24, 0xff8a3a, o); scene.remove(mesh); } }); },
      (c, at, o) => { const from = wp(c.g).setY(0.3), dir = v2.copy(at).sub(from).setY(0).normalize(); for (let i = 1; i <= 4; i++) { const p = from.clone().addScaledVector(dir, i * 2.4); env.hitArea(p, 1.2 + i * 0.6, 9, { ...o, push: dir.clone() }); ring({ at: p, color: 0xffb06a, r0: 0.4, r1: 1.4 + i * 0.7, life: 0.35 + i * 0.08 }); } sfx.boom(); env.flash(0.12); },
      (c, at, o) => { const b = o.hostile ? null : env.grabBuilding(wp(c.g)); let mesh = b; if (!mesh) { mesh = new THREE.Mesh(boxG, sol(0x5a6a7c)); mesh.scale.set(2, 3.4, 2); } mesh.position.copy(handOf(c)).setY(handOf(c).y + 1); scene.add(mesh);
        shot({ from: mesh.position.clone(), to: at, mesh, arc: 6, speed: 12, onHit: (p) => { blast(p, 5.5, 58, 0xff8a3a, o); scene.remove(mesh); } }); },
    ],
    mofra: [
      (c, at, o) => { const from = wp(c.g).setY(0.5), dir = v2.copy(at).sub(from).setY(0).normalize(); for (let i = 1; i <= 4; i++) { const p = from.clone().addScaledVector(dir, i * 2.2); env.hitArea(p, 1 + i * 0.5, 6, { ...o, push: dir.clone() }); for (let k = 0; k < 3; k++) fx.puff('smoke', p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5 + Math.random(), (Math.random() - 0.5) * 2)), 0.6); } sfx.whoosh(); },
      (c, at, o) => { cloud({ at, r: 4, life: 6, color: 0xffd24a, pow: 4, every: 0.5, opts: o, sparkle: true }); sfx.wave(); },
      (c, at, o) => { const m0 = mouthOf(c); for (const [dx, col] of [[-0.4, 0xff5a8a], [0.4, 0x5ad8ff]]) beam({ from: m0.clone().add(new THREE.Vector3(dx, 0.2, 0)), to: clampTo(m0, at, 18).setY(0.4), color: col, width: 0.55, life: 1.1, wobble: 0.3 });
        beam({ from: m0, to: clampTo(m0, at, 18).setY(0.4), color: 0xffd24a, width: 0.35, life: 1.1 }); const to = clampTo(m0, at, 18); for (let i = 1; i <= 9; i++) env.hitArea(m0.clone().lerp(to, i / 9).setY(0), 1.6, 6, o); fx.explode(to.clone().setY(0.5), 1.4); sfx.boom(); env.flash(0.15); },
    ],
    mecha: [
      (c, at, o) => { for (const dx of [-0.6, 0.6]) { const fist = new THREE.Mesh(boxG, sol(0x9aa2ac)); fist.scale.set(0.5, 0.5, 0.7); const from = handOf(c).add(new THREE.Vector3(dx, 0, 0)); shot({ from, to: at.clone().add(new THREE.Vector3(dx, 0, 0)), mesh: fist, arc: 0.6, speed: 22, onHit: (p) => blast(p, 1.9, 14, 0xff6a2a, o) }); } sfx.whoosh(); },
      (c, at, o) => { const from = wp(c.g); from.y += 2.2 * c.g.scale.y / 2; for (let i = 0; i < 8; i++) { const to = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)); const ms = new THREE.Mesh(coneG, sol(0xd8dde0)); ms.scale.set(0.25, 0.7, 0.25);
        setTimeout(() => shot({ from: from.clone(), to, mesh: ms, arc: 5 + Math.random() * 3, speed: 13, onHit: (p) => blast(p, 1.6, 8, 0xffb02a, o) }), i * 90); } sfx.whoosh(); },
      (c, at, o) => { const from = chestOf(c), to = clampTo(from, at, 18).setY(0.5); beam({ from, to, color: 0x7af0ff, width: 0.8, life: 0.8 }); setTimeout(() => { env.hitArea(to.clone().setY(0), 5, 46, { ...o, freeze: true }); ring({ at: to, color: 0xbff8ff, r1: 6, life: 0.7 }); fx.puff('smoke', to.clone().setY(1), 2.4); sfx.boom(); env.flash(0.2); }, 600); },
    ],
    rodanny: [
      (c, at, o) => charge(c, at, 0.55, 2.5, 1.4, 6, 0xff6a3a, o, (p) => blast(p, 2.4, 22, 0xff6a3a, o)),
      (c, at, o) => { const from = wp(c.g).setY(0), to = clampTo(from, at, 18); line(from, to, 9, 1.5, 7, o); for (let i = 1; i <= 6; i++) setTimeout(() => ring({ at: from.clone().lerp(to, i / 6), color: 0xffffff, r1: 2.5, life: 0.35 }), i * 50); sfx.boom(); env.flash(0.12); },
      (c, at, o) => { cloud({ at, r: 3.2, life: 6, color: 0xff6a1a, pow: 6, every: 0.4, opts: { ...o, fire: true } }); for (let i = 0; i < 20; i++) setTimeout(() => fx.ignite(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0.3, (Math.random() - 0.5) * 4)), 0.8, 3), i * 150); sfx.whoosh(); },
    ],
    giggle: [
      (c, at, o) => { bolt(at); blast(at, 2.2, 20, 0xffe27a, o); },
      (c, at, o) => { for (let i = 0; i < 3; i++) setTimeout(() => { const p = at.clone().add(new THREE.Vector3((i - 1) * 2.2, 0, (Math.random() - 0.5) * 2)); bolt(p); blast(p, 2.2, 16, 0xffe27a, o); }, i * 120); },
      (c, at, o) => rain(at, 6.5, 14, 2.6, (p) => { bolt(p); blast(p, 1.9, 10, 0xffe27a, o); }),
    ],
    lobstirah: [
      (c, at, o) => { const p = clampTo(wp(c.g), at, 7).setY(0); blast(p, 1.9, 26, 0xff5a3a, o); },
      (c, at, o) => { const from = mouthOf(c), to = clampTo(from, at, 16).setY(0.4); beam({ from, to, color: 0x9ad8ff, width: 0.6, life: 0.8 }); line(from, to, 8, 1.3, 6, o); for (let i = 0; i < 6; i++) fx.puff('smoke', to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.3, (Math.random() - 0.5) * 2)), 0.8); sfx.whoosh(); },
      (c, at, o) => { const from = wp(c.g).setY(0), dir = v2.copy(at).sub(from).setY(0).normalize(); for (let i = 1; i <= 5; i++) setTimeout(() => { const p = from.clone().addScaledVector(dir, i * 2.4); env.hitArea(p, 1.6 + i * 0.4, 8, o); ring({ at: p, color: 0xff8a6a, r1: 2 + i * 0.5, life: 0.5 }); for (let k = 0; k < 4; k++) fx.puff('smoke', p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.4, (Math.random() - 0.5) * 3)), 1); }, i * 110); sfx.wave(); },
    ],
    angryrus: [
      (c, at, o) => { for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(coneG, sol(0xe8d8a0)); sp.scale.set(0.25, 0.7, 0.25); shot({ from: wp(c.g).setY(1.4), to: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)), mesh: sp, arc: 3, speed: 15, trail: false, onHit: (p) => blast(p, 1.4, 9, 0xe8d8a0, o) }); } sfx.whoosh(); },
      (c, at, o) => charge(c, at, 0.7, 0.4, 1.9, 6, 0xc8b890, o, (p) => blast(p, 2.6, 18, 0xc8b890, o)),
      (c, at, o) => quake(c, 6.5, 52, 0xffb06a, o),
    ],
    grammera: [
      (c, at, o) => shot({ from: mouthOf(c), to: at, color: 0xff8a2a, size: 0.8, arc: 2.5, speed: 16, onHit: (p) => blast(p, 2.3, 24, 0xff8a2a, { ...o, fire: true }) }),
      (c, at, o) => charge(c, at, 0.8, 0.6, 2.1, 7, 0x9ad87a, o, (p) => ring({ at: p, color: 0x9ad87a, r1: 3, life: 0.4 })),
      (c, at, o) => charge(c, at, 1.0, 2.5, 2.2, 8, 0xff6a1a, { ...o, fire: true }, (p) => blast(p, 3.2, 22, 0xff6a1a, { ...o, fire: true })),
    ],
    destroyah: [
      (c, at, o) => { const from = mouthOf(c), to = clampTo(from, at, 8).setY(0.5); beam({ from, to, color: 0xff3aa8, width: 0.45, life: 0.4 }); line(from, to, 5, 1.2, 9, o); sfx.hit(); },
      (c, at, o) => { const from = mouthOf(c), to = clampTo(from, at, 17).setY(0.4); beam({ from, to, color: 0xb83aff, width: 0.75, life: 1.1 }); line(from, to, 9, 1.5, 7, { ...o, fire: true }); fx.explode(to.clone(), 1.2); sfx.boom(); env.flash(0.15); },
      (c, at, o) => swarm(wp(c.g), at, 9, bug(0xc23b2b), 1.3, 7, 0xff3a3a, o),
    ],
    biolettuce: [
      (c, at, o) => { const from = mouthOf(c), to = clampTo(from, at, 11).setY(0.3); beam({ from, to, color: 0x5ad83a, width: 0.3, life: 0.5 }); line(from, to, 6, 1.1, 8, o); sfx.hit(); },
      (c, at, o) => { cloud({ at, r: 4, life: 5, color: 0x9ad83a, pow: 5, every: 0.5, opts: o }); rain(at, 4, 16, 2.5, (p) => fx.puff('smoke', p.clone().setY(2.5), 0.4)); sfx.wave(); },
      (c, at, o) => { const g = new THREE.Group(); g.position.copy(at); scene.add(g); for (let i = 0; i < 8; i++) { const pe = new THREE.Mesh(coneG, sol(0xc23b3b)); pe.scale.set(1.2, 3, 0.5); pe.position.set(Math.cos(i * 0.785) * 1.2, 0, Math.sin(i * 0.785) * 1.2); pe.rotation.z = Math.cos(i * 0.785) * -0.5; pe.rotation.x = Math.sin(i * 0.785) * 0.5; g.add(pe); }
        let t = 0; add({ update(dt) { t += dt; g.scale.setScalar(Math.min(1.6, t * 3)); g.position.y = Math.min(0, -3 + t * 8); if (t > 0.6 && !g.userData.bit) { g.userData.bit = 1; blast(at, 5.2, 55, 0xff5a8a, o); } if (t > 1.6) { g.scale.setScalar(Math.max(0.01, 1.6 - (t - 1.6) * 4)); } if (t > 2) { scene.remove(g); return false; } return true; } }); sfx.wave(); },
    ],
    spaceyzilla: [
      (c, at, o) => shot({ from: mouthOf(c), to: at, mesh: crystal(), arc: 1.5, speed: 18, onHit: (p) => blast(p, 2.2, 22, 0xd0a8ff, o) }),
      (c, at, o) => { for (let i = 0; i < 5; i++) setTimeout(() => { const a = i * 1.257, p = at.clone().add(new THREE.Vector3(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2)); const m = crystal(); m.position.copy(p); m.scale.set(1.2, 0.1, 1.2); scene.add(m); let t = 0; add({ update(dt) { t += dt; m.scale.y = Math.min(3, t * 12); m.position.y = m.scale.y / 2; if (t > 2.5) { scene.remove(m); return false; } return true; } }); blast(p, 1.7, 11, 0xd0a8ff, o); }, i * 90); },
      (c, at, o) => { const from = mouthOf(c), to = clampTo(from, at, 18).setY(0.4); for (const col of [0xd0a8ff, 0x7af0ff]) beam({ from, to, color: col, width: 0.65, life: 1.2, wobble: 0.6 }); line(from, to, 9, 1.6, 7, o); fx.explode(to.clone(), 1.4); sfx.boom(); env.flash(0.18); },
    ],
    megalawn: [
      (c, at, o) => charge(c, at, 0.6, 0.2, 1.6, 8, 0xb8c0c8, o, (p) => blast(p, 1.8, 10, 0xb8c0c8, o)),
      (c, at, o) => { const to = clampTo(wp(c.g), at, 15).setY(0); env.leap(c, to, 0.9, () => { blast(to, 3.6, 34, 0xc8a050, o); for (let i = 0; i < 10; i++) fx.puff('smoke', to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0.5, (Math.random() - 0.5) * 4)), 1.3); }, 0, null, true); sfx.whoosh(); if (o.hostile) blast(to, 3.6, 34, 0xc8a050, o); },
      (c, at, o) => { for (let i = 0; i < 4; i++) setTimeout(() => { const p = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)); bolt(p, 0xffe27a); blast(p, 1.9, 12, 0xffe27a, o); }, i * 110); },
    ],
    smogorah: [
      (c, at, o) => shot({ from: mouthOf(c), to: at, color: 0x8a9a3a, size: 0.9, arc: 3, speed: 13, onHit: (p) => blast(p, 2.3, 20, 0x8ac83a, o) }),
      (c, at, o) => { cloud({ at, r: 4.5, life: 6, color: 0x6a7a5a, pow: 5, every: 0.5, opts: o }); sfx.wave(); },
      (c, at, o) => rain(at, 6, 12, 2.4, (p) => { const d = new THREE.Mesh(sphere, glow(0x8ac83a, 0.9)); d.scale.setScalar(0.4); shot({ from: p.clone().setY(9), to: p, mesh: d, speed: 18, trail: false, onHit: (q) => blast(q, 1.7, 9, 0x8ac83a, o) }); }),
    ],
    varoom: [
      (c, at, o) => quake(c, 3.2, 22, 0x9ad87a, o),
      (c, at, o) => { const to = clampTo(wp(c.g), at, 15).setY(0); env.leap(c, to, 0.85, () => blast(to, 3.6, 34, 0xd89a2a, o), 3.5); sfx.whoosh(); if (o.hostile) blast(to, 3.6, 34, 0xd89a2a, o); },
      (c, at, o) => flashAt(c, 7, 30, 0xffe8a0, o),
    ],
    gabbera: [
      (c, at, o) => { const from = wp(c.g).setY(0.5), dir = v2.copy(at).sub(from).setY(0).normalize(); for (let i = 1; i <= 3; i++) { const p = from.clone().addScaledVector(dir, i * 2.3); bolt(p, 0xfff27a); env.hitArea(p, 1.4 + i * 0.4, 9, o); } sfx.boom(); },
      (c, at, o) => { const to = clampTo(wp(c.g), at, 14).setY(0); env.leap(c, to, 0.8, () => { blast(to, 3.6, 34, 0xffe27a, o); bolt(to, 0xfff27a); }, 4.5); sfx.whoosh(); if (o.hostile) blast(to, 3.6, 34, 0xffe27a, o); },
      (c, at, o) => { let t = 0, tick = 0; add({ update(dt) { t += dt; tick -= dt; if (tick <= 0) { tick = 0.45; const ctr = wp(c.g).setY(0); env.hitArea(ctr, 4, 6, o); for (let i = 0; i < 2; i++) bolt(ctr.clone().add(new THREE.Vector3((Math.random() - 0.5) * 7, 0, (Math.random() - 0.5) * 7)), 0xfff27a); } return t < 5; } }); sfx.boom(); },
    ],
    kumbunga: [
      (c, at, o) => shot({ from: mouthOf(c), to: at, color: 0xffffff, size: 0.7, arc: 1.5, speed: 16, onHit: (p) => { blast(p, 2, 14, 0xffffff, { ...o, freeze: true }); } }),
      (c, at, o) => { cloud({ at, r: 5, life: 6, color: 0xf0f0f0, pow: 4, every: 0.6, opts: { ...o, freeze: true } }); ring({ at, color: 0xffffff, r1: 5, life: 0.8 }); sfx.wave(); },
      (c, at, o) => swarm(wp(c.g), at, 14, bug(0x1e1a14), 1.2, 6, 0xe8b82a, o),
    ],
    jirassic: [
      (c, at, o) => flashAt(c, 4.2, 18, 0x9ab8ff, o),
      (c, at, o) => { const p = at.clone(); const col = new THREE.Mesh(cylG, glow(0x9ad8ff, 0.75)); col.position.copy(p); scene.add(col); let t = 0; add({ update(dt) { t += dt; col.scale.set(1.2, Math.min(8, t * 30), 1.2); col.position.y = col.scale.y / 2; if (t > 0.9) { scene.remove(col); return false; } return true; } }); blast(p, 2.6, 28, 0x9ad8ff, o); },
      (c, at, o) => charge(c, at, 1.0, 0.3, 2.3, 9, 0x9ab8ff, o, (p) => blast(p, 2.6, 16, 0x9ab8ff, o)),
    ],
    geezora: [
      (c, at, o) => shot({ from: mouthOf(c), to: at, color: 0x111111, size: 0.8, arc: 2, speed: 14, onHit: (p) => { cloud({ at: p, r: 3, life: 3, color: 0x111118, pow: 4, every: 0.5, opts: o }); blast(p, 1.8, 8, 0x5a3a8a, o); } }),
      (c, at, o) => quake(c, 5.2, 40, 0xa88ac8, o),
      (c, at, o) => { cloud({ at, r: 5, life: 4, color: 0xbff0ff, pow: 8, every: 0.5, opts: { ...o, freeze: true } }); ring({ at, color: 0xbff8ff, r1: 6, life: 0.7 }); sfx.wave(); },
    ],
    battra: [
      (c, at, o) => charge(c, at, 0.55, 1.5, 1.8, 8, 0xe8b82a, o, (p) => blast(p, 2.1, 15, 0xe8b82a, o)),
      (c, at, o) => { const m0 = mouthOf(c), to = clampTo(m0, at, 18).setY(0.4); for (const [dx, col] of [[-0.3, 0xff3a2a], [0.3, 0xe8b82a]]) beam({ from: m0.clone().add(new THREE.Vector3(dx, 0, 0)), to, color: col, width: 0.5, life: 1.0 }); line(m0, to, 9, 1.5, 6, o); fx.explode(to.clone(), 1.2); sfx.boom(); },
      (c, at, o) => { if (env.dark) env.dark(2.6); rain(at, 7, 10, 2.2, (p) => { bolt(p, 0xb85aff); blast(p, 1.9, 11, 0x8a3aff, o); }); },
    ],
  };
  // robots borrow other monsters' effects under their own names
  for (const id in KAIJU) if (KAIJU[id].borrow) SP[id] = KAIJU[id].borrow.map(([src, i]) => SP[src][i]);
  return {
    cast(caster, stage, at, opts = {}) { const fn = SP[caster.id] && SP[caster.id][Math.max(0, Math.min(2, stage - 1))]; if (!fn) return; caster.rig.act('cast'); later(caster.rig.tint ?? null, () => fn(caster, at.clone(), opts))(); },
    update(dt) { for (let i = live.length - 1; i >= 0; i--) if (!live[i].update(dt)) live.splice(i, 1); },
    clear() { live.length = 0; },
  };
}
