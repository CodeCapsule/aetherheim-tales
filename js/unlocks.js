// The feature schedule: the newer systems open one after another as a hero levels up, so a new player is not shown
// everything at once. Locked activities stay off the activity bar; reaching the level announces the feature (banner,
// chat, a mark on its button), and the Hero window lists what opens next.
export const FEATURES = [
  { id: 'wish', lv: 5, name: 'Star Wish', act: 'wish', desc: 'Two free wishes a day on the prize wheel' },
  { id: 'games', lv: 8, name: 'Mini-games', act: 'games', desc: 'Spirit Cards and Tower Defense' },
  { id: 'events', lv: 10, name: 'Event Timetable', act: 'timetable', desc: 'Monster Rush, the Quiz and Hide-and-Seek every hour' },
  { id: 'limit', lv: 10, name: 'Limit Break', desc: 'A gauge on skill slot 7 for a burst of power' },
  { id: 'hunt', lv: 12, name: 'Treasure Hunts', desc: 'Your sprite senses buried treasure' },
  { id: 'realm', lv: 15, name: 'Sprite Realm', desc: 'Challenge the sprite guardians' },
  { id: 'evolve', lv: 20, name: 'Pet Evolution', desc: 'Evolve pets at pet Lv 20 and 40' },
  { id: 'arena', lv: 20, name: 'Arena & Duels', act: 'arena', desc: 'Rated duels and arena champions' },
  { id: 'stars', lv: 34, name: 'Attribute Stars', desc: 'A new star every 2 levels up to Lv 68' },
];
export const featureLv = (id) => FEATURES.find((f) => f.id === id)?.lv || 1;

const G = {
  featureOn(id) { return this.S.gm || this.S.level >= featureLv(id); },
  // say so where a locked feature is used
  featureGate(id) {
    if (this.featureOn(id)) return true;
    const F = FEATURES.find((f) => f.id === id);
    this.ui.toast(`${F.name} opens at Lv ${F.lv}`, 'warn'); this.sfx.play('error');
    return false;
  },
  // after a level up (game.js gainExp)
  featuresLevelUp(from) {
    const fresh = FEATURES.filter((f) => from < f.lv && this.S.level >= f.lv);
    for (const f of fresh) {
      this.ui.chat('system', `New feature: <b>${f.name}</b> · ${f.desc}.`);
      if (f.act && this.ui.acts?.[f.act]) this.ui.setBadge(this.ui.acts[f.act], true);
    }
    if (fresh.length) { this.ui.banner('NEW FEATURE', fresh.map((f) => f.name).join(' · '), 'level'); this.ui.refreshActs(); }
  },
  featuresNext(n = 3) { return FEATURES.filter((f) => this.S.level < f.lv).slice(0, n); },
};

export function installUnlocks(Game) { Object.assign(Game.prototype, G); }
