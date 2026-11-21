// BEAM 'EM UP!'s towns: built exactly the way Tornado Time! builds its towns (same maze, avenues, fairground and big
// targets, same countryside round the edge), with the same frame-cost tricks: the static town is sorted into chunks that
// are switched off whole when off screen, and buildings, landmarks and scenery are baked into a few meshes per chunk.
// A building is lifted back out of the bake, exactly as it was, the moment anything touches it (free / live).
// Copied from src/ally/main.js (buildWorld + freezeCity) so this game can change its own copy without touching Tornado Time!.
import * as THREE from 'three';
import { generateMaze, buildCity, toWorld, CELL, mulberry32 } from '../city.js';
import { buildOutskirts } from '../outskirts.js';
import { rides, spinners } from '../landmarks.js';
import { mergeStatic, bakeMovable, bakeUnits, setBakedGlow } from '../perf.js';

// big targets: HUD icon, banner name, how many death-ray hits bring it down, points
export const POI = { fair: { icon: '🎡', name: 'FAIRGROUND', hp: 5, pts: 4000 }, power: { icon: '⚡', name: 'POWER PLANT', hp: 4, pts: 3000 }, water: { icon: '💧', name: 'WATER STATION', hp: 3, pts: 2500 },
  cemetery: { icon: '🪦', name: 'GRAVEYARD', hp: 3, pts: 1500 }, weather: { icon: '📡', name: 'WEATHER STATION', hp: 3, pts: 2000 }, firestation: { icon: '🚒', name: 'FIRE STATION', hp: 3, pts: 2200 },
  police: { icon: '🚓', name: 'POLICE STATION', hp: 3, pts: 2200 }, sewage: { icon: '💩', name: 'SEWAGE PLANT', hp: 3, pts: 2200 }, radio: { icon: '📻', name: 'RADIO TOWER', hp: 4, pts: 3500 },
  nuclear: { icon: '☢️', name: 'NUCLEAR PLANT', hp: 6, pts: 8000 } };
const EXTRA_POIS = ['cemetery', 'weather', 'firestation', 'police', 'sewage', 'radio'];
const CHUNK = 4, noop = () => {};

// size: cells across. pois: how many big targets. nuclear: whether the nuclear plant may be one of them
export function buildTown(scene, { size, pois: poiN, nuclear, hemi, sun }) {
  const cols = size, rows = size, seed = (Math.random() * 1e6) | 0, rng = mulberry32(seed);
  const maze = generateMaze(cols, rows, Math.floor(cols * rows * 0.12), rng);
  const mid = (cols - 1) / 2; for (let i = 1; i < cols - 1; i++) { maze[mid][i] = false; maze[i][mid] = false; } maze.avenues = { row: mid, col: mid };
  if (cols >= 33) for (const q of [Math.round((cols - 1) / 4) | 1, Math.round((cols - 1) * 3 / 4) | 1]) for (let i = 1; i < cols - 1; i++) { maze[q][i] = false; maze[i][q] = false; }
  // the fairground: three rides side by side, facing an open street, away from the middle
  const farFromMid = (x, y) => Math.abs(x - mid) + Math.abs(y - mid) > cols * 0.3;
  let fy = rows - 4, fx0 = mid - 1; for (let k = 0; k < 60; k++) { const y = 3 + ((rng() * (rows - 7)) | 0), x = 2 + ((rng() * (cols - 7)) | 0); if (farFromMid(x + 1, y)) { fy = y; fx0 = x; break; } }
  for (let x = fx0; x <= fx0 + 2; x++) maze[fy][x] = true; for (let x = fx0 - 1; x <= fx0 + 3; x++) maze[fy + 1][x] = false;
  const near = (tx, ty) => { let best = null, bd = 1e9; for (let y = 2; y < rows - 2; y++) for (let x = 2; x < cols - 2; x++) { if (!maze[y][x] || (y === fy && x >= fx0 && x <= fx0 + 2)) continue; if (!(maze[y - 1][x] === false || maze[y + 1][x] === false || maze[y][x - 1] === false || maze[y][x + 1] === false)) continue; const d = Math.abs(x - tx) + Math.abs(y - ty); if (d < bd) { bd = d; best = [x, y]; } } return best; };
  const extra = EXTRA_POIS.slice(); for (let i = extra.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [extra[i], extra[j]] = [extra[j], extra[i]]; }
  const want = ['power', 'water', ...(nuclear ? ['nuclear'] : []), ...extra].slice(0, poiN - 1);
  const taken = [[fx0 + 1, fy]], cells = new Set([fy * cols + fx0, fy * cols + fx0 + 1, fy * cols + fx0 + 2]);
  const forced = new Map([[fy * cols + fx0, 'ferris'], [fy * cols + fx0 + 1, 'coaster'], [fy * cols + fx0 + 2, 'carousel']]);
  for (const k of want) { let at = null; // as far from the others as the map allows, never right in the middle where the ship starts
    for (let sep = cols * 0.35; !at && sep >= 2; sep *= 0.8) for (let t = 0; t < 60 && !at; t++) { const x = 2 + ((rng() * (cols - 4)) | 0), y = 2 + ((rng() * (rows - 4)) | 0); if (Math.abs(x - mid) + Math.abs(y - mid) <= cols * 0.2) continue; const n = near(x, y); if (n && !cells.has(n[1] * cols + n[0]) && taken.every(([ax, ay]) => Math.abs(ax - n[0]) + Math.abs(ay - n[1]) > sep)) at = n; }
    if (!at) continue; taken.push(at); cells.add(at[1] * cols + at[0]); forced.set(at[1] * cols + at[0], k); }
  maze.forcedLandmarks = forced;
  hemi.intensity = 1.7; sun.intensity = 0.9; const city = buildCity(scene, maze, 3 + (seed % 9973)); buildOutskirts(scene, cols, rows, seed); city.season.light(hemi, sun, scene); city.detail.clouds.visible = false; city.detail.clouds.material.opacity = 0;
  // big targets: each gathers its landmark pieces, a centre, and its hit points
  const pois = {}; for (const hz of city.hazards) { const k = ['ferris', 'coaster', 'carousel'].includes(hz.type) ? 'fair' : POI[hz.type] ? hz.type : null; if (k) (pois[k] = pois[k] || { hz: [], done: false }).hz.push(hz); }
  for (const k in pois) { const c = new THREE.Vector3(); for (const hz of pois[k].hz) c.add(hz.pos); const P = pois[k]; P.center = c.divideScalar(Math.max(1, P.hz.length)); P.reach = k === 'fair' ? 4.2 : 1.7; P.hp = P.max = POI[k].hp; }
  // buildings: where each stands, how tall, its box (for tapping it) and how many death-ray hits it takes (taller: more)
  const buildings = city.buildings.map((b) => { const obj = b.parent !== city.group ? b.parent : b; const wp = b.getWorldPosition(new THREE.Vector3()); const h = b.userData.h || 2; const box = new THREE.Box3().setFromObject(obj);
    return { b, obj, pos: wp, h, box, hp: h <= 3.3 ? 1 : h <= 6 ? 2 : 3, pts: Math.round((obj === b ? 70 : 55) * h), done: false }; });
  // fewer draw calls: each house's pieces and each shop's trim merge into a few meshes
  { const anim = new Set(city.season.anim.map((a) => a.m)); for (const x of buildings) { if (x.obj !== x.b) mergeStatic(x.obj, x.obj.children.filter((m) => !anim.has(m)));
    else { const ex = x.b.userData.extras || []; const map = mergeStatic(city.group, ex.filter((m) => !anim.has(m))); if (map.size) { const o = []; for (const e of ex) { const m = map.get(e) || e; if (!o.includes(m)) o.push(m); } x.b.userData.extras = o; } } } }
  // ---------- frame cost: the static town in 4x4-cell chunks, worked out once, switched off whole when out of view ----------
  const cg = city.group; cg.updateMatrixWorld(true); const keep = new Set();
  const mark = (o) => { while (o && o.parent && o.parent !== cg) o = o.parent; if (o && o.parent === cg) keep.add(o); };
  const liveDeco = city.season.anim.filter((a) => a.bob || a.wave).map((a) => a.m); for (const r of rides) for (const o of [r.wheel, r.platform, ...(r.cars || [])]) if (o) mark(o); for (const s of spinners) mark(s.obj);
  const map = new Map(), bb = new THREE.Box3(), sz = new THREE.Vector3(), ctr = new THREE.Vector3(), span = CHUNK * CELL, ox = cols * CELL / 2, oz = rows * CELL / 2;
  for (const o of cg.children.slice()) { if (keep.has(o) || o.isLight || o.isPoints) continue; bb.setFromObject(o); if (bb.isEmpty()) { if (!o.isLine) continue; o.getWorldPosition(ctr); bb.setFromCenterAndSize(ctr, sz.set(0.1, 0.1, 0.1)); }
    bb.getSize(sz); if (Math.max(sz.x, sz.z) > span * 1.5) continue; bb.getCenter(ctr);
    const key = Math.floor((ctr.x + ox) / span) + ',' + Math.floor((ctr.z + oz) / span); let ch = map.get(key); if (!ch) { ch = new THREE.Group(); ch.isChunk = true; ch.box = new THREE.Box3(); map.set(key, ch); cg.add(ch); } ch.add(o); ch.box.union(bb); }
  // the scenery nothing ever moves (roads, trees, lamps, fences...) is baked into a few meshes per chunk
  const own = new Set(); for (const x of buildings) { own.add(x.obj); own.add(x.b); for (const m of x.b.userData.extras || []) own.add(m); }
  for (const pr of city.props) own.add(pr.g); for (const hz of city.hazards) for (const p of hz.parts || []) own.add(p); for (const a of city.season.anim) own.add(a.m);
  for (const ch of map.values()) { const list = []; for (const o of ch.children.slice()) { if (own.has(o)) continue; let skip = false; o.traverse((m) => { if (own.has(m) || m.isLine || m.isPoints || m.isInstancedMesh) skip = true; }); if (skip) continue;
      o.traverse((m) => { if (m.isMesh) list.push(m); }); }
    for (const m of list) if (m.parent !== ch) ch.attach(m); mergeStatic(ch, list);
    const props = city.props.filter((pr) => pr.g.parent === ch && !pr.knocked); const bk = bakeMovable(ch, props.map((pr) => pr.g)); if (bk) for (const pr of props) pr.bake = bk; }
  // whole buildings and landmarks are baked too, a few meshes per chunk for the lot
  setBakedGlow(1); const baked = new Map(), keyOf = new Map(), skipM = new Set(); for (const a of city.season.anim) a.m.traverse((m) => skipM.add(m));
  const unitsOf = new Map(), put = (ch, key, o) => { if (!ch || !ch.isChunk) return; let U = unitsOf.get(ch); if (!U) unitsOf.set(ch, (U = new Map())); let u = U.get(key); if (!u) U.set(key, (u = { key, objs: [] })); u.objs.push(o); keyOf.set(o, key); };
  for (const x of buildings) { put(x.obj.parent, x, x.obj); if (x.obj === x.b) for (const m of x.b.userData.extras || []) if (m.parent === x.obj.parent) put(m.parent, x, m); }
  for (const hz of city.hazards) for (const p of hz.parts || []) put(p.parent, hz, p);
  for (const [ch, U] of unitsOf) { const bk = bakeUnits(ch, [...U.values()], skipM); for (const key of U.keys()) { let l = baked.get(key); if (!l) baked.set(key, (l = [])); l.push(bk); } }
  const chunks = [...map.values()]; for (const ch of chunks) { ch.box.expandByScalar(0.5); ch.updateMatrixWorld(true); ch.updateMatrixWorld = noop; }
  const live = (key) => { const l = baked.get(key); if (!l) return; baked.delete(key); for (const bk of l) bk.unbake(key); }; // out of the bake: its own meshes show again
  const free = (o) => { const k = keyOf.get(o); if (k) live(k); if (o && o.parent && o.parent.isChunk) cg.attach(o); }; // back to the live group before anything moves it
  const freeKnocked = () => { for (const pr of city.props) if (pr.knocked && pr.g.parent && pr.g.parent.isChunk) { if (pr.bake) { pr.bake.unbake(pr.g); pr.bake = null; } free(pr.g); } };
  const frus = new THREE.Frustum(), projM = new THREE.Matrix4();
  const cull = (cam) => { cam.updateMatrixWorld(); projM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frus.setFromProjectionMatrix(projM); for (const ch of chunks) ch.visible = frus.intersectsBox(ch.box);
    for (const m of liveDeco) { let o = m.parent; while (o && !o.isChunk) o = o.parent; if (!o || o.visible) m.updateMatrixWorld(true); } };
  const roads = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (!maze[y][x]) roads.push([x, y]);
  return { cols, rows, maze, city, buildings, pois, roads, chunks, lim: toWorld(cols - 1, rows - 1, cols, rows), seed, rng, live, free, freeKnocked, cull };
}
