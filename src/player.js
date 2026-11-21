// The PLAYER card: a player level, an emblem that grows with what you have beaten, and badges (locked until earned).
// Everything is worked out from the saves the games already keep (towns opened per game and era, skins owned) plus the
// wins recorded since (progress.js markWon), so nothing new has to be earned twice. Shown from the main menu (a chip
// with the emblem and level) and from each game's pause screen (the PLAYER button).
import { ERAS, TOWNS, winsList } from './progress.js';
import { SKINS, getOwned } from './skins.js';

export const GAMES = [
  { k: 'ta', name: 'Tornado Time!', icon: '🌪️', word: 'TORNADO', col: '#7dff3a' },
  { k: 'kj', name: 'Kaiju Madness', icon: '🦖', word: 'KAIJU', col: '#ff9a5a' },
  { k: 'ar', name: 'Zombie Air Raid', icon: '🧟', word: 'ZOMBIE', col: '#d8f06a' },
  { k: 'bu', name: "Beam 'Em Up!", icon: '🛸', word: 'ALIEN', col: '#9affc8' },
];
const ERA_ICON = { past: '🤠', present: '🏙️', future: '🚀' };
const N = TOWNS.length;
const num = (k) => { try { return +localStorage.getItem(k) || 0; } catch { return 0; } };
const openIn = (g, era) => num(g + '_level' + (era === 'present' ? '' : '_' + era)); // the furthest town opened in that game and era

// beaten[g][era] = [true/false per town]: a town counts once it has been cleared (recorded) or the next one is open
export function progress() { const wins = new Set(winsList()), out = {};
  for (const { k } of GAMES) { out[k] = {}; for (const [era] of ERAS) { const op = openIn(k, era); out[k][era] = TOWNS.map((_, i) => wins.has(k + ':' + era + ':' + (i + 1)) || i + 1 < op); } }
  return out; }
const allTrue = (a) => a.every(Boolean), anyTrue = (a) => a.some(Boolean);

// the skin collections: one per kind of skin in the shop (each aircraft on its own)
const SKIN_SETS = [['tornado', 'Tornadoes', '🌪️'], ['kaiju', 'Monsters', '🦖'], ['craft:bomber', 'Bombers', '✈️'], ['craft:heli', 'Helis', '🚁'], ['craft:ufo', 'Saucers', '🛸'], ['craft:walker', 'Walkers', '🦿'], ['horde', 'Zombie hordes', '🧟'], ['npc', 'Townsfolk', '👥'], ['player', 'Heroes', '🦸'], ['car', 'Cars', '🚗'], ['fx', 'Effects', '✨']];
const setOf = (s) => (s.cat === 'craft' ? 'craft:' + s.craft : s.cat);

export function stats() { const P = progress(), own = new Set(getOwned()), beaten = GAMES.reduce((n, { k }) => n + ERAS.reduce((m, [e]) => m + P[k][e].filter(Boolean).length, 0), 0);
  const sets = SKIN_SETS.map(([id, name, icon]) => { const l = SKINS.filter((s) => setOf(s) === id); return { id, name, icon, have: l.filter((s) => own.has(s.id)).length, all: l.length }; }).filter((x) => x.all);
  const skins = SKINS.filter((s) => own.has(s.id)).length;
  return { P, beaten, total: GAMES.length * ERAS.length * N, sets, skins, skinTotal: SKINS.length }; }

// the badges: { id, name, icon, how (what to do), col, got }
export function badges(S = stats()) { const { P } = S, B = [], add = (id, name, icon, how, col, got) => B.push({ id, name, icon, how, col, got: !!got });
  const champ = (k) => ERAS.some(([e]) => allTrue(P[k][e]));
  add('first', 'First Win', '⭐', 'Clear any town in any game', '#ffd24a', S.beaten > 0);
  for (const g of GAMES) { const p = P[g.k];
    add(g.k + '_win', g.name + ': First Town', g.icon, 'Clear a town in ' + g.name, g.col, ERAS.some(([e]) => anyTrue(p[e])));
    for (const [e, en] of ERAS) add(g.k + '_' + e, g.name + ': ' + en, ERA_ICON[e], 'Clear all ' + N + ' towns of ' + g.name + ' in the ' + en, g.col, allTrue(p[e]));
    add(g.k + '_legend', g.name + ' Legend', '👑', 'Clear every town of ' + g.name + ' in all three eras', g.col, ERAS.every(([e]) => allTrue(p[e]))); }
  for (const [e, en] of ERAS) add('era_' + e, en + ' Hero', ERA_ICON[e], 'Clear every town of every game in the ' + en, '#3af0ff', GAMES.every((g) => allTrue(P[g.k][e])));
  add('all4', 'Four Disasters', '🌀', 'Clear all ' + N + ' towns of every game (any era)', '#ff5ae0', GAMES.every((g) => champ(g.k)));
  add('everything', 'The End of the World', '☄️', 'Clear every town, in every era, in every game', '#ff3a2a', S.beaten === S.total);
  for (const s of S.sets) add('skins_' + s.id, 'All ' + s.name, s.icon, 'Own every one of the ' + s.all + ' ' + s.name.toLowerCase() + ' skins', '#c9a6ff', s.have === s.all);
  for (const n of [10, 50, 100, 200]) add('own' + n, n + ' Skins', '🎨', 'Own ' + n + ' skins', '#ffd24a', S.skins >= n);
  add('allskins', 'Every Skin', '💎', 'Own every skin in the shop', '#7dfffa', S.skins >= S.skinTotal);
  const lvl = levelOf(S, B.filter((b) => b.got).length);
  for (const n of [10, 25, 50, 100]) add('lvl' + n, 'Level ' + n, '🏅', 'Reach player level ' + n, '#ffa83a', lvl >= n);
  return B; }

// the player level: one for every town cleared (per game and era), one for every 5 skins owned, one for every badge
const levelOf = (S, nBadges) => 1 + S.beaten + Math.floor(S.skins / 5) + nBadges;
export function player() { const S = stats(), B0 = badges(S), base = B0.filter((b) => b.got && !b.id.startsWith('lvl')).length, lv = levelOf(S, base), B = badges(S), got = B.filter((b) => b.got).length;
  const done = GAMES.filter((g) => ERAS.some(([e]) => allTrue(S.P[g.k][e]))); return { S, B, got, level: levelOf(S, got), done, title: titleOf(done), lv }; }

// the emblem's name: the games you have beaten (all towns in an era), put together. None yet: a rookie
function titleOf(done) { if (!done.length) return 'ROOKIE'; if (done.length === 4) return 'APOCALYPSE'; const w = done.map((g) => g.word), last = w.includes('TORNADO') ? 'TORNADO' : w[w.length - 1];
  return [...w.filter((x) => x !== last), last].join(' '); }
const TIERS = [[1, ['#b08050', '#5a3a1a'], 'BRONZE'], [15, ['#d8e0ea', '#6a7488'], 'SILVER'], [40, ['#ffd24a', '#a8701a'], 'GOLD'], [80, ['#7dffb0', '#1a8a5a'], 'EMERALD'], [130, ['#c9a6ff', '#5a2fa8'], 'COSMIC']];
const tierOf = (lv) => TIERS.reduce((t, x) => (lv >= x[0] ? x : t), TIERS[0]);

// the emblem: a shield in the tier's metal, the beaten games' icons on it (the first big, the others round it), the
// level on a ribbon under it
let uid = 0;
export function emblemSVG(pl, size = 96) { const t = tierOf(pl.level), id = 'em' + (uid++), icons = pl.done.length ? pl.done.map((g) => g.icon) : ['❔'];
  const small = icons.slice(1).map((ic, i, a) => '<text x="' + (50 + (i - (a.length - 1) / 2) * 22) + '" y="84" font-size="15" text-anchor="middle">' + ic + '</text>').join('');
  return '<svg class="emblem" viewBox="0 0 100 112" width="' + size + '" height="' + Math.round(size * 1.12) + '" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="' + id + 'm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + t[1][0] + '"/><stop offset="1" stop-color="' + t[1][1] + '"/></linearGradient>' +
    '<radialGradient id="' + id + 'g" cx="0.5" cy="0.38" r="0.6"><stop offset="0" stop-color="#3a2a5a"/><stop offset="1" stop-color="#120a1f"/></radialGradient></defs>' +
    '<path d="M50 3 L92 17 L88 62 Q82 90 50 104 Q18 90 12 62 L8 17 Z" fill="url(#' + id + 'm)" stroke="#120a1f" stroke-width="2"/>' +
    '<path d="M50 11 L84 22 L81 61 Q76 84 50 96 Q24 84 19 61 L16 22 Z" fill="url(#' + id + 'g)"/>' +
    (pl.done.length === 4 ? '<circle cx="50" cy="50" r="30" fill="none" stroke="' + t[1][0] + '" stroke-width="1.5" stroke-dasharray="3 4" opacity=".8"/>' : '') +
    '<text x="50" y="' + (icons.length > 1 ? 54 : 62) + '" font-size="' + (icons.length > 1 ? 30 : 38) + '" text-anchor="middle">' + icons[0] + '</text>' + small +
    '<path d="M14 92 L86 92 L80 104 L86 110 L14 110 L20 104 Z" fill="' + t[1][1] + '" stroke="#120a1f" stroke-width="1.5"/>' +
    '<text x="50" y="105.5" font-size="11" font-weight="900" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif">LVL ' + pl.level + '</text></svg>'; }

// one badge: a round medal in its colour; locked ones grey, with a padlock
function medal(b) { return '<div class="pbMedal' + (b.got ? '' : ' lock') + '" title="' + b.how.replace(/"/g, '') + '"><div class="pbDisc" style="--c:' + b.col + '"><span>' + b.icon + '</span>' + (b.got ? '' : '<i>🔒</i>') + '</div><b>' + b.name + '</b><small>' + b.how + '</small></div>'; }

const CSS = `#pbCard { position: fixed; inset: 0; z-index: 60; background: #0b0614f2; overflow-y: auto; -webkit-overflow-scrolling: touch; color: #fff; font-family: system-ui, sans-serif;
  padding: max(14px, env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(14px, env(safe-area-inset-left, 0px)); box-sizing: border-box; }
#pbCard .pbIn { max-width: 640px; margin: 0 auto; display: grid; gap: 14px; }
#pbCard .pbHead { display: flex; gap: 14px; align-items: center; padding: 12px; border-radius: 16px; background: linear-gradient(135deg, #2a1a4a, #120a1f); border: 2px solid #5a2f80; }
#pbCard .pbHead h2 { margin: 0; font-size: 22px; letter-spacing: 1px; color: #7dff3a; } #pbCard .pbHead p { margin: 4px 0 0; font-size: 12px; color: #c9a6ff; line-height: 1.4; }
#pbCard .pbClose { position: sticky; top: 0; justify-self: end; z-index: 2; padding: 8px 16px; margin: 0; font-size: 14px; }
#pbCard h3 { margin: 4px 0 0; font-size: 13px; letter-spacing: 2px; color: #c9a6ff; }
#pbCard .pbGame { padding: 8px 10px; border-radius: 12px; background: #1a0f2ecc; border: 2px solid #3a2a5a; display: grid; gap: 4px; }
#pbCard .pbGame > b { font-size: 14px; } #pbCard .pbEra { display: flex; align-items: center; gap: 6px; font-size: 12px; } #pbCard .pbEra em { font-style: normal; width: 86px; color: #c9a6ff; flex: none; }
#pbCard .pbDots { display: grid; grid-template-columns: repeat(${N}, 1fr); gap: 3px; flex: 1; } #pbCard .pbDots i { font-style: normal; text-align: center; font-size: 10px; padding: 3px 0; border-radius: 6px; background: #ffffff12; color: #ffffff55; }
#pbCard .pbDots i.y { background: #7dff3a; color: #120a1f; font-weight: 900; }
#pbCard .pbGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
#pbCard .pbMedal { display: grid; justify-items: center; gap: 3px; text-align: center; } #pbCard .pbMedal b { font-size: 11px; line-height: 1.15; } #pbCard .pbMedal small { font-size: 9.5px; color: #c9a6ffcc; line-height: 1.2; }
#pbCard .pbDisc { position: relative; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; font-size: 28px; background: radial-gradient(circle at 35% 30%, #fff8, var(--c) 40%, #120a1f 100%); border: 3px solid var(--c); box-shadow: 0 0 14px var(--c), inset 0 -4px 8px #0008; }
#pbCard .pbMedal.lock .pbDisc { filter: grayscale(1) brightness(.45); box-shadow: none; } #pbCard .pbMedal.lock b { color: #ffffff77; }
#pbCard .pbDisc i { position: absolute; right: -4px; bottom: -4px; font-style: normal; font-size: 18px; filter: none; }
#pbCard .pbSets { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; font-size: 12px; } #pbCard .pbSets div { padding: 6px 8px; border-radius: 10px; background: #1a0f2ecc; border: 1px solid #3a2a5a; }
.pbChip { display: inline-flex; align-items: center; gap: 6px; } .pbChip svg { flex: none; }`;
function style() { if (document.getElementById('pbCss')) return; const s = document.createElement('style'); s.id = 'pbCss'; s.textContent = CSS; document.head.appendChild(s); }

// the full card: the emblem and level, the towns cleared in every game and era, the skin collections, every badge
export function openPlayerCard() { style(); const pl = player(), S = pl.S; let el = document.getElementById('pbCard'); if (!el) { el = document.createElement('div'); el.id = 'pbCard'; document.body.appendChild(el); }
  const games = GAMES.map((g) => '<div class="pbGame" style="border-color:' + g.col + '66"><b style="color:' + g.col + '">' + g.icon + ' ' + g.name + '</b>' + ERAS.map(([e, en]) => '<div class="pbEra"><em>' + ERA_ICON[e] + ' ' + en + '</em><div class="pbDots">' + S.P[g.k][e].map((y, i) => '<i class="' + (y ? 'y' : '') + '">' + (y ? '✓' : i + 1) + '</i>').join('') + '</div></div>').join('') + '</div>').join('');
  const sets = S.sets.map((s) => '<div>' + s.icon + ' ' + s.name + ': <b>' + s.have + ' / ' + s.all + '</b></div>').join('');
  el.innerHTML = '<div class="pbIn"><button class="ghost pbClose">✕ CLOSE</button><div class="pbHead">' + emblemSVG(pl, 92) + '<div><h2>' + pl.title + '</h2><p><b style="color:#fff">PLAYER LEVEL ' + pl.level + '</b><br>' + S.beaten + ' / ' + S.total + ' towns cleared · ' + S.skins + ' / ' + S.skinTotal + ' skins · ' + pl.got + ' / ' + pl.B.length + ' badges</p><p>Clear all the towns of a game to add it to your emblem.</p></div></div>' +
    '<h3>TOWNS CLEARED</h3>' + games + '<h3>SKINS</h3><div class="pbSets">' + sets + '</div><h3>BADGES · ' + pl.got + ' / ' + pl.B.length + '</h3><div class="pbGrid">' + [...pl.B.filter((b) => b.got), ...pl.B.filter((b) => !b.got)].map(medal).join('') + '</div></div>';
  el.classList.remove('hidden'); el.style.display = 'block'; el.querySelector('.pbClose').addEventListener('click', (e) => { e.stopPropagation(); el.style.display = 'none'; });
  el.addEventListener('pointerdown', (e) => e.stopPropagation()); el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true }); }

// a PLAYER button (the pause screens): the small emblem, the level, and the card on a tap
export function playerButton(host, before = null) { if (!host) return; style(); const b = document.createElement('button'); b.className = 'ghost pbChip'; b.id = 'pbBtn';
  const draw = () => { const pl = player(); b.innerHTML = emblemSVG(pl, 26) + '<span>PLAYER · LVL ' + pl.level + '</span>'; };
  draw(); addEventListener('oo-progress', draw); b.addEventListener('click', (e) => { e.stopPropagation(); openPlayerCard(); });
  if (before && before.parentNode === host) host.insertBefore(b, before); else host.appendChild(b); return { el: b, draw }; }
