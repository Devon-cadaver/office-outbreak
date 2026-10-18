// Shared palette for the map builders (2D grid at editor.html and the in-world build mode).
// Local dev only: post a map to the Vite dev server, which writes it to maps/ in the project for Claude to read.
export async function sendMapToClaude(map) {
  const name = (prompt('Name this map (optional):', '') || '').trim();
  try { const res = await fetch('/__save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, map }) });
    const t = await res.text(); alert(res.ok ? 'Saved to ' + t + '. Tell Claude the map is there.' : 'Could not save: ' + t);
  } catch (e) { alert('Could not reach the dev server: ' + e.message); }
}
// Cell codes: 0 road, 1 building, 2 house, 3 grass, 4 gas, 5 ferris, 6 coaster, 7 carousel, 8 school, 9 skate, 10 slime,
// 11 start, 12 exit, 13 avenue, 14 crosswalk, 15 plaza, 16 tower, 17 tree, 18 bench, 19 parked car
export const GROUPS = [
  ['Erase', [['Erase (back to grass)', 3, '#2f5a38', '']]],
  ['Streets', [['Road', 0, '#3a4c52', ''], ['Avenue', 13, '#2d3c41', 'A'], ['Crosswalk', 14, '#3a4c52', 'X'], ['Plaza', 15, '#8c9a9e', ''], ['Parked car', 19, '#3a4c52', 'C']]],
  ['Buildings', [['Building', 1, '#46606a', ''], ['Tower', 16, '#2a3a44', 'T'], ['House', 2, '#8a5a3a', 'H']]],
  ['Rides', [['Ferris wheel', 5, '#8a4fb8', 'F'], ['Coaster', 6, '#5a2f80', 'R'], ['Carousel', 7, '#d04a7a', 'M']]],
  ['Landmarks', [['Gas station', 4, '#c23b3b', 'G'], ['School', 8, '#4f8fd6', 'S'], ['Skate park', 9, '#7a7a7a', 'K'], ['Slime pond', 10, '#3fbf4a', 'P'], ['Base (Dead City)', 20, '#5a6a7c', '⌂'], ['Cemetery', 21, '#2f4a38', '✝'], ['Lab', 22, '#3fdf6a', 'L']]],
  ['Park', [['Grass', 3, '#2f5a38', ''], ['Tree', 17, '#1f4a2a', '♣'], ['Bench', 18, '#2f5a38', 'B']]],
  ['Route', [['Start', 11, '#ffd24a', 'S'], ['Exit', 12, '#7dff3a', 'E']]],
];
export const TOOLS = GROUPS.flatMap(([, items]) => items);
// road shape overrides, bits N=1 E=2 S=4 W=8. null = automatic from neighbours
export const SHAPES = [[null, 'auto'], [10, 'straight ─'], [5, 'straight │'], [3, 'curve └ (up-right)'], [6, 'curve ┌ (right-down)'], [12, 'curve ┐ (down-left)'], [9, 'curve ┘ (left-up)'], [7, 'T ├'], [14, 'T ┬'], [13, 'T ┤'], [11, 'T ┴'], [15, 'crossroads ┼']];
export const ROAD_CODES = new Set([0, 13, 14, 19]);
export const VARIANT_CODES = new Map([[17, 10], [18, 10], [1, 10], [2, 10], [16, 10], [19, 4]]); // parked car: car, van, truck, tank // tree, bench, building, house, tower: 10 looks each
export function nextVariant(map, x, y, n) { map.vars = map.vars || {}; const k = x + ',' + y; map.vars[k] = ((map.vars[k] || 0) + 1) % n; return map.vars[k]; }
export function nextShape(map, x, y) { map.conn = map.conn || {}; const k = x + ',' + y; const cur = map.conn[k] == null ? null : map.conn[k]; let i = SHAPES.findIndex(([m]) => m === cur); i = (i + 1) % SHAPES.length; if (SHAPES[i][0] == null) delete map.conn[k]; else map.conn[k] = SHAPES[i][0]; return SHAPES[i][1]; }
export const OPEN_CODES = new Set([0, 3, 11, 12, 13, 14, 15, 18, 19]);
export const MAP_KEY = 'oo_custom_map';
export const LANDMARK_CODES = { 4: 'gas', 5: 'ferris', 6: 'coaster', 7: 'carousel', 8: 'school', 9: 'skate', 10: 'slime', 20: 'base', 21: 'cemetery', 22: 'lab' };
// Turn a builder map into the wall grid plus the per-cell extras city.js understands. Used by both games.
export function decodeCustom(custom) {
  const cols = custom.cols, rows = custom.rows;
  const maze = custom.cells.map((row) => row.map((v) => !OPEN_CODES.has(v)));
  const cu = maze.custom = { landmarks: new Map(), houses: new Set(), parks: new Set(), avenue: new Set(), cross: new Set(), plaza: new Set(), towers: new Set(), trees: new Set(), benches: new Set(), cars: new Set(), conn: new Map(), vars: new Map(), border: custom.border || 0 };
  for (const k in custom.vars || {}) { const [kx, ky] = k.split(',').map(Number); cu.vars.set(ky * cols + kx, custom.vars[k]); }
  for (const k in custom.conn || {}) { const [kx, ky] = k.split(',').map(Number); cu.conn.set(ky * cols + kx, custom.conn[k]); }
  let start = null, exit = null;
  custom.cells.forEach((row, y) => row.forEach((v, x) => { const i = y * cols + x;
    if (LANDMARK_CODES[v]) cu.landmarks.set(i, LANDMARK_CODES[v]); if (v === 2) cu.houses.add(i); if (v === 3 || v === 18) cu.parks.add(i); if (v === 13) cu.avenue.add(i); if (v === 14) cu.cross.add(i); if (v === 15) cu.plaza.add(i);
    if (v === 16) cu.towers.add(i); if (v === 17) cu.trees.add(i); if (v === 18) cu.benches.add(i); if (v === 19) cu.cars.add(i); if (v === 11) start = { cx: x, cy: y }; if (v === 12) exit = { cx: x, cy: y }; }));
  maze.avenues = null;
  return { maze, cols, rows, start: start || { cx: 1, cy: rows - 2 }, exit: exit || { cx: cols - 2, cy: 1 } };
}
export function blankMap(cols = 19, rows = 29) { return { cols, rows, cells: Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => (x === 0 || y === 0 || x === cols - 1 || y === rows - 1 ? 1 : 3))) }; }
export function loadMap() { try { const m = JSON.parse(localStorage.getItem(MAP_KEY) || 'null'); if (m && m.cells) return m; } catch { /* ignore */ } return null; }
export function saveMap(m) { try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch { /* ignore */ } }
export function fillSelect(sel) {
  for (const [gname, items] of GROUPS) { const og = document.createElement('optgroup'); og.label = gname; for (const [name, code] of items) { const o = document.createElement('option'); o.value = code; o.textContent = name; og.appendChild(o); } sel.appendChild(og); }
}
