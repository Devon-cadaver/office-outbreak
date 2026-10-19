// Keep the game full screen on phones and tablets. Pressing play asks the browser for real fullscreen (Android tablets,
// iPads; iPhones only get it when the game is added to the home screen). If the browser drops out of fullscreen mid-round,
// the next tap goes straight back in. While playing, no drag can scroll, bounce or pull-to-refresh the page.
// A small ⛶ button (shown off the play screen) turns it on and off; the choice is remembered.
export function initFullscreen(isPlaying) {
  const el = document.documentElement;
  const can = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  let want = true; try { want = localStorage.getItem('fs_pref') !== 'off'; } catch { /* ignore */ }
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const enter = () => { if (!can || isFs()) return; try { const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen(); if (r && r.catch) r.catch(() => {}); } catch { /* ignore */ } };
  const leave = () => { if (!isFs()) return; try { const r = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen(); if (r && r.catch) r.catch(() => {}); } catch { /* ignore */ } };
  // the browser dropped us out mid-round: the next tap (a user gesture, so the browser allows it) goes back in
  document.addEventListener('pointerdown', () => { if (want && isPlaying() && !isFs()) enter(); }, true);
  // no scrolling, bouncing or pull-to-refresh while playing (menus that scroll still can)
  document.addEventListener('touchmove', (e) => { if (!isPlaying()) return; if (e.target && e.target.closest && e.target.closest('.screen')) return; if (e.cancelable) e.preventDefault(); }, { passive: false });
  if (can) {
    const b = document.createElement('button'); b.className = 'ghost fsBtn'; b.setAttribute('aria-label', 'Full screen');
    const draw = () => { b.textContent = isFs() ? '⛶ EXIT FULL SCREEN' : '⛶ FULL SCREEN'; };
    b.addEventListener('click', (e) => { e.stopPropagation(); if (isFs()) { want = false; leave(); } else { want = true; enter(); } try { localStorage.setItem('fs_pref', want ? 'on' : 'off'); } catch { /* ignore */ } });
    document.addEventListener('fullscreenchange', draw); document.addEventListener('webkitfullscreenchange', draw); draw(); document.body.appendChild(b);
    setInterval(() => { b.style.display = isPlaying() ? 'none' : ''; }, 300);
  }
  return { play() { if (want) enter(); } };
}
