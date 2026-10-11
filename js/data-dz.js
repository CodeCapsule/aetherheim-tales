// The Danger Zone (Bloodmoon Wastes): a walled-off stretch of blood-red wasteland south-west of Sylvan Haven.
// Inside it players can attack each other (party members excepted), anyone who falls drops part of their bag and
// gold on the spot, and the monsters scale to your level and hit like bosses, with Ancient set drops.
export const DZ = { name: 'Bloodmoon Wastes', x: -150, z: 150, r: 58, minLv: 30 };
export const inDZ = (x, z) => Math.hypot(x - DZ.x, z - DZ.z) < DZ.r;
// what you drop when you fall inside: a share of your gold and a few random unlocked bag entries
export const DZ_DROP = { goldPct: 0.1, items: 3, keepSecs: 300 };
// hits between players deal this share of their monster damage, so a fight lasts longer than one skill
export const PVP_DMG = 0.4;

const LETHAL = { hp: 2.2, atk: 2.0, def: 1.3, exp: 2.5, gold: 2.5 };
const mul = (a, b) => Object.fromEntries(['hp', 'atk', 'def', 'exp', 'gold'].map((k) => [k, (a[k] || 1) * (b[k] || 1)]));
const mob = (name, model, variant, o = {}) => ({ name, model, variant, lvl: [40, 200], curve: mul(LETHAL, o.curve || {}), aggressive: true, speed: o.speed || 4.6, range: o.range || 2.2, height: o.h || 1.8, scale: o.scale || 1, extra: true, dz: true, ...o.more });
export const DZ_MONSTERS = {
  dz_reaver: mob('Bloodmoon Reaver', 'boar', 1, { speed: 5.4, h: 1.7 }),
  dz_wraith: mob('Crimson Wraith', 'wraith', 0, { h: 2.2, speed: 4.4 }),
  dz_imp: mob('Hellfire Imp', 'imp', 1, { h: 1.5, speed: 5 }),
  dz_croc: mob('Gravemaw', 'croc', 1, { h: 1.3, range: 2.6 }),
  dz_brute: mob('Bloodmoon Brute', 'yeti', 1, { curve: { hp: 4, atk: 1.5, exp: 4, gold: 3 }, h: 3.2, scale: 1.25, range: 2.8, more: { elite: true } }),
  dz_tyrant: mob('Bloodmoon Tyrant', 'drake', 3, { curve: { hp: 30, atk: 2, exp: 40, gold: 20 }, h: 6.5, scale: 0.95, range: 5.5, more: { boss: true, skills: ['breath', 'nova', 'slam'] } }),
};
export const DZ_SPAWNS = [
  { type: 'dz_reaver', x: -128, z: 132, r: 18, count: 5 }, { type: 'dz_wraith', x: -172, z: 130, r: 16, count: 4 },
  { type: 'dz_imp', x: -170, z: 172, r: 16, count: 4 }, { type: 'dz_croc', x: -128, z: 172, r: 16, count: 4 },
  { type: 'dz_brute', x: -150, z: 118, r: 10, count: 2 }, { type: 'dz_brute', x: -150, z: 184, r: 10, count: 2 },
  { type: 'dz_tyrant', x: -150, z: 150, r: 3, count: 1 },
];
// Danger Zone monsters are always a few levels above you (and never below Lv 40)
export const dzLevel = (d, playerLv) => Math.max(40, Math.min(200, playerLv + (d.boss ? 10 : d.elite ? 7 : 4) + Math.floor(Math.random() * 4)));
// Ancient set piece chance per kill
export const ANCIENT_DROP = { normal: 0.015, elite: 0.06, boss: 0.35 };
