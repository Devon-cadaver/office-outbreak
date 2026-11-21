// THE LONGSHANKS: BEAM 'EM UP!'s second machine, a three-legged walker (an original design: a round, ribbed head on three
// long jointed legs with glowing knees). It walks instead of flying: its feet come down on whatever is under them, its death
// ray works like the saucer's, and its beam is a searchlight that shines ahead of it. Built in world units: the head sits
// WALK_Y above the street. userData carries the same names the saucer's model has (ring, pods, pilot, dome, eye, shield)
// so the game's look code drives both, plus the legs and the searchlight cone.
import * as THREE from 'three';

export const WALK_Y = 4.6; // the head's height above the street
const LEG_R = 1.35; // how far out each hip sits
// colours: [head, legs, glow, beam]
export const WALKER_PAL = { base: [0x4a5260, 0x2a3038, 0x7dff3a, 0xb8ffd0] };
const L = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
const G = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
const sph = new THREE.SphereGeometry(1, 16, 12), cyl = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, -0.5, 0), cone = new THREE.CylinderGeometry(0.12, 1, 1, 20, 1, true).translate(0, -0.5, 0);

export function makeWalker(pal = WALKER_PAL.base) { const [cHead, cLeg, cGlow, cBeam] = pal, g = new THREE.Group(), legM = L(cLeg, 0x050608), glowM = G(cGlow);
  // the head: a squat, ribbed dome over a darker underside, a glowing band round it, a lamp at the front
  const head = new THREE.Group(); g.add(head);
  const dome = new THREE.Mesh(sph, L(cHead, 0x0a1210)); dome.scale.set(1.3, 0.62, 1.15); dome.position.y = 0.12; head.add(dome);
  const under = new THREE.Mesh(sph, L(cLeg, 0x020304)); under.scale.set(1.15, 0.42, 1.0); under.position.y = -0.18; head.add(under);
  for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 5, 24, Math.PI), L(cLeg)); r.rotation.y = Math.PI / 2; r.scale.set(1.12, 0.6, 1.3 - Math.abs(i - 2) * 0.22); r.position.set(-0.5 + i * 0.25, 0.14, 0); head.add(r); } // ribs over the top
  const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x2 = c.getContext('2d'); x2.fillStyle = '#0a140e'; x2.fillRect(0, 0, 64, 8); x2.fillStyle = '#ffffff'; x2.fillRect(6, 1, 20, 6);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(8, 1); tex.colorSpace = THREE.SRGBColorSpace;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.06, 6, 40), new THREE.MeshBasicMaterial({ map: tex, color: cGlow })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.02; head.add(ring);
  // the "pilot" is the turning front of the head: the lamp and the searchlight point the way it walks
  const pilot = new THREE.Group(); head.add(pilot);
  const brow = new THREE.Mesh(sph, L(cLeg)); brow.scale.set(0.5, 0.22, 0.4); brow.position.set(0, 0.0, 1.0); pilot.add(brow);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.26, 18), new THREE.MeshBasicMaterial({ color: cGlow })); eye.position.set(0, -0.02, 1.36); pilot.add(eye);
  const lamp = new THREE.Group(); lamp.position.set(0, -0.05, 1.3); pilot.add(lamp);
  const beamM = new THREE.MeshBasicMaterial({ color: cBeam, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const searchlight = new THREE.Mesh(cone, beamM); searchlight.renderOrder = 3; lamp.add(searchlight); // aimed each frame (aimLight) down at the street ahead
  const pods = new THREE.Group(); head.add(pods); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, p = new THREE.Mesh(sph, glowM); p.scale.setScalar(0.09); p.position.set(Math.cos(a) * 0.95, -0.42, Math.sin(a) * 0.85); pods.add(p); } // little lights underneath
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.0, 20, 12), new THREE.MeshBasicMaterial({ color: cGlow, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending })); shield.scale.y = 0.6; shield.renderOrder = 3; head.add(shield);
  // three legs: hip, a long thigh up and out, a knee that glows, a longer shin down to a three-toed foot
  const legs = []; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 6, hip = new THREE.Group(); hip.position.set(Math.sin(a) * LEG_R * 0.55, -0.3, Math.cos(a) * LEG_R * 0.55); g.add(hip);
    const ball = new THREE.Mesh(sph, legM); ball.scale.setScalar(0.22); hip.add(ball);
    const thigh = new THREE.Mesh(cyl, legM), knee = new THREE.Group(), kb = new THREE.Mesh(sph, glowM), shin = new THREE.Mesh(cyl, legM), foot = new THREE.Group();
    thigh.scale.set(0.12, 1, 0.12); kb.scale.setScalar(0.17); shin.scale.set(0.09, 1, 0.09); knee.add(kb, shin); hip.add(thigh, knee);
    for (let t = 0; t < 3; t++) { const toe = new THREE.Mesh(cyl, legM), ta = t / 3 * Math.PI * 2; toe.scale.set(0.05, 0.42, 0.05); toe.rotation.set(Math.cos(ta) * 1.1, 0, Math.sin(ta) * 1.1); foot.add(toe); } g.add(foot);
    legs.push({ a, hip, thigh, knee, shin, foot, at: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, i }); }
  g.userData = { walker: true, head, dome, ring, pilot, eye, pods, shield, legs, searchlight, lamp, beamM, phase: 0, step: 0, planted: false, look: pal };
  return g; }

const v = new THREE.Vector3(), w = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0), q = new THREE.Quaternion();
// one leg from hip (world) to foot (world): the thigh goes up and out, the knee bends above the foot
function poseLeg(g, l, hipW, footW) { const d = footW.clone().sub(hipW), len = d.length(), out = v.set(l.hip.position.x, 0, l.hip.position.z).normalize();
  const knee = hipW.clone().addScaledVector(out, Math.min(1.5, len * 0.45)).add(w.set(0, 0.9, 0)); g.worldToLocal(knee); const hipL = l.hip.position, footL = g.worldToLocal(footW.clone());
  const a1 = knee.clone().sub(hipL), a2 = footL.clone().sub(knee);
  l.thigh.position.set(0, 0, 0); l.thigh.quaternion.setFromUnitVectors(DOWN, a1.clone().normalize()); l.thigh.scale.y = a1.length();
  l.knee.position.copy(knee).sub(hipL); l.shin.quaternion.setFromUnitVectors(DOWN, a2.clone().normalize()); l.shin.scale.y = a2.length(); l.foot.position.copy(footL); }

// walking: each leg in turn lifts and steps to a spot ahead of where the body is going; returns the feet that came down this
// frame (world positions) so the game can stomp what is under them
export function walkerTick(g, dt, x, z, y, vx, vz, face) { const u = g.userData, sp = Math.hypot(vx, vz), planted = []; g.updateMatrixWorld(true);
  u.head.rotation.y = 0; u.pilot.rotation.y = face; u.head.position.y = Math.sin(u.phase * 2) * 0.06 * Math.min(1, sp);
  const stepT = 0.42; u.phase += dt * (sp > 0.3 ? 1 / stepT : 0.6);
  for (const l of u.legs) { const home = w.set(x + Math.sin(l.a + face) * LEG_R * 1.55 + vx * 0.32, 0, z + Math.cos(l.a + face) * LEG_R * 1.55 + vz * 0.32);
    if (l.t >= 1 && l.at.lengthSq() === 0) { l.at.copy(home); l.from.copy(home); l.to.copy(home); }
    if (l.t < 1) { l.t = Math.min(1, l.t + dt / stepT); const k = l.t, e = k * k * (3 - 2 * k); l.at.lerpVectors(l.from, l.to, e); l.at.y = Math.sin(k * Math.PI) * 0.9; if (l.t >= 1) { l.at.y = 0; planted.push(l.at.clone()); } }
    else if (l.at.distanceTo(home) > 1.1 && u.legs.every((o) => o === l || o.t >= 1 || o.t > 0.6) && ((Math.floor(u.phase) % 3) === l.i || l.at.distanceTo(home) > 2.4)) { l.from.copy(l.at); l.to.copy(home); l.t = 0; }
    g.updateMatrixWorld(true); const hipW = l.hip.getWorldPosition(new THREE.Vector3()); poseLeg(g, l, hipW, l.at.clone()); }
  return planted; }

// the searchlight: from the lamp down to the street `reach` ahead of the head
export function aimLight(g, reach, k = 1) { const u = g.userData; g.updateMatrixWorld(true); const from = u.lamp.getWorldPosition(new THREE.Vector3()), face = u.pilot.rotation.y + g.rotation.y,
  to = new THREE.Vector3(from.x + Math.sin(face) * reach, 0.05, from.z + Math.cos(face) * reach), d = to.clone().sub(from), len = d.length();
  q.setFromUnitVectors(DOWN, d.normalize()); const parentQ = u.lamp.getWorldQuaternion(new THREE.Quaternion()).invert(); u.searchlight.quaternion.copy(parentQ.multiply(q)); u.searchlight.scale.set(1.6, len, 1.6); u.beamM.opacity = 0.14 * k; return to; }
