// Data for the live systems: missions, guilds, guild wars, world bosses, materials, crafting, market, gear progression,
// seasons, festival events and leaderboards. Pure data + small pure helpers (no three.js, no DOM).
import { NEW_MATERIALS, RELICS, NEW_MONSTERS, DUNGEON_MONSTERS, GATHER } from './data-world.js';
import { TAILOR_MATS } from './data-crafting.js';
import { RAW_MEAT } from './data-trials.js';
import { ELEMENTS, crystalId, INFUSE_CRYSTALS } from './data-elements.js';

// ---------------------------------------------------------------- time keys (UTC, so every reset happens at 00:00 UTC)
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}
export function secsToDayEnd(d = new Date()) { return (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - d) / 1000; }
export function secsToWeekEnd(d = new Date()) { const day = d.getUTCDay() || 7; return secsToDayEnd(d) + (7 - day) * 86400; }
function secsToMonthEnd(d = new Date()) { return (Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - d) / 1000; }
export function monthProgress(d = new Date()) {
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return (d - a) / (b - a);
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng32(seed) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffled(arr, rand) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const fmtDur = (s) => {
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- materials & gems (kept in a separate pouch, S.mats)
export const GEMS = {
  ruby: { name: 'Ruby', stat: 'atk', vals: [6, 14, 30, 120, 320], label: (v) => `+${v} Attack`, color: '#ff4a5a' },
  sapphire: { name: 'Sapphire', stat: 'def', vals: [5, 11, 24, 90, 240], label: (v) => `+${v} Defense`, color: '#4a8aff' },
  emerald: { name: 'Emerald', stat: 'hp', vals: [70, 160, 340, 1400, 3600], label: (v) => `+${v} Max HP`, color: '#3ad87a' },
  topaz: { name: 'Topaz', stat: 'crit', vals: [1, 2, 3.5, 5, 7], label: (v) => `+${v}% Critical`, color: '#ffc83a' },
  // arcane gems: rarer, and they grant the special stats normally found only as affixes
  amethyst: { name: 'Amethyst', stat: 'critDmg', vals: [4, 8, 14, 22, 32], label: (v) => `+${v}% Crit Damage`, color: '#b46aff', arcane: true },
  onyx: { name: 'Onyx', stat: 'lifesteal', vals: [0.6, 1.2, 2, 3, 4.5], label: (v) => `+${v}% Lifesteal`, color: '#9a8ab8', arcane: true },
  opal: { name: 'Opal', stat: 'cdr', vals: [1, 2, 3.5, 5, 7], label: (v) => `-${v}% Cooldowns`, color: '#ffc8f0', arcane: true },
  aquamarine: { name: 'Aquamarine', stat: 'speed', vals: [1.5, 3, 4.5, 6, 8], label: (v) => `+${v}% Move Speed`, color: '#6ae8e0', arcane: true },
  garnet: { name: 'Garnet', stat: 'thorns', vals: [3, 6, 10, 15, 22], label: (v) => `Reflect ${v}% damage taken`, color: '#e83a50', arcane: true },
  jade: { name: 'Jade', stat: 'regen', vals: [3, 8, 20, 45, 90], label: (v) => `+${v} HP per second`, color: '#3ab86a', arcane: true },
  moonstone: { name: 'Moonstone', stat: 'expGain', vals: [3, 6, 10, 15, 22], label: (v) => `+${v}% EXP Gain`, color: '#a8c0ff', arcane: true },
  citrine: { name: 'Citrine', stat: 'goldFind', vals: [5, 10, 16, 24, 35], label: (v) => `+${v}% Gold Find`, color: '#ffb02a', arcane: true },
};
export const GEM_LV = ['Chipped', 'Polished', 'Radiant', 'Brilliant', 'Celestial'];
export const GEM_MAX = 5;
export const gemId = (type, lv) => `gem_${type}_${lv}`;
export function parseGem(id) { const m = /^gem_([a-z]+)_([1-5])$/.exec(id || ''); return m && GEMS[m[1]] ? { type: m[1], lv: +m[2] } : null; }
// Soulstones: socketed like gems (one per item) and grant a named power.
export const SOULS = {
  crit_heal: 'Bloodbloom', chain: 'Stormcall', stun_chance: 'Earthshock', thorn_aura: 'Bramble Aura', swift: 'Zephyr Step', mana_font: 'Mana Font',
  meteor_proc: 'Ragnarok', phoenix: 'Phoenix Feather', frenzy: 'Frenzy', holy_nova: 'Holy Nova', starfall: 'Starfall', worldtree: 'Blessing of Yggdrasil',
  double_strike: 'Twin Fang', executioner: 'Executioner', giant_slayer: 'Giant Slayer',
};
export const soulId = (fx) => 'soul_' + fx;
export function parseSoul(id) { const m = /^soul_([a-z_]+)$/.exec(id || ''); return m && SOULS[m[1]] ? m[1] : null; }
export const SOUL_FORGE = { gems: 3, gemLv: 4, mats: { star_essence: 3 }, gold: 50000 };
export const SOCKET_MAX = 5, DRILL_MAX = 2; // sockets per item, extra sockets a Socket Drill can add
export const drillCost = (eq) => ({ gold: 5000 * ((eq.xs || 0) + 1) * (1 + eq.lvl / 50) | 0 });

// ---------------------------------------------------------------- enhancement (+1 to +15)
export const ENH_MAX = 15;
export const ENH_RATE = [1, 1, 1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.28, 0.22, 0.17, 0.12]; // chance to reach +1 ... +15
export const ENH_STONES = ['enh_stone', 'enh_stone2', 'enh_stone3'];
export const ENH_FAIL_BONUS = 0.05, ENH_FAIL_MAX = 0.25, ENH_LUCK = 0.15;
// Lucky Points: a failed attempt at +N gives LUCKY_GAIN[N - 1]; a Perfect Enhancement to +N (100% success, no stones)
// costs 10 x N of them
export const LUCKY_GAIN = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24];
export const perfectCost = (target) => 10 * target;
const enhTier = (target) => (target <= 5 ? 0 : target <= 10 ? 1 : 2);
export function enhCost(eq) {
  const L = (eq.enh || 0) + 1, t = enhTier(L);
  const n = t === 0 ? 1 + (L >> 1) : t === 1 ? L - 4 : L - 9;
  return { gold: Math.round(150 * L * L * (1 + eq.lvl / 25)), mats: { [ENH_STONES[t]]: n } };
}
export const enhRisk = (target) => (target >= 7 ? 1 : 0); // enhancement levels lost when an attempt at this target fails
export const REFINE = [{ from: 'enh_stone', to: 'enh_stone2', n: 5, gold: 1000 }, { from: 'enh_stone2', to: 'enh_stone3', n: 5, gold: 5000 }];

export const MATERIALS = {
  jelly_gel: { name: 'Jelly Gel', icon: 'jelly_gel', quality: 0, price: 18, desc: 'Wobbly gel from jellies. Brewed into potions.' },
  soft_fur: { name: 'Soft Fur', icon: 'soft_fur', quality: 0, price: 20, desc: 'A fluffy tuft from a Fluffbun.' },
  glow_spore: { name: 'Glow Spore', icon: 'glow_spore', quality: 1, price: 30, desc: 'Luminous spores from mushroom folk.' },
  wolf_fang: { name: 'Wolf Fang', icon: 'wolf_fang', quality: 1, price: 45, desc: 'A sharp fang wrapped in thorns.' },
  golem_core: { name: 'Golem Core', icon: 'golem_core', quality: 2, price: 90, desc: 'A rune-etched stone heart.' },
  heartwood: { name: 'Heartwood', icon: 'heartwood', quality: 2, price: 110, desc: 'Living wood from a treant.' },
  soul_ember: { name: 'Soul Ember', icon: 'soul_ember', quality: 2, price: 120, desc: 'A restless flame from the catacombs.' },
  spirit_dust: { name: 'Spirit Dust', icon: 'spirit_dust', quality: 1, price: 25, desc: 'Salvaged essence. Used to reforge and craft.' },
  spirit_shard: { name: 'Spirit Shard', icon: 'spirit_shard', quality: 3, price: 160, desc: 'A crystallised fragment of a Spirit. Used to ascend gear.' },
  star_essence: { name: 'Star Essence', icon: 'star_essence', quality: 4, price: 600, desc: 'Radiance from the stars. Needed for the mightiest upgrades.' },
  moon_candy: { name: 'Moon Candy', icon: 'moon_candy', quality: 2, price: 0, notrade: true, desc: 'Harvest Moon festival token. Spend it at the Festival Host.' },
  star_cookie: { name: 'Star Cookie', icon: 'star_cookie', quality: 2, price: 0, notrade: true, desc: 'Winter Starlight festival token.' },
  sakura_petal: { name: 'Sakura Petal', icon: 'sakura_petal', quality: 2, price: 0, notrade: true, desc: 'Sakura Bloom festival token.' },
};
for (const [type, g] of Object.entries(GEMS)) {
  g.vals.forEach((v, i) => {
    MATERIALS[gemId(type, i + 1)] = { name: `${GEM_LV[i]} ${g.name}`, icon: 'gem_' + type, quality: i + 2, price: Math.round([150, 600, 2200, 8000, 30000][i] * (g.arcane ? 1.6 : 1)), gem: { type, lv: i + 1 }, desc: `Socket into gear: ${g.label(v)}.` };
  });
}

for (const [fx, name] of Object.entries(SOULS)) MATERIALS[soulId(fx)] = { name: `${name} Soulstone`, icon: soulId(fx), quality: 5, price: 25000, soul: fx, desc: 'Socket into gear (one Soulstone per item) to gain its named power.' };
MATERIALS.enh_stone = { name: 'Enhancement Stone', icon: 'enh_stone', quality: 2, price: 400, desc: 'Enhances gear from +1 to +5. Five refine into a Greater stone.' };
MATERIALS.enh_stone2 = { name: 'Greater Enhancement Stone', icon: 'enh_stone2', quality: 3, price: 1600, desc: 'Enhances gear from +6 to +10.' };
MATERIALS.enh_stone3 = { name: 'Divine Enhancement Stone', icon: 'enh_stone3', quality: 4, price: 6000, desc: 'Enhances gear from +11 to +15.' };

// gathering / farm materials and dungeon collection relics
const MAT_DESC = { ore: 'Ore mined from a vein. Smelted into gear by Smithing.', herb: 'A wild herb for Alchemy.', wood: 'A log for Smithing.', crop: 'Farm produce for Alchemy and cooking.' };
for (const [id, [name, quality, price]] of Object.entries(NEW_MATERIALS)) MATERIALS[id] = { name, icon: id, quality, price, desc: MAT_DESC[id.split('_')[0]] || '' };
for (const [id, [name, quality, price, desc]] of Object.entries(TAILOR_MATS)) MATERIALS[id] = { name, icon: id, quality, price, desc };
MATERIALS.raw_meat = RAW_MEAT;
// element crystals: three infuse a weapon with their element at Gorm's forge (data-elements.js)
for (const [el, E] of Object.entries(ELEMENTS)) MATERIALS[crystalId(el)] = { name: E.crystal, icon: crystalId(el), quality: 3, price: 900, desc: `Gorm infuses a weapon with ${E.name} using ${INFUSE_CRYSTALS} of these: ${E.bonus}, and a ${E.name.toLowerCase()} glow.` };
for (const [id, r] of Object.entries(RELICS)) MATERIALS[id] = { name: r.name, icon: id, quality: 5, price: 4000, relic: r.dungeon, desc: 'A dungeon collection relic. Register it in the Collection and combine a full set of four into Red gear at the Forge.' };

// [material, chance, min, max] rolled when a tagged monster dies
export const MAT_DROPS = {
  jelly: [['jelly_gel', 0.45, 1, 2]], bunny: [['soft_fur', 0.45, 1, 2]], shroom: [['glow_spore', 0.4, 1, 2]], wolf: [['wolf_fang', 0.4, 1, 2]],
  golem: [['golem_core', 0.35, 1, 1]], treant: [['heartwood', 0.5, 1, 2], ['spirit_shard', 0.08, 1, 1]],
  boss: [['heartwood', 1, 3, 5], ['spirit_shard', 1, 2, 4], ['star_essence', 0.5, 1, 1]],
  cavejelly: [['jelly_gel', 0.5, 1, 2]], sporeling: [['glow_spore', 0.5, 1, 2]], mossbeast: [['heartwood', 0.6, 1, 2], ['spirit_shard', 0.2, 1, 1]],
  queenjelly: [['jelly_gel', 1, 4, 6], ['spirit_shard', 1, 1, 3], ['star_essence', 0.3, 1, 1]],
  boneknight: [['soul_ember', 0.35, 1, 1]], wisp: [['soul_ember', 0.5, 1, 1]], cryptgolem: [['golem_core', 0.8, 1, 2], ['spirit_shard', 0.25, 1, 1]],
  gravelord: [['golem_core', 1, 3, 5], ['spirit_shard', 1, 2, 4], ['star_essence', 0.5, 1, 1]],
  rootwolf: [['wolf_fang', 0.5, 1, 2]], blightspore: [['glow_spore', 0.5, 1, 2]], rottreant: [['heartwood', 0.8, 1, 2], ['spirit_shard', 0.3, 1, 1]],
  nidhogg: [['heartwood', 1, 4, 6], ['spirit_shard', 1, 3, 5], ['star_essence', 1, 1, 2]],
  rival: [['spirit_dust', 0.5, 1, 3]],
  behemoth: [['star_essence', 1, 1, 2], ['spirit_shard', 1, 3, 5]], pumpkinking: [['star_essence', 1, 1, 2], ['spirit_shard', 1, 3, 5]], frostbehemoth: [['star_essence', 1, 1, 2], ['spirit_shard', 1, 3, 5]],
};
// expanded-world monsters drop the raw materials of their zone tier, plus shards and essence higher up
for (const [id, m] of [...Object.entries(NEW_MONSTERS), ...Object.entries(DUNGEON_MONSTERS)]) {
  const t = Math.min(4, Math.floor(m.lvl[0] / 42)), big = m.boss ? 1 : m.elite ? 0.5 : 0;
  MAT_DROPS[id] = [[GATHER.ore.mats[t], 0.1 + big * 0.6, 1, 2 + big * 4], [GATHER.herb.mats[t], 0.1 + big * 0.6, 1, 2 + big * 4], [GATHER.tree.mats[t], 0.06 + big * 0.5, 1, 2 + big * 3], ['spirit_shard', 0.03 + big * 0.9, 1, 1 + big * 4]];
  if (m.lvl[0] >= 80) MAT_DROPS[id].push(['star_essence', 0.015 + big * 0.9, 1, 1 + big * 2]);
}

// ---------------------------------------------------------------- crafting (Gorm's Forge)
// out.item → ITEMS id, out.mat → MATERIALS id, gear → random gear of that tier for the chosen slot at your level
export const RECIPES = [
  { id: 'r_hp', name: 'Healing Draught x5', cat: 'supplies', out: { item: 'hp_potion', qty: 5 }, mats: { jelly_gel: 3, glow_spore: 1 }, gold: 60, lv: 1 },
  { id: 'r_mp', name: 'Mana Draught x5', cat: 'supplies', out: { item: 'mp_potion', qty: 5 }, mats: { soft_fur: 2, glow_spore: 2 }, gold: 60, lv: 1 },
  { id: 'r_pouch', name: 'Gem Pouch', cat: 'supplies', out: { item: 'gem_pouch', qty: 1 }, mats: { spirit_dust: 10, spirit_shard: 1 }, gold: 200, lv: 5 },
  { id: 'r_egg', name: 'Mystery Pet Egg', cat: 'supplies', out: { item: 'pet_egg', qty: 1 }, mats: { soft_fur: 8, heartwood: 2 }, gold: 400, lv: 5 },
  { id: 'r_scroll', name: 'Scroll of Wisdom', cat: 'supplies', out: { item: 'exp_scroll', qty: 1 }, mats: { soul_ember: 2, spirit_dust: 6 }, gold: 300, lv: 8 },
  { id: 'r_ticket', name: 'Dungeon Ticket', cat: 'supplies', out: { item: 'dungeon_ticket', qty: 1 }, mats: { spirit_shard: 3, golem_core: 2 }, gold: 500, lv: 6 },
  { id: 'r_shard', name: 'Spirit Shard', cat: 'supplies', out: { mat: 'spirit_shard', qty: 1 }, mats: { spirit_dust: 12, wolf_fang: 2 }, gold: 250, lv: 6 },
  { id: 'g_rare', name: 'Forge Rare Gear', cat: 'gear', gear: { quality: 2, up: 0.12 }, mats: { spirit_dust: 8, wolf_fang: 3 }, gold: 400, lv: 4 },
  { id: 'g_special', name: 'Forge Special Gear', cat: 'gear', gear: { quality: 3, up: 0.06 }, mats: { spirit_shard: 4, golem_core: 3, heartwood: 2 }, gold: 1500, lv: 10 },
  { id: 'g_unique', name: 'Forge Unique Gear', cat: 'gear', gear: { quality: 4, up: 0.03 }, mats: { star_essence: 2, spirit_shard: 10, soul_ember: 6 }, gold: 6000, lv: 14 },
];

// ---------------------------------------------------------------- gear progression
export const SOCKETS = [0, 1, 1, 2, 2, 3, 3, 3]; // sockets per rarity tier (Common ... Ancient)
export const GEM_COMBINE = [null, { gold: 300 }, { gold: 1200 }, { gold: 5000 }, { gold: 20000 }]; // 3x level n -> 1x level n+1 (index = n)
export const ASCEND = [ // indexed by current quality
  { to: 1, mats: { spirit_dust: 4 }, gold: 200 },
  { to: 2, mats: { spirit_dust: 8, spirit_shard: 1 }, gold: 800 },
  { to: 3, mats: { spirit_shard: 4, golem_core: 2, ore_silver: 6 }, gold: 3000 }, // materials from the next tier's lands
  { to: 4, mats: { spirit_shard: 10, star_essence: 3, ore_mithril: 6 }, gold: 15000 },
  { to: 5, mats: { spirit_shard: 20, star_essence: 6, ore_starmetal: 8 }, gold: 50000 },
];
export const reforgeCost = (eq) => ({ mats: { spirit_dust: 3 + eq.quality * 3, ...(eq.quality >= 4 ? { spirit_shard: eq.quality - 2 } : {}) }, gold: 150 * (eq.quality + 1) * (1 + eq.lvl / 10) | 0 });
export const retemperCost = (eq, lvl) => ({ mats: { spirit_dust: Math.max(2, (lvl - eq.lvl) * 2) }, gold: Math.round(90 * (lvl - eq.lvl) * (eq.quality + 1)) });
export function salvageYield(eq) {
  const q = eq.quality, out = {};
  const add = (k, n) => { if (n > 0) out[k] = (out[k] || 0) + n; };
  add('spirit_dust', [1, 2, 4, 6, 4, 6, 10][q] + Math.floor(eq.lvl / 8) + (eq.enh || 0));
  if (q >= 2) add('spirit_shard', [0, 0, 0, 1, 3, 5, 8][q]);
  if (q >= 4) add('star_essence', q === 6 ? 3 : q === 5 ? 1 : 0);
  return out;
}
export const CODEX_MILESTONES = [
  { n: 3, reward: { diamonds: 50 }, label: '50 Diamonds' },
  { n: 6, reward: { mats: { star_essence: 2 } }, label: '2 Star Essence' },
  { n: 10, reward: { diamonds: 150, title: 'Codex Keeper' }, label: '150 Diamonds + title' },
  { n: 15, reward: { items: [['legend_cache', 1]] }, label: 'Legendary Cache' },
  { n: 21, reward: { diamonds: 500, title: 'Lorekeeper of Hiraya' }, label: '500 Diamonds + title' },
];

// ---------------------------------------------------------------- daily & weekly missions
// ev = tracked event name; n = target; pts = activity points; lv = level needed for it to be offered
export const DAILY_POOL = [
  { id: 'd_kill', name: 'Monster Hunter', desc: 'Defeat {n} monsters', ev: 'kill', n: 40, pts: 20, lv: 1, reward: { gold: 500 } },
  { id: 'd_online', name: 'Stay a While', desc: 'Adventure for {n} minutes', ev: 'online', n: 15, pts: 15, lv: 1, reward: { items: [['hp_potion', 5]] } },
  { id: 'd_skill', name: 'Practice Makes Perfect', desc: 'Cast skills {n} times', ev: 'skill', n: 50, pts: 10, lv: 1, reward: { gold: 300 } },
  { id: 'd_gold', name: 'Coin Collector', desc: 'Loot {n} Gold from monsters', ev: 'gold', n: 1200, pts: 10, lv: 1, reward: { mats: { spirit_dust: 3 } } },
  { id: 'd_enhance', name: "Smith's Apprentice", desc: 'Enhance or upgrade gear {n} times', ev: 'enhance', n: 3, pts: 15, lv: 2, reward: { mats: { spirit_dust: 4 } } },
  { id: 'd_feed', name: 'Pet Pampering', desc: 'Feed your pets {n} times', ev: 'feed', n: 2, pts: 10, lv: 3, reward: { gold: 400 } },
  { id: 'd_craft', name: 'Crafter', desc: 'Craft {n} items at the Forge', ev: 'craft', n: 2, pts: 15, lv: 3, reward: { mats: { glow_spore: 3 } } },
  { id: 'd_salvage', name: 'Recycler', desc: 'Salvage {n} pieces of gear', ev: 'salvage', n: 3, pts: 10, lv: 3, reward: { gold: 400 } },
  { id: 'd_loot', name: 'Treasure Seeker', desc: 'Loot {n} Rare or better items', ev: 'lootRare', n: 2, pts: 15, lv: 4, reward: { mats: { spirit_dust: 4 } } },
  { id: 'd_dungeon', name: 'Delver', desc: 'Clear a dungeon', ev: 'dungeon', n: 1, pts: 25, lv: 4, reward: { diamonds: 10 } },
  { id: 'd_market', name: 'Trader', desc: 'Buy or sell {n} times at the Market', ev: 'trade', n: 2, pts: 15, lv: 5, reward: { gold: 600 } },
  { id: 'd_donate', name: 'Guild Spirit', desc: 'Donate to your guild', ev: 'donate', n: 1, pts: 15, lv: 5, reward: { gold: 500 } },
  { id: 'd_bounty', name: 'Bounty Board', desc: 'Complete a bounty for Captain Elena', ev: 'bounty', n: 1, pts: 20, lv: 6, reward: { diamonds: 5 } },
  { id: 'd_wboss', name: 'Titan Hunter', desc: 'Fight in a World Boss battle', ev: 'worldboss', n: 1, pts: 25, lv: 8, reward: { mats: { spirit_shard: 1 } } },
  { id: 'd_elite', name: 'Elite Slayer', desc: 'Defeat {n} elite or boss monsters', ev: 'killElite', n: 3, pts: 20, lv: 9, reward: { mats: { spirit_shard: 1 } } },
  { id: 'd_war', name: 'For the Guild!', desc: 'Fight in a Guild War', ev: 'war', n: 1, pts: 25, lv: 10, reward: { diamonds: 10 } },
  { id: 'd_event', name: 'Festival Spirit', desc: 'Collect {n} festival tokens', ev: 'eventToken', n: 20, pts: 15, lv: 1, event: true, reward: { gold: 600 } },
];
export const WEEKLY_POOL = [
  { id: 'w_kill', name: 'Scourge of Carlyle', desc: 'Defeat {n} monsters', ev: 'kill', n: 400, pts: 60, lv: 1, reward: { diamonds: 30 } },
  { id: 'w_daily', name: 'Dedicated', desc: 'Complete {n} daily missions', ev: 'dailyDone', n: 18, pts: 60, lv: 1, reward: { items: [['gem_pouch', 1]] } },
  { id: 'w_enhance', name: 'Forgemaster', desc: 'Enhance or upgrade gear {n} times', ev: 'enhance', n: 15, pts: 50, lv: 2, reward: { mats: { spirit_shard: 2 } } },
  { id: 'w_craft', name: 'Master Crafter', desc: 'Craft {n} items', ev: 'craft', n: 10, pts: 50, lv: 3, reward: { mats: { spirit_shard: 2 } } },
  { id: 'w_dungeon', name: 'Dungeon Master', desc: 'Clear dungeons {n} times', ev: 'dungeon', n: 6, pts: 80, lv: 4, reward: { items: [['dungeon_ticket', 2]] } },
  { id: 'w_gem', name: 'Jeweler', desc: 'Socket or combine gems {n} times', ev: 'gem', n: 5, pts: 50, lv: 5, reward: { items: [['gem_pouch', 2]] } },
  { id: 'w_market', name: 'Tycoon', desc: 'Earn {n} Gold from Market sales', ev: 'marketGold', n: 4000, pts: 50, lv: 5, reward: { diamonds: 20 } },
  { id: 'w_donate', name: 'Pillar of the Guild', desc: 'Donate to your guild {n} times', ev: 'donate', n: 7, pts: 60, lv: 5, reward: { items: [['dungeon_ticket', 1]] } },
  { id: 'w_srank', name: 'Flawless', desc: 'Earn {n} S ratings in dungeons', ev: 'dungeonS', n: 2, pts: 80, lv: 6, reward: { mats: { star_essence: 1 } } },
  { id: 'w_wboss', name: 'Titan Slayer', desc: 'Fight {n} World Bosses', ev: 'worldboss', n: 3, pts: 80, lv: 8, reward: { mats: { star_essence: 1 } } },
  { id: 'w_war', name: 'Warlord', desc: 'Win {n} Guild Wars', ev: 'warWin', n: 3, pts: 80, lv: 10, reward: { diamonds: 40 } },
];
export const DAILY_CHESTS = [
  { pts: 20, reward: { gold: 600 } },
  { pts: 40, reward: { items: [['hp_potion', 5], ['mp_potion', 5]], mats: { spirit_dust: 4 } } },
  { pts: 60, reward: { diamonds: 15 } },
  { pts: 80, reward: { items: [['gem_pouch', 1]], gold: 1000 } },
  { pts: 100, reward: { mats: { spirit_shard: 2 }, diamonds: 10 } },
];
export const WEEKLY_CHESTS = [
  { pts: 150, reward: { gold: 4000, mats: { spirit_shard: 3 } } },
  { pts: 300, reward: { items: [['dungeon_ticket', 2]], diamonds: 30 } },
  { pts: 450, reward: { items: [['gem_pouch', 2]], mats: { star_essence: 1 } } },
  { pts: 600, reward: { items: [['unique_cache', 1]] } },
];

// ---------------------------------------------------------------- guilds
export const GUILD_LIST = [
  { name: 'Moonlight', lv: 6, color: '#9ad0ff', emblem: 'moon', leader: 'Lunaria', motto: 'Friendly guild for everyone~ daily donations please!', size: 34 },
  { name: 'Starfall', lv: 8, color: '#ffd84a', emblem: 'star', leader: 'Celestine', motto: 'Top raiders of Carlyle. Wars every night.', size: 42 },
  { name: 'Sakura', lv: 5, color: '#ff9ad0', emblem: 'flower', leader: 'SakuraBloom', motto: 'Cute pets, chill vibes, sakura forever.', size: 27 },
  { name: 'Valhalla', lv: 7, color: '#ff7a5a', emblem: 'axe', leader: 'Valkyr', motto: 'Glory in battle. CP 6k+ preferred.', size: 38 },
  { name: 'Dreamers', lv: 3, color: '#c8a0ff', emblem: 'cloud', leader: 'Pudding', motto: 'New players welcome! We help with dungeons.', size: 19 },
];
export const GUILD_EXP = [0, 400, 1200, 2600, 5000, 8500, 13500, 20000, 29000, 41000]; // exp to reach level i+1 (index = current level - 1)
export const GUILD_MAX = 10;
export const GUILD_CREATE = { gold: 20000, lv: 5 };
export const GUILD_JOIN_LV = 5;
export const guildBuff = (lv) => ({ atk: 0.015 * lv, hp: 0.015 * lv });
export const GUILD_DONATE = [
  { id: 'gold', name: 'Gold Donation', cost: { gold: 2000 }, exp: 20, contrib: 20, max: 3 },
  { id: 'mats', name: 'Material Donation', cost: { mats: { spirit_dust: 8 } }, exp: 40, contrib: 40, max: 2 },
  { id: 'diamond', name: 'Diamond Donation', cost: { diamonds: 20 }, exp: 100, contrib: 100, max: 1 },
];
// limit: 'day' | 'week' purchases; lv = guild level needed
export const GUILD_SHOP = [
  { id: 'gs_scroll', name: 'Scroll of Wisdom', item: 'exp_scroll', qty: 1, cost: 60, lv: 1, max: 3, per: 'day' },
  { id: 'gs_ticket', name: 'Dungeon Ticket', item: 'dungeon_ticket', qty: 1, cost: 80, lv: 1, max: 2, per: 'day' },
  { id: 'gs_pouch', name: 'Gem Pouch', item: 'gem_pouch', qty: 1, cost: 100, lv: 2, max: 2, per: 'day' },
  { id: 'gs_shard', name: 'Spirit Shard x3', mat: 'spirit_shard', qty: 3, cost: 120, lv: 3, max: 2, per: 'day' },
  { id: 'gs_egg', name: 'Mystery Pet Egg', item: 'pet_egg', qty: 1, cost: 150, lv: 4, max: 1, per: 'day' },
  { id: 'gs_essence', name: 'Star Essence', mat: 'star_essence', qty: 1, cost: 400, lv: 5, max: 2, per: 'week' },
  { id: 'gs_unique', name: 'Unique Cache', item: 'unique_cache', qty: 1, cost: 1500, lv: 7, max: 1, per: 'week' },
  { id: 'gs_legend', name: 'Legendary Cache', item: 'legend_cache', qty: 1, cost: 4000, lv: 9, max: 1, per: 'week' },
];
export const EXTRA_NAMES = ['Aria', 'Kaito', 'Nova', 'Ren', 'Hikari', 'Lumi', 'Sora', 'Mikan', 'Astra', 'Kuro', 'Neko', 'Riku', 'Shiro', 'Akane', 'Fuyu', 'Haru', 'Kiwi', 'Momo', 'Nyx', 'Orion', 'Pixie', 'Rin', 'Taiga', 'Umi', 'Vega', 'Wren', 'Yoru', 'Zen', 'Ember', 'Frost', 'Gale', 'Iris', 'Juno', 'Kai', 'Lux', 'Mei', 'Noa', 'Opal', 'Pearl', 'Quill'];
export const GUILD_ROLES = ['Leader', 'Officer', 'Officer', 'Elite', 'Elite', 'Elite'];

// ---------------------------------------------------------------- guild war (instanced battleground)
export const WAR = { duration: 240, entries: 2, lv: 10, teamSize: 4, killPts: 10, crystalHp: 30000 };
export const WAR_DEF = {
  id: 'war', name: 'Spirit Crystal Arena', theme: 'arena', lv: 10, arena: true, origin: { x: 3000, z: 2200 },
  rooms: [{ x: 0, z: 0, w: 58, d: 112 }],
};

// ---------------------------------------------------------------- world boss
export const WORLD_BOSS = { every: 15 * 60, lasts: 8 * 60, site: { x: 128, z: -86 }, name: 'Storm Altar' };
// rewards by how fast you bring the boss down, counted from your first hit
export const WB_REWARDS = [
  { upTo: 120, label: 'Within 2:00', diamonds: 60, mats: { star_essence: 2 }, items: [['gem_pouch', 2]], gear: 5, gearChance: 0.25 },
  { upTo: 240, label: 'Within 4:00', diamonds: 40, mats: { star_essence: 1 }, items: [['gem_pouch', 1]], gear: 4, gearChance: 0.5 },
  { upTo: 360, label: 'Within 6:00', diamonds: 20, mats: { spirit_shard: 3 }, gear: 3, gearChance: 1 },
  { upTo: Infinity, label: 'Defeated', diamonds: 5, mats: { spirit_dust: 6 }, gear: 2, gearChance: 0.6 },
];

// ---------------------------------------------------------------- market
export const MARKET = { maxListings: 6, tax: 0.05, refresh: 300 };
// goods bots list for sale: [kind, id, qty range, weight, min player level]
export const MARKET_GOODS = [
  ['mat', 'jelly_gel', [3, 10], 3, 1], ['mat', 'soft_fur', [3, 10], 3, 1], ['mat', 'glow_spore', [2, 8], 3, 1], ['mat', 'wolf_fang', [2, 6], 3, 4],
  ['mat', 'golem_core', [1, 4], 2, 8], ['mat', 'heartwood', [1, 4], 2, 8], ['mat', 'soul_ember', [1, 4], 2, 9], ['mat', 'spirit_dust', [5, 20], 4, 1],
  ['mat', 'spirit_shard', [1, 4], 3, 4], ['mat', 'star_essence', [1, 1], 1, 10],
  ['mat', 'gem_ruby_1', [1, 2], 2, 4], ['mat', 'gem_sapphire_1', [1, 2], 2, 4], ['mat', 'gem_emerald_1', [1, 2], 2, 4], ['mat', 'gem_topaz_1', [1, 2], 2, 4],
  ['mat', 'gem_ruby_2', [1, 1], 1, 10], ['mat', 'gem_emerald_2', [1, 1], 1, 10],
  ['item', 'hp_potion', [5, 20], 2, 1], ['item', 'mp_potion', [5, 20], 2, 1], ['item', 'pet_egg', [1, 1], 1, 3], ['item', 'dungeon_ticket', [1, 2], 2, 4],
  ['item', 'exp_scroll', [1, 2], 1, 5], ['item', 'gem_pouch', [1, 1], 1, 5],
  ['gear', 2, [1, 1], 3, 1], ['gear', 3, [1, 1], 2, 5], ['gear', 4, [1, 1], 0.4, 10],
];

// ---------------------------------------------------------------- festivals & seasons
// Festivals run between month-day dates (inclusive), wrapping the new year when start > end.
export const EVENTS = [
  {
    id: 'harvest', name: 'Harvest Moon Festival', short: 'Harvest Moon', start: '10-01', end: '11-07', currency: 'moon_candy', color: '#ff9a2e',
    monster: 'jackpuff', boss: 'pumpkinking', pet: 'pet_pumpkin', wings: '#ffa040', decor: 'pumpkin', npcTitle: 'Festival Host',
    desc: 'Jackpuffs have sprouted all over Carlyle and the Pumpkin King rises at the Storm Altar! Collect Moon Candy and trade it with the Festival Host.',
    title: 'Harvest Lord',
  },
  {
    id: 'winter', name: 'Winter Starlight', short: 'Starlight', start: '12-01', end: '01-07', currency: 'star_cookie', color: '#9ad8ff',
    monster: 'snowpuff', boss: 'frostbehemoth', pet: 'pet_snowpuff', wings: '#bfefff', decor: 'snow', npcTitle: 'Festival Host',
    desc: 'Snowpuffs roll through the meadows and the Frost Behemoth stirs. Bake Star Cookies into wonderful gifts!', title: 'Starlight Guardian',
  },
  {
    id: 'sakura', name: 'Sakura Bloom', short: 'Sakura', start: '03-20', end: '04-30', currency: 'sakura_petal', color: '#ff9ad0',
    monster: 'blossompuff', boss: 'behemoth', pet: 'pet_blossom', wings: '#ffc8e8', decor: 'sakura', npcTitle: 'Festival Host',
    desc: 'Blossom Puffs dance under the cherry trees. Gather petals and celebrate spring in Carlyle!', title: 'Blossom Dancer',
  },
];
export function activeEvent(d = new Date()) {
  const md = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return EVENTS.find((e) => (e.start <= e.end ? md >= e.start && md <= e.end : md >= e.start || md <= e.end)) || null;
}
export function eventEnds(ev, d = new Date()) {
  const [m, dd] = ev.end.split('-').map(Number);
  let y = d.getUTCFullYear();
  if (ev.start > ev.end && d.getUTCMonth() + 1 >= +ev.start.slice(0, 2)) y++;
  return (Date.UTC(y, m - 1, dd + 1) - d) / 1000;
}
export function nextEvent(d = new Date()) {
  let best = null, bs = Infinity;
  for (const e of EVENTS) {
    const [m, dd] = e.start.split('-').map(Number);
    let t = Date.UTC(d.getUTCFullYear(), m - 1, dd);
    if (t < d) t = Date.UTC(d.getUTCFullYear() + 1, m - 1, dd);
    if (t - d < bs) { bs = t - d; best = e; }
  }
  return { ev: best, secs: bs / 1000 };
}
// cost in festival tokens; kind: pet | wings | title | item | mat
export const EVENT_SHOP = [
  { id: 'es_pet', kind: 'pet', cost: 300, max: 1 },
  { id: 'es_wings', kind: 'wings', cost: 400, max: 1 },
  { id: 'es_title', kind: 'title', cost: 500, max: 1 },
  { id: 'es_pouch', kind: 'item', id2: 'gem_pouch', qty: 1, cost: 60, max: 5 },
  { id: 'es_ticket', kind: 'item', id2: 'dungeon_ticket', qty: 1, cost: 80, max: 3 },
  { id: 'es_hp', kind: 'item', id2: 'hp_potion', qty: 10, cost: 25, max: 10 },
  { id: 'es_essence', kind: 'mat', id2: 'star_essence', qty: 1, cost: 150, max: 3 },
  { id: 'es_cache', kind: 'item', id2: 'unique_cache', qty: 1, cost: 600, max: 1 },
];
const SEASON_NAMES = ['Frostfall', 'Heartsong', 'Blossom', 'Spring Rain', 'Verdant', 'Midsummer', 'Tides', 'Ember Sky', 'Golden Wind', 'Harvest Moon', 'Starlit Mist', 'Winter Starlight'];
export function seasonInfo(d = new Date()) {
  const n = (d.getUTCFullYear() - 2026) * 12 + d.getUTCMonth() + 1; // Season 1 = January 2026
  return { key: monthKey(d), n, name: SEASON_NAMES[d.getUTCMonth()], ends: secsToMonthEnd(d) };
}
export const PASS = { tiers: 30, perTier: 800, premium: { diamonds: 300 } };
// Season pass rewards per tier. free / premium tracks.
export function passReward(tier, premium) {
  if (!premium) {
    if (tier === 30) return { items: [['unique_cache', 1]], title: 'Season Veteran', label: 'Unique Cache + title' };
    if (tier === 20) return { items: [['unique_cache', 1]], label: 'Unique Cache' };
    if (tier % 10 === 5) return { diamonds: 40, label: '40 Diamonds' };
    if (tier % 10 === 0) return { items: [['dungeon_ticket', 2]], label: 'Dungeon Ticket x2' };
    const cyc = [{ gold: 1000 + tier * 100, label: `${1000 + tier * 100} Gold` }, { mats: { spirit_dust: 8 }, label: 'Spirit Dust x8' }, { items: [['hp_potion', 10]], label: 'Healing x10' }, { mats: { spirit_shard: 2 }, label: 'Spirit Shard x2' }];
    return cyc[tier % 4];
  }
  if (tier === 30) return { items: [['legend_cache', 1]], title: 'Season Champion', label: 'Legendary Cache + title' };
  if (tier === 15) return { items: [['legend_cache', 1]], label: 'Legendary Cache' };
  if (tier % 5 === 0) return { mats: { star_essence: 2 }, diamonds: 30, label: '2 Star Essence + 30 Diamonds' };
  const cyc = [{ items: [['gem_pouch', 1]], label: 'Gem Pouch' }, { diamonds: 15, label: '15 Diamonds' }, { mats: { spirit_shard: 3 }, label: 'Spirit Shard x3' }, { gold: 3000, label: '3,000 Gold' }];
  return cyc[tier % 4];
}
// season exp sources
export const SEASON_EXP = { missionPt: 10, kill: 2, elite: 15, boss: 100, dungeon: 300, dungeonS: 150, worldboss: 400, war: 300, warWin: 200 };
export const SEASON_RANK_REWARDS = [
  { upTo: 1, diamonds: 500, title: 'Season Champion', label: '#1 · 500 Diamonds + title' },
  { upTo: 3, diamonds: 300, label: 'Top 3 · 300 Diamonds' },
  { upTo: 10, diamonds: 150, label: 'Top 10 · 150 Diamonds' },
  { upTo: 50, diamonds: 60, label: 'Top 50 · 60 Diamonds' },
  { upTo: 1e9, diamonds: 20, label: 'Participant · 20 Diamonds' },
];
