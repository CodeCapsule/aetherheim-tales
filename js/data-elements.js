// Weapon elements: Gorm infuses a weapon with one element using three of its crystals. Each element gives a small
// bonus, its own glow and sparks on the weapon (weaponfx.js) and its own burst on every hit; other players see it.
// Crystals drop from monsters: the element of the land you hunt in, a random one from elites and bosses.
export const ELEMENTS = {
  fire: { name: 'Fire', crystal: 'Ember Crystal', color: '#ff8a4a', hex: 0xff6a2a, parts: [0xffc04a, 0xff7a2a, 0xff3a10], mods: { critDmg: 12 }, bonus: '+12% critical damage' },
  storm: { name: 'Lightning', crystal: 'Storm Crystal', color: '#8ac8ff', hex: 0x5aa8ff, parts: [0xffffff, 0xbfe6ff, 0x6a9aff], mods: { crit: 4 }, bonus: '+4% critical chance' },
  frost: { name: 'Frost', crystal: 'Frost Crystal', color: '#b8f4ff', hex: 0x9ae8ff, parts: [0xffffff, 0xd8f8ff, 0x8ad8ff], mods: { defPct: 6 }, bonus: '+6% defense' },
  wind: { name: 'Wind', crystal: 'Gale Crystal', color: '#a8ffd8', hex: 0x7affc0, parts: [0xf0fff8, 0xb8ffe0, 0x5ae8a8], mods: { speed: 6, atkSpeed: 4 }, bonus: '+6% move speed, +4% attack speed' },
  earth: { name: 'Earth', crystal: 'Terra Crystal', color: '#e8b866', hex: 0xd89a3a, parts: [0xffe0a0, 0xd89a4a, 0x8a6a3a], mods: { hpPct: 6 }, bonus: '+6% max HP' },
  light: { name: 'Light', crystal: 'Radiant Crystal', color: '#fff0a0', hex: 0xffe27a, parts: [0xffffff, 0xfff6c0, 0xffd860], mods: { allPct: 2, healPct: 6 }, bonus: '+2% to all stats, +6% healing' },
  shadow: { name: 'Shadow', crystal: 'Umbral Crystal', color: '#c08aff', hex: 0x9a5aff, parts: [0xc890ff, 0x9a50ff, 0x6a20e0], mods: { lifesteal: 3 }, bonus: '+3% lifesteal' },
};
export const ELEMENT_IDS = Object.keys(ELEMENTS);
export const crystalId = (el) => 'crys_' + el;
export const isElement = (el) => typeof el === 'string' && Object.prototype.hasOwnProperty.call(ELEMENTS, el);

// the crystal a monster drops where you are hunting (anywhere else: any element)
export const ZONE_ELEMENT = {
  'Breezy Meadow': 'wind', 'World Tree Overlook': 'wind', 'Mossveil Forest': 'earth', 'Elder Ruins': 'earth', 'Storm Altar': 'storm',
  'Sunpetal Plains': 'light', 'Whispering Marsh': 'storm', 'Ember Canyon': 'fire', 'Frostpeak Highlands': 'frost', 'Crystal Wilds': 'storm',
  'Shadow Fen': 'shadow', 'Starfall Plateau': 'light', 'Yggdrasil Gate': 'earth', 'Bloodmoon Wastes': 'fire',
};
export const INFUSE_CRYSTALS = 3;
export const infuseGold = (eq) => 2000 + (eq?.lvl || 1) * 100;
// drop chance per kill: field monsters, elites, bosses (bosses always drop one or two)
export const CRYSTAL_DROP = { mob: 0.04, elite: 0.3, boss: 1 };
