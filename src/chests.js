// End-of-round chest pick: tap chests to open them. Most are empty, some hold a sliver of a coin,
// and a very rare one holds a free skin (a skin you already own pays half a coin instead).
import { SKINS, addCoins, grantSkin, fmtCoins } from './skins.js';

const ODDS = { skin: 0.005, coin: 0.35 }; // per chest; the rest are empty

function roll() {
  const r = Math.random();
  if (r < ODDS.skin) { const s = SKINS[(Math.random() * SKINS.length) | 0]; return grantSkin(s.id) ? { kind: 'skin', text: 'FREE SKIN: ' + s.name + '!' } : (addCoins(0.5), { kind: 'dupe', text: s.name + ' (owned): +0.5 coin' }); }
  if (r < ODDS.skin + ODDS.coin) { const c = Math.random() < 0.6 ? 0.01 : Math.random() < 0.75 ? 0.02 : 0.03; addCoins(c); return { kind: 'coin', text: '+' + c + ' coin' }; }
  return { kind: 'empty', text: 'Empty' };
}

// picks: how many of the three chests the player may open
export function showChests(el, picks) {
  el.innerHTML = ''; el.classList.remove('hidden');
  const head = document.createElement('div'); head.className = 'chestHead'; el.appendChild(head);
  const row = document.createElement('div'); row.className = 'chestRow'; el.appendChild(row);
  let left = picks; const coinsAt = () => head.textContent = (left > 0 ? 'Open ' + left + (left === 1 ? ' chest' : ' chests') : 'Chests opened') + '  ·  🪙 ' + fmtCoins();
  coinsAt();
  for (let i = 0; i < 3; i++) {
    const b = document.createElement('button'); b.className = 'chest'; b.innerHTML = '<span class="lid">🧰</span><span class="res"></span>';
    b.addEventListener('click', (e) => {
      e.stopPropagation(); if (left <= 0 || b.classList.contains('open') || b.classList.contains('shake')) return;
      left--; b.classList.add('shake'); coinsAt();
      setTimeout(() => { const res = roll(); b.classList.remove('shake'); b.classList.add('open', res.kind); b.querySelector('.lid').textContent = res.kind === 'skin' ? '👕' : res.kind === 'empty' ? '💨' : '🪙'; b.querySelector('.res').textContent = res.text; coinsAt();
        if (left <= 0) for (const o of row.children) if (!o.classList.contains('open') && !o.classList.contains('shake')) o.classList.add('done'); }, 650);
    });
    row.appendChild(b);
  }
}
