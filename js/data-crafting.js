// Gathering tools and costume tailoring. Pure data, merged into ITEMS / MATERIALS / SMITHING at load.
import { TIER_REQ } from './data-world.js';

// ---------------------------------------------------------------- gathering tools
// You need an Axe for trees, a Pickaxe for ore and a Sickle for herbs. A tool gathers nodes up to its own tier
// (Copper: tier 1 nodes ... Starmetal: tier 5) and works faster on lower tiers. Each kind has its own slot on the tool
// belt above the skill bar (outside the bag); the tool there is used and shows in your hands while you gather.
export const TOOL_TIERS = ['Copper', 'Iron', 'Silver', 'Mithril', 'Starmetal'];
export const TOOL_METAL = ['#d8884a', '#b8c0cc', '#eef3fb', '#7ae8ff', '#ffd84a'];
export const TOOL_KINDS = {
  axe: { node: 'tree', name: 'Axe', verb: 'Chopping', anim: 'chop' },
  pick: { node: 'ore', name: 'Pickaxe', verb: 'Mining', anim: 'mine' },
  sickle: { node: 'herb', name: 'Sickle', verb: 'Harvesting', anim: 'harvest' },
};
export const TOOL_FOR_NODE = { tree: 'axe', ore: 'pick', herb: 'sickle' };
export const toolId = (kind, tier) => `tool_${kind}_${tier}`;
export const NODE_WORD = { axe: 'trees', pick: 'ore veins', sickle: 'herbs' };
export const TOOL_ITEMS = {};
for (const [kind, K] of Object.entries(TOOL_KINDS)) TOOL_TIERS.forEach((metal, t) => {
  TOOL_ITEMS[toolId(kind, t)] = {
    name: `${metal} ${K.name}`, icon: toolId(kind, t), type: 'tool', tool: kind, tier: t, quality: t, stack: 1, price: [60, 450, 1800, 6000, 15000][t],
    desc: `Gathering tool for ${NODE_WORD[kind]} up to tier ${t + 1}. Better tools work faster and find more. A better tool goes straight onto your tool belt; use a spare from the bag to swap it in.`,
  };
});
// Gorm forges each tier from the one before it, plus ore for the head and logs for the haft
const ORE = ['ore_copper', 'ore_iron', 'ore_silver', 'ore_mithril', 'ore_starmetal'], WOOD = ['wood_oak', 'wood_maple', 'wood_ironwood', 'wood_frostpine', 'wood_starwood'];
export const TOOL_RECIPES = [];
for (const kind of Object.keys(TOOL_KINDS)) TOOL_TIERS.forEach((metal, t) => {
  TOOL_RECIPES.push({ id: 'st_' + toolId(kind, t), tool: toolId(kind, t), from: t ? toolId(kind, t - 1) : null, name: TOOL_ITEMS[toolId(kind, t)].name,
    mats: { [ORE[t]]: 4 + 2 * t, [WOOD[t]]: 2 + t }, gold: [100, 900, 4000, 12000, 30000][t], lv: t ? Math.max(1, TIER_REQ[t] - 10) : 1, exp: 15 + 20 * t });
});
export const STARTER_TOOLS = [toolId('axe', 0), toolId('pick', 0), toolId('sickle', 0)];

// ---------------------------------------------------------------- tailoring (costumes from ingredients, at Coco)
// Cloth and feathers drop from monsters (higher levels drop finer cloth); dyes are mixed from herbs and crops.
// [name, quality, price, description]
export const TAILOR_MATS = {
  tl_linen: ['Linen Bolt', 0, 40, 'Soft woven linen for costumes. Dropped by monsters up to Lv 60; Coco sells it too.'],
  tl_silk: ['Silk Thread', 1, 160, 'Fine thread for stitching costumes. Dropped by monsters from Lv 20; Coco sells it too.'],
  tl_feather: ['Fluffy Feather', 1, 120, 'A light feather for costume wings. Dropped by monsters from Lv 10.'],
  tl_velvet: ['Starlit Velvet', 3, 900, 'Shimmering velvet for royal costumes. Dropped by monsters from Lv 80, more often by elites, bosses and in the Danger Zone.'],
  tl_dye_rose: ['Rose Dye', 1, 140, 'Pink and red costume dye. Mixed at Coco from strawberries and firepetals.'],
  tl_dye_sky: ['Sky Dye', 1, 140, 'Blue and white costume dye. Mixed at Coco from moonbloom and moonmelon.'],
  tl_dye_gold: ['Gold Dye', 2, 220, 'Yellow and orange costume dye. Mixed at Coco from sunfruit and silver ore.'],
  tl_dye_leaf: ['Leaf Dye', 1, 120, 'Green costume dye. Mixed at Coco from silverleaf and oak.'],
  tl_dye_shadow: ['Shadow Dye', 2, 220, 'Dark and violet costume dye. Mixed at Coco from glow spores and ironwood.'],
};
export const DYES = [
  { id: 'tl_dye_rose', mats: { crop_strawberry: 2, herb_firepetal: 1 }, gold: 150 },
  { id: 'tl_dye_sky', mats: { herb_moonbloom: 2, crop_moonmelon: 1 }, gold: 150 },
  { id: 'tl_dye_gold', mats: { crop_sunfruit: 1, ore_silver: 1 }, gold: 250 },
  { id: 'tl_dye_leaf', mats: { herb_silverleaf: 3, wood_oak: 1 }, gold: 100 },
  { id: 'tl_dye_shadow', mats: { glow_spore: 3, wood_ironwood: 1 }, gold: 250 },
];
// which dye a costume color needs
function dyeFor(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  if (l < 0.25) return 'tl_dye_shadow';
  if (s < 0.18) return 'tl_dye_sky';
  let hue = mx === r ? 60 * (((g - b) / (mx - mn)) % 6) : mx === g ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - g) / (mx - mn) + 4);
  if (hue < 0) hue += 360;
  return hue < 20 || hue >= 300 ? 'tl_dye_rose' : hue < 65 ? 'tl_dye_gold' : hue < 170 ? 'tl_dye_leaf' : hue < 255 ? 'tl_dye_sky' : 'tl_dye_shadow';
}
// the pattern for a costume: cloth or feathers, thread, its two colors, and velvet for the finest ones
export function costumeRecipe(c) {
  const mats = {}, add = (k, n) => { mats[k] = (mats[k] || 0) + n; };
  const fine = !!c.price?.diamonds, rare = !!c.src;
  if (c.slot === 'back') { add('tl_feather', 12); add('tl_silk', 4); add(dyeFor(c.c1), 2); }
  else if (c.slot === 'head') { add('tl_linen', 3); add('tl_silk', 2); add(dyeFor(c.c1), 1); }
  else { add('tl_linen', 8); add('tl_silk', 4); add(dyeFor(c.c1), 2); add(dyeFor(c.c2), 1); }
  if (fine) { add('tl_velvet', 3); add('star_essence', 1); }
  if (rare) { add('tl_velvet', 5); add('star_essence', 3); }
  const gold = { back: 6000, head: 2500, outfit: 4000 }[c.slot] * (fine || rare ? 2 : 1);
  return { mats, gold };
}
// ingredient drop chances by monster level ([material, minLv, maxLv, chance])
export const TAILOR_DROPS = [['tl_linen', 1, 60, 0.05], ['tl_silk', 20, 999, 0.04], ['tl_feather', 10, 999, 0.03], ['tl_velvet', 80, 999, 0.025]];
