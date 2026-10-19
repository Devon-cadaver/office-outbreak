# Kaiju Madness — design draft

Second game for Dead City, next to Tornado Alley. Giant monsters fight each other in the city while the army
shoots at them and the dead roam the streets. Built on the same engine: `city.js` towns, the chunked/frozen
rendering, the skin-shop coins, the how-to cards, tips and tutorial, and a layered music track like the storm one.

## Names (decision needed)

The reference sheet uses the real Toho / Legendary / Daiei names: Godzilla, King Kong, Mothra, Gamera and the others.
Those are trademarked and their looks are protected. A free game on itch.io using those names and look-alikes can
be taken down. **Recommendation:** original names, and designs that are clearly our own (low-poly, Dead City colours).
Each monster keeps the *kind* of creature and fighting style it was inspired by. The "Inspired by" column below is
for us only and never goes in the game or on the itch page.

## The roster (20)

Every kaiju has the same four buttons, so it's easy to learn, but each plays differently:

- **Move:** the drag stick, as in Tornado Alley.
- **ATTACK:** a fast close-range hit.
- **SPECIAL:** a signature move on a short cooldown.
- **RAGE:** an ultimate. The Rage bar fills by smashing buildings, eating zombies and landing hits.
- **Trait:** a passive.

Stats are Health / Speed / Power, each 1 to 5.

| # | Name (ours) | Inspired by | Type | H/S/P | Attack | Special | Rage | Trait |
|---|---|---|---|---|---|---|---|---|
| 1 | **TITANOX** | Godzilla | Atomic lizard | 5/2/4 | Claw + tail sweep | **Atomic Breath**: a long blue beam that sets the street on fire | **Nuclear Pulse**: a ring blast that flattens everything around him | Heals slowly when standing in water / by the power plant |
| 2 | **GORRAK** | King Kong | Giant ape | 4/4/4 | Two-fist pound | **Grab & Throw**: picks up a car, tank or chunk of building and hurls it | **Ground Slam**: leaps and lands, a shockwave stuns | Can climb tall towers and leap from them |
| 3 | **LUMORA** | Mothra | Giant moth | 2/4/2 | Wing slash | **Gale**: a wing gust that pushes enemies and debris away | **Healing Dust**: glowing scales heal her and poison the rival | Flies over buildings |
| 4 | **PYRAX** | Rodan | Fire pterosaur | 3/5/3 | Beak strike | **Sonic Dive**: swoops in a line, a shockwave rips the street up | **Firestorm**: circles and rains fire | Fastest flyer |
| 5 | **TRIGON** | King Ghidorah | Three-headed dragon | 5/2/5 | Triple bite | **Gravity Lightning**: three crackling beams | **Storm Lord**: lightning strikes all over the map | Boss-tier; each head can be "knocked out" |
| 6 | **MECH-REX** | Mechagodzilla | Robot dinosaur | 4/2/5 | Rocket punch | **Missile Barrage**: a volley that homes in | **Overcharge**: a chest laser plus a shield | Armour takes less damage from the army, never heals |
| 7 | **KRABBOS** | Ebirah | Giant lobster | 4/3/3 | Pincer snap | **Crusher Grab**: holds the rival and squeezes | **Tidal Jet**: a high-pressure water blast | Hard shell from the front |
| 8 | **SPINOX** | Anguirus | Spiked ankylosaur | 4/3/3 | Bite | **Spike Roll**: curls up and rolls through buildings | **Thorn Burst**: spikes shoot out all around | Spikes hurt anyone who hits him up close |
| 9 | **TORTANK** | Gamera | Flying turtle | 5/3/3 | Shell bash | **Jet Spin**: tucks in and flies spinning (also blocks) | **Plasma Fireballs**: three big fireballs | Hiding in the shell blocks most damage |
| 10 | **RAVAGER** | Destoroyah | Crimson demon | 4/3/5 | Horn slash | **Melt Beam**: corrodes armour | **Swarm**: splits into small crawlers for a few seconds | Flies |
| 11 | **VERDANTA** | Biollante | Plant monster | 5/1/4 | Vine whip (long reach) | **Acid Sap**: a spray that eats through things | **Root Down**: becomes an immobile turret and heals fast | Slowest; rooted to win long fights |
| 12 | **CRYZILLA** | SpaceGodzilla | Crystal titan | 4/2/4 | Crystal claw | **Crystal Spires**: plants towers that shoot | **Corona Beam**: a spiralling beam | Hovers; spires give him a shield |
| 13 | **DRILLHORN** | Megalon | Drill beetle | 3/4/4 | Drill arms | **Burrow**: dives underground and bursts out under the rival | **Napalm Rain** | Can't be hit while burrowed |
| 14 | **SLUDGOR** | Hedorah | Smog monster | 4/2/3 | Sludge slap | **Toxic Cloud**: poison fog that lingers | **Acid Flight**: turns into a saucer and rains acid | Damage over time; immune to fire |
| 15 | **GLIDON** | Varan | Sail lizard | 3/4/3 | Tail whip | **Glide**: a long gliding leap | **Sail Flash**: blinds and stuns everything nearby | Glides over gaps |
| 16 | **ZAPPA** | Gabara | Electric toad | 3/4/3 | Shock touch | **Hop Slam**: a big jump onto the rival | **Thunder Body**: an electric aura that zaps everything close | Shocks anyone who grabs him |
| 17 | **ARACHNOR** | Kumonga | Giant spider | 2/5/3 | Fang bite | **Web Shot**: roots the rival in place | **Nest**: webs a whole block, everything there is slowed | Climbs anything |
| 18 | **FRILLBACK** | Jirass | Frilled lizard | 3/4/3 | Bite | **Frill Flare**: a short stun | **Stampede**: a long charge | Quick dodge |
| 19 | **SQUIDRA** | Gezora | Giant squid | 3/3/3 | Tentacle lash | **Ink Cloud**: the rival loses track of him | **Deep Freeze**: an icy grab | Strong on the waterfront |
| 20 | **NYXMOTH** | Battra | Dark moth | 3/4/4 | Horn ram | **Prism Beams** from the eyes | **Dark Eclipse**: blacks out the sky and boosts all his attacks | Flies; Lumora's rival |

## How a fight works (proposal)

- **The match:** you pick a kaiju and fight one AI kaiju in a Dead City town, ISO camera like Tornado Alley. Two
  health bars at the top, and KO wins. Best of one at first; maybe best of three later.
- **The city is a weapon:** smash buildings to fill Rage, throw cars and chunks (Gorrak, Krabbos), knock the rival
  into towers to stagger them, use the power plant or the water station for a buff.
- **The army shoots both of you, and this time it hurts:** tanks and soldiers do real damage and their hits slow
  you for a moment. Jets show up as the fight goes on. Tanks are worth Rage when you stomp them.
- **The dead are in the streets:** zombie hordes roam the town, as in the old Dead City modes. Stomping or eating
  them gives health and Rage. Some kaiju turn them into a weapon (Sludgor's fog, Arachnor's webs).
- **Progress:** start with 4 kaiju. Beating a rival unlocks it, in a ladder of 20 fights ending with Trigon.
  Coins from fights go to the same skin shop (kaiju colour skins later).
- **Controls:** drag to move, three buttons bottom-right (ATTACK, SPECIAL, RAGE), and tap a target to face it.
  Built for phones in portrait.

## Build plan (phased, FPS first)

1. **The engine plus 4 kaiju:** Titanox, Gorrak, Lumora, Mech-Rex.
   - Kaiju rig: body parts with walk, attack, hit and KO animations; low-poly like the reference sheet.
   - Fight AI, health and Rage, hit effects, KO.
   - City destruction from the Tornado Alley code; army that damages and slows; zombie hordes.
   - Menu card, how-to cards, tutorial, music.
2. **The next 8:** Pyrax, Krabbos, Spinox, Tortank, Ravager, Verdanta, Drillhorn, Sludgor.
3. **The last 8 and the ladder:** Cryzilla, Glidon, Zappa, Arachnor, Frillback, Squidra, Nyxmoth, and Trigon as the
   final boss.
4. **Polish:** kaiju skins in the shop, best-of-three, a Rampage mode (no rival, just you against the army and the
   clock), itch page.

Each phase ships as its own version, tested at phone size with the same draw-call budget as Megacity.
