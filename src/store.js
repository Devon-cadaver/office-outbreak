// Skin shop: live 3D previews of every skin, buy with coins, tap again to equip.
import * as THREE from 'three';
import { SKINS, CHAR_SKINS, CAR_SKINS, FX_SKINS, NPC_MAX, getCoins, addCoins, getOwned, getEquipped, equip, isEquipped, buy, fmtCoins } from './skins.js';
import { makeCharacter } from './poster/characters.js';
import { makeCar } from './car.js';
import { createTwisters } from './tornado.js';

const $ = (id) => document.getElementById(id);
if (import.meta.env.DEV) { const q = new URLSearchParams(location.search).get('coins'); if (q) addCoins(+q); } // local testing only: ?coins=5
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setSize(150, 150); renderer.setPixelRatio(1);
const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xd0e8ff, 0x3a3a4a, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(3, 6, 4); scene.add(sun);
const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50); cam.position.set(0, 1.6, 5.2); cam.lookAt(0, 1.0, 0);
const items = []; const twPreview = createTwisters(scene);
function build() {
  const grid = $('grid'); grid.innerHTML = ''; items.length = 0; const owned = getOwned(), eq = getEquipped();
  $('coins').textContent = '🪙 ' + fmtCoins();
  for (const cat of ['player', 'npc', 'car', 'tornado', 'fx']) {
    const h = document.createElement('h2'); h.textContent = { player: 'YOUR CHARACTER (2 coins)', npc: 'SURVIVORS & CROWDS (1 coin, pick up to 10)', car: 'VEHICLES', tornado: 'TORNADOES (Tornado Alley and storms)', fx: 'EFFECTS' }[cat]; grid.appendChild(h);
    for (const s of SKINS.filter((x) => x.cat === cat)) {
      const card = document.createElement('button'); card.className = 'skin'; const own = owned.includes(s.id), on = isEquipped(cat, s.id);
      card.innerHTML = '<canvas width="150" height="150"></canvas><b>' + s.name + '</b><span>' + s.desc + '</span><em>' + (on ? 'EQUIPPED' : own ? 'Tap to equip' : '🪙 ' + s.price) + '</em>';
      if (on) card.classList.add('on'); else if (!own && getCoins() < s.price) card.classList.add('poor');
      card.addEventListener('click', () => { if (!owned.includes(s.id)) { if (!buy(s.id)) { $('note').textContent = 'Beat a game to earn a coin.'; return; } } const sp = document.getElementById('wrap').scrollTop; if (cat === 'npc' && !on && eq.npc.length >= NPC_MAX) { $('note').textContent = 'Ten survivor skins at most. Tap one to remove it.'; return; } equip(cat, cat === 'npc' ? s.id : (on ? null : s.id)); build(); renderAll(); document.getElementById('wrap').scrollTop = sp; });
      grid.appendChild(card);
      let obj; if (cat === 'fx') { const fx = FX_SKINS[s.key]; obj = new THREE.Group(); if (fx.flames) { for (let i = 0; i < 14; i++) { const mm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: fx.flames[i % 3] })); mm.position.set((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8); mm.rotation.set(Math.random() * 3, Math.random() * 3, 0); mm.scale.setScalar(1.2 - i * 0.06); obj.add(mm); } } else { for (let i = 0; i < 6; i++) { const mm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: fx.junk })); mm.position.set((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2); mm.rotation.set(Math.random() * 3, Math.random() * 3, 0); obj.add(mm); } } }
      else if (cat === 'tornado') { obj = twPreview.make(true, [], s.key); obj.scale.setScalar(0.2); obj.position.y = -0.15; }
      else if (cat === 'car') { obj = makeCar(CAR_SKINS[s.key].color, CAR_SKINS[s.key]); obj.scale.setScalar(1.1); obj.position.y = 0.2; } else { obj = makeCharacter(cat === 'npc' ? 'pink' : 'worker', { skin: CHAR_SKINS[s.key] }); obj.position.y = -0.1; }
      items.push({ obj, ctx: card.querySelector('canvas').getContext('2d') });
    }
    const none = document.createElement('button'); const noneOn = cat === 'npc' ? !eq.npc.length : !eq[cat]; none.className = 'skin plain' + (noneOn ? ' on' : ''); none.innerHTML = '<b>Default</b><span>' + (cat === 'npc' ? 'Clears the set (' + eq.npc.length + '/' + NPC_MAX + ' picked).' : 'No skin.') + '</span><em>' + (noneOn ? 'EQUIPPED' : 'Tap to equip') + '</em>'; none.addEventListener('click', () => { const sp = document.getElementById('wrap').scrollTop; equip(cat, null); build(); renderAll(); document.getElementById('wrap').scrollTop = sp; }); grid.appendChild(none);
  }
}
build();
// one static render per card at a three-quarter angle: no per-frame WebGL work, so the page scrolls freely
function renderAll() { for (let k = 0; k < 4; k++) twPreview.update(0.05); for (const it of items) { scene.add(it.obj); it.obj.rotation.y = -0.6; renderer.render(scene, cam); scene.remove(it.obj); it.ctx.clearRect(0, 0, 150, 150); it.ctx.drawImage(renderer.domElement, 0, 0); } }
renderAll();
