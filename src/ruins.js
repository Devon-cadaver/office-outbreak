// Destroyed cityscape outside the district walls: dark broken towers, leaning slabs, rubble,
// flickering fires and drifting smoke. Instanced and cheap.
import * as THREE from 'three';
import { CELL } from './city.js';

const box = new THREE.BoxGeometry(1, 1, 1);

export function buildRuins(scene, cols, rows, rng) {
  const group = new THREE.Group(); scene.add(group);
  const halfW = cols * CELL / 2 + 2, halfD = rows * CELL / 2 + 2; // just outside the walls
  const ring = 34; // how far the ruins extend

  // towers
  const N = 320;
  const towers = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0x1c2a30 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const color = new THREE.Color();
  let i = 0;
  const spots = [];
  while (i < N) {
    const x = (rng() - 0.5) * 2 * (halfW + ring), z = (rng() - 0.5) * 2 * (halfD + ring);
    if (Math.abs(x) < halfW + 1.5 && Math.abs(z) < halfD + 1.5) continue; // not inside the district
    const far = Math.max(Math.abs(x) - halfW, Math.abs(z) - halfD) / ring; // 0 near walls .. 1 far
    const w = 2 + rng() * 3, d = 2 + rng() * 3, h = 1 + rng() * (3 + far * 8);
    const lean = rng() < 0.25 ? (rng() - 0.5) * 0.25 : 0;
    e.set(lean, rng() * 0.3, rng() < 0.2 ? (rng() - 0.5) * 0.2 : 0); q.setFromEuler(e);
    m.compose(p.set(x, h / 2 - 0.2, z), q, s.set(w, h, d)); towers.setMatrixAt(i, m);
    color.setHSL(0.55 + rng() * 0.05, 0.25, 0.08 + rng() * 0.08 + far * 0.05); towers.setColorAt(i, color);
    spots.push([x, h, z]); i++;
  }
  towers.instanceMatrix.needsUpdate = true; towers.instanceColor.needsUpdate = true; group.add(towers);

  // rubble: small dark chunks near the walls
  const R = 160;
  const rubble = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0x2a343a }), R);
  for (let k = 0; k < R; k++) {
    const side = (rng() * 4) | 0; const t = (rng() - 0.5) * 2;
    const dist = 1.5 + rng() * 6;
    const [x, z] = side === 0 ? [t * halfW, -halfD - dist] : side === 1 ? [t * halfW, halfD + dist] : side === 2 ? [-halfW - dist, t * halfD] : [halfW + dist, t * halfD];
    e.set(rng() * 0.6, rng() * 3, rng() * 0.6); q.setFromEuler(e);
    const sz = 0.3 + rng() * 0.9; m.compose(p.set(x, sz * 0.3, z), q, s.set(sz, sz * 0.6, sz)); rubble.setMatrixAt(k, m);
  }
  rubble.instanceMatrix.needsUpdate = true; group.add(rubble);

  // fires: emissive embers at the foot of some towers, with smoke columns
  const fires = [], smokes = [];
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a }), glowMat = new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.25, depthWrite: false });
  const smokeMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e, transparent: true, opacity: 0.5, depthWrite: false });
  const picks = spots.filter(([x, , z]) => Math.max(Math.abs(x) - halfW, Math.abs(z) - halfD) < 14).sort(() => rng() - 0.5).slice(0, 10);
  for (const [x, h, z] of picks) {
    const f = new THREE.Mesh(box, fireMat); f.scale.set(0.8, 0.5, 0.8); f.position.set(x + 1.2, 0.25, z + 1.2); group.add(f);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), glowMat); g.rotation.x = -Math.PI / 2; g.position.set(x + 1.2, 0.05, z + 1.2); group.add(g);
    fires.push({ f, g, phase: rng() * 6 });
    for (let k = 0; k < 4; k++) { const sm = new THREE.Mesh(box, smokeMat); sm.position.set(x + 1.2, 1 + k * 1.5, z + 1.2); sm.scale.setScalar(0.8); group.add(sm); smokes.push({ m: sm, x: x + 1.2, z: z + 1.2, y: 1 + k * 1.5, drift: rng() * 6.28 }); }
    void h;
  }

  // searchlight: a bright disc that sweeps across the district now and then
  const beam = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshBasicMaterial({ color: 0xfff4c0, transparent: true, opacity: 0.16, depthWrite: false }));
  beam.rotation.x = -Math.PI / 2; beam.position.y = 0.04; beam.visible = false; group.add(beam);
  let beamT = -20 - rng() * 20, beamFrom = null, beamTo = null;

  function update(dt, t) {
    for (const fr of fires) { const k = 0.7 + Math.sin(t * 17 + fr.phase) * 0.15 + Math.sin(t * 31 + fr.phase * 2) * 0.15; fr.f.scale.y = 0.5 * k + 0.2; fr.g.material.opacity = 0.18 + 0.12 * k; }
    for (const sm of smokes) { sm.y += dt * 0.9; if (sm.y > 8) sm.y = 1; const a = 1 - sm.y / 8; sm.m.position.set(sm.x + Math.sin(t * 0.5 + sm.drift) * 0.8 + sm.y * 0.2, sm.y, sm.z + Math.cos(t * 0.4 + sm.drift) * 0.6); sm.m.scale.setScalar(0.6 + (1 - a) * 2.2); }
    beamT += dt;
    if (beamT > 0 && !beam.visible) { beam.visible = true; const ang = rng() * 6.28; const r = Math.max(halfW, halfD) + 6; beamFrom = [Math.cos(ang) * r, Math.sin(ang) * r]; beamTo = [-beamFrom[0] + (rng() - 0.5) * 20, -beamFrom[1] + (rng() - 0.5) * 20]; }
    if (beam.visible) { const u = beamT / 9; if (u >= 1) { beam.visible = false; beamT = -35 - rng() * 30; } else { beam.position.x = beamFrom[0] + (beamTo[0] - beamFrom[0]) * u; beam.position.z = beamFrom[1] + (beamTo[1] - beamFrom[1]) * u; beam.material.opacity = 0.16 * Math.sin(u * Math.PI); } }
  }
  return { group, update };
}
