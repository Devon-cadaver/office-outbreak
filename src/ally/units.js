// Models shared by Tornado Alley and the menu scene: the cloud-seeding plane and the storm chaser's armoured truck.
import * as THREE from 'three';

export function makePlane() {
  const g = new THREE.Group(); const white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), orange = new THREE.MeshLambertMaterial({ color: 0xf07a28 }), dark = new THREE.MeshLambertMaterial({ color: 0x2a2e33 }), glass = new THREE.MeshLambertMaterial({ color: 0x5a86a8 });
  const bx = new THREE.BoxGeometry(1, 1, 1); const part = (mat, sx, sy, sz, x, y, z, parent = g) => { const m = new THREE.Mesh(bx, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m; };
  part(white, 0.42, 0.42, 2.4, 0, 0, 0); part(glass, 0.36, 0.2, 0.45, 0, 0.2, 0.75); part(orange, 3.4, 0.08, 0.6, 0, 0.05, 0.1); part(white, 1.3, 0.06, 0.38, 0, 0.05, -1.05); part(orange, 0.06, 0.5, 0.42, 0, 0.3, -1.05);
  const props = []; for (const x of [-0.9, 0.9]) { part(white, 0.22, 0.22, 0.6, x, 0, 0.35); const p = part(dark, 0.9, 0.06, 0.06, x, 0, 0.67); props.push(p); }
  for (const x of [-1.5, 1.5]) part(orange, 0.12, 0.12, 0.3, x, -0.06, 0.05); // spray pods under the wingtips
  g.userData.props = props; g.scale.setScalar(0.9); return g;
}
export function makeChaser() {
  const g = new THREE.Group(); const steel = new THREE.MeshLambertMaterial({ color: 0x8a9096 }), dark = new THREE.MeshLambertMaterial({ color: 0x4a5056 }), glass = new THREE.MeshLambertMaterial({ color: 0x3a5a6a }), tire = new THREE.MeshLambertMaterial({ color: 0x1a1a1c });
  const bx = new THREE.BoxGeometry(1, 1, 1); const part = (mat, sx, sy, sz, x, y, z, rx = 0, parent = g) => { const m = new THREE.Mesh(bx, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rx; parent.add(m); return m; };
  part(steel, 0.95, 0.42, 1.9, 0, 0.42, 0); // hull
  part(steel, 0.82, 0.32, 1.05, 0, 0.78, -0.15); // cabin
  part(glass, 0.78, 0.04, 0.42, 0, 0.82, 0.52, -0.55); // sloped windshield
  for (const x of [-0.42, 0.42]) { part(glass, 0.02, 0.18, 0.32, x, 0.8, -0.05); part(dark, 0.06, 0.34, 1.75, x * 1.12, 0.32, 0.02); } // side windows, armour skirts over the wheels
  part(dark, 1.0, 0.36, 0.12, 0, 0.36, 1.0, 0.35); // front plow
  const lit = new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), amber = new THREE.MeshBasicMaterial({ color: 0xffa020 });
  for (let i = 0; i < 5; i++) part(lit, 0.09, 0.08, 0.04, -0.24 + i * 0.12, 0.3, 1.08); for (const x of [-0.42, 0.42]) part(amber, 0.08, 0.06, 0.04, x, 0.42, 1.06);
  const wheel = new THREE.CylinderGeometry(0.17, 0.17, 0.14, 12); for (const z of [0.6, -0.4, -0.72]) for (const x of [-0.46, 0.46]) { const w = new THREE.Mesh(wheel, tire); w.rotation.z = Math.PI / 2; w.position.set(x, 0.17, z); g.add(w); }
  part(steel, 0.42, 0.18, 0.4, 0, 1.03, -0.2); part(glass, 0.38, 0.1, 0.36, 0, 1.08, -0.2); // turret
  const mast = new THREE.Group(); mast.position.set(0, 1.12, -0.25); g.add(mast); part(dark, 0.04, 0.55, 0.04, 0, 0.28, 0, 0, mast); part(dark, 0.6, 0.03, 0.03, 0, 0.52, 0, 0, mast); part(dark, 0.03, 0.03, 0.4, 0.28, 0.52, 0, 0, mast);
  const cup = new THREE.SphereGeometry(0.05, 6, 4); for (const a of [0, 2.1, 4.2]) { const c = new THREE.Mesh(cup, steel); c.position.set(-0.28 + Math.cos(a) * 0.07, 0.6, Math.sin(a) * 0.07); mast.add(c); } g.userData.mast = mast;
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); flash.position.set(0, 1.0, 0.4); g.add(flash); g.userData.flash = flash;
  g.scale.setScalar(1.15); return g;
}
