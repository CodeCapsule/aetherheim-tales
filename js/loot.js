// Item rarity tiers, random affixes, named Unique/Legendary items and loot generation. Pure JS (no three.js).
import { SLOTS, WEAPON_NAMES, SLOT_BASE, SLOT_INFO, DUNGEONS } from './data.js';
import { SETS, SET_EFFECTS, SET_COLOR, ANCIENT_COLOR, SIX_SETS } from './data-sets.js';
import { CLASS_SKILLS, SKILL_BY_ID } from './data-classes.js';
import { SOCKETS, GEMS, GEM_LV, parseGem, parseSoul, SOULS, SOCKET_MAX } from './systems-data.js';
import { ELEMENTS, isElement } from './data-elements.js';

// Eight tiers. min = the lowest level a tier drops at, and the weapon mastery needed to equip it (mastery lock).
export const RARITY = [
  { key: 'common', name: 'Common', color: '#e8e8e8', glow: 'rgba(232,232,232,0.25)', mult: 1.0, affixes: 0, beam: 0, min: 1 },
  { key: 'uncommon', name: 'Uncommon', color: '#5ee05a', glow: 'rgba(94,224,90,0.4)', mult: 1.2, affixes: 1, beam: 0.3, min: 1 },
  { key: 'rare', name: 'Rare', color: '#4aa8ff', glow: 'rgba(74,168,255,0.5)', mult: 1.5, affixes: 2, beam: 0.6, min: 20 },
  { key: 'special', name: 'Special', color: '#c46bff', glow: 'rgba(196,107,255,0.55)', mult: 1.9, affixes: 2, beam: 0.8, min: 40 },
  { key: 'unique', name: 'Unique', color: '#ff9a2e', glow: 'rgba(255,154,46,0.65)', mult: 2.4, affixes: 2, beam: 1.0, min: 60 },
  { key: 'legendary', name: 'Legendary', color: '#ffd84a', glow: 'rgba(255,216,74,0.8)', mult: 3.0, affixes: 3, beam: 1.3, min: 100 },
  { key: 'red', name: 'Red', color: '#ff3b3b', glow: 'rgba(255,59,59,0.85)', mult: 3.8, affixes: 3, beam: 1.5, min: 140 },
  { key: 'ancient', name: 'Ancient', color: '#d8a060', glow: 'rgba(216,160,96,0.9)', mult: 5.0, affixes: 4, beam: 1.8, min: 180 },
];
// Legendary and up are account-bound (cannot be traded); items lose durability on death
export const BOUND_TIER = 5, DUR_MAX = 100, DUR_DEATH = 10;
export const tierMin = (q) => RARITY[q]?.min || 1;
// the best tier that may appear at a level (never above max)
export const tierFor = (lvl, max = 5) => { let q = 0; for (let i = 0; i <= max; i++) if (RARITY[i].min <= lvl) q = i; return q; };
// Special items carry one small passive
export const MINOR_PASSIVES = {
  keen: { name: 'Keen', stat: 'critDmg', v: 6, label: '+6% Crit Damage' }, sturdy: { name: 'Sturdy', stat: 'defPct', v: 4, label: '+4% Defense' },
  vital: { name: 'Vital', stat: 'hpPct', v: 4, label: '+4% Max HP' }, fierce: { name: 'Fierce', stat: 'atkPct', v: 3, label: '+3% Attack' },
  nimble: { name: 'Nimble', stat: 'speed', v: 3, label: '+3% Move Speed' }, focused: { name: 'Focused', stat: 'cdr', v: 3, label: '-3% Cooldowns' },
};

const r1 = (v) => Math.round(v * 10) / 10;
const pct = (v) => (Math.round(v * 10) / 10).toString();
// Affix roll: base + per-level growth, scaled by tier (Rare 1.0 ... Legendary 1.6) and a 0.8-1.2 random spread.
const tierScale = (q) => [0.7, 0.85, 1.0, 1.2, 1.4, 1.6, 1.85, 2.1][q] || 1;
const mk = (name, stat, label, base, perLvl, cap) => ({
  name, stat, label, base, perLvl, cap,
  roll(lvl, q, rng = Math.random) {
    const v = (base + perLvl * lvl) * tierScale(q) * (0.8 + rng() * 0.4);
    return r1(cap ? Math.min(cap, v) : v);
  },
});

const AFFIXES = {
  atk: mk('Might', 'atk', (v) => `+${pct(v)} Attack`, 2, 0.8),
  def: mk('Guarding', 'def', (v) => `+${pct(v)} Defense`, 2, 0.6),
  hp: mk('Vitality', 'hp', (v) => `+${Math.round(v)} Max HP`, 15, 7),
  crit: mk('Precision', 'crit', (v) => `+${pct(v)}% Critical`, 1, 0.1, 8),
  critDmg: mk('Ferocity', 'critDmg', (v) => `+${pct(v)}% Crit Damage`, 5, 0.6, 30),
  speed: mk('Swiftness', 'speed', (v) => `+${pct(v)}% Move Speed`, 3, 0.1, 8),
  lifesteal: mk('the Leech', 'lifesteal', (v) => `+${pct(v)}% Lifesteal`, 1, 0.08, 5),
  cdr: mk('Haste', 'cdr', (v) => `-${pct(v)}% Cooldowns`, 3, 0.12, 9),
  expGain: mk('Wisdom', 'expGain', (v) => `+${pct(v)}% EXP Gain`, 5, 0.3, 18),
  goldFind: mk('Fortune', 'goldFind', (v) => `+${pct(v)}% Gold Find`, 8, 0.6, 30),
  thorns: mk('Thorns', 'thorns', (v) => `Reflect ${pct(v)}% damage taken`, 5, 0.3, 18),
  regen: mk('Renewal', 'regen', (v) => `+${pct(v)} HP per second`, 1, 0.3),
  manaCost: mk('Clarity', 'manaCost', (v) => `-${pct(v)}% Skill MP Cost`, 4, 0.3, 15),
};

export const EFFECTS = {
  crit_heal: { id: 'crit_heal', tier: 'unique', name: 'Bloodbloom', desc: 'Critical hits heal you for 4% of Max HP.', params: { healPct: 4 } },
  chain: { id: 'chain', tier: 'unique', name: 'Stormcall', desc: '18% chance on hit to arc lightning to 2 nearby foes for 80% Attack.', params: { chance: 18, targets: 2, mult: 80 } },
  stun_chance: { id: 'stun_chance', tier: 'unique', name: 'Earthshock', desc: '10% chance on hit to stun the target for 1.5s (not bosses).', params: { chance: 10, secs: 1.5 } },
  thorn_aura: { id: 'thorn_aura', tier: 'unique', name: 'Bramble Aura', desc: 'Enemies that hit you take 40% of your Defense as damage.', params: { defPct: 40 } },
  swift: { id: 'swift', tier: 'unique', name: 'Zephyr Step', desc: '+12% move speed and 12% faster basic attacks.', params: { speed: 12, attack: 12 } },
  mana_font: { id: 'mana_font', tier: 'unique', name: 'Mana Font', desc: 'Skills cost 30% less MP.', params: { mpPct: 30 } },
  meteor_proc: { id: 'meteor_proc', tier: 'legendary', name: 'Ragnarok', desc: 'Every 6th hit calls down a meteor dealing 260% Attack in a wide area.', params: { every: 6, mult: 260, radius: 5 } },
  phoenix: { id: 'phoenix', tier: 'legendary', name: 'Phoenix Feather', desc: 'Once every 60s, lethal damage instead restores you to 50% HP.', params: { cd: 60, hpPct: 50 } },
  frenzy: { id: 'frenzy', tier: 'legendary', name: 'Frenzy', desc: 'Each kill grants +12% Attack for 8s, stacking up to 3 times.', params: { atk: 12, secs: 8, stacks: 3 } },
  holy_nova: { id: 'holy_nova', tier: 'legendary', name: 'Holy Nova', desc: 'Every 8s in combat, release a nova for 150% Attack around you and heal 5% Max HP.', params: { every: 8, mult: 150, radius: 6, healPct: 5 } },
  starfall: { id: 'starfall', tier: 'legendary', name: 'Starfall', desc: 'Critical hits drop a falling star on the target for 120% Attack.', params: { mult: 120 } },
  worldtree: { id: 'worldtree', tier: 'legendary', name: 'Blessing of Yggdrasil', desc: '+20% Max HP and regenerate 1.2% Max HP per second.', params: { hpPct: 20, regenPct: 1.2 } },
  // found only on Soulstones
  double_strike: { id: 'double_strike', tier: 'unique', name: 'Twin Fang', desc: '15% chance on hit to strike again for 70% of the damage.', params: { chance: 15, pct: 70 } },
  executioner: { id: 'executioner', tier: 'unique', name: 'Executioner', desc: '+40% damage to enemies below 30% HP.', params: { below: 30, pct: 40 } },
  giant_slayer: { id: 'giant_slayer', tier: 'legendary', name: 'Giant Slayer', desc: '+20% damage to elites, bosses and world bosses.', params: { pct: 20 } },
  ...SET_EFFECTS,
};
// Enhancement: base stats grow 7% per level with bonus steps at +5, +10 and +15; from +10 affixes grow too.
export const enhMult = (enh = 0) => 1 + 0.07 * enh + (enh >= 5 ? 0.05 : 0) + (enh >= 10 ? 0.15 : 0) + (enh >= 15 ? 0.35 : 0);
export const enhAffixMult = (enh = 0) => 1 + (enh >= 10 ? 0.1 : 0) + (enh >= 15 ? 0.15 : 0);

const UNIQUE_ITEMS = [
  { id: 'u_thornfang', name: 'Thornfang Blade', slot: 'weapon', cls: 'knight', effect: 'stun_chance', flavor: 'Forged from a Thornwolf\'s fang and Mossveil iron.' },
  { id: 'u_whisperwind', name: 'Whisperwind Edges', slot: 'weapon', cls: 'assassin', effect: 'swift', flavor: 'They make no sound, not even when they strike.' },
  { id: 'u_emberheart', name: 'Emberheart Staff', slot: 'weapon', cls: 'mage', effect: 'chain', flavor: 'An ember of the Fire Spirit still beats inside.' },
  { id: 'u_tideweaver', name: 'Tideweaver Scepter', slot: 'weapon', cls: 'priest', effect: 'mana_font', flavor: 'The tides answer whoever holds it kindly.' },
  { id: 'u_mossking', name: 'Crown of the Mossking', slot: 'helm', effect: 'thorn_aura', flavor: 'Moss still grows between its emeralds.' },
  { id: 'u_mossbark', name: 'Bark of Mossveil', slot: 'armor', effect: 'thorn_aura', flavor: 'Living bark that hardens when struck.' },
  { id: 'u_zephyr', name: 'Zephyr Striders', slot: 'boots', effect: 'swift', flavor: 'Woven from the Wind Spirit\'s first breeze.' },
  { id: 'u_pearl', name: 'Jellissa\'s Pearl', slot: 'necklace', effect: 'crit_heal', flavor: 'It wobbles slightly, like its former owner.', source: 'queenjelly' },
  { id: 'u_restless', name: 'Band of the Restless', slot: 'ring', effect: 'crit_heal', flavor: 'Its wearer never quite sleeps.', source: 'gravelord' },
  { id: 'u_sylvan', name: 'Sylvan Spirit Charm', slot: 'necklace', effect: 'mana_font', flavor: 'A gift from the spirits of Sylvan Haven.' },
  { id: 'u_elderward', name: 'Elder Ward Helm', slot: 'helm', effect: 'stun_chance', flavor: 'Carved with runes from the Elder Ruins.', source: 'gravelord' },
  { id: 'u_stormring', name: 'Ring of the Four Winds', slot: 'ring', effect: 'chain', flavor: 'Static crackles across the band.', source: 'boss' },
];

export const LEGENDARY_ITEMS = [
  { id: 'l_yggwrath', name: 'Yggdrasil\'s Wrath', slot: 'weapon', cls: 'knight', effect: 'frenzy', flavor: 'A blade grown, not forged, from the World Tree itself.' },
  { id: 'l_nidfangs', name: 'Nidhogg\'s Fangs', slot: 'weapon', cls: 'assassin', effect: 'starfall', flavor: 'Still hungry for the roots of the world.', source: 'nidhogg' },
  { id: 'l_ragnarok', name: 'Ragnarok Ember', slot: 'weapon', cls: 'mage', effect: 'meteor_proc', flavor: 'The last spark of a world that burned.' },
  { id: 'l_tear', name: 'Tear of Hiraya', slot: 'weapon', cls: 'priest', effect: 'holy_nova', flavor: 'Shed by the Water Spirit for a fallen hero.' },
  { id: 'l_fairyking', name: 'Crown of the Fairy King', slot: 'helm', effect: 'starfall', flavor: 'Oberon wore it when the World Tree was young.' },
  { id: 'l_aegis', name: 'Aegis of the Four Spirits', slot: 'armor', effect: 'phoenix', flavor: 'Fire, Water, Wind and Earth, bound as one.', source: 'gravelord' },
  { id: 'l_skystride', name: 'Skystride Greaves', slot: 'boots', effect: 'frenzy', flavor: 'Each step lands a little closer to the sky.' },
  { id: 'l_worldheart', name: 'Heart of the World Tree', slot: 'necklace', effect: 'worldtree', flavor: 'It beats once every hundred years.', source: 'nidhogg' },
  { id: 'l_oberon', name: 'Oberon\'s Signet', slot: 'ring', effect: 'holy_nova', flavor: 'The seal of the Fairy King, warm to the touch.', source: 'queenjelly' },
];

export const NAMED_LIST = [...UNIQUE_ITEMS.map((d) => ({ ...d, quality: 4 })), ...LEGENDARY_ITEMS.map((d) => ({ ...d, quality: 5 }))];
const NAMED = new Map([...UNIQUE_ITEMS.map((d) => [d.id, { ...d, quality: 4 }]), ...LEGENDARY_ITEMS.map((d) => [d.id, { ...d, quality: 5 }])]);
const PREFIX = [['Worn', 'Plain'], ['Sturdy', 'Fine'], ['Sylvan', 'Gleaming'], ['Elven', 'Runed']];
const pickMinor = (rng) => { const k = Object.keys(MINOR_PASSIVES); return k[Math.floor(rng() * k.length)]; };
const WEAPON_KEY = { knight: 'w_sword', assassin: 'w_daggers', mage: 'w_staff', priest: 'w_scepter', berserker: 'w_greataxe', ranger: 'w_bow', summoner: 'w_tome', spellblade: 'w_runesword' };
const VALID_CLS = Object.keys(WEAPON_KEY);

export function iconKey(slot, cls, quality) {
  const base = slot === 'weapon' ? (WEAPON_KEY[cls] || 'w_sword') : slot;
  return quality >= 4 ? base + '_l' : base;
}

// world drops follow the base rates (60 / 25 / 10 / 3.5 / 1.2 / 0.25%); a tier never drops below its minimum level.
// Red and Ancient do not drop from monsters: they come from trials, top dungeons and the ancient ruins.
export function rollRarity({ elite = false, boss = false, dungeon = false, luck = 0, lvl = 200 } = {}, rng = Math.random) {
  // weights: Common, Uncommon, Rare, Special, Unique, Legendary
  let w = [60, 25, 10, 3.5, 1.2, 0.25];
  if (elite) w = [30, 35, 22, 10, 2.4, 0.6];
  if (dungeon) w = elite ? [10, 30, 34, 19, 5.5, 1.5] : [30, 34, 24, 9, 2.4, 0.6];
  if (boss) w = dungeon ? [0, 0, 46, 38, 12, 4] : [0, 20, 40, 30, 8, 2];
  if (luck > 0) {
    const l = Math.min(1, luck);
    w = w.map((x, i) => x * (i >= 2 ? 1 + l * (0.6 + i * 0.3) : 1 - l * 0.5));
  }
  w = w.map((x, i) => (RARITY[i].min <= lvl ? x : 0));
  const total = w.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; }
  return 0;
}

function baseStats(slot, lvl, quality) {
  const m = RARITY[quality].mult, L = lvl, st = {};
  if (slot === 'weapon') st.atk = (8 + L * 2.4) * m;
  if (slot === 'helm') { st.hp = (24 + L * 10) * m; st.def = (2 + L * 0.6) * m; }
  if (slot === 'armor') { st.def = (4 + L * 1.2) * m; st.hp = (20 + L * 8) * m; }
  if (slot === 'gloves') { st.atk = (2 + L * 0.6) * m; st.def = (1 + L * 0.4) * m; }
  if (slot === 'boots') { st.def = (2 + L * 0.7) * m; st.hp = (10 + L * 4) * m; }
  if (slot === 'necklace') { st.hp = (30 + L * 12) * m; st.atk = (2 + L * 0.5) * m; }
  if (slot === 'ring') { st.atk = (3 + L * 1.0) * m; st.crit = 1 + quality * 1.5; }
  for (const k in st) st[k] = r1(st[k]);
  return st;
}

function rollAffixes(n, lvl, quality, rng) {
  const ids = Object.keys(AFFIXES), out = [];
  while (out.length < n && ids.length) {
    const id = ids.splice(Math.floor(rng() * ids.length), 1)[0];
    out.push({ id, v: AFFIXES[id].roll(lvl, quality, rng) });
  }
  return out;
}

export function genEquip({ slot, lvl, quality, cls, uid, named = null, rng = Math.random } = {}) {
  lvl = Math.max(1, Math.round(lvl || 1));
  quality = Math.max(0, Math.min(5, quality | 0, tierFor(lvl)));
  if (named) return genNamed(typeof named === 'string' ? named : named.id, { lvl, cls, uid, rng });
  if (!slot) slot = SLOTS[Math.floor(rng() * SLOTS.length)];
  if (quality >= 4) {
    const list = (quality === 5 ? LEGENDARY_ITEMS : UNIQUE_ITEMS).filter((d) => d.slot === slot && (!d.cls || d.cls === cls));
    const pool = list.length ? list : (quality === 5 ? LEGENDARY_ITEMS : UNIQUE_ITEMS).filter((d) => !d.cls || d.cls === cls);
    return genNamed(pool[Math.floor(rng() * pool.length)].id, { lvl, cls, uid, rng });
  }
  const pre = PREFIX[quality][Math.floor(rng() * 2)];
  const base = slot === 'weapon' ? (WEAPON_NAMES[cls] || 'Blade') : SLOT_BASE[slot];
  return {
    uid, slot, name: `${pre} ${base}`, quality, lvl, stats: baseStats(slot, lvl, quality),
    affixes: rollAffixes(RARITY[quality].affixes, lvl, quality, rng), effect: null, named: null, enh: 0, dur: DUR_MAX,
    minor: quality === 3 ? pickMinor(rng) : null,
    icon: iconKey(slot, cls, quality), gems: new Array(SOCKETS[quality]).fill(null),
  };
}

export function genNamed(namedId, { lvl = 1, cls, uid, rng = Math.random } = {}) {
  const d = NAMED.get(namedId);
  lvl = Math.max(1, Math.round(lvl));
  if (!d || d.quality > tierFor(lvl)) return genEquip({ slot: d?.slot || null, lvl, quality: d ? tierFor(lvl) : 3, cls, uid, rng });
  const useCls = d.cls || cls;
  return {
    uid, slot: d.slot, name: d.name, quality: d.quality, lvl, stats: baseStats(d.slot, lvl, d.quality),
    affixes: rollAffixes(RARITY[d.quality].affixes, lvl, d.quality, rng), effect: d.effect, named: d.id, enh: 0, dur: DUR_MAX, bound: d.quality >= BOUND_TIER || undefined,
    icon: iconKey(d.slot, useCls, d.quality), flavor: d.flavor, cls: d.cls || null, gems: new Array(SOCKETS[d.quality]).fill(null),
  };
}

// Red (tier 6) gear: crafted at the Forge from a full dungeon relic set and a Crimson Core.
// Four affixes, a random legendary power and three sockets; the dungeon's adjective names it.
const RED_EFFECTS = ['meteor_proc', 'phoenix', 'frenzy', 'holy_nova', 'starfall', 'worldtree'];
// a Red item awakens one of your class's core skills (+50% damage, 30% shorter cooldown, +30% reach)
export const AWAKEN = { dmg: 1.5, cd: 0.7, range: 1.3 };
function pickAwaken(cls, rng) {
  const list = (CLASS_SKILLS[cls]?.core || []).filter((s) => s.type === 'active' && s.m);
  return list.length ? list[Math.floor(rng() * list.length)].id : null;
}
export function genRed({ adj, set, slot, lvl, cls, uid, rng = Math.random }) {
  lvl = Math.max(1, Math.round(lvl || 1));
  if (!SLOTS.includes(slot)) slot = SLOTS[Math.floor(rng() * SLOTS.length)];
  const base = slot === 'weapon' ? (WEAPON_NAMES[cls] || 'Blade') : SLOT_BASE[slot];
  return {
    uid, slot, name: `Crimson ${adj} ${base}`, quality: 6, lvl, stats: baseStats(slot, lvl, 6),
    affixes: rollAffixes(RARITY[6].affixes, lvl, 6, rng), effect: RED_EFFECTS[Math.floor(rng() * RED_EFFECTS.length)], named: null, red: set || null, enh: 0, dur: DUR_MAX, bound: true,
    awaken: pickAwaken(cls, rng),
    icon: iconKey(slot, cls, 6), flavor: `Forged from the four ${adj} relics and a Crimson Core.`, gems: new Array(SOCKETS[6]).fill(null),
  };
}

// Dungeon set piece: Unique-strength base stats and affixes, named after its set.
// The piece's tier follows the level it drops at (a tier never appears below its minimum level); an Ancient-tier
// piece of the Bloodmoon sets needs Lv 180+ and the season's Ancient (ancientOk).
export function genSet(setId, { slot, lvl, cls, uid, ancientOk = false, rng = Math.random } = {}) {
  const set = SETS[setId]; if (!set) return null;
  if (set.six6) return genSix(setId, { slot, lvl, cls, uid, rng });
  if (!set.slots.includes(slot)) slot = set.slots[Math.floor(rng() * set.slots.length)];
  lvl = Math.max(1, Math.round(lvl || 1));
  const dg = DUNGEONS.find((d) => d.id === set.dungeon);
  const q = set.ancient && ancientOk && lvl >= RARITY[7].min ? 7 : Math.min(set.ancient ? 5 : 4, tierFor(lvl));
  return {
    uid, slot, name: `${set.ancient ? 'Ancient ' : ''}${set.name} ${SLOT_BASE[slot]}`, quality: q, lvl, stats: baseStats(slot, lvl, q),
    affixes: rollAffixes(RARITY[q].affixes, lvl, q, rng), effect: null, named: null, set: setId, enh: 0, dur: DUR_MAX, bound: q >= BOUND_TIER || undefined, minor: q === 3 ? pickMinor(rng) : null,
    icon: iconKey(slot, cls, q), flavor: set.ancient ? `One of four Ancient ${set.name} pieces, torn from the Bloodmoon Wastes.` : `One of four ${set.name} pieces, found in ${dg?.name || 'a dungeon'}.`, gems: new Array(SOCKETS[q]).fill(null),
  };
}
// Six-piece set piece (Rare to Ancient, by the set's tier). Ancient pieces carry the owner's name engraved.
export function genSix(setId, { slot, lvl, cls, uid, owner = null, rng = Math.random } = {}) {
  const set = SIX_SETS[setId]; if (!set) return null;
  if (!set.slots.includes(slot)) slot = set.slots[Math.floor(rng() * set.slots.length)];
  const q = set.tier;
  lvl = Math.max(set.min, Math.round(lvl || set.min));
  return {
    uid, slot, name: set.pieces[slot], quality: q, lvl, stats: baseStats(slot, lvl, q),
    affixes: rollAffixes(RARITY[q].affixes, lvl, q, rng), effect: null, named: null, set: setId, enh: 0, dur: DUR_MAX,
    bound: q >= BOUND_TIER || undefined, engraved: q === 7 && owner ? owner : undefined, minor: q === 3 ? pickMinor(rng) : null,
    icon: iconKey(slot, cls, q), flavor: `${set.name} · ${set.role}. ${set.source}.`, gems: new Array(SOCKETS[q]).fill(null),
  };
}
// does a worn piece count? (six-piece sets need their minimum weapon mastery)
const counts = (eq, ctx) => !(eq.dur === 0) && (!SIX_SETS[eq.set] || !ctx || ctx.mastery == null || ctx.mastery >= SIX_SETS[eq.set].min);
// how many pieces of each set are equipped
function setCounts(equipMap, ctx = null) {
  const n = {};
  for (const slot of SLOTS) { const eq = equipMap && equipMap[slot]; if (eq?.set && SETS[eq.set] && counts(eq, ctx)) n[eq.set] = (n[eq.set] || 0) + 1; }
  return n;
}

export function namedBySource(source) {
  return [...NAMED.values()].filter((d) => d.source && d.source === source);
}

const EMOJI_SLOT = { '⛑️': 'helm', '🥋': 'armor', '👢': 'boots', '📿': 'necklace', '💍': 'ring' };
const EMOJI_WEAPON = { '⚔️': 'knight', '🗡️': 'assassin', '🪄': 'mage', '🔱': 'priest' };
export function normalizeItem(eq, cls) {
  if (!eq || typeof eq !== 'object') return eq;
  if (!Array.isArray(eq.affixes)) eq.affixes = [];
  if (eq.effect === undefined) eq.effect = null;
  if (eq.named === undefined) eq.named = null;
  if (typeof eq.name === 'string' && eq.name.includes('Aetherheim')) eq.name = eq.name.replace('Aetherheim', 'Hiraya'); // the world's old name
  if (!eq.stats || typeof eq.stats !== 'object') eq.stats = {};
  eq.enh = eq.enh | 0;
  if (eq.el != null && (!isElement(eq.el) || eq.slot !== 'weapon')) delete eq.el;
  eq.quality = Math.max(0, Math.min(7, eq.quality | 0));
  if (eq.dur == null) eq.dur = DUR_MAX;
  if (eq.quality >= BOUND_TIER) eq.bound = true;
  eq.lvl = Math.max(1, eq.lvl | 0);
  if (!SLOTS.includes(eq.slot)) eq.slot = EMOJI_SLOT[eq.icon] || 'ring';
  fitSockets(eq);
  const validKey = typeof eq.icon === 'string' && /^(w_(sword|daggers|staff|scepter|greataxe|bow|tome|runesword)|helm|armor|gloves|boots|necklace|ring)(_l)?$/.test(eq.icon);
  if (!validKey) {
    const wc = EMOJI_WEAPON[eq.icon] || (VALID_CLS.includes(cls) ? cls : 'knight');
    eq.icon = iconKey(eq.slot, wc, eq.quality);
  }
  return eq;
}

const ZERO = () => ({ atk: 0, def: 0, hp: 0, crit: 0, critDmg: 0, speed: 0, lifesteal: 0, cdr: 0, expGain: 0, goldFind: 0, thorns: 0, regen: 0, manaCost: 0,
  atkPct: 0, defPct: 0, hpPct: 0, allPct: 0, bossPct: 0, firePct: 0, poisonPct: 0, rangedPct: 0, healPct: 0, atkSpeed: 0, regenPct: 0, skillRange: 0, discovery: 0, masteryPct: 0, dmgTaken: 0 });
export function itemStats(eq) {
  const out = ZERO();
  if (!eq || eq.dur === 0) return out; // broken: no stats until repaired
  const k = enhMult(eq.enh || 0), ka = enhAffixMult(eq.enh || 0);
  if (eq.minor && MINOR_PASSIVES[eq.minor]) out[MINOR_PASSIVES[eq.minor].stat] += MINOR_PASSIVES[eq.minor].v;
  for (const s of ['atk', 'def', 'hp']) out[s] += (eq.stats?.[s] || 0) * k;
  out.crit += eq.stats?.crit || 0;
  for (const a of eq.affixes || []) { const def = AFFIXES[a.id]; if (def && Number.isFinite(a.v)) out[def.stat] += a.v * ka; }
  for (const gid of eq.gems || []) { const g = parseGem(gid); if (g) out[GEMS[g.type].stat] += GEMS[g.type].vals[g.lv - 1]; }
  if (isElement(eq.el)) for (const [k, v] of Object.entries(ELEMENTS[eq.el].mods)) out[k] += v; // infused weapon
  return out;
}

const CAPS = { cdr: 40, speed: 40, lifesteal: 25, manaCost: 60, thorns: 60, dmgTaken: 40 };
export function aggregateEquip(equipMap, ctx = null) {
  const stats = ZERO(), effects = [];
  for (const slot of SLOTS) {
    const eq = equipMap && equipMap[slot];
    if (!eq || eq.dur === 0) continue;
    const s = itemStats(eq);
    for (const k in s) stats[k] += s[k];
    if (eq.effect && EFFECTS[eq.effect] && !effects.includes(eq.effect)) effects.push(eq.effect);
    for (const gid of eq.gems || []) { const fx = parseSoul(gid); if (fx && EFFECTS[fx] && !effects.includes(fx)) effects.push(fx); }
  }
  const sets = setCounts(equipMap, ctx);
  const add = (b) => { if (!b) return; if (typeof b === 'string') { if (!effects.includes(b)) effects.push(b); } else for (const [k, v] of Object.entries(b)) stats[k] += v; };
  for (const [id, n] of Object.entries(sets)) {
    const set = SETS[id];
    if (set.six6) { if (n >= 2) add(set.two); if (n >= 4) add(set.four); if (n >= 6) add(set.six); if (id === 'six_cerberus' && n >= 4) stats.defPct += 12; continue; }
    if (n >= 2) for (const [k, v] of Object.entries(set.two)) stats[k] += v;
    if (n >= 4 && !effects.includes(set.power)) effects.push(set.power);
  }
  const awaken = [];
  for (const slot of SLOTS) { const eq = equipMap?.[slot]; if (eq?.awaken && eq.dur !== 0) awaken.push(eq.awaken); }
  for (const k in CAPS) stats[k] = Math.min(CAPS[k], stats[k]);
  return { stats, effects, sets, awaken };
}

const WEIGHTS = { atk: 9, def: 7, hp: 0.55, crit: 14, critDmg: 4, speed: 10, lifesteal: 25, cdr: 20, expGain: 3, goldFind: 2, thorns: 6, regen: 8, manaCost: 6 };
export function itemScore(eq) {
  if (!eq) return 0;
  const s = itemStats(eq);
  let score = 0;
  for (const k in WEIGHTS) score += (s[k] || 0) * WEIGHTS[k];
  if (eq.effect && EFFECTS[eq.effect]) score += EFFECTS[eq.effect].tier === 'legendary' ? 900 : 350;
  if (eq.set) score += 250;
  if (eq.awaken) score += 700;
  if (isElement(eq.el)) score += 250;
  for (const gid of eq.gems || []) { const fx = parseSoul(gid); if (fx && EFFECTS[fx]) score += EFFECTS[fx].tier === 'legendary' ? 900 : 350; }
  return Math.round(score);
}

const STAT_LABEL = { atk: 'Attack', def: 'Defense', hp: 'Max HP', crit: 'Critical' };
const SIX_STAT = { atkPct: '% Attack', defPct: '% Defense', hpPct: '% Max HP', allPct: '% to all stats', bossPct: '% damage to bosses', firePct: '% fire damage', poisonPct: '% poison damage', rangedPct: '% ranged damage', healPct: '% healing done', atkSpeed: '% attack speed', regenPct: '% HP regeneration', skillRange: '% skill range', discovery: '% discovery XP', masteryPct: '% mastery gains', dmgTaken: '% damage taken' };
const SET_STAT = { atk: 'Attack', def: 'Defense', hp: 'Max HP', crit: '% Critical', critDmg: '% Crit Damage', speed: '% Move Speed', lifesteal: '% Lifesteal', cdr: '% Cooldown Reduction', expGain: '% EXP Gain', goldFind: '% Gold Find', thorns: '% Thorns', regen: ' HP per second', manaCost: '% Skill MP Cost Reduction' };
export function itemLines(eq, equipMap = null, ctx = null) {
  const R = RARITY[eq.quality] || RARITY[0], six = SIX_SETS[eq.set];
  const lines = [{ text: eq.name + (eq.enh ? ` +${eq.enh}` : ''), color: eq.set && !six ? (SETS[eq.set]?.ancient ? ANCIENT_COLOR : SET_COLOR) : R.color }];
  lines.push({ text: `${R.name}${eq.set ? ' Set' : ''} ${SLOT_INFO[eq.slot]?.label || eq.slot} · Lv ${eq.lvl}`, color: '#b6c2dc' });
  const need = Math.max(tierMin(eq.quality), six ? six.min : 0);
  if (need > 1) lines.push({ text: `Requires weapon mastery ${need}${ctx?.mastery != null ? ` (you have ${ctx.mastery})` : ''}`, color: ctx?.mastery != null && ctx.mastery < need ? '#ff8a7a' : '#b6c2dc' });
  if (eq.bound || eq.quality >= BOUND_TIER) lines.push({ text: 'Account-bound: cannot be traded', color: '#ffb35a' });
  if (eq.engraved) lines.push({ text: `Engraved: “${eq.engraved}”`, color: '#d8a060' });
  if (eq.dur != null) lines.push({ text: eq.dur === 0 ? 'BROKEN: no stats until repaired (Gorm)' : `Durability ${eq.dur}/${DUR_MAX}`, color: eq.dur === 0 ? '#ff5a4a' : eq.dur < 30 ? '#ffb35a' : '#8a94b0' });
  const k = enhMult(eq.enh || 0), ka = enhAffixMult(eq.enh || 0);
  for (const s of ['atk', 'def', 'hp']) if (eq.stats?.[s]) lines.push({ text: `${STAT_LABEL[s]} +${Math.round(eq.stats[s] * k)}`, color: '#ffffff' });
  if (eq.stats?.crit) lines.push({ text: `Critical +${r1(eq.stats.crit)}%`, color: '#ffffff' });
  if (eq.enh) lines.push({ text: `Enhanced +${eq.enh}: base stats x${k.toFixed(2)}${ka > 1 ? `, affixes x${ka.toFixed(2)}` : ''}`, color: eq.enh >= 15 ? '#ff7a4a' : eq.enh >= 10 ? '#d8a0ff' : '#8ad0ff' });
  if (isElement(eq.el)) lines.push({ text: `✦ ${ELEMENTS[eq.el].name} Infusion: ${ELEMENTS[eq.el].bonus}`, color: ELEMENTS[eq.el].color });
  for (const a of eq.affixes || []) { const def = AFFIXES[a.id]; if (def) lines.push({ text: def.label(r1(a.v * ka)), color: '#7aff7a' }); }
  if (eq.minor && MINOR_PASSIVES[eq.minor]) lines.push({ text: `Passive · ${MINOR_PASSIVES[eq.minor].name}: ${MINOR_PASSIVES[eq.minor].label}`, color: '#d8a0ff' });
  if (eq.awaken && SKILL_BY_ID[eq.awaken]) lines.push({ text: `Awakened skill · ${SKILL_BY_ID[eq.awaken].name}: +50% damage, 30% shorter cooldown, +30% reach`, color: '#ff7a6a' });
  if (eq.effect && EFFECTS[eq.effect]) {
    const e = EFFECTS[eq.effect];
    lines.push({ text: `${e.name}: ${e.desc}`, color: e.tier === 'legendary' ? '#ffe27a' : '#ffb35a' });
  }
  for (const gid of eq.gems || []) {
    const g = parseGem(gid), fx = parseSoul(gid);
    lines.push(g ? { text: `◆ ${GEM_LV[g.lv - 1]} ${GEMS[g.type].name}: ${GEMS[g.type].label(GEMS[g.type].vals[g.lv - 1])}`, color: GEMS[g.type].color }
      : fx ? { text: `✦ ${SOULS[fx]} Soulstone: ${EFFECTS[fx].desc}`, color: '#ff9ae8' } : { text: '◇ Empty socket', color: '#8a94b0' });
  }
  if (six) {
    const n = setCounts(equipMap, ctx)[eq.set] || 0, worn = new Set(SLOTS.filter((s) => equipMap?.[s]?.set === eq.set));
    const SC = R.color, line = (b) => (typeof b === 'string' ? `${EFFECTS[b].name}: ${EFFECTS[b].desc}` : Object.entries(b).map(([k, v]) => `${k === 'dmgTaken' ? '-' : '+'}${v}${SIX_STAT[k] || SET_STAT[k] || ' ' + k}`).join(', '));
    lines.push({ text: `${six.name} (${n}/6) · ${six.role}: ${six.slots.map((s) => (worn.has(s) ? '●' : '○') + ' ' + SLOT_INFO[s].label).join('  ')}`, color: SC });
    lines.push({ text: `(2) ${line(six.two)}`, color: n >= 2 ? SC : '#8a94b0' });
    lines.push({ text: `(4) ${line(six.four)}`, color: n >= 4 ? SC : '#8a94b0' });
    lines.push({ text: `(6) ${line(six.six)}`, color: n >= 6 ? SC : '#8a94b0' });
  }
  const set = eq.set && !six && SETS[eq.set];
  if (set) {
    const n = setCounts(equipMap)[eq.set] || 0, worn = new Set(SLOTS.filter((s) => equipMap?.[s]?.set === eq.set));
    const SC = set.ancient ? ANCIENT_COLOR : SET_COLOR;
    lines.push({ text: `${set.ancient ? 'Ancient ' : ''}${set.name} Set (${n}/4): ${set.slots.map((s) => (worn.has(s) ? '●' : '○') + ' ' + SLOT_INFO[s].label).join('  ')}`, color: SC });
    lines.push({ text: `(2) ${Object.entries(set.two).map(([k, v]) => `+${v}${SET_STAT[k]}`).join(', ')}`, color: n >= 2 ? SC : '#8a94b0' });
    const P = EFFECTS[set.power];
    lines.push({ text: `(4) ${P.name}: ${P.desc}`, color: n >= 4 ? SC : '#8a94b0' });
  }
  if (eq.flavor) lines.push({ text: `"${eq.flavor}"`, color: '#b6c2dc' });
  return lines;
}

export function sellPrice(eq) {
  if (!eq) return 0;
  return Math.round(12 * eq.lvl * (eq.quality + 1) * (1 + (eq.enh || 0) * 0.3) * (eq.quality >= 6 ? 4 : eq.quality >= 4 ? 2 : 1));
}
// repairing: gold by level and tier; above Legendary (Red, Ancient) also rare materials
export function repairCost(eq) {
  if (!eq || eq.dur == null || eq.dur >= DUR_MAX) return null;
  const miss = (DUR_MAX - eq.dur) / DUR_MAX;
  const c = { gold: Math.max(10, Math.round(sellPrice(eq) * 0.4 * miss)), mats: {} };
  if (eq.quality >= 6) c.mats.star_essence = Math.max(1, Math.ceil(miss * (eq.quality === 7 ? 4 : 2)));
  if (eq.quality === 7) c.mats.spirit_shard = Math.max(1, Math.ceil(miss * 6));
  return c;
}

// ---------------------------------------------------------------- progression helpers (Forge)
export function fitSockets(eq) {
  const n = Math.min(SOCKET_MAX, (SOCKETS[eq.quality] || 0) + (eq.xs || 0));
  if (!Array.isArray(eq.gems)) eq.gems = [];
  const removed = eq.gems.slice(n).filter(Boolean);
  eq.gems = eq.gems.slice(0, n);
  while (eq.gems.length < n) eq.gems.push(null);
  return removed;
}
// Reroll every affix (same count). Named effects stay.
// one bonus affix as text, at the item's enhancement level
export const affixLabel = (a, enh = 0) => { const d = AFFIXES[a.id]; return d ? d.label(r1(a.v * enhAffixMult(enh))) : a.id; };
export function reforgeItem(eq, rng = Math.random) {
  eq.affixes = rollAffixes(RARITY[eq.quality].affixes, eq.lvl, eq.quality, rng);
  return eq;
}
// Raise an item to a new level: base stats are recomputed and affix values grow along their level curve.
export function retemperItem(eq, lvl) {
  const old = eq.lvl;
  lvl = Math.max(old, Math.round(lvl));
  eq.stats = baseStats(eq.slot, lvl, eq.quality);
  for (const a of eq.affixes) {
    const d = AFFIXES[a.id]; if (!d) continue;
    const k = (d.base + d.perLvl * lvl) / (d.base + d.perLvl * old);
    a.v = r1(d.cap ? Math.min(d.cap, a.v * k) : a.v * k);
  }
  eq.lvl = lvl;
  return eq;
}
// Raise rarity by one tier. Special -> Unique and Unique -> Legendary awaken into a named item for the same slot,
// keeping level, enhancement and socketed gems. Returns gems that no longer fit (none in practice; sockets only grow).
export function ascendItem(eq, cls, rng = Math.random) {
  const q = eq.quality;
  if (eq.set) return eq; // set pieces keep their set
  if (q >= 5) return eq;
  if (q >= 3) {
    const list = (q === 3 ? UNIQUE_ITEMS : LEGENDARY_ITEMS).filter((d) => d.slot === eq.slot && (!d.cls || d.cls === cls));
    const pool = list.length ? list : (q === 3 ? UNIQUE_ITEMS : LEGENDARY_ITEMS).filter((d) => d.slot === eq.slot);
    const d = pool[Math.floor(rng() * pool.length)];
    const fresh = genNamed(d.id, { lvl: eq.lvl, cls, uid: eq.uid, rng });
    const keep = { enh: eq.enh, gems: eq.gems };
    for (const k of Object.keys(eq)) delete eq[k];
    Object.assign(eq, fresh, { enh: keep.enh, gems: keep.gems || [] });
    fitSockets(eq);
    return eq;
  }
  const nq = q + 1;
  eq.quality = nq;
  eq.stats = baseStats(eq.slot, eq.lvl, nq);
  const have = new Set(eq.affixes.map((a) => a.id));
  const ids = Object.keys(AFFIXES).filter((id) => !have.has(id));
  while (eq.affixes.length < RARITY[nq].affixes && ids.length) {
    const id = ids.splice(Math.floor(rng() * ids.length), 1)[0];
    eq.affixes.push({ id, v: AFFIXES[id].roll(eq.lvl, nq, rng) });
  }
  const words = eq.name.split(' ');
  const all = PREFIX.flat();
  if (all.includes(words[0])) { words[0] = PREFIX[nq][PREFIX[q].indexOf(words[0]) === 1 ? 1 : 0]; eq.name = words.join(' '); }
  fitSockets(eq);
  return eq;
}
