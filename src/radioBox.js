// The radio: a music player. On top, what is playing and how far through it is; then the buttons (shuffle, back, play or
// pause, next, repeat) and the volume; then every song in a list. Tap a song to play it now. Its heart keeps it in (or
// takes it out of) the mix that plays by itself; at least one song always stays in.
// Opens over whatever screen called it (the main menu, a game's SOUNDS menu). The games look for #radioBox to keep the
// music playing while it is open on a paused game, so it keeps that id and the 'hidden' class.
import { SONGS_ALL, songName, songsOff, songState, nextSong, prevSong, playSong, menuMusic, unlockAudio, musicVol, setMusicVol, isRadioPaused, toggleRadioPause, isShuffle, toggleShuffle, radioRepeat, toggleRadioRepeat, isMusicMuted, setMusicMuted } from './audio.js';
// a picture for each song's card (a new song without one gets the note)
const ICON = { 'tornado-alley': '🌪️', 'twister-vs-army': '🪖', 'clean-slate': '🧹', 'feeding-ground': '👹', 'stomp-the-block': '🦶', 'saving-you-the-trouble': '😇', 'tatsumaki-justice': '⚔️', 'my-little-disaster': '💥', 'my-little-disaster-2': '🎀', 'napalm-requiem': '🔥', 'beam-beam-baby': '🛸', 'little-green-man-at-the-rodeo': '🤠' };
const iconOf = (src) => ICON[src.split('/').pop().replace('.mp3', '')] || '🎵', mmss = (t) => (isFinite(t) && t > 0 ? Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') : '0:00');
let box = null; const q = (sel) => box.querySelector(sel);
function build() {
  const st = document.createElement('style'); st.textContent = `
#radioBox { position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; background: #1a0f2e; text-align: center; }
#radioBox.hidden { display: none; } body.radioOpen .fsBtn { display: none; } /* the FULL SCREEN button would sit on DONE */ #radioBox > * { width: min(400px, 100%); box-sizing: border-box; flex: none; margin: 0; }
#radioBox h2 { color: #3af0ff; font-size: 22px; }
#radioBox .np { display: flex; gap: 12px; align-items: center; background: #0f0a1c; border: 2px solid #3af0ff; border-radius: 14px; padding: 10px; text-align: left; }
#radioBox .art { width: 60px; height: 60px; border-radius: 12px; background: linear-gradient(135deg, #3af0ff, #8a5ad8); display: flex; align-items: center; justify-content: center; font-size: 32px; flex: none; }
#radioBox .np small { display: block; color: #ffd24a; font-size: 11px; font-weight: 800; letter-spacing: 1px; } #radioBox .np b { display: block; font-size: 16px; line-height: 1.15; }
#radioBox .prog { height: 7px; border-radius: 4px; background: #0f0a1c; overflow: hidden; } #radioBox .prog i { display: block; height: 100%; width: 0; background: #3af0ff; }
#radioBox .times { display: flex; justify-content: space-between; font-size: 11px; color: #9a8cc0; margin-top: -5px; }
#radioBox .ctl { display: flex; justify-content: center; align-items: center; gap: 12px; }
#radioBox .ctl button { margin: 0; padding: 0; width: 48px; height: 48px; border-radius: 50%; font-size: 19px; display: flex; align-items: center; justify-content: center; min-width: 0; }
#radioBox .ctl .pp { width: 64px; height: 64px; font-size: 26px; } #radioBox .ctl .sm { width: 40px; height: 40px; font-size: 15px; opacity: .5; } #radioBox .ctl .sm.on { opacity: 1; border-color: #3af0ff; box-shadow: 0 0 10px #3af0ff99; }
#radioBox .vol { display: flex; align-items: center; gap: 10px; color: #3af0ff; font-size: 14px; font-weight: bold; } #radioBox .vol input { flex: 1; min-width: 0; height: 28px; margin: 0; accent-color: #3af0ff; } #radioBox .vol b { flex: 0 0 44px; text-align: right; }
#radioBox .hint { font-size: 11.5px; color: #9a8cc0; } #radioBox .off1 { color: #ffd24a; font-size: 12.5px; font-weight: 800; }
#radioBox .list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: grid; gap: 6px; align-content: start; -webkit-overflow-scrolling: touch; touch-action: pan-y; padding: 2px; scrollbar-width: thin; scrollbar-color: #5a3a9a transparent; }
#radioBox .row { display: flex; align-items: center; border-radius: 10px; background: #221538; }
#radioBox .row button { margin: 0; background: none; border: 0; box-shadow: none; color: #fff; border-radius: 10px; transform: none; }
#radioBox .row .heart { flex: 0 0 44px; height: 42px; padding: 0; font-size: 18px; color: #ff5a8a; }
#radioBox .row .name { flex: 1; min-width: 0; display: flex; justify-content: space-between; align-items: center; gap: 8px; text-align: left; font-size: 13.5px; font-weight: 700; padding: 11px 12px 11px 2px; } #radioBox .row .name em { font-style: normal; color: #3af0ff; flex: none; }
#radioBox .row.off .heart { color: #6a5a88; } #radioBox .row.off .name { color: #8a7aa8; }
#radioBox .row.playing { outline: 2px solid #ffd24a; background: #33240f; }`; document.head.appendChild(st);
  box = document.createElement('div'); box.id = 'radioBox'; box.className = 'hidden';
  box.innerHTML = '<h2>📻 RADIO</h2><div class="np"><div class="art">🎵</div><div><small>NOW PLAYING</small><b class="title"></b></div></div><div class="prog"><i></i></div><div class="times"><span class="t0">0:00</span><span class="t1">0:00</span></div>'
    + '<div class="ctl"><button class="ghost sm shuf" title="Shuffle">🔀</button><button class="ghost prev" title="Back">⏮</button><button class="pp" title="Play or pause">▶</button><button class="ghost next" title="Next song">⏭</button><button class="ghost sm rep" title="Repeat this song">🔁</button></div>'
    + '<label class="vol">🔉<input type="range" min="0" max="100" step="5"><b></b></label><p class="hint">Tap a song to play it. ♥ keeps it in the mix.</p><div class="list"></div><button class="done">DONE</button>';
  document.body.appendChild(box); setInterval(() => { if (!box.classList.contains('hidden')) mark(); }, 500);
  for (const ev of ['pointerdown', 'click', 'touchstart', 'touchmove']) box.addEventListener(ev, (e) => e.stopPropagation());
  // pressing play, back, next or a song means "I want to hear it": the sound wakes up and MUSIC comes on if it was off
  const hear = () => { unlockAudio(); if (isMusicMuted()) setMusicMuted(false); }, soon = () => setTimeout(draw, 150);
  q('.shuf').addEventListener('click', () => { toggleShuffle(); draw(); });
  q('.rep').addEventListener('click', () => { toggleRadioRepeat(); draw(); });
  q('.prev').addEventListener('click', () => { hear(); prevSong(); soon(); });
  q('.next').addEventListener('click', () => { hear(); nextSong(); soon(); });
  q('.pp').addEventListener('click', () => { const s = songState(), playing = !!s && !s.paused && !isRadioPaused(); hear(); if (playing || isRadioPaused()) toggleRadioPause(); else menuMusic(); soon(); });
  const vol = q('.vol input'); vol.addEventListener('input', () => { unlockAudio(); setMusicVol(vol.value / 100); q('.vol b').textContent = vol.value + '%'; });
  q('.done').addEventListener('click', () => { box.classList.add('hidden'); document.body.classList.remove('radioOpen'); const s = songState(); if (s && s.src && songsOff().includes(s.src)) nextSong(); });
  q('.list').addEventListener('click', (e) => { const row = e.target.closest('.row'); if (!row) return; const src = row.dataset.src;
    if (e.target.closest('.heart')) { const o = songsOff(), i = o.indexOf(src); if (i >= 0) o.splice(i, 1); else if (SONGS_ALL.length - o.length > 1) o.push(src); try { localStorage.setItem('oo_radio_off', JSON.stringify(o)); } catch { /* ignore */ } draw(); return; }
    hear(); playSong(src); soon(); });
}
// what changes by itself while the box is open: the card, the progress, the play button, which row is lit
function mark() { const s = songState(), on = !!s && !!s.src, playing = on && !s.paused && !isRadioPaused();
  q('.title').textContent = on ? songName(s.src) : 'NOTHING YET'; q('.art').textContent = on ? iconOf(s.src) : '🎵'; q('.np small').textContent = playing ? 'NOW PLAYING' : isMusicMuted() ? 'MUSIC IS OFF' : 'PAUSED';
  const dur = on ? s.dur || 0 : 0, t = on ? s.t || 0 : 0; q('.prog i').style.width = (dur > 0 ? Math.min(100, t / dur * 100) : 0).toFixed(1) + '%'; q('.t0').textContent = mmss(t); q('.t1').textContent = mmss(dur);
  q('.pp').textContent = playing ? '⏸' : '▶'; for (const r of box.querySelectorAll('.row')) { const now = on && r.dataset.src === s.src; r.classList.toggle('playing', now); r.querySelector('em').textContent = now && playing ? '♪' : '▶'; } }
function draw() { const off = songsOff(), list = q('.list'), top = list.scrollTop;
  q('.shuf').classList.toggle('on', !!isShuffle()); q('.rep').classList.toggle('on', !!radioRepeat());
  const pct = Math.round(musicVol() * 100); q('.vol input').value = pct; q('.vol b').textContent = pct + '%';
  list.innerHTML = SONGS_ALL.map((src) => '<div class="row' + (off.includes(src) ? ' off' : '') + '" data-src="' + src + '"><button class="heart" title="In the mix, or out of it">' + (off.includes(src) ? '♡' : '♥') + '</button><button class="name"><span>' + songName(src) + '</span><em>▶</em></button></div>').join('');
  list.scrollTop = top; mark(); }
export function openRadio() { if (!box) build(); draw(); box.classList.remove('hidden'); document.body.classList.add('radioOpen'); const now = q('.row.playing'); if (now) now.scrollIntoView({ block: 'nearest' }); }
// a RADIO STATION button on a screen (the pause menus' SOUNDS menu looks for it by these words)
export function radioButton(host, before) { const b = document.createElement('button'); b.className = 'ghost'; b.textContent = '📻 RADIO STATION'; b.addEventListener('click', (e) => { e.stopPropagation(); openRadio(); }); host.insertBefore(b, before || null); return b; }
