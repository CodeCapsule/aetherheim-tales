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
