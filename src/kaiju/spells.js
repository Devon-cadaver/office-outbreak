// Kaiju Madness: the spells. Each kaiju has three, one per size stage, cast at a spot (or a target) when its Power bar
// is full. The game hands in env: { scene, fx, sfx, hitArea(c, r, pow, opts), flash(k), grabCar(at), grabBuilding(at),
// leap(caster, to, secs, onLand) }. opts.hostile marks a rival's spell (it only hurts the player). Effects run in
// update(dt) until they're done.
import * as THREE from 'three';

const sphere = new THREE.SphereGeometry(0.5, 10, 8), cylG = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), boxG = new THREE.BoxGeometry(1, 1, 1), coneG = new THREE.ConeGeometry(0.5, 1, 8);
const glowCache = new Map(); const glow = (c, o = 1) => { const k = c + '|' + o; if (!glowCache.has(k)) glowCache.set(k, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); return glowCache.get(k); };
const solid = new Map(); const sol = (c) => { if (!solid.has(c)) solid.set(c, new THREE.MeshLambertMaterial({ color: c })); return solid.get(c); };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

export function createSpells(env) {
  const { scene, fx, sfx } = env; const live = [];
  const add = (e) => { live.push(e); return e; };
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
    const g = new THREE.Group(); const outer = new THREE.Mesh(cylG, glow(color, 0.55)), core = new THREE.Mesh(cylG, glow(0xffffff, 0.9)); g.add(outer, core); scene.add(g);
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
  };
  return {
    cast(caster, stage, at, opts = {}) { const fn = SP[caster.id] && SP[caster.id][Math.max(0, Math.min(2, stage - 1))]; if (!fn) return; caster.rig.act('cast'); fn(caster, at.clone(), opts); },
    update(dt) { for (let i = live.length - 1; i >= 0; i--) if (!live[i].update(dt)) live.splice(i, 1); },
    clear() { live.length = 0; },
  };
}
