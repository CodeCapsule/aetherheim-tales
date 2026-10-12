// Breakthrough trials (one wall every 20 levels plus the Final Ascension), the Trial Sigils that open them, and
// cooking (the only healing inside the Hunger trial). Pure data; trials.js runs it.

// kind drives the encounter in trials.js; time = limit in seconds (if any)
export const TRIALS = [
  { n: 1, lv: 20, name: 'The Gate Warden', challenge: 'Duel a guard who telegraphs every attack', tests: 'Basic dodge and block timing', title: 'Gatebreaker', aura: '#e8c070', theme: 'crypt', kind: 'duel' },
  { n: 2, lv: 40, name: 'Lost Road', challenge: 'Reach a shrine across an unmapped valley in 15 minutes', tests: 'Navigation without markers', title: 'Pathfinder', aura: '#8ad04a', theme: 'marsh', kind: 'road', time: 900 },
  { n: 3, lv: 60, name: 'Twin Blades', challenge: 'Two enemies attacking in alternating rhythm', tests: 'Target switching, crowd control', title: 'Twinbane', aura: '#ff7ab8', theme: 'ember', kind: 'twins' },
  { n: 4, lv: 80, name: 'Hunger', challenge: 'Survive 20 minutes with no potions; craft and cook only', tests: 'Survival mastery', title: 'Unbroken', aura: '#ffb05a', theme: 'frost', kind: 'hunger', time: 1200 },
  { n: 5, lv: 100, name: 'The Mirror', challenge: 'Fight a copy of your own character and build', tests: 'Knowing your own class', title: 'Mirrorbreaker', aura: '#9ae8ff', theme: 'crystal', kind: 'mirror' },
  { n: 6, lv: 120, name: 'Ashen Labyrinth', challenge: 'Shifting maze with traps and a hidden exit', tests: 'Observation, memory', title: 'Mazewalker', aura: '#c8c0b0', kind: 'maze', time: 900 },
  { n: 7, lv: 140, name: 'Stormcaller', challenge: 'Boss with area attacks that change every phase', tests: 'Pattern reading', title: 'Stormbreaker', aura: '#b8a8ff', theme: 'frost', kind: 'storm' },
  { n: 8, lv: 160, name: 'Gauntlet', challenge: 'Five bosses back to back, no healing between', tests: 'Endurance, resource use', title: 'Gauntlet Victor', aura: '#ff5a3a', theme: 'ember', kind: 'gauntlet' },
  { n: 9, lv: 180, name: 'The Silent Keeper', challenge: 'Boss with no visual tells, only sound cues', tests: 'Audio awareness, precision', title: 'Silent Hunter', aura: '#7a7aaa', theme: 'crypt', kind: 'silent' },
  { n: 10, lv: 200, name: 'Final Ascension', challenge: 'All previous mechanics combined in one fight', tests: 'Everything', title: 'Ascended', aura: '#ffffff', theme: 'crystal', kind: 'final' },
];
export const ROMAN_T = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'Final'];
export const trialLabel = (n) => (n === 10 ? 'Final Ascension' : `Trial ${ROMAN_T[n]}`);

// Trial Sigils: crafted at the Trial Warden from what grows and is mined in that bracket's zones
const ORE = ['ore_copper', 'ore_iron', 'ore_silver', 'ore_mithril', 'ore_starmetal'];
const WOOD = ['wood_oak', 'wood_maple', 'wood_ironwood', 'wood_frostpine', 'wood_starwood'];
const HERB = ['herb_silverleaf', 'herb_moonbloom', 'herb_firepetal', 'herb_frostlily', 'herb_starlotus'];
export const SIGILS = TRIALS.map((T) => {
  const t = Math.min(4, Math.floor((T.n - 1) / 2));
  const mats = { [ORE[t]]: 4 + T.n, [WOOD[t]]: 4 + T.n, [HERB[t]]: 3 + T.n, spirit_dust: 5 * T.n };
  if (T.n >= 6) mats.star_essence = T.n - 5;
  return { id: `sigil_${T.n}`, n: T.n, mats, gold: 1500 * T.n * T.n };
});
export const SIGIL_ITEMS = Object.fromEntries(SIGILS.map((s) => [s.id, {
  name: `Trial Sigil ${ROMAN_T[s.n] === 'Final' ? '· Final' : ROMAN_T[s.n]}`, icon: s.id, type: 'sigil', quality: Math.min(6, 1 + Math.floor(s.n / 2)), stack: 99, price: 0, bound: true,
  desc: `Opens ${trialLabel(s.n)} at the Trial Warden. One attempt; a failed attempt keeps your XP and mastery but uses the sigil. Also pays for switching your awakening path.`,
}]));

// ---------------------------------------------------------------- cooking (at any campfire)
// raw meat drops from beasts (a material); the rest is farmed or gathered. Food heals over time and may grant a buff.
export const RAW_MEAT = { name: 'Raw Meat', icon: 'raw_meat', quality: 0, price: 8, desc: 'Fresh from a beast. Cook it at a campfire.' };
export const FOOD_ITEMS = {
  food_skewer: { name: 'Grilled Skewer', icon: 'food_skewer', type: 'food', quality: 0, stack: 50, price: 20, heal: [0.3, 10], desc: 'Restores 30% HP over 10 seconds.' },
  food_bread: { name: 'Hearth Bread', icon: 'food_bread', type: 'food', quality: 1, stack: 50, price: 30, heal: [0.25, 8], buff: { stamina: 1.3 }, desc: 'Restores 25% HP over 8 seconds and stamina recovers 30% faster for 2 minutes.' },
  food_stew: { name: 'Hunter\'s Stew', icon: 'food_stew', type: 'food', quality: 1, stack: 50, price: 60, heal: [0.5, 12], desc: 'Restores 50% HP over 12 seconds.' },
  food_pie: { name: 'Berry Pie', icon: 'food_pie', type: 'food', quality: 2, stack: 50, price: 90, heal: [0.35, 8], buff: { atk: 1.08 }, desc: 'Restores 35% HP over 8 seconds and +8% Attack for 2 minutes.' },
  food_feast: { name: 'Moonmelon Feast', icon: 'food_feast', type: 'food', quality: 3, stack: 50, price: 220, heal: [0.8, 12], buff: { def: 1.1 }, desc: 'Restores 80% HP over 12 seconds and +10% Defense for 2 minutes.' },
  food_starsoup: { name: 'Starberry Soup', icon: 'food_starsoup', type: 'food', quality: 4, stack: 50, price: 500, heal: [1, 10], buff: { atk: 1.1, def: 1.1 }, desc: 'Restores all HP over 10 seconds and +10% Attack and Defense for 2 minutes.' },
};
export const COOKING = [
  { id: 'ck_skewer', out: 'food_skewer', ins: { raw_meat: 2 }, tier: 1 },
  { id: 'ck_bread', out: 'food_bread', ins: { crop_wheat: 3 }, tier: 1 },
  { id: 'ck_stew', out: 'food_stew', ins: { raw_meat: 2, crop_carrot: 2, herb_silverleaf: 1 }, tier: 2 },
  { id: 'ck_pie', out: 'food_pie', ins: { crop_strawberry: 3, crop_wheat: 2 }, tier: 2 },
  { id: 'ck_feast', out: 'food_feast', ins: { crop_moonmelon: 2, raw_meat: 3, herb_moonbloom: 2 }, tier: 3 },
  { id: 'ck_starsoup', out: 'food_starsoup', ins: { crop_starberry: 2, crop_sunfruit: 1, herb_starlotus: 1 }, tier: 4 },
];
// campfires in the open world (town square, homestead, outposts are added from their positions)
export const CAMPFIRES = [{ x: 4, z: 30 }, { x: -52, z: 30 }];

// trial monsters: copies of existing monsters (from) with their own names and AI; stats are set when they spawn
export const TRIAL_MONSTER_DEFS = {
  tr_warden: { from: 'rival', name: 'The Gate Warden', boss: true, trialAI: 'duel', speed: 5, range: 2.8, height: 2.6, scale: 1.25, look: 'warden' },
  tr_bog: { from: 'bogcroaker', name: 'Valley Croaker' },
  tr_snap: { from: 'miresnapper', name: 'Valley Snapper' },
  tr_sol: { from: 'rival', name: 'Sol, the Red Blade', boss: true, trialAI: 'twin', speed: 6, range: 2.6, scale: 1.1, look: 'sol' },
  tr_luna: { from: 'rival', name: 'Luna, the Blue Blade', boss: true, trialAI: 'twin', speed: 6, range: 2.6, scale: 1.1, look: 'luna' },
  tr_hwolf: { from: 'wolf', name: 'Starving Wolf' },
  tr_hyeti: { from: 'yeti', name: 'Ravenous Yeti', elite: true },
  tr_mirror: { from: 'rival', name: 'Your Reflection', boss: true, trialAI: 'mirror', speed: 7, range: 2.6, look: 'mirror' },
  tr_ash: { from: 'fenwraith', name: 'Ash Wraith' },
  tr_storm: { from: 'morvath', name: 'The Stormcaller', boss: true, trialAI: 'storm' },
  tr_g1: { from: 'queenjelly', name: 'Gauntlet I · Queen of Slime', boss: true, trialAI: 'gauntlet' },
  tr_g2: { from: 'gravelord', name: 'Gauntlet II · Grave Colossus', boss: true, trialAI: 'gauntlet' },
  tr_g3: { from: 'mirehydra', name: 'Gauntlet III · Mire Hydra', boss: true, trialAI: 'gauntlet' },
  tr_g4: { from: 'colossusprime', name: 'Gauntlet IV · Prime Colossus', boss: true, trialAI: 'gauntlet' },
  tr_g5: { from: 'fenrir', name: 'Gauntlet V · The Chained Wolf', boss: true, trialAI: 'gauntlet' },
  tr_silent: { from: 'necrowraith', name: 'The Silent Keeper', boss: true, trialAI: 'silent', scale: 2.2, height: 4.6, range: 3.6, speed: 4.4 },
  tr_ascendant: { from: 'fallenseraph', name: 'The Ascendant', boss: true, trialAI: 'final', scale: 2, height: 6, range: 3.6, speed: 5 },
};
