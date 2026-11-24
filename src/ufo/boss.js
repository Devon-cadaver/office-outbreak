// Beam 'Em Up!'s boss: THE IRON MAMMOTH, the army's war machine. A long armoured crawler on four track pods, a spiked ram
// across its nose, a twin-barrel turret, missile racks, and a radar tower astern. About 2.6 wide, 4.6 long and 2.6 tall,
// nose toward +z (it drives down the streets like a tank; army.js runs it as one, with hit points).
//   userData.turret: the turret (army.js turns it to face the saucer; its muzzles are near (±0.3, 0.64, 1.25) in its own space)
//   userData.dish: the radar dish (it turns), userData.eye: the red slit (it flashes when the machine is hit)
import * as THREE from 'three';
export function makeMammoth() {
  const g = new THREE.Group(), L = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e }), B = (c) => new THREE.MeshBasicMaterial({ color: c });
  const steel = L(0x6b7684, 0x161b22), dark = L(0x2a2f37, 0x0a0c10), plate = L(0x8a96a6, 0x1c222b), haz = L(0xffc400, 0x3a2c00), red = B(0xff3a2a);
  const add = (to, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); to.add(m); return m; }, box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // the hull: a long box with a sloped nose and a raised engine deck
  add(g, box(2.0, 0.6, 4.0), steel, 0, 0.78, 0); add(g, box(1.9, 0.5, 1.0), plate, 0, 0.92, 1.85).rotation.x = 0.5; add(g, box(1.8, 0.35, 1.5), plate, 0, 1.2, -1.2);
  // four track pods, each with a hazard stripe
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { add(g, box(0.56, 0.72, 1.75), dark, sx * 1.04, 0.36, sz * 1.12); add(g, box(0.58, 0.1, 1.2), haz, sx * 1.04, 0.74, sz * 1.12); for (let i = 0; i < 3; i++) add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8).rotateZ(Math.PI / 2), steel, sx * 1.04, 0.24, sz * 1.12 + (i - 1) * 0.55); }
  // the ram: a blade across the nose with a row of spikes
  add(g, box(2.5, 0.75, 0.18), dark, 0, 0.5, 2.34).rotation.x = -0.25; for (let i = 0; i < 5; i++) add(g, new THREE.ConeGeometry(0.11, 0.5, 6).rotateX(Math.PI / 2), plate, (i - 2) * 0.52, 0.5, 2.62);
  // the turret: twin barrels, and a red slit to see by
  const tur = new THREE.Group(); tur.position.set(0, 1.08, 0.35); g.add(tur);
  add(tur, new THREE.CylinderGeometry(0.8, 0.9, 0.3, 12), dark, 0, 0.15, 0); add(tur, box(1.35, 0.55, 1.5), steel, 0, 0.55, -0.1); add(tur, box(1.1, 0.2, 1.0), plate, 0, 0.9, -0.2);
  for (const sx of [-1, 1]) { add(tur, new THREE.CylinderGeometry(0.09, 0.11, 1.3, 8).rotateX(Math.PI / 2), dark, sx * 0.3, 0.6, 1.1); add(tur, new THREE.CylinderGeometry(0.14, 0.14, 0.22, 8).rotateX(Math.PI / 2), plate, sx * 0.3, 0.6, 1.7); }
  const eye = add(tur, box(0.8, 0.09, 0.05), new THREE.MeshBasicMaterial({ color: 0xff3a2a }), 0, 0.62, 0.66);
  // missile racks on its shoulders
  for (const sx of [-1, 1]) { const r = add(g, box(0.5, 0.42, 0.95), dark, sx * 0.78, 1.5, -0.75); r.rotation.x = -0.45; for (let i = 0; i < 2; i++) add(g, new THREE.ConeGeometry(0.09, 0.24, 6).rotateX(Math.PI / 2), red, sx * (0.67 + i * 0.22), 1.72, -0.34).rotation.x = -0.45; }
  // the radar tower astern, its dish, two smokestacks, and warning lights
  add(g, box(0.85, 0.9, 0.85), steel, 0, 1.8, -1.55); add(g, box(0.89, 0.12, 0.89), haz, 0, 2.12, -1.55); add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.4, 5), dark, 0, 2.45, -1.55);
  const dish = new THREE.Group(); dish.position.set(0, 2.65, -1.55); g.add(dish); add(dish, new THREE.CylinderGeometry(0.42, 0.12, 0.16, 12).rotateX(Math.PI / 2.4), plate, 0, 0, 0.05);
  for (const sx of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.11, 0.13, 0.75, 7), dark, sx * 0.6, 1.72, -1.92); add(g, box(0.12, 0.12, 0.12), red, sx * 0.95, 1.14, 1.5); add(g, box(0.12, 0.12, 0.12), red, sx * 0.95, 1.14, -1.95); }
  g.userData.turret = tur; g.userData.dish = dish; g.userData.eye = eye; return g;
}
