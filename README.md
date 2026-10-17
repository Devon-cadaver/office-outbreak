# Office Outbreak

A browser game: a city maze meets Pac-Man during a zombie outbreak.
Run from the start corner to the green safe zone. A few zombies start far away and
infect every crowd they reach, so the route you take decides how big the horde gets.
Grab weapons along the way to fight back. One touch costs a life.
Built with Three.js and Vite. Runs smoothly in phone browsers.

## Play it locally

```bash
npm install
npm run dev
```

Open the address Vite prints. It also prints a LAN address you can open on your phone
on the same Wi-Fi.

## Build for hosting

```bash
npm run build
```

Upload the `dist/` folder to any static host (GitHub Pages, Netlify, itch.io, Cloudflare Pages).

## Rules

- Move: drag anywhere on a phone (virtual joystick), WASD or arrows on desktop.
- You start unarmed. Pistol, shotgun and rifle pickups have limited ammo and auto-aim at the nearest zombie in line of sight.
- Zombies chase you through the streets and infect civilians they get close to.
- Touching a zombie costs a life (3 per run). You respawn at the start.
- Reach the green exit to clear the district. Score = 100 per civilian still alive, 10 per zombie kill, plus a speed bonus.
- Each district is a bigger maze with more crowds, more starter zombies and faster zombies.
- District 1 is an open tutorial with on-screen tips. From district 3 a gate blocks the route; a yellow switch elsewhere opens it.
- Ten districts. On the tenth the safe zone is a helipad and a chopper flies you out.
- How-to-play slides (with screenshots in `public/howto/`) show on first play and from the start screen.

Live: https://devon-cadaver.github.io/office-outbreak/ (deploys from `main` via GitHub Actions). The blocky version is also tagged `v1-blocky` / branch `blocky-classic`.

## Where things live

- `src/main.js` – game loop, levels, civilians, infection, weapons, lives, scoring, HUD.
- `src/city.js` – maze generator, flow-field pathfinding, city builder (buildings with windows, cars, lamps, roads).
- `src/characters.js` – low-poly block characters and outfits (colors taken from the reference sprite sheet).
- `src/input.js` – keyboard and touch joystick.
- `src/audio.js` – synthesized sound effects (no audio files).
- `example sprites/` – reference art only; not loaded by the game.

## Tuning knobs (in `src/main.js`)

- `PLAYER_SPEED`; zombie `speed` and `hp` in `spawnZombie`; `WEAPONS` table (ammo, rate, range, pellets);
  maze size and crowd / zombie / weapon counts in `buildLevel`; lives in `startRun`; scoring in `clearDistrict`.
