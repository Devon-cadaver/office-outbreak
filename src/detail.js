// World detail shared by both games: wind-swayed grass blades, drifting clouds with ground shadows, and street litter.
// Everything is instanced (one draw call per kind) so it stays cheap on phones.
import * as THREE from 'three';

const uTime = { value: 0 };

function bladeGeometry() {
  // two crossed triangles so a blade reads from every angle; normals point up so lighting is even
  const h = 0.4, w = 0.045;
  const v = [-w, 0, 0, w, 0, 0, 0, h, 0, 0, 0, -w, 0, 0, w, 0, h, 0];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); return g;
}
function swayMaterial() {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => { sh.uniforms.uTime = uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float bh = clamp(position.y / 0.4, 0.0, 1.0); vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
    float gust = sin(uTime * 0.6 + ip.x * 0.05) * 0.5 + 0.7;
    transformed.x += sin(uTime * 2.1 + ip.x * 0.45 + ip.z * 0.25) * 0.09 * bh * bh * gust;
    transformed.z += cos(uTime * 1.7 + ip.z * 0.4) * 0.05 * bh * bh * gust;`); };
  return m;
}

export function createDetail(group, { grassCells, streetCells, cell, W, D, rng = Math.random }) {
  const out = { group: new THREE.Group() }; group.add(out.group); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();

  // grass
  const cap = 9000, per = grassCells.length ? Math.min(240, Math.floor(cap / grassCells.length)) : 0, count = per * grassCells.length;
  if (count) {
    const grass = new THREE.InstancedMesh(bladeGeometry(), swayMaterial(), count); let k = 0;
    for (const c of grassCells) for (let i = 0; i < per; i++) {
      let ox = 0, oz = 0, tries = 0; do { ox = (rng() - 0.5) * cell * 0.96; oz = (rng() - 0.5) * cell * 0.96; tries++; } while (tries < 12 && c.roads && c.roads.some(([dx, dz]) => (dx ? Math.sign(ox) === dx || Math.abs(ox) < 0.95 : Math.sign(oz) === dz || Math.abs(oz) < 0.95) && (dx ? Math.abs(oz) < 0.95 : Math.abs(ox) < 0.95)));
      if (tries >= 12) { s.set(0, 0, 0); m4.compose(p.set(c.x, -5, c.z), q.identity(), s); grass.setMatrixAt(k, m4); grass.setColorAt(k, col.set(0)); k++; continue; }
      p.set(c.x + ox, 0.02, c.z + oz); e.set((rng() - 0.5) * 0.4, rng() * 6.28, (rng() - 0.5) * 0.4); q.setFromEuler(e); const sc = 0.5 + rng() * 0.5; s.set(sc * 1.2, sc * (0.45 + rng() * 0.55), sc * 1.2);
      m4.compose(p, q, s); grass.setMatrixAt(k, m4); col.setHSL(0.25 + rng() * 0.09, 0.5 + rng() * 0.25, 0.28 + rng() * 0.2); grass.setColorAt(k, col); k++;
    }
    grass.instanceMatrix.needsUpdate = true; grass.frustumCulled = false; out.group.add(grass);
  }

  // street litter: paper scraps and the odd trash bag
  const papers = [], bags = [];
  for (const c of streetCells) { const n = rng() < 0.55 ? 1 + ((rng() * 2) | 0) : 0; for (let i = 0; i < n; i++) papers.push(c); if (rng() < 0.12) bags.push(c); }
  if (papers.length) {
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.012, 0.14), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.min(papers.length, 2200));
    for (let i = 0; i < pm.count; i++) { const c = papers[i]; p.set(c.x + (rng() - 0.5) * cell * 0.9, 0.025, c.z + (rng() - 0.5) * cell * 0.9); e.set(0, rng() * 6.28, 0); q.setFromEuler(e); s.set(0.6 + rng(), 1, 0.6 + rng()); m4.compose(p, q, s); pm.setMatrixAt(i, m4); col.setHSL(0.12, 0.1, 0.45 + rng() * 0.35); pm.setColorAt(i, col); }
    out.group.add(pm);
  }
  if (bags.length) {
    const bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), bags.length);
    bags.forEach((c, i) => { const side = rng() < 0.5 ? -1 : 1; p.set(c.x + side * cell * 0.38, 0.14, c.z + (rng() - 0.5) * cell * 0.7); e.set(0, rng() * 6.28, 0); q.setFromEuler(e); s.set(1 + rng() * 0.4, 0.7 + rng() * 0.3, 1); m4.compose(p, q, s); bm.setMatrixAt(i, m4); col.set(rng() < 0.5 ? 0x1a1f1c : 0x2a3a2a); bm.setColorAt(i, col); });
    out.group.add(bm);
  }

  // clouds: thin wisps drifting high over the city, and their shadows sliding over the streets below
  const CL = 9, PUFFS = 5; const cloudMat = new THREE.MeshBasicMaterial({ color: 0xd8d0ec, transparent: true, opacity: 0.2, depthWrite: false, fog: false });
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), cloudMat, CL * PUFFS);
  const shadowGeo = new THREE.CircleGeometry(1, 20); shadowGeo.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }), CL * PUFFS);
  const span = Math.max(W, D) + 40; const cloud = [];
  for (let i = 0; i < CL; i++) { const base = new THREE.Vector3((rng() - 0.5) * span, 22 + rng() * 5, (rng() - 0.5) * span); const puffs = []; for (let j = 0; j < PUFFS; j++) puffs.push({ o: new THREE.Vector3((rng() - 0.5) * 9, (rng() - 0.5) * 1.5, (rng() - 0.5) * 5), r: 2.5 + rng() * 3 }); cloud.push({ base, puffs, v: 0.6 + rng() * 0.6 }); }
  clouds.frustumCulled = false; shadows.frustumCulled = false; shadows.renderOrder = 1; out.group.add(clouds, shadows); out.clouds = clouds;
  const halfS = span / 2;
  out.update = (dt) => {
    uTime.value += dt; let k = 0;
    for (const c of cloud) { c.base.x += c.v * dt; c.base.z += c.v * 0.3 * dt; if (c.base.x > halfS) c.base.x = -halfS; if (c.base.z > halfS) c.base.z = -halfS;
      for (const pf of c.puffs) { p.copy(c.base).add(pf.o); q.identity(); s.set(pf.r * 1.5, pf.r * 0.5, pf.r); m4.compose(p, q, s); clouds.setMatrixAt(k, m4); p.y = 0.06; s.set(pf.r * 1.3, 1, pf.r * 0.9); m4.compose(p, q, s); shadows.setMatrixAt(k, m4); k++; } }
    clouds.instanceMatrix.needsUpdate = true; shadows.instanceMatrix.needsUpdate = true;
  };
  // the chase cameras sit under the clouds, so only their shadows show there
  out.sky = (topDown = true) => { clouds.visible = topDown; };
  return out;
}
