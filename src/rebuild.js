// Construction crews (the ENDLESS rounds): a while after a building comes down, scaffolding goes up round the spot and the
// building is put back, so the town never runs out. The building is rebuilt from a copy of its own meshes taken as it fell
// (the real thing with its textures, not a stand-in).
//   snapObject(obj, pos): that copy, a Group standing at pos (userData.size: how big it was). null if there was nothing to copy
//   makeRebuilder({ scene, fx, delay, build, max, busy, done }): wrecked(x, clock) as building x (x.obj, x.pos) falls;
//     tick(dt, clock) every frame; clear() at the start of a round. delay: seconds before the crew arrives; build: seconds
//     the work takes; max: how many go up at once; busy(x): true to put a job off (the player is standing on it);
//     done(x, G): the game takes the new building G over (it is in the scene, full height)
import * as THREE from 'three';
export function snapObject(obj, pos) { const G = new THREE.Group(); G.position.set(pos.x, 0, pos.z); G.updateMatrixWorld(true); const inv = G.matrixWorld.clone().invert(); obj.updateMatrixWorld(true);
  obj.traverse((m) => { if (!m.isMesh || m.isInstancedMesh || !m.visible) return; const n = new THREE.Mesh(m.geometry, m.material); n.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); n.castShadow = m.castShadow; n.receiveShadow = m.receiveShadow; G.add(n); });
  if (!G.children.length) return null; G.userData.size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()); return G; }
export function makeRebuilder({ scene, fx, delay = 60, build = 4, max = 3, busy, done }) { const queue = [], jobs = [], scafMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, wireframe: true, transparent: true, opacity: 0.8 });
  const drop = (j) => { scene.remove(j.sc); j.sc.geometry.dispose(); };
  return {
    wrecked(x, clock) { const G = snapObject(x.obj, x.pos); if (!G) return false; x.snap = G; queue.push({ x, at: clock + delay * (0.8 + Math.random() * 0.4) }); return true; },
    tick(dt, clock) {
      for (let i = 0; i < queue.length && jobs.length < max; i++) { const q = queue[i]; if (q.at > clock) continue; if (busy && busy(q.x)) { q.at = clock + 4; continue; } queue.splice(i--, 1); const G = q.x.snap, s = G.userData.size;
        G.scale.y = 0.03; scene.add(G); const sc = new THREE.Mesh(new THREE.BoxGeometry(s.x + 0.35, s.y + 0.3, s.z + 0.35, 3, Math.max(2, Math.round(s.y)), 3), scafMat); sc.position.set(q.x.pos.x, (s.y + 0.3) / 2, q.x.pos.z); scene.add(sc); jobs.push({ x: q.x, G, sc, t: 0 }); }
      for (let i = jobs.length - 1; i >= 0; i--) { const j = jobs[i]; j.t += dt; const u = Math.min(1, j.t / build), s = j.G.userData.size; j.G.scale.y = 0.03 + 0.97 * u * u * (3 - 2 * u);
        if (fx && Math.random() < dt * 8) fx.dust({ x: j.x.pos.x + (Math.random() - 0.5) * s.x, y: 0, z: j.x.pos.z + (Math.random() - 0.5) * s.z }, 0.5);
        if (u >= 1) { jobs.splice(i, 1); drop(j); j.x.snap = null; done(j.x, j.G); } } },
    clear() { for (const j of jobs) { drop(j); scene.remove(j.G); } jobs.length = 0; queue.length = 0; },
    get waiting() { return queue.length; }, get building() { return jobs.length; } }; }
