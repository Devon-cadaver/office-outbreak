# Survive Dead City — itch.io page kit

Everything needed to set up https://devs66.itch.io/ for the game. Current version: **1.4.0**. Upload `release/survive-dead-city-web-v1.4.0.zip` as an **HTML** project. Each version gets its own zip (`-vX.Y`), so older builds stay in `release/` to fall back to.

## Upload settings (Edit game page)

| Field | Value |
|---|---|
| Title | Survive Dead City |
| Project URL | survive-dead-city |
| Short description / tagline | Two zombie games in your browser: survive six nights in Dead City, or extract the crowds in a snake-style maze run. |
| Classification | Game |
| Kind of project | **HTML** |
| Uploads | `survive-dead-city-web-v1.4.0.zip` (0.4 MB). On an update, upload the new zip and delete or hide the old upload. Tick **This file will be played in the browser**. |
| Embed options | Viewport **Click to launch in fullscreen**, or embed 480 × 854 (phone portrait) / 960 × 640 (desktop). Tick **Mobile friendly** and **Fullscreen button**. Orientation: Portrait for phones. |
| Frame options | Leave SharedArrayBuffer off. No special headers needed. |
| Pricing | Free (or "No payments"). |
| Genre | Action |
| Tags | zombies, survival, arcade, browser, mobile, isometric, pixel-free low poly, three-js, snake, single-player |
| Made with | Three.js |
| Average session | A few minutes |
| Inputs | Touchscreen, Mouse, Keyboard |
| Accessibility | One-button-ish controls, no text-only cues required |
| Release status | In development |

## Images (itch sizes)

| Slot | File | Size | itch requirement |
|---|---|---|---|
| Cover image | `cover-630x500.png` | 630 × 500 | Minimum 315 × 250, recommended 630 × 500. |
| Page background (Theme → Background image) | `background-1920x1080.png` | 1920 × 1080 | No fixed size. Set "Don't repeat", position Top centre, and background colour #0e0818 so it fades into the edge. The dark middle band sits behind the 960 px page column. |
| Banner (page theme → Banner) | `banner-960x400.png` | 960 × 400 | Any width up to 960 px, replaces the title. Optional. |
| Screenshots | `shot-1-dead-city-title.png` … `shot-7-tornado.png` | 1280 × 720 | At least 3, up to 8. |
| Logo (optional, for the page header or devlog) | `logo-extraction-dead-city.png` | 768 × 512 | Original Extraction: Dead City logo. |

## Description (paste into the page body; Markdown works)

**Two zombie games, one dark little city, straight from your browser.**

**DEAD CITY (Survival)** — Third-person joystick survival. Survive six nights. The first night sends about twenty slow walkers. Every night after sends more, and more of them run. By night six the whole horde is fast. Nothing stays safe: stand still and the dead crawl out of the ground around you; start a car and the engine noise brings them running.

- Find the eight spell books: Hellfire flamethrower, Beam, Repulse, Entomb, Wrath, Maelstrom tornado, Arc chain lightning, Diminish.
- Guns aim for you. Hold FIRE to shoot. Trash is free, real guns are scarce.
- Mercenaries: one or two hired guns per map. They flank you and shoot whatever gets close. When they run dry they charge in with the rifle butt to drag the horde off you, then reload when you do.
- The city is alive: survivors pace around, cars race past with the dead on their bumpers, runners flee with zombies at their heels, hordes rise out of the ground, and planes and helicopters crash into buildings.
- Drive cars, vans, a truck and a tank. Refuel at the gas station, hotwire the tank, run the dead down. Your survivors ride along.
- Lead survivors to the green zone and a chopper lifts them out. Finish the night's mission before dawn for a bonus; skip it and the next night is worse.
- Weather tries to kill you: sandstorms and fog cut your sight, lightning storms strike where the blue marks warn and supercharge the dead, tornadoes tear up houses, cars and anyone in the way.
- Ride the ferris wheel, coaster and carousel to fling the horde. Clown zombies included.
- Spend cash at dawn: hearts, flak jacket, guns, running shoes, spell focus.

**EXTRACT** — Pac-Man meets Snake. Gather a line of survivors and get them to the extraction point, where a helicopter drops a rope and the whole line climbs up with you. The heli only comes for a full load: 10 survivors in district 1, 20 in district 2, 30, 40, then easing up to 70 by district 10. Your score is the people you get out, and they pay for the upgrades that get you through the next district. After every district you open chests: most are empty, some hold a sliver of a coin, and a very rare one holds a free skin. You never stop walking: tap left or right to turn at the next corner, or tap up to five cells ahead. You can't turn back into your own line, and a dead end forces you to, infecting the back of your line. You are immune, but you carry it. Cross your own line and whoever you touch turns.

- Rival crews start at the far end of town and gather survivors into their own lines. Get close and their leader opens fire. Drop the leader and his people are yours.
- Some of the people who join you carry a gun and shoot zombies and rivals as they follow.
- Ten districts, more zombies every district, power-box gate puzzles, fairground rides, fires and explosions.
- Weapons aim themselves. Crowds panic and chain-infect, so lead the horde away from them.
- Store between districts: ammo, medkit, vest, shoes, flare, car.

**TORNADO ALLEY (side game)** — You are the storm. Drag to steer a tornado through town: rip up houses and towers, suck up the residents fleeing in the streets, toss the traffic, shrug off the army squads and tanks shooting at you, and dodge the cloud-seeding planes whose spray shrinks you (grow big enough and you can swallow them). Everything you wreck makes you bigger, up to three times your size, and only a big storm can bring down the towers and the three big targets: the power plant (blackout!), the water station (waterspout!) and the fairground. Five levels, from Small Town to a huge Megacity, each unlocked by flattening enough of the last. Combos for chained wreckage, chests at the end.

**Both games**

- Seasons: Halloween, Christmas and the 4th of July dress every house, shop and park (random by default, or pick one).
- Beat either game to earn a coin and spend it in the skin shop: 32 outfits for you, survivor sets you can mix, 23 rides from an A-Team van to a dragon, six tornado skins (Sharknado included), and fire colours.
- Save at any time, continue later. Pause with ❚❚.
- Built for phones in portrait. Works with mouse and keyboard too.

## How to play (paste below the description or into a "Controls" section)

**Dead City (Survival):** Left thumb is the joystick. Drag the right side to turn the camera. Hold **FIRE** to shoot (space on PC). Tap the spell buttons once a book is found. Double-tap next to a vehicle to drive it, double-tap again to get out. Double-tap next to a ride to play its operator game. **SCAN** sends a pulse toward your objective, three times a day. **ISO/3RD** switches the camera. Pinch or scroll to zoom. ❚❚ pauses; Esc or P on PC.

**Extract:** You walk on your own. Tap the **left** side of the screen (or ◀) to turn left at the next corner, the **right** side (or ▶) to turn right. Hold **WALK** to slow down or **RUN** to speed up; both burn stamina, purple gems refill it. Tap a spot up to five cells ahead to walk there. Walk up to people and they join your line. Gather the number shown (10 in district 1, up to 70 by district 10), then reach the green beam for the heli. Never turn back into your line, and avoid dead ends. Double-tap a ride to use it. Hold a finger down to preview the way. Arrow keys on PC.

## Bio (for the devs66 profile)

Small browser games built fast, tested on a phone, and tuned by playing. Survive Dead City grew out of Extraction: Dead City, a Godot prototype, rebuilt as a lean Three.js city with two ways to play: a six-night survival run and a snake-style extraction maze.

## Version history

- **1.4.0** (2026-10-18): Tornado skins in the shop (2 coins each), used by every tornado in every mode: Hallowstorm (black, bats and jack-o-lanterns, green/purple/orange lights), Blizzard (white, snow, reindeer and snowmen, red and green lightning), Firenado (fire, embers, red lightning), Sharknado (waterspout full of sharks), Bunnynado (pastels, bunnies and eggs, pink lightning) and Liberty Twister (red, white and blue, flags, fireworks, multicolour lightning).
- **1.3.3** (2026-10-18): Tornado Alley: cloud seeders are easier to dodge early on. They arrive later (and only once you have started growing on the first two levels), fly slower and turn wider on early levels, spray a smaller zone, and fly on after each pass instead of circling over you. Full strength again by the Megacity.
- **1.3.2** (2026-10-18): Tornado Alley gets a 3RD chase camera (ISO/3RD button, remembered): low behind the storm, turning with it, pulling back as it grows.
- **1.3.1** (2026-10-18): Tornado Alley gets an enemy: cloud-seeding planes hunt the storm and their spray shrinks it. They fly faster but turn slowly, so dodge sideways; a blue zone shows where the spray lands and an edge arrow warns of incoming planes. Grow to F3 and you can swallow them (+500). More planes on later levels.
- **1.3.0** (2026-10-18): Tornado Alley gets five levels, each a bigger town: Small Town, Suburbs, Downtown, Metro and the huge Megacity. Flatten the goal share of each to unlock the next; best score per level; more people, traffic, soldiers and tanks as the towns grow.
- **1.2.1** (2026-10-18): Extract: the heli need eases off after district 4 (10, 20, 30, 40, 45, 50, 56, 62, 66, 70); a dead end now infects only the last 6 people in your line; a street prop on the road can no longer trap you (you slip past it).
- **1.2.0** (2026-10-18): New side game TORNADO ALLEY (button on the main menu): you are the storm. Two minutes to wreck the town, sweep up 130 fleeing residents, traffic, soldiers and tanks that shoot back (harmlessly), and grow from F0 to F5 (3x). Three big targets: the power plant (blackout), the water station (turns you into a waterspout) and the fairground. Combos, best score, chests. Survival menu: Horde Test button removed.
- **1.1.2** (2026-10-18): Survival: tapping FIRE while holding the joystick no longer stops you (a second finger on a button was read as a pinch-zoom and cancelled the stick).
- **1.1.1** (2026-10-18): Epic tornadoes in Survival: streaked three-layer funnel, dark cloud cap, dust skirt, junk and a car tumbling up the vortex, lightning forking out of it; buildings it hits are lifted, torn into chunks that orbit the funnel and get flung across town as rubble. Shop doors, frames, awnings and roof trim now go with their building instead of floating in place.
- **1.1.0** (2026-10-18): Survival joystick listens on the game canvas (like Extract) and no longer resets when the frame loses focus; hidden input readout (tap the version badge on the Survival menu 3 times). Extract balance: fewer and slower early zombies that turn people slower, more people (never in dead ends), gates from district 3, rivals ramp 1/2/3/4 with crews capped at 8, a rival hit steals your last follower instead of a life, new recruits safe for 3 s, a new layout every run for districts 2-10.
- **1.0.3** (2026-10-18): iPhone: Survival joystick runs on touch events and Safari can no longer turn a drag into a scroll; the Extract logo no longer shows as a grey box; menus scroll when taller than the screen; game starts even without Web Audio. Version label in the top corner of every menu. Fixes from testing: tap routes now update your facing (no walking back through your line after a tap), saving or retrying a district keeps the ammo crate and vest you bought, final-district chests capped at 3, the stuck-guard never turns you around, a charged bite at 1 heart no longer makes you unkillable, and nobody can get knocked out of the map through a wall seam.
- **1.0.2** (2026-10-18): Map builder keeps the same border, sky and clouds while you place things (no more reshuffling on every edit); clouds hidden in the builder.
- **1.0.1** (2026-10-18): Survival joystick no longer dies when a touch release is lost (system swipe, finger off the frame); same fix for Extract touch input. Extract tips are smaller, sit at the top and fade out.
- **1.0** (2026-10-18): Extract end-of-district chests (coin slivers, very rare free skins), slower pacing to match smaller characters, infection in your line only from dead ends or crossing your tail, survivors pay less and upgrades cost more, buildings only go see-through in ISO view. Extract scoring by survivors escaped, 10 per district minimum, heli rope pickup, rival crews, armed followers, no U-turns and dead-end infection, more zombies. Smaller characters that fit through doors. Town renamed Ashford. Survival mercenaries and a living city. Visual pass: grass, flowers, clouds, faces, animations, rolling wheels, zombie eye beams.
- **0.9**: first itch upload (`survive-dead-city-web-v0.9.zip`).

## Credits line

Design: Sean Duvall. Built with Three.js and Vite. Original Extraction: Dead City logo art reused with permission of the author.

## Checklist

1. Create project → Title, URL, Kind **HTML**, upload the zip, tick "played in the browser", set viewport and Mobile friendly.
2. Paste the description and controls into the body.
3. Under Edit theme: background image `background-1920x1080.png` (don't repeat, top centre), background colour #0e0818, page background #1a0f2e, text #e9e4f5, links and buttons #7dff3a. Upload `cover-630x500.png` as the cover, the six screenshots in order (replace any older ones), and (optionally) `banner-960x400.png` under Theme → Banner.
4. Tags, genre, status, pricing as above. Save, then **Public** when you are happy.
5. Test the embed on your phone: the page is portrait first; use the fullscreen button.
