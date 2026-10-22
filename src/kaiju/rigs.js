// Kaiju Madness: the monsters. Each one is a low-poly rig about 2 units tall at scale 1, facing +z, built from simple
// parts and animated by hand. Body types: biped lizards (with options: wings, horns, crystals, drill arms, a frill, a
// squat toad body, a metal finish), the knuckle-walking ape, four-legged beasts (spikes, a sail, a shell), a sideways-
// walking crab, an eight-legged spider, winged flyers (one head or three), moths, an oozing blob, a plant on writhing
// vines and a squid on tentacles. rig.anim(dt, move) runs the idle/walk/fly cycle (move 0..1); rig.act('hit' | 'cast' |
// 'ko') plays a one-shot over the top. rig.mouth / rig.hand / rig.chest are anchors for spells and throws.
import * as THREE from 'three';
import { HD } from './rigsHD.js';

const box = new THREE.BoxGeometry(1, 1, 1), cone = new THREE.ConeGeometry(0.5, 1, 4), cone8 = new THREE.ConeGeometry(0.5, 1, 8), ball = new THREE.IcosahedronGeometry(0.5, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8), oct = new THREE.OctahedronGeometry(0.5, 0);
const mats = new Map();
const mat = (c, basic = false) => { const k = c + (basic ? 'b' : ''); if (!mats.has(k)) mats.set(k, basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c, flatShading: true })); return mats.get(k); };
function part(parent, geo, c, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0, basic = false) { const m = new THREE.Mesh(geo, mat(c, basic)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; }
const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const S = (k, a) => Math.sin(k * Math.PI) * a; // a one-shot's swell

// pal: skin, dark, belly, accent (plates, crystals, sail...), eye
export const KAIJU = {
  godzilly: { name: "SCORCHBACK", kind: 'biped', pal: [0x3a6a5a, 0x1f3a32, 0x7aa08a, 0xff8a2a, 0xffe24a], opt: { plates: true, glow: true }, spells: ["Ember Belch","Furnace Breath","Spine Eruption"], speed: 1 },
  mike: { name: "MIKE FERGUSON THE BOUNTY HUNTER", kind: 'human', pal: [0x1e1f24, 0x2a2b30, 0xc98d68, 0xb3262a, 0x5a7a9a], spells: ["Taser Zap","Sledgehammer Slam","Warrant Served"], borrow: [["giggle",0],["konk",1],["konk",2]], speed: 1.15 },
  konk: { name: "GRUMBLEGORILLA", kind: 'ape', pal: [0x6a5a6a, 0x3a2e3a, 0xa08a90, 0x000000, 0x7af0ff], spells: ["Car Chuck","Belly Drum","Building Bowl"], speed: 1.12 },
  mofra: { name: "LANTERNWING", kind: 'moth', fly: true, pal: [0x5a8a7a, 0x2a6a8a, 0xd0f0e8, 0xff5a8a, 0xb8ff6a], spells: ["Gust Flap","Glitter Squall","Prism Ray"], speed: 1.2 },
  mecha: { name: "CLANKOSAUR", kind: 'biped', pal: [0xa87a3a, 0x5a3e1e, 0xd0a868, 0x7ac8a0, 0x6aff9a], opt: { plates: true, mech: true }, spells: ["Wrench Fists","Bolt Barrage","Frost Engine"], speed: 0.92 },
  rodanny: { name: "SKREECH", kind: 'ptero', fly: true, pal: [0x3a6a9a, 0x1a3456, 0x8ab8d8, 0xffd24a, 0xff8a2a], spells: ["Dive Peck","Shriek Boom","Cyclone Flap"], speed: 1.35 },
  giggle: { name: "TRIPLE TROUBLE", kind: 'ptero', fly: true, pal: [0x4a8a3a, 0x24481a, 0xb0d870, 0x9a5ad8, 0xffe24a], opt: { heads: 3 }, spells: ["Zip Zap","Three-Way Thunder","Head Count Storm"], speed: 1.05 },
  lobstirah: { name: "PINCHY McCLAW", kind: 'crab', pal: [0x2a8a8a, 0x154848, 0x8ad8c8, 0xffd0a0, 0x1a1a1a], spells: ["Pinch","Squirt Cannon","Hot Tub Tide"], speed: 1.05 },
  angryrus: { name: "GRUMPADILLO", kind: 'quad', pal: [0x8a5a3a, 0x4a2e1e, 0xc89a6a, 0xf0e0a0, 0x7aff3a], opt: { spikes: true, horn: true }, spells: ["Quill Spray","Cannonball Roll","Grump Quake"], speed: 1.1 },
  grammera: { name: "SHELLDON", kind: 'quad', pal: [0x5a4a8a, 0x2e2450, 0xc8b88a, 0xd88a3a, 0xffe24a], opt: { shell: true, tusks: true }, spells: ["Hot Spit","Spin Cycle","Rocket Shell"], speed: 0.95 },
  destroyah: { name: "RAZORWING", kind: 'biped', pal: [0x3a3a4a, 0x1a1a24, 0x6a6a7a, 0x7af0ff, 0x9dff3a], opt: {wings: 2775658,horn: 8057087}, spells: ["Fin Slice","Acid Ray","Minion Rush"], speed: 1.05 },
  biolettuce: { name: "SNAPDRAGON SUE", kind: 'plant', pal: [0x2f7a3a, 0x1f4a24, 0xc23b3b, 0xf0f0e0, 0x9ad83a], spells: ["Vine Lash","Sap Shower","Big Bloom Bite"], speed: 0.85 },
  spaceyzilla: { name: "CRYSTALLOX", kind: 'biped', pal: [0x6a2a4a, 0x3a1428, 0xa85a7a, 0x7af0ff, 0xffe24a], opt: { crystals: true, glow: true, hover: true }, spells: ["Shard Shot","Gem Garden","Star Spiral"], speed: 0.95 },
  megalawn: { name: "DRILLBERT", kind: 'biped', pal: [0x2a5a3a, 0x15301e, 0x6a9a6a, 0xff7a2a, 0xffd24a], opt: {drills: true,horn: 16742954,beetle: true}, spells: ["Drill Dash","Tunnel Ambush","Antenna Zap"], speed: 1.08 },
  smogorah: { name: "SMUDGE", kind: 'blob', pal: [0x3a4a44, 0x24302c, 0x5a6a5a, 0x8ac83a, 0xff3a2a], spells: ["Gunk Ball","Stink Cloud","Sludge Rain"], speed: 0.9 },
  varoom: { name: "FINNEGAN", kind: 'quad', pal: [0x8a6a2a, 0x5a3e14, 0xd8c08a, 0x3a8ad8, 0xffd24a], opt: { sail: true }, spells: ["Tail Thwack","Belly Flop","Fin Flash"], speed: 1.3 },
  gabbera: { name: "TOADSTORM", kind: 'biped', pal: [0x6a4a8a, 0x3a2650, 0xc8b0e0, 0x7aff3a, 0xffe24a], opt: { toad: true }, spells: ["Zap Croak","Hop Drop","Static Belly"], speed: 1.15 },
  kumbunga: { name: "NANA WEB", kind: 'spider', pal: [0x1e1a14, 0x0e0c0a, 0xe8b82a, 0xe8b82a, 0xff2a2a], spells: ["Web Glob","Web Blanket","Spiderling Party"], speed: 1.25 },
  jirassic: { name: "FRILLY", kind: 'biped', pal: [0x8a3a6a, 0x4a1e3a, 0xd890b8, 0x3ad8a8, 0xffe24a], opt: {frill: true,horn: 15786184}, spells: ["Frill Flash","Geyser Spit","Stampede"], speed: 1.12 },
  geezora: { name: "SQUIDNEY", kind: 'squid', pal: [0x3a8a6a, 0x1e4a38, 0x8ad8b0, 0xff8a3a, 0xff4a8a], spells: ["Ink Blot","Tentacle Tangle","Brain Freeze"], speed: 0.95 },
  grime: {name: "RIGBUSTER", kind: "robot", pal: [0x2a8a5a, 0x3a3a46, 0xd8b84a, 0xd8b84a, 0xff8a2a], opt: {stacks: true,fins: true,core: 16747050}, spells: ["Bolt Blaster","Bus Toss","Big Rig Barrage"], borrow: [["mecha",0],["konk",0],["mecha",1]], speed: 1.05},
  gundumb: {name: "PALADIN-7", kind: "robot", pal: [0x3a4a5a, 0x2a2a34, 0xd88a2a, 0x7af0ff, 0x7af0ff], opt: {horn: true,shield: 14191146,sword: true}, spells: ["Rail Rifle","Light Blade","Heavy Cannon"], borrow: [["mecha",0],["destroyah",0],["godzilly",1]], speed: 1.05},
  mazinger: {name: "HEAVY METAL HANK", kind: "robot", pal: [0x6a6a72, 0x3a3a42, 0xd84a2a, 0xffd24a, 0xffe24a], opt: {chunky: true,fins: true}, spells: ["Flying Fist","Chest Furnace","Lightning Rod"], borrow: [["mecha",0],["godzilly",1],["giggle",1]], speed: 1.05},
  evaoops: {name: "BEANPOLE BOT", kind: "robot", pal: [0xd8d0b8, 0x8a8070, 0xd84a6a, 0xd84a6a, 0xff3a8a], opt: {antenna: true,slim: true}, spells: ["Pocket Knife","Tantrum Stomp","Force Bubble"], borrow: [["destroyah",0],["angryrus",2],["spaceyzilla",2]], speed: 1.05},
  voltrawn: {name: "CRITTERBOT", kind: "robot", pal: [0x5a3a8a, 0x2a1e48, 0xd0d4dc, 0x3ad8a8, 0xffe24a], opt: {sword: true,horns: true}, spells: ["Paw Punch","Glow Sword","Combine Mode"], borrow: [["mecha",0],["destroyah",0],["spaceyzilla",1]], speed: 1.05},
  granddizer: {name: "UFO-BOT", kind: "robot", pal: [0x2a8a8a, 0x154848, 0xd0d4dc, 0xff7a2a, 0xffe24a], opt: {antenna: true,round: true}, spells: ["Saucer Blades","Abduction Zap","Flying Saucer Spin"], borrow: [["mecha",0],["rodanny",1],["godzilly",2]], speed: 1.05},
  gipsy: {name: "DOCKWORKER", kind: "robot", pal: [0x8a5a2a, 0x4a3018, 0xd8b84a, 0x2a2a34, 0x7af0ff], opt: {core: 8057087,chunky: true}, spells: ["Elbow Jet","Wrecking Chain","Arc Cannon"], borrow: [["mecha",0],["megalawn",0],["godzilly",2]], speed: 1.05},
  jetfizz: {name: "PROPELLERHEAD", kind: "robot", pal: [0xd8c84a, 0x8a7a2a, 0xf0f0f0, 0x3a8ad8, 0xff3a3a], opt: {jet: true,antenna: true}, spells: ["Nose Dive","Sonic Boom","Rocket Party"], borrow: [["rodanny",0],["rodanny",1],["mecha",1]], speed: 1.05},
  tetsujin: {name: "IRON GRANDPA", kind: "robot", pal: [0x7a6a5a, 0x4a3e34, 0xd8c8a8, 0x9a3a2a, 0xffe24a], opt: {round: true,chunky: true}, spells: ["Cane Bonk","Rocket Hop","Back In My Day"], borrow: [["konk",0],["varoom",1],["konk",1]], speed: 1.05},
  ironic: {name: "RUSTY", kind: "robot", pal: [0x8a5a3a, 0x5a3a24, 0xb08a6a, 0x4a3a2a, 0x7af0ff], opt: {tower: true,antenna: true}, spells: ["Scrap Snack","Eye Zap","Full Throttle"], borrow: [["konk",0],["godzilly",0],["godzilly",2]], speed: 1.05},
  dvah: {name: "BUBBLE BUGGY", kind: "robot", pal: [0x3ad8a8, 0x1a6a5a, 0xf0f0e0, 0xff7a2a, 0xffffff], opt: {pod: true}, spells: ["Twin Blasters","Mini Missiles","Boom Bubble"], borrow: [["gabbera",0],["mecha",1],["godzilly",2]], speed: 1.05},
  sentimental: {name: "SENTRY SAM", kind: "robot", pal: [0x3a5a8a, 0x8a3a2a, 0xd0d4dc, 0xffd24a, 0xff3a3a], opt: {chunky: true,antenna: true}, spells: ["Scan Beam","Grabber Arm","Freeze Ray"], borrow: [["godzilly",1],["geezora",1],["mecha",2]], speed: 1.05},
  soundwavy: {name: "BOOMBOX", kind: "robot", pal: [0x2a2a34, 0xd84a8a, 0xe8e8e8, 0xffd24a, 0x7aff3a], opt: {deck: true, fins: true}, spells: ["Bass Drop","Speaker Bird","Wall of Sound"], borrow: [["gabbera",0],["rodanny",0],["gabbera",2]], speed: 1.05},
  cherno: {name: "SMOKESTACK", kind: "robot", pal: [0x4a4a52, 0x2a2a30, 0x8a8a92, 0xd84a2a, 0xffd24a], opt: {tower: true, chunky: true}, spells: ["Coal Punch","Soot Cloud","Factory Stomp"], borrow: [["konk",0],["smogorah",1],["angryrus",2]], speed: 1.05},
  megatroll: {name: "CANNONBALL", kind: "robot", pal: [0x3a2a5a, 0x2a2a30, 0x9a9aa8, 0xd8b84a, 0xff3a3a], opt: {cannon: true, fins: true}, spells: ["Arm Cannon","Shell Barrage","Melt Ray"], borrow: [["godzilly",1],["mecha",1],["destroyah",1]], speed: 1.05},
  bumblebeep: {name: "HONKER", kind: "robot", pal: [0x3ad8d8, 0x1a6a6a, 0xff5a8a, 0xf0f0f0, 0xffe24a], opt: {fins: true,slim: true}, spells: ["Horn Blast","Car Toss","Radio Zap"], borrow: [["mecha",0],["konk",0],["giggle",0]], speed: 1.05},
  t800ish: {name: "CHROME DOME", kind: "robot", pal: [0xd0d4dc, 0x8a8e96, 0xe8e8f0, 0x3a8ad8, 0x3ad8ff], opt: {round: true,slim: true,core: 3856639}, spells: ["Laser Pointer","Drone Swarm","Reboot"], borrow: [["mecha",0],["mecha",1],["varoom",1]], speed: 1.05},
  getter: {name: "TRIPLE DECKER", kind: "robot", pal: [0xff7a2a, 0x8a3a14, 0xf0e0a0, 0x3a8a3a, 0xffe24a], opt: {getter: true, horns: true}, spells: ["Axe Throw","Stacked Beam","Spin Cycle"], borrow: [["destroyah",0],["godzilly",1],["rodanny",2]], speed: 1.05},
  ed2o9: {name: "TURRET TOM", kind: "robot", pal: [0x8a7a3a, 0x4a4220, 0xb8a868, 0x2a2e36, 0x7af0ff], opt: {ed: true}, spells: ["Chain Gun","Rocket Pods","Comply!"], borrow: [["mecha",0],["mecha",1],["angryrus",0]], speed: 1.05},
  mechax: {name: "CLANKOSAUR MK II", kind: "biped", pal: [0x5a7a8a, 0x2a3a46, 0xb0c8d0, 0xd84a2a, 0xff8a2a], opt: {plates: true, mech: true}, spells: ["Finger Rockets","Visor Beam","Deep Freeze"], borrow: [["mecha",0],["godzilly",1],["mecha",2]], speed: 1},
  gobblactus: { name: "THE SNACKER", kind: 'robot', pal: [0x3a8a5a, 0x5a2a6a, 0xd8d0b8, 0xff7a2a, 0xffe24a], opt: {round: true,chunky: true}, spells: ["Planet Nibble","Cosmic Burp","Second Helping"], borrow: [["godzilly",1],["gabbera",2],["spaceyzilla",2]], speed: 0.95 },
  giantish: { name: "STRETCHY STAN", kind: 'robot', pal: [0xff8a2a, 0x2a4a3a, 0xf0e0a0, 0x2a4a3a, 0x7af0ff], opt: {slim: true,antenna: true}, spells: ["Long Arm Slap","Bug Swarm","Growth Spurt"], borrow: [["angryrus",2],["kumbunga",2],["megalawn",2]], speed: 1.15 },
  bulk: { name: "MEATHEAD", kind: 'ape', opt: {pants: true}, pal: [0xc86a4a, 0x3a3a4a, 0xe8a888, 0x000000, 0xffe24a], spells: ["Knuckle Sandwich","Clap Back","Tower Toss"], borrow: [["konk",0],["gabbera",0],["konk",2]], speed: 1.2 },
  intern: { name: "COSMIC CLIPBOARD", kind: 'robot', pal: [0xd8d0b8, 0x3a3a46, 0x7a5ad8, 0x7a5ad8, 0x7af0ff], opt: {tower: true,slim: true}, spells: ["Stern Look","Paperwork Pile","Coffee Break Bang"], borrow: [["godzilly",0],["spaceyzilla",1],["godzilly",2]], speed: 0.9 },
  doomstay: { name: "BONEHEAD", kind: 'biped', pal: [0x8a6a4a, 0x4a3424, 0xd8c8a8, 0xf0e8d0, 0x7aff3a], opt: {plates: true,crystals: true,noTail: true}, spells: ["Knuckle Spikes","Charge!","Rubble Quake"], borrow: [["destroyah",0],["angryrus",1],["angryrus",2]], speed: 1.15 },
  darkside: { name: "GLOOMLORD", kind: 'robot', pal: [0x3a2a3a, 0x7a2a3a, 0x8a7a8a, 0x7a2a3a, 0x7aff3a], opt: {chunky: true,horns: true}, spells: ["Squinty Ray","Portal Hop","Gloom Storm"], borrow: [["destroyah",1],["grammera",2],["battra",2]], speed: 0.95 },
  groove: { name: "BARKLEY", kind: 'biped', pal: [0x7a5230, 0x4a2e18, 0x9a7048, 0x4aa83a, 0xffd24a], opt: {plates: true, noTail: true, tree: true}, spells: ["Branch Bonk","Root Snare","Leaf Storm"], borrow: [["biolettuce",0],["geezora",1],["biolettuce",2]], speed: 1 },
  slowbeard: { name: "OLD OAKUM", kind: 'ape', opt: {bark: true}, pal: [0x5a4a3a, 0x2e2418, 0x8a7a5a, 0x000000, 0xffd24a], spells: ["Slow Swing","Root Rumble","Dam Burst"], borrow: [["konk",0],["angryrus",2],["lobstirah",2]], speed: 0.8 },
  decaf: { name: "GRANDPA STUMP", kind: 'plant', pal: [0x6a4a2a, 0x3a5a1a, 0xe8d8a0, 0x7ac83a, 0xffe24a], spells: ["Sleepy Seeds","Sap Nap","Big Yawn"], borrow: [["biolettuce",1],["smogorah",1],["biolettuce",2]], speed: 0.75 },
  munchy: { name: "CHOMPERNICKEL", kind: 'plant', pal: [0x3a8a2a, 0x1f4a14, 0xd82a3a, 0xf0e070, 0xff3a5a], spells: ["Chomp","Drool Spray","Lunch Rush"], borrow: [["biolettuce",0],["biolettuce",1],["kumbunga",2]], speed: 0.9 },
  walkwoods: { name: "THE GROVE", kind: 'quad', pal: [0x4a6a2a, 0x3a2a16, 0x6a8a3a, 0x2f7a2a, 0xffd24a], opt: {spikes: true,sail: true}, spells: ["Pinecone Volley","Timber!","Forest Stampede"], borrow: [["angryrus",0],["varoom",1],["jirassic",2]], speed: 1 },
  battra: { name: "GLOOMWING", kind: 'moth', fly: true, pal: [0x3a1a1a, 0x6a1a2a, 0x140808, 0x7af0ff, 0x7af0ff], opt: {horn: true}, spells: ["Horn Ram","Twin Eye Beams","Blackout"], speed: 1.25 },
};
export const KAIJU_IDS = Object.keys(KAIJU);
// monsters you have from the start, no prize game needed
export const FREE_KAIJU = ['godzilly', 'mike'];

// Two skins for every monster. SKELETON: black, with bone-white plates and bones and red eyes. HALLOWEEN: the same black, but
// the bone parts glow bright orange, and the head becomes a flaming jack-o'-lantern; a monster with no head of its own
// (a squid, a blob, a plant, a crab, a spider, a flyer's necks, a gun-walker or a pod) wears a witch's hat instead, with
// little bats circling it.
const LOOKS = {
  skeleton: { name: 'Skeleton', spell: 0xff2a2a, pal: [0x1c1a20, 0xece6d2, 0xf2ecd8, 0xece6d2, 0xff2a2a] },
  halloween: { name: 'Halloween', spell: 0xff7a1a, pal: [0x1c1a20, 0xff7a1a, 0xff9a2a, 0xff7a1a, 0xffe24a], glow: [0xff7a1a, 0xff9a2a], pumpkin: true },
};
export const SKIN_LOOKS = ['skeleton', 'halloween'];
const niceName = (n) => n.toLowerCase().replace(/(^|[ -])([a-z])/g, (m, s, ch) => s + ch.toUpperCase());
export const KAIJU_SKINS = {}; for (const id of KAIJU_IDS) KAIJU_SKINS[id] = Object.fromEntries(SKIN_LOOKS.map((lk) => [lk, { look: lk, ...LOOKS[lk], name: LOOKS[lk].name + ' ' + niceName(KAIJU[id].name) }]));
const NO_HEAD = new Set(['squid', 'blob', 'plant', 'crab', 'spider', 'ptero']);
const glowMats = new Map(); const glowOf = (c) => { if (!glowMats.has(c)) glowMats.set(c, new THREE.MeshBasicMaterial({ color: c })); return glowMats.get(c); };
// a jack-o'-lantern where the head was (size: the head's size), with flames licking up out of it
function pumpkinHead(head, fx, size) {
  const p = grp(head, 0, 0.02, 0.04); p.scale.setScalar(size / 0.6); const pm = (col) => new THREE.MeshLambertMaterial({ color: col, emissive: 0x7a2a00 }); part(p, ball, 0xff7a1a, 0.62, 0.52, 0.58, 0, 0, 0).material = pm(0xff8a1a); part(p, ball, 0xe8661a, 0.5, 0.56, 0.62, 0, 0, 0).material = pm(0xf0701a); part(p, cyl, 0x2a6a1a, 0.07, 0.16, 0.07, 0, 0.32, 0);
  for (const x of [-0.12, 0.12]) part(p, cone, 0xffe24a, 0.1, 0.1, 0.04, x, 0.06, 0.29, 0, 0, Math.PI, true);
  part(p, box, 0xffe24a, 0.24, 0.05, 0.04, 0, -0.1, 0.29, 0, 0, 0, true); for (const x of [-0.06, 0.06]) part(p, box, 0xff7a1a, 0.04, 0.03, 0.05, x, -0.08, 0.3, 0, 0, 0, true);
  const fl = [0xff5a1a, 0xffb02a, 0xffe24a].map((c, i) => part(p, cone8, c, 0.22 - i * 0.05, 0.4, 0.22 - i * 0.05, (i - 1) * 0.1, 0.42, 0, 0, 0, 0, true));
  fx.push((t) => fl.forEach((f, i) => { f.scale.y = 0.3 + 0.12 * Math.sin(t * 13 + i * 2); f.position.y = 0.38 + 0.04 * Math.sin(t * 9 + i); }));
}
const smoothBall = new THREE.SphereGeometry(0.5, 18, 12), smoothMats = new Map(); const smoothMat = (col) => { if (!smoothMats.has(col)) smoothMats.set(col, new THREE.MeshLambertMaterial({ color: col })); return smoothMats.get(col); };
// a flaming skull where the head was (Mike's skeleton skin): bone cranium, deep sockets with red embers, teeth, fire on top
function flamingSkull(head, fx, size) {
  const p = grp(head, 0, 0.02, 0.02); p.scale.setScalar(size / 0.6); const bone = 0xece6d2, hole = 0x120a0a;
  part(p, ball, bone, 0.56, 0.52, 0.58, 0, 0.06, 0); part(p, ball, bone, 0.4, 0.3, 0.36, 0, -0.14, 0.08); // cranium, cheekbones
  for (const x of [-0.13, 0.13]) { part(p, ball, hole, 0.17, 0.15, 0.08, x, 0.0, 0.24); part(p, ball, 0xff2a1a, 0.06, 0.06, 0.04, x, 0.0, 0.28, 0, 0, 0, true); part(p, ball, bone, 0.08, 0.08, 0.12, x * 2.1, -0.06, 0.1); }
  part(p, cone, hole, 0.07, 0.1, 0.04, 0, -0.1, 0.29, 0, 0, Math.PI); // nose hole
  const jaw = grp(p, 0, -0.24, 0.06); part(jaw, ball, bone, 0.32, 0.12, 0.3, 0, -0.02, 0.04); for (let i = 0; i < 6; i++) { part(p, box, 0xfaf6e8, 0.035, 0.06, 0.03, -0.09 + i * 0.036, -0.2, 0.25); part(jaw, box, 0xfaf6e8, 0.035, 0.05, 0.03, -0.09 + i * 0.036, 0.04, 0.17); }
  const fl = [0xff3a1a, 0xff8a1a, 0xffd23a, 0xfff2a0].map((c, i) => part(p, cone8, c, 0.66 - i * 0.12, 0.6, 0.64 - i * 0.12, Math.sin(i * 2) * 0.04, 0.36, -0.04 - i * 0.02, -0.15, 0, 0, true));
  const tongues = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return part(p, cone8, i % 2 ? 0xffb02a : 0xff5a1a, 0.16, 0.4, 0.16, Math.cos(a) * 0.22, 0.34, Math.sin(a) * 0.2 - 0.03, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, true); });
  // smooth, not faceted, bone (the shared blocky parts are flat-shaded)
  p.traverse((m) => { if (m.isMesh && m.geometry === ball) { m.geometry = smoothBall; if (!m.material.isMeshBasicMaterial) m.material = smoothMat(m.material.color.getHex()); } });
  fx.push((t) => { fl.forEach((f, i) => { f.scale.y = 0.7 + 0.2 * Math.sin(t * 12 + i * 1.7); f.position.y = 0.42 + 0.05 * Math.sin(t * 8 + i); }); tongues.forEach((f, i) => { f.scale.y = 0.32 + 0.14 * Math.sin(t * 15 + i * 2.3); }); jaw.rotation.x = Math.max(0, Math.sin(t * 2.2)) * 0.15; });
}
// a pointy witch's hat with an orange band, and a few little bats flapping round it
function witchHat(parent, at, fx, size) {
  const h = grp(parent, at.x, at.y, at.z); h.scale.setScalar(size); h.rotation.z = 0.15;
  part(h, cyl, 0x14101a, 0.95, 0.05, 0.95, 0, 0, 0); part(h, cone8, 0x14101a, 0.55, 0.85, 0.55, 0, 0.44, 0); part(h, cyl, 0xff7a1a, 0.58, 0.1, 0.58, 0, 0.08, 0, 0, 0, 0, true);
  const tip = grp(h, 0, 0.82, 0); part(tip, cone8, 0x14101a, 0.2, 0.3, 0.2, 0.08, 0.08, 0, 0, 0, -0.6);
  const bats = []; for (let i = 0; i < 4; i++) { const b = grp(h); part(b, box, 0x0c0810, 0.08, 0.06, 0.1, 0, 0, 0, 0, 0, 0, true); const w = [-1, 1].map((s) => { const wg = grp(b, s * 0.04, 0, 0); part(wg, box, 0x2a1a30, 0.16, 0.02, 0.08, s * 0.08, 0, 0, 0, 0, 0, true); return wg; }); bats.push({ b, w, a: i / 4 * Math.PI * 2 }); }
  fx.push((t) => { for (const B of bats) { const a = B.a + t * 1.8; B.b.position.set(Math.cos(a) * 0.75, 0.55 + Math.sin(t * 3 + B.a) * 0.15, Math.sin(a) * 0.75); B.b.rotation.y = -a; const f = Math.sin(t * 22 + B.a) * 0.8; B.w[0].rotation.z = f; B.w[1].rotation.z = -f; } tip.rotation.z = Math.sin(t * 2) * 0.1; });
}

// skin: false, true (the skeleton), a look ('skeleton' | 'halloween') or a shop id ('kaiju:<id>:<look>').
// lowDetail: build the old blocky rig (comparisons, very slow devices)
export function buildKaiju(id, skin = false, lowDetail = false) {
  const look = skin === true ? 'skeleton' : typeof skin === 'string' ? skin.split(':').pop() : null;
  const costume = id === 'mike' && look === 'halloween', sk0 = look && KAIJU_SKINS[id] && KAIJU_SKINS[id][look] ? KAIJU_SKINS[id][look] : null;
  const sk = costume ? { ...sk0, spell: 0xff4fb0, glow: null, pumpkin: false, pal: KAIJU[id].pal } : sk0; const K = sk ? { ...KAIJU[id], pal: sk.pal, opt: costume ? { ...(KAIJU[id].opt || {}), tutu: true } : KAIJU[id].opt } : KAIJU[id]; const g = new THREE.Group(); const body = grp(g, 0, 0, 0); const fx = [];
  const rig = (!lowDetail && HD[K.kind] ? HD[K.kind] : ({ biped, ape, moth, ptero, quad, crab, spider, blob, plant, squid, robot, human: ape })[K.kind])(body, K);
  if (sk && sk.glow) g.traverse((m) => { if (m.isMesh && m.material && m.material.color && sk.glow.includes(m.material.color.getHex()) && !m.material.isMeshBasicMaterial) m.material = glowOf(m.material.color.getHex()); });
  if (look === 'skeleton' && K.kind === 'human' && rig.mouth && rig.mouth.parent) { g.updateMatrixWorld(true); const head = rig.mouth.parent; const sz = new THREE.Box3().setFromObject(head).getSize(new THREE.Vector3()); head.traverse((m) => { if (m.isMesh) m.visible = false; }); flamingSkull(head, fx, Math.min(0.7, Math.max(0.42, Math.max(sz.x, sz.z) * 1.05))); }
  if (sk && sk.pumpkin) { g.updateMatrixWorld(true); const head = rig.mouth && rig.mouth.parent, o = K.opt || {};
    if (head && head !== body && !NO_HEAD.has(K.kind) && !o.ed && !o.pod) { const sz = new THREE.Box3().setFromObject(head).getSize(new THREE.Vector3()); head.traverse((m) => { if (m.isMesh) m.visible = false; }); pumpkinHead(head, fx, Math.min(0.7, Math.max(0.42, Math.max(sz.x, sz.z) * 1.05))); }
    else { const bb = new THREE.Box3().setFromObject(g), top = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y - 0.05, (bb.min.z + bb.max.z) / 2), par = rig.chest ? rig.chest.parent : body; witchHat(par, par.worldToLocal(top), fx, Math.min(0.9, (bb.max.x - bb.min.x) * 0.32)); } }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; g.add(shadow);
  let t = Math.random() * 10, actK = null, actT = 0;
  return { id, def: K, g, body, shadow, fly: !!K.fly, tint: sk ? sk.spell : K.borrow ? K.pal[4] : null, mouth: rig.mouth, hand: rig.hand, chest: rig.chest, hammer: rig.hammer,
    act(k) { actK = k; actT = 0; }, get acting() { return actK; },
    anim(dt, move) { t += dt; if (actK) { actT += dt * ((rig.actSpeed && rig.actSpeed[actK]) || (actK === 'ko' ? 0.8 : actK === 'win' ? 0.7 : 2.4)); if (actT >= 1 && actK !== 'ko') actK = null; } rig.anim(t, dt, move, actK, Math.min(1, actT)); for (const f of fx) f(t); shadow.scale.setScalar(rig.shadowK || 1); },
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
  const tail = []; if (!toad && !o.noTail) { let prev = grp(hip, 0, 0.05, -0.32); for (let i = 0; i < 5; i++) { const s = 1 - i * 0.16; part(prev, box, skin, 0.42 * s, 0.38 * s, 0.46, 0, 0, -0.2, -0.1); tail.push(prev); prev = grp(prev, 0, -0.02, -0.4); } }
  const glowMat = o.glow ? new THREE.MeshBasicMaterial({ color: acc }) : mat(acc); const glow0 = new THREE.Color(acc);
  if (o.plates) { for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(cone, glowMat); sp.scale.set(0.22, 0.42 - i * 0.03, 0.32); sp.position.set(0, 0.95 - i * 0.18, -0.36 + i * 0.02); sp.rotation.x = -0.6; torso.add(sp); } for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(cone, glowMat); sp.scale.set(0.16, 0.3 - i * 0.05, 0.22); sp.position.set(0, 0.2 * (1 - i * 0.16), -0.2); sp.rotation.x = -0.9; if (tail[i]) tail[i].add(sp); } }
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
// ---------- giant robots: upright and blocky, built from a kit (crests, shoulder pads, swords, shields, cannons, wings);
// opt.ed is a headless two-gun walker, opt.pod a round pilot pod on legs ----------
function robot(body, K) {
  const [main, legC, trim, acc, eyeC] = K.pal, o = K.opt || {}, ed = o.ed, pod = o.pod, wide = o.chunky ? 1.15 : o.slim ? 0.8 : 1;
  const hip = grp(body, 0, 1.0, 0); const torso = grp(hip, 0, 0.1, 0);
  part(torso, box, legC, 0.55 * wide, 0.3, 0.4, 0, 0.1, 0);
  const chest = grp(torso, 0, 0.62, 0);
  if (ed) { part(chest, box, main, 1.3, 0.6, 1.0, 0, 0.05, 0); part(chest, box, trim, 0.6, 0.2, 0.2, 0, 0, 0.52); part(chest, box, eyeC, 0.44, 0.06, 0.04, 0, 0.16, 0.6, 0, 0, 0, true); }
  else if (pod) { part(chest, ball, main, 1.4, 1.0, 1.3, 0, 0.15, 0); part(chest, box, trim, 0.6, 0.35, 0.1, 0, 0.2, 0.62); for (const s of [-1, 1]) part(chest, box, acc, 0.1, 0.4, 0.5, s * 0.66, 0.4, -0.1); }
  else { part(chest, box, main, 0.95 * wide, 0.62, 0.55, 0, 0, 0); part(chest, box, trim, 0.62 * wide, 0.26, 0.06, 0, 0.05, 0.29);
    if (o.chestV) for (const s of [-1, 1]) part(chest, box, acc, 0.42, 0.12, 0.08, s * 0.18, 0.2, 0.3, 0, 0, s * 0.5);
    if (o.windows) for (const s of [-1, 1]) part(chest, box, 0x9ad8ff, 0.32, 0.24, 0.04, s * 0.22, 0.12, 0.31);
    if (o.deck) { part(chest, box, 0x2a2a3a, 0.5, 0.3, 0.04, 0, 0.08, 0.32); part(chest, box, acc, 0.12, 0.08, 0.05, 0, 0.08, 0.34, 0, 0, 0, true); }
    if (o.core) part(chest, cyl, o.core, 0.26, 0.06, 0.26, 0, 0.1, 0.3, Math.PI / 2, 0, 0, true); }
  const neck = grp(torso, 0, 1.0, 0.02), head = grp(neck, 0, 0.12, 0);
  if (!ed && !pod) {
    if (o.tower) part(head, cyl, main, 0.38, 0.42, 0.38, 0, 0.1, 0); else if (o.round) part(head, ball, main, 0.4, 0.36, 0.4, 0, 0.08, 0); else part(head, box, main, 0.32, 0.3, 0.32, 0, 0.06, 0);
    part(head, box, trim, 0.22, 0.12, 0.06, 0, 0, 0.18); for (const x of [-0.07, 0.07]) part(head, box, eyeC, 0.08, 0.04, 0.04, x, 0.1, 0.18, 0, 0, 0, true);
    if (o.v) for (const s of [-1, 1]) part(head, cone, 0xffd24a, 0.05, 0.32, 0.05, s * 0.1, 0.28, 0.12, 0, 0, -s * 0.7);
    if (o.horns) for (const s of [-1, 1]) part(head, cone8, acc, 0.07, 0.32, 0.07, s * 0.17, 0.25, 0, 0, 0, -s * 0.5);
    if (o.horn) part(head, cone8, acc, 0.07, 0.42, 0.07, 0, 0.3, 0.1, -0.5);
    if (o.fins) for (const s of [-1, 1]) part(head, box, acc, 0.04, 0.22, 0.18, s * 0.18, 0.12, 0);
    if (o.antenna) part(head, cyl, legC, 0.03, 0.3, 0.03, 0, 0.36, 0); }
  const mouth = ed || pod ? grp(chest, 0, 0.1, 0.65) : grp(head, 0, 0, 0.25);
  if (!ed && !pod) for (const s of [-1, 1]) part(torso, box, acc, 0.36 * wide, 0.28, 0.44, s * 0.62 * wide, 0.92, 0);
  if (o.stacks) for (const s of [-1, 1]) part(torso, cyl, 0xc0c8d0, 0.08, 0.5, 0.08, s * 0.42, 1.2, -0.18);
  if (o.jet) for (const s of [-1, 1]) part(torso, box, main, 0.95, 0.05, 0.5, s * 0.8, 1.0, -0.35, 0, 0, s * 0.45);
  if (o.getter) for (const s of [-1, 1]) part(torso, cone, acc, 0.22, 1.2, 0.5, s * 0.6, 1.45, -0.3, 0, 0, -s * 0.6);
  const ax = ed || pod ? 0.78 : 0.62 * wide;
  const arms = [-1, 1].map((s) => { const a = grp(torso, s * ax, ed || pod ? 0.62 : 0.82, 0);
    if (ed || pod) { part(a, box, main, 0.3, 0.32, 0.5, 0, 0, 0.1); part(a, cyl, legC, 0.13, 0.7, 0.13, 0, 0, 0.6, Math.PI / 2); return { a, f: a }; }
    part(a, box, main, 0.24 * wide, 0.42, 0.26, 0, -0.2, 0); const f = grp(a, 0, -0.42, 0); part(f, box, o.multi ? (s < 0 ? 0x2a9a3a : 0xd82a2a) : main, 0.3 * wide, 0.42, 0.32, 0, -0.2, 0); part(f, box, legC, 0.22, 0.2, 0.24, 0, -0.48, 0); return { a, f }; });
  const hand = grp(arms[1].f, 0, -0.5, 0.1);
  if (o.sword) part(arms[1].f, box, 0xd8dce4, 0.08, 0.18, 1.5, 0, -0.5, 0.75);
  if (o.shield) part(arms[0].f, box, o.shield, 0.08, 0.8, 0.5, -0.2, -0.2, 0.05);
  if (o.cannon) part(arms[1].f, cyl, legC, 0.2, 0.6, 0.2, 0.12, -0.3, 0.1);
  const legs = [-1, 1].map((s) => { const l = grp(hip, s * (ed ? 0.48 : 0.26 * wide), 0, 0), lc = o.multi ? (s < 0 ? 0x2a4ac8 : 0xffd24a) : legC;
    part(l, box, lc, 0.32 * wide, 0.5, 0.36, 0, -0.25, 0); const k = grp(l, 0, -0.5, 0); part(k, box, lc, 0.36 * wide, 0.42, 0.4, 0, -0.2, 0); part(k, box, 0x2a2a30, 0.4 * wide, 0.12, 0.56, 0, -0.44, 0.06); return { l, k }; });
  return { mouth, hand, chest,
    anim(t, dt, move, act, k) {
      const w = t * (5 + move * 2), sw = Math.sin(w) * 0.5 * move;
      legs[0].l.rotation.x = sw; legs[1].l.rotation.x = -sw; legs[0].k.rotation.x = Math.max(0, -Math.sin(w)) * 0.6 * move; legs[1].k.rotation.x = Math.max(0, Math.sin(w)) * 0.6 * move;
      hip.position.y = 1.0 + Math.abs(Math.sin(w)) * 0.05 * move; torso.rotation.y = Math.sin(w) * 0.08 * move; neck.rotation.x = 0;
      arms[0].a.rotation.x = -sw * 0.5; arms[1].a.rotation.x = sw * 0.5;
      if (act === 'hit') { const s = S(k, 1); arms[1].a.rotation.x = -1.6 * s; torso.rotation.y = -0.4 * s; }
      else if (act === 'cast') { const s = S(k, 1); arms[0].a.rotation.x = arms[1].a.rotation.x = -1.4 * s; neck.rotation.x = -0.3 * s; }
      else if (act === 'ko') koTip(body, k);
    } };
}

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
