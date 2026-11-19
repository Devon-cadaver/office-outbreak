// The crowd: townsfolk and soldiers away from the action are all drawn in ONE draw call. Each person is still a real
// object the game moves about, but its own body (several draws, and limbs to animate) is hidden while it is far from the
// player, and a simple stand-in is drawn in its place here: same position, size, facing and outfit colours, legs and arms
// swinging in step. The moment it comes near, or the game does anything else with it, the real body is back.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// the stand-in figure, in the same proportions as poster/characters.js. aPart = (colour slot, limb):
// slot 0 shirt, 1 trousers, 2 skin, 3 hair, 4 dark. limb 0 none, 1 left leg, 2 right leg, 3 left arm, 4 right arm
function figure() {
  const parts = [], add = (g, sx, sy, sz, x, y, z, slot, limb) => { const p = (g.index ? g.toNonIndexed() : g.clone()); for (const a of Object.keys(p.attributes)) if (a !== 'position' && a !== 'normal') p.deleteAttribute(a); p.scale(sx, sy, sz); p.translate(x, y, z);
    const n = p.attributes.position.count, arr = new Float32Array(n * 2); for (let i = 0; i < n; i++) { arr[i * 2] = slot; arr[i * 2 + 1] = limb; } p.setAttribute('aPart', new THREE.BufferAttribute(arr, 2)); parts.push(p); };
  const cyl = new THREE.CylinderGeometry(0.5, 0.42, 1, 5, 1, false), box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(0.5, 8, 6), cap = new THREE.SphereGeometry(0.5, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.55), body = new THREE.CapsuleGeometry(0.5, 1, 1, 7);
  for (const [x, limb] of [[-0.16, 1], [0.16, 2]]) { add(cyl, 0.27, 0.86, 0.27, x, 0.52, 0, 1, limb); add(box, 0.26, 0.16, 0.38, x, 0.09, 0.06, 4, limb); }
  add(body, 0.78, 0.46, 0.6, 0, 1.3, 0, 0, 0);
  for (const [x, limb] of [[-0.46, 3], [0.46, 4]]) { add(cyl, 0.21, 0.6, 0.21, x, 1.38, 0, 0, limb); add(box, 0.17, 0.17, 0.17, x, 1.02, 0, 2, limb); }
  add(ball, 0.66, 0.66, 0.66, 0, 2.11, 0, 2, 0); add(cap, 0.72, 0.74, 0.72, 0, 2.1, -0.04, 3, 0);
  return mergeGeometries(parts);
}
export function createCrowd(scene, max = 420) {
  const geo = figure(), mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const A = { iShirt: mk(3), iPants: mk(3), iSkin: mk(3), iHair: mk(3), iAnim: mk(3) }; for (const k in A) geo.setAttribute(k, A[k]);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 aPart; attribute vec3 iShirt; attribute vec3 iPants; attribute vec3 iSkin; attribute vec3 iHair; attribute vec3 iAnim; // iAnim: step phase, stride, arms (0 swinging, 1 held out in front, 2 up in the air)')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      if (aPart.y > 0.5) { bool leg = aPart.y < 2.5; float pivot = leg ? 0.95 : 1.68, sw = sin(iAnim.x) * iAnim.y;
        float ang = leg ? (aPart.y < 1.5 ? sw : -sw) : iAnim.z > 1.5 ? -2.7 + sin(iAnim.x * 1.7 + aPart.y * 1.3) * 0.4 : mix((aPart.y < 3.5 ? -sw : sw) * 0.8, -1.35, iAnim.z);
        float cs = cos(ang), sn = sin(ang), dy = transformed.y - pivot, z0 = transformed.z; transformed.y = pivot + dy * cs - z0 * sn; transformed.z = dy * sn + z0 * cs; }`)
    .replace('#include <color_vertex>', '#include <color_vertex>\n  vColor.rgb = aPart.x < 0.5 ? iShirt : aPart.x < 1.5 ? iPants : aPart.x < 2.5 ? iSkin : aPart.x < 3.5 ? iHair : vec3(0.015);'); };
  const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.frustumCulled = false; mesh.count = 0;
  const cc = new Map(), tc = new THREE.Color(), lin = (hex) => { let c = cc.get(hex); if (!c) { tc.setHex(hex); c = [tc.r, tc.g, tc.b]; cc.set(hex, c); } return c; };
  const DEF = [0x4f8fd6, 0x3b3f55, 0xf0c9a6, 0x4a2f1c], SLOT = [A.iShirt.array, A.iPants.array, A.iSkin.array, A.iHair.array]; let stamp = 0; const hidden = [];
  // lists: [[people, armsOut], ...]. Everyone further than nearR from (cx, cz) is drawn here instead of as themselves
  function sync(lists, cx, cz, nearR) { if (mesh.parent !== scene) scene.add(mesh); stamp++; let n = 0;
    for (const [list, armsOut] of lists) for (const c of list) { const u = c.userData; u.crowdT = stamp;
      const dx = c.position.x - cx, dz = c.position.z - cz, lim = nearR + (u.far ? -0.8 : 0.8); let far = dx * dx + dz * dz > lim * lim && n < max && !u.clown && c.parent === scene;
      if (far !== !!u.far) { u.far = far; c.visible = !far; if (far) hidden.push(c); }
      if (!far) continue;
      c.updateMatrix(); mesh.setMatrixAt(n, c.matrix); const cols = u.cols || DEF, sp = u.sp || 0;
      for (let i = 0; i < 4; i++) { const v = lin(cols[i]), a = SLOT[i]; a[n * 3] = v[0]; a[n * 3 + 1] = v[1]; a[n * 3 + 2] = v[2]; }
      const an = A.iAnim.array; an[n * 3] = u.phase || 0; an[n * 3 + 1] = sp < 0.05 ? 0 : (sp > 1.05 ? 0.95 : 0.7) * Math.min(sp, 1.2); an[n * 3 + 2] = armsOut || u.zombie ? 1 : u.panic ? 2 : 0; n++; }
    // anyone the game took off its lists while hidden (grabbed, flung, eaten) gets their own body back
    for (let i = hidden.length - 1; i >= 0; i--) { const c = hidden[i], u = c.userData; if (u.crowdT !== stamp) { u.far = false; c.visible = true; hidden.splice(i, 1); } else if (!u.far) hidden.splice(i, 1); }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; for (const k in A) { A[k].clearUpdateRanges(); A[k].addUpdateRange(0, Math.max(1, n) * 3); A[k].needsUpdate = true; }
  }
  function clear() { for (const c of hidden) { c.userData.far = false; c.visible = true; } hidden.length = 0; mesh.count = 0; }
  return { sync, clear, mesh, get count() { return mesh.count; } };
}
