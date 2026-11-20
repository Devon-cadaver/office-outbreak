// Keep the game full screen on phones and tablets. Pressing play asks the browser for real fullscreen (Android tablets,
// iPads; iPhones only get it when the game is added to the home screen). If the browser drops out of fullscreen mid-round,
// the next tap goes straight back in. While playing, touches on the game itself are claimed by the game from the very first
// finger-down, so the browser never gets to start its own drag (scroll, bounce, pull-to-refresh or swipe-to-exit).
// Launched from the home screen there are no browser bars at all, so none of this is needed and the button is hidden.
// A small ⛶ button (shown off the play screen) turns it on and off; the choice is remembered.
const GAME_AREA = '#game, #taMap, #kjMini'; // touches here are the game's; buttons and menus keep their normal taps

export function initFullscreen(isPlaying) {
  // The game runs in a frame of its own page (index.html keeps the radio playing and loads the menu, the games and the shop
  // inside an iframe). Full screen is asked of that outer page: asked of this one, it ended the moment the frame moved on to
  // another page (the skin shop, the main menu), because the page that held it was gone
  const doc = (() => { try { const p = window.parent; if (p && p !== window && p.document && p.document.documentElement) return p.document; } catch { /* the page above is another site's (itch): our own page it is */ } return document; })();
  const el = doc.documentElement;
  const app = (() => { try { return navigator.standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches; } catch { return false; } })();
  const can = !app && !!(el.requestFullscreen || el.webkitRequestFullscreen);
  let want = true; try { want = localStorage.getItem('fs_pref') !== 'off'; } catch { /* ignore */ }
  const isFs = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  const ask = (e) => (e.requestFullscreen ? e.requestFullscreen({ navigationUI: 'hide' }) : e.webkitRequestFullscreen());
  // if the outer page says no, ask this page instead (full screen as it used to be: better than none)
  const enter = () => { if (!can || isFs()) return; const own = document.documentElement, again = () => { if (el === own) return; try { const r2 = ask(own); if (r2 && r2.catch) r2.catch(() => {}); } catch { /* ignore */ } }; try { const r = ask(el); if (r && r.catch) r.catch(again); } catch { again(); } };
  const leave = () => { if (!isFs()) return; try { const r = doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen(); if (r && r.catch) r.catch(() => {}); } catch { /* ignore */ } };
  // the browser dropped us out mid-round: the next tap goes back in. Different browsers accept a different event as
  // "the user did something" (Chrome: pointerdown; Safari: touchend / pointerup), so try on all of them
  // iPad Safari lets any downward swipe close full screen and a page cannot stop it, so after it has thrown us out twice
  // the game stops jumping back in (in, out, in, out is worse than no full screen); the home-screen app has no such swipe
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let drops = 0, auto = true;
  const back = () => { if (want && auto && isPlaying() && !isFs()) enter(); };
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click']) document.addEventListener(ev, back, true);
  // claim game touches from the first finger-down: with touchstart left alone the browser starts its own pan (and on
  // tablets that pan can pull the page out of full screen); pointer events still reach the game as normal
  const mine = (e) => isPlaying() && e.target && e.target.closest && e.target.closest(GAME_AREA);
  document.addEventListener('touchstart', (e) => { if (mine(e) && e.cancelable) e.preventDefault(); }, { passive: false, capture: true });
  // no scrolling, bouncing or pull-to-refresh while playing (menus that scroll still can)
  document.addEventListener('touchmove', (e) => { if (!isPlaying()) return; if (e.target && e.target.closest && e.target.closest('.screen')) return; if (e.cancelable) e.preventDefault(); }, { passive: false, capture: true });
  // when the browser throws us out mid-round: count it (iPad gives up after two) and, once, say how to get a full screen
  // that cannot be swiped away
  let told = false; try { told = localStorage.getItem('fs_tip') === '1'; } catch { /* ignore */ }
  const say = (msg) => { for (const o of document.querySelectorAll('.fsTip')) o.remove(); const t = document.createElement('div'); t.className = 'fsTip'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 8000); };
  const home = ios ? 'open the game in Safari (not inside itch), tap Share ⬆ → Add to Home Screen with Open as Web App on, and play from that icon.' : 'browser menu ⋮ → Add to Home screen / Install app, and play from that icon.';
  const onChange = () => { if (isFs() || !isPlaying() || !want) return; drops++;
    if (ios && drops >= 2 && auto) { auto = false; say('iPad Safari lets a swipe close full screen, so the game will stay as it is now. For a full screen that can\'t be swiped away, ' + home); return; }
    if (told) return; told = true; try { localStorage.setItem('fs_tip', '1'); } catch { /* ignore */ }
    say('Tap to go back to full screen. For a full screen that can\'t be swiped away: ' + home); };
  if (can) {
    const b = document.createElement('button'); b.className = 'ghost fsBtn'; b.setAttribute('aria-label', 'Full screen');
    const draw = () => { b.textContent = isFs() ? '⛶ EXIT FULL SCREEN' : '⛶ FULL SCREEN'; };
    b.addEventListener('click', (e) => { e.stopPropagation(); if (isFs()) { want = false; leave(); } else { want = true; enter(); } try { localStorage.setItem('fs_pref', want ? 'on' : 'off'); } catch { /* ignore */ } });
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) { doc.addEventListener(ev, draw); doc.addEventListener(ev, onChange); }
    if (doc !== document) addEventListener('pagehide', () => { for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) { doc.removeEventListener(ev, draw); doc.removeEventListener(ev, onChange); } }); // this page is going; the outer one stays, so take our listeners off it
    draw(); document.body.appendChild(b);
    setInterval(() => { b.style.display = isPlaying() ? 'none' : ''; }, 300);
  }
  return { play() { if (want) enter(); } };
}
