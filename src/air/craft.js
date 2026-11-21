// Zombie Air Raid: the player's two aircraft, the airfield they fly from, and what they drop and fire. Built from the
// same plain boxes and cylinders as the town and the other games' vehicles, then merged so each costs only a few draws.
//   NAPALM BOMBER: the cloud-seeding plane from Tornado Time! repainted in army olive, with its napalm canisters slung
//     under the wings (they go one by one as you drop them, so the plane itself shows what is left).
//   ROCKET HELI: the gunship from Tornado Time!, repainted in army colours, with orange rocket tips.
//   AIRFIELD: a runway, a helipad, a hangar, a control tower with a turning beacon, a fuel truck and a stack of ammo,
//     with a big green ring round it: fly inside the ring to reload and repair.
import * as THREE from 'three';
import { mergeParts } from '../perf.js';
import { makePlane } from '../ally/units.js';
import { makeGunship } from '../ally/foeModels.js';

const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const L = (c) => new THREE.MeshLambertMaterial({ color: c }), B = (c) => new THREE.MeshBasicMaterial({ color: c });
const put = (g, geo, mat, sx, sy, sz, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };

// Repaint a model. Colours that mergeParts has baked into the vertices are swapped there; colours still on a material get
// a fresh copy of that material (so the original game's planes keep their own paint). map: [[fromHex, toHex], ...]
export function recolor(root, map) {
  const pairs = map.map(([a, b]) => [new THREE.Color(a), new THREE.Color(b), a, b]);
  root.traverse((m) => { if (!m.isMesh) return; const mt = m.material;
    if (mt && mt.color && !mt.vertexColors) { const h = mt.color.getHex(); for (const p of pairs) if (h === p[2]) { m.material = mt.clone(); m.material.color.setHex(p[3]); break; } }
    const col = m.geometry && m.geometry.attributes.color; if (!col || !mt || !mt.vertexColors) return; const a = col.array;
    for (let i = 0; i < a.length; i += 3) for (const [ca, cb] of pairs) if (Math.abs(a[i] - ca.r) < 0.004 && Math.abs(a[i + 1] - ca.g) < 0.004 && Math.abs(a[i + 2] - ca.b) < 0.004) { a[i] = cb.r; a[i + 1] = cb.g; a[i + 2] = cb.b; break; }
    col.needsUpdate = true; });
}

// Behind a tall building the aircraft would vanish from view. A gold silhouette of it is drawn first, through everything
// (no depth test), and then the aircraft itself on top: wherever the aircraft can be seen it covers its silhouette, so the
// gold only shows where a building is in the way. (Both are drawn in the solid pass, after the town: renderOrder 5, then 6)
const xrayMat = new THREE.MeshBasicMaterial({ color: 0x765a16, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
export function addXray(g) { g.traverse((m) => { if (m.isMesh) m.renderOrder = 6; }); const x = new THREE.Group(); x.name = 'xray';
  for (const ch of g.children.slice()) { if (ch.isInstancedMesh) continue; const c = ch.clone(true); c.traverse((m) => { if (!m.isMesh) return; if (m.isInstancedMesh || (m.material && m.material.transparent)) { m.visible = false; return; } m.material = xrayMat; m.renderOrder = 5; }); x.add(c); }
  g.add(x); return x; }

// a napalm canister: a fat olive drum with a yellow band. The same shape hangs under the wings and falls from them
const canGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.46, 8).rotateX(Math.PI / 2), canMat = L(0x39461f);
export function makeCanister() { const m = new THREE.Mesh(canGeo, canMat); m.scale.setScalar(1.3); return m; }

export function makeBomber() {
  const g = makePlane(); g.scale.setScalar(1.22);
  recolor(g, [[0xf2f2f2, 0x56653a], [0xf07a28, 0x3b4828], [0x5a86a8, 0x7ab0d0]]); // army olive, darker wings, a lighter canopy
  // the propellers keep spinning, so each one sits in a group of its own and is left out of the merge
  for (const p of g.userData.props) { const pv = new THREE.Group(); pv.position.copy(p.position); p.position.set(0, 0, 0); g.add(pv); pv.add(p); }
  const sand = L(0xc8b070), dark = L(0x2a3020);
  put(g, box, sand, 0.44, 0.44, 0.1, 0, 0, 0.92); put(g, box, sand, 0.08, 0.3, 0.3, 0, 0.32, -1.05); // a sand band round the nose and one on the tail fin, so it reads against the town
  put(g, box, dark, 0.3, 0.2, 1.1, 0, -0.27, 0.05); // a belly pannier the canisters are fed from
  mergeParts(g);
  // the canisters under the wings: one batch; as many are drawn as are left (see setPods)
  const pods = new THREE.InstancedMesh(canGeo, canMat, POD_X.length), m4 = new THREE.Matrix4(); let i = 0;
  for (const x of POD_X) { m4.makeTranslation(x, x > -0.2 && x < 0.2 ? -0.38 : -0.14, 0.12); pods.setMatrixAt(i++, m4); }
  pods.instanceMatrix.needsUpdate = true; pods.frustumCulled = false; g.add(pods); g.userData.pods = pods;
  addXray(g); return g;
}
// show n canisters still hanging under the plane (the outermost go first, the two under the belly last)
const POD_X = [-1.32, -1.12, -0.5, -0.32, -0.1, 0.1, 0.32, 0.5, 1.12, 1.32], POD_ORDER = [0, 9, 1, 8, 2, 7, 3, 6, 4, 5];
export function setPods(g, n) { const pods = g.userData.pods; if (!pods) return; if (pods.userData.n === n) return; pods.userData.n = n; const m4 = new THREE.Matrix4(), N = POD_X.length;
  const keep = POD_ORDER.slice(N - Math.max(0, Math.min(N, n))); let k = 0; for (const j of keep) { const x = POD_X[j]; m4.makeTranslation(x, x > -0.2 && x < 0.2 ? -0.38 : -0.14, 0.12); pods.setMatrixAt(k++, m4); } pods.count = k; pods.instanceMatrix.needsUpdate = true; }

export function makeHeli() {
  const g = makeGunship(); g.scale.setScalar(1.3);
  recolor(g, [[0x6a7c8c, 0x55643c], [0x3a4650, 0x2c3422], [0xf0c020, 0xc8b070], [0xc23b3b, 0x46552e], [0x9fe8ff, 0xff8a3a]]); // army olive, sand bands, orange rocket tips
  addXray(g); return g;
}

// a rocket: olive body, red nose, a hot glow at the back. Two draws. Built once: every shot is a copy that shares its
// geometry and paint, so a round of a few hundred rockets leaves nothing behind on the graphics card
let ROCKET = null;
export function makeRocket() {
  if (!ROCKET) { const g = new THREE.Group(); put(g, cyl, L(0x7c8466), 0.11, 0.55, 0.11, 0, 0, 0).rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 8), L(0xc23b3b)); nose.rotation.x = Math.PI / 2; nose.position.z = 0.35; g.add(nose);
    for (const r of [0, Math.PI / 2]) put(g, box, L(0x3a4028), 0.26, 0.02, 0.12, 0, 0, -0.22, 0).rotation.z = r;
    put(g, new THREE.SphereGeometry(1, 8, 6), B(0xffc060), 0.09, 0.09, 0.13, 0, 0, -0.32);
    mergeParts(g); g.scale.setScalar(1.3); ROCKET = g; }
  return ROCKET.clone();
}

// ---------- the airfield. Local +z points away from town: the runway runs along x on the far side, the helipad, tower,
// hangar and fuel truck stand on the town side. BASE_R is the green ring: inside it you reload and repair ----------
export const BASE_R = 6.4;
export function makeAirfield() {
  const g = new THREE.Group(), white = B(0xdfe6ea);
  put(g, box, L(0x41484c), 31, 0.08, 9, 0, 0.04, 0); // the apron: concrete
  put(g, box, L(0x24282b), 29, 0.03, 3.1, 0, 0.095, 2.25); // the runway
  for (let x = -12; x <= 12; x += 3) put(g, box, white, 1.5, 0.01, 0.14, x, 0.115, 2.25); // centre line
  for (const s of [-1, 1]) for (const dz of [-1.05, -0.35, 0.35, 1.05]) put(g, box, white, 0.9, 0.01, 0.22, s * 13.7, 0.115, 2.25 + dz); // threshold bars
  const amber = B(0xffd24a); for (let x = -14; x <= 14; x += 2) for (const z of [0.6, 3.9]) put(g, box, amber, 0.16, 0.12, 0.16, x, 0.12, z); // edge lights
  for (const [s, c] of [[-1, 0x7dff3a], [1, 0xff4a3a]]) for (const dz of [-1, 0, 1]) put(g, box, B(c), 0.18, 0.14, 0.18, s * 14.6, 0.13, 2.25 + dz); // green at one end, red at the other
  // the helipad
  const hp = new THREE.Group(); hp.position.set(-2.6, 0, -1.6); g.add(hp); // inside the ring, so a helicopter sitting on it reloads
  put(hp, cyl, L(0xd8b42a), 4.5, 0.03, 4.5, 0, 0.1, 0); put(hp, cyl, L(0x2a2e31), 3.8, 0.035, 3.8, 0, 0.11, 0);
  put(hp, box, white, 0.24, 0.01, 1.5, -0.5, 0.135, 0); put(hp, box, white, 0.24, 0.01, 1.5, 0.5, 0.135, 0); put(hp, box, white, 1.0, 0.01, 0.24, 0, 0.135, 0);
  const green = B(0x7dff3a); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; put(hp, box, green, 0.16, 0.12, 0.16, Math.cos(a) * 2.45, 0.13, Math.sin(a) * 2.45); }
  // the hangar: an arched roof with its doors open to the runway
  const hg = new THREE.Group(); hg.position.set(9.8, 0, -1.7); g.add(hg); const roof = L(0x6c7462);
  { const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 5.2, 14, 1, true, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), roof); hg.add(arch);
    const back = new THREE.Mesh(new THREE.CircleGeometry(2.3, 14, 0, Math.PI), roof); back.position.z = -2.6; back.rotation.y = Math.PI; hg.add(back);
    const door = new THREE.Mesh(new THREE.CircleGeometry(2.25, 14, 0, Math.PI), L(0x16181a)); door.position.z = 2.55; hg.add(door);
    for (let k = -2; k <= 2; k++) put(hg, box, L(0x5a6252), 0.08, 0.05, 5.25, Math.sin(k * 0.55) * 2.3, Math.cos(k * 0.55) * 2.3, 0, 0).rotation.z = -k * 0.55; } // ribs over the roof
  // the control tower, its windows lit
  const tw = new THREE.Group(); tw.position.set(4.4, 0, -3.2); g.add(tw);
  put(tw, box, L(0x8f8a7c), 1.1, 2.6, 1.1, 0, 1.3, 0); put(tw, box, B(0x8fd0ff), 1.7, 0.75, 1.7, 0, 2.98, 0); put(tw, box, L(0x3a3d40), 1.95, 0.14, 1.95, 0, 3.42, 0); put(tw, box, L(0x2a2d30), 1.75, 0.1, 1.75, 0, 2.58, 0);
  put(tw, cyl, L(0xcfd4d8), 0.06, 0.9, 0.06, 0.6, 3.9, 0.6);
  const beacon = new THREE.Group(); beacon.position.set(0, 3.62, 0); tw.add(beacon); put(beacon, box, B(0xffe27a), 0.32, 0.26, 0.32, 0, 0, 0);
  const beam = new THREE.Mesh(new THREE.CircleGeometry(9, 5, -0.12, 0.24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beacon.add(beam);
  // the fuel truck
  const ft = new THREE.Group(); ft.position.set(-7.6, 0, -2.6); g.add(ft);
  put(ft, box, L(0x2a3020), 2.9, 0.18, 0.82, 0, 0.32, 0); put(ft, box, L(0x4f5e34), 0.85, 0.72, 0.84, 1.05, 0.72, 0); put(ft, box, B(0x9fd0e8), 0.04, 0.3, 0.66, 1.49, 0.85, 0);
  put(ft, cyl, L(0xb8bec4), 0.86, 1.9, 0.86, -0.35, 0.78, 0).rotation.z = Math.PI / 2; put(ft, cyl, L(0xc23b3b), 0.88, 0.22, 0.88, -0.35, 0.78, 0).rotation.z = Math.PI / 2;
  for (const x of [-1.05, 0.95]) for (const z of [-0.42, 0.42]) put(ft, cyl, L(0x161718), 0.4, 0.14, 0.4, x, 0.2, z).rotation.x = Math.PI / 2;
  // ammo: crates and a cart of canisters by the helipad
  const olive = L(0x56643a); for (const [x, y, z] of [[-13.4, 0.3, -2.6], [-12.6, 0.3, -2.6], [-13, 0.75, -2.6], [-13.4, 0.3, -3.3]]) put(g, box, olive, 0.72, 0.44, 0.52, x, y, z);
  put(g, box, L(0x2a3020), 1.2, 0.12, 0.7, -12.7, 0.3, -1.2); for (const dz of [-0.2, 0.2]) put(g, cyl, canMat, 0.2, 1.0, 0.2, -12.7, 0.48, -1.2 + dz).rotation.z = Math.PI / 2;
  // a windsock at the far corner (it swings)
  put(g, cyl, L(0xcfd4d8), 0.08, 2.4, 0.08, 14.2, 1.2, -3.7); const sock = new THREE.Group(); sock.position.set(14.2, 2.3, -3.7); g.add(sock);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1, 8, 1, true).rotateZ(Math.PI / 2).translate(-0.5, 0, 0), new THREE.MeshLambertMaterial({ color: 0xff7a1a, side: THREE.DoubleSide })); sock.add(cone);
  // the pad, the hangar, the tower and the truck were built in groups of their own for the sums; they join the rest so the
  // whole airfield draws as two meshes (the beacon and the windsock move, so they stay apart)
  g.updateMatrixWorld(true); for (const grp of [hp, hg, tw, ft]) for (const m of grp.children.slice()) if (m.isMesh) g.attach(m);
  mergeParts(g);
  // the green ring: fly inside it to reload and repair (it pulses when you need it)
  const ring = new THREE.Mesh(new THREE.RingGeometry(BASE_R - 0.35, BASE_R, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7dff3a, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })); ring.position.y = 0.16; g.add(ring);
  // a floating badge so it can be found from across town
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#0b1416'; x.strokeStyle = '#7dff3a'; x.lineWidth = 10;
  x.beginPath(); x.moveTo(38, 8); x.arcTo(248, 8, 248, 120, 30); x.arcTo(248, 120, 8, 120, 30); x.arcTo(8, 120, 8, 8, 30); x.arcTo(8, 8, 248, 8, 30); x.closePath(); x.fill(); x.stroke(); x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#7dff3a'; x.fillText('⛽ BASE', 128, 68);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); badge.scale.set(4.4, 2.2, 1); badge.position.set(0, 6.5, 0); badge.renderOrder = 9; g.add(badge);
  g.userData = { ring, beacon, sock, badge, pad: new THREE.Vector3(-2.6, 0, -1.6) };
  return g;
}
