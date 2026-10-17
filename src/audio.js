// Tiny synthesized audio via WebAudio: sound effects and a looping music track. No audio files.
let ctx = null, master = null, musicGain = null, noiseBuf = null, muted = false;
export function setMuted(v) { muted = v; if (master) master.gain.value = muted ? 0 : 0.9; try { localStorage.setItem("oo_mute", muted ? "1" : "0"); } catch { /* ignore */ } }
export function isMuted() { return muted; }
export function audioState() { return ctx ? ctx.state : "none"; }
try { muted = localStorage.getItem("oo_mute") === "1"; } catch { /* ignore */ }
export function unlockAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
    const len = ctx.sampleRate * 0.5; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
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
let stepFlip = false;
export const sfx = {
  throw: () => tone(700, 0.08, 'triangle', 0.05, -300),
  hit: () => tone(200, 0.1, 'square', 0.06, -100),
  kill: () => { tone(300, 0.15, 'sawtooth', 0.06, -200); setTimeout(() => tone(150, 0.2, 'sawtooth', 0.05, -100), 60); },
  hurt: () => tone(120, 0.25, 'sawtooth', 0.1, -60),
  // caught by a zombie: thud + scream-ish slide
  caught: () => { noise(0.25, 0.25, 300, 0.7); tone(220, 0.5, 'sawtooth', 0.12, 300); setTimeout(() => tone(90, 0.4, 'square', 0.1, -50), 120); },
  step: () => { stepFlip = !stepFlip; noise(0.06, 0.07, stepFlip ? 900 : 700, 2); },
  groan: () => { const f = 70 + Math.random() * 40; tone(f, 0.6, 'sawtooth', 0.05, 25); tone(f * 1.5, 0.5, 'triangle', 0.03, -15); },
  pickup: () => { tone(520, 0.08, 'square', 0.05); setTimeout(() => tone(780, 0.1, 'square', 0.05), 80); setTimeout(() => tone(1040, 0.15, 'square', 0.05), 160); },
  wave: () => { tone(440, 0.12, 'square', 0.05); setTimeout(() => tone(660, 0.12, 'square', 0.05), 120); setTimeout(() => tone(880, 0.2, 'square', 0.05), 240); },
  over: () => { tone(300, 0.3, 'sawtooth', 0.08, -150); setTimeout(() => tone(200, 0.5, 'sawtooth', 0.08, -150), 250); },
};

// ---------- music: a slow minor-key loop, scheduled a beat ahead ----------
const BPM = 92, BEAT = 60 / BPM;
const BASS = [55, 55, 65.4, 65.4, 49, 49, 58.3, 58.3]; // A1 A1 C2 C2 G1 G1 Bb1 Bb1 (one note per 2 beats)
const MELODY = [220, 0, 261.6, 220, 0, 196, 0, 233.1, 220, 0, 174.6, 0, 196, 0, 0, 0]; // per half beat
let musicOn = false, nextBeat = 0, beatIndex = 0, timer = null;
function scheduleBeat() {
  while (nextBeat < ctx.currentTime + 0.4) {
    const when = nextBeat - ctx.currentTime;
    const half = beatIndex % 16;
    if (half % 4 === 0) tone(BASS[(beatIndex >> 2) % BASS.length], BEAT * 1.8, 'triangle', 0.18, 0, musicGain, when);
    const m = MELODY[half]; if (m) tone(m, BEAT * 0.45, 'square', 0.035, 0, musicGain, when);
    if (half % 8 === 0) { const t = nextBeat; const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f).connect(g).connect(musicGain); s.start(t); s.stop(t + 0.2); }
    if (half % 8 === 4) { const t = nextBeat; const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000; const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08); s.connect(f).connect(g).connect(musicGain); s.start(t); s.stop(t + 0.1); }
    nextBeat += BEAT / 2; beatIndex++;
  }
}
export function startMusic() {
  if (!ctx || musicOn) return; musicOn = true; nextBeat = ctx.currentTime + 0.1; beatIndex = 0;
  timer = setInterval(() => { if (ctx.state === 'running') scheduleBeat(); }, 100);
}
export function stopMusic() { musicOn = false; if (timer) clearInterval(timer); timer = null; }
export function setMusicTension(level) { if (musicGain) musicGain.gain.setTargetAtTime(0.3 + Math.min(0.25, level * 0.05), ctx.currentTime, 0.5); }
