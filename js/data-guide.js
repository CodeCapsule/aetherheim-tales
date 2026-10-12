// The Crafter's Path: a short guide quest line that teaches gathering, farming, refining and forging one step at a time
// (shown in the quest tracker), and the guide pages in the Quest Log's Guide tab.
// A step finishes on a game event: gather_tree / gather_ore / gather_herb, plant, harvest, refine, smith, enhance.
// go: where the tracker's auto-path leads (a node kind, the farm plots, or an NPC id).

export const GUIDE = [
  { id: 'g1', sec: 'gather', name: 'Chop Some Wood', goal: 'Chop an Oak Tree', ev: 'gather_tree', n: 1, go: 'tree',
    tip: 'Walk to a tree and click it, or stand next to it and press 8 to swing your axe.', reward: { gold: 150, exp: 150 } },
  { id: 'g2', sec: 'gather', name: 'Into the Rock', goal: 'Mine a Copper Vein', ev: 'gather_ore', n: 1, go: 'ore',
    tip: 'Ore veins are grey rocks with glinting metal. Press 9 (pickaxe) beside one, or click it.', reward: { gold: 150, exp: 150 } },
  { id: 'g3', sec: 'gather', name: 'Green Fingers', goal: 'Pick some Silverleaf', ev: 'gather_herb', n: 1, go: 'herb',
    tip: 'Herbs grow low to the ground. Press 0 (sickle) beside one, or click it.', reward: { gold: 150, exp: 150, items: [['seed_wheat', 4]] } },
  { id: 'g4', sec: 'farm', name: 'A Seed in the Soil', goal: 'Plant a seed on your homestead', ev: 'plant', n: 1, go: 'farm',
    tip: 'Your plots are right behind Tilly the Farmer, west of town. Click an empty plot to plant the Wheat Seeds you just got.', reward: { gold: 100, exp: 120 } },
  { id: 'g5', sec: 'farm', name: 'Harvest Time', goal: 'Water and harvest a crop', ev: 'harvest', n: 1, go: 'farm',
    tip: 'Click the plot once to water it (25% faster). Wheat ripens in about 2 minutes; click the ripe plot to harvest.', reward: { gold: 1000, exp: 200, mats: { enh_stone: 5 } } },
  { id: 'g6', sec: 'refine', name: 'Stronger Stones', goal: 'Refine Enhancement Stones at Gorm', ev: 'refine', n: 1, go: 'gorm',
    tip: 'Talk to Gorm the Blacksmith, choose Open the Forge and press Refine at the bottom of the Enhance tab: 5 Enhancement Stones and 1,000 Gold make a Greater Enhancement Stone.', reward: { gold: 300, exp: 250 } },
  { id: 'g7', sec: 'forge', name: 'Fire and Hammer', goal: 'Smith a piece of Copper Gear', ev: 'smith', n: 1, go: 'gorm',
    tip: 'Gather 6 Copper Ore and 2 Oak Logs, then talk to Gorm and choose Smithing. Copper Gear costs 300 Gold.', reward: { gold: 500, exp: 400, mats: { enh_stone: 2 } } },
  { id: 'g8', sec: 'forge', name: 'A Keener Edge', goal: 'Enhance a piece of gear', ev: 'enhance', n: 1, go: 'gorm',
    tip: 'At Gorm\'s Forge (Enhance tab) pick your new gear and press Enhance. +1 to +5 use Enhancement Stones.', reward: { gold: 800, exp: 500, items: [['fertilizer', 2]] } },
];

// the Guide tab: one page per craft, in the order the quest line teaches them
export const GUIDE_PAGES = [
  { sec: 'gather', title: 'Gathering', icon: 'mining', where: 'Anywhere in the world · Professions window (Z)', steps: [
    'Your tool belt sits above the skill bar: axe (8), pickaxe (9) and sickle (0). A better tool gathers faster and finds more.',
    'Trees give logs (Logging), ore veins give ore (Mining) and herbs give herbs (Herbalism).',
    'Click a node, or stand next to it and press its tool key. Each node gives 3 harvests, then regrows in about a minute.',
    'Rarer nodes need more skill: Copper, Silverleaf and Oak at Lv 1; Iron, Moonbloom and Maple at Lv 15; Silver, Firepetal and Ironwood at Lv 35; Mithril, Frostlily and Frostpine at Lv 60; Starmetal, Starlotus and Starwood at Lv 85. The rare ones grow in the outer zones.',
    'Lucky finds: ore can hold a Gem Pouch, herbs drop seeds and trees drop Fertilizer. Materials go to your pouch and never take bag space.',
    'Gorm forges better tools in his Smithing window.',
  ] },
  { sec: 'farm', title: 'Farming', icon: 'farming', where: 'Your homestead, west of Sylvan Haven · Tilly the Farmer', steps: [
    'Your homestead has 8 plots right behind Tilly the Farmer. Tilly sells seeds and Fertilizer.',
    'Click an empty plot to plant your best seed, or open Professions › Farm to choose one.',
    'Click a growing plot to water it once: the time left drops by 25%. Fertilizer halves what is left.',
    'Crops grow in real time, even while you are offline: Wheat 2 minutes, Carrot 4, Strawberry 8, Pumpkin 15, Moonmelon 30, Sunfruit 60 and Starberry 120.',
    'Click a ripe plot to harvest. Crops go into Vera\'s potions and campfire cooking, and there is a 35% chance to get a seed back.',
    'Farming level unlocks better seeds: Carrot at Lv 5, Strawberry 12, Pumpkin 20, Moonmelon 35, Sunfruit 50 and Starberry 70.',
  ] },
  { sec: 'refine', title: 'Refining', icon: 'enh_stone', where: 'Gorm the Blacksmith · Open the Forge › Enhance', steps: [
    'Enhancement Stones drop from monsters and dungeons, and Hilda the Quartermaster sells them.',
    'Talk to Gorm and choose Open the Forge. The Refine buttons sit at the bottom of the Enhance tab.',
    '5 Enhancement Stones and 1,000 Gold refine into 1 Greater Enhancement Stone (for +6 to +10). 5 Greater stones and 5,000 Gold make 1 Divine Enhancement Stone (for +11 to +15).',
    'Salvage gear you no longer need (Forge › Salvage): it breaks down into Spirit Dust, and better gear also gives Spirit Shards and Star Essence. Socketed gems come back to you.',
    'Repair worn gear (Forge › Repair) before it breaks: broken gear gives no stats until it is repaired.',
  ] },
  { sec: 'forge', title: 'Forging', icon: 'forge', where: 'Gorm the Blacksmith · Smithing and the Forge', steps: [
    'Talk to Gorm and choose Smithing. Each recipe turns ore, logs and Gold into a random piece of gear for your level.',
    'Copper Gear: 6 Copper Ore, 2 Oak Logs and 300 Gold (Smithing Lv 1, Uncommon). Iron Gear: 8 Iron Ore, 3 Maple Logs and 1,200 Gold (Lv 15, Rare). Silver, Mithril and Starmetal gear need rarer ore and logs plus Spirit Shards or Star Essence.',
    'Sometimes the hammer sings: a Masterwork comes out one tier better.',
    'Forge › Craft makes gear and supplies from monster materials such as Spirit Dust and Wolf Fangs.',
    'Forge › Enhance raises gear from +1 to +15 with Enhancement Stones; +5, +10 and +15 add bonus steps. Forge › Upgrade reforges bonuses, re-tempers old gear to your level and ascends it to a higher tier.',
    'Socket gems with Opal at the Gem Workshop.',
  ] },
];
