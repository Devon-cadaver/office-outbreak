// The radio station: every song with a ▶ to play it now and a tap to take it off (or put it back on) the air, plus SKIP.
// Opens over whatever screen called it (the main menu, either game's pause menu).
import { SONGS_ALL, songName, songsOff, songState, nextSong, playSong, unlockAudio } from './audio.js';
let box = null;
function build() {
  const st = document.createElement('style'); st.textContent = `
#radioBox { position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 16px; background: #1a0f2ef8; text-align: center; overflow-y: auto; }
#radioBox.hidden { display: none; } #radioBox h2 { margin: 0; color: #3af0ff; } #radioBox .now { font-size: 13px; color: #ffd24a; min-height: 1.2em; margin: 0; }
#radioBox .list { display: grid; gap: 8px; width: min(380px, 100%); } #radioBox .row { display: flex; gap: 8px; } #radioBox .row button { margin: 0; }
#radioBox .row .play { flex: 0 0 52px; padding: 8px 0; background-color: #3af0ff; color: #1a0f2e; } #radioBox .row .tog { flex: 1; min-width: 0; font-size: 14px; padding: 8px 6px; }
#radioBox .bar { display: flex; gap: 10px; } #radioBox .bar button { margin: 0; }`; document.head.appendChild(st);
  box = document.createElement('div'); box.id = 'radioBox'; box.className = 'hidden';
  box.innerHTML = '<h2>📻 RADIO STATION</h2><p class="small" style="margin:0">▶ plays a song now. Tap a name to take it off the air; songs that are on play in a shuffle.</p><p class="now"></p><div class="list"></div><div class="bar"><button class="skip ghost">⏭ SKIP</button><button class="done">DONE</button></div>';
  document.body.appendChild(box);
  const stop = (e) => e.stopPropagation(); box.addEventListener('pointerdown', stop); box.addEventListener('click', stop);
  box.querySelector('.skip').addEventListener('click', () => { unlockAudio(); nextSong(); setTimeout(draw, 150); });
  box.querySelector('.done').addEventListener('click', () => { box.classList.add('hidden'); const s = songState(); if (s && s.src && songsOff().includes(s.src)) nextSong(); });
}
function draw() { const off = songsOff(), now = songState(), list = box.querySelector('.list'); list.innerHTML = '';
  box.querySelector('.now').textContent = now && now.src && !now.paused ? '🎵 NOW PLAYING: ' + songName(now.src) : '';
  for (const s of SONGS_ALL) { const on = !off.includes(s), row = document.createElement('div'); row.className = 'row';
    const p = document.createElement('button'); p.className = 'play'; p.textContent = '▶'; p.addEventListener('click', () => { unlockAudio(); playSong(s); setTimeout(draw, 150); });
    const t = document.createElement('button'); t.className = 'tog' + (on ? '' : ' ghost'); t.textContent = (on ? '🔊 ' : '🔇 ') + songName(s);
    t.addEventListener('click', () => { const o = songsOff(), i = o.indexOf(s); if (i >= 0) o.splice(i, 1); else if (SONGS_ALL.length - o.length > 1) o.push(s); try { localStorage.setItem('oo_radio_off', JSON.stringify(o)); } catch { /* ignore */ } draw(); });
    row.append(p, t); list.appendChild(row); } }
export function openRadio() { if (!box) build(); draw(); box.classList.remove('hidden'); }
// a RADIO STATION button on a screen (the pause menus)
export function radioButton(host, before) { const b = document.createElement('button'); b.className = 'ghost'; b.textContent = '📻 RADIO STATION'; b.addEventListener('click', (e) => { e.stopPropagation(); openRadio(); }); host.insertBefore(b, before || null); return b; }
