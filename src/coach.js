// First-time coaching: the first time something new comes up, the round holds still while a card says what to do and an
// arrow shows where. It carries on as soon as the player does it. Each prompt shows once per device (kept with the tips).
//   mode 'drag': shows a joystick appearing in different places; carries on when the player holds and drags
//   mode 'tap':  carries on at the next press, which goes through to the game (a tap on the thing does the thing)
//   mode 'ok':   only to read; a tap anywhere carries on and the game never sees it
import { tipsSeen, markSeen, setTipGate, clearTips } from './howto.js';
const css = `
#coach { position: fixed; inset: 0; z-index: 7; pointer-events: none; background: #0a061455; display: none; font-family: inherit; }
#coach.on { display: block; } #coach.ok { pointer-events: auto; }
#coach .card { position: absolute; left: 50%; transform: translateX(-50%); width: min(310px, calc(100vw - 32px)); box-sizing: border-box; padding: 10px 14px 11px; border-radius: 14px; background: #1a0f2ef2; border: 2px solid #ffd24a; box-shadow: 0 0 22px #ffd24a55, 0 6px 14px #000a; text-align: center; color: #fff; }
#coach .card b { display: block; font-size: 17px; font-weight: 900; letter-spacing: 1px; color: #ffd24a; margin-bottom: 3px; }
#coach .card p { margin: 0; font-size: 14.5px; line-height: 1.3; font-weight: 700; }
#coach .card small { display: block; margin-top: 7px; font-size: 11px; font-weight: 900; letter-spacing: 2px; color: #7dff3a; opacity: 0; transition: opacity .25s; } #coach.ready .card small { opacity: 1; animation: coachBlink .9s infinite alternate; }
#coach .arrow { position: absolute; left: 0; top: 0; width: 0; height: 0; display: none; }
#coach .arrow i { position: absolute; left: -46px; top: -17px; width: 46px; height: 34px; background: #ffd24a; clip-path: polygon(0 32%, 54% 32%, 54% 0, 100% 50%, 54% 100%, 54% 68%, 0 68%); filter: drop-shadow(0 0 4px #000); animation: coachPoke .55s infinite alternate ease-in-out; }
#coach .ring { position: absolute; left: 0; top: 0; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; border: 3px solid #ffd24a; box-shadow: 0 0 12px #ffd24a, inset 0 0 10px #ffd24a66; display: none; animation: coachPulse .8s infinite alternate ease-in-out; }
#coach .finger { position: absolute; left: 0; top: 0; margin: 4px 0 0 -6px; font-size: 38px; line-height: 1; display: none; filter: drop-shadow(0 2px 3px #000); transform-origin: 30% 10%; animation: coachTap .8s infinite; }
#coach .stick { position: absolute; left: 0; top: 0; width: 110px; height: 110px; margin: -55px 0 0 -55px; border-radius: 50%; background: #ffffff22; border: 2px solid #ffffffaa; display: none; animation: coachStick 2.2s infinite; }
#coach .stick u { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; background: #ffffffcc; box-shadow: 0 0 10px #fff8; animation: coachKnob 2.2s infinite; }
#coach .stick u::after { content: '👆'; position: absolute; left: 6px; top: 16px; font-size: 38px; line-height: 1; filter: drop-shadow(0 2px 3px #000); }
@keyframes coachBlink { to { opacity: .45; } }
@keyframes coachPoke { to { transform: translateX(-9px); } }
@keyframes coachPulse { to { transform: scale(1.25); opacity: .6; } }
@keyframes coachTap { 0%, 55%, 100% { transform: translateY(10px) scale(1); } 28% { transform: translateY(0) scale(.86); } }
@keyframes coachStick { 0% { opacity: 0; transform: scale(.7); } 12%, 82% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1); } }
@keyframes coachKnob { 0%, 14% { transform: translate(0, 0); } 34% { transform: translate(30px, -12px); } 54% { transform: translate(6px, -32px); } 74% { transform: translate(-28px, 8px); } 100% { transform: translate(-28px, 8px); } }
body.cine #coach { visibility: hidden !important; }
#tipsAsk { position: fixed; inset: 0; z-index: 45; display: flex; align-items: center; justify-content: center; background: #0a0614e6; padding: 20px; font-family: inherit; }
#tipsAsk .card { width: min(340px, 100%); background: #1a0f2e; border: 2px solid #ffd24a; border-radius: 18px; padding: 18px 16px 14px; text-align: center; color: #fff; box-shadow: 0 0 30px #ffd24a44; }
#tipsAsk .pic { font-size: 54px; line-height: 1.1; } #tipsAsk h3 { margin: 4px 0 6px; font-size: 22px; color: #ffd24a; } #tipsAsk p { margin: 0 0 14px; font-size: 15px; line-height: 1.35; color: #e8dcff; }
#tipsAsk .row { display: flex; gap: 8px; } #tipsAsk .row button { flex: 1; margin: 0; font-size: 14px; padding: 12px 6px; }
`;
const READY_MS = 650; // a press this soon after a prompt appears doesn't dismiss it, so nobody taps past it by accident
const OFF = new URLSearchParams(location.search).has('nocoach'); // test scripts drive the game themselves
let box = null, cur = null, shownAt = 0, doneAt = -1e9, press = null, live = false, spotI = 0, spotT = 0;
// ---------- tips on or off (each game has its own switch: 'tips_on_<game>' is '1', '0', or not there yet = never asked) ----------
let game = 'all', asking = false; const tKey = () => 'tips_on_' + game;
export const tipsOn = () => { if (OFF) return false; try { return localStorage.getItem(tKey()) === '1'; } catch { return false; } };
export function setTipsOn(v) { try { localStorage.setItem(tKey(), v ? '1' : '0'); } catch { /* ignore */ } if (!v) { coachClear(); clearTips(); } }
// each game calls this once: g its short name, pauseHost its pause screen (the TIPS button goes in before the element 'before').
// The first time the game is ever opened it asks whether to show tips (the round, if one has started, waits for the answer)
export function tipsSetup(g, pauseHost, before) { game = g; setTipGate(tipsOn); ensure();
  const b = document.createElement('button'); b.className = 'ghost tipsBtn'; const draw = () => { b.textContent = '💡 TIPS: ' + (tipsOn() ? 'ON' : 'OFF'); }; b.addEventListener('click', (e) => { e.stopPropagation(); setTipsOn(!tipsOn()); draw(); }); pauseHost.insertBefore(b, before || null); draw();
  let asked = true; try { asked = localStorage.getItem(tKey()) !== null; } catch { /* ignore */ } if (OFF || asked) return;
  asking = true; const m = document.createElement('div'); m.id = 'tipsAsk'; m.innerHTML = '<div class="card"><div class="pic">💡</div><h3>WANT TIPS?</h3><p>Short tips can pop up the first time something new happens, to show you how to play. You can turn them on or off any time from the pause menu.</p><div class="row"><button class="ghost no">NO THANKS</button><button class="yes">YES, SHOW TIPS</button></div></div>';
  const pick = (v) => (e) => { e.stopPropagation(); setTipsOn(v); asking = false; m.remove(); draw(); }; m.querySelector('.yes').addEventListener('click', pick(true)); m.querySelector('.no').addEventListener('click', pick(false));
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'mousedown']) m.addEventListener(ev, (e) => e.stopPropagation()); document.body.appendChild(m); }
const q = (s) => box.querySelector(s);
function ensure() {
  if (box) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  box = document.createElement('div'); box.id = 'coach'; box.innerHTML = '<div class="stick"><u></u></div><div class="ring"></div><div class="finger">👆</div><div class="arrow"><i></i></div><div class="card"><b></b><p></p><small></small></div>'; document.body.appendChild(box);
  const ready = () => cur && live && performance.now() - shownAt >= READY_MS;
  // presses are watched before the game sees them: 'tap' lets the press through, 'drag' waits for a real drag
  addEventListener('pointerdown', (e) => { if (!cur || !live) return; press = { x: e.clientX, y: e.clientY }; if (cur.mode === 'tap' && ready()) finish(); }, true);
  addEventListener('pointermove', (e) => { if (cur && live && cur.mode === 'drag' && press && Math.hypot(e.clientX - press.x, e.clientY - press.y) >= 10) finish(); }, true);
  addEventListener('touchstart', (e) => { const t = e.touches[0]; if (cur && live && !press && t) press = { x: t.clientX, y: t.clientY }; }, { capture: true, passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; if (cur && live && cur.mode === 'drag' && press && t && Math.hypot(t.clientX - press.x, t.clientY - press.y) >= 10) finish(); }, { capture: true, passive: true });
  for (const ev of ['pointerup', 'touchend', 'touchcancel']) addEventListener(ev, () => { press = null; }, true);
  // 'ok' prompts cover the screen, so the tap that closes one never reaches the game
  box.addEventListener('pointerdown', (e) => { e.stopPropagation(); }); box.addEventListener('pointerup', (e) => { e.stopPropagation(); if (cur && cur.mode === 'ok' && ready()) finish(); }); box.addEventListener('click', (e) => e.stopPropagation());
  addEventListener('keydown', (e) => { if (!cur || !live || e.repeat) return; const move = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase()); if (cur.mode === 'drag' ? move : ready()) finish(); }, true);
}
function finish() { const c = cur; if (!c) return; cur = null; press = null; doneAt = performance.now(); markSeen('c_' + c.key); box.className = ''; if (c.done) c.done(); }
export const coachSeen = (key) => OFF || !tipsOn() || tipsSeen('c_' + key); /* (tips off: the games carry on as if each had been read) */
// seconds since the last prompt closed (a big number if none has): prompts leave a little room between them
export const coachIdle = () => (performance.now() - doneAt) / 1000;
export const coachBusy = () => !!cur;
// show a prompt once: o = { mode, title, text, at: () => ({ x, y }) screen point to point at (or null), finger, done }
export function coach(key, o) {
  if (OFF || asking || !tipsOn() || cur || tipsSeen('c_' + key)) return false; ensure(); cur = { key, mode: 'ok', ...o }; shownAt = performance.now(); press = null; spotI = 0; spotT = 0;
  q('.card b').textContent = cur.title; q('.card p').textContent = cur.text; q('.card small').textContent = cur.mode === 'ok' ? 'TAP TO CONTINUE' : ''; q('.card small').style.display = cur.mode === 'ok' ? '' : 'none';
  cur.side = null; return true;
}
// drop a prompt that's up without ticking it off (a restart, leaving the round)
export function coachClear() { if (!cur) return; cur = null; press = null; if (box) box.className = ''; }
const SPOTS = [[0.5, 0.74], [0.27, 0.62], [0.72, 0.66]]; // the demo joystick turns up in a few places: it works anywhere
// every frame from the game: isLive = a round is being played. Returns true while the round should hold still
export function coachFrame(isLive) {
  if (asking) return !!isLive; /* the WANT TIPS? question is up: a round that has started waits for the answer */
  live = !!(cur && isLive); if (!cur) return false; if (!isLive) { box.className = ''; return false; }
  const W = innerWidth, H = innerHeight, now = performance.now(), c = cur;
  box.className = 'on' + (c.mode === 'ok' ? ' ok' : '') + (now - shownAt >= READY_MS ? ' ready' : '');
  const stick = q('.stick'), ring = q('.ring'), finger = q('.finger'), arrow = q('.arrow'), card = q('.card');
  let t = c.at ? c.at() : null; if (t && !(isFinite(t.x) && isFinite(t.y))) t = null;
  if (c.mode === 'drag') { if (now - spotT > 2200) { spotT = now; const s = SPOTS[spotI++ % SPOTS.length]; stick.style.left = s[0] * W + 'px'; stick.style.top = s[1] * H + 'px'; stick.style.animation = 'none'; void stick.offsetWidth; stick.style.animation = ''; } stick.style.display = 'block'; }
  else stick.style.display = 'none';
  // the card keeps clear of what it's pointing at: under the top bar when the thing is low on screen, low when it's high
  if (c.side === null) c.side = c.mode === 'drag' ? 'top' : t && t.y > H * 0.5 ? 'top' : t ? 'low' : 'top';
  card.style.top = c.side === 'top' ? 'calc(var(--hudH, 116px) + ' + (H < 620 ? 10 : 30) + 'px)' : Math.round(H * 0.6) + 'px';
  if (!t) { ring.style.display = finger.style.display = arrow.style.display = 'none'; return true; }
  const m = 30, cx = Math.max(m, Math.min(W - m, t.x)), cy = Math.max(m, Math.min(H - m, t.y)), off = Math.abs(cx - t.x) > 4 || Math.abs(cy - t.y) > 4;
  // on screen: the arrow comes from the card's side and stops just short of the thing. Off screen: it sits at the edge, pointing out
  const ang = off ? Math.atan2(t.y - H / 2, t.x - W / 2) : c.side === 'top' ? Math.PI / 2 : -Math.PI / 2, gap = off ? 0 : 36;
  arrow.style.display = c.finger && !off ? 'none' : 'block'; arrow.style.transform = 'translate(' + (cx - Math.cos(ang) * gap) + 'px,' + (cy - Math.sin(ang) * gap) + 'px) rotate(' + ang + 'rad)';
  ring.style.display = off ? 'none' : 'block'; ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
  finger.style.display = c.finger && !off ? 'block' : 'none'; finger.style.left = cx + 'px'; finger.style.top = cy + 'px';
  return true;
}
