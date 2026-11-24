// Zombie Air Raid's boss: THE MOTHERSHIP, a warship of our own design. A long dark hull with a forked prow and swept wings,
// a stepped citadel and a row of fins along its back, three big engines astern and a glowing core underneath.
// The model is about 6.4 long and 5 wide, nose toward +z, centred on its core; main.js scales it up and flies it.
//   userData.ring: the core's ring (main.js flashes it red when the ship is hit), userData.engines: the engine glows
import * as THREE from 'three';
export function makeDreadnought() {
  const g = new THREE.Group(), hullM = new THREE.MeshLambertMaterial({ color: 0x66748a, emissive: 0x1a2130 }), darkM = new THREE.MeshLambertMaterial({ color: 0x343c4a, emissive: 0x0e1218 }), plateM = new THREE.MeshLambertMaterial({ color: 0x8c9ab0, emissive: 0x222a38 }); /* (lit a little from within: it has to read against a town at night) */
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c }), green = glow(0x7dff3a), add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  // the hull, drawn from above (x across, y toward the nose): a forked prow, wings swept back, a notched stern
  const half = [[0, 0.9], [0.3, 1.2], [0.35, 3.0], [0.75, 3.2], [1.0, 1.6], [1.3, 0.2], [2.5, -0.9], [1.7, -2.4], [1.0, -3.0], [0, -2.5]], sh = new THREE.Shape();
  sh.moveTo(half[0][0], half[0][1]); for (let i = 1; i < half.length; i++) sh.lineTo(half[i][0], half[i][1]); for (let i = half.length - 2; i >= 1; i--) sh.lineTo(-half[i][0], half[i][1]); sh.closePath();
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.16, bevelSegments: 1 }); hull.rotateX(Math.PI / 2); hull.translate(0, 0.21, 0); g.add(new THREE.Mesh(hull, hullM));
  // armour plates on the wings, and the lit trench down each prong
  for (const s of [-1, 1]) { const p = add(new THREE.BoxGeometry(1.0, 0.1, 1.5), plateM, s * 1.45, 0.42, -1.0); p.rotation.y = s * -0.5; add(new THREE.BoxGeometry(0.07, 0.05, 1.9), green, s * 0.55, 0.4, 2.1); add(new THREE.BoxGeometry(0.06, 0.05, 1.1), green, s * 1.85, 0.4, -1.2).rotation.y = s * -0.5; }
  for (const s of [-1, 1]) { const e = add(new THREE.BoxGeometry(0.07, 0.07, 1.75), green, s * 1.92, 0.25, -0.35); e.rotation.y = s * 0.83; /* the wing's leading edge, lit */ add(new THREE.BoxGeometry(0.07, 0.07, 1.7), green, s * 2.08, 0.25, -1.68).rotation.y = s * -0.49; }
  // the citadel: three steps, set well aft, with a lit band of windows
  add(new THREE.BoxGeometry(1.5, 0.3, 1.9), plateM, 0, 0.52, -1.1); add(new THREE.BoxGeometry(1.05, 0.28, 1.3), hullM, 0, 0.8, -1.25); add(new THREE.BoxGeometry(0.6, 0.24, 0.8), darkM, 0, 1.05, -1.4); add(new THREE.BoxGeometry(1.09, 0.07, 1.34), green, 0, 0.82, -1.25);
  // a row of fins along the spine, growing toward the stern
  for (const [z, h] of [[0.62, 0.3], [0.22, 0.44], [-2.32, 0.62]]) add(new THREE.BoxGeometry(0.07, h, 0.46), darkM, 0, 0.42 + h / 2, z).rotation.x = -0.3;
  // gun turrets on the wings and the prongs
  const tGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.16, 8), bGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 5).rotateX(Math.PI / 2).translate(0, 0.02, 0.28);
  for (const [x, z] of [[1.6, -0.3], [-1.6, -0.3], [0.6, 1.3], [-0.6, 1.3]]) { add(tGeo, darkM, x, 0.5, z); add(bGeo, darkM, x, 0.52, z); }
  // three engines astern, glowing
  const eGeo = new THREE.CylinderGeometry(0.34, 0.4, 0.7, 10).rotateX(Math.PI / 2), fGeo = new THREE.CircleGeometry(0.3, 12).rotateY(Math.PI), engines = [];
  for (const [x, y] of [[-0.95, 0.12], [0, 0.2], [0.95, 0.12]]) { add(eGeo, darkM, x, y, -2.75); engines.push(add(fGeo, glow(0x9dffb0), x, y, -3.11)); }
  // the core underneath: a dish, a bright heart, and the ring that flashes when the ship is hit
  add(new THREE.CylinderGeometry(0.95, 0.6, 0.3, 14), darkM, 0, -0.34, -0.2); add(new THREE.SphereGeometry(0.42, 12, 8), glow(0xc8ffb0), 0, -0.52, -0.2);
  const ring = add(new THREE.TorusGeometry(0.98, 0.07, 6, 22).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9effb0 }), 0, -0.36, -0.2);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.5, 0.14, 2.2), darkM, s * 0.75, -0.3, 0.9); // keels under the prongs
  g.userData.ring = ring; g.userData.engines = engines; return g;
}
