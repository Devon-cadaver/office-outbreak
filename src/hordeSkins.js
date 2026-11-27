// Horde skins: the looks (hordeSkinData.js has the shop's names and prices). A horde skin is a palette plus a few extra
// shapes on the crowd's stand-in zombie (crowd.js), the colour of its glowing eyes, its gloopers' glow and acid, the
// way it falls, and a matching Grave Giant. Each horde worn is drawn as one more batch, so a zombie costs about the same.
//   hordeLook()          which horde a new zombie belongs to (null: the classic green), by the townsfolk share rule
//   hordeCols(id, spit)  its four outfit colours (shirt, trousers, skin, hair)
//   hordeFigure(id)      the stand-in's geometry (aPart: colour slot + limb, aCol: fixed colours for slot 5)
//   patchCrowdShader(sh) the crowd material's shader, with slot 5 and limb 5 (capes, scarves and hems that sway)
//   hordeGiant(id)       a Grave Giant in the horde's look, built like makeGiant (horde.js)
//   hordePreview(id)     a shop picture: three zombies and a glooper shambling on the spot
import * as THREE from 'three';
import { mergeParts } from './perf.js';
import { getEquipped, townShare, townSkin, CHAR_SKINS } from './skins.js';
import { HORDE_SKINS } from './hordeSkinData.js';
import { getEra } from './era.js';

const pick = (a) => a[(Math.random() * a.length) | 0];
const OUTFITS = [[0x4f8fd6, 0x3b3f55, 0xf0c9a6, 0x4a2f1c], [0xff8a2a, 0x2c3148, 0xf0c9a6, 0x1f2740], [0x3a3d4a, 0x30333f, 0xf3d2b3, 0xf3d2b3], [0x2a2730, 0x3a5fa8, 0xf0c9a6, 0x7a3fa8], [0xd8f03a, 0x2c3148, 0xf0c9a6, 0x1f2740], [0x1e1b22, 0x3a4a6a, 0xf0c9a6, 0x3fbf4a], [0xc23b6b, 0x2f4f6a, 0xf0c9a6, 0xe85aa0], [0x9a3a4a, 0x2b3a2b, 0xe9c39e, 0x2a1a10]];
const MIX = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex(), DARK = (c, f) => new THREE.Color(c).multiplyScalar(f).getHex();

// ---------- shapes ----------
const G = { cyl: new THREE.CylinderGeometry(0.5, 0.42, 1, 5, 1, false), box: new THREE.BoxGeometry(1, 1, 1), ball: new THREE.SphereGeometry(0.5, 8, 6), lo: new THREE.SphereGeometry(0.5, 6, 4), cap: new THREE.SphereGeometry(0.5, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.55), body: new THREE.CapsuleGeometry(0.5, 1, 1, 7), cone: new THREE.ConeGeometry(0.5, 1, 6), band: new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true),
  gBall: new THREE.IcosahedronGeometry(0.5, 1), gCap: new THREE.CapsuleGeometry(0.5, 1, 2, 7), /* (the giant's own low-poly shapes, for its flat shading) */ gBox: new THREE.BoxGeometry(1, 1, 1), gCone: new THREE.ConeGeometry(0.5, 1, 8), gBand: new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, true), gTorus: new THREE.TorusGeometry(0.5, 0.07, 6, 14) };
const tapers = {}; // a box narrower (k < 1) or wider (k > 1) at the top: capes and collars
const taper = (k) => { if (tapers[k]) return tapers[k]; const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * k); g.computeVertexNormals(); return (tapers[k] = g); };
// the crowd's stand-in (crowd.js), with switches. slot: 0 shirt, 1 trousers, 2 skin, 3 hair, 4 dark, 5 a fixed colour.
// limb: 0 none, 1/2 legs, 3/4 arms, 5 sways from the shoulders (capes, scarves, seaweed, a ghost's hem)
function base(add, o) { const lw = o.legW ?? 0.27, aw = o.armW ?? 0.21, bd = o.body ?? [0.78, 0.46, 0.6], hd = o.hand ?? 0.17, ax = o.armX ?? 1;
  if (o.legs !== false) for (const [x, l] of [[-0.16, 1], [0.16, 2]]) { add(G.cyl, lw, 0.86, lw, x, 0.52, 0, 1, l); add(G.box, o.bootW ?? 0.26, 0.16, o.bootL ?? 0.38, x, 0.09, 0.06, o.bootSlot ?? 4, l, o.bootCol ?? 0); }
  if (o.torso !== false) { if (o.boxBody) add(G.box, bd[0], 0.88, bd[2], 0, 1.3, 0, 0); else add(G.body, bd[0], bd[1], bd[2], 0, 1.3, 0, 0); }
  for (const [x, l] of [[-0.46, 3], [0.46, 4]]) { add(G.cyl, aw, 0.6, aw, x * ax, 1.38, 0, 0, l); add(G.box, hd, hd, hd, x * ax, 1.02, 0, 2, l); }
  if (o.head !== false) { const h = o.headS ?? [0.66, 0.66, 0.66]; add(G.ball, h[0], h[1], h[2], 0, 2.11, 0, 2); }
  if (o.hair !== false) add(G.cap, 0.72, 0.74, 0.72, 0, 2.1, -0.04, 3); }

// ---------- the hordes. eye: glow colour; glows: where it glows ([x, y, z, sx, sy, sz] on the figure, sizes as the game's
// eye bar at zombie size); gland: the gloopers' glow and acid; spit: the gloopers' colours; puff: what flies when one falls
const CLASSIC_EYE = [[0, 2.13, 0.33, 0.1, 0.042, 0.03]];
const LOOKS = {
  classic: { eye: 0xb4ff5a, gland: 0x6aff2a, spit: [0xb4f03a, 0x3e6a1a, 0xeaff9a, 0x8ad02a], puff: [0x6f9e4e, 0x9cf57a],
    cols: () => { const o = pick(OUTFITS); return [MIX(DARK(o[0], 0.7), 0x6f9e4e, 0.55), MIX(DARK(o[1], 0.6), 0x34422a, 0.5), 0x9cf57a, o[3] === o[2] ? 0x9cf57a : MIX(DARK(o[3], 0.55), 0x2a3a1e, 0.4)]; },
    fig: (add) => base(add, {}), gi: { sk: 0x93b083, sk2: 0x6f8c62, shirt: 0x55607a, pants: 0x3a3f4a, boot: 0x343c2e, wound: 0x5a1418 } },
  bones: { eye: 0x8fd4ff, gland: 0x7dff3a, glows: [[0, 2.14, 0.35, 0.11, 0.045, 0.03]], spit: [0xc8f08a, 0xa8d86a, 0xe8ffc0, 0xc8f08a], puff: [0xe8e2cf, 0xcfc7b0],
    cols: () => { const b = pick([0xe8e2cf, 0xddd6c0, 0xf0ebdb]); return [b, b, 0xf2eddc, b]; },
    fig: (add) => { base(add, { legW: 0.12, armW: 0.1, torso: false, head: false, hair: false, bootSlot: 1, bootW: 0.16, bootL: 0.3, hand: 0.13 });
      add(G.body, 0.6, 0.27, 0.46, 0, 1.45, 0, 0); for (const [y, w] of [[1.36, 0.5], [1.47, 0.52], [1.58, 0.48]]) add(G.box, w, 0.035, 0.1, 0, y, 0.2, 4); /* the gaps between the ribs */
      add(G.cyl, 0.1, 0.34, 0.1, 0, 1.03, -0.05, 0); add(G.box, 0.44, 0.15, 0.26, 0, 0.9, 0, 1); /* spine, hips */
      add(G.ball, 0.72, 0.68, 0.74, 0, 2.14, 0, 2); add(G.box, 0.36, 0.13, 0.3, 0, 1.86, 0.12, 2); for (const s of [-1, 1]) add(G.ball, 0.2, 0.17, 0.08, s * 0.14, 2.14, 0.33, 4); add(G.box, 0.06, 0.08, 0.04, 0, 2.01, 0.36, 4); },
    gi: { sk: 0xe8e2cf, sk2: 0xcfc7b0, pants: 0xd9d2bc, boot: 0xcfc7b0, thin: 1, ribs: 1, head: 'skull' } },
  vamp: { eye: 0xff3838, gland: 0xff3050, spit: [0xd0203a, 0x401018, 0xffe0e8, 0x300810], puff: [0x8a8690, 0x5a5660],
    cols: () => [pick([0x1a1420, 0x231a2e, 0x15131a]), 0x18161c, pick([0xe9e4ee, 0xddd6e6]), 0x0e0c12],
    fig: (add) => { base(add, {}); add(taper(0.62), 1.08, 1.22, 0.03, 0, 1.11, -0.34, 5, 5, 0x120e18); add(taper(0.62), 1.02, 1.16, 0.03, 0, 1.12, -0.31, 5, 5, 0x9a1020); /* a cape lined in red */
      add(taper(1.6), 0.5, 0.44, 0.03, 0, 1.98, -0.3, 5, 0, 0x120e18, -0.22); add(taper(1.6), 0.46, 0.4, 0.03, 0, 1.98, -0.27, 5, 0, 0x9a1020, -0.22); /* its tall collar */
      add(G.box, 0.2, 0.32, 0.05, 0, 1.5, 0.29, 5, 0, 0xf2eee8); add(G.box, 0.09, 0.09, 0.04, 0, 1.6, 0.32, 5, 0, 0xc01828); add(G.cone, 0.18, 0.15, 0.07, 0, 2.35, 0.29, 3, 0, 0, Math.PI); },
    gi: { sk: 0xe6e0ec, sk2: 0xcac0d4, shirt: 0x1a1420, pants: 0x18161c, boot: 0x0e0c12, hair: 0x0e0c12,
      extra: (P, p) => { P(p.torso, taper(0.5), 0x120e18, 3.6, 4.6, 0.08, 0, 0.3, -1.0, 0.12); P(p.torso, taper(0.5), 0x9a1020, 3.4, 4.4, 0.08, 0, 0.32, -0.93, 0.12); P(p.torso, taper(1.5), 0x120e18, 1.5, 1.3, 0.08, 0, 2.9, -0.5, -0.3); P(p.torso, taper(1.5), 0x9a1020, 1.4, 1.2, 0.08, 0, 2.9, -0.43, -0.3); P(p.torso, G.gBox, 0xf2eee8, 0.6, 0.9, 0.1, 0, 1.3, 0.74); } } },
  orc: { eye: 0xffaa22, gland: 0xffb020, spit: [0xe0a020, 0x5a3a1a, 0xb8c860, 0x201810], puff: [0x8a7a5a, 0x6a6e76],
    cols: () => [pick([0x5a3a22, 0x4a3426, 0x6a4428]), 0x3a2a1c, pick([0x7f8f45, 0x748440, 0x8a8c48]), 0x141210],
    fig: (add) => { base(add, { body: [0.94, 0.5, 0.68], armW: 0.26, armX: 1.12, hand: 0.21, hair: false, legW: 0.3 });
      for (const s of [-1, 1]) { add(G.box, 0.34, 0.14, 0.36, s * 0.53, 1.8, 0, 5, 0, 0x6a6e76); add(G.cone, 0.1, 0.22, 0.1, s * 0.56, 1.97, 0, 5, 0, 0xc8ccd2); add(G.cone, 0.07, 0.17, 0.07, s * 0.15, 2.12, 0.29, 5, 0, 0xf2e8c8); } /* iron shoulders with spikes, tusks */
      add(G.box, 0.5, 0.24, 0.32, 0, 1.96, 0.14, 2); add(G.box, 0.56, 0.07, 0.16, 0, 2.27, 0.25, 2); add(G.cyl, 0.16, 0.24, 0.16, 0, 2.52, -0.1, 3); add(G.ball, 0.22, 0.17, 0.22, 0, 2.66, -0.12, 3); add(G.box, 0.98, 0.08, 0.7, 0, 0.92, 0, 5, 0, 0x2a1c12); },
    gi: { sk: 0x7f8f45, sk2: 0x6a7838, shirt: 0x5a3a22, pants: 0x3a2a1c, boot: 0x2a1c12, wound: 0,
      extra: (P, p) => { for (const s of [-1, 1]) { P(p.torso, G.gBox, 0x6a6e76, 0.95, 0.4, 1.1, s * 1.2, 2.5, 0); P(p.torso, G.gCone, 0xc8ccd2, 0.3, 0.7, 0.3, s * 1.3, 2.95, 0); P(p.head, G.gCone, 0xf2e8c8, 0.16, 0.42, 0.16, s * 0.3, 0.18, 0.52); }
        P(p.head, G.gBall, 0x141210, 0.4, 0.5, 0.4, 0, 0.95, -0.1); P(p.torso, G.gBall, 0x6a4a2a, 2.5, 2.2, 0.7, 0, 1.5, -0.8); } } },
  mummy: { eye: 0xffd040, gland: 0x30f0d0, spit: [0x40d8c0, 0x2a8a7a, 0xa8f0e0, 0x40d8c0], puff: [0xd8c9a0, 0xc8b484],
    cols: () => { const b = pick([0xd8c9a0, 0xcfbe92, 0xe0d2ac]); return [b, 0xcbb98a, 0xe0d2a8, b]; },
    fig: (add) => { base(add, { hair: false, bootSlot: 1 }); const B = 0x8f7a54;
      for (const y of [1.0, 1.25, 1.52]) add(G.band, 0.83, 0.05, 0.65, 0, y, 0, 5, 0, B);
      for (const [x, l] of [[-0.16, 1], [0.16, 2]]) for (const y of [0.3, 0.62]) add(G.band, 0.3, 0.045, 0.3, x, y, 0, 5, l, B);
      for (const [x, l] of [[-0.46, 3], [0.46, 4]]) for (const y of [1.2, 1.46]) add(G.band, 0.24, 0.045, 0.24, x, y, 0, 5, l, B);
      for (const y of [1.98, 2.27]) add(G.band, 0.69, 0.045, 0.69, 0, y, 0, 5, 0, B);
      add(G.box, 0.38, 0.07, 0.04, 0, 2.13, 0.32, 4); add(G.box, 0.07, 0.02, 0.42, -0.46, 1.12, -0.2, 2, 3); /* the eye slit; a loose strip that hangs down when the arms are out */ },
    gi: { sk: 0xd8c9a0, sk2: 0xc4b48a, shirt: 0xcdbd92, pants: 0xbcac80, boot: 0xbcac80, wound: 0, bald: 1,
      extra: (P, p) => { for (const y of [0.7, 1.2, 1.7]) P(p.torso, G.gBand, 0x8f7a54, 2.2, 0.1, 1.56, 0, y, 0); for (const A of p.arms) for (const y of [-1.0, -1.7, -2.4]) P(A, G.gBand, 0x8f7a54, 0.58, 0.08, 0.58, 0, y, 0); for (const L of p.legs) for (const y of [-0.5, -1.2]) P(L, G.gBand, 0x8f7a54, 0.8, 0.08, 0.8, 0, y, 0);
        P(p.torso, G.gBall, 0xd8a830, 2.0, 0.3, 1.5, 0, 2.3, 0.2); P(p.torso, G.gBall, 0x2a4aa0, 1.5, 0.32, 1.2, 0, 2.34, 0.26); P(p.head, G.gBand, 0x8f7a54, 1.06, 0.08, 1.06, 0, 0.15, 0.04); P(p.head, G.gBand, 0x8f7a54, 1.0, 0.08, 1.0, 0, 0.62, 0.04); } } },
  gourd: { eye: 0xffb030, gland: 0xffe040, glows: [[0, 2.22, 0.42, 0.13, 0.05, 0.03], [0, 1.99, 0.39, 0.1, 0.03, 0.03]], spit: [0x8a6a2a, 0x5a4a2a, 0xf0e080, 0xfff050], puff: [0xff8a1a, 0xf0d890],
    cols: () => [pick([0x6a4a2a, 0x4a5a3a, 0x7a3a2a, 0x5a4a6a]), pick([0x3a3a52, 0x4a3a2a]), 0xd8b860, pick([0xff8a1a, 0xff7a10, 0xffa028])],
    fig: (add) => { base(add, { head: false, hair: false }); add(G.ball, 0.88, 0.72, 0.88, 0, 2.14, 0, 3); add(G.cyl, 0.09, 0.17, 0.09, 0, 2.54, 0, 5, 0, 0x3a6a24); /* the pumpkin is the hair slot, so each is its own orange */
      add(G.box, 0.36, 0.07, 0.04, 0, 1.98, 0.37, 5, 0, 0x3a1a04); for (const s of [-1, 1]) add(G.cone, 0.14, 0.12, 0.04, s * 0.15, 2.22, 0.41, 5, 0, 0x3a1a04); add(G.cone, 0.4, 0.15, 0.4, 0, 1.8, 0, 2, 0, 0, Math.PI); },
    gi: { sk: 0xd8b860, sk2: 0xc0a050, shirt: 0x7a3a2a, pants: 0x4a5a7a, boot: 0x3a2a1c, wound: 0, head: 'pumpkin', eyeZ: 0.36, eyeY: 0.18 } },
  wolf: { eye: 0xffe040, gland: 0xc8e0ff, spit: [0x2a2a3a, 0x22222e, 0xd0d8e8, 0xb0bcd0], puff: [0x7a6a5a, 0x4a3e34],
    cols: () => [pick([0x6a3a3a, 0x3a4a6a, 0x5a5a3a]), 0x33384a, pick([0x7a6a5a, 0x6a5a4a, 0x8a7a6a, 0x5a5048]), pick([0x4a3e34, 0x3a302a])],
    fig: (add) => { base(add, { hair: false, hand: 0.2 }); add(G.box, 0.26, 0.2, 0.34, 0, 2.02, 0.36, 2); add(G.box, 0.1, 0.08, 0.06, 0, 2.09, 0.54, 4);
      for (const s of [-1, 1]) add(G.cone, 0.17, 0.32, 0.12, s * 0.2, 2.47, -0.02, 3, 0, 0, 0, s * -0.25); add(G.ball, 0.92, 0.36, 0.72, 0, 1.75, -0.05, 3); add(G.cone, 0.2, 0.56, 0.2, 0, 0.84, -0.5, 3, 0, 0, -1.9); },
    gi: { sk: 0x7a6a5a, sk2: 0x5a4c40, shirt: 0x6a3a3a, pants: 0x33384a, boot: null, wound: 0, head: 'wolf', extra: (P, p) => { P(p.torso, G.gBall, 0x4a3e34, 2.7, 1.1, 1.9, 0, 2.2, -0.15); } } },
  frost: { eye: 0x80f0ff, gland: 0xc0ffff, spit: [0xe8fbff, 0x8ac8e0, 0xf0fdff, 0xffffff], puff: [0xe4f8ff, 0xa8d8f0],
    cols: () => [pick([0x4a6a8a, 0x6a4a6a, 0x3a5a5a, 0x7a5a3a]), 0x2a3a4a, pick([0xa8d8f0, 0x98c8e8, 0xb8e4f4]), 0xe8f6ff],
    fig: (add) => { base(add, {}); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(G.cone, 0.09, 0.26, 0.09, s * (0.3 + i * 0.09), 1.86 + (i % 2) * 0.04, -0.06 + i * 0.05, 5, 0, 0xe4f8ff, 0, s * -(0.25 + i * 0.3));
      add(G.band, 0.52, 0.11, 0.48, 0, 1.8, 0, 5, 0, 0xc0303c); add(G.box, 0.13, 0.55, 0.03, 0.14, 1.5, -0.33, 5, 5, 0xc0303c); for (const s of [-1, 0, 1]) add(G.cone, 0.06, 0.16, 0.06, s * 0.09, 1.86, 0.28, 5, 0, 0xe4f8ff, Math.PI); },
    gi: { sk: 0xa8d8f0, sk2: 0x88b8d8, shirt: 0x4a6a8a, pants: 0x2a3a4a, boot: 0x22303c, wound: 0, hair: 0xe8f6ff,
      extra: (P, p) => { for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P(p.torso, G.gCone, 0xe4f8ff, 0.3, 0.9 - i * 0.15, 0.3, s * (0.7 + i * 0.3), 2.75 - i * 0.1, -0.2, 0, s * -(0.2 + i * 0.25)); for (const x of [-0.25, 0, 0.25]) P(p.head, G.gCone, 0xe4f8ff, 0.16, 0.5 - Math.abs(x), 0.16, x, -0.34, 0.42, Math.PI); } } },
  clown: { eye: 0xff50c8, gland: 0xffc0f0, spit: [0xff40c0, 0xffffff, 0xffffff, 0xffe040], puff: [0xff3a3a, 0xffd020, 0x3a7aff, 0x4ad04a],
    cols: () => [pick([0xffd020, 0xe83030, 0x9a4ad0, 0x20b0a0]), pick([0x3a4ad0, 0xffd020, 0xe83030]), 0xf4f0ea, pick([0x3a7aff, 0xff7a1a, 0x4ad04a, 0xff5ab0])],
    fig: (add) => { base(add, { hair: false, bootSlot: 5, bootCol: 0xd8242a, bootW: 0.3, bootL: 0.58 }); for (const s of [-1, 1]) add(G.lo, 0.34, 0.34, 0.38, s * 0.32, 2.2, -0.04, 3); add(G.lo, 0.3, 0.2, 0.3, 0, 2.44, -0.02, 3);
      add(G.lo, 0.16, 0.16, 0.16, 0, 2.07, 0.34, 5, 0, 0xff2a2a); add(G.lo, 0.74, 0.13, 0.62, 0, 1.79, 0, 5, 0, 0xffffff); for (const y of [1.2, 1.45]) add(G.lo, 0.11, 0.11, 0.07, 0, y, 0.3, 5, 0, 0xffffff); },
    gi: { sk: 0xf4f0ea, sk2: 0xe0d8d0, shirt: 0xffd020, pants: 0x3a4ad0, boot: 0xd8242a, bootK: 1.35, wound: 0, bald: 1,
      extra: (P, p) => { for (const s of [-1, 1]) P(p.head, G.gBall, 0x3a7aff, 0.6, 0.6, 0.64, s * 0.52, 0.5, -0.06); P(p.head, G.gBall, 0x3a7aff, 0.5, 0.36, 0.5, 0, 0.9, -0.04); P(p.head, G.gBall, 0xff2a2a, 0.3, 0.3, 0.3, 0, 0.26, 0.58); P(p.torso, G.gBall, 0xffffff, 2.3, 0.34, 1.8, 0, 2.5, 0.2); } } },
  gummy: { eye: 0xffffff, gland: 0xe8ff3a, spit: [0xe8ff3a, 0xb8d020, 0xf4ff9a, 0xe8ff3a], puff: [0xff3a5a, 0xffe23a, 0x3a9aff, 0xff6ac8],
    cols: () => { const c = pick([0xff3a5a, 0xff9a2a, 0xffe23a, 0xa25aff, 0x3a9aff, 0xff6ac8]); return [c, DARK(c, 0.72), c, c]; },
    fig: (add) => { base(add, { hair: false, body: [0.86, 0.5, 0.68], headS: [0.74, 0.7, 0.72], bootSlot: 1, legW: 0.31, armW: 0.25, hand: 0.21 }); add(G.ball, 0.14, 0.09, 0.07, -0.12, 2.37, 0.24, 5, 0, 0xffffff); },
    gi: { sk: 0xff3a5a, sk2: 0xd82a48, shirt: 0xff3a5a, pants: 0xd82a48, boot: 0xd82a48, wound: 0, bald: 1, extra: (P, p) => { P(p.head, G.gBall, 0xffffff, 0.24, 0.14, 0.1, -0.2, 0.68, 0.36); } } },
  bot: { eye: 0xff3a2a, gland: 0xffa020, glows: [[0, 2.15, 0.28, 0.12, 0.04, 0.03]], spit: [0xffc820, 0x3a3a3a, 0xffe060, 0x3a3a3a], puff: [0xffd060, 0x8a9098],
    cols: () => [pick([0x8a9098, 0x9a6a4a, 0x4a6a8a, 0x6a7a5a]), 0x5a6068, 0xa8aeb4, 0x8a5a3a],
    fig: (add) => { base(add, { boxBody: true, body: [0.74, 0.46, 0.5], head: false, hair: false }); add(G.box, 0.56, 0.48, 0.5, 0, 2.12, 0, 2); add(G.box, 0.46, 0.11, 0.04, 0, 2.15, 0.25, 4);
      add(G.cyl, 0.04, 0.3, 0.04, 0.14, 2.5, 0, 5, 0, 0x2a2e34); add(G.ball, 0.1, 0.1, 0.1, 0.14, 2.67, 0, 5, 0, 0xff3a2a); add(G.box, 0.32, 0.22, 0.04, 0, 1.42, 0.25, 5, 0, 0x2a2e34); for (const s of [-1, 1]) add(G.ball, 0.2, 0.2, 0.2, s * 0.46, 1.68, 0, 3); },
    gi: { sk: 0xa8aeb4, sk2: 0x8a9098, shirt: 0x8a9098, pants: 0x5a6068, boot: 0x3a3e44, wound: 0, head: 'box', eyeZ: 0.2,
      extra: (P, p) => { P(p.torso, G.gBox, 0x8a5a3a, 0.8, 0.6, 0.1, 0.5, 1.3, 0.72); P(p.torso, G.gBox, 0x2a2e34, 0.7, 0.5, 0.1, -0.4, 1.9, 0.6); for (const s of [-1, 1]) P(p.torso, G.gBall, 0x8a5a3a, 0.8, 0.8, 0.8, s * 1.16, 2.0, 0.1); } } },
  sea: { eye: 0x40ffc0, gland: 0x40e0ff, spit: [0x60e8ff, 0x2a8aa0, 0xc0f4ff, 0x60e8ff], puff: [0x8ad8ff, 0x2f7a3a],
    cols: () => [pick([0xe0e4e8, 0xd8dcd8, 0xe8e0d0]), pick([0x2a3a5a, 0x5a4a3a]), pick([0x8aa8b0, 0x7a98a8, 0x98b4b0]), pick([0x2f6a3a, 0x2f6a3a, 0xb02a2a])],
    fig: (add) => { base(add, {}); for (const y of [1.08, 1.32, 1.56]) add(G.band, 0.83, 0.08, 0.65, 0, y, 0, 5, 0, 0x1c2a5a);
      for (const [x, z, h] of [[-0.2, -0.3, 0.5], [0.05, -0.35, 0.66], [0.24, -0.29, 0.44]]) add(G.box, 0.07, h, 0.02, x, 2.0 - h / 2, z, 5, 5, 0x2f7a3a); add(G.box, 0.05, 0.3, 0.02, 0.3, 2.0, 0.2, 5, 0, 0x2f7a3a); },
    gi: { sk: 0x8aa8b0, sk2: 0x6a8890, shirt: 0xe0e4e8, pants: 0x2a3a5a, boot: null, wound: 0, hair: 0x2f6a3a,
      extra: (P, p) => { for (const y of [0.8, 1.3, 1.8]) P(p.torso, G.gBand, 0x1c2a5a, 2.16, 0.2, 1.52, 0, y, 0); for (const [x, h] of [[-0.9, 1.6], [-0.3, 2.2], [0.4, 1.8], [1.0, 1.4]]) P(p.torso, G.gBox, 0x2f7a3a, 0.2, h, 0.06, x, 2.6 - h / 2, -0.95); P(p.torso, G.gTorus, 0x8a6a3a, 1.5, 1.5, 1.5, 0.5, 1.9, 0.1, 1.2, 0.7); } } },
  haunt: { eye: 0xb070ff, gland: 0xd070ff, bob: 1, spit: [0xc8a0ff, 0xa070e0, 0xe0c8ff, 0xc8a0ff], puff: [0xeef4ff, 0xc6d2f0],
    cols: () => { const c = pick([0xdfe8ff, 0xe8eeff, 0xd4dcf8]); return [c, 0xc6d2f0, 0xeef4ff, c]; },
    fig: (add) => { base(add, { legs: false, hair: false }); add(G.cone, 0.88, 0.98, 0.72, 0, 0.6, 0, 1, 5, 0, Math.PI); add(G.ball, 0.15, 0.19, 0.06, 0, 1.97, 0.31, 4); },
    gi: { sk: 0xeef4ff, sk2: 0xdfe8ff, shirt: 0xdfe8ff, pants: 0xc6d2f0, boot: null, wound: 0, bald: 1, head: 'ghost', extra: (P, p) => { P(p.hips, G.gCone, 0xc6d2f0, 2.6, 3.0, 2.0, 0, -0.9, 0); P(p.hips, G.gCone, 0xb8c6e8, 2.4, 0.5, 1.85, 0, -2.2, 0); } } }, /* (two parts, so the hem merges and flashes with the rest) */
};
for (const k in LOOKS) { const L = LOOKS[k]; L.id = k; if (!L.glows) L.glows = CLASSIC_EYE; L.eyeC = new THREE.Color(L.eye); L.glandC = new THREE.Color(L.gland); L.acidHit = [MIX(L.gland, 0xffffff, 0.5), L.gland]; L.acidPool = DARK(L.gland, 0.45); if (HORDE_SKINS[k]) Object.assign(L, { name: HORDE_SKINS[k].name, giantName: HORDE_SKINS[k].giant, clash: HORDE_SKINS[k].clash }); }
export const HORDE_LOOKS = LOOKS;
export const hordeOf = (id) => LOOKS[id] || LOOKS.classic;

// ---------- the round's own zombies (Zombie Air Raid sets them as a round starts; the other games leave them alone) ----------
// base: this level's default zombies, what every zombie outside the worn hordes is (null: the classic green).
// carry: the horde beaten in the last round won: it is a quarter of this one too, while the worn hordes leave it room
let baseLook = null, carryLook = null; const wornIds = () => (getEquipped().horde || []).map((x) => String(x).split(':')[1]).filter((k) => LOOKS[k]), okLook = (k) => (k && k !== 'classic' && LOOKS[k] ? k : null);
export function setHordeRound(base, carry) { baseLook = okLook(base); carryLook = okLook(carry); if (carryLook === baseLook) carryLook = null; }
// what the horde is made of this round: [{ id, share }] (id 'classic' for the green ones), the shares adding up to 1
export function hordeMix() { const l = wornIds(), s = townShare(l.length), out = l.map((id) => ({ id, share: s / l.length })); let rest = 1 - s;
  if (carryLook && !l.includes(carryLook) && rest > 1e-6) { const c = Math.min(rest, townShare(l.length + 1) - s); out.push({ id: carryLook, share: c }); rest -= c; } if (rest > 1e-6) out.push({ id: baseLook || 'classic', share: rest }); return out; }
// which horde a new zombie joins: one of the hordes worn (a quarter of the horde each), then the one carried over from the last round, and the level's own default for the rest; null for the classic green
export function hordeLook() { const l = wornIds(), r = Math.random(), s = townShare(l.length); if (l.length && r < s) return l[(Math.random() * l.length) | 0]; if (carryLook && !l.includes(carryLook) && r < townShare(l.length + 1)) return carryLook; return baseLook; }
// a Grave Giant's look: every giant wears one of the hordes worn (no share roll); with none worn, the level's own zombies or the ones carried over (null: the classic giant)
export function hordeAny() { const l = wornIds(), pool = l.length ? l : [baseLook, carryLook].filter(Boolean); return pool.length ? pool[(Math.random() * pool.length) | 0] : null; }
// two neighbouring colours of a horde's fall puff (the effect fades from one to the other)
export function puffPair(id) { const p = hordeOf(id).puff, i = (Math.random() * p.length) | 0; return [p[i], p[(i + 1) % p.length]]; }
// the townsfolk outfits that would look like a horde being worn (Air Raid's townsfolk leave these off)
export function hordeClashes() { return [...wornIds(), baseLook, carryLook].filter(Boolean).map((k) => LOOKS[k]).filter((L) => L && L.clash).map((L) => L.clash); }
// Air Raid's townsfolk outfit, leaving off any that would look like a horde being worn
export function airTownSkin() { const bad = hordeClashes(); if (!bad.length) return townSkin(); const l = (getEquipped().npc || []).filter((id) => !bad.includes(String(id).split(':')[1] || id)), era = getEra();
  const s = l.length && Math.random() < townShare(l.length) ? CHAR_SKINS[String(l[(Math.random() * l.length) | 0]).split(':')[1]] || null : null; return era === 'past' || era === 'future' ? s || CHAR_SKINS[era === 'past' ? 'cowpoke' : 'neon'] : s; }
// a full-size zombie in a horde's look (poster/characters.js makeCharacter's horde option): the matching townsfolk outfit's
// shapes where there is one (Skeleton, Vampire, Mummy...), the horde's colours otherwise, and its eye glow
export function hordeBody(id) { const L = LOOKS[id]; if (!L || id === 'classic') return null; const cs = L.clash && CHAR_SKINS[L.clash], c = L.cols();
  return { outfit: { shirt: c[0], pants: c[1], skin: c[2], hair: c[3], tie: null }, dress: cs ? shareSheet(cs.dress) : null, eye: L.eye }; } /* (the horde's own colours: a borrowed outfit gives only its shapes) */
// an outfit's see-through parts (the Ghost's sheet) share one material per colour instead of one each
const sheets = new Map(); function shareSheet(dress) { return dress && ((p) => { dress(p); p.g.traverse((m) => { const t = m.material; if (!m.isMesh || !t || !t.transparent || t.type !== 'MeshLambertMaterial') return; const k = t.color.getHex() + ':' + t.opacity; if (!sheets.has(k)) sheets.set(k, t); else if (sheets.get(k) !== t) { t.dispose(); m.material = sheets.get(k); } }); }); }
export const hordeCols = (id, spit = false) => { const L = hordeOf(id); return spit ? L.spit : L.cols(); };

// ---------- the stand-in figure ----------
const m4 = new THREE.Matrix4(), eu = new THREE.Euler(), tc = new THREE.Color(), figs = {};
export function hordeFigure(id) { const L = hordeOf(id); if (figs[L.id]) return figs[L.id]; const parts = [];
  L.fig((g, sx, sy, sz, x, y, z, slot, limb = 0, col = 0, rx = 0, rz = 0) => { const p = g.index ? g.toNonIndexed() : g.clone(); for (const a of Object.keys(p.attributes)) if (a !== 'position' && a !== 'normal') p.deleteAttribute(a);
    p.scale(sx, sy, sz); if (rx || rz) p.applyMatrix4(m4.makeRotationFromEuler(eu.set(rx, 0, rz))); p.translate(x, y, z);
    const n = p.attributes.position.count, ap = new Float32Array(n * 2), ac = new Float32Array(n * 3); tc.setHex(col); for (let i = 0; i < n; i++) { ap[i * 2] = slot; ap[i * 2 + 1] = limb; ac[i * 3] = tc.r; ac[i * 3 + 1] = tc.g; ac[i * 3 + 2] = tc.b; }
    p.setAttribute('aPart', new THREE.BufferAttribute(ap, 2)); p.setAttribute('aCol', new THREE.BufferAttribute(ac, 3)); parts.push(p); });
  const out = new THREE.BufferGeometry(); for (const [k, n] of [['position', 3], ['normal', 3], ['aPart', 2], ['aCol', 3]]) { let len = 0; for (const p of parts) len += p.attributes[k].array.length; const arr = new Float32Array(len); let o = 0; for (const p of parts) { arr.set(p.attributes[k].array, o); o += p.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(arr, n)); }
  for (const p of parts) p.dispose(); return (figs[L.id] = out); }
// the crowd's shader (crowd.js) plus slot 5 (aCol) and limb 5 (a gentle sway from the shoulders)
export function patchCrowdShader(sh) { sh.vertexShader = sh.vertexShader
  .replace('#include <common>', '#include <common>\nattribute vec2 aPart; attribute vec3 aCol; attribute vec3 iShirt; attribute vec3 iPants; attribute vec3 iSkin; attribute vec3 iHair; attribute vec3 iAnim;')
  .replace('#include <begin_vertex>', `#include <begin_vertex>
    if (aPart.y > 0.5) { bool leg = aPart.y < 2.5; float pivot = leg ? 0.95 : 1.68, sw = sin(iAnim.x) * iAnim.y;
      float ang = aPart.y > 4.5 ? 0.16 + sin(iAnim.x * 2.0) * 0.1 : leg ? (aPart.y < 1.5 ? sw : -sw) : iAnim.z > 1.5 ? -2.7 + sin(iAnim.x * 1.7 + aPart.y * 1.3) * 0.4 : mix((aPart.y < 3.5 ? -sw : sw) * 0.8, -1.35, iAnim.z);
      float cs = cos(ang), sn = sin(ang), dy = transformed.y - pivot, z0 = transformed.z; transformed.y = pivot + dy * cs - z0 * sn; transformed.z = dy * sn + z0 * cs; }`)
  .replace('#include <color_vertex>', '#include <color_vertex>\n  vColor.rgb = aPart.x < 0.5 ? iShirt : aPart.x < 1.5 ? iPants : aPart.x < 2.5 ? iSkin : aPart.x < 3.5 ? iHair : aPart.x < 4.5 ? vec3(0.015) : aCol;'); }

// ---------- a Grave Giant in a horde's look: the same parts and pivots as makeGiant (horde.js), so it walks, reaches,
// throws and falls the same way. One material of its own (so a hit can flash it); the eyes glow ----------
const gShadow = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), gShadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
export function hordeGiant(id, k = 0, { size: G_SIZE = 1.45, hip: G_HIP = 2.2 } = {}) { const L = hordeOf(id), g = L.gi, root = new THREE.Group(); root.rotation.order = 'YXZ'; const mats = {}, M = (c) => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
  const P = (par, geo, c, sx, sy, sz, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo.clone(), M(c)); m.scale.set(sx, sy, sz); /* (its own copy: dropGiant disposes them) */ m.position.set(x, y, z); m.rotation.set(rx, 0, rz); par.add(m); return m; };
  const grp = (par, x, y, z) => { const o = new THREE.Group(); o.position.set(x, y, z); par.add(o); return o; }, th = g.thin ? 0.45 : 1, dark = 0x15131a;
  const shirt = L.id === 'classic' ? [0x55607a, 0x6e5a44, 0x5e4e6c, 0x546e50][k % 4] : g.shirt;
  const body = grp(root, 0, 0, 0); body.scale.setScalar(G_SIZE); const hips = grp(body, 0, G_HIP, 0);
  const legs = [-1, 1].map((s) => { const Lg = grp(hips, s * 0.56, 0, 0); P(Lg, G.gCap, g.pants, 0.74 * th, 0.62, 0.74 * th, 0, -0.62, 0); P(Lg, G.gCap, g.sk2, 0.56 * th, 0.48, 0.56 * th, 0, -1.5, 0.03); if (g.boot != null) P(Lg, G.gBox, g.boot, 0.64 * (g.bootK || 1) * (g.thin ? 0.6 : 1), 0.32, 1.0 * (g.bootK || 1), 0, -2.04, 0.2); else if (g.head !== 'ghost') P(Lg, G.gBox, g.sk2, 0.5, 0.32, 0.85, 0, -2.04, 0.15); /* bare feet */ return Lg; });
  const torso = grp(hips, 0, 0, 0);
  if (g.ribs) { P(torso, G.gCap, g.sk, 1.8, 0.62, 1.25, 0, 1.6, 0); for (let i = 0; i < 4; i++) P(torso, G.gBox, dark, 1.5 - Math.abs(i - 1.5) * 0.2, 0.08, 0.2, 0, 1.22 + i * 0.25, 0.56); P(torso, G.gCap, g.sk2, 0.3, 0.45, 0.3, 0, 0.62, -0.1); P(torso, G.gBox, g.sk, 1.5, 0.32, 0.8, 0, 0.12, 0); P(torso, G.gBox, g.sk, 2.6, 0.18, 0.3, 0, 2.1, 0.05); }
  else { P(torso, G.gCap, shirt, 2.1, 0.76, 1.45, 0, 1.18, 0); P(torso, G.gBall, shirt, 2.35, 1.2, 1.5, 0, 1.95, -0.22); P(torso, G.gBox, g.pants, 2.02, 0.24, 1.36, 0, 0.34, 0);
    if (g.wound) { P(torso, G.gBall, g.sk, 1.05, 0.85, 0.42, 0.26, 0.86, 0.62); for (let i = 0; i < 3; i++) P(torso, G.gBall, g.wound, 0.32, 0.2, 0.08, -0.62 + i * 0.52, 1.2 + (i % 2) * 0.4, 0.72); } }
  const head = grp(torso, 0, 2.42, 0.56);
  if (g.head === 'skull') { P(head, G.gBall, g.sk, 1.12, 1.0, 1.12, 0, 0.36, 0.04); P(head, G.gBox, g.sk2, 0.62, 0.3, 0.5, 0, -0.12, 0.26); for (const s of [-1, 1]) P(head, G.gBall, dark, 0.34, 0.3, 0.14, s * 0.22, 0.4, 0.5); P(head, G.gBox, dark, 0.1, 0.14, 0.06, 0, 0.16, 0.57); }
  else if (g.head === 'pumpkin') { P(head, G.gBall, 0xff8a1a, 1.75, 1.4, 1.7, 0, 0.3, 0); P(head, G.gCap, 0x3a6a24, 0.2, 0.2, 0.2, 0, 1.08, 0); P(head, G.gBox, 0xffc040, 0.8, 0.16, 0.1, 0, -0.08, 0.8); }
  else if (g.head === 'wolf') { P(head, G.gBall, g.sk, 1.0, 0.94, 1.0, 0, 0.32, 0.04); P(head, G.gBox, g.sk, 0.42, 0.34, 0.6, 0, 0.14, 0.58); P(head, G.gBox, dark, 0.16, 0.12, 0.1, 0, 0.26, 0.88); for (const s of [-1, 1]) P(head, G.gCone, g.sk2, 0.28, 0.5, 0.2, s * 0.32, 0.9, -0.02, 0, s * -0.25); }
  else if (g.head === 'box') { P(head, G.gBox, g.sk, 1.0, 0.84, 0.9, 0, 0.32, 0.04); P(head, G.gBox, dark, 0.8, 0.2, 0.08, 0, 0.4, 0.47); P(head, G.gCap, dark, 0.06, 0.3, 0.06, 0.26, 1.0, 0); P(head, G.gBall, 0xff3a2a, 0.18, 0.18, 0.18, 0.26, 1.32, 0); }
  else if (g.head === 'ghost') { P(head, G.gBall, g.sk, 1.05, 1.0, 1.05, 0, 0.32, 0.04); P(head, G.gBall, dark, 0.26, 0.32, 0.1, 0, 0.02, 0.5); }
  else { P(head, G.gBall, g.sk, 1.02, 0.94, 1.02, 0, 0.32, 0.04); P(head, G.gBox, g.sk2, 0.9, 0.17, 0.3, 0, 0.56, 0.4); P(head, G.gBox, g.sk2, 0.68, 0.28, 0.52, 0, 0.0, 0.3); P(head, G.gBox, g.wound || dark, 0.48, 0.11, 0.14, 0, 0.12, 0.53);
    if (g.hair != null) P(head, G.gBall, g.hair, 1.06, 0.6, 1.06, 0, 0.62, -0.06); else if (!g.bald) for (let i = 0; i < 4; i++) P(head, G.gBox, 0x2a2e22, 0.17, 0.24, 0.17, -0.3 + i * 0.2, 0.8, -0.05 + (i % 2) * 0.16, (i - 1.5) * 0.3, (i - 1.5) * 0.25); }
  const arms = [-1, 1].map((s) => { const A = grp(torso, s * 1.16, 1.96, 0.1); P(A, G.gCap, g.ribs ? g.sk : shirt, 0.64 * th, 0.46, 0.64 * th, 0, -0.52, 0); P(A, G.gCap, g.sk, 0.52 * th, 0.76, 0.52 * th, 0, -1.34, 0); P(A, G.gCap, g.sk, 0.48 * th, 0.72, 0.48 * th, 0, -2.24, 0.04); P(A, G.gBall, g.sk2, 0.74 * (g.thin ? 0.7 : 1), 0.6, 0.64 * (g.thin ? 0.7 : 1), 0, -2.96, 0.08);
    for (let i = 0; i < 3; i++) P(A, G.gBox, g.sk2, 0.13, 0.42, 0.15, (i - 1) * 0.21, -3.3, 0.18, 0.3);
    const hand = new THREE.Object3D(); hand.position.set(0, -3.05, 0.12); A.add(hand); A.userData.hand = hand; A.rotation.z = s * 0.12; return A; });
  const parts = { root, body, hips, torso, head, legs, arms }; if (g.extra) g.extra(P, parts);
  mergeParts(root); const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); root.traverse((m) => { if (m.isMesh && m.material && m.material.vertexColors && !m.material.transparent) m.material = mat; });
  for (const s of [-1, 1]) for (const [r, f] of [[0.15, 1], [0.3, 0.45]]) { const e = new THREE.Mesh(G.gBall.clone(), new THREE.MeshBasicMaterial({ color: new THREE.Color(L.eye).multiplyScalar(f), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); e.scale.setScalar(r * 2); e.position.set(s * 0.22, 0.4 + (g.eyeY || 0), 0.47 + (g.eyeZ || 0)); e.renderOrder = 2; head.add(e); }
  const shadow = new THREE.Mesh(gShadow, gShadowMat); shadow.scale.setScalar(2.3); shadow.position.y = 0.06; shadow.renderOrder = 1;
  return { ...parts, mat, shadow }; }

// ---------- the shop picture: three of the horde and a glooper, shambling on the spot, turning slowly ----------
let pvMat = null; const pvMade = new Map();
export function hordePreview(id) { if (pvMade.has(hordeOf(id).id)) return pvMade.get(hordeOf(id).id); const L = hordeOf(id), grp = new THREE.Group(), geo = hordeFigure(L.id).clone(), A = {};
  for (const k of ['iShirt', 'iPants', 'iSkin', 'iHair', 'iAnim']) { A[k] = new THREE.InstancedBufferAttribute(new Float32Array(12), 3); geo.setAttribute(k, A[k]); }
  if (!pvMat) { pvMat = new THREE.MeshLambertMaterial({ vertexColors: true }); pvMat.onBeforeCompile = patchCrowdShader; }
  const mesh = new THREE.InstancedMesh(geo, pvMat, 4); mesh.frustumCulled = false;
  const glow = (geom, n) => { const m = new THREE.InstancedMesh(geom, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), n); m.frustumCulled = false; m.renderOrder = 2; return m; };
  const eyes = glow(new THREE.SphereGeometry(1, 6, 4), 8), sac = glow(new THREE.IcosahedronGeometry(1, 1), 1); grp.add(mesh, eyes, sac);
  const mob = [[-1.3, -0.35, 0], [-0.05, -1.0, 0], [0.15, 0.75, 0], [1.3, -0.1, 1]].map(([x, z, spit]) => ({ x, z, spit, cols: spit ? L.spit : L.cols(), ph: Math.random() * 6 }));
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), mm = new THREE.Matrix4(), m2 = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), lin = (hex) => tc.setHex(hex);
  grp.userData.tick = (dt, t) => { const yaw = 0.45 + Math.sin(t * 0.5) * 0.75, c = Math.cos(yaw), sn = Math.sin(yaw); let en = 0;
    mob.forEach((m, i) => { const sc = m.spit ? 1.11 : 1, x = m.x * c + m.z * sn, z = -m.x * sn + m.z * c, y = L.bob ? 0.12 + Math.sin(t * 2.4 + i) * 0.07 : 0; q.setFromAxisAngle(UP, yaw); mm.compose(v.set(x, y, z), q, s.setScalar(sc)); mesh.setMatrixAt(i, mm);
      ['iShirt', 'iPants', 'iSkin', 'iHair'].forEach((k, j) => { lin(m.cols[j]); A[k].setXYZ(i, tc.r, tc.g, tc.b); }); A.iAnim.setXYZ(i, m.ph + t * 4.2, 0.42, 1);
      const k = sc / 0.35; for (const g of L.glows) { v.set(g[0], g[1], g[2]).applyMatrix4(mm); eyes.setMatrixAt(en, m2.compose(v, q, s.set(g[3] * k, g[4] * k, g[5] * k))); eyes.setColorAt(en++, tc.setHex(L.eye)); }
      if (m.spit) { v.set(0, 1.25, -0.05).applyMatrix4(mm); sac.setMatrixAt(0, m2.compose(v, q, s.setScalar(0.17 * k * (1 + Math.sin(t * 5) * 0.15)))); sac.setColorAt(0, tc.setHex(L.gland).multiplyScalar(0.75)); } });
    mesh.instanceMatrix.needsUpdate = true; for (const a in A) A[a].needsUpdate = true; eyes.count = en; eyes.instanceMatrix.needsUpdate = true; eyes.instanceColor.needsUpdate = true; sac.instanceMatrix.needsUpdate = true; sac.instanceColor.needsUpdate = true; };
  grp.scale.setScalar(0.72); grp.userData.tick(0, 0); pvMade.set(L.id, grp); return grp; }
