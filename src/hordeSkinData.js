// Horde skins: looks for the zombies in Zombie Air Raid (and the zombies Beam 'Em Up!'s graveyard raises and the
// Zombienado drops). This file is only the shop side: names, prices and words. The looks themselves are in
// hordeSkins.js. Like townsfolk outfits, you can wear several: each fills a quarter of the horde (skins.js townShare).
export const HORDE_IDS = ['bones', 'vamp', 'orc', 'mummy', 'gourd', 'wolf', 'frost', 'clown', 'gummy', 'bot', 'sea', 'haunt'];
export const HORDE_SKINS = {
  bones: { name: 'Rattlebones', kind: 'Skeletons', price: 0, free: true, giant: 'Bone Giant', clash: 'skeleton', desc: 'Skeletons: bone white, a big skull and cold blue eyes. Their gloopers burn green inside their ribs.' },
  vamp: { name: 'Night Biters', kind: 'Vampires', price: 2, giant: 'Night Giant', clash: 'vampire', desc: 'Vampires: chalk-white faces, red-lined capes with tall collars, red eyes. They crumble to ash.' },
  orc: { name: 'Tuskers', kind: 'Orcs', price: 2, giant: 'Tusk Chief', clash: null, desc: 'Orcs: broad and heavy, with tusks, a topknot and spiked iron shoulders. Their gloopers lob glowing grog.' },
  mummy: { name: 'Tomb Shufflers', kind: 'Mummies', price: 2, giant: 'Tomb Giant', clash: 'mummy', desc: 'Mummies: wrapped head to foot, gold eyes in a dark slit. Their gloopers lob cursed sand.' },
  gourd: { name: 'Gourdheads', kind: 'Pumpkin heads', price: 2, giant: 'Gourd Giant', clash: 'pumpkin', desc: 'Pumpkin heads with carved faces lit from inside, in patched scarecrow clothes.' },
  wolf: { name: 'Howlers', kind: 'Werewolves', price: 2, giant: 'Moon Brute', clash: 'werewolf', desc: 'Werewolves: fur, pointed ears, a snout and a tail, and yellow eyes.' },
  frost: { name: 'Frostbitten', kind: 'Frozen dead', price: 2, giant: 'Frost Giant', clash: null, desc: 'Icy blue, with ice on their shoulders and red scarves. They shatter into chips of ice.' },
  clown: { name: 'Honkers', kind: 'Clowns', price: 2, giant: 'Jumbo Clown', clash: 'clown', desc: 'Clowns: wig puffs, red noses, loud suits and long red shoes. Their gloopers lob cream pies.' },
  gummy: { name: 'Gummy Ghouls', kind: 'Sweets', price: 2, giant: 'Gummy Giant', clash: null, desc: 'Each one a single sweet colour from head to toe. They burst into sprinkles.' },
  bot: { name: 'Scrapbots', kind: 'Robots', price: 2, giant: 'Scrap Giant', clash: 'robot', desc: 'Robots: boxy steel, an aerial with a red light and a red glowing visor.' },
  sea: { name: 'Soggy Crew', kind: 'Drowned sailors', price: 2, giant: 'Sea Giant', clash: 'pirate', desc: 'Drowned sailors: blue-grey skin, striped shirts and seaweed down their backs.' },
  haunt: { name: 'Haunts', kind: 'Ghosts', price: 2, giant: 'Great Haunt', clash: 'ghost', desc: 'Ghosts: pale sheets with no legs, floating, with violet eyes. They fade away with a wisp.' },
};
