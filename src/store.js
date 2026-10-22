import { radio } from './audio.js';
// Skin shop: live 3D previews of every skin, buy with coins, tap again to equip.
import * as THREE from 'three';
import { SKINS, CHAR_SKINS, CAR_SKINS, FX_SKINS, NPC_MAX, getCoins, addCoins, getOwned, getEquipped, equip, isEquipped, buy, fmtCoins } from './skins.js';
import { makeCharacter } from './poster/characters.js';
import { makeCar } from './car.js';
import { createTwisters } from './tornado.js';
import { buildKaiju, KAIJU, FREE_KAIJU } from './kaiju/rigs.js';
const KAIJU_FLY = new Set(Object.keys(KAIJU).filter((k) => KAIJU[k].fly));

const $ = (id) => document.getElementById(id);
if (import.meta.env.DEV) { const q = new URLSearchParams(location.search).get('coins'); if (q) addCoins(+q); } // local testing only: ?coins=5
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setSize(150, 150); renderer.setPixelRatio(1);
const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xd0e8ff, 0x3a3a4a, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(3, 6, 4); scene.add(sun);
const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50); cam.position.set(0, 1.6, 5.2); cam.lookAt(0, 1.0, 0);
const items = []; const twPreview = createTwisters(scene);
// You and Effects only show in Survival/Extract, which are hidden for now: add them back here when those games return
const CATS = [['tornado', 'Tornadoes'], ['kaiju', 'Kaiju'], ['npc', 'Townsfolk'], ['car', 'Cars']];
// each kaiju has its own slot (kj_<id>), so every monster can wear its skin at once
const slotOf = (s) => (s.cat === 'kaiju' ? 'kj_' + s.key : s.cat);
// the Kaiju tab: pick a monster first (kjSel), then its two skins
let kjSel = null; try { kjSel = sessionStorage.getItem('shop_kj') || null; } catch { /* ignore */ }
const pickKj = (id) => { kjSel = id; try { if (id) sessionStorage.setItem('shop_kj', id); else sessionStorage.removeItem('shop_kj'); } catch { /* ignore */ } build(); renderAll(); $('wrap').scrollTop = 0; };
let tab = 'tornado'; try { tab = sessionStorage.getItem('shop_tab') || 'tornado'; } catch { /* ignore */ } if (!CATS.some(([c]) => c === tab)) tab = 'tornado';
function drawTabs() { const box = $('tabs'); box.innerHTML = ''; const owned = getOwned(); for (const [cat, name] of CATS) { const all = SKINS.filter((x) => x.cat === cat), have = all.filter((x) => owned.includes(x.id)).length; const b = document.createElement('button'); b.className = cat === tab ? 'on' : ''; b.innerHTML = name + '<i>' + have + '/' + all.length + '</i>';
  b.addEventListener('click', () => { tab = cat; if (cat !== 'kaiju') kjSel = null; try { sessionStorage.setItem('shop_tab', cat); } catch { /* ignore */ } drawTabs(); build(); renderAll(); $('wrap').scrollTop = 0; }); box.appendChild(b); } }
// purchase confirmation
let buyOk = null; const buyBox = $('buyBox');
function askBuy(s, preview, ok) { const c = buyBox.querySelector('canvas'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); if (preview) g.drawImage(preview, 0, 0, c.width, c.height);
  $('buyName').textContent = s.name; const left = Math.round((getCoins() - s.price) * 100) / 100; $('buyText').textContent = 'Buy for ' + s.price + (s.price === 1 ? ' coin' : ' coins') + '? You will have ' + left + ' left.'; $('buyYes').textContent = 'BUY 🪙 ' + s.price; buyOk = ok; buyBox.classList.add('show'); }
const closeBuy = () => { buyBox.classList.remove('show'); buyOk = null; };
$('buyNo').addEventListener('click', closeBuy); buyBox.addEventListener('click', (e) => { if (e.target === buyBox) closeBuy(); });
$('buyYes').addEventListener('click', () => { const f = buyOk; closeBuy(); if (f) f(); });
function build() {
  const grid = $('grid'); grid.innerHTML = ''; items.length = 0; const owned = getOwned(), eq = getEquipped();
  $('coins').textContent = '🪙 ' + fmtCoins(); drawTabs();
  for (const cat of [tab]) {
    // kaiju skins: monsters you've won first, then a separate row for the locked ones
    let unl = [...FREE_KAIJU]; try { unl = unl.concat(JSON.parse(localStorage.getItem('kj_unlocked') || '[]')); } catch { /* ignore */ }
    const rowOf = (title, extra = '') => { const hh = document.createElement('h2'); hh.innerHTML = title; grid.appendChild(hh); const r = document.createElement('div'); r.className = 'row ' + extra; grid.appendChild(r); return r; };
    if (cat === 'kaiju' && !(kjSel && KAIJU[kjSel])) {
      const rows = [rowOf('PICK A MONSTER <small>then choose its skin · swipe ↔</small>'), rowOf('LOCKED MONSTERS <small>win them in the prize games first</small>', 'locked')];
      for (const id of Object.keys(KAIJU)) { const open = unl.includes(id), mine = SKINS.filter((x) => x.cat === 'kaiju' && x.key === id && owned.includes(x.id)).length; const on = eq['kj_' + id];
        const card = document.createElement('button'); card.className = 'skin' + (on ? ' on' : '') + (open ? '' : ' poor'); card.innerHTML = '<canvas width="150" height="150"></canvas><b>' + KAIJU[id].name + '</b><span></span><em>' + (open ? (mine ? mine + '/2 skins' + (on ? ' · wearing one' : '') : '2 skins') : '🔒 monster locked') + '</em>';
        card.addEventListener('click', () => pickKj(id)); rows[open ? 0 : 1].appendChild(card);
        const rig = buildKaiju(id, on || false); rig.anim(0.4, 0); const obj = rig.g; obj.scale.setScalar(KAIJU_FLY.has(id) ? 0.75 : 0.95); obj.position.y = KAIJU_FLY.has(id) ? -0.5 : -0.05; items.push({ obj, ctx: card.querySelector('canvas').getContext('2d') }); }
      continue; }
    const h = document.createElement('h2'); h.textContent = { player: 'YOUR CHARACTER (2 coins)', npc: 'TOWNSFOLK OUTFITS (1 coin, pick up to 10)', car: 'CARS IN TOWN', tornado: 'TORNADO SKINS', fx: 'EFFECTS', kaiju: 'KAIJU SKINS (tap again to take one off)' }[cat]; let row = null, lockedRow = null; if (cat === 'kaiju') { const back = document.createElement('button'); back.className = 'ghost'; back.textContent = '◀ ALL MONSTERS'; back.addEventListener('click', () => pickKj(null)); grid.appendChild(back); h.innerHTML = KAIJU[kjSel].name + ' <small>' + (unl.includes(kjSel) ? 'tap a skin to buy it, tap again to take it off' : 'win this monster first, then its skins can be bought') + '</small>'; grid.appendChild(h); row = document.createElement('div'); row.className = 'row'; grid.appendChild(row); lockedRow = row; } else { h.innerHTML += ' <small>swipe ↔</small>'; grid.appendChild(h); row = document.createElement('div'); row.className = 'row'; grid.appendChild(row); }
    for (const s of SKINS.filter((x) => x.cat === cat && (cat !== 'kaiju' || x.key === kjSel))) {
      const card = document.createElement('button'); card.className = 'skin'; const own = owned.includes(s.id), on = isEquipped(slotOf(s), s.id);
      card.innerHTML = '<canvas width="150" height="150"></canvas><b>' + s.name + '</b><span>' + s.desc + '</span><em>' + (on ? 'EQUIPPED' : own ? 'Tap to equip' : s.bonus ? '🏆 ' + s.bonus : '🪙 ' + s.price) + '</em>';
      if (on) card.classList.add('on'); else if (!own && (s.bonus || getCoins() < s.price)) card.classList.add('poor');
      card.addEventListener('click', () => { if (cat === 'kaiju' && !unl.includes(s.key)) { $('note').textContent = 'Win this monster in the Kaiju Madness prize games first, then its skin can be bought.'; return; } if (!owned.includes(s.id)) { if (s.bonus) { $('note').textContent = 'Bonus skin: ' + s.bonus + ' to unlock it.'; return; } if (getCoins() < s.price) { $('note').textContent = 'Not enough coins yet: ' + s.name + ' costs ' + s.price + '. Beat a game to earn more.'; return; }
        askBuy(s, card.querySelector('canvas'), () => { if (!buy(s.id)) return; $('note').textContent = 'Bought ' + s.name + '!'; const sp = document.getElementById('wrap').scrollTop; if (!(cat === 'npc' && eq.npc.length >= NPC_MAX)) equip(slotOf(s), s.id); build(); renderAll(); document.getElementById('wrap').scrollTop = sp; }); return; } const sp = document.getElementById('wrap').scrollTop; if (cat === 'npc' && !on && eq.npc.length >= NPC_MAX) { $('note').textContent = 'Ten survivor skins at most. Tap one to remove it.'; return; } equip(slotOf(s), cat === 'npc' ? s.id : (on ? null : s.id)); build(); renderAll(); document.getElementById('wrap').scrollTop = sp; });
      const lockedK = cat === 'kaiju' && !unl.includes(s.key); if (lockedK) { card.classList.add('poor'); card.querySelector('em').textContent = '🔒 monster locked'; } (lockedK ? lockedRow : row).appendChild(card);
      let obj; if (cat === 'fx') { const fx = FX_SKINS[s.key]; obj = new THREE.Group(); if (fx.flames) { for (let i = 0; i < 14; i++) { const mm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: fx.flames[i % 3] })); mm.position.set((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8); mm.rotation.set(Math.random() * 3, Math.random() * 3, 0); mm.scale.setScalar(1.2 - i * 0.06); obj.add(mm); } } else { for (let i = 0; i < 6; i++) { const mm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: fx.junk })); mm.position.set((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2); mm.rotation.set(Math.random() * 3, Math.random() * 3, 0); obj.add(mm); } } }
      else if (cat === 'kaiju') { const rig = buildKaiju(s.key, s.look); rig.anim(0.4, 0); obj = rig.g; obj.scale.setScalar(KAIJU_FLY.has(s.key) ? 0.75 : 0.95); obj.position.y = KAIJU_FLY.has(s.key) ? -0.5 : -0.05; }
      else if (cat === 'tornado') { obj = twPreview.make(true, [], s.key); obj.scale.setScalar(0.2); obj.position.y = -0.15; }
      else if (cat === 'car') { obj = makeCar(CAR_SKINS[s.key].color, CAR_SKINS[s.key]); obj.scale.setScalar(1.1); obj.position.y = 0.2; } else { obj = makeCharacter(cat === 'npc' ? 'pink' : 'worker', { skin: CHAR_SKINS[s.key] }); obj.position.y = -0.1; }
      items.push({ obj, ctx: card.querySelector('canvas').getContext('2d') });
    }
    if (cat === 'kaiju') { const slot = 'kj_' + kjSel, none = document.createElement('button'), noneOn = !eq[slot]; none.className = 'skin' + (noneOn ? ' on' : ''); none.innerHTML = '<canvas width="150" height="150"></canvas><b>Normal ' + KAIJU[kjSel].name + '</b><span></span><em>' + (noneOn ? 'EQUIPPED' : 'Tap to wear') + '</em>'; none.addEventListener('click', () => { equip(slot, null); build(); renderAll(); }); row.prepend(none); const rig = buildKaiju(kjSel, false); rig.anim(0.4, 0); const obj = rig.g; obj.scale.setScalar(KAIJU_FLY.has(kjSel) ? 0.75 : 0.95); obj.position.y = KAIJU_FLY.has(kjSel) ? -0.5 : -0.05; items.push({ obj, ctx: none.querySelector('canvas').getContext('2d') }); continue; }
    const none = document.createElement('button'); const noneOn = cat === 'npc' ? !eq.npc.length : !eq[cat]; none.className = 'skin plain' + (noneOn ? ' on' : ''); none.innerHTML = '<b>Default</b><span>' + (cat === 'npc' ? 'Clears the set (' + eq.npc.length + '/' + NPC_MAX + ' picked).' : 'No skin.') + '</span><em>' + (noneOn ? 'EQUIPPED' : 'Tap to equip') + '</em>'; none.addEventListener('click', () => { const sp = document.getElementById('wrap').scrollTop; equip(cat, null); build(); renderAll(); document.getElementById('wrap').scrollTop = sp; }); row.appendChild(none);
  }
}
{ const from = new URLSearchParams(location.search).get('from'); const ok = { extract: 'zombieville.html', alley: 'tornado.html', survival: 'deadcity.html', kaiju: 'kaiju.html' }[from];
  if (ok) { const b = $('backBtn'); b.style.display = 'inline-block'; b.textContent = '◀ ' + { extract: 'EXTRACT', alley: 'TORNADO ALLEY', survival: 'DEAD CITY', kaiju: 'KAIJU MADNESS' }[from]; b.addEventListener('click', () => { location.href = ok; }); } }
build();
// one static render per card at a three-quarter angle: no per-frame WebGL work, so the page scrolls freely
function renderAll() { for (let k = 0; k < 4; k++) twPreview.update(0.05); for (const it of items) { scene.add(it.obj); it.obj.rotation.y = -0.6; renderer.render(scene, cam); scene.remove(it.obj); it.ctx.clearRect(0, 0, 150, 150); it.ctx.drawImage(renderer.domElement, 0, 0); } }
renderAll();

radio(); // the radio keeps playing in the shop
