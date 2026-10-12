// Navigation without markers: tall landmarks in every zone (placed by angle and distance from the zone's center),
// one hidden ruin and one lore book per zone (discovery XP), and the Survey Maps cartographers copy for others.
// kinds: spire, beacon, tree, statue, arch, crystal, totem, obelisk

export const LANDMARK_DEFS = {
  'Sylvan Haven': [{ name: 'the Moonwell Fountain', kind: 'none', at: [0, 0] }],
  'Breezy Meadow': [{ name: 'the Windmill Spire', kind: 'spire', a: 20, d: 0.55, color: 0xf0ece0 }, { name: 'the Old Watchtower', kind: 'beacon', a: 150, d: 0.6, color: 0xffb04a }, { name: 'the Twin Oaks', kind: 'tree', a: 260, d: 0.5, color: 0x5a9a3a }],
  'Mossveil Forest': [{ name: 'the Hollow Giant', kind: 'tree', a: 60, d: 0.55, color: 0x3a7a3a }, { name: 'the Mossy Arch', kind: 'arch', a: 190, d: 0.55, color: 0x7a8a6a }, { name: 'the Lantern Totem', kind: 'totem', a: 300, d: 0.6, color: 0xffd04a }],
  'Elder Ruins': [{ name: 'the Broken Colossus', kind: 'statue', a: 30, d: 0.5, color: 0xb8b0a0 }, { name: 'the Sunken Obelisk', kind: 'obelisk', a: 130, d: 0.6, color: 0x8a8a9a }, { name: 'the Elder Arch', kind: 'arch', a: 230, d: 0.55, color: 0xa8a090 }, { name: 'the Shattered Tower', kind: 'beacon', a: 320, d: 0.62, color: 0x9a9aa8 }],
  'World Tree Overlook': [{ name: 'the Root Spire', kind: 'spire', a: 70, d: 0.55, color: 0x8a6a4a }, { name: 'the Sky Shrine', kind: 'beacon', a: 200, d: 0.55, color: 0xffe07a }, { name: 'the Whispering Stones', kind: 'obelisk', a: 300, d: 0.5, color: 0x9ab8a0 }],
  'Sunpetal Plains': [{ name: 'the Sunflower Colossus', kind: 'statue', a: 10, d: 0.45, color: 0xffd04a }, { name: 'the Golden Windmill', kind: 'spire', a: 100, d: 0.6, color: 0xf0d080 }, { name: 'the Hive Pillar', kind: 'totem', a: 200, d: 0.55, color: 0xffb02a }, { name: "the Shepherd's Beacon", kind: 'beacon', a: 290, d: 0.6, color: 0xff8a3a }],
  'Whispering Marsh': [{ name: 'the Drowned Bell Tower', kind: 'beacon', a: 40, d: 0.5, color: 0x7ad8c8 }, { name: 'the Crooked Willow', kind: 'tree', a: 140, d: 0.55, color: 0x4a7a4a }, { name: 'the Frog King Statue', kind: 'statue', a: 230, d: 0.55, color: 0x6aa85a }, { name: 'the Reed Obelisk', kind: 'obelisk', a: 320, d: 0.6, color: 0x8a9a6a }],
  'Ember Canyon': [{ name: 'the Molten Spire', kind: 'crystal', a: 20, d: 0.5, color: 0xff5a2a }, { name: 'the Iron Watchtower', kind: 'beacon', a: 120, d: 0.6, color: 0xff7a3a }, { name: 'the Forge Colossus', kind: 'statue', a: 220, d: 0.55, color: 0x6a5a5a }, { name: 'the Ash Arch', kind: 'arch', a: 310, d: 0.6, color: 0x8a7a70 }],
  'Frostpeak Highlands': [{ name: 'the Frozen Spire', kind: 'crystal', a: 30, d: 0.5, color: 0x9ae8ff }, { name: 'the Yeti Totem', kind: 'totem', a: 130, d: 0.6, color: 0xd8e8f8 }, { name: 'the Glacier Beacon', kind: 'beacon', a: 230, d: 0.55, color: 0x7ab8ff }, { name: 'the Ice Arch', kind: 'arch', a: 320, d: 0.6, color: 0xc8e0f0 }],
  'Crystal Wilds': [{ name: 'the Prism Needle', kind: 'crystal', a: 40, d: 0.5, color: 0xc89aff }, { name: 'the Singing Crystal', kind: 'crystal', a: 140, d: 0.6, color: 0x5ae8d8 }, { name: 'the Starling Arch', kind: 'arch', a: 230, d: 0.55, color: 0xb8a8e8 }, { name: 'the Amethyst Tower', kind: 'beacon', a: 320, d: 0.6, color: 0xb07aff }],
  'Shadow Fen': [{ name: 'the Black Lantern', kind: 'beacon', a: 20, d: 0.5, color: 0x7aff9a }, { name: 'the Weeping Statue', kind: 'statue', a: 120, d: 0.6, color: 0x5a5468 }, { name: 'the Dead Tree', kind: 'tree', a: 220, d: 0.55, color: 0x3a3440 }, { name: 'the Fen Obelisk', kind: 'obelisk', a: 310, d: 0.6, color: 0x4a4458 }],
  'Starfall Plateau': [{ name: 'the Fallen Star', kind: 'crystal', a: 30, d: 0.5, color: 0xffd84a }, { name: 'the Observatory', kind: 'beacon', a: 130, d: 0.6, color: 0x9ad8ff }, { name: 'the Comet Arch', kind: 'arch', a: 220, d: 0.55, color: 0xe8e4f8 }, { name: 'the Astral Obelisk', kind: 'obelisk', a: 310, d: 0.6, color: 0xd0c8f0 }],
  'Yggdrasil Gate': [{ name: 'the Gate Pillars', kind: 'arch', a: 90, d: 0.4, color: 0xd8c890 }, { name: 'the Seed of Yggdrasil', kind: 'crystal', a: 200, d: 0.5, color: 0x7aff7a }, { name: 'the Warden Statue', kind: 'statue', a: 320, d: 0.5, color: 0xc8b890 }],
};

// one hidden ruin per zone (8% of a level the first time you step inside it)
export const HIDDEN_DEFS = {
  'Breezy Meadow': { name: 'the Overgrown Circle', a: 220, d: 0.85 },
  'Mossveil Forest': { name: 'the Druid Hollow', a: 110, d: 0.8 },
  'Elder Ruins': { name: 'the Forgotten Vault', a: 280, d: 0.85 },
  'World Tree Overlook': { name: 'the Root Cellar Shrine', a: 140, d: 0.8 },
  'Sunpetal Plains': { name: 'the Beekeeper\'s Grave', a: 330, d: 0.8 },
  'Whispering Marsh': { name: 'the Sunken Chapel', a: 270, d: 0.8 },
  'Ember Canyon': { name: 'the Cold Forge', a: 170, d: 0.8 },
  'Frostpeak Highlands': { name: 'the Frozen Camp', a: 80, d: 0.8 },
  'Crystal Wilds': { name: 'the Mirror Pool', a: 280, d: 0.8 },
  'Shadow Fen': { name: 'the Witch\'s Ring', a: 170, d: 0.8 },
  'Starfall Plateau': { name: 'the Crater Altar', a: 260, d: 0.8 },
  'Yggdrasil Gate': { name: 'the First Root', a: 30, d: 0.75 },
};

// one lore book per zone (3% of a level the first time you read it)
export const LORE_DEFS = {
  'Breezy Meadow': { title: 'A Shepherd\'s Almanac', a: 300, d: 0.35, text: 'The meadow winds blow toward the World Tree every morning and away from it every night. Old shepherds say the Tree breathes, and that the jellies are only its dreams escaping.' },
  'Mossveil Forest': { title: 'Notes of a Lost Ranger', a: 20, d: 0.4, text: 'Day nine. The moss grows thickest on the side facing the Hollow Giant, not the north. I trusted the moss. I should have trusted the stars.' },
  'Elder Ruins': { title: 'The Fall of Carlyle\'s First Keep', a: 180, d: 0.35, text: 'The elders built their walls to keep the wilds out. The wilds came anyway, slowly, root by root, until the walls were only stones that remembered being walls.' },
  'World Tree Overlook': { title: 'Hymn of the Overlook', a: 260, d: 0.35, text: 'Climb to see the Tree, climb to see the sea, climb until the climbing is the reason. So sang the pilgrims, before the trials were set at every twentieth step.' },
  'Sunpetal Plains': { title: 'The Golden Harvest Ledger', a: 160, d: 0.4, text: 'Three hundred sacks of sunwheat, eleven jars of honey, one very angry bee queen. Note to self: ask the bees next year.' },
  'Whispering Marsh': { title: 'What the Reeds Say', a: 90, d: 0.4, text: 'If you lie still in the marsh at dusk, the reeds whisper the names of everyone who drowned here. Most of the names are frogs. Some of them are not.' },
  'Ember Canyon': { title: 'Forgemaster\'s Oath', a: 260, d: 0.4, text: 'Steel remembers the hand that folded it. Fold it a thousand times and it will remember you a thousand times. Fold it carelessly and it remembers that too.' },
  'Frostpeak Highlands': { title: 'The Yeti\'s Lullaby', a: 180, d: 0.4, text: 'Hush, little one, the storm is only the mountain snoring. Sleep, and the snow will cover your tracks so the hunters never find you.' },
  'Crystal Wilds': { title: 'On the Singing of Stones', a: 80, d: 0.4, text: 'Each crystal hums one note. Stand among enough of them and you will hear a song older than language, a song the world sang while it was cooling.' },
  'Shadow Fen': { title: 'A Warning, Scratched in Bark', a: 60, d: 0.4, text: 'DO NOT FOLLOW THE GREEN LANTERNS. THEY ARE NOT LANTERNS.' },
  'Starfall Plateau': { title: 'Star Chart of the Observatory', a: 170, d: 0.4, text: 'The star that fell here was the brightest in the sky. The sky has felt dimmer since, and the astronomers argue whether the star fell, or was pulled.' },
  'Yggdrasil Gate': { title: 'The Ascendant\'s Testament', a: 260, d: 0.35, text: 'I passed every wall. I cleared every trial. At the top there was no crown, only a mirror, and in the mirror, everyone who climbed before me, waiting.' },
};

// Survey Maps: one per zone, copied by players with Survival mastery 20+, tradable, reveal the zone when read
export const SURVEY_MIN_MASTERY = 20;
export const SURVEY_COVER = 0.6; // share of the zone's ground you must have uncovered to copy its map
export const zoneKey = (name) => name.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
