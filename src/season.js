// Seasonal dressing for the city: Halloween, Christmas and the 4th of July.
// city.js calls the hooks while it builds (houses, shops, parks, street trees) and ticks update() each frame.
import * as THREE from 'three';

export const SEASONS = [['none', 'No season'], ['halloween', 'Halloween'], ['christmas', 'Christmas'], ['july4', '4th of July']];
export function getSeason() { const q = new URLSearchParams(location.search).get('season'); if (q) return q; try { return localStorage.getItem('oo_season') || 'none'; } catch { return 'none'; } }
export function setSeason(s) { try { localStorage.setItem('oo_season', s); } catch { /* ignore */ } }
export function bindSeasonSelect(sel) { if (!sel) return; sel.innerHTML = SEASONS.map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join(''); sel.value = getSeason(); sel.addEventListener('change', () => setSeason(sel.value)); }

const box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(0.5, 8, 6), cone = new THREE.ConeGeometry(0.5, 1, 8), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8), ring = new THREE.TorusGeometry(0.5, 0.12, 6, 12);
const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o }), B = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });

let flagTex = null;
function flagTexture() {
  if (flagTex) return flagTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 40; const g = c.getContext('2d');
  for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#c62828'; g.fillRect(0, i * 40 / 13, 64, 40 / 13 + 0.5); }
  g.fillStyle = '#1e3a8a'; g.fillRect(0, 0, 26, 21); g.fillStyle = '#fff'; for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) g.fillRect(2 + x * 5 + (y % 2) * 2, 2 + y * 5, 2, 2);
  flagTex = new THREE.CanvasTexture(c); flagTex.magFilter = THREE.NearestFilter; return flagTex;
}

export function createSeason(scene, group, rng, W, D) {
  const season = getSeason(); const anim = []; const sites = []; const none = season === 'none';
  const mesh = (parent, geo, mat, sx, sy, sz, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  // palettes
  const orange = B(0xff8a1a), purpleG = B(0xb05cff), greenG = B(0x7dff3a), white = M(0xf2f2f2), snow = M(0xf4f8ff), black = M(0x111111), bone = M(0xe8e2c8), wood = M(0x5a3a22), iron = M(0x1a1a22), pine = M(0x1f5a2f, { flatShading: true }), red = M(0xc62828), blue = M(0x1e3a8a), gold = B(0xffd24a);
  const bulbMats = { halloween: [orange, purpleG, greenG], christmas: [B(0xff3a3a), B(0x3aff5a), B(0x4a8aff), B(0xffd24a)], july4: [B(0xff4a4a), B(0xffffff), B(0x4a7aff)] }[season] || [];
  const wire = B(0x111111);
  const stringLights = (parent, x0, x1, y, z, n = 9) => { mesh(parent, box, wire, Math.abs(x1 - x0), 0.02, 0.02, (x0 + x1) / 2, y, z); for (let i = 0; i < n; i++) mesh(parent, ball, bulbMats[i % bulbMats.length], 0.08, 0.1, 0.08, x0 + (x1 - x0) * i / (n - 1), y - 0.06, z); };
  const pumpkin = (parent, x, z, s = 1, lit = true) => { const p = new THREE.Group(); p.position.set(x, 0.1 * s, z); p.rotation.y = rng() * 6; parent.add(p); mesh(p, ball, lit ? orange : M(0xe07a1a), 0.3 * s, 0.22 * s, 0.3 * s, 0, 0, 0); mesh(p, cyl, M(0x3a6a2a), 0.04 * s, 0.08 * s, 0.04 * s, 0, 0.13 * s, 0);
    if (lit) { for (const ex of [-0.05, 0.05]) mesh(p, box, black, 0.05 * s, 0.05 * s, 0.03 * s, ex * s, 0.03 * s, 0.14 * s); mesh(p, box, black, 0.12 * s, 0.03 * s, 0.03 * s, 0, -0.05 * s, 0.14 * s); } return p; };
  const ghost = (parent, x, y, z) => { const g = mesh(parent, cone, B(0xffffff, { transparent: true, opacity: 0.75 }), 0.26, 0.42, 0.26, x, y, z); mesh(g, ball, black, 0.18, 0.18, 0.18, -0.13, 0.15, 0.3); mesh(g, ball, black, 0.18, 0.18, 0.18, 0.13, 0.15, 0.3); anim.push({ m: g, y, k: rng() * 6, bob: 0.07 }); return g; };
  const tombstone = (parent, x, z, ry = 0) => { const t = mesh(parent, box, M(0x8a8f96), 0.22, 0.3, 0.07, x, 0.15, z, ry); mesh(t, cyl, M(0x8a8f96), 1, 0.23, 1, 0, 0.5, 0).rotation.x = Math.PI / 2; return t; };
  const cross = (parent, x, z) => { mesh(parent, box, M(0x8a8f96), 0.06, 0.4, 0.06, x, 0.2, z); mesh(parent, box, M(0x8a8f96), 0.22, 0.06, 0.06, x, 0.3, z); };
  const bones = (parent, x, z) => { for (let i = 0; i < 4; i++) mesh(parent, box, bone, 0.26, 0.04, 0.04, x + (rng() - 0.5) * 0.3, 0.03, z + (rng() - 0.5) * 0.3, rng() * 3); mesh(parent, ball, bone, 0.14, 0.12, 0.15, x, 0.07, z); };
  const scarecrow = (parent, x, z) => { mesh(parent, cyl, wood, 0.05, 1.1, 0.05, x, 0.55, z); mesh(parent, box, wood, 0.6, 0.05, 0.05, x, 0.85, z); mesh(parent, box, M(0x6a4a8a), 0.3, 0.4, 0.14, x, 0.75, z); mesh(parent, ball, orange, 0.2, 0.18, 0.2, x, 1.06, z); mesh(parent, cone, black, 0.3, 0.2, 0.3, x, 1.2, z); };
  const sign = (parent, x, z, ry) => { mesh(parent, box, wood, 0.05, 0.5, 0.05, x, 0.25, z); mesh(parent, box, M(0x8a6a3a), 0.5, 0.18, 0.04, x, 0.45, z, ry); };
  const ironFence = (parent, x0, x1, z, gap = true) => { for (let x = x0; x <= x1 + 0.001; x += 0.25) { if (gap && Math.abs(x) < 0.35) continue; mesh(parent, box, iron, 0.03, 0.45, 0.03, x, 0.22, z); mesh(parent, cone, iron, 0.06, 0.08, 0.06, x, 0.48, z); } for (const s of gap ? [[x0, -0.35], [0.35, x1]] : [[x0, x1]]) mesh(parent, box, iron, s[1] - s[0], 0.03, 0.03, (s[0] + s[1]) / 2, 0.36, z); };
  const cauldron = (parent, x, z) => { mesh(parent, ball, black, 0.4, 0.34, 0.4, x, 0.2, z); const goo = mesh(parent, cyl, greenG, 0.3, 0.04, 0.3, x, 0.34, z); anim.push({ m: goo, pulse: true, k: rng() * 6 }); for (const a of [0, 2.1, 4.2]) mesh(parent, box, black, 0.04, 0.12, 0.04, x + Math.cos(a) * 0.15, 0.05, z + Math.sin(a) * 0.15); };
  const web = (parent, x, y, z, ry) => { const pts = []; for (let i = 0; i <= 4; i++) { const a = i / 4 * Math.PI / 2; pts.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.3, -Math.sin(a) * 0.3, 0)); } for (let r = 0.1; r <= 0.3; r += 0.1) for (let i = 0; i < 4; i++) { const a0 = i / 4 * Math.PI / 2, a1 = (i + 1) / 4 * Math.PI / 2; pts.push(new THREE.Vector3(Math.cos(a0) * r, -Math.sin(a0) * r, 0), new THREE.Vector3(Math.cos(a1) * r, -Math.sin(a1) * r, 0)); }
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 })); l.position.set(x, y, z); l.rotation.y = ry; parent.add(l); };
  const deadTree = (parent, x, z, s = 1) => { mesh(parent, cyl, M(0x3a2a1e), 0.16 * s, 1.1 * s, 0.1 * s, x, 0.55 * s, z); for (let i = 0; i < 4; i++) { const b = mesh(parent, cyl, M(0x3a2a1e), 0.06 * s, 0.7 * s, 0.04 * s, x, 1.1 * s, z); b.rotation.set((rng() - 0.5) * 1.4, i * 1.6, (rng() - 0.5) * 1.4); b.position.x += Math.cos(i * 1.6) * 0.2 * s; b.position.z += Math.sin(i * 1.6) * 0.2 * s; } };
  const uvBar = (parent, x, y, z, w, ry = 0) => mesh(parent, box, B(0xb05cff), w, 0.05, 0.05, x, y, z, ry);
  // christmas
  const xmasTree = (parent, x, z, s = 1) => { mesh(parent, cyl, wood, 0.12 * s, 0.3 * s, 0.12 * s, x, 0.15 * s, z); for (let i = 0; i < 3; i++) mesh(parent, cone, pine, (0.9 - i * 0.2) * s, 0.6 * s, (0.9 - i * 0.2) * s, x, (0.5 + i * 0.35) * s, z); for (let i = 0; i < 10; i++) { const a = i * 1.9, h = 0.3 + (i % 5) * 0.2; mesh(parent, ball, bulbMats[i % bulbMats.length], 0.07, 0.07, 0.07, x + Math.cos(a) * (0.45 - h * 0.3) * s, h * s, z + Math.sin(a) * (0.45 - h * 0.3) * s); } mesh(parent, new THREE.OctahedronGeometry(0.1), gold, s, s, s, x, 1.55 * s, z); };
  const snowman = (parent, x, z) => { mesh(parent, ball, snow, 0.5, 0.45, 0.5, x, 0.22, z); mesh(parent, ball, snow, 0.38, 0.34, 0.38, x, 0.55, z); mesh(parent, ball, snow, 0.28, 0.26, 0.28, x, 0.82, z); for (const ex of [-0.05, 0.05]) mesh(parent, ball, black, 0.04, 0.04, 0.04, x + ex, 0.86, z + 0.12); const nose = mesh(parent, cone, M(0xff8a1a), 0.05, 0.16, 0.05, x, 0.82, z + 0.18); nose.rotation.x = Math.PI / 2; mesh(parent, cyl, black, 0.26, 0.03, 0.26, x, 0.95, z); mesh(parent, cyl, black, 0.18, 0.14, 0.18, x, 1.02, z); mesh(parent, box, red, 0.3, 0.06, 0.06, x, 0.7, z + 0.1); };
  const wreath = (parent, x, y, z, ry = 0) => { const w = mesh(parent, ring, pine, 0.45, 0.45, 0.45, x, y, z, ry); mesh(w, ball, red, 0.25, 0.25, 0.25, 0, -0.45, 0); mesh(w, ball, red, 0.14, 0.14, 0.14, 0.3, 0.3, 0); mesh(w, ball, red, 0.14, 0.14, 0.14, -0.3, 0.3, 0); };
  const candyCane = (parent, x, z) => { mesh(parent, cyl, white, 0.05, 0.4, 0.05, x, 0.2, z); for (let i = 0; i < 4; i++) mesh(parent, cyl, red, 0.052, 0.04, 0.052, x, 0.05 + i * 0.1, z); const hook = mesh(parent, ring, white, 0.18, 0.18, 0.18, x + 0.04, 0.4, z); hook.rotation.y = Math.PI / 2; };
  const gift = (parent, x, z, c) => { const g = mesh(parent, box, M(c), 0.25, 0.2, 0.25, x, 0.1, z, rng() * 3); mesh(g, box, gold, 1.05, 1.05, 0.2, 0, 0, 0); mesh(g, box, gold, 0.2, 1.05, 1.05, 0, 0, 0); };
  const icicles = (parent, x0, x1, y, z) => { for (let x = x0; x <= x1; x += 0.22) { const ic = mesh(parent, cone, B(0xdff2ff, { transparent: true, opacity: 0.8 }), 0.05, 0.12 + rng() * 0.12, 0.05, x, y - 0.08, z); ic.rotation.x = Math.PI; } };
  // 4th of july
  const flag = (parent, x, z, s = 1, ry = 0) => { mesh(parent, cyl, white, 0.03 * s, 1.3 * s, 0.03 * s, x, 0.65 * s, z); mesh(parent, ball, gold, 0.06 * s, 0.06 * s, 0.06 * s, x, 1.32 * s, z); const f = mesh(parent, box, new THREE.MeshBasicMaterial({ map: flagTexture(), side: THREE.DoubleSide }), 0.5 * s, 0.3 * s, 0.01, x + 0.25 * s, 1.12 * s, z, ry); anim.push({ m: f, wave: true, k: rng() * 6, rx: f.rotation.y }); };
  const bunting = (parent, x0, x1, y, z) => { const mats = [red, white, blue]; let i = 0; for (let x = x0; x <= x1 + 0.001; x += 0.16) { const p = mesh(parent, cone, mats[i++ % 3], 0.14, 0.18, 0.02, x, y - 0.09, z); p.rotation.x = Math.PI; } mesh(parent, box, wire, x1 - x0, 0.02, 0.02, (x0 + x1) / 2, y, z); };
  const grill = (parent, x, z) => { mesh(parent, ball, black, 0.4, 0.3, 0.4, x, 0.45, z); mesh(parent, cyl, black, 0.4, 0.04, 0.4, x, 0.52, z); for (const a of [0.8, 2.4, 4]) mesh(parent, cyl, black, 0.03, 0.45, 0.03, x + Math.cos(a) * 0.14, 0.22, z + Math.sin(a) * 0.14); };
  const lawnChair = (parent, x, z, ry) => { const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; parent.add(c); mesh(c, box, red, 0.4, 0.04, 0.4, 0, 0.25, 0); mesh(c, box, blue, 0.4, 0.4, 0.04, 0, 0.45, -0.2); for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) mesh(c, box, white, 0.03, 0.25, 0.03, lx, 0.12, lz); };
  const star = (parent, x, y, z) => mesh(parent, new THREE.OctahedronGeometry(0.12), gold, 1, 1, 1, x, y, z);

  // ---- hooks ----
  const api = { season, sites };
  api.win = (lit, rr) => season === 'halloween' ? (rr() < 0.5 ? purpleG : greenG) : lit;
  api.house = (g, { bw, bd, bh, rh, rr }) => {
    if (none) return; const fz = bd / 2, ey = bh - 0.07, yard = fz + 0.42;
    if (season === 'halloween') {
      stringLights(g, -bw / 2 - 0.25, bw / 2 + 0.25, ey, fz + 0.28, 10);
      for (let i = 0, n = 1 + ((rr() * 3) | 0); i < n; i++) pumpkin(g, -0.95 + i * 0.3, fz + 0.22, 0.8 + rr() * 0.4);
      const r = rr();
      if (r < 0.35) { tombstone(g, 1.25, yard - 0.1, 0.2); if (rr() < 0.5) cross(g, 0.9, yard); } else if (r < 0.55) bones(g, 1.1, yard); else if (r < 0.75) scarecrow(g, 1.2, yard); else cauldron(g, 1.2, yard);
      if (rr() < 0.5) ghost(g, -bw / 2 - 0.2, 1.1, fz + 0.2); if (rr() < 0.5) web(g, bw / 2 + 0.03, bh - 0.1, fz + 0.01, 0); if (rr() < 0.4) sign(g, -1.3, yard, 0.4);
      if (rr() < 0.5) ironFence(g, -1.4, 1.4, fz + 0.52); if (rr() < 0.3) uvBar(g, -0.55, 0.78, fz + 0.2, 0.6); if (rr() < 0.35) deadTree(g, -1.25, fz - 0.6, 0.8);
    } else if (season === 'christmas') {
      stringLights(g, -bw / 2 - 0.25, bw / 2 + 0.25, ey, fz + 0.28, 11); for (const sx of [-1, 1]) stringLights(g, sx * (bw / 2 + 0.25), sx * (bw / 2 + 0.25), ey, 0, 1);
      const cap = new THREE.Mesh(g.children[1].geometry, snow); cap.scale.set(bw + 0.56, rh * 0.5, bd + 0.56); cap.position.y = bh + rh * 0.52; g.add(cap); // snow on the roof
      icicles(g, -bw / 2 - 0.2, bw / 2 + 0.2, ey, fz + 0.3); wreath(g, -0.55, 0.55, fz + 0.07);
      const r = rr(); if (r < 0.4) xmasTree(g, 1.2, yard - 0.05, 0.75); else if (r < 0.7) snowman(g, 1.2, yard); else { gift(g, 1.0, yard, 0xc62828); gift(g, 1.3, yard - 0.15, 0x1e8a4a); }
      if (rr() < 0.6) { candyCane(g, -1.0, yard); candyCane(g, -1.25, yard); } if (rr() < 0.3) mesh(g, box, snow, 2.9, 0.03, 0.9, 0, 0.015, fz + 0.55);
    } else if (season === 'july4') {
      bunting(g, -bw / 2 - 0.25, bw / 2 + 0.25, ey, fz + 0.3); stringLights(g, -bw / 2 - 0.2, bw / 2 + 0.2, bh + rh - 0.05, 0, 7);
      flag(g, 1.25, yard - 0.1, 1); if (rr() < 0.6) flag(g, -1.0, fz + 0.3, 0.45, 0.5); if (rr() < 0.5) flag(g, 0.75, fz + 0.3, 0.45, -0.5);
      const r = rr(); if (r < 0.4) grill(g, -1.25, yard); else if (r < 0.75) { lawnChair(g, -1.25, yard, 0.4); lawnChair(g, -0.9, yard + 0.05, 0.1); } else star(g, -1.2, 0.6, yard);
    }
  };
  api.business = (w, h, fp, addX, faces, edge) => {
    if (none || edge) return; const [dx, dz, ry] = faces.length ? faces[0] : [0, 1, 0]; const fx = w.x + dx * (fp / 2 + 0.05), fz = w.z + dz * (fp / 2 + 0.05);
    const along = (t) => [w.x + dx * (fp / 2 + 0.08) + dz * t, w.z + dz * (fp / 2 + 0.08) - dx * t];
    if (season === 'halloween') {
      const neon = addX(box, rng() < 0.5 ? greenG : purpleG, fp * 0.7, 0.16, 0.06, fx, 1.35, fz, ry); anim.push({ m: neon, pulse: true, k: rng() * 6 });
      for (let i = 0; i < 6; i++) { const [px, pz] = along(-fp * 0.35 + i * fp * 0.14); addX(ball, bulbMats[i % 3], 0.08, 0.1, 0.08, px, h + 0.12, pz); }
      const [p1x, p1z] = along(0.55); const pg = new THREE.Group(); pg.position.set(p1x, 0.1, p1z); group.add(pg); pumpkin(pg, 0, 0, 1); const [p2x, p2z] = along(-0.6); const pg2 = new THREE.Group(); pg2.position.set(p2x, 0.1, p2z); group.add(pg2); pumpkin(pg2, 0, 0, 0.8);
      addX(box, B(0xb05cff), fp * 0.5, 0.05, 0.05, fx, 1.1, fz, ry);
    } else if (season === 'christmas') {
      for (let i = 0; i < 9; i++) { const [px, pz] = along(-fp * 0.45 + i * fp * 0.11); addX(ball, bulbMats[i % 4], 0.08, 0.1, 0.08, px, h + 0.12, pz); }
      addX(box, snow, fp + 0.1, 0.08, fp + 0.1, w.x, h + 0.12, w.z); const wg = new THREE.Group(); wg.position.set(fx, 0, fz); wg.rotation.y = ry; group.add(wg); wreath(wg, 0, 1.0, 0.03);
    } else if (season === 'july4') {
      for (let i = 0; i < 12; i++) { const [px, pz] = along(-fp * 0.45 + i * fp * 0.08); const p = addX(cone, [red, white, blue][i % 3], 0.14, 0.18, 0.02, px, 1.3, pz, ry); p.rotation.x = Math.PI; }
      const [ax, az] = along(fp * 0.3); const fg = new THREE.Group(); fg.position.set(ax, h - 0.1, az); group.add(fg); flag(fg, 0, 0, 0.7, ry);
    }
  };
  api.tree = (sp, px, pz) => { if (season !== 'halloween') return false; const g = new THREE.Group(); g.position.set(px, 0, pz); sp.g.add(g); g.position.set(0, 0, 0); deadTree(g, 0, 0, 1.1); if (rng() < 0.4) ghost(g, 0.4, 1.3, 0.3); return true; };
  api.park = (wx, wz, prop) => { sites.push({ x: wx, z: wz }); if (none) return false; const r = rng(); if (r > 0.5) return false; const pg = new THREE.Group(); pg.position.set(wx, 0, wz); group.add(pg);
    if (season === 'halloween') { tombstone(pg, -0.5, 0, 0.3); tombstone(pg, 0.2, 0.3, -0.2); cross(pg, 0.6, -0.4); bones(pg, 0, 0.7); ironFence(pg, -1, 1, 1, false); }
    else if (season === 'christmas') { xmasTree(pg, 0, 0, 1.6); for (const [gx, gz, c] of [[-0.8, 0.6, 0xc62828], [0.9, 0.4, 0x1e8a4a], [0.3, -0.9, 0x1e3a8a]]) gift(pg, gx, gz, c); }
    else { flag(pg, 0, 0, 1.6); lawnChair(pg, -0.8, 0.6, 1); lawnChair(pg, 0.8, 0.6, -1); grill(pg, 0, -0.9); }
    return true; };
  api.light = (hemi, sun, scene) => { if (!hemi) return; const L = { halloween: [0xa070e0, 0x2a1a3a, 0xc0a0ff], christmas: [0xcfe6ff, 0x3a4a5a, 0xe0f0ff], july4: [0xffe6c8, 0x3a3a4a, 0xfff0d8] }[season]; if (!L) return; hemi.color.set(L[0]); hemi.groundColor.set(L[1]); if (sun) sun.color.set(L[2]); };

  // ---- particles: snow and fireworks ----
  let snowPts = null;
  if (season === 'christmas') { const N = 700; const pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) pos.set([(rng() - 0.5) * (W + 10), rng() * 20, (rng() - 0.5) * (D + 10)], i * 3); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); snowPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85 })); group.add(snowPts); }
  const sparks = [], sparkPool = []; let fwT = 2; const fwCols = [0xff4a4a, 0xffffff, 0x4a7aff, 0xffd24a, 0x7dff3a];
  const spark = (p, vel, col, life, s) => { let m = sparkPool.pop(); if (!m) { m = new THREE.Mesh(ball, B(0xffffff)); m.userData.mat = m.material; } m.material.color.set(col); m.position.copy(p); m.scale.setScalar(s); scene.add(m); sparks.push({ m, vel, life, max: life, s }); };
  const launch = () => { const site = sites.length ? sites[(rng() * sites.length) | 0] : { x: (rng() - 0.5) * W, z: (rng() - 0.5) * D }; const col = fwCols[(rng() * fwCols.length) | 0]; const s = { m: null, rocket: true, col, t: 0.9 + rng() * 0.5 }; spark(new THREE.Vector3(site.x, 0.3, site.z), new THREE.Vector3((rng() - 0.5) * 1.5, 11 + rng() * 3, (rng() - 0.5) * 1.5), 0xffe0a0, s.t, 0.12); sparks[sparks.length - 1].rocket = col; };
  const burst = (p, col) => { for (let i = 0; i < 46; i++) { const v = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(3.5 + rng() * 3); spark(p, v, rng() < 0.8 ? col : 0xffffff, 1.1 + rng() * 0.5, 0.16); } };
  api.update = (dt) => {
    for (const a of anim) { a.k += dt; if (a.bob) a.m.position.y = a.y + Math.sin(a.k * 2) * a.bob; else if (a.pulse) a.m.visible = Math.sin(a.k * 7) > -0.8; else if (a.wave) a.m.rotation.y = a.rx + Math.sin(a.k * 4) * 0.25; }
    if (snowPts) { const a = snowPts.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) { a[i + 1] -= dt * 1.4; a[i] += Math.sin(a[i + 1] + i) * dt * 0.3; if (a[i + 1] < 0) a[i + 1] += 20; } snowPts.geometry.attributes.position.needsUpdate = true; }
    if (season === 'july4') { fwT -= dt; if (fwT <= 0) { fwT = 1.2 + rng() * 2.5; launch(); } }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life -= dt; if (!s.rocket) s.vel.y -= 3.5 * dt; s.m.position.addScaledVector(s.vel, dt); s.m.scale.setScalar(s.s * (s.rocket ? 1 : Math.max(0.1, s.life / s.max)));
      if (s.life <= 0) { if (s.rocket) burst(s.m.position.clone(), s.rocket); scene.remove(s.m); sparkPool.push(s.m); sparks.splice(i, 1); } }
  };
  api.clear = () => { for (const s of sparks) scene.remove(s.m); sparks.length = 0; };
  return api;
}
