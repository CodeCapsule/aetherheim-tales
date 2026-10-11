// Skill trees: three branches per class. Each branch is five tiers; a tier opens once enough points are spent in
// that branch (TIER_PTS). Nodes are passive: stat boosts, skill masteries (more damage or shorter cooldown for one
// skill), passive effects, and one capstone per branch. game.js and skilltree.js read `k` (the kind) and `v` (the
// value per rank). Points come from levels (skillPoints) and can be reset for gold.
export const TIER_PTS = [0, 0, 5, 10, 20, 30]; // index = tier
export const skillPoints = (lv) => Math.max(0, Math.min(lv - 1, 49) + Math.max(0, Math.floor((lv - 50) / 4)));
export const resetCost = (lv) => 200 * lv;

// N(id, tier, name, icon, max ranks, kind, value per rank, description with {v} = total value, extra fields)
const N = (id, t, n, icon, max, k, v, d, x = {}) => ({ id, t, n, icon, max, k, v, d, ...x });
const S = (id, t, n, icon, key, v, d) => N(id, t, n, icon, 5, 'stat', v, d, { key });
const M = (id, t, sk, n, v = 12) => N(id, t, n, sk, 5, 'skill', v, `${n.replace(' Mastery', '')} deals {v}% more damage.`, { sk });
const MC = (id, t, sk, n, v = 8) => N(id, t, n, sk, 5, 'skillCd', v, `${n.replace(' Mastery', '')} cools down {v}% faster.`, { sk });

export const SKILL_TREES = {
  knight: [
    { name: 'Bulwark', color: '#d9a441', nodes: [
      S('kn_tough', 1, 'Toughness', 'hp_potion', 'hpPct', 4, '+{v}% Max HP.'),
      S('kn_iron', 1, 'Iron Skin', 'elixir_iron', 'defPct', 4, '+{v}% Defense.'),
      M('kn_bash', 2, 'k3', 'Shield Bash Mastery', 15),
      N('kn_stand', 2, 'Last Stand', 'armor', 3, 'lowHpDr', 6, 'Below 35% HP you take {v}% less damage.'),
      S('kn_regen', 3, 'Second Wind', 'potion', 'regen', 0.4, 'Restore {v}% of Max HP every 5s.'),
      MC('kn_bast', 3, 'k5', 'Iron Bastion Mastery'),
      N('kn_retri', 4, 'Retribution', 'soul_thorn_aura', 3, 'reflect', 6, 'Reflect {v}% of the damage you take back at the attacker.'),
      N('kn_unbreak', 5, 'Unbreakable', 'soul_worldtree', 1, 'lastStand', 30, 'Capstone: falling below 25% HP wraps you in a shield worth {v}% of Max HP (once every 60s).'),
    ] },
    { name: 'Warlord', color: '#ff7a4a', nodes: [
      S('kn_might', 1, 'Might', 'elixir_might', 'atkPct', 3, '+{v}% Attack.'),
      S('kn_prec', 1, 'Precision', 'star', 'crit', 1.5, '+{v}% Critical chance.'),
      M('kn_heavy', 2, 'k1', 'Heavy Strike Mastery'),
      N('kn_cleave', 2, 'Cleave', 'k2', 3, 'cleave', 20, 'Basic attacks also hit enemies within 3m of the target for {v}% of the damage.'),
      S('kn_brut', 3, 'Brutality', 'skull', 'critDmg', 6, '+{v}% Critical Damage.'),
      M('kn_whirl', 3, 'k2', 'Whirlwind Mastery'),
      N('kn_blood', 4, 'Bloodlust', 'soul_frenzy', 3, 'killHeal', 2, 'Every kill restores {v}% of Max HP.'),
      N('kn_shock', 5, 'Earthbreaker', 'soul_meteor_proc', 1, 'shockwave', 200, 'Capstone: every 4th skill you cast sends out a shockwave dealing {v}% Attack to all enemies within 6m.'),
    ] },
    { name: 'Crusader', color: '#7ad0ff', nodes: [
      S('kn_vigor', 1, 'Vigor', 'mp_potion', 'mpPct', 6, '+{v}% Max MP.'),
      S('kn_march', 1, 'Steadfast March', 'elixir_swift', 'speedPct', 2, '+{v}% movement speed.'),
      M('kn_quake', 2, 'k4', 'Earthshatter Mastery'),
      N('kn_stagger', 2, 'Stagger', 'soul_stun_chance', 3, 'stunChance', 4, '{v}% chance on hit to stun the enemy for 1s (not bosses).'),
      S('kn_will', 3, 'Willpower', 'timer', 'cdr', 2, 'Skill cooldowns {v}% shorter.'),
      M('kn_titan', 3, 'k6', "Titan's Wrath Mastery", 10),
      N('kn_hymn', 4, 'Battle Hymn', 'crown', 3, 'castBuff', 3, 'Casting a skill grants +{v}% Attack for 6s, stacking up to 3 times.'),
      N('kn_avatar', 5, 'Avatar of Earth', 'el_earth', 1, 'empower', 25, 'Capstone: while Iron Bastion is up you deal {v}% more damage and every hit heals 1% of Max HP.', { sk: 'k5' }),
    ] },
  ],
  assassin: [
    { name: 'Shadow', color: '#b07aff', nodes: [
      S('as_edge', 1, 'Keen Edge', 'star', 'crit', 1.5, '+{v}% Critical chance.'),
      S('as_lethal', 1, 'Lethality', 'skull', 'critDmg', 6, '+{v}% Critical Damage.'),
      M('as_ss', 2, 'a1', 'Shadow Strike Mastery'),
      N('as_ambush', 2, 'Ambush', 'a1', 3, 'opener', 20, '+{v}% damage to enemies above 90% HP.'),
      N('as_exploit', 3, 'Exploit Weakness', 'soul_executioner', 5, 'execute', 6, '+{v}% damage to enemies below 30% HP.'),
      M('as_tf', 3, 'a2', 'Twin Fangs Mastery'),
      N('as_rush', 4, 'Blood Rush', 'soul_crit_heal', 3, 'critHeal', 4, 'Critical hits heal you for {v}% of the damage dealt.'),
      N('as_mark', 5, 'Death Mark', 'soul_executioner', 1, 'deathmark', 60, 'Capstone: critical hits mark the enemy for 4s; your next hit on a marked enemy deals {v}% more damage.'),
    ] },
    { name: 'Venom', color: '#7aff6a', nodes: [
      N('as_toxin', 1, 'Toxicology', 'a3', 5, 'dotAmp', 10, 'Poisons you apply deal {v}% more damage.'),
      S('as_agile', 1, 'Agility', 'elixir_swift', 'speedPct', 2, '+{v}% movement speed.'),
      M('as_venom', 2, 'a3', 'Venom Edge Mastery'),
      N('as_envenom', 2, 'Envenom', 'glow_spore', 3, 'poisonChance', 6, '{v}% chance on hit to poison the enemy for 40% Attack per second for 4s.'),
      M('as_gale', 3, 'a4', 'Gale Fan Mastery'),
      S('as_leech', 3, 'Leech', 'soul_crit_heal', 'lifesteal', 1, '+{v}% Lifesteal.'),
      N('as_evade', 4, 'Evasion', 'wings', 3, 'dodge', 3, '{v}% chance to dodge enemy attacks.'),
      N('as_plague', 5, 'Plague Bearer', 'jelly_gel', 1, 'plague', 150, 'Capstone: poisoned enemies burst when they die, dealing {v}% Attack to all enemies within 5m and poisoning them.'),
    ] },
    { name: 'Tempest', color: '#59e0a4', nodes: [
      S('as_fury', 1, 'Ferocity', 'elixir_might', 'atkPct', 3, '+{v}% Attack.'),
      S('as_vital', 1, 'Vitality', 'hp_potion', 'hpPct', 4, '+{v}% Max HP.'),
      M('as_dance', 2, 'a6', 'Tempest Dance Mastery', 10),
      N('as_flurry', 2, 'Flurry', 'soul_double_strike', 3, 'doubleHit', 6, 'Basic attacks have a {v}% chance to strike twice.'),
      MC('as_veil', 3, 'a5', 'Phantom Veil Mastery'),
      S('as_quick', 3, 'Quickness', 'timer', 'cdr', 2, 'Skill cooldowns {v}% shorter.'),
      N('as_wind', 4, 'Windrunner', 'soul_swift', 3, 'killHaste', 0.5, 'Every kill takes {v}s off all your skill cooldowns.'),
      N('as_phantom', 5, 'Phantom Blades', 'a6', 1, 'phantom', 120, 'Capstone: every 6th hit, phantom blades strike up to 3 nearby enemies for {v}% Attack each.'),
    ] },
  ],
  mage: [
    { name: 'Pyromancy', color: '#ff7a3d', nodes: [
      S('mg_fire', 1, 'Fire Affinity', 'elixir_might', 'atkPct', 3, '+{v}% Attack.'),
      S('mg_focus', 1, 'Searing Focus', 'star', 'crit', 1.5, '+{v}% Critical chance.'),
      M('mg_fb', 2, 'm1', 'Fireball Mastery'),
      N('mg_ignite', 2, 'Ignite', 'm0', 3, 'burnChance', 8, '{v}% chance on hit to set the enemy ablaze for 40% Attack per second for 3s.'),
      M('mg_pillar', 3, 'm2', 'Flame Pillar Mastery'),
      S('mg_combust', 3, 'Combustion', 'skull', 'critDmg', 6, '+{v}% Critical Damage.'),
      N('mg_pyro', 4, 'Pyroclasm', 'm4', 3, 'aoeAmp', 8, 'Area skills deal {v}% more damage.'),
      N('mg_meteor', 5, 'Meteor Shower', 'soul_meteor_proc', 1, 'meteorShower', 220, 'Capstone: critical skill hits have a 25% chance to call a meteor for {v}% Attack in an area (every 5s at most).'),
    ] },
    { name: 'Arcane', color: '#7a9aff', nodes: [
      S('mg_mind', 1, 'Arcane Mind', 'mp_potion', 'mpPct', 6, '+{v}% Max MP.'),
      S('mg_flow', 1, 'Mana Flow', 'elixir_wisdom', 'mregen', 0.5, 'Restore {v}% of Max MP every 5s.'),
      M('mg_ring', 2, 'm3', 'Blazing Ring Mastery'),
      MC('mg_barrier', 2, 'm5', 'Arcane Barrier Mastery'),
      S('mg_haste', 3, 'Arcane Haste', 'timer', 'cdr', 2, 'Skill cooldowns {v}% shorter.'),
      N('mg_chain', 3, 'Arcane Chain', 'soul_chain', 3, 'chainChance', 5, '{v}% chance on hit to chain lightning to 2 more enemies for 80% Attack.'),
      N('mg_siphon', 4, 'Soul Siphon', 'soul_mana_font', 3, 'killMp', 2, 'Every kill restores {v}% of Max MP.'),
      N('mg_surge', 5, 'Arcane Surge', 'soul_starfall', 1, 'arcaneSurge', 50, 'Capstone: every 10s your next skill costs no MP and deals {v}% more damage.'),
    ] },
    { name: 'Cataclysm', color: '#ffb84a', nodes: [
      S('mg_ward', 1, 'Warding', 'elixir_iron', 'defPct', 4, '+{v}% Defense.'),
      S('mg_vit', 1, 'Fortitude', 'hp_potion', 'hpPct', 4, '+{v}% Max HP.'),
      M('mg_met', 2, 'm4', 'Meteor Mastery'),
      N('mg_conc', 2, 'Concussion', 'soul_stun_chance', 3, 'stunChance', 4, '{v}% chance on hit to stun the enemy for 1s (not bosses).'),
      M('mg_inferno', 3, 'm6', 'Inferno Mastery', 10),
      S('mg_heart', 3, 'Phoenix Heart', 'potion', 'regen', 0.4, 'Restore {v}% of Max HP every 5s.'),
      N('mg_blaze', 4, 'Cinder Feast', 'soul_frenzy', 3, 'killHeal', 2, 'Every kill restores {v}% of Max HP.'),
      N('mg_phoenix', 5, 'Phoenix Rising', 'soul_phoenix', 1, 'phoenixRise', 50, 'Capstone: once every 4 minutes a killing blow revives you with {v}% HP in a burst of flame dealing 300% Attack around you.'),
    ] },
  ],
  priest: [
    { name: 'Holy', color: '#ffe46a', nodes: [
      S('pr_grace', 1, 'Grace', 'p2', 'healPct', 6, 'Your heals restore {v}% more.'),
      S('pr_light', 1, 'Inner Light', 'hp_potion', 'hpPct', 4, '+{v}% Max HP.'),
      MC('pr_heal', 2, 'p2', 'Healing Light Mastery'),
      N('pr_renew', 2, 'Renewal', 'soul_holy_nova', 3, 'castHeal', 1.5, 'Every skill you cast heals you for {v}% of Max HP.'),
      M('pr_sanct', 3, 'p6', 'Sanctuary Mastery', 10),
      S('pr_devot', 3, 'Devotion', 'mp_potion', 'mpPct', 6, '+{v}% Max MP.'),
      N('pr_aegis', 4, 'Aegis', 'armor', 3, 'lowHpDr', 6, 'Below 35% HP you take {v}% less damage.'),
      N('pr_over', 5, 'Divine Overflow', 'soul_holy_nova', 1, 'overheal', 30, 'Capstone: healing beyond your Max HP becomes a shield, up to {v}% of Max HP.'),
    ] },
    { name: 'Tide', color: '#3fb4ff', nodes: [
      S('pr_tide', 1, 'Tidecaller', 'elixir_might', 'atkPct', 3, '+{v}% Attack.'),
      S('pr_focus', 1, 'Focus', 'star', 'crit', 1.5, '+{v}% Critical chance.'),
      M('pr_orb', 2, 'p1', 'Aqua Orb Mastery'),
      N('pr_under', 2, 'Undertow', 'soul_chain', 3, 'chainChance', 5, '{v}% chance on hit to chain to 2 more enemies for 80% Attack.'),
      M('pr_wave', 3, 'p3', 'Tidal Wave Mastery'),
      S('pr_depth', 3, 'Crushing Depths', 'skull', 'critDmg', 6, '+{v}% Critical Damage.'),
      N('pr_drown', 4, 'Drown', 'soul_executioner', 3, 'execute', 8, '+{v}% damage to enemies below 30% HP.'),
      N('pr_tsunami', 5, 'Tsunami', 'p3', 1, 'shockwave', 220, 'Capstone: every 4th skill you cast releases a great wave dealing {v}% Attack to all enemies within 6m.'),
    ] },
    { name: 'Blessing', color: '#9affd0', nodes: [
      S('pr_bless', 1, 'Blessed Skin', 'elixir_iron', 'defPct', 4, '+{v}% Defense.'),
      S('pr_spring', 1, 'Wellspring', 'elixir_wisdom', 'mregen', 0.5, 'Restore {v}% of Max MP every 5s.'),
      M('pr_prison', 2, 'p4', 'Aqua Prison Mastery'),
      N('pr_ward', 2, 'Holy Ward', 'wings', 3, 'dodge', 3, '{v}% chance to dodge enemy attacks.'),
      MC('pr_divine', 3, 'p5', 'Divine Blessing Mastery'),
      S('pr_swift', 3, 'Swift Prayer', 'timer', 'cdr', 2, 'Skill cooldowns {v}% shorter.'),
      N('pr_hymn', 4, 'Hymn of Valor', 'crown', 3, 'castBuff', 3, 'Casting a skill grants +{v}% Attack for 6s, stacking up to 3 times.'),
      N('pr_avatar', 5, 'Avatar of Water', 'el_water', 1, 'empower', 25, 'Capstone: while Divine Blessing is up you deal {v}% more damage and every hit heals 1% of Max HP.', { sk: 'p5' }),
    ] },
  ],
};
export const TREE_NODES = {};
for (const [cls, tree] of Object.entries(SKILL_TREES)) tree.forEach((br, b) => br.nodes.forEach((n) => { n.cls = cls; n.branch = b; TREE_NODES[n.id] = n; }));
const fmtV = (x) => String(Math.round(x * 10) / 10);
// a node's description at a rank (rank 0 shows the first rank)
export const nodeText = (n, rank) => n.d.replace(/\{v\}/g, fmtV(n.v * Math.max(1, rank)));
