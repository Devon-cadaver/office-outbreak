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

// Keep the frame rate up by drawing at a lower resolution when frames run long, and creeping back up when there's room.
export function autoResolution(renderer, maxRatio = Math.min(devicePixelRatio, 1.5)) {
  const minRatio = Math.min(maxRatio, 0.8); let ratio = maxRatio, acc = 0, n = 0, last = performance.now(), good = 0;
  renderer.setPixelRatio(ratio);
  return function tick() {
    const now = performance.now(), ms = now - last; last = now; if (ms > 250) return; // tab was hidden or paused
    acc += ms; n++; if (acc < 1500) return; const fps = 1000 * n / acc; acc = 0; n = 0;
    if (fps < 48 && ratio > minRatio) { ratio = Math.max(minRatio, ratio - 0.15); good = 0; renderer.setPixelRatio(ratio); }
    else if (fps > 57 && ratio < maxRatio) { if (++good >= 3) { good = 0; ratio = Math.min(maxRatio, ratio + 0.1); renderer.setPixelRatio(ratio); } }
    else good = 0;
  };
}
