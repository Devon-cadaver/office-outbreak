// Sound effects synthesized with WebAudio, and the radio station's songs.
let ctx = null, master = null, musicSw = null, noiseBuf = null, muted = false, musicMuted = false;
export function setMuted(v) { muted = v; if (FRAME) FRAME.setMuted(v); if (master) master.gain.value = muted ? 0 : 0.9; try { localStorage.setItem("oo_mute", muted ? "1" : "0"); } catch { /* ignore */ } }
export function isMuted() { return muted; }
export function audioState() { return ctx ? ctx.state : "none"; }
try { muted = localStorage.getItem("oo_mute") === "1"; musicMuted = localStorage.getItem("oo_music_off") === "1"; } catch { /* ignore */ }
// music has its own switch, separate from the sound effects
export function setMusicMuted(v) { musicMuted = v; try { dispatchEvent(new Event('oo-sound')); } catch { /* ignore */ } if (FRAME) FRAME.setMusicMuted(v); if (musicSw) musicSw.gain.value = musicMuted ? 0 : 1; if (song) { song.muted = musicMuted; if (!musicMuted && song.paused && !radioPaused) song.play().catch(() => {}); } try { localStorage.setItem("oo_music_off", musicMuted ? "1" : "0"); } catch { /* ignore */ } }
export function unlockAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    realBus = ctx.createDynamicsCompressor(); realBus.threshold.value = -14; realBus.knee.value = 10; realBus.ratio.value = 6; realBus.attack.value = 0.003; realBus.release.value = 0.2; realOut = ctx.createGain(); realOut.gain.value = SFX_VOLS[sfxVolI][1]; realBus.connect(realOut); realOut.connect(master); decodeReal(); /* the recordings' own path, with a limiter so a pile of blasts cannot distort; the code-made sounds do not pass through it */
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
export function quietWhilePaused(o) { for (const k of Object.keys(o)) { const f = o[k]; if (typeof f === 'function') o[k] = (...a) => { if (sfxPaused || (menuQuiet && !UI_SFX[k])) return undefined; if (FIXED_SFX[k]) VP = VD = VV = 1; else { VP = rnd(0.94, 1.07); VD = rnd(0.9, 1.12); VV = rnd(0.88, 1.05); } const r = f(...a); VP = VD = VV = 1; return r; }; } }
// these are tunes and signals, the same every time; everything else is varied a little (see VP, VD, VV)
const FIXED_SFX = { click: 1, pickup: 1, coin: 1, power: 1, wave: 1, help: 1, over: 1, ping: 1, neenaw: 1, whoop: 1, honk: 1, powerdown: 1 };
// a menu page (the main menu, the shop) is quiet: the live scene behind it makes no sound, only the buttons and switches do
let menuQuiet = false; const UI_SFX = { click: 1, pickup: 1, coin: 1, power: 1 };
export function setMenuQuiet(on) { menuQuiet = !!on; }
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
  draw(); addEventListener('oo-sound', draw);
}
// every sound that is not a tune or a button is played a little differently each time: VP its pitch, VD its length, VV its
// loudness (set as each sound starts, by quietWhilePaused's wrapper, and put back to 1 = exactly as written straight after)
let VP = 1, VD = 1, VV = 1;
const rnd = (a, b) => a + Math.random() * (b - a);
function tone(freq, dur, type = 'square', vol = 0.08, slide = 0, dest = master, when = 0) {
  if (!ctx) return; const t = ctx.currentTime + when; freq *= VP; slide *= VP; dur *= VD; vol *= VV;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur);
}
// a burst of hiss through a filter. when: seconds from now. to: the filter slides to this note by the end (a whoosh rises or falls, a blast closes down)
function noise(dur, vol = 0.1, freq = 1200, q = 1, when = 0, to = 0) {
  if (!ctx) return; const t = ctx.currentTime + when; freq *= VP; dur *= VD; vol *= VV;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (to) f.frequency.exponentialRampToValueAtTime(Math.max(40, to * VP), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t, dur < 0.2 ? Math.random() * 0.25 : 0); s.stop(t + dur); /* (a short burst starts somewhere else in the hiss each time) */
}
let stepFlip = false, coinT = 0, crunchT = 0, thunderT = 0;
// every button in the game clicks when pressed
// any tap also wakes the radio, which lives in the outer frame, in case iOS paused it
if (typeof document !== 'undefined') document.addEventListener('pointerdown', (e) => { if (e.target && e.target.closest && e.target.closest('button')) sfx.click(); try { if (FRAME && FRAME.wake) FRAME.wake(); } catch { /* ignore */ } }, true);
// the one code-made explosion, for both sizes (the recordings tell a big one from a small one; the code-made sound never did)
// ---- the explosions: each is one of a few makes, picked afresh every time. The first of each is the sound the game always had ----
const crackle = (n, from, to, vol) => { for (let i = 0; i < n; i++) noise(rnd(0.03, 0.07), vol * rnd(0.6, 1), rnd(700, 3200), 1.6, rnd(from, to)); }; /* bits landing after a blast */
const boomMake = () => { const k = Math.random();
  if (k < 0.45) { noise(0.9, 0.6, 140, 0.4); tone(48, 1.1, 'sawtooth', 0.25, -20); noise(0.5, 0.25, 900, 0.8, 0.06); }
  else if (k < 0.75) { noise(0.5, 0.42, 118, 0.4, 0, 70); tone(64, 0.9, 'sine', 0.2, -36); tone(42, 1.2, 'sawtooth', 0.14, -12); noise(0.4, 0.16, 700, 0.8, 0.07); } /* a deeper thump */
  else { noise(0.1, 0.26, 1900, 0.7); noise(0.5, 0.4, 165, 0.4, 0.03); tone(52, 1.0, 'sawtooth', 0.16, -22); noise(0.45, 0.16, 1000, 0.8, 0.09); } /* a crack first, then the roar */
  if (Math.random() < 0.5) crackle(2 + ((Math.random() * 3) | 0), 0.25, 0.75, 0.07); };
// ---- lightning: a crack, then the boom and its thunder rolling away. Four makes, picked afresh for every strike. big: a strike that hits something (full); otherwise a bolt in passing (quiet and short) ----
const strikeMake = (big) => { const v = big ? 1.35 : 0.45, k = Math.random(); /* (measured: a full strike peaks about where the explosion does) */
  const crack = (when, vol) => { noise(rnd(0.03, 0.06), vol * v, rnd(3200, 6000), 1.2, when); tone(rnd(1500, 2300), rnd(0.06, 0.1), 'sawtooth', vol * 0.2 * v, -rnd(1200, 1450), master, when); }; /* the snap: a spit of hiss and a note that drops away */
  const boom = (when, vol, low, sub, type = 'sawtooth') => { noise(0.5, vol * v, low, 0.4, when, low * 0.55); noise(0.4, vol * 0.4 * v, rnd(320, 480), 0.7, when + 0.01); tone(sub, rnd(0.7, 1.1), type, vol * 0.38 * v, -sub * 0.5, master, when); }; /* (the middle band is what a phone's speaker plays of it) */
  const roll = (n, from, to, vol) => { for (let i = 0; i < n; i++) noise(rnd(0.25, 0.5), vol * v * rnd(0.5, 1) * (1 - i / (n + 1)), rnd(80, 190), 0.5, rnd(from, to)); }; /* thunder rolling off: low bursts, each fainter */
  if (k < 0.3) { crack(0, 0.3); boom(0.02, 0.46, 150, 70); if (big) roll(2, 0.25, 0.6, 0.2); } /* close: a sharp crack and a short boom */
  else if (k < 0.55) { crack(0, 0.26); crack(rnd(0.07, 0.13), 0.22); boom(0.1, 0.42, 140, 62); if (big) roll(3, 0.3, 0.8, 0.18); } /* a double strike */
  else if (k < 0.8) { crack(0, 0.18); boom(0.04, 0.4, 120, 55, 'sine'); if (big) roll(5, 0.2, 1.3, 0.22); } /* further off: a softer crack and a long, rolling rumble */
  else { crack(0, 0.28); for (let i = 0; i < 4; i++) noise(rnd(0.02, 0.05), 0.14 * v, rnd(2800, 5200), 2.5, rnd(0.04, 0.3)); boom(0.03, 0.4, 170, 75); if (big) roll(2, 0.3, 0.7, 0.16); } }; /* a sizzling one: the crack fizzes on before the boom */
// a small explosion: shorter and higher than the big one
const blastMake = () => { if (Math.random() < 0.55) { noise(0.45, 0.42, rnd(210, 300), 0.5); tone(rnd(72, 92), 0.5, 'sawtooth', 0.16, -30); noise(0.25, 0.16, 1250, 0.9, 0.04); }
  else { noise(0.3, 0.4, rnd(300, 420), 0.6); tone(170, 0.12, 'triangle', 0.09, -90); tone(80, 0.35, 'sawtooth', 0.12, -25); } /* more of a pop */
  if (Math.random() < 0.3) crackle(2, 0.15, 0.4, 0.05); };
export const sfx = {
  throw: () => tone(700, 0.08, 'triangle', 0.05, -300),
  hit: () => { if (real('hit')) return; const k = Math.random(); if (k < 0.5) tone(200, 0.1, 'square', 0.06, -100); else if (k < 0.8) { tone(rnd(150, 185), 0.12, 'triangle', 0.09, -80); noise(0.03, 0.05, rnd(1500, 2600), 1.5); } else { tone(240, 0.07, 'square', 0.05, -130); tone(120, 0.1, 'triangle', 0.06, -50); } }, /* the old knock, a duller thud with a tick on it, or a quick double */
  kill: () => { tone(300, 0.15, 'sawtooth', 0.06, -200); setTimeout(() => tone(150, 0.2, 'sawtooth', 0.05, -100), 60); },
  hurt: () => tone(120, 0.25, 'sawtooth', 0.1, -60),
  help: (vol = 0.05) => { tone(660, 0.12, 'square', vol); setTimeout(() => tone(880, 0.2, 'square', vol, -20), 130); },
  // caught by a zombie: thud + scream-ish slide
  caught: () => { noise(0.25, 0.25, 300, 0.7); tone(220, 0.5, 'sawtooth', 0.12, 300); setTimeout(() => tone(90, 0.4, 'square', 0.1, -50), 120); },
  step: () => { stepFlip = !stepFlip; noise(0.06, 0.07, stepFlip ? 900 : 700, 2); },
  // a zombie. big: a giant or a boss: one loud, deep voice. A recording where the game has asked for them (Zombie Air Raid; the cemetery in Tornado Time!), otherwise the code-made groan
  groan: (big = false) => { if (real(big ? 'giant' : 'groan') || wantReal.groan) return; const f = (big ? 52 : 70) + Math.random() * 40, k = Math.random(); if (k < 0.5) { tone(f, 0.6, 'sawtooth', 0.05, 25); tone(f * 1.5, 0.5, 'triangle', 0.03, -15); } else if (k < 0.8) { tone(f * 0.85, 0.95, 'sawtooth', 0.05, -10); tone(f * 1.27, 0.8, 'triangle', 0.028, -8, master, 0.05); } else { tone(f * 1.25, 0.32, 'sawtooth', 0.055, -32); tone(f * 2.5, 0.2, 'triangle', 0.02, -40); } },
  pickup: () => { tone(520, 0.08, 'square', 0.05); setTimeout(() => tone(780, 0.1, 'square', 0.05), 80); setTimeout(() => tone(1040, 0.15, 'square', 0.05), 160); },
  wave: () => { tone(440, 0.12, 'square', 0.05); setTimeout(() => tone(660, 0.12, 'square', 0.05), 120); setTimeout(() => tone(880, 0.2, 'square', 0.05), 240); },
  boom: () => { if (real('boom')) return; boomMake(); },
  // a small explosion: the second pop after a big one, a gun firing, a small thing going up
  blast: () => { if (real('blast')) return; blastMake(); },
  // somebody shouting as they run (only as a recording: people were silent before)
  scream: () => true, /* a single cry over a shout bubble: silent. Sean preferred the recorded crowd, far off, to voices made in code */
  whoosh: () => { if (real('whoosh')) return; if (Math.random() < 0.35) return noise(0.35, 0.12, 600, 0.6); const up = Math.random() < 0.5, a = rnd(420, 700), b = rnd(950, 1500); noise(rnd(0.3, 0.44), 0.12, up ? a : b, rnd(0.6, 1.1), 0, up ? b : a); }, /* the old steady rush, or one that rises or falls as it goes by */
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
  crunch: (big = false) => { if (real(big ? 'collapse' : 'crunch')) return; if (!ctx || ctx.currentTime - crunchT < 0.06) return; crunchT = ctx.currentTime; noise(big ? 0.45 : 0.28, big ? 0.32 : 0.22, 380 + Math.random() * 300, 0.6); tone(big ? 90 : 130, 0.2, 'sawtooth', 0.05, -50);
    const n = (big ? 4 : 2) + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) noise(rnd(0.03, 0.08), (big ? 0.12 : 0.09) * rnd(0.5, 1), rnd(350, 1900), 1.4, rnd(0.04, big ? 0.6 : 0.3)); /* rubble settling: a few grains, never the same */
    if (big) { tone(rnd(55, 70), 0.6, 'sawtooth', 0.07, -18); noise(0.5, 0.14, rnd(120, 180), 0.5, 0.05); if (Math.random() < 0.4) for (let i = 0; i < 3; i++) tone(rnd(2200, 3600), 0.05, 'triangle', 0.014, 0, master, rnd(0.1, 0.5)); } }, /* a big building: a low rumble under it, and sometimes glass */
  flap: () => { noise(0.18, 0.12, 520, 0.7); tone(180, 0.12, 'triangle', 0.05, -60); },
  laser: () => { const k = Math.random(); if (k < 0.4) { tone(1600, 0.2, 'sawtooth', 0.035, -1300); tone(800, 0.16, 'square', 0.02, -600); } else if (k < 0.7) { tone(rnd(2000, 2400), 0.13, 'square', 0.03, -1700); tone(300, 0.14, 'sine', 0.04, -180); noise(0.035, 0.04, 3600, 2); } else { tone(1750, 0.09, 'sawtooth', 0.035, -1100); tone(1500, 0.11, 'sawtooth', 0.03, -1000, master, 0.07); } }, /* the old pew, a sharper one with a thump under it, or a quick double */
  // the big targets going up, each in its own way: a burst tank, a fire engine's two-tone horn, a police whoop, a firework, a balloon
  splash: () => { noise(1.1, 0.4, 700, 0.5); noise(1.6, 0.22, 2600, 0.6); tone(90, 0.5, 'sine', 0.12, -40); },
  neenaw: () => { if (real('siren')) return; for (let i = 0; i < 6; i++) tone(i % 2 ? 520 : 660, 0.26, 'square', 0.045, 0, master, i * 0.27); },
  whoop: () => { if (real('siren', 1, 1.07)) return; for (let i = 0; i < 4; i++) tone(520, 0.3, 'sawtooth', 0.04, 900, master, i * 0.32); },
  firework: () => { noise(0.25, 0.3, 1800, 0.8); tone(160, 0.3, 'triangle', 0.08, -90); setTimeout(() => noise(0.5, 0.1, 5200, 2), 90); },
  pop: () => noise(0.06, 0.12, 2400, 1.5),
  honk: () => { tone(392, 0.1, 'sawtooth', 0.05, -30); tone(311, 0.2, 'sawtooth', 0.055, -40, master, 0.12); }, // a clown's horn: two notes, the second lower
  // a ghost's wail, a radar ping, muck landing, a short circuit, the power winding down, a radio's dying static
  ghost: () => { tone(880, 1.4, 'sine', 0.05, -520); tone(660, 1.6, 'sine', 0.04, -380, master, 0.15); noise(1.2, 0.05, 500, 3); },
  ping: (i = 0) => tone(1500 - i * 60, 0.22, 'sine', 0.05, -250),
  splat: () => { noise(0.5, 0.35, 300, 0.6); tone(70, 0.4, 'sawtooth', 0.1, -30); },
  zap: () => { if (Math.random() < 0.5) { noise(0.14, 0.22, 3200, 3); tone(110, 0.16, 'square', 0.05, 60); } else { noise(0.09, 0.2, rnd(2600, 4200), 3); noise(0.08, 0.16, rnd(2600, 4200), 3, 0.05); tone(140, 0.12, 'square', 0.045, 90); } }, /* the old buzz, or a double crackle */
  powerdown: () => tone(420, 1.3, 'sawtooth', 0.06, -370),
  static: () => { noise(1.3, 0.28, 3400, 0.4); tone(1900, 0.9, 'sawtooth', 0.03, -1600); },
  over: () => { tone(300, 0.3, 'sawtooth', 0.08, -150); setTimeout(() => tone(200, 0.5, 'sawtooth', 0.08, -150), 250); },
  // lightning. big: a strike that hits something, always heard in full; otherwise a bolt in passing, quiet, at most one every 0.6 s
  thunder: (big = false) => { if (!ctx) return false; if (big && real('thunder')) return true; if (!big) { if (ctx.currentTime < thunderT) return true; thunderT = ctx.currentTime + 0.6; } strikeMake(big); return true; },
};

// ---------- the recordings (Nov 2026) ----------
// Almost every sound in the games is made in code, above. A few are recordings, where Sean preferred them: the storm's wind,
// the crowd, the zombies. A game names the ones it wants (readySfx(['wind', 'crowd'])) and only those are fetched; until a
// file has loaded, or if it is missing, the code-made sound plays where there is one. Files: public/sfx (sources: public/sfx/CREDITS.txt).
const REAL_ON = true; /* the code's own switch: false and no recording is ever fetched or played */
const SFX_SWITCH = false; /* the NEW / CLASSIC switch and EFFECTS VOL of test build 1: kept, but not in the menu, now that the mix is fixed */
let sfxStyle = 'new'; /* (what that switch saved, oo_sfx, is no longer read: a phone left on CLASSIC would never play these) */
export const sfxNew = () => REAL_ON && sfxStyle === 'new';
// one-shots, by the name the games ask for: [file or files, loudness, slowest and fastest speed it is played at, least seconds between two, most playing at once]
// (a list of files is a set: a different one of them each time, never the same twice running)
const seq = (p, n) => Array.from({ length: n }, (v, i) => p + (i + 1) + '.mp3');
const GROANS = seq('groan/g', 24);
const REAL = { groan: [GROANS, 0.08, 0.92, 1.08, 0.12, 3], giant: [GROANS, 0.36, 0.6, 0.72, 0.5, 2] }; /* giant: the same voices slowed right down, so deeper, and much louder: one at a time */
// sounds that keep going. LOOP_LP: played through a low-pass filter at this many Hz, which muffles it as distance does
const LOOPS = { wind: 'wind.wav', crowd: 'crowd.wav' }, LOOP_LP = { crowd: 1300 };
const realRaw = {}, realBuf = {}, realAt = {}, realLast = {}, realVoices = {}, loopsOn = {}; let realBus = null, realOut = null, realAsked = false, realBusy = false;
// how loud the recordings play as a whole (EFFECTS VOL in the SOUNDS menu): they are new and their level against the music is a guess, so the player can turn them down. The code-made sounds are not touched
const SFX_VOLS = [['LOW', 0.4], ['MED', 0.7], ['FULL BLAST', 1]]; let sfxVolI = 2; /* (oo_sfx_vol is no longer read either) */
export const sfxVolName = () => SFX_VOLS[sfxVolI][0];
export function cycleSfxVol() { sfxVolI = (sfxVolI + 1) % SFX_VOLS.length; try { localStorage.setItem('oo_sfx_vol', sfxVolI); } catch { /* ignore */ } if (realOut) realOut.gain.value = SFX_VOLS[sfxVolI][1]; return sfxVolName(); }
// fetch the files (a game calls readySfx() as it starts; the menus never do, so they load nothing), then decode them one at a
// time once the sound engine exists. A sound asked for before its recording is ready is simply the code-made one
const wantReal = {}, realFetched = {};
function loadReal(names = []) { if (!sfxNew() || typeof fetch === 'undefined') return; for (const n of names) { wantReal[n] = 1; for (const f of (REAL[n] ? [].concat(REAL[n][0]) : LOOPS[n] ? [LOOPS[n]] : [])) { if (realFetched[f]) continue; realFetched[f] = 1; fetch('sfx/' + f).then((r) => (r.ok ? r.arrayBuffer() : null)).then((a) => { if (a) { realRaw[f] = a; decodeReal(); } }).catch(() => { /* that sound stays code-made */ }); } } }
async function decodeReal() { if (realBusy || !ctx) return; realBusy = true; for (;;) { const f = Object.keys(realRaw)[0]; if (!f) break; const a = realRaw[f]; delete realRaw[f]; try { realBuf[f] = await new Promise((ok, no) => { const p = ctx.decodeAudioData(a, ok, no); if (p && p.catch) p.catch(() => {}); }); } catch { /* that sound stays code-made */ } } realBusy = false; }
export function readySfx(names) { loadReal(names); }
// play a recording. True: it is taken care of (played, or too soon after the last one to play again); false: play the code-made sound
function real(name, vol = 1, rate = 0) { if (!ctx || !sfxNew()) return false; const r = REAL[name]; if (!r) return false; let fl = r[0]; if (Array.isArray(fl)) { const have = fl.filter((f) => realBuf[f] && f !== realLast[name]); if (!have.length) return false; fl = have[(Math.random() * have.length) | 0]; }
  const buf = realBuf[fl]; if (!buf) return false; const t = ctx.currentTime; if (t - (realAt[name] == null ? -9 : realAt[name]) < r[4]) return true; realAt[name] = t; realLast[name] = fl;
  const v = realVoices[name] || (realVoices[name] = []); while (v.length >= r[5]) { const o = v.shift(); try { o.g.gain.setTargetAtTime(0, t, 0.03); o.s.stop(t + 0.15); } catch { /* ignore */ } } /* (too many at once: the oldest fades out) */
  const s = ctx.createBufferSource(), g = ctx.createGain(), o = { s, g }; realN[name] = (realN[name] || 0) + 1; s.buffer = buf; s.playbackRate.value = rate || r[2] + Math.random() * (r[3] - r[2]); g.gain.value = r[1] * vol * (0.85 + Math.random() * 0.15); s.connect(g).connect(realBus); s.start(t); v.push(o); s.onended = () => { const i = v.indexOf(o); if (i >= 0) v.splice(i, 1); }; return true; }
// a looping recording at a loudness (0 = silent) and speed. True: the recording is carrying this sound; false: it cannot (CLASSIC, or not loaded), so the code-made one must
function realLoop(kind, level, rate = 1) { const buf = ctx && sfxNew() ? realBuf[LOOPS[kind]] : null; let L = loopsOn[kind]; if (!buf) { if (L) L.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); return false; }
  if (!L) { if (level <= 0) return true; const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.loop = true; g.gain.value = 0; if (LOOP_LP[kind]) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = LOOP_LP[kind]; s.connect(lp).connect(g); } else s.connect(g); g.connect(realBus); s.start(0, Math.random() * buf.duration); L = loopsOn[kind] = { s, g }; } /* (it starts somewhere in the middle, a different place each time) */
  const t = ctx.currentTime; L.g.gain.setTargetAtTime(Math.max(0, level), t, 0.25); L.s.playbackRate.setTargetAtTime(Math.max(0.4, Math.min(2.5, rate)), t, 0.2); return true; }
export const hasLoop = (kind) => !!(ctx && sfxNew() && realBuf[LOOPS[kind]]);
// NEW or CLASSIC, from the pause menu's SOUNDS screen. CLASSIC hushes every recording that is still going; the code-made sounds take over at the games' next call
export function setSfxStyle(v) { sfxStyle = v === 'classic' ? 'classic' : 'new'; try { localStorage.setItem('oo_sfx', sfxStyle); } catch { /* ignore */ } if (sfxNew()) { loadReal(); decodeReal(); } else if (ctx) for (const k of Object.keys(loopsOn)) loopsOn[k].g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); }
// people running from you: a crowd's shouting, louder the more of them are in a panic (level 0..1). A game calls this every frame it has people; when the calls stop (the round is over) it fades out by itself
// for tests: what has loaded, what is looping and how loud, how many of each one-shot have played
const realN = {}; if (typeof window !== 'undefined') window.__sfx = { ctx: () => ctx, out: () => master, crowd: (v) => setCrowd(v), horde: (v) => setHorde(v), saucerSet: (a2, b2, c2) => setSaucer(a2, b2, c2), hordeNow: () => [+hordeLv.toFixed(2), hordeLive], wants: () => Object.keys(wantReal), saucer: () => (ufoS ? [+ufoS.out.gain.value.toFixed(3), +ufoS.bo.gain.value.toFixed(3)] : [0, 0]), sfx: () => sfx, ready: () => Object.keys(realBuf).sort(), loops: () => { const o = {}; for (const k of Object.keys(loopsOn)) o[k] = +loopsOn[k].g.gain.value.toFixed(3); return o; }, played: () => Object.assign({}, realN), style: () => sfxStyle, setStyle: (v) => setSfxStyle(v), engine: () => (eng ? +eng.out.gain.value.toFixed(3) : 0), state: () => (ctx ? ctx.state : 'none') };
// ---------- the crowd and the horde: recordings, kept low and muffled so they sit in the distance ----------
const CROWD_VOL = 0.13, HORDE_VOL = 0.04;
let crowdAt = 0, hordeLv = 0, hordeAt = 0, hordeLive = 0, farTick = 0;
// five times a second: the horde's voices that are due, and anything a game has stopped asking for fades away by itself
function farSounds() { if (farTick) return; farTick = setInterval(() => { if (!ctx || ctx.state !== 'running' || sfxPaused) return; const t = ctx.currentTime;
    if (loopsOn.crowd && t - crowdAt > 0.6) realLoop('crowd', 0);
    if (t - hordeAt > 0.6) hordeLv = 0;
    if (hordeLv > 0.02) { const have = GROANS.filter((f) => realBuf[f]), want = Math.round(3 + 7 * hordeLv); for (let i = 0; i < 2 && hordeLive < want && have.length; i++) hordeVoice(have[(Math.random() * have.length) | 0], hordeLv); } /* 3 to 10 at once, two more at most each time round so they do not all start together */
    if (ufoS && ufoS.on && t - ufoS.at > 0.6) setSaucer(0); }, 200); }
// people running from you (level 0..1 = how many are in a panic). A game calls this every frame it has people
export function setCrowd(level) { if (!ctx) return; crowdAt = ctx.currentTime; realLoop('crowd', menuQuiet ? 0 : Math.max(0, Math.min(1, level)) * CROWD_VOL); farSounds(); }
// a horde of zombies (level 0..1 = how near it is and how many). Each voice is one of the recorded groans at its own pitch; the further off, the quieter and duller
function hordeVoice(file, lv) { const t = ctx.currentTime + rnd(0, 0.18), s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = realBuf[file]; s.playbackRate.value = rnd(0.78, 1.08); lp.type = 'lowpass'; lp.frequency.value = 900 + 700 * lv; g.gain.value = HORDE_VOL * (0.3 + 0.7 * lv) * rnd(0.6, 1); s.connect(lp).connect(g).connect(realBus); s.start(t); hordeLive++; s.onended = () => { hordeLive--; }; }
export function setHorde(level) { if (!ctx) return; hordeLv = menuQuiet ? 0 : Math.max(0, Math.min(1, level)); hordeAt = ctx.currentTime; farSounds(); }
// ---------- the saucer (Beam 'Em Up!): a wobbling hum while it flies, higher and faster the quicker it goes, and the beam's shimmer on top ----------
// level 0..1 the hum, speed 0..1 how fast it is going, beam 0..1 the beam. Called every frame of a round; it fades by itself when the calls stop
let ufoS = null;
export function setSaucer(level, speed = 0, beam = 0) { if (!ctx) return; farSounds(); const lv = menuQuiet ? 0 : Math.max(0, Math.min(1, level)), sp = Math.max(0, Math.min(1, speed)), bm = menuQuiet ? 0 : Math.max(0, Math.min(1, beam)), t = ctx.currentTime;
  if (!ufoS) { if (!lv && !bm) return; const osc = (type, fr) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.start(); return o; }, gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    /* the hum: two notes a fifth apart that throb together, with a thin whirr above that wavers */
    const a = osc('triangle', 196), b = osc('triangle', 294), w = osc('sine', 740), trem = osc('sine', 7), tremAmt = gain(0.35), vib = osc('sine', 0.7), vibAmt = gain(18), hum = gain(0.6), whirr = gain(0.2), lo = ctx.createBiquadFilter(), out = gain(0); lo.type = 'lowpass'; lo.frequency.value = 1100;
    trem.connect(tremAmt).connect(hum.gain); vib.connect(vibAmt).connect(w.frequency); a.connect(hum); b.connect(hum); hum.connect(lo).connect(out); w.connect(whirr).connect(out); out.connect(master);
    /* the beam: a bright pair of notes that flutter and sway, and little rising pings as it pulls things up */
    const c = osc('sine', 660), d = osc('triangle', 990), sh = osc('sine', 13), shAmt = gain(0.4), sw = osc('sine', 0.9), swC = gain(40), swD = gain(60), bt = gain(0.6), bo = gain(0);
    sh.connect(shAmt).connect(bt.gain); sw.connect(swC).connect(c.frequency); sw.connect(swD).connect(d.frequency); c.connect(bt); d.connect(bt); bt.connect(bo).connect(master);
    ufoS = { a, b, w, trem, out, bo, at: t, on: false, ping: 0, pi: 0 }; }
  const S = ufoS; S.at = t; S.on = lv > 0 || bm > 0; S.out.gain.setTargetAtTime(lv * 0.05, t, 0.2); S.bo.gain.setTargetAtTime(bm * 0.06, t, 0.08);
  S.a.frequency.setTargetAtTime(196 * (1 + 0.25 * sp), t, 0.2); S.b.frequency.setTargetAtTime(294 * (1 + 0.25 * sp), t, 0.2); S.w.frequency.setTargetAtTime(740 + 260 * sp, t, 0.25); S.trem.frequency.setTargetAtTime(7 + 5 * sp, t, 0.25);
  if (bm > 0 && t >= S.ping && ctx.state === 'running') { S.ping = t + 0.13; const N = [784, 988, 1175, 1480, 1760, 1976]; tone(N[S.pi++ % N.length], 0.14, 'sine', 0.012 * bm); } }

// ---------- seeding planes: an air-raid siren when one is on its way, and a propeller drone that swells as it closes ----------
// siren: a wailing rise and fall, twice, through a soft low-pass so it reads as distant
export function siren(vol = 0.06) {
  if (!ctx || menuQuiet) return; const t = ctx.currentTime; const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o2.type = 'triangle'; f.type = 'lowpass'; f.frequency.value = 1400;
  for (const osc of [o, o2]) { const k = osc === o ? 1 : 1.5; osc.frequency.setValueAtTime(280 * k, t); for (let i = 0; i < 2; i++) { osc.frequency.linearRampToValueAtTime(760 * k, t + i * 1.5 + 0.9); osc.frequency.linearRampToValueAtTime(300 * k, t + i * 1.5 + 1.5); } }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.25); g.gain.setValueAtTime(vol, t + 2.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.1);
  o.connect(f); o2.connect(f); f.connect(g).connect(master); o.start(t); o2.start(t); o.stop(t + 3.2); o2.stop(t + 3.2);
}
// engine: two detuned saws chopped by a fast propeller tremolo; level 0..1 (0 = silent), pitch ~1 (doppler)
let eng = null, engLv = 0;
// which aircraft: the bomber and the army's planes ('plane'), your helicopter ('heli'), the saucer and its beam ('beam'). With effects on NEW each has
// its own recording; on CLASSIC, or until its file has loaded, all three are the one code-made drone below, told apart by pitch as they always were
const ENG = { plane: [1.5, 1], heli: [1.6, 0.8], beam: [0.6, 2.4] }; /* (how loud the recording plays for a level; the drone pitch at which it plays at its own speed) */
export function setEngine(kind, level, pitch = 1) { if (!ctx) return; const lv = menuQuiet ? 0 : Math.max(0, Math.min(1, level)), K = ENG[kind] || ENG.plane; engLv = lv;
  for (const k of Object.keys(ENG)) if ((k !== kind || lv <= 0) && loopsOn[k]) realLoop(k, 0);
  if (lv <= 0 && ufoS && ufoS.on) setSaucer(0); /* (setPlaneEngine(0) is every game's "engines off": the saucer's hum goes with it) */
  if (lv > 0 && realLoop(kind, Math.min(1, lv * K[0]), pitch / K[1])) { if (eng && eng.level > 0) { eng.level = 0; eng.out.gain.setTargetAtTime(0, ctx.currentTime, 0.12); } return; }
  engSynth(lv, pitch); }
export function setPlaneEngine(level, pitch = 1) { setEngine('plane', level, pitch); }
function engSynth(level, pitch = 1) {
  if (!eng) { const a = ctx.createOscillator(), b = ctx.createOscillator(), f = ctx.createBiquadFilter(), chop = ctx.createGain(), lfo = ctx.createOscillator(), lfoAmt = ctx.createGain(), out = ctx.createGain();
    a.type = b.type = 'sawtooth'; a.frequency.value = 88; b.frequency.value = 91.5; f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 2;
    lfo.frequency.value = 24; lfoAmt.gain.value = 0.45; chop.gain.value = 0.55; lfo.connect(lfoAmt).connect(chop.gain); out.gain.value = 0;
    a.connect(f); b.connect(f); f.connect(chop).connect(out).connect(master); a.start(); b.start(); lfo.start(); eng = { a, b, f, lfo, out, level: 0 }; }
  const t = ctx.currentTime, lv = Math.max(0, Math.min(1, level)); eng.level = lv;
  eng.out.gain.setTargetAtTime(lv * 0.16, t, 0.12); eng.a.frequency.setTargetAtTime(88 * pitch, t, 0.15); eng.b.frequency.setTargetAtTime(91.5 * pitch, t, 0.15);
  eng.lfo.frequency.setTargetAtTime(24 * pitch, t, 0.15); eng.f.frequency.setTargetAtTime(380 + lv * 500, t, 0.15);
}
export function planeEngineLevel() { return engLv; }
// the storm's wind: a faint, steady rush of soft noise that swells and thins in slow gusts while its whistle wanders.
// level 0..1 is how loud (0 = silent); size 0..1 lowers its note as the storm grows
let wind = null, windLv = 0;
export function setWind(level, size = 0) {
  if (!ctx) return; const lv = menuQuiet ? 0 : Math.max(0, Math.min(1, level)), sz = Math.max(0, Math.min(1, size)); windLv = lv;
  if (realLoop('wind', lv * 0.25, 1 - sz * 0.2)) { if (wind && wind.level > 0) { wind.level = -1; wind.out.gain.setTargetAtTime(0, ctx.currentTime, 0.3); wind.gustAmt.gain.setTargetAtTime(0, ctx.currentTime, 0.3); } return; } /* NEW: a recording of wind, a little lower as the storm grows */
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
export function windLevel() { return windLv; }

// Inside the frame (index.html: START, then the menu and the games load inside it) the frame owns the one radio, so the
// music never stops between pages; a page opened on its own runs its own radio as below
const FRAME = (() => { try { return window.parent !== window && window.parent.__radio ? window.parent.__radio : null; } catch { return null; } })();
// ---------- the radio: one shuffled station of every song, on every page (the menu, both games, the shop). Each page is a
// fresh load, so the station carries over in sessionStorage: same song, same spot, same shuffle. It tries to play straight
// away (fine on a computer once you've been on the site); phones and tablets pick it up at the first tap ----------
export const SONGS_ALL = ['music/tornado-alley.mp3', 'music/twister-vs-army.mp3', 'music/clean-slate.mp3', 'music/feeding-ground.mp3', 'music/stomp-the-block.mp3', 'music/saving-you-the-trouble.mp3', 'music/tatsumaki-justice.mp3', 'music/my-little-disaster.mp3', 'music/my-little-disaster-2.mp3', 'music/napalm-requiem.mp3', 'music/beam-beam-baby.mp3', 'music/little-green-man-at-the-rodeo.mp3'];
export const SONGS_TORNADO = SONGS_ALL, SONGS_KAIJU = SONGS_ALL;
const VOLS = [['LOW', 0.25], ['MED', 0.55], ['FULL BLAST', 0.95]];
let SONGS = SONGS_ALL, volV = null, radioPaused = false, order = [], song = null, songGain = null, songI = -1, repeat = false, volI = 0, resumeAt = 0, shuffle = true; const hist = []; /* the songs start at LOW until you change it. shuffle: off = the songs play in list order. hist: the songs before this one (for ⏮) */
try { shuffle = localStorage.getItem('oo_radio_shuffle') !== '0'; } catch { /* ignore */ }
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
// put song i on now (back: it came off the history, so it is not added to it)
function goSong(i, back) { if (!back && songI >= 0 && songI !== i) { hist.push(songI); if (hist.length > 40) hist.shift(); } songI = i; resumeAt = 0; startSong(); saveRadio(); }
const inOrder = () => { const on = onAir(); return on.find((i) => i > songI) ?? on[0]; };
export function nextSong() { if (FRAME) return FRAME.nextSong(); if (!song) return playSongs(); goSong(shuffle ? pickNext() : inOrder()); }
// ⏮: back to the start of this song, or (in its first three seconds) to the song before it
export function prevSong() { if (FRAME) return FRAME.prevSong ? FRAME.prevSong() : undefined; if (!song) return playSongs(); if (song.currentTime > 3 || !hist.length) { song.currentTime = 0; radioPaused = false; if (song.paused && !musicMuted && duck > 0) song.play().catch(() => {}); return; } goSong(hist.pop(), true); }
export function isShuffle() { return FRAME ? (FRAME.isShuffle ? FRAME.isShuffle() : true) : shuffle; }
export function toggleShuffle() { if (FRAME) return FRAME.toggleShuffle ? FRAME.toggleShuffle() : true; shuffle = !shuffle; try { localStorage.setItem('oo_radio_shuffle', shuffle ? '1' : '0'); } catch { /* ignore */ } return shuffle; }
export function radioRepeat() { return FRAME ? FRAME.repeat : repeat; }
export function toggleRadioRepeat() { return FRAME ? FRAME.toggleRepeat() : toggleRepeat(); }
export const isMusicMuted = () => musicMuted;
// the radio station's SKIP: the next song down the list that's on the air, and from the last one back to the first
export function skipDown() { if (FRAME) return FRAME.skipDown(); if (!song) return playSongs(); const on = onAir(); playSong(SONGS[on.find((i) => i > songI) ?? on[0]]); }
// play one song now (the radio station's ▶): the shuffle carries on from it afterwards
// the first time a game is opened, its own song comes on (after that, the usual shuffle). Returns true when it did
export function firstSong(game, src) { try { const k = 'oo_first_song_' + game; if (localStorage.getItem(k)) return false; localStorage.setItem(k, '1'); } catch { return false; } playSong(src); return true; }
export function playSong(src) { if (FRAME) return FRAME.playSong(src); const i = SONGS.indexOf(src); if (i < 0) return; if (!song) { playSongs(); if (!song) return; } order = order.filter((k) => k !== i); goSong(i); }
export function songState() { if (FRAME) return FRAME.songState(); return song ? { t: song.currentTime, dur: isFinite(song.duration) ? song.duration : 0, paused: song.paused, muted: song.muted, src: SONGS[songI], loop: song.loop, vol: VOLS[volI][0], list: SONGS.length } : null; }
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
export function frameRadio() { songI = -1; resumeAt = 0; order = []; /* a fresh start of the game: back to the first track */ window.__radio = { setMusicDuck, wake, menuMusic, playSongs, nextSong, prevSong, isShuffle, toggleShuffle, skipDown, playSong, songState, toggleRepeat, cycleVol, isRadioPaused, toggleRadioPause, musicVol, setMusicVol, setMuted, setMusicMuted, get repeat() { return repeat; }, get volName() { return volName(); } }; }
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
// The pause menus keep every sound and music control behind one SOUNDS button: SOUND and MUSIC on / off, SKIP SONG, REPEAT,
// MUSIC VOL and RADIO STATION. Call it once soundToggle, gameMusic and radioButton have put theirs on `host`: their rows are
// moved into a menu of their own (they keep working as they were). The button carries the .soundRow class itself, so whatever
// goes in "before the sound row" later (CHOOSE SKIN) still lands in the right place
export function soundsMenu(host) { if (!host) return; const rows = [...host.querySelectorAll(':scope > .soundRow')], radioB = [...host.querySelectorAll(':scope > button')].find((b) => /RADIO STATION/.test(b.textContent)); if (!rows.length) return;
  const open = document.createElement('button'); open.className = 'ghost soundRow sndOne'; open.textContent = '🔊 SOUNDS'; host.insertBefore(open, rows[0]);
  const m = document.createElement('div'); m.className = 'psMenu sndMenu'; m.style.display = 'none'; const box = document.createElement('div'); box.className = 'psBox'; box.innerHTML = '<h2>🔊 SOUNDS</h2>'; m.appendChild(box);
  const onOff = rows.find((r) => r.querySelector('[data-k="m"]')); for (const r of [onOff, ...rows.filter((r) => r !== onOff)]) if (r) box.appendChild(r); /* SOUND and MUSIC first, then the song's own buttons */
  const fx = document.createElement('button'); fx.className = 'ghost sfxStyleBtn'; const fxDraw = () => { fx.textContent = '🎚️ EFFECTS: ' + (sfxNew() ? 'NEW' : 'CLASSIC'); }; fxDraw(); fx.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); setSfxStyle(sfxNew() ? 'classic' : 'new'); fxDraw(); }); if (SFX_SWITCH) box.appendChild(fx);
  const fv = document.createElement('button'); fv.className = 'ghost sfxVolBtn'; const fvDraw = () => { fv.textContent = '🔉 EFFECTS VOL: ' + sfxVolName(); fv.style.display = sfxNew() ? '' : 'none'; }; fvDraw(); fv.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); cycleSfxVol(); fvDraw(); }); fx.addEventListener('click', fvDraw); if (SFX_SWITCH) box.appendChild(fv); /* (only the recordings have this volume, so it hides on CLASSIC) */ /* NEW: the recordings; CLASSIC: every sound made in code, as before the sound pass */
  if (radioB) { box.appendChild(radioB); radioB.addEventListener('click', () => { m.style.display = 'none'; }); } /* (the radio opens over the pause menu, as it always did) */
  const back = document.createElement('button'); back.className = 'psBack'; back.textContent = 'BACK'; box.appendChild(back);
  back.addEventListener('click', (e) => { e.stopPropagation(); m.style.display = 'none'; }); open.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); m.style.display = 'flex'; });
  for (const ev of ['pointerdown', 'pointerup', 'touchstart']) m.addEventListener(ev, (e) => e.stopPropagation()); document.body.appendChild(m); }
// the in-game SKIP SONG button: a small round button under the zoom buttons that jumps to the next song on the radio
export function skipSongBtn(host) { const b = document.createElement('button'); b.className = 'skipHud'; b.title = 'Skip song'; b.textContent = '⏭';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); if (musicMuted) setMusicMuted(false); nextSong(); b.classList.remove('skipBump'); void b.offsetWidth; b.classList.add('skipBump'); }); host.appendChild(b); return b; }
// the old computer-made music is gone; the games and the older pages can still call these, and nothing happens
export const startMusic = () => {}, stopMusic = () => {}, setMusicChase = () => {}, setMusicTension = () => {}, setStormLevel = () => {}, stormBoost = () => {}, stormMusicState = () => ({ on: false, level: 0, boost: false });
quietWhilePaused(sfx);
