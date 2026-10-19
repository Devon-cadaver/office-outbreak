# Kaiju Madness — design draft v2

Second game for Dead City. It plays like Tornado Alley, but you're a giant monster, and the city fights back for
real. Built on the same engine: `city.js` towns, the chunked rendering, the targets and minimap, the skin-shop
coins, the how-to cards, tips and tutorial, and layered music.

## The loop (same as Tornado Alley, with these changes)

- **Goal:** flatten the town's goal % and take out its big targets (the same ten, with their effects) before time
  runs out.
- **Grow by eating.** People (and zombies) are snacks. Eating fills your growth bar. There are three size stages:
  **Hatchling → Titan → Colossus**. Each stage is bigger, smashes taller buildings, and has a **different spell**.
- **Tap to walk, tap to cast.** Tap anywhere and your kaiju walks there, crushing whatever's in the way. A **Power
  bar** fills over time (and faster as you smash things). When Power is full, a tap **casts your current stage's
  spell** at that spot, then Power starts filling again. A drag stick is still there for fine steering.
- **The army hurts now.** Soldiers and tanks shoot you, and it does damage. Hits also slow you for a moment. Stomp
  them for a bit of health back.
- **Napalm planes** (instead of seeding planes) swoop in and drop burning napalm. It's a fire zone on the ground that
  hurts while you stand in it. Their engine sound tells you they're coming. Spells can shoot them down.
- **Rival kaiju** (instead of storm chasers) arrive to stop you destroying the city. A rival walks or flies in with
  its own health bar and fights you up close, casting its own spell now and then. KO it for a big bonus and a growth
  boost. It's tougher if it's a bigger stage than you.
- **Health:** you have a health bar. Eating people heals a little. Health hits zero and it's **KAIJU DOWN**.
- **Movement looks right:** flyers fly with flapping wings and cast shadows on the street. Walkers walk with
  stomping legs and swinging tails. Crawlers (spider, squid, plant) crawl with wriggling legs or tentacles.

## The roster: goofy nicknames, three spells each

Each spell is aimed at the spot you tap.

| # | Kaiju | Moves | 1 · Hatchling | 2 · Titan | 3 · Colossus |
|---|---|---|---|---|---|
| 1 | **GODZILLY** (Godzilla) | Walks, tail swings | **Atomic Hiccup**: a blue fireball lobbed to the spot, pops in a blast | **Atomic Breath**: a blue beam from the mouth, sweeping a burning line to the spot | **Spine Nova**: back spines glow, he leaps to the spot and lands in a huge blue blast |
| 2 | **KING KONK** (King Kong) | Knuckle-walks, climbs | **Car Toss**: grabs the nearest car and throws it | **Chest Drum**: drums his chest, and a shockwave cone stuns and flattens | **Tower Toss**: rips a whole building out and hurls it |
| 3 | **MOFRA** (Mothra) | Flies, big flapping wings | **Wing Gust**: a gust that blows cars and soldiers away | **Glitter Storm**: a cloud of shimmering scales that poisons and slows the army | **Rainbow Beam**: rainbow rays from the antennae |
| 4 | **RODANNY** (Rodan) | Flies, fast | **Peck Dive**: a dive-bomb to the spot | **Sonic Boom**: a supersonic line that rips up the street | **Firenado**: spins a fire tornado that wanders the block (a nod to Tornado Alley) |
| 5 | **KING GIGGLEDORAH** (King Ghidorah) | Flies, three giggling heads | **Zap**: one head spits a lightning bolt | **Triple Lightning**: all three heads fire golden lightning | **Gravity Storm**: lightning rains down over the whole area |
| 6 | **MECHA-GODZILLY** (Mechagodzilla) | Walks, clanky, jet boots | **Rocket Fists**: both hands fly out and punch | **Missile Party**: a swarm of homing missiles | **Freeze Cannon**: a chest beam freezes everything, then it shatters |
| 7 | **LOBSTIRAH** (Ebirah) | Walks **sideways** | **Claw Snap**: grabs a car or tank and crushes it | **Water Jet**: a high-pressure blast down the street | **Boiling Tide**: a wave of boiling water floods the block |
| 8 | **ANGRYRUS** (Anguirus) | Walks, always furious | **Spike Volley**: fires back spikes like darts | **Roll-Out**: curls into a spiky ball and rolls to the spot | **Tantrum Quake**: stomps a fit, and the ground cracks open |
| 9 | **GRAMMERA** (Gamera) | Walks, or flies spinning in her shell | **Plasma Spit**: a fireball | **Shell Spin**: spins like a saw-blade saucer to the spot | **Jet Rocket**: rockets across the map, leaving a trail of fire |
| 10 | **DESTROYAH-YAH** (Destoroyah) | Walks, short hops on wings | **Horn Slice**: a crimson energy slash | **Melt Beam**: melts buildings into puddles | **Crab Swarm**: splits into little crimson crawlers that rush the spot |
| 11 | **BIOLETTUCE** (Biollante) | Crawls on roots, vines wave | **Vine Whip**: grabs people and cars from far away | **Acid Sap**: sap rains on the spot | **Mega Bloom**: a giant flower bursts out of the ground and chomps the whole block |
| 12 | **SPACEYZILLA** (SpaceGodzilla) | Hovers, crystals glow | **Crystal Shard**: a spinning crystal shot | **Crystal Garden**: crystal towers erupt at the spot and zap nearby | **Corona Spiral**: a spiralling cosmic beam |
| 13 | **MEGALAWN** (Megalon) | Walks, drill arms spin | **Drill Dash**: charges, drills first | **Burrow**: tunnels under and bursts up at the spot | **Horn Lightning**: lightning from the horn, chaining building to building |
| 14 | **SMOGORAH** (Hedorah) | Oozes along, drips | **Sludge Ball**: a gross glob | **Smog Cloud**: a choking cloud that hurts the army and rival | **Saucer Mode**: flattens into a flying saucer and rains acid |
| 15 | **VAROOM** (Varan) | Runs, glides on his sail | **Tail Whip**: a fast spin | **Glide Slam**: glides to the spot and belly-flops | **Sail Flash**: a blinding flash that stuns everything nearby |
| 16 | **GABBERA** (Gabara) | Hops, never shuts up | **Shock Croak**: an electric burp | **Hop Slam**: leaps and lands in a thunder crash | **Thunder Belly**: an electric aura that zaps everything around for a while |
| 17 | **KUMBUNGA** (Kumonga) | Crawls on eight legs | **Web Shot**: sticks tanks and soldiers in place | **Web Net**: webs a whole block and slows everything in it | **Spiderling Swarm**: hundreds of baby spiders flood the spot |
| 18 | **JIRASSIC** (Jirass) | Walks, frill flaps | **Frill Flare**: the frill flashes and stuns | **Spit Geyser**: a water spout erupts at the spot | **Stampede**: a long unstoppable charge |
| 19 | **GEEZORA** (Gezora) | Slithers on tentacles | **Ink Squirt**: inks the army so they can't aim | **Tentacle Grab-o-rama**: eight tentacles grab everything around | **Deep Freeze**: an icy fog freezes the block |
| 20 | **BATTRA-TAT** (Battra) | Flies, dark flapping wings | **Horn Ram**: a dive charge | **Prism Eyes**: twin eye beams | **Dark Eclipse**: the sky goes black, the army can't see you, and your Power refills |

## Rivals

- **Who:** any kaiju you're not playing can show up as a rival, with a banner (**"RIVAL: KING KONK!"**), an edge
  arrow and a health bar.
- **Stage:** rivals come in at your stage or one above.
- **Fighting:** they melee you and cast their own spells on a timer.
- **Story pairs:** some show up as natural rivals, like Mofra vs Battra-Tat, Godzilly vs Mecha-Godzilly, and King
  Giggledorah as the Megacity boss.

## Unlocking (suggestion)

- **Start:** you begin with 4 kaiju, Godzilly, King Konk, Mofra and Mecha-Godzilly.
- **Unlock by KO:** KO a rival to unlock it.
- **Shop:** kaiju colour skins later.

## Build plan (FPS first)

1. **The engine + 4 kaiju:** Godzilly, King Konk, Mofra, Mecha-Godzilly.
   - Rigs: walk / fly / crawl, with attack and hit animations.
   - Systems: health and Power, tap-to-walk / tap-to-cast, three stages, damaging army, napalm planes, rival AI.
   - Front end: menu card, how-to cards, tutorial, music.
2. **The next 8:** Rodanny, Lobstirah, Angryrus, Grammera, Destroyah-yah, Biolettuce, Megalawn, Smogorah.
3. **The last 8, and the Megacity boss:** Spaceyzilla, Varoom, Gabbera, Kumbunga, Jirassic, Geezora, Battra-tat, and
   King Giggledorah as the boss.
4. **Polish:** skins, itch page.

## Open questions

- **Zombies:** do they replace the townsfolk in Kaiju Madness (it's Dead City), or mix in with them?
- **Losing:** does losing health end the round, or do you shrink a stage instead (and only lose at Hatchling)?
- **Rivals:** does KO'ing a rival unlock it, or do unlocks come from the shop with coins?
