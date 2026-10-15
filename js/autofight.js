// Auto-fight (T or the Auto button): a hunting and questing helper for the open world (never in dungeons, trials or
// guild wars). Settings > Auto-fight chooses what it does:
// - Hunt: walk to monsters within the chosen range of where you turned it on (steering your hero moves that spot),
//   fight them with your skills, gather the loot and come back; off, it only fights what is within reach.
// - Quests: hunt the monsters your story quest or bounty asks for, at their grounds.
// - Turn in: walk back to the quest giver when the objective is done, hand it in and take the next quest.
// - Potions: drink at the chosen HP share (and at 15% MP); Skip elites: leave elites and bosses alone.
// Whatever is attacking you is always fought first. Auto-fight earns half the mastery of fighting by hand
// (progress.js), and stepping in (moving, a skill, a click) always works.
import { MONSTERS } from './data.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const BOT_RANGES = [15, 30, 50];
export const BOT_POTS = [25, 35, 50, 70];
export const BOT_DEFAULTS = { botHunt: true, botRange: 30, botQuest: true, botTurnIn: true, botPot: 35, botSkipElite: false };

const G = {
  botSet(k) { const v = this.S.settings[k]; return v === undefined ? BOT_DEFAULTS[k] : v; },
  botMoves() { return !!this.botSet('botHunt'); },
  // the monster type the story quest or bounty wants killed (or a collect quest's monster)
  botQuestType() {
    if (!this.botSet('botQuest')) return null;
    const q = this.quest(), B = this.S.bounty;
    if (q?.def && q.status === 'active' && (q.def.type === 'kill' || q.def.type === 'collect') && MONSTERS[q.def.target]) return q.def.target;
    if (B && B.status === 'active' && MONSTERS[B.target]) return B.target;
    return null;
  },
  // where to hunt: the quest monster's grounds, or where auto-fight was turned on
  botCenter(want) {
    if (want) { const T = this.spawnTarget(want); if (T) return T; }
    return this.autoAnchor || this.player.pos;
  },
  botOk(m) { return m && !m.dead && m.kind === 'monster' && !m.returning && (m.map || this.world) === this.map && !m.def0?.structure; },
  botPick(want) {
    const p = this.player, hunt = this.botMoves(), skip = this.botSet('botSkipElite');
    // whatever is hitting you comes first
    let att = null;
    for (const m of this.monsters) if (this.botOk(m) && m.target === p && flat(m.pos, p.pos) < 16 && (!att || flat(m.pos, p.pos) < flat(att.pos, p.pos))) att = m;
    if (att) return att;
    const c = hunt ? this.botCenter(want) : p.pos, R = hunt ? this.botSet('botRange') : this.skRange(this.basicSkill()) + 1.5;
    let best = null, bd = Infinity;
    for (const m of this.monsters) {
      if (!this.botOk(m) || (want && m.type !== want)) continue;
      if (flat(m.pos, c) > R + (hunt ? 0 : m.radius)) continue;
      if (skip && (m.def0?.elite || m.def0?.boss || m.wb)) continue;
      if (!want && (m.level || 1) > this.S.level + 8) continue; // far too strong to farm
      const d = flat(m.pos, p.pos);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  },
  // quest giver errands: returns true while walking to an NPC or handing in
  botErrand() {
    if (!this.botSet('botQuest') || !this.botSet('botTurnIn') || this.dzIn) return false;
    const p = this.player, S = this.S, q = this.quest();
    let npc = null, act = null;
    if (q?.def) {
      if (q.status === 'complete') { npc = this.npcById(q.def.turnin); act = 'turnin'; }
      else if (q.status === 'available' && q.def.minLv <= S.level && q.def.type !== 'end') { npc = this.npcById(q.def.giver); act = 'accept'; }
    }
    if (!npc && S.bounty?.status === 'complete') { npc = this.npcById('elena'); act = 'bounty'; }
    if (!npc) return false;
    // finish the fight first
    if (this.monsters.some((m) => this.botOk(m) && m.target === p && flat(m.pos, p.pos) < 12)) return false;
    const B = this.bot;
    if (flat(p.pos, npc.pos) <= 4.5) {
      if (this.time < (B.talkT || 0)) return true; // one hand-in at a time
      B.talkT = this.time + 1.2; B.npc = null; p.path = [];
      if (act === 'turnin') this.completeQuest(npc);
      else if (act === 'accept') this.acceptQuest();
      else this.completeBounty();
      this.ui.closeDialog();
      return true;
    }
    if (B.npc !== npc || !p.path.length) {
      B.npc = npc; this.setTarget(null); this.engage = false;
      this.pathTo(npc.pos.x, npc.pos.z, true, true);
      if (!B.said || B.said !== npc.id + act) { B.said = npc.id + act; this.ui.toast(`Auto-fight: ${act === 'accept' ? 'taking the next quest from' : 'handing in to'} ${npc.data.name}`); }
    }
    return true;
  },
  // nothing to fight: pick up loot nearby, else walk back to the hunting spot
  botRoam(want) {
    const p = this.player, c = this.botCenter(want), R = this.botSet('botRange');
    const L = this.loots.find((l) => !l.net && !l.flying && l.map === this.map && l.t > 1.1 && flat(l.pos, p.pos) < R && this.time - (l.failT ?? -99) > 4);
    if (L) { if (!p.path.length) this.pathTo(L.pos.x, L.pos.z, false); return; }
    if (flat(p.pos, c) > 8 && !p.path.length) this.pathTo(c.x, c.z, true, true);
  },
  // called every frame while auto-fight is on and you are not moving by hand
  autoBattle() {
    const p = this.player;
    if (!this.autoAllowed()) { this.auto = false; this.ui.setAutoBattle(false); return; }
    if (p.dead) return;
    const B = this.bot || (this.bot = {});
    if (this.botErrand()) return;
    const want = this.botQuestType();
    let t = p.target;
    const fighting = this.botOk(t) && (!want || t.type === want || t.target === p);
    if (!fighting || (t.target !== p && this.time > (B.reT || 0))) { // look again now and then: someone may be attacking
      B.reT = this.time + 0.6;
      const n = this.botPick(want);
      if (n && n !== t) { t = n; this.setTarget(n); p.path = []; } else if (!fighting) t = null;
    }
    if (!t) { this.engage = false; if (this.botMoves()) this.botRoam(want); return; }
    if (this.mounted && flat(p.pos, t.pos) < 14) this.dismount(true);
    this.engage = true;
    this.autoSkills(t);
  },
  // you steered while auto-fight hunts: hunt around where you are now
  botSteered() { if (this.auto) { this.autoAnchor = this.player.pos.clone(); if (this.bot) this.bot.npc = null; } },
};

export function installAutoFight(Game) { Object.assign(Game.prototype, G); }
