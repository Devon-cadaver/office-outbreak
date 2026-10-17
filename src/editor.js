// Map builder: paint a district on a grid, export it as JSON, play it as district 1.
// Cell codes: 0 road, 1 building, 2 house, 3 park, 4 gas, 5 ferris, 6 coaster, 7 carousel, 8 school, 9 skate, 10 slime, 11 start, 12 exit
import { GROUPS, TOOLS } from './tools.js';
const $ = (id) => document.getElementById(id);
let cols = 19, rows = 29, cells = [], tool = 0;
const KEY = 'oo_custom_map';
function blank(c, r) { const a = []; for (let y = 0; y < r; y++) { const row = []; for (let x = 0; x < c; x++) row.push(1); a.push(row); } return a; }
function load() { try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); if (m && m.cells) { cols = m.cols; rows = m.rows; cells = m.cells; return; } } catch { /* ignore */ } cells = blank(cols, rows); }
function save() { try { localStorage.setItem(KEY, JSON.stringify({ cols, rows, cells })); } catch { /* ignore */ } }
const cv = $('grid'), g = cv.getContext('2d'); let S = 22;
function fit() { S = Math.max(16, Math.min(34, Math.floor((Math.min(innerWidth - 16, 900)) / cols))); cv.width = cols * S; cv.height = rows * S; draw(); }
const OPENV = new Set([0, 3, 11, 12, 13, 14, 15, 18, 19]), ROADV = new Set([0, 11, 12, 13, 14, 18, 19]);
const openAt = (x, y) => OPENV.has(cells[y]?.[x]), roadAt = (x, y) => ROADV.has(cells[y]?.[x]) || cells[y]?.[x] === 3;
function draw() {
  g.fillStyle = '#1a0f2e'; g.fillRect(0, 0, cv.width, cv.height);
  const C = (v) => v * S + S / 2;
  // ground per cell
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = cells[y][x]; const t = TOOLS.find((tt) => tt[1] === v) || TOOLS[0];
    g.fillStyle = OPENV.has(v) ? (v === 3 || v === 18 ? '#2f5a38' : '#8c9a9e') : t[2]; g.fillRect(x * S, y * S, S, S);
    if (!OPENV.has(v)) { g.strokeStyle = '#0008'; g.lineWidth = 1; g.strokeRect(x * S + 0.5, y * S + 0.5, S - 1, S - 1); }
  }
  // road strips
  const RW = Math.round(S * 0.6);
  const strip = (x0, y0, x1, y1, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  for (const [w, col] of [[RW + 2, '#2d3c41'], [RW, '#3a4c52']]) {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { if (!roadAt(x, y)) continue; const ww = w + (cells[y][x] === 13 ? Math.round(S * 0.2) : 0);
      if (roadAt(x + 1, y)) strip(C(x), C(y), C(x + 1), C(y), ww, col); if (roadAt(x, y + 1)) strip(C(x), C(y), C(x), C(y + 1), ww, col);
      g.fillStyle = col; g.fillRect(C(x) - ww / 2, C(y) - ww / 2, ww, ww); }
  }
  // yellow centre line: through straights, curved at corners, through street at a T, clear at a 4-way
  g.strokeStyle = '#e3c84f'; g.lineWidth = Math.max(1, S * 0.07);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!roadAt(x, y)) continue; const n = roadAt(x, y - 1), s = roadAt(x, y + 1), e2 = roadAt(x + 1, y), w2 = roadAt(x - 1, y); const d = n + s + e2 + w2;
    const cx = C(x), cy = C(y), X = x * S, Y = y * S;
    const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    if (d === 4) continue;
    if (d === 3) { if (e2 && w2) line(X, cy, X + S, cy); else line(cx, Y, cx, Y + S); continue; }
    if (d === 2 && e2 && w2) { line(X, cy, X + S, cy); continue; }
    if (d === 2 && n && s) { line(cx, Y, cx, Y + S); continue; }
    if (d === 2) { const kx = e2 ? X + S : X, ky = s ? Y + S : Y; const a0 = Math.atan2(cy - ky, 0), a1 = Math.atan2(0, cx - kx); const sw = (((a1 - a0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); g.beginPath(); g.arc(kx, ky, S / 2, a0, a1, sw > Math.PI); g.stroke(); continue; }
    if (d === 1) { if (w2) line(X, cy, cx, cy); if (e2) line(X + S, cy, cx, cy); if (n) line(cx, Y, cx, cy); if (s) line(cx, Y + S, cx, cy); }
  }
  // markers
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = cells[y][x]; const t = TOOLS.find((tt) => tt[1] === v); if (!t || !t[3]) continue;
    g.fillStyle = v === 11 ? '#ffd24a' : v === 12 ? '#7dff3a' : '#fff'; g.font = 'bold ' + Math.floor(S * 0.55) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (v === 14) { g.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { g.fillRect(x * S + 3 + k * (S - 6) / 4, y * S + 2, 2, 4); g.fillRect(x * S + 3 + k * (S - 6) / 4, y * S + S - 6, 2, 4); } continue; }
    g.fillText(t[3], x * S + S / 2, y * S + S / 2 + 1);
  }
  // grid
  g.strokeStyle = '#ffffff12'; g.lineWidth = 1; for (let x = 0; x <= cols; x++) { g.beginPath(); g.moveTo(x * S + 0.5, 0); g.lineTo(x * S + 0.5, rows * S); g.stroke(); } for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y * S + 0.5); g.lineTo(cols * S, y * S + 0.5); g.stroke(); }
}
function paint(x, y) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return;
  if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) return; // ring stays buildings
  if (tool === 11 || tool === 12) { for (let yy = 0; yy < rows; yy++) for (let xx = 0; xx < cols; xx++) if (cells[yy][xx] === tool) cells[yy][xx] = 0; }
  cells[y][x] = tool; draw(); save();
}
let down = false;
const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / S), Math.floor((e.clientY - r.top) / S)]; };
cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); paint(x, y); });
cv.addEventListener('pointermove', (e) => { if (!down) return; const [x, y] = pos(e); paint(x, y); });
cv.addEventListener('pointerup', () => { down = false; }); cv.addEventListener('pointercancel', () => { down = false; });
const toolSel = $('toolSel');
for (const [gname, items] of GROUPS) { const og = document.createElement('optgroup'); og.label = gname; for (const [name, code] of items) { const o = document.createElement('option'); o.value = code; o.textContent = name; og.appendChild(o); } toolSel.appendChild(og); }
toolSel.value = String(tool); toolSel.addEventListener('change', () => { tool = +toolSel.value; });
const menu = $('menu');
menu.addEventListener('change', () => { const v = menu.value; menu.value = ''; if (v === 'help') $('help').classList.toggle('hidden'); else if (v === 'resize') { const c = +prompt('Width (9-41)', cols) || cols, r = +prompt('Height (9-41)', rows) || rows; $('w').value = c; $('h').value = r; $('resize').click(); } else if (v) $(v).click(); });
// hidden buttons the menu drives
for (const id of ['export', 'import', 'random', 'clear', 'resize']) { const b = document.createElement('button'); b.id = id; b.className = 'hidden'; document.body.appendChild(b); }
$('export').addEventListener('click', () => { const s = JSON.stringify({ cols, rows, cells }); $('iobox').classList.remove('hidden'); $('io').value = s; $('io').select(); try { navigator.clipboard.writeText(s); } catch { /* ignore */ } });
$('import').addEventListener('click', () => { if ($('iobox').classList.contains('hidden') || !$('io').value.trim()) { $('iobox').classList.remove('hidden'); $('io').value = ''; $('io').placeholder = 'Paste the map text here, then choose Import again.'; $('io').focus(); return; } try { const m = JSON.parse($('io').value); if (!m.cells) throw 0; cols = m.cols; rows = m.rows; cells = m.cells; $('w').value = cols; $('h').value = rows; save(); fit(); } catch { alert('That is not a map. Paste the JSON from Export.'); } });
$('clear').addEventListener('click', () => { cells = blank(cols, rows); save(); draw(); });
$('resize').addEventListener('click', () => { const c = Math.max(9, Math.min(41, +$('w').value | 0)), r = Math.max(9, Math.min(41, +$('h').value | 0)); const nb = blank(c, r); for (let y = 1; y < Math.min(r, rows) - 1; y++) for (let x = 1; x < Math.min(c, cols) - 1; x++) nb[y][x] = cells[y][x]; cols = c; rows = r; cells = nb; save(); fit(); });
$('random').addEventListener('click', async () => {
  const { generateMaze } = await import('./city.js'); const wall = generateMaze(cols, rows, Math.floor(cols * rows * 0.08));
  cells = wall.map((row) => row.map((w) => (w ? 1 : 0))); cells[rows - 2][1] = 11; cells[1][cols - 2] = 12; save(); draw();
});
$('play').addEventListener('click', () => {
  if (tool === 11 || tool === 12) { /* fine */ }
  const hasStart = cells.some((r) => r.includes(11)), hasExit = cells.some((r) => r.includes(12));
  if (!hasStart || !hasExit) { alert('Place a Start and an Exit first.'); return; }
  save(); location.href = './index.html?custom=1';
});
load(); $('w').value = cols; $('h').value = rows; fit(); addEventListener('resize', fit);
