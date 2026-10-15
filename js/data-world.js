// Content for the expanded world (Lv 16-200): outer zones, monsters, dungeons and their relics, items, pets, mounts,
// costumes, NPC shops, gathering, farming, alchemy and smithing. Pure data, merged into data.js tables at load.

export const MAX_LEVEL = 200;
export const BAG_BASE = 48, BAG_MAX = 160, BAG_STEP = 8;

// Monster stat curve for everything above the starter areas. High-level monsters grow tankier faster than they
// grow deadlier, so late zones are long fights. m = per-monster multipliers.
export function curveStats(L, m = {}) {
  const hp = (26 * Math.pow(L, 1.32) * (1 + L / 160) + 60) * (m.hp || 1);
  const atk = (6 + 0.9 * Math.pow(L, 1.55)) * (m.atk || 1);
  const def = (3 + 2.4 * L) * (m.def || 1);
  const exp = (1.8 * Math.pow(L, 1.6) + 15) * (m.exp || 1);
  const g = Math.pow(L, 1.15) * (m.gold || 1);
  return { hp: Math.round(hp), atk, def, exp: Math.round(exp), gold: [2.5 * g, 6 * g] };
}
const ELITE = { hp: 4, atk: 1.5, exp: 4, gold: 3 };
const FIELD_BOSS = { hp: 30, atk: 2, exp: 40, gold: 20 };
const DG_MOB = { hp: 1.6, atk: 1.3, exp: 1.3, gold: 1.2 };
const DG_ELITE = { hp: 6.5, atk: 1.9, exp: 5, gold: 3 };
const DG_BOSS = { hp: 45, atk: 2.4, exp: 60, gold: 30 };

// ---------------------------------------------------------------- zones (the map is now 800 x 800)
export const NEW_ZONES = [
  { name: 'Sunpetal Plains', x: 285, z: 10, r: 115, lv: 'Lv 16-30', biome: 'plains' },
  { name: 'Whispering Marsh', x: 30, z: 290, r: 110, lv: 'Lv 30-50', biome: 'marsh' },
  { name: 'Ember Canyon', x: -290, z: 10, r: 115, lv: 'Lv 50-80', biome: 'ember' },
  { name: 'Frostpeak Highlands', x: -260, z: -270, r: 120, lv: 'Lv 80-110', biome: 'frost' },
  { name: 'Crystal Wilds', x: 265, z: -270, r: 120, lv: 'Lv 110-140', biome: 'crystal' },
  { name: 'Shadow Fen', x: -265, z: 270, r: 120, lv: 'Lv 140-170', biome: 'shadow' },
  { name: 'Starfall Plateau', x: 270, z: 275, r: 120, lv: 'Lv 170-200', biome: 'astral' },
  { name: 'Yggdrasil Gate', x: 0, z: -315, r: 80, lv: 'Lv 190-200', biome: 'sacred' },
];
export const FARM = { x: -62, z: 48, r: 15 };

const mob = (name, model, variant, lvl, o = {}) => ({ name, model, variant, lvl, curve: o.curve || {}, aggressive: o.aggr ?? true, speed: o.speed || 4, range: o.range || 2, height: o.h || 1.8, scale: o.scale || 1, extra: true, ...o.more });
export const NEW_MONSTERS = {
  // Sunpetal Plains
  sunsprite: mob('Sunpetal Sprite', 'sunflower', 0, [16, 20], { aggr: false, speed: 3.4, h: 1.9 }),
  tuskboar: mob('Tusk Boar', 'boar', 0, [19, 24], { speed: 5, h: 1.7 }),
  bumblebuzz: mob('Bumblebuzz', 'bee', 0, [22, 27], { speed: 4.6, h: 1.6 }),
  grandtusker: mob('Grand Tusker', 'boar', 0, [26, 28], { curve: ELITE, h: 2.6, scale: 1.55, more: { elite: true } }),
  tuskfather: mob('Old Tuskfather', 'boar', 0, [30, 30], { curve: FIELD_BOSS, h: 5, scale: 2.8, range: 4.5, more: { boss: true, skills: ['slam', 'roots'] } }),
  // Whispering Marsh
  bogcroaker: mob('Bog Croaker', 'frog', 0, [30, 34], { aggr: false, speed: 3.6, h: 1.4 }),
  miresnapper: mob('Mire Snapper', 'croc', 0, [33, 38], { speed: 4.2, h: 1.3, range: 2.4 }),
  dartfrog: mob('Poison Dart Frog', 'frog', 1, [37, 42], { speed: 4, h: 1.4 }),
  marshwisp: { name: 'Marsh Wisp', model: 'wisp', variant: 0, lvl: [40, 45], curve: {}, aggressive: true, ranged: true, speed: 3.8, range: 9, height: 2.2, extra: true },
  bogtreant: { name: 'Bogwood Treant', model: 'rottreant', variant: 0, lvl: [45, 47], curve: ELITE, aggressive: true, elite: true, speed: 3.6, range: 3, height: 4, extra: true },
  hydraling: mob('Hydra Hatchling', 'hydra', 0, [50, 50], { curve: FIELD_BOSS, h: 5.5, scale: 0.75, range: 5, more: { boss: true, skills: ['slam', 'breath', 'roots'] } }),
  // Ember Canyon
  cinderimp: mob('Cinder Imp', 'imp', 0, [50, 56], { speed: 4.4, h: 1.5 }),
  lavasala: mob('Lava Salamander', 'salamander', 0, [55, 62], { speed: 4.6, h: 1.4, range: 2.3 }),
  magmagolem: mob('Magma Golem', 'colossus', 0, [60, 68], { speed: 3.2, h: 3.6, scale: 0.45, range: 2.8, curve: { hp: 1.4, def: 1.3 } }),
  firewasp: mob('Fire Wasp', 'bee', 1, [65, 72], { speed: 5, h: 1.6 }),
  embercolossus: mob('Ember Colossus', 'colossus', 0, [74, 76], { curve: ELITE, h: 5.6, scale: 0.7, range: 3.6, more: { elite: true } }),
  ignisling: mob('Ignis Wyrmling', 'drake', 0, [80, 80], { curve: FIELD_BOSS, h: 6, scale: 0.85, range: 5.5, more: { boss: true, skills: ['breath', 'slam', 'nova'] } }),
  // Frostpeak Highlands
  snowboar: mob('Snow Boar', 'boar', 2, [80, 86], { speed: 5, h: 1.7 }),
  frosttoad: mob('Frost Toad', 'frog', 2, [84, 90], { aggr: false, speed: 3.8, h: 1.4 }),
  yeti: mob('Highland Yeti', 'yeti', 0, [90, 98], { speed: 3.8, h: 2.6, range: 2.6, curve: { hp: 1.3 } }),
  frostimp: mob('Frost Imp', 'imp', 2, [95, 102], { speed: 4.4, h: 1.5 }),
  frostwraith: mob('Frost Wraith', 'wraith', 1, [104, 106], { curve: ELITE, h: 2.4, range: 2.6, more: { elite: true } }),
  rimeclaw: mob('Rimeclaw Wyrm', 'drake', 1, [110, 110], { curve: FIELD_BOSS, h: 6, scale: 0.9, range: 5.5, more: { boss: true, skills: ['breath', 'storm', 'slam'] } }),
  // Crystal Wilds
  amethystbeetle: mob('Amethyst Beetle', 'beetle', 0, [110, 116], { speed: 3.8, h: 1.4 }),
  prismlizard: mob('Prism Lizard', 'salamander', 1, [114, 122], { speed: 4.6, h: 1.4 }),
  emeraldscarab: mob('Emerald Scarab', 'beetle', 1, [120, 128], { speed: 4, h: 1.4, curve: { hp: 1.2 } }),
  crystalstag: mob('Crystal Stag', 'stag', 0, [126, 134], { speed: 5.2, h: 2.6, range: 2.6 }),
  stagking: mob('Crystal Stag Lord', 'stag', 0, [134, 136], { curve: ELITE, h: 4.2, scale: 1.4, range: 3, more: { elite: true } }),
  prismcolossus: mob('Prism Colossus', 'colossus', 1, [140, 140], { curve: FIELD_BOSS, h: 7.5, scale: 0.95, range: 5, more: { boss: true, skills: ['slam', 'nova', 'storm'] } }),
  // Shadow Fen
  gloomboar: mob('Gloom Boar', 'boar', 1, [140, 146], { speed: 5, h: 1.7 }),
  fenwraith: mob('Fen Wraith', 'wraith', 0, [144, 152], { speed: 4, h: 2.2 }),
  bonecroc: mob('Bone Croc', 'croc', 1, [150, 158], { speed: 4.2, h: 1.3, range: 2.4 }),
  shadeimp: mob('Shade Imp', 'imp', 1, [155, 162], { speed: 4.6, h: 1.5 }),
  nightyeti: mob('Night Yeti', 'yeti', 1, [164, 166], { curve: ELITE, h: 3.2, scale: 1.2, range: 2.8, more: { elite: true } }),
  umbraldrake: mob('Umbral Drake', 'drake', 3, [170, 170], { curve: FIELD_BOSS, h: 6.5, scale: 0.9, range: 5.5, more: { boss: true, skills: ['breath', 'nova', 'roots'] } }),
  // Starfall Plateau
  starling: mob('Starling', 'starling', 0, [170, 176], { aggr: false, speed: 4, h: 1.3 }),
  astralbloom: mob('Astral Bloom', 'sunflower', 1, [174, 182], { speed: 3.6, h: 1.9 }),
  starbeetle: mob('Star Beetle', 'beetle', 2, [180, 188], { speed: 4, h: 1.4, curve: { hp: 1.2 } }),
  celestag: mob('Celestial Stag', 'stag', 1, [186, 194], { speed: 5.2, h: 2.6, range: 2.6 }),
  seraphsentinel: mob('Seraph Sentinel', 'seraph', 0, [195, 198], { curve: ELITE, h: 3, range: 3, more: { elite: true } }),
  starforged: mob('Starforged Colossus', 'colossus', 2, [200, 200], { curve: FIELD_BOSS, h: 8, range: 5.5, more: { boss: true, skills: ['slam', 'storm', 'nova'] } }),
  // Yggdrasil Gate
  fallenseraph: mob('Fallen Seraph', 'seraph', 1, [196, 200], { h: 3, range: 3, curve: { hp: 1.5, atk: 1.2 } }),
  cyanstarling: mob('Rootlight Starling', 'starling', 1, [192, 198], { h: 1.3, speed: 4.2 }),
};

// Overworld spawn groups for the new zones (levels follow each group's lvl range)
export const NEW_SPAWNS = [
  { type: 'sunsprite', x: 236, z: 40, r: 22, count: 8 }, { type: 'tuskboar', x: 300, z: 70, r: 22, count: 8 }, { type: 'bumblebuzz', x: 320, z: -30, r: 22, count: 8 },
  { type: 'grandtusker', x: 345, z: 90, r: 14, count: 3 }, { type: 'tuskfather', x: 334, z: 30, r: 3, count: 1 },
  { type: 'bogcroaker', x: -10, z: 245, r: 22, count: 8 }, { type: 'miresnapper', x: 60, z: 260, r: 22, count: 7 }, { type: 'dartfrog', x: 70, z: 320, r: 20, count: 7 },
  { type: 'marshwisp', x: -20, z: 300, r: 18, count: 6 }, { type: 'bogtreant', x: 100, z: 350, r: 14, count: 3 }, { type: 'hydraling', x: 30, z: 336, r: 3, count: 1 },
  { type: 'cinderimp', x: -230, z: 50, r: 22, count: 8 }, { type: 'lavasala', x: -260, z: -40, r: 22, count: 8 }, { type: 'magmagolem', x: -320, z: 60, r: 20, count: 6 },
  { type: 'firewasp', x: -300, z: -70, r: 20, count: 7 }, { type: 'embercolossus', x: -360, z: 0, r: 14, count: 3 }, { type: 'ignisling', x: -334, z: -80, r: 3, count: 1 },
  { type: 'snowboar', x: -200, z: -220, r: 22, count: 8 }, { type: 'frosttoad', x: -250, z: -200, r: 20, count: 7 }, { type: 'yeti', x: -300, z: -250, r: 22, count: 7 },
  { type: 'frostimp', x: -220, z: -300, r: 20, count: 7 }, { type: 'frostwraith', x: -330, z: -300, r: 14, count: 3 }, { type: 'rimeclaw', x: -250, z: -340, r: 3, count: 1 },
  { type: 'amethystbeetle', x: 200, z: -220, r: 22, count: 8 }, { type: 'prismlizard', x: 250, z: -200, r: 20, count: 7 }, { type: 'emeraldscarab', x: 300, z: -250, r: 22, count: 7 },
  { type: 'crystalstag', x: 230, z: -310, r: 20, count: 6 }, { type: 'stagking', x: 340, z: -280, r: 14, count: 3 }, { type: 'prismcolossus', x: 250, z: -340, r: 3, count: 1 },
  { type: 'gloomboar', x: -200, z: 220, r: 22, count: 8 }, { type: 'fenwraith', x: -250, z: 200, r: 20, count: 7 }, { type: 'bonecroc', x: -300, z: 260, r: 22, count: 7 },
  { type: 'shadeimp', x: -220, z: 310, r: 20, count: 7 }, { type: 'nightyeti', x: -340, z: 290, r: 14, count: 3 }, { type: 'umbraldrake', x: -250, z: 340, r: 3, count: 1 },
  { type: 'starling', x: 215, z: 225, r: 22, count: 8 }, { type: 'astralbloom', x: 270, z: 210, r: 20, count: 7 }, { type: 'starbeetle', x: 320, z: 250, r: 22, count: 7 },
  { type: 'celestag', x: 240, z: 320, r: 20, count: 6 }, { type: 'seraphsentinel', x: 340, z: 300, r: 14, count: 3 }, { type: 'starforged', x: 270, z: 345, r: 3, count: 1 },
  { type: 'fallenseraph', x: -40, z: -300, r: 18, count: 5 }, { type: 'cyanstarling', x: 40, z: -290, r: 18, count: 6 },
];

// ---------------------------------------------------------------- dungeons (harder: time limit, death limit, enraging bosses)
const dmob = (name, model, variant, lvl, o = {}) => ({ name, model, variant, lvl, curve: o.curve || DG_MOB, aggressive: true, speed: o.speed || 4, range: o.range || 2.2, height: o.h || 1.8, scale: o.scale || 1, dungeon: true, extra: true, ...o.more });
export const DUNGEON_MONSTERS = {
  hivebee: dmob('Hive Drone', 'bee', 0, [24, 26], { h: 1.6, speed: 4.8 }),
  hivesprite: dmob('Pollen Sprite', 'sunflower', 0, [25, 27], { h: 1.9 }),
  hiveguard: dmob('Royal Hive Guard', 'bee', 2, [28, 28], { curve: DG_ELITE, h: 2.4, scale: 1.5, more: { elite: true } }),
  queenbee: dmob('Queen Bumblebloom', 'queenbee', 0, [32, 32], { curve: DG_BOSS, h: 8, range: 5, more: { boss: true, skills: ['nova', 'summon', 'storm', 'slam'], summon: 'hivebee' } }),
  templefrog: dmob('Temple Croaker', 'frog', 1, [44, 46], { h: 1.4 }),
  templecroc: dmob('Drowned Snapper', 'croc', 0, [45, 47], { h: 1.3, range: 2.4 }),
  templewraith: dmob('Drowned Priest', 'wraith', 1, [48, 48], { curve: DG_ELITE, h: 2.6, scale: 1.2, more: { elite: true } }),
  mirehydra: dmob('Mirelord Hydra', 'hydra', 0, [52, 52], { curve: DG_BOSS, h: 7.6, range: 5.5, more: { boss: true, skills: ['breath', 'roots', 'slam', 'summon'], summon: 'templefrog' } }),
  forgeimp: dmob('Forge Imp', 'imp', 0, [68, 70], { h: 1.5 }),
  forgesala: dmob('Slag Salamander', 'salamander', 0, [69, 71], { h: 1.4 }),
  forgegolem: dmob('Forge Guardian', 'colossus', 0, [73, 73], { curve: DG_ELITE, h: 4.5, scale: 0.6, more: { elite: true } }),
  ignis: dmob('Ignis, the Forge Drake', 'drake', 0, [82, 82], { curve: DG_BOSS, h: 7, range: 6, more: { boss: true, skills: ['breath', 'storm', 'nova', 'summon'], summon: 'forgeimp' } }),
  citadelyeti: dmob('Citadel Yeti', 'yeti', 0, [98, 100], { h: 2.6, range: 2.6 }),
  citadelimp: dmob('Rime Imp', 'imp', 2, [99, 101], { h: 1.5 }),
  citadelwraith: dmob('Frostbound Knight', 'wraith', 1, [104, 104], { curve: DG_ELITE, h: 2.8, scale: 1.3, more: { elite: true } }),
  skadi: dmob('Skadi, the Frost Wyrm', 'drake', 1, [112, 112], { curve: DG_BOSS, h: 7, range: 6, more: { boss: true, skills: ['breath', 'storm', 'slam', 'summon'], summon: 'citadelimp' } }),
  prismbeetle: dmob('Prism Beetle', 'beetle', 0, [128, 130], { h: 1.4 }),
  prismstag: dmob('Labyrinth Stag', 'stag', 0, [129, 131], { h: 2.6, range: 2.6 }),
  prismmimic: dmob('Glittering Mimic', 'mimic', 1, [134, 134], { curve: DG_ELITE, h: 1.8, scale: 1.4, more: { elite: true } }),
  colossusprime: dmob('Prism Colossus Prime', 'colossus', 1, [142, 142], { curve: DG_BOSS, h: 8, range: 6, more: { boss: true, skills: ['slam', 'nova', 'storm', 'summon'], summon: 'prismbeetle' } }),
  necrowraith: dmob('Necropolis Shade', 'wraith', 0, [158, 160], { h: 2.2 }),
  necrocroc: dmob('Crypt Crawler', 'croc', 1, [159, 161], { h: 1.3, range: 2.4 }),
  necroknight: dmob('Death Knight', 'boneknight', 0, [164, 164], { curve: DG_ELITE, h: 2.8, scale: 1.3, more: { elite: true } }),
  morvath: dmob('Lich King Morvath', 'lich', 0, [172, 172], { curve: DG_BOSS, h: 6.5, range: 6, more: { boss: true, skills: ['nova', 'roots', 'storm', 'summon'], summon: 'necrowraith' } }),
  sanctumstar: dmob('Sanctum Starling', 'starling', 0, [184, 186], { h: 1.3 }),
  sanctumstag: dmob('Sanctum Stag', 'stag', 1, [185, 187], { h: 2.6, range: 2.6 }),
  sanctumseraph: dmob('Seraph Warden', 'seraph', 0, [190, 190], { curve: DG_ELITE, h: 3.2, scale: 1.15, more: { elite: true } }),
  aurelion: dmob('Aurelion, the Astral Dragon', 'drake', 4, [196, 196], { curve: DG_BOSS, h: 7.5, range: 6, more: { boss: true, skills: ['breath', 'storm', 'nova', 'slam'], summon: 'sanctumstar' } }),
  thronefallen: dmob('Throne Seraph', 'seraph', 1, [196, 198], { h: 3, range: 3 }),
  thronecolossus: dmob('Rootbound Colossus', 'colossus', 2, [197, 199], { h: 4.2, scale: 0.55, range: 3 }),
  thronemimic: dmob('Worldtree Mimic', 'mimic', 0, [199, 199], { curve: DG_ELITE, h: 1.8, scale: 1.5, more: { elite: true } }),
  fenrir: dmob('Fenrir, the World Devourer', 'fenrir', 0, [200, 200], { curve: { hp: 70, atk: 2.8, exp: 100, gold: 50 }, h: 9, range: 7, more: { boss: true, skills: ['breath', 'storm', 'nova', 'slam', 'roots', 'summon'], summon: 'thronefallen' } }),
};

const room = (x, z, w, d, spawns) => ({ x, z, w, d, spawns });
export const NEW_DUNGEONS = [
  { id: 'd4', name: 'Sunpetal Hive', theme: 'hive', lv: 24, recBR: 9000, entries: 3, par: 330, origin: { x: 5000, z: 0 }, portal: { x: 332, z: -72 }, zone: 'Sunpetal Plains', relicName: 'Hivequeen',
    desc: 'A colossal golden hive buzzing beneath the plains, ruled by the Queen Bumblebloom.',
    rooms: [room(0, 0, 26, 24, [['hivebee', 4]]), room(-14, -44, 32, 28, [['hivebee', 3], ['hivesprite', 3]]), room(12, -90, 34, 30, [['hivesprite', 3], ['hiveguard', 2]]), { x: 0, z: -142, w: 44, d: 40, boss: 'queenbee' }] },
  { id: 'd5', name: 'Drowned Temple', theme: 'marsh', lv: 44, recBR: 18000, entries: 3, par: 360, origin: { x: 5000, z: 700 }, portal: { x: -40, z: 348 }, zone: 'Whispering Marsh', relicName: 'Drowned',
    desc: 'A sunken temple swallowed by the marsh, where a hydra coils around the old altar.',
    rooms: [room(0, 0, 26, 24, [['templefrog', 4]]), room(16, -42, 30, 30, [['templecroc', 3], ['templefrog', 3]]), room(-12, -88, 34, 30, [['templecroc', 3], ['templewraith', 2]]), { x: 0, z: -140, w: 46, d: 42, boss: 'mirehydra' }] },
  { id: 'd6', name: 'Molten Forge', theme: 'ember', lv: 68, recBR: 34000, entries: 2, par: 390, origin: { x: 5000, z: 1400 }, portal: { x: -350, z: -38 }, zone: 'Ember Canyon', relicName: 'Molten',
    desc: 'The dwarven forge of old, now a nest of imps and the lair of Ignis, the Forge Drake.',
    rooms: [room(0, 0, 26, 24, [['forgeimp', 4]]), room(-16, -44, 32, 30, [['forgeimp', 3], ['forgesala', 3]]), room(14, -92, 36, 32, [['forgesala', 3], ['forgegolem', 2]]), { x: 0, z: -146, w: 50, d: 44, boss: 'ignis' }] },
  { id: 'd7', name: 'Frostfang Citadel', theme: 'frost', lv: 98, recBR: 60000, entries: 2, par: 420, origin: { x: 5000, z: 2100 }, portal: { x: -305, z: -335 }, zone: 'Frostpeak Highlands', relicName: 'Frostfang',
    desc: 'An ice fortress on the highest peak, guarded by frostbound knights and Skadi the Frost Wyrm.',
    rooms: [room(0, 0, 26, 24, [['citadelyeti', 3], ['citadelimp', 2]]), room(16, -42, 30, 30, [['citadelimp', 3], ['citadelyeti', 3]]), room(-12, -88, 34, 30, [['citadelyeti', 3], ['citadelwraith', 2]]), { x: 0, z: -140, w: 46, d: 42, boss: 'skadi' }] },
  { id: 'd8', name: 'Prism Labyrinth', theme: 'crystal', lv: 128, recBR: 95000, entries: 2, par: 450, origin: { x: 5000, z: 2800 }, portal: { x: 325, z: -330 }, zone: 'Crystal Wilds', relicName: 'Prismatic',
    desc: 'Mirrored crystal halls that bend light and mind alike. The Prism Colossus Prime waits at the heart.',
    rooms: [room(0, 0, 26, 24, [['prismbeetle', 4]]), room(-16, -44, 32, 30, [['prismbeetle', 3], ['prismstag', 3]]), room(14, -92, 36, 32, [['prismstag', 3], ['prismmimic', 2]]), { x: 0, z: -146, w: 50, d: 44, boss: 'colossusprime' }] },
  { id: 'd9', name: 'Necropolis of Shades', theme: 'shadow', lv: 158, recBR: 140000, entries: 2, par: 480, origin: { x: 5000, z: 3500 }, portal: { x: -330, z: 330 }, zone: 'Shadow Fen', relicName: 'Necrotic',
    desc: 'A city of the dead beneath the fen. Lich King Morvath rules its endless night.',
    rooms: [room(0, 0, 26, 24, [['necrowraith', 4]]), room(16, -42, 30, 30, [['necrocroc', 3], ['necrowraith', 3]]), room(-12, -88, 34, 30, [['necrocroc', 3], ['necroknight', 2]]), { x: 0, z: -140, w: 46, d: 42, boss: 'morvath' }] },
  { id: 'd10', name: 'Astral Sanctum', theme: 'astral', lv: 184, recBR: 190000, entries: 2, par: 510, origin: { x: 5000, z: 4200 }, portal: { x: 330, z: 335 }, zone: 'Starfall Plateau', relicName: 'Astral',
    desc: 'A sanctum among the stars where Aurelion, the Astral Dragon, guards the light of creation.',
    rooms: [room(0, 0, 26, 24, [['sanctumstar', 4]]), room(-16, -44, 32, 30, [['sanctumstar', 3], ['sanctumstag', 3]]), room(14, -92, 36, 32, [['sanctumstag', 3], ['sanctumseraph', 2]]), { x: 0, z: -146, w: 50, d: 44, boss: 'aurelion' }] },
  { id: 'd11', name: 'Throne of Yggdrasil', theme: 'sacred', lv: 196, recBR: 240000, entries: 1, par: 600, origin: { x: 5000, z: 4900 }, portal: { x: 0, z: -362 }, zone: 'Yggdrasil Gate', relicName: 'Worldtree',
    desc: 'The heart of the World Tree. Fenrir, the World Devourer, has broken his chains. Level 200 boss.',
    rooms: [room(0, 0, 28, 26, [['thronefallen', 3], ['thronecolossus', 2]]), room(16, -44, 32, 30, [['thronefallen', 3], ['thronecolossus', 3]]), room(-12, -92, 36, 32, [['thronecolossus', 3], ['thronemimic', 2]]), { x: 0, z: -148, w: 52, d: 46, boss: 'fenrir' }] },
];
export const DUNGEON_RULES = { timeLimit: 900, deathLimit: 3, enrageAfter: 240 };

// ---------------------------------------------------------------- collection relics (4 per dungeon) and Red gear
const REL = [
  ['d1', 'Hollow', '#6af0ff', '#c8fff8', ['Glowcap Pearl', 'Jelly Crown Shard', 'Mossveil Idol', 'Tome of Spores']],
  ['d2', 'Catacomb', '#c07aff', '#f0d8ff', ['Gravelord Crown Shard', 'Seal of the Restless', 'Bone Idol', 'Crypt Ledger']],
  ['d3', 'Rootbound', '#ff5ad8', '#ffd8f4', ['Nidhogg Fang Crown', 'Rootseal', 'Blight Idol', 'Root Codex']],
  ['d4', 'Hivequeen', '#ffc83a', '#fff4b0', ['Honeyglass Crown', 'Royal Wax Seal', 'Pollen Idol', 'Book of the Hive']],
  ['d5', 'Drowned', '#3ac8a0', '#c8fff0', ['Drowned Tiara', 'Tidal Seal', 'Hydra Idol', 'Waterlogged Psalter']],
  ['d6', 'Molten', '#ff6a2a', '#ffe0a0', ['Slag Crown', 'Forge Seal', 'Ember Idol', 'Smith\'s Codex']],
  ['d7', 'Frostfang', '#7ad8ff', '#ffffff', ['Rime Crown', 'Glacier Seal', 'Wyrm Idol', 'Frozen Chronicle']],
  ['d8', 'Prismatic', '#c87aff', '#a0fff0', ['Prism Diadem', 'Mirror Seal', 'Crystal Idol', 'Refraction Tome']],
  ['d9', 'Necrotic', '#8a4ad8', '#7aff9a', ['Lich Crown Shard', 'Seal of Night', 'Shade Idol', 'Necronomicon Page']],
  ['d10', 'Astral', '#ffd84a', '#ffffff', ['Star Crown', 'Celestial Seal', 'Seraph Idol', 'Astral Atlas']],
  ['d11', 'Worldtree', '#7aff7a', '#ffd84a', ['Crown of Yggdrasil', 'Seal of Fenrir', 'Worldroot Idol', 'Saga of Ragnarok']],
];
const RELIC_SHAPES = ['crown', 'seal', 'idol', 'tome'];
export const RELICS = {}; // id -> { name, dungeon, shape, c1, c2 }
export const RELIC_SETS = {}; // dungeonId -> { adj, ids: [4], c1, c2 }
for (const [dg, adj, c1, c2, names] of REL) {
  RELIC_SETS[dg] = { adj, c1, c2, ids: [] };
  names.forEach((name, i) => {
    const id = `relic_${dg}_${i}`;
    RELICS[id] = { name, dungeon: dg, shape: RELIC_SHAPES[i], c1, c2 };
    RELIC_SETS[dg].ids.push(id);
  });
}
// Red (tier 6) recipe for a dungeon set: one of each relic + Crimson Core + Star Essence + gold
export const redCost = (lv) => ({ gold: Math.round(3000 + lv * lv * 6), mats: { star_essence: 1 + Math.floor(lv / 40) }, items: [['crimson_core', 1]] });
export const COLLECTION_BONUS = 0.012; // per completed relic set: +1.2% Attack and Max HP

// ---------------------------------------------------------------- gathering, farming, alchemy, smithing
export const PROF = {
  mining: { name: 'Mining', icon: 'mining' }, herbalism: { name: 'Herbalism', icon: 'herbalism' }, logging: { name: 'Logging', icon: 'logging' },
  farming: { name: 'Farming', icon: 'farming' }, alchemy: { name: 'Alchemy', icon: 'alchemy' }, smithing: { name: 'Smithing', icon: 'smithing' },
};
export const PROF_MAX = 100;
export const profNeed = (lv) => 40 + 12 * lv + lv * lv;
export const TIER_REQ = [1, 15, 35, 60, 85];
export const GATHER = {
  ore: { prof: 'mining', verb: 'Mining', mats: ['ore_copper', 'ore_iron', 'ore_silver', 'ore_mithril', 'ore_starmetal'], names: ['Copper Vein', 'Iron Vein', 'Silver Vein', 'Mithril Vein', 'Starmetal Vein'] },
  herb: { prof: 'herbalism', verb: 'Gathering', mats: ['herb_silverleaf', 'herb_moonbloom', 'herb_firepetal', 'herb_frostlily', 'herb_starlotus'], names: ['Silverleaf', 'Moonbloom', 'Firepetal', 'Frostlily', 'Starlotus'] },
  tree: { prof: 'logging', verb: 'Chopping', mats: ['wood_oak', 'wood_maple', 'wood_ironwood', 'wood_frostpine', 'wood_starwood'], names: ['Oak Tree', 'Maple Tree', 'Ironwood Tree', 'Frostpine', 'Starwood Tree'] },
};
// node fields: [centerX, centerZ, radius, tier, {ore, herb, tree} counts]
export const NODE_FIELDS = [
  [60, -40, 40, 0, { ore: 3, herb: 4, tree: 3 }], [20, 100, 40, 0, { ore: 2, herb: 4, tree: 4 }], [-110, 20, 45, 1, { ore: 4, herb: 2, tree: 2 }],
  [130, 60, 40, 0, { ore: 2, herb: 3, tree: 2 }], [285, 10, 90, 1, { ore: 4, herb: 5, tree: 5 }], [30, 290, 85, 2, { ore: 2, herb: 6, tree: 5 }],
  [-290, 10, 90, 2, { ore: 6, herb: 3, tree: 2 }], [-260, -270, 90, 3, { ore: 5, herb: 4, tree: 5 }], [265, -270, 90, 3, { ore: 6, herb: 3, tree: 3 }],
  [-265, 270, 90, 4, { ore: 3, herb: 5, tree: 5 }], [270, 275, 90, 4, { ore: 6, herb: 4, tree: 3 }],
];
export const CROPS = {
  wheat: { name: 'Wheat', mins: 2, lv: 1, seedPrice: 20, yield: [3, 5], exp: 12, color: '#f0c850' },
  carrot: { name: 'Carrot', mins: 4, lv: 5, seedPrice: 45, yield: [3, 5], exp: 20, color: '#ff8a2a' },
  strawberry: { name: 'Strawberry', mins: 8, lv: 12, seedPrice: 90, yield: [3, 6], exp: 34, color: '#ff4a5a' },
  pumpkin: { name: 'Pumpkin', mins: 15, lv: 20, seedPrice: 160, yield: [2, 4], exp: 55, color: '#ff9a2e' },
  moonmelon: { name: 'Moonmelon', mins: 30, lv: 35, seedPrice: 300, yield: [2, 4], exp: 90, color: '#9ad8ff' },
  sunfruit: { name: 'Sunfruit', mins: 60, lv: 50, seedPrice: 520, yield: [2, 4], exp: 150, color: '#ffe04a' },
  starberry: { name: 'Starberry', mins: 120, lv: 70, seedPrice: 900, yield: [2, 4], exp: 260, color: '#fff08a' },
};
export const FARM_PLOTS = 8;
// alchemy: out = ITEMS id, ins = { material or ITEMS id: qty }
export const ALCHEMY = [
  { id: 'a_hp2', out: 'potion_hp2', qty: 3, ins: { herb_silverleaf: 2, crop_wheat: 1, empty_vial: 3 }, lv: 1, exp: 14 },
  { id: 'a_mp2', out: 'potion_mp2', qty: 3, ins: { herb_moonbloom: 2, crop_carrot: 1, empty_vial: 3 }, lv: 5, exp: 18 },
  { id: 'a_swift', out: 'elixir_swift', qty: 1, ins: { herb_silverleaf: 3, crop_carrot: 2, empty_vial: 1 }, lv: 10, exp: 30 },
  { id: 'a_might', out: 'elixir_might', qty: 1, ins: { herb_firepetal: 3, crop_strawberry: 2, empty_vial: 1 }, lv: 18, exp: 45 },
  { id: 'a_hp3', out: 'potion_hp3', qty: 3, ins: { herb_firepetal: 2, crop_strawberry: 2, empty_vial: 3 }, lv: 25, exp: 50 },
  { id: 'a_iron', out: 'elixir_iron', qty: 1, ins: { herb_frostlily: 3, crop_pumpkin: 1, empty_vial: 1 }, lv: 30, exp: 60 },
  { id: 'a_mp3', out: 'potion_mp3', qty: 3, ins: { herb_frostlily: 2, crop_moonmelon: 1, empty_vial: 3 }, lv: 35, exp: 65 },
  { id: 'a_fortune', out: 'elixir_fortune', qty: 1, ins: { herb_moonbloom: 4, crop_sunfruit: 1, empty_vial: 1 }, lv: 45, exp: 90 },
  { id: 'a_wisdom', out: 'elixir_wisdom', qty: 1, ins: { herb_starlotus: 2, crop_moonmelon: 2, empty_vial: 1 }, lv: 55, exp: 110 },
  { id: 'a_phoenix', out: 'phoenix_draught', qty: 1, ins: { herb_starlotus: 3, herb_firepetal: 4, crop_starberry: 2, empty_vial: 1 }, lv: 70, exp: 160 },
];
// buff elixirs (real-time durations, survive reloads)
export const ELIXIRS = {
  elixir_might: { name: 'Elixir of Might', mins: 15, mods: { atk: 1.2 }, desc: '+20% Attack for 15 minutes.' },
  elixir_iron: { name: 'Elixir of Iron Skin', mins: 15, mods: { def: 1.25 }, desc: '+25% Defense for 15 minutes.' },
  elixir_swift: { name: 'Swiftness Tonic', mins: 15, mods: { speed: 1.15 }, desc: '+15% Move Speed for 15 minutes.' },
  elixir_wisdom: { name: 'Elixir of Wisdom', mins: 30, exp: 0.5, desc: '+50% EXP for 30 minutes.' },
  elixir_fortune: { name: 'Fortune Brew', mins: 30, gold: 0.5, luck: 0.2, desc: '+50% Gold and better loot for 30 minutes.' },
};
// smithing recipes at Gorm's Forge (ore + wood gear)
export const SMITHING = [
  { id: 's_copper', name: 'Copper Gear', quality: 1, up: 0.1, mats: { ore_copper: 6, wood_oak: 2 }, gold: 300, lv: 1, exp: 20 },
  { id: 's_iron', name: 'Iron Gear', quality: 2, up: 0.1, mats: { ore_iron: 8, wood_maple: 3 }, gold: 1200, lv: 15, exp: 45 },
  { id: 's_silver', name: 'Silver Gear', quality: 3, up: 0.08, mats: { ore_silver: 10, wood_ironwood: 4, spirit_shard: 2 }, gold: 6000, lv: 35, exp: 90 },
  { id: 's_mithril', name: 'Mithril Gear', quality: 3, up: 0.25, mats: { ore_mithril: 12, wood_frostpine: 4, spirit_shard: 4 }, gold: 20000, lv: 60, exp: 160 },
  { id: 's_starmetal', name: 'Starmetal Gear', quality: 4, up: 0.08, mats: { ore_starmetal: 14, wood_starwood: 6, star_essence: 2 }, gold: 60000, lv: 85, exp: 300 },
  { id: 's_crimson', name: 'Crimson Core', core: true, mats: { star_essence: 2, spirit_shard: 5 }, gold: 5000, lv: 10, exp: 60 },
];

// ---------------------------------------------------------------- materials, items, pets, mounts
export const NEW_MATERIALS = {
  ore_copper: ['Copper Ore', 0, 20], ore_iron: ['Iron Ore', 1, 45], ore_silver: ['Silver Ore', 2, 110], ore_mithril: ['Mithril Ore', 3, 260], ore_starmetal: ['Starmetal Ore', 4, 600],
  herb_silverleaf: ['Silverleaf', 0, 18], herb_moonbloom: ['Moonbloom', 1, 40], herb_firepetal: ['Firepetal', 2, 100], herb_frostlily: ['Frostlily', 3, 240], herb_starlotus: ['Starlotus', 4, 560],
  wood_oak: ['Oak Log', 0, 16], wood_maple: ['Maple Log', 1, 38], wood_ironwood: ['Ironwood Log', 2, 95], wood_frostpine: ['Frostpine Log', 3, 230], wood_starwood: ['Starwood Log', 4, 540],
  crop_wheat: ['Wheat', 0, 14], crop_carrot: ['Carrot', 0, 24], crop_strawberry: ['Strawberry', 1, 40], crop_pumpkin: ['Pumpkin', 1, 70], crop_moonmelon: ['Moonmelon', 2, 120], crop_sunfruit: ['Sunfruit', 2, 200], crop_starberry: ['Starberry', 3, 340],
};
export const NEW_ITEMS = {
  potion_hp2: { name: 'Greater Healing Draught', icon: 'potion_hp2', type: 'consumable', quality: 1, stack: 999, price: 120, desc: 'Restores 50% Max HP. Q uses your best healing draught.' },
  potion_hp3: { name: 'Superior Healing Draught', icon: 'potion_hp3', type: 'consumable', quality: 2, stack: 999, price: 380, desc: 'Restores 70% Max HP.' },
  potion_mp2: { name: 'Greater Mana Draught', icon: 'potion_mp2', type: 'consumable', quality: 1, stack: 999, price: 120, desc: 'Restores 50% Max MP. E uses your best mana draught.' },
  potion_mp3: { name: 'Superior Mana Draught', icon: 'potion_mp3', type: 'consumable', quality: 2, stack: 999, price: 380, desc: 'Restores 70% Max MP.' },
  elixir_might: { name: 'Elixir of Might', icon: 'elixir_might', type: 'elixir', quality: 2, stack: 99, price: 900, desc: '+20% Attack for 15 minutes.' },
  elixir_iron: { name: 'Elixir of Iron Skin', icon: 'elixir_iron', type: 'elixir', quality: 2, stack: 99, price: 900, desc: '+25% Defense for 15 minutes.' },
  elixir_swift: { name: 'Swiftness Tonic', icon: 'elixir_swift', type: 'elixir', quality: 1, stack: 99, price: 500, desc: '+15% Move Speed for 15 minutes.' },
  elixir_wisdom: { name: 'Elixir of Wisdom', icon: 'elixir_wisdom', type: 'elixir', quality: 3, stack: 99, price: 2400, desc: '+50% EXP for 30 minutes.' },
  elixir_fortune: { name: 'Fortune Brew', icon: 'elixir_fortune', type: 'elixir', quality: 3, stack: 99, price: 2400, desc: '+50% Gold and better loot for 30 minutes.' },
  phoenix_draught: { name: 'Phoenix Draught', icon: 'phoenix_draught', type: 'consumable', quality: 4, stack: 99, price: 6000, desc: 'Carried in your bag: when you fall, it revives you on the spot at full HP.' },
  empty_vial: { name: 'Empty Vial', icon: 'empty_vial', type: 'material', quality: 0, stack: 999, price: 10, desc: 'Glassware for alchemy.' },
  fertilizer: { name: 'Fertilizer', icon: 'fertilizer', type: 'farm', quality: 1, stack: 99, price: 150, desc: 'Use on a growing crop to halve its remaining time.' },
  bag_scroll: { name: 'Bag Expansion Scroll', icon: 'bag_scroll', type: 'consumable', quality: 3, stack: 99, price: 20000, desc: '+8 bag slots (up to 160).' },
  teleport_scroll: { name: 'Homeward Scroll', icon: 'teleport_scroll', type: 'consumable', quality: 1, stack: 99, price: 200, desc: 'Teleport to Sylvan Haven.' },
  pet_treat: { name: 'Pet Treat', icon: 'pet_treat', type: 'consumable', quality: 1, stack: 99, price: 500, desc: 'Raises your active pet by one level (max 60).' },
  crimson_core: { name: 'Crimson Core', icon: 'crimson_core', type: 'material', quality: 6, stack: 99, price: 12000, desc: 'The heart of every Red item. Craft at the Forge with a full relic set.' },
  socket_drill: { name: 'Socket Drill', icon: 'socket_drill', type: 'consumable', quality: 4, stack: 99, price: 8000, desc: 'Adds a gem socket to a piece of gear at the Forge (up to 5 sockets).' },
  enh_luck: { name: 'Lucky Charm', icon: 'enh_luck', type: 'consumable', quality: 3, stack: 99, price: 3000, desc: '+15% success chance on one enhancement attempt.' },
  lucky_ticket: { name: 'Lucky Ticket', icon: 'lucky_ticket', type: 'consumable', quality: 3, stack: 99, price: 2500, desc: 'Adds 20 Lucky Points, which pay for a Perfect Enhancement (100% success).' },
  enh_protect: { name: 'Protection Charm', icon: 'enh_protect', type: 'consumable', quality: 4, stack: 99, price: 9000, desc: 'Keeps your enhancement level when an attempt at +7 or higher fails.' },
  soul_cache: { name: 'Soulstone Chest', icon: 'soul_cache', type: 'consumable', quality: 5, stack: 99, price: 40000, desc: 'Open for a random Soulstone with a named power.' },
  costume_box: { name: 'Wardrobe Box', icon: 'wardrobe', type: 'consumable', quality: 3, stack: 99, price: 5000, desc: 'Unlocks a random costume you do not own yet.' },
};
for (const [k, c] of Object.entries(CROPS)) NEW_ITEMS['seed_' + k] = { name: `${c.name} Seeds`, icon: 'seed_' + k, type: 'seed', quality: c.lv >= 50 ? 2 : c.lv >= 20 ? 1 : 0, stack: 999, price: c.seedPrice, desc: `Plant on a farm plot. Ripe in ${c.mins >= 60 ? c.mins / 60 + ' h' : c.mins + ' min'}. Farming Lv ${c.lv}.` };

export const NEW_PETS = [
  { id: 'pet_fox', name: 'Kitsu', species: 'Fox', rarity: 1, atk: 14, hp: 70, model: 'fox', src: 'Drop: Sunpetal Plains', extra: true },
  { id: 'pet_bee', name: 'Buzzy', species: 'Bee', rarity: 1, atk: 13, hp: 60, model: 'bee', src: 'Drop: Bumblebuzz', extra: true },
  { id: 'pet_frog', name: 'Ribbit', species: 'Frog', rarity: 1, atk: 13, hp: 75, model: 'frog', src: 'Drop: Bog Croaker', extra: true },
  { id: 'pet_panda', name: 'Bao', species: 'Panda Cub', rarity: 1, atk: 12, hp: 90, model: 'panda', src: 'Pet Shop: 8,000 Gold', extra: true },
  { id: 'pet_imp', name: 'Cinder', species: 'Imp', rarity: 2, atk: 20, hp: 80, model: 'imp', src: 'Drop: Cinder Imp', extra: true },
  { id: 'pet_yeti', name: 'Fluffle', species: 'Baby Yeti', rarity: 2, atk: 19, hp: 110, model: 'yeti', src: 'Drop: Highland Yeti', extra: true },
  { id: 'pet_turtle', name: 'Prism', species: 'Crystal Turtle', rarity: 2, atk: 18, hp: 130, model: 'turtle', src: 'Drop: Emerald Scarab', extra: true },
  { id: 'pet_bat', name: 'Nyx', species: 'Bat', rarity: 2, atk: 22, hp: 80, model: 'bat', src: 'Drop: Fen Wraith', extra: true },
  { id: 'pet_phoenix', name: 'Blaze', species: 'Phoenix Chick', rarity: 3, atk: 32, hp: 140, model: 'phoenix', src: 'Drop: Ignis, the Forge Drake', extra: true },
  { id: 'pet_whale', name: 'Skye', species: 'Sky Whale', rarity: 3, atk: 30, hp: 180, model: 'whale', src: 'Drop: Starling', extra: true },
  { id: 'pet_kitsune', name: 'Kohaku', species: 'Kitsune', rarity: 3, atk: 34, hp: 150, model: 'kitsune', src: 'Pet Shop: 800 Diamonds', extra: true },
  { id: 'pet_icedragon', name: 'Frostbite', species: 'Ice Dragon', rarity: 3, atk: 33, hp: 160, model: 'icedragon', src: 'Drop: Skadi, the Frost Wyrm', extra: true },
];
export const NEW_MOUNTS = [
  { id: 'mount_lion', name: 'Flame Lion', speed: 1.8, br: 700, model: 'lion', src: 'Stable: 30,000 Gold', extra: true },
  { id: 'mount_bear', name: 'Glacier Bear', speed: 1.75, br: 650, model: 'bear', src: 'Drop: Rimeclaw Wyrm', extra: true },
  { id: 'mount_stag', name: 'Crystal Stag', speed: 1.85, br: 800, model: 'stag', src: 'Drop: Crystal Stag Lord', extra: true },
  { id: 'mount_panther', name: 'Shadow Panther', speed: 1.9, br: 900, model: 'panther', src: 'Stable: 1,200 Diamonds', extra: true },
  { id: 'mount_griffin', name: 'Royal Griffin', speed: 1.95, br: 1000, model: 'griffin', src: 'Stable: 1,600 Diamonds', extra: true },
  { id: 'mount_cloud', name: 'Nimbus Cloud', speed: 1.8, br: 750, model: 'cloud', src: 'Stable: 900 Diamonds', extra: true },
  { id: 'mount_drake', name: 'Ember Drake', speed: 2.0, br: 1200, model: 'drake', src: 'Drop: Ignis, the Forge Drake', extra: true },
  { id: 'mount_phoenix', name: 'Sunfire Phoenix', speed: 2.1, br: 1500, model: 'phoenixmount', src: 'Drop: Fenrir, the World Devourer', extra: true },
];
// monster -> extra pet/mount drops
export const NEW_DROPS = {
  sunsprite: [['pet_fox', 0.01]], bumblebuzz: [['pet_bee', 0.01]], bogcroaker: [['pet_frog', 0.01]], cinderimp: [['pet_imp', 0.008]], yeti: [['pet_yeti', 0.008]],
  emeraldscarab: [['pet_turtle', 0.008]], fenwraith: [['pet_bat', 0.008]], starling: [['pet_whale', 0.005]], ignis: [['pet_phoenix', 0.2], ['mount_drake', 0.15]],
  skadi: [['pet_icedragon', 0.2]], rimeclaw: [['mount_bear', 0.15]], stagking: [['mount_stag', 0.03]], fenrir: [['mount_phoenix', 0.2]],
};

// ---------------------------------------------------------------- costumes (cosmetic only, no stats)
// look = overrides passed to the humanoid builder
export const COSTUMES = [
  { id: 'c_sakura', slot: 'outfit', name: 'Sakura Kimono', c1: '#ff9ac8', c2: '#ffffff', look: { outfit: { main: 0xffc8de, accent: 0xff6aa8, trim: 0xffffff, skirt: 0xff9ac8 }, scarf: true }, price: { gold: 25000 } },
  { id: 'c_witch', slot: 'outfit', name: 'Moonlit Witch Robe', c1: '#5a3a9a', c2: '#ffd84a', look: { robe: true, outfit: { main: 0x4a2a7a, accent: 0xffd84a, trim: 0x2a1a4a, skirt: 0x3a2a6a } }, price: { gold: 30000 } },
  { id: 'c_parade', slot: 'outfit', name: 'Parade Armor', c1: '#d8dee8', c2: '#c0303a', look: { armor: true, cape: 0xc0303a, outfit: { main: 0xe8ecf4, accent: 0xc0303a, trim: 0xf0c040, skirt: 0x8a2030 } }, price: { diamonds: 400 } },
  { id: 'c_maid', slot: 'outfit', name: 'Cafe Maid Dress', c1: '#2a2a3a', c2: '#ffffff', look: { apron: true, outfit: { main: 0x2a2a3a, accent: 0xffffff, trim: 0xff7aa8, skirt: 0x1a1a2a } }, price: { gold: 30000 } },
  { id: 'c_ranger', slot: 'outfit', name: 'Forest Ranger', c1: '#3a8a4a', c2: '#a0602a', look: { hood: 0x2a6a3a, outfit: { main: 0x4a8a3a, accent: 0xa0602a, trim: 0xe8d8a0, skirt: 0x3a5a2a } }, price: { gold: 20000 } },
  { id: 'c_royal', slot: 'outfit', name: 'Royal Gown', c1: '#ffffff', c2: '#ffc83a', look: { cape: 0x7a3ad8, outfit: { main: 0xfff8f0, accent: 0xffc83a, trim: 0x7a3ad8, skirt: 0xfff0d8 } }, price: { diamonds: 600 } },
  { id: 'c_summer', slot: 'outfit', name: 'Summer Breeze', c1: '#3ad8d0', c2: '#ffe04a', look: { outfit: { main: 0x6af0e8, accent: 0xffe04a, trim: 0xffffff, skirt: 0x3ab8d8 } }, price: { gold: 15000 } },
  { id: 'c_ninja', slot: 'outfit', name: 'Shadow Ninja', c1: '#1a1a2a', c2: '#a04ad8', look: { scarf: true, outfit: { main: 0x22223a, accent: 0xa04ad8, trim: 0x55556a, skirt: 0x14141f } }, price: { diamonds: 500 } },
  { id: 'c_snow', slot: 'outfit', name: 'Snow Fairy', c1: '#e8f8ff', c2: '#7ad8ff', look: { outfit: { main: 0xf0faff, accent: 0x7ad8ff, trim: 0xffffff, skirt: 0xc8ecff } }, price: { diamonds: 350 } },
  { id: 'c_harvest', slot: 'outfit', name: 'Harvest Moon Garb', c1: '#ff8a2a', c2: '#7a3ad8', look: { outfit: { main: 0xff8a2a, accent: 0x7a3ad8, trim: 0x2a1a3a, skirt: 0x5a2a7a } }, price: { gold: 18000 } },
  { id: 'c_astral', slot: 'outfit', name: 'Astral Regalia', c1: '#ffffff', c2: '#ffd84a', look: { cape: 0xffd84a, armor: true, outfit: { main: 0xffffff, accent: 0xffd84a, trim: 0x7ad8ff, skirt: 0xe8f0ff } }, price: { diamonds: 1200 }, src: 'Dungeon chests (Astral Sanctum)' },
  { id: 'h_witch', slot: 'head', name: 'Witch Hat', c1: '#4a2a6a', c2: '#ffd84a', look: { hat: 'witch', hatColor: 0x4a2a6a }, price: { gold: 12000 } },
  { id: 'h_circlet', slot: 'head', name: 'Silver Circlet', c1: '#d8e0f0', c2: '#5fd0ff', look: { hat: 'circlet' }, price: { gold: 10000 } },
  { id: 'h_ranger', slot: 'head', name: 'Ranger Hat', c1: '#7a4a2a', c2: '#d04a3a', look: { hat: 'cowboy', hatColor: 0x6a4a2a }, price: { gold: 9000 } },
  { id: 'h_cat', slot: 'head', name: 'Cat Ears', c1: '#ff9ec7', c2: '#ffffff', look: { catEars: true, ears: false }, price: { diamonds: 200 } },
  { id: 'h_scarf', slot: 'head', name: 'Bandana', c1: '#e84a4a', c2: '#ffffff', look: { hat: 'scarf' }, price: { gold: 6000 } },
  { id: 'h_helm', slot: 'head', name: 'Knight Helm', c1: '#c8d0e0', c2: '#2a5ab8', look: { hat: 'helm' }, price: { gold: 14000 } },
  { id: 'b_angel', slot: 'back', name: 'Angel Wings', c1: '#ffffff', c2: '#fff4c8', look: { wings: true, wingColor: '#ffffff' }, price: { diamonds: 500 } },
  { id: 'b_demon', slot: 'back', name: 'Demon Wings', c1: '#3a1a2a', c2: '#ff3a5a', look: { wings: true, wingColor: '#7a1a3a' }, price: { diamonds: 500 } },
  { id: 'b_butterfly', slot: 'back', name: 'Butterfly Wings', c1: '#ff9ad8', c2: '#9ad8ff', look: { wings: true, wingColor: '#ffa8e8' }, price: { gold: 40000 } },
  { id: 'b_frost', slot: 'back', name: 'Frost Wings', c1: '#9ae8ff', c2: '#ffffff', look: { wings: true, wingColor: '#9ae8ff' }, price: { gold: 40000 } },
  { id: 'b_gold', slot: 'back', name: 'Golden Wings', c1: '#ffd84a', c2: '#fff4b0', look: { wings: true, wingColor: '#ffd84a' }, price: { diamonds: 900 } },
  { id: 'b_shadow', slot: 'back', name: 'Night Wings', c1: '#2a2a4a', c2: '#a07aff', look: { wings: true, wingColor: '#4a3a8a' }, price: { diamonds: 700 } },
];

// ---------------------------------------------------------------- NPCs with shops, outposts, teleports
export const SHOPS = {
  general: { name: "Hilda's Supplies", items: [['hp_potion', 10, { gold: 380 }], ['mp_potion', 10, { gold: 380 }], ['potion_hp2', 10, { gold: 1100 }, 20], ['potion_mp2', 10, { gold: 1100 }, 20], ['potion_hp3', 10, { gold: 3600 }, 60], ['potion_mp3', 10, { gold: 3600 }, 60], ['teleport_scroll', 5, { gold: 900 }], ['blank_parchment', 5, { gold: 300 }], ['bag_scroll', 1, { gold: 20000 }], ['bag_scroll', 1, { diamonds: 120 }], ['exp_scroll', 1, { gold: 600 }],
    ['tool_axe_0', 1, { gold: 150 }], ['tool_pick_0', 1, { gold: 150 }], ['tool_sickle_0', 1, { gold: 150 }], ['tool_axe_1', 1, { gold: 3000 }, 15], ['tool_pick_1', 1, { gold: 3000 }, 15], ['tool_sickle_1', 1, { gold: 3000 }, 15],
    ['m:enh_stone', 5, { gold: 6000 }], ['m:enh_stone2', 3, { gold: 15000 }, 40], ['m:enh_stone3', 1, { diamonds: 60 }, 90], ['enh_luck', 1, { diamonds: 40 }], ['enh_protect', 1, { diamonds: 120 }], ['lucky_ticket', 1, { diamonds: 30 }]] },
  farm: { name: "Tilly's Seeds", items: [...Object.entries(CROPS).map(([k, c]) => ['seed_' + k, 5, { gold: c.seedPrice * 5 }, 1, c.lv]), ['fertilizer', 3, { gold: 420 }]] },
  alchemy: { name: "Vera's Apothecary", items: [['empty_vial', 10, { gold: 100 }], ['potion_hp2', 5, { gold: 600 }], ['elixir_swift', 1, { gold: 700 }], ['elixir_might', 1, { gold: 1400 }, 20], ['elixir_iron', 1, { gold: 1400 }, 30], ['elixir_wisdom', 1, { diamonds: 60 }], ['elixir_fortune', 1, { diamonds: 60 }]] },
  gems: { name: "Opal's Gems", items: [['gem_pouch', 1, { gold: 1500 }], ['m:gem_ruby_1', 1, { gold: 900 }], ['m:gem_sapphire_1', 1, { gold: 900 }], ['m:gem_emerald_1', 1, { gold: 900 }], ['m:gem_topaz_1', 1, { gold: 900 }], ['m:gem_ruby_2', 1, { diamonds: 90 }], ['m:gem_emerald_2', 1, { diamonds: 90 }], ['m:gem_sapphire_2', 1, { diamonds: 90 }], ['m:gem_topaz_2', 1, { diamonds: 90 }],
    ['m:gem_amethyst_1', 1, { gold: 2500 }, 20], ['m:gem_onyx_1', 1, { gold: 2500 }, 20], ['m:gem_opal_1', 1, { gold: 2500 }, 20], ['m:gem_aquamarine_1', 1, { gold: 2500 }, 20],
    ['m:gem_garnet_1', 1, { gold: 2500 }, 20], ['m:gem_jade_1', 1, { gold: 2500 }, 20], ['m:gem_moonstone_1', 1, { gold: 2500 }, 20], ['m:gem_citrine_1', 1, { gold: 2500 }, 20],
    ['socket_drill', 1, { diamonds: 200 }], ['soul_cache', 1, { diamonds: 1500 }]] },
  pets: { name: "Mimi's Pet Corner", items: [['pet_treat', 1, { gold: 500 }], ['pet_egg', 1, { gold: 900 }], ['p:pet_panda', 1, { gold: 8000 }], ['p:pet_cupcake', 1, { gold: 1800 }], ['p:pet_kitsune', 1, { diamonds: 800 }], ['p:pet_star', 1, { diamonds: 300 }]] },
  stable: { name: "Brom's Stable", items: [['r:mount_wolf', 1, { gold: 6000 }], ['r:mount_lion', 1, { gold: 30000 }], ['r:mount_cloud', 1, { diamonds: 900 }], ['r:mount_panther', 1, { diamonds: 1200 }], ['r:mount_griffin', 1, { diamonds: 1600 }], ['r:mount_pegasus', 1, { diamonds: 500 }]] },
  tailor: { name: "Coco's Boutique", items: COSTUMES.filter((c) => !c.src).map((c) => ['c:' + c.id, 1, c.price]).concat([['costume_box', 1, { diamonds: 150 }], ['m:tl_linen', 5, { gold: 300 }], ['m:tl_silk', 5, { gold: 1200 }, 20]]) },
  collector: { name: "Elias' Curios", items: [['crimson_core', 1, { gold: 60000 }, 40], ['crimson_core', 1, { diamonds: 400 }], ['m:star_essence', 1, { gold: 9000 }], ['m:spirit_shard', 5, { gold: 4000 }]] },
  outpost: { name: 'Frontier Supplies', items: [['tool_axe_0', 1, { gold: 200 }], ['tool_pick_0', 1, { gold: 200 }], ['tool_sickle_0', 1, { gold: 200 }], ['potion_hp2', 10, { gold: 1200 }], ['potion_mp2', 10, { gold: 1200 }], ['potion_hp3', 10, { gold: 3800 }, 60], ['potion_mp3', 10, { gold: 3800 }, 60], ['teleport_scroll', 5, { gold: 900 }], ['empty_vial', 10, { gold: 120 }]] },
};
export const NEW_NPCS = [
  { id: 'tilly', icon: 'farm', name: 'Tilly', title: 'Farmer', x: -44, z: 36, look: 'tilly', face: -2.3, service: 'farm', greet: 'Good soil, good seeds, good friends! Your own plots are ready right behind me.' },
  { id: 'vera', icon: 'alchemy', name: 'Vera', title: 'Alchemist', x: 22, z: -28, look: 'vera', face: -0.6, service: 'alchemy', greet: 'Herbs from the wilds, fruit from the farm, a little patience over the flame... that is alchemy.' },
  { id: 'coco', icon: 'wardrobe', name: 'Coco', title: 'Costume Tailor', x: -38, z: -22, look: 'coco', face: 1.0, service: 'tailor', greet: 'Darling! Stats are for armor. Style is forever. Come try something on!' },
  { id: 'opal', icon: 'gem', name: 'Opal', title: 'Gemcutter', x: -36, z: 2, look: 'opal', face: 1.6, service: 'shop:gems', greet: 'Rubies for fury, sapphires for steel, emeralds for life, topaz for luck. Which calls to you?' },
  { id: 'hilda', icon: 'bag_plus', name: 'Hilda', title: 'Quartermaster', x: 40, z: 18, look: 'hilda', face: -1.9, service: 'shop:general', greet: 'Potions, scrolls and bigger bags. An adventurer is only as good as their supplies!' },
  { id: 'grimsby', icon: 'auction', name: 'Grimsby', title: 'Auctioneer', x: -14, z: -30, look: 'grimsby', face: 0.4, service: 'auction', greet: 'Going once, going twice! The Auction House never sleeps, and neither do the bargains.' },
  { id: 'elias', icon: 'collection', name: 'Elias', title: 'Relic Collector', x: 38, z: -6, look: 'elias', face: -1.3, service: 'collector', greet: 'Every dungeon guards four relics. Bring me a full set and the Forge can make it sing in red.' },
];
// One outpost camp per new zone: a merchant NPC, a campfire and a teleport point.
export const OUTPOSTS = [
  { zone: 'Sunpetal Plains', x: 214, z: 0, face: -1.6 }, { zone: 'Whispering Marsh', x: 22, z: 222, face: 3.0 }, { zone: 'Ember Canyon', x: -214, z: 4, face: 1.6 },
  { zone: 'Frostpeak Highlands', x: -205, z: -180, face: 0.8 }, { zone: 'Crystal Wilds', x: 210, z: -190, face: -0.8 }, { zone: 'Shadow Fen', x: -210, z: 190, face: 2.4 },
  { zone: 'Starfall Plateau', x: 215, z: 200, face: -2.4 }, { zone: 'Yggdrasil Gate', x: 0, z: -250, face: 0 },
];
OUTPOSTS.forEach((o, i) => {
  NEW_NPCS.push({ id: 'outpost' + i, icon: 'npc_shop', name: ['Bram', 'Lotte', 'Kael', 'Freya', 'Iris', 'Moro', 'Stella', 'Eldrin'][i], title: 'Outpost Trader', x: o.x, z: o.z, look: 'trader', face: o.face, service: 'shop:outpost', greet: `Welcome to the ${o.zone} outpost. Stock up before you head out!` });
});
export const NEW_TELEPORTS = OUTPOSTS.map((o) => ({ name: o.zone, x: o.x + Math.sin(o.face) * 5, z: o.z + Math.cos(o.face) * 5, lv: NEW_ZONES.find((z) => z.name === o.zone).lv }));
export const NEW_TITLES = ['Peerless Smith', 'Master Gatherer', 'Green Thumb', 'Grand Alchemist', 'Crimson Smith', 'Relic Hunter', 'Fashionista', 'World Devourer Slayer', 'Legend of Hiraya'];

// ---------------------------------------------------------------- auction
export const AUCTION = { fee: 0.05, minStep: 0.05, durations: [5, 15, 30, 60], active: 12, maxMine: 6 };
