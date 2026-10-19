// Keep the game full screen on phones and tablets. Pressing play asks the browser for real fullscreen (Android tablets,
// iPads; iPhones only get it when the game is added to the home screen). If the browser drops out of fullscreen mid-round,
// the next tap goes straight back in. While playing, touches on the game itself are claimed by the game from the very first
// finger-down, so the browser never gets to start its own drag (scroll, bounce, pull-to-refresh or swipe-to-exit).
// Launched from the home screen there are no browser bars at all, so none of this is needed and the button is hidden.
// A small ⛶ button (shown off the play screen) turns it on and off; the choice is remembered.
const GAME_AREA = '#game, #taMap, #kjMini'; // touches here are the game's; buttons and menus keep their normal taps

export function initFullscreen(isPlaying) {
  const el = document.documentElement;
  const app = (() => { try { return navigator.standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches; } catch { return false; } })();
  const can = !app && !!(el.requestFullscreen || el.webkitRequestFullscreen);
  let want = true; try { want = localStorage.getItem('fs_pref') !== 'off'; } catch { /* ignore */ }
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const enter = () => { if (!can || isFs()) return; try { const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen(); if (r && r.catch) r.catch(() => {}); } catch { /* ignore */ } };
  const leave = () => { if (!isFs()) return; try { const r = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen(); if (r && r.catch) r.catch(() => {}); } catch { /* ignore */ } };
  // the browser dropped us out mid-round: the next tap goes back in. Different browsers accept a different event as
  // "the user did something" (Chrome: pointerdown; Safari: touchend / pointerup), so try on all of them
  const back = () => { if (want && isPlaying() && !isFs()) enter(); };
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click']) document.addEventListener(ev, back, true);
  // claim game touches from the first finger-down: with touchstart left alone the browser starts its own pan (and on
  // tablets that pan can pull the page out of full screen); pointer events still reach the game as normal
  const mine = (e) => isPlaying() && e.target && e.target.closest && e.target.closest(GAME_AREA);
  document.addEventListener('touchstart', (e) => { if (mine(e) && e.cancelable) e.preventDefault(); }, { passive: false, capture: true });
  // no scrolling, bouncing or pull-to-refresh while playing (menus that scroll still can)
  document.addEventListener('touchmove', (e) => { if (!isPlaying()) return; if (e.target && e.target.closest && e.target.closest('.screen')) return; if (e.cancelable) e.preventDefault(); }, { passive: false, capture: true });
  // the first time the browser throws us out mid-round, say how to get a full screen that cannot be swiped away
  let told = false; try { told = localStorage.getItem('fs_tip') === '1'; } catch { /* ignore */ }
  const onChange = () => { if (isFs() || !isPlaying() || told || !want) return; told = true; try { localStorage.setItem('fs_tip', '1'); } catch { /* ignore */ }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const t = document.createElement('div'); t.className = 'fsTip';
    t.textContent = 'Tap to go back to full screen. For a full screen that can\'t be swiped away, add the game to your home screen: ' + (ios ? 'Share ⬆ → Add to Home Screen.' : 'browser menu ⋮ → Add to Home screen / Install app.');
    document.body.appendChild(t); setTimeout(() => t.remove(), 7000); };
  if (can) {
    const b = document.createElement('button'); b.className = 'ghost fsBtn'; b.setAttribute('aria-label', 'Full screen');
    const draw = () => { b.textContent = isFs() ? '⛶ EXIT FULL SCREEN' : '⛶ FULL SCREEN'; };
    b.addEventListener('click', (e) => { e.stopPropagation(); if (isFs()) { want = false; leave(); } else { want = true; enter(); } try { localStorage.setItem('fs_pref', want ? 'on' : 'off'); } catch { /* ignore */ } });
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) { document.addEventListener(ev, draw); document.addEventListener(ev, onChange); }
    draw(); document.body.appendChild(b);
    setInterval(() => { b.style.display = isPlaying() ? 'none' : ''; }, 300);
  }
  return { play() { if (want) enter(); } };
}
