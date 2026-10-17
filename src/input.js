// Pointer-only input: tap a spot to walk there, or drag a route for the character to follow.
// Works the same with a finger or a mouse. No keyboard.
import * as THREE from 'three';

export function createInput(canvas, camera) {
  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  let down = false, startX = 0, startY = 0, dragged = false, id = null;
  const listeners = { tap: [], drag: [], dragEnd: [], zoom: [] };
  const pointers = new Map(); let pinchDist = 0, pinching = false;
  const toWorld = (x, y) => {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(ground, hit) ? { x: hit.x, z: hit.z } : null;
  };
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]); pinching = true; down = false; id = null; for (const f of listeners.dragEnd) f(); return; }
    if (id !== null) return; id = e.pointerId; canvas.setPointerCapture(e.pointerId);
    down = true; dragged = false; startX = e.clientX; startY = e.clientY;
    const w = toWorld(e.clientX, e.clientY); if (w) for (const f of listeners.drag) f(w, true);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinching && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinchDist > 0 && d > 0) for (const f of listeners.zoom) f(pinchDist / d); pinchDist = d; return; }
    if (!down || e.pointerId !== id) return;
    if (!dragged && Math.hypot(e.clientX - startX, e.clientY - startY) > 14) dragged = true;
    if (dragged) { const w = toWorld(e.clientX, e.clientY); if (w) for (const f of listeners.drag) f(w, false); }
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (pinching) { if (pointers.size === 0) pinching = false; return; }
    if (e.pointerId !== id) return; down = false; id = null;
    const w = toWorld(e.clientX, e.clientY);
    if (dragged) { for (const f of listeners.dragEnd) f(); }
    else if (w) { for (const f of listeners.tap) f(w); }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); for (const f of listeners.zoom) f(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  return {
    on(type, f) { listeners[type].push(f); },
    reset() { down = false; id = null; dragged = false; pinching = false; pointers.clear(); },
  };
}
