// Static game data: classes, skills, monsters, pets, mounts, sprites, NPCs, quests, items.
import {
  NEW_ZONES, NEW_MONSTERS, DUNGEON_MONSTERS, NEW_SPAWNS, NEW_DUNGEONS, NEW_ITEMS, NEW_PETS, NEW_MOUNTS, NEW_NPCS, NEW_TELEPORTS, NEW_TITLES, NEW_DROPS,
} from './data-world.js';
import { TOOL_ITEMS } from './data-crafting.js';
import { DZ_MONSTERS, DZ_SPAWNS } from './data-dz.js';
import { STORY_QUESTS, STORY_ITEMS, STORY_TITLES } from './data-story.js';
import { TRIALS, SIGIL_ITEMS, FOOD_ITEMS, TRIAL_MONSTER_DEFS } from './data-trials.js';
import { zoneKey } from './data-nav.js';

export { CLASSES, CLASS_ORDER, RACES } from './data-classes.js';

export const MONSTERS = {
  jelly: { name: 'Jellopop', lvl: [1, 3], hp: 70, atk: 9, def: 2, exp: 20, gold: [3, 9], model: 'jelly', aggressive: false, speed: 3.2, range: 1.8, height: 1.4, drops: [{ id: 'pet_jelly', chance: 0.03 }] },
  bunny: { name: 'Fluffbun', lvl: [3, 5], hp: 130, atk: 15, def: 4, exp: 36, gold: [6, 14], model: 'bunny', aggressive: false, speed: 4, range: 1.8, height: 1.6, drops: [{ id: 'pet_bunny', chance: 0.03 }] },
  shroom: { name: 'Shroomling', lvl: [5, 7], hp: 220, atk: 23, def: 7, exp: 58, gold: [10, 20], model: 'shroom', aggressive: false, speed: 3.4, range: 1.9, height: 1.8, drops: [{ id: 'pet_shroom', chance: 0.03 }] },
  wolf: { name: 'Thornwolf', lvl: [7, 9], hp: 330, atk: 33, def: 10, exp: 90, gold: [14, 28], model: 'wolf', aggressive: true, speed: 5.5, range: 2.2, height: 1.7, drops: [{ id: 'pet_owl', chance: 0.02 }] },
  golem: { name: 'Ruin Golem', lvl: [11, 13], hp: 900, atk: 58, def: 24, exp: 220, gold: [30, 55], model: 'golem', aggressive: false, speed: 3.2, range: 2.8, height: 3.3, drops: [{ id: 'pet_ghost', chance: 0.03 }] },
  treant: { name: 'Bramble Treant', lvl: [10, 12], hp: 1150, atk: 52, def: 18, exp: 280, gold: [30, 60], model: 'treant', aggressive: true, elite: true, speed: 3.6, range: 3, height: 3.8, drops: [{ id: 'pet_egg', chance: 0.15 }] },
  boss: { name: 'Treant King Yggr', lvl: [15, 15], hp: 9500, atk: 80, def: 26, exp: 2600, gold: [400, 600], model: 'boss', aggressive: true, boss: true, speed: 3.4, range: 4.5, height: 8, drops: [{ id: 'pet_dragon', chance: 0.25 }, { id: 'mount_unicorn', chance: 0.15 }] },
  // ---- dungeon monsters (never in overworld SPAWNS) ----
  cavejelly: { name: 'Cave Jelly', lvl: [6, 7], hp: 260, atk: 26, def: 8, exp: 70, gold: [12, 22], model: 'cavejelly', aggressive: true, speed: 3.4, range: 1.9, height: 1.5, dungeon: true },
  sporeling: { name: 'Sporeling', lvl: [7, 8], hp: 300, atk: 30, def: 9, exp: 80, gold: [12, 24], model: 'sporeling', aggressive: true, speed: 3.6, range: 2, height: 1.9, dungeon: true },
  mossbeast: { name: 'Mossback Brute', lvl: [8, 8], hp: 1300, atk: 42, def: 14, exp: 300, gold: [40, 70], model: 'mossbeast', aggressive: true, elite: true, speed: 4.2, range: 2.6, height: 2.4, dungeon: true },
  queenjelly: { name: 'Queen Jellissa', lvl: [9, 9], hp: 5200, atk: 52, def: 16, exp: 1800, gold: [300, 420], model: 'queenjelly', aggressive: true, boss: true, speed: 3, range: 4.2, height: 5.5, dungeon: true, skills: ['slam', 'summon', 'nova'], summon: 'cavejelly' },
  boneknight: { name: 'Restless Knight', lvl: [11, 12], hp: 700, atk: 52, def: 20, exp: 180, gold: [20, 36], model: 'boneknight', aggressive: true, speed: 4, range: 2.4, height: 2.3, dungeon: true },
  wisp: { name: 'Wailing Wisp', lvl: [11, 12], hp: 480, atk: 60, def: 12, exp: 160, gold: [18, 34], model: 'wisp', aggressive: true, ranged: true, speed: 3.8, range: 9, height: 2.2, dungeon: true },
  cryptgolem: { name: 'Crypt Guardian', lvl: [13, 13], hp: 2600, atk: 70, def: 30, exp: 600, gold: [70, 110], model: 'cryptgolem', aggressive: true, elite: true, speed: 3.2, range: 3, height: 3.6, dungeon: true },
  gravelord: { name: 'Gravelord Colossus', lvl: [14, 14], hp: 12000, atk: 88, def: 32, exp: 4200, gold: [600, 800], model: 'gravelord', aggressive: true, boss: true, speed: 3, range: 5, height: 8, dungeon: true, skills: ['slam', 'roots', 'summon'], summon: 'boneknight' },
  rootwolf: { name: 'Blightfang', lvl: [16, 17], hp: 1100, atk: 78, def: 26, exp: 300, gold: [30, 50], model: 'rootwolf', aggressive: true, speed: 6, range: 2.3, height: 1.8, dungeon: true },
  blightspore: { name: 'Blightspore', lvl: [16, 17], hp: 1000, atk: 82, def: 24, exp: 290, gold: [30, 50], model: 'sporeling', variant: 2, aggressive: true, speed: 3.6, range: 2, height: 1.9, dungeon: true },
  rottreant: { name: 'Rotwood Treant', lvl: [17, 18], hp: 3200, atk: 92, def: 32, exp: 800, gold: [80, 130], model: 'rottreant', aggressive: true, elite: true, speed: 3.6, range: 3, height: 4, dungeon: true },
  nidhogg: { name: 'Nidhogg Hatchling', lvl: [20, 20], hp: 26000, atk: 120, def: 40, exp: 9000, gold: [1200, 1600], model: 'nidhogg', aggressive: true, boss: true, speed: 3.4, range: 5.5, height: 7, dungeon: true, skills: ['breath', 'slam', 'nova', 'summon'], summon: 'rootwolf' },
  // ---- world bosses (Storm Altar, every 15 minutes). Stats scale with the hero's level at spawn time.
  behemoth: { name: 'Thunderhoof Behemoth', lvl: [12, 12], hp: 1, atk: 1, def: 1, exp: 6000, gold: [800, 1200], model: 'behemoth', variant: 0, event: true, aggressive: true, boss: true, worldBoss: true, curve: { hp: 90, atk: 2.2, def: 1.2, exp: 60, gold: 30 }, speed: 3.4, range: 5.5, height: 7, skills: ['slam', 'storm', 'nova', 'breath'] },
  frostbehemoth: { name: 'Frost Behemoth', lvl: [12, 12], hp: 1, atk: 1, def: 1, exp: 6000, gold: [800, 1200], model: 'behemoth', variant: 1, event: true, aggressive: true, boss: true, worldBoss: true, curve: { hp: 90, atk: 2.2, def: 1.2, exp: 60, gold: 30 }, speed: 3.4, range: 5.5, height: 7, skills: ['slam', 'storm', 'nova', 'breath'] },
  pumpkinking: { name: 'Pumpkin King', lvl: [12, 12], hp: 1, atk: 1, def: 1, exp: 6000, gold: [800, 1200], model: 'pumpkinking', variant: 0, event: true, aggressive: true, boss: true, worldBoss: true, curve: { hp: 90, atk: 2.2, def: 1.2, exp: 60, gold: 30 }, speed: 3.2, range: 5, height: 7, skills: ['slam', 'roots', 'nova', 'summon', 'storm'], summon: 'jackpuff' },
  // ---- festival monsters (levels follow the spawn area)
  jackpuff: { name: 'Jackpuff', lvl: [1, 1], hp: 70, atk: 9, def: 2, exp: 20, gold: [3, 9], model: 'jackpuff', variant: 0, event: true, festival: true, aggressive: false, speed: 3.6, range: 1.8, height: 1.5 },
  snowpuff: { name: 'Snowpuff', lvl: [1, 1], hp: 70, atk: 9, def: 2, exp: 20, gold: [3, 9], model: 'jackpuff', variant: 1, event: true, festival: true, aggressive: false, speed: 3.6, range: 1.8, height: 1.5 },
  blossompuff: { name: 'Blossom Puff', lvl: [1, 1], hp: 70, atk: 9, def: 2, exp: 20, gold: [3, 9], model: 'jackpuff', variant: 2, event: true, festival: true, aggressive: false, speed: 3.6, range: 1.8, height: 1.5 },
  // ---- guild war units (stats set from the hero's level when the battle starts)
  rival: { name: 'Rival', lvl: [10, 10], hp: 1, atk: 1, def: 1, exp: 120, gold: [20, 40], model: 'rival', aggressive: true, speed: 6.4, range: 2.6, height: 2.1, war: true },
  warcrystal: { name: 'Enemy Spirit Crystal', lvl: [10, 10], hp: 1, atk: 0, def: 1, exp: 800, gold: [200, 300], model: 'warcrystal', variant: 1, event: true, aggressive: false, elite: true, structure: true, speed: 0, range: 0, height: 5.5, war: true },
};


export const SPAWNS = [
  { type: 'jelly', x: 108, z: -12, r: 24, count: 10 },
  { type: 'bunny', x: 132, z: 52, r: 24, count: 9 },
  { type: 'shroom', x: -18, z: 112, r: 24, count: 9 },
  { type: 'wolf', x: 42, z: 140, r: 20, count: 8 },
  { type: 'treant', x: -86, z: -58, r: 20, count: 5 },
  { type: 'golem', x: -122, z: 52, r: 20, count: 6 },
  { type: 'boss', x: -150, z: -112, r: 4, count: 1 },
];


// Instanced dungeons. Room coordinates are local to `origin` (+z is south; rooms run north toward the boss).
export const DUNGEONS = [
  {
    id: 'd1', name: 'Mossy Hollow', theme: 'grotto', lv: 6, recBR: 1400, entries: 3, par: 240, relicName: 'Hollow', origin: { x: 3000, z: 0 },
    portal: { x: -48, z: 146 }, zone: 'Mossveil Forest',
    desc: 'A glowing cave beneath Mossveil where cave jellies swarm around their queen.',
    rooms: [
      { x: 0, z: 0, w: 26, d: 24, spawns: [['cavejelly', 3]] },
      { x: -14, z: -44, w: 32, d: 28, spawns: [['cavejelly', 3], ['sporeling', 2]] },
      { x: 12, z: -90, w: 34, d: 30, spawns: [['sporeling', 3], ['mossbeast', 1]] },
      { x: 0, z: -142, w: 44, d: 40, boss: 'queenjelly' },
    ],
  },
  {
    id: 'd2', name: 'Elder Catacombs', theme: 'crypt', lv: 11, recBR: 2600, entries: 3, par: 300, relicName: 'Catacomb', origin: { x: 3000, z: 700 },
    portal: { x: -142, z: 14 }, zone: 'Elder Ruins',
    desc: 'Sealed tombs under the Elder Ruins, guarded by restless knights and a colossus of bone and stone.',
    rooms: [
      { x: 0, z: 0, w: 24, d: 24, spawns: [['boneknight', 3]] },
      { x: 16, z: -42, w: 30, d: 30, spawns: [['boneknight', 2], ['wisp', 3]] },
      { x: -12, z: -88, w: 34, d: 30, spawns: [['wisp', 2], ['boneknight', 2], ['cryptgolem', 1]] },
      { x: 0, z: -140, w: 46, d: 42, boss: 'gravelord' },
    ],
  },
  {
    id: 'd3', name: 'Yggdrasil Roots', theme: 'roots', lv: 16, recBR: 4200, entries: 3, par: 360, relicName: 'Rootbound', origin: { x: 3000, z: 1400 },
    portal: { x: 34, z: -146 }, zone: 'World Tree Overlook',
    desc: 'The blighted roots of the World Tree, where a hatchling of Nidhogg gnaws at the realm itself.',
    rooms: [
      { x: 0, z: 0, w: 26, d: 24, spawns: [['rootwolf', 3]] },
      { x: -16, z: -44, w: 32, d: 30, spawns: [['rootwolf', 2], ['blightspore', 3]] },
      { x: 14, z: -92, w: 36, d: 32, spawns: [['blightspore', 2], ['rootwolf', 2], ['rottreant', 1]] },
      { x: 0, z: -146, w: 50, d: 44, boss: 'nidhogg' },
    ],
  },
];

export const ZONES = [
  { name: 'Sylvan Haven', x: 0, z: 0, r: 52, safe: true, lv: 'Town' },
  { name: 'Breezy Meadow', x: 120, z: 20, r: 70, lv: 'Lv 1-5' },
  { name: 'Mossveil Forest', x: 12, z: 122, r: 70, lv: 'Lv 5-9' },
  { name: 'Elder Ruins', x: -120, z: -20, r: 95, lv: 'Lv 10-15' },
  { name: 'World Tree Overlook', x: 0, z: -130, r: 70, lv: 'Scenic' },
  { name: 'Storm Altar', x: 128, z: -86, r: 30, lv: 'World Boss' },
];

export const PETS = [
  { id: 'pet_icecream', name: 'Scoopy', species: 'Ice Cream', rarity: 0, atk: 6, hp: 40, model: 'icecream', src: 'Quest: A Loyal Friend' },
  { id: 'pet_cat', name: 'Mochi', species: 'Cat', rarity: 0, atk: 7, hp: 35, model: 'cat', src: 'Daily Sign-In, Day 3' },
  { id: 'pet_jelly', name: 'Wobbles', species: 'Jelly', rarity: 0, atk: 6, hp: 50, model: 'minijelly', src: 'Drop: Jellopop' },
  { id: 'pet_bunny', name: 'Fluffkin', species: 'Bunny', rarity: 0, atk: 8, hp: 30, model: 'minibunny', src: 'Drop: Fluffbun' },
  { id: 'pet_shroom', name: 'Mushy', species: 'Mushroom', rarity: 1, atk: 10, hp: 60, model: 'minishroom', src: 'Drop: Shroomling' },
  { id: 'pet_cupcake', name: 'Cupcake Puff', species: 'Cupcake', rarity: 1, atk: 11, hp: 70, model: 'cupcake', src: 'Mall: 1,800 Gold' },
  { id: 'pet_penguin', name: 'Pengu', species: 'Penguin', rarity: 1, atk: 12, hp: 60, model: 'penguin', src: 'Online Gift' },
  { id: 'pet_owl', name: 'Hootie', species: 'Owl', rarity: 1, atk: 13, hp: 55, model: 'owl', src: 'Drop: Thornwolf' },
  { id: 'pet_puppet', name: 'Pip', species: 'Puppet', rarity: 2, atk: 16, hp: 80, model: 'puppet', src: 'Mall: 4,500 Gold' },
  { id: 'pet_ghost', name: 'Boo', species: 'Ghost', rarity: 2, atk: 18, hp: 70, model: 'ghost', src: 'Drop: Ruin Golem' },
  { id: 'pet_star', name: 'Twinkle', species: 'Star', rarity: 3, atk: 24, hp: 110, model: 'star', src: 'Mall: 300 Diamonds' },
  { id: 'pet_dragon', name: 'Sparky', species: 'Baby Dragon', rarity: 3, atk: 28, hp: 120, model: 'dragon', src: 'Drop: Treant King Yggr' },
  { id: 'pet_pumpkin', name: 'Pumpkin Pip', species: 'Pumpkin', rarity: 2, atk: 19, hp: 90, model: 'pumpkin', src: 'Harvest Moon Festival shop', event: 'harvest' },
  { id: 'pet_snowpuff', name: 'Flurry', species: 'Snowpuff', rarity: 2, atk: 19, hp: 90, model: 'snowpuff', src: 'Winter Starlight Festival shop', event: 'winter' },
  { id: 'pet_blossom', name: 'Petalle', species: 'Blossom Spirit', rarity: 2, atk: 19, hp: 90, model: 'blossom', src: 'Sakura Bloom Festival shop', event: 'sakura' },
];

export const SPRITES = [
  { id: 'sp_fire', name: 'Ember', element: 'Fire', color: 0xff6a2a, desc: '+8% Attack', mods: { atk: 1.08 } },
  { id: 'sp_water', name: 'Aqua', element: 'Water', color: 0x3fb4ff, desc: 'Restores 2% HP every 4s', regen: 0.02 },
  { id: 'sp_wind', name: 'Zephyr', element: 'Wind', color: 0x5cf0a6, desc: '+10% Move Speed, +3% Critical', mods: { speed: 1.1, crit: 3 } },
  { id: 'sp_earth', name: 'Terra', element: 'Earth', color: 0xe0b040, desc: '+12% Defense', mods: { def: 1.12 } },
];
export const CLASS_SPRITE = { knight: 'sp_earth', assassin: 'sp_wind', mage: 'sp_fire', priest: 'sp_water', berserker: 'sp_fire', ranger: 'sp_wind', summoner: 'sp_water', spellblade: 'sp_earth' };

export const MOUNTS = [
  { id: 'mount_chick', name: 'Fluffy Chick', speed: 1.45, br: 120, model: 'chick', src: 'Quest: Swift as the Wind' },
  { id: 'mount_panda', name: 'Bamboo Panda', speed: 1.5, br: 180, model: 'panda', src: 'Daily Sign-In, Day 7' },
  { id: 'mount_wolf', name: 'Frost Wolf', speed: 1.6, br: 260, model: 'frostwolf', src: 'Mall: 6,000 Gold' },
  { id: 'mount_pegasus', name: 'Pegasus', speed: 1.75, br: 420, model: 'pegasus', src: 'Mall: 500 Diamonds' },
  { id: 'mount_unicorn', name: 'Starlight Unicorn', speed: 1.75, br: 480, model: 'unicorn', src: 'Drop: Treant King Yggr' },
];

export const ITEMS = {
  hp_potion: { name: 'Healing Draught', icon: 'hp_potion', type: 'consumable', quality: 0, stack: 99, price: 40, desc: 'Restores 35% Max HP.', tint: '#ff5a6a' },
  mp_potion: { name: 'Mana Draught', icon: 'mp_potion', type: 'consumable', quality: 0, stack: 99, price: 40, desc: 'Restores 35% Max MP.', tint: '#4aa8ff' },
  pet_egg: { name: 'Mystery Pet Egg', icon: 'pet_egg', type: 'egg', quality: 2, stack: 99, price: 900, desc: 'Hatch to receive a random pet you do not own yet.' },
  glowcap: { name: 'Glowcap', icon: 'glowcap', type: 'quest', quality: 1, stack: 99, desc: 'A luminous mushroom from Mossveil Forest.' },
  dungeon_ticket: { name: 'Dungeon Ticket', icon: 'dungeon_ticket', type: 'ticket', quality: 3, stack: 99, price: 0, desc: 'Grants one extra dungeon run after your free daily entries are used up.' },
  exp_scroll: { name: 'Scroll of Wisdom', icon: 'exp_scroll', type: 'consumable', quality: 2, stack: 99, price: 600, desc: 'Grants experience equal to 5% of your current level.' },
  gem_pouch: { name: 'Gem Pouch', icon: 'gem_pouch', type: 'consumable', quality: 2, stack: 99, price: 300, desc: 'Open to receive a random Chipped gem (small chance of a Polished one).' },
  unique_cache: { name: 'Unique Cache', icon: 'unique_cache', type: 'consumable', quality: 4, stack: 99, price: 3000, desc: 'Open to receive a random Unique item for your class at your level.' },
  legend_cache: { name: 'Legendary Cache', icon: 'legend_cache', type: 'consumable', quality: 5, stack: 99, price: 9000, desc: 'Open to receive a random Legendary item for your class at your level.' },
};

export const SLOTS = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'necklace', 'ring'];
export const SLOT_INFO = {
  weapon: { label: 'Weapon', icon: 'w_sword' },
  helm: { label: 'Helm', icon: 'helm' },
  armor: { label: 'Armor', icon: 'armor' },
  gloves: { label: 'Gloves', icon: 'gloves' },
  boots: { label: 'Boots', icon: 'boots' },
  necklace: { label: 'Necklace', icon: 'necklace' },
  ring: { label: 'Ring', icon: 'ring' },
};
export const WEAPON_NAMES = { knight: 'Longsword', assassin: 'Twin Daggers', mage: 'Ember Staff', priest: 'Tidal Scepter', berserker: 'Greataxe', ranger: 'Longbow', summoner: 'Spirit Tome', spellblade: 'Runesword' };
export const WEAPON_ICONS = { knight: 'w_sword', assassin: 'w_daggers', mage: 'w_staff', priest: 'w_scepter', berserker: 'w_greataxe', ranger: 'w_bow', summoner: 'w_tome', spellblade: 'w_runesword' };
export const SLOT_BASE = { helm: 'Helm', armor: 'Tunic', gloves: 'Gloves', boots: 'Boots', necklace: 'Amulet', ring: 'Ring' };

export const NPCS = [
  { id: 'elder', icon: 'quests', name: 'Elder Rowan', title: 'Village Elder', x: -6, z: -16, look: 'elder', face: 0.5,
    greet: 'The Spirits have been restless, traveler. Carlyle needs heroes now more than ever.' },
  { id: 'mimi', icon: 'pets', name: 'Mimi', title: 'Pet Keeper', x: 18, z: -10, look: 'mimi', face: -1.2, service: 'pets',
    greet: 'Nyaa~! Every adventurer needs a fluffy friend. Have you met all my little ones?' },
  { id: 'brom', icon: 'mounts', name: 'Brom', title: 'Stablemaster', x: 24, z: 16, look: 'brom', face: -2.2, service: 'mounts',
    greet: 'Long roads ahead, friend. Best not walk them on foot!' },
  { id: 'lyla', icon: 'shop', name: 'Lyla', title: 'Merchant', x: -20, z: 10, look: 'lyla', face: 1.9, service: 'shop',
    greet: 'Potions, eggs, scrolls! Fresh stock every dawn. Take a look~' },
  { id: 'gorm', icon: 'forge', name: 'Gorm', title: 'Blacksmith', x: -26, z: -8, look: 'gorm', face: 1.4, service: 'enhance',
    greet: 'Bring me your gear and gold. I will make it sing!' },
  { id: 'elena', icon: 'bounty', name: 'Captain Elena', title: 'Guard Captain', x: 34, z: 2, look: 'elena', face: -1.6, service: 'bounty',
    greet: 'The roads are dangerous. I always have bounties for capable hands.' },
  { id: 'sylphie', icon: 'sprite', name: 'Sylphie', title: 'Spirit Guide', x: 6, z: 18, look: 'sylphie', face: 3.0,
    greet: 'The four Spirits watch over Carlyle. Listen closely and they will guide you.' },
  { id: 'nix', icon: 'teleport', name: 'Nix', title: 'Teleporter', x: 0, z: -40, look: 'nix', face: 0, service: 'teleport',
    greet: 'Where shall the winds carry you today?' },
  { id: 'mira', icon: 'market', name: 'Mira', title: 'Market Merchant', x: -30, z: 14, look: 'mira', face: 2.1, service: 'market',
    greet: 'Buying? Selling? Every adventurer in Carlyle trades through my ledger. Prices change by the hour, so look sharp~' },
  { id: 'aldric', icon: 'guild', name: 'Aldric', title: 'Guild Master', x: 30, z: -16, look: 'aldric', face: -0.9, service: 'guild',
    greet: 'A hero alone is strong; a guild is unstoppable. Join one, or found your own banner!' },
  { id: 'host', icon: 'event', name: 'Pumpkin Pam', title: 'Festival Host', x: -16, z: 22, look: 'host', face: 2.4, service: 'event', event: true,
    greet: 'Happy festival! Bring me your festival tokens and I will trade you something wonderful!' },
];

export const TELEPORTS = [
  { name: 'Sylvan Haven', x: 0, z: -34, lv: 'Town' },
  { name: 'Breezy Meadow', x: 92, z: 2, lv: 'Lv 1-5' },
  { name: 'Mossveil Forest', x: 6, z: 92, lv: 'Lv 5-9' },
  { name: 'Elder Ruins', x: -86, z: -6, lv: 'Lv 10-15' },
  { name: 'World Tree Overlook', x: 0, z: -150, lv: 'Scenic' },
];

// Main story chain. type: talk | kill | collect | end
export const QUESTS = [
  { id: 'q1', name: 'Welcome to Carlyle', giver: 'elder', turnin: 'elder', type: 'talk',
    text: 'Ah, a new face! Welcome to Sylvan Haven, heart of Carlyle. The Four Spirits — Fire, Water, Wind and Earth — have kept our world in balance for ages. But lately the forest grows wild and the creatures restless. You arrived just in time.',
    done: 'Rest a moment, then let us see what you can do.', rewards: { exp: 60, gold: 120, items: [['hp_potion', 10], ['mp_potion', 5]] }, next: 'q2' },
  { id: 'q2', name: 'Jelly Trouble', giver: 'elder', turnin: 'elder', type: 'kill', target: 'jelly', count: 6,
    text: 'Jellopops from Breezy Meadow keep oozing into the crop fields east of the river. Cross the bridge and defeat 6 of them. Do not let their cute faces fool you!',
    done: 'Splendid work! Take this weapon — it suits you far better than that stick.', rewards: { exp: 260, gold: 200, equip: 'weapon' }, next: 'q3' },
  { id: 'q3', name: 'A Loyal Friend', giver: 'elder', turnin: 'mimi', type: 'talk',
    text: 'No adventurer should travel alone. Mimi, our Pet Keeper, has been raising a little companion just for you. Go see her by the eastern houses.',
    done: 'Nyaa~! This is Scoopy! Scoopy will follow you everywhere and fight by your side. Be gentle, Scoopy melts when nervous!', rewards: { exp: 160, gold: 100, pet: 'pet_icecream' }, next: 'q4' },
  { id: 'q4', name: 'Fluffy Menace', giver: 'mimi', turnin: 'mimi', type: 'kill', target: 'bunny', count: 8,
    text: 'The Fluffbuns in the southern meadow have been stealing my pet treats! Teach 8 of them a lesson — Scoopy will help!',
    done: 'My treats are safe! Here, take this Mystery Egg. Who knows what will hatch~', rewards: { exp: 520, gold: 260, items: [['pet_egg', 1]] }, next: 'q5' },
  { id: 'q5', name: 'Swift as the Wind', giver: 'mimi', turnin: 'brom', type: 'talk',
    text: 'You will be traveling far, so you need a mount! Brom the Stablemaster is just south of the plaza.',
    done: 'Hah! So you are the hero everyone talks about. Take this Fluffy Chick — fastest bird in Carlyle. Press R to ride!', rewards: { exp: 320, gold: 150, mount: 'mount_chick' }, next: 'q6' },
  { id: 'q6', name: "Spirit's Call", giver: 'brom', turnin: 'sylphie', type: 'talk',
    text: 'Sylphie the Spirit Guide has been asking for you. Something about your element... spirits give me the shivers.',
    done: 'The Spirits have chosen you! Receive this Sprite and these Fairy Wings, symbols of their blessing. May they light your way.', rewards: { exp: 420, gold: 200, sprite: true, wings: true }, next: 'q7' },
  { id: 'q7', name: 'Glowcap Harvest', giver: 'sylphie', turnin: 'lyla', type: 'collect', target: 'shroom', item: 'glowcap', count: 6, chance: 0.6,
    text: 'Mossveil Forest to the south is sick. Shroomlings there carry Glowcaps, which Lyla can brew into a cure. Gather 6 Glowcaps and bring them to her.',
    done: 'Six perfect Glowcaps! I will brew a cure right away. Take some of my finest stock as thanks.', rewards: { exp: 1300, gold: 400, items: [['hp_potion', 15], ['exp_scroll', 1]], diamonds: 30 }, next: 'q8' },
  { id: 'q8', name: 'Howls in Mossveil', giver: 'lyla', turnin: 'elena', type: 'kill', target: 'wolf', count: 8,
    text: 'Thornwolves attacked my supply cart in Mossveil! Captain Elena wants them driven back. Defeat 8 of them, then report to her.',
    done: 'Good hunting. The roads will be safer now. You have the makings of a true guardian.', rewards: { exp: 2100, gold: 500, equip: 'armor' }, next: 'q9' },
  { id: 'q9', name: 'Thorns of the Ruins', giver: 'elena', turnin: 'elena', type: 'kill', target: 'treant', count: 3,
    text: 'Our scouts saw Bramble Treants marching out of the Elder Ruins to the west. They are elite foes — bring potions, and defeat 3 of them.',
    done: 'Three Treants felled! But they were fleeing from something deeper in the ruins...', rewards: { exp: 3600, gold: 800, diamonds: 50, equip: 'ring' }, next: 'q10' },
  { id: 'q10', name: 'The Treant King', giver: 'elena', turnin: 'elder', type: 'kill', target: 'boss', count: 1,
    text: 'Treant King Yggr, an ancient spirit of the wood, has been corrupted. He waits in the northern arena of the Elder Ruins. Watch for the red circles on the ground — step out of them! Defeat him and report to Elder Rowan.',
    done: 'You freed Yggr from the corruption... The Spirits sing your name tonight, hero of Carlyle!', rewards: { exp: 8000, gold: 2000, diamonds: 150, pet: 'pet_dragon', equip: 'necklace' }, next: 'q11' },
  { id: 'q11', name: 'Beyond the World Tree', giver: 'elder', turnin: 'sylphie', type: 'talk',
    text: 'Look north, past the mountains: the World Tree, Yggdrasil. Its roots bind the realms together, and something stirs beneath them. Sylphie felt the Spirit of Earth tremble last night. Go to her.',
    done: 'You came. The Spirit of Earth is sick, and the sickness is spreading. Chapter I of your tale is complete, but the story of Carlyle is only beginning.', rewards: { exp: 2000, gold: 1000, diamonds: 50 }, next: 'c2_1' },
  ...STORY_QUESTS,
];

export const BOUNTY_TARGETS = ['jelly', 'bunny', 'shroom', 'wolf', 'golem', 'treant'];

export const SIGNIN = [
  { day: 1, label: '1,000 Gold', gold: 1000 },
  { day: 2, label: 'Healing x10', items: [['hp_potion', 10]] },
  { day: 3, label: 'Pet: Mochi', pet: 'pet_cat' },
  { day: 4, label: '60 Diamonds', diamonds: 60 },
  { day: 5, label: 'Pet Egg x2', items: [['pet_egg', 2]] },
  { day: 6, label: '3,000 Gold', gold: 3000 },
  { day: 7, label: 'Mount: Panda', mount: 'mount_panda' },
];

export const ONLINE_GIFTS = [
  { secs: 60, label: '300 Gold', gold: 300 },
  { secs: 180, label: 'Mana x5', items: [['mp_potion', 5]] },
  { secs: 300, label: 'Pet: Pengu', pet: 'pet_penguin' },
  { secs: 600, label: '40 Diamonds', diamonds: 40 },
  { secs: 900, label: 'Pet Egg', items: [['pet_egg', 1]] },
];

export const MALL = [
  { kind: 'item', id: 'hp_potion', qty: 10, cost: { gold: 380 } },
  { kind: 'item', id: 'mp_potion', qty: 10, cost: { gold: 380 } },
  { kind: 'item', id: 'pet_egg', qty: 1, cost: { gold: 900 } },
  { kind: 'item', id: 'dungeon_ticket', qty: 1, cost: { diamonds: 25 } },
  { kind: 'pet', id: 'pet_cupcake', cost: { gold: 1800 } },
  { kind: 'pet', id: 'pet_puppet', cost: { gold: 4500 } },
  { kind: 'pet', id: 'pet_star', cost: { diamonds: 300 } },
  { kind: 'mount', id: 'mount_wolf', cost: { gold: 6000 } },
  { kind: 'mount', id: 'mount_pegasus', cost: { diamonds: 500 } },
];

export const BOT_NAMES = ['Lunaria', 'xXShadowXx', 'MochiMochi', 'Kirito77', 'SakuraBloom', 'Valkyr', 'Pudding', 'Aerith', 'NoobSlayer', 'Celestine', 'Tofu', 'RuneKnight', 'Mirabelle', 'Zephyrus', 'Bubbles', 'DarkAngel', 'Yuki', 'Ignis', 'Mercy', 'Felix'];
export const TITLES = ['Novice Adventurer', 'Jelly Hunter', 'Pet Lover', 'Rising Star', 'Guardian of Carlyle', 'Spirit Chosen',
  'Guild Hero', 'Titan Slayer', 'Market Mogul', 'Codex Keeper', 'Lorekeeper of Aetherheim', 'Season Veteran', 'Season Champion', 'Harvest Lord', 'Starlight Guardian', 'Blossom Dancer', 'Warlord'];


export const TIPS = [
  'Click a quest in the tracker to auto-path there; your journal keeps the directions quest givers tell you.',
  'Your Axe, Pickaxe and Sickle sit on the tool belt above the skill bar: press 8, 9 or 0 to gather the nearest node.',
  'Press R to summon or dismiss your mount.',
  'Auto-hit (T) fights from where you stand. Roll (Shift) through red telegraphs.',
  'Play with a friend: share your join code from the Online window, and they join your party and appear beside you.',
  'Pets fight by your side and add to your Battle Rating.',
  'Enhance gear at Gorm the Blacksmith to raise your Battle Rating.',
  'Step out of red circles on the ground to avoid boss attacks!',
  'Claim your Daily Sign-In reward every day.',
];

// ---- expanded world content (Lv 16-200), see data-world.js
Object.assign(MONSTERS, NEW_MONSTERS, DUNGEON_MONSTERS, DZ_MONSTERS);
SPAWNS.push(...NEW_SPAWNS, ...DZ_SPAWNS);
ZONES.push(...NEW_ZONES);
DUNGEONS.push(...NEW_DUNGEONS);
Object.assign(ITEMS, NEW_ITEMS, STORY_ITEMS, TOOL_ITEMS);
PETS.push(...NEW_PETS);
MOUNTS.push(...NEW_MOUNTS);
NPCS.push(...NEW_NPCS);
TELEPORTS.push(...NEW_TELEPORTS);
TITLES.push(...NEW_TITLES, ...STORY_TITLES);
for (const [m, list] of Object.entries(NEW_DROPS)) if (MONSTERS[m]) MONSTERS[m].drops = [...(MONSTERS[m].drops || []), ...list.map(([id, chance]) => ({ id, chance }))];
// ---- breakthrough trials (data-trials.js): the Trial Warden, sigils, food, trial foes and their titles
NPCS.push({ id: 'thalia', icon: 'trial', name: 'Thalia', title: 'Trial Warden', x: 12, z: -34, look: 'thalia', face: -0.34, service: 'trials', greet: 'Every twentieth step of your climb ends at a wall, and I keep the gates. Bring me a sigil made from what grows and sleeps in your lands, and prove you have learned to fight, not just to grow strong.' });
Object.assign(ITEMS, SIGIL_ITEMS, FOOD_ITEMS);
for (const [id, d] of Object.entries(TRIAL_MONSTER_DEFS)) { const { from, look, ...rest } = d; MONSTERS[id] = { ...MONSTERS[from], ...rest, lvl: [1, 1], exp: 0, gold: [0, 0], drops: [], aggressive: true, dungeon: true, skills: rest.trialAI && rest.trialAI !== 'gauntlet' ? [] : MONSTERS[from].skills }; void look; }
TITLES.push(...TRIALS.map((t) => t.title));
// Battle Rating is level x 100 + gear + mastery x 50, so recommended values follow the dungeon's level
for (const d of DUNGEONS) d.recBR = Math.round(d.lv * 1.75) * 100;
// ---- navigation: survey maps cartographers copy (one per zone) and the parchment they are drawn on
ITEMS.blank_parchment = { name: 'Blank Parchment', icon: 'parchment', type: 'material', quality: 0, stack: 99, price: 60, desc: 'Copy a zone you have explored onto it from the World Map (Survival mastery 20+).' };
for (const z of ZONES) if (!z.safe && z.name !== 'Storm Altar') ITEMS['survey_' + zoneKey(z.name)] = { name: `Survey Map: ${z.name}`, icon: 'survey_map', type: 'survey', quality: 2, stack: 20, price: 450, desc: `A hand-drawn map of ${z.name}. Read it to add the whole zone to your own map.` };
BOUNTY_TARGETS.push('sunsprite', 'tuskboar', 'bumblebuzz', 'bogcroaker', 'miresnapper', 'cinderimp', 'lavasala', 'snowboar', 'yeti', 'amethystbeetle', 'crystalstag', 'gloomboar', 'fenwraith', 'starling', 'celestag');
