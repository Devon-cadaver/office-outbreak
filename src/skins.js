// Skins bought with the coins you earn for beating a game. Character skins change the outfit colours and add
// accessories; car skins recolour and dress the player's car and the parked cars and vans.
import * as THREE from 'three';
import { getEra } from './era.js';
import { CHAR_SKINS2, CAR_SKINS2, FX_SKINS } from './skins2.js';
import { TWISTER_SKINS } from './tornado.js';
import { KAIJU, KAIJU_SKINS } from './kaiju/rigs.js';
export { TWISTER_SKINS };

const K = { coins: 'oo_coins', owned: 'oo_skins_owned', equip: 'oo_skins_equip' };
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
export function getCoins() { return +get(K.coins, 0) || 0; }
export function getEarned() { const e = get('oo_coins_earned', null); return e == null ? getCoins() : +e || 0; }
export function addCoins(n) { if (n > 0) set('oo_coins_earned', Math.round((getEarned() + n) * 100) / 100); set(K.coins, Math.round((getCoins() + n) * 100) / 100); return getCoins(); } // coins can be fractional (chests pay 0.01s)
export function fmtCoins(c = getCoins()) { const v = Math.round(c * 100) / 100; return v + (v === 1 ? ' coin' : ' coins'); }
// skins bought before there were two per monster ('kaiju:<id>') become that monster's skeleton skin
{ try { const own = JSON.parse(localStorage.getItem('oo_skins_owned') || '[]'); const fix = (x) => (typeof x === 'string' && /^kaiju:[a-z0-9]+$/.test(x) ? x + ':skeleton' : x); if (own.some((x) => fix(x) !== x)) localStorage.setItem('oo_skins_owned', JSON.stringify(own.map(fix)));
  const eq = JSON.parse(localStorage.getItem('oo_skins_equip') || '{}'); let ch = false; for (const k in eq) if (fix(eq[k]) !== eq[k]) { eq[k] = fix(eq[k]); ch = true; } if (ch) localStorage.setItem('oo_skins_equip', JSON.stringify(eq)); } catch { /* ignore */ } }
// put on a skin you just won (the slot comes from its id: tornado:<k>, kaiju:<id>:<look>, or the shop's own category)
export function equipWon(id) { const s = SKINS.find((x) => x.id === id); const slot = id.startsWith('kaiju:') ? 'kj_' + id.split(':')[1] : s ? s.cat : null; if (slot && slot !== 'npc') equip(slot, id); }
// the pause menu's CHOOSE SKIN button: opens its own little menu listing Default plus the skins you own for that slot;
// tapping one puts it on and onPick swaps it in live (onPick returns false to refuse, e.g. mid-Nukular)
export function pauseSkinRow(host, icon, slot, opts, onPick) { let b = host.querySelector('.psBtn'); if (!b) { b = document.createElement('button'); b.className = 'ghost psBtn'; host.insertBefore(b, host.querySelector('.soundRow')); }
  const owned = getOwned(), list = [[null, 'Default'], ...opts.filter(([id]) => owned.includes(id))], nameNow = () => (list.find(([id]) => id === (getEquipped()[slot] || null)) || list[0])[1];
  b.textContent = icon + ' CHOOSE SKIN (' + nameNow() + ')';
  b.onclick = (e) => { e.stopPropagation(); const m = document.createElement('div'); m.className = 'psMenu'; const box = document.createElement('div'); box.className = 'psBox'; m.appendChild(box);
    box.innerHTML = '<h2>' + icon + ' CHOOSE SKIN</h2>' + (list.length < 2 ? '<p class="psHint">No skins yet. Win them in TOTAL DESTRUCTION and prize games, or buy them in the skin shop.</p>' : '');
    const cur = getEquipped()[slot] || null; for (const [id, name] of list) { const o = document.createElement('button'); o.className = 'ghost psOpt' + (id === cur ? ' on' : ''); o.textContent = (id === cur ? '✓ ' : '') + name;
      o.onclick = (ev) => { ev.stopPropagation(); equip(slot, id); if (onPick(id) === false) equip(slot, cur); m.remove(); pauseSkinRow(host, icon, slot, opts, onPick); }; box.appendChild(o); }
    const back = document.createElement('button'); back.className = 'psBack'; back.textContent = 'BACK'; back.onclick = (ev) => { ev.stopPropagation(); m.remove(); }; box.appendChild(back);
    m.addEventListener('pointerdown', (ev) => ev.stopPropagation()); document.body.appendChild(m); };
}
export function totalReward(ids, nameOf, host) { const pool = ids.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const id = pool.find((x) => grantSkin(x)); if (id) equipWon(id); else addCoins(5); const u = document.createElement('div'); u.className = 'bonusSkin';
  u.innerHTML = id ? '💥 TOTAL DESTRUCTION REWARD: <b>' + nameOf(id).toUpperCase() + '</b><br><small>A free skin, and it\'s on for your next round. Switch skins from the pause menu.</small>' : '💥 TOTAL DESTRUCTION REWARD: <b>+5 🪙</b><br><small>You already own every skin, so have some coins.</small>'; host.appendChild(u); return id; }
export function grantSkin(id) { const owned = getOwned(); if (owned.includes(id)) return false; owned.push(id); set(K.owned, owned); return true; }
// skins everyone has from the start
const FREE_SKINS = Object.entries(TWISTER_SKINS).filter(([, s]) => s.free).map(([k]) => 'tornado:' + k);
export function getOwned() { const o = get(K.owned, []); return [...o, ...FREE_SKINS.filter((x) => !o.includes(x))]; }
export function getEquipped() { const e = { player: null, npc: [], car: null, fx: null, tornado: null, ...get(K.equip, {}) }; if (typeof e.npc === 'string') e.npc = [e.npc]; if (!Array.isArray(e.npc)) e.npc = []; return e; }
export const NPC_MAX = 10;
export function equip(cat, id) { const e = getEquipped(); if (cat === 'npc') { if (id == null) e.npc = []; else if (e.npc.includes(id)) e.npc = e.npc.filter((x) => x !== id); else if (e.npc.length < NPC_MAX) e.npc.push(id); } else e[cat] = id; set(K.equip, e); }
export function isEquipped(cat, id) { const e = getEquipped(); return cat === 'npc' ? e.npc.includes(id) : e[cat] === id; }
export function buy(id) { const s = SKINS.find((x) => x.id === id); if (!s) return false; const owned = getOwned(); if (owned.includes(id)) return true; if (s.bonus) return false; if (getCoins() < s.price) return false; addCoins(-s.price); owned.push(id); set(K.owned, owned); return true; }

const box = new THREE.BoxGeometry(1, 1, 1), cone = new THREE.ConeGeometry(0.5, 1, 10), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), sphere = new THREE.SphereGeometry(0.5, 12, 8), ring = new THREE.TorusGeometry(0.5, 0.08, 6, 14);

// character skins: outfit colours plus a dress(parts) hook. parts = { g, body, head, armL, armR, legL, legR, part(geo, color, sx, sy, sz, x, y, z) }
export const CHAR_SKINS = {
  // the era outfits: townsfolk wear them in the Wild West and the Future, and you can buy them to use anywhere
  cowpoke: { name: 'Cowpoke', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xf0c9a6, hair: 0x5a3a24, shirt: 0xb84a3a, pants: 0x3a4a6a, tie: null },
    dress: ({ head, body, part }) => { head.add(part(cyl, 0x7a5232, 0.98, 0.05, 0.98, 0, 0.6, 0)); head.add(part(cyl, 0x7a5232, 0.52, 0.34, 0.52, 0, 0.78, 0)); head.add(part(cyl, 0x2a1a10, 0.54, 0.06, 0.54, 0, 0.66, 0));
      const band = part(cone, 0xc62828, 0.36, 0.26, 0.2, 0, 0.06, 0.24); band.rotation.x = Math.PI; head.add(band); /* bandana */ for (const s of [-1, 1]) body.add(part(box, 0x5a3a24, 0.22, 0.48, 0.66, s * 0.25, 1.27, 0)); body.add(part(box, 0xd8b04a, 0.1, 0.1, 0.04, -0.24, 1.38, 0.34)); } },
  neon: { name: 'Neon Citizen', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xf0c9a6, hair: 0xe8eef4, shirt: 0x1c2030, pants: 0x2a3044, tie: null },
    dress: ({ head, body, armL, armR, part }) => { const glow = (m, c) => { m.material = new THREE.MeshBasicMaterial({ color: c }); return m; };
      const halo = glow(part(ring, 0x3af0ff, 0.62, 0.62, 0.62, 0, 0.86, 0), 0x3af0ff); halo.rotation.x = Math.PI / 2; head.add(halo); head.add(glow(part(box, 0x3af0ff, 0.5, 0.09, 0.1, 0, 0.36, 0.3), 0x3af0ff)); // halo ring hat, visor
      for (const a of [armL, armR]) { const cuff = glow(part(ring, 0xff4fd8, 0.32, 0.32, 0.5, 0, -0.95, 0), 0xff4fd8); cuff.rotation.x = Math.PI / 2; a.add(cuff); } // glowing cuffs
      body.add(glow(part(box, 0x3af0ff, 0.72, 0.05, 0.64, 0, 1.02, 0), 0x3af0ff)); } }, // light-strip belt
  witch: { name: 'Witch', price: 1, cats: ['player', 'npc'], outfit: { skin: 0x9fe08a, hair: 0x2a1a3a, shirt: 0x1a1024, pants: 0x1a1024, tie: null },
    dress: ({ head, armL, part }) => { head.add(part(cyl, 0x1a1024, 0.95, 0.06, 0.95, 0, 0.62, 0)); head.add(part(cone, 0x3a1a5a, 0.55, 0.75, 0.55, 0, 0.98, 0)); head.add(part(box, 0x7dff3a, 0.56, 0.08, 0.56, 0, 0.66, 0)); const broom = part(cyl, 0x8a5a3a, 0.06, 1.6, 0.06, 0, -0.5, 0.15); broom.rotation.x = 0.3; armL.add(broom); armL.add(part(cone, 0xc9a35a, 0.26, 0.4, 0.26, 0, -1.25, 0.4)); } },
  skeleton: { name: 'Skeleton', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xe8e2c8, hair: null, shirt: 0xe8e2c8, pants: 0xe8e2c8, tie: null },
    dress: ({ body, head, part }) => { for (let i = 0; i < 3; i++) body.add(part(box, 0x1a1a1a, 0.7, 0.05, 0.62, 0, 1.15 + i * 0.14, 0)); body.add(part(box, 0x1a1a1a, 0.06, 0.55, 0.62, 0, 1.3, 0)); for (const ex of [-0.13, 0.13]) head.add(part(sphere, 0x111111, 0.2, 0.22, 0.12, ex, 0.36, 0.26)); head.add(part(box, 0x111111, 0.22, 0.05, 0.1, 0, 0.14, 0.3)); } },
  hazmat: { name: 'Hazmat suit', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xf0c9a6, hair: null, shirt: 0xe8d54a, pants: 0xe8d54a, tie: null },
    dress: ({ head, body, part }) => { head.add(part(sphere, 0xe8d54a, 0.74, 0.74, 0.74, 0, 0.33, -0.04)); head.add(part(box, 0x2a4a5a, 0.46, 0.3, 0.1, 0, 0.36, 0.33)); body.add(part(cyl, 0x8a8f96, 0.22, 0.6, 0.22, 0, 1.3, -0.35)); } },
  ninja: { name: 'Ninja', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xf0c9a6, hair: 0x111111, shirt: 0x111111, pants: 0x111111, tie: null },
    dress: ({ head, body, part }) => { head.add(part(sphere, 0x111111, 0.68, 0.68, 0.68, 0, 0.3, -0.03)); head.add(part(box, 0xf0c9a6, 0.42, 0.16, 0.1, 0, 0.36, 0.32)); head.add(part(box, 0xc62828, 0.72, 0.08, 0.72, 0, 0.5, 0)); const sw = part(box, 0xd6d6e0, 0.05, 1.2, 0.08, 0.2, 1.5, -0.4); sw.rotation.z = 0.6; body.add(sw); } },
  pirate: { name: 'Pirate', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xe9c39e, hair: 0x2a1a10, shirt: 0x8a1a2a, pants: 0x2b2b33, tie: 0xe8d54a },
    dress: ({ head, armR, part }) => { head.add(part(box, 0x111111, 1.1, 0.18, 0.5, 0, 0.6, 0)); head.add(part(box, 0x111111, 0.6, 0.3, 0.6, 0, 0.74, 0)); head.add(part(box, 0x111111, 0.18, 0.14, 0.06, -0.13, 0.34, 0.33)); head.add(part(box, 0x111111, 0.02, 0.05, 0.7, 0, 0.42, 0)); armR.add(part(cyl, 0xd6d6e0, 0.05, 0.9, 0.05, 0, -1.0, 0.2)); } },
  elf: { name: 'Elf', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xf0c9a6, hair: 0xd6a04a, shirt: 0x1e8a4a, pants: 0xc62828, tie: null },
    dress: ({ head, part }) => { head.add(part(cone, 0xc62828, 0.6, 0.7, 0.6, 0, 0.8, 0)); head.add(part(sphere, 0xffffff, 0.16, 0.16, 0.16, 0, 1.15, 0)); head.add(part(box, 0xffffff, 0.7, 0.1, 0.7, 0, 0.5, 0)); for (const ex of [-1, 1]) head.add(part(cone, 0xf0c9a6, 0.14, 0.26, 0.1, ex * 0.36, 0.34, 0)).rotation.z = -ex * 1.4; } },
  robot: { name: 'Robot', price: 1, cats: ['player', 'npc'], outfit: { skin: 0x9aa4b0, hair: null, shirt: 0x6a7684, pants: 0x4a5560, tie: null },
    dress: ({ head, body, part }) => { head.add(part(box, 0x9aa4b0, 0.7, 0.66, 0.7, 0, 0.33, 0)); head.add(part(box, 0x3fdfff, 0.5, 0.12, 0.06, 0, 0.38, 0.36)); head.add(part(cyl, 0x4a5560, 0.04, 0.4, 0.04, 0, 0.8, 0)); head.add(part(sphere, 0xff3a3a, 0.12, 0.12, 0.12, 0, 1.0, 0)); body.add(part(box, 0x3fdfff, 0.2, 0.2, 0.06, 0, 1.35, 0.32)); } },
  punk: { name: 'Punk rocker', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xf0c9a6, hair: null, shirt: 0x1e1b22, pants: 0x2a2a33, tie: null },
    dress: ({ head, body, part }) => { for (let i = 0; i < 5; i++) part && head.add(part(box, 0xff2a8a, 0.12, 0.34 + Math.abs(2 - i) * -0.05, 0.1, 0, 0.78, 0.22 - i * 0.11)); head.add(part(box, 0x1a1a1a, 0.7, 0.1, 0.7, 0, 0.5, -0.02)); body.add(part(box, 0xd6d6e0, 0.8, 0.06, 0.64, 0, 1.08, 0)); body.add(part(box, 0xe8d54a, 0.3, 0.2, 0.06, 0, 1.4, 0.31)); for (const sx of [-1, 1]) body.add(part(cone, 0xd6d6e0, 0.1, 0.12, 0.1, sx * 0.3, 1.58, 0.1)); } },
  goth: { name: 'Goth kid', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xf4f0f4, hair: 0x0a0a0a, shirt: 0x0a0a0a, pants: 0x0a0a0a, tie: null },
    dress: ({ head, body, part }) => { head.add(part(box, 0x0a0a0a, 0.74, 0.25, 0.3, 0, 0.3, -0.25)); for (const ex of [-0.13, 0.13]) head.add(part(box, 0x1a1a1a, 0.18, 0.06, 0.06, ex, 0.27, 0.31)); head.add(part(box, 0x3a1a3a, 0.16, 0.04, 0.06, 0, 0.16, 0.32)); body.add(part(ring, 0x8a8f96, 0.5, 0.5, 0.5, 0, 1.5, 0.3)); body.add(part(box, 0x6a3a8a, 0.12, 0.3, 0.06, 0, 1.3, 0.31)); } },
  frank: { name: 'Frankenstein', price: 1, cats: ['player', 'npc'], outfit: { skin: 0x8fbf7a, hair: 0x0a0a0a, shirt: 0x2a2a33, pants: 0x1a1a22, tie: null },
    dress: ({ head, part }) => { head.add(part(box, 0x0a0a0a, 0.7, 0.2, 0.7, 0, 0.6, 0)); head.add(part(box, 0x8fbf7a, 0.7, 0.08, 0.7, 0, 0.5, 0)); for (const sx of [-1, 1]) { const b = part(cyl, 0x8a8f96, 0.1, 0.16, 0.1, sx * 0.4, 0.22, 0); b.rotation.z = Math.PI / 2; head.add(b); } head.add(part(box, 0x1a1a1a, 0.3, 0.03, 0.06, 0.12, 0.52, 0.33)); head.add(part(box, 0x1a1a1a, 0.26, 0.04, 0.06, 0, 0.15, 0.32)); } },
  rainbow: { name: 'Rainbow', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xf0c9a6, hair: 0xff2a8a, shirt: 0xff3a3a, pants: 0x3a7aff, tie: null },
    dress: ({ body, head, part }) => { const cols = [0xff8a1a, 0xffd24a, 0x3fdf4a, 0x3a7aff, 0x9a3fff]; cols.forEach((c, i) => body.add(part(box, c, 0.82, 0.07, 0.64, 0, 1.1 + i * 0.09, 0))); head.add(part(sphere, 0xffd24a, 0.72, 0.3, 0.72, 0, 0.6, 0)); head.add(part(sphere, 0x3fdf4a, 0.72, 0.16, 0.72, 0, 0.68, 0)); } },
  clown: { name: 'Clown', price: 1, cats: ['player', 'npc'], outfit: { skin: 0xe8e86a, hair: 0x3a5fd6, shirt: 0x2ad6e0, pants: 0x3a2fd0, tie: null },
    dress: ({ head, part }) => { for (const sx of [-1, 1]) head.add(part(sphere, 0x3a5fd6, 0.36, 0.36, 0.36, sx * 0.36, 0.32, -0.05)); head.add(part(sphere, 0xff2a2a, 0.17, 0.17, 0.17, 0, 0.2, 0.36)); } },
};
// car skins: body colour plus a dress(part, kind) hook. The car body is 0.95 wide, 1.9 long, roof at y 0.93; vans are 1.0 x 2.1, roof at 0.9
export const CAR_SKINS = {
  ateam: { name: 'A-Team van', price: 1, color: 0x1a1a1e, dress: (part, kind) => { const L = kind === 'van' ? 2.1 : 1.9; part(box, 0xc62828, 1.02, 0.1, L, 0, 0.5, kind === 'van' ? -0.1 : 0); part(box, 0x8a8f96, 1.02, 0.14, L, 0, 0.25, kind === 'van' ? -0.1 : 0); part(box, 0xc62828, 0.12, 0.05, 0.9, 0, 0.95, -0.2); part(box, 0x1a1a1e, 0.9, 0.12, 0.5, 0, 0.98, -0.3); } },
  madmax: { name: 'Mad Max rig', price: 1, color: 0x6a4a2a, dress: (part, kind) => { const L = kind === 'van' ? 2.1 : 1.9; for (let i = 0; i < 4; i++) { const sp = part(cone, 0x8a8f96, 0.1, 0.3, 0.1, -0.5 + i * 0.33, 0.45, L / 2 + 0.1); sp.rotation.x = Math.PI / 2; } part(box, 0x3a3a3a, 0.9, 0.08, 0.9, 0, 1.0, -0.3); part(cyl, 0x2a2a2e, 0.14, 0.5, 0.14, 0.3, 0.9, -0.9); part(box, 0x8a8f96, 1.05, 0.3, 0.1, 0, 0.3, L / 2 + 0.04); part(box, 0x4a3a2a, 0.3, 0.2, 0.5, -0.35, 0.95, -0.2); } },
  police: { name: 'Police cruiser', price: 1, color: 0xf0f0f0, dress: (part, kind) => { const L = kind === 'van' ? 2.1 : 1.9; part(box, 0x1a1a2e, 1.02, 0.2, L * 0.5, 0, 0.3, 0); part(box, 0x1a1a2e, 0.9, 0.3, 0.3, 0, 0.5, L / 2 - 0.1); part(box, 0xff3a3a, 0.3, 0.1, 0.12, -0.2, 0.98, -0.15); part(box, 0x3a7aff, 0.3, 0.1, 0.12, 0.2, 0.98, -0.15); part(box, 0xffd24a, 0.14, 0.05, 0.14, 0, 0.5, L / 2 + 0.02); } },
  hearse: { name: 'Hearse', price: 1, color: 0x111114, dress: (part, kind) => { const L = kind === 'van' ? 2.1 : 1.9; part(box, 0x111114, 0.9, 0.3, L * 0.5, 0, 0.9, -0.4); part(box, 0x8a8f96, 0.05, 0.3, L * 0.5, 0.46, 0.9, -0.4); part(box, 0x8a8f96, 0.05, 0.3, L * 0.5, -0.46, 0.9, -0.4); part(box, 0xc9a35a, 0.6, 0.06, 0.2, 0, 0.9, -L / 2 - 0.02); } },
  pizza: { name: 'Pizza wagon', price: 1, color: 0xff8a1a, dress: (part) => { part(box, 0xffffff, 0.8, 0.3, 0.7, 0, 1.1, -0.2); part(box, 0xc62828, 0.82, 0.06, 0.72, 0, 1.27, -0.2); part(cyl, 0xe8d54a, 0.28, 0.06, 0.28, 0, 1.3, -0.2); part(box, 0xc62828, 0.1, 0.05, 0.1, 0.05, 1.34, -0.25); } },
  sleigh: { name: "Santa's sleigh", price: 1, color: 0xc62828, replace: true, dress: (part) => { part(box, 0xc62828, 0.9, 0.42, 1.7, 0, 0.5, -0.1); part(box, 0xc62828, 0.9, 0.5, 0.3, 0, 0.75, -0.95); part(box, 0xc62828, 0.9, 0.3, 0.3, 0, 0.65, 0.75); part(box, 0xffd24a, 0.94, 0.06, 1.74, 0, 0.72, -0.1); part(box, 0x5a3a22, 0.7, 0.08, 0.4, 0, 0.72, -0.5); for (const sx of [-0.4, 0.4]) { part(box, 0xffd24a, 0.06, 0.06, 2.0, sx, 0.12, 0); part(box, 0xffd24a, 0.06, 0.3, 0.06, sx, 0.25, -0.6); part(box, 0xffd24a, 0.06, 0.3, 0.06, sx, 0.25, 0.6); const tip = part(cyl, 0xffd24a, 0.06, 0.4, 0.06, sx, 0.25, 1.1); tip.rotation.x = 0.9; } part(box, 0x1e8a4a, 0.3, 0.3, 0.3, -0.2, 0.86, -0.4); part(box, 0x3a7aff, 0.26, 0.26, 0.26, 0.2, 0.84, -0.3); part(box, 0xffd24a, 0.32, 0.06, 0.06, -0.2, 0.86, -0.4); } },
  reindeer: { name: 'Reindeer', price: 1, color: 0x8a5a3a, replace: true, dress: (part) => { part(box, 0x8a5a3a, 0.6, 0.5, 1.3, 0, 0.75, -0.1); part(box, 0xc9a37a, 0.5, 0.2, 1.1, 0, 0.52, -0.1); for (const [lx, lz] of [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.5], [0.2, -0.5]]) part(box, 0x6a4a2a, 0.14, 0.55, 0.14, lx, 0.27, lz); part(box, 0x8a5a3a, 0.26, 0.5, 0.3, 0, 1.15, 0.6); part(box, 0x8a5a3a, 0.34, 0.3, 0.5, 0, 1.4, 0.8); part(sphere, 0xff3a3a, 0.16, 0.16, 0.16, 0, 1.35, 1.08); for (const sx of [-1, 1]) { const a = part(cyl, 0xe8e2c8, 0.05, 0.6, 0.05, sx * 0.14, 1.75, 0.65); a.rotation.z = sx * 0.5; const b = part(cyl, 0xe8e2c8, 0.04, 0.3, 0.04, sx * 0.3, 1.9, 0.65); b.rotation.z = -sx * 0.6; part(sphere, 0x111111, 0.07, 0.07, 0.07, sx * 0.1, 1.48, 1.0); } part(box, 0x8a5a3a, 0.12, 0.25, 0.12, 0, 0.9, -0.8); } },
  dragon: { name: 'Small dragon', price: 1, color: 0x2f8a3f, replace: true, dress: (part) => { part(box, 0x2f8a3f, 0.7, 0.55, 1.4, 0, 0.6, -0.1); part(box, 0xc9e06a, 0.5, 0.2, 1.2, 0, 0.36, -0.1); for (const [lx, lz] of [[-0.3, 0.4], [0.3, 0.4], [-0.3, -0.5], [0.3, -0.5]]) part(box, 0x257a35, 0.18, 0.45, 0.2, lx, 0.22, lz); part(box, 0x2f8a3f, 0.4, 0.4, 0.6, 0, 0.95, 0.85); part(box, 0xc9e06a, 0.3, 0.12, 0.3, 0, 0.8, 1.05); for (const sx of [-1, 1]) { const h = part(cone, 0xe8e2c8, 0.1, 0.3, 0.1, sx * 0.14, 1.25, 0.75); h.rotation.z = sx * 0.4; part(sphere, 0xffd24a, 0.1, 0.1, 0.1, sx * 0.14, 1.0, 1.12); const w = part(box, 0x1f5a2f, 1.0, 0.04, 0.6, sx * 0.75, 1.0, -0.2); w.rotation.z = sx * 0.5; } for (let i = 0; i < 3; i++) { const t = part(cone, 0x2f8a3f, 0.32 - i * 0.08, 0.5, 0.32 - i * 0.08, 0, 0.6 - i * 0.1, -1.0 - i * 0.4); t.rotation.x = -Math.PI / 2; } for (let i = 0; i < 4; i++) part(cone, 0xc9a35a, 0.12, 0.2, 0.12, 0, 0.95, 0.4 - i * 0.35); } },
};
Object.assign(CHAR_SKINS, CHAR_SKINS2); Object.assign(CAR_SKINS, CAR_SKINS2); CAR_SKINS.dragon.price = 3; CAR_SKINS.sleigh.price = 2; CAR_SKINS.reindeer.price = 2;
export { FX_SKINS };
export const SKINS = [
  ...Object.entries(CHAR_SKINS).flatMap(([id, s]) => s.cats.map((cat) => ({ id: cat + ':' + id, key: id, cat, name: s.name + (cat === 'npc' ? ' survivors' : ''), price: cat === 'npc' ? 1 : 2, desc: cat === 'npc' ? 'Pick up to ten; survivors and crowds wear a random mix.' : 'Your character wears it in both games.' }))),
  ...Object.entries(FX_SKINS).map(([id, s]) => ({ id: 'fx:' + id, key: id, cat: 'fx', name: s.name, price: s.price, desc: s.flames ? 'Hellfire, burning zombies and fires change colour.' : 'What you throw turns to gold.' })),
  ...Object.entries(CAR_SKINS).map(([id, s]) => ({ id: 'car:' + id, key: id, cat: 'car', name: s.name, price: s.price, desc: 'Your car and the parked cars and vans.' })),
  ...Object.entries(KAIJU_SKINS).flatMap(([id, looks]) => Object.values(looks).map((s) => ({ id: 'kaiju:' + id + ':' + s.look, key: id, look: s.look, cat: 'kaiju', name: s.name, price: 1, desc: (id === 'mike' && s.look === 'halloween' ? 'His Halloween costume: a frilly pink tutu and a long blond wig.' : s.look === 'gear' ? 'Alternate ring gear in new colours.' : s.look === 'skeleton' ? 'Black with bone-white plates and red eyes.' : "Glowing orange bones and a flaming jack-o'-lantern head (or a witch's hat).") }))),
  ...Object.entries(TWISTER_SKINS).map(([id, s]) => ({ id: 'tornado:' + id, key: id, cat: 'tornado', name: s.name, price: s.price, desc: s.desc, bonus: s.bonus || null })),
];
// ---------- the army dresses for the era: Future troopers (white armour, glowing cyan visor, laser rifle) and Wild West
// cavalry (blue coat, wide-brimmed hat, yellow neckerchief, long rifle); otherwise the usual camo ----------
const glowM = (c) => new THREE.MeshBasicMaterial({ color: c });
const ARMY = {
  future: { outfit: { skin: 0xe9c39e, hair: 0x1a1a1a, shirt: 0xdfe5ee, pants: 0x2a3044, tie: null },
    dress: ({ head, body, armR, part }) => { head.add(part(sphere, 0xe8eef4, 0.92, 0.6, 0.92, 0, 0.62, -0.02)); for (const sx of [-1, 1]) head.add(part(box, 0xe8eef4, 0.1, 0.5, 0.6, sx * 0.42, 0.38, 0)); const v = part(box, 0x3af0ff, 0.7, 0.12, 0.1, 0, 0.44, 0.33); v.material = glowM(0x3af0ff); head.add(v);
      body.add(part(box, 0xf2f6fa, 0.7, 0.42, 0.7, 0, 1.38, 0)); const st = part(box, 0x3af0ff, 0.72, 0.05, 0.05, 0, 1.3, 0.36); st.material = glowM(0x3af0ff); body.add(st); for (const sx of [-1, 1]) body.add(part(sphere, 0xe8eef4, 0.36, 0.26, 0.4, sx * 0.42, 1.6, 0));
      armR.add(part(box, 0x1c2030, 0.1, 0.12, 1.0, 0.05, -0.7, 0.2)); const tip = part(box, 0xff4fd8, 0.12, 0.12, 0.12, 0.05, -0.7, 0.72); tip.material = glowM(0xff4fd8); armR.add(tip); } },
  past: { outfit: { skin: 0xe9c39e, hair: 0x4a2e1a, shirt: 0x2a3a7a, pants: 0x6a7ab8, tie: null },
    dress: ({ head, body, legL, legR, armR, part }) => { head.add(part(cyl, 0x2a2a3a, 1.1, 0.05, 1.1, 0, 0.6, 0)); head.add(part(cyl, 0x2a2a3a, 0.56, 0.28, 0.56, 0, 0.76, 0)); head.add(part(cyl, 0xd8b04a, 0.58, 0.05, 0.58, 0, 0.66, 0));
      const nk = part(cone, 0xe8c040, 0.3, 0.16, 0.14, 0, -0.06, 0.26); nk.rotation.x = Math.PI; head.add(nk); const belt = part(box, 0xeeeeea, 0.12, 0.9, 0.06, 0, 1.3, 0.34); belt.rotation.z = 0.6; body.add(belt);
      for (const l of [legL, legR]) l.add(part(box, 0xe8c040, 0.05, 0.75, 0.03, 0, -0.5, 0.17)); armR.add(part(box, 0x5a3a22, 0.08, 0.1, 1.2, 0.05, -0.7, 0.25)); armR.add(part(box, 0x8a8e96, 0.05, 0.05, 0.6, 0.05, -0.64, 0.6)); } },
};
export function armySkin() { const e = getEra(); return ARMY[e] || CHAR_SKINS.hunter; }
export function equippedTornado() { const e = getEquipped().tornado; return e ? e.split(':')[1] : null; }
// a car in the player's equipped car skin (or plain, in the given colour)
export function skinnedCarArgs(color) { const s = equippedSkin('car'); return s ? [s.color, s] : [color]; }
// what a townsperson wears: in the Wild West or the Future, mostly the era's outfit (some still wear your picked outfits)
export function townSkin() { const era = getEra(), eq = equippedSkin('npc'); if (era === 'past' || era === 'future') return eq && Math.random() < 0.35 ? eq : CHAR_SKINS[era === 'past' ? 'cowpoke' : 'neon']; return eq; }
export function equippedSkin(cat) { let e = getEquipped()[cat]; if (cat === 'npc') e = e.length ? e[(Math.random() * e.length) | 0] : null; if (!e) return null; const key = e.split(':')[1] || e; return cat === 'car' ? CAR_SKINS[key] || null : cat === 'fx' ? FX_SKINS[key] || null : CHAR_SKINS[key] || null; }
// ghost cars: every material on the finished group goes see-through
export function ghostify(group) { group.traverse((m) => { if (m.isMesh && m.material && m.material.color) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.45; } }); }
