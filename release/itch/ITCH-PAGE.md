# Dead City: Tornado Alley — itch.io page kit

Everything needed to set up https://devs66.itch.io/ for the game. Current version: **1.7.2**. Upload `release/survive-dead-city-web-v1.7.2.zip` as an **HTML** project. Each version gets its own zip (`-vX.Y`), so older builds stay in `release/` to fall back to.

## Upload settings (Edit game page)

| Field | Value |
|---|---|
| Title | Dead City: Tornado Alley |
| Project URL | survive-dead-city (keep the old URL so existing links still work) |
| Short description / tagline | You are the storm. Tear through five towns, take out big targets, dodge seeding planes and outrun storm chasers. |
| Classification | Game |
| Kind of project | **HTML** |
| Uploads | `survive-dead-city-web-v1.7.2.zip` (0.5 MB). On an update, upload the new zip and delete or hide the old upload. Tick **This file will be played in the browser**. |
| Embed options | Viewport **Click to launch in fullscreen**, or embed 480 × 854 (phone portrait) / 960 × 640 (desktop). Tick **Mobile friendly** and **Fullscreen button**. Orientation: Portrait for phones. |
| Frame options | Leave SharedArrayBuffer off. No special headers needed. |
| Pricing | Free (or "No payments"). |
| Genre | Action |
| Tags | tornado, destruction, arcade, browser, mobile, low-poly, three-js, casual, single-player, physics |
| Made with | Three.js |
| Average session | A few minutes |
| Inputs | Touchscreen, Mouse, Keyboard |
| Accessibility | Drag or tap controls, a step-by-step tutorial, no text-only cues required |
| Release status | In development |

## Images (itch sizes)

| Slot | File | Size | itch requirement |
|---|---|---|---|
| Cover image | `cover-630x500.png` | 630 × 500 | Minimum 315 × 250, recommended 630 × 500. |
| Page background (Theme → Background image) | `background-1920x1080.gif` (animated, 2.1 MB) or `background-1920x1080.png` (still) | 1920 × 1080 | Set "Don't repeat", position Top centre, tick **Fixed** (so it stays put while the page scrolls), background colour #0e0818. The animation stays on the two edges (the storm on the left, debris flying out to the right); the middle is still, behind the page column. Keep GIFs under about 3 MB: bigger ones can stop animating. Source: `background-scene.html`. |
| Banner (page theme → Banner) | `banner-960x200.png` | 960 × 200 | The thin banner (use this one). Any width up to 960 px, replaces the title. The taller `banner-960x400.png` is still there if you want it. Source: `logo-scene.html?layout=strip&w=960&h=200`. |
| Screenshots | `shot-ta-1-title.png` … `shot-ta-8-shop.png` | 1280 × 720 | Upload all eight in order and remove the old Survival/Extract shots (`shot-1` … `shot-7`). |
| Logo (optional, for the page header or devlog) | `logo-dead-city.png` | 768 × 512 | Rendered from `logo-scene.html` with the game's own city and storm. |

## Description (paste into the page body; Markdown works)

# You are the storm.

Dead City is about to have a very bad day. Drag to steer a tornado through town, tap to call down lightning, and grow from a dust devil into an F5 monster that rips towers out of the ground.

🌪️ **Tear it all down.** Houses, shops, towers, cars, lamp posts, and everyone running from you. Keep the chaos going for a x5 combo.

⚡ **Call the lightning.** Tap anywhere: buildings burn, cars explode, people run around on fire. Zap a seeding plane and it turns tail. Zap a storm chaser and its photos are toast.

🎯 **Hunt ten big targets.** Black out the power plant. Wake the graveyard and the dead rise. Spring a jailbreak at the police station. Turn the sewage plant into a stink storm. Topple the radio tower. And in the biggest cities... melt down the nuclear plant.

✈️ **They fight back.** Listen for the siren: cloud-seeding planes hunt you, and their spray shrinks you. Storm chasers race in for a photo, and if they get away, more planes come.

🏙️ **Five towns.** From Small Town to the sprawling Megacity. Every round is a new map, new target spots and a new season.

🏆 **Earn the Acid Storm.** Beat Megacity to unlock a toxic green twister with acid rain, green lightning and baby tornadoes that roam the town.

🛒 **Make it yours.** Spend your coins on tornado skins (Sharknado, Firenado, Blizzard and more), townsfolk outfits and the cars in town.

New here? Hit **🎓 TUTORIAL** and you'll be flattening the suburbs in a minute.

*Plays in your browser. Built for phones (hold it upright); works with mouse and keyboard too.*

## How to play (paste below the description or into a "Controls" section)

**Steer:** drag anywhere (WASD or arrow keys on PC). **Move with lightning:** tap a spot. **Zap:** tap a seeding plane or storm chaser. **Find targets:** follow the arrows at the screen edge or tap the minimap. **Zoom:** pinch, scroll or tap **+ / −**. **Pause:** ❚❚, or Esc / P on PC.

## Bio (for the devs66 profile)

Small browser games built fast, tested on a phone, and tuned by playing. Dead City started as a zombie survival town; now its storms have a game of their own: Tornado Alley, where you are the tornado.

## Version history

- **1.7.2** (2026-10-18): New storm music: a D-minor track with driving drums, bass, strings and a lead theme that builds in layers as your storm grows from F0 to F5, and every new F rank kicks in a riser, a crash, double-time drums and a fast arpeggio for the speed boost. The pause button is now big and bright green. New animated page background and description.
- **1.7.1** (2026-10-18): The main menu title is now a live scene from the game: a side view down a city street where the Acid Storm rolls in, grows as it tears the buildings apart, shrugs off a seeding plane, then turns on a storm chaser and runs it down. Seeding planes now sound off: an air-raid siren when one appears and again when it closes in, and a propeller drone that swells as it gets near. New itch art (logo, cover, banner), eight Tornado Alley screenshots and a rewritten page.
- **1.7.0** (2026-10-18): The game is now Dead City: Tornado Alley. The main menu shows Tornado Alley and the skin shop (Survival and Extract are parked for now). New 🎓 tutorial teaches one thing at a time: steering, tap to move, growing, finding a target, zapping a seeding plane and dealing with a storm chaser. Short start screen, five quick HOW TO PLAY cards (shown before your first round) and one-time tips the first time something happens. The chase camera is hidden for now. The shop shows the tornado, townsfolk and car skins.
- **1.6.2** (2026-10-18): Tornado Alley lightning hits more than buildings: strike a seeding plane and it turns round, strike a storm chaser and its photos are fried and it flees, cars blow up, and people catch fire and run about. Megacity always has clear skies (lighter to draw). Fewer hitches: materials compile when the town is built, and the resolution steps up less often. The skin shop fits narrow phones (all five tabs on screen) and asks before spending coins.
- **1.6.1** (2026-10-18): Tornado Alley runs much smoother in big towns. The town is split into blocks that are set up once and switched off whole when off screen (or past the fog in the chase view), people and soldiers far from the storm stop costing anything, and the score bar only redraws when something changes. On Megacity the per-frame work dropped about sevenfold and the draw count by about two thirds. Gameplay is unchanged.
- **1.6.0** (2026-10-18): Tornado Alley gets seven new big targets (graveyard, weather station, fire station, police station, sewage plant, radio tower, nuclear plant), each with its own effect when it falls; more of them in bigger towns, and clearing a level now also needs some of them (2 in Small Town up to all 10 in Megacity). Target chips under the size bar light up when you are big enough and turn green with a check when they fall; arrows at the screen edge point to each one; a minimap shows the whole town (tap it to head there). Beat Megacity to unlock the bonus Acid Storm skin: acid rain, bright green lightning and baby tornadoes that roam the town. Smoother on tablets and big screens: zoom-out is capped, buildings draw in far fewer pieces, and large screens draw fewer pixels. The Survival water-station pond shows again.
- **1.5.5** (2026-10-18): Smoother frames in every mode: characters draw in a third of the pieces, fireworks are one particle cloud, and the draw resolution steps down a notch when frames run long. Tornado Alley: tap anywhere to send the storm there with a lightning strike that sets buildings on fire (they burn down for half points); F1-F5 markers on the size bar and a 3-second speed boost at each new rank; clearing a level earns an extra chest; every million points pays a coin. Unused chests show a lock and the chest screen says how you earned them. The skin shop has category tabs and a back button, and every chest screen has a button to the shop (Extract keeps your run at the next district).
- **1.5.4** (2026-10-18): Extract district 1 is much smaller (11x15 instead of 15x23) with bigger crowds (about 27 people for the 10 you need). The pale cloud wisps no longer wash over the Extract view.
- **1.5.3** (2026-10-18): Christmas now costs about the same as no season (wreath berries and gift bows merge with the rest of each house).
- **1.5.2** (2026-10-18): Smoother seasons in every mode: holiday decorations are merged into a few pieces per building (Halloween and 4th of July now cost about as much as no season, Christmas well under half what it did). Tornado Alley: the season cycles every round (never starting on the last one), the power plant, water station and fairground move each round, and every round builds a new-looking town.
- **1.5.1** (2026-10-18): New logo, cover and banner: a 3D render of the town with a realistic tornado tearing down the avenue under a storm sky. The animated main-menu logo now has a spinning tornado with debris and lightning.
- **1.5.0** (2026-10-18): Tornado Alley: storm chasers (an armoured intercept vehicle drives in, stops to photograph you, then races off on the roads a little faster than you; catch it for +800, or if it gets away with its pictures another seeding plane joins the hunt), zoom (pinch, mouse wheel or +/- buttons, both views), seasons picker, and your survivor and car skins on the townsfolk and traffic. Chests: new players get coins fast (very generous until 2 coins, generous until 5).
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

1. Create (or edit) the project → Title **Dead City: Tornado Alley**, URL, Kind **HTML**, upload the zip, tick "played in the browser", set viewport and Mobile friendly.
2. Paste the description and controls into the body.
3. Under Edit theme: background image `background-1920x1080.gif` (or the still `.png`; don't repeat, top centre, tick Fixed), background colour #0e0818, page background #1a0f2e, text #e9e4f5, links and buttons #7dff3a. Upload `cover-630x500.png` as the cover, the eight `shot-ta-*` screenshots in order (remove the older `shot-1` … `shot-7`), and `banner-960x200.png` under Theme → Banner.
4. Tags, genre, status, pricing as above. Save, then **Public** when you are happy.
5. Test the embed on your phone: the page is portrait first; use the fullscreen button.

## Parked modes (not on the page for now)

Survival and Extract are hidden from the menu but still in the build (`deadcity.html`, `zombieville.html`). Their old write-ups, for when they come back or move into the kaiju game:

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

**Dead City (Survival):** Left thumb is the joystick. Drag the right side to turn the camera. Hold **FIRE** to shoot (space on PC). Tap the spell buttons once a book is found. Double-tap next to a vehicle to drive it, double-tap again to get out. Double-tap next to a ride to play its operator game. **SCAN** sends a pulse toward your objective, three times a day. **ISO/3RD** switches the camera. Pinch or scroll to zoom. ❚❚ pauses; Esc or P on PC.

**Extract:** You walk on your own. Tap the **left** side of the screen (or ◀) to turn left at the next corner, the **right** side (or ▶) to turn right. Hold **WALK** to slow down or **RUN** to speed up; both burn stamina, purple gems refill it. Tap a spot up to five cells ahead to walk there. Walk up to people and they join your line. Gather the number shown (10 in district 1, up to 70 by district 10), then reach the green beam for the heli. Never turn back into your line, and avoid dead ends. Double-tap a ride to use it. Hold a finger down to preview the way. Arrow keys on PC.
