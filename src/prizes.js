// End-of-round prizes: instead of picking chests, play a quick prize game. The game rotates each round: a CLAW MACHINE
// (the claw slides back and forth; tap to drop it on a capsule), a PRIZE WHEEL (tap to spin) or a KAIJU EGG (tap it till
// it hatches). Each go pays out exactly like a chest did (same odds, same beginner boost), so only the fun changed.
// A game can add its own prize on top (extra(): a result or null); Kaiju Madness uses it to hand out kaiju.
import { roll } from './chests.js';
import { fmtCoins } from './skins.js';

const GAMES = ['claw', 'wheel', 'egg'];
const ICON = { coin: '🪙', skin: '👕', dupe: '🪙', empty: '💨', kaiju: '👹' };

export function showPrizes(el, goes, why = '', onShop = null, extra = null) {
  let n = 0; try { n = +localStorage.getItem('prize_game') || 0; localStorage.setItem('prize_game', String(n + 1)); } catch { /* ignore */ }
  const game = GAMES[n % GAMES.length];
  el.innerHTML = ''; el.classList.remove('hidden'); el.classList.add('prizes');
  const head = document.createElement('div'); head.className = 'chestHead'; el.appendChild(head);
  const box = document.createElement('div'); box.className = 'prizeBox prize-' + game; el.appendChild(box);
  const log = document.createElement('div'); log.className = 'prizeLog'; el.appendChild(log);
  if (why) { const w = document.createElement('div'); w.className = 'chestWhy'; w.textContent = 'You earned ' + goes + (goes === 1 ? ' go' : ' goes') + ': ' + why + '.'; el.appendChild(w); }
  let left = goes; const name = { claw: '🕹️ CLAW MACHINE', wheel: '🎡 PRIZE WHEEL', egg: '🥚 KAIJU EGG' }[game];
  const draw = () => { head.textContent = name + '  ·  ' + (left > 0 ? left + (left === 1 ? ' go left' : ' goes left') : 'all done') + '  ·  🪙 ' + fmtCoins(); };
  const won = (res) => { const d = document.createElement('div'); d.className = 'prizeWin ' + res.kind; d.textContent = ICON[res.kind] + ' ' + res.text; log.appendChild(d); draw();
    if (left <= 0 && onShop && !el.querySelector('.shopBtn')) { const s = document.createElement('button'); s.className = 'ghost shopBtn'; s.textContent = '🪙 SPEND COINS IN THE SKIN SHOP'; s.addEventListener('click', (ev) => { ev.stopPropagation(); onShop(); }); el.appendChild(s); } };
  draw(); ({ claw, wheel, egg })[game](box, () => left > 0, () => { left--; draw(); return (extra && extra()) || roll(); }, won, !!extra);
}

// ---------- claw machine: the claw slides; tap to drop it on whatever capsule is below ----------
function claw(box, canGo, take, won) {
  const caps = ['#ff5a8a', '#5ad8ff', '#ffd24a', '#7dff3a', '#c9a6ff', '#ff9a3a'];
  box.innerHTML = '<div class="clawRail"></div><div class="clawArm"><i></i><b>🪝</b></div><div class="clawPile">' + caps.map((c) => '<span style="background:' + c + '"></span>').join('') + '</div><button class="clawBtn">DROP</button>';
  const arm = box.querySelector('.clawArm'), pile = box.querySelector('.clawPile'), btn = box.querySelector('.clawBtn'); let x = 0.1, dir = 1, busy = false, raf = 0;
  const slide = () => { raf = requestAnimationFrame(slide); if (busy || !box.isConnected) return; x += dir * 0.012; if (x > 0.9 || x < 0.1) dir *= -1; arm.style.left = (x * 100) + '%'; };
  slide();
  const drop = (e) => { e.stopPropagation(); if (busy || !canGo()) return; busy = true; arm.classList.add('down');
    setTimeout(() => { const spans = [...pile.children].filter((s) => !s.classList.contains('gone')); let best = null, bd = 1e9; const ax = arm.getBoundingClientRect().left + arm.offsetWidth / 2; for (const s of spans) { const r = s.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - ax); if (d < bd) { bd = d; best = s; } }
      if (best) best.classList.add('gone'); arm.classList.add('grab'); arm.classList.remove('down');
      setTimeout(() => { arm.classList.remove('grab'); const res = take(); won(res); busy = false; if (!canGo()) { btn.disabled = true; btn.textContent = 'DONE'; cancelAnimationFrame(raf); } }, 650); }, 600); };
  btn.addEventListener('click', drop); box.addEventListener('click', drop);
}

// ---------- prize wheel: tap to spin; it lands on the prize you won ----------
function wheel(box, canGo, take, won, withKaiju) {
  const slices = ['coin', 'empty', 'coin', 'skin', 'coin', withKaiju ? 'kaiju' : 'empty', 'coin', 'empty'], cols = ['#3a2a5a', '#24183a', '#3a2a5a', '#5a3a1a', '#3a2a5a', withKaiju ? '#1a4a1a' : '#24183a', '#3a2a5a', '#24183a'];
  box.innerHTML = '<div class="wheelWrap"><canvas width="440" height="440"></canvas><div class="wheelPin">▼</div></div><button class="clawBtn">SPIN</button>';
  const cv = box.querySelector('canvas'), g = cv.getContext('2d'), btn = box.querySelector('.clawBtn'); let ang = 0, busy = false;
  const paint = () => { g.clearRect(0, 0, 440, 440); g.save(); g.translate(220, 220); g.rotate(ang); const a = Math.PI * 2 / slices.length;
    slices.forEach((s, i) => { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 210, i * a, (i + 1) * a); g.closePath(); g.fillStyle = cols[i]; g.fill(); g.strokeStyle = '#7dff3a'; g.lineWidth = 3; g.stroke(); g.save(); g.rotate(i * a + a / 2); g.font = '46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ICON[s], 140, 0); g.restore(); });
    g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fillStyle = '#7dff3a'; g.fill(); g.restore(); };
  paint();
  const spin = (e) => { e.stopPropagation(); if (busy || !canGo()) return; busy = true; const res = take(); const want = res.slot || (res.kind === 'skin' || res.kind === 'dupe' ? 'skin' : res.kind === 'coin' ? 'coin' : res.kind === 'kaiju' ? 'kaiju' : 'empty');
    const idxs = slices.map((s, i) => (s === want ? i : -1)).filter((i) => i >= 0), i = idxs[(Math.random() * idxs.length) | 0], a = Math.PI * 2 / slices.length;
    // the pin is at the top (-90 deg): end on an angle that puts slice i's middle under it, after five whole turns
    const target = -Math.PI / 2 - (i * a + a / 2), from = ang, end = from - Math.PI * 2 * 5 - (((from - target) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); let t = 0; const T = 2.6; let last = performance.now();
    const step = (now) => { t += (now - last) / 1000; last = now; const k = Math.min(1, t / T), e2 = 1 - Math.pow(1 - k, 3); ang = from + (end - from) * e2; paint(); if (k < 1) requestAnimationFrame(step); else { busy = false; won(res); if (!canGo()) { btn.disabled = true; btn.textContent = 'DONE'; } } };
    requestAnimationFrame(step); };
  btn.addEventListener('click', spin); box.addEventListener('click', spin);
}

// ---------- kaiju egg: tap it to crack it; it hatches the prize ----------
function egg(box, canGo, take, won) {
  box.innerHTML = '<div class="eggWrap"><div class="egg">🥚</div><div class="eggCracks"></div></div><div class="eggHint">TAP THE EGG!</div>';
  const eggEl = box.querySelector('.egg'), cracks = box.querySelector('.eggCracks'), hint = box.querySelector('.eggHint'); let taps = 0, need = 6, busy = false;
  const tap = (e) => { e.stopPropagation(); if (busy || !canGo()) return; taps++; eggEl.classList.remove('wob'); void eggEl.offsetWidth; eggEl.classList.add('wob'); cracks.textContent = '⚡'.repeat(Math.min(5, taps)); hint.textContent = taps < need ? 'CRACK! ' + (need - taps) + ' more' : 'HATCHING!';
    if (taps >= need) { busy = true; setTimeout(() => { const res = take(); eggEl.textContent = res.kind === 'empty' ? '🐣' : ICON[res.kind]; eggEl.classList.add('hatch'); cracks.textContent = ''; won(res);
      setTimeout(() => { if (canGo()) { eggEl.textContent = '🥚'; eggEl.classList.remove('hatch'); taps = 0; need = 5 + ((Math.random() * 3) | 0); hint.textContent = 'ANOTHER EGG! TAP IT!'; busy = false; } else hint.textContent = 'ALL HATCHED'; }, 1300); }, 350); } };
  box.addEventListener('click', tap);
}
