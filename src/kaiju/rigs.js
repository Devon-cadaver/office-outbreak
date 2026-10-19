// Kaiju Madness: the monsters. Each one is a low-poly rig about 2 units tall at scale 1, facing +z, built from simple
// parts and animated by hand. Body types: biped lizards (with options: wings, horns, crystals, drill arms, a frill, a
// squat toad body, a metal finish), the knuckle-walking ape, four-legged beasts (spikes, a sail, a shell), a sideways-
// walking crab, an eight-legged spider, winged flyers (one head or three), moths, an oozing blob, a plant on writhing
// vines and a squid on tentacles. rig.anim(dt, move) runs the idle/walk/fly cycle (move 0..1); rig.act('hit' | 'cast' |
// 'ko') plays a one-shot over the top. rig.mouth / rig.hand / rig.chest are anchors for spells and throws.
import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1), cone = new THREE.ConeGeometry(0.5, 1, 4), cone8 = new THREE.ConeGeometry(0.5, 1, 8), ball = new THREE.IcosahedronGeometry(0.5, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8), oct = new THREE.OctahedronGeometry(0.5, 0);
const mats = new Map();
const mat = (c, basic = false) => { const k = c + (basic ? 'b' : ''); if (!mats.has(k)) mats.set(k, basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c, flatShading: true })); return mats.get(k); };
function part(parent, geo, c, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0, basic = false) { const m = new THREE.Mesh(geo, mat(c, basic)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; }
const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const S = (k, a) => Math.sin(k * Math.PI) * a; // a one-shot's swell

// pal: skin, dark, belly, accent (plates, crystals, sail...), eye
export const KAIJU = {
  godzilly: { name: 'GODZILLY', kind: 'biped', pal: [0x45505e, 0x2c3440, 0x66707e, 0x4ab8ff, 0xffd24a], opt: { plates: true, glow: true }, spells: ['Atomic Hiccup', 'Atomic Breath', 'Spine Nova'], speed: 1 },
  konk: { name: 'KING KONK', kind: 'ape', spells: ['Car Toss', 'Chest Drum', 'Tower Toss'], speed: 1.12 },
  mofra: { name: 'MOFRA', kind: 'moth', fly: true, pal: [0xe8d8b8, 0xf09a20, 0x1a1410, 0xd8301a, 0x3aa8ff], spells: ['Wing Gust', 'Glitter Storm', 'Rainbow Beam'], speed: 1.2 },
  mecha: { name: 'MECHA-GODZILLY', kind: 'biped', pal: [0x9aa2ac, 0x4e545c, 0xc8cdd2, 0x8aa0c8, 0xff2a2a], opt: { plates: true, mech: true }, spells: ['Rocket Fists', 'Missile Party', 'Freeze Cannon'], speed: 0.92 },
  rodanny: { name: 'RODANNY', kind: 'ptero', fly: true, pal: [0xb83a2a, 0x6a1a14, 0xe08a5a, 0xe8b82a, 0xffd24a], spells: ['Peck Dive', 'Sonic Boom', 'Firenado'], speed: 1.35 },
  giggle: { name: 'KING GIGGLEDORAH', kind: 'ptero', fly: true, pal: [0xd8a82a, 0x8a6a14, 0xf0d070, 0xffe27a, 0xff3a2a], opt: { heads: 3 }, spells: ['Zap', 'Triple Lightning', 'Gravity Storm'], speed: 1.05 },
  lobstirah: { name: 'LOBSTIRAH', kind: 'crab', pal: [0xc23b2b, 0x7a1a14, 0xe87a5a, 0xffd0a0, 0x1a1a1a], spells: ['Claw Snap', 'Water Jet', 'Boiling Tide'], speed: 1.05 },
  angryrus: { name: 'ANGRYRUS', kind: 'quad', pal: [0x7a6a50, 0x4a3e2e, 0xa89878, 0xe8d8a0, 0xff3a2a], opt: { spikes: true, horn: true }, spells: ['Spike Volley', 'Roll-Out', 'Tantrum Quake'], speed: 1.1 },
  grammera: { name: 'GRAMMERA', kind: 'quad', pal: [0x3a6a4a, 0x2a4a34, 0xc8b88a, 0x5a5a3a, 0xffd24a], opt: { shell: true, tusks: true }, spells: ['Plasma Spit', 'Shell Spin', 'Jet Rocket'], speed: 0.95 },
  destroyah: { name: 'DESTROYAH-YAH', kind: 'biped', pal: [0xa82a2a, 0x5a1414, 0xd8603a, 0xff3a3a, 0xffd24a], opt: { wings: 0x7a1a1a, horn: 0xe8d8a0 }, spells: ['Horn Slice', 'Melt Beam', 'Crab Swarm'], speed: 1.05 },
  biolettuce: { name: 'BIOLETTUCE', kind: 'plant', pal: [0x2f7a3a, 0x1f4a24, 0xc23b3b, 0xf0f0e0, 0x9ad83a], spells: ['Vine Whip', 'Acid Sap', 'Mega Bloom'], speed: 0.85 },
  spaceyzilla: { name: 'SPACEYZILLA', kind: 'biped', pal: [0x2e2a6a, 0x1a1840, 0x5a4a9a, 0xd0a8ff, 0xffd24a], opt: { crystals: true, glow: true, hover: true }, spells: ['Crystal Shard', 'Crystal Garden', 'Corona Spiral'], speed: 0.95 },
  megalawn: { name: 'MEGALAWN', kind: 'biped', pal: [0x5a3a24, 0x2a1a10, 0x8a6a3a, 0xffd24a, 0xffd24a], opt: { drills: true, horn: 0xffd24a, beetle: true }, spells: ['Drill Dash', 'Burrow', 'Horn Lightning'], speed: 1.08 },
  smogorah: { name: 'SMOGORAH', kind: 'blob', pal: [0x3a4a44, 0x24302c, 0x5a6a5a, 0x8ac83a, 0xff3a2a], spells: ['Sludge Ball', 'Smog Cloud', 'Saucer Mode'], speed: 0.9 },
  varoom: { name: 'VAROOM', kind: 'quad', pal: [0x5a8a4a, 0x3a5a2a, 0xb8c87a, 0xd89a2a, 0xffd24a], opt: { sail: true }, spells: ['Tail Whip', 'Glide Slam', 'Sail Flash'], speed: 1.3 },
  gabbera: { name: 'GABBERA', kind: 'biped', pal: [0x6a7a4a, 0x3a4a2a, 0xb8a86a, 0xffe27a, 0xff3a2a], opt: { toad: true }, spells: ['Shock Croak', 'Hop Slam', 'Thunder Belly'], speed: 1.15 },
  kumbunga: { name: 'KUMBUNGA', kind: 'spider', pal: [0x1e1a14, 0x0e0c0a, 0xe8b82a, 0xe8b82a, 0xff2a2a], spells: ['Web Shot', 'Web Net', 'Spiderling Swarm'], speed: 1.25 },
  jirassic: { name: 'JIRASSIC', kind: 'biped', pal: [0x4a6a9a, 0x2a3a5a, 0x9ab0c8, 0x6a8ac8, 0xffd24a], opt: { frill: true, horn: 0xe8e0c8 }, spells: ['Frill Flare', 'Spit Geyser', 'Stampede'], speed: 1.12 },
  geezora: { name: 'GEEZORA', kind: 'squid', pal: [0x7a5aa8, 0x4a3a6a, 0xa88ac8, 0xd86a8a, 0xff4a2a], spells: ['Ink Squirt', 'Tentacle Grab-o-rama', 'Deep Freeze'], speed: 0.95 },
  battra: { name: 'BATTRA-TAT', kind: 'moth', fly: true, pal: [0x24243a, 0x2a2a6a, 0x0e0e18, 0xe8b82a, 0xff2a2a], opt: { horn: true }, spells: ['Horn Ram', 'Prism Eyes', 'Dark Eclipse'], speed: 1.25 },
};
export const KAIJU_IDS = Object.keys(KAIJU);

// Halloween skins, one per kaiju: flyers become bats (little bats circle them); the rest take turns being UNDEAD (pale,
// zombie green with purple bones, or a GHOUL in purple with glowing green bones), a SKELETON (bone white on black) or a PUMPKIN (orange, with a flaming jack-o'-lantern for a head)
const LOOKS = {
  undead: { name: 'Undead', pal: [0x4f9a3e, 0x8a3ac8, 0xb27ae8, 0xa04ae0, 0x9dff3a] },
  ghoul: { name: 'Ghoul', pal: [0x5a2a7a, 0x7dff3a, 0x9dff5a, 0x7dff3a, 0x9dff3a] },
  skeleton: { name: 'Skeleton', pal: [0x1c1a20, 0xece6d2, 0xf2ecd8, 0xece6d2, 0xff2a2a] },
  pumpkin: { name: 'Pumpkin', pal: [0xff7a1a, 0x3a1a08, 0xffaa3a, 0x2a8a2a, 0xffe24a], pumpkin: true },
  bat: { name: 'Bat', pal: [0x4a3448, 0x2a1a2a, 0x7a5a6a, 0x8a2a3a, 0xff2a2a], bats: true },
};
const CYCLE = ['undead', 'pumpkin', 'skeleton'];
export const KAIJU_SKINS = {}; { let i = 0, u = 0; for (const id of KAIJU_IDS) { let look = KAIJU[id].fly ? 'bat' : CYCLE[i++ % CYCLE.length]; if (look === 'undead' && (u++ % 2)) look = 'ghoul'; KAIJU_SKINS[id] = { look, ...LOOKS[look], name: LOOKS[look].name + ' ' + KAIJU[id].name.replace('KING ', 'King ').toLowerCase().replace(/(^|[ -])([a-z])/g, (m, s, ch) => s + ch.toUpperCase()) }; } }
// a jack-o'-lantern over the head, with flames licking up out of it
function pumpkinHead(head, fx) {
  const p = grp(head, 0, 0.08, 0.05); part(p, ball, 0xff7a1a, 0.62, 0.52, 0.58, 0, 0, 0); part(p, ball, 0xe8661a, 0.5, 0.56, 0.62, 0, 0, 0); part(p, cyl, 0x2a6a1a, 0.07, 0.16, 0.07, 0, 0.32, 0);
  for (const x of [-0.12, 0.12]) part(p, cone, 0xffe24a, 0.1, 0.1, 0.04, x, 0.06, 0.29, 0, 0, Math.PI, true);
  part(p, box, 0xffe24a, 0.24, 0.05, 0.04, 0, -0.1, 0.29, 0, 0, 0, true); for (const x of [-0.06, 0.06]) part(p, box, 0xff7a1a, 0.04, 0.03, 0.05, x, -0.08, 0.3, 0, 0, 0, true);
  const fl = [0xff5a1a, 0xffb02a, 0xffe24a].map((c, i) => part(p, cone8, c, 0.22 - i * 0.05, 0.4, 0.22 - i * 0.05, (i - 1) * 0.1, 0.42, 0, 0, 0, 0, true));
  fx.push((t) => fl.forEach((f, i) => { f.scale.y = 0.3 + 0.12 * Math.sin(t * 13 + i * 2); f.position.y = 0.38 + 0.04 * Math.sin(t * 9 + i); }));
}
// little bats circling the monster, flapping
function batSwarm(g, fx) {
  const bats = []; for (let i = 0; i < 6; i++) { const b = grp(g, 0, 0, 0); b.scale.setScalar(1.6); part(b, box, 0x141018, 0.08, 0.07, 0.12, 0, 0, 0, 0, 0, 0, true); const w = [-1, 1].map((s) => { const wg = grp(b, s * 0.04, 0, 0); part(wg, box, 0x2a2030, 0.18, 0.02, 0.1, s * 0.09, 0, 0, 0, 0, 0, true); return wg; }); bats.push({ b, w, a: i / 6 * Math.PI * 2, r: 1.1 + (i % 3) * 0.25, h: 1.4 + (i % 2) * 0.5, sp: 1.3 + (i % 3) * 0.3 }); }
  fx.push((t) => { for (const B of bats) { const a = B.a + t * B.sp; B.b.position.set(Math.cos(a) * B.r, B.h + Math.sin(t * 3 + B.a) * 0.2, Math.sin(a) * B.r); B.b.rotation.y = -a; const f = Math.sin(t * 22 + B.a) * 0.8; B.w[0].rotation.z = f; B.w[1].rotation.z = -f; } });
}

export function buildKaiju(id, skin = false) {
  const sk = skin ? KAIJU_SKINS[id] : null; const K = sk ? { ...KAIJU[id], pal: sk.pal } : KAIJU[id]; const g = new THREE.Group(); const body = grp(g, 0, 0, 0); const fx = [];
  const rig = ({ biped, ape, moth, ptero, quad, crab, spider, blob, plant, squid })[K.kind](body, K);
  if (sk && sk.pumpkin && rig.mouth && rig.mouth.parent) pumpkinHead(rig.mouth.parent, fx); if (sk && sk.bats) batSwarm(g, fx);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; g.add(shadow);
  let t = Math.random() * 10, actK = null, actT = 0;
  return { id, def: K, g, body, shadow, fly: !!K.fly, mouth: rig.mouth, hand: rig.hand, chest: rig.chest,
    act(k) { actK = k; actT = 0; },
    anim(dt, move) { t += dt; if (actK) { actT += dt * (actK === 'ko' ? 0.8 : 2.4); if (actT >= 1 && actK !== 'ko') actK = null; } rig.anim(t, dt, move, actK, Math.min(1, actT)); for (const f of fx) f(t); shadow.scale.setScalar(rig.shadowK || 1); },
  };
}
const koTip = (body, k, axis = 'z') => { body.rotation[axis] = Math.min(1.5, k * 2) * (axis === 'x' ? -1 : 1); body.position.y = -k * 0.2; };

// ---------- two-legged: lizards, demons, beetles, toads ----------
function biped(body, K) {
  const [skin, dark, belly, acc, eyeC] = K.pal, o = K.opt || {}; const toad = o.toad;
  const hip = grp(body, 0, toad ? 0.55 : 0.9, 0); const lift = o.hover ? 0.25 : 0;
  const torso = grp(hip, 0, 0.05, 0); torso.rotation.x = toad ? 0.1 : 0.28;
  part(torso, box, skin, toad ? 1.15 : 0.82, toad ? 0.85 : 1.0, toad ? 0.95 : 0.72, 0, toad ? 0.38 : 0.45, 0); part(torso, box, belly, toad ? 0.85 : 0.56, toad ? 0.62 : 0.78, 0.1, 0, toad ? 0.35 : 0.42, toad ? 0.48 : 0.36);
  if (o.mech) { part(torso, box, dark, 0.86, 0.12, 0.76, 0, 0.2, 0); part(torso, box, dark, 0.86, 0.12, 0.76, 0, 0.62, 0); }
  if (o.beetle) { part(torso, box, dark, 0.9, 0.85, 0.2, 0, 0.5, -0.38); for (const x of [-0.25, 0.25]) part(torso, box, acc, 0.06, 0.8, 0.22, x, 0.5, -0.4); }
  const chest = grp(torso, 0, 0.5, 0.42); if (o.mech) part(chest, cyl, 0xffd24a, 0.26, 0.06, 0.26, 0, 0, 0, Math.PI / 2, 0, 0, true);
  const neck = grp(torso, 0, toad ? 0.7 : 0.92, toad ? 0.25 : 0.18); const head = grp(neck, 0, 0.12, 0.12);
  part(head, box, skin, toad ? 0.7 : 0.42, toad ? 0.3 : 0.34, toad ? 0.5 : 0.5, 0, 0.06, 0.12); part(head, box, skin, toad ? 0.6 : 0.34, 0.2, 0.3, 0, 0, toad ? 0.38 : 0.48);
  const jaw = grp(head, 0, -0.1, 0.05); part(jaw, box, dark, toad ? 0.6 : 0.32, 0.1, toad ? 0.5 : 0.62, 0, -0.03, toad ? 0.22 : 0.28);
  for (const x of toad ? [-0.25, 0.25] : [-0.13, 0.13]) part(head, toad ? ball : box, eyeC, toad ? 0.16 : 0.07, toad ? 0.16 : 0.05, toad ? 0.16 : 0.04, x, toad ? 0.22 : 0.13, toad ? 0.2 : 0.36, 0, 0, 0, true);
  if (o.horn) part(head, cone8, o.horn === true ? acc : o.horn, 0.12, 0.5, 0.12, 0, 0.3, 0.42, -0.6);
  if (o.frill) { const fr = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10, 0, Math.PI), new THREE.MeshLambertMaterial({ color: acc, side: THREE.DoubleSide, flatShading: true })); fr.position.set(0, 0.08, -0.08); fr.rotation.x = -0.35; head.add(fr); }
  const mouth = grp(head, 0, -0.04, 0.68);
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * (toad ? 0.6 : 0.45), toad ? 0.5 : 0.72, 0.22); part(a, box, skin, 0.16, 0.42, 0.16, 0, -0.18, 0.06, -0.5);
    if (o.drills) part(a, cone8, 0xb8c0c8, 0.22, 0.7, 0.22, 0, -0.5, 0.35, 2.4); else part(a, cone, belly, 0.06, 0.12, 0.06, 0, -0.4, 0.22, 2.6); return a; });
  const hand = grp(arms[1], 0, -0.38, 0.2);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * (toad ? 0.45 : 0.3), 0, 0); part(l, box, skin, toad ? 0.42 : 0.34, toad ? 0.34 : 0.52, 0.42, 0, toad ? -0.12 : -0.2, 0); const k = grp(l, 0, toad ? -0.3 : -0.45, 0.02); part(k, box, skin, 0.25, toad ? 0.24 : 0.42, 0.3, 0, toad ? -0.1 : -0.18, -0.02); part(k, box, dark, toad ? 0.5 : 0.34, 0.1, toad ? 0.6 : 0.5, 0, toad ? -0.24 : -0.42, 0.08); return { l, k }; });
  const tail = []; if (!toad) { let prev = grp(hip, 0, 0.05, -0.32); for (let i = 0; i < 5; i++) { const s = 1 - i * 0.16; part(prev, box, skin, 0.42 * s, 0.38 * s, 0.46, 0, 0, -0.2, -0.1); tail.push(prev); prev = grp(prev, 0, -0.02, -0.4); } }
  const glowMat = o.glow ? new THREE.MeshBasicMaterial({ color: acc }) : mat(acc); const glow0 = new THREE.Color(acc);
  if (o.plates) { for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(cone, glowMat); sp.scale.set(0.22, 0.42 - i * 0.03, 0.32); sp.position.set(0, 0.95 - i * 0.18, -0.36 + i * 0.02); sp.rotation.x = -0.6; torso.add(sp); } for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(cone, glowMat); sp.scale.set(0.16, 0.3 - i * 0.05, 0.22); sp.position.set(0, 0.2 * (1 - i * 0.16), -0.2); sp.rotation.x = -0.9; tail[i].add(sp); } }
  if (o.crystals) for (const [x, y, z, s, r] of [[-0.5, 1.0, -0.1, 0.9, -0.4], [0.5, 1.0, -0.1, 0.9, 0.4], [-0.2, 1.05, -0.35, 0.6, -0.2], [0.2, 1.05, -0.35, 0.6, 0.2], [0, 0.9, -0.4, 0.5, 0]]) { const c = new THREE.Mesh(oct, glowMat); c.scale.set(0.3 * s, 0.9 * s, 0.3 * s); c.position.set(x, y, z); c.rotation.z = r; torso.add(c); }
  if (o.mech) for (const lg of legs) part(lg.k, cyl, 0x7af0ff, 0.12, 0.05, 0.12, 0, -0.48, -0.1, 0, 0, 0, true);
  let wings = []; if (o.wings) wings = [-1, 1].map((s) => { const p = grp(torso, s * 0.35, 0.85, -0.3); const shp = new THREE.Shape(); shp.moveTo(0, 0); shp.lineTo(1.3 * s, 0.7); shp.lineTo(1.6 * s, 0.1); shp.lineTo(1.1 * s, -0.3); shp.lineTo(0.7 * s, -0.1); shp.lineTo(0.3 * s, -0.4); shp.closePath(); const w = new THREE.Mesh(new THREE.ShapeGeometry(shp), new THREE.MeshLambertMaterial({ color: o.wings, side: THREE.DoubleSide, flatShading: true })); w.rotation.y = s * 0.5; p.add(w); return { p, s }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (toad ? 4 : 5.5 + move * 2), sw = Math.sin(w) * (toad ? 0.35 : 0.55) * move;
      if (toad) { const hop = Math.max(0, Math.sin(w * 0.5)) * move; hip.position.y = 0.55 + hop * 0.5 + lift; legs[0].l.rotation.x = legs[1].l.rotation.x = -hop * 0.8; legs[0].k.rotation.x = legs[1].k.rotation.x = hop * 1.2; }
      else { legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; legs[0].k.rotation.x = Math.max(0, -Math.sin(w)) * 0.6 * move; legs[1].k.rotation.x = Math.max(0, Math.sin(w)) * 0.6 * move; hip.position.y = 0.9 + Math.abs(Math.sin(w)) * 0.05 * move + lift + (o.hover ? Math.sin(t * 2) * 0.08 : 0); }
      hip.rotation.z = Math.sin(w) * 0.05 * move; arms[0].rotation.x = -sw * 0.4; arms[1].rotation.x = sw * 0.4; tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 2.2 - i * 0.7) * (0.12 + move * 0.08); });
      torso.rotation.x = toad ? 0.1 : 0.28; neck.rotation.x = 0; jaw.rotation.x = 0.05 + Math.sin(t * 1.3) * 0.03; for (const wg of wings) wg.p.rotation.y = wg.s * (0.2 + Math.sin(t * 3) * 0.25);
      let glowK = 0;
      if (act === 'hit') { const s = S(k, 1); neck.rotation.x = 0.5 * s; torso.rotation.x += 0.2 * s; jaw.rotation.x = 0.5 * s; arms[1].rotation.x = -1.6 * s; if (o.drills) arms[0].rotation.x = -1.6 * s; }
      else if (act === 'cast') { const s = S(k, 1); neck.rotation.x = -0.4 * s + 0.3 * Math.max(0, k - 0.5); jaw.rotation.x = 0.7 * s; glowK = s; for (const wg of wings) wg.p.rotation.y = wg.s * (0.2 + 0.7 * s); if (o.drills) { arms[0].rotation.x = arms[1].rotation.x = -1.4 * s; } }
      else if (act === 'ko') koTip(body, k);
      if (o.glow) glowMat.color.copy(glow0).multiplyScalar(1 + glowK * 1.4);
      if (o.drills) for (const a of arms) a.children[1].rotation.y += dt * 20;
    } };
}

// ---------- the ape: knuckle-walks on long arms ----------
function ape(body, K) {
  const [fur, dark, face, , eyeA] = K.pal || [0x3b2c24, 0x241a14, 0x6a5040, 0, 0xffb02a];
  const hip = grp(body, 0, 0.72, 0); const torso = grp(hip, 0, 0.05, 0); torso.rotation.x = 0.45;
  part(torso, box, fur, 1.1, 1.0, 0.78, 0, 0.48, 0); part(torso, box, face, 0.72, 0.6, 0.1, 0, 0.55, 0.4);
  const chest = grp(torso, 0, 0.55, 0.45);
  const neck = grp(torso, 0, 1.0, 0.18); const head = grp(neck, 0, 0.1, 0.1);
  part(head, box, fur, 0.5, 0.46, 0.46, 0, 0.1, 0); part(head, box, dark, 0.52, 0.1, 0.14, 0, 0.26, 0.2); part(head, box, face, 0.36, 0.26, 0.22, 0, 0, 0.24);
  for (const x of [-0.11, 0.11]) part(head, box, eyeA, 0.07, 0.05, 0.04, x, 0.16, 0.25, 0, 0, 0, true);
  const jaw = grp(head, 0, -0.12, 0.18); part(jaw, box, face, 0.3, 0.1, 0.2, 0, -0.03, 0.04);
  const mouth = grp(head, 0, -0.05, 0.4);
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * 0.66, 0.85, 0.15); part(a, box, fur, 0.28, 0.6, 0.3, 0, -0.26, 0); const el = grp(a, 0, -0.55, 0); part(el, box, fur, 0.26, 0.6, 0.28, 0, -0.26, 0.04); part(el, box, dark, 0.32, 0.22, 0.36, 0, -0.6, 0.06); return { a, el }; });
  const hand = grp(arms[1].el, 0, -0.62, 0.15);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * 0.32, 0, -0.05); part(l, box, fur, 0.34, 0.4, 0.38, 0, -0.16, 0); const k = grp(l, 0, -0.36, 0); part(k, box, fur, 0.3, 0.32, 0.32, 0, -0.14, 0); part(k, box, dark, 0.34, 0.1, 0.46, 0, -0.33, 0.08); return { l, k }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (4.6 + move * 2), sw = Math.sin(w) * 0.5 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; arms[0].a.rotation.x = -0.35 - sw * 0.9; arms[1].a.rotation.x = -0.35 + sw * 0.9; arms[0].el.rotation.x = 0.25; arms[1].el.rotation.x = 0.25;
      hip.position.y = 0.72 + Math.abs(Math.sin(w)) * 0.07 * move; torso.rotation.x = 0.45; torso.rotation.z = Math.sin(w) * 0.06 * move; neck.rotation.x = 0; jaw.rotation.x = 0;
      if (act === 'hit') { const s = S(k, 1); arms[1].a.rotation.x = -0.35 - 2.2 * s; arms[1].el.rotation.x = 0.25 - 0.4 * s; torso.rotation.x = 0.45 + 0.25 * s; }
      else if (act === 'cast') { const s = S(k, 1); const beat = Math.sin(k * Math.PI * 8) * 0.4 * s; torso.rotation.x = 0.45 - 0.4 * s; arms[0].a.rotation.x = -1.6 * s + beat; arms[1].a.rotation.x = -1.6 * s - beat; arms[0].el.rotation.x = arms[1].el.rotation.x = -1.2 * s; jaw.rotation.x = 0.5 * s; neck.rotation.x = -0.4 * s; }
      else if (act === 'ko') koTip(body, k, 'x');
    } };
}

// ---------- moths: hover on two pairs of flapping, patterned wings ----------
function wingGeo(front, m) { const s = new THREE.Shape(); if (front) { s.moveTo(0, 0); s.bezierCurveTo(0.4 * m, 0.5, 1.4 * m, 0.9, 1.9 * m, 0.45); s.bezierCurveTo(1.7 * m, -0.05, 1.0 * m, -0.3, 0, -0.12); } else { s.moveTo(0, -0.05); s.bezierCurveTo(0.5 * m, -0.1, 1.2 * m, -0.2, 1.3 * m, -0.65); s.bezierCurveTo(0.9 * m, -1.0, 0.3 * m, -0.6, 0, -0.25); } s.closePath(); return new THREE.ShapeGeometry(s, 12); }
function moth(body, K) {
  const [fuzz, wingC, edge, red, eyeC] = K.pal, dark = K.opt && K.opt.horn; const yel = dark ? 0xe8b82a : 0xffd24a;
  const hover = grp(body, 0, 1.6, 0);
  part(hover, ball, fuzz, 0.62, 0.55, 0.7, 0, 0, 0.1);
  const abd = grp(hover, 0, -0.05, -0.25); for (let i = 0; i < 4; i++) part(abd, ball, i % 2 ? (dark ? 0x3a3a5a : 0xd8c090) : fuzz, 0.46 - i * 0.07, 0.42 - i * 0.06, 0.4, 0, -0.04 * i, -0.28 * i);
  const head = grp(hover, 0, 0.08, 0.48); part(head, ball, fuzz, 0.38, 0.34, 0.34, 0, 0, 0);
  for (const x of [-0.13, 0.13]) part(head, ball, eyeC, 0.18, 0.18, 0.18, x, 0.04, 0.1, 0, 0, 0, true);
  if (dark) part(head, cone8, 0xe8b82a, 0.12, 0.6, 0.12, 0, 0.12, 0.3, 1.0);
  const ant = [-1, 1].map((s) => { const a = grp(head, s * 0.08, 0.14, 0.05); part(a, box, 0x8a6a40, 0.03, 0.5, 0.03, 0, 0.24, 0.04, 0.3, 0, s * -0.35); return a; });
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) part(hover, box, 0x8a6a40, 0.04, 0.4, 0.04, s * 0.22, -0.3, 0.2 - i * 0.18, 0.2, 0, s * 0.5);
  const mouth = grp(head, 0, 0.3, 0.2), hand = grp(hover, 0, -0.35, 0.2), chest = grp(hover, 0, 0, 0.4);
  const mk = (geo, c, z) => { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = z; return m; };
  const wings = []; for (const front of [true, false]) for (const s of [-1, 1]) { const piv = grp(hover, s * 0.2, 0.05, front ? 0.12 : -0.08); const w = grp(piv, 0, 0, 0);
    const geo = wingGeo(front, s); /* mirrored for the left side (a negative scale would flip it out of sight) */ const base = mk(geo, wingC, 0); const rim = mk(geo, edge, -0.01); rim.scale.set(1.06, 1.08, 1); w.add(rim, base);
    for (const [cx, cz, r, c] of front ? [[1.35, -0.45, 0.22, edge], [1.35, -0.45, 0.13, red], [0.7, -0.25, 0.12, yel]] : [[0.75, 0.45, 0.16, red], [0.45, 0.25, 0.08, yel]]) { const d = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); d.rotation.x = -Math.PI / 2; d.position.set(cx * s, 0.012, cz); w.add(d); }
    wings.push({ piv, front, s }); }
  return { mouth, hand, chest, shadowK: 1.3,
    anim(t, dt, move, act, k) {
      const sp = 5 + move * 4, f = Math.sin(t * sp);
      for (const w of wings) { w.piv.rotation.z = w.s * (0.25 + f * (w.front ? 0.65 : 0.5)); w.piv.rotation.y = w.s * (w.front ? 0.1 : -0.15); }
      hover.position.y = 1.6 + Math.sin(t * sp) * 0.08 + Math.sin(t * 1.1) * 0.1; hover.rotation.x = 0.12 * move; hover.rotation.z = 0; abd.rotation.x = Math.sin(t * 1.7) * 0.08; ant.forEach((a, i) => { a.rotation.x = Math.sin(t * 3 + i) * 0.15; });
      if (act === 'hit') { const s = S(k, 1); hover.rotation.x = 0.12 * move + 0.5 * s; hover.position.y -= 0.4 * s; }
      else if (act === 'cast') { const s = S(k, 1); for (const w of wings) w.piv.rotation.z = w.s * (0.25 - 0.4 * s); hover.position.y += 0.3 * s; }
      else if (act === 'ko') { hover.position.y = Math.max(0.2, 1.6 - k * 1.6); hover.rotation.z = k * 1.2; }
    } };
}

// ---------- winged flyers: a pterosaur, or a three-headed dragon ----------
function ptero(body, K) {
  const [skin, dark, belly, acc, eyeC] = K.pal, heads = (K.opt && K.opt.heads) || 1;
  const hover = grp(body, 0, 1.8, 0);
  part(hover, box, skin, 0.6, 0.5, 1.0, 0, 0, 0); part(hover, box, belly, 0.45, 0.12, 0.8, 0, -0.26, 0.05);
  const necks = []; const xs = heads === 3 ? [-0.35, 0, 0.35] : [0];
  for (const x of xs) { const n = grp(hover, x, 0.15, 0.45); n.rotation.x = -0.5; n.rotation.y = x * 0.6; part(n, box, skin, 0.18, 0.18, 0.7, 0, 0, 0.3); const h = grp(n, 0, 0, 0.7); h.rotation.x = 0.5;
    part(h, box, skin, 0.26, 0.24, 0.34, 0, 0, 0.05); part(h, cone, acc, 0.14, 0.55, 0.14, 0, 0, 0.35, Math.PI / 2); if (heads === 3) { for (const s of [-1, 1]) part(h, cone, acc, 0.06, 0.3, 0.06, s * 0.1, 0.2, -0.1, -0.5); } else part(h, cone, acc, 0.08, 0.5, 0.2, 0, 0.12, -0.25, -1.2);
    for (const s of [-1, 1]) part(h, box, eyeC, 0.05, 0.04, 0.04, s * 0.1, 0.05, 0.15, 0, 0, 0, true); necks.push(n); }
  const mouth = grp(necks[(necks.length / 2) | 0].children[1] ? necks[(necks.length / 2) | 0] : hover, 0, 0, 1.15);
  const tails = (heads === 3 ? [-0.2, 0.2] : [0]).map((x) => { const tl = grp(hover, x, 0, -0.5); part(tl, box, skin, 0.16, 0.16, 0.9, 0, 0, -0.45); return tl; });
  const legs = [-1, 1].map((s) => { const l = grp(hover, s * 0.2, -0.3, -0.1); part(l, box, dark, 0.1, 0.45, 0.1, 0, -0.2, 0); part(l, box, dark, 0.2, 0.06, 0.25, 0, -0.45, 0.05); return l; });
  const wings = [-1, 1].map((s) => { const piv = grp(hover, s * 0.3, 0.15, 0.1); const shp = new THREE.Shape(); shp.moveTo(0, 0.25); shp.lineTo(1.4 * s, 0.35); shp.lineTo(2.4 * s, 0.05); shp.lineTo(1.7 * s, -0.35); shp.lineTo(1.0 * s, -0.25); shp.lineTo(0.4 * s, -0.5); shp.lineTo(0, -0.4); shp.closePath();
    const wm = new THREE.Mesh(new THREE.ShapeGeometry(shp), new THREE.MeshLambertMaterial({ color: heads === 3 ? acc : skin, side: THREE.DoubleSide, flatShading: true })); wm.rotation.x = -Math.PI / 2; piv.add(wm); part(piv, box, dark, 2.4, 0.06, 0.06, s * 1.2, 0.01, -0.25 + 0.2); return { piv, s }; });
  const hand = grp(hover, 0, -0.5, 0.2), chest = grp(hover, 0, 0, 0.6);
  return { mouth, hand, chest, shadowK: heads === 3 ? 1.6 : 1.3,
    anim(t, dt, move, act, k) {
      const f = Math.sin(t * (3.5 + move * 2.5)); for (const w of wings) w.piv.rotation.z = w.s * (0.15 + f * 0.6);
      hover.position.y = 1.8 - f * 0.12 + Math.sin(t * 1.2) * 0.1; hover.rotation.x = 0.15 * move; hover.rotation.z = 0;
      necks.forEach((n, i) => { n.rotation.y = (i - (necks.length - 1) / 2) * 0.5 + Math.sin(t * 2 + i * 2) * 0.15; }); tails.forEach((tl, i) => { tl.rotation.y = Math.sin(t * 2.5 + i) * 0.3; }); for (const l of legs) l.rotation.x = 0.4 + Math.sin(t * 2) * 0.1;
      if (act === 'hit') { const s = S(k, 1); hover.rotation.x = 0.6 * s; hover.position.y -= 0.5 * s; for (const n of necks) n.rotation.x = -0.5 + 0.6 * s; }
      else if (act === 'cast') { const s = S(k, 1); for (const w of wings) w.piv.rotation.z = w.s * (0.15 - 0.5 * s); for (const n of necks) n.rotation.x = -0.5 - 0.3 * s; }
      else { for (const n of necks) n.rotation.x = -0.5; }
      if (act === 'ko') { hover.position.y = Math.max(0.3, 1.8 - k * 1.8); hover.rotation.z = k * 1.3; }
    } };
}

// ---------- four-legged beasts: spiky, sail-backed or shelled ----------
function quad(body, K) {
  const [skin, dark, belly, acc, eyeC] = K.pal, o = K.opt || {};
  const hip = grp(body, 0, 0.85, 0);
  part(hip, box, skin, 1.0, 0.72, 1.7, 0, 0.1, 0); part(hip, box, belly, 0.8, 0.12, 1.4, 0, -0.28, 0.05);
  if (o.shell) { part(hip, new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), acc, 1.6, 1.0, 2.1, 0, 0.35, -0.05); for (let i = 0; i < 5; i++) part(hip, box, dark, 0.06, 0.06, 1.8, -0.5 + i * 0.25, 0.75, -0.05); }
  if (o.spikes) for (let i = 0; i < 12; i++) { const x = ((i % 3) - 1) * 0.3, z = -0.7 + Math.floor(i / 3) * 0.42; part(hip, cone, acc, 0.14, 0.5, 0.14, x, 0.6, z, -0.3, 0, x * 0.8); }
  let sail = null; if (o.sail) { const shp = new THREE.Shape(); shp.moveTo(-0.85, 0); shp.quadraticCurveTo(-0.3, 1.3, 0.5, 0.9); shp.quadraticCurveTo(0.8, 0.5, 0.85, 0); shp.closePath(); sail = new THREE.Mesh(new THREE.ShapeGeometry(shp), new THREE.MeshLambertMaterial({ color: acc, side: THREE.DoubleSide, flatShading: true })); sail.rotation.y = Math.PI / 2; sail.position.set(0, 0.45, 0); hip.add(sail); }
  const neck = grp(hip, 0, 0.2, 0.85); const head = grp(neck, 0, 0, 0.1);
  part(head, box, skin, 0.55, 0.45, 0.6, 0, 0.05, 0.25); part(head, box, skin, 0.42, 0.25, 0.35, 0, -0.05, 0.6);
  const jaw = grp(head, 0, -0.18, 0.2); part(jaw, box, dark, 0.38, 0.1, 0.55, 0, -0.03, 0.25);
  for (const s of [-1, 1]) part(head, box, eyeC, 0.06, 0.05, 0.04, s * 0.2, 0.18, 0.5, 0, 0, 0, true);
  if (o.horn) part(head, cone8, acc, 0.14, 0.45, 0.14, 0, 0.2, 0.7, 1.0);
  if (o.tusks) for (const s of [-1, 1]) part(jaw, cone8, 0xf0e8d0, 0.07, 0.35, 0.07, s * 0.14, 0.12, 0.45, -0.3);
  const mouth = grp(head, 0, -0.1, 0.85), chest = grp(hip, 0, 0.1, 0.9), hand = grp(head, 0, 0, 0.7);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => { const l = grp(hip, sx * 0.45, -0.15, sz * 0.6); part(l, box, skin, 0.3, 0.45, 0.32, 0, -0.18, 0); const kn = grp(l, 0, -0.38, 0); part(kn, box, skin, 0.25, 0.34, 0.27, 0, -0.12, 0); part(kn, box, dark, 0.32, 0.1, 0.4, 0, -0.3, 0.06); return { l, kn, ph: (sx * sz > 0 ? 0 : Math.PI) }; });
  const tail = []; let prev = grp(hip, 0, 0.05, -0.85); for (let i = 0; i < 4; i++) { const s = 1 - i * 0.2; part(prev, box, skin, 0.36 * s, 0.3 * s, 0.45, 0, 0, -0.2); if (o.spikes) part(prev, cone, acc, 0.1, 0.3 * s, 0.1, 0, 0.2 * s, -0.2); tail.push(prev); prev = grp(prev, 0, 0, -0.42); }
  return { mouth, hand, chest, shadowK: 1.2,
    anim(t, dt, move, act, k) {
      const w = t * (5 + move * 2.5); for (const lg of legs) { lg.l.rotation.x = Math.sin(w + lg.ph) * 0.5 * move; lg.kn.rotation.x = Math.max(0, Math.sin(w + lg.ph + 1)) * 0.5 * move; }
      hip.position.y = 0.85 + Math.abs(Math.sin(w)) * 0.05 * move; hip.rotation.x = 0; hip.rotation.y = 0; neck.rotation.x = Math.sin(t * 1.5) * 0.05; jaw.rotation.x = 0.05; tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 2.4 - i * 0.7) * (0.15 + move * 0.1); });
      if (act === 'hit') { const s = S(k, 1); neck.rotation.x = 0.4 * s; jaw.rotation.x = 0.6 * s; hip.position.y += 0.2 * s; }
      else if (act === 'cast') { const s = S(k, 1); neck.rotation.x = -0.5 * s; jaw.rotation.x = 0.7 * s; hip.rotation.x = -0.15 * s; if (sail) sail.scale.setScalar(1 + 0.3 * s); }
      else if (act === 'ko') koTip(body, k);
    } };
}

// ---------- the crab: carapace, big claws, six scuttling legs, walks sideways ----------
function crab(body, K) {
  const [shell, dark, light, acc] = K.pal; const side = grp(body, 0, 0, 0); side.rotation.y = 0; // the game turns the whole rig; the crab just looks the part
  const hip = grp(side, 0, 0.7, 0);
  part(hip, ball, shell, 1.3, 0.6, 1.1, 0, 0.1, 0); part(hip, box, light, 0.9, 0.1, 0.7, 0, -0.18, 0.05);
  const tail = []; let prev = grp(hip, 0, 0, -0.5); for (let i = 0; i < 4; i++) { const s = 1 - i * 0.15; part(prev, box, shell, 0.6 * s, 0.25 * s, 0.32, 0, 0, -0.15); tail.push(prev); prev = grp(prev, 0, -0.03, -0.3); } part(prev, cone, light, 0.5, 0.3, 0.1, 0, 0, -0.1, Math.PI / 2);
  const head = grp(hip, 0, 0.1, 0.55); part(head, box, shell, 0.5, 0.3, 0.3, 0, 0, 0); for (const s of [-1, 1]) { part(head, cyl, dark, 0.04, 0.3, 0.04, s * 0.15, 0.25, 0.05); part(head, ball, 0x111111, 0.1, 0.1, 0.1, s * 0.15, 0.4, 0.05); part(head, box, acc, 0.02, 0.02, 1.2, s * 0.1, 0.1, 0.6, -0.3, s * 0.3, 0); }
  const claws = [-1, 1].map((s) => { const a = grp(hip, s * 0.55, 0.05, 0.35); part(a, box, shell, 0.25, 0.25, 0.6, 0, 0, 0.25, 0, s * -0.3); const p = grp(a, s * -0.15, 0, 0.6); part(p, box, shell, 0.45, 0.32, 0.55, 0, 0, 0.25); const pin = grp(p, 0, 0, 0.2); part(pin, box, light, 0.2, 0.15, 0.5, s * 0.12, -0.05, 0.3); return { a, p, pin, s }; });
  const legs = []; for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const l = grp(hip, s * 0.55, -0.05, 0.15 - i * 0.3); part(l, box, shell, 0.5, 0.08, 0.08, s * 0.25, 0.05, 0, 0, 0, s * -0.4); const kn = grp(l, s * 0.48, 0.15, 0); part(kn, box, dark, 0.07, 0.6, 0.07, 0, -0.38, 0, 0, 0, s * 0.25); legs.push({ l, s, ph: i * 2 + (s > 0 ? 1 : 0) }); }
  const mouth = grp(head, 0, 0, 0.2), hand = grp(claws[1].p, 0, 0, 0.5), chest = grp(hip, 0, 0, 0.6);
  return { mouth, hand, chest, shadowK: 1.3,
    anim(t, dt, move, act, k) {
      const w = t * (7 + move * 4); for (const lg of legs) lg.l.rotation.y = Math.sin(w + lg.ph) * 0.4 * move + 0.0; hip.position.y = 0.7 + Math.abs(Math.sin(w)) * 0.04 * move; hip.rotation.z = Math.sin(w) * 0.05 * move;
      for (const c of claws) { c.a.rotation.x = Math.sin(t * 1.5 + c.s) * 0.1; c.pin.rotation.y = c.s * (0.15 + Math.max(0, Math.sin(t * 2 + c.s)) * 0.3); } tail.forEach((s, i) => { s.rotation.x = Math.sin(t * 2 - i) * 0.08; });
      if (act === 'hit') { const s = S(k, 1); for (const c of claws) { c.a.rotation.x = -0.6 * s; c.pin.rotation.y = c.s * 0.6 * s; } }
      else if (act === 'cast') { const s = S(k, 1); for (const c of claws) c.a.rotation.x = -1.0 * s; hip.position.y += 0.2 * s; }
      else if (act === 'ko') koTip(body, k);
    } };
}

// ---------- the spider: eight legs, a big striped abdomen, red eyes ----------
function spider(body, K) {
  const [blk, dark, stripe, , eyeC] = K.pal;
  const hip = grp(body, 0, 1.0, 0);
  part(hip, ball, blk, 0.8, 0.6, 0.8, 0, 0, 0.3); const abd = grp(hip, 0, 0.15, -0.55); part(abd, ball, blk, 1.3, 1.1, 1.5, 0, 0.1, -0.2); for (let i = 0; i < 3; i++) part(abd, box, stripe, 1.1 - i * 0.2, 0.08, 0.14, 0, 0.62 - i * 0.04, -0.6 + i * 0.4);
  for (const [x, y] of [[-0.14, 0.12], [0.14, 0.12], [-0.25, 0.02], [0.25, 0.02], [-0.07, 0.2], [0.07, 0.2]]) part(hip, ball, eyeC, 0.1, 0.1, 0.1, x, y, 0.68, 0, 0, 0, true);
  const fangs = [-1, 1].map((s) => { const f = grp(hip, s * 0.12, -0.15, 0.62); part(f, cone, dark, 0.08, 0.3, 0.08, 0, -0.12, 0.05, Math.PI); return f; });
  const legs = []; for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const l = grp(hip, s * 0.3, 0.05, 0.45 - i * 0.22); l.rotation.y = s * (-0.6 + i * 0.4); part(l, box, blk, 0.9, 0.09, 0.09, s * 0.45, 0.25, 0, 0, 0, s * 0.5); const kn = grp(l, s * 0.85, 0.48, 0); part(kn, box, blk, 0.08, 1.05, 0.08, s * 0.12, -0.5, 0, 0, 0, s * 0.25); part(kn, box, stripe, 0.1, 0.12, 0.1, 0, -0.1, 0); legs.push({ l, s, ph: i + (s > 0 ? 0.5 : 0) }); }
  const mouth = grp(hip, 0, -0.1, 0.75), hand = grp(hip, 0, -0.2, 0.7), chest = grp(hip, 0, 0, 0.7);
  return { mouth, hand, chest, shadowK: 1.6,
    anim(t, dt, move, act, k) {
      const w = t * (8 + move * 4); for (const lg of legs) { lg.l.rotation.x = Math.sin(w + lg.ph * Math.PI) * 0.35 * move; lg.l.rotation.z = Math.max(0, Math.sin(w + lg.ph * Math.PI)) * 0.25 * move * lg.s; }
      hip.position.y = 1.0 + Math.sin(w * 2) * 0.03 * move; abd.rotation.x = Math.sin(t * 1.5) * 0.06; for (const f of fangs) f.rotation.x = Math.sin(t * 3) * 0.1;
      if (act === 'hit') { const s = S(k, 1); hip.rotation.x = -0.35 * s; for (const f of fangs) f.rotation.x = 0.8 * s; legs[0].l.rotation.x = legs[1].l.rotation.x = -0.8 * s; }
      else if (act === 'cast') { const s = S(k, 1); hip.rotation.x = 0.3 * s; abd.rotation.x = -0.7 * s; }
      else { hip.rotation.x = 0; }
      if (act === 'ko') { body.rotation.z = Math.min(Math.PI, k * 3); body.position.y = k * 0.6; }
    } };
}

// ---------- the blob: oozes along, squashing and stretching, two big red eyes ----------
function blob(body, K) {
  const [skin, dark, light, slime, eyeC] = K.pal;
  const core = grp(body, 0, 0, 0); const lumps = [];
  for (const [x, y, z, s, c] of [[0, 0.7, 0, 1.4, skin], [0.25, 1.4, 0.1, 0.9, skin], [-0.3, 1.25, -0.1, 0.8, dark], [0, 1.95, 0.05, 0.7, skin], [0.4, 0.5, -0.3, 0.7, dark], [-0.45, 0.45, 0.3, 0.65, light]]) lumps.push(part(core, ball, c, s, s * 0.9, s, x, y, z));
  for (const s of [-1, 1]) { part(core, oct, eyeC, 0.18, 0.5, 0.1, s * 0.16, 1.7, 0.42, 0, 0, s * 0.2, true); part(core, box, 0x111111, 0.04, 0.4, 0.04, s * 0.16, 1.7, 0.46); }
  const drips = []; for (let i = 0; i < 6; i++) { const d = part(core, ball, slime, 0.12, 0.22, 0.12, Math.cos(i) * 0.6, 0.6, Math.sin(i) * 0.6, 0, 0, 0, true); drips.push({ d, ph: i }); }
  const mouth = grp(core, 0, 1.45, 0.55), hand = grp(core, 0, 1.0, 0.6), chest = grp(core, 0, 1.0, 0.6);
  return { mouth, hand, chest, shadowK: 1.3,
    anim(t, dt, move, act, k) {
      const w = t * (3 + move * 3); core.scale.set(1 + Math.sin(w) * 0.08, 1 - Math.sin(w) * 0.08, 1 + Math.sin(w) * 0.08); lumps.forEach((l, i) => { l.position.y += Math.sin(t * 2 + i) * 0.002; });
      for (const d of drips) { const k2 = ((t * 0.6 + d.ph * 0.17) % 1); d.d.position.y = 0.9 - k2 * 0.9; d.d.scale.setScalar(0.12 * (1 - k2 * 0.5)); }
      if (act === 'hit') { const s = S(k, 1); core.scale.set(1 + 0.3 * s, 1 - 0.25 * s, 1 + 0.3 * s); }
      else if (act === 'cast') { const s = S(k, 1); core.scale.set(1 - 0.15 * s, 1 + 0.3 * s, 1 - 0.15 * s); }
      else if (act === 'ko') { core.scale.set(1 + k, Math.max(0.15, 1 - k), 1 + k); }
    } };
}

// ---------- the plant: a toothy bloom on a thick stalk, vines writhing round its base ----------
function plant(body, K) {
  const [green, dark, red, teeth, light] = K.pal;
  const base = grp(body, 0, 0, 0); part(base, ball, dark, 1.6, 0.6, 1.6, 0, 0.2, 0);
  const stalk = grp(base, 0, 0.4, 0); part(stalk, cyl, green, 0.4, 1.2, 0.4, 0, 0.6, 0);
  const head = grp(stalk, 0, 1.35, 0.1); head.rotation.x = 0.5;
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(head, box, green, 0.42, 0.06, 0.6, Math.cos(a) * 0.45, Math.sin(a) * 0.45, -0.05, 0, 0, a + Math.PI / 2); }
  const jawT = grp(head, 0, 0.12, 0.05), jawB = grp(head, 0, -0.12, 0.05); part(jawT, ball, red, 0.7, 0.32, 0.6, 0, 0.1, 0.25); part(jawB, ball, red, 0.7, 0.32, 0.6, 0, -0.1, 0.25);
  for (let i = 0; i < 6; i++) { part(jawT, cone, teeth, 0.06, 0.16, 0.06, -0.25 + i * 0.1, -0.05, 0.45, Math.PI); part(jawB, cone, teeth, 0.06, 0.16, 0.06, -0.25 + i * 0.1, 0.05, 0.45); }
  const vines = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; let prev = grp(base, Math.cos(a) * 0.6, 0.3, Math.sin(a) * 0.6); prev.rotation.y = -a + Math.PI / 2; const segs = []; for (let j = 0; j < 4; j++) { part(prev, box, j % 2 ? green : light, 0.16 - j * 0.02, 0.16 - j * 0.02, 0.42, 0, 0, 0.2); segs.push(prev); prev = grp(prev, 0, 0, 0.4); } part(prev, cone, red, 0.12, 0.3, 0.12, 0, 0, 0.1, Math.PI / 2); vines.push({ segs, ph: i }); }
  const mouth = grp(head, 0, 0, 0.6), hand = grp(head, 0, 0, 0.6), chest = grp(stalk, 0, 1.2, 0.4);
  return { mouth, hand, chest, shadowK: 1.5,
    anim(t, dt, move, act, k) {
      for (const v of vines) v.segs.forEach((s, j) => { s.rotation.x = Math.sin(t * 2 + v.ph + j * 0.7) * 0.35 - 0.15; s.rotation.y = Math.sin(t * 1.6 + v.ph * 2 + j) * 0.3 * (1 + move); });
      stalk.rotation.x = Math.sin(t * 1.2) * 0.08 + move * 0.15; stalk.rotation.z = Math.sin(t * 0.9) * 0.08; jawT.rotation.x = -0.15 - Math.max(0, Math.sin(t * 1.4)) * 0.15; jawB.rotation.x = 0.15 + Math.max(0, Math.sin(t * 1.4)) * 0.15;
      if (act === 'hit') { const s = S(k, 1); stalk.rotation.x = 0.6 * s; jawT.rotation.x = -0.7 * s; jawB.rotation.x = 0.7 * s; }
      else if (act === 'cast') { const s = S(k, 1); stalk.rotation.x = -0.3 * s; head.scale.setScalar(1 + 0.3 * s); } else head.scale.setScalar(1);
      if (act === 'ko') { stalk.rotation.x = Math.min(1.4, k * 2); }
    } };
}

// ---------- the squid: a tall mantle and eight writhing tentacles ----------
function squid(body, K) {
  const [skin, dark, light, acc, eyeC] = K.pal;
  const hip = grp(body, 0, 0.6, 0); const mantle = grp(hip, 0, 0.5, 0);
  part(mantle, cone8, skin, 1.0, 1.7, 1.0, 0, 0.95, 0); part(mantle, ball, skin, 1.05, 0.7, 1.05, 0, 0.1, 0); for (const s of [-1, 1]) part(mantle, box, acc, 0.06, 0.8, 0.5, s * 0.45, 1.05, -0.05, 0, 0, s * -0.25);
  for (const s of [-1, 1]) { part(mantle, ball, 0xf0e8d0, 0.32, 0.32, 0.2, s * 0.32, 0.15, 0.42); part(mantle, ball, eyeC, 0.16, 0.16, 0.12, s * 0.32, 0.15, 0.5, 0, 0, 0, true); }
  const tents = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; let prev = grp(hip, Math.cos(a) * 0.35, -0.05, Math.sin(a) * 0.35); prev.rotation.y = -a + Math.PI / 2; const segs = []; for (let j = 0; j < 4; j++) { part(prev, box, j % 2 ? skin : light, 0.2 - j * 0.035, 0.16 - j * 0.03, 0.38, 0, 0, 0.18); segs.push(prev); prev = grp(prev, 0, 0, 0.36); } tents.push({ segs, ph: i }); }
  const mouth = grp(hip, 0, 0.3, 0.55), hand = grp(hip, 0, 0, 0.9), chest = grp(mantle, 0, 0.3, 0.5);
  return { mouth, hand, chest, shadowK: 1.5,
    anim(t, dt, move, act, k) {
      for (const tn of tents) tn.segs.forEach((s, j) => { s.rotation.x = 0.35 + Math.sin(t * (3 + move * 3) + tn.ph + j * 0.8) * 0.35; s.rotation.y = Math.sin(t * 2 + tn.ph) * 0.2; });
      hip.position.y = 0.6 + Math.sin(t * 2) * 0.06; mantle.rotation.x = Math.sin(t * 1.3) * 0.06 + move * 0.2;
      if (act === 'hit') { const s = S(k, 1); mantle.rotation.x = 0.5 * s; for (const tn of tents) tn.segs[0].rotation.x = -0.6 * s; }
      else if (act === 'cast') { const s = S(k, 1); mantle.scale.set(1 + 0.2 * s, 1 - 0.15 * s, 1 + 0.2 * s); for (const tn of tents) tn.segs[0].rotation.x = 0.35 - 1.0 * s; } else mantle.scale.setScalar(1);
      if (act === 'ko') { hip.position.y = 0.6 - k * 0.5; mantle.rotation.x = Math.min(1.4, k * 2); }
    } };
}
