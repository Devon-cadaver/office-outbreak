// Tornado visuals and wreckage: a swirling streaked funnel under a dark cloud cap with a dust skirt, junk tumbling up
// the vortex, lightning crackling out of it, and buildings it hits lifted, torn into chunks, spun round and flung as rubble.
import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1), puffGeo = new THREE.IcosahedronGeometry(1, 1);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();

// ---------- tornado skins: funnel colours, glowing lights, lightning colours, an effect, and things riding the vortex ----------
const LM = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o }), BM = (c) => new THREE.MeshBasicMaterial({ color: c });
const sph = new THREE.SphereGeometry(0.5, 10, 8), coneG = new THREE.ConeGeometry(0.5, 1, 8), cylG = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
function piece(parent, geo, mat, sx, sy, sz, x, y, z) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m; }
function bat() { const g = new THREE.Group(), b = LM(0x141218); piece(g, sph, b, 0.3, 0.26, 0.4, 0, 0, 0); piece(g, sph, b, 0.2, 0.2, 0.2, 0, 0.08, 0.2); for (const x of [-0.06, 0.06]) { piece(g, coneG, b, 0.06, 0.12, 0.06, x, 0.2, 0.2); piece(g, sph, BM(0xff3a3a), 0.04, 0.04, 0.04, x, 0.1, 0.3); }
  const wings = [-1, 1].map((sd) => { const w = new THREE.Group(); w.position.set(sd * 0.12, 0.04, 0); g.add(w); piece(w, box, b, 0.55, 0.02, 0.3, sd * 0.28, 0, 0); return w; }); g.userData.wings = wings; g.userData.fly = true; return g; }
function pumpkin() { const g = new THREE.Group(); piece(g, sph, LM(0xf07a1a), 0.62, 0.5, 0.62, 0, 0, 0); piece(g, cylG, LM(0x3a6a2a), 0.06, 0.14, 0.06, 0, 0.29, 0); const lit = BM(0xffe27a); for (const x of [-0.12, 0.12]) piece(g, coneG, lit, 0.09, 0.1, 0.04, x, 0.06, 0.29); piece(g, box, lit, 0.26, 0.06, 0.04, 0, -0.1, 0.29); return g; }
function reindeer() { const g = new THREE.Group(), br = LM(0x8a5a3a), dk = LM(0x3a2a1a); piece(g, box, br, 0.3, 0.26, 0.62, 0, 0, 0); for (const [x, z] of [[-0.1, -0.22], [0.1, -0.22], [-0.1, 0.22], [0.1, 0.22]]) piece(g, box, dk, 0.07, 0.3, 0.07, x, -0.26, z);
  piece(g, box, br, 0.14, 0.3, 0.14, 0, 0.2, 0.3); piece(g, box, br, 0.18, 0.16, 0.24, 0, 0.36, 0.38); piece(g, sph, BM(0xff2a2a), 0.08, 0.08, 0.08, 0, 0.36, 0.52); for (const x of [-0.08, 0.08]) { piece(g, box, dk, 0.03, 0.22, 0.03, x, 0.52, 0.34); piece(g, box, dk, 0.14, 0.03, 0.03, x * 1.8, 0.6, 0.34); } g.userData.fly = true; return g; }
function snowman() { const g = new THREE.Group(), w = LM(0xf6f8fb); piece(g, sph, w, 0.5, 0.5, 0.5, 0, 0, 0); piece(g, sph, w, 0.38, 0.38, 0.38, 0, 0.38, 0); piece(g, sph, w, 0.28, 0.28, 0.28, 0, 0.68, 0); piece(g, coneG, LM(0xf07a1a), 0.06, 0.18, 0.06, 0, 0.68, 0.18).rotation.x = Math.PI / 2;
  piece(g, cylG, LM(0x1a1a1f), 0.26, 0.04, 0.26, 0, 0.8, 0); piece(g, cylG, LM(0x1a1a1f), 0.17, 0.2, 0.17, 0, 0.9, 0); piece(g, box, LM(0xc23b3b), 0.34, 0.06, 0.34, 0, 0.53, 0); return g; }
function shark() { const g = new THREE.Group(), sk = LM(0x6f879e), bel = LM(0xe8eef2); piece(g, sph, sk, 0.34, 0.34, 1.15, 0, 0, 0); piece(g, sph, bel, 0.28, 0.2, 0.95, 0, -0.07, 0.03); piece(g, coneG, sk, 0.08, 0.3, 0.26, 0, 0.26, -0.05);
  const tail = new THREE.Group(); tail.position.z = -0.55; g.add(tail); piece(tail, coneG, sk, 0.05, 0.36, 0.2, 0, 0.12, -0.08).rotation.x = -0.6; piece(tail, coneG, sk, 0.05, 0.26, 0.16, 0, -0.08, -0.06).rotation.x = -2.4; for (const x of [-0.1, 0.1]) piece(g, sph, BM(0x101010), 0.04, 0.04, 0.04, x, 0.06, 0.48); piece(g, box, LM(0x3a1a1a), 0.16, 0.03, 0.06, 0, -0.06, 0.52);
  g.userData.tail = tail; g.userData.fly = true; return g; }
function bunny(c = 0xf8f8f8) { const g = new THREE.Group(), w = LM(c), pk = LM(0xff9ac8); piece(g, sph, w, 0.42, 0.4, 0.48, 0, 0, 0); piece(g, sph, w, 0.3, 0.3, 0.3, 0, 0.25, 0.18); for (const x of [-0.07, 0.07]) { piece(g, box, w, 0.07, 0.34, 0.05, x, 0.52, 0.16); piece(g, box, pk, 0.04, 0.26, 0.02, x, 0.52, 0.19); } piece(g, sph, w, 0.14, 0.14, 0.14, 0, 0.02, -0.25); piece(g, sph, pk, 0.05, 0.05, 0.05, 0, 0.25, 0.33); return g; }
function egg(c) { const g = new THREE.Group(); piece(g, sph, LM(c), 0.24, 0.32, 0.24, 0, 0, 0); piece(g, cylG, LM(0xffffff), 0.245, 0.04, 0.245, 0, 0.03, 0); return g; }
let flagTex = null; function flag() { if (!flagTex) { const c = document.createElement('canvas'); c.width = 76; c.height = 40; const x = c.getContext('2d'); for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#c23b3b'; x.fillRect(0, i * 40 / 13, 76, 40 / 13 + 1); } x.fillStyle = '#2f4f9f'; x.fillRect(0, 0, 32, 21); x.fillStyle = '#fff'; for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) x.fillRect(3 + k * 6, 3 + r * 4.5, 2, 2); flagTex = new THREE.CanvasTexture(c); }
  const g = new THREE.Group(); piece(g, cylG, LM(0xd8d8d8), 0.03, 1, 0.03, 0, 0, 0); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide })); f.position.set(0.32, 0.3, 0); g.add(f); g.userData.cloth = f; return g; }
function fireball() { const g = new THREE.Group(); piece(g, sph, new THREE.MeshBasicMaterial({ color: 0xffb02a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0.36, 0.36, 0.36, 0, 0, 0); piece(g, sph, BM(0xfff0a0), 0.18, 0.18, 0.18, 0, 0, 0); return g; }
function drum() { const g = new THREE.Group(); piece(g, cylG, LM(0xd8c81a), 0.34, 0.48, 0.34, 0, 0, 0); for (const y of [-0.12, 0.12]) piece(g, cylG, LM(0x2a2a20), 0.35, 0.04, 0.35, 0, y, 0); piece(g, cylG, BM(0x7dff3a), 0.3, 0.03, 0.3, 0, 0.25, 0); return g; }
const rep = (n, f) => Array.from({ length: n }, f);
export const TWISTER_SKINS = {
  halloween: { name: 'Hallowstorm', price: 2, desc: 'Black funnel, bats and jack-o-lanterns, green, purple and orange lights.', layers: [0x16121c, 0x3a1f4a, 0x4a2a12], op: [0.82, 0.5, 0.32], cloud: 0x120c18, dust: 0x2a1f30, junk: [0x2a1f30, 0x5a3a20, 0x111111, 0xf07a1a], bolts: [0x7dff3a, 0xb05cff, 0xff8a1a], lights: [0x7dff3a, 0xb05cff, 0xff8a1a], items: () => [...rep(4, bat), ...rep(4, pumpkin)] },
  christmas: { name: 'Blizzard', price: 2, desc: 'White and snowing, with reindeer and snowmen; red and green lightning.', layers: [0xdfe8f2, 0xf4f8fc, 0xbcd0e2], op: [0.78, 0.5, 0.3], cloud: 0x9aa8b8, dust: 0xf0f6fc, junk: [0xf4f8fc, 0xc23b3b, 0x2a8a3a], bolts: [0xff3a3a, 0x3aff6a], lights: [0x3a8aff, 0xff3a3a], fx: 'snow', items: () => [...rep(3, reindeer), ...rep(3, snowman)] },
  fire: { name: 'Firenado', price: 2, desc: 'A column of fire, embers and red lightning.', layers: [0x8a1408, 0xff4a12, 0xffb02a], op: [0.85, 0.55, 0.35], cloud: 0x2a0a06, dust: 0x5a1a0a, junk: [0x2a1a10, 0xff6a1a, 0x5a2a10], bolts: [0xff2a1a, 0xff6a1a], lights: [0xff3a0a, 0xff8a1a, 0xffd24a], fx: 'embers', glow: true, items: () => rep(5, fireball) },
  shark: { name: 'Sharknado', price: 2, desc: 'A spinning waterspout full of sharks.', layers: [0x1a5aa0, 0x4a9ad8, 0xe0f2ff], op: [0.75, 0.52, 0.38], cloud: 0x22405e, dust: 0xbfe6ff, junk: [0x3a6a8a, 0xe0f2ff, 0x1a3a5a], bolts: [0xbfe8ff], lights: [0x6ac8ff, 0xe0f8ff], fx: 'spray', items: () => rep(6, shark) },
  easter: { name: 'Bunnynado', price: 2, desc: 'Pastel swirls, bunnies and eggs; pink lightning.', layers: [0xf4a6c8, 0xc8b4f4, 0xb4f0dc], op: [0.72, 0.5, 0.35], cloud: 0xe0c4e8, dust: 0xfce4f2, junk: [0xf4a6c8, 0xc8b4f4, 0xb4f0dc, 0xfff09a], bolts: [0xff6ac8, 0xff9ad8], lights: [0xff9ad8, 0xb49aff, 0x9affd8, 0xfff09a], items: () => [...rep(4, (_, i) => bunny([0xf8f8f8, 0xf4c8e0, 0xd8c8f8, 0xc8f0e0][i])), ...rep(5, (_, i) => egg([0xff9ad8, 0x9ad8ff, 0xfff09a, 0xb4f0dc, 0xd8b4ff][i]))] },
  // the bonus skin for beating Megacity: an acid storm with acid rain, bright green lightning and baby tornadoes
  acid: { name: 'Acid Storm', price: 0, bonus: 'Beat Megacity in Tornado Alley', desc: 'Toxic green funnel, acid rain, bright green lightning, and baby tornadoes that spin off, circle you and roam the town.', layers: [0x1f6a0a, 0x7dff3a, 0xd8ff6a], op: [0.85, 0.5, 0.32], cloud: 0x14300c, dust: 0x5aff2a, junk: [0x3a5a1a, 0x7dff3a, 0x2a2a20, 0xd8c81a], bolts: [0x7dff3a, 0xb8ff3a, 0x3aff8a], boltGlow: 0x7dff3a, boltRate: 2, lights: [0x7dff3a, 0xd8ff3a, 0x3aff8a], fx: 'acid', glow: true, babies: true, items: () => rep(5, drum) },
  july4: { name: 'Liberty Twister', price: 2, desc: 'Red, white and blue, flags flying, fireworks bursting out.', layers: [0xc23b3b, 0xf2f2f2, 0x2f5fbf], op: [0.75, 0.5, 0.35], cloud: 0x1e2440, dust: 0xd8dde0, junk: [0xc23b3b, 0xf2f2f2, 0x2f5fbf], bolts: [0xff3a3a, 0xffffff, 0x3a7aff, 0xffd24a], lights: [0xff3a3a, 0xffffff, 0x3a7aff], fx: 'fireworks', items: () => rep(4, flag) },
};

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

  const lineCache = new Map(); const lineMat = (c) => { if (!lineCache.has(c)) lineCache.set(c, new THREE.LineBasicMaterial({ color: c })); return lineCache.get(c); };
  function make(big, extras = [], skinKey = null, opts = {}) {
    const H = big ? 11 : 4.5, r0 = big ? 0.35 : 0.18, r1 = big ? 3.6 : 1.3; const skin = TWISTER_SKINS[skinKey] || null;
    const g = new THREE.Group(); const tw = { g, big, H, r0, r1, t: Math.random() * 10, layers: [], junk: null, items: [], boltT: 1, k: 1, skin, skinKey, fxT: 0, baby: !!opts.baby, babyT: 1.5 };
    const mats = layerMats.map((m, i) => { const c = m.clone(); c.map = m.map.clone(); c.map.needsUpdate = true; if (skin) { c.color.setHex(skin.layers[i]); c.opacity = skin.op[i]; if (skin.glow && i > 0) c.blending = THREE.AdditiveBlending; } return c; });
    const capMat = skin ? cloudMat.clone() : cloudMat; if (skin) capMat.color.setHex(skin.cloud); const skirtMat = skin ? dustMat.clone() : dustMat; if (skin) skirtMat.color.setHex(skin.dust);
    const junkCols = skin ? skin.junk : JUNK; tw.own = [...mats, ...(skin ? [capMat, skirtMat] : [])]; if (skin && skin.items && !opts.baby) extras = [...extras, ...skin.items().map((o) => { o.scale.multiplyScalar(big ? 1.9 : 1.2); return o; })];
    // three nested funnel layers, each a lathe with streaks scrolling round it
    [1, 1.12, 1.3].forEach((s, i) => { const pts = []; for (let j = 0; j <= 14; j++) { const y = (j / 14) * H; pts.push(new THREE.Vector2(radiusAt(tw, y) * s, y)); } const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), mats[i]); m.renderOrder = 2; g.add(m); tw.layers.push(m); });
    // dark cloud cap and a dust skirt, as instanced puffs
    const capN = big ? 16 : 6; const cap = new THREE.InstancedMesh(puffGeo, capMat, capN); tw.cap = cap; tw.capP = [];
    for (let i = 0; i < capN; i++) { const a = (i / capN) * Math.PI * 2, rr = (big ? 2 : 0.8) + Math.random() * (big ? 3 : 1.2); tw.capP.push({ a, rr, y: H + Math.random() * 0.8, s: (big ? 1.2 : 0.6) + Math.random() * (big ? 1 : 0.4) }); }
    cap.frustumCulled = false; g.add(cap);
    const dustN = big ? 14 : 6; const dust = new THREE.InstancedMesh(puffGeo, skirtMat, dustN); tw.dust = dust; tw.dustP = []; for (let i = 0; i < dustN; i++) tw.dustP.push({ a: Math.random() * 6.28, rr: (big ? 1 : 0.4) + Math.random() * (big ? 1.6 : 0.6), s: (big ? 0.5 : 0.25) + Math.random() * 0.4, v: 3 + Math.random() * 3 });
    dust.frustumCulled = false; g.add(dust);
    // junk riding the vortex
    const jn = big ? 60 : 16; const junk = new THREE.InstancedMesh(box, junkMat, jn); junk.frustumCulled = false; tw.junk = junk; tw.junkP = [];
    for (let i = 0; i < jn; i++) { const plank = Math.random() < 0.5; tw.junkP.push({ a: Math.random() * 6.28, y: Math.random() * H * 0.9, sz: plank ? [0.5 + Math.random() * 0.5, 0.06, 0.12] : [0.12 + Math.random() * 0.2, 0.12 + Math.random() * 0.2, 0.1 + Math.random() * 0.2], spin: [Math.random() * 6, Math.random() * 6, Math.random() * 6], jit: Math.random() * 0.5 }); junk.setColorAt(i, tmpC.set(junkCols[(Math.random() * junkCols.length) | 0])); }
    g.add(junk);
    // glowing lights swirling in the funnel
    if (skin && skin.lights) { const ln = big ? 22 : 10; const lights = new THREE.InstancedMesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), ln); lights.frustumCulled = false; tw.lights = lights; tw.lightP = []; tw.own.push(lights.material);
      for (let i = 0; i < ln; i++) { tw.lightP.push({ a: Math.random() * 6.28, y: Math.random() * H, v: 2 + Math.random() * 3, s: 0.12 + Math.random() * 0.12 }); lights.setColorAt(i, tmpC.set(skin.lights[i % skin.lights.length])); } g.add(lights); }
    for (const it of extras) { g.add(it); tw.items.push({ o: it, a: Math.random() * 6.28, y: H * (0.25 + Math.random() * 0.5), spin: 1 + Math.random() * 2 }); }
    twisters.push(tw); g.userData.twister = tw; return g;
  }

  function remove(g) { const i = twisters.findIndex((t) => t.g === g); if (i >= 0) twisters.splice(i, 1); scene.remove(g); }
  // free a twister's own GPU resources (babies come and go all round)
  function dispose(tw) { for (const m of tw.own || []) { if (m.map) m.map.dispose(); m.dispose(); } for (const L of tw.layers) L.geometry.dispose(); for (const m of [tw.cap, tw.dust, tw.junk, tw.lights]) if (m) m.dispose(); }

  // baby tornadoes (Acid Storm): spin off the storm, circle it, wander out across town and fade away
  const babies = []; let bounds = null; const glowCache = new Map();
  function spawnBaby(p) { const g = make(false, [], p.skinKey, { baby: true }); g.position.copy(p.g.position); g.scale.setScalar(0.001); scene.add(g); babies.push({ g, tw: g.userData.twister, parent: p, t: 0, a: Math.random() * 6.28, life: 6 + Math.random() * 3, heading: 0, reach: 0 }); }
  function updateBabies(dt) {
    for (let i = babies.length - 1; i >= 0; i--) { const b = babies[i], g = b.g, P = b.parent.g, k = Math.max(0.6, P.scale.x / 0.42); b.t += dt;
      if (b.t < 2.2) { b.a += dt * 2.6; const R = k * (1.6 + b.t * 1.4); g.position.set(P.position.x + Math.cos(b.a) * R, 0, P.position.z + Math.sin(b.a) * R); b.heading = b.a + 0.8 + (Math.random() - 0.5) * 0.6; }
      else { b.heading += (Math.random() - 0.5) * dt * 3; const sp = 4.2 * k; g.position.x += Math.cos(b.heading) * sp * dt; g.position.z += Math.sin(b.heading) * sp * dt;
        if (bounds) { if (Math.abs(g.position.x) > bounds.x) { g.position.x = Math.sign(g.position.x) * bounds.x; b.heading = Math.PI - b.heading; } if (Math.abs(g.position.z) > bounds.z) { g.position.z = Math.sign(g.position.z) * bounds.z; b.heading = -b.heading; } } }
      const grow = Math.min(1, b.t / 0.6), fade = Math.max(0, Math.min(1, (b.life - b.t) / 0.9)); g.scale.setScalar(Math.max(0.001, P.scale.x * 1.1 * grow * fade)); b.reach = 0.75 * k * grow * fade;
      if (b.t >= b.life) { remove(g); dispose(b.tw); babies.splice(i, 1); } }
  }

  function bolt(tw) {
    const g = tw.g, y0 = tw.H * (0.25 + Math.random() * 0.7), a = Math.random() * 6.28, r = radiusAt(tw, y0) * g.scale.x;
    const start = new THREE.Vector3(g.position.x + Math.cos(a) * r, y0 * g.scale.y, g.position.z + Math.sin(a) * r);
    const toGround = Math.random() < 0.55; const reach = 3 + Math.random() * 5;
    const end = toGround ? new THREE.Vector3(g.position.x + Math.cos(a) * (r + reach), 0, g.position.z + Math.sin(a) * (r + reach)) : new THREE.Vector3(g.position.x + Math.cos(a + 0.8) * (r + reach * 0.6), (tw.H + 0.5) * g.scale.y, g.position.z + Math.sin(a + 0.8) * (r + reach * 0.6));
    const pts = []; const n = 9; for (let i = 0; i <= n; i++) { const p = start.clone().lerp(end, i / n); if (i > 0 && i < n) { p.x += (Math.random() - 0.5) * 0.9; p.y += (Math.random() - 0.5) * 0.7; p.z += (Math.random() - 0.5) * 0.9; } pts.push(p); }
    const bc = tw.skin ? tw.skin.bolts[(Math.random() * tw.skin.bolts.length) | 0] : null; const gc = tw.skin && tw.skin.boltGlow; if (gc && !glowCache.has(gc)) glowCache.set(gc, new THREE.LineBasicMaterial({ color: gc, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })); const gm = gc ? glowCache.get(gc) : glowMat; const grp = new THREE.Group(); grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), bc ? lineMat(bc) : boltMat));
    for (const o of [[0.07, 0], [-0.07, 0], [0, 0.07]]) grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((q) => new THREE.Vector3(q.x + o[0], q.y, q.z + o[1]))), gm));
    // a fork or two
    for (let f = 0; f < 2; f++) { const from = pts[2 + ((Math.random() * (n - 4)) | 0)]; const fp = [from.clone()]; let q = from.clone(); for (let k = 0; k < 3; k++) { q = q.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.6) * 1.2, (Math.random() - 0.5) * 1.6)); fp.push(q); } grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fp), gm)); }
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

  function update(dt) { updateFx(dt); updateBabies(dt);
    for (const tw of twisters) {
      tw.t += dt; const g = tw.g, t = tw.t;
      tw.layers.forEach((L, i) => { L.material.map.offset.x -= dt * (1.4 + i * 0.5); L.material.map.offset.y += dt * 0.25; L.rotation.y += dt * (2.5 - i * 0.6); L.position.x = Math.sin(t * 1.3 + i) * 0.12 * (tw.big ? 1 : 0.5); L.position.z = Math.cos(t * 1.1 + i) * 0.12 * (tw.big ? 1 : 0.5); });
      g.rotation.z = Math.sin(t * 0.7) * 0.06; g.rotation.x = Math.cos(t * 0.53) * 0.05;
      tw.capP.forEach((p, i) => { p.a += dt * 0.35; tmpP.set(Math.cos(p.a) * p.rr, p.y + Math.sin(t + i) * 0.15, Math.sin(p.a) * p.rr); tmpS.set(p.s * 1.6, p.s * 0.55, p.s); tmpM.compose(tmpP, tmpQ.identity(), tmpS); tw.cap.setMatrixAt(i, tmpM); }); tw.cap.instanceMatrix.needsUpdate = true;
      tw.dustP.forEach((p, i) => { p.a += dt * p.v; const pulse = 1 + Math.sin(t * 3 + i) * 0.25; tmpP.set(Math.cos(p.a) * p.rr, p.s * 0.6, Math.sin(p.a) * p.rr); tmpS.setScalar(p.s * pulse); tmpM.compose(tmpP, tmpQ.identity(), tmpS); tw.dust.setMatrixAt(i, tmpM); }); tw.dust.instanceMatrix.needsUpdate = true;
      tw.junkP.forEach((p, i) => { p.y += dt * (1.2 + p.jit); if (p.y > tw.H * 0.95) p.y = 0.1; p.a += dt * (5.5 - (p.y / tw.H) * 3); const r = radiusAt(tw, p.y) * (0.95 + p.jit * 0.5);
        tmpP.set(Math.cos(p.a) * r, p.y, Math.sin(p.a) * r); tmpE.set(t * p.spin[0], t * p.spin[1], t * p.spin[2]); tmpQ.setFromEuler(tmpE); tmpS.set(p.sz[0], p.sz[1], p.sz[2]); tmpM.compose(tmpP, tmpQ, tmpS); tw.junk.setMatrixAt(i, tmpM); }); tw.junk.instanceMatrix.needsUpdate = true;
      for (const it of tw.items) { it.a += dt * 2.2; it.y += dt * 0.6; if (it.y > tw.H * 0.85) it.y = tw.H * 0.2; const r = radiusAt(tw, it.y) * 1.05; const o = it.o, u = o.userData; o.position.set(Math.cos(it.a) * r, it.y, Math.sin(it.a) * r);
        if (u.fly) { o.rotation.set(0, Math.atan2(-Math.sin(it.a), Math.cos(it.a)), 0); o.rotateZ(-0.4); o.position.y += Math.sin(t * 3 + it.a) * 0.2; if (u.wings) { const f = Math.sin(t * 16 + it.a * 3) * 0.7; u.wings[0].rotation.z = f; u.wings[1].rotation.z = -f; } if (u.tail) u.tail.rotation.y = Math.sin(t * 9 + it.a) * 0.5; }
        else { o.rotation.x += dt * it.spin; o.rotation.z += dt * it.spin * 0.7; if (u.cloth) u.cloth.rotation.y = Math.sin(t * 8 + it.a) * 0.4; } }
      if (tw.lights) { tw.lightP.forEach((p, i) => { p.a += dt * p.v; p.y += dt * 0.8; if (p.y > tw.H) p.y = 0.2; const r = radiusAt(tw, p.y) * 0.8; tmpP.set(Math.cos(p.a) * r, p.y, Math.sin(p.a) * r); tmpS.setScalar(p.s * (1 + Math.sin(t * 6 + i) * 0.35)); tmpM.compose(tmpP, tmpQ.identity(), tmpS); tw.lights.setMatrixAt(i, tmpM); }); tw.lights.instanceMatrix.needsUpdate = true; }
      if (tw.skin && tw.skin.fx && g.parent === scene) skinFx(tw, dt);
      if (tw.big) { tw.boltT -= dt; if (tw.boltT <= 0 && g.scale.x > 0.5) { tw.boltT = (0.35 + Math.random() * 1.3) / ((tw.skin && tw.skin.boltRate) || 1); bolt(tw); } }
      if (tw.skin && tw.skin.babies && tw.big && !tw.baby && g.parent === scene && g.scale.x > 0.2) { tw.babyT -= dt; if (tw.babyT <= 0) { tw.babyT = 3 + Math.random() * 3; if (babies.length < 4) spawnBaby(tw); } }
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

  // per-skin effects in world space: snow, embers, spray and fireworks
  const fxParts = []; const fxMat = new Map(); const fxM = (c) => { if (!fxMat.has(c)) fxMat.set(c, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })); return fxMat.get(c); };
  const fxGeo = new THREE.SphereGeometry(0.06, 5, 4);
  function spark(pos, vel, c, life, grav, size = 1) { if (fxParts.length > 260) return; const m = new THREE.Mesh(fxGeo, fxM(c)); m.position.copy(pos); m.scale.setScalar(size); scene.add(m); fxParts.push({ m, vel, life, max: life, grav }); }
  function skinFx(tw, dt) {
    const g = tw.g, sc = g.scale.x, kind = tw.skin.fx; tw.fxT -= dt;
    const at = (y, rr) => { const a = Math.random() * 6.28; return { a, p: new THREE.Vector3(g.position.x + Math.cos(a) * rr * sc, y * sc, g.position.z + Math.sin(a) * rr * sc) }; };
    if (kind === 'snow' && Math.random() < dt * 40) { const { p } = at(tw.H * (0.4 + Math.random() * 0.6), radiusAt(tw, tw.H) * (0.5 + Math.random())); spark(p, new THREE.Vector3((Math.random() - 0.5) * 1.5, -1.2 - Math.random(), (Math.random() - 0.5) * 1.5), 0xffffff, 3.5, 0, 1.4); }
    if (kind === 'embers' && Math.random() < dt * 45) { const y = Math.random() * tw.H; const { a, p } = at(y, radiusAt(tw, y)); spark(p, new THREE.Vector3(Math.cos(a) * 2 - Math.sin(a) * 3, 1.5 + Math.random() * 2, Math.sin(a) * 2 + Math.cos(a) * 3), [0xff6a1a, 0xffb02a, 0xff3a0a][(Math.random() * 3) | 0], 1.4, -1, 1.2); }
    if (kind === 'spray' && Math.random() < dt * 35) { const y = Math.random() * tw.H * 0.6; const { a, p } = at(y, radiusAt(tw, y)); spark(p, new THREE.Vector3(Math.cos(a) * 4, 2 + Math.random() * 2, Math.sin(a) * 4), 0xcfeaff, 1.2, 9, 1.1); }
    if (kind === 'acid' && tw.big && Math.random() < dt * 120) { const { p } = at(tw.H * 0.98, radiusAt(tw, tw.H) * (0.3 + Math.random() * 1.5)); fxParts.push({ m: (() => { const m = new THREE.Mesh(fxGeo, fxM([0x7dff3a, 0xb8ff3a, 0x3aff8a][(Math.random() * 3) | 0])); m.position.copy(p); m.scale.set(1, 5, 1); scene.add(m); return m; })(), vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, -11 - Math.random() * 4, (Math.random() - 0.5) * 0.8), life: 2, max: 2, grav: 0, keep: true, fizz: true }); }
    if (kind === 'fireworks' && tw.fxT <= 0) { tw.fxT = 0.7 + Math.random() * 0.9; const { a, p } = at(tw.H * 0.9, radiusAt(tw, tw.H) * 0.5); const c = [0xff3a3a, 0xffffff, 0x3a7aff, 0xffd24a, 0x7dff3a][(Math.random() * 5) | 0];
      fxParts.push({ rocket: true, m: (() => { const m = new THREE.Mesh(fxGeo, fxM(0xffe27a)); m.position.copy(p); m.scale.setScalar(1.6); scene.add(m); return m; })(), vel: new THREE.Vector3(Math.cos(a) * 3, 7 + Math.random() * 3, Math.sin(a) * 3), life: 0.8 + Math.random() * 0.4, max: 1, grav: 4, c }); }
  }
  function updateFx(dt) { for (let i = fxParts.length - 1; i >= 0; i--) { const f = fxParts[i]; f.life -= dt; f.vel.y -= f.grav * dt; f.m.position.addScaledVector(f.vel, dt);
      if (f.rocket) { if (Math.random() < 0.6) spark(f.m.position.clone(), new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.5, (Math.random() - 0.5) * 0.4), 0xffb02a, 0.4, 0, 0.8); if (f.life <= 0) { for (let k = 0; k < 26; k++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.4, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 3); spark(f.m.position.clone(), v, f.c, 1.1 + Math.random() * 0.4, 3, 1.5); } } }
      else if (!f.keep) f.m.scale.setScalar(Math.max(0.2, f.life / f.max) * (f.m.scale.x > 0 ? 1 : 1));
      if (f.life <= 0 || f.m.position.y < 0) { scene.remove(f.m); fxParts.splice(i, 1); if (f.fizz && Math.random() < 0.5) { const q = f.m.position.clone().setY(0.05); for (let k = 0; k < 2; k++) spark(q, new THREE.Vector3((Math.random() - 0.5) * 1.6, 1 + Math.random(), (Math.random() - 0.5) * 1.6), 0xb8ff3a, 0.35, 6, 0.8); } } } }
  function clear() { for (const b of babies) dispose(b.tw); babies.length = 0; for (const f of fxParts) scene.remove(f.m); fxParts.length = 0; for (const tw of twisters) scene.remove(tw.g); twisters.length = 0; for (const b of bolts) scene.remove(b.g); bolts.length = 0; for (const c of chunks) { if (c.m) scene.remove(c.m); } chunks.length = 0; }
  function suck(m, tw) { scene.attach(m); addChunk(m, tw, 0); }
  return { make, remove, tear, scatter, suck, update, clear, radiusAt, get chunks() { return chunks; }, get babies() { return babies; }, setBounds(b) { bounds = b; } };
}
