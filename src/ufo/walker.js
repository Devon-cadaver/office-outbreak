// THE LONGSHANKS: BEAM 'EM UP!'s second machine, a three-legged walker (an original design: a tall armoured body like an
// upturned egg under a hood, one big glowing eye with a lamp each side, two jointed tentacle arms, and three long jointed
// legs ending in ball feet). It walks instead of flying: its feet come down on whatever is under them, its death ray works
// like the saucer's, it has the saucer's beam underneath, and a searchlight that shines the way it walks. Built in world
// units: the body sits WALK_Y above the street. userData carries the names the saucer's model has (ring, pods, pilot,
// dome, eye, shield) so the game's look code drives both, plus the legs, arms and the searchlight.
import * as THREE from 'three';

export const WALK_Y = 4.6; // the body's height above the street (the hips)
const HIP_R = 0.6, FOOT_R = 2.1; // how far out the hips sit, and where the feet come down (from the middle)
// colours: [body, legs, glow, searchlight]
export const WALKER_PAL = { base: [0x4e545c, 0x2e3238, 0xd8ff5a, 0xfff2b0] };
const L = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
const G = (c) => new THREE.MeshBasicMaterial({ color: c });
const sph = new THREE.SphereGeometry(1, 18, 12), cyl = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, -0.5, 0), cone = new THREE.CylinderGeometry(0.12, 1, 1, 20, 1, true).translate(0, -0.5, 0);
const ringG = new THREE.TorusGeometry(1, 0.08, 5, 20);

// one jointed limb part: a tube from 0 down to -1 (scaled to length) with rings round it, so it reads as segmented
function segPart(mat, ringMat, rings) { const g = new THREE.Group(), tube = new THREE.Mesh(cyl, mat); g.add(tube); g.userData.tube = tube; g.userData.rings = [];
  for (let i = 1; i <= rings; i++) { const r = new THREE.Mesh(ringG, ringMat); r.rotation.x = Math.PI / 2; r.position.y = -i / (rings + 1); g.add(r); g.userData.rings.push(r); } return g; }
function sizePart(p, len, w) { p.userData.tube.scale.set(w, len, w); for (const r of p.userData.rings) { r.position.y = r.userData.k * -len; r.scale.setScalar(w * 1.25); } }

export function makeWalker(pal = WALKER_PAL.base) { const [cBody, cLeg, cGlow, cBeam] = pal, g = new THREE.Group(), legM = L(cLeg, 0x050608), bodyM = L(cBody, 0x0a0c0e), glowM = G(cGlow), darkM = L(0x14161a);
  // the head: the whole upper body, which turns to face the way it walks
  const head = new THREE.Group(); g.add(head);
  const shell = new THREE.Mesh(sph, bodyM); shell.scale.set(0.82, 0.95, 0.72); shell.position.y = 0.8; head.add(shell); // the egg-shaped body
  // a see-through bulb on top, like the saucer's dome, with the driver inside
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), new THREE.MeshLambertMaterial({ color: 0x9affd0, emissive: 0x1a6a4a, transparent: true, opacity: 0.45, depthWrite: false })); dome.position.y = 1.95; dome.renderOrder = 2; head.add(dome);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 6, 24), darkM); collar.rotation.x = Math.PI / 2; collar.position.y = 1.62; head.add(collar);
  const driver = new THREE.Group(); driver.position.y = 1.78; head.add(driver); const skinM = L(0x7dd84a, 0x0e2a08), blackM = G(0x0a0a12);
  { const bodyD = new THREE.Mesh(sph, L(0x5a3a8a)); bodyD.scale.set(0.26, 0.16, 0.22); driver.add(bodyD); const hd = new THREE.Mesh(sph, skinM); hd.scale.set(0.24, 0.22, 0.22); hd.position.y = 0.24; driver.add(hd);
    for (const x of [-0.08, 0.08]) { const e = new THREE.Mesh(sph, blackM); e.scale.set(0.07, 0.09, 0.04); e.position.set(x, 0.26, 0.19); e.rotation.z = x > 0 ? -0.5 : 0.5; driver.add(e); } const ant = new THREE.Mesh(cyl, skinM); ant.scale.set(0.012, 0.14, 0.012); ant.position.y = 0.6; driver.add(ant); const tip = new THREE.Mesh(sph, G(0xffd24a)); tip.scale.setScalar(0.04); tip.position.y = 0.6; driver.add(tip); }
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(ringG, darkM), y = 0.2 + i * 0.28, k = Math.sqrt(Math.max(0, 1 - ((y - 0.8) / 0.95) ** 2)); r.rotation.x = Math.PI / 2; r.scale.set(0.84 * k, 0.74 * k, 0.6); r.position.y = y; head.add(r); } // armour bands
  
  for (const s of [-1, 1]) { const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 4), darkM); fin.position.set(s * 0.8, 1.35, -0.05); fin.rotation.z = s * -1.15; head.add(fin); } // swept fins either side of the hood
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.6, 0.38, 12), darkM); skirt.position.y = 0.02; head.add(skirt); // where the legs join
  const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x2 = c.getContext('2d'); x2.fillStyle = '#0a0c0a'; x2.fillRect(0, 0, 64, 8); x2.fillStyle = '#ffffff'; x2.fillRect(6, 1, 18, 6);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(8, 1); tex.colorSpace = THREE.SRGBColorSpace;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.05, 6, 40), new THREE.MeshBasicMaterial({ map: tex, color: cGlow })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; head.add(ring); // a band of running lights round the waist
  const pilot = new THREE.Group(); head.add(pilot); // the face: the big eye, a lamp each side, the searchlight
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.28, 22), glowM); eye.position.set(0, 0.95, 0.72); pilot.add(eye);
  const eyeRim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 22), darkM); eyeRim.position.copy(eye.position); pilot.add(eyeRim);
  for (const s of [-1, 1]) { const lampL = new THREE.Mesh(sph, glowM); lampL.scale.setScalar(0.12); lampL.position.set(s * 0.52, 0.72, 0.56); pilot.add(lampL); }
  const lamp = new THREE.Group(); lamp.position.set(0, 0.92, 0.78); pilot.add(lamp);
  const beamM = new THREE.MeshBasicMaterial({ color: cBeam, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const searchlight = new THREE.Mesh(cone, beamM); searchlight.renderOrder = 3; lamp.add(searchlight);
  // two tentacle arms hanging from the sides, a chain of short parts each, swaying as it walks
  const arms = []; for (const s of [-1, 1]) { let parent = new THREE.Group(); parent.position.set(s * 0.72, 0.75, 0.2); head.add(parent); const chain = [];
    for (let i = 0; i < 6; i++) { const seg = new THREE.Group(), m = new THREE.Mesh(cyl, legM); m.scale.set(0.06 - i * 0.006, 0.34, 0.06 - i * 0.006); seg.add(m); if (i) seg.position.y = -0.34; parent.add(seg); chain.push(seg); parent = seg; }
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), glowM); claw.position.y = -0.4; claw.rotation.x = Math.PI; parent.add(claw); arms.push({ s, chain }); }
  const pods = new THREE.Group(); head.add(pods); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, p = new THREE.Mesh(sph, glowM); p.scale.setScalar(0.07); p.position.set(Math.cos(a) * 0.7, -0.18, Math.sin(a) * 0.7); pods.add(p); }
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 12), new THREE.MeshBasicMaterial({ color: cGlow, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending })); shield.scale.y = 1.2; shield.position.y = 1; shield.renderOrder = 3; head.add(shield);
  // three legs: a hip ball, a long thigh up and out to a knee, a longer shin down to a ball foot
  const legs = []; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, hip = new THREE.Group(); g.add(hip);
    const ball = new THREE.Mesh(sph, darkM); ball.scale.setScalar(0.2); hip.add(ball);
    const thigh = segPart(legM, darkM, 3), knee = new THREE.Group(), kb = new THREE.Mesh(sph, darkM), shin = segPart(legM, darkM, 6), foot = new THREE.Mesh(sph, bodyM);
    for (const p of [thigh, shin]) p.userData.rings.forEach((r, j, a2) => { r.userData.k = (j + 1) / (a2.length + 1); });
    kb.scale.setScalar(0.16); foot.scale.set(0.24, 0.18, 0.24); knee.add(kb, shin); hip.add(thigh, knee); g.add(foot);
    legs.push({ a, hip, thigh, knee, shin, foot, at: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, i }); }
  g.userData = { walker: true, head, dome, driver, ring, pilot, eye, pods, shield, legs, arms, searchlight, lamp, beamM, phase: 0, look: pal };
  return g; }

const v = new THREE.Vector3(), w = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0), q = new THREE.Quaternion();
// one leg from the hip to the foot (both in the walker's own space): the knee rises up and out above the line between them
function poseLeg(l, hipL, footL) { const d = footL.clone().sub(hipL), len = d.length(), out = v.set(d.x, 0, d.z); if (out.lengthSq() < 1e-6) out.set(Math.sin(l.a), 0, Math.cos(l.a)); out.normalize();
  const knee = hipL.clone().addScaledVector(d, 0.4).addScaledVector(out, 0.35).add(w.set(0, Math.max(0.6, 2.4 - len * 0.25), 0)); l.hip.position.copy(hipL);
  const a1 = knee.clone().sub(hipL), a2 = footL.clone().sub(knee);
  l.thigh.quaternion.setFromUnitVectors(DOWN, a1.clone().normalize()); sizePart(l.thigh, a1.length(), 0.11);
  l.knee.position.copy(a1); l.shin.quaternion.setFromUnitVectors(DOWN, a2.clone().normalize()); sizePart(l.shin, a2.length(), 0.085); l.foot.position.copy(footL); }

// walking: the body turns to face the way it goes, and so do the hips; each leg in turn lifts and steps to its spot round
// the body, a little ahead. Returns the feet that came down this frame (world positions) so the game can stomp what is under
export function walkerTick(g, dt, x, z, y, vx, vz, face) { const u = g.userData, sp = Math.hypot(vx, vz), planted = [];
  u.head.rotation.y = face; u.head.position.y = Math.sin(u.phase * 2) * 0.05 * Math.min(1, sp) + 0.15;
  u.phase += dt * (sp > 0.3 ? 2.4 : 0.5);
  for (const A of u.arms) A.chain.forEach((seg, i) => { seg.rotation.x = Math.sin(u.phase * 1.3 + i * 0.6 + A.s) * 0.18 + (i ? 0.08 : 0.25) + sp * 0.02; seg.rotation.z = A.s * (i ? 0.06 : 0.35) + Math.sin(u.phase + i) * 0.05; });
  const stepT = 0.42, busy = u.legs.some((o) => o.t < 0.55);
  for (const l of u.legs) { const ang = l.a + face, hipL = v.set(Math.sin(ang) * HIP_R, 0, Math.cos(ang) * HIP_R).clone(), home = new THREE.Vector3(x + Math.sin(ang) * FOOT_R + vx * 0.3, 0, z + Math.cos(ang) * FOOT_R + vz * 0.3);
    if (l.at.lengthSq() === 0) { l.at.copy(home); l.to.copy(home); }
    if (l.t < 1) { l.t = Math.min(1, l.t + dt / stepT); const k = l.t, e = k * k * (3 - 2 * k); l.at.lerpVectors(l.from, l.to, e); l.at.y = Math.sin(k * Math.PI) * 0.8; if (l.t >= 1) { l.at.y = 0; planted.push(l.at.clone()); } }
    else if (!busy && l.at.distanceTo(home) > 0.9) { l.from.copy(l.at); l.to.copy(home); l.t = 0; }
    poseLeg(l, hipL, new THREE.Vector3(l.at.x - x, l.at.y - y, l.at.z - z)); }
  return planted; }

// the searchlight: from the lamp down to the street `reach` ahead, the way it faces
export function aimLight(g, reach, face, k = 1) { const u = g.userData; g.updateMatrixWorld(true); const from = u.lamp.getWorldPosition(new THREE.Vector3()),
  to = new THREE.Vector3(from.x + Math.sin(face) * reach, 0.05, from.z + Math.cos(face) * reach), d = to.clone().sub(from), len = d.length();
  q.setFromUnitVectors(DOWN, d.normalize()); const parentQ = u.lamp.getWorldQuaternion(new THREE.Quaternion()).invert(); u.searchlight.quaternion.copy(parentQ.multiply(q)); u.searchlight.scale.set(1.6, len, 1.6); u.beamM.opacity = 0.14 * k; return to; }
