// Where the player is: which era they play in and how far they've got in each game. No 3D code in here, so the main
// menu can use it too.
export const ERAS = [['past', 'Wild West'], ['present', 'Present'], ['future', 'Future']];
export const TOWNS = ['Small Town', 'Suburbs', 'Downtown', 'Metro', 'Megacity', 'The Sprawl'];
export function getEra() { try { const e = localStorage.getItem('dc_era'); return ERAS.some(([k]) => k === e) ? e : 'present'; } catch { return 'present'; } }
export function setEra(e) { try { localStorage.setItem('dc_era', e); } catch { /* ignore */ } }
// save keys for one game ('ta' or 'kj') in the current era; Present keeps the original keys so old saves carry over
const eraTag = () => (getEra() === 'present' ? '' : getEra());
export const levelKey = (game) => game + '_level' + (eraTag() && '_' + eraTag());
export const bestKey = (game, n) => game + '_best_' + (eraTag() && eraTag() + '_') + n;
// QUICK PLAY picks up where you left off: the last town you played in this era (moved on once you clear it), never
// past the furthest town you've opened. Someone brand new starts in town 1
export const lastKey = (game) => game + '_last' + (eraTag() && '_' + eraTag());
const num = (k) => { try { return +localStorage.getItem(k) || 0; } catch { return 0; } };
export function quickLevel(game) { const open = Math.max(1, Math.min(TOWNS.length, num(levelKey(game)))), last = num(lastKey(game)); return last >= 1 && last <= open ? last : open; }
export function saveLast(game, n) { try { localStorage.setItem(lastKey(game), String(n)); } catch { /* ignore */ } }
