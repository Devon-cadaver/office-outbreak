// BEAM 'EM UP! models: the player's saucer (the same shape as Tornado Time!'s enemy UFO, but in the player's own colours
// and with a little pilot in the dome), the tractor beam that shines under it, the death ray, and the army's missile truck.
import * as THREE from 'three';
import { makeSaucer } from '../ally/foeModels.js';
import { mergeParts } from '../perf.js';

const L = (c) => new THREE.MeshLambertMaterial({ color: c });
const bx = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(0.5, 12, 8);
const part = (g, geo, mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; };

// The player's saucer: a violet hull with gold running lights, a green glass dome with the pilot inside, and a green shield
// bubble. userData (from makeSaucer): ring (the lights; its texture scrolls round), shield (the bubble), eye (the lamp
// underneath, where both beams come from), strip (what comes off before the wreck breaks up). Plus pilot (turns to look
// where the ship is going) and dome (it flashes each time someone comes aboard).
export function makeShip() {
  const g = makeSaucer(), u = g.userData, [hull, under, dome] = g.children;
  hull.material.color.setHex(0xa47cff); hull.material.emissive.setHex(0x2a1458); under.material.color.setHex(0x3a2260); // a little glow of its own, so it stands out over a town at night
  dome.material.color.setHex(0x8aff6a); dome.material.emissive.setHex(0x2a7a1a); dome.material.opacity = 0.62;
  u.ring.material.color.setHex(0xffd24a); u.eye.material.color.setHex(0x7df0ff); u.shield.material.color.setHex(0x7dff3a);
  // a band of violet panels round the hull, so it reads as a different ship from the army's grey saucer. The solid parts
  // are merged into a few draws (see perf.js mergeParts); the glass, the lights, the lamp and the shield stay apart
  const shell = new THREE.Group(); g.add(shell); shell.add(hull, under);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.07, 6, 36), L(0xc9a6ff)); band.rotation.x = Math.PI / 2; band.position.y = 0.2; shell.add(band);
  const pods = new THREE.Group(); g.add(pods); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, pod = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: 0xff5ae0 })); pod.scale.set(0.22, 0.12, 0.22); pod.position.set(Math.cos(a) * 1.15, -0.28, Math.sin(a) * 1.15); pods.add(pod); } // glowing thruster pods underneath
  // the pilot: a round green head with big dark eyes and an antenna, sitting in the dome
  const pilot = new THREE.Group(); pilot.position.y = 0.42; g.add(pilot); const skin = L(0x7dd84a), dark = new THREE.MeshBasicMaterial({ color: 0x0a0a12 });
  part(pilot, sph, L(0x5a3a8a), 0.5, 0.3, 0.42, 0, -0.06, 0); part(pilot, sph, skin, 0.5, 0.46, 0.46, 0, 0.26, 0);
  for (const x of [-0.11, 0.11]) { const e = part(pilot, sph, dark, 0.15, 0.2, 0.08, x, 0.28, 0.19); e.rotation.z = x > 0 ? -0.5 : 0.5; }
  part(pilot, bx, skin, 0.025, 0.24, 0.025, 0, 0.58, 0); part(pilot, sph, new THREE.MeshBasicMaterial({ color: 0xffd24a }), 0.09, 0.09, 0.09, 0, 0.71, 0);
  mergeParts(shell); mergeParts(pods); mergeParts(pilot); // (the glowing hull is left out of the merge on its own: merged parts can't glow)
  u.pilot = pilot; u.dome = dome; u.pods = pods; return g;
}

// stripes that run up the tractor beam: soft bands on a canvas, scrolled each frame
function stripeTex() { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.15)'); gr.addColorStop(0.45, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0.15)'); x.fillStyle = gr; x.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t; }
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

// The tractor beam: a cone of light from the ship's belly down to the ground (narrow at the ship), a brighter core, rings of
// light that climb it toward the ship, and a glowing disc where it touches the street. Built pointing down from y = 0 and
// one unit long; update() stretches it to the ship's height and the beam's width, and fades it in and out.
export function makeBeam() {
  const g = new THREE.Group(), add = (m) => { m.frustumCulled = false; m.renderOrder = 4; g.add(m); return m; };
  const stripes = stripeTex(), mk = (color, op) => new THREE.MeshBasicMaterial({ color, map: stripes, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const outer = add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 1, 1, 28, 1, true).translate(0, -0.5, 0), mk(0x5ae8ff, 0.3)));
  const core = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.5, 1, 20, 1, true).translate(0, -0.5, 0), mk(0xc8ffe8, 0.38)));
  const ringGeo = new THREE.TorusGeometry(1, 0.04, 5, 32).rotateX(Math.PI / 2), ringMat = new THREE.MeshBasicMaterial({ color: 0x9affd8, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  const rings = [0, 0.33, 0.66].map((ph) => { const m = add(new THREE.Mesh(ringGeo, ringMat)); m.userData.ph = ph; return m; });
  const disc = add(new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7df0ff, map: glowTex(), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));
  let k = 0, t = 0; g.visible = false;
  // len: how far down the ground is; R: the beam's radius on the ground; on: beaming or not
  function update(dt, len, R, on) { k = Math.max(0, Math.min(1, k + (on ? dt * 6 : -dt * 5))); g.visible = k > 0.01; if (!g.visible) return; t += dt;
    const w = R * (0.85 + 0.15 * k); outer.scale.set(w, len, w); core.scale.set(w, len, w); stripes.offset.y -= dt * 1.6;
    outer.material.opacity = 0.3 * k * (0.85 + Math.sin(t * 23) * 0.15); core.material.opacity = 0.38 * k;
    for (const r of rings) { const f = (t * 0.7 + r.userData.ph) % 1, y = -len * (1 - f), rr = w * (0.32 + 0.68 * (1 - f)); r.position.y = y; r.scale.setScalar(rr); } ringMat.opacity = 0.75 * k;
    disc.position.y = -len + 0.14; disc.scale.setScalar(w * (1.05 + Math.sin(t * 9) * 0.05)); disc.material.opacity = 0.55 * k; }
  return { g, update, get k() { return k; } };
}

// The death ray: a hot pink beam with a white core from the ship's lamp to whatever was tapped. Lives a fifth of a second.
const rayGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0), UPV = new THREE.Vector3(0, 1, 0);
export function makeRay(scene) {
  const list = [], outerMat = new THREE.MeshBasicMaterial({ color: 0xff3ad0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }), coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  function fire(from, to) { const dir = to.clone().sub(from), len = dir.length(); dir.normalize(); const g = new THREE.Group(); g.position.copy(from); g.quaternion.setFromUnitVectors(UPV, dir);
    const o = new THREE.Mesh(rayGeo, outerMat.clone()), c = new THREE.Mesh(rayGeo, coreMat.clone()); o.scale.set(0.2, len, 0.2); c.scale.set(0.07, len, 0.07); o.frustumCulled = c.frustumCulled = false; o.renderOrder = c.renderOrder = 6; g.add(o, c); scene.add(g); list.push({ g, o, c, t: 0 }); }
  function update(dt) { for (let i = list.length - 1; i >= 0; i--) { const r = list[i]; r.t += dt; const k = Math.max(0, 1 - r.t / 0.22); r.o.material.opacity = 0.8 * k; r.c.material.opacity = k; const w = 0.2 * (0.6 + k * 0.6) * (1 + Math.sin(r.t * 90) * 0.15); r.o.scale.x = r.o.scale.z = w;
      if (k <= 0) { scene.remove(r.g); r.o.material.dispose(); r.c.material.dispose(); list.splice(i, 1); } } }
  function clear() { for (const r of list) { scene.remove(r.g); r.o.material.dispose(); r.c.material.dispose(); } list.length = 0; }
  function setColors(c) { outerMat.color.setHex(c ? c[0] : 0xff3ad0); coreMat.color.setHex(c ? c[1] : 0xffffff); } // a saucer skin's ray colours (null: the usual)
  return { fire, update, clear, setColors };
}

// The army's fighter jet (strafing runs, Suburbs on): a long pale blue-grey fuselage (the helicopters' paint, lighter, so it
// reads over a town at night) with a pointed nose and a bubble canopy, swept wings and tailplanes cut from flat shapes, one
// swept red tail fin, yellow bands, red and green wingtip lights, and an afterburner flame that flickers. Nose along +z.
// Built once; every jet is a copy sharing its shapes and paint.
// userData: burner (the flame: scale.z flickers), strip (what comes off before a wreck breaks up), props (none: it has no
// propellers, but the crash code spins whatever is listed there)
const flat = (pts, depth) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) s.lineTo(x, y); return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); };
let JET = null;
export function makeJet() {
  if (!JET) { const g = new THREE.Group(), body = L(0x9aaab8), belly = L(0xc8d2da), dark = L(0x3a4650), glass = L(0x5ab8e0), band = L(0xffc81e), fin = L(0xc23b3b);
    part(g, bx, body, 0.46, 0.42, 2.7, 0, 0, -0.05); part(g, bx, belly, 0.4, 0.14, 2.3, 0, -0.2, 0.05); // fuselage and belly
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.95, 10), body); nose.rotation.x = Math.PI / 2; nose.position.z = 1.76; g.add(nose); // the pointed nose (+z)
    part(g, sph, glass, 0.32, 0.27, 0.95, 0, 0.23, 0.72); // the bubble canopy
    for (const x of [-0.31, 0.31]) part(g, bx, dark, 0.16, 0.26, 0.7, x, -0.04, 0.25); // air intakes
    const wing = new THREE.Mesh(flat([[-1.75, -0.95], [-1.75, -0.62], [-0.22, 0.55], [0.22, 0.55], [1.75, -0.62], [1.75, -0.95], [0.22, -0.78], [-0.22, -0.78]], 0.07).rotateX(Math.PI / 2), body); wing.position.set(0, -0.02, 0); g.add(wing); // swept wings, one flat shape (laid down: its y runs along +z)
    const tail = new THREE.Mesh(flat([[-0.78, -0.42], [-0.78, -0.22], [-0.16, 0.18], [0.16, 0.18], [0.78, -0.22], [0.78, -0.42]], 0.05).rotateX(Math.PI / 2), body); tail.position.set(0, 0.02, -1.05); g.add(tail); // tailplanes
    const tf = new THREE.Mesh(flat([[0, 0], [0.62, 0], [0.98, 0.82], [0.66, 0.82]], 0.06).rotateY(Math.PI / 2), fin); tf.position.set(-0.03, 0.18, -0.68); g.add(tf); // the tail fin, swept back (its x runs back along -z)
    part(g, bx, band, 0.48, 0.44, 0.14, 0, 0, 1.05); part(g, bx, band, 0.48, 0.44, 0.14, 0, 0, -1.15); part(g, bx, band, 0.4, 0.08, 0.3, -1.25, -0.03, -0.62); part(g, bx, band, 0.4, 0.08, 0.3, 1.25, -0.03, -0.62); // yellow bands round the nose and the tail, and across the wings
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.32, 10), dark); noz.rotation.x = Math.PI / 2; noz.position.z = -1.5; g.add(noz); // the engine nozzle
    part(g, bx, new THREE.MeshBasicMaterial({ color: 0xff3a2a }), 0.12, 0.1, 0.16, -1.72, -0.03, -0.78); part(g, bx, new THREE.MeshBasicMaterial({ color: 0x5aff6a }), 0.12, 0.1, 0.16, 1.72, -0.03, -0.78); // wingtip lights
    mergeParts(g);
    const burner = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.5, 10, 1, true).translate(0, 0.75, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    burner.position.z = -1.62; burner.renderOrder = 6; g.add(burner); g.scale.setScalar(1.3); JET = g; }
  const g = JET.clone(); const burner = g.children[g.children.length - 1]; g.userData = { burner, strip: [burner], props: [] }; return g;
}

// A strafing jet's warning: a red lane on the street with dashed edges and arrows down the middle the way the jet will come.
// One unit wide and one long, lying flat and centred, running along its +z; army.js scales it to the lane and turns it to the
// jet's heading. Its texture scrolls so the dashes run the way the jet will fly. Drawn over the buildings, like the horn truck's line
export function makeLane() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,40,30,0.2)'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#ff3a2a'; x.fillRect(0, 0, 7, 38); x.fillRect(57, 0, 7, 38); // a faint fill, and the dashed edges
  x.strokeStyle = 'rgba(255,140,110,0.95)'; x.lineWidth = 6; x.beginPath(); x.moveTo(18, 26); x.lineTo(32, 42); x.lineTo(46, 26); x.stroke(); // a chevron pointing down the texture: the lane's +z, the way the jet flies
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
  m.renderOrder = 8; m.frustumCulled = false; return m;
}

// The army's missile truck: an olive truck carrying a box of four missile tubes on a turntable. userData.turret turns
// (its tubes face +z), userData.rack tilts up to aim, userData.lamp glows red while it locks on.
export function makeLauncher() {
  const g = new THREE.Group(), olive = L(0x4a5a32), light = L(0x5e6e40), dark = L(0x2a3020), tire = L(0x1a1a1c), glass = L(0x3a5a6a), warn = L(0xf0b428);
  part(g, bx, olive, 0.95, 0.2, 2.2, 0, 0.42, 0); part(g, bx, dark, 0.7, 0.16, 1.9, 0, 0.26, 0); // flatbed and chassis
  part(g, bx, light, 0.9, 0.5, 0.6, 0, 0.76, 0.8); part(g, bx, glass, 0.8, 0.2, 0.04, 0, 0.84, 1.11); part(g, bx, warn, 0.95, 0.07, 0.08, 0, 0.5, -1.1); // cab, windscreen, hazard bar
  const wheel = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12); for (const z of [0.8, -0.3, -0.8]) for (const x of [-0.46, 0.46]) { const w = new THREE.Mesh(wheel, tire); w.rotation.z = Math.PI / 2; w.position.set(x, 0.2, z); g.add(w); }
  const turret = new THREE.Group(); turret.position.set(0, 0.52, -0.35); g.add(turret); part(turret, bx, dark, 0.6, 0.14, 0.6, 0, 0.07, 0); part(turret, bx, dark, 0.16, 0.36, 0.16, 0, 0.3, 0);
  const rack = new THREE.Group(); rack.position.y = 0.5; turret.add(rack); part(rack, bx, olive, 0.78, 0.5, 1.05, 0, 0, 0.1); part(rack, bx, light, 0.82, 0.08, 1.07, 0, 0.27, 0.1);
  const tube = L(0x14161a); for (const x of [-0.19, 0.19]) for (const y of [-0.11, 0.11]) { const t = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), tube); t.position.set(x, y, 0.63); rack.add(t); }
  const lamp = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.25 })); lamp.scale.setScalar(0.2); lamp.position.set(0, 0.42, -0.25); rack.add(lamp);
  mergeParts(g); g.userData.turret = turret; g.userData.rack = rack; g.userData.lamp = lamp; g.scale.setScalar(1.25); return g;
}
