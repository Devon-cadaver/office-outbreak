// Skins for the bonus games' three craft: Zombie Air Raid's NAPALM BOMBER and ROCKET HELI, and Beam 'Em Up!'s saucer.
// One per storm skin for each craft, taking that storm's colours, things and quirk, at the storm's own price (the
// Poonado set is free, the Acid set is won by beating The Sprawl, the last town, in that craft's game). Their looks are in craftSkins.js;
// this file is only names and prices, so the shop list can load it without any 3D code. Shop ids: craft:<craft>:<storm>.
// Quirk skins change play a little (each game handles its own quirks); every other skin is looks only.
export const CRAFT_KINDS = { bomber: 'Napalm Bomber', heli: 'Rocket Heli', ufo: 'Saucer' };
const AIR = 'Beat The Sprawl in Zombie Air Raid', UFO = "Beat The Sprawl in Beam 'Em Up!";
export const CRAFT_SKINS = {
  bomber: {
    poo: { name: 'Stink Bomber', price: 0, free: true, desc: 'Sewage-barrel napalm with bubbling green flames, and a toilet-paper trail.' },
    halloween: { name: 'Hallowbomber', price: 2, desc: "Black and orange, with bats behind it and jack-o'-lantern bombs." },
    christmas: { name: 'Frostbomber', price: 2, desc: 'Snow-white and trailing snow. Its presents burst into frost fire.' },
    fire: { name: 'Blaze Bomber', price: 2, desc: 'Hot-rod flames, a trail of embers, and fuel cans that burn tall.' },
    shark: { name: 'Chomp Bomber', price: 2, desc: 'A shark mouth on the nose, sea spray behind, and little sharks for bombs.' },
    easter: { name: 'Bunny Bomber', price: 2, desc: 'Pastel pink, spilling jelly beans and dropping Easter eggs.' },
    acid: { name: 'Acid Bomber', price: 0, bonus: AIR, quirk: true, desc: 'QUIRK: every 4th drum throws off a baby twister that flings zombies (only zombies).' },
    july4: { name: 'Liberty Bomber', price: 2, desc: 'Stars, stripes and sparklers, with firework cakes for napalm.' },
    clown: { name: 'Pie Bomber', price: 3, quirk: true, desc: 'QUIRK: its pies blind zombies at the edge of the fire, and they stumble about.' },
    zombie: { name: 'Grave Bomber', price: 3, quirk: true, desc: 'QUIRK: each coffin lands as a groaning decoy that pulls zombies into the fire.' },
    ghost: { name: 'Spook Bomber', price: 3, quirk: true, desc: 'QUIRK: every 3rd jar possesses the zombies round it, and they walk into the fire.' },
    mallow: { name: "S'more Bomber", price: 3, quirk: true, desc: 'QUIRK: its goo sticks zombies to the spot for 3 seconds. People too.' },
    planet: { name: 'Comet Bomber', price: 3, quirk: true, desc: 'QUIRK: now and then a small meteor falls on the biggest horde.' },
    wormhole: { name: 'Warp Bomber', price: 3, desc: 'Blue with an orange drill spiral. Its fire swirls like a whirlpool.' },
    grid: { name: 'Grid Bomber', price: 3, desc: 'Black with glowing cyan edges, leaving a dotted trail of data cubes.' },
    void: { name: 'Void Bomber', price: 3, quirk: true, desc: 'QUIRK: gloopers have to be a little closer to spot you. Almost nothing to see.' },
    glitch: { name: 'Bug Bomber', price: 3, desc: 'Splits into red, green and blue, and drops error windows.' },
  },
  heli: {
    poo: { name: 'Flushcopter', price: 0, free: true, desc: 'Sewer green with bathroom tiles, firing toilet-roll rockets.' },
    halloween: { name: "Jack-o'-Copter", price: 2, desc: "Black and orange, firing jack-o'-lantern rockets, with bats behind it." },
    christmas: { name: 'Flurrycopter', price: 2, desc: 'Red with white fur and gold runners, icicle rockets and two reindeer.' },
    fire: { name: 'Scorcher', price: 2, desc: 'A rotor like a ring of fire, and fireball rockets.' },
    shark: { name: 'Chompcopter', price: 2, desc: 'A shark head and tail, firing torpedoes.' },
    easter: { name: 'Hopcopter', price: 2, desc: 'Mint and pink with bunny ears, firing carrots.' },
    acid: { name: 'Toxicopter', price: 0, bonus: AIR, quirk: true, desc: 'QUIRK: every 6th rocket spins off a baby twister. Glowing vials for rockets.' },
    july4: { name: 'Firecracker', price: 2, desc: 'A lit fuse at the tail and whistling bottle rockets.' },
    clown: { name: 'Honkcopter', price: 3, quirk: true, desc: 'QUIRK: zombies pied by a blast stop chasing people for 3 seconds.' },
    zombie: { name: 'Gravecopter', price: 3, quirk: true, desc: 'QUIRK: each blast leaves a groaning decoy that pulls zombies in for the next rocket.' },
    ghost: { name: 'Spookcopter', price: 3, quirk: true, desc: 'QUIRK: zombies near a blast are lured to the spot for 3 seconds.' },
    mallow: { name: 'Mallowcopter', price: 3, quirk: true, desc: 'QUIRK: zombies round a blast are glued for 4 seconds.' },
    planet: { name: 'Orbitcopter', price: 3, quirk: true, desc: 'QUIRK: every 30 seconds a meteor follows a rocket down, for a much bigger blast.' },
    wormhole: { name: 'Vortex Copter', price: 3, desc: 'A blue and orange spiral rotor, and drill rockets.' },
    grid: { name: 'Gridcopter', price: 3, desc: 'Glowing cyan edges and data-bolt rockets.' },
    void: { name: 'Blackout Copter', price: 3, quirk: true, desc: 'QUIRK: gloopers have to be a little closer to spot you.' },
    glitch: { name: 'Glitchcopter', price: 3, desc: 'Stutters, splits into colours and fires mouse pointers.' },
  },
  ufo: {
    poo: { name: 'Sewer Saucer', price: 0, free: true, desc: 'A manhole cover with flies round it and a sludge ray. A sewer rat flies it.' },
    halloween: { name: 'Hallowsaucer', price: 2, desc: 'Black, with bats round it, a pumpkin-headed pilot and an orange beam.' },
    christmas: { name: 'Snow Globe', price: 2, desc: 'Snow swirls round a snowman in the dome. Candy-cane death ray.' },
    fire: { name: 'Ember Saucer', price: 2, desc: 'Glowing lava rock with a red heat beam.' },
    shark: { name: 'Fishbowl', price: 2, desc: 'A shark swims in the dome, and the beam is a waterspout.' },
    easter: { name: 'Eggship', price: 2, desc: 'A painted egg with a bunny pilot and chicks behind it.' },
    acid: { name: 'Acid Saucer', price: 0, bonus: UFO, quirk: true, desc: 'QUIRK: now and then a baby twister drops out of the beam. It knocks people flat and hits the army.' },
    july4: { name: 'Liberty Saucer', price: 2, desc: 'Spinning neon rings, a flag and fireworks.' },
    clown: { name: 'Big Top', price: 3, quirk: true, desc: 'QUIRK: it lobs pies at the crowd by the beam, and pied people stand still.' },
    zombie: { name: 'Grave Saucer', price: 3, quirk: true, desc: 'QUIRK: now and then it drops a zombie to beam up.' },
    ghost: { name: 'Spook Saucer', price: 3, quirk: true, desc: 'QUIRK: now and then people in its glow walk into the beam.' },
    mallow: { name: "S'more Saucer", price: 3, quirk: true, desc: "QUIRK: the death ray's splash glues people to the spot for 7 seconds." },
    planet: { name: 'Little Planet', price: 3, quirk: true, desc: 'QUIRK: every 20 seconds it throws a moon at the nearest tank, truck or soldier.' },
    wormhole: { name: 'Warp Ring', price: 3, desc: 'Blue and orange, with a blue and orange beam and racing lights.' },
    grid: { name: 'Wireframe', price: 3, desc: 'Black, covered in a glowing green grid.' },
    void: { name: 'Eclipse', price: 3, quirk: true, desc: 'QUIRK: people let it get a little closer before they run.' },
    glitch: { name: 'Saucer Not Found', price: 3, desc: 'Flickers and jumps like a broken screen.' },
  },
};
// the storm each set matches, in shop order
export const CRAFT_STORMS = ['poo', 'halloween', 'christmas', 'fire', 'shark', 'easter', 'acid', 'july4', 'clown', 'zombie', 'ghost', 'mallow', 'planet', 'wormhole', 'grid', 'void', 'glitch'];
