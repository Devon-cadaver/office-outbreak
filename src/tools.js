// Shared palette for the map builders (2D grid at editor.html and the in-world build mode).
// Cell codes: 0 road, 1 building, 2 house, 3 grass, 4 gas, 5 ferris, 6 coaster, 7 carousel, 8 school, 9 skate, 10 slime,
// 11 start, 12 exit, 13 avenue, 14 crosswalk, 15 plaza, 16 tower, 17 tree, 18 bench, 19 parked car
export const GROUPS = [
  ['Erase', [['Erase (back to grass)', 3, '#2f5a38', '']]],
  ['Streets', [['Road', 0, '#3a4c52', ''], ['Avenue', 13, '#2d3c41', 'A'], ['Crosswalk', 14, '#3a4c52', 'X'], ['Plaza', 15, '#8c9a9e', ''], ['Parked car', 19, '#3a4c52', 'C']]],
  ['Buildings', [['Building', 1, '#46606a', ''], ['Tower', 16, '#2a3a44', 'T'], ['House', 2, '#8a5a3a', 'H']]],
  ['Rides', [['Ferris wheel', 5, '#8a4fb8', 'F'], ['Coaster', 6, '#5a2f80', 'R'], ['Carousel', 7, '#d04a7a', 'M']]],
  ['Landmarks', [['Gas station', 4, '#c23b3b', 'G'], ['School', 8, '#4f8fd6', 'S'], ['Skate park', 9, '#7a7a7a', 'K'], ['Slime pond', 10, '#3fbf4a', 'P']]],
  ['Park', [['Grass', 3, '#2f5a38', ''], ['Tree', 17, '#1f4a2a', '♣'], ['Bench', 18, '#2f5a38', 'B']]],
  ['Route', [['Start', 11, '#ffd24a', 'S'], ['Exit', 12, '#7dff3a', 'E']]],
];
export const TOOLS = GROUPS.flatMap(([, items]) => items);
// road shape overrides, bits N=1 E=2 S=4 W=8. null = automatic from neighbours
export const SHAPES = [[null, 'auto'], [10, 'straight ─'], [5, 'straight │'], [3, 'curve └ (up-right)'], [6, 'curve ┌ (right-down)'], [12, 'curve ┐ (down-left)'], [9, 'curve ┘ (left-up)'], [7, 'T ├'], [14, 'T ┬'], [13, 'T ┤'], [11, 'T ┴'], [15, 'crossroads ┼']];
export const ROAD_CODES = new Set([0, 13, 14, 19]);
export function nextShape(map, x, y) { map.conn = map.conn || {}; const k = x + ',' + y; const cur = map.conn[k] == null ? null : map.conn[k]; let i = SHAPES.findIndex(([m]) => m === cur); i = (i + 1) % SHAPES.length; if (SHAPES[i][0] == null) delete map.conn[k]; else map.conn[k] = SHAPES[i][0]; return SHAPES[i][1]; }
export const OPEN_CODES = new Set([0, 3, 11, 12, 13, 14, 15, 18, 19]);
export const MAP_KEY = 'oo_custom_map';
export function blankMap(cols = 19, rows = 29) { return { cols, rows, cells: Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => (x === 0 || y === 0 || x === cols - 1 || y === rows - 1 ? 1 : 3))) }; }
export function loadMap() { try { const m = JSON.parse(localStorage.getItem(MAP_KEY) || 'null'); if (m && m.cells) return m; } catch { /* ignore */ } return null; }
export function saveMap(m) { try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch { /* ignore */ } }
export function fillSelect(sel) {
  for (const [gname, items] of GROUPS) { const og = document.createElement('optgroup'); og.label = gname; for (const [name, code] of items) { const o = document.createElement('option'); o.value = code; o.textContent = name; og.appendChild(o); } sel.appendChild(og); }
}
