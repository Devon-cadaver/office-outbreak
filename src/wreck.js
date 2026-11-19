// Real wreckage. When a building is torn down its own meshes (walls with their windows, roof, shopfront, whatever was on
// it) are cut along jagged cracks into irregular pieces, each keeping its texture and colour, with the raw inside showing
// on the back of every wall piece and the floor slabs within. The game then moves each piece like any other bit of debris.
// However many pieces are flying, they are drawn as one mesh per kind of surface (the same few materials the standing town
// uses, so they match it exactly); a piece's vertices are simply rewritten in place when it moves.
import * as THREE from 'three';
import { bucketOf } from './perf.js';

const CAP = { T: 21000, L: 48000, B: 3000 }, MAXT = 5600; // vertices per kind of surface; triangles one building may be cut into
const TP = new Float32Array(MAXT * 9), TN = new Float32Array(MAXT * 9), TU = new Float32Array(MAXT * 6), TC = new Float32Array(MAXT * 9), TB = new Uint8Array(MAXT), TS = new Uint8Array(MAXT), TF = new Uint8Array(MAXT);
const flatCache = new WeakMap(), flatGeo = (g) => { if (!g.index) return g; let f = flatCache.get(g); if (!f) flatCache.set(g, (f = g.toNonIndexed())); return f; };
const v = new THREE.Vector3(), mtx = new THREE.Matrix4(), nm = new THREE.Matrix3();
const INSIDE = [0x3b3632, 0x443c34, 0x33302e, 0x4a4038], SLAB = 0x6a6258;

export function createWreckage(scene) {
  const buckets = new Map(); let plain = null;
  function bucket(b) { let B = buckets.get(b.key);
    if (!B) { const cap = CAP[b.key[0]] || 6000, g = new THREE.BufferGeometry(), mk = (n) => { const a = new THREE.BufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
      B = { cap, used: 0, live: 0, parts: [], pos: mk(3), nor: mk(3), col: b.tint ? mk(3) : null, uv: b.uv ? mk(2) : null, geo: g, d0: 1e9, d1: 0, s0: 1e9, s1: 0 };
      g.setAttribute('position', B.pos); g.setAttribute('normal', B.nor); if (B.col) g.setAttribute('color', B.col); if (B.uv) g.setAttribute('uv', B.uv); g.setDrawRange(0, 0);
      B.mesh = new THREE.Mesh(g, b.mat); B.mesh.frustumCulled = false; buckets.set(b.key, B); }
    if (B.mesh.parent !== scene) scene.add(B.mesh); return B; }
  // squeeze out the gaps left by pieces that have gone
  function compact(B) { B.parts = B.parts.filter((p) => !p.dead).sort((a, b) => a.start - b.start); let at = 0;
    for (const p of B.parts) { if (p.start !== at) { B.pos.array.copyWithin(at * 3, p.start * 3, (p.start + p.count) * 3); B.nor.array.copyWithin(at * 3, p.start * 3, (p.start + p.count) * 3); if (B.col) B.col.array.copyWithin(at * 3, p.start * 3, (p.start + p.count) * 3); if (B.uv) B.uv.array.copyWithin(at * 2, p.start * 2, (p.start + p.count) * 2); p.start = at; } at += p.count; }
    B.used = at; B.geo.setDrawRange(0, at); B.d0 = B.s0 = 0; B.d1 = B.s1 = at; }
  function alloc(B, n) { if (B.used + n > B.cap) compact(B); if (B.used + n > B.cap) return null; const p = { B, start: B.used, count: n, base: new Float32Array(n * 3), dead: false }; B.used += n; B.live++; B.parts.push(p); B.geo.setDrawRange(0, B.used); B.s0 = Math.min(B.s0, p.start); B.s1 = Math.max(B.s1, B.used); return p; }
  const load = () => { let u = 0, c = 0; for (const B of buckets.values()) { u += B.used; c += B.cap; } return c ? u / c : 0; };

  // Cut these meshes up. o = { coarse: fewer, bigger pieces; floors: how many floor slabs to put inside; box: { min, max } of the
  // building's body, for the slabs }. Returns the pieces: [{ parts, centre, n (the way its outside faces), r }]
  function fracture(meshes, o = {}) {
    if (!plain) plain = bucketOf(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const coarse = !!o.coarse || load() > 0.55, limit = coarse ? 1500 : 3000, bl = []; let n = 0; const bi = (b) => { let i = bl.findIndex((x) => x.b.key === b.key); if (i < 0) { bl.push({ b, one: b.key[0] === 'T' && b.mat.side === THREE.FrontSide }); /* one: a wall face, which needs a back */ i = bl.length - 1; } return i; };
    // 1. every triangle, in world space, with its texture coordinates and colour
    for (const m of meshes) { const g = flatGeo(m.geometry), P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color; if (!P || !Nn) continue;
      const mats = Array.isArray(m.material) ? m.material : [m.material], groups = Array.isArray(m.material) ? g.groups : [{ start: 0, count: P.count, materialIndex: 0 }];
      m.updateWorldMatrix(true, false); mtx.copy(m.matrixWorld); nm.getNormalMatrix(mtx);
      for (const gr of groups) { const mt = mats[gr.materialIndex], b = bucketOf(mt); if (!b) continue; const k = bi(b), c = mt.color, vc = mt.vertexColors && C, end = Math.min(P.count, gr.start + gr.count);
        for (let s = gr.start; s + 2 < end + 0 && n < limit; s += 3) { for (let j = 0; j < 3; j++) { const q = s + j;
            v.fromBufferAttribute(P, q).applyMatrix4(mtx); TP[n * 9 + j * 3] = v.x; TP[n * 9 + j * 3 + 1] = v.y; TP[n * 9 + j * 3 + 2] = v.z;
            v.fromBufferAttribute(Nn, q).applyMatrix3(nm).normalize(); TN[n * 9 + j * 3] = v.x; TN[n * 9 + j * 3 + 1] = v.y; TN[n * 9 + j * 3 + 2] = v.z;
            if (b.uv) { TU[n * 6 + j * 2] = (U ? U.getX(q) : 0) * b.rep.x + b.off.x; TU[n * 6 + j * 2 + 1] = (U ? U.getY(q) : 0) * b.rep.y + b.off.y; }
            if (b.tint) { TC[n * 9 + j * 3] = c.r * (vc ? C.getX(q) : 1); TC[n * 9 + j * 3 + 1] = c.g * (vc ? C.getY(q) : 1); TC[n * 9 + j * 3 + 2] = c.b * (vc ? C.getZ(q) : 1); } }
          TB[n] = k; TF[n] = 0; n++; } } }
    if (!n) return [];
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9; for (let i = 0; i < n * 9; i += 3) { if (TP[i] < x0) x0 = TP[i]; if (TP[i] > x1) x1 = TP[i]; if (TP[i + 1] < y0) y0 = TP[i + 1]; if (TP[i + 1] > y1) y1 = TP[i + 1]; if (TP[i + 2] < z0) z0 = TP[i + 2]; if (TP[i + 2] > z1) z1 = TP[i + 2]; }
    // 2. floor slabs inside (top and underside), so what comes away is pieces of a building and not an empty shell
    if (o.floors && o.box) { const k = bi(plain), bx = o.box, in0 = 0.1, sc = new THREE.Color(SLAB), fl = Math.min(o.floors, coarse ? 3 : 6), hgt = bx.max.y - bx.min.y;
      for (let f = 1; f <= fl && n + 4 < MAXT; f++) { const y = bx.min.y + (hgt * f) / (fl + 1), X0 = bx.min.x + in0, X1 = bx.max.x - in0, Z0 = bx.min.z + in0, Z1 = bx.max.z - in0;
        for (const [up, pts] of [[1, [X0, Z0, X0, Z1, X1, Z1, X0, Z0, X1, Z1, X1, Z0]], [-1, [X0, Z0, X1, Z1, X0, Z1, X0, Z0, X1, Z0, X1, Z1]]]) for (let t = 0; t < 2; t++) { for (let j = 0; j < 3; j++) { TP[n * 9 + j * 3] = pts[t * 6 + j * 2]; TP[n * 9 + j * 3 + 1] = y + (up > 0 ? 0.05 : -0.05); TP[n * 9 + j * 3 + 2] = pts[t * 6 + j * 2 + 1]; TN[n * 9 + j * 3] = 0; TN[n * 9 + j * 3 + 1] = up; TN[n * 9 + j * 3 + 2] = 0; TC[n * 9 + j * 3] = sc.r * (up > 0 ? 1 : 0.6); TC[n * 9 + j * 3 + 1] = sc.g * (up > 0 ? 1 : 0.6); TC[n * 9 + j * 3 + 2] = sc.b * (up > 0 ? 1 : 0.6); } TB[n] = k; TF[n] = 1; n++; } } }
    // 3. big flat walls are only two triangles: halve the longest edge of anything large until there is something to crack
    const span = Math.max(x1 - x0, y1 - y0, z1 - z0), maxE = Math.max(0.5, Math.min(1.5, span / 5)) * (coarse ? 1.7 : 1), maxE2 = maxE * maxE, cap = Math.min(MAXT - 1, coarse ? 1700 : 3400);
    for (let i = 0; i < n; ) { const p = i * 9, e = (a, b) => { const dx = TP[p + a * 3] - TP[p + b * 3], dy = TP[p + a * 3 + 1] - TP[p + b * 3 + 1], dz = TP[p + a * 3 + 2] - TP[p + b * 3 + 2]; return dx * dx + dy * dy + dz * dz; };
      const e01 = e(0, 1), e12 = e(1, 2), e20 = e(2, 0), big = Math.max(e01, e12, e20); if (big <= maxE2 || n >= cap) { i++; continue; }
      const [a, b, c] = big === e01 ? [0, 1, 2] : big === e12 ? [1, 2, 0] : [2, 0, 1], q = n * 9, u = i * 6, w = n * 6; // split edge a-b at its middle: (a, mid, c) stays here, (mid, b, c) is new
      for (let d = 0; d < 3; d++) { const mp = (TP[p + a * 3 + d] + TP[p + b * 3 + d]) / 2, mn = (TN[p + a * 3 + d] + TN[p + b * 3 + d]) / 2, mc = (TC[p + a * 3 + d] + TC[p + b * 3 + d]) / 2;
        TP[q + d] = mp; TP[q + 3 + d] = TP[p + b * 3 + d]; TP[q + 6 + d] = TP[p + c * 3 + d]; TN[q + d] = mn; TN[q + 3 + d] = TN[p + b * 3 + d]; TN[q + 6 + d] = TN[p + c * 3 + d]; TC[q + d] = mc; TC[q + 3 + d] = TC[p + b * 3 + d]; TC[q + 6 + d] = TC[p + c * 3 + d];
        TP[p + b * 3 + d] = mp; TN[p + b * 3 + d] = mn; TC[p + b * 3 + d] = mc; }
      for (let d = 0; d < 2; d++) { const mu = (TU[u + a * 2 + d] + TU[u + b * 2 + d]) / 2; TU[w + d] = mu; TU[w + 2 + d] = TU[u + b * 2 + d]; TU[w + 4 + d] = TU[u + c * 2 + d]; TU[u + b * 2 + d] = mu; }
      TB[n] = TB[i]; TF[n] = TF[i]; n++; }
    // 4. crack lines: scatter points through the building; every triangle goes with the point nearest its middle
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0, nx = sx > 3.2 ? 3 : 2, nz = sz > 3.2 ? 3 : 2, ny = Math.max(1, Math.min(coarse ? 3 : 5, Math.round(sy / 1.2))), K = nx * ny * nz, S = new Float32Array(K * 3); let si = 0;
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) { S[si++] = x0 + (ix + 0.5 + (Math.random() - 0.5) * 0.7) * sx / nx; S[si++] = y0 + (iy + 0.5 + (Math.random() - 0.5) * 0.7) * sy / ny; S[si++] = z0 + (iz + 0.5 + (Math.random() - 0.5) * 0.7) * sz / nz; }
    const nb = bl.length, cnt = new Uint16Array(K * nb), back = new Uint16Array(K), sum = new Float32Array(K * 7);
    for (let i = 0; i < n; i++) { const p = i * 9, cx = (TP[p] + TP[p + 3] + TP[p + 6]) / 3, cy = (TP[p + 1] + TP[p + 4] + TP[p + 7]) / 3, cz = (TP[p + 2] + TP[p + 5] + TP[p + 8]) / 3; let best = 0, bd = 1e9;
      for (let s = 0; s < K; s++) { const dx = cx - S[s * 3], dy = cy - S[s * 3 + 1], dz = cz - S[s * 3 + 2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = s; } }
      TS[i] = best; cnt[best * nb + TB[i]]++; if (bl[TB[i]].one && !TF[i]) back[best]++; const q = best * 7; sum[q] += cx; sum[q + 1] += cy; sum[q + 2] += cz; sum[q + 3]++; if (!TF[i]) { sum[q + 4] += TN[p]; sum[q + 5] += TN[p + 1]; sum[q + 6] += TN[p + 2]; } }
    // 5. one piece per point: its triangles go into the shared buffers, kept relative to the piece's own middle
    const out = [], parts = new Array(K * (nb + 1)).fill(null), cur = new Uint16Array(K * (nb + 1)), PB = bucket(plain), THICK = 0.11;
    for (let s = 0; s < K; s++) { const q = s * 7; if (!sum[q + 3]) continue; const f = { parts: [], centre: new THREE.Vector3(sum[q] / sum[q + 3], sum[q + 1] / sum[q + 3], sum[q + 2] / sum[q + 3]), n: new THREE.Vector3(sum[q + 4], sum[q + 5], sum[q + 6]), r: 0 };
      if (f.n.lengthSq() < 0.01) f.n.set(0, 1, 0); f.n.normalize();
      for (let k = 0; k < nb; k++) if (cnt[s * nb + k]) { const p = alloc(bucket(bl[k].b), cnt[s * nb + k] * 3); if (p) { parts[s * (nb + 1) + k] = p; f.parts.push(p); } }
      if (back[s]) { const p = alloc(PB, back[s] * 3); if (p) { parts[s * (nb + 1) + nb] = p; f.parts.push(p); } }
      if (f.parts.length) { f.s = s; out.push(f); } }
    const cen = new Map(out.map((f) => [f.s, f])), ic = new THREE.Color();
    for (let i = 0; i < n; i++) { const s = TS[i], f = cen.get(s); if (!f) continue; const k = TB[i], p = parts[s * (nb + 1) + k], t = i * 9, C0 = f.centre;
      if (p) { const B = p.B, w = cur[s * (nb + 1) + k]++ * 3, at = (p.start + w) * 3; for (let j = 0; j < 9; j += 3) { const lx = TP[t + j] - C0.x, ly = TP[t + j + 1] - C0.y, lz = TP[t + j + 2] - C0.z; p.base[w * 3 + j] = lx; p.base[w * 3 + j + 1] = ly; p.base[w * 3 + j + 2] = lz; f.r = Math.max(f.r, Math.hypot(lx, ly, lz));
          B.pos.array[at + j] = TP[t + j]; B.pos.array[at + j + 1] = TP[t + j + 1]; B.pos.array[at + j + 2] = TP[t + j + 2]; B.nor.array[at + j] = TN[t + j]; B.nor.array[at + j + 1] = TN[t + j + 1]; B.nor.array[at + j + 2] = TN[t + j + 2];
          if (B.col) { B.col.array[at + j] = TC[t + j]; B.col.array[at + j + 1] = TC[t + j + 1]; B.col.array[at + j + 2] = TC[t + j + 2]; } }
        if (B.uv) for (let j = 0; j < 3; j++) { B.uv.array[(p.start + w + j) * 2] = TU[i * 6 + j * 2]; B.uv.array[(p.start + w + j) * 2 + 1] = TU[i * 6 + j * 2 + 1]; } }
      // the back of a wall piece: the same triangle turned round, set in a little, in the colour of what walls are made of
      const bp = bl[k].one && !TF[i] ? parts[s * (nb + 1) + nb] : null;
      if (bp) { const B = bp.B, w = cur[s * (nb + 1) + nb]++ * 3, at = (bp.start + w) * 3; ic.setHex(INSIDE[s % INSIDE.length]);
        for (let j = 0; j < 3; j++) { const sj = (j === 0 ? 0 : j === 1 ? 2 : 1) * 3, lx = TP[t + sj] - TN[t + sj] * THICK - C0.x, ly = TP[t + sj + 1] - TN[t + sj + 1] * THICK - C0.y, lz = TP[t + sj + 2] - TN[t + sj + 2] * THICK - C0.z, o3 = j * 3;
          bp.base[w * 3 + o3] = lx; bp.base[w * 3 + o3 + 1] = ly; bp.base[w * 3 + o3 + 2] = lz; B.pos.array[at + o3] = lx + C0.x; B.pos.array[at + o3 + 1] = ly + C0.y; B.pos.array[at + o3 + 2] = lz + C0.z;
          B.nor.array[at + o3] = -TN[t + sj]; B.nor.array[at + o3 + 1] = -TN[t + sj + 1]; B.nor.array[at + o3 + 2] = -TN[t + sj + 2]; B.col.array[at + o3] = ic.r; B.col.array[at + o3 + 1] = ic.g; B.col.array[at + o3 + 2] = ic.b; } } }
    return out;
  }
  // move a piece to where this object is (position, rotation, scale)
  function place(f, obj) { obj.updateMatrix(); const e = obj.matrix.elements;
    for (const p of f.parts) { if (p.dead) continue; const B = p.B, a = B.pos.array, b = p.base, n = p.count * 3; let o = p.start * 3;
      for (let i = 0; i < n; i += 3, o += 3) { const x = b[i], y = b[i + 1], z = b[i + 2]; a[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; a[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; a[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
      if (p.start < B.d0) B.d0 = p.start; if (p.start + p.count > B.d1) B.d1 = p.start + p.count; } }
  function free(f) { for (const p of f.parts) { if (p.dead) continue; p.dead = true; const B = p.B, a = B.pos.array; for (let i = p.start * 3, e = (p.start + p.count) * 3; i < e; i += 3) { a[i] = 0; a[i + 1] = -60; a[i + 2] = 0; }
      if (p.start < B.d0) B.d0 = p.start; if (p.start + p.count > B.d1) B.d1 = p.start + p.count; if (--B.live <= 0) { B.live = 0; B.used = 0; B.parts.length = 0; B.geo.setDrawRange(0, 0); B.d0 = B.s0 = 1e9; B.d1 = B.s1 = 0; } } f.parts.length = 0; }
  // once a frame: send what moved (one stretch per buffer), and anything newly cut
  function flush() { for (const B of buckets.values()) { const up = (a, w, lo, hi) => { a.clearUpdateRanges(); a.addUpdateRange(lo * w, (hi - lo) * w); a.needsUpdate = true; };
      if (B.s1 > B.s0) { up(B.nor, 3, B.s0, B.s1); if (B.col) up(B.col, 3, B.s0, B.s1); if (B.uv) up(B.uv, 2, B.s0, B.s1); B.d0 = Math.min(B.d0, B.s0); B.d1 = Math.max(B.d1, B.s1); B.s0 = 1e9; B.s1 = 0; }
      if (B.d1 > B.d0) { up(B.pos, 3, B.d0, B.d1); B.d0 = 1e9; B.d1 = 0; } } }
  function clear() { for (const B of buckets.values()) { for (const p of B.parts) p.dead = true; B.parts.length = 0; B.used = 0; B.live = 0; B.geo.setDrawRange(0, 0); B.d0 = B.s0 = 1e9; B.d1 = B.s1 = 0; } }
  return { fracture, place, free, flush, clear, get load() { return load(); }, get verts() { let u = 0; for (const B of buckets.values()) u += B.used; return u; } };
}
