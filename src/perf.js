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
    const mm = new THREE.Mesh(merged, mat); parent.add(mm); for (const m of list2) { parent.remove(m); out.set(m, mm); } }
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
