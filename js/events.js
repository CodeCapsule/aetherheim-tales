// The event timetable (from Lv 10): three short events every hour on the shared clock (UTC), the same moment and the
// same content for every player, plus the world boss every 15 minutes (systems.js).
// - :00-:08 Monster Rush: waves of monsters at your level pour into the meadow east of Sylvan Haven; every kill
//   counts, and the haul is paid out when the rush ends.
// - :20-:25 Quiz: ten questions about Carlyle, one every 30 seconds, in a box on screen; Gold for each right answer and
//   a Lucky Ticket for eight or more.
// - :40-:48 Hide-and-Seek: Pip the Sly Sprite hides somewhere in Sylvan Haven (the same spot for everyone that hour)
//   and drops a hint every minute and a half; walk up to Pip to find it.
import * as THREE from 'three';
import { MONSTERS } from './data.js';
import { glowTexture } from './toon.js';

export const EVENTS_LV = 10;
export const TIMETABLE = [
  { id: 'rush', name: 'Monster Rush', from: 0, to: 8, icon: 'events', where: 'the meadow east of Sylvan Haven', desc: 'Waves of monsters at your level: defeat as many as you can.' },
  { id: 'quiz', name: 'Carlyle Quiz', from: 20, to: 25, icon: 'quests', where: 'anywhere', desc: 'Ten questions, one every 30 seconds. Gold for each right answer.' },
  { id: 'seek', name: 'Hide-and-Seek', from: 40, to: 48, icon: 'pets', where: 'Sylvan Haven', desc: 'Find Pip the Sly Sprite hiding in town. Hints come every minute and a half.' },
];
export const RUSH_AT = { x: 75, z: 15 }, RUSH_R = 45;
const QUIZ = [
  ['Which element beats Frost on the element wheel?', ['Fire', 'Wind', 'Earth'], 0],
  ['Who runs the Forge in Sylvan Haven?', ['Gorm', 'Opal', 'Mira'], 0],
  ['At what level does the first Attribute Star open?', ['Lv 20', 'Lv 34', 'Lv 50'], 1],
  ['How many free Star Wishes do you get each day?', ['One', 'Two', 'Three'], 1],
  ['Which key toggles auto-fight?', ['R', 'T', 'F'], 1],
  ['What does a failed enhancement give you?', ['Lucky Points', 'Star Essence', 'Diamonds'], 0],
  ['Which stone evolves a pet?', ['Enhancement Stone', 'Evolution Stone', 'Soulstone'], 1],
  ['At what pet level does the first evolution open?', ['Lv 10', 'Lv 20', 'Lv 30'], 1],
  ['What does Lightning beat on the element wheel?', ['Fire', 'Earth', 'Frost'], 0],
  ['How long does a full day last in Carlyle?', ['20 minutes', '40 minutes', '2 hours'], 1],
  ['Where does the world boss descend?', ['Storm Altar', 'Elder Ruins', 'Frostpeak'], 0],
  ['What does the Limit Break gauge sit on?', ['Skill slot 1', 'Skill slot 7', 'The minimap'], 1],
  ['What is the highest enhancement level?', ['+10', '+12', '+15'], 2],
  ['Which sprite element is Ember?', ['Fire', 'Water', 'Earth'], 0],
  ['What protects your enhancement level when a try fails?', ['Lucky Charm', 'Protection Charm', 'Lucky Ticket'], 1],
  ['How many players can a party hold?', ['Three', 'Four', 'Five'], 2],
  ['Who sells Fireworks?', ['Hilda', 'Gorm', 'Coco'], 0],
  ['Which tier comes right after Legendary?', ['Red', 'Ancient', 'Unique'], 0],
  ['What does Combat Power count?', ['Only gear', 'Gear, level, pets and more', 'Only your level'], 1],
  ['Where do the Sprite Realm guardians appear?', ['In town', 'Outside towns', 'Only in dungeons'], 1],
  ['What do Light and Shadow do on the wheel?', ['Nothing', 'Beat each other', 'Beat everything'], 1],
  ['How often does the world boss come?', ['Every 15 minutes', 'Every hour', 'Once a day'], 0],
  ['What does Wind beat?', ['Earth', 'Fire', 'Shadow'], 0],
  ['What is the level cap?', ['100', '150', '200'], 2],
];
// hiding places in town: [x, z, hint]
const HIDE = [
  [-11, -24, 'by the Elder\'s house, where the stories are kept'], [24, -15, 'near Mimi\'s pet house'], [-40, -1, 'close to Gorm\'s forge, it smells of coal'],
  [41, -11, 'at the foot of the guard tower'], [-36, 24, 'beside the orange-roofed house in the west'], [19, 35, 'behind the teal-roofed house in the south'],
  [29, -33, 'next to the purple mushroom house'], [-41, -17, 'in the shadow of the old west tower'], [8, 7, 'right by the fountain, giggling'],
  [-9, 12, 'among the spirit shrines south of the fountain'], [12, -40, 'near the north road out of town'], [-26, -36, 'by the blue-roofed house'],
];
const hourKey = (t) => Math.floor(t / 3600000);
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const G = {
  evNow() { return Date.now() + (this.evShift || 0); },
  // the event running now: { def, key, secsLeft, secsIn } or null
  evLive() {
    const t = this.evNow(), m = (t % 3600000) / 60000;
    const def = TIMETABLE.find((e) => m >= e.from && m < e.to); if (!def) return null;
    return { def, key: hourKey(t) + def.id, secsLeft: (def.to - m) * 60, secsIn: (m - def.from) * 60, hour: hourKey(t) };
  },
  // the next n starts (events and world bosses) from now
  evUpcoming(n = 8) {
    const t = this.evNow(), out = [], h0 = hourKey(t);
    for (let hh = h0; hh < h0 + 3; hh++) for (const e of TIMETABLE) { const at = hh * 3600000 + e.from * 60000; if (at + (e.to - e.from) * 60000 > t) out.push({ def: e, at, live: at <= t }); }
    return out.sort((a, b) => a.at - b.at).slice(0, n);
  },
  evOn() { return (this.S.level >= EVENTS_LV || this.S.gm) && this.map === this.world && !this.dg && !this.trial && !this.war; },
  evUpdate(dt) {
    const L = this.evLive(), key = L ? L.key : null;
    if (key !== this.evKey) { if (this.evKey) this.evFinish(this.evKey); this.evKey = key; if (L) this.evBegin(L); }
    if (!L) return;
    this.evT = (this.evT || 0) + dt;
    if (L.def.id === 'rush') this.rushTick(L, dt);
    else if (L.def.id === 'quiz') this.quizTick(L);
    else if (L.def.id === 'seek') this.seekTick(L, dt);
    if ((this.evTrackN = (this.evTrackN || 0) + 1) % 20 === 0) this.ui.refreshQuest();
  },
  evBegin(L) {
    this.ev = { key: L.key, id: L.def.id, kills: 0, right: 0, asked: {}, found: false, hinted: -1 };
    if (this.S.level < EVENTS_LV && !this.S.gm) return;
    this.ui.banner(L.def.name.toUpperCase(), L.def.id === 'rush' ? `Now in ${L.def.where}` : L.def.id === 'seek' ? 'Pip is hiding in Sylvan Haven' : 'Answer in the box on screen', 'level');
    this.ui.chat('announce', `<b>[Event]</b> ${esc(L.def.name)} has begun${L.def.where !== 'anywhere' ? ` in ${esc(L.def.where)}` : ''}! ${esc(L.def.desc)}`);
    this.sfx.play('quest'); this.ui.refreshActs();
  },
  evFinish(key) {
    const E = this.ev; if (!E || E.key !== key) return;
    this.ev = null;
    if (E.id === 'rush') {
      for (const m of this.monsters) if (m.rush && !m.dead && !m.removed) this.removeEnt(m);
      if (E.kills) {
        const lv = this.S.level, gold = E.kills * (60 + lv * 6), stones = Math.floor(E.kills / 10);
        this.S.gold += gold; if (stones) this.addMat(lv >= 60 ? 'enh_stone2' : 'enh_stone', stones, true);
        this.ui.banner('RUSH OVER', `${E.kills} defeated · +${fmt(gold)} Gold${stones ? ` · ${stones} Enhancement Stone${stones > 1 ? 's' : ''}` : ''}`, 'loot4');
        this.ui.refreshWallet(); this.track && this.track('event');
      }
    } else if (E.id === 'quiz') {
      this.quizBox(null);
      if (E.right) {
        if (E.right >= 8) { this.addItem('lucky_ticket', 1); this.ui.chat('system', 'Quiz: 8 or more right answers! A Lucky Ticket is yours.'); }
        this.ui.toast(`Quiz over: ${E.right} of ${QUIZ_N} right`, 'good'); this.track && this.track('event');
      }
    } else if (E.id === 'seek') this.seekHide(null);
    this.ui.refreshQuest(); this.save();
  },
  // ---------------------------------------------------------------- Monster Rush
  rushIn() { return this.evOn() && flat(this.player.pos, RUSH_AT) < RUSH_R; },
  rushType() {
    const L = this.S.level, list = Object.entries(MONSTERS).filter(([, d]) => !d.boss && !d.elite && !d.dungeon && !d.war && !d.structure && !d.festival && !d.dz && !d.worldBoss && d.lvl && d.model);
    let best = list[0], bd = Infinity;
    for (const [k, d] of list) { const c = (d.lvl[0] + d.lvl[1]) / 2, dd = Math.abs(c - L); if (dd < bd) { bd = dd; best = [k, d]; } }
    return best[0];
  },
  rushTick(L, dt) {
    const E = this.ev; if (!E || !this.rushIn() || this.player.dead) return;
    this.rushT = (this.rushT || 0) - dt;
    if (this.rushT > 0) return;
    this.rushT = 4;
    const alive = this.monsters.filter((m) => m.rush && !m.dead && !m.removed).length;
    for (let i = alive; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 18;
      const [x, z] = this.world.nearestFree(RUSH_AT.x + Math.sin(a) * r, RUSH_AT.z + Math.cos(a) * r);
      const lv = this.S.level, m = this.createMonster({ type: this.rushType(), x, z, r: 0, lvl: [lv, lv] }, { exact: true, summoned: true });
      m.rush = E.key; m.target = this.player; m.wanderT = 1e9; m.noLeash = true;
      this.fx.spawnPuff && this.fx.spawnPuff(m.pos, 0xff8a5a);
    }
  },
  rushKill(m) { if (this.ev && this.ev.id === 'rush' && m.rush === this.ev.key) this.ev.kills++; },
  // ---------------------------------------------------------------- Quiz
  quizList(hour) { const R = rng(hour * 7919 + 13), idx = QUIZ.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx.slice(0, QUIZ_N).map((i) => QUIZ[i]); },
  quizTick(L) {
    const E = this.ev; if (!E || (this.S.level < EVENTS_LV && !this.S.gm)) return;
    const n = Math.min(QUIZ_N - 1, Math.floor(L.secsIn / 30)), Q = this.quizList(L.hour)[n];
    if (this.quizShown !== L.key + n) { this.quizShown = L.key + n; this.quizBox({ n, Q, left: 30 - (L.secsIn % 30) }); }
  },
  quizAnswer(n, i) {
    const E = this.ev, L = this.evLive(); if (!E || E.id !== 'quiz' || !L || E.asked[n] != null) return null;
    const Q = this.quizList(L.hour)[n]; if (!Q) return null;
    E.asked[n] = i;
    const ok = i === Q[2];
    if (ok) { E.right++; const g = 300 + this.S.level * 20; this.S.gold += g; this.ui.refreshWallet(); this.sfx.play('coin'); this.ui.toast(`Right! +${fmt(g)} Gold`, 'good'); }
    else { this.sfx.play('error'); this.ui.toast(`Not quite: it was ${Q[1][Q[2]]}`, 'warn'); }
    this.quizBox({ n, Q, left: 0, answered: i });
    return ok;
  },
  quizBox(o) {
    let el = document.getElementById('quiz-box');
    if (!o) { if (el) el.hidden = true; return; }
    if (!el) { el = h('div', 'frame'); el.id = 'quiz-box'; document.getElementById('hud').appendChild(el); }
    el.hidden = false;
    const { n, Q, answered } = o;
    el.innerHTML = `<div class="qz-h"><b>Carlyle Quiz</b><span>Question ${n + 1} of ${QUIZ_N}</span></div><div class="qz-q">${esc(Q[0])}</div><div class="qz-a"></div>`;
    const A = el.querySelector('.qz-a');
    Q[1].forEach((txt, i) => {
      const b = h('button', 'btn small' + (answered != null ? (i === Q[2] ? ' green' : i === answered ? ' red' : ' gray') : ''), esc(txt));
      b.disabled = answered != null; b.onclick = () => this.quizAnswer(n, i); A.appendChild(b);
    });
  },
  // ---------------------------------------------------------------- Hide-and-Seek
  seekSpot(hour) { const s = HIDE[Math.floor(rng(hour * 104729 + 7)() * HIDE.length)]; return { x: s[0], z: s[1], hint: s[2] }; },
  seekTick(L, dt) {
    const E = this.ev; if (!E || (this.S.level < EVENTS_LV && !this.S.gm) || this.map !== this.world) return;
    const spot = this.seekSpot(L.hour);
    if (!E.found && !this.seekPip) this.seekHide(spot);
    const k = Math.floor(L.secsIn / 90);
    if (!E.found && k !== E.hinted) { E.hinted = k; this.ui.chat('system', `<b>[Hide-and-Seek]</b> Pip giggles ${esc(spot.hint)}.`); }
    if (this.seekPip) {
      const P = this.seekPip, d = flat(this.player.pos, spot);
      P.position.y = this.world.heightAt(spot.x, spot.z) + 0.8 + Math.sin(this.time * 3) * 0.15; P.rotation.y += dt * 2;
      P.visible = d < 14;
      if (!E.found && d < 2.6 && !this.player.dead) this.seekFound(spot);
    }
  },
  seekHide(spot) {
    if (this.seekPip) { this.scene.remove(this.seekPip); this.seekPip = null; }
    if (!spot) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xb8ffe0 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x7affc8, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.6); g.add(body, glow);
    g.position.set(spot.x, this.world.heightAt(spot.x, spot.z) + 0.8, spot.z); g.visible = false;
    this.scene.add(g); this.seekPip = g;
  },
  seekFound(spot) {
    const E = this.ev; E.found = true;
    const S = this.S, gold = 1500 + S.level * 40;
    S.gold += gold; S.diamonds += 15; this.addMat('sprite_essence', 2, true);
    if (Math.random() < 0.3) this.addMat('evo_stone', 1, true);
    this.fx.pillar({ x: spot.x, y: this.world.heightAt(spot.x, spot.z), z: spot.z }, 0x7affc8, 1.2, 8, 1);
    this.seekHide(null);
    this.ui.banner('FOUND PIP!', `+${fmt(gold)} Gold · +15 Diamonds · Sprite Essence`, 'loot4'); this.sfx.play('chest');
    this.ui.chat('system', '<b>[Hide-and-Seek]</b> You found Pip! It will hide somewhere new next hour.');
    this.ui.refreshWallet(); this.track && this.track('event'); this.save();
  },
};
const QUIZ_N = 10;

const U = {
  panel_timetable(body) {
    const g = this.g, L = g.evLive(), now = g.evNow();
    if (g.S.level < EVENTS_LV && !g.S.gm) body.appendChild(h('div', 'note', `The events open at Lv ${EVENTS_LV}.`));
    const list = h('div', 'list');
    for (const u of g.evUpcoming(9)) {
      const live = u.live, secs = live ? (u.at + (u.def.to - u.def.from) * 60000 - now) / 1000 : (u.at - now) / 1000;
      const d = new Date(u.at), hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const r = h('div', 'row slim' + (live ? ' live' : ''), `<div class="tt-time">${hhmm}</div><div class="tx"><b>${esc(u.def.name)}${live ? ' <span class="free-tag">Now</span>' : ''}</b><small>${esc(u.def.desc)}${u.def.where !== 'anywhere' ? ` · ${esc(u.def.where)}` : ''}</small><small class="muted">${live ? `${mmss(secs)} left` : `in ${mmss(secs)}`}</small></div>`);
      if (live && u.def.id === 'rush') { const b = h('button', 'btn small green', 'Go'); b.onclick = () => { this.closePanels(); g.pathTo(RUSH_AT.x, RUSH_AT.z, true, true); }; r.appendChild(b); }
      if (live && u.def.id === 'seek') { const b = h('button', 'btn small green', 'Go to town'); b.onclick = () => { this.closePanels(); g.pathTo(0, 9, true, true); }; r.appendChild(b); }
      list.appendChild(r);
    }
    body.appendChild(list);
    body.appendChild(h('div', 'note', `Every hour on the hour: Monster Rush (:00-:08), the Carlyle Quiz (:20-:25) and Hide-and-Seek (:40-:48), the same for every player. The world boss comes every 15 minutes at the Storm Altar. ${L ? `<b>${esc(L.def.name)}</b> is on now.` : ''}`));
  },
  // the event in the quest tracker
  eventTracker(list) {
    const g = this.g, L = g.evLive(), E = g.ev; if (!L || !E || (g.S.level < EVENTS_LV && !g.S.gm)) return;
    let txt = '';
    if (L.def.id === 'rush') txt = g.rushIn() ? `${E.kills} defeated · ${mmss(L.secsLeft)} left` : `<u>Go to the meadow east of town</u> · ${mmss(L.secsLeft)} left`;
    else if (L.def.id === 'quiz') txt = `${E.right} right · ${mmss(L.secsLeft)} left`;
    else txt = E.found ? 'You found Pip!' : `Find Pip in Sylvan Haven · ${mmss(L.secsLeft)} left`;
    const it = h('div', 'qt-item', `<span class="qtag event">Event</span><span class="qn">${esc(L.def.name)}</span><div class="qo">${txt}</div>`);
    it.onclick = () => { g.sfx.play('click'); if (L.def.id === 'rush') g.pathTo(RUSH_AT.x, RUSH_AT.z, true, true); else this.togglePanel('timetable', true); };
    list.appendChild(it);
  },
};

export function installEvents(Game) { Object.assign(Game.prototype, G); }
export function installEventsUI(UI) { Object.assign(UI.prototype, U); }
