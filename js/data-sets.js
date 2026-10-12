// Dungeon sets: every dungeon's chest can hold one of four pieces of its own set. Two pieces add stats; all four
// unlock a set power found nowhere else. Set pieces are Unique-strength gear (they cannot be ascended).
export const SET_COLOR = '#5aff9a';
export const SETS = {
  set_d1: { name: 'Mossheart', dungeon: 'd1', slots: ['helm', 'armor', 'boots', 'ring'],
    two: { crit: 4, lifesteal: 3 }, power: 'set_mossmend' },
  set_d2: { name: 'Gravewarden', dungeon: 'd2', slots: ['helm', 'armor', 'boots', 'necklace'],
    two: { thorns: 10, critDmg: 8 }, power: 'set_gravepact' },
  set_d3: { name: 'Rootbound', dungeon: 'd3', slots: ['helm', 'armor', 'boots', 'ring'],
    two: { cdr: 6, speed: 4 }, power: 'set_entangle' },
  set_d4: { name: 'Hivemind', dungeon: 'd4', slots: ['helm', 'armor', 'boots', 'necklace'],
    two: { critDmg: 10, speed: 5 }, power: 'set_swarm' },
  set_d5: { name: 'Tidecaller', dungeon: 'd5', slots: ['helm', 'armor', 'boots', 'ring'],
    two: { cdr: 8, manaCost: 10 }, power: 'set_riptide' },
  set_d6: { name: 'Forgeborn', dungeon: 'd6', slots: ['helm', 'armor', 'boots', 'necklace'],
    two: { thorns: 12, lifesteal: 4 }, power: 'set_moltencore' },
  set_d7: { name: 'Frostfang', dungeon: 'd7', slots: ['helm', 'armor', 'boots', 'ring'],
    two: { crit: 6, critDmg: 12 }, power: 'set_shatter' },
  set_d8: { name: 'Prismatic', dungeon: 'd8', slots: ['helm', 'armor', 'boots', 'necklace'],
    two: { expGain: 10, goldFind: 12, crit: 3 }, power: 'set_refraction' },
  set_d9: { name: 'Shadeweaver', dungeon: 'd9', slots: ['helm', 'armor', 'boots', 'ring'],
    two: { lifesteal: 5, crit: 6 }, power: 'set_soulharvest' },
  set_d10: { name: 'Starborn', dungeon: 'd10', slots: ['helm', 'armor', 'boots', 'necklace'],
    two: { cdr: 10, speed: 6 }, power: 'set_constellation' },
  set_d11: { name: 'Worldsoul', dungeon: 'd11', slots: ['helm', 'armor', 'boots', 'ring'],
    two: { crit: 8, critDmg: 15, lifesteal: 6 }, power: 'set_covenant' },
};
for (const [id, s] of Object.entries(SETS)) s.id = id;
export const setOfDungeon = (dungeonId) => Object.values(SETS).find((s) => s.dungeon === dungeonId) || null;

// four-piece powers (added to EFFECTS in loot.js; the combat code in game.js reacts to them)
export const SET_EFFECTS = {
  set_mossmend: { id: 'set_mossmend', tier: 'set', name: 'Moss Mend', desc: 'Every kill heals you for 3% of Max HP.' },
  set_gravepact: { id: 'set_gravepact', tier: 'set', name: 'Grave Pact', desc: 'Falling below 30% HP grants a shield of 25% Max HP (once every 45s).' },
  set_entangle: { id: 'set_entangle', tier: 'set', name: 'Entangle', desc: '12% chance on hit to root the enemy for 2s (not bosses); rooted enemies take 15% more damage.' },
  set_swarm: { id: 'set_swarm', tier: 'set', name: 'Swarm', desc: 'Every 5th hit releases 3 bees that sting the target for 60% Attack each.' },
  set_riptide: { id: 'set_riptide', tier: 'set', name: 'Riptide', desc: 'Skills deal 18% more damage, and casting one restores 3% Max MP.' },
  set_moltencore: { id: 'set_moltencore', tier: 'set', name: 'Molten Core', desc: 'Enemies that hit you burn for 30% of your Attack per second for 3s.' },
  set_shatter: { id: 'set_shatter', tier: 'set', name: 'Shatter', desc: 'Critical hits freeze the enemy for 1s (not bosses); frozen enemies take 30% more damage.' },
  set_refraction: { id: 'set_refraction', tier: 'set', name: 'Refraction', desc: '18% chance on hit to fire a prism beam that hits again for 150% Attack.' },
  set_soulharvest: { id: 'set_soulharvest', tier: 'set', name: 'Soul Harvest', desc: 'Kills grant +4% Attack and +4% Crit Damage for 10s, stacking up to 5 times.' },
  set_constellation: { id: 'set_constellation', tier: 'set', name: 'Constellation', desc: 'Every 10s, your next skill deals double damage.' },
  set_covenant: { id: 'set_covenant', tier: 'set', name: 'Spirit Covenant', desc: 'Deal 15% more damage and take 15% less damage.' },
};

// Ancient sets: drop only in the Danger Zone (see data-dz.js). Stronger than dungeon sets, with powers that also
// work against other players.
export const ANCIENT_COLOR = '#ff6a3a';
export const ANCIENT_SETS = {
  set_anc_blood: { name: 'Bloodmoon', slots: ['helm', 'armor', 'boots', 'ring'], two: { lifesteal: 6, crit: 6 }, power: 'anc_bloodthirst' },
  set_anc_dread: { name: 'Dreadforge', slots: ['helm', 'armor', 'boots', 'necklace'], two: { thorns: 15, critDmg: 15 }, power: 'anc_dread' },
  set_anc_void: { name: 'Voidwalker', slots: ['helm', 'armor', 'boots', 'ring'], two: { cdr: 10, speed: 8 }, power: 'anc_void' },
  set_anc_king: { name: 'Kingslayer', slots: ['helm', 'armor', 'boots', 'necklace'], two: { crit: 8, critDmg: 20 }, power: 'anc_king' },
};
for (const [id, s] of Object.entries(ANCIENT_SETS)) { s.id = id; s.ancient = true; SETS[id] = s; }
Object.assign(SET_EFFECTS, {
  anc_bloodthirst: { id: 'anc_bloodthirst', tier: 'ancient', name: 'Bloodthirst', desc: 'Every kill (monster or player) heals 8% of Max HP and grants +25% Attack for 6s.' },
  anc_dread: { id: 'anc_dread', tier: 'ancient', name: 'Dread Bulwark', desc: 'Take 20% less damage; monsters that hit you are stunned for 1s 15% of the time (not bosses).' },
  anc_void: { id: 'anc_void', tier: 'ancient', name: 'Void Rift', desc: 'Every 8s your next hit tears a void rift: 400% Attack to the target and every enemy within 5m.' },
  anc_king: { id: 'anc_king', tier: 'ancient', name: 'Kingslayer', desc: 'Deal 30% more damage to players, elites and bosses.' },
});

// ---------------------------------------------------------------- six-piece sets (helmet, armor, gloves, boots,
// necklace, ring; weapons sit outside sets). Bonuses at 2, 4 and 6 pieces: a stat object or a power id.
// tier = item quality (2 Rare ... 7 Ancient); min = minimum level and weapon mastery for a piece to count.
export const SIX_SLOTS = ['helm', 'armor', 'gloves', 'boots', 'necklace', 'ring'];
const P6 = (helm, armor, gloves, boots, necklace, ring) => ({ helm, armor, gloves, boots, necklace, ring });
export const SIX_SETS = {
  six_wayfarer: { name: "Wayfarer's Garb", tier: 2, min: 20, role: 'Explorer', two: { speed: 5 }, four: { discovery: 10 }, six: 'six_wayfarer6', source: 'Field elites (Lv 20+) and Trial II: Lost Road',
    pieces: P6("Wayfarer's Hood", "Wayfarer's Coat", "Wayfarer's Gloves", "Wayfarer's Boots", 'Compass Pendant', 'Waymark Ring') },
  six_ironbound: { name: 'Ironbound Guard', tier: 2, min: 30, role: 'Tank', two: { defPct: 8 }, four: 'set_ironbound4', six: 'set_ironbound6', source: 'Drowned Temple',
    pieces: P6('Ironbound Helm', 'Ironbound Plate', 'Ironbound Gauntlets', 'Ironbound Greaves', 'Ironbound Gorget', 'Ironbound Seal') },
  six_shadowstep: { name: 'Shadowstep', tier: 3, min: 50, role: 'Assassin', two: { crit: 6 }, four: 'set_shadowstep4', six: 'set_shadowstep6', source: 'Hidden ruins and discovery chests',
    pieces: P6('Shadowstep Cowl', 'Shadowstep Leathers', 'Shadowstep Wraps', 'Shadowstep Treads', 'Shadowstep Locket', 'Shadowstep Band') },
  six_emberheart: { name: 'Emberheart', tier: 4, min: 70, role: 'Mage', two: { firePct: 10 }, four: 'six_ember4', six: 'six_ember6', source: 'World bosses (Lv 70+)',
    pieces: P6('Emberheart Circlet', 'Emberheart Robe', 'Emberheart Gloves', 'Emberheart Slippers', 'Emberheart Amulet', 'Emberheart Ring') },
  six_tidewarden: { name: 'Tidewarden', tier: 4, min: 90, role: 'Healer', two: { healPct: 10 }, four: 'six_tide4', six: 'six_tide6', source: 'Frostfang Citadel',
    pieces: P6('Tidewarden Crown', 'Tidewarden Vestments', 'Tidewarden Gloves', 'Tidewarden Sandals', 'Tidewarden Pearl', 'Tidewarden Ring') },
  six_fallenking: { name: 'Crown of the Fallen King', tier: 5, min: 110, role: 'Warrior', two: { atkPct: 12 }, four: { bossPct: 15 }, six: 'six_king6', source: 'Prism Labyrinth',
    pieces: P6('Crown of the Fallen King', 'Mantle of the Fallen King', 'Grip of the Fallen King', 'March of the Fallen King', 'Chain of the Fallen King', 'Signet of the Fallen King') },
  six_bloodsworn: { name: 'Bloodsworn Pact', tier: 6, min: 150, role: 'Berserker', two: { atkSpeed: 15 }, four: 'six_blood4', six: 'six_blood6', source: 'Trials VII–IX and Necropolis of Shades',
    pieces: P6('Bloodsworn Visage', 'Bloodsworn Hauberk', 'Bloodsworn Claws', 'Bloodsworn Stride', 'Bloodsworn Oath', 'Bloodsworn Ring') },
  six_firstdawn: { name: 'Relics of the First Dawn', tier: 7, min: 190, role: 'Any class', two: { allPct: 20 }, four: { masteryPct: 25 }, six: 'six_dawn6', source: 'Final Ascension and the ancient ruins of the Bloodmoon Wastes',
    pieces: P6('Dawnbringer Crown', 'First Light Raiment', 'Hands of Morning', 'Daybreak Treads', 'Sunrise Torc', 'Ring of the First Dawn') },
  // beast sets
  six_minotaur: { name: 'Minotaur', tier: 2, min: 25, role: 'Warrior', beast: true, two: { atkPct: 6 }, four: 'six_mino4', six: 'six_mino6', source: 'Sunpetal Hive',
    pieces: P6('Horned Helm', 'Bullhide Armor', 'Ironfist Gloves', 'Stampede Boots', 'Labyrinth Pendant', 'Brass Nose Ring') },
  six_griffin: { name: 'Griffin', tier: 3, min: 45, role: 'Ranger', beast: true, two: { speed: 6 }, four: { rangedPct: 10 }, six: 'six_griffin6', source: 'Elites of the Whispering Marsh and beyond (Lv 45+)',
    pieces: P6('Talon Crest Helm', 'Featherweave Armor', 'Clawgrip Gloves', 'Windstride Boots', 'Sky Eye Necklace', 'Gale Ring') },
  six_basilisk: { name: 'Basilisk', tier: 3, min: 55, role: 'Rogue', beast: true, two: { poisonPct: 8 }, four: 'six_basi4', six: 'six_basi6', source: 'Molten Forge',
    pieces: P6('Serpent Gaze Helm', 'Scaleguard Armor', 'Venomtouch Gloves', 'Slither Boots', 'Stoneheart Pendant', 'Fang Ring') },
  six_hydra: { name: 'Hydra', tier: 4, min: 75, role: 'Bruiser', beast: true, two: { regenPct: 10 }, four: 'six_hydra4', six: 'six_hydra6', source: 'World bosses (Lv 75+)',
    pieces: P6('Many-Headed Crown', 'Regrowth Mail', 'Venomclaw Gloves', 'Marshwalker Boots', 'Hydra Heart Necklace', 'Coil Ring') },
  six_kraken: { name: 'Kraken', tier: 4, min: 95, role: 'Controller', beast: true, two: { skillRange: 10 }, four: 'six_kraken4', six: 'six_kraken6', source: 'Frostfang Citadel',
    pieces: P6('Abyssal Helm', 'Deepsea Plate', 'Tentacle Grips', 'Tidewalker Boots', 'Ink Pearl Necklace', 'Whirlpool Ring') },
  six_cerberus: { name: 'Cerberus', tier: 5, min: 120, role: 'Tank', beast: true, two: { hpPct: 10 }, four: 'six_cerb4', six: 'six_cerb6', source: 'Prism Labyrinth',
    pieces: P6('Helm of Three Heads', 'Hellhide Armor', 'Hellclaw Gloves', 'Ashstride Boots', 'Fang of the Gate Necklace', 'Chainbound Ring') },
  six_phoenix: { name: 'Phoenix', tier: 5, min: 130, role: 'Fire mage', beast: true, two: { firePct: 12 }, four: 'six_phoenix4', six: 'six_phoenix6', source: 'Necropolis of Shades',
    pieces: P6('Flamecrest Helm', 'Emberplume Armor', 'Cinder Gloves', 'Ashrise Boots', 'Rebirth Feather Necklace', 'Sunfire Ring') },
  six_fenrir: { name: 'Fenrir', tier: 6, min: 160, role: 'Duelist', beast: true, two: { critDmg: 15 }, four: 'six_fenrir4', six: 'six_fenrir6', source: 'Trial VIII: Gauntlet and the Astral Sanctum',
    pieces: P6('Wolfskull Helm', 'Moonfang Armor', 'Ripper Gloves', 'Howlrunner Boots', 'Broken Chain Necklace', 'Ragnarok Ring') },
  six_jormungandr: { name: 'Jörmungandr', tier: 7, min: 195, role: 'Any class', beast: true, two: { allPct: 20 }, four: { dmgTaken: 10 }, six: 'six_jorm6', source: 'Final Ascension and the World Serpent of the Bloodmoon Wastes',
    pieces: P6('Crown of the World Serpent', 'Coil of Ages Armor', "Serpent's Grip Gloves", 'Tideless Boots', 'Ouroboros Necklace', 'Endless Ring') },
};
for (const [id, s] of Object.entries(SIX_SETS)) { s.id = id; s.slots = SIX_SLOTS; s.six6 = true; SETS[id] = s; }
// which dungeon chest can hold which six-piece set (in addition to the dungeon's own four-piece set)
export const SIX_BY_DUNGEON = { d4: ['six_minotaur'], d5: ['six_ironbound'], d6: ['six_basilisk'], d7: ['six_tidewarden', 'six_kraken'], d8: ['six_fallenking', 'six_cerberus'], d9: ['six_bloodsworn', 'six_phoenix'], d10: ['six_fenrir'] };
export const SIX_EFFECTS = {
  six_wayfarer6: { id: 'six_wayfarer6', tier: 'set', name: 'Pathfinder', desc: 'You uncover the map in a 30 m radius as you walk.' },
  set_ironbound4: { id: 'set_ironbound4', tier: 'set', name: 'Iron Wall', desc: '+10% block chance.' },
  set_ironbound6: { id: 'set_ironbound6', tier: 'set', name: 'Iron Reprisal', desc: 'Blocks (and perfect blocks) reflect 20% of the damage.' },
  set_shadowstep4: { id: 'set_shadowstep4', tier: 'set', name: 'Fleeting Shadow', desc: 'A perfect dodge cuts one skill cooldown by 3 s.' },
  set_shadowstep6: { id: 'set_shadowstep6', tier: 'set', name: 'Shadow Strike', desc: 'Your next hit after a perfect dodge deals +40% damage.' },
  six_ember4: { id: 'six_ember4', tier: 'set', name: 'Wildfire', desc: 'Your burns spread to 1 nearby enemy.' },
  six_ember6: { id: 'six_ember6', tier: 'set', name: 'Ember Nova', desc: 'Every 5th spell releases an Ember Nova around you (180% Attack).' },
  six_tide4: { id: 'six_tide4', tier: 'set', name: 'Tidal Ward', desc: 'Your heals also grant a shield of 5% Max HP.' },
  six_tide6: { id: 'six_tide6', tier: 'set', name: 'Lifeline', desc: 'You or an ally falling under 30% HP is healed for 30% at once (60 s cooldown).' },
  six_king6: { id: 'six_king6', tier: 'set', name: 'Last Stand', desc: 'Lethal damage leaves you at 1 HP instead, once per dungeon (or every 10 minutes outside).' },
  six_blood4: { id: 'six_blood4', tier: 'set', name: 'Blood Price', desc: 'Each kill restores 3% Max HP.' },
  six_blood6: { id: 'six_blood6', tier: 'set', name: 'Bloodsworn', desc: 'Below 40% HP, all your skills use their awakened form (+50% damage, 30% shorter cooldowns).' },
  six_dawn6: { id: 'six_dawn6', tier: 'ancient', name: 'Ancient Aura', desc: 'You and party members near you gain +10% to all stats.' },
  six_mino4: { id: 'six_mino4', tier: 'set', name: 'Gore', desc: 'Charge skills (dashes and leaps) stun for 1 s.' },
  six_mino6: { id: 'six_mino6', tier: 'set', name: 'Guardbreaker', desc: "Charges break a boss's guard for 3 s: it takes 25% more damage." },
  six_griffin6: { id: 'six_griffin6', tier: 'set', name: 'Sky Dive', desc: 'Every 15 s your dodge roll becomes a 10 m dive, and your next hit is a guaranteed critical.' },
  six_basi4: { id: 'six_basi4', tier: 'set', name: 'Numbing Venom', desc: 'Enemies you poison move 15% slower.' },
  six_basi6: { id: 'six_basi6', tier: 'set', name: 'Gaze', desc: 'Every 30 s, petrify your target (not bosses) for 3 s.' },
  six_hydra4: { id: 'six_hydra4', tier: 'set', name: 'Venom Stacks', desc: 'Each hit stacks venom on the target, up to 5 (each stack deals 4% Attack per second).' },
  six_hydra6: { id: 'six_hydra6', tier: 'set', name: 'Regrowth', desc: 'Below 25% HP, heal 30% of Max HP (once every 3 minutes).' },
  six_kraken4: { id: 'six_kraken4', tier: 'set', name: 'Undertow', desc: 'Area skills root enemies for 1 s.' },
  six_kraken6: { id: 'six_kraken6', tier: 'set', name: 'Tentacles', desc: 'Every 6th skill summons tentacles that pull nearby enemies in and deal 150% Attack.' },
  six_cerb4: { id: 'six_cerb4', tier: 'set', name: 'Hellhide', desc: '+12% Defense, and attackers have a 15% chance to catch hellfire.' },
  six_cerb6: { id: 'six_cerb6', tier: 'set', name: 'Three Heads', desc: 'Each hit you take adds a guard charge; at 3, Hellfire Howl fears nearby enemies for 2 s (20 s cooldown).' },
  six_phoenix4: { id: 'six_phoenix4', tier: 'set', name: 'Cinders', desc: 'Kills with fire skills heal you for 2% Max HP.' },
  six_phoenix6: { id: 'six_phoenix6', tier: 'set', name: 'Rebirth', desc: 'Revive at 50% HP once per dungeon (or every 10 minutes outside).' },
  six_fenrir4: { id: 'six_fenrir4', tier: 'set', name: 'Frenzy of the Wolf', desc: 'Each kill grants +5% attack speed for 10 s, stacking 4 times.' },
  six_fenrir6: { id: 'six_fenrir6', tier: 'set', name: 'Ragnarok Bite', desc: 'Your hits ignore 25% of Defense and deal double damage to bosses under 20% HP.' },
  six_jorm6: { id: 'six_jorm6', tier: 'ancient', name: 'World Coil', desc: 'Once per fight, encircle the arena: enemies within 12 m take 5% of their Max HP per second for 6 s.' },
};
Object.assign(SET_EFFECTS, SIX_EFFECTS);
