// The prize games that belong to each game (Nov 2026): after a round you play a quick one from that game's own set, a different
// one each time. Tornado Time!: DEBRIS CATCH, AIM THE TWISTER, STORM CELLAR, SPIN THE FUNNEL. Kaiju Madness: STOMP THE TRUCKS,
// ROAR METER, ARM WRESTLE (and the KAIJU EGG, prizes.js). Zombie Air Raid: SUPPLY DROP, LAST ROCKET. Beam 'Em Up!: ABDUCTION, CROP CIRCLE.
// Each go pays out exactly as the old ones did (take() rolls the prize, chests.js): how well you play changes the fun, not the odds.
export const ICON = { coin: '🪙', skin: '👕', dupe: '🪙', empty: '💨', kaiju: '👹', storm: '🌪️', craft: '🎁' };
export const SETS = { tornado: ['debris', 'flick', 'cellar', 'funnel'], kaiju: ['stomp', 'roar', 'wrestle', 'egg'], air: ['supply', 'rocket'], ufo: ['beam', 'crop'] };
export const NAMES = { debris: '🛻 DEBRIS CATCH', flick: '🌪️ AIM THE TWISTER', cellar: '🚪 STORM CELLAR', funnel: '🌀 SPIN THE FUNNEL', stomp: '🦶 STOMP THE TRUCKS', roar: '🦖 ROAR METER', wrestle: '💪 ARM WRESTLE', supply: '📦 SUPPLY DROP', rocket: '🚀 LAST ROCKET', beam: '🛸 ABDUCTION', crop: '🌾 CROP CIRCLE' };
const HINT = { debris: 'SLIDE THE TRUCK. CATCH 3!', flick: 'TAP TO LET THE TWISTER GO!', cellar: 'PICK A CELLAR DOOR!', funnel: 'TAP TO SHAKE IT LOOSE!', stomp: 'TAP TO STOMP. HIT 3!', roar: 'TAP IN THE GOLD!', wrestle: 'TAP FAST!', supply: 'TAP TO DROP THE CRATE!', rocket: 'PICK A BARREL!', beam: 'TAP TO BEAM ONE UP!', crop: 'TRACE THE CIRCLE!' };
const W = 720, H = 420, pick = (a) => a[(Math.random() * a.length) | 0];

// the little stage every one of them plays on: a canvas that fills the prize box, drawn with emoji
function stage(box) {
  box.innerHTML = '<canvas width="' + W + '" height="' + H + '" style="width:100%;height:100%;display:block;touch-action:none"></canvas><div class="eggHint" style="pointer-events:none"></div>';
  const cv = box.firstChild, g = cv.getContext('2d'), hint = box.lastChild;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  const em = (ch, x, y, s = 60, rot = 0, a = 1) => { g.save(); g.globalAlpha = a; g.translate(x, y); if (rot) g.rotate(rot); g.font = s + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 0, 0); g.restore(); };
  const txt = (t, x, y, s = 34, c = '#ffd24a') => { g.save(); g.font = '900 ' + s + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#120a1f'; g.strokeText(t, x, y); g.fillStyle = c; g.fillText(t, x, y); g.restore(); };
  let last = performance.now(); const run = (frame) => { const step = (now) => { if (!box.isConnected) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; g.clearRect(0, 0, W, H); frame(dt); requestAnimationFrame(step); }; requestAnimationFrame(step); };
  box.addEventListener('click', (e) => e.stopPropagation());
  return { g, hint, em, txt, run, on: (type, f) => cv.addEventListener(type, (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); f(pos(e), e); }) };
}
// one go after another: play it, the prize pops up, then the next go (or ALL DONE)
function mini(key, make) { return (box, canGo, take, won) => { const S = stage(box); let st = 'play', pop = null; S.hint.textContent = HINT[key];
  const fin = (msg) => { if (st !== 'play') return; st = 'show'; const res = take(); pop = { ic: ICON[res.kind], t: 0, res, msg: msg || '' }; };
  const G = make(S, fin, () => st === 'play' && canGo());
  S.run((dt) => { G.draw(dt, st === 'play' && canGo()); if (!pop) return; pop.t += dt; const k = Math.min(1, pop.t / 0.3); S.g.fillStyle = 'rgba(18,10,31,' + (0.55 * k) + ')'; S.g.fillRect(0, 0, W, H); S.em(pop.ic, W / 2, 215, 60 + 110 * k); if (pop.msg) S.txt(pop.msg, W / 2, 70, 40);
    if (pop.t > 1.25) { const r = pop.res; pop = null; won(r); if (canGo()) { G.reset(); st = 'play'; S.hint.textContent = HINT[key]; } else { st = 'done'; S.hint.textContent = 'ALL DONE'; } } }); }; }

export const MINI = {
  // ---- Tornado Time! ----
  debris: mini('debris', (S, fin, act) => { let x = W / 2, got = 0, items = [], t = 0, bonk = 0; const mv = (p) => { x = Math.max(50, Math.min(W - 50, p.x)); }; S.on('pointermove', mv); S.on('pointerdown', mv);
    return { reset() { got = 0; items = []; }, draw(dt, a) { t -= dt; bonk -= dt; if (a && t <= 0) { t = 0.42; const bad = Math.random() < 0.25; items.push({ x: 60 + Math.random() * (W - 120), y: -30, v: 250 + Math.random() * 170, ic: bad ? '🪨' : pick(['🚗', '🐄', '📦', '🛋️', '🚲']), bad, r: Math.random() * 6 }); }
      for (const it of items) { it.y += it.v * dt; it.r += dt * 3; S.em(it.ic, it.x, it.y, 54, it.r); if (a && !it.hit && it.y > 320 && it.y < 395 && Math.abs(it.x - x) < 72) { it.hit = 1; if (it.bad) { got = Math.max(0, got - 1); bonk = 0.6; } else if (++got >= 3) fin('NICE CATCH!'); } }
      items = items.filter((it) => it.y < H + 40 && !it.hit); S.em('🛻', x, 362, 84); S.txt(got + ' / 3', W - 70, 40, 30); if (bonk > 0) S.txt('BONK!', x, 290, 30, '#ff7466'); } }; }),
  flick: mini('flick', (S, fin, act) => { let t = 0, tw = null, houses = [], n = 0; const lay = () => { houses = []; for (let i = 0; i < 9; i++) houses.push({ x: 70 + Math.random() * (W - 140), y: 50 + Math.random() * 190, ic: pick(['🏠', '🏡', '🏚️', '🏪']) }); n = 0; tw = null; }; lay();
    S.on('pointerdown', () => { if (!act() || tw) return; const a = Math.sin(t * 2.2) * 1.05; tw = { x: W / 2, y: 370, vx: Math.sin(a) * 640, vy: -Math.cos(a) * 640, life: 2.4 }; });
    return { reset: lay, draw(dt) { t += dt; for (const h of houses) if (!h.gone) S.em(h.ic, h.x, h.y, 52); else if (h.gone < 0.4) { h.gone += dt; S.em('💥', h.x, h.y, 60); }
      if (!tw) { const a = Math.sin(t * 2.2) * 1.05; for (let i = 1; i < 7; i++) { S.g.fillStyle = '#ffd24a'; S.g.beginPath(); S.g.arc(W / 2 + Math.sin(a) * i * 34, 370 - Math.cos(a) * i * 34, 6, 0, 7); S.g.fill(); } S.em('🌪️', W / 2, 370, 70); return; }
      tw.x += tw.vx * dt; tw.y += tw.vy * dt; tw.life -= dt; if (tw.x < 30 || tw.x > W - 30) tw.vx *= -1; if (tw.y < 30 || tw.y > H - 30) tw.vy *= -1; for (const h of houses) if (!h.gone && Math.hypot(h.x - tw.x, h.y - tw.y) < 52) { h.gone = 0.01; n++; }
      S.em('🌪️', tw.x, tw.y, 80, Math.sin(t * 20) * 0.2); S.txt(n + ' FLAT', W - 90, 40, 28); if (tw.life <= 0 || n >= houses.length) { fin(n + ' FLATTENED!'); tw.vx = tw.vy = 0; tw.life = 99; } } }; }),
  cellar: mini('cellar', (S, fin, act) => { const X = [150, 360, 570]; let pickI = -1, t = 0;
    S.on('pointerdown', (p) => { if (!act() || pickI >= 0) return; pickI = p.x < 255 ? 0 : p.x < 465 ? 1 : 2; t = 0; });
    return { reset() { pickI = -1; }, draw(dt) { if (pickI >= 0) t += dt; X.forEach((x, i) => { S.em('🕳️', x, 262, 110); if (i === pickI && t > 0.45) { const k = Math.min(1, (t - 0.45) / 0.5); S.em('🚪', x + k * 160, 230 - k * 260, 120, k * 5, 1 - k); } else S.em('🚪', x, 230, 120); });
      if (pickI >= 0) { const k = Math.min(1, t / 0.45); S.em('🌪️', X[pickI], -60 + k * 250, 110, Math.sin(t * 25) * 0.2); if (t > 0.95) fin('RIPPED OFF!'); } } }; }),
  funnel: mini('funnel', (S, fin, act) => { const things = ['🪙', '👕', '🎁', '🐄', '🪙', '🚗', '🛋️']; let a = 0, sp = 1.6, shake = -1;
    S.on('pointerdown', () => { if (!act() || shake >= 0) return; shake = 0; });
    return { reset() { shake = -1; sp = 1.6; }, draw(dt) { if (shake >= 0) { shake += dt; sp = 1.6 + shake * 14; if (shake > 0.9) fin('OUT IT COMES!'); } a += dt * sp; const sx = shake >= 0 ? Math.sin(shake * 60) * 10 : 0;
      things.forEach((c, i) => { const q = a + i * 0.9, z = Math.sin(q); if (z < 0) S.em(c, W / 2 + Math.cos(q) * 170, 150 + i * 14 + z * 26, 46); }); S.em('🌪️', W / 2 + sx, 200, 250); things.forEach((c, i) => { const q = a + i * 0.9, z = Math.sin(q); if (z >= 0) S.em(c, W / 2 + Math.cos(q) * 170, 150 + i * 14 + z * 26, 46); }); } }; }),
  // ---- Kaiju Madness ----
  stomp: mini('stomp', (S, fin, act) => { let trucks = [], t = 0, down = -1, hits = 0, booms = [];
    S.on('pointerdown', () => { if (act() && down < 0) down = 0; });
    return { reset() { hits = 0; trucks = []; }, draw(dt, a) { t -= dt; if (a && t <= 0) { t = 0.75 + Math.random() * 0.5; trucks.push({ x: W + 50, v: 300 + Math.random() * 140, ic: pick(['🚚', '🚛', '🚓', '🚒']) }); }
      S.g.fillStyle = '#2a2a34'; S.g.fillRect(0, 352, W, 68); for (const k of trucks) { k.x -= k.v * dt; S.em(k.ic, k.x, 330, 70); } trucks = trucks.filter((k) => k.x > -60);
      let fy = 130; if (down >= 0) { down += dt; fy = down < 0.12 ? 130 + down / 0.12 * 170 : 300 - Math.min(1, (down - 0.12) / 0.25) * 170; if (down >= 0.12 && !this.hitDone) { this.hitDone = 1; const i = trucks.findIndex((k) => Math.abs(k.x - W / 2) < 66); if (i >= 0) { booms.push({ x: trucks[i].x, t: 0 }); trucks.splice(i, 1); if (++hits >= 3) fin('FLAT AS A PANCAKE!'); } } if (down > 0.4) { down = -1; this.hitDone = 0; } }
      for (const b of booms) { b.t += dt; S.em('💥', b.x, 320, 90); } booms = booms.filter((b) => b.t < 0.3); S.em('🦶', W / 2, fy, 150); S.txt(hits + ' / 3', W - 70, 40, 30); } }; }),
  roar: mini('roar', (S, fin, act) => { let m = 0, dir = 1, zone = 0, w = 110, miss = 0, done = 0; const lay = () => { zone = 190 + Math.random() * 340; w = 110; done = 0; }; lay();
    S.on('pointerdown', () => { if (!act()) return; if (Math.abs(110 + m * 500 - zone) < w / 2) { done = 0.01; fin('ROOOAR!'); } else { w = Math.min(260, w + 50); miss = 0.6; } });
    return { reset: lay, draw(dt, a) { if (a) { m += dir * dt * 1.5; if (m > 1) { m = 1; dir = -1; } if (m < 0) { m = 0; dir = 1; } } miss -= dt; if (done) done += dt;
      S.em('🦖', 150, 170, done ? 170 + Math.sin(done * 40) * 10 : 150); S.em(done > 0.25 ? '💥' : '🪟', 570, 170, 120); if (done) for (let i = 0; i < 3; i++) { S.g.strokeStyle = 'rgba(255,210,74,' + (0.7 - i * 0.2) + ')'; S.g.lineWidth = 6; S.g.beginPath(); S.g.arc(230, 170, 40 + ((done * 500 + i * 60) % 300), -0.6, 0.6); S.g.stroke(); }
      S.g.fillStyle = '#2a1450'; S.g.fillRect(110, 330, 500, 30); S.g.fillStyle = '#ffd24a'; S.g.fillRect(zone - w / 2, 330, w, 30); S.g.fillStyle = '#fff'; S.g.fillRect(110 + m * 500 - 5, 318, 10, 54); if (miss > 0) S.txt('LOUDER!', W / 2, 290, 30, '#ff7466'); } }; }),
  wrestle: mini('wrestle', (S, fin, act) => { let p = 0.5, t = 0;
    S.on('pointerdown', () => { if (!act()) return; p += 0.075; if (p >= 1) { p = 1; fin('YOU WIN!'); } });
    return { reset() { p = 0.5; }, draw(dt, a) { t += dt; if (a) p = Math.max(0.12, p - dt * (0.2 + p * 0.25)); const ang = (0.5 - p) * 2.2;
      S.em('🦖', 150, 200, 150); S.em('🦍', 570, 200, 150); S.g.save(); S.g.translate(W / 2, 300); S.g.rotate(ang); S.g.fillStyle = '#7dff3a'; S.g.fillRect(-10, -150, 20, 150); S.g.restore(); S.em('💪', W / 2 + Math.sin(ang) * 150, 300 - Math.cos(ang) * 150, 70, ang);
      S.g.fillStyle = '#2a1450'; S.g.fillRect(160, 30, 400, 22); S.g.fillStyle = '#7dff3a'; S.g.fillRect(160, 30, 400 * p, 22); } }; }),
  // ---- Zombie Air Raid ----
  supply: mini('supply', (S, fin, act) => { let px = -40, tx = 400, crate = null; const lay = () => { tx = 200 + Math.random() * 420; crate = null; }; lay();
    S.on('pointerdown', () => { if (!act() || crate) return; crate = { x: px, y: 96, vx: 200, vy: 0 }; });
    return { reset: lay, draw(dt, a) { px += 330 * dt; if (px > W + 60) px = -60; S.g.fillStyle = '#1e3a22'; S.g.fillRect(0, 380, W, 40); S.em('🏢', tx, 330, 110); S.em('🙋', tx - 16, 262, 40); S.em('🙋', tx + 22, 262, 40); S.em('🧟', tx - 130, 362, 44); S.em('🧟', tx + 140, 362, 44); S.em('✈️', px, 70, 80, 0.75);
      if (crate && !crate.done) { crate.vy += 620 * dt; crate.x += crate.vx * dt; crate.y += crate.vy * dt; if (crate.y >= 268) { crate.y = 268; crate.done = 1; const d = Math.abs(crate.x - tx); fin(d < 55 ? 'BULLSEYE!' : d < 150 ? 'CLOSE ENOUGH!' : 'THEY RAN OUT AND GOT IT!'); } } if (crate) { S.em('📦', crate.x, crate.y, 48); if (!crate.done) S.em('🪂', crate.x, crate.y - 44, 48); } } }; }),
  rocket: mini('rocket', (S, fin, act) => { let pickI = -1, t = 0; const X = [120, 240, 360, 480, 600];
    S.on('pointerdown', (p) => { if (!act() || pickI >= 0) return; pickI = Math.max(0, Math.min(4, Math.floor((p.x - 60) / 120))); t = 0; });
    return { reset() { pickI = -1; }, draw(dt) { if (pickI >= 0) t += dt; X.forEach((x, i) => { if (i === pickI && t > 0.4) S.em('💥', x, 230, 110 + (t - 0.4) * 160, 0, Math.max(0, 1 - (t - 0.4) * 2)); else S.em('🛢️', x, 240, 90); });
      if (pickI < 0) S.em('🚀', W / 2, 380, 60, -0.78); else if (t <= 0.4) { const k = t / 0.4, x = W / 2 + (X[pickI] - W / 2) * k, y = 380 - 140 * k; S.em('🚀', x, y, 60, Math.atan2(X[pickI] - W / 2, 140) - 0.78); } if (pickI >= 0 && t > 0.75) fin('BOOM!'); } }; }),
  // ---- Beam 'Em Up! ----
  beam: mini('beam', (S, fin, act) => { let sx = 100, dir = 1, ws = [], beamT = -1, got = null, miss = 0; const lay = () => { ws = ['🐄', '🚗', '🧍', '🐖', '🚜'].map((ic, i) => ({ ic, x: 90 + i * 135, v: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 35), y: 350 })); beamT = -1; got = null; }; lay();
    S.on('pointerdown', () => { if (!act() || beamT >= 0) return; beamT = 0; let b = null, bd = 80; for (const w of ws) { const d = Math.abs(w.x - sx); if (d < bd) { bd = d; b = w; } } got = b; if (!b) miss = 0.7; });
    return { reset: lay, draw(dt, a) { if (beamT < 0 && a) { sx += dir * 300 * dt; if (sx > W - 70) dir = -1; if (sx < 70) dir = 1; } miss -= dt; S.g.fillStyle = '#1e3a22'; S.g.fillRect(0, 380, W, 40);
      if (beamT >= 0) { beamT += dt; S.g.fillStyle = 'rgba(125,255,176,0.35)'; S.g.beginPath(); S.g.moveTo(sx - 16, 90); S.g.lineTo(sx + 16, 90); S.g.lineTo(sx + 80, 385); S.g.lineTo(sx - 80, 385); S.g.fill(); if (got) { got.x += (sx - got.x) * Math.min(1, dt * 8); got.y = 350 - Math.min(1, beamT / 0.7) * 250; if (beamT > 0.75) { fin('BEAMED UP!'); beamT = 0.5; got = null; ws = ws.filter((w) => w.y > 300); } } else if (beamT > 0.5) beamT = -1; }
      for (const w of ws) { if (w !== got) { w.x += w.v * dt; if (w.x < 50 || w.x > W - 50) w.v *= -1; } S.em(w.ic, w.x, w.y, 58); } S.em('🛸', sx, 70, 90); if (miss > 0) S.txt('MISSED!', W / 2, 200, 32, '#ff7466'); } }; }),
  crop: mini('crop', (S, fin, act) => { const N = 16, R = 140, cx = W / 2 - 60, cy = 205; let lit = [], left = 9, down = false; const lay = () => { lit = Array(N).fill(false); left = 9; }; lay();
    const mark = (p) => { if (!act() || !down) return; for (let i = 0; i < N; i++) { const a = i / N * 6.2832; if (Math.hypot(cx + Math.cos(a) * R - p.x, cy + Math.sin(a) * R - p.y) < 46) lit[i] = true; } if (lit.every(Boolean)) fin('PERFECT CIRCLE!'); };
    S.on('pointerdown', (p) => { down = true; mark(p); }); S.on('pointermove', mark); S.on('pointerup', () => { down = false; }); S.on('pointerleave', () => { down = false; });
    return { reset: lay, draw(dt, a) { S.g.fillStyle = '#5a7a1e'; S.g.fillRect(0, 0, W, H); for (let y = 14; y < H; y += 26) { S.g.fillStyle = '#6a8a26'; S.g.fillRect(0, y, W, 10); } if (a) { left -= dt; if (left <= 0) fin('HE WOKE UP! RUN!'); }
      for (let i = 0; i < N; i++) { const q = i / N * 6.2832; S.g.fillStyle = lit[i] ? '#2a3a0c' : 'rgba(255,255,255,0.55)'; S.g.beginPath(); S.g.arc(cx + Math.cos(q) * R, cy + Math.sin(q) * R, lit[i] ? 26 : 9, 0, 7); S.g.fill(); }
      S.em('🏚️', W - 90, 110, 90); S.em(left > 3 ? '😴' : '😠', W - 90, 210, 60); S.txt(Math.max(0, Math.ceil(left)) + 's', W - 90, 280, 34, left > 3 ? '#fff' : '#ff7466'); } }; }),
};
