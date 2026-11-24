// THE FUN PACK: what all four games share for difficulty, star ratings, the combo meter, boss fights, random events, the daily
// challenge, endless runs and the phone's buzz. Each game calls funInit(game) once, roundK(game) as a round starts (the numbers
// that round is played with), and the pieces below as it goes.
//   FUN: one switch per feature. Set one to false and that feature is gone from every game (the quick way to take one back out).
import * as THREE from 'three';
import { getEra } from './progress.js';
import { addCoins } from './skins.js';
export const FUN = { stars: true, diff: true, daily: true, combo: true, boss: true, endless: true, events: true, buzz: true };
const Q = new URLSearchParams(location.search), rnd = (a, b) => a + Math.random() * (b - a);
const ls = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }, put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const css = `
#diffRow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: var(--w, min(92vw, 420px)); box-sizing: border-box; margin: 0; }
#diffRow button { margin: 0; padding: 6px 2px; font-size: 11px; min-width: 0; border-radius: 10px; opacity: .6; } #diffRow button.on { opacity: 1; outline: 3px solid #ffd24a; } #diffRow button small { display: block; font-size: 8.5px; font-weight: 700; opacity: .85; letter-spacing: 0; }
.lvl em.lvlStars { font-style: normal; font-size: 10px; line-height: 1; letter-spacing: 1px; color: #7a5a00; } .lvl em.lvlStars u { text-decoration: none; opacity: .35; }
.funStars { margin-top: 8px; padding: 7px 10px; border-radius: 10px; border: 2px solid #ffd24a; background: #2a1f06cc; text-align: left; font-size: 12.5px; font-weight: 800; color: #b9a56a; display: grid; gap: 3px; }
.funStars div.got { color: #ffd24a; } .funStars div b { color: #7dff3a; font-size: 10px; margin-left: 4px; } .funStars h4 { margin: 0 0 2px; font-size: 13px; letter-spacing: 1px; color: #ffd24a; text-align: center; }
.funLine { margin-top: 8px; padding: 8px 10px; border-radius: 10px; border: 2px solid #3af0ff; background: #06222acc; color: #bff6ff; font-weight: 800; font-size: 13px; } .funLine b { color: #ffd24a; }
#comboBox { position: fixed; left: calc(8px + env(safe-area-inset-left, 0px)); top: calc(var(--hudH, 116px) + 34px); z-index: 5; pointer-events: none; display: none; text-align: center; font-family: inherit; min-width: 64px; }
#comboBox b { display: block; font-size: 34px; line-height: 1; font-weight: 900; color: #ffd24a; text-shadow: 0 2px 0 #7a3a00, 0 0 12px #ff9a3a; } #comboBox span { display: block; font-size: 9.5px; font-weight: 900; letter-spacing: 1px; color: #fff; text-shadow: 0 1px 2px #000; min-height: 11px; }
#comboBox i { display: block; height: 5px; margin-top: 3px; border-radius: 3px; background: #0008; overflow: hidden; } #comboBox i u { display: block; height: 100%; width: 100%; background: #ffd24a; transform-origin: left; }
#comboBox.pop b { animation: comboPop .28s ease-out; } @keyframes comboPop { 0% { transform: scale(1.9); } 100% { transform: scale(1); } }
#bossBar { position: fixed; left: 50%; top: calc(var(--hudH, 116px) + 6px); transform: translateX(-50%); z-index: 6; width: min(300px, calc(100vw - 110px)); pointer-events: none; display: none; font-family: inherit; text-align: center; }
#bossBar b { display: block; font-size: 12px; font-weight: 900; letter-spacing: 1px; color: #ff6a5a; text-shadow: 0 1px 2px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#bossBar i { display: block; height: 11px; margin-top: 2px; border-radius: 6px; border: 2px solid #ff4a3a; background: #1a0606d0; overflow: hidden; box-shadow: 0 0 10px #ff4a3a88; } #bossBar i u { display: block; height: 100%; background: linear-gradient(#ff7a5a, #c2241a); transform-origin: left; }
#bossBar em { display: block; margin-top: 2px; font-style: normal; font-size: 13px; font-weight: 900; color: #fff; text-shadow: 0 1px 2px #000; } #bossBar.low em { color: #ff5a4a; }
#funCard { position: fixed; inset: 0; z-index: 44; display: none; align-items: center; justify-content: center; background: #0a0614d8; padding: 20px; font-family: inherit; text-align: center; color: #fff; }
#funCard.show { display: flex; } #funCard h2 { margin: 0 0 6px; font-size: 30px; color: #7dff3a; text-shadow: 0 3px 0 #1f4a12; } #funCard p { margin: 0; font-size: 15px; font-weight: 800; color: #e8dcff; line-height: 1.4; } #funCard p b { color: #ffd24a; }
body.cine #comboBox, body.cine #bossBar { visibility: hidden !important; }
`;
let styled = false; function style() { if (styled) return; styled = true; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
const el = (tag, id, html) => { const e = document.createElement(tag); if (id) e.id = id; if (html) e.innerHTML = html; return e; };

// ---------- which kind of round this page is playing: 'normal', 'daily' (?daily, on today's game only) or 'endless' (?endless) ----------
export let MODE = 'normal'; let GAME = '';
export function funInit(game) { GAME = game; style(); MODE = FUN.daily && Q.has('daily') && daily().game === game ? 'daily' : FUN.endless && Q.has('endless') ? 'endless' : 'normal'; return MODE; }

// ---------- difficulty: CHILL, NORMAL or MAYHEM, kept game by game. time: the round's clock; foe: how many enemies and how
// often; hurt: what each hit costs you; coins: the score coins a round pays ----------
const DIFF = { chill: { name: 'CHILL', icon: '😌', say: 'More time, fewer enemies', time: 1.25, foe: 0.75, hurt: 0.6, coins: 0.75 }, normal: { name: 'NORMAL', icon: '🙂', say: 'The way it was made', time: 1, foe: 1, hurt: 1, coins: 1 }, mayhem: { name: 'MAYHEM', icon: '😈', say: 'Harder. Pays 50% more', time: 0.9, foe: 1.35, hurt: 1.4, coins: 1.5 } };
export const getDiff = (game = GAME) => { const d = ls('diff_' + game, 'normal'); return FUN.diff && DIFF[d] ? d : 'normal'; };
// the three buttons on a game's start screen, put in after the element `after`
export function diffPicker(after, game = GAME) { if (!FUN.diff || MODE !== 'normal' || !after) return; style(); const row = el('div', 'diffRow');
  const draw = () => { row.innerHTML = ''; for (const k of Object.keys(DIFF)) { const d = DIFF[k], b = el('button', null, d.icon + ' ' + d.name + '<small>' + d.say + '</small>'); b.className = 'ghost' + (k === getDiff(game) ? ' on' : ''); b.addEventListener('click', (e) => { e.stopPropagation(); put('diff_' + game, k); draw(); }); row.appendChild(b); } };
  draw(); after.insertAdjacentElement('afterend', row); }
// the numbers this round is played with, and a short tag for the HUD's level line ('' on NORMAL)
export function roundK(game = GAME) {
  if (MODE === 'endless') { const n = run().n; return { time: Math.max(0.7, 1 - 0.03 * n), foe: 1 + 0.12 * n, hurt: 1 + 0.08 * n, coins: 1, tag: '♾️ ' + (n + 1) }; }
  if (MODE === 'daily') { const t = daily().twist; return { time: t.time || 1, foe: t.foe || 1, hurt: t.hurt || 1, coins: 1, tag: '📅 ' + t.name }; }
  const d = DIFF[getDiff(game)]; return { time: d.time, foe: d.foe, hurt: d.hurt, coins: d.coins, tag: d === DIFF.normal ? '' : d.icon + ' ' + d.name }; }

// ---------- stars: three goals a town, each kept once it is won (a bit each, by game, era and town) ----------
const starKey = (game, n) => game + '_stars_' + getEra() + '_' + n, bitsN = (b) => (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1);
export const starBits = (game, n) => +ls(starKey(game, n), 0) || 0;
export const starTag = (game, n) => { if (!FUN.stars) return ''; const c = bitsN(starBits(game, n)); return '<em class="lvlStars">' + '★'.repeat(c) + '<u>' + '★'.repeat(3 - c) + '</u></em>'; };
// goals: [[what it says, did they do it], x3] (the first is winning). Adds the list to `host` on the score screen
export function awardStars(game, n, goals, host) { if (!FUN.stars || MODE !== 'normal') return 0; const old = starBits(game, n); let bits = old; goals.forEach(([, got], i) => { if (got) bits |= 1 << i; }); if (bits !== old) put(starKey(game, n), String(bits));
  if (host) { const box = el('div'); box.className = 'funStars'; box.innerHTML = '<h4>' + '★'.repeat(bitsN(bits)) + '☆'.repeat(3 - bitsN(bits)) + ' STARS</h4>' + goals.map(([say], i) => '<div class="' + ((bits >> i) & 1 ? 'got' : '') + '">' + ((bits >> i) & 1 ? '★' : '☆') + ' ' + say + ((bits >> i) & 1 && !((old >> i) & 1) ? '<b>NEW!</b>' : '') + '</div>').join(''); host.appendChild(box); }
  return bitsN(bits); }
export function totalStars() { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.includes('_stars_')) n += bitsN(+localStorage.getItem(k) || 0); } } catch { /* ignore */ } return n; }

// ---------- the combo meter: a big xN at the left with a bar that drains. mult: the multiplier now (1 = none); left: 0..1 of
// the time before it drops ----------
let comboEl = null, comboWas = 1, comboTxt = ''; const SAY = ['', '', 'COMBO!', 'SMASHING!', 'RAMPAGE!', 'UNSTOPPABLE!'];
export function comboHud(mult, left) { if (!FUN.combo) return; if (!comboEl) { style(); comboEl = el('div', 'comboBox', '<b></b><span></span><i><u></u></i>'); document.body.appendChild(comboEl); }
  if (mult <= 1 || left <= 0) { if (comboWas !== 1) { comboWas = 1; comboTxt = ''; comboEl.style.display = 'none'; } return; }
  if (mult !== comboWas) { const up = mult > comboWas; comboWas = mult; comboEl.style.display = 'block'; const t = 'x' + mult; if (t !== comboTxt) { comboTxt = t; comboEl.firstChild.textContent = t; comboEl.children[1].textContent = SAY[Math.min(SAY.length - 1, mult)] || ''; }
    if (up) { comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop'); buzz(0.3 + mult * 0.1); } }
  comboEl.lastChild.firstChild.style.transform = 'scaleX(' + Math.max(0, Math.min(1, left)).toFixed(2) + ')'; }

// ---------- the boss bar: its name, what it has left (0..1) and the boss clock. bossBar(null) takes it down ----------
let bossEl = null, bossKey = '';
export function bossBar(name, frac = 1, secs = 0) { if (name == null) { if (bossEl && bossKey !== '') { bossKey = ''; bossEl.style.display = 'none'; } return; } if (!bossEl) { style(); bossEl = el('div', 'bossBar', '<b></b><i><u></u></i><em></em>'); document.body.appendChild(bossEl); }
  const s = Math.max(0, Math.ceil(secs)), k = name + '|' + s; if (k !== bossKey) { bossKey = k; bossEl.style.display = 'block'; bossEl.firstChild.textContent = name; bossEl.lastChild.textContent = '⏱ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); bossEl.classList.toggle('low', s <= 15); }
  bossEl.children[1].firstChild.style.transform = 'scaleX(' + Math.max(0, Math.min(1, frac)).toFixed(3) + ')'; }
export const bossDue = (level, levels) => FUN.boss && MODE === 'normal' && level >= levels; // the last town, in an ordinary round

// ---------- random events: now and then, one thing from the game's own list happens. list: [{ run(), can() }] ----------
export function makeEvents(list) { let t = rnd(38, 55); return { reset() { t = rnd(38, 55); }, tick(dt, ok = true) { if (!FUN.events || !ok) return; t -= dt; if (t > 0) return; t = rnd(45, 70); const l = list.filter((e) => !e.can || e.can()); if (l.length) l[(Math.random() * l.length) | 0].run(); } }; }
// a meteor shower: n rocks, one every `gap` seconds. pick(): where the next lands ({ x, z }, or null to skip it); hit(x, z): what it does there
const rocks = []; let rockGeo = null, rockMat = null;
export function meteorShower(scene, n, pick, hit, gap = 0.5) { for (let i = 0; i < n; i++) rocks.push({ scene, wait: 0.6 + i * gap, pick, hit, m: null }); }
export function clearMeteors() { for (const r of rocks) if (r.m) r.scene.remove(r.m); rocks.length = 0; }
// every frame of a round: the things in here that move
export function funTick(dt) { for (let i = rocks.length - 1; i >= 0; i--) { const r = rocks[i];
  if (!r.m) { r.wait -= dt; if (r.wait > 0) continue; const p = r.pick(); if (!p) { rocks.splice(i, 1); continue; } if (!rockGeo) { rockGeo = new THREE.IcosahedronGeometry(0.4, 1); rockMat = new THREE.MeshBasicMaterial({ color: 0xffa040 }); }
    r.to = new THREE.Vector3(p.x, 0.2, p.z); r.from = new THREE.Vector3(p.x + 7, 18, p.z + 4); r.m = new THREE.Mesh(rockGeo, rockMat); r.m.scale.set(1, 1, 2.6); r.m.position.copy(r.from); r.m.lookAt(r.to); r.scene.add(r.m); r.t = 0; continue; }
  r.t += dt; const k = Math.min(1, r.t / 0.75); r.m.position.lerpVectors(r.from, r.to, k * k); if (k >= 1) { r.scene.remove(r.m); rocks.splice(i, 1); r.hit(r.to.x, r.to.z); } } }

// ---------- the phone's buzz on a big hit. In the browser only some phones do it (not iPhones); in the app it uses the app's own haptics ----------
let buzzT = 0;
export function buzz(v) { if (!FUN.buzz || !(v >= 0.25)) return; const now = performance.now(); if (now - buzzT < 140) return; buzzT = now;
  try { const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics; if (H) H.impact({ style: v > 0.7 ? 'HEAVY' : v > 0.4 ? 'MEDIUM' : 'LIGHT' }); else if (navigator.vibrate) navigator.vibrate(Math.round(12 + Math.min(1, v) * 40)); } catch { /* ignore */ } }

// ---------- the daily challenge: one game a day (they take turns), one twist, a town you have open. Winning it once pays
// coins, more as the days in a row add up ----------
export const GAMES4 = [['ta', 'tornado.html', '🌪️', 'TORNADO TIME!'], ['kj', 'kaiju.html', '👹', 'KAIJU MADNESS'], ['ar', 'airraid.html', '🧟', 'ZOMBIE AIR RAID'], ['bu', 'beamup.html', '🛸', "BEAM 'EM UP!"]];
const TWISTS = [{ name: 'RUSH HOUR', icon: '⏱️', text: 'A quarter less time on the clock.', time: 0.75 }, { name: 'SWARM', icon: '👾', text: 'Half as many enemies again.', foe: 1.5 }, { name: 'GLASS', icon: '💔', text: 'Every hit hurts double.', hurt: 2 }, { name: 'DOUBLE TROUBLE', icon: '🔥', text: 'More enemies and less time.', foe: 1.25, time: 0.87 }];
const p2 = (n) => String(n).padStart(2, '0'), dayStr = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()), dayNum = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
export function daily() { const n = dayNum(), g = GAMES4[n % 4], now = new Date(), today = dayStr(now), yest = dayStr(new Date(now.getTime() - 86400000)); let st = {}; try { st = JSON.parse(ls('daily', '{}')) || {}; } catch { st = {}; }
  return { day: today, game: g[0], page: g[1], icon: g[2], title: g[3], twist: TWISTS[(n * 7 + Math.floor(n / 4)) % TWISTS.length], done: st.done === today, streak: st.last === today || st.last === yest ? st.streak || 0 : 0 }; }
export const dailyLevel = (open, max = 5) => 1 + (dayNum() * 13 + 5) % Math.max(1, Math.min(max, open)); // one of the towns this player has open (never the boss town)
// today's challenge is won: the coins for it (once a day), and the line the score screen shows
export function dailyWon(host) { if (MODE !== 'daily') return; const d = daily(); let say; if (d.done) say = '📅 DAILY CHALLENGE beaten again. Today\'s coins are already yours: come back tomorrow.';
  else { const streak = d.streak + 1, coins = 1 + (streak % 7 === 0 ? 3 : streak % 3 === 0 ? 1 : 0); put('daily', JSON.stringify({ done: d.day, last: d.day, streak })); addCoins(coins); say = '📅 DAILY CHALLENGE BEATEN! <b>+' + coins + ' 🪙</b><br>' + streak + ' day' + (streak > 1 ? 's' : '') + ' in a row. Every 3rd day pays extra, every 7th pays big.'; }
  if (host) { const u = el('div', null, say); u.className = 'funLine'; host.appendChild(u); } }

// ---------- endless runs: town after town, each harder than the last, until you lose one. The run lives for this visit only;
// the record (towns, then score) is kept game by game ----------
const run = () => { try { return JSON.parse(sessionStorage.getItem('endless_' + GAME) || '') || { n: 0, score: 0 }; } catch { return { n: 0, score: 0 }; } }, saveRun = (r) => { try { sessionStorage.setItem('endless_' + GAME, JSON.stringify(r)); } catch { /* ignore */ } };
export const endlessLevel = (max) => { const n = run().n; return n < max ? n + 1 : max - 2 + ((n - max) % 3); }; // every town in turn, then round the three biggest
export function endlessBest(game = GAME) { try { const r = JSON.parse(ls('endless_best_' + game, '') || 'null'); return r && r.towns > 0 ? r : null; } catch { return null; } }
let card = null; function showCard(html, secs, then) { style(); if (!card) { card = el('div', 'funCard'); document.body.appendChild(card); } card.innerHTML = '<div>' + html + '</div>'; card.classList.add('show'); setTimeout(() => { card.classList.remove('show'); then(); }, secs * 1000); }
// called as a round ends. Won: the run goes on (a card, then next() starts the next town) and this returns true, so the game
// skips its score screen. Lost: the run is over; returns false and endlessLine() has what to say on the score screen
let lastRun = null;
export function endlessEnd(won, score, next) { if (MODE !== 'endless') return false; const r = run();
  if (won) { r.n++; r.score += score; saveRun(r); showCard('<h2>♾️ TOWN ' + r.n + ' CLEARED!</h2><p>Run score <b>' + r.score + '</b><br>The next town is harder.</p>', 2.6, next); return true; }
  const towns = r.n, total = r.score + score, old = endlessBest(), record = towns > 0 && (!old || towns > old.towns || (towns === old.towns && total > old.score)); /* (a run that cleared no town is no record) */ if (record) put('endless_best_' + GAME, JSON.stringify({ towns, score: total })); saveRun({ n: 0, score: 0 }); lastRun = { towns, total, record, old }; return false; }
export function endlessLine(host) { if (MODE !== 'endless' || !lastRun || !host) return; const r = lastRun, u = el('div', null, '♾️ ENDLESS RUN OVER: <b>' + r.towns + ' town' + (r.towns === 1 ? '' : 's') + '</b>, run score <b>' + r.total + '</b>.<br>' + (r.record ? '🏆 A NEW RECORD!' : r.old ? 'Your record: ' + r.old.towns + ' town' + (r.old.towns === 1 ? '' : 's') + ', ' + r.old.score + '.' : 'Clear a town to set a record.')); u.className = 'funLine'; host.appendChild(u); }
