// Save codes: all your progress (coins, skins, monsters, unlocked levels, best scores, tutorial ticks) packed into a code
// you can copy, email to yourself or keep in your notes, then enter on another device or after clearing the browser.
// There is no server: the code IS the save. Format: DC1-<base64url of deflate-raw JSON>-<4-char check>. New progress keys
// can be added to KEEP at any time; old codes still load (they just don't carry the new ones).
import { KAIJU_IDS } from './kaiju/rigs.js';
// tester code: typed into LOAD A CODE it unlocks every monster and keeps everything else as it is
const UNLOCK_ALL = 'MONSTERMASH';
const KEEP = /^(oo_coins|oo_coins_earned|oo_skins_owned|oo_skins_equip|oo_seen|tips_seen|prize_game|ta_level|ta_best_\d+|kj_level|kj_unlocked|kj_pick|kj_best_\d+)$/;

const keys = () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (KEEP.test(k)) out.push(k); } } catch { /* ignore */ } return out.sort(); };
const b64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(t, (ch) => ch.charCodeAt(0)); };
const check = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(-4).toUpperCase().padStart(4, '0'); };
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export async function makeCode() {
  const data = {}; for (const k of keys()) data[k] = localStorage.getItem(k);
  const json = new TextEncoder().encode(JSON.stringify(data)); let ver = 'DC0', bytes = json;
  if (typeof CompressionStream !== 'undefined') { try { bytes = await pipe(json, new CompressionStream('deflate-raw')); ver = 'DC1'; } catch { /* plain */ } }
  const body = b64(bytes); return ver + '-' + body + '-' + check(body);
}
// reads a code and returns { data, summary } or throws an Error with a message for the player
export async function readCode(code) {
  const m = /^(DC[01])-([A-Za-z0-9_-]+)-([0-9A-Z]{4})$/.exec(String(code).replace(/\s+/g, '').trim()); if (!m) throw new Error("That doesn't look like a Dead City save code.");
  if (check(m[2]) !== m[3]) throw new Error('That code has a typo in it. Copy it again, all of it.');
  let bytes = unb64(m[2]); if (m[1] === 'DC1') { if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to read save codes.'); bytes = await pipe(bytes, new DecompressionStream('deflate-raw')); }
  const data = JSON.parse(new TextDecoder().decode(bytes)); const clean = {}; for (const k in data) if (KEEP.test(k) && typeof data[k] === 'string') clean[k] = data[k];
  return { data: clean, summary: summarize((k) => clean[k] ?? null) };
}
export function applyCode(data) { for (const k of keys()) localStorage.removeItem(k); for (const k in data) localStorage.setItem(k, data[k]); }
function summarize(get) {
  const num = (k) => { try { return +JSON.parse(get(k) ?? '0') || 0; } catch { return 0; } }, arr = (k) => { try { return JSON.parse(get(k) ?? '[]').length || 0; } catch { return 0; } };
  const coins = Math.round(num('oo_coins') * 100) / 100;
  return '🪙 ' + coins + (coins === 1 ? ' coin' : ' coins') + ' · 👕 ' + arr('oo_skins_owned') + ' skins · 👹 ' + (arr('kj_unlocked') + 1) + ' monsters · 🌪️ town ' + Math.max(1, num('ta_level')) + ' · 🦖 town ' + Math.max(1, num('kj_level'));
}

const CSS = `
#saveBox { position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; background: #0e0818ee; padding: 18px 12px; }
#saveBox.hidden { display: none; }
#saveBox .card { width: min(440px, 94vw); display: grid; gap: 8px; padding: 16px; border-radius: 16px; background: #1a0f2e; border: 2px solid #7dff3a; text-align: left; color: #fff; }
#saveBox h2 { margin: 0; color: #7dff3a; font-size: 22px; } #saveBox h3 { margin: 8px 0 0; color: #ffd24a; font-size: 15px; letter-spacing: 1px; }
#saveBox p { margin: 0; font-size: 13px; line-height: 1.35; color: #e9e4f5; } #saveBox .sum { color: #ffd24a; font-weight: 800; }
#saveBox textarea { width: 100%; box-sizing: border-box; min-height: 74px; resize: vertical; font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; word-break: break-all; color: #7dff3a; background: #0e0818; border: 2px solid #5a2f80; border-radius: 10px; padding: 8px; -webkit-user-select: text; user-select: text; }
#saveBox .row { display: flex; gap: 8px; flex-wrap: wrap; } #saveBox .row > * { flex: 1; margin: 0; text-align: center; text-decoration: none; }
#saveBox a.ghost { display: inline-block; padding: 8px 12px; border-radius: 12px; border: 2px solid #9a5fd688; color: #c9a6ff; font-weight: 800; font-size: 14px; }
#saveBox .msg { min-height: 1.3em; font-weight: 800; } #saveBox .msg.bad { color: #ff7a5a; } #saveBox .msg.good { color: #7dff3a; }
#saveBox .armed { color: #ff7a5a; border-color: #ff5a3a; }
`;

// a SAVE CODE button for the main menu and the panel it opens
export function initSaveCodes(menu, before = null) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.className = 'choice'; btn.style.cssText = 'border-color:#c9a6ff;box-shadow:0 6px 0 #3a2a5a';
  btn.innerHTML = '<b style="color:#c9a6ff">💾 SAVE CODE</b><span>Keep your progress safe, or move it to another device.</span>'; menu.insertBefore(btn, before);
  const box = document.createElement('div'); box.id = 'saveBox'; box.className = 'hidden';
  box.innerHTML = `<div class="card"><h2>💾 SAVE CODE</h2>
    <p>Your progress lives in this browser. Clearing its history or data wipes it. Keep this code somewhere safe (copy it into your notes, or email it to yourself) and enter it on any device to get it all back.</p>
    <p class="sum" id="saveSum"></p>
    <h3>YOUR CODE</h3><textarea id="saveOut" readonly></textarea>
    <div class="row"><button id="saveCopy">📋 COPY</button><a id="saveMail" class="ghost" target="_blank" rel="noopener">✉️ EMAIL IT</a></div>
    <p class="msg" id="saveOutMsg"></p>
    <h3>LOAD A CODE</h3><p>Paste a code to bring that progress onto this device. It replaces what's here now.</p>
    <textarea id="saveIn" placeholder="DC1-..."></textarea>
    <button id="saveLoad">⬇️ LOAD</button><p class="msg" id="saveInMsg"></p>
    <button id="saveClose" class="ghost">CLOSE</button></div>`;
  document.body.appendChild(box); const $ = (id) => box.querySelector('#' + id);
  let code = '', pending = null, armT = 0;
  const say = (id, text, cls = '') => { const el = $(id); el.textContent = text; el.className = 'msg ' + cls; };
  btn.addEventListener('click', async () => { box.classList.remove('hidden'); say('saveOutMsg', ''); say('saveInMsg', ''); $('saveIn').value = ''; pending = null;
    $('saveSum').textContent = summarize((k) => { try { return localStorage.getItem(k); } catch { return null; } });
    code = await makeCode(); $('saveOut').value = code;
    $('saveMail').href = 'mailto:?subject=' + encodeURIComponent('My Dead City save code') + '&body=' + encodeURIComponent(code + '\n\nTo load it: Dead City main menu → SAVE CODE → paste it under LOAD A CODE → LOAD.'); });
  $('saveOut').addEventListener('focus', (e) => e.target.select());
  $('saveCopy').addEventListener('click', async () => { const sel = () => { const t = $('saveOut'); t.focus(); t.select(); t.setSelectionRange(0, t.value.length); };
    try { await navigator.clipboard.writeText(code); say('saveOutMsg', '✓ Copied! Paste it somewhere safe.', 'good'); }
    catch { sel(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ } say('saveOutMsg', ok ? '✓ Copied! Paste it somewhere safe.' : 'The code is selected: press and hold it, then Copy.', ok ? 'good' : ''); } });
  $('saveLoad').addEventListener('click', async () => {
    if ($('saveIn').value.replace(/[^a-z]/gi, '').toUpperCase() === UNLOCK_ALL) { try { localStorage.setItem('kj_unlocked', JSON.stringify(KAIJU_IDS.filter((x) => x !== 'godzilly'))); } catch { /* ignore */ } say('saveInMsg', '✓ All ' + KAIJU_IDS.length + ' monsters unlocked!', 'good'); return; }
    if (pending && performance.now() - armT < 4000) { applyCode(pending.data); say('saveInMsg', '✓ Loaded! Restarting…', 'good'); setTimeout(() => location.reload(), 900); return; }
    try { pending = await readCode($('saveIn').value); armT = performance.now(); $('saveLoad').classList.add('armed'); $('saveLoad').textContent = '⚠️ TAP AGAIN TO REPLACE THIS DEVICE\'S PROGRESS';
      say('saveInMsg', 'This code has: ' + pending.summary, ''); setTimeout(() => { if (performance.now() - armT >= 3900) { $('saveLoad').classList.remove('armed'); $('saveLoad').textContent = '⬇️ LOAD'; } }, 4000); }
    catch (e) { pending = null; say('saveInMsg', e.message || 'That code could not be read.', 'bad'); } });
  $('saveClose').addEventListener('click', () => box.classList.add('hidden'));
}
