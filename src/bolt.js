// Lightning you can see on a phone: each bolt is a glowing ribbon (white-hot core inside a coloured glow) that always
// faces the camera, with forks, a flicker and a re-strike, instead of a one-pixel line. One draw call per bolt, and only
// a few are ever alive at once.
import * as THREE from 'three';

const VERT = `
attribute vec3 aOther; attribute vec3 aInfo; // aInfo: side (-1/+1), which end (+1 start, -1 end), width (1 = the main channel)
uniform float uWidth, uMinPx, uViewH; varying float vSide;
void main() {
  vSide = aInfo.x;
  vec4 mv = viewMatrix * vec4(position, 1.0), mo = viewMatrix * vec4(aOther, 1.0);
  vec2 d = (mo.xy - mv.xy) * aInfo.y; float l = length(d); d = l > 0.0001 ? d / l : vec2(0.0, 1.0);
  // never thinner on screen than uMinPx, however far the camera has pulled back
  float px = 2.0 / (projectionMatrix[1][1] * uViewH) * mix(-mv.z, 1.0, projectionMatrix[3][3]), w = aInfo.z * max(uWidth, uMinPx * px);
  mv.xy += vec2(-d.y, d.x) * aInfo.x * w - d * aInfo.y * w * 0.3; // each piece runs a little long, so the joints overlap instead of gaping
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 uCol, uGlow; uniform float uFade, uEdge; varying float vSide;
void main() {
  float c = 1.0 - abs(vSide), core = smoothstep(0.5, 0.82, c), halo = smoothstep(0.0, 0.65, c);
  if (uEdge > 0.5) gl_FragColor = vec4(mix(uGlow, uCol, smoothstep(0.22, 0.4, c)), smoothstep(0.0, 0.2, c) * uFade); // a dark outline instead of a glow
  else gl_FragColor = vec4(mix(uGlow, mix(uCol, vec3(1.0), 0.65), core), (halo * 0.5 + core) * uFade);
  #include <colorspace_fragment>
}`;
const proto = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uCol: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uFade: { value: 1 }, uEdge: { value: 0 }, uWidth: { value: 0.3 }, uMinPx: { value: 9 }, uViewH: { value: 800 } }, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide });

// a jagged path between two points: straighter and lower as it nears the end. arc lifts the middle (a bolt thrown across town)
export function jagged(from, to, { segs = 10, jit = 0.9, arc = 0 } = {}) {
  const pts = []; for (let i = 0; i <= segs; i++) { const s = i / segs, p = from.clone().lerp(to, s); p.y += Math.sin(s * Math.PI) * arc;
    if (i > 0 && i < segs) { const j = jit * (1 - s * 0.55); p.x += (Math.random() - 0.5) * j; p.y += (Math.random() - 0.5) * j * 0.7; p.z += (Math.random() - 0.5) * j; } pts.push(p); }
  return pts;
}
export function createBolts(scene) {
  const live = [];
  // lines: [{ pts, w }] (the main channel, w 1, and its thinner forks). o = { color, glow, edge, w: the main channel's width, minPx, life }
  function strike(lines, o = {}) {
    let n = 0; for (const L of lines) n += L.pts.length - 1; if (n <= 0) return;
    const pos = new Float32Array(n * 12), oth = new Float32Array(n * 12), info = new Float32Array(n * 12), idx = new Uint16Array(n * 6); let v = 0, q = 0;
    for (const L of lines) { const last = L.pts.length - 1;
      for (let i = 0; i < last; i++) { const a = L.pts[i], b = L.pts[i + 1], wa = L.w * (L.taper ? 1 - (i / last) * 0.75 : 1), wb = L.w * (L.taper ? 1 - ((i + 1) / last) * 0.75 : 1), v0 = v / 3;
        for (const [p, o2, end, w] of [[a, b, 1, wa], [a, b, 1, wa], [b, a, -1, wb], [b, a, -1, wb]]) { const side = (v / 3) % 2 ? 1 : -1; pos[v] = p.x; pos[v + 1] = p.y; pos[v + 2] = p.z; oth[v] = o2.x; oth[v + 1] = o2.y; oth[v + 2] = o2.z; info[v] = side; info[v + 1] = end; info[v + 2] = w; v += 3; }
        idx[q++] = v0; idx[q++] = v0 + 1; idx[q++] = v0 + 2; idx[q++] = v0 + 2; idx[q++] = v0 + 1; idx[q++] = v0 + 3; } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aOther', new THREE.BufferAttribute(oth, 3)); geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = proto.clone(); mat.uniforms.uCol.value.setHex(o.color == null ? 0xe8f4ff : o.color); mat.uniforms.uGlow.value.setHex(o.glow == null ? 0x7ab8ff : o.glow); mat.uniforms.uEdge.value = o.edge ? 1 : 0; mat.uniforms.uWidth.value = o.w || 0.3; mat.uniforms.uMinPx.value = o.minPx || 9; mat.uniforms.uViewH.value = innerHeight; mat.blending = o.edge ? THREE.NormalBlending : THREE.AdditiveBlending;
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 8; scene.add(m); live.push({ m, t: 0, life: o.life || 0.34 });
  }
  // the usual shape: a main channel with a couple of thinner forks peeling off it
  function bolt(from, to, o = {}) { const d = from.distanceTo(to), main = jagged(from, to, { segs: Math.max(5, Math.min(18, Math.round(d * 0.9))), jit: o.jit == null ? 0.5 + d * 0.035 : o.jit, arc: o.arc || 0 }), lines = [{ pts: main, w: 1 }];
    for (let f = 0; f < (o.forks == null ? 2 : o.forks); f++) { const i = 1 + ((Math.random() * (main.length - 3)) | 0), a = main[i], dir = main[i + 1].clone().sub(a).normalize(), len = Math.min(d * 0.35, 1.5 + Math.random() * 2.5), end = a.clone().addScaledVector(dir, len).add(new THREE.Vector3((Math.random() - 0.5) * len, -Math.random() * len * 0.5, (Math.random() - 0.5) * len));
      if (end.y < 0.05) end.y = 0.05; lines.push({ pts: jagged(a, end, { segs: 4, jit: len * 0.3 }), w: 0.55, taper: true }); }
    strike(lines, o); return main; }
  function update(dt) { for (let i = live.length - 1; i >= 0; i--) { const b = live[i]; b.t += dt; const t = b.t / b.life;
      // on, a dip, a second flash, then it dies away
      b.m.material.uniforms.uViewH.value = innerHeight; b.m.material.uniforms.uFade.value = t < 0.18 ? 1 : t < 0.32 ? 0.3 : t < 0.55 ? 0.9 : Math.max(0, 1 - (t - 0.55) / 0.45);
      if (b.t >= b.life) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); live.splice(i, 1); } } }
  function clear() { for (const b of live) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); } live.length = 0; }
  return { strike, bolt, update, clear, get count() { return live.length; } };
}
