// Fires and explosions: pooled flame and smoke particles, flickering glow, a flash for blasts. Cheap enough for phones.
import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1);
const flameMats = [0xff7a1a, 0xffb02a, 0xffe06a].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
const glowMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
const sphere = new THREE.SphereGeometry(0.5, 10, 8);

export function createFires(scene) {
  const fires = [], particles = [], pool = [];
  const MAX_P = 420;
  function spawn(kind, pos, size) {
    if (particles.length >= MAX_P) return;
    let m = pool.pop();
    if (!m) { m = new THREE.Mesh(box, flameMats[0]); m.userData.smokeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a30, transparent: true, opacity: 0.45, depthWrite: false }); }
    const u = m.userData; u.kind = kind;
    if (kind === 'flame') { m.material = flameMats[(Math.random() * 3) | 0]; u.life = u.max = 0.45 + Math.random() * 0.35; u.vel = new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 2.2, (Math.random() - 0.5) * 0.6); u.s0 = (0.14 + Math.random() * 0.18) * size; }
    else if (kind === 'smoke') { m.material = u.smokeMat; u.smokeMat.opacity = 0.4; u.life = u.max = 1.8 + Math.random() * 1.6; u.vel = new THREE.Vector3((Math.random() - 0.5) * 0.5 + 0.3, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 0.5); u.s0 = (0.25 + Math.random() * 0.2) * size; }
    else { m.material = flameMats[1]; u.life = u.max = 0.5 + Math.random() * 0.5; u.vel = new THREE.Vector3((Math.random() - 0.5) * 9, 3 + Math.random() * 7, (Math.random() - 0.5) * 9); u.s0 = (0.2 + Math.random() * 0.25) * size; } // debris
    m.position.set(pos.x + (Math.random() - 0.5) * 0.6 * size, pos.y, pos.z + (Math.random() - 0.5) * 0.6 * size); m.scale.setScalar(u.s0); m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    scene.add(m); particles.push(m);
  }
  function ignite(pos, size = 1, life = Infinity) {
    if (fires.some((f) => f.pos.distanceTo(pos) < 0.8)) return null;
    const glow = new THREE.Mesh(sphere, glowMat); glow.position.copy(pos); glow.position.y += 0.3 * size; glow.scale.setScalar(1.2 * size); scene.add(glow);
    const f = { pos: pos.clone(), size, life, t: Math.random() * 10, glow }; fires.push(f); return f;
  }
  function explode(pos, size = 1) {
    const flash = new THREE.Mesh(sphere, flashMat.clone()); flash.position.copy(pos); flash.position.y += 0.8; flash.scale.setScalar(0.5); scene.add(flash);
    const fl = { mesh: flash, t: 0 }; flashes.push(fl);
    for (let i = 0; i < 26 * size; i++) spawn('debris', pos, size); for (let i = 0; i < 14 * size; i++) spawn('smoke', new THREE.Vector3(pos.x, pos.y + 0.6, pos.z), size * 1.4);
  }
  const flashes = [];
  function update(dt) {
    for (const f of fires) {
      f.t += dt; f.life -= dt;
      const rate = 14 * f.size; if (Math.random() < rate * dt) spawn('flame', f.pos, f.size); if (Math.random() < 3 * f.size * dt) spawn('smoke', new THREE.Vector3(f.pos.x, f.pos.y + 0.9 * f.size, f.pos.z), f.size);
      f.glow.scale.setScalar((1.0 + Math.sin(f.t * 23) * 0.15 + Math.sin(f.t * 7.3) * 0.2) * f.size * 1.2); f.glow.material.opacity = 0.25 + Math.random() * 0.15;
    }
    for (let i = fires.length - 1; i >= 0; i--) if (fires[i].life <= 0) { scene.remove(fires[i].glow); fires.splice(i, 1); }
    for (let i = flashes.length - 1; i >= 0; i--) { const fl = flashes[i]; fl.t += dt; const k = fl.t / 0.45; fl.mesh.scale.setScalar(0.5 + k * 5.5); fl.mesh.material.opacity = Math.max(0, 0.9 * (1 - k)); if (k >= 1) { scene.remove(fl.mesh); flashes.splice(i, 1); } }
    for (let i = particles.length - 1; i >= 0; i--) {
      const m = particles[i], u = m.userData; u.life -= dt; const k = u.life / u.max;
      m.position.addScaledVector(u.vel, dt);
      if (u.kind === 'flame') { m.scale.setScalar(u.s0 * (0.3 + k * 0.7)); m.rotation.y += dt * 6; }
      else if (u.kind === 'smoke') { m.scale.setScalar(u.s0 * (1 + (1 - k) * 2.2)); u.smokeMat.opacity = 0.4 * k; m.rotation.y += dt; }
      else { u.vel.y -= 14 * dt; m.rotation.x += dt * 8; m.rotation.z += dt * 5; if (m.position.y < 0) { u.life = 0; } }
      if (u.life <= 0) { scene.remove(m); particles.splice(i, 1); pool.push(m); }
    }
  }
  function clear() { for (const f of fires) scene.remove(f.glow); fires.length = 0; for (const m of particles) { scene.remove(m); pool.push(m); } particles.length = 0; for (const fl of flashes) scene.remove(fl.mesh); flashes.length = 0; }
  return { fires, ignite, explode, update, clear };
}
