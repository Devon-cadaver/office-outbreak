// Sound effects synthesized with WebAudio, and the radio station's songs.
let ctx = null, master = null, musicSw = null, noiseBuf = null, muted = false, musicMuted = false;
export function setMuted(v) { muted = v; if (FRAME) FRAME.setMuted(v); if (master) master.gain.value = muted ? 0 : 0.9; try { localStorage.setItem("oo_mute", muted ? "1" : "0"); } catch { /* ignore */ } }
export function isMuted() { return muted; }
export function audioState() { return ctx ? ctx.state : "none"; }
try { muted = localStorage.getItem("oo_mute") === "1"; musicMuted = localStorage.getItem("oo_music_off") === "1"; } catch { /* ignore */ }
// music has its own switch, separate from the sound effects
export function setMusicMuted(v) { musicMuted = v; if (FRAME) FRAME.setMusicMuted(v); if (musicSw) musicSw.gain.value = musicMuted ? 0 : 1; if (song) { song.muted = musicMuted; if (!musicMuted && song.paused && !radioPaused) song.play().catch(() => {}); } try { localStorage.setItem("oo_music_off", musicMuted ? "1" : "0"); } catch { /* ignore */ } }
export function unlockAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    musicSw = ctx.createGain(); musicSw.gain.value = musicMuted ? 0 : 1; musicSw.connect(ctx.destination); /* music has its own path: SOUND off mutes effects only */
    const len = ctx.sampleRate * 0.5; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  // iPad/iPhone: play as a game ('playback'), not as page sound that the silent setting mutes; the in-game toggle is the mute
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }
  if (ctx.state !== 'running' && !sfxPaused) ctx.resume().catch(() => {});
}
// Safari can pause the sound mid-game ('suspended' or 'interrupted', e.g. around full screen changes); any tap wakes it
for (const ev of ['pointerup', 'touchend', 'click']) addEventListener(ev, () => { if (ctx && ctx.state !== 'running' && !sfxPaused) ctx.resume().catch(() => {}); }, true);
// a paused game is silent: every sound in flight (explosions, wind, engines) freezes where it is and carries on when the game does,
// and nothing new starts meanwhile
let sfxPaused = false;
export function setSfxPaused(on) { on = !!on; if (on === sfxPaused) return; sfxPaused = on; if (!ctx) return; if (on) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); }
export function quietWhilePaused(o) { for (const k of Object.keys(o)) { const f = o[k]; if (typeof f === 'function') o[k] = (...a) => (sfxPaused ? undefined : f(...a)); } }
// 🔊 / 🔇 button on the given screens (placed above their tutorial / menu buttons), all kept in step
export function soundToggle(...hosts) {
  const btns = [];
  const draw = () => { for (const b of btns) { const m = b.dataset.k === 'm', off = m ? musicMuted : muted; b.innerHTML = '<i class="sIc">' + (m ? '🎵' : '🔊') + '</i><span class="sTx">' + (m ? 'MUSIC' : 'SOUND') + ': ' + (off ? 'OFF' : 'ON') + '</span>'; b.classList.toggle('off', off); } }; /* (a big icon and a short word, so ON and OFF are the same size) */
  for (const h of hosts) { if (!h) continue; const row = document.createElement('div'); row.className = 'soundRow';
    const b = document.createElement('button'); b.className = 'ghost soundBtn';
    b.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); setMuted(!muted); if (!muted) sfx.pickup(); draw(); });
    const m = document.createElement('button'); m.className = 'ghost soundBtn'; m.dataset.k = 'm';
    m.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); setMusicMuted(!musicMuted); draw(); });
    row.append(b, m); h.insertBefore(row, h.querySelector('.howRow, .menuBtn')); btns.push(b, m); }
  draw();
}
function tone(freq, dur, type = 'square', vol = 0.08, slide = 0, dest = master, when = 0) {
  if (!ctx) return; const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur);
}
function noise(dur, vol = 0.1, freq = 1200, q = 1) {
  if (!ctx) return; const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur);
}
let stepFlip = false, coinT = 0, crunchT = 0;
// every button in the game clicks when pressed
// any tap also wakes the radio, which lives in the outer frame, in case iOS paused it
if (typeof document !== 'undefined') document.addEventListener('pointerdown', (e) => { if (e.target && e.target.closest && e.target.closest('button')) sfx.click(); try { if (FRAME && FRAME.wake) FRAME.wake(); } catch { /* ignore */ } }, true);
export const sfx = {
  throw: () => tone(700, 0.08, 'triangle', 0.05, -300),
  hit: () => tone(200, 0.1, 'square', 0.06, -100),
  kill: () => { tone(300, 0.15, 'sawtooth', 0.06, -200); setTimeout(() => tone(150, 0.2, 'sawtooth', 0.05, -100), 60); },
  hurt: () => tone(120, 0.25, 'sawtooth', 0.1, -60),
  help: (vol = 0.05) => { tone(660, 0.12, 'square', vol); setTimeout(() => tone(880, 0.2, 'square', vol, -20), 130); },
  // caught by a zombie: thud + scream-ish slide
  caught: () => { noise(0.25, 0.25, 300, 0.7); tone(220, 0.5, 'sawtooth', 0.12, 300); setTimeout(() => tone(90, 0.4, 'square', 0.1, -50), 120); },
  step: () => { stepFlip = !stepFlip; noise(0.06, 0.07, stepFlip ? 900 : 700, 2); },
  groan: () => { const f = 70 + Math.random() * 40; tone(f, 0.6, 'sawtooth', 0.05, 25); tone(f * 1.5, 0.5, 'triangle', 0.03, -15); },
  pickup: () => { tone(520, 0.08, 'square', 0.05); setTimeout(() => tone(780, 0.1, 'square', 0.05), 80); setTimeout(() => tone(1040, 0.15, 'square', 0.05), 160); },
  wave: () => { tone(440, 0.12, 'square', 0.05); setTimeout(() => tone(660, 0.12, 'square', 0.05), 120); setTimeout(() => tone(880, 0.2, 'square', 0.05), 240); },
  boom: () => { noise(0.9, 0.6, 140, 0.4); tone(48, 1.1, 'sawtooth', 0.25, -20); setTimeout(() => noise(0.5, 0.25, 900, 0.8), 60); },
  whoosh: () => { noise(0.35, 0.12, 600, 0.6); },
  // a button being pushed in: a short, soft thock
  click: () => { tone(1500, 0.025, 'square', 0.018); tone(420, 0.06, 'triangle', 0.04, -180); },
  // points: a soft two-note coin blip that climbs with the combo; at most four a second so it stays in the background
  coin: (chain = 0) => { if (!ctx || ctx.currentTime - coinT < 0.25) return; coinT = ctx.currentTime; const k = Math.pow(1.05, Math.min(chain, 10)); tone(988 * k, 0.04, 'triangle', 0.016); tone(1319 * k, 0.08, 'triangle', 0.014, 0, master, 0.04); },
  // a power-up: a quick rising arpeggio
  power: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, 'square', 0.03, 0, master, i * 0.06)); tone(1568, 0.22, 'triangle', 0.035, 0, master, 0.24); },
  // a giant footstep (deeper for a bigger monster) and a wing beat
  // a giant footstep: a mid-range thud you can hear on a phone speaker (deep bass alone doesn't play on phones), deeper as it grows
  stomp: (size = 1) => { const f = Math.max(70, 150 - size * 8); tone(f, 0.16, 'triangle', 0.16, -f * 0.5); noise(0.12, 0.2, 260, 0.8); tone(f * 2.2, 0.05, 'square', 0.03, -f); },
  // a building coming down: a gravelly crunch; throttled so a row of houses doesn't stack into noise
  crunch: (big = false) => { if (!ctx || ctx.currentTime - crunchT < 0.06) return; crunchT = ctx.currentTime; noise(big ? 0.45 : 0.28, big ? 0.32 : 0.22, 380 + Math.random() * 300, 0.6); tone(big ? 90 : 130, 0.2, 'sawtooth', 0.05, -50); },
  flap: () => { noise(0.18, 0.12, 520, 0.7); tone(180, 0.12, 'triangle', 0.05, -60); },
  laser: () => { tone(1600, 0.2, 'sawtooth', 0.035, -1300); tone(800, 0.16, 'square', 0.02, -600); },
  // the big targets going up, each in its own way: a burst tank, a fire engine's two-tone horn, a police whoop, a firework, a balloon
  splash: () => { noise(1.1, 0.4, 700, 0.5); noise(1.6, 0.22, 2600, 0.6); tone(90, 0.5, 'sine', 0.12, -40); },
  neenaw: () => { for (let i = 0; i < 6; i++) tone(i % 2 ? 520 : 660, 0.26, 'square', 0.045, 0, master, i * 0.27); },
  whoop: () => { for (let i = 0; i < 4; i++) tone(520, 0.3, 'sawtooth', 0.04, 900, master, i * 0.32); },
  firework: () => { noise(0.25, 0.3, 1800, 0.8); tone(160, 0.3, 'triangle', 0.08, -90); setTimeout(() => noise(0.5, 0.1, 5200, 2), 90); },
  pop: () => noise(0.06, 0.12, 2400, 1.5),
  honk: () => { tone(392, 0.1, 'sawtooth', 0.05, -30); tone(311, 0.2, 'sawtooth', 0.055, -40, master, 0.12); }, // a clown's horn: two notes, the second lower
  // a ghost's wail, a radar ping, muck landing, a short circuit, the power winding down, a radio's dying static
  ghost: () => { tone(880, 1.4, 'sine', 0.05, -520); tone(660, 1.6, 'sine', 0.04, -380, master, 0.15); noise(1.2, 0.05, 500, 3); },
  ping: (i = 0) => tone(1500 - i * 60, 0.22, 'sine', 0.05, -250),
  splat: () => { noise(0.5, 0.35, 300, 0.6); tone(70, 0.4, 'sawtooth', 0.1, -30); },
  zap: () => { noise(0.14, 0.22, 3200, 3); tone(110, 0.16, 'square', 0.05, 60); },
  powerdown: () => tone(420, 1.3, 'sawtooth', 0.06, -370),
  static: () => { noise(1.3, 0.28, 3400, 0.4); tone(1900, 0.9, 'sawtooth', 0.03, -1600); },
  over: () => { tone(300, 0.3, 'sawtooth', 0.08, -150); setTimeout(() => tone(200, 0.5, 'sawtooth', 0.08, -150), 250); },
};

// ---------- seeding planes: an air-raid siren when one is on its way, and a propeller drone that swells as it closes ----------
// siren: a wailing rise and fall, twice, through a soft low-pass so it reads as distant
export function siren(vol = 0.06) {
  if (!ctx) return; const t = ctx.currentTime; const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o2.type = 'triangle'; f.type = 'lowpass'; f.frequency.value = 1400;
  for (const osc of [o, o2]) { const k = osc === o ? 1 : 1.5; osc.frequency.setValueAtTime(280 * k, t); for (let i = 0; i < 2; i++) { osc.frequency.linearRampToValueAtTime(760 * k, t + i * 1.5 + 0.9); osc.frequency.linearRampToValueAtTime(300 * k, t + i * 1.5 + 1.5); } }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.25); g.gain.setValueAtTime(vol, t + 2.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.1);
  o.connect(f); o2.connect(f); f.connect(g).connect(master); o.start(t); o2.start(t); o.stop(t + 3.2); o2.stop(t + 3.2);
}
// engine: two detuned saws chopped by a fast propeller tremolo; level 0..1 (0 = silent), pitch ~1 (doppler)
let eng = null;
export function setPlaneEngine(level, pitch = 1) {
  if (!ctx) return;
  if (!eng) { const a = ctx.createOscillator(), b = ctx.createOscillator(), f = ctx.createBiquadFilter(), chop = ctx.createGain(), lfo = ctx.createOscillator(), lfoAmt = ctx.createGain(), out = ctx.createGain();
    a.type = b.type = 'sawtooth'; a.frequency.value = 88; b.frequency.value = 91.5; f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 2;
    lfo.frequency.value = 24; lfoAmt.gain.value = 0.45; chop.gain.value = 0.55; lfo.connect(lfoAmt).connect(chop.gain); out.gain.value = 0;
    a.connect(f); b.connect(f); f.connect(chop).connect(out).connect(master); a.start(); b.start(); lfo.start(); eng = { a, b, f, lfo, out, level: 0 }; }
  const t = ctx.currentTime, lv = Math.max(0, Math.min(1, level)); eng.level = lv;
  eng.out.gain.setTargetAtTime(lv * 0.16, t, 0.12); eng.a.frequency.setTargetAtTime(88 * pitch, t, 0.15); eng.b.frequency.setTargetAtTime(91.5 * pitch, t, 0.15);
  eng.lfo.frequency.setTargetAtTime(24 * pitch, t, 0.15); eng.f.frequency.setTargetAtTime(380 + lv * 500, t, 0.15);
}
export function planeEngineLevel() { return eng ? eng.level : 0; }
// the storm's wind: a faint, steady rush of soft noise that swells and thins in slow gusts while its whistle wanders.
// level 0..1 is how loud (0 = silent); size 0..1 lowers its note as the storm grows
let wind = null;
export function setWind(level, size = 0) {
  if (!ctx) return; const lv = Math.max(0, Math.min(1, level)), sz = Math.max(0, Math.min(1, size));
  if (!wind) { if (!lv) return; const len = ctx.sampleRate * 4, fade = (ctx.sampleRate * 0.25) | 0, raw = new Float32Array(len + fade), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let b = 0;
    for (let i = 0; i < raw.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.04 * w) / 1.04; raw[i] = b * 3 + w * 0.1; } // mostly low rumble with a little hiss on top
    for (let i = 0; i < len; i++) d[i] = i < fade ? raw[i] * (i / fade) + raw[len + i] * (1 - i / fade) : raw[i]; // the start is blended with what would have come after the end, so the loop has no seam
    const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), lo = ctx.createBiquadFilter(), out = ctx.createGain(), gust = ctx.createOscillator(), gustAmt = ctx.createGain(), sweep = ctx.createOscillator(), sweepAmt = ctx.createGain();
    src.buffer = buf; src.loop = true; band.type = 'bandpass'; band.frequency.value = 600; band.Q.value = 0.6; lo.type = 'lowpass'; lo.frequency.value = 1800; out.gain.value = 0;
    gust.frequency.value = 0.21; gustAmt.gain.value = 0; gust.connect(gustAmt).connect(out.gain); sweep.frequency.value = 0.13; sweepAmt.gain.value = 150; sweep.connect(sweepAmt).connect(band.frequency);
    src.connect(band).connect(lo).connect(out).connect(master); src.start(); gust.start(); sweep.start(); wind = { out, band, gustAmt, level: -1, size: -1 }; }
  if (Math.abs(lv - wind.level) < 0.004 && Math.abs(sz - wind.size) < 0.01) return; wind.level = lv; wind.size = sz;
  const t = ctx.currentTime, v = lv * 0.085; wind.out.gain.setTargetAtTime(v, t, 0.45); wind.gustAmt.gain.setTargetAtTime(v * 0.4, t, 0.45); wind.band.frequency.setTargetAtTime(640 - sz * 240, t, 0.6);
}
export function windLevel() { return wind ? Math.max(0, wind.level) : 0; }

// Inside the frame (index.html: START, then the menu and the games load inside it) the frame owns the one radio, so the
// music never stops between pages; a page opened on its own runs its own radio as below
const FRAME = (() => { try { return window.parent !== window && window.parent.__radio ? window.parent.__radio : null; } catch { return null; } })();
// ---------- the radio: one shuffled station of every song, on every page (the menu, both games, the shop). Each page is a
// fresh load, so the station carries over in sessionStorage: same song, same spot, same shuffle. It tries to play straight
// away (fine on a computer once you've been on the site); phones and tablets pick it up at the first tap ----------
export const SONGS_ALL = ['music/tornado-alley.mp3', 'music/twister-vs-army.mp3', 'music/clean-slate.mp3', 'music/feeding-ground.mp3', 'music/stomp-the-block.mp3', 'music/saving-you-the-trouble.mp3', 'music/tatsumaki-justice.mp3', 'music/my-little-disaster.mp3', 'music/my-little-disaster-2.mp3', 'music/napalm-requiem.mp3', 'music/beam-beam-baby.mp3'];
export const SONGS_TORNADO = SONGS_ALL, SONGS_KAIJU = SONGS_ALL;
const VOLS = [['LOW', 0.25], ['MED', 0.55], ['FULL BLAST', 0.95]];
let SONGS = SONGS_ALL, volV = null, radioPaused = false, order = [], song = null, songGain = null, songI = -1, repeat = false, volI = 0, resumeAt = 0; /* the songs start at LOW until you change it */
try { const v = +localStorage.getItem('oo_music_vol'); if (v >= 0 && v < VOLS.length && localStorage.getItem('oo_music_vol') !== null) volI = v; } catch { /* ignore */ }
try { const v = localStorage.getItem('oo_radio_vol'); if (v !== null && +v >= 0 && +v <= 1) volV = +v; } catch { /* ignore */ }
try { const st = JSON.parse(sessionStorage.getItem('oo_radio') || 'null'); if (st && SONGS[st.i]) { songI = st.i; resumeAt = st.t || 0; order = (st.order || []).filter((i) => SONGS[i]); repeat = !!st.rep; } } catch { /* ignore */ }
function saveRadio() { if (!song) return; try { sessionStorage.setItem('oo_radio', JSON.stringify({ i: songI, t: song.readyState >= 1 ? song.currentTime : resumeAt, order, rep: repeat })); } catch { /* ignore */ } }
addEventListener('pagehide', saveRadio); setInterval(saveRadio, 1000);
function curVol() { return volV !== null ? volV : VOLS[volI][1]; }
// how loud the music is where you are: 1 in a round, 0.5 on menus, 0 (paused) while a game is paused. The radio lives in the
// outer frame, so a page inside asks it there
let duck = 1;
export function setMusicDuck(k) { if (FRAME) return FRAME.setMusicDuck(k); if (k === duck) return; const was = duck; duck = k; applyVol(); if (!song) return; if (k === 0) song.pause(); else if (was === 0 && song.paused && !musicMuted && !radioPaused && duck > 0) song.play().catch(() => {}); }
function applyVol() { const v = curVol() * duck; if (songGain) songGain.gain.value = v; else if (song) song.volume = Math.min(1, v); }
// once the sound engine is running, the song goes through it (iPad/iPhone ignore an element's volume; MUSIC: OFF covers it)
function routeSong() { if (!song || songGain || !ctx) return; try { songGain = ctx.createGain(); ctx.createMediaElementSource(song).connect(songGain).connect(musicSw); song.volume = 1; } catch { songGain = null; } applyVol(); }
function startSong() { radioPaused = false; song.src = SONGS[songI]; if (!musicMuted) song.play().catch(() => {}); }
export function playSongs() {
  if (FRAME) return FRAME.playSongs();
  if (!song) { if (!SONGS[songI]) songI = onAir()[0]; /* the game opens on the first track that's on the air */ song = new Audio(); song.preload = 'auto'; song.loop = repeat || SONGS.length === 1; song.src = SONGS[songI];
    if (resumeAt > 1) { const t = resumeAt; song.addEventListener('loadedmetadata', () => { if (t < song.duration - 2) song.currentTime = t; }, { once: true }); }
    song.addEventListener('ended', () => nextSong()); applyVol(); }
  routeSong(); song.muted = musicMuted; if (song.paused && !musicMuted && !radioPaused && duck > 0) song.play().catch(() => {});
}
// every page: try now, and again at the first tap or key (browsers block sound until then)
export function menuMusic() { if (FRAME) return FRAME.menuMusic(); unlockAudio(); playSongs(); }
export function radio() { if (FRAME) return FRAME.menuMusic(); menuMusic(); const go = () => { unlockAudio(); menuMusic(); }; addEventListener('pointerdown', go, true); addEventListener('keydown', go, true); }
// a shuffled bag: deal songs out in random order, reshuffle when it runs dry (never the same song twice in a row)
// the radio station on the main menu can switch songs off; off songs are skipped (if all are off, everything plays)
export const songName = (src) => src === 'music/my-little-disaster-2.mp3' ? 'MY LITTLE DISASTER (KAWAII)' : src.split('/').pop().replace('.mp3', '').replace(/-/g, ' ').toUpperCase();
export function songsOff() { try { return JSON.parse(localStorage.getItem('oo_radio_off') || '[]'); } catch { return []; } }
const onAir = () => { const off = songsOff(), on = SONGS.map((_, i) => i).filter((i) => !off.includes(SONGS[i])); return on.length ? on : SONGS.map((_, i) => i); };
function pickNext() { if (order.length && !order.every((i) => onAir().includes(i))) order = order.filter((i) => onAir().includes(i)); if (!order.length) { order = onAir(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } if (song && order.length > 1 && order[0] === songI) order.push(order.shift()); } return order.shift(); }
export function nextSong() { if (FRAME) return FRAME.nextSong(); if (!song) return playSongs(); songI = pickNext(); resumeAt = 0; startSong(); saveRadio(); }
// the radio station's SKIP: the next song down the list that's on the air, and from the last one back to the first
export function skipDown() { if (FRAME) return FRAME.skipDown(); if (!song) return playSongs(); const on = onAir(); playSong(SONGS[on.find((i) => i > songI) ?? on[0]]); }
// play one song now (the radio station's ▶): the shuffle carries on from it afterwards
// the first time a game is opened, its own song comes on (after that, the usual shuffle). Returns true when it did
export function firstSong(game, src) { try { const k = 'oo_first_song_' + game; if (localStorage.getItem(k)) return false; localStorage.setItem(k, '1'); } catch { return false; } playSong(src); return true; }
export function playSong(src) { if (FRAME) return FRAME.playSong(src); const i = SONGS.indexOf(src); if (i < 0) return; if (!song) { playSongs(); if (!song) return; } songI = i; resumeAt = 0; order = order.filter((k) => k !== i); startSong(); saveRadio(); }
export function songState() { if (FRAME) return FRAME.songState(); return song ? { t: song.currentTime, paused: song.paused, muted: song.muted, src: SONGS[songI], loop: song.loop, vol: VOLS[volI][0], list: SONGS.length } : null; }
function toggleRepeat() { repeat = !repeat; if (song) song.loop = repeat || SONGS.length === 1; saveRadio(); return repeat; }
function cycleVol() { volI = (volI + 1) % VOLS.length; volV = null; applyVol(); try { localStorage.setItem('oo_music_vol', volI); localStorage.removeItem('oo_radio_vol'); } catch { /* ignore */ } return VOLS[volI][0]; }
// the radio station's pause button: stays paused through taps and rounds until it's pressed again, or a song is picked or skipped
export function isRadioPaused() { return FRAME ? FRAME.isRadioPaused() : radioPaused; }
export function toggleRadioPause() { if (FRAME) return FRAME.toggleRadioPause(); radioPaused = !radioPaused; if (radioPaused) { if (song) song.pause(); } else menuMusic(); return radioPaused; }
// the radio station's volume slider, 0..1
export function musicVol() { return FRAME ? FRAME.musicVol() : curVol(); }
export function setMusicVol(v) { if (FRAME) return FRAME.setMusicVol(v); volV = v; applyVol(); try { localStorage.setItem('oo_radio_vol', v); } catch { /* ignore */ } }
const volName = () => (volV !== null ? Math.round(volV * 100) + '%' : VOLS[volI][0]);
// the frame page shares its radio with the pages inside it
// wake the radio after iOS paused it (Control Center, a call, another app): resume the audio engine and the song
function wake() { unlockAudio(); if (song && song.paused && !musicMuted && !radioPaused && duck > 0) song.play().catch(() => {}); }
export function frameRadio() { songI = -1; resumeAt = 0; order = []; /* a fresh start of the game: back to the first track */ window.__radio = { setMusicDuck, wake, menuMusic, playSongs, nextSong, skipDown, playSong, songState, toggleRepeat, cycleVol, isRadioPaused, toggleRadioPause, musicVol, setMusicVol, setMuted, setMusicMuted, get repeat() { return repeat; }, get volName() { return volName(); } }; }
// a game page's soundtrack: starts on the first tap and keeps going; SKIP SONG, REPEAT and VOLUME on the given screen
export function gameMusic(host, list) {
  radio();
  const row = document.createElement('div'); row.className = 'soundRow';
  const mk = (label, fn) => { const b = document.createElement('button'); b.className = 'ghost soundBtn'; b.textContent = label; b.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); fn(b); }); row.append(b); return b; };
  mk('⏭ SKIP SONG', () => nextSong());
  const rpt = () => (FRAME ? FRAME.repeat : repeat); mk(rpt() ? '🔂 REPEAT: ON' : '🔁 REPEAT: OFF', (b) => { const on = FRAME ? FRAME.toggleRepeat() : toggleRepeat(); b.textContent = on ? '🔂 REPEAT: ON' : '🔁 REPEAT: OFF'; });
  mk('🔉 MUSIC VOL: ' + (FRAME ? FRAME.volName : volName()), (b) => { b.textContent = '🔉 MUSIC VOL: ' + (FRAME ? FRAME.cycleVol() : cycleVol()); });
  host.insertBefore(row, host.querySelector('.soundRow'));
}
// the in-game SKIP SONG button: a small round button under the zoom buttons that jumps to the next song on the radio
export function skipSongBtn(host) { const b = document.createElement('button'); b.className = 'skipHud'; b.title = 'Skip song'; b.textContent = '⏭';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); if (musicMuted) setMusicMuted(false); nextSong(); b.classList.remove('skipBump'); void b.offsetWidth; b.classList.add('skipBump'); }); host.appendChild(b); return b; }
// the old computer-made music is gone; the games and the older pages can still call these, and nothing happens
export const startMusic = () => {}, stopMusic = () => {}, setMusicChase = () => {}, setMusicTension = () => {}, setStormLevel = () => {}, stormBoost = () => {}, stormMusicState = () => ({ on: false, level: 0, boost: false });
quietWhilePaused(sfx);
