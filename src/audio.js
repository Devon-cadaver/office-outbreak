// Tiny synthesized audio via WebAudio: sound effects and a looping music track. No audio files.
let ctx = null, master = null, musicGain = null, musicSw = null, noiseBuf = null, muted = false, musicMuted = false;
export function setMuted(v) { muted = v; if (FRAME) FRAME.setMuted(v); if (master) master.gain.value = muted ? 0 : 0.9; try { localStorage.setItem("oo_mute", muted ? "1" : "0"); } catch { /* ignore */ } }
export function isMuted() { return muted; }
export function audioState() { return ctx ? ctx.state : "none"; }
try { muted = localStorage.getItem("oo_mute") === "1"; musicMuted = localStorage.getItem("oo_music_off") === "1"; } catch { /* ignore */ }
// music has its own switch, separate from the sound effects
export function setMusicMuted(v) { musicMuted = v; if (FRAME) FRAME.setMusicMuted(v); if (musicSw) musicSw.gain.value = musicMuted ? 0 : 1; if (song) { song.muted = musicMuted; if (!musicMuted && song.paused) song.play().catch(() => {}); } try { localStorage.setItem("oo_music_off", musicMuted ? "1" : "0"); } catch { /* ignore */ } }
export function unlockAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    musicSw = ctx.createGain(); musicSw.gain.value = musicMuted ? 0 : 1; musicSw.connect(ctx.destination); /* music has its own path: SOUND off mutes effects only */
    musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(musicSw);
    const len = ctx.sampleRate * 0.5; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  // iPad/iPhone: play as a game ('playback'), not as page sound that the silent setting mutes; the in-game toggle is the mute
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}
// Safari can pause the sound mid-game ('suspended' or 'interrupted', e.g. around full screen changes); any tap wakes it
for (const ev of ['pointerup', 'touchend', 'click']) addEventListener(ev, () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }, true);
// 🔊 / 🔇 button on the given screens (placed above their tutorial / menu buttons), all kept in step
export function soundToggle(...hosts) {
  const btns = [];
  const draw = () => { for (const b of btns) b.textContent = b.dataset.k === 'm' ? (musicMuted ? '🎵 MUSIC: OFF' : '🎵 MUSIC: ON') : (muted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON'); };
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
  over: () => { tone(300, 0.3, 'sawtooth', 0.08, -150); setTimeout(() => tone(200, 0.5, 'sawtooth', 0.08, -150), 250); },
};

// ---------- music: a slow minor-key loop, scheduled a beat ahead ----------
// calm: slow A-minor loop at 92 bpm. chase: the same tune kicked up to ~128 bpm (the example clip's pulse),
// transposed up to C minor and raised an octave, with a driving hi-hat and a bass that hits every beat.
const CALM = { bpm: 92, shift: 1, hat: false }, CHASE = { bpm: 128, shift: 2 * Math.pow(2, 3 / 12), hat: true };
const BASS = [55, 55, 65.4, 65.4, 49, 49, 58.3, 58.3]; // A1 A1 C2 C2 G1 G1 Bb1 Bb1 (one note per 2 beats)
const MELODY = [220, 0, 261.6, 220, 0, 196, 0, 233.1, 220, 0, 174.6, 0, 196, 0, 0, 0]; // per half beat
const CHASE_MELODY = [220, 261.6, 220, 196, 233.1, 0, 220, 174.6, 220, 261.6, 293.7, 261.6, 233.1, 0, 196, 0]; // busier line for the chase
let musicOn = false, nextBeat = 0, beatIndex = 0, timer = null, chase = false, mode = CALM;
function hit(t, type, freq, gain, len) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.connect(f).connect(g).connect(musicGain); s.start(t); s.stop(t + len + 0.02); }
function scheduleBeat() {
  while (nextBeat < ctx.currentTime + 0.4) {
    const when = nextBeat - ctx.currentTime;
    const half = beatIndex % 16;
    if (half === 0) mode = chase ? CHASE : CALM; // switch only on the bar line so the groove stays tight
    const BEAT = 60 / mode.bpm, sh = mode.shift;
    if (mode.hat ? half % 2 === 0 : half % 4 === 0) tone(BASS[(beatIndex >> 2) % BASS.length] * (mode.hat ? 2 : 1) * (sh > 1 ? sh / 2 : 1), BEAT * (mode.hat ? 0.9 : 1.8), 'triangle', 0.18, 0, musicGain, when);
    const m = (mode.hat ? CHASE_MELODY : MELODY)[half]; if (m) tone(m * sh, BEAT * 0.45, 'square', mode.hat ? 0.045 : 0.035, 0, musicGain, when);
    if (half % 8 === 0) hit(nextBeat, 'lowpass', 180, 0.5, 0.18);
    if (half % 8 === 4) hit(nextBeat, 'highpass', 3000, 0.12, 0.08);
    if (mode.hat && half % 2 === 1) hit(nextBeat, 'highpass', 6000, 0.07, 0.04);
    nextBeat += BEAT / 2; beatIndex++;
  }
}
export function setMusicChase(on) { chase = !!on; }
export function startMusic() {
  if (!ctx || musicOn) return; musicOn = true; nextBeat = ctx.currentTime + 0.1; beatIndex = 0;
  timer = setInterval(() => { if (ctx.state === 'running') scheduleBeat(); }, 100);
}
export function stopMusic() { musicOn = false; if (timer) clearInterval(timer); timer = null; if (typeof storm !== 'undefined') { storm.on = false; if (storm.timer) clearInterval(storm.timer); storm.timer = null; } }
export function setMusicTension(level) { if (musicGain) musicGain.gain.setTargetAtTime(0.3 + Math.min(0.25, level * 0.05), ctx.currentTime, 0.5); }

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

// ---------- Tornado Alley's storm track: D minor, 136 bpm, built up in layers by the storm's F rank ----------
// F0: half-time drums, a low pulsing bass. F1+: a string pad. F2+: a full backbeat, eighth-note hats. F3+: the lead
// theme. F4+: four-on-the-floor, sixteenth hats, tom fills, the bass opens up. A boost (a new F rank) adds a riser and a
// crash, double-time hats and a fast arpeggio for its length, then lands back on the beat.
const SBPM = 136, STEP = 60 / SBPM / 4;
const PROG = [ // per bar: bass root, pad triad, arpeggio notes
  { root: 73.42, pad: [146.8, 174.6, 220.0], arp: [587.3, 698.5, 880.0, 1174.7] }, // Dm
  { root: 58.27, pad: [116.5, 146.8, 174.6], arp: [466.2, 587.3, 698.5, 932.3] }, // Bb
  { root: 65.41, pad: [130.8, 164.8, 196.0], arp: [523.3, 659.3, 784.0, 1046.5] }, // C
  { root: 55.00, pad: [110.0, 138.6, 164.8], arp: [440.0, 554.4, 659.3, 880.0] }, // A
];
const LEAD = [ // two bars of eighths, repeated: the theme
  [587.3, 0, 440.0, 0, 698.5, 659.3, 587.3, 0], [523.3, 0, 587.3, 659.3, 698.5, 0, 659.3, 523.3],
  [587.3, 0, 440.0, 0, 698.5, 659.3, 587.3, 0], [554.4, 0, 659.3, 0, 880.0, 0, 830.6, 0],
];
let storm = { on: false, timer: null, next: 0, step: 0, level: 0, boostUntil: 0, bus: null };
function sBus() { if (!storm.bus) { const c = ctx.createDynamicsCompressor(); c.threshold.value = -16; c.ratio.value = 4; c.attack.value = 0.005; c.release.value = 0.2; const g = ctx.createGain(); g.gain.value = 1.15; c.connect(g).connect(musicGain); storm.bus = c; } return storm.bus; }
function env(t, node, peak, a, d) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function sNoise(t, type, freq, q, peak, d) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); env(t, g, peak, 0.002, d); s.connect(f).connect(g).connect(sBus()); s.start(t); s.stop(t + d + 0.05); }
function sOsc(t, type, f0, f1, peak, a, d, cutoff = 0) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d * 0.6); const g = ctx.createGain(); env(t, g, peak, a, d); let n = o; if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 3; o.connect(f); n = f; } n.connect(g).connect(sBus()); o.start(t); o.stop(t + a + d + 0.05); }
const kick = (t, v = 1) => sOsc(t, 'sine', 140, 42, 0.95 * v, 0.003, 0.28);
const snare = (t, v = 1) => { sNoise(t, 'bandpass', 1900, 0.7, 0.42 * v, 0.17); sOsc(t, 'triangle', 200, 150, 0.22 * v, 0.002, 0.09); };
const hat = (t, open, v = 1) => sNoise(t, 'highpass', 7500, 0.8, (open ? 0.1 : 0.07) * v, open ? 0.16 : 0.035);
const crash = (t) => sNoise(t, 'highpass', 4500, 0.5, 0.22, 1.6);
const tom = (t, f) => sOsc(t, 'sine', f, f * 0.6, 0.5, 0.003, 0.22);
function pad(t, notes, dur, level) { for (const f of notes) for (const det of [-6, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700 + level * 260; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022 + level * 0.004, t + 0.35); g.gain.setValueAtTime(0.022 + level * 0.004, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(lp).connect(g).connect(sBus()); o.start(t); o.stop(t + dur + 0.05); } }
function riser(t, dur) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(sBus()); s.start(t); s.stop(t + dur + 0.05);
  sOsc(t, 'sawtooth', 160, 640, 0.05, dur * 0.8, dur * 0.25, 2200); }
function stormStep() {
  while (storm.next < ctx.currentTime + 0.25) {
    const t = storm.next, s = storm.step % 16, bar = Math.floor(storm.step / 16), ch = PROG[bar % 4], boost = t < storm.boostUntil, L = Math.min(5, storm.level + (boost ? 1 : 0));
    // drums
    const four = L >= 4, kickOn = four ? s % 4 === 0 : L >= 2 ? (s === 0 || s === 8 || (L >= 3 && (s === 6 || s === 14))) : (s === 0 || s === 10);
    if (kickOn) kick(t); if (L >= 2 ? (s === 4 || s === 12) : s === 8) snare(t);
    if (boost && s >= 12) snare(t, 0.45 + (s - 12) * 0.12); // a little roll into the next bar
    if (boost || L >= 4) hat(t, s % 4 === 2); else if (L >= 1 && s % 2 === 0) hat(t, s % 8 === 6); else if (s % 4 === 2) hat(t, false, 0.7);
    if (L >= 4 && bar % 4 === 3 && s >= 12) tom(t, [196, 165, 131, 98][s - 12]);
    // bass: eighths (sixteenths when it's flat out), the filter opening up with the storm
    if (L >= 4 ? true : s % 2 === 0) sOsc(t, 'sawtooth', ch.root * (s % 8 === 6 && L >= 3 ? 2 : 1), ch.root * (s % 8 === 6 && L >= 3 ? 2 : 1), 0.2, 0.004, STEP * (L >= 4 ? 0.9 : 1.7), 260 + L * 240 + (boost ? 600 : 0));
    // pad on the bar
    if (s === 0 && L >= 1) pad(t, ch.pad, STEP * 16, L);
    // the theme, an octave up when it's huge
    if (L >= 3 && s % 2 === 0) { const n = LEAD[bar % 4][s / 2]; if (n) { const f = n * (L >= 5 ? 2 : 1); sOsc(t, 'square', f, f, 0.05, 0.01, STEP * 1.6, 2600); sOsc(t, 'sawtooth', f / 2, f / 2, 0.035, 0.01, STEP * 1.6, 1800); } }
    // boost: a fast arpeggio over everything
    if (boost) { const f = ch.arp[s % 4] * (s >= 8 ? 2 : 1); sOsc(t, 'square', f, f, 0.04, 0.004, STEP * 0.8, 4000); }
    storm.next += STEP; storm.step++;
  }
}
// Inside the frame (index.html: START, then the menu and the games load inside it) the frame owns the one radio, so the
// music never stops between pages; a page opened on its own runs its own radio as below
const FRAME = (() => { try { return window.parent !== window && window.parent.__radio ? window.parent.__radio : null; } catch { return null; } })();
// ---------- the radio: one shuffled station of every song, on every page (the menu, both games, the shop). Each page is a
// fresh load, so the station carries over in sessionStorage: same song, same spot, same shuffle. It tries to play straight
// away (fine on a computer once you've been on the site); phones and tablets pick it up at the first tap ----------
export const SONGS_ALL = ['music/tornado-alley.mp3', 'music/twister-vs-army.mp3', 'music/clean-slate.mp3', 'music/feeding-ground.mp3', 'music/stomp-the-block.mp3', 'music/saving-you-the-trouble.mp3', 'music/tatsumaki-justice.mp3'];
export const SONGS_TORNADO = SONGS_ALL, SONGS_KAIJU = SONGS_ALL;
const VOLS = [['LOW', 0.25], ['MED', 0.55], ['FULL BLAST', 0.95]];
let SONGS = SONGS_ALL, order = [], song = null, songGain = null, songI = -1, repeat = false, volI = 1, resumeAt = 0;
try { const v = +localStorage.getItem('oo_music_vol'); if (v >= 0 && v < VOLS.length && localStorage.getItem('oo_music_vol') !== null) volI = v; } catch { /* ignore */ }
try { const st = JSON.parse(sessionStorage.getItem('oo_radio') || 'null'); if (st && SONGS[st.i]) { songI = st.i; resumeAt = st.t || 0; order = (st.order || []).filter((i) => SONGS[i]); repeat = !!st.rep; } } catch { /* ignore */ }
function saveRadio() { if (!song) return; try { sessionStorage.setItem('oo_radio', JSON.stringify({ i: songI, t: song.readyState >= 1 ? song.currentTime : resumeAt, order, rep: repeat })); } catch { /* ignore */ } }
addEventListener('pagehide', saveRadio); setInterval(saveRadio, 1000);
function applyVol() { const v = VOLS[volI][1]; if (songGain) songGain.gain.value = v; else if (song) song.volume = Math.min(1, v); }
// once the sound engine is running, the song goes through it (iPad/iPhone ignore an element's volume; MUSIC: OFF covers it)
function routeSong() { if (!song || songGain || !ctx) return; try { songGain = ctx.createGain(); ctx.createMediaElementSource(song).connect(songGain).connect(musicSw); song.volume = 1; } catch { songGain = null; } applyVol(); }
export function playSongs() {
  if (FRAME) return FRAME.playSongs();
  if (!song) { if (!SONGS[songI]) songI = pickNext(); song = new Audio(); song.preload = 'auto'; song.loop = repeat || SONGS.length === 1; song.src = SONGS[songI];
    if (resumeAt > 1) { const t = resumeAt; song.addEventListener('loadedmetadata', () => { if (t < song.duration - 2) song.currentTime = t; }, { once: true }); }
    song.addEventListener('ended', () => nextSong()); applyVol(); }
  routeSong(); song.muted = musicMuted; if (song.paused && !musicMuted) song.play().catch(() => {});
}
// every page: try now, and again at the first tap or key (browsers block sound until then)
export function radio() { if (FRAME) return FRAME.playSongs(); playSongs(); const go = () => { unlockAudio(); playSongs(); }; addEventListener('pointerdown', go, true); addEventListener('keydown', go, true); }
// a shuffled bag: deal songs out in random order, reshuffle when it runs dry (never the same song twice in a row)
function pickNext() { if (!order.length) { order = SONGS.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } if (song && order.length > 1 && order[0] === songI) order.push(order.shift()); } return order.shift(); }
export function nextSong() { if (FRAME) return FRAME.nextSong(); if (!song) return playSongs(); songI = pickNext(); resumeAt = 0; song.src = SONGS[songI]; if (!musicMuted) song.play().catch(() => {}); saveRadio(); }
export function songState() { if (FRAME) return FRAME.songState(); return song ? { t: song.currentTime, paused: song.paused, muted: song.muted, src: SONGS[songI], loop: song.loop, vol: VOLS[volI][0], list: SONGS.length } : null; }
function toggleRepeat() { repeat = !repeat; if (song) song.loop = repeat || SONGS.length === 1; saveRadio(); return repeat; }
function cycleVol() { volI = (volI + 1) % VOLS.length; applyVol(); try { localStorage.setItem('oo_music_vol', volI); } catch { /* ignore */ } return VOLS[volI][0]; }
// the frame page shares its radio with the pages inside it
// wake the radio after iOS paused it (Control Center, a call, another app): resume the audio engine and the song
function wake() { unlockAudio(); if (song && song.paused && !musicMuted) song.play().catch(() => {}); }
export function frameRadio() { window.__radio = { wake, playSongs, nextSong, songState, toggleRepeat, cycleVol, setMuted, setMusicMuted, get repeat() { return repeat; }, get volName() { return VOLS[volI][0]; } }; }
// a game page's soundtrack: starts on the first tap and keeps going; SKIP SONG, REPEAT and VOLUME on the given screen
export function gameMusic(host, list) {
  radio();
  const row = document.createElement('div'); row.className = 'soundRow';
  const mk = (label, fn) => { const b = document.createElement('button'); b.className = 'ghost soundBtn'; b.textContent = label; b.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); fn(b); }); row.append(b); return b; };
  mk('⏭ SKIP SONG', () => nextSong());
  const rpt = () => (FRAME ? FRAME.repeat : repeat); mk(rpt() ? '🔂 REPEAT: ON' : '🔁 REPEAT: OFF', (b) => { const on = FRAME ? FRAME.toggleRepeat() : toggleRepeat(); b.textContent = on ? '🔂 REPEAT: ON' : '🔁 REPEAT: OFF'; });
  mk('🔉 MUSIC VOL: ' + (FRAME ? FRAME.volName : VOLS[volI][0]), (b) => { b.textContent = '🔉 MUSIC VOL: ' + (FRAME ? FRAME.cycleVol() : cycleVol()); });
  host.insertBefore(row, host.querySelector('.soundRow'));
}
export function startStormMusic() {
  if (!ctx) return; stopMusic(); storm.on = true; storm.next = ctx.currentTime + 0.1; storm.step = 0; storm.boostUntil = 0;
  storm.timer = setInterval(() => { if (ctx.state === 'running' && storm.on) stormStep(); }, 60);
}
export function setStormLevel(l) { storm.level = Math.max(0, Math.min(5, l | 0)); }
// a boost: riser into a crash, and the busier layers for `secs`
export function stormBoost(secs = 3) { if (!ctx || !storm.on) return; const t = ctx.currentTime; storm.boostUntil = t + secs; riser(t, 0.6); crash(t + 0.6); kick(t + 0.6, 1.2); crash(t + secs); }
export function stormMusicState() { return { on: storm.on, level: storm.level, boost: ctx ? storm.boostUntil > ctx.currentTime : false }; }

// the in-game SKIP SONG button: a small round button under the zoom buttons that jumps to the next song on the radio
export function skipSongBtn(host) { const b = document.createElement('button'); b.className = 'skipHud'; b.title = 'Skip song'; b.textContent = '⏭';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); if (musicMuted) setMusicMuted(false); nextSong(); b.classList.remove('skipBump'); void b.offsetWidth; b.classList.add('skipBump'); }); host.appendChild(b); return b; }
