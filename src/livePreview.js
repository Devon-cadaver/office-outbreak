// Small live 3D previews for menus (the skin shop, CHOOSE YOUR TORNADO, CHOOSE YOUR MONSTER). One hidden WebGL renderer
// draws each preview in turn and copies it onto that card's own 2D canvas. Only cards on screen are drawn, a few per
// frame, so a long list costs no more than a short one, and nothing is built until its card first comes into view.
import * as THREE from 'three';

export function createPreviews({ size = 150, perFrame = 5, cam: camPos = [0, 1.6, 5.2], look = [0, 1, 0], fov = 32 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setSize(size, size); renderer.setPixelRatio(1);
  const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xd8e8ff, 0x3a3048, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 0.85); sun.position.set(3, 6, 5); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 80); cam.position.set(...camPos); cam.lookAt(...look);
  let items = [], next = 0, last = performance.now(), seeT = 0, onTick = null;
  // make(): builds the thing to show (called once, when the card is first on screen). tick(dt, t, obj): moves it.
  // onSeen(v, obj): told when the card comes into or goes out of view
  function add(canvas, make, tick, onSeen) { const stage = new THREE.Group(); stage.visible = false; scene.add(stage); const it = { stage, obj: null, make, canvas, ctx: canvas.getContext('2d'), tick, onSeen, seen: false, t: Math.random() * 10 }; items.push(it); return it; }
  function clear() { for (const it of items) { if (it.obj && it.onSeen) it.onSeen(false, it.obj); scene.remove(it.stage); } items = []; next = 0; seeT = 0; }
  function draw(it, dt) { if (!it.obj) { it.obj = it.make(it); it.stage.add(it.obj); if (it.onSeen) it.onSeen(true, it.obj); } it.t += dt; if (it.tick) it.tick(dt, it.t, it.obj);
    it.stage.visible = true; renderer.render(scene, cam); it.stage.visible = false; it.ctx.clearRect(0, 0, it.canvas.width, it.canvas.height); it.ctx.drawImage(renderer.domElement, 0, 0, it.canvas.width, it.canvas.height); }
  function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; if (document.hidden || !items.length) return;
    seeT -= dt; if (seeT <= 0) { seeT = 0.3; for (const it of items) { const r = it.canvas.getBoundingClientRect(), v = r.width > 0 && r.bottom > -30 && r.top < innerHeight + 30 && r.right > -30 && r.left < innerWidth + 30; if (v !== it.seen) { it.seen = v; if (it.obj && it.onSeen) it.onSeen(v, it.obj); } } }
    const vis = items.filter((it) => it.seen); if (onTick) onTick(dt, vis.length); if (!vis.length) return;
    const n = Math.min(perFrame, vis.length), step = dt * vis.length / n; // each one's own clock keeps real time however many share a frame
    for (let k = 0; k < n; k++) draw(vis[next++ % vis.length], step);
  }
  requestAnimationFrame(frame);
  return { add, clear, scene, cam, set onTick(f) { onTick = f; }, get items() { return items; } };
}
