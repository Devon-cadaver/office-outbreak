// Tornado visuals and wreckage: a swirling streaked funnel under a dark cloud cap with a dust skirt, junk tumbling up
// the vortex, lightning crackling out of it, and buildings it hits lifted, torn into chunks, spun round and flung as rubble.
import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1), puffGeo = new THREE.IcosahedronGeometry(1, 1);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();

function streakTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) { const y = Math.random() * 128, h = 2 + Math.random() * 7; g.fillStyle = Math.random() < 0.5 ? 'rgba(40,40,50,0.55)' : 'rgba(255,255,255,0.75)'; g.save(); g.translate(0, y); g.transform(1, -0.35, 0, 1, 0, 0); g.fillRect(-20, 0, 180, h); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function createTwisters(scene, { onBolt } = {}) {
  const tex = streakTexture();
  const layerMats = [[0x55555f, 0.6], [0x8b8b98, 0.38], [0xb0a48c, 0.2]].map(([c, o]) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(3, 2); return new THREE.MeshBasicMaterial({ color: c, map: t, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide }); });
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0x3a3a46, transparent: true, opacity: 0.62, depthWrite: false });
  const dustMat = new THREE.MeshBasicMaterial({ color: 0x9c8c70, transparent: true, opacity: 0.32, depthWrite: false });
  const junkMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const boltMat = new THREE.LineBasicMaterial({ color: 0xe8f4ff }), glowMat = new THREE.LineBasicMaterial({ color: 0x7ab8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
  const JUNK = [0x7a5a3a, 0x5a3a26, 0x3a3a40, 0xd8d0c0, 0x8a8f96, 0xa04030, 0x2f6f8a, 0x6a7a40];
  const twisters = [], chunks = [], bolts = []; const matCache = new Map();
  const chunkMat = (hex) => { if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshLambertMaterial({ color: hex })); return matCache.get(hex); };

  // funnel radius at height y (0..H)
  const radiusAt = (tw, y) => tw.r0 + Math.pow(Math.max(0, y) / tw.H, 1.7) * tw.r1;

  function make(big, extras = []) {
    const H = big ? 11 : 4.5, r0 = big ? 0.35 : 0.18, r1 = big ? 3.6 : 1.3;
    const g = new THREE.Group(); const tw = { g, big, H, r0, r1, t: Math.random() * 10, layers: [], junk: null, items: [], boltT: 1, k: 1 };
    // three nested funnel layers, each a lathe with streaks scrolling round it
    [1, 1.12, 1.3].forEach((s, i) => { const pts = []; for (let j = 0; j <= 14; j++) { const y = (j / 14) * H; pts.push(new THREE.Vector2(radiusAt(tw, y) * s, y)); } const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), layerMats[i]); m.renderOrder = 2; g.add(m); tw.layers.push(m); });
    // dark cloud cap and a dust skirt, as instanced puffs
    const capN = big ? 16 : 6; const cap = new THREE.InstancedMesh(puffGeo, cloudMat, capN); tw.cap = cap; tw.capP = [];
    for (let i = 0; i < capN; i++) { const a = (i / capN) * Math.PI * 2, rr = (big ? 2 : 0.8) + Math.random() * (big ? 3 : 1.2); tw.capP.push({ a, rr, y: H + Math.random() * 0.8, s: (big ? 1.2 : 0.6) + Math.random() * (big ? 1 : 0.4) }); }
    cap.frustumCulled = false; g.add(cap);
    const dustN = big ? 14 : 6; const dust = new THREE.InstancedMesh(puffGeo, dustMat, dustN); tw.dust = dust; tw.dustP = []; for (let i = 0; i < dustN; i++) tw.dustP.push({ a: Math.random() * 6.28, rr: (big ? 1 : 0.4) + Math.random() * (big ? 1.6 : 0.6), s: (big ? 0.5 : 0.25) + Math.random() * 0.4, v: 3 + Math.random() * 3 });
    dust.frustumCulled = false; g.add(dust);
    // junk riding the vortex
    const jn = big ? 60 : 16; const junk = new THREE.InstancedMesh(box, junkMat, jn); junk.frustumCulled = false; tw.junk = junk; tw.junkP = [];
    for (let i = 0; i < jn; i++) { const plank = Math.random() < 0.5; tw.junkP.push({ a: Math.random() * 6.28, y: Math.random() * H * 0.9, sz: plank ? [0.5 + Math.random() * 0.5, 0.06, 0.12] : [0.12 + Math.random() * 0.2, 0.12 + Math.random() * 0.2, 0.1 + Math.random() * 0.2], spin: [Math.random() * 6, Math.random() * 6, Math.random() * 6], jit: Math.random() * 0.5 }); junk.setColorAt(i, tmpC.set(JUNK[(Math.random() * JUNK.length) | 0])); }
    g.add(junk);
    for (const it of extras) { g.add(it); tw.items.push({ o: it, a: Math.random() * 6.28, y: H * (0.25 + Math.random() * 0.5), spin: 1 + Math.random() * 2 }); }
    twisters.push(tw); g.userData.twister = tw; return g;
  }

  function remove(g) { const i = twisters.findIndex((t) => t.g === g); if (i >= 0) twisters.splice(i, 1); scene.remove(g); }

  function bolt(tw) {
    const g = tw.g, y0 = tw.H * (0.25 + Math.random() * 0.7), a = Math.random() * 6.28, r = radiusAt(tw, y0) * g.scale.x;
    const start = new THREE.Vector3(g.position.x + Math.cos(a) * r, y0 * g.scale.y, g.position.z + Math.sin(a) * r);
    const toGround = Math.random() < 0.55; const reach = 3 + Math.random() * 5;
    const end = toGround ? new THREE.Vector3(g.position.x + Math.cos(a) * (r + reach), 0, g.position.z + Math.sin(a) * (r + reach)) : new THREE.Vector3(g.position.x + Math.cos(a + 0.8) * (r + reach * 0.6), (tw.H + 0.5) * g.scale.y, g.position.z + Math.sin(a + 0.8) * (r + reach * 0.6));
    const pts = []; const n = 9; for (let i = 0; i <= n; i++) { const p = start.clone().lerp(end, i / n); if (i > 0 && i < n) { p.x += (Math.random() - 0.5) * 0.9; p.y += (Math.random() - 0.5) * 0.7; p.z += (Math.random() - 0.5) * 0.9; } pts.push(p); }
    const grp = new THREE.Group(); grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), boltMat));
    for (const o of [[0.07, 0], [-0.07, 0], [0, 0.07]]) grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((q) => new THREE.Vector3(q.x + o[0], q.y, q.z + o[1]))), glowMat));
    // a fork or two
    for (let f = 0; f < 2; f++) { const from = pts[2 + ((Math.random() * (n - 4)) | 0)]; const fp = [from.clone()]; let q = from.clone(); for (let k = 0; k < 3; k++) { q = q.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.6) * 1.2, (Math.random() - 0.5) * 1.6)); fp.push(q); } grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fp), glowMat)); }
    scene.add(grp); bolts.push({ g: grp, t: 0.16 + Math.random() * 0.1 });
    if (onBolt) onBolt(end, toGround);
  }

  // rip a building apart: chunks in its colours (plus its loose parts) get sucked into the funnel, then flung
  function tear(obj, center, size, tw, loose = []) {
    const cols = []; obj.traverse((m) => { if (m.isMesh && m.material) { const mt = Array.isArray(m.material) ? m.material[0] : m.material; if (mt.color) cols.push(mt.color.getHex()); } });
    if (!cols.length) cols.push(0x8a8f96);
    const n = Math.round(10 + Math.min(14, size.y * 3));
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(box, chunkMat(cols[(Math.random() * cols.length) | 0])); const s = 0.15 + Math.random() * Math.min(0.55, size.x * 0.25);
      m.scale.set(s, 0.1 + Math.random() * s * 0.6, s * (0.4 + Math.random() * 0.8)); m.position.set(center.x + (Math.random() - 0.5) * size.x, Math.random() * size.y, center.z + (Math.random() - 0.5) * size.z); scene.add(m); addChunk(m, tw, i * 0.04); }
    for (const m of loose) { if (!m.parent) continue; m.getWorldPosition(tmpP); scene.attach(m); addChunk(m, tw, Math.random() * 0.3); }
    // the shell itself lifts, spins and is gone into the cloud
    chunks.push({ shell: obj, t: 0, base: obj.position.clone(), s0: obj.scale.clone(), tw });
  }
  // knocked loose without a tornado (a crash): pieces just fly outward and land
  function scatter(meshes, center, power = 5) {
    for (const m of meshes) { if (!m.parent) continue; scene.attach(m); const a = Math.atan2(m.position.z - center.z, m.position.x - center.x) + (Math.random() - 0.5); chunks.push({ m, phase: 'fly', t: 0, vel: new THREE.Vector3(Math.cos(a) * power * (0.5 + Math.random()), 3 + Math.random() * 4, Math.sin(a) * power * (0.5 + Math.random())), spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), rest: 0 }); }
  }
  function addChunk(m, tw, delay) { chunks.push({ m, tw, phase: 'suck', t: -delay, a: Math.random() * 6.28, y: m.position.y, vel: new THREE.Vector3(), spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), hold: 1.2 + Math.random() * 1.8, rest: 0 }); }

  function update(dt) {
    for (const tw of twisters) {
      tw.t += dt; const g = tw.g, t = tw.t;
      tw.layers.forEach((L, i) => { L.material.map.offset.x -= dt * (1.4 + i * 0.5); L.material.map.offset.y += dt * 0.25; L.rotation.y += dt * (2.5 - i * 0.6); L.position.x = Math.sin(t * 1.3 + i) * 0.12 * (tw.big ? 1 : 0.5); L.position.z = Math.cos(t * 1.1 + i) * 0.12 * (tw.big ? 1 : 0.5); });
      g.rotation.z = Math.sin(t * 0.7) * 0.06; g.rotation.x = Math.cos(t * 0.53) * 0.05;
      tw.capP.forEach((p, i) => { p.a += dt * 0.35; tmpP.set(Math.cos(p.a) * p.rr, p.y + Math.sin(t + i) * 0.15, Math.sin(p.a) * p.rr); tmpS.set(p.s * 1.6, p.s * 0.55, p.s); tmpM.compose(tmpP, tmpQ.identity(), tmpS); tw.cap.setMatrixAt(i, tmpM); }); tw.cap.instanceMatrix.needsUpdate = true;
      tw.dustP.forEach((p, i) => { p.a += dt * p.v; const pulse = 1 + Math.sin(t * 3 + i) * 0.25; tmpP.set(Math.cos(p.a) * p.rr, p.s * 0.6, Math.sin(p.a) * p.rr); tmpS.setScalar(p.s * pulse); tmpM.compose(tmpP, tmpQ.identity(), tmpS); tw.dust.setMatrixAt(i, tmpM); }); tw.dust.instanceMatrix.needsUpdate = true;
      tw.junkP.forEach((p, i) => { p.y += dt * (1.2 + p.jit); if (p.y > tw.H * 0.95) p.y = 0.1; p.a += dt * (5.5 - (p.y / tw.H) * 3); const r = radiusAt(tw, p.y) * (0.95 + p.jit * 0.5);
        tmpP.set(Math.cos(p.a) * r, p.y, Math.sin(p.a) * r); tmpE.set(t * p.spin[0], t * p.spin[1], t * p.spin[2]); tmpQ.setFromEuler(tmpE); tmpS.set(p.sz[0], p.sz[1], p.sz[2]); tmpM.compose(tmpP, tmpQ, tmpS); tw.junk.setMatrixAt(i, tmpM); }); tw.junk.instanceMatrix.needsUpdate = true;
      for (const it of tw.items) { it.a += dt * 2.2; it.y += dt * 0.6; if (it.y > tw.H * 0.85) it.y = tw.H * 0.2; const r = radiusAt(tw, it.y) * 1.05; it.o.position.set(Math.cos(it.a) * r, it.y, Math.sin(it.a) * r); it.o.rotation.x += dt * it.spin; it.o.rotation.z += dt * it.spin * 0.7; }
      if (tw.big) { tw.boltT -= dt; if (tw.boltT <= 0 && g.scale.x > 0.5) { tw.boltT = 0.35 + Math.random() * 1.3; bolt(tw); } }
    }
    for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.t -= dt; b.g.visible = Math.random() < 0.8; if (b.t <= 0) { scene.remove(b.g); b.g.traverse((m) => m.geometry && m.geometry.dispose()); bolts.splice(i, 1); } }
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i];
      if (c.shell) { c.t += dt; const k = Math.min(1, c.t / 1.6); const o = c.shell; o.position.y = c.base.y + k * k * 9; o.rotation.y += dt * (2 + k * 10); o.rotation.z = Math.sin(c.t * 7) * 0.25 * k; const sc = 1 - k * 0.92; o.scale.set(c.s0.x * sc, c.s0.y * sc, c.s0.z * sc);
        if (c.tw && c.tw.g.parent) { o.position.x += (c.tw.g.position.x - o.position.x) * Math.min(1, dt * 1.5); o.position.z += (c.tw.g.position.z - o.position.z) * Math.min(1, dt * 1.5); }
        if (k >= 1) { o.visible = false; chunks.splice(i, 1); } continue; }
      const m = c.m; c.t += dt; if (c.t < 0) continue;
      if (c.phase === 'suck') {
        const tw = c.tw; if (!tw || !tw.g.parent) { c.phase = 'fly'; c.vel.set((Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6); continue; }
        const cx = tw.g.position.x, cz = tw.g.position.z, sc = tw.g.scale.x; c.y = Math.min(tw.H * 0.8, c.y + dt * 2.6); c.a += dt * (5 - (c.y / tw.H) * 2.5); const r = radiusAt(tw, c.y) * sc * 1.05;
        const want = tmpP.set(cx + Math.cos(c.a) * r, c.y * sc, cz + Math.sin(c.a) * r); m.position.lerp(want, Math.min(1, dt * 4)); m.rotation.x += c.spin.x * dt; m.rotation.y += c.spin.y * dt; m.rotation.z += c.spin.z * dt;
        if (c.t > c.hold) { c.phase = 'fly'; const out = new THREE.Vector3(Math.cos(c.a), 0, Math.sin(c.a)), tan = new THREE.Vector3(-Math.sin(c.a), 0, Math.cos(c.a)); c.vel.copy(tan.multiplyScalar(9 + Math.random() * 6)).add(out.multiplyScalar(5 + Math.random() * 5)); c.vel.y = 3 + Math.random() * 5; }
      } else if (c.phase === 'fly') {
        c.vel.y -= 16 * dt; m.position.addScaledVector(c.vel, dt); m.rotation.x += c.spin.x * dt; m.rotation.y += c.spin.y * dt; m.rotation.z += c.spin.z * dt;
        const floor = Math.max(0.03, m.scale.y * 0.5); if (m.position.y <= floor) { m.position.y = floor; c.phase = 'rest'; m.rotation.x = 0; m.rotation.z = 0; c.rest = 30; }
      } else if (c.phase === 'rest') { c.rest -= dt; if (c.rest < 2) m.position.y -= dt * 0.2; if (c.rest <= 0) { scene.remove(m); chunks.splice(i, 1); } }
    }
    // keep the rubble bounded on phones
    let rest = 0; for (const c of chunks) if (c.phase === 'rest') rest++; if (rest > 220) { const old = chunks.find((c) => c.phase === 'rest'); if (old) old.rest = Math.min(old.rest, 1); }
  }

  function clear() { for (const tw of twisters) scene.remove(tw.g); twisters.length = 0; for (const b of bolts) scene.remove(b.g); bolts.length = 0; for (const c of chunks) { if (c.m) scene.remove(c.m); } chunks.length = 0; }
  return { make, remove, tear, scatter, update, clear, radiusAt, get chunks() { return chunks; } };
}
