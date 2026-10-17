// Map builder: paint a district on a grid, export it as JSON, play it as district 1.
// Cell codes: 0 road, 1 building, 2 house, 3 park, 4 gas, 5 ferris, 6 coaster, 7 carousel, 8 school, 9 skate, 10 slime, 11 start, 12 exit
const GROUPS = [
  ['Streets', [['Road', 0, '#3a4c52', ''], ['Avenue', 13, '#2d3c41', 'A'], ['Crosswalk', 14, '#3a4c52', 'X'], ['Plaza', 15, '#8c9a9e', ''], ['Parked car', 19, '#3a4c52', 'C']]],
  ['Buildings', [['Building', 1, '#46606a', ''], ['Tower', 16, '#2a3a44', 'T'], ['House', 2, '#8a5a3a', 'H']]],
  ['Rides', [['Ferris wheel', 5, '#8a4fb8', 'F'], ['Coaster', 6, '#5a2f80', 'R'], ['Carousel', 7, '#d04a7a', 'M']]],
  ['Landmarks', [['Gas station', 4, '#c23b3b', 'G'], ['School', 8, '#4f8fd6', 'S'], ['Skate park', 9, '#7a7a7a', 'K'], ['Slime pond', 10, '#3fbf4a', 'P']]],
  ['Park', [['Grass', 3, '#2f5a38', ''], ['Tree', 17, '#1f4a2a', '♣'], ['Bench', 18, '#2f5a38', 'B']]],
  ['Route', [['Start', 11, '#ffd24a', 'S'], ['Exit', 12, '#7dff3a', 'E']]],
];
const TOOLS = GROUPS.flatMap(([, items]) => items);
const $ = (id) => document.getElementById(id);
let cols = 19, rows = 29, cells = [], tool = 0;
const KEY = 'oo_custom_map';
function blank(c, r) { const a = []; for (let y = 0; y < r; y++) { const row = []; for (let x = 0; x < c; x++) row.push(x === 0 || y === 0 || x === c - 1 || y === r - 1 ? 1 : 0); a.push(row); } return a; }
function load() { try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); if (m && m.cells) { cols = m.cols; rows = m.rows; cells = m.cells; return; } } catch { /* ignore */ } cells = blank(cols, rows); }
function save() { try { localStorage.setItem(KEY, JSON.stringify({ cols, rows, cells })); } catch { /* ignore */ } }
const cv = $('grid'), g = cv.getContext('2d'); let S = 22;
function fit() { S = Math.max(14, Math.min(28, Math.floor((Math.min(innerWidth - 24, 900)) / cols))); cv.width = cols * S; cv.height = rows * S; draw(); }
function draw() {
  g.fillStyle = '#1a0f2e'; g.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = cells[y][x]; const t = TOOLS.find((tt) => tt[1] === v) || TOOLS[0];
    g.fillStyle = t[2]; g.fillRect(x * S + 1, y * S + 1, S - 2, S - 2);
    const isRoad = (vv) => vv === 0 || vv === 13 || vv === 14 || vv === 19 || vv === 11 || vv === 12 || vv === 3 || vv === 18;
    if (isRoad(v) && v !== 3 && v !== 18) { // road lines
      g.fillStyle = '#e3c84f';
      if (isRoad(cells[y][x + 1]) || isRoad(cells[y][x - 1])) g.fillRect(x * S + 1, y * S + S / 2 - 1, S - 2, 2);
      if (isRoad(cells[y + 1]?.[x]) || isRoad(cells[y - 1]?.[x])) g.fillRect(x * S + S / 2 - 1, y * S + 1, 2, S - 2);
    }
    if (t[3]) { g.fillStyle = '#fff'; g.font = 'bold ' + Math.floor(S * 0.6) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t[3], x * S + S / 2, y * S + S / 2 + 1); }
  }
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
const toolsEl = $('tools'); const selBtns = () => [...toolsEl.querySelectorAll('button')];
for (const [gname, items] of GROUPS) { const hdr = document.createElement('span'); hdr.className = 'ghdr'; hdr.textContent = gname; toolsEl.appendChild(hdr); for (const [name, code, color] of items) { const b = document.createElement('button'); b.textContent = name; b.style.borderColor = color; b.dataset.code = code; if (code === tool) b.classList.add('sel'); b.addEventListener('click', () => { tool = code; for (const o of selBtns()) o.classList.toggle('sel', +o.dataset.code === tool); }); toolsEl.appendChild(b); } }
$('export').addEventListener('click', () => { const s = JSON.stringify({ cols, rows, cells }); $('io').value = s; $('io').select(); try { navigator.clipboard.writeText(s); } catch { /* ignore */ } });
$('import').addEventListener('click', () => { try { const m = JSON.parse($('io').value); if (!m.cells) throw 0; cols = m.cols; rows = m.rows; cells = m.cells; $('w').value = cols; $('h').value = rows; save(); fit(); } catch { alert('That is not a map. Paste the JSON from Export.'); } });
$('clear').addEventListener('click', () => { cells = blank(cols, rows); save(); draw(); });
$('resize').addEventListener('click', () => { const c = Math.max(9, Math.min(41, +$('w').value | 0)), r = Math.max(9, Math.min(41, +$('h').value | 0)); const nb = blank(c, r); for (let y = 1; y < Math.min(r, rows) - 1; y++) for (let x = 1; x < Math.min(c, cols) - 1; x++) nb[y][x] = cells[y][x]; cols = c; rows = r; cells = nb; save(); fit(); });
$('random').addEventListener('click', async () => {
  const { generateMaze } = await import('./city.js'); const wall = generateMaze(cols, rows, Math.floor(cols * rows * 0.08));
  cells = wall.map((row) => row.map((w) => (w ? 1 : 0))); cells[rows - 2][1] = 11; cells[1][cols - 2] = 12; save(); draw();
});
$('play').addEventListener('click', () => {
  const hasStart = cells.some((r) => r.includes(11)), hasExit = cells.some((r) => r.includes(12));
  if (!hasStart || !hasExit) { alert('Place a Start and an Exit first.'); return; }
  save(); location.href = './index.html?custom=1';
});
load(); $('w').value = cols; $('h').value = rows; fit(); addEventListener('resize', fit);
