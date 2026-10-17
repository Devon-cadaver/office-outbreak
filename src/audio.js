// Tiny synthesized sound effects via WebAudio. No audio files needed.
let ctx = null;
export function unlockAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
}
function tone(freq, dur, type = 'square', vol = 0.08, slide = 0) {
  if (!ctx) return; const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
}
export const sfx = {
  throw: () => tone(700, 0.08, 'triangle', 0.05, -300),
  hit: () => tone(200, 0.1, 'square', 0.06, -100),
  kill: () => { tone(300, 0.15, 'sawtooth', 0.06, -200); setTimeout(() => tone(150, 0.2, 'sawtooth', 0.05, -100), 60); },
  hurt: () => tone(120, 0.25, 'sawtooth', 0.1, -60),
  wave: () => { tone(440, 0.12, 'square', 0.05); setTimeout(() => tone(660, 0.12, 'square', 0.05), 120); setTimeout(() => tone(880, 0.2, 'square', 0.05), 240); },
  over: () => { tone(300, 0.3, 'sawtooth', 0.08, -150); setTimeout(() => tone(200, 0.5, 'sawtooth', 0.08, -150), 250); },
};
