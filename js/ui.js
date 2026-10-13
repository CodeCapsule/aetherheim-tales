// HUD, panels, dialogs, chat, minimap and world map.
import {
  CLASSES, MONSTERS, SPAWNS, ZONES, PETS, SPRITES, MOUNTS, ITEMS, SLOT_INFO, QUESTS, SIGNIN, ONLINE_GIFTS, MALL, DUNGEONS, WEAPON_ICONS,
} from './data.js';
import { needExp, fmt, esc, PET_TIER, bagCat } from './game.js';
import { RARITY, LEGENDARY_ITEMS, EFFECTS, itemLines, itemScore, namedBySource } from './loot.js';
import { ico, iconCanvas } from './icons.js';
import { installSystemsUI } from './ui-systems.js';
import { installLifeUI } from './ui-life.js';
import { installTrialsUI } from './ui-trials.js';
import { installPartyUI, partyMembers } from './party.js';
import { installTradeUI } from './trade.js';
import { installSocialUI } from './social.js';
import { installGuideUI } from './guide.js';
import { CHAPTERS } from './data-story.js';
import { setOfDungeon } from './data-sets.js';
import { PET_ABILITIES, PET_MAX_LV, petAbilityText } from './data-pets.js';
import { CLASS_SKILLS, SKILL_BY_ID, rankMult, RACES } from './data-classes.js';
import { MAX_LEVEL, SHOPS, DUNGEON_RULES } from './data-world.js';
import { WORLD_BOSS, MATERIALS } from './systems-data.js';
import { DZ } from './data-dz.js';
import { MASTERY, MASTERY_MAX, masteryNeed, FOG } from './progress.js';
import { SURVEY_MIN_MASTERY, SURVEY_COVER } from './data-nav.js';
import { trialLabel } from './data-trials.js';
import { TOOL_KINDS, TOOL_METAL, NODE_WORD, toolId } from './data-crafting.js';
import { DAY_MIN, WEATHER_MIN } from './sky.js';
import { UIZ, vw, vh } from './touchfit.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const RAR = ['Common', 'Rare', 'Special', 'Legendary'];
const RARC = PET_TIER.map((t) => RARITY[t].color);
const LEGEND_IDS = new Set(LEGENDARY_ITEMS.map((x) => x.id));
const slotIcon = (slot, cls) => (slot === 'weapon' ? WEAPON_ICONS[cls] : SLOT_INFO[slot].icon);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const TOWN_R = 56; // half-size of the World Map's town view (Sylvan Haven)
const STAT_WORD = { hpPct: 'max HP', defPct: 'defense', atkPct: 'attack', mpPct: 'max mana', crit: 'critical chance', critDmg: 'critical damage', speedPct: 'move speed', aspd: 'attack speed', mregen: 'mana regeneration', healPct: 'healing', healRecv: 'healing received', skillDmg: 'skill damage', magicDmg: 'magic damage', rangedDmg: 'ranged damage', rangePct: 'range', poisonDmg: 'poison damage', burnDmg: 'burn damage', fireDmg: 'fire damage', block: 'block chance', dodge: 'dodge chance', ccRes: 'stun and knockdown resistance', lifesteal: 'lifesteal', area: 'area size', castSpeed: 'cast speed', stamina: 'stamina regeneration', dmg: 'damage', summonDmg: 'summon damage', summonHp: 'summon HP', summonAspd: 'summon attack speed', summonDur: 'summon duration', summonSlots: 'summon slot', summonCrit: 'of your critical chance for summons', statShare: 'of your stats for summons', atk: 'attack', def: 'defense' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const DOCK_MENU = ['char', 'bag', 'skills', 'quests'];
const STATION_TABS = ['alchemy', 'smithing', 'red']; // Professions tabs that only open at their NPC
const MENU_MIN = 'hiraya_menu_min'; // phones: the menu column is folded away
// town NPCs that run a window, listed on the World Map
const SERVICES = [['gorm', 'Forge: enhance, craft, upgrade, salvage, smithing', 'forge', { fgTab: 'enhance' }], ['opal', 'Gem Workshop: sockets, gems, soulstones', 'forge', { fgTab: 'gems' }],
  ['vera', 'Alchemy', 'life', { lifeTab: 'alchemy' }], ['mira', 'Market', 'market'], ['grimsby', 'Auction House', 'auction', { aucTab: 'browse' }], ['aldric', 'Guilds and Guild Wars', 'guild', { guildTab: 'hall' }], ['coco', 'Wardrobe and costumes', 'wardrobe']]; // menu buttons that also sit on the phone dock
const CHN = { world: 'World', system: 'System', guild: 'Guild', announce: 'Announce', player: 'Player', party: 'Party' };

export class UI {
  constructor() {
    this.panel = null; this.panelName = null; this.sel = {}; this.chatFilter = 'all'; this.dockFrame = 0;
    this.toasts = $('toasts'); this.bannerEl = $('banner');
    this.cacheTxt = new Map();
  }
  txt(el, s) { if (this.cacheTxt.get(el) !== s) { this.cacheTxt.set(el, s); el.textContent = s; } }

  bind(game) {
    this.g = game;
    const g = game, S = g.S;
    // skill bar
    const bar = $('skillbar'); bar.innerHTML = '';
    this.slots = [];
    for (let i = 1; i <= 7; i++) {
      const b = h('button', 'slot' + (i === 7 ? ' ult' : '')); b.dataset.i = i; b.setAttribute('aria-label', i === 7 ? 'Ultimate skill' : 'Skill ' + i);
      b.innerHTML = `<span class="ic"></span><span class="key">${i}</span><span class="cd"></span><span class="cdt"></span>`;
      b.addEventListener('click', () => g.useSkill(i));
      this.tip(b, () => { const sk = g.skillList()[i]; return sk ? this.skillTip(sk) : `<b>${i === 7 ? 'Ultimate' : 'Empty slot'}</b>${i === 7 ? 'Your ultimate unlocks at Lv 200.' : 'Choose a skill for this slot in the Skills window (K).'}`; });
      bar.appendChild(b); this.slots.push(b);
    }
    for (const [id, key] of [['hp_potion', 'Q'], ['mp_potion', 'E']]) {
      const b = h('button', 'slot potion'); b.innerHTML = `${ico(id)}<span class="key">${key}</span><span class="cnt"></span><span class="cd"></span>`;
      b.setAttribute('aria-label', ITEMS[id].name);
      b.addEventListener('click', () => g.usePotion(id));
      this.tip(b, () => `<b>${ITEMS[id].name}</b>${ITEMS[id].desc}<br><span class="ts">Hotkey ${key} · 3s cooldown</span>`);
      bar.appendChild(b); this.slots.push(b); b.dataset.potion = id;
    }
    // tool belt above the skill bar: Axe, Pickaxe and Sickle (keys 8, 9, 0)
    const belt = $('toolbelt'); belt.innerHTML = ''; this.toolSlots = {};
    for (const [k, key] of [['axe', '8'], ['pick', '9'], ['sickle', '0']]) {
      const K = TOOL_KINDS[k], b = h('button', 'slot tool'); b.setAttribute('aria-label', K.name);
      b.innerHTML = `<span class="ic"></span><span class="key">${key}</span><span class="tr"></span>`;
      b.addEventListener('click', () => g.useToolSlot(k));
      this.tip(b, () => { const id = g.S.tools?.[k], it = id && ITEMS[id]; return it ? `<b>${esc(it.name)}</b>Gathers ${NODE_WORD[k]} up to tier ${it.tier + 1}.<br><span class="ts">Click or press ${key}: walk to the nearest one and start ${K.verb.toLowerCase()}</span>` : `<b>No ${K.name}</b>Your belt slot for ${NODE_WORD[k]} is empty. Gorm forges tools and Hilda sells them.`; });
      belt.appendChild(b); this.toolSlots[k] = b;
    }
    this.refreshTools();
    $('btn-mount').onclick = () => g.toggleMount();
    $('btn-auto').onclick = () => g.toggleAuto();
    $('btn-auto').innerHTML = `${ico('auto')}<small>Auto</small>`;
    $('btn-roll').innerHTML = `${ico('roll')}<small>Roll</small>`; $('btn-roll').onclick = () => g.roll();
    $('btn-attack').innerHTML = ico(WEAPON_ICONS[S.cls] || 'w_sword'); $('btn-attack').onclick = () => g.attackNearest();
    const bb = $('btn-block'); bb.innerHTML = `${ico('block')}<small>Block</small>`; bb.hidden = S.cls !== 'knight';
    const hold = (on) => { g.blockHold = on; if (on) g.startBlock(); bb.classList.toggle('on', on); };
    bb.addEventListener('pointerdown', (e) => { e.preventDefault(); hold(true); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) bb.addEventListener(ev, () => hold(false));
    // quick access menus: a few pinned buttons and a More button that expands the rest; on phones each opens whole as a sheet
    this.qa = { acts: false, menu: false };
    const qaTog = (box, key) => {
      const t = h('button', 'qa-tog', `<span class="ai">${ico('more')}</span><span class="al">More</span>`);
      t.setAttribute('aria-label', 'More'); t.setAttribute('aria-expanded', 'false');
      t.onclick = () => { g.sfx.play('click'); this.setQa(key, !this.qa[key]); };
      box.appendChild(t); return t;
    };
    // character menu (bottom right): pinned on wide screens / pinned everywhere; the rest sit behind More
    const menu = $('hud-menu'); menu.innerHTML = ''; menu.className = 'qa';
    const items = [['char', 'Hero', 'C', 'Character'], ['bag', 'Bag', 'B'], ['skills', 'Skills', 'K'], ['pets', 'Pets', 'P'], ['mounts', 'Mounts', 'U'], ['life', 'Gathering', 'Z', 'Professions', 'professions'], ['collect', 'Relics', '', 'Relic Collection', 'collection'], ['codex', 'Codex', 'X'], ['quests', 'Quests', 'L'], ['map', 'Map', 'M', 'World Map'], ['settings', 'Settings', 'O']];
    const MENU_PIN = ['char', 'bag', 'skills', 'pets', 'quests'], MENU_PIN_WIDE = ['map', 'life'];
    this.menuBtns = {};
    for (const [n, label, k, full = label, icn = n] of items) {
      const cls = 'mbtn' + (DOCK_MENU.includes(n) ? ' indock' : '') + (MENU_PIN.includes(n) ? '' : MENU_PIN_WIDE.includes(n) ? ' x2' : ' x');
      const b = h('button', cls, `<span class="ai">${ico(icn)}${k ? `<span class="k">${k}</span>` : ''}</span><span class="al">${label}</span>`); b.title = k ? `${full} (${k})` : full; b.setAttribute('aria-label', full);
      b.onclick = () => { this.setSheet(''); this.setQa('menu', false); if (n === 'life' && STATION_TABS.includes(this.sel.lifeTab)) this.sel.lifeTab = 'gather'; this.togglePanel(n); g.sfx.play('click'); };
      menu.appendChild(b); this.menuBtns[n] = b;
    }
    this.qaTogs = { menu: qaTog(menu, 'menu') };
    // phones: the activities open from the menu grid (desktop shows them along the top)
    const ev = h('button', 'mbtn ph', `<span class="ai">${ico('events')}</span><span class="al">Events</span>`); ev.title = 'Events and activities'; ev.setAttribute('aria-label', 'Events and activities');
    ev.onclick = () => { g.sfx.play('click'); this.setSheet(this.sheet === 'acts' ? '' : 'acts'); };
    menu.appendChild(ev); this.evBtn = ev;
    // phones: the menu is one column of four under the minimap (scroll or tap the arrow for the rest), and folds away
    for (const [n, b] of Object.entries(this.menuBtns)) b.dataset.m = n;
    ev.dataset.m = 'events';
    const fold = $('menu-fold'), more = $('menu-more');
    fold.onclick = () => { g.sfx.play('click'); this.setMenuMin(!this.menuMin); };
    more.innerHTML = ico('qa_down');
    more.onclick = () => {
      g.sfx.play('click');
      const across = menu.scrollWidth > menu.clientWidth + 2;
      if (more.classList.contains('end')) menu.scrollTo(0, 0);
      else menu.scrollBy(across ? menu.clientWidth - 8 : 0, across ? 0 : menu.clientHeight - 8);
      this.refreshMenuMore();
    };
    menu.addEventListener('scroll', () => this.refreshMenuMore(), { passive: true });
    let min = false; try { min = localStorage.getItem(MENU_MIN) === '1'; } catch { /* storage unavailable */ }
    this.setMenuMin(min, false);
    // activities (top right): Online, Missions, Dungeon and the World Boss timer stay out; the rest sit behind More
    const acts = $('hud-acts'); acts.innerHTML = ''; acts.className = 'qa';
    const A = [['online', 'Online'], ['missions', 'Missions'], ['dungeon', 'Dungeon'], ['worldboss', 'World Boss'], ['war', 'Guild War'], ['event', 'Festival'], ['season', 'Season'], ['farm', 'Farm'], ['signin', 'Sign-In'], ['gift', 'Gift'], ['mall', 'Mall'], ['rank', 'Ranking'], ['bounty', 'Bounty'], ['teleport', 'Teleport']];
    const ACT_PIN = ['online', 'missions', 'dungeon', 'worldboss'];
    this.acts = {};
    for (const [n, label] of A) {
      const b = h('button', 'act' + (ACT_PIN.includes(n) ? '' : ' x'), `<span class="ai">${ico(n)}</span><span class="al">${label}</span>`); b.setAttribute('aria-label', label);
      b.onclick = () => {
        g.sfx.play('click'); this.setSheet(''); this.setQa('acts', false);
        if (n === 'dungeon') { this.togglePanel('dungeons'); return; }
        if (n === 'war') { this.sel.guildTab = 'war'; this.togglePanel('guild'); return; }
        if (g.dg && (n === 'bounty' || n === 'teleport')) { this.toast('Not available inside a dungeon', 'warn'); return; }
        if (n === 'bounty') { if (S.bounty) g.autoQuest('bounty'); else if (g.bountyUnlocked()) g.talkTo(g.npcById('elena'), true); else this.toast('Bounties unlock after "Swift as the Wind"', 'warn'); return; }
        if (n === 'teleport') { g.talkTo(g.npcById('nix')); return; }
        if (n === 'farm') { this.sel.lifeTab = 'farm'; this.togglePanel('life'); return; }
        this.togglePanel(n);
      };
      acts.appendChild(b); this.acts[n] = b;
    }
    this.qaTogs.acts = qaTog(acts, 'acts');
    // phone dock (shown on small screens): quick buttons, and sheets for the activities and the rest of the menu
    const dock = $('hud-dock'); dock.innerHTML = '';
    this.dockBtns = {};
    for (const [n, label, icn] of [['acts', 'Events', 'events'], ['char', 'Hero', 'char'], ['bag', 'Bag', 'bag'], ['skills', 'Skills', 'skills'], ['quests', 'Quests', 'quests'], ['chat', 'Chat', 'chat'], ['menu', 'More', 'more']]) {
      const b = h('button', 'dbtn', `${ico(icn)}<span>${label}</span>`); b.setAttribute('aria-label', label);
      b.onclick = () => {
        g.sfx.play('click');
        if (n === 'acts' || n === 'menu') { this.setSheet(this.sheet === n ? '' : n); return; }
        this.setSheet('');
        if (n === 'chat') { $('hud-chat').classList.toggle('open'); b.classList.toggle('on', $('hud-chat').classList.contains('open')); return; }
        this.togglePanel(n);
      };
      dock.appendChild(b); this.dockBtns[n] = b;
    }
    this.sheet = '';
    // a tap anywhere else closes an open sheet
    document.addEventListener('pointerdown', (e) => {
      if (this.sheet && !e.target.closest('#hud-acts, #hud-menu, #hud-dock')) this.setSheet('');
      for (const k of ['acts', 'menu']) if (this.qa[k] && !e.target.closest('#hud-' + k)) this.setQa(k, false);
    }, true);
    // on-screen joystick (shown with the phone dock): hold and drag to walk, relative to the camera
    const stick = $('hud-stick'), knob = stick.querySelector('.knob');
    let sid = null;
    const steer = (e) => {
      const r = stick.getBoundingClientRect(), R = r.width / 2;
      let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      knob.style.transform = `translate(${dx * R * 0.6 / UIZ.k}px, ${dy * R * 0.6 / UIZ.k}px)`;
      if (m < 0.2) g.setStick(0, 0); else g.setStick(dx, dy);
    };
    const release = (e) => { if (e.pointerId !== sid) return; sid = null; stick.classList.remove('on'); knob.style.transform = ''; g.setStick(0, 0); };
    stick.addEventListener('pointerdown', (e) => { if (sid !== null) return; e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid); stick.classList.add('on'); g.sfx.ensure(); this.setSheet(''); steer(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) steer(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(ev, release);
    // map & misc
    $('minimap').onclick = () => this.togglePanel('map');
    $('btn-wmap').onclick = () => this.togglePanel('map');
    $('btn-sound').onclick = () => { g.setSetting('sound', !S.settings.sound); this.refreshSound(); };
    $('hud-pet').onclick = () => this.togglePanel('pets');
    $('qt-tog').onclick = () => { const l = $('qt-list'); l.hidden = !l.hidden; $('qt-tog').textContent = l.hidden ? '+' : '−'; };
    $('qt-team').onclick = () => this.togglePanel('online');
    $('chat-toggle').onclick = () => $('hud-chat').classList.toggle('open');
    $('chat-tabs').querySelectorAll('button').forEach((b) => b.onclick = () => {
      $('chat-tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
      this.chatFilter = b.dataset.c; this.applyChatFilter();
    });
    $('chat-form').addEventListener('submit', (e) => { e.preventDefault(); const i = $('chat-in'); g.sendChat(i.value); i.value = ''; i.blur(); });
    this.mm = $('mm').getContext('2d');
    $('btn-wmap').innerHTML = ico('worldmap'); $('chat-toggle').innerHTML = ico('chat');
    $('hud-autobattle').innerHTML = `${ico('auto', 'ico inl')} Auto Battle`;
    this.bindSystems();
    this.refreshSound();
    $('hud').hidden = false;
    this.fitPhoneHud();
  }

  refreshAll() { this.refreshPlayer(); this.refreshSkills(); this.refreshQuest(); this.refreshExp(); this.refreshActs(); this.refreshMountBtn(); this.refreshTarget(); }
  refreshSound() { $('btn-sound').innerHTML = ico(this.g.S.settings.sound ? 'sound_on' : 'sound_off'); }

  // ------------------------------------------------------------ HUD
  refreshPlayer() {
    const g = this.g; if (!g || !g.player) return;
    const S = g.S;
    $('pf-img').src = g.headIcon();
    this.txt($('pf-name'), S.name);
    this.txt($('pf-level'), String(S.level));
    this.txt($('pf-br'), fmt(g.br));
    const pet = S.activePet && PETS.find((x) => x.id === S.activePet);
    $('hud-pet').hidden = !pet;
    if (pet) { $('pet-img').src = g.petIcon(pet.id); this.txt($('pet-name'), pet.name); this.txt($('pet-lv'), `Lv ${S.pets[pet.id].lv} · ${pet.species}`); $('hud-pet').title = `${PET_ABILITIES[pet.id].name}: ${petAbilityText(PET_ABILITIES[pet.id], S.pets[pet.id].lv)}`; }
    this.refreshWallet();
  }
  refreshWallet() { const S = this.g.S; this.txt($('w-gold'), fmt(S.gold)); this.txt($('w-dia'), fmt(S.diamonds)); }
  refreshExp() {
    const g = this.g, S = g.S, need = needExp(S.level);
    const pct = S.level >= MAX_LEVEL ? 100 : (S.exp / need) * 100;
    const block = S.level < MAX_LEVEL && S.exp >= need && g.levelBlock ? g.levelBlock() : null;
    $('exp-f').style.width = pct + '%';
    $('hud-exp').classList.toggle('blocked', !!block);
    this.txt($('exp-t'), S.level >= MAX_LEVEL ? 'MAX LEVEL' : block ? `EXP FULL · ${g.blockText(block)}` : `EXP ${fmt(S.exp)} / ${fmt(need)}  (${pct.toFixed(1)}%)${S.rested > 0 ? ` · Rested ${fmt(S.rested)}` : ''}`);
  }
  // the Hero panel's "what next" box: XP left, the three masteries and the next trial
  progressBox(body) {
    const g = this.g, S = g.S; if (!S.mastery) return;
    const goal = g.nextGoal();
    const box = h('div', 'prog-box');
    const lines = [];
    if (S.level >= MAX_LEVEL) lines.push('<b>Maximum level.</b>');
    else if (goal.block) lines.push(`<b class="bad">Next level needs:</b> ${esc(g.blockText(goal.block))}`);
    else lines.push(`<b>Next level:</b> ${fmt(goal.xpLeft)} EXP to go`);
    if (goal.trial) lines.push(`<b>Next wall:</b> ${esc(trialLabel(goal.trial / 20))} at Lv ${goal.trial} · talk to the Trial Warden`);
    if (S.rested > 0) lines.push(`<b>Rested:</b> ${fmt(S.rested)} bonus EXP (kills give double until it runs out)`);
    box.appendChild(h('div', 'pg-goal', lines.join('<br>')));
    for (const t of ['weapon', 'defense', 'survival']) {
      const m = g.masteryRec(t), nx = masteryNeed(m.r), max = m.r >= MASTERY_MAX;
      const row = h('div', 'pg-m', `<span class="pl">${ico('m_' + t, 'ico inl')} ${MASTERY[t].name}${t === 'weapon' ? ` <small>(${esc(CLASSES[S.cls].weapon)})</small>` : ''} <b>${m.r}</b></span><span class="bar xp"><i style="width:${max ? 100 : Math.min(100, m.p / nx * 100)}%"></i></span>`);
      this.tip(row, () => `<b>${MASTERY[t].name} mastery ${m.r}</b>${MASTERY[t].how}.<br>${MASTERY[t].tip}.<br>${max ? 'Maxed.' : `${Math.floor(m.p)}/${nx} to rank ${m.r + 1}`}`);
      box.appendChild(row);
    }
    body.appendChild(box);
  }
  refreshSkills() {
    const g = this.g; if (!g || !this.slots) return;
    const list = g.skillList();
    this.slots.forEach((b) => {
      if (b.dataset.potion) { b.querySelector('.cnt').textContent = g.countPotions(b.dataset.potion); return; }
      const sk = list[+b.dataset.i];
      const icEl = b.querySelector('.ic'), key = sk ? sk.id : 'empty';
      if (icEl.dataset.k !== key) { icEl.dataset.k = key; icEl.innerHTML = sk ? ico(sk.id) : ''; }
      b.classList.toggle('empty', !sk);
      b.classList.toggle('locked', !sk && +b.dataset.i === 7);
    });
  }
  refreshSkillCD() {}
  refreshTools() {
    const g = this.g; if (!g || !this.toolSlots) return;
    for (const [k, b] of Object.entries(this.toolSlots)) {
      const id = g.S.tools?.[k], ic = b.querySelector('.ic'), key = id || 'none';
      if (ic.dataset.k !== key) {
        ic.dataset.k = key; ic.innerHTML = ico(id || toolId(k, 0));
        b.querySelector('.tr').textContent = id ? ROMAN[ITEMS[id].tier + 1] : '';
        b.style.setProperty('--tc', id ? TOOL_METAL[ITEMS[id].tier] : '#6a5a4a');
      }
      b.classList.toggle('empty', !id);
      b.classList.toggle('on', g.gathering?.tool.kind === k);
    }
  }
  refreshMountBtn() {
    const g = this.g, S = g.S, b = $('btn-mount');
    const md = MOUNTS.find((m) => m.id === S.activeMount);
    const ic = md ? `<img class="ico mnt" src="${g.mountIcon(md.id)}" alt="">` : ico('mount');
    b.innerHTML = `${ic}<small>${g.mounted ? 'Dismount' : 'Mount'}</small>`;
    b.classList.toggle('on', g.mounted);
    b.style.opacity = S.activeMount ? 1 : 0.5;
  }
  refreshTarget() {
    const g = this.g, t = g?.player?.target, el = $('hud-target');
    this.refreshPartyBtn(t);
    $('hud').classList.toggle('has-target', !!t && !t.dead); // phones slide the quest tracker under the target frame
    if (!t || t.dead) { el.hidden = true; this.tgShown = null; return; }
    el.hidden = false;
    el.classList.toggle('rp', t.kind === 'rp');
    // another player's frame opens the player menu
    if (!el.onclick) el.onclick = (ev) => { const tt = g.player.target; if (!tt || tt.kind !== 'rp' || ev.target.closest('button')) return; const r = el.getBoundingClientRect(); this.playerMenu(tt, r.left, r.bottom + 30); };
    if (this.tgShown !== t) {
      this.tgShown = t;
      el.classList.toggle('boss', !!(t.def0 && t.def0.boss));
      if (t.kind === 'monster') {
        $('tg-img').src = g.monsterIcon(t.type);
        const tag = t.def0.boss ? '<em>BOSS</em>' : t.def0.elite ? '<em>ELITE</em>' : '';
        // hunting one type over and over pays less: show what a kill is worth now
        const dr = g.diminishInfo ? g.diminishInfo(t.type) : 1;
        $('tg-name').innerHTML = `Lv${t.level} ${esc(t.def0.name)}${tag}${dr < 1 ? ` <small class="tg-dr" title="Repeated kills of this monster type give less EXP; it recovers while you hunt elsewhere">EXP ${Math.round(dr * 100)}%</small>` : ''}`;
      } else {
        $('tg-img').src = g.heroIcon(t);
        $('tg-name').innerHTML = `Lv${t.level} ${esc(t.name)} <em style="color:#9ad0ff">${CLASSES[t.cls]?.name || ''}</em>`;
      }
    }
  }
  refreshActs() {
    const S = this.g.S;
    const canSign = S.signin.last !== new Date().toISOString().slice(0, 10);
    this.acts.signin.classList.toggle('glow', canSign);
    this.setBadge(this.acts.signin, canSign);
    this.acts.gift.hidden = S.gift.idx >= ONLINE_GIFTS.length;
    this.acts.bounty.classList.toggle('glow', !!(S.bounty && S.bounty.status === 'complete'));
    const anyEntry = DUNGEONS.some((d) => S.level >= d.lv - 2 && this.g.dungeonEntries(d) > 0);
    this.acts.dungeon.classList.toggle('glow', anyEntry && !this.g.dg);
    this.refreshActsSys();
  }
  // Notification marker: a small gold sparkle (not a red "!" that reads as an error).
  setBadge(el, on) { let b = el.querySelector('.badge'); if (!on) { b && b.remove(); return; } if (!b) { b = h('span', 'badge', ico('new')); el.appendChild(b); } }
  setSheet(name) {
    this.sheet = name; $('hud').dataset.sheet = name;
    for (const k of ['acts', 'menu']) this.dockBtns?.[k]?.classList.toggle('on', name === k);
    this.evBtn?.classList.toggle('on', name === 'acts');
  }
  // expand or collapse a quick access menu (the More button)
  setQa(key, on) {
    if (!this.qa || this.qa[key] === on) return;
    this.qa[key] = on;
    const box = $('hud-' + key), t = this.qaTogs[key];
    box.classList.toggle('open', on);
    t.querySelector('.ai').innerHTML = ico(on ? (key === 'menu' ? 'qa_down' : 'qa_less') : 'more');
    t.setAttribute('aria-expanded', String(on));
    this.refreshDock();
  }
  // phones: fold the menu column away (remembered on this device) or open it again
  setMenuMin(on, save = true) {
    this.menuMin = on;
    $('hud').classList.toggle('menu-min', on);
    const f = $('menu-fold');
    f.innerHTML = `${ico(on ? 'more' : 'qa_less')}<span>Menu</span>`;
    f.setAttribute('aria-expanded', String(!on)); f.title = on ? 'Show the menu' : 'Hide the menu';
    if (save) try { localStorage.setItem(MENU_MIN, on ? '1' : '0'); } catch { /* storage unavailable */ }
    this.fitPhoneHud(); this.refreshMenuMore(); this.refreshDock();
  }
  // the arrow under the menu column: shown when some buttons are scrolled out of sight; points back up at the end
  refreshMenuMore() {
    const m = $('hud-menu'), b = $('menu-more'); if (!b) return;
    const across = m.scrollWidth > m.clientWidth + 2, down = m.scrollHeight > m.clientHeight + 2;
    b.hidden = this.menuMin || !(across || down);
    b.classList.toggle('end', across ? m.scrollLeft + m.clientWidth >= m.scrollWidth - 4 : m.scrollTop + m.clientHeight >= m.scrollHeight - 4);
  }
  // phones (portrait): the target frame and the quest tracker fill the gap between the party frame and the menu column
  fitPhoneHud() {
    const hud = $('hud'); if (!hud) return;
    const pw = parseFloat(hud.style.getPropertyValue('--party-w')) || 0;
    const room = vw() - (this.menuMin ? 8 : 66) - (pw ? pw * 0.78 + 10 : 0);
    hud.style.setProperty('--tg-s', Math.max(0.5, Math.min(0.68, room / 236)).toFixed(3));
    hud.style.setProperty('--qt-w', Math.round(Math.max(110, Math.min(176, room))) + 'px');
    this.refreshMenuMore();
  }
  // dock buttons (and the More buttons) light up when something inside them wants attention
  refreshDock() {
    const D = this.dockBtns; if (!D || !this.acts) return;
    const wants = (b) => !b.hidden && (b.classList.contains('glow') || !!b.querySelector('.badge, .dotn'));
    const folded = (b) => getComputedStyle(b).display === 'none';
    for (const [k, list] of [['acts', this.acts], ['menu', this.menuBtns]]) this.qaTogs[k].classList.toggle('hot', !this.qa[k] && Object.values(list).some((b) => wants(b) && folded(b)));
    D.acts.classList.toggle('hot', Object.values(this.acts).some((b) => !b.hidden && (b.classList.contains('glow') || !!b.querySelector('.badge'))));
    this.evBtn?.classList.toggle('hot', D.acts.classList.contains('hot'));
    D.menu.classList.toggle('hot', Object.values(this.menuBtns).some((b) => !b.classList.contains('indock') && !!b.querySelector('.dotn')));
    for (const n of DOCK_MENU) D[n].classList.toggle('hot', !!this.menuBtns[n]?.querySelector('.dotn'));
    // phones: the folded menu, or the arrow to buttons scrolled out of sight, light up too
    this.refreshMenuMore();
    const lit = [...Object.values(this.menuBtns), this.evBtn].filter((b) => b && (b.querySelector('.dotn') || b.classList.contains('hot')));
    $('menu-fold')?.classList.toggle('hot', !!this.menuMin && lit.length > 0);
    const m = $('hud-menu'), box = m.getBoundingClientRect();
    $('menu-more')?.classList.toggle('hot', !this.menuMin && lit.some((b) => { const r = b.getBoundingClientRect(); return r.width && (r.top >= box.bottom - 4 || r.left >= box.right - 4 || r.bottom <= box.top + 4); }));
  }
  markMenu(n) { const b = this.menuBtns[n]; if (b && this.panelName !== n && !b.querySelector('.dotn')) b.appendChild(h('span', 'dotn', ico('new'))); }
  setZone(z) { $('zone-name').innerHTML = `${esc(z.name)}${z.lv ? `<small>${esc(z.lv)}</small>` : ''}`; $('zone-name').classList.toggle('dz', !!z.dz); }
  // inside the Danger Zone: red vignette and a PvP badge
  setDZ(on) { $('hud').classList.toggle('in-dz', on); }
  setAutoPath(on) { $('hud-autopath').hidden = !on; }
  setAutoBattle(on) { $('hud-autobattle').hidden = !on; $('btn-auto').classList.toggle('on', on); }
  focusChat() { const c = $('hud-chat'); c.classList.add('open'); $('chat-in').focus(); }

  frame() {
    const g = this.g; if (!g) return;
    if (++this.dockFrame % 30 === 0) this.refreshDock();
    if (this.station && this.dockFrame % 15 === 0) {
      const n = g.npcById(this.station.npc);
      if (!n || g.dg || g.war || Math.hypot(n.pos.x - g.player.pos.x, n.pos.z - g.player.pos.z) > 10) { this.closePanels(); if (n) this.toast(`You walked away from ${n.data.name}`); }
    }
    const p = g.player, S = g.S;
    $('pf-hp').style.width = (p.hp / p.maxHp) * 100 + '%';
    this.txt($('pf-hp-t'), `${fmt(Math.max(0, p.hp))} / ${fmt(p.maxHp)}`);
    $('pf-mp').style.width = (p.mp / p.maxMp) * 100 + '%';
    this.txt($('pf-mp-t'), `${fmt(p.mp)} / ${fmt(p.maxMp)}`);
    // target
    const t = p.target;
    if (t !== this.tgShown || (t && t.dead)) this.refreshTarget();
    if (t && !t.dead) { $('tg-hp').style.width = (t.hp / t.maxHp) * 100 + '%'; this.txt($('tg-hp-t'), `${fmt(Math.max(0, t.hp))} / ${fmt(t.maxHp)}`); }
    // stamina on the roll button
    const sta = Math.round(p.sta ?? 100);
    if (sta !== this.staShown) { this.staShown = sta; $('btn-roll').style.setProperty('--sta', sta + '%'); }
    // cooldowns
    const list = g.skillList();
    for (const b of this.slots) {
      let rem = 0, total = 1;
      if (b.dataset.potion) { rem = g.potionCD - g.time; total = 3; }
      else { const sk = list[+b.dataset.i]; if (!sk) continue; rem = g.chargesLeft(sk) > 0 ? 0 : (g.cd[sk.id] || 0) - g.time; total = g.cdTotal(sk); b.classList.toggle('nomp', p.mp < g.mpCost(sk)); }
      const cd = b.querySelector('.cd'), cdt = b.querySelector('.cdt');
      if (rem > 0) { cd.style.background = `conic-gradient(rgba(0,0,0,.7) ${(rem / total) * 360}deg, transparent 0)`; if (cdt) this.txt(cdt, rem > 1 ? String(Math.ceil(rem)) : rem.toFixed(1)); }
      else if (cd.style.background) { cd.style.background = ''; if (cdt) this.txt(cdt, ''); }
    }
    // buffs
    const bf = $('pf-buffs');
    const elx = g.activeElixirs ? g.activeElixirs() : [];
    const sig = p.buffs.map((b) => b.id + Math.ceil(b.until - g.time)).join() + elx.map((x) => x.id + Math.ceil(x.left / 60000)).join();
    if (sig !== this.buffSig) { this.buffSig = sig; bf.innerHTML = p.buffs.map((b) => `<div class="buff">${ico(b.icon)}<small>${b.stacks ? 'x' + b.stacks : Math.ceil(b.until - g.time)}</small></div>`).join('') + elx.map((x) => `<div class="buff elx" title="${esc(x.def.name)}">${ico(x.id)}<small>${Math.ceil(x.left / 60000)}m</small></div>`).join(''); }
    // cast bar
    if (g.casting) $('cast-f').style.width = Math.min(100, (g.casting.t / g.casting.dur) * 100) + '%';
    // coords & gift timer
    this.txt($('coords'), `${Math.round(p.pos.x)}, ${Math.round(p.pos.z)}`);
    // the clock and the weather (sky.js); indoors (dungeons, trials, wars) it is hidden
    const mt = $('map-time'), out = g.map === g.world && !g.dg && !g.trial && !g.war;
    mt.hidden = !out;
    if (out) {
      const sk = g.skyInfo(), wi = sk.weather.icon === 'w_clear' && sk.night ? 'w_night' : sk.weather.icon;
      const key = sk.time + wi + sk.weather.name;
      if (mt.dataset.k !== key) { mt.dataset.k = key; mt.innerHTML = `${ico(sk.night ? 'w_night' : 'w_clear', 'ico inl')}<b>${sk.time}</b>${ico(wi, 'ico inl')}${esc(sk.weather.name)}`; mt.title = `${sk.season} · ${sk.night ? 'Night' : 'Day'} · ${sk.weather.name}. A day lasts ${DAY_MIN} minutes and the weather changes every ${WEATHER_MIN}.`; }
    }
    const gf = ONLINE_GIFTS[S.gift.idx];
    if (gf) {
      const left = Math.max(0, gf.secs - S.gift.t);
      const lbl = this.acts.gift.querySelector('.al');
      this.txt(lbl, left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'Claim!');
      const ready = left <= 0;
      if (ready !== this.giftReady) { this.giftReady = ready; this.acts.gift.classList.toggle('glow', ready); this.setBadge(this.acts.gift, ready); }
    }
    this.frameN = (this.frameN || 0) + 1;
    if (this.frameN % 2 === 0) this.drawMinimap();
    if (g.dg && this.frameN % 10 === 0) this.updateDungeonHUD();
    if (g.trial && this.frameN % 10 === 0) this.updateTrialHUD();
    if (this.panelName === 'map' && this.frameN % 15 === 0) this.drawWorldMap();
    this.frameSys();
  }

  drawMinimap() {
    const g = this.g, c = this.mm, p = g.player.pos, mm = g.map.minimap || g.world.minimap;
    if (g.map.noMap) { this.drawCompass(); return; }
    const ppu = mm.canvas.width / mm.size;
    const R = g.map.isDungeon ? 45 : 60, S = 150, k = S / (R * 2);
    c.fillStyle = g.map.isDungeon ? '#0c0f1c' : '#2a4a2a'; c.fillRect(0, 0, S, S);
    c.drawImage(mm.canvas, (p.x - mm.minX - R) * ppu, (p.z - mm.minZ - R) * ppu, R * 2 * ppu, R * 2 * ppu, 0, 0, S, S);
    if (!g.map.isDungeon) this.drawFog(c, p.x - R, p.z - R, R * 2, S, S);
    const dot = (x, z, col, r = 2.5) => { const sx = (x - p.x + R) * k, sy = (z - p.z + R) * k; if (sx < 0 || sy < 0 || sx > S || sy > S) return; c.fillStyle = col; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill(); };
    for (const m of g.monsters) if (!m.dead && (m.map || g.world) === g.map) dot(m.pos.x, m.pos.z, m.def0.boss ? '#ff3aa8' : m.def0.aggressive ? '#ff4a3a' : '#ff9a6a', m.def0.boss ? 5 : 2.2);
    for (const L of g.loots) if (L.map === g.map) dot(L.pos.x, L.pos.z, RARITY[L.q].color, 2.4);
    if (!g.map.isDungeon) {
      if (g.S.settings.others) for (const e of g.rplayers || []) if (!e.netHidden) dot(e.pos.x, e.pos.z, g.partyHas(e.peerId) ? '#7aff9a' : '#ffe04a', 3.2);
      for (const n of g.npcs) {
        const sx = (n.pos.x - p.x + R) * k, sy = (n.pos.z - p.z + R) * k, pin = this.npcPin(n.data.icon);
        if (pin) { if (sx > -8 && sy > -8 && sx < S + 8 && sy < S + 8) c.drawImage(pin, sx - 8, sy - 8, 16, 16); } else dot(n.pos.x, n.pos.z, '#ffe066', 3);
      }
      dot(WORLD_BOSS.site.x, WORLD_BOSS.site.z, g.wb && !g.wb.e.dead ? '#ff3aa8' : '#7ad8ff', 3.5);
      // the Danger Zone border and any loot sacks in it
      { const sx = (DZ.x - p.x + R) * k, sy = (DZ.z - p.z + R) * k; c.strokeStyle = 'rgba(255,60,40,.85)'; c.lineWidth = 2; c.setLineDash([5, 3]); c.beginPath(); c.arc(sx, sy, DZ.r * k, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
      for (const b of g.dzBags || []) dot(b.pos.x, b.pos.z, '#ffb03a', 3.6);
    } else if (g.dg) {
      if (g.dg.chestEnt && !g.dg.opened) dot(g.dg.chestEnt.pos.x, g.dg.chestEnt.pos.z, '#ffd84a', 4);
      if (g.dg.exitEnt) dot(g.dg.exitEnt.pos.x, g.dg.exitEnt.pos.z, '#7ad8ff', 4);
    } else if (g.war) {
      for (const a of g.war.allies) if (!a.dead) dot(a.pos.x, a.pos.z, '#6ac8ff', 2.6);
      if (!g.war.ourCrystal.dead) dot(g.war.ourCrystal.pos.x, g.war.ourCrystal.pos.z, '#3a8aff', 5.5);
    }
    if (g.player.path.length) {
      c.strokeStyle = 'rgba(122,255,122,.8)'; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(S / 2, S / 2);
      for (const w of g.player.path) c.lineTo((w.x - p.x + R) * k, (w.z - p.z + R) * k);
      c.stroke(); c.setLineDash([]);
    }
    c.save(); c.translate(S / 2, S / 2); c.rotate(Math.PI - g.player.yaw);
    c.fillStyle = '#fff'; c.strokeStyle = '#1a3a1a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  // the explored map: ground you have not walked stays dark (one pixel per 16 m cell, smoothed when drawn)
  fogChanged() { this.fogStale = true; }
  fogCanvas() {
    const g = this.g, n = FOG.n;
    if (!this.fogCv) { this.fogCv = document.createElement('canvas'); this.fogCv.width = this.fogCv.height = n; this.fogStale = true; }
    if (this.fogStale && g.fogBits) {
      this.fogStale = false;
      const x = this.fogCv.getContext('2d'), img = x.createImageData(n, n);
      for (let k = 0; k < n * n; k++) { const o = k * 4; img.data[o] = 10; img.data[o + 1] = 13; img.data[o + 2] = 22; img.data[o + 3] = g.fogBits[k] ? 0 : 240; }
      x.putImageData(img, 0, 0);
    }
    return this.fogCv;
  }
  drawFog(c, x0, z0, size, dw, dh) {
    const f = this.fogCanvas(), k = 1 / FOG.cell, sx = (x0 + FOG.size / 2) * k, sz = (z0 + FOG.size / 2) * k, sw = size * k;
    // clip the source to the grid so every browser scales it the same way
    const cx0 = Math.max(0, sx), cz0 = Math.max(0, sz), cx1 = Math.min(FOG.n, sx + sw), cz1 = Math.min(FOG.n, sz + sw);
    if (cx1 <= cx0 || cz1 <= cz0) return;
    const s = dw / sw;
    c.save(); c.imageSmoothingEnabled = true;
    c.drawImage(f, cx0, cz0, cx1 - cx0, cz1 - cz0, (cx0 - sx) * s, (cz0 - sz) * s, (cx1 - cx0) * s, (cz1 - cz0) * (dh / sw));
    c.restore();
  }
  // no map in this trial: only a compass that points north
  drawCompass() {
    const c = this.mm, S = 150, yaw = this.g.player.yaw;
    c.fillStyle = '#141a14'; c.fillRect(0, 0, S, S);
    c.save(); c.translate(S / 2, S / 2);
    c.strokeStyle = 'rgba(243,199,91,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 58, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#ff5a4a'; c.beginPath(); c.moveTo(0, -54); c.lineTo(9, -30); c.lineTo(-9, -30); c.closePath(); c.fill();
    c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff1c8'; c.fillText('N', 0, -14);
    c.rotate(Math.PI - yaw); c.fillStyle = '#fff'; c.strokeStyle = '#1a3a1a';
    c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  // ------------------------------------------------------------ quest tracker
  refreshQuest() {
    const g = this.g; if (!g) return;
    if (g.trial) { this.renderTrialTracker(); return; }
    if (g.dg) { this.renderDungeonTracker(); return; }
    if (g.war) { this.renderWarTracker(); return; }
    const S = g.S, list = $('qt-list'); list.innerHTML = '';
    const q = g.quest();
    if (q && q.def) {
      const done = q.status === 'complete';
      const obj = g.questObjective(q);
      const it = h('div', 'qt-item', `<span class="qtag main">Main</span><span class="qn">${esc(q.def.name)}</span><div class="qo ${done ? 'done' : ''}">${linkify(obj)}</div>`);
      it.title = 'Click to auto-path to the quest'; it.onclick = () => { g.sfx.play('click'); g.autoQuest('main'); };
      list.appendChild(it);
    } else {
      list.appendChild(h('div', 'qt-item', `<span class="qtag main">Main</span><span class="qn">Story complete</span><div class="qo">Your legend is told. Take bounties from <u>Captain Elena</u>.</div>`)).onclick = () => g.talkTo(g.npcById('elena'), true);
    }
    const B = S.bounty;
    if (B) {
      const obj = B.status === 'complete' ? 'Return to Captain Elena' : `Defeat ${MONSTERS[B.target].name} (${B.prog}/${B.count})`;
      const it = h('div', 'qt-item', `<span class="qtag bounty">Bounty</span><span class="qn">Daily Bounty</span><div class="qo ${B.status === 'complete' ? 'done' : ''}">${linkify(obj)}</div>`);
      it.title = 'Click to auto-path to the bounty'; it.onclick = () => { g.sfx.play('click'); g.autoQuest('bounty'); };
      list.appendChild(it);
    } else if (g.bountyUnlocked()) {
      list.appendChild(h('div', 'qt-item', `<span class="qtag bounty">Bounty</span><div class="qo">Visit <u>Captain Elena</u> for a bounty</div>`)).onclick = () => g.talkTo(g.npcById('elena'), true);
    }
    this.guideTracker(list);
    this.questExtras(list);
    if (this.panelName === 'quests') this.renderPanel();
  }

  renderDungeonTracker() {
    const g = this.g, dg = g.dg, list = $('qt-list'); list.innerHTML = '';
    const it = h('div', 'qt-item', `<span class="qtag dungeon">Dungeon</span><span class="qn">${esc(dg.def.name)}</span><div class="qo"><u id="dg-obj"></u></div><div class="dg-meta"><span id="dg-time"></span><span id="dg-deaths"></span></div>`);
    it.title = 'What is left'; it.onclick = () => { g.sfx.play('click'); g.dungeonGo(); };
    list.appendChild(it);
    const leave = h('button', 'btn small gray', 'Leave Dungeon'); leave.style.margin = '4px 0 0 4px';
    leave.onclick = () => this.modal(dg.done ? 'Return to Carlyle?' : 'Leave the dungeon?', dg.done ? 'Any loot left on the floor will be collected for you.' : 'This run ends and the entry stays used.', [{ label: 'Leave', fn: () => { g.leaveDungeon(); } }, { label: 'Stay', cls: 'gray' }]);
    list.appendChild(leave);
    this.updateDungeonHUD();
  }
  updateDungeonHUD() {
    const g = this.g, P = g.dungeonProgress(); if (!P) return;
    const objEl = $('dg-obj'); if (!objEl) return;
    let obj;
    if (P.done) obj = P.opened ? 'Step into the exit portal' : 'Open the treasure chest';
    else if (P.cur === P.total - 1) obj = P.boss ? `Defeat ${P.boss.def0.name}` : 'Enter the boss chamber';
    else obj = `Chamber ${P.cur + 1}/${P.total}: defeat all foes (${P.count - P.alive}/${P.count})`;
    this.txt(objEl, obj);
    this.txt($('dg-time'), P.done ? `Time ${mmss(P.time)}` : `Time left ${mmss(Math.max(0, DUNGEON_RULES.timeLimit - P.time))}`);
    this.txt($('dg-deaths'), P.done ? `Rating ${P.rating}` : `Deaths ${g.dg.deaths}/${DUNGEON_RULES.deathLimit}`);
    const dt = $('dg-time'); if (dt) dt.style.color = !P.done && DUNGEON_RULES.timeLimit - P.time < 120 ? '#ff8a7a' : '';
  }
  renderWarTracker() {
    const g = this.g, list = $('qt-list'); list.innerHTML = '';
    list.appendChild(h('div', 'qt-item', `<span class="qtag war">Guild War</span><span class="qn">vs ${esc(g.war.opp.name)}</span><div class="qo">Destroy the <u>enemy Spirit Crystal</u> (north) and defend yours</div>`)).onclick = () => { const c = g.war.theirCrystal; if (!c.dead) { g.setTarget(c); g.engage = true; } };
    const leave = h('button', 'btn small gray', 'Leave Battle'); leave.style.margin = '4px 0 0 4px';
    leave.onclick = () => this.modal('Leave the battle?', g.war.done ? 'Return to Carlyle.' : 'Leaving early counts as a defeat.', [{ label: 'Leave', fn: () => { if (!g.war.done) g.endWar(false, 'left'); g.leaveWar(); } }, { label: 'Stay', cls: 'gray' }]);
    list.appendChild(leave);
  }
  enterDungeon() { this.closePanels(); this.closeDialog(); this.refreshQuest(); this.refreshActs(); $('hud').classList.add('in-dungeon'); }
  leaveDungeon() { $('hud').classList.remove('in-dungeon'); this.refreshQuest(); this.refreshActs(); this.closeModal(); }
  fade(fn) {
    let f = $('fade');
    if (!f) { f = h('div', ''); f.id = 'fade'; document.getElementById('app').appendChild(f); }
    f.classList.add('on');
    setTimeout(() => { try { fn(); } finally { setTimeout(() => f.classList.remove('on'), 120); } }, 380);
  }
  lootPopup(items, extra = {}) {
    const m = $('modal'); m.hidden = false;
    const cards = items.map((eq, i) => {
      const R = RARITY[eq.quality];
      return `<div class="lcard q${eq.quality}" style="animation-delay:${i * 0.18}s"><div class="lc-ic">${ico(eq.icon)}</div><div class="lc-n" style="color:${R.color}">${esc(eq.name)}</div><div class="lc-r">${R.name}</div></div>`;
    }).join('');
    const rw = [];
    if (extra.gold) rw.push(`<span class="rw"><span class="coin"></span>${fmt(extra.gold)}</span>`);
    if (extra.diamonds) rw.push(`<span class="rw"><span class="gem"></span>${fmt(extra.diamonds)}</span>`);
    if (extra.exp) rw.push(`<span class="rw">${ico('exp', 'ico inl')}${fmt(extra.exp)} EXP</span>`);
    if (extra.ticket) rw.push(`<span class="rw">${ico('dungeon_ticket', 'ico inl')}Dungeon Ticket</span>`);
    for (const [id, n] of Object.entries(extra.mats || {})) rw.push(`<span class="rw">${ico(MATERIALS[id]?.icon || id, 'ico inl')}${esc(MATERIALS[id]?.name || id)} x${n}</span>`);
    m.innerHTML = `<div class="frame loot-pop">${extra.rating ? `<div class="lp-rating r${extra.rating}">${extra.rating}</div>` : ''}<h3>${esc(extra.title || 'Treasure')}</h3>${extra.note ? `<p class="lp-note">${esc(extra.note)}</p>` : ''}<div class="lcards">${cards}</div><div class="drew lp-rw">${rw.join('')}</div><div class="macts"></div></div>`;
    const ok = h('button', 'btn', 'Collect'); ok.onclick = () => { this.g?.sfx.play('click'); this.closeModal(); };
    m.querySelector('.macts').appendChild(ok);
    m.querySelectorAll('.lcard').forEach((c, i) => this.tip(c, () => this.equipTip(items[i])));
    this.modalPersistent = false;
    m.onclick = (e) => { if (e.target === m) this.closeModal(); };
  }

  // ------------------------------------------------------------ feedback
  chat(ch, html, who) {
    const log = $('chat-log');
    const p = h('p', 'c-' + ch, `<span class="ch">[${CHN[ch] || ch}]</span> ${who ? `<span class="who">${esc(who)}</span>: ` : ''}${html}`);
    p.dataset.ch = ch;
    log.appendChild(p);
    while (log.children.length > 90) log.firstChild.remove();
    this.filterOne(p);
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    if (near || ch === 'system') log.scrollTop = log.scrollHeight;
  }
  filterOne(p) { const f = this.chatFilter, c = p.dataset.ch; p.hidden = !(f === 'all' || f === c || (f === 'system' && c === 'announce') || (f === 'world' && c === 'player')); }
  applyChatFilter() { for (const p of $('chat-log').children) this.filterOne(p); $('chat-log').scrollTop = 1e9; }
  toast(msg, cls = '') {
    const t = h('div', 'toast stroke ' + cls); t.textContent = msg;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 2400);
  }
  banner(a, b, cls = '') {
    const el = this.bannerEl; el.className = cls; el.innerHTML = `<div class="b1">${esc(a)}</div>${b ? `<div class="b2 stroke">${esc(b)}</div>` : ''}`;
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => { el.innerHTML = ''; }, 2800);
  }
  cast(label, dur) { $('hud-cast').hidden = false; $('cast-l').textContent = label; $('cast-f').style.width = '0%'; }
  cancelCast() { $('hud-cast').hidden = true; }

  // ------------------------------------------------------------ dialog & modal
  dialog({ npc, qname, text, rewards, buttons }) {
    const g = this.g, d = $('dialog');
    d.hidden = false; d.innerHTML = '';
    const pi = h('div', 'dp'); const img = new Image(); img.alt = ''; img.src = g.npcIcon(npc.id, npc.data.look); pi.appendChild(img);
    const box = h('div', 'db frame');
    box.innerHTML = `<button class="x-close" aria-label="Close"></button><div class="dn">${esc(npc.data.name)}<small>&lt;${esc(npc.data.title)}&gt;</small></div>${qname ? `<div class="dq">${esc(qname)}</div>` : ''}<div class="dt"></div>`;
    box.querySelector('.x-close').onclick = () => this.closeDialog();
    if (rewards) {
      const rw = h('div', 'drew', 'Rewards:');
      const chip = (html) => rw.appendChild(h('span', 'rw', html));
      if (rewards.exp) chip(`${ico('exp', 'ico inl')}${fmt(rewards.exp)} EXP`);
      if (rewards.gold) chip(`<span class="coin"></span>${fmt(rewards.gold)}`);
      if (rewards.diamonds) chip(`<span class="gem"></span>${fmt(rewards.diamonds)}`);
      for (const [id, q] of rewards.items || []) chip(`${ico(id, 'ico inl')}${esc(ITEMS[id].name)} x${q}`);
      if (rewards.equip) { const R = RARITY[rewards.equipQ ?? 2]; chip(`${ico(slotIcon(rewards.equip, g.S.cls) + ((rewards.equipQ ?? 2) >= 4 ? '_l' : ''), 'ico inl')}<span style="color:${R.color}">${R.name} ${SLOT_INFO[rewards.equip].label}</span>`); }
      if (rewards.pet) { const pd = PETS.find((x) => x.id === rewards.pet); chip(`${ico('paw', 'ico inl')}<span style="color:${RARC[pd.rarity]}">${esc(pd.name)}</span>`); }
      if (rewards.mount) chip(`${ico('mount', 'ico inl')}${esc(MOUNTS.find((x) => x.id === rewards.mount).name)}`);
      if (rewards.sprite) chip(`${ico('sprite', 'ico inl')}Elemental Sprite`);
      if (rewards.wings) chip(`${ico('wings', 'ico inl')}Fairy Wings`);
      box.appendChild(rw);
    }
    const acts = h('div', 'dacts');
    for (const b of buttons) {
      const btn = h('button', 'btn ' + (b.cls || ''), esc(b.label));
      btn.onclick = () => { g.sfx.play('click'); if (b.fn) b.fn(); else this.closeDialog(); };
      acts.appendChild(btn);
    }
    box.appendChild(acts);
    d.appendChild(pi); d.appendChild(box);
    // typewriter
    const dt = box.querySelector('.dt'); let i = 0;
    clearInterval(this.typeT);
    this.typeT = setInterval(() => { i += 3; dt.textContent = text.slice(0, i); if (i >= text.length) clearInterval(this.typeT); }, 16);
    dt.onclick = () => { clearInterval(this.typeT); dt.textContent = text; };
  }
  closeDialog() { clearInterval(this.typeT); $('dialog').hidden = true; }
  modal(title, text, buttons = [{ label: 'OK' }], persistent = false, img = null) {
    const m = $('modal'); m.hidden = false;
    m.innerHTML = `<div class="frame">${img ? `<img src="${img}" alt="" style="width:120px;height:120px;border-radius:10px;background:radial-gradient(circle at 50% 40%,#4a6ac8,#10183a);margin-bottom:8px">` : ''}<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="macts"></div></div>`;
    const acts = m.querySelector('.macts');
    for (const b of buttons) {
      const btn = h('button', 'btn ' + (b.cls || ''), esc(b.label));
      btn.onclick = () => { this.g?.sfx.play('click'); const r = b.fn ? b.fn() : true; if (r !== false) this.closeModal(); };
      acts.appendChild(btn);
    }
    this.modalPersistent = persistent;
    m.onclick = (e) => { if (e.target === m && !persistent) this.closeModal(); };
  }
  closeModal() { $('modal').hidden = true; }
  closeTop() {
    if (!$('modal').hidden && !this.modalPersistent) { this.closeModal(); return true; }
    if (this.pmenuKey) { this.playerMenu(null); return true; }
    if ($('inspect-win')) { this.inspectWin(null); return true; }
    if (!$('dialog').hidden) { this.closeDialog(); return true; }
    if (this.panel) { this.closePanels(); return true; }
    return false;
  }

  // ------------------------------------------------------------ tooltip
  tip(el, fn) {
    const tt = $('tooltip');
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'touch') return; const html = fn(); if (!html) return; tt.innerHTML = html; tt.hidden = false; this.moveTip(e); });
    el.addEventListener('pointermove', (e) => this.moveTip(e));
    el.addEventListener('pointerleave', () => { tt.hidden = true; });
  }
  moveTip(e) {
    const tt = $('tooltip'); if (tt.hidden) return;
    const w = tt.offsetWidth, hh = tt.offsetHeight, cx = e.clientX / UIZ.k, cy = e.clientY / UIZ.k; // layer px (touchfit.js)
    let x = cx + 14, y = cy - hh - 10;
    if (x + w > vw() - 8) x = cx - w - 14;
    if (y < 8) y = cy + 18;
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
  }
  skillTip(sk) {
    const g = this.g, r = g.rk(sk);
    if (sk.basic) return `<b style="color:var(--gold-l)">${esc(sk.name)}</b>${esc(sk.desc)}`;
    return `<b style="color:var(--gold-l)">${esc(sk.name)} <span style="color:var(--cyan)">Rank ${r}/10</span></b>${esc(sk.desc)}.<br><span class="ts">${esc(this.skillNumbers(sk, Math.max(1, r)))}</span>`;
  }
  equipTip(eq) {
    const lines = itemLines(eq, this.g?.S?.equip, this.g?.gearCtx ? this.g.gearCtx() : null);
    return lines.map((l, i) => i === 0 ? `<b style="color:${l.color}">${esc(l.text)}</b>` : `<div style="color:${l.color || 'var(--muted)'}">${esc(l.text)}</div>`).join('');
  }

  // ------------------------------------------------------------ panels
  togglePanel(name, forceOpen = false, arg = null) {
    if (this.panelName === name && !forceOpen) { this.closePanels(); return; }
    const st = this.stationNext; this.stationNext = null;
    if (!st && this.g.stationFor(name)) { this.g.goToStation(name); return; } // only at the NPC: walk there
    if (name === 'dungeons' && arg) this.sel.dungeon = arg;
    this.closePanels(true); this.closeDialog();
    this.station = st || null;
    this.panelName = name;
    const dot = this.menuBtns[name]?.querySelector('.dotn'); if (dot) dot.remove();
    const titles = { char: 'Character', bag: 'Bag', skills: 'Skills', pets: 'Pets & Sprites', mounts: 'Mount Stable', quests: 'Quest Log', map: this.g.dg ? this.g.dg.def.name : this.g.war ? 'Spirit Crystal Arena' : 'World Map of Carlyle', settings: 'Settings', mall: 'Mall', signin: 'Daily Sign-In', gift: 'Online Gifts', rank: 'Leaderboards', dungeons: 'Dungeons',
      online: 'Players Online', life: 'Professions', collect: 'Relic Collection', wardrobe: 'Wardrobe', shop: SHOPS[this.sel.shop]?.name || 'Shop', auction: 'Auction House',
      missions: 'Daily & Weekly Missions', guild: this.g.S.guild ? `Guild · ${this.g.S.guild.name}` : 'Guilds of Carlyle', market: 'Carlyle Market', forge: this.stationNext?.npc === 'opal' || this.station?.npc === 'opal' ? "Opal's Gem Workshop" : "Gorm's Forge", codex: 'Legendary Codex', season: 'Season Pass', event: this.g.event ? this.g.event.name : 'Festivals', worldboss: 'World Boss', trials: 'Breakthrough Trials', cooking: 'Campfire Cooking', prestige: 'Hall of Firsts' };
    const widths = { char: 600, bag: 412, skills: 720, pets: 520, mounts: 520, quests: 480, map: 600, settings: 400, mall: 560, signin: 560, gift: 420, rank: 560, dungeons: 620, missions: 600, guild: 600, market: 620, forge: 600, codex: 620, season: 660, event: 600, worldboss: 600, online: 520, life: 620, collect: 600, wardrobe: 600, shop: 560, auction: 640, trade: 640, trials: 680, cooking: 540, prestige: 520 };
    const p = h('div', 'panel frame');
    p.style.width = `min(${widths[name]}px, calc(var(--lw, 1vw) * 100 - 24px))`;
    p.innerHTML = `<div class="ptitle">${titles[name]}</div><button class="x-close" aria-label="Close"></button><div class="pbody"></div>`;
    p.querySelector('.x-close').onclick = () => this.closePanels();
    $('panels').appendChild(p);
    this.panel = p;
    this.renderPanel();
    p.style.left = Math.max(12, (vw() - p.offsetWidth) / 2) + 'px';
    p.style.top = Math.max(12, (vh() - p.offsetHeight) / 2 - 20) + 'px';
    this.dragify(p);
    this.g.sfx.play('open');
  }
  closePanels(silent) { if (this.panel) this.panel.remove(); this.panel = null; this.panelName = null; this.station = null; $('tooltip').hidden = true; }
  // open a station window from its NPC (it closes again when you walk away)
  openStation(name, npc, sel = {}) {
    Object.assign(this.sel, sel);
    this.closeDialog();
    this.stationNext = { name, npc };
    this.togglePanel(name, true);
  }
  dragify(p) {
    const t = p.querySelector('.ptitle'); let d = null;
    t.addEventListener('pointerdown', (e) => { d = { x: e.clientX / UIZ.k - p.offsetLeft, y: e.clientY / UIZ.k - p.offsetTop }; t.setPointerCapture(e.pointerId); });
    t.addEventListener('pointermove', (e) => { if (!d) return; p.style.left = Math.min(vw() - 60, Math.max(-p.offsetWidth + 80, e.clientX / UIZ.k - d.x)) + 'px'; p.style.top = Math.min(vh() - 40, Math.max(0, e.clientY / UIZ.k - d.y)) + 'px'; });
    t.addEventListener('pointerup', () => { d = null; });
  }
  refreshPanel() { if (this.panel) this.renderPanel(); }
  renderPanel() {
    const body = this.panel.querySelector('.pbody');
    const scroll = body.scrollTop;
    body.innerHTML = '';
    this['panel_' + this.panelName](body);
    body.scrollTop = scroll;
    $('tooltip').hidden = true;
  }
  tabs(body, key, list) {
    const cur = this.sel[key] ?? list[0][0];
    const t = h('div', 'tabs');
    for (const [id, label] of list) { const b = h('button', cur === id ? 'sel' : '', label); b.onclick = () => { this.sel[key] = id; this.renderPanel(); }; t.appendChild(b); }
    body.appendChild(t);
    return cur;
  }

  panel_char(body) {
    const g = this.g, S = g.S, p = g.player, C = CLASSES[S.cls];
    const wrap = h('div', 'char-wrap');
    const col = (slots) => {
      const c = h('div', 'eq-col');
      for (const s of slots) {
        const eq = S.equip[s];
        const b = h('button', 'cell ' + (eq ? 'q' + eq.quality : 'empty'), eq ? `${ico(eq.icon)}${eq.enh ? `<span class="enh">+${eq.enh}</span>` : ''}${eq.dur === 0 ? '<span class="brk"></span>' : ''}` : `<span class="ghost">${ico(slotIcon(s, S.cls))}</span>`);
        b.setAttribute('aria-label', SLOT_INFO[s].label);
        if (this.sel.eqSlot === s) b.style.outline = '2px solid var(--gold)';
        b.onclick = () => { this.sel.eqSlot = s; this.renderPanel(); };
        this.tip(b, () => eq ? this.equipTip(eq) : `<b>${SLOT_INFO[s].label}</b>Empty slot`);
        c.appendChild(b);
      }
      return c;
    };
    wrap.appendChild(col(['weapon', 'helm', 'armor', 'gloves']));
    const port = h('div', 'char-portrait'); const img = new Image(); img.alt = ''; img.src = g.fullIcon(); port.appendChild(img);
    port.appendChild(h('div', 'cpn stroke', `Lv${S.level} ${esc(S.name)} · ${C.name}`));
    wrap.appendChild(port);
    wrap.appendChild(col(['boots', 'necklace', 'ring']));
    const st = h('div', 'stats-col');
    st.appendChild(h('div', 'br-big', `<span class="flame"></span>${fmt(g.br)}`));
    const RC = RACES[S.app?.race] || RACES.human;
    st.appendChild(h('div', 'stats', `
      <span>Class</span><span>${C.name}</span><span>${S.awaken != null ? 'Path' : 'Race'}</span><span>${S.awaken != null ? esc(C.paths[S.awaken]) : esc(RC.name)}</span>
      <span>Max HP</span><span>${fmt(p.maxHp)}</span><span>Max MP</span><span>${fmt(p.maxMp)}</span>
      <span>Attack</span><span>${fmt(g.atkOf(p))}</span><span>Defense</span><span>${fmt(g.defOf(p))}</span>
      <span>Critical</span><span>${g.critOf(p).toFixed(1)}%</span><span>Crit Damage</span><span>+${Math.round(p.critDmg * 100)}%</span>
      <span>Move Speed</span><span>${(g.speedOf(p) / 7 * 100).toFixed(0)}%</span><span>Element</span><span style="color:${C.elemColor}">${C.element}</span>`));
    wrap.appendChild(st);
    body.appendChild(wrap);
    this.progressBox(body);
    const s = this.sel.eqSlot, eq = s && S.equip[s];
    const det = h('div', 'detail');
    if (eq) {
      det.innerHTML = `<div class="dtx">${this.equipTip(eq)}<br>Enhancement <b>+${eq.enh || 0}</b>/15${(eq.enh || 0) < 15 ? ` · next ${Math.round(g.enhChance(eq) * 100)}% success` : ' · maxed'}</div>`;
      const acts = h('div', 'acts');
      const be = h('button', 'btn', (eq.enh || 0) < 15 ? `Enhance +${(eq.enh || 0) + 1}` : 'Enhance'); be.onclick = () => { this.sel.forgeRef = { where: 'equip', slot: s }; this.sel.fgTab = 'enhance'; this.togglePanel('forge', true); }; acts.appendChild(be);
      const bu = h('button', 'btn gray', 'Unequip'); bu.onclick = () => { g.unequip(s); this.sel.eqSlot = null; }; acts.appendChild(bu);
      det.appendChild(acts);
    } else det.innerHTML = '<div class="dtx">Select an equipment slot. Gorm the Blacksmith says: enhanced gear raises your Battle Rating! Reforge, ascend and socket gems at the Forge (Y).</div>';
    body.appendChild(det);
    this.titleChooser(body);
  }

  // the Bag: a compact window with tabs, six slots a row, the selected item's buttons, Sort and Sell All, and your money
  panel_bag(body) {
    const g = this.g, S = g.S;
    this.panel.classList.add('bag2');
    this.panel.querySelector('.ptitle').innerHTML = `Bag <small>${S.bag.length} / ${g.bagMax()}</small>`;
    const tab = this.tabs(body, 'bagTab', [['all', 'All'], ['gear', 'Gear'], ['use', 'Consume'], ['quest', 'Quest'], ['val', 'Valuable'], ['other', 'Others'], ['mats', 'Mats']]);
    body.querySelector('.tabs').classList.add('small');
    if (tab === 'mats') this.matsGrid(body);
    else {
      const grid = h('div', 'grid-bag bag6');
      const list = S.bag.map((b, i) => [b, i]).filter(([b]) => tab === 'all' || bagCat(b) === tab);
      const n = tab === 'all' ? g.bagMax() : Math.max(18, Math.ceil(list.length / 6) * 6);
      for (let k = 0; k < n; k++) {
        const e = list[k];
        if (!e) { grid.appendChild(h('div', 'cell empty')); continue; }
        const [b, i] = e;
        const q = b.eq ? b.eq.quality : ITEMS[b.id].quality;
        const c = h('button', `cell q${q}`, b.eq ? `${ico(b.eq.icon)}${b.eq.enh ? `<span class="enh">+${b.eq.enh}</span>` : ''}${b.eq.lock ? '<span class="lockd"></span>' : ''}` : `${ico(b.id)}${b.qty > 1 ? `<span class="cnt">${b.qty}</span>` : ''}`);
        if (this.sel.bagIdx === i) c.classList.add('picked');
        c.onclick = () => { this.sel.bagIdx = this.sel.bagIdx === i ? null : i; this.renderPanel(); };
        c.ondblclick = () => { this.sel.bagIdx = null; g.useBagItem(i); };
        this.tip(c, () => b.eq ? this.equipTip(b.eq) + this.compare(b.eq) : `<b style="color:${RARITY[q].color}">${esc(ITEMS[b.id].name)}</b>${esc(ITEMS[b.id].desc)}`);
        grid.appendChild(c);
      }
      body.appendChild(grid);
      // the selected item and what you can do with it
      const b = S.bag[this.sel.bagIdx], strip = h('div', 'bag-sel');
      if (b) {
        const it = b.eq ? null : ITEMS[b.id], q = b.eq ? b.eq.quality : it.quality;
        strip.innerHTML = `<span class="cell q${q}">${ico(b.eq ? b.eq.icon : b.id)}</span><b style="color:${RARITY[q].color}">${esc(b.eq ? b.eq.name : it.name)}${b.eq?.enh ? ` +${b.eq.enh}` : ''}</b>`;
        const acts = h('div', 'acts');
        if (b.eq || it.type !== 'quest') { const bu = h('button', 'btn green small', b.eq ? 'Equip' : it.type === 'egg' ? 'Hatch' : it.type === 'food' ? 'Eat' : 'Use'); bu.onclick = () => { const i = this.sel.bagIdx; this.sel.bagIdx = null; g.useBagItem(i); }; acts.appendChild(bu); }
        if (!it || it.type !== 'quest') { const bs = h('button', 'btn gray small', 'Sell'); bs.onclick = () => { const i = this.sel.bagIdx; this.sel.bagIdx = null; g.sell(i); }; acts.appendChild(bs); }
        if (b.eq) { const bl = h('button', 'btn gray small', b.eq.lock ? 'Unlock' : 'Lock'); bl.onclick = () => g.toggleLock(this.sel.bagIdx); acts.appendChild(bl); }
        strip.appendChild(acts);
      } else strip.innerHTML = '<span class="muted">Tap an item to use, equip or sell it · double-click uses it</span>';
      body.appendChild(strip);
      this.bagTools(body);
    }
    // your money and the Mall
    const foot = h('div', 'bag-foot', `<div class="bag-money"><div><span class="gem"></span>Diamonds<b>${fmt(S.diamonds)}</b></div><div><span class="coin"></span>Gold<b>${fmt(S.gold)}</b></div></div>`);
    const mall = h('button', 'bag-mall', `${ico('mall')}<span>Mall</span>`); mall.onclick = () => this.togglePanel('mall'); foot.appendChild(mall);
    body.appendChild(foot);
  }
  compare(eq) {
    const cur = this.g.S.equip[eq.slot];
    if (!cur) return '<div style="color:#7aff7a">Slot is empty: equip for a free upgrade!</div>';
    const d = Math.round(itemScore(eq) - itemScore(cur));
    return `<div style="color:${d >= 0 ? '#7aff7a' : '#ff7a7a'}">Battle Rating ${d >= 0 ? '+' : ''}${fmt(d)} vs equipped</div>`;
  }

  panel_skills(body) {
    const g = this.g, S = g.S, C = CLASSES[S.cls], T = CLASS_SKILLS[S.cls];
    const left = g.skillPtsLeft(), total = g.skillPtsTotal(), wm = g.weaponMastery();
    // header: points, weapon mastery, respec
    const head = h('div', 'sk-head', `<span class="st-pts"><b>${left}</b>skill point${left === 1 ? '' : 's'}</span><span class="muted">${total - left} of ${total} spent · 1 per level and 3 per cleared trial · weapon mastery ${wm}</span>`);
    const R = g.respecInfo();
    const rb = h('button', 'btn small gray', R.free ? 'Reset ranks (free today)' : 'Reset ranks (used today)');
    rb.disabled = !R.ok;
    rb.title = R.town ? (R.free ? 'Free once per day in a town' : 'Come back tomorrow') : 'Only in a town';
    rb.onclick = () => this.modal('Reset your skill ranks?', 'Every skill goes back to rank 1 and all points return to spend again. Free once per day, only in a town.', [{ label: 'Reset', fn: () => g.respecSkills() }, { label: 'Cancel', cls: 'gray' }]);
    head.appendChild(rb); body.appendChild(head);
    // loadout: six actives and the ultimate
    const lo = h('div', 'sk-load');
    lo.appendChild(h('div', 'sk-ll', 'Loadout<small>6 active skills + 1 ultimate. Select a slot, then a skill.</small>'));
    const slots = h('div', 'sk-slots');
    const mk = (key, id, label) => {
      const sk = id && SKILL_BY_ID[id];
      const b = h('button', 'sk-slot' + (this.sel.skSlot === key ? ' sel' : '') + (key === 'ult' ? ' ult' : ''), `${sk ? ico(sk.id) : ''}<span class="k">${label}</span>`);
      b.setAttribute('aria-label', `Slot ${label}: ${sk ? sk.name : 'empty'}`);
      b.onclick = () => { this.sel.skSlot = this.sel.skSlot === key ? null : key; this.renderPanel(); };
      if (sk) this.tip(b, () => this.skillTip(sk));
      slots.appendChild(b);
    };
    S.loadout.forEach((id, i) => mk(i, id, String(i + 1)));
    mk('ult', S.ult, '7');
    lo.appendChild(slots); body.appendChild(lo);
    // which branch to show
    const pn = C.paths;
    const tab = this.tabs(body, 'skTab', [['core', 'Core · Lv 1-90'], ['p0', `${pn[0]}${S.awaken === 0 ? ' (your path)' : ''}`], ['p1', `${pn[1]}${S.awaken === 1 ? ' (your path)' : ''}`]]);
    const list = tab === 'core' ? T.core : T.paths[tab === 'p0' ? 0 : 1];
    if (tab !== 'core') {
      const pi = tab === 'p0' ? 0 : 1;
      const box = h('div', 'sk-path', `<b>${esc(pn[pi])}</b> <span class="muted">${esc(C.pathRole[pi])} · awakening path (Lv 100-200)</span>`);
      if (S.awaken === pi) box.appendChild(h('span', 'good', ' · your path'));
      else {
        const cb = h('button', 'btn small' + (S.level >= 100 ? ' green' : ' gray'), S.awaken == null ? 'Choose this path' : 'Switch (Trial Sigil)');
        cb.disabled = S.level < 100;
        cb.title = S.level < 100 ? 'Awakening opens at Lv 100' : '';
        cb.onclick = () => this.modal(`Awaken as ${pn[pi]}?`, S.awaken == null ? `${esc(C.name)} awakens into ${esc(pn[pi])}: a new skill every 10 levels up to the ultimate at Lv 200.` : 'Switching your awakening path costs one Trial Sigil. Your other path\'s skills are forgotten.', [{ label: 'Awaken', fn: () => g.chooseAwaken(pi) }, { label: 'Cancel', cls: 'gray' }]);
        box.appendChild(cb);
      }
      body.appendChild(box);
    }
    const grid = h('div', 'sk-list');
    for (const sk of list) {
      const r = g.rk(sk), open = g.skillUnlocked(sk);
      const row = h('button', 'sk-row' + (open ? '' : ' locked') + (this.sel.skId === sk.id ? ' sel' : '') + ' t-' + sk.type);
      row.innerHTML = `<span class="sk-lv">Lv ${sk.lv}</span><span class="sk-ic">${ico(sk.id)}</span><span class="sk-tx"><b>${esc(sk.name)}</b><small>${sk.type === 'passive' ? 'Passive' : sk.type === 'ultimate' ? 'Ultimate' : 'Active'} · ${esc(sk.desc)}</small></span><span class="sk-r">${open ? `${r}/10` : '—'}</span>`;
      row.onclick = () => {
        // with a loadout slot selected, a click puts the skill there
        const slot = this.sel.skSlot;
        if (slot != null && open && ((slot === 'ult' && sk.type === 'ultimate') || (slot !== 'ult' && sk.type === 'active'))) { g.setLoadout(slot, sk.id); this.sel.skSlot = null; }
        this.sel.skId = sk.id; this.renderPanel();
      };
      row.ondblclick = () => g.rankUp(sk.id);
      grid.appendChild(row);
    }
    body.appendChild(grid);
    // details of the selected skill
    const sk = (this.sel.skId && SKILL_BY_ID[this.sel.skId]?.cls === S.cls && list.includes(SKILL_BY_ID[this.sel.skId])) ? SKILL_BY_ID[this.sel.skId] : list[0];
    const r = g.rk(sk), why = g.rankBlock(sk);
    const det = h('div', 'st-det');
    det.innerHTML = `<div class="st-di">${ico(sk.id)}</div><div class="st-dt"><b>${esc(sk.name)}</b> <span class="muted">${sk.type === 'passive' ? 'Passive' : sk.type === 'ultimate' ? 'Ultimate' : 'Active'} · Lv ${sk.lv} · Rank ${r}/10</span>
      <div>${esc(sk.desc)}.</div><div class="muted">${esc(this.skillNumbers(sk, Math.max(1, r)))}</div>${r && r < 10 ? `<div class="good">Rank ${r + 1}: ${esc(this.skillNumbers(sk, r + 1))}</div>` : ''}${why && r < 10 ? `<div style="color:#ffb08a">${esc(why)}</div>` : ''}</div>`;
    const acts = h('div', 'sk-acts');
    const lb = h('button', 'btn green small', r >= 10 ? 'Mastered' : 'Rank up'); lb.disabled = !!why; lb.onclick = () => g.rankUp(sk.id); acts.appendChild(lb);
    if (sk.type !== 'passive' && g.skillUnlocked(sk)) {
      const inUse = sk.type === 'ultimate' ? S.ult === sk.id : S.loadout.includes(sk.id);
      const eb = h('button', 'btn small' + (inUse ? ' gray' : ''), inUse ? 'In loadout' : 'Equip');
      eb.disabled = inUse;
      eb.onclick = () => { if (sk.type === 'ultimate') g.setLoadout('ult', sk.id); else { const i = typeof this.sel.skSlot === 'number' ? this.sel.skSlot : Math.max(0, S.loadout.indexOf(null)); g.setLoadout(i, sk.id); } this.sel.skSlot = null; };
      acts.appendChild(eb);
    }
    det.appendChild(acts); body.appendChild(det);
  }
  // the numbers of a skill at a rank, for tooltips and the Skills window
  skillNumbers(sk, r) {
    const k = rankMult(r), pct = (v) => `${Math.round(v * 100)}%`, out = [];
    if (sk.type === 'passive') {
      const p = sk.p;
      if (p.stat) for (const [key, v] of Object.entries(p.stat)) out.push(`${key === 'summonSlots' ? `+${v}` : `+${(v * k).toFixed(1).replace(/\.0$/, '')}${key === 'statShare' || key === 'summonCrit' ? '%' : '%'}`} ${STAT_WORD[key] || key}`);
      if (p.cond) out.push(`+${(p.cond.v * k).toFixed(1).replace(/\.0$/, '')}% ${p.cond.key === 'crit' ? 'critical chance' : p.cond.key === 'critDmg' ? 'critical damage' : p.cond.key === 'aspd' ? 'attack speed' : 'damage'} when it applies`);
      if (p.onKill?.heal) out.push(`heal ${(p.onKill.heal * k).toFixed(1)}% HP per kill`);
      if (p.onKill?.atkStack) out.push(`+${(p.onKill.atkStack[0] * k).toFixed(1)}% attack per stack`);
      if (p.onHurt?.atkStack) out.push(`+${(p.onHurt.atkStack[0] * k).toFixed(1)}% attack per stack`);
      if (p.onHurt?.reflectM) out.push(`${pct(p.onHurt.reflectM * k)} attack as lightning`);
      if (p.onHit?.stunChance) out.push(`${(p.onHit.stunChance * k).toFixed(1)}% stun chance`);
      if (p.onHit?.manaOnCrit) out.push(`${(p.onHit.manaOnCrit * k).toFixed(1)}% mana per critical`);
      if (p.onHit?.healAllies) out.push(`heal allies ${(p.onHit.healAllies * k).toFixed(1)}%`);
      if (p.skillMod) { const m = p.skillMod; if (m.cd) out.push(`${SKILL_BY_ID[m.id].name} cooldown ${Math.max(-60, m.cd * k).toFixed(0)}%`); if (m.dur) out.push(`${SKILL_BY_ID[m.id].name} lasts +${(m.dur * k).toFixed(0)}%`); if (m.area) out.push(`${SKILL_BY_ID[m.id].name} area +${(m.area * k).toFixed(0)}%`); if (m.charge) out.push(`charges ${Math.abs(m.charge * k).toFixed(0)}% faster`); }
      if (p.secondWind) out.push(`heal ${(p.secondWind.heal * k).toFixed(1)}% · ${p.secondWind.cd} s cooldown`);
      return out.join(' · ') || 'Always on';
    }
    if (sk.m) out.push(`${pct(sk.m * k)}${sk.hits > 1 ? ` x${sk.hits}` : ''}${sk.k === 'zone' || sk.k === 'channel' ? ' per tick' : ''} attack damage`);
    if (sk.pct) out.push(`heal ${pct(sk.pct * (1 + 0.06 * (r - 1)))} max HP`);
    if (sk.shieldPct) out.push(`shield ${pct(sk.shieldPct * k)} max HP`);
    if (sk.heal) out.push(`heal ${pct(sk.heal * (1 + 0.06 * (r - 1)))} per tick`);
    if (sk.mods) for (const [key, v] of Object.entries(sk.mods)) out.push(key === 'dmgTaken' ? `${v < 1 ? '-' : '+'}${Math.round(Math.abs(1 - v) * 100 * (v < 1 ? Math.min(1.6, k) : 1))}% damage taken` : `+${Math.round((v - 1) * 100 * k)}% ${STAT_WORD[key] || key}`);
    if (sk.dur) out.push(`${sk.dur} s`);
    if (sk.stun) out.push(`stun ${sk.stun} s`);
    if (sk.cd) out.push(`MP ${sk.mp} · cooldown ${sk.cd} s`);
    return out.join(' · ');
  }

  panel_pets(body) {
    const g = this.g, S = g.S;
    const tab = this.tabs(body, 'petTab', [['pets', `Pets (${Object.keys(S.pets).length}/${PETS.length})`], ['sprites', `Sprites (${S.sprites.length}/${SPRITES.length})`]]);
    if (tab === 'pets') {
      const cards = h('div', 'cards');
      for (const pd of PETS) {
        const own = S.pets[pd.id];
        const c = h('button', 'card' + (own ? '' : ' locked') + (this.sel.pet === pd.id ? ' sel' : ''));
        c.innerHTML = `<img alt="" src="${g.petIcon(pd.id)}"><div>${own ? esc(pd.name) : '???'}</div><div class="rar" style="color:${RARC[pd.rarity]}">${RAR[pd.rarity]}</div><div class="pab">${esc(PET_ABILITIES[pd.id].name)}</div>${S.activePet === pd.id ? '<span class="on">OUT</span>' : ''}`;
        c.onclick = () => { this.sel.pet = pd.id; this.renderPanel(); };
        cards.appendChild(c);
      }
      body.appendChild(cards);
      const pd = PETS.find((x) => x.id === (this.sel.pet || S.activePet || PETS[0].id)), own = S.pets[pd.id];
      const det = h('div', 'detail');
      const lv = own ? own.lv : 1, k = 1 + 0.15 * (lv - 1);
      det.innerHTML = `<img alt="" src="${g.petIcon(pd.id)}" ${own ? '' : 'style="filter:grayscale(1) brightness(.5)"'}><div class="dtx"><b>${own ? esc(pd.name) : '???'}</b> <span style="color:${RARC[pd.rarity]}">${RAR[pd.rarity]} ${esc(pd.species)}</span><br>${own ? `Level ${lv} · Attack ${fmt(pd.atk * k)} · HP +${fmt(pd.hp * k)}` : `How to obtain: ${esc(pd.src)}`}
        <div class="pet-ab"><b>${ico('paw', 'ico inl')}${esc(PET_ABILITIES[pd.id].name)}</b> ${esc(petAbilityText(PET_ABILITIES[pd.id], lv))}<small>${lv < PET_MAX_LV ? `Grows each time you feed ${own ? esc(pd.name) : 'this pet'} · at Lv ${PET_MAX_LV}: ${esc(petAbilityText(PET_ABILITIES[pd.id], PET_MAX_LV))}` : 'Fully grown'}</small></div>
        Pets fight beside you, add to your Battle Rating and lend you their ability while summoned.</div>`;
      if (own) {
        const acts = h('div', 'acts');
        if (S.activePet === pd.id) { const b = h('button', 'btn gray', 'Recall'); b.onclick = () => g.setPet(null); acts.appendChild(b); }
        else { const b = h('button', 'btn green', 'Summon'); b.onclick = () => g.setPet(pd.id); acts.appendChild(b); }
        const f = h('button', 'btn', `Feed · <span class="coin" style="display:inline-block;vertical-align:-3px"></span> ${fmt(150 * lv * lv)}`); f.onclick = () => g.feedPet(pd.id); acts.appendChild(f);
        det.appendChild(acts);
      }
      body.appendChild(det);
    } else {
      const list = h('div', 'list');
      for (const sd of SPRITES) {
        const own = S.sprites.includes(sd.id);
        const r = h('div', 'row');
        r.innerHTML = `<div class="ic"><img alt="" src="${g.spriteIcon(sd.id)}"></div><div class="tx"><b>${esc(sd.name)} <span style="color:var(--cyan);font-size:12px">${sd.element} Sprite</span></b>${esc(sd.desc)}${own ? '' : '<br><span style="color:var(--dim)">Locked — earned from the Spirit Guide for your element</span>'}</div>`;
        if (own) { const b = h('button', S.activeSprite === sd.id ? 'btn gray small' : 'btn green small', S.activeSprite === sd.id ? 'Active' : 'Call'); b.onclick = () => g.setSprite(sd.id); r.appendChild(b); }
        list.appendChild(r);
      }
      body.appendChild(list);
    }
  }

  panel_mounts(body) {
    const g = this.g, S = g.S;
    const cards = h('div', 'cards');
    for (const md of MOUNTS) {
      const own = S.mounts.includes(md.id);
      const c = h('button', 'card' + (own ? '' : ' locked') + (this.sel.mount === md.id ? ' sel' : ''));
      c.innerHTML = `<img alt="" src="${g.mountIcon(md.id)}"><div>${esc(md.name)}</div><div class="rar" style="color:var(--gold)">+${Math.round((md.speed - 1) * 100)}% speed</div>${S.activeMount === md.id ? '<span class="on">ACTIVE</span>' : ''}`;
      c.onclick = () => { this.sel.mount = md.id; this.renderPanel(); };
      cards.appendChild(c);
    }
    body.appendChild(cards);
    const md = MOUNTS.find((x) => x.id === (this.sel.mount || S.activeMount || MOUNTS[0].id)), own = S.mounts.includes(md.id);
    const det = h('div', 'detail');
    det.innerHTML = `<img alt="" src="${g.mountIcon(md.id)}" ${own ? '' : 'style="filter:grayscale(1) brightness(.5)"'}><div class="dtx"><b>${esc(md.name)}</b><br>Move speed +${Math.round((md.speed - 1) * 100)}% · Battle Rating +${md.br}<br>${own ? 'Every mount you own adds to your Battle Rating.' : `How to obtain: ${esc(md.src)}`}</div>`;
    if (own) {
      const acts = h('div', 'acts');
      if (S.activeMount !== md.id) { const b = h('button', 'btn green', 'Set Active'); b.onclick = () => g.setMount(md.id); acts.appendChild(b); }
      const r = h('button', 'btn blue', g.mounted ? 'Dismount' : 'Ride (R)'); r.onclick = () => { if (S.activeMount !== md.id) g.setMount(md.id); g.toggleMount(); this.closePanels(); }; acts.appendChild(r);
      det.appendChild(acts);
    }
    body.appendChild(det);
  }

  panel_quests(body) {
    if (this.tabs(body, 'qTab', [['story', 'Story'], ['guide', 'Guide']]) === 'guide') { this.guidePanel(body); return; }
    const g = this.g, S = g.S, q = g.quest();
    const idx = q && q.def ? QUESTS.findIndex((x) => x.id === q.def.id) : QUESTS.length;
    const curCh = idx < QUESTS.length ? QUESTS[idx].ch || 1 : CHAPTERS.length;
    for (const c of CHAPTERS) if (c.n < curCh) body.appendChild(h('div', 'row slim done-ch', `<div class="ic">${ico('star')}</div><div class="tx"><b>Chapter ${ROMAN[c.n]} · ${esc(c.name)}</b>Complete · ${esc(c.lv)}</div>`));
    const C = CHAPTERS.find((c) => c.n === curCh);
    body.appendChild(h('div', 'lbl', `Chapter ${ROMAN[curCh]} · ${esc(C.name)} <span class="muted">${esc(C.lv)}</span>`));
    const list = h('div', 'list');
    QUESTS.forEach((qd, i) => {
      if (i > idx || (qd.ch || 1) !== curCh) return;
      const cur = i === idx;
      const r = h('div', 'row');
      r.innerHTML = `<div class="ic">${ico(cur ? 'quests' : 'star')}</div><div class="tx"><b style="color:${cur ? '#ffe066' : 'var(--muted)'}">${esc(qd.name)}</b>${cur ? `${esc(qd.text)}<br><span style="color:#7aff7a">${esc(g.questObjective(q))}</span>` : 'Completed'}</div>`;
      if (cur) { const b = h('button', 'btn small blue', 'Auto-path'); b.onclick = () => { this.closePanels(); g.autoQuest('main'); }; r.appendChild(b); }
      list.appendChild(r);
    });
    if (idx >= QUESTS.length) list.appendChild(h('div', 'row', '<div class="tx"><b>Your legend is complete!</b>The Spirits sing again. Keep conquering dungeons, world bosses and guild wars.</div>'));
    body.appendChild(list);
    body.appendChild(h('div', 'lbl', '<br>Bounty'));
    const B = S.bounty;
    body.appendChild(h('div', 'row', `<div class="ic">${ico('bounty')}</div><div class="tx">${B ? `<b>Defeat ${B.count} ${esc(MONSTERS[B.target].name)}</b>Progress ${B.prog}/${B.count}${B.status === 'complete' ? ' — report to Captain Elena' : ''}` : g.bountyUnlocked() ? '<b>No active bounty</b>Captain Elena by the east gate has work for you.' : '<b>Locked</b>Bounties unlock after "Swift as the Wind".'}</div>`));
    body.appendChild(h('div', 'lbl', '<br>Journal <span class="muted">· directions, word for word</span>'));
    const J = h('div', 'journal');
    if (!(S.journal || []).length) J.appendChild(h('div', 'muted', 'Nothing written yet. Quest givers tell you the way when you accept a task; ask the tracker for directions any time.'));
    for (const j of (S.journal || []).slice(0, 12)) J.appendChild(h('div', 'jr', `<small>${new Date(j.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>${esc(j.text)}`));
    body.appendChild(J);
    body.appendChild(h('div', 'lbl', '<br>Party'));
    const mates = partyMembers().filter((x) => !x.me);
    if (mates.length) body.appendChild(h('div', 'row', `<div class="ic">${ico('cls_' + S.cls)}</div><div class="tx"><b>Party of ${mates.length + 1}</b>With ${mates.map((x) => esc(x.pr.info.name)).join(', ')}. Members nearby share EXP from kills.</div>`));
    else body.appendChild(h('div', 'row', `<div class="ic">${ico('cls_' + S.cls)}</div><div class="tx"><b>Solo adventurer</b>Your pet${S.activePet ? ` ${esc(PETS.find((x) => x.id === S.activePet).name)}` : ''}${S.activeSprite ? ` and sprite ${esc(SPRITES.find((x) => x.id === S.activeSprite).name)}` : ''} fight at your side.</div>`));
  }

  panel_map(body) {
    const g = this.g, mm = g.map.minimap || g.world.minimap;
    // World: the whole map; Town: Sylvan Haven up close with every keeper's role icon and name
    const view = g.map.isDungeon ? 'world' : this.tabs(body, 'mapView', [['world', 'World'], ['town', 'Sylvan Haven']]);
    const town = view === 'town';
    const wrap = h('div', 'worldmap');
    const cv = document.createElement('canvas'); cv.width = 560; cv.height = 560; wrap.appendChild(cv);
    this.wmCanvas = cv; this.wmTown = town;
    if (!g.map.isDungeon && !town) for (const z of ZONES) {
      if (!g.fogSeen(z.x, z.z) && g.zoneCoverage(z) < 0.05) continue;
      const l = h('div', 'wm-label stroke', `${esc(z.name)}<small>${esc(z.lv)}</small>`);
      l.style.left = ((z.x - mm.minX) / mm.size * 100) + '%'; l.style.top = ((z.z - mm.minZ) / mm.size * 100) + '%';
      wrap.appendChild(l);
    }
    const V = this.mapView(mm);
    if (town) for (const n of g.npcs) {
      if (!this.inTown(n.pos)) continue;
      const b = h('button', 'wm-npc', `${n.data.icon ? ico(n.data.icon) : ''}<span class="stroke">${esc(n.data.name)}</span>`);
      b.style.left = ((n.pos.x - V.x0) / V.size * 100) + '%'; b.style.top = ((n.pos.z - V.z0) / V.size * 100) + '%';
      b.title = `${n.data.name} · ${n.data.title}`; b.setAttribute('aria-label', b.title);
      b.onclick = (e) => { e.stopPropagation(); this.closePanels(); g.engage = false; g.talkTo(n); };
      wrap.appendChild(b);
    }
    cv.onclick = (e) => {
      const r = cv.getBoundingClientRect(), V2 = this.mapView(mm);
      const x = V2.x0 + (e.clientX - r.left) / r.width * V2.size, z = V2.z0 + (e.clientY - r.top) / r.height * V2.size;
      if (g.map.isDungeon) return;
      if (!g.fogSeen(x, z)) { this.toast('You have not been there yet', 'warn'); return; }
      g.giveDirections(x, z, 'that spot', null, false);
    };
    body.appendChild(wrap);
    if (!g.map.isDungeon) {
      body.appendChild(h('div', 'lbl', 'Town services'));
      const L = h('div', 'list services');
      for (const [id, what, name, sel] of SERVICES) {
        const n = g.npcById(id); if (!n) continue;
        const r = h('div', 'row slim', `<div class="ic">${ico(n.data.icon)}</div><div class="tx"><b>${esc(n.data.name)} <span class="muted">· ${esc(n.data.title)}</span></b>${esc(what)}</div>`);
        const b = h('button', 'btn small blue', 'Find'); b.onclick = () => { Object.assign(this.sel, sel || {}); g.goToStation(name); };
        r.appendChild(b); L.appendChild(r);
      }
      body.appendChild(L);
      // cartography: copy the zones you know onto parchment for other explorers
      const sv = g.masteryLv('survival');
      body.appendChild(h('div', 'lbl', `Cartography <span class="muted">· Survival mastery ${sv}${sv < SURVEY_MIN_MASTERY ? ` (copying needs ${SURVEY_MIN_MASTERY})` : ''} · Blank Parchment ${g.countItem('blank_parchment')}</span>`));
      const CL = h('div', 'list carto');
      for (const z of g.surveyZones()) {
        const cov = g.zoneCoverage(z); if (cov < 0.05) continue;
        const r = h('div', 'row slim', `<div class="ic">${ico('survey_map')}</div><div class="tx"><b>${esc(z.name)}</b>${Math.round(cov * 100)}% explored${cov < SURVEY_COVER ? ` · copy at ${Math.round(SURVEY_COVER * 100)}%` : ''}</div>`);
        const b = h('button', 'btn small', 'Copy map'); b.disabled = cov < SURVEY_COVER || sv < SURVEY_MIN_MASTERY || !g.countItem('blank_parchment'); b.onclick = () => g.copySurvey(z.name);
        r.appendChild(b); CL.appendChild(r);
      }
      if (!CL.children.length) CL.appendChild(h('div', 'muted', 'Explore a zone to copy its map.'));
      body.appendChild(CL);
    }
    body.appendChild(h('div', '', `<div style="margin-top:8px;font-size:12px;color:var(--muted)">${g.map.isDungeon ? 'Sealed chambers open once the room before them is cleared.' : town ? 'Tap a keeper to walk over and talk.' : 'Your map fills in only where you have walked. There is no auto-path: click a spot you have seen for directions by landmark. Blue stones are waystones: awaken them on foot, then travel between them (Nix in town).'}</div>`));
    this.drawWorldMap();
  }
  // the part of the world the map canvas shows: everything, or the town square
  mapView(mm) { return this.wmTown && !this.g.map.isDungeon ? { x0: -TOWN_R, z0: -TOWN_R, size: TOWN_R * 2 } : { x0: mm.minX, z0: mm.minZ, size: mm.size }; }
  inTown(p) { return Math.abs(p.x) < TOWN_R - 4 && Math.abs(p.z) < TOWN_R - 4; }
  // a round role pin for an NPC icon (rasterized once), drawn on the minimap and the world map
  npcPin(key) {
    const P = this.pins || (this.pins = new Map());
    if (!key) return null;
    if (!P.has(key)) {
      P.set(key, null);
      iconCanvas(key, 64).then((ic) => {
        const c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d');
        const gr = x.createRadialGradient(20, 13, 2, 20, 20, 19); gr.addColorStop(0, '#3a4a66'); gr.addColorStop(1, '#151c2b');
        x.beginPath(); x.arc(20, 20, 18.5, 0, Math.PI * 2); x.fillStyle = gr; x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#f3c75b'; x.stroke();
        x.drawImage(ic, 7, 7, 26, 26); P.set(key, c);
      });
    }
    return P.get(key);
  }
  drawWorldMap() {
    const cv = this.wmCanvas; if (!cv || !cv.isConnected) return;
    const g = this.g, c = cv.getContext('2d'), mm = g.map.minimap || g.world.minimap, V = this.mapView(mm), k = cv.width / V.size, ppu = mm.canvas.width / mm.size;
    c.fillStyle = '#0c0f1c'; c.fillRect(0, 0, cv.width, cv.height);
    c.imageSmoothingEnabled = true;
    c.drawImage(mm.canvas, (V.x0 - mm.minX) * ppu, (V.z0 - mm.minZ) * ppu, V.size * ppu, V.size * ppu, 0, 0, cv.width, cv.height);
    if (!g.map.isDungeon) this.drawFog(c, V.x0, V.z0, V.size, cv.width, cv.height);
    const seen = (x, z) => g.map.isDungeon || g.fogSeen(x, z);
    const P = (x, z) => [(x - V.x0) * k, (z - V.z0) * k];
    if (!g.map.isDungeon && !this.wmTown) {
      { const [x, y] = P(DZ.x, DZ.z); c.fillStyle = 'rgba(200,20,20,.28)'; c.strokeStyle = 'rgba(255,60,40,.9)'; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.arc(x, y, DZ.r * k, 0, Math.PI * 2); c.fill(); c.stroke(); c.setLineDash([]);
        c.font = 'bold 12px Nunito, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#2a0000'; c.fillStyle = '#ff8a7a'; c.strokeText('DANGER ZONE · PvP', x, y - 4); c.fillText('DANGER ZONE · PvP', x, y - 4); c.fillStyle = '#ffd0c8'; c.font = 'bold 10px Nunito, sans-serif'; c.strokeText(DZ.name, x, y + 9); c.fillText(DZ.name, x, y + 9); c.textAlign = 'left'; }
      for (const sp of SPAWNS) { if (MONSTERS[sp.type].dz || !seen(sp.x, sp.z)) continue; const [x, y] = P(sp.x, sp.z); c.fillStyle = MONSTERS[sp.type].boss ? 'rgba(255,60,160,.35)' : 'rgba(255,90,60,.22)'; c.beginPath(); c.arc(x, y, sp.r * k + (MONSTERS[sp.type].boss ? 10 : 0), 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 11px Nunito, sans-serif'; c.strokeStyle = '#000'; c.lineWidth = 3; const lbl = `${MONSTERS[sp.type].name} Lv${MONSTERS[sp.type].lvl[0]}`; c.strokeText(lbl, x - 30, y + 4); c.fillText(lbl, x - 30, y + 4); }
      for (const n of g.npcs) {
        if (!seen(n.pos.x, n.pos.z)) continue;
        const [x, y] = P(n.pos.x, n.pos.z), pin = !this.inTown(n.pos) && this.npcPin(n.data.icon);
        if (pin) c.drawImage(pin, x - 9, y - 9, 18, 18);
        else { c.fillStyle = '#ffe066'; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
      }
      // landmarks and waystones you have seen
      c.textAlign = 'center';
      for (const L of g.landmarks || []) { if (L.kind === 'none' || !seen(L.x, L.z)) continue; const [x, y] = P(L.x, L.z); c.fillStyle = '#' + (L.color ?? 0xffffff).toString(16).padStart(6, '0'); c.strokeStyle = '#1a1208'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 4, y); c.lineTo(x, y + 6); c.lineTo(x - 4, y); c.closePath(); c.fill(); c.stroke(); c.font = 'italic bold 10px Nunito, sans-serif'; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(L.name.replace(/^the /, ''), x, y + 16); c.fillStyle = '#f4ead0'; c.fillText(L.name.replace(/^the /, ''), x, y + 16); }
      for (const e of g.waystoneEnts || []) { if (!seen(e.pos.x, e.pos.z)) continue; const [x, y] = P(e.pos.x, e.pos.z), on = g.waystoneOn(e.idx); c.fillStyle = on ? '#7ad8ff' : '#5a6070'; c.strokeStyle = '#0a1a2a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.textAlign = 'left';
      for (const pt of g.portals) { if (!seen(pt.center.x, pt.center.z)) continue; const [x, y] = P(pt.center.x, pt.center.z); c.fillStyle = '#fff'; c.font = 'bold 11px Nunito, sans-serif'; c.strokeStyle = '#2a1050'; c.lineWidth = 3; c.strokeText(pt.def.name, x - 30, y - 9); c.fillStyle = '#e8c8ff'; c.fillText(pt.def.name, x - 30, y - 9); }
    } else if (g.map.isDungeon) {
      for (const m of g.monsters) if (!m.dead && m.map === g.map) { const [x, y] = P(m.pos.x, m.pos.z); c.fillStyle = m.def0.boss ? '#ff3aa8' : '#ff4a3a'; c.beginPath(); c.arc(x, y, m.def0.boss ? 6 : 3, 0, Math.PI * 2); c.fill(); }
    }
    const p = g.player; const [px, py] = P(p.pos.x, p.pos.z);
    c.save(); c.translate(px, py); c.rotate(Math.PI - p.yaw); c.fillStyle = '#7aff7a'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 7); c.lineTo(0, 3); c.lineTo(-7, 7); c.closePath(); c.fill(); c.stroke(); c.restore();
    if (p.path.length) { c.strokeStyle = '#7aff7a'; c.setLineDash([5, 4]); c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); for (const w of p.path) c.lineTo(...P(w.x, w.z)); c.stroke(); c.setLineDash([]); }
  }

  panel_dungeons(body) {
    const g = this.g, S = g.S;
    const cur = DUNGEONS.find((d) => d.id === this.sel.dungeon) || DUNGEONS.find((d) => S.level >= d.lv - 2 && S.level < d.lv + 5) || DUNGEONS[0];
    const tabs = h('div', 'dg-tabs');
    for (const d of DUNGEONS) {
      const locked = S.level < d.lv - 2;
      const b = h('button', 'dg-tab' + (d === cur ? ' sel' : '') + (locked ? ' locked' : ''), `<img alt="" src="${g.monsterIcon(d.rooms[d.rooms.length - 1].boss)}"><span><b>${esc(d.name)}</b><small>Lv ${d.lv}+${S.dgn.best[d.id] ? ` · Best ${S.dgn.best[d.id]}` : ''}</small></span>`);
      b.onclick = () => { this.sel.dungeon = d.id; this.renderPanel(); };
      tabs.appendChild(b);
    }
    body.appendChild(tabs);
    const boss = MONSTERS[cur.rooms[cur.rooms.length - 1].boss];
    const left = g.dungeonEntries(cur), locked = S.level < cur.lv - 2;
    const named = namedBySource(cur.rooms[cur.rooms.length - 1].boss);
    const mons = [...new Set(cur.rooms.flatMap((r) => (r.spawns || []).map((x) => x[0])))].map((t) => MONSTERS[t].name);
    const brOk = g.br >= cur.recBR;
    const det = h('div', 'dg-detail');
    det.innerHTML = `
      <div class="dg-hero"><img alt="" src="${g.monsterIcon(cur.rooms[cur.rooms.length - 1].boss)}"><div><div class="dg-name">${esc(cur.name)}</div><div class="dg-sub">Boss: <b>${esc(boss.name)}</b> · Lv ${boss.lvl[0]}</div><p>${esc(cur.desc)}</p></div></div>
      <div class="dg-stats">
        <span>Recommended</span><span>Lv ${cur.lv} · BR <b style="color:${brOk ? '#7aff7a' : '#ff8a7a'}">${fmt(cur.recBR)}</b> (yours ${fmt(g.br)})</span>
        <span>Entries today</span><span><b>${left}</b> / ${cur.entries}${left ? '' : ' · then a Dungeon Ticket or 30 Diamonds'}</span>
        <span>Chambers</span><span>${cur.rooms.length} · ${esc(mons.join(', '))}</span>
        <span>Best rating</span><span>${S.dgn.best[cur.id] || '—'} · Clears ${S.dgn.clears[cur.id] || 0}</span>
      </div>
      <div class="lbl">Possible rewards</div>
      <div class="dg-loot">${[3, 4, 5].map((q) => `<span class="rw" style="color:${RARITY[q].color}">${RARITY[q].name} gear</span>`).join('')}${named.map((n) => `<span class="rw" style="color:${RARITY[LEGEND_IDS.has(n.id) ? 5 : 4].color}">[${esc(n.name)}]</span>`).join('')}<span class="rw">${ico('dungeon_ticket', 'ico inl')}Tickets</span></div>
      ${setBlock(cur.id, S)}
      <div class="dg-note">Clear every chamber to break the seal ahead, then defeat the boss. Finish under ${Math.round(({ d1: 240, d2: 300, d3: 360 })[cur.id] / 60)} min with no deaths for an <b>S</b> rating and a bigger chest. First clear guarantees a <span style="color:${RARITY[4].color}">Unique</span> item.</div>`;
    const acts = h('div', 'acts'); acts.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';
    const enter = h('button', 'btn big', locked ? `Requires Lv ${cur.lv - 2}` : left ? 'Enter Dungeon' : 'Enter (Ticket / 30 Diamonds)');
    enter.disabled = locked || !!g.dg;
    enter.onclick = () => g.enterDungeon(cur.id);
    acts.appendChild(enter);
    const portal = g.portals.find((pt) => pt.def.id === cur.id);
    if (portal && !g.dg) { const go = h('button', 'btn blue', 'Directions'); go.onclick = () => { this.closePanels(); g.goToPortal(portal); }; acts.appendChild(go); }
    det.appendChild(acts);
    body.appendChild(det);
  }

  panel_settings(body) {
    const g = this.g, S = g.S;
    const s = h('div', 'settings');
    const row = (label, key) => {
      s.appendChild(h('span', '', label));
      const b = h('button', 'switch' + (S.settings[key] ? ' on' : '')); b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', !!S.settings[key]);
      b.onclick = () => { g.setSetting(key, !S.settings[key]); this.refreshSound(); this.renderPanel(); };
      s.appendChild(b);
    };
    row('Show other players', 'others'); row('Auto-use potions at low HP', 'autoPotion'); row('Auto-collect loot', 'autoLoot'); row('Real-time shadows', 'shadows'); row('Weather effects (rain, snow, petals, leaves)', 'weather'); row('Sound & music', 'sound'); row('Sound captions (trial cues as text)', 'captions');
    body.appendChild(s);
    const acts = h('div', 'acts'); acts.style.cssText = 'display:flex;gap:8px;margin-top:16px;flex-wrap:wrap';
    const sv = h('button', 'btn blue', 'Save Game'); sv.onclick = () => { g.save(); this.toast('Game saved', 'good'); }; acts.appendChild(sv);
    if (this.openAdmin && this.adminAllowed && this.adminAllowed()) { const ad = h('button', 'btn', 'Game Master Console'); ad.onclick = () => { this.closePanels(); this.openAdmin(); }; acts.appendChild(ad); }
    const del = h('button', 'btn gray', 'New Character'); del.onclick = () => this.modal('Start over?', 'This deletes your saved hero and returns to character creation.', [{ label: 'Delete & Restart', fn: () => { try { localStorage.removeItem('alfheim_tales_save_v1'); } catch { /* ignore */ } location.reload(); } }, { label: 'Cancel', cls: 'gray' }]);
    acts.appendChild(del);
    body.appendChild(acts);
    body.appendChild(h('div', '', '<p style="font-size:12px;color:var(--muted);line-height:1.6;margin-top:14px">Controls: click to move · click monsters to attack · drag to rotate camera · scroll or pinch to zoom · WASD to walk · 1–7 skills · Q/E potions · R mount · T auto battle · Shift dodge roll · Space jump · hold right mouse button to block (Guardians) · Tab next target · F talk · Enter chat.</p>'));
  }

  panel_mall(body) {
    const g = this.g, S = g.S;
    const tab = this.tabs(body, 'mallTab', [['item', 'Supplies'], ['pet', 'Pets'], ['mount', 'Mounts']]);
    body.appendChild(h('div', '', `<div style="display:flex;gap:14px;margin-bottom:10px;font-family:var(--f-num);font-weight:400"><span class="price"><span class="coin"></span>${fmt(S.gold)}</span><span class="price" style="color:#9ae0ff"><span class="gem"></span>${fmt(S.diamonds)}</span></div>`));
    const grid = h('div', 'mall-grid');
    MALL.forEach((m, i) => {
      if (m.kind !== tab) return;
      let icon, name, owned = false;
      if (m.kind === 'item') { icon = ico(m.id); name = `${ITEMS[m.id].name} x${m.qty}`; }
      if (m.kind === 'pet') { const pd = PETS.find((x) => x.id === m.id); icon = `<img alt="" src="${g.petIcon(m.id)}">`; name = `${pd.name} <span style="color:${RARC[pd.rarity]};font-size:11px">${RAR[pd.rarity]}</span>`; owned = !!S.pets[m.id]; }
      if (m.kind === 'mount') { const md = MOUNTS.find((x) => x.id === m.id); icon = `<img alt="" src="${g.mountIcon(m.id)}">`; name = md.name; owned = S.mounts.includes(m.id); }
      const c = h('div', 'mall-item', `<div class="mi">${icon}</div><div>${name}</div><div class="price">${m.cost.gold ? `<span class="coin"></span>${fmt(m.cost.gold)}` : `<span class="gem"></span>${fmt(m.cost.diamonds)}`}</div>`);
      const b = h('button', 'btn small' + (owned ? ' gray' : ''), owned ? 'Owned' : 'Buy'); b.disabled = owned; b.onclick = () => g.buyMall(i);
      c.appendChild(b); grid.appendChild(c);
    });
    body.appendChild(grid);
  }

  panel_signin(body) {
    const g = this.g, S = g.S;
    const can = S.signin.last !== new Date().toISOString().slice(0, 10);
    const cur = S.signin.count % 7;
    const grid = h('div', 'signin');
    SIGNIN.forEach((r, i) => {
      const claimed = i < cur || (!can && i === (cur + 6) % 7 && S.signin.count > 0 && cur === 0);
      const icon = r.pet ? `<img alt="" src="${g.petIcon(r.pet)}" style="width:44px;height:44px">` : r.mount ? `<img alt="" src="${g.mountIcon(r.mount)}" style="width:44px;height:44px">` : r.gold ? ico('gold') : r.diamonds ? ico('diamond') : ico(r.items[0][0]);
      grid.appendChild(h('div', 'sday' + (i === cur && can ? ' today' : '') + (claimed ? ' claimed' : ''), `Day ${r.day}<div class="si">${icon}</div>${esc(r.label)}`));
    });
    body.appendChild(grid);
    const b = h('button', 'btn big', can ? 'Claim Today' : 'Come back tomorrow'); b.disabled = !can; b.style.marginTop = '14px'; b.onclick = () => g.claimSignin();
    const wrap = h('div', ''); wrap.style.textAlign = 'center'; wrap.appendChild(b); body.appendChild(wrap);
  }

  panel_gift(body) {
    const g = this.g, S = g.S;
    const list = h('div', 'list');
    ONLINE_GIFTS.forEach((gf, i) => {
      const done = i < S.gift.idx, cur = i === S.gift.idx;
      const left = cur ? Math.max(0, gf.secs - S.gift.t) : gf.secs;
      const r = h('div', 'row', `<div class="ic">${gf.pet ? `<img alt="" src="${g.petIcon(gf.pet)}">` : ico('gift')}</div><div class="tx"><b>${esc(gf.label)}</b>${done ? 'Claimed' : cur ? (left > 0 ? `Ready in ${Math.ceil(left)}s of play` : 'Ready to claim!') : `${Math.round(gf.secs / 60)} min after the previous gift`}</div>`);
      if (cur) { const b = h('button', 'btn small', 'Claim'); b.disabled = left > 0; b.onclick = () => g.claimGift(); r.appendChild(b); }
      list.appendChild(r);
    });
    body.appendChild(list);
    clearTimeout(this.giftRefresh); this.giftRefresh = setTimeout(() => { if (this.panelName === 'gift') this.renderPanel(); }, 1000);
  }

}

installSystemsUI(UI);
installLifeUI(UI);
installTrialsUI(UI);
installPartyUI(UI);
installTradeUI(UI);
installSocialUI(UI);
installGuideUI(UI);

// the dungeon's set: pieces you own and its bonuses
function setBlock(dungeonId, S) {
  const set = setOfDungeon(dungeonId); if (!set) return '';
  const own = new Set([...S.bag.filter((b) => b.eq?.set === set.id).map((b) => b.eq.slot), ...Object.values(S.equip).filter((e) => e?.set === set.id).map((e) => e.slot)]);
  const P = EFFECTS[set.power];
  return `<div class="lbl">${esc(set.name)} Set <span class="muted">(${own.size}/4 found)</span></div><div class="dg-set">${set.slots.map((sl) => `<span class="${own.has(sl) ? 'got' : ''}">${own.has(sl) ? '●' : '○'} ${esc(SLOT_INFO[sl].label)}</span>`).join('')}
    <div><b>2 pieces:</b> ${Object.entries(set.two).map(([k, v]) => `+${v}${SET_STAT_UI[k] || ' ' + k}`).join(', ')}</div><div><b>4 pieces · ${esc(P.name)}:</b> ${esc(P.desc)}</div></div>`;
}
const SET_STAT_UI = { crit: '% Critical', critDmg: '% Crit Damage', speed: '% Move Speed', lifesteal: '% Lifesteal', cdr: '% Cooldown Reduction', expGain: '% EXP Gain', goldFind: '% Gold Find', thorns: '% Thorns', manaCost: '% Skill MP Cost Reduction' };
function linkify(obj) {
  return esc(obj).replace(/(Talk to |Return to |Defeat |Collect )(.+?)( \(|$)/, (m, a, b, c) => `${a}<u>${b}</u>${c}`);
}
