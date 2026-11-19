// Performance helpers shared by all modes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Merge the plain, solid-coloured meshes directly under each group into one mesh per group (colours baked into the
// vertices). Animated parts are groups, so they keep moving; see-through, textured or glowing-emissive meshes stay apart.
const vc = new Map(); const vcMat = (basic) => { if (!vc.has(basic)) vc.set(basic, basic ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true })); return vc.get(basic); };
const plain = (m) => { const mt = m.material; if (!mt || Array.isArray(mt) || mt.transparent || mt.map || mt.vertexColors || mt.side !== THREE.FrontSide) return null; if (mt.type === 'MeshBasicMaterial') return 'B'; if (mt.type === 'MeshLambertMaterial' && !mt.flatShading && (!mt.emissive || mt.emissive.getHex() === 0)) return 'L'; return null; };
export function mergeParts(root) {
  const groups = []; root.traverse((o) => { if (!o.isMesh) groups.push(o); });
  for (const gr of groups) {
    const by = { L: [], B: [] }; for (const m of gr.children) { if (!m.isMesh || m.children.length) continue; const k = plain(m); if (k) by[k].push(m); }
    for (const k of ['L', 'B']) { const list = by[k]; if (list.length < 2) continue;
      const geos = list.map((m) => { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a); g.applyMatrix4(m.matrix); if (!g.attributes.normal) g.computeVertexNormals();
        const c = m.material.color, n = g.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g; });
      const merged = mergeGeometries(geos); if (!merged) continue; const mm = new THREE.Mesh(merged, vcMat(k === 'B')); gr.add(mm); for (const m of list) gr.remove(m); }
  }
  return root;
}

// Merge a set of static meshes that share a parent into a few meshes: solid Lambert colours go into vertex colours (one
// mesh per shading/side), glowing Basic pieces merge per material so the material can still be recoloured (blackouts).
// Only for modes that never fade buildings: half-transparent "fade" materials are treated as solid. Returns old -> new.
export function mergeStatic(parent, list) {
  const out = new Map(), by = new Map();
  for (const m of list) { if (!m.isMesh || m.parent !== parent || m.children.length || m.isInstancedMesh) continue; const mt = m.material; if (!mt || Array.isArray(mt) || mt.map || mt.vertexColors || (mt.opacity ?? 1) < 1) continue;
    let k = null; if (mt.type === 'MeshBasicMaterial') k = 'B' + mt.uuid; else if (mt.type === 'MeshLambertMaterial' && (!mt.emissive || mt.emissive.getHex() === 0)) k = 'L' + (mt.flatShading ? 'F' : '') + mt.side;
    if (!k) continue; let b = by.get(k); if (!b) by.set(k, (b = [])); b.push(m); }
  for (const [k, list2] of by) { if (list2.length < 2) continue;
    const geos = list2.map((m) => { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a); g.applyMatrix4(m.matrix); if (!g.attributes.normal) g.computeVertexNormals();
      if (k[0] === 'L') { const c = m.material.color, n = g.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); } return g; });
    if (geos.some((g) => [...Object.values(g.attributes)].some((a) => a.array.some((x) => !Number.isFinite(x))))) continue;
    const merged = mergeGeometries(geos); if (!merged) continue;
    const mat = k[0] === 'B' ? list2[0].material : vcLam(k[1] === 'F', list2[0].material.side);
    // centre the merged shape on its own position (its parts were baked in place), and mark it: it can't fly apart like
    // a loose piece, so whoever destroys it should hide it instead
    merged.computeBoundingBox(); const ctr = merged.boundingBox.getCenter(new THREE.Vector3()); merged.translate(-ctr.x, -ctr.y, -ctr.z);
    const mm = new THREE.Mesh(merged, mat); mm.position.copy(ctr); mm.userData.merged = true; parent.add(mm); for (const m of list2) { parent.remove(m); out.set(m, mm); } }
  return out;
}
const vcl = new Map(); const vcLam = (flat, side) => { const key = flat + '|' + side; if (!vcl.has(key)) vcl.set(key, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat, side })); return vcl.get(key); };

// Keep the frame rate up by drawing at a lower resolution when frames run long, and creeping back up when there's room.
// Big screens (tablets, laptops) get a pixel budget, so they don't draw several times a phone's pixels.
const BUDGET = 1.3e6;
export function autoResolution(renderer, cap = 1.5) {
  const top = () => Math.max(0.6, Math.min(devicePixelRatio, cap, Math.sqrt(BUDGET / Math.max(1, innerWidth * innerHeight))));
  let maxRatio = top(), minRatio = Math.min(maxRatio, innerWidth * innerHeight > 6e5 ? 0.65 : 0.8), ratio = maxRatio, acc = 0, n = 0, last = performance.now(), good = 0;
  renderer.setPixelRatio(ratio);
  addEventListener('resize', () => { maxRatio = top(); minRatio = Math.min(maxRatio, innerWidth * innerHeight > 6e5 ? 0.65 : 0.8); if (ratio > maxRatio) { ratio = maxRatio; renderer.setPixelRatio(ratio); } });
  const fn = function tick() {
    const now = performance.now(), ms = now - last; last = now; if (ms > 250) return; // tab was hidden or paused
    acc += ms; n++; if (acc < 1500) return; const fps = 1000 * n / acc; acc = 0; n = 0;
    if (fps < 48 && ratio > minRatio) { ratio = Math.max(minRatio, ratio - 0.15); good = 0; renderer.setPixelRatio(ratio); }
    else if (fps > 58 && ratio < maxRatio) { if (++good >= 6) { good = 0; ratio = Math.min(maxRatio, ratio + 0.1); renderer.setPixelRatio(ratio); } }
    else good = 0;
  };
  Object.defineProperty(fn, 'ratio', { get: () => ratio }); return fn;
}

// Bake movable-but-usually-still objects (trees, lamps, benches...) into one mesh per parent, remembering which vertices
// came from which object. Their own meshes are hidden; unbake(obj) collapses its vertices and shows the real thing again,
// so it can be knocked over and animate as before. Only plain solid Lambert meshes are baked; the rest stay as they are.
export function bakeMovable(parent, objs) {
  parent.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert(), mtx = new THREE.Matrix4();
  const geos = [], spans = new Map(); let at = 0;
  for (const o of objs) { const mine = []; o.traverse((m) => { if (!m.isMesh || !m.visible || m.isInstancedMesh) return; const mt = m.material; if (!mt || Array.isArray(mt) || mt.type !== 'MeshLambertMaterial' || mt.transparent || mt.map || mt.vertexColors || mt.flatShading || mt.side !== THREE.FrontSide || (mt.emissive && mt.emissive.getHex())) return;
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a); if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(mtx.multiplyMatrices(inv, m.matrixWorld)); const c = mt.color, n = g.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      if ([...Object.values(g.attributes)].some((a) => a.array.some((x) => !Number.isFinite(x)))) return; mine.push([m, g]); });
    if (!mine.length) continue; const start = at; for (const [m, g] of mine) { geos.push(g); at += g.attributes.position.count; m.visible = false; } spans.set(o, { start, count: at - start, meshes: mine.map(([m]) => m) }); }
  if (geos.length < 2) { for (const s of spans.values()) for (const m of s.meshes) m.visible = true; return null; }
  const merged = mergeGeometries(geos); const mesh = new THREE.Mesh(merged, vcLam(false, THREE.FrontSide)); mesh.userData.merged = true; parent.add(mesh); mesh.updateMatrixWorld(true);
  return { mesh, unbake(o) { const s = spans.get(o); if (!s) return; spans.delete(o); const p = merged.attributes.position; for (let i = s.start; i < s.start + s.count; i++) p.setXYZ(i, 0, -50, 0); p.needsUpdate = true; for (const m of s.meshes) m.visible = true; } };
}

// Bake whole buildings and landmarks (each a "unit": a key and the objects that make it up) into a few meshes per parent:
// one per kind of surface, whatever material each building was given. A building's own tint goes into vertex colours and
// its texture's tiling into the UVs, so a hundred differently coloured blocks of flats share one textured material.
// The real meshes are only hidden; unbake(key) collapses that unit's vertices and shows them again, so it can be torn
// apart exactly as before. Meshes in `skip` (animated decorations) and anything see-through or unusual stay as they are.
const litMats = new Map(); // the textured (lit-window) materials made here, so a blackout can dim them: see setBakedGlow
export function setBakedGlow(k) { for (const m of litMats.values()) m.emissiveIntensity = m.userData.glow0 * k; }
export function bucketOf(mt) {
  if (!mt || mt.wireframe || (mt.opacity ?? 1) < 1 || mt.alphaMap || mt.alphaTest) return null;
  if (mt.type === 'MeshBasicMaterial') return mt.map ? null : { key: 'B' + mt.uuid, mat: mt, uv: false, tint: false };
  if (mt.type !== 'MeshLambertMaterial') return null;
  const flat = !!mt.flatShading, side = mt.side;
  if (!mt.map) { if (mt.emissive && mt.emissive.getHex() && !mt.emissiveMap) return null; return { key: 'L' + flat + side, mat: vcLam(flat, side), uv: false, tint: true }; }
  const em = mt.emissiveMap, key = 'T' + mt.map.source.uuid + '|' + (em ? em.source.uuid : '') + '|' + (mt.emissive ? mt.emissive.getHex() : 0) + '|' + mt.emissiveIntensity + '|' + flat + side;
  let m = litMats.get(key);
  if (!m) { const plainTex = (t) => { const c = t.clone(); c.repeat.set(1, 1); c.offset.set(0, 0); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.needsUpdate = true; return c; };
    m = new THREE.MeshLambertMaterial({ map: plainTex(mt.map), vertexColors: true, flatShading: flat, side }); if (em) { m.emissiveMap = plainTex(em); m.emissive.copy(mt.emissive); m.emissiveIntensity = mt.emissiveIntensity; } m.userData.glow0 = m.emissiveIntensity; litMats.set(key, m); }
  m.emissiveIntensity = m.userData.glow0; return { key, mat: m, uv: true, tint: true, rep: mt.map.repeat, off: mt.map.offset };
}
const flatCache = new WeakMap(); const flatGeo = (g) => { if (!g.index) return g; let f = flatCache.get(g); if (!f) flatCache.set(g, (f = g.toNonIndexed())); return f; };
export function bakeUnits(parent, units, skip = new Set()) {
  parent.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert(), mtx = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  const buckets = new Map(), recs = new Map();
  const shown = (m) => { for (let o = m; o && o !== parent; o = o.parent) if (!o.visible) return false; return true; };
  for (const u of units) { const rec = { spans: [], meshes: [] };
    for (const root of u.objs) root.traverse((m) => { if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || skip.has(m) || m.userData.baked || !shown(m)) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material], bs = mats.map(bucketOf); if (bs.some((b) => !b)) return;
      const g = flatGeo(m.geometry), P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color; if (!P || !Nn) return;
      const groups = Array.isArray(m.material) ? g.groups : [{ start: 0, count: P.count, materialIndex: 0 }]; if (!groups.length) return;
      mtx.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(mtx); const pieces = [];
      for (const gr of groups) { const b = bs[gr.materialIndex], mt = mats[gr.materialIndex]; if (!b) return; const n = Math.min(gr.count, P.count - gr.start); if (n <= 0) continue;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = b.tint ? new Float32Array(n * 3) : null, uv = b.uv ? new Float32Array(n * 2) : null, c = mt.color;
        for (let i = 0; i < n; i++) { const s = gr.start + i; v.fromBufferAttribute(P, s).applyMatrix4(mtx); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; v.fromBufferAttribute(Nn, s).applyMatrix3(nm).normalize(); nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z;
          if (col) { const k = mt.vertexColors && C ? 1 : 0; col[i * 3] = c.r * (k ? C.getX(s) : 1); col[i * 3 + 1] = c.g * (k ? C.getY(s) : 1); col[i * 3 + 2] = c.b * (k ? C.getZ(s) : 1); }
          if (uv) { uv[i * 2] = (U ? U.getX(s) : 0) * b.rep.x + b.off.x; uv[i * 2 + 1] = (U ? U.getY(s) : 0) * b.rep.y + b.off.y; } }
        if (pos.some((x) => !Number.isFinite(x))) return; pieces.push({ b, pos, nor, col, uv, n }); }
      for (const p of pieces) { let B = buckets.get(p.b.key); if (!B) buckets.set(p.b.key, (B = { mat: p.b.mat, tint: p.b.tint, uv: p.b.uv, list: [], at: 0 })); rec.spans.push({ B, start: B.at, count: p.n }); B.list.push(p); B.at += p.n; }
      m.visible = false; rec.meshes.push(m); });
    if (rec.meshes.length) recs.set(u.key, rec); }
  for (const B of buckets.values()) { const pos = new Float32Array(B.at * 3), nor = new Float32Array(B.at * 3), col = B.tint ? new Float32Array(B.at * 3) : null, uv = B.uv ? new Float32Array(B.at * 2) : null; let at = 0;
    for (const p of B.list) { pos.set(p.pos, at * 3); nor.set(p.nor, at * 3); if (col) col.set(p.col, at * 3); if (uv) uv.set(p.uv, at * 2); at += p.n; } B.list = null;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    B.mesh = new THREE.Mesh(g, B.mat); B.mesh.userData.merged = true; B.mesh.userData.baked = true; parent.add(B.mesh); B.mesh.updateMatrixWorld(true); }
  return { size: recs.size, unbake(key) { const r = recs.get(key); if (!r) return false; recs.delete(key);
      for (const s of r.spans) { const p = s.B.mesh.geometry.attributes.position; for (let i = s.start; i < s.start + s.count; i++) p.setXYZ(i, 0, -50, 0); p.addUpdateRange(s.start * 3, s.count * 3); p.needsUpdate = true; }
      for (const m of r.meshes) m.visible = true; return true; } };
}
