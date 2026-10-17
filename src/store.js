// Skin shop: live 3D previews of every skin, buy with coins, tap again to equip.
import * as THREE from 'three';
import { SKINS, CHAR_SKINS, CAR_SKINS, getCoins, addCoins, getOwned, getEquipped, equip, buy } from './skins.js';
import { makeCharacter } from './poster/characters.js';
import { makeCar } from './car.js';

const $ = (id) => document.getElementById(id);
{ const q = new URLSearchParams(location.search).get('coins'); if (q) addCoins(+q); } // admin: ?coins=5 to test
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setSize(220, 220); renderer.setPixelRatio(1);
const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xd0e8ff, 0x3a3a4a, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(3, 6, 4); scene.add(sun);
const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50); cam.position.set(0, 1.6, 5.2); cam.lookAt(0, 1.0, 0);
const items = [];
function build() {
  const grid = $('grid'); grid.innerHTML = ''; items.length = 0; const owned = getOwned(), eq = getEquipped();
  $('coins').textContent = '🪙 ' + getCoins() + (getCoins() === 1 ? ' coin' : ' coins');
  for (const cat of ['player', 'npc', 'car']) {
    const h = document.createElement('h2'); h.textContent = { player: 'YOUR CHARACTER', npc: 'SURVIVORS & CROWDS', car: 'VEHICLES' }[cat]; grid.appendChild(h);
    for (const s of SKINS.filter((x) => x.cat === cat)) {
      const card = document.createElement('button'); card.className = 'skin'; const own = owned.includes(s.id), on = eq[cat] === s.id;
      card.innerHTML = '<canvas width="220" height="220"></canvas><b>' + s.name + '</b><span>' + s.desc + '</span><em>' + (on ? 'EQUIPPED' : own ? 'Tap to equip' : '🪙 ' + s.price) + '</em>';
      if (on) card.classList.add('on'); else if (!own && getCoins() < s.price) card.classList.add('poor');
      card.addEventListener('click', () => { if (!owned.includes(s.id)) { if (!buy(s.id)) { $('note').textContent = 'Beat a game to earn a coin.'; return; } } equip(cat, eq[cat] === s.id ? null : s.id); build(); });
      grid.appendChild(card);
      let obj; if (cat === 'car') { obj = makeCar(CAR_SKINS[s.key].color, CAR_SKINS[s.key]); obj.scale.setScalar(1.1); obj.position.y = 0.2; } else { obj = makeCharacter(cat === 'npc' ? 'pink' : 'worker', { skin: CHAR_SKINS[s.key] }); obj.position.y = -0.1; }
      items.push({ obj, ctx: card.querySelector('canvas').getContext('2d') });
    }
    const none = document.createElement('button'); none.className = 'skin plain' + (!eq[cat] ? ' on' : ''); none.innerHTML = '<b>Default</b><span>No skin.</span><em>' + (!eq[cat] ? 'EQUIPPED' : 'Tap to equip') + '</em>'; none.addEventListener('click', () => { equip(cat, null); build(); }); grid.appendChild(none);
  }
}
build();
let t = 0, last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = (now - last) / 1000; last = now; t += dt;
  for (const it of items) { if (it.obj.parent !== scene) scene.add(it.obj); it.obj.rotation.y = t * 0.8; renderer.render(scene, cam); scene.remove(it.obj); it.ctx.clearRect(0, 0, 220, 220); it.ctx.drawImage(renderer.domElement, 0, 0); } }
requestAnimationFrame(frame);
