// Rescue helicopter for the final district.
import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1);
const M = (c) => new THREE.MeshLambertMaterial({ color: c });

export function makeChopper() {
  const g = new THREE.Group();
  const body = M(0x3a4a5a), dark = M(0x1e262e), glass = M(0x8fd0ff);
  const part = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(box, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; };
  part(body, 1.0, 0.7, 2.0, 0, 0.8, 0);           // cabin
  part(glass, 0.9, 0.45, 0.5, 0, 0.9, 0.95);       // cockpit glass
  part(body, 0.3, 0.3, 2.0, 0, 0.95, -1.8);        // tail boom
  part(body, 0.1, 0.8, 0.5, 0, 1.3, -2.7);         // tail fin
  part(dark, 0.08, 0.08, 1.2, -0.45, 0.2, 0); part(dark, 0.08, 0.08, 1.2, 0.45, 0.2, 0); // skids
  part(dark, 0.08, 0.3, 0.08, -0.45, 0.4, 0.4); part(dark, 0.08, 0.3, 0.08, 0.45, 0.4, 0.4);
  part(dark, 0.08, 0.3, 0.08, -0.45, 0.4, -0.4); part(dark, 0.08, 0.3, 0.08, 0.45, 0.4, -0.4);
  part(dark, 0.15, 0.3, 0.15, 0, 1.3, 0);          // rotor mast
  const rotor = new THREE.Group(); rotor.position.set(0, 1.45, 0); g.add(rotor);
  for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(box, dark); b.scale.set(0.12, 0.04, 3.6); b.rotation.y = r; rotor.add(b); }
  const tailRotor = new THREE.Group(); tailRotor.position.set(0.2, 1.3, -2.7); g.add(tailRotor);
  for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(box, dark); b.scale.set(0.04, 0.7, 0.08); b.rotation.x = r; tailRotor.add(b); }
  const beacon = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xff3a3a })); beacon.scale.set(0.12, 0.12, 0.12); beacon.position.set(0, 1.0, -2.6); g.add(beacon);
  const light = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  light.position.y = -1.3; g.add(light);
  g.userData = { rotor, tailRotor, beacon, light };
  return g;
}

export function animateChopper(g, dt, t) {
  g.userData.rotor.rotation.y += dt * 25;
  g.userData.tailRotor.rotation.x += dt * 30;
  g.userData.beacon.visible = Math.sin(t * 8) > 0;
}
