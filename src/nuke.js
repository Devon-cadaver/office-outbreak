// A big blast for both games: 'nuke' (a white flash, a fireball, a shockwave racing out along the ground and a mushroom
// cloud that climbs and fades) or 'wave' (a sonic boom: rings of sound pulsing out and a shimmering dome). onRadius(r)
// is called every frame with how far the shockwave has reached, so the caller wrecks things as it passes.
// Returns { update(dt), remove() }: update reports false once it has fully faded; remove() takes it away at once.
import * as THREE from 'three';

const ball = new THREE.IcosahedronGeometry(1, 2), ringG = new THREE.RingGeometry(0.9, 1, 64), cyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
const mat = (color, opacity, additive = true) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });

export function nukeBlast(scene, at, R, { kind = 'nuke', color = null, secs = 1.6, onRadius = null } = {}) {
  const g = new THREE.Group(); g.position.set(at.x, 0, at.z); scene.add(g); const parts = [];
  const add = (m) => { g.add(m); parts.push(m); return m; };
  let t = 0;
  if (kind === 'wave') {
    const c = color ?? 0x6ad8ff; const rings = [];
    for (let i = 0; i < 5; i++) { const r = add(new THREE.Mesh(ringG, mat(c, 0.9))); r.rotation.x = -Math.PI / 2; r.position.y = 0.3 + i * 0.4; rings.push({ r, d: i * 0.18 }); }
    const dome = add(new THREE.Mesh(ball, mat(c, 0.25))); dome.scale.setScalar(0.1);
    const core = add(new THREE.Mesh(ball, mat(0xffffff, 0.8))); core.position.y = 2; core.scale.setScalar(1.5);
    return { remove: () => scene.remove(g), update(dt) { t += dt; const k = Math.min(1, t / secs);
      for (const o of rings) { const kk = Math.max(0, Math.min(1, (t - o.d) / secs)); o.r.scale.setScalar(0.5 + R * kk); o.r.material.opacity = 0.9 * (1 - kk); }
      dome.scale.set(R * k, R * 0.45 * k, R * k); dome.material.opacity = 0.3 * (1 - k); core.scale.setScalar(1.5 + k * 4); core.material.opacity = 0.8 * (1 - k * 1.5);
      if (onRadius && k < 1) onRadius(R * k); if (t > secs + 0.3) { scene.remove(g); return false; } return true; } };
  }
  const fire = add(new THREE.Mesh(ball, mat(0xffe27a, 1))), fire2 = add(new THREE.Mesh(ball, mat(0xff7a1a, 0.8)));
  const wave = add(new THREE.Mesh(ringG, mat(0xfff2c0, 0.95))); wave.rotation.x = -Math.PI / 2; wave.position.y = 0.25;
  const scorch = add(new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat(0x1a0e08, 0.7, false))); scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.06;
  const stem = add(new THREE.Mesh(cyl, mat(0xffa040, 0.85))), cap = add(new THREE.Mesh(ball, mat(0xff8a2a, 0.9))), capRing = add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 8, 24), mat(0xffc060, 0.7)));
  const smoke = add(new THREE.Mesh(ball, mat(0x5a4a40, 0.55, false))); capRing.rotation.x = Math.PI / 2;
  const H = R * 1.1;
  return { remove: () => scene.remove(g), update(dt) { t += dt; const k = Math.min(1, t / secs), life = 4.5, f = Math.min(1, t / life);
    const fb = Math.min(1, t / 0.5); fire.scale.setScalar(R * 0.32 * fb); fire.position.y = R * 0.12 * fb; fire.material.opacity = Math.max(0, 1 - t / 1.4);
    fire2.scale.setScalar(R * 0.4 * fb); fire2.position.y = R * 0.1 * fb; fire2.material.opacity = Math.max(0, 0.8 - t / 1.8);
    wave.scale.setScalar(0.5 + R * k); wave.material.opacity = 0.95 * (1 - k); scorch.scale.setScalar(R * 0.75 * Math.min(1, t / 0.6)); scorch.material.opacity = 0.7 * (1 - Math.max(0, (t - 3.5) / 1));
    // the mushroom cloud climbs, swells and cools from glowing orange to grey smoke
    const up = Math.min(1, t / 2.2), cool = Math.min(1, t / 3);
    stem.scale.set(R * 0.07 * (1 + up), H * up, R * 0.07 * (1 + up)); stem.position.y = H * up / 2; stem.material.opacity = 0.85 * (1 - f);
    cap.scale.set(R * 0.28 * (0.4 + up), R * 0.16 * (0.4 + up), R * 0.28 * (0.4 + up)); cap.position.y = H * up; cap.material.color.setHex(cool < 0.5 ? 0xff8a2a : 0xd06a3a); cap.material.opacity = 0.9 * (1 - f);
    capRing.scale.setScalar(R * 0.26 * (0.4 + up)); capRing.position.y = H * up - R * 0.1; capRing.material.opacity = 0.7 * (1 - f);
    smoke.scale.set(R * 0.36 * (0.3 + up), R * 0.2 * (0.3 + up), R * 0.36 * (0.3 + up)); smoke.position.y = H * up + R * 0.04; smoke.material.opacity = 0.55 * cool * (1 - f);
    if (onRadius && k < 1) onRadius(R * k); if (t > life) { scene.remove(g); return false; } return true; } };
}
