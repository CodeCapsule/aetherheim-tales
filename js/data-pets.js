// Pet abilities: every pet brings one power of its own while it is summoned. The number grows with the pet's
// level, from `lo` at Lv 1 to `hi` at Lv 60; the game reads `kind` (see game.js recalc, damage and updatePet).
export const PET_MAX_LV = 60;
const A = (name, kind, lo, hi, text) => ({ name, kind, lo, hi, text });
export const PET_ABILITIES = {
  pet_icecream: A('Sweet Treat', 'heal', 1.5, 3, 'Heals you for {v}% of Max HP every 5s.'),
  pet_cat: A('Lucky Paw', 'luck', 5, 15, '+{v}% chance for monsters to drop gear, and better rarity rolls.'),
  pet_jelly: A('Squishy Cushion', 'guard', 3, 8, 'You take {v}% less damage.'),
  pet_bunny: A('Hop Along', 'speed', 5, 12, '+{v}% movement speed.'),
  pet_shroom: A('Toxic Spores', 'poison', 20, 50, "Mushy's bites poison the enemy for {v}% of your Attack every second for 4s."),
  pet_cupcake: A('Sugar Rush', 'might', 3, 8, '+{v}% Attack and Defense.'),
  pet_penguin: A('Ice Slide', 'freeze', 15, 30, "Pengu's attacks have a {v}% chance to freeze the enemy for 2s (bosses are immune)."),
  pet_owl: A('Keen Eye', 'crit', 3, 8, '+{v}% Critical chance.'),
  pet_fox: A('Clever Fox', 'exp', 5, 15, '+{v}% EXP from monsters.'),
  pet_bee: A('Honey Drop', 'mana', 1.5, 3.5, 'Restores {v}% of Max MP every 4s.'),
  pet_frog: A('Quick Tongue', 'frenzy', 60, 140, 'Ribbit attacks {v}% faster.'),
  pet_panda: A('Bamboo Belly', 'vigor', 4, 10, '+{v}% Max HP.'),
  pet_puppet: A('Pull the Strings', 'cdr', 4, 10, 'Your skill cooldowns are {v}% shorter.'),
  pet_ghost: A('Phase Out', 'dodge', 4, 10, '{v}% chance to dodge enemy attacks.'),
  pet_pumpkin: A('Harvest Bounty', 'gold', 10, 30, '+{v}% Gold from monsters.'),
  pet_snowpuff: A('Snow Shield', 'shield', 6, 15, 'Every 20s, wraps you in a shield worth {v}% of Max HP.'),
  pet_blossom: A('Spring Renewal', 'bloom', 1.5, 4, 'Every skill you cast heals you for {v}% of Max HP.'),
  pet_imp: A('Hellfire', 'hellfire', 30, 70, "Cinder's attacks splash fire on every enemy within 4m of the target for {v}% of your Attack."),
  pet_yeti: A('Yeti Stomp', 'stomp', 80, 180, 'Every 8s in battle, stomps for {v}% of your Attack on all nearby enemies and stuns them for 1s (not bosses).'),
  pet_turtle: A('Crystal Shell', 'reflect', 10, 25, 'Reflects {v}% of the damage you take back at the attacker.'),
  pet_bat: A('Vampire Bite', 'vampire', 2, 6, '+{v}% Lifesteal on your hits.'),
  pet_star: A('Wishing Star', 'starfall', 150, 350, 'Every 10s in battle, a star falls on your target for {v}% of your Attack.'),
  pet_dragon: A('Dragon Heart', 'dragon', 4, 10, '+{v}% Attack and +{2v}% Critical Damage.'),
  pet_phoenix: A('Rebirth', 'rebirth', 30, 60, 'Once every 5 minutes, a killing blow leaves you standing with {v}% HP instead.'),
  pet_whale: A('Ocean Guardian', 'guardian', 4, 10, '+{v}% Max HP, and you take {v}% less damage.'),
  pet_kitsune: A('Nine Tails', 'foxfire', 80, 180, '20% chance on your hits to throw fox fire at up to 3 enemies for {v}% of your Attack.'),
  pet_icedragon: A('Glacial Breath', 'frostbreath', 120, 280, 'Every 12s in battle, breathes frost on your target and enemies near it for {v}% of your Attack, freezing them for 2s (not bosses).'),
};
// the ability's number at a pet level
export const petAbilityValue = (ab, lv) => {
  const v = ab.lo + (ab.hi - ab.lo) * (Math.min(PET_MAX_LV, lv) - 1) / (PET_MAX_LV - 1);
  return ab.hi >= 20 ? Math.round(v) : Math.round(v * 10) / 10;
};
export const petAbilityText = (ab, lv) => { const v = petAbilityValue(ab, lv); return ab.text.replace(/\{2v\}/g, String(Math.round(v * 20) / 10)).replace(/\{v\}/g, String(v)); };
