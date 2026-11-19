// Models for Tornado Alley's bigger enemies (see foes.js): the storm cannon's horn truck, the gunship and the saucer.
import * as THREE from 'three';
import { mergeParts } from '../perf.js';

const L = (c) => new THREE.MeshLambertMaterial({ color: c });
const bx = new THREE.BoxGeometry(1, 1, 1);
const part = (g, mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(bx, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; };

// The storm cannon: an army truck with a great sonic horn on a turntable. userData.horn turns to aim (its mouth faces
// +z), userData.glow lights up in the mouth as it charges.
export function makeHornTruck() {
  const g = new THREE.Group(), olive = L(0x4a5a32), light = L(0x5e6e40), dark = L(0x2a3020), tire = L(0x1a1a1c), warn = L(0xf0b428), glass = L(0x3a5a6a);
  part(g, olive, 0.95, 0.2, 2.3, 0, 0.42, 0); part(g, dark, 0.7, 0.16, 2.0, 0, 0.26, 0); // flatbed and chassis
  part(g, light, 0.9, 0.52, 0.62, 0, 0.78, 0.8); part(g, glass, 0.8, 0.22, 0.04, 0, 0.86, 1.12); part(g, olive, 0.9, 0.24, 0.3, 0, 0.56, 1.2); // cab, windscreen, bonnet
  part(g, warn, 0.95, 0.07, 0.08, 0, 0.5, -1.16); for (const x of [-0.4, 0.4]) part(g, warn, 0.1, 0.07, 0.06, x, 0.6, 1.36); // hazard bar, lamps
  const wheel = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12); for (const z of [0.85, -0.3, -0.85]) for (const x of [-0.46, 0.46]) { const w = new THREE.Mesh(wheel, tire); w.rotation.z = Math.PI / 2; w.position.set(x, 0.2, z); g.add(w); }
  const horn = new THREE.Group(); horn.position.set(0, 0.52, -0.35); g.add(horn);
  part(horn, dark, 0.6, 0.14, 0.6, 0, 0.07, 0); part(horn, dark, 0.16, 0.5, 0.16, 0, 0.36, -0.1); for (const x of [-0.22, 0.22]) part(horn, light, 0.06, 0.4, 0.3, x, 0.46, 0.0); // turntable, post, cradle
  const steel = new THREE.MeshLambertMaterial({ color: 0x9aa2aa, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.13, 1.05, 18, 1, true), steel); cone.rotation.x = Math.PI / 2; cone.position.set(0, 0.7, 0.32); horn.add(cone);
  for (const [r, z] of [[0.66, 0.84], [0.42, 0.36]]) { const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 6, 20), dark); band.position.set(0, 0.7, z); horn.add(band); }
  part(horn, dark, 0.3, 0.3, 0.3, 0, 0.7, -0.3); // the driver unit behind the horn
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 18), new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); glow.position.set(0, 0.7, 0.8); horn.add(glow);
  mergeParts(g); g.userData.horn = horn; g.userData.glow = glow; g.scale.setScalar(1.3); return g;
}

// A gunship: a squat attack helicopter with freeze-rocket pods under stub wings. userData.props spin (the main rotor,
// about y); userData.tail is the tail rotor.
export function makeGunship() {
  const g = new THREE.Group(), body = L(0x6a7c8c), belly = L(0x3a4650), stripe = L(0xf0c020), dark = L(0x15191c), glass = L(0x6ab0c8), red = L(0xc23b3b), ice = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
  part(g, body, 0.62, 0.52, 1.5, 0, 0, 0.1); part(g, belly, 0.5, 0.2, 1.2, 0, -0.3, 0.1); part(g, glass, 0.5, 0.34, 0.5, 0, 0.08, 0.86); part(g, body, 0.4, 0.3, 0.3, 0, -0.06, 1.1); // fuselage, belly, canopy, nose
  part(g, body, 0.2, 0.2, 1.3, 0, 0.12, -1.25); part(g, red, 0.06, 0.55, 0.32, 0, 0.36, -1.82); part(g, body, 0.6, 0.05, 0.22, 0, 0.16, -1.8); // tail boom, fin, tailplane
  part(g, belly, 1.7, 0.07, 0.34, 0, -0.1, 0.1); for (const x of [-0.72, 0.72]) { part(g, dark, 0.2, 0.2, 0.62, x, -0.24, 0.12); part(g, ice, 0.14, 0.14, 0.08, x, -0.24, 0.46); } // stub wings, rocket pods with icy tips
  for (const x of [-0.3, 0.3]) { part(g, dark, 0.05, 0.05, 1.3, x, -0.52, 0.15); for (const z of [-0.3, 0.6]) part(g, dark, 0.04, 0.16, 0.04, x, -0.44, z); } // skids
  part(g, dark, 0.14, 0.16, 0.14, 0, 0.32, 0.1); part(g, stripe, 0.64, 0.12, 0.2, 0, 0.12, -0.5); part(g, stripe, 0.22, 0.22, 0.14, 0, 0.12, -1.5); // mast, and yellow bands so it stands out against the town at night
  const rotor = new THREE.Group(); rotor.position.set(0, 0.42, 0.1); part(rotor, dark, 3.3, 0.03, 0.15, 0, 0, 0); part(rotor, dark, 0.15, 0.03, 3.3, 0, 0, 0); g.add(rotor);
  const blur = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshBasicMaterial({ color: 0xdfeaf2, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide })); blur.rotation.x = -Math.PI / 2; blur.position.set(0, 0.43, 0.1); g.add(blur); // the rotor's blur: what you see of a helicopter from above
  const tail = new THREE.Group(); tail.position.set(0.1, 0.36, -1.82); part(tail, dark, 0.03, 0.74, 0.08, 0, 0, 0); part(tail, dark, 0.03, 0.08, 0.74, 0, 0, 0); g.add(tail);
  mergeParts(g); g.userData.props = [rotor]; g.userData.tail = tail; g.userData.strip = [blur]; g.scale.setScalar(0.95); return g;
}

// The saucer: a wide disc with a glowing dome, running lights round the rim and a lamp underneath. userData: ring (the
// lights, which run round), shield (a bubble, hidden when it is down), eye (the lamp), strip (what comes off before it
// breaks up on the ground: the see-through and glowing bits).
export function makeSaucer() {
  const g = new THREE.Group(), hull = L(0xb4bcc6), dark = L(0x4a525c);
  const prof = [[0, -0.34], [0.75, -0.32], [1.95, -0.04], [2.05, 0.04], [1.9, 0.12], [0.95, 0.36], [0, 0.4]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 30), hull));
  const under = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.42, 0.16, 18), dark); under.position.y = -0.38; g.add(under);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.76, 18, 10, 0, 6.2832, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x7dffd0, emissive: 0x1a8a6a, transparent: true, opacity: 0.88 })); dome.position.y = 0.32; g.add(dome);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.38, 18), new THREE.MeshBasicMaterial({ color: 0x7dff3a })); eye.rotation.x = Math.PI / 2; eye.position.y = -0.47; g.add(eye);
  const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x2 = c.getContext('2d'); x2.fillStyle = '#12301e'; x2.fillRect(0, 0, 64, 8); x2.fillStyle = '#ffffff'; x2.fillRect(8, 0, 22, 8);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(10, 1); tex.colorSpace = THREE.SRGBColorSpace;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.98, 0.075, 6, 40), new THREE.MeshBasicMaterial({ map: tex, color: 0x9dffb0 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; g.add(ring);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.7, 22, 12), new THREE.MeshBasicMaterial({ color: 0x6affd8, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending })); shield.scale.y = 0.5; shield.renderOrder = 3; g.add(shield);
  g.userData = { ring, shield, eye, strip: [ring, shield, dome, eye] }; return g;
}
