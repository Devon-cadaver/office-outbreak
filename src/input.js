// Pointer-only input: tap a spot to walk there, or drag a route for the character to follow.
// Works the same with a finger or a mouse. No keyboard.
import * as THREE from 'three';

export function createInput(canvas, camera) {
  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  let down = false, startX = 0, startY = 0, dragged = false, id = null;
  const listeners = { tap: [], drag: [], dragEnd: [], zoom: [], hold: [], pan: [] };
  let touchMid = null;
  let holdTimer = null, held = false;
  const pointers = new Map(); let pinchDist = 0, pinching = false;
  let look = false, lookLast = null, lookTap = false; // look mode: single finger/mouse drag pans the view, taps do nothing
  const toWorld = (x, y) => {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(ground, hit) ? { x: hit.x, z: hit.z } : null;
  };
  canvas.addEventListener('pointerdown', (e) => {
    // first finger down means nothing else is held: drop pointers whose "up" got lost (system swipe, finger off the iframe)
    if (e.isPrimary && (pointers.size || id !== null)) { pointers.clear(); down = false; pinching = false; id = null; clearTimeout(holdTimer); }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]); pinching = true; down = false; id = null; for (const f of listeners.dragEnd) f(); return; }
    if (id !== null) return; id = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or stale pointer */ }
    if (look) { lookLast = [e.clientX, e.clientY]; startX = e.clientX; startY = e.clientY; return; }
    down = true; dragged = false; held = false; startX = e.clientX; startY = e.clientY;
    const w = toWorld(e.clientX, e.clientY); if (w) for (const f of listeners.drag) f(w, true);
    clearTimeout(holdTimer); holdTimer = setTimeout(() => { if (down && !dragged && !pinching) { held = true; const hw = toWorld(startX, startY); if (hw) for (const f of listeners.hold) f(hw); } }, 650);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinching && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (e.pointerType !== 'touch' && pinchDist > 0 && d > 0) for (const f of listeners.zoom) f(pinchDist / d); pinchDist = d; return; }
    if (look && lookLast && e.pointerId === id && e.button !== 2) { for (const f of listeners.pan) f(e.clientX - lookLast[0], e.clientY - lookLast[1]); lookLast = [e.clientX, e.clientY]; return; }
    if (!down || e.pointerId !== id) return;
    if (!dragged && Math.hypot(e.clientX - startX, e.clientY - startY) > 14) dragged = true;
    if (dragged) { const w = toWorld(e.clientX, e.clientY); if (w) for (const f of listeners.drag) f(w, false); }
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (pinching) { if (pointers.size === 0) pinching = false; return; }
    if (e.pointerId !== id) return; down = false; id = null; clearTimeout(holdTimer);
    if (look) { const moved = Math.hypot(e.clientX - startX, e.clientY - startY) > 8; lookLast = null; if (lookTap && !moved) { const w = toWorld(e.clientX, e.clientY); if (w) for (const f of listeners.tap) f(w); } return; }
    const w = toWorld(e.clientX, e.clientY);
    if (dragged) { for (const f of listeners.dragEnd) f(); }
    else if (held) { /* a hold is not a tap */ }
    else if (w) { for (const f of listeners.tap) f(w); }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  let mousePan = null; canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => { if (e.button === 2 || e.button === 1) mousePan = [e.clientX, e.clientY]; });
  addEventListener('mousemove', (e) => { if (mousePan) { for (const f of listeners.pan) f(e.clientX - mousePan[0], e.clientY - mousePan[1]); mousePan = [e.clientX, e.clientY]; } });
  addEventListener('mouseup', () => { mousePan = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); for (const f of listeners.zoom) f(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  // Touch pinch (iOS Safari would otherwise zoom the whole page): read two-finger distance directly
  let touchDist = 0;
  const dist2 = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const mid2 = (t) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length >= 2) { e.preventDefault(); touchDist = dist2(e.touches); touchMid = mid2(e.touches); pinching = true; down = false; id = null; for (const f of listeners.dragEnd) f(); } }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { if (e.touches.length >= 2) { e.preventDefault(); const d = dist2(e.touches); if (touchDist > 0 && d > 0) for (const f of listeners.zoom) f(touchDist / d); touchDist = d; const mm = mid2(e.touches); if (touchMid) for (const f of listeners.pan) f(mm[0] - touchMid[0], mm[1] - touchMid[1]); touchMid = mm; } }, { passive: false });
  canvas.addEventListener('touchend', (e) => { if (e.touches.length < 2) { touchDist = 0; touchMid = null; } if (e.touches.length === 0) pinching = false; });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  return {
    on(type, f) { listeners[type].push(f); },
    reset() { down = false; id = null; dragged = false; pinching = false; pointers.clear(); lookLast = null; },
    setLook(on) { look = !!on; lookLast = null; if (look) { down = false; dragged = false; clearTimeout(holdTimer); for (const f of listeners.dragEnd) f(); } },
    get look() { return look; },
    set lookTap(v) { lookTap = !!v; },
  };
}
