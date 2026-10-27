// Short how-to-play cards (one picture, one sentence each) and one-time in-game tips, so nobody has to read a wall of
// text before playing. Tips show once per device; the cards can be opened any time from the start screen.
const css = `
#howto { position: fixed; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; background: #0a0614e0; padding: 20px; }
#howto.show { display: flex; }
#howto .card { width: min(340px, 100%); background: #1a0f2e; border: 2px solid #7dff3a; border-radius: 18px; padding: 20px 16px 14px; text-align: center; color: #fff; box-shadow: 0 0 30px #7dff3a44; }
#howto .pic { font-size: 64px; line-height: 1.1; min-height: 76px; }
#howto h3 { margin: 6px 0 6px; font-size: 22px; color: #7dff3a; }
#howto p { margin: 0 0 14px; font-size: 16px; line-height: 1.35; color: #e8dcff; min-height: 66px; }
#howto .dots { font-size: 12px; color: #c9a6ff; letter-spacing: 4px; margin-bottom: 10px; }
#howto .row { display: flex; gap: 8px; } #howto .row button { flex: 1; margin: 0; }
.gameTip { position: fixed; left: 50%; top: calc(124px + env(safe-area-inset-top, 0)); transform: translate(-50%, -6px); z-index: 6; max-width: min(250px, 66vw); padding: 3px 8px; border-radius: 8px;
  background: #1a0f2eb0; border: 1px solid #ffd24a88; color: #fff; font-weight: 700; font-size: 10.5px; line-height: 1.2; text-align: center; pointer-events: none; opacity: 0; transition: opacity .25s, transform .25s; box-shadow: none; }
.gameTip.show { opacity: 1; transform: translate(-50%, 0); }
`;
let box = null, tipEl = null;
function ensure() {
  if (box) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  box = document.createElement('div'); box.id = 'howto'; box.innerHTML = '<div class="card"><div class="pic"></div><h3></h3><p></p><div class="dots"></div><div class="row"><button class="ghost skip">SKIP</button><button class="next">NEXT</button></div></div>'; document.body.appendChild(box);
  tipEl = document.createElement('div'); tipEl.className = 'gameTip'; document.body.appendChild(tipEl);
}
// slides: [[emoji, title, sentence], ...]
export function showHowTo(slides, onDone) {
  ensure(); let i = 0; const q = (s) => box.querySelector(s);
  const draw = () => { const [pic, title, text] = slides[i]; q('.pic').textContent = pic; q('h3').textContent = title; q('p').textContent = text; q('.dots').textContent = slides.map((_, k) => (k === i ? '●' : '○')).join(''); q('.next').textContent = i === slides.length - 1 ? "LET'S GO" : 'NEXT'; };
  const close = () => { box.classList.remove('show'); q('.next').onclick = q('.skip').onclick = null; if (onDone) onDone(); };
  q('.next').onclick = (e) => { e.stopPropagation(); if (i < slides.length - 1) { i++; draw(); } else close(); };
  q('.skip').onclick = (e) => { e.stopPropagation(); close(); };
  draw(); box.classList.add('show');
}
// a tip that shows once per device (key), for a few seconds; queued so two never overlap
let seenList = null; const seen = () => { if (!seenList) { try { seenList = JSON.parse(localStorage.getItem('tips_seen') || '[]'); } catch { seenList = []; } } return seenList; };
const queue = []; let busy = false;
export function tip(key, text, secs = 4.5) {
  ensure(); const s = seen(); if (s.includes(key) || queue.some((t) => t.key === key)) return; queue.push({ key, text, secs }); if (!busy) next();
}
function next() {
  const t = queue.shift(); if (!t) { busy = false; return; } busy = true; const s = seen(); if (!s.includes(t.key)) { s.push(t.key); try { localStorage.setItem('tips_seen', JSON.stringify(s)); } catch { /* ignore */ } }
  tipEl.textContent = t.text; tipEl.classList.add('show'); setTimeout(() => { tipEl.classList.remove('show'); setTimeout(next, 450); }, t.secs * 1000);
}
export function tipsSeen(key) { return seen().includes(key); }
export function clearTips() { queue.length = 0; if (tipEl) tipEl.classList.remove('show'); busy = false; }
export function markSeen(key) { const s = seen(); if (!s.includes(key)) { s.push(key); try { localStorage.setItem('tips_seen', JSON.stringify(s)); } catch { /* ignore */ } } }
