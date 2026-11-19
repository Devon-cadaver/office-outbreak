// Fires, explosions, smoke, dust, sparks and scorch marks. Every particle is a soft-edged blob (no texture: the shape is
// worked out in the shader) and they are all drawn in a handful of batches, so a big blast costs a phone no more draw
// calls than a small one: two batches that face the camera (glowing, and smoky), two that lie on the ground (light and
// shockwaves, and scorch marks) and one of tumbling solid bits. Same calls as the old cube particles, plus a few new ones.
import * as THREE from 'three';

const VERT = `
attribute vec3 iPos; attribute vec4 iCol; attribute vec4 iArg; attribute vec3 iVel; // iArg: size, turn, shape, stretch
uniform float uFlat; varying vec2 vUv; varying vec4 vCol; varying float vShape;
void main() {
  vUv = uv; vCol = iCol; vShape = iArg.z;
  float c = cos(iArg.y), s = sin(iArg.y);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iArg.x;
  if (uFlat > 0.5) { gl_Position = projectionMatrix * viewMatrix * vec4(iPos.x + p.x, iPos.y, iPos.z + p.y, 1.0); }
  else {
    vec4 mv = viewMatrix * vec4(iPos, 1.0);
    if (iArg.w > 0.0) { vec2 d = (viewMatrix * vec4(iVel, 0.0)).xy; float l = length(d); d = l > 0.0001 ? d / l : vec2(0.0, 1.0); p = d * position.y * iArg.x * iArg.w + vec2(-d.y, d.x) * position.x * iArg.x; } // a streak along the way it's flying
    mv.xy += p; gl_Position = projectionMatrix * mv;
  }
}`;
const FRAG = `
varying vec2 vUv; varying vec4 vCol; varying float vShape;
void main() {
  vec2 q = vUv * 2.0 - 1.0; float d = length(q), a;
  if (vShape < 0.5) { a = 1.0 - min(1.0, d); a *= a; }                                            // 0: glow, brightest in the middle
  else if (vShape < 1.5) a = 1.0 - smoothstep(0.45, 1.0, d);                                      // 1: puff, solid middle and a soft rim
  else if (vShape < 2.5) a = smoothstep(0.5, 0.84, d) * (1.0 - smoothstep(0.88, 1.0, d));          // 2: ring
  else a = (1.0 - min(1.0, abs(q.x))) * (1.0 - smoothstep(0.2, 1.0, abs(q.y)));                   // 3: streak
  a *= vCol.a; if (a < 0.004) discard;
  gl_FragColor = vec4(vCol.rgb, a);
  #include <colorspace_fragment>
}`;
// per-particle state, kept in one flat array per batch (nothing for the garbage collector to chew on mid-blast)
const N = 24, PX = 0, PY = 1, PZ = 2, VX = 3, VY = 4, VZ = 5, LIFE = 6, MAX = 7, S0 = 8, S1 = 9, R0 = 10, G0 = 11, B0 = 12, R1 = 13, G1 = 14, B1 = 15, AL = 16, ROT = 17, SPIN = 18, SHAPE = 19, STR = 20, GRAV = 21, DRAG = 22, FIN = 23;
const base = new THREE.PlaneGeometry(1, 1), cube = new THREE.BoxGeometry(1, 1, 1);
const colCache = new Map(), tc = new THREE.Color(); const lin = (hex) => { let c = colCache.get(hex); if (!c) { tc.setHex(hex); c = [tc.r, tc.g, tc.b]; colCache.set(hex, c); } return c; };
const PAL = { flames: [0xff7a1a, 0xffb02a, 0xffe06a], glow: 0xff8a2a };
export function setFlamePalette(p) { if (!p) return; PAL.flames = p.flames.slice(); PAL.glow = p.glow; }
const rnd = (a, b) => a + Math.random() * (b - a), pick = (arr) => arr[(Math.random() * arr.length) | 0];

function makeBatch(max, flat, add, order) {
  const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
  const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const B = { max, n: 0, st: new Float32Array(max * N), pos: mk(3), col: mk(4), arg: mk(4), vel: mk(3), geo };
  geo.setAttribute('iPos', B.pos); geo.setAttribute('iCol', B.col); geo.setAttribute('iArg', B.arg); geo.setAttribute('iVel', B.vel); geo.instanceCount = 0;
  B.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uFlat: { value: flat ? 1 : 0 } }, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: flat ? THREE.DoubleSide : THREE.FrontSide })); // the flat batches lie on the ground and are looked at from above, which is their back: without this they are never drawn
  B.mesh.frustumCulled = false; B.mesh.renderOrder = order; return B;
}
// one particle: o = { x, y, z, vx, vy, vz, life, s (size, or [from, to]), c (colour, or [from, to]), a, shape, grav, drag, rot, spin, stretch, fin }
function emit(B, o) {
  if (B.n >= B.max) return; const s = B.st, i = B.n++ * N, c0 = lin(Array.isArray(o.c) ? o.c[0] : o.c), c1 = Array.isArray(o.c) ? lin(o.c[1]) : c0, sz = o.s;
  s[i + PX] = o.x; s[i + PY] = o.y; s[i + PZ] = o.z; s[i + VX] = o.vx || 0; s[i + VY] = o.vy || 0; s[i + VZ] = o.vz || 0; s[i + LIFE] = s[i + MAX] = o.life;
  s[i + S0] = Array.isArray(sz) ? sz[0] : sz; s[i + S1] = Array.isArray(sz) ? sz[1] : sz; s[i + R0] = c0[0]; s[i + G0] = c0[1]; s[i + B0] = c0[2]; s[i + R1] = c1[0]; s[i + G1] = c1[1]; s[i + B1] = c1[2];
  s[i + AL] = o.a == null ? 1 : o.a; s[i + ROT] = o.rot == null ? Math.random() * 6.28 : o.rot; s[i + SPIN] = o.spin || 0; s[i + SHAPE] = o.shape || 0; s[i + STR] = o.stretch || 0; s[i + GRAV] = o.grav || 0; s[i + DRAG] = o.drag || 0; s[i + FIN] = o.fin || 0;
}
function step(B, dt) {
  const s = B.st, P = B.pos.array, C = B.col.array, A = B.arg.array, V = B.vel.array;
  for (let k = B.n - 1; k >= 0; k--) { const i = k * N; s[i + LIFE] -= dt;
    if (s[i + LIFE] <= 0) { const last = --B.n * N; if (last !== i) s.copyWithin(i, last, last + N); continue; } // gone: the last one takes its place
    const dr = Math.max(0, 1 - s[i + DRAG] * dt); s[i + VX] *= dr; s[i + VZ] *= dr; s[i + VY] = s[i + VY] * dr - s[i + GRAV] * dt;
    s[i + PX] += s[i + VX] * dt; s[i + PY] += s[i + VY] * dt; s[i + PZ] += s[i + VZ] * dt; s[i + ROT] += s[i + SPIN] * dt; }
  for (let k = 0; k < B.n; k++) { const i = k * N, q = 1 - s[i + LIFE] / s[i + MAX], e = 1 - (1 - q) * (1 - q), fin = s[i + FIN];
    P[k * 3] = s[i + PX]; P[k * 3 + 1] = s[i + PY]; P[k * 3 + 2] = s[i + PZ]; V[k * 3] = s[i + VX]; V[k * 3 + 1] = s[i + VY]; V[k * 3 + 2] = s[i + VZ];
    C[k * 4] = s[i + R0] + (s[i + R1] - s[i + R0]) * q; C[k * 4 + 1] = s[i + G0] + (s[i + G1] - s[i + G0]) * q; C[k * 4 + 2] = s[i + B0] + (s[i + B1] - s[i + B0]) * q; C[k * 4 + 3] = s[i + AL] * (fin > 0 && q < fin ? q / fin : 1) * (1 - q);
    A[k * 4] = s[i + S0] + (s[i + S1] - s[i + S0]) * e; A[k * 4 + 1] = s[i + ROT]; A[k * 4 + 2] = s[i + SHAPE]; A[k * 4 + 3] = s[i + STR]; }
  B.geo.instanceCount = B.n; if (!B.n && !B.was) return; B.was = B.n > 0;
  for (const [a, w] of [[B.pos, 3], [B.col, 4], [B.arg, 4], [B.vel, 3]]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, B.n) * w); a.needsUpdate = true; }
}

export function createFires(scene) {
  const hot = makeBatch(1100, false, true, 6), smoke = makeBatch(520, false, false, 5), light = makeBatch(160, true, true, 4), marks = makeBatch(140, true, false, 3);
  const BITS = 220, bits = new THREE.InstancedMesh(cube, new THREE.MeshLambertMaterial({ color: 0xffffff }), BITS), bitList = [], bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), be = new THREE.Euler(), bp = new THREE.Vector3(), bs = new THREE.Vector3(), bc = new THREE.Color();
  bits.frustumCulled = false; bits.count = 0; bits.setColorAt(0, bc);
  const all = [marks.mesh, light.mesh, smoke.mesh, hot.mesh, bits], fires = [];
  const BIT_COLS = [0x3a3a40, 0x5a5048, 0x8a8f96, 0x2a2a30, 0x6a5a4a];

  // ---- the building blocks ----
  function flame(p, size) { emit(hot, { x: p.x + rnd(-0.3, 0.3) * size, y: p.y, z: p.z + rnd(-0.3, 0.3) * size, vx: rnd(-0.3, 0.3), vy: rnd(1.6, 3.4), vz: rnd(-0.3, 0.3), life: rnd(0.4, 0.75), s: [rnd(0.5, 0.8) * size, 0.12 * size], c: [pick(PAL.flames), 0xb02a0a], a: 0.85, shape: 1, spin: rnd(-3, 3) }); }
  function smokePuff(p, size, dark = 0x2a2a30, a = 0.42) { emit(smoke, { x: p.x + rnd(-0.3, 0.3) * size, y: p.y, z: p.z + rnd(-0.3, 0.3) * size, vx: rnd(-0.25, 0.55), vy: rnd(0.8, 1.6), vz: rnd(-0.25, 0.25), life: rnd(1.7, 3.2), s: [rnd(0.5, 0.8) * size, rnd(1.7, 2.4) * size], c: dark, a, shape: 1, spin: rnd(-0.6, 0.6), fin: 0.12, drag: 0.4 }); }
  // dust: pale, low, rolling out sideways (pass a direction to throw it one way)
  function dust(p, size = 1, dx = 0, dz = 0, c = 0x9c8c70) { const a = Math.random() * 6.28, sp = rnd(0.6, 1.8); emit(smoke, { x: p.x + rnd(-0.25, 0.25) * size, y: (p.y || 0) + 0.15 * size, z: p.z + rnd(-0.25, 0.25) * size, vx: Math.cos(a) * sp + dx, vy: rnd(0.2, 0.9), vz: Math.sin(a) * sp + dz, life: rnd(0.9, 1.9), s: [rnd(0.35, 0.6) * size, rnd(1.3, 2) * size], c, a: 0.34, shape: 1, spin: rnd(-1, 1), fin: 0.1, drag: 1.6 }); }
  // sparks: bright streaks thrown out and pulled down. o = { c: colour or [from, to], speed, up, life, size }
  function sparks(p, n = 10, o = {}) { const c = o.c || [0xfff2b0, 0xff7a1a], sp = o.speed || 7, up = o.up == null ? 4 : o.up;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = sp * rnd(0.35, 1); emit(hot, { x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * v, vy: up * rnd(0.3, 1.2), vz: Math.sin(a) * v, life: (o.life || 0.6) * rnd(0.5, 1.2), s: (o.size || 0.11) * rnd(0.7, 1.3), c, a: 1, shape: 3, stretch: 3.2, grav: 13, drag: 0.8 }); } }
  function ember(p, size = 1) { emit(hot, { x: p.x + rnd(-0.4, 0.4) * size, y: p.y, z: p.z + rnd(-0.4, 0.4) * size, vx: rnd(-0.8, 0.8), vy: rnd(1.2, 3), vz: rnd(-0.8, 0.8), life: rnd(0.9, 1.8), s: 0.1 * size, c: [0xffd27a, 0xff4a0a], a: 1, shape: 0, grav: -0.6, drag: 0.5 }); }
  // on the ground: a pool of light, an expanding shockwave ring, a scorch mark that fades over a quarter of a minute
  function glow(p, r, c = PAL.glow, life = 0.45, a = 0.55) { emit(light, { x: p.x, y: 0.13, z: p.z, life, s: [r * 2, r * 2.4], c, a, shape: 0, rot: 0 }); }
  function shock(p, r, c = 0xffe2b0, life = 0.38) { emit(light, { x: p.x, y: 0.14, z: p.z, life, s: [r * 0.3, r * 2], c, a: 0.75, shape: 2, rot: 0 }); }
  function scorch(p, r, life = 16) { emit(marks, { x: p.x, y: 0.11, z: p.z, life, s: r * 2 * rnd(0.85, 1.15), c: 0x0a0806, a: 0.62, shape: 1, fin: 0.02 }); }
  function flash(p, size, c = 0xffe2a0) { emit(hot, { x: p.x, y: p.y, z: p.z, life: 0.2, s: [0.8 * size, 5 * size], c, a: 0.8, shape: 0 }); }
  // a burst of droplets, confetti or stars, thrown up and out. o = { c (a colour, [from, to], or with pick: a list to choose from), speed, up: [min, max], life, size, grav, drag, shape, stretch, spread, vx, vz, soft, a }
  function spray(p, n = 20, o = {}) { const up = o.up || [2, 6], sp = o.spread || 0, B = o.soft ? smoke : hot; // soft: solid-looking blobs (mud, muck) rather than glowing ones
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = (o.speed == null ? 5 : o.speed) * rnd(0.3, 1); emit(B, { x: p.x + rnd(-sp, sp), y: p.y, z: p.z + rnd(-sp, sp), vx: Math.cos(a) * v + (o.vx || 0), vy: rnd(up[0], up[1]), vz: Math.sin(a) * v + (o.vz || 0), life: (o.life || 1) * rnd(0.6, 1.2), s: (o.size || 0.15) * rnd(0.7, 1.3), c: o.pick ? pick(o.c) : o.c || 0xffffff, a: o.a == null ? 1 : o.a, shape: o.shape == null ? 3 : o.shape, stretch: o.stretch == null ? 3 : o.stretch, grav: o.grav == null ? 13 : o.grav, drag: o.drag == null ? 0.8 : o.drag }); } }
  // a patch on the ground that fades away: a puddle, a stain
  function pool(p, r, c, life = 10, a = 0.5) { emit(marks, { x: p.x, y: 0.115, z: p.z, life, s: r * 2, c, a, shape: 1, fin: 0.05 }); }
  // a solid bit thrown out: bounces once, lies there a moment, shrinks away
  function bit(p, size, col, speed = 9) { if (bitList.length >= BITS) return; const a = Math.random() * 6.28, v = speed * rnd(0.25, 1); bitList.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * v, vy: rnd(3, 9), vz: Math.sin(a) * v, s: rnd(0.1, 0.24) * size, rx: Math.random() * 6, rz: Math.random() * 6, sp: rnd(4, 11), life: rnd(1.6, 2.8), hex: col == null ? pick(BIT_COLS) : col, bounced: false }); }

  // ---- the calls the games use ----
  function spawn(kind, pos, size = 1) {
    if (kind === 'flame') flame(pos, size); else if (kind === 'smoke') smokePuff(pos, size); else if (kind === 'dust') dust(pos, size); else if (kind === 'ember') ember(pos, size); else if (kind === 'spark') sparks(pos, 1); else bit(pos, size);
  }
  function ignite(pos, size = 1, life = Infinity) {
    if (fires.some((f) => f.pos.distanceTo(pos) < 0.8)) return null;
    const f = { pos: pos.clone(), size, life, t: Math.random() * 10, glowT: 0 }; fires.push(f); return f;
  }
  function explode(pos, size = 1) {
    const k = Math.min(3, size), y = pos.y + 0.5;
    flash({ x: pos.x, y: y + 0.3, z: pos.z }, k);
    for (let i = 0; i < 9 * k; i++) { const a = Math.random() * 6.28, v = rnd(0.6, 2.6) * k; emit(hot, { x: pos.x, y, z: pos.z, vx: Math.cos(a) * v, vy: rnd(1, 3.6) * k, vz: Math.sin(a) * v, life: rnd(0.4, 0.8), s: [rnd(0.5, 0.9) * k, rnd(1.2, 1.8) * k], c: [pick(PAL.flames), 0x7a1a06], a: 0.62, shape: 1, drag: 2.2, spin: rnd(-2, 2) }); } // the fireball
    for (let i = 0; i < 7 * k; i++) { const a = Math.random() * 6.28, v = rnd(0.3, 1.4) * k; emit(smoke, { x: pos.x + rnd(-0.4, 0.4) * k, y: y + rnd(0, 0.6), z: pos.z + rnd(-0.4, 0.4) * k, vx: Math.cos(a) * v, vy: rnd(1.2, 2.6), vz: Math.sin(a) * v, life: rnd(1.8, 3.2), s: [0.7 * k, rnd(2, 3) * k], c: [0x3a3028, 0x1a1a1e], a: 0.5, shape: 1, fin: 0.22, drag: 0.7, spin: rnd(-0.5, 0.5) }); }
    sparks({ x: pos.x, y, z: pos.z }, Math.round(16 * k), { speed: 8 + 3 * k, up: 6, life: 0.75 });
    for (let i = 0; i < 10 * k; i++) bit({ x: pos.x, y, z: pos.z }, k);
    for (let i = 0; i < 4 * k; i++) ember({ x: pos.x, y: y + 0.4, z: pos.z }, k);
    shock(pos, 3.2 * k); glow(pos, 3.4 * k, PAL.glow, 0.55, 0.7); scorch(pos, 1.25 * k);
  }
  // a lightning hit: a flash, a splash of sparks, a ring and a burn on the ground
  function zap(pos, c = 0xbfe0ff) { flash({ x: pos.x, y: (pos.y || 0) + 0.4, z: pos.z }, 0.7, 0xffffff); sparks({ x: pos.x, y: (pos.y || 0) + 0.25, z: pos.z }, 12, { c: [0xffffff, c], speed: 6, up: 5, life: 0.5 }); glow(pos, 2.6, c, 0.4, 0.8);
    if ((pos.y || 0) < 1) { shock(pos, 1.6, c, 0.3); scorch(pos, 0.7, 12); for (let i = 0; i < 3; i++) smokePuff({ x: pos.x, y: 0.3, z: pos.z }, 0.5); } }

  function update(dt) {
    for (const m of all) if (m.parent !== scene) scene.add(m);
    for (let i = fires.length - 1; i >= 0; i--) { const f = fires[i]; f.t += dt; f.life -= dt; if (f.life <= 0) { fires.splice(i, 1); continue; }
      if (Math.random() < 13 * f.size * dt) flame(f.pos, f.size); if (Math.random() < 3 * f.size * dt) smokePuff({ x: f.pos.x, y: f.pos.y + 0.9 * f.size, z: f.pos.z }, f.size); if (Math.random() < 1.6 * f.size * dt) ember({ x: f.pos.x, y: f.pos.y + 0.4, z: f.pos.z }, 1);
      f.glowT -= dt; if (f.glowT <= 0) { f.glowT = 0.09; glow(f.pos, (1.3 + Math.random() * 0.5) * f.size, PAL.glow, 0.22, 0.42); } } // overlapping short glows: the firelight flickers
    step(hot, dt); step(smoke, dt); step(light, dt); step(marks, dt);
    let n = 0; for (let i = bitList.length - 1; i >= 0; i--) { const b = bitList[i]; b.life -= dt; if (b.life <= 0) { bitList.splice(i, 1); continue; }
      if (b.y > b.s * 0.5 || b.vy > 0) { b.vy -= 18 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.rx += b.sp * dt; b.rz += b.sp * 0.7 * dt; if (b.y <= b.s * 0.5 && b.vy < 0) { b.y = b.s * 0.5; if (!b.bounced) { b.bounced = true; b.vy *= -0.3; b.vx *= 0.4; b.vz *= 0.4; } else b.vy = 0; } } }
    for (const b of bitList) { const s = b.s * Math.min(1, b.life / 0.4); bp.set(b.x, b.y, b.z); be.set(b.rx, 0, b.rz); bq.setFromEuler(be); bs.set(s, s * 0.7, s * 1.2); bm.compose(bp, bq, bs); bits.setMatrixAt(n, bm); bits.setColorAt(n, bc.setHex(b.hex)); n++; }
    bits.count = n; if (n || bits.was) { bits.instanceMatrix.needsUpdate = true; bits.instanceColor.needsUpdate = true; } bits.was = n > 0;
  }
  function clear() { fires.length = 0; bitList.length = 0; bits.count = 0; for (const B of [hot, smoke, light, marks]) { B.n = 0; B.geo.instanceCount = 0; } }
  return { fires, ignite, explode, update, clear, puff: spawn, sparks, spray, pool, dust, zap, glow, shock, scorch, flash, ember, bit, get count() { return hot.n + smoke.n + light.n + marks.n + bitList.length; } };
}
