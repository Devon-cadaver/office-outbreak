# Tornado Time! — itch.io page kit

Everything needed to set up https://devs66.itch.io/ for the game. Current version: **1.35.0**. Upload `release/tornado-time-web-v1.35.0.zip` as an **HTML** project. Each version gets its own zip (`-vX.Y`), so older builds stay in `release/` to fall back to. All the images below are in `release/itch/tornado-time/`.

The game used to be called Dead City: Tornado Alley. From 1.28.0 it is **Tornado Time!**, with Kaiju Madness as its bonus game. Older zips keep their old `survive-dead-city-web` names.

> All monsters, robots and characters in Tornado Time! are original creations. Any resemblance to other characters is coincidental.

## Upload settings (Edit game page)

| Field | Value |
|---|---|
| Title | Tornado Time! |
| Project URL | `tornado-time` if you want the address to match. Changing it breaks links to the old address, so keep the old one if people already have it. |
| Short description / tagline | You are the tornado. Wreck six towns, swallow rival twisters, zap UFOs and blow up everything worth blowing up. |
| Classification | Game |
| Kind of project | **HTML** |
| Uploads | `tornado-time-web-v1.35.0.zip` (about 40 MB, mostly the eleven songs). On an update, upload the new zip and delete or hide the old upload. Tick **This file will be played in the browser**. |
| Embed options | Viewport **Click to launch in fullscreen**, or embed 480 × 854 (phone portrait) / 960 × 640 (desktop). Tick **Mobile friendly** and **Fullscreen button**. Orientation: Portrait for phones. |
| Frame options | Leave SharedArrayBuffer off. No special headers needed. |
| Pricing | Free (or "No payments"). |
| Genre | Action |
| Tags | tornado, destruction, arcade, kaiju, browser, mobile, low-poly, casual, singleplayer, 3d |
| Made with | Three.js |
| Average session | A few minutes |
| Inputs | Touchscreen, Mouse, Keyboard |
| Accessibility | Drag or tap controls. Each new thing is shown once, in the round, with the game paused. Nothing needs sound or colour alone. |
| Release status | In development |

## Images (itch sizes)

| Slot | File | Size | Notes |
|---|---|---|---|
| Cover image | `cover-630x500.png` | 630 × 500 | itch asks for at least 315 × 250 and recommends 630 × 500. |
| Banner (Theme → Banner) | `banner-960x200.png` | 960 × 200 | The thin one. `banner-960x400.png` is there if you want it taller. Both replace the title text at the top of the page. |
| Page background (Theme → Background image) | `background-1920x1080.gif` (animated, 2.4 MB) or `background-1920x1080.png` (still) | 1920 × 1080 | The Acid Storm spinning on the left, the saucer beaming people up on the right, and a still skyline between them, where the page column sits. Don't repeat, top centre, tick **Fixed**, background colour #120a1f. It loops every 2.8 seconds and its edges fade into that colour. Drawn in `background-scene.html`; keep any new GIF under about 3 MB. |
| Key art (social posts, devlogs) | `key-art-1920x1080.png` | 1920 × 1080 | A still of the game's opening, no logo. |
| Logo (devlogs, social posts) | `logo-1200x700.png` | 1200 × 700 | Transparent background. Drawn in `logo.html`. |
| Screenshots: Tornado Time! | `shot-01-title.png` … `shot-13-choose-your-tornado.png` | 1280 × 720 | Upload in order. See the list below. Remove every older screenshot. |
| Screenshots: Kaiju Madness | `kaiju-01-roster.png` … `kaiju-05-fight-wrestler.png` | 1280 × 720 | Put these after the tornado ones: it is the bonus game. |
| Phone screenshots (optional) | `phone-01-title.png`, `phone-02-menu.png`, `phone-03-play.png` | 540 × 1170 | For anywhere that wants upright shots, such as a store listing later. |

What each screenshot shows:

1. `shot-01-title`: the new opening and title: the Liberty Twister in the graveyard, a plane down in the distance, a saucer beaming people up.
2. `shot-02-wreck`: Downtown coming apart: buildings break into real pieces of themselves.
3. `shot-03-rogue-twister`: the rogue twister, bigger than you ("IT IS BIGGER! GET AWAY").
4. `shot-04-ufo-shrink-ray`: the UFO's shrink ray landing on the storm, shield up.
5. `shot-05-ufo-beam`: the UFO beaming people up with its shield down: the moment to strike.
6. `shot-06-fairground`: the fairground going up in balloons and fireworks.
7. `shot-07-power-plant`: the power plant throwing lightning at the buildings round it.
8. `shot-08-sirens`: a police station's siren lights racing off in every direction.
9. `shot-09-plane-crash`: a seeding plane struck down, during the blackout.
10. `shot-10-f5-countryside`: an F5 at the edge of town: the wide view, gunships inbound, fields beyond.
11. `shot-11-future-chompnado`: the Future era with the Chompnado.
12. `shot-12-wild-west-firenado`: the Wild West with the Firenado.
13. `shot-13-choose-your-tornado`: all eighteen storms.

Kaiju Madness: `kaiju-01-roster` and `kaiju-02-roster-robots` (the monster picker, 60 of them), `kaiju-03-rampage` (Scorchback flattening Downtown), `kaiju-04-fight-robot` (Scorchback against Triple Decker), `kaiju-05-fight-wrestler` (Big Bruno Boulderbeard against Grumblegorilla, with a weak-spot marker up).

## Description (paste into the page body; Markdown works)

# It's TORNADO TIME!

**You are the storm.** Drag to steer a twister through town, tap to throw lightning, and grow from a dust devil into an F5 monster that pulls towers out of the ground.

🌪️ **Wreck everything.** Buildings crack, shudder and break into real pieces of themselves (walls, windows, roofs, the floors inside), spin up your funnel and get flung across town. Cars, crowds, tanks: it all goes up. Keep it going for a x5 combo.

⚡ **Throw lightning.** Tap anywhere and a bolt lands first: buildings catch fire, cars blow up, and anything in the sky comes down.

🎯 **Ten big targets, ten big finishes.** The big targets are the mission, and every one goes up its own way:

- The **water station** bursts and a wave washes the streets clean.
- The **fire station** and **police station** throw siren lights in every direction (and the jail empties).
- The **fairground** lets go of every balloon and firework it has.
- The **graveyard** goes up in ghost-fire, and the dead rise.
- The **power plant** throws lightning at everything near it, then the whole town goes dark.
- The **sewage plant** becomes a stink storm. The **radio tower** topples. The **weather station** loses its dish.
- And the **nuclear plant**... makes you the NUKULAR NADO.

🛸 **The town fights back.** A new enemy turns up in each town:

- **Seeding planes** shrink you with their spray. Strike one and it comes down in flames, ploughing a burning furrow through town.
- **Storm chasers** race in for a photo. Blow them up with lightning, or catch one and hurl it.
- A **rogue twister** eats your town before you can. Swallow it while it is smaller than you. Run when it is bigger, and strike it down to size.
- A **storm cannon** guards a big target and blasts you back along its orange line.
- **Gunships** circle you firing freeze rockets.
- A shielded **UFO** hunts you with a shrink ray. Wait until it drops low to beam people up, then strike. Three hits and it crashes.

🏙️ **Six towns, three eras.** From Small Town to The Sprawl, in the Present, the Wild West or the Future, with Halloween, Christmas and 4th of July seasons. Every round is a new map, with countryside rolling out past the last street.

🎨 **Eighteen storms to play as, and each one throws something.** The Chompnado flings sharks, the Hallowstorm lobs pumpkins, the Blizzard hurls lumps of ice and the Liberty Twister sets off fireworks. The Zombienado drops the dead into the streets to chase the living. The Ghostnado possesses people so they walk into the storm. The Planetnado calls down meteors, the Mallownado glues people to the spot, and The Void is a hole in the sky that nobody sees coming. Plus the Honknado, Wormhole, Gridnado, Glitchnado, Firenado, Bunnynado, Poonado, the Classic Twister, and the Acid Storm for beating Megacity. Every storm is on show in the shop, spinning, before you own it. Win them in the prize games after each round or buy them with coins.

▶ **Straight in.** Hit QUICK PLAY and you are in a round. No tutorial: the first time something new turns up, the round pauses and shows you what to do.

📻 **Nine original songs** on the in-game radio.

## Bonus game: KAIJU MADNESS

The same towns, but this time **you are the monster**. Stomp, smash and eat your way from Hatchling to Titan to Colossus, wreck the big targets, and when a rival Kaiju shows up, fight it: tap to swing, hit the glowing weak spots, fill its daze bar, then SPIN & TOSS it across town or finish it with a wrestling move.

**60 original monsters to collect**, each with three special moves of its own, plus Skeleton and Halloween looks:

- **23 giant robots**, from Triple Decker and Paladin-7 to Boombox and Iron Grandpa
- **10 upright giants**: lizards, dinosaurs and stranger things, led by Scorchback and his Atomic Breath
- **8 masked wrestlers**, each with a flying elbow
- **4 flyers** (two giant moths, two pterosaurs), **4 four-legged beasts**, **3 great apes** and **3 walking plants**
- And five one-offs: a crab, a spider, a squid, a blob, and Mike Ferguson the Bounty Hunter with his sledgehammer

Two are yours from the start. Win the rest in the prize games after each round.

*Plays in your browser. Built for phones (hold it upright); works with mouse and keyboard too. All monsters, robots and characters are original creations.*

## How to play (paste below the description or into a "Controls" section)

**Steer:** drag anywhere (WASD or arrow keys on PC). **Move with lightning:** tap a spot. **Strike:** tap a plane, storm chaser, rogue twister, cannon, gunship or UFO (SPACE on PC strikes whatever is ahead of you). **Find targets:** follow the arrows at the screen edge, tap a target's icon at the top, or tap the minimap. Dim icons need a bigger storm; gold ones are ready. **Zoom:** pinch, scroll or tap **+ / −**. **Pause:** ❚❚, or Esc / P on PC.

**Kaiju Madness:** drag to walk, tap to smash or strike. Near a rival, tap to swing and hit the glowing dots (gold: critical, red: counter its swing, purple: instant daze).

## Bio (for the devs66 profile)

Small browser games built fast, tested on a phone, and tuned by playing. Tornado Time! is the one where you are the tornado.

## Version history

- **1.35.0** (2026-11-21): Beam 'Em Up! has a second machine: THE LONGSHANKS, a three-legged walker. It stamps on the buildings its feet come down on, its death ray fires by itself, and its searchlight beams up anyone or any car caught in it for three seconds. 17 walker skins in the shop. Zombie Air Raid: enemy UFOs now hunt the plane and the heli (more and tougher in the bigger towns): dodge their red aiming line, and your tail gun shoots back. Grave Giants grab or swipe you for a third of your health and send you spinning, and only bring you down when you are already badly hurt. Your player badge sits beside EXIT GAME on the main menu.
- **1.34.0** (2026-11-21): The PLAYER card: a player level (one for every town cleared in every game and era, every 5 skins and every badge), an emblem that grows with the games you have beaten (Tornado, Zombie Tornado... all four is APOCALYPSE) in bronze, silver, gold, emerald or cosmic, and 45 badges, locked until earned. Tap your emblem on the main menu or PLAYER on any pause screen to see every town cleared, your skins and your badges. Zombie Air Raid's goal bar now fills up as the horde goes down. In Beam 'Em Up! the beam comes down by itself after three seconds over people or cars.
- **1.33.0** (2026-11-21): New controls. Zombie Air Raid: health, ammo and supplies sit in the top bar beside COLLATERAL; DROP and FIRE are a smaller button on the right, halfway up; a double tap also drops napalm on a spot (the bomber swoops over it) or fires a rocket at it (the heli); the weapon icons are bottom right; the heli aims with a beam of light instead of a ring. Beam 'Em Up!: no BEAM button: hover over people for a second and the beam comes down by itself (or hold on the saucer). On phones the mini map is smaller and the % badge is just an icon and the number.
- **1.32.0** (2026-11-21): Weapon upgrades. Zombie Air Raid: destroying zombies and blowing up big landmarks (now free of collateral) fills a SUPPLIES bar that unlocks a big bomb or big rocket, then a fire wall or rocket salvo, then a NUKE; pick them on the right. The heli shoots where you double tap. Beam 'Em Up!: beaming people up levels the ray from S1 to S5: heavy ray, triple ray, mini nuke and big nuke. Hold on the saucer and slide to beam and steer at once. Grave Giants throw twice as often, and fly into one and it grabs you and slams you down. After a round there is a 3 in 4 chance (1 in 4 after a loss) of a new skin for your aircraft or a new zombie horde. Townsfolk no longer run on the spot. Start screens fit on one phone screen: a one-line title, era and season on one line each.
- **1.31.0** (2026-11-21): Two new bonus games. ZOMBIE AIR RAID: fly a napalm bomber or a rocket heli over a zombie town, with more zombies in every town (300 up to 600), solid tall buildings, acid-spitting Gloopers and Grave Giants that throw chunks of buildings at you. BEAM 'EM UP!: be the UFO. Tap to fly there and zap, your death ray hits nearby buildings by itself, and you hold your finger on the saucer to beam people up, while helicopters, fighter jets and horn trucks fight back. New skins: 17 each for the bomber, the heli and the saucer, one for every tornado skin, plus 12 zombie hordes (skeletons, vampires, orcs, mummies, pumpkin heads, werewolves and more) for Air Raid, the saucer's graveyard and the Zombienado. Two new songs, Napalm Requiem and Beam Beam Baby.
- **1.30.0** (2026-11-20): Kaiju fights rebuilt: tap for combos, flick to send a rival flying through buildings, flick to dodge (dodge late for a slow-motion counter). Wrestling moves follow your finger: lift and slam, swing it over, pull back and charge. Break free when a rival grabs you. Aim your throws and blasts, and tap as you land for a perfect flying elbow. Monsters move with more weight. Kaiju Madness now has the storm cannons, gunships and UFO, each big target's own explosion, big tank blasts and the new screen layout. House doors have a fresh look.
- **1.29.5** (2026-11-20): A red EXIT GAME button is on the main menu and the pause screens: it leaves full screen and returns to the title. The pause button stays top right; zoom and skip-song sit under it on a computer and along the bottom on a phone. A storm cannon struck by lightning goes up in a big blast with a shock wave that flattens nearby buildings.
- **1.29.4** (2026-11-20): The targets bar always fits on one line and runs across the top. The pause, zoom and skip-song buttons are one size and sit along the bottom beside the mini map, which is a little bigger. A badge above the mini map shows how much of the town is destroyed. Pausing the game now silences every sound.
- **1.29.3** (2026-11-20): The skin shop fits more skins on one screen. Destroying a big target or an enemy gives the storm a short speed boost, and a boosted storm flashes and throws lightning. You can wear several townsfolk and car skins at once: each one fills a quarter of the town. A bigger rogue twister that holds you for three seconds absorbs your storm and ends the round, and seeding planes, cannons, gunships and the UFO now shrink the rogue twister too. Tanks struck by lightning blow up big. Streets have zebra crossings where the lines end, and open squares are now parks with footpaths. Lightning bolts start from a point. Music is half volume on menus and pauses when the game is paused.
- **1.29.2** (2026-11-19): Full screen now stays on when you go to the main menu or the skin shop from a game. The prize games in Tornado Time! can hand out a new storm: three times in four after a level you cleared, one in four after one you did not. The tornado has a faint wind sound that grows with the storm.
- **1.29.1** (2026-11-19): Two storms have new names: the shark storm is now the Chompnado and the clown storm is the Honknado. If you own either, you still do. The Honknado honks when one of its pies lands.
- **1.29.0** (2026-11-19): Nine new storms: Honknado, Zombienado, Ghostnado, Mallownado, Planetnado, Wormhole, Gridnado, The Void and Glitchnado. Storms now throw things: the Chompnado flings sharks, the Hallowstorm lobs pumpkins, the Blizzard hurls lumps of ice, the Firenado throws fireballs, and more. The Liberty Twister's fireworks are bigger and the Hallowstorm's bats have real wings. In the skin shop and on both CHOOSE screens every storm and monster is now shown moving, and locked ones appear in full colour with a padlock so you can see what there is to win or buy.
- **1.28.0** (2026-11-19): The game is now called Tornado Time!, with a new logo. A new opening plays when the game starts: the Liberty Twister tears into the graveyard, a burning plane comes down in the distance and a UFO beams people up, then TAP TO PLAY. The same scene carries on behind the main menu. Kaiju Madness is now listed as the bonus game.
- **1.27.0** (2026-11-19): Every big target in Tornado Alley now goes up in its own way: the water station bursts, the fire and police stations throw siren lights in every direction, the fairground lets go of its balloons and fireworks, ghosts rise from the graveyard, the weather station dish flies off, the sewage plant spouts, the power plant throws lightning and the radio tower topples. Storm chasers explode when struck by lightning, and again where your storm hurls them. The camera pulls back further with each F level past F1. Targets you are too small for stay on screen dimmed, then turn gold. There is countryside round every town in both games: fields, roads, woods, farms and hills. Fixed: shockwave rings, firelight on the ground and scorch marks were never being drawn.
- **1.26.0** (2026-11-19): Four new enemies in Tornado Alley. A rogue twister eats your town from the Suburbs on: swallow it while it is smaller than you, strike it down to size when it is bigger. A storm cannon guards big targets from Downtown on and blasts you back along its orange line. Gunships circle from Metro on, firing freeze rockets that slow you. A shielded UFO with a shrink ray hunts you in Megacity and The Sprawl: strike it when it drops low to beam people up. Seeding planes hit by lightning now crash in flames and take a strip of town with them. In Kaiju Madness, buildings burst apart when they are hit or stepped on.
- **1.25.0** (2026-11-19): A big visual and speed upgrade. Buildings now crack and break into real pieces of themselves as the storm tears them away. Lightning, explosions, smoke and dust are all new, and the tornado bends as it moves. The city has brick, concrete and glass buildings with shopfronts and rooftop detail. A proper tank, dressed soldiers, and townsfolk who run with their arms up. Kaiju fights get a close-up camera, a weightier walk and slow-motion knockouts. Everything draws much faster, and there is a sixth, bigger town: The Sprawl. New loading screen.
- **1.24.0** (2026-11-18): New QUICK PLAY button on the main menu: pick a game and go straight into a round, right where you left off. The tutorial is gone: the first time each new thing comes up, the round pauses and shows you how, with an arrow. The top of the screen now shows your size and the big targets first: tap a target icon to head for it, and every target wears a badge in town. How To Play only opens when you ask for it.
- **1.23.10** (2026-11-02): Kaiju Madness: once every building and big target is gone, THE TOWN WAS DESTROYED, and your Kaiju leaves after finishing any fight. The end-of-round screens have separate MENU and MAIN MENU buttons. The main menu buttons no longer cover the subtitle.
- **1.23.9** (2026-11-02): Pick any era from the start: each era has its own five towns to beat in order. Choose the season too, with Random as the default. The Radio Station gets volume, pause, a highlight on the playing track and two new songs, My Little Disaster and its Kawaii version. The old computer-made music is gone: the game now opens on the first radio track.
- **1.23.8** (2026-11-01): New Radio Station on the main menu and in both pause menus: play any song now, skip, and choose which songs stay in the shuffle. The opening cut scene is gone; PLAY goes straight to the main menu.
- **1.23.7** (2026-10-27): Big maps run much smoother: building debris, trees, lamps and other props now draw in batches, and fallen bits clear away sooner. The Nukular Nado lasts twice as long, the nuclear plant turns up from Downtown, Megacity has 30 more seconds, and you can zoom out further.
- **1.23.6** (2026-10-27): Fight buttons no longer cover each other. The Skin Shop opens on the skins for the game you came from. The end-of-round screen is more compact so its buttons fit without scrolling. Going back to the main menu skips the intro clip after the first time.
- **1.23.5** (2026-10-27): Game tips are now small and sit near the top, out of the way of buttons. The SPIN & TOSS / RANDOM MOVE choice stays up until you pick one. Mega mode has its own MEGA NUKE / MEGA ROAR button so you can save the blast for the right moment.
- **1.23.4** (2026-10-27): The round now ends with TOTAL DESTRUCTION as soon as the screen shows 100% destroyed and every target is done, in both games. A new player's first round opens with the theme song, Tornado Alley.
- **1.23.3** (2026-10-27): Fixed roof snow and holiday decorations hanging in the air after their building was destroyed, in both games.
- **1.23.2** (2026-10-25): Fixed the web version missing the fight buttons and markers (weak-spot dots, daze bar, finisher and ranged-attack buttons) and the new title-screen music.
- **1.23.1** (2026-10-25): Beating a level now opens the next town straight away, even if you change monster or visit the shop first. The start screen also shows newly unlocked eras and new best scores right away. Kaiju fights now get steadily harder from Small Town to Megacity, with tougher, faster rivals, while staying winnable, and you take less damage while you're still small. Gloom Storm no longer darkens the screen.
- **1.23.0** (2026-10-25): The menus now play the original synth beat, and the songs start at a low volume once you begin a round. New ranged attack in Kaiju fights: when a rival is out of reach, hurl a building or fire your special, then charge in. Mike and the wrestlers finish with a flying elbow.
- **1.22.1** (2026-10-24): The Skip Song button now stays in place when you tap it, so you can keep skipping.
- **1.22.0** (2026-10-24): Kaiju fights are now in your hands: near a rival, tap to swing, and hit the glowing dots (gold for a critical hit, red to counter its swing, rare purple to daze it instantly). Fights take the same effort in every town, so Megacity rivals are no longer brutal. New Skip Song button on screen in both games. Footsteps and smashed buildings are much easier to hear, and SOUND OFF now mutes only the sound effects, not the music. The army now dresses for the era: Wild West cavalry and Future troopers with laser rifles.
- **1.21.3** (2026-10-24): The camera now zooms out to keep you and your rival on screen for the whole fight. The giant swing goes round low to the ground and ploughs through buildings and cars, and thrown monsters skid along the ground wrecking everything in their path before getting back up.
- **1.21.2** (2026-10-23): Fights look more natural: Mike mixes golf swings and overhead slams, and wrestlers mix slams and big boots. Music on iPhone comes back with your next tap after iOS pauses it (Control Center, a call, switching apps).
- **1.21.1** (2026-10-23): Kaiju fights last longer, with tougher rivals and a slower daze meter. When a rival is dazed, choose SPIN & TOSS or RANDOM MOVE (one of the wrestling moves). Rivals fight back the same way: they can grab you and spin and toss you across town, or hit you with a random wrestling move.
- **1.21.0** (2026-10-23): New, simpler Kaiju fighting: no more locked-in mini games. Hit rivals with your normal attacks, watch for the red ring when they wind up a swing and step out to dodge, fill their daze meter, then finish them with SPIN & TOSS or a wrestling FINISH IT! move. Fixed Mike's legs flickering and his floating walk.
- **1.20.3** (2026-10-23): Fixed Kaiju fights stalling, where the rival just kept walking into you and no moves started, especially with big or flying rivals. The points sound is now softer and plays less often.
- **1.20.2** (2026-10-23): Kaiju fights feel better: no more teleporting. Thrown fighters stay where they land and get back up, and between moves the two square up at boxing distance like Rock 'Em Sock 'Em robots. Grabs step in instead of yanking, and knockbacks slide. Future era tanks are now hover tanks with twin glowing cannons that fire pink laser bolts.
- **1.20.1** (2026-10-23): More arcade sounds: buttons click when you press them, kaiju stomp as they walk (deeper as they grow) and flyers flap their wings, points ping like coins and climb in pitch as your combo builds, and power-ups play a jingle.
- **1.20.0** (2026-10-22): New free storm: the Poonado, a brown and green sewer tornado full of poo, toilet paper and sewage barrels that leaves a sewage trail. Tornado Alley's menu now has a YOUR TORNADO card to pick your storm. Every wrestler gets their own ring gear skin plus Skeleton and Halloween. Caped wrestlers fly off at the end, the rest ride a chopper, and every flying exit now heads off into the distance. The map editor can set a map in the Wild West or the Future. Menus, pause screens and the skin shop are tidied up, and every button is now a chunky arcade button that pushes in.
- **1.19.0** (2026-10-22): Eight new wrestler kaiju to win: Big Bruno Boulderbeard, The Hollow Monk, Rayo Azul, Calavera Loca, Granite Gunnar, Velvet Vinnie Valentine, Thunderhide and Fuego Rojo. They slam with both fists, throw big boots, and every one has a FLYING ELBOW that dives elbow-first into the town, lands on its side and gets back up. They leave town on a chopper in their colours or in a burst of pyro. Mike now boots a close kaiju away when he wins the roar-off, and throws his hammer with a baseball swing.
- **1.18.0** (2026-10-22): Kaiju fights reworked: a rival locks you into a fight that opens with a roar-off (win it and you're PUMPED: +50% power), then wrestling moves chain with no pauses: chokeslam, piledriver, suplex, spear, superkick and the giant swing, with arms that match each move. Miss and it reverses on you; the rival goes for moves on you too, and you tap to break free or get thrown across town. Spells follow up after a throw. New intro with the tornado tearing up the town.
- **1.17.0** (2026-10-22): New eras: beat Megacity to unlock the Wild West and the Future for every town in both games. The Wild West has dirt roads, wooden storefronts, cacti, horse-drawn buggies, wagons, stagecoaches, biplanes and cannons. The Future has neon glass towers, pod houses, glowing roads, hover cars, flying traffic, jets and hover tanks. New outfits to match: Cowpoke and Neon Citizen.
- **1.16.2** (2026-10-22): Cleaned up the intro: no more rooftops floating in the sky near Mike.
- **1.16.1** (2026-10-22): Fixed Kaiju Madness rounds ending instantly at 0:00 after a previous round ran out of time.
- **1.16.0** (2026-10-21): The game now opens on a TAP TO PLAY screen, and after that the music plays non-stop through the menu, both games and the shop. New intro: Mike swings a kaiju round and hurls it, with the neon Liberty Twister behind. The Kaiju menu button now reads PLAY KAIJU BATTLE.
- **1.15.2** (2026-10-21): The music is now one radio that plays on the main menu, both games and the skin shop, picking up the same song where it left off as you move around (until you switch MUSIC off). The end-of-round screens have a SKIN SHOP button.
- **1.15.1** (2026-10-21): Fixed the camera staying frozen in the round after Mike rides off on his chopper, and the mouse wheel no longer zooms the camera over menus. Mike's Halloween skin is now a pink tutu and a long blond wig over his normal outfit.
- **1.15.0** (2026-10-21): Mike Ferguson gets a big upgrade: a natural walk, two-handed hammer swings, a golf swing for smashing and snacking, overhead slams instead of spins in fights, a bright green nuke, arms out in Spin & Throw, and at the end of the round he rides off on a chopper that bursts out of the street.
- **1.14.1** (2026-10-21): Skins you win now go straight on, and the pause menu has a CHOOSE SKIN button that lists only the skins you own and swaps your storm or monster on the spot.
- **1.14.0** (2026-10-21): TOTAL DESTRUCTION! Flatten every building and big target before time runs out to get a time bonus, an extra prize go, and a free skin you don't own yet (a tornado skin in Tornado Alley, a monster skin in Kaiju Madness).
- **1.13.5** (2026-10-21): The Liberty Twister skin now has glowing neon red and blue rings spinning around a darker funnel.
- **1.13.4** (2026-10-21): New song on the radio in both games: Tatsumaki Justice.
- **1.13.3** (2026-10-21): Mike is now MIKE FERGUSON THE BOUNTY HUNTER.
- **1.13.2** (2026-10-21): Both games now share one radio station of all six songs, shuffled so none repeats until they've all played.
- **1.13.1** (2026-10-21): Kaiju Madness now has its own three songs (Feeding Ground, Stomp the Block, Saving You the Trouble), and after a roar-off the winner celebrates and the loser sulks, each kind of monster its own way; Mike throws his sledgehammer at the rival and it flies back to him.
- **1.13.0** (2026-10-21): New free monster in Kaiju Madness: MIKE THE BOUNTY HUNTER, a giant in a tactical vest with a sledgehammer (Taser Zap, Sledgehammer Slam, Warrant Served); his Skeleton skin has a flaming skull.
- **1.12.0** (2026-10-21): Kaiju Madness gets its own soundtrack (Feeding Ground plus the Tornado Alley songs), and both games' pause menus now have SKIP SONG, REPEAT and a MUSIC VOLUME setting (Low, Med or Full Blast).
- **1.11.9** (2026-10-21): Tornado Alley music is quieter (now on iPad too), starts as soon as you open Tornado Alley and keeps rotating through rounds and pauses, and the pause menu has a SKIP SONG button.
- **1.11.8** (2026-10-21): Tornado Alley's soundtrack now rotates three songs: Tornado Alley, Twister Against the Army and Clean Slate.
- **1.11.7** (2026-10-21): Tornado Alley now plays a real rock soundtrack during rounds, and there's a separate MUSIC on/off button next to SOUND on every menu.
- **1.11.6** (2026-10-18): Tornado Alley: SPACE now only zaps targets in front of the storm (same priority), otherwise the bolt hits the ground just ahead; and it targets planes again.
- **1.11.5** (2026-10-18): Tornado Alley: on a computer, SPACE fires a lightning bolt at the nearest target (planes first, then the chaser, tanks, soldiers, people and buildings), and lightning now takes out tanks and soldiers.
- **1.11.4** (2026-10-18): Fixed roof slabs and rooftop bits floating in the air after their building was destroyed, in both games.
- **1.11.3** (2026-10-18): Kaiju Madness: the combat bar now sits right under the fight, and on a computer SPACE casts your spell (it aims itself) and plays the mini games, with the arrow keys for swipes.
- **1.11.2** (2026-10-18): Bug fixes: restarting during a nuke, MEGA blast or spell no longer leaves effects hanging in the next round, and delayed effects can't spill into a new round.
- **1.11.1** (2026-10-18): Fixed roofs that stayed floating after buildings were destroyed, and the menu intro now fills the whole phone screen.
- **1.11.0** (2026-10-18): Every monster is now an original: new names, colours and looks for all 51. A new menu intro and poster made from our own monsters, a credits note, the intro now starts properly on phones, and long banners fit on small screens.
- **1.10.10** (2026-10-18): Big banners like THE DESTRUCTION HAS ENDED! now fit on phone screens, and the menu intro plays again when you go back to the menu.
- **1.10.9** (2026-10-18): The menu intro now plays every time you open the menu, and the logo stays sharp if your browser won't play the clip.
- **1.10.8** (2026-10-18): A new main menu: the Dead City intro plays once and freezes on the last frame as the buttons pop in, and everything fits on one screen. The Kaiju monster picker now swipes sideways instead of scrolling down.
- **1.10.7** (2026-10-18): Two skins for every monster: Skeleton, and Halloween with glowing orange bones and a flaming jack-o'-lantern head (or a witch's hat with bats). In the shop, pick a monster first, then its skins.
- **1.10.6** (2026-10-18): Every monster rebuilt with detailed models (smooth bodies, teeth, claws, plates, wings, panels), skins included. Brawls play smooth big moves as you mash: machine guns, lasers and rocket volleys for the machines, spinning haymakers and spell bolts for the monsters. Barkley is now a walking tree.
- **1.10.5** (2026-10-18): Eleven new monsters to fight with (cosmic giants and living plants), 51 in all. A first look at detailed monster models: Scorchback, Squidney and Rigbuster are smooth and detailed instead of blocky.
- **1.10.4** (2026-10-18): Rounds end in the world: the storm dies away, or your monster burrows into the ground or flies off. Music on the title screen, no more flash of an old menu while a game loads, and a skin shop you swipe sideways with locked monsters' skins in their own row.
- **1.10.3** (2026-10-18): Kaiju fights look like fights: monsters collide instead of passing through, robots rock back firing bullets and rockets, monsters spin and fling spells. A slimmer Tornado Alley tutorial. And save codes: copy your progress from the main menu and load it on any device.
- **1.10.2** (2026-10-18): The prize game gets its own screen before your score, Kaiju Madness has a proper monster picker (a scrolling screen with a picture of every monster), and the start buttons just say PLAY.
- **1.10.1** (2026-10-18): A green tornado icon when you add the game to your home screen, the Nukular Nado lasts 15 seconds, and a Restart Level button (tap twice to confirm) on the pause screen of both games.
- **1.10.0** (2026-10-18): MEGA KAIJU and nukes. Kaiju Madness: the camera pulls back as you grow (and closes in when you shrink), and MEGA boosters drop now and then: grab one and for 10 seconds you are bigger than a Colossus, take no damage, smash anything, and get one MEGA NUKE or MEGA ROAR that flattens everything around you. Tornado Alley: wreck the nuclear plant and it goes up in a mushroom cloud that flattens the blocks around it, then you are the NUKULAR NADO for 8 seconds, glowing yellow and tearing through anything.
- **1.9.11** (2026-10-18): Swipe Combo no longer asks for a swipe down (left, right and up only).
- **1.9.10** (2026-10-18): Spells match the skin: tornado lightning takes the storm skin's colours (red Firenado, green Acid Storm, orange with a black edge for Hallowstorm, and so on, for the tap bolts too), and skinned kaiju and the robots cast in their own colours.
- **1.9.9** (2026-10-18): Kaiju Madness: 9 rounds in 10 now win a kaiju or robot in the prize games, and 1 in 5 win two.
- **1.9.8** (2026-10-18): Halloween skins for the 20 robots: Haunted (rusty, glowing green eyes, bats circling), Ghostly (pale glowing blue), Pumpkin and Skeleton.
- **1.9.7** (2026-10-18): Kaiju Madness: 20 giant robots join the roster (Rigbuster, Paladin-7, Heavy Metal Hank, Beanpole Bot, Critterbot, UFO-Bot, Dockworker, Propellerhead, Iron Grandpa, Rusty, Bubble Buggy, Sentry Sam, Boombox, Smokestack, Cannonball, Honker, Chrome Dome, Triple Decker, Turret Tom, Clankosaur Mk II), each with three powers; win them in the prize games.
- **1.9.6** (2026-10-18): Halloween skins for all 20 kaiju in a new Kaiju tab of the skin shop (1 coin each): bats with little bats circling them for the flyers; green Undead with purple bones, purple Ghouls with green bones, black Skeletons and flaming jack-o'-lantern Pumpkins for the rest. Each kaiju keeps its own skin.
- **1.9.5** (2026-10-18): Sound on/off button on the start and pause screens of both games (and on iPad the sound now plays even in silent mode, and comes back if Safari pauses it). Kaiju Madness: Spin & Throw swings the rival round over your head (under you if you fly) and hurls it right across town, where it crashes down. New kaiju are now won in the end-of-round prize games instead of by KO; win one you already have and you get a whole coin.
- **1.9.4** (2026-10-18): iPad: Safari lets a downward swipe close full screen and a web page cannot stop it, so after the second time it happens the game stays in the normal Safari view instead of jumping in and out, and explains how to get the home-screen app (open the game in Safari, Share, Add to Home Screen), which has no browser bars to swipe away.
- **1.9.3** (2026-10-18): Tablets stay in full screen while you drag to move: the game claims the touch from the first finger-down so the browser cannot start its own swipe, and if the browser still drops out, one tap puts you back. Played from the home screen there are no browser bars at all. Smaller download (app icons squeezed).
- **1.9.2** (2026-10-18): Full screen that stays put on tablets (and an Add to Home Screen app with no browser bars). Kaiju Madness close combat has five mini games: Brawl, Swipe Combo (every miss and the rival hits you), Weak Spots, Dodge & Counter and Spin & Throw, plus a Roar-Off when a rival squares up from across the street. End-of-round prizes are now games, taking turns: a Claw Machine, a Prize Wheel and a Kaiju Egg. (v1.9.1 went out without its version bump or zip; 1.9.2 is the complete release.)
- **1.9.0** (2026-10-18): Kaiju Madness has all 20 kaiju: Skreech, Triple Trouble, Lobstirah, Angryrus, Grammera, Destroyah-yah, Biolettuce, Spaceyzilla, Megalawn, Smogorah, Varoom, Toadstorm, Kumbunga, Jirassic, Squidney and Battra-tat join Scorchback, Grumblegorilla, Lanternwing and Clankosaur. Flyers flap, four-legged beasts stomp, the crab scuttles, the spider skitters, the blob oozes, the plant writhes and the squid wriggles, and every one has three spells of its own. Rivals come from the whole roster; KO one to unlock it.
- **1.8.1** (2026-10-18): Kaiju Madness: faster monsters and faster early growth, a gentler army while you are small, more people, and buildings spill their people when they fall. Close combat is now a mini game: mash to win a BRAWL, or time your tap in a LOCK-UP for a body slam. Knocked-out rivals get eaten: a monster meal for a big boost.
- **1.8.0** (2026-10-18): New game: KAIJU MADNESS (early version). Be the monster: eat people to grow from Hatchling to Titan to Colossus, smash the town, take out big targets. Your size is your health: the army, napalm planes and rival kaiju shrink you. Tap to walk; when your Power bar is full, tap a target to cast your spell (each size has its own). Four kaiju so far (Scorchback, Grumblegorilla, Lanternwing, Clankosaur); KO a rival to unlock it. Also fixed: the TRY AGAIN / NEXT LEVEL button in Tornado Alley.
- **1.7.4** (2026-10-18): The tutorial's target ring is easier to spot: it draws over buildings, is thicker with a dark edge and has a bouncing arrow above it.
- **1.7.3** (2026-10-18): Seeding planes no longer sound a siren (you still hear their engines coming). Tutorial: big targets are marked with blue circles and icon badges, and your storm stays small enough that you have to zap the plane rather than swallow it. HOW TO PLAY has its own storm chaser card. The skin shop text is green. New thin banner for the page.
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
- **1.4.0** (2026-10-18): Tornado skins in the shop (2 coins each), used by every tornado in every mode: Hallowstorm (black, bats and jack-o-lanterns, green/purple/orange lights), Blizzard (white, snow, reindeer and snowmen, red and green lightning), Firenado (fire, embers, red lightning), Chompnado (waterspout full of sharks), Bunnynado (pastels, bunnies and eggs, pink lightning) and Liberty Twister (red, white and blue, flags, fireworks, multicolour lightning).
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

Design: Sean Duvall. Built with Three.js and Vite.

## Checklist

1. Edit the project → Title **Tornado Time!**, Kind **HTML**, upload the newest `tornado-time-web` zip, tick "played in the browser", set viewport and Mobile friendly. Hide or delete the old upload.
2. Paste the short description, the description and the controls.
3. Under Edit theme: cover `cover-630x500.png`, banner `banner-960x200.png`, background `background-1920x1080.gif` (don't repeat, top centre, Fixed; use the still `.png` if you would rather it did not move), page background #1a0f2e, text #e9e4f5, links and buttons #7dff3a.
4. Remove every old screenshot, then upload `shot-01` to `shot-13` in order, then the five `kaiju-` ones.
5. Tags, genre, status, pricing as above. Save.
6. Test the embed on your phone: the opening should play, then TAP TO PLAY, then the menu.

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
