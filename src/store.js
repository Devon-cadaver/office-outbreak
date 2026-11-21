import { radio, setMusicDuck } from './audio.js';
// Skin shop: live 3D previews of every skin, buy with coins, tap again to equip.
import * as THREE from 'three';
import { SKINS, CHAR_SKINS, CAR_SKINS, FX_SKINS, NPC_MAX, townShare, getCoins, addCoins, getOwned, getEquipped, equip, isEquipped, buy, fmtCoins, LIST_CATS } from './skins.js';
import { makeCharacter, animateWalk } from './poster/characters.js';
import { createPreviews } from './livePreview.js';
import { makeCar } from './car.js';
import { createTwisters } from './tornado.js';
import { buildKaiju, KAIJU, FREE_KAIJU } from './kaiju/rigs.js';
import { CRAFT_KINDS } from './craftSkinData.js';
import { craftPreview } from './craftSkins.js';
import { hordePreview } from './hordeSkins.js';
const KAIJU_FLY = new Set(Object.keys(KAIJU).filter((k) => KAIJU[k].fly));

const $ = (id) => document.getElementById(id);
if (import.meta.env.DEV) { const q = new URLSearchParams(location.search).get('coins'); if (q) addCoins(+q); } // local testing only: ?coins=5
// every card's picture is live (livePreview.js): storms turn and throw things, monsters and people walk on the spot, cars turn
const PV = createPreviews({ perFrame: 5 }), twPreview = createTwisters(PV.scene), twMade = []; PV.onTick = (dt, n) => { if (n) twPreview.update(dt); };
function show(canvas, make, o = {}) { PV.add(canvas, make, (dt, t, obj) => { if (o.tw) return; if (o.craft) { obj.userData.tick(dt, t); return; } obj.rotation.y = -0.6 + Math.sin(t * 0.6) * 0.8; if (o.rig) obj.userData.rig.anim(dt, 0.5); else if (o.walk) animateWalk(obj, dt, 1); }, o.tw ? (v, obj) => { obj.userData.twister.asleep = !v; } : null); }
const kjObj = (id, look) => { const rig = buildKaiju(id, look); rig.anim(0.4, 0); const obj = rig.g; obj.scale.setScalar(KAIJU_FLY.has(id) ? 0.75 : 0.95); obj.position.y = KAIJU_FLY.has(id) ? -0.5 : -0.05; obj.userData.rig = rig; return obj; };
// You and Effects only show in Survival/Extract, which are hidden for now: add them back here when those games return
const CATS = [['tornado', 'Tornadoes'], ['kaiju', 'Kaiju'], ['craft', 'Aircraft'], ['horde', 'Zombies'], ['npc', 'Townsfolk'], ['car', 'Cars']];
// each kaiju has its own slot (kj_<id>), so every monster can wear its skin at once
// how much of the town the picked skins cover, shown under the heading
const shareTxt = (cat) => { const n = getEquipped()[cat].length; return n ? 'tap to add or remove · ' + n + ' on: ' + Math.round(townShare(n) * 100) + '% of the ' + (cat === 'horde' ? 'horde' : 'town') + ', ' + Math.round(townShare(n) * 100 / n) + '% each' : 'tap to add one: each covers 25% of the ' + (cat === 'horde' ? 'horde' : 'town') + '; past four, they share it evenly'; };
const slotOf = (s) => (s.cat === 'kaiju' ? 'kj_' + s.key : s.cat === 'craft' ? 'cr_' + s.craft : s.cat);
// the Kaiju tab: pick a monster first (kjSel), then its two skins
let kjSel = null; try { kjSel = sessionStorage.getItem('shop_kj') || null; } catch { /* ignore */ }
const pickKj = (id) => { kjSel = id; try { if (id) sessionStorage.setItem('shop_kj', id); else sessionStorage.removeItem('shop_kj'); } catch { /* ignore */ } build(); renderAll(); $('wrap').scrollTop = 0; };
// the Aircraft tab: pick a craft first (crSel), then its skins (one per storm)
const CRAFT_GAME = { bomber: 'Zombie Air Raid', heli: 'Zombie Air Raid', ufo: "Beam 'Em Up!", walker: "Beam 'Em Up!" };
let crSel = null; try { crSel = sessionStorage.getItem('shop_cr') || null; } catch { /* ignore */ }
const pickCr = (k) => { crSel = k; try { if (k) sessionStorage.setItem('shop_cr', k); else sessionStorage.removeItem('shop_cr'); } catch { /* ignore */ } build(); renderAll(); $('wrap').scrollTop = 0; };
const crObj = (kind, key) => craftPreview(kind, key, { fitTo: 2.75, y: 1.0, tilt: 0.5 });
let tab = 'tornado'; try { tab = sessionStorage.getItem('shop_tab') || 'tornado'; } catch { /* ignore */ } { const f = new URLSearchParams(location.search).get('from'); if (f === 'kaiju') tab = 'kaiju'; else if (f === 'alley') tab = 'tornado'; else if (f === 'airraid' || f === 'beamup') { tab = 'craft'; let k = 'bomber'; try { if (localStorage.getItem('ar_craft') === 'heli') k = 'heli'; } catch { /* ignore */ } crSel = f === 'beamup' ? (localStorage.getItem('bu_craft') === 'walker' ? 'walker' : 'ufo') : k; } } if (!CATS.some(([c]) => c === tab)) tab = 'tornado'; // opened from a game: start on that game's skins
function drawTabs() { const box = $('tabs'); box.innerHTML = ''; const owned = getOwned(); for (const [cat, name] of CATS) { const all = SKINS.filter((x) => x.cat === cat), have = all.filter((x) => owned.includes(x.id)).length; const b = document.createElement('button'); b.className = cat === tab ? 'on' : ''; b.innerHTML = name + '<i>' + have + '/' + all.length + '</i>';
  b.addEventListener('click', () => { tab = cat; if (cat !== 'kaiju') kjSel = null; if (cat !== 'craft') crSel = null; try { sessionStorage.setItem('shop_tab', cat); } catch { /* ignore */ } drawTabs(); build(); renderAll(); $('wrap').scrollTop = 0; }); box.appendChild(b); } }
// purchase confirmation
let buyOk = null; const buyBox = $('buyBox');
function askBuy(s, preview, ok) { const c = buyBox.querySelector('canvas'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); if (preview) g.drawImage(preview, 0, 0, c.width, c.height);
  $('buyName').textContent = s.name; const left = Math.round((getCoins() - s.price) * 100) / 100; $('buyText').textContent = 'Buy for ' + s.price + (s.price === 1 ? ' coin' : ' coins') + '? You will have ' + left + ' left.'; $('buyYes').textContent = 'BUY 🪙 ' + s.price; buyOk = ok; buyBox.classList.add('show'); }
const closeBuy = () => { buyBox.classList.remove('show'); buyOk = null; };
$('buyNo').addEventListener('click', closeBuy); buyBox.addEventListener('click', (e) => { if (e.target === buyBox) closeBuy(); });
$('buyYes').addEventListener('click', () => { const f = buyOk; closeBuy(); if (f) f(); });
function build() {
  const grid = $('grid'); grid.innerHTML = ''; for (const t of twMade) twPreview.remove(t, true); twMade.length = 0; twPreview.clear(); PV.clear(); const owned = getOwned(), eq = getEquipped();
  $('coins').textContent = '🪙 ' + fmtCoins(); drawTabs();
  for (const cat of [tab]) {
    // kaiju skins: monsters you've won first, then a separate row for the locked ones
    let unl = [...FREE_KAIJU]; try { unl = unl.concat(JSON.parse(localStorage.getItem('kj_unlocked') || '[]')); } catch { /* ignore */ }
    const rowOf = (title, extra = '') => { const hh = document.createElement('h2'); hh.innerHTML = title; grid.appendChild(hh); const r = document.createElement('div'); r.className = 'row ' + extra; grid.appendChild(r); return r; };
    if (cat === 'kaiju' && !(kjSel && KAIJU[kjSel])) {
      const rows = [rowOf('PICK A MONSTER <small>then choose its skin</small>'), rowOf('LOCKED MONSTERS <small>win them in the prize games first</small>', 'locked')];
      for (const id of Object.keys(KAIJU)) { const open = unl.includes(id), mine = SKINS.filter((x) => x.cat === 'kaiju' && x.key === id && owned.includes(x.id)).length; const on = eq['kj_' + id];
        const card = document.createElement('button'); card.className = 'skin' + (on ? ' on' : '') + (open ? '' : ' poor locked'); card.innerHTML = '<canvas width="150" height="150"></canvas><b>' + KAIJU[id].name + '</b><span></span><em>' + (open ? (mine ? mine + '/2 skins' + (on ? ' · wearing one' : '') : '2 skins') : '🔒 monster locked') + '</em>';
        card.addEventListener('click', () => pickKj(id)); rows[open ? 0 : 1].appendChild(card);
        show(card.querySelector('canvas'), () => kjObj(id, on || false), { rig: true }); }
      continue; }
    if (cat === 'craft' && !(crSel && CRAFT_KINDS[crSel])) { const r = rowOf('PICK AN AIRCRAFT <small>then choose its skin</small>');
      for (const k of Object.keys(CRAFT_KINDS)) { const all = SKINS.filter((x) => x.cat === 'craft' && x.craft === k), mine = all.filter((x) => owned.includes(x.id)).length, wear = all.find((x) => x.id === eq['cr_' + k]);
        const card = document.createElement('button'); card.className = 'skin' + (wear ? ' on' : ''); card.innerHTML = '<canvas width="150" height="150"></canvas><b>' + CRAFT_KINDS[k] + '</b><span>' + CRAFT_GAME[k] + '</span><em>' + mine + '/' + all.length + ' skins' + (wear ? ' · wearing ' + wear.name : '') + '</em>';
        card.addEventListener('click', () => pickCr(k)); r.appendChild(card); show(card.querySelector('canvas'), () => crObj(k, wear ? wear.key : null), { craft: true }); }
      continue; }
    const h = document.createElement('h2'); h.innerHTML = { player: 'YOUR CHARACTER (2 coins)', npc: 'TOWNSFOLK OUTFITS (1 coin) <small>' + shareTxt('npc') + '</small>', car: 'CARS IN TOWN <small>' + shareTxt('car') + '</small>', horde: 'ZOMBIE AIR RAID HORDES <small>' + shareTxt('horde') + '</small>', tornado: 'TORNADO SKINS', fx: 'EFFECTS', kaiju: 'KAIJU SKINS (tap again to take one off)' }[cat]; let row = null, lockedRow = null; if (cat === 'craft') { const back = document.createElement('button'); back.className = 'ghost'; back.textContent = '◀ ALL AIRCRAFT'; back.addEventListener('click', () => pickCr(null)); grid.appendChild(back); h.innerHTML = CRAFT_KINDS[crSel].toUpperCase() + ' <small>' + CRAFT_GAME[crSel] + ' · a skin for each storm · tap a skin to buy it, tap again to take it off</small>'; grid.appendChild(h); row = document.createElement('div'); row.className = 'row'; grid.appendChild(row); } else if (cat === 'kaiju') { const back = document.createElement('button'); back.className = 'ghost'; back.textContent = '◀ ALL MONSTERS'; back.addEventListener('click', () => pickKj(null)); grid.appendChild(back); h.innerHTML = KAIJU[kjSel].name + ' <small>' + (unl.includes(kjSel) ? 'tap a skin to buy it, tap again to take it off' : 'win this monster first, then its skins can be bought') + '</small>'; grid.appendChild(h); row = document.createElement('div'); row.className = 'row'; grid.appendChild(row); lockedRow = row; } else {  grid.appendChild(h); row = document.createElement('div'); row.className = 'row'; grid.appendChild(row); }
    for (const s of SKINS.filter((x) => x.cat === cat && (cat !== 'kaiju' || x.key === kjSel) && (cat !== 'craft' || x.craft === crSel))) {
      const card = document.createElement('button'); card.className = 'skin'; const own = owned.includes(s.id), on = isEquipped(slotOf(s), s.id);
      card.innerHTML = '<canvas width="150" height="150"></canvas><b>' + s.name + '</b><span>' + (s.storm ? 'Matches ' + s.storm + '. ' : '') + s.desc + '</span><em>' + (on ? 'EQUIPPED' : own ? 'Tap to equip' : s.bonus ? '🏆 ' + s.bonus : '🪙 ' + s.price) + '</em>';
      if (on) card.classList.add('on'); else if (!own && (s.bonus || getCoins() < s.price)) card.classList.add('poor'); if (!own) card.classList.add('locked');
      card.addEventListener('click', () => { if (cat === 'kaiju' && !unl.includes(s.key)) { $('note').textContent = 'Win this monster in the Kaiju Madness prize games first, then its skin can be bought.'; return; } if (!owned.includes(s.id)) { if (s.bonus) { $('note').textContent = 'Bonus skin: ' + s.bonus + ' to unlock it.'; return; } if (getCoins() < s.price) { $('note').textContent = 'Not enough coins yet: ' + s.name + ' costs ' + s.price + '. Beat a game to earn more.'; return; }
        askBuy(s, card.querySelector('canvas'), () => { if (!buy(s.id)) return; $('note').textContent = 'Bought ' + s.name + '!'; const sp = document.getElementById('wrap').scrollTop; if (!(LIST_CATS.includes(cat) && eq[cat].length >= NPC_MAX)) equip(slotOf(s), s.id); build(); renderAll(); document.getElementById('wrap').scrollTop = sp; }); return; } const sp = document.getElementById('wrap').scrollTop; if (LIST_CATS.includes(cat) && !on && eq[cat].length >= NPC_MAX) { $('note').textContent = 'Ten at most. Tap one to take it off.'; return; } equip(slotOf(s), LIST_CATS.includes(cat) ? s.id : (on ? null : s.id)); build(); renderAll(); document.getElementById('wrap').scrollTop = sp; });
      const lockedK = cat === 'kaiju' && !unl.includes(s.key); if (lockedK) { card.classList.add('poor'); card.querySelector('em').textContent = '🔒 monster locked'; } (lockedK ? lockedRow : row).appendChild(card);
      show(card.querySelector('canvas'), () => { let obj;
        if (cat === 'fx') { const fx = FX_SKINS[s.key]; obj = new THREE.Group(); if (fx.flames) { for (let i = 0; i < 14; i++) { const mm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: fx.flames[i % 3] })); mm.position.set((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8); mm.rotation.set(Math.random() * 3, Math.random() * 3, 0); mm.scale.setScalar(1.2 - i * 0.06); obj.add(mm); } } else { for (let i = 0; i < 6; i++) { const mm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: fx.junk })); mm.position.set((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2); mm.rotation.set(Math.random() * 3, Math.random() * 3, 0); obj.add(mm); } } }
        else if (cat === 'kaiju') obj = kjObj(s.key, s.look);
        else if (cat === 'craft') obj = crObj(s.craft, s.key);
        else if (cat === 'horde') obj = hordePreview(s.key);
        else if (cat === 'tornado') { obj = twPreview.make(true, [], s.key); obj.scale.setScalar(0.2); obj.position.y = -0.15; twMade.push(obj); }
        else if (cat === 'car') { obj = makeCar(CAR_SKINS[s.key].color, CAR_SKINS[s.key]); obj.scale.setScalar(1.1); obj.position.y = 0.2; } else { obj = makeCharacter(cat === 'npc' ? 'pink' : 'worker', { skin: CHAR_SKINS[s.key] }); obj.position.y = -0.1; }
        return obj; }, { tw: cat === 'tornado', rig: cat === 'kaiju', walk: cat === 'npc' || cat === 'player', craft: cat === 'craft' || cat === 'horde' });
    }
    if (cat === 'craft') { const slot = 'cr_' + crSel, none = document.createElement('button'), noneOn = !eq[slot]; none.className = 'skin' + (noneOn ? ' on' : ''); none.innerHTML = '<canvas width="150" height="150"></canvas><b>Default</b><span>Its own ' + (crSel === 'ufo' ? 'violet' : 'army olive') + ' paint.</span><em>' + (noneOn ? 'EQUIPPED' : 'Tap to wear') + '</em>'; none.addEventListener('click', () => { const sp = $('wrap').scrollTop; equip(slot, null); build(); renderAll(); $('wrap').scrollTop = sp; }); row.prepend(none); show(none.querySelector('canvas'), () => crObj(crSel, null), { craft: true }); continue; }
    if (cat === 'kaiju') { const slot = 'kj_' + kjSel, none = document.createElement('button'), noneOn = !eq[slot]; none.className = 'skin' + (noneOn ? ' on' : ''); none.innerHTML = '<canvas width="150" height="150"></canvas><b>Normal ' + KAIJU[kjSel].name + '</b><span></span><em>' + (noneOn ? 'EQUIPPED' : 'Tap to wear') + '</em>'; none.addEventListener('click', () => { equip(slot, null); build(); renderAll(); }); row.prepend(none); show(none.querySelector('canvas'), () => kjObj(kjSel, false), { rig: true }); continue; }
    const none = document.createElement('button'); const noneOn = LIST_CATS.includes(cat) ? !eq[cat].length : !eq[cat]; none.className = 'skin plain' + (noneOn ? ' on' : ''); none.innerHTML = '<b>Default</b><span>' + (LIST_CATS.includes(cat) ? 'Clears the set (' + eq[cat].length + ' picked).' : 'No skin.') + '</span><em>' + (noneOn ? 'EQUIPPED' : 'Tap to equip') + '</em>'; none.addEventListener('click', () => { const sp = document.getElementById('wrap').scrollTop; equip(cat, null); build(); renderAll(); document.getElementById('wrap').scrollTop = sp; }); row.appendChild(none);
  }
}
{ const from = new URLSearchParams(location.search).get('from'); const ok = { extract: 'zombieville.html', alley: 'tornado.html', survival: 'deadcity.html', kaiju: 'kaiju.html', airraid: 'airraid.html', beamup: 'beamup.html' }[from];
  if (ok) { const b = $('backBtn'); b.style.display = 'inline-block'; b.textContent = '◀ ' + { extract: 'EXTRACT', alley: 'TORNADO TIME!', survival: 'DEAD CITY', kaiju: 'KAIJU MADNESS', airraid: 'ZOMBIE AIR RAID', beamup: "BEAM 'EM UP!" }[from]; b.addEventListener('click', () => { location.href = ok; }); } }
build();
function renderAll() {} // the cards draw themselves now, a few each frame (livePreview.js)
renderAll();

radio(); setMusicDuck(0.5); // the radio keeps playing in the shop, at half volume
