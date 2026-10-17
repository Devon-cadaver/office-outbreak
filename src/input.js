// Pointer-only input: tap a spot to walk there, or drag a route for the character to follow.
// Works the same with a finger or a mouse. No keyboard.
import * as THREE from 'three';

export function createInput(canvas, camera) {
  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  let down = false, startX = 0, startY = 0, dragged = false, id = null;
  const listeners = { tap: [], drag: [], dragEnd: [] };
  const toWorld = (x, y) => {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(ground, hit) ? { x: hit.x, z: hit.z } : null;
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (id !== null) return; id = e.pointerId; canvas.setPointerCapture(e.pointerId);
    down = true; dragged = false; startX = e.clientX; startY = e.clientY;
    const w = toWorld(e.clientX, e.clientY); if (w) for (const f of listeners.drag) f(w, true);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== id) return;
    if (!dragged && Math.hypot(e.clientX - startX, e.clientY - startY) > 14) dragged = true;
    if (dragged) { const w = toWorld(e.clientX, e.clientY); if (w) for (const f of listeners.drag) f(w, false); }
  });
  const up = (e) => {
    if (e.pointerId !== id) return; down = false; id = null;
    const w = toWorld(e.clientX, e.clientY);
    if (dragged) { for (const f of listeners.dragEnd) f(); }
    else if (w) { for (const f of listeners.tap) f(w); }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  return {
    on(type, f) { listeners[type].push(f); },
    reset() { down = false; id = null; dragged = false; },
  };
}
